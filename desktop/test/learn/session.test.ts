import { describe, expect, it } from 'vitest';
import { type ExerciseKind, LearnAnswer, type LearnExercise, learnExercise } from '../../src/lib/learn/exercise';
import { LessonGrading, LessonSession, lessonResult } from '../../src/lib/learn/session';
import type { ExerciseOutcome } from '../../src/lib/learn/skills/assessor';
import type { CompetenceLevel } from '../../src/lib/learn/skills/skill';

function exercise(kind: ExerciseKind, key: string, back = 'Berlin'): LearnExercise {
  return learnExercise({
    id: `${kind}:${key}`,
    kind,
    cardKeys: [key],
    prompt: `Frage ${key}`,
    correctAnswers: [back],
    options: kind === 'multipleChoice' ? [back, 'Paris', 'Rom', 'Madrid'] : [],
    solution: back,
  });
}

function pairs(keys: string[]): LearnExercise {
  const list = keys.map((key) => ({ key, front: `Frage ${key}`, back: `Antwort ${key}` }));
  return learnExercise({
    id: 'matchPairs:' + keys.join('+'),
    kind: 'matchPairs',
    cardKeys: keys,
    prompt: 'Finde die Paare',
    correctAnswers: list.map((p) => p.back),
    options: list.map((p) => p.back),
    pairs: list,
    solution: '',
  });
}

const session = (exercises: LearnExercise[], cards = ['a', 'b']) => new LessonSession('L1', cards, exercises, 's1');
const set = (...values: string[]) => new Set(values);

