// Unit 2, "Die Figuren und ihre Züge": the starting position, how each piece moves and captures.
// Port of ChessUnit2.swift.

import type { LearnExercise } from '../../exercise';
import { randomElement, shuffled } from '../../random';
import { attackedEnemies } from '../analysis';
import { ChessGeometry, accusative, dative, indefinite, list, nominative, ruleOf } from '../kit';
import { ChessPosition } from '../position';
import {
  ALL_PIECE_KINDS, ALL_SQUARES, BISHOP, CHESS_COLORS, KING, KNIGHT, PAWN, QUEEN, ROOK, colorAdjectiveStem, colorGermanName,
  isDarkSquare, kindGermanName, kindLetter, piece, piecePhrase, square as squareAt, squareFile, squareName, squareRank,
  type ChessPieceKind, type ChessSquare,
} from '../types';
import {
  boardMedia, choice, emptyBoard, fenBoard, moveExercise, number, numberWrongs, pairs, sentence, sentenceMaker, type ChessDraw,
  type ChessMaker,
} from './courseKit';
import { crowded, pieceMoves, pieceMovesOf, sampleFocus, samplePosition, type ChessSample } from './samples';

const sliders: ReadonlySet<string> = new Set(['rook', 'bishop', 'queen']);
const steppers: ReadonlySet<string> = new Set(['king', 'knight']);
const allPieces: ReadonlySet<string> = new Set([...sliders, ...steppers]);

export const unit2Review = ['u2.identify', 'u2.moveTo.all', 'u2.count.all', 'u2.whichPiece', 'u2.reach.all', 'u2.captureMove'];

const slideSentences = [
  sentence('bishop', ['Der', 'Läufer', 'zieht', 'nur', 'schräg.'], ['gerade.', 'springt']),
  sentence('rook', ['Der', 'Turm', 'zieht', 'nur', 'gerade.'], ['schräg.', 'L-förmig.']),
  sentence('queen', ['Die', 'Dame', 'zieht', 'wie', 'Turm', 'und', 'Läufer', 'zusammen.'], ['König', 'Springer']),
];

const stepSentences = [
  sentence('knight', ['Nur', 'der', 'Springer', 'darf', 'über', 'Figuren', 'springen.'], ['Läufer', 'Turm']),
  sentence('king', ['Der', 'König', 'zieht', 'nur', 'ein', 'Feld', 'weit.'], ['zwei', 'Springer']),
  sentence('attacked', ['Der', 'König', 'darf', 'nicht', 'auf', 'angegriffene', 'Felder', 'ziehen.'], ['immer', 'Bauern']),
];

// The starting position

function identify(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(crowded, 'u2.identify');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const found = randomElement(position.pieces, draw.random);
  if (found === undefined) return null;
  const { square, piece: p } = found;
  const wrong = shuffled(ALL_PIECE_KINDS.filter((k) => k !== p.kind).map(kindGermanName), draw.random);
  return choice(
    {
      id: `u2.identify.${sample.id}.${squareName(square)}`, prompt: 'Welche Figur steht auf dem markierten Feld?', correct: kindGermanName(p.kind),
      wrong, explanation: `Auf ${squareName(square)} steht ${indefinite(p.kind)}.`,
      media: fenBoard(position.fen, [squareName(square)]),
    },
    draw,
  );
}

function startSquare(draw: ChessDraw): LearnExercise | null {
  const pieces = [piece('white', KING), piece('black', KING), piece('white', QUEEN), piece('black', QUEEN)];
  const p = draw.pick(pieces, 'u2.startSquare', (x) => piecePhrase(x));
  if (!p) return null;
  const start = ChessPosition.start;
  const sq = start.squaresOfPiece(p)[0];
  if (sq === undefined) return null;
  const partner = piece(p.color, p.kind === KING ? QUEEN : KING);
  const partnerSquare = start.squaresOfPiece(partner)[0];
  const opposite = squareAt(squareFile(sq), 7 - squareRank(sq));
  const side = squareAt(squareFile(sq) + (p.kind === KING ? 1 : -1), squareRank(sq));
  if (partnerSquare === undefined || opposite === null || side === null) return null;
  return choice(
    {
      id: `u2.startSquare.${colorAdjectiveStem(p.color)}.${kindGermanName(p.kind)}`,
      prompt: `Auf welchem Feld steht am Anfang ${piecePhrase(p)}?`, correct: squareName(sq),
      wrong: [squareName(partnerSquare), squareName(opposite), squareName(side)],
      explanation: 'Die Dame steht auf d1 und d8, der König daneben auf e1 und e8.',
      media: fenBoard(start.fen),
    },
    draw,
  );
}

