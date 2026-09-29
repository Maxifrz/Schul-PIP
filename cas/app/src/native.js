// The bridge to the app around the web view: iOS (WKWebView script message handler "mathe") and Android
// (JavaScript interface "MatheBridge"). Requests carry an id; the app answers through window.Mathe.reply(id, json).
// In a plain browser (tests, development) storage falls back to localStorage.

let counter = 0;
const pending = new Map();

function post(message) {
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mathe) {
    window.webkit.messageHandlers.mathe.postMessage(message);
    return true;
  }
  if (window.MatheBridge) {
    window.MatheBridge.post(JSON.stringify(message));
    return true;
  }
  return false;
}

export const hasApp = () => Boolean((window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mathe) || window.MatheBridge);

function request(type, payload = {}) {
  if (!hasApp()) return Promise.resolve(browserFallback(type, payload));
  const id = ++counter;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    post({ id, type, ...payload });
    // An app that never answers must not hang the calculator.
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve(null);
      }
    }, 8000);
  });
}

export function reply(id, value) {
  const resolve = pending.get(id);
  if (!resolve) return;
  pending.delete(id);
  resolve(value);
}

function browserFallback(type, payload) {
  const key = (name) => 'mathe.' + name;
  try {
    switch (type) {
      case 'store.get':
        return localStorage.getItem(key(payload.key));
      case 'store.set':
        localStorage.setItem(key(payload.key), payload.value);
        return true;
      case 'store.delete':
        localStorage.removeItem(key(payload.key));
        return true;
      case 'store.list':
        return Object.keys(localStorage).filter((k) => k.startsWith(key(payload.prefix || ''))).map((k) => k.slice(6));
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

/** Key–value storage in the app's own folder, so projects survive reinstalls of the web view data. */
export const store = {
  get: (key) => request('store.get', { key }),
  set: (key, value) => request('store.set', { key, value }),
  delete: (key) => request('store.delete', { key }),
  list: (prefix) => request('store.list', { prefix }).then((keys) => keys || []),
};

/** Hands a file to the system share sheet. `data` is text or base64 (with `base64: true`). */
export function share(name, mime, data, base64 = false) {
  if (!hasApp()) {
    const blob = base64 ? new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: mime }) : new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    return Promise.resolve(true);
  }
  return request('share', { name, mime, data, base64 });
}

/** Puts a PNG (base64) into a document of the library as a new page. */
export function insertIntoDocument(png) {
  return request('insertImage', { png });
}

export function notifyReady() {
  post({ type: 'ready' });
}

/** Tells the app that an exam started or ended: it then keeps the student in the calculator. */
export function examChanged(active) {
  post({ type: 'exam', active });
}
