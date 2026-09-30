// The chemistry engine inside the calculator's engine, with Giac: chemistry commands, chemistry in calculations, and
// the mathematics untouched by the new commands.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadGiac } from './giac.mjs';
import { Engine } from '../src/engine.js';
import { COMMANDS, command } from '../src/commands.js';

const cas = await loadGiac();
const engine = new Engine(cas);
const run = (text) => engine.evaluate({ text });
const runLatex = (latex) => engine.evaluate({ latex });

after(() => setImmediate(() => process.exit(0)));

test('chemistry commands answer as analysis results with steps', () => {
  const r = run('molmasse(H2SO4)');
  assert.equal(r.ok, true, r.error);
  assert.equal(r.kind, 'analysis');
  assert.match(r.rows[0].latex, /98\{,\}079/);
  assert.ok(r.steps.length >= 2);
  assert.ok(r.chem.steps.length === r.steps.length);
  const b = run('Fe + O2 -> Fe2O3');
  assert.equal(b.chem.result.equation, '4 Fe + 3 O2 -> 2 Fe2O3');
  const p = run('pH(HCl; 0,01 mol/L)');
  assert.match(p.rows[0].latex, /\\mathrm\{pH\} = 2/);
  assert.equal(run('molmasse(Xy2)').ok, false);
  assert.equal(run('molmasse(Xy2)').code, 'CHEM_UNKNOWN_ELEMENT');
});

test('a titration curve carries its plot shapes', () => {
  const r = run('titration(CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L)');
  assert.equal(r.ok, true, r.error);
  assert.ok(r.shapes && r.shapes.lines.length >= 2);
  assert.ok(r.table.rows.length >= 5);
});

test('chemistry inside calculations goes on with the number', () => {
  const r = run('2*M(NaCl)');
  assert.equal(r.ok, true, r.error);
  assert.match(r.latex, /116\{?,?\}?8855/);
  assert.equal(r.chemParts[0].unit, 'g/mol');
  const d = run('m = 10/M(NaCl)');
  assert.equal(d.ok, true, d.error);
  assert.equal(d.kind, 'definition');
  assert.match(run('m*2').latex, /0\{,\}3422/);
  engine.forget('m');
});

test('names the student defines are not taken away', () => {
  assert.equal(run('M = 5').kind, 'definition');
  const r = run('M(2)');
  assert.equal(r.ok, true, r.error);
  assert.notEqual(r.kind, 'analysis');
  engine.forget('M');
  assert.equal(run('n(NaCl; 10 g)').kind, 'analysis');
  run('c(t) = t^2 + 1');
  assert.equal(run('c(2)').latex, '5');
  engine.forget('c');
});

test('mathematics is untouched', () => {
  assert.equal(run('löse(x^2-5x+6=0, x)').latex, 'L=\\left\\{2;\\ 3\\right\\}');
  assert.equal(run('ableiten(x^3)').latex, '3x^{2}');
  assert.equal(run('integriere(x^2, x, 0, 3)').latex, '9');
  assert.equal(run('2+3*4').latex, '14');
  assert.equal(run('x^2 = 4').ok, true);
  assert.equal(run('n(5)').ok, true);
  assert.equal(run('E = 2').kind, 'definition');
  engine.forget('E');
  assert.equal(run('a = 3').kind, 'definition');
  assert.equal(run('a*Ka').ok, true);
  engine.forget('a');
});

test('formula editor input reaches the chemistry engine', () => {
  const r = runLatex('\\operatorname{molmasse}\\left(H_2SO_4\\right)');
  assert.equal(r.ok, true, r.error);
  assert.match(r.rows[0].latex, /98\{,\}079/);
  const b = runLatex('Fe+O_2\\rightarrow Fe_2O_3');
  assert.equal(b.chem.result.equation, '4 Fe + 3 O2 -> 2 Fe2O3');
  assert.equal(runLatex('\\frac{1}{3}+\\frac{1}{4}').latex, '\\frac{7}{12}');
});

test('chemistry in a calculation typed in the formula editor', () => {
  const r = runLatex('M\\left(H2O\\right)\\cdot2');
  assert.equal(r.ok, true, r.error);
  assert.match(r.latex, /36\{,\}03056/);
  assert.equal(r.chemParts[0].unit, 'g/mol');
  // mathematics with other commands is not turned into text
  assert.equal(runLatex('\\sqrt{4}+2').latex, '4');
  assert.equal(runLatex('\\frac{1}{2}\\cdot 4').latex, '2');
});

test('the catalog: chemistry commands are found by search and do not shadow mathematics', () => {
  const chem = COMMANDS.filter((c) => c.chem);
  assert.ok(chem.length >= 50);
  assert.equal(command('molmasse').chem, true);
  assert.equal(command('verteilung').chem, undefined, 'the statistics command of that name is still the statistics one');
  assert.equal(command('umrechnen').chem, undefined);
  assert.equal(command('volumen').chem, undefined);
  // no name or alias of a chemistry command is also one of the mathematics
  const taken = new Map();
  for (const c of COMMANDS.filter((x) => !x.chem)) for (const n of [c.name, ...(c.aliases || [])]) taken.set(n, c.name);
  for (const c of chem) for (const n of [c.name, ...(c.aliases || [])]) assert.ok(!taken.has(n), `${n} (${c.name}) is also ${taken.get(n)}`);
});

test('the exam mode keeps the chemistry available and blocks nothing by accident', () => {
  assert.equal(run('ausgleichen(H2 + O2 -> H2O)').ok, true);
});
