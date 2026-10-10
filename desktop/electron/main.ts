// The main process of the Windows app: one window, the app's own schulpip:// protocol (so the renderer and the calculator
// load as if from a web server), storage in the user's data folder, secrets sealed with the Windows account (DPAPI), and
// the network calls of the renderer.

import { BrowserWindow, Menu, WebContentsView, app, dialog, ipcMain, net, protocol, safeStorage, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isLocalHost } from '../src/lib/social/format';

protocol.registerSchemesAsPrivileged([
  { scheme: 'schulpip', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const devUrl = process.env.SCHULPIP_DEV_URL;
const dataDir = () => path.join(app.getPath('userData'), 'data');
const blobDir = () => path.join(app.getPath('userData'), 'blobs');
const rendererDir = () => path.join(app.getAppPath(), 'dist');
const casDir = () => (app.isPackaged ? path.join(process.resourcesPath, 'cas') : path.join(app.getAppPath(), '..', 'cas', 'web'));

let window: BrowserWindow | null = null;
let calculator: WebContentsView | null = null;

// The page every response for the app itself carries: no network from the page (calls go through the main process),
// no remote scripts, no frames except our own protocol.
const appPolicy =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'";

function createWindow(): void {
  window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#171714',
    title: 'Schul-PIP',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  // Links open in the browser; the window itself never leaves the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('schulpip://') && !(devUrl && url.startsWith(devUrl))) event.preventDefault();
  });
  void window.loadURL(devUrl ?? 'schulpip://app/index.html');
  window.on('closed', () => {
    window = null;
    calculator = null;
  });
}

// The calculator is a page of its own (MathLive refuses to run its keyboard inside an iframe), shown in a view that the
// renderer positions over the free space of its window.

function ensureCalculator(): WebContentsView | null {
  if (!window) return null;
  if (!calculator) {
    calculator = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    calculator.setBackgroundColor('#171714');
    window.contentView.addChildView(calculator);
    void calculator.webContents.loadURL('schulpip://cas/mathe.html');
    calculator.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//i.test(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    // Ctrl+1 to Ctrl+6 switch the area even while the calculator has the keyboard.
    calculator.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.control && !input.alt && !input.shift && /^[1-6]$/.test(input.key)) {
        event.preventDefault();
        window?.webContents.send('navigate', Number(input.key) - 1);
      }
    });
  }
  return calculator;
}

function registerCalculator(): void {
  ipcMain.on('calc:show', (_event, rect: { x: number; y: number; width: number; height: number }) => {
    const view = ensureCalculator();
    if (!view || !rect) return;
    const [x, y, width, height] = [rect.x, rect.y, rect.width, rect.height].map((n) => Math.max(0, Math.round(Number(n) || 0)));
    view.setBounds({ x, y, width, height });
    view.setVisible(true);
  });
  ipcMain.on('calc:hide', () => {
    calculator?.setVisible(false);
  });
}

// Files served to the window: the app (dist) and the calculator (cas/web)

function registerProtocol(): void {
  protocol.handle('schulpip', async (request) => {
    const url = new URL(request.url);
    const root = path.resolve(url.hostname === 'cas' ? casDir() : rendererDir());
    let relative = decodeURIComponent(url.pathname);
    if (relative === '/' || relative === '') relative = url.hostname === 'cas' ? '/mathe.html' : '/index.html';
    const file = path.resolve(path.join(root, relative));
    if (file !== root && !file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const response = await net.fetch(pathToFileURL(file).toString());
      if (url.hostname === 'cas') return response;
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', appPolicy);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

// Storage

const safeName = (name: unknown): string => {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]{0,30}$/.test(name)) throw new Error('bad name');
  return name;
};
const safeId = (id: unknown): string => {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new Error('bad id');
  return id;
};

async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, data);
  await fs.rename(temporary, file);
}

