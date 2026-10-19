import type { LearnExercise } from '../exercise';
import { BoardSpec, ExerciseMedia } from '../media';
import { moves } from './goals';
import { ChessDraw, ChessKit, ChessMaker, ChessSentence } from './kit';
import { ChessPosition, startFEN } from './position';
import { detailMove, nameMoves, samplePosition } from './samples';
import { Sq, Square } from './types';

const fileLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** Unit 1, "Das Brett": files, ranks, square names and the colors of the squares. */
export const ChessUnit1 = {
  /** Topics worth meeting again in later units. */
  review: ['u1.nameSquare', 'u1.colorOfSquare', 'u1.tapMove', 'u1.typeName', 'u1.sameDiagonal'],

  get makers(): Record<string, ChessMaker> {
    return {
      'u1.nameSquare': nameSquare,
      'u1.markedFile': markedFile,
      'u1.markedRank': markedRank,
      'u1.terms': terms,
      'u1.corners': corners,
      'u1.colorOfSquare': colorOfSquare,
      'u1.cornerColor': cornerColor,
      'u1.factChoice': factChoice,
      'u1.factNumber': factNumber,
      'u1.sameDiagonal': sameDiagonal,
      'u1.tapMove': tapMove,
      'u1.typeName': typeName,
      'u1.typeCorner': typeCorner,
      'u1.sentence.names': ChessKit.sentenceMaker('u1.sentence.names', nameSentences),
      'u1.sentence.colors': ChessKit.sentenceMaker('u1.sentence.colors', colorSentences),
    };
  },
};

const nameSentences: ChessSentence[] = [
  { key: 'linien', words: ['Die', 'senkrechten', 'Felderreihen', 'heißen', 'Linien.'], extra: ['waagerechten', 'Reihen.'] },
  { key: 'reihen', words: ['Die', 'waagerechten', 'Felderreihen', 'heißen', 'Reihen.'], extra: ['senkrechten', 'Linien.'] },
  { key: 'order', words: ['Zuerst', 'kommt', 'die', 'Linie,', 'dann', 'die', 'Reihe.'], extra: ['Diagonale.', 'zuletzt'] },
];

const colorSentences: ChessSentence[] = [
  { key: 'corner', words: ['Unten', 'rechts', 'liegt', 'ein', 'helles', 'Feld.'], extra: ['dunkles', 'links'] },
  { key: 'a1', words: ['Das', 'Feld', 'a1', 'ist', 'dunkel.'], extra: ['hell.', 'h1'] },
  { key: 'diagonal', words: ['Auf', 'einer', 'Diagonale', 'haben', 'alle', 'Felder', 'dieselbe', 'Farbe.'], extra: ['verschiedene', 'Linie'] },
];

/** "Wie heißt das markierte Feld?" with the four names a student could mix up. */
function nameSquare(draw: ChessDraw): LearnExercise | null {
  const square = draw.pickSquare('u1.nameSquare');
  if (square === null) return null;
  const withPieces = draw.coin();
  const marked = [Sq.name(square)];
  const media: ExerciseMedia = withPieces ? { kind: 'board', board: { fen: startFEN, flipped: false, marked } satisfies BoardSpec } : ChessKit.emptyBoard(marked);
  return ChessKit.choice({
    id: `u1.nameSquare.${Sq.name(square)}`, prompt: 'Wie heißt das markierte Feld?', correct: Sq.name(square),
    wrong: ChessKit.squareDistractors(square, draw.random),
    explanation: `Erst die Linie, dann die Reihe: Das Feld liegt auf der ${Sq.fileLetter(square)}-Linie in der ${Sq.rank(square) + 1}. Reihe, also ${Sq.name(square)}.`,
    media, draw,
  });
}

function markedFile(draw: ChessDraw): LearnExercise | null {
  const file = draw.pick([0, 1, 2, 3, 4, 5, 6, 7], 'u1.markedFile', (f) => String(f));
  if (file === null) return null;
  const marked = [1, 2, 3, 4, 5, 6, 7, 8].map((r) => fileLetters[file] + r);
  const wrong = [fileLetters[7 - file]];
  const near = draw.shuffled([file - 1, file + 1].filter((f) => f >= 0 && f < 8).map((f) => fileLetters[f]));
  wrong.push(...near);
  wrong.push(...draw.shuffled(fileLetters.filter((l) => !wrong.includes(l) && l !== fileLetters[file])));
  return ChessKit.choice({
    id: `u1.markedFile.${fileLetters[file]}`, prompt: 'Welche Linie ist markiert?', correct: fileLetters[file], wrong,
    explanation: `Die Linien heißen von links nach rechts a bis h. Die markierte ist die ${fileLetters[file]}-Linie.`,
    media: ChessKit.emptyBoard(marked), draw,
  });
}

