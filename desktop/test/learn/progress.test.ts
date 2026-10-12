import { describe, expect, it } from 'vitest';
import { daysTo, dayOf } from '../../src/lib/learn/day';
import { LearnProgress } from '../../src/lib/learn/progress';
import { lessonResult } from '../../src/lib/learn/session';
import { LearnProgressStore, MemoryStore } from '../../src/lib/learn/store';
import { at, calendar } from './kit';

const berlin = calendar('Europe/Berlin');
const date = (day: number, hour = 12, minute = 0, month = 10, cal = berlin) => at(cal, 2026, month, day, hour, minute);

let runs = 0;
function result(right: number, of: number, o: { retry?: number; lesson?: string } = {}) {
  runs += 1;
  return lessonResult({
    lessonID: o.lesson ?? 'L1',
    sessionID: `run-${runs}`,
    exerciseCount: of,
    rightFirstTry: right,
    rightOnRetry: o.retry ?? 0,
    cardKeys: ['a'],
    cardsRightFirstTry: new Set(),
  });
}

describe('LearnProgress', () => {
  it('XP table', () => {
    // 10 per first try, 5 per right retry, 20 for the lesson, 10 more from 90 % right on the first try.
    expect(LearnProgress.xp(result(8, 10, { retry: 2 }))).toBe(80 + 10 + 20);
    expect(LearnProgress.xp(result(9, 10, { retry: 1 }))).toBe(90 + 5 + 20 + 10);
    expect(LearnProgress.xp(result(10, 10))).toBe(100 + 20 + 10);
    expect(LearnProgress.xp(result(27, 30))).toBe(270 + 20 + 10);
    expect(LearnProgress.xp(result(26, 30))).toBe(260 + 20);
    expect(LearnProgress.xp(result(0, 3, { retry: 3 }))).toBe(15 + 20);
    expect(LearnProgress.xp(result(0, 0))).toBe(20);
  });

  it('the daily goal is reached once per day', () => {
    const progress = new LearnProgress();
    expect(progress.dailyGoal).toBe(20);
    progress.setDailyGoal(100);
    progress.setDailyGoal(30);
    expect(progress.dailyGoal).toBe(100);

    const lesson = () => result(2, 4); // 40 XP
    expect(progress.record(lesson(), { now: date(9, 9), calendar: berlin })?.goalReached).toBe(false);
    expect(progress.record(lesson(), { now: date(9, 10), calendar: berlin })?.goalReached).toBe(false);
    const third = progress.record(lesson(), { now: date(9, 11), calendar: berlin });
    expect(third?.goalReached).toBe(true);
    expect(third?.xpToday).toBe(120);
    expect(progress.record(lesson(), { now: date(9, 12), calendar: berlin })?.goalReached).toBe(false);
    expect(progress.goalFraction(date(9, 13), berlin)).toBe(1);

    // A higher goal later that day is not celebrated again.
    progress.setDailyGoal(50);
    progress.setDailyGoal(100);
    expect(progress.record(lesson(), { now: date(9, 14), calendar: berlin })?.goalReached).toBe(false);

    expect(progress.record(lesson(), { now: date(10, 9), calendar: berlin })?.goalReached).toBe(false);
    expect(progress.goalFraction(date(10, 9), berlin)).toBeCloseTo(0.4, 4);
    expect(progress.totalXP).toBe(6 * 40);
  });

  it('XP today starts again at midnight', () => {
    const progress = new LearnProgress();
    progress.record(result(3, 4), { now: date(9, 23, 50), calendar: berlin });
    expect(progress.xpToday(date(9, 23, 59), berlin)).toBe(50);
    expect(progress.xpToday(date(10, 0, 1), berlin)).toBe(0);
    progress.record(result(1, 4), { now: date(10, 0, 5), calendar: berlin });
    expect(progress.xpToday(date(10, 0, 6), berlin)).toBe(30);
    expect(progress.totalXP).toBe(80);
  });

  it('the streak continues, breaks and counts a day once', () => {
    const progress = new LearnProgress();
    expect(progress.currentStreak(date(1), berlin)).toBe(0);
    expect(progress.record(result(1, 1), { now: date(1, 8), calendar: berlin })?.streak).toBe(1);
    const second = progress.record(result(1, 1), { now: date(1, 20), calendar: berlin });
    expect(second?.streak).toBe(1);
    expect(second?.streakExtended).toBe(false);
    const nextDay = progress.record(result(1, 1), { now: date(2, 7), calendar: berlin });
    expect(nextDay?.streak).toBe(2);
    expect(nextDay?.streakExtended).toBe(true);
    progress.record(result(1, 1), { now: date(3, 22), calendar: berlin });
    expect(progress.currentStreak(date(3, 23), berlin)).toBe(3);
    // The day after, the streak still stands until midnight; a skipped day ends it.
    expect(progress.currentStreak(date(4, 23, 59), berlin)).toBe(3);
    expect(progress.currentStreak(date(5, 0, 1), berlin)).toBe(0);
    expect(progress.record(result(1, 1), { now: date(5, 9), calendar: berlin })?.streak).toBe(1);
    expect(progress.longestStreak).toBe(3);
  });

  it('the streak across daylight saving time', () => {
    // Berlin switches to summer time on 29 March 2026 (23 hours) and back on 25 October (25 hours).
    const spring = new LearnProgress();
    spring.record(result(1, 1), { now: date(28, 23, 30, 3), calendar: berlin });
    expect(spring.record(result(1, 1), { now: date(29, 23, 30, 3), calendar: berlin })?.streak).toBe(2);
    expect(spring.record(result(1, 1), { now: date(30, 0, 10, 3), calendar: berlin })?.streak).toBe(3);

    const autumn = new LearnProgress();
    autumn.record(result(1, 1), { now: date(24, 0, 10), calendar: berlin });
    expect(autumn.record(result(1, 1), { now: date(25, 23, 50), calendar: berlin })?.streak).toBe(2);
    expect(autumn.currentStreak(date(26, 23, 59), berlin)).toBe(2);
    expect(autumn.currentStreak(date(27, 0, 0), berlin)).toBe(0);
  });

  it("days follow the calendar's time zone, not UTC", () => {
    const utc = calendar('UTC');
    const auckland = calendar('Pacific/Auckland');
    // 10:00 and 12:00 UTC on 9 October are 23:00 on the 9th and 01:00 on the 10th in Auckland.
    const late = date(9, 10, 0, 10, utc);
    const early = date(9, 12, 0, 10, utc);
    const there = new LearnProgress();
    there.record(result(1, 1), { now: late, calendar: auckland });
    expect(there.record(result(1, 1), { now: early, calendar: auckland })?.streak).toBe(2);
    expect(there.xpToday(early, auckland)).toBe(40);

    const inUTC = new LearnProgress();
    inUTC.record(result(1, 1), { now: late, calendar: utc });
    expect(inUTC.record(result(1, 1), { now: early, calendar: utc })?.streak).toBe(1);
    expect(inUTC.xpToday(early, utc)).toBe(80);

    expect(daysTo({ year: 2026, month: 12, day: 31 }, { year: 2027, month: 1, day: 1 }, utc)).toBe(1);
    expect(dayOf(late, auckland)).toEqual({ year: 2026, month: 10, day: 9 });
    expect(dayOf(early, auckland)).toEqual({ year: 2026, month: 10, day: 10 });
  });

  it('a local date that goes back keeps the day', () => {
    // Two lessons in Berlin on consecutive days, then one an hour later in New York, where it is the day before.
    const ny = calendar('America/New_York');
    const progress = new LearnProgress();
    progress.setDailyGoal(50);
    progress.record(result(1, 1), { now: date(9, 18), calendar: berlin });
    const second = progress.record(result(1, 1), { now: date(10, 0, 30), calendar: berlin });
    expect(second?.streak).toBe(2);
    expect(second?.goalReached).toBe(false);
    const third = progress.record(result(1, 1), { now: date(10, 0, 30) + 3600_000, calendar: ny });
    expect(third?.streak).toBe(2);
    expect(third?.streakExtended).toBe(false);
    expect(third?.xpToday).toBe(80);
    expect(third?.goalReached).toBe(true);
    expect(progress.xpToday(date(10, 2), ny)).toBe(80);
    expect(progress.currentStreak(date(10, 2), ny)).toBe(2);
    const fourth = progress.record(result(1, 1), { now: date(10, 3), calendar: ny });
    expect(fourth?.goalReached).toBe(false); // the goal is reached once on that day
    expect(progress.longestStreak).toBe(2);
  });

  it('finished lessons are remembered and a run counts once', () => {
    const progress = new LearnProgress();
    const run = result(4, 4, { lesson: 'L7' });
    expect(progress.record(run, { now: date(9), calendar: berlin })).not.toBeNull();
    expect(progress.record(run, { now: date(9, 13), calendar: berlin })).toBeNull();
    expect(progress.totalXP).toBe(70);
    expect(progress.isCompleted('L7')).toBe(true);
    expect(progress.completedLessons).toEqual(new Set(['L7']));
    for (let i = 0; i < LearnProgress.rememberedRuns + 5; i++) {
      progress.record(result(1, 1), { now: date(9), calendar: berlin });
    }
    expect(progress.recentRuns.length).toBe(LearnProgress.rememberedRuns);
  });

  it('gems, freezes and course XP', () => {
    const progress = new LearnProgress();
    expect(progress.gems).toBe(0);
    const perfect = progress.record(result(4, 4), { courseID: 'es', now: date(1, 9), calendar: berlin });
    // 2 for the lesson, 3 for no mistake, 5 more for reaching the daily goal of 20 XP.
    expect(perfect?.gems).toBe(10);
    expect(progress.gems).toBe(10);
    expect(progress.xpInCourse('es')).toBe(70);
    expect(progress.xpInCourse('fr')).toBe(0);
    const flawed = progress.record(result(3, 4, { retry: 1 }), { courseID: 'fr', now: date(1, 10), calendar: berlin });
    expect(flawed?.gems).toBe(2);
    expect(progress.xpInCourse('fr')).toBe(55);
    expect(progress.totalXP).toBe(125);

    expect(progress.buyFreeze()).toBe(false); // not enough gems
    progress.addGems(100);
    expect(progress.buyFreeze()).toBe(true);
    expect(progress.buyFreeze()).toBe(true);
    expect(progress.buyFreeze()).toBe(false); // two at most
    expect(progress.freezes).toBe(2);
    expect(progress.gems).toBe(12 + 100 - 60);

    // A freeze covers a skipped day: lessons on the 1st and the 3rd keep the streak.
    const covered = progress.record(result(1, 1), { now: date(3, 9), calendar: berlin });
    expect(covered?.streak).toBe(2);
    expect(covered?.freezesUsed).toBe(1);
    expect(progress.freezes).toBe(1);
    // Two skipped days with one freeze left break it.
    expect(progress.currentStreak(date(6, 9), berlin)).toBe(0);
    expect(progress.currentStreak(date(5, 9), berlin)).toBe(2); // one skipped day, one freeze
    const broken = progress.record(result(1, 1), { now: date(6, 9), calendar: berlin });
    expect(broken?.streak).toBe(1);
    expect(broken?.freezesUsed).toBe(0);
    expect(progress.freezes).toBe(1); // a freeze that cannot save the streak stays
  });

  it('chests open once', () => {
    const progress = new LearnProgress();
    expect(progress.openChest('es.u01.k', 15)).toBe(true);
    expect(progress.openChest('es.u01.k', 15)).toBe(false);
    expect(progress.gems).toBe(15);
    expect(progress.isCompleted('es.u01.k')).toBe(true);
    progress.addGems(-5);
    expect(progress.gems).toBe(15);
  });

  it('older saves without gems load', () => {
    const progress = LearnProgress.fromJSON({ totalXP: 10, gems: -4, freezes: 9 });
    expect(progress.gems).toBe(0);
    expect(progress.freezes).toBe(LearnProgress.maxFreezes);
    expect(Object.keys(progress.courseXP).length).toBe(0);
    const saved = new LearnProgress();
    saved.addGems(7);
    saved.record(result(1, 1), { courseID: 'chess', now: date(1), calendar: berlin });
    expect(LearnProgress.fromJSON(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('a run without exercises counts nothing', () => {
    const progress = new LearnProgress();
    expect(progress.record(result(0, 0), { now: date(9), calendar: berlin })).toBeNull();
    expect(progress.totalXP).toBe(0);
    expect(progress.currentStreak(date(9), berlin)).toBe(0);
    expect(progress.completedLessons.size).toBe(0);
  });

  it('JSON round trip', () => {
    const progress = new LearnProgress();
    progress.setDailyGoal(50);
    progress.record(result(5, 6, { lesson: 'A' }), { now: date(8), calendar: berlin });
    progress.record(result(6, 6, { lesson: 'B' }), { now: date(9), calendar: berlin });
    const text = JSON.stringify(progress);
    expect(LearnProgress.fromJSON(JSON.parse(text))).toEqual(progress);
    expect(LearnProgress.fromJSON(JSON.parse(text)).equals(progress)).toBe(true);
  });

  it('older saves load with defaults', () => {
    const older = {
      totalXP: 340,
      streak: 4,
      completedLessons: ['L1', 'L2'],
      dailyGoal: 35,
      lastLessonDay: { year: 2026, month: 10, day: 8 },
    };
    const progress = LearnProgress.fromJSON(older);
    expect(progress.totalXP).toBe(340);
    expect(progress.dailyGoal).toBe(LearnProgress.defaultGoal);
    expect(progress.longestStreak).toBe(4);
    expect(progress.currentStreak(date(9), berlin)).toBe(4);
    expect(progress.completedLessons).toEqual(new Set(['L1', 'L2']));
    expect(progress.xpToday(date(9), berlin)).toBe(0);
    expect(progress.recentRuns).toEqual([]);
    expect(LearnProgress.fromJSON({})).toEqual(new LearnProgress());
    expect(LearnProgress.fromJSON({ totalXP: 'viel' }).totalXP).toBe(0);
  });

  // Extra cases for the tolerant decoder
  it('tolerates wrong types field by field and a day without all parts', () => {
    const p = LearnProgress.fromJSON({
      totalXP: 12,
      streak: 2.5,
      completedLessons: ['a', 3],
      recentRuns: 'x',
      xpDay: { year: 2026, month: 10 },
      lastLessonDay: { year: 2026, month: 10, day: 8 },
      courseXP: { es: 5, fr: 'x' },
      gems: null,
    });
    expect(p.totalXP).toBe(12);
    expect(p.streak).toBe(0);
    expect(p.completedLessons.size).toBe(0);
    expect(p.recentRuns).toEqual([]);
    expect(p.xpDay).toBeNull();
    expect(p.lastLessonDay).toEqual({ year: 2026, month: 10, day: 8 });
    expect(p.courseXP).toEqual({});
    expect(LearnProgress.fromJSON(null)).toEqual(new LearnProgress());
    expect(LearnProgress.fromJSON([1, 2])).toEqual(new LearnProgress());
  });

  it('the Swift field names are kept', () => {
    const progress = new LearnProgress();
    progress.record(result(4, 4, { lesson: 'X' }), { courseID: 'es', now: date(1), calendar: berlin });
    const json = JSON.parse(JSON.stringify(progress));
    expect(Object.keys(json).sort()).toEqual(
      ['completedLessons', 'courseXP', 'dailyGoal', 'freezes', 'gems', 'goalReachedDay', 'lastLessonDay', 'longestStreak', 'recentRuns', 'streak', 'totalXP', 'xpDay', 'xpOfDay'].sort(),
    );
    expect(json.lastLessonDay).toEqual({ year: 2026, month: 10, day: 1 });
  });
});

describe('LearnProgressStore', () => {
  it('loads what an older store saved', () => {
    const storage = new MemoryStore();
    storage.set(LearnProgressStore.key, JSON.stringify({ totalXP: 120, streak: 2, completedLessons: ['L9'] }));
    const store = new LearnProgressStore(storage);
    expect(store.progress.totalXP).toBe(120);
    expect(store.progress.isCompleted('L9')).toBe(true);

    store.setDailyGoal(100);
    const run = result(4, 4, { lesson: 'L10' });
    expect(store.record(run, { now: date(9), calendar: berlin })).not.toBeNull();
    expect(store.record(run, { now: date(9), calendar: berlin })).toBeNull();

    const reopened = new LearnProgressStore(storage);
    expect(reopened.progress).toEqual(store.progress);
    expect(reopened.progress.dailyGoal).toBe(100);
    expect(reopened.progress.totalXP).toBe(190);
    expect(reopened.progress.completedLessons).toEqual(new Set(['L9', 'L10']));

    storage.set(LearnProgressStore.key, 'kaputt');
    expect(new LearnProgressStore(storage).progress).toEqual(new LearnProgress());
    expect(LearnProgressStore.key).toBe('learn.progress');
  });

  it('chests, gems and freezes persist; listeners hear about changes', () => {
    const storage = new MemoryStore();
    const store = new LearnProgressStore(storage);
    let changes = 0;
    const stop = store.subscribe(() => (changes += 1));
    expect(store.openChest('c.u01.k', 20)).toBe(true);
    expect(store.openChest('c.u01.k', 20)).toBe(false);
    store.addGems(0);
    store.addGems(50);
    expect(store.buyFreeze()).toBe(true);
    expect(changes).toBe(3);
    stop();
    store.addGems(1);
    expect(changes).toBe(3);
    const reopened = new LearnProgressStore(storage);
    expect(reopened.progress.gems).toBe(20 + 50 - 30 + 1);
    expect(reopened.progress.freezes).toBe(1);
  });

  // LearnProgressSkillsTests
  it('a round on chosen goals earns XP and marks nothing as done', () => {
    const utc = calendar('UTC');
    const now = 1_780_000_000_000;
    const make = (id: string, session = 's1') =>
      lessonResult({ lessonID: id, sessionID: session, exerciseCount: 10, rightFirstTry: 9, rightOnRetry: 1 });
    const progress = new LearnProgress();
    const reward = progress.record(make('practice.es'), { courseID: 'es', completes: false, now, calendar: utc });
    expect(reward).not.toBeNull();
    expect(progress.totalXP).toBeGreaterThan(0);
    expect(progress.xpInCourse('es')).toBe(progress.totalXP);
    expect(progress.completedLessons.size).toBe(0);
    expect(progress.currentStreak(now, utc)).toBe(1);

    const other = new LearnProgress();
    expect(other.record(make('es.u01.l1'), { courseID: 'es', now, calendar: utc })).not.toBeNull();
    expect(other.completedLessons.has('es.u01.l1')).toBe(true);
    const xp = other.totalXP;
    expect(other.record(make('es.u01.l1'), { courseID: 'es', now, calendar: utc })).toBeNull(); // the same run is not counted twice
    expect(other.totalXP).toBe(xp);
    expect(make('x')).toEqual(make('x'));
    expect(make('x').outcomes).toEqual([]);
  });

  it('passing a unit test marks its steps done and stores them', () => {
    const storage = new MemoryStore();
    const store = new LearnProgressStore(storage);
    store.complete(['a', 'b']);
    expect(new LearnProgressStore(storage).progress.completedLessons).toEqual(new Set(['a', 'b']));
  });
});
