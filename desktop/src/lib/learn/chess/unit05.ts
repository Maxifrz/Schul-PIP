import type { LearnExercise } from '../exercise';
import { ChessCastleSide, ChessCastling, ChessCastlingProblem } from './analysis';
import { ChessGoals, moves } from './goals';
import { ChessDraw, ChessKit, ChessMaker, ChessSentence, ChessStatement } from './kit';
import { ChessPosition } from './position';
import { ChessSample, castling, classify as classifySamples, detailMove, focusSquare, promotions, samplePosition } from './samples';
import { epYesNo } from './unit03';
import { ChessColor, Sq, Square, adjectiveStem, colors, colorName, homeRank, kindName, piece, samePiece } from './types';

const castleSentences: ChessSentence[] = [
  { key: 'king', words: ['Bei', 'der', 'Rochade', 'zieht', 'der', 'König', 'zwei', 'Felder', 'zum', 'Turm.'], extra: ['drei', 'ein'] },
  { key: 'both', words: ['Die', 'Rochade', 'ist', 'ein', 'Zug', 'mit', 'König', 'und', 'Turm.'], extra: ['Dame', 'zwei'] },
];

const castleRules: ChessStatement[] = [
  {
    key: 'check', prompt: 'Welcher Satz über die Rochade stimmt?', correct: 'Der König darf dabei nicht im Schach stehen.',
    wrong: ['Der Turm darf dabei nicht angegriffen sein.', 'Zwischen König und Turm darf eine Figur stehen.', 'Die Rochade ist auch erlaubt, wenn der König schon gezogen hat.'],
    explanation: 'Aus dem Schach heraus rochiert man nicht. Der Turm darf angegriffen sein, und zwischen beiden muss alles frei sein.',
  },
  {
    key: 'path', prompt: 'Welcher Satz über die Rochade stimmt?', correct: 'Der König darf nicht über ein angegriffenes Feld ziehen.',
    wrong: ['Die lange Rochade ist verboten, wenn das Feld b1 angegriffen wird.', 'Die Rochade ist verboten, wenn der Turm angegriffen wird.', 'Mit einem Turm, der schon gezogen hat und zurückgekehrt ist, darf man rochieren.'],
    explanation: 'Es zählen nur die Felder, über die der König zieht, und das Feld, auf dem er landet. Der Turm und das Feld b1 spielen keine Rolle.',
  },
  {
    key: 'count', prompt: 'Welcher Satz über die Rochade stimmt?', correct: 'Die Rochade zählt als ein Zug.',
    wrong: ['Die Rochade zählt als zwei Züge.', 'Mit der Rochade darf man eine Figur schlagen.', 'Nach der Rochade darf man gleich noch einmal ziehen.'],
    explanation: 'König und Turm ziehen zusammen in einem einzigen Zug, und dabei wird nichts geschlagen.',
  },
  {
    key: 'rook', prompt: 'Welcher Satz über die Rochade stimmt?', correct: 'Hat sich ein Turm schon bewegt, geht die Rochade mit diesem Turm nicht mehr.',
    wrong: ['Die Rochade bleibt erlaubt, wenn der Turm auf sein Feld zurückkehrt.', 'Dann geht die Rochade auch mit dem anderen Turm nicht mehr.', 'Nur der König muss sich noch nie bewegt haben.'],
    explanation: 'Der König und der Turm, mit dem man rochiert, dürfen sich noch nie bewegt haben. Der andere Turm ist davon nicht betroffen.',
  },
];

