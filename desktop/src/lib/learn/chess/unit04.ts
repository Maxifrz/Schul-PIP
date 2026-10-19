import type { LearnExercise } from '../exercise';
import { ChessEscape, ChessGoals, escape as escapeGoal, mateInOne, moves } from './goals';
import { ChessDraw, ChessKit, ChessMaker, ChessSentence } from './kit';
import { ChessNotation } from './notation';
import { ChessPosition } from './position';
import { ChessSample, detailSquare, focusSquare, goesOn, inCheck, mated, materialEnds, mates, notInCheck, samplePosition, singleAnswer, stalemates } from './samples';
import { ChessColor, Sq, adjectiveStem, colorName, kindName, kindRaw, moveUci, opposite, pieceKinds } from './types';

const checkSentences: ChessSentence[] = [
  { key: 'must', words: ['Im', 'Schach', 'musst', 'du', 'das', 'Schach', 'sofort', 'aufheben.'], extra: ['ignorieren.', 'später'] },
  { key: 'never', words: ['Der', 'König', 'wird', 'nie', 'geschlagen,', 'sondern', 'matt', 'gesetzt.'], extra: ['immer', 'getauscht'] },
];

const endSentences: ChessSentence[] = [
  { key: 'stalemate', words: ['Ein', 'Patt', 'ist', 'ein', 'Remis.'], extra: ['Sieg.', 'Matt.'] },
  { key: 'mate', words: ['Nach', 'dem', 'Matt', 'ist', 'die', 'Partie', 'zu', 'Ende.'], extra: ['beginnt', 'Patt'] },
];

/** Unit 4, "Schach und Matt": check, getting out of check, mate, stalemate and drawn material. */
export const ChessUnit4 = {
  review: ['u4.isCheck', 'u4.escape.any', 'u4.state', 'u4.mateMove', 'u4.escape.which'],

  get makers(): Record<string, ChessMaker> {
    return {
      'u4.isCheck': isCheck,
      'u4.whichChecks': whichChecks,
      'u4.giveCheck': giveCheck,
      'u4.terms': terms,
      'u4.sentence.check': ChessKit.sentenceMaker('u4.sentence.check', checkSentences),
      'u4.sentence.end': ChessKit.sentenceMaker('u4.sentence.end', endSentences),
      'u4.escape.any': escape('u4.escape.any', 'any', 'Dein König steht im Schach. Hebe das Schach auf.',
        'Es gibt drei Wege: den König ziehen, die Figur schlagen, die Schach gibt, oder eine Figur dazwischenstellen.'),
      'u4.escape.capture': escape('u4.escape.capture', 'captureChecker', 'Schlage die Figur, die Schach gibt.',
        'Schlägst du die Figur, die Schach gibt, ist das Schach vorbei.'),
      'u4.escape.block': escape('u4.escape.block', 'interpose', 'Stelle eine Figur zwischen deinen König und die Figur, die Schach gibt.',
        'Eine Figur auf einem Feld dazwischen fängt den Angriff ab. Gegen Springer und Bauern geht das nicht.'),
      'u4.escape.king': escape('u4.escape.king', 'kingMoves', 'Ziehe deinen König aus dem Schach.',
        'Der König muss auf ein Feld, das kein Gegner angreift.'),
      'u4.escape.which': escapeWhich,
      'u4.state': state,
      'u4.mateMove': mateMove,
      'u4.mateOrStale': mateOrStale,
      'u4.dead': dead,
    };
  },
};

/** Positions in which the side to move is in check, with one of the three kinds of answer at least. */
const checked = (): ChessSample[] => [...inCheck, ...singleAnswer].filter((s) => samplePosition(s)?.isCheck === true);

const focusMark = (sample: ChessSample): string[] => (sample.focus === undefined ? [] : [sample.focus]);

function isCheck(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample([...inCheck, ...notInCheck, ...goesOn], 'u4.isCheck');
  const position = sample ? samplePosition(sample) : null;
  const king = sample ? focusSquare(sample) : null;
  if (!sample || !position || king === null) return null;
  const color = position.sideToMove;
  let explanation: string;
  if (position.isCheck) {
    const attackers = position.attackers(king, opposite(color)).map(Sq.name);
    explanation = `Das Feld ${Sq.name(king)} wird von der Figur auf ${ChessKit.list(attackers)} angegriffen: Der König steht im Schach.`;
  } else {
    explanation = `Keine gegnerische Figur greift das Feld ${Sq.name(king)} an, also steht der König nicht im Schach.`;
  }
  return ChessKit.yesNo({
    id: `u4.isCheck.${sample.id}`, prompt: `Steht der ${adjectiveStem(color)}e König im Schach?`, answer: position.isCheck,
    explanation, media: ChessKit.board(position, [Sq.name(king)]), draw,
  });
}