function queenColor(draw: ChessDraw): LearnExercise | null {
  const color = draw.pick(CHESS_COLORS, 'u2.queenColor', colorGermanName);
  if (color === null) return null;
  const start = ChessPosition.start;
  const sq = start.squaresOfPiece(piece(color, QUEEN))[0];
  if (sq === undefined) return null;
  const word = isDarkSquare(sq) ? 'dunkel' : 'hell';
  return choice(
    {
      id: `u2.queenColor.${colorAdjectiveStem(color)}`, prompt: `Welche Farbe hat das Startfeld der ${colorAdjectiveStem(color)}en Dame?`, correct: word,
      wrong: [isDarkSquare(sq) ? 'hell' : 'dunkel'],
      explanation: 'Die Dame steht am Anfang auf ihrer eigenen Farbe: Weiß auf d1 (hell), Schwarz auf d8 (dunkel).',
      media: fenBoard(start.fen),
    },
    draw,
  );
}

interface StartCount {
  key: string;
  prompt: string;
  answer: number;
  likely: number[];
  explanation: string;
}

function startCounts(): StartCount[] {
  const start = ChessPosition.start;
  const count = (kind: ChessPieceKind): number => start.count(piece('white', kind));
  return [
    { key: 'pawns', prompt: 'Wie viele Bauern hat jede Seite am Anfang?', answer: count(PAWN), likely: [6, 10, 16], explanation: 'Auf der 2. Reihe stehen die 8 weißen Bauern, auf der 7. Reihe die 8 schwarzen.' },
    { key: 'rooks', prompt: 'Wie viele Türme hat jede Seite am Anfang?', answer: count(ROOK), likely: [1, 3, 4], explanation: 'Die Türme stehen in den Ecken, auf a1 und h1 (Schwarz: a8 und h8).' },
    { key: 'knights', prompt: 'Wie viele Springer hat jede Seite am Anfang?', answer: count(KNIGHT), likely: [1, 3, 4], explanation: 'Die Springer stehen auf b1 und g1 (Schwarz: b8 und g8).' },
    { key: 'bishops', prompt: 'Wie viele Läufer hat jede Seite am Anfang?', answer: count(BISHOP), likely: [1, 3, 4], explanation: 'Die Läufer stehen auf c1 und f1 (Schwarz: c8 und f8).' },
    { key: 'all', prompt: 'Wie viele Figuren stehen am Anfang auf dem Brett, die Bauern mitgezählt?', answer: start.pieces.length, likely: [16, 24, 40], explanation: 'Jede Seite hat 16: einen König, eine Dame, zwei Türme, zwei Läufer, zwei Springer und acht Bauern.' },
  ];
}

function startCountChoice(draw: ChessDraw): LearnExercise | null {
  const item = draw.pick(startCounts(), 'u2.startCount', (c) => c.key);
  if (!item) return null;
  return choice(
    {
      id: `u2.startCountChoice.${item.key}`, prompt: item.prompt, correct: String(item.answer),
      wrong: numberWrongs(item.answer, item.likely, draw.random), explanation: item.explanation, media: fenBoard(ChessPosition.startFEN),
    },
    draw,
  );
}

function startCountNumber(draw: ChessDraw): LearnExercise | null {
  const item = draw.pick(startCounts(), 'u2.startCount', (c) => c.key);
  if (!item) return null;
  return number({
    id: `u2.startCountNumber.${item.key}`, prompt: item.prompt, answer: item.answer, explanation: item.explanation,
    media: fenBoard(ChessPosition.startFEN),
  });
}

function letters(draw: ChessDraw): LearnExercise | null {
  const kinds: ChessPieceKind[] = [KING, QUEEN, ROOK, BISHOP, KNIGHT];
  return pairs(
    {
      id: 'u2.letters', prompt: 'Welcher Buchstabe gehört zu welcher Figur?',
      from: kinds.map((k) => ({ key: `u2.letter.${kindGermanName(k)}`, front: kindGermanName(k), back: kindLetter(k) })),
    },
    draw,
  );
}

function movePairs(draw: ChessDraw): LearnExercise | null {
  return pairs(
    {
      id: 'u2.movePairs', prompt: 'Wie zieht welche Figur?',
      from: [
        { key: 'u2.move.king', front: 'König', back: 'ein Feld in jede Richtung' },
        { key: 'u2.move.queen', front: 'Dame', back: 'gerade und schräg, beliebig weit' },
        { key: 'u2.move.rook', front: 'Turm', back: 'gerade, beliebig weit' },
        { key: 'u2.move.bishop', front: 'Läufer', back: 'schräg, beliebig weit' },
        { key: 'u2.move.knight', front: 'Springer', back: 'L-Sprung über Figuren' },
      ],
    },
    draw,
  );
}

// Counting and moving

