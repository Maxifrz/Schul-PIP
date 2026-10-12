// Unit 4, "Schach und Matt": check, getting out of check, mate, stalemate and drawn material. Port of ChessUnit4.swift.

import type { LearnExercise } from '../../exercise';
import { randomElement, shuffled } from '../../random';
import { acceptedMoves, type ChessEscape } from '../goals';
import { indefinite, list, sanWithoutSign } from '../kit';
import { san } from '../notation';
import type { ChessPosition } from '../position';
import {
  ALL_PIECE_KINDS, KING, PAWN, colorAdjectiveStem, colorGermanName, kindGermanName, moveUci, oppositeColor, squareName,
  type ChessColor, type ChessMove,
} from '../types';
import {
  boardMedia, choice, moveExercise, pairs, sentence, sentenceMaker, yesNo, type ChessDraw, type ChessMaker,
} from './courseKit';
import {
  goesOn, inCheck, mated, materialEnds, mates, notInCheck, sampleDetailSquare, sampleFocus, samplePosition, singleAnswer, stalemates,
  type ChessSample,
} from './samples';

export const unit4Review = ['u4.isCheck', 'u4.escape.any', 'u4.state', 'u4.mateMove', 'u4.escape.which'];

const checkSentences = [
  sentence('must', ['Im', 'Schach', 'musst', 'du', 'das', 'Schach', 'sofort', 'aufheben.'], ['ignorieren.', 'später']),
  sentence('never', ['Der', 'König', 'wird', 'nie', 'geschlagen,', 'sondern', 'matt', 'gesetzt.'], ['immer', 'getauscht']),
];

const endSentences = [
  sentence('stalemate', ['Ein', 'Patt', 'ist', 'ein', 'Remis.'], ['Sieg.', 'Matt.']),
  sentence('mate', ['Nach', 'dem', 'Matt', 'ist', 'die', 'Partie', 'zu', 'Ende.'], ['beginnt', 'Patt']),
];

/** Positions in which the side to move is in check, with one of the three kinds of answer at least. */
function checked(): ChessSample[] {
  return [...inCheck, ...singleAnswer].filter((s) => samplePosition(s)?.isCheck === true);
}

const markedOf = (sample: ChessSample): string[] => (sample.focus === null ? [] : [sample.focus]);

function isCheck(draw: ChessDraw): LearnExercise | null {
  const pool = [...inCheck, ...notInCheck, ...goesOn];
  const sample = draw.pickSample(pool, 'u4.isCheck');
  if (!sample) return null;
  const position = samplePosition(sample);
  const king = sampleFocus(sample);
  if (!position || king === null) return null;
  const color = position.sideToMove;
  let explanation: string;
  if (position.isCheck) {
    const attackers = position.attackers(king, oppositeColor(color)).map(squareName);
    explanation = `Das Feld ${squareName(king)} wird von der Figur auf ${list(attackers)} angegriffen: Der König steht im Schach.`;
  } else {
    explanation = `Keine gegnerische Figur greift das Feld ${squareName(king)} an, also steht der König nicht im Schach.`;
  }
  return yesNo(
    {
      id: `u4.isCheck.${sample.id}`, prompt: `Steht der ${colorAdjectiveStem(color)}e König im Schach?`, answer: position.isCheck,
      explanation, media: boardMedia(position, [squareName(king)]),
    },
    draw,
  );
}

function whichChecks(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(inCheck, 'u4.whichChecks');
  if (!sample) return null;
  const position = samplePosition(sample);
  const king = sampleFocus(sample);
  const from = sampleDetailSquare(sample);
  if (!position || king === null || from === null) return null;
  const checker = position.pieceAt(from);
  if (!checker) return null;
  const wrong = shuffled(ALL_PIECE_KINDS.filter((k) => k !== checker.kind).map(kindGermanName), draw.random);
  return choice(
    {
      id: `u4.whichChecks.${sample.id}`, prompt: `Welche Figur gibt dem ${colorAdjectiveStem(position.sideToMove)}en König Schach?`,
      correct: kindGermanName(checker.kind), wrong,
      explanation: `Die Figur auf ${squareName(from)} ist ${indefinite(checker.kind)} und greift den König auf ${squareName(king)} an.`,
      media: boardMedia(position, [squareName(king)]),
    },
    draw,
  );
}

function giveCheck(draw: ChessDraw): LearnExercise | null {
  const pool = mates.filter((s) => ['rook', 'queen', 'backRank'].includes(s.theme));
  const sample = draw.pickSample(pool, 'u4.giveCheck');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  return moveExercise({
    id: `u4.giveCheck.${sample.id}`, prompt: 'Gib dem gegnerischen König Schach.', position,
    goal: { type: 'moves', filter: { check: true } }, explanation: 'Schach gibst du, wenn eine deiner Figuren den gegnerischen König angreift.',
    withSquares: false,
  });
}

