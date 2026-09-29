// Drives the graphics in headless Chromium: objects from CAS rows, sliders, animation, dragging a point, special
// points, the phone layout. Screenshots go to build/; the script fails on page errors or wrong results.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const executablePath = process.env.CHROMIUM || undefined;
const out = new URL('../../build/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await playwright.chromium.launch({ executablePath });
const errors = [];
async function open(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + new URL('../../../web/mathe.html', import.meta.url).pathname);
  await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });
  return page;
}

const page = await open({ width: 1280, height: 820 });
await page.evaluate(() => localStorage.setItem('mathe.layout', 'both'));
const rows = ['a=1', 'f(x)=a*x^2-2', 'A(1|2)', 'B=(4|0)', 'g=gerade(A,B)', 'kreis((0|0),3)', 'y<x-4', 'x^2/16+y^2/4=1', 'h(x)=sin(x)', 'zeige=wahr', 'kurve(2cos(t), sin(3t), t, 0, 2pi)', 'polygon((-6|-1),(-4|-1),(-5|1))', 'vektor(A,B)', 'strecke((-6|3),(-3|4))'];
for (const text of rows) await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), text);
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });
await page.waitForTimeout(500);
const summary = await page.evaluate(() => {
  const s = window.Mathe.state;
  return { objects: s.scene.objects.map((o) => o.type + (o.name ? ':' + o.name : '')), params: [...s.scene.params.keys()], results: s.cas.rows.map((r) => r.result && (r.result.ok ? r.result.latex : 'ERR ' + r.result.error)) };
});
console.log(JSON.stringify(summary, null, 1));
assert.deepEqual(summary.params, ['a', 'zeige']);
for (const kind of ['function:f', 'point:A', 'point:B', 'line:g', 'circle', 'region', 'implicit', 'function:h', 'curve', 'polygon', 'vector', 'segment']) {
  assert.ok(summary.objects.includes(kind), 'missing object ' + kind);
}
await page.screenshot({ path: out + 'graph-both.png' });

// The slider: dragging it moves f live and writes the value back into its row.
await page.evaluate(() => {
  const s = window.Mathe.state;
  s.animator.drag('a', 0.5);
  s.animator.settle('a');
});
await page.waitForTimeout(200);
const afterSlider = await page.evaluate(() => {
  const s = window.Mathe.state;
  const f = s.scene.objects.find((o) => o.name === 'f');
  return { row: s.cas.rows[0].latex || s.cas.rows[0].text, f2: f.f(2), result: s.cas.rows[1].result.latex };
});
console.log(afterSlider);
assert.equal(afterSlider.row, 'a=0.5');
assert.equal(afterSlider.f2, 0);
assert.match(afterSlider.result, /0\{,\}5|\\frac\{1\}\{2\}|\\frac\{x\^\{2\}\}\{2\}/);

// Animation runs and stops.
await page.evaluate(() => window.Mathe.state.animator.play('a'));
await page.waitForTimeout(700);
const moving = await page.evaluate(() => window.Mathe.state.scene.params.get('a').value);
await page.evaluate(() => window.Mathe.state.animator.pause('a'));
await page.waitForTimeout(200);
console.log('animated a →', moving, 'row', await page.evaluate(() => window.Mathe.state.cas.rows[0].text));
assert.notEqual(moving, 0.5);

