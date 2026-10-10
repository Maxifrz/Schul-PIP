// Drives the built renderer in headless Chromium against a fake Supabase server: every area of the app, the Kurse flow
// with the Tafelbild, the game, the calculator frame. Screenshots go to build-ui/. Run: npm run build:renderer && node test/ui/smoke.mjs
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'dist');
const cas = join(root, '..', 'cas', 'web');
const out = join(root, 'build-ui');
mkdirSync(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf2': 'font/ttf' };
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const base = url.pathname.startsWith('/cas/') ? cas : dist;
  const relative = url.pathname.startsWith('/cas/') ? url.pathname.slice(4) : url.pathname;
  let file = normalize(join(base, relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(base) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end('not found');
  }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// A fake Supabase: enough of auth, tables and functions for the flow below.
const me = '11111111-1111-1111-1111-111111111111';
const db = { groups: [], messages: [], boards: [], blocks: [], versions: [], polls: [] };
let counter = 0;
const id = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const now = () => new Date().toISOString();
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });

const fake = async (route) => {
  const request = route.request();
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  const url = new URL(request.url());
  const path = url.pathname;
  const body = request.postData() ? JSON.parse(request.postData()) : {};
  const author = { display_name: 'Anna' };
  if (path === '/auth/v1/token') return json(route, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: me, email: 'anna@example.org', user_metadata: { display_name: 'Anna' } } });
  if (path === '/rest/v1/groups') return json(route, db.groups);
  if (path === '/rest/v1/members') return json(route, url.searchParams.get('select') === 'group_id' ? db.groups.map((g) => ({ group_id: g.id })) : [{ user_id: me, role: 'owner', profiles: author }]);
  if (path === '/rest/v1/messages' && request.method() === 'GET') return json(route, db.messages.map((m) => ({ ...m, profiles: author })));
  if (path === '/rest/v1/messages') { db.messages.push({ id: id(), ...body, created_at: now(), attachment_path: body.attachment_path ?? null, attachment_name: body.attachment_name ?? null }); return json(route, {}, 201); }
  if (path === '/rest/v1/results') return json(route, []);
  if (path === '/rest/v1/rpc/create_group') { const g = { id: id(), parent_id: null, name: body.p_name, kind: 'course', join_code: 'K7M2QX', created_at: now() }; db.groups.push(g); return json(route, g); }
  if (path === '/rest/v1/boards') return json(route, db.boards);
  if (path === '/rest/v1/rpc/create_board') { const b = { id: id(), group_id: body.p_group, title: body.p_title, topic: body.p_topic, template: body.p_template, lesson_date: '2026-10-08', status: 'open', created_by: me, finalized_at: null, created_at: now() }; db.boards.push(b); return json(route, b); }
  if (path === '/rest/v1/board_blocks' && request.method() === 'GET') return json(route, db.blocks.map((b) => ({ ...b, profiles: author })));
  if (path === '/rest/v1/board_blocks') { db.blocks.push({ id: body.id, board_id: body.board_id, kind: body.kind, title: body.title, body: body.body, attachment_path: null, status: 'proposed', position: 0, author: me, replaces_block: body.replaces_block ?? null, rev: 1, created_at: now(), updated_at: now() }); return json(route, {}, 201); }
  if (path === '/rest/v1/rpc/accept_block') { const b = db.blocks.find((x) => x.id === body.p_block); b.status = 'accepted'; b.position = db.blocks.filter((x) => x.status === 'accepted').length; db.versions.push({ id: id(), board_id: b.board_id, label: `Übernommen: ${b.title}`, created_at: now(), profiles: author }); return json(route, null, 204); }
  if (path === '/rest/v1/rpc/reject_block') { db.blocks.find((x) => x.id === body.p_block).status = 'rejected'; return json(route, null, 204); }
  if (path === '/rest/v1/rpc/finalize_board') { db.boards.forEach((b) => (b.status = 'final')); return json(route, null, 204); }
  if (path === '/rest/v1/polls') return json(route, db.polls);
  if (path === '/rest/v1/board_versions') return json(route, db.versions);
  if (path === '/rest/v1/rpc/poll_counts' || path === '/rest/v1/rpc/my_votes') return json(route, []);
  return json(route, { message: `fake: ${path} not handled` }, 404);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !/favicon|Failed to load resource/.test(message.text())) problems.push(`console: ${message.text()}`);
});
await page.route('https://fake.supabase.test/**', fake);
await page.route('https://openrouter.ai/api/v1/models', (route) =>
  json(route, { data: [
    { id: 'google/gemma-4-31b-it:free', name: 'Google: Gemma 4 31B (free)', context_length: 131072, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'] } },
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', context_length: 65536, pricing: { prompt: '0.1', completion: '0.2' }, architecture: { input_modalities: ['text'] } },
  ] }));

function calculatorErrors(target) {
  target.on('pageerror', (error) => problems.push(`calculator pageerror: ${error.message}`));
}
let failures = 0;
process.on('uncaughtException', async (error) => {
  console.log('FAILED:', error.message.split('\n')[0]);
  try { await page.screenshot({ path: join(out, 'failure.png') }); console.log('page text:', (await page.locator('body').innerText()).slice(0, 600)); } catch {}
  console.log(problems.join('\n'));
  process.exit(1);
});
const check = (name, condition) => {
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}`);
  if (!condition) failures += 1;
};
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });

await page.goto(origin);
await page.waitForSelector('.sidebar');
check('shell with six areas', (await page.locator('.nav').count()) === 6);
await shot('01-heute');

// Heute: the game
await page.keyboard.press('ArrowRight');
await page.waitForSelector('.hero canvas');
await page.waitForTimeout(400);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(250);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(1200);
await shot('02-spiel');
check('game canvas is drawn', await page.evaluate(() => { const c = document.querySelector('.hero canvas'); return c && c.width > 100; }));
await page.keyboard.press('Escape');
check('escape leaves the game', (await page.locator('.hero canvas').count()) === 0 || (await page.locator('.hero .ghost').count()) === 0);

// Karten
await page.click('text=Karten >> nth=0');
await page.getByRole('button', { name: 'Neue Karte', exact: true }).click();
await page.fill('input[placeholder="Frage"]', 'Hauptstadt von Deutschland?');
await page.fill('textarea[placeholder="Antwort"]', 'Berlin');
await page.getByRole('button', { name: 'Karte speichern', exact: true }).click();
await page.waitForSelector('.review .front');
await page.fill('.review input', 'berlin');
await page.getByRole('button', { name: 'Prüfen', exact: true }).click();
check('right answer says Richtig', (await page.locator('.verdict').innerText()) === 'Richtig');
await shot('03-karten');
await page.getByRole('button', { name: 'Weiter', exact: true }).click();
check('cards are done afterwards', (await page.locator('text=Alles wiederholt').count()) === 1);

// Bibliothek with a generated PDF
const pdf = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 5 0 R/Resources<</Font<</F1 6 0 R>>>>>>endobj
4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 7 0 R/Resources<</Font<</F1 6 0 R>>>>>>endobj
5 0 obj<</Length 44>>stream
BT /F1 24 Tf 20 100 Td (Seite eins) Tj ET
endstream endobj
6 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
7 0 obj<</Length 44>>stream
BT /F1 24 Tf 20 100 Td (Seite zwei) Tj ET
endstream endobj
trailer<</Root 1 0 R/Size 8>>
%%EOF`);
writeFileSync(join(out, 'test.pdf'), pdf);
await page.click('.nav:has-text("Bibliothek")');
const chooser = page.waitForEvent('filechooser');
await page.click('text=PDF importieren');
await (await chooser).setFiles(join(out, 'test.pdf'));
await page.waitForSelector('text=Seite 1');
check('PDF appears in the library', (await page.locator('.card:has-text("test")').count()) === 1);
await page.click('text=Öffnen');
await page.waitForSelector('canvas.pdf-page');
await page.waitForTimeout(800);
await shot('04-pdf');
check('PDF page is drawn', await page.evaluate(() => { const c = document.querySelector('canvas.pdf-page'); return c && c.width > 100; }));
await page.click('text=← Bibliothek');

