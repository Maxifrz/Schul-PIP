import { ChessPosition, startFEN } from './position';
import { ChessMove, Square, Sq, moveFromUci } from './types';

/**
 * A hand-authored position. The FEN is the only thing written by hand: every accepted move, count and label the
 * course shows is computed from it by the engine at run time. `expected` is the author's own solution in German
 * notation (or a yes/no word); the tests check that the engine agrees with it, so a mistake in a position cannot
 * reach a student.
 */
export interface ChessSample {
  /** Unique across all pools, like "piece.rook.open". */
  id: string;
  fen: string;
  /** The square the exercise is about (the piece to move, the pawn, the king), if there is one. */
  focus?: string;
  /** A second square or move the exercise is about: a target square, or a move like "d1d5". */
  detail?: string;
  /** What kind of position it is within its pool ("backRank", "fork", ...). */
  theme: string;
  /** The author's solution(s) for the tests; empty when the pool has no single answer. */
  expected: string[];
}

function sample(id: string, fen: string, options: { focus?: string; detail?: string; theme?: string; expected?: string[] } = {}): ChessSample {
  return { id, fen, focus: options.focus, detail: options.detail, theme: options.theme ?? '', expected: options.expected ?? [] };
}

export const samplePosition = (s: ChessSample): ChessPosition | null => ChessPosition.fromFEN(s.fen);
export const focusSquare = (s: ChessSample): Square | null => (s.focus === undefined ? null : Sq.of(s.focus));
export const detailSquare = (s: ChessSample): Square | null => (s.detail === undefined ? null : Sq.of(s.detail));
export const detailMove = (s: ChessSample): ChessMove | null => (s.detail === undefined ? null : moveFromUci(s.detail));

// The pools of positions, one per kind of exercise. Each pool has several positions so that other seeds show other
// boards. White is at the bottom unless Black is to move.
// Unit 1: the board

// Opening moves for reading square names: `detail` is the move to find, like "g1f3". Nothing else is asked, so
// the student only has to find the two squares.
export const nameMoves: ChessSample[] = (() => {
    const start = startFEN;
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const afterE4E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
    const afterD4 = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1";
    return [
        sample("name.w.e4", start, { detail: "e2e4" }), sample("name.w.d4", start, { detail: "d2d4" }),
        sample("name.w.c4", start, { detail: "c2c4" }), sample("name.w.e3", start, { detail: "e2e3" }),
        sample("name.w.nf3", start, { detail: "g1f3" }), sample("name.w.nc3", start, { detail: "b1c3" }),
        sample("name.w.g3", start, { detail: "g2g3" }), sample("name.w.b3", start, { detail: "b2b3" }),
        sample("name.w.f4", start, { detail: "f2f4" }), sample("name.w.a3", start, { detail: "a2a3" }),
        sample("name.w.h4", start, { detail: "h2h4" }), sample("name.w.na3", start, { detail: "b1a3" }),
        sample("name.b.e5", afterE4, { detail: "e7e5" }), sample("name.b.c5", afterE4, { detail: "c7c5" }),
        sample("name.b.e6", afterE4, { detail: "e7e6" }), sample("name.b.d5", afterE4, { detail: "d7d5" }),
        sample("name.b.nf6", afterE4, { detail: "g8f6" }), sample("name.b.nc6", afterE4, { detail: "b8c6" }),
        sample("name.b.g6", afterE4, { detail: "g7g6" }), sample("name.b.a6", afterE4, { detail: "a7a6" }),
        sample("name.w2.nf3", afterE4E5, { detail: "g1f3" }), sample("name.w2.bc4", afterE4E5, { detail: "f1c4" }),
        sample("name.w2.nc3", afterE4E5, { detail: "b1c3" }), sample("name.w2.d4", afterE4E5, { detail: "d2d4" }),
        sample("name.w2.f4", afterE4E5, { detail: "f2f4" }),
        sample("name.b2.d5", afterD4, { detail: "d7d5" }), sample("name.b2.nf6", afterD4, { detail: "g8f6" }),
        sample("name.b2.e6", afterD4, { detail: "e7e6" }), sample("name.b2.c5", afterD4, { detail: "c7c5" }),
    ]
})();

// Unit 2: how the pieces move

