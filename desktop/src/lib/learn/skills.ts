import { Calendar, LearnDay, addDays, dayOf, daysBetween, isDay, sameDay } from './calendar';
import { CourseNode, CourseProvider, PathStep, courseUnits, facetsOf } from './course';
import { CompetenceLevel, competenceLevels, levelOrder, levelWeight } from './exercise';
import type { ExerciseOutcome } from './session';
import * as sm2 from '../sm2';

/** A learning goal with its prerequisites. Ids are stable: unit id and facet key, so progress survives a new version as long as the course keeps its ids. */
export interface Skill {
  id: string;
  courseID: string;
  unitID: string;
  unitNumber: number;
  unitTitle: string;
  facet: string;
  title: string;
  goal: string;
  levels: CompetenceLevel[];
  /** Skills that should be reached (at least provisionally) first. Soft: they steer what is suggested, never lock a step. */
  prerequisites: string[];
  /** The lessons, the practice round and the checkpoint of the unit: the steps that show evidence of the skill. */
  nodeIDs: string[];
}

/** The skills of a course and how they depend on each other. */
export class SkillMap {
  constructor(readonly courseID: string, readonly skills: Skill[]) {}

  skill(id: string): Skill | undefined {
    return this.skills.find((s) => s.id === id);
  }

  skillsInUnit(unitID: string): Skill[] {
    return this.skills.filter((s) => s.unitID === unitID);
  }

  /** Skills that need this one. */
  dependents(id: string): Skill[] {
    return this.skills.filter((s) => s.prerequisites.includes(id));
  }

  /** Problems of the structure itself: a course with any of them is not shipped. */
  problems(): string[] {
    const problems: string[] = [];
    const ids = new Set(this.skills.map((s) => s.id));
    if (ids.size !== this.skills.length) problems.push('duplicate skill ids');
    for (const skill of this.skills) {
      if (skill.levels.length === 0) problems.push(`${skill.id}: no levels`);
      if (skill.nodeIDs.length === 0) problems.push(`${skill.id}: no steps`);
      for (const prerequisite of skill.prerequisites) if (!ids.has(prerequisite)) problems.push(`${skill.id}: unknown prerequisite ${prerequisite}`);
      if (skill.prerequisites.includes(skill.id)) problems.push(`${skill.id}: needs itself`);
    }
    // Cycles: a depth-first walk that meets a skill on its own way down.
    const state = new Map<string, number>();
    const visit = (id: string): boolean => {
      if (state.get(id) === 2) return true;
      if (state.get(id) === 1) return false;
      state.set(id, 1);
      for (const next of this.skill(id)?.prerequisites ?? []) if (ids.has(next) && !visit(next)) return false;
      state.set(id, 2);
      return true;
    };
    for (const skill of this.skills) {
      if (!visit(skill.id)) {
        problems.push(`${skill.id}: prerequisites form a cycle`);
        break;
      }
    }
    return problems;
  }

  static build(provider: CourseProvider): SkillMap {
    const course = provider.course;
    const skills: Skill[] = [];
    let previous: Record<string, string> = {};
    for (const unit of courseUnits(course)) {
      const facets = facetsOf(provider, unit);
      const nodes = unit.nodes.filter((n) => n.kind !== 'chest').map((n) => n.id);
      const current: Record<string, string> = {};
      for (const facet of facets) {
        const id = `${unit.id}.${facet.key}`;
        current[facet.key] = id;
        const prerequisites = (facet.requires ?? []).map((r) => `${unit.id}.${r}`);
        if (facet.after && previous[facet.after]) prerequisites.push(previous[facet.after]);
        skills.push({
          id, courseID: course.id, unitID: unit.id, unitNumber: unit.number, unitTitle: unit.title, facet: facet.key, title: facet.title,
          goal: facet.goal, levels: facet.levels, prerequisites, nodeIDs: nodes,
        });
      }
      previous = current;
    }
    return new SkillMap(course.id, skills);
  }
}

