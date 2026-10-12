// Three quests a day and one for the week, chosen from the date alone, so a day's quests are the same on every
// launch and nothing needs a server. Everything takes the time (epoch milliseconds) and the calendar as parameters.
// A port of Lernwerk/Services/Learn/Quests/QuestBoard.swift (the store is in store.ts).

import type { NodeKind } from './course';
import {
  compareDays,
  dayKey,
  dayOf,
  daysTo,
  type LearnCalendar,
  type LearnDay,
  sameDay,
  secondsUntilNextDay as secondsUntilNextDayOf,
  weekStart as weekStartOf,
} from './day';
import {
  dArray,
  dBool,
  dEnum,
  dInt,
  dLearnDay,
  dSet,
  dString,
  FAIL,
  field,
  isObject,
  type JsonObject,
  required,
  strictObject,
} from './decode';
import { MASK64, SplitMix } from './random';
import { sortedArray } from './util';

/** What a quest asks for. */
export type QuestKind =
  /** Earn XP. */
  | 'xp'
  /** Finish lessons, practice rounds or checkpoints. */
  | 'lessons'
  /** Finish rounds in which every exercise was right on the first try. */
  | 'perfect'
  /** Answer exercises right on the first try, in any rounds. */
  | 'firstTry'
  /** Learn in different courses on one day. */
  | 'courses'
  /** Finish practice rounds or checkpoints. */
  | 'practice'
  /** Learn on different days of the week (weekly only). */
  | 'days';

export const ALL_QUEST_KINDS: readonly QuestKind[] = ['xp', 'lessons', 'perfect', 'firstTry', 'courses', 'practice', 'days'];

export interface Quest {
  id: string;
  kind: QuestKind;
  target: number;
  progress: number;
  /** Gems for claiming it. */
  reward: number;
  claimed: boolean;
}

export function quest(id: string, kind: QuestKind, target: number, reward: number): Quest {
  return { id, kind, target, progress: 0, reward, claimed: false };
}

export function questIsDone(q: Quest): boolean {
  return q.progress >= q.target;
}

export function questFraction(q: Quest): number {
  return q.target === 0 ? 1 : Math.min(1, q.progress / q.target);
}

/** What the student reads. */
export function questTitle(q: Quest): string {
  const target = q.target;
  switch (q.kind) {
    case 'xp':
      return `Sammle ${target} XP`;
    case 'lessons':
      return target === 1 ? 'Schließe eine Lektion ab' : `Schließe ${target} Lektionen ab`;
    case 'perfect':
      return target === 1 ? 'Eine Lektion ohne Fehler' : `${target} Lektionen ohne Fehler`;
    case 'firstTry':
      return `Beantworte ${target} Aufgaben auf Anhieb richtig`;
    case 'courses':
      return `Lerne in ${target} verschiedenen Kursen`;
    case 'practice':
      return target === 1 ? 'Schließe eine Übungsrunde ab' : `Schließe ${target} Übungsrunden ab`;
    case 'days':
      return `Lerne an ${target} Tagen`;
  }
}

/** A finished round, as the quests see it. */
export interface QuestEvent {
  xp: number;
  courseID: string | null;
  nodeKind: NodeKind | null;
  rightFirstTry: number;
  exerciseCount: number;
}

export function questEvent(fields: Partial<QuestEvent> & Pick<QuestEvent, 'xp' | 'rightFirstTry' | 'exerciseCount'>): QuestEvent {
  return { courseID: null, nodeKind: null, ...fields };
}

export function eventIsPerfect(e: QuestEvent): boolean {
  return e.exerciseCount > 0 && e.rightFirstTry === e.exerciseCount;
}

export function eventIsPractice(e: QuestEvent): boolean {
  return e.nodeKind === 'practice' || e.nodeKind === 'checkpoint';
}

const dQuest = strictObject<Quest>((o) => {
  const id = required(o, 'id', dString);
  const kind = required(o, 'kind', dEnum(ALL_QUEST_KINDS));
  const target = required(o, 'target', dInt);
  const progress = required(o, 'progress', dInt);
  const reward = required(o, 'reward', dInt);
  const claimed = required(o, 'claimed', dBool);
  if (id === FAIL || kind === FAIL || target === FAIL || progress === FAIL || reward === FAIL || claimed === FAIL) return FAIL;
  return { id, kind, target, progress, reward, claimed };
});

function cloneQuest(q: Quest): Quest {
  return { ...q };
}

function insertDay(days: LearnDay[], day: LearnDay): void {
  if (days.some((d) => sameDay(d, day))) return;
  days.push({ year: day.year, month: day.month, day: day.day });
  days.sort(compareDays);
}

/** The id the store accepts to claim the day's bonus. */
export const BONUS_ID = 'bonus';

