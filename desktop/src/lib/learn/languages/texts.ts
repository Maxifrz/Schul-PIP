// The course texts by course id. No node:fs: this works in the renderer.
import { bundledCourseTexts } from './bundled';

export const courseTexts: Record<string, string> = bundledCourseTexts;

/** The ids in course order (Spanish, French, Latin, German as a foreign language, German as a subject). */
export const courseTextIds: readonly string[] = ['es', 'fr', 'la', 'daf', 'de'];