const maps = new Map<string, SkillMap>();
/** The skill maps of the shipped courses, built once. */
export function skillMapOf(provider: CourseProvider): SkillMap {
  let map = maps.get(provider.course.id);
  if (!map) {
    map = SkillMap.build(provider);
    maps.set(provider.course.id, map);
  }
  return map;
}

/** Where a skill stands. Finishing a lesson only gets a skill to "worked"; everything above needs answers. */
export type SkillStatus = 'notStarted' | 'started' | 'worked' | 'practicing' | 'provisional' | 'mastered' | 'due';

export const skillStatusTitle = (status: SkillStatus): string =>
  ({
    notStarted: 'Noch nicht begonnen', started: 'Begonnen', worked: 'Bearbeitet', practicing: 'Geübt', provisional: 'Vorläufig erreicht',
    mastered: 'Beherrscht', due: 'Wiederholung fällig',
  })[status];

/** Reached at least once: later skills may build on it. */
export const isReached = (status: SkillStatus): boolean => status === 'provisional' || status === 'mastered' || status === 'due';

export interface Tally {
  attempts: number;
  /** First try, no hint. */
  right: number;
  helped: number;
  points: number;
  /** The last eight answers, true for right on the first try without a hint. */
  recent: boolean[];
}

export const emptyTally = (): Tally => ({ attempts: 0, right: 0, helped: 0, points: 0, recent: [] });
export const recentAccuracy = (recent: boolean[]): number | null => (recent.length === 0 ? null : recent.filter(Boolean).length / recent.length);

/** The spaced review of the skill: one step per day, from how that day's answers went. */
export interface Schedule {
  repetitions: number;
  intervalDays: number;
  ease: number;
  lapses: number;
  /** The last day a review step was taken. */
  reviewDay: LearnDay | null;
  dueDay: LearnDay | null;
  /** The day the criteria were first met (again after a lapse). */
  provisionalDay: LearnDay | null;
  /** Good days after `provisionalDay`. */
  confirmations: number;
}

export const emptySchedule = (): Schedule => ({
  repetitions: 0, intervalDays: 0, ease: sm2.initialEase, lapses: 0, reviewDay: null, dueDay: null, provisionalDay: null, confirmations: 0,
});

/** What one skill has shown so far. */
export interface SkillRecord {
  tallies: Partial<Record<CompetenceLevel, Tally>>;
  /** The last ten answers over all levels. */
  recent: boolean[];
  started: string[];
  worked: string[];
  days: LearnDay[];
  schedule: Schedule;
  /** The day the counters below belong to, with the answers and the clean ones of that day, and the schedule as it was before that day's review, so the review can be worked out again as the day's answers come in. */
  today: LearnDay | null;
  answersToday: number;
  cleanToday: number;
  scheduleBeforeToday: Schedule;
}

export const emptyRecord = (): SkillRecord => ({
  tallies: {}, recent: [], started: [], worked: [], days: [], schedule: emptySchedule(), today: null, answersToday: 0, cleanToday: 0, scheduleBeforeToday: emptySchedule(),
});

export const tallyOf = (record: SkillRecord, level: CompetenceLevel): Tally => record.tallies[level] ?? emptyTally();
export const attemptsOf = (record: SkillRecord): number => Object.values(record.tallies).reduce((sum, t) => sum + (t?.attempts ?? 0), 0);
export const recordAccuracy = (record: SkillRecord): number | null => recentAccuracy(record.recent);

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const bools = (v: unknown): boolean[] => (Array.isArray(v) ? v.filter((x): x is boolean => typeof x === 'boolean') : []);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const dayOrNull = (v: unknown): LearnDay | null => (isDay(v) ? { year: v.year, month: v.month, day: v.day } : null);

function decodeSchedule(raw: unknown): Schedule {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    repetitions: Math.max(0, num(r.repetitions, 0)), intervalDays: Math.max(0, num(r.intervalDays, 0)),
    ease: Math.max(sm2.minimumEase, num(r.ease, sm2.initialEase)), lapses: Math.max(0, num(r.lapses, 0)), reviewDay: dayOrNull(r.reviewDay),
    dueDay: dayOrNull(r.dueDay), provisionalDay: dayOrNull(r.provisionalDay), confirmations: Math.max(0, num(r.confirmations, 0)),
  };
}

