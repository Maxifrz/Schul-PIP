import { describe, expect, it } from 'vitest';
import { maxExercises } from '../../src/lib/learn/builder';
import { CourseNode, standardUnit } from '../../src/lib/learn/course';
import { auditProblems, exerciseListProblems, exerciseProblems } from '../../src/lib/learn/courseAudit';
import { exercise, missedKeys } from '../../src/lib/learn/exercise';
import { arrange, bank, choice, move, pairs, pianoKey, seedFor, tiles, typed } from '../../src/lib/learn/exercises';
import { board } from '../../src/lib/learn/media';
import { LearnRandom } from '../../src/lib/learn/random';
import { NumberCheck, Rational } from '../../src/lib/learn/rational';
import { LessonSession } from '../../src/lib/learn/session';
import { sampleProvider } from './sample';

const rng = () => new LearnRandom(7n);
const same = (a: string, b: string) => NumberCheck.matches(a, b);
const R = (n: number, d = 1) => Rational.of(n, d)!;
const option = (value: string) => ({ type: 'option' as const, value });
const typedAnswer = (value: string) => ({ type: 'typed' as const, value });

describe('NumberCheck', () => {
  it('the same number in every writing', () => {
    expect(same('0,75', '3/4')).toBe(true);
    expect(same('0.75', '3/4')).toBe(true);
    expect(same('6/8', '3/4')).toBe(true);
    expect(same('75 %', '0,75')).toBe(false);
    expect(same('75%', '75')).toBe(true);
    expect(same('90°', '90')).toBe(true);
    expect(same('1 1/2', '3/2')).toBe(true);
    expect(same('1,5', '1 1/2')).toBe(true);
    expect(same('-2', '−2')).toBe(true);
    expect(same('-3/4', '-0,75')).toBe(true);
    expect(same('  12 ', '12')).toBe(true);
    expect(same('+4', '4')).toBe(true);
    expect(same('0,50', '1/2')).toBe(true);
    expect(same(',5', '1/2')).toBe(true);
  });

  it('different numbers and nonsense', () => {
    expect(same('34', '3/4')).toBe(false);
    expect(same('12', '1/2')).toBe(false);
    expect(same('0,7', '3/4')).toBe(false);
    expect(same('3/4', '4/3')).toBe(false);
    expect(same('2x', '2')).toBe(false);
    expect(same('x', '2')).toBe(false);
    expect(same('', '0')).toBe(false);
    expect(same('1/0', '0')).toBe(false);
    expect(same('1,2,3', '1')).toBe(false);
    expect(same('1 2', '12')).toBe(false);
    expect(same('1 3/2', '5/2')).toBe(false);
    expect(same('--2', '2')).toBe(false);
    expect(same('2.', '2')).toBe(false);
    expect(same('99999999999999999999', '1')).toBe(false);
    expect(NumberCheck.parse('abc')).toBeNull();
  });

  it('rational arithmetic and text', () => {
    const half = R(1, 2);
    const third = R(1, 3);
    expect(half.plus(third)).toEqual(R(5, 6));
    expect(half.minus(third)).toEqual(R(1, 6));
    expect(half.times(third)).toEqual(R(1, 6));
    expect(half.dividedBy(third)).toEqual(R(3, 2));
    expect(half.dividedBy(Rational.whole(0))).toBeNull();
    expect(R(2, -4)).toEqual(R(-1, 2));
    expect(Rational.of(1, 0)).toBeNull();
    expect(third.lessThan(half)).toBe(true);
    expect(R(3, 4).germanText).toBe('0,75');
    expect(R(-3, 8).germanText).toBe('-0,375');
    expect(R(1, 20).germanText).toBe('0,05');
    expect(third.germanText).toBe('1/3');
    expect(Rational.whole(7).germanText).toBe('7');
    expect(R(5, 2).fractionText).toBe('5/2');
    expect(NumberCheck.parse('0,125')).toEqual(R(1, 8));
  });

  it('typed numbers in an exercise', () => {
    const item = typed({ id: 'n', prompt: '3/8 + 3/8', answer: '3/4', mode: 'number' })!;
    expect(missedKeys(item, typedAnswer('0,75'))).toEqual(new Set());
    expect(missedKeys(item, typedAnswer('6/8'))).toEqual(new Set());
    expect(missedKeys(item, typedAnswer('34'))).toEqual(new Set(['n']));
    expect(typed({ id: 'bad', prompt: '?', answer: 'drei', mode: 'number' })).toBeNull();
  });
});