// Rechner
await page.click('.nav:has-text("Rechner")');
await page.waitForSelector('.calc-slot');
check('calculator slot is there (the page itself is shown by the Windows app)', true);
// The calculator page, as the app shows it: on its own, at the top level.
const calculator = await browser.newPage({ viewport: { width: 1100, height: 760 } });
calculatorErrors(calculator);
await calculator.goto(`${origin}/cas/mathe.html`);
await calculator.locator('#app *').first().waitFor({ timeout: 20000 });
await calculator.waitForTimeout(1500);
await calculator.screenshot({ path: join(out, '05-rechner.png') });
check('calculator page loads at the top level', true);
await calculator.close();

// Kurse
await page.click('.nav:has-text("Kurse")');
await page.fill('input[placeholder^="Projekt-Adresse"]', 'https://fake.supabase.test');
const key = `e30.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.sig`;
await page.fill('input[placeholder="anon public key"]', key);
await page.getByRole('button', { name: 'Verbinden', exact: true }).click();
await page.fill('input[type=email]', 'anna@example.org');
await page.fill('input[type=password]', 'geheim1');
await page.click('button[type=submit]');
await page.waitForSelector('text=Kurs anlegen');
await shot('06-kurse-leer');
await page.getByRole('button', { name: 'Kurs anlegen', exact: true }).click();
await page.fill('.dialog input', 'Mathe LK 12');
await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
await page.waitForSelector('h2:has-text("Mathe LK 12")');
await page.fill('.composer textarea', 'Hallo Kurs');
await page.keyboard.press('Enter');
await page.waitForSelector('.msg:has-text("Hallo Kurs")', { timeout: 8000 });
await shot('07-chat');
check('chat message arrives', true);

