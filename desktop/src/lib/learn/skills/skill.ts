// Learning goals ("skills"): levels, facets, the skill map of a course and the defaults every course provider gets.
// A port of Lernwerk/Services/Learn/Skills/Skill.swift. Swift extends `CourseProvider` with default methods; here they
// are plain functions that take the provider (see `lessonExercises`, `skillMap`, ...).

import type { Course, CourseProvider, CourseUnit, CourseNode } from '../course';
import type { ExerciseKind, LearnAnswer, LearnExercise } from '../exercise';

/** What an exercise asks of the student. A skill is only shown to be mastered by the higher levels: seeing the right
 * answer among others is the weakest evidence there is. */
export type CompetenceLevel =
  /** Picking the right answer from a few: a choice, pairs, a key on the piano. */
  | 'recognise'
  /** Producing the answer from memory: typing it. */
  | 'recall'
  /** Using the knowledge: putting a sentence together, finding a move on the board, a form in a sentence. */
  | 'apply';

export const CompetenceLevels = {
  all: ['recognise', 'recall', 'apply'] as readonly CompetenceLevel[],

  order(level: CompetenceLevel): number {
    switch (level) {
      case 'recognise':
        return 0;
      case 'recall':
        return 1;
      case 'apply':
        return 2;
    }
  },

  /** `a > b` in Swift's Comparable. */
  isHigher(a: CompetenceLevel, b: CompetenceLevel): boolean {
    return CompetenceLevels.order(a) > CompetenceLevels.order(b);
  },

  /** Points for an answer right on the first try without help. */
  weight(level: CompetenceLevel): number {
    return level === 'recognise' ? 1 : 2;
  },

  title(level: CompetenceLevel): string {
    switch (level) {
      case 'recognise':
        return 'Wiedererkennen';
      case 'recall':
        return 'Abrufen';
      case 'apply':
        return 'Anwenden';
    }
  },

  /** The level an exercise has when the course does not say otherwise. */
  standard(kind: ExerciseKind): CompetenceLevel {
    switch (kind) {
      case 'multipleChoice':
      case 'matchPairs':
      case 'pianoKey':
        return 'recognise';
      case 'typeAnswer':
        return 'recall';
      case 'wordBank':
      case 'chessMove':
        return 'apply';
    }
  },
};

/** One thing a unit teaches, as a course declares it: "Wortschatz", "Anwenden am Brett". */
export interface SkillFacet {
  /** Unique within the unit: "vocab", "board". */
  key: string;
  title: string;
  /** The goal in a sentence the student reads: "Du erkennst die Wörter und rufst sie ohne Auswahl ab." */
  goal: string;
  /** The levels the unit's exercises have for this facet. Mastery needs evidence at every level above recognising
   * that is listed here, so a goal with typing in it is not mastered by choosing alone. */
  levels: CompetenceLevel[];
  /** Facets of the same unit that come first. */
  requires: string[];
  /** The facet of the previous unit this one builds on, if that unit has it. */
  after: string | null;
}

export function skillFacet(
  key: string,
  title: string,
  goal: string,
  levels: CompetenceLevel[],
  options: { requires?: string[]; after?: string | null } = {},
): SkillFacet {
  return { key, title, goal, levels, requires: options.requires ?? [], after: options.after ?? null };
}

/** Which facet an exercise belongs to, and at which level it asks. */
export interface SkillTag {
  facet: string;
  level: CompetenceLevel;
}

