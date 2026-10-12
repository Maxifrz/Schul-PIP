// The controller logic of the lesson screen that is not drawing: what the student has picked or typed for the current
// exercise (`LessonModel`), and what happens around a lesson (`LearnController`): starting a step, a practice round or a
// unit test, opening a chest, and recording a finished round into progress, skills and quests.
// A port of Lernwerk/Views/Review/Learn/LessonModel.swift and of the logic in LearnHomeView.swift (start, openChest,
// startPractice, testOut, finish, skillRows). The clock, the calendar and the random seeds are injected.
//
// Not ported: lessons made from flashcards (the card-based LessonModel init, `LearnPath.lessonID`, the grading of due
// cards when such a lesson ends); `LessonGrading.gradesToApply` is in session.ts for when cards come to the desktop.

import { provider as registeredProvider } from './catalog';
import { CoursePath, type PathStep } from './coursePath';
import type { CourseNode, CourseProvider, CourseUnit, NodeKind } from './course';
import type { LearnCalendar } from './day';
import { type LearnAnswer, type LearnExercise, type LearnVerdict, isMatch } from './exercise';
import { type LearnProgressStore, type QuestStore, SkillMaps, type SkillStore } from './store';
import { questTitle } from './quests';
import { type LessonResult, LessonSession } from './session';
import { SkillAssessor, SkillRecord, type SkillStatus, skillStatusIsReached } from './skills/assessor';
import { SkillPractice, TestOut } from './skills/advisor';
import { lessonExercises, feedback, type Skill } from './skills/skill';

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

export function lessonRewards(fields: Partial<LessonRewards> = {}): LessonRewards {
  return { gems: 0, quests: [], freezesUsed: 0, streakExtended: false, notes: [], ...fields };
}

export type PairOutcome = { type: 'match' } | { type: 'miss' } | { type: 'finished'; verdict: LearnVerdict };

/** A front and a back that were paired wrongly, shown red until the next tap. */
export interface PairMiss {
  key: string;
  back: number;
}

export type CoachFunction = (exercise: LearnExercise, answer: LearnAnswer) => string | null;

export interface LessonModelInit {
  lessonID: string;
  exercises: readonly LearnExercise[];
  sessionID: string;
  /** Asked for a wrong answer; set by whoever opened a lesson of a course. */
  coach?: CoachFunction | null;
  /** The lesson's cards, for rounds made of flashcards; courses have none. */
  cardKeys?: readonly string[];
}

