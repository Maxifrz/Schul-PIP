import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import { CourseCatalog, provider, providerForNode, providers, registerProvider } from '../../src/lib/learn/catalog';
import {
  type CourseNode,
  type CourseProvider,
  courseKindTitle,
  courseNode,
  makeCourse,
  prefersDarkText,
  standardUnit,
  structureProblems,
} from '../../src/lib/learn/course';
import { CoursePath } from '../../src/lib/learn/coursePath';
import { type LearnExercise, learnExercise } from '../../src/lib/learn/exercise';
import { Exercises } from '../../src/lib/learn/exercises';
import { boardSpec } from '../../src/lib/learn/media';
import { LearnRandom } from '../../src/lib/learn/random';
import { SampleCourse } from './sample';

const sample = new SampleCourse();

describe('CoursePath', () => {
  it('a unit has three lessons, practice, checkpoint and chest', () => {
    const unit = sample.course.units[0];
    expect(unit.id).toBe('sample.u01');
    expect(unit.nodes.map((n) => n.id)).toEqual(['sample.u01.l1', 'sample.u01.l2', 'sample.u01.l3', 'sample.u01.p', 'sample.u01.t', 'sample.u01.k']);
    expect(unit.nodes.map((n) => n.kind)).toEqual(['lesson', 'lesson', 'lesson', 'practice', 'checkpoint', 'chest']);
    expect(unit.nodes.map((n) => n.index)).toEqual([1, 2, 3, 1, 1, 1]);
    expect(sample.course.nodes.length).toBe(18);
    expect(courseNode(sample.course, 'sample.u02.t')?.unitNumber).toBe(2);
    expect(structureProblems(sample)).toEqual([]);
    expect(standardUnit('x', 12, 'T', '', 't', 4).id).toBe('x.u12');
    expect(standardUnit('x', 1, 'T', '', 't', 4).nodes.length).toBe(7);
  });

  it('steps open one after the other through the whole course', () => {
    let done = new Set<string>();
    let units = CoursePath.units(sample.course, done);
    expect(units.length).toBe(3);
    expect(units[0].steps.map((s) => s.state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(units[1].steps[0].state).toBe('locked');
    expect(CoursePath.current(units)?.id).toBe('sample.u01.l1');
    expect([units[0].sectionNumber, units[2].sectionNumber]).toEqual([1, 2]);

    for (const node of sample.course.units[0].nodes) done.add(node.id);
    units = CoursePath.units(sample.course, done);
    expect(units[0].isDone).toBe(true);
    expect(units[1].steps[0].state).toBe('open'); // the next unit opens when the chest is open
    expect(CoursePath.current(units)?.id).toBe('sample.u02.l1');

    // Skipping ahead in the saved set does not open a step whose predecessor is not done.
    done = new Set(['sample.u01.l1', 'sample.u01.l3']);
    units = CoursePath.units(sample.course, done);
    expect(units[0].steps.map((s) => s.state)).toEqual(['done', 'open', 'done', 'locked', 'locked', 'locked']);
    expect(units[0].doneCount).toBe(2);
  });

  it('progress counts everything but chests', () => {
    const done = new Set(sample.course.units[0].nodes.map((n) => n.id));
    expect(CoursePath.fraction(sample.course, done)).toBeCloseTo(5 / 15, 4);
    done.delete('sample.u01.k');
    expect(CoursePath.fraction(sample.course, done)).toBeCloseTo(5 / 15, 4);
    const all = new Set(sample.course.nodes.map((n) => n.id));
    expect(CoursePath.fraction(sample.course, all)).toBe(1);
    expect(CoursePath.isFinished(sample.course, all)).toBe(true);
    expect(CoursePath.isFinished(sample.course, done)).toBe(false);
    expect(CoursePath.current(CoursePath.units(sample.course, all))).toBeNull();
    expect(CoursePath.fraction(makeCourse({ id: 'e', title: '', subtitle: '', kind: 'math', color: 0, symbol: '', sections: [] }), new Set())).toBe(0);
  });

  it('chests pay ten, fifteen or twenty', () => {
    const chests = sample.course.nodes.filter((n) => n.kind === 'chest');
    expect(chests.map(CoursePath.chestGems)).toEqual([15, 20, 10]);
  });

  it('next node', () => {
    const course = sample.course;
    expect(CoursePath.next(course.nodes[0], course)?.id).toBe('sample.u01.l2');
    expect(CoursePath.next(course.nodes[course.nodes.length - 1], course)).toBeNull();
  });

  it('text on a course color is the one that contrasts more', () => {
    const c = (color: number) => ({ color });
    expect(prefersDarkText(c(0xffffff))).toBe(true);
    expect(prefersDarkText(c(0x000000))).toBe(false);
    expect(prefersDarkText(c(0xb8a04a))).toBe(true); // the yellow of Deutsch als Fremdsprache
    expect(prefersDarkText(c(0xd9903a))).toBe(true); // orange
    expect(prefersDarkText(c(0x3d6fb6))).toBe(false); // blue
    expect(prefersDarkText(c(0x5a5aa8))).toBe(false); // indigo
    expect(prefersDarkText(c(0x9e6b8e))).toBe(false); // plum
  });

  it('structure problems are found', () => {
    const good = standardUnit('broken', 1, 'T', '', 't');
    const twin = standardUnit('broken', 1, '', '', '');
    const broken: CourseProvider = {
      course: makeCourse({
        id: 'broken',
        title: 'B',
        subtitle: '',
        kind: 'math',
        color: 0,
        symbol: 'x',
        sections: [{ id: 's', title: 'S', units: [good, twin] }],
      }),
      exercises: () => [],
    };
    const problems = structureProblems(broken);
    expect(problems.some((p) => p.includes('not unique'))).toBe(true);
    expect(problems.some((p) => p.includes('no title or tip'))).toBe(true);
    expect(problems.some((p) => p.includes('expected 2'))).toBe(true);
  });

  it('course kinds have their German titles', () => {
    expect(['language', 'school', 'math', 'chess', 'music'].map((k) => courseKindTitle(k as never))).toEqual([
      'Sprachen',
      'Schulfächer',
      'Mathe',
      'Schach',
      'Musik',
    ]);
  });
});

describe('catalog', () => {
  it('registers providers and finds them by course and by node', () => {
    CourseCatalog.clearProviders();
    expect(providers()).toEqual([]);
    registerProvider(sample);
    registerProvider(sample); // the same course id replaces
    expect(providers().length).toBe(1);
    expect(provider('sample')).toBe(sample);
    expect(provider('other')).toBeUndefined();
    for (const p of providers()) expect(providerForNode(p.course.nodes[0].id)?.course.id).toBe(p.course.id);
    expect(providerForNode('sampler.u01.l1')).toBeUndefined();
    expect(CourseCatalog.courses().map((c) => c.id)).toEqual(['sample']);
    CourseCatalog.clearProviders();
  });
});

describe('CourseAudit', () => {
  const random = new LearnRandom(3n);
  const node = (kind: CourseNode['kind'] = 'lesson'): CourseNode => ({
    id: 't.u01.l1',
    courseID: 't',
    unitID: 't.u01',
    unitNumber: 1,
    kind,
    index: 1,
    title: 'x',
  });

  it('a well formed exercise has no problems', () => {
    const choice = Exercises.choice({ id: 'c', prompt: 'Frage?', correct: 'A', wrong: ['B', 'C'] }, random)!;
    expect(CourseAudit.problemsInExercise(choice)).toEqual([]);
    const typed = Exercises.typed({ id: 't', prompt: 'Frage?', answer: '3/4', mode: 'number' })!;
    expect(CourseAudit.problemsInExercise(typed)).toEqual([]);
    const move = Exercises.move({ id: 'm', prompt: 'Zieh.', board: boardSpec('8/8/8/8/8/8/8/8 w - - 0 1'), accepted: ['e2e4', 'e7e8q'], solution: 'e4' })!;
    expect(CourseAudit.problemsInExercise(move)).toEqual([]);
    const key = Exercises.key({ id: 'k', prompt: 'Tippe C.', midi: [60], solution: 'C4' })!;
    expect(CourseAudit.problemsInExercise(key)).toEqual([]);
  });

  it('broken exercises are found', () => {
    const broken = learnExercise({
      id: 'b',
      kind: 'multipleChoice',
      prompt: ' ',
      correctAnswers: ['A'],
      options: ['A', 'a', 'B', 'C', 'D'],
      solution: '',
    });
    const found = CourseAudit.problemsInExercise(broken);
    expect(found).toContain('empty prompt');
    expect(found).toContain('empty solution');
    expect(found).toContain('5 options');
    expect(found).toContain('options that read the same');

    const wrongMove = learnExercise({ id: 'm', kind: 'chessMove', prompt: '?', correctAnswers: ['e2-e4', 'z9a1'], solution: 's' });
    expect(CourseAudit.problemsInExercise(wrongMove)).toContain('a chess move without a board');

    const badKey = learnExercise({ id: 'k', kind: 'pianoKey', prompt: '?', correctAnswers: ['C4', '200'], solution: 's' });
    expect(CourseAudit.problemsInExercise(badKey).filter((p) => p.includes('not a piano key')).length).toBe(2);

    const sorted = learnExercise({
      id: 'w',
      kind: 'wordBank',
      prompt: '?',
      correctAnswers: ['a', 'b'],
      options: ['a', 'b', 'c', 'd', 'e'],
      solution: 'a b',
    });
    const bank = CourseAudit.problemsInExercise(sorted);
    expect(bank).toContain('tiles come in the right order');
    expect(bank).toContain('too many extra tiles');
  });

  it('lengths, order and ids of a lesson', () => {
    const easy = Exercises.choice({ id: 'easy', prompt: '?', correct: 'A', wrong: ['B'] }, random)!;
    const hard = Exercises.typed({ id: 'hard', prompt: '?', answer: 'A' })!;
    expect(CourseAudit.problemsInExercises([easy, hard], node()).some((p) => p.includes('2 exercises, expected 8 to 12'))).toBe(true);
    const backwards = CourseAudit.problemsInExercises([hard, easy, easy], node());
    expect(backwards.some((p) => p.includes('easy to hard'))).toBe(true);
    expect(backwards.some((p) => p.includes('not unique'))).toBe(true);
    const ten = Array.from({ length: 10 }, (_, i) => Exercises.typed({ id: `t${i}`, prompt: '?', answer: 'A' })!);
    expect(CourseAudit.problemsInExercises(ten, node())).toEqual([]);
    expect(CourseAudit.problemsInExercises(ten, node('checkpoint'))).toEqual([]);
    expect(CourseAudit.problemsInExercises(ten.slice(0, 9), node('checkpoint'))).not.toEqual([]); // a checkpoint has at least ten
  });

  it('a provider is run through every node', () => {
    const lazy: CourseProvider = { course: sample.course, exercises: () => [] };
    const problems = CourseAudit.problems(lazy, [1n]);
    expect(problems.some((p) => p.includes('sample.u01.l1: 0 exercises'))).toBe(true);
    expect(problems.some((p) => p.includes('.k:'))).toBe(false); // chests have no exercises
  });

  // Extra cases
  it('a chest with exercises and a provider that is not deterministic are reported', () => {
    let counter = 0;
    const chatty: CourseProvider = {
      course: sample.course,
      exercises(n): LearnExercise[] {
        counter += 1;
        return [Exercises.typed({ id: `${n.id}#${counter}`, prompt: '?', answer: 'x' })!];
      },
    };
    const problems = CourseAudit.problems(chatty, [1n]);
    expect(problems.some((p) => p.includes('sample.u01.k: a chest has exercises.'))).toBe(true);
    expect(problems.some((p) => p.includes('the same seed gives other exercises (seed 1)'))).toBe(true);
  });

  it('media is checked', () => {
    const base = { id: 'm', kind: 'typeAnswer' as const, prompt: '?', correctAnswers: ['a'], solution: 'a' };
    expect(CourseAudit.problemsInExercise(learnExercise({ ...base, media: { type: 'speech', text: '', language: 'es-ES' } }))).toContain('speech without text or language');
    expect(CourseAudit.problemsInExercise(learnExercise({ ...base, media: { type: 'board', board: boardSpec('nonsense') } }))).toContain('board without a FEN');
    expect(CourseAudit.problemsInExercise(learnExercise({ ...base, media: { type: 'tones', tones: { midi: [10], together: false } } }))).toContain('tones out of range');
  });
});
