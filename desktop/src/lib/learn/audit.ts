// Checks a course the way the screens will use it: every node, a few seeds, every exercise. The tests of each
// course run it, so a course that would show an empty question, a right answer twice among the options or a move
// in the wrong notation never ships. It checks the shape, not the facts; a teacher checks the facts.
// A port of Lernwerk/Services/Learn/Course/CourseAudit.swift.

import { type CourseNode, type CourseProvider, structureProblems } from './course';
import { difficulty, folded, type LearnExercise } from './exercise';
import { ExerciseBuilder } from './exerciseConstants';
import { NumberCheck } from './numberCheck';
import { deepEqual } from './util';

const isBlank = (text: string): boolean => text.trim() === '';

function isMove(text: string): boolean {
  const characters = Array.from(text);
  if (characters.length !== 4 && characters.length !== 5) return false;
  const files = 'abcdefgh';
  const ranks = '12345678';
  if (!(files.includes(characters[0]) && ranks.includes(characters[1]) && files.includes(characters[2]) && ranks.includes(characters[3]))) {
    return false;
  }
  return characters.length === 4 || 'qrbn'.includes(characters[4]);
}

function isPianoKey(text: string): boolean {
  // Swift: Int(text) accepts an optional sign and decimal digits only.
  if (!/^[+-]?[0-9]+$/.test(text)) return false;
  const value = Number(text);
  return value >= 21 && value <= 108;
}

export const CourseAudit = {
  lessonRange: { lower: 8, upper: 12 },
  checkpointRange: { lower: 10, upper: 15 },

  problems(provider: CourseProvider, seeds: bigint[] = [1n, 2n, 3n]): string[] {
    let problems = structureProblems(provider);
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') {
        if (provider.exercises(node, 1n).length > 0) problems.push(`${node.id}: a chest has exercises.`);
        continue;
      }
      for (const seed of seeds) {
        const exercises = provider.exercises(node, seed);
        problems = problems.concat(CourseAudit.problemsInExercises(exercises, node).map((p) => `${p} (seed ${seed})`));
        if (!deepEqual(exercises, provider.exercises(node, seed))) {
          problems.push(`${node.id}: the same seed gives other exercises (seed ${seed}).`);
        }
      }
    }
    return problems;
  },

  /** Swift: `problems(in: [LearnExercise], node:)`. */
  problemsInExercises(exercises: readonly LearnExercise[], node: CourseNode): string[] {
    const problems: string[] = [];
    const range = node.kind === 'checkpoint' ? CourseAudit.checkpointRange : CourseAudit.lessonRange;
    if (exercises.length < range.lower || exercises.length > range.upper) {
      problems.push(`${node.id}: ${exercises.length} exercises, expected ${range.lower} to ${range.upper}.`);
    }
    const ids = exercises.map((e) => e.id);
    if (new Set(ids).size !== ids.length) problems.push(`${node.id}: exercise ids are not unique.`);
    const difficulties = exercises.map((e) => difficulty(e.kind));
    const sorted = difficulties.slice().sort((a, b) => a - b);
    if (!difficulties.every((d, i) => d === sorted[i])) problems.push(`${node.id}: the exercises do not go from easy to hard.`);
    for (const exercise of exercises) {
      for (const p of CourseAudit.problemsInExercise(exercise)) problems.push(`${node.id} ${exercise.id}: ${p}`);
    }
    return problems;
  },

  /** Swift: `problems(in: LearnExercise)`. */
  problemsInExercise(exercise: LearnExercise): string[] {
    const problems: string[] = [];
    if (exercise.id === '') problems.push('empty id');
    if (isBlank(exercise.prompt)) problems.push('empty prompt');
    if (isBlank(exercise.solution)) problems.push('empty solution');
    if (exercise.correctAnswers.length === 0 || exercise.correctAnswers.some(isBlank)) problems.push('missing right answer');
    const media = exercise.media;
    if (media) {
      switch (media.type) {
        case 'speech':
          if (isBlank(media.text) || isBlank(media.language)) problems.push('speech without text or language');
          break;
        case 'board':
          if (!media.board.fen.includes('/')) problems.push('board without a FEN');
          break;
        case 'staff':
          if (media.staff.notes.length === 0) problems.push('staff without notes');
          break;
        case 'tones':
          if (media.tones.midi.length === 0 || media.tones.midi.some((m) => !(m >= 21 && m <= 108))) {
            problems.push('tones out of range');
          }
          break;
      }
    }
    switch (exercise.kind) {
      case 'multipleChoice': {
        const f = exercise.options.map(folded);
        if (!(exercise.options.length >= 2 && exercise.options.length <= 4)) problems.push(`${exercise.options.length} options`);
        if (new Set(f).size !== f.length) problems.push('options that read the same');
        if (exercise.correctAnswers.length !== 1) problems.push('a choice needs exactly one right answer');
        if (exercise.options.filter((o) => exercise.correctAnswers.includes(o)).length !== 1) {
          problems.push('the right answer is not among the options exactly once');
        }
        if (exercise.options.some(isBlank)) problems.push('blank option');
        break;
      }
      case 'typeAnswer':
        if (exercise.mode === 'number' && exercise.correctAnswers.some((a) => NumberCheck.parse(a) === null)) {
          problems.push('a number answer that is not a number');
        }
        break;
      case 'wordBank': {
        const tiles = exercise.correctAnswers;
        if (tiles.length < 2) problems.push('a word bank with fewer than two words');
        const remaining = exercise.options.slice();
        for (const word of tiles) {
          const index = remaining.indexOf(word);
          if (index >= 0) remaining.splice(index, 1);
          else problems.push(`tile ${word} is missing`);
        }
        if (remaining.length > ExerciseBuilder.extraWords) problems.push('too many extra tiles');
        const head = exercise.options.slice(0, tiles.length);
        if (head.length === tiles.length && head.every((w, i) => w === tiles[i])) problems.push('tiles come in the right order');
        break;
      }
      case 'matchPairs': {
        if (exercise.pairs.length !== ExerciseBuilder.pairCount) problems.push(`${exercise.pairs.length} pairs`);
        const fronts = exercise.pairs.map((p) => folded(p.front));
        const backs = exercise.pairs.map((p) => folded(p.back));
        if (new Set(fronts).size !== fronts.length || new Set(backs).size !== backs.length) problems.push('pairs that read the same');
        const optionSet = new Set(exercise.options.map(folded));
        const backSet = new Set(backs);
        if (optionSet.size !== backSet.size || [...optionSet].some((x) => !backSet.has(x))) {
          problems.push('pair options differ from the backs');
        }
        break;
      }
      case 'chessMove':
        if (!media || media.type !== 'board') {
          problems.push('a chess move without a board');
          break;
        }
        for (const move of exercise.correctAnswers) if (!isMove(move)) problems.push(`${move} is not a move like e2e4`);
        break;
      case 'pianoKey':
        for (const key of exercise.correctAnswers) if (!isPianoKey(key)) problems.push(`${key} is not a piano key`);
        break;
    }
    return problems;
  },
};
