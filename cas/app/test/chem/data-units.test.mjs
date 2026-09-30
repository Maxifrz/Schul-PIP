import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ELEMENTS, findElement, element, atomicMass } from '../../src/chem/elements.js';
import { SUBSTANCES, findSubstance, molarMass, SUBSTANCE_DATA } from '../../src/chem/substances.js';
import { parseFormula } from '../../src/chem/formula.js';
import { convert, parseUnit, isUnit } from '../../src/chem/units.js';
import { Quantity, parseNumber, multiply, divide, addQ } from '../../src/chem/quantity.js';
import { formatNumber, sigFigsOf, roundSig } from '../../src/chem/format.js';
import { COUPLES, REDOX_DATA } from '../../src/chem/electro.js';
import { GAS_DATA } from '../../src/chem/gas.js';
import { ChemError } from '../../src/chem/errors.js';

const json = (name) => JSON.parse(readFileSync(new URL(`../../src/chem/data/${name}.json`, import.meta.url), 'utf8'));
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('all 118 elements, complete and consistent', () => {
  assert.equal(ELEMENTS.length, 118);
  ELEMENTS.forEach((e, i) => {
    assert.equal(e.atomicNumber, i + 1);
    assert.ok(e.symbol && e.name && e.nameDe, `names of ${i + 1}`);
    assert.ok(e.atomicMass > 0, `mass of ${e.symbol}`);
    assert.ok(e.configuration.length > 0);
  });
  assert.equal(new Set(ELEMENTS.map((e) => e.symbol)).size, 118);
  assert.equal(element('Fe').nameDe, 'Eisen');
  assert.equal(findElement('Eisen').symbol, 'Fe');
  assert.equal(findElement(26).symbol, 'Fe');
  assert.equal(findElement('Xx'), undefined);
  assert.equal(element('Fe').configuration, '[Ar] 3d6 4s2');
  assert.equal(element('Cu').configuration, '[Ar] 3d10 4s1');
  assert.equal(element('Cr').configuration, '[Ar] 3d5 4s1');
  assert.equal(element('O').configuration, '[He] 2s2 2p4');
  assert.throws(() => element('Xx'), (e) => e instanceof ChemError && e.code === 'CHEM_UNKNOWN_ELEMENT');
  close(atomicMass('O'), 15.9994);
});

test('data files carry version, source and reference', () => {
  for (const name of ['elements', 'substances', 'redox', 'gases', 'isotopes']) {
    const d = json(name);
    assert.match(d.version, /^\d{4}\.\d+$/, `${name} version`);
    assert.ok(d.source && d.source.length > 20, `${name} source`);
  }
  assert.ok(SUBSTANCE_DATA.reference && REDOX_DATA.reference && GAS_DATA.reference);
});

test('the substance database is consistent', () => {
  const raw = json('substances').substances;
  assert.equal(new Set(raw.map((s) => s.formula)).size, raw.length, 'no formula twice');
  assert.equal(SUBSTANCES.length, raw.length);
  assert.ok(SUBSTANCES.length >= 200);
  for (const s of SUBSTANCES) {
    assert.ok(s.name, s.formula);
    if (s.ions) {
      let charge = 0;
      const atoms = {};
      for (const ion of s.ions) {
        const p = parseFormula(ion.formula);
        charge += ion.n * p.charge;
        for (const [el, n] of Object.entries(p.atoms)) atoms[el] = (atoms[el] || 0) + ion.n * n;
      }
      if (s.category !== 'ion') {
        assert.equal(charge, s.parsed.charge, `${s.formula}: ions carry the charge`);
        for (const el of new Set([...Object.keys(atoms), ...Object.keys(s.parsed.atoms)])) assert.equal(atoms[el] || 0, s.parsed.atoms[el] || 0, `${s.formula}: ${el}`);
      }
    }
    if (s.ksp) assert.ok(s.ksp.value > 0 && s.ions, `${s.formula} ksp`);
    for (const t of Object.values(s.thermo || {})) assert.ok([t.dfH, t.dfG, t.S].every(Number.isFinite), `${s.formula} thermo`);
    const pKa = s.acidBase && s.acidBase.pKa;
    if (pKa) {
      const known = pKa.filter((x) => x !== null);
      known.forEach((x, i) => i && assert.ok(x > known[i - 1], `${s.formula}: pKa rises`));
    }
  }
  // elements in their standard state have zero formation data
  for (const f of ['H2', 'O2', 'N2', 'Fe', 'Cu']) assert.equal(findSubstance(f).thermo[findSubstance(f).phase].dfH, 0, f);
  assert.equal(findSubstance('Salzsäure').formula, 'HCl');
  assert.equal(findSubstance('Wasser').formula, 'H2O');
  assert.equal(findSubstance('Nichtsda'), null);
});

test('the redox series and the gas constants are usable', () => {
  assert.ok(COUPLES.length >= 45);
  const zn = COUPLES.find((c) => c.pair === 'Zn2+/Zn');
  assert.equal(zn.E0, -0.76);
  assert.equal(zn.n, 2);
  assert.ok(COUPLES.every((c) => c.n >= 1 && c.oxidized.length && c.reduced.length));
  for (const [gas, [a, b]] of Object.entries(json('gases').gases)) assert.ok(a > 0 && b > 0, gas);
});

