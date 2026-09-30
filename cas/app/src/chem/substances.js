// The substance database (data/substances.json): common school substances with formula, name, phase, molar mass (from
// the formula, never stored), thermodynamic data per phase, acid/base constants, solubility products, densities and the
// ions a salt dissolves into. A property that a substance does not have is simply absent; asking for it gives
// CHEM_DATA_UNAVAILABLE, never an invented number.

import data from './data/substances.json' with { type: 'json' };
import { parseFormula, formulaKey, formatFormula } from './formula.js';
import { atomicMass, element } from './elements.js';
import { ISOTOPE_MASSES } from './formula.js';
import { fail } from './errors.js';

export const SUBSTANCE_DATA = { version: data.version, source: data.source, reference: data.reference, temperature: data.temperature };

const byKey = new Map();
const byName = new Map();
for (const raw of data.substances) {
  const parsed = parseFormula(raw.formula);
  const entry = Object.freeze({ ...raw, parsed, key: formulaKey(parsed) });
  byKey.set(entry.key, entry);
  for (const name of [raw.name, ...(raw.aliases || [])]) byName.set(name.toLowerCase(), entry);
}

export const SUBSTANCES = Object.freeze([...byKey.values()]);

/** The database entry for a formula or a name ("Salzsäure", "NaCl", "SO4^2-"); null when there is none */
export function findSubstance(input) {
  const text = String(input).trim();
  const named = byName.get(text.toLowerCase());
  if (named) return named;
  try {
    return byKey.get(formulaKey(parseFormula(text))) || null;
  } catch (e) {
    return null;
  }
}

export function substance(input) {
  const found = findSubstance(input);
  if (!found) fail('CHEM_UNKNOWN_SUBSTANCE', `„${input}“ ist nicht in der Stoffdatenbank.`, { substance: String(input) });
  return found;
}

/** Entry for an already parsed formula */
export const entryOf = (parsed) => byKey.get(formulaKey(parsed)) || null;

/** The entry that is `parsed` plus one proton: the conjugate acid of a base (CH3COO- → CH3COOH) */
export function conjugateAcid(parsed) {
  const atoms = { ...parsed.atoms, H: (parsed.atoms.H || 0) + 1 };
  return SUBSTANCES.find((s) => s.parsed.charge === parsed.charge + 1 && sameAtoms(s.parsed.atoms, atoms) && !s.parsed.hydrate.length) || null;
}

/** The entry that is `parsed` minus one proton: the conjugate base of an acid */
export function conjugateBase(parsed) {
  if (!parsed.atoms.H) return null;
  const atoms = { ...parsed.atoms, H: parsed.atoms.H - 1 };
  if (atoms.H === 0) delete atoms.H;
  return SUBSTANCES.find((s) => s.parsed.charge === parsed.charge - 1 && sameAtoms(s.parsed.atoms, atoms) && !s.parsed.hydrate.length) || null;
}

function sameAtoms(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
}

/**
 * The molar mass of a parsed formula in g/mol and how it is made up:
 *   { value, terms: [{ symbol, count, mass, sum, isotope }], notes: [] }
 * Electrons are not counted (5,5·10⁻⁴ g/mol each). Isotopes use the tabulated nuclide mass, otherwise the mass number.
 */
export function molarMass(f) {
  if (f.electron) return { value: 0, terms: [], notes: ['Ein Elektron wird mit der Molmasse 0 g/mol gerechnet (5,5·10⁻⁴ g/mol).'] };
  const notes = [];
  const terms = [];
  const isotopeCounts = f.isotopes || {};
  const perSymbol = {};
  for (const [key, n] of Object.entries(isotopeCounts)) {
    const symbol = key.replace(/^\d+/, '');
    perSymbol[symbol] = (perSymbol[symbol] || 0) + n;
    const known = ISOTOPE_MASSES[key];
    const mass = known !== undefined ? known : Number(key.replace(/\D+$/, ''));
    if (known === undefined) notes.push(`Für ${key} wird die Massenzahl als Näherung der Nuklidmasse benutzt.`);
    terms.push({ symbol: key, count: n, mass, sum: mass * n, isotope: true });
  }
  for (const [symbol, total] of Object.entries(f.atoms)) {
    const natural = total - (perSymbol[symbol] || 0);
    if (natural <= 0) continue;
    const mass = atomicMass(symbol);
    if (element(symbol).massIsMassNumber) notes.push(`${symbol} hat kein stabiles Isotop; angegeben ist die Massenzahl des langlebigsten Isotops.`);
    terms.push({ symbol, count: natural, mass, sum: mass * natural, isotope: false });
  }
  // the hydrate's water is already inside f.atoms; terms stay per element
  const value = terms.reduce((s, t) => s + t.sum, 0);
  return { value, terms, notes: [...new Set(notes)] };
}

/** Thermodynamic data of a phase: { dfH, dfG, S } in kJ/mol, kJ/mol, J/(mol·K) or null */
export function thermoOf(entry, phase) {
  if (!entry || !entry.thermo) return null;
  const p = phase || entry.phase;
  return entry.thermo[p] || null;
}

export const displayName = (entry, style = 'unicode') => `${entry.name} (${formatFormula(entry.parsed, style)})`;
