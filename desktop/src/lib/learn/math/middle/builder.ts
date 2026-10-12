// Turns the templates of a unit into the exercises of a node: which template at which difficulty in which form. A
// lesson teaches the templates of its own third of the unit and reviews the earlier lessons; the practice round mixes
// the unit's levels with the earlier units; the checkpoint asks every template of the unit at the hard level.
// A port of MathMiddleBuilder.swift.

import type { CourseNode } from '../../course';
import { folded, type LearnExercise } from '../../exercise';
import { ExerciseBuilder } from '../../exerciseConstants';
import { Exercises } from '../../exercises';
import { catalogUnits } from './catalog';
import { type Form, Gen, type Problem, problemKey, problemOptions, Q, type Template } from './core';
import * as T from './text';

export const lessonLength = 10;
export const checkpointLength = 12;
/** Typed answers stay below this: a German "1.250" is a thousand to some and a decimal to the answer check. */
export const typedLimit = 1000;

interface Wish {
  template: Template;
  level: number;
  form: Form;
}

export function exercisesFor(node: CourseNode, seed: bigint): LearnExercise[] {
  const units = catalogUnits();
  if (node.kind === 'chest' || !(node.unitNumber >= 1 && node.unitNumber <= units.length)) return [];
  const gen = new Gen(Exercises.seed(node, seed));
  const total = node.kind === 'checkpoint' ? checkpointLength : lessonLength;
  const made: LearnExercise[] = [];
  const seen = new Set<string>();
  const list = wishes(node, total, gen);
  for (let position = 0; position < list.length; position++) {
    if (made.length >= total) break;
    const exercise = realize(list[position], position, gen, seen);
    if (exercise) made.push(exercise);
  }
  return Exercises.arrange(made, total);
}

// Plan

/** 5 choices, a round of pairs, then the typed answers: the easy forms first, as the lesson goes. */
function formPattern(total: number): Form[] {
  const pattern: Form[] = ['choice', 'choice', 'choice', 'choice', 'choice', 'pairs'];
  for (let i = 0; i < total - 6; i++) pattern.push('typed');
  return pattern;
}

/** The next template of the list, from the cursor on, that can be put in this form; the cursor moves past it. When
 * none can, the next one anyway: the exercise is then made in a form it has. */
function next(form: Form, list: Template[], cursor: { value: number }): Template {
  for (let offset = 0; offset < list.length; offset++) {
    const template = list[(cursor.value + offset) % list.length];
    if (template.forms.has(form)) {
      cursor.value += offset + 1;
      return template;
    }
  }
  cursor.value += 1;
  return list[(cursor.value - 1) % list.length];
}

/** More wishes than exercises: a wish that cannot be made (the numbers drawn were no good) is replaced by the next. */
function wishes(node: CourseNode, total: number, gen: Gen): Wish[] {
  const units = catalogUnits();
  const current = units[node.unitNumber - 1];
  const pattern = formPattern(total);
  const backup = total * 3;
  const result: Wish[] = [];

  const formAt = (position: number): Form => (position < pattern.length ? pattern[position] : position % 2 === 0 ? 'typed' : 'choice');

  switch (node.kind) {
    case 'lesson': {
      const lesson = node.index;
      const mine = gen.shuffled(current.filter((t) => t.lesson === lesson));
      const earlier = gen.shuffled(current.filter((t) => t.lesson < lesson));
      const own = mine.length === 0 ? gen.shuffled(current) : mine;
      // Lessons 2 and 3 start by recalling the earlier lessons, and ask one of them again near the end.
      const reviewPositions = new Set<number>(lesson >= 2 && earlier.length > 0 ? [0, 1, 7] : []);
      const ownCursor = { value: 0 };
      const reviewCursor = { value: 0 };
      for (let position = 0; position < backup; position++) {
        const wanted = formAt(position);
        if (reviewPositions.has(position)) {
          const template = next(wanted, earlier, reviewCursor);
          result.push({ template, level: Math.max(1, lesson - 1), form: wanted });
        } else {
          // New material starts one level down and ends one level up.
          const level = Math.min(3, Math.max(1, lesson - (position < 4 ? 1 : 0) + (position >= 8 ? 1 : 0)));
          // A round of pairs may come from the earlier lessons when this lesson has no template for it.
          let template = next(wanted, own, ownCursor);
          if (wanted === 'pairs' && !template.forms.has('pairs')) {
            const other = earlier.find((t) => t.forms.has('pairs'));
            if (other) template = other;
          }
          result.push({ template, level, form: wanted });
        }
      }
      break;
    }
    case 'practice': {
      const own = gen.shuffled(current);
      const before = units.slice(0, node.unitNumber - 1).flat();
      const reviewPositions = new Set<number>(before.length === 0 ? [] : [1, 3, 7, 9]);
      const levels = [1, 2, 2, 3, 2, 3, 3, 2, 3, 2];
      const ownCursor = { value: 0 };
      for (let position = 0; position < backup; position++) {
        const wanted = formAt(position);
        if (reviewPositions.has(position)) {
          // Another unit, picked evenly from the units before this one.
          const unit = gen.shuffled(units[gen.int(0, node.unitNumber - 2)]);
          const cursor = { value: 0 };
          const template = next(wanted, unit, cursor);
          result.push({ template, level: gen.int(1, 2), form: wanted });
        } else {
          result.push({ template: next(wanted, own, ownCursor), level: levels[position % levels.length], form: wanted });
        }
      }
      break;
    }
    case 'checkpoint': {
      const own = gen.shuffled(current);
      const cursor = { value: 0 };
      for (let position = 0; position < backup; position++) {
        const wanted = formAt(position);
        // Every template once first, in the form it has; then the rest in the forms asked for.
        const template = position < own.length ? own[position] : next(wanted, own, cursor);
        result.push({ template, level: 3, form: wanted });
      }
      break;
    }
    case 'chest':
      break;
  }
  return result;
}

