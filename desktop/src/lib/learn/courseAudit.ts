import { CourseNode, CourseProvider, courseNodes, structureProblems } from './course';
import { LearnExercise, difficulty, folded } from './exercise';
import { extraWords, pairCount } from './builder';
import { NumberCheck } from './rational';

export const lessonRange = [8, 12] as const;
export const checkpointRange = [10, 15] as const;

/**
 * Checks a course the way the screens will use it: every node, a few seeds, every exercise. The tests of each course
 * run it, so a course that would show an empty question, a right answer twice among the options or a move in the wrong
 * notation never ships. It checks the shape, not the facts; a teacher checks the facts.
 */
export function auditProblems(provider: CourseProvider, seeds: bigint[] = [1n, 2n, 3n]): string[] {
  const problems = structureProblems(provider);
  for (const node of courseNodes(provider.course)) {
    if (node.kind === 'chest') {
      if (provider.exercises(node, 1n).length > 0) problems.push(`${node.id}: a chest has exercises.`);
      continue;
    }
    for (const seed of seeds) {
      const exercises = provider.exercises(node, seed);
      problems.push(...exerciseListProblems(exercises, node).map((p) => `${p} (seed ${seed})`));
      if (JSON.stringify(exercises) !== JSON.stringify(provider.exercises(node, seed))) problems.push(`${node.id}: the same seed gives other exercises (seed ${seed}).`);
    }
  }
  return problems;
}

export function exerciseListProblems(exercises: LearnExercise[], node: CourseNode): string[] {
  const problems: string[] = [];
  const [low, high] = node.kind === 'checkpoint' ? checkpointRange : lessonRange;
  if (exercises.length < low || exercises.length > high) problems.push(`${node.id}: ${exercises.length} exercises, expected ${low} to ${high}.`);
  const ids = exercises.map((e) => e.id);
  if (new Set(ids).size !== ids.length) problems.push(`${node.id}: exercise ids are not unique.`);
  const levels = exercises.map((e) => difficulty(e.kind));
  if (levels.some((v, i) => i > 0 && v < levels[i - 1])) problems.push(`${node.id}: the exercises do not go from easy to hard.`);
  for (const item of exercises) problems.push(...exerciseProblems(item).map((p) => `${node.id} ${item.id}: ${p}`));
  return problems;
}

const blank = (text: string) => text.trim() === '';
const isMove = (text: string): boolean => {
  const c = [...text];
  if (c.length !== 4 && c.length !== 5) return false;
  if (!'abcdefgh'.includes(c[0]) || !'12345678'.includes(c[1]) || !'abcdefgh'.includes(c[2]) || !'12345678'.includes(c[3])) return false;
  return c.length === 4 || 'qrbn'.includes(c[4]);
};

export function exerciseProblems(item: LearnExercise): string[] {
  const problems: string[] = [];
  if (item.id === '') problems.push('empty id');
  if (blank(item.prompt)) problems.push('empty prompt');
  if (blank(item.solution)) problems.push('empty solution');
  if (item.correctAnswers.length === 0 || item.correctAnswers.some(blank)) problems.push('missing right answer');
  const media = item.media;
  if (media) {
    switch (media.kind) {
      case 'speech': if (blank(media.text) || blank(media.language)) problems.push('speech without text or language'); break;
      case 'board': if (!media.board.fen.includes('/')) problems.push('board without a FEN'); break;
      case 'staff': if (media.staff.notes.length === 0) problems.push('staff without notes'); break;
      case 'tones': if (media.tones.midi.length === 0 || media.tones.midi.some((m) => m < 21 || m > 108)) problems.push('tones out of range'); break;
    }
  }
  switch (item.kind) {
    case 'multipleChoice': {
      const f = item.options.map(folded);
      if (item.options.length < 2 || item.options.length > 4) problems.push(`${item.options.length} options`);
      if (new Set(f).size !== f.length) problems.push('options that read the same');
      if (item.correctAnswers.length !== 1) problems.push('a choice needs exactly one right answer');
      if (item.options.filter((o) => item.correctAnswers.includes(o)).length !== 1) problems.push('the right answer is not among the options exactly once');
      if (item.options.some(blank)) problems.push('blank option');
      break;
    }
    case 'typeAnswer':
      if (item.mode === 'number' && item.correctAnswers.some((a) => NumberCheck.parse(a) === null)) problems.push('a number answer that is not a number');
      break;
    case 'wordBank': {
      const tiles = item.correctAnswers;
      if (tiles.length < 2) problems.push('a word bank with fewer than two words');
      const remaining = [...item.options];
      for (const word of tiles) {
        const index = remaining.indexOf(word);
        if (index >= 0) remaining.splice(index, 1);
        else problems.push(`tile ${word} is missing`);
      }
      if (remaining.length > extraWords) problems.push('too many extra tiles');
      if (item.options.slice(0, tiles.length).every((v, i) => v === tiles[i])) problems.push('tiles come in the right order');
      break;
    }
    case 'matchPairs': {
      if (item.pairs.length !== pairCount) problems.push(`${item.pairs.length} pairs`);
      const fronts = item.pairs.map((p) => folded(p.front));
      const backs = item.pairs.map((p) => folded(p.back));
      if (new Set(fronts).size !== fronts.length || new Set(backs).size !== backs.length) problems.push('pairs that read the same');
      const options = new Set(item.options.map(folded));
      if (options.size !== new Set(backs).size || [...options].some((o) => !backs.includes(o))) problems.push('pair options differ from the backs');
      break;
    }
    case 'chessMove':
      if (item.media?.kind !== 'board') problems.push('a chess move without a board');
      else for (const move of item.correctAnswers) if (!isMove(move)) problems.push(`${move} is not a move like e2e4`);
      break;
    case 'pianoKey':
      for (const key of item.correctAnswers) {
        const n = Number(key);
        if (!Number.isInteger(n) || n < 21 || n > 108) problems.push(`${key} is not a piano key`);
      }
      break;
  }
  return problems;
}
