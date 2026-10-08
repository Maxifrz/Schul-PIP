import { describe, expect, it } from 'vitest';
import { Block, Board, Poll, flashcards, resultHtml, resultText, reviewPrompt, sections, shares, stats, suggestTemplate, templateKinds, dateLabel, kindFrom } from '../src/lib/social/board';
import { camelize } from '../src/lib/social/models';

const board: Board = {
  id: 'b', groupId: 'g', title: 'Integralrechnung', topic: 'Bestimmtes Integral', template: 'math', lessonDate: '2026-10-08',
  status: 'open', createdBy: 'anna', finalizedAt: null, createdAt: '',
};

function block(kind: string, title: string, body: string, status: Block['status'] = 'accepted', position = 0, author = 'anna'): Block {
  return {
    id: `${kind}-${title}-${position}`, boardId: 'b', kind, title, body, attachmentPath: null, status, position, author,
    replacesBlock: null, rev: 1, createdAt: `2026-10-08T08:0${position}+00:00`, updatedAt: '', profiles: null,
  };
}

describe('board logic (same cases as the Swift tests)', () => {
  it('orders sections by template and leaves out proposals', () => {
    const blocks = [
      block('example', 'Beispiel', '∫₀² x² dx = 8/3', 'accepted', 4),
      block('definition', 'Bestimmtes Integral', 'Flächenbilanz', 'accepted', 1),
      block('formula', 'Hauptsatz', '∫ₐᵇ f(x) dx = F(b) − F(a)', 'accepted', 2),
      block('rule', 'Merke', 'Grenzen einsetzen', 'proposed'),
      block('definition', 'Zweite Definition', '…', 'accepted', 3),
    ];
    const result = sections('math', blocks);
    expect(result.map((s) => s.kind)).toEqual(['definition', 'formula', 'example']);
    expect(result[0].blocks.map((b) => b.title)).toEqual(['Bestimmtes Integral', 'Zweite Definition']);
  });

  it('puts a kind outside the template last', () => {
    expect(sections('math', [block('event', '1789', '…'), block('definition', 'x', 'y')]).map((s) => s.kind)).toEqual(['definition', 'event']);
  });

  it('counts contributions and people', () => {
    expect(stats([block('definition', 'a', 'b'), block('formula', 'a', 'b', 'proposed', 0, 'ben'), block('rule', 'a', 'b', 'rejected', 0, 'ben')])).toEqual({
      contributions: 3, accepted: 1, open: 1, rejected: 1, people: 2,
    });
  });

  it('computes poll shares', () => {
    const poll: Poll = { id: 'p', boardId: 'b', question: '?', status: 'open', winner: null, createdAt: '', pollOptions: [{ blockId: 'x' }, { blockId: 'y' }, { blockId: 'z' }] };
    expect(shares(poll, []).total).toBe(0);
    const result = shares(poll, [{ pollId: 'p', blockId: 'x', votes: 8 }, { pollId: 'p', blockId: 'y', votes: 16 }, { pollId: 'p', blockId: 'z', votes: 1 }]);
    expect(result.total).toBe(25);
    expect([result.percent.x, result.percent.y, result.percent.z]).toEqual([32, 64, 4]);
    expect(shares(poll, [{ pollId: 'other', blockId: 'x', votes: 99 }]).total).toBe(0);
  });

  it('writes the result as text', () => {
    const text = resultText(board, 'Mathe LK', [
      block('definition', 'Bestimmtes Integral', 'Flächenbilanz zwischen zwei Grenzen', 'accepted', 1),
      block('formula', 'Hauptsatz', '∫ₐᵇ f(x) dx = F(b) − F(a)', 'accepted', 2, 'ben'),
    ]);
    expect(text.startsWith('INTEGRALRECHNUNG\nMathe LK · 08.10.2026\nBestimmtes Integral')).toBe(true);
    expect(text).toContain('\nDEFINITION\nBestimmtes Integral\nFlächenbilanz');
    expect(text).toContain('\nFORMEL\nHauptsatz\n∫ₐᵇ');
    expect(text.endsWith('2 Beiträge übernommen, 2 Beteiligte')).toBe(true);
  });

  it('makes flashcards from definitions and formulas only', () => {
    const cards = flashcards(board, [
      block('definition', 'Bestimmtes Integral', 'Flächenbilanz', 'accepted', 1),
      block('formula', '', 'F(b) − F(a)', 'accepted', 2),
      block('example', 'Beispiel', '8/3', 'accepted', 3),
      block('question', 'Warum negativ?', '', 'accepted', 4),
      block('rule', 'Merke', '   ', 'accepted', 5),
    ]);
    expect(cards).toEqual([
      { front: 'Definition: Bestimmtes Integral', back: 'Flächenbilanz' },
      { front: 'Formel zu „Integralrechnung“', back: 'F(b) − F(a)' },
    ]);
  });

  it('fits templates to subject names', () => {
    expect(suggestTemplate('Mathe LK')).toBe('math');
    expect(suggestTemplate('Chemie GK 12')).toBe('chemistry');
    expect(suggestTemplate('Geschichte')).toBe('history');
    expect(suggestTemplate('Biologie')).toBe('biology');
    expect(suggestTemplate('Kunst')).toBe('general');
    expect(templateKinds('chemistry').slice(0, 4)).toEqual(['observation', 'interpretation', 'equation', 'result']);
  });

  it('has labels and falls back for unknown kinds', () => {
    expect(dateLabel(board)).toBe('08.10.2026');
    expect(kindFrom('gibtsnicht')).toBe('text');
  });

  it('builds the review prompt and a printable page', () => {
    const blocks = [block('definition', 'Integral', 'Fläche <b>')];
    expect(reviewPrompt(board, 'Mathe LK', blocks)).toContain('Schreib das Ergebnis nicht um');
    const html = resultHtml(board, 'Mathe LK', blocks);
    expect(html).toContain('Fläche &lt;b&gt;');
    expect(html).toContain('<h1>Integralrechnung</h1>');
  });

  it('reads the server rows', () => {
    const rows = camelize<Block[]>([{ id: '1', board_id: '2', kind: 'formula', attachment_path: null, profiles: { display_name: 'Anna' } }]);
    expect(rows[0].boardId).toBe('2');
    expect(rows[0].profiles?.displayName).toBe('Anna');
  });
});
