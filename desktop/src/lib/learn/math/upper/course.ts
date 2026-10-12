// "Mathe Oberstufe": analysis, vectors and stochastics for the last two school years. Every lesson, practice round
// and checkpoint draws its problems from templates with exact arithmetic and a seeded generator.
// A port of MathUpperCourse.swift (the provider; the catalog is in catalog.ts).

import { type Course, type CourseNode, type CourseProvider, makeCourse, standardUnit } from '../../course';
import type { LearnExercise } from '../../exercise';
import { MathUpperBuilder } from './builder';
import { MathUpperTexts } from './texts';

export const MATH_UPPER_COURSE_ID = 'matho';

function buildCourse(): Course {
  const unit = (number: number, title: string, summary: string, tip: string) =>
    standardUnit(MATH_UPPER_COURSE_ID, number, title, summary, tip);
  const tips = MathUpperTexts.tips;
  const analysis = {
    id: 'matho.s1',
    title: 'Analysis',
    units: [
      unit(1, 'Ableitung', 'Potenzregel, Summenregel, Steigung und Tangente', tips[0]),
      unit(2, 'Kurvendiskussion', 'Nullstellen, Extrem- und Wendestellen, Monotonie, Symmetrie', tips[1]),
      unit(3, 'Integralrechnung', 'Stammfunktion, bestimmtes Integral, Fläche und Mittelwert', tips[2]),
      unit(4, 'e-Funktion und Logarithmus', 'Ableitung, Stammfunktion, Logarithmusgesetze, Gleichungen', tips[3]),
      unit(5, 'Trigonometrie', 'Bogenmaß, exakte Werte, Ableitung von sin und cos, Periode', tips[4]),
    ],
  };
  const geometry = {
    id: 'matho.s2',
    title: 'Analytische Geometrie',
    units: [unit(6, 'Vektoren', 'Betrag, Skalarprodukt, Orthogonalität, Geraden, Abstand', tips[5])],
  };
  const stochastics = {
    id: 'matho.s3',
    title: 'Stochastik',
    units: [unit(7, 'Stochastik', 'Laplace, Binomialverteilung, Erwartungswert, bedingte Wahrscheinlichkeit', tips[6])],
  };
  return makeCourse({
    id: MATH_UPPER_COURSE_ID,
    title: 'Mathe Oberstufe',
    subtitle: 'Analysis, Vektoren, Stochastik',
    kind: 'math',
    color: 0x5a5aa8,
    symbol: 'function',
    sections: [analysis, geometry, stochastics],
  });
}

/** The provider of the upper-school maths course. It has no own skill facets, tags or feedback: the defaults of
 * skills/skill.ts apply (one skill per unit), exactly as in Swift. */
export const mathUpperProvider: CourseProvider = {
  course: buildCourse(),
  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    return MathUpperBuilder.exercises(node, seed);
  },
};
