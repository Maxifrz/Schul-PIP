import type { LearnExercise } from '../exercise';
import { attackedEnemies } from './analysis';
import { moves } from './goals';
import { ChessDraw, ChessGeometry, ChessKit, ChessMaker, ChessSentence } from './kit';
import { ChessPosition, startFEN } from './position';
import { ChessSample, crowded, focusSquare, pieceMoves, pieceMovesOf, samplePosition } from './samples';
import { ChessPiece, PieceKind, Sq, Square, colors, colorName, adjectiveStem, kindLetter, kindName, piecePhrase, piece, pieceKinds } from './types';

const sliders = new Set(['rook', 'bishop', 'queen']);
const steppers = new Set(['king', 'knight']);
const allPieces = new Set([...sliders, ...steppers]);

const startBoard = () => ({ kind: 'board' as const, board: { fen: startFEN, flipped: false, marked: [] as string[] } });

const slideSentences: ChessSentence[] = [
  { key: 'bishop', words: ['Der', 'Läufer', 'zieht', 'nur', 'schräg.'], extra: ['gerade.', 'springt'] },
  { key: 'rook', words: ['Der', 'Turm', 'zieht', 'nur', 'gerade.'], extra: ['schräg.', 'L-förmig.'] },
  { key: 'queen', words: ['Die', 'Dame', 'zieht', 'wie', 'Turm', 'und', 'Läufer', 'zusammen.'], extra: ['König', 'Springer'] },
];

const stepSentences: ChessSentence[] = [
  { key: 'knight', words: ['Nur', 'der', 'Springer', 'darf', 'über', 'Figuren', 'springen.'], extra: ['Läufer', 'Turm'] },
  { key: 'king', words: ['Der', 'König', 'zieht', 'nur', 'ein', 'Feld', 'weit.'], extra: ['zwei', 'Springer'] },
  { key: 'attacked', words: ['Der', 'König', 'darf', 'nicht', 'auf', 'angegriffene', 'Felder', 'ziehen.'], extra: ['immer', 'Bauern'] },
];

