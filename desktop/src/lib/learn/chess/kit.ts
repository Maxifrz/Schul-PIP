import type { LearnExercise } from '../exercise';
import { exerciseKinds } from '../exercise';
import { pairCount } from '../builder';
import { bank, choice as makeChoice, move as makeMove, pairs as makePairs, typed } from '../exercises';
import { ExerciseMedia, BoardSpec } from '../media';
import { LearnRandom } from '../random';
import { ChessGoal, ChessGoals } from './goals';
import { ChessNotation } from './notation';
import { ChessPosition } from './position';
import { ChessCoach } from './coach';
import { ChessMove, ChessCase, PieceKind, Sq, Square, kindArticle, kindName, kindNoun, isFeminine } from './types';
import type { ChessSample } from './samples';

void exerciseKinds;

/** Makes one exercise from the state of the node being built. A maker returns null when the material cannot make a sound exercise; the builder then tries the next entry of the plan. */
export type ChessMaker = (draw: ChessDraw) => LearnExercise | null;

/** The random numbers of one node and what it has used so far, so a lesson never shows the same position twice for the same kind of question. */
export class ChessDraw {
  readonly random: LearnRandom;
  private used = new Set<string>();

  constructor(seed: bigint) {
    this.random = new LearnRandom(seed);
  }

  /** A random element of a list. */
  randomElement<T>(items: readonly T[]): T | null {
    return items.length === 0 ? null : (this.random.pick(items) as T);
  }

  /** A random element that was not drawn before under this key. When every element was drawn, any element: the builder then drops the repeated exercise id and asks the next plan entry. */
  pick<T>(items: readonly T[], key: string, id: (item: T) => string): T | null {
    const fresh = items.filter((item) => !this.used.has(`${key}|${id(item)}`));
    const item = this.randomElement(fresh.length === 0 ? items : fresh);
    if (item === null) return null;
    this.used.add(`${key}|${id(item)}`);
    return item;
  }

  pickSample(pool: readonly ChessSample[], key: string): ChessSample | null {
    return this.pick(pool, key, (s) => s.id);
  }

  pickSquare(key: string): Square | null {
    return this.pick(Sq.all, key, (s) => Sq.name(s));
  }

  coin(): boolean {
    return this.random.bool();
  }

  shuffled<T>(items: readonly T[]): T[] {
    return this.random.shuffled(items);
  }
}

/** A sentence for a word bank: the words in order and plausible wrong tiles. */
export interface ChessSentence {
  key: string;
  words: string[];
  extra: string[];
}

/** A question with a fixed right answer and fixed wrong ones, for rules that no position can show. */
export interface ChessStatement {
  key: string;
  prompt: string;
  correct: string;
  wrong: string[];
  explanation: string;
}

/** Where a piece could go on an empty board; independent of the move generator, so the tests can compare the two. */
export const ChessGeometry = {
  canReach(kind: PieceKind, from: Square, to: Square): boolean {
    if (from === to) return false;
    const files = Math.abs(Sq.file(to) - Sq.file(from));
    const ranks = Math.abs(Sq.rank(to) - Sq.rank(from));
    switch (kind) {
      case 'rook': return files === 0 || ranks === 0;
      case 'bishop': return files === ranks;
      case 'queen': return files === 0 || ranks === 0 || files === ranks;
      case 'king': return Math.max(files, ranks) === 1;
      case 'knight': return (files === 1 && ranks === 2) || (files === 2 && ranks === 1);
      case 'pawn': return false;
    }
  },

  /** The squares a piece reaches from a square on an empty board. */
  reach(kind: PieceKind, from: Square): Square[] {
    return Sq.all.filter((s) => ChessGeometry.canReach(kind, from, s));
  },
};

export const emptyFEN = '8/8/8/8/8/8/8/8 w - - 0 1';