export class QuestBoard {
  static readonly dailyCount = 3;
  /** Gems for claiming all three of a day's quests. */
  static readonly bonusGems = 20;

  day: LearnDay | null = null;
  daily: Quest[] = [];
  bonusClaimed = false;
  coursesToday = new Set<string>();
  weekStart: LearnDay | null = null;
  weekly: Quest | null = null;
  /** The days of the week that had a round, sorted. */
  weekDays: LearnDay[] = [];
  weekXP = 0;
  weekLessons = 0;

  // MARK: Choosing

  /** Variants of each kind: target and reward. */
  private static variants(kind: QuestKind): { target: number; reward: number }[] {
    switch (kind) {
      case 'xp':
        return [t(30, 10), t(50, 15), t(80, 20)];
      case 'lessons':
        return [t(2, 10), t(3, 15), t(4, 20)];
      case 'perfect':
        return [t(1, 15)];
      case 'firstTry':
        return [t(15, 10), t(25, 15)];
      case 'courses':
        return [t(2, 15)];
      case 'practice':
        return [t(1, 10)];
      case 'days':
        return [t(4, 40), t(5, 50)];
    }
  }

  private static readonly dailyKinds: QuestKind[] = ['xp', 'lessons', 'perfect', 'firstTry', 'courses', 'practice'];

  private static seed(day: LearnDay): bigint {
    return BigInt(day.year * 10_000 + day.month * 100 + day.day) & MASK64;
  }

  static dailyQuests(day: LearnDay): Quest[] {
    const mix = new SplitMix(QuestBoard.seed(day));
    let pool = QuestBoard.dailyKinds.slice();
    const chosen: Quest[] = [];
    // The first quest is always about XP or lessons, so every day has one that anything done counts for.
    const anchors: QuestKind[] = ['xp', 'lessons'];
    const anchor = anchors[Number(mix.next() % BigInt(anchors.length))];
    pool = pool.filter((k) => k !== anchor);
    const kinds: QuestKind[] = [anchor];
    while (kinds.length < QuestBoard.dailyCount && pool.length > 0) {
      const index = Number(mix.next() % BigInt(pool.length));
      kinds.push(pool.splice(index, 1)[0]);
    }
    for (const kind of kinds) {
      const options = QuestBoard.variants(kind);
      const option = options[Number(mix.next() % BigInt(options.length))];
      chosen.push(quest(`d.${day.year}-${day.month}-${day.day}.${kind}`, kind, option.target, option.reward));
    }
    return chosen;
  }

  static weeklyQuest(start: LearnDay): Quest {
    const mix = new SplitMix((QuestBoard.seed(start) + 7n) & MASK64);
    const kinds: QuestKind[] = ['days', 'xp', 'lessons'];
    const kind = kinds[Number(mix.next() % BigInt(kinds.length))];
    let option: { target: number; reward: number };
    switch (kind) {
      case 'xp':
        option = t(300, 50);
        break;
      case 'lessons':
        option = t(12, 50);
        break;
      default:
        option = QuestBoard.variants('days')[Number(mix.next() % 2n)];
    }
    return quest(`w.${start.year}-${start.month}-${start.day}.${kind}`, kind, option.target, option.reward);
  }

  // MARK: Time

  /** Starts a new day's quests and a new week's, when the day or the week has changed. A date that goes back (a
   * changed time zone) keeps the quests of the later day. */
  refresh(now: number, calendar: LearnCalendar): void {
    let today = dayOf(now, calendar);
    if (this.day && daysTo(this.day, today, calendar) < 0) today = this.day;
    if (!sameDay(this.day, today)) {
      this.day = today;
      this.daily = QuestBoard.dailyQuests(today);
      this.bonusClaimed = false;
      this.coursesToday = new Set();
    }
    let start: LearnDay = QuestBoard.weekStart(now, calendar);
    if (this.weekStart && daysTo(this.weekStart, start, calendar) < 0) start = this.weekStart;
    if (!sameDay(this.weekStart, start)) {
      this.weekStart = start;
      this.weekly = QuestBoard.weeklyQuest(start);
      this.weekDays = [];
      this.weekXP = 0;
      this.weekLessons = 0;
    }
  }

  /** The first day of the week of an instant, honoring the calendar's first weekday. */
  static weekStart(now: number, calendar: LearnCalendar): LearnDay {
    return weekStartOf(now, calendar);
  }

  /** Seconds until midnight, for the timer on the quest tile. */
  static secondsUntilNextDay(now: number, calendar: LearnCalendar): number {
    return secondsUntilNextDayOf(now, calendar);
  }

  // MARK: Progress