describe('LessonSession', () => {
  it('all right finishes with full accuracy', () => {
    const lesson = session([exercise('multipleChoice', 'a'), exercise('typeAnswer', 'a'), exercise('typeAnswer', 'b')]);
    expect(lesson.progress).toBe(0);
    expect(lesson.submit(LearnAnswer.option('Berlin'))).toBe('right');
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'right' });
    expect(lesson.progress).toBeCloseTo(1 / 3, 4);
    expect(lesson.result).toBeNull();
    lesson.advance();
    expect(lesson.submit(LearnAnswer.typed('berlin'))).toBe('right');
    lesson.advance();
    expect(lesson.submit(LearnAnswer.typed('Berlin'))).toBe('right');
    lesson.advance();
    expect(lesson.phase.type).toBe('finished');
    expect(lesson.current).toBeNull();
    expect(lesson.progress).toBe(1);
    const result = lesson.result!;
    expect(result.exerciseCount).toBe(3);
    expect(result.rightFirstTry).toBe(3);
    expect(result.rightOnRetry).toBe(0);
    expect(result.accuracy).toBe(1);
    expect(result.cardsRightFirstTry).toEqual(set('a', 'b'));
    expect(result.lessonID).toBe('L1');
    expect(result.sessionID).toBe('s1');
  });

  it('a wrong exercise comes back exactly once', () => {
    const lesson = session([exercise('multipleChoice', 'a'), exercise('typeAnswer', 'b')]);
    expect(lesson.submit(LearnAnswer.option('Paris'))).toBe('wrong');
    expect(lesson.progress).toBe(0);
    lesson.advance();
    expect(lesson.queue.length).toBe(3);
    expect(lesson.isRetry).toBe(false);
    lesson.submit(LearnAnswer.typed('Berlin'));
    lesson.advance();

    expect(lesson.current?.id).toBe('multipleChoice:a');
    expect(lesson.isRetry).toBe(true);
    expect(lesson.submit(LearnAnswer.option('Rom'))).toBe('wrong');
    expect(lesson.progress).toBe(1);
    lesson.advance();
    expect(lesson.queue.length).toBe(3); // a second wrong answer does not queue it again
    expect(lesson.phase.type).toBe('finished');
    expect(lesson.result?.rightFirstTry).toBe(1);
    expect(lesson.result?.rightOnRetry).toBe(0);
    expect(lesson.result?.accuracy).toBe(0.5);
    expect(lesson.result?.cardsRightFirstTry).toEqual(set('b'));
  });

  it('a right retry counts as retry, not as first try', () => {
    const lesson = session([exercise('typeAnswer', 'a')], ['a']);
    lesson.submit(LearnAnswer.typed('Paris'));
    lesson.advance();
    expect(lesson.submit(LearnAnswer.typed('Berlin'))).toBe('right');
    lesson.advance();
    expect(lesson.result?.rightFirstTry).toBe(0);
    expect(lesson.result?.rightOnRetry).toBe(1);
    expect(lesson.result?.cardsRightFirstTry).toEqual(set());
  });

  it('progress never goes back', () => {
    const lesson = session([exercise('multipleChoice', 'a'), exercise('multipleChoice', 'b'), exercise('typeAnswer', 'a')]);
    let last = lesson.progress;
    const answers = ['Paris', 'Berlin', 'Rom', 'Berlin'];
    let index = 0;
    while (lesson.phase.type !== 'finished') {
      const answer = answers[Math.min(index, answers.length - 1)];
      const current = lesson.current!;
      lesson.submit(current.kind === 'typeAnswer' ? LearnAnswer.typed(answer) : LearnAnswer.option(answer));
      expect(lesson.progress).toBeGreaterThanOrEqual(last);
      last = lesson.progress;
      lesson.advance();
      expect(lesson.progress).toBeGreaterThanOrEqual(last);
      index += 1;
    }
    expect(lesson.progress).toBe(1);
  });

  it('overruled typing counts as right', () => {
    const lesson = session([exercise('typeAnswer', 'a', 'Die Photosynthese wandelt Licht in chemische Energie um')], ['a']);
    expect(lesson.submit(LearnAnswer.typed('Licht wird zu Zucker'))).toBe('wrong');
    lesson.overrule();
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'right' });
    lesson.advance();
    expect(lesson.queue.length).toBe(1); // an overruled answer does not come back
    expect(lesson.result?.rightFirstTry).toBe(1);
    expect(lesson.result?.cardsRightFirstTry).toEqual(set('a'));
  });

  it('only typing can be overruled', () => {
    const lesson = session([exercise('multipleChoice', 'a')], ['a']);
    lesson.submit(LearnAnswer.option('Paris'));
    lesson.overrule();
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'wrong' });
  });

  it('a second tap neither answers twice nor skips', () => {
    const lesson = session([exercise('typeAnswer', 'a'), exercise('typeAnswer', 'b')]);
    expect(lesson.submit(LearnAnswer.typed('Paris'))).toBe('wrong');
    expect(lesson.submit(LearnAnswer.typed('Berlin'))).toBeNull();
    expect(lesson.phase).toEqual({ type: 'feedback', verdict: 'wrong' });
    lesson.advance();
    lesson.advance();
    expect(lesson.current?.id).toBe('typeAnswer:b');
    expect(lesson.queue.length).toBe(3);
  });

  it('pairs mark only the missed cards', () => {
    const lesson = session([pairs(['a', 'b', 'c', 'd'])], ['a', 'b', 'c', 'd']);
    expect(lesson.submit(LearnAnswer.pairs(['c', 'x']))).toBe('wrong');
    lesson.advance();
    lesson.submit(LearnAnswer.pairs([]));
    lesson.advance();
    expect(lesson.result?.cardsRightFirstTry).toEqual(set('a', 'b', 'd'));
  });

  it('a card wrong in any first try is wrong', () => {
    const lesson = session([exercise('multipleChoice', 'a'), exercise('typeAnswer', 'a')], ['a']);
    lesson.submit(LearnAnswer.option('Berlin'));
    lesson.advance();
    lesson.submit(LearnAnswer.typed('Rom'));
    lesson.advance();
    lesson.submit(LearnAnswer.typed('Berlin'));
    lesson.advance();
    expect(lesson.result?.cardsRightFirstTry).toEqual(set());
  });

  it('an empty lesson is finished at once', () => {
    const lesson = session([]);
    expect(lesson.phase.type).toBe('finished');
    expect(lesson.progress).toBe(1);
    expect(lesson.result?.exerciseCount).toBe(0);
    expect(lesson.result?.accuracy).toBe(0);
  });

  it('a finished lesson stays finished', () => {
    const lesson = session([exercise('typeAnswer', 'a')], ['a']);
    lesson.submit(LearnAnswer.typed('Berlin'));
    lesson.advance();
    const result = lesson.result;
    expect(result).not.toBeNull();
    lesson.advance();
    expect(lesson.submit(LearnAnswer.typed('Paris'))).toBeNull();
    lesson.overrule();
    lesson.advance();
    expect(lesson.phase.type).toBe('finished');
    expect(lesson.position).toBe(1);
    expect(lesson.result).toEqual(result);
  });

  it('overruling twice counts once', () => {
    const lesson = session([exercise('typeAnswer', 'a'), exercise('typeAnswer', 'b')]);
    lesson.submit(LearnAnswer.typed('Paris'));
    lesson.overrule();
    lesson.overrule();
    lesson.advance();
    lesson.overrule();
    lesson.submit(LearnAnswer.typed('Rom'));
    lesson.advance();
    lesson.submit(LearnAnswer.typed('Berlin'));
    lesson.advance();
    expect(lesson.result?.rightFirstTry).toBe(1);
    expect(lesson.result?.rightOnRetry).toBe(1);
    expect(lesson.result?.cardsRightFirstTry).toEqual(set('a'));
  });

  it('a card listed twice is graded once', () => {
    const result = lessonResult({
      lessonID: 'L1',
      sessionID: 's1',
      exerciseCount: 2,
      rightFirstTry: 2,
      rightOnRetry: 0,
      cardKeys: ['a', 'b', 'a'],
      cardsRightFirstTry: set('a', 'b'),
    });
    expect(LessonGrading.gradesToApply(result, set('a', 'b')).map((g) => g.key)).toEqual(['a', 'b']);
    const s = new LessonSession('L1', ['a', 'a', 'b'], [exercise('typeAnswer', 'a')], 's');
    expect(s.cardKeys).toEqual(['a', 'b']);
  });

  it('only due cards are graded', () => {
    const result = lessonResult({
      lessonID: 'L1',
      sessionID: 's1',
      exerciseCount: 6,
      rightFirstTry: 4,
      rightOnRetry: 1,
      cardKeys: ['a', 'b', 'c', 'd'],
      cardsRightFirstTry: set('a', 'c'),
    });
    const grades = LessonGrading.gradesToApply(result, set('a', 'b', 'x'));
    expect(grades.map((g) => g.key)).toEqual(['a', 'b']);
    expect(grades.map((g) => g.grade)).toEqual(['good', 'again']);
    expect(LessonGrading.gradesToApply(result, set())).toEqual([]);
  });

  it('a lesson of every kind runs to the end', () => {
    // The Swift test builds a lesson from flashcards (ExerciseBuilder, not ported); here a hand-made lesson of every kind.
    const kinds: LearnExercise[] = [
      exercise('multipleChoice', 'a'),
      pairs(['a', 'b', 'c', 'd']),
      exercise('wordBank', 'b'),
      exercise('chessMove', 'c', 'e2e4'),
      exercise('pianoKey', 'd', '60'),
      exercise('typeAnswer', 'a'),
    ];
    const lesson = new LessonSession('L', ['a', 'b', 'c', 'd'], kinds, 's');
    let steps = 0;
    for (let current = lesson.current; current && steps < 100; current = lesson.current) {
      switch (current.kind) {
        case 'multipleChoice':
        case 'pianoKey':
          lesson.submit(LearnAnswer.option(current.correctAnswers[0]));
          break;
        case 'typeAnswer':
          lesson.submit(LearnAnswer.typed(current.correctAnswers[0]));
          break;
        case 'wordBank':
          lesson.submit(LearnAnswer.words(current.correctAnswers));
          break;
        case 'matchPairs':
          lesson.submit(LearnAnswer.pairs([]));
          break;
        case 'chessMove':
          lesson.submit(LearnAnswer.move(current.correctAnswers[0]));
          break;
      }
      lesson.advance();
      steps += 1;
    }
    expect(steps).toBe(kinds.length);
    expect(lesson.result?.accuracy).toBe(1);
    expect(lesson.result?.cardsRightFirstTry).toEqual(set('a', 'b', 'c', 'd'));
  });
});

