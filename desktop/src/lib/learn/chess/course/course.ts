// "Schach": eight units from the board to tactics. Every position is a FEN written by hand, and every accepted move is
// computed from it by the engine at run time, so the course cannot teach a wrong answer.
// Port of ChessCourse.swift (ChessProvider, ChessPlans) and the provider hooks of ChessSkills.swift.

import { makeCourse, standardUnit, type Course, type CourseNode, type CourseProvider, type CourseUnit } from '../../course';
import type { LearnAnswer, LearnExercise } from '../../exercise';
import { Exercises } from '../../exercises';
import { randomElement } from '../../random';
import { CompetenceLevels, skillFacet, type SkillFacet, type SkillTag } from '../../skills/skill';
import { COACH_PREFIX, coachExplain } from '../coach';
import { ChessPosition } from '../position';
import { ChessDraw, type ChessMaker } from './courseKit';
import { unit1Makers, unit1Review } from './unit1';
import { unit2Makers, unit2Review } from './unit2';
import { unit3Makers, unit3Review } from './unit3';
import { unit4Makers, unit4Review } from './unit4';
import { unit5Makers, unit5Review } from './unit5';
import { unit6Makers, unit6Review } from './unit6';
import { unit7Makers, unit7Review } from './unit7';
import { unit8Makers, unit8Review } from './unit8';
import { CHESS_UNIT_TEXTS } from './unitTexts';

export const CHESS_COURSE_ID = 'chess';

interface UnitPlan {
  lessons: string[][];
  practice: string[];
  checkpoint: string[];
}

export const LESSON_SIZE = 10;
export const PRACTICE_SIZE = 12;
export const CHECKPOINT_SIZE = 14;

const REVIEW = 'review';

/** Swift merges the unit tables keeping the first entry of a key. */
function mergeTables(tables: Record<string, ChessMaker>[]): Record<string, ChessMaker> {
  const table: Record<string, ChessMaker> = {};
  for (const makers of tables) for (const [key, maker] of Object.entries(makers)) if (!(key in table)) table[key] = maker;
  return table;
}

const TABLE = mergeTables([unit1Makers, unit2Makers, unit3Makers, unit4Makers, unit5Makers, unit6Makers, unit7Makers, unit8Makers]);

/** The topics worth meeting again, per unit (index 0 is unit 1). */
const REVIEW_KEYS: string[][] = [unit1Review, unit2Review, unit3Review, unit4Review, unit5Review, unit6Review, unit7Review, unit8Review];

