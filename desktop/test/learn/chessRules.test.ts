import { describe, expect, it } from 'vitest';
import { ChessNotation } from '../../src/lib/learn/chess/notation';
import { ChessPosition, positionOf, startFEN } from '../../src/lib/learn/chess/position';
import { ChessExchange, ChessSearch, mateScore } from '../../src/lib/learn/chess/search';
import { ChessMove, Sq, kindFromFenLetter, kindLetter, moveFromUci, moveUci, pieceKinds, piece, samePiece, sqr } from '../../src/lib/learn/chess/types';

/** The rules engine, proved by counting: the perft numbers of the start position and of the well-known test positions
 * (Chess Programming Wiki, "Perft Results") only come out right when castling, en passant, promotion, pins and checks
 * are all right. The rest of the file checks the individual rules and the notation. */
const position = positionOf;
const ucis = (p: ChessPosition): Set<string> => new Set(p.legalMoves().map(moveUci));
const movesFrom = (fen: string, square: string): string[] => position(fen).legalMoves().filter((m) => Sq.name(m.from) === square).map(moveUci).sort();
const uci = (text: string): ChessMove => moveFromUci(text) as ChessMove;
const play = (p: ChessPosition, text: string): ChessPosition => {
  const next = p.playing(text);
  if (!next) throw new Error(`${text} is not legal in ${p.fen}`);
  return next;
};

function perft(fen: string, expected: number[]) {
  const start = position(fen);
  expect(start.validationProblems()).toEqual([]);
  expected.forEach((count, index) => expect(start.perft(index + 1), `depth ${index + 1} of ${fen}`).toBe(count));
}

