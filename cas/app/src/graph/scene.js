// The objects of a project: every CAS row that can be drawn (functions, points, equations, inequalities, lines,
// circles, curves …), the sliders (a = 2) and checkboxes (zeige = wahr) that move them. Giac works each object out
// once with the sliders left as unknowns; the result is compiled to JavaScript, so dragging a slider or playing an
// animation redraws at full speed without asking Giac again.

import { parsePlain, compile, compileCondition, symbols, toLatex } from '../expr.js';
import { command } from '../commands.js';

export const PALETTE = ['#2F6FDF', '#D9534F', '#2E9E5B', '#8E5BD9', '#E08A1E', '#1AA3B8', '#C2417F', '#5E5A50'];

export const DEFAULT_STYLE = { width: 2.5, dash: 'solid', fill: 0.18, pointSize: 5, label: true, caption: '', trace: false, condition: '' };

const COORDINATES = new Set(['x', 'y']);

/** A number as written: 2, -1.5, 3/4 */
function numberOf(node) {
  if (!node) return null;
  if (node.t === 'num') return Number(node.v);
  if (node.t === 'neg') {
    const inner = numberOf(node.a);
    return inner === null ? null : -inner;
  }
  if (node.t === 'op' && node.op === '/') {
    const a = numberOf(node.a);
    const b = numberOf(node.b);
    return a === null || b === null || b === 0 ? null : a / b;
  }
  return null;
}

function booleanOf(node) {
  if (node && node.t === 'sym' && ['wahr', 'true'].includes(node.v)) return true;
  if (node && node.t === 'sym' && ['falsch', 'false'].includes(node.v)) return false;
  return null;
}

function graphicOf(node) {
  if (!node || node.t !== 'call' || node.prime) return null;
  const found = command(node.f);
  return found && found.graphic ? found.graphic : null;
}

