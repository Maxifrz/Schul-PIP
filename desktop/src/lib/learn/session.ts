// A lesson in progress: answer, see the verdict, go on. Every exercise answered wrong comes back once at the end; the
// first attempt of each exercise is what counts for the cards and the skills.
// A port of Lernwerk/Services/Learn/LessonSession.swift.

import type { Grade } from './sm2Bridge';
import { type LearnAnswer, type LearnExercise, type LearnVerdict, missedKeys } from './exercise';
import type { ExerciseOutcome } from './skills/assessor';

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
  /** The first attempt of every exercise that shows evidence of a skill (see `LearnExercise.skill`). */
  outcomes: ExerciseOutcome[];
  /** rightFirstTry / exerciseCount, 0 for an empty lesson. */
  accuracy: number;
}

export function lessonResult(
  fields: Pick<LessonResult, 'lessonID' | 'sessionID' | 'exerciseCount' | 'rightFirstTry' | 'rightOnRetry'> &
    Partial<Pick<LessonResult, 'cardKeys' | 'cardsRightFirstTry' | 'outcomes'>>,
): LessonResult {
  return {
    lessonID: fields.lessonID,
    sessionID: fields.sessionID,
    exerciseCount: fields.exerciseCount,
    rightFirstTry: fields.rightFirstTry,
    rightOnRetry: fields.rightOnRetry,
    cardKeys: fields.cardKeys ?? [],
    cardsRightFirstTry: fields.cardsRightFirstTry ?? new Set(),
    outcomes: fields.outcomes ?? [],
    accuracy: fields.exerciseCount === 0 ? 0 : fields.rightFirstTry / fields.exerciseCount,
  };
}

export type LessonPhase = { type: 'answering' } | { type: 'feedback'; verdict: LearnVerdict } | { type: 'finished' };

export class LessonSession {
  readonly lessonID: string;
  readonly sessionID: string;
  readonly cardKeys: string[];
  /** The exercises as built, without the ones that come back. */
  readonly exerciseCount: number;
  queue: LearnExercise[];
  position = 0;
  phase: LessonPhase;

  private attempted = new Set<string>();
  /** The cards each exercise got wrong on its first attempt, by exercise id. */
  private firstMissed = new Map<string, Set<string>>();
  /** Whether the second attempt was right, by exercise id. */
  private retryRight = new Map<string, boolean>();
  private requeued = new Set<string>();
  /** Whether a hint was shown before the first attempt, by exercise id. */
  private firstHelped = new Map<string, boolean>();
  /** How many hints were shown for each exercise, by exercise id. */
  private hintsShown = new Map<string, number>();

  constructor(lessonID: string, cardKeys: readonly string[], exercises: readonly LearnExercise[], sessionID: string) {
    this.lessonID = lessonID;
    this.sessionID = sessionID;
    this.cardKeys = Array.from(new Set(cardKeys));
    this.queue = exercises.slice();
    this.exerciseCount = exercises.length;
    this.phase = exercises.length === 0 ? { type: 'finished' } : { type: 'answering' };
  }

  get current(): LearnExercise | null {
    return this.phase.type === 'finished' || this.position >= this.queue.length ? null : this.queue[this.position];
  }

  /** The current exercise came back after a wrong answer. */
  get isRetry(): boolean {
    return this.current !== null && this.position >= this.exerciseCount;
  }

  /** Exercises answered right, or answered wrong a second time, of all; it never goes back. */
  get progress(): number {
    if (!(this.exerciseCount > 0)) return 1;
    let settled = this.retryRight.size;
    for (const missed of this.firstMissed.values()) if (missed.size === 0) settled += 1;
    return Math.min(1, settled / this.exerciseCount);
  }

  /** Hints shown so far for the current exercise. */
  get hintCount(): number {
    const exercise = this.current;
    return exercise ? this.hintsShown.get(exercise.id) ?? 0 : 0;
  }

  /** The hints of the current exercise shown so far, in order. */
  get shownHints(): string[] {
    const exercise = this.current;
    return exercise ? exercise.hints.slice(0, this.hintCount) : [];
  }

  /** Whether the current exercise has a hint left to show. */
  get hasMoreHints(): boolean {
    const exercise = this.current;
    if (this.phase.type !== 'answering' || !exercise) return false;
    return this.hintCount < exercise.hints.length;
  }

