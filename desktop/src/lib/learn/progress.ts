import { Calendar, LearnDay, dayOf, daysBetween, isDay, sameDay } from './calendar';
import { LessonResult, accuracyOf } from './session';

export const dailyGoals = [20, 50, 100];
export const defaultGoal = 20;
export const xpFirstTry = 10;
export const xpRetry = 5;
export const xpLesson = 20;
export const xpAccuracyBonus = 10;
/** Percent right on the first try for the bonus. */
export const bonusPercent = 90;
/** Runs remembered to ignore the same result arriving twice. */
export const rememberedRuns = 50;
export const gemsLesson = 2;
/** More for a lesson in which every exercise was right on the first try. */
export const gemsPerfect = 3;
export const gemsGoal = 5;
/** Practice rounds on chosen goals can be repeated at will, so they pay out gems only up to this much a day. */
export const practiceGemsPerDay = 6;
export const freezePrice = 30;
export const maxFreezes = 2;

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

export function xpFor(result: LessonResult): number {
  let xp = result.rightFirstTry * xpFirstTry + result.rightOnRetry * xpRetry + xpLesson;
  if (result.exerciseCount > 0 && result.rightFirstTry * 100 >= result.exerciseCount * bonusPercent) xp += xpAccuracyBonus;
  return xp;
}

/** Gems for a lesson: a little for finishing it, more when nothing went wrong. */
export function gemsFor(result: LessonResult): number {
  return gemsLesson + (result.exerciseCount > 0 && result.rightFirstTry === result.exerciseCount ? gemsPerfect : 0);
}

const int = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback);
const day = (value: unknown): LearnDay | null => (isDay(value) ? { year: value.year, month: value.month, day: value.day } : null);

/** XP, daily goal, streak and finished lessons of the Lernen tab. Plain values: the time and the calendar come in as parameters, so midnight, daylight saving time and other time zones can be tested. */
export class LearnProgress {
  dailyGoal = defaultGoal;
  totalXP = 0;
  /** The XP of `xpDay`; read through `xpToday`, which knows when the day is over. */
  xpOfDay = 0;
  xpDay: LearnDay | null = null;
  goalReachedDay: LearnDay | null = null;
  /** As of `lastLessonDay`; read through `currentStreak`, which knows when a day was skipped. */
  streak = 0;
  longestStreak = 0;
  lastLessonDay: LearnDay | null = null;
  /** Lesson ids come from their cards, so a lesson whose cards changed is not in here. */
  completedLessons = new Set<string>();
  recentRuns: string[] = [];
  gems = 0;
  /** Streak freezes in stock: each covers one skipped day. */
  freezes = 0;
  /** XP per course id. */
  courseXP: Record<string, number> = {};
  practiceGemsDay: LearnDay | null = null;
  practiceGemsToday = 0;

  clone(): LearnProgress {
    return LearnProgress.fromJSON(this.toJSON());
  }

  xpInCourse(courseID: string): number {
    return this.courseXP[courseID] ?? 0;
  }

  xpTodayAt(now: number, calendar: Calendar): number {
    return sameDay(this.xpDay, this.dayAt(now, calendar)) ? this.xpOfDay : 0;
  }

  goalFraction(now: number, calendar: Calendar): number {
    return Math.min(1, this.xpTodayAt(now, calendar) / Math.max(1, this.dailyGoal));
  }

  /** The streak as it stands: it holds through today if the last lesson was today or yesterday, or if freezes cover the days since. */
  currentStreak(now: number, calendar: Calendar): number {
    if (!this.lastLessonDay) return 0;
    const gap = daysBetween(this.lastLessonDay, dayOf(now, calendar), calendar);
    return gap - 1 <= this.freezes ? this.streak : 0;
  }

  isCompleted(lessonID: string): boolean {
    return this.completedLessons.has(lessonID);
  }

  /** Today in the calendar, but never before the last lesson's day: after a change of time zone or clock the local date can go back, and a lesson then belongs to the last lesson day instead of starting the day's XP, goal and streak over. */
  private dayAt(now: number, calendar: Calendar): LearnDay {
    const today = dayOf(now, calendar);
    if (!this.lastLessonDay) return today;
    return daysBetween(this.lastLessonDay, today, calendar) < 0 ? this.lastLessonDay : today;
  }

  setDailyGoal(goal: number): void {
    if (dailyGoals.includes(goal)) this.dailyGoal = goal;
  }

  addGems(amount: number): void {
    this.gems += Math.max(0, amount);
  }

  /** Buys a streak freeze; false if there are not enough gems or two are in stock already. */
  buyFreeze(): boolean {
    if (this.gems < freezePrice || this.freezes >= maxFreezes) return false;
    this.gems -= freezePrice;
    this.freezes += 1;
    return true;
  }

