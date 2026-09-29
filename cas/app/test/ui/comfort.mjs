// Undo and redo, favourite and recent commands, keyboard shortcuts and help in headless Chromium.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + new URL('../../../web/mathe.html', import.meta.url).pathname);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mathe.layout', 'both'); });
await page.reload();
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });
const inputs = () => page.evaluate(() => window.Mathe.state.cas.rows.filter((r) => !window.Mathe.state.cas.isEmpty(r)).map((r) => r.text || r.latex));
const blur = () => page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });

for (const t of ['a=2', 'ableiten(x^3)', 'hilfe(ableiten)']) {
  await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), t);
  await page.waitForTimeout(450);
}
await blur();
const help = await page.evaluate(() => window.Mathe.state.cas.rows.find((r) => r.text === 'hilfe(ableiten)').result.rows.map((x) => x.label));
assert.deepEqual(help.slice(0, 3), ['Schreibweise', 'Was er tut', 'Beispiel']);

// Undo twice, redo once
assert.deepEqual(await inputs(), ['a=2', 'ableiten(x^3)', 'hilfe(ableiten)']);
await page.click('button[aria-label="Rückgängig"]');
await page.click('button[aria-label="Rückgängig"]');
assert.deepEqual(await inputs(), ['a=2']);
await page.keyboard.press('Control+Shift+Z');
assert.deepEqual(await inputs(), ['a=2', 'ableiten(x^3)']);
const value = await page.evaluate(() => window.Mathe.state.cas.rows[1].result.latex);
assert.equal(value, '3x^{2}');

// Ctrl+K opens the commands; recently used and a favourite
await page.keyboard.press('Control+k');
await page.waitForSelector('.panel');
await page.click('.panel .chips button:has-text("Zuletzt")');
const recent = await page.$$eval('.panel .command .name', (n) => n.map((x) => x.firstChild.textContent));
assert.deepEqual(recent.slice(0, 2), ['hilfe', 'ableiten']);
await page.click('.panel .command:first-child .star');
await page.keyboard.press('Control+k');
await page.keyboard.press('Control+k');
await page.waitForSelector('.panel');
const chips = await page.$$eval('.panel .chips button', (b) => b.map((x) => x.textContent + ':' + x.getAttribute('aria-pressed')));
assert.ok(chips.includes('★ Favoriten:true'), chips.join(' '));
const favs = await page.$$eval('.panel .command .name', (n) => n.map((x) => x.firstChild.textContent));
assert.deepEqual(favs, ['hilfe']);
await page.keyboard.press('Control+k');

// Ctrl+3 shows the graphics, F1 the help
await page.keyboard.press('Control+3');
assert.equal(await page.evaluate(() => window.Mathe.state.layout), 'graph');
await page.keyboard.press('F1');
assert.ok(await page.isVisible('.sheet .shortcuts'));

console.log('errors:', errors);
assert.deepEqual(errors, []);
await browser.close();
