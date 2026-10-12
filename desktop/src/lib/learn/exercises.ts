// Builds the exercises of the course engines in one shape: the same ids, the same shuffling, the same checks. An
// engine decides what to ask; this decides how it is put. A builder returns null when the material cannot make a
// sound exercise (too few different wrong answers, a pair that could be taken for another), and the engine leaves
// that exercise out instead of inventing something.
// A port of Lernwerk/Services/Learn/Course/Exercises.swift. Swift passes the generator as `using random: inout R`;
// here it is the last argument.

import type { CourseNode } from './course';
import { type AnswerMode, difficulty, folded, learnExercise, type LearnExercise } from './exercise';
import { ExerciseBuilder } from './exerciseConstants';
import type { BoardSpec, ExerciseMedia } from './media';
import { MASK64, type RandomNumberGenerator, shuffle, shuffled } from './random';
import { NumberCheck } from './numberCheck';

const trim = (text: string): string => text.replace(/^[\s]+|[\s]+$/g, '');

export interface ChoiceOptions {
  id: string;
  key?: string | null;
  prompt: string;
  correct: string;
  wrong: string[];
  solution?: string | null;
  explanation?: string;
  media?: ExerciseMedia | null;
}

export interface TypedOptions {
  id: string;
  key?: string | null;
  prompt: string;
  answer: string;
  alternatives?: string[];
  mode?: AnswerMode;
  solution?: string | null;
  explanation?: string;
  media?: ExerciseMedia | null;
}

export interface BankOptions {
  id: string;
  key?: string | null;
  prompt: string;
  words: string[];
  extra?: string[];
  solution?: string | null;
  explanation?: string;
  media?: ExerciseMedia | null;
}

export interface PairsOptions {
  id: string;
  prompt?: string;
  items: { key: string; front: string; back: string }[];
}

export interface MoveOptions {
  id: string;
  key?: string | null;
  prompt: string;
  board: BoardSpec;
  accepted: string[];
  solution: string;
  explanation?: string;
}

export interface KeyOptions {
  id: string;
  key?: string | null;
  prompt: string;
  midi: number[];
  solution: string;
  explanation?: string;
  media?: ExerciseMedia | null;
}

const keysOf = (key: string | null | undefined): string[] => (key == null ? [] : [key]);