/** A saved record from an older version lacks newer fields; each one falls back on its default. */
export function decodeRecord(raw: unknown): SkillRecord {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const record = emptyRecord();
  if (typeof r.tallies === 'object' && r.tallies !== null) {
    for (const level of competenceLevels) {
      const t = (r.tallies as Record<string, unknown>)[level];
      if (typeof t === 'object' && t !== null) {
        const tt = t as Record<string, unknown>;
        record.tallies[level] = { attempts: num(tt.attempts, 0), right: num(tt.right, 0), helped: num(tt.helped, 0), points: num(tt.points, 0), recent: bools(tt.recent) };
      }
    }
  }
  record.recent = bools(r.recent);
  record.started = strings(r.started);
  record.worked = strings(r.worked);
  record.days = Array.isArray(r.days) ? r.days.map(dayOrNull).filter((d): d is LearnDay => d !== null) : [];
  record.schedule = decodeSchedule(r.schedule);
  record.today = dayOrNull(r.today);
  record.answersToday = Math.max(0, num(r.answersToday, 0));
  record.cleanToday = Math.max(0, num(r.cleanToday, 0));
  record.scheduleBeforeToday = decodeSchedule(r.scheduleBeforeToday);
  return record;
}

/** Every skill's record, saved as one value. A record whose skill no longer exists is simply never read. */
export type SkillRecords = Record<string, SkillRecord>;

export function decodeRecords(raw: unknown): SkillRecords {
  const out: SkillRecords = {};
  const records = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).records : null;
  if (typeof records === 'object' && records !== null) for (const [id, value] of Object.entries(records)) out[id] = decodeRecord(value);
  return out;
}

const addUnique = (list: string[], value: string) => {
  if (!list.includes(value)) list.push(value);
};
const suffix = <T>(list: T[], count: number) => list.slice(Math.max(0, list.length - count));

