import { DragEvent, useEffect, useRef, useState } from 'react';
import { pickFiles, saveFile } from '../lib/platform';
import { maxFileBytes, timeLabel } from '../lib/social/format';
import type { Group, Message } from '../lib/social/models';
import { fail, importMaterial, say } from '../store/app';
import {
  addResult, createGroup, deleteMessage, deleteResult, download, forgetServer, joinSubgroup, joinWithCode, leaveGroup,
  refreshGroups, refreshMembers, refreshMessages, refreshResults, reportMessage, saveServer, sendFile, sendMessage, setRole, signIn, signOut,
  signUp, social,
} from '../store/social';
import { Caption, ConfirmDialog, PageHeader, Pills, PromptDialog } from '../ui/kit';
import { BoardsPane } from './Board';

export function Courses() {
  const state = social.use();
  if (state.phase === 'loading') return <div className="page"><span className="muted">Lade …</span></div>;
  if (state.phase === 'unconfigured') return <ServerSetup />;
  if (state.phase === 'signedOut') return <AuthForm />;
  return <CoursesHome />;
}

function ServerSetup() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <PageHeader caption="Zusammenarbeit" title="Kurse" />
      <p className="muted">
        Kurse, Gruppenarbeit, Chat und Tafelbild laufen über einen Server, den du selbst anlegst (Supabase, kostenlos). Es ist derselbe wie in der
        iPad- und Handy-App: Mit der gleichen Adresse und dem gleichen Schlüssel siehst du dort deine Kurse. Die Anleitung steht in
        supabase/README.md im Projekt.
      </p>
      <div className="col">
        <input className="field" placeholder="Projekt-Adresse (https://….supabase.co)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="field" placeholder="anon public key" value={key} onChange={(e) => setKey(e.target.value)} />
        {problem && <span className="small" style={{ color: 'var(--warn)' }}>{problem}</span>}
        <div className="row">
          <button className="btn" disabled={url === '' || key === ''} onClick={async () => setProblem(await saveServer(url, key))}>Verbinden</button>
        </div>
      </div>
    </div>
  );
}

function AuthForm() {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const busy = social.use().busy;
  const submit = () => (registering ? signUp(name, email, password) : signIn(email, password));
  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <PageHeader caption="Zusammenarbeit" title={registering ? 'Konto anlegen' : 'Anmelden'} />
      <form className="col" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {registering && <input className="field" placeholder="Name, den die anderen sehen" value={name} onChange={(e) => setName(e.target.value)} />}
        <input className="field" type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="field" type="password" placeholder="Passwort (mindestens 6 Zeichen)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="row">
          <button className="btn" type="submit" disabled={email === '' || password === '' || busy}>{registering ? 'Konto anlegen' : 'Anmelden'}</button>
          <button className="link muted" type="button" onClick={() => setRegistering(!registering)}>{registering ? 'Ich habe schon ein Konto' : 'Neu hier? Konto anlegen'}</button>
          <button className="link muted" type="button" onClick={() => void forgetServer()}>Server ändern</button>
        </div>
      </form>
    </div>
  );
}

