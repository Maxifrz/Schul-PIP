// The rules that turn answers into a status. They are the whole definition of "mastered": no screen decides it.
// A port of Lernwerk/Services/Learn/Skills/SkillAssessor.swift (records, status, constants and the sentences).

import type { CourseNode } from '../course';
import { adding, dayOf, daysTo, type LearnCalendar, type LearnDay, sameDay } from '../day';
import {
  dArray,
  dBool,
  dDouble,
  dEnum,
  dInt,
  dLearnDay,
  dRecord,
  dSet,
  dString,
  FAIL,
  field,
  isObject,
  type JsonObject,
  required,
  strictObject,
} from '../decode';
import { initialEase, minimumEase, next as sm2Next, type Grade } from '../sm2Bridge';
import { sortedArray } from '../util';
import { type CompetenceLevel, CompetenceLevels, type Skill, type SkillMap } from './skill';

/** One answer of a round as the skills see it: the first attempt of an exercise. */
export interface ExerciseOutcome {
  exerciseID: string;
  skill: string;
  level: CompetenceLevel;
  /** Right on the first attempt. */
  right: boolean;
  /** A hint was shown before the answer. */
  helped: boolean;
}

/** Where a skill stands. Finishing a lesson only gets a skill to "worked"; everything above needs answers. */
export type SkillStatus =
  /** No step of it was opened. */
  | 'notStarted'
  /** A lesson was begun and not finished. */
  | 'started'
  /** A step was finished, but the answers do not yet show much. */
  | 'worked'
  /** Enough right answers to say the student is practising it well, short of the criteria for being reached. */
  | 'practicing'
  /** The criteria are met once: enough right answers at every level, and a good recent run. */
  | 'provisional'
  /** Reached, and confirmed on a later day. */
  | 'mastered'
  /** Reached before, and the review is due. */
  | 'due';

export const ALL_SKILL_STATUSES: readonly SkillStatus[] = ['notStarted', 'started', 'worked', 'practicing', 'provisional', 'mastered', 'due'];

export function skillStatusTitle(status: SkillStatus): string {
  switch (status) {
    case 'notStarted':
      return 'Noch nicht begonnen';
    case 'started':
      return 'Begonnen';
    case 'worked':
      return 'Bearbeitet';
    case 'practicing':
      return 'Geübt';
    case 'provisional':
      return 'Vorläufig erreicht';
    case 'mastered':
      return 'Beherrscht';
    case 'due':
      return 'Wiederholung fällig';
  }
}

/** Reached at least once: later skills may build on it. */
export function skillStatusIsReached(status: SkillStatus): boolean {
  return status === 'provisional' || status === 'mastered' || status === 'due';
}

const dLevel = dEnum(['recognise', 'recall', 'apply'] as const);

const dOutcome = strictObject<ExerciseOutcome>((o) => {
  const exerciseID = required(o, 'exerciseID', dString);
  const skill = required(o, 'skill', dString);
  const level = required(o, 'level', dLevel);
  const right = required(o, 'right', dBool);
  const helped = required(o, 'helped', dBool);
  if (exerciseID === FAIL || skill === FAIL || level === FAIL || right === FAIL || helped === FAIL) return FAIL;
  return { exerciseID, skill, level, right, helped };
});
export { dOutcome as decodeExerciseOutcome };

export class Tally {
  attempts = 0;
  /** First try, no hint. */
  right = 0;
  helped = 0;
  points = 0;
  /** The last eight answers, true for right on the first try without a hint. */
  recent: boolean[] = [];

  constructor(init: Partial<Pick<Tally, 'attempts' | 'right' | 'helped' | 'points' | 'recent'>> = {}) {
    Object.assign(this, init);
  }

  get recentAccuracy(): number | null {
    return this.recent.length === 0 ? null : this.recent.filter((x) => x).length / this.recent.length;
  }

  clone(): Tally {
    return new Tally({ attempts: this.attempts, right: this.right, helped: this.helped, points: this.points, recent: this.recent.slice() });
  }

  toJSON(): JsonObject {
    return { attempts: this.attempts, right: this.right, helped: this.helped, points: this.points, recent: this.recent.slice() };
  }

