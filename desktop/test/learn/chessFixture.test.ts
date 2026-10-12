// The TypeScript engine against the Swift engine: content/fixtures/chess-engine.json holds, for every curated position of
// ChessSamples.swift and every FEN of the Swift chess tests, what Swift computes (legal moves in generator order,
// notation, flags, goals, search results, tactics). Regenerate with the throw-away exporter described in the repo notes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ChessExchange,
  ChessPosition,
  ChessTactics,
  acceptedMoves,
  allSAN,
  bestMoves,
  moveUci,
  scoredMoves,
  squareName,
  valueOf,
  type ChessColor,
} from '../../src/lib/learn/chess';

interface Entry {
  input: string;
  valid: boolean;
  sources: string[];
  fen?: string;
  legal?: string[];
  san?: string[];
  isCheck?: boolean;
  isCheckmate?: boolean;
  isStalemate?: boolean;
  insufficientMaterial?: boolean;
  problems?: string[];
  material?: number[];
  perft2?: number;
  mateInOne?: string[];
  captures?: { move: string; gain: number }[];
  bestCapture?: string[];
  bestMoves?: Record<string, { moves: string[]; score: number }>;
  scored2?: { move: string; score: number }[];
  value3?: number;
  tactics?: Record<string, { pins: string[][]; lineUps: string[][]; hanging: string[] }>;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../content/fixtures/chess-engine.json'), 'utf8'),
) as { positions: Entry[] };

describe('chess engine parity with Swift', () => {
  it('has the curated positions and the test FENs', () => {
    expect(fixture.positions.length).toBeGreaterThan(200);
    expect(fixture.positions.filter((e) => !e.valid).length).toBeGreaterThan(0);
  });

  it('rejects the FENs that Swift rejects', () => {
    for (const entry of fixture.positions.filter((e) => !e.valid)) {
      expect(ChessPosition.fromFen(entry.input), entry.input).toBeNull();
    }
  });

  it('matches Swift on every position (moves, flags, notation, goals, tactics)', () => {
    for (const entry of fixture.positions.filter((e) => e.valid)) {
      const label = `${entry.input} [${entry.sources[0]}]`;
      const position = ChessPosition.fromFen(entry.input);
      expect(position, label).not.toBeNull();
      const p = position!;
      expect(p.fen, label).toBe(entry.fen);
      const legal = p.legalMoves();
      expect(legal.map(moveUci), `legal moves of ${label}`).toEqual(entry.legal);
      expect(allSAN(p).map((e) => e.san), `san of ${label}`).toEqual(entry.san);
      expect(p.isCheck, label).toBe(entry.isCheck);
      expect(p.isCheckmate, label).toBe(entry.isCheckmate);
      expect(p.isStalemate, label).toBe(entry.isStalemate);
      expect(p.hasInsufficientMaterial, label).toBe(entry.insufficientMaterial);
      expect(p.validationProblems(), label).toEqual(entry.problems);
      expect([p.material('white'), p.material('black')], label).toEqual(entry.material);
      expect(p.perft(2), label).toBe(entry.perft2);
      expect(acceptedMoves({ type: 'mateInOne' }, p).map(moveUci), `mate in one of ${label}`).toEqual(entry.mateInOne);
      expect(
        ChessExchange.captures(p).map((c) => ({ move: moveUci(c.move), gain: c.gain })),
        `captures of ${label}`,
      ).toEqual(entry.captures);
      expect(acceptedMoves({ type: 'bestCapture' }, p).map(moveUci), `best capture of ${label}`).toEqual(entry.bestCapture);
      for (const colorName of ['white', 'black'] as ChessColor[]) {
        const expected = entry.tactics![colorName];
        expect(
          ChessTactics.absolutePins(colorName, p).map((x) => [squareName(x.pinned), squareName(x.pinner)]),
          `pins ${colorName} ${label}`,
        ).toEqual(expected.pins);
        expect(
          ChessTactics.lineUps(colorName, p).map((x) => [squareName(x.attacker), squareName(x.front), squareName(x.back)]),
          `line-ups ${colorName} ${label}`,
        ).toEqual(expected.lineUps);
        expect(ChessTactics.hangingPieces(colorName, p).map(squareName), `hanging ${colorName} ${label}`).toEqual(expected.hanging);
      }
    }
  });

  it('matches Swift on the search (best moves at depth 1 to 3, scored moves, values)', () => {
    for (const entry of fixture.positions.filter((e) => e.valid)) {
      const label = `${entry.input} [${entry.sources[0]}]`;
      const p = ChessPosition.fromFen(entry.input)!;
      for (const depth of [1, 2, 3]) {
        const result = bestMoves(p, depth);
        const expected = entry.bestMoves![String(depth)];
        expect({ moves: result.moves.map(moveUci), score: result.score }, `best moves depth ${depth} of ${label}`).toEqual(expected);
      }
      expect(scoredMoves(p, 2).map((s) => ({ move: moveUci(s.move), score: s.score })), `scored depth 2 of ${label}`).toEqual(entry.scored2);
      expect(valueOf(p, 3), `value depth 3 of ${label}`).toBe(entry.value3);
    }
  }, 120_000);
});
