import { CardSnapshot, LearnPath } from './cards';
import { ExerciseBuilder } from './builder';
import { LearnAnswer, LearnExercise, LearnVerdict, isMatch } from './exercise';
import { LessonResult, LessonSession } from './session';

/** What a finished lesson brought besides XP, for the end screen. The one who records the lesson fills it in. */
export interface LessonRewards {
  gems: number;
  /** The titles of the quests this lesson completed. */
  quests: string[];
  /** Streak freezes that covered skipped days with this lesson. */
  freezesUsed: number;
  streakExtended: boolean;
  /** Things worth saying in a sentence: a unit skipped, a test not passed. */
  notes: string[];
}

export const noRewards = (): LessonRewards => ({ gems: 0, quests: [], freezesUsed: 0, streakExtended: false, notes: [] });

export type PairOutcome = { type: 'match' } | { type: 'miss' } | { type: 'finished'; verdict: LearnVerdict };

export type Coach = (item: LearnExercise, answer: LearnAnswer) => string | null;

/** The lesson on screen: the session plus what the student has picked, put together or typed for the current exercise. All of it lives in this one object, so a redraw keeps every choice. */
export class LessonModel {
  session: LessonSession;
  typed = '';
  choice: string | null = null;
  /** Chess: the square of the piece to move, then the square to move it to. */
  moveFrom: string | null = null;
  moveTo: string | null = null;
  /** Word bank: positions in the options, in the order tapped. */
  tiles: number[] = [];
  matched = new Set<string>();
  matchedBacks = new Set<number>();
  pickedFront: string | null = null;
  pickedBack: number | null = null;
  /** A front and a back that were paired wrongly, shown red until the next tap. */
  lastMiss: { key: string; back: number } | null = null;
  /** Why the last wrong answer was wrong, when the course can tell; empty otherwise. */
  coachNote = '';
  /** The right answer was asked for after a wrong one; until then the verdict hides it. */
  solutionShown = false;

  private missed = new Set<string>();
  private reported = false;
  private version = 0;
  private listeners = new Set<() => void>();

  constructor(lessonID: string, cardKeys: string[], exercises: LearnExercise[], sessionID: string, private readonly coach: Coach | null = null) {
    this.session = new LessonSession(lessonID, cardKeys, exercises, sessionID);
  }

  /** A lesson of the student's own cards. */
  static ofCards(cards: CardSnapshot[], deck: CardSnapshot[], distractors: Record<string, string[]>, seed: bigint, sessionID: string): LessonModel {
    const builder = new ExerciseBuilder(cards, deck.length === 0 ? cards : deck, distractors);
    return new LessonModel(LearnPath.lessonID(cards.map((c) => c.key)), cards.map((c) => c.key), builder.build(seed), sessionID);
  }

  // Observing (for the screen)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = (): number => this.version;