/** The lesson on screen: the session plus what the student has picked, put together or typed for the current
 * exercise. All of it lives in this one object, so turning the device or showing the keyboard keeps every choice. */
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
  lastMiss: PairMiss | null = null;
  /** Why the last wrong answer was wrong, when the course can tell; empty otherwise. */
  coachNote = '';

  private readonly coach: CoachFunction | null;
  /** Pairs: the cards whose front was paired with a wrong back. */
  private missed = new Set<string>();
  private reported = false;

  constructor(init: LessonModelInit) {
    this.coach = init.coach ?? null;
    this.session = new LessonSession(init.lessonID, init.cardKeys ?? [], init.exercises, init.sessionID);
  }

  get current(): LearnExercise | null {
    return this.session.current;
  }

  get isAnswering(): boolean {
    return this.session.phase.type === 'answering';
  }

  get verdict(): LearnVerdict | null {
    return this.session.phase.type === 'feedback' ? this.session.phase.verdict : null;
  }

  get canCheck(): boolean {
    const exercise = this.current;
    if (!this.isAnswering || !exercise) return false;
    switch (exercise.kind) {
      case 'multipleChoice':
      case 'pianoKey':
        return this.choice !== null;
      case 'chessMove':
        return this.moveFrom !== null && this.moveTo !== null;
      case 'typeAnswer':
        return this.typed.trim() !== '';
      case 'wordBank':
        return this.tiles.length > 0;
      case 'matchPairs':
        return false;
    }
  }

  check(): LearnVerdict | null {
    const exercise = this.current;
    if (!this.canCheck || !exercise) return null;
    let answer: LearnAnswer;
    switch (exercise.kind) {
      case 'multipleChoice':
      case 'pianoKey':
        answer = { type: 'option', value: this.choice ?? '' };
        break;
      case 'chessMove':
        answer = { type: 'move', value: (this.moveFrom ?? '') + (this.moveTo ?? '') };
        break;
      case 'typeAnswer':
        answer = { type: 'typed', value: this.typed };
        break;
      case 'wordBank':
        answer = {
          type: 'words',
          value: this.tiles.filter((i) => i >= 0 && i < exercise.options.length).map((i) => exercise.options[i]),
        };
        break;
      case 'matchPairs':
        answer = { type: 'pairs', missed: new Set(this.missed) };
        break;
    }
    const verdict = this.session.submit(answer);
    this.coachNote = verdict === 'wrong' ? this.coach?.(exercise, answer) ?? '' : '';
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
  }

  overrule(): void {
    this.session.overrule();
  }

  advance(): void {
    if (this.verdict === null) return;
    this.session.advance();
    this.resetDrafts();
    this.coachNote = '';
  }

  /** The result, handed out once: the first time it is asked for after the lesson finished. */
  takeResult(): LessonResult | null {
    const result = this.session.result;
    if (this.reported || !result) return null;
    this.reported = true;
    return result;
  }

  // Chess

  /** A tap on a square: the first picks the piece to move (a tap on it again puts it down), the next the square to
   * move it to; a third starts over from that square. */
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
  }

  // Word bank

  addTile(index: number): void {
    if (!this.isAnswering || this.tiles.includes(index)) return;
    this.tiles.push(index);
  }

  removeTile(index: number): void {
    if (!this.isAnswering) return;
    this.tiles = this.tiles.filter((t) => t !== index);
  }

  // Pairs

  pickFront(key: string): PairOutcome | null {
    if (!this.canPair || this.matched.has(key)) return null;
    this.lastMiss = null;
    this.pickedFront = this.pickedFront === key ? null : key;
    return this.pairIfReady();
  }

  pickBack(index: number): PairOutcome | null {
    if (!this.canPair || this.matchedBacks.has(index)) return null;
    this.lastMiss = null;
    this.pickedBack = this.pickedBack === index ? null : index;
    return this.pairIfReady();
  }

  private get canPair(): boolean {
    return this.isAnswering && this.current?.kind === 'matchPairs';
  }

  private pairIfReady(): PairOutcome | null {
    const exercise = this.current;
    const key = this.pickedFront;
    const index = this.pickedBack;
    if (!exercise || key === null || index === null) return null;
    this.pickedFront = null;
    this.pickedBack = null;
    if (!(index >= 0 && index < exercise.options.length)) return null;
    if (!isMatch(exercise, key, exercise.options[index])) {
      this.missed.add(key);
      this.lastMiss = { key, back: index };
      return { type: 'miss' };
    }
    this.matched.add(key);
    this.matchedBacks.add(index);
    if (this.matched.size !== exercise.pairs.length) return { type: 'match' };
    const verdict = this.session.submit({ type: 'pairs', missed: new Set(this.missed) });
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

// What the home screen does around a lesson.

/** One round on screen: a step of a course, or a round on chosen goals. */
export interface LessonRun {
  courseID: string;
  kind: NodeKind;
  lessonID: string;
  exercises: LearnExercise[];
  /** The step the round belongs to; null for a round on chosen goals. */
  node: CourseNode | null;
  /** Whether finishing it marks the step as done. */
  completes: boolean;
  /** The unit whose test this is, for skipping it. */
  testOut: CourseUnit | null;
  coach: CoachFunction | null;
}

export type StartResult =
  | { type: 'run'; run: LessonRun }
  | { type: 'chest'; gems: number; notice: string }
  | { type: 'none'; notice: string | null };

export interface LearnControllerDeps {
  progress: LearnProgressStore;
  quests: QuestStore;
  skills: SkillStore;
  /** Epoch milliseconds. */
  clock: () => number;
  calendar: () => LearnCalendar;
  /** A fresh seed per round (Swift: `UInt64.random(in: 1...UInt64.max)`). */
  newSeed: () => bigint;
  /** The provider of a course; defaults to the registry. */
  provider?: (courseID: string) => CourseProvider | undefined;
}

export interface SkillRow {
  skill: Skill;
  status: SkillStatus;
  reasons: string[];
  /** The prerequisites that are not reached yet, like "Wortschatz (Einheit 1)". */
  waitingFor: string[];
}

export class LearnController {
  constructor(private readonly deps: LearnControllerDeps) {}

  private provider(courseID: string): CourseProvider | undefined {
    return (this.deps.provider ?? registeredProvider)(courseID);
  }

  /** Tapping a step: a chest opens, anything else becomes a round. Locked steps do nothing. */
  startStep(step: PathStep, courseID: string): StartResult {
    const node = step.node;
    if (step.state === 'locked') return { type: 'none', notice: null };
    if (node.kind === 'chest') {
      if (this.deps.progress.progress.isCompleted(node.id)) return { type: 'none', notice: null };
      const gems = CoursePath.chestGems(node);
      if (this.deps.progress.openChest(node.id, gems)) return { type: 'chest', gems, notice: `Du hast ${gems} Gems gefunden.` };
      return { type: 'none', notice: null };
    }
    const provider = this.provider(courseID);
    if (!provider) return { type: 'none', notice: null };
    const exercises = lessonExercises(provider, node, this.deps.newSeed());
    if (exercises.length === 0) return { type: 'none', notice: null };
    this.deps.skills.begin(node, SkillMaps.map(provider));
    return {
      type: 'run',
      run: {
        courseID,
        kind: node.kind,
        lessonID: node.id,
        exercises,
        node,
        completes: true,
        testOut: null,
        coach: (e, a) => feedback(provider, e, a),
      },
    };
  }

  /** A round of exercises that fit what the chosen goals still need. It earns XP and counts for the quests, and marks
   * no step as done. */
  startPractice(targets: readonly string[], courseID: string): StartResult {
    const provider = this.provider(courseID);
    if (!provider) return { type: 'none', notice: null };
    const exercises = SkillPractice.exercises(
      provider,
      SkillMaps.map(provider),
      targets,
      this.deps.skills.records,
      this.deps.newSeed(),
    );
    if (exercises.length === 0) return { type: 'none', notice: 'Dazu gibt es gerade nichts zu üben.' };
    return {
      type: 'run',
      run: {
        courseID,
        kind: 'practice',
        lessonID: 'practice.' + courseID,
        exercises,
        node: null,
        completes: false,
        testOut: null,
        coach: (e, a) => feedback(provider, e, a),
      },
    };
  }

  /** Whether the unit may be skipped by its test: only the first, untouched unit that is not done. */
  canTestOut(unit: CourseUnit, courseID: string): boolean {
    const provider = this.provider(courseID);
    if (!provider) return false;
    const units = CoursePath.units(provider.course, this.deps.progress.progress.completedLessons);
    return TestOut.candidate(units)?.unit.id === unit.id && unit.nodes.some((n) => n.kind === 'checkpoint');
  }

  /** The test of the first unit, for a student who knows it: null unless this unit may be skipped. */
  startTestOut(unit: CourseUnit, courseID: string): LessonRun | null {
    const provider = this.provider(courseID);
    if (!provider || !this.canTestOut(unit, courseID)) return null;
    const node = unit.nodes.find((n) => n.kind === 'checkpoint');
    if (!node) return null;
    const exercises = lessonExercises(provider, node, this.deps.newSeed());
    if (exercises.length === 0) return null;
    return {
      courseID,
      kind: 'checkpoint',
      lessonID: node.id,
      exercises,
      node,
      completes: false,
      testOut: unit,
      coach: (e, a) => feedback(provider, e, a),
    };
  }

  newModel(run: LessonRun, sessionID: string): LessonModel {
    return new LessonModel({ lessonID: run.lessonID, exercises: run.exercises, sessionID, coach: run.coach });
  }

  /** Records the round once (a run the store has seen before counts for nothing): XP and streak, the evidence for the
   * skills, the quests, and, for a unit test, whether the unit is skipped. What it brought goes to the end screen. */
  finish(result: LessonResult, run: LessonRun): LessonRewards {
    const now = this.deps.clock();
    const calendar = this.deps.calendar();
    const reward = this.deps.progress.record(result, { courseID: run.courseID, completes: run.completes, now, calendar });
    if (!reward) return lessonRewards();
    const provider = this.provider(run.courseID);
    if (provider) this.deps.skills.record(result.outcomes, run.node, SkillMaps.map(provider), now, calendar);
    const notes: string[] = [];
    if (run.testOut) {
      if (TestOut.passed(result)) {
        this.deps.progress.complete(TestOut.nodesToComplete(run.testOut));
        notes.push(`Einheit übersprungen: ${run.testOut.title}. Als Fähigkeit zählt nur, was der Test gezeigt hat.`);
      } else {
        notes.push('Für das Überspringen brauchst du 85 % richtig, ohne Hilfe. Lern die Einheit jetzt Schritt für Schritt.');
      }
    }
    const finished = this.deps.quests.record(
      { xp: reward.xp, courseID: run.courseID, nodeKind: run.kind, rightFirstTry: result.rightFirstTry, exerciseCount: result.exerciseCount },
      now,
      calendar,
    );
    return lessonRewards({
      gems: reward.gems,
      quests: finished.map(questTitle),
      freezesUsed: reward.freezesUsed,
      streakExtended: reward.streakExtended,
      notes,
    });
  }

  /** The rows of the skills screen: status, what is missing and what the goal waits for. */
  skillRows(provider: CourseProvider): SkillRow[] {
    const map = SkillMaps.map(provider);
    const now = this.deps.clock();
    const calendar = this.deps.calendar();
    const completed = this.deps.progress.progress.completedLessons;
    const records = this.deps.skills.records;
    const status = (skill: Skill): SkillStatus => SkillAssessor.status(records[skill.id], skill, completed, now, calendar);
    return map.skills.map((skill) => {
      const state = status(skill);
      const waitingFor = skill.prerequisites
        .map((p) => map.skill(p))
        .filter((p): p is Skill => p !== undefined)
        .filter((p) => !skillStatusIsReached(status(p)))
        .map((p) => `${p.title} (Einheit ${p.unitNumber})`);
      let reasons: string[];
      switch (state) {
        case 'mastered':
          reasons = [];
          break;
        case 'due':
          reasons = ['Die Wiederholung ist fällig, damit du es nicht vergisst.'];
          break;
        default:
          reasons = SkillAssessor.missing(records[skill.id] ?? new SkillRecord(), skill);
      }
      return { skill, status: state, reasons, waitingFor };
    });
  }
}
