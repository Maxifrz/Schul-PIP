// The state of the Lernen area: the three stores of the logic core (progress, quests, skills) on top of the app's
// own persistence, the controller that starts and records rounds, and what the screen shows (course, view, round).
// Time and the time zone are read here, in the UI layer, and handed to the core.

import { registerCourses } from '../lib/learn/courses';
import {
  type KeyValueStore,
  LearnController,
  LearnProgressStore,
  type LessonModel,
  type LessonRewards,
  type LessonRun,
  type LessonResult,
  QuestStore,
  SkillStore,
  type CourseUnit,
  type PathStep,
  learnCalendar,
  type LearnCalendar,
  providerForCourse,
} from '../lib/learn';
import { storage } from '../lib/platform';
import { createStore, persist } from './createStore';
import { say } from './app';

export type LearnMode = 'path' | 'quests' | 'skills';

/** A round on screen: what was started and what the student has put together so far. */
export interface ActiveRun {
  id: string;
  run: LessonRun;
  model: LessonModel;
}

export const learnUi = createStore({
  ready: false,
  /** Bumped whenever a store of the core changes or a minute passes, so screens read the numbers again. */
  tick: 0,
  courseID: '',
  mode: 'path' as LearnMode,
  active: null as ActiveRun | null,
});

/** The files of the keys of the core: the app's storage names allow no dots. */
const files: Record<string, string> = {
  'learn.progress': 'learn-progress',
  'learn.quests': 'learn-quests',
  'learn.skills': 'learn-skills',
};

/** A key-value store that reads from memory (it was loaded once at the start) and writes through to the app's
 * storage, in order. */
export class AppKeyValueStore implements KeyValueStore {
  private values = new Map<string, string>();
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly write: (file: string, text: string) => Promise<void> = (file, text) => storage.write(file, text),
  ) {}

  preload(key: string, text: string | null): void {
    if (text !== null) this.values.set(key, text);
  }

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
    const file = files[key];
    if (!file) return;
    this.queue = this.queue.then(() => this.write(file, value)).catch(() => undefined);
  }

  /** Resolves once everything written so far has been handed to the storage. */
  flush(): Promise<void> {
    return this.queue;
  }
}

export interface LearnRuntime {
  progress: LearnProgressStore;
  quests: QuestStore;
  skills: SkillStore;
  controller: LearnController;
  keyValue: AppKeyValueStore;
}

let runtime: LearnRuntime | null = null;
let starting: Promise<void> | null = null;

/** Epoch milliseconds: the one place of the area that reads the clock. */
export const now = (): number => Date.now();

/** The student's calendar: the system's time zone, weeks start on Monday. */
export function calendar(): LearnCalendar {
  let zone = 'Europe/Berlin';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
  } catch {
    // keep the default
  }
  return learnCalendar(zone, 2);
}

/** A fresh seed per round: 1 to 2^64-1. */
export function newSeed(): bigint {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  const seed = (BigInt(words[0]) << 32n) | BigInt(words[1]);
  return seed === 0n ? 1n : seed;
}

export function learn(): LearnRuntime {
  if (!runtime) throw new Error('The Lernen area has not started.');
  return runtime;
}

export function learnReady(): boolean {
  return runtime !== null;
}

export function startLearn(): Promise<void> {
  starting ??= (async () => {
    registerCourses();
    const keyValue = new AppKeyValueStore();
    await Promise.all(
      Object.entries(files).map(async ([key, file]) => {
        try {
          keyValue.preload(key, await storage.read(file));
        } catch {
          // a damaged or unreadable file starts empty
        }
      }),
    );
    const progress = new LearnProgressStore(keyValue);
    const quests = new QuestStore(keyValue);
    const skills = new SkillStore(keyValue);
    const controller = new LearnController({ progress, quests, skills, clock: now, calendar, newSeed });
    runtime = { progress, quests, skills, controller, keyValue };
    const bump = () => learnUi.set((s) => ({ ...s, tick: s.tick + 1 }));
    progress.subscribe(bump);
    quests.subscribe(bump);
    skills.subscribe(bump);
    quests.refresh(now(), calendar());
    await persist(
      learnUi,
      'learn-ui',
      (s) => ({ courseID: s.courseID, mode: s.mode }),
      (stored, s) => {
        const data = stored as { courseID?: unknown; mode?: unknown };
        const courseID = typeof data.courseID === 'string' && providerForCourse(data.courseID) ? data.courseID : '';
        const mode = data.mode === 'quests' || data.mode === 'skills' ? data.mode : 'path';
        return { ...s, courseID, mode };
      },
    );
    learnUi.set({ ready: true });
  })();
  return starting;
}

/** Starts today's quests if the day has changed, and has the screens read the clock again. */
export function refreshTime(): void {
  if (!runtime) return;
  runtime.quests.refresh(now(), calendar());
  learnUi.set((s) => ({ ...s, tick: s.tick + 1 }));
}

export function selectCourse(courseID: string): void {
  learnUi.set({ courseID, mode: 'path' });
}

export function setMode(mode: LearnMode): void {
  learnUi.set({ mode });
}

function begin(run: LessonRun): void {
  const id = crypto.randomUUID();
  const model = learn().controller.newModel(run, id);
  learnUi.set({ active: { id, run, model } });
}

/** Tapping a step of the path: a chest opens, anything else becomes a round. */
export function startStep(step: PathStep): void {
  const { courseID, active } = learnUi.get();
  if (active || !courseID) return;
  const result = learn().controller.startStep(step, courseID);
  if (result.type === 'run') begin(result.run);
  else if (result.type === 'chest') say(result.notice);
  else if (result.notice) say(result.notice);
}

/** A round on the chosen goals (a recommendation, or the button of a skill). */
export function startPractice(targets: readonly string[]): void {
  const { courseID, active } = learnUi.get();
  if (active || !courseID) return;
  const result = learn().controller.startPractice(targets, courseID);
  if (result.type === 'run') begin(result.run);
  else if (result.type === 'none' && result.notice) say(result.notice);
}

/** The test of the first unit, for a student who knows it. */
export function startTestOut(unit: CourseUnit): void {
  const { courseID, active } = learnUi.get();
  if (active || !courseID) return;
  const run = learn().controller.startTestOut(unit, courseID);
  if (run) begin(run);
}

export function canTestOut(unit: CourseUnit): boolean {
  const { courseID } = learnUi.get();
  return courseID !== '' && learn().controller.canTestOut(unit, courseID);
}

/** Records a finished round once; what it brought, for the end screen. */
export function finishRun(result: LessonResult): LessonRewards {
  const active = learnUi.get().active;
  if (!active) return { gems: 0, quests: [], freezesUsed: 0, streakExtended: false, notes: [] };
  return learn().controller.finish(result, active.run);
}

export function closeRun(): void {
  learnUi.set({ active: null });
}

export function claimQuest(id: string): void {
  const { quests, progress } = learn();
  const gems = quests.claim(id);
  if (gems > 0) progress.addGems(gems);
}

export function buyFreeze(): boolean {
  return learn().progress.buyFreeze();
}

export function setDailyGoal(goal: number): void {
  learn().progress.setDailyGoal(goal);
}
