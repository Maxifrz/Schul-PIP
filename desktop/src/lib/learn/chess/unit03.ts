import type { LearnExercise } from '../exercise';
import { attackedSquares } from './analysis';
import { moves } from './goals';
import { ChessDraw, ChessKit, ChessMaker, ChessSentence } from './kit';
import { ChessPosition } from './position';
import { ChessSample, detailSquare, enPassant, focusSquare, pawns, promotions, samplePosition } from './samples';
import { ChessColor, Sq, adjectiveStem, colorName, colors, move as makeMove, opposite, pawnDirection, pawnStartRank, promotionRank } from './types';

const moveSentences: ChessSentence[] = [
  { key: 'forward', words: ['Ein', 'Bauer', 'zieht', 'vorwärts', 'und', 'schlägt', 'schräg.'], extra: ['rückwärts', 'gerade.'] },
  { key: 'never', words: ['Ein', 'Bauer', 'darf', 'nie', 'rückwärts', 'ziehen.'], extra: ['immer', 'seitwärts'] },
  { key: 'double', words: ['Den', 'Doppelschritt', 'gibt', 'es', 'nur', 'vom', 'Start', 'aus.'], extra: ['jedem', 'Ende'] },
];

const specialSentences: ChessSentence[] = [
  { key: 'ep', words: ['En', 'passant', 'geht', 'nur', 'im', 'nächsten', 'Zug.'], extra: ['jederzeit', 'Läufer'] },
  { key: 'promotion', words: ['Auf', 'der', 'letzten', 'Reihe', 'wird', 'der', 'Bauer', 'umgewandelt.'], extra: ['ersten', 'Dame'] },
];

/** Unit 3, "Der Bauer": step and double step, capturing, en passant, promotion. */
export const ChessUnit3 = {
  review: ['u3.moveTwo', 'u3.stepCount.all', 'u3.capture', 'u3.attackedSquare', 'u3.epYesNo', 'u3.promoMove'],

  get makers(): Record<string, ChessMaker> {
    return {
      'u3.direction': direction,
      'u3.moveOne': moveOne,
      'u3.moveTwo': moveTwo,
      'u3.stepCount.simple': stepCount('u3.stepCount.simple', new Set(['start', 'moved', 'blocked', 'blockedFar'])),
      'u3.stepCount.all': stepCount('u3.stepCount.all', null),
      'u3.doubleStep': doubleStep,
      'u3.capture': capture,
      'u3.captureDir': captureDir,
      'u3.attackedSquare': attackedSquare,
      'u3.pairs': pairs,
      'u3.sentence.move': ChessKit.sentenceMaker('u3.sentence.move', moveSentences),
      'u3.sentence.special': ChessKit.sentenceMaker('u3.sentence.special', specialSentences),
      'u3.epMove': epMove,
      'u3.epYesNo': epYesNo('u3.epYesNo', new Set(['available', 'late', 'single'])),
      'u3.promoMove': promoMove,
      'u3.promoWhich': promoWhich,
      'u3.promoRank': promoRank,
      'u3.promoSteps': promoSteps,
    };
  },
};

const pawnSamples = (pool: ChessSample[], themes: Set<string> | null) => pool.filter((s) => themes === null || themes.has(s.theme));

function direction(draw: ChessDraw): LearnExercise | null {
  const color = draw.pick(colors, 'u3.direction', (c) => colorName(c));
  if (!color) return null;
  const up = 'nach oben, zur 8. Reihe';
  const down = 'nach unten, zur 1. Reihe';
  return ChessKit.choice({
    id: `u3.direction.${adjectiveStem(color)}`, prompt: `In welche Richtung ziehen die ${adjectiveStem(color)}en Bauern?`,
    correct: color === 'white' ? up : down, wrong: [color === 'white' ? down : up, 'zur Seite', 'in jede Richtung'],
    explanation: 'Bauern ziehen nur vorwärts: die weißen nach oben, die schwarzen nach unten.', draw,
  });
}

function stepSample(draw: ChessDraw, topic: string, steps: number) {
  const usable = pawns.filter((sample) => {
    const position = samplePosition(sample);
    const focus = focusSquare(sample);
    const p = position && focus !== null ? position.at(focus) : null;
    if (!position || focus === null || !p || p.kind !== 'pawn') return false;
    const target = Sq.offset(focus, 0, steps * pawnDirection(p.color));
    return target !== null && position.isLegal(makeMove(focus, target));
  });
  const sample = draw.pickSample(usable, topic);
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  const p = position && focus !== null ? position.at(focus) : null;
  const target = p && focus !== null ? Sq.offset(focus, 0, steps * pawnDirection(p.color)) : null;
  if (!sample || !position || focus === null || !p || target === null) return null;
  return { sample, position, focus, target };
}

