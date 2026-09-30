// The calculator's layout: the splitter between rows and graphics, the keyboard button, the command list above the keyboard.
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
await page.goto('file://' + new URL('../../../web/mathe.html', import.meta.url).pathname);
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' ' + detail));
  if (!ok) failed++;
};
const width = (selector) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().width, selector);

// Side by side: the splitter is there and drags
await page.evaluate(() => window.Mathe.state.cas.rows.length);
const before = await width('.cas-pane');
const box = await page.locator('.splitter').boundingBox();
check('splitter visible side by side', !!box && box.width > 8);
await page.mouse.move(box.x + box.width / 2, box.y + 150);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 120, box.y + 150, { steps: 6 });
await page.mouse.up();
const after = await width('.cas-pane');
check('drag widens the rows', after > before + 80, `${before} -> ${after}`);
const narrow = await page.locator('.splitter').boundingBox();
await page.mouse.move(narrow.x + narrow.width / 2, narrow.y + 150);
await page.mouse.down();
await page.mouse.move(20, narrow.y + 150, { steps: 6 });
await page.mouse.up();
check('rows keep a minimum width', (await width('.cas-pane')) >= 239, String(await width('.cas-pane')));
check('graphics keep room too', (await width('.graph-pane')) > 200);

// Hiding the rows
await page.click('.splitter-toggle');
check('rows hidden', (await page.evaluate(() => getComputedStyle(document.querySelector('.cas-pane')).display)) === 'none');
check('graphics take the room', (await width('.graph-pane')) > 800, String(await width('.graph-pane')));
await page.click('.splitter-toggle');
check('rows back', (await width('.cas-pane')) > 200);

// The width survives a reload
const saved = await width('.cas-pane');
await page.reload();
await page.waitForFunction(() => document.querySelector('.status.ready'), null, { timeout: 60000 });
check('width remembered', Math.abs((await width('.cas-pane')) - saved) < 3, `${saved} -> ${await width('.cas-pane')}`);
// Double tap: standard width
await page.dblclick('.splitter', { position: { x: 8, y: 150 } });
check('double tap resets', Math.abs((await width('.cas-pane')) - 1180 * 0.42) < 30, String(await width('.cas-pane')));

// The keyboard button
await page.evaluate(() => { const c = window.Mathe.state.cas; c.focus(c.rows[c.rows.length - 1]); });
await page.waitForTimeout(500);
check('keyboard shown on focus', await page.evaluate(() => window.mathVirtualKeyboard.visible));
await page.click('.kb-toggle');
await page.waitForTimeout(500);
check('button puts the keyboard away', !(await page.evaluate(() => window.mathVirtualKeyboard.visible)));
await page.evaluate(() => { const c = window.Mathe.state.cas; c.focus(c.rows[0]); });
await page.waitForTimeout(400);
check('focus does not bring it back', !(await page.evaluate(() => window.mathVirtualKeyboard.visible)));
await page.click('.kb-toggle');
await page.waitForTimeout(500);
check('button brings it back', await page.evaluate(() => window.mathVirtualKeyboard.visible));

// The command list ends above the keyboard and nothing is cut off at the right
await page.click('text=Befehle');
await page.waitForTimeout(400);
const geometry = await page.evaluate(() => {
  const panel = document.querySelector('.panel').getBoundingClientRect();
  const keyboard = window.mathVirtualKeyboard.boundingRect;
  const chips = [...document.querySelectorAll('.panel .chips button')].map((b) => b.getBoundingClientRect());
  return { panelRight: panel.right, viewport: window.innerWidth, padding: parseFloat(getComputedStyle(document.querySelector('.panel')).paddingBottom), keyboard: keyboard.height, chipRight: Math.max(...chips.map((c) => c.right)), panelWidth: panel.width };
});
check('panel padded by the keyboard', geometry.padding >= geometry.keyboard - 2, JSON.stringify(geometry));
check('panel inside the window', geometry.panelRight <= geometry.viewport + 1, JSON.stringify(geometry));
check('chip row stays inside the panel', await page.evaluate(() => document.querySelector('.panel .chips').getBoundingClientRect().right <= document.querySelector('.panel').getBoundingClientRect().right + 1));
check('search field not wider than the panel', await page.evaluate(() => document.querySelector('.panel .search').getBoundingClientRect().right <= document.querySelector('.panel').getBoundingClientRect().right));
check('no stray null in the chips', !(await page.evaluate(() => document.querySelector('.panel .chips').textContent.includes('null'))));
await page.screenshot({ path: out + 'layout-panel.png' });

check('no page errors', errors.length === 0, JSON.stringify(errors));
await browser.close();
process.exit(failed ? 1 : 0);
