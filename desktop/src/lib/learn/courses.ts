// The courses of the Lernen area: registers every course provider with the catalog. The providers are written by their
// own modules (languages/, chess/course/, math/middle/, math/upper/, musicCourse/); this file only collects them.

import type { CourseProvider } from './course';
import { registerProvider, providers } from './catalog';
import { chessProvider } from './chess/course';
import { languageProviders } from './languages';
import { mathMiddleProvider } from './math/middle';
import { mathUpperProvider } from './math/upper';
import { musicProvider } from './musicCourse';

/** Every provider, in the order of the picker: languages (Spanisch, Französisch, Latein, Deutsch als Fremdsprache, Deutsch),
 * maths, chess, music. The picker groups them by kind. */
export function collectProviders(): CourseProvider[] {
  return [...languageProviders, mathMiddleProvider, mathUpperProvider, chessProvider, musicProvider];
}

let registered = false;

/** Registers all providers once; the ids of the registered courses. */
export function registerCourses(): string[] {
  if (!registered) {
    registered = true;
    for (const provider of collectProviders()) registerProvider(provider);
  }
  return providers().map((p) => p.course.id);
}
