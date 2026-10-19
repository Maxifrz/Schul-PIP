import { Calendar, dayOf, daysBetween } from './calendar';
import { CoursePath, CourseProvider, PathStep, PathUnit, nodeWithID, lessonExercises, CourseUnit } from './course';
import { LearnExercise } from './exercise';
import { arrange } from './exercises';
import { LearnRandom } from './random';
import { LessonResult, accuracyOf } from './session';
import { Skill, SkillAssessor, SkillMap, SkillRecord, SkillRecords, isReached, tallyOf, recentAccuracy, attemptsOf, recordAccuracy } from './skills';

/** What the Lernen tab suggests next, and why. */
export interface Recommendation {
  /** review: skills reached before are due again; practice: skills that are shaky; step: the next step of the path; finished: nothing is left. */
  kind: 'review' | 'practice' | 'step' | 'finished';
  title: string;
  reason: string;
  skillIDs: string[];
  step: PathStep | null;
}

export const mostSkillsPerRound = 3;

/** Weak: some answers exist and the recent ones were mostly wrong or helped. */
export function isWeak(record: SkillRecord | undefined, _skill: Skill): boolean {
  if (!record || attemptsOf(record) < 3) return false;
  const accuracy = recordAccuracy(record);
  return accuracy !== null && accuracy < SkillAssessor.weakAccuracy;
}

export function stepTitle(step: PathStep, units: PathUnit[]): string {
  const unit = units.find((u) => u.steps.some((s) => s.node.id === step.node.id));
  const name = { lesson: `Lektion ${step.node.index}`, practice: 'der Übungsrunde', checkpoint: 'dem Einheitentest', chest: 'der Truhe' }[step.node.kind];
  return unit ? `${name} · ${unit.unit.title}` : name;
}

/** Chooses the next sensible thing from the path and the skills. Nothing here locks a step: the path stays as it is, and the advice says when another round would help more than the next lesson. */
export function recommend(map: SkillMap, records: SkillRecords, units: PathUnit[], completed: Set<string>, now: number, calendar: Calendar): Recommendation {
  const status = (skill: Skill) => SkillAssessor.status(records[skill.id], skill, completed, now, calendar);
  const today = dayOf(now, calendar);
  const step = CoursePath.current(units) ?? null;

  // 1. Reviews that are due, the longest overdue first.
  const overdue = (skill: Skill) => {
    const due = records[skill.id]?.schedule.dueDay;
    return due ? daysBetween(due, today, calendar) : 0;
  };
  const due = map.skills.filter((s) => status(s) === 'due').sort((a, b) => overdue(b) - overdue(a) || (a.id < b.id ? -1 : 1));
  if (due.length > 0) {
    const chosen = due.slice(0, mostSkillsPerRound);
    return {
      kind: 'review', title: `Wiederholen: ${chosen.map((s) => s.title).join(', ')}`,
      reason: due.length === 1 ? 'Das hast du schon gekonnt. Jetzt festigst du es.' : 'Das hast du schon gekonnt. Jetzt festigst du es, bevor es verblasst.',
      skillIDs: chosen.map((s) => s.id), step: null,
    };
  }

  // 2. What the next step builds on and the student does not yet do well.
  const unit = step ? units.find((u) => u.steps.some((s) => s.node.id === step.node.id)) : undefined;
  if (step && unit) {
    const weak = map.skillsInUnit(unit.unit.id).flatMap((s) => s.prerequisites.map((p) => map.skill(p)).filter((p): p is Skill => !!p)).filter((p) => {
      const state = status(p);
      return !isReached(state) && state !== 'notStarted' && isWeak(records[p.id], p);
    });
    const seen = new Set<string>();
    const unique = weak.filter((s) => !seen.has(s.id) && !!seen.add(s.id));
    if (unique.length > 0) {
      const chosen = unique.slice(0, mostSkillsPerRound);
      return {
        kind: 'practice', title: `Erst festigen: ${chosen.map((s) => s.title).join(', ')}`,
        reason: 'Die nächste Lektion baut darauf auf, und es klappt noch nicht sicher.', skillIDs: chosen.map((s) => s.id), step,
      };
    }
  }

  // 3. A skill of a finished unit that went badly.
  const shaky = map.skills.filter((s) => {
    const state = status(s);
    return (state === 'worked' || state === 'practicing') && isWeak(records[s.id], s) && s.nodeIDs.every((id) => completed.has(id));
  });
  if (shaky.length > 0) {
    const chosen = shaky.slice(0, mostSkillsPerRound);
    return {
      kind: 'practice', title: `Üben: ${chosen.map((s) => s.title).join(', ')}`,
      reason: 'Die Lektionen sind durch, aber die Antworten sind noch nicht sicher.', skillIDs: chosen.map((s) => s.id), step,
    };
  }

  if (step) return { kind: 'step', title: `Weiter mit ${stepTitle(step, units)}`, reason: 'Der nächste Schritt auf deinem Pfad.', skillIDs: [], step };
  return { kind: 'finished', title: 'Kurs geschafft', reason: 'Es ist nichts fällig. Beim nächsten Mal wiederholst du, was fällig wird.', skillIDs: [], step: null };
}