/** Plain Giac text → tree, or null when Giac answered something that is no formula. */
function parse(text) {
  if (text === null || text === undefined) return null;
  const clean = String(text).trim();
  if (!clean || /undef|\?|:=|->|"/.test(clean)) return null;
  try {
    return parsePlain(clean.replace(/\blist\[/g, '[').replace(/\bmatrix\[/g, '['));
  } catch (e) {
    return null;
  }
}

/** The input of a row with slider values and free points blanked, so moving them does not rebuild the scene. */
function structureOf(row, entry) {
  const input = row.mode === 'text' ? row.text : row.latex;
  if (entry && (entry.type === 'slider' || entry.type === 'checkbox' || (entry.type === 'point' && entry.free))) return `${row.mode}:${entry.name}=#`;
  return `${row.mode}:${input}`;
}

export class Scene {
  constructor() {
    this.objects = [];
    /** name → { value, row, kind: 'slider' | 'checkbox' } */
    this.params = new Map();
    /** name → { x, y, row } for points given by numbers, which can be dragged */
    this.points = new Map();
    this.key = null;
    this.version = 0;
    this.scope = {
      value: (name) => {
        const param = this.params.get(name);
        if (param) return param.kind === 'checkbox' ? (param.value ? 1 : 0) : param.value;
        return undefined;
      },
    };
  }

  /** Works out the objects from the CAS rows; Giac is only asked again when a row changed in more than a value. */
  update(rows, engine) {
    const entries = [];
    for (const row of rows) {
      const entry = engine ? classify(row, engine) : null;
      if (entry) entries.push(entry);
    }
    const byRow = new Map(entries.map((e) => [e.row, e]));
    const key = rows.map((row) => structureOf(row, byRow.get(row))).join('\n');

    // Values of sliders, checkboxes and free points always come from the rows.
    const params = new Map();
    const points = new Map();
    for (const e of entries) {
      if (e.type === 'slider') {
        // A slider being dragged or animated is ahead of its row.
        const previous = this.params.get(e.name);
        const moving = previous && previous.kind === 'slider' && previous.dragging;
        params.set(e.name, { value: moving ? previous.value : e.value, row: e.row, kind: 'slider', dragging: Boolean(moving) });
      }
      if (e.type === 'checkbox') params.set(e.name, { value: e.value, row: e.row, kind: 'checkbox' });
      if (e.type === 'point' && e.free) {
        const previous = this.points.get(e.name);
        points.set(e.name, previous && previous.dragging ? previous : { x: e.coordinates[0], y: e.coordinates[1], row: e.row });
      }
    }
    this.params = params;
    this.points = points;

    if (key === this.key) {
      // Same objects; rows may be new objects after a reload, so point at the current ones.
      for (const object of this.objects) object.row = rows.find((r) => r.id === object.row.id) || object.row;
      this.version++;
      return false;
    }
    this.key = key;
    this.objects = engine ? this.build(entries, engine) : [];
    this.version++;
    return true;
  }

  build(entries, engine) {
    const free = [...this.params.keys()];
    const answers = engine.withFreeNames(free, () => entries.map((e) => (e.requests || []).map((request) => {
      if (request && request.live) return request;
      const answer = engine.cas.raw(request);
      return answer.error ? null : answer.value;
    })));
    const objects = [];
    entries.forEach((entry, index) => {
      if (entry.type === 'slider' || entry.type === 'checkbox') return;
      let object;
      try {
        object = this.compileEntry(entry, answers[index]);
      } catch (e) {
        object = null;
      }
      if (object) objects.push(object);
    });
    // Colours: in order of the rows, unless the row chose one.
    let colour = 0;
    for (const object of objects) object.defaultColor = PALETTE[colour++ % PALETTE.length];
    return objects;
  }

  /** A point from a Giac answer ([x, y]) or a live reference to a free point. */
  pointFn(answer) {
    if (answer && answer.live) {
      const name = answer.live;
      return () => {
        const p = this.points.get(name);
        return p ? [p.x, p.y] : [NaN, NaN];
      };
    }
    const tree = parse(answer);
    if (!tree || tree.t !== 'list' || tree.items.length !== 2) return null;
    const [fx, fy] = tree.items.map((item) => compile(item, [], this.scope));
    return () => [fx(), fy()];
  }

  numberFn(answer, variables = []) {
    const tree = parse(answer);
    if (!tree || tree.t === 'list' || tree.t === 'rel') return null;
    return compile(tree, variables, this.scope);
  }

  compileEntry(entry, answers) {
    const base = { id: entry.row.id, row: entry.row, name: entry.name || null, type: entry.type, defaultVisible: entry.defaultVisible !== false, label: entry.label || entry.name || '' };
    switch (entry.type) {
      case 'function':
      case 'expression': {
        const tree = parse(answers[0]);
        if (!tree || tree.t === 'list' || tree.t === 'rel') return null;
        const used = symbols(tree);
        if (entry.type === 'expression' && !used.has('x')) return null;
        if (used.has('y')) return null;
        const d1 = parse(answers[1]);
        const d2 = parse(answers[2]);
        const object = {
          ...base,
          type: 'function',
          f: compile(tree, ['x'], this.scope),
          d1: d1 && d1.t !== 'list' ? compile(d1, ['x'], this.scope) : null,
          d2: d2 && d2.t !== 'list' ? compile(d2, ['x'], this.scope) : null,
          latex: toLatex(tree),
        };
        if (entry.restricted) {
          object.from = this.numberFn(answers[3]);
          object.to = this.numberFn(answers[4]);
        }
        return object;
      }
      case 'implicit': {
        const tree = parse(answers[0]);
        if (!tree || tree.t === 'list') return null;
        const difference = tree.t === 'rel' ? { t: 'op', op: '-', a: tree.a, b: tree.b } : tree;
        return { ...base, F: compile(difference, ['x', 'y'], this.scope) };
      }
      case 'region': {
        const a = parse(answers[0]);
        const b = parse(answers[1]);
        if (!a || !b) return null;
        const rel = { t: 'rel', op: entry.op, a, b };
        return {
          ...base,
          test: compileCondition(rel, ['x', 'y'], this.scope),
          F: compile({ t: 'op', op: '-', a, b }, ['x', 'y'], this.scope),
          strict: entry.op === '<' || entry.op === '>',
          // y < …, y > …: the boundary is a graph
          boundary: entry.explicit ? compile(entry.side === 'a' ? b : a, ['x'], this.scope) : null,
        };
      }
      case 'point': {
        const at = entry.free ? this.pointFn({ live: entry.name }) : this.pointFn(answers[0]);
        if (!at) return null;
        return { ...base, at, free: Boolean(entry.free) };
      }
      case 'line':
      case 'ray':
      case 'segment': {
        const p = this.pointFn(answers[0]);
        if (!p) return null;
        const q = this.pointFn(answers[1]);
        if (q) return { ...base, p, q };
        const slope = this.numberFn(answers[1]);
        if (!slope || entry.type !== 'line') return null;
        return { ...base, p, q: () => { const [x, y] = p(); return [x + 1, y + slope()]; } };
      }
      case 'vector': {
        if (answers.length === 1) {
          const v = this.pointFn(answers[0]);
          return v ? { ...base, p: () => [0, 0], q: v } : null;
        }
        const p = this.pointFn(answers[0]);
        const q = this.pointFn(answers[1]);
        return p && q ? { ...base, p, q } : null;
      }
      case 'circle': {
        const center = this.pointFn(answers[0]);
        if (!center) return null;
        const through = this.pointFn(answers[1]);
        if (through) {
          return { ...base, center, radius: () => { const [a, b] = center(); const [c, d] = through(); return Math.hypot(c - a, d - b); } };
        }
        const radius = this.numberFn(answers[1]);
        return radius ? { ...base, center, radius } : null;
      }
      case 'polygon': {
        const corners = answers.map((a) => this.pointFn(a));
        return corners.every(Boolean) && corners.length >= 3 ? { ...base, corners } : null;
      }
      case 'curve': {
        const X = this.numberFn(answers[0], [entry.variable]);
        const Y = this.numberFn(answers[1], [entry.variable]);
        const from = this.numberFn(answers[2]);
        const to = this.numberFn(answers[3]);
        return X && Y && from && to ? { ...base, X, Y, from, to } : null;
      }
      case 'polar': {
        const R = this.numberFn(answers[0], [entry.variable]);
        const from = this.numberFn(answers[1]);
        const to = this.numberFn(answers[2]);
        if (!R || !from || !to) return null;
        return { ...base, type: 'curve', X: (t) => R(t) * Math.cos(t), Y: (t) => R(t) * Math.sin(t), from, to };
      }
      default:
        return null;
    }
  }
}

/** What a row is in the graphics, and what Giac has to work out for it. */
export function classify(row, engine) {
  const r = row.result;
  if (!r || !r.ok || r.kind === 'analysis') return null;
  const giac = (node) => engine.giac(node);
  const freePoint = (node) => node && node.t === 'sym' && engine.defined.get(node.v)?.kind === 'point' && isFreePoint(engine, node.v);
  const pointRequest = (node) => (freePoint(node) ? { live: node.v } : giac(node));

  const graphic = (name, node, extra = {}) => {
    const kind = graphicOf(node);
    const args = node.args;
    switch (kind) {
      case 'line':
      case 'ray':
      case 'segment':
      case 'vector':
      case 'circle':
        return { row, name, type: kind, requests: args.map((a, i) => (i < 2 ? pointRequest(a) : giac(a))), ...extra };
      case 'polygon':
        return { row, name, type: 'polygon', requests: args.map(pointRequest), ...extra };
      case 'curve': {
        const variable = args[2] && args[2].t === 'sym' ? args[2].v : 't';
        return { row, name, type: 'curve', variable, requests: [giac(args[0]), giac(args[1]), giac(args[3]), giac(args[4])], ...extra };
      }
      case 'polar': {
        const variable = args[1] && args[1].t === 'sym' ? args[1].v : 't';
        return { row, name, type: 'polar', variable, requests: [giac(args[0]), giac(args[2]), giac(args[3])], ...extra };
      }
      case 'restricted': {
        const body = giac(args[0]);
        return { row, name, type: 'function', restricted: true, requests: [body, `diff(${body},x)`, `diff(${body},x,2)`, giac(args[1]), giac(args[2])], ...extra };
      }
      default:
        return null;
    }
  };

  if (r.kind === 'definition' && r.definition) {
    const d = r.definition;
    if (d.kind === 'function') {
      if (d.params.length !== 1) return null;
      const call = `${d.name}(x)`;
      return { row, name: d.name, label: d.name, type: 'function', requests: [call, `diff(${call},x)`, `diff(${call},x,2)`] };
    }
    if (d.kind === 'point') {
      const coordinates = d.body.items.map(numberOf);
      const free = d.body.items.length === 2 && coordinates.every((c) => c !== null);
      return { row, name: d.name, type: 'point', free, coordinates, requests: [d.name] };
    }
    const body = d.body;
    const value = numberOf(body);
    if (value !== null) return { row, name: d.name, type: 'slider', value };
    const truth = booleanOf(body);
    if (truth !== null) return { row, name: d.name, type: 'checkbox', value: truth };
    if (graphicOf(body)) return graphic(d.name, body);
    return null;
  }

  const tree = r.tree;
  if (!tree) return null;
  if (tree.t === 'list' && tree.point) return { row, type: 'point', requests: [giac(tree)], label: '' };
  if (graphicOf(tree)) return graphic(null, tree);
  if (tree.t === 'rel' && ['=', '<', '>', '<=', '>='].includes(tree.op)) {
    const used = symbols(tree);
    if (![...used].some((s) => COORDINATES.has(s))) return null;
    const known = (s) => COORDINATES.has(s) || engine.defined.has(s);
    if (![...used].every(known)) return null;
    const yOnly = (node) => node.t === 'sym' && node.v === 'y';
    if (tree.op === '=') {
      if (yOnly(tree.a) && !symbols(tree.b).has('y')) {
        const body = giac(tree.b);
        return { row, type: 'function', label: 'y', requests: [body, `diff(${body},x)`, `diff(${body},x,2)`] };
      }
      if (yOnly(tree.b) && !symbols(tree.a).has('y')) {
        const body = giac(tree.a);
        return { row, type: 'function', label: 'y', requests: [body, `diff(${body},x)`, `diff(${body},x,2)`] };
      }
      return { row, type: 'implicit', requests: [`(${giac(tree.a)})-(${giac(tree.b)})`] };
    }
    const explicit = (yOnly(tree.a) && !symbols(tree.b).has('y')) || (yOnly(tree.b) && !symbols(tree.a).has('y'));
    return { row, type: 'region', op: tree.op, explicit, side: yOnly(tree.a) ? 'a' : 'b', requests: [giac(tree.a), giac(tree.b)] };
  }
  // A term in x (a result such as a derivative or a tangent): drawn when switched on.
  if ((r.kind === 'value') && r.giac) {
    const used = symbols(tree);
    if (!used.has('x') || used.has('y')) return null;
    return { row, type: 'expression', label: '', defaultVisible: false, requests: [r.giac, `diff(${r.giac},x)`, `diff(${r.giac},x,2)`] };
  }
  return null;
}

function isFreePoint(engine, name) {
  const def = engine.defined.get(name);
  if (!def || def.kind !== 'point') return false;
  try {
    const tree = engine.parse(def.input);
    const body = tree.t === 'call' ? tree.args[0] : tree.b;
    return body && body.items.length === 2 && body.items.every((item) => numberOf(item) !== null);
  } catch (e) {
    return false;
  }
}

/** The style of a row's object: its own settings over the defaults. */
export function styleOf(object) {
  const own = (object.row.graph && object.row.graph.style) || {};
  return { ...DEFAULT_STYLE, fill: object.type === 'circle' ? 0 : DEFAULT_STYLE.fill, color: object.defaultColor, ...own };
}

export function isVisible(object) {
  const graph = object.row.graph || {};
  return graph.visible === undefined ? object.defaultVisible : graph.visible;
}

export { numberOf };
