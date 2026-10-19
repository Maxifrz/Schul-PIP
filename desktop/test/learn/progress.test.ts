import { describe, expect, it } from 'vitest';
import { LearnProgress, maxFreezes, defaultGoal, rememberedRuns, xpFor } from '../../src/lib/learn/progress';
import { Calendar, daysBetween, dayOf, zoneCalendar } from '../../src/lib/learn/calendar';
import type { LessonResult } from '../../src/lib/learn/session';

const berlin = zoneCalendar('Europe/Berlin');
const at = (day: number, hour = 12, minute = 0, month = 10, calendar: Calendar = berlin) => calendar.at(2026, month, day, hour, minute);

let runs = 0;
const result = (right: number, total: number, retry = 0, lesson = 'L1'): LessonResult => {
  runs += 1;
  return { lessonID: lesson, sessionID: `run-${runs}`, exerciseCount: total, rightFirstTry: right, rightOnRetry: retry, cardKeys: ['a'], cardsRightFirstTry: new Set(), outcomes: [] };
};
const rec = (p: LearnProgress, r: LessonResult, now: number, calendar: Calendar = berlin, extra: { courseID?: string; completes?: boolean } = {}) => p.record(r, { now, calendar, ...extra });

describe('LearnProgress', () => {
  it('XP table', () => {
    expect(xpFor(result(8, 10, 2))).toBe(80 + 10 + 20);
    expect(xpFor(result(9, 10, 1))).toBe(90 + 5 + 20 + 10);
    expect(xpFor(result(10, 10))).toBe(100 + 20 + 10);
    expect(xpFor(result(27, 30))).toBe(270 + 20 + 10);
    expect(xpFor(result(26, 30))).toBe(260 + 20);
    expect(xpFor(result(0, 3, 3))).toBe(15 + 20);
    expect(xpFor(result(0, 0))).toBe(20);
  });

  it('the daily goal is reached once per day', () => {
    const p = new LearnProgress();
    expect(p.dailyGoal).toBe(20);
    p.setDailyGoal(100);
    p.setDailyGoal(30);
    expect(p.dailyGoal).toBe(100);
    const lesson = () => result(2, 4); // 40 XP
    expect(rec(p, lesson(), at(9, 9))?.goalReached).toBe(false);
    expect(rec(p, lesson(), at(9, 10))?.goalReached).toBe(false);
    const third = rec(p, lesson(), at(9, 11));
    expect(third?.goalReached).toBe(true);
    expect(third?.xpToday).toBe(120);
    expect(rec(p, lesson(), at(9, 12))?.goalReached).toBe(false);
    expect(p.goalFraction(at(9, 13), berlin)).toBe(1);
    p.setDailyGoal(50);
    p.setDailyGoal(100);
    expect(rec(p, lesson(), at(9, 14))?.goalReached).toBe(false);
    expect(rec(p, lesson(), at(10, 9))?.goalReached).toBe(false);
    expect(p.goalFraction(at(10, 9), berlin)).toBeCloseTo(0.4, 4);
    expect(p.totalXP).toBe(6 * 40);
  });

  it('XP today starts again at midnight', () => {
    const p = new LearnProgress();
    rec(p, result(3, 4), at(9, 23, 50));
    expect(p.xpTodayAt(at(9, 23, 59), berlin)).toBe(50);
    expect(p.xpTodayAt(at(10, 0, 1), berlin)).toBe(0);
    rec(p, result(1, 4), at(10, 0, 5));
    expect(p.xpTodayAt(at(10, 0, 6), berlin)).toBe(30);
    expect(p.totalXP).toBe(80);
  });

  it('the streak continues, breaks and counts a day once', () => {
    const p = new LearnProgress();
    expect(p.currentStreak(at(1), berlin)).toBe(0);
    expect(rec(p, result(1, 1), at(1, 8))?.streak).toBe(1);
    const second = rec(p, result(1, 1), at(1, 20));
    expect(second?.streak).toBe(1);
    expect(second?.streakExtended).toBe(false);
    const nextDay = rec(p, result(1, 1), at(2, 7));
    expect(nextDay?.streak).toBe(2);
    expect(nextDay?.streakExtended).toBe(true);
    rec(p, result(1, 1), at(3, 22));
    expect(p.currentStreak(at(3, 23), berlin)).toBe(3);
    expect(p.currentStreak(at(4, 23, 59), berlin)).toBe(3);
    expect(p.currentStreak(at(5, 0, 1), berlin)).toBe(0);
    expect(rec(p, result(1, 1), at(5, 9))?.streak).toBe(1);
    expect(p.longestStreak).toBe(3);
  });

  it('the streak across daylight saving time', () => {
    // Berlin switches to summer time on 29 March 2026 (23 hours) and back on 25 October (25 hours).
    const spring = new LearnProgress();
    rec(spring, result(1, 1), at(28, 23, 30, 3));
    expect(rec(spring, result(1, 1), at(29, 23, 30, 3))?.streak).toBe(2);
    expect(rec(spring, result(1, 1), at(30, 0, 10, 3))?.streak).toBe(3);
    const autumn = new LearnProgress();
    rec(autumn, result(1, 1), at(24, 0, 10));
    expect(rec(autumn, result(1, 1), at(25, 23, 50))?.streak).toBe(2);
    expect(autumn.currentStreak(at(26, 23, 59), berlin)).toBe(2);
    expect(autumn.currentStreak(at(27, 0, 0), berlin)).toBe(0);
  });

  it("days follow the calendar's time zone, not UTC", () => {
    const utc = zoneCalendar('UTC');
    const auckland = zoneCalendar('Pacific/Auckland');
    const late = at(9, 10, 0, 10, utc);
    const early = at(9, 12, 0, 10, utc);
    const there = new LearnProgress();
    rec(there, result(1, 1), late, auckland);
    expect(rec(there, result(1, 1), early, auckland)?.streak).toBe(2);
    expect(there.xpTodayAt(early, auckland)).toBe(40);
    const inUTC = new LearnProgress();
    rec(inUTC, result(1, 1), late, utc);
    expect(rec(inUTC, result(1, 1), early, utc)?.streak).toBe(1);
    expect(inUTC.xpTodayAt(early, utc)).toBe(80);
    expect(daysBetween({ year: 2026, month: 12, day: 31 }, { year: 2027, month: 1, day: 1 }, utc)).toBe(1);
    expect(dayOf(late, auckland)).toEqual({ year: 2026, month: 10, day: 9 });
    expect(dayOf(early, auckland)).toEqual({ year: 2026, month: 10, day: 10 });
  });

  it('a local date that goes back keeps the day', () => {
    const newYork = zoneCalendar('America/New_York');
    const p = new LearnProgress();
    p.setDailyGoal(50);
    rec(p, result(1, 1), at(9, 18));
    const second = rec(p, result(1, 1), at(10, 0, 30));
    expect(second?.streak).toBe(2);
    expect(second?.goalReached).toBe(false);
    const third = rec(p, result(1, 1), at(10, 0, 30) + 3_600_000, newYork);
    expect(third?.streak).toBe(2);
    expect(third?.streakExtended).toBe(false);
    expect(third?.xpToday).toBe(80);
    expect(third?.goalReached).toBe(true);
    expect(p.xpTodayAt(at(10, 2), newYork)).toBe(80);
    expect(p.currentStreak(at(10, 2), newYork)).toBe(2);
    expect(rec(p, result(1, 1), at(10, 3), newYork)?.goalReached).toBe(false);
    expect(p.longestStreak).toBe(2);
  });

  it('finished lessons are remembered and a run counts once', () => {
    const p = new LearnProgress();
    const run = result(4, 4, 0, 'L7');
    expect(rec(p, run, at(9))).not.toBeNull();
    expect(rec(p, run, at(9, 13))).toBeNull();
    expect(p.totalXP).toBe(70);
    expect(p.isCompleted('L7')).toBe(true);
    expect(p.completedLessons).toEqual(new Set(['L7']));
    for (let i = 0; i < rememberedRuns + 5; i++) rec(p, result(1, 1), at(9));
    expect(p.recentRuns).toHaveLength(rememberedRuns);
  });

  it('gems, freezes and course XP', () => {
    const p = new LearnProgress();
    expect(p.gems).toBe(0);
    const perfect = rec(p, result(4, 4), at(1, 9), berlin, { courseID: 'es' });
    // 2 for the lesson, 3 for no mistake, 5 more for reaching the daily goal of 20 XP.
    expect(perfect?.gems).toBe(10);
    expect(p.gems).toBe(10);
    expect(p.xpInCourse('es')).toBe(70);
    expect(p.xpInCourse('fr')).toBe(0);
    const flawed = rec(p, result(3, 4, 1), at(1, 10), berlin, { courseID: 'fr' });
    expect(flawed?.gems).toBe(2);
    expect(p.xpInCourse('fr')).toBe(55);
    expect(p.totalXP).toBe(125);

    expect(p.buyFreeze()).toBe(false);
    p.addGems(100);
    expect(p.buyFreeze()).toBe(true);
    expect(p.buyFreeze()).toBe(true);
    expect(p.buyFreeze()).toBe(false);
    expect(p.freezes).toBe(2);
    expect(p.gems).toBe(12 + 100 - 60);

    const covered = rec(p, result(1, 1), at(3, 9));
    expect(covered?.streak).toBe(2);
    expect(covered?.freezesUsed).toBe(1);
    expect(p.freezes).toBe(1);
    expect(p.currentStreak(at(6, 9), berlin)).toBe(0);
    expect(p.currentStreak(at(5, 9), berlin)).toBe(2);
    const broken = rec(p, result(1, 1), at(6, 9));
    expect(broken?.streak).toBe(1);
    expect(broken?.freezesUsed).toBe(0);
    expect(p.freezes).toBe(1);
  });

  it('chests open once', () => {
    const p = new LearnProgress();
    expect(p.openChest('es.u01.k', 15)).toBe(true);
    expect(p.openChest('es.u01.k', 15)).toBe(false);
    expect(p.gems).toBe(15);
    expect(p.isCompleted('es.u01.k')).toBe(true);
    p.addGems(-5);
    expect(p.gems).toBe(15);
  });

  it('practice rounds pay gems only up to a daily budget and complete nothing', () => {
    const p = new LearnProgress();
    const first = rec(p, result(4, 4, 0, 'P'), at(9), berlin, { completes: false });
    expect(first?.gems).toBe(5 + 5); // lesson + perfect = 5, capped at 6 per day; plus the daily goal's 5
    const second = rec(p, result(4, 4, 0, 'P'), at(9, 13), berlin, { completes: false });
    expect(second?.gems).toBe(1);
    expect(rec(p, result(4, 4, 0, 'P'), at(9, 14), berlin, { completes: false })?.gems).toBe(0);
    expect(p.isCompleted('P')).toBe(false);
    expect(rec(p, result(4, 4, 0, 'P'), at(10, 9), berlin, { completes: false })?.gems).toBe(5 + 5); // the budget starts again, and so does the goal
  });

  it('older saves without gems load', () => {
    const p = LearnProgress.fromJSON({ totalXP: 10, gems: -4, freezes: 9 });
    expect(p.gems).toBe(0);
    expect(p.freezes).toBe(maxFreezes);
    expect(p.courseXP).toEqual({});
    const saved = new LearnProgress();
    saved.addGems(7);
    rec(saved, result(1, 1), at(1), berlin, { courseID: 'chess' });
    expect(LearnProgress.fromJSON(JSON.parse(JSON.stringify(saved.toJSON())))).toEqual(saved);
  });

  it('a run without exercises counts nothing', () => {
    const p = new LearnProgress();
    expect(rec(p, result(0, 0), at(9))).toBeNull();
    expect(p.totalXP).toBe(0);
    expect(p.currentStreak(at(9), berlin)).toBe(0);
    expect(p.completedLessons.size).toBe(0);
  });

  it('JSON round trip', () => {
    const p = new LearnProgress();
    p.setDailyGoal(50);
    rec(p, result(5, 6, 0, 'A'), at(8));
    rec(p, result(6, 6, 0, 'B'), at(9));
    expect(LearnProgress.fromJSON(JSON.parse(JSON.stringify(p.toJSON())))).toEqual(p);
    expect(p.clone()).toEqual(p);
  });

  it('older saves load with defaults', () => {
    const p = LearnProgress.fromJSON({ totalXP: 340, streak: 4, completedLessons: ['L1', 'L2'], dailyGoal: 35, lastLessonDay: { year: 2026, month: 10, day: 8 } });
    expect(p.totalXP).toBe(340);
    expect(p.dailyGoal).toBe(defaultGoal);
    expect(p.longestStreak).toBe(4);
    expect(p.currentStreak(at(9), berlin)).toBe(4);
    expect(p.completedLessons).toEqual(new Set(['L1', 'L2']));
    expect(p.xpTodayAt(at(9), berlin)).toBe(0);
    expect(p.recentRuns).toEqual([]);
    expect(LearnProgress.fromJSON({})).toEqual(new LearnProgress());
    expect(LearnProgress.fromJSON({ totalXP: 'viel' }).totalXP).toBe(0);
    expect(LearnProgress.fromJSON('kaputt')).toEqual(new LearnProgress());
  });
});
