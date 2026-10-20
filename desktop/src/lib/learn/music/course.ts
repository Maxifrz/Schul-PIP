import { Course, CourseNode, CourseProvider, SkillFacet, SkillTag, standardUnit } from '../course';
import type { LearnExercise } from '../exercise';
import { arrange, seedFor } from '../exercises';
import { LearnRandom } from '../random';
import type { MusicUnitDef } from './kit';
import { musicUnitTexts } from './texts';
import { MusicUnit1 } from './unit01';
import { MusicUnit2 } from './unit02';
import { MusicUnit3 } from './unit03';
import { MusicUnit4 } from './unit04';
import { MusicUnit5 } from './unit05';
import { MusicUnit6 } from './unit06';
import { MusicUnit7 } from './unit07';
import { MusicUnit8 } from './unit08';

const COURSE_ID = 'music';

export const musicUnitDefs = (): MusicUnitDef[] => [MusicUnit1, MusicUnit2, MusicUnit3, MusicUnit4, MusicUnit5, MusicUnit6, MusicUnit7, MusicUnit8].map((u) => u.def);

/** "Musik": eight units from the staff to keys and the circle of fifths. Every note name, interval and chord is computed by the theory module at run time, so the course cannot teach a wrongly spelled note. */
export class MusicProvider implements CourseProvider {
  readonly course: Course;

  constructor() {
    const units = musicUnitTexts.map((text, index) => standardUnit(COURSE_ID, index + 1, text.title, text.summary, text.tip));
    this.course = {
      id: COURSE_ID, title: 'Musik', subtitle: 'Noten lesen, hören, verstehen', kind: 'music', color: 0x9e6b8e, symbol: 'music',
      sections: [
        { id: 'music.s1', title: 'Notenlesen', units: units.slice(0, 2) },
        { id: 'music.s2', title: 'Rhythmus und Vorzeichen', units: units.slice(2, 4) },
        { id: 'music.s3', title: 'Tonleitern und Intervalle', units: units.slice(4, 6) },
        { id: 'music.s4', title: 'Dreiklänge und Tonarten', units: units.slice(6, 8) },
      ],
    };
  }

  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    const defs = musicUnitDefs();
    if (node.kind === 'chest' || node.unitNumber < 1 || node.unitNumber > defs.length) return [];
    const random = new LearnRandom(seedFor(node, seed));
    const def = defs[node.unitNumber - 1];
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
        const exercise = topic === '~' ? this.review(node.unitNumber, random, defs) : def.makers[topic]?.(random, level) ?? null;
        if (exercise && !used.has(exercise.id)) {
          used.add(exercise.id);
          made.push(exercise);
          break;
        }
      }
    }
    return arrange(made, 15);
  }

  /** A question about an earlier unit. */
  private review(unit: number, random: LearnRandom, defs: MusicUnitDef[]): LearnExercise | null {
    if (unit <= 1) return null;
    const index = random.pick(Array.from({ length: unit - 1 }, (_, i) => i));
    if (index === undefined) return null;
    const def = defs[index];
    const topic = random.pick(def.review);
    return topic === undefined ? null : def.makers[topic]?.(random, 4) ?? null;
  }
}

export const music = new MusicProvider();
void ([] as Array<SkillFacet | SkillTag>);
