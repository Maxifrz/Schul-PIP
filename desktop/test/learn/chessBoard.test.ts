import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChessBoard, placementOf, sideToMoveOf } from '../../src/views/learn/ChessBoard';
import { startFEN } from '../../src/lib/learn/chess/position';

const spec = { fen: startFEN, flipped: false, marked: [] as string[] };

describe('the chess board view', () => {
  it('reads the pieces of a FEN', () => {
    const pieces = placementOf(startFEN);
    expect(Object.keys(pieces)).toHaveLength(32);
    expect(pieces.e1).toBe('K');
    expect(pieces.d8).toBe('q');
    expect(sideToMoveOf(startFEN)).toBe('Weiß');
    expect(sideToMoveOf('8/8/8/8/8/8/8/8 b - - 0 1')).toBe('Schwarz');
  });

  it('draws 64 squares with White at the bottom, or turned for Black', () => {
    const html = renderToStaticMarkup(h(ChessBoard, { spec: { ...spec, marked: ['e4'] } }));
    expect((html.match(/ln-sq /g) ?? []).length).toBe(64);
    expect(html.indexOf('a8, schwarzer Turm')).toBeLessThan(html.indexOf('a1, weißer Turm'));
    expect(html).toContain('ln-sq-ring');
    const turned = renderToStaticMarkup(h(ChessBoard, { spec: { ...spec, flipped: true } }));
    expect(turned.indexOf('h1, weißer Turm')).toBeLessThan(turned.indexOf('h8, schwarzer Turm'));
  });

  it('makes the squares buttons only when they can be tapped', () => {
    expect(renderToStaticMarkup(h(ChessBoard, { spec }))).not.toContain('<button');
    const tappable = renderToStaticMarkup(h(ChessBoard, { spec, onTap: () => {}, from: 'e2' }));
    expect((tappable.match(/<button/g) ?? []).length).toBe(64);
  });

  it('shows the right answer after a wrong move', () => {
    const html = renderToStaticMarkup(h(ChessBoard, { spec, from: 'e2', to: 'e5', correctMoves: ['e2e4'], verdict: 'wrong' }));
    expect(html).toContain('wrong');
    expect(html).toContain('answer');
  });
});
