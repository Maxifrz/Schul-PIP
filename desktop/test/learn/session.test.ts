import { describe, expect, it } from 'vitest';
import { ExerciseBuilder } from '../../src/lib/learn/builder';
import { LearnPath } from '../../src/lib/learn/cards';
import { ExerciseKind, LearnExercise, exercise } from '../../src/lib/learn/exercise';
import { LessonResult, LessonSession, accuracyOf, gradesToApply } from '../../src/lib/learn/session';
import { card } from './helpers';

const ex = (kind: ExerciseKind, key: string, back = 'Berlin'): LearnExercise =>
  exercise({
    id: `${kind}:${key}`, kind, cardKeys: [key], prompt: `Frage ${key}`, correctAnswers: [back],
    options: kind === 'multipleChoice' ? [back, 'Paris', 'Rom', 'Madrid'] : [], solution: back,
  });

const pairsOf = (keys: string[]): LearnExercise => {
  const pairs = keys.map((key) => ({ key, front: `Frage ${key}`, back: `Antwort ${key}` }));
  return exercise({ id: `matchPairs:${keys.join('+')}`, kind: 'matchPairs', cardKeys: keys, prompt: 'Finde die Paare', correctAnswers: pairs.map((p) => p.back), options: pairs.map((p) => p.back), pairs, solution: '' });
};

const session = (exercises: LearnExercise[], cards = ['a', 'b']) => new LessonSession('L1', cards, exercises, 's1');
const typed = (value: string) => ({ type: 'typed' as const, value });
const option = (value: string) => ({ type: 'option' as const, value });

