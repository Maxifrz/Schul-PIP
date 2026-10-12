import { it } from 'vitest';
import { spanishProvider } from '/home/user/Schul-PIP/desktop/src/lib/learn/languages/courses';
it('prof', () => {
  const t = Date.now();
  for (const n of spanishProvider.course.nodes) if (n.kind !== 'chest') spanishProvider.exercises(n, 1n);
  console.log('ms', Date.now() - t);
});