// One piece of interest per position (`focus`), kings out of the way, some with blockers and victims.
export const pieceMoves: ChessSample[] = [
    sample("piece.rook.open", "7k/8/8/8/3R4/8/8/K7 w - - 0 1", { focus: "d4", theme: "rook" }),
    sample("piece.rook.blocked", "7k/8/8/3P4/1P1R4/8/8/K7 w - - 0 1", { focus: "d4", theme: "rook" }),
    sample("piece.rook.capture", "7k/8/8/8/n2R2p1/8/8/K7 w - - 0 1", { focus: "d4", theme: "rook" }),
    sample("piece.rook.corner", "7k/8/8/8/8/8/8/R6K w - - 0 1", { focus: "a1", theme: "rook" }),
    sample("piece.rook.black", "k7/8/8/8/8/8/2r5/7K b - - 0 1", { focus: "c2", theme: "rook" }),
    sample("piece.bishop.open", "k7/8/8/8/3B4/8/7K/8 w - - 0 1", { focus: "d4", theme: "bishop" }),
    sample("piece.bishop.capture", "7k/8/2p5/8/4B3/8/8/K7 w - - 0 1", { focus: "e4", theme: "bishop" }),
    sample("piece.bishop.edge", "7k/8/8/8/8/8/8/K4B2 w - - 0 1", { focus: "f1", theme: "bishop" }),
    sample("piece.bishop.locked", "7k/8/8/8/8/2P1P3/3B4/K7 w - - 0 1", { focus: "d2", theme: "bishop" }),
    sample("piece.bishop.black", "k7/8/8/3b4/8/8/8/K6R b - - 0 1", { focus: "d5", theme: "bishop" }),
    sample("piece.queen.open", "k7/8/8/8/3Q4/8/8/7K w - - 0 1", { focus: "d4", theme: "queen" }),
    sample("piece.queen.capture", "7k/8/8/8/1p2Q3/8/8/K7 w - - 0 1", { focus: "e4", theme: "queen" }),
    sample("piece.queen.crowded", "7k/8/4p3/8/2P1Q3/8/4P3/K7 w - - 0 1", { focus: "e4", theme: "queen" }),
    sample("piece.queen.black", "k7/8/8/4q3/8/8/8/7K b - - 0 1", { focus: "e5", theme: "queen" }),
    sample("piece.king.open", "k7/8/8/8/4K3/8/8/8 w - - 0 1", { focus: "e4", theme: "king" }),
    sample("piece.king.rook", "k7/8/8/8/4K3/8/8/3r4 w - - 0 1", { focus: "e4", theme: "king" }),
    sample("piece.king.opposition", "8/8/8/3k4/8/3K4/8/8 w - - 0 1", { focus: "d3", theme: "king" }),
    sample("piece.king.corner", "k7/8/8/8/8/8/8/K7 w - - 0 1", { focus: "a1", theme: "king" }),
    sample("piece.king.capture", "8/8/8/8/3Kp3/8/7k/8 w - - 0 1", { focus: "d4", theme: "king" }),
    sample("piece.knight.open", "k7/8/8/8/3N4/8/8/7K w - - 0 1", { focus: "d4", theme: "knight" }),
    sample("piece.knight.corner", "k7/8/8/8/8/8/8/N6K w - - 0 1", { focus: "a1", theme: "knight" }),
    sample("piece.knight.ring", "k7/8/8/2PPP3/2PNP3/2PPP3/8/7K w - - 0 1", { focus: "d4", theme: "knight" }),
    sample("piece.knight.start", startFEN, { focus: "g1", theme: "knight" }),
    sample("piece.knight.capture", "k7/8/8/4p3/8/3N4/8/7K w - - 0 1", { focus: "d3", theme: "knight" }),
    sample("piece.knight.black", "k7/8/8/8/8/5n2/8/7K b - - 0 1", { focus: "f3", theme: "knight" }),
]

export const pieceMovesOf = (kinds: Set<string>): ChessSample[] => pieceMoves.filter((s) => kinds.has(s.theme));

// Boards with many pieces on them, for naming the piece on a square.
export const crowded: ChessSample[] = [
    sample("crowd.start", startFEN, { theme: "start" }),
    sample("crowd.italian", "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", { theme: "game" }),
    sample("crowd.scholar", "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", { theme: "game" }),
    sample("crowd.endgame", "8/5pk1/6p1/3r4/2P5/1B6/5PPP/4R1K1 w - - 0 1", { theme: "endgame" }),
    sample("crowd.middle", "r2q1rk1/ppp2ppp/2n2n2/3pp3/1b1P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 1", { theme: "game" }),
]

// Unit 3: the pawn

// Pawns on their own: first step, double step, blocked, captures. `focus` is the pawn.
export const pawns: ChessSample[] = [
    sample("pawn.start", "7k/8/8/8/8/8/4P3/K7 w - - 0 1", { focus: "e2", theme: "start" }),
    sample("pawn.start.d", "7k/8/8/8/8/8/3P4/K7 w - - 0 1", { focus: "d2", theme: "start" }),
    sample("pawn.moved", "7k/8/8/8/8/4P3/8/K7 w - - 0 1", { focus: "e3", theme: "moved" }),
    sample("pawn.moved.c", "7k/8/8/8/2P5/8/8/K7 w - - 0 1", { focus: "c4", theme: "moved" }),
    sample("pawn.blocked.near", "7k/8/8/8/8/4n3/4P3/K7 w - - 0 1", { focus: "e2", theme: "blocked" }),
    sample("pawn.blocked.far", "7k/8/8/8/4n3/8/4P3/K7 w - - 0 1", { focus: "e2", theme: "blockedFar" }),
    sample("pawn.blocked.front", "7k/8/8/4p3/4P3/8/8/K7 w - - 0 1", { focus: "e4", theme: "blocked" }),
    sample("pawn.blocked.bishop", "7k/8/8/8/2b5/8/2P5/K7 w - - 0 1", { focus: "c2", theme: "blockedFar" }),
    sample("pawn.capture.both", "7k/8/8/3p1p2/4P3/8/8/K7 w - - 0 1", { focus: "e4", theme: "capture" }),
    sample("pawn.capture.one", "7k/8/8/3p4/4P3/8/8/K7 w - - 0 1", { focus: "e4", theme: "capture" }),
    sample("pawn.capture.rook", "7k/8/8/8/8/1r1n4/2P5/K7 w - - 0 1", { focus: "c2", theme: "capture" }),
    sample("pawn.black.start", "k7/4p3/8/8/8/8/8/7K b - - 0 1", { focus: "e7", theme: "start" }),
    sample("pawn.black.capture", "k7/8/8/8/3p4/2P1P3/8/7K b - - 0 1", { focus: "d4", theme: "capture" }),
    sample("pawn.black.blocked", "k7/8/8/8/8/3p4/3N4/7K b - - 0 1", { focus: "d3", theme: "blocked" }),
    sample("pawn.start.full", startFEN, { focus: "e2", theme: "start" }),
]