test('molar masses', () => {
  close(molarMass(parseFormula('H2SO4')).value, 98.07948);
  close(molarMass(parseFormula('NaCl')).value, 58.44277, 1e-6);
  close(molarMass(parseFormula('CuSO4.5H2O')).value, 249.686, 1e-6);
  close(molarMass(parseFormula('SO4^2-')).value, 96.0636, 1e-6);
  close(molarMass(parseFormula('13C')).value, 13.00335, 1e-6);
});

test('units: conversions and dimension checks', () => {
  close(convert(250, 'mL', 'L'), 0.25);
  close(convert(1, 'L', 'mL'), 1000);
  close(convert(1, 'M', 'mol/L'), 1);
  close(convert(0.5, 'mol/L', 'mmol/L'), 500);
  close(convert(25, '°C', 'K'), 298.15);
  close(convert(298.15, 'K', '°C'), 25);
  close(convert(1, 'atm', 'kPa'), 101.325);
  close(convert(1, 'bar', 'Pa'), 1e5);
  close(convert(1, 'kJ', 'J'), 1000);
  close(convert(1, 'kcal', 'kJ'), 4.184);
  close(convert(1, 'kJ/mol', 'J/mol'), 1000);
  close(convert(2, 'h', 'min'), 120);
  close(convert(1, 'cm3', 'mL'), 1);
  close(convert(1, 'g/mol', 'kg/mol'), 0.001);
  close(convert(0.01, '1/s', '1/min'), 0.6);
  assert.equal(isUnit('mol·L^-1'), true);
  assert.equal(isUnit('J/(mol·K)'), true);
  assert.equal(isUnit('gramm'), false);
  for (const [v, a, b] of [[1, 'g', 'mL'], [1, 'mol', 'L'], [1, 'K', 'J'], [1, 'bar', 'm']]) {
    assert.throws(() => convert(v, a, b), (e) => e instanceof ChemError && e.code === 'CHEM_UNIT_MISMATCH', `${a} → ${b}`);
  }
  assert.throws(() => parseUnit('lightyear'), (e) => e.code === 'CHEM_UNIT_MISMATCH');
});

test('quantities check dimensions', () => {
  const n = new Quantity(2, 'mol');
  const V = new Quantity(500, 'mL');
  const c = divide(n, V, 'mol/L');
  close(c.value, 4);
  assert.equal(c.unit, 'mol/L');
  assert.throws(() => addQ(n, V), (e) => e.code === 'CHEM_UNIT_MISMATCH');
  assert.throws(() => divide(n, V, 'g'), (e) => e.code === 'CHEM_UNIT_MISMATCH');
  close(multiply(c, V, 'mol').value, 2);
  assert.equal(n.is('amount'), true);
  assert.throws(() => n.need('mass', 'Masse'), (e) => e.code === 'CHEM_UNIT_MISMATCH');
  const q = Quantity.parse('0,1 mol/L');
  close(q.value, 0.1);
  assert.equal(q.sigFigs, 1);
  const { quantity, rest } = Quantity.parseWithRest('10 g Fe');
  assert.equal(quantity.unit, 'g');
  assert.equal(rest, 'Fe');
  assert.equal(parseNumber('1,8·10^-5'), 1.8e-5);
  assert.equal(parseNumber('1.5e-3'), 0.0015);
  assert.equal(parseNumber('abc'), null);
  assert.throws(() => Quantity.parse('10 Fe'), (e) => e instanceof ChemError);
  assert.throws(() => new Quantity(NaN, 'g'), (e) => e.code === 'CHEM_NO_SOLUTION');
});

test('number formatting keeps full precision inside, rounds only for display', () => {
  assert.equal(formatNumber(98.07948, { sig: 5 }), '98,079');
  assert.equal(formatNumber(0.000123456, { sig: 3 }), '1,23·10⁻⁴');
  assert.equal(formatNumber(6.02214076e23, { sig: 4 }), '6,022·10²³');
  assert.equal(formatNumber(0, {}), '0');
  assert.equal(formatNumber(-2.5, { sig: 2 }), '−2,5');
  assert.equal(formatNumber(12.3456, { decimals: 2 }), '12,35');
  assert.equal(formatNumber(1234.5, { sig: 5, style: 'latex' }), '1234{,}5');
  assert.equal(formatNumber(1.5e-5, { sig: 4, style: 'latex' }), '1{,}5\\cdot10^{-5}');
  assert.equal(formatNumber(NaN, {}), '–');
  assert.equal(sigFigsOf('5,0'), 2);
  assert.equal(sigFigsOf('0,0250'), 3);
  assert.equal(sigFigsOf('5,000'), 4);
  assert.equal(sigFigsOf('1,5e-3'), 2);
  assert.equal(roundSig(123456, 3), 123000);
  // the value itself is never changed by displaying it
  const v = 98.07948;
  formatNumber(v, { sig: 3 });
  assert.equal(v, 98.07948);
});