  /** The synthesized Codable: every key is required. */
  static decode = strictObject<Tally>((o) => {
    const attempts = required(o, 'attempts', dInt);
    const right = required(o, 'right', dInt);
    const helped = required(o, 'helped', dInt);
    const points = required(o, 'points', dDouble);
    const recent = required(o, 'recent', dArray(dBool));
    if (attempts === FAIL || right === FAIL || helped === FAIL || points === FAIL || recent === FAIL) return FAIL;
    return new Tally({ attempts, right, helped, points, recent });
  });
}

/** The spaced review of the skill: one step per day, from how that day's answers went. */
export class Schedule {
  repetitions = 0;
  intervalDays = 0;
  ease = initialEase;
  lapses = 0;
  /** The last day a review step was taken. */
  reviewDay: LearnDay | null = null;
  dueDay: LearnDay | null = null;
  /** The day the criteria were first met (again after a lapse). */
  provisionalDay: LearnDay | null = null;
  /** Good days after `provisionalDay`. */
  confirmations = 0;

  clone(): Schedule {
    const s = new Schedule();
    s.repetitions = this.repetitions;
    s.intervalDays = this.intervalDays;
    s.ease = this.ease;
    s.lapses = this.lapses;
    s.reviewDay = this.reviewDay && { ...this.reviewDay };
    s.dueDay = this.dueDay && { ...this.dueDay };
    s.provisionalDay = this.provisionalDay && { ...this.provisionalDay };
    s.confirmations = this.confirmations;
    return s;
  }

  toJSON(): JsonObject {
    const out: JsonObject = {
      repetitions: this.repetitions,
      intervalDays: this.intervalDays,
      ease: this.ease,
      lapses: this.lapses,
      confirmations: this.confirmations,
    };
    if (this.reviewDay) out.reviewDay = { ...this.reviewDay };
    if (this.dueDay) out.dueDay = { ...this.dueDay };
    if (this.provisionalDay) out.provisionalDay = { ...this.provisionalDay };
    return out;
  }

  static decode(json: unknown): Schedule | typeof FAIL {
    if (!isObject(json)) return FAIL;
    const s = new Schedule();
    s.repetitions = Math.max(0, field(json, 'repetitions', dInt, 0));
    s.intervalDays = Math.max(0, field(json, 'intervalDays', dInt, 0));
    s.ease = Math.max(minimumEase, field(json, 'ease', dDouble, initialEase));
    s.lapses = Math.max(0, field(json, 'lapses', dInt, 0));
    s.reviewDay = field(json, 'reviewDay', dLearnDay, null);
    s.dueDay = field(json, 'dueDay', dLearnDay, null);
    s.provisionalDay = field(json, 'provisionalDay', dLearnDay, null);
    s.confirmations = Math.max(0, field(json, 'confirmations', dInt, 0));
    return s;
  }
}

/** What one skill has shown so far. Plain values; the day and the calendar always come in as parameters. */
export class SkillRecord {
  static readonly Tally = Tally;
  static readonly Schedule = Schedule;

  /** Keyed by the level's raw value. */
  tallies: Record<string, Tally> = {};
  /** The last ten answers over all levels. */
  recent: boolean[] = [];
  started = new Set<string>();
  worked = new Set<string>();
  days: LearnDay[] = [];
  schedule = new Schedule();
  /** The day the counters below belong to, with the answers and the clean ones of that day, and the schedule as it
   * was before that day's review, so the review can be worked out again as the day's answers come in. */
  today: LearnDay | null = null;
  answersToday = 0;
  cleanToday = 0;
  scheduleBeforeToday = new Schedule();

  get provisionalDay(): LearnDay | null {
    return this.schedule.provisionalDay;
  }
  get confirmations(): number {
    return this.schedule.confirmations;
  }
  get dueDay(): LearnDay | null {
    return this.schedule.dueDay;
  }
  get lapses(): number {
    return this.schedule.lapses;
  }
  get repetitions(): number {
    return this.schedule.repetitions;
  }

  tally(level: CompetenceLevel): Tally {
    return this.tallies[level] ?? new Tally();
  }