function markedRank(draw: ChessDraw): LearnExercise | null {
  const rank = draw.pick([1, 2, 3, 4, 5, 6, 7, 8], 'u1.markedRank', (r) => String(r));
  if (rank === null) return null;
  const marked = fileLetters.map((l) => l + rank);
  const wrong = [String(9 - rank)];
  const near = draw.shuffled([rank - 1, rank + 1].filter((r) => r >= 1 && r <= 8).map(String));
  wrong.push(...near);
  wrong.push(...draw.shuffled(['1', '2', '3', '4', '5', '6', '7', '8'].filter((r) => !wrong.includes(r) && r !== String(rank))));
  return ChessKit.choice({
    id: `u1.markedRank.${rank}`, prompt: 'Welche Reihe ist markiert?', correct: String(rank), wrong,
    explanation: `Die Reihen sind von unten nach oben von 1 bis 8 nummeriert. Die markierte ist die ${rank}. Reihe.`,
    media: ChessKit.emptyBoard(marked), draw,
  });
}

function terms(draw: ChessDraw): LearnExercise | null {
  return ChessKit.pairs({
    id: 'u1.terms', prompt: 'Was ist was?', draw,
    from: [
      { key: 'u1.term.linie', front: 'Linie', back: 'senkrecht, a bis h' },
      { key: 'u1.term.reihe', front: 'Reihe', back: 'waagerecht, 1 bis 8' },
      { key: 'u1.term.diagonale', front: 'Diagonale', back: 'schräg' },
      { key: 'u1.term.feld', front: 'Feld', back: 'ein Quadrat des Brettes' },
      { key: 'u1.term.brett', front: 'Schachbrett', back: '8 mal 8 Felder' },
    ],
  });
}

function corners(draw: ChessDraw): LearnExercise | null {
  return ChessKit.pairs({
    id: 'u1.corners', prompt: 'Wo liegen die Eckfelder? Du schaust von Weiß aus auf das Brett.', draw,
    from: [
      { key: 'u1.corner.a1', front: 'a1', back: 'unten links' },
      { key: 'u1.corner.h1', front: 'h1', back: 'unten rechts' },
      { key: 'u1.corner.a8', front: 'a8', back: 'oben links' },
      { key: 'u1.corner.h8', front: 'h8', back: 'oben rechts' },
    ],
  });
}

const colorName = (square: Square): string => (Sq.isDark(square) ? 'dunkel' : 'hell');

function colorOfSquare(draw: ChessDraw): LearnExercise | null {
  const square = draw.pickSquare('u1.colorOfSquare');
  if (square === null) return null;
  const number = Sq.file(square) + 1;
  const sum = number + Sq.rank(square) + 1;
  const explanation = `a1 ist dunkel, danach wechselt die Farbe von Feld zu Feld. Rechne: ${Sq.fileLetter(square)} ist der ${number}. Buchstabe, `
    + `${number} + ${Sq.rank(square) + 1} = ${sum}. ${sum % 2 === 0 ? 'Gerade Summe: dunkel.' : 'Ungerade Summe: hell.'}`;
  return ChessKit.choice({
    id: `u1.colorOfSquare.${Sq.name(square)}`, prompt: `Welche Farbe hat das Feld ${Sq.name(square)}?`, correct: colorName(square),
    wrong: [Sq.isDark(square) ? 'hell' : 'dunkel'], explanation, media: ChessKit.emptyBoard([Sq.name(square)]), draw,
  });
}

function cornerColor(draw: ChessDraw): LearnExercise | null {
  const name = draw.pick(['a1', 'h1', 'a8', 'h8'], 'u1.cornerColor', (n) => n);
  const square = name === null ? null : Sq.of(name);
  if (name === null || square === null) return null;
  return ChessKit.choice({
    id: `u1.cornerColor.${name}`, prompt: `Welche Farbe hat das Eckfeld ${name}?`, correct: colorName(square),
    wrong: [Sq.isDark(square) ? 'hell' : 'dunkel'],
    explanation: 'Unten links (a1) und oben rechts (h8) sind dunkel, unten rechts (h1) und oben links (a8) sind hell.',
    media: ChessKit.emptyBoard([name]), draw,
  });
}

interface Fact { key: string; prompt: string; answer: number; likely: number[]; explanation: string }

/** Counts of the board, taken from the squares themselves. */
function facts(): Fact[] {
  const all = Sq.all;
  return [
    { key: 'squares', prompt: 'Wie viele Felder hat ein Schachbrett?', answer: all.length, likely: [32, 56, 81], explanation: `8 Linien mal 8 Reihen sind ${all.length} Felder.` },
    { key: 'dark', prompt: 'Wie viele dunkle Felder hat das Schachbrett?', answer: all.filter(Sq.isDark).length, likely: [16, 30, 64], explanation: 'Hell und dunkel wechseln sich ab, jede Farbe hat die Hälfte der 64 Felder.' },
    { key: 'files', prompt: 'Wie viele Linien hat das Schachbrett?', answer: fileLetters.length, likely: [6, 7, 9], explanation: 'Die Linien heißen a, b, c, d, e, f, g und h.' },
    { key: 'ranks', prompt: 'Wie viele Reihen hat das Schachbrett?', answer: 8, likely: [6, 7, 9], explanation: 'Die Reihen sind von 1 bis 8 nummeriert.' },
    { key: 'diagonal', prompt: 'Aus wie vielen Feldern besteht die lange Diagonale von a1 nach h8?', answer: all.filter((s) => Sq.file(s) === Sq.rank(s)).length, likely: [7, 9, 16], explanation: 'Sie berührt jede Linie und jede Reihe genau einmal.' },
    { key: 'perFile', prompt: 'Wie viele Felder hat eine Linie?', answer: all.filter((s) => Sq.file(s) === 0).length, likely: [6, 7, 64], explanation: 'Eine Linie läuft durch alle 8 Reihen.' },
  ];
}

