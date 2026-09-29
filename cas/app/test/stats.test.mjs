import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/stats.js';
import { chartShapes } from '../src/charts.js';
import { Sheet } from '../src/table.js';
import { loadGiac } from './giac.mjs';
import { Engine } from '../src/engine.js';

after(() => setImmediate(() => process.exit(0)));
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('distributions against table values', () => {
  close(S.phi(1.96), 0.9750021048517795, 1e-12);
  close(S.phiInverse(0.975), 1.959963984540054, 1e-9);
  close(S.tCdf(10, 2.228), 0.97499, 1e-5);
  close(S.distribution('t', [10]).quantile(0.975), 2.228138852, 1e-6);
  close(S.chi2Cdf(3, 7.815), 0.95, 1e-4);
  const B = S.distribution('binomial', [10, 0.5]);
  close(B.pdf(3), 120 / 1024);
  close(B.cdf(3), 176 / 1024);
  close(S.probability(B, 2, 4), (45 + 120 + 210) / 1024);
  assert.equal(B.quantile(0.5), 5);
  close(S.distribution('poisson', [2]).cdf(3), 0.857123460498547, 1e-12);
  close(S.distribution('hypergeometrisch', [20, 5, 5]).pdf(2), 2275 / 7752, 1e-12);
  close(S.distribution('geometrisch', [0.2]).pdf(3), 0.128);
  close(S.probability(S.distribution('normal', [0, 1]), -1, 1), 0.682689492137, 1e-9);
});

