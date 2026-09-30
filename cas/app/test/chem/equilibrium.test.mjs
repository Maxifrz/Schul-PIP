import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equilibrium, solveExtent, solveCoupled } from '../../src/chem/equilibrium.js';
import { solubility, kspFromSolubility, precipitation, saturate, saltOf } from '../../src/chem/ksp.js';
import { parseArgs, splitArgs } from '../../src/chem/args.js';
import { phFromArgs } from '../../src/chem/acidbase.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1e-300, Math.abs(b)) + 1e-300, `${a} ≠ ${b}`);
const eq = (text, mode) => {
  const { positional, options } = parseArgs(splitArgs(text));
  return equilibrium(positional[0], positional.slice(1), options, mode);
};
const code = (f) => {
  try {
    f();
  } catch (e) {
    return e.code;
  }
  return null;
};

test('one reaction: the mass action law holds at the answer and nothing is negative', () => {
  const cases = [
    { nu: [-1, -3, 2], a0: [1, 3, 0], K: 0.5 },
    { nu: [-1, -1, 2], a0: [1, 1, 0], K: 50 },
    { nu: [-1, 2], a0: [1, 0], K: 0.15 },
    { nu: [-1, 1, 1], a0: [0.1, 0, 0], K: 1.8e-5 },
    { nu: [-2, 1], a0: [0, 1], K: 1e-4 },
    { nu: [-1, 1], a0: [1, 0], K: 1e15 },
    { nu: [-1, 1], a0: [0, 1], K: 1e-15 },
    { nu: [1, 1, -1], a0: [0, 0, 1], K: 4 },
  ];
  for (const { nu, a0, K } of cases) {
    const r = solveExtent(nu, a0, K);
    r.a.forEach((v, i) => assert.ok(v > 0 || (a0[i] === 0 && v >= 0), `activity ${i} of ${nu}`));
    const Q = r.a.reduce((q, v, i) => q * v ** nu[i], 1);
    close(Q, K, 1e-9);
  }
});

test('nearly complete reactions keep their digits', () => {
  const r = solveExtent([-1, 1], [1, 0], 1e15);
  close(r.a[0], 1e-15, 1e-9);
  const back = solveExtent([-1, 1], [0, 1], 1e-15);
  close(back.a[1], 1e-15, 1e-9);
});

test('several reactions at once agree with the acid-base solver', () => {
  // H2A ⇌ H+ + HA-, HA- ⇌ H+ + A2-  (species: H2A, H+, HA-, A2-); water neglected on both sides
  const K1 = 1e-3;
  const K2 = 1e-7;
  const s = solveCoupled([[-1, 1, 1, 0], [0, 1, -1, 1]], [K1, K2], [0.1, 0, 0, 0]);
  s.a.forEach((v) => assert.ok(v > 0));
  close((s.a[1] * s.a[2]) / s.a[0], K1, 1e-8);
  close((s.a[1] * s.a[3]) / s.a[2], K2, 1e-8);
  // the same acid through the pH command, with the constants as pKa (Kw makes a tiny difference)
  const ph = phFromArgs(splitArgs('H2A; 0,1 mol/L; pKa=3/7')).result.value;
  close(-Math.log10(s.a[1]), ph, 1e-6);
});

test('equilibrium command: golden ammonia synthesis and the table', () => {
  const r = eq('N2 + 3 H2 <=> 2 NH3; Kc=0,5; c(N2)=1 mol/L; c(H2)=3 mol/L');
  const xi = r.chemistry.xi;
  close(r.chemistry.equilibrium[0], 1 - xi, 1e-12);
  close(r.chemistry.equilibrium[2], 2 * xi, 1e-12);
  const [a, b, c] = r.chemistry.equilibrium;
  close((c * c) / (a * b ** 3), 0.5, 1e-9);
  assert.equal(r.table.rows.length, 3);
  assert.ok(r.steps.some((s) => s.label === 'Probe'));
});

test('Kp with partial pressures and pure solids', () => {
  const r = eq('CaCO3 <=> CaO + CO2; Kp=0,5');
  close(r.chemistry.equilibrium[2], 0.5, 1e-9);
  assert.match(r.assumptions.join(' '), /Aktivität 1/);
  const n = eq('N2O4 <=> 2 NO2; Kp=0,15; p(N2O4)=1 bar');
  close(n.chemistry.equilibrium[1] ** 2 / n.chemistry.equilibrium[0], 0.15, 1e-9);
  // Kc given, pressures asked: converted at T
  const c = eq('N2O4 <=> 2 NO2; Kc=0,006; p(N2O4)=1 bar; T=298 K');
  assert.ok(c.assumptions.some((a) => /Umrechnung/.test(a)));
});

test('K from measured values, also with start values', () => {
  const k = eq('N2 + 3 H2 <=> 2 NH3; c(N2)=0,4 mol/L; c(H2)=1,2 mol/L; c(NH3)=0,3 mol/L', 'constant');
  close(k.result.value, 0.3 ** 2 / (0.4 * 1.2 ** 3), 1e-12);
  const s = eq('N2 + 3 H2 <=> 2 NH3; c0(N2)=1 mol/L; c0(H2)=3 mol/L; c(NH3)=0,4 mol/L', 'constant');
  close(s.result.value, 0.4 ** 2 / (0.8 * 2.4 ** 3), 1e-9);
  assert.equal(code(() => eq('N2 + 3 H2 <=> 2 NH3; c(N2)=0,4 mol/L', 'constant')), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => eq('N2 + 3 H2 <=> 2 NH3; c0(N2)=0,1 mol/L; c0(H2)=3 mol/L; c(NH3)=0,4 mol/L', 'constant')), 'CHEM_NEGATIVE_CONCENTRATION');
});

