// Which steps of a course are done, open or locked. A port of Lernwerk/Services/Learn/Course/CoursePath.swift (and
// `LessonState` of LearnPath.swift).

import type { Course, CourseNode, CourseSection, CourseUnit } from './course';

export type LessonState = 'locked' | 'open' | 'done';

export interface PathStep {
  node: CourseNode;
  state: LessonState;
  /** The node's id. */
  id: string;
}

/** A unit with its steps, for the path's banner and nodes. */
export interface PathUnit {
  section: CourseSection;
  /** The section's number in the course, from 1. */
  sectionNumber: number;
  unit: CourseUnit;
  steps: PathStep[];
  /** The unit's id. */
  id: string;
  isDone: boolean;
  doneCount: number;
}

/** Which steps of a course are done, open or locked. The steps open one after the other through the whole course,
 * as on a path: exactly one step is open, the first that is not done. The finished ones come from the progress. */
export const CoursePath = {
  units(course: Course, completed: ReadonlySet<string>): PathUnit[] {
    // Only the first step that is not done is open; everything after it stays locked, whatever the saved set says.
    let frontierFound = false;
    const result: PathUnit[] = [];
    course.sections.forEach((section, sectionIndex) => {
      for (const unit of section.units) {
        const steps: PathStep[] = [];
        for (const node of unit.nodes) {
          let state: LessonState;
          if (completed.has(node.id)) {
            state = 'done';
          } else if (frontierFound) {
            state = 'locked';
          } else {
            state = 'open';
            frontierFound = true;
          }
          steps.push({ node, state, id: node.id });
        }
        const doneCount = steps.filter((s) => s.state === 'done').length;
        result.push({
          section,
          sectionNumber: sectionIndex + 1,
          unit,
          steps,
          id: unit.id,
          isDone: steps.every((s) => s.state === 'done'),
          doneCount,
        });
      }
    });
    return result;
  },

  /** The step to do next, or null when the course is finished. */
  current(units: readonly PathUnit[]): PathStep | null {
    for (const unit of units) {
      for (const step of unit.steps) if (step.state === 'open') return step;
    }
    return null;
  },

  /** Lessons, practice rounds and checkpoints done, of all of them; chests do not count. */
  fraction(course: Course, completed: ReadonlySet<string>): number {
    const counted = course.nodes.filter((n) => n.kind !== 'chest');
    if (counted.length === 0) return 0;
    return counted.filter((n) => completed.has(n.id)).length / counted.length;
  },

  isFinished(course: Course, completed: ReadonlySet<string>): boolean {
    return course.nodes.every((n) => completed.has(n.id));
  },

  /** Gems in a chest: 10, 15 or 20, by the unit's number, so the course pays out the same every time. */
  chestGems(node: CourseNode): number {
    return 10 + (node.unitNumber % 3) * 5;
  },

  /** The step after this one, for "next lesson" after a finished round. */
  next(node: CourseNode, course: Course): CourseNode | null {
    const nodes = course.nodes;
    const index = nodes.findIndex((n) => n.id === node.id);
    if (index < 0 || index + 1 >= nodes.length) return null;
    return nodes[index + 1];
  },
};
