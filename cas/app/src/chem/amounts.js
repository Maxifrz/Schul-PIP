// Amounts of substance from what a task gives: a mass, an amount, a gas volume, a concentration with a volume, a
// density with a volume. Substances are found by formula or by name; every conversion records its step.

import { parseFormula, formatFormula } from './formula.js';
import { findSubstance, molarMass, entryOf } from './substances.js';
import { Quantity } from './quantity.js';
import { CONSTANTS, NORMAL } from './constants.js';
import { formatNumber } from './format.js';
import { L } from './result.js';
import { fail, ChemError } from './errors.js';
import { convert } from './units.js';

const R = CONSTANTS.R.value;

/** A substance from a formula or a name: { formula (parsed), entry, M (g/mol), terms, label, phase, text } */
export function resolve(input) {
  if (input && typeof input === 'object' && input.atoms) return resolveParsed(input);
  const text = String(input).trim();
  if (!text) fail('CHEM_UNKNOWN_SUBSTANCE', 'Es wurde kein Stoff angegeben.');
  const byName = findSubstance(text);
  let parsed;
  try {
    parsed = parseFormula(text);
  } catch (e) {
    if (byName) parsed = byName.parsed;
    else if (e instanceof ChemError && (['CHEM_UNKNOWN_ELEMENT', 'CHEM_INVALID_CHARGE'].includes(e.code) || (e.code === 'CHEM_FORMULA_INVALID' && /Klammer/.test(e.message)))) throw e;
    else fail('CHEM_UNKNOWN_SUBSTANCE', `„${text}“ ist weder eine Formel noch ein Stoff der Datenbank.`, { substance: text });
  }
  const entry = byName;
  const known = entry || entryOf(parsed);
  const mm = molarMass(parsed);
  const phase = parsed.phase || (known ? known.phase : null);
  return { formula: parsed, entry: known, M: mm.value, terms: mm.terms, notes: mm.notes, phase, label: formatFormula({ ...parsed, phase: null }, 'text'), input: text };
}

/**
 * Whether a species has activity 1 in an equilibrium expression: a pure solid or liquid. A phase tag decides ((s), (l)
 * pure; (aq), (g) not). Without a tag: solids from the database and the solvent water are pure; other liquids
 * (acetic acid, ethanol, hydrogen peroxide) are taken as solutes, since that is what they are in a solution.
 */
export function isPurePhase(sub) {
  const tag = sub.formula && sub.formula.phase;
  if (tag) return tag === 's' || tag === 'l';
  if (formatFormula({ ...sub.formula, phase: null }) === 'H2O') return true;
  if (['Hg', 'Br2'].includes(sub.label)) return true;
  return sub.phase === 's';
}

/** A substance from an already parsed formula */
export function resolveParsed(parsed) {
  const entry = entryOf(parsed);
  const mm = molarMass(parsed);
  return { formula: parsed, entry, M: mm.value, terms: mm.terms, notes: mm.notes, phase: parsed.phase || (entry ? entry.phase : null), label: formatFormula({ ...parsed, phase: null }, 'text'), input: parsed.input };
}

export const latexOf = (s) => formatFormula({ ...s.formula, phase: null }, 'latex');

