import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phFromArgs, kwAt, fractions, solveSolution, deprotonated } from '../../src/chem/acidbase.js';
import { splitArgs } from '../../src/chem/args.js';
import { parseFormula, formatFormula } from '../../src/chem/formula.js';
import { runChemistry } from '../../src/chem/commands.js';
import { toText } from '../../src/chem/result.js';

const ph = (text, kind) => phFromArgs(splitArgs(text), kind);
const value = (text) => ph(text).result.value;
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const code = (f) => {
  try {
    f();
  } catch (e) {
    return e.code;
  }
  return null;
};

test('strong acids and bases, also where the water matters', () => {
  close(value('HCl; 0,1 mol/L'), 1, 1e-9);
  close(value('HCl; 0,01 mol/L'), 2, 1e-9);
  close(value('HNO3; 1e-3 mol/L'), -Math.log10((1e-3 + Math.sqrt(1e-6 + 4e-14)) / 2), 1e-12);
  close(value('NaOH; 0,01 mol/L'), 12, 1e-9);
  close(value('KOH; 0,1 mol/L'), 13, 1e-9);
  close(value('Ca(OH)2; 0,005 mol/L'), 12, 1e-9);
  // 1e-8 mol/L HCl is not pH 8: the autoprotolysis gives pH 6,978
  const h = (1e-8 + Math.sqrt(1e-16 + 4e-14)) / 2;
  close(value('HCl; 1e-8 mol/L'), -Math.log10(h), 1e-9);
  close(value('NaOH; 1e-8 mol/L'), 14 + Math.log10((1e-8 + Math.sqrt(1e-16 + 4e-14)) / 2), 1e-9);
  close(value('NaCl; 0,1 mol/L'), 7, 1e-9);
  close(value('0,001 mol/L'), 3, 1e-7);
});

test('weak acids and bases against the quadratic formula', () => {
  // the quadratic formula neglects the water; the engine does not, so they agree to about 1e-8
  const Ka = 10 ** -4.76;
  const x = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * 0.1)) / 2;
  close(value('CH3COOH; 0,1 mol/L'), -Math.log10(x), 1e-7);
  const Kb = 10 ** -4.75;
  const y = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * 0.1)) / 2;
  close(value('NH3; 0,1 mol/L'), 14 + Math.log10(y), 1e-7);
  close(value('HA; 0,1 mol/L; pKa=4,76'), value('CH3COOH; 0,1 mol/L'), 1e-9);
  close(value('B; 0,1 mol/L; pKb=4,75'), value('NH3; 0,1 mol/L'), 1e-9);
  close(value('HA; 0,1 mol/L; Ka=1,8e-5'), -Math.log10((-1.8e-5 + Math.sqrt(1.8e-5 ** 2 + 4 * 1.8e-5 * 0.1)) / 2), 1e-7);
});

test('salts: hydrolysis of the ions', () => {
  close(value('CH3COONa; 0,1 mol/L'), 14 - 0.5 * (9.24 - Math.log10(0.1)), 0.01);
  close(value('NH4Cl; 0,1 mol/L'), 0.5 * (9.25 + 1), 0.01);
  close(value('NaHCO3; 0,1 mol/L'), 0.5 * (6.35 + 10.33), 0.05);
  close(value('Na2CO3; 0,1 mol/L'), 11.66, 0.02);
  close(value('NaNO3; 0,1 mol/L'), 7, 1e-9);
});

test('polyprotic acids', () => {
  close(value('H3PO4; 0,1 mol/L'), 1.63, 0.01);
  close(value('H2SO4; 0,05 mol/L'), 1.24, 0.01);
  close(value('H2CO3; 0,01 mol/L'), 0.5 * (6.35 + 2), 0.02);
});

test('buffers: Henderson-Hasselbalch only where it holds', () => {
  const b = ph('CH3COOH 0,1 mol/L; CH3COONa 0,05 mol/L');
  close(b.result.value, 4.76 + Math.log10(0.5), 0.005);
  assert.equal(b.chemistry.kind, 'buffer');
  assert.ok(b.values['pH nach Henderson-Hasselbalch']);
  assert.equal(b.warnings.length, 0);
  // an acetate ion alone is read as a salt with a spectator
  close(value('CH3COOH 0,1 mol/L; CH3COO- 0,1 mol/L'), 4.76, 0.005);
  // a "buffer" whose components are far too dilute is not Henderson-Hasselbalch
  const dilute = ph('CH3COOH 1e-6 mol/L; CH3COONa 1e-6 mol/L');
  assert.ok(dilute.warnings.some((w) => /Henderson/.test(w.message)));
  // a ratio outside 1:10 to 10:1
  const off = ph('CH3COOH 0,1 mol/L; CH3COONa 0,0005 mol/L');
  assert.ok(off.warnings.some((w) => /Henderson/.test(w.message)));
});

test('mixtures with volumes: neutralisation', () => {
  close(value('HCl 0,1 mol/L 50 mL; NaOH 0,1 mol/L 50 mL'), 7, 1e-9);
  close(value('HCl 0,1 mol/L 50 mL; NaOH 0,1 mol/L 20 mL'), -Math.log10(0.003 / 0.07), 1e-9);
  close(value('CH3COOH 0,1 mol/L 100 mL; NaOH 0,05 mol/L 100 mL'), 4.76, 0.005);
});

