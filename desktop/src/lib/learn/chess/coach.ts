import { ChessGoal } from './goals';
import { ChessGeometry, ChessKit } from './kit';
import { ChessNotation } from './notation';
import { ChessPosition } from './position';
import { ChessMove, ChessPiece, Sq, adjectiveStem, colorName, moveFromUci, opposite } from './types';

/** The goal as the exercise carries it for the coach. */
export function coachCode(goal: ChessGoal): string {
  switch (goal.k) {
    case 'moves': return 'moves';
    case 'mateInOne': return 'mate';
    case 'escape':
      switch (goal.kind) {
        case 'any': return 'escape.any';
        case 'kingMoves': return 'escape.king';
        case 'captureChecker': return 'escape.capture';
        case 'interpose': return 'escape.block';
      }
      return 'escape.any';
    case 'bestCapture': return 'capture';
    case 'bestMove': return 'best';
  }
}

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Says why a move on the board does not solve the exercise, from the position alone: whether the move is allowed at all, and, if it is, what it does not do. Nothing here claims more than the engine can show. */
export const ChessCoach = {
  prefix: 'chess:',

  coachCode,

  /** The two hints of a move exercise: first what to look for, then which piece it is, when all answers agree. */
  hints(goal: ChessGoal, accepted: ChessMove[], position: ChessPosition): string[] {
    const hints: string[] = [];
    switch (goal.k) {
      case 'moves': {
        const f = goal.filter;
        if (f.castling !== undefined) hints.push('Bei der Rochade ziehen König und Turm in einem Zug.');
        else if (f.enPassant === true) hints.push('En passant gibt es nur direkt nach dem Doppelschritt eines Bauern, und man schlägt ihn im Vorbeigehen.');
        else if (f.promotion === true) hints.push('Ein Bauer auf der letzten Reihe wird umgewandelt, meist in eine Dame.');
        else if (f.kind !== undefined) hints.push(ChessKit.rule(f.kind));
        else hints.push('Lies die Aufgabe noch einmal: Welche Figur soll wohin ziehen?');
        break;
      }
      case 'mateInOne':
        hints.push('Suche Züge, die Schach bieten, und prüfe, ob der König danach noch ein Feld oder eine Antwort hat.');
        break;
      case 'escape':
        hints.push('Es gibt drei Wege aus dem Schach: den König wegziehen, die schachbietende Figur schlagen oder eine Figur dazwischenstellen.');
        break;
      case 'bestCapture':
        hints.push('Vergleiche, welche Figur du schlagen kannst, was sie wert ist und ob sie gedeckt ist.');
        break;
      case 'bestMove':
        hints.push('Suche nach einer Gabel, einer Fesselung, einem Spieß oder einer Figur, die niemand deckt.');
        break;
    }
    const origins = new Set(accepted.map((m) => m.from));
    if (origins.size === 1) {
      hints.push(`Es zieht die Figur auf ${Sq.name([...origins][0])}.`);
    } else {
      const kinds = new Set(accepted.map((m) => position.at(m.from)?.kind).filter((k) => k !== undefined));
      if (kinds.size === 1) hints.push(`Es zieht ${ChessKit.nominative([...kinds][0]!)}.`);
    }
    return hints;
  },

  explain(text: string, goal: string, position: ChessPosition): string | null {
    const parsed = moveFromUci(text);
    if (!parsed) return null;
    const side = position.sideToMove;
    const piece = position.at(parsed.from);
    if (!piece) return `Auf ${Sq.name(parsed.from)} steht keine Figur.`;
    if (piece.color !== side) {
      return `Auf ${Sq.name(parsed.from)} steht eine ${adjectiveStem(piece.color)}e Figur, aber ${colorName(side)} ist am Zug.`;
    }
    const legal = position.legalMoves().filter((m) => m.from === parsed.from && m.to === parsed.to);
    const move = legal.find((m) => m.promotion === 'queen') ?? legal[0];
    if (!move) return illegal(parsed, piece, position);
    const after = position.applying(move);
    const opponent = colorName(opposite(side));
    switch (goal) {
      case 'mate': {
        if (!after.isCheck) return 'Der Zug ist erlaubt, bietet aber kein Schach. Matt setzt, wer Schach bietet und dem König keine Antwort lässt.';
        const reply = after.legalMoves()[0];
        const san = reply ? ChessNotation.san(reply, after) : null;
        if (san) return `Der Zug bietet Schach, aber ${opponent} kann sich verteidigen, zum Beispiel mit ${san}.`;
        return null;
      }
      case 'capture':
        if (!position.isCapture(move)) return 'Der Zug ist erlaubt, schlägt aber nichts. Gesucht ist der Schlag, der am meisten Material gewinnt.';
        if (after.legalMoves().some((m) => m.to === move.to)) {
          return `Die Figur auf ${Sq.name(move.to)} ist gedeckt: ${opponent} kann zurückschlagen. Ein anderer Schlag gewinnt mehr.`;
        }
        return 'Das gewinnt Material, aber ein anderer Schlag gewinnt mehr.';
      case 'best':
        if (after.legalMoves().some((m) => m.to === move.to)) {
          return `Der Zug ist erlaubt, aber ${opponent} kann die Figur auf ${Sq.name(move.to)} schlagen. Es gibt einen stärkeren Zug.`;
        }
        return 'Der Zug ist erlaubt, aber es gibt einen stärkeren.';
      case 'escape.king': return 'Der Zug beendet das Schach, aber nicht mit dem König. Hier ist der Königszug gesucht.';
      case 'escape.capture': return 'Der Zug beendet das Schach, schlägt aber nicht die schachbietende Figur. Hier ist das Schlagen gesucht.';
      case 'escape.block': return 'Der Zug beendet das Schach, stellt aber keine Figur dazwischen. Hier ist das Dazwischenstellen gesucht.';
      default: return 'Der Zug ist erlaubt, aber er ist nicht der, nach dem gefragt ist.';
    }
  },
};

/** Why a move that the rules do not allow is not allowed. */
function illegal(move: ChessMove, piece: ChessPiece, position: ChessPosition): string {
  const name = ChessKit.nominative(piece.kind);
  const pseudo = position.pseudoLegalMoves().some((m) => m.from === move.from && m.to === move.to);
  if (pseudo) {
    return position.isCheck
      ? 'Du stehst im Schach. Dieser Zug beendet das Schach nicht.'
      : 'Nach diesem Zug stünde dein König im Schach. Das ist nicht erlaubt.';
  }
  const target = position.at(move.to);
  if (target && target.color === piece.color) return `Auf ${Sq.name(move.to)} steht schon eine eigene Figur.`;
  if (piece.kind !== 'pawn' && ChessGeometry.canReach(piece.kind, move.from, move.to)) {
    return `Der Weg von ${Sq.name(move.from)} nach ${Sq.name(move.to)} ist versperrt.`;
  }
  return `${capitalised(name)} kann nicht von ${Sq.name(move.from)} nach ${Sq.name(move.to)} ziehen. ${ChessKit.rule(piece.kind)}`;
}