/** Parses a given like "10 g Fe", "Fe: 10 g", "m(Fe) = 10 g", "0,1 mol/L HCl 50 mL" → { symbol, substance, quantities } */
export function parseGiven(text) {
  let s = String(text).trim();
  let symbol = null;
  let substance = null;
  let initial = false;
  const sym = /^([nmVcMTpw])(0?)\s*\(\s*([^)]*(?:\([^)]*\)[^)]*)*)\)\s*=\s*(.+)$/.exec(s);
  if (sym) {
    symbol = sym[1];
    initial = sym[2] === '0';
    substance = sym[3].trim() || null;
    s = sym[4];
  } else {
    const colon = /^(.+?)\s*:\s*(.+)$/.exec(s);
    if (colon && !/^[-+\d.,]/.test(colon[1])) {
      substance = colon[1].trim();
      s = colon[2];
    }
  }
  const quantities = [];
  let rest = s.trim();
  while (rest && /^[-+−]?[\d.,]/.test(rest)) {
    const { quantity, rest: after } = Quantity.parseWithRest(rest);
    quantities.push(quantity);
    rest = after.trim();
  }
  if (rest) {
    if (substance) fail('CHEM_SYNTAX', `„${text}“: „${rest}“ ist nicht lesbar.`);
    substance = rest;
    // "HCl 0,1 mol/L 50 mL": quantities may also follow the substance
    const m = /^(\S+)\s+([-+−]?[\d.,].*)$/.exec(rest);
    if (m) {
      substance = m[1];
      let more = m[2];
      while (more && /^[-+−]?[\d.,]/.test(more)) {
        const { quantity, rest: after } = Quantity.parseWithRest(more);
        quantities.push(quantity);
        more = after.trim();
      }
      if (more) fail('CHEM_SYNTAX', `„${text}“: „${more}“ ist nicht lesbar.`);
    }
  }
  if (!quantities.length) fail('CHEM_SYNTAX', `„${text}“ enthält keine Größe mit Zahl und Einheit.`);
  return { symbol, substance, quantities, initial };
}

const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

/** The lowest number of significant digits among quantities (undefined when none carries one) */
export function minSig(quantities) {
  const s = quantities.map((q) => q && q.sigFigs).filter((x) => x !== undefined);
  return s.length ? Math.min(...s) : undefined;
}

/**
 * Amount of substance from the quantities given for one substance.
 * `conditions`: { T (K), p (Pa) } for gas volumes. Returns { n (mol), steps: [{label, lines}], assumptions, sigFigs, mass, volume }.
 */
