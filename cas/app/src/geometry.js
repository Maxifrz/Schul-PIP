// Geometry for the CAS and the graphics: what an object is made of (its points, its centre and radius …) as Giac
// text, and its value (a line's equation, a segment's length, an angle in degrees …). Everything stays exact and
// symbolic, so an object built on a point that is being dragged comes out as a formula in that point's coordinates
// and follows it live in the graphics.

import { parsePlain, toGiac } from './expr.js';
import { command } from './commands.js';
import { Space } from './space.js';

/** Commands that make a shape, by their German name. */
const SHAPES = new Set([
  'gerade', 'strecke', 'strahl', 'vektor', 'kreis', 'polygon', 'vieleck', 'kurve', 'polarkurve', 'funktion',
  'mittelpunkt', 'schnittpunkt', 'parallele', 'senkrechte', 'mittelsenkrechte', 'winkelhalbierende', 'höhe',
  'kreisbogen', 'kreissektor', 'schwerpunkt', 'umkreismittelpunkt', 'inkreismittelpunkt', 'höhenschnittpunkt',
  'eulergerade', 'umkreis', 'inkreis', 'punktauf', 'ortslinie', 'spiegeln', 'verschieben', 'drehen', 'strecken', 'abbilden',
  // in space
  'ebene', 'kugel', 'pyramide', 'prisma', 'quader', 'würfel', 'zylinder', 'kegel', 'schnittgerade', 'lage', 'lotfußpunkt',
  'koordinatenform', 'normalenform', 'parameterform', 'hessenormalform', 'parameterfläche', 'vektorfeld', 'tangentialebene',
  'volumen', 'oberfläche',
]);

/** Commands with a value but no shape of their own. */
const MEASURES = new Set(['abstand', 'umfang']);

export function isShapeCall(node) {
  if (!node || node.t !== 'call' || node.prime) return false;
  const found = command(node.f);
  if (!found) return false;
  if (found.name === 'winkel') return node.args.length === 3;
  return SHAPES.has(found.name);
}

export function isMeasureCall(node) {
  if (!node || node.t !== 'call' || node.prime) return false;
  const found = command(node.f);
  return Boolean(found && MEASURES.has(found.name));
}

const c = (p, i) => `(${p})[${i}]`;
const sub = (p, q) => `[${c(p, 0)}-${c(q, 0)},${c(p, 1)}-${c(q, 1)}]`;
const add = (p, q) => `[${c(p, 0)}+${c(q, 0)},${c(p, 1)}+${c(q, 1)}]`;
const scale = (k, p) => `[(${k})*${c(p, 0)},(${k})*${c(p, 1)}]`;
const dist = (p, q) => `sqrt((${c(q, 0)}-${c(p, 0)})^2+(${c(q, 1)}-${c(p, 1)})^2)`;
const rot90 = (d) => `[-${c(d, 1)},${c(d, 0)}]`;
/** Rotation of the vector d by w degrees */
const rotate = (d, w) => `[cos((${w})*pi/180)*${c(d, 0)}-sin((${w})*pi/180)*${c(d, 1)},sin((${w})*pi/180)*${c(d, 0)}+cos((${w})*pi/180)*${c(d, 1)}]`;

/** Circumcentre of A, B, C */
function circumcentre(A, B, C) {
  const [ax, ay, bx, by, cx, cy] = [c(A, 0), c(A, 1), c(B, 0), c(B, 1), c(C, 0), c(C, 1)];
  const d = `(2*(${ax}*(${by}-${cy})+${bx}*(${cy}-${ay})+${cx}*(${ay}-${by})))`;
  const a2 = `(${ax}^2+${ay}^2)`;
  const b2 = `(${bx}^2+${by}^2)`;
  const c2 = `(${cx}^2+${cy}^2)`;
  return `[(${a2}*(${by}-${cy})+${b2}*(${cy}-${ay})+${c2}*(${ay}-${by}))/${d},(${a2}*(${cx}-${bx})+${b2}*(${ax}-${cx})+${c2}*(${bx}-${ax}))/${d}]`;
}

function incentre(A, B, C) {
  const a = dist(B, C);
  const b = dist(A, C);
  const cc = dist(A, B);
  const s = `(${a}+${b}+${cc})`;
  return `[((${a})*${c(A, 0)}+(${b})*${c(B, 0)}+(${cc})*${c(C, 0)})/${s},((${a})*${c(A, 1)}+(${b})*${c(B, 1)}+(${cc})*${c(C, 1)})/${s}]`;
}

