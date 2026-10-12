// Unit 5, "Sonderzüge": castling and when it is not allowed, en passant and promotion in detail.
// Port of ChessUnit5.swift.

import type { LearnExercise } from '../../exercise';
import { shuffled } from '../../random';
import { castleSideGermanName, castlingProblems, type ChessCastleSide, type ChessCastlingProblem } from '../analysis';
import { acceptedMoves } from '../goals';
import { accusative } from '../kit';
import { ChessPosition } from '../position';
import {
  ALL_PIECE_KINDS, BISHOP, CHESS_COLORS, KING, KNIGHT, PAWN, QUEEN, ROOK, colorAdjectiveStem, colorGermanName, homeRank, kindGermanName,
  piece, piecesEqual, square as squareAt, squareName, squareRank, type ChessColor, type ChessSquare,
} from '../types';
import {
  boardMedia, choice, moveExercise, pairs, sentence, sentenceMaker, statement, statementMaker, yesNo, type ChessDraw, type ChessMaker,
} from './courseKit';
import { castling, classify, promotions, sampleDetailMove, sampleFocus, samplePosition, type ChessSample } from './samples';
import { epYesNo } from './unit3';

export const unit5Review = ['u5.castleMove', 'u5.castleCan', 'u5.classify', 'u5.epYesNo', 'u5.castleReason'];

const castleSentences = [
  sentence('king', ['Bei', 'der', 'Rochade', 'zieht', 'der', 'König', 'zwei', 'Felder', 'zum', 'Turm.'], ['drei', 'ein']),
  sentence('both', ['Die', 'Rochade', 'ist', 'ein', 'Zug', 'mit', 'König', 'und', 'Turm.'], ['Dame', 'zwei']),
];

const castleRules = [
  statement(
    'check', 'Welcher Satz über die Rochade stimmt?', 'Der König darf dabei nicht im Schach stehen.',
    ['Der Turm darf dabei nicht angegriffen sein.', 'Zwischen König und Turm darf eine Figur stehen.', 'Die Rochade ist auch erlaubt, wenn der König schon gezogen hat.'],
    'Aus dem Schach heraus rochiert man nicht. Der Turm darf angegriffen sein, und zwischen beiden muss alles frei sein.',
  ),
  statement(
    'path', 'Welcher Satz über die Rochade stimmt?', 'Der König darf nicht über ein angegriffenes Feld ziehen.',
    ['Die lange Rochade ist verboten, wenn das Feld b1 angegriffen wird.', 'Die Rochade ist verboten, wenn der Turm angegriffen wird.', 'Mit einem Turm, der schon gezogen hat und zurückgekehrt ist, darf man rochieren.'],
    'Es zählen nur die Felder, über die der König zieht, und das Feld, auf dem er landet. Der Turm und das Feld b1 spielen keine Rolle.',
  ),
  statement(
    'count', 'Welcher Satz über die Rochade stimmt?', 'Die Rochade zählt als ein Zug.',
    ['Die Rochade zählt als zwei Züge.', 'Mit der Rochade darf man eine Figur schlagen.', 'Nach der Rochade darf man gleich noch einmal ziehen.'],
    'König und Turm ziehen zusammen in einem einzigen Zug, und dabei wird nichts geschlagen.',
  ),
  statement(
    'rook', 'Welcher Satz über die Rochade stimmt?', 'Hat sich ein Turm schon bewegt, geht die Rochade mit diesem Turm nicht mehr.',
    ['Die Rochade bleibt erlaubt, wenn der Turm auf sein Feld zurückkehrt.', 'Dann geht die Rochade auch mit dem anderen Turm nicht mehr.', 'Nur der König muss sich noch nie bewegt haben.'],
    'Der König und der Turm, mit dem man rochiert, dürfen sich noch nie bewegt haben. Der andere Turm ist davon nicht betroffen.',
  ),
];