  /** Shows the next hint of the current exercise and returns all that are shown, in order. A hint on a retry shows
   * the same hints again and changes nothing about the first attempt. */
  showHint(): string[] {
    const exercise = this.current;
    if (this.phase.type !== 'answering' || !exercise) return [];
    const count = Math.min(exercise.hints.length, this.hintCount + 1);
    this.hintsShown.set(exercise.id, count);
    return exercise.hints.slice(0, count);
  }

  /** Checks the answer and shows the verdict; null when no exercise waits for an answer (a second tap on "Prüfen"). */
  submit(answer: LearnAnswer): LearnVerdict | null {
    const exercise = this.current;
    if (this.phase.type !== 'answering' || !exercise) return null;
    const missed = missedKeys(exercise, answer);
    const verdict: LearnVerdict = missed.size === 0 ? 'right' : 'wrong';
    if (!this.attempted.has(exercise.id)) {
      this.attempted.add(exercise.id);
      this.firstMissed.set(exercise.id, missed);
      this.firstHelped.set(exercise.id, this.hintCount > 0);
    } else {
      this.retryRight.set(exercise.id, verdict === 'right');
    }
    this.phase = { type: 'feedback', verdict };
    return verdict;
  }

  /** "War doch richtig": a typed answer the check did not accept counts as right. */
  overrule(): void {
    const exercise = this.current;
    if (this.phase.type !== 'feedback' || this.phase.verdict !== 'wrong' || !exercise || exercise.kind !== 'typeAnswer') return;
    if (this.retryRight.has(exercise.id)) this.retryRight.set(exercise.id, true);
    else this.firstMissed.set(exercise.id, new Set());
    this.phase = { type: 'feedback', verdict: 'right' };
  }

  /** "Weiter": a first wrong answer puts the exercise at the end of the queue, once. */
  advance(): void {
    const exercise = this.current;
    if (this.phase.type !== 'feedback' || !exercise) return;
    if (this.phase.verdict === 'wrong' && !this.retryRight.has(exercise.id) && !this.requeued.has(exercise.id)) {
      this.requeued.add(exercise.id);
      this.queue.push(exercise);
    }
    this.position += 1;
    this.phase = this.position < this.queue.length ? { type: 'answering' } : { type: 'finished' };
  }

  /** Only once the lesson is finished. */
  get result(): LessonResult | null {
    if (this.phase.type !== 'finished') return null;
    const exercised = new Set(this.queue.flatMap((e) => e.cardKeys));
    const wrongCards = new Set<string>();
    for (const missed of this.firstMissed.values()) for (const key of missed) wrongCards.add(key);
    let rightFirstTry = 0;
    for (const missed of this.firstMissed.values()) if (missed.size === 0) rightFirstTry += 1;
    let rightOnRetry = 0;
    for (const right of this.retryRight.values()) if (right) rightOnRetry += 1;
    const cardsRightFirstTry = new Set<string>();
    for (const key of this.cardKeys) if (exercised.has(key) && !wrongCards.has(key)) cardsRightFirstTry.add(key);
    return lessonResult({
      lessonID: this.lessonID,
      sessionID: this.sessionID,
      exerciseCount: this.exerciseCount,
      rightFirstTry,
      rightOnRetry,
      cardKeys: this.cardKeys.slice(),
      cardsRightFirstTry,
      outcomes: this.outcomes(),
    });
  }

  /** What the first attempts showed, in the order of the exercises, for the exercises that belong to a skill. */
  outcomes(): ExerciseOutcome[] {
    const seen = new Set<string>();
    const list: ExerciseOutcome[] = [];
    for (const exercise of this.queue) {
      if (seen.has(exercise.id)) continue;
      seen.add(exercise.id);
      const missed = this.firstMissed.get(exercise.id);
      if (exercise.skill === '' || !exercise.level || !missed) continue;
      list.push({
        exerciseID: exercise.id,
        skill: exercise.skill,
        level: exercise.level,
        right: missed.size === 0,
        helped: this.firstHelped.get(exercise.id) ?? false,
      });
    }
    return list;
  }
}

export const LessonGrading = {
  /** Only the cards that were due when the lesson started get a grade: right on every first try is "good",
   * anything else "again". Practising cards that are not due leaves their SM-2 intervals alone.
   * Each card at most once, even if a result lists it twice. */
  gradesToApply(result: LessonResult, dueKeys: ReadonlySet<string>): { key: string; grade: Grade }[] {
    const seen = new Set<string>();
    const out: { key: string; grade: Grade }[] = [];
    for (const key of result.cardKeys) {
      if (!dueKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, grade: result.cardsRightFirstTry.has(key) ? 'good' : 'again' });
    }
    return out;
  },
};