describe('Exercises', () => {
  it('choice keeps the right answer once and drops lookalikes', () => {
    const item = choice(rng(), { id: 'c', prompt: 'Hauptstadt?', correct: 'Berlin', wrong: ['berlin', 'Paris', 'Paris', 'Rom', 'Wien', 'Madrid', ' '] })!;
    expect(item.options).toHaveLength(4);
    expect(item.options.filter((o) => o === 'Berlin')).toHaveLength(1);
    expect(new Set(item.options).size).toBe(4);
    expect(item.correctAnswers).toEqual(['Berlin']);
    expect(missedKeys(item, option('Berlin'))).toEqual(new Set());
    expect(missedKeys(item, option('Paris'))).toEqual(new Set(['c']));
    expect(choice(rng(), { id: 'x', prompt: '?', correct: 'A', wrong: ['a', ' '] })).toBeNull();
    expect(choice(rng(), { id: 'tf', prompt: 'Stimmt das?', correct: 'Richtig', wrong: ['Falsch'] })!.options).toHaveLength(2);
  });

  it('typed keeps alternatives', () => {
    const item = typed({ id: 't', key: 'k1', prompt: 'adiós', answer: 'tschüss', alternatives: ['auf Wiedersehen'] })!;
    expect(missedKeys(item, typedAnswer('Tschuess'))).toEqual(new Set());
    expect(missedKeys(item, typedAnswer('auf wiedersehen'))).toEqual(new Set());
    expect(missedKeys(item, typedAnswer('hallo'))).toEqual(new Set(['k1']));
    expect(typed({ id: 'e', prompt: '?', answer: '  ' })).toBeNull();
  });

  it('exact answers forgive only capitals, accents and punctuation', () => {
    const item = typed({ id: 'x', key: 'k', prompt: '?', answer: '¿Cómo te llamas?', mode: 'exact' })!;
    expect(missedKeys(item, typedAnswer('como te llamas'))).toEqual(new Set());
    expect(missedKeys(item, typedAnswer('CÓMO TE LLAMAS?'))).toEqual(new Set());
    expect(missedKeys(item, typedAnswer('te llamas cómo'))).toEqual(new Set(['k']));
    expect(missedKeys(item, typedAnswer('como te llamar'))).toEqual(new Set(['k']));
    expect(missedKeys(item, typedAnswer('  '))).toEqual(new Set(['k']));
    expect(missedKeys(item, typedAnswer('¿?'))).toEqual(new Set(['k']));
  });

  it('bank tiles never come in the right order', () => {
    for (let seed = 1n; seed <= 30n; seed++) {
      const item = bank(new LearnRandom(seed), { id: 'b', prompt: '?', words: ['Me', 'llamo', 'Ana.'], extra: ['casa', 'perro', 'gato'] })!;
      expect(item.options.slice(0, 3)).not.toEqual(['Me', 'llamo', 'Ana.']);
      expect(item.options).toHaveLength(5);
      expect(missedKeys(item, { type: 'words', value: ['me', 'Llamo', 'Ana'] })).toEqual(new Set());
    }
    expect(bank(rng(), { id: 'one', prompt: '?', words: ['Hola'] })).toBeNull();
    expect(tiles('Ich heiße Ana.')).toEqual(['Ich', 'heiße', 'Ana.']);
  });

  it('pairs need four distinct items', () => {
    const items = [['a', 'uno', 'eins'], ['b', 'dos', 'zwei'], ['c', 'tres', 'drei'], ['d', 'cuatro', 'vier']].map(([key, front, back]) => ({ key, front, back }));
    const item = pairs(rng(), { id: 'p', items })!;
    expect([...item.cardKeys].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(missedKeys(item, { type: 'pairs', missed: new Set(['b']) })).toEqual(new Set(['b']));
    expect(missedKeys(item, { type: 'pairs', missed: new Set() })).toEqual(new Set());
    expect(pairs(rng(), { id: 'x', items: items.slice(0, 3) })).toBeNull();
    const twins = [...items];
    twins[1] = { key: 'b', front: 'dos', back: 'Eins' };
    expect(pairs(rng(), { id: 'y', items: twins })).toBeNull();
  });

  it('chess and piano answers', () => {
    const spec = board('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const item = move({ id: 'm', prompt: 'Matt in 1', board: spec, accepted: ['a1a8'], solution: 'Ta8#' })!;
    expect(missedKeys(item, { type: 'move', value: 'a1a8' })).toEqual(new Set());
    expect(missedKeys(item, { type: 'move', value: 'a1a7' })).toEqual(new Set(['m']));
    expect(missedKeys(item, option('a1a8'))).toEqual(new Set(['m']));
    expect(item.media).toEqual({ kind: 'board', board: spec });
    expect(move({ id: 'n', prompt: '?', board: spec, accepted: [], solution: '' })).toBeNull();
    const key = pianoKey({ id: 'k', prompt: 'Tippe das C', midi: [60, 72], solution: 'C' })!;
    expect(missedKeys(key, option('72'))).toEqual(new Set());
    expect(missedKeys(key, option('61'))).toEqual(new Set(['k']));
  });

  it('arrange sorts easy first, drops duplicates and cuts', () => {
    const easy = choice(rng(), { id: 'easy', prompt: '?', correct: 'A', wrong: ['B'] })!;
    const hard = typed({ id: 'hard', prompt: '?', answer: 'A' })!;
    expect(arrange([hard, null, easy, easy]).map((e) => e.id)).toEqual(['easy', 'hard']);
    const many = Array.from({ length: 20 }, (_, i) => typed({ id: `t${i}`, prompt: '?', answer: 'A' }));
    expect(arrange(many)).toHaveLength(maxExercises);
    expect(arrange(many).map((e) => e.id)).toEqual(Array.from({ length: 12 }, (_, i) => `t${i}`));
  });

  it('seeds differ by node and repeat for the same', () => {
    const unit = standardUnit('x', 1, 'T', '', 't');
    const a = seedFor(unit.nodes[0], 5n);
    expect(a).toBe(seedFor(unit.nodes[0], 5n));
    expect(a).not.toBe(seedFor(unit.nodes[1], 5n));
    expect(a).not.toBe(seedFor(unit.nodes[0], 6n));
  });

  it('no cards still means wrong when wrong', () => {
    const solo = choice(rng(), { id: 'solo', prompt: '?', correct: 'A', wrong: ['B', 'C'] })!;
    const session = new LessonSession('x.u01.l1', [], [solo], 's');
    expect(session.submit(option('B'))).toBe('wrong');
    session.advance();
    expect(session.queue).toHaveLength(2);
    expect(session.submit(option('A'))).toBe('right');
    session.advance();
    expect([session.result?.rightFirstTry, session.result?.rightOnRetry]).toEqual([0, 1]);
  });

  it('is deterministic for a seed', () => {
    const a = new LearnRandom(99n);
    const b = new LearnRandom(99n);
    expect([a.int(100), a.int(100), a.int(100)]).toEqual([b.int(100), b.int(100), b.int(100)]);
    expect(new LearnRandom(1n).shuffled([1, 2, 3, 4, 5, 6])).toEqual(new LearnRandom(1n).shuffled([1, 2, 3, 4, 5, 6]));
  });
});

describe('CourseAudit', () => {
  const rnd = () => new LearnRandom(3n);
  const lessonNode = (kind: CourseNode['kind'] = 'lesson'): CourseNode => ({ id: 't.u01.l1', courseID: 't', unitID: 't.u01', unitNumber: 1, kind, index: 1, title: 'x' });

  it('a well formed exercise has no problems', () => {
    expect(exerciseProblems(choice(rnd(), { id: 'c', prompt: 'Frage?', correct: 'A', wrong: ['B', 'C'] })!)).toEqual([]);
    expect(exerciseProblems(typed({ id: 't', prompt: 'Frage?', answer: '3/4', mode: 'number' })!)).toEqual([]);
    expect(exerciseProblems(move({ id: 'm', prompt: 'Zieh.', board: board('8/8/8/8/8/8/8/8 w - - 0 1'), accepted: ['e2e4', 'e7e8q'], solution: 'e4' })!)).toEqual([]);
    expect(exerciseProblems(pianoKey({ id: 'k', prompt: 'Tippe C.', midi: [60], solution: 'C4' })!)).toEqual([]);
  });

  it('broken exercises are found', () => {
    const broken = exercise({ id: 'b', kind: 'multipleChoice', prompt: ' ', correctAnswers: ['A'], options: ['A', 'a', 'B', 'C', 'D'], solution: '' });
    const found = exerciseProblems(broken);
    expect(found).toContain('empty prompt');
    expect(found).toContain('empty solution');
    expect(found).toContain('5 options');
    expect(found).toContain('options that read the same');
    expect(exerciseProblems(exercise({ id: 'm', kind: 'chessMove', prompt: '?', correctAnswers: ['e2-e4', 'z9a1'], solution: 's' }))).toContain('a chess move without a board');
    const badKey = exercise({ id: 'k', kind: 'pianoKey', prompt: '?', correctAnswers: ['C4', '200'], solution: 's' });
    expect(exerciseProblems(badKey).filter((p) => p.includes('not a piano key'))).toHaveLength(2);
    const sorted = exerciseProblems(exercise({ id: 'w', kind: 'wordBank', prompt: '?', correctAnswers: ['a', 'b'], options: ['a', 'b', 'c', 'd', 'e'], solution: 'a b' }));
    expect(sorted).toContain('tiles come in the right order');
    expect(sorted).toContain('too many extra tiles');
  });

  it('lengths, order and ids of a lesson', () => {
    const easy = choice(rnd(), { id: 'easy', prompt: '?', correct: 'A', wrong: ['B'] })!;
    const hard = typed({ id: 'hard', prompt: '?', answer: 'A' })!;
    expect(exerciseListProblems([easy, hard], lessonNode()).some((p) => p.includes('2 exercises, expected 8 to 12'))).toBe(true);
    const backwards = exerciseListProblems([hard, easy, easy], lessonNode());
    expect(backwards.some((p) => p.includes('easy to hard'))).toBe(true);
    expect(backwards.some((p) => p.includes('not unique'))).toBe(true);
    const ten = Array.from({ length: 10 }, (_, i) => typed({ id: `t${i}`, prompt: '?', answer: 'A' })!);
    expect(exerciseListProblems(ten, lessonNode())).toEqual([]);
    expect(exerciseListProblems(ten, lessonNode('checkpoint'))).toEqual([]);
    expect(exerciseListProblems(ten.slice(0, 9), lessonNode('checkpoint')).length).toBeGreaterThan(0);
  });

  it('a provider is run through every node', () => {
    const problems = auditProblems(sampleProvider, [1n]);
    expect(problems.some((p) => p.includes('sample.u01.l1: 0 exercises'))).toBe(true);
    expect(problems.some((p) => p.includes('.k:'))).toBe(false);
  });
});