function whichChecks(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(inCheck, 'u4.whichChecks');
  const position = sample ? samplePosition(sample) : null;
  const king = sample ? focusSquare(sample) : null;
  const from = sample ? detailSquare(sample) : null;
  const checker = position && from !== null ? position.at(from) : null;
  if (!sample || !position || king === null || from === null || !checker) return null;
  const wrong = draw.shuffled(pieceKinds.filter((k) => k !== checker.kind).map(kindName));
  return ChessKit.choice({
    id: `u4.whichChecks.${sample.id}`, prompt: `Welche Figur gibt dem ${adjectiveStem(position.sideToMove)}en König Schach?`,
    correct: kindName(checker.kind), wrong,
    explanation: `Die Figur auf ${Sq.name(from)} ist ${ChessKit.indefinite(checker.kind)} und greift den König auf ${Sq.name(king)} an.`,
    media: ChessKit.board(position, [Sq.name(king)]), draw,
  });
}

function giveCheck(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(mates.filter((s) => ['rook', 'queen', 'backRank'].includes(s.theme)), 'u4.giveCheck');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  return ChessKit.moveExercise({
    id: `u4.giveCheck.${sample.id}`, prompt: 'Gib dem gegnerischen König Schach.', position,
    goal: moves({ check: true }), explanation: 'Schach gibst du, wenn eine deiner Figuren den gegnerischen König angreift.', withSquares: false,
  });
}

function terms(draw: ChessDraw): LearnExercise | null {
  return ChessKit.pairs({
    id: 'u4.terms', prompt: 'Ordne die Begriffe zu.', draw,
    from: [
      { key: 'u4.term.check', front: 'Schach', back: 'Der König wird angegriffen' },
      { key: 'u4.term.mate', front: 'Matt', back: 'Schach ohne Ausweg' },
      { key: 'u4.term.stalemate', front: 'Patt', back: 'Kein Schach, aber kein erlaubter Zug' },
      { key: 'u4.term.draw', front: 'Remis', back: 'Unentschieden' },
    ],
  });
}

// Getting out of check

function escape(topic: string, kind: ChessEscape, prompt: string, explanation: string): ChessMaker {
  return (draw) => {
    const pool = checked().filter((s) => {
      const position = samplePosition(s);
      return !!position && ChessGoals.accepted(escapeGoal(kind), position).length > 0;
    });
    const sample = draw.pickSample(pool, topic);
    const position = sample ? samplePosition(sample) : null;
    if (!sample || !position) return null;
    return ChessKit.moveExercise({ id: `${topic}.${sample.id}`, prompt, position, goal: escapeGoal(kind), marked: focusMark(sample), explanation });
  };
}

/** The kinds of answer a check has: king moves, capturing the checker, interposing. */
export function escapeKinds(position: ChessPosition): ChessEscape[] {
  return (['kingMoves', 'captureChecker', 'interpose'] as ChessEscape[]).filter((k) => ChessGoals.accepted(escapeGoal(k), position).length > 0);
}

function escapeWhich(draw: ChessDraw): LearnExercise | null {
  const pool = checked().filter((s) => {
    const position = samplePosition(s);
    return !!position && escapeKinds(position).length === 1;
  });
  const sample = draw.pickSample(pool, 'u4.escape.which');
  const position = sample ? samplePosition(sample) : null;
  const only = position ? escapeKinds(position)[0] : undefined;
  if (!sample || !position || only === undefined) return null;
  const texts: Record<string, string> = { kingMoves: 'Den König ziehen', captureChecker: 'Die Figur schlagen, die Schach gibt', interpose: 'Eine Figur dazwischenstellen' };
  const reasons: Record<string, string> = {
    kingMoves: 'Nichts kann die Figur schlagen oder dazwischenziehen, also muss der König ausweichen.',
    captureChecker: 'Der König kann nicht ausweichen, und nichts lässt sich dazwischenstellen: Nur das Schlagen der Figur hilft.',
    interpose: 'Der König kann nicht ausweichen, und die Figur lässt sich nicht schlagen: Nur ein Dazwischenstellen hilft.',
  };
  const wrong = [...Object.entries(texts).filter(([k]) => k !== only).map(([, v]) => v).sort(), 'Gar nicht, es ist Matt'];
  return ChessKit.choice({
    id: `u4.escape.which.${sample.id}`, prompt: 'Wie kannst du dieses Schach aufheben? Es gibt nur eine Möglichkeit.', correct: texts[only], wrong,
    explanation: reasons[only], media: ChessKit.board(position, focusMark(sample)), draw,
  });
}

// Mate, stalemate, draws

type Outcome = 'mate' | 'stalemate' | 'check' | 'quiet';

