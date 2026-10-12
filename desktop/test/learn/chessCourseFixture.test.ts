import { describe, it } from 'vitest';
import { chessProvider } from '../../src/lib/learn/chess/course';
import { expectExercisesMatch, expectStructureMatches } from './courseFixture';

describe('chess course against the Swift fixture', () => {
  it('structure and skill map match', () => expectStructureMatches(chessProvider));
  it('exercises of every node for seeds 1 and 7 match', () => expectExercisesMatch(chessProvider));
});
