import type { LearnExercise } from '../exercise';
import { typed } from '../exercises';
import { ChessGoals, mateInOne } from './goals';
import { ChessDraw, ChessKit, ChessMaker, ChessSentence } from './kit';
import { ChessNotation } from './notation';
import { ChessPosition } from './position';
import { mates, samplePosition } from './samples';
import { ChessMove, Sq, colorName, moveUci } from './types';

const groupA = new Set(['backRank', 'smothered']);
const groupB = new Set(['scholar', 'fool', 'ladder']);
const groupC = new Set(['queen', 'rook']);
const groups: Array<{ suffix: string; themes: Set<string> }> = [
  { suffix: 'a', themes: groupA },
  { suffix: 'b', themes: groupB },
  { suffix: 'c', themes: groupC },
  { suffix: 'all', themes: new Set([...groupA, ...groupB, ...groupC]) },
];

/** The German name of each named pattern. */
const patternNames: Record<string, string> = {
  backRank: 'Grundreihenmatt', smothered: 'Erstickungsmatt', scholar: 'Schäfermatt', ladder: 'Leitermatt', fool: 'Narrenmatt',
};

const backSentences: ChessSentence[] = [
  { key: 'back', words: ['Beim', 'Grundreihenmatt', 'sperren', 'die', 'eigenen', 'Bauern', 'den', 'König', 'ein.'], extra: ['Läufer', 'Springer'] },
  { key: 'knight', words: ['Beim', 'Erstickungsmatt', 'setzt', 'ein', 'Springer', 'matt.'], extra: ['Turm', 'Läufer'] },
];

const ruleSentences: ChessSentence[] = [
  { key: 'three', words: ['Ein', 'Matt', 'ist', 'ein', 'Schach', 'ohne', 'Ausweg.'], extra: ['Remis', 'Patt'] },
  { key: 'all', words: ['Gesucht', 'sind', 'alle', 'Züge,', 'die', 'sofort', 'matt', 'setzen.'], extra: ['keine', 'später'] },
];

/** Unit 7, "Matt in einem Zug": the mating patterns and finding every mate in one. */
export const ChessUnit7 = {
  review: ['u7.find.all', 'u7.choose.all', 'u7.isMate.all', 'u7.pattern.all'],

  get makers(): Record<string, ChessMaker> {
    const table: Record<string, ChessMaker> = {
      'u7.pairs': pairs,
      'u7.sentence.back': ChessKit.sentenceMaker('u7.sentence.back', backSentences),
      'u7.sentence.rule': ChessKit.sentenceMaker('u7.sentence.rule', ruleSentences),
    };
    for (const { suffix, themes } of groups) {
      table[`u7.find.${suffix}`] = find(`u7.find.${suffix}`, themes);
      table[`u7.choose.${suffix}`] = choose(`u7.choose.${suffix}`, themes);
      table[`u7.count.${suffix}`] = count(`u7.count.${suffix}`, themes);
      table[`u7.isMate.${suffix}`] = isMate(`u7.isMate.${suffix}`, themes);
      table[`u7.write.${suffix}`] = write(`u7.write.${suffix}`, themes);
      if (suffix !== 'c') table[`u7.pattern.${suffix}`] = pattern(`u7.pattern.${suffix}`, new Set([...themes].filter((t) => t in patternNames)));
    }
    return table;
  },
};

const pool = (themes: Set<string>) => mates.filter((s) => themes.has(s.theme));

/** The sentence that explains the pattern a mate shows, for the feedback. */
export function patternText(theme: string, move: ChessMove): string {
  switch (theme) {
    case 'backRank': return 'Der König steht auf der Grundreihe, und seine eigenen Bauern nehmen ihm die Felder davor: Grundreihenmatt.';
    case 'smothered': return 'Eigene Figuren nehmen dem König alle Felder, und ein Springer gibt Schach: Erstickungsmatt.';
    case 'scholar': return `Dame und Läufer zielen auf ${Sq.name(move.to)}. Die Dame schlägt dort mit Schach, und der Läufer deckt sie: Schäfermatt.`;
    case 'ladder': return 'Zwei Türme setzen Reihe um Reihe ab: Der eine sperrt die Reihe davor, der andere gibt Schach. Das ist ein Leitermatt.';
    case 'fool': return 'Das schnellste mögliche Matt: Nach nur zwei Zügen jeder Seite ist die Partie vorbei (Narrenmatt).';
    case 'queen': return 'Die Dame gibt Schach, und der eigene König deckt sie und nimmt die Fluchtfelder: Matt am Rand.';
    default: return 'Der Turm gibt Schach auf der Randreihe, und der eigene König nimmt die Fluchtfelder: Matt am Rand.';
  }
}

const firstMate = (position: ChessPosition): ChessMove | null => ChessGoals.accepted(mateInOne, position)[0] ?? null;

function find(topic: string, themes: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pool(themes), topic);
    const position = sample ? samplePosition(sample) : null;
    const mate = position ? firstMate(position) : null;
    if (!sample || !position || !mate) return null;
    return ChessKit.moveExercise({
      id: `${topic}.${sample.id}`, prompt: 'Setze in einem Zug matt.', position, goal: mateInOne,
      explanation: patternText(sample.theme, mate), withSquares: false,
    });
  };
}

