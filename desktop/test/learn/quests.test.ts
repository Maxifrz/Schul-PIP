import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type LearnDay, learnCalendar, weekdayOf } from '../../src/lib/learn/day';
import {
  ALL_QUEST_KINDS,
  type Quest,
  QuestBoard,
  type QuestEvent,
  type QuestKind,
  questEvent,
  questTitle,
  quest,
} from '../../src/lib/learn/quests';
import { MemoryStore, QuestStore } from '../../src/lib/learn/store';
import { at, calendar } from './kit';

const berlin = (): ReturnType<typeof calendar> => calendar('Europe/Berlin', 2);
const date = (day: number, hour = 12, month = 10, zone = 'Europe/Berlin') => at(calendar(zone, 2), 2026, month, day, hour);

const event = (o: Partial<QuestEvent> = {}): QuestEvent =>
  questEvent({ xp: 40, courseID: 'es', nodeKind: 'lesson', rightFirstTry: 8, exerciseCount: 10, ...o });

interface FixtureQuest {
  id: string;
  kind: QuestKind;
  reward: number;
  target: number;
  title: string;
}
const fixture = JSON.parse(readFileSync(new URL('../../../content/fixtures/quests.json', import.meta.url), 'utf8')) as {
  daily: { day: string; quests: FixtureQuest[] }[];
  weekly: { start: string; quest: FixtureQuest }[];
};
const parseDay = (text: string): LearnDay => {
  const [year, month, day] = text.split('-').map(Number);
  return { year, month, day };
};
const fromQuest = (q: Quest): FixtureQuest => ({ id: q.id, kind: q.kind, reward: q.reward, target: q.target, title: questTitle(q) });

describe('QuestBoard against the Swift fixture', () => {
  it('has the days and weeks that were exported', () => {
    expect(fixture.daily.length).toBe(120);
    expect(fixture.weekly.length).toBe(30);
  });

  it('dailyQuests match for 120 days', () => {
    for (const entry of fixture.daily) {
      expect(QuestBoard.dailyQuests(parseDay(entry.day)).map(fromQuest)).toEqual(entry.quests);
    }
  });

  it('weeklyQuest matches for every exported week', () => {
    for (const entry of fixture.weekly) {
      expect(fromQuest(QuestBoard.weeklyQuest(parseDay(entry.start)))).toEqual(entry.quest);
    }
  });

  it('the exported weeks start on Mondays and follow each other', () => {
    for (const entry of fixture.weekly) {
      expect(weekdayOf(parseDay(entry.start))).toBe(2);
    }
  });
});

