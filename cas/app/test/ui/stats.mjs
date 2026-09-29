// Statistics, charts and the spreadsheet in headless Chromium: chart commands draw, a slider moves a distribution,
// cells are typed with the keyboard, filled, used in the CAS and turned into a chart, and survive a reload.
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
const hideKeyboard = () => page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.mathVirtualKeyboard.hide(); });

// 1. Charts from the CAS
const charts = ['L=[2,3,5,7,8,9,12,15]', 'boxplot(L)', 'histogramm(L, 5)', 'streudiagramm([1,2,3,4,5], [2,4,5,4,6])', 'kreisdiagramm([1,2,3], [10,25,15])', 'würfelsimulation(600)', 'binomialtest(100, 0.5, 0.05, rechts, 60)', 'gesetzdergroßenzahlen(0.3, 500)', 'montecarlopi(500)', 'residuenplot([1,2,3,4,5], [2,4,5,8,9], linear)', 'verteilung(normal, 0, 1, -1, 1)'];
for (const t of charts) await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), t);
await hideKeyboard();
await page.waitForTimeout(600);
const drawn = await page.evaluate(() => {
  const s = window.Mathe.state;
  return {
    results: s.cas.rows.map((r) => r.result && (r.result.ok ? r.result.kind : 'ERR ' + r.result.error)).filter(Boolean),
    charts: s.scene.objects.filter((o) => o.type === 'chart').map((o) => {
      const shapes = s.graph.chartOf(o);
      return [o.chart, shapes ? shapes.rects.length + shapes.lines.length + shapes.dots.length + shapes.wedges.length : -1];
    }),
    tables: document.querySelectorAll('.stat-table').length,
    view: s.graph.settings,
  };
});
console.log(JSON.stringify(drawn));
for (const r of drawn.results) assert.ok(!String(r).startsWith('ERR'), r);
assert.equal(drawn.charts.length, 10);
// Only the newest chart shows; the others wait behind their dots.
assert.deepEqual(await page.evaluate(() => window.Mathe.state.scene.objects.filter((o) => o.type === 'chart' && (o.row.graph?.visible ?? true)).map((o) => o.chart)), ['distribution']);
for (const [kind, count] of drawn.charts) assert.ok(count > 0, kind + ' draws nothing');
assert.ok(drawn.tables >= 4, 'tables in the CAS rows');
// The last chart typed fills the view: N(0; 1) from about −4 to 4
assert.ok(drawn.view.xmin < -3.5 && drawn.view.xmax > 3.5 && drawn.view.ymax < 1, JSON.stringify(drawn.view));
await page.screenshot({ path: out + 'stats-charts.png' });

// 2. A slider moves a distribution
await page.evaluate(() => window.Mathe.state.cas.tryExample('p=0.3'));
await page.evaluate(() => window.Mathe.state.cas.tryExample('verteilung(binomial, 20, p, 4, 8)'));
await hideKeyboard();
await page.waitForTimeout(400);
const moved = await page.evaluate(async () => {
  const s = window.Mathe.state;
  const chart = s.scene.objects.filter((o) => o.type === 'chart').pop();
  const tallest = () => {
    const shapes = s.graph.chartOf(chart);
    return shapes.rects.reduce((best, r) => (r.y1 > best.y1 ? r : best)).x0 + 0.5;
  };
  const before = tallest();
  s.scene.params.get('p').value = 0.7;
  const after = tallest();
  return { before, after };
});
console.log('mode of B(20; p) at p = 0.3 and 0.7:', moved);
assert.equal(moved.before, 6);
assert.equal(moved.after, 14);

