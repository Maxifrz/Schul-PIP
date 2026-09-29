// The 3D view in headless Chromium: analytic geometry in space typed as rows, the objects drawn with three.js,
// a slider moving a surface. Fails on page errors or wrong results.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const out = new URL('../../build/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + new URL('../../../web/mathe.html', import.meta.url).pathname);
await page.evaluate(() => localStorage.setItem('mathe.layout', 'space'));
await page.reload();
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });

const rows = ['A(2|0|0)', 'B(0|3|0)', 'C(0|0|2)', 'E=ebene(A,B,C)', 'g=gerade((0|0|0), vektor((1|1|1)))', 'S=schnittpunkt(g,E)', 'lage(g,E)', 'abstand((0|0|0),E)', 'K=kugel((0|0|0),1.5)', 'P1=pyramide((-4|-4|0),(-2|-4|0),(-2|-2|0),(-4|-2|0),(-3|-3|3))', 'a=1', 'f(x,y)=a*(x^2-y^2)/8', 'kurve(3cos(t), 3sin(t), t/4, t, 0, 4pi)', 'x^2+y^2-z^2=1'];
for (const t of rows) await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), t);
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });
await page.waitForTimeout(800);
const summary = await page.evaluate(() => {
  const s = window.Mathe.state;
  return { layout: s.layout, objects: s.scene.objects.map((o) => o.type + (o.name ? ':' + o.name : '')), meshes: s.space.objectGroup ? s.space.objectGroup.children.length : -1, results: s.cas.rows.map((r) => r.result && (r.result.ok ? r.result.latex : 'ERR ' + r.result.error)) };
});
console.log(JSON.stringify(summary, null, 1));
for (const r of summary.results.filter(Boolean)) assert.ok(!r.startsWith('ERR'), r);
for (const kind of ['point3:A', 'plane:E', 'line3:g', 'point3:S', 'sphere:K', 'solid:P1', 'surface:f', 'curve3', 'isurface']) assert.ok(summary.objects.includes(kind), 'missing ' + kind);
assert.equal(summary.layout, 'space');
assert.ok(summary.meshes >= 9, 'drawn objects: ' + summary.meshes);
assert.ok(summary.results.some((r) => r && r.includes('S\\left(\\frac{3}{4}\\middle|\\frac{3}{4}\\middle|\\frac{3}{4}\\right)')), 'intersection point');
await page.screenshot({ path: out + 'space.png' });

// A slider moves the surface: the drawing is built again with the new value.
const before = await page.evaluate(() => window.Mathe.state.scene.objects.find((o) => o.name === 'f').f(2, 0));
await page.evaluate(() => { const s = window.Mathe.state; s.animator.drag('a', 3); s.animator.settle('a'); });
await page.waitForTimeout(300);
const after = await page.evaluate(() => window.Mathe.state.scene.objects.find((o) => o.name === 'f').f(2, 0));
console.log('f(2,0)', before, '→', after);
assert.equal(after, 3 * before);
const png = await page.evaluate(() => window.Mathe.state.space.png().length);
assert.ok(png > 10000, 'png ' + png);

console.log('errors:', JSON.stringify(errors));
assert.deepEqual(errors.filter((e) => !/GPU stall|WebGL|swiftshader/i.test(e)), []);
await browser.close();
