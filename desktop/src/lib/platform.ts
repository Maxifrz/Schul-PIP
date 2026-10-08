// What the app needs from the computer around it: storage, secrets, network, files. In the Windows app these are
// calls into the main process (window.api, see electron/preload.ts); in a plain browser (development, screenshots)
// they fall back to localStorage and fetch.

import type { DoFetch } from './social/api';

export interface PickedFile {
  name: string;
  data: Uint8Array;
}

export interface DesktopApi {
  store: { read(name: string): Promise<string | null>; write(name: string, json: string): Promise<void> };
  blobs: { put(id: string, data: Uint8Array): Promise<void>; get(id: string): Promise<Uint8Array | null>; delete(id: string): Promise<void> };
  secret: { get(account: string): Promise<string | null>; set(account: string, value: string): Promise<boolean>; delete(account: string): Promise<void> };
  http(request: { url: string; method: string; headers: Record<string, string>; body?: string | Uint8Array }): Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>;
  openFiles(options: { filters?: Array<{ name: string; extensions: string[] }>; multiple?: boolean }): Promise<PickedFile[]>;
  saveFile(name: string, data: Uint8Array): Promise<boolean>;
  htmlToPdf(html: string): Promise<Uint8Array>;
  openExternal(url: string): Promise<void>;
  calc: { show(rect: { x: number; y: number; width: number; height: number }): void; hide(): void };
  onNavigate(callback: (index: number) => void): () => void;
  version: string;
}

declare global {
  interface Window {
    api?: DesktopApi;
  }
}

export const isDesktop = typeof window !== 'undefined' && window.api !== undefined;

const memoryBlobs = new Map<string, Uint8Array>();
const browserSecrets = 'schulpip.secrets';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the app still runs, it just forgets
  }
}

export const storage = {
  async read(name: string): Promise<string | null> {
    return window.api ? window.api.store.read(name) : readLocal(`schulpip.${name}`);
  },
  async write(name: string, json: string): Promise<void> {
    if (window.api) await window.api.store.write(name, json);
    else writeLocal(`schulpip.${name}`, json);
  },
};

export const blobs = {
  async put(id: string, data: Uint8Array): Promise<void> {
    if (window.api) await window.api.blobs.put(id, data);
    else memoryBlobs.set(id, data);
  },
  async get(id: string): Promise<Uint8Array | null> {
    return window.api ? window.api.blobs.get(id) : memoryBlobs.get(id) ?? null;
  },
  async delete(id: string): Promise<void> {
    if (window.api) await window.api.blobs.delete(id);
    else memoryBlobs.delete(id);
  },
};

export const secrets = {
  async get(account: string): Promise<string | null> {
    if (window.api) return window.api.secret.get(account);
    const all = JSON.parse(readLocal(browserSecrets) ?? '{}') as Record<string, string>;
    return all[account] ?? null;
  },
  async set(account: string, value: string): Promise<boolean> {
    if (window.api) return window.api.secret.set(account, value);
    const all = JSON.parse(readLocal(browserSecrets) ?? '{}') as Record<string, string>;
    all[account] = value;
    writeLocal(browserSecrets, JSON.stringify(all));
    return true;
  },
  async delete(account: string): Promise<void> {
    if (window.api) return window.api.secret.delete(account);
    const all = JSON.parse(readLocal(browserSecrets) ?? '{}') as Record<string, string>;
    delete all[account];
    writeLocal(browserSecrets, JSON.stringify(all));
  },
};

/** Network calls go through the main process, so no server needs to allow this app's origin (CORS). */
export const doFetch: DoFetch = async (url, init) => {
  if (!window.api) return fetch(url, { method: init?.method, headers: init?.headers, body: init?.body as BodyInit | undefined });
  const body = init?.body instanceof ArrayBuffer ? new Uint8Array(init.body) : (init?.body as string | Uint8Array | undefined);
  const result = await window.api.http({ url, method: init?.method ?? 'GET', headers: init?.headers ?? {}, body });
  // A Response may not carry a body for these codes.
  const empty = result.status === 204 || result.status === 205 || result.status === 304;
  return new Response(empty ? null : (result.body as unknown as BodyInit), { status: result.status, headers: result.headers });
};

export async function pickFiles(options: { filters?: Array<{ name: string; extensions: string[] }>; multiple?: boolean }): Promise<PickedFile[]> {
  if (window.api) return window.api.openFiles(options);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options.multiple ?? false;
    if (options.filters) input.accept = options.filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      resolve(await Promise.all(files.map(async (file) => ({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }))));
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export async function saveFile(name: string, data: Uint8Array): Promise<boolean> {
  if (window.api) return window.api.saveFile(name, data);
  const url = URL.createObjectURL(new Blob([data as BlobPart]));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

export async function htmlToPdf(html: string): Promise<Uint8Array | null> {
  return window.api ? window.api.htmlToPdf(html) : null;
}

export async function openExternal(url: string): Promise<void> {
  if (window.api) await window.api.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}

export function mimeFor(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt': return 'text/plain';
    default: return 'application/octet-stream';
  }
}