  get attempts(): number {
    return Object.values(this.tallies).reduce((sum, t) => sum + t.attempts, 0);
  }

  get recentAccuracy(): number | null {
    return this.recent.length === 0 ? null : this.recent.filter((x) => x).length / this.recent.length;
  }

  clone(): SkillRecord {
    const r = new SkillRecord();
    for (const [k, v] of Object.entries(this.tallies)) r.tallies[k] = v.clone();
    r.recent = this.recent.slice();
    r.started = new Set(this.started);
    r.worked = new Set(this.worked);
    r.days = this.days.map((d) => ({ ...d }));
    r.schedule = this.schedule.clone();
    r.today = this.today && { ...this.today };
    r.answersToday = this.answersToday;
    r.cleanToday = this.cleanToday;
    r.scheduleBeforeToday = this.scheduleBeforeToday.clone();
    return r;
  }

  toJSON(): JsonObject {
    const tallies: JsonObject = {};
    for (const key of Object.keys(this.tallies).sort()) tallies[key] = this.tallies[key].toJSON();
    const out: JsonObject = {
      tallies,
      recent: this.recent.slice(),
      started: sortedArray(this.started),
      worked: sortedArray(this.worked),
      days: this.days.map((d) => ({ ...d })),
      schedule: this.schedule.toJSON(),
      answersToday: this.answersToday,
      cleanToday: this.cleanToday,
      scheduleBeforeToday: this.scheduleBeforeToday.toJSON(),
    };
    if (this.today) out.today = { ...this.today };
    return out;
  }

  /** A saved record from an older version lacks newer fields; each one falls back on its default. */
  static decode(json: unknown): SkillRecord | typeof FAIL {
    if (!isObject(json)) return FAIL;
    const r = new SkillRecord();
    r.tallies = field(json, 'tallies', dRecord(Tally.decode), {} as Record<string, Tally>);
    r.recent = field(json, 'recent', dArray(dBool), [] as boolean[]);
    r.started = field(json, 'started', dSet(dString), new Set<string>());
    r.worked = field(json, 'worked', dSet(dString), new Set<string>());
    r.days = field(json, 'days', dArray(dLearnDay), [] as LearnDay[]);
    r.schedule = field(json, 'schedule', Schedule.decode, new Schedule());
    r.today = field(json, 'today', dLearnDay, null);
    r.answersToday = Math.max(0, field(json, 'answersToday', dInt, 0));
    r.cleanToday = Math.max(0, field(json, 'cleanToday', dInt, 0));
    r.scheduleBeforeToday = field(json, 'scheduleBeforeToday', Schedule.decode, new Schedule());
    return r;
  }

  static fromJSON(json: unknown): SkillRecord {
    const r = SkillRecord.decode(json);
    return r === FAIL ? new SkillRecord() : r;
  }

  equals(other: SkillRecord): boolean {
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }
}

/** The day `count` days after a day; Swift: `LearnDay.adding(days:calendar:)`. */
export function addingDays(day: LearnDay, count: number, calendar: LearnCalendar): LearnDay {
  return adding(day, count, calendar);
}