function moveOne(draw: ChessDraw): LearnExercise | null {
  const item = stepSample(draw, 'u3.moveOne', 1);
  if (!item) return null;
  return ChessKit.moveExercise({
    id: `u3.moveOne.${item.sample.id}`, prompt: `Ziehe den Bauern von ${Sq.name(item.focus)} ein Feld vor.`, position: item.position,
    goal: moves({ from: item.focus, to: item.target }), explanation: 'Der Bauer zieht ein Feld geradeaus vorwärts.',
  });
}

function moveTwo(draw: ChessDraw): LearnExercise | null {
  const item = stepSample(draw, 'u3.moveTwo', 2);
  if (!item) return null;
  return ChessKit.moveExercise({
    id: `u3.moveTwo.${item.sample.id}`, prompt: `Ziehe den Bauern von ${Sq.name(item.focus)} zwei Felder vor.`, position: item.position,
    goal: moves({ from: item.focus, to: item.target }),
    explanation: 'Aus der Ausgangsstellung darf der Bauer zwei Felder ziehen, wenn beide Felder frei sind.',
  });
}

function stepCount(topic: string, themes: Set<string> | null): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pawnSamples(pawns, themes), topic);
    const position = sample ? samplePosition(sample) : null;
    const focus = sample ? focusSquare(sample) : null;
    if (!sample || !position || focus === null) return null;
    const list = position.legalMoves().filter((m) => m.from === focus);
    const straight = list.filter((m) => Sq.file(m.from) === Sq.file(m.to)).length;
    const captures = list.filter((m) => position.isCapture(m)).length;
    let explanation = `Geradeaus ${straight === 1 ? '1 Zug' : `${straight} Züge`}, schräg schlagen ${captures === 1 ? '1 Mal' : `${captures} Mal`}.`;
    if (list.length === 0) explanation = 'Direkt vor dem Bauern steht eine Figur, und es gibt nichts zu schlagen: Er kann nicht ziehen.';
    return ChessKit.choice({
      id: `${topic}.${sample.id}`, prompt: `Wie viele Züge hat der Bauer auf ${Sq.name(focus)}?`, correct: String(list.length),
      wrong: ChessKit.numberWrongs({ correct: list.length, likely: [2], random: draw.random }), explanation,
      media: ChessKit.board(position, [Sq.name(focus)]), draw,
    });
  };
}

function doubleStep(draw: ChessDraw): LearnExercise | null {
  const pool = pawns.filter((s) => ['start', 'moved', 'blocked', 'blockedFar'].includes(s.theme));
  const sample = draw.pickSample(pool, 'u3.doubleStep');
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  const p = position && focus !== null ? position.at(focus) : null;
  if (!sample || !position || focus === null || !p) return null;
  const one = Sq.offset(focus, 0, pawnDirection(p.color));
  const two = Sq.offset(focus, 0, 2 * pawnDirection(p.color));
  if (one === null || two === null) return null;
  const allowed = position.isLegal(makeMove(focus, two));
  let reason: string;
  if (Sq.rank(focus) !== pawnStartRank(p.color)) reason = 'Der Bauer ist schon gezogen: zwei Felder darf er nur aus der Ausgangsstellung.';
  else if (position.at(one)) reason = 'Direkt vor dem Bauern steht eine Figur: Er kommt nicht vorbei.';
  else if (position.at(two)) reason = `Das zweite Feld ${Sq.name(two)} ist besetzt: Der Doppelschritt braucht zwei freie Felder.`;
  else reason = 'Der Bauer steht noch auf seiner Ausgangsreihe, und beide Felder sind frei.';
  return ChessKit.yesNo({
    id: `u3.doubleStep.${sample.id}`, prompt: `Darf der Bauer auf ${Sq.name(focus)} jetzt zwei Felder ziehen?`, answer: allowed,
    explanation: reason, media: ChessKit.board(position, [Sq.name(focus)]), draw,
  });
}

function capture(draw: ChessDraw): LearnExercise | null {
  const pool = pawns.filter((sample) => {
    const position = samplePosition(sample);
    const focus = focusSquare(sample);
    return !!position && focus !== null && position.legalMoves().some((m) => m.from === focus && position.isCapture(m));
  });
  const sample = draw.pickSample(pool, 'u3.capture');
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  if (!sample || !position || focus === null) return null;
  return ChessKit.moveExercise({
    id: `u3.capture.${sample.id}`, prompt: `Schlage mit dem Bauern auf ${Sq.name(focus)} eine gegnerische Figur.`, position,
    goal: moves({ from: focus, capture: true }), explanation: 'Der Bauer schlägt schräg vorwärts, nie geradeaus.',
  });
}

