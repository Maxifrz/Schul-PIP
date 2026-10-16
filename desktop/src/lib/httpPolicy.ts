// The rules for the calls the main process makes for the renderer: where it may connect, and what a redirect may do.
import { isLocalHost } from './social/format';

export interface Outgoing {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: Uint8Array | string;
}

/** https anywhere, plain http only in the local network. */
export function allowedUrl(url: URL): boolean {
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHost(url.hostname));
}

/** Headers that may go to another host: describing the body, never a key or a token. */
const portable = new Set(['accept', 'content-type', 'content-length', 'user-agent']);

/**
 * The request to send after a redirect, or null when the answer is not a redirect. A redirect is checked like the
 * first request (https, or http in the local network), carries no key or token to a different origin, and turns a
 * POST into a GET after 301, 302 and 303 like a browser does.
 */
export function followRedirect(request: Outgoing, status: number, location: string | null): Outgoing | null {
  if (![301, 302, 303, 307, 308].includes(status) || !location) return null;
  const url = new URL(location, request.url);
  if (!allowedUrl(url)) throw new Error('Redirect to an address that is not allowed.');
  let headers = request.headers;
  if (url.origin !== request.url.origin) {
    headers = Object.fromEntries(Object.entries(headers).filter(([name]) => portable.has(name.toLowerCase())));
  }
  const toGet = status === 303 || ((status === 301 || status === 302) && request.method === 'POST');
  if (toGet) return { url, method: 'GET', headers: Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'content-type' && name.toLowerCase() !== 'content-length')) };
  return { ...request, url, headers };
}
