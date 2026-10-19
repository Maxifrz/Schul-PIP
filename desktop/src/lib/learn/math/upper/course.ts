import { Course, CourseNode, CourseProvider, CourseUnit, standardUnit } from '../../course';
import type { LearnExercise } from '../../exercise';
import { upperExercises } from './builder';
import type { UTemplate } from './core';
import { unit01 } from './unit01';
import { unit02 } from './unit02';
import { unit03 } from './unit03';
import { unit04 } from './unit04';
import { unit05 } from './unit05';
import { unit06 } from './unit06';
import { unit07 } from './unit07';
import { tips } from './texts';

/** The templates of each unit, in unit order. */
export const upperUnits: UTemplate[][] = [unit01, unit02, unit03, unit04, unit05, unit06, unit07];

/** Which templates are new in lesson 1, 2 and 3 of each unit (by template id). */
export const lessonGroups: string[][][] = [
  [['d1.power', 'd1.value', 'd1.linear'], ['d1.slope', 'd1.where', 'd1.negexp'], ['d1.tangentT', 'd1.tangentY', 'd1.flat']],
  [['k.yaxis', 'k.root', 'k.rootTest', 'k.sym'], ['k.extX', 'k.extY', 'k.kind'], ['k.inflect', 'k.mono', 'k.slope']],
  [['i.anti', 'i.noC', 'i.definite'], ['i.signed', 'i.area', 'i.rules'], ['i.mean', 'i.upper', 'i.area']],
  [['e.deriv', 'e.anti', 'e.zero'], ['e.inverse', 'e.lnDeriv', 'e.log'], ['e.lawChoice', 'e.laws', 'e.solve', 'e.lnSolve']],
  [['t.rad', 't.deg', 't.exact', 't.sign'], ['t.pyth', 't.deriv', 't.derivAt', 't.solve'], ['t.period', 't.amp', 't.zeros', 't.int']],
  [['v.norm', 'v.vecAB', 'v.dist', 'v.mid'], ['v.dot', 'v.orthoChoice', 'v.orthoT', 'v.angle'], ['v.linePoint', 'v.lineT', 'v.onLine', 'v.dir']],
  [['s.dice', 's.urn', 's.choose'], ['s.pmf', 's.cum', 's.expect'], ['s.table', 's.cond', 's.indep', 's.bayes']],
];

export const upperTemplate = (id: string): UTemplate | undefined => upperUnits.flat().find((t) => t.id === id);

const COURSE_ID = 'matho';

/** "Mathe Oberstufe": analysis, vectors and stochastics for the last two school years. Every lesson, practice round and checkpoint draws its problems from templates with exact arithmetic and a seeded generator. */
export class MathUpperProvider implements CourseProvider {
  readonly course: Course;

  constructor() {
    const unit = (number: number, title: string, summary: string): CourseUnit => standardUnit(COURSE_ID, number, title, summary, tips[number - 1]);
    this.course = {
      id: COURSE_ID, title: 'Mathe Oberstufe', subtitle: 'Analysis, Vektoren, Stochastik', kind: 'math', color: 0x5a5aa8, symbol: 'function',
      sections: [
        {
          id: 'matho.s1', title: 'Analysis', units: [
            unit(1, 'Ableitung', 'Potenzregel, Summenregel, Steigung und Tangente'),
            unit(2, 'Kurvendiskussion', 'Nullstellen, Extrem- und Wendestellen, Monotonie, Symmetrie'),
            unit(3, 'Integralrechnung', 'Stammfunktion, bestimmtes Integral, Fläche und Mittelwert'),
            unit(4, 'e-Funktion und Logarithmus', 'Ableitung, Stammfunktion, Logarithmusgesetze, Gleichungen'),
            unit(5, 'Trigonometrie', 'Bogenmaß, exakte Werte, Ableitung von sin und cos, Periode'),
          ],
        },
        { id: 'matho.s2', title: 'Analytische Geometrie', units: [unit(6, 'Vektoren', 'Betrag, Skalarprodukt, Orthogonalität, Geraden, Abstand')] },
        { id: 'matho.s3', title: 'Stochastik', units: [unit(7, 'Stochastik', 'Laplace, Binomialverteilung, Erwartungswert, bedingte Wahrscheinlichkeit')] },
      ],
    };
  }

  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    return upperExercises(upperUnits, lessonGroups, upperTemplate, node, seed);
  }
}

export const mathUpper = new MathUpperProvider();
