// Programs, scripts and the API in headless Chromium: a German program typed with auto-indent, recursion, a button
// whose script counts up, a change script, a tap script on a point, and the JavaScript/postMessage API.
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
const results = () => page.evaluate(() => window.Mathe.state.cas.rows.filter((r) => r.result).map((r) => (r.result.ok ? r.result.latex : 'ERR ' + r.result.error)));

// 1. A program typed line by line: Enter adds lines (indented) until the last „ende“
await page.evaluate(() => {
  const cas = window.Mathe.state.cas;
  const row = cas.rows[cas.rows.length - 1];
  row.mode = 'text';
  cas.buildInput(row);
  row.field.focus();
});
for (const line of ['programm fak(n)', 'wenn n <= 1 dann', 'zurück 1', 'ende', 'zurück n * fak(n - 1)', 'ende']) {
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
}
const typed = await page.evaluate(() => window.Mathe.state.cas.rows.find((r) => r.text.startsWith('programm')).text);
console.log(typed);
assert.equal(typed, 'programm fak(n)\n  wenn n <= 1 dann\n    zurück 1\n  ende\n  zurück n * fak(n - 1)\nende');
await page.evaluate(() => window.Mathe.state.cas.tryExample('fak(6)'));
await page.evaluate(() => window.Mathe.state.cas.tryExample('programm quadrate(n)\n  für k von 1 bis n\n    ausgabe k^2\n  ende\n  zurück n\nende'));
await page.evaluate(() => window.Mathe.state.cas.tryExample('quadrate(3)'));
await page.evaluate(() => window.Mathe.state.cas.tryExample('anwenden([1,2,3], x -> 2x)'));
let r = await results();
console.log(r);
assert.ok(r[0].includes('Programm'));
assert.ok(r.includes('720'));
assert.ok(r.includes('\\left[2;\\ 4;\\ 6\\right]'));
const printed = await page.evaluate(() => [...document.querySelectorAll('.printed div:not(.label)')].map((d) => d.textContent));
assert.equal(printed.length, 3);
assert.ok(await page.evaluate(() => document.querySelectorAll('.code-shade .kw').length > 4), 'keywords highlighted');

// 2. A button whose script counts up, and a change script that follows a
for (const t of ['a=1', 'c=0', 'knopf("Plus")']) await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), t);
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });
await page.waitForTimeout(300);
await page.evaluate(() => {
  const rows = window.Mathe.state.cas.rows;
  rows.find((r) => r.text === 'knopf("Plus")').graph = { scripts: { click: 'a = a + 1\nwenn a >= 3 dann meldung a ist jetzt {a}' } };
  rows.find((r) => r.text === 'a=1').graph = { scripts: { change: 'c = 10 * a' } };
});
await page.evaluate(() => window.Mathe.state.cas.recalculate(0));
await page.waitForTimeout(200);
const buttons = await page.locator('.strip .knopf button.primary').count();
assert.equal(buttons, 1);
await page.click('.strip .knopf button.primary');
await page.waitForTimeout(200);
await page.click('.strip .knopf button.primary');
await page.waitForTimeout(300);
const counted = await page.evaluate(() => ({ a: window.Mathe.api.getValue('a'), c: window.Mathe.api.getValue('c'), toast: document.querySelector('.toast')?.textContent }));
console.log(counted);
assert.deepEqual(counted, { a: 3, c: 30, toast: 'a ist jetzt 3' });
await page.screenshot({ path: out + 'program.png' });

// 3. Tapping a point runs its script
await page.evaluate(() => window.Mathe.state.cas.tryExample('P(1|1)'));
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });
await page.waitForTimeout(300);
await page.evaluate(() => { window.Mathe.state.cas.rows.find((r) => r.text === 'P(1|1)').graph = { scripts: { click: 'erzeuge Q(4|2)\nsetze P = (2|3)' } }; });
const at = await page.evaluate(() => {
  const g = window.Mathe.state.graph;
  const rect = g.canvas.getBoundingClientRect();
  g.standardView();
  return { x: rect.left + g.px(1), y: rect.top + g.py(1) };
});
await page.waitForTimeout(200);
await page.mouse.click(at.x, at.y);
await page.waitForTimeout(400);
const tapped = await page.evaluate(() => window.Mathe.api.objects().filter((o) => o.type === 'point').map((o) => [o.name, ...o.at]));
console.log(tapped);
assert.deepEqual(tapped, [['P', 2, 3], ['Q', 4, 2]]);

// 4. The API directly and by postMessage
const direct = await page.evaluate(() => window.Mathe.api.evaluate('ableiten(x^3)'));
assert.equal(direct.latex, '3x^{2}');
const viaMessage = await page.evaluate(() => new Promise((resolve) => {
  window.addEventListener('message', (e) => { if (e.data && e.data.source === 'mathe' && e.data.id === 7) resolve(e.data); });
  window.postMessage({ target: 'mathe', id: 7, call: 'getValue', args: ['a^2'] }, '*');
}));
assert.equal(viaMessage.result, 9);
const changes = await page.evaluate(() => new Promise((resolve) => {
  const stop = window.Mathe.api.on('change', (d) => { stop(); resolve(d.rows); });
  window.Mathe.api.addRow('b = 7');
}));
assert.ok(changes > 5);

console.log('errors:', errors);
assert.deepEqual(errors, []);
await browser.close();
