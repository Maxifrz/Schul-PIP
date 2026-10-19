import { describe, expect, it } from 'vitest';
import { Calendar, zoneCalendar } from '../../src/lib/learn/calendar';
import { Quest, QuestBoard, QuestEvent, QuestKind, bonusGems, dailyQuests, questDone, questTitle, secondsUntilNextDay } from '../../src/lib/learn/quests';

const berlin = zoneCalendar('Europe/Berlin');
const at = (day: number, hour = 12, month = 10, calendar: Calendar = berlin) => calendar.at(2026, month, day, hour);
const event = (o: Partial<QuestEvent> = {}): QuestEvent => ({ xp: 40, courseID: 'es', nodeKind: 'lesson', rightFirstTry: 8, exerciseCount: 10, ...o });
const quest = (kind: QuestKind, target: number, reward = 10): Quest => ({ id: 'a', kind, target, progress: 0, reward, claimed: false });

describe('QuestBoard', () => {
  it("a day's quests come from the date alone", () => {
    const day = { year: 2026, month: 10, day: 10 };
    const first = dailyQuests(day);
    expect(first).toEqual(dailyQuests(day));
    expect(first).toHaveLength(3);
    expect(new Set(first.map((q) => q.kind)).size).toBe(3);
    expect(['xp', 'lessons']).toContain(first[0].kind);
    const kinds = new Set<QuestKind>();
    const firsts = new Set<QuestKind>();
    for (let offset = 1; offset <= 28; offset++) {
      const quests = dailyQuests({ year: 2026, month: 11, day: offset });
      expect(new Set(quests.map((q) => q.kind)).size).toBe(3);
      expect(quests.every((q) => q.target > 0 && q.reward > 0 && questTitle(q) !== '')).toBe(true);
      expect(quests.some((q) => q.kind === 'days')).toBe(false);
      quests.forEach((q) => kinds.add(q.kind));
      firsts.add(quests[0].kind);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    expect(firsts).toEqual(new Set(['xp', 'lessons']));
    expect(new Set(dailyQuests(day).map((q) => q.id)).size).toBe(3);
  });

  it('titles', () => {
    expect(questTitle(quest('xp', 50))).toBe('Sammle 50 XP');
    expect(questTitle(quest('lessons', 1))).toBe('Schließe eine Lektion ab');
    expect(questTitle(quest('lessons', 3))).toBe('Schließe 3 Lektionen ab');
    expect(questTitle(quest('perfect', 1))).toBe('Eine Lektion ohne Fehler');
    expect(questTitle(quest('courses', 2))).toBe('Lerne in 2 verschiedenen Kursen');
    expect(questTitle(quest('days', 5))).toBe('Lerne an 5 Tagen');
  });

  it('rounds move the quests and finish them once', () => {
    const board = new QuestBoard();
    board.refresh(at(10), berlin);
    expect(board.daily).toHaveLength(3);
    expect(board.weekly).not.toBeNull();
    expect(board.dailyDone).toBe(0);
    let done = 0;
    let rounds = 0;
    while (board.dailyDone < 3 && rounds < 60) {
      const finished = board.apply(event({ xp: 100, courseID: rounds % 3 === 0 ? 'fr' : 'es', nodeKind: rounds % 2 === 0 ? 'practice' : 'lesson', rightFirstTry: 10, exerciseCount: 10 }), at(10), berlin);
      done += finished.filter((q) => q.id.startsWith('d.')).length;
      rounds++;
    }
    expect(board.dailyDone).toBe(3);
    expect(done).toBe(3);
    expect(board.apply(event({ xp: 100 }), at(10), berlin).filter((q) => q.id.startsWith('d.'))).toHaveLength(0);
  });

  it('nothing counts for a round without exercises', () => {
    const board = new QuestBoard();
    expect(board.apply(event({ xp: 20, rightFirstTry: 0, exerciseCount: 0 }), at(10), berlin)).toHaveLength(0);
    expect(board.daily.map((q) => q.progress)).toEqual([0, 0, 0]);
  });

  it('each kind counts what it says', () => {
    const progress = (kind: QuestKind, events: QuestEvent[]) => {
      const board = new QuestBoard();
      board.refresh(at(10), berlin);
      board.daily[0] = quest(kind, 99, 1);
      for (const e of events) board.apply(e, at(10), berlin);
      return board.daily[0].progress;
    };
    const perfect = event({ xp: 30, nodeKind: 'lesson', rightFirstTry: 10, exerciseCount: 10 });
    const flawed = event({ xp: 20, nodeKind: 'practice', rightFirstTry: 7, exerciseCount: 10 });
    expect(progress('xp', [perfect, flawed])).toBe(50);
    expect(progress('lessons', [perfect, flawed])).toBe(2);
    expect(progress('perfect', [perfect, flawed, perfect])).toBe(2);
    expect(progress('firstTry', [perfect, flawed])).toBe(17);
    expect(progress('practice', [perfect, flawed, flawed])).toBe(2);
    expect(progress('courses', [event({ courseID: 'es' }), event({ courseID: 'es' }), event({ courseID: 'fr' }), event({ courseID: null })])).toBe(2);
  });

  it('claiming pays once and the bonus needs all three', () => {
    const board = new QuestBoard();
    board.refresh(at(10), berlin);
    expect(board.claim(board.daily[0].id)).toBe(0);
    for (let i = 0; i < 40; i++) board.apply(event({ xp: 100, nodeKind: 'practice', rightFirstTry: 10, exerciseCount: 10 }), at(10), berlin);
    expect(board.daily.filter(questDone).length).toBeGreaterThanOrEqual(2);
    expect(board.hasUnclaimed).toBe(true);
    let paid = 0;
    for (const q of board.daily) {
      if (!questDone(q)) continue;
      const gems = board.claim(q.id);
      expect(gems).toBe(q.reward);
      expect(board.claim(q.id)).toBe(0);
      paid += gems;
    }
    expect(paid).toBeGreaterThan(0);
    expect(board.claimBonus()).toBe(board.allDailyClaimed ? bonusGems : 0);
    expect(board.claimBonus()).toBe(0);
    expect(board.claim('nonsense')).toBe(0);
  });

  it('a new day starts new quests and the old progress goes', () => {
    const board = new QuestBoard();
    board.apply(event({ xp: 60 }), at(10, 22), berlin);
    const before = board.daily.map((q) => q.id);
    expect(board.daily[0].progress).toBeGreaterThan(0);
    board.refresh(at(11, 1), berlin);
    expect(board.daily.map((q) => q.id)).not.toEqual(before);
    expect(board.daily.map((q) => q.progress)).toEqual([0, 0, 0]);
    expect(board.bonusClaimed).toBe(false);
    const same = board.clone();
    board.refresh(at(11, 23), berlin);
    expect(board).toEqual(same);
  });

  it('the weekly quest counts from Monday to Sunday', () => {
    const board = new QuestBoard();
    board.refresh(at(7), berlin);
    const lastWeek = board.weekly;
    expect(board.weekStart).toEqual({ year: 2026, month: 10, day: 5 });
    board.apply(event({ xp: 50 }), at(7), berlin);
    board.apply(event({ xp: 50 }), at(11), berlin);
    expect(board.weekly?.progress ?? 0).toBeGreaterThan(0);
    board.refresh(at(12, 8), berlin);
    expect(board.weekStart).toEqual({ year: 2026, month: 10, day: 12 });
    expect(board.weekly?.id).not.toBe(lastWeek?.id);
    expect(board.weekly?.progress).toBe(0);

    let days: QuestBoard | null = null;
    for (let week = 5; week <= 26; week += 7) {
      const attempt = new QuestBoard();
      attempt.refresh(at(week), berlin);
      if (attempt.weekly?.kind === 'days') {
        days = attempt;
        break;
      }
    }
    expect(days, 'one of the first weeks asks for days').not.toBeNull();
    const start = days!.weekStart!;
    for (let offset = 0; offset < 3; offset++) {
      const now = berlin.at(start.year, start.month, start.day + offset, 10);
      days!.apply(event(), now, berlin);
      days!.apply(event(), now + 3_600_000, berlin);
    }
    expect(days!.weekly?.progress).toBe(3);
  });

  it('the clock going back keeps the later day', () => {
    const board = new QuestBoard();
    board.refresh(at(10, 23), berlin);
    const ids = board.daily.map((q) => q.id);
    board.refresh(at(10, 23) + 3 * 3_600_000, zoneCalendar('America/Los_Angeles'));
    expect(board.daily.map((q) => q.id)).toEqual(ids);
    const later = new QuestBoard();
    later.refresh(at(12, 9), berlin);
    const kept = later.daily.map((q) => q.id);
    later.refresh(at(10, 9), berlin);
    expect(later.daily.map((q) => q.id)).toEqual(kept);
  });

  it('time until midnight across daylight saving time', () => {
    expect(secondsUntilNextDay(at(10, 23), berlin)).toBeCloseTo(3600, 0);
    expect(secondsUntilNextDay(at(25, 0), berlin)).toBeCloseTo(25 * 3600, 0);
  });

  it('saved boards round trip and older ones load', () => {
    const board = new QuestBoard();
    board.apply(event({ xp: 70 }), at(10), berlin);
    expect(QuestBoard.fromJSON(JSON.parse(JSON.stringify(board.toJSON())))).toEqual(board);
    const older = QuestBoard.fromJSON({});
    expect(older).toEqual(new QuestBoard());
    expect(older.daily).toHaveLength(0);
    expect(older.hasUnclaimed).toBe(false);
  });
});