/** Unit 2, "Die Figuren und ihre Züge": the starting position, how each piece moves and captures. */
export const ChessUnit2 = {
  review: ['u2.identify', 'u2.moveTo.all', 'u2.count.all', 'u2.whichPiece', 'u2.reach.all', 'u2.captureMove'],

  get makers(): Record<string, ChessMaker> {
    return {
      'u2.identify': identify,
      'u2.startSquare': startSquare,
      'u2.queenColor': queenColor,
      'u2.startCountChoice': startCountChoice,
      'u2.startCountNumber': startCountNumber,
      'u2.letters': letters,
      'u2.movePairs': movePairs,
      'u2.sentence.slide': ChessKit.sentenceMaker('u2.sentence.slide', slideSentences),
      'u2.sentence.step': ChessKit.sentenceMaker('u2.sentence.step', stepSentences),
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
  },
};

// The starting position

function identify(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(crowded, 'u2.identify');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const found = draw.randomElement(position.pieces);
  if (!found) return null;
  const wrong = draw.shuffled(pieceKinds.filter((k) => k !== found.piece.kind).map(kindName));
  return ChessKit.choice({
    id: `u2.identify.${sample.id}.${Sq.name(found.square)}`, prompt: 'Welche Figur steht auf dem markierten Feld?', correct: kindName(found.piece.kind),
    wrong, explanation: `Auf ${Sq.name(found.square)} steht ${ChessKit.indefinite(found.piece.kind)}.`,
    media: ChessKit.board(position, [Sq.name(found.square)]), draw,
  });
}

function startSquare(draw: ChessDraw): LearnExercise | null {
  const pieces = [piece('white', 'king'), piece('black', 'king'), piece('white', 'queen'), piece('black', 'queen')];
  const chosen = draw.pick(pieces, 'u2.startSquare', (p) => piecePhrase(p));
  if (!chosen) return null;
  const start = ChessPosition.start;
  const square = start.squaresOf(chosen)[0];
  if (square === undefined) return null;
  const partner = piece(chosen.color, chosen.kind === 'king' ? 'queen' : 'king');
  const partnerSquare = start.squaresOf(partner)[0];
  const opposite = Sq.at(Sq.file(square), 7 - Sq.rank(square));
  const side = Sq.at(Sq.file(square) + (chosen.kind === 'king' ? 1 : -1), Sq.rank(square));
  if (partnerSquare === undefined || opposite === null || side === null) return null;
  return ChessKit.choice({
    id: `u2.startSquare.${adjectiveStem(chosen.color)}.${kindName(chosen.kind)}`,
    prompt: `Auf welchem Feld steht am Anfang ${piecePhrase(chosen)}?`, correct: Sq.name(square),
    wrong: [Sq.name(partnerSquare), Sq.name(opposite), Sq.name(side)],
    explanation: 'Die Dame steht auf d1 und d8, der König daneben auf e1 und e8.',
    media: startBoard(), draw,
  });
}

function queenColor(draw: ChessDraw): LearnExercise | null {
  const color = draw.pick(colors, 'u2.queenColor', (c) => colorName(c));
  if (!color) return null;
  const square = ChessPosition.start.squaresOf(piece(color, 'queen'))[0];
  if (square === undefined) return null;
  return ChessKit.choice({
    id: `u2.queenColor.${adjectiveStem(color)}`, prompt: `Welche Farbe hat das Startfeld der ${adjectiveStem(color)}en Dame?`, correct: Sq.isDark(square) ? 'dunkel' : 'hell',
    wrong: [Sq.isDark(square) ? 'hell' : 'dunkel'],
    explanation: 'Die Dame steht am Anfang auf ihrer eigenen Farbe: Weiß auf d1 (hell), Schwarz auf d8 (dunkel).',
    media: startBoard(), draw,
  });
}

interface StartCount { key: string; prompt: string; answer: number; likely: number[]; explanation: string }

function startCounts(): StartCount[] {
  const start = ChessPosition.start;
  const count = (kind: PieceKind) => start.count(piece('white', kind));
  return [
    { key: 'pawns', prompt: 'Wie viele Bauern hat jede Seite am Anfang?', answer: count('pawn'), likely: [6, 10, 16], explanation: 'Auf der 2. Reihe stehen die 8 weißen Bauern, auf der 7. Reihe die 8 schwarzen.' },
    { key: 'rooks', prompt: 'Wie viele Türme hat jede Seite am Anfang?', answer: count('rook'), likely: [1, 3, 4], explanation: 'Die Türme stehen in den Ecken, auf a1 und h1 (Schwarz: a8 und h8).' },
    { key: 'knights', prompt: 'Wie viele Springer hat jede Seite am Anfang?', answer: count('knight'), likely: [1, 3, 4], explanation: 'Die Springer stehen auf b1 und g1 (Schwarz: b8 und g8).' },
    { key: 'bishops', prompt: 'Wie viele Läufer hat jede Seite am Anfang?', answer: count('bishop'), likely: [1, 3, 4], explanation: 'Die Läufer stehen auf c1 und f1 (Schwarz: c8 und f8).' },
    { key: 'all', prompt: 'Wie viele Figuren stehen am Anfang auf dem Brett, die Bauern mitgezählt?', answer: start.pieces.length, likely: [16, 24, 40], explanation: 'Jede Seite hat 16: einen König, eine Dame, zwei Türme, zwei Läufer, zwei Springer und acht Bauern.' },
  ];
}

function startCountChoice(draw: ChessDraw): LearnExercise | null {
  const item = draw.pick(startCounts(), 'u2.startCount', (i) => i.key);
  if (!item) return null;
  return ChessKit.choice({
    id: `u2.startCountChoice.${item.key}`, prompt: item.prompt, correct: String(item.answer),
    wrong: ChessKit.numberWrongs({ correct: item.answer, likely: item.likely, random: draw.random }),
    explanation: item.explanation, media: startBoard(), draw,
  });
}

function startCountNumber(draw: ChessDraw): LearnExercise | null {
  const item = draw.pick(startCounts(), 'u2.startCount', (i) => i.key);
  if (!item) return null;
  return ChessKit.number({ id: `u2.startCountNumber.${item.key}`, prompt: item.prompt, answer: item.answer, explanation: item.explanation, media: startBoard() });
}

function letters(draw: ChessDraw): LearnExercise | null {
  const kinds: PieceKind[] = ['king', 'queen', 'rook', 'bishop', 'knight'];
  return ChessKit.pairs({
    id: 'u2.letters', prompt: 'Welcher Buchstabe gehört zu welcher Figur?', draw,
    from: kinds.map((k) => ({ key: `u2.letter.${kindName(k)}`, front: kindName(k), back: kindLetter(k) })),
  });
}

function movePairs(draw: ChessDraw): LearnExercise | null {
  return ChessKit.pairs({
    id: 'u2.movePairs', prompt: 'Wie zieht welche Figur?', draw,
    from: [
      { key: 'u2.move.king', front: 'König', back: 'ein Feld in jede Richtung' },
      { key: 'u2.move.queen', front: 'Dame', back: 'gerade und schräg, beliebig weit' },
      { key: 'u2.move.rook', front: 'Turm', back: 'gerade, beliebig weit' },
      { key: 'u2.move.bishop', front: 'Läufer', back: 'schräg, beliebig weit' },
      { key: 'u2.move.knight', front: 'Springer', back: 'L-Sprung über Figuren' },
    ],
  });
}

// Counting and moving

/** The sentence that follows a count: the piece's rule, and why fewer squares than on an empty board. */
export function countExplanation(kind: PieceKind, count: number, onEmptyBoard: number): string {
  let text = ChessKit.rule(kind);
  if (count < onEmptyBoard) {
    switch (kind) {
      case 'king': text += ' Er darf nicht auf angegriffene Felder und nicht neben den gegnerischen König.'; break;
      case 'knight': text += ' Auf Felder mit eigenen Figuren darf er nicht.'; break;
      default: text += ' Eigene Figuren versperren den Weg, gegnerische darf er schlagen, dahinter geht es nicht weiter.';
    }
  }
  return `${text} Möglich sind ${count} ${count === 1 ? 'Feld' : 'Felder'}.`;
}

function countSample(draw: ChessDraw, topic: string, kinds: Set<string>) {
  const sample = draw.pickSample(pieceMovesOf(kinds), topic);
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  const found = position && focus !== null ? position.at(focus) : null;
  if (!sample || !position || focus === null || !found) return null;
  return { sample, position, focus, piece: found, count: ChessKit.destinations(focus, position).length, empty: ChessGeometry.reach(found.kind, focus).length };
}

function countChoice(topic: string, kinds: Set<string>): ChessMaker {
  return (draw) => {
    const item = countSample(draw, topic, kinds);
    if (!item) return null;
    return ChessKit.choice({
      id: `${topic}.${item.sample.id}`,
      prompt: `Auf wie viele Felder kann ${ChessKit.nominative(item.piece.kind)} auf ${Sq.name(item.focus)} ziehen?`,
      correct: String(item.count),
      wrong: ChessKit.numberWrongs({ correct: item.count, likely: [item.empty], random: draw.random }),
      explanation: countExplanation(item.piece.kind, item.count, item.empty),
      media: ChessKit.board(item.position, [Sq.name(item.focus)]), draw,
    });
  };
}

function countNumber(topic: string, kinds: Set<string>): ChessMaker {
  return (draw) => {
    const item = countSample(draw, topic, kinds);
    if (!item) return null;
    return ChessKit.number({
      id: `${topic}.${item.sample.id}`,
      prompt: `Auf wie viele Felder kann ${ChessKit.nominative(item.piece.kind)} auf ${Sq.name(item.focus)} ziehen? (Schlagen zählt mit.)`,
      answer: item.count, explanation: countExplanation(item.piece.kind, item.count, item.empty),
      media: ChessKit.board(item.position, [Sq.name(item.focus)]),
    });
  };
}

function moveTo(topic: string, kinds: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pieceMovesOf(kinds), topic);
    const position = sample ? samplePosition(sample) : null;
    const focus = sample ? focusSquare(sample) : null;
    const found = position && focus !== null ? position.at(focus) : null;
    if (!sample || !position || focus === null || !found) return null;
    const target = draw.randomElement(ChessKit.destinations(focus, position));
    if (target === null) return null;
    return ChessKit.moveExercise({
      id: `${topic}.${sample.id}.${Sq.name(target)}`,
      prompt: `Ziehe ${ChessKit.accusative(found.kind)} von ${Sq.name(focus)} nach ${Sq.name(target)}.`, position,
      goal: moves({ from: focus, to: target }), explanation: ChessKit.rule(found.kind),
    });
  };
}

