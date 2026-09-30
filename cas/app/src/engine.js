// Between the calculator's input and Giac: reads LaTeX or text, turns German commands into Giac, keeps track of what
// the student defined, and returns every answer as school-style LaTeX.

import { parseLatex, parsePlain, toGiac, toLatex, ParseError, MATH_FUNCTIONS, latexNumber, compile } from './expr.js';
import { command, giacCall, COMMAND_NAMES } from './commands.js';
import { runChemistry, substituteChemistry } from './chem/commands.js';
import { analyse, ANALYSIS_COMMANDS } from './analysis.js';
import { Geometry, isShapeCall, isMeasureCall } from './geometry.js';
import { STAT_COMMANDS, isWord, functionArg } from './statcommands.js';
import './extras.js';
import { newSeed } from './stats.js';
import { isProgram, translateProgram, mapCommandCalls } from './program.js';
import { blockedCategories, examResult } from './exam.js';
import { naturalToCommand, latexInText } from './natural.js';

/** Letters that stay unknowns: "x = 3" is an equation, not a definition. */
const UNKNOWNS = new Set(['x', 'y', 'z', 't', 'n', 'k', 's']);
const CONSTANTS = new Set(['pi', 'e', 'i', 'inf', 'unendlich', 'infinity', 'wahr', 'falsch', 'true', 'false']);

const GIAC_NAMES = { log: 'log10', lg: 'log10', nthroot: 'surd', unendlich: 'inf', wahr: 'true', falsch: 'false' };

