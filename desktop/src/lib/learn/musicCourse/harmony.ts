// Scales, key signatures, the circle of fifths and triads, all spelled by letter distance.
// A port of Lernwerk/Services/Learn/Music/MusicHarmony.swift.

import { type Pitch, pitch } from '../music';
import { germanName, shifted } from './theory';

export type MusicScaleKind = 'major' | 'naturalMinor' | 'harmonicMinor';

/** Half steps between neighbouring degrees. */
export function scalePattern(kind: MusicScaleKind): number[] {
  switch (kind) {
    case 'major': return [2, 2, 1, 2, 2, 2, 1];
    case 'naturalMinor': return [2, 1, 2, 2, 1, 2, 2];
    case 'harmonicMinor': return [2, 1, 2, 2, 1, 3, 1];
  }
}

export function scaleSuffix(kind: MusicScaleKind): string {
  return kind === 'major' ? 'Dur' : 'Moll';
}

export interface MusicScale {
  tonic: Pitch;
  kind: MusicScaleKind;
}

export function scale(tonic: Pitch, kind: MusicScaleKind): MusicScale {
  return { tonic, kind };
}

/** The eight notes from the tonic to its octave. */
export function scaleNotes(s: MusicScale): Pitch[] {
  const result = [s.tonic];
  for (const step of scalePattern(s.kind)) result.push(shifted(result[result.length - 1], 1, step));
  return result;
}

export function scaleName(s: MusicScale): string {
  return `${germanName(s.tonic)}-${scaleSuffix(s.kind)}`;
}

/** The sharps (positive) or flats (negative) the scale needs; null when it needs signs of both kinds or more than seven. */
export function scaleAccidentalCount(s: MusicScale): number | null {
  const alterations = scaleNotes(s).slice(0, -1).map((p) => p.alteration);
  if (alterations.some((a) => Math.abs(a) > 1)) return null;
  const sharps = alterations.filter((a) => a > 0).length;
  const flats = alterations.filter((a) => a < 0).length;
  if (sharps > 0 && flats > 0) return null;
  return sharps > 0 ? sharps : 0 - flats;
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
    for (let i = 0; i < Math.abs(count); i++) {
      tonic = count > 0 ? shifted(tonic, 4, 7) : shifted(tonic, -4, -7);
    }
    return tonic;
  },

  /** The relative minor, a minor third below the major tonic. */
  minorTonic(count: number): Pitch {
    return shifted(MusicKey.majorTonic(count), -2, -3);
  },

  majorName(count: number): string {
    return germanName(MusicKey.majorTonic(count)) + '-Dur';
  },
  minorName(count: number): string {
    return germanName(MusicKey.minorTonic(count)) + '-Moll';
  },

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
export function triadThirds(q: MusicTriadQuality): [number, number] {
  switch (q) {
    case 'major': return [4, 3];
    case 'minor': return [3, 4];
    case 'diminished': return [3, 3];
    case 'augmented': return [4, 4];
  }
}

export function triadWord(q: MusicTriadQuality): string {
  switch (q) {
    case 'major': return 'Dur';
    case 'minor': return 'Moll';
    case 'diminished': return 'vermindert';
    case 'augmented': return 'übermäßig';
  }
}

export interface MusicTriad {
  root: Pitch;
  quality: MusicTriadQuality;
}

export function triad(root: Pitch, quality: MusicTriadQuality): MusicTriad {
  return { root, quality };
}

/** Root, third and fifth. */
export function triadNotes(t: MusicTriad): Pitch[] {
  const [a, b] = triadThirds(t.quality);
  const third = shifted(t.root, 2, a);
  const fifth = shifted(third, 2, b);
  return [t.root, third, fifth];
}

export function triadName(t: MusicTriad): string {
  return `${germanName(t.root)}-${triadWord(t.quality)}`;
}
