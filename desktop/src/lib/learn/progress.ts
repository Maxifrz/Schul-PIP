// XP, daily goal, streak and finished lessons of the Lernpfad. Plain values: the time (epoch milliseconds) and the
// calendar come in as parameters, so midnight, daylight saving time and other time zones can be tested.
// A port of Lernwerk/Services/Learn/LearnProgress.swift (LearnProgress; the store is in store.ts).

import { dayOf, daysTo, type LearnCalendar, type LearnDay, sameDay } from './day';
import { dArray, dInt, dLearnDay, dRecord, dSet, dString, field, isObject, type JsonObject } from './decode';
import type { LessonResult } from './session';
import { sortedArray } from './util';


/** What a finished lesson brought. */
export interface Reward {
  xp: number;
  xpToday: number;
  /** The daily goal was reached with this lesson; true once a day at most. */
  goalReached: boolean;
  streak: number;
  /** The first lesson of the day, which counts for the streak. */
  streakExtended: boolean;
  /** Gems for the lesson, with the daily goal's if this lesson reached it. */
  gems: number;
  /** Days of the streak a streak freeze covered with this lesson. */
  freezesUsed: number;
}

export interface RecordOptions {
  /** Epoch milliseconds. */
  now: number;
  calendar: LearnCalendar;
  /** Adds the round's XP to the course's own count. */
  courseID?: string | null;
  /** False for a round that belongs to no step of the path (a practice round on chosen goals): it earns XP and keeps
   * the streak, and marks nothing as done. */
  completes?: boolean;
}

export class LearnProgress {
  static readonly dailyGoals = [20, 50, 100];
  static readonly defaultGoal = 20;
  static readonly xpFirstTry = 10;
  static readonly xpRetry = 5;
  static readonly xpLesson = 20;
  static readonly xpAccuracyBonus = 10;
  /** Percent right on the first try for the bonus. */
  static readonly bonusPercent = 90;
  /** Runs remembered to ignore the same result arriving twice. */
  static readonly rememberedRuns = 50;
  static readonly gemsLesson = 2;
  /** More for a lesson in which every exercise was right on the first try. */
  static readonly gemsPerfect = 3;
  static readonly gemsGoal = 5;
  static readonly freezePrice = 30;
  static readonly maxFreezes = 2;

  dailyGoal = LearnProgress.defaultGoal;
  totalXP = 0;
  /** The XP of `xpDay`; read through `xpToday(now, calendar)`, which knows when the day is over. */
  xpOfDay = 0;
  xpDay: LearnDay | null = null;
  goalReachedDay: LearnDay | null = null;
  /** As of `lastLessonDay`; read through `currentStreak(now, calendar)`, which knows when a day was skipped. */
  streak = 0;
  longestStreak = 0;
  lastLessonDay: LearnDay | null = null;
  /** Lesson ids come from their cards, so a lesson whose cards changed is not in here. */
  completedLessons = new Set<string>();
  recentRuns: string[] = [];
  gems = 0;
  /** Streak freezes in stock: each covers one skipped day. */
  freezes = 0;
  /** XP per course id, for the number next to the course's icon. */
  courseXP: Record<string, number> = {};

  static xp(result: LessonResult): number {
    let xp = result.rightFirstTry * LearnProgress.xpFirstTry + result.rightOnRetry * LearnProgress.xpRetry + LearnProgress.xpLesson;
    if (result.exerciseCount > 0 && result.rightFirstTry * 100 >= result.exerciseCount * LearnProgress.bonusPercent) {
      xp += LearnProgress.xpAccuracyBonus;
    }
    return xp;
  }

  /** Gems for a lesson: a little for finishing it, more when nothing went wrong. */
  static gemsFor(result: LessonResult): number {
    return (
      LearnProgress.gemsLesson +
      (result.exerciseCount > 0 && result.rightFirstTry === result.exerciseCount ? LearnProgress.gemsPerfect : 0)
    );
  }

  xpInCourse(courseID: string): number {
    return this.courseXP[courseID] ?? 0;
  }

  xpToday(now: number, calendar: LearnCalendar): number {
    return sameDay(this.xpDay, this.day(now, calendar)) ? this.xpOfDay : 0;
  }

  goalFraction(now: number, calendar: LearnCalendar): number {
    return Math.min(1, this.xpToday(now, calendar) / Math.max(1, this.dailyGoal));
  }

  /** The streak as it stands: it holds through today if the last lesson was today or yesterday, or if freezes cover
   * the days since. */
  currentStreak(now: number, calendar: LearnCalendar): number {
    if (!this.lastLessonDay) return 0;
    const gap = daysTo(this.lastLessonDay, dayOf(now, calendar), calendar);
    return gap - 1 <= this.freezes ? this.streak : 0;
  }

  isCompleted(lessonID: string): boolean {
    return this.completedLessons.has(lessonID);
  }

  /** Today in the calendar, but never before the last lesson's day: after a change of time zone or clock, or a
   * flight across the date line, the local date can go back, and a lesson then belongs to the last lesson day
   * instead of starting the day's XP, goal and streak over. */
  private day(now: number, calendar: LearnCalendar): LearnDay {
    const today = dayOf(now, calendar);
    const last = this.lastLessonDay;
    if (!last) return today;
    return daysTo(last, today, calendar) < 0 ? last : today;
  }

  setDailyGoal(goal: number): void {
    if (!LearnProgress.dailyGoals.includes(goal)) return;
    this.dailyGoal = goal;
  }

  addGems(amount: number): void {
    this.gems += Math.max(0, amount);
  }

  /** Buys a streak freeze; false if there are not enough gems or two are in stock already. */
  buyFreeze(): boolean {
    if (this.gems < LearnProgress.freezePrice || this.freezes >= LearnProgress.maxFreezes) return false;
    this.gems -= LearnProgress.freezePrice;
    this.freezes += 1;
    return true;
  }