/** The rules that turn answers into a status. They are the whole definition of "mastered": no screen decides it. */
export const SkillAssessor = {
  /** Points that count towards recognising when the skill also asks for more: recognising is the weakest proof. */
  recognitionCapWithHigherLevels: 4,
  recognitionCapAlone: 10,
  /** Points a skill needs in all: eight is four typed answers, or two typed and four recognised. */
  pointsForReached: 8,
  /** Points at each level above recognising that the skill asks for. */
  pointsPerHigherLevel: 2,
  /** A finished lesson and a few right answers: practising. */
  pointsForPractising: 4,
  attemptsForReached: 8,
  accuracyForReached: 0.75,
  /** A round counts as a review session with at least this many answers for the skill. */
  answersForSession: 3,
  /** The most points one round can add to one skill. */
  pointsPerRound: 12,
  weakAccuracy: 0.7,

  /** Counts a finished round. `node` is the step the round came from (null for a mixed practice round). */
  record(outcomes: ExerciseOutcome[], node: CourseNode | null, map: SkillMap, records: SkillRecords, now: number, calendar: Calendar): void {
    const today = dayOf(now, calendar);
    const seen = new Set<string>();
    const unique = outcomes.filter((o) => !seen.has(o.exerciseID) && !!seen.add(o.exerciseID) && map.skill(o.skill) !== undefined);
    const bySkill = new Map<string, ExerciseOutcome[]>();
    for (const outcome of unique) bySkill.set(outcome.skill, [...(bySkill.get(outcome.skill) ?? []), outcome]);
    for (const [id, list] of bySkill) {
      const skill = map.skill(id);
      if (!skill) continue;
      const record = records[id] ?? emptyRecord();
      let added = 0;
      for (const outcome of list) {
        const tally = { ...tallyOf(record, outcome.level) };
        tally.attempts += 1;
        const clean = outcome.right && !outcome.helped;
        if (outcome.helped) tally.helped += 1;
        if (clean) tally.right += 1;
        let gain = 0;
        if (outcome.right) gain = levelWeight(outcome.level) * (outcome.helped ? 0.5 : 1);
        gain = Math.min(gain, SkillAssessor.pointsPerRound - added);
        added += gain;
        tally.points += gain;
        tally.recent = suffix([...tally.recent, clean], 8);
        record.tallies[outcome.level] = tally;
        record.recent = suffix([...record.recent, clean], 10);
      }
      if (!sameDay(record.days[record.days.length - 1], today)) record.days = suffix([...record.days, today], 60);
      if (node && skill.nodeIDs.includes(node.id)) addUnique(record.worked, node.id);
      if (!sameDay(record.today, today)) {
        record.today = today;
        record.answersToday = 0;
        record.cleanToday = 0;
        record.scheduleBeforeToday = { ...record.schedule };
      }
      record.answersToday += list.length;
      record.cleanToday += list.filter((o) => o.right && !o.helped).length;
      review(record, today, calendar);
      if (record.schedule.provisionalDay === null && SkillAssessor.meetsCriteria(record, skill)) record.schedule.provisionalDay = today;
      records[id] = record;
    }
    if (node) {
      // A step finished with no answer for a skill still counts as worked on it.
      for (const skill of map.skills) {
        if (skill.nodeIDs.includes(node.id) && !bySkill.has(skill.id)) {
          const record = records[skill.id] ?? emptyRecord();
          addUnique(record.worked, node.id);
          records[skill.id] = record;
        }
      }
    }
  },

  begin(node: CourseNode, map: SkillMap, records: SkillRecords): void {
    for (const skill of map.skills) {
      if (skill.nodeIDs.includes(node.id)) {
        const record = records[skill.id] ?? emptyRecord();
        addUnique(record.started, node.id);
        records[skill.id] = record;
      }
    }
  },

  points(record: SkillRecord, skill: Skill): number {
    const higher = skill.levels.some((l) => levelOrder(l) > 0);
    const cap = higher ? SkillAssessor.recognitionCapWithHigherLevels : SkillAssessor.recognitionCapAlone;
    return competenceLevels.reduce((sum, level) => {
      const points = tallyOf(record, level).points;
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
    if (attemptsOf(record) < SkillAssessor.attemptsForReached || total < SkillAssessor.pointsForReached) reasons.push('Es fehlen noch richtige Antworten ohne Hilfe.');
    for (const level of skill.levels) {
      if (levelOrder(level) > 0 && tallyOf(record, level).points < SkillAssessor.pointsPerHigherLevel) {
        if (level === 'recall') reasons.push('Du hast noch zu wenig aus dem Kopf getippt, ohne Auswahl.');
        else if (level === 'apply') reasons.push('Du hast es noch zu selten selbst angewendet.');
      }
    }
    const accuracy = recordAccuracy(record);
    if (accuracy !== null && accuracy < SkillAssessor.accuracyForReached) reasons.push('In den letzten Antworten waren noch zu viele Fehler oder Hinweise.');
    if (reasons.length === 0 && includeConfirmation && record.schedule.provisionalDay !== null && record.schedule.confirmations < 1) {
      reasons.push('Es fehlt noch eine gute Runde an einem anderen Tag.');
    }
    return reasons;
  },

  status(record: SkillRecord | undefined, skill: Skill, completed: Set<string>, now: number, calendar: Calendar): SkillStatus {
    const rec = record ?? emptyRecord();
    const today = dayOf(now, calendar);
    const worked = rec.worked.length > 0 || skill.nodeIDs.some((id) => completed.has(id));
    if (attemptsOf(rec) === 0) {
      if (worked) return 'worked';
      return rec.started.length === 0 ? 'notStarted' : 'started';
    }
    if (rec.schedule.provisionalDay !== null) {
      const confirmed = rec.schedule.confirmations >= 1 && (recordAccuracy(rec) ?? 0) >= SkillAssessor.accuracyForReached;
      const due = rec.schedule.dueDay;
      if (due && daysBetween(due, today, calendar) >= 0) return 'due';
      return confirmed ? 'mastered' : 'provisional';
    }
    return SkillAssessor.points(rec, skill) >= SkillAssessor.pointsForPractising ? 'practicing' : 'worked';
  },

  /** Levels in which the answers are weak or missing, weakest first; what a targeted round leans on. */
  weakLevels(record: SkillRecord | undefined, skill: Skill): CompetenceLevel[] {
    const rec = record ?? emptyRecord();
    return skill.levels
      .map((level) => ({ level, accuracy: recentAccuracy(tallyOf(rec, level).recent) ?? -1 }))
      .filter((s) => s.accuracy < SkillAssessor.weakAccuracy)
      .sort((a, b) => a.accuracy - b.accuracy)
      .map((s) => s.level);
  },
};

/** One scheduling step per skill and day, worked out from all of the day's answers and worked out again as more come in. A day with fewer than three answers for the skill takes no step. */
function review(record: SkillRecord, today: LearnDay, calendar: Calendar): void {
  if (record.answersToday < SkillAssessor.answersForSession) return;
  const schedule = { ...record.scheduleBeforeToday };
  const accuracy = record.cleanToday / record.answersToday;
  const grade: sm2.Grade = accuracy >= 0.85 ? 'good' : accuracy >= 0.6 ? 'hard' : 'again';
  if (schedule.provisionalDay && !sameDay(schedule.provisionalDay, today) && grade === 'good') {
    // A later day with a good run confirms it; a middling one does not count for or against.
    schedule.confirmations += 1;
  }
  if (grade === 'again') {
    schedule.confirmations = 0;
    schedule.provisionalDay = null;
  }
  const state = sm2.next({ intervalDays: schedule.intervalDays, easeFactor: schedule.ease, repetitions: schedule.repetitions, lapses: schedule.lapses }, grade);
  schedule.intervalDays = state.intervalDays;
  schedule.ease = state.easeFactor;
  schedule.repetitions = state.repetitions;
  schedule.lapses = state.lapses;
  schedule.reviewDay = today;
  schedule.dueDay = addDays(today, state.intervalDays, calendar);
  record.schedule = schedule;
}

/** How a finished step of the path stands with the goals behind it. */
export type NodeMastery = 'none' | 'worked' | 'sits' | 'due';

/** The goals of a unit that are reached, for the unit's banner. */
export interface UnitMastery {
  reached: number;
  total: number;
  due: number;
}

export const unitMasteryText = (m: UnitMastery): string => {
  const base = `${m.reached} von ${m.total} erreicht`;
  return m.due > 0 ? `${base}, ${m.due} fällig` : base;
};

/** What the path shows of the skills: the map of the course and where each goal stands today. */
export class PathMastery {
  constructor(readonly map: SkillMap, readonly statuses: Record<string, SkillStatus>) {}

  static from(map: SkillMap, records: SkillRecords, completed: Set<string>, now: number, calendar: Calendar): PathMastery {
    const statuses: Record<string, SkillStatus> = {};
    for (const skill of map.skills) statuses[skill.id] = SkillAssessor.status(records[skill.id], skill, completed, now, calendar);
    return new PathMastery(map, statuses);
  }

  unit(unitID: string): UnitMastery {
    const skills = this.map.skillsInUnit(unitID);
    const states = skills.map((s) => this.statuses[s.id] ?? 'notStarted');
    return { reached: states.filter(isReached).length, total: skills.length, due: states.filter((s) => s === 'due').length };
  }

  node(step: PathStep): NodeMastery {
    if (step.state !== 'done') return 'none';
    const skills = this.map.skills.filter((s) => s.nodeIDs.includes(step.node.id));
    if (skills.length === 0) return 'none';
    const states = skills.map((s) => this.statuses[s.id] ?? 'notStarted');
    if (states.includes('due')) return 'due';
    return states.every((s) => s === 'provisional' || s === 'mastered') ? 'sits' : 'worked';
  }
}
