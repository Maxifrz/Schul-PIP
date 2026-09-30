// A chemical quantity: a value with its unit and dimension, and optionally the substance it belongs to, temperature,
// pressure, phase, an uncertainty, significant digits and a source. Arithmetic checks dimensions, so an amount cannot
// be added to a mass.

import { parseUnit, toSI, fromSI, dimensionName, convert, sameDimension, DIM, isUnit } from './units.js';
import { fail } from './errors.js';
import { sigFigsOf } from './format.js';

const NUMBER = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:\s*(?:[eE]|[·×x*]\s*10\^?)\s*[+-]?\d+)?/;

/** Reads "0,25", "1.5e-3", "1,8·10^-5" */
export function parseNumber(text) {
  const m = NUMBER.exec(String(text).trim());
  if (!m || m[0].length !== String(text).trim().length) return null;
  const raw = m[0].replace(/\s+/g, '');
  const sci = /^(.*?)(?:[eE]|[·×x*]10\^?)([+-]?\d+)$/.exec(raw);
  if (sci) return Number(sci[1].replace(',', '.') + 'e' + sci[2]);
  return Number(raw.replace(',', '.'));
}

export class Quantity {
  /**
   * @param value the number in `unit`
   * @param unit  "mol", "g/mol", "°C" …
   * @param extra { substance, temperature (K), pressure (Pa), phase, uncertainty, sigFigs, source }
   */
  constructor(value, unit, extra = {}) {
    if (!Number.isFinite(value)) fail('CHEM_NO_SOLUTION', 'Der Wert ist keine Zahl.');
    this.value = value;
    this.unit = unit || '';
    this.parsed = unit ? parseUnit(unit) : { factor: 1, dim: DIM.none, text: '' };
    Object.assign(this, extra);
  }

  get dim() {
    return this.parsed.dim;
  }

  get dimension() {
    return dimensionName(this.dim);
  }

  /** Value in SI base units */
  get si() {
    return toSI(this.value, this.parsed);
  }

  /** The same quantity in another unit of the same dimension */
  to(unit) {
    return new Quantity(convert(this.value, this.unit, unit), unit, this.meta());
  }

  meta() {
    const { substance, temperature, pressure, phase, uncertainty, sigFigs, source } = this;
    return { substance, temperature, pressure, phase, uncertainty, sigFigs, source };
  }

  /** In the SI base unit of its dimension (kg, m³, mol, mol/m³ …) as a number */
  is(dimensionKey) {
    return sameDimension(this, { dim: DIM[dimensionKey] });
  }

  need(dimensionKey, what = 'Größe') {
    if (!this.is(dimensionKey)) fail('CHEM_UNIT_MISMATCH', `Für ${what} wird eine Größe der Art „${dimensionKey}“ erwartet, „${this.value} ${this.unit}“ ist „${this.dimension}“.`, { expected: dimensionKey, got: this.dimension });
    return this;
  }

  /** The number in a unit of the given dimension: q.in('mol') */
  in(unit) {
    return convert(this.value, this.unit, unit);
  }

  scaled(factor, sigFigs) {
    return new Quantity(this.value * factor, this.unit, { ...this.meta(), sigFigs: sigFigs === undefined ? this.sigFigs : sigFigs });
  }

  toJSON() {
    const out = { value: this.value, unit: this.unit, dimension: this.dimension };
    for (const key of ['substance', 'temperature', 'pressure', 'phase', 'uncertainty', 'sigFigs', 'source']) if (this[key] !== undefined) out[key] = this[key];
    return out;
  }

  /** Parses "5 g", "0,1 mol/L", "250 mL", "25 °C" → Quantity (no substance) */
  static parse(text) {
    const parsed = Quantity.parseWithRest(text);
    if (parsed.rest) fail('CHEM_UNIT_MISMATCH', `„${text}“: nach der Einheit steht noch „${parsed.rest}“.`);
    return parsed.quantity;
  }

  /**
   * Splits "10 g Fe" into the quantity and what follows the unit ("Fe"). The unit is the first word plus any part
   * joined by ·, * or /. Returns { quantity, rest }.
   */
  static parseWithRest(text) {
    const s = String(text).trim().replace(/\s*\/\s*/g, '/').replace(/\s*[·*]\s*/g, '·');
    const m = /^([+-−]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:\s*(?:[eE]|[·×x]\s*10\^?)\s*[+-−]?\d+)?)\s*(.*)$/.exec(s.replace(/−/g, '-'));
    if (!m) fail('CHEM_UNIT_MISMATCH', `„${text}“ ist keine Größe mit Zahl und Einheit.`);
    const value = parseNumber(m[1]);
    const remainder = m[2];
    if (!remainder) fail('CHEM_UNIT_MISMATCH', `„${text}“: die Einheit fehlt.`);
    const words = remainder.split(/\s+/);
    // "0,1 mol/L HCl": the unit is the first word (with its operators), the rest is the substance
    let unitText = words[0];
    let used = 1;
    while (used < words.length && /[·/^]$/.test(unitText)) unitText += words[used++];
    const rest = words.slice(used).join(' ');
    // typed without a space ("4gH2", "50mLHCl"): the longest known unit, if a formula follows it
    let restText = rest;
    if (!isUnit(unitText)) {
      for (let k = unitText.length - 1; k >= 1; k--) {
        const head = unitText.slice(0, k);
        const tail = unitText.slice(k);
        if (isUnit(head) && /^[A-Z(\[]/.test(tail)) {
          unitText = head;
          restText = rest ? `${tail} ${rest}` : tail;
          break;
        }
      }
    }
    const quantity = new Quantity(value, unitText, { sigFigs: sigFigsOf(m[1].replace(/\s*[·×x].*$/, '').replace(/[eE].*$/, '')) || undefined });
    return { quantity, rest: restText };
  }
}

/** Dimension-checked arithmetic. The result's unit is a composed SI unit unless `unit` is given. */
export function multiply(a, b, unit) {
  const dim = a.dim.map((x, i) => x + b.dim[i]);
  return fromDim(a.si * b.si, dim, unit, minSig(a, b));
}

export function divide(a, b, unit) {
  const dim = a.dim.map((x, i) => x - b.dim[i]);
  return fromDim(a.si / b.si, dim, unit, minSig(a, b));
}

const minSig = (a, b) => {
  const s = [a.sigFigs, b.sigFigs].filter((x) => x !== undefined);
  return s.length ? Math.min(...s) : undefined;
};

/** A quantity from an SI value and a dimension vector; `unit` (if given) must have that dimension */
export function fromDim(si, dim, unit, sigFigs) {
  if (unit) {
    const u = parseUnit(unit);
    if (!sameDimension(u, { dim })) fail('CHEM_UNIT_MISMATCH', `Das Ergebnis hat die Dimension „${dimensionName(dim)}“, nicht die von „${unit}“.`);
    return new Quantity(fromSI(si, u), unit, { sigFigs });
  }
  const names = ['kg', 'm', 's', 'mol', 'K', 'A'];
  const parts = dim.map((e, i) => (e ? `${names[i]}${e === 1 ? '' : '^' + e}` : '')).filter(Boolean);
  return new Quantity(si, parts.join('·') || '', { sigFigs });
}

export function addQ(a, b) {
  if (!sameDimension(a, b)) fail('CHEM_UNIT_MISMATCH', `„${a.unit}“ und „${b.unit}“ lassen sich nicht addieren.`);
  return new Quantity(a.value + b.in(a.unit), a.unit, { sigFigs: minSig(a, b) });
}
