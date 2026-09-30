import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stoichiometry, stoichiometryFromArgs } from '../../src/chem/stoich.js';
import { splitArgs, parseArgs } from '../../src/chem/args.js';
import { resolve, parseGiven, amountFrom } from '../../src/chem/amounts.js';
import { convertCommand, dilutionFromArgs, unitConversionFromArgs, derive } from '../../src/chem/conversions.js';
import { infoFromArgs } from '../../src/chem/info.js';
import { toText } from '../../src/chem/result.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const run = (text, kind) => stoichiometryFromArgs(splitArgs(text), kind);
const code = (f) => {
  try {
    f();
  } catch (e) {
    return e.code;
  }
  return null;
};

test('golden: molar mass of sulphuric acid', () => {
  const r = infoFromArgs('molarmass', ['H2SO4']);
  assert.equal(r.result.value.toFixed(3), '98.079');
  assert.equal(r.result.unit, 'g/mol');
  assert.match(r.toJSON().steps.map((s) => s.lines[0].text).join(' '), /98,079/);
});

test('argument splitting: semicolons, decimal commas, brackets', () => {
  assert.deepEqual(splitArgs('a; b; c'), ['a', 'b', 'c']);
  assert.deepEqual(splitArgs('NaCl, 0,5 mol'), ['NaCl', '0,5 mol']);
  assert.deepEqual(splitArgs('c=[1, 2, 3]; t=5'), ['c=[1, 2, 3]', 't=5']);
  assert.deepEqual(splitArgs('f(a; b); g'), ['f(a; b)', 'g']);
  assert.deepEqual(splitArgs(''), []);
  const { positional, options } = parseArgs(['H2O', 'T=25 °C', 'm(Fe) = 10 g']);
  assert.deepEqual(positional, ['H2O', 'm(Fe) = 10 g']);
  assert.equal(options.T, '25 °C');
});

test('amounts of substance from every kind of given', () => {
  const sub = (t) => resolve(t);
  close(amountFrom(sub('NaCl'), parseGiven('10 g NaCl').quantities).n, 10 / 58.44276928, 1e-9);
  close(amountFrom(sub('HCl'), parseGiven('0,1 mol/L HCl 50 mL').quantities).n, 0.005);
  close(amountFrom(sub('H2'), parseGiven('2,24 L H2').quantities).n, 0.1, 1e-3);
  close(amountFrom(sub('H2'), parseGiven('24,79 L H2').quantities, { T: 298.15, p: 1e5 }).n, 1, 1e-3);
  close(amountFrom(sub('H2O'), parseGiven('18 mL H2O').quantities).n, 0.9982 * 18 / 18.01528, 1e-9);
  assert.equal(code(() => amountFrom(sub('NaCl'), parseGiven('5 mL NaCl').quantities.slice(0, 0))), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => amountFrom(sub('HCl'), parseGiven('0,1 mol/L HCl').quantities)), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => amountFrom(sub('CaCO3'), parseGiven('5 L CaCO3').quantities.filter((q) => q.is('mass')))), 'CHEM_MISSING_CONSTANT');
  const g = parseGiven('m(Fe) = 10 g');
  assert.equal(g.symbol, 'm');
  assert.equal(g.substance, 'Fe');
  const c = parseGiven('c0(N2) = 1 mol/L');
  assert.equal(c.initial, true);
  assert.equal(parseGiven('HCl: 0,1 mol/L 50 mL').quantities.length, 2);
});

test('stoichiometry: limiting reagent, excess and formed amounts', () => {
  const r = run('2 H2 + O2 -> 2 H2O; 4 g H2; 32 g O2');
  assert.deepEqual(r.stoich.limiting, ['H2']);
  const rows = Object.fromEntries(r.stoich.rows.map((x) => [x.substance, x]));
  close(rows.H2O.changed, 4 / 2.01588, 1e-9);
  close(rows.H2O.mass, (4 / 2.01588) * 18.01528, 1e-9);
  close(rows.O2.end, 32 / 31.9988 - rows.O2.changed, 1e-9);
  assert.ok(rows.O2.end > 0, 'oxygen is in excess');
  // the balanced coefficients were found by the engine
  assert.match(toText(r), /2 H2 \+ O2 -> 2 H2O/);
});

test('stoichiometry: two limiting reagents at once', () => {
  const r = run('2 H2 + O2 -> 2 H2O; 2 mol H2; 1 mol O2');
  assert.deepEqual(r.stoich.limiting.sort(), ['H2', 'O2']);
  close(r.stoich.xi, 1);
});