// En passant: `focus` is the pawn that may take, `detail` the pawn next to it. With a square in the FEN's fourth
// field the double step has just been made; without it the pawn has stood there for longer (theme "late") or has
// just made a single step (theme "single"), which the prompt says.
export const enPassant: ChessSample[] = [
    sample("ep.white", "7k/8/8/3pP3/8/8/8/K7 w - d6 0 1", { focus: "e5", detail: "d5", theme: "available" }),
    sample("ep.black", "k7/8/8/8/3pP3/8/8/7K b - e3 0 1", { focus: "d4", detail: "e4", theme: "available" }),
    sample("ep.both", "7k/8/8/2PpP3/8/8/8/K7 w - d6 0 1", { focus: "e5", detail: "d5", theme: "available" }),
    sample("ep.realistic", "rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3", { focus: "e5", detail: "d5", theme: "available" }),
    sample("ep.kingside", "k7/8/8/8/5pP1/8/8/7K b - g3 0 1", { focus: "f4", detail: "g4", theme: "available" }),
    sample("ep.late", "7k/8/8/3pP3/8/8/8/K7 w - - 0 1", { focus: "e5", detail: "d5", theme: "late" }),
    sample("ep.late.black", "k7/8/8/8/3pP3/8/8/7K b - - 0 1", { focus: "d4", detail: "e4", theme: "late" }),
    sample("ep.single", "7k/8/8/2pP4/8/8/8/K7 w - - 0 1", { focus: "d5", detail: "c5", theme: "single" }),
    sample("ep.pinned", "8/8/8/K1pP3r/8/8/8/7k w - c6 0 1", { focus: "d5", detail: "c5", theme: "pinned" }),
]

// Promotion: `focus` is the pawn one step from the last rank.
export const promotions: ChessSample[] = [
    sample("promo.simple", "7k/P7/8/8/8/8/8/K7 w - - 0 1", { focus: "a7", theme: "step" }),
    sample("promo.simple.h", "k7/7P/8/8/8/8/8/7K w - - 0 1", { focus: "h7", theme: "step" }),
    sample("promo.capture", "r6k/1P6/8/8/8/8/8/6K1 w - - 0 1", { focus: "b7", theme: "capture" }),
    sample("promo.black", "k7/8/8/8/8/8/p7/7K b - - 0 1", { focus: "a2", theme: "step" }),
    sample("promo.black.capture", "7k/8/8/8/8/8/6p1/K4R2 b - - 0 1", { focus: "g2", theme: "capture" }),
    sample("promo.far", "7k/8/P7/8/8/8/8/K7 w - - 0 1", { focus: "a6", theme: "far" }),
    sample("promo.far.black", "k7/8/8/8/8/1p6/8/7K b - - 0 1", { focus: "b3", theme: "far" }),
]

// Unit 4: check and mate

// The side to move is in check by exactly one piece. `focus` is its king; `detail` the square of the checker.
export const inCheck: ChessSample[] = [
    sample("check.rook", "4k3/8/8/8/8/8/4r3/4K3 w - - 0 1", { focus: "e1", detail: "e2", theme: "rook" }),
    sample("check.rook.far", "4r1k1/8/8/8/8/8/3B4/4K3 w - - 0 1", { focus: "e1", detail: "e8", theme: "rook" }),
    sample("check.bishop", "4k3/8/8/8/1b6/8/8/4K3 w - - 0 1", { focus: "e1", detail: "b4", theme: "bishop" }),
    sample("check.knight", "4k3/8/8/8/8/5n2/8/4K3 w - - 0 1", { focus: "e1", detail: "f3", theme: "knight" }),
    sample("check.knight.capture", "4k3/8/8/8/8/5n2/6PP/4K2R w - - 0 1", { focus: "e1", detail: "f3", theme: "knight" }),
    sample("check.pawn", "4k3/8/8/8/8/8/3p4/4K3 w - - 0 1", { focus: "e1", detail: "d2", theme: "pawn" }),
    sample("check.queen", "4k3/8/8/8/8/8/8/q3K3 w - - 0 1", { focus: "e1", detail: "a1", theme: "queen" }),
    sample("check.queen.block", "4k3/8/8/8/8/8/3R4/q3K3 w - - 0 1", { focus: "e1", detail: "a1", theme: "queen" }),
    sample("check.black.rook", "4k3/4R3/8/8/8/8/8/4K3 b - - 0 1", { focus: "e8", detail: "e7", theme: "rook" }),
    sample("check.black.bishop", "4k3/8/8/1B6/8/8/8/4K3 b - - 0 1", { focus: "e8", detail: "b5", theme: "bishop" }),
    sample("check.black.queen", "7k/6Q1/8/8/8/8/8/K7 b - - 0 1", { focus: "h8", detail: "g7", theme: "queen" }),
]