describe('QuestBoard', () => {
  it("a day's quests come from the date alone", () => {
    const day = { year: 2026, month: 10, day: 10 };
    const first = QuestBoard.dailyQuests(day);
    expect(first).toEqual(QuestBoard.dailyQuests(day));
    expect(first.length).toBe(3);
    expect(new Set(first.map((q) => q.kind)).size).toBe(3);
    expect(['xp', 'lessons']).toContain(first[0].kind);
    const kinds = new Set<QuestKind>();
    const firsts = new Set<QuestKind>();
    for (let offset = 1; offset <= 28; offset++) {
      const quests = QuestBoard.dailyQuests({ year: 2026, month: 11, day: offset });
      expect(new Set(quests.map((q) => q.kind)).size).toBe(3);
      expect(quests.every((q) => q.target > 0 && q.reward > 0 && questTitle(q) !== '')).toBe(true);
      expect(quests.some((q) => q.kind === 'days')).toBe(false);
      quests.forEach((q) => kinds.add(q.kind));
      firsts.add(quests[0].kind);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5); // a month shows most kinds
    expect(firsts).toEqual(new Set(['xp', 'lessons']));
    expect(new Set(QuestBoard.dailyQuests(day).map((q) => q.id)).size).toBe(3);
  });

  it('titles', () => {
    expect(questTitle(quest('a', 'xp', 50, 10))).toBe('Sammle 50 XP');
    expect(questTitle(quest('a', 'lessons', 1, 10))).toBe('Schließe eine Lektion ab');
    expect(questTitle(quest('a', 'lessons', 3, 10))).toBe('Schließe 3 Lektionen ab');
    expect(questTitle(quest('a', 'perfect', 1, 10))).toBe('Eine Lektion ohne Fehler');
    expect(questTitle(quest('a', 'courses', 2, 10))).toBe('Lerne in 2 verschiedenen Kursen');
    expect(questTitle(quest('a', 'days', 5, 10))).toBe('Lerne an 5 Tagen');
    // Not in the Swift test:
    expect(questTitle(quest('a', 'perfect', 3, 10))).toBe('3 Lektionen ohne Fehler');
    expect(questTitle(quest('a', 'firstTry', 15, 10))).toBe('Beantworte 15 Aufgaben auf Anhieb richtig');
    expect(questTitle(quest('a', 'practice', 1, 10))).toBe('Schließe eine Übungsrunde ab');
    expect(questTitle(quest('a', 'practice', 2, 10))).toBe('Schließe 2 Übungsrunden ab');
  });

  it('rounds move the quests and finish them once', () => {
    const board = new QuestBoard();
    board.refresh(date(10), berlin());
    expect(board.daily.length).toBe(3);
    expect(board.weekly).not.toBeNull();
    expect(board.dailyDone).toBe(0);

    let done = 0;
    let rounds = 0;
    while (board.dailyDone < 3 && rounds < 60) {
      const finished = board.apply(
        event({ xp: 100, courseID: rounds % 3 === 0 ? 'fr' : 'es', nodeKind: rounds % 2 === 0 ? 'practice' : 'lesson', rightFirstTry: 10, exerciseCount: 10 }),
        date(10),
        berlin(),
      );
      done += finished.filter((q) => q.id.startsWith('d.')).length;
      rounds += 1;
    }
    expect(board.dailyDone).toBe(3); // rounds in two courses, practice and lessons finish every kind
    expect(done).toBe(3); // each quest is reported as finished exactly once
    expect(board.apply(event({ xp: 100 }), date(10), berlin()).filter((q) => q.id.startsWith('d.'))).toEqual([]);
  });

  it('nothing counts for a round without exercises', () => {
    const board = new QuestBoard();
    expect(board.apply(event({ xp: 20, rightFirstTry: 0, exerciseCount: 0 }), date(10), berlin())).toEqual([]);
    expect(board.daily.map((q) => q.progress)).toEqual([0, 0, 0]);
    expect(board.weekly?.progress).toBe(0);
  });

  it('each kind counts what it says', () => {
    const progress = (kind: QuestKind, events: QuestEvent[]): number => {
      const board = new QuestBoard();
      board.refresh(date(10), berlin());
      // Put a quest of this kind in place of the first one, through the persisted form like the Swift test.
      const json = board.toJSON() as { daily: Quest[] };
      json.daily[0] = quest('t', kind, 99, 1);
      const live = QuestBoard.fromJSON(JSON.parse(JSON.stringify(json)));
      for (const e of events) live.apply(e, date(10), berlin());
      return live.daily[0].progress;
    };
    const perfect = event({ xp: 30, nodeKind: 'lesson', rightFirstTry: 10, exerciseCount: 10 });
    const flawed = event({ xp: 20, nodeKind: 'practice', rightFirstTry: 7, exerciseCount: 10 });
    expect(progress('xp', [perfect, flawed])).toBe(50);
    expect(progress('lessons', [perfect, flawed])).toBe(2);
    expect(progress('perfect', [perfect, flawed, perfect])).toBe(2);
    expect(progress('firstTry', [perfect, flawed])).toBe(17);
    expect(progress('practice', [perfect, flawed, flawed])).toBe(2);
    expect(progress('courses', [event({ courseID: 'es' }), event({ courseID: 'es' }), event({ courseID: 'fr' }), event({ courseID: null })])).toBe(2);
    expect(progress('days', [perfect])).toBe(0);
  });

  it('claiming pays once and the bonus needs all three', () => {
    const board = new QuestBoard();
    board.refresh(date(10), berlin());
    expect(board.claim(board.daily[0].id)).toBe(0); // not done yet
    for (let i = 0; i < 40; i++) board.apply(event({ xp: 100, nodeKind: 'practice', rightFirstTry: 10, exerciseCount: 10 }), date(10), berlin());
    const ready = board.daily.filter((q) => q.progress >= q.target);
    expect(ready.length).toBeGreaterThanOrEqual(2);
    expect(board.hasUnclaimed).toBe(true);
    let paid = 0;
    for (const q of board.daily) {
      if (q.progress < q.target) continue;
      const gems = board.claim(q.id);
      expect(gems).toBe(q.reward);
      expect(board.claim(q.id)).toBe(0); // only once
      paid += gems;
    }
    expect(paid).toBeGreaterThan(0);
    expect(board.claimBonus()).toBe(board.allDailyClaimed ? QuestBoard.bonusGems : 0);
    expect(board.claimBonus()).toBe(0); // the bonus is paid once
    expect(board.claim('nonsense')).toBe(0);
  });

  it('a new day starts new quests and the old progress goes', () => {
    const board = new QuestBoard();
    board.apply(event({ xp: 60 }), date(10, 22), berlin());
    const before = board.daily.slice();
    expect(board.daily[0].progress).toBeGreaterThan(0);
    board.refresh(date(11, 1), berlin());
    expect(board.daily.map((q) => q.id)).not.toEqual(before.map((q) => q.id));
    expect(board.daily.map((q) => q.progress)).toEqual([0, 0, 0]);
    expect(board.bonusClaimed).toBe(false);
    // The same day again changes nothing.
    const same = board.clone();
    board.refresh(date(11, 23), berlin());
    expect(board).toEqual(same);
  });

  it('the weekly quest counts from Monday to Sunday', () => {
    const board = new QuestBoard();
    // 12 October 2026 is a Monday.
    board.refresh(date(7), berlin());
    const lastWeek = board.weekly;
    expect(board.weekStart).toEqual({ year: 2026, month: 10, day: 5 });
    board.apply(event({ xp: 50 }), date(7), berlin());
    board.apply(event({ xp: 50 }), date(11), berlin());
    expect(board.weekly?.progress ?? 0).toBeGreaterThan(0);
    board.refresh(date(12, 8), berlin());
    expect(board.weekStart).toEqual({ year: 2026, month: 10, day: 12 });
    expect(board.weekly?.id).not.toBe(lastWeek?.id);
    expect(board.weekly?.progress).toBe(0);

    // The days kind counts days, not rounds.
    let days = new QuestBoard();
    let found = false;
    for (let week = 5; week <= 26; week += 7) {
      const attempt = new QuestBoard();
      attempt.refresh(date(week), berlin());
      if (attempt.weekly?.kind === 'days') {
        days = attempt;
        found = true;
        break;
      }
    }
    expect(found).toBe(true); // one of the first weeks asks for days
    const start = days.weekStart!;
    for (let offset = 0; offset < 3; offset++) {
      const now = at(berlin(), start.year, start.month, start.day + offset, 10);
      days.apply(event(), now, berlin());
      days.apply(event(), now + 3600_000, berlin());
    }
    expect(days.weekly?.progress).toBe(3);
  });

  it('the first weekday of the calendar decides where the week starts', () => {
    const sunday = learnCalendar('Europe/Berlin', 1);
    const board = new QuestBoard();
    board.refresh(date(7), sunday);
    expect(board.weekStart).toEqual({ year: 2026, month: 10, day: 4 });
  });

  it('the clock going back keeps the later day', () => {
    const board = new QuestBoard();
    board.refresh(date(10, 23), berlin());
    const ids = board.daily.map((q) => q.id);
    board.refresh(date(10, 23) + 3 * 3600_000, calendar('America/Los_Angeles', 2));
    expect(board.daily.map((q) => q.id)).toEqual(ids); // it is still the 10th in Los Angeles at that moment; the board stays
    const later = new QuestBoard();
    later.refresh(date(12, 9), berlin());
    const kept = later.daily.map((q) => q.id);
    later.refresh(date(10, 9), berlin());
    expect(later.daily.map((q) => q.id)).toEqual(kept); // a date before the board's day does not bring old quests back
  });

  it('time until midnight across daylight saving time', () => {
    expect(QuestBoard.secondsUntilNextDay(date(10, 23), berlin())).toBeCloseTo(3600, 0);
    // On 25 October 2026 the clocks go back in Berlin: the day has 25 hours.
    expect(QuestBoard.secondsUntilNextDay(date(25, 0), berlin())).toBeCloseTo(25 * 3600, 0);
  });

  it('saved boards round trip and older ones load', () => {
    const board = new QuestBoard();
    board.apply(event({ xp: 70 }), date(10), berlin());
    const text = JSON.stringify(board);
    expect(QuestBoard.fromJSON(JSON.parse(text))).toEqual(board);
    const older = QuestBoard.fromJSON({});
    expect(older).toEqual(new QuestBoard());
    expect(older.daily).toEqual([]);
    expect(older.hasUnclaimed).toBe(false);
  });

  it('decoding is as strict as the Swift Codable where it is synthesized', () => {
    // A quest without "claimed" makes the whole list fall back; a broken weekly quest is dropped alone.
    const board = QuestBoard.fromJSON({
      daily: [{ id: 'x', kind: 'xp', target: 3, progress: 0, reward: 1 }],
      weekly: { id: 'w', kind: 'weird', target: 3, progress: 0, reward: 1, claimed: false },
      bonusClaimed: 'yes',
      weekXP: 12,
      weekDays: [{ year: 2026, month: 10, day: 5 }, { year: 2026, month: 10, day: 5 }],
    });
    expect(board.daily).toEqual([]);
    expect(board.weekly).toBeNull();
    expect(board.bonusClaimed).toBe(false);
    expect(board.weekXP).toBe(12);
    expect(board.weekDays).toEqual([{ year: 2026, month: 10, day: 5 }]);
    expect(ALL_QUEST_KINDS.length).toBe(7);
  });
});

