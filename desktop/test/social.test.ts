import { describe, expect, it } from 'vitest';
import { addressMessage, checkServer, german, keyRole, merge, normalizeCode, queryString, storagePath, timeLabel } from '../src/lib/social/format';

describe('server address', () => {
  it('is reduced to the project base', () => {
    expect(checkServer('https://abc.supabase.co')).toEqual({ kind: 'valid', url: 'https://abc.supabase.co' });
    expect(checkServer(' https://abc.supabase.co/rest/v1/?x=1 ')).toEqual({ kind: 'valid', url: 'https://abc.supabase.co' });
    expect(checkServer('http://192.168.1.5:54321')).toEqual({ kind: 'valid', url: 'http://192.168.1.5:54321' });
    expect(checkServer('http://example.com')).toEqual({ kind: 'insecureRemote' });
    expect(checkServer('abc.supabase.co').kind).toBe('invalid');
    expect(checkServer('').kind).toBe('empty');
    expect(addressMessage({ kind: 'invalid' })).not.toBeNull();
    expect(addressMessage(checkServer('https://abc.supabase.co'))).toBeNull();
  });
});

describe('codes, paths, queries', () => {
  it('normalises join codes', () => {
    expect(normalizeCode(' k7m-2qx ')).toBe('K7M2QX');
    expect(normalizeCode('K7M 2QX\n')).toBe('K7M2QX');
  });

  it('keeps storage paths in the group folder and safe', () => {
    const group = '11111111-2222-3333-4444-555555555555';
    const path = storagePath(group, 'Übungsblatt Nr. 3 (final)!.PDF', () => 'ABCD1234');
    expect(path).toBe(`${group}/abcd1234-Ubungsblatt-Nr--3--final--.pdf`);
    expect(storagePath(group, '???', () => 'x')).toContain('/x-');
  });

  it('encodes plus signs in timestamps', () => {
    expect(queryString([['created_at', 'gt.2026-10-06T12:00:00.123456+00:00'], ['select', 'id,profiles(display_name)']])).toBe(
      'created_at=gt.2026-10-06T12%3A00%3A00.123456%2B00%3A00&select=id,profiles(display_name)',
    );
  });
});

describe('messages and labels', () => {
  const message = (id: string, createdAt: string) => ({ id, createdAt });
  it('merges without duplicates, oldest first', () => {
    const a = message('a', '2026-10-06T12:00:00.100000+00:00');
    const b = message('b', '2026-10-06T12:00:00.200000+00:00');
    const c = message('c', '2026-10-06T12:00:01.000000+00:00');
    expect(merge([a, c], [b, c]).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('shows server messages in German', () => {
    expect(german('Invalid login credentials')).toBe('E-Mail oder Passwort stimmt nicht.');
    expect(german('User already registered')).toBe('Diese E-Mail ist schon registriert. Melde dich an.');
    expect(german('Diesen Code gibt es nicht.')).toBe('Diesen Code gibt es nicht.');
  });

  it('labels times', () => {
    const now = new Date(2026, 9, 6, 20, 0);
    expect(timeLabel(new Date(2026, 9, 6, 12, 5).toISOString(), now)).toBe('12:05');
    expect(timeLabel(new Date(2026, 9, 5, 7, 30).toISOString(), now)).toBe('5. Okt, 7:30');
    expect(timeLabel('gestern', now)).toBe('');
  });

  it('recognises a service_role key', () => {
    const key = (role: string) => `e30.${btoa(JSON.stringify({ role })).replace(/=/g, '')}.sig`;
    expect(keyRole(key('service_role'))).toBe('service_role');
    expect(keyRole(key('anon'))).toBe('anon');
    expect(keyRole('not-a-jwt')).toBeNull();
  });
});