describe('LessonSession', () => {
  it('all right finishes with full accuracy', () => {
    const lesson = session([ex('multipleChoice', 'a'), ex('typeAnswer', 'a'), ex('typeAnswer', 'b')]);
    expect(lesson.progress).toBe(0);
    expect(lesson.submit(option('Berlin'))).toBe('right');
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'right' });
    expect(lesson.progress).toBeCloseTo(1 / 3, 4);
    expect(lesson.result).toBeUndefined();
    lesson.advance();
    expect(lesson.submit(typed('berlin'))).toBe('right');
    lesson.advance();
    expect(lesson.submit(typed('Berlin'))).toBe('right');
    lesson.advance();
    expect(lesson.phase.type).toBe('finished');
    expect(lesson.current).toBeUndefined();
    expect(lesson.progress).toBe(1);
    const result = lesson.result!;
    expect([result.exerciseCount, result.rightFirstTry, result.rightOnRetry, accuracyOf(result)]).toEqual([3, 3, 0, 1]);
    expect(result.cardsRightFirstTry).toEqual(new Set(['a', 'b']));
    expect([result.lessonID, result.sessionID]).toEqual(['L1', 's1']);
  });

  it('a wrong exercise comes back exactly once', () => {
    const lesson = session([ex('multipleChoice', 'a'), ex('typeAnswer', 'b')]);
    expect(lesson.submit(option('Paris'))).toBe('wrong');
    expect(lesson.progress).toBe(0);
    lesson.advance();
    expect(lesson.queue).toHaveLength(3);
    expect(lesson.isRetry).toBe(false);
    lesson.submit(typed('Berlin'));
    lesson.advance();
    expect(lesson.current?.id).toBe('multipleChoice:a');
    expect(lesson.isRetry).toBe(true);
    expect(lesson.submit(option('Rom'))).toBe('wrong');
    expect(lesson.progress).toBe(1);
    lesson.advance();
    expect(lesson.queue).toHaveLength(3);
    expect(lesson.phase.type).toBe('finished');
    expect([lesson.result?.rightFirstTry, lesson.result?.rightOnRetry, accuracyOf(lesson.result!)]).toEqual([1, 0, 0.5]);
    expect(lesson.result?.cardsRightFirstTry).toEqual(new Set(['b']));
  });

  it('a right retry counts as retry, not as first try', () => {
    const lesson = session([ex('typeAnswer', 'a')], ['a']);
    lesson.submit(typed('Paris'));
    lesson.advance();
    expect(lesson.submit(typed('Berlin'))).toBe('right');
    lesson.advance();
    expect([lesson.result?.rightFirstTry, lesson.result?.rightOnRetry]).toEqual([0, 1]);
    expect(lesson.result?.cardsRightFirstTry).toEqual(new Set());
  });

  it('progress never goes back', () => {
    const lesson = session([ex('multipleChoice', 'a'), ex('multipleChoice', 'b'), ex('typeAnswer', 'a')]);
    let last = lesson.progress;
    const answers = ['Paris', 'Berlin', 'Rom', 'Berlin'];
    let index = 0;
    while (lesson.phase.type !== 'finished') {
      const answer = answers[Math.min(index, answers.length - 1)];
      const current = lesson.current!;
      lesson.submit(current.kind === 'typeAnswer' ? typed(answer) : option(answer));
      expect(lesson.progress).toBeGreaterThanOrEqual(last);
      last = lesson.progress;
      lesson.advance();
      expect(lesson.progress).toBeGreaterThanOrEqual(last);
      index++;
    }
    expect(lesson.progress).toBe(1);
  });

  it('overruled typing counts as right', () => {
    const lesson = session([ex('typeAnswer', 'a', 'Die Photosynthese wandelt Licht in chemische Energie um')], ['a']);
    expect(lesson.submit(typed('Licht wird zu Zucker'))).toBe('wrong');
    lesson.overrule();
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'right' });
    lesson.advance();
    expect(lesson.queue).toHaveLength(1);
    expect(lesson.result?.rightFirstTry).toBe(1);
    expect(lesson.result?.cardsRightFirstTry).toEqual(new Set(['a']));
  });

  it('only typing can be overruled', () => {
    const lesson = session([ex('multipleChoice', 'a')], ['a']);
    lesson.submit(option('Paris'));
    lesson.overrule();
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'wrong' });
  });

  it('a second tap neither answers twice nor skips', () => {
    const lesson = session([ex('typeAnswer', 'a'), ex('typeAnswer', 'b')]);
    expect(lesson.submit(typed('Paris'))).toBe('wrong');
    expect(lesson.submit(typed('Berlin'))).toBeUndefined();
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'wrong' });
    lesson.advance();
    lesson.advance();
    expect(lesson.current?.id).toBe('typeAnswer:b');
    expect(lesson.queue).toHaveLength(3);
  });

  it('pairs mark only the missed cards', () => {
    const lesson = session([pairsOf(['a', 'b', 'c', 'd'])], ['a', 'b', 'c', 'd']);
    expect(lesson.submit({ type: 'pairs', missed: new Set(['c', 'x']) })).toBe('wrong');
    lesson.advance();
    lesson.submit({ type: 'pairs', missed: new Set() });
    lesson.advance();
    expect(lesson.result?.cardsRightFirstTry).toEqual(new Set(['a', 'b', 'd']));
  });

  it('a card wrong in any first try is wrong', () => {
    const lesson = session([ex('multipleChoice', 'a'), ex('typeAnswer', 'a')], ['a']);
    lesson.submit(option('Berlin'));
    lesson.advance();
    lesson.submit(typed('Rom'));
    lesson.advance();
    lesson.submit(typed('Berlin'));
    lesson.advance();
    expect(lesson.result?.cardsRightFirstTry).toEqual(new Set());
  });

  it('an empty lesson is finished at once', () => {
    const lesson = session([]);
    expect(lesson.phase.type).toBe('finished');
    expect(lesson.progress).toBe(1);
    expect(lesson.result?.exerciseCount).toBe(0);
    expect(accuracyOf(lesson.result!)).toBe(0);
  });

  it('a finished lesson stays finished', () => {
    const lesson = session([ex('typeAnswer', 'a')], ['a']);
    lesson.submit(typed('Berlin'));
    lesson.advance();
    const result = lesson.result;
    expect(result).toBeDefined();
    lesson.advance();
    expect(lesson.submit(typed('Paris'))).toBeUndefined();
    lesson.overrule();
    lesson.advance();
    expect(lesson.phase.type).toBe('finished');
    expect(lesson.position).toBe(1);
    expect(lesson.result).toEqual(result);
  });

  it('overruling twice counts once', () => {
    const lesson = session([ex('typeAnswer', 'a'), ex('typeAnswer', 'b')]);
    lesson.submit(typed('Paris'));
    lesson.overrule();
    lesson.overrule();
    lesson.advance();
    lesson.overrule();
    lesson.submit(typed('Rom'));
    lesson.advance();
    lesson.submit(typed('Berlin'));
    lesson.advance();
    expect([lesson.result?.rightFirstTry, lesson.result?.rightOnRetry]).toEqual([1, 1]);
    expect(lesson.result?.cardsRightFirstTry).toEqual(new Set(['a']));
  });

  it('a card listed twice is graded once', () => {
    const result: LessonResult = { lessonID: 'L1', sessionID: 's1', exerciseCount: 2, rightFirstTry: 2, rightOnRetry: 0, cardKeys: ['a', 'b', 'a'], cardsRightFirstTry: new Set(['a', 'b']), outcomes: [] };
    expect(gradesToApply(result, new Set(['a', 'b'])).map((g) => g.key)).toEqual(['a', 'b']);
    expect(new LessonSession('L1', ['a', 'a', 'b'], [ex('typeAnswer', 'a')], 's').cardKeys).toEqual(['a', 'b']);
  });

  it('only due cards are graded', () => {
    const result: LessonResult = { lessonID: 'L1', sessionID: 's1', exerciseCount: 6, rightFirstTry: 4, rightOnRetry: 1, cardKeys: ['a', 'b', 'c', 'd'], cardsRightFirstTry: new Set(['a', 'c']), outcomes: [] };
    const grades = gradesToApply(result, new Set(['a', 'b', 'x']));
    expect(grades.map((g) => g.key)).toEqual(['a', 'b']);
    expect(grades.map((g) => g.grade)).toEqual(['good', 'again']);
    expect(gradesToApply(result, new Set())).toHaveLength(0);
  });

  it('a built lesson runs to the end', () => {
    const cards = ['Berlin', 'Paris', 'Rom', 'Madrid', 'Wien', 'Prag'].map((city, i) => card(`Hauptstadt ${i}?`, city, i, null));
    const exercises = new ExerciseBuilder(cards, cards).build(3n);
    const lesson = new LessonSession(LearnPath.lessonID(cards.map((c) => c.key)), cards.map((c) => c.key), exercises, 's');
    let steps = 0;
    while (lesson.current && steps < 100) {
      const current = lesson.current;
      switch (current.kind) {
        case 'multipleChoice': case 'pianoKey': lesson.submit(option(current.correctAnswers[0])); break;
        case 'typeAnswer': lesson.submit(typed(current.correctAnswers[0])); break;
        case 'wordBank': lesson.submit({ type: 'words', value: current.correctAnswers }); break;
        case 'matchPairs': lesson.submit({ type: 'pairs', missed: new Set() }); break;
        case 'chessMove': lesson.submit({ type: 'move', value: current.correctAnswers[0] }); break;
      }
      lesson.advance();
      steps++;
    }
    expect(steps).toBe(exercises.length);
    expect(accuracyOf(lesson.result!)).toBe(1);
    expect(lesson.result?.cardsRightFirstTry).toEqual(new Set(cards.map((c) => c.key)));
  });

  it('trying again on the spot keeps the first attempt and spares the second round', () => {
    const lesson = session([ex('typeAnswer', 'a')], ['a']);
    expect(lesson.submit(typed('Paris'))).toBe('wrong');
    lesson.tryAgain();
    expect(lesson.phase.type).toBe('answering');
    expect(lesson.progress).toBe(0);
    expect(lesson.submit(typed('Rom'))).toBe('wrong');
    lesson.tryAgain();
    expect(lesson.submit(typed('Berlin'))).toBe('right');
    expect(lesson.progress).toBe(1);
    lesson.advance();
    expect(lesson.phase.type).toBe('finished');
    expect([lesson.result?.rightFirstTry, lesson.result?.rightOnRetry]).toEqual([0, 1]);
    expect(lesson.result?.outcomes).toHaveLength(0);
  });

  it('giving up after wrong tries still brings it back once', () => {
    const lesson = session([ex('typeAnswer', 'a')], ['a']);
    lesson.submit(typed('Paris'));
    lesson.tryAgain();
    lesson.submit(typed('Rom'));
    lesson.advance();
    expect(lesson.isRetry).toBe(true);
    expect(lesson.queue).toHaveLength(2);
  });

  it('only the first attempt reaches the skills', () => {
    const tagged = { ...ex('typeAnswer', 'a'), skill: 's.u01.main', level: 'recall' as const };
    const lesson = session([tagged], ['a']);
    lesson.submit(typed('Paris'));
    lesson.tryAgain();
    lesson.submit(typed('Berlin'));
    lesson.advance();
    expect(lesson.result?.outcomes).toEqual([{ exerciseID: tagged.id, skill: 's.u01.main', level: 'recall', right: false, helped: false }]);
  });

  it('overruling a try on the spot does not rewrite the first attempt', () => {
    const tagged = { ...ex('typeAnswer', 'a'), skill: 's.u01.main', level: 'recall' as const };
    const lesson = session([tagged], ['a']);
    lesson.submit(typed('Paris'));
    lesson.tryAgain();
    lesson.submit(typed('Berln'));
    lesson.overrule();
    lesson.advance();
    expect([lesson.result?.rightFirstTry, lesson.result?.rightOnRetry]).toEqual([0, 1]);
    expect(lesson.result?.outcomes[0].right).toBe(false);
  });

  it('try again only works after a wrong answer', () => {
    const lesson = session([ex('typeAnswer', 'a')], ['a']);
    lesson.tryAgain();
    expect(lesson.phase.type).toBe('answering');
    lesson.submit(typed('Berlin'));
    lesson.tryAgain();
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'right' });
  });
});