const UNITS: UnitPlan[] = [
  {
    lessons: [
      ['u1.nameSquare', 'u1.nameSquare', 'u1.nameSquare', 'u1.markedFile', 'u1.markedFile', 'u1.markedRank', 'u1.markedRank', 'u1.terms', 'u1.sentence.names', 'u1.typeName'],
      ['u1.colorOfSquare', 'u1.colorOfSquare', 'u1.colorOfSquare', 'u1.cornerColor', 'u1.factChoice', 'u1.factChoice', 'u1.corners', 'u1.sentence.colors', 'u1.factNumber', 'u1.nameSquare'],
      ['u1.sameDiagonal', 'u1.sameDiagonal', 'u1.nameSquare', 'u1.tapMove', 'u1.tapMove', 'u1.tapMove', 'u1.typeName', 'u1.typeName', 'u1.typeCorner', 'u1.factNumber'],
    ],
    practice: ['u1.nameSquare', 'u1.nameSquare', 'u1.markedFile', 'u1.markedRank', 'u1.colorOfSquare', 'u1.colorOfSquare', 'u1.sameDiagonal', 'u1.terms', 'u1.tapMove', 'u1.tapMove', 'u1.typeName', 'u1.factNumber'],
    checkpoint: ['u1.nameSquare', 'u1.nameSquare', 'u1.markedFile', 'u1.markedRank', 'u1.colorOfSquare', 'u1.cornerColor', 'u1.factChoice', 'u1.sameDiagonal', 'u1.terms', 'u1.corners', 'u1.tapMove', 'u1.tapMove', 'u1.typeName', 'u1.typeCorner'],
  },
  {
    lessons: [
      ['u2.identify', 'u2.startCountChoice', 'u2.startSquare', 'u2.queenColor', 'u2.letters', 'u2.sentence.slide', 'u2.moveTo.slider', 'u2.moveTo.slider', 'u2.count.slider', 'u2.countNumber.slider'],
      ['u2.movePairs', 'u2.sentence.step', 'u2.count.step', 'u2.count.step', 'u2.reach.step', 'u2.reach.step', 'u2.moveTo.step', 'u2.moveTo.step', 'u2.countNumber.step', 'u2.whichPiece'],
      ['u2.count.all', 'u2.reach.all', 'u2.whichPiece', 'u2.whichPiece', 'u2.captureMove', 'u2.captureMove', 'u2.moveTo.all', 'u2.attackCount', 'u2.attackCount', 'u2.countNumber.all'],
    ],
    practice: ['u2.identify', 'u2.startSquare', 'u2.letters', 'u2.count.all', 'u2.reach.all', 'u2.whichPiece', 'u2.captureMove', 'u2.moveTo.all', 'u2.attackCount', 'u2.countNumber.all', 'review', 'review'],
    checkpoint: ['u2.identify', 'u2.startSquare', 'u2.queenColor', 'u2.letters', 'u2.movePairs', 'u2.count.all', 'u2.reach.all', 'u2.whichPiece', 'u2.captureMove', 'u2.moveTo.all', 'u2.moveTo.all', 'u2.countNumber.all', 'u2.attackCount', 'u2.startCountNumber'],
  },
  {
    lessons: [
      ['u3.direction', 'u3.doubleStep', 'u3.doubleStep', 'u3.stepCount.simple', 'u3.stepCount.simple', 'u3.pairs', 'u3.sentence.move', 'u3.moveOne', 'u3.moveTwo', 'u3.moveTwo'],
      ['u3.captureDir', 'u3.attackedSquare', 'u3.attackedSquare', 'u3.stepCount.all', 'u3.stepCount.all', 'u3.capture', 'u3.capture', 'u3.capture', 'u3.sentence.move', 'u3.moveOne'],
      ['u3.epYesNo', 'u3.epYesNo', 'u3.promoWhich', 'u3.promoRank', 'u3.promoSteps', 'u3.sentence.special', 'u3.epMove', 'u3.epMove', 'u3.promoMove', 'u3.promoMove'],
    ],
    practice: ['u3.direction', 'u3.doubleStep', 'u3.stepCount.all', 'u3.attackedSquare', 'u3.epYesNo', 'u3.promoSteps', 'u3.moveTwo', 'u3.capture', 'u3.epMove', 'u3.promoMove', 'review', 'review'],
    checkpoint: ['u3.direction', 'u3.doubleStep', 'u3.stepCount.all', 'u3.attackedSquare', 'u3.captureDir', 'u3.epYesNo', 'u3.promoWhich', 'u3.promoRank', 'u3.pairs', 'u3.moveTwo', 'u3.capture', 'u3.epMove', 'u3.promoMove', 'u3.promoSteps'],
  },
  {
    lessons: [
      ['u4.isCheck', 'u4.isCheck', 'u4.isCheck', 'u4.whichChecks', 'u4.whichChecks', 'u4.terms', 'u4.sentence.check', 'u4.giveCheck', 'u4.giveCheck', 'u4.giveCheck'],
      ['u4.escape.which', 'u4.escape.which', 'u4.sentence.check', 'u4.escape.any', 'u4.escape.any', 'u4.escape.capture', 'u4.escape.capture', 'u4.escape.block', 'u4.escape.block', 'u4.escape.king'],
      ['u4.state', 'u4.state', 'u4.state', 'u4.dead', 'u4.dead', 'u4.mateOrStale', 'u4.mateOrStale', 'u4.sentence.end', 'u4.mateMove', 'u4.mateMove'],
    ],
    practice: ['u4.isCheck', 'u4.whichChecks', 'u4.escape.which', 'u4.state', 'u4.state', 'u4.dead', 'u4.mateOrStale', 'u4.terms', 'u4.escape.any', 'u4.mateMove', 'review', 'review'],
    checkpoint: ['u4.isCheck', 'u4.isCheck', 'u4.whichChecks', 'u4.escape.which', 'u4.state', 'u4.state', 'u4.dead', 'u4.mateOrStale', 'u4.terms', 'u4.sentence.end', 'u4.escape.any', 'u4.escape.capture', 'u4.escape.block', 'u4.mateMove'],
  },
  {
    lessons: [
      ['u5.castleSquares', 'u5.castleSquares', 'u5.castleSquares', 'u5.castlePairs', 'u5.sentence.castle', 'u5.castleMove', 'u5.castleMove', 'u5.castleMove', 'u5.castleCan', 'u5.castleCan'],
      ['u5.castleCan', 'u5.castleCan', 'u5.castleCan', 'u5.castleReason', 'u5.castleReason', 'u5.castleReason', 'u5.castleRules', 'u5.castleRules', 'u5.castleMove', 'u5.castleMove'],
      ['u5.classify', 'u5.classify', 'u5.epYesNo', 'u5.epYesNo', 'u5.epRules', 'u5.promoRules', 'u5.promoPiece', 'u3.epMove', 'u3.promoMove', 'u5.promoCheck'],
    ],
    practice: ['u5.castleCan', 'u5.castleReason', 'u5.castleSquares', 'u5.classify', 'u5.epYesNo', 'u5.promoRules', 'u5.castleMove', 'u3.epMove', 'u5.promoCheck', 'u5.castleRules', 'review', 'review'],
    checkpoint: ['u5.castleSquares', 'u5.castleCan', 'u5.castleCan', 'u5.castleReason', 'u5.castleRules', 'u5.classify', 'u5.classify', 'u5.epYesNo', 'u5.epRules', 'u5.promoRules', 'u5.castlePairs', 'u5.castleMove', 'u3.epMove', 'u5.promoCheck'],
  },
  {
    lessons: [
      ['u6.valueChoice', 'u6.valueChoice', 'u6.valueSum', 'u6.valueSum', 'u6.materialWho', 'u6.valuePairs', 'u6.sentence.values', 'u6.valueNumber', 'u6.valueNumber', 'u6.materialCount'],
      ['u6.tradeKinds', 'u6.tradeKinds', 'u6.tradeJudge', 'u6.tradeJudge', 'u6.tradeJudge', 'u6.materialWho', 'u6.captureBest', 'u6.captureBest', 'u6.captureBest', 'u6.materialCount'],
      ['u6.contestJudge', 'u6.contestJudge', 'u6.tradeJudge', 'u6.contestBest', 'u6.contestBest', 'u6.contestBest', 'u6.captureBest', 'u6.contestCount', 'u6.contestCount', 'u6.contestCount'],
    ],
    practice: ['u6.valueChoice', 'u6.valueSum', 'u6.materialWho', 'u6.tradeKinds', 'u6.tradeJudge', 'u6.contestJudge', 'u6.captureBest', 'u6.contestBest', 'u6.materialCount', 'u6.contestCount', 'review', 'review'],
    checkpoint: ['u6.valueChoice', 'u6.valueSum', 'u6.materialWho', 'u6.valuePairs', 'u6.tradeKinds', 'u6.tradeJudge', 'u6.tradeJudge', 'u6.contestJudge', 'u6.captureBest', 'u6.captureBest', 'u6.contestBest', 'u6.materialCount', 'u6.contestCount', 'u6.valueNumber'],
  },
  {
    lessons: [
      ['u7.pattern.a', 'u7.pattern.a', 'u7.choose.a', 'u7.choose.a', 'u7.isMate.a', 'u7.sentence.back', 'u7.find.a', 'u7.find.a', 'u7.find.a', 'u7.count.a'],
      ['u7.pattern.b', 'u7.pattern.b', 'u7.choose.b', 'u7.isMate.b', 'u7.pairs', 'u7.find.b', 'u7.find.b', 'u7.find.b', 'u7.count.b', 'u7.write.b'],
      ['u7.choose.c', 'u7.choose.c', 'u7.isMate.c', 'u7.isMate.c', 'u7.sentence.rule', 'u7.find.c', 'u7.find.c', 'u7.find.c', 'u7.count.c', 'u7.write.c'],
    ],
    practice: ['u7.pattern.all', 'u7.choose.all', 'u7.choose.all', 'u7.isMate.all', 'u7.pairs', 'u7.find.all', 'u7.find.all', 'u7.count.all', 'u7.write.all', 'review', 'review', 'review'],
    checkpoint: ['u7.pattern.all', 'u7.pattern.all', 'u7.choose.all', 'u7.choose.all', 'u7.isMate.all', 'u7.pairs', 'u7.find.all', 'u7.find.all', 'u7.find.all', 'u7.find.all', 'u7.count.all', 'u7.count.all', 'u7.write.all', 'u7.write.all'],
  },
  {
    lessons: [
      ['u8.hang.which', 'u8.hang.which', 'u8.fork.choose', 'u8.fork.after', 'u8.terms', 'u8.sentence.fork', 'u8.hang.find', 'u8.hang.find', 'u8.fork.find', 'u8.fork.find'],
      ['u8.pin.which', 'u8.pin.which', 'u8.pin.choose', 'u8.skewer.choose', 'u8.sentence.line', 'u8.pin.find', 'u8.pin.find', 'u8.skewer.find', 'u8.skewer.find', 'u8.skewer.find'],
      ['u8.discovered.choose', 'u8.motif', 'u8.motif', 'u8.motif', 'u8.sentence.line', 'u8.discovered.find', 'u8.discovered.find', 'u8.mixed.find', 'u8.mixed.find', 'u8.mixed.find'],
    ],
    practice: ['u8.hang.which', 'u8.pin.which', 'u8.mixed.choose', 'u8.mixed.choose', 'u8.motif', 'u8.terms', 'u8.mixed.find', 'u8.mixed.find', 'u8.mixed.find', 'u8.mixed.find', 'review', 'review'],
    checkpoint: ['u8.hang.which', 'u8.pin.which', 'u8.fork.after', 'u8.mixed.choose', 'u8.mixed.choose', 'u8.motif', 'u8.motif', 'u8.terms', 'u8.mixed.find', 'u8.mixed.find', 'u8.mixed.find', 'u8.mixed.find', 'u8.mixed.find', 'u8.mixed.find'],
  },
];

