// Music theory in plain TypeScript: German note names, spelling by letter distance, MIDI numbers and intervals.
// Everything the music course teaches is computed here, so the exercises cannot teach a wrongly spelled note.
// A port of Lernwerk/Services/Learn/Music/MusicTheory.swift.

import { type Pitch, pitch, pitchDiatonic, pitchMidi } from '../music';

export const MusicMath = {
  floorDiv(a: number, b: number): number {
    return Math.floor(a / b);
  },
  floorMod(a: number, b: number): number {
    return ((a % b) + b) % b;
  },
};

/** Semitones above C for the seven letters C D E F G A H. */
export const NATURAL_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
export const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];

export function samePitch(a: Pitch, b: Pitch): boolean {
  return a.letter === b.letter && a.octave === b.octave && a.alteration === b.alteration;
}

export const diatonic = pitchDiatonic;
export const midi = pitchMidi;

/** 0 = C ... 11 = H, whatever the spelling. */
export function pitchClass(p: Pitch): number {
  return MusicMath.floorMod(pitchMidi(p), 12);
}

/** The German name without the octave: C, Cis, Des, Es, B (for H flat), H, His, Asas ... */
export function germanName(p: Pitch): string {
  const base = LETTER_NAMES[MusicMath.floorMod(p.letter, 7)];
  const a = p.alteration;
  if (a === 0) return base;
  if (a > 0) return base + 'is'.repeat(a);
  if (a === -1) {
    if (base === 'H') return 'B';
    if (base === 'E') return 'Es';
    if (base === 'A') return 'As';
    return base + 'es';
  }
  if (a === -2) {
    if (base === 'H') return 'Heses';
    if (base === 'E') return 'Eses';
    if (base === 'A') return 'Asas';
    return base + 'eses';
  }
  return base + 'es'.repeat(-a);
}

/** The octave in the German way: "Kontraoktave" (octave 1) up to "viergestrichene Oktave". */
export function octaveName(octave: number): string {
  switch (octave) {
    case 0: return 'Subkontraoktave';
    case 1: return 'Kontraoktave';
    case 2: return 'große Oktave';
    case 3: return 'kleine Oktave';
    case 4: return 'eingestrichene Oktave';
    case 5: return 'zweigestrichene Oktave';
    case 6: return 'dreigestrichene Oktave';
    case 7: return 'viergestrichene Oktave';
    default: return `Oktave ${octave}`;
  }
}

/** The note with its octave in scientific notation, like "Fis4" or "B3". */
export function scientificName(p: Pitch): string {
  return germanName(p) + String(p.octave);
}

/** The pitch `letterSteps` letters and `semitones` half steps away. Because the letters are counted, the result is
 * spelled correctly: a third above D with 4 semitones is F sharp, never G flat. */
export function shifted(p: Pitch, letterSteps: number, semitones: number): Pitch {
  const diatonicNumber = pitchDiatonic(p) + letterSteps;
  const newOctave = MusicMath.floorDiv(diatonicNumber, 7);
  const newLetter = MusicMath.floorMod(diatonicNumber, 7);
  const target = pitchMidi(p) + semitones;
  const natural = 12 * (newOctave + 1) + NATURAL_SEMITONES[newLetter];
  return pitch(newLetter, newOctave, target - natural);
}

const SHARPS: Array<[number, number]> = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const FLATS: Array<[number, number]> = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];

/** A pitch for a MIDI number, spelled with sharps or with flats. */
export function spelled(midiNumber: number, preferFlats = false): Pitch {
  const octave = MusicMath.floorDiv(midiNumber, 12) - 1;
  const pc = MusicMath.floorMod(midiNumber, 12);
  const entry = (preferFlats ? FLATS : SHARPS)[pc];
  return pitch(entry[0], octave, entry[1]);
}

/** Both notes sound the same, whatever their names. */
export function isEnharmonic(a: Pitch, b: Pitch): boolean {
  return pitchMidi(a) === pitchMidi(b);
}

