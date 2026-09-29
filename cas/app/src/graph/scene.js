// The objects of a project: every CAS row that can be drawn (functions, points, equations, inequalities, lines,
// circles, constructions, curves …) and what moves them: sliders (a = 2), checkboxes (zeige = wahr), points given
// by numbers that can be dragged, and points on objects. Giac works each object out once with all of these left as
// unknowns; the result is compiled to JavaScript, so dragging or animating redraws everything that depends on it
// at full speed without asking Giac again.

import { parsePlain, compile, compileCondition, symbols, toLatex } from '../expr.js';

/** Definite integrals and areas that the graphics shade: which arguments are functions and which bounds */
const AREA_COMMANDS = {
  fläche: (args) => (args.length === 3 ? ['fn', 'num', 'num'] : null),
  flächezwischen: (args) => (args.length === 4 ? ['fn', 'fn', 'num', 'num'] : null),
  integriere: (args) => (args.length === 4 && args[1].t === 'sym' && args[1].v === 'x' ? ['fn', 'word', 'num', 'num'] : null),
};
import { command } from '../commands.js';
import { isShapeCall } from '../geometry.js';
import { STAT_COMMANDS, functionArg } from '../statcommands.js';

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

function isGlider(node) {
  return node && node.t === 'call' && command(node.f)?.name === 'punktauf';
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
  if (entry && entry.glider) return `${row.mode}:${entry.name}=#${entry.object}`;
  // A simulation drawn again is a new object.
  if (entry && entry.type === 'chart') return `${row.mode}:${input}#${entry.seed}`;
  return `${row.mode}:${input}`;
}