export function amountFrom(sub, quantities, conditions = {}) {
  const steps = [];
  const assumptions = [];
  const by = { amount: null, mass: null, volume: null, concentration: null, massConcentration: null, temperature: null, pressure: null };
  for (const q of quantities) {
    const kind = Object.keys(by).find((k) => q.is(k));
    if (!kind) fail('CHEM_UNIT_MISMATCH', `Die Größe „${q.value} ${q.unit}“ (${q.dimension}) ist hier nicht verwendbar.`, { unit: q.unit });
    if (by[kind]) fail('CHEM_UNIT_MISMATCH', `Zwei Angaben der Art „${q.dimension}“ für ${sub.label}.`);
    by[kind] = q;
  }
  const M = sub.M;
  const label = sub.label;
  const sigFigs = minSig(quantities);
  if (by.amount) {
    const n = by.amount.in('mol');
    return { n, steps, assumptions, sigFigs, from: 'amount' };
  }
  if (by.mass) {
    const m = by.mass.in('g');
    const n = m / M;
    steps.push({ label: `Stoffmenge aus der Masse (${label})`, lines: [L(`n = \\frac{m}{M} = \\frac{${fmtL(m)}\\,\\mathrm{g}}{${fmtL(M)}\\,\\mathrm{g/mol}} = ${fmtL(n)}\\,\\mathrm{mol}`, `n = m/M = ${fmt(m)} g / ${fmt(M)} g/mol = ${fmt(n)} mol`)] });
    return { n, steps, assumptions, sigFigs, from: 'mass' };
  }
  if (by.massConcentration && by.volume) {
    const m = by.massConcentration.in('g/L') * by.volume.in('L');
    const n = m / M;
    steps.push({ label: `Stoffmenge aus Massenkonzentration und Volumen (${label})`, lines: [L(`n = \\frac{\\beta \\cdot V}{M} = ${fmtL(n)}\\,\\mathrm{mol}`, `n = β·V/M = ${fmt(n)} mol`)] });
    return { n, steps, assumptions, sigFigs, from: 'massConcentration' };
  }
  if (by.concentration && by.volume) {
    const c = by.concentration.in('mol/L');
    const V = by.volume.in('L');
    const n = c * V;
    steps.push({ label: `Stoffmenge aus Konzentration und Volumen (${label})`, lines: [L(`n = c \\cdot V = ${fmtL(c)}\\,\\mathrm{mol/L} \\cdot ${fmtL(V)}\\,\\mathrm{L} = ${fmtL(n)}\\,\\mathrm{mol}`, `n = c·V = ${fmt(c)} mol/L · ${fmt(V)} L = ${fmt(n)} mol`)] });
    return { n, steps, assumptions, sigFigs, from: 'solution' };
  }
  if (by.volume) {
    const V = by.volume.in('L');
    if (sub.phase === 'g') {
      const T = by.temperature ? by.temperature.si : conditions.T !== undefined ? conditions.T : NORMAL.T;
      const p = by.pressure ? by.pressure.si : conditions.p !== undefined ? conditions.p : NORMAL.p;
      if (!by.temperature && conditions.T === undefined && !by.pressure && conditions.p === undefined) assumptions.push('Gasvolumen bei Normbedingungen (0 °C, 101,325 kPa) und als ideales Gas gerechnet; andere Bedingungen mit T=… und p=… angeben.');
      else assumptions.push(`Ideales Gas bei ${fmt(T)} K und ${fmt(p / 1000)} kPa.`);
      const n = (p * V * 1e-3) / (R * T);
      steps.push({ label: `Stoffmenge aus dem Gasvolumen (${label})`, lines: [L(`n = \\frac{p \\cdot V}{R \\cdot T} = \\frac{${fmtL(p)}\\,\\mathrm{Pa} \\cdot ${fmtL(V * 1e-3)}\\,\\mathrm{m^3}}{8{,}314\\,\\mathrm{J/(mol\\cdot K)} \\cdot ${fmtL(T)}\\,\\mathrm{K}} = ${fmtL(n)}\\,\\mathrm{mol}`, `n = p·V/(R·T) = ${fmt(n)} mol`)] });
      return { n, steps, assumptions, sigFigs, from: 'gas' };
    }
    const d = sub.entry && sub.entry.density;
    if (d) {
      const rho = convert(d.value, d.unit, 'g/L');
      const m = rho * V;
      const n = m / M;
      assumptions.push(`Dichte von ${label}: ${fmt(d.value)} ${d.unit} bei ${fmt(d.T - 273.15)} °C.`);
      steps.push({ label: `Stoffmenge aus Volumen und Dichte (${label})`, lines: [L(`n = \\frac{\\rho \\cdot V}{M} = ${fmtL(n)}\\,\\mathrm{mol}`, `n = ρ·V/M = ${fmt(n)} mol`)] });
      return { n, steps, assumptions, sigFigs, from: 'density' };
    }
    fail('CHEM_MISSING_CONSTANT', `Aus einem Volumen allein lässt sich die Stoffmenge von ${label} nicht bestimmen: Es ist weder ein Gas noch ist eine Dichte gespeichert. Gib die Konzentration oder die Masse an.`, { substance: label });
  }
  if (by.concentration) fail('CHEM_MISSING_CONSTANT', `Zur Konzentration von ${label} fehlt das Volumen der Lösung.`, { substance: label });
  fail('CHEM_MISSING_CONSTANT', `Für ${label} fehlt eine Angabe (Masse, Stoffmenge, Volumen …).`, { substance: label });
}

/** Options like "T=25 °C", "p=1 bar" → { T (K), p (Pa) }; other options stay in `rest` */
export function conditionsFrom(options) {
  const out = {};
  for (const [key, value] of Object.entries(options)) {
    if (key === 'T') out.T = Quantity.parse(value).need('temperature', 'die Temperatur').si;
    else if (key === 'p') out.p = Quantity.parse(value).need('pressure', 'den Druck').si;
  }
  return out;
}
