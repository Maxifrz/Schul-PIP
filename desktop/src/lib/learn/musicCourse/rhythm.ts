// Note values, rests, time signatures and the place of a pitch on the staff.
// A port of Lernwerk/Services/Learn/Music/MusicRhythm.swift.

import { type Clef, type NoteValue, type Pitch, pitch, pitchDiatonic } from '../music';
import { MusicMath } from './theory';

export const ORDERED_VALUES: NoteValue[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];

/** Length in sixteenth notes. */
export function sixteenths(v: NoteValue): number {
  switch (v) {
    case 'whole': return 16;
    case 'half': return 8;
    case 'quarter': return 4;
    case 'eighth': return 2;
    case 'sixteenth': return 1;
  }
}

export function noteName(v: NoteValue): string {
  switch (v) {
    case 'whole': return 'Ganze Note';
    case 'half': return 'Halbe Note';
    case 'quarter': return 'Viertelnote';
    case 'eighth': return 'Achtelnote';
    case 'sixteenth': return 'Sechzehntelnote';
  }
}

export function restName(v: NoteValue): string {
  switch (v) {
    case 'whole': return 'Ganze Pause';
    case 'half': return 'Halbe Pause';
    case 'quarter': return 'Viertelpause';
    case 'eighth': return 'Achtelpause';
    case 'sixteenth': return 'Sechzehntelpause';
  }
}

/** A time signature like 4/4: the upper number counts the beats, the lower one says which note is one beat. */
export interface MusicMeter {
  beats: number;
  unit: number;
}

export function meter(beats: number, unit: number): MusicMeter {
  return { beats, unit };
}

/** Swift: `MusicMeter("4/4")`; null for anything else. */
export function parseMeter(text: string): MusicMeter | null {
  const parts = text.split('/').filter((s) => /^[+-]?\d+$/.test(s)).map((s) => parseInt(s, 10));
  if (parts.length !== 2 || parts[0] <= 0 || ![1, 2, 4, 8, 16].includes(parts[1])) return null;
  return { beats: parts[0], unit: parts[1] };
}

export function meterText(m: MusicMeter): string {
  return `${m.beats}/${m.unit}`;
}

/** Length of one bar in sixteenth notes: 16 for 4/4, 12 for 3/4 and 6/8. */
export function barSixteenths(m: MusicMeter): number {
  return Math.trunc((m.beats * 16) / m.unit);
}

/** Length of the counting unit in sixteenths (4 for a quarter beat). */
export function unitSixteenths(m: MusicMeter): number {
  return Math.trunc(16 / m.unit);
}

/** How many counting units a note lasts, as (numerator, denominator): an eighth in 4/4 is (1, 2). */
export function beatsOf(m: MusicMeter, value: NoteValue): [number, number] {
  const a = sixteenths(value);
  const b = unitSixteenths(m);
  let x = a;
  let y = b;
  while (y !== 0) [x, y] = [y, x % y];
  return [a / x, b / x];
}

/** Whether the notes (rests included) exactly fill one bar. */
export function isFull(m: MusicMeter, values: NoteValue[]): boolean {
  return values.reduce((sum, v) => sum + sixteenths(v), 0) === barSixteenths(m);
}

/** Where a pitch sits on a five-line staff, counted in half spaces from the bottom line.
 * 0 is the bottom line, 1 the first space, 8 the top line, 10 the first ledger line above, -2 the first below. */
export interface StaffPosition {
  step: number;
}

export function staffPositionIsLine(p: StaffPosition): boolean {
  return MusicMath.floorMod(p.step, 2) === 0;
}

export function staffPositionOnStaff(p: StaffPosition): boolean {
  return p.step >= 0 && p.step <= 8;
}

/** Number of ledger lines the note needs. */
export function ledgerLines(p: StaffPosition): number {
  if (p.step <= -1) return Math.trunc(-p.step / 2);
  if (p.step >= 9) return Math.trunc((p.step - 8) / 2);
  return 0;
}

/** 1 to 5 from the bottom for a note on a line, 1 to 4 for a space; null outside the staff. */
export function staffPositionIndex(p: StaffPosition): number | null {
  if (!staffPositionOnStaff(p)) return null;
  return staffPositionIsLine(p) ? Math.trunc(p.step / 2) + 1 : Math.trunc((p.step + 1) / 2);
}

/** A German description for the positions around the staff, null further away. */
export function staffPositionDescription(p: StaffPosition): string | null {
  const step = p.step;
  switch (step) {
    case 0: case 2: case 4: case 6: case 8: return `${Math.trunc(step / 2) + 1}. Linie`;
    case 1: case 3: case 5: case 7: return `${Math.trunc((step + 1) / 2)}. Zwischenraum`;
    case -1: return 'unter der 1. Linie';
    case -2: return '1. Hilfslinie unten';
    case 9: return 'über der 5. Linie';
    case 10: return '1. Hilfslinie oben';
    default: return null;
  }
}

/** The pitch (as diatonic number) of the bottom line: E4 in the treble clef, G2 in the bass clef. */
export function bottomLineDiatonic(clef: Clef): number {
  switch (clef) {
    case 'treble': return 4 * 7 + 2;
    case 'bass': return 2 * 7 + 4;
    case 'alto': return 3 * 7 + 3;
  }
}

export function staffPosition(p: Pitch, clef: Clef): StaffPosition {
  return { step: pitchDiatonic(p) - bottomLineDiatonic(clef) };
}

/** The natural pitch that sits at this staff position in the clef. */
export function atStep(step: number, clef: Clef): Pitch {
  const number = bottomLineDiatonic(clef) + step;
  return pitch(MusicMath.floorMod(number, 7), MusicMath.floorDiv(number, 7));
}
