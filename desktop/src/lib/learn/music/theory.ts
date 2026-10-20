import { Clef, NoteValue, Pitch, diatonic, midiOf, pitch } from '../media';

// Music theory: German note names, spelling by letter distance, MIDI numbers and intervals. Everything the music course teaches is computed here, so the exercises cannot teach a wrongly spelled note.

export const floorDiv = (a: number, b: number): number => Math.floor(a / b);
export const floorMod = (a: number, b: number): number => ((a % b) + b) % b;

export const naturalSemitones = [0, 2, 4, 5, 7, 9, 11];
export const letterNames = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];

export const samePitch = (a: Pitch, b: Pitch): boolean => a.letter === b.letter && a.octave === b.octave && a.alteration === b.alteration;

/** 0 = C ... 11 = H, whatever the spelling. */
export const pitchClass = (p: Pitch): number => floorMod(midiOf(p), 12);

/** The German name without the octave: C, Cis, Des, Es, B (for H flat), H, His, Asas ... */
export function germanName(p: Pitch): string {
  const base = letterNames[floorMod(p.letter, 7)];
  const n = p.alteration;
  if (n === 0) return base;
  if (n > 0) return base + 'is'.repeat(n);
  if (n === -1) return base === 'H' ? 'B' : base === 'E' ? 'Es' : base === 'A' ? 'As' : `${base}es`;
  if (n === -2) return base === 'H' ? 'Heses' : base === 'E' ? 'Eses' : base === 'A' ? 'Asas' : `${base}eses`;
  return base + 'es'.repeat(-n);
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
export const scientificName = (p: Pitch): string => germanName(p) + String(p.octave);

/** The pitch `letterSteps` letters and `semitones` half steps away. Because the letters are counted, the result is spelled correctly: a third above D with 4 semitones is F sharp, never G flat. */
export function shifted(p: Pitch, letterSteps: number, semitones: number): Pitch {
  const number = diatonic(p) + letterSteps;
  const octave = floorDiv(number, 7);
  const letter = floorMod(number, 7);
  const target = midiOf(p) + semitones;
  const natural = 12 * (octave + 1) + naturalSemitones[letter];
  return pitch(letter, octave, target - natural);
}

/** A pitch for a MIDI number, spelled with sharps or with flats. */
export function spelled(midi: number, preferFlats = false): Pitch {
  const octave = floorDiv(midi, 12) - 1;
  const pc = floorMod(midi, 12);
  const sharps: Array<[number, number]> = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
  const flats: Array<[number, number]> = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  const [letter, alteration] = (preferFlats ? flats : sharps)[pc];
  return pitch(letter, octave, alteration);
}

/** Both notes sound the same, whatever their names. */
export const isEnharmonic = (a: Pitch, b: Pitch): boolean => midiOf(a) === midiOf(b);

export const MusicNames = {
  /** The pitch class (letter and alteration) a German note name stands for, "cis" and "Cis" alike; null if it is no name. */
  parse(text: string): { letter: number; alteration: number } | null {
    const wanted = text.trim().toLowerCase();
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
  keys(pc: number, low = 21, high = 108): number[] {
    const result: number[] = [];
    for (let m = low; m <= high; m++) if (floorMod(m, 12) === pc) result.push(m);
    return result;
  },

  isBlackKey: (midi: number): boolean => [1, 3, 6, 8, 10].includes(floorMod(midi, 12)),
};

export type IntervalQuality = 'perfect' | 'major' | 'minor' | 'augmented' | 'diminished';

const majorSemitones = [0, 2, 4, 5, 7, 9, 11, 12];
const isPerfectKind = [true, false, false, true, true, false, false, true];
export const intervalSizeNames = ['Prim', 'Sekunde', 'Terz', 'Quarte', 'Quinte', 'Sexte', 'Septime', 'Oktave'];

/** An interval counted upward: the letter distance and the half steps decide its name. */
export class MusicInterval {
  /** @param steps Letter distance: 0 is the Prim, 7 the Oktave. */
  constructor(readonly steps: number, readonly semitones: number) {}

  /** The interval from `lower` up to `upper`. */
  static between(lower: Pitch, upper: Pitch): MusicInterval {
    return new MusicInterval(diatonic(upper) - diatonic(lower), midiOf(upper) - midiOf(lower));
  }

  /** The intervals a school course names, by letter distance and half steps. */
  static readonly standard: MusicInterval[] = [
    [0, 0], [1, 1], [1, 2], [2, 3], [2, 4], [3, 5], [4, 7], [5, 8], [5, 9], [6, 10], [6, 11], [7, 12],
  ].map(([a, b]) => new MusicInterval(a, b));

  equals(other: MusicInterval): boolean { return this.steps === other.steps && this.semitones === other.semitones; }

  /** The number as counted by students: 1 for the Prim ... 8 for the Oktave. */
  get number(): number { return this.steps + 1; }

  get quality(): IntervalQuality | null {
    if (this.steps < 0 || this.steps > 7) return null;
    const diff = this.semitones - majorSemitones[this.steps];
    if (isPerfectKind[this.steps]) return diff === 0 ? 'perfect' : diff === 1 ? 'augmented' : diff === -1 ? 'diminished' : null;
    return diff === 0 ? 'major' : diff === -1 ? 'minor' : diff === 1 ? 'augmented' : diff === -2 ? 'diminished' : null;
  }

  get sizeName(): string { return this.steps >= 0 && this.steps <= 7 ? intervalSizeNames[this.steps] : ''; }

  /** "reine Quinte", "kleine Terz", "übermäßige Quarte" ... null for what school music does not name. */
  get name(): string | null {
    const q = this.quality;
    if (q === null) return null;
    const word = { perfect: 'reine', major: 'große', minor: 'kleine', augmented: 'übermäßige', diminished: 'verminderte' }[q];
    return `${word} ${this.sizeName}`;
  }

  /** The same interval turned upside down: a major third becomes a minor sixth. */
  get inverted(): MusicInterval { return new MusicInterval(7 - this.steps, 12 - this.semitones); }

  get isTritone(): boolean { return this.semitones === 6 && (this.steps === 3 || this.steps === 4); }

  /** The upper note when this interval is built above `p`. */
  above(p: Pitch): Pitch { return shifted(p, this.steps, this.semitones); }

  /** The lower note when this interval is built below `p`. */
  below(p: Pitch): Pitch { return shifted(p, -this.steps, -this.semitones); }
}

// Scales, key signatures, the circle of fifths and triads, all spelled by letter distance.

export type MusicScaleKind = 'major' | 'naturalMinor' | 'harmonicMinor';

/** Half steps between neighbouring degrees. */
export const scalePattern = (kind: MusicScaleKind): number[] => ({
  major: [2, 2, 1, 2, 2, 2, 1],
  naturalMinor: [2, 1, 2, 2, 1, 2, 2],
  harmonicMinor: [2, 1, 2, 2, 1, 3, 1],
})[kind];

export const scaleSuffix = (kind: MusicScaleKind): string => (kind === 'major' ? 'Dur' : 'Moll');

export class MusicScale {
  constructor(readonly tonic: Pitch, readonly kind: MusicScaleKind) {}

  /** The eight notes from the tonic to its octave. */
  get notes(): Pitch[] {
    const result = [this.tonic];
    for (const step of scalePattern(this.kind)) result.push(shifted(result[result.length - 1], 1, step));
    return result;
  }

  get name(): string { return `${germanName(this.tonic)}-${scaleSuffix(this.kind)}`; }

  /** The sharps (positive) or flats (negative) the scale needs; null when it needs signs of both kinds or more than seven. */
  get accidentalCount(): number | null {
    const alterations = this.notes.slice(0, -1).map((p) => p.alteration);
    if (alterations.some((a) => Math.abs(a) > 1)) return null;
    const sharps = alterations.filter((a) => a > 0).length;
    const flats = alterations.filter((a) => a < 0).length;
    if (sharps > 0 && flats > 0) return null;
    return sharps > 0 ? sharps : 0 - flats + 0;
  }
}

/** Key signatures: +n is n sharps, -n is n flats. */
export const MusicKey = {
  /** Letters of the sharps in the order they are written: F C G D A E H. */
  sharpLetters: [3, 0, 4, 1, 5, 2, 6],
  /** Letters of the flats: H E A D G C F, the sharps reversed. */
  flatLetters: [6, 2, 5, 1, 4, 0, 3],

  /** The signs of a key signature in writing order, as pitches in the fourth octave. */
  accidentals(count: number): Pitch[] {
    const n = Math.min(7, Math.abs(count));
    if (count > 0) return MusicKey.sharpLetters.slice(0, n).map((l) => pitch(l, 4, 1));
    return MusicKey.flatLetters.slice(0, n).map((l) => pitch(l, 4, -1));
  },

  /** The major key with this signature: each fifth up from C adds a sharp, each fifth down a flat. */
  majorTonic(count: number): Pitch {
    let tonic = pitch(0, 4);
    for (let i = 0; i < Math.abs(count); i++) tonic = count > 0 ? shifted(tonic, 4, 7) : shifted(tonic, -4, -7);
    return tonic;
  },

  /** The relative minor, a minor third below the major tonic. */
  minorTonic: (count: number): Pitch => shifted(MusicKey.majorTonic(count), -2, -3),

  majorName: (count: number): string => `${germanName(MusicKey.majorTonic(count))}-Dur`,
  minorName: (count: number): string => `${germanName(MusicKey.minorTonic(count))}-Moll`,

  /** The signature of the major key on this tonic, or null beyond seven signs. */
  countOfMajorTonic(tonic: Pitch): number | null {
    for (let c = -7; c <= 7; c++) {
      const t = MusicKey.majorTonic(c);
      if (t.letter === tonic.letter && t.alteration === tonic.alteration) return c;
    }
    return null;
  },

  /** The signature of the minor key on this tonic. */
  countOfMinorTonic(tonic: Pitch): number | null {
    for (let c = -7; c <= 7; c++) {
      const t = MusicKey.minorTonic(c);
      if (t.letter === tonic.letter && t.alteration === tonic.alteration) return c;
    }
    return null;
  },

  /** The alteration a key signature gives a letter. */
  alteration(letter: number, count: number): number {
    const n = Math.min(7, Math.abs(count));
    if (count > 0) return MusicKey.sharpLetters.slice(0, n).includes(letter) ? 1 : 0;
    if (count < 0) return MusicKey.flatLetters.slice(0, n).includes(letter) ? -1 : 0;
    return 0;
  },
};

export type MusicTriadQuality = 'major' | 'minor' | 'diminished' | 'augmented';

/** Half steps from the root to the third and from the third to the fifth. */
export const triadThirds = (q: MusicTriadQuality): [number, number] => ({ major: [4, 3], minor: [3, 4], diminished: [3, 3], augmented: [4, 4] } as const)[q] as [number, number];
export const triadWord = (q: MusicTriadQuality): string => ({ major: 'Dur', minor: 'Moll', diminished: 'vermindert', augmented: 'übermäßig' })[q];

export class MusicTriad {
  constructor(readonly root: Pitch, readonly quality: MusicTriadQuality) {}

  /** Root, third and fifth. */
  get notes(): Pitch[] {
    const [a, b] = triadThirds(this.quality);
    const third = shifted(this.root, 2, a);
    const fifth = shifted(third, 2, b);
    return [this.root, third, fifth];
  }

  get name(): string { return `${germanName(this.root)}-${triadWord(this.quality)}`; }
}

// Note values, rests, time signatures and the place of a pitch on the staff.

export const noteValuesOrdered: NoteValue[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];

/** Length in sixteenth notes. */
export const sixteenths = (v: NoteValue): number => ({ whole: 16, half: 8, quarter: 4, eighth: 2, sixteenth: 1 })[v];

export const noteName = (v: NoteValue): string => ({ whole: 'Ganze Note', half: 'Halbe Note', quarter: 'Viertelnote', eighth: 'Achtelnote', sixteenth: 'Sechzehntelnote' })[v];
export const restName = (v: NoteValue): string => ({ whole: 'Ganze Pause', half: 'Halbe Pause', quarter: 'Viertelpause', eighth: 'Achtelpause', sixteenth: 'Sechzehntelpause' })[v];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A time signature like 4/4: the upper number counts the beats, the lower one says which note is one beat. */
export class MusicMeter {
  constructor(readonly beats: number, readonly unit: number) {}

  static parse(text: string): MusicMeter | null {
    const parts = text.split('/').map((p) => Number.parseInt(p, 10)).filter((n) => !Number.isNaN(n));
    if (parts.length !== 2 || parts[0] <= 0 || ![1, 2, 4, 8, 16].includes(parts[1])) return null;
    return new MusicMeter(parts[0], parts[1]);
  }

  get text(): string { return `${this.beats}/${this.unit}`; }

  /** Length of one bar in sixteenth notes: 16 for 4/4, 12 for 3/4 and 6/8. */
  get barSixteenths(): number { return Math.floor((this.beats * 16) / this.unit); }

  /** Length of the counting unit in sixteenths (4 for a quarter beat). */
  get unitSixteenths(): number { return 16 / this.unit; }

  /** How many counting units a note lasts, as [numerator, denominator]: an eighth in 4/4 is [1, 2]. */
  beatsOf(value: NoteValue): [number, number] {
    const a = sixteenths(value);
    const b = this.unitSixteenths;
    const g = gcd(a, b);
    return [a / g, b / g];
  }

  /** Whether the notes (rests included) exactly fill one bar. */
  isFull(values: NoteValue[]): boolean { return values.reduce((s, v) => s + sixteenths(v), 0) === this.barSixteenths; }
}

/** Where a pitch sits on a five-line staff, counted in half spaces from the bottom line: 0 is the bottom line, 1 the first space, 8 the top line, 10 the first ledger line above, -2 the first below. */
export class StaffPosition {
  constructor(readonly step: number) {}

  get isLine(): boolean { return floorMod(this.step, 2) === 0; }
  get onStaff(): boolean { return this.step >= 0 && this.step <= 8; }

  /** Number of ledger lines the note needs. */
  get ledgerLines(): number {
    if (this.step <= -1) return Math.trunc(-this.step / 2);
    if (this.step >= 9) return Math.trunc((this.step - 8) / 2);
    return 0;
  }

  /** 1 to 5 from the bottom for a note on a line, 1 to 4 for a space; null outside the staff. */
  get index(): number | null {
    if (!this.onStaff) return null;
    return this.isLine ? this.step / 2 + 1 : (this.step + 1) / 2;
  }

  /** A German description for the positions around the staff, null further away. */
  get description(): string | null {
    switch (this.step) {
      case 0: case 2: case 4: case 6: case 8: return `${this.step / 2 + 1}. Linie`;
      case 1: case 3: case 5: case 7: return `${(this.step + 1) / 2}. Zwischenraum`;
      case -1: return 'unter der 1. Linie';
      case -2: return '1. Hilfslinie unten';
      case 9: return 'über der 5. Linie';
      case 10: return '1. Hilfslinie oben';
      default: return null;
    }
  }
}

/** The pitch (as diatonic number) of the bottom line: E4 in the treble clef, G2 in the bass clef. */
export const bottomLineDiatonic = (clef: Clef): number => (clef === 'treble' ? 4 * 7 + 2 : clef === 'bass' ? 2 * 7 + 4 : 3 * 7 + 3);

export const staffPosition = (p: Pitch, clef: Clef): StaffPosition => new StaffPosition(diatonic(p) - bottomLineDiatonic(clef));

/** The natural pitch that sits at this staff position in the clef. */
export function pitchAtStep(step: number, clef: Clef): Pitch {
  const number = bottomLineDiatonic(clef) + step;
  return pitch(floorMod(number, 7), floorDiv(number, 7));
}
