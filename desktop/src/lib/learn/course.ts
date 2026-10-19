import type { LearnAnswer, LearnExercise } from './exercise';
import { standardLevel } from './exercise';
import type { LessonState } from './cards';

/** What a course is about; the course picker groups by this. */
export type CourseKind = 'language' | 'school' | 'math' | 'chess' | 'music';
export const courseKinds: CourseKind[] = ['language', 'school', 'math', 'chess', 'music'];
export const courseKindTitle = (kind: CourseKind): string =>
  ({ language: 'Sprachen', school: 'Schulfächer', math: 'Mathe', chess: 'Schach', music: 'Musik' })[kind];

/** The steps of a unit, in the order of the path. */
export type NodeKind = 'lesson' | 'practice' | 'checkpoint' | 'chest';

export interface CourseNode {
  /** Unique across all courses, like "es.u03.l2". It is also what the progress stores as done. */
  id: string;
  courseID: string;
  unitID: string;
  /** The unit's number in the course, from 1. */
  unitNumber: number;
  kind: NodeKind;
  /** Among the lessons of its unit from 1; always 1 for the other kinds. */
  index: number;
  title: string;
}

export interface CourseUnit {
  id: string;
  /** From 1, across the sections of the course. */
  number: number;
  title: string;
  /** One line under the title: what the unit is about. */
  summary: string;
  /** The unit's guide: what to know before the first lesson. Short paragraphs separated by blank lines. */
  tip: string;
  nodes: CourseNode[];
}

/** Three lessons, a practice round, the checkpoint and a chest, as on the path. */
export function standardUnit(courseID: string, number: number, title: string, summary: string, tip: string, lessons = 3): CourseUnit {
  const unitID = `${courseID}.u${number < 10 ? `0${number}` : number}`;
  const node = (suffix: string, kind: NodeKind, index: number, nodeTitle: string): CourseNode => ({
    id: `${unitID}.${suffix}`, courseID, unitID, unitNumber: number, kind, index, title: nodeTitle,
  });
  const nodes: CourseNode[] = [];
  for (let i = 1; i <= Math.max(1, lessons); i++) nodes.push(node(`l${i}`, 'lesson', i, `Lektion ${i}`));
  nodes.push(node('p', 'practice', 1, 'Üben'), node('t', 'checkpoint', 1, 'Einheitentest'), node('k', 'chest', 1, 'Truhe'));
  return { id: unitID, number, title, summary, tip, nodes };
}

/** A group of units under one heading, like "A1 · Erste Schritte". */
export interface CourseSection {
  id: string;
  title: string;
  units: CourseUnit[];
}

export interface Course {
  id: string;
  title: string;
  /** Who it is for and where it starts: "Für Deutschsprachige · A1". */
  subtitle: string;
  kind: CourseKind;
  /** The course's color as 0xRRGGBB. */
  color: number;
  /** A name for the course's icon; the path shows it on the checkpoints. */
  symbol: string;
  sections: CourseSection[];
}

export const courseUnits = (course: Course): CourseUnit[] => course.sections.flatMap((s) => s.units);
export const courseNodes = (course: Course): CourseNode[] => courseUnits(course).flatMap((u) => u.nodes);
export const nodeWithID = (course: Course, id: string): CourseNode | undefined => courseNodes(course).find((n) => n.id === id);

