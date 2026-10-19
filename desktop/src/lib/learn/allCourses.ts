// Every course the app ships with registers itself here, in the order the course picker lists them.
import { registerCourse } from './catalog';
import { french, germanForeign, germanSchool, latin, spanish } from './languages/courses';
import { mathMiddle } from './math/middle/course';

[spanish, french, latin, germanForeign, germanSchool, mathMiddle].forEach(registerCourse);
export { courses, providerFor, providerForNode, providers } from './catalog';