// Pieces aim near the king of the side to move, but it is not in check. `focus` is that king.
export const notInCheck: ChessSample[] = [
    sample("quiet.rook", "4k3/8/8/8/8/8/3r4/4K3 w - - 0 1", { focus: "e1", theme: "rook" }),
    sample("quiet.knight", "4k3/8/8/8/8/6n1/8/4K3 w - - 0 1", { focus: "e1", theme: "knight" }),
    sample("quiet.bishop", "4k3/8/8/8/8/8/2b5/4K3 w - - 0 1", { focus: "e1", theme: "bishop" }),
    sample("quiet.blocked", "4r1k1/8/8/8/8/4P3/8/4K3 w - - 0 1", { focus: "e1", theme: "blocked" }),
    sample("quiet.black.rook", "k7/8/8/8/8/8/1R6/1K6 b - - 0 1", { focus: "a8", theme: "rook" }),
    sample("quiet.start", startFEN, { focus: "e1", theme: "start" }),
]

// Check that is answered by taking the checker, by blocking, or only by the king: a single kind of answer exists.
// `detail` is the square of the checking piece.
export const singleAnswer: ChessSample[] = [
    sample("only.capture", "6k1/8/8/8/8/8/R4PPP/r5K1 w - - 0 1", { focus: "g1", detail: "a1", theme: "capture", expected: ["Txa1"] }),
    sample("only.capture.black", "R5K1/5ppp/8/8/8/8/8/6k1 b - - 0 1", { focus: "g8", detail: "a8", theme: "capture", expected: ["Txa8"] }),
    sample("only.block", "6k1/8/8/8/8/4R3/5PPP/r5K1 w - - 0 1", { focus: "g1", detail: "a1", theme: "interpose", expected: ["Te1"] }),
    sample("only.king", "4k3/8/8/8/8/8/8/q3K3 w - - 0 1", { focus: "e1", detail: "a1", theme: "kingMoves" }),
    sample("only.king.knight", "4k3/8/8/8/8/5n2/8/4K3 w - - 0 1", { focus: "e1", detail: "f3", theme: "kingMoves" }),
]

// The side to move is checkmated.
export const mated: ChessSample[] = [
    sample("mated.backRank", "R5k1/5ppp/8/8/8/8/8/4K3 b - - 1 1", { focus: "g8", theme: "backRank" }),
    sample("mated.backRank.white", "6k1/8/8/8/8/8/5PPP/r5K1 w - - 0 1", { focus: "g1", theme: "backRank" }),
    sample("mated.queen", "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", { focus: "h8", theme: "queen" }),
    sample("mated.rook", "k6R/8/1K6/8/8/8/8/8 b - - 1 1", { focus: "a8", theme: "rook" }),
    sample("mated.fool", "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", { focus: "e1", theme: "fool" }),
    sample("mated.scholar", "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4", { focus: "e8", theme: "scholar" }),
    sample("mated.smothered", "6rk/5Npp/8/8/8/8/8/K7 b - - 1 1", { focus: "h8", theme: "smothered" }),
]

