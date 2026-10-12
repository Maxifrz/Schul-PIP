import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LessonModel, lessonExercises, providers } from '../src/lib/learn';
import { registerCourses } from '../src/lib/learn/courses';
import { ExerciseArea, Media } from '../src/views/learn/LessonPlayer';

// Every exercise of every step of every course is drawn once, so no kind of exercise or media is left without a look.
describe('every exercise of every course can be drawn', () => {
  it('renders the media and the answer area', () => {
    registerCourses();
    const kinds = new Map<string, number>();
    const media = new Map<string, number>();
    let drawn = 0;
    for (const provider of providers()) {
      for (const node of provider.course.nodes) {
        if (node.kind === 'chest') continue;
        const exercises = lessonExercises(provider, node, 7n);
        const model = new LessonModel({ lessonID: node.id, exercises, sessionID: node.id });
        for (const exercise of exercises) {
          const single = new LessonModel({ lessonID: node.id, exercises: [exercise], sessionID: node.id });
          const html = renderToStaticMarkup(
            createElement('div', null, createElement(Media, { exercise }), createElement(ExerciseArea, { exercise, model: single, force: () => undefined })),
          );
          expect(html.length, `${exercise.id} of ${node.id}`).toBeGreaterThan(20);
          if (exercise.kind === 'chessMove') expect((html.match(/class="sq /g) ?? []).length).toBe(64);
          if (exercise.kind === 'pianoKey') expect(html).toContain('lrn-piano');
          if (exercise.media?.type === 'staff') expect(html).toContain('lrn-staff');
          kinds.set(exercise.kind, (kinds.get(exercise.kind) ?? 0) + 1);
          if (exercise.media) media.set(exercise.media.type, (media.get(exercise.media.type) ?? 0) + 1);
          drawn += 1;
        }
        expect(model.current).not.toBeNull();
      }
    }
    console.log('drawn', drawn, Object.fromEntries(kinds), Object.fromEntries(media));
    expect(drawn).toBeGreaterThan(100);
  }, 280000);
});
