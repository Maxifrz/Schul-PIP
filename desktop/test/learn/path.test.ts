import { describe, expect, it } from 'vitest';
import { LearnPath, snapshot, stableHash, cardKey } from '../../src/lib/learn/cards';
import { start } from './helpers';

const materialA = '00000000-0000-0000-0000-00000000000A';
const materialB = '00000000-0000-0000-0000-00000000000B';

const cards = (count: number, material: string | null, from = 0) =>
  Array.from({ length: count }, (_, i) => snapshot(`Frage ${from + i}`, `Antwort ${from + i}`, material, start + (from + i) * 60_000, start));

describe('LearnPath', () => {
  it('lessons hold up to six cards and a small last lesson joins the one before', () => {
    const sizes = (count: number) => LearnPath.chunk(cards(count, null)).map((c) => c.length);
    expect(sizes(0)).toEqual([]);
    expect(sizes(3)).toEqual([3]);
    expect(sizes(6)).toEqual([6]);
    expect(sizes(7)).toEqual([7]);
    expect(sizes(9)).toEqual([9]);
    expect(sizes(10)).toEqual([6, 4]);
    expect(sizes(12)).toEqual([6, 6]);
    expect(sizes(13)).toEqual([6, 7]);
    expect(sizes(16)).toEqual([6, 6, 4]);
  });

  it('groups cards by material in creation order', () => {
    const a = cards(3, materialA, 10);
    const b = cards(2, materialB, 0);
    const loose = cards(2, null, 5);
    const units = LearnPath.units([...a, ...loose, ...b].reverse(), new Set());
    expect(units.map((u) => u.id)).toEqual([materialB, LearnPath.otherUnitID, materialA]);
    expect(units[2].lessons.flatMap((l) => l.cards).map((c) => c.front)).toEqual(['Frage 10', 'Frage 11', 'Frage 12']);
    expect(units[1].materialID).toBeNull();
  });

  it('a lesson opens once the one before is done', () => {
    const deck = [...cards(18, materialA), ...cards(6, materialB, 100)];
    let units = LearnPath.units(deck, new Set());
    expect(units[0].lessons.map((l) => l.state)).toEqual(['open', 'locked', 'locked']);
    expect(units[1].lessons.map((l) => l.state)).toEqual(['open']);
    const first = units[0].lessons[0].id;
    units = LearnPath.units(deck, new Set([first]));
    expect(units[0].lessons.map((l) => l.state)).toEqual(['done', 'open', 'locked']);
    expect(LearnPath.nextOpenLesson(units)?.id).toBe(units[0].lessons[1].id);
    units = LearnPath.units(deck, new Set([first, units[0].lessons[1].id]));
    expect(units[0].lessons.map((l) => l.state)).toEqual(['done', 'done', 'open']);
    expect(LearnPath.lesson(first, units)?.state).toBe('done');
  });

  it('lesson ids come from the cards, so a changed lesson is new', () => {
    const deck = cards(5, null);
    const id = LearnPath.units(deck, new Set())[0].lessons[0].id;
    expect(LearnPath.units([...deck].reverse(), new Set())[0].lessons[0].id).toBe(id);
    expect(id).toBe(LearnPath.lessonID(deck.map((c) => c.key)));
    const grown = LearnPath.units([...deck, ...cards(1, null, 5)], new Set([id]))[0].lessons[0];
    expect(grown.id).not.toBe(id);
    expect(grown.state).toBe('open');
    const edited = [...deck];
    edited[0] = snapshot(edited[0].front, 'Neue Antwort', null, edited[0].createdAt, edited[0].dueDate);
    expect(LearnPath.units(edited, new Set([id]))[0].lessons[0].id).not.toBe(id);
  });

  it('card keys are stable and distinct', () => {
    const first = snapshot('A', 'B', materialA, start, start);
    const again = snapshot('A', 'B', materialA, start, start + 999_000);
    expect(first.key).toBe(again.key);
    expect(first.key).toBe(cardKey('A', 'B', materialA, start));
    expect(first.key).toHaveLength(17);
    expect(new Set(cards(50, materialA).map((c) => c.key)).size).toBe(50);
    expect(first.key).not.toBe(snapshot('A', 'B', null, start, start).key);
    expect(stableHash('')).toBe('cbf29ce484222325');
  });

  it('the same card twice appears once', () => {
    const deck = cards(4, null);
    expect(LearnPath.units([...deck, ...deck], new Set())[0].lessons.flatMap((l) => l.cards)).toHaveLength(4);
  });

  it('knows which cards are due', () => {
    const due = snapshot('A', 'B', null, start, start);
    const later = snapshot('C', 'D', null, start, start + 60_000);
    expect(LearnPath.dueKeys([due, later], start)).toEqual(new Set([due.key]));
  });
});
