import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHEM_COMMANDS, CHEM_CATALOG, runChemistry, chemCommand, substituteChemistry } from '../../src/chem/commands.js';
import { parseChemicalIntent } from '../../src/chem/intent.js';
import { chemLatexToText } from '../../src/chem/latex.js';
import { CODES, ChemError } from '../../src/chem/errors.js';
import { ChemicalResult, toRows, toText, errorResult, L } from '../../src/chem/result.js';

const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));
const none = new Set();

test('golden cases', () => {
  for (const c of golden.cases) {
    const r = runChemistry({ text: c.input }, none);
    assert.ok(r, `${c.input}: the chemistry engine answers`);
    if (c.code) {
      assert.equal(r.ok, false, `${c.input}: is an error`);
      assert.equal(r.code, c.code, c.input);
      assert.ok(r.error && /[a-zäöü]/i.test(r.error), `${c.input}: a German message`);
      for (const t of c.text || []) assert.ok(r.error.includes(t), `${c.input}: ${t}`);
      continue;
    }
    assert.equal(r.ok, true, `${c.input}: ${r.error}`);
    const res = r.chemResult.result;
    if (c.equation) assert.equal(res.equation, c.equation, c.input);
    if (c.value !== undefined) {
      assert.ok(Math.abs(res.value - c.value) <= c.tolerance, `${c.input}: ${res.value} vs ${c.value} ± ${c.tolerance}`);
      if (c.unit) assert.equal(res.unit, c.unit, c.input);
    }
    for (const t of c.text || []) assert.ok(toText(r.chemResult).includes(t), `${c.input}: text has ${t}`);
    // every result has the standard shape
    const j = r.chem;
    for (const key of ['type', 'ok', 'result', 'steps', 'warnings', 'assumptions', 'sources']) assert.ok(key in j, `${c.input}: ${key}`);
    assert.ok(Array.isArray(j.steps) && Array.isArray(j.warnings));
  }
});

test('every command of the catalog runs its own example and is documented', () => {
  assert.ok(CHEM_COMMANDS.length >= 50);
  const seen = new Set();
  for (const c of CHEM_COMMANDS) {
    assert.ok(c.name && c.syntax && c.text.length > 20 && c.example, c.name);
    assert.ok(!seen.has(c.name), `${c.name} once`);
    seen.add(c.name);
    const r = runChemistry({ text: c.example }, none);
    assert.ok(r && r.ok, `${c.name}: ${c.example} → ${r && r.error}`);
    assert.ok(r.title && r.rows.length >= 1, `${c.name}: title and rows`);
    assert.equal(chemCommand(c.name).name, c.name);
    for (const a of c.aliases || []) assert.equal(chemCommand(a).name, c.name, a);
  }
  assert.equal(CHEM_CATALOG.length, CHEM_COMMANDS.length);
  assert.ok(CHEM_CATALOG.every((c) => c.cat === 'Chemie' && c.chem === true && !('run' in c)));
  // the German command names the brief asks for
  for (const name of ['molmasse', 'ausgleichen', 'stöchiometrie', 'limitierenderstoff', 'zellspannung', 'redox', 'titration', 'gleichgewicht']) assert.ok(chemCommand(name), name);
  for (const short of ['M', 'n', 'm', 'c', 'V', 'pH', 'Ka', 'Kb', 'Ksp', 'E0', 'E°', 'dH', 'ΔH', 'ΔG', 'deltaH']) assert.ok(chemCommand(short), short);
});

test('short names and the mathematics: what belongs to whom', () => {
  // a defined name is a product, not a command
  assert.equal(runChemistry({ text: 'M(H2SO4)' }, new Set(['M'])), null);
  assert.equal(runChemistry({ text: 'n(3)' }, none), null);
  assert.equal(runChemistry({ text: 'f(x)' }, none), null);
  assert.equal(runChemistry({ text: 'x^2 - 4 = 0' }, none), null);
  assert.equal(runChemistry({ text: 'löse(x^2=4, x)' }, none), null);
  assert.equal(runChemistry({ text: '2 + 3' }, none), null);
  assert.equal(runChemistry({ text: 'sin(3)' }, none), null);
  assert.equal(runChemistry({ text: '' }, none), null);
  assert.equal(runChemistry({ latex: '\\frac{1}{2}+\\frac{1}{3}' }, none), null);
  // "M(x)" for the molar mass of nothing sensible falls back to mathematics
  assert.equal(runChemistry({ text: 'c(t)' }, none), null);
  assert.equal(runChemistry({ text: 'm(5)' }, none), null);
  // a long chemistry name never falls back: the error is shown
  const r = runChemistry({ text: 'molmasse(x)' }, none);
  assert.equal(r.ok, false);
});

