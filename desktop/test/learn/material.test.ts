import { describe, expect, it } from 'vitest';
import { MaterialPath, pagesLabel, firstPage, maxChunkCharacters, maxChunksPerRun, parseFlashcards, Flashcard } from '../../src/lib/learn/materialPath';
import { MaterialCourse } from '../../src/lib/learn/materialCourse';
import { LearnPath, snapshot } from '../../src/lib/learn/cards';
import { CoursePath, courseNodes, structureProblems } from '../../src/lib/learn/course';
import { start } from './helpers';

const page = (n: number, length = 200) => `Seite ${n}: ${'Text über die Zelle. '.repeat(Math.floor(length / 21) + 1)}`;

describe('MaterialPath', () => {
  it('pages are cut into stretches of about three pages', () => {
    const chunks = MaterialPath.chunks(Array.from({ length: 8 }, (_, i) => page(i + 1, 1900)));
    expect(chunks.map((c) => c.pages)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8]]);
    expect(pagesLabel(chunks[0])).toBe('S. 1–3');
    expect(firstPage(chunks[2])).toBe(7);
    expect(chunks[0].text.startsWith('--- Page 1 ---\nSeite 1')).toBe(true);
    expect(chunks[0].text).toContain('--- Page 3 ---');
    expect(chunks.every((c) => c.text.length <= maxChunkCharacters + 200)).toBe(true);
  });

  it('picture pages end a stretch and are skipped', () => {
    const chunks = MaterialPath.chunks([page(1), page(2), '', 'Abb. 3', page(5), page(6)]);
    expect(chunks.map((c) => c.pages)).toEqual([[1, 2], [5, 6]]);
    expect(pagesLabel(chunks[1])).toBe('S. 5–6');
    expect(MaterialPath.chunks([])).toEqual([]);
    expect(MaterialPath.chunks(['', ' ', 'x'])).toEqual([]);
  });

  it('a huge page is clipped, not dropped', () => {
    const chunks = MaterialPath.chunks(['a '.repeat(20_000), page(2)]);
    expect(chunks.map((c) => c.pages)).toEqual([[1], [2]]);
    expect(chunks[0].text.length).toBeLessThanOrEqual(maxChunkCharacters + 40);
  });

  it('only stretches without cards are asked for', () => {
    const chunks = MaterialPath.chunks(Array.from({ length: 6 }, (_, i) => page(i + 1, 1900)));
    expect(MaterialPath.stretchesWithoutCards(chunks, new Set([1])).map(firstPage)).toEqual([4]);
    expect(MaterialPath.stretchesWithoutCards(chunks, new Set())).toHaveLength(2);
    expect(MaterialPath.stretchesWithoutCards(chunks, new Set([3, 4]))).toHaveLength(0);
  });

  it('fresh cards drop empty and known questions', () => {
    const written: Flashcard[] = [
      { front: 'Was ist die Zelle?', back: 'Die kleinste Einheit des Lebens.' }, { front: 'was ist die zelle', back: 'Doppelt.' }, { front: '  ', back: 'leer' },
      { front: 'Was ist der Zellkern?', back: ' ' }, { front: 'Wo sitzt die DNA?', back: 'Im Zellkern.' },
    ];
    expect(MaterialPath.fresh(written, ['Wo sitzt die DNA?'], 4)).toEqual([{ front: 'Was ist die Zelle?', back: 'Die kleinste Einheit des Lebens.', page: 4 }]);
  });

  it('a run asks stretch by stretch and keeps what came before an error', async () => {
    const replies: Array<Flashcard[] | Error> = [
      [{ front: 'A?', back: 'a' }, { front: 'B?', back: 'b' }], [{ front: 'A?', back: 'again' }, { front: 'C?', back: 'c' }], new Error('zu viele Anfragen'),
    ];
    const requests: Array<{ label: string; pages: string }> = [];
    const steps: number[] = [];
    const outcome = await MaterialPath.generate({
      title: 'Biologie', pageTexts: Array.from({ length: 12 }, (_, i) => page(i + 1, 1900)), cardPages: new Set(), existingFronts: ['Z?'],
      writer: async (_t, label, pages) => { requests.push({ label, pages }); const r = replies[Math.min(requests.length - 1, replies.length - 1)]; if (r instanceof Error) throw r; return r; },
      progress: (done) => steps.push(done),
    });
    expect(outcome.cards.map((c) => c.front)).toEqual(['A?', 'B?', 'C?']);
    expect(outcome.cards.map((c) => c.page)).toEqual([1, 1, 4]);
    expect(outcome.done).toBe(2);
    expect(outcome.remaining).toBe(2);
    expect(outcome.failure).not.toBeNull();
    expect(steps).toEqual([0, 1, 2]);
    expect(requests).toHaveLength(3);
    expect(requests[0].label).toBe('S. 1–3');
    expect(requests[0].pages.startsWith('<pages S. 1–3>\n--- Page 1 ---')).toBe(true);
  });

  it('a run stops at the limit and says how much is left', async () => {
    const outcome = await MaterialPath.generate({
      title: 'Lang', pageTexts: Array.from({ length: 60 }, (_, i) => page(i + 1, 1900)), cardPages: new Set(), existingFronts: [],
      writer: async () => [{ front: 'Frage?', back: 'Antwort' }],
    });
    expect(outcome.done).toBe(maxChunksPerRun);
    expect(outcome.remaining).toBe(20 - maxChunksPerRun);
    expect(outcome.failure).toBeNull();
    expect(outcome.cards).toHaveLength(1);
  });

  it('nothing to do without text', async () => {
    let calls = 0;
    const outcome = await MaterialPath.generate({ title: 'Scan', pageTexts: ['', ''], cardPages: new Set(), existingFronts: [], writer: async () => { calls++; return []; } });
    expect(outcome).toEqual({ cards: [], done: 0, remaining: 0, failure: null });
    expect(calls).toBe(0);
  });

  it('parses the model answer', () => {
    expect(parseFlashcards('Hier: {"cards":[{"front":"A?","back":"a"},{"front":1,"back":"x"}]} Ende')).toEqual([{ front: 'A?', back: 'a' }]);
    expect(() => parseFlashcards('kein json')).toThrow();
    expect(() => parseFlashcards('{"cards":[]}')).toThrow();
  });
});

describe('MaterialCourse', () => {
  const cards = Array.from({ length: 13 }, (_, i) => snapshot(`F${i}`, `A${i}`, 'mat1', start + i * 1000, start));
  const unit = LearnPath.units(cards, new Set())[0];

  it('shows the lessons as a course with a chest and keeps their ids', () => {
    const course = MaterialCourse.course(unit, 'Biologie');
    expect(course.id).toBe('material.mat1');
    const nodes = courseNodes(course);
    expect(nodes.map((n) => n.kind)).toEqual(['lesson', 'lesson', 'chest']);
    expect(nodes[0].id).toBe(unit.lessons[0].id);
    expect(MaterialCourse.isMaterialCourse(course.id)).toBe(true);
    expect(MaterialCourse.isMaterialCourse('es')).toBe(false);
    expect(structureProblems({ course, exercises: () => [] }).filter((p) => !p.includes('checkpoint') && !p.includes('start with the course id'))).toEqual([]);
    expect(MaterialCourse.lesson(nodes[1], unit)?.id).toBe(unit.lessons[1].id);
    const path = CoursePath.units(course, new Set([nodes[0].id]));
    expect(path[0].steps.map((s) => s.state)).toEqual(['done', 'open', 'locked']);
    expect(course.sections[0].units[0].summary).toBe('13 Karten in 2 Lektionen');
  });
});
