// Unit 3, "Der Bauer": step and double step, capturing, en passant, promotion. Port of ChessUnit3.swift.

import type { LearnExercise } from '../../exercise';
import { randomElement, shuffled } from '../../random';
import { attackedSquares } from '../analysis';
import { list } from '../kit';
import type { ChessPosition } from '../position';
import {
  CHESS_COLORS, PAWN, QUEEN, colorAdjectiveStem, colorGermanName, move, oppositeColor, pawnDirection, pawnStartRank, promotionRank,
  square as squareAt, squareFile, squareName, squareOffset, squareRank, type ChessSquare,
} from '../types';
import {
  boardMedia, choice, moveExercise, number, numberWrongs, pairs, sentence, sentenceMaker, yesNo, type ChessDraw, type ChessMaker,
} from './courseKit';
import { enPassant, pawns, promotions, sampleDetailSquare, sampleFocus, samplePosition, type ChessSample } from './samples';

export const unit3Review = ['u3.moveTwo', 'u3.stepCount.all', 'u3.capture', 'u3.attackedSquare', 'u3.epYesNo', 'u3.promoMove'];

const moveSentences = [
  sentence('forward', ['Ein', 'Bauer', 'zieht', 'vorwärts', 'und', 'schlägt', 'schräg.'], ['rückwärts', 'gerade.']),
  sentence('never', ['Ein', 'Bauer', 'darf', 'nie', 'rückwärts', 'ziehen.'], ['immer', 'seitwärts']),
  sentence('double', ['Den', 'Doppelschritt', 'gibt', 'es', 'nur', 'vom', 'Start', 'aus.'], ['jedem', 'Ende']),
];

const specialSentences = [
  sentence('ep', ['En', 'passant', 'geht', 'nur', 'im', 'nächsten', 'Zug.'], ['jederzeit', 'Läufer']),
  sentence('promotion', ['Auf', 'der', 'letzten', 'Reihe', 'wird', 'der', 'Bauer', 'umgewandelt.'], ['ersten', 'Dame']),
];

function pawnSamples(pool: readonly ChessSample[], themes: ReadonlySet<string> | null): ChessSample[] {
  return pool.filter((s) => themes === null || themes.has(s.theme));
}

function direction(draw: ChessDraw): LearnExercise | null {
  const color = draw.pick(CHESS_COLORS, 'u3.direction', colorGermanName);
  if (color === null) return null;
  const up = 'nach oben, zur 8. Reihe';
  const down = 'nach unten, zur 1. Reihe';
  return choice(
    {
      id: `u3.direction.${colorAdjectiveStem(color)}`, prompt: `In welche Richtung ziehen die ${colorAdjectiveStem(color)}en Bauern?`,
      correct: color === 'white' ? up : down, wrong: [color === 'white' ? down : up, 'zur Seite', 'in jede Richtung'],
      explanation: 'Bauern ziehen nur vorwärts: die weißen nach oben, die schwarzen nach unten.',
    },
    draw,
  );
}

function stepSample(draw: ChessDraw, topic: string, steps: number) {
  const usable = pawns.filter((sample) => {
    const position = samplePosition(sample);
    const focus = sampleFocus(sample);
    if (!position || focus === null) return false;
    const p = position.pieceAt(focus);
    if (!p || p.kind !== PAWN) return false;
    const target = squareOffset(focus, 0, steps * pawnDirection(p.color));
    return target !== null && position.isLegal(move(focus, target));
  });
  const sample = draw.pickSample(usable, topic);
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  const p = position.pieceAt(focus);
  if (!p) return null;
  const target = squareOffset(focus, 0, steps * pawnDirection(p.color));
  if (target === null) return null;
  return { sample, position, focus, target };
}

function moveOne(draw: ChessDraw): LearnExercise | null {
  const item = stepSample(draw, 'u3.moveOne', 1);
  if (!item) return null;
  return moveExercise({
    id: `u3.moveOne.${item.sample.id}`, prompt: `Ziehe den Bauern von ${squareName(item.focus)} ein Feld vor.`, position: item.position,
    goal: { type: 'moves', filter: { from: item.focus, to: item.target } }, explanation: 'Der Bauer zieht ein Feld geradeaus vorwärts.',
  });
}

function moveTwo(draw: ChessDraw): LearnExercise | null {
  const item = stepSample(draw, 'u3.moveTwo', 2);
  if (!item) return null;
  return moveExercise({
    id: `u3.moveTwo.${item.sample.id}`, prompt: `Ziehe den Bauern von ${squareName(item.focus)} zwei Felder vor.`, position: item.position,
    goal: { type: 'moves', filter: { from: item.focus, to: item.target } },
    explanation: 'Aus der Ausgangsstellung darf der Bauer zwei Felder ziehen, wenn beide Felder frei sind.',
  });
}