/** Whether text on the course's color should be dark: only on light colors. */
export function prefersDarkText(course: Course): boolean {
  const channel = (shift: number) => {
    const value = ((course.color >> shift) & 0xff) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  // White's contrast is 1.05 / (L + 0.05): 3:1 at L = 0.30.
  return luminance > 0.3;
}

// Skills: what a unit teaches (see skills.ts)

export interface SkillFacet {
  /** Unique within the unit: "vocab", "board". */
  key: string;
  title: string;
  /** The goal in a sentence the student reads. */
  goal: string;
  /** The levels the unit's exercises have for this facet. */
  levels: import('./exercise').CompetenceLevel[];
  /** Facets of the same unit that come first. */
  requires?: string[];
  /** The facet of the previous unit this one builds on, if that unit has it. */
  after?: string;
}

export interface SkillTag {
  facet: string;
  level: import('./exercise').CompetenceLevel;
}

/** One course's content: its structure and the exercises of each of its steps. */
export interface CourseProvider {
  course: Course;
  /** The exercises of a lesson, practice or checkpoint node, 8 to 12 (a checkpoint up to 15), easy to hard. The same seed gives the same exercises. A chest has none. */
  exercises(node: CourseNode, seed: bigint): LearnExercise[];
  /** The goals a unit teaches; the default is one per unit. */
  skillFacets?(unit: CourseUnit): SkillFacet[];
  /** Which goal an exercise of a step shows evidence of, and at which level. */
  skillTag?(exercise: LearnExercise, node: CourseNode): SkillTag;
  /** Why a wrong answer is wrong, when the course can tell from the exercise and the answer; null for none. */
  feedback?(exercise: LearnExercise, answer: LearnAnswer): string | null;
}

/** Checks the structure the screens rely on; the tests run it for every course. */
export function structureProblems(provider: CourseProvider): string[] {
  const course = provider.course;
  const problems: string[] = [];
  const nodes = courseNodes(course);
  const ids = nodes.map((n) => n.id);
  if (new Set(ids).size !== ids.length) problems.push('Node ids are not unique.');
  const units = courseUnits(course);
  if (units.length === 0) problems.push('No units.');
  units.forEach((unit, index) => {
    if (unit.number !== index + 1) problems.push(`Unit ${unit.id} is number ${unit.number}, expected ${index + 1}.`);
  });
  for (const unit of units) {
    if (unit.title === '' || unit.tip === '') problems.push(`Unit ${unit.id} has no title or tip.`);
    if (!unit.nodes.some((n) => n.kind === 'checkpoint')) problems.push(`Unit ${unit.id} has no checkpoint.`);
    for (const node of unit.nodes) if (!node.id.startsWith(`${course.id}.`)) problems.push(`Node ${node.id} does not start with the course id.`);
  }
  return problems;
}

// The path

export interface PathStep {
  node: CourseNode;
  state: LessonState;
}

/** A unit with its steps, for the path's banner and nodes. */
export interface PathUnit {
  section: CourseSection;
  /** The section's number in the course, from 1. */
  sectionNumber: number;
  unit: CourseUnit;
  steps: PathStep[];
}

export const pathUnitDone = (u: PathUnit): boolean => u.steps.every((s) => s.state === 'done');
export const pathUnitDoneCount = (u: PathUnit): number => u.steps.filter((s) => s.state === 'done').length;

/** Which steps of a course are done, open or locked. The steps open one after the other through the whole course: exactly one step is open, the first that is not done. */
export const CoursePath = {
  units(course: Course, completed: Set<string>): PathUnit[] {
    let frontierFound = false;
    const result: PathUnit[] = [];
    course.sections.forEach((section, sectionIndex) => {
      for (const unit of section.units) {
        const steps: PathStep[] = unit.nodes.map((node) => {
          let state: LessonState;
          if (completed.has(node.id)) state = 'done';
          else if (frontierFound) state = 'locked';
          else {
            state = 'open';
            frontierFound = true;
          }
          return { node, state };
        });
        result.push({ section, sectionNumber: sectionIndex + 1, unit, steps });
      }
    });
    return result;
  },

  /** The step to do next, or undefined when the course is finished. */
  current(units: PathUnit[]): PathStep | undefined {
    return units.flatMap((u) => u.steps).find((s) => s.state === 'open');
  },

  /** Lessons, practice rounds and checkpoints done, of all of them; chests do not count. */
  fraction(course: Course, completed: Set<string>): number {
    const counted = courseNodes(course).filter((n) => n.kind !== 'chest');
    return counted.length === 0 ? 0 : counted.filter((n) => completed.has(n.id)).length / counted.length;
  },

  isFinished(course: Course, completed: Set<string>): boolean {
    return courseNodes(course).every((n) => completed.has(n.id));
  },

  /** Gems in a chest: 10, 15 or 20, by the unit's number. */
  chestGems(node: CourseNode): number {
    return 10 + (node.unitNumber % 3) * 5;
  },

  /** The step after this one, for "next lesson" after a finished round. */
  next(node: CourseNode, course: Course): CourseNode | undefined {
    const nodes = courseNodes(course);
    const index = nodes.findIndex((n) => n.id === node.id);
    return index >= 0 && index + 1 < nodes.length ? nodes[index + 1] : undefined;
  },
};

// Defaults every provider gets

const defaultFacets = (unit: CourseUnit): SkillFacet[] => [
  { key: 'main', title: unit.title, goal: `Du beherrschst: ${unit.summary}`, levels: ['recognise', 'recall'], after: 'main' },
];

export const facetsOf = (provider: CourseProvider, unit: CourseUnit): SkillFacet[] => (provider.skillFacets ?? defaultFacets)(unit);

export const tagOf = (provider: CourseProvider, item: LearnExercise, node: CourseNode): SkillTag =>
  provider.skillTag ? provider.skillTag(item, node) : { facet: 'main', level: standardLevel(item.kind) };

/** The exercises of a step with the skill and level each one shows evidence of. A tag that names a facet the unit does not declare is dropped. */
export function lessonExercises(provider: CourseProvider, node: CourseNode, seed: bigint): LearnExercise[] {
  const unit = courseUnits(provider.course).find((u) => u.id === node.unitID);
  const facets = new Set(unit ? facetsOf(provider, unit).map((f) => f.key) : []);
  return provider.exercises(node, seed).map((item) => {
    const tag = tagOf(provider, item, node);
    return facets.has(tag.facet) ? { ...item, skill: `${node.unitID}.${tag.facet}`, level: tag.level } : item;
  });
}
