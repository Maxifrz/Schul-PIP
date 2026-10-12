// Persistence of the learning state. The storage itself is injected (`KeyValueStore`: localStorage in the renderer, a
// Map in tests); the keys and the JSON are those of the iOS app's UserDefaults. Broken or missing data starts empty.
// A port of LearnProgressStore (LearnProgress.swift), QuestStore (QuestBoard.swift) and SkillStore/SkillProgress/
// SkillMaps (SkillStore.swift).

import type { CourseNode, CourseProvider } from './course';
import type { LearnCalendar } from './day';
import { dRecord, field, isObject, type JsonObject } from './decode';
import { LearnProgress, type RecordOptions, type Reward } from './progress';
import { BONUS_ID, type Quest, QuestBoard, type QuestEvent } from './quests';
import type { LessonResult } from './session';
import { type ExerciseOutcome, SkillAssessor, SkillRecord } from './skills/assessor';
import { skillMap, type SkillMap } from './skills/skill';

/** Where the state is kept: `get` returns null for a missing key. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** A store in memory, for tests and for places without storage. */
export class MemoryStore implements KeyValueStore {
  readonly values = new Map<string, string>();
  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/** A KeyValueStore on top of a Web Storage object (`localStorage`); failures are swallowed. */
export function webStore(storage: Pick<Storage, 'getItem' | 'setItem'>): KeyValueStore {
  return {
    get(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
        // Storage can be full or blocked; the state stays in memory.
      }
    },
  };
}

function readJSON(store: KeyValueStore, key: string): unknown {
  let text: string | null = null;
  try {
    text = store.get(key);
  } catch {
    return undefined;
  }
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function writeJSON(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.set(key, JSON.stringify(value));
  } catch {
    // The state stays in memory.
  }
}

type Listener = () => void;

class Observable {
  private listeners = new Set<Listener>();
  /** Calls `listener` after every change; returns the function that stops it. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  protected emit(): void {
    for (const listener of this.listeners) listener();
  }
}

/** The Lernpfad's progress in a key-value store. */
export class LearnProgressStore extends Observable {
  static readonly key = 'learn.progress';

  progress: LearnProgress;

  constructor(private readonly storage: KeyValueStore) {
    super();
    this.progress = LearnProgress.fromJSON(readJSON(storage, LearnProgressStore.key));
  }

  setDailyGoal(goal: number): void {
    this.progress.setDailyGoal(goal);
    this.save();
  }

  /** Counts a finished lesson once; null if this run was counted before or had no exercise. */
  record(result: LessonResult, options: RecordOptions): Reward | null {
    const updated = this.progress.clone();
    const reward = updated.record(result, options);
    if (!reward) return null;
    this.progress = updated;
    this.save();
    return reward;
  }

  complete(nodeIDs: readonly string[]): void {
    const updated = this.progress.clone();
    updated.complete(nodeIDs);
    if (updated.equals(this.progress)) return;
    this.progress = updated;
    this.save();
  }

  /** Opens a chest once and pays its gems; false if it was open already. */
  openChest(nodeID: string, gems: number): boolean {
    const updated = this.progress.clone();
    if (!updated.openChest(nodeID, gems)) return false;
    this.progress = updated;
    this.save();
    return true;
  }

  addGems(amount: number): void {
    if (!(amount > 0)) return;
    this.progress.addGems(amount);
    this.save();
  }

  buyFreeze(): boolean {
    const updated = this.progress.clone();
    if (!updated.buyFreeze()) return false;
    this.progress = updated;
    this.save();
    return true;
  }

  private save(): void {
    writeJSON(this.storage, LearnProgressStore.key, this.progress.toJSON());
    this.emit();
  }
}

/** The quests in a key-value store, like `LearnProgressStore`. */
export class QuestStore extends Observable {
  static readonly key = 'learn.quests';
  static readonly bonusID = BONUS_ID;

  board: QuestBoard;

  constructor(private readonly storage: KeyValueStore) {
    super();
    this.board = QuestBoard.fromJSON(readJSON(storage, QuestStore.key));
  }

  /** Starts today's quests if the day has changed. */
  refresh(now: number, calendar: LearnCalendar): void {
    const updated = this.board.clone();
    updated.refresh(now, calendar);
    if (updated.equals(this.board)) return;
    this.board = updated;
    this.save();
  }

  /** Counts a finished round; the quests it completed. */
  record(event: QuestEvent, now: number, calendar: LearnCalendar): Quest[] {
    const updated = this.board.clone();
    const finished = updated.apply(event, now, calendar);
    this.board = updated;
    this.save();
    return finished;
  }

  /** Claims a quest (or the day's bonus with `QuestStore.bonusID`); the gems to pay out. */
  claim(id: string): number {
    const updated = this.board.clone();
    const gems = id === QuestStore.bonusID ? updated.claimBonus() : updated.claim(id);
    if (!(gems > 0)) return 0;
    this.board = updated;
    this.save();
    return gems;
  }

  private save(): void {
    writeJSON(this.storage, QuestStore.key, this.board.toJSON());
    this.emit();
  }
}

/** Every skill's record, saved as one value. A record whose skill no longer exists is simply never read. */
export class SkillProgress {
  records: Record<string, SkillRecord> = {};

  clone(): SkillProgress {
    const p = new SkillProgress();
    for (const [k, v] of Object.entries(this.records)) p.records[k] = v.clone();
    return p;
  }

  equals(other: SkillProgress): boolean {
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  toJSON(): JsonObject {
    const records: JsonObject = {};
    for (const key of Object.keys(this.records).sort()) records[key] = this.records[key].toJSON();
    return { records };
  }

  static fromJSON(json: unknown): SkillProgress {
    const p = new SkillProgress();
    if (!isObject(json)) return p;
    p.records = field(json, 'records', dRecord(SkillRecord.decode), {} as Record<string, SkillRecord>);
    return p;
  }
}

/** The skill maps of the registered courses, built once. */
export const SkillMaps = {
  cache: new Map<string, SkillMap>(),

  map(provider: CourseProvider): SkillMap {
    const id = provider.course.id;
    const known = SkillMaps.cache.get(id);
    if (known) return known;
    const built = skillMap(provider);
    SkillMaps.cache.set(id, built);
    return built;
  },

  /** For tests, or after a course changed. */
  clear(): void {
    SkillMaps.cache.clear();
  },
};

/** The skills in a key-value store, like `LearnProgressStore`. */
export class SkillStore extends Observable {
  static readonly key = 'learn.skills';

  progress: SkillProgress;

  constructor(private readonly storage: KeyValueStore) {
    super();
    this.progress = SkillProgress.fromJSON(readJSON(storage, SkillStore.key));
  }

  get records(): Record<string, SkillRecord> {
    return this.progress.records;
  }

  /** A step was opened. */
  begin(node: CourseNode, map: SkillMap): void {
    const updated = this.progress.clone();
    SkillAssessor.begin(node, map, updated.records);
    if (updated.equals(this.progress)) return;
    this.progress = updated;
    this.save();
  }

  /** Counts a finished round once; the caller has already made sure the run is new. */
  record(outcomes: readonly ExerciseOutcome[], node: CourseNode | null, map: SkillMap, now: number, calendar: LearnCalendar): void {
    const updated = this.progress.clone();
    SkillAssessor.record(outcomes, node, map, updated.records, now, calendar);
    if (updated.equals(this.progress)) return;
    this.progress = updated;
    this.save();
  }

  private save(): void {
    writeJSON(this.storage, SkillStore.key, this.progress.toJSON());
    this.emit();
  }
}
