// What the Lernen tab suggests next, and why; practice rounds on chosen goals; skipping a unit by passing its test.
// A port of Lernwerk/Services/Learn/Skills/SkillAdvisor.swift.

import { CoursePath, type PathStep, type PathUnit } from '../coursePath';
import type { CourseProvider, CourseUnit } from '../course';
import { type LearnCalendar, dayOf, daysTo } from '../day';
import type { LearnExercise } from '../exercise';
import { Exercises } from '../exercises';
import { MASK64, LearnRandom, randomDouble } from '../random';
import type { LessonResult } from '../session';
import { compareStrings } from '../util';
import { SkillAssessor, SkillRecord, skillStatusIsReached, type SkillStatus, Tally } from './assessor';
import { lessonExercises, type Skill, type SkillMap } from './skill';

/** What the Lernen tab suggests next, and why. */
export interface Recommendation {
  kind: RecommendationKind;
  title: string;
  reason: string;
  skillIDs: string[];
  step: PathStep | null;
}

export type RecommendationKind =
  /** Skills reached before are due again. */
  | 'review'
  /** Skills that are shaky, or that the next step builds on. */
  | 'practice'
  /** The next step of the path. */
  | 'step'
  /** Nothing is left: the course is done and nothing is due. */
  | 'finished';

/** Chooses the next sensible thing from the path and the skills. Nothing here locks a step: the path stays as it is,
 * and the advice says when another round would help more than the next lesson. */
export const SkillAdvisor = {
  mostSkillsPerRound: 3,

  recommend(
    map: SkillMap,
    records: Record<string, SkillRecord>,
    units: readonly PathUnit[],
    completed: ReadonlySet<string>,
    now: number,
    calendar: LearnCalendar,
  ): Recommendation {
    const status = (skill: Skill): SkillStatus => SkillAssessor.status(records[skill.id], skill, completed, now, calendar);
    const today = dayOf(now, calendar);
    const step = CoursePath.current(units);
    const most = SkillAdvisor.mostSkillsPerRound;

    // 1. Reviews that are due, the longest overdue first.
    const overdue = (skill: Skill): number => {
      const due = records[skill.id]?.dueDay;
      return due ? daysTo(due, today, calendar) : 0;
    };
    const due = map.skills
      .filter((s) => status(s) === 'due')
      .map((skill, offset) => ({ skill, offset }))
      .sort((a, b) => {
        const first = overdue(a.skill);
        const second = overdue(b.skill);
        if (first !== second) return second - first;
        return compareStrings(a.skill.id, b.skill.id) || a.offset - b.offset;
      })
      .map((e) => e.skill);
    if (due.length > 0) {
      const chosen = due.slice(0, most);
      const names = chosen.map((s) => s.title).join(', ');
      return {
        kind: 'review',
        title: 'Wiederholen: ' + names,
        reason:
          due.length === 1
            ? 'Das hast du schon gekonnt. Jetzt festigst du es.'
            : 'Das hast du schon gekonnt. Jetzt festigst du es, bevor es verblasst.',
        skillIDs: chosen.map((s) => s.id),
        step: null,
      };
    }

    // 2. What the next step builds on and the student does not yet do well.
    const stepUnit = step ? units.find((u) => u.steps.some((s) => s.id === step.id)) : undefined;
    if (step && stepUnit) {
      const weakPrerequisites = map
        .skillsInUnit(stepUnit.unit.id)
        .flatMap((skill) => skill.prerequisites.map((p) => map.skill(p)).filter((p): p is Skill => p !== undefined))
        .filter((prerequisite) => {
          const state = status(prerequisite);
          return !skillStatusIsReached(state) && state !== 'notStarted' && SkillAdvisor.isWeak(records[prerequisite.id], prerequisite);
        });
      const seen = new Set<string>();
      const unique = weakPrerequisites.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      if (unique.length > 0) {
        const chosen = unique.slice(0, most);
        return {
          kind: 'practice',
          title: 'Erst festigen: ' + chosen.map((s) => s.title).join(', '),
          reason: 'Die nächste Lektion baut darauf auf, und es klappt noch nicht sicher.',
          skillIDs: chosen.map((s) => s.id),
          step,
        };
      }
    }

    // 3. A skill of a finished unit that went badly.
    const shaky = map.skills.filter((skill) => {
      const state = status(skill);
      return (
        (state === 'worked' || state === 'practicing') &&
        SkillAdvisor.isWeak(records[skill.id], skill) &&
        skill.nodeIDs.every((id) => completed.has(id))
      );
    });
    if (shaky.length > 0) {
      const chosen = shaky.slice(0, most);
      return {
        kind: 'practice',
        title: 'Üben: ' + chosen.map((s) => s.title).join(', '),
        reason: 'Die Lektionen sind durch, aber die Antworten sind noch nicht sicher.',
        skillIDs: chosen.map((s) => s.id),
        step,
      };
    }

    if (step) {
      return {
        kind: 'step',
        title: 'Weiter mit ' + SkillAdvisor.stepTitle(step, units),
        reason: 'Der nächste Schritt auf deinem Pfad.',
        skillIDs: [],
        step,
      };
    }
    return {
      kind: 'finished',
      title: 'Kurs geschafft',
      reason: 'Es ist nichts fällig. Beim nächsten Mal wiederholst du, was fällig wird.',
      skillIDs: [],
      step: null,
    };
  },

  /** Weak: some answers exist and the recent ones were mostly wrong or helped. */
  isWeak(record: SkillRecord | null | undefined, _skill: Skill): boolean {
    if (!record || record.attempts < 3) return false;
    const accuracy = record.recentAccuracy;
    if (accuracy === null) return false;
    return accuracy < SkillAssessor.weakAccuracy;
  },

  stepTitle(step: PathStep, units: readonly PathUnit[]): string {
    const unit = units.find((u) => u.steps.some((s) => s.id === step.id));
    let name: string;
    switch (step.node.kind) {
      case 'lesson':
        name = `Lektion ${step.node.index}`;
        break;
      case 'practice':
        name = 'der Übungsrunde';
        break;
      case 'checkpoint':
        name = 'dem Einheitentest';
        break;
      case 'chest':
        name = 'der Truhe';
        break;
    }
    return unit ? `${name} · ${unit.unit.title}` : name;
  },
};

