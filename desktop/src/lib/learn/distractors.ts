import { CardSnapshot, } from './cards';
import { pickDistractors } from './builder';

export const cardsPerRequest = 8;
/** Longer wrong answers than this are not in the style of a flashcard's back. */
export const maxLength = 240;

export const distractorSystem =
  "You write wrong answer options for multiple-choice questions on a German upper-secondary student's flashcards. " +
  'For every card write exactly 3 wrong answers in German. Each one must sound plausible to a student who has not ' +
  "learned the topic, have about the same length, style and form as the real answer (a formula stays a formula, a " +
  'name a name, a short sentence a short sentence) and be clearly wrong: never correct, partly correct, a synonym, ' +
  'a rewording or a more general version of the real answer. The three must differ from each other. Write math with ' +
  'Unicode characters, never LaTeX. Answer only with JSON: {"cards":[{"id":"1","distractors":["…","…","…"]}]}';

export function distractorPrompt(cards: CardSnapshot[]): string {
  const lines = ["Write 3 wrong answers for each of these flashcards. Answer with the card's id."];
  cards.forEach((card, index) => {
    lines.push(`<card id="${index + 1}">`, `<front>${card.front}</front>`, `<back>${card.back}</back>`, '</card>');
  });
  return lines.join('\n');
}

/** The wrong answers by the card's position in the request, from 1; ids may come as text or as numbers. Null when the text is not the expected JSON. */
export function parseDistractors(text: string): Map<number, string[]> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  let root: unknown;
  try {
    root = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const items = (root as { cards?: unknown }).cards;
  if (!Array.isArray(items)) return null;
  const result = new Map<number, string[]>();
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, distractors } = item as { id?: unknown; distractors?: unknown };
    const number = typeof id === 'string' ? Number.parseInt(id.trim(), 10) : typeof id === 'number' ? id : Number.NaN;
    if (!Number.isInteger(number) || !Array.isArray(distractors)) continue;
    result.set(number, distractors.filter((d): d is string => typeof d === 'string'));
  }
  return result;
}

/** Up to three of the model's answers that are clearly wrong for the card and of a flashcard's length. */
export function validatedDistractors(candidates: string[], answer: string): string[] {
  return pickDistractors(answer, candidates.filter((c) => [...c].length <= maxLength));
}

/** Asks about the cards in batches and returns what passed, by card key. Stops at the first error. */
export async function fetchDistractors(cards: CardSnapshot[], askModel: (system: string, user: string) => Promise<string>): Promise<Record<string, string[]>> {
  const fetched: Record<string, string[]> = {};
  for (let start = 0; start < cards.length; start += cardsPerRequest) {
    const batch = cards.slice(start, start + cardsPerRequest);
    let answers: Map<number, string[]> | null;
    try {
      answers = parseDistractors(await askModel(distractorSystem, distractorPrompt(batch)));
    } catch {
      break;
    }
    if (!answers) break;
    batch.forEach((card, index) => {
      const written = answers!.get(index + 1);
      if (written) fetched[card.key] = validatedDistractors(written, card.back);
    });
  }
  return fetched;
}