/** The rules that turn answers into a status. They are the whole definition of "mastered": no screen decides it. */
export const SkillAssessor = {
  /** Points that count towards recognising when the skill also asks for more: recognising is the weakest proof. */
  recognitionCapWithHigherLevels: 4.0,
  recognitionCapAlone: 10.0,
  /** Points a skill needs in all: eight is four typed answers, or two typed and four recognised. */
  pointsForReached: 8.0,
  /** Points at each level above recognising that the skill asks for. */
  pointsPerHigherLevel: 2.0,
  /** A finished lesson and a few right answers: practising. */
  pointsForPractising: 4.0,
  attemptsForReached: 8,
  accuracyForReached: 0.75,
  /** A round counts as a review session with at least this many answers for the skill. */
  answersForSession: 3,
  /** The most points one round can add to one skill, so a long run of easy answers does not do it alone. */
  pointsPerRound: 12.0,
  weakAccuracy: 0.7,

  // MARK: Recording

  /** Counts a finished round. `node` is the step the round came from (null for a mixed practice round). `records`
   * is changed in place; `now` is epoch milliseconds. */
  record(
    outcomes: readonly ExerciseOutcome[],
    node: CourseNode | null,
    map: SkillMap,
    records: Record<string, SkillRecord>,
    now: number,
    calendar: LearnCalendar,
  ): void {
    const today = dayOf(now, calendar);
    const seen = new Set<string>();
    const unique = outcomes.filter((o) => {
      if (seen.has(o.exerciseID)) return false;
      seen.add(o.exerciseID);
      return map.skill(o.skill) !== undefined;
    });
    const bySkill = new Map<string, ExerciseOutcome[]>();
    for (const outcome of unique) {
      const list = bySkill.get(outcome.skill);
      if (list) list.push(outcome);
      else bySkill.set(outcome.skill, [outcome]);
    }
    for (const [id, list] of bySkill) {
      const skill = map.skill(id);
      if (!skill) continue;
      const record = records[id]?.clone() ?? new SkillRecord();
      let added = 0;
      for (const outcome of list) {
        const tally = record.tally(outcome.level).clone();
        tally.attempts += 1;
        const clean = outcome.right && !outcome.helped;
        if (outcome.helped) tally.helped += 1;
        if (clean) tally.right += 1;
        let gain = 0;
        if (outcome.right) gain = CompetenceLevels.weight(outcome.level) * (outcome.helped ? 0.5 : 1);
        gain = Math.min(gain, SkillAssessor.pointsPerRound - added);
        added += gain;
        tally.points += gain;
        tally.recent = [...tally.recent, clean].slice(-8);
        record.tallies[outcome.level] = tally;
        record.recent = [...record.recent, clean].slice(-10);
      }
      const lastDay = record.days.length > 0 ? record.days[record.days.length - 1] : null;
      if (!sameDay(lastDay, today)) record.days = [...record.days, today].slice(-60);
      if (node && skill.nodeIDs.includes(node.id)) record.worked.add(node.id);
      if (!sameDay(record.today, today)) {
        record.today = today;
        record.answersToday = 0;
        record.cleanToday = 0;
        record.scheduleBeforeToday = record.schedule.clone();
      }
      record.answersToday += list.length;
      record.cleanToday += list.filter((o) => o.right && !o.helped).length;
      review(record, today, calendar);
      if (record.schedule.provisionalDay === null && SkillAssessor.meetsCriteria(record, skill)) {
        record.schedule.provisionalDay = today;
      }
      records[id] = record;
    }
    if (node) {
      // A step finished with no answer for a skill still counts as worked on it.
      for (const skill of map.skills) {
        if (skill.nodeIDs.includes(node.id) && !bySkill.has(skill.id)) {
          const record = records[skill.id]?.clone() ?? new SkillRecord();
          record.worked.add(node.id);
          records[skill.id] = record;
        }
      }
    }
  },

  begin(node: CourseNode, map: SkillMap, records: Record<string, SkillRecord>): void {
    for (const skill of map.skills) {
      if (!skill.nodeIDs.includes(node.id)) continue;
      const record = records[skill.id]?.clone() ?? new SkillRecord();
      record.started.add(node.id);
      records[skill.id] = record;
    }
  },

  // MARK: Reading

  points(record: SkillRecord, skill: Skill): number {
    const higher = skill.levels.some((l) => CompetenceLevels.isHigher(l, 'recognise'));
    const cap = higher ? SkillAssessor.recognitionCapWithHigherLevels : SkillAssessor.recognitionCapAlone;
    return CompetenceLevels.all.reduce((sum, level) => {
      const points = record.tally(level).points;
      return sum + (level === 'recognise' ? Math.min(points, cap) : points);
    }, 0);
  },

  meetsCriteria(record: SkillRecord, skill: Skill): boolean {
    return SkillAssessor.missing(record, skill, false).length === 0;
  },

  /** Why the skill is not reached yet, in sentences the student can act on. Empty when the criteria are met. */
  missing(record: SkillRecord, skill: Skill, includeConfirmation = true): string[] {
    const reasons: string[] = [];
    const total = SkillAssessor.points(record, skill);
    if (record.attempts < SkillAssessor.attemptsForReached || total < SkillAssessor.pointsForReached) {
      reasons.push('Es fehlen noch richtige Antworten ohne Hilfe.');
    }
    for (const level of skill.levels) {
      if (CompetenceLevels.isHigher(level, 'recognise') && record.tally(level).points < SkillAssessor.pointsPerHigherLevel) {
        switch (level) {
          case 'recall':
            reasons.push('Du hast noch zu wenig aus dem Kopf getippt, ohne Auswahl.');
            break;
          case 'apply':
            reasons.push('Du hast es noch zu selten selbst angewendet.');
            break;
          case 'recognise':
            break;
        }
      }
    }
    const accuracy = record.recentAccuracy;
    if (accuracy !== null && accuracy < SkillAssessor.accuracyForReached) {
      reasons.push('In den letzten Antworten waren noch zu viele Fehler oder Hinweise.');
    }
    if (reasons.length === 0 && includeConfirmation && record.provisionalDay !== null && record.confirmations < 1) {
      reasons.push('Es fehlt noch eine gute Runde an einem anderen Tag.');
    }
    return reasons;
  },

  status(
    record: SkillRecord | null | undefined,
    skill: Skill,
    completed: ReadonlySet<string>,
    now: number,
    calendar: LearnCalendar,
  ): SkillStatus {
    const rec = record ?? new SkillRecord();
    const today = dayOf(now, calendar);
    const worked = rec.worked.size > 0 || skill.nodeIDs.some((id) => completed.has(id));
    if (rec.attempts === 0) {
      if (worked) return 'worked';
      return rec.started.size === 0 ? 'notStarted' : 'started';
    }
    if (rec.provisionalDay !== null) {
      const confirmed = rec.confirmations >= 1 && (rec.recentAccuracy ?? 0) >= SkillAssessor.accuracyForReached;
      const due = rec.dueDay;
      if (due && daysTo(due, today, calendar) >= 0) return 'due';
      return confirmed ? 'mastered' : 'provisional';
    }
    return SkillAssessor.points(rec, skill) >= SkillAssessor.pointsForPractising ? 'practicing' : 'worked';
  },

  /** Levels in which the answers are weak or missing, weakest first; what a targeted round leans on. */
  weakLevels(record: SkillRecord | null | undefined, skill: Skill): CompetenceLevel[] {
    const rec = record ?? new SkillRecord();
    const scored = skill.levels.map((level) => ({ level, accuracy: rec.tally(level).recentAccuracy ?? -1 }));
    return scored
      .filter((s) => s.accuracy < SkillAssessor.weakAccuracy)
      .map((s, offset) => ({ ...s, offset }))
      .sort((a, b) => a.accuracy - b.accuracy || a.offset - b.offset)
      .map((s) => s.level);
  },
};