export class Scene {
  constructor() {
    this.objects = [];
    /** name → { value, row, kind: 'slider' | 'checkbox' } */
    this.params = new Map();
    /** name → { x, y, row } for points given by numbers, which can be dragged */
    this.points = new Map();
    /** name → { t, row, mode } for points on objects, which can be dragged along them */
    this.gliders = new Map();
    /** row id → { label, row, name } for knopf(…) rows */
    this.buttons = new Map();
    this.key = null;
    this.version = 0;
    this.scope = {
      value: (name) => {
        const param = this.params.get(name);
        if (param) return param.kind === 'checkbox' ? (param.value ? 1 : 0) : param.value;
        const coordinate = /^(.+)__([xyt])$/.exec(name);
        if (coordinate) {
          if (coordinate[2] === 't') return this.gliders.get(coordinate[1])?.t;
          const point = this.points.get(coordinate[1]);
          return point ? point[coordinate[2]] : undefined;
        }
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
    const gliders = new Map();
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
      if (e.glider) {
        const previous = this.gliders.get(e.name);
        gliders.set(e.name, previous && previous.dragging ? previous : { t: e.t, row: e.row, mode: e.glider.mode });
      }
    }
    this.params = params;
    this.points = points;
    this.gliders = gliders;
    this.buttons = new Map(entries.filter((e) => e.type === 'button').map((e) => [e.row.id, { label: e.label, row: e.row, name: e.name }]));

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
    // Everything that moves becomes an unknown while Giac works the objects out.
    const free = [...this.params.keys()].map((name) => ({ name }));
    for (const name of this.points.keys()) free.push({ name, symbols: [name + '__x', name + '__y'], assign: `${name}:=[${name}__x,${name}__y]` });
    for (const e of entries) if (e.glider) free.push({ name: e.name, symbols: [e.name + '__t'], assign: `${e.name}:=${e.gliderGiac}` });
    const answers = engine.withFree(free, () => entries.map((e) => (e.requests || []).map((request) => {
      if (request && request.live) return request;
      const answer = engine.cas.raw(request);
      return answer.error ? null : answer.value;
    })));
    const objects = [];
    entries.forEach((entry, index) => {
      if (entry.type === 'slider' || entry.type === 'checkbox' || entry.type === 'button') return;
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

  /** A point or vector in space from a Giac answer [x, y, z] */
  vectorFn(answer) {
    const tree = parse(answer);
    if (!tree || tree.t !== 'list' || tree.items.length !== 3) return null;
    const fns = tree.items.map((item) => compile(item, [], this.scope));
    return () => fns.map((f) => f());
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
        const object = { ...base, at, free: Boolean(entry.free) };
        if (entry.glider) {
          // Where the point would be for another t, to follow the finger along the object
          const tree = parse(answers[0]);
          const [fx, fy] = tree.items.map((item) => compile(item, [entry.name + '__t'], this.scope));
          object.glider = { mode: entry.glider.mode, atT: (t) => [fx(t), fy(t)] };
        }
        return object;
      }
      case 'points': {
        const tree = parse(answers[0]);
        if (!tree || tree.t !== 'list') return null;
        const list = tree.items.every((i) => i.t === 'list') ? tree.items : [tree];
        const fns = list.filter((i) => i.items.length === 2).map((i) => i.items.map((item) => compile(item, [], this.scope)));
        return { ...base, all: () => fns.map(([fx, fy]) => [fx(), fy()]) };
      }
      case 'arc':
      case 'sector':
      case 'angle': {
        const [A, B, C] = answers.map((a) => this.pointFn(a));
        return A && B && C ? { ...base, parts: [A, B, C] } : null;
      }
      case 'locus':
        return { ...base, pointName: entry.pointName, parameter: entry.parameter };
      case 'chart': {
        // Every argument as a function of the sliders: a number, or a (nested) list of numbers
        const valueFn = (tree) => {
          if (tree.t === 'list') {
            const items = tree.items.map(valueFn);
            return () => items.map((f) => f());
          }
          const f = compile(tree, [], this.scope);
          return () => f();
        };
        const functionSlots = new Map(entry.layout.filter((slot) => slot && typeof slot === 'object').map((slot) => [slot.fn, slot.vars]));
        const fns = answers.map((answer, i) => {
          const tree = parse(answer);
          if (!tree) return null;
          if (functionSlots.has(i)) {
            const slot = entry.layout.find((x) => x && typeof x === 'object' && x.fn === i);
            const f = slot.cond ? compileCondition(tree, slot.vars, this.scope) : compile(tree, slot.vars, this.scope);
            return () => f;
          }
          return valueFn(tree);
        });
        if (fns.some((f) => !f)) return null;
        return { ...base, command: entry.command, chart: entry.chart, seed: entry.seed, items: () => entry.layout.map((slot) => (typeof slot === 'string' ? slot : typeof slot === 'object' ? fns[slot.fn]() : fns[slot]())) };
      }
      case 'point3': {
        const at = this.vectorFn(answers[0]);
        return at ? { ...base, at } : null;
      }
      case 'line3':
      case 'segment3':
      case 'vector3': {
        const [a, b] = answers.map((x) => this.vectorFn(x));
        return a && b ? { ...base, a, b } : null;
      }
      case 'plane': {
        const n = this.vectorFn(answers[0]);
        const d = this.numberFn(answers[1]);
        return n && d ? { ...base, n, d } : null;
      }
      case 'sphere': {
        const center = this.vectorFn(answers[0]);
        const radius = this.numberFn(answers[1]);
        return center && radius ? { ...base, center, radius } : null;
      }
      case 'cylinder':
      case 'cone': {
        const a = this.vectorFn(answers[0]);
        const b = this.vectorFn(answers[1]);
        const radius = this.numberFn(answers[2]);
        return a && b && radius ? { ...base, a, b, radius } : null;
      }
      case 'solid': {
        const corners = answers.map((x) => this.vectorFn(x));
        return corners.every(Boolean) ? { ...base, corners, faces: entry.faces } : null;
      }
      case 'curve3': {
        const [X, Y, Z] = answers.slice(0, 3).map((x) => this.numberFn(x, [entry.variable]));
        const from = this.numberFn(answers[3]);
        const to = this.numberFn(answers[4]);
        return X && Y && Z && from && to ? { ...base, X, Y, Z, from, to } : null;
      }
      case 'psurface': {
        const [X, Y, Z] = answers.slice(0, 3).map((x) => this.numberFn(x, entry.variables));
        const [u0, u1, v0, v1] = answers.slice(3).map((x) => this.numberFn(x));
        return X && Y && Z && u0 && u1 && v0 && v1 ? { ...base, X, Y, Z, range: () => [u0(), u1(), v0(), v1()] } : null;
      }
      case 'surface': {
        const f = this.numberFn(answers[0], ['x', 'y']);
        return f ? { ...base, f } : null;
      }
      case 'isurface': {
        const tree = parse(answers[0]);
        if (!tree) return null;
        const F = compile(tree.t === 'rel' ? { t: 'op', op: '-', a: tree.a, b: tree.b } : tree, ['x', 'y', 'z'], this.scope);
        return { ...base, F };
      }
      case 'field': {
        const [P, Q, R] = answers.map((x) => this.numberFn(x, ['x', 'y', 'z']));
        return P && Q && R ? { ...base, P, Q, R } : null;
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
        const radius = this.numberFn(answers[1]);
        return center && radius ? { ...base, center, radius } : null;
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
  // knopf("Text"): a button, no object
  const knopf = (node) => node && node.t === 'call' && command(node.f)?.name === 'knopf';
  if (r && r.ok && (knopf(r.tree) || (r.definition && knopf(r.definition.body)))) {
    const call = knopf(r.tree) ? r.tree : r.definition.body;
    const label = call.args[0] && call.args[0].t === 'str' ? call.args[0].v : call.args[0] && call.args[0].t === 'sym' ? call.args[0].v : 'Knopf';
    return { row, type: 'button', label, name: r.definition ? r.definition.name : null, requests: [] };
  }
  // fläche(f, a, b), flächezwischen(f, g, a, b), integriere(f, x, a, b): the value in the CAS, the area shaded
  const areaCall = (node) => node && node.t === 'call' && AREA_COMMANDS[command(node.f)?.name] && !engine.defined.has(node.f) ? node : null;
  const area = r && r.ok && (areaCall(r.tree) || (r.definition && areaCall(r.definition.body)));
  if (area) {
    const roles = AREA_COMMANDS[command(area.f).name](area.args);
    if (roles) {
      const layout = [];
      const requests = [];
      area.args.forEach((arg, i) => {
        if (roles[i] === 'word') layout.push('x');
        else if (roles[i] === 'fn') {
          layout.push({ fn: requests.length, vars: ['x'] });
          requests.push(engine.giac(arg));
        } else {
          layout.push(requests.length);
          requests.push(engine.giac(arg));
        }
      });
      return { row, type: 'chart', command: command(area.f).name, chart: 'area', layout, seed: 0, requests, label: '', name: r.definition ? r.definition.name : null };
    }
  }
  if (r && r.ok && r.kind === 'analysis' && r.chart && r.tree) {
    // A chart: numbers and lists come from Giac with sliders left free, words (binomial, links …) stay as typed.
    const layout = [];
    const requests = [];
    const stat = STAT_COMMANDS[r.chart.command];
    const roles = stat && stat.roles ? stat.roles(r.tree.args) : [];
    r.tree.args.forEach((arg, i) => {
      const role = roles[i] || {};
      if (role.name && arg.t === 'sym') layout.push(arg.v);
      else if (role.cond) {
        layout.push({ fn: requests.length, vars: role.cond, cond: true });
        requests.push(engine.giac(arg));
      }
      else if (r.chart.words[i]) layout.push(r.chart.words[i]);
      else if (role.fn) {
        // A function of x (or x and y) that sliders may change: compiled, not evaluated
        layout.push({ fn: requests.length, vars: role.fn });
        requests.push(engine.giac(functionArg(arg)));
      } else if (role.complex) {
        layout.push(requests.length);
        const z = engine.giac(arg);
        requests.push(`[re(${z}),im(${z})]`);
      } else {
        layout.push(requests.length);
        requests.push(engine.giac(arg));
      }
    });
    return { row, type: 'chart', command: r.chart.command, chart: r.chart.kind, layout, seed: r.seed, requests, label: '' };
  }
  if (!r || !r.ok || r.kind === 'analysis') return null;
  const giac = (node) => engine.giac(node);

  /** An object made by a command: its shape tells what to draw. */
  const shaped = (name, node, extra = {}) => {
    const shape = engine.geometry.shape(node);
    // volumen(K), normalenform(E): a number or another form of an object drawn elsewhere
    if (!shape || shape.measure || shape.form) return null;
    switch (shape.kind) {
      case 'restricted': {
        const [body, from, to] = shape.parts;
        return { row, name, type: 'function', restricted: true, requests: [body, `diff(${body},x)`, `diff(${body},x,2)`, from, to], ...extra };
      }
      case 'locus':
        return { row, name, type: 'locus', pointName: shape.point, parameter: shape.parameter, requests: [], ...extra };
      case 'curve':
      case 'polar':
      case 'curve3':
        return { row, name, type: shape.kind, variable: shape.variable, requests: shape.parts, ...extra };
      case 'psurface':
        return { row, name, type: 'psurface', variables: shape.variables, requests: shape.parts, ...extra };
      case 'solid':
        return { row, name, type: 'solid', faces: shape.faces, requests: shape.parts, ...extra };
      case 'plane':
        if (shape.measure) return null;
        return { row, name, type: 'plane', requests: shape.parts, ...extra };
      default:
        return { row, name, type: shape.kind, requests: shape.parts, ...extra };
    }
  };

  /** z = f(x, y) is a graph over the plane; other equations with z are planes, spheres or implicit surfaces. */
  const zEquation = (name, node) => {
    const zOnly = (n) => n.t === 'sym' && n.v === 'z';
    if (zOnly(node.a) && !usesZ(node.b)) return { row, name, type: 'surface', requests: [giac(node.b)] };
    if (zOnly(node.b) && !usesZ(node.a)) return { row, name, type: 'surface', requests: [giac(node.a)] };
    return shaped(name, node);
  };

  if (r.kind === 'definition' && r.definition) {
    const d = r.definition;
    if (d.kind === 'function') {
      // Programs run for numbers; they have no formula to draw.
      if (d.program) return null;
      if (d.params.length === 2) {
        const call = `${d.name}(x,y)`;
        return { row, name: d.name, label: d.name, type: 'surface', requests: [call] };
      }
      if (d.params.length !== 1) return null;
      const call = `${d.name}(x)`;
      return { row, name: d.name, label: d.name, type: 'function', requests: [call, `diff(${call},x)`, `diff(${call},x,2)`] };
    }
    const body = d.body;
    if (d.kind === 'point' && body.t === 'list' && body.items.length === 3) return { row, name: d.name, type: 'point3', requests: [d.name] };
    if (d.kind === 'point' && body.t === 'list') {
      const coordinates = body.items.map(numberOf);
      const free = body.items.length === 2 && coordinates.every((c) => c !== null);
      return { row, name: d.name, type: 'point', free, coordinates, requests: [d.name] };
    }
    if (isGlider(body)) {
      // A point on an object: its place t is the number in the row; while Giac works, t is the unknown P__t.
      const t = body.args[1] ? numberOf(body.args[1]) : 0;
      if (t === null) return shaped(d.name, body);
      const shape = engine.geometry.shape(body, { parameter: d.name + '__t' });
      return { row, name: d.name, type: 'point', glider: shape.glider, t, object: engine.giac(body.args[0]), gliderGiac: shape.parts[0], requests: [d.name] };
    }
    const value = numberOf(body);
    if (value !== null) return { row, name: d.name, type: 'slider', value };
    const truth = booleanOf(body);
    if (truth !== null) return { row, name: d.name, type: 'checkbox', value: truth };
    if (isShapeCall(body)) return shaped(d.name, body);
    if (body.t === 'rel' && usesZ(body)) return zEquation(d.name, body);
    return null;
  }

  const tree = r.tree;
  if (!tree) return null;
  if (tree.t === 'list' && tree.point) return { row, type: tree.items.length === 3 ? 'point3' : 'point', requests: [giac(tree)], label: '' };
  if (tree.t === 'rel' && tree.op === '=' && usesZ(tree)) return zEquation(null, tree);
  if (isShapeCall(tree)) return shaped(null, tree);
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

function usesZ(node) {
  if (!node) return false;
  if (node.t === 'sym') return node.v === 'z';
  return ['a', 'b'].some((k) => usesZ(node[k])) || (node.args || []).some(usesZ) || (node.items || []).some(usesZ);
}

/** Objects that belong in the 3D view */
export const SPACE_TYPES = new Set(['point3', 'line3', 'segment3', 'vector3', 'plane', 'sphere', 'solid', 'cylinder', 'cone', 'curve3', 'psurface', 'isurface', 'surface', 'field']);

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