test('the solution is exact: charge balance holds at the answer', () => {
  for (const text of ['CH3COOH; 0,1 mol/L', 'Na2CO3; 0,1 mol/L', 'H3PO4; 0,01 mol/L', 'NH4Cl; 0,5 mol/L']) {
    const r = ph(text);
    const { h, oh, species } = r.chemistry;
    let charge = h - oh;
    for (const sp of species) charge += parseFormula(sp.label).charge * sp.c;
    const spectator = { 'CH3COOH; 0,1 mol/L': 0, 'Na2CO3; 0,1 mol/L': 0.2, 'H3PO4; 0,01 mol/L': 0, 'NH4Cl; 0,5 mol/L': -0.5 }[text];
    close(charge + spectator, 0, 1e-12 * Math.max(1, Math.abs(spectator)));
    // mass balance: the species of one system add up to the total
  }
  const h3 = ph('H3PO4; 0,01 mol/L').chemistry.species.reduce((s, x) => s + x.c, 0);
  close(h3, 0.01, 1e-15);
});

test('the pH rises with the base added: monotonic', () => {
  let previous = -Infinity;
  for (let v = 0; v <= 40; v += 2) {
    const text = `CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L ${v || 0.0001} mL`;
    const p = value(text);
    assert.ok(p > previous, `pH at ${v} mL`);
    previous = p;
  }
});

test('autoprotolysis and temperature', () => {
  assert.equal(kwAt(298.15).Kw, 1e-14);
  assert.equal(kwAt(298.15).pKw, 14);
  close(kwAt(323.15).pKw, 13.26, 1e-9);
  assert.equal(kwAt(300.15).interpolated, true);
  assert.equal(kwAt(303.15).interpolated, false);
  assert.ok(kwAt(373.15).Kw > kwAt(298.15).Kw);
  assert.equal(code(() => kwAt(500)), 'CHEM_OUTSIDE_MODEL');
  // pure water at 50 °C is neutral at pH = pKw/2
  close(value('NaCl; 0,1 mol/L; T=50 °C'), 13.26 / 2, 1e-9);
});

test('distribution fractions add up to one', () => {
  for (const h of [1, 1e-3, 1e-7, 1e-11, 1e-14]) {
    const a = fractions(h, [2.15, 7.2, 12.35]);
    close(a.reduce((s, x) => s + x, 0), 1, 1e-12);
    a.forEach((x) => assert.ok(x >= 0 && x <= 1));
  }
  const half = fractions(10 ** -4.76, [4.76]);
  close(half[0], 0.5, 1e-12);
  assert.equal(fractions(1e-3, [1.99], true)[0], 0, 'a strong first stage is gone');
  assert.equal(formatFormula(deprotonated(parseFormula('CH3COOH'), 1), 'unicode'), 'CH₃COO⁻');
  assert.equal(formatFormula(deprotonated(parseFormula('H3PO4'), 2), 'unicode'), 'HPO₄²⁻');
});

test('errors and warnings', () => {
  assert.equal(code(() => ph('')), 'CHEM_SYNTAX');
  assert.equal(code(() => ph('Xy2; 0,1 mol/L')), 'CHEM_UNKNOWN_ELEMENT');
  assert.equal(code(() => ph('Nichtsda; 0,1 mol/L')), 'CHEM_UNKNOWN_SUBSTANCE');
  assert.equal(code(() => ph('HCl; 0,1 g')), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => ph('C6H12O6; 0,1 mol/L')), 'CHEM_DATA_UNAVAILABLE');
  assert.equal(code(() => ph('CH3COOH; 0,1 mol/L; pKa=4,76; pKb=4')), 'CHEM_SYNTAX');
  assert.equal(code(() => ph('HCl; -0,1 mol/L')), 'CHEM_NEGATIVE_CONCENTRATION');
  assert.ok(ph('CH3COOH; 0,1 mol/L; T=50 °C').warnings.some((w) => /25 °C/.test(w.message)));
  assert.ok(ph('FeCl3; 0,1 mol/L').warnings.some((w) => /Hydrolyse/.test(w.message)));
  const r = ph('CH3COOH; 0,001 mol/L');
  assert.ok(r.steps.some((step) => step.label === 'Ladungsbilanz (exakt)'));
  assert.match(toText(r), /pH = -lg c\(H3O\+\)/);
});

test('through the command language with the short names', () => {
  const r = runChemistry({ text: 'pH(CH3COOH; 0,1 mol/L)' }, new Set());
  assert.equal(r.ok, true);
  close(r.chemResult.result.value, 2.8829, 1e-3);
  const o = runChemistry({ text: 'pOH(NaOH; 0,01 mol/L)' }, new Set());
  close(o.chemResult.result.value, 2, 1e-9);
  const ka = runChemistry({ text: 'Ka(CH3COOH)' }, new Set());
  close(ka.chemResult.result.value, 10 ** -4.76, 1e-12);
  const kb = runChemistry({ text: 'Kb(CH3COO-)' }, new Set());
  close(kb.chemResult.result.value, 10 ** -(14 - 4.76), 1e-15);
  const pk = runChemistry({ text: 'pKa(H3PO4)' }, new Set());
  close(pk.chemResult.result.value, 2.15, 1e-12);
  const strong = runChemistry({ text: 'Ka(HCl)' }, new Set());
  assert.match(strong.chemResult.result.text, /stark/);
  assert.equal(runChemistry({ text: 'Ka(NH3)' }, new Set()).ok, false);
  close(runChemistry({ text: 'oxonium(pH=3)' }, new Set()).chemResult.result.value, 1e-3, 1e-15);
});

test('solveSolution needs no chemistry data: a bare charge balance', () => {
  // 1e-3 mol/L of a monoprotic acid with pKa 3 and 1e-3 mol/L Na⁺ as spectator
  const top = parseFormula('CH3COOH');
  const r = solveSolution([{ key: 'X', top, z: 0, pKa: [3], C: 1e-3, strongFirst: false, contributions: [{ k: 0, c: 1e-3 }] }], []);
  const Ka = 1e-3;
  const x = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * 1e-3)) / 2;
  close(r.h, x, 1e-10);
});