function stepCount(topic: string, themes: ReadonlySet<string> | null): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pawnSamples(pawns, themes), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    const focus = sampleFocus(sample);
    if (!position || focus === null) return null;
    const moves = position.legalMoves().filter((m) => m.from === focus);
    const straight = moves.filter((m) => squareFile(m.from) === squareFile(m.to)).length;
    const captures = moves.filter((m) => position.isCapture(m)).length;
    let explanation = `Geradeaus ${straight === 1 ? '1 Zug' : `${straight} Züge`}, schräg schlagen ${captures === 1 ? '1 Mal' : `${captures} Mal`}.`;
    if (moves.length === 0) explanation = 'Direkt vor dem Bauern steht eine Figur, und es gibt nichts zu schlagen: Er kann nicht ziehen.';
    return choice(
      {
        id: `${topic}.${sample.id}`, prompt: `Wie viele Züge hat der Bauer auf ${squareName(focus)}?`, correct: String(moves.length),
        wrong: numberWrongs(moves.length, [2], draw.random), explanation, media: boardMedia(position, [squareName(focus)]),
      },
      draw,
    );
  };
}

function doubleStep(draw: ChessDraw): LearnExercise | null {
  const themes = ['start', 'moved', 'blocked', 'blockedFar'];
  const pool = pawns.filter((s) => themes.includes(s.theme));
  const sample = draw.pickSample(pool, 'u3.doubleStep');
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  const p = position.pieceAt(focus);
  if (!p) return null;
  const one = squareOffset(focus, 0, pawnDirection(p.color));
  const two = squareOffset(focus, 0, 2 * pawnDirection(p.color));
  if (one === null || two === null) return null;
  const allowed = position.isLegal(move(focus, two));
  let reason: string;
  if (squareRank(focus) !== pawnStartRank(p.color)) {
    reason = 'Der Bauer ist schon gezogen: zwei Felder darf er nur aus der Ausgangsstellung.';
  } else if (position.pieceAt(one) !== null) {
    reason = 'Direkt vor dem Bauern steht eine Figur: Er kommt nicht vorbei.';
  } else if (position.pieceAt(two) !== null) {
    reason = `Das zweite Feld ${squareName(two)} ist besetzt: Der Doppelschritt braucht zwei freie Felder.`;
  } else {
    reason = 'Der Bauer steht noch auf seiner Ausgangsreihe, und beide Felder sind frei.';
  }
  return yesNo(
    {
      id: `u3.doubleStep.${sample.id}`, prompt: `Darf der Bauer auf ${squareName(focus)} jetzt zwei Felder ziehen?`, answer: allowed,
      explanation: reason, media: boardMedia(position, [squareName(focus)]),
    },
    draw,
  );
}

function capture(draw: ChessDraw): LearnExercise | null {
  const pool = pawns.filter((sample) => {
    const position = samplePosition(sample);
    const focus = sampleFocus(sample);
    if (!position || focus === null) return false;
    return position.legalMoves().some((m) => m.from === focus && position.isCapture(m));
  });
  const sample = draw.pickSample(pool, 'u3.capture');
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  return moveExercise({
    id: `u3.capture.${sample.id}`, prompt: `Schlage mit dem Bauern auf ${squareName(focus)} eine gegnerische Figur.`, position,
    goal: { type: 'moves', filter: { from: focus, capture: true } }, explanation: 'Der Bauer schlägt schräg vorwärts, nie geradeaus.',
  });
}

function captureDir(draw: ChessDraw): LearnExercise | null {
  return choice(
    {
      id: 'u3.captureDir', prompt: 'In welche Richtung schlägt ein Bauer?', correct: 'schräg vorwärts',
      wrong: ['geradeaus vorwärts', 'zur Seite', 'schräg rückwärts'],
      explanation: 'Der Bauer zieht geradeaus, schlägt aber schräg vorwärts. Eine Figur direkt vor ihm blockiert ihn nur.',
    },
    draw,
  );
}