await page.click('.tabs >> text=Tafelbild');
await page.getByRole('button', { name: 'Ergebnissicherung starten', exact: true }).click();
await page.fill('.dialog input[placeholder^="Thema"]', 'Integralrechnung');
await page.getByRole('button', { name: 'Starten', exact: true }).click();
await page.waitForSelector('text=Moderation');
await page.click('text=+ Definition');
await page.fill('.dialog input', 'Bestimmtes Integral');
await page.fill('.dialog textarea', 'Flächenbilanz zwischen zwei Grenzen');
await page.getByRole('button', { name: 'Direkt übernehmen', exact: true }).click();
await page.waitForSelector('.card:has-text("Flächenbilanz")', { timeout: 8000 });
await page.click('text=+ Formel');
await page.fill('.dialog input', 'Hauptsatz');
await page.click('.symbols button >> nth=0');
await page.fill('.dialog textarea', '∫ₐᵇ f(x) dx = F(b) − F(a)');
await page.getByRole('button', { name: 'Vorschlagen', exact: true }).click();
await page.waitForSelector('.pill:has-text("Vorschläge · 1")', { timeout: 8000 });
await shot('08-tafelbild');
await page.click('.pill:has-text("Vorschläge")');
await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
await page.locator('.pill:has-text("Tafelbild")').nth(1).click();
await page.waitForSelector('.formula', { timeout: 8000 });
check('formula block is on the board', true);
await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
await page.locator('.dialog').getByRole('button', { name: 'Abschließen', exact: true }).click();
await page.waitForSelector('text=KI prüft das Ergebnis', { timeout: 8000 });
await shot('09-final');
await page.getByRole('button', { name: 'Karteikarten erzeugen', exact: true }).click();
await page.click('.nav:has-text("Karten")');
check('flashcards from the board arrive', (await page.locator('.card:has-text("Definition: Bestimmtes Integral")').count()) === 1);

// Einstellungen with the model search
await page.click('.nav:has-text("Einstellungen")');
await page.click('text=Modell wählen');
await page.waitForSelector('text=2 Modelle verfügbar', { timeout: 5000 }).catch(() => {});
await page.fill('.dialog input[placeholder="Alle Modelle durchsuchen"]', 'gemma');
check('model search finds a model', (await page.locator('.dialog .item:has-text("gemma-4-31b-it:free")').count()) === 1);
await shot('10-modelle');
await page.keyboard.press('Escape');
await shot('11-einstellungen');

await browser.close();
server.close();
if (problems.length > 0) {
  console.log('Problems in the page:');
  problems.forEach((p) => console.log('  ' + p));
}
if (failures > 0 || problems.length > 0) process.exit(1);
console.log('smoke test passed');