/** One scheduling step per skill and day, worked out from all of the day's answers and worked out again as more
 * come in: a second round the same day adds evidence but does not push the review further away. A day with fewer
 * than three answers for the skill takes no step. */
function review(record: SkillRecord, today: LearnDay, calendar: LearnCalendar): void {
  if (record.answersToday < SkillAssessor.answersForSession) return;
  const schedule = record.scheduleBeforeToday.clone();
  const accuracy = record.cleanToday / record.answersToday;
  const grade: Grade = accuracy >= 0.85 ? 'good' : accuracy >= 0.6 ? 'hard' : 'again';
  const reached = schedule.provisionalDay;
  if (reached && !sameDay(reached, today) && grade === 'good') {
    // A later day with a good run confirms it; a middling one does not count for or against.
    schedule.confirmations += 1;
  }
  if (grade === 'again') {
    schedule.confirmations = 0;
    schedule.provisionalDay = null;
  }
  const state = sm2Next(
    { intervalDays: schedule.intervalDays, easeFactor: schedule.ease, repetitions: schedule.repetitions, lapses: schedule.lapses },
    grade,
  );
  schedule.intervalDays = state.intervalDays;
  schedule.ease = state.easeFactor;
  schedule.repetitions = state.repetitions;
  schedule.lapses = state.lapses;
  schedule.reviewDay = today;
  schedule.dueDay = adding(today, state.intervalDays, calendar);
  record.schedule = schedule;
}
