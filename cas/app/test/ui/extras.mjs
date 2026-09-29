// The last additions in headless Chromium: shaded integrals, contour lines, systems of inequalities, plain German
// input, the automatic check of solutions, saved views, practice tasks and project versions.
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
const type = (t) => page.evaluate((t) => window.Mathe.state.cas.tryExample(t), t);
const blur = () => page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });

for (const t of ['f(x)=x^2-1', 'integriere(f(x), x, 0, 2)', 'höhenlinien(x^2+2y^2)', 'ungleichungssystem(y > x^2 - 2, y < x)', 'Ableitung von x^3', 'löse(x^2-5x+6=0, x)', 'aufgabe(gleichung, 1)']) await type(t);
await blur();
await page.waitForTimeout(500);
const state = await page.evaluate(() => {
  const s = window.Mathe.state;
  const chart = (kind) => {
    const o = s.scene.objects.find((x) => x.type === 'chart' && x.chart === kind);
    const sh = o && s.graph.chartOf(o);
    return sh ? sh.areas.length + sh.lines.length + sh.rects.length : -1;
  };
  return { area: chart('area'), contour: chart('contour'), inequalities: chart('inequalities'), understood: document.querySelector('.understood')?.textContent, check: document.querySelector('.check')?.textContent };
});
console.log(state);
assert.ok(state.area > 0 && state.contour > 10 && state.inequalities > 10);
assert.equal(state.understood, 'verstanden als ableiten(x^3)');
assert.equal(state.check, '✓ Probe');
await page.screenshot({ path: out + 'extras.png' });

// Practice: the task's own solution is right
const solution = await page.evaluate(() => {
  const q = window.Mathe.state.cas.rows.find((r) => r.text === 'aufgabe(gleichung, 1)').result.table.rows[0][1];
  const m = /Löse (\d+)x ([+−]) (\d+) = (-?\d+)/.exec(q.replace(/\\text\{|\}/g, ''));
  const [a, sign, b, c] = [Number(m[1]), m[2], Number(m[3]), Number(m[4])];
  return (c - (sign === '+' ? b : -b)) / a;
});
await type(`prüfe(${solution})`);
await blur();
await page.waitForTimeout(300);
const verdict = await page.evaluate(() => window.Mathe.state.cas.rows.filter((r) => r.result && r.result.ok).pop().result.title);
assert.equal(verdict, 'Aufgabe 1: richtig');

// A saved view comes back
await page.evaluate(() => {
  const g = window.Mathe.state.graph;
  Object.assign(g.settings, { xmin: -2, xmax: 2, ymin: -1, ymax: 1, equal: false });
  g.viewChanged();
});
await page.click('button[aria-label="Koordinatensystem"]');
await page.fill('.sheet input[placeholder^="Name"]', 'Nah');
await page.click('.sheet button:has-text("Merken")');
await page.click('.sheet button:has-text("Fertig")');
await page.evaluate(() => window.Mathe.state.graph.standardView());
await page.click('button[aria-label="Koordinatensystem"]');
await page.click('.sheet .views button:has-text("Nah")');
const view = await page.evaluate(() => window.Mathe.state.graph.settings);
assert.deepEqual([view.xmin, view.xmax, view.ymin, view.ymax], [-2, 2, -1, 1]);

// Saving twice under one name keeps the first as a version
const save = async () => {
  await page.click('button[aria-label="Projekt"]');
  await page.click('.sheet button:has-text("Speichern unter")');
  await page.fill('.sheet input', 'Test');
  await page.click('.sheet button:has-text("Speichern")');
  await page.waitForTimeout(200);
};
await save();
await type('neu=1');
await blur();
await save();
await page.click('button[aria-label="Projekt"]');
await page.click('.sheet button:has-text("Öffnen")');
await page.click('.sheet .project-row button:has-text("Versionen")');
const versions = await page.$$eval('.sheet .list button', (b) => b.length);
assert.equal(versions, 1);

console.log('errors:', errors);
assert.deepEqual(errors, []);
await browser.close();