function terms(draw: ChessDraw): LearnExercise | null {
  return pairs(
    {
      id: 'u4.terms', prompt: 'Ordne die Begriffe zu.',
      from: [
        { key: 'u4.term.check', front: 'Schach', back: 'Der König wird angegriffen' },
        { key: 'u4.term.mate', front: 'Matt', back: 'Schach ohne Ausweg' },
        { key: 'u4.term.stalemate', front: 'Patt', back: 'Kein Schach, aber kein erlaubter Zug' },
        { key: 'u4.term.draw', front: 'Remis', back: 'Unentschieden' },
      ],
    },
    draw,
  );
}

// Getting out of check

function escape(topic: string, kind: ChessEscape, prompt: string, explanation: string): ChessMaker {
  return (draw) => {
    const pool = checked().filter((sample) => {
      const position = samplePosition(sample);
      return position ? acceptedMoves({ type: 'escape', kind }, position).length > 0 : false;
    });
    const sample = draw.pickSample(pool, topic);
    if (!sample) return null;
    const position = samplePosition(sample);
    if (!position) return null;
    return moveExercise({
      id: `${topic}.${sample.id}`, prompt, position, goal: { type: 'escape', kind }, marked: markedOf(sample), explanation,
    });
  };
}

/** The kinds of answer a check has: king moves, capturing the checker, interposing. */
export function escapeKinds(position: ChessPosition): ChessEscape[] {
  const kinds: ChessEscape[] = ['kingMoves', 'captureChecker', 'interpose'];
  return kinds.filter((kind) => acceptedMoves({ type: 'escape', kind }, position).length > 0);
}

function escapeWhich(draw: ChessDraw): LearnExercise | null {
  const pool = checked().filter((sample) => {
    const position = samplePosition(sample);
    return position ? escapeKinds(position).length === 1 : false;
  });
  const sample = draw.pickSample(pool, 'u4.escape.which');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const only = escapeKinds(position)[0];
  if (only === undefined) return null;
  const texts: Record<string, string> = {
    kingMoves: 'Den König ziehen', captureChecker: 'Die Figur schlagen, die Schach gibt', interpose: 'Eine Figur dazwischenstellen',
  };
  const reasons: Record<string, string> = {
    kingMoves: 'Nichts kann die Figur schlagen oder dazwischenziehen, also muss der König ausweichen.',
    captureChecker: 'Der König kann nicht ausweichen, und nichts lässt sich dazwischenstellen: Nur das Schlagen der Figur hilft.',
    interpose: 'Der König kann nicht ausweichen, und die Figur lässt sich nicht schlagen: Nur ein Dazwischenstellen hilft.',
  };
  const right = texts[only];
  const reason = reasons[only];
  const wrong = Object.keys(texts).filter((k) => k !== only).map((k) => texts[k]).sort().concat(['Gar nicht, es ist Matt']);
  return choice(
    {
      id: `u4.escape.which.${sample.id}`, prompt: 'Wie kannst du dieses Schach aufheben? Es gibt nur eine Möglichkeit.', correct: right, wrong,
      explanation: reason, media: boardMedia(position, markedOf(sample)),
    },
    draw,
  );
}

// Mate, stalemate, draws

type Outcome = 'mate' | 'stalemate' | 'check' | 'quiet';

function outcomeOf(position: ChessPosition): Outcome {
  if (position.isCheckmate) return 'mate';
  if (position.isStalemate) return 'stalemate';
  if (position.isCheck) return 'check';
  return 'quiet';
}

function outcomeText(outcome: Outcome): string {
  switch (outcome) {
    case 'mate': return 'Matt: Die Partie ist zu Ende';
    case 'stalemate': return 'Patt: Die Partie ist unentschieden';
    case 'check': return 'Schach, aber kein Matt';
    case 'quiet': return 'Kein Schach, die Partie geht weiter';
  }
}

const ALL_OUTCOME_TEXTS = (['mate', 'stalemate', 'check', 'quiet'] as Outcome[]).map(outcomeText);

function outcomeExplanation(outcome: Outcome, color: ChessColor): string {
  const name = colorGermanName(color);
  switch (outcome) {
    case 'mate': return `${name} steht im Schach und hat keinen Ausweg: kein freies Feld, nichts zum Schlagen oder Dazwischenstellen. Das ist Schachmatt.`;
    case 'stalemate': return `Der König steht nicht im Schach, aber ${name} hat keinen erlaubten Zug. Das ist Patt, und die Partie ist remis.`;
    case 'check': return 'Der König steht im Schach, kann es aber aufheben. Die Partie geht weiter.';
    case 'quiet': return `Der König steht nicht im Schach, und ${name} hat erlaubte Züge. Die Partie geht weiter.`;
  }
}

function state(draw: ChessDraw): LearnExercise | null {
  const pool = [...mated, ...stalemates, ...goesOn, ...inCheck, ...notInCheck];
  const sample = draw.pickSample(pool, 'u4.state');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const outcome = outcomeOf(position);
  const color = position.sideToMove;
  return choice(
    {
      id: `u4.state.${sample.id}`, prompt: `${colorGermanName(color)} ist am Zug. Welche Aussage stimmt?`, correct: outcomeText(outcome),
      wrong: ALL_OUTCOME_TEXTS.filter((t) => t !== outcomeText(outcome)), explanation: outcomeExplanation(outcome, color),
      media: boardMedia(position, markedOf(sample)),
    },
    draw,
  );
}

