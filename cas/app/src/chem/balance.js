// Balancing a reaction equation: the atom matrix (one row per element, one for the charge, one column per species,
// products with a minus sign) has the coefficients in its null space. The null space is worked out with exact
// fractions; a unique positive direction, scaled to the smallest whole numbers, is the answer.

import { ChemicalResult, L } from './result.js';
import { formatFormula } from './formula.js';
import { parseReaction, speciesOf, elementsOf, hasCharge, formatReaction, balanceCheck } from './reaction.js';
import { nullspace, toIntegers, Frac } from './rational.js';
import { fail } from './errors.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const name = (i) => (i < LETTERS.length ? LETTERS[i] : `x_{${i + 1}}`);

/** The atom matrix: { keys, rows } where rows[k][j] is the count of element k in species j times its side sign */
export function atomMatrix(reaction) {
  const species = speciesOf(reaction);
  const keys = elementsOf(reaction);
  if (hasCharge(reaction)) keys.push('charge');
  const rows = keys.map((key) => species.map((s) => s.sign * (key === 'charge' ? s.formula.charge : s.formula.atoms[key] || 0)));
  return { species, keys, rows };
}

/** A row as "a + 2b = 3c" */
function equationOf(key, species, letters) {
  const side = (which) => {
    const parts = [];
    species.forEach((s, j) => {
      if (s.side !== which) return;
      const n = key === 'charge' ? s.formula.charge : s.formula.atoms[key] || 0;
      if (!n) return;
      // the charge is written with its sign, atoms as counts
      parts.push(`${Math.abs(n) === 1 ? '' : Math.abs(n)}${letters[j]}${n < 0 ? '^-' : ''}`);
    });
    return parts;
  };
  const left = side('left');
  const right = side('right');
  return { left, right };
}

function rowLatex(key, species, letters) {
  const label = key === 'charge' ? '\\text{Ladung}' : `\\mathrm{${key}}`;
  if (key === 'charge') {
    const side = (which) => species.map((s, j) => (s.side === which && s.formula.charge ? `${s.formula.charge > 0 ? '+' : '-'}${Math.abs(s.formula.charge) === 1 ? '' : Math.abs(s.formula.charge)}${letters[j]}` : '')).filter(Boolean);
    const l = side('left').join('') || '0';
    const r = side('right').join('') || '0';
    return `${label}:\\quad ${l.replace(/^\+/, '')} = ${r.replace(/^\+/, '')}`;
  }
  const { left, right } = equationOf(key, species, letters);
  return `${label}:\\quad ${left.join(' + ') || '0'} = ${right.join(' + ') || '0'}`;
}

/**
 * Balances a reaction. Returns { coefficients: number[], reaction, matrix, vector } or throws:
 *  - CHEM_NO_SOLUTION: no way to conserve every element (and the charge) with positive coefficients
 *  - CHEM_MULTIPLE_SOLUTIONS: several independent balanced equations exist (details.basis)
 */
export function balance(input) {
  const reaction = typeof input === 'string' ? parseReaction(input) : input;
  const { species, keys, rows } = atomMatrix(reaction);
  // an element on one side only can never be conserved
  keys.forEach((key, k) => {
    if (key === 'charge') return;
    const left = species.some((s) => s.side === 'left' && s.formula.atoms[key]);
    const right = species.some((s) => s.side === 'right' && s.formula.atoms[key]);
    if (!left || !right) fail('CHEM_NO_SOLUTION', `Das Element ${key} steht nur auf der ${left ? 'linken' : 'rechten'} Seite; die Gleichung lässt sich nicht ausgleichen.`, { element: key });
  });
  const basis = nullspace(rows);
  if (basis.length === 0) fail('CHEM_NO_SOLUTION', 'Mit den angegebenen Stoffen lässt sich die Gleichung nicht ausgleichen (kein Satz von Koeffizienten erhält alle Atome und die Ladung).', { rank: rows.length });
  if (basis.length > 1) {
    const readable = basis.map((v) => toIntegers(v).map(Number));
    fail('CHEM_MULTIPLE_SOLUTIONS', `Die Gleichung ist nicht eindeutig: Es gibt ${basis.length} voneinander unabhängige Ausgleiche. Es fehlt ein Stoff oder eine Bedingung.`, { basis: readable, species: species.map((s) => formatFormula(s.formula, 'text')) });
  }
  const direction = basis[0];
  const ints = toIntegers(direction);
  // the sign is arbitrary: turn it so the first coefficient is positive
  const flipped = ints[0] < 0n ? ints.map((x) => -x) : ints;
  if (flipped.some((x) => x === 0n)) {
    const bad = species.filter((s, i) => flipped[i] === 0n).map((s) => formatFormula(s.formula, 'text'));
    fail('CHEM_NO_SOLUTION', `Der Stoff ${bad.join(', ')} kann in dieser Gleichung nicht vorkommen (sein Koeffizient wäre 0). Vermutlich fehlt ein Stoff.`, { species: bad });
  }
  if (flipped.some((x) => x < 0n)) {
    fail('CHEM_NO_SOLUTION', 'Die Gleichung lässt sich mit den angegebenen Seiten nicht mit positiven Koeffizienten ausgleichen; ein Stoff steht vermutlich auf der falschen Seite.', { vector: flipped.map(Number) });
  }
  const coefficients = flipped.map((x) => {
    if (x > BigInt(Number.MAX_SAFE_INTEGER)) fail('CHEM_OUTSIDE_MODEL', 'Die Koeffizienten werden zu groß.');
    return Number(x);
  });
  return { coefficients, reaction, matrix: rows, keys, species, direction };
}

