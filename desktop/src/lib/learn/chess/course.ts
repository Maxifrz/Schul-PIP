import { Course, CourseNode, CourseProvider, CourseUnit, SkillFacet, SkillTag, standardUnit } from '../course';
import { LearnAnswer, LearnExercise, standardLevel } from '../exercise';
import { arrange, seedFor } from '../exercises';
import { ChessCoach } from './coach';
import { ChessDraw, ChessMaker } from './kit';
import { ChessPosition } from './position';
import { chessUnitTexts } from './texts';
import { ChessUnit1 } from './unit01';
import { ChessUnit2 } from './unit02';
import { ChessUnit3 } from './unit03';
import { ChessUnit4 } from './unit04';
import { ChessUnit5 } from './unit05';
import { ChessUnit6 } from './unit06';
import { ChessUnit7 } from './unit07';
import { ChessUnit8 } from './unit08';

const COURSE_ID = 'chess';

/** What each lesson, practice round and checkpoint asks, as lists of topic keys. A topic is a maker in one of the unit files; "review" stands for a topic of an earlier unit. */
export const ChessPlans = {
  lessonSize: 10,
  practiceSize: 12,
  checkpointSize: 14,
  review: 'review',

  /** Every maker by topic key. */
  get table(): Map<string, ChessMaker> {
    if (!tableCache) {
      tableCache = new Map();
      for (const makers of [ChessUnit1, ChessUnit2, ChessUnit3, ChessUnit4, ChessUnit5, ChessUnit6, ChessUnit7, ChessUnit8].map((u) => u.makers)) {
        for (const [key, maker] of Object.entries(makers)) if (!tableCache.has(key)) tableCache.set(key, maker);
      }
    }
    return tableCache;
  },

  /** The topics worth meeting again, per unit (index 0 is unit 1). */
  get reviewKeys(): string[][] {
    return [ChessUnit1, ChessUnit2, ChessUnit3, ChessUnit4, ChessUnit5, ChessUnit6, ChessUnit7, ChessUnit8].map((u) => u.review);
  },

  units: [
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
  ] as UnitPlan[],

  /** The topic keys a node asks for, in order; null for a chest or an unknown node. */
  plan(node: CourseNode): string[] | null {
    if (node.unitNumber < 1 || node.unitNumber > ChessPlans.units.length) return null;
    const unit = ChessPlans.units[node.unitNumber - 1];
    switch (node.kind) {
      case 'lesson': return node.index >= 1 && node.index <= unit.lessons.length ? unit.lessons[node.index - 1] : null;
      case 'practice': return unit.practice;
      case 'checkpoint': return unit.checkpoint;
      case 'chest': return null;
    }
  },

  /** Runs the plan: each entry makes one exercise; an entry that cannot, or repeats an id, is replaced by the next one in the cycle. The result is cut to the size of the plan and put from easy to hard. */
  build(plan: string[], unit: number, draw: ChessDraw): LearnExercise[] {
    const target = plan.length;
    const made: LearnExercise[] = [];
    const ids = new Set<string>();
    let index = 0;
    let attempts = 0;
    const table = ChessPlans.table;
    while (made.length < target && attempts < target * 8) {
      let key = plan[index % plan.length];
      index += 1;
      attempts += 1;
      if (key === ChessPlans.review) {
        const earlier = ChessPlans.reviewKeys.slice(0, Math.max(0, unit - 1)).flat();
        const picked = draw.randomElement(earlier);
        if (picked === null) continue;
        key = picked;
      }
      const exercise = table.get(key)?.(draw) ?? null;
      if (!exercise || ids.has(exercise.id)) continue;
      ids.add(exercise.id);
      made.push(exercise);
    }
    return arrange(made, target);
  },
};

interface UnitPlan {
  lessons: string[][];
  practice: string[];
  checkpoint: string[];
}

let tableCache: Map<string, ChessMaker> | null = null;

/** "Schach": eight units from the board to tactics. Every position is a FEN written by hand, and every accepted move is computed from it by the engine at run time, so the course cannot teach a wrong answer. */
export class ChessProvider implements CourseProvider {
  readonly course: Course;

  constructor() {
    const units = chessUnitTexts.map((text, index) => standardUnit(COURSE_ID, index + 1, text.title, text.summary, text.tip));
    this.course = {
      id: COURSE_ID, title: 'Schach', subtitle: 'Vom ersten Zug bis zum Matt', kind: 'chess', color: 0xd17a9e, symbol: 'crown',
      sections: [
        { id: 'chess.s1', title: 'Brett und Figuren', units: units.slice(0, 3) },
        { id: 'chess.s2', title: 'Schach, Matt und Sonderzüge', units: units.slice(3, 5) },
        { id: 'chess.s3', title: 'Material und Taktik', units: units.slice(5, 8) },
      ],
    };
  }

  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    const plan = node.kind === 'chest' ? null : ChessPlans.plan(node);
    if (!plan) return [];
    return ChessPlans.build(plan, node.unitNumber, new ChessDraw(seedFor(node, seed)));
  }

  /** Two goals per unit: the knowledge (what a rule says, names, counting, judging) and the use of it at the board (finding the move). A student who can say what a fork is has not yet shown that he finds one. */
  skillFacets(unit: CourseUnit): SkillFacet[] {
    // Units 4 and 8 ask by choosing, by pairs, by tiles and by finding moves; nothing in them is typed.
    const typed = unit.number !== 4 && unit.number !== 8;
    return [
      { key: 'know', title: 'Wissen', goal: `Du kennst und erkennst: ${unit.summary}`, levels: typed ? ['recognise', 'recall'] : ['recognise'], after: 'know' },
      { key: 'board', title: 'Am Brett', goal: `Du findest den richtigen Zug in einer Stellung: ${unit.title}`, levels: ['apply'], requires: ['know'] },
    ];
  }

  skillTag(exercise: LearnExercise): SkillTag {
    if (exercise.kind === 'chessMove') return { facet: 'board', level: 'apply' };
    return { facet: 'know', level: standardLevel(exercise.kind) };
  }

  feedback(exercise: LearnExercise, answer: LearnAnswer): string | null {
    if (!exercise.coach.startsWith(ChessCoach.prefix) || answer.type !== 'move' || exercise.media?.kind !== 'board') return null;
    const position = ChessPosition.fromFEN(exercise.media.board.fen);
    if (!position) return null;
    return ChessCoach.explain(answer.value, exercise.coach.slice(ChessCoach.prefix.length), position);
  }
}

export const chess = new ChessProvider();
