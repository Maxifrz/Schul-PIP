// Unit 1, "Das Brett": files, ranks, square names and the colors of the squares. Port of ChessUnit1.swift.

import type { LearnExercise } from '../../exercise';
import { randomElement, shuffled } from '../../random';
import { ChessPosition } from '../position';
import { FILE_LETTERS, ALL_SQUARES, fileLetter, isDarkSquare, squareFile, squareFromName, squareName, squareRank, type ChessSquare } from '../types';
import {
  choice, emptyBoard, fenBoard, moveExercise, number, numberWrongs, pairs, sentence, sentenceMaker, squareDistractors,
  typedSquare, type ChessDraw, type ChessMaker,
} from './courseKit';
import { nameMoves, sampleDetailMove, samplePosition } from './samples';

export const unit1Review = ['u1.nameSquare', 'u1.colorOfSquare', 'u1.tapMove', 'u1.typeName', 'u1.sameDiagonal'];

const nameSentences = [
  sentence('linien', ['Die', 'senkrechten', 'Felderreihen', 'heißen', 'Linien.'], ['waagerechten', 'Reihen.']),
  sentence('reihen', ['Die', 'waagerechten', 'Felderreihen', 'heißen', 'Reihen.'], ['senkrechten', 'Linien.']),
  sentence('order', ['Zuerst', 'kommt', 'die', 'Linie,', 'dann', 'die', 'Reihe.'], ['Diagonale.', 'zuletzt']),
];

const colorSentences = [
  sentence('corner', ['Unten', 'rechts', 'liegt', 'ein', 'helles', 'Feld.'], ['dunkles', 'links']),
  sentence('a1', ['Das', 'Feld', 'a1', 'ist', 'dunkel.'], ['hell.', 'h1']),
  sentence('diagonal', ['Auf', 'einer', 'Diagonale', 'haben', 'alle', 'Felder', 'dieselbe', 'Farbe.'], ['verschiedene', 'Linie']),
];

const letters: string[] = [...FILE_LETTERS];

/** "Wie heißt das markierte Feld?" with the four names a student could mix up. */
function nameSquare(draw: ChessDraw): LearnExercise | null {
  const square = draw.pickSquare('u1.nameSquare');
  if (square === null) return null;
  const withPieces = draw.coin();
  const marked = [squareName(square)];
  const media = withPieces ? fenBoard(ChessPosition.startFEN, marked) : emptyBoard(marked);
  const name = squareName(square);
  return choice(
    {
      id: `u1.nameSquare.${name}`, prompt: 'Wie heißt das markierte Feld?', correct: name,
      wrong: squareDistractors(square, draw.random),
      explanation: `Erst die Linie, dann die Reihe: Das Feld liegt auf der ${fileLetter(square)}-Linie in der ${squareRank(square) + 1}. Reihe, also ${name}.`,
      media,
    },
    draw,
  );
}

function markedFile(draw: ChessDraw): LearnExercise | null {
  const file = draw.pick([0, 1, 2, 3, 4, 5, 6, 7], 'u1.markedFile', String);
  if (file === null) return null;
  const marked = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => letters[file] + String(n));
  let wrong = [letters[7 - file]];
  const near = [file - 1, file + 1].filter((n) => n >= 0 && n < 8).map((n) => letters[n]);
  draw.random.shuffle(near);
  wrong = wrong.concat(near);
  wrong = wrong.concat(shuffled(letters.filter((l) => !wrong.includes(l) && l !== letters[file]), draw.random));
  return choice(
    {
      id: `u1.markedFile.${letters[file]}`, prompt: 'Welche Linie ist markiert?', correct: letters[file], wrong,
      explanation: `Die Linien heißen von links nach rechts a bis h. Die markierte ist die ${letters[file]}-Linie.`,
      media: emptyBoard(marked),
    },
    draw,
  );
}

function markedRank(draw: ChessDraw): LearnExercise | null {
  const rank = draw.pick([1, 2, 3, 4, 5, 6, 7, 8], 'u1.markedRank', String);
  if (rank === null) return null;
  const marked = letters.map((l) => l + String(rank));
  let wrong = [String(9 - rank)];
  const near = [rank - 1, rank + 1].filter((n) => n >= 1 && n <= 8).map(String);
  draw.random.shuffle(near);
  wrong = wrong.concat(near);
  wrong = wrong.concat(shuffled(['1', '2', '3', '4', '5', '6', '7', '8'].filter((r) => !wrong.includes(r) && r !== String(rank)), draw.random));
  return choice(
    {
      id: `u1.markedRank.${rank}`, prompt: 'Welche Reihe ist markiert?', correct: String(rank), wrong,
      explanation: `Die Reihen sind von unten nach oben von 1 bis 8 nummeriert. Die markierte ist die ${rank}. Reihe.`,
      media: emptyBoard(marked),
    },
    draw,
  );
}