/** A ChemicalResult with the balanced equation and the working steps */
export function balanceResult(input) {
  const reaction = typeof input === 'string' ? parseReaction(input) : input;
  const b = balance(reaction);
  const { species, keys, matrix, direction } = b;
  const letters = species.map((s, i) => name(i));
  const res = new ChemicalResult('balance', 'Reaktionsgleichung ausgleichen');
  const text = formatReaction(reaction, b.coefficients, 'text');
  res.answer({ text, unicode: formatReaction(reaction, b.coefficients, 'unicode'), latex: formatReaction(reaction, b.coefficients, 'latex') });
  res.result.coefficients = b.coefficients;
  res.result.equation = text;
  res.source('Erhaltung der Atome und der Ladung (Atommatrix, exakte Bruchrechnung)');

  res.step('Ansatz', L(`${species.map((s, i) => `${letters[i]}\\,${formatFormula(s.formula, 'latex')}`).slice(0, reaction.reactants.length).join(' + ')} \\longrightarrow ${species.map((s, i) => `${letters[i]}\\,${formatFormula(s.formula, 'latex')}`).slice(reaction.reactants.length).join(' + ')}`, `${species.map((s, i) => `${letters[i]} ${formatFormula(s.formula, 'text')}`).slice(0, reaction.reactants.length).join(' + ')} -> ${species.map((s, i) => `${letters[i]} ${formatFormula(s.formula, 'text')}`).slice(reaction.reactants.length).join(' + ')}`));
  res.step('Bilanz je Element', ...keys.map((key) => L(rowLatex(key, species, letters), `${key === 'charge' ? 'Ladung' : key}: ${equationOf(key, species, letters).left.join(' + ') || '0'} = ${equationOf(key, species, letters).right.join(' + ') || '0'}`)));

  // the null space vector in terms of the free variable
  const fractions = direction;
  const ref = fractions[fractions.length - 1].isZero ? fractions.findIndex((x) => !x.isZero) : fractions.length - 1;
  const scaled = fractions.map((x) => x.div(fractions[ref]));
  const anyFraction = scaled.some((x) => !x.isInteger);
  const setLine = `${letters[ref]} = 1 \\;\\Rightarrow\\; ${scaled.map((x, i) => (i === ref ? null : `${letters[i]} = ${x.toLatex()}`)).filter(Boolean).join(',\\; ')}`;
  res.step('Lösen des linearen Gleichungssystems', L(setLine, setLine.replace(/\\;/g, ' ').replace(/\\Rightarrow/g, '=>').replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2')));
  if (anyFraction) {
    res.step('Auf ganze Zahlen bringen', L(`\\text{Mit dem kleinsten gemeinsamen Vielfachen der Nenner multiplizieren: } ${b.coefficients.map((c, i) => `${letters[i]} = ${c}`).join(',\\; ')}`, `Mit dem kleinsten gemeinsamen Vielfachen der Nenner multiplizieren: ${b.coefficients.map((c, i) => `${letters[i]} = ${c}`).join(', ')}`));
  }
  res.step('Ausgeglichene Gleichung', L(formatReaction(reaction, b.coefficients, 'latex'), text));
  // proof by counting
  const check = balanceCheck(reaction, b.coefficients);
  res.step('Probe', ...check.rows.map((r) => L(`${r.key === 'charge' ? '\\text{Ladung}' : `\\mathrm{${r.key}}`}:\\ ${r.left} = ${r.right}`, `${r.key === 'charge' ? 'Ladung' : r.key}: ${r.left} = ${r.right}`)));
  res.values.coefficients = { text: b.coefficients.join(', ') };
  const typed = species.map((s) => s.coef);
  const changed = reaction.hasCoefficients && typed.some((c, i) => !(c || new Frac(1n)).equals(b.coefficients[i]));
  if (changed) res.warn('CHEM_UNBALANCED_REACTION', 'Die eingegebenen Koeffizienten wurden ignoriert und neu berechnet.');
  res.actions = [
    { label: 'Stöchiometrie', command: 'stöchiometrie' },
    { label: 'Thermodynamik', command: 'reaktionsenthalpie' },
  ];
  return res;
}

export { Frac };

/**
 * The coefficients a calculation should use: the typed ones when they balance the equation, otherwise (when none were
 * typed) the balanced ones. Typed coefficients that do not balance are an error: CHEM_UNBALANCED_REACTION.
 * Returns { coefficients: Frac[], auto, result? } where `result` is the balancing ChemicalResult when it was needed.
 */
export function coefficientsFor(input) {
  const reaction = typeof input === 'string' ? parseReaction(input) : input;
  if (reaction.hasCoefficients) {
    const check = balanceCheck(reaction);
    if (!check.balanced) {
      const off = check.rows.filter((r) => !r.left.equals(r.right)).map((r) => `${r.key === 'charge' ? 'Ladung' : r.key}: ${r.left} ≠ ${r.right}`);
      fail('CHEM_UNBALANCED_REACTION', `Die Gleichung ist nicht ausgeglichen (${off.join('; ')}). Mit ausgleichen(…) wird sie ausgeglichen; lass die Koeffizienten weg, dann geschieht das automatisch.`, { rows: off });
    }
    return { reaction, coefficients: check.coefs, auto: false };
  }
  const result = balanceResult(reaction);
  return { reaction, coefficients: result.result.coefficients.map((c) => new Frac(BigInt(c))), auto: true, result };
}