/** The sentence that follows a count: the piece's rule, and why fewer squares than on an empty board. */
function countExplanation(kind: ChessPieceKind, count: number, onEmptyBoard: number): string {
  let text = ruleOf(kind);
  if (count < onEmptyBoard) {
    switch (kind) {
      case KING: text += ' Er darf nicht auf angegriffene Felder und nicht neben den gegnerischen König.'; break;
      case KNIGHT: text += ' Auf Felder mit eigenen Figuren darf er nicht.'; break;
      default: text += ' Eigene Figuren versperren den Weg, gegnerische darf er schlagen, dahinter geht es nicht weiter.';
    }
  }
  return text + ` Möglich sind ${count} ${count === 1 ? 'Feld' : 'Felder'}.`;
}

/** The squares a piece on `focus` can move to (a promotion counts its square once). */
export function destinationsOf(focus: ChessSquare, position: ChessPosition): ChessSquare[] {
  const seen = new Set<ChessSquare>();
  return position.legalMoves().filter((m) => m.from === focus).map((m) => m.to).filter((to) => {
    if (seen.has(to)) return false;
    seen.add(to);
    return true;
  });
}

function countSample(draw: ChessDraw, topic: string, kinds: ReadonlySet<string>) {
  const sample = draw.pickSample(pieceMovesOf(kinds), topic);
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  const p = position.pieceAt(focus);
  if (!p) return null;
  const count = destinationsOf(focus, position).length;
  return { sample, position, focus, piece: p, count, empty: ChessGeometry.reach(p.kind, focus).length };
}

function countChoice(topic: string, kinds: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const item = countSample(draw, topic, kinds);
    if (!item) return null;
    return choice(
      {
        id: `${topic}.${item.sample.id}`,
        prompt: `Auf wie viele Felder kann ${nominative(item.piece.kind)} auf ${squareName(item.focus)} ziehen?`,
        correct: String(item.count),
        wrong: numberWrongs(item.count, [item.empty], draw.random),
        explanation: countExplanation(item.piece.kind, item.count, item.empty),
        media: boardMedia(item.position, [squareName(item.focus)]),
      },
      draw,
    );
  };
}

function countNumber(topic: string, kinds: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const item = countSample(draw, topic, kinds);
    if (!item) return null;
    return number({
      id: `${topic}.${item.sample.id}`,
      prompt: `Auf wie viele Felder kann ${nominative(item.piece.kind)} auf ${squareName(item.focus)} ziehen? (Schlagen zählt mit.)`,
      answer: item.count, explanation: countExplanation(item.piece.kind, item.count, item.empty),
      media: boardMedia(item.position, [squareName(item.focus)]),
    });
  };
}

function moveTo(topic: string, kinds: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pieceMovesOf(kinds), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    const focus = sampleFocus(sample);
    if (!position || focus === null) return null;
    const p = position.pieceAt(focus);
    if (!p) return null;
    const targets = destinationsOf(focus, position);
    const target = randomElement(targets, draw.random);
    if (target === undefined) return null;
    return moveExercise({
      id: `${topic}.${sample.id}.${squareName(target)}`,
      prompt: `Ziehe ${accusative(p.kind)} von ${squareName(focus)} nach ${squareName(target)}.`, position,
      goal: { type: 'moves', filter: { from: focus, to: target } }, explanation: ruleOf(p.kind),
    });
  };
}

function reach(topic: string, kinds: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pieceMovesOf(kinds), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    const focus = sampleFocus(sample);
    if (!position || focus === null) return null;
    const p = position.pieceAt(focus);
    if (!p) return null;
    const targets = destinationsOf(focus, position);
    const right = randomElement(targets, draw.random);
    if (right === undefined) return null;
    // Wrong squares: first those the piece would reach on an empty board but not here, then the squares of other
    // pieces' paths, then any square close by.
    const blocked = ChessGeometry.reach(p.kind, focus).filter((s) => !targets.includes(s));
    const others = ALL_PIECE_KINDS.filter((k) => k !== p.kind && k !== PAWN)
      .flatMap((k) => ChessGeometry.reach(k, focus))
      .filter((s) => !targets.includes(s) && !blocked.includes(s));
    const close = ALL_SQUARES.filter(
      (s) =>
        s !== focus && !targets.includes(s) && !blocked.includes(s) && !others.includes(s) &&
        Math.max(Math.abs(squareFile(s) - squareFile(focus)), Math.abs(squareRank(s) - squareRank(focus))) <= 3,
    );
    const wrong: string[] = [];
    for (const group of [shuffled(blocked, draw.random), shuffled(others, draw.random), shuffled(close, draw.random)]) {
      for (const s of group) if (wrong.length < 3 && !wrong.includes(squareName(s))) wrong.push(squareName(s));
    }
    return choice(
      {
        id: `${topic}.${sample.id}`, prompt: `Welches Feld kann ${nominative(p.kind)} auf ${squareName(focus)} mit einem Zug erreichen?`,
        correct: squareName(right), wrong, explanation: ruleOf(p.kind), media: boardMedia(position, [squareName(focus)]),
      },
      draw,
    );
  };
}

