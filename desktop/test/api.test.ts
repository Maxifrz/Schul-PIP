import { describe, expect, it } from 'vitest';
import { DoFetch, SocialApi } from '../src/lib/social/api';
import { Session, SocialError } from '../src/lib/social/models';

interface Seen {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: string;
}

function scripted(replies: Array<[number, string]>) {
  const seen: Seen[] = [];
  const queue = [...replies];
  const doFetch: DoFetch = async (url, init) => {
    seen.push({ url, method: init?.method, headers: init?.headers ?? {}, body: typeof init?.body === 'string' ? init.body : undefined });
    const [status, text] = queue.shift() ?? [500, '{}'];
    return new Response(text, { status });
  };
  return { seen, doFetch };
}

const server = { url: 'https://abc.supabase.co', anonKey: 'anon-key' };
const valid: Session = { accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() / 1000 + 3600, userId: '11111111-1111-1111-1111-111111111111', email: 'a@b.de', name: 'Anna' };

describe('Supabase client', () => {
  it('signs in and sends both keys', async () => {
    const { seen, doFetch } = scripted([[200, '{"access_token":"tok","refresh_token":"ref","expires_in":3600,"user":{"id":"22222222-2222-2222-2222-222222222222","email":"a@b.de","user_metadata":{"display_name":"Anna"}}}']]);
    const session = await new SocialApi(server, null, doFetch).signIn('a@b.de', 'geheim1');
    expect(session).toMatchObject({ accessToken: 'tok', name: 'Anna', userId: '22222222-2222-2222-2222-222222222222' });
    expect(seen[0].url).toBe('https://abc.supabase.co/auth/v1/token?grant_type=password');
    expect(seen[0].headers.apikey).toBe('anon-key');
    expect(seen[0].headers.Authorization).toBe('Bearer anon-key');
    expect(seen[0].body).toContain('geheim1');
  });

  it('asks to confirm the email when sign-up returns no token', async () => {
    const { doFetch } = scripted([[200, '{"id":"x","email":"a@b.de"}']]);
    await expect(new SocialApi(server, null, doFetch).signUp('Anna', 'a@b.de', 'geheim1')).rejects.toMatchObject({ kind: 'confirmEmail' });
  });

  it('says a wrong password in German', async () => {
    const { doFetch } = scripted([[400, '{"error":"invalid_grant","error_description":"Invalid login credentials"}']]);
    await expect(new SocialApi(server, null, doFetch).signIn('a@b.de', 'x')).rejects.toMatchObject({ kind: 'server', message: 'E-Mail oder Passwort stimmt nicht.' });
  });

  it('asks for new messages after the last one, with an encoded timestamp', async () => {
    const row = '[{"id":"4","group_id":"3","user_id":"1","body":"Hallo","attachment_path":null,"attachment_name":null,"created_at":"2026-10-06T12:00:01.5+00:00","profiles":{"display_name":"Anna"}}]';
    const { seen, doFetch } = scripted([[200, row]]);
    const messages = await new SocialApi(server, valid, doFetch).messages('33333333-3333-3333-3333-333333333333', '2026-10-06T12:00:00.123456+00:00');
    expect(messages[0].profiles?.displayName).toBe('Anna');
    expect(seen[0].url).toContain('group_id=eq.33333333-3333-3333-3333-333333333333');
    expect(seen[0].url).toContain('created_at=gt.2026-10-06T12%3A00%3A00.123456%2B00%3A00');
    expect(seen[0].url).toContain('order=created_at.asc');
    expect(seen[0].headers.Authorization).toBe('Bearer access');
  });

  it('joins with a code and reads the group', async () => {
    const { seen, doFetch } = scripted([[200, '{"id":"5","parent_id":null,"name":"Mathe LK","kind":"course","join_code":"K7M2QX","created_at":"x"}']]);
    const group = await new SocialApi(server, valid, doFetch).joinGroup('K7M2QX');
    expect(group).toMatchObject({ name: 'Mathe LK', joinCode: 'K7M2QX', parentId: null });
    expect(seen[0].url).toBe('https://abc.supabase.co/rest/v1/rpc/join_group');
  });

  it('passes on the server refusal as it is', async () => {
    const { doFetch } = scripted([[400, '{"message":"Diesen Code gibt es nicht.","code":"P0001"}']]);
    await expect(new SocialApi(server, valid, doFetch).joinGroup('NOPE')).rejects.toMatchObject({ message: 'Diesen Code gibt es nicht.' });
  });

  it('refreshes an expired token first', async () => {
    const { seen, doFetch } = scripted([[200, '{"access_token":"fresh","refresh_token":"ref2","expires_in":3600,"user":{"id":"11111111-1111-1111-1111-111111111111","email":"a@b.de"}}'], [200, '[]']]);
    let stored: Session | null = null;
    const api = new SocialApi(server, { ...valid, expiresAt: Date.now() / 1000 - 10 }, doFetch, (s) => (stored = s));
    await api.groups();
    expect(seen[0].url).toBe('https://abc.supabase.co/auth/v1/token?grant_type=refresh_token');
    expect(seen[1].headers.Authorization).toBe('Bearer fresh');
    expect(stored).not.toBeNull();
  });

  it('never uploads a file over 20 MB', async () => {
    const { seen, doFetch } = scripted([]);
    await expect(new SocialApi(server, valid, doFetch).upload(new Uint8Array(20 * 1024 * 1024 + 1), 'g/x.pdf', 'application/pdf')).rejects.toBeInstanceOf(SocialError);
    expect(seen).toHaveLength(0);
  });

  it('reports being offline', async () => {
    const api = new SocialApi(server, valid, async () => {
      throw new Error('network');
    });
    await expect(api.groups()).rejects.toMatchObject({ kind: 'offline' });
  });
});
