import { describe, expect, it } from 'vitest';
import type { CourseNode, CourseProvider } from '../../src/lib/learn/course';
import { CoursePath } from '../../src/lib/learn/coursePath';
import { LearnAnswer, type LearnExercise, learnExercise } from '../../src/lib/learn/exercise';
import { Exercises } from '../../src/lib/learn/exercises';
import { LearnController, LessonModel } from '../../src/lib/learn/lessonController';
import { LearnRandom } from '../../src/lib/learn/random';
import { LearnProgress } from '../../src/lib/learn/progress';
import { LearnProgressStore, MemoryStore, QuestStore, SkillMaps, SkillStore } from '../../src/lib/learn/store';
import { at, calendar } from './kit';
import { SampleCourse } from './sample';

const start = 1_800_000_000_000;
const cal = calendar('Europe/Berlin');

const typing = (key: string, back: string): LearnExercise =>
  learnExercise({ id: `typeAnswer:${key}`, kind: 'typeAnswer', cardKeys: [key], prompt: `Frage ${key}`, correctAnswers: [back], solution: back });

describe('LessonModel', () => {
  it('the result is handed out once', () => {
    const model = new LessonModel({ lessonID: 'cards', exercises: [typing('a', 'Berlin')], sessionID: 'run', cardKeys: ['a'] });
    expect(model.takeResult()).toBeNull();
    expect(model.canCheck).toBe(false);
    model.typed = '  ';
    expect(model.canCheck).toBe(false);
    model.typed = 'Berlin';
    expect(model.check()).toBe('right');
    expect(model.check()).toBeNull(); // a second tap on Prüfen does nothing
    model.advance();
    model.advance();
    expect(model.typed).toBe('');
    const result = model.takeResult();
    expect(result?.sessionID).toBe('run');
    expect(result?.lessonID).toBe('cards');
    expect(result?.rightFirstTry).toBe(1);
    expect(model.takeResult()).toBeNull();
  });

  it('an empty lesson is handed out once and counts nothing', () => {
    const model = new LessonModel({ lessonID: 'empty', exercises: [], sessionID: 'empty' });
    const result = model.takeResult();
    expect(result?.exerciseCount).toBe(0);
    expect(model.takeResult()).toBeNull();
    const progress = new LearnProgress();
    expect(progress.record(result!, { now: start, calendar: cal })).toBeNull();
  });

  it('pairs count a miss and finish on the last match', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const pairs = keys.map((key) => ({ key, front: `Frage ${key}`, back: `Antwort ${key}` }));
    const exercise = learnExercise({
      id: 'matchPairs:a+b+c+d',
      kind: 'matchPairs',
      cardKeys: keys,
      prompt: 'Finde die Paare',
      correctAnswers: pairs.map((p) => p.back),
      options: pairs.map((p) => p.back).reverse(),
      pairs,
      solution: '',
    });
    const model = new LessonModel({ lessonID: 'p', exercises: [exercise], sessionID: 'pairs', cardKeys: keys });
    expect(model.canCheck).toBe(false);
    // options: d, c, b, a
    expect(model.pickFront('a')).toBeNull();
    expect(model.pickBack(0)).toEqual({ type: 'miss' });
    expect(model.lastMiss).toEqual({ key: 'a', back: 0 });
    expect(model.pickBack(3)).toBeNull();
    expect(model.pickFront('a')).toEqual({ type: 'match' });
    expect(model.pickFront('a')).toBeNull(); // a matched card cannot be picked again
    expect(model.pickBack(3)).toBeNull();
    expect(model.pickFront('b')).toBeNull();
    expect(model.pickBack(2)).toEqual({ type: 'match' });
    expect(model.pickFront('c')).toBeNull();
    expect(model.pickBack(1)).toEqual({ type: 'match' });
    expect(model.pickBack(0)).toBeNull();
    expect(model.pickFront('d')).toEqual({ type: 'finished', verdict: 'wrong' });
    expect(model.verdict).toBe('wrong');
    expect(model.pickFront('d')).toBeNull();
    model.advance();
    // The round comes back once; without a miss it is right.
    expect(model.matched.size).toBe(0);
    ['d', 'c', 'b', 'a'].forEach((key, index) => {
      model.pickFront(key);
      model.pickBack(index);
    });
    expect(model.verdict).toBe('right');
    model.advance();
    const result = model.takeResult();
    expect(result?.cardsRightFirstTry).toEqual(new Set(['b', 'c', 'd']));
    expect(result?.rightOnRetry).toBe(1);
  });

  it('word bank tiles go in and out', () => {
    const exercise = learnExercise({
      id: 'wordBank:a',
      kind: 'wordBank',
      cardKeys: ['a'],
      prompt: '?',
      correctAnswers: ['Der', 'Zellkern', 'steuert'],
      options: ['steuert', 'Zellwand', 'Der', 'Zellkern'],
      solution: 'Der Zellkern steuert',
    });
    const model = new LessonModel({ lessonID: 'b', exercises: [exercise], sessionID: 'bank', cardKeys: ['a'] });
    expect(model.canCheck).toBe(false);
    model.addTile(2);
    model.addTile(1);
    model.addTile(2);
    expect(model.tiles).toEqual([2, 1]);
    model.removeTile(1);
    model.addTile(3);
    model.addTile(0);
    expect(model.check()).toBe('right');
    model.addTile(1);
    expect(model.tiles).toEqual([2, 3, 0]); // tiles are locked while the verdict shows
  });

  // Extra cases
  it('chess squares: pick, put down, move, start over', () => {
    const move = Exercises.move({ id: 'm', prompt: '?', board: { fen: '8/8/8/8/8/8/8/8 w - - 0 1', flipped: false, marked: [] }, accepted: ['e2e4'], solution: 'e4' })!;
    const model = new LessonModel({ lessonID: 'c', exercises: [move], sessionID: 's' });
    expect(model.canCheck).toBe(false);
    model.tapSquare('e2');
    expect(model.moveFrom).toBe('e2');
    model.tapSquare('e2');
    expect(model.moveFrom).toBeNull();
    model.tapSquare('e2');
    model.tapSquare('e4');
    expect(model.canCheck).toBe(true);
    model.tapSquare('d2');
    expect([model.moveFrom, model.moveTo]).toEqual(['d2', null]);
    model.tapSquare('e2');
    model.moveFrom = 'e2';
    model.moveTo = 'e4';
    expect(model.check()).toBe('right');
  });

  it('the coach explains a wrong answer and is quiet after a right one', () => {
    const calls: string[] = [];
    const model = new LessonModel({
      lessonID: 'c',
      exercises: [typing('a', 'Berlin'), typing('b', 'Rom')],
      sessionID: 's',
      coach: (e, a) => {
        calls.push(e.id);
        return a.type === 'typed' ? `nicht ${a.value}` : null;
      },
    });
    model.typed = 'Paris';
    expect(model.check()).toBe('wrong');
    expect(model.coachNote).toBe('nicht Paris');
    model.advance();
    expect(model.coachNote).toBe('');
    model.typed = 'Rom';
    expect(model.check()).toBe('right');
    expect(model.coachNote).toBe('');
    expect(calls).toEqual(['typeAnswer:a']);
  });

  it('hints are passed through', () => {
    const e = learnExercise({ id: 'h', kind: 'typeAnswer', prompt: '?', correctAnswers: ['a'], solution: 'a', hints: ['x', 'y'] });
    const model = new LessonModel({ lessonID: 'h', exercises: [e], sessionID: 's' });
    expect(model.hintTotal).toBe(2);
    expect(model.hasMoreHints).toBe(true);
    model.showHint();
    expect(model.hintsShown).toEqual(['x']);
  });
});

