// Helpers the units of the music course share: a maker is one kind of exercise for a lesson level.
// A port of Lernwerk/Services/Learn/Music/MusicKit.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import { ExerciseMedia } from '../media';
import { type Clef, type NoteValue, type Pitch, pitch, staffNote, staffSpec } from '../music';
import type { LearnRandom } from '../random';
import { MusicKey } from './harmony';
import { atStep, staffPosition } from './rhythm';
import { germanName, MusicMath, MusicNames, pitchClass } from './theory';

/** Makes one exercise. `level` is 1 to 3 for the three lessons of a unit and 4 for everything the unit teaches. */
export type MusicMaker = (random: LearnRandom, level: number) => LearnExercise | null;

/** What a unit asks: topic keys per node. A topic in the practice list that is "~" stands for a topic of an earlier unit. */
export interface MusicUnitDef {
  makers: Record<string, MusicMaker>;
  lessons: string[][];
  practice: string[];
  checkpoint: string[];
  /** Topics worth meeting again in later units. */
  review: string[];
}

/** A question with fixed wording, shown at one lesson level. */
export interface MusicFact {
  id: string;
  level: number;
  prompt: string;
  correct: string;
  wrong: string[];
  explanation: string;
  media?: ExerciseMedia | null;
}

/** Swift: `MusicFact(id, level:, prompt, correct:, wrong:, explanation:, media:)`. */
export function fact(
  id: string,
  level: number,
  prompt: string,
  correct: string,
  wrong: string[],
  explanation: string,
  media: ExerciseMedia | null = null,
): MusicFact {
  return { id, level, prompt, correct, wrong, explanation, media };
}

/** Swift's `Bool.random(using:)`: bit 17 of one generator word, clear means true. */
export function randomBool(random: LearnRandom): boolean {
  return ((random.next() >> 17n) & 1n) === 0n;
}

