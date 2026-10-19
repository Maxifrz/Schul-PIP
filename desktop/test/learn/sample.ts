import { Course, CourseProvider, standardUnit } from '../../src/lib/learn/course';

/** A course made of plain data, for the path's rules. */
export const sampleProvider: CourseProvider = {
  course: ((): Course => {
    const units = [1, 2, 3].map((n) => standardUnit('sample', n, `Einheit ${n}`, 's', 'Tipp'));
    return {
      id: 'sample', title: 'Beispiel', subtitle: 'Test', kind: 'language', color: 0x336699, symbol: 'globe',
      sections: [{ id: 'sample.a', title: 'A', units: units.slice(0, 2) }, { id: 'sample.b', title: 'B', units: [units[2]] }],
    };
  })(),
  exercises: () => [],
};
