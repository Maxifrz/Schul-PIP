// Pure helpers of the Kurse tab: a port of Lernwerk/Services/Social/SocialModels.swift (enum Social).

export const maxFileBytes = 20 * 1024 * 1024;
export const maxMessageLength = 4000;

export type AddressCheck =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'insecureRemote' }
  | { kind: 'valid'; url: string };

/** Hosts a plain http connection may reach: this PC, `.local` names, names without a dot and private address ranges. */
export function isLocalHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local') || !lower.includes('.')) return true;
  const octets = lower.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : NaN));
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31);
}

/** "https://abc.supabase.co", with or without a trailing slash or path, leads to the project's base address. */
export function checkServer(text: string): AddressCheck {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'invalid' };
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '') return { kind: 'invalid' };
  if (url.protocol === 'http:' && !isLocalHost(url.hostname)) return { kind: 'insecureRemote' };
  return { kind: 'valid', url: `${url.protocol}//${url.host}` };
}

export function addressMessage(check: AddressCheck): string | null {
  switch (check.kind) {
    case 'empty': return 'Trag die Projekt-Adresse ein, z. B. https://abcdefgh.supabase.co.';
    case 'invalid': return 'Das ist keine gültige Adresse. Sie beginnt mit https://.';
    case 'insecureRemote': return 'http:// funktioniert nur im lokalen Netz. Nimm https://.';
    default: return null;
  }
}

/** What a student typed for a join code: capitals, no spaces or dashes ("abc-12 3" becomes "ABC123"). */
export function normalizeCode(text: string): string {
  return Array.from(text.toUpperCase()).filter((c) => /[\p{L}\p{N}]/u.test(c)).join('');
}

/** The folder in the bucket is the group's id, which is what the storage policy checks. */
export function storagePath(group: string, fileName: string, random: () => string = () => crypto.randomUUID().slice(0, 8)): string {
  const dot = fileName.lastIndexOf('.');
  const extension = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName).normalize('NFD').replace(/\p{M}/gu, '');
  const safe = Array.from(stem).slice(0, 40).map((c) => (/[\p{L}\p{N}]/u.test(c) ? c : '-')).join('');
  const name = safe === '' ? 'datei' : safe;
  return `${group.toLowerCase()}/${random().toLowerCase()}-${name}${extension === '' ? '' : '.' + extension}`;
}

/** A query string with every value percent-encoded; "+" in a timestamp must not turn into a space. */
export function queryString(items: Array<[string, string]>): string {
  const encode = (value: string) => encodeURIComponent(value).replace(/%2C/g, ',');
  return items.map(([name, value]) => `${encode(name)}=${encode(value)}`).join('&');
}

export interface Timestamped {
  id: string;
  createdAt: string;
}

/** New messages merged into the ones already shown: no duplicates, oldest first. */
export function merge<T extends Timestamped>(existing: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of [...existing, ...incoming]) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? -1 : 1));
}

/** "Invalid login credentials" and friends, in German; the server's own German messages pass through. */
export function german(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmt nicht.';
  if (lower.includes('already registered') || lower.includes('already been registered')) return 'Diese E-Mail ist schon registriert. Melde dich an.';
  if (lower.includes('email not confirmed')) return 'Bestätige zuerst die E-Mail, die du bekommen hast.';
  if (lower.includes('password should be at least')) return 'Das Passwort braucht mindestens 6 Zeichen.';
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) return 'Das ist keine gültige E-Mail-Adresse.';
  if (lower.includes('rate limit')) return 'Zu viele Versuche. Warte einen Moment.';
  if (lower.includes('payload too large') || lower.includes('exceeded the maximum')) return 'Die Datei ist größer als 20 MB.';
  return message;
}

export function parseTimestamp(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** "12:41" for today's messages, "5. Okt, 12:41" for older ones; the server sends ISO timestamps. */
export function timeLabel(iso: string, now: Date = new Date()): string {
  const date = parseTimestamp(iso);
  if (!date) return '';
  const clock = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return sameDay ? clock : `${date.getDate()}. ${months[date.getMonth()]}, ${clock}`;
}

/** The role claim of a Supabase key (a JWT); the service_role key must never be put into an app. */
export function keyRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '='));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}