/** "Which piece can go from d4 to e6?" on an empty board; only squares for which one or two kinds can do it. */
function whichPiece(draw: ChessDraw): LearnExercise | null {
  const kinds: ChessPieceKind[] = [KING, QUEEN, ROOK, BISHOP, KNIGHT];
  for (let i = 0; i < 60; i++) {
    const from = randomElement(ALL_SQUARES, draw.random);
    const to = randomElement(ALL_SQUARES, draw.random);
    if (from === undefined || to === undefined) return null;
    const able = kinds.filter((k) => ChessGeometry.canReach(k, from, to));
    if (able.length === 0 || able.length > 2) continue;
    const right = randomElement(able, draw.random);
    if (right === undefined) continue;
    const wrong = kinds.filter((k) => !able.includes(k)).map(kindGermanName);
    return choice(
      {
        id: `u2.whichPiece.${squareName(from)}${squareName(to)}`,
        prompt: `Welche Figur kann auf einem leeren Brett in einem Zug von ${squareName(from)} nach ${squareName(to)} ziehen?`, correct: kindGermanName(right),
        wrong, explanation: `${ruleOf(right)} Von ${squareName(from)} nach ${squareName(to)} geht das mit: ${list(able.map(kindGermanName))}.`,
        media: emptyBoard([squareName(from), squareName(to)]),
      },
      draw,
    );
  }
  return null;
}

// Capturing

function captureMove(draw: ChessDraw): LearnExercise | null {
  const withCaptures: ChessSample[] = pieceMoves.filter((sample) => {
    const position = samplePosition(sample);
    const focus = sampleFocus(sample);
    if (!position || focus === null) return false;
    return position.legalMoves().some((m) => m.from === focus && position.isCapture(m));
  });
  const sample = draw.pickSample(withCaptures, 'u2.captureMove');
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  const p = position.pieceAt(focus);
  if (!p) return null;
  const captures = position.legalMoves().filter((m) => m.from === focus && position.isCapture(m));
  const targets = captures.map((m) => squareName(m.to));
  return moveExercise({
    id: `u2.captureMove.${sample.id}`, prompt: `Schlage mit ${dative(p.kind)} eine gegnerische Figur.`, position,
    goal: { type: 'moves', filter: { from: focus, capture: true } },
    explanation: `${ruleOf(p.kind)} Schlagen kannst du hier auf ${list(targets)}.`,
  });
}

function attackCount(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(pieceMoves, 'u2.attackCount');
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  const p = position.pieceAt(focus);
  if (!p) return null;
  const attacked = attackedEnemies(position, focus);
  const places =
    attacked.length === 0
      ? 'Auf keinem Feld, das er erreichen kann, steht eine gegnerische Figur.'
      : `Angegriffen werden die Figuren auf ${list(attacked.map(squareName))}.`;
  return number({
    id: `u2.attackCount.${sample.id}`,
    prompt: `Wie viele gegnerische Figuren greift ${nominative(p.kind)} auf ${squareName(focus)} an?`, answer: attacked.length,
    explanation: `Angreifen heißt: Die Figur könnte im nächsten Zug schlagen. ${places}`, media: boardMedia(position, [squareName(focus)]),
  });
}

export const unit2Makers: Record<string, ChessMaker> = {
  'u2.identify': identify,
  'u2.startSquare': startSquare,
  'u2.queenColor': queenColor,
  'u2.startCountChoice': startCountChoice,
  'u2.startCountNumber': startCountNumber,
  'u2.letters': letters,
  'u2.movePairs': movePairs,
  'u2.sentence.slide': sentenceMaker('u2.sentence.slide', slideSentences),
  'u2.sentence.step': sentenceMaker('u2.sentence.step', stepSentences),
  'u2.count.slider': countChoice('u2.count.slider', sliders),
  'u2.count.step': countChoice('u2.count.step', steppers),
  'u2.count.all': countChoice('u2.count.all', allPieces),
  'u2.countNumber.slider': countNumber('u2.countNumber.slider', sliders),
  'u2.countNumber.step': countNumber('u2.countNumber.step', steppers),
  'u2.countNumber.all': countNumber('u2.countNumber.all', allPieces),
  'u2.moveTo.slider': moveTo('u2.moveTo.slider', sliders),
  'u2.moveTo.step': moveTo('u2.moveTo.step', steppers),
  'u2.moveTo.all': moveTo('u2.moveTo.all', allPieces),
  'u2.reach.step': reach('u2.reach.step', steppers),
  'u2.reach.all': reach('u2.reach.all', allPieces),
  'u2.whichPiece': whichPiece,
  'u2.captureMove': captureMove,
  'u2.attackCount': attackCount,
};