export class Engine {
  constructor(cas) {
    this.cas = cas;
    /** name → { kind: 'function' | 'variable' | 'point', params, giac, input } in the order they were made */
    this.defined = new Map();
    this.geometry = new Geometry(this);
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
        const stat = STAT_COMMANDS[command(n.f).name];
        if (stat) {
          // Worked out in JavaScript; only commands with a plain value can stand inside other terms.
          const result = stat.run(this.statContext(), n.args, newSeed(), command(n.f).name);
          if (result.giac === undefined) throw new Error(`${command(n.f).name}(…) ergibt eine Tabelle und kann nicht weiterverrechnet werden.`);
          return { t: 'raw', v: '(' + result.giac + ')' };
        }
        if (isShapeCall(n) || isMeasureCall(n) || this.geometry.space.isSpaceCall(n)) return { t: 'raw', v: this.geometry.value(n) };
        const args = n.args.map((a) => this.giac(a));
        return { t: 'raw', v: giacCall(n.f, args) };
      }
      if (n.t === 'sym' && GIAC_NAMES[n.v]) return { ...n, v: GIAC_NAMES[n.v] };
      // A_1 from the formula editor is the cell A1 when the table has it
      if (n.t === 'sym' && this.sheet && /^[A-Z]_\d+$/.test(n.v) && this.sheet.assigned.has(n.v.replace('_', ''))) return { ...n, v: n.v.replace('_', '') };
      const copy = { ...n };
      for (const key of ['a', 'b', 'inner', 'body']) if (copy[key]) copy[key] = transform(copy[key]);
      for (const key of ['args', 'items']) if (copy[key]) copy[key] = copy[key].map(transform);
      return copy;
    };
    return toGiacRaw(transform(node), rename);
  }

  /**
   * Runs `fn` while the things that move are unknowns: sliders (a), free points (A becomes [A__x, A__y]) and points
   * on objects (P on its object at P__t). Every definition is made again around them, so what `fn` asks Giac comes
   * back as a formula in a, A__x, P__t … Afterwards everything is as before.
   * `free`: [{ name, symbols: [unknowns], assign: Giac text that stands in for the definition or null }]
   */
  withFree(free, fn) {
    if (!free.length) return fn();
    const byName = new Map(free.map((f) => [f.name, f]));
    const defs = [...this.defined.entries()];
    const purge = (name) => this.cas.raw(`purge(${name})`);
    for (const f of free) {
      purge(f.name);
      for (const symbol of f.symbols || []) purge(symbol);
    }
    for (const [name, def] of defs) {
      const f = byName.get(name);
      if (f) {
        if (f.assign) this.cas.raw(f.assign);
      } else if (def.giac) this.cas.evaluate(def.giac);
    }
    try {
      return fn();
    } finally {
      for (const f of free) for (const symbol of f.symbols || []) purge(symbol);
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
  /** Evaluates one input under the exam rules when an exam is running (see exam.js). */
  evaluate(input) {
    if (!this.exam) return this.evaluateFree(input);
    const blocked = blockedCategories(this.exam);
    if (input.text !== undefined && isProgram(input.text) && blocked.has('Programme')) return { ok: false, error: 'Programme sind in dieser Prüfung gesperrt.' };
    try {
      const tree = input.text !== undefined && isProgram(input.text) ? null : this.parse(input);
      const hit = tree && this.findCommand(tree, (c) => blocked.has(c.cat));
      if (hit) return { ok: false, error: `${hit.name}(…) ist in dieser Prüfung gesperrt.` };
    } catch (e) {
      // the input is not readable; evaluateFree says so
    }
    const result = this.evaluateFree(input);
    return examResult(this.exam, result, result.ok && hasVariables(result.latex));
  }

  findCommand(node, test) {
    if (!node || typeof node !== 'object') return null;
    if (node.t === 'call' && !this.defined.has(node.f)) {
      const c = command(node.f);
      if (c && test(c)) return c;
    }
    for (const key of ['a', 'b', 'inner', 'body']) {
      const found = this.findCommand(node[key], test);
      if (found) return found;
    }
    for (const key of ['args', 'items']) for (const n of node[key] || []) {
      const found = this.findCommand(n, test);
      if (found) return found;
    }
    return null;
  }

  evaluateFree(input) {
    if (input.text !== undefined && isProgram(input.text)) return this.program(input);
    // Chemistry first: molmasse(H2SO4), pH(HCl; 0,01 mol/L), Fe + O2 -> Fe2O3 … (see chem/commands.js)
    const chemistry = runChemistry(input, this.defined);
    if (chemistry) return chemistry;
    // Chemistry inside a calculation: 2*M(NaCl) becomes 2*(58.44…)
    if (!input.chemSubstituted && (input.text !== undefined || input.latex !== undefined)) {
      const substituted = substituteChemistry(input.text !== undefined ? input.text : { latex: input.latex }, this.defined);
      if (substituted) {
        const result = this.evaluateFree({ text: substituted.text, chemSubstituted: true });
        return result.ok ? { ...result, understood: substituted.text, chemParts: substituted.parts } : result;
      }
    }
    // LaTeX or plain German in a text row
    if (input.text !== undefined) {
      const latex = latexInText(input.text);
      if (latex) return this.evaluateFree({ latex });
      const natural = naturalToCommand(input.text);
      if (natural && natural !== input.text) {
        const result = this.evaluateFree({ text: natural });
        return result.ok ? { ...result, understood: natural } : result;
      }
    }
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

    // Statistics that answer with a table (and charts that draw too)
    const stat = tree.t === 'call' && !tree.prime && !this.defined.has(tree.f) && STAT_COMMANDS[command(tree.f)?.name];
    if (stat) {
      const name = command(tree.f).name;
      const seed = newSeed();
      let result;
      try {
        result = stat.run(this.statContext(), tree.args, seed, name);
      } catch (e) {
        return { ok: false, error: e.message || 'Das konnte nicht berechnet werden.' };
      }
      if (result.giac === undefined) {
        const chart = stat.chart ? { command: name, kind: stat.chart, words: tree.args.map((a) => (isWord(a) ? (a.t === 'str' ? a.v : a.v).toLowerCase() : null)) } : null;
        return { ok: true, kind: 'analysis', title: result.title, rows: result.rows || [], table: result.table || null, chart, seed, tree };
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
    // A program that printed something: the lines come with the result
    const printed = this.usesProgram(tree) ? this.printed(giac) : null;

    if (definition) {
      this.defined.delete(definition.name);
      this.defined.set(definition.name, { kind: definition.kind, params: definition.params, input: inputText(input), giac });
      const body = definition.kind === 'function' ? functionBody(answer.exact) : answer.exact;
      const head = definition.kind === 'function' ? toLatex(parsePlain(`${definition.name}(${definition.params.join(',')})`)) : latexName(definition.name);
      const body0 = definition.bodyTree;
      const columns = body0 && body0.t === 'call' && ['vektor', 'kurve'].includes(command(body0.f)?.name);
      // g: y = 2x + 1 — an object whose value is an equation gets a colon, as in school books
      const equation = definition.kind === 'variable' && /[^<>!:]=[^=]/.test(String(body));
      const kind = this.shapeKind(body0);
      let shown = definition.kind === 'point' ? this.formatPoint(body) : (equation ? '\\colon\\ ' : '=') + (columns ? this.formatVector(body) : this.format(body));
      if (kind === 'points') shown = '=' + this.formatPoints(body);
      if (kind === 'angle' || this.isSpaceAngle(body0)) shown += '^{\\circ}';
      const space = this.formatSpace(body0, body);
      if (space) shown = (space.startsWith('\\vec') || /[^<>!:]=/.test(space) ? '\\colon\\ ' : '=') + space;
      return {
        ok: true,
        kind: 'definition',
        assigns: definition.name,
        definition: { name: definition.name, kind: definition.kind, params: definition.params || [], body: definition.bodyTree },
        tree,
        latex: head + (definition.kind === 'function' && /[{};]/.test(definition.body) ? '\\text{ ist als Programm definiert}' : shown),
        approxLatex: kind === 'points' ? null : definition.kind === 'variable' ? ((v) => (v && kind === 'angle' ? v + '^{\\circ}' : v))(this.approx(answer)) : definition.kind === 'point' ? this.approxPoint(answer) : null,
        giac,
      };
    }
    const kind = tree.t === 'list' && tree.point ? 'point' : this.shapeKind(tree);
    const space = this.formatSpace(tree, answer.exact);
    if (space) return { ok: true, kind: 'value', tree, latex: space, approxLatex: null, giac };
    if (this.isSpaceAngle(tree)) {
      const approx = this.approx(answer);
      // An angle that is no nice number reads better as its decimal value.
      if (approx && /a(cos|sin|tan)/.test(answer.exact)) return { ok: true, kind: 'value', tree, latex: '\\approx ' + approx + '^{\\circ}', approxLatex: null, giac };
      return { ok: true, kind: 'value', tree, latex: this.format(answer.exact) + '^{\\circ}', approxLatex: approx ? approx + '^{\\circ}' : null, giac };
    }
    if (kind === 'point' || kind === 'point3') return { ok: true, kind: 'value', tree, latex: this.formatPoint(answer.exact), approxLatex: this.approxPoint(answer), giac };
    if (kind === 'points') return { ok: true, kind: 'value', tree, latex: this.formatPoints(answer.exact), approxLatex: null, giac };
    if (kind === 'angle') {
      const approx = this.approx(answer);
      return { ok: true, kind: 'value', tree, latex: this.format(answer.exact) + '^{\\circ}', approxLatex: approx ? approx + '^{\\circ}' : null, giac };
    }

    const solving = /^[\s(]*(solve|csolve|linsolve)\(/.test(giac);
    if (solving) return { ok: true, kind: 'solutions', tree, latex: this.solutions(answer.exact, false), approxLatex: this.solutionsApprox(answer), giac, verified: this.verify(tree, answer.exact) };
    if (answer.exact === 'true' || answer.exact === 'false') {
      return { ok: true, kind: 'boolean', tree, latex: answer.exact === 'true' ? '\\text{wahr}' : '\\text{falsch}', giac };
    }
    if (tree.t === 'call' && ['vektor', 'kurve'].includes(command(tree.f)?.name)) {
      return { ok: true, kind: 'value', tree, latex: this.formatVector(answer.exact), approxLatex: null, giac };
    }
    return { ok: true, kind: 'value', tree, latex: this.format(answer.exact), approxLatex: this.approx(answer), giac, printed };
  }

  /**
   * The check („Probe“) of an equation's solutions: each put back in. true when all fit, false when one does not,
   * null when there is nothing to check (systems, inequalities, no solution).
   */
  verify(tree, exact) {
    if (!tree || tree.t !== 'call' || tree.args.length < 1) return null;
    const eq = tree.args[0];
    if (!eq || eq.t !== 'rel' || eq.op !== '=') return null;
    const v = tree.args[1] && tree.args[1].t === 'sym' ? tree.args[1].v : 'x';
    let list;
    try {
      list = parsePlain(String(exact).replace(/\blist\[/g, '['));
    } catch (e) {
      return null;
    }
    if (list.t !== 'list' || !list.items.length || list.items.some((i) => i.t === 'list' || i.t === 'rel')) return null;
    const difference = `(${this.giac(eq.a)})-(${this.giac(eq.b)})`;
    for (const item of list.items) {
      const value = toGiac(item);
      const check = this.cas.raw(`simplify(subst(${difference},${v}=(${value})))`);
      if (check.error) return null;
      if (check.value === '0') continue;
      const approx = this.cas.raw(`evalf(abs(subst(${difference},${v}=(${value}))))`);
      if (approx.error || !(Number(approx.value) < 1e-9)) return false;
    }
    return true;
  }

  usesProgram(tree) {
    let found = false;
    const walk = (n) => {
      if (!n || typeof n !== 'object' || found) return;
      if (n.t === 'call' && this.defined.get(n.f)?.program) found = true;
      for (const key of ['a', 'b', 'inner', 'body']) if (n[key]) walk(n[key]);
      for (const key of ['args', 'items']) if (n[key]) n[key].forEach(walk);
    };
    walk(tree);
    return found;
  }

  /** What `ausgabe` printed while running the call again */
  printed(giac) {
    const run = this.cas.exec(giac);
    const lines = (run.output || []).map((l) => String(l).trim()).filter((l) => l && !/^(Evaluation time|Warning|\/\/ )/i.test(l));
    return lines.length ? lines.slice(0, 50).map((l) => this.format(l)) : null;
  }

  /** Giac text with the German commands inside translated, for programs */
  mapCalls(text) {
    return mapCommandCalls(text, (name, args) => {
      const found = command(name);
      if (!found || this.defined.has(name) || STAT_COMMANDS[found.name] || found.graphic) return null;
      return giacCall(name, args);
    });
  }

  /** A program in German blocks or Giac braces: defined in Giac, remembered like a function */
  program(input) {
    let translated;
    try {
      translated = translateProgram(input.text, (t) => this.mapCalls(t));
    } catch (e) {
      return { ok: false, error: e.message };
    }
    const { name, params, giac } = translated;
    if (command(name) || MATH_FUNCTIONS.has(name)) return { ok: false, error: `„${name}“ ist schon ein Befehl; bitte einen anderen Namen wählen.` };
    const answer = this.cas.exec(giac);
    if (answer.error) return { ok: false, error: answer.error, giac };
    this.defined.delete(name);
    this.defined.set(name, { kind: 'function', params, input: inputText(input), giac, program: true });
    const head = toLatex(parsePlain(`${name}(${params.join(',') || 'x'})`)).replace(/\\left\(x\\right\)$/, params.length ? '$&' : '\\left(\\right)');
    return {
      ok: true,
      kind: 'definition',
      assigns: name,
      definition: { name, kind: 'function', params, body: null, program: true },
      latex: head + '\\text{ ist als Programm definiert}',
      giac,
    };
  }

  /** What the statistics commands read their arguments with */
  statContext() {
    const numbers = (text) => {
      const answer = this.cas.raw(`evalf(${text})`);
      if (answer.error) throw new Error(answer.error);
      const body = String(answer.value).replace(/\b(list|matrix)\[/g, '[').replace(/\s+/g, '');
      let value;
      try {
        value = JSON.parse(body);
      } catch (e) {
        throw new Error(`„${text}“ ist keine Zahl und keine Liste von Zahlen.`);
      }
      const ok = (v) => (Array.isArray(v) ? v.every(ok) : typeof v === 'number' && Number.isFinite(v));
      if (!ok(value)) throw new Error(`„${text}“ enthält etwas anderes als Zahlen.`);
      return value;
    };
    return {
      // Cells of the spreadsheet that hold a value (see table.js)
      cells: this.sheet ? this.sheet.assigned : null,
      values: (node) => numbers(this.giac(node)),
      giac: (node) => this.giac(node),
      format: (text) => this.format(text),
      number: (text) => {
        try {
          const v = numbers(text);
          return typeof v === 'number' ? v : NaN;
        } catch (e) {
          return NaN;
        }
      },
      exact: (text) => {
        const answer = this.cas.raw(`simplify(${text})`);
        return answer.error ? null : this.format(answer.value);
      },
      function: (node, variables = ['x']) => {
        const answer = this.cas.raw(this.giac(functionArg(node)));
        if (answer.error) throw new Error(answer.error);
        return compile(parsePlain(String(answer.value)), variables, { value: () => undefined });
      },
      text: (node) => this.format(this.cas.raw(this.giac(functionArg(node))).value || ''),
      raw: (text) => {
        const answer = this.cas.raw(text);
        return answer.error ? null : String(answer.value);
      },
      giacOfTree: (tree) => toGiac(tree),
      solutions: (exact) => this.solutions(exact, false),
      functionOfGiac: (text, variables = ['x']) => {
        const answer = this.cas.raw(text);
        if (answer.error) throw new Error(answer.error);
        return compile(parsePlain(String(answer.value)), variables, { value: () => undefined });
      },
    };
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
      const bodyTree = tree.b.t === 'list' && tree.b.tuple && (tree.b.items.length === 2 || tree.b.items.length === 3) ? { t: 'list', items: tree.b.items, point: true } : tree.b;
      const body = this.giac(bodyTree);
      // a = a + 1 is an equation in a
      if (new RegExp(`(^|[^A-Za-z0-9_])${left.v}([^A-Za-z0-9_(]|$)`).test(body)) return null;
      let kind = bodyTree.t === 'list' && bodyTree.point ? 'point' : 'variable';
      if (kind === 'variable' && isShapeCall(bodyTree)) {
        const shape = this.geometry.shape(bodyTree);
        if (shape && (shape.kind === 'point' || shape.kind === 'point3')) kind = 'point';
      }
      return { kind, name: left.v, body, bodyTree, giac: `${left.v}:=${body}` };
    }
    return null;
  }

  /** Giac's answer as LaTeX; text that is no formula shows as text. */
  format(exact, digits) {
    const text = String(exact).replace(/^"+|"+$/g, (q) => (String(exact).length > 2 ? '' : q));
    if (/^"+[^"]*"+$/.test(String(exact))) return '\\text{' + text.replace(/[\\{}]/g, '') + '}';
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

  /** The kind of shape a command makes (point, points, line …), or null. */
  shapeKind(node) {
    if (!node || !isShapeCall(node)) return null;
    try {
      return this.geometry.shape(node)?.kind || null;
    } catch (e) {
      return null;
    }
  }

  isSpaceAngle(node) {
    return Boolean(node && node.t === 'call' && command(node.f)?.name === 'winkel' && node.args.length === 2 && this.geometry.space.isSpaceCall(node));
  }

  /** Lines in space in parametric form, planes in the form asked for; null for everything else. */
  formatSpace(node, exact) {
    if (!node || node.t !== 'call' || !this.geometry.space.isSpaceCall(node)) return null;
    let shape;
    try {
      shape = this.geometry.space.shape(node);
    } catch (e) {
      return null;
    }
    if (!shape) return null;
    const column = (text) => this.formatVector(this.cas.raw(`normal(${text})`).value);
    if (shape.kind === 'line3') {
      const [P, u] = shape.parts;
      return `\\vec{x}=${column(P)}+t\\cdot ${column(u)}`;
    }
    if (shape.kind === 'plane' && shape.form && shape.form !== 'koordinatenform') {
      const [n, d] = shape.parts;
      const raw = (text) => this.cas.raw(`normal(${text})`).value;
      // A point of the plane: on the axis of the largest usable coordinate
      const axis = [0, 1, 2].find((i) => raw(`(${n})[${i}]`) !== '0') ?? 2;
      const P = `[${[0, 1, 2].map((i) => (i === axis ? `(${d})/((${n})[${i}])` : '0')).join(',')}]`;
      if (shape.form === 'normalenform') return `\\left(\\vec{x}-${column(P)}\\right)\\cdot ${column(n)}=0`;
      if (shape.form === 'hessenormalform') {
        const length = this.format(raw(`sqrt(((${n})[0])^2+((${n})[1])^2+((${n})[2])^2)`));
        const lhs = this.format(raw(`((${n})[0])*x+((${n})[1])*y+((${n})[2])*z-(${d})`));
        return `\\frac{${lhs}}{${length}}=0`;
      }
      // Parameter form: two directions in the plane
      const e = ['[1,0,0]', '[0,1,0]', '[0,0,1]'];
      const directions = e.map((v) => `cross(${n},${v})`).filter((v) => raw(v).replace(/list/, '') !== '[0,0,0]');
      const [u, w] = directions;
      return `\\vec{x}=${column(P)}+r\\cdot ${column(u)}+s\\cdot ${column(w)}`;
    }
    return null;
  }

  /** A point as plain text for sentences: (1 | 2 | 3) */
  formatPointText(exact) {
    try {
      const tree = parsePlain(String(exact).replace(/^list\[/, '['));
      if (tree.t === 'list') return '(' + tree.items.map((i) => toGiac(i).replace(/\./g, ',')).join(' | ') + ')';
    } catch (e) {
      // not a point
    }
    return String(exact);
  }

  /** Several points, as intersections come: S₁(1 | 2), S₂(…) — or "keine" */
  formatPoints(exact) {
    let tree;
    try {
      tree = parsePlain(String(exact).replace(/\blist\[/g, '['));
    } catch (e) {
      return this.format(exact);
    }
    const items = tree.t === 'list' ? tree.items : [];
    const points = items.filter((item) => item.t === 'list' && item.items.length === 2);
    if (!points.length) return '\\text{keine Schnittpunkte}';
    const one = (p) => toLatex({ t: 'list', items: p.items, point: true });
    if (points.length === 1) return one(points[0]);
    return points.map((p, i) => `S_{${i + 1}}${one(p)}`).join(',\\ ');
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

/** Whether a LaTeX result still has letters that are variables (not commands, e, i, units or words) */
function hasVariables(latex) {
  const rest = String(latex || '')
    .replace(/\\(text|mathrm|operatorname)\{[^}]*\}/g, '')
    .replace(/\\[A-Za-z]+/g, '')
    .replace(/^L=/, '')
    .replace(/(^|[^A-Za-z])[ei](?![A-Za-z])/g, '$1');
  return /[A-Za-z]/.test(rest);
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
