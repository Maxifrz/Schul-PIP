// The Tafelbild: a port of Lernwerk/Services/Social/BoardModels.swift (kinds, templates, logic) and of the board calls.

export const blockKinds = [
  'definition', 'explanation', 'formula', 'example', 'rule', 'sketch', 'question', 'text',
  'observation', 'interpretation', 'equation', 'result',
  'event', 'causes', 'course', 'consequences',
  'structure', 'process', 'function', 'significance',
] as const;
export type BlockKind = (typeof blockKinds)[number];

const kindTitles: Record<BlockKind, string> = {
  definition: 'Definition', explanation: 'Erklärung', formula: 'Formel', example: 'Beispiel', rule: 'Merksatz',
  sketch: 'Skizze', question: 'Frage', text: 'Text', observation: 'Beobachtung', interpretation: 'Deutung',
  equation: 'Reaktionsgleichung', result: 'Ergebnis', event: 'Ereignis', causes: 'Ursachen', course: 'Verlauf',
  consequences: 'Folgen', structure: 'Struktur', process: 'Prozess', function: 'Funktion', significance: 'Bedeutung',
};

export const kindTitle = (kind: BlockKind) => kindTitles[kind];
export const kindFrom = (raw: string): BlockKind => ((blockKinds as readonly string[]).includes(raw) ? (raw as BlockKind) : 'text');

export function titleHint(kind: BlockKind): string {
  switch (kind) {
    case 'definition': return 'Begriff, z. B. Bestimmtes Integral';
    case 'formula':
    case 'equation': return 'Wofür? z. B. Hauptsatz';
    case 'question': return 'Die Frage';
    case 'sketch': return 'Was zeigt die Skizze?';
    default: return 'Überschrift (kann leer bleiben)';
  }
}

/** Formulas are typed with symbols the keyboard hides; the editor offers them in a row. */
export const wantsSymbols = (kind: BlockKind) => kind === 'formula' || kind === 'equation' || kind === 'example';

export const templates = ['general', 'math', 'chemistry', 'history', 'biology'] as const;
export type Template = (typeof templates)[number];

const templateTitles: Record<Template, string> = {
  general: 'Allgemein', math: 'Mathematik', chemistry: 'Chemie', history: 'Geschichte', biology: 'Biologie',
};
export const templateTitle = (t: Template) => templateTitles[t];

/** The order of the sections on the finished board, and the buttons offered for a new contribution. */
export function templateKinds(template: Template): BlockKind[] {
  switch (template) {
    case 'math': return ['definition', 'formula', 'explanation', 'example', 'rule', 'sketch', 'question'];
    case 'chemistry': return ['observation', 'interpretation', 'equation', 'result', 'definition', 'example', 'question'];
    case 'history': return ['event', 'causes', 'course', 'consequences', 'definition', 'question'];
    case 'biology': return ['structure', 'process', 'function', 'significance', 'definition', 'sketch', 'question'];
    default: return ['definition', 'explanation', 'formula', 'example', 'rule', 'sketch', 'question', 'text'];
  }
}

/** A template for a subject name ("Mathe LK" leads to math), general when none fits. */
export function suggestTemplate(name: string): Template {
  const lower = name.toLowerCase();
  if (lower.includes('mathe')) return 'math';
  if (lower.includes('chemie')) return 'chemistry';
  if (lower.includes('geschichte')) return 'history';
  if (lower.includes('bio')) return 'biology';
  return 'general';
}

export interface Board {
  id: string;
  groupId: string;
  title: string;
  topic: string;
  template: string;
  lessonDate: string;
  status: 'open' | 'locked' | 'final';
  createdBy: string;
  finalizedAt: string | null;
  createdAt: string;
}

export const boardTemplate = (board: Board): Template => ((templates as readonly string[]).includes(board.template) ? (board.template as Template) : 'general');

