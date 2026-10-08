// The state of the Kurse tab: which server, who is signed in, the groups and the chat. A port of SocialStore.swift.

import type { Block, Board, Poll, PollCount, PollVote, Template, Version } from '../lib/social/board';
import type { BlockKind } from '../lib/social/board';
import { SocialApi } from '../lib/social/api';
import { addressMessage, checkServer, keyRole, maxFileBytes, maxMessageLength, merge, normalizeCode, storagePath } from '../lib/social/format';
import { Group, Member, Message, Result, Server, Session, SocialError } from '../lib/social/models';
import { ask, checkEndpoint } from '../lib/llm';
import { doFetch, mimeFor, secrets, storage } from '../lib/platform';
import { reviewPrompt, reviewSystem } from '../lib/social/board';
import { createStore } from './createStore';
import { fail, keyAccount, say, settingsStore } from './app';


export interface SocialState {
  phase: 'loading' | 'unconfigured' | 'signedOut' | 'signedIn';
  server: Server | null;
  me: Session | null;
  groups: Group[];
  joinable: Group[];
  messages: Record<string, Message[]>;
  results: Record<string, Result[]>;
  members: Record<string, Member[]>;
  busy: boolean;
}

export const social = createStore<SocialState>({
  phase: 'loading', server: null, me: null, groups: [], joinable: [], messages: {}, results: {}, members: {}, busy: false,
});

let api: SocialApi | null = null;
const sessionAccount = 'social.session';

export function client(): SocialApi {
  if (!api) throw new SocialError('notConfigured', 'Der Server ist noch nicht verbunden.');
  return api;
}

function connect(server: Server, session: Session | null): void {
  api = new SocialApi(server, session, doFetch, (renewed) => void keepSession(renewed));
  social.set({ server, me: session, phase: session ? 'signedIn' : 'signedOut' });
}

async function keepSession(session: Session | null): Promise<void> {
  if (session) {
    await secrets.set(sessionAccount, JSON.stringify(session));
    social.set({ me: session });
  } else {
    await secrets.delete(sessionAccount);
    reset();
    social.set({ phase: 'signedOut' });
    say('Du bist abgemeldet. Melde dich neu an.');
  }
}

function reset(): void {
  social.set({ me: null, groups: [], joinable: [], messages: {}, results: {}, members: {} });
}

export async function startSocial(): Promise<void> {
  try {
    const text = await storage.read('social');
    const saved = text ? (JSON.parse(text) as { url?: string; anonKey?: string }) : null;
    const check = checkServer(saved?.url ?? '');
    if (check.kind !== 'valid' || !saved?.anonKey) {
      social.set({ phase: 'unconfigured' });
      return;
    }
    const stored = await secrets.get(sessionAccount);
    connect({ url: check.url, anonKey: saved.anonKey }, stored ? (JSON.parse(stored) as Session) : null);
    if (stored) await refreshGroups();
  } catch {
    social.set({ phase: 'unconfigured' });
  }
}

/** Returns a message when the address or the key is not usable, null when it was saved. */
export async function saveServer(urlText: string, key: string): Promise<string | null> {
  const check = checkServer(urlText);
  if (check.kind !== 'valid') return addressMessage(check);
  const anonKey = key.trim();
  if (anonKey === '') return 'Trag den „anon public“-Schlüssel ein.';
  if (keyRole(anonKey) === 'service_role') return 'Das ist der service_role-Schlüssel. Er darf nie in eine App. Nimm den anon-Schlüssel.';
  await storage.write('social', JSON.stringify({ url: check.url, anonKey }));
  await secrets.delete(sessionAccount);
  connect({ url: check.url, anonKey }, null);
  return null;
}

export async function forgetServer(): Promise<void> {
  await storage.write('social', JSON.stringify({}));
  await secrets.delete(sessionAccount);
  api = null;
  reset();
  social.set({ server: null, phase: 'unconfigured' });
}

