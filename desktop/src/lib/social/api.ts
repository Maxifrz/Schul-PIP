// Talks to a Supabase project over plain HTTPS: sign-in (GoTrue), tables and functions (PostgREST) and files (Storage).
// A port of Lernwerk/Services/Social/SocialAPI.swift. `doFetch` is injected, so the tests need no network and the app can
// send the calls through the main process (no CORS).

import type { Block, Board, Poll, PollCount, PollVote, Version } from './board';
import { german, maxFileBytes, queryString } from './format';
import { Group, Member, Message, Result, Server, Session, SocialError, camelize, errors } from './models';

export type DoFetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array | ArrayBuffer }) => Promise<Response>;

interface AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: { id: string; email?: string; userMetadata?: { displayName?: string } };
}

const uuid = (id: string) => id.toLowerCase();

export class SocialApi {
  private session: Session | null;

  constructor(
    private readonly server: Server,
    session: Session | null,
    private readonly doFetch: DoFetch,
    private readonly onSession?: (session: Session | null) => void,
    private readonly now: () => number = () => Date.now() / 1000,
  ) {
    this.session = session;
  }

  current(): Session | null {
    return this.session;
  }

  // Account

  async signUp(name: string, email: string, password: string): Promise<Session> {
    const body = JSON.stringify({ email, password, data: { display_name: name } });
    const data = await this.send('POST', '/auth/v1/signup', { body, authorized: false });
    const created = camelize<AuthResponse>(JSON.parse(new TextDecoder().decode(data)));
    if (!created.accessToken) throw errors.confirmEmail();
    return this.adopt(created, name, email);
  }

  async signIn(email: string, password: string): Promise<Session> {
    const data = await this.send('POST', '/auth/v1/token', {
      query: [['grant_type', 'password']],
      body: JSON.stringify({ email, password }),
      authorized: false,
    });
    return this.adopt(camelize<AuthResponse>(JSON.parse(new TextDecoder().decode(data))), null, email);
  }

  signOut(): void {
    this.session = null;
  }

  private adopt(response: AuthResponse, fallbackName: string | null, fallbackEmail: string): Session {
    const user = response.user;
    const session: Session = {
      accessToken: response.accessToken ?? '',
      refreshToken: response.refreshToken ?? '',
      expiresAt: this.now() + (response.expiresIn ?? 3600),
      userId: user?.id ?? this.session?.userId ?? '',
      email: user?.email ?? fallbackEmail,
      name: user?.userMetadata?.displayName ?? fallbackName ?? fallbackEmail,
    };
    this.session = session;
    return session;
  }

  private async refreshIfNeeded(): Promise<void> {
    const session = this.session;
    if (!session) throw errors.signedOut();
    if (session.expiresAt - this.now() >= 60) return;
    try {
      const data = await this.send('POST', '/auth/v1/token', {
        query: [['grant_type', 'refresh_token']],
        body: JSON.stringify({ refresh_token: session.refreshToken }),
        authorized: false,
      });
      const renewed = this.adopt(camelize<AuthResponse>(JSON.parse(new TextDecoder().decode(data))), session.name, session.email);
      this.onSession?.(renewed);
    } catch {
      this.session = null;
      this.onSession?.(null);
      throw errors.signedOut();
    }
  }

  // Data

  groups(): Promise<Group[]> {
    return this.get('/rest/v1/groups', [['select', '*'], ['order', 'created_at.asc']]);
  }

  async membershipIds(): Promise<Set<string>> {
    const user = this.session?.userId;
    if (!user) throw errors.signedOut();
    const rows = await this.get<Array<{ groupId: string }>>('/rest/v1/members', [['select', 'group_id'], ['user_id', `eq.${uuid(user)}`]]);
    return new Set(rows.map((row) => row.groupId));
  }

  members(group: string): Promise<Member[]> {
    return this.get('/rest/v1/members', [['select', 'user_id,role,profiles(display_name)'], ['group_id', `eq.${uuid(group)}`], ['order', 'joined_at.asc']]);
  }

