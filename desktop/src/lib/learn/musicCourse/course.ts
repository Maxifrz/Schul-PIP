// "Musik": eight units from the staff to keys and the circle of fifths. Every note name, interval and chord is
// computed by the theory code at run time, so the course cannot teach a wrongly spelled note.
// A port of Lernwerk/Services/Learn/Music/MusicCourse.swift.

import { type Course, type CourseNode, type CourseProvider, makeCourse, standardUnit } from '../course';
import type { LearnExercise } from '../exercise';
import { Exercises } from '../exercises';
import { LearnRandom } from '../random';
import type { MusicUnitDef } from './kit';
import { MUSIC_TEXTS } from './texts';
import { unit1Def } from './unit1';
import { unit2Def } from './unit2';
import { unit3Def } from './unit3';
import { unit4Def } from './unit4';
import { unit5Def } from './unit5';
import { unit6Def } from './unit6';
import { unit7Def } from './unit7';
import { unit8Def } from './unit8';

export const MusicUnits: { defs: MusicUnitDef[] } = {
  defs: [unit1Def, unit2Def, unit3Def, unit4Def, unit5Def, unit6Def, unit7Def, unit8Def],
};

export const MUSIC_COURSE_ID = 'music';

function buildCourse(): Course {
  const units = MUSIC_TEXTS.map((text, index) => standardUnit(MUSIC_COURSE_ID, index + 1, text.title, text.summary, text.tip));
  return makeCourse({
    id: MUSIC_COURSE_ID,
    title: 'Musik',
    subtitle: 'Noten lesen, hören, verstehen',
    kind: 'music',
    color: 0x9e6b8e,
    symbol: 'music.note',
    sections: [
      { id: 'music.s1', title: 'Notenlesen', units: units.slice(0, 2) },
      { id: 'music.s2', title: 'Rhythmus und Vorzeichen', units: units.slice(2, 4) },
      { id: 'music.s3', title: 'Tonleitern und Intervalle', units: units.slice(4, 6) },
      { id: 'music.s4', title: 'Dreiklänge und Tonarten', units: units.slice(6, 8) },
    ],
  });
}

/** A question about an earlier unit. */
function review(before: number, random: LearnRandom): LearnExercise | null {
  if (before <= 1) return null;
  const index = random.randomElement(Array.from({ length: before - 1 }, (_, i) => i));
  if (index === undefined) return null;
  const def = MusicUnits.defs[index];
  const topic = random.randomElement(def.review);
  if (topic === undefined) return null;
  return def.makers[topic]?.(random, 4) ?? null;
}

class MusicProvider implements CourseProvider {
  readonly course: Course = buildCourse();

  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    if (node.kind === 'chest' || node.unitNumber < 1 || node.unitNumber > MusicUnits.defs.length) return [];
    const random = new LearnRandom(Exercises.seed(node, seed));
    const def = MusicUnits.defs[node.unitNumber - 1];
    let topics: string[];
    switch (node.kind) {
      case 'lesson': topics = def.lessons[Math.min(Math.max(node.index, 1), def.lessons.length) - 1]; break;
      case 'practice': topics = def.practice; break;
      default: topics = def.checkpoint;
    }
    const level = node.kind === 'lesson' ? node.index : 4;
    const made: LearnExercise[] = [];
    const used = new Set<string>();
    for (const topic of topics) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const exercise = topic === '~' ? review(node.unitNumber, random) : (def.makers[topic]?.(random, level) ?? null);
        if (exercise && !used.has(exercise.id)) {
          used.add(exercise.id);
          made.push(exercise);
          break;
        }
      }
    }
    return Exercises.arrange(made, 15);
  }
}

export const musicProvider: CourseProvider = new MusicProvider();
