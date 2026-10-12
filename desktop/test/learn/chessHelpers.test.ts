// Engine helpers without a Swift test of their own: castling reasons, geometry, coach texts, goals.
import { describe, expect, it } from 'vitest';
import {
  ChessGeometry,
  ChessPosition,
  ChessTactics,
  acceptedMoves,
  castlingProblems,
  coachExplain,
  coachHints,
  goalCoachCode,
  hasHiddenAttackers,
  list,
  moveUci,
  squareFromName,
  squareName,
  typedVariants,
  KNIGHT,
  ROOK,
  BISHOP,
  QUEEN,
  KING,
} from '../../src/lib/learn/chess';

const pos = (fen: string): ChessPosition => ChessPosition.fromFen(fen)!;
const sq = (name: string): number => squareFromName(name)!;

describe('chess helpers', () => {
  it('castling problems agree with the generator', () => {
    for (const fen of [
      'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', '4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1', '5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1',
      '6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1', 'r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1',
    ]) {
      const p = pos(fen);
      const legal = new Set(p.legalMoves().map(moveUci));
      expect(castlingProblems('kingside', p).length === 0, fen).toBe(legal.has('e1g1'));
      expect(castlingProblems('queenside', p).length === 0, fen).toBe(legal.has('e1c1'));
    }
    expect(castlingProblems('kingside', pos('r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1'))).toEqual(['rightLost']);
    expect(castlingProblems('kingside', pos('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).toEqual(['inCheck']);
  });

  it('geometry on an empty board matches the generator for lone pieces', () => {
    for (const [kind, letter] of [[KNIGHT, 'N'], [ROOK, 'R'], [BISHOP, 'B'], [QUEEN, 'Q'], [KING, 'K']] as const) {
      expect(ChessGeometry.reach(kind, sq('d4')).length).toBe({ N: 8, R: 14, B: 13, Q: 27, K: 8 }[letter]);
    }
  });

  it('goals: escape kinds and cache', () => {
    const p = pos('4r1k1/8/8/8/8/8/3N4/4K3 w - - 0 1');
    const king = acceptedMoves({ type: 'escape', kind: 'kingMoves' }, p).map(moveUci);
    const block = acceptedMoves({ type: 'escape', kind: 'interpose' }, p).map(moveUci);
    expect(king.every((u) => u.startsWith('e1'))).toBe(true);
    expect(block).toEqual(['d2e4']);
    expect(acceptedMoves({ type: 'escape', kind: 'any' }, p).length).toBe(king.length + block.length);
    expect(acceptedMoves({ type: 'escape', kind: 'any' }, p)).toBe(acceptedMoves({ type: 'escape', kind: 'any' }, p));
    expect(goalCoachCode({ type: 'escape', kind: 'interpose' })).toBe('escape.block');
  });

  it('tactics and kit helpers', () => {
    expect(ChessTactics.absolutePins('black', pos('4k3/3n4/8/1B2p3/8/8/8/4R1K1 w - - 0 1')).map((x) => squareName(x.pinned))).toEqual(['e5', 'd7']);
    expect(hasHiddenAttackers(sq('e5'), pos('4k3/8/8/4p3/8/8/4R3/4RK2 w - - 0 1'))).toBe(true);
    expect(list(['a4', 'b5', 'g4'])).toBe('a4, b5 und g4');
    expect(typedVariants('Dxf7#')).toEqual(['Dxf7#', 'Dxf7', 'Dxf7+', 'Df7']);
  });

  it('coach texts', () => {
    const start = ChessPosition.start;
    expect(coachExplain('e3e4', 'best', start)).toBe('Auf e3 steht keine Figur.');
    expect(coachExplain('e7e5', 'best', start)).toBe('Auf e7 steht eine schwarze Figur, aber Weiß ist am Zug.');
    expect(coachExplain('f1c4', 'best', start)).toBe('Der Weg von f1 nach c4 ist versperrt.');
  });

  it('coach hints', () => {
    const p = pos('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
    const accepted = acceptedMoves({ type: 'mateInOne' }, p);
    expect(coachHints({ type: 'mateInOne' }, accepted, p)[1]).toBe('Es zieht die Figur auf a1.');
  });
});