function attackedSquare(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(pawns, 'u3.attackedSquare');
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  const p = position.pieceAt(focus);
  if (!p) return null;
  const attacked = attackedSquares(position, focus);
  const right = randomElement(attacked, draw.random);
  if (right === undefined) return null;
  const step = pawnDirection(p.color);
  const candidates = [
    squareOffset(focus, 0, step), squareOffset(focus, 1, 0), squareOffset(focus, -1, 0),
    squareOffset(focus, 1, -step), squareOffset(focus, -1, -step), squareOffset(focus, 0, -step),
  ];
  const wrong = candidates.filter((c): c is ChessSquare => c !== null).filter((c) => !attacked.includes(c)).map(squareName);
  return choice(
    {
      id: `u3.attackedSquare.${sample.id}`, prompt: 'Welches Feld greift der markierte Bauer an?', correct: squareName(right),
      wrong: shuffled(wrong, draw.random),
      explanation: `Ein ${colorAdjectiveStem(p.color)}er Bauer greift die Felder schräg vor sich an: ${list(attacked.map(squareName))}.`,
      media: boardMedia(position, [squareName(focus)]),
    },
    draw,
  );
}

function pairsMaker(draw: ChessDraw): LearnExercise | null {
  return pairs(
    {
      id: 'u3.pairs', prompt: 'Was ist was beim Bauern?',
      from: [
        { key: 'u3.pair.step', front: 'Schritt', back: 'ein Feld geradeaus' },
        { key: 'u3.pair.double', front: 'Doppelschritt', back: 'zwei Felder, nur vom Start' },
        { key: 'u3.pair.capture', front: 'Schlagen', back: 'ein Feld schräg vorwärts' },
        { key: 'u3.pair.promotion', front: 'Umwandlung', back: 'auf der letzten Reihe' },
      ],
    },
    draw,
  );
}

// En passant

/** The story that goes with an en passant position: where the pawn that just moved came from and went to. */
export function doubleStepStory(position: ChessPosition): string | null {
  const target = position.enPassant;
  if (target === null) return null;
  const mover = oppositeColor(position.sideToMove);
  const from = squareAt(squareFile(target), pawnStartRank(mover));
  const to = squareAt(squareFile(target), pawnStartRank(mover) + 2 * pawnDirection(mover));
  if (from === null || to === null) return null;
  return `${colorGermanName(mover)} hat gerade den Bauern von ${squareName(from)} nach ${squareName(to)} gezogen.`;
}

function epMove(draw: ChessDraw): LearnExercise | null {
  const pool = enPassant.filter((s) => s.theme === 'available');
  const sample = draw.pickSample(pool, 'u3.epMove');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const story = doubleStepStory(position);
  const target = position.enPassant;
  if (story === null || target === null) return null;
  return moveExercise({
    id: `u3.epMove.${sample.id}`, prompt: `${story} Schlage ihn en passant.`, position,
    goal: { type: 'moves', filter: { enPassant: true } },
    explanation: `Du schlägst den Bauern, als wäre er nur ein Feld gezogen: Dein Bauer landet auf ${squareName(target)}, und der gegnerische Bauer verschwindet.`,
  });
}

/** "Darf der Bauer en passant schlagen?": the story tells what the last move was, the engine says whether it is legal. */
export function epYesNo(topic: string, themes: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const pool = enPassant.filter((s) => themes.has(s.theme));
    const sample = draw.pickSample(pool, topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    const focus = sampleFocus(sample);
    const neighbour = sampleDetailSquare(sample);
    if (!position || focus === null || neighbour === null) return null;
    const neighbourPiece = position.pieceAt(neighbour);
    if (!neighbourPiece) return null;
    const allowed = position.legalMoves().some((m) => m.from === focus && position.isEnPassant(m));
    const opponent = oppositeColor(position.sideToMove);
    let story: string;
    switch (sample.theme) {
      case 'late':
        story = `Der ${colorAdjectiveStem(opponent)}e Bauer steht schon länger auf ${squareName(neighbour)}.`;
        break;
      case 'single': {
        const from = squareAt(squareFile(neighbour), squareRank(neighbour) - pawnDirection(neighbourPiece.color));
        story = `${colorGermanName(opponent)} hat den Bauern gerade von ${from === null ? '' : squareName(from)} nach ${squareName(neighbour)} gezogen, nur ein Feld.`;
        break;
      }
      default:
        story = doubleStepStory(position) ?? '';
    }
    let explanation: string;
    if (allowed) {
      explanation = 'Der Bauer ist im letzten Zug zwei Felder gezogen und steht neben deinem: Du darfst jetzt, aber nur jetzt, en passant schlagen.';
    } else if (sample.theme === 'pinned') {
      explanation = 'Nach dem Schlagen wären beide Bauern von der Reihe verschwunden, und der gegnerische Turm griffe deinen König an. Ein Zug, der den eigenen König ins Schach stellt, ist verboten.';
    } else {
      explanation = 'En passant gibt es nur direkt nach einem Doppelschritt des gegnerischen Bauern.';
    }
    return yesNo(
      {
        id: `${topic}.${sample.id}`,
        prompt: `${story} Darf der Bauer auf ${squareName(focus)} den Bauern auf ${squareName(neighbour)} en passant schlagen?`,
        answer: allowed, explanation, media: boardMedia(position, [squareName(focus), squareName(neighbour)]),
      },
      draw,
    );
  };
}