function choose(topic: string, themes: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pool(themes), topic);
    const position = sample ? samplePosition(sample) : null;
    if (!sample || !position) return null;
    const matesList = ChessGoals.accepted(mateInOne, position);
    const right = draw.randomElement(matesList);
    const rightText = right ? ChessNotation.san(right, position) : null;
    if (!right || rightText === null) return null;
    const others = position.legalMoves().filter((m) => !matesList.some((x) => x.from === m.from && x.to === m.to && x.promotion === m.promotion));
    // Moves that give check first: they look like mates but are not.
    const checks = draw.shuffled(others.filter((m) => position.givesCheck(m)));
    const captures = draw.shuffled(others.filter((m) => position.isCapture(m) && !position.givesCheck(m)));
    const quiet = draw.shuffled(others.filter((m) => !position.isCapture(m) && !position.givesCheck(m)));
    const wrong: string[] = [];
    for (const m of [...checks, ...captures, ...quiet]) {
      if (wrong.length >= 3) break;
      const text = ChessNotation.san(m, position);
      if (text === null) continue;
      const plain = ChessKit.sanWithoutSign(text);
      if (plain !== ChessKit.sanWithoutSign(rightText) && !wrong.includes(plain)) wrong.push(plain);
    }
    return ChessKit.choice({
      id: `${topic}.${sample.id}`, prompt: 'Welcher Zug setzt matt?', correct: ChessKit.sanWithoutSign(rightText), wrong,
      explanation: patternText(sample.theme, right), media: ChessKit.board(position), draw,
    });
  };
}

function count(topic: string, themes: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pool(themes), topic);
    const position = sample ? samplePosition(sample) : null;
    if (!sample || !position) return null;
    const matesList = ChessGoals.accepted(mateInOne, position);
    const texts = matesList.map((m) => ChessNotation.san(m, position)).filter((t): t is string => t !== null);
    return ChessKit.number({
      id: `${topic}.${sample.id}`, prompt: 'Wie viele Züge setzen hier sofort matt?', answer: matesList.length,
      explanation: `Matt setzen: ${texts.join(', ')}.`, media: ChessKit.board(position),
    });
  };
}

function isMate(topic: string, themes: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pool(themes), topic);
    const position = sample ? samplePosition(sample) : null;
    if (!sample || !position) return null;
    const checks = position.legalMoves().filter((m) => position.givesCheck(m));
    const wantMate = draw.coin();
    const candidates = checks.filter((m) => position.applying(m).isCheckmate === wantMate);
    const move = draw.randomElement(candidates.length === 0 ? checks : candidates);
    const san = move ? ChessNotation.san(move, position) : null;
    if (!move || san === null) return null;
    const after = position.applying(move);
    const mate = after.isCheckmate;
    let explanation: string;
    if (mate) {
      explanation = 'Der König hat kein Feld, die Figur ist nicht zu schlagen, und nichts kann dazwischen: Matt.';
    } else {
      const first = after.legalMoves()[0];
      const reply = first ? ChessNotation.san(first, after) : null;
      explanation = `${colorName(after.sideToMove)} kann das Schach aufheben, zum Beispiel mit ${reply ?? 'einem Zug'}. Es ist also nicht Matt.`;
    }
    return ChessKit.yesNo({
      id: `${topic}.${sample.id}.${moveUci(move)}`,
      prompt: `${colorName(position.sideToMove)} spielt ${ChessKit.sanWithoutSign(san)} und gibt damit Schach. Ist das Matt?`, answer: mate,
      explanation, media: ChessKit.board(position), draw,
    });
  };
}

/** Typing the mating move in notation; every mating move is accepted, with or without the signs. */
function write(topic: string, themes: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pool(themes), topic);
    const position = sample ? samplePosition(sample) : null;
    if (!sample || !position) return null;
    const matesList = ChessGoals.accepted(mateInOne, position);
    const texts = matesList.map((m) => ChessNotation.san(m, position)).filter((t): t is string => t !== null);
    if (texts.length === 0) return null;
    const forms = texts.flatMap((t) => ChessKit.typedVariants(t));
    return typed({
      id: `${topic}.${sample.id}`,
      prompt: 'Setze matt und schreibe den Zug auf: Buchstabe der Figur und Zielfeld, zum Beispiel Sf3.', answer: texts[0],
      alternatives: forms, mode: 'exact', solution: texts.join(' oder '),
      explanation: patternText(sample.theme, matesList[0]), media: ChessKit.board(position),
    });
  };
}

/** "Wie heißt dieses Mattbild?": the position after the mate, and the four names. */
function pattern(topic: string, themes: Set<string>): ChessMaker {
  return (draw) => {
    const sample = draw.pickSample(pool(themes), topic);
    const position = sample ? samplePosition(sample) : null;
    const mate = position ? firstMate(position) : null;
    const name = sample ? patternNames[sample.theme] : undefined;
    if (!sample || !position || !mate || name === undefined) return null;
    const wrong = Object.entries(patternNames).filter(([k]) => k !== sample.theme).map(([, v]) => v).sort();
    return ChessKit.choice({
      id: `${topic}.${sample.id}`, prompt: 'Wie heißt dieses Mattbild?', correct: name, wrong: draw.shuffled(wrong),
      explanation: patternText(sample.theme, mate), media: ChessKit.board(position.applying(mate)), draw,
    });
  };
}

function pairs(draw: ChessDraw): LearnExercise | null {
  return ChessKit.pairs({
    id: 'u7.pairs', prompt: 'Ordne die Mattbilder zu.', draw,
    from: [
      { key: 'u7.pair.back', front: 'Grundreihenmatt', back: 'Eigene Bauern sperren den König ein' },
      { key: 'u7.pair.smothered', front: 'Erstickungsmatt', back: 'Ein Springer setzt matt' },
      { key: 'u7.pair.ladder', front: 'Leitermatt', back: 'Zwei Türme gehen Reihe um Reihe vor' },
      { key: 'u7.pair.scholar', front: 'Schäfermatt', back: 'Dame und Läufer zielen auf den Bauern f7' },
    ],
  });
}
