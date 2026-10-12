// Byte-exact comparison with the Swift engine: structure, skill map and every exercise of every step (seeds 1 and 7).
import { describe, it } from 'vitest';
import { germanForeignProvider, germanSchoolProvider, frenchProvider, latinProvider, spanishProvider } from '../../src/lib/learn/languages/courses';
import { expectExercisesMatch, expectStructureMatches } from './courseFixture';

const all = { es: spanishProvider, fr: frenchProvider, la: latinProvider, daf: germanForeignProvider, de: germanSchoolProvider };

describe('language courses match the Swift fixtures', () => {
  for (const [id, provider] of Object.entries(all)) {
    it(`${id}: structure and skill map`, () => expectStructureMatches(provider));
    it(`${id}: exercises of every step`, () => expectExercisesMatch(provider), 60_000);
  }
});
