import type { Clef, NoteValue, Pitch } from '../media';
import { diatonic } from '../media';

// The arithmetic behind the staff and the keyboard. Plain functions, so the tests can check them without a screen; the views only draw what these return.

export type Accidental = 'sharp' | 'flat' | 'natural' | 'doubleSharp' | 'doubleFlat';

/** The diatonic number (octave * 7 + letter) of the bottom line: E4 in the treble clef, G2 in the bass clef, F3 in the alto clef. */
export const bottomLine = (clef: Clef): number => (clef === 'treble' ? 4 * 7 + 2 : clef === 'bass' ? 2 * 7 + 4 : 3 * 7 + 3);

/** Half staff spaces above the bottom line: 0 is the bottom line, 1 the first space, 8 the top line. */
export const stepOf = (p: Pitch, clef: Clef): number => diatonic(p) - bottomLine(clef);

/** The even steps with a ledger line for a note on `step`: below the staff -2, -4, ... or above it 10, 12, ... */
export function ledgerSteps(step: number): number[] {
  const result: number[] = [];
  if (step <= -2) for (let s = -2; s >= step; s -= 2) result.push(s);
  else if (step >= 10) for (let s = 10; s <= step; s += 2) result.push(s);
  return result;
}

const sharpLetters = [3, 0, 4, 1, 5, 2, 6];
const flatLetters = [6, 2, 5, 1, 4, 0, 3];

/** Where the signs of a key signature sit: the step of each, in the order they are drawn. */
export function keySignatureSigns(count: number, clef: Clef): Array<{ step: number; sharp: boolean }> {
  const n = Math.min(7, Math.abs(count));
  if (n === 0) return [];
  // In the treble clef the sharps sit on F5 C5 G5 D5 A4 E5 B4, the flats on B4 E5 A4 D5 G4 C5 F4; the bass clef's are two steps lower, the alto clef's one.
  const sharpSteps = [8, 5, 9, 6, 3, 7, 4];
  const flatSteps = [4, 7, 3, 6, 2, 5, 1];
  const shift = clef === 'treble' ? 0 : clef === 'bass' ? -2 : -1;
  const steps = count > 0 ? sharpSteps : flatSteps;
  return Array.from({ length: n }, (_, i) => ({ step: steps[i] + shift, sharp: count > 0 }));
}

/** The alteration the key signature gives a letter: +1, -1 or 0. */
export function keyAlteration(letter: number, key: number): number {
  const n = Math.min(7, Math.abs(key));
  if (n === 0) return 0;
  return (key > 0 ? sharpLetters : flatLetters).slice(0, n).includes(letter) ? (key > 0 ? 1 : -1) : 0;
}

/** The sign written before a note: none when the key signature already gives its alteration. */
export function accidentalFor(p: Pitch, key: number): Accidental | null {
  if (p.alteration === keyAlteration(p.letter, key)) return null;
  switch (p.alteration) {
    case 1: return 'sharp';
    case -1: return 'flat';
    case 2: return 'doubleSharp';
    case -2: return 'doubleFlat';
    default: return 'natural';
  }
}

/** Stems go up for notes below the middle line and down from it (a chord follows its middle). */
export function stemUp(steps: number[]): boolean {
  if (steps.length === 0) return true;
  return (Math.min(...steps) + Math.max(...steps)) / 2 < 4;
}

/** Chord notes a second apart cannot share a side of the stem; the upper one goes to the other side. The result has one flag per note, in the order given: true for the note that is moved. */
export function shiftedSteps(steps: number[]): boolean[] {
  const order = steps.map((step, index) => ({ step, index })).sort((a, b) => a.step - b.step || a.index - b.index);
  const result = steps.map(() => false);
  let previousShifted = false;
  let previousStep: number | null = null;
  for (const { step, index } of order) {
    if (previousStep !== null && step - previousStep === 1 && !previousShifted) {
      result[index] = true;
      previousShifted = true;
    } else {
      previousShifted = false;
    }
    previousStep = step;
  }
  return result;
}

/** Flags a stem gets: one for an eighth, two for a sixteenth. */
export const flags = (value: NoteValue): number => (value === 'eighth' ? 1 : value === 'sixteenth' ? 2 : 0);

const mod12 = (m: number) => ((m % 12) + 12) % 12;

/** The keys of a piano keyboard. */
export const PianoLayout = {
  isBlack: (midi: number): boolean => [1, 3, 6, 8, 10].includes(mod12(midi)),

  whiteKeys(low: number, high: number): number[] {
    const result: number[] = [];
    for (let m = low; m <= high; m++) if (!PianoLayout.isBlack(m)) result.push(m);
    return result;
  },

  /** The keys shown for an exercise: from the C below the lowest right key to the C above the highest, at least two octaves, within the piano. */
  range(correct: number[]): [number, number] {
    if (correct.length === 0) return [60, 84];
    const low = Math.min(...correct), high = Math.max(...correct);
    let start = Math.floor(low / 12) * 12;
    let end = Math.floor((high + 11) / 12) * 12;
    if (end <= high) end += 12;
    if (end - start < 24) end = start + 24;
    start = Math.max(12, start);
    end = Math.min(108, Math.max(end, start + 12));
    return [start, end];
  },

  /** Where a black key's center lies, in white-key widths from the left edge of the range: between its two neighbouring white keys, a little off center for the groups of three. */
  blackKeyCenter(midi: number, low: number): number {
    const whitesBefore = PianoLayout.whiteKeys(low, midi).length;
    const offset = ({ 1: -0.06, 3: 0.06, 6: -0.08, 10: 0.08 } as Record<number, number>)[mod12(midi)] ?? 0;
    return whitesBefore + offset;
  },

  /** The note's name for a spoken label: "C4", "F♯3". */
  name(midi: number): string {
    const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'];
    return `${names[mod12(midi)]}${Math.floor(midi / 12) - 1}`;
  },
};
