// Courses: kinds, nodes, units, sections and the provider interface. A port of
// Lernwerk/Services/Learn/Course/Course.swift. The default methods Swift adds to `CourseProvider` (skill facets,
// tags, feedback, lessonExercises, skillMap) live in skills/skill.ts.

import type { LearnAnswer, LearnExercise } from './exercise';
import type { SkillFacet, SkillTag } from './skills/skill';

/** What a course is about; the Lernpfad groups its course picker by this. */
export type CourseKind = 'language' | 'school' | 'math' | 'chess' | 'music';

export const ALL_COURSE_KINDS: readonly CourseKind[] = ['language', 'school', 'math', 'chess', 'music'];

export function courseKindTitle(kind: CourseKind): string {
  switch (kind) {
    case 'language':
      return 'Sprachen';
    case 'school':
      return 'Schulfächer';
    case 'math':
      return 'Mathe';
    case 'chess':
      return 'Schach';
    case 'music':
      return 'Musik';
  }
}

/** The steps of a unit, in the order of the path. */
export type NodeKind =
  /** A new lesson. */
  | 'lesson'
  /** A round over what the unit taught. */
  | 'practice'
  /** The unit's test: the longest round, and the one that marks the unit as learned. */
  | 'checkpoint'
  /** A reward in gems; tapping it opens it. */
  | 'chest';

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
export function standardUnit(
  courseID: string,
  number: number,
  title: string,
  summary: string,
  tip: string,
  lessons = 3,
): CourseUnit {
  const unitID = `${courseID}.u` + (number < 10 ? `0${number}` : `${number}`);
  const node = (suffix: string, kind: NodeKind, index: number, nodeTitle: string): CourseNode => ({
    id: `${unitID}.${suffix}`,
    courseID,
    unitID,
    unitNumber: number,
    kind,
    index,
    title: nodeTitle,
  });
  const count = Math.max(1, lessons);
  const nodes: CourseNode[] = [];
  for (let i = 1; i <= count; i++) nodes.push(node(`l${i}`, 'lesson', i, `Lektion ${i}`));
  nodes.push(node('p', 'practice', 1, 'Üben'));
  nodes.push(node('t', 'checkpoint', 1, 'Einheitentest'));
  nodes.push(node('k', 'chest', 1, 'Truhe'));
  return { id: unitID, number, title, summary, tip, nodes };
}

/** Swift: `CourseUnit.standard(...)`. */
export const CourseUnit = { standard: standardUnit };

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
  /** The course's color as 0xRRGGBB, like the subjects' in `Subjects`. */
  color: number;
  /** An icon name for the course (an SF Symbol on iOS); the path shows it on the checkpoints. */
  symbol: string;
  sections: CourseSection[];
  /** All units of all sections, in order. */
  units: CourseUnit[];
  /** All nodes of all units, in order. */
  nodes: CourseNode[];
}

export function makeCourse(fields: {
  id: string;
  title: string;
  subtitle: string;
  kind: CourseKind;
  color: number;
  symbol: string;
  sections: CourseSection[];
}): Course {
  const units = fields.sections.flatMap((s) => s.units);
  return { ...fields, units, nodes: units.flatMap((u) => u.nodes) };
}

export function courseNode(course: Course, id: string): CourseNode | undefined {
  return course.nodes.find((n) => n.id === id);
}

/** Whether text on the course's color should be dark: only on light colors. White text on a mid-tone color reads
 * better to the eye than the maths of contrast says, and still has at least 3:1. */
export function prefersDarkText(course: Pick<Course, 'color'>): boolean {
  const channel = (shift: number): number => {
    const value = ((course.color >>> shift) & 0xff) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  // White's contrast is 1.05 / (L + 0.05): 3:1 at L = 0.30.
  return luminance > 0.3;
}

/** One course's content: its structure and the exercises of each of its steps. The optional methods have defaults
 * (see skills/skill.ts: `skillFacets`, `skillTag`, `feedback`, `lessonExercises`, `skillMap`). */
export interface CourseProvider {
  readonly course: Course;

  /** The exercises of a lesson, practice or checkpoint node, 8 to 12 (a checkpoint up to 15), easy to hard. The same
   * seed gives the same exercises; another seed shuffles the same material differently. A chest has none. */
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
  const ids = course.nodes.map((n) => n.id);
  if (new Set(ids).size !== ids.length) problems.push('Node ids are not unique.');
  if (course.units.length === 0) problems.push('No units.');
  course.units.forEach((unit, index) => {
    if (unit.number !== index + 1) problems.push(`Unit ${unit.id} is number ${unit.number}, expected ${index + 1}.`);
  });
  for (const unit of course.units) {
    if (unit.title === '' || unit.tip === '') problems.push(`Unit ${unit.id} has no title or tip.`);
    if (!unit.nodes.some((n) => n.kind === 'checkpoint')) problems.push(`Unit ${unit.id} has no checkpoint.`);
    for (const node of unit.nodes) {
      if (!node.id.startsWith(course.id + '.')) problems.push(`Node ${node.id} does not start with the course id.`);
    }
  }
  return problems;
}