// Making one exercise

function realize(wish: Wish, position: number, gen: Gen, seen: Set<string>): LearnExercise | null {
  const template = wish.template;
  let form = wish.form;
  if (!template.forms.has(form)) {
    if (form === 'pairs' && template.forms.has('choice')) {
      form = 'choice';
    } else {
      const other = (['typed', 'choice'] as Form[]).find((f) => template.forms.has(f) && f !== form);
      if (other) form = other;
      else return null;
    }
  }
  const id = `${template.id}.${position}`;
  if (form === 'pairs') return pairs(template, wish.level, id, gen, seen);
  for (let i = 0; i < 24; i++) {
    const problem = template.make(wish.level, gen);
    if (!problem || seen.has(problemKey(problem))) continue;
    const exercise = exerciseFrom(problem, id, form, gen);
    if (exercise) {
      seen.add(problemKey(problem));
      return exercise;
    }
  }
  return null;
}

export function exerciseFrom(problem: Problem, id: string, form: Form, gen: Gen): LearnExercise | null {
  switch (form) {
    case 'choice': {
      const wrong = gen.shuffled(problemOptions(problem));
      if (wrong.length < 2) return null;
      return Exercises.choice(
        { id, prompt: problem.prompt, correct: problem.correct, wrong, solution: problem.solution, explanation: problem.explanation },
        gen.rng,
      );
    }
    case 'typed': {
      const typed = problem.typed;
      if (!typed || !(Math.abs(typed.answer.doubleValue) < typedLimit)) return null;
      const shown = typed.text ?? T.number(Q.from(typed.answer));
      return Exercises.typed({
        id,
        prompt: typed.prompt,
        answer: shown,
        alternatives: shown === typed.answer.fractionText ? [] : [typed.answer.fractionText],
        mode: 'number',
        solution: problem.solution,
        explanation: problem.explanation,
      });
    }
    case 'pairs':
      return null;
  }
}

/** Four problems of one template as pairs: the fronts differ, and so do the backs. */
function pairs(template: Template, level: number, id: string, gen: Gen, seen: Set<string>): LearnExercise | null {
  const problems: Problem[] = [];
  const fronts = new Set<string>();
  const backs = new Set<string>();
  for (let i = 0; i < 60 && problems.length < ExerciseBuilder.pairCount; i++) {
    const problem = template.make(level, gen);
    if (!problem || problem.pairFront === null || seen.has(problemKey(problem))) continue;
    const foldedFront = folded(problem.pairFront);
    const foldedBack = folded(problem.correct);
    if (foldedFront === '' || foldedBack === '' || fronts.has(foldedFront) || backs.has(foldedBack)) continue;
    fronts.add(foldedFront);
    backs.add(foldedBack);
    problems.push(problem);
  }
  if (problems.length !== ExerciseBuilder.pairCount) return null;
  const items = problems.map((p, offset) => ({ key: `${id}.${offset}`, front: p.pairFront ?? '', back: p.correct }));
  const exercise = Exercises.pairs({ id, prompt: problems[0].pairPrompt, items }, gen.rng);
  if (exercise) {
    exercise.explanation = problems[0].pairExplanation ?? problems[0].explanation;
    for (const p of problems) seen.add(problemKey(p));
  }
  return exercise;
}

