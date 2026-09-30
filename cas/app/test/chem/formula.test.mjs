import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFormula, formatFormula, formulaKey, hill, isFormula } from '../../src/chem/formula.js';
import { ChemError } from '../../src/chem/errors.js';

const atoms = (s) => parseFormula(s).atoms;
const code = (s) => {
  try {
    parseFormula(s);
  } catch (e) {
    assert.ok(e instanceof ChemError, `${s}: a ChemError`);
    return e.code;
  }
  return null;
};

test('plain formulas and brackets', () => {
  assert.deepEqual(atoms('H2O'), { H: 2, O: 1 });
  assert.deepEqual(atoms('Ca(OH)2'), { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(atoms('Fe2(SO4)3'), { Fe: 2, S: 3, O: 12 });
  assert.deepEqual(atoms('K4[Fe(CN)6]'), { K: 4, Fe: 1, C: 6, N: 6 });
  assert.deepEqual(atoms('(NH4)2SO4'), { N: 2, H: 8, S: 1, O: 4 });
  assert.deepEqual(atoms('C6H12O6'), { C: 6, H: 12, O: 6 });
});

test('charges written as the school writes them', () => {
  for (const [text, charge] of [['Na+', 1], ['Fe3+', 3], ['Fe^3+', 3], ['SO4^2-', -2], ['SO42-', -2], ['NH4+', 1], ['MnO4-', -1], ['PO4^3-', -3], ['Cr2O7^2-', -2], ['[Cu(NH3)4]2+', 2], ['OH-', -1], ['H3O+', 1], ['Fe³⁺', 3], ['SO₄²⁻', -2], ['NH₄⁺', 1]]) {
    assert.equal(parseFormula(text).charge, charge, text);
  }
  assert.deepEqual(atoms('SO42-'), { S: 1, O: 4 });
  assert.deepEqual(atoms('NH4+'), { N: 1, H: 4 });
});

test('the electron', () => {
  const e = parseFormula('e-');
  assert.equal(e.electron, true);
  assert.equal(e.charge, -1);
  assert.deepEqual(e.atoms, {});
});

test('hydrates count the water', () => {
  for (const text of ['CuSO4·5H2O', 'CuSO4.5H2O', 'CuSO4*5H2O']) {
    assert.deepEqual(atoms(text), { Cu: 1, S: 1, O: 9, H: 10 }, text);
    assert.equal(parseFormula(text).hydrate.length, 1);
  }
  assert.deepEqual(atoms('Na2SO4.10H2O'), { Na: 2, S: 1, O: 14, H: 20 });
});

test('isotopes and phase tags', () => {
  const c13 = parseFormula('13C');
  assert.deepEqual(c13.isotopes, { '13C': 1 });
  assert.deepEqual(c13.atoms, { C: 1 });
  assert.equal(parseFormula('14CO2').isotopes['14C'], 1);
  for (const [text, phase] of [['H2O(l)', 'l'], ['CO2(g)', 'g'], ['NaCl(aq)', 'aq'], ['Fe(s)', 's']]) assert.equal(parseFormula(text).phase, phase, text);
  assert.equal(formulaKey(parseFormula('CO2(g)')), 'CO2');
});

test('the same formula however it was typed has the same key', () => {
  const keys = ['SO4^2-', 'SO42-', 'SO₄²⁻', 'SO4 2-'].map((t) => formulaKey(parseFormula(t)));
  assert.equal(new Set(keys).size, 1);
  assert.equal(formulaKey(parseFormula('H₂O')), 'H2O');
});

test('errors carry stable codes', () => {
  assert.equal(code('Xy2'), 'CHEM_UNKNOWN_ELEMENT');
  assert.equal(code('CL'), 'CHEM_UNKNOWN_ELEMENT');
  assert.equal(code(''), 'CHEM_FORMULA_INVALID');
  assert.equal(code('H2O)'), 'CHEM_FORMULA_INVALID');
  assert.equal(code('(H2O'), 'CHEM_FORMULA_INVALID');
  assert.equal(code('ca'), 'CHEM_FORMULA_INVALID');
  assert.equal(code('H-2'), 'CHEM_FORMULA_INVALID');
  assert.equal(code('Hh2'), 'CHEM_FORMULA_INVALID');
  assert.equal(isFormula('H2SO4'), true);
  assert.equal(isFormula('salz'), false);
});

test('formatting in three styles and Hill order', () => {
  const f = parseFormula('Fe2(SO4)3');
  assert.equal(formatFormula(f, 'text'), 'Fe2(SO4)3');
  assert.equal(formatFormula(f, 'unicode'), 'Fe₂(SO₄)₃');
  assert.equal(formatFormula(f, 'latex'), '\\mathrm{Fe_{2}(SO_{4})_{3}}');
  assert.equal(formatFormula(parseFormula('SO4^2-'), 'unicode'), 'SO₄²⁻');
  assert.equal(formatFormula(parseFormula('Fe3+'), 'latex'), '\\mathrm{Fe^{3+}}');
  assert.equal(hill(parseFormula('C2H6O')), 'C2H6O');
  assert.equal(hill(parseFormula('H2SO4')), 'H2O4S');
});
