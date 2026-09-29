// Between the calculator's input and Giac: reads LaTeX or text, turns German commands into Giac, keeps track of what
// the student defined, and returns every answer as school-style LaTeX.

import { parseLatex, parsePlain, toGiac, toLatex, ParseError, MATH_FUNCTIONS, latexNumber } from './expr.js';
import { command, giacCall, COMMAND_NAMES } from './commands.js';
import { analyse, ANALYSIS_COMMANDS } from './analysis.js';

/** Letters that stay unknowns: "x = 3" is an equation, not a definition. */
const UNKNOWNS = new Set(['x', 'y', 'z', 't', 'n', 'k', 's']);
const CONSTANTS = new Set(['pi', 'e', 'i', 'inf', 'unendlich', 'infinity', 'wahr', 'falsch', 'true', 'false']);

const GIAC_NAMES = { log: 'log10', lg: 'log10', nthroot: 'surd', unendlich: 'inf', wahr: 'true', falsch: 'false' };

export class Engine {
  constructor(cas) {
    this.cas = cas;
    /** name → { kind: 'function' | 'variable' | 'point', params, giac, input } in the order they were made */
    this.defined = new Map();
  }

  get names() {
    return [...COMMAND_NAMES, ...this.defined.keys(), ...MATH_FUNCTIONS, 'unendlich'];
  }

  /**
   * Whether name(…) is a call. Commands, maths functions and defined functions are; so is a short name that is
   * neither an unknown nor a defined value, so f(x) = … and a(n+1) = 2·a(n) read as functions while x(x+1) and
   * k(k-1) stay products.
   */
  isFunction(name) {
    if (command(name) || MATH_FUNCTIONS.has(name)) return true;
    const def = this.defined.get(name);
    if (def) return def.kind === 'function' || def.kind === 'point';
    return !UNKNOWNS.has(name) && !CONSTANTS.has(name) && /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
  }

  parse(input) {
    const options = { names: this.names, isFunction: (name) => this.isFunction(name) };
    if (input.text !== undefined) return parsePlain(input.text, options);
    return parseLatex(input.latex, options);
  }

  /** Giac text of a tree: German commands through the catalog, school names to Giac names. */
  giac(node) {
    const rename = (name) => GIAC_NAMES[name] || name;
    const transform = (n) => {
      if (!n || typeof n !== 'object') return n;
      if (n.t === 'call' && !n.prime && command(n.f) && !this.defined.has(n.f)) {
        const found = command(n.f);
        if (found.graphic) return { t: 'raw', v: this.graphicGiac(found.graphic, n.args) };
        const args = n.args.map((a) => this.giac(a));
        return { t: 'raw', v: giacCall(n.f, args) };
      }
      if (n.t === 'sym' && GIAC_NAMES[n.v]) return { ...n, v: GIAC_NAMES[n.v] };
      const copy = { ...n };
      for (const key of ['a', 'b', 'inner']) if (copy[key]) copy[key] = transform(copy[key]);
      for (const key of ['args', 'items']) if (copy[key]) copy[key] = copy[key].map(transform);
      return copy;
    };
    return toGiacRaw(transform(node), rename);
  }

