// The standard result of every chemistry calculation: what was asked, the answer as a value with a unit, the working
// steps built from the numbers that were actually used, warnings, assumptions and sources. The UI shows every result
// the same way through `toRows`.

import { formatNumber, formatQuantity, unitLatex } from './format.js';
import { Quantity } from './quantity.js';
import { ChemError } from './errors.js';

/** A step line in both notations */
export const L = (latex, text) => ({ latex, text: text === undefined ? latex : text });

export class ChemicalResult {
  constructor(type, title) {
    this.type = type;
    this.title = title;
    this.ok = true;
    /** { value, unit, dimension } or { text } or { reaction } … */
    this.result = null;
    /** more named answers: { n: { value, unit }, … } */
    this.values = {};
    this.steps = [];
    this.warnings = [];
    this.assumptions = [];
    this.sources = [];
    /** { head: [...], rows: [[...]] } like the statistics tables */
    this.table = null;
    /** shapes for the graphics: { rects, lines, dots, wedges, areas, texts, bounds } */
    this.plot = null;
    /** buttons that continue with this result: [{ label, command }] */
    this.actions = [];
    /** what to show first when the result is a value */
    this.display = { sig: 4, decimals: null };
  }

  /** The answer: a Quantity or { text } */
  answer(quantity, extra = {}) {
    this.result = quantity instanceof Quantity ? { ...quantity.toJSON(), quantity } : { ...quantity };
    Object.assign(this.result, extra);
    return this;
  }

  value(name, quantity) {
    this.values[name] = quantity instanceof Quantity ? { ...quantity.toJSON(), quantity } : quantity;
    return this;
  }

  /** One step: `label` names it, `lines` are alternative writings that follow each other */
  step(label, ...lines) {
    this.steps.push({ label, lines: lines.map((l) => (typeof l === 'string' ? L(l) : l)) });
    return this;
  }

  warn(code, message) {
    this.warnings.push({ code, message });
    return this;
  }

  assume(text) {
    if (!this.assumptions.includes(text)) this.assumptions.push(text);
    return this;
  }

  source(text) {
    if (!this.sources.includes(text)) this.sources.push(text);
    return this;
  }

  toJSON() {
    const { type, ok, result, values, steps, warnings, assumptions, sources, table } = this;
    const plain = (r) => {
      if (!r) return r;
      const { quantity, ...rest } = r;
      return rest;
    };
    return { type, ok, result: plain(result), values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, plain(v)])), steps, warnings, assumptions, sources, table };
  }
}

/** The failure of a chemistry command as a result the UI can show */
export function errorResult(error) {
  const code = error instanceof ChemError ? error.code : 'CHEM_SYNTAX';
  return { ok: false, code, error: error.message };
}

/** "M(NaCl) = 58,44 g/mol" as LaTeX / text from parts */
export const qLatex = (value, unit, options) => formatQuantity(value, unit, { ...options, style: 'latex' });
export const qText = (value, unit, options) => formatQuantity(value, unit, { ...options, style: 'text' });

/** Rows for the CAS view: [{ label, latex }] built from the result */
export function toRows(result, { steps = true } = {}) {
  const rows = [];
  const main = result.result;
  if (main) {
    if (main.latex) rows.push({ label: 'Ergebnis', latex: main.latex });
    else if (main.text) rows.push({ label: 'Ergebnis', latex: `\\text{${escapeText(main.text)}}` });
    else if (main.value !== undefined) {
      const options = { ...result.display };
      rows.push({ label: 'Ergebnis', latex: qLatex(main.value, main.unit, options) });
    }
  }
  for (const [name, v] of Object.entries(result.values)) {
    if (v && v.value !== undefined) rows.push({ label: name, latex: qLatex(v.value, v.unit, { ...result.display, ...(v.display || {}) }) });
    else if (v && v.latex) rows.push({ label: name, latex: v.latex });
  }
  if (steps) for (const step of result.steps) {
    step.lines.forEach((line, i) => rows.push({ label: i === 0 ? step.label : '', latex: line.latex, step: true }));
  }
  for (const w of result.warnings) rows.push({ label: 'Achtung', latex: `\\text{${escapeText(w.message)}}`, warning: true });
  for (const a of result.assumptions) rows.push({ label: 'Annahme', latex: `\\text{${escapeText(a)}}` });
  if (result.sources.length) rows.push({ label: 'Quelle', latex: `\\text{${escapeText(result.sources.join('; '))}}` });
  return rows;
}

export function escapeText(text) {
  return String(text).replace(/[\\{}$&#^_%~]/g, (c) => '\\' + (c === '\\' ? 'textbackslash ' : c === '~' ? 'textasciitilde ' : c === '^' ? 'textasciicircum ' : c));
}

/** The result as plain text (for copying and for tests) */
export function toText(result) {
  const lines = [result.title || result.type];
  const main = result.result;
  if (main) lines.push(main.text ? main.text : `${formatNumber(main.value, result.display)}${main.unit ? ' ' + main.unit : ''}`);
  for (const step of result.steps) for (const line of step.lines) lines.push(line.text);
  for (const w of result.warnings) lines.push(`Achtung: ${w.message}`);
  return lines.join('\n');
}

export { unitLatex };