const epRules = [
  statement(
    'moment', 'Welcher Satz über en passant stimmt?', 'En passant ist nur im Zug direkt nach dem Doppelschritt erlaubt.',
    ['En passant ist jederzeit erlaubt, solange die Bauern nebeneinander stehen.', 'Auch ein Springer darf en passant schlagen.', 'En passant schlägt man einen Bauern, der nur ein Feld gezogen ist.'],
    'Nur ein Bauer schlägt en passant, nur einen Bauern, der gerade zwei Felder gezogen ist, und nur sofort.',
  ),
  statement(
    'landing', 'Welcher Satz über en passant stimmt?', 'Der schlagende Bauer landet auf dem Feld, das der gegnerische Bauer übersprungen hat.',
    ['Der schlagende Bauer landet auf dem Feld des gegnerischen Bauern.', 'Der schlagende Bauer bleibt auf seinem Feld.', 'Der schlagende Bauer landet zwei Felder weiter.'],
    'Man schlägt, als wäre der gegnerische Bauer nur ein Feld gezogen. Der Bauer geht also auf das übersprungene Feld.',
  ),
];

const promoRules = [
  statement(
    'must', 'Welcher Satz über die Umwandlung stimmt?', 'Ein Bauer auf der letzten Reihe muss sich umwandeln.',
    ['Ein Bauer darf auf der letzten Reihe bleiben.', 'Ein Bauer darf sich nur in eine schon geschlagene Figur umwandeln.', 'Ein Bauer darf sich auch in einen König umwandeln.'],
    'Der Bauer wird im selben Zug zu Dame, Turm, Läufer oder Springer, ganz gleich, welche Figuren schon geschlagen wurden.',
  ),
  statement(
    'queens', 'Welcher Satz über die Umwandlung stimmt?', 'Man darf mehrere Damen gleichzeitig haben.',
    ['Man darf höchstens eine Dame haben.', 'Eine zweite Dame gibt es nur, wenn die erste geschlagen wurde.', 'Ein Bauer wird auf der letzten Reihe immer zu einer Dame.'],
    'Die Wahl ist nicht auf geschlagene Figuren beschränkt. Auch eine zweite oder dritte Dame ist erlaubt.',
  ),
];

const castleSide = (sample: ChessSample): ChessCastleSide => (sample.detail === 'kurz' ? 'kingside' : 'queenside');
const sideWord = (side: ChessCastleSide): string => (side === 'kingside' ? 'kurz' : 'lang');

const expectedIs = (sample: ChessSample, word: string): boolean => sample.expected.length === 1 && sample.expected[0] === word;

/** The squares of the king's way: the one it crosses and the one it lands on. */
function kingWay(side: ChessCastleSide, color: ChessColor): { cross: ChessSquare; land: ChessSquare } {
  const rank = homeRank(color);
  return { cross: squareAt(side === 'kingside' ? 5 : 3, rank)!, land: squareAt(side === 'kingside' ? 6 : 2, rank)! };
}

function castleMove(draw: ChessDraw): LearnExercise | null {
  const pool = castling.filter((s) => expectedIs(s, 'ja'));
  const sample = draw.pickSample(pool, 'u5.castleMove');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const side = castleSide(sample);
  const way = kingWay(side, position.sideToMove);
  return moveExercise({
    id: `u5.castleMove.${sample.id}`, prompt: `Rochiere ${sideWord(side)}.`, position,
    goal: { type: 'moves', filter: { castling: side } },
    explanation: `Der König zieht zwei Felder zum Turm hin, nach ${squareName(way.land)}. Der Turm springt auf die andere Seite des Königs, nach ${squareName(way.cross)}. Du führst den Zug mit dem König aus.`,
  });
}