const epRules: ChessStatement[] = [
  {
    key: 'moment', prompt: 'Welcher Satz über en passant stimmt?', correct: 'En passant ist nur im Zug direkt nach dem Doppelschritt erlaubt.',
    wrong: ['En passant ist jederzeit erlaubt, solange die Bauern nebeneinander stehen.', 'Auch ein Springer darf en passant schlagen.', 'En passant schlägt man einen Bauern, der nur ein Feld gezogen ist.'],
    explanation: 'Nur ein Bauer schlägt en passant, nur einen Bauern, der gerade zwei Felder gezogen ist, und nur sofort.',
  },
  {
    key: 'landing', prompt: 'Welcher Satz über en passant stimmt?', correct: 'Der schlagende Bauer landet auf dem Feld, das der gegnerische Bauer übersprungen hat.',
    wrong: ['Der schlagende Bauer landet auf dem Feld des gegnerischen Bauern.', 'Der schlagende Bauer bleibt auf seinem Feld.', 'Der schlagende Bauer landet zwei Felder weiter.'],
    explanation: 'Man schlägt, als wäre der gegnerische Bauer nur ein Feld gezogen. Der Bauer geht also auf das übersprungene Feld.',
  },
];

const promoRules: ChessStatement[] = [
  {
    key: 'must', prompt: 'Welcher Satz über die Umwandlung stimmt?', correct: 'Ein Bauer auf der letzten Reihe muss sich umwandeln.',
    wrong: ['Ein Bauer darf auf der letzten Reihe bleiben.', 'Ein Bauer darf sich nur in eine schon geschlagene Figur umwandeln.', 'Ein Bauer darf sich auch in einen König umwandeln.'],
    explanation: 'Der Bauer wird im selben Zug zu Dame, Turm, Läufer oder Springer, ganz gleich, welche Figuren schon geschlagen wurden.',
  },
  {
    key: 'queens', prompt: 'Welcher Satz über die Umwandlung stimmt?', correct: 'Man darf mehrere Damen gleichzeitig haben.',
    wrong: ['Man darf höchstens eine Dame haben.', 'Eine zweite Dame gibt es nur, wenn die erste geschlagen wurde.', 'Ein Bauer wird auf der letzten Reihe immer zu einer Dame.'],
    explanation: 'Die Wahl ist nicht auf geschlagene Figuren beschränkt. Auch eine zweite oder dritte Dame ist erlaubt.',
  },
];

/** Unit 5, "Sonderzüge": castling and when it is not allowed, en passant and promotion in detail. */
export const ChessUnit5 = {
  review: ['u5.castleMove', 'u5.castleCan', 'u5.classify', 'u5.epYesNo', 'u5.castleReason'],

  get makers(): Record<string, ChessMaker> {
    return {
      'u5.castleMove': castleMove,
      'u5.castleSquares': castleSquares,
      'u5.castlePairs': castlePairs,
      'u5.sentence.castle': ChessKit.sentenceMaker('u5.sentence.castle', castleSentences),
      'u5.castleCan': castleCan,
      'u5.castleReason': castleReason,
      'u5.castleRules': ChessKit.statementMaker('u5.castleRules', castleRules),
      'u5.classify': classify,
      'u5.epYesNo': epYesNo('u5.epYesNo', new Set(['available', 'late', 'single', 'pinned'])),
      'u5.epRules': ChessKit.statementMaker('u5.epRules', epRules),
      'u5.promoCheck': promoCheck,
      'u5.promoPiece': promoPiece,
      'u5.promoRules': ChessKit.statementMaker('u5.promoRules', promoRules),
    };
  },
};

const castleSide = (sample: ChessSample): ChessCastleSide => (sample.detail === 'kurz' ? 'kingside' : 'queenside');
const sideWord = (side: ChessCastleSide): string => (side === 'kingside' ? 'kurz' : 'lang');
const sideGerman = (side: ChessCastleSide): string => (side === 'kingside' ? 'kurze' : 'lange');

/** The squares of the king's way: the one it crosses and the one it lands on. */
function kingWay(side: ChessCastleSide, color: ChessColor): { cross: Square; land: Square } {
  const rank = homeRank(color);
  return { cross: Sq.at(side === 'kingside' ? 5 : 3, rank) as Square, land: Sq.at(side === 'kingside' ? 6 : 2, rank) as Square };
}

