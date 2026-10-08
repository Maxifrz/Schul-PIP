import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Block, Board, Poll, boardTemplate, dateLabel, flashcards, kindFrom, kindTitle, resultHtml, sections, shares, stats, suggestTemplate,
  templateKinds, templateTitle, templates, titleHint, wantsSymbols,
} from '../lib/social/board';
import type { BlockKind, Template } from '../lib/social/board';
import { htmlToPdf, pickFiles, saveFile } from '../lib/platform';
import { timeLabel } from '../lib/social/format';
import type { Group } from '../lib/social/models';
import { addCards, fail, importMaterial, say } from '../store/app';
import { newCard } from '../lib/review';
import {
  acceptBlock, boards, closePoll, createBoard, download, editBlock, finalizeBoard, isModerator, propose, refreshBoard, refreshBoards,
  refreshMembers, refreshVersions, rejectBlock, restoreVersion, reviewBoard, setBoardStatus, social, startPoll, vote, withdrawBlock,
} from '../store/social';
import { Caption, ConfirmDialog, Dialog, Pills, PromptDialog } from '../ui/kit';


// The Tafelbild: the class builds one lesson result together. Everybody proposes blocks, moderators accept, edit and reject
// them or put several up for a vote, and closing the board freezes the result. Nothing here is written by an AI.

export function BoardsPane({ group }: { group: Group }) {
  const state = boards.use();
  const list = state.boards[group.id] ?? [];
  const moderator = isModerator(social.use(), group.id);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void refreshMembers(group);
    void refreshBoards(group);
  }, [group]);

  if (openId) return <BoardScreen boardId={openId} group={group} onClose={() => setOpenId(null)} />;

  return (
    <div style={{ padding: '4px 28px 28px', maxWidth: 820 }}>
      <p className="muted small">Pro Stunde ein gemeinsames Ergebnis: alle machen Vorschläge, die Moderation übernimmt, was ins Tafelbild gehört.</p>
      {moderator ? (
        <div className="row" style={{ marginBottom: 14 }}><button className="btn small" onClick={() => setCreating(true)}>Ergebnissicherung starten</button></div>
      ) : (
        <p className="faint small">Eine Ergebnissicherung starten können nur Moderatoren, bei einem Kurs also der Gründer und wen er dazu macht.</p>
      )}
      {list.length === 0 && <p className="faint">Noch keine Ergebnissicherung.</p>}
      <div className="col gap-s">
        {list.map((b) => (
          <button key={b.id} className="card col" style={{ gap: 6 }} onClick={() => setOpenId(b.id)}>
            <div className="row"><strong className="grow" style={{ fontSize: 17 }}>{b.title}</strong><StatusTag board={b} /></div>
            <span className="mono faint" style={{ fontSize: 11 }}>{[dateLabel(b), b.topic].filter((x) => x !== '').join(' · ')}</span>
          </button>
        ))}
      </div>
      {creating && <NewBoardDialog group={group} onClose={() => setCreating(false)} onCreated={(b) => { setCreating(false); setOpenId(b.id); }} />}
    </div>
  );
}

function StatusTag({ board }: { board: Board }) {
  return <span className={`tag ${board.status === 'final' ? 'solid' : ''}`}>{board.status === 'final' ? 'FINAL' : board.status === 'locked' ? 'GESPERRT' : 'OFFEN'}</span>;
}

function NewBoardDialog({ group, onClose, onCreated }: { group: Group; onClose: () => void; onCreated: (board: Board) => void }) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [template, setTemplate] = useState<Template>(suggestTemplate(group.name));
  const busy = social.use().busy;
  return (
    <Dialog onClose={onClose}>
      <div className="col">
        <Caption>Neue Ergebnissicherung</Caption>
        <input className="field" autoFocus placeholder="Thema der Stunde, z. B. Integralrechnung" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="field" placeholder="Worum geht es genau? (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <span className="muted small">Aufbau</span>
        <Pills items={templates.map((t) => ({ id: t, label: templateTitle(t) }))} value={template} onChange={setTemplate} />
        <span className="faint small">Bausteine: {templateKinds(template).map(kindTitle).join(', ')}</span>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn outline" onClick={onClose}>Abbrechen</button>
          <button className="btn" disabled={title.trim() === '' || busy} onClick={async () => { const b = await createBoard(group, title, topic, template); if (b) onCreated(b); }}>Starten</button>
        </div>
      </div>
    </Dialog>
  );
}

type BoardTab = 'board' | 'proposals' | 'polls' | 'history';

