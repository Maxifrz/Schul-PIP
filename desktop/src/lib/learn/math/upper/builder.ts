import type { CourseNode } from '../../course';
import { LearnExercise } from '../../exercise';
import { arrange, choice, pairs, seedFor, typed } from '../../exercises';
import { UGen, UProblem, UTemplate, canChoice } from './core';

/** Turns a node into its exercises: picks the templates, the levels and the form of each question. */
export function upperExercises(units: UTemplate[][], lessonGroups: string[][][], find: (id: string) => UTemplate | undefined, node: CourseNode, seed: bigint): LearnExercise[] {
  if (node.kind === 'chest' || node.unitNumber < 1 || node.unitNumber > units.length) return [];
  const gen = new UGen(seedFor(node, seed));
  const unitIndex = node.unitNumber - 1;
  const unitTemplates = units[unitIndex];
  const count = node.kind === 'checkpoint' ? 12 : 10;

  let main: UTemplate[];
  let review: UTemplate[] = [];
  switch (node.kind) {
    case 'lesson': {
      const groups = lessonGroups[unitIndex];
      main = groups[Math.min(node.index, groups.length) - 1].map(find).filter((t): t is UTemplate => !!t);
      if (node.index > 1) review = groups.slice(0, node.index - 1).flat().map(find).filter((t): t is UTemplate => !!t);
      break;
    }
    case 'practice':
      main = unitTemplates;
      if (unitIndex > 0) review = units.slice(0, unitIndex).flat();
      break;
    default:
      main = unitTemplates;
  }
  main = gen.shuffled(main);
  review = gen.shuffled(review);

  const reviewSlots = node.kind === 'practice' ? 3 : node.kind === 'lesson' && node.index > 1 ? 3 : 0;
  const pairTemplate = main.find((t) => t.pairs) ?? (node.kind === 'practice' ? review.find((t) => t.pairs) : undefined);
  const pairSlot = pairTemplate && (node.kind !== 'lesson' || node.index === 1) ? 2 : -1;

  const exercises: Array<LearnExercise | null> = [];
  const problems: Array<UProblem | null> = [];
  const seenKeys = new Set<string>();
  let mainIndex = 0;
  let reviewIndex = 0;
  for (let slot = 0; slot < count; slot++) {
    const id = `${node.id}.e${slot + 1}`;
    if (slot === pairSlot && pairTemplate?.pairs) {
      let made: LearnExercise | null = null;
      for (let i = 0; i < 20 && !made; i++) {
        const items = pairTemplate.pairs(2, gen);
        if (items && items.length === 4) {
          made = gen.withRandom((random) => pairs(random, { id, items: items.map((item, offset) => ({ key: `${id}.${offset}`, front: item.front, back: item.back })) }));
        }
      }
      if (made) {
        exercises.push(made);
        problems.push(null);
        continue;
      }
    }
    const level = levelFor(node, slot, count);
    const useReview = review.length > 0 && slot % 3 === 2 && Math.floor(slot / 3) < reviewSlots;
    let made: LearnExercise | null = null;
    let drawn: UProblem | null = null;
    for (let attempt = 0; attempt < 60 && !made; attempt++) {
      const template = useReview && attempt < 30 ? review[(reviewIndex + attempt) % review.length] : main[(mainIndex + attempt) % main.length];
      const drawLevel = Math.max(1, Math.min(3, level - (attempt > 40 ? 1 : 0)));
      const problem = template.make(drawLevel, gen);
      if (!problem || seenKeys.has(problem.key)) continue;
      seenKeys.add(problem.key);
      made = exerciseFrom(problem, id, node, slot, count, gen);
      if (!made) seenKeys.delete(problem.key);
      else drawn = problem;
    }
    if (useReview) reviewIndex += 1;
    else mainIndex += 1;
    exercises.push(made);
    problems.push(drawn);
  }
  balance(exercises, problems, node, count, gen);
  return arrange(exercises, count);
}

export function levelFor(node: CourseNode, slot: number, count: number): number {
  const t = slot / Math.max(count - 1, 1);
  switch (node.kind) {
    case 'lesson':
      switch (node.index) {
        case 1: return t < 0.6 ? 1 : 2;
        case 2: return t < 0.3 ? 1 : t < 0.75 ? 2 : 3;
        default: return t < 0.3 ? 2 : 3;
      }
    case 'practice':
      return t < 0.35 ? 2 : 3;
    default:
      return t < 0.25 ? 2 : 3;
  }
}

export function typedChance(node: CourseNode): number {
  switch (node.kind) {
    case 'lesson': return node.index === 1 ? 0.4 : node.index === 2 ? 0.5 : 0.6;
    case 'practice': return 0.5;
    default: return 0.6;
  }
}

/** Makes sure a node has typed and chosen answers: turns one question into the missing form when a draw went one-sided. */
function balance(exercises: Array<LearnExercise | null>, problems: Array<UProblem | null>, node: CourseNode, count: number, gen: UGen): void {
  const kinds = new Set(exercises.filter((e): e is LearnExercise => !!e).map((e) => e.kind));
  const wantTyped = !kinds.has('typeAnswer');
  if (!(wantTyped || !kinds.has('multipleChoice'))) return;
  for (let index = exercises.length - 1; index >= 0; index--) {
    const old = exercises[index];
    const problem = problems[index];
    if (!old || !problem) continue;
    if (wantTyped ? problem.number === undefined || !problem.typedAllowed : !canChoice(problem)) continue;
    const rebuilt = exerciseFrom(problem, old.id, node, index, count, gen, wantTyped);
    if (rebuilt) {
      exercises[index] = rebuilt;
      return;
    }
  }
}

export function exerciseFrom(problem: UProblem, id: string, node: CourseNode, slot: number, count: number, gen: UGen, force?: boolean): LearnExercise | null {
  let wantTyped = problem.number !== undefined && problem.typedAllowed && gen.chance(typedChance(node));
  if (slot === 0 && canChoice(problem)) wantTyped = false;
  if (slot === count - 1 && problem.number !== undefined && problem.typedAllowed) wantTyped = true;
  if (!canChoice(problem)) wantTyped = true;
  if (force !== undefined) wantTyped = force;
  if (wantTyped) {
    const number = problem.number;
    if (!number || !problem.typedAllowed) return null;
    const alternatives: string[] = [];
    if (!number.isInt) alternatives.push(number.fraction);
    const hint = problem.hint === '' ? '' : ` ${problem.hint}`;
    return typed({ id, prompt: problem.prompt + hint, answer: number.typed, alternatives, mode: 'number', solution: problem.solution, explanation: problem.explanation });
  }
  return gen.withRandom((random) => choice(random, { id, prompt: problem.prompt, correct: problem.correct, wrong: problem.wrong, solution: problem.solution, explanation: problem.explanation }));
}