function castleSquares(draw: ChessDraw): LearnExercise | null {
  interface Case { color: ChessColor; side: ChessCastleSide; king: boolean }
  const cases: Case[] = [];
  for (const color of CHESS_COLORS) {
    for (const side of ['kingside', 'queenside'] as ChessCastleSide[]) {
      for (const king of [true, false]) cases.push({ color, side, king });
    }
  }
  const item = draw.pick(cases, 'u5.castleSquares', (c) => `${colorAdjectiveStem(c.color)}.${sideWord(c.side)}.${c.king}`);
  if (!item) return null;
  const fen = item.color === 'white' ? 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' : 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1';
  const position = ChessPosition.fromFen(fen);
  if (!position) return null;
  const rank = homeRank(item.color);
  const kingFrom = squareAt(4, rank)!;
  const rookFrom = squareAt(item.side === 'kingside' ? 7 : 0, rank)!;
  const way = kingWay(item.side, item.color);
  // The king lands on the far square of its way, the rook on the near one.
  const right = item.king ? way.land : way.cross;
  const other = item.king ? way.cross : way.land;
  const subject = item.king ? 'der König' : 'der Turm';
  const castle = acceptedMoves({ type: 'moves', filter: { castling: item.side } }, position)[0];
  if (castle === undefined) return null;
  const after = position.applying(castle);
  if (!piecesEqual(after.pieceAt(right), piece(item.color, item.king ? KING : ROOK))) return null;
  return choice(
    {
      id: `u5.castleSquares.${colorAdjectiveStem(item.color)}.${sideWord(item.side)}.${item.king ? 'king' : 'rook'}`,
      prompt: `Auf welchem Feld steht ${subject} nach der ${castleSideGermanName(item.side)}n Rochade von ${colorGermanName(item.color)}?`,
      correct: squareName(right), wrong: [squareName(rookFrom), squareName(kingFrom), squareName(other)],
      explanation: `Der König zieht zwei Felder zum Turm hin und steht auf ${squareName(way.land)}. Der Turm springt über ihn hinweg auf ${squareName(way.cross)}.`,
      media: boardMedia(position),
    },
    draw,
  );
}

function castlePairs(draw: ChessDraw): LearnExercise | null {
  return pairs(
    {
      id: 'u5.castlePairs', prompt: 'Ordne die Schreibweisen zu.',
      from: [
        { key: 'u5.pair.short', front: 'O-O', back: 'kurze Rochade' },
        { key: 'u5.pair.long', front: 'O-O-O', back: 'lange Rochade' },
        { key: 'u5.pair.whiteShort', front: 'Weiß kurz', back: 'König g1, Turm f1' },
        { key: 'u5.pair.whiteLong', front: 'Weiß lang', back: 'König c1, Turm d1' },
      ],
    },
    draw,
  );
}

// When castling is not allowed

function story(sample: ChessSample, color: ChessColor, side: ChessCastleSide): string {
  const rank = homeRank(color) + 1;
  switch (sample.theme) {
    case 'kingMoved': return `Der ${colorAdjectiveStem(color)}e König hat früher schon einmal gezogen und steht wieder auf e${rank}.`;
    case 'rookMoved': return `Der Turm auf ${side === 'kingside' ? 'h' : 'a'}${rank} hat früher schon einmal gezogen und steht wieder dort.`;
    case 'otherRook': return `Der Turm auf ${side === 'kingside' ? 'a' : 'h'}${rank} hat früher schon einmal gezogen.`;
    default: return 'König und Türme haben sich noch nie bewegt.';
  }
}