const hasExpected = (s: ChessSample, word: string) => s.expected.length === 1 && s.expected[0] === word;

function castleMove(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(castling.filter((s) => hasExpected(s, 'ja')), 'u5.castleMove');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const side = castleSide(sample);
  const way = kingWay(side, position.sideToMove);
  return ChessKit.moveExercise({
    id: `u5.castleMove.${sample.id}`, prompt: `Rochiere ${sideWord(side)}.`, position,
    goal: moves({ castling: side }),
    explanation: `Der König zieht zwei Felder zum Turm hin, nach ${Sq.name(way.land)}. Der Turm springt auf die andere Seite des Königs, nach ${Sq.name(way.cross)}. Du führst den Zug mit dem König aus.`,
  });
}

function castleSquares(draw: ChessDraw): LearnExercise | null {
  interface Case { color: ChessColor; side: ChessCastleSide; king: boolean }
  const cases: Case[] = [];
  for (const color of colors) for (const side of ['kingside', 'queenside'] as ChessCastleSide[]) for (const king of [true, false]) cases.push({ color, side, king });
  const item = draw.pick(cases, 'u5.castleSquares', (c) => `${adjectiveStem(c.color)}.${sideWord(c.side)}.${c.king}`);
  if (!item) return null;
  const fen = item.color === 'white' ? 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' : 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1';
  const position = ChessPosition.fromFEN(fen);
  if (!position) return null;
  const rank = homeRank(item.color);
  const kingFrom = Sq.at(4, rank) as Square;
  const rookFrom = Sq.at(item.side === 'kingside' ? 7 : 0, rank) as Square;
  const way = kingWay(item.side, item.color);
  // The king lands on the far square of its way, the rook on the near one.
  const right = item.king ? way.land : way.cross;
  const other = item.king ? way.cross : way.land;
  const subject = item.king ? 'der König' : 'der Turm';
  const castle = ChessGoals.accepted(moves({ castling: item.side }), position)[0];
  if (!castle) return null;
  const after = position.applying(castle);
  if (!samePiece(after.at(right), piece(item.color, item.king ? 'king' : 'rook'))) return null;
  return ChessKit.choice({
    id: `u5.castleSquares.${adjectiveStem(item.color)}.${sideWord(item.side)}.${item.king ? 'king' : 'rook'}`,
    prompt: `Auf welchem Feld steht ${subject} nach der ${sideGerman(item.side)}n Rochade von ${colorName(item.color)}?`, correct: Sq.name(right),
    wrong: [Sq.name(rookFrom), Sq.name(kingFrom), Sq.name(other)],
    explanation: `Der König zieht zwei Felder zum Turm hin und steht auf ${Sq.name(way.land)}. Der Turm springt über ihn hinweg auf ${Sq.name(way.cross)}.`,
    media: ChessKit.board(position), draw,
  });
}

function castlePairs(draw: ChessDraw): LearnExercise | null {
  return ChessKit.pairs({
    id: 'u5.castlePairs', prompt: 'Ordne die Schreibweisen zu.', draw,
    from: [
      { key: 'u5.pair.short', front: 'O-O', back: 'kurze Rochade' },
      { key: 'u5.pair.long', front: 'O-O-O', back: 'lange Rochade' },
      { key: 'u5.pair.whiteShort', front: 'Weiß kurz', back: 'König g1, Turm f1' },
      { key: 'u5.pair.whiteLong', front: 'Weiß lang', back: 'König c1, Turm d1' },
    ],
  });
}

// When castling is not allowed

