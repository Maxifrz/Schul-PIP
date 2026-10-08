// Starts the real Electron app (build first: npm run build) and checks what only Electron can: the schulpip:// protocol, the
// preload bridge, storage, the network call of the main process, the PDF printer and the calculator view.
// Needs a display: on Linux run it as `xvfb-run -a node test/ui/electron.mjs`.
import { mkdirSync, mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'build-ui');
mkdirSync(out, { recursive: true });
const userData = mkdtempSync(join(tmpdir(), 'schulpip-'));

let failures = 0;
const check = (name, condition, detail = '') => {
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}${condition ? '' : ' ' + detail}`);
  if (!condition) failures += 1;
};

const local = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'application/json', 'x-test': 'yes' });
  response.end(JSON.stringify({ ok: true, method: request.method }));
});
await new Promise((resolve) => local.listen(0, '127.0.0.1', resolve));
const localPort = local.address().port;

// PACKAGED=path/to/the/built/executable tests the installed layout (asar, resources) instead of the source folder.
const packaged = process.env.PACKAGED;
const electronPath = packaged ?? (await import('electron')).default;
const appArgs = packaged ? [] : [root];
const app = await electron.launch({ executablePath: electronPath, args: ['--no-sandbox', `--user-data-dir=${userData}`, ...appArgs] });
const page = await app.firstWindow();
const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});
await page.waitForSelector('.sidebar', { timeout: 20000 });
check('the app loads from schulpip://app', page.url().startsWith('schulpip://app/'), page.url());
check('fonts are served by the protocol', await page.evaluate(async () => { await document.fonts.load("16px 'Hanken Grotesk'"); return document.fonts.check("16px 'Hanken Grotesk'"); }));
check('the preload bridge exists', await page.evaluate(() => typeof window.api?.store?.read === 'function' && window.api.version.length > 0));
await page.screenshot({ path: join(out, 'e1-heute.png') });

// Storage and blobs
await page.evaluate(async () => {
  await window.api.store.write('probe', JSON.stringify({ a: 1 }));
  await window.api.blobs.put('probe-blob-0001', new Uint8Array([1, 2, 3]));
});
check('storage round trip', (await page.evaluate(() => window.api.store.read('probe'))) === '{"a":1}');
check('blob round trip', (await page.evaluate(async () => Array.from((await window.api.blobs.get('probe-blob-0001')) ?? []))).join() === '1,2,3');
check('bad names are refused', await page.evaluate(async () => { try { await window.api.store.read('../../etc/passwd'); return false; } catch { return true; } }));
check('data landed in the user data folder', existsSync(join(userData, 'data', 'probe.json')));

// A card survives a restart: add it, wait for the debounce, restart.
await page.click('.nav:has-text("Karten")');
await page.getByRole('button', { name: 'Neue Karte', exact: true }).click();
await page.fill('input[placeholder="Frage"]', 'Persistenz?');
await page.fill('textarea[placeholder="Antwort"]', 'Ja');
await page.getByRole('button', { name: 'Karte speichern', exact: true }).click();
await page.waitForTimeout(800);
check('cards are written to disk', existsSync(join(userData, 'data', 'cards.json')) && readFileSync(join(userData, 'data', 'cards.json'), 'utf8').includes('Persistenz?'));

// The network call of the main process
const http = await page.evaluate(async (port) => {
  const reply = await window.api.http({ url: `http://127.0.0.1:${port}/x`, method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  return { status: reply.status, header: reply.headers['x-test'], body: new TextDecoder().decode(reply.body) };
}, localPort);
check('http goes through the main process', http.status === 200 && http.header === 'yes' && http.body.includes('"POST"'), JSON.stringify(http));
check('plain http to a remote host is refused', await page.evaluate(async () => { try { await window.api.http({ url: 'http://example.com/', method: 'GET', headers: {} }); return false; } catch { return true; } }));
check('other protocols are refused', await page.evaluate(async () => { try { await window.api.http({ url: 'file:///etc/passwd', method: 'GET', headers: {} }); return false; } catch { return true; } }));

// PDF printer
const pdf = await page.evaluate(async () => Array.from((await window.api.htmlToPdf('<h1>Tafelbild</h1><p>Flächenbilanz</p>')).slice(0, 5)));
check('the printer makes a PDF', String.fromCharCode(...pdf) === '%PDF-');

// Secrets: sealed with the OS where it can be (on Linux without a keyring it says no, and must not crash)
const sealed = await page.evaluate(async () => { const ok = await window.api.secret.set('llm.test', 'geheim'); return { ok, back: await window.api.secret.get('llm.test') }; });
check('secrets answer without crashing', sealed.ok === false || sealed.back === 'geheim', JSON.stringify(sealed));
if (existsSync(join(userData, 'secrets.json'))) check('secrets are not stored in clear text', !readFileSync(join(userData, 'secrets.json'), 'utf8').includes('geheim'));

// The calculator in its own view
await page.click('.nav:has-text("Rechner")');
await page.waitForSelector('.calc-slot');
await page.waitForTimeout(500);
let views = await app.evaluate(({ BrowserWindow }) => {
  const window = BrowserWindow.getAllWindows()[0];
  return window.contentView.children.map((view) => ({ url: view.webContents.getURL(), visible: view.getVisible(), bounds: view.getBounds() }));
});
check('the calculator view exists and is visible', views.length === 1 && views[0].url.startsWith('schulpip://cas/mathe.html') && views[0].visible && views[0].bounds.width > 400, JSON.stringify(views));
await page.waitForTimeout(9000);
const calc = await app.evaluate(async ({ BrowserWindow }) => {
  const view = BrowserWindow.getAllWindows()[0].contentView.children[0];
  return view.webContents.executeJavaScript('({ ready: !!window.__giacReady, text: (document.querySelector("#app")?.innerText || "").slice(0, 80) })');
});
check('the calculator starts Giac inside Electron', calc.ready === true, JSON.stringify(calc));
await page.screenshot({ path: join(out, 'e2-rechner.png') });
await page.click('.nav:has-text("Heute")');
await page.waitForTimeout(300);
views = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.map((view) => view.getVisible()));
check('the calculator view hides when another area opens', views[0] === false, JSON.stringify(views));

await app.close();
local.close();

// A second start finds the card again.
const again = await electron.launch({ executablePath: electronPath, args: ['--no-sandbox', `--user-data-dir=${userData}`, ...appArgs] });
const second = await again.firstWindow();
await second.waitForSelector('.sidebar', { timeout: 20000 });
await second.click('.nav:has-text("Karten")');
await second.waitForSelector('text=Persistenz?', { timeout: 5000 }).catch(() => {});
check('the card is still there after a restart', (await second.locator('text=Persistenz?').count()) > 0);
await again.close();

if (problems.length > 0) {
  console.log('Problems in the page:');
  problems.forEach((p) => console.log('  ' + p));
}
if (failures > 0 || problems.length > 0) process.exit(1);
console.log('electron test passed');
