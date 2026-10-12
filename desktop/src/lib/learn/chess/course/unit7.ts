// Unit 7, "Matt in einem Zug": the mating patterns and finding every mate in one. Port of ChessUnit7.swift.

import type { LearnExercise } from '../../exercise';
import { Exercises } from '../../exercises';
import { randomElement, shuffled } from '../../random';
import { acceptedMoves } from '../goals';
import { sanWithoutSign, typedVariants } from '../kit';
import { san } from '../notation';
import type { ChessPosition } from '../position';
import { colorGermanName, moveUci, movesEqual, squareName, type ChessMove } from '../types';
import {
  boardMedia, choice, moveExercise, number, pairs, sentence, sentenceMaker, yesNo, type ChessDraw, type ChessMaker,
} from './courseKit';
import { mates, samplePosition, type ChessSample } from './samples';

const groupA = ['backRank', 'smothered'];
const groupB = ['scholar', 'fool', 'ladder'];
const groupC = ['queen', 'rook'];
const groups: { suffix: string; themes: ReadonlySet<string> }[] = [
  { suffix: 'a', themes: new Set(groupA) },
  { suffix: 'b', themes: new Set(groupB) },
  { suffix: 'c', themes: new Set(groupC) },
  { suffix: 'all', themes: new Set([...groupA, ...groupB, ...groupC]) },
];

/** The German name of each named pattern. */
const patternNames: Record<string, string> = {
  backRank: 'Grundreihenmatt', smothered: 'Erstickungsmatt', scholar: 'Schäfermatt', ladder: 'Leitermatt', fool: 'Narrenmatt',
};

export const unit7Review = ['u7.find.all', 'u7.choose.all', 'u7.isMate.all', 'u7.pattern.all'];

const backSentences = [
  sentence('back', ['Beim', 'Grundreihenmatt', 'sperren', 'die', 'eigenen', 'Bauern', 'den', 'König', 'ein.'], ['Läufer', 'Springer']),
  sentence('knight', ['Beim', 'Erstickungsmatt', 'setzt', 'ein', 'Springer', 'matt.'], ['Turm', 'Läufer']),
];

const ruleSentences = [
  sentence('three', ['Ein', 'Matt', 'ist', 'ein', 'Schach', 'ohne', 'Ausweg.'], ['Remis', 'Patt']),
  sentence('all', ['Gesucht', 'sind', 'alle', 'Züge,', 'die', 'sofort', 'matt', 'setzen.'], ['keine', 'später']),
];

const poolOf = (themes: ReadonlySet<string>): ChessSample[] => mates.filter((s) => themes.has(s.theme));

/** The sentence that explains the pattern a mate shows, for the feedback. */
export function patternText(theme: string, m: ChessMove): string {
  switch (theme) {
    case 'backRank': return 'Der König steht auf der Grundreihe, und seine eigenen Bauern nehmen ihm die Felder davor: Grundreihenmatt.';
    case 'smothered': return 'Eigene Figuren nehmen dem König alle Felder, und ein Springer gibt Schach: Erstickungsmatt.';
    case 'scholar': return `Dame und Läufer zielen auf ${squareName(m.to)}. Die Dame schlägt dort mit Schach, und der Läufer deckt sie: Schäfermatt.`;
    case 'ladder': return 'Zwei Türme setzen Reihe um Reihe ab: Der eine sperrt die Reihe davor, der andere gibt Schach. Das ist ein Leitermatt.';
    case 'fool': return 'Das schnellste mögliche Matt: Nach nur zwei Zügen jeder Seite ist die Partie vorbei (Narrenmatt).';
    case 'queen': return 'Die Dame gibt Schach, und der eigene König deckt sie und nimmt die Fluchtfelder: Matt am Rand.';
    default: return 'Der Turm gibt Schach auf der Randreihe, und der eigene König nimmt die Fluchtfelder: Matt am Rand.';
  }
}

const mateMoves = (position: ChessPosition): ChessMove[] => acceptedMoves({ type: 'mateInOne' }, position);

function find(topic: string, themes: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(poolOf(themes), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    if (!position) return null;
    const mate = mateMoves(position)[0];
    if (mate === undefined) return null;
    return moveExercise({
      id: `${topic}.${sample.id}`, prompt: 'Setze in einem Zug matt.', position, goal: { type: 'mateInOne' },
      explanation: patternText(sample.theme, mate), withSquares: false,
    });
  };
}

function choose(topic: string, themes: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(poolOf(themes), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    if (!position) return null;
    const mateList = mateMoves(position);
    const right = randomElement(mateList, draw.random);
    if (right === undefined) return null;
    const rightText = san(right, position);
    if (rightText === null) return null;
    const others = position.legalMoves().filter((m) => !mateList.some((x) => movesEqual(x, m)));
    // Moves that give check first: they look like mates but are not.
    const checks = shuffled(others.filter((m) => position.givesCheck(m)), draw.random);
    const captures = shuffled(others.filter((m) => position.isCapture(m) && !position.givesCheck(m)), draw.random);
    const quiet = shuffled(others.filter((m) => !position.isCapture(m) && !position.givesCheck(m)), draw.random);
    const wrong: string[] = [];
    for (const m of [...checks, ...captures, ...quiet]) {
      if (wrong.length >= 3) break;
      const text = san(m, position);
      if (text === null) continue;
      const plain = sanWithoutSign(text);
      if (plain !== sanWithoutSign(rightText) && !wrong.includes(plain)) wrong.push(plain);
    }
    return choice(
      {
        id: `${topic}.${sample.id}`, prompt: 'Welcher Zug setzt matt?', correct: sanWithoutSign(rightText), wrong,
        explanation: patternText(sample.theme, right), media: boardMedia(position),
      },
      draw,
    );
  };
}