  async messages(group: string, after: string | null): Promise<Message[]> {
    const query: Array<[string, string]> = [
      ['select', 'id,group_id,user_id,body,attachment_path,attachment_name,created_at,profiles(display_name)'],
      ['group_id', `eq.${uuid(group)}`],
      ['order', after === null ? 'created_at.desc' : 'created_at.asc'],
      ['limit', '200'],
    ];
    if (after !== null) query.push(['created_at', `gt.${after}`]);
    const rows = await this.get<Message[]>('/rest/v1/messages', query);
    return rows;
  }

  results(group: string): Promise<Result[]> {
    return this.get('/rest/v1/results', [['select', 'id,group_id,user_id,title,path,file_name,created_at,profiles(display_name)'], ['group_id', `eq.${uuid(group)}`], ['order', 'created_at.desc']]);
  }

  createGroup(name: string, kind: 'course' | 'group', parent: string | null): Promise<Group> {
    const params: Record<string, unknown> = { p_name: name, p_kind: kind };
    if (parent) params.p_parent = uuid(parent);
    return this.rpc('create_group', params);
  }

  joinGroup(code: string): Promise<Group> {
    return this.rpc('join_group', { p_code: code });
  }

  joinSubgroup(group: string): Promise<Group> {
    return this.rpc('join_subgroup', { p_group: uuid(group) });
  }

  leaveGroup(group: string): Promise<void> {
    return this.call('leave_group', { p_group: uuid(group) });
  }

  async sendMessage(group: string, body: string, attachmentPath?: string, attachmentName?: string): Promise<void> {
    const user = this.requireUser();
    const row: Record<string, unknown> = { group_id: uuid(group), user_id: uuid(user), body };
    if (attachmentPath) row.attachment_path = attachmentPath;
    if (attachmentName) row.attachment_name = attachmentName;
    await this.authorized('POST', '/rest/v1/messages', { body: JSON.stringify(row) });
  }

  async deleteMessage(id: string): Promise<void> {
    await this.authorized('DELETE', '/rest/v1/messages', { query: [['id', `eq.${uuid(id)}`]] });
  }

  async addResult(group: string, title: string, path: string, fileName: string): Promise<void> {
    const user = this.requireUser();
    await this.authorized('POST', '/rest/v1/results', { body: JSON.stringify({ group_id: uuid(group), user_id: uuid(user), title, path, file_name: fileName }) });
  }

  async deleteResult(id: string): Promise<void> {
    await this.authorized('DELETE', '/rest/v1/results', { query: [['id', `eq.${uuid(id)}`]] });
  }

  async report(message: string, reason: string): Promise<void> {
    const user = this.requireUser();
    await this.authorized('POST', '/rest/v1/reports', { body: JSON.stringify({ message_id: uuid(message), reporter: uuid(user), reason }) });
  }

  // Files

  async upload(data: Uint8Array, path: string, contentType: string): Promise<void> {
    if (data.byteLength > maxFileBytes) throw errors.tooLarge();
    await this.authorized('POST', `/storage/v1/object/files/${path}`, { body: data, headers: { 'Content-Type': contentType } });
  }

  async download(path: string): Promise<Uint8Array> {
    return new Uint8Array(await this.authorized('GET', `/storage/v1/object/authenticated/files/${path}`));
  }

  // Tafelbild

  boards(group: string): Promise<Board[]> {
    return this.get('/rest/v1/boards', [['select', '*'], ['group_id', `eq.${uuid(group)}`], ['order', 'lesson_date.desc,created_at.desc']]);
  }

  boardBlocks(board: string): Promise<Block[]> {
    return this.get('/rest/v1/board_blocks', [['select', '*,profiles(display_name)'], ['board_id', `eq.${uuid(board)}`], ['order', 'position.asc,created_at.asc']]);
  }

  polls(board: string): Promise<Poll[]> {
    return this.get('/rest/v1/polls', [['select', '*,poll_options(block_id)'], ['board_id', `eq.${uuid(board)}`], ['order', 'created_at.asc']]);
  }

  pollCounts(board: string): Promise<PollCount[]> {
    return this.rpc('poll_counts', { p_board: uuid(board) });
  }

  myVotes(board: string): Promise<PollVote[]> {
    return this.rpc('my_votes', { p_board: uuid(board) });
  }

