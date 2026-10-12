// Turns a node into its exercises: picks the templates, the levels and the form of each question.
// A port of MathUpperBuilder.swift; the draws from the generator happen in the same order as in Swift.

import type { CourseNode } from '../../course';
import type { LearnExercise } from '../../exercise';
import { Exercises } from '../../exercises';
import { canChoice, UGen, type UProblem, type UTemplate } from './core';
import { MathUpperCatalog } from './catalog';

export const MathUpperBuilder = {
  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    if (node.kind === 'chest' || node.unitNumber < 1 || node.unitNumber > MathUpperCatalog.units.length) return [];
    const gen = new UGen(Exercises.seed(node, seed));
    const unitIndex = node.unitNumber - 1;
    const unitTemplates = MathUpperCatalog.units[unitIndex];
    const count = node.kind === 'checkpoint' ? 12 : 10;

    const resolve = (ids: readonly string[]): UTemplate[] =>
      ids.map((id) => MathUpperCatalog.template(id)).filter((t): t is UTemplate => t !== undefined);

    let main: UTemplate[];
    let review: UTemplate[] = [];
    switch (node.kind) {
      case 'lesson': {
        const groups = MathUpperCatalog.lessonGroups[unitIndex];
        main = resolve(groups[Math.min(node.index, groups.length) - 1]);
        if (node.index > 1) review = resolve(groups.slice(0, node.index - 1).flat());
        break;
      }
      case 'practice':
        main = [...unitTemplates];
        if (unitIndex > 0) review = MathUpperCatalog.units.slice(0, unitIndex).flatMap((u) => [...u]);
        break;
      default:
        main = [...unitTemplates];
    }
    main = gen.shuffled(main);
    review = gen.shuffled(review);

    const reviewSlots = node.kind === 'practice' ? 3 : node.kind === 'lesson' && node.index > 1 ? 3 : 0;
    const pairTemplate =
      main.find((t) => t.pairs !== undefined) ?? (node.kind === 'practice' ? review.find((t) => t.pairs !== undefined) : undefined);
    const pairSlot = pairTemplate !== undefined && (node.kind !== 'lesson' || node.index === 1) ? 2 : -1;

    const exercises: (LearnExercise | null)[] = [];
    const problems: (UProblem | null)[] = [];
    const seenKeys = new Set<string>();
    let mainIndex = 0;
    let reviewIndex = 0;
    for (let slot = 0; slot < count; slot++) {
      const id = `${node.id}.e${slot + 1}`;
      if (slot === pairSlot && pairTemplate?.pairs) {
        const pairs = pairTemplate.pairs;
        let made: LearnExercise | null = null;
        for (let i = 0; i < 20 && made === null; i++) {
          const items = pairs(2, gen);
          if (items && items.length === 4) {
            made = gen.withRandom((rng) =>
              Exercises.pairs({ id, items: items.map((item, offset) => ({ key: `${id}.${offset}`, front: item.front, back: item.back })) }, rng),
            );
          }
        }
        if (made) {
          exercises.push(made);
          problems.push(null);
          continue;
        }
      }
      const level = levelFor(node, slot, count);
      const useReview = review.length > 0 && slot % 3 === 2 && Math.trunc(slot / 3) < reviewSlots;
      let made: LearnExercise | null = null;
      let drawn: UProblem | null = null;
      for (let attempt = 0; attempt < 60 && made === null; attempt++) {
        const template =
          useReview && attempt < 30 ? review[(reviewIndex + attempt) % review.length] : main[(mainIndex + attempt) % main.length];
        const drawLevel = Math.max(1, Math.min(3, level - (attempt > 40 ? 1 : 0)));
        const problem = template.make(drawLevel, gen);
        if (!problem || seenKeys.has(problem.key)) continue;
        seenKeys.add(problem.key);
        made = exercise(problem, id, node, slot, count, gen);
        if (made === null) seenKeys.delete(problem.key);
        else drawn = problem;
      }
      if (useReview) reviewIndex += 1;
      else mainIndex += 1;
      exercises.push(made);
      problems.push(drawn);
    }
    balance(exercises, problems, node, count, gen);
    return Exercises.arrange(exercises, count);
  },

  levelFor,
  typedChance,
};

function levelFor(node: CourseNode, slot: number, count: number): number {
  const t = slot / Math.max(count - 1, 1);
  switch (node.kind) {
    case 'lesson':
      switch (node.index) {
        case 1:
          return t < 0.6 ? 1 : 2;
        case 2:
          return t < 0.3 ? 1 : t < 0.75 ? 2 : 3;
        default:
          return t < 0.3 ? 2 : 3;
      }
    case 'practice':
      return t < 0.35 ? 2 : 3;
    default:
      return t < 0.25 ? 2 : 3;
  }
}

function typedChance(node: CourseNode): number {
  switch (node.kind) {
    case 'lesson':
      return node.index === 1 ? 0.4 : node.index === 2 ? 0.5 : 0.6;
    case 'practice':
      return 0.5;
    default:
      return 0.6;
  }
}

/** Makes sure a node has typed and chosen answers: turns one question into the missing form when a draw went one-sided. */
function balance(
  exercises: (LearnExercise | null)[],
  problems: (UProblem | null)[],
  node: CourseNode,
  count: number,
  gen: UGen,
): void {
  const kinds = new Set(exercises.filter((e): e is LearnExercise => e !== null).map((e) => e.kind));
  const wantTyped = !kinds.has('typeAnswer');
  if (!(wantTyped || !kinds.has('multipleChoice'))) return;
  for (let index = exercises.length - 1; index >= 0; index--) {
    const old = exercises[index];
    const problem = problems[index];
    if (!old || !problem) continue;
    if (wantTyped ? problem.number === null || !problem.typedAllowed : !canChoice(problem)) continue;
    const rebuilt = exercise(problem, old.id, node, index, count, gen, wantTyped);
    if (rebuilt) {
      exercises[index] = rebuilt;
      return;
    }
  }
}

function exercise(
  problem: UProblem,
  id: string,
  node: CourseNode,
  slot: number,
  count: number,
  gen: UGen,
  force?: boolean,
): LearnExercise | null {
  let wantTyped = problem.number !== null && problem.typedAllowed && gen.chance(typedChance(node));
  if (slot === 0 && canChoice(problem)) wantTyped = false;
  if (slot === count - 1 && problem.number !== null && problem.typedAllowed) wantTyped = true;
  if (!canChoice(problem)) wantTyped = true;
  if (force !== undefined) wantTyped = force;
  if (wantTyped) {
    const number = problem.number;
    if (number === null || !problem.typedAllowed) return null;
    const alternatives: string[] = [];
    if (!number.isInt) alternatives.push(number.fraction);
    const hint = problem.hint === '' ? '' : ' ' + problem.hint;
    return Exercises.typed({
      id,
      prompt: problem.prompt + hint,
      answer: number.typed,
      alternatives,
      mode: 'number',
      solution: problem.solution,
      explanation: problem.explanation,
    });
  }
  return gen.withRandom((rng) =>
    Exercises.choice(
      {
        id,
        prompt: problem.prompt,
        correct: problem.correct,
        wrong: problem.wrong,
        solution: problem.solution,
        explanation: problem.explanation,
      },
      rng,
    ),
  );
}
