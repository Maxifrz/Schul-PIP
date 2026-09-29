// Geometry in space: points (1|2|3), lines in parametric form, planes in every school form, spheres, solids with
// their volume, and the questions of analytic geometry (intersections, relative position, distances, angles,
// feet of perpendiculars, mirror images). Everything is Giac text, exact and symbolic like the plane geometry, so
// the 3D view can draw it and sliders move it.

import { command } from './commands.js';
import { parsePlain, toGiac } from './expr.js';

/** Commands that only exist in space */
const SPACE_ONLY = new Set([
  'ebene', 'kugel', 'pyramide', 'prisma', 'quader', 'würfel', 'zylinder', 'kegel', 'schnittgerade', 'lage',
  'lotfußpunkt', 'koordinatenform', 'normalenform', 'parameterform', 'hessenormalform', 'parameterfläche', 'vektorfeld',
  'tangentialebene', 'volumen', 'oberfläche',
]);

/** Plane commands that also work in space when their arguments are in space */
const BOTH = new Set(['gerade', 'strecke', 'vektor', 'mittelpunkt', 'schnittpunkt', 'abstand', 'winkel', 'spiegeln', 'kurve', 'verschieben']);

const c = (p, i) => `(${p})[${i}]`;
const v3 = (f) => `[${f(0)},${f(1)},${f(2)}]`;
const sub = (p, q) => v3((i) => `${c(p, i)}-${c(q, i)}`);
const add = (p, q) => v3((i) => `${c(p, i)}+${c(q, i)}`);
const scale = (k, p) => v3((i) => `(${k})*${c(p, i)}`);
const dot = (p, q) => `(${c(p, 0)}*${c(q, 0)}+${c(p, 1)}*${c(q, 1)}+${c(p, 2)}*${c(q, 2)})`;
const cross = (p, q) => `[${c(p, 1)}*${c(q, 2)}-${c(p, 2)}*${c(q, 1)},${c(p, 2)}*${c(q, 0)}-${c(p, 0)}*${c(q, 2)},${c(p, 0)}*${c(q, 1)}-${c(p, 1)}*${c(q, 0)}]`;
const norm = (p) => `sqrt(${dot(p, p)})`;
const det3 = (a, b, d) => dot(cross(a, b), d);

export class Space {
  constructor(geometry) {
    this.geometry = geometry;
    this.engine = geometry.engine;
  }

  giac(node) {
    return this.engine.giac(node);
  }

  raw(text) {
    const answer = this.engine.cas.raw(text);
    if (answer.error) throw new Error(answer.error);
    return answer.value;
  }

  /** Whether a call works in space: a space-only command, or a plane command with something in space. */
  isSpaceCall(node) {
    if (!node || node.t !== 'call' || node.prime) return false;
    const found = command(node.f);
    if (!found) return false;
    if (SPACE_ONLY.has(found.name)) return true;
    if (!BOTH.has(found.name)) return false;
    if (found.name === 'kurve') return node.args.length === 6;
    return node.args.some((a) => this.inSpace(a));
  }

