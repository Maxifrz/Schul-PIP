// Every course the app ships with registers itself here; the catalog is read by the Lernen tab and the tests.
import { registerCourse } from './catalog';

export const shipped: Array<Parameters<typeof registerCourse>[0]> = [];
shipped.forEach(registerCourse);
export { courses, providerFor, providerForNode, providers } from './catalog';
