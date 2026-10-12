// The engine-only helpers of ChessKit.swift: German piece phrases, lists, rule sentences, geometry on an empty board,
// hidden attackers and move destinations. The exercise builders of ChessKit (boards, choices, pairs ...) belong to the
// course layer and are not here.

import type { ChessPosition } from './position';
import {
  BISHOP,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  ALL_SQUARES,
  CHESS_COLORS,
  kindArticle,
  kindGermanName,
  kindIsFeminine,
  kindNoun,
  squareFile,
  squareRank,
  type ChessPieceKind,
  type ChessSquare,
} from './types';

/** Where a piece could go on an empty board; independent of the move generator, so tests can compare the two. */
export const ChessGeometry = {
  canReach(kind: ChessPieceKind, from: ChessSquare, to: ChessSquare): boolean {
    if (from === to) return false;
    const files = Math.abs(squareFile(to) - squareFile(from));
    const ranks = Math.abs(squareRank(to) - squareRank(from));
    switch (kind) {
      case ROOK: return files === 0 || ranks === 0;
      case BISHOP: return files === ranks;
      case QUEEN: return files === 0 || ranks === 0 || files === ranks;
      case KING: return Math.max(files, ranks) === 1;
      case KNIGHT: return (files === 1 && ranks === 2) || (files === 2 && ranks === 1);
      case PAWN: return false;
      default: return false;
    }
  },

  /** The squares a piece reaches from a square on an empty board. */
  reach(kind: ChessPieceKind, from: ChessSquare): ChessSquare[] {
    return ALL_SQUARES.filter((target) => ChessGeometry.canReach(kind, from, target));
  },
};

export const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

/** "den Springer", "die Dame", "den Bauern". */
export function accusative(kind: ChessPieceKind): string {
  return `${kindArticle(kind, 'accusative')} ${kindNoun(kind, 'accusative')}`;
}
/** "der Springer", "die Dame". */
export function nominative(kind: ChessPieceKind): string {
  return `${kindArticle(kind, 'nominative')} ${kindNoun(kind, 'nominative')}`;
}
/** "dem Springer", "der Dame". */
export function dative(kind: ChessPieceKind): string {
  return `${kindArticle(kind, 'dative')} ${kindNoun(kind, 'dative')}`;
}
/** "einen Springer", "eine Dame", "einen Bauern". */
export function indefiniteAccusative(kind: ChessPieceKind): string {
  return kindIsFeminine(kind) ? `eine ${kindGermanName(kind)}` : `einen ${kindNoun(kind, 'accusative')}`;
}
/** "ein Springer", "eine Dame". */
export function indefinite(kind: ChessPieceKind): string {
  return `${kindIsFeminine(kind) ? 'eine' : 'ein'} ${kindGermanName(kind)}`;
}

/** A list in German: "a4", "a4 und g4", "a4, b5 und g4". */
export function list(items: readonly string[]): string {
  switch (items.length) {
    case 0: return '';
    case 1: return items[0];
    default: return items.slice(0, -1).join(', ') + ' und ' + items[items.length - 1];
  }
}

/** The rule sentence of a piece, for the feedback. */
export function ruleOf(kind: ChessPieceKind): string {
  switch (kind) {
    case ROOK: return 'Der Turm zieht gerade, so weit er will.';
    case BISHOP: return 'Der Läufer zieht schräg, so weit er will.';
    case QUEEN: return 'Die Dame zieht wie Turm und Läufer zusammen.';
    case KING: return 'Der König zieht ein Feld in jede Richtung.';
    case KNIGHT: return 'Der Springer springt zwei Felder in eine Richtung und eins quer dazu.';
    default: return 'Der Bauer zieht ein Feld vorwärts und schlägt schräg vorwärts.';
  }
}

/** Whether more pieces than the direct attackers aim at a square, hidden behind them on the same line. */
export function hasHiddenAttackers(sq: ChessSquare, position: ChessPosition): boolean {
  let cleared = position;
  for (const color of CHESS_COLORS) {
    for (const attacker of position.attackers(sq, color)) cleared = cleared.setting(null, attacker);
  }
  return CHESS_COLORS.some((color) => cleared.attackers(sq, color).length > 0);
}

/** The squares a piece can move to from a square (a pawn that promotes counts its square once). */
export function destinations(sq: ChessSquare, position: ChessPosition): ChessSquare[] {
  const seen = new Set<ChessSquare>();
  return position
    .legalMoves()
    .filter((m) => m.from === sq)
    .map((m) => m.to)
    .filter((to) => {
      if (seen.has(to)) return false;
      seen.add(to);
      return true;
    });
}

/**
 * The answer forms of a typed move in notation: with and without the sign and the capture mark, so "Dxf7#", "Dxf7"
 * and "Dxf7+" all count.
 */
export function typedVariants(san: string): string[] {
  const bare = Array.from(san).filter((c) => c !== '+' && c !== '#').join('');
  const forms = [san, bare, bare + '+', bare + '#'];
  if (bare.includes('x')) forms.push(bare.split('x').join(''));
  return forms.filter((form, index) => forms.indexOf(form) === index);
}

/** The notation without the check sign, so a prompt can name a move without giving away that it mates. */
export function sanWithoutSign(san: string): string {
  return Array.from(san).filter((c) => c !== '+' && c !== '#').join('');
}
