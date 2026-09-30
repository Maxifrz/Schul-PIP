// Oxidation numbers by the rules of the school curriculum: F is −1, the alkali and alkaline-earth metals +1 and +2, H is +1
// (−1 in metal hydrides), O is −2 (−1 in peroxides, −½ in superoxides, +2 with F), the halogens are −1 unless bonded to
// O, F or a more electronegative halogen; the remaining element takes what the charge requires. With several atoms of
// one element the number is the average (Fe₃O₄: +8/3). Where more than one element is left over, the more
// electronegative one gets its usual negative number.

import { findElement } from './elements.js';
import { Frac } from './rational.js';
import { formatFormula, formulaKey } from './formula.js';
import { fail } from './errors.js';

const ALKALI = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr']);
const EARTH = new Set(['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra']);
const FIXED_METAL = { Al: 3, Zn: 2, Cd: 2, Ag: 1, Ga: 3, Sc: 3, Y: 3, La: 3 };
const HALOGEN = new Set(['Cl', 'Br', 'I']);
/** Formulas whose structure is not what the rules would give */
const SPECIAL = {
  FeS2: { numbers: { Fe: 2, S: -1 }, note: 'Pyrit: Disulfid-Ion S₂²⁻, Schwefel −1' },
};
const NEGATIVE = { 15: -3, 16: -2, 17: -1, 14: -4 };

// the group of the p-block elements that can be negative
const GROUP = { N: 15, P: 15, As: 15, O: 16, S: 16, Se: 16, Te: 16, F: 17, Cl: 17, Br: 17, I: 17, C: 14, Si: 14, B: 13 };

const en = (symbol) => findElement(symbol).electronegativity ?? 0;
const range = (symbol) => {
  const s = findElement(symbol).oxidationStates;
  return s.length ? [Math.min(...s), Math.max(...s)] : [-Infinity, Infinity];
};

/**
 * Oxidation numbers of a parsed formula: { numbers: { El: Frac }, peroxo: number, notes: string[] }
 * `numbers` holds the average per atom of each element.
 */
