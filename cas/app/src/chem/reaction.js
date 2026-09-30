// Reaction equations: reading "2 H2 + O2 -> 2 H2O", "N2 + 3 H2 ⇌ 2 NH3" or "MnO4- + 8 H+ + 5 e- → Mn2+ + 4 H2O" into
// species with coefficients, checking whether one is balanced, and writing it back as text, Unicode or LaTeX.

import { parseFormula, formatFormula } from './formula.js';
import { fail, ChemError } from './errors.js';
import { Frac } from './rational.js';

const ARROWS = [
  ['<=>', true], ['<->', true], ['<-->', true], ['⇌', true], ['⇄', true], ['↔', true], ['⇋', true], ['⇌', true],
  ['-->', false], ['==>', false], ['->', false], ['=>', false], ['→', false], ['⟶', false], ['⟹', false], ['⇒', false], ['=', false],
];

/** Text of arrows and marks as they arrive from the keyboard or from LaTeX, in one spelling */
function tidy(text) {
  return String(text)
    .replace(/\\rightleftharpoons|\\leftrightarrow|\\Leftrightarrow/g, '⇌')
    .replace(/\\longrightarrow|\\rightarrow|\\Rightarrow|\\to\b/g, '→')
    .replace(/[↑↓]/g, ' ')
    .replace(/Δ|△/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Position of the arrow at bracket depth 0: { index, length, reversible } or null */
function findArrow(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (depth !== 0) continue;
    for (const [arrow, reversible] of ARROWS) {
      if (text.startsWith(arrow, i)) return { index: i, length: arrow.length, reversible, arrow };
    }
  }
  return null;
}

/** Splits one side into term texts at the plus signs that separate terms (not those that are charges) */
export function splitTerms(side) {
  const pieces = side.split(/\s+\+\s+/);
  const out = [];
  for (const piece of pieces) {
    // unspaced: H2+O2 — a plus followed by a coefficient or a formula start is a separator, a charge is not
    let start = 0;
    let depth = 0;
    for (let i = 0; i < piece.length; i++) {
      const c = piece[i];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === '+' && depth === 0 && i > start && /^\s*(\d+[.,]?\d*\/?\d*\s*)?[A-Z(\[]/.test(piece.slice(i + 1)) && !/\^$/.test(piece.slice(start, i))) {
        out.push(piece.slice(start, i));
        start = i + 1;
      }
    }
    out.push(piece.slice(start));
  }
  return out.map((t) => t.trim()).filter((t, i, all) => t || all.length === 1);
}

function parseCoefficient(text) {
  const m = /^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+)\s*/.exec(text);
  if (m) {
    return { coef: Frac.of(m[1].replace(',', '.')).div(Frac.of(BigInt(m[2]))), rest: text.slice(m[0].length) };
  }
  const d = /^(\d+(?:[.,]\d+)?)\s*(?=[A-Za-z(\[])/.exec(text);
  if (d) return { coef: Frac.of(d[1].replace(',', '.')), rest: text.slice(d[0].length) };
  return { coef: null, rest: text };
}

function parseTerm(text, whole) {
  const { coef, rest } = parseCoefficient(text);
  if (!rest) fail('CHEM_FORMULA_INVALID', `„${whole}“: ein Term ist leer oder besteht nur aus einer Zahl.`);
  let formula;
  try {
    formula = parseFormula(rest);
  } catch (e) {
    if (e instanceof ChemError) throw new ChemError(e.code, `Term „${text}“: ${e.message}`, e.details);
    throw e;
  }
  return { coef, formula, text: rest };
}

/**
 * Reads a reaction. Returns
 *   { reactants: [{ coef: Frac|null, formula, text }], products: [...], reversible, arrow, source, hasCoefficients }
 * Throws CHEM_SYNTAX for a missing arrow or an empty side, and the formula errors for a bad formula.
 */
export function parseReaction(input) {
  const source = String(input);
  const text = tidy(source);
  if (!text) fail('CHEM_SYNTAX', 'Die Reaktionsgleichung ist leer.');
  const arrow = findArrow(text);
  if (!arrow) fail('CHEM_SYNTAX', `„${source}“ hat keinen Reaktionspfeil (->, → oder ⇌).`);
  const left = text.slice(0, arrow.index).trim();
  const right = text.slice(arrow.index + arrow.length).trim();
  if (!left || !right) fail('CHEM_SYNTAX', 'Auf beiden Seiten des Pfeils muss mindestens ein Stoff stehen.');
  if (findArrow(right)) fail('CHEM_SYNTAX', 'Die Gleichung hat mehr als einen Reaktionspfeil.');
  const side = (s) => splitTerms(s).map((t) => parseTerm(t, source));
  const reactants = side(left);
  const products = side(right);
  const hasCoefficients = [...reactants, ...products].some((t) => t.coef !== null);
  return { reactants, products, reversible: arrow.reversible, arrow: arrow.arrow, source, hasCoefficients };
}

/** Whether a text looks like a reaction: a valid arrow and formulas on both sides */
export function isReaction(text) {
  try {
    parseReaction(text);
    return true;
  } catch (e) {
    return false;
  }
}

/** All species (reactants then products) with the sign they have in the atom matrix: +1 left, −1 right */
export const speciesOf = (reaction) => [
  ...reaction.reactants.map((t) => ({ ...t, side: 'left', sign: 1 })),
  ...reaction.products.map((t) => ({ ...t, side: 'right', sign: -1 })),
];

/** Element symbols in order of first appearance */
export function elementsOf(reaction) {
  const seen = [];
  for (const s of speciesOf(reaction)) for (const el of Object.keys(s.formula.atoms)) if (!seen.includes(el)) seen.push(el);
  return seen;
}

export const hasCharge = (reaction) => speciesOf(reaction).some((s) => s.formula.charge !== 0);

/**
 * Atom and charge totals per side for the given coefficients (numbers, default: the coefficients typed or 1).
 * Returns { balanced, rows: [{ key, left, right }] } with key an element symbol or 'charge'.
 */
export function balanceCheck(reaction, coefficients) {
  const species = speciesOf(reaction);
  const coefs = species.map((s, i) => (coefficients ? Frac.of(coefficients[i]) : s.coef || new Frac(1n)));
  const keys = [...elementsOf(reaction), 'charge'];
  const rows = keys.map((key) => {
    let left = new Frac(0n);
    let right = new Frac(0n);
    species.forEach((s, i) => {
      const per = key === 'charge' ? s.formula.charge : s.formula.atoms[key] || 0;
      const amount = coefs[i].mul(Frac.of(per));
      if (s.side === 'left') left = left.add(amount);
      else right = right.add(amount);
    });
    return { key, left, right };
  });
  return { balanced: rows.every((r) => r.left.equals(r.right)), rows, coefs };
}

const coefText = (c) => (c.equals(1) ? '' : c.isInteger ? `${c} ` : `${c.n}/${c.d} `);

/** The reaction with coefficients as text ('text': H2, '->'; 'unicode': H₂, →; 'latex') */
export function formatReaction(reaction, coefficients, style = 'text') {
  const species = speciesOf(reaction);
  const coefs = species.map((s, i) => (coefficients ? Frac.of(coefficients[i]) : s.coef || new Frac(1n)));
  const term = (s, i) => {
    const c = coefs[i];
    const f = formatFormula(s.formula, style === 'latex' ? 'latex' : style);
    if (style === 'latex') return (c.equals(1) ? '' : c.isInteger ? `${c}\\,` : `${c.toLatex()}\\,`) + f;
    return coefText(c) + f;
  };
  const left = species.map((s, i) => [s, i]).filter(([s]) => s.side === 'left').map(([s, i]) => term(s, i));
  const right = species.map((s, i) => [s, i]).filter(([s]) => s.side === 'right').map(([s, i]) => term(s, i));
  const arrow = style === 'latex' ? (reaction.reversible ? '\\rightleftharpoons' : '\\rightarrow') : style === 'unicode' ? (reaction.reversible ? '⇌' : '→') : reaction.reversible ? '<=>' : '->';
  const plus = style === 'latex' ? ' + ' : ' + ';
  return `${left.join(plus)} ${arrow} ${right.join(plus)}`;
}