interface ComposeRequest {
  kind: BlockKind;
  editing?: Block;
  replacing?: Block;
}

function BoardScreen({ boardId, group, onClose }: { boardId: string; group: Group; onClose: () => void }) {
  const state = boards.use();
  const socialState = social.use();
  const board = (state.boards[group.id] ?? []).find((b) => b.id === boardId) ?? null;
  const blocks = state.blocks[boardId] ?? [];
  const moderator = isModerator(socialState, group.id);
  const me = socialState.me?.userId;
  const [tab, setTab] = useState<BoardTab>('board');
  const [compose, setCompose] = useState<ComposeRequest | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [askingPoll, setAskingPoll] = useState(false);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Refreshes every three seconds while the board is open.
  useEffect(() => {
    let stopped = false;
    void (async () => {
      while (!stopped) {
        const current = boards.get().boards[group.id]?.find((b) => b.id === boardId);
        if (current) await refreshBoard(current);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [boardId, group.id]);

  useEffect(() => {
    if (tab === 'history' && board) void refreshVersions(board);
  }, [tab, board?.id]);

  if (!board) return <div style={{ padding: 28 }}><span className="muted">Lade …</span></div>;

  const open = blocks.filter((b) => b.status === 'proposed').length;
  const tabs: Array<{ id: BoardTab; label: string }> = [
    { id: 'board', label: 'Tafelbild' },
    { id: 'proposals', label: open > 0 ? `Vorschläge · ${open}` : 'Vorschläge' },
    { id: 'polls', label: 'Abstimmung' },
    { id: 'history', label: 'Verlauf' },
  ];
  const template = boardTemplate(board);
  const summary = stats(blocks);

  const saveToLibrary = async () => {
    const pdf = await htmlToPdf(resultHtml(board, group.name, blocks));
    if (!pdf) return say('Das PDF entsteht in der Windows-App.');
    try {
      const material = await importMaterial(`${board.title} – ${group.name}.pdf`, pdf);
      say(`„${material.title}“ liegt jetzt in deiner Bibliothek.`);
    } catch (error) {
      fail(error);
    }
  };

  const savePdf = async () => {
    const pdf = await htmlToPdf(resultHtml(board, group.name, blocks));
    if (!pdf) return say('Das PDF entsteht in der Windows-App.');
    if (await saveFile(`${board.title} – ${group.name}.pdf`, pdf)) say('Gespeichert.');
  };

  const makeCards = () => {
    const cards = flashcards(board, blocks);
    addCards(cards.map((c) => newCard(c.front, c.back)));
    say(cards.length === 0 ? 'Im Tafelbild stehen keine Definitionen, Formeln oder Merksätze für Karten.' : `${cards.length} Karteikarten sind unter „Karten“ gelandet.`);
  };

  const review = async () => {
    setReviewing(true);
    await reviewBoard(board, group.name);
    setReviewing(false);
  };

  return (
    <div style={{ padding: '0 28px 40px', maxWidth: 900 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn outline small" onClick={onClose}>← Zurück</button>
        <div className="grow">
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{board.title}</div>
          <span className="caption">{group.name} · {dateLabel(board)}{board.topic ? ` · ${board.topic}` : ''}</span>
        </div>
        <StatusTag board={board} />
      </div>
      <Pills items={tabs} value={tab} onChange={setTab} />

      <div className="col" style={{ marginTop: 16 }}>
        {tab === 'board' && (
          <>
            {moderator && (
              <div className="card soft col" style={{ gap: 10 }}>
                <Caption>Moderation</Caption>
                <span className="small">{summary.contributions} Beiträge · {summary.accepted} übernommen · {summary.open} offen · {summary.rejected} abgelehnt · {summary.people} Beteiligte</span>
                {board.status !== 'final' && (
                  <div className="row">
                    <button className="btn outline small" onClick={() => void setBoardStatus(board, board.status === 'locked' ? 'open' : 'locked')}>{board.status === 'locked' ? 'Freigeben' : 'Sperren'}</button>
                    <button className="btn small" onClick={() => setConfirmFinal(true)}>Abschließen</button>
                  </div>
                )}
              </div>
            )}
            {board.status === 'final' && (
              <div className="card col">
                <Caption>Abgeschlossen</Caption>
                <span className="small muted">Das Stundenergebnis ist festgehalten. Daraus kannst du Lernmaterial machen, ohne dass eine KI etwas dazuschreibt.</span>
                <div className="row wrap">
                  <button className="btn outline small" onClick={() => void saveToLibrary()}>Als PDF in die Bibliothek</button>
                  <button className="btn outline small" onClick={() => void savePdf()}>PDF speichern …</button>
                  <button className="btn outline small" onClick={makeCards}>Karteikarten erzeugen</button>
                  <button className="btn outline small" disabled={reviewing} onClick={() => void review()}>{reviewing ? 'Prüft …' : 'KI prüft das Ergebnis'}</button>
                </div>
                {state.review[board.id] && <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{state.review[board.id]}</div>}
              </div>
            )}
            {sections(template, blocks).length === 0 && <p className="faint">Noch nichts im Tafelbild. Macht Vorschläge, die Moderation übernimmt sie.</p>}
            {sections(template, blocks).map((section) => (
              <div key={section.kind} className="col gap-s">
                <Caption>{kindTitle(section.kind)}</Caption>
                {section.blocks.map((block) => (
                  <BlockCard key={block.id} block={block} mine={block.author === me}>
                    {board.status === 'open' && (
                      <>
                        {moderator && <button className="link" onClick={() => setCompose({ kind: kindFrom(block.kind), editing: block })}>Bearbeiten</button>}
                        <button className="link" onClick={() => setCompose({ kind: kindFrom(block.kind), replacing: block })}>Korrektur vorschlagen</button>
                        {moderator && <button className="link muted" onClick={() => void rejectBlock(board, block)}>Entfernen</button>}
                      </>
                    )}
                  </BlockCard>
                ))}
              </div>
            ))}
            {board.status === 'open' ? (
              <div className="col gap-s">
                <Caption>Beitrag erstellen</Caption>
                <div className="row wrap">
                  {templateKinds(template).map((kind) => (
                    <button key={kind} className="pill" onClick={() => setCompose({ kind })}>+ {kindTitle(kind)}</button>
                  ))}
                </div>
              </div>
            ) : board.status === 'locked' ? (
              <p className="faint small">Das Tafelbild ist gesperrt. Die Moderation kann es wieder freigeben.</p>
            ) : null}
          </>
        )}

        {tab === 'proposals' && (
          <>
            {blocks.filter((b) => b.status === 'proposed').length === 0 && <p className="faint">Keine offenen Vorschläge.</p>}
            {moderator && board.status === 'open' && open >= 2 && (
              <div className="row">
                <span className="muted small grow">{selection.length >= 2 ? `${selection.length} für die Abstimmung gewählt` : 'Wähle mindestens zwei Vorschläge für eine Abstimmung.'}</span>
                <button className="btn outline small" disabled={selection.length < 2} onClick={() => setAskingPoll(true)}>Abstimmung</button>
              </div>
            )}
            {blocks.filter((b) => b.status === 'proposed').map((block) => {
              const replaced = block.replacesBlock ? blocks.find((b) => b.id === block.replacesBlock) : undefined;
              return (
                <div key={block.id} className="row" style={{ alignItems: 'flex-start' }}>
                  {moderator && board.status === 'open' && open >= 2 && (
                    <input type="checkbox" style={{ marginTop: 18, width: 18, height: 18 }} checked={selection.includes(block.id)} onChange={(e) => setSelection(e.target.checked ? [...selection, block.id] : selection.filter((id) => id !== block.id))} />
                  )}
                  <div className="col grow gap-s">
                    <BlockCard block={block} mine={block.author === me} replacedTitle={replaced ? replaced.title || kindTitle(kindFrom(replaced.kind)) : undefined} />
                    {board.status === 'open' && (
                      <div className="row">
                        {moderator && <button className="btn small" onClick={() => void acceptBlock(board, block)}>Übernehmen</button>}
                        {(moderator || block.author === me) && <button className="btn outline small" onClick={() => setCompose({ kind: kindFrom(block.kind), editing: block })}>Bearbeiten</button>}
                        {moderator ? <button className="btn outline small" onClick={() => void rejectBlock(board, block)}>Ablehnen</button> : block.author === me && <button className="btn outline small" onClick={() => void withdrawBlock(board, block)}>Zurückziehen</button>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'polls' && (
          <>
            {(state.polls[boardId] ?? []).length === 0 && <p className="faint">{moderator ? 'Noch keine Abstimmung. Wähle unter „Vorschläge“ mindestens zwei Beiträge aus.' : 'Noch keine Abstimmung.'}</p>}
            {[...(state.polls[boardId] ?? [])].reverse().map((poll) => (
              <PollCard key={poll.id} board={board} poll={poll} blocks={blocks} moderator={moderator} />
            ))}
          </>
        )}

        {tab === 'history' && (
          <>
            <p className="muted small">Jede Übernahme speichert eine Version. Ein Moderator kann zu einer früheren zurückkehren.</p>
            {(state.versions[boardId] ?? []).length === 0 && <p className="faint">Noch keine Versionen.</p>}
            {(state.versions[boardId] ?? []).map((v) => (
              <div key={v.id}>
                <div className="row" style={{ padding: '8px 0' }}>
                  <div className="grow">
                    <div style={{ fontWeight: 500 }}>{v.label}</div>
                    <span className="mono faint" style={{ fontSize: 11 }}>{timeLabel(v.createdAt)} · {v.profiles?.displayName ?? ''}</span>
                  </div>
                  {moderator && board.status === 'open' && <button className="btn outline small" onClick={() => void restoreVersion(board, v)}>Wiederherstellen</button>}
                </div>
                <hr className="line" />
              </div>
            ))}
          </>
        )}
      </div>

      {compose && <ComposeDialog board={board} request={compose} moderator={moderator} onClose={() => setCompose(null)} />}
      {askingPoll && <PromptDialog title="Frage der Abstimmung" label="Welche Definition gehört ins Tafelbild?" confirm="Starten" onSubmit={(text) => { const ids = selection; setSelection([]); setTab('polls'); void startPoll(board, text, ids); }} onClose={() => setAskingPoll(false)} />}
      {confirmFinal && <ConfirmDialog title="Ergebnissicherung abschließen?" text="Danach kann niemand mehr etwas ändern. Offene Abstimmungen werden beendet." confirm="Abschließen" onConfirm={() => void finalizeBoard(board)} onClose={() => setConfirmFinal(false)} />}
    </div>
  );
}

function BlockCard({ block, mine, replacedTitle, children }: { block: Block; mine: boolean; replacedTitle?: string; children?: React.ReactNode }) {
  const kind = kindFrom(block.kind);
  return (
    <div className="card col" style={{ gap: 8 }}>
      <span className="kind">{kindTitle(kind)}</span>
      {replacedTitle && <span className="small" style={{ color: 'var(--link)', fontWeight: 500 }}>Korrektur zu „{replacedTitle}“</span>}
      {block.title && <div style={{ fontSize: 17, fontWeight: 600 }}>{block.title}</div>}
      {block.body && <div className={wantsSymbols(kind) ? 'formula' : ''} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }}>{block.body}</div>}
      {block.attachmentPath && <BoardImage path={block.attachmentPath} />}
      <div className="row">
        <span className="mono faint grow" style={{ fontSize: 10.5 }}>{mine ? 'Du' : block.profiles?.displayName ?? 'Unbekannt'} · {timeLabel(block.createdAt)}</span>
        {children && <div className="row small">{children}</div>}
      </div>
    </div>
  );
}

const imageCache = new Map<string, string>();

/** A picture from the group's folder, downloaded once. */
function BoardImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(imageCache.get(path) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (url) return;
    let cancelled = false;
    void download(path).then((data) => {
      if (cancelled) return;
      if (!data) return setFailed(true);
      const made = URL.createObjectURL(new Blob([data as BlobPart], { type: 'image/jpeg' }));
      imageCache.set(path, made);
      setUrl(made);
    });
    return () => {
      cancelled = true;
    };
  }, [path, url]);
  if (url) return <img className="sketch" src={url} alt="Skizze" />;
  return <span className="faint small">{failed ? 'Das Bild lässt sich nicht laden.' : 'Lade Bild …'}</span>;
}

function PollCard({ board, poll, blocks, moderator }: { board: Board; poll: Poll; blocks: Block[]; moderator: boolean }) {
  const counts = boards.use().counts[board.id] ?? [];
  const mine = (boards.use().myVotes[board.id] ?? []).find((v) => v.pollId === poll.id)?.blockId;
  const result = shares(poll, counts);
  return (
    <div className="card col">
      <div className="row"><strong className="grow" style={{ fontSize: 16.5 }}>{poll.question}</strong><span className="caption">{poll.status === 'open' ? 'Offen' : 'Beendet'}</span></div>
      {(poll.pollOptions ?? []).map(({ blockId }) => {
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return null;
        const percent = result.percent[blockId] ?? 0;
        const chosen = mine === blockId;
        return (
          <button
            key={blockId}
            className="card col"
            style={{ gap: 6, borderColor: chosen ? 'var(--accent)' : undefined, borderWidth: chosen ? 2 : 1, background: 'var(--bg)' }}
            onClick={() => poll.status === 'open' && void vote(board, poll, blockId)}
          >
            <div className="row">
              <strong className="grow">{block.title || kindTitle(kindFrom(block.kind))}</strong>
              {chosen && <span style={{ color: 'var(--accent)' }}>✔</span>}
              {poll.winner === blockId && <span className="caption" style={{ color: 'var(--link)' }}>Übernommen</span>}
              <span className="mono muted small">{percent} %</span>
            </div>
            {block.body && <span className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{block.body}</span>}
            <div className="bar"><i className={chosen || poll.winner === blockId ? 'on' : ''} style={{ width: `${percent}%` }} /></div>
          </button>
        );
      })}
      <span className="mono faint" style={{ fontSize: 10.5 }}>{result.total} Stimmen</span>
      {poll.status === 'open' && moderator && <div className="row"><button className="btn small" onClick={() => void closePoll(board, poll)}>Abstimmung beenden und Gewinner übernehmen</button></div>}
    </div>
  );
}

const symbols = ['∫', '∑', '√', 'π', '±', '×', '·', '÷', '≤', '≥', '≠', '≈', '→', '⇌', '∞', 'Δ', 'α', 'β', 'θ', '²', '³', 'ⁿ', '₀', '₁', '₂', 'ₐ', 'ᵦ'];

/** A photo for a sketch block: at most 1600 pixels on the long side, JPEG. */
async function toJpeg(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const bitmap = await createImageBitmap(new Blob([data as BlobPart]));
    const scale = Math.max(bitmap.width, bitmap.height) > 1600 ? 1600 / Math.max(bitmap.width, bitmap.height) : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

function ComposeDialog({ board, request, moderator, onClose }: { board: Board; request: ComposeRequest; moderator: boolean; onClose: () => void }) {
  const source = request.editing ?? request.replacing;
  const [title, setTitle] = useState(source?.title ?? '');
  const [text, setText] = useState(source?.body ?? '');
  const [image, setImage] = useState<{ name: string; data: Uint8Array } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const busy = social.use().busy;
  const heading = request.editing ? `${kindTitle(request.kind)} bearbeiten` : request.replacing ? 'Korrektur vorschlagen' : kindTitle(request.kind);
  const canSend = (title.trim() !== '' || text.trim() !== '' || image !== null) && !busy;
  const symbolsOn = useMemo(() => wantsSymbols(request.kind), [request.kind]);

  const insert = (symbol: string) => {
    const element = area.current;
    if (!element) return setText(text + symbol);
    const { selectionStart, selectionEnd } = element;
    setText(text.slice(0, selectionStart) + symbol + text.slice(selectionEnd));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(selectionStart + symbol.length, selectionStart + symbol.length);
    });
  };

  const send = async (acceptNow: boolean) => {
    const done = request.editing
      ? await editBlock(board, request.editing, title, text)
      : await propose(board, { kind: request.kind, title, body: text, replacing: request.replacing?.id, image, acceptNow });
    if (done) onClose();
  };

  return (
    <Dialog onClose={onClose}>
      <div className="col">
        <Caption>{heading}</Caption>
        <input className="field" autoFocus placeholder={titleHint(request.kind)} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea ref={area} className={`field ${symbolsOn ? 'mono' : ''}`} style={{ minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} />
        {symbolsOn && (
          <div className="symbols">
            {symbols.map((s) => <button key={s} onClick={() => insert(s)}>{s}</button>)}
          </div>
        )}
        {request.kind === 'sketch' && !request.editing && (
          <div className="row">
            <button
              className="btn outline small"
              onClick={async () => {
                const [file] = await pickFiles({ filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg'] }] });
                if (!file) return;
                const jpeg = await toJpeg(file.data);
                if (jpeg) setImage({ name: 'skizze.jpg', data: jpeg });
                else say('Das Bild lässt sich nicht öffnen.');
              }}
            >
              {image ? 'Foto ersetzen' : 'Foto hinzufügen'}
            </button>
            {image && <span className="muted small">Foto gewählt</span>}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn outline" onClick={onClose}>Abbrechen</button>
          {moderator && !request.editing && board.status === 'open' && <button className="btn outline" disabled={!canSend} onClick={() => void send(true)}>Direkt übernehmen</button>}
          <button className="btn" disabled={!canSend} onClick={() => void send(false)}>{request.editing ? 'Speichern' : 'Vorschlagen'}</button>
        </div>
      </div>
    </Dialog>
  );
}