function reach(topic: string, kinds: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pieceMovesOf(kinds), topic);
    const position = sample ? samplePosition(sample) : null;
    const focus = sample ? focusSquare(sample) : null;
    const found = position && focus !== null ? position.at(focus) : null;
    if (!sample || !position || focus === null || !found) return null;
    const targets = ChessKit.destinations(focus, position);
    const right = draw.randomElement(targets);
    if (right === null) return null;
    // Wrong squares: first those the piece would reach on an empty board but not here, then the squares of other
    // pieces' paths, then any square close by.
    const blocked = ChessGeometry.reach(found.kind, focus).filter((s) => !targets.includes(s));
    const others = pieceKinds.filter((k) => k !== found.kind && k !== 'pawn').flatMap((k) => ChessGeometry.reach(k, focus))
      .filter((s) => !targets.includes(s) && !blocked.includes(s));
    const close = Sq.all.filter((s) => s !== focus && !targets.includes(s) && !blocked.includes(s) && !others.includes(s)
      && Math.max(Math.abs(Sq.file(s) - Sq.file(focus)), Math.abs(Sq.rank(s) - Sq.rank(focus))) <= 3);
    const wrong: string[] = [];
    for (const group of [draw.shuffled(blocked), draw.shuffled(others), draw.shuffled(close)]) {
      for (const s of group) if (wrong.length < 3 && !wrong.includes(Sq.name(s))) wrong.push(Sq.name(s));
    }
    return ChessKit.choice({
      id: `${topic}.${sample.id}`, prompt: `Welches Feld kann ${ChessKit.nominative(found.kind)} auf ${Sq.name(focus)} mit einem Zug erreichen?`,
      correct: Sq.name(right), wrong, explanation: ChessKit.rule(found.kind),
      media: ChessKit.board(position, [Sq.name(focus)]), draw,
    });
  };
}