// SkillFeedbackTests: the parts that need only the session.
describe('hints and outcomes', () => {
  const ex = (id: string, o: { skill?: string; level?: CompetenceLevel; hints?: string[] } = {}) =>
    learnExercise({
      id,
      kind: 'multipleChoice',
      prompt: '?',
      correctAnswers: ['a'],
      options: ['a', 'b'],
      solution: 'a',
      skill: o.skill ?? 'c.u1.main',
      level: o.level ?? 'recognise',
      hints: o.hints ?? [],
    });

  it('hints come one at a time and stop at the last', () => {
    const s = new LessonSession('l', [], [ex('e1', { hints: ['eins', 'zwei'] })], 's');
    expect(s.hasMoreHints).toBe(true);
    expect(s.showHint()).toEqual(['eins']);
    expect(s.showHint()).toEqual(['eins', 'zwei']);
    expect(s.showHint()).toEqual(['eins', 'zwei']);
    expect(s.hasMoreHints).toBe(false);
    expect(s.hintCount).toBe(2);
    expect(s.shownHints).toEqual(['eins', 'zwei']);
  });

  it('an exercise without hints shows none', () => {
    const s = new LessonSession('l', [], [ex('e1')], 's');
    expect(s.hasMoreHints).toBe(false);
    expect(s.showHint()).toEqual([]);
  });

  it('the outcome of an exercise is its first attempt and remembers help', () => {
    const s = new LessonSession('l', [], [ex('e1', { hints: ['h'] }), ex('e2'), ex('e3', { skill: '' })], 's');
    // e1: a hint, then wrong, then right on the retry.
    s.showHint();
    s.submit(LearnAnswer.option('b'));
    s.advance();
    // e2: right at once.
    s.submit(LearnAnswer.option('a'));
    s.advance();
    // e3 belongs to no skill.
    s.submit(LearnAnswer.option('a'));
    s.advance();
    // The retry of e1.
    s.submit(LearnAnswer.option('a'));
    s.advance();
    const result = s.result!;
    expect(result.outcomes.map((o) => o.exerciseID)).toEqual(['e1', 'e2']);
    const expected: ExerciseOutcome = { exerciseID: 'e1', skill: 'c.u1.main', level: 'recognise', right: false, helped: true };
    expect(result.outcomes[0]).toEqual(expected);
    expect(result.outcomes[1].right).toBe(true);
    expect(result.outcomes[1].helped).toBe(false);
  });

  it('a retry answered with a hint does not change the first outcome', () => {
    const s = new LessonSession('l', [], [ex('e1', { hints: ['h'] })], 's');
    s.submit(LearnAnswer.option('b'));
    s.advance();
    s.showHint();
    s.submit(LearnAnswer.option('a'));
    s.advance();
    expect(s.result?.outcomes).toEqual([{ exerciseID: 'e1', skill: 'c.u1.main', level: 'recognise', right: false, helped: false }]);
  });

  it('overruling a typed answer makes its outcome right', () => {
    const typed = learnExercise({
      id: 't',
      kind: 'typeAnswer',
      prompt: '?',
      correctAnswers: ['Haus'],
      solution: 'Haus',
      skill: 'c.u1.main',
      level: 'recall',
    });
    const s = new LessonSession('l', [], [typed], 's');
    s.submit(LearnAnswer.typed('Hous'));
    s.overrule();
    s.advance();
    expect(s.result?.outcomes[0]?.right).toBe(true);
  });

  it('rounds of cards have no outcomes and keep their behaviour', () => {
    const plain = learnExercise({
      id: 'p',
      kind: 'multipleChoice',
      cardKeys: ['k'],
      prompt: '?',
      correctAnswers: ['a'],
      options: ['a', 'b'],
      solution: 'a',
    });
    const s = new LessonSession('l', ['k'], [plain], 's');
    s.submit(LearnAnswer.option('a'));
    s.advance();
    expect(s.result?.outcomes).toEqual([]);
    expect(s.result?.cardsRightFirstTry).toEqual(set('k'));
  });
});