/** The topic keys a node asks for, in order; null for a chest or an unknown node. */
export function planFor(node: CourseNode): string[] | null {
  if (node.unitNumber < 1 || node.unitNumber > UNITS.length) return null;
  const unit = UNITS[node.unitNumber - 1];
  switch (node.kind) {
    case 'lesson': return node.index >= 1 && node.index <= unit.lessons.length ? unit.lessons[node.index - 1] : null;
    case 'practice': return unit.practice;
    case 'checkpoint': return unit.checkpoint;
    case 'chest': return null;
  }
}

/** Runs the plan: each entry makes one exercise; an entry that cannot, or repeats an id, is replaced by the next one in
 * the cycle. The result is cut to the size of the plan and put from easy to hard. */
export function buildPlan(plan: string[], unit: number, draw: ChessDraw): LearnExercise[] {
  const target = plan.length;
  const made: LearnExercise[] = [];
  const ids = new Set<string>();
  let index = 0;
  let attempts = 0;
  while (made.length < target && attempts < target * 8) {
    let key = plan[index % plan.length];
    index += 1;
    attempts += 1;
    if (key === REVIEW) {
      const earlier = REVIEW_KEYS.slice(0, Math.max(0, unit - 1)).flat();
      const picked = randomElement(earlier, draw.random);
      if (picked === undefined) continue;
      key = picked;
    }
    const exercise = TABLE[key]?.(draw);
    if (!exercise || ids.has(exercise.id)) continue;
    ids.add(exercise.id);
    made.push(exercise);
  }
  return Exercises.arrange(made, target);
}

