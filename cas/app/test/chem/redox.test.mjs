import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oxidationNumbers, onText } from '../../src/chem/oxidation.js';
import { balanceRedox, balanceFlexible } from '../../src/chem/redox.js';
import { parseFormula, formulaKey } from '../../src/chem/formula.js';
import { parseReaction, balanceCheck, speciesOf } from '../../src/chem/reaction.js';
import { balance } from '../../src/chem/balance.js';
import { toText } from '../../src/chem/result.js';

const on = (formula) => Object.fromEntries(Object.entries(oxidationNumbers(parseFormula(formula)).numbers).map(([k, v]) => [k, onText(v)]));
const code = (f) => {
  try {
    f();
  } catch (e) {
    return e.code;
  }
  return null;
};

test('oxidation numbers by the school rules', () => {
  assert.deepEqual(on('H2O'), { H: '+1', O: '−2' });
  assert.deepEqual(on('H2O2'), { H: '+1', O: '−1' });
  assert.deepEqual(on('KMnO4'), { K: '+1', O: '−2', Mn: '+7' });
  assert.deepEqual(on('Cr2O7^2-'), { O: '−2', Cr: '+6' });
  assert.deepEqual(on('NH4+'), { H: '+1', N: '−3' });
  assert.deepEqual(on('NO3-'), { O: '−2', N: '+5' });
  assert.deepEqual(on('SO4^2-'), { O: '−2', S: '+6' });
  assert.deepEqual(on('NaH'), { Na: '+1', H: '−1' });
  assert.deepEqual(on('CH4').C, '−4');
  assert.deepEqual(on('CO2').C, '+4');
  assert.deepEqual(on('CO').C, '+2');
  assert.deepEqual(on('C2H5OH').C, '−2');
  assert.deepEqual(on('Fe3O4').Fe, '+8/3');
  assert.deepEqual(on('S2O3^2-').S, '+2');
  assert.deepEqual(on('S2O8^2-').S, '+6');
  assert.deepEqual(on('OF2').O, '+2');
  assert.deepEqual(on('KO2').O, '−1/2');
  assert.deepEqual(on('Na2O2').O, '−1');
  assert.deepEqual(on('Cl2'), { Cl: '0' });
  assert.deepEqual(on('Fe3+'), { Fe: '+3' });
  assert.deepEqual(on('HClO4').Cl, '+7');
  assert.deepEqual(on('SO2Cl2').S, '+6');
  assert.deepEqual(on('CO(NH2)2').C, '+4');
  assert.deepEqual(on('FeS2'), { Fe: '+2', S: '−1' });
});

test('the sum of the oxidation numbers is the charge, for every formula of the database', async () => {
  const { SUBSTANCES } = await import('../../src/chem/substances.js');
  let checked = 0;
  for (const s of SUBSTANCES) {
    let r;
    try {
      r = oxidationNumbers(s.parsed);
    } catch (e) {
      assert.equal(e.code, 'CHEM_OUTSIDE_MODEL', `${s.formula}: only OUTSIDE_MODEL may be thrown`);
      continue;
    }
    const sum = Object.entries(r.numbers).reduce((t, [el, v]) => t + v.toNumber() * s.parsed.atoms[el], 0);
    assert.ok(Math.abs(sum - s.parsed.charge) < 1e-9, `${s.formula}: ${sum} vs ${s.parsed.charge}`);
    checked++;
  }
  assert.ok(checked > 200, `${checked} formulas checked`);
});

test('golden: MnO4- + Fe2+ -> Mn2+ + Fe3+', () => {
  const r = balanceRedox('MnO4- + Fe2+ -> Mn2+ + Fe3+');
  assert.equal(r.result.equation, 'MnO4- + 5 Fe^2+ + 8 H+ -> Mn^2+ + 5 Fe^3+ + 4 H2O');
  assert.equal(r.result.medium, 'acidic');
  assert.equal(r.redox.electrons, 5);
  assert.equal(r.values.Oxidationsmittel.text, 'MnO4-');
  assert.equal(r.values.Reduktionsmittel.text, 'Fe^2+');
  assert.equal(r.redox.half.ox, 'Fe^2+ -> Fe^3+ + e-');
  assert.equal(r.redox.half.red, 'MnO4- + 8 H+ + 5 e- -> Mn^2+ + 4 H2O');
  const labels = r.steps.map((s) => s.label);
  assert.deepEqual(labels.slice(0, 1), ['Oxidationszahlen']);
  assert.ok(labels.includes('Elektronen angleichen'));
});

