import { Course, CourseNode, CourseProvider, CourseUnit, standardUnit } from '../../course';
import type { LearnExercise } from '../../exercise';
import { middleExercises } from './builder';
import type { Template } from './core';
import { unit01 } from './unit01';
import { unit02 } from './unit02';
import { unit03 } from './unit03';
import { unit04 } from './unit04';
import { unit05 } from './unit05';
import { unit06 } from './unit06';

/** Every template of the course, by unit. */
export const catalog: Template[][] = [unit01, unit02, unit03, unit04, unit05, unit06];

const COURSE_ID = 'mathm';

const unitTexts: Array<[string, string, string]> = [
  [
    'Brüche verstehen', 'Bruchteile, gemischte Zahlen, Erweitern, Kürzen und Vergleichen',
    `Ein Bruch wie 3/8 sagt: Das Ganze ist in 8 gleiche Teile geteilt, und du nimmst 3 davon. Der Nenner (unten) zählt alle Teile, der Zähler (oben) die Teile, um die es geht. 3/8 von 40 € rechnest du so: 40 : 8 = 5, dann 5 · 3 = 15.

Ist der Zähler größer als der Nenner, heißt der Bruch unecht. Du kannst ihn als gemischte Zahl schreiben: 13/5 = 2 3/5, denn 13 : 5 = 2 Rest 3. Zurück geht es mit Ganze mal Nenner plus Zähler: 2 · 5 + 3 = 13.

Erweitern heißt: Zähler und Nenner mit derselben Zahl malnehmen. Kürzen heißt: beide durch dieselbe Zahl teilen. Der Wert bleibt gleich: 3/4 = 6/8 = 15/20. Vollständig gekürzt ist ein Bruch, wenn du mit dem größten gemeinsamen Teiler gekürzt hast: 18/24 : 6 = 3/4.

Um Brüche zu vergleichen, bringst du sie auf einen gemeinsamen Nenner. Dann entscheidet der Zähler: 5/8 = 15/24 und 7/12 = 14/24, also ist 5/8 größer.`,
  ],
];

/** "Mathe Mittelstufe", Klasse 5 bis 10: ten units from fractions to probability. Every lesson, practice round and checkpoint draws its problems from templates with a seeded generator, so a new seed means new numbers. */
export class MathMiddleProvider implements CourseProvider {
  readonly course: Course;

  constructor() {
    const units: CourseUnit[] = unitTexts.map(([title, summary, tip], index) => standardUnit(COURSE_ID, index + 1, title, summary, tip));
    this.course = {
      id: COURSE_ID, title: 'Mathe Mittelstufe', subtitle: 'Klasse 5 bis 10', kind: 'math', color: 0x3d6fb6, symbol: 'percent',
      sections: [{ id: 'mathm.s1', title: 'A · Zahlen und Rechnen', units }],
    };
  }

  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    return middleExercises(catalog, node, seed);
  }
}

export const mathMiddle = new MathMiddleProvider();