function buildCourse(): Course {
  const units: CourseUnit[] = CHESS_UNIT_TEXTS.map((text, index) => standardUnit(CHESS_COURSE_ID, index + 1, text.title, text.summary, text.tip));
  return makeCourse({
    id: CHESS_COURSE_ID, title: 'Schach', subtitle: 'Vom ersten Zug bis zum Matt', kind: 'chess', color: 0xd17a9e, symbol: 'crown.fill',
    sections: [
      { id: 'chess.s1', title: 'Brett und Figuren', units: units.slice(0, 3) },
      { id: 'chess.s2', title: 'Schach, Matt und Sonderzüge', units: units.slice(3, 5) },
      { id: 'chess.s3', title: 'Material und Taktik', units: units.slice(5, 8) },
    ],
  });
}

export class ChessProvider implements CourseProvider {
  readonly course: Course = buildCourse();

  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    if (node.kind === 'chest') return [];
    const plan = planFor(node);
    if (!plan) return [];
    const draw = new ChessDraw(Exercises.seed(node, seed));
    return buildPlan(plan, node.unitNumber, draw);
  }

  // Two goals per unit: the knowledge (what a rule says, names, counting, judging) and the use of it at the board
  // (finding the move). A student who can say what a fork is has not yet shown that he finds one.
  skillFacets(unit: CourseUnit): SkillFacet[] {
    // Unit 4 asks about check and mate by choosing and by finding moves; nothing in it is typed.
    const typed = unit.number !== 4;
    return [
      skillFacet('know', 'Wissen', 'Du kennst und erkennst: ' + unit.summary, typed ? ['recognise', 'recall'] : ['recognise'], { after: 'know' }),
      skillFacet('board', 'Am Brett', 'Du findest den richtigen Zug in einer Stellung: ' + unit.title, ['apply'], { requires: ['know'] }),
    ];
  }

  skillTag(exercise: LearnExercise, _node: CourseNode): SkillTag {
    if (exercise.kind === 'chessMove') return { facet: 'board', level: 'apply' };
    return { facet: 'know', level: CompetenceLevels.standard(exercise.kind) };
  }

  feedback(exercise: LearnExercise, answer: LearnAnswer): string | null {
    if (!exercise.coach.startsWith(COACH_PREFIX) || answer.type !== 'move') return null;
    const media = exercise.media;
    if (!media || media.type !== 'board') return null;
    const position = ChessPosition.fromFen(media.board.fen);
    if (!position) return null;
    return coachExplain(answer.value, exercise.coach.slice(COACH_PREFIX.length), position);
  }
}

/** The chess course (Swift: `ChessCourse.provider`). */
export const chessProvider: CourseProvider & Required<Pick<ChessProvider, 'skillFacets' | 'skillTag' | 'feedback'>> = new ChessProvider();