async function run<T>(work: (api: SocialApi) => Promise<T>, options: { busy?: boolean; quiet?: boolean } = {}): Promise<T | null> {
  if (options.busy !== false) social.set({ busy: true });
  try {
    return await work(client());
  } catch (error) {
    if (error instanceof SocialError && error.kind === 'signedOut') {
      await keepSession(null);
    } else if (!(options.quiet && error instanceof SocialError && error.kind === 'offline')) {
      if (!options.quiet) fail(error);
    }
    return null;
  } finally {
    if (options.busy !== false) social.set({ busy: false });
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const session = await run((a) => a.signIn(email.trim(), password));
  if (!session) return;
  await keepSession(session);
  social.set({ phase: 'signedIn' });
  await refreshGroups();
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
  if (name.trim() === '') return say('Wie sollen dich die anderen nennen? Trag einen Namen ein.');
  const session = await run((a) => a.signUp(name.trim(), email.trim(), password));
  if (!session) return;
  await keepSession(session);
  social.set({ phase: 'signedIn' });
  await refreshGroups();
}

export async function signOut(): Promise<void> {
  client().signOut();
  await keepSession(null);
}

export async function refreshGroups(): Promise<void> {
  const result = await run(async (a) => {
    const [all, mine] = await Promise.all([a.groups(), a.membershipIds()]);
    return { groups: all.filter((g) => mine.has(g.id)), joinable: all.filter((g) => !mine.has(g.id)) };
  }, { busy: false, quiet: true });
  if (result) social.set(result);
}

export async function createGroup(name: string, parent: Group | null): Promise<Group | null> {
  const group = await run((a) => a.createGroup(name, parent ? 'group' : 'course', parent?.id ?? null));
  if (group) await refreshGroups();
  return group;
}

export async function joinWithCode(code: string): Promise<Group | null> {
  const group = await run((a) => a.joinGroup(normalizeCode(code)));
  if (group) await refreshGroups();
  return group;
}

export async function joinSubgroup(group: Group): Promise<void> {
  await run((a) => a.joinSubgroup(group.id));
  await refreshGroups();
}

export async function leaveGroup(group: Group): Promise<void> {
  await run((a) => a.leaveGroup(group.id));
  await refreshGroups();
}

export function isModerator(state: SocialState, group: string): boolean {
  const role = state.members[group]?.find((m) => m.userId === state.me?.userId)?.role;
  return role === 'owner' || role === 'mod';
}

export async function refreshMembers(group: Group): Promise<void> {
  const members = await run((a) => a.members(group.id), { busy: false, quiet: true });
  if (members) social.set((s) => ({ ...s, members: { ...s.members, [group.id]: members } }));
}

export async function setRole(group: Group, user: string, role: 'mod' | 'member'): Promise<void> {
  await run((a) => a.call('set_member_role', { p_group: group.id, p_user: user, p_role: role }), { busy: false });
  await refreshMembers(group);
}

// Chat

export async function refreshMessages(group: Group): Promise<void> {
  const known = social.get().messages[group.id] ?? [];
  const fresh = await run((a) => a.messages(group.id, known.length > 0 ? known[known.length - 1].createdAt : null), { busy: false, quiet: true });
  if (!fresh || fresh.length === 0) return;
  social.set((s) => ({ ...s, messages: { ...s.messages, [group.id]: merge(s.messages[group.id] ?? [], fresh) } }));
}

export async function sendMessage(group: Group, text: string): Promise<void> {
  const body = text.trim().slice(0, maxMessageLength);
  if (body === '') return;
  await run((a) => a.sendMessage(group.id, body), { busy: false });
  await refreshMessages(group);
}

export async function sendFile(group: Group, name: string, data: Uint8Array): Promise<void> {
  if (data.byteLength > maxFileBytes) return say('Die Datei ist größer als 20 MB.');
  await run(async (a) => {
    const path = storagePath(group.id, name);
    await a.upload(data, path, mimeFor(name));
    await a.sendMessage(group.id, '', path, name);
  });
  await refreshMessages(group);
}

export async function deleteMessage(group: Group, message: Message): Promise<void> {
  await run((a) => a.deleteMessage(message.id), { busy: false });
  social.set((s) => ({ ...s, messages: { ...s.messages, [group.id]: (s.messages[group.id] ?? []).filter((m) => m.id !== message.id) } }));
}

export async function reportMessage(message: Message): Promise<void> {
  if ((await run((a) => a.report(message.id, ''), { busy: false })) !== null) say('Danke, die Meldung ist angekommen.');
}

export async function download(path: string): Promise<Uint8Array | null> {
  return run((a) => a.download(path));
}

// Files of a group

export async function refreshResults(group: Group): Promise<void> {
  const rows = await run((a) => a.results(group.id), { busy: false, quiet: true });
  if (rows) social.set((s) => ({ ...s, results: { ...s.results, [group.id]: rows } }));
}

export async function addResult(group: Group, title: string, name: string, data: Uint8Array): Promise<void> {
  if (data.byteLength > maxFileBytes) return say('Die Datei ist größer als 20 MB.');
  await run(async (a) => {
    const path = storagePath(group.id, name);
    await a.upload(data, path, mimeFor(name));
    await a.addResult(group.id, title, path, name);
  });
  await refreshResults(group);
}

export async function deleteResult(group: Group, result: Result): Promise<void> {
  await run((a) => a.deleteResult(result.id), { busy: false });
  social.set((s) => ({ ...s, results: { ...s.results, [group.id]: (s.results[group.id] ?? []).filter((r) => r.id !== result.id) } }));
}

// The Tafelbild

export interface BoardState {
  boards: Record<string, Board[]>;
  blocks: Record<string, Block[]>;
  polls: Record<string, Poll[]>;
  counts: Record<string, PollCount[]>;
  myVotes: Record<string, PollVote[]>;
  versions: Record<string, Version[]>;
  review: Record<string, string>;
}

export const boards = createStore<BoardState>({ boards: {}, blocks: {}, polls: {}, counts: {}, myVotes: {}, versions: {}, review: {} });

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function refreshBoards(group: Group): Promise<void> {
  const list = await run((a) => a.boards(group.id), { busy: false, quiet: true });
  if (list) boards.set((s) => ({ ...s, boards: { ...s.boards, [group.id]: list } }));
}

/** The board's contributions, polls and votes, and the group's board list, so a lock or a closing shows up too. */
export async function refreshBoard(board: Board): Promise<void> {
  const data = await run(async (a) => {
    const [blocks, polls, counts, votes, list] = await Promise.all([a.boardBlocks(board.id), a.polls(board.id), a.pollCounts(board.id), a.myVotes(board.id), a.boards(board.groupId)]);
    return { blocks, polls, counts, votes, list };
  }, { busy: false, quiet: true });
  if (!data) return;
  const current = boards.get();
  if (same(current.blocks[board.id], data.blocks) && same(current.polls[board.id], data.polls) && same(current.counts[board.id], data.counts) && same(current.myVotes[board.id], data.votes) && same(current.boards[board.groupId], data.list)) return;
  boards.set((s) => ({
    ...s,
    blocks: { ...s.blocks, [board.id]: data.blocks },
    polls: { ...s.polls, [board.id]: data.polls },
    counts: { ...s.counts, [board.id]: data.counts },
    myVotes: { ...s.myVotes, [board.id]: data.votes },
    boards: { ...s.boards, [board.groupId]: data.list },
  }));
}

export async function refreshVersions(board: Board): Promise<void> {
  const list = await run((a) => a.versions(board.id), { busy: false, quiet: true });
  if (list) boards.set((s) => ({ ...s, versions: { ...s.versions, [board.id]: list } }));
}

async function change(board: Board, work: (a: SocialApi) => Promise<unknown>): Promise<boolean> {
  const done = (await run(work)) !== null;
  await refreshBoard(board);
  return done;
}

export async function createBoard(group: Group, title: string, topic: string, template: Template): Promise<Board | null> {
  const board = await run((a) => a.createBoard(group.id, title.trim(), topic.trim(), template));
  if (board) await refreshBoards(group);
  return board;
}

const call = (name: string, params: Record<string, unknown>) => (a: SocialApi) => a.call(name, params).then(() => true);

export const acceptBlock = (board: Board, block: Block) => change(board, call('accept_block', { p_block: block.id }));
export const rejectBlock = (board: Board, block: Block) => change(board, call('reject_block', { p_block: block.id }));
export const withdrawBlock = (board: Board, block: Block) => change(board, call('withdraw_block', { p_block: block.id }));
export const setBoardStatus = (board: Board, status: 'open' | 'locked') => change(board, call('set_board_status', { p_board: board.id, p_status: status }));
export const finalizeBoard = (board: Board) => change(board, call('finalize_board', { p_board: board.id }));
export const closePoll = (board: Board, poll: Poll) => change(board, call('close_poll', { p_poll: poll.id }));
export const vote = (board: Board, poll: Poll, block: string) => change(board, call('vote', { p_poll: poll.id, p_block: block }));
export const startPoll = (board: Board, question: string, blocks: string[]) => change(board, (a) => a.startPoll(board.id, question.trim(), blocks));

export async function restoreVersion(board: Board, version: Version): Promise<void> {
  await change(board, call('restore_board_version', { p_version: version.id }));
  await refreshVersions(board);
}

/** A contribution. A moderator can have it accepted at once. */
export async function propose(
  board: Board,
  input: { kind: BlockKind; title: string; body: string; replacing?: string | null; image?: { name: string; data: Uint8Array } | null; acceptNow?: boolean },
): Promise<boolean> {
  const done = await run(async (a) => {
    const id = crypto.randomUUID();
    let attachmentPath: string | null = null;
    if (input.image) {
      attachmentPath = storagePath(board.groupId, 'skizze.jpg');
      await a.upload(input.image.data, attachmentPath, mimeFor(input.image.name));
    }
    await a.proposeBlock({ id, board: board.id, kind: input.kind, title: input.title.trim(), body: input.body.trim(), replaces: input.replacing, attachmentPath });
    if (input.acceptNow) await a.call('accept_block', { p_block: id });
    return true;
  });
  await refreshBoard(board);
  return done === true;
}

export async function editBlock(board: Board, block: Block, title: string, body: string): Promise<boolean> {
  const done = await run((a) => a.editBlock(block.id, title.trim(), body.trim(), block.rev));
  await refreshBoard(board);
  return done !== null;
}

/** The AI reads the closed result and says what is wrong or missing; it writes nothing into the board. */
export async function reviewBoard(board: Board, groupName: string): Promise<void> {
  const { selection, customUrl } = settingsStore.get();
  const key = (await secrets.get(keyAccount(selection.provider))) ?? '';
  const endpoint = checkEndpoint(customUrl);
  try {
    const text = await ask(
      { provider: selection.provider, apiKey: key, model: selection.model, endpoint: endpoint.kind === 'valid' ? endpoint.url : undefined, system: reviewSystem, user: reviewPrompt(board, groupName, boards.get().blocks[board.id] ?? []) },
      doFetch,
    );
    boards.set((s) => ({ ...s, review: { ...s.review, [board.id]: text } }));
  } catch (error) {
    fail(error);
  }
}