function captureDir(draw: ChessDraw): LearnExercise | null {
  return ChessKit.choice({
    id: 'u3.captureDir', prompt: 'In welche Richtung schlägt ein Bauer?', correct: 'schräg vorwärts',
    wrong: ['geradeaus vorwärts', 'zur Seite', 'schräg rückwärts'],
    explanation: 'Der Bauer zieht geradeaus, schlägt aber schräg vorwärts. Eine Figur direkt vor ihm blockiert ihn nur.', draw,
  });
}

function attackedSquare(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(pawns, 'u3.attackedSquare');
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  const p = position && focus !== null ? position.at(focus) : null;
  if (!sample || !position || focus === null || !p) return null;
  const attacked = attackedSquares(position, focus);
  const right = draw.randomElement(attacked);
  if (right === null) return null;
  const step = pawnDirection(p.color);
  const candidates = [Sq.offset(focus, 0, step), Sq.offset(focus, 1, 0), Sq.offset(focus, -1, 0), Sq.offset(focus, 1, -step), Sq.offset(focus, -1, -step), Sq.offset(focus, 0, -step)];
  const wrong = candidates.filter((s): s is number => s !== null).filter((s) => !attacked.includes(s)).map(Sq.name);
  return ChessKit.choice({
    id: `u3.attackedSquare.${sample.id}`, prompt: 'Welches Feld greift der markierte Bauer an?', correct: Sq.name(right), wrong: draw.shuffled(wrong),
    explanation: `Ein ${adjectiveStem(p.color)}er Bauer greift die Felder schräg vor sich an: ${ChessKit.list(attacked.map(Sq.name))}.`,
    media: ChessKit.board(position, [Sq.name(focus)]), draw,
  });
}

function pairs(draw: ChessDraw): LearnExercise | null {
  return ChessKit.pairs({
    id: 'u3.pairs', prompt: 'Was ist was beim Bauern?', draw,
    from: [
      { key: 'u3.pair.step', front: 'Schritt', back: 'ein Feld geradeaus' },
      { key: 'u3.pair.double', front: 'Doppelschritt', back: 'zwei Felder, nur vom Start' },
      { key: 'u3.pair.capture', front: 'Schlagen', back: 'ein Feld schräg vorwärts' },
      { key: 'u3.pair.promotion', front: 'Umwandlung', back: 'auf der letzten Reihe' },
    ],
  });
}

// En passant

/** The story that goes with an en passant position: where the pawn that just moved came from and went to. */
export function doubleStepStory(position: ChessPosition): string | null {
  const target = position.enPassant;
  if (target === null) return null;
  const mover: ChessColor = opposite(position.sideToMove);
  const from = Sq.at(Sq.file(target), pawnStartRank(mover));
  const to = Sq.at(Sq.file(target), pawnStartRank(mover) + 2 * pawnDirection(mover));
  if (from === null || to === null) return null;
  return `${colorName(mover)} hat gerade den Bauern von ${Sq.name(from)} nach ${Sq.name(to)} gezogen.`;
}

function epMove(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(enPassant.filter((s) => s.theme === 'available'), 'u3.epMove');
  const position = sample ? samplePosition(sample) : null;
  const story = position ? doubleStepStory(position) : null;
  if (!sample || !position || story === null || position.enPassant === null) return null;
  return ChessKit.moveExercise({
    id: `u3.epMove.${sample.id}`, prompt: `${story} Schlage ihn en passant.`, position,
    goal: moves({ enPassant: true }),
    explanation: `Du schlägst den Bauern, als wäre er nur ein Feld gezogen: Dein Bauer landet auf ${Sq.name(position.enPassant)}, und der gegnerische Bauer verschwindet.`,
  });
}

