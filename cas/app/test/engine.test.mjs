import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadGiac } from './giac.mjs';
import { Engine } from '../src/engine.js';
import { COMMANDS } from '../src/commands.js';

const cas = await loadGiac();
const engine = new Engine(cas);
const run = (text) => engine.evaluate({ text });
const latex = (text) => {
  const r = run(text);
  assert.ok(r.ok, text + ': ' + r.error);
  return r.latex;
};

after(() => setImmediate(() => process.exit(0)));

test('every example in the command catalog works', () => {
  const failed = [];
  for (const c of COMMANDS.filter((c) => !c.noExample)) {
    const r = run(c.example);
    if (!r.ok) failed.push(`${c.name}: ${c.example} → ${r.error}`);
  }
  assert.deepEqual(failed, []);
});

test('German commands answer in school notation', () => {
  assert.equal(latex('löse(x^2-5x+6=0, x)'), 'L=\\left\\{2;\\ 3\\right\\}');
  assert.equal(latex('löse(x^2-4<0, x)'), 'L=\\left]-2;\\ 2\\right[');
  assert.equal(latex('löse([x+y=3, x-y=1], [x, y])'), 'L=\\left\\{\\left(2;\\ 1\\right)\\right\\}');
  assert.equal(latex('ableiten(x^3)'), '3x^{2}');
  assert.equal(latex('integriere(x^2, x, 0, 3)'), '9');
  assert.equal(latex('faktorisiere(x^2-1)'), '\\left(x-1\\right)\\left(x+1\\right)');
  assert.equal(latex('wurzel(72)'), '6\\sqrt{2}');
  assert.equal(latex('tangente(x^2, 1)'), '2x-1');
  assert.equal(latex('istprim(97)'), '\\text{wahr}');
  assert.equal(latex('determinante([[1,2],[3,4]])'), '-2');
  assert.equal(latex('lichtgeschwindigkeit'), '299792458\\,\\mathrm{m\\cdot s^{-1}}');
});

test('definitions carry over and are reported', () => {
  const f = run('f(x) = x^2 - 4');
  assert.equal(f.kind, 'definition');
  assert.equal(f.latex, 'f\\left(x\\right)=x^{2}-4');
  assert.equal(latex('f(3)'), '5');
  assert.equal(run('a = 5').latex, 'a=5');
  assert.equal(latex('a*f(1)'), '-15');
  assert.deepEqual(engine.definitions.map((d) => d.name), ['f', 'a']);
});

test('formula editor input', () => {
  const r = engine.evaluate({ latex: '\\operatorname{löse}\\left(x^2=9,x\\right)' });
  assert.equal(r.latex, 'L=\\left\\{-3;\\ 3\\right\\}');
  const typed = engine.evaluate({ latex: 'nullstellen\\left(x^3-x\\right)' });
  assert.equal(typed.latex, 'L=\\left\\{-1;\\ 0;\\ 1\\right\\}');
  assert.equal(engine.evaluate({ latex: '\\frac{1}{3}+\\frac{1}{4}' }).latex, '\\frac{7}{12}');
  assert.equal(engine.evaluate({ latex: '\\int_0^1x^2\\,dx' }).latex, '\\frac{1}{3}');
});

test('curve sketching', () => {
  const r = run('kurvendiskussion(x^3-3x)');
  assert.equal(r.kind, 'analysis');
  const row = (label) => r.rows.find((x) => x.label === label)?.latex;
  assert.equal(row('Definitionsmenge'), '\\mathbb{D}=\\mathbb{R}');
  assert.match(row('Symmetrie'), /punktsymmetrisch/);
  assert.match(row('Nullstellen'), /x=0/);
  assert.match(row('Extrempunkte'), /H\\left\(-1\\,\\middle\|\\,2\\right\).*Hochpunkt/);
  assert.match(row('Extrempunkte'), /T\\left\(1\\,\\middle\|\\,-2\\right\).*Tiefpunkt/);
  assert.match(row('Wendepunkte'), /W\\left\(0\\,\\middle\|\\,0\\right\)/);
  assert.match(row('Monotonie'), /fallend auf \} \\left\]-1;\\ 1\\right\[/);
  const saddle = run('wendepunkte(x^3)');
  assert.match(saddle.rows[0].latex, /Sattelpunkt/);
  const asymptotes = run('asymptoten((2x^2+1)/(x-1))');
  assert.match(asymptotes.rows[0].latex, /x=1.*senkrechte Asymptote/);
  assert.match(asymptotes.rows[0].latex, /y=2x\+2.*schiefe Asymptote/);
  const domain = run('definitionsmenge(ln(x-2))');
  assert.equal(domain.rows[0].latex, '\\mathbb{D}=\\left]2;\\ \\infty\\right[');
  run('g(x) = 1/(x^2-1)');
  const named = run('definitionsmenge(g)');
  assert.equal(named.rows[0].latex, '\\mathbb{D}=\\mathbb{R}\\setminus\\left\\{-1;\\ 1\\right\\}');
});

test('Giac commands with long names are calls, not products', async () => {
  const engine = new Engine(await loadGiac());
  const r = engine.evaluate({ text: 'eigenvals([[2,0],[0,3]])' });
  assert.ok(r.ok, r.error);
  assert.match(r.latex, /3/);
  assert.equal(engine.evaluate({ text: '20%*150' }).latex, '30');
});