function factChoice(draw: ChessDraw): LearnExercise | null {
  const fact = draw.pick(facts(), 'u1.fact', (f) => f.key);
  if (!fact) return null;
  return ChessKit.choice({
    id: `u1.factChoice.${fact.key}`, prompt: fact.prompt, correct: String(fact.answer),
    wrong: ChessKit.numberWrongs({ correct: fact.answer, likely: fact.likely, random: draw.random }),
    explanation: fact.explanation, draw,
  });
}

function factNumber(draw: ChessDraw): LearnExercise | null {
  const fact = draw.pick(facts(), 'u1.fact', (f) => f.key);
  if (!fact) return null;
  return ChessKit.number({ id: `u1.factNumber.${fact.key}`, prompt: fact.prompt, answer: fact.answer, explanation: fact.explanation });
}

function sameDiagonal(draw: ChessDraw): LearnExercise | null {
  const base = draw.pickSquare('u1.sameDiagonal');
  if (base === null) return null;
  const df = (s: Square) => Math.abs(Sq.file(s) - Sq.file(base));
  const dr = (s: Square) => Math.abs(Sq.rank(s) - Sq.rank(base));
  const onDiagonal = Sq.all.filter((s) => df(s) === dr(s) && s !== base);
  const sameLine = Sq.all.filter((s) => (Sq.file(s) === Sq.file(base) || Sq.rank(s) === Sq.rank(base)) && s !== base);
  const elsewhere = Sq.all.filter((s) => df(s) !== dr(s) && Sq.file(s) !== Sq.file(base) && Sq.rank(s) !== Sq.rank(base));
  const right = draw.randomElement(onDiagonal);
  const line = draw.randomElement(sameLine);
  if (right === null || line === null) return null;
  const wrong = [Sq.name(line)];
  for (const s of draw.shuffled(elsewhere)) if (wrong.length < 3 && !wrong.includes(Sq.name(s))) wrong.push(Sq.name(s));
  const steps = df(right);
  return ChessKit.choice({
    id: `u1.sameDiagonal.${Sq.name(base)}`, prompt: `Welches Feld liegt mit ${Sq.name(base)} auf einer Diagonale?`, correct: Sq.name(right), wrong,
    explanation: `Von ${Sq.name(base)} nach ${Sq.name(right)} geht es ${steps} ${steps === 1 ? 'Linie' : 'Linien'} und ${steps} ${steps === 1 ? 'Reihe' : 'Reihen'} weit: Das ist eine Diagonale.`,
    media: ChessKit.emptyBoard([Sq.name(base)]), draw,
  });
}

/** "Ziehe von g1 nach f3.": the student only has to find the two squares. */
function tapMove(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(nameMoves, 'u1.tapMove');
  const position = sample ? samplePosition(sample) : null;
  const move = sample ? detailMove(sample) : null;
  if (!sample || !position || !move) return null;
  return ChessKit.moveExercise({
    id: `u1.tapMove.${sample.id}`, prompt: `Ziehe von ${Sq.name(move.from)} nach ${Sq.name(move.to)}.`, position,
    goal: moves({ from: move.from, to: move.to }),
    explanation: `Suche erst die Linie, dann die Reihe: von ${Sq.name(move.from)} nach ${Sq.name(move.to)}.`,
  });
}

function typeName(draw: ChessDraw): LearnExercise | null {
  const square = draw.pickSquare('u1.typeName');
  if (square === null) return null;
  return ChessKit.typedSquare({
    id: `u1.typeName.${Sq.name(square)}`, prompt: 'Tippe den Namen des markierten Feldes.', answer: Sq.name(square),
    explanation: `Erst die Linie, dann die Reihe: ${Sq.fileLetter(square)}-Linie, ${Sq.rank(square) + 1}. Reihe, also ${Sq.name(square)}.`,
    media: ChessKit.emptyBoard([Sq.name(square)]),
  });
}

function typeCorner(draw: ChessDraw): LearnExercise | null {
  const corner = draw.pick([{ name: 'a1', place: 'unten links' }, { name: 'h1', place: 'unten rechts' }, { name: 'a8', place: 'oben links' }, { name: 'h8', place: 'oben rechts' }], 'u1.typeCorner', (c) => c.name);
  if (!corner) return null;
  return ChessKit.typedSquare({
    id: `u1.typeCorner.${corner.name}`, prompt: `Wie heißt das Eckfeld ${corner.place}? Du schaust von Weiß aus auf das Brett.`, answer: corner.name,
    explanation: 'Die Ecken sind a1 (unten links), h1 (unten rechts), a8 (oben links) und h8 (oben rechts).',
    media: ChessKit.emptyBoard(),
  });
}

void ChessPosition;
