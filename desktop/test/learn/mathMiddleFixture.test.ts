import { describe, it } from 'vitest';
import { mathMiddleProvider } from '../../src/lib/learn/math/middle';
import { expectExercisesMatch, expectStructureMatches } from './courseFixture';

describe('mathm against the Swift fixture', () => {
  it('structure and skill map', () => {
    expectStructureMatches(mathMiddleProvider);
  });
  for (let unit = 1; unit <= 10; unit++) {
    const id = `mathm.u${String(unit).padStart(2, '0')}.`;
    it(`unit ${unit} exercises, seeds 1 and 7`, () => {
      expectExercisesMatch(mathMiddleProvider, (n) => n.startsWith(id));
    });
  }
});
