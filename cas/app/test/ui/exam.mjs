// The exam mode in headless Chromium: started from the menu with a code, a fresh project, numbers only without
// CAS, blocked commands and pasting, surviving a reload, ended only with the code, the old project back.
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

await page.evaluate(() => window.Mathe.state.cas.tryExample('vorher=5'));
await page.waitForTimeout(800);

// Start: GTR, code 1234
await page.click('button[aria-label="Projekt"]');
await page.click('.sheet button:has-text("Prüfungsmodus")');
await page.click('.sheet button:has-text("Ohne CAS (GTR)")');
await page.fill('.sheet input[inputmode="numeric"]', '1234');
await page.click('.sheet button:has-text("Prüfung starten")');
await page.waitForTimeout(500);
assert.ok(await page.isVisible('.exam-banner'));
assert.deepEqual(await results(), []);

for (const t of ['f(x)=x^2-2', 'löse(f(x)=0, x)', 'ableiten(x^3)', 'wurzel(8)', 'faktorisiere(x^2-1)', 'programm p(n)\nzurück n\nende']) await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), t);
let r = await results();
console.log(r);
assert.deepEqual(r, ['f\\left(x\\right)=x^{2}-2', 'L=\\left\\{-1{,}414213562;\\ 1{,}414213562\\right\\}', 'ERR Im Prüfungsmodus ohne CAS gibt es nur Zahlenwerte.', '2{,}828427125', 'ERR faktorisiere(…) ist in dieser Prüfung gesperrt.', 'ERR Programme sind in dieser Prüfung gesperrt.']);
// Pasting from outside is refused
const pasted = await page.evaluate(() => {
  const e = new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
  e.clipboardData.setData('text/plain', 'geheim');
  document.querySelector('.table-grid').dispatchEvent(e);
  return e.defaultPrevented;
});
assert.equal(pasted, true);
// The menu only ends the exam; Algebra is gone from the command list
await page.click('button[aria-label="Projekt"]');
const menu = await page.$$eval('.sheet .list button', (b) => b.map((x) => x.textContent));
assert.deepEqual(menu, ['Einstellungen', 'Prüfung beenden …']);
await page.keyboard.press('Escape');
await page.evaluate(() => document.querySelector('.scrim')?.remove());
await page.click('button:has-text("Befehle")');
const chips = await page.$$eval('.panel .chips button', (b) => b.map((x) => x.textContent));
assert.ok(!chips.includes('Algebra') && !chips.includes('Programme') && chips.includes('Statistik'));
await page.screenshot({ path: out + 'exam.png' });
await page.click('.panel button[aria-label="Schließen"]');

// A reload stays in the exam, with its rules
await page.waitForTimeout(800);
await page.reload();
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });
await page.waitForTimeout(300);
assert.ok(await page.isVisible('.exam-banner'));
await page.evaluate(() => window.Mathe.state.cas.tryExample('ableiten(x^2)'));
r = await results();
assert.equal(r[r.length - 1], 'ERR Im Prüfungsmodus ohne CAS gibt es nur Zahlenwerte.');

// Ending needs the code
const end = async (code) => {
  await page.click('.exam-banner button');
  await page.fill('.sheet input[placeholder="Code"]', code);
  await page.click('.sheet button:has-text("Beenden und löschen")');
  await page.waitForTimeout(500);
};
await end('0000');
assert.ok(await page.isVisible('.exam-banner'));
await end('1234');
assert.ok(!(await page.isVisible('.exam-banner')));
r = await results();
assert.deepEqual(r, ['\\mathrm{vorher}=5']);
assert.equal(await page.evaluate(() => window.Mathe.api.evaluate('ableiten(x^3)').latex), '3x^{2}');

console.log('errors:', errors);
assert.deepEqual(errors, []);
await browser.close();
