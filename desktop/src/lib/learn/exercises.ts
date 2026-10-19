import { extraWords, pairCount, pairsPrompt, maxExercises } from './builder';
import { AnswerMode, LearnExercise, difficulty, exercise, folded } from './exercise';
import type { BoardSpec, ExerciseMedia } from './media';
import { LearnRandom } from './random';
import { NumberCheck } from './rational';
import type { CourseNode } from './course';

/**
 * Builds the exercises of the course engines in one shape: the same ids, the same shuffling, the same checks. An engine
 * decides what to ask; this decides how it is put. A builder returns null when the material cannot make a sound exercise
 * (too few different wrong answers, a pair that could be taken for another), and the engine leaves that exercise out
 * instead of inventing something.
 */

interface Common {
  id: string;
  key?: string;
  prompt: string;
  solution?: string;
  explanation?: string;
  media?: ExerciseMedia;
}

const cardKeys = (key?: string) => (key === undefined ? [] : [key]);

/** A question with a right answer among two to four options. The wrong ones are cut to three, the options shuffled; nothing that reads the same as the right answer survives. */
export function choice(random: LearnRandom, p: Common & { correct: string; wrong: string[] }): LearnExercise | null {
  const seen = new Set([folded(p.correct)]);
  const options = [p.correct];
  for (const candidate of p.wrong) {
    if (options.length >= 4) break;
    const trimmed = candidate.trim();
    if (trimmed === '' || seen.has(folded(trimmed))) continue;
    seen.add(folded(trimmed));
    options.push(trimmed);
  }
  if (options.length < 2 || folded(p.correct) === '') return null;
  return exercise({
    id: p.id, kind: 'multipleChoice', cardKeys: cardKeys(p.key), prompt: p.prompt, correctAnswers: [p.correct],
    options: random.shuffled(options), solution: p.solution ?? p.correct, media: p.media, explanation: p.explanation ?? '',
  });
}

/** The answer typed. `alternatives` are accepted too; `solution` is what a wrong answer is shown. */
export function typed(p: Common & { answer: string; alternatives?: string[]; mode?: AnswerMode }): LearnExercise | null {
  const all = [p.answer, ...(p.alternatives ?? [])].map((a) => a.trim()).filter((a) => a !== '');
  if (all.length === 0) return null;
  const mode = p.mode ?? 'text';
  if (mode === 'number' && NumberCheck.parse(all[0]) === null) return null;
  return exercise({
    id: p.id, kind: 'typeAnswer', cardKeys: cardKeys(p.key), prompt: p.prompt, correctAnswers: all, solution: p.solution ?? all[0],
    media: p.media, mode, explanation: p.explanation ?? '',
  });
}

/** A sentence put together from tiles. `words` are the right tiles in order, `extra` up to two that do not belong; the tiles never come out in the right order by chance. */
export function bank(random: LearnRandom, p: Common & { words: string[]; extra?: string[] }): LearnExercise | null {
  const tiles = p.words.map((w) => w.trim()).filter((w) => w !== '');
  if (tiles.length < 2 || tiles.length > 10) return null;
  const seen = new Set(tiles.map(folded));
  const extras: string[] = [];
  for (const candidate of p.extra ?? []) {
    if (extras.length >= extraWords) break;
    const trimmed = candidate.trim();
    if (trimmed !== '' && !seen.has(folded(trimmed))) {
      seen.add(folded(trimmed));
      extras.push(trimmed);
    }
  }
  let options = random.shuffled([...tiles, ...extras]);
  let attempts = 0;
  while (options.slice(0, tiles.length).every((v, i) => v === tiles[i]) && new Set(options).size > 1 && attempts < 3) {
    options = random.shuffled(options);
    attempts++;
  }
  return exercise({
    id: p.id, kind: 'wordBank', cardKeys: cardKeys(p.key), prompt: p.prompt, correctAnswers: tiles, options,
    solution: p.solution ?? tiles.join(' '), media: p.media, explanation: p.explanation ?? '',
  });
}

/** Four items to pair up. null unless the fronts differ from each other and so do the backs. */
export function pairs(random: LearnRandom, p: { id: string; prompt?: string; items: Array<{ key: string; front: string; back: string }> }): LearnExercise | null {
  if (p.items.length !== pairCount) return null;
  const fronts = new Set(p.items.map((i) => folded(i.front)));
  const backs = new Set(p.items.map((i) => folded(i.back)));
  if (fronts.size !== p.items.length || backs.size !== p.items.length || fronts.has('') || backs.has('')) return null;
  const shuffled = random.shuffled(p.items.map((i) => ({ key: i.key, front: i.front, back: i.back })));
  return exercise({
    id: p.id, kind: 'matchPairs', cardKeys: shuffled.map((i) => i.key), prompt: p.prompt ?? pairsPrompt,
    correctAnswers: shuffled.map((i) => i.back), options: random.shuffled(shuffled.map((i) => i.back)), pairs: shuffled,
    solution: shuffled.map((i) => `${i.front} – ${i.back}`).join('\n'),
  });
}

/** A chess move to find. `accepted` are all the moves that solve it, in coordinate notation like "e2e4". */
export function move(p: Common & { board: BoardSpec; accepted: string[]; solution: string }): LearnExercise | null {
  if (p.accepted.length === 0) return null;
  return exercise({
    id: p.id, kind: 'chessMove', cardKeys: cardKeys(p.key), prompt: p.prompt, correctAnswers: p.accepted,
    solution: p.solution, media: { kind: 'board', board: p.board }, explanation: p.explanation ?? '',
  });
}

/** A key to tap on the piano; `midi` are all the keys that are right (every octave of a note name, say). */
export function pianoKey(p: Common & { midi: number[]; solution: string }): LearnExercise | null {
  if (p.midi.length === 0) return null;
  return exercise({
    id: p.id, kind: 'pianoKey', cardKeys: cardKeys(p.key), prompt: p.prompt, correctAnswers: p.midi.map(String),
    solution: p.solution, media: p.media, explanation: p.explanation ?? '',
  });
}

// Lessons

/** A seed for one run of one node: the same node and seed always give the same value, other nodes differ. */
export function seedFor(node: CourseNode, base: bigint): bigint {
  let hash = BigInt.asUintN(64, base ^ 0x9e3779b97f4a7c15n);
  for (const byte of new TextEncoder().encode(node.id)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x00000100000001b3n);
  }
  return hash;
}

/** At most `limit` exercises with distinct ids, easy kinds first; exercises of the same kind keep their order. */
export function arrange(list: Array<LearnExercise | null | undefined>, limit = maxExercises): LearnExercise[] {
  const seen = new Set<string>();
  const unique: LearnExercise[] = [];
  for (const item of list) {
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }
  const ordered = unique.map((item, offset) => ({ item, offset })).sort((a, b) => difficulty(a.item.kind) - difficulty(b.item.kind) || a.offset - b.offset);
  return ordered.slice(0, limit).map((o) => o.item);
}

/** Words of a sentence as tiles: split at spaces, with the sentence's closing punctuation left on the last tile. */
export const tiles = (sentence: string): string[] => sentence.split(/\s+/u).filter((w) => w !== '');
