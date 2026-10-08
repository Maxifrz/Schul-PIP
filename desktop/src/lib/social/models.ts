// The rows the Kurse tab reads; keys are camelCase (see `camelize`).

export interface Author {
  displayName: string;
}

export interface Group {
  id: string;
  parentId: string | null;
  name: string;
  kind: 'course' | 'group';
  joinCode: string;
  createdAt: string;
}

export interface Message {
  id: string;
  groupId: string;
  userId: string;
  body: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  createdAt: string;
  profiles: Author | null;
}

export interface Result {
  id: string;
  groupId: string;
  userId: string;
  title: string;
  path: string;
  fileName: string;
  createdAt: string;
  profiles: Author | null;
}

export interface Member {
  userId: string;
  role: 'owner' | 'mod' | 'member';
  profiles: Author | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Seconds since 1970 at which the access token stops working. */
  expiresAt: number;
  userId: string;
  email: string;
  name: string;
}

export interface Server {
  url: string;
  anonKey: string;
}

export class SocialError extends Error {
  constructor(
    public readonly kind: 'notConfigured' | 'signedOut' | 'confirmEmail' | 'tooLarge' | 'server' | 'offline',
    message: string,
  ) {
    super(message);
  }
}

export const errors = {
  notConfigured: () => new SocialError('notConfigured', 'Der Server ist noch nicht verbunden.'),
  signedOut: () => new SocialError('signedOut', 'Du bist abgemeldet. Melde dich neu an.'),
  confirmEmail: () => new SocialError('confirmEmail', 'Fast geschafft: Bestätige die E-Mail, die du bekommen hast, und melde dich dann an.'),
  tooLarge: () => new SocialError('tooLarge', 'Die Datei ist größer als 20 MB.'),
  offline: () => new SocialError('offline', 'Keine Verbindung zum Server.'),
  server: (message: string) => new SocialError('server', message),
};

/** PostgREST sends snake_case; the app works with camelCase. */
export function camelize<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => camelize(item)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] = camelize(item);
    }
    return result as T;
  }
  return value as T;
}