function castleCan(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(castling, 'u5.castleCan');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const side = castleSide(sample);
  const color = position.sideToMove;
  const way = kingWay(side, color);
  const allowed = acceptedMoves({ type: 'moves', filter: { castling: side } }, position).length > 0;
  const rank = homeRank(color) + 1;
  let explanation: string;
  switch (sample.theme) {
    case 'between': explanation = 'Zwischen König und Turm steht noch eine Figur. Es muss alles frei sein.'; break;
    case 'check': explanation = 'Der König steht im Schach. Aus dem Schach heraus darf man nicht rochieren.'; break;
    case 'cross': explanation = `Der König müsste über ${squareName(way.cross)} ziehen, und dieses Feld greift der Gegner an.`; break;
    case 'land': explanation = `Auf dem Zielfeld ${squareName(way.land)} stünde der König im Schach.`; break;
    case 'kingMoved': explanation = 'Hat sich der König einmal bewegt, gibt es die Rochade für den Rest der Partie nicht mehr, auch wenn er zurückkehrt.'; break;
    case 'rookMoved': explanation = 'Mit einem Turm, der sich schon bewegt hat, gibt es keine Rochade mehr.'; break;
    case 'otherRook': explanation = `Die ${castleSideGermanName(side)} Rochade braucht nur den König und den Turm auf ${side === 'kingside' ? 'h' : 'a'}${rank}. Der andere Turm ist egal.`; break;
    case 'b1': explanation = `Es zählen nur die Felder des Königs. Dass das Feld b${rank} angegriffen wird, stört nicht.`; break;
    case 'rookAttacked': explanation = 'Der Turm darf angegriffen sein. Nur die Felder, die der König betritt, müssen sicher sein.'; break;
    default: explanation = 'Alles ist frei, der König steht nicht im Schach und zieht weder über noch auf ein angegriffenes Feld: Die Rochade ist erlaubt.';
  }
  return yesNo(
    {
      id: `u5.castleCan.${sample.id}`, prompt: `${story(sample, color, side)} Darf ${colorGermanName(color)} jetzt ${sideWord(side)} rochieren?`,
      answer: allowed, explanation, media: boardMedia(position),
    },
    draw,
  );
}

const reasonTexts: [ChessCastlingProblem, string][] = [
  ['piecesBetween', 'Zwischen König und Turm steht eine Figur.'],
  ['inCheck', 'Der König steht im Schach.'],
  ['crossesAttackedSquare', 'Der König müsste über ein angegriffenes Feld ziehen.'],
  ['landsOnAttackedSquare', 'Das Zielfeld des Königs wird angegriffen.'],
];

/** Reasons that never apply: the rook may be attacked, and the prompt says the king has not moved. */
const falseReasons = ['Der Turm wird angegriffen.', 'Der König hat sich schon bewegt.'];

function castleReason(draw: ChessDraw): LearnExercise | null {
  const pool = castling.filter((sample) => {
    const position = samplePosition(sample);
    if (!expectedIs(sample, 'nein') || !position) return false;
    const problems = castlingProblems(castleSide(sample), position);
    return problems.length === 1 && problems[0] !== 'rightLost';
  });
  const sample = draw.pickSample(pool, 'u5.castleReason');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const side = castleSide(sample);
  const problems = castlingProblems(side, position);
  const only = problems[0];
  const right = reasonTexts.find(([problem]) => problem === only)?.[1];
  if (only === undefined || right === undefined) return null;
  const absent = reasonTexts.filter(([problem]) => !problems.includes(problem)).map(([, text]) => text).sort().concat(falseReasons);
  const color = position.sideToMove;
  const way = kingWay(side, color);
  let detail: string;
  switch (only) {
    case 'crossesAttackedSquare': detail = ` Das Feld ${squareName(way.cross)} greift der Gegner an.`; break;
    case 'landsOnAttackedSquare': detail = ` Das Feld ${squareName(way.land)} greift der Gegner an.`; break;
    default: detail = '';
  }
  return choice(
    {
      id: `u5.castleReason.${sample.id}`,
      prompt: `König und Türme haben sich noch nie bewegt. Warum darf ${colorGermanName(color)} nicht ${sideWord(side)} rochieren?`, correct: right,
      wrong: shuffled(absent, draw.random), explanation: right + detail, media: boardMedia(position),
    },
    draw,
  );
}

// Special moves recognised