function mateMove(draw: ChessDraw): LearnExercise | null {
  const pool = mates.filter((s) => ['rook', 'queen', 'backRank'].includes(s.theme));
  const sample = draw.pickSample(pool, 'u4.mateMove');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  return moveExercise({
    id: `u4.mateMove.${sample.id}`, prompt: 'Setze mit einem Zug matt.', position, goal: { type: 'mateInOne' },
    explanation: 'Matt ist Schach, bei dem der König kein Feld hat, die Figur nicht zu schlagen ist und nichts dazwischengestellt werden kann.',
    withSquares: false,
  });
}

/** "Weiß spielt Df7. Was ist das Ergebnis?": a move of a king-and-queen or king-and-rook position that mates,
 * stalemates or only checks, whichever the draw picks among those that exist. */
function mateOrStale(draw: ChessDraw): LearnExercise | null {
  const pool = mates.filter((s) => ['rook', 'queen'].includes(s.theme));
  const sample = draw.pickSample(pool, 'u4.mateOrStale');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const results: { move: ChessMove; outcome: Outcome }[] = position.legalMoves().map((m) => ({ move: m, outcome: outcomeOf(position.applying(m)) }));
  const classes = (['mate', 'stalemate', 'check'] as Outcome[]).filter((kind) => results.some((r) => r.outcome === kind));
  const outcome = randomElement(classes, draw.random);
  if (outcome === undefined) return null;
  const chosen = randomElement(results.filter((r) => r.outcome === outcome), draw.random);
  if (chosen === undefined) return null;
  const text = san(chosen.move, position);
  if (text === null) return null;
  const color = position.sideToMove;
  return choice(
    {
      id: `u4.mateOrStale.${sample.id}.${moveUci(chosen.move)}`, prompt: `${colorGermanName(color)} spielt ${sanWithoutSign(text)}. Was ist das Ergebnis?`,
      correct: outcomeText(outcome), wrong: ALL_OUTCOME_TEXTS.filter((t) => t !== outcomeText(outcome)),
      explanation: outcomeExplanation(outcome, oppositeColor(color)), media: boardMedia(position),
    },
    draw,
  );
}

function dead(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(materialEnds, 'u4.dead');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const possible = !position.hasInsufficientMaterial;
  const kinds = position.pieces.map((p) => p.piece.kind).filter((k) => k !== KING);
  const strongest = kinds.length === 0 ? null : Math.max(...kinds);
  let explanation: string;
  if (!possible) {
    explanation = 'König gegen König, oder König und ein einzelner Läufer oder Springer gegen König: Das reicht nie zum Matt. Die Partie ist sofort remis.';
  } else if (strongest === PAWN) {
    explanation = 'Ein Bauer kann sich in eine Dame umwandeln, und mit einer Dame ist Matt möglich.';
  } else {
    explanation = 'Mit Dame oder Turm und König lässt sich der gegnerische König mattsetzen.';
  }
  return yesNo(
    {
      id: `u4.dead.${sample.id}`, prompt: 'Reicht das Material, damit überhaupt noch jemand Matt setzen kann?', answer: possible,
      explanation, media: boardMedia(position),
    },
    draw,
  );
}

export const unit4Makers: Record<string, ChessMaker> = {
  'u4.isCheck': isCheck,
  'u4.whichChecks': whichChecks,
  'u4.giveCheck': giveCheck,
  'u4.terms': terms,
  'u4.sentence.check': sentenceMaker('u4.sentence.check', checkSentences),
  'u4.sentence.end': sentenceMaker('u4.sentence.end', endSentences),
  'u4.escape.any': escape(
    'u4.escape.any', 'any', 'Dein König steht im Schach. Hebe das Schach auf.',
    'Es gibt drei Wege: den König ziehen, die Figur schlagen, die Schach gibt, oder eine Figur dazwischenstellen.',
  ),
  'u4.escape.capture': escape(
    'u4.escape.capture', 'captureChecker', 'Schlage die Figur, die Schach gibt.', 'Schlägst du die Figur, die Schach gibt, ist das Schach vorbei.',
  ),
  'u4.escape.block': escape(
    'u4.escape.block', 'interpose', 'Stelle eine Figur zwischen deinen König und die Figur, die Schach gibt.',
    'Eine Figur auf einem Feld dazwischen fängt den Angriff ab. Gegen Springer und Bauern geht das nicht.',
  ),
  'u4.escape.king': escape('u4.escape.king', 'kingMoves', 'Ziehe deinen König aus dem Schach.', 'Der König muss auf ein Feld, das kein Gegner angreift.'),
  'u4.escape.which': escapeWhich,
  'u4.state': state,
  'u4.mateMove': mateMove,
  'u4.mateOrStale': mateOrStale,
  'u4.dead': dead,
};
