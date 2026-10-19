// What an exercise shows or plays above its question, and the vocabulary of notation shared by the staff and the music course.

export type Clef = 'treble' | 'bass' | 'alto';
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

export const pitch = (letter: number, octave: number, alteration = 0): Pitch => ({ letter, octave, alteration });
/** Steps on the staff counted in lines and spaces from C0; the middle C is 28. */
export const diatonic = (p: Pitch): number => p.octave * 7 + p.letter;
export const midiOf = (p: Pitch): number => 12 * (p.octave + 1) + [0, 2, 4, 5, 7, 9, 11][((p.letter % 7) + 7) % 7] + p.alteration;

export interface StaffNote {
  pitch: Pitch;
  value: NoteValue;
  isRest: boolean;
}

export const note = (p: Pitch, value: NoteValue = 'quarter', isRest = false): StaffNote => ({ pitch: p, value, isRest });

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

export const staff = (clef: Clef, notes: StaffNote[], options: { keySignature?: number; time?: string | null; chord?: boolean } = {}): StaffSpec => ({
  clef,
  keySignature: options.keySignature ?? 0,
  time: options.time ?? null,
  notes,
  chord: options.chord ?? false,
});

/** A chess position to show. The pieces come from the FEN's first field; the side to move is its second. */
export interface BoardSpec {
  fen: string;
  /** White's side is at the bottom unless this is set. */
  flipped: boolean;
  /** Squares to mark, like "e4". */
  marked: string[];
}

export const board = (fen: string, flipped = false, marked: string[] = []): BoardSpec => ({ fen, flipped, marked });

/** Notes to play: one after the other, or all at once as a chord. MIDI numbers, 60 is the middle C. */
export interface ToneSpec {
  midi: number[];
  together: boolean;
}

export const tones = (midi: number[], together = false): ToneSpec => ({ midi, together });

export type ExerciseMedia =
  /** A word or sentence to hear; `language` is a BCP 47 tag like "es-ES". */
  | { kind: 'speech'; text: string; language: string }
  | { kind: 'board'; board: BoardSpec }
  | { kind: 'staff'; staff: StaffSpec }
  | { kind: 'tones'; tones: ToneSpec };