/** "Which piece can go from d4 to e6?" on an empty board; only squares for which one or two kinds can do it. */
function whichPiece(draw: ChessDraw): LearnExercise | null {
  const kinds: PieceKind[] = ['king', 'queen', 'rook', 'bishop', 'knight'];
  for (let i = 0; i < 60; i++) {
    const from = draw.randomElement(Sq.all);
    const to = draw.randomElement(Sq.all);
    if (from === null || to === null) return null;
    const able = kinds.filter((k) => ChessGeometry.canReach(k, from, to));
    if (able.length === 0 || able.length > 2) continue;
    const right = draw.randomElement(able);
    if (right === null) continue;
    return ChessKit.choice({
      id: `u2.whichPiece.${Sq.name(from)}${Sq.name(to)}`,
      prompt: `Welche Figur kann auf einem leeren Brett in einem Zug von ${Sq.name(from)} nach ${Sq.name(to)} ziehen?`, correct: kindName(right),
      wrong: kinds.filter((k) => !able.includes(k)).map(kindName),
      explanation: `${ChessKit.rule(right)} Von ${Sq.name(from)} nach ${Sq.name(to)} geht das mit: ${ChessKit.list(able.map(kindName))}.`,
      media: ChessKit.emptyBoard([Sq.name(from), Sq.name(to)]), draw,
    });
  }
  return null;
}

// Capturing

function captureMove(draw: ChessDraw): LearnExercise | null {
  const withCaptures = pieceMoves.filter((sample) => {
    const position = samplePosition(sample);
    const focus = focusSquare(sample);
    return !!position && focus !== null && position.legalMoves().some((m) => m.from === focus && position.isCapture(m));
  });
  const sample = draw.pickSample(withCaptures, 'u2.captureMove');
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  const found = position && focus !== null ? position.at(focus) : null;
  if (!sample || !position || focus === null || !found) return null;
  const targets = position.legalMoves().filter((m) => m.from === focus && position.isCapture(m)).map((m) => Sq.name(m.to));
  return ChessKit.moveExercise({
    id: `u2.captureMove.${sample.id}`, prompt: `Schlage mit ${ChessKit.dative(found.kind)} eine gegnerische Figur.`, position,
    goal: moves({ from: focus, capture: true }),
    explanation: `${ChessKit.rule(found.kind)} Schlagen kannst du hier auf ${ChessKit.list(targets)}.`,
  });
}

function attackCount(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(pieceMoves, 'u2.attackCount');
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  const found = position && focus !== null ? position.at(focus) : null;
  if (!sample || !position || focus === null || !found) return null;
  const attacked = attackedEnemies(position, focus);
  const places = attacked.length === 0
    ? 'Auf keinem Feld, das er erreichen kann, steht eine gegnerische Figur.'
    : `Angegriffen werden die Figuren auf ${ChessKit.list(attacked.map(Sq.name))}.`;
  return ChessKit.number({
    id: `u2.attackCount.${sample.id}`,
    prompt: `Wie viele gegnerische Figuren greift ${ChessKit.nominative(found.kind)} auf ${Sq.name(focus)} an?`, answer: attacked.length,
    explanation: `Angreifen heißt: Die Figur könnte im nächsten Zug schlagen. ${places}`, media: ChessKit.board(position, [Sq.name(focus)]),
  });
}

void ([] as Array<ChessPiece | Square | ChessSample>);