function story(sample: ChessSample, color: ChessColor, side: ChessCastleSide): string {
  const rank = homeRank(color) + 1;
  switch (sample.theme) {
    case 'kingMoved': return `Der ${adjectiveStem(color)}e König hat früher schon einmal gezogen und steht wieder auf e${rank}.`;
    case 'rookMoved': return `Der Turm auf ${side === 'kingside' ? 'h' : 'a'}${rank} hat früher schon einmal gezogen und steht wieder dort.`;
    case 'otherRook': return `Der Turm auf ${side === 'kingside' ? 'a' : 'h'}${rank} hat früher schon einmal gezogen.`;
    default: return 'König und Türme haben sich noch nie bewegt.';
  }
}

function castleCan(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(castling, 'u5.castleCan');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const side = castleSide(sample);
  const color = position.sideToMove;
  const way = kingWay(side, color);
  const allowed = ChessGoals.accepted(moves({ castling: side }), position).length > 0;
  const rank = homeRank(color) + 1;
  let explanation: string;
  switch (sample.theme) {
    case 'between': explanation = 'Zwischen König und Turm steht noch eine Figur. Es muss alles frei sein.'; break;
    case 'check': explanation = 'Der König steht im Schach. Aus dem Schach heraus darf man nicht rochieren.'; break;
    case 'cross': explanation = `Der König müsste über ${Sq.name(way.cross)} ziehen, und dieses Feld greift der Gegner an.`; break;
    case 'land': explanation = `Auf dem Zielfeld ${Sq.name(way.land)} stünde der König im Schach.`; break;
    case 'kingMoved': explanation = 'Hat sich der König einmal bewegt, gibt es die Rochade für den Rest der Partie nicht mehr, auch wenn er zurückkehrt.'; break;
    case 'rookMoved': explanation = 'Mit einem Turm, der sich schon bewegt hat, gibt es keine Rochade mehr.'; break;
    case 'otherRook': explanation = `Die ${sideGerman(side)} Rochade braucht nur den König und den Turm auf ${side === 'kingside' ? 'h' : 'a'}${rank}. Der andere Turm ist egal.`; break;
    case 'b1': explanation = `Es zählen nur die Felder des Königs. Dass das Feld b${rank} angegriffen wird, stört nicht.`; break;
    case 'rookAttacked': explanation = 'Der Turm darf angegriffen sein. Nur die Felder, die der König betritt, müssen sicher sein.'; break;
    default: explanation = 'Alles ist frei, der König steht nicht im Schach und zieht weder über noch auf ein angegriffenes Feld: Die Rochade ist erlaubt.';
  }
  return ChessKit.yesNo({
    id: `u5.castleCan.${sample.id}`, prompt: `${story(sample, color, side)} Darf ${colorName(color)} jetzt ${sideWord(side)} rochieren?`,
    answer: allowed, explanation, media: ChessKit.board(position), draw,
  });
}

const reasonTexts: Partial<Record<ChessCastlingProblem, string>> = {
  piecesBetween: 'Zwischen König und Turm steht eine Figur.',
  inCheck: 'Der König steht im Schach.',
  crossesAttackedSquare: 'Der König müsste über ein angegriffenes Feld ziehen.',
  landsOnAttackedSquare: 'Das Zielfeld des Königs wird angegriffen.',
};

/** Reasons that never apply: the rook may be attacked, and the prompt says the king has not moved. */
const falseReasons = ['Der Turm wird angegriffen.', 'Der König hat sich schon bewegt.'];

