// The five shipped language courses, built from the shared texts (content/courses/*.txt). Register them with
// `registerProvider` (see `languageProviders`).
import type { CourseProvider } from '../course';
import { LanguageCourseProvider } from './provider';
import { courseTexts } from './texts';

const make = (id: string): LanguageCourseProvider => LanguageCourseProvider.make(courseTexts[id]).provider;

export const spanishProvider: LanguageCourseProvider = make('es');
export const frenchProvider: LanguageCourseProvider = make('fr');
export const latinProvider: LanguageCourseProvider = make('la');
export const germanForeignProvider: LanguageCourseProvider = make('daf');
export const germanSchoolProvider: LanguageCourseProvider = make('de');

/** In course order: Spanisch, Französisch, Latein, Deutsch als Fremdsprache, Deutsch. */
export const languageProviders: readonly CourseProvider[] = [
  spanishProvider, frenchProvider, latinProvider, germanForeignProvider, germanSchoolProvider,
];
