// Every course the app ships with registers itself here, in the order the course picker lists them.
import { registerCourse } from './catalog';
import { french, germanForeign, germanSchool, latin, spanish } from './languages/courses';
import { mathMiddle } from './math/middle/course';
import { mathUpper } from './math/upper/course';
import { chess } from './chess/course';

[spanish, french, latin, germanForeign, germanSchool, mathMiddle, mathUpper, chess].forEach(registerCourse);
export { courses, providerFor, providerForNode, providers } from './catalog';
