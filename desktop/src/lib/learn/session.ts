import type { Grade } from '../sm2';
import { LearnAnswer, LearnExercise, LearnVerdict, CompetenceLevel, missedKeys } from './exercise';

/** One answer of a round as the skills see it: the first attempt of an exercise. */
export interface ExerciseOutcome {
  exerciseID: string;
  skill: string;
  level: CompetenceLevel;
  /** Right on the first attempt. */
  right: boolean;
  /** A hint was shown before the answer. */
  helped: boolean;
}

/** How a lesson went, for the XP, the streak and the cards' schedule. */
export interface LessonResult {
  lessonID: string;
  /** One per run of a lesson, so the same run is never counted twice. */
  sessionID: string;
  exerciseCount: number;
  rightFirstTry: number;
  rightOnRetry: number;
  /** The lesson's cards in order. */
  cardKeys: string[];
  /** The cards answered right on the first try in every exercise they were part of. */
  cardsRightFirstTry: Set<string>;
  /** The first attempt of every exercise that shows evidence of a skill. */
  outcomes: ExerciseOutcome[];
}

export const accuracyOf = (result: LessonResult): number => (result.exerciseCount === 0 ? 0 : result.rightFirstTry / result.exerciseCount);

export type Phase = { type: 'answering' } | { type: 'feedback'; verdict: LearnVerdict } | { type: 'finished' };

/**
 * A lesson in progress: answer, see the verdict, go on. Every exercise answered wrong comes back once at the end; the
 * first attempt of each exercise is what counts for the cards.
 */
export class LessonSession {
  readonly lessonID: string;
  readonly sessionID: string;
  readonly cardKeys: string[];
  /** The exercises as built, without the ones that come back. */
  readonly exerciseCount: number;
  queue: LearnExercise[];
  position = 0;
  phase: Phase;

  private attempted = new Set<string>();
  /** The cards each exercise got wrong on its first attempt, by exercise id. */
  private firstMissed = new Map<string, Set<string>>();
  /** Whether the second attempt was right, by exercise id. */
  private retryRight = new Map<string, boolean>();
  private requeued = new Set<string>();
  /** How many times each exercise was checked, tries on the spot included. */
  private attempts = new Map<string, number>();
  /** Whether a hint was shown before the first attempt, by exercise id. */
  private firstHelped = new Map<string, boolean>();
  private hintsShown = new Map<string, number>();

  constructor(lessonID: string, cardKeys: string[], exercises: LearnExercise[], sessionID: string) {
    this.lessonID = lessonID;
    this.sessionID = sessionID;
    this.cardKeys = [...new Set(cardKeys)];
    this.queue = [...exercises];
    this.exerciseCount = exercises.length;
    this.phase = exercises.length === 0 ? { type: 'finished' } : { type: 'answering' };
  }

  get current(): LearnExercise | undefined {
    return this.phase.type === 'finished' || this.position >= this.queue.length ? undefined : this.queue[this.position];
  }

  /** The current exercise came back after a wrong answer. */
  get isRetry(): boolean {
    return this.current !== undefined && this.position >= this.exerciseCount;
  }

  /** Exercises answered right, or answered wrong a second time, of all; it never goes back. */
  get progress(): number {
    if (this.exerciseCount === 0) return 1;
    const settled = [...this.firstMissed.values()].filter((s) => s.size === 0).length + this.retryRight.size;
    return Math.min(1, settled / this.exerciseCount);
  }

  get hintCount(): number {
    const item = this.current;
    return item ? (this.hintsShown.get(item.id) ?? 0) : 0;
  }

  /** The hints of the current exercise shown so far, in order. */
  get shownHints(): string[] {
    const item = this.current;
    return item ? item.hints.slice(0, this.hintCount) : [];
  }

  get hasMoreHints(): boolean {
    const item = this.current;
    return this.phase.type === 'answering' && !!item && this.hintCount < item.hints.length;
  }

  /** Shows the next hint of the current exercise and returns all that are shown, in order. */
  showHint(): string[] {
    const item = this.current;
    if (this.phase.type !== 'answering' || !item) return [];
    const count = Math.min(item.hints.length, this.hintCount + 1);
    this.hintsShown.set(item.id, count);
    return item.hints.slice(0, count);
  }

