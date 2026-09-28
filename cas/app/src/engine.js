// Between the calculator's input and Giac: reads LaTeX or text, turns German commands into Giac, keeps track of what
// the student defined, and returns every answer as school-style LaTeX.

import { parseLatex, parsePlain, toGiac, toLatex, ParseError, MATH_FUNCTIONS, latexNumber } from './expr.js';
import { command, giacCall, COMMAND_NAMES } from './commands.js';
import { analyse, ANALYSIS_COMMANDS } from './analysis.js';

/** Letters that stay unknowns: "x = 3" is an equation, not a definition. */
const UNKNOWNS = new Set(['x', 'y', 'z', 't', 'n', 'k', 's']);
const CONSTANTS = new Set(['pi', 'e', 'i', 'inf', 'unendlich', 'infinity']);

const GIAC_NAMES = { log: 'log10', lg: 'log10', nthroot: 'surd', unendlich: 'inf' };

export class Engine {
  constructor(cas) {
    this.cas = cas;
    /** name → { kind: 'function' | 'variable', params, giac } in the order they were made */
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
    if (def) return def.kind === 'function';
    return !UNKNOWNS.has(name) && !CONSTANTS.has(name) && /^[A-Za-z][A-Za-z0-9_]{0,3}$/.test(name);
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

    const definition = this.definitionOf(tree);
    const giac = definition ? definition.giac : this.giac(tree);
    const answer = this.cas.evaluate(giac);
    if (!answer.ok) return { ok: false, error: answer.error, giac };

    if (definition) {
      this.defined.delete(definition.name);
      this.defined.set(definition.name, { kind: definition.kind, params: definition.params, input: inputText(input) });
      const body = definition.kind === 'function' ? functionBody(answer.exact) : answer.exact;
      const head = definition.kind === 'function' ? toLatex(parsePlain(`${definition.name}(${definition.params.join(',')})`)) : latexName(definition.name);
      return {
        ok: true,
        kind: 'definition',
        assigns: definition.name,
        latex: head + (definition.kind === 'function' && /[{};]/.test(definition.body) ? '\\text{ ist als Programm definiert}' : '=' + this.format(body)),
        approxLatex: definition.kind === 'variable' ? this.approx(answer) : null,
        giac,
      };
    }

    const solving = /^\s*(solve|csolve|linsolve)\(/.test(giac);
    if (solving) return { ok: true, kind: 'solutions', latex: this.solutions(answer.exact, false), approxLatex: this.solutionsApprox(answer), giac };
    if (answer.exact === 'true' || answer.exact === 'false') {
      return { ok: true, kind: 'boolean', latex: answer.exact === 'true' ? '\\text{wahr}' : '\\text{falsch}', giac };
    }
    return { ok: true, kind: 'value', latex: this.format(answer.exact), approxLatex: this.approx(answer), giac };
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
    if (tree.t !== 'rel' || (tree.op !== '=' && tree.op !== ':=')) return null;
    const left = tree.a;
    if (left.t === 'call' && !left.prime && !command(left.f) && !MATH_FUNCTIONS.has(left.f) && left.args.length && left.args.every((a) => a.t === 'sym')) {
      const params = left.args.map((a) => a.v);
      const body = this.giac(tree.b);
      return { kind: 'function', name: left.f, params, body, giac: `${left.f}(${params.join(',')}):=${body}` };
    }
    if (left.t === 'sym' && !UNKNOWNS.has(left.v) && !CONSTANTS.has(left.v) && !command(left.v)) {
      const body = this.giac(tree.b);
      // a = a + 1 is an equation in a
      if (new RegExp(`(^|[^A-Za-z0-9_])${left.v}([^A-Za-z0-9_(]|$)`).test(body)) return null;
      return { kind: 'variable', name: left.v, body, giac: `${left.v}:=${body}` };
    }
    return null;
  }

  /** Giac's answer as LaTeX; text that is no formula shows as text. */
  format(exact, digits) {
    const text = String(exact);
    const unit = /^(.*)_\(([^()]*)\)$/.exec(text) || /^(.*?)_([A-Za-zΩµ]+)$/.exec(text);
    try {
      if (unit) return this.format(unit[1], digits) + '\\,' + unitLatex(unit[2]);
      return toLatex(parsePlain(text.replace(/\blist\[/g, '[').replace(/\bmatrix\[/g, '[')), { digits });
    } catch (e) {
      return '\\text{' + text.replace(/[\\{}]/g, '') + '}';
    }
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