// The side to move has no legal move and is not in check.
export const stalemates: ChessSample[] = [
    sample("stale.queen", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", { focus: "h8", theme: "queen" }),
    sample("stale.corner", "k7/2Q5/1K6/8/8/8/8/8 b - - 0 1", { focus: "a8", theme: "queen" }),
    sample("stale.pawn", "7k/7P/6K1/8/8/8/8/8 b - - 0 1", { focus: "h8", theme: "pawn" }),
    sample("stale.white", "7K/5q2/6k1/8/8/8/8/8 w - - 0 1", { focus: "h8", theme: "queen" }),
    sample("stale.rook", "7k/8/7K/8/8/8/6R1/8 b - - 0 1", { focus: "h8", theme: "rook" }),
]

// Check that is not mate, or a quiet position: the game goes on. `focus` is the king of the side to move.
export const goesOn: ChessSample[] = [
    sample("goes.queenCheck", "7k/6Q1/8/8/8/8/8/K7 b - - 0 1", { focus: "h8", theme: "check" }),
    sample("goes.rookQuiet", "7k/8/6K1/8/8/8/8/R7 b - - 0 1", { focus: "h8", theme: "quiet" }),
    sample("goes.start", startFEN, { focus: "e1", theme: "quiet" }),
    sample("goes.rookCheck", "4k3/4R3/8/8/8/8/8/4K3 b - - 0 1", { focus: "e8", theme: "check" }),
    sample("goes.knightCheck", "4k3/8/8/8/8/5n2/8/4K3 w - - 0 1", { focus: "e1", theme: "check" }),
]

// Very little material: whether anyone can still mate. Theme "draw" is a dead position, "wins" is not.
export const materialEnds: ChessSample[] = [
    sample("bare.kings", "4k3/8/8/8/8/8/8/4K3 w - - 0 1", { theme: "draw" }),
    sample("bare.bishop", "4k3/8/8/8/8/8/8/3BK3 w - - 0 1", { theme: "draw" }),
    sample("bare.knight", "4k3/8/8/8/8/8/8/3NK3 w - - 0 1", { theme: "draw" }),
    sample("bare.black.knight", "3nk3/8/8/8/8/8/8/4K3 w - - 0 1", { theme: "draw" }),
    sample("bare.rook", "4k3/8/8/8/8/8/8/3RK3 w - - 0 1", { theme: "wins" }),
    sample("bare.pawn", "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", { theme: "wins" }),
    sample("bare.queen", "4k3/8/8/8/8/8/8/3QK3 w - - 0 1", { theme: "wins" }),
]

// Unit 5: special moves

// Castling situations. `detail` is the side asked about, "kurz" or "lang"; `expected` is "ja" when the side to
// move may castle that way and "nein" when not. The theme names the reason; "kingMoved" and "rookMoved" cannot be
// seen on a board, so the prompt tells the story.
export const castling: ChessSample[] = [
    sample("castle.rooks.kurz", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", { detail: "kurz", theme: "ok", expected: ["ja"] }),
    sample("castle.rooks.lang", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", { detail: "lang", theme: "ok", expected: ["ja"] }),
    sample("castle.italian", "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", { detail: "kurz", theme: "ok", expected: ["ja"] }),
    sample("castle.italian.black", "rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4", { detail: "kurz", theme: "ok", expected: ["ja"] }),
    sample("castle.queenside", "r3kbnr/pppqpppp/2n5/3p1b2/3P1B2/2N5/PPPQPPPP/R3KBNR w KQkq - 6 5", { detail: "lang", theme: "ok", expected: ["ja"] }),
    sample("castle.black.kurz", "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1", { detail: "kurz", theme: "ok", expected: ["ja"] }),
    sample("castle.b1", "1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", { detail: "lang", theme: "b1", expected: ["ja"] }),
    sample("castle.rookAttacked", "r3k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", { detail: "lang", theme: "rookAttacked", expected: ["ja"] }),
    sample("castle.between.kurz", "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 1 1", { detail: "kurz", theme: "between", expected: ["nein"] }),
    sample("castle.between.lang", "r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1", { detail: "lang", theme: "between", expected: ["nein"] }),
    sample("castle.check", "4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", { detail: "kurz", theme: "check", expected: ["nein"] }),
    sample("castle.check.lang", "4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", { detail: "lang", theme: "check", expected: ["nein"] }),
    sample("castle.cross.kurz", "5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1", { detail: "kurz", theme: "cross", expected: ["nein"] }),
    sample("castle.cross.lang", "3r2k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", { detail: "lang", theme: "cross", expected: ["nein"] }),
    sample("castle.land.kurz", "5kr1/8/8/8/8/8/8/R3K2R w KQ - 0 1", { detail: "kurz", theme: "land", expected: ["nein"] }),
    sample("castle.land.lang", "2r3k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", { detail: "lang", theme: "land", expected: ["nein"] }),
    sample("castle.black.cross", "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 0 1", { detail: "kurz", theme: "cross", expected: ["nein"] }),
    sample("castle.black.lang", "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 0 1", { detail: "lang", theme: "ok", expected: ["ja"] }),
    sample("castle.kingMoved", "r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1", { detail: "kurz", theme: "kingMoved", expected: ["nein"] }),
    sample("castle.rookMoved.kurz", "r3k2r/8/8/8/8/8/8/R3K2R w Qkq - 0 1", { detail: "kurz", theme: "rookMoved", expected: ["nein"] }),
    sample("castle.rookMoved.lang", "r3k2r/8/8/8/8/8/8/R3K2R w Qkq - 0 1", { detail: "lang", theme: "otherRook", expected: ["ja"] }),
]

// A move (`detail`) whose kind is asked: the theme is "castle", "enPassant", "promotion" or "double".
export const classify: ChessSample[] = [
    sample("class.castle.kurz", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", { detail: "e1g1", theme: "castle" }),
    sample("class.castle.lang", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", { detail: "e1c1", theme: "castle" }),
    sample("class.castle.black", "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1", { detail: "e8g8", theme: "castle" }),
    sample("class.ep.white", "7k/8/8/3pP3/8/8/8/K7 w - d6 0 1", { detail: "e5d6", theme: "enPassant" }),
    sample("class.ep.black", "k7/8/8/8/3pP3/8/8/7K b - e3 0 1", { detail: "d4e3", theme: "enPassant" }),
    sample("class.ep.realistic", "rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3", { detail: "e5d6", theme: "enPassant" }),
    sample("class.promo.white", "7k/P7/8/8/8/8/8/K7 w - - 0 1", { detail: "a7a8q", theme: "promotion" }),
    sample("class.promo.black", "k7/8/8/8/8/8/p7/7K b - - 0 1", { detail: "a2a1q", theme: "promotion" }),
    sample("class.promo.capture", "r6k/1P6/8/8/8/8/8/6K1 w - - 0 1", { detail: "b7a8q", theme: "promotion" }),
    sample("class.double.e4", startFEN, { detail: "e2e4", theme: "double" }),
    sample("class.double.d4", startFEN, { detail: "d2d4", theme: "double" }),
    sample("class.double.black", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", { detail: "e7e5", theme: "double" }),
]

// Unit 4 and 7: mate in one

// Positions in which the side to move has a mate in one; `expected` is every mating move in German notation.
// The theme is the pattern: backRank, smothered, scholar, ladder, queen (king and queen), rook (king and rook),
// fool.
export const mates: ChessSample[] = [
    sample("mate.rook", "k7/8/1K6/8/8/8/8/7R w - - 0 1", { theme: "rook", expected: ["Th8#"] }),
    sample("mate.rook.black", "7r/8/8/8/8/1k6/8/K7 b - - 0 1", { theme: "rook", expected: ["Th1#"] }),
    sample("mate.rook.rank8", "2k5/R7/2K5/8/8/8/8/8 w - - 0 1", { theme: "rook", expected: ["Ta8#"] }),
    sample("mate.rook.c8", "5k2/8/5K2/8/2R5/8/8/8 w - - 0 1", { theme: "rook", expected: ["Tc8#"] }),
    sample("mate.rook.corner", "8/8/8/8/8/K6R/8/k7 w - - 0 1", { theme: "rook", expected: ["Th1#"] }),
    sample("mate.queenKing", "7k/8/6K1/8/8/8/Q7/8 w - - 0 1", { theme: "queen", expected: ["Da8#"] }),
    sample("mate.queenKing.black", "8/q7/8/8/8/6k1/8/7K b - - 0 1", { theme: "queen", expected: ["Da1#"] }),
    sample("mate.queenKiss", "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", { theme: "queen", expected: ["Dg7#"] }),
    sample("mate.queen.edge1", "6k1/4Q3/5K2/8/8/8/8/8 w - - 0 1", { theme: "queen", expected: ["Dg7#"] }),
    sample("mate.queen.edge2", "3k4/8/2K5/8/8/7Q/8/8 w - - 0 1", { theme: "queen", expected: ["Dd7#"] }),
    sample("mate.queen.edge3", "1k6/8/K7/8/8/5Q2/8/8 w - - 0 1", { theme: "queen", expected: ["Db7#"] }),
    sample("mate.queen.file", "8/8/5K2/7k/8/2Q5/8/8 w - - 0 1", { theme: "queen", expected: ["Dh3#"] }),
    sample("mate.back.rook", "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", { theme: "backRank", expected: ["Ta8#"] }),
    sample("mate.back.capture", "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", { theme: "backRank", expected: ["Txd8#"] }),
    sample("mate.back.black", "2r3k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1", { theme: "backRank", expected: ["Tc1#"] }),
    sample("mate.back.queen", "6k1/5ppp/8/8/8/8/1Q6/6K1 w - - 0 1", { theme: "backRank", expected: ["Db8#"] }),
    sample("mate.back.queen.black", "6k1/8/8/q7/8/8/5PPP/6K1 b - - 0 1", { theme: "backRank", expected: ["Da1#", "De1#"] }),
    sample("mate.back.rook.black", "r3k3/8/8/8/8/8/5PPP/6K1 b - - 0 1", { theme: "backRank", expected: ["Ta1#"] }),
    sample("mate.smothered", "6rk/6pp/8/6N1/8/8/8/K7 w - - 0 1", { theme: "smothered", expected: ["Sf7#"] }),
    sample("mate.smothered.black", "k7/8/8/8/6n1/8/6PP/6RK b - - 0 1", { theme: "smothered", expected: ["Sf2#"] }),
    sample("mate.scholar", "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", { theme: "scholar", expected: ["Dxf7#"] }),
    sample("mate.scholar.queenF3", "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4", { theme: "scholar", expected: ["Dxf7#"] }),
    sample("mate.scholar.black", "rnb1k1nr/pppp1ppp/8/2b1p3/4P2q/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 4 4", { theme: "scholar", expected: ["Dxf2#"] }),
    sample("mate.ladder", "7k/R7/8/8/8/8/8/1R4K1 w - - 0 1", { theme: "ladder", expected: ["Tb8#"] }),
    sample("mate.ladder.right", "k7/7R/8/8/8/8/8/6RK w - - 0 1", { theme: "ladder", expected: ["Tg8#"] }),
    sample("mate.ladder.black", "1r4k1/8/8/8/8/8/r7/7K b - - 0 1", { theme: "ladder", expected: ["Tb1#"] }),
    sample("mate.fool", "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", { theme: "fool", expected: ["Dh4#"] }),
    sample("mate.fool.white", "rnbqkbnr/ppppp2p/5p2/6p1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", { theme: "fool", expected: ["Dh5#"] }),
]

// Unit 6: values and exchanges

// The side to move can capture in several ways; `expected` is the capture that wins the most.
export const captureChoices: ChessSample[] = [
    sample("cap.queenFree", "4k3/8/8/1p1q4/8/8/4B3/3RK3 w - - 0 1", { theme: "free", expected: ["Txd5"] }),
    sample("cap.rookOrBishop", "4k3/8/8/2b1r3/8/3N4/8/7K w - - 0 1", { theme: "free", expected: ["Sxe5"] }),
    sample("cap.pawnTakes", "4k3/8/2p5/3n4/4P3/8/8/3RK3 w - - 0 1", { theme: "pawn", expected: ["exd5"] }),
    sample("cap.queenTrap", "4k3/8/2p5/3p4/8/5b2/8/3QK3 w - - 0 1", { theme: "trap", expected: ["Dxf3"] }),
    sample("cap.black.pawn", "3rk3/8/8/4p3/3N4/2P5/8/4K3 b - - 0 1", { theme: "pawn", expected: ["exd4"] }),
    sample("cap.black.trap", "3qk3/8/5B2/8/3P4/2P5/8/4K3 b - - 0 1", { theme: "trap", expected: ["Dxf6"] }),
]

// A capture (`detail`, like "d1d5") whose result is judged: wins material, even, or loses material.
export const trades: ChessSample[] = [
    sample("trade.free", "4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1", { detail: "d1d5", theme: "win" }),
    sample("trade.queenPawn", "4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1", { detail: "d1d5", theme: "lose" }),
    sample("trade.knights", "4k3/8/2p5/3n4/8/4N3/8/4K3 w - - 0 1", { detail: "e3d5", theme: "even" }),
    sample("trade.rookForBishop", "4k3/8/4b3/3n4/8/8/8/3RK3 w - - 0 1", { detail: "d1d5", theme: "lose" }),
    sample("trade.bishopForRook", "4k3/8/2n5/8/3r4/2B5/8/4K3 w - - 0 1", { detail: "c3d4", theme: "win" }),
    sample("trade.pawns", "4k3/8/2p5/3p4/4P3/8/8/4K3 w - - 0 1", { detail: "e4d5", theme: "even" }),
    sample("trade.pawnForKnight", "4k3/8/2p5/3n4/4P3/8/8/4K3 w - - 0 1", { detail: "e4d5", theme: "win" }),
    sample("trade.black.queen", "4k3/8/8/8/8/3q4/3P4/4K3 b - - 0 1", { detail: "d3d2", theme: "lose" }),
]

// Positions to count the material of; both sides have pieces to add up.
export const materialCounts: ChessSample[] = [
    sample("count.1", "r3k3/ppp2ppp/8/8/8/8/PP3PPP/2R1K1N1 w - - 0 1", { theme: "count" }),
    sample("count.2", "2kr4/ppp2ppp/2n5/8/8/2N5/PPP2PPP/3RK3 w - - 0 1", { theme: "count" }),
    sample("count.3", "4k3/pp3p2/8/8/8/8/PPPQ4/4K3 w - - 0 1", { theme: "count" }),
    sample("count.4", "3qk3/ppp2ppp/8/8/8/8/PPP2PPP/3RKB2 w - - 0 1", { theme: "count" }),
    sample("count.5", "r1b1k3/ppp2ppp/8/8/8/8/PPP2PPP/R3KB2 w - - 0 1", { theme: "count" }),
    sample("count.6", "4k3/8/8/3b4/3n4/8/2PPP3/2B1K3 w - - 0 1", { theme: "count" }),
]

// Squares that both sides attack; `focus` is the square, usually with a piece on it.
export const contests: ChessSample[] = [
    sample("contest.1", "4k3/8/2p5/3n4/8/2N1N3/8/3RK3 w - - 0 1", { focus: "d5", theme: "contest" }),
    sample("contest.2", "4k3/8/4p3/3p4/2B1P3/8/8/3RK3 w - - 0 1", { focus: "d5", theme: "contest" }),
    sample("contest.3", "4k3/3r4/8/3p4/8/8/3R4/3QK3 w - - 0 1", { focus: "d5", theme: "contest" }),
    sample("contest.4", "4k3/8/5p2/4n3/3P4/8/8/4RK2 w - - 0 1", { focus: "e5", theme: "contest" }),
    sample("contest.5", "4k3/8/8/4b3/8/5N2/4R3/4K3 w - - 0 1", { focus: "e5", theme: "contest" }),
]

// Unit 8: tactics

// Forks: one move attacks two pieces at once; `expected` is the one best move.
export const forks: ChessSample[] = [
    sample("fork.knight.rook", "r3k3/pp3ppp/8/1N6/8/8/PP3PPP/6K1 w - - 0 1", { theme: "fork", expected: ["Sc7+"] }),
    sample("fork.knight.queen", "q3k3/pp3ppp/8/1N6/8/8/PP3PPP/6K1 w - - 0 1", { theme: "fork", expected: ["Sc7+"] }),
    sample("fork.knight.black", "6k1/pp3ppp/8/8/1n6/8/PP3PPP/R3K3 b - - 0 1", { theme: "fork", expected: ["Sc2+"] }),
    sample("fork.pawn", "4k3/pp3ppp/8/2n1b3/8/3P4/PP3PPP/3QK3 w - - 0 1", { theme: "fork", expected: ["d4"] }),
    sample("fork.pawn.black", "3qk3/pp3ppp/3p4/8/2N1B3/8/PP3PPP/4K3 b - - 0 1", { theme: "fork", expected: ["d5"] }),
    sample("fork.queen", "r5k1/6pp/8/8/8/8/PP3PPP/3Q2K1 w - - 0 1", { theme: "fork", expected: ["Dd5+"] }),
    sample("fork.queen.black", "3q2k1/pp3ppp/8/8/8/8/6PP/R5K1 b - - 0 1", { theme: "fork", expected: ["Dd4+"] }),
]

// Pins: an attacked piece may not leave its line; `expected` is the one best move.
export const pins: ChessSample[] = [
    sample("pin.bishop.knight", "4k3/pp3ppp/2n5/1B6/3P4/8/PP3PPP/4K3 w - - 0 1", { theme: "pin", expected: ["d5"] }),
    sample("pin.bishop.knight.black", "4k3/pp3ppp/8/3p4/1b6/2N5/PP3PPP/4K3 b - - 0 1", { theme: "pin", expected: ["d4"] }),
    sample("pin.rook.bishop", "4k3/pp2bppp/8/3P4/8/8/PP3PPP/4R1K1 w - - 0 1", { theme: "pin", expected: ["d6"] }),
    sample("pin.rook.bishop.black", "4r1k1/pp3ppp/8/8/3p4/8/PP2BPPP/4K3 b - - 0 1", { theme: "pin", expected: ["d3"] }),
    sample("pin.rook.knight", "4k3/3p4/4n3/8/3P4/8/4R3/4K3 w - - 0 1", { theme: "pin", expected: ["d5"] }),
    sample("pin.rook.knight.black", "4k3/4r3/8/3p4/8/4N3/3P4/4K3 b - - 0 1", { theme: "pin", expected: ["d4"] }),
]

// Skewers: a valuable piece on a line must move and exposes the piece behind it; `expected` is the best move.
export const skewers: ChessSample[] = [
    sample("skewer.rook.bishop", "4b3/p4ppp/8/4k3/8/8/PP3PPP/3R2K1 w - - 0 1", { theme: "skewer", expected: ["Te1+"] }),
    sample("skewer.rook.queen", "4q3/p4ppp/8/4k3/8/8/PP3PPP/3R2K1 w - - 0 1", { theme: "skewer", expected: ["Te1+"] }),
    sample("skewer.rook.queen.black", "3r2k1/pp3ppp/8/8/4K3/8/P4PPP/4Q3 b - - 0 1", { theme: "skewer", expected: ["Te8+"] }),
    sample("skewer.bishop.rook", "6r1/p5pp/4k3/8/8/8/PP3PPP/3B2K1 w - - 0 1", { theme: "skewer", expected: ["Lb3+"] }),
    sample("skewer.bishop.queen", "6q1/p5pp/4k3/8/8/8/PP3PPP/3B2K1 w - - 0 1", { theme: "skewer", expected: ["Lb3+"] }),
    sample("skewer.bishop.black", "3b2k1/pp3ppp/8/8/8/4K3/P5PP/6R1 b - - 0 1", { theme: "skewer", expected: ["Lb6+"] }),
]

// Discovered attacks: a piece moves away and uncovers an attack of another piece; `expected` is the best move.
export const discovered: ChessSample[] = [
    sample("disc.bishop", "rr2k3/pp3ppp/8/4B3/8/8/PP3PPP/4R1K1 w - - 0 1", { theme: "discovered", expected: ["Lxb8+"] }),
    sample("disc.bishop.black", "4r1k1/pp3ppp/8/8/4b3/8/PP3PPP/RR2K3 b - - 0 1", { theme: "discovered", expected: ["Lxb1+"] }),
    sample("disc.knight", "4k3/8/8/2r5/4N3/8/8/4R1K1 w - - 0 1", { theme: "discovered", expected: ["Sxc5+"] }),
    sample("disc.knight.black", "4r1k1/8/8/4n3/2R5/8/8/4K3 b - - 0 1", { theme: "discovered", expected: ["Sxc4+"] }),
]

// A piece hangs: it is attacked and nothing guards it. `expected` is the capture that wins the most.
export const hanging: ChessSample[] = [
    sample("hang.bishop", "4k3/pp3ppp/2n5/3b4/8/2N5/PP3PPP/4K3 w - - 0 1", { focus: "d5", theme: "hang", expected: ["Sxd5"] }),
    sample("hang.bishop.black", "4k3/pp3ppp/2n5/8/3B4/2N5/PP3PPP/4K3 b - - 0 1", { focus: "d4", theme: "hang", expected: ["Sxd4"] }),
    sample("hang.knight", "r4rk1/ppp2ppp/8/8/3n4/5N2/PPP2PPP/R4RK1 w - - 0 1", { focus: "d4", theme: "hang", expected: ["Sxd4"] }),
    sample("hang.knight.black", "r4rk1/ppp2ppp/5n2/3N4/8/8/PPP2PPP/R4RK1 b - - 0 1", { focus: "d5", theme: "hang", expected: ["Sxd5"] }),
    sample("hang.bishop.pawn", "6k1/5ppp/8/3b4/4P3/8/5PPP/6K1 w - - 0 1", { focus: "d5", theme: "hang", expected: ["exd5"] }),
    sample("hang.pawn.black", "6k1/5ppp/8/4p3/3B4/8/5PPP/6K1 b - - 0 1", { focus: "d4", theme: "hang", expected: ["exd4"] }),
]

/** Every pool in one list, for the tests that must see each authored position. */
export const allSamples: ChessSample[] = [
  ...nameMoves, ...pieceMoves, ...crowded, ...pawns, ...enPassant, ...promotions, ...inCheck, ...notInCheck, ...singleAnswer, ...mated,
  ...stalemates, ...goesOn, ...materialEnds, ...castling, ...classify, ...mates, ...captureChoices, ...trades, ...materialCounts,
  ...contests, ...forks, ...pins, ...skewers, ...discovered, ...hanging,
];