function castleReason(draw: ChessDraw): LearnExercise | null {
  const pool = castling.filter((s) => {
    const position = samplePosition(s);
    if (!hasExpected(s, 'nein') || !position) return false;
    const problems = ChessCastling.problems(castleSide(s), position);
    return problems.length === 1 && problems[0] !== 'rightLost';
  });
  const sample = draw.pickSample(pool, 'u5.castleReason');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const side = castleSide(sample);
  const problems = ChessCastling.problems(side, position);
  const only = problems[0];
  const right = only === undefined ? undefined : reasonTexts[only];
  if (only === undefined || right === undefined) return null;
  const absent = [...(Object.entries(reasonTexts) as Array<[ChessCastlingProblem, string]>).filter(([k]) => !problems.includes(k)).map(([, v]) => v).sort(), ...falseReasons];
  const color = position.sideToMove;
  const way = kingWay(side, color);
  let detail = '';
  if (only === 'crossesAttackedSquare') detail = ` Das Feld ${Sq.name(way.cross)} greift der Gegner an.`;
  else if (only === 'landsOnAttackedSquare') detail = ` Das Feld ${Sq.name(way.land)} greift der Gegner an.`;
  return ChessKit.choice({
    id: `u5.castleReason.${sample.id}`,
    prompt: `König und Türme haben sich noch nie bewegt. Warum darf ${colorName(color)} nicht ${sideWord(side)} rochieren?`, correct: right,
    wrong: draw.shuffled(absent), explanation: right + detail, media: ChessKit.board(position), draw,
  });
}

// Special moves recognised

function classify(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(classifySamples, 'u5.classify');
  const position = sample ? samplePosition(sample) : null;
  const move = sample ? detailMove(sample) : null;
  const mover = position && move ? position.at(move.from) : null;
  if (!sample || !position || !move || !mover || !position.isLegal(move)) return null;
  const names = ['Rochade', 'En passant', 'Bauernumwandlung', 'Doppelschritt'];
  let right: string;
  let explanation: string;
  if (position.isCastling(move)) {
    right = names[0];
    explanation = 'Der König zieht zwei Felder, und der Turm zieht mit: Das ist die Rochade.';
  } else if (position.isEnPassant(move)) {
    right = names[1];
    explanation = 'Der Bauer schlägt schräg auf ein leeres Feld und nimmt den Bauern daneben vom Brett: en passant.';
  } else if (move.promotion !== undefined) {
    right = names[2];
    explanation = 'Der Bauer erreicht die letzte Reihe und wird zu einer anderen Figur: Bauernumwandlung.';
  } else if (mover.kind === 'pawn' && Math.abs(Sq.rank(move.to) - Sq.rank(move.from)) === 2) {
    right = names[3];
    explanation = 'Der Bauer zieht aus der Ausgangsstellung zwei Felder: Doppelschritt.';
  } else {
    return null;
  }
  return ChessKit.choice({
    id: `u5.classify.${sample.id}`,
    prompt: `${colorName(position.sideToMove)} zieht ${ChessKit.accusative(mover.kind)} von ${Sq.name(move.from)} nach ${Sq.name(move.to)}. Wie heißt dieser Zug?`,
    correct: right, wrong: names.filter((n) => n !== right), explanation,
    media: ChessKit.board(position, [Sq.name(move.from), Sq.name(move.to)]), draw,
  });
}

/** A promotion to a queen that gives check. */
function promoCheck(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(promotions.filter((s) => ['step', 'capture'].includes(s.theme)), 'u5.promoCheck');
  const position = sample ? samplePosition(sample) : null;
  const focus = sample ? focusSquare(sample) : null;
  if (!sample || !position || focus === null) return null;
  return ChessKit.moveExercise({
    id: `u5.promoCheck.${sample.id}`, prompt: 'Wandle den Bauern in eine Dame um und gib damit Schach.', position,
    goal: moves({ from: focus, promotionTo: 'queen', check: true }),
    explanation: 'Die neue Dame steht auf der letzten Reihe und greift den gegnerischen König auf derselben Reihe an.',
  });
}

function promoPiece(draw: ChessDraw): LearnExercise | null {
  const shown = draw.shuffled(['queen', 'rook', 'bishop', 'knight'] as const).slice(0, 3).map(kindName);
  return ChessKit.choice({
    id: 'u5.promoPiece', prompt: 'Welche Figur kann ein Bauer bei der Umwandlung nicht werden?', correct: kindName('king'),
    wrong: shown, explanation: 'Erlaubt sind Dame, Turm, Läufer und Springer. Zum König wird ein Bauer nie.', draw,
  });
}