  /**
   * The value of a graphics object as Giac text: a line's equation, a segment's length, a polygon's area. Points are
   * worked out first, so a vertical line becomes x = … instead of a division by zero.
   */
  graphicGiac(kind, args) {
    const value = (node) => {
      const answer = this.cas.raw(this.giac(node));
      if (answer.error) throw new Error(answer.error);
      return answer.value;
    };
    const point = (node) => {
      const text = value(node);
      let tree;
      try {
        tree = parsePlain(text.replace(/^list\[/, '['));
      } catch (e) {
        tree = null;
      }
      if (!tree || tree.t !== 'list' || tree.items.length !== 2) throw new Error('Hier wird ein Punkt erwartet, z. B. (1|2).');
      return tree.items.map((item) => '(' + toGiac(item) + ')');
    };
    const isZero = (text) => this.cas.raw(`normal(${text})`).value === '0';
    const need = (n) => {
      if (args.length < n) throw new Error('Hier fehlen Angaben.');
    };
    switch (kind) {
      case 'line':
      case 'ray': {
        need(2);
        const [p0, p1] = point(args[0]);
        let slope;
        const second = value(args[1]);
        if (/^(list)?\[/.test(second)) {
          const [q0, q1] = point(args[1]);
          if (isZero(`${q0}-${p0}`)) return `x=${p0}`;
          slope = `(${q1}-${p1})/(${q0}-${p0})`;
        } else {
          slope = `(${second})`;
        }
        return `y=normal(${slope}*(x-${p0})+${p1})`;
      }
      case 'segment': {
        need(2);
        const [p0, p1] = point(args[0]);
        const [q0, q1] = point(args[1]);
        return `normal(sqrt((${q0}-${p0})^2+(${q1}-${p1})^2))`;
      }
      case 'vector': {
        need(1);
        if (args.length === 1) {
          const [v0, v1] = point(args[0]);
          return `[${v0},${v1}]`;
        }
        const [p0, p1] = point(args[0]);
        const [q0, q1] = point(args[1]);
        return `[normal(${q0}-${p0}),normal(${q1}-${p1})]`;
      }
      case 'circle': {
        need(2);
        const [m0, m1] = point(args[0]);
        const second = value(args[1]);
        let square;
        if (/^(list)?\[/.test(second)) {
          const [q0, q1] = point(args[1]);
          square = `normal((${q0}-${m0})^2+(${q1}-${m1})^2)`;
        } else {
          square = `(${second})^2`;
        }
        const shift = (v, c) => (isZero(c) ? `${v}^2` : `(${v}-${c})^2`);
        return `${shift('x', m0)}+${shift('y', m1)}=${square}`;
      }
      case 'polygon': {
        need(3);
        const corners = args.map(point);
        const terms = corners.map(([a0, a1], k) => {
          const [b0, b1] = corners[(k + 1) % corners.length];
          return `${a0}*${b1}-${b0}*${a1}`;
        });
        return `normal(abs(${terms.join('+')})/2)`;
      }
      case 'curve':
        need(5);
        return `[${this.giac(args[0])},${this.giac(args[1])}]`;
      case 'polar':
        need(4);
        return this.giac(args[0]);
      case 'restricted':
        need(3);
        return this.giac(args[0]);
      default:
        throw new Error('Unbekanntes Grafikobjekt.');
    }
  }

  /**
   * Runs `fn` while the named values (slider parameters) are unknowns: every definition is made again without them,
   * so what `fn` asks Giac comes back in terms of a, b, … Afterwards everything is as before.
   */
  withFreeNames(names, fn) {
    if (!names.length) return fn();
    const defs = [...this.defined.entries()];
    for (const name of names) this.cas.raw(`purge(${name})`);
    for (const [name, def] of defs) if (!names.includes(name) && def.giac) this.cas.evaluate(def.giac);
    try {
      return fn();
    } finally {
      for (const [, def] of defs) if (def.giac) this.cas.evaluate(def.giac);
    }
  }

  /** Makes the definitions again after a restart, in their order. */
  restore(definitions) {
    for (const def of definitions || []) {
      try {
        this.evaluate(def.input);
      } catch (e) {
        // A definition that no longer works is dropped.
      }
    }
  }

  get definitions() {
    return [...this.defined.entries()].map(([name, def]) => ({ name, input: def.input, kind: def.kind }));
  }

  forget(name) {
    this.defined.delete(name);
    this.cas.raw(`purge(${name})`);
  }

  /**
   * Evaluates one input ({ latex } or { text }). Returns { ok, latex, approxLatex, kind, rows?, assigns?, error? };
   * `kind` is 'value', 'definition', 'solutions', 'analysis' or 'boolean'.
   */
  evaluate(input) {
    let tree;
    try {
      tree = this.parse(input);
    } catch (e) {
      return { ok: false, error: e instanceof ParseError ? e.message : 'Die Eingabe ist nicht lesbar.' };
    }

    // Analysis commands build their answer from several Giac calls.
    if (tree.t === 'call' && ANALYSIS_COMMANDS.has(command(tree.f)?.name) && !this.defined.has(tree.f)) {
      try {
        const target = tree.args[0] ? this.resolveFunction(tree.args[0]) : null;
        if (!target) return { ok: false, error: 'Bitte eine Funktion angeben, z. B. ' + command(tree.f).syntax };
        const result = analyse(this.cas, target, command(tree.f).name);
        return { ok: true, kind: 'analysis', ...result };
      } catch (e) {
        return { ok: false, error: e.message || 'Das konnte nicht untersucht werden.' };
      }
    }

    let definition;
    let giac;
    try {
      definition = this.definitionOf(tree);
      giac = definition ? definition.giac : this.giac(tree);
    } catch (e) {
      return { ok: false, error: e.message || 'Das konnte nicht berechnet werden.' };
    }
    const answer = this.cas.evaluate(giac);
    if (!answer.ok) return { ok: false, error: answer.error, giac };

    if (definition) {
      this.defined.delete(definition.name);
      this.defined.set(definition.name, { kind: definition.kind, params: definition.params, input: inputText(input), giac });
      const body = definition.kind === 'function' ? functionBody(answer.exact) : answer.exact;
      const head = definition.kind === 'function' ? toLatex(parsePlain(`${definition.name}(${definition.params.join(',')})`)) : latexName(definition.name);
      const body0 = definition.bodyTree;
      const columns = body0 && body0.t === 'call' && ['vektor', 'kurve'].includes(command(body0.f)?.name);
      // g: y = 2x + 1 — an object whose value is an equation gets a colon, as in school books
      const equation = definition.kind === 'variable' && /[^<>!:]=[^=]/.test(String(body));
      const shown = definition.kind === 'point' ? this.formatPoint(body) : (equation ? '\\colon\\ ' : '=') + (columns ? this.formatVector(body) : this.format(body));
      return {
        ok: true,
        kind: 'definition',
        assigns: definition.name,
        definition: { name: definition.name, kind: definition.kind, params: definition.params || [], body: definition.bodyTree },
        tree,
        latex: head + (definition.kind === 'function' && /[{};]/.test(definition.body) ? '\\text{ ist als Programm definiert}' : shown),
        approxLatex: definition.kind === 'variable' ? this.approx(answer) : definition.kind === 'point' ? this.approxPoint(answer) : null,
        giac,
      };
    }
    if (tree.t === 'list' && tree.point) {
      return { ok: true, kind: 'value', tree, latex: this.formatPoint(answer.exact), approxLatex: this.approxPoint(answer), giac };
    }

    const solving = /^\s*(solve|csolve|linsolve)\(/.test(giac);
    if (solving) return { ok: true, kind: 'solutions', tree, latex: this.solutions(answer.exact, false), approxLatex: this.solutionsApprox(answer), giac };
    if (answer.exact === 'true' || answer.exact === 'false') {
      return { ok: true, kind: 'boolean', tree, latex: answer.exact === 'true' ? '\\text{wahr}' : '\\text{falsch}', giac };
    }
    if (tree.t === 'call' && ['vektor', 'kurve'].includes(command(tree.f)?.name)) {
      return { ok: true, kind: 'value', tree, latex: this.formatVector(answer.exact), approxLatex: null, giac };
    }
    return { ok: true, kind: 'value', tree, latex: this.format(answer.exact), approxLatex: this.approx(answer), giac };
  }

  /** A function argument of an analysis command: f(x) itself, or the name of a defined function. */
  resolveFunction(node) {
    if (node.t === 'sym' && this.defined.get(node.v)?.kind === 'function') return `${node.v}(x)`;
    if (node.t === 'call' && this.defined.get(node.f)?.kind === 'function' && node.args.length === 1 && node.args[0].t === 'sym') {
      return `${node.f}(x)`;
    }
    return this.giac(node);
  }

  definitionOf(tree) {
    // A(1|2): a point written the school way
    if (tree.t === 'call' && !tree.prime && tree.args.length === 1 && tree.args[0].t === 'list' && tree.args[0].point
      && !command(tree.f) && !MATH_FUNCTIONS.has(tree.f) && this.defined.get(tree.f)?.kind !== 'function' && !UNKNOWNS.has(tree.f)) {
      const bodyTree = tree.args[0];
      return { kind: 'point', name: tree.f, bodyTree, body: this.giac(bodyTree), giac: `${tree.f}:=${this.giac(bodyTree)}` };
    }
    if (tree.t !== 'rel' || (tree.op !== '=' && tree.op !== ':=')) return null;
    const left = tree.a;
    if (left.t === 'call' && !left.prime && !command(left.f) && !MATH_FUNCTIONS.has(left.f) && left.args.length && left.args.every((a) => a.t === 'sym')) {
      const params = left.args.map((a) => a.v);
      const body = this.giac(tree.b);
      return { kind: 'function', name: left.f, params, body, bodyTree: tree.b, giac: `${left.f}(${params.join(',')}):=${body}` };
    }
    if (left.t === 'sym' && !UNKNOWNS.has(left.v) && !CONSTANTS.has(left.v) && !command(left.v)) {
      // A = (1, 2) is a point too
      const bodyTree = tree.b.t === 'list' && tree.b.tuple && tree.b.items.length === 2 ? { t: 'list', items: tree.b.items, point: true } : tree.b;
      const body = this.giac(bodyTree);
      // a = a + 1 is an equation in a
      if (new RegExp(`(^|[^A-Za-z0-9_])${left.v}([^A-Za-z0-9_(]|$)`).test(body)) return null;
      const kind = bodyTree.t === 'list' && bodyTree.point ? 'point' : 'variable';
      return { kind, name: left.v, body, bodyTree, giac: `${left.v}:=${body}` };
    }
    return null;
  }

  /** Giac's answer as LaTeX; text that is no formula shows as text. */
  format(exact, digits) {
    const text = String(exact);
    if (text === 'true' || text === 'false') return text === 'true' ? '\\text{wahr}' : '\\text{falsch}';
    const unit = /^(.*)_\(([^()]*)\)$/.exec(text) || /^(.*?)_([A-Za-zΩµ]+)$/.exec(text);
    try {
      if (unit) return this.format(unit[1], digits) + '\\,' + unitLatex(unit[2]);
      let tree = parsePlain(text.replace(/\blist\[/g, '[').replace(/\bmatrix\[/g, '['));
      // Giac writes y < x - 4 as x - 4 > y; school puts y first.
      const FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=' };
      if (tree.t === 'rel' && FLIP[tree.op] && tree.b.t === 'sym' && tree.b.v === 'y' && !/\by\b/.test(toGiac(tree.a))) {
        tree = { t: 'rel', op: FLIP[tree.op], a: tree.b, b: tree.a };
      }
      return toLatex(tree, { digits });
    } catch (e) {
      return '\\text{' + text.replace(/[\\{}]/g, '') + '}';
    }
  }

  /** [1, 2] as the point (1 | 2) */
  formatPoint(exact) {
    try {
      const tree = parsePlain(String(exact).replace(/^list\[/, '['));
      if (tree.t === 'list' && !tree.items.some((item) => item.t === 'list')) return toLatex({ ...tree, kind: undefined, point: true });
    } catch (e) {
      // not a point after all
    }
    return this.format(exact);
  }

  /** [1, 2] as a column vector */
  formatVector(exact) {
    try {
      const tree = parsePlain(String(exact).replace(/^list\[/, '['));
      if (tree.t === 'list' && !tree.items.some((item) => item.t === 'list')) return toLatex({ t: 'list', items: tree.items, vector: true });
    } catch (e) {
      // not a vector after all
    }
    return this.format(exact);
  }

  approxPoint(answer) {
    if (!answer.approx) return null;
    const latex = this.formatPoint(answer.approx);
    return latex === this.formatPoint(answer.exact) ? null : latex;
  }

  approx(answer) {
    if (!answer.approx) return null;
    const latex = this.format(answer.approx);
    return latex === this.format(answer.exact) ? null : latex;
  }

  /** L = {…} for equations, intervals for inequalities, tuples for systems. */
  solutions(exact, approximate) {
    const parts = this.cas.intervalParts(exact);
    if (parts) {
      if (!parts.length) return 'L=\\{\\}';
      return 'L=' + parts.map((p) => intervalLatex(p, (v) => this.format(v))).join('\\cup ');
    }
    const body = String(exact).replace(/^list\[/, '[');
    let tree;
    try {
      tree = parsePlain(body);
    } catch (e) {
      return this.format(exact);
    }
    const items = tree.t === 'list' ? tree.items : [tree];
    if (!items.length) return 'L=\\{\\}';
    const shown = items.map((item) => (item.t === 'list' ? '\\left(' + item.items.map((i) => toLatex(i)).join(';\\ ') + '\\right)' : toLatex(item)));
    return (approximate ? 'L\\approx' : 'L=') + '\\left\\{' + shown.join(';\\ ') + '\\right\\}';
  }

  solutionsApprox(answer) {
    if (!answer.approx || this.cas.intervalParts(answer.exact)) return null;
    const shown = this.solutions(answer.approx, true);
    return shown.replace('L\\approx', 'L=') === this.solutions(answer.exact, false) ? null : shown;
  }
}

function inputText(input) {
  return input.text !== undefined ? { text: input.text } : { latex: input.latex };
}

function functionBody(exact) {
  const match = /\)\s*=\s*(.*)$/.exec(String(exact));
  return match ? match[1] : exact;
}

function latexName(name) {
  return toLatex({ t: 'sym', v: name });
}

/** SI units as Giac writes them, m*s^-1.0 → \mathrm{m\cdot s^{-1}} */
function unitLatex(unit) {
  const parts = unit.split('*').map((part) => {
    const power = /^([A-Za-zΩµ0-9]+)\^\(?(-?\d+)(?:\.0+)?\)?$/.exec(part);
    if (!power) return part.replace(/\//g, '/');
    return power[1] + (power[2] === '1' ? '' : '^{' + power[2] + '}');
  });
  return '\\mathrm{' + parts.join('\\cdot ') + '}';
}

/** One part of an inequality's solution as an interval: ]-2; 2[, [1; ∞[ … */
export function intervalLatex(part, format) {
  const open = (closed) => (closed ? '\\left[' : '\\left]');
  const close = (closed) => (closed ? '\\right]' : '\\right[');
  switch (part.kind) {
    case 'range':
      return open(part.lowClosed) + format(part.low) + ';\\ ' + format(part.high) + close(part.highClosed);
    case 'point':
      return '\\left\\{' + format(part.value) + '\\right\\}';
    case 'above':
      return open(part.closed) + format(part.value) + ';\\ \\infty\\right[';
    default:
      return '\\left]-\\infty;\\ ' + format(part.value) + close(part.closed);
  }
}

/** Like toGiac, but passes pre-translated command calls ({ t: 'raw' }) through. */
function toGiacRaw(node, rename) {
  if (node.t === 'raw') return node.v;
  const replaced = JSON.parse(JSON.stringify(node, (key, value) => (value && value.t === 'raw' ? { t: 'sym', v: '\u0000' + value.v } : value)));
  return toGiac(replaced, rename).replace(/\u0000/g, '');
}

export { latexNumber };