describe('QuestStore', () => {
  it('keeps the board and pays once', () => {
    const storage = new MemoryStore();
    const cal = berlin();
    const store = new QuestStore(storage);
    store.refresh(date(10), cal);
    expect(store.board.daily.length).toBe(3);
    for (let i = 0; i < 40; i++) store.record(event({ xp: 100, nodeKind: 'practice', rightFirstTry: 10, exerciseCount: 10 }), date(10), cal);
    const q = store.board.daily.find((x) => x.progress >= x.target)!;
    expect(store.claim(q.id)).toBe(q.reward);
    expect(store.claim(q.id)).toBe(0);
    const reopened = new QuestStore(storage);
    expect(reopened.board).toEqual(store.board);
    expect(reopened.claim(q.id)).toBe(0); // a claimed quest stays claimed
    for (const other of reopened.board.daily) if (other.progress >= other.target) reopened.claim(other.id);
    if (reopened.board.bonusAvailable) {
      expect(reopened.claim(QuestStore.bonusID)).toBe(QuestBoard.bonusGems);
      expect(reopened.claim(QuestStore.bonusID)).toBe(0);
    }
    expect(QuestStore.key).toBe('learn.quests');
  });

  it('broken data starts an empty board', () => {
    const storage = new MemoryStore();
    storage.set(QuestStore.key, '{nope');
    expect(new QuestStore(storage).board).toEqual(new QuestBoard());
    storage.set(QuestStore.key, '[]');
    expect(new QuestStore(storage).board).toEqual(new QuestBoard());
  });
});
