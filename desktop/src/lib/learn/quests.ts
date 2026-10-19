import { Calendar, LearnDay, daysBetween, dayOf, isDay, sameDay } from './calendar';
import type { NodeKind } from './course';
import { SplitMix } from '../pipRun';

/** What a quest asks for. */
export type QuestKind = 'xp' | 'lessons' | 'perfect' | 'firstTry' | 'courses' | 'practice' | 'days';

export interface Quest {
  id: string;
  kind: QuestKind;
  target: number;
  progress: number;
  /** Gems for claiming it. */
  reward: number;
  claimed: boolean;
}

export const questDone = (q: Quest): boolean => q.progress >= q.target;
export const questFraction = (q: Quest): number => (q.target === 0 ? 1 : Math.min(1, q.progress / q.target));

/** What the student reads. */
export function questTitle(q: Quest): string {
  const t = q.target;
  switch (q.kind) {
    case 'xp': return `Sammle ${t} XP`;
    case 'lessons': return t === 1 ? 'Schließe eine Lektion ab' : `Schließe ${t} Lektionen ab`;
    case 'perfect': return t === 1 ? 'Eine Lektion ohne Fehler' : `${t} Lektionen ohne Fehler`;
    case 'firstTry': return `Beantworte ${t} Aufgaben auf Anhieb richtig`;
    case 'courses': return `Lerne in ${t} verschiedenen Kursen`;
    case 'practice': return t === 1 ? 'Schließe eine Übungsrunde ab' : `Schließe ${t} Übungsrunden ab`;
    case 'days': return `Lerne an ${t} Tagen`;
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

const isPerfect = (e: QuestEvent) => e.exerciseCount > 0 && e.rightFirstTry === e.exerciseCount;
const isPractice = (e: QuestEvent) => e.nodeKind === 'practice' || e.nodeKind === 'checkpoint';

export const dailyCount = 3;
/** Gems for claiming all three of a day's quests. */
export const bonusGems = 20;
export const bonusID = 'bonus';

function variants(kind: QuestKind): Array<{ target: number; reward: number }> {
  switch (kind) {
    case 'xp': return [{ target: 30, reward: 10 }, { target: 50, reward: 15 }, { target: 80, reward: 20 }];
    case 'lessons': return [{ target: 2, reward: 10 }, { target: 3, reward: 15 }, { target: 4, reward: 20 }];
    case 'perfect': return [{ target: 1, reward: 15 }];
    case 'firstTry': return [{ target: 15, reward: 10 }, { target: 25, reward: 15 }];
    case 'courses': return [{ target: 2, reward: 15 }];
    case 'practice': return [{ target: 1, reward: 10 }];
    case 'days': return [{ target: 4, reward: 40 }, { target: 5, reward: 50 }];
  }
}

const dailyKinds: QuestKind[] = ['xp', 'lessons', 'perfect', 'firstTry', 'courses', 'practice'];
const seedFor = (day: LearnDay) => BigInt(day.year * 10_000 + day.month * 100 + day.day);
const pickIndex = (mix: SplitMix, count: number) => Number(mix.next() % BigInt(count));

export function dailyQuests(day: LearnDay): Quest[] {
  const mix = new SplitMix(seedFor(day));
  const pool = [...dailyKinds];
  // The first quest is always about XP or lessons, so every day has one that anything done counts for.
  const anchors: QuestKind[] = ['xp', 'lessons'];
  const anchor = anchors[pickIndex(mix, anchors.length)];
  pool.splice(pool.indexOf(anchor), 1);
  const kinds: QuestKind[] = [anchor];
  while (kinds.length < dailyCount && pool.length > 0) kinds.push(pool.splice(pickIndex(mix, pool.length), 1)[0]);
  return kinds.map((kind) => {
    const options = variants(kind);
    const option = options[pickIndex(mix, options.length)];
    return { id: `d.${day.year}-${day.month}-${day.day}.${kind}`, kind, target: option.target, progress: 0, reward: option.reward, claimed: false };
  });
}

export function weeklyQuest(start: LearnDay): Quest {
  const mix = new SplitMix(BigInt.asUintN(64, seedFor(start) + 7n));
  const kinds: QuestKind[] = ['days', 'xp', 'lessons'];
  const kind = kinds[pickIndex(mix, kinds.length)];
  let option: { target: number; reward: number };
  if (kind === 'xp') option = { target: 300, reward: 50 };
  else if (kind === 'lessons') option = { target: 12, reward: 50 };
  else option = variants('days')[pickIndex(mix, 2)];
  return { id: `w.${start.year}-${start.month}-${start.day}.${kind}`, kind, target: option.target, progress: 0, reward: option.reward, claimed: false };
}

/** The Monday of the week a moment is in. */
export function weekStartOf(now: number, calendar: Calendar): LearnDay {
  const today = dayOf(now, calendar);
  const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const back = (weekday + 6) % 7;
  return dayOf(calendar.at(today.year, today.month, today.day - back, 12), calendar);
}

/** Seconds until midnight, for the timer on the quest tile. */
export function secondsUntilNextDay(now: number, calendar: Calendar): number {
  const today = dayOf(now, calendar);
  return Math.max(0, (calendar.at(today.year, today.month, today.day + 1) - now) / 1000);
}

const dayKey = (d: LearnDay) => `${d.year}-${d.month}-${d.day}`;

/** Three quests a day and one for the week, chosen from the date alone, so a day's quests are the same on every launch and nothing needs a server. */
export class QuestBoard {
  day: LearnDay | null = null;
  daily: Quest[] = [];
  bonusClaimed = false;
  private coursesToday = new Set<string>();
  weekStart: LearnDay | null = null;
  weekly: Quest | null = null;
  private weekDays = new Set<string>();
  private weekXP = 0;
  private weekLessons = 0;

  clone(): QuestBoard {
    return QuestBoard.fromJSON(JSON.parse(JSON.stringify(this.toJSON())));
  }

  /** Starts a new day's quests and a new week's, when the day or the week has changed. A date that goes back (a changed time zone) keeps the quests of the later day. */
  refresh(now: number, calendar: Calendar): void {
    let today = dayOf(now, calendar);
    if (this.day && daysBetween(this.day, today, calendar) < 0) today = this.day;
    if (!sameDay(this.day, today)) {
      this.day = today;
      this.daily = dailyQuests(today);
      this.bonusClaimed = false;
      this.coursesToday = new Set();
    }
    let start = weekStartOf(now, calendar);
    if (this.weekStart && daysBetween(this.weekStart, start, calendar) < 0) start = this.weekStart;
    if (!sameDay(this.weekStart, start)) {
      this.weekStart = start;
      this.weekly = weeklyQuest(start);
      this.weekDays = new Set();
      this.weekXP = 0;
      this.weekLessons = 0;
    }
  }

  /** Counts a finished round; the quests that became done with it. */
  apply(event: QuestEvent, now: number, calendar: Calendar): Quest[] {
    this.refresh(now, calendar);
    if (event.exerciseCount <= 0) return [];
    const finished: Quest[] = [];
    if (event.courseID) this.coursesToday.add(event.courseID);
    for (const quest of this.daily) {
      const before = questDone(quest);
      quest.progress += this.gain(quest.kind, event, this.coursesToday.size, quest.progress);
      if (!before && questDone(quest)) finished.push({ ...quest });
    }
    const quest = this.weekly;
    if (quest) {
      const before = questDone(quest);
      if (this.day) this.weekDays.add(dayKey(this.day));
      this.weekXP += event.xp;
      this.weekLessons += 1;
      quest.progress = quest.kind === 'days' ? this.weekDays.size : quest.kind === 'xp' ? this.weekXP : this.weekLessons;
      if (!before && questDone(quest)) finished.push({ ...quest });
    }
    return finished;
  }

  /** How much a round moves a quest of this kind. `courses` is a count that is set, not added to. */
  private gain(kind: QuestKind, event: QuestEvent, courses: number, current: number): number {
    switch (kind) {
      case 'xp': return event.xp;
      case 'lessons': return 1;
      case 'perfect': return isPerfect(event) ? 1 : 0;
      case 'firstTry': return event.rightFirstTry;
      case 'courses': return Math.max(0, courses - current);
      case 'practice': return isPractice(event) ? 1 : 0;
      case 'days': return 0;
    }
  }

  get dailyDone(): number {
    return this.daily.filter(questDone).length;
  }
  get allDailyClaimed(): boolean {
    return this.daily.length > 0 && this.daily.every((q) => q.claimed);
  }
  get bonusAvailable(): boolean {
    return this.allDailyClaimed && !this.bonusClaimed;
  }
  get hasUnclaimed(): boolean {
    return this.daily.some((q) => questDone(q) && !q.claimed) || (!!this.weekly && questDone(this.weekly) && !this.weekly.claimed) || this.bonusAvailable;
  }

  /** Claims a finished quest; its gems, or 0 when it is not done or claimed already. */
  claim(id: string): number {
    const quest = this.daily.find((q) => q.id === id) ?? (this.weekly?.id === id ? this.weekly : undefined);
    if (!quest || !questDone(quest) || quest.claimed) return 0;
    quest.claimed = true;
    return quest.reward;
  }

  /** The gems for claiming all of the day's quests, once. */
  claimBonus(): number {
    if (!this.bonusAvailable) return 0;
    this.bonusClaimed = true;
    return bonusGems;
  }

  toJSON(): unknown {
    return {
      day: this.day, daily: this.daily, bonusClaimed: this.bonusClaimed, coursesToday: [...this.coursesToday], weekStart: this.weekStart, weekly: this.weekly,
      weekDays: [...this.weekDays], weekXP: this.weekXP, weekLessons: this.weekLessons,
    };
  }

  static fromJSON(raw: unknown): QuestBoard {
    const board = new QuestBoard();
    if (typeof raw !== 'object' || raw === null) return board;
    const r = raw as Record<string, unknown>;
    const quest = (v: unknown): Quest | null => {
      if (typeof v !== 'object' || v === null) return null;
      const q = v as Record<string, unknown>;
      const kinds: QuestKind[] = ['xp', 'lessons', 'perfect', 'firstTry', 'courses', 'practice', 'days'];
      if (typeof q.id !== 'string' || !kinds.includes(q.kind as QuestKind) || typeof q.target !== 'number' || typeof q.reward !== 'number') return null;
      return { id: q.id, kind: q.kind as QuestKind, target: q.target, progress: typeof q.progress === 'number' ? q.progress : 0, reward: q.reward, claimed: q.claimed === true };
    };
    board.day = isDay(r.day) ? { ...(r.day as LearnDay) } : null;
    board.daily = Array.isArray(r.daily) ? r.daily.map(quest).filter((q): q is Quest => q !== null) : [];
    board.bonusClaimed = r.bonusClaimed === true;
    board.coursesToday = new Set(Array.isArray(r.coursesToday) ? r.coursesToday.filter((x): x is string => typeof x === 'string') : []);
    board.weekStart = isDay(r.weekStart) ? { ...(r.weekStart as LearnDay) } : null;
    board.weekly = quest(r.weekly);
    board.weekDays = new Set(Array.isArray(r.weekDays) ? r.weekDays.filter((x): x is string => typeof x === 'string') : []);
    board.weekXP = typeof r.weekXP === 'number' ? r.weekXP : 0;
    board.weekLessons = typeof r.weekLessons === 'number' ? r.weekLessons : 0;
    return board;
  }
}