async function readOrNull(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

function registerStorage(): void {
  ipcMain.handle('store:read', async (_event, name: unknown) => {
    const data = await readOrNull(path.join(dataDir(), `${safeName(name)}.json`));
    return data ? data.toString('utf8') : null;
  });
  ipcMain.handle('store:write', async (_event, name: unknown, json: unknown) => {
    if (typeof json !== 'string') throw new Error('bad data');
    await writeAtomic(path.join(dataDir(), `${safeName(name)}.json`), json);
  });
  ipcMain.handle('blob:put', async (_event, id: unknown, data: unknown) => {
    if (!(data instanceof Uint8Array)) throw new Error('bad data');
    await writeAtomic(path.join(blobDir(), safeId(id)), data);
  });
  ipcMain.handle('blob:get', async (_event, id: unknown) => {
    const data = await readOrNull(path.join(blobDir(), safeId(id)));
    return data ? new Uint8Array(data) : null;
  });
  ipcMain.handle('blob:delete', async (_event, id: unknown) => {
    await fs.rm(path.join(blobDir(), safeId(id)), { force: true });
  });
}

// Secrets: API keys and the session token are sealed with the Windows account and never leave this process unsealed.

const secretsFile = () => path.join(app.getPath('userData'), 'secrets.json');

async function readSecrets(): Promise<Record<string, string>> {
  const data = await readOrNull(secretsFile());
  try {
    return data ? (JSON.parse(data.toString('utf8')) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function registerSecrets(): void {
  const account = (value: unknown): string => {
    if (typeof value !== 'string' || !/^[a-zA-Z][a-zA-Z0-9.-]{0,60}$/.test(value)) throw new Error('bad account');
    return value;
  };
  ipcMain.handle('secret:get', async (_event, name: unknown) => {
    const sealed = (await readSecrets())[account(name)];
    if (!sealed || !safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(sealed, 'base64'));
    } catch {
      return null;
    }
  });
  ipcMain.handle('secret:set', async (_event, name: unknown, value: unknown) => {
    if (typeof value !== 'string' || !safeStorage.isEncryptionAvailable()) return false;
    const all = await readSecrets();
    all[account(name)] = safeStorage.encryptString(value).toString('base64');
    await writeAtomic(secretsFile(), JSON.stringify(all));
    return true;
  });
  ipcMain.handle('secret:delete', async (_event, name: unknown) => {
    const all = await readSecrets();
    delete all[account(name)];
    await writeAtomic(secretsFile(), JSON.stringify(all));
  });
}

// Network

interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | Uint8Array;
}

function registerNetwork(): void {
  ipcMain.handle('http', async (_event, request: HttpRequest) => {
    const url = new URL(request.url);
    const allowed = url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHost(url.hostname));
    if (!allowed) throw new Error('Only https (or http in the local network) is allowed.');
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(request.method)) throw new Error('bad method');
    const body = request.body === undefined ? undefined : typeof request.body === 'string' ? request.body : Buffer.from(request.body);
    const response = await net.fetch(url.toString(), { method: request.method, headers: request.headers, body, redirect: 'follow' });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { status: response.status, headers, body: new Uint8Array(await response.arrayBuffer()) };
  });
  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion();
  });
  ipcMain.handle('open-external', async (_event, url: unknown) => {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) await shell.openExternal(url);
  });
}

// Files

const maxPickedBytes = 200 * 1024 * 1024;

function registerFiles(): void {
  ipcMain.handle('files:open', async (_event, options: { filters?: Array<{ name: string; extensions: string[] }>; multiple?: boolean }) => {
    const parent = window ?? undefined;
    const properties: Array<'openFile' | 'multiSelections'> = options?.multiple ? ['openFile', 'multiSelections'] : ['openFile'];
    const result = parent
      ? await dialog.showOpenDialog(parent, { properties, filters: options?.filters })
      : await dialog.showOpenDialog({ properties, filters: options?.filters });
    if (result.canceled) return [];
    const files: Array<{ name: string; data: Uint8Array }> = [];
    for (const file of result.filePaths) {
      const stat = await fs.stat(file);
      if (stat.size > maxPickedBytes) continue;
      files.push({ name: path.basename(file), data: new Uint8Array(await fs.readFile(file)) });
    }
    return files;
  });
  ipcMain.handle('files:save', async (_event, name: unknown, data: unknown) => {
    if (typeof name !== 'string' || !(data instanceof Uint8Array)) throw new Error('bad data');
    const parent = window ?? undefined;
    const options = { defaultPath: path.basename(name) };
    const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, data);
    return true;
  });
  // The finished Tafelbild as a PDF: printed from a page that has no scripts and no network.
  ipcMain.handle('pdf:html', async (_event, html: unknown) => {
    if (typeof html !== 'string') throw new Error('bad data');
    const printer = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
    try {
      await printer.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      const pdf = await printer.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.7, bottom: 0.7, left: 0.7, right: 0.7 } });
      return new Uint8Array(pdf);
    } finally {
      printer.destroy();
    }
  });
}

// Start

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerProtocol();
    registerStorage();
    registerSecrets();
    registerNetwork();
    registerFiles();
    registerCalculator();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