test('school statistics', () => {
  const s = S.summary([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([s.q1, s.median, s.q3], [2.5, 4.5, 6.5]);
  assert.equal(S.quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9.5);
  assert.deepEqual(S.modes([1, 2, 2, 3, 3, 4]), [2, 3]);
  close(s.sampleVariance, 6);
  close(s.standardError, Math.sqrt(6 / 8));
  assert.deepEqual(S.classes([1.2, 1.5, 2.1, 2.2, 2.8, 3.4], 1).map((c) => c.count), [2, 3, 1]);
});

test('regressions and model comparison', () => {
  const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const sine = S.regression(x, x.map((t) => 2 * Math.sin(0.8 * t + 0.5) + 1), 'sinus');
  close(sine.params.a, 2, 1e-6);
  close(sine.params.b, 0.8, 1e-6);
  close(sine.r2, 1, 1e-9);
  const exp = S.regression([1, 2, 3], [2, 4, 8], 'exponentiell');
  close(exp.params.a, 1);
  close(exp.params.b, 2);
  assert.equal(S.regression([1, 2, 3, 4], [2, 4, 6, 8], 'linear').giac, '2*x');
  const best = S.compareModels([1, 2, 3, 4, 5, 6], [2.1, 3.9, 8.2, 15.8, 32.5, 63.7]);
  assert.equal(best[0].model, 'exponentiell');
});

test('tests as at school', () => {
  const right = S.binomialTest(100, 0.5, 0.05, 'right', 60);
  assert.deepEqual(right.region, [[59, 100]]);
  close(right.error, 0.0443130400570, 1e-10);
  assert.equal(right.reject, true);
  assert.deepEqual(S.binomialTest(100, 0.5, 0.05, 'left').region, [[0, 41]]);
  assert.deepEqual(S.binomialTest(100, 0.5, 0.05, 'both').region, [[0, 39], [61, 100]]);
  const t = S.tTest([5.1, 4.9, 5.3, 5.2, 4.8, 5.0, 5.4], 5, 0.05, 'both');
  close(t.statistic, 1.2247448713915845, 1e-12);
  assert.equal(t.reject, false);
  const chi = S.chi2Fit([10, 12, 8, 11, 9, 10], new Array(6).fill(1 / 6), 0.05);
  close(chi.statistic, 1);
  close(chi.critical, 11.0705, 1e-4);
  const ci = S.proportionInterval(40, 100, 0.95);
  close(ci.low, 0.3094, 1e-4);
  close(ci.high, 0.4980, 1e-4);
});

test('simulations repeat with their seed', () => {
  const a = S.draw(S.random(7), [1, 2, 3, 4, 5, 6], null, 50);
  const b = S.draw(S.random(7), [1, 2, 3, 4, 5, 6], null, 50);
  assert.deepEqual(a, b);
  assert.ok(a.every((v) => v >= 1 && v <= 6));
  const running = S.runningFrequency(S.random(3), 0.3, 20000);
  close(running[running.length - 1], 0.3, 0.02);
  close(S.monteCarloPi(S.random(5), 20000).estimate, Math.PI, 0.05);
});

test('charts', () => {
  const box = chartShapes('boxplot', 'boxplot', [[1, 2, 3, 4, 5, 6, 7, 8]], 1);
  assert.deepEqual([box.rects[0].x0, box.rects[0].x1], [2.5, 6.5]);
  const pie = chartShapes('kreisdiagramm', 'pie', [[1, 2], [1, 3]], 1);
  close(pie.wedges[0].a0 - pie.wedges[0].a1, Math.PI / 2);
  const dist = chartShapes('verteilung', 'distribution', ['binomial', 10, 0.5, 4, 6], 1);
  assert.equal(dist.rects.filter((r) => r.strong).length, 3);
  const sim1 = chartShapes('würfelsimulation', 'simulation', [300], 11);
  const sim2 = chartShapes('würfelsimulation', 'simulation', [300], 11);
  assert.deepEqual(sim1.rects, sim2.rects);
});

test('the spreadsheet with Giac', async () => {
  const cas = await loadGiac();
  const engine = new Engine(cas);
  const sheet = new Sheet();
  engine.sheet = sheet;
  const toGiac = (text) => engine.giac(engine.parse({ text }));
  const cells = { A1: '1', A2: '2', A3: '3,5', B1: '=A1*2', B2: '=SUMME(A1:A3)', B3: '=WENN(A1>0; 10; 20)', B4: '=$A$1+A2', C1: 'Text', C2: '=C1+1', D1: '=D2', D2: '=D1', E1: '=ableiten(x^3)', E2: '=A1=1' };
  for (const [ref, raw] of Object.entries(cells)) sheet.set(ref, raw);
  sheet.recalc(cas, toGiac);
  const d = (ref) => sheet.display(ref).display;
  assert.deepEqual(['B1', 'B2', 'B3', 'B4', 'C2', 'D1', 'E2'].map(d), ['2', '6,5', '10', '3', '#FEHLER', '#ZIRKEL', 'WAHR']);
  assert.equal(d('E1'), '3·x^2');
  // The CAS reads cells, also as A_1 from the formula editor
  assert.equal(engine.evaluate({ text: 'mittelwert(zellen(A1, A3))' }).latex, '2{,}166666667');
  assert.equal(engine.evaluate({ latex: 'A_1+B_1' }).latex, '3');
  // Filling: relative references move, $ ones stay; numbers continue as a series
  sheet.set('F1', '=A1+$A$1');
  sheet.fill([5, 0, 5, 2], 'down');
  assert.deepEqual(['F2', 'F3'].map((r) => sheet.get(r)), ['=A2+$A$1', '=A3+$A$1']);
  sheet.set('G1', '2');
  sheet.set('G2', '4');
  sheet.fill([6, 0, 6, 4], 'down');
  assert.equal(sheet.get('G5'), '10');
  // Sorting moves whole rows; a formula that reads its own row keeps doing so
  for (const [ref, raw] of Object.entries({ H1: '5', H2: '2', H3: '9', I1: '=H1*10', I2: '=H2*10', I3: '=H3*10' })) sheet.set(ref, raw);
  sheet.recalc(cas, toGiac);
  sheet.sort([7, 0, 8, 2], 7, true);
  sheet.recalc(cas, toGiac);
  assert.deepEqual(['H1', 'H2', 'H3', 'I1', 'I3'].map(d), ['9', '5', '2', '90', '20']);
  assert.equal(sheet.get('I1'), '=H1*10');
  sheet.filters = { 0: '>1' };
  assert.deepEqual([0, 1, 2].map((r) => sheet.rowVisible(r)), [false, true, true]);
});