/** A learning goal with its prerequisites. Ids are stable: unit id and facet key, so progress survives a new version
 * of the app as long as the course keeps its ids. */
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
  constructor(
    readonly courseID: string,
    readonly skills: Skill[],
  ) {}

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
      for (const prerequisite of skill.prerequisites) {
        if (!ids.has(prerequisite)) problems.push(`${skill.id}: unknown prerequisite ${prerequisite}`);
      }
      if (skill.prerequisites.includes(skill.id)) problems.push(`${skill.id}: needs itself`);
    }
    // Cycles: a depth-first walk that meets a skill on its own way down.
    const state = new Map<string, number>();
    const visit = (id: string): boolean => {
      if (state.get(id) === 2) return true;
      if (state.get(id) === 1) return false;
      state.set(id, 1);
      for (const next of this.skill(id)?.prerequisites ?? []) {
        if (ids.has(next) && !visit(next)) return false;
      }
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
    let previousFacets = new Map<string, string>();
    for (const unit of course.units) {
      const facets = skillFacets(provider, unit);
      const nodes = unit.nodes.filter((n) => n.kind !== 'chest').map((n) => n.id);
      const current = new Map<string, string>();
      for (const facet of facets) {
        const id = unit.id + '.' + facet.key;
        current.set(facet.key, id);
        const prerequisites = facet.requires.map((r) => unit.id + '.' + r);
        const earlier = facet.after === null ? undefined : previousFacets.get(facet.after);
        if (earlier !== undefined) prerequisites.push(earlier);
        skills.push({
          id,
          courseID: course.id,
          unitID: unit.id,
          unitNumber: unit.number,
          unitTitle: unit.title,
          facet: facet.key,
          title: facet.title,
          goal: facet.goal,
          levels: facet.levels,
          prerequisites,
          nodeIDs: nodes,
        });
      }
      previousFacets = current;
    }
    return new SkillMap(course.id, skills);
  }
}

// The defaults every CourseProvider gets (Swift: `extension CourseProvider`).

/** By default a unit is one skill: its topic, shown by choosing and by typing. Engines with more to say override
 * `skillFacets`. */
export function skillFacets(provider: CourseProvider, unit: CourseUnit): SkillFacet[] {
  if (provider.skillFacets) return provider.skillFacets(unit);
  return [
    skillFacet('main', unit.title, 'Du beherrschst: ' + unit.summary, ['recognise', 'recall'], { after: 'main' }),
  ];
}

export function skillTag(provider: CourseProvider, exercise: LearnExercise, node: CourseNode): SkillTag {
  if (provider.skillTag) return provider.skillTag(exercise, node);
  return { facet: 'main', level: CompetenceLevels.standard(exercise.kind) };
}

/** Why a wrong answer is wrong, when the course can tell from the exercise and the answer; null for none. */
export function feedback(provider: CourseProvider, exercise: LearnExercise, answer: LearnAnswer): string | null {
  return provider.feedback ? provider.feedback(exercise, answer) : null;
}

/** The exercises of a step with the skill and level each one shows evidence of. A tag that names a facet the unit
 * does not declare is dropped, so evidence never goes to a skill that is not on the map. */
export function lessonExercises(provider: CourseProvider, node: CourseNode, seed: bigint): LearnExercise[] {
  const unit = provider.course.units.find((u) => u.id === node.unitID);
  const facets = new Set(unit ? skillFacets(provider, unit).map((f) => f.key) : []);
  return provider.exercises(node, seed).map((exercise) => {
    const tagged = { ...exercise };
    const tag = skillTag(provider, exercise, node);
    if (facets.has(tag.facet)) {
      tagged.skill = node.unitID + '.' + tag.facet;
      tagged.level = tag.level;
    }
    return tagged;
  });
}

export function skillMap(provider: CourseProvider): SkillMap {
  return SkillMap.build(provider);
}

/** A provider with every default filled in, for code that wants to call the methods directly. */
export interface CompleteCourseProvider extends CourseProvider {
  skillFacets(unit: CourseUnit): SkillFacet[];
  skillTag(exercise: LearnExercise, node: CourseNode): SkillTag;
  feedback(exercise: LearnExercise, answer: LearnAnswer): string | null;
  lessonExercises(node: CourseNode, seed: bigint): LearnExercise[];
  skillMap(): SkillMap;
  course: Course;
}

export function completeProvider(provider: CourseProvider): CompleteCourseProvider {
  const complete: CompleteCourseProvider = {
    get course() {
      return provider.course;
    },
    exercises: (node, seed) => provider.exercises(node, seed),
    skillFacets: (unit) => skillFacets(provider, unit),
    skillTag: (exercise, node) => skillTag(provider, exercise, node),
    feedback: (exercise, answer) => feedback(provider, exercise, answer),
    lessonExercises: (node, seed) => lessonExercises(provider, node, seed),
    skillMap: () => SkillMap.build(provider),
  };
  return complete;
}
