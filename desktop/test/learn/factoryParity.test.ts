// The exercise factory and the practice rounds against Swift: fixtures/factoryScenario.json was written by
// fixtures/factoryScenario.swift.txt (a small course built with Exercises.choice/bank/pairs/typed/arrange from seeded
// LearnRandom, and SkillPractice.exercises rounds with and without a weak record). Same seeds, same options, same order.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type CourseNode, type CourseProvider, makeCourse, standardUnit } from '../../src/lib/learn/course';
import type { LearnExercise } from '../../src/lib/learn/exercise';
import { Exercises } from '../../src/lib/learn/exercises';
import { LearnRandom, MASK64 } from '../../src/lib/learn/random';
import { SkillRecord, Tally } from '../../src/lib/learn/skills/assessor';
import { SkillPractice } from '../../src/lib/learn/skills/advisor';
import { skillMap } from '../../src/lib/learn/skills/skill';

const swift = JSON.parse(readFileSync(new URL('./fixtures/factoryScenario.json', import.meta.url), 'utf8'));

const rich: CourseProvider = {
  get course() {
    const units = [standardUnit('rich', 1, 'Eins', 's', 't'), standardUnit('rich', 2, 'Zwei', 's', 't')];
    return makeCourse({ id: 'rich', title: 'Rich', subtitle: '', kind: 'language', color: 0, symbol: 'x', sections: [{ id: 'rich.a', title: 'A', units }] });
  },
  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    if (node.kind === 'chest') return [];
    const rng = new LearnRandom(Exercises.seed(node, seed));
    const list: (LearnExercise | null)[] = [];
    for (let i = 0; i < 6; i++) list.push(Exercises.choice({ id: `${node.id}#c${i}`, prompt: '?', correct: 'A', wrong: ['B', 'C', 'D', 'E'] }, rng));
    for (let i = 0; i < 3; i++) list.push(Exercises.bank({ id: `${node.id}#b${i}`, prompt: '?', words: ['Ich', 'heiße', 'Ana.'], extra: ['casa', 'perro', 'gato'] }, rng));
    const items = [['a', 'uno', 'eins'], ['b', 'dos', 'zwei'], ['c', 'tres', 'drei'], ['d', 'cuatro', 'vier']].map(([key, front, back]) => ({ key, front, back }));
    list.push(Exercises.pairs({ id: `${node.id}#p`, items }, rng));
    for (let i = 0; i < 4; i++) list.push(Exercises.typed({ id: `${node.id}#t${i}`, prompt: '?', answer: 'A' }));
    return Exercises.arrange(list);
  },
};

const view = (e: LearnExercise) => ({
  id: e.id,
  kind: e.kind,
  options: e.options,
  pairs: e.pairs.map((p) => [p.key, p.front, p.back]),
  skill: e.skill,
  level: e.level,
  correct: e.correctAnswers,
});

describe('exercise factory and practice rounds against Swift', () => {
  it('lessons built from seeds are identical', () => {
    const nodes = rich.course.nodes.filter((n) => n.kind !== 'chest').slice(0, 4);
    const ours = [1n, 2n, 3n, 4n].map((seed) => nodes.map((n) => rich.exercises(n, seed).map((e) => view({ ...e, skill: '', level: null }))));
    const theirs = swift.exercises.map((bySeed: any[]) => bySeed.map((list: any[]) => list.map((e) => ({ ...e, skill: '', level: null }))));
    expect(ours).toEqual(theirs);
  });

  it('practice rounds are identical', () => {
    const map = skillMap(rich);
    const weak = new SkillRecord();
    weak.tallies.recall = new Tally({ attempts: 8, right: 1, helped: 0, points: 2, recent: [false, false, false, true, false, false, false, false] });
    weak.tallies.recognise = new Tally({ attempts: 8, right: 8, helped: 0, points: 8, recent: Array(8).fill(true) });
    weak.tallies.apply = new Tally({ attempts: 3, right: 2, helped: 0, points: 4, recent: [true, false, true] });
    const target = map.skills[0].id;
    for (let seed = 1n; seed <= 12n; seed++) {
      const round = swift.rounds[Number(seed) - 1];
      expect(SkillPractice.exercises(rich, map, [target], {}, seed).map(view)).toEqual(round.plain);
      const weakSeed = (seed * 0x9e3779b97f4a7c15n) & MASK64;
      expect(SkillPractice.exercises(rich, map, [target, map.skills[1].id], { [target]: weak }, weakSeed).map(view)).toEqual(round.weak);
    }
  });
});