// 3. The spreadsheet: typed with the keyboard
await page.click('.segments button:has-text("Tabelle")');
await page.waitForTimeout(200);
const cell = (ref) => {
  const c = ref.charCodeAt(0) - 65;
  const r = Number(ref.slice(1)) - 1;
  return `td.cell[data-c="${c}"][data-r="${r}"]`;
};
await page.click(cell('A1'));
for (const v of ['4', '8', '15', '16', '23', '42']) {
  await page.keyboard.type(v);
  await page.keyboard.press('Enter');
}
await page.click(cell('B1'));
await page.keyboard.type('=A1*2');
await page.keyboard.press('Enter');
// B1:B6 marked, filled down
await page.click(cell('B1'));
await page.click(cell('B6'), { modifiers: ['Shift'] });
await page.click('.tool-pill:has-text("↓ Füllen")');
await page.click(cell('C1'));
await page.keyboard.type('=MITTELWERT(A1:A6)');
await page.keyboard.press('Enter');
await page.click(cell('C3'));
await page.keyboard.type('=a+1');
await page.keyboard.press('Enter');
await page.click(cell('C4'));
await page.keyboard.type('=C5');
await page.keyboard.press('Enter');
await page.keyboard.type('=C4');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const grid = await page.evaluate(() => {
  const t = window.Mathe.state.table.sheet;
  const d = (ref) => t.display(ref).display;
  return { B: ['B1', 'B2', 'B6'].map((r) => [t.get(r), d(r)]), C1: d('C1'), C3: d('C3'), C4: d('C4'), shown: document.querySelector('td.cell[data-c="1"][data-r="5"]').textContent };
});
console.log(JSON.stringify(grid));
assert.deepEqual(grid.B, [['=A1*2', '8'], ['=A2*2', '16'], ['=A6*2', '84']]);
assert.equal(grid.C1, '18');
// a is not defined yet: the formula stays a term
assert.equal(grid.C3, 'a+1');
assert.equal(grid.C4, '#ZIRKEL');
assert.equal(grid.shown, '84');

// The CAS uses cells, and cells use the CAS
await page.evaluate(() => window.Mathe.state.cas.tryExample('a=5'));
await page.evaluate(() => window.Mathe.state.cas.tryExample('mittelwert(zellen(A1, A6))'));
await page.evaluate(() => window.Mathe.state.cas.tryExample('B6-A6'));
await hideKeyboard();
await page.waitForTimeout(300);
const linked = await page.evaluate(() => {
  const s = window.Mathe.state;
  const results = s.cas.rows.map((r) => r.result && r.result.ok && r.result.latex).filter(Boolean);
  return { C3: s.table.sheet.display('C3').display, last: results.slice(-2) };
});
console.log(JSON.stringify(linked));
assert.equal(linked.C3, '6');
assert.deepEqual(linked.last, ['18', '42']);

// Sort B descending by column A, filter, and a chart from the table
await page.click(cell('A1'));
await page.click(cell('B6'), { modifiers: ['Shift'] });
await page.click('.tool-pill:has-text("Sortieren")');
await page.click('.sheet .list button:has-text("nach Spalte A") >> nth=1');
const sorted = await page.evaluate(() => [1, 2, 3, 4, 5, 6].map((r) => window.Mathe.state.table.sheet.display('A' + r).display + '/' + window.Mathe.state.table.sheet.display('B' + r).display));
console.log('sorted', sorted);
assert.deepEqual(sorted, ['42/84', '23/46', '16/32', '15/30', '8/16', '4/8']);
await page.click(cell('A1'));
await page.click('.tool-pill:has-text("Filter")');
await page.fill('.sheet input', '>=16');
await page.click('.sheet button:has-text("Filtern")');
const visibleRows = await page.evaluate(() => [...new Set([...document.querySelectorAll('td.cell[data-c="0"]')].map((td) => td.textContent).filter(Boolean))]);
assert.deepEqual(visibleRows, ['42', '23', '16']);
await page.screenshot({ path: out + 'stats-table.png' });
await page.click('.tool-pill:has-text("Filter")');
await page.click('.sheet button:has-text("Aufheben")');
await page.click(cell('A1'));
await page.click(cell('B6'), { modifiers: ['Shift'] });
await page.click('.tool-pill:has-text("Diagramm")');
await page.click('.sheet .list button:has-text("Streudiagramm")');
await page.waitForTimeout(400);
const fromTable = await page.evaluate(() => {
  const s = window.Mathe.state;
  const chart = s.scene.objects.filter((o) => o.type === 'chart').pop();
  return { layout: s.layout, chart: chart.chart, dots: s.graph.chartOf(chart).dots.length };
});
assert.deepEqual(fromTable, { layout: 'both', chart: 'scatter', dots: 6 });
await page.screenshot({ path: out + 'stats-from-table.png' });

// 4. The table survives a reload
await page.waitForTimeout(800);
await page.reload();
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });
await page.waitForTimeout(400);
const restored = await page.evaluate(() => ({ B1: window.Mathe.state.table.sheet.display('B1').display, C3: window.Mathe.state.table.sheet.display('C3').display }));
assert.deepEqual(restored, { B1: '84', C3: '6' });

console.log('errors:', errors);
assert.deepEqual(errors, []);
await browser.close();