test('stoichiometry: solutions, wanted substance, yield', () => {
  const s = run('HCl + NaOH -> NaCl + H2O; HCl: 0,1 mol/L 50 mL; NaOH: 0,2 mol/L 20 mL', 'limiting');
  assert.deepEqual(s.stoich.limiting, ['NaOH']);
  close(s.stoich.rows.find((x) => x.substance === 'HCl').end, 0.001);
  const w = run('CaCO3 -> CaO + CO2; 100 g CaCO3; gesucht=m(CaO)');
  close(w.result.value, (100 / 100.0869) * 56.0774, 1e-3);
  assert.equal(w.result.unit, 'g');
  const v = run('CaCO3 -> CaO + CO2; 100 g CaCO3; gesucht=V(CO2)');
  close(v.result.value, ((100 / 100.0869) * 8.314462618 * 273.15) / 101325 * 1000, 1e-6);
  const y = run('N2 + 3 H2 -> 2 NH3; 28 g N2; 10 g H2; 15 g NH3', 'yield');
  const theoretical = (28 / 28.0134) * 2 * 17.03052;
  close(y.result.value, (15 / theoretical) * 100, 1e-3);
  assert.equal(y.result.unit, '%');
});

test('stoichiometry backwards: how much is needed for a product', () => {
  const r = run('Fe + O2 -> Fe2O3; 10 g Fe2O3; gesucht=m(Fe)');
  close(r.result.value, (10 / 159.6882) * 4 / 2 * 55.845, 1e-3);
});

test('stoichiometry errors', () => {
  assert.equal(code(() => run('2 H2 + O2 -> H2O; 4 g H2')), 'CHEM_UNBALANCED_REACTION');
  assert.equal(code(() => run('2 H2 + O2 -> 2 H2O; 4 g N2')), 'CHEM_UNKNOWN_SUBSTANCE');
  assert.equal(code(() => run('2 H2 + O2 -> 2 H2O')), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => run('2 H2 + O2 -> 2 H2O; 4 mol')), 'CHEM_SYNTAX');
  assert.equal(code(() => run('2 H2 + O2 -> 2 H2O; 4 m H2')), 'CHEM_UNIT_MISMATCH');
  assert.equal(code(() => run('N2 + 3 H2 -> 2 NH3; 28 g N2; 10 g H2; 4 g NH3; 5 g NH3', 'yield')), 'CHEM_UNIT_MISMATCH');
  // more product than possible is a warning, not a silent number
  const over = run('N2 + 3 H2 -> 2 NH3; 28 g N2; 10 g H2; 50 g NH3', 'yield');
  assert.ok(over.warnings.length >= 1);
});

test('n, m, c, V of a substance by forward chaining', () => {
  const get = (t, args) => convertCommand(t, splitArgs(args)).result;
  close(get('n', 'NaCl; 10 g').value, 10 / 58.44276928, 1e-9);
  close(get('m', 'NaCl; 0,5 mol').value, 0.5 * 58.44276928, 1e-9);
  close(get('c', 'NaCl; 5 g; 250 mL').value, (5 / 58.44276928) / 0.25, 1e-9);
  close(get('V', 'H2; 0,5 mol').value, 0.5 * 22.414, 1e-3);
  close(get('n', 'HCl; c=0,1 mol/L; V=50 mL').value, 0.005, 1e-12);
  close(get('m', 'HCl; c=0,1 mol/L; V=50 mL').value, 0.005 * 36.4609, 1e-3);
  close(get('V', 'NaOH; 4 g; c=0,5 mol/L').value, (4 / 39.99711) / 0.5, 1e-6);
  close(get('V', 'Wasser; 36 g').value, 36 / 998.2, 1e-6);
  assert.equal(get('n', 'NaCl; 10 g').unit, 'mol');
  assert.equal(code(() => convertCommand('n', ['NaCl'])), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => convertCommand('n', ['NaCl', '10 m'])), 'CHEM_UNIT_MISMATCH');
  assert.equal(code(() => convertCommand('n', ['Xy2', '1 g'])), 'CHEM_UNKNOWN_ELEMENT');
  assert.equal(code(() => convertCommand('n', ['Nichtsda', '1 g'])), 'CHEM_UNKNOWN_SUBSTANCE');
});

test('dilution and unit conversion', () => {
  close(dilutionFromArgs(splitArgs('c1=1 mol/L; V1=10 mL; V2=100 mL')).result.value, 0.1);
  close(dilutionFromArgs(splitArgs('c1=1 mol/L; c2=0,1 mol/L; V2=1 L')).result.value, 0.1);
  assert.equal(code(() => dilutionFromArgs(splitArgs('c1=1 mol/L; V1=10 mL'))), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => dilutionFromArgs(splitArgs('c1=1 mL; V1=10 mL; V2=1 L'))), 'CHEM_UNIT_MISMATCH');
  assert.equal(unitConversionFromArgs(splitArgs('250 mL; L')).result.value, 0.25);
  assert.equal(unitConversionFromArgs(splitArgs('25 °C; K')).result.value, 298.15);
  assert.equal(code(() => unitConversionFromArgs(splitArgs('5 g; mL'))), 'CHEM_UNIT_MISMATCH');
  assert.ok(derive(resolve('NaCl'), { m: 10 }, 'n').steps.length === 1);
});

test('significant digits are noted, never applied inside', () => {
  const r = convertCommand('n', splitArgs('NaCl; 10 g'));
  assert.ok(r.result.value > 0.1711 && r.result.value < 0.1712, 'full precision kept');
  assert.ok(r.steps.some((s) => s.label === 'Signifikante Stellen'));
  assert.match(toText(r), /1 signifikante Stelle|2 signifikante Stellen/);
});
