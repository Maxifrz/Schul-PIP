import type { LearnExercise } from '../exercise';
import { choice, typed } from '../exercises';
import type { Clef, ExerciseMedia, NoteValue, Pitch } from '../media';
import { LearnRandom } from '../random';
import { MusicKey, MusicNames, floorMod, germanName, pitchAtStep, pitchClass, staffPosition } from './theory';
import { pitch } from '../media';

/** Makes one exercise. `level` is 1 to 3 for the three lessons of a unit and 4 for everything the unit teaches. */
export type MusicMaker = (random: LearnRandom, level: number) => LearnExercise | null;

/** A question with fixed wording, shown at one lesson level. */
export interface MusicFact {
  id: string;
  level: number;
  prompt: string;
  correct: string;
  wrong: string[];
  explanation: string;
  media?: ExerciseMedia;
}

export const fact = (id: string, level: number, prompt: string, p: { correct: string; wrong: string[]; explanation: string; media?: ExerciseMedia }): MusicFact =>
  ({ id, level, prompt, correct: p.correct, wrong: p.wrong, explanation: p.explanation, media: p.media });

export const MusicKit = {
  note: (letter: number, octave: number, alteration = 0): Pitch => pitch(letter, octave, alteration),

  staff(clef: Clef, pitches: Pitch[], p: { key?: number; time?: string | null; value?: NoteValue; chord?: boolean } = {}): ExerciseMedia {
    return {
      kind: 'staff',
      staff: { clef, keySignature: p.key ?? 0, time: p.time ?? null, notes: pitches.map((q) => ({ pitch: q, value: p.value ?? 'quarter', isRest: false })), chord: p.chord ?? false },
    };
  },

  pick<T>(items: readonly T[], random: LearnRandom): T | null {
    return items.length === 0 ? null : (random.pick(items) as T);
  },

  /** An element of `fresh` most of the time on the lessons, anything taught so far otherwise; everything on level 4. */
  draw<T>(fresh: readonly T[], all: readonly T[], level: number, random: LearnRandom): T | null {
    if (level >= 4 || fresh.length === 0) return MusicKit.pick(all, random);
    const useFresh = random.int(10) < 6;
    return MusicKit.pick(useFresh ? fresh : all, random);
  },

  /** Wrong note names near the right one: the same letter with another sign, the neighbouring letters. Nothing that sounds like the right answer is among them. */
  wrongNames(correct: Pitch, random: LearnRandom, naturalsOnly = false): string[] {
    const candidates: Pitch[] = [];
    const same = naturalsOnly ? [] : [correct.alteration - 1, correct.alteration + 1, 0].filter((a) => a !== correct.alteration && Math.abs(a) <= 1);
    for (const alteration of same) candidates.push(pitch(correct.letter, correct.octave, alteration));
    for (const step of [1, -1, 2, -2]) {
      candidates.push(pitch(floorMod(correct.letter + step, 7), correct.octave, naturalsOnly ? 0 : correct.alteration));
    }
    const seen = new Set([germanName(correct)]);
    const result: Pitch[] = [];
    for (const c of candidates) {
      if (pitchClass(c) !== pitchClass(correct) && !seen.has(germanName(c))) {
        seen.add(germanName(c));
        result.push(c);
      }
    }
    // The nearest ones first, but not always in the same order.
    const head = random.shuffled(result.slice(0, 3));
    return [...head, ...result.slice(3)].map(germanName);
  },

  /** Wrong readings of a note on the staff: the name in the other clef first, then the neighbouring letters. */
  wrongReadings(p: Pitch, clef: Clef, otherClef: Clef | null, random: LearnRandom, naturalsOnly = false): string[] {
    const result: string[] = [];
    if (otherClef) {
      const step = staffPosition(p, clef).step;
      const other = pitchAtStep(step, otherClef);
      if (other.letter !== p.letter) result.push(germanName(pitch(other.letter, other.octave, p.alteration)));
    }
    result.push(...MusicKit.wrongNames(p, random, naturalsOnly));
    return result;
  },

  /** "auf der 2. Linie", "im 1. Zwischenraum", "unter der 1. Linie" ... */
  phrase(step: number): string {
    switch (step) {
      case 0: case 2: case 4: case 6: case 8: return `auf der ${step / 2 + 1}. Linie`;
      case 1: case 3: case 5: case 7: return `im ${(step + 1) / 2}. Zwischenraum`;
      case -1: return 'unter der 1. Linie';
      case -2: return 'auf der 1. Hilfslinie unter dem System';
      case 9: return 'über der 5. Linie';
      case 10: return 'auf der 1. Hilfslinie über dem System';
      default: return 'außerhalb des Systems';
    }
  },

  clefWord: (clef: Clef): string => ({ treble: 'Violinschlüssel', bass: 'Bassschlüssel', alto: 'Altschlüssel' })[clef],

  /** "Fis" or "Fis und Cis" or "Fis, Cis und Gis": the signs of a key signature. */
  signNames(count: number): string {
    const names = MusicKey.accidentals(count).map(germanName);
    if (names.length === 0) return 'keine Vorzeichen';
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
  },

  /** "3 Kreuze", "1 Be", "keine Vorzeichen". */
  signCount(count: number): string {
    if (count === 0) return 'keine Vorzeichen';
    if (count > 0) return count === 1 ? '1 Kreuz' : `${count} Kreuze`;
    return `${-count} Be`;
  },

  /** The text of a beat count: "4", "1/2", "1/4". */
  beatText: (fraction: [number, number]): string => (fraction[1] === 1 ? String(fraction[0]) : `${fraction[0]}/${fraction[1]}`),

  /** A choice from a list of fixed questions. */
  fact(facts: MusicFact[], level: number, tag: string, random: LearnRandom): LearnExercise | null {
    const pool = facts.filter((f) => level >= 4 || f.level === level);
    const chosen = MusicKit.pick(pool, random);
    if (!chosen) return null;
    return choice(random, {
      id: `${tag}.fact.${chosen.id}`, key: `${tag}.fact.${chosen.id}`, prompt: chosen.prompt, correct: chosen.correct, wrong: chosen.wrong,
      explanation: chosen.explanation, media: chosen.media,
    });
  },

  /** Notes of an octave range on the keyboard that have this name (every octave). */
  keys: (p: Pitch): number[] => MusicNames.keys(pitchClass(p)),

  /** "das eingestrichene c", "das große C": the note in its octave, as the keyboard questions name it. */
  octaveText(p: Pitch): string | null {
    const name = germanName(p);
    switch (p.octave) {
      case 2: return `das große ${name}`;
      case 3: return `das kleine ${name.toLowerCase()}`;
      case 4: return `das eingestrichene ${name.toLowerCase()}`;
      case 5: return `das zweigestrichene ${name.toLowerCase()}`;
      default: return null;
    }
  },

  /** Typed note names: "Cis" and "cis" both count. The check is letter by letter, so "Cis" is never taken for "Dis". */
  typedNote(p: { id: string; key: string; prompt: string; answer: Pitch; explanation?: string; media?: ExerciseMedia }): LearnExercise | null {
    return typed({ id: p.id, key: p.key, prompt: p.prompt, answer: germanName(p.answer), mode: 'exact', explanation: p.explanation ?? '', media: p.media });
  },
};

/** What a unit asks: topic keys per node. A topic in the practice list that is "~" stands for a topic of an earlier unit. */
export interface MusicUnitDef {
  makers: Record<string, MusicMaker>;
  lessons: string[][];
  practice: string[];
  checkpoint: string[];
  /** Topics worth meeting again in later units. */
  review: string[];
}