/** A round made of the exercises that fit what a skill still needs. */
export const SkillPractice = {
  size: 10,
  minimum: 6,

  /** Exercises for the target skills. Levels the student answers badly or never met are drawn more often; levels
   * answered well in the recent past less often. Same seed, same round. */
  exercises(
    provider: CourseProvider,
    map: SkillMap,
    targets: readonly string[],
    records: Record<string, SkillRecord>,
    seed: bigint,
  ): LearnExercise[] {
    const targetSet = new Set(targets);
    const wanted = map.skills.filter((s) => targetSet.has(s.id));
    if (wanted.length === 0) return [];
    const nodeIDs: string[] = [];
    for (const skill of wanted) for (const id of skill.nodeIDs) if (!nodeIDs.includes(id)) nodeIDs.push(id);
    const pool: LearnExercise[] = [];
    const rest: LearnExercise[] = [];
    const seen = new Set<string>();
    nodeIDs.forEach((id, index) => {
      const node = provider.course.nodes.find((n) => n.id === id);
      if (!node) return;
      const batch = lessonExercises(provider, node, (seed + ((BigInt(index) * 7919n) & MASK64)) & MASK64);
      for (const exercise of batch) {
        if (exercise.skill === '' || seen.has(exercise.id)) continue;
        seen.add(exercise.id);
        if (targetSet.has(exercise.skill)) pool.push(exercise);
        else rest.push(exercise);
      }
    });
    if (pool.length === 0) return [];
    let weighted: { exercise: LearnExercise; weight: number }[] = pool.map((exercise) => ({
      exercise,
      weight: SkillPractice.weight(exercise, records, map),
    }));
    // A goal with few exercises gets company from the same units, so a round is never a handful of questions.
    if (pool.length < SkillPractice.minimum) {
      weighted = weighted.concat(rest.map((exercise) => ({ exercise, weight: 0.3 * SkillPractice.weight(exercise, records, map) })));
    }
    const random = new LearnRandom((seed ^ 0xa5a55a5a12345678n) & MASK64);
    const picked: LearnExercise[] = [];
    while (picked.length < SkillPractice.size && weighted.length > 0) {
      const total = weighted.reduce((sum, e) => sum + e.weight, 0);
      let roll = randomDouble(random, 0, Math.max(total, 0.0001));
      let choice = weighted.length - 1;
      for (let index = 0; index < weighted.length; index++) {
        roll -= weighted[index].weight;
        if (roll < 0) {
          choice = index;
          break;
        }
      }
      picked.push(weighted.splice(choice, 1)[0].exercise);
    }
    return Exercises.arrange(picked, SkillPractice.size);
  },

  weight(exercise: LearnExercise, records: Record<string, SkillRecord>, _map: SkillMap): number {
    if (!exercise.level) return 1;
    const tally = records[exercise.skill]?.tally(exercise.level) ?? new Tally();
    const accuracy = tally.recentAccuracy;
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
  candidate(units: readonly PathUnit[]): PathUnit | null {
    const unit = units.find((u) => !u.isDone);
    if (!unit || unit.doneCount !== 0 || unit.steps[0]?.state !== 'open') return null;
    return unit;
  },

  passed(result: LessonResult): boolean {
    return result.exerciseCount >= 10 && result.accuracy >= TestOut.passRate;
  },

  /** The steps a pass marks as done: everything but the chest, which the student opens. */
  nodesToComplete(unit: CourseUnit): string[] {
    return unit.nodes.filter((n) => n.kind !== 'chest').map((n) => n.id);
  },
};