/** "Darf der Bauer en passant schlagen?": the story tells what the last move was, the engine says whether it is legal. */
export function epYesNo(topic: string, themes: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(enPassant.filter((s) => themes.has(s.theme)), topic);
    const position = sample ? samplePosition(sample) : null;
    const focus = sample ? focusSquare(sample) : null;
    const neighbour = sample ? detailSquare(sample) : null;
    const neighbourPiece = position && neighbour !== null ? position.at(neighbour) : null;
    if (!sample || !position || focus === null || neighbour === null || !neighbourPiece) return null;
    const allowed = position.legalMoves().some((m) => m.from === focus && position.isEnPassant(m));
    const opponent = opposite(position.sideToMove);
    let story: string;
    switch (sample.theme) {
      case 'late': story = `Der ${adjectiveStem(opponent)}e Bauer steht schon länger auf ${Sq.name(neighbour)}.`; break;
      case 'single': {
        const from = Sq.at(Sq.file(neighbour), Sq.rank(neighbour) - pawnDirection(neighbourPiece.color));
        story = `${colorName(opponent)} hat den Bauern gerade von ${from === null ? '' : Sq.name(from)} nach ${Sq.name(neighbour)} gezogen, nur ein Feld.`;
        break;
      }
      default: story = doubleStepStory(position) ?? '';
    }
    let explanation: string;
    if (allowed) explanation = 'Der Bauer ist im letzten Zug zwei Felder gezogen und steht neben deinem: Du darfst jetzt, aber nur jetzt, en passant schlagen.';
    else if (sample.theme === 'pinned') explanation = 'Nach dem Schlagen wären beide Bauern von der Reihe verschwunden, und der gegnerische Turm griffe deinen König an. Ein Zug, der den eigenen König ins Schach stellt, ist verboten.';
    else explanation = 'En passant gibt es nur direkt nach einem Doppelschritt des gegnerischen Bauern.';
    return ChessKit.yesNo({
      id: `${topic}.${sample.id}`, prompt: `${story} Darf der Bauer auf ${Sq.name(focus)} den Bauern auf ${Sq.name(neighbour)} en passant schlagen?`,
      answer: allowed, explanation, media: ChessKit.board(position, [Sq.name(focus), Sq.name(neighbour)]), draw,
    });
  };
}

// Promotion

function promoMove(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(promotions.filter((s) => ['step', 'capture'].includes(s.theme)), 'u3.promoMove');
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  if (!sample || !position || focus === null) return null;
  return ChessKit.moveExercise({
    id: `u3.promoMove.${sample.id}`, prompt: 'Dein Bauer erreicht die letzte Reihe. Ziehe ihn und wandle ihn in eine Dame um.', position,
    goal: moves({ from: focus, promotionTo: 'queen' }),
    explanation: 'Auf der letzten Reihe muss sich der Bauer umwandeln, und die Dame ist meist die stärkste Wahl.',
  });
}

function promoWhich(draw: ChessDraw): LearnExercise | null {
  return ChessKit.choice({
    id: 'u3.promoWhich', prompt: 'In welche Figuren darf sich ein Bauer umwandeln?', correct: 'Dame, Turm, Läufer oder Springer',
    wrong: ['nur in eine Dame', 'Dame, Turm, Läufer, Springer oder König', 'nur in eine Figur, die schon geschlagen wurde'],
    explanation: 'Erlaubt sind Dame, Turm, Läufer und Springer, auch wenn diese Figur noch auf dem Brett steht. König oder Bauer gibt es nicht.', draw,
  });
}

function promoRank(draw: ChessDraw): LearnExercise | null {
  const color = draw.pick(colors, 'u3.promoRank', (c) => colorName(c));
  if (!color) return null;
  const right = promotionRank(color) + 1;
  return ChessKit.choice({
    id: `u3.promoRank.${adjectiveStem(color)}`, prompt: `Auf welcher Reihe wandelt sich ein ${adjectiveStem(color)}er Bauer um?`, correct: String(right),
    wrong: ChessKit.numberWrongs({ correct: right, likely: [9 - right, color === 'white' ? 7 : 2, 4], random: draw.random, minimum: 1 }),
    explanation: 'Ein Bauer wandelt sich auf der letzten Reihe um, die er erreichen kann: bei Weiß die 8., bei Schwarz die 1. Reihe.', draw,
  });
}

function promoSteps(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(promotions.filter((s) => ['step', 'far'].includes(s.theme)), 'u3.promoSteps');
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  const p = position && focus !== null ? position.at(focus) : null;
  if (!sample || !position || focus === null || !p) return null;
  const steps = Math.abs(promotionRank(p.color) - Sq.rank(focus));
  return ChessKit.number({
    id: `u3.promoSteps.${sample.id}`, prompt: `Wie viele Züge braucht der Bauer auf ${Sq.name(focus)} mindestens bis zur Umwandlung?`, answer: steps,
    explanation: `Der Bauer muss von Reihe ${Sq.rank(focus) + 1} bis Reihe ${promotionRank(p.color) + 1}: ${steps} ${steps === 1 ? 'Schritt' : 'Schritte'}, der letzte ist die Umwandlung.`,
    media: ChessKit.board(position, [Sq.name(focus)]),
  });
}
