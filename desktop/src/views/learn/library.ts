import type { Card } from '../../lib/review';
import { CardSnapshot, LearnPath, LearnUnit } from '../../lib/learn/cards';
import type { Course } from '../../lib/learn/course';
import { MaterialCourse } from '../../lib/learn/materialCourse';
import type { Material } from '../../store/app';
import { cardSnapshot } from '../../store/learn';

/** What the cards make: a course for each material with enough of them. */
export interface CardLibrary {
  snapshots: CardSnapshot[];
  entries: Array<{ course: Course; unit: LearnUnit }>;
}

export function makeLibrary(cards: Card[], materials: Material[], completed: Set<string>): CardLibrary {
  const snapshots = [...cards].sort((a, b) => a.createdAt - b.createdAt).map(cardSnapshot);
  const units = LearnPath.units(snapshots, completed);
  const entries = units
    .filter((unit) => unit.lessons.reduce((sum, l) => sum + l.cards.length, 0) >= LearnPath.minimumCards)
    .map((unit) => {
      const material = unit.materialID ? materials.find((m) => m.id === unit.materialID) : undefined;
      return { course: MaterialCourse.course(unit, material?.title ?? LearnPath.otherUnitTitle), unit };
    });
  return { snapshots, entries };
}

export interface MaterialRow {
  id: string;
  title: string;
  cardCount: number;
  courseID: string | null;
  lessons: number;
}

export const otherRowID = 'sonstiges';

export function materialRows(library: CardLibrary, materials: Material[]): MaterialRow[] {
  const rows: MaterialRow[] = [...materials]
    .sort((a, b) => a.title.localeCompare(b.title, 'de'))
    .map((material) => {
      const entry = library.entries.find((e) => e.unit.materialID === material.id);
      return {
        id: material.id, title: material.title, cardCount: library.snapshots.filter((c) => c.materialID === material.id).length,
        courseID: entry?.course.id ?? null, lessons: entry?.unit.lessons.length ?? 0,
      };
    });
  const other = library.entries.find((e) => e.unit.materialID === null);
  if (other) {
    rows.push({
      id: otherRowID, title: LearnPath.otherUnitTitle, cardCount: other.unit.lessons.reduce((sum, l) => sum + l.cards.length, 0),
      courseID: other.course.id, lessons: other.unit.lessons.length,
    });
  }
  return rows;
}