// A provider with real exercises on the sample course's structure.
class ExerciseSample extends SampleCourse {
  override exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    if (node.kind === 'chest') return [];
    const rng = new LearnRandom(Exercises.seed(node, seed));
    const list: (LearnExercise | null)[] = [];
    for (let i = 0; i < 10; i++) {
      list.push(Exercises.choice({ id: `${node.id}#c${i}`, prompt: `Q${i}?`, correct: 'A', wrong: ['B', 'C', 'D'] }, rng));
    }
    list.push(Exercises.typed({ id: `${node.id}#t`, prompt: 'Tippe A', answer: 'A' }));
    return Exercises.arrange(list);
  }
}

function setup() {
  const provider: CourseProvider = new ExerciseSample();
  const storage = new MemoryStore();
  const progress = new LearnProgressStore(storage);
  const quests = new QuestStore(storage);
  const skills = new SkillStore(storage);
  let now = at(cal, 2026, 10, 9, 10);
  let seed = 100n;
  const controller = new LearnController({
    progress,
    quests,
    skills,
    clock: () => now,
    calendar: () => cal,
    newSeed: () => seed++,
    provider: (id) => (id === 'sample' ? provider : undefined),
  });
  return {
    provider, storage, progress, quests, skills, controller,
    setNow: (v: number) => { now = v; },
  };
}

