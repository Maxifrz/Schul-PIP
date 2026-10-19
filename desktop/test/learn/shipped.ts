import { CourseProvider } from '../../src/lib/learn/course';
import { providers } from '../../src/lib/learn/allCourses';

/** The courses with goals that need typing, applying or the board: every shipped course but maths and music, which get the default one goal per unit. */
export const practising = (): CourseProvider[] => providers.filter((p) => !p.course.id.startsWith('math') && p.course.id !== 'music');
export { providers };