/** Inradius of A, B, C: area / half the perimeter */
function inradius(A, B, C) {
  const area = `abs((${c(B, 0)}-${c(A, 0)})*(${c(C, 1)}-${c(A, 1)})-(${c(C, 0)}-${c(A, 0)})*(${c(B, 1)}-${c(A, 1)}))/2`;
  return `(${area})/((${dist(B, C)}+${dist(A, C)}+${dist(A, B)})/2)`;
}

export class Geometry {
  constructor(engine) {
    this.engine = engine;
    this.space = new Space(this);
  }

  giac(node) {
    return this.engine.giac(node);
  }

  raw(text) {
    const answer = this.engine.cas.raw(text);
    if (answer.error) throw new Error(answer.error);
    return answer.value;
  }

  /** The definition tree of a named object, if it was made with a command or as a point. */
  definitionTree(name) {
    const def = this.engine.defined.get(name);
    if (!def || !def.input) return null;
    try {
      const tree = this.engine.parse(def.input);
      if (tree.t === 'call' && tree.args.length === 1 && tree.args[0].point) return tree.args[0];
      if (tree.t === 'rel') {
        const body = tree.b;
        return body.t === 'list' && body.tuple && (body.items.length === 2 || body.items.length === 3) ? { t: 'list', items: body.items, point: true } : body;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  /**
   * What `node` is made of: { kind, parts: [Giac text …] }. Points are named by their Giac text, so a shape built
   * on a named point refers to it by name and follows it.
   */
  shape(node, options = {}) {
    if (!node) return null;
    if (node.t === 'call' && this.space.isSpaceCall(node)) return this.space.shape(node, options);
    if (node.t === 'rel' && this.space.usesZ(node)) return this.space.shape(node, options);
    if (node.t === 'list' && node.items.length === 3 && !node.items.some((i) => i.t === 'list')) return this.space.shape(node, options);
    if (node.t === 'list' && node.point) return { kind: 'point', parts: [this.giac(node)] };
    if (node.t === 'sym') {
      const def = this.engine.defined.get(node.v);
      if (!def) return null;
      const tree = this.definitionTree(node.v);
      if (tree && this.space.inSpace(tree)) return this.space.shape(node, options);
      if (def.kind === 'point') return { kind: 'point', parts: [node.v], named: node.v };
      if (tree && (isShapeCall(tree) || (tree.t === 'list' && tree.point))) {
        const inner = this.shape(tree, options);
        // A named point made by a command is referred to by its name.
        return inner && inner.kind === 'point' ? { kind: 'point', parts: [node.v], named: node.v } : inner;
      }
      return null;
    }
    if (!isShapeCall(node)) return null;
    const name = command(node.f).name;
    const args = node.args;
    const point = (i) => this.point(args[i]);
    const need = (n) => {
      if (args.length < n) throw new Error('Hier fehlen Angaben: ' + command(node.f).syntax);
    };
    switch (name) {
      case 'gerade': {
        need(2);
        const P = point(0);
        if (this.isPoint(args[1])) return { kind: 'line', parts: [P, point(1)] };
        return { kind: 'line', parts: [P, add(P, `[1,${this.giac(args[1])}]`)] };
      }
      case 'strecke':
        need(2);
        return { kind: 'segment', parts: [point(0), point(1)] };
      case 'strahl':
        need(2);
        return { kind: 'ray', parts: [point(0), point(1)] };
      case 'vektor':
        need(1);
        if (args.length === 1) return { kind: 'vector', parts: ['[0,0]', point(0)] };
        return { kind: 'vector', parts: [point(0), point(1)] };
      case 'kreis':
      case 'umkreis': {
        need(2);
        if (args.length >= 3 || name === 'umkreis') {
          need(3);
          const [A, B, C] = [point(0), point(1), point(2)];
          const M = circumcentre(A, B, C);
          return { kind: 'circle', parts: [M, dist(M, A)] };
        }
        const M = point(0);
        const r = this.isPoint(args[1]) ? dist(M, point(1)) : this.giac(args[1]);
        return { kind: 'circle', parts: [M, r] };
      }
      case 'inkreis': {
        need(3);
        const [A, B, C] = [point(0), point(1), point(2)];
        return { kind: 'circle', parts: [incentre(A, B, C), inradius(A, B, C)] };
      }
      case 'kreisbogen':
      case 'kreissektor':
        need(3);
        return { kind: name === 'kreisbogen' ? 'arc' : 'sector', parts: [point(0), point(1), point(2)] };
      case 'polygon':
        need(3);
        return { kind: 'polygon', parts: args.map((a) => this.point(a)) };
      case 'vieleck': {
        // vieleck(A, B, n): regular n-gon on the side AB
        need(3);
        const n = Number(this.raw(this.giac(args[2])));
        if (!Number.isInteger(n) || n < 3 || n > 24) throw new Error('Ein regelmäßiges Vieleck braucht 3 bis 24 Ecken.');
        const A = point(0);
        const B = point(1);
        const d = sub(B, A);
        const parts = [A, B];
        let last = B;
        for (let k = 1; k < n - 1; k++) {
          last = add(last, rotate(d, `${k}*360/${n}`));
          parts.push(last);
        }
        return { kind: 'polygon', parts };
      }
      case 'winkel':
        return { kind: 'angle', parts: [point(0), point(1), point(2)] };
      case 'mittelpunkt': {
        need(1);
        if (args.length === 1) {
          const inner = this.shape(args[0]);
          if (inner && inner.kind === 'segment') return { kind: 'point', parts: [scale('1/2', add(inner.parts[0], inner.parts[1]))] };
          if (inner && inner.kind === 'circle') return { kind: 'point', parts: [inner.parts[0]] };
          throw new Error('mittelpunkt braucht zwei Punkte, eine Strecke oder einen Kreis.');
        }
        return { kind: 'point', parts: [scale('1/2', add(point(0), point(1)))] };
      }
      case 'schwerpunkt':
        need(3);
        return { kind: 'point', parts: [scale('1/3', add(add(point(0), point(1)), point(2)))] };
      case 'umkreismittelpunkt':
        need(3);
        return { kind: 'point', parts: [circumcentre(point(0), point(1), point(2))] };
      case 'inkreismittelpunkt':
        need(3);
        return { kind: 'point', parts: [incentre(point(0), point(1), point(2))] };
      case 'höhenschnittpunkt': {
        need(3);
        const [A, B, C] = [point(0), point(1), point(2)];
        return { kind: 'point', parts: [sub(add(add(A, B), C), scale(2, circumcentre(A, B, C)))] };
      }
      case 'eulergerade': {
        need(3);
        const [A, B, C] = [point(0), point(1), point(2)];
        return { kind: 'line', parts: [scale('1/3', add(add(A, B), C)), circumcentre(A, B, C)] };
      }
      case 'höhe': {
        // höhe(A, B, C): the altitude from A onto BC, as a segment to its foot
        need(3);
        const [A, B, C] = [point(0), point(1), point(2)];
        const d = sub(C, B);
        const t = `((${c(A, 0)}-${c(B, 0)})*${c(d, 0)}+(${c(A, 1)}-${c(B, 1)})*${c(d, 1)})/(${c(d, 0)}^2+${c(d, 1)}^2)`;
        return { kind: 'segment', parts: [A, add(B, scale(t, d))] };
      }
      case 'mittelsenkrechte': {
        need(2);
        const [A, B] = [point(0), point(1)];
        const M = scale('1/2', add(A, B));
        return { kind: 'line', parts: [M, add(M, rot90(sub(B, A)))] };
      }
      case 'winkelhalbierende': {
        need(3);
        const [A, B, C] = [point(0), point(1), point(2)];
        const u = scale(`1/${dist(B, A)}`, sub(A, B));
        const v = scale(`1/${dist(B, C)}`, sub(C, B));
        return { kind: 'line', parts: [B, add(B, add(u, v))] };
      }
      case 'parallele':
      case 'senkrechte': {
        need(2);
        const [objectArg, pointArg] = this.isPoint(args[0]) ? [args[1], args[0]] : [args[0], args[1]];
        const P = this.point(pointArg);
        const { a, b } = this.lineCoefficients(objectArg);
        const direction = name === 'parallele' ? `[-(${b}),${a}]` : `[${a},${b}]`;
        return { kind: 'line', parts: [P, add(P, direction)] };
      }
      case 'schnittpunkt': {
        need(2);
        const E1 = this.equation(args[0]);
        const E2 = this.equation(args[1]);
        return { kind: 'points', parts: [`solve([${E1}=0,${E2}=0],[x,y])`] };
      }
      case 'punktauf':
        return this.glider(args, options);
      case 'ortslinie':
        need(2);
        if (args[0].t !== 'sym' || args[1].t !== 'sym') throw new Error('ortslinie(P, a): ein benannter Punkt und ein Schieberegler oder Punkt auf einem Objekt.');
        return { kind: 'locus', parts: [], point: args[0].v, parameter: args[1].v };
      case 'spiegeln':
      case 'verschieben':
      case 'drehen':
      case 'strecken':
      case 'abbilden':
        return this.transform(name, args);
      case 'kurve':
        need(5);
        return { kind: 'curve', parts: [this.giac(args[0]), this.giac(args[1]), this.giac(args[3]), this.giac(args[4])], variable: args[2].t === 'sym' ? args[2].v : 't' };
      case 'polarkurve':
        need(4);
        return { kind: 'polar', parts: [this.giac(args[0]), this.giac(args[2]), this.giac(args[3])], variable: args[1].t === 'sym' ? args[1].v : 't' };
      case 'funktion':
        need(3);
        return { kind: 'restricted', parts: [this.giac(args[0]), this.giac(args[1]), this.giac(args[2])] };
      default:
        return null;
    }
  }

  isPoint(node) {
    if (node.t === 'list' && node.point) return true;
    if (node.t === 'list' && node.items.length === 2 && !node.items.some((i) => i.t === 'list')) return true;
    const s = this.shape(node);
    return Boolean(s && s.kind === 'point');
  }

  /** Giac text of a point argument: a point, a named point, or anything that makes one. */
  point(node) {
    if (node.t === 'list' && !node.items.some((i) => i.t === 'list') && node.items.length === 2) return `[${node.items.map((i) => this.giac(i)).join(',')}]`;
    const s = this.shape(node);
    if (s && s.kind === 'point') return s.parts[0];
    if (node.t === 'sym' || node.t === 'call') {
      // A value that happens to be a point: [1, 2]
      const text = this.giac(node);
      const value = this.raw(text);
      if (/^(list)?\[[^[\]]*,[^[\]]*\]$/.test(value)) return text;
    }
    throw new Error('Hier wird ein Punkt erwartet, z. B. (1|2) oder A.');
  }

  /** An object as an expression that is 0 on it: a line, a circle, a graph, an equation. */
  equation(node) {
    const s = this.shape(node);
    if (s) {
      if (s.kind === 'line' || s.kind === 'ray' || s.kind === 'segment') {
        const [P, Q] = s.parts;
        return `((${c(Q, 1)}-${c(P, 1)})*(x-${c(P, 0)})-(${c(Q, 0)}-${c(P, 0)})*(y-${c(P, 1)}))`;
      }
      if (s.kind === 'circle') {
        const [M, r] = s.parts;
        return `((x-${c(M, 0)})^2+(y-${c(M, 1)})^2-(${r})^2)`;
      }
      throw new Error('Mit diesem Objekt lässt sich nicht schneiden.');
    }
    if (node.t === 'sym' && this.engine.defined.get(node.v)?.kind === 'function') return `(y-${node.v}(x))`;
    if (node.t === 'rel' && node.op === '=') return `((${this.giac(node.a)})-(${this.giac(node.b)}))`;
    const value = this.raw(this.giac(node));
    const tree = parsePlain(value.replace(/^list\[/, '['));
    if (tree.t === 'rel' && tree.op === '=') return `((${toGiac(tree.a)})-(${toGiac(tree.b)}))`;
    return `(y-(${this.giac(node)}))`;
  }

  /** a, b of a line a·x + b·y + c = 0 */
  lineCoefficients(node) {
    const E = this.equation(node);
    return { a: `diff(${E},x)`, b: `diff(${E},y)`, c: `subst(${E},[x,y],[0,0])`, E };
  }

  /**
   * punktauf(Objekt, t): a point that can only move along its object. t is where it sits: the x value on a graph
   * or a sloped line, y on an upright line, the angle on a circle, the share of the way on a segment.
   */
  glider(args, options) {
    if (!args.length) throw new Error('punktauf(Objekt, Wert)');
    const t = options.parameter || (args[1] ? `(${this.giac(args[1])})` : '0');
    const s = this.shape(args[0]);
    if (s && (s.kind === 'segment' || s.kind === 'line' || s.kind === 'ray' || s.kind === 'vector')) {
      const [P, Q] = s.parts;
      return { kind: 'point', parts: [add(P, scale(t, sub(Q, P)))], glider: { mode: s.kind === 'segment' || s.kind === 'vector' ? 'unit' : s.kind === 'ray' ? 'ray' : 'line' } };
    }
    if (s && s.kind === 'circle') {
      const [M, r] = s.parts;
      return { kind: 'point', parts: [`[${c(M, 0)}+(${r})*cos(${t}),${c(M, 1)}+(${r})*sin(${t})]`], glider: { mode: 'angle' } };
    }
    const node = args[0];
    if (node.t === 'sym' && this.engine.defined.get(node.v)?.kind === 'function') {
      return { kind: 'point', parts: [`[${t},${node.v}(${t})]`], glider: { mode: 'x' } };
    }
    const E = this.equation(node);
    const dy = this.raw(`diff(${E},y)`);
    if (dy === '0') {
      // x = c: an upright line
      return { kind: 'point', parts: [`[solve(${E}=0,x)[0],${t}]`], glider: { mode: 'y' } };
    }
    if (this.raw(`diff(${E},y,2)`) === '0') {
      return { kind: 'point', parts: [`[${t},subst(solve(${E}=0,y)[0],x=${t})]`], glider: { mode: 'x' } };
    }
    // A circle as an equation: centre and radius from the coefficients
    const C = `expand(${E})`;
    const a = `coeff(${C},x,2)`;
    const x0 = `(-coeff(${C},x,1)/(2*${a}))`;
    const y0 = `(-coeff(${C},y,1)/(2*${a}))`;
    const r = `sqrt(${x0}^2+${y0}^2-subst(${C},[x,y],[0,0])/${a})`;
    return { kind: 'point', parts: [`[${x0}+${r}*cos(${t}),${y0}+${r}*sin(${t})]`], glider: { mode: 'angle' } };
  }

  /** Reflections, translations, rotations and dilations of points, lines, circles and polygons. */
  transform(name, args) {
    if (args.length < 2) throw new Error('Hier fehlen Angaben: ' + command(name).syntax);
    const s = this.shape(args[0]);
    if (!s || !['point', 'segment', 'line', 'ray', 'vector', 'polygon', 'circle', 'arc', 'sector', 'angle'].includes(s.kind)) {
      throw new Error('Abbilden lassen sich Punkte, Strecken, Geraden, Kreise und Vielecke.');
    }
    let map;
    let radius = (r) => r;
    switch (name) {
      case 'spiegeln': {
        if (this.isPoint(args[1])) {
          const Z = this.point(args[1]);
          map = (P) => sub(scale(2, Z), P);
        } else {
          const { a, b, c: c0 } = this.lineCoefficients(args[1]);
          map = (P) => {
            const k = `2*((${a})*${c(P, 0)}+(${b})*${c(P, 1)}+(${c0}))/((${a})^2+(${b})^2)`;
            return `[${c(P, 0)}-(${k})*(${a}),${c(P, 1)}-(${k})*(${b})]`;
          };
        }
        break;
      }
      case 'verschieben': {
        const v = this.point(args[1]);
        map = (P) => add(P, v);
        break;
      }
      case 'drehen': {
        const w = this.giac(args[1]);
        const Z = args[2] ? this.point(args[2]) : '[0,0]';
        map = (P) => add(Z, rotate(sub(P, Z), w));
        break;
      }
      case 'strecken': {
        const k = this.giac(args[1]);
        const Z = args[2] ? this.point(args[2]) : '[0,0]';
        map = (P) => add(Z, scale(k, sub(P, Z)));
        radius = (r) => `abs(${k})*(${r})`;
        break;
      }
      case 'abbilden': {
        // x ↦ M·x + v: any affine map of the plane
        const M = this.giac(args[1]);
        const v = args[2] ? this.point(args[2]) : '[0,0]';
        if (s.kind === 'circle' || s.kind === 'arc' || s.kind === 'sector') throw new Error('Kreise werden dabei zu Ellipsen; abbilden geht für Punkte, Strecken, Geraden und Vielecke.');
        map = (P) => `[(${M})[0][0]*${c(P, 0)}+(${M})[0][1]*${c(P, 1)}+${c(v, 0)},(${M})[1][0]*${c(P, 0)}+(${M})[1][1]*${c(P, 1)}+${c(v, 1)}]`;
        break;
      }
      default:
        return null;
    }
    if (s.kind === 'circle') return { kind: 'circle', parts: [map(s.parts[0]), radius(s.parts[1])] };
    return { kind: s.kind, parts: s.parts.map(map) };
  }

  /** The value the CAS shows for a shape: coordinates, an equation, a length, an area, an angle. */
  value(node) {
    if (node.t === 'call' && this.space.isSpaceCall(node)) return this.space.value(node);
    if (isMeasureCall(node)) return this.measure(node);
    const s = this.shape(node);
    if (!s) throw new Error('Unbekanntes Grafikobjekt.');
    const [P, Q, R] = s.parts;
    switch (s.kind) {
      case 'point':
        return `normal(${P})`;
      case 'points':
        return P;
      case 'line':
      case 'ray': {
        const dx = this.raw(`normal(${c(Q, 0)}-${c(P, 0)})`);
        if (dx === '0') return `x=normal(${c(P, 0)})`;
        return `y=normal((${c(Q, 1)}-${c(P, 1)})/(${c(Q, 0)}-${c(P, 0)})*(x-${c(P, 0)})+${c(P, 1)})`;
      }
      case 'segment':
        return `normal(${dist(P, Q)})`;
      case 'vector':
        return `normal(${sub(Q, P)})`;
      case 'circle': {
        const shift = (v, m) => (this.raw(`normal(${m})`) === '0' ? `${v}^2` : `(${v}-normal(${m}))^2`);
        return `${shift('x', c(P, 0))}+${shift('y', c(P, 1))}=normal((${Q})^2)`;
      }
      case 'arc':
      case 'sector': {
        const r = dist(P, Q);
        const angle = `(atan2(${c(R, 1)}-${c(P, 1)},${c(R, 0)}-${c(P, 0)})-atan2(${c(Q, 1)}-${c(P, 1)},${c(Q, 0)}-${c(P, 0)}))`;
        const sweep = `(${angle}-2*pi*floor(${angle}/(2*pi)))`;
        return s.kind === 'arc' ? `normal((${r})*${sweep})` : `normal((${r})^2*${sweep}/2)`;
      }
      case 'polygon': {
        const terms = s.parts.map((A, k) => {
          const B = s.parts[(k + 1) % s.parts.length];
          return `${c(A, 0)}*${c(B, 1)}-${c(B, 0)}*${c(A, 1)}`;
        });
        return `normal(abs(${terms.join('+')})/2)`;
      }
      case 'angle': {
        const u = sub(P, Q);
        const v = sub(R, Q);
        return `simplify(acos(normal((${c(u, 0)}*${c(v, 0)}+${c(u, 1)}*${c(v, 1)})/(${dist(Q, P)}*${dist(Q, R)})))*180/pi)`;
      }
      case 'curve':
        return `[${P},${Q}]`;
      case 'polar':
      case 'restricted':
        return P;
      case 'locus':
        return '"Ortslinie"';
      default:
        throw new Error('Unbekanntes Grafikobjekt.');
    }
  }

  measure(node) {
    const name = command(node.f).name;
    const args = node.args;
    if (name === 'abstand') {
      if (args.length < 2) throw new Error('abstand(A, B) oder abstand(P, g)');
      const P = this.point(args[0]);
      if (this.isPoint(args[1])) return `normal(${dist(P, this.point(args[1]))})`;
      const { a, b, c: c0 } = this.lineCoefficients(args[1]);
      return `normal(abs((${a})*${c(P, 0)}+(${b})*${c(P, 1)}+(${c0}))/sqrt((${a})^2+(${b})^2))`;
    }
    // umfang(Vieleck) or umfang(A, B, C, …), umfang(Kreis)
    const s = args.length === 1 ? this.shape(args[0]) : { kind: 'polygon', parts: args.map((a) => this.point(a)) };
    if (!s) throw new Error('umfang(Vieleck) oder umfang(A, B, C)');
    if (s.kind === 'circle') return `normal(2*pi*(${s.parts[1]}))`;
    if (s.kind !== 'polygon') throw new Error('umfang(Vieleck) oder umfang(A, B, C)');
    return `normal(${s.parts.map((A, k) => dist(A, s.parts[(k + 1) % s.parts.length])).join('+')})`;
  }
}