test('redox equations balanced by half-reactions', () => {
  const cases = {
    'Cr2O7^2- + Fe2+ -> Cr3+ + Fe3+': 'Cr2O7^2- + 6 Fe^2+ + 14 H+ -> 2 Cr^3+ + 6 Fe^3+ + 7 H2O',
    'MnO4- + Cl- -> Mn2+ + Cl2': '2 MnO4- + 10 Cl- + 16 H+ -> 2 Mn^2+ + 5 Cl2 + 8 H2O',
    'Cu + NO3- -> Cu2+ + NO': '3 Cu + 2 NO3- + 8 H+ -> 3 Cu^2+ + 2 NO + 4 H2O',
    'Zn + Cu2+ -> Zn2+ + Cu': 'Zn + Cu^2+ -> Zn^2+ + Cu',
    'H2O2 + I- -> I2 + H2O': 'H2O2 + 2 I- + 2 H+ -> I2 + 2 H2O',
    'MnO4- + H2O2 -> Mn2+ + O2': '2 MnO4- + 5 H2O2 + 6 H+ -> 2 Mn^2+ + 5 O2 + 8 H2O',
    'C2H5OH + Cr2O7^2- -> CH3COOH + Cr3+': '3 C2H5OH + 2 Cr2O7^2- + 16 H+ -> 3 CH3COOH + 4 Cr^3+ + 11 H2O',
    'MnO4- + Mn2+ -> MnO2': '2 MnO4- + 3 Mn^2+ + 2 H2O -> 5 MnO2 + 4 H+',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(balanceRedox(input).result.equation, expected, input);
});

test('basic medium, disproportionation and whole-equation balancing', () => {
  assert.equal(balanceRedox('MnO4- + SO3^2- -> MnO2 + SO4^2-', { medium: 'basic' }).result.equation, '2 MnO4- + 3 SO3^2- + H2O -> 2 MnO2 + 3 SO4^2- + 2 OH-');
  assert.equal(balanceRedox('Cl2 + OH- -> Cl- + ClO3-').result.equation, '3 Cl2 + 6 OH- -> 5 Cl- + ClO3- + 3 H2O');
  assert.equal(balanceRedox('Cl2 + OH- -> Cl- + ClO3-').result.medium, 'basic', 'OH- in the equation means basic');
  assert.equal(balanceRedox('KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2').result.equation, '2 KMnO4 + 16 HCl -> 2 KCl + 2 MnCl2 + 8 H2O + 5 Cl2');
  const half = balanceRedox('MnO4- -> Mn2+');
  assert.equal(half.result.equation, 'MnO4- + 8 H+ + 5 e- -> Mn^2+ + 4 H2O');
  assert.ok(half.assumptions.some((a) => /Teilgleichung/.test(a)));
});

test('the half-reaction route and the whole-equation route give the same equation', () => {
  for (const [skeleton, plain] of [
    ['MnO4- + Fe2+ -> Mn2+ + Fe3+', 'MnO4- + Fe2+ + H+ -> Mn2+ + Fe3+ + H2O'],
    ['Cr2O7^2- + Fe2+ -> Cr3+ + Fe3+', 'Cr2O7^2- + Fe2+ + H+ -> Cr3+ + Fe3+ + H2O'],
    ['Cu + NO3- -> Cu2+ + NO', 'Cu + NO3- + H+ -> Cu2+ + NO + H2O'],
  ]) {
    const byHalves = balanceRedox(skeleton).result.equation;
    const b = balance(plain);
    const parsed = parseReaction(byHalves);
    const key = (f) => formulaKey({ ...f, phase: null });
    const fromHalves = Object.fromEntries([...parsed.reactants, ...parsed.products].map((t) => [key(t.formula), t.coef ? Number(t.coef.n) : 1]));
    speciesOf(b.reaction).forEach((s, i) => assert.equal(fromHalves[key(s.formula)], b.coefficients[i], `${skeleton}: ${key(s.formula)}`));
  }
});

test('every redox result conserves atoms and charge and transfers equal electrons', () => {
  for (const text of ['MnO4- + Fe2+ -> Mn2+ + Fe3+', 'Cr2O7^2- + I- -> Cr3+ + I2', 'Zn + NO3- -> Zn2+ + NH4+', 'Br- + BrO3- -> Br2', 'ClO- -> Cl- + ClO3-', 'S2O3^2- + I2 -> S4O6^2- + I-']) {
    const r = balanceRedox(text);
    const reaction = parseReaction(r.result.equation);
    const check = balanceCheck(reaction);
    assert.equal(check.balanced, true, text);
    assert.ok(Number.isInteger(r.redox ? r.redox.electrons : 1));
  }
});

test('redox errors', () => {
  assert.equal(code(() => balanceRedox('Fe -> O2')), 'CHEM_NO_SOLUTION');
  assert.equal(code(() => balanceRedox('MnO4- + Fe2+ -> Mn2+ + Fe3+', { medium: 'weird' })) === null, true);
  assert.throws(() => balanceRedox('Xy + Fe -> Fe2+'), (e) => e.code === 'CHEM_UNKNOWN_ELEMENT');
  assert.equal(balanceRedox('Fe + O2 -> Fe2O3').assumptions.some((a) => /Medium/.test(a)), false, 'no medium remark without H+ or OH-');
  assert.ok(balanceRedox('MnO4- + Fe2+ -> Mn2+ + Fe3+').assumptions.some((a) => /sauer/.test(a)));
  assert.match(toText(balanceRedox('MnO4- + Fe2+ -> Mn2+ + Fe3+')), /Oxidation × 5, Reduktion × 1/);
  assert.equal(code(() => balanceFlexible([parseFormula('H2O')], [parseFormula('O2')], [])), 'CHEM_NO_SOLUTION');
});