  /** Whether an argument is something in space: a point with three coordinates, a plane, a line in space … */
  inSpace(node) {
    try {
      if (node.t === 'list' && !node.items.some((i) => i.t === 'list')) return node.items.length === 3;
      if (node.t === 'rel') return this.usesZ(node);
      if (node.t === 'call') {
        if (this.isSpaceCall(node)) return true;
        const found = command(node.f);
        if (found && ['vektor', 'mittelpunkt'].includes(found.name)) return node.args.some((a) => this.inSpace(a));
        return false;
      }
      if (node.t === 'sym') {
        const def = this.engine.defined.get(node.v);
        if (!def) return false;
        const tree = this.geometry.definitionTree(node.v);
        if (tree) return this.inSpace(tree);
        const value = this.raw(node.v);
        return /^(list)?\[[^[\]]*,[^[\]]*,[^[\]]*\]$/.test(value) || /\bz\b/.test(value);
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  usesZ(node) {
    if (!node) return false;
    if (node.t === 'sym') return node.v === 'z';
    return ['a', 'b'].some((k) => this.usesZ(node[k])) || (node.args || []).some((a) => this.usesZ(a)) || (node.items || []).some((a) => this.usesZ(a));
  }

  /** Giac text of a point or vector in space */
  point(node) {
    if (node.t === 'list' && node.items.length === 3 && !node.items.some((i) => i.t === 'list')) return `[${node.items.map((i) => this.giac(i)).join(',')}]`;
    if (node.t === 'call' && command(node.f)?.name === 'vektor' && node.args.length === 1) return this.point(node.args[0]);
    const s = this.shape(node);
    if (s && s.kind === 'point3') return s.parts[0];
    if (s && s.kind === 'vector3') return sub(s.parts[1], s.parts[0]);
    if (node.t === 'sym' || node.t === 'call') {
      const text = this.giac(node);
      const value = this.raw(text);
      if (/^(list)?\[[^[\]]*,[^[\]]*,[^[\]]*\]$/.test(value)) return text;
    }
    throw new Error('Hier wird ein Punkt im Raum erwartet, z. B. (1|2|3).');
  }

  isPoint(node) {
    try {
      this.point(node);
      return !(node.t === 'call' && command(node.f)?.name === 'vektor');
    } catch (e) {
      return false;
    }
  }

  isVector(node) {
    return node.t === 'call' && command(node.f)?.name === 'vektor';
  }

  /** A plane from an equation a·x + b·y + c·z = d: its normal vector and d */
  planeOfEquation(lhs, rhs) {
    const E = `(${lhs})-(${rhs})`;
    const n = `[diff(${E},x),diff(${E},y),diff(${E},z)]`;
    const d = `(-subst(${E},[x,y,z],[0,0,0]))`;
    return { kind: 'plane', parts: [n, d] };
  }

  /** What an object in space is made of. */
  shape(node, options = {}) {
    if (!node) return null;
    if (node.t === 'list' && node.items.length === 3 && !node.items.some((i) => i.t === 'list')) return { kind: 'point3', parts: [this.giac(node)] };
    if (node.t === 'rel' && node.op === '=' && this.usesZ(node)) return this.equationShape(node);
    if (node.t === 'sym') {
      const def = this.engine.defined.get(node.v);
      if (!def) return null;
      const tree = this.geometry.definitionTree(node.v);
      if (tree) {
        const inner = this.shape(tree, options);
        if (inner && inner.kind === 'point3') return { kind: 'point3', parts: [node.v], named: node.v };
        return inner;
      }
      if (def.kind === 'point') {
        const value = this.raw(node.v);
        if (/^(list)?\[[^[\]]*,[^[\]]*,[^[\]]*\]$/.test(value)) return { kind: 'point3', parts: [node.v], named: node.v };
      }
      return null;
    }
    if (node.t !== 'call' || !this.isSpaceCall(node)) return null;
    const name = command(node.f).name;
    const args = node.args;
    const need = (n) => {
      if (args.length < n) throw new Error('Hier fehlen Angaben: ' + command(node.f).syntax);
    };
    const P = (i) => this.point(args[i]);
    switch (name) {
      case 'gerade': {
        need(2);
        const A = P(0);
        if (this.isVector(args[1])) return { kind: 'line3', parts: [A, this.point(args[1])] };
        return { kind: 'line3', parts: [A, sub(P(1), A)] };
      }
      case 'strecke':
        need(2);
        return { kind: 'segment3', parts: [P(0), P(1)] };
      case 'vektor':
        need(1);
        if (args.length === 1) return { kind: 'vector3', parts: ['[0,0,0]', P(0)] };
        return { kind: 'vector3', parts: [P(0), P(1)] };
      case 'mittelpunkt':
        need(2);
        return { kind: 'point3', parts: [scale('1/2', add(P(0), P(1)))] };
      case 'ebene': {
        need(1);
        if (args.length === 1) {
          const node0 = args[0];
          if (node0.t === 'rel') return this.equationShape(node0);
          const inner = this.shape(node0);
          if (inner && inner.kind === 'plane') return inner;
          throw new Error('ebene(A, B, C), ebene(P, n) oder ebene(2x + y − z = 4)');
        }
        if (args.length === 2) {
          // Normal form: point and normal vector
          const Q = P(0);
          const n = this.point(args[1]);
          return { kind: 'plane', parts: [n, dot(n, Q)] };
        }
        const [A, B, C] = [P(0), P(1), P(2)];
        const n = cross(sub(B, A), sub(C, A));
        return { kind: 'plane', parts: [n, dot(n, A)], through: [A, B, C] };
      }
      case 'kugel': {
        need(2);
        const M = P(0);
        const r = this.isPoint(args[1]) ? norm(sub(P(1), M)) : this.giac(args[1]);
        return { kind: 'sphere', parts: [M, r] };
      }
      case 'pyramide': {
        need(4);
        const corners = args.map((a) => this.point(a));
        const apex = corners.pop();
        return { kind: 'solid', solid: 'pyramid', parts: [...corners, apex], faces: pyramidFaces(corners.length) };
      }
      case 'prisma': {
        // prisma(A, B, C, …, A'): base and where the first corner goes
        need(4);
        const corners = args.map((a) => this.point(a));
        const top = corners.pop();
        const shift = sub(top, corners[0]);
        const upper = corners.map((p) => add(p, shift));
        return { kind: 'solid', solid: 'prism', parts: [...corners, ...upper], faces: prismFaces(corners.length) };
      }
      case 'quader': {
        need(2);
        const [A, G] = [P(0), P(1)];
        const corner = (i, j, k) => `[${c(i ? G : A, 0)},${c(j ? G : A, 1)},${c(k ? G : A, 2)}]`;
        return { kind: 'solid', solid: 'box', parts: boxCorners(corner), faces: prismFaces(4) };
      }
      case 'würfel': {
        need(2);
        const A = P(0);
        const a = this.giac(args[1]);
        const G = add(A, `[${a},${a},${a}]`);
        const corner = (i, j, k) => `[${c(i ? G : A, 0)},${c(j ? G : A, 1)},${c(k ? G : A, 2)}]`;
        return { kind: 'solid', solid: 'box', parts: boxCorners(corner), faces: prismFaces(4) };
      }
      case 'zylinder':
        need(3);
        return { kind: 'cylinder', parts: [P(0), P(1), this.giac(args[2])] };
      case 'kegel':
        need(3);
        return { kind: 'cone', parts: [P(0), P(1), this.giac(args[2])] };
      case 'schnittgerade': {
        need(2);
        const E = this.plane(args[0]);
        const F = this.plane(args[1]);
        const u = cross(E.n, F.n);
        // A point on both planes: the one nearest the origin
        const point = `(((${E.d})*${dotSelf(F.n)}-(${F.d})*${dot(E.n, F.n)})*(${E.n})+((${F.d})*${dotSelf(E.n)}-(${E.d})*${dot(E.n, F.n)})*(${F.n}))/${dotSelf(u)}`;
        return { kind: 'line3', parts: [`normal(${point})`, u] };
      }
      case 'schnittpunkt': {
        need(2);
        return { kind: 'point3', parts: [this.intersection(args[0], args[1])], maybeNone: true };
      }
      case 'lotfußpunkt': {
        need(2);
        const Q = P(0);
        return { kind: 'point3', parts: [this.foot(Q, args[1])] };
      }
      case 'spiegeln': {
        need(2);
        const Q = P(0);
        if (this.isPoint(args[1])) return { kind: 'point3', parts: [sub(scale(2, P(1)), Q)] };
        const F = this.foot(Q, args[1]);
        return { kind: 'point3', parts: [sub(scale(2, F), Q)] };
      }
      case 'verschieben':
        need(2);
        return { kind: 'point3', parts: [add(P(0), this.point(args[1]))] };
      case 'kurve': {
        need(6);
        const variable = args[3].t === 'sym' ? args[3].v : 't';
        return { kind: 'curve3', variable, parts: [this.giac(args[0]), this.giac(args[1]), this.giac(args[2]), this.giac(args[4]), this.giac(args[5])] };
      }
      case 'parameterfläche': {
        // parameterfläche(x(u,v), y(u,v), z(u,v), u, a, b, v, c, d)
        need(9);
        const u = args[3].t === 'sym' ? args[3].v : 'u';
        const v = args[6].t === 'sym' ? args[6].v : 'v';
        return { kind: 'psurface', variables: [u, v], parts: [0, 1, 2, 4, 5, 7, 8].map((i) => this.giac(args[i])) };
      }
      case 'vektorfeld': {
        need(1);
        const items = args.length === 3 ? args : args[0].t === 'list' ? args[0].items : null;
        if (!items || items.length !== 3) throw new Error('vektorfeld([P, Q, R]) mit drei Termen in x, y, z');
        return { kind: 'field', parts: items.map((i) => this.giac(i)) };
      }
      case 'tangentialebene': {
        need(3);
        const f = args[0];
        const body = f.t === 'sym' && this.engine.defined.get(f.v)?.kind === 'function' ? `${f.v}(x,y)` : this.giac(f);
        const [a, b] = [this.giac(args[1]), this.giac(args[2])];
        const at = (e) => `subst(${e},[x,y],[${a},${b}])`;
        const fx = at(`diff(${body},x)`);
        const fy = at(`diff(${body},y)`);
        // z = f(a,b) + fx·(x−a) + fy·(y−b) ⇔ fx·x + fy·y − z = fx·a + fy·b − f(a,b)
        return { kind: 'plane', parts: [`[${fx},${fy},-1]`, `(${fx})*(${a})+(${fy})*(${b})-${at(body)}`] };
      }
      case 'koordinatenform':
      case 'normalenform':
      case 'parameterform':
      case 'hessenormalform': {
        need(1);
        const inner = this.shape(args[0]) || (args[0].t === 'rel' ? this.equationShape(args[0]) : null);
        if (!inner || inner.kind !== 'plane') throw new Error('Hier wird eine Ebene erwartet.');
        return { ...inner, form: name };
      }
      case 'volumen':
      case 'oberfläche': {
        need(1);
        const inner = this.shape(args[0]);
        if (!inner) throw new Error('Hier wird ein Körper erwartet.');
        return { ...inner, measure: name };
      }
      default:
        return null;
    }
  }

  equationShape(node) {
    // A linear equation in x, y, z is a plane, a sphere equation a sphere; anything else an implicit surface.
    const E = `(${this.giac(node.a)})-(${this.giac(node.b)})`;
    const second = this.raw(`normal(diff(${E},x,2))`) === '0' && this.raw(`normal(diff(${E},y,2))`) === '0' && this.raw(`normal(diff(${E},z,2))`) === '0';
    if (second) return this.planeOfEquation(this.giac(node.a), this.giac(node.b));
    return { kind: 'isurface', parts: [E] };
  }

  /** A plane argument as normal vector n and d with n·x = d */
  plane(node) {
    const s = node.t === 'rel' ? this.equationShape(node) : this.shape(node);
    if (!s || s.kind !== 'plane') throw new Error('Hier wird eine Ebene erwartet.');
    return { n: s.parts[0], d: s.parts[1] };
  }

  line(node) {
    const s = this.shape(node);
    if (!s || (s.kind !== 'line3' && s.kind !== 'segment3')) throw new Error('Hier wird eine Gerade im Raum erwartet.');
    if (s.kind === 'segment3') return { P: s.parts[0], u: sub(s.parts[1], s.parts[0]) };
    return { P: s.parts[0], u: s.parts[1] };
  }

  kindOf(node) {
    const s = node.t === 'rel' ? this.equationShape(node) : this.shape(node);
    return s ? s.kind : null;
  }

  /** Foot of the perpendicular from Q onto a line or a plane */
  foot(Q, node) {
    const kind = this.kindOf(node);
    if (kind === 'plane') {
      const { n, d } = this.plane(node);
      return sub(Q, scale(`(${dot(n, Q)}-(${d}))/${dotSelf(n)}`, n));
    }
    const { P, u } = this.line(node);
    return add(P, scale(`${dot(sub(Q, P), u)}/${dotSelf(u)}`, u));
  }

  /** The point where a line meets a plane or another line (Giac text of the point, or a string when there is none). */
  intersection(a, b) {
    let ka = this.kindOf(a);
    let kb = this.kindOf(b);
    if (ka === 'plane' && kb !== 'plane') [a, b, ka, kb] = [b, a, kb, ka];
    if (kb === 'plane' && (ka === 'line3' || ka === 'segment3')) {
      const { P, u } = this.line(a);
      const { n, d } = this.plane(b);
      const denominator = this.raw(`normal(${dot(n, u)})`);
      if (denominator === '0') {
        const onPlane = this.raw(`normal(${dot(n, P)}-(${d}))`) === '0';
        return onPlane ? '"Die Gerade liegt in der Ebene."' : '"Die Gerade ist parallel zur Ebene, kein Schnittpunkt."';
      }
      return `normal(${add(P, scale(`((${d})-${dot(n, P)})/${dot(n, u)}`, u))})`;
    }
    if ((ka === 'line3' || ka === 'segment3') && (kb === 'line3' || kb === 'segment3')) {
      const g = this.line(a);
      const h = this.line(b);
      const solution = this.raw(`linsolve([${[0, 1, 2].map((i) => `${c(g.P, i)}+t__1*${c(g.u, i)}=${c(h.P, i)}+t__2*${c(h.u, i)}`).join(',')}],[t__1,t__2])`);
      if (solution === '[]' || solution === 'list[]') return '"Kein Schnittpunkt."';
      const t = /^(?:list)?\[(.*?),/.exec(solution);
      if (!t || /t__/.test(t[1])) return '"Die Geraden sind identisch."';
      return `normal(${add(g.P, scale(t[1], g.u))})`;
    }
    throw new Error('Im Raum schneidet schnittpunkt eine Gerade mit einer Ebene oder zwei Geraden; zwei Ebenen: schnittgerade(E, F).');
  }

  /** How two objects lie to each other, in words */
  position(a, b) {
    const ka = this.kindOf(a);
    const kb = this.kindOf(b);
    const isLine = (k) => k === 'line3' || k === 'segment3';
    const zero = (text) => this.raw(`normal(${text})`) === '0';
    const pointText = (text) => this.engine.formatPointText(this.raw(`normal(${text})`));
    if (isLine(ka) && isLine(kb)) {
      const g = this.line(a);
      const h = this.line(b);
      const parallel = zero(dotSelf(cross(g.u, h.u)));
      if (parallel) {
        const same = zero(dotSelf(cross(sub(h.P, g.P), g.u)));
        return same ? '"Die Geraden sind identisch."' : '"Die Geraden sind echt parallel."';
      }
      const coplanar = zero(det3(g.u, h.u, sub(h.P, g.P)));
      if (!coplanar) return '"Die Geraden sind windschief."';
      const S = this.intersection(a, b);
      return `"Die Geraden schneiden sich in S${pointText(S)}."`;
    }
    if ((isLine(ka) && kb === 'plane') || (ka === 'plane' && isLine(kb))) {
      const S = this.intersection(a, b);
      if (S.startsWith('"')) return S;
      return `"Die Gerade schneidet die Ebene in S${pointText(S)}."`;
    }
    if (ka === 'plane' && kb === 'plane') {
      const E = this.plane(a);
      const F = this.plane(b);
      if (zero(dotSelf(cross(E.n, F.n)))) {
        // Parallel normals: same plane when d scales like n
        const k = `(${pick(F.n)})/(${pick(E.n)})`;
        const same = zero(`(${F.d})-(${k})*(${E.d})`);
        return same ? '"Die Ebenen sind identisch."' : '"Die Ebenen sind echt parallel."';
      }
      return '"Die Ebenen schneiden sich in einer Geraden (schnittgerade)."';
    }
    if (ka === 'point3' && (kb === 'plane' || isLine(kb))) {
      const Q = this.point(a);
      const on = kb === 'plane' ? zero(`${dot(this.plane(b).n, Q)}-(${this.plane(b).d})`) : zero(dotSelf(cross(sub(Q, this.line(b).P), this.line(b).u)));
      return on ? `"Der Punkt liegt ${kb === 'plane' ? 'in der Ebene' : 'auf der Geraden'}."` : `"Der Punkt liegt nicht ${kb === 'plane' ? 'in der Ebene' : 'auf der Geraden'}."`;
    }
    throw new Error('lage(…) vergleicht Geraden, Ebenen und Punkte im Raum.');
  }

  distance(a, b) {
    let ka = this.kindOf(a);
    let kb = this.kindOf(b);
    if (ka !== 'point3' && kb === 'point3') [a, b, ka, kb] = [b, a, kb, ka];
    const isLine = (k) => k === 'line3' || k === 'segment3';
    if (ka === 'point3' && kb === 'point3') return norm(sub(this.point(b), this.point(a)));
    if (ka === 'point3' && kb === 'plane') {
      const { n, d } = this.plane(b);
      return `abs(${dot(n, this.point(a))}-(${d}))/${norm(n)}`;
    }
    if (ka === 'point3' && isLine(kb)) {
      const { P, u } = this.line(b);
      return `${norm(cross(sub(this.point(a), P), u))}/${norm(u)}`;
    }
    if (isLine(ka) && isLine(kb)) {
      const g = this.line(a);
      const h = this.line(b);
      const n = cross(g.u, h.u);
      if (this.raw(`normal(${dotSelf(n)})`) === '0') return `${norm(cross(sub(h.P, g.P), g.u))}/${norm(g.u)}`;
      return `abs(${dot(sub(h.P, g.P), n)})/${norm(n)}`;
    }
    if (ka === 'plane' && kb === 'plane') {
      const E = this.plane(a);
      const F = this.plane(b);
      const k = `(${pick(F.n)})/(${pick(E.n)})`;
      return `abs((${F.d})/(${k})-(${E.d}))/${norm(E.n)}`;
    }
    if ((isLine(ka) && kb === 'plane') || (ka === 'plane' && isLine(kb))) {
      const [lineNode, planeNode] = isLine(ka) ? [a, b] : [b, a];
      const { P } = this.line(lineNode);
      const { n, d } = this.plane(planeNode);
      return `abs(${dot(n, P)}-(${d}))/${norm(n)}`;
    }
    throw new Error('abstand(…) im Raum: zwischen Punkten, Geraden und Ebenen.');
  }

  angle(a, b) {
    const ka = this.kindOf(a);
    const kb = this.kindOf(b);
    const isLine = (k) => k === 'line3' || k === 'segment3' || k === 'vector3';
    const direction = (node, k) => (k === 'vector3' ? this.point(node) : this.line(node).u);
    let cosine;
    if (isLine(ka) && isLine(kb)) {
      const u = direction(a, ka);
      const w = direction(b, kb);
      cosine = `abs(${dot(u, w)})/(${norm(u)}*${norm(w)})`;
      return `simplify(acos(${cosine})*180/pi)`;
    }
    if (ka === 'plane' && kb === 'plane') {
      const n = this.plane(a).n;
      const m = this.plane(b).n;
      return `simplify(acos(abs(${dot(n, m)})/(${norm(n)}*${norm(m)}))*180/pi)`;
    }
    if ((isLine(ka) && kb === 'plane') || (ka === 'plane' && isLine(kb))) {
      const [lineNode, lineKind, planeNode] = isLine(ka) ? [a, ka, b] : [b, kb, a];
      const u = direction(lineNode, lineKind);
      const n = this.plane(planeNode).n;
      return `simplify(asin(abs(${dot(u, n)})/(${norm(u)}*${norm(n)}))*180/pi)`;
    }
    throw new Error('winkel(…) im Raum: zwischen Geraden, Ebenen oder einer Geraden und einer Ebene.');
  }

  /** The value the CAS shows. */
  value(node) {
    const name = command(node.f).name;
    if (name === 'lage') return this.position(node.args[0], node.args[1]);
    if (name === 'abstand') return `normal(${this.distance(node.args[0], node.args[1])})`;
    if (name === 'winkel') return this.angle(node.args[0], node.args[1]);
    const s = this.shape(node);
    if (!s) throw new Error('Unbekanntes Objekt im Raum.');
    const [A, B, R] = s.parts;
    if (s.measure === 'volumen') return `normal(${this.volume(s)})`;
    if (s.measure === 'oberfläche') return `normal(${this.surfaceArea(s)})`;
    switch (s.kind) {
      case 'point3':
        return A.startsWith('"') ? A : `normal(${A})`;
      case 'line3':
        return `[normal(${A}),normal(${B})]`;
      case 'segment3':
        return `normal(${norm(sub(B, A))})`;
      case 'vector3':
        return `normal(${sub(B, A)})`;
      case 'plane':
        return this.planeValue(s);
      case 'sphere': {
        const term = (v, i) => (this.raw(`normal(${c(A, i)})`) === '0' ? `${v}^2` : `(${v}-normal(${c(A, i)}))^2`);
        return `${term('x', 0)}+${term('y', 1)}+${term('z', 2)}=normal((${B})^2)`;
      }
      case 'solid':
      case 'cylinder':
      case 'cone':
        return `normal(${this.volume(s)})`;
      case 'curve3':
        return `[${A},${B},${R}]`;
      case 'psurface':
        return `[${A},${B},${R}]`;
      case 'field':
        return `[${A},${B},${R}]`;
      case 'isurface':
        return `${A}=0`;
      default:
        throw new Error('Unbekanntes Objekt im Raum.');
    }
  }

  /** a·x + b·y + c·z = d with whole numbers when possible */
  planeValue(s) {
    const [n, d] = s.parts;
    let k = '1';
    try {
      const g = this.raw(`lgcd(normal(${n}))`);
      if (g !== '0' && !/[a-z_]/i.test(g)) k = g;
    } catch (e) {
      k = '1';
    }
    const scaled = `normal((${n})/(${k}))`;
    const dd = `normal((${d})/(${k}))`;
    return `normal(${c(scaled, 0)}*x+${c(scaled, 1)}*y+${c(scaled, 2)}*z)=${dd}`;
  }

  volume(s) {
    switch (s.kind) {
      case 'solid': {
        const P = s.parts;
        if (s.solid === 'pyramid') {
          const apex = P[P.length - 1];
          const base = P.slice(0, -1);
          const terms = [];
          for (let i = 1; i + 1 < base.length; i++) terms.push(det3(sub(base[i], base[0]), sub(base[i + 1], base[0]), sub(apex, base[0])));
          return `abs(${terms.join('+')})/6`;
        }
        // Prisms and boxes: base polygon times the shift
        const n = P.length / 2;
        const base = P.slice(0, n);
        const shift = sub(P[n], P[0]);
        const terms = [];
        for (let i = 1; i + 1 < n; i++) terms.push(det3(sub(base[i], base[0]), sub(base[i + 1], base[0]), shift));
        return `abs(${terms.join('+')})/2`;
      }
      case 'cylinder':
        return `pi*(${s.parts[2]})^2*${norm(sub(s.parts[1], s.parts[0]))}`;
      case 'cone':
        return `pi*(${s.parts[2]})^2*${norm(sub(s.parts[1], s.parts[0]))}/3`;
      case 'sphere':
        return `4/3*pi*(${s.parts[1]})^3`;
      default:
        throw new Error('volumen(…) gibt es für Körper, Zylinder, Kegel und Kugeln.');
    }
  }

  surfaceArea(s) {
    switch (s.kind) {
      case 'solid': {
        const faces = s.faces.map((face) => {
          const pts = face.map((i) => s.parts[i]);
          const terms = [];
          for (let i = 1; i + 1 < pts.length; i++) terms.push(cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0])));
          const sum = terms.reduce((acc, t) => add(acc, t));
          return `${norm(sum)}/2`;
        });
        return faces.join('+');
      }
      case 'cylinder': {
        const [A, B, r] = s.parts;
        return `2*pi*(${r})^2+2*pi*(${r})*${norm(sub(B, A))}`;
      }
      case 'cone': {
        const [M, S, r] = s.parts;
        return `pi*(${r})^2+pi*(${r})*sqrt((${r})^2+${dotSelf(sub(S, M))})`;
      }
      case 'sphere':
        return `4*pi*(${s.parts[1]})^2`;
      default:
        throw new Error('oberfläche(…) gibt es für Körper, Zylinder, Kegel und Kugeln.');
    }
  }
}

function dotSelf(p) {
  return dot(p, p);
}

/** A coordinate of n that is not 0, to compare parallel normal vectors */
function pick(n) {
  return `(when(${c(n, 0)}!=0,${c(n, 0)},when(${c(n, 1)}!=0,${c(n, 1)},${c(n, 2)})))`;
}

function pyramidFaces(n) {
  const faces = [[...Array(n).keys()]];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
  return faces;
}

function prismFaces(n) {
  const faces = [[...Array(n).keys()], [...Array(n).keys()].map((i) => n + i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + (i + 1) % n, n + i]);
  return faces;
}

function boxCorners(corner) {
  return [corner(0, 0, 0), corner(1, 0, 0), corner(1, 1, 0), corner(0, 1, 0), corner(0, 0, 1), corner(1, 0, 1), corner(1, 1, 1), corner(0, 1, 1)];
}

export { parsePlain, toGiac };
