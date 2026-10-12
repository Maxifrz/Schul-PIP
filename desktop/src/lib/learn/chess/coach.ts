// Says why a move on the board does not solve the exercise, from the position alone. Port of ChessCoach
// (ChessSkills.swift): whether the move is allowed at all, and, if it is, what it does not do.

import { san } from './notation';
import type { ChessGoal } from './goals';
import { ChessGeometry, nominative, ruleOf } from './kit';
import type { ChessPosition } from './position';
import {
  PAWN,
  QUEEN,
  colorAdjectiveStem,
  colorGermanName,
  moveFromUci,
  oppositeColor,
  squareName,
  type ChessMove,
  type ChessPiece,
} from './types';

export const COACH_PREFIX = 'chess:';

/** The two hints of a move exercise: first what to look for, then which piece it is, when all answers agree. */
export function coachHints(goal: ChessGoal, accepted: readonly ChessMove[], position: ChessPosition): string[] {
  const hints: string[] = [];
  switch (goal.type) {
    case 'moves': {
      const filter = goal.filter;
      if (filter.castling != null) {
        hints.push('Bei der Rochade ziehen König und Turm in einem Zug.');
      } else if (filter.enPassant === true) {
        hints.push('En passant gibt es nur direkt nach dem Doppelschritt eines Bauern, und man schlägt ihn im Vorbeigehen.');
      } else if (filter.promotion === true) {
        hints.push('Ein Bauer auf der letzten Reihe wird umgewandelt, meist in eine Dame.');
      } else if (filter.kind != null) {
        hints.push(ruleOf(filter.kind));
      } else {
        hints.push('Lies die Aufgabe noch einmal: Welche Figur soll wohin ziehen?');
      }
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
    hints.push(`Es zieht die Figur auf ${squareName([...origins][0])}.`);
  } else {
    const kinds = new Set<number>();
    for (const m of accepted) {
      const p = position.pieceAt(m.from);
      if (p) kinds.add(p.kind);
    }
    if (kinds.size === 1) hints.push(`Es zieht ${nominative([...kinds][0] as ChessPiece['kind'])}.`);
  }
  return hints;
}

/** Why a move that the rules do not allow is not allowed. */
function illegal(m: ChessMove, p: ChessPiece, position: ChessPosition): string {
  const name = nominative(p.kind);
  const pseudo = position.pseudoLegalMoves().some((c) => c.from === m.from && c.to === m.to);
  if (pseudo) {
    return position.isCheck
      ? 'Du stehst im Schach. Dieser Zug beendet das Schach nicht.'
      : 'Nach diesem Zug stünde dein König im Schach. Das ist nicht erlaubt.';
  }
  const target = position.pieceAt(m.to);
  if (target && target.color === p.color) return `Auf ${squareName(m.to)} steht schon eine eigene Figur.`;
  if (p.kind !== PAWN && ChessGeometry.canReach(p.kind, m.from, m.to)) {
    return `Der Weg von ${squareName(m.from)} nach ${squareName(m.to)} ist versperrt.`;
  }
  const capitalised = name.charAt(0).toUpperCase() + name.slice(1);
  return `${capitalised} kann nicht von ${squareName(m.from)} nach ${squareName(m.to)} ziehen. ${ruleOf(p.kind)}`;
}

/** The feedback for a coordinate move `text` against the goal code of the exercise; null when there is nothing to say. */
export function coachExplain(text: string, goal: string, position: ChessPosition): string | null {
  const parsed = moveFromUci(text);
  if (parsed === null) return null;
  const side = position.sideToMove;
  const p = position.pieceAt(parsed.from);
  if (p === null) return `Auf ${squareName(parsed.from)} steht keine Figur.`;
  if (p.color !== side) {
    return `Auf ${squareName(parsed.from)} steht eine ${colorAdjectiveStem(p.color)}e Figur, aber ${colorGermanName(side)} ist am Zug.`;
  }
  const legal = position.legalMoves().filter((m) => m.from === parsed.from && m.to === parsed.to);
  const found = legal.find((m) => m.promotion === QUEEN) ?? legal[0];
  if (found === undefined) return illegal(parsed, p, position);
  const after = position.applying(found);
  const opponent = oppositeColor(side);
  switch (goal) {
    case 'mate': {
      if (!after.isCheck) {
        return 'Der Zug ist erlaubt, bietet aber kein Schach. Matt setzt, wer Schach bietet und dem König keine Antwort lässt.';
      }
      const reply = after.legalMoves()[0];
      const replyText = reply === undefined ? null : san(reply, after);
      if (replyText !== null) {
        return `Der Zug bietet Schach, aber ${colorGermanName(opponent)} kann sich verteidigen, zum Beispiel mit ${replyText}.`;
      }
      return null;
    }
    case 'capture':
      if (!position.isCapture(found)) {
        return 'Der Zug ist erlaubt, schlägt aber nichts. Gesucht ist der Schlag, der am meisten Material gewinnt.';
      }
      if (after.legalMoves().some((m) => m.to === found.to)) {
        return `Die Figur auf ${squareName(found.to)} ist gedeckt: ${colorGermanName(opponent)} kann zurückschlagen. Ein anderer Schlag gewinnt mehr.`;
      }
      return 'Das gewinnt Material, aber ein anderer Schlag gewinnt mehr.';
    case 'best':
      if (after.legalMoves().some((m) => m.to === found.to)) {
        return `Der Zug ist erlaubt, aber ${colorGermanName(opponent)} kann die Figur auf ${squareName(found.to)} schlagen. Es gibt einen stärkeren Zug.`;
      }
      return 'Der Zug ist erlaubt, aber es gibt einen stärkeren.';
    case 'escape.king':
      return 'Der Zug beendet das Schach, aber nicht mit dem König. Hier ist der Königszug gesucht.';
    case 'escape.capture':
      return 'Der Zug beendet das Schach, schlägt aber nicht die schachbietende Figur. Hier ist das Schlagen gesucht.';
    case 'escape.block':
      return 'Der Zug beendet das Schach, stellt aber keine Figur dazwischen. Hier ist das Dazwischenstellen gesucht.';
    default:
      return 'Der Zug ist erlaubt, aber er ist nicht der, nach dem gefragt ist.';
  }
}