function terms(draw: ChessDraw): LearnExercise | null {
  return pairs(
    {
      id: 'u1.terms', prompt: 'Was ist was?',
      from: [
        { key: 'u1.term.linie', front: 'Linie', back: 'senkrecht, a bis h' },
        { key: 'u1.term.reihe', front: 'Reihe', back: 'waagerecht, 1 bis 8' },
        { key: 'u1.term.diagonale', front: 'Diagonale', back: 'schräg' },
        { key: 'u1.term.feld', front: 'Feld', back: 'ein Quadrat des Brettes' },
        { key: 'u1.term.brett', front: 'Schachbrett', back: '8 mal 8 Felder' },
      ],
    },
    draw,
  );
}

function corners(draw: ChessDraw): LearnExercise | null {
  return pairs(
    {
      id: 'u1.corners', prompt: 'Wo liegen die Eckfelder? Du schaust von Weiß aus auf das Brett.',
      from: [
        { key: 'u1.corner.a1', front: 'a1', back: 'unten links' },
        { key: 'u1.corner.h1', front: 'h1', back: 'unten rechts' },
        { key: 'u1.corner.a8', front: 'a8', back: 'oben links' },
        { key: 'u1.corner.h8', front: 'h8', back: 'oben rechts' },
      ],
    },
    draw,
  );
}

const colorName = (square: ChessSquare): string => (isDarkSquare(square) ? 'dunkel' : 'hell');

function colorOfSquare(draw: ChessDraw): LearnExercise | null {
  const square = draw.pickSquare('u1.colorOfSquare');
  if (square === null) return null;
  const name = squareName(square);
  const letterNo = squareFile(square) + 1;
  const sum = letterNo + squareRank(square) + 1;
  const explanation =
    `a1 ist dunkel, danach wechselt die Farbe von Feld zu Feld. Rechne: ${fileLetter(square)} ist der ${letterNo}. Buchstabe, ` +
    `${letterNo} + ${squareRank(square) + 1} = ${sum}. ${sum % 2 === 0 ? 'Gerade Summe: dunkel.' : 'Ungerade Summe: hell.'}`;
  return choice(
    {
      id: `u1.colorOfSquare.${name}`, prompt: `Welche Farbe hat das Feld ${name}?`, correct: colorName(square),
      wrong: [isDarkSquare(square) ? 'hell' : 'dunkel'], explanation, media: emptyBoard([name]),
    },
    draw,
  );
}

function cornerColor(draw: ChessDraw): LearnExercise | null {
  const names = ['a1', 'h1', 'a8', 'h8'];
  const name = draw.pick(names, 'u1.cornerColor', (n) => n);
  const square = name === null ? null : squareFromName(name);
  if (name === null || square === null) return null;
  return choice(
    {
      id: `u1.cornerColor.${name}`, prompt: `Welche Farbe hat das Eckfeld ${name}?`, correct: colorName(square),
      wrong: [isDarkSquare(square) ? 'hell' : 'dunkel'],
      explanation: 'Unten links (a1) und oben rechts (h8) sind dunkel, unten rechts (h1) und oben links (a8) sind hell.',
      media: emptyBoard([name]),
    },
    draw,
  );
}

interface Fact {
  key: string;
  prompt: string;
  answer: number;
  likely: number[];
  explanation: string;
}

/** Counts of the board, taken from the squares themselves. */
function facts(): Fact[] {
  const all = ALL_SQUARES;
  return [
    { key: 'squares', prompt: 'Wie viele Felder hat ein Schachbrett?', answer: all.length, likely: [32, 56, 81], explanation: `8 Linien mal 8 Reihen sind ${all.length} Felder.` },
    { key: 'dark', prompt: 'Wie viele dunkle Felder hat das Schachbrett?', answer: all.filter(isDarkSquare).length, likely: [16, 30, 64], explanation: 'Hell und dunkel wechseln sich ab, jede Farbe hat die Hälfte der 64 Felder.' },
    { key: 'files', prompt: 'Wie viele Linien hat das Schachbrett?', answer: letters.length, likely: [6, 7, 9], explanation: 'Die Linien heißen a, b, c, d, e, f, g und h.' },
    { key: 'ranks', prompt: 'Wie viele Reihen hat das Schachbrett?', answer: 8, likely: [6, 7, 9], explanation: 'Die Reihen sind von 1 bis 8 nummeriert.' },
    { key: 'diagonal', prompt: 'Aus wie vielen Feldern besteht die lange Diagonale von a1 nach h8?', answer: all.filter((s) => squareFile(s) === squareRank(s)).length, likely: [7, 9, 16], explanation: 'Sie berührt jede Linie und jede Reihe genau einmal.' },
    { key: 'perFile', prompt: 'Wie viele Felder hat eine Linie?', answer: all.filter((s) => squareFile(s) === 0).length, likely: [6, 7, 64], explanation: 'Eine Linie läuft durch alle 8 Reihen.' },
  ];
}