/** "08.10.2026" for the ISO date the server sends. */
export function dateLabel(board: Board): string {
  const parts = board.lessonDate.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : board.lessonDate;
}

export interface Block {
  id: string;
  boardId: string;
  kind: string;
  title: string;
  body: string;
  attachmentPath: string | null;
  status: 'proposed' | 'accepted' | 'rejected';
  position: number;
  author: string;
  replacesBlock: string | null;
  rev: number;
  createdAt: string;
  updatedAt: string;
  profiles: { displayName: string } | null;
}

export interface Version {
  id: string;
  boardId: string;
  label: string;
  createdAt: string;
  profiles: { displayName: string } | null;
}

export interface Poll {
  id: string;
  boardId: string;
  question: string;
  status: 'open' | 'closed';
  winner: string | null;
  createdAt: string;
  pollOptions?: Array<{ blockId: string }>;
}

export interface PollCount {
  pollId: string;
  blockId: string;
  votes: number;
}

export interface PollVote {
  pollId: string;
  blockId: string;
}

export interface Section {
  kind: BlockKind;
  blocks: Block[];
}

/** The accepted blocks in the order of the template's sections; blocks of a kind the template does not list come last. */
export function sections(template: Template, blocks: Block[]): Section[] {
  const accepted = blocks.filter((b) => b.status === 'accepted');
  const order = templateKinds(template);
  for (const block of accepted) {
    const kind = kindFrom(block.kind);
    if (!order.includes(kind)) order.push(kind);
  }
  const result: Section[] = [];
  for (const kind of order) {
    const inKind = accepted
      .filter((b) => kindFrom(b.kind) === kind)
      .sort((a, b) => a.position - b.position || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    if (inKind.length > 0) result.push({ kind, blocks: inKind });
  }
  return result;
}

export interface Stats {
  contributions: number;
  accepted: number;
  open: number;
  rejected: number;
  people: number;
}

export function stats(blocks: Block[]): Stats {
  return {
    contributions: blocks.length,
    accepted: blocks.filter((b) => b.status === 'accepted').length,
    open: blocks.filter((b) => b.status === 'proposed').length,
    rejected: blocks.filter((b) => b.status === 'rejected').length,
    people: new Set(blocks.map((b) => b.author)).size,
  };
}

/** Votes per option, and each option's share of all votes as a whole percent (0 while nobody has voted). */
export function shares(poll: Poll, counts: PollCount[]): { votes: Record<string, number>; percent: Record<string, number>; total: number } {
  const votes: Record<string, number> = {};
  for (const option of poll.pollOptions ?? []) votes[option.blockId] = 0;
  for (const count of counts) if (count.pollId === poll.id) votes[count.blockId] = count.votes;
  const total = Object.values(votes).reduce((sum, value) => sum + value, 0);
  const percent: Record<string, number> = {};
  for (const [id, value] of Object.entries(votes)) percent[id] = total === 0 ? 0 : Math.round((value / total) * 100);
  return { votes, percent, total };
}

/** The finished result as plain text, one section after the other. */
export function resultText(board: Board, groupName: string, blocks: Block[]): string {
  const lines: string[] = [board.title.toUpperCase(), `${groupName} · ${dateLabel(board)}`];
  if (board.topic !== '') lines.push(board.topic);
  for (const section of sections(boardTemplate(board), blocks)) {
    lines.push('', kindTitle(section.kind).toUpperCase());
    for (const block of section.blocks) {
      if (block.title !== '') lines.push(block.title);
      if (block.body !== '') lines.push(block.body);
      if (block.attachmentPath) lines.push('(Bild im Tafelbild)');
    }
  }
  const summary = stats(blocks);
  lines.push('', `Erarbeitet von ${groupName}: ${summary.accepted} Beiträge übernommen, ${summary.people} Beteiligte`);
  return lines.join('\n');
}

/** Flashcards from the accepted blocks that state something to remember: the title (or the kind) is the question, the
 * text the answer. */
export function flashcards(board: Board, blocks: Block[]): Array<{ front: string; back: string }> {
  const askable: BlockKind[] = ['definition', 'rule', 'formula', 'equation', 'explanation', 'interpretation', 'result', 'causes', 'consequences', 'function', 'significance'];
  const cards: Array<{ front: string; back: string }> = [];
  for (const section of sections(boardTemplate(board), blocks)) {
    if (!askable.includes(section.kind)) continue;
    for (const block of section.blocks) {
      const answer = block.body.trim();
      if (answer === '') continue;
      const subject = block.title.trim();
      cards.push({ front: subject === '' ? `${kindTitle(section.kind)} zu „${board.title}“` : `${kindTitle(section.kind)}: ${subject}`, back: answer });
    }
  }
  return cards;
}

export const reviewSystem =
  'You review a lesson result that a German upper-secondary class wrote together. You are a careful subject teacher: ' +
  'you point out mistakes, contradictions and gaps, you never rewrite the result and never add content of your own. ' +
  'Write in German, address the class as "ihr" and write math with Unicode characters, never LaTeX.';

/** The prompt for the quality check: the AI reads the result and says what is missing or contradicts itself. */
export function reviewPrompt(board: Board, groupName: string, blocks: Block[]): string {
  return `Das ist das Stundenergebnis, das eine Klasse gemeinsam erarbeitet hat (Kurs: ${groupName}, Thema: ${board.title}).

${resultText(board, groupName, blocks)}

Prüfe das Ergebnis und antworte auf Deutsch in höchstens sechs kurzen Stichpunkten:
- Was ist fachlich falsch oder missverständlich?
- Wo widersprechen sich zwei Beiträge?
- Was fehlt noch (zum Beispiel ein Anwendungsbeispiel oder eine Abgrenzung)?
Schreib das Ergebnis nicht um und erfinde keine Beiträge. Wenn alles stimmt, sag das in einem Satz.`;
}

/** The finished result as a printable page (the main process turns it into a PDF). */
export function resultHtml(board: Board, groupName: string, blocks: Block[]): string {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const parts: string[] = [`<h1>${escape(board.title)}</h1>`, `<p class="meta">${escape(groupName)} · ${dateLabel(board)}</p>`];
  if (board.topic !== '') parts.push(`<p class="topic">${escape(board.topic)}</p>`);
  for (const section of sections(boardTemplate(board), blocks)) {
    parts.push(`<h2>${escape(kindTitle(section.kind))}</h2>`);
    const mono = section.kind === 'formula' || section.kind === 'equation';
    for (const block of section.blocks) {
      if (block.title !== '') parts.push(`<h3>${escape(block.title)}</h3>`);
      if (block.body !== '') parts.push(`<p class="${mono ? 'mono' : ''}">${escape(block.body)}</p>`);
      if (block.attachmentPath) parts.push('<p class="meta"><i>(Bild im Tafelbild)</i></p>');
    }
  }
  const summary = stats(blocks);
  parts.push(`<p class="meta foot">Erarbeitet von ${escape(groupName)}: ${summary.accepted} Beiträge übernommen, ${summary.people} Beteiligte</p>`);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
    body{font-family:'Segoe UI',Arial,sans-serif;color:#16150f;margin:0;font-size:12.5pt;line-height:1.45}
    h1{font-size:24pt;margin:0 0 4pt} h2{font-size:9.5pt;letter-spacing:.08em;text-transform:uppercase;color:#6e6b62;margin:18pt 0 6pt}
    h3{font-size:13pt;margin:8pt 0 2pt} p{margin:0 0 8pt} .meta{color:#6e6b62;font-size:10pt} .topic{color:#555}
    .mono{font-family:Consolas,'Courier New',monospace} .foot{margin-top:22pt}
  </style></head><body>${parts.join('')}</body></html>`;
}