// Dragging point A with the mouse moves the line through it and rewrites the row.
const view = await page.evaluate(() => {
  const g = window.Mathe.state.graph;
  const rect = g.canvas.getBoundingClientRect();
  return { x: rect.left + g.px(1), y: rect.top + g.py(2), tx: rect.left + g.px(2), ty: rect.top + g.py(3) };
});
await page.mouse.move(view.x, view.y);
await page.mouse.down();
await page.mouse.move((view.x + view.tx) / 2, (view.y + view.ty) / 2, { steps: 4 });
await page.mouse.move(view.tx, view.ty, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(300);
const dragged = await page.evaluate(() => {
  const s = window.Mathe.state;
  const row = s.cas.rows.find((r) => /^A/.test(r.text));
  const line = s.cas.rows.find((r) => /gerade/.test(r.text));
  return { row: row.text, line: line.result.latex };
});
console.log(dragged);
assert.equal(dragged.row, 'A(2|3)');
assert.equal(dragged.line, 'g\\colon\\ y=-\\frac{3}{2}x+6');

// Tapping f shows its special points.
const tap = await page.evaluate(() => {
  const g = window.Mathe.state.graph;
  const f = window.Mathe.state.scene.objects.find((o) => o.name === 'f');
  const rect = g.canvas.getBoundingClientRect();
  return { x: rect.left + g.px(0), y: rect.top + g.py(f.f(0)) };
});
await page.mouse.click(tap.x, tap.y);
await page.waitForTimeout(200);
const special = await page.evaluate(() => window.Mathe.state.graph.special.map((p) => p.name + '(' + p.x.toFixed(3) + '|' + p.y.toFixed(3) + ')'));
console.log('special', special);
assert.ok(special.some((p) => p.startsWith('T(0.000')), 'minimum of f');
await page.screenshot({ path: out + 'graph-special.png' });

// Checkbox hides h when its condition is set.
await page.evaluate(() => {
  const s = window.Mathe.state;
  const h = s.scene.objects.find((o) => o.name === 'h');
  h.row.graph.style = { ...(h.row.graph.style || {}), condition: 'zeige' };
  const p = s.scene.params.get('zeige');
  p.value = false;
  s.animator.settle('zeige');
});
await page.waitForTimeout(200);
const hidden = await page.evaluate(() => {
  const s = window.Mathe.state;
  const h = s.scene.objects.find((o) => o.name === 'h');
  return { holds: s.graph.conditionHolds(h), row: s.cas.rows.find((r) => /zeige/.test(r.text)).text };
});
console.log(hidden);
assert.equal(hidden.holds, false);

// Export
const png = await page.evaluate(() => window.Mathe.state.graph.png(1).length);
assert.ok(png > 10000);

// Settings: π axis, log axis
await page.evaluate(() => {
  const g = window.Mathe.state.graph;
  g.settings.piX = true;
  g.viewChanged();
});
await page.waitForTimeout(200);
await page.screenshot({ path: out + 'graph-pi.png' });
await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
await page.evaluate(() => window.Mathe.state.graph.redraw());
await page.waitForTimeout(200);
await page.screenshot({ path: out + 'graph-dark.png' });

// Reload keeps rows, styles and the view.
const saved = await page.evaluate(() => {
  const s = window.Mathe.state;
  return JSON.parse(JSON.stringify({ cas: s.cas.serialize(), graph: s.graph.settings }));
});
assert.ok(saved.cas.some((r) => r.graph && r.graph.style && r.graph.style.condition === 'zeige'));

// Phone: the graphics alone with the strip and the input line
const phone = await open({ width: 390, height: 780 });
await phone.evaluate(() => localStorage.setItem('mathe.layout', 'graph'));
await phone.reload();
await phone.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });
for (const text of ['b=2', 'p(x)=b*sin(x)', 'P(1|1)']) await phone.evaluate((t) => window.Mathe.state.cas.tryExample(t), text);
await phone.waitForTimeout(300);
await phone.evaluate(() => window.mathVirtualKeyboard.hide());
await phone.screenshot({ path: out + 'graph-phone.png' });
const phoneState = await phone.evaluate(() => ({ layout: window.Mathe.state.layout, strip: document.querySelectorAll('.strip .slider').length }));
console.log(phoneState);
assert.equal(phoneState.layout, 'graph');
assert.equal(phoneState.strip, 1);

console.log('errors:', JSON.stringify(errors));
assert.deepEqual(errors, []);
await browser.close();