  /** Counts a finished round; the quests that became done with it. */
  apply(event: QuestEvent, now: number, calendar: LearnCalendar): Quest[] {
    this.refresh(now, calendar);
    if (!(event.exerciseCount > 0)) return [];
    const finished: Quest[] = [];
    if (event.courseID != null) this.coursesToday.add(event.courseID);
    for (const q of this.daily) {
      const before = questIsDone(q);
      q.progress += QuestBoard.gain(q.kind, event, this.coursesToday.size, q.progress);
      if (!before && questIsDone(q)) finished.push(cloneQuest(q));
    }
    const weekly = this.weekly;
    if (weekly) {
      const quest = cloneQuest(weekly);
      const before = questIsDone(quest);
      if (this.day) insertDay(this.weekDays, this.day);
      this.weekXP += event.xp;
      this.weekLessons += 1;
      switch (quest.kind) {
        case 'days':
          quest.progress = this.weekDays.length;
          break;
        case 'xp':
          quest.progress = this.weekXP;
          break;
        default:
          quest.progress = this.weekLessons;
      }
      this.weekly = quest;
      if (!before && questIsDone(quest)) finished.push(cloneQuest(quest));
    }
    return finished;
  }

  /** How much a round moves a quest of this kind. `courses` is a count that is set, not added to. */
  private static gain(kind: QuestKind, event: QuestEvent, courses: number, current: number): number {
    switch (kind) {
      case 'xp':
        return event.xp;
      case 'lessons':
        return 1;
      case 'perfect':
        return eventIsPerfect(event) ? 1 : 0;
      case 'firstTry':
        return event.rightFirstTry;
      case 'courses':
        return Math.max(0, courses - current);
      case 'practice':
        return eventIsPractice(event) ? 1 : 0;
      case 'days':
        return 0;
    }
  }

  // MARK: Rewards

  get dailyDone(): number {
    return this.daily.filter(questIsDone).length;
  }

  get allDailyClaimed(): boolean {
    return this.daily.length > 0 && this.daily.every((q) => q.claimed);
  }

  get bonusAvailable(): boolean {
    return this.allDailyClaimed && !this.bonusClaimed;
  }

  get hasUnclaimed(): boolean {
    return (
      this.daily.some((q) => questIsDone(q) && !q.claimed) ||
      (this.weekly ? questIsDone(this.weekly) && !this.weekly.claimed : false) ||
      this.bonusAvailable
    );
  }

  /** Claims a finished quest; its gems, or 0 when it is not done or claimed already. */
  claim(id: string): number {
    const q = this.daily.find((x) => x.id === id);
    if (q && questIsDone(q) && !q.claimed) {
      q.claimed = true;
      return q.reward;
    }
    const weekly = this.weekly;
    if (weekly && weekly.id === id && questIsDone(weekly) && !weekly.claimed) {
      weekly.claimed = true;
      return weekly.reward;
    }
    return 0;
  }

  /** The gems for claiming all of the day's quests, once. */
  claimBonus(): number {
    if (!this.bonusAvailable) return 0;
    this.bonusClaimed = true;
    return QuestBoard.bonusGems;
  }

  clone(): QuestBoard {
    return QuestBoard.fromJSON(this.toJSON());
  }

  equals(other: QuestBoard): boolean {
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  // Persistence: the field names of the Swift Codable. Saved boards from an older version miss newer fields; each
  // falls back on its default.

  toJSON(): JsonObject {
    const out: JsonObject = {
      daily: this.daily.map(cloneQuest),
      bonusClaimed: this.bonusClaimed,
      coursesToday: sortedArray(this.coursesToday),
      weekDays: this.weekDays.map((d) => ({ year: d.year, month: d.month, day: d.day })),
      weekXP: this.weekXP,
      weekLessons: this.weekLessons,
    };
    if (this.day) out.day = { ...this.day };
    if (this.weekStart) out.weekStart = { ...this.weekStart };
    if (this.weekly) out.weekly = cloneQuest(this.weekly);
    return out;
  }

  static fromJSON(json: unknown): QuestBoard {
    const board = new QuestBoard();
    if (!isObject(json)) return board;
    board.day = field(json, 'day', dLearnDay, null);
    board.daily = field(json, 'daily', dArray(dQuest), [] as Quest[]);
    board.bonusClaimed = field(json, 'bonusClaimed', dBool, false);
    board.coursesToday = field(json, 'coursesToday', dSet(dString), new Set<string>());
    board.weekStart = field(json, 'weekStart', dLearnDay, null);
    board.weekly = field(json, 'weekly', dQuest, null);
    const days = field(json, 'weekDays', dSet(dLearnDay, dayKey), new Set<LearnDay>());
    board.weekDays = Array.from(days).sort(compareDays);
    board.weekXP = field(json, 'weekXP', dInt, 0);
    board.weekLessons = field(json, 'weekLessons', dInt, 0);
    return board;
  }
}

function t(target: number, reward: number): { target: number; reward: number } {
  return { target, reward };
}
