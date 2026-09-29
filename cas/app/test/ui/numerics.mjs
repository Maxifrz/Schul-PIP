// Sequences, iterations, numerics, differential equations and the complex plane in headless Chromium: every chart
// draws, fields fill the view, a slider changes a direction field live.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const out = new URL('../../build/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + new URL('../../../web/mathe.html', import.meta.url).pathname);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mathe.layout', 'both'); });
await page.reload();
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });
const hide = () => page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });

const charts = [
  ['folgenplot((1+1/n)^n, n, 1, 30)', 'sequence'],
  ['spinnweb(2.8x(1-x), 0.2, 30)', 'cobweb'],
  ['newtonschritte(x^2-2, 3)', 'newton'],
  ['bisektionsschritte(x^3-2, 0, 2)', 'bisection'],
  ['phasenporträt(y, -x - 0.3y)', 'phase'],
  ['zahlenebene(3+4i, 1-i, -2i)', 'complex'],
  ["lösungskurve(y' = x - y, 0, 1)", 'solution'],
];
const drawn = {};
for (const [text, kind] of charts) {
  await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), text);
  await hide();
  await page.waitForTimeout(350);
  drawn[kind] = await page.evaluate((kind) => {
    const s = window.Mathe.state;
    const o = s.scene.objects.filter((x) => x.type === 'chart' && x.chart === kind).pop();
    const shapes = o && s.graph.chartOf(o);
    return shapes ? shapes.lines.length + shapes.dots.length : -1;
  }, kind);
  if (kind === 'cobweb' || kind === 'complex') await page.screenshot({ path: out + 'numerics-' + kind + '.png' });
}
console.log(drawn);
for (const [kind, n] of Object.entries(drawn)) assert.ok(n > 0, kind + ' draws nothing');
await page.screenshot({ path: out + 'numerics-solution.png' });

// A slider in a direction field
await page.evaluate(() => window.Mathe.state.cas.tryExample('a=1'));
await page.evaluate(() => window.Mathe.state.cas.tryExample("richtungsfeld(y' = a*y)"));
await hide();
await page.waitForTimeout(400);
const slopes = await page.evaluate(() => {
  const s = window.Mathe.state;
  const o = s.scene.objects.filter((x) => x.type === 'chart' && x.chart === 'field').pop();
  const first = () => {
    const [p, q] = s.graph.chartOf(o).lines.find((l) => l.points[0][1] > 1).points;
    return Math.sign(q[1] - p[1]);
  };
  const before = first();
  s.scene.params.get('a').value = -1;
  return [before, first()];
});
assert.deepEqual(slopes, [1, -1]);
const results = await page.evaluate(() => window.Mathe.state.cas.rows.filter((r) => r.result).map((r) => (r.result.ok ? r.result.kind : 'ERR ' + r.result.error)));
for (const r of results) assert.ok(!String(r).startsWith('ERR'), r);
console.log('errors:', errors);
assert.deepEqual(errors, []);
await browser.close();