// Promotion

function promoMove(draw: ChessDraw): LearnExercise | null {
  const pool = promotions.filter((s) => ['step', 'capture'].includes(s.theme));
  const sample = draw.pickSample(pool, 'u3.promoMove');
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  return moveExercise({
    id: `u3.promoMove.${sample.id}`, prompt: 'Dein Bauer erreicht die letzte Reihe. Ziehe ihn und wandle ihn in eine Dame um.', position,
    goal: { type: 'moves', filter: { from: focus, promotionTo: QUEEN } },
    explanation: 'Auf der letzten Reihe muss sich der Bauer umwandeln, und die Dame ist meist die stärkste Wahl.',
  });
}

function promoWhich(draw: ChessDraw): LearnExercise | null {
  return choice(
    {
      id: 'u3.promoWhich', prompt: 'In welche Figuren darf sich ein Bauer umwandeln?', correct: 'Dame, Turm, Läufer oder Springer',
      wrong: ['nur in eine Dame', 'Dame, Turm, Läufer, Springer oder König', 'nur in eine Figur, die schon geschlagen wurde'],
      explanation: 'Erlaubt sind Dame, Turm, Läufer und Springer, auch wenn diese Figur noch auf dem Brett steht. König oder Bauer gibt es nicht.',
    },
    draw,
  );
}

function promoRank(draw: ChessDraw): LearnExercise | null {
  const color = draw.pick(CHESS_COLORS, 'u3.promoRank', colorGermanName);
  if (color === null) return null;
  const right = promotionRank(color) + 1;
  return choice(
    {
      id: `u3.promoRank.${colorAdjectiveStem(color)}`, prompt: `Auf welcher Reihe wandelt sich ein ${colorAdjectiveStem(color)}er Bauer um?`, correct: String(right),
      wrong: numberWrongs(right, [9 - right, color === 'white' ? 7 : 2, 4], draw.random, 1),
      explanation: 'Ein Bauer wandelt sich auf der letzten Reihe um, die er erreichen kann: bei Weiß die 8., bei Schwarz die 1. Reihe.',
    },
    draw,
  );
}

function promoSteps(draw: ChessDraw): LearnExercise | null {
  const pool = promotions.filter((s) => ['step', 'far'].includes(s.theme));
  const sample = draw.pickSample(pool, 'u3.promoSteps');
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  const p = position.pieceAt(focus);
  if (!p) return null;
  const steps = Math.abs(promotionRank(p.color) - squareRank(focus));
  return number({
    id: `u3.promoSteps.${sample.id}`, prompt: `Wie viele Züge braucht der Bauer auf ${squareName(focus)} mindestens bis zur Umwandlung?`, answer: steps,
    explanation: `Der Bauer muss von Reihe ${squareRank(focus) + 1} bis Reihe ${promotionRank(p.color) + 1}: ${steps} ${steps === 1 ? 'Schritt' : 'Schritte'}, der letzte ist die Umwandlung.`,
    media: boardMedia(position, [squareName(focus)]),
  });
}

export const unit3Makers: Record<string, ChessMaker> = {
  'u3.direction': direction,
  'u3.moveOne': moveOne,
  'u3.moveTwo': moveTwo,
  'u3.stepCount.simple': stepCount('u3.stepCount.simple', new Set(['start', 'moved', 'blocked', 'blockedFar'])),
  'u3.stepCount.all': stepCount('u3.stepCount.all', null),
  'u3.doubleStep': doubleStep,
  'u3.capture': capture,
  'u3.captureDir': captureDir,
  'u3.attackedSquare': attackedSquare,
  'u3.pairs': pairsMaker,
  'u3.sentence.move': sentenceMaker('u3.sentence.move', moveSentences),
  'u3.sentence.special': sentenceMaker('u3.sentence.special', specialSentences),
  'u3.epMove': epMove,
  'u3.epYesNo': epYesNo('u3.epYesNo', new Set(['available', 'late', 'single'])),
  'u3.promoMove': promoMove,
  'u3.promoWhich': promoWhich,
  'u3.promoRank': promoRank,
  'u3.promoSteps': promoSteps,
};