/** A round made of the exercises that fit what a skill still needs. */
export const SkillPractice = {
  size: 10,
  minimum: 6,

  /** Exercises for the target skills. Levels the student answers badly or never met are drawn more often. Same seed, same round. */
  exercises(provider: CourseProvider, map: SkillMap, targets: string[], records: SkillRecords, seed: bigint): LearnExercise[] {
    const targetSet = new Set(targets);
    const wanted = map.skills.filter((s) => targetSet.has(s.id));
    if (wanted.length === 0) return [];
    const nodeIDs: string[] = [];
    for (const skill of wanted) for (const id of skill.nodeIDs) if (!nodeIDs.includes(id)) nodeIDs.push(id);
    const pool: LearnExercise[] = [];
    const rest: LearnExercise[] = [];
    const seen = new Set<string>();
    nodeIDs.forEach((id, index) => {
      const node = nodeWithID(provider.course, id);
      if (!node) return;
      const batch = lessonExercises(provider, node, BigInt.asUintN(64, seed + BigInt(index) * 7919n));
      for (const item of batch) {
        if (item.skill !== '' && !seen.has(item.id)) {
          seen.add(item.id);
          (targetSet.has(item.skill) ? pool : rest).push(item);
        }
      }
    });
    if (pool.length === 0) return [];
    let weighted = pool.map((item) => ({ item, weight: SkillPractice.weight(item, records) }));
    // A goal with few exercises gets company from the same units, so a round is never a handful of questions.
    if (pool.length < SkillPractice.minimum) weighted = weighted.concat(rest.map((item) => ({ item, weight: 0.3 * SkillPractice.weight(item, records) })));
    const random = new LearnRandom(seed ^ 0xa5a55a5a12345678n);
    const picked: LearnExercise[] = [];
    while (picked.length < SkillPractice.size && weighted.length > 0) {
      const total = weighted.reduce((sum, w) => sum + w.weight, 0);
      let roll = random.double() * Math.max(total, 0.0001);
      let choice = weighted.length - 1;
      for (let i = 0; i < weighted.length; i++) {
        roll -= weighted[i].weight;
        if (roll < 0) {
          choice = i;
          break;
        }
      }
      picked.push(weighted.splice(choice, 1)[0].item);
    }
    return arrange(picked, SkillPractice.size);
  },

  weight(item: LearnExercise, records: SkillRecords): number {
    if (!item.level) return 1;
    const tally = tallyOf(records[item.skill] ?? ({ tallies: {} } as SkillRecord), item.level);
    const accuracy = recentAccuracy(tally.recent);
    if (accuracy === null) return 2;
    if (accuracy < SkillAssessor.weakAccuracy) return 3;
    if (accuracy >= 0.9 && tally.attempts >= 6) return 0.5;
    return 1;
  },
};

/** Skipping a unit by passing its test, for a student who knows it already. */
export const TestOut = {
  passRate: 0.85,

  /** The unit that may be tested out: the first one not done, if nothing of it was done yet. */
  candidate(units: PathUnit[]): PathUnit | undefined {
    const unit = units.find((u) => !u.steps.every((s) => s.state === 'done'));
    if (!unit || unit.steps.some((s) => s.state === 'done') || unit.steps[0]?.state !== 'open') return undefined;
    return unit;
  },

  passed(result: LessonResult): boolean {
    return result.exerciseCount >= 10 && accuracyOf(result) >= TestOut.passRate;
  },

  /** The steps a pass marks as done: everything but the chest, which the student opens. */
  nodesToComplete(unit: CourseUnit): string[] {
    return unit.nodes.filter((n) => n.kind !== 'chest').map((n) => n.id);
  },
};