function count(topic: string, themes: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(poolOf(themes), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    if (!position) return null;
    const mateList = mateMoves(position);
    const texts = mateList.map((m) => san(m, position)).filter((t): t is string => t !== null);
    return number({
      id: `${topic}.${sample.id}`, prompt: 'Wie viele Züge setzen hier sofort matt?', answer: mateList.length,
      explanation: `Matt setzen: ${texts.join(', ')}.`, media: boardMedia(position),
    });
  };
}

function isMate(topic: string, themes: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(poolOf(themes), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    if (!position) return null;
    const checks = position.legalMoves().filter((m) => position.givesCheck(m));
    const wantMate = draw.coin();
    const candidates = checks.filter((m) => position.applying(m).isCheckmate === wantMate);
    const m = randomElement(candidates.length === 0 ? checks : candidates, draw.random);
    if (m === undefined) return null;
    const text = san(m, position);
    if (text === null) return null;
    const after = position.applying(m);
    const mate = after.isCheckmate;
    let explanation: string;
    if (mate) {
      explanation = 'Der König hat kein Feld, die Figur ist nicht zu schlagen, und nichts kann dazwischen: Matt.';
    } else {
      const first = after.legalMoves()[0];
      const reply = first === undefined ? null : san(first, after);
      explanation = `${colorGermanName(after.sideToMove)} kann das Schach aufheben, zum Beispiel mit ${reply ?? 'einem Zug'}. Es ist also nicht Matt.`;
    }
    return yesNo(
      {
        id: `${topic}.${sample.id}.${moveUci(m)}`,
        prompt: `${colorGermanName(position.sideToMove)} spielt ${sanWithoutSign(text)} und gibt damit Schach. Ist das Matt?`, answer: mate,
        explanation, media: boardMedia(position),
      },
      draw,
    );
  };
}

/** Typing the mating move in notation; every mating move is accepted, with or without the signs. */
function write(topic: string, themes: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(poolOf(themes), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    if (!position) return null;
    const mateList = mateMoves(position);
    const texts = mateList.map((m) => san(m, position)).filter((t): t is string => t !== null);
    const first = texts[0];
    if (first === undefined) return null;
    const forms = texts.flatMap(typedVariants);
    return Exercises.typed({
      id: `${topic}.${sample.id}`,
      prompt: 'Setze matt und schreibe den Zug auf: Buchstabe der Figur und Zielfeld, zum Beispiel Sf3.', answer: first,
      alternatives: forms, mode: 'exact', solution: texts.join(' oder '),
      explanation: patternText(sample.theme, mateList[0]), media: boardMedia(position),
    });
  };
}

/** "Wie heißt dieses Mattbild?": the position after the mate, and the four names. */
function pattern(topic: string, themes: ReadonlySet<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(poolOf(themes), topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    if (!position) return null;
    const mate = mateMoves(position)[0];
    const name = patternNames[sample.theme];
    if (mate === undefined || name === undefined) return null;
    const wrong = Object.keys(patternNames).filter((k) => k !== sample.theme).map((k) => patternNames[k]).sort();
    return choice(
      {
        id: `${topic}.${sample.id}`, prompt: 'Wie heißt dieses Mattbild?', correct: name, wrong: shuffled(wrong, draw.random),
        explanation: patternText(sample.theme, mate), media: boardMedia(position.applying(mate)),
      },
      draw,
    );
  };
}

function pairsMaker(draw: ChessDraw): LearnExercise | null {
  return pairs(
    {
      id: 'u7.pairs', prompt: 'Ordne die Mattbilder zu.',
      from: [
        { key: 'u7.pair.back', front: 'Grundreihenmatt', back: 'Eigene Bauern sperren den König ein' },
        { key: 'u7.pair.smothered', front: 'Erstickungsmatt', back: 'Ein Springer setzt matt' },
        { key: 'u7.pair.ladder', front: 'Leitermatt', back: 'Zwei Türme gehen Reihe um Reihe vor' },
        { key: 'u7.pair.scholar', front: 'Schäfermatt', back: 'Dame und Läufer zielen auf den Bauern f7' },
      ],
    },
    draw,
  );
}

function buildMakers(): Record<string, ChessMaker> {
  const table: Record<string, ChessMaker> = {
    'u7.pairs': pairsMaker,
    'u7.sentence.back': sentenceMaker('u7.sentence.back', backSentences),
    'u7.sentence.rule': sentenceMaker('u7.sentence.rule', ruleSentences),
  };
  const patternThemes = new Set(Object.keys(patternNames));
  for (const { suffix, themes } of groups) {
    table[`u7.find.${suffix}`] = find(`u7.find.${suffix}`, themes);
    table[`u7.choose.${suffix}`] = choose(`u7.choose.${suffix}`, themes);
    table[`u7.count.${suffix}`] = count(`u7.count.${suffix}`, themes);
    table[`u7.isMate.${suffix}`] = isMate(`u7.isMate.${suffix}`, themes);
    table[`u7.write.${suffix}`] = write(`u7.write.${suffix}`, themes);
    if (suffix !== 'c') table[`u7.pattern.${suffix}`] = pattern(`u7.pattern.${suffix}`, new Set([...themes].filter((t) => patternThemes.has(t))));
  }
  return table;
}

export const unit7Makers: Record<string, ChessMaker> = buildMakers();
