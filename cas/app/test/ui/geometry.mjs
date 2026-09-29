// Dynamic geometry in headless Chromium: constructions typed and made with the tools, a dragged point moving
// everything built on it live, a point on a circle, a locus. Fails on page errors or wrong results.
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
await page.evaluate(() => localStorage.setItem('mathe.layout', 'both'));
await page.reload();
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });

const rows = ['A(0|0)', 'B(4|0)', 'C(1|3)', 'D1=polygon(A,B,C)', 'U=umkreismittelpunkt(A,B,C)', 'c=kreis(A,B,C)', 'h=höhe(C,A,B)', 'alpha=winkel(B,A,C)', 'g=gerade(A,C)', 'S=schnittpunkt(g, y=1)', 'P=punktauf(c, 1)', 'm=mittelsenkrechte(A,B)', 'E=spiegeln(C, m)', 'a=1', 'R=(a|a^2/4)', 'ortslinie(R, a)'];
for (const t of rows) await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), t);
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });
await page.waitForTimeout(500);
const summary = await page.evaluate(() => {
  const s = window.Mathe.state;
  return { objects: s.scene.objects.map((o) => o.type + (o.name ? ':' + o.name : '')), gliders: [...s.scene.gliders.keys()], results: s.cas.rows.map((r) => r.result && (r.result.ok ? r.result.latex : 'ERR ' + r.result.error)) };
});
console.log(JSON.stringify(summary, null, 1));
for (const r of summary.results.filter(Boolean)) assert.ok(!r.startsWith('ERR'), r);
for (const kind of ['polygon:D1', 'point:U', 'circle:c', 'segment:h', 'angle:alpha', 'line:g', 'points:S', 'point:P', 'line:m', 'point:E', 'locus']) assert.ok(summary.objects.includes(kind), 'missing ' + kind);
assert.deepEqual(summary.gliders, ['P']);
await page.screenshot({ path: out + 'geometry.png' });

// Drag C: the circumcentre, the circle and the reflected point follow while dragging.
const before = await page.evaluate(() => {
  const s = window.Mathe.state;
  const U = s.scene.objects.find((o) => o.name === 'U');
  return U.at();
});
const at = await page.evaluate(() => {
  const g = window.Mathe.state.graph;
  const rect = g.canvas.getBoundingClientRect();
  return { x: rect.left + g.px(1), y: rect.top + g.py(3), tx: rect.left + g.px(2), ty: rect.top + g.py(4) };
});
await page.mouse.move(at.x, at.y);
await page.mouse.down();
await page.mouse.move((at.x + at.tx) / 2, (at.y + at.ty) / 2, { steps: 3 });
await page.mouse.move(at.tx, at.ty, { steps: 3 });
const during = await page.evaluate(() => {
  const s = window.Mathe.state;
  return { U: s.scene.objects.find((o) => o.name === 'U').at(), E: s.scene.objects.find((o) => o.name === 'E').at() };
});
await page.mouse.up();
await page.waitForTimeout(300);
console.log('U before', before, 'during', during);
assert.notDeepEqual(during.U, before);
// C(2|4) reflected at x = 2 stays (2|4)
assert.ok(Math.abs(during.E[0] - 2) < 1e-9 && Math.abs(during.E[1] - 4) < 1e-9);
const afterDrag = await page.evaluate(() => window.Mathe.state.cas.rows.find((r) => /^C/.test(r.text)).text);
assert.equal(afterDrag, 'C(2|4)');

// The point on the circle moves along it.
const circle = await page.evaluate(() => {
  const s = window.Mathe.state;
  const g = s.graph;
  const P = s.scene.objects.find((o) => o.name === 'P');
  const [x, y] = P.at();
  const rect = g.canvas.getBoundingClientRect();
  const c = s.scene.objects.find((o) => o.name === 'c');
  const [cx, cy] = c.center();
  return { x: rect.left + g.px(x), y: rect.top + g.py(y), tx: rect.left + g.px(cx - 5), ty: rect.top + g.py(cy), r: c.radius(), cx, cy };
});
await page.mouse.move(circle.x, circle.y);
await page.mouse.down();
await page.mouse.move(circle.tx, circle.ty, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
const onCircle = await page.evaluate(() => {
  const s = window.Mathe.state;
  const P = s.scene.objects.find((o) => o.name === 'P');
  return { at: P.at(), row: s.cas.rows.find((r) => /^P=/.test(r.text)).text };
});
console.log(onCircle, circle);
assert.ok(Math.abs(Math.hypot(onCircle.at[0] - circle.cx, onCircle.at[1] - circle.cy) - circle.r) < 1e-6);
assert.ok(Math.abs(onCircle.at[0] - (circle.cx - circle.r)) < 0.05, 'moved to the left of the circle');
assert.match(onCircle.row, /^P=punktauf\(c,3\.1/);

// Tools: a segment between two new points, then its midpoint
await page.click('.construct button:has-text("Strecke")');
const tap = async (x, y) => {
  const p = await page.evaluate(([x, y]) => { const g = window.Mathe.state.graph; const r = g.canvas.getBoundingClientRect(); return [r.left + g.px(x), r.top + g.py(y)]; }, [x, y]);
  await page.mouse.click(p[0], p[1]);
  await page.waitForTimeout(150);
};
await tap(-6, -3);
await tap(-2, -4);
await page.click('.construct button:has-text("Mitte")');
await tap(-6, -3);
await tap(-2, -4);
await page.click('.construct button:has-text("Bewegen")');
await page.waitForTimeout(300);
const built = await page.evaluate(() => window.Mathe.state.cas.rows.slice(-5).map((r) => (r.latex || r.text) + ' → ' + (r.result ? (r.result.ok ? r.result.latex : r.result.error) : '')));
console.log(built);
assert.ok(built.some((r) => /strecke/.test(r) && /\\sqrt\{17\}/.test(r)), 'segment row');
assert.ok(built.some((r) => /mittelpunkt/.test(r) && /\\left\(-4\\middle\|-\\frac\{7\}\{2\}\\right\)/.test(r)), 'midpoint row');
await page.screenshot({ path: out + 'geometry-tools.png' });

console.log('errors:', JSON.stringify(errors));
assert.deepEqual(errors, []);
await browser.close();