function factChoice(draw: ChessDraw): LearnExercise | null {
  const fact = draw.pick(facts(), 'u1.fact', (f) => f.key);
  if (!fact) return null;
  return choice(
    {
      id: `u1.factChoice.${fact.key}`, prompt: fact.prompt, correct: String(fact.answer),
      wrong: numberWrongs(fact.answer, fact.likely, draw.random), explanation: fact.explanation,
    },
    draw,
  );
}

function factNumber(draw: ChessDraw): LearnExercise | null {
  const fact = draw.pick(facts(), 'u1.fact', (f) => f.key);
  if (!fact) return null;
  return number({ id: `u1.factNumber.${fact.key}`, prompt: fact.prompt, answer: fact.answer, explanation: fact.explanation });
}

function sameDiagonal(draw: ChessDraw): LearnExercise | null {
  const base = draw.pickSquare('u1.sameDiagonal');
  if (base === null) return null;
  const bf = squareFile(base);
  const br = squareRank(base);
  const onDiagonal = ALL_SQUARES.filter((s) => Math.abs(squareFile(s) - bf) === Math.abs(squareRank(s) - br) && s !== base);
  const sameLine = ALL_SQUARES.filter((s) => (squareFile(s) === bf || squareRank(s) === br) && s !== base);
  const elsewhere = ALL_SQUARES.filter(
    (s) => Math.abs(squareFile(s) - bf) !== Math.abs(squareRank(s) - br) && squareFile(s) !== bf && squareRank(s) !== br,
  );
  const right = randomElement(onDiagonal, draw.random);
  const line = randomElement(sameLine, draw.random);
  if (right === undefined || line === undefined) return null;
  const wrong = [squareName(line)];
  for (const square of shuffled(elsewhere, draw.random)) {
    if (wrong.length < 3 && !wrong.includes(squareName(square))) wrong.push(squareName(square));
  }
  const steps = Math.abs(squareFile(right) - bf);
  const baseName = squareName(base);
  return choice(
    {
      id: `u1.sameDiagonal.${baseName}`, prompt: `Welches Feld liegt mit ${baseName} auf einer Diagonale?`, correct: squareName(right), wrong,
      explanation: `Von ${baseName} nach ${squareName(right)} geht es ${steps} ${steps === 1 ? 'Linie' : 'Linien'} und ${steps} ${steps === 1 ? 'Reihe' : 'Reihen'} weit: Das ist eine Diagonale.`,
      media: emptyBoard([baseName]),
    },
    draw,
  );
}

/** "Ziehe von g1 nach f3.": the student only has to find the two squares. */
function tapMove(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(nameMoves, 'u1.tapMove');
  if (!sample) return null;
  const position = samplePosition(sample);
  const m = sampleDetailMove(sample);
  if (!position || !m) return null;
  const from = squareName(m.from);
  const to = squareName(m.to);
  return moveExercise({
    id: `u1.tapMove.${sample.id}`, prompt: `Ziehe von ${from} nach ${to}.`, position,
    goal: { type: 'moves', filter: { from: m.from, to: m.to } },
    explanation: `Suche erst die Linie, dann die Reihe: von ${from} nach ${to}.`,
  });
}

function typeName(draw: ChessDraw): LearnExercise | null {
  const square = draw.pickSquare('u1.typeName');
  if (square === null) return null;
  const name = squareName(square);
  return typedSquare({
    id: `u1.typeName.${name}`, prompt: 'Tippe den Namen des markierten Feldes.', answer: name,
    explanation: `Erst die Linie, dann die Reihe: ${fileLetter(square)}-Linie, ${squareRank(square) + 1}. Reihe, also ${name}.`,
    media: emptyBoard([name]),
  });
}

function typeCorner(draw: ChessDraw): LearnExercise | null {
  const cornerList = [
    { name: 'a1', place: 'unten links' }, { name: 'h1', place: 'unten rechts' },
    { name: 'a8', place: 'oben links' }, { name: 'h8', place: 'oben rechts' },
  ];
  const corner = draw.pick(cornerList, 'u1.typeCorner', (c) => c.name);
  if (!corner) return null;
  return typedSquare({
    id: `u1.typeCorner.${corner.name}`, prompt: `Wie heißt das Eckfeld ${corner.place}? Du schaust von Weiß aus auf das Brett.`, answer: corner.name,
    explanation: 'Die Ecken sind a1 (unten links), h1 (unten rechts), a8 (oben links) und h8 (oben rechts).',
    media: emptyBoard(),
  });
}

export const unit1Makers: Record<string, ChessMaker> = {
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
  'u1.sentence.names': sentenceMaker('u1.sentence.names', nameSentences),
  'u1.sentence.colors': sentenceMaker('u1.sentence.colors', colorSentences),
};