function classifyMaker(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(classify, 'u5.classify');
  if (!sample) return null;
  const position = samplePosition(sample);
  const m = sampleDetailMove(sample);
  if (!position || !m || !position.isLegal(m)) return null;
  const p = position.pieceAt(m.from);
  if (!p) return null;
  const names = ['Rochade', 'En passant', 'Bauernumwandlung', 'Doppelschritt'];
  let right: string;
  let explanation: string;
  if (position.isCastling(m)) {
    right = names[0];
    explanation = 'Der König zieht zwei Felder, und der Turm zieht mit: Das ist die Rochade.';
  } else if (position.isEnPassant(m)) {
    right = names[1];
    explanation = 'Der Bauer schlägt schräg auf ein leeres Feld und nimmt den Bauern daneben vom Brett: en passant.';
  } else if (m.promotion !== undefined) {
    right = names[2];
    explanation = 'Der Bauer erreicht die letzte Reihe und wird zu einer anderen Figur: Bauernumwandlung.';
  } else if (p.kind === PAWN && Math.abs(squareRank(m.to) - squareRank(m.from)) === 2) {
    right = names[3];
    explanation = 'Der Bauer zieht aus der Ausgangsstellung zwei Felder: Doppelschritt.';
  } else {
    return null;
  }
  return choice(
    {
      id: `u5.classify.${sample.id}`,
      prompt: `${colorGermanName(position.sideToMove)} zieht ${accusative(p.kind)} von ${squareName(m.from)} nach ${squareName(m.to)}. Wie heißt dieser Zug?`,
      correct: right, wrong: names.filter((n) => n !== right), explanation,
      media: boardMedia(position, [squareName(m.from), squareName(m.to)]),
    },
    draw,
  );
}

/** A promotion to a queen that gives check. */
function promoCheck(draw: ChessDraw): LearnExercise | null {
  const pool = promotions.filter((s) => ['step', 'capture'].includes(s.theme));
  const sample = draw.pickSample(pool, 'u5.promoCheck');
  if (!sample) return null;
  const position = samplePosition(sample);
  const focus = sampleFocus(sample);
  if (!position || focus === null) return null;
  return moveExercise({
    id: `u5.promoCheck.${sample.id}`, prompt: 'Wandle den Bauern in eine Dame um und gib damit Schach.', position,
    goal: { type: 'moves', filter: { from: focus, promotionTo: QUEEN, check: true } },
    explanation: 'Die neue Dame steht auf der letzten Reihe und greift den gegnerischen König auf derselben Reihe an.',
  });
}

function promoPiece(draw: ChessDraw): LearnExercise | null {
  const allowed = ALL_PIECE_KINDS.filter((k) => [QUEEN, ROOK, BISHOP, KNIGHT].includes(k));
  const shown = shuffled(allowed, draw.random).slice(0, 3).map(kindGermanName);
  return choice(
    {
      id: 'u5.promoPiece', prompt: 'Welche Figur kann ein Bauer bei der Umwandlung nicht werden?', correct: kindGermanName(KING), wrong: shown,
      explanation: 'Erlaubt sind Dame, Turm, Läufer und Springer. Zum König wird ein Bauer nie.',
    },
    draw,
  );
}

export const unit5Makers: Record<string, ChessMaker> = {
  'u5.castleMove': castleMove,
  'u5.castleSquares': castleSquares,
  'u5.castlePairs': castlePairs,
  'u5.sentence.castle': sentenceMaker('u5.sentence.castle', castleSentences),
  'u5.castleCan': castleCan,
  'u5.castleReason': castleReason,
  'u5.castleRules': statementMaker('u5.castleRules', castleRules),
  'u5.classify': classifyMaker,
  'u5.epYesNo': epYesNo('u5.epYesNo', new Set(['available', 'late', 'single', 'pinned'])),
  'u5.epRules': statementMaker('u5.epRules', epRules),
  'u5.promoCheck': promoCheck,
  'u5.promoPiece': promoPiece,
  'u5.promoRules': statementMaker('u5.promoRules', promoRules),
};