  private changed(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  get current(): LearnExercise | undefined {
    return this.session.current;
  }

  get isAnswering(): boolean {
    return this.session.phase.type === 'answering';
  }

  get verdict(): LearnVerdict | null {
    return this.session.phase.type === 'feedback' ? this.session.phase.verdict : null;
  }

  get canCheck(): boolean {
    const item = this.current;
    if (!this.isAnswering || !item) return false;
    switch (item.kind) {
      case 'multipleChoice':
      case 'pianoKey': return this.choice !== null;
      case 'chessMove': return this.moveFrom !== null && this.moveTo !== null;
      case 'typeAnswer': return this.typed.trim() !== '';
      case 'wordBank': return this.tiles.length > 0;
      case 'matchPairs': return false;
    }
  }

  setTyped(text: string): void {
    this.typed = text;
    this.changed();
  }

  pick(option: string): void {
    if (!this.isAnswering) return;
    this.choice = option;
    this.changed();
  }

  check(): LearnVerdict | undefined {
    const item = this.current;
    if (!this.canCheck || !item) return undefined;
    let answer: LearnAnswer;
    switch (item.kind) {
      case 'multipleChoice':
      case 'pianoKey': answer = { type: 'option', value: this.choice ?? '' }; break;
      case 'chessMove': answer = { type: 'move', value: (this.moveFrom ?? '') + (this.moveTo ?? '') }; break;
      case 'typeAnswer': answer = { type: 'typed', value: this.typed }; break;
      case 'wordBank': answer = { type: 'words', value: this.tiles.filter((i) => i >= 0 && i < item.options.length).map((i) => item.options[i]) }; break;
      case 'matchPairs': answer = { type: 'pairs', missed: new Set(this.missed) }; break;
    }
    const verdict = this.session.submit(answer);
    this.coachNote = verdict === 'wrong' ? (this.coach?.(item, answer) ?? '') : '';
    this.changed();
    return verdict;
  }

  /** The hints of the current exercise shown so far, and whether another is left. */
  get hintsShown(): string[] {
    return this.session.shownHints;
  }
  get hasMoreHints(): boolean {
    return this.session.hasMoreHints;
  }
  get hintTotal(): number {
    return this.current?.hints.length ?? 0;
  }

  showHint(): void {
    this.session.showHint();
    this.changed();
  }

  overrule(): void {
    this.session.overrule();
    this.changed();
  }

  /** What to say after a wrong answer: the course's reason, or a plain nudge when it has none. */
  get retryNote(): string {
    return this.coachNote === '' ? 'Schau noch einmal hin.' : this.coachNote;
  }

  /** "Lösung zeigen" after a wrong answer. */
  showSolution(): void {
    if (this.verdict !== 'wrong') return;
    this.solutionShown = true;
    this.changed();
  }

  /** "Nochmal versuchen": the same exercise again. A typed answer stays to be corrected; in pairs only the wrong ones are taken apart; everything else starts empty. */
  tryAgain(): void {
    if (this.verdict !== 'wrong' || this.solutionShown) return;
    const kept = this.typed;
    const wrongKeys = new Set(this.missed);
    this.session.tryAgain();
    this.resetDrafts();
    this.typed = kept;
    const item = this.current;
    if (item && item.kind === 'matchPairs') {
      // The pairs that went right stay together.
      const right = new Set(item.pairs.map((p) => p.key).filter((k) => !wrongKeys.has(k)));
      this.matched = right;
      this.matchedBacks = new Set(item.options.map((_, i) => i).filter((i) => [...right].some((k) => isMatch(item, k, item.options[i]))));
    }
    this.changed();
  }

  advance(): void {
    if (this.verdict === null) return;
    this.session.advance();
    this.resetDrafts();
    this.coachNote = '';
    this.solutionShown = false;
    this.changed();
  }

  /** The result, handed out once: the first time it is asked for after the lesson finished. */
  takeResult(): LessonResult | undefined {
    const result = this.session.result;
    if (this.reported || !result) return undefined;
    this.reported = true;
    return result;
  }

  // Chess

  /** A tap on a square: the first picks the piece to move (a tap on it again puts it down), the next the square to move it to; a third starts over from that square. */
  tapSquare(square: string): void {
    if (!this.isAnswering || this.current?.kind !== 'chessMove') return;
    if (this.moveFrom === null || this.moveTo !== null) {
      this.moveFrom = square;
      this.moveTo = null;
    } else if (this.moveFrom === square) {
      this.moveFrom = null;
    } else {
      this.moveTo = square;
    }
    this.changed();
  }

  // Word bank

  addTile(index: number): void {
    if (!this.isAnswering || this.tiles.includes(index)) return;
    this.tiles = [...this.tiles, index];
    this.changed();
  }

  removeTile(index: number): void {
    if (!this.isAnswering) return;
    this.tiles = this.tiles.filter((t) => t !== index);
    this.changed();
  }

  // Pairs

  pickFront(key: string): PairOutcome | undefined {
    if (!this.canPair || this.matched.has(key)) return undefined;
    this.lastMiss = null;
    this.pickedFront = this.pickedFront === key ? null : key;
    return this.pairIfReady();
  }

  pickBack(index: number): PairOutcome | undefined {
    if (!this.canPair || this.matchedBacks.has(index)) return undefined;
    this.lastMiss = null;
    this.pickedBack = this.pickedBack === index ? null : index;
    return this.pairIfReady();
  }

  private get canPair(): boolean {
    return this.isAnswering && this.current?.kind === 'matchPairs';
  }

  private pairIfReady(): PairOutcome | undefined {
    const item = this.current;
    const key = this.pickedFront;
    const index = this.pickedBack;
    if (!item || key === null || index === null) {
      this.changed();
      return undefined;
    }
    this.pickedFront = null;
    this.pickedBack = null;
    if (index < 0 || index >= item.options.length) {
      this.changed();
      return undefined;
    }
    if (!isMatch(item, key, item.options[index])) {
      this.missed.add(key);
      this.lastMiss = { key, back: index };
      this.changed();
      return { type: 'miss' };
    }
    this.matched.add(key);
    this.matchedBacks.add(index);
    if (this.matched.size !== item.pairs.length) {
      this.changed();
      return { type: 'match' };
    }
    const verdict = this.session.submit({ type: 'pairs', missed: new Set(this.missed) });
    this.changed();
    return verdict ? { type: 'finished', verdict } : { type: 'match' };
  }

  private resetDrafts(): void {
    this.typed = '';
    this.choice = null;
    this.moveFrom = null;
    this.moveTo = null;
    this.tiles = [];
    this.matched = new Set();
    this.matchedBacks = new Set();
    this.pickedFront = null;
    this.pickedBack = null;
    this.lastMiss = null;
    this.missed = new Set();
  }
}