export function oxidationNumbers(f) {
  if (f.electron) fail('CHEM_OUTSIDE_MODEL', 'Ein Elektron hat keine Oxidationszahl.');
  const atoms = f.atoms;
  const symbols = Object.keys(atoms);
  const notes = [];
  // disulfides are not covered by the rules above
  const special = SPECIAL[formulaKey({ ...f, phase: null })];
  if (special) return { numbers: Object.fromEntries(Object.entries(special.numbers).map(([k, v]) => [k, Frac.of(v)])), peroxo: 0, notes: [special.note] };
  const charge = f.charge;
  if (symbols.length === 1) {
    const s = symbols[0];
    const value = new Frac(BigInt(charge), BigInt(atoms[s]));
    return { numbers: { [s]: value }, peroxo: 0, notes };
  }
  const others = (el) => symbols.filter((s) => s !== el);
  const fixedValue = (el, oMode) => {
    if (el === 'F') return -1;
    if (ALKALI.has(el)) return 1;
    if (EARTH.has(el)) return 2;
    if (FIXED_METAL[el] !== undefined) return FIXED_METAL[el];
    if (el === 'H') return others('H').every((o) => en(o) < 2 || o === 'B' || o === 'Si') ? -1 : 1;
    if (el === 'O') return oMode === 'normal' ? -2 : null;
    if (HALOGEN.has(el)) {
      const stronger = symbols.some((o) => o === 'O' || o === 'F' || (HALOGEN.has(o) && en(o) > en(el)));
      return stronger ? null : -1;
    }
    return null;
  };

  const solve = (oMode, peroxoK = 0) => {
    const numbers = {};
    let known = 0;
    const unknown = [];
    for (const s of symbols) {
      let v = fixedValue(s, oMode);
      if (s === 'O' && oMode === 'normal' && peroxoK) {
        // k of the O atoms are peroxo (−1), the others −2: the average
        numbers.O = new Frac(BigInt(-(2 * (atoms.O - peroxoK) + peroxoK)), BigInt(atoms.O));
        known += -(2 * (atoms.O - peroxoK) + peroxoK);
        continue;
      }
      if (v === null) unknown.push(s);
      else {
        numbers[s] = new Frac(BigInt(v));
        known += v * atoms[s];
      }
    }
    return { numbers, known, unknown };
  };

  const finish = (numbers, unknown, known, peroxo = 0) => {
    if (unknown.length === 0) {
      return known === charge ? { numbers, peroxo, notes } : null;
    }
    // the most electronegative unknowns take their usual negative number, the last one the rest
    const order = [...unknown].sort((a, b) => en(b) - en(a));
    let sum = known;
    for (const s of order.slice(0, -1)) {
      const g = GROUP[s];
      if (g === undefined || NEGATIVE[g] === undefined) fail('CHEM_OUTSIDE_MODEL', `Die Oxidationszahlen von ${formatFormula(f)} lassen sich mit den Schulregeln nicht eindeutig bestimmen (${s}).`, { element: s });
      numbers[s] = new Frac(BigInt(NEGATIVE[g]));
      sum += NEGATIVE[g] * atoms[s];
    }
    const last = order[order.length - 1];
    numbers[last] = new Frac(BigInt(charge - sum), BigInt(atoms[last]));
    return { numbers, peroxo, notes, last };
  };

  // 1. the normal rules
  let { numbers, known, unknown } = solve('normal');
  let out = finish(numbers, unknown, known);
  const outside = (r) => {
    if (!r || !r.last) return false;
    const [lo, hi] = range(r.last);
    const v = r.numbers[r.last].toNumber();
    return v < lo - 1e-9 || v > hi + 1e-9;
  };
  if (out && !outside(out)) return out;

  // 2. peroxides and superoxides: O is the unknown
  if (atoms.O && symbols.length > 1) {
    const alt = solve('unknown');
    if (alt.unknown.includes('O')) {
      const r = finish(alt.numbers, alt.unknown, alt.known);
      if (r && (!r.last || r.last === 'O')) {
        const v = r.numbers.O;
        // −1 (peroxide), −½ (superoxide), +2 (OF2) are known; anything else is not a peroxide
        if ([-1, -0.5, 2].some((x) => Math.abs(v.toNumber() - x) < 1e-12) && (!out || out.last === undefined || outside(out))) {
          return { ...r, peroxo: v.toNumber() === -1 ? atoms.O : 0, notes: [...r.notes, v.toNumber() === -1 ? 'Peroxid: Sauerstoff −1' : v.toNumber() === -0.5 ? 'Superoxid: Sauerstoff −½' : 'Sauerstoff +2 (mit Fluor)'] };
        }
      }
    }
    // peroxo bridges (S₂O₈²⁻, CrO₅): as few O atoms at −1 as it takes to keep the element within its range
    for (let k = 2; k <= atoms.O; k += 2) {
      const { numbers: n2, known: k2, unknown: u2 } = solve('normal', k);
      const r = finish(n2, u2, k2, k);
      if (r && !outside(r)) return { ...r, notes: [...r.notes, `${k} Sauerstoffatome als Peroxid (−1), die übrigen −2`] };
    }
  }
  if (out) {
    const r = out;
    notes.push('Die Oxidationszahl liegt außerhalb der üblichen Werte; das Ergebnis ist eine Rechnung nach den Regeln.');
    return { ...r, notes };
  }
  fail('CHEM_OUTSIDE_MODEL', `Die Oxidationszahlen von ${formatFormula(f)} lassen sich mit den Schulregeln nicht bestimmen.`);
}

/** "+6", "−2", "0", "+8/3" */
export function onText(frac, style = 'text') {
  if (frac.isZero) return '0';
  const sign = frac.sign > 0 ? '+' : style === 'latex' ? '-' : '−';
  const n = frac.n < 0n ? -frac.n : frac.n;
  return frac.d === 1n ? `${sign}${n}` : `${sign}${n}/${frac.d}`;
}
