// The vocabulary of notation shared by the staff drawing and the music course.
// A port of Lernwerk/Services/Learn/Course/MusicTypes.swift.

export type Clef = 'treble' | 'bass' | 'alto';

/** Note and rest lengths. */
export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

/** A pitch by letter, octave and accidental: no sound yet, just the name on the staff. */
export interface Pitch {
  /** 0 = C, 1 = D, 2 = E, 3 = F, 4 = G, 5 = A, 6 = H (B in English). */
  letter: number;
  /** Scientific pitch notation: the middle C is C4. */
  octave: number;
  /** -2 double flat ... 2 double sharp. */
  alteration: number;
}

export function pitch(letter: number, octave: number, alteration = 0): Pitch {
  return { letter, octave, alteration };
}

/** Steps on the staff counted in lines and spaces from C0; the middle C is 28. */
export function pitchDiatonic(p: Pitch): number {
  return p.octave * 7 + p.letter;
}

const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export function pitchMidi(p: Pitch): number {
  return 12 * (p.octave + 1) + SEMITONES[((p.letter % 7) + 7) % 7] + p.alteration;
}

export interface StaffNote {
  pitch: Pitch;
  value: NoteValue;
  isRest: boolean;
}

export function staffNote(p: Pitch, value: NoteValue = 'quarter', isRest = false): StaffNote {
  return { pitch: p, value, isRest };
}

/** One staff to draw. */
export interface StaffSpec {
  clef: Clef;
  /** Sharps are positive, flats negative: 2 is D major, -3 is E-flat major. */
  keySignature: number;
  /** "4/4", "3/4", or null for none. */
  time: string | null;
  notes: StaffNote[];
  /** Draw all notes on one stem as a chord instead of one after the other. */
  chord: boolean;
}

export function staffSpec(
  clef: Clef,
  notes: StaffNote[],
  options: { keySignature?: number; time?: string | null; chord?: boolean } = {},
): StaffSpec {
  return { clef, keySignature: options.keySignature ?? 0, time: options.time ?? null, notes, chord: options.chord ?? false };
}