function playPerfect(controller: LearnController, run: NonNullable<ReturnType<LearnController['startTestOut']>>, sessionID: string) {
  const model = controller.newModel(run, sessionID);
  while (model.current) {
    const e = model.current;
    if (e.kind === 'typeAnswer') model.typed = e.correctAnswers[0];
    else model.choice = e.correctAnswers[0];
    model.check();
    model.advance();
  }
  return model.takeResult()!;
}

describe('LearnController', () => {
  it('a step becomes a round; finishing it records progress, skills and quests', () => {
    const { provider, controller, progress, skills, quests } = setup();
    const units = CoursePath.units(provider.course, progress.progress.completedLessons);
    const first = CoursePath.current(units)!;
    const started = controller.startStep(first, 'sample');
    expect(started.type).toBe('run');
    if (started.type !== 'run') return;
    expect(started.run.completes).toBe(true);
    expect(skills.records[SkillMaps.map(provider).skills[0].id].started.has(first.id)).toBe(true);
    const model = controller.newModel(started.run, 'run-1');
    while (model.current) {
      const e = model.current;
      if (e.kind === 'typeAnswer') model.typed = e.correctAnswers[0];
      else model.choice = e.correctAnswers[0];
      model.check();
      model.advance();
    }
    const result = model.takeResult()!;
    expect(result.rightFirstTry).toBe(11);
    expect(result.outcomes.length).toBe(11);
    const rewards = controller.finish(result, started.run);
    expect(rewards.gems).toBeGreaterThan(0);
    expect(rewards.streakExtended).toBe(true);
    expect(progress.progress.isCompleted(first.id)).toBe(true);
    expect(progress.progress.xpInCourse('sample')).toBeGreaterThan(0);
    expect(skills.records[SkillMaps.map(provider).skills[0].id].attempts).toBe(11);
    expect(quests.board.daily.length).toBe(3);
    expect(quests.board.daily.some((q) => q.progress > 0)).toBe(true);
    // The same run counts once.
    expect(controller.finish(result, started.run)).toEqual({ gems: 0, quests: [], freezesUsed: 0, streakExtended: false, notes: [] });
    // The next step is open now.
    const next = CoursePath.current(CoursePath.units(provider.course, progress.progress.completedLessons))!;
    expect(next.id).toBe('sample.u01.l2');
  });

  it('a locked step and an unknown course start nothing; a chest opens once', () => {
    const { provider, controller, progress } = setup();
    const units = CoursePath.units(provider.course, new Set());
    expect(controller.startStep(units[0].steps[1], 'sample')).toEqual({ type: 'none', notice: null });
    expect(controller.startStep(units[0].steps[0], 'nope')).toEqual({ type: 'none', notice: null });
    const chest = { node: provider.course.nodes[5], state: 'open' as const, id: 'sample.u01.k' };
    const opened = controller.startStep(chest, 'sample');
    expect(opened).toEqual({ type: 'chest', gems: 15, notice: 'Du hast 15 Gems gefunden.' });
    expect(progress.progress.gems).toBe(15);
    expect(controller.startStep(chest, 'sample')).toEqual({ type: 'none', notice: null });
  });

  it('a practice round earns XP and marks no step as done', () => {
    const { provider, controller, progress } = setup();
    const target = SkillMaps.map(provider).skills[0].id;
    const started = controller.startPractice([target], 'sample');
    expect(started.type).toBe('run');
    if (started.type !== 'run') return;
    expect(started.run.completes).toBe(false);
    expect(started.run.lessonID).toBe('practice.sample');
    expect(started.run.node).toBeNull();
    const model = controller.newModel(started.run, 'p1');
    while (model.current) {
      const e = model.current;
      if (e.kind === 'typeAnswer') model.typed = e.correctAnswers[0];
      else model.choice = e.correctAnswers[0];
      model.check();
      model.advance();
    }
    controller.finish(model.takeResult()!, started.run);
    expect(progress.progress.totalXP).toBeGreaterThan(0);
    expect(progress.progress.completedLessons.size).toBe(0);
    expect(controller.startPractice(['nowhere'], 'sample')).toEqual({ type: 'none', notice: 'Dazu gibt es gerade nichts zu üben.' });
  });

  it('passing the test of the first unit skips it; failing it does not', () => {
    const { provider, controller, progress } = setup();
    const unit = provider.course.units[0];
    expect(controller.canTestOut(unit, 'sample')).toBe(true);
    expect(controller.canTestOut(provider.course.units[1], 'sample')).toBe(false);
    const run = controller.startTestOut(unit, 'sample')!;
    expect(run.kind).toBe('checkpoint');
    expect(run.completes).toBe(false);
    const result = playPerfect(controller, run, 't1');
    const rewards = controller.finish(result, run);
    expect(rewards.notes).toEqual(['Einheit übersprungen: Einheit 1. Als Fähigkeit zählt nur, was der Test gezeigt hat.']);
    for (const id of ['l1', 'l2', 'l3', 'p', 't']) expect(progress.progress.isCompleted(`sample.u01.${id}`)).toBe(true);
    expect(progress.progress.isCompleted('sample.u01.k')).toBe(false);
    expect(controller.canTestOut(unit, 'sample')).toBe(false); // started: no longer untouched

    // A failed test on the next unit says what is needed.
    progress.complete(['sample.u01.k']);
    const unit2 = provider.course.units[1];
    const run2 = controller.startTestOut(unit2, 'sample')!;
    const model = controller.newModel(run2, 't2');
    while (model.current) {
      const e = model.current;
      if (e.kind === 'typeAnswer') model.typed = 'falsch';
      else model.choice = e.options.find((o) => !e.correctAnswers.includes(o)) ?? 'x';
      model.check();
      model.advance();
    }
    const failed = controller.finish(model.takeResult()!, run2);
    expect(failed.notes).toEqual(['Für das Überspringen brauchst du 85 % richtig, ohne Hilfe. Lern die Einheit jetzt Schritt für Schritt.']);
    expect(progress.progress.isCompleted('sample.u02.l1')).toBe(false);
  });

  it('skill rows tell status, reasons and what a goal waits for', () => {
    const { provider, controller } = setup();
    const rows = controller.skillRows(provider);
    expect(rows.length).toBe(3);
    expect(rows[0].status).toBe('notStarted');
    expect(rows[0].waitingFor).toEqual([]);
    expect(rows[1].waitingFor).toEqual(['Einheit 1 (Einheit 1)']);
    expect(rows[0].reasons).toContain('Es fehlen noch richtige Antworten ohne Hilfe.');
  });

  it('LearnProgress is not touched by an empty round', () => {
    const { controller, progress } = setup();
    const model = new LessonModel({ lessonID: 'x', exercises: [], sessionID: 'e' });
    const rewards = controller.finish(model.takeResult()!, {
      courseID: 'sample', kind: 'lesson', lessonID: 'x', exercises: [], node: null, completes: true, testOut: null, coach: null,
    });
    expect(rewards.gems).toBe(0);
    expect(progress.progress.totalXP).toBe(0);
    void LearnAnswer;
  });
});