  /** Marks steps as done without a round of their own: the steps of a unit whose test was passed. */
  complete(nodeIDs: string[]): void {
    nodeIDs.forEach((id) => this.completedLessons.add(id));
  }

  /** Opens a chest once: false if it was open already. */
  openChest(nodeID: string, gems: number): boolean {
    if (this.completedLessons.has(nodeID)) return false;
    this.completedLessons.add(nodeID);
    this.addGems(gems);
    return true;
  }

  /**
   * Counts a finished lesson; null if this run was counted before or had no exercise to count. `courseID` adds its XP
   * to the course's own count. `completes` is false for a round that belongs to no step of the path.
   */
  record(result: LessonResult, options: { courseID?: string; completes?: boolean; now: number; calendar: Calendar }): Reward | null {
    const { calendar, now } = options;
    const completes = options.completes ?? true;
    if (result.exerciseCount <= 0 || this.recentRuns.includes(result.sessionID)) return null;
    this.recentRuns.push(result.sessionID);
    if (this.recentRuns.length > rememberedRuns) this.recentRuns.splice(0, this.recentRuns.length - rememberedRuns);

    const today = this.dayAt(now, calendar);
    const earned = xpFor(result);
    if (!sameDay(this.xpDay, today)) {
      this.xpDay = today;
      this.xpOfDay = 0;
    }
    this.xpOfDay += earned;
    this.totalXP += earned;
    if (options.courseID) this.courseXP[options.courseID] = (this.courseXP[options.courseID] ?? 0) + earned;
    const goalReached = !sameDay(this.goalReachedDay, today) && this.xpOfDay >= this.dailyGoal;
    if (goalReached) this.goalReachedDay = today;

    let extended = false;
    let used = 0;
    if (!sameDay(this.lastLessonDay, today)) {
      const gap = this.lastLessonDay ? daysBetween(this.lastLessonDay, today, calendar) : null;
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
    let roundGems = gemsFor(result);
    if (!completes) {
      if (!sameDay(this.practiceGemsDay, today)) {
        this.practiceGemsDay = today;
        this.practiceGemsToday = 0;
      }
      roundGems = Math.min(roundGems, Math.max(0, practiceGemsPerDay - this.practiceGemsToday));
      this.practiceGemsToday += roundGems;
    }
    const earnedGems = roundGems + (goalReached ? gemsGoal : 0);
    this.addGems(earnedGems);
    return { xp: earned, xpToday: this.xpOfDay, goalReached, streak: this.streak, streakExtended: extended, gems: earnedGems, freezesUsed: used };
  }

  toJSON(): unknown {
    return {
      dailyGoal: this.dailyGoal, totalXP: this.totalXP, xpOfDay: this.xpOfDay, xpDay: this.xpDay, goalReachedDay: this.goalReachedDay,
      streak: this.streak, longestStreak: this.longestStreak, lastLessonDay: this.lastLessonDay, completedLessons: [...this.completedLessons],
      recentRuns: this.recentRuns, gems: this.gems, freezes: this.freezes, courseXP: this.courseXP, practiceGemsDay: this.practiceGemsDay,
      practiceGemsToday: this.practiceGemsToday,
    };
  }

  /** Saved progress from an older version lacks the newer fields; each one falls back on its default. */
  static fromJSON(raw: unknown): LearnProgress {
    const p = new LearnProgress();
    if (typeof raw !== 'object' || raw === null) return p;
    const r = raw as Record<string, unknown>;
    const goal = int(r.dailyGoal, defaultGoal);
    p.dailyGoal = dailyGoals.includes(goal) ? goal : defaultGoal;
    p.totalXP = int(r.totalXP, 0);
    p.xpOfDay = int(r.xpOfDay, 0);
    p.xpDay = day(r.xpDay);
    p.goalReachedDay = day(r.goalReachedDay);
    p.streak = int(r.streak, 0);
    p.longestStreak = Math.max(int(r.longestStreak, 0), p.streak);
    p.lastLessonDay = day(r.lastLessonDay);
    p.completedLessons = new Set(Array.isArray(r.completedLessons) ? r.completedLessons.filter((x): x is string => typeof x === 'string') : []);
    p.recentRuns = Array.isArray(r.recentRuns) ? r.recentRuns.filter((x): x is string => typeof x === 'string') : [];
    p.gems = Math.max(0, int(r.gems, 0));
    p.freezes = Math.min(maxFreezes, Math.max(0, int(r.freezes, 0)));
    p.courseXP = {};
    if (typeof r.courseXP === 'object' && r.courseXP !== null) {
      for (const [key, value] of Object.entries(r.courseXP)) if (typeof value === 'number') p.courseXP[key] = Math.trunc(value);
    }
    p.practiceGemsDay = day(r.practiceGemsDay);
    p.practiceGemsToday = Math.max(0, int(r.practiceGemsToday, 0));
    return p;
  }
}

export { accuracyOf };
