import type { LearnUnit } from './cards';
import type { Course, CourseNode, CourseUnit } from './course';

/** A material's lessons as a course, so the path screen shows them like any other course. The lessons keep the ids they have always had, so what a student finished before stays finished. */
export const MaterialCourse = {
  idPrefix: 'material.',
  /** The Quill accent: 0xRRGGBB. */
  color: 0x7fa98c,

  courseID(unit: LearnUnit): string {
    return MaterialCourse.idPrefix + unit.id;
  },

  isMaterialCourse(id: string): boolean {
    return id.startsWith(MaterialCourse.idPrefix);
  },

  course(unit: LearnUnit, title: string): Course {
    const courseID = MaterialCourse.courseID(unit);
    const unitID = `${courseID}.u01`;
    const nodes: CourseNode[] = unit.lessons.map((lesson) => ({
      id: lesson.id, courseID, unitID, unitNumber: 1, kind: 'lesson', index: lesson.index + 1, title: `Lektion ${lesson.index + 1}`,
    }));
    nodes.push({ id: `${courseID}.k`, courseID, unitID, unitNumber: 1, kind: 'chest', index: 1, title: 'Truhe' });
    const lessons = unit.lessons.length;
    const cards = unit.lessons.reduce((sum, l) => sum + l.cards.length, 0);
    const courseUnit: CourseUnit = {
      id: unitID, number: 1, title, summary: `${cards} Karten in ${lessons} ${lessons === 1 ? 'Lektion' : 'Lektionen'}`,
      tip: 'Diese Lektionen sind aus den Seiten deines Materials entstanden. Jede fragt dich sechs Karten ab: erst zum Auswählen, dann zum Zusammensetzen und am Ende zum Eintippen. Karten, die zum Wiederholen fällig sind, bekommen danach ihren neuen Termin.',
      nodes,
    };
    return {
      id: courseID, title, subtitle: 'Aus deinem Material', kind: 'school', color: MaterialCourse.color, symbol: 'doc',
      sections: [{ id: `${courseID}.s1`, title: 'Mein Material', units: [courseUnit] }],
    };
  },

  /** The lesson a node stands for, to start it with its cards. */
  lesson(node: CourseNode, unit: LearnUnit) {
    return unit.lessons.find((l) => l.id === node.id);
  },
};