const outcomeOf = (position: ChessPosition): Outcome => (position.isCheckmate ? 'mate' : position.isStalemate ? 'stalemate' : position.isCheck ? 'check' : 'quiet');

const outcomeText = (o: Outcome): string => ({
  mate: 'Matt: Die Partie ist zu Ende',
  stalemate: 'Patt: Die Partie ist unentschieden',
  check: 'Schach, aber kein Matt',
  quiet: 'Kein Schach, die Partie geht weiter',
})[o];

const allOutcomeTexts = (['mate', 'stalemate', 'check', 'quiet'] as Outcome[]).map(outcomeText);

function outcomeExplanation(o: Outcome, color: ChessColor): string {
  const name = colorName(color);
  switch (o) {
    case 'mate': return `${name} steht im Schach und hat keinen Ausweg: kein freies Feld, nichts zum Schlagen oder Dazwischenstellen. Das ist Schachmatt.`;
    case 'stalemate': return `Der König steht nicht im Schach, aber ${name} hat keinen erlaubten Zug. Das ist Patt, und die Partie ist remis.`;
    case 'check': return 'Der König steht im Schach, kann es aber aufheben. Die Partie geht weiter.';
    case 'quiet': return `Der König steht nicht im Schach, und ${name} hat erlaubte Züge. Die Partie geht weiter.`;
  }
}

function state(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample([...mated, ...stalemates, ...goesOn, ...inCheck, ...notInCheck], 'u4.state');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const outcome = outcomeOf(position);
  const color = position.sideToMove;
  return ChessKit.choice({
    id: `u4.state.${sample.id}`, prompt: `${colorName(color)} ist am Zug. Welche Aussage stimmt?`, correct: outcomeText(outcome),
    wrong: allOutcomeTexts.filter((t) => t !== outcomeText(outcome)), explanation: outcomeExplanation(outcome, color),
    media: ChessKit.board(position, focusMark(sample)), draw,
  });
}

function mateMove(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(mates.filter((s) => ['rook', 'queen', 'backRank'].includes(s.theme)), 'u4.mateMove');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  return ChessKit.moveExercise({
    id: `u4.mateMove.${sample.id}`, prompt: 'Setze mit einem Zug matt.', position, goal: mateInOne,
    explanation: 'Matt ist Schach, bei dem der König kein Feld hat, die Figur nicht zu schlagen ist und nichts dazwischengestellt werden kann.', withSquares: false,
  });
}

/** "Weiß spielt Df7. Was ist das Ergebnis?": a move of a king-and-queen or king-and-rook position that mates, stalemates or only checks, whichever the draw picks among those that exist. */
function mateOrStale(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(mates.filter((s) => ['rook', 'queen'].includes(s.theme)), 'u4.mateOrStale');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const results = position.legalMoves().map((m) => ({ move: m, outcome: outcomeOf(position.applying(m)) }));
  const classes = (['mate', 'stalemate', 'check'] as Outcome[]).filter((k) => results.some((r) => r.outcome === k));
  const outcome = draw.randomElement(classes);
  if (outcome === null) return null;
  const chosen = draw.randomElement(results.filter((r) => r.outcome === outcome));
  const san = chosen ? ChessNotation.san(chosen.move, position) : null;
  if (!chosen || san === null) return null;
  const color = position.sideToMove;
  return ChessKit.choice({
    id: `u4.mateOrStale.${sample.id}.${moveUci(chosen.move)}`, prompt: `${colorName(color)} spielt ${ChessKit.sanWithoutSign(san)}. Was ist das Ergebnis?`,
    correct: outcomeText(outcome), wrong: allOutcomeTexts.filter((t) => t !== outcomeText(outcome)),
    explanation: outcomeExplanation(outcome, opposite(color)), media: ChessKit.board(position), draw,
  });
}

function dead(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(materialEnds, 'u4.dead');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const possible = !position.hasInsufficientMaterial;
  const kinds = position.pieces.map((p) => p.piece.kind).filter((k) => k !== 'king');
  const strongest = kinds.length === 0 ? null : kinds.reduce((a, b) => (kindRaw(b) > kindRaw(a) ? b : a));
  let explanation: string;
  if (!possible) explanation = 'König gegen König, oder König und ein einzelner Läufer oder Springer gegen König: Das reicht nie zum Matt. Die Partie ist sofort remis.';
  else if (strongest === 'pawn') explanation = 'Ein Bauer kann sich in eine Dame umwandeln, und mit einer Dame ist Matt möglich.';
  else explanation = 'Mit Dame oder Turm und König lässt sich der gegnerische König mattsetzen.';
  return ChessKit.yesNo({
    id: `u4.dead.${sample.id}`, prompt: 'Reicht das Material, damit überhaupt noch jemand Matt setzen kann?', answer: possible,
    explanation, media: ChessKit.board(position), draw,
  });
}
