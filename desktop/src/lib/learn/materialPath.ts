import { folded } from './exercise';

/** A stretch of a material's pages that is turned into cards in one request. */
export interface MaterialChunk {
  /** Page numbers from 1. */
  pages: number[];
  /** The pages' text, each page under "--- Page N ---". */
  text: string;
}

export const firstPage = (chunk: MaterialChunk): number => chunk.pages[0] ?? 1;

/** "S. 3" or "S. 3–5". */
export function pagesLabel(chunk: MaterialChunk): string {
  if (chunk.pages.length === 0) return '';
  const first = chunk.pages[0];
  const last = chunk.pages[chunk.pages.length - 1];
  return first === last ? `S. ${first}` : `S. ${first}–${last}`;
}

/** A card the model wrote for a page of a material. */
export interface GeneratedCard {
  front: string;
  back: string;
  page: number;
}

export interface Flashcard {
  front: string;
  back: string;
}

/** Writes flashcards for a stretch of a material. */
export type FlashcardWriter = (title: string, label: string, pages: string) => Promise<Flashcard[]>;

/** The most characters of page text in one request: about three dense pages, which gives six to ten cards. */
export const maxChunkCharacters = 6000;
/** Stretches asked for in one run, so one tap costs a bounded number of requests. */
export const maxChunksPerRun = 10;
/** A page with less text than this is a picture or a scan and has nothing to ask about. */
export const minimumPageCharacters = 40;

/** The Lernpfad from a material: its pages are cut into stretches, the model writes cards for each, and the cards become the units and lessons of the path. */
export const MaterialPath = {
  chunks(pageTexts: string[]): MaterialChunk[] {
    const chunks: MaterialChunk[] = [];
    let pages: number[] = [];
    let parts: string[] = [];
    let size = 0;
    const close = () => {
      if (pages.length > 0) chunks.push({ pages, text: parts.join('\n') });
      pages = [];
      parts = [];
      size = 0;
    };
    pageTexts.forEach((raw, index) => {
      const text = raw.trim();
      if ([...text].length < minimumPageCharacters) {
        // A picture page ends the stretch: what comes after it is another thought.
        close();
        return;
      }
      const clipped = [...text].slice(0, maxChunkCharacters).join('');
      if (size > 0 && size + clipped.length > maxChunkCharacters) close();
      pages.push(index + 1);
      parts.push(`--- Page ${index + 1} ---\n${clipped}`);
      size += clipped.length;
    });
    close();
    return chunks;
  },

  /** The stretches that have no card yet: a card made from a stretch is stored with the stretch's first page. */
  stretchesWithoutCards(chunks: MaterialChunk[], cardPages: Set<number>): MaterialChunk[] {
    return chunks.filter((chunk) => !chunk.pages.some((p) => cardPages.has(p)));
  },

  /** The model's cards without empty ones and without one whose question the student already has. */
  fresh(cards: Flashcard[], existingFronts: string[], page: number): GeneratedCard[] {
    const seen = new Set(existingFronts.map(folded));
    const result: GeneratedCard[] = [];
    for (const card of cards) {
      const front = card.front.trim();
      const back = card.back.trim();
      if (front === '' || back === '' || seen.has(folded(front))) continue;
      seen.add(folded(front));
      result.push({ front, back, page });
    }
    return result;
  },

  /** Asks for cards stretch by stretch. A stretch whose request fails stops the run; what came before is returned. */
  async generate(args: {
    title: string;
    pageTexts: string[];
    cardPages: Set<number>;
    existingFronts: string[];
    writer: FlashcardWriter;
    progress?: (done: number, total: number) => void;
    cancelled?: () => boolean;
  }): Promise<{ cards: GeneratedCard[]; done: number; remaining: number; failure: string | null }> {
    const open = MaterialPath.stretchesWithoutCards(MaterialPath.chunks(args.pageTexts), args.cardPages);
    const batch = open.slice(0, maxChunksPerRun);
    const outcome = { cards: [] as GeneratedCard[], done: 0, remaining: open.length, failure: null as string | null };
    let fronts = [...args.existingFronts];
    for (let index = 0; index < batch.length; index++) {
      const chunk = batch[index];
      args.progress?.(index, batch.length);
      if (args.cancelled?.()) {
        outcome.failure = 'Abgebrochen.';
        return outcome;
      }
      try {
        const written = await args.writer(args.title, pagesLabel(chunk), `<pages ${pagesLabel(chunk)}>\n${chunk.text}\n</pages>`);
        const cards = MaterialPath.fresh(written, fronts, firstPage(chunk));
        fronts = [...fronts, ...cards.map((c) => c.front)];
        outcome.cards.push(...cards);
        outcome.done += 1;
        outcome.remaining -= 1;
      } catch (error) {
        outcome.failure = error instanceof Error ? error.message : String(error);
        return outcome;
      }
    }
    args.progress?.(batch.length, batch.length);
    return outcome;
  },
};

export const flashcardSystem =
  'You help a German upper-secondary student practise one topic of their study plan. Write in German, address the student as "du" and write math with Unicode characters, never LaTeX. ' +
  'Stay with what the pages of their material cover. Answer only with JSON: {"cards":[{"front":"…","back":"…"}]}';

export function flashcardPrompt(title: string, label: string, pages: string): string {
  return `Topic: ${title}\nGoal: \n${pages.slice(0, 24_000)}\n\nWrite 6 to 10 flashcards for the most important facts, terms, rules and steps of this topic (${label}). The front is a precise question, the back a short answer of at most two sentences.`;
}

/** The cards from the model's answer; throws when it is not the expected JSON. */
export function parseFlashcards(text: string): Flashcard[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Die Antwort der KI konnte nicht gelesen werden.');
  const root = JSON.parse(text.slice(start, end + 1)) as { cards?: unknown };
  if (!Array.isArray(root.cards)) throw new Error('Die Antwort der KI konnte nicht gelesen werden.');
  const cards = root.cards.flatMap((c) => {
    if (typeof c !== 'object' || c === null) return [];
    const { front, back } = c as { front?: unknown; back?: unknown };
    return typeof front === 'string' && typeof back === 'string' ? [{ front, back }] : [];
  });
  if (cards.length === 0) throw new Error('Die KI hat keine Karten geschrieben.');
  return cards;
}
