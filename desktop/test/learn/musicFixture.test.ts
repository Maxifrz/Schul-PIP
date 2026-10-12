import { describe, it } from 'vitest';
import { musicProvider } from '../../src/lib/learn/musicCourse';
import { expectExercisesMatch, expectStructureMatches } from './courseFixture';

describe('music course against the Swift fixture', () => {
  it('structure and skill map match', () => expectStructureMatches(musicProvider));
  it('every exercise of every node matches for seeds 1 and 7', () => expectExercisesMatch(musicProvider));
});