function CoursesHome() {
  const state = social.use();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const courses = state.groups.filter((g) => g.kind === 'course');
  const group = state.groups.find((g) => g.id === selected) ?? null;

  useEffect(() => {
    void refreshGroups();
    const timer = setInterval(() => void refreshGroups(), 20_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="split">
      <div className="list">
        <Caption>Zusammenarbeit</Caption>
        <h1 className="title" style={{ fontSize: 30, marginBottom: 16 }}>Kurse</h1>
        <div className="col gap-s" style={{ marginBottom: 14 }}>
          <button className="btn small" onClick={() => setCreating(true)}>Kurs anlegen</button>
          <button className="btn outline small" onClick={() => setJoining(true)}>Mit Code beitreten</button>
        </div>
        {courses.length === 0 && <p className="muted small">Du bist in keinem Kurs. Lege einen an und gib den Code deinen Mitschülern, oder tritt mit einem Code bei.</p>}
        {courses.map((course) => (
          <div key={course.id}>
            <button className={`item ${selected === course.id ? 'on' : ''}`} onClick={() => setSelected(course.id)}>
              <div style={{ fontWeight: 600 }}>{course.name}</div>
              <div className="mono faint" style={{ fontSize: 11 }}>CODE {course.joinCode}</div>
            </button>
            {state.groups.filter((g) => g.parentId === course.id).map((sub) => (
              <button key={sub.id} className={`item ${selected === sub.id ? 'on' : ''}`} style={{ paddingLeft: 30 }} onClick={() => setSelected(sub.id)}>
                <div>{sub.name}</div>
              </button>
            ))}
          </div>
        ))}
        <hr className="line" style={{ margin: '18px 0 10px' }} />
        <div className="col gap-s small">
          {state.me && <span className="faint">{state.me.name}</span>}
          <button className="link muted" style={{ textAlign: 'left' }} onClick={() => void signOut()}>Abmelden</button>
        </div>
      </div>
      <div className="detail">
        {group ? <GroupDetail key={group.id} group={group} onLeft={() => setSelected(null)} onOpen={setSelected} /> : <div className="page"><p className="muted">Wähl links einen Kurs oder eine Gruppe.</p></div>}
      </div>
      {creating && <PromptDialog title="Kurs anlegen" label="Name, z. B. Mathe LK 12" confirm="Anlegen" onSubmit={async (text) => { const g = await createGroup(text, null); if (g) setSelected(g.id); }} onClose={() => setCreating(false)} />}
      {joining && <PromptDialog title="Mit Code beitreten" label="Code, z. B. K7M2QX" confirm="Beitreten" onSubmit={async (text) => { const g = await joinWithCode(text); if (g) setSelected(g.id); }} onClose={() => setJoining(false)} />}
    </div>
  );
}

type GroupTab = 'chat' | 'board' | 'files' | 'groups' | 'members';

function GroupDetail({ group, onLeft, onOpen }: { group: Group; onLeft: () => void; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<GroupTab>('chat');
  const [leaving, setLeaving] = useState(false);
  const tabs: Array<{ id: GroupTab; label: string }> = [
    { id: 'chat', label: 'Chat' },
    { id: 'board', label: 'Tafelbild' },
    { id: 'files', label: 'Dateien' },
    ...(group.kind === 'course' ? [{ id: 'groups' as const, label: 'Gruppen' }] : []),
    { id: 'members', label: 'Mitglieder' },
  ];

  useEffect(() => {
    void refreshMembers(group);
  }, [group]);

  return (
    <>
      <div style={{ padding: '22px 28px 12px' }}>
        <div className="row">
          <div className="grow">
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{group.name}</h2>
            <span className="caption">{group.kind === 'course' ? 'Kurs' : 'Gruppe'} · Code {group.joinCode}</span>
          </div>
          <button className="btn outline small" onClick={() => { void navigator.clipboard?.writeText(group.joinCode); say('Code kopiert.'); }}>Code kopieren</button>
          <button className="btn outline small" onClick={() => setLeaving(true)}>Verlassen</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <Pills items={tabs} value={tab} onChange={setTab} />
        </div>
      </div>
      <div className="grow" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {tab === 'chat' && <ChatPane group={group} />}
        {tab === 'board' && <BoardsPane group={group} />}
        {tab === 'files' && <FilesPane group={group} />}
        {tab === 'groups' && <SubgroupsPane course={group} onOpen={onOpen} />}
        {tab === 'members' && <MembersPane group={group} />}
      </div>
      {leaving && <ConfirmDialog title={`„${group.name}“ verlassen?`} text="Du kannst mit dem Code wieder beitreten." confirm="Verlassen" onConfirm={async () => { await leaveGroup(group); onLeft(); }} onClose={() => setLeaving(false)} />}
    </>
  );
}

// Chat

const saveLabel = (name: string) => (name.toLowerCase().endsWith('.pdf') ? 'In Bibliothek' : null);

function ChatPane({ group }: { group: Group }) {
  const messages = social.use().messages[group.id] ?? [];
  const me = social.use().me;
  const [draft, setDraft] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // The chat refreshes every few seconds while it is open; there are no push messages.
  useEffect(() => {
    let stopped = false;
    void (async () => {
      while (!stopped) {
        await refreshMessages(group);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [group]);

  useEffect(() => {
    const element = list.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  const send = () => {
    const text = draft;
    setDraft('');
    void sendMessage(group, text);
  };

  const attach = async () => {
    for (const file of await pickFiles({ filters: [{ name: 'Dateien', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'txt'] }], multiple: true })) {
      await sendFile(group, file.name, file.data);
    }
  };

  const drop = async (event: DragEvent) => {
    event.preventDefault();
    for (const file of Array.from(event.dataTransfer.files)) {
      if (file.size > maxFileBytes) say(`„${file.name}“ ist größer als 20 MB.`);
      else await sendFile(group, file.name, new Uint8Array(await file.arrayBuffer()));
    }
  };

  return (
    <div className="chat" onDragOver={(e) => e.preventDefault()} onDrop={(e) => void drop(e)}>
      <div className="messages" ref={list} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
        {messages.length === 0 && <p className="muted" style={{ textAlign: 'center', marginTop: 40 }}>Noch nichts geschrieben. Fang an. Dateien kannst du hierher ziehen.</p>}
        {messages.map((m) => <Bubble key={m.id} group={group} message={m} mine={m.userId === me?.userId} />)}
      </div>
      <div className="composer">
        <button className="round" onClick={() => void attach()} aria-label="Datei anhängen">+</button>
        <textarea
          rows={1}
          placeholder="Nachricht (Enter sendet, Umschalt+Enter macht eine neue Zeile)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="round dark" disabled={draft.trim() === ''} onClick={send} aria-label="Senden">↑</button>
      </div>
    </div>
  );
}

async function keepAttachment(path: string, name: string, toLibrary: boolean): Promise<void> {
  const data = await download(path);
  if (!data) return;
  if (toLibrary) {
    try {
      const material = await importMaterial(name, data);
      say(`„${material.title}“ liegt jetzt in deiner Bibliothek.`);
    } catch (error) {
      fail(error);
    }
  } else if (await saveFile(name, data)) {
    say('Gespeichert.');
  }
}

function Bubble({ group, message, mine }: { group: Group; message: Message; mine: boolean }) {
  return (
    <div className={`msg ${mine ? 'mine' : ''}`}>
      <span className="mono faint" style={{ fontSize: 10.5 }}>{mine ? timeLabel(message.createdAt) : `${message.profiles?.displayName ?? 'Unbekannt'} · ${timeLabel(message.createdAt)}`}</span>
      <div className="bubble-text">
        {message.body}
        {message.attachmentPath && (
          <div className="row small" style={{ marginTop: message.body ? 8 : 0 }}>
            <span>📎 {message.attachmentName ?? 'Datei'}</span>
            <button className="link" style={{ color: 'inherit', textDecoration: 'underline' }} onClick={() => void keepAttachment(message.attachmentPath!, message.attachmentName ?? 'Datei', false)}>Speichern</button>
            {saveLabel(message.attachmentName ?? '') && (
              <button className="link" style={{ color: 'inherit', textDecoration: 'underline' }} onClick={() => void keepAttachment(message.attachmentPath!, message.attachmentName ?? 'Datei', true)}>In Bibliothek</button>
            )}
          </div>
        )}
      </div>
      <span className="small faint">
        {mine ? <button className="link muted" onClick={() => void deleteMessage(group, message)}>Löschen</button> : <button className="link muted" onClick={() => void reportMessage(message)}>Melden</button>}
      </span>
    </div>
  );
}

// Files, work groups, members

function FilesPane({ group }: { group: Group }) {
  const state = social.use();
  const results = state.results[group.id] ?? [];
  const [pending, setPending] = useState<{ name: string; data: Uint8Array } | null>(null);
  useEffect(() => {
    void refreshResults(group);
  }, [group]);
  return (
    <div style={{ padding: '4px 28px 28px', maxWidth: 820 }}>
      <p className="muted small">Hier sichert die Gruppe, was fertig ist: Lösungen, Zusammenfassungen, Plakate. Jeder kann sie in seine Bibliothek laden.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn small" onClick={async () => { const [file] = await pickFiles({ filters: [{ name: 'Dateien', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'txt'] }] }); if (file) setPending(file); }}>Ergebnis hinzufügen</button>
      </div>
      {results.length === 0 && <p className="faint">Noch keine Ergebnisse.</p>}
      <div className="col gap-s">
        {results.map((r) => (
          <div key={r.id} className="card row" style={{ padding: '12px 16px' }}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div className="mono faint" style={{ fontSize: 11 }}>{r.profiles?.displayName ?? 'Unbekannt'} · {timeLabel(r.createdAt)}</div>
            </div>
            <button className="btn outline small" onClick={() => void keepAttachment(r.path, r.fileName, false)}>Speichern</button>
            {saveLabel(r.fileName) && <button className="btn outline small" onClick={() => void keepAttachment(r.path, r.fileName, true)}>In Bibliothek</button>}
            {r.userId === state.me?.userId && <button className="link muted" onClick={() => void deleteResult(group, r)}>Löschen</button>}
          </div>
        ))}
      </div>
      {pending && <PromptDialog title="Wie heißt das Ergebnis?" initial={pending.name.replace(/\.[^.]+$/, '')} confirm="Speichern" onSubmit={(title) => void addResult(group, title.trim(), pending.name, pending.data)} onClose={() => setPending(null)} />}
    </div>
  );
}

function SubgroupsPane({ course, onOpen }: { course: Group; onOpen: (id: string) => void }) {
  const state = social.use();
  const mine = state.groups.filter((g) => g.parentId === course.id);
  const open = state.joinable.filter((g) => g.parentId === course.id);
  const [creating, setCreating] = useState(false);
  return (
    <div style={{ padding: '4px 28px 28px', maxWidth: 820 }}>
      <p className="muted small">Arbeitsgruppen im Kurs, jede mit eigenem Chat, Tafelbild und eigenen Dateien.</p>
      <div className="row" style={{ marginBottom: 14 }}><button className="btn small" onClick={() => setCreating(true)}>Gruppe anlegen</button></div>
      <div className="col gap-s">
        {mine.map((g) => (
          <button key={g.id} className="card row" onClick={() => onOpen(g.id)}><strong className="grow">{g.name}</strong><span className="muted small">Öffnen</span></button>
        ))}
        {open.length > 0 && <div className="caption" style={{ marginTop: 12 }}>Offen für dich</div>}
        {open.map((g) => (
          <div key={g.id} className="card row"><strong className="grow">{g.name}</strong><button className="btn outline small" onClick={() => void joinSubgroup(g)}>Beitreten</button></div>
        ))}
        {mine.length === 0 && open.length === 0 && <p className="faint">Noch keine Gruppen.</p>}
      </div>
      {creating && <PromptDialog title="Gruppe anlegen" label="Name, z. B. Referat Weimarer Republik" confirm="Anlegen" onSubmit={async (text) => { const g = await createGroup(text, course); if (g) onOpen(g.id); }} onClose={() => setCreating(false)} />}
    </div>
  );
}

function MembersPane({ group }: { group: Group }) {
  const state = social.use();
  const members = state.members[group.id] ?? [];
  const owner = members.find((m) => m.userId === state.me?.userId)?.role === 'owner';
  return (
    <div style={{ padding: '4px 28px 28px', maxWidth: 820 }}>
      {members.map((m) => (
        <div key={m.userId}>
          <div className="row" style={{ padding: '10px 0' }}>
            <span className="grow" style={{ fontWeight: 500 }}>{m.profiles?.displayName ?? 'Unbekannt'}</span>
            {m.role === 'owner' && <span className="caption">Gründer</span>}
            {m.role === 'mod' && <span className="caption" style={{ color: 'var(--link)' }}>Moderator</span>}
            {owner && m.role !== 'owner' && (
              <button className="link muted" onClick={() => void setRole(group, m.userId, m.role === 'mod' ? 'member' : 'mod')}>{m.role === 'mod' ? 'Moderation entziehen' : 'Zum Moderator machen'}</button>
            )}
          </div>
          <hr className="line" />
        </div>
      ))}
    </div>
  );
}