describe('chess rules: perft', () => {
  it('start position', () => perft(startFEN, [20, 400, 8902, 197281]));
  it('kiwipete', () => perft('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -', [48, 2039, 97862]));
  it('position 3', () => perft('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -', [14, 191, 2812, 43238]));
  it('position 4', () => perft('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]));
  it('position 4 mirrored for black', () => perft('r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1', [6, 264, 9467]));
  it('position 5', () => perft('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]));
  it('position 6', () => perft('r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]));
});

describe('chess rules: squares and FEN', () => {
  it('square names and colors', () => {
    expect(Sq.name(0)).toBe('a1');
    expect(Sq.name(7)).toBe('h1');
    expect(Sq.name(63)).toBe('h8');
    expect(Sq.of('e4')).toBe(28);
    expect(Sq.of('i4')).toBeNull();
    expect(Sq.of('e9')).toBeNull();
    expect(Sq.all.map(Sq.name)).toEqual(Sq.all.map((s) => Sq.name(Sq.of(Sq.name(s)) as number)));
    // a1 is dark and the colors alternate along ranks and files, so h1 and a8 are light (FIDE Article 2.1).
    expect(Sq.isDark(sqr('a1'))).toBe(true);
    expect(Sq.isLight(sqr('h1'))).toBe(true);
    expect(Sq.isLight(sqr('a8'))).toBe(true);
    expect(Sq.isDark(sqr('h8'))).toBe(true);
    for (const s of Sq.all) for (const [df, dr] of [[1, 0], [0, 1]]) {
      const next = Sq.offset(s, df, dr);
      if (next !== null) expect(Sq.isDark(s)).not.toBe(Sq.isDark(next));
    }
    expect(Sq.all.filter(Sq.isDark)).toHaveLength(32);
  });

  it('FEN round trips', () => {
    for (const fen of [
      startFEN, 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
      'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', '4k3/8/8/8/8/8/8/R3K2R b Kq - 37 71',
    ]) expect(position(fen).fen).toBe(fen);
    // Four fields are completed with the counters 0 and 1.
    expect(position('8/8/8/8/8/8/8/K6k w - -').fen).toBe('8/8/8/8/8/8/8/K6k w - - 0 1');
  });

  it('malformed FENs are rejected', () => {
    for (const fen of [
      '', '8/8/8/8/8/8/8 w - - 0 1', '9/8/8/8/8/8/8/8 w - - 0 1', '7/8/8/8/8/8/8/8 w - - 0 1', '8/8/8/8/8/8/8/7x w - - 0 1', '8/8/8/8/8/8/8/8 x - - 0 1',
      '8/8/8/8/8/8/8/8 w KK - 0 1', '8/8/8/8/8/8/8/8 w X - 0 1', '8/8/8/8/8/8/8/8 w - e5 0 1', '8/8/8/8/8/8/8/8 w - z3 0 1', '8/8/8/8/8/8/8/8 w - - -1 1',
      '8/8/8/8/8/8/8/8 w - - 0 0', '8/8/8/8/8/8/8/8 w - - 0', '8/8/8/8/8/8/8/8/8 w - - 0 1',
    ]) expect(ChessPosition.fromFEN(fen), fen).toBeNull();
  });

  it('validation finds impossible positions', () => {
    expect(position(startFEN).validationProblems()).toEqual([]);
    expect(position('8/8/8/8/8/8/8/K7 w - - 0 1').validationProblems()).not.toEqual([]);
    expect(position('kk6/8/8/8/8/8/8/K7 w - - 0 1').validationProblems()).not.toEqual([]);
    expect(position('k6R/8/8/8/8/8/8/K7 w - - 0 1').validationProblems()).not.toEqual([]);
    expect(position('P3k3/8/8/8/8/8/8/4K3 w - - 0 1').validationProblems()).not.toEqual([]);
    expect(position('4k3/8/8/8/8/8/8/R3K3 w K - 0 1').validationProblems()).not.toEqual([]);
    expect(position('4k3/8/8/8/4P3/8/8/4K3 w - e3 0 1').validationProblems()).not.toEqual([]);
    expect(position('4k3/8/8/8/8/8/8/4K3 b - e3 0 1').validationProblems()).not.toEqual([]);
    expect(position('4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1').validationProblems()).toEqual([]);
    expect(position(startFEN.replace('RNBQKBNR', 'QQQQKQQQ')).validationProblems()).not.toEqual([]);
  });
});

describe('chess rules: the pieces', () => {
  it('start position moves', () => {
    const start = ChessPosition.start;
    expect(start.legalMoves()).toHaveLength(20);
    for (const m of ['e2e4', 'e2e3', 'g1f3', 'g1h3', 'b1c3', 'b1a3']) expect(ucis(start).has(m)).toBe(true);
    expect(ucis(start).has('f1c4')).toBe(false);
    // After 1.e4 Black has 20 moves too.
    expect(start.playing('e2e4')?.legalMoves()).toHaveLength(20);
    expect(start.playing('e2e5')).toBeNull();
    expect(start.playing('zzzz')).toBeNull();
  });

  it('each piece moves as the laws say', () => {
    const count = (fen: string, square: string) => movesFrom(fen, square).length;
    expect(count('k7/8/8/8/3N4/8/8/7K w - - 0 1', 'd4')).toBe(8);
    expect(count('7k/8/8/8/3R4/8/8/K7 w - - 0 1', 'd4')).toBe(14);
    expect(count('k7/8/8/8/3B4/8/7K/8 w - - 0 1', 'd4')).toBe(13);
    expect(count('k7/8/8/8/3Q4/8/8/7K w - - 0 1', 'd4')).toBe(27);
    expect(count('k7/8/8/8/4K3/8/8/8 w - - 0 1', 'e4')).toBe(8);
    // A knight jumps over a ring of pawns.
    expect(count('k7/8/8/2PPP3/2PNP3/2PPP3/8/7K w - - 0 1', 'd4')).toBe(8);
    // A rook stops at its own pieces and captures enemy ones.
    expect(count('7k/8/8/3P4/1P1R4/8/8/K7 w - - 0 1', 'd4')).toBe(8);
    const capture = position('7k/8/8/8/n2R2p1/8/8/K7 w - - 0 1');
    expect(capture.legalMoves().filter((m) => Sq.name(m.from) === 'd4' && capture.isCapture(m)).map(moveUci).sort()).toEqual(['d4a4', 'd4g4']);
  });

  it('the king cannot step into check or next to the other king', () => {
    // The rook on d1 covers the d-file: the king on e4 has five squares left.
    expect(movesFrom('k7/8/8/8/4K3/8/8/3r4 w - - 0 1', 'e4')).toHaveLength(5);
    // Kings face each other: three squares next to the black king are closed.
    expect([...ucis(position('8/8/8/3k4/8/3K4/8/8 w - - 0 1'))].sort()).toEqual(['d3c2', 'd3c3', 'd3d2', 'd3e2', 'd3e3']);
  });

  it('pawn moves', () => {
    expect(movesFrom('7k/8/8/8/8/8/4P3/K7 w - - 0 1', 'e2')).toEqual(['e2e3', 'e2e4']);
    expect(movesFrom('7k/8/8/8/8/4P3/8/K7 w - - 0 1', 'e3')).toEqual(['e3e4']);
    // Blocked in front: no step, no capture straight ahead; one step blocks the double step too.
    expect(movesFrom('7k/8/8/8/8/4n3/4P3/K7 w - - 0 1', 'e2')).toEqual([]);
    expect(movesFrom('7k/8/8/8/4n3/8/4P3/K7 w - - 0 1', 'e2')).toEqual(['e2e3']);
    // Captures go diagonally forward only.
    expect(movesFrom('7k/8/8/3p1p2/4P3/8/8/K7 w - - 0 1', 'e4')).toEqual(['e4d5', 'e4e5', 'e4f5']);
    // Black pawns move down.
    expect(movesFrom('k7/4p3/8/8/8/8/8/7K b - - 0 1', 'e7')).toEqual(['e7e5', 'e7e6']);
  });
});

describe('chess rules: special moves', () => {
  it('castling both sides and the rook moves', () => {
    const both = position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(ucis(both).has('e1g1') && ucis(both).has('e1c1')).toBe(true);
    const short = play(both, 'e1g1');
    expect(short.fen).toBe('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1');
    const long = play(both, 'e1c1');
    expect(long.fen).toBe('r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1');
    // White's new rook on f1 looks at f8, so Black cannot castle short there, but long it can.
    expect(short.playing('e8g8')).toBeNull();
    expect(play(short, 'e8c8').fen).toBe('2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2');
    expect(long.playing('e8c8')).toBeNull();
    expect(play(long, 'e8g8').fen).toBe('r4rk1/8/8/8/8/8/8/2KR3R w - - 2 2');
  });

  it('castling rules', () => {
    expect(ucis(position('r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1')).has('e1g1')).toBe(false);
    expect(ucis(position('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1')).has('e1c1')).toBe(false);
    expect(ucis(position('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1')).has('e1g1')).toBe(true);
    const inCheck = ucis(position('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1'));
    expect(inCheck.has('e1g1') || inCheck.has('e1c1')).toBe(false);
    const across = ucis(position('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1'));
    expect(across.has('e1g1')).toBe(false);
    expect(across.has('e1c1')).toBe(true);
    const onto = ucis(position('6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1'));
    expect(onto.has('e1g1')).toBe(false);
    expect(onto.has('e1c1')).toBe(true);
    // The rook may be attacked, and so may b1 on the long side.
    expect(ucis(position('r3k3/8/8/8/8/8/8/R3K2R w KQ - 0 1')).has('e1c1')).toBe(true);
    expect(ucis(position('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1')).has('e1c1')).toBe(true);
  });

  it('castling rights are lost by moving', () => {
    const both = position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const rights = (p: ChessPosition | null) => (p ? p.fen.split(' ')[2] : null);
    expect(rights(both.playing('h1h2'))).toBe('Qkq');
    expect(rights(both.playing('a1a2'))).toBe('Kkq');
    expect(rights(both.playing('e1e2'))).toBe('kq');
    // A rook captured on its corner takes the right with it.
    expect(rights(position('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1').playing('g2h1'))).toBe('Qkq');
    // The rights do not come back when the king returns.
    const back = both.playingLine(['e1e2', 'e8e7', 'e2e1', 'e7e8']) as ChessPosition;
    expect(rights(back)).toBe('-');
    expect(ucis(back).has('e1g1')).toBe(false);
  });

  it('en passant only right after the double step', () => {
    const after = play(position('7k/3p4/8/4P3/8/8/8/K7 b - - 0 1'), 'd7d5');
    expect(Sq.name(after.enPassant as number)).toBe('d6');
    expect(after.fen).toBe('7k/8/8/3pP3/8/8/8/K7 w - d6 0 2');
    expect(ucis(after).has('e5d6')).toBe(true);
    const captured = play(after, 'e5d6');
    expect(captured.fen).toBe('7k/8/3P4/8/8/8/8/K7 b - - 0 2');
    expect(captured.at(sqr('d5')), 'the passed pawn is gone').toBeNull();
    // One move later the right has lapsed.
    const later = play(after, 'a1a2');
    expect(later.enPassant).toBeNull();
    expect(ucis(play(later, 'h8g8')).has('e5d6')).toBe(false);
    // Two single steps do not allow it.
    expect(ucis(position('7k/8/8/3pP3/8/8/8/K7 w - - 0 1')).has('e5d6')).toBe(false);
    // Black captures en passant too.
    expect(position('k7/8/8/8/3pP3/8/8/7K b - e3 0 1').playing('d4e3')?.fen).toBe('k7/8/8/8/8/4p3/8/7K w - - 0 2');
  });

  it('en passant that exposes the king is illegal', () => {
    // Taking en passant would clear the fifth rank between the king on a5 and the rook on h5.
    expect([...ucis(position('8/8/8/K1pP3r/8/8/8/7k w - c6 0 1'))].sort()).toEqual(['a5a4', 'a5a6', 'a5b5', 'a5b6', 'd5d6']);
  });

  it('promotion to every piece', () => {
    const start = position('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    expect(movesFrom('7k/P7/8/8/8/8/8/K7 w - - 0 1', 'a7')).toEqual(['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r']);
    for (const letter of ['q', 'r', 'b', 'n']) {
      const promoted = play(start, `a7a8${letter}`);
      expect(samePiece(promoted.at(sqr('a8')), piece('white', kindFromFenLetter(letter) as never))).toBe(true);
    }
    expect(start.playing('a7a8'), 'a promotion needs the piece named').toBeNull();
    expect(start.playing('a7a8k')).toBeNull();
    // With a capture, and for Black.
    const capture = position('r6k/1P6/8/8/8/8/8/6K1 w - - 0 1');
    expect(movesFrom('r6k/1P6/8/8/8/8/8/6K1 w - - 0 1', 'b7')).toHaveLength(8);
    expect(ucis(capture).has('b7a8n')).toBe(true);
    expect(movesFrom('k7/8/8/8/8/8/p7/7K b - - 0 1', 'a2')).toEqual(['a2a1b', 'a2a1n', 'a2a1q', 'a2a1r']);
    // A pawn that promotes with the piece left out by the engine's own apply becomes a queen.
    expect(start.applying({ from: sqr('a7'), to: sqr('a8') }).at(sqr('a8'))?.kind).toBe('queen');
  });
});

describe('chess rules: check, mate, stalemate, draws', () => {
  it('check, mate and stalemate', () => {
    let game = ChessPosition.start;
    for (const move of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) game = play(game, move);
    expect(game.isCheck).toBe(true);
    expect(game.isCheckmate).toBe(true);
    expect(game.isStalemate).toBe(false);
    expect(game.legalMoves()).toEqual([]);
    expect(game.fen).toBe('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(play(position('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'), 'a1a8').isCheckmate).toBe(true);
    for (const fen of ['7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1']) {
      const stalemate = position(fen);
      expect(stalemate.isCheck).toBe(false);
      expect(stalemate.isStalemate).toBe(true);
      expect(stalemate.isCheckmate).toBe(false);
    }
    const answer = position('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    expect(answer.isCheck).toBe(true);
    expect(answer.isCheckmate).toBe(false);
    expect([...ucis(answer)].sort()).toEqual(['e1d1', 'e1e2', 'e1f1']);
  });

  it('insufficient material', () => {
    for (const fen of ['4k3/8/8/8/8/8/8/4K3 w - - 0 1', '4k3/8/8/8/8/8/8/3BK3 w - - 0 1', '4k3/8/8/8/8/8/8/3NK3 w - - 0 1', '3bk3/8/8/8/8/8/8/4K3 w - - 0 1']) {
      expect(position(fen).hasInsufficientMaterial, fen).toBe(true);
    }
    expect(position('4k3/8/8/8/8/8/8/2B1K1b1 w - - 0 1').hasInsufficientMaterial, 'c1 and g1 are both dark').toBe(true);
    expect(position('4k3/8/8/8/8/8/8/3BK1b1 w - - 0 1').hasInsufficientMaterial, 'd1 is light, g1 is dark').toBe(false);
    expect(position('4k3/8/8/8/8/8/8/2BNK3 w - - 0 1').hasInsufficientMaterial).toBe(false);
    expect(position('4k3/8/8/8/8/8/P7/4K3 w - - 0 1').hasInsufficientMaterial).toBe(false);
    expect(position('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').hasInsufficientMaterial).toBe(false);
    expect(position(startFEN).hasInsufficientMaterial).toBe(false);
    expect(position('4k3/8/8/8/8/8/8/2NNK3 w - - 0 1').hasInsufficientMaterial, 'two knights can mate with help').toBe(false);
  });

  it('the fifty move counter and the move number', () => {
    let current = ChessPosition.start;
    expect(current.halfmoveClock).toBe(0);
    current = play(current, 'g1f3');
    expect(current.fen).toBe('rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1');
    current = play(current, 'g8f6');
    expect(current.halfmoveClock).toBe(2);
    expect(current.fullmoveNumber).toBe(2);
    current = play(current, 'e2e4');
    expect(current.halfmoveClock, 'a pawn move resets the counter').toBe(0);
    current = play(current, 'f6e4');
    expect(current.halfmoveClock, 'so does a capture').toBe(0);
    const long = position('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
    expect(long.canClaimFiftyMoveDraw).toBe(false);
    const next = play(long, 'a1a2');
    expect(next.halfmoveClock).toBe(100);
    expect(next.canClaimFiftyMoveDraw).toBe(true);
    expect(next.fullmoveNumber, 'the move number grows after Black\'s move').toBe(80);
    expect(play(next, 'e8d8').fullmoveNumber).toBe(81);
  });
});

describe('chess rules: notation', () => {
  const san = (text: string, p: ChessPosition) => {
    const m = moveFromUci(text);
    return m ? ChessNotation.san(m, p) : null;
  };

  it('German notation basics', () => {
    const start = ChessPosition.start;
    expect(san('e2e4', start)).toBe('e4');
    expect(san('g1f3', start)).toBe('Sf3');
    expect(san('e2e5', start)).toBeNull();
    const scholar = ChessNotation.play(['e4', 'e5', 'Lc4', 'Sc6', 'Dh5', 'Sf6', 'Dxf7#']) as ChessPosition;
    expect(scholar.isCheckmate).toBe(true);
    expect(scholar.fen).toBe('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
    expect(ChessNotation.sanLine(['e2e4', 'e7e5', 'd1h5'].map(uci), start)).toEqual(['e4', 'e5', 'Dh5']);
    expect(pieceKinds.map(kindLetter)).toEqual(['', 'S', 'L', 'T', 'D', 'K']);
    const castling = position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(san('e1g1', castling)).toBe('O-O');
    expect(san('e1c1', castling)).toBe('O-O-O');
    expect(san('a1a8', castling)).toBe('Txa8+');
    expect(san('e4d5', position('7k/8/8/3p4/4P3/8/8/K7 w - - 0 1'))).toBe('exd5');
    expect(san('e5d6', position('7k/8/8/3pP3/8/8/8/K7 w - d6 0 1'))).toBe('exd6');
    expect(san('a7a8q', position('7k/P7/8/8/8/8/8/K7 w - - 0 1'))).toBe('a8D+');
    expect(san('a7a8n', position('7k/P7/8/8/8/8/8/K7 w - - 0 1'))).toBe('a8S');
  });

  it('disambiguation', () => {
    const sans = (fen: string, target: string) => new Set(ChessNotation.allSAN(position(fen)).filter((e) => Sq.name(e.move.to) === target).map((e) => e.san));
    expect(sans('4k3/8/8/8/8/N7/8/N3K3 w - - 0 1', 'c2')).toEqual(new Set(['S3c2', 'S1c2']));
    expect(sans('4k3/8/8/8/8/N7/8/N3K3 w - - 0 1', 'b5')).toEqual(new Set(['Sb5']));
    expect(sans('4k3/8/8/8/8/R7/8/R3K3 w - - 0 1', 'a2')).toEqual(new Set(['T3a2', 'T1a2']));
    expect(sans('4k3/8/8/2Q1Q3/8/8/2Q5/4K3 w - - 0 1', 'e3')).toEqual(new Set(['Dee3+', 'Dce3+']));
    expect(sans('4k3/8/8/8/8/8/Q1Q5/Q3K3 w - - 0 1', 'b2')).toEqual(new Set(['Dcb2', 'Da2b2', 'D1b2']));
    expect(sans('4r1k1/8/8/8/8/8/3N1N2/4K3 w - - 0 1', 'e4')).toEqual(new Set(['Sfe4', 'Sde4']));
  });

  it('parsing is forgiving and exact', () => {
    const kiwi = position('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    for (const entry of ChessNotation.allSAN(kiwi)) expect(ChessNotation.moveFromSAN(entry.san, kiwi), entry.san).toEqual(entry.move);
    expect(ChessNotation.moveFromSAN('0-0', kiwi)).toEqual(uci('e1g1'));
    expect(ChessNotation.moveFromSAN('O-O-O', kiwi)).toEqual(uci('e1c1'));
    expect(ChessNotation.moveFromSAN('Sxh6', kiwi), 'no knight can take h6 here').toBeNull();
    expect(ChessNotation.moveFromSAN('Sxf7', kiwi)).not.toBeNull();
    expect(ChessNotation.moveFromSAN('Zz9', kiwi)).toBeNull();
    expect(ChessNotation.moveFromSAN('', kiwi)).toBeNull();
    expect(ChessNotation.moveFromSAN('gxh3', kiwi)).toEqual(uci('g2h3'));
  });
});

describe('chess rules: search and exchange', () => {
  it('mate in one is found by the search', () => {
    const backRank = position('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
    const best = ChessSearch.bestMoves(backRank, 2);
    expect(best.moves.map(moveUci)).toEqual(['a1a8']);
    expect(best.score).toBe(mateScore - 1);
    expect(ChessSearch.bestMoves(position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 3).moves).toEqual([]);
  });

  it('the search does not lose material', () => {
    // The queen on d1 can take the rook on d8, which is defended by the king: the capture loses the queen.
    const best = ChessSearch.bestMoves(position('3rk3/8/8/8/8/8/8/3QK3 w - - 0 1'), 3);
    expect(best.moves.map(moveUci)).not.toContain('d1d8');
    expect(best.score).toBeGreaterThanOrEqual(0);
    // A free piece is taken.
    expect(ChessSearch.bestMoves(position('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1'), 2).moves.map(moveUci)).toEqual(['d1d5']);
  });

  it('the exchange helper', () => {
    // A pawn takes a pawn that a pawn defends: 1 - 1 = 0.
    expect(ChessExchange.gain(uci('e4d5'), position('4k3/8/2p5/3p4/4P3/8/8/4K3 w - - 0 1'))).toBe(0);
    // A queen takes a pawn that a pawn defends: 1 - 9 = -8.
    const queen = position('4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1');
    expect(ChessExchange.gain(uci('d1d5'), queen)).toBe(-8);
    // The same pawn without its defender is free.
    expect(ChessExchange.gain(uci('d1d5'), position('4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1'))).toBe(1);
    // A rook takes a knight that a bishop defends: 3 - 5 = -2.
    const knight = position('4k3/8/4b3/3n4/8/8/8/3RK3 w - - 0 1');
    expect(ChessExchange.gain(uci('d1d5'), knight)).toBe(-2);
    expect(ChessExchange.bestCaptures(knight).moves).toEqual([]);
    // With a pawn beside, the pawn takes the knight first and the bishop cannot recapture profitably.
    const pawn = position('4k3/8/4b3/3n4/4P3/8/8/3RK3 w - - 0 1');
    expect(ChessExchange.gain(uci('e4d5'), pawn)).toBe(3);
    expect(ChessExchange.gain(uci('d1d5'), pawn)).toBe(1);
    expect(ChessExchange.bestCaptures(pawn).moves.map(moveUci)).toEqual(['e4d5']);
    expect(ChessExchange.bestCaptures(queen).moves, 'no capture wins anything').toEqual([]);
    // A pinned defender does not defend: the knight on d7 cannot take back on e5, because the bishop b5 pins it.
    expect(ChessExchange.gain(uci('e1e5'), position('4k3/3n4/8/1B2p3/8/8/8/4R1K1 w - - 0 1'))).toBe(1);
  });

  it('material count', () => {
    expect(ChessPosition.start.material('white')).toBe(39);
    expect(ChessPosition.start.material('black')).toBe(39);
    expect(position('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').materialBalanceForSideToMove).toBe(5);
    expect(position('4k3/8/8/8/8/8/8/R3K3 b - - 0 1').materialBalanceForSideToMove).toBe(-5);
  });
});