  /** Marks steps as done without a round of their own: the steps of a unit whose test was passed. */
  complete(nodeIDs: readonly string[]): void {
    for (const id of nodeIDs) this.completedLessons.add(id);
  }

  /** Opens a chest once: false if it was open already. */
  openChest(nodeID: string, gems: number): boolean {
    if (this.completedLessons.has(nodeID)) return false;
    this.completedLessons.add(nodeID);
    this.addGems(gems);
    return true;
  }

  /** Counts a finished lesson; null if this run was counted before or had no exercise to count. */
  record(result: LessonResult, options: RecordOptions): Reward | null {
    const { now, calendar } = options;
    const completes = options.completes ?? true;
    if (!(result.exerciseCount > 0) || this.recentRuns.includes(result.sessionID)) return null;
    this.recentRuns.push(result.sessionID);
    if (this.recentRuns.length > LearnProgress.rememberedRuns) {
      this.recentRuns.splice(0, this.recentRuns.length - LearnProgress.rememberedRuns);
    }

    const today = this.day(now, calendar);
    const earned = LearnProgress.xp(result);
    if (!sameDay(this.xpDay, today)) {
      this.xpDay = today;
      this.xpOfDay = 0;
    }
    this.xpOfDay += earned;
    this.totalXP += earned;
    if (options.courseID != null) this.courseXP[options.courseID] = (this.courseXP[options.courseID] ?? 0) + earned;
    const goalReached = !sameDay(this.goalReachedDay, today) && this.xpOfDay >= this.dailyGoal;
    if (goalReached) this.goalReachedDay = today;

    let extended = false;
    let used = 0;
    if (!sameDay(this.lastLessonDay, today)) {
      const gap = this.lastLessonDay ? daysTo(this.lastLessonDay, today, calendar) : null;
      if (gap === 1) {
        this.streak += 1;
      } else if (gap !== null && gap > 1 && gap - 1 <= this.freezes) {
        // A freeze covers each skipped day, so the streak goes on.
        used = gap - 1;
        this.freezes -= used;
        this.streak += 1;
      } else {
        this.streak = 1;
      }
      this.lastLessonDay = today;
      extended = true;
    }
    this.longestStreak = Math.max(this.longestStreak, this.streak);
    if (completes) this.completedLessons.add(result.lessonID);
    const earnedGems = LearnProgress.gemsFor(result) + (goalReached ? LearnProgress.gemsGoal : 0);
    this.addGems(earnedGems);
    return {
      xp: earned,
      xpToday: this.xpOfDay,
      goalReached,
      streak: this.streak,
      streakExtended: extended,
      gems: earnedGems,
      freezesUsed: used,
    };
  }

  clone(): LearnProgress {
    return LearnProgress.fromJSON(this.toJSON());
  }

  /** Same persisted state (Swift's synthesized `==`). */
  equals(other: LearnProgress): boolean {
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  // Persistence: the field names of the Swift Codable. Sets are written as sorted arrays, nil fields are left out.

  toJSON(): JsonObject {
    const out: JsonObject = {
      dailyGoal: this.dailyGoal,
      totalXP: this.totalXP,
      xpOfDay: this.xpOfDay,
      streak: this.streak,
      longestStreak: this.longestStreak,
      completedLessons: sortedArray(this.completedLessons),
      recentRuns: this.recentRuns.slice(),
      gems: this.gems,
      freezes: this.freezes,
      courseXP: sortedRecord(this.courseXP),
    };
    if (this.xpDay) out.xpDay = { year: this.xpDay.year, month: this.xpDay.month, day: this.xpDay.day };
    if (this.goalReachedDay) {
      out.goalReachedDay = { year: this.goalReachedDay.year, month: this.goalReachedDay.month, day: this.goalReachedDay.day };
    }
    if (this.lastLessonDay) {
      out.lastLessonDay = { year: this.lastLessonDay.year, month: this.lastLessonDay.month, day: this.lastLessonDay.day };
    }
    return out;
  }

  /** Saved progress from an older version lacks the newer fields; each one falls back on its default. Anything that is
   * not a JSON object gives the default progress. */
  static fromJSON(json: unknown): LearnProgress {
    const progress = new LearnProgress();
    if (!isObject(json)) return progress;
    const goal = field(json, 'dailyGoal', dInt, LearnProgress.defaultGoal);
    progress.dailyGoal = LearnProgress.dailyGoals.includes(goal) ? goal : LearnProgress.defaultGoal;
    progress.totalXP = field(json, 'totalXP', dInt, 0);
    progress.xpOfDay = field(json, 'xpOfDay', dInt, 0);
    progress.xpDay = field(json, 'xpDay', dLearnDay, null);
    progress.goalReachedDay = field(json, 'goalReachedDay', dLearnDay, null);
    progress.streak = field(json, 'streak', dInt, 0);
    progress.longestStreak = Math.max(field(json, 'longestStreak', dInt, 0), progress.streak);
    progress.lastLessonDay = field(json, 'lastLessonDay', dLearnDay, null);
    progress.completedLessons = field(json, 'completedLessons', dSet(dString), new Set<string>());
    progress.recentRuns = field(json, 'recentRuns', dArray(dString), [] as string[]);
    progress.gems = Math.max(0, field(json, 'gems', dInt, 0));
    progress.freezes = Math.min(LearnProgress.maxFreezes, Math.max(0, field(json, 'freezes', dInt, 0)));
    progress.courseXP = field(json, 'courseXP', dRecord(dInt), {} as Record<string, number>);
    return progress;
  }
}

function sortedRecord(record: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key];
  return out;
}
