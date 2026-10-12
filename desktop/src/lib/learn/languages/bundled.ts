// The shared course texts (content/courses/*.txt, written by scripts/export-courses.mjs) bundled into the app, so
// they work offline. Vite inlines `?raw` imports; vitest runs through Vite, so this works in tests too.
import daf from '../../../../../content/courses/daf.txt?raw';
import de from '../../../../../content/courses/de.txt?raw';
import es from '../../../../../content/courses/es.txt?raw';
import fr from '../../../../../content/courses/fr.txt?raw';
import la from '../../../../../content/courses/la.txt?raw';

export const bundledCourseTexts: Record<string, string> = { es, fr, la, daf, de };