test('equilibrium errors', () => {
  assert.equal(code(() => eq('N2 + 3 H2 <=> 2 NH3; c(N2)=1 mol/L')), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => eq('N2 + 3 H2 <=> 2 NH3; Kc=-1; c(N2)=1 mol/L')), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => eq('N2 + 3 H2 <=> 2 NH3; Kc=1')), 'CHEM_NO_SOLUTION');
  assert.equal(code(() => eq('N2 + 2 H2 <=> 2 NH3; Kc=1; c(N2)=1 mol/L')), 'CHEM_UNBALANCED_REACTION');
  assert.equal(code(() => eq('N2 + 3 H2 <=> 2 NH3; Kc=1; c(O2)=1 mol/L')), 'CHEM_UNKNOWN_SUBSTANCE');
  assert.equal(code(() => eq('N2 + 3 H2 <=> 2 NH3; Kc=1; c(N2)=1 g')), 'CHEM_UNIT_MISMATCH');
  assert.equal(code(() => solveExtent([-1, 1], [-1, 0], 1)), 'CHEM_NEGATIVE_CONCENTRATION');
  assert.equal(code(() => solveExtent([0, 0], [1, 1], 1)), 'CHEM_OUTSIDE_MODEL');
});

test('Ksp: textbook values and closed forms', () => {
  const s = (t, g = [], o = {}) => solubility(t, g, o).result.value;
  close(s('AgCl'), Math.sqrt(1.77e-10), 1e-9);
  close(s('Ag2CrO4'), (1.12e-12 / 4) ** (1 / 3), 1e-9);
  close(s('CaF2'), (3.45e-11 / 4) ** (1 / 3), 1e-9);
  close(s('Mg(OH)2'), (5.61e-12 / 4) ** (1 / 3), 1e-9);
  // a common ion suppresses the solubility
  close(s('AgCl', ['c(Cl-)=0,1 mol/L']), 1.77e-10 / 0.1, 1e-6);
  // a fixed pH: [OH-] = 1e-4, so s = Ksp / [OH-]²
  close(s('Mg(OH)2', [], { pH: '10' }), 5.61e-12 / 1e-8, 1e-9);
  // a weak-acid anion: lower pH dissolves more
  assert.ok(s('CaF2', [], { pH: '3' }) > s('CaF2'));
  assert.ok(s('CaCO3', [], { pH: '4' }) > s('CaCO3', [], { pH: '9' }));
  const back = kspFromSolubility('Ag2CrO4', '1,3e-4 mol/L');
  close(back.result.value, 4 * (1.3e-4) ** 3, 1e-9);
  const massBased = kspFromSolubility('AgCl', '0,00192 g/L');
  close(massBased.result.value, (0.00192 / 143.3212) ** 2, 1e-3);
});

test('the saturated solution satisfies the product exactly', () => {
  for (const [salt, c0] of [['AgCl', { 'Cl-': 0.01 }], ['Ag2CrO4', { 'Ag+': 1e-4 }], ['Ca3(PO4)2', {}], ['PbCl2', { 'Pb^2+': 0.001 }]]) {
    const { ions, ksp } = saltOf(salt);
    const { s } = saturate(ions, ksp, c0);
    const product = ions.reduce((p, i) => p * ((c0[i.label] || 0) + i.n * s) ** i.n, 1);
    close(product, ksp, 1e-9);
  }
});

test('precipitation: ion product against Ksp, and how much falls', () => {
  const yes = precipitation('AgCl', ['AgNO3 0,001 mol/L 50 mL', 'NaCl 0,001 mol/L 50 mL']);
  assert.match(yes.result.text, /fällt aus/);
  const n = yes.values['n(Niederschlag)'].value;
  // what remains in solution satisfies Ksp
  const left = 5e-4 - n / 0.1;
  close(left * left, 1.77e-10, 1e-6);
  const no = precipitation('AgCl', ['AgNO3 1e-6 mol/L 50 mL', 'NaCl 1e-6 mol/L 50 mL']);
  assert.match(no.result.text, /kein Niederschlag/);
  assert.equal(code(() => precipitation('AgCl', ['AgNO3 0,001 mol/L 50 mL'])), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => precipitation('AgCl', ['AgNO3 0,001 mol/L'])), 'CHEM_MISSING_CONSTANT');
});

test('Ksp errors', () => {
  assert.equal(code(() => solubility('NaCl2X')), 'CHEM_UNKNOWN_ELEMENT');
  assert.equal(code(() => solubility('C6H12O6')), 'CHEM_DATA_UNAVAILABLE');
  assert.equal(code(() => solubility('Wasser')), 'CHEM_DATA_UNAVAILABLE');
  assert.equal(code(() => solubility('AgCl', ['c(Na+)=0,1 mol/L'])), 'CHEM_UNKNOWN_SUBSTANCE');
  assert.equal(code(() => solubility('AgCl', ['c(Cl-)=1 g'])), 'CHEM_UNIT_MISMATCH');
  assert.equal(code(() => solubility('AgCl', ['c(Cl-)=1 mol/L', 'c(Ag+)=1 mol/L'])), 'CHEM_NO_SOLUTION');
  assert.ok(solubility('AgCl', [], { T: '50 °C' }).warnings.length === 1);
});