  versions(board: string): Promise<Version[]> {
    return this.get('/rest/v1/board_versions', [['select', 'id,board_id,label,created_at,profiles(display_name)'], ['board_id', `eq.${uuid(board)}`], ['order', 'created_at.desc'], ['limit', '100']]);
  }

  createBoard(group: string, title: string, topic: string, template: string): Promise<Board> {
    return this.rpc('create_board', { p_group: uuid(group), p_title: title, p_topic: topic, p_template: template });
  }

  async proposeBlock(input: { id: string; board: string; kind: string; title: string; body: string; replaces?: string | null; attachmentPath?: string | null }): Promise<void> {
    const user = this.requireUser();
    const row: Record<string, unknown> = {
      id: uuid(input.id), board_id: uuid(input.board), kind: input.kind, title: input.title, body: input.body, author: uuid(user),
    };
    if (input.replaces) row.replaces_block = uuid(input.replaces);
    if (input.attachmentPath) row.attachment_path = input.attachmentPath;
    await this.authorized('POST', '/rest/v1/board_blocks', { body: JSON.stringify(row) });
  }

  editBlock(id: string, title: string, body: string, rev: number): Promise<Block> {
    return this.rpc('edit_block', { p_block: uuid(id), p_title: title, p_body: body, p_rev: rev });
  }

  startPoll(board: string, question: string, blocks: string[]): Promise<Poll> {
    return this.rpc('start_poll', { p_board: uuid(board), p_question: question, p_blocks: blocks.map(uuid) });
  }

  async call(name: string, params: Record<string, unknown>): Promise<void> {
    await this.authorized('POST', `/rest/v1/rpc/${name}`, { body: JSON.stringify(params) });
  }

  // Plumbing

  private requireUser(): string {
    const user = this.session?.userId;
    if (!user) throw errors.signedOut();
    return user;
  }

  private async get<T>(path: string, query: Array<[string, string]>): Promise<T> {
    return this.decode<T>(await this.authorized('GET', path, { query }));
  }

  private async rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
    return this.decode<T>(await this.authorized('POST', `/rest/v1/rpc/${name}`, { body: JSON.stringify(params) }));
  }

  private decode<T>(data: ArrayBuffer): T {
    try {
      return camelize<T>(JSON.parse(new TextDecoder().decode(data)));
    } catch {
      throw errors.server('Die Antwort des Servers ist unerwartet. Stimmt das Schema (supabase/schema.sql und board.sql)?');
    }
  }

  private async authorized(method: string, path: string, options: { query?: Array<[string, string]>; body?: string | Uint8Array; headers?: Record<string, string> } = {}): Promise<ArrayBuffer> {
    await this.refreshIfNeeded();
    return this.send(method, path, { ...options, authorized: true });
  }

  private async send(
    method: string,
    path: string,
    options: { query?: Array<[string, string]>; body?: string | Uint8Array; headers?: Record<string, string>; authorized?: boolean },
  ): Promise<ArrayBuffer> {
    let url = this.server.url + path;
    if (options.query && options.query.length > 0) url += '?' + queryString(options.query);
    const headers: Record<string, string> = {
      apikey: this.server.anonKey,
      Authorization: 'Bearer ' + (options.authorized ? this.session?.accessToken ?? this.server.anonKey : this.server.anonKey),
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (method === 'POST' && path.startsWith('/rest/v1/') && !path.includes('/rpc/')) headers.Prefer = 'return=minimal';
    Object.assign(headers, options.headers ?? {});
    let response: Response;
    try {
      response = await this.doFetch(url, { method, headers, body: options.body });
    } catch {
      throw errors.offline();
    }
    const data = await response.arrayBuffer();
    if (response.status < 200 || response.status >= 300) {
      if (response.status === 401 && options.authorized) throw errors.signedOut();
      throw errors.server(german(errorMessage(data, response.status)));
    }
    return data;
  }
}

function errorMessage(data: ArrayBuffer, status: number): string {
  try {
    const object = JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>;
    for (const key of ['message', 'msg', 'error_description', 'error']) {
      const value = object[key];
      if (typeof value === 'string' && value !== '') return value;
    }
  } catch {
    // not JSON
  }
  return `Der Server meldet einen Fehler (${status}).`;
}

export { SocialError };
