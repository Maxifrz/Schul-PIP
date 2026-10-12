import { describe, it } from 'vitest';
import { mathUpperProvider } from '../../src/lib/learn/math/upper';
import { expectExercisesMatch, expectStructureMatches } from './courseFixture';

describe('matho against the Swift fixture', () => {
  it('structure and skill map', () => expectStructureMatches(mathUpperProvider));
  for (let u = 1; u <= 7; u++) {
    it(`exercises of unit ${u} match seeds 1 and 7`, () => {
      expectExercisesMatch(mathUpperProvider, (id) => id.startsWith(`matho.u0${u}.`));
    }, 60000);
  }
});
