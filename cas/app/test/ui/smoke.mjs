// Drives the calculator page in headless Chromium: types, calculates, takes screenshots into build/.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const executablePath = process.env.CHROMIUM || undefined;
const out = new URL('../../build/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await playwright.chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + new URL('../../../web/mathe.html', import.meta.url).pathname);
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });

async function typeRow(text, { text: textMode = false } = {}) {
  if (textMode) {
    await page.evaluate((t) => window.Mathe.state.cas.tryExample(t), text);
  } else {
    await page.evaluate(() => { const rows = window.Mathe.state.cas.rows; window.Mathe.state.cas.focus(rows[rows.length - 1]); });
    await page.waitForTimeout(100);
    await page.keyboard.type(text, { delay: 10 });
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(150);
}

await typeRow('f(x)=x^3-3x');
await typeRow('loese(x^2-5x+6=0,x)');
await typeRow('kurvendiskussion(x^3-3x)', { text: true });
await typeRow('integriere(x*exp(x), x)', { text: true });
await typeRow('löse(x^2-4>=0, x)', { text: true });
console.log(await page.evaluate(() => window.Mathe.state.cas.rows.map((r) => r.latex || r.text)));
const results = await page.evaluate(() => window.Mathe.state.cas.rows.map((r) => r.result && (r.result.ok ? r.result.latex || r.result.title : 'ERR ' + r.result.error)));
console.log(JSON.stringify(results, null, 1));
await page.evaluate(() => window.mathVirtualKeyboard.hide());
await page.screenshot({ path: out + 'cas.png' });
await page.evaluate(() => { const rows = window.Mathe.state.cas.rows; window.Mathe.state.cas.focus(rows[rows.length - 1]); window.mathVirtualKeyboard.show(); });
await page.waitForTimeout(400);
await page.screenshot({ path: out + 'cas-keyboard.png' });
await page.click('text=Befehle');
await page.waitForTimeout(200);
await page.fill('.search', 'normal');
await page.waitForTimeout(200);
await page.screenshot({ path: out + 'cas-commands.png' });
await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
await page.waitForTimeout(100);
await page.screenshot({ path: out + 'cas-dark.png' });
console.log('errors:', JSON.stringify(errors));
await browser.close();