export const ChessKit = {
  emptyFEN,

  // Boards

  board(position: ChessPosition, marked: string[] = []): ExerciseMedia {
    return { kind: 'board', board: ChessKit.boardSpec(position, marked) };
  },

  boardSpec(position: ChessPosition, marked: string[] = []): BoardSpec {
    return { fen: position.fen, flipped: position.sideToMove === 'black', marked };
  },

  emptyBoard(marked: string[] = []): ExerciseMedia {
    return { kind: 'board', board: { fen: emptyFEN, flipped: false, marked } };
  },

  // Words

  /** "den Springer", "die Dame", "den Bauern". */
  accusative: (kind: PieceKind): string => `${kindArticle(kind, 'accusative')} ${kindNoun(kind, 'accusative')}`,
  /** "der Springer", "die Dame". */
  nominative: (kind: PieceKind): string => `${kindArticle(kind, 'nominative')} ${kindNoun(kind, 'nominative')}`,
  /** "dem Springer", "der Dame". */
  dative: (kind: PieceKind): string => `${kindArticle(kind, 'dative')} ${kindNoun(kind, 'dative')}`,
  /** "einen Springer", "eine Dame", "einen Bauern". */
  indefiniteAccusative: (kind: PieceKind): string => (isFeminine(kind) ? `eine ${kindName(kind)}` : `einen ${kindNoun(kind, 'accusative')}`),
  /** "ein Springer", "eine Dame". */
  indefinite: (kind: PieceKind): string => `${isFeminine(kind) ? 'eine' : 'ein'} ${kindName(kind)}`,

  /** A list in German: "a4", "a4 und g4", "a4, b5 und g4". */
  list(items: string[]): string {
    switch (items.length) {
      case 0: return '';
      case 1: return items[0];
      default: return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
    }
  },

  /** The rule sentence of a piece, for the feedback. */
  rule(kind: PieceKind): string {
    switch (kind) {
      case 'rook': return 'Der Turm zieht gerade, so weit er will.';
      case 'bishop': return 'Der Läufer zieht schräg, so weit er will.';
      case 'queen': return 'Die Dame zieht wie Turm und Läufer zusammen.';
      case 'king': return 'Der König zieht ein Feld in jede Richtung.';
      case 'knight': return 'Der Springer springt zwei Felder in eine Richtung und eins quer dazu.';
      case 'pawn': return 'Der Bauer zieht ein Feld vorwärts und schlägt schräg vorwärts.';
    }
  },

  // Squares

  /** Whether more pieces than the direct attackers aim at a square, hidden behind them on the same line. */
  hasHiddenAttackers(square: Square, position: ChessPosition): boolean {
    let cleared = position;
    for (const color of ['white', 'black'] as const) for (const attacker of position.attackers(square, color)) cleared = cleared.setting(null, attacker);
    return (['white', 'black'] as const).some((color) => cleared.attackers(square, color).length > 0);
  },

  /** Wrong square names a student could pick by mixing up the direction of counting, most likely mistakes first. */
  squareDistractors(square: Square, random: LearnRandom): string[] {
    const file = Sq.file(square);
    const rank = Sq.rank(square);
    const ordered: Array<Square | null> = [Sq.at(7 - file, rank), Sq.at(file, 7 - rank), Sq.at(rank, file), Sq.at(7 - file, 7 - rank)];
    const near: Array<Square | null> = [Sq.offset(square, 1, 0), Sq.offset(square, -1, 0), Sq.offset(square, 0, 1), Sq.offset(square, 0, -1)];
    ordered.push(...random.shuffled(near));
    const seen = new Set<Square>([square]);
    const result: string[] = [];
    for (const candidate of ordered) {
      if (candidate !== null && !seen.has(candidate)) {
        seen.add(candidate);
        result.push(Sq.name(candidate));
      }
    }
    return result;
  },

  /** Wrong whole numbers around the right one: the likely mistakes first, then neighbours. */
  numberWrongs(p: { correct: number; likely?: number[]; random: LearnRandom; minimum?: number }): string[] {
    const minimum = p.minimum ?? 0;
    const seen = new Set<number>([p.correct]);
    const result: number[] = [];
    const add = (n: number) => {
      if (n >= minimum && !seen.has(n)) {
        seen.add(n);
        result.push(n);
      }
    };
    (p.likely ?? []).forEach(add);
    const c = p.correct;
    p.random.shuffled([c + 1, c - 1, c + 2, c - 2, c + 3, c - 3, c + 4]).forEach(add);
    return result.map(String);
  },

  /** The squares a piece can move to from a square (a pawn that promotes counts its square once). */
  destinations(square: Square, position: ChessPosition): Square[] {
    const seen = new Set<Square>();
    return position.legalMoves().filter((m) => m.from === square).map((m) => m.to).filter((s) => {
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  },

  // Exercises

  /** The solution as the feedback shows it: "Sf3 (g1–f3)", up to three accepted moves joined with "oder". */
  solution(list: ChessMove[], position: ChessPosition, withSquares: boolean, limit = 3): string {
    const texts: string[] = [];
    for (const m of list) {
      const san = ChessNotation.san(m, position);
      if (san === null) continue;
      texts.push(withSquares ? `${san} (${Sq.name(m.from)}–${Sq.name(m.to)})` : san);
    }
    const shown = texts.slice(0, limit);
    if (texts.length > limit) shown.push('…');
    return shown.join(' oder ');
  },

  /** A "find the move" exercise whose accepted moves the engine computes from the goal. */
  moveExercise(p: { id: string; prompt: string; position: ChessPosition; goal: ChessGoal; marked?: string[]; explanation: string; withSquares?: boolean }): LearnExercise | null {
    const accepted = ChessGoals.accepted(p.goal, p.position);
    const answers = accepted.length === 0 ? null : ChessGoals.answers(accepted);
    if (accepted.length === 0 || !answers) return null;
    const exercise = makeMove({
      id: p.id, prompt: p.prompt, board: ChessKit.boardSpec(p.position, p.marked ?? []), accepted: answers,
      solution: ChessKit.solution(accepted, p.position, p.withSquares ?? true), explanation: p.explanation,
    });
    if (!exercise) return null;
    exercise.hints = ChessCoach.hints(p.goal, accepted, p.position);
    exercise.coach = ChessCoach.prefix + ChessCoach.coachCode(p.goal);
    return exercise;
  },

  choice(p: { id: string; prompt: string; correct: string; wrong: string[]; explanation?: string; media?: ExerciseMedia; solution?: string; draw: ChessDraw }): LearnExercise | null {
    return makeChoice(p.draw.random, { id: p.id, prompt: p.prompt, correct: p.correct, wrong: p.wrong, solution: p.solution, explanation: p.explanation ?? '', media: p.media });
  },

  /** Ja or Nein. */
  yesNo(p: { id: string; prompt: string; answer: boolean; explanation: string; media?: ExerciseMedia; draw: ChessDraw }): LearnExercise | null {
    return ChessKit.choice({ id: p.id, prompt: p.prompt, correct: p.answer ? 'Ja' : 'Nein', wrong: [p.answer ? 'Nein' : 'Ja'], explanation: p.explanation, media: p.media, draw: p.draw });
  },

  /** A whole number to type. */
  number(p: { id: string; prompt: string; answer: number; explanation: string; media?: ExerciseMedia }): LearnExercise | null {
    return typed({ id: p.id, prompt: p.prompt, answer: String(p.answer), mode: 'number', explanation: p.explanation, media: p.media });
  },

  /** A square name to type; capitals and spaces do not matter, a different square does. */
  typedSquare(p: { id: string; prompt: string; answer: string; explanation: string; media?: ExerciseMedia }): LearnExercise | null {
    return typed({ id: p.id, prompt: p.prompt, answer: p.answer, mode: 'exact', explanation: p.explanation, media: p.media });
  },

  bank(p: { id: string; sentence: ChessSentence; prompt?: string; draw: ChessDraw }): LearnExercise | null {
    return bank(p.draw.random, { id: p.id, prompt: p.prompt ?? 'Setze den Satz zusammen.', words: p.sentence.words, extra: p.sentence.extra });
  },

  /** A word bank from a pool of sentences. */
  sentenceMaker(topic: string, sentences: ChessSentence[]): ChessMaker {
    return (draw) => {
      const sentence = draw.pick(sentences, topic, (s) => s.key);
      return sentence ? ChessKit.bank({ id: `${topic}.${sentence.key}`, sentence, draw }) : null;
    };
  },

  /** A choice from a pool of fixed statements. */
  statementMaker(topic: string, statements: ChessStatement[]): ChessMaker {
    return (draw) => {
      const statement = draw.pick(statements, topic, (s) => s.key);
      return statement ? ChessKit.choice({ id: `${topic}.${statement.key}`, prompt: statement.prompt, correct: statement.correct, wrong: statement.wrong, explanation: statement.explanation, draw }) : null;
    };
  },

  /** Four pairs out of the candidates, which are (key, front, back) and may be more than four. */
  pairs(p: { id: string; prompt: string; from: Array<{ key: string; front: string; back: string }>; draw: ChessDraw }): LearnExercise | null {
    const items = p.draw.random.shuffled(p.from).slice(0, pairCount);
    return makePairs(p.draw.random, { id: p.id, prompt: p.prompt, items });
  },

  /** The answer forms of a typed move in notation: with and without the sign and the capture mark, so "Dxf7#", "Dxf7" and "Dxf7+" all count. Capitals do not matter to the checker. */
  typedVariants(san: string): string[] {
    const bare = [...san].filter((c) => c !== '+' && c !== '#').join('');
    const forms = [san, bare, `${bare}+`, `${bare}#`];
    if (bare.includes('x')) forms.push(bare.split('x').join(''));
    return [...new Set(forms)];
  },

  /** The notation without the check sign, so a prompt can name a move without giving away that it mates. */
  sanWithoutSign(san: string): string {
    return [...san].filter((c) => c !== '+' && c !== '#').join('');
  },
};

export type { ChessCase };