export const MusicKit = {
  note(letter: number, octave: number, alteration = 0): Pitch {
    return pitch(letter, octave, alteration);
  },

  staff(
    clef: Clef,
    pitches: Pitch[],
    o: { key?: number; time?: string | null; value?: NoteValue; chord?: boolean } = {},
  ): ExerciseMedia {
    const value = o.value ?? 'quarter';
    return ExerciseMedia.staff(
      staffSpec(clef, pitches.map((p) => staffNote(p, value)), { keySignature: o.key ?? 0, time: o.time ?? null, chord: o.chord ?? false }),
    );
  },

  pick<T>(items: readonly T[], random: LearnRandom): T | undefined {
    return random.randomElement(items);
  },

  /** An element of `fresh` most of the time on the lessons, anything taught so far otherwise; everything on level 4. */
  draw<T>(fresh: readonly T[], all: readonly T[], level: number, random: LearnRandom): T | undefined {
    if (level >= 4 || fresh.length === 0) return random.randomElement(all);
    const useFresh = random.int(0, 10) < 6;
    return random.randomElement(useFresh ? fresh : all);
  },

  /** Wrong note names near the right one: the same letter with another sign, the neighbouring letters. Nothing that
   * sounds like the right answer is among them. */
  wrongNames(correct: Pitch, naturalsOnly: boolean, random: LearnRandom): string[] {
    const candidates: Pitch[] = [];
    const same = naturalsOnly
      ? []
      : [correct.alteration - 1, correct.alteration + 1, 0].filter((a) => a !== correct.alteration && Math.abs(a) <= 1);
    for (const alteration of same) candidates.push(pitch(correct.letter, correct.octave, alteration));
    for (const step of [1, -1, 2, -2]) {
      const letter = MusicMath.floorMod(correct.letter + step, 7);
      candidates.push(pitch(letter, correct.octave, naturalsOnly ? 0 : correct.alteration));
    }
    const seen = new Set<string>([germanName(correct)]);
    const result: Pitch[] = [];
    for (const candidate of candidates) {
      if (pitchClass(candidate) !== pitchClass(correct) && !seen.has(germanName(candidate))) {
        seen.add(germanName(candidate));
        result.push(candidate);
      }
    }
    // The nearest ones first, but not always in the same order.
    const head = random.shuffled(result.slice(0, 3));
    return [...head, ...result.slice(3)].map(germanName);
  },

  /** Wrong readings of a note on the staff: the name in the other clef first, then the neighbouring letters. */
  wrongReadings(p: Pitch, clef: Clef, otherClef: Clef | null, naturalsOnly: boolean, random: LearnRandom): string[] {
    const result: string[] = [];
    if (otherClef) {
      const step = staffPosition(p, clef).step;
      const other = atStep(step, otherClef);
      if (other.letter !== p.letter) result.push(germanName(pitch(other.letter, other.octave, p.alteration)));
    }
    result.push(...MusicKit.wrongNames(p, naturalsOnly, random));
    return result;
  },

  /** "auf der 2. Linie", "im 1. Zwischenraum", "unter der 1. Linie" ... */
  phrase(step: number): string {
    switch (step) {
      case 0: case 2: case 4: case 6: case 8: return `auf der ${Math.trunc(step / 2) + 1}. Linie`;
      case 1: case 3: case 5: case 7: return `im ${Math.trunc((step + 1) / 2)}. Zwischenraum`;
      case -1: return 'unter der 1. Linie';
      case -2: return 'auf der 1. Hilfslinie unter dem System';
      case 9: return 'über der 5. Linie';
      case 10: return 'auf der 1. Hilfslinie über dem System';
      default: return 'außerhalb des Systems';
    }
  },

  clefWord(clef: Clef): string {
    switch (clef) {
      case 'treble': return 'Violinschlüssel';
      case 'bass': return 'Bassschlüssel';
      case 'alto': return 'Altschlüssel';
    }
  },

  /** "Fis" or "Fis und Cis" or "Fis, Cis und Gis": the signs of a key signature. */
  signNames(count: number): string {
    const names = MusicKey.accidentals(count).map(germanName);
    if (names.length === 0) return 'keine Vorzeichen';
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1];
  },

  /** "3 Kreuze", "1 Be", "keine Vorzeichen". */
  signCount(count: number): string {
    if (count === 0) return 'keine Vorzeichen';
    if (count > 0) return count === 1 ? '1 Kreuz' : `${count} Kreuze`;
    return `${-count} Be`;
  },

  /** The text of a beat count: "4", "1/2", "1/4". */
  beatText(fraction: [number, number]): string {
    return fraction[1] === 1 ? `${fraction[0]}` : `${fraction[0]}/${fraction[1]}`;
  },

  /** A choice from a list of fixed questions. */
  fact(facts: MusicFact[], level: number, tag: string, random: LearnRandom): LearnExercise | null {
    const pool = facts.filter((f) => level >= 4 || f.level === level);
    const chosen = random.randomElement(pool);
    if (!chosen) return null;
    return Exercises.choice(
      {
        id: `${tag}.fact.${chosen.id}`,
        key: `${tag}.fact.${chosen.id}`,
        prompt: chosen.prompt,
        correct: chosen.correct,
        wrong: chosen.wrong,
        explanation: chosen.explanation,
        media: chosen.media ?? null,
      },
      random,
    );
  },

  /** Notes of an octave range on the keyboard that have this name (every octave). */
  keys(p: Pitch): number[] {
    return MusicNames.keys(pitchClass(p));
  },

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
  typedNote(o: { id: string; key: string; prompt: string; answer: Pitch; explanation?: string; media?: ExerciseMedia | null }): LearnExercise | null {
    return Exercises.typed({
      id: o.id,
      key: o.key,
      prompt: o.prompt,
      answer: germanName(o.answer),
      mode: 'exact',
      explanation: o.explanation ?? '',
      media: o.media ?? null,
    });
  },
};
