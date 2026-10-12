// Compares a ported course with what the Swift engines build (content/fixtures/courses/<id>.json, written by
// scripts/learn-swift/export.sh): structure, skill map, and every exercise of every step for the exported seeds.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import type { CourseProvider } from '../../src/lib/learn/course';
import type { LearnExercise } from '../../src/lib/learn/exercise';
import { lessonExercises, skillMap } from '../../src/lib/learn/skills/skill';

const folder = resolve(__dirname, '../../../content/fixtures/courses');

/** An exercise in the shape of the Swift export. */
export function flatten(e: LearnExercise): Record<string, unknown> {
  let media: unknown = null;
  const m = e.media;
  if (m) {
    switch (m.type) {
      case 'speech': media = { type: 'speech', text: m.text, language: m.language }; break;
      case 'board': media = { type: 'board', fen: m.board.fen, flipped: m.board.flipped, marked: m.board.marked }; break;
      case 'tones': media = { type: 'tones', midi: m.tones.midi, together: m.tones.together }; break;
      case 'staff':
        media = {
          type: 'staff', clef: m.staff.clef, keySignature: m.staff.keySignature, time: m.staff.time, chord: m.staff.chord,
          notes: m.staff.notes.map((n) => ({
            letter: n.pitch.letter, octave: n.pitch.octave, alteration: n.pitch.alteration, value: n.value, rest: n.isRest,
          })),
        };
        break;
    }
  }
  return {
    id: e.id, kind: e.kind, cardKeys: e.cardKeys, prompt: e.prompt, correctAnswers: e.correctAnswers, options: e.options,
    pairs: e.pairs.map((p) => ({ key: p.key, front: p.front, back: p.back })), solution: e.solution, media, mode: e.mode,
    explanation: e.explanation, skill: e.skill, level: e.level, hints: e.hints, coach: e.coach,
  };
}

interface Fixture {
  course: string; title: string; subtitle: string; kind: string; color: number; symbol: string;
  sections: Array<{ id: string; title: string; units: Array<{ id: string; number: number; title: string; summary: string; tip: string; nodes: Array<{ id: string; kind: string; index: number; title: string }> }> }>;
  skills: Array<{ id: string; title: string; goal: string; levels: string[]; prerequisites: string[]; nodeIDs: string[] }>;
  nodes: Array<{ id: string; runs: Array<{ seed: number; exercises: Array<Record<string, unknown>> }> }>;
}

export function loadFixture(courseID: string): Fixture {
  return JSON.parse(readFileSync(resolve(folder, `${courseID}.json`), 'utf8')) as Fixture;
}

/** Structure and skill map (cheap). */
export function expectStructureMatches(provider: CourseProvider): void {
  const fixture = loadFixture(provider.course.id);
  const c = provider.course;
  expect({ id: c.id, title: c.title, subtitle: c.subtitle, kind: c.kind, color: c.color, symbol: c.symbol }).toEqual({
    id: fixture.course, title: fixture.title, subtitle: fixture.subtitle, kind: fixture.kind, color: fixture.color, symbol: fixture.symbol,
  });
  expect(
    c.sections.map((s) => ({ id: s.id, title: s.title, units: s.units.map((u) => ({
      id: u.id, number: u.number, title: u.title, summary: u.summary, tip: u.tip,
      nodes: u.nodes.map((n) => ({ id: n.id, kind: n.kind, index: n.index, title: n.title })),
    })) })),
  ).toEqual(fixture.sections);
  expect(
    skillMap(provider).skills.map((s) => ({ id: s.id, title: s.title, goal: s.goal, levels: s.levels, prerequisites: s.prerequisites, nodeIDs: s.nodeIDs })),
  ).toEqual(fixture.skills);
}

/** Every exercise of every non-chest node for the exported seeds. `only` restricts the nodes (a filter on node ids). */
export function expectExercisesMatch(provider: CourseProvider, only?: (nodeID: string) => boolean): void {
  const fixture = loadFixture(provider.course.id);
  for (const entry of fixture.nodes) {
    if (only && !only(entry.id)) continue;
    const node = provider.course.nodes.find((n) => n.id === entry.id);
    expect(node, `node ${entry.id}`).toBeDefined();
    for (const run of entry.runs) {
      const made = lessonExercises(provider, node!, BigInt(run.seed)).map(flatten);
      expect(made, `${entry.id} seed ${run.seed}`).toEqual(run.exercises);
    }
  }
}