test('chemistry inside a calculation is substituted by its number', () => {
  const s = substituteChemistry('2*M(NaCl) + 1', none);
  assert.equal(s.parts.length, 1);
  assert.equal(s.parts[0].unit, 'g/mol');
  assert.match(s.text, /^2\*\(58\.44/);
  assert.equal(substituteChemistry('x^2 + 1', none), null);
  assert.equal(substituteChemistry('M(x) + 1', none), null);
  assert.equal(substituteChemistry('M(NaCl)', new Set(['M'])), null);
  const two = substituteChemistry('molmasse(H2O) + molmasse(CO2)', none);
  assert.equal(two.parts.length, 2);
});

test('formula editor LaTeX becomes chemistry text', () => {
  const cases = {
    '\\operatorname{molmasse}\\left(H_2SO_4\\right)': 'molmasse(H2SO4)',
    '\\operatorname{ausgleichen}\\left(Fe+O_2\\rightarrow Fe_2O_3\\right)': 'ausgleichen(Fe+O2 -> Fe2O3)',
    'N_2+3H_2\\rightleftharpoons2NH_3': 'N2+3H2 <=> 2NH3',
    'SO_4^{2-}': 'SO4^2-',
    '\\mathrm{pH}\\left(\\mathrm{HCl};0{,}1\\,\\mathrm{mol/L}\\right)': 'pH(HCl;0,1 mol/L)',
    'K_a=1{,}8\\cdot10^{-5}': 'Ka=1,8·10^-5',
    'p=1\\mathrm{bar};T=25^\\circ C': 'p=1bar;T=25°C',
    '\\Delta H\\left(x\\right)': 'ΔH(x)',
  };
  for (const [latex, text] of Object.entries(cases)) assert.equal(chemLatexToText(latex), text, latex);
  const r = runChemistry({ latex: '\\operatorname{molmasse}\\left(H_2SO_4\\right)' }, none);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.chemResult.result.value - 98.079) < 0.001);
  const b = runChemistry({ latex: 'Fe+O_2\\rightarrow Fe_2O_3' }, none);
  assert.equal(b.chemResult.result.equation, '4 Fe + 3 O2 -> 2 Fe2O3');
  const p = runChemistry({ latex: '\\mathrm{pH}\\left(\\mathrm{HCl};0{,}1\\,\\mathrm{mol/L}\\right)' }, none);
  assert.ok(Math.abs(p.chemResult.result.value - 1) < 1e-9);
  const e = runChemistry({ latex: 'E^{\\circ}\\left(Zn\\right)' }, none);
  assert.equal(e.chemResult.result.value, -0.76);
  const dh = runChemistry({ latex: '\\Delta H\\left(N_2+3H_2\\rightarrow 2NH_3\\right)' }, none);
  assert.ok(Math.abs(dh.chemResult.result.value + 92.22) < 0.01);
});

test('input typed in the formula editor: fractions for units, no spaces', () => {
  // MathLive turns "mol/L" into a fraction and swallows spaces inside brackets
  assert.equal(chemLatexToText('\\mathrm{pH}\\left(HCl;0,\\frac{01mol}{L}\\right)'), 'pH(HCl;0,01mol/L)');
  assert.equal(chemLatexToText('\\frac{\\mathrm{mol}}{\\mathrm{L}}'), 'mol/L');
  assert.equal(chemLatexToText('\\sqrt{2}', { strict: true }), null);
  assert.equal(chemLatexToText('M\\left(H2O\\right)\\cdot2', { strict: true }), 'M(H2O)·2');
  const p = runChemistry({ latex: 'pH\\left(HCl;0,\\frac{01mol}{L}\\right)' }, none);
  assert.ok(p.ok, p.error);
  assert.ok(Math.abs(p.chemResult.result.value - 2) < 1e-9);
  const n = runChemistry({ latex: 'n\\left(NaCl;10g\\right)' }, none);
  assert.ok(Math.abs(n.chemResult.result.value - 10 / 58.44276928) < 1e-9);
  const st = runChemistry({ text: 'stöchiometrie(2H2+O2->2H2O;4gH2;32gO2)' }, none);
  assert.ok(st.ok, st.error);
  assert.deepEqual(st.chemResult.stoich.limiting, ['H2']);
  const r = runChemistry({ latex: 'redox\\left(MnO4-+Fe2+\\to Mn2++Fe3+\\right)' }, none);
  assert.equal(r.chemResult.result.equation, 'MnO4- + 5 Fe^2+ + 8 H+ -> Mn^2+ + 5 Fe^3+ + 4 H2O');
});

