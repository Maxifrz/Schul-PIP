import { describe, expect, it } from 'vitest';
import { allowedUrl, followRedirect, Outgoing } from '../src/lib/httpPolicy';

const call = (headers: Record<string, string> = {}): Outgoing => ({
  url: new URL('https://api.example.org/v1/chat'),
  method: 'POST',
  headers: { 'x-api-key': 'secret', apikey: 'anon', Authorization: 'Bearer t', 'Content-Type': 'application/json', ...headers },
  body: '{}',
});

describe('http policy', () => {
  it('allows https and plain http only in the local network', () => {
    expect(allowedUrl(new URL('https://example.org'))).toBe(true);
    expect(allowedUrl(new URL('http://192.168.1.5:11434'))).toBe(true);
    expect(allowedUrl(new URL('http://example.org'))).toBe(false);
    expect(allowedUrl(new URL('file:///etc/passwd'))).toBe(false);
  });

  it('is not a redirect for a normal answer or a missing target', () => {
    expect(followRedirect(call(), 200, null)).toBeNull();
    expect(followRedirect(call(), 302, null)).toBeNull();
  });

  it('refuses a redirect to plain http on the internet', () => {
    expect(() => followRedirect(call(), 302, 'http://evil.example.com/')).toThrow();
  });

  it('keeps keys on the same host and drops them on another one', () => {
    const same = followRedirect(call(), 307, '/v2/chat')!;
    expect(same.headers['x-api-key']).toBe('secret');
    expect(same.method).toBe('POST');
    const other = followRedirect(call(), 307, 'https://other.example.com/chat')!;
    expect(Object.keys(other.headers).map((name) => name.toLowerCase())).toEqual(['content-type']);
  });

  it('turns a POST into a GET without a body after 303', () => {
    const next = followRedirect(call(), 303, '/done')!;
    expect(next.method).toBe('GET');
    expect(next.body).toBeUndefined();
    expect(Object.keys(next.headers).map((name) => name.toLowerCase())).not.toContain('content-type');
  });
});
