// A course made of plain data, for the path's rules. A port of LernwerkTests/CourseSample.swift.
import { type CourseProvider, makeCourse, standardUnit } from '../../src/lib/learn/course';
import type { LearnExercise } from '../../src/lib/learn/exercise';
import type { CourseNode } from '../../src/lib/learn/course';

export function sampleCourse() {
  const units = [1, 2, 3].map((n) => standardUnit('sample', n, `Einheit ${n}`, 's', 'Tipp'));
  return makeCourse({
    id: 'sample',
    title: 'Beispiel',
    subtitle: 'Test',
    kind: 'language',
    color: 0x336699,
    symbol: 'globe',
    sections: [
      { id: 'sample.a', title: 'A', units: units.slice(0, 2) },
      { id: 'sample.b', title: 'B', units: [units[2]] },
    ],
  });
}

export class SampleCourse implements CourseProvider {
  get course() {
    return sampleCourse();
  }
  exercises(_node: CourseNode, _seed: bigint): LearnExercise[] {
    return [];
  }
}
