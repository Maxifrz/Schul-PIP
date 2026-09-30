import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReaction, balanceCheck, formatReaction, speciesOf } from '../../src/chem/reaction.js';
import { balance, balanceResult } from '../../src/chem/balance.js';
import { Frac, nullspace, toIntegers, solveLinear, rank } from '../../src/chem/rational.js';
import { ChemError } from '../../src/chem/errors.js';

const balanced = (text) => {
  const b = balance(text);
  return formatReaction(b.reaction, b.coefficients, 'text');
};
const errorCode = (text) => {
  try {
    balance(text);
  } catch (e) {
    assert.ok(e instanceof ChemError);
    return e.code;
  }
  return null;
};

test('golden: Fe + O2 -> Fe2O3', () => {
  assert.equal(balanced('Fe + O2 -> Fe2O3'), '4 Fe + 3 O2 -> 2 Fe2O3');
  assert.equal(balanceResult('Fe + O2 -> Fe2O3').result.equation, '4 Fe + 3 O2 -> 2 Fe2O3');
});

test('common equations come out with the smallest whole numbers', () => {
  const cases = {
    'H2 + O2 -> H2O': '2 H2 + O2 -> 2 H2O',
    'C3H8 + O2 -> CO2 + H2O': 'C3H8 + 5 O2 -> 3 CO2 + 4 H2O',
    'C6H12O6 + O2 -> CO2 + H2O': 'C6H12O6 + 6 O2 -> 6 CO2 + 6 H2O',
    'N2 + H2 -> NH3': 'N2 + 3 H2 -> 2 NH3',
    'Al + HCl -> AlCl3 + H2': '2 Al + 6 HCl -> 2 AlCl3 + 3 H2',
    'KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2': '2 KMnO4 + 16 HCl -> 2 KCl + 2 MnCl2 + 8 H2O + 5 Cl2',
    'Cu + HNO3 -> Cu(NO3)2 + NO + H2O': '3 Cu + 8 HNO3 -> 3 Cu(NO3)2 + 2 NO + 4 H2O',
    'CaCO3 + HCl -> CaCl2 + H2O + CO2': 'CaCO3 + 2 HCl -> CaCl2 + H2O + CO2',
    'Fe2O3 + CO -> Fe + CO2': 'Fe2O3 + 3 CO -> 2 Fe + 3 CO2',
    'NH3 + O2 -> NO + H2O': '4 NH3 + 5 O2 -> 4 NO + 6 H2O',
    'Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O': '3 Ca(OH)2 + 2 H3PO4 -> Ca3(PO4)2 + 6 H2O',
    'H2+O2->H2O': '2 H2 + O2 -> 2 H2O',
    'CuSO4.5H2O -> CuSO4 + H2O': 'CuSO4·5H2O -> CuSO4 + 5 H2O',
    'Fe + O2 → Fe2O3': '4 Fe + 3 O2 -> 2 Fe2O3',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(balanced(input), expected, input);
});

test('ions: the charge is balanced with the atoms', () => {
  assert.equal(balanced('MnO4- + Fe2+ + H+ -> Mn2+ + Fe3+ + H2O'), 'MnO4- + 5 Fe^2+ + 8 H+ -> Mn^2+ + 5 Fe^3+ + 4 H2O');
  assert.equal(balanced('Cr2O7^2- + Fe2+ + H+ -> Cr3+ + Fe3+ + H2O'), 'Cr2O7^2- + 6 Fe^2+ + 14 H+ -> 2 Cr^3+ + 6 Fe^3+ + 7 H2O');
  assert.equal(balanced('Ag+ + Cl- -> AgCl'), 'Ag+ + Cl- -> AgCl');
  assert.equal(balanced('Zn + Cu2+ -> Zn2+ + Cu'), 'Zn + Cu^2+ -> Zn^2+ + Cu');
});

test('every result conserves each element and the charge', () => {
  for (const text of ['Fe + O2 -> Fe2O3', 'KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2', 'MnO4- + Fe2+ + H+ -> Mn2+ + Fe3+ + H2O', 'C8H18 + O2 -> CO2 + H2O', 'Al2(SO4)3 + NaOH -> Al(OH)3 + Na2SO4']) {
    const b = balance(text);
    const check = balanceCheck(b.reaction, b.coefficients);
    assert.equal(check.balanced, true, text);
    for (const row of check.rows) assert.ok(row.left.equals(row.right), `${text}: ${row.key}`);
    // the smallest whole numbers: the gcd is 1
    const gcd = b.coefficients.reduce((g, c) => { let a = g; let d = c; while (d) [a, d] = [d, a % d]; return a; }, 0);
    assert.equal(gcd, 1, text);
    assert.ok(b.coefficients.every((c) => Number.isInteger(c) && c > 0));
  }
});

test('arrows in every spelling', () => {
  for (const arrow of ['->', '→', '⇌', '<=>', '=>', '-->', '⟶']) {
    const r = parseReaction(`N2 + 3 H2 ${arrow} 2 NH3`);
    assert.equal(r.reactants.length, 2);
    assert.equal(r.products.length, 1);
    assert.equal(r.reversible, ['⇌', '<=>'].includes(arrow));
  }
  assert.equal(parseReaction('A → B'.replace('A', 'H2').replace('B', 'H2')).hasCoefficients, false);
  assert.equal(parseReaction('2 H2 + O2 -> 2 H2O').hasCoefficients, true);
  // marks that only decorate the equation
  const r = parseReaction('CaCO3 -> CaO + CO2 ↑');
  assert.equal(r.products.length, 2);
  assert.equal(parseReaction('Fe2+ + 2 e- -> Fe').reactants[1].formula.electron, true);
  assert.equal(parseReaction('1/2 O2 + H2 -> H2O').reactants[0].coef.toString(), '1/2');
  assert.equal(parseReaction('0,5 O2 + H2 -> H2O').reactants[0].coef.toString(), '1/2');
});

test('unbalanceable and underdetermined equations say why', () => {
  assert.equal(errorCode('Na -> Cl2'), 'CHEM_NO_SOLUTION');
  assert.equal(errorCode('H2 -> H2O'), 'CHEM_NO_SOLUTION');
  assert.equal(errorCode('H2 + O2 -> H2O + H2O2'), 'CHEM_MULTIPLE_SOLUTIONS');
  assert.equal(errorCode('H2O -> H2 + O2 + N2'), 'CHEM_NO_SOLUTION');
  assert.throws(() => parseReaction('H2 O2 H2O'), (e) => e.code === 'CHEM_SYNTAX');
  assert.throws(() => parseReaction('-> H2O'), (e) => e.code === 'CHEM_SYNTAX');
  assert.throws(() => parseReaction('H2 -> Xy'), (e) => e.code === 'CHEM_UNKNOWN_ELEMENT');
  try {
    balance('H2 + O2 -> H2O + H2O2');
  } catch (e) {
    assert.equal(e.details.basis.length, 2);
  }
});

test('typed coefficients that are wrong are reported', () => {
  const r = parseReaction('H2 + O2 -> H2O');
  assert.equal(balanceCheck(r).balanced, false);
  const good = parseReaction('2 H2 + O2 -> 2 H2O');
  assert.equal(balanceCheck(good).balanced, true);
  const res = balanceResult('H2 + 2 O2 -> H2O');
  assert.equal(res.result.equation, '2 H2 + O2 -> 2 H2O');
  assert.ok(res.warnings.length === 1, 'the typed coefficients were replaced');
  assert.equal(balanceResult('2 H2 + O2 -> 2 H2O').warnings.length, 0);
});

test('working steps show the matrix, the solution and the proof', () => {
  const res = balanceResult('Fe + O2 -> Fe2O3');
  const labels = res.steps.map((s) => s.label);
  assert.deepEqual(labels.slice(0, 2), ['Ansatz', 'Bilanz je Element']);
  assert.ok(labels.includes('Probe'));
  assert.ok(res.steps.find((s) => s.label === 'Auf ganze Zahlen bringen'), 'a fraction had to be cleared');
  assert.equal(speciesOf(res.chemistry ? {} : parseReaction('Fe + O2 -> Fe2O3')).length, 3);
});

test('exact rational algebra', () => {
  assert.equal(new Frac(6n, 4n).toString(), '3/2');
  assert.equal(new Frac(1n, 3n).add(new Frac(1n, 6n)).toString(), '1/2');
  assert.equal(Frac.of('0.25').toString(), '1/4');
  assert.equal(Frac.of(3).toString(), '3');
  assert.throws(() => new Frac(1n, 0n));
  const ns = nullspace([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  assert.equal(ns.length, 1);
  assert.deepEqual(toIntegers(ns[0]).map(Number), [1, -2, 1]);
  assert.equal(rank([[1, 2], [2, 4]]), 1);
  const s = solveLinear([[2, 1], [1, 3]], [5, 10]);
  assert.equal(s.kind, 'unique');
  assert.deepEqual(s.x.map(String), ['1', '3']);
  assert.equal(solveLinear([[1, 1], [1, 1]], [1, 2]).kind, 'none');
  assert.equal(solveLinear([[1, 1]], [2]).kind, 'many');
});

test('property: random reactions built from a known balanced one are recovered', () => {
  // A + B → C where the counts are chosen, then the equation is rebuilt from the formulas alone
  const random = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const rnd = random(7);
  for (let i = 0; i < 40; i++) {
    const a = 1 + Math.floor(rnd() * 4);
    const b = 1 + Math.floor(rnd() * 4);
    // CxHy + O2 -> CO2 + H2O with x = a, y = 2b
    const x = a;
    const y = 2 * b;
    const formula = `C${x === 1 ? '' : x}H${y}`;
    const result = balance(`${formula} + O2 -> CO2 + H2O`);
    const check = balanceCheck(result.reaction, result.coefficients);
    assert.equal(check.balanced, true, formula);
    assert.equal(result.coefficients[2], x * result.coefficients[0], `CO2 for ${formula}`);
    assert.equal(result.coefficients[3] * 2, y * result.coefficients[0], `H2O for ${formula}`);
  }
});