  /** Checks the answer and shows the verdict; undefined when no exercise waits for an answer (a second tap on "Prüfen"). */
  submit(answer: LearnAnswer): LearnVerdict | undefined {
    const item = this.current;
    if (this.phase.type !== 'answering' || !item) return undefined;
    const missed = missedKeys(item, answer);
    const verdict: LearnVerdict = missed.size === 0 ? 'right' : 'wrong';
    this.attempts.set(item.id, (this.attempts.get(item.id) ?? 0) + 1);
    if (!this.attempted.has(item.id)) {
      this.attempted.add(item.id);
      this.firstMissed.set(item.id, missed);
      this.firstHelped.set(item.id, this.hintCount > 0);
    } else if (verdict === 'right' || this.isRetry) {
      // A wrong try on the spot in the first round settles nothing: the exercise still comes back at the end.
      this.retryRight.set(item.id, verdict === 'right');
    }
    this.phase = { type: 'feedback', verdict };
    return verdict;
  }

  /** "Nochmal versuchen": the same exercise again right after a wrong answer, as often as the student likes. */
  tryAgain(): void {
    if (this.phase.type === 'feedback' && this.phase.verdict === 'wrong' && this.current) this.phase = { type: 'answering' };
  }

  /** "War doch richtig": a typed answer the check did not accept counts as right. */
  overrule(): void {
    const item = this.current;
    if (!(this.phase.type === 'feedback' && this.phase.verdict === 'wrong') || !item || item.kind !== 'typeAnswer') return;
    if ((this.attempts.get(item.id) ?? 0) > 1) this.retryRight.set(item.id, true);
    else this.firstMissed.set(item.id, new Set());
    this.phase = { type: 'feedback', verdict: 'right' };
  }

  /** "Weiter": an exercise not yet answered right again goes to the end of the queue, once. */
  advance(): void {
    const item = this.current;
    if (this.phase.type !== 'feedback' || !item) return;
    if (this.phase.verdict === 'wrong' && !this.retryRight.has(item.id) && !this.requeued.has(item.id)) {
      this.requeued.add(item.id);
      this.queue.push(item);
    }
    this.position += 1;
    this.phase = this.position < this.queue.length ? { type: 'answering' } : { type: 'finished' };
  }

  /** Only once the lesson is finished. */
  get result(): LessonResult | undefined {
    if (this.phase.type !== 'finished') return undefined;
    const exercised = new Set(this.queue.flatMap((e) => e.cardKeys));
    const wrongCards = new Set<string>();
    for (const set of this.firstMissed.values()) set.forEach((k) => wrongCards.add(k));
    return {
      lessonID: this.lessonID,
      sessionID: this.sessionID,
      exerciseCount: this.exerciseCount,
      rightFirstTry: [...this.firstMissed.values()].filter((s) => s.size === 0).length,
      rightOnRetry: [...this.retryRight.values()].filter(Boolean).length,
      cardKeys: this.cardKeys,
      cardsRightFirstTry: new Set(this.cardKeys.filter((k) => exercised.has(k) && !wrongCards.has(k))),
      outcomes: this.outcomes(),
    };
  }

  /** What the first attempts showed, in the order of the exercises, for the exercises that belong to a skill. */
  outcomes(): ExerciseOutcome[] {
    const seen = new Set<string>();
    const list: ExerciseOutcome[] = [];
    for (const item of this.queue) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const missed = this.firstMissed.get(item.id);
      if (item.skill === '' || !item.level || !missed) continue;
      list.push({ exerciseID: item.id, skill: item.skill, level: item.level, right: missed.size === 0, helped: this.firstHelped.get(item.id) ?? false });
    }
    return list;
  }
}

/**
 * Only the cards that were due when the lesson started get a grade: right on every first try is "good", anything else
 * "again". Practising cards that are not due leaves their SM-2 intervals alone. Each card at most once.
 */
export function gradesToApply(result: LessonResult, dueKeys: Set<string>): Array<{ key: string; grade: Grade }> {
  const seen = new Set<string>();
  return result.cardKeys
    .filter((key) => dueKeys.has(key) && !seen.has(key) && !!seen.add(key))
    .map((key) => ({ key, grade: result.cardsRightFirstTry.has(key) ? ('good' as Grade) : ('again' as Grade) }));
}
