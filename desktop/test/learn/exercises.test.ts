import { describe, expect, it } from 'vitest';
import { standardUnit } from '../../src/lib/learn/course';
import { LearnAnswer, learnExercise, missedKeys, isMatch, sameWords, folded, difficulty } from '../../src/lib/learn/exercise';
import { ExerciseBuilder } from '../../src/lib/learn/exerciseConstants';
import { Exercises } from '../../src/lib/learn/exercises';
import { boardSpec } from '../../src/lib/learn/media';
import { LearnRandom } from '../../src/lib/learn/random';
import { LessonSession } from '../../src/lib/learn/session';

const missed = (e: Parameters<typeof missedKeys>[0], a: LearnAnswer) => [...missedKeys(e, a)].sort();

describe('Exercise factory', () => {
  const random = new LearnRandom(7n);

  it('choice keeps the right answer once and drops lookalikes', () => {
    const exercise = Exercises.choice(
      { id: 'c', prompt: 'Hauptstadt?', correct: 'Berlin', wrong: ['berlin', 'Paris', 'Paris', 'Rom', 'Wien', 'Madrid', ' '] },
      random,
    )!;
    expect(exercise.options.length).toBe(4);
    expect(exercise.options.filter((o) => o === 'Berlin').length).toBe(1);
    expect(new Set(exercise.options).size).toBe(4);
    expect(exercise.correctAnswers).toEqual(['Berlin']);
    expect(missed(exercise, LearnAnswer.option('Berlin'))).toEqual([]);
    expect(missed(exercise, LearnAnswer.option('Paris'))).toEqual(['c']);
    expect(Exercises.choice({ id: 'x', prompt: '?', correct: 'A', wrong: ['a', ' '] }, random)).toBeNull();
    const trueFalse = Exercises.choice({ id: 'tf', prompt: 'Stimmt das?', correct: 'Richtig', wrong: ['Falsch'] }, random)!;
    expect(trueFalse.options.length).toBe(2);
  });

  it('typed keeps alternatives', () => {
    const exercise = Exercises.typed({ id: 't', key: 'k1', prompt: 'adiós', answer: 'tschüss', alternatives: ['auf Wiedersehen'] })!;
    expect(missed(exercise, LearnAnswer.typed('Tschuess'))).toEqual([]);
    expect(missed(exercise, LearnAnswer.typed('auf wiedersehen'))).toEqual([]);
    expect(missed(exercise, LearnAnswer.typed('hallo'))).toEqual(['k1']);
    expect(Exercises.typed({ id: 'e', prompt: '?', answer: '  ' })).toBeNull();
  });

  it('exact answers forgive only capitals, accents and punctuation', () => {
    const exercise = Exercises.typed({ id: 'x', key: 'k', prompt: '?', answer: '¿Cómo te llamas?', mode: 'exact' })!;
    expect(missed(exercise, LearnAnswer.typed('como te llamas'))).toEqual([]);
    expect(missed(exercise, LearnAnswer.typed('CÓMO TE LLAMAS?'))).toEqual([]);
    expect(missed(exercise, LearnAnswer.typed('te llamas cómo'))).toEqual(['k']);
    expect(missed(exercise, LearnAnswer.typed('como te llamar'))).toEqual(['k']);
    expect(missed(exercise, LearnAnswer.typed('  '))).toEqual(['k']);
    expect(missed(exercise, LearnAnswer.typed('¿?'))).toEqual(['k']);
  });

  it('bank tiles never come in the right order', () => {
    for (let seed = 1n; seed <= 30n; seed++) {
      const rng = new LearnRandom(seed);
      const exercise = Exercises.bank(
        { id: 'b', prompt: '?', words: ['Me', 'llamo', 'Ana.'], extra: ['casa', 'perro', 'gato'] },
        rng,
      )!;
      expect(exercise.options.slice(0, 3)).not.toEqual(['Me', 'llamo', 'Ana.']);
      expect(exercise.options.length).toBe(5); // two extra tiles at most
      expect(missed(exercise, LearnAnswer.words(['me', 'Llamo', 'Ana']))).toEqual([]); // case and the full stop do not matter
    }
    expect(Exercises.bank({ id: 'one', prompt: '?', words: ['Hola'] }, random)).toBeNull();
    expect(Exercises.tiles('Ich heiße Ana.')).toEqual(['Ich', 'heiße', 'Ana.']);
  });

  it('pairs need four distinct items', () => {
    const items = [
      ['a', 'uno', 'eins'],
      ['b', 'dos', 'zwei'],
      ['c', 'tres', 'drei'],
      ['d', 'cuatro', 'vier'],
    ].map(([key, front, back]) => ({ key, front, back }));
    const exercise = Exercises.pairs({ id: 'p', items }, random)!;
    expect([...exercise.cardKeys].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(missed(exercise, LearnAnswer.pairs(['b']))).toEqual(['b']);
    expect(missed(exercise, LearnAnswer.pairs([]))).toEqual([]);
    expect(exercise.prompt).toBe(ExerciseBuilder.pairsPrompt);
    expect(Exercises.pairs({ id: 'x', items: items.slice(0, 3) }, random)).toBeNull();
    const twins = items.slice();
    twins[1] = { key: 'b', front: 'dos', back: 'Eins' };
    expect(Exercises.pairs({ id: 'y', items: twins }, random)).toBeNull();
    expect(isMatch(exercise, 'a', 'Eins')).toBe(true);
    expect(isMatch(exercise, 'a', 'zwei')).toBe(false);
    expect(isMatch(exercise, 'zz', 'eins')).toBe(false);
  });

  it('chess and piano answers', () => {
    const board = boardSpec('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const move = Exercises.move({ id: 'm', prompt: 'Matt in 1', board, accepted: ['a1a8'], solution: 'Ta8#' })!;
    expect(missed(move, LearnAnswer.move('a1a8'))).toEqual([]);
    expect(missed(move, LearnAnswer.move('a1a7'))).toEqual(['m']);
    expect(missed(move, LearnAnswer.option('a1a8'))).toEqual(['m']);
    expect(move.media).toEqual({ type: 'board', board });
    expect(Exercises.move({ id: 'n', prompt: '?', board, accepted: [], solution: '' })).toBeNull();
    const key = Exercises.key({ id: 'k', prompt: 'Tippe das C', midi: [60, 72], solution: 'C' })!;
    expect(missed(key, LearnAnswer.option('72'))).toEqual([]);
    expect(missed(key, LearnAnswer.option('61'))).toEqual(['k']);
    expect(Exercises.key({ id: 'k', prompt: '', midi: [], solution: '' })).toBeNull();
  });

  it('arrange sorts easy first, drops duplicates and cuts', () => {
    const rng = new LearnRandom(7n);
    const easy = Exercises.choice({ id: 'easy', prompt: '?', correct: 'A', wrong: ['B'] }, rng)!;
    const hard = Exercises.typed({ id: 'hard', prompt: '?', answer: 'A' })!;
    const arranged = Exercises.arrange([hard, null, easy, easy]);
    expect(arranged.map((e) => e.id)).toEqual(['easy', 'hard']);
    const many = Array.from({ length: 20 }, (_, i) => Exercises.typed({ id: `t${i}`, prompt: '?', answer: 'A' }));
    expect(Exercises.arrange(many).length).toBe(ExerciseBuilder.maxExercises);
    expect(Exercises.arrange(many).map((e) => e.id)).toEqual(Array.from({ length: 12 }, (_, i) => `t${i}`));
  });

  it('seeds differ by node and repeat for the same', () => {
    const unit = standardUnit('x', 1, 'T', '', 't');
    const a = Exercises.seed(unit.nodes[0], 5n);
    expect(a).toBe(Exercises.seed(unit.nodes[0], 5n));
    expect(a).not.toBe(Exercises.seed(unit.nodes[1], 5n));
    expect(a).not.toBe(Exercises.seed(unit.nodes[0], 6n));
  });

  it('no cards still means wrong when wrong', () => {
    const rng = new LearnRandom(7n);
    const exercise = Exercises.choice({ id: 'solo', prompt: '?', correct: 'A', wrong: ['B', 'C'] }, rng)!;
    const session = new LessonSession('x.u01.l1', [], [exercise], 's');
    expect(session.submit(LearnAnswer.option('B'))).toBe('wrong');
    session.advance();
    expect(session.queue.length).toBe(2); // the wrong exercise comes back once
    expect(session.submit(LearnAnswer.option('A'))).toBe('right');
    session.advance();
    expect(session.result?.rightFirstTry).toBe(0);
    expect(session.result?.rightOnRetry).toBe(1);
  });

  // Extra cases
  it('the kinds go from easy to hard and the helpers fold', () => {
    expect(['multipleChoice', 'pianoKey', 'matchPairs', 'chessMove', 'wordBank', 'typeAnswer'].map((k) => difficulty(k as never))).toEqual([0, 0, 1, 2, 2, 3]);
    expect(folded('Größe!')).toBe(folded('groesse'));
    expect(sameWords(['Der', 'Hund.'], ['der', 'hund'])).toBe(true);
    expect(sameWords(['Der'], ['der', 'hund'])).toBe(false);
  });

  it('a wrong kind of answer is always wrong', () => {
    const e = learnExercise({ id: 'q', kind: 'typeAnswer', prompt: '?', correctAnswers: ['a'], solution: 'a' });
    expect(missed(e, LearnAnswer.option('a'))).toEqual(['q']);
    const none = learnExercise({ id: 'z', kind: 'typeAnswer', prompt: '?', correctAnswers: [], solution: 'a' });
    expect(missed(none, LearnAnswer.typed('a'))).toEqual(['z']);
  });

  it('a pairs answer only reports cards of the exercise', () => {
    const e = learnExercise({ id: 'pp', kind: 'matchPairs', cardKeys: ['a', 'b'], prompt: '?', correctAnswers: [], solution: '' });
    expect(missed(e, LearnAnswer.pairs(['b', 'x']))).toEqual(['b']);
  });
});
