// Chemistry in the calculator page: commands in text and formula rows, reaction editor, results with working steps,
// diagrams in the graphics, chemistry keyboard. Headless Chromium.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const out = new URL('../../build/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + new URL('../../../web/mathe.html', import.meta.url).pathname);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mathe.layout', 'both'); });
await page.reload();
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });
const blur = () => page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });
const run = async (text) => {
  await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), text);
  await page.waitForTimeout(350);
  return page.evaluate(() => { const rows = window.Mathe.state.cas.rows.filter((r) => r.result); const r = rows[rows.length - 1].result; return { ok: r.ok, error: r.error, title: r.title, kind: r.kind, first: r.rows && r.rows[0] && r.rows[0].latex, steps: r.steps ? r.steps.length : 0, latex: r.latex, shapes: !!r.shapes }; });
};

// 1. molar mass: the golden value, with its working
let r = await run('molmasse(H2SO4)');
assert.equal(r.ok, true, r.error);
assert.match(r.first, /98\{,\}079/);
assert.ok(r.steps >= 2);
// 2. balancing, typed as a bare reaction
r = await run('Fe + O2 -> Fe2O3');
assert.equal(r.ok, true, r.error);
assert.match(r.first, /4\\,\\mathrm\{Fe\}/);
// 3. a redox equation
r = await run('redox(MnO4- + Fe2+ -> Mn2+ + Fe3+)');
assert.equal(r.ok, true, r.error);
// 4. pH
r = await run('pH(CH3COOH; 0,1 mol/L)');
assert.equal(r.ok, true, r.error);
assert.match(r.first, /2\{,\}883/);
// 5. an error in German with its code
r = await run('molmasse(Xy2)');
assert.equal(r.ok, false);
assert.match(r.error, /Element/);
// 6. mathematics is untouched, and chemistry inside a calculation
r = await run('2*M(NaCl)');
assert.equal(r.ok, true, r.error);
assert.match(r.latex, /116\{,\}8855/);
r = await run('löse(x^2-4=0, x)');
assert.equal(r.ok, true);
assert.match(r.latex, /L=/);
// 7. a titration curve reaches the graphics
r = await run('titration(CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L)');
assert.equal(r.ok, true, r.error);
assert.equal(r.shapes, true);
await blur();
await page.waitForTimeout(400);
const charts = await page.evaluate(() => window.Mathe.state.scene.objects.filter((o) => o.type === 'chart' && o.chart === 'chem').length);
assert.ok(charts >= 1, 'the titration curve is a chart in the scene');
// 8. rendered output: the steps fold, the warnings show
const html = await page.evaluate(() => document.querySelector('.analysis .chem-steps') ? document.querySelector('.analysis .chem-steps summary').textContent : null);
assert.equal(html, 'Rechenweg');
// 9. the reaction editor shows its buttons for a reaction in the row
await page.evaluate(() => { const cas = window.Mathe.state.cas; const row = cas.addRow({ mode: 'text', text: 'N2 + H2 -> NH3' }); cas.focus(row); row.field.dispatchEvent(new Event('input')); });
await page.waitForTimeout(200);
const bar = await page.evaluate(() => [...document.querySelectorAll('.chem-bar button')].map((b) => b.textContent));
assert.deepEqual(bar.slice(-4), ['Ausgleichen', 'Stöchiometrie', 'Redox', 'Thermodynamik']);
// 10. formula editor input with subscripts, arrows and charges
await page.evaluate(() => { const rows = window.Mathe.state.cas.rows; window.Mathe.state.cas.focus(rows[rows.length - 1]); });
await page.waitForTimeout(150);
const before = await page.evaluate(() => window.Mathe.state.cas.rows.length);
await page.evaluate(() => { const cas = window.Mathe.state.cas; const row = cas.addRow({ mode: 'math', latex: '\\operatorname{molmasse}\\left(H_2SO_4\\right)' }); cas.calculate(row); });
r = await page.evaluate(() => { const rows = window.Mathe.state.cas.rows; const x = rows[rows.length - 1].result; return { ok: x.ok, first: x.rows && x.rows[0] && x.rows[0].latex }; });
assert.equal(r.ok, true);
assert.match(r.first, /98\{,\}079/);
// 11. the chemistry keyboard layer exists with the required keys
const keys = await page.evaluate(() => { const layouts = window.mathVirtualKeyboard.layouts; const chem = layouts.find((l) => l.label === 'Chemie'); return chem ? chem.rows.flat().map((k) => (typeof k === 'string' ? k : k.label || k.latex)) : null; });
assert.ok(keys, 'the Chemie layout is there');
for (const k of ['H₂', 'O₂', 'N₂', 'CO₂', 'SO₄²⁻', 'NH₄⁺', '→', '⇌', '↑', '↓', 'Δ', 'e⁻', 'mol', 'g', 'L', 'mL', 'M', 'K', 'pH', 'Ka', 'Kb', 'Ksp', 'E°', 'ΔH', 'ΔG']) assert.ok(keys.includes(k), 'key ' + k);
// 12. the command search knows the chemistry
await page.keyboard.press('Control+k');
await page.waitForSelector('.panel');
await page.fill('.panel .search', 'molmasse');
await page.waitForTimeout(200);
const found = await page.evaluate(() => document.querySelector('.panel').textContent);
assert.match(found, /molmasse/);
await page.screenshot({ path: out + 'chemistry.png' });
console.log('errors:', JSON.stringify(errors));
assert.deepEqual(errors, []);
await browser.close();
console.log('chemistry ui ok');