test('German sentences become commands; nothing is calculated by the parser', () => {
  const cases = [
    ['Molare Masse von Schwefelsäure', 'molarMass', 'molmasse(Schwefelsäure)'],
    ['Wie viel mol sind 10 g NaCl?', 'amount', 'n(NaCl; 10 g)'],
    ['Wie viel Gramm sind 0,5 mol H2O?', 'mass', 'm(H2O; 0,5 mol)'],
    ['Gleiche Fe + O2 -> Fe2O3 aus', 'balance', 'ausgleichen(Fe + O2 -> Fe2O3)'],
    ['Berechne den pH-Wert einer 0,1 M Essigsäure', 'pH', 'pH(Essigsäure 0,1 M)'],
    ['pH einer 0,01 mol/L HCl-Lösung', 'pH', 'pH(HCl 0,01 mol/L)'],
    ['Titration von CH3COOH 0,1 mol/L 25 mL mit NaOH 0,1 mol/L', 'titration', 'titration(CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L)'],
    ['Zellspannung von Zn und Cu', 'cell', 'zellspannung(Zn; Cu)'],
    ['Löslichkeit von AgCl', 'solubility', 'löslichkeit(AgCl)'],
    ['Oxidationszahl von Mn in KMnO4', 'oxidationNumber', 'oxidationszahl(KMnO4; Mn)'],
    ['Wie viel Volumen haben 2 mol H2', 'volume', 'V(H2; 2 mol)'],
  ];
  for (const [text, intent, command] of cases) {
    const r = parseChemicalIntent(text);
    assert.equal(r.intent, intent, text);
    assert.equal(r.command, command, text);
  }
  const stoich = parseChemicalIntent('Wie viel NH3 entsteht aus 28 g N2 und 10 g H2? N2 + 3 H2 -> 2 NH3');
  assert.equal(stoich.intent, 'stoichiometry');
  assert.deepEqual(stoich.args.givens, ['28 g N2', '10 g H2']);
  assert.equal(stoich.args.wanted, 'NH3');
  for (const text of ['Wie ist das Wetter?', 'x^2 = 4', '', 'Ich mag Chemie']) assert.equal(parseChemicalIntent(text).intent, 'unknown', text);
  // a sentence goes all the way through the engine hook
  const r = runChemistry({ text: 'Wie viel mol sind 10 g NaCl?' }, none);
  assert.ok(r.ok && r.understood === 'n(NaCl; 10 g)');
  assert.ok(Math.abs(r.chemResult.result.value - 10 / 58.44276928) < 1e-9);
  assert.equal(runChemistry({ text: 'Wie ist das Wetter?' }, none), null);
});

test('the result object and its rows', () => {
  const res = new ChemicalResult('demo', 'Demo').answer({ text: 'ja' }).step('Erst', L('a', 'a')).warn('CHEM_OUTSIDE_MODEL', 'Vorsicht').assume('Annahme 1').source('Quelle 1');
  res.assume('Annahme 1');
  assert.equal(res.assumptions.length, 1, 'no duplicate assumptions');
  const rows = toRows(res);
  assert.deepEqual(rows.map((r) => r.label), ['Ergebnis', 'Erst', 'Achtung', 'Annahme', 'Quelle']);
  assert.equal(toRows(res, { steps: false }).length, 4);
  assert.match(toText(res), /Demo\nja\na\nAchtung: Vorsicht/);
  const json = res.toJSON();
  assert.deepEqual(Object.keys(json).sort(), ['assumptions', 'ok', 'result', 'sources', 'steps', 'table', 'type', 'values', 'warnings']);
  const err = errorResult(new ChemError('CHEM_NO_SOLUTION', 'Nichts.'));
  assert.deepEqual(err, { ok: false, code: 'CHEM_NO_SOLUTION', error: 'Nichts.' });
  assert.equal(errorResult(new Error('x')).code, 'CHEM_SYNTAX');
});

test('every error code has a German message', () => {
  for (const code of ['CHEM_FORMULA_INVALID', 'CHEM_UNKNOWN_ELEMENT', 'CHEM_UNKNOWN_SUBSTANCE', 'CHEM_INVALID_CHARGE', 'CHEM_UNIT_MISMATCH', 'CHEM_NO_SOLUTION', 'CHEM_MULTIPLE_SOLUTIONS', 'CHEM_NEGATIVE_CONCENTRATION', 'CHEM_UNBALANCED_REACTION', 'CHEM_MISSING_CONSTANT', 'CHEM_OUTSIDE_MODEL', 'CHEM_DATA_UNAVAILABLE']) {
    assert.ok(CODES[code] && CODES[code].endsWith('.'), code);
    assert.equal(new ChemError(code).message, CODES[code]);
  }
});