export const MusicNames = {
  /** The pitch class (letter and alteration) a German note name stands for, "cis" and "Cis" alike; null if it is no name. */
  parse(text: string): { letter: number; alteration: number } | null {
    const wanted = text.replace(/^[ \t]+|[ \t]+$/g, '').toLowerCase();
    if (wanted === '') return null;
    for (let letter = 0; letter < 7; letter++) {
      for (let alteration = -2; alteration <= 2; alteration++) {
        const name = germanName(pitch(letter, 4, alteration)).toLowerCase();
        if (name === wanted || (alteration === -2 && letter === 5 && wanted === 'ases')) return { letter, alteration };
      }
    }
    return null;
  },

  /** Every MIDI number of the piano range with this pitch class. */
  keys(pc: number, lower = 21, upper = 108): number[] {
    const result: number[] = [];
    for (let m = lower; m <= upper; m++) if (MusicMath.floorMod(m, 12) === pc) result.push(m);
    return result;
  },

  isBlackKey(m: number): boolean {
    return [1, 3, 6, 8, 10].includes(MusicMath.floorMod(m, 12));
  },
};

export type IntervalQuality = 'perfect' | 'major' | 'minor' | 'augmented' | 'diminished';

/** An interval counted upward: the letter distance and the half steps decide its name. */
export interface MusicInterval {
  /** Letter distance: 0 is the Prim, 7 the Oktave. */
  steps: number;
  semitones: number;
}

const MAJOR_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12];
const IS_PERFECT_KIND = [true, false, false, true, true, false, false, true];
export const SIZE_NAMES = ['Prim', 'Sekunde', 'Terz', 'Quarte', 'Quinte', 'Sexte', 'Septime', 'Oktave'];

export function interval(steps: number, semitones: number): MusicInterval {
  return { steps, semitones };
}

/** The interval from `lower` up to `upper`. */
export function intervalBetween(lower: Pitch, upper: Pitch): MusicInterval {
  return { steps: pitchDiatonic(upper) - pitchDiatonic(lower), semitones: pitchMidi(upper) - pitchMidi(lower) };
}

export function sameInterval(a: MusicInterval, b: MusicInterval): boolean {
  return a.steps === b.steps && a.semitones === b.semitones;
}

/** The number as counted by students: 1 for the Prim ... 8 for the Oktave. */
export function intervalNumber(i: MusicInterval): number {
  return i.steps + 1;
}

export function intervalQuality(i: MusicInterval): IntervalQuality | null {
  if (i.steps < 0 || i.steps > 7) return null;
  const diff = i.semitones - MAJOR_SEMITONES[i.steps];
  if (IS_PERFECT_KIND[i.steps]) {
    switch (diff) {
      case 0: return 'perfect';
      case 1: return 'augmented';
      case -1: return 'diminished';
      default: return null;
    }
  }
  switch (diff) {
    case 0: return 'major';
    case -1: return 'minor';
    case 1: return 'augmented';
    case -2: return 'diminished';
    default: return null;
  }
}

export function intervalSizeName(i: MusicInterval): string {
  return i.steps >= 0 && i.steps <= 7 ? SIZE_NAMES[i.steps] : '';
}

/** "reine Quinte", "kleine Terz", "übermäßige Quarte" ... null for what school music does not name. */
export function intervalName(i: MusicInterval): string | null {
  const quality = intervalQuality(i);
  if (quality === null) return null;
  let word: string;
  switch (quality) {
    case 'perfect': word = 'reine'; break;
    case 'major': word = 'große'; break;
    case 'minor': word = 'kleine'; break;
    case 'augmented': word = 'übermäßige'; break;
    case 'diminished': word = 'verminderte'; break;
  }
  return `${word} ${intervalSizeName(i)}`;
}

/** The same interval turned upside down: a major third becomes a minor sixth. */
export function inverted(i: MusicInterval): MusicInterval {
  return { steps: 7 - i.steps, semitones: 12 - i.semitones };
}

export function isTritone(i: MusicInterval): boolean {
  return i.semitones === 6 && (i.steps === 3 || i.steps === 4);
}

/** The upper note when this interval is built above `p`. */
export function intervalAbove(i: MusicInterval, p: Pitch): Pitch {
  return shifted(p, i.steps, i.semitones);
}

/** The lower note when this interval is built below `p`. */
export function intervalBelow(i: MusicInterval, p: Pitch): Pitch {
  return shifted(p, -i.steps, -i.semitones);
}

/** The intervals a school course names, by letter distance and half steps. */
export const STANDARD_INTERVALS: MusicInterval[] = [
  interval(0, 0), interval(1, 1), interval(1, 2),
  interval(2, 3), interval(2, 4), interval(3, 5),
  interval(4, 7), interval(5, 8), interval(5, 9),
  interval(6, 10), interval(6, 11), interval(7, 12),
];
