import daf from './courses/daf.course.txt?raw';
import de from './courses/de.course.txt?raw';
import es from './courses/es.course.txt?raw';
import fr from './courses/fr.course.txt?raw';
import la from './courses/la.course.txt?raw';
import { LanguageCourseProvider } from './provider';

// Each course is plain text in the format of dsl.ts, so a teacher can read and correct it; the provider turns it into lessons.

export const spanishSource = es;
export const frenchSource = fr;
export const latinSource = la;
export const germanForeignSource = daf;
export const germanSchoolSource = de;

export const spanish = LanguageCourseProvider.make(es).provider;
export const french = LanguageCourseProvider.make(fr).provider;
export const latin = LanguageCourseProvider.make(la).provider;
export const germanForeign = LanguageCourseProvider.make(daf).provider;
export const germanSchool = LanguageCourseProvider.make(de).provider;