export const Exercises = {
  /** A question with a right answer among two to four options. The wrong ones are cut to three, the options
   * shuffled; nothing that reads the same as the right answer survives. */
  choice(o: ChoiceOptions, random: RandomNumberGenerator): LearnExercise | null {
    const seen = new Set<string>([folded(o.correct)]);
    const options = [o.correct];
    for (const candidate of o.wrong) {
      if (options.length >= 4) break;
      const trimmed = trim(candidate);
      if (trimmed === '') continue;
      const f = folded(trimmed);
      if (seen.has(f)) continue;
      seen.add(f);
      options.push(trimmed);
    }
    if (options.length < 2 || folded(o.correct) === '') return null;
    return learnExercise({
      id: o.id,
      kind: 'multipleChoice',
      cardKeys: keysOf(o.key),
      prompt: o.prompt,
      correctAnswers: [o.correct],
      options: shuffled(options, random),
      pairs: [],
      solution: o.solution ?? o.correct,
      media: o.media ?? null,
      explanation: o.explanation ?? '',
    });
  },

  /** The answer typed. `alternatives` are accepted too; `solution` is what a wrong answer is shown. */
  typed(o: TypedOptions): LearnExercise | null {
    const mode = o.mode ?? 'text';
    const all = [o.answer, ...(o.alternatives ?? [])].map(trim).filter((a) => a !== '');
    if (all.length === 0) return null;
    const first = all[0];
    if (mode === 'number' && NumberCheck.parse(first) === null) return null;
    return learnExercise({
      id: o.id,
      kind: 'typeAnswer',
      cardKeys: keysOf(o.key),
      prompt: o.prompt,
      correctAnswers: all,
      options: [],
      pairs: [],
      solution: o.solution ?? first,
      media: o.media ?? null,
      mode,
      explanation: o.explanation ?? '',
    });
  },

  /** A sentence put together from tiles. `words` are the right tiles in order, `extra` up to two that do not
   * belong; the tiles never come out in the right order by chance. */
  bank(o: BankOptions, random: RandomNumberGenerator): LearnExercise | null {
    const tiles = o.words.map(trim).filter((w) => w !== '');
    if (tiles.length < 2 || tiles.length > 10) return null;
    const seen = new Set(tiles.map(folded));
    const extras: string[] = [];
    for (const candidate of o.extra ?? []) {
      if (extras.length >= ExerciseBuilder.extraWords) break;
      const trimmed = trim(candidate);
      if (trimmed === '') continue;
      const f = folded(trimmed);
      if (seen.has(f)) continue;
      seen.add(f);
      extras.push(trimmed);
    }
    const options = shuffled([...tiles, ...extras], random);
    let attempts = 0;
    while (
      options.slice(0, tiles.length).length === tiles.length &&
      options.slice(0, tiles.length).every((w, i) => w === tiles[i]) &&
      new Set(options).size > 1 &&
      attempts < 3
    ) {
      shuffle(options, random);
      attempts += 1;
    }
    return learnExercise({
      id: o.id,
      kind: 'wordBank',
      cardKeys: keysOf(o.key),
      prompt: o.prompt,
      correctAnswers: tiles,
      options,
      pairs: [],
      solution: o.solution ?? tiles.join(' '),
      media: o.media ?? null,
      explanation: o.explanation ?? '',
    });
  },

  /** Four items to pair up. null unless the fronts differ from each other and so do the backs. */
  pairs(o: PairsOptions, random: RandomNumberGenerator): LearnExercise | null {
    const items = o.items;
    if (items.length !== ExerciseBuilder.pairCount) return null;
    const fronts = new Set(items.map((i) => folded(i.front)));
    const backs = new Set(items.map((i) => folded(i.back)));
    if (fronts.size !== items.length || backs.size !== items.length || fronts.has('') || backs.has('')) return null;
    const pairs = shuffled(
      items.map((i) => ({ key: i.key, front: i.front, back: i.back })),
      random,
    );
    return learnExercise({
      id: o.id,
      kind: 'matchPairs',
      cardKeys: pairs.map((p) => p.key),
      prompt: o.prompt ?? ExerciseBuilder.pairsPrompt,
      correctAnswers: pairs.map((p) => p.back),
      options: shuffled(
        pairs.map((p) => p.back),
        random,
      ),
      pairs,
      solution: pairs.map((p) => `${p.front} – ${p.back}`).join('\n'),
    });
  },

  /** A chess move to find. `accepted` are all the moves that solve it, in coordinate notation like "e2e4". */
  move(o: MoveOptions): LearnExercise | null {
    if (o.accepted.length === 0) return null;
    return learnExercise({
      id: o.id,
      kind: 'chessMove',
      cardKeys: keysOf(o.key),
      prompt: o.prompt,
      correctAnswers: o.accepted,
      options: [],
      pairs: [],
      solution: o.solution,
      media: { type: 'board', board: o.board },
      explanation: o.explanation ?? '',
    });
  },

  /** A key to tap on the piano; `midi` are all the keys that are right (every octave of a note name, say). */
  key(o: KeyOptions): LearnExercise | null {
    if (o.midi.length === 0) return null;
    return learnExercise({
      id: o.id,
      kind: 'pianoKey',
      cardKeys: keysOf(o.key),
      prompt: o.prompt,
      correctAnswers: o.midi.map(String),
      options: [],
      pairs: [],
      solution: o.solution,
      media: o.media ?? null,
      explanation: o.explanation ?? '',
    });
  },

  // Lessons

  /** A seed for one run of one node: the same node and seed always give the same value, other nodes differ. */
  seed(node: Pick<CourseNode, 'id'>, base: bigint): bigint {
    let hash = (base ^ 0x9e3779b97f4a7c15n) & MASK64;
    for (const byte of new TextEncoder().encode(node.id)) {
      hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & MASK64;
    }
    return hash;
  },

  /** At most `limit` exercises with distinct ids, easy kinds first; exercises of the same kind keep their order. */
  arrange(exercises: readonly (LearnExercise | null | undefined)[], limit: number = ExerciseBuilder.maxExercises): LearnExercise[] {
    const seen = new Set<string>();
    const unique: LearnExercise[] = [];
    for (const exercise of exercises) {
      if (!exercise || seen.has(exercise.id)) continue;
      seen.add(exercise.id);
      unique.push(exercise);
    }
    const ordered = unique
      .map((element, offset) => ({ element, offset }))
      .sort((a, b) => {
        const da = difficulty(a.element.kind);
        const db = difficulty(b.element.kind);
        return da !== db ? da - db : a.offset - b.offset;
      })
      .map((e) => e.element);
    return ordered.slice(0, Math.max(0, limit));
  },

  /** Words of a sentence as tiles: split at spaces, with the sentence's closing punctuation left on the last tile
   * ("Ich heiße Ana." gives "Ich", "heiße", "Ana."). */
  tiles(sentence: string): string[] {
    return sentence.split(/\s+/).filter((w) => w !== '');
  },
};
