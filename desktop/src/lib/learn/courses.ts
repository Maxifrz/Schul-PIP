// The courses of the Lernen area: registers every course provider with the catalog. The providers are written by their
// own modules (languages/, chess/course/, math/middle/, math/upper/, musicCourse/); this file only collects them. A
// module that does not exist yet is skipped, so the area builds with whatever is there.

import type { CourseProvider } from './course';
import { registerProvider, providers } from './catalog';
import { languageProviders } from './languages';

/** The course modules that may export providers, each by its index file. */
const optional = import.meta.glob(
  ['./chess/course/index.ts', './math/middle/index.ts', './math/upper/index.ts', './musicCourse/index.ts'],
  { eager: true },
) as Record<string, Record<string, unknown>>;

function isProvider(value: unknown): value is CourseProvider {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { course?: unknown; exercises?: unknown };
  return typeof candidate.exercises === 'function' && typeof candidate.course === 'object' && candidate.course !== null;
}

/** Every provider that exists, in the order of the picker: languages first, then what the other modules export. */
export function collectProviders(): CourseProvider[] {
  const found: CourseProvider[] = [...languageProviders];
  for (const path of Object.keys(optional).sort()) {
    for (const value of Object.values(optional[path])) if (isProvider(value)) found.push(value);
  }
  return found;
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
