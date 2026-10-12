// The arithmetic behind the chess board, the staff, the keyboard and the tones of the Lernen area. Plain TypeScript, no
// React and no clock, so the tests can check it without a screen; the components only draw what these return.
// A port of Lernwerk/Views/Review/Learn/Media/MediaRules.swift, the layout of StaffView.swift and ToneSynth.swift.

import type { Clef, NoteValue, Pitch, StaffNote, StaffSpec } from '../../lib/learn/music';
import { pitchDiatonic } from '../../lib/learn/music';
import type { ToneSpec } from '../../lib/learn/media';
import { type MusicGlyphName, glyphData } from './glyphData';

// Chess

/** The pieces of a position, read from the first field of a FEN. Rank 8 first; null is an empty square. */
export function boardPlacement(fen: string): Array<Array<string | null>> {
  const field = fen.split(' ').filter((p) => p !== '')[0] ?? fen;
  const rows: Array<Array<string | null>> = [];
  for (const part of field.split('/').filter((p) => p !== '')) {
    const row: Array<string | null> = [];
    for (const character of part) {
      const empty = /^[1-9]$/.test(character) ? Number(character) : 0;
      if (empty > 0) for (let i = 0; i < empty; i++) row.push(null);
      else row.push(character);
    }
    const eight = row.slice(0, 8);
    while (eight.length < 8) eight.push(null);
    rows.push(eight);
  }
  while (rows.length < 8) rows.push(new Array<string | null>(8).fill(null));
  return rows.slice(0, 8);
}

/** File 0 to 7 (a to h) and rank 1 to 8 of a square name like "e4"; null for anything else. */
export function squareCoordinates(square: string): { file: number; rank: number } | null {
  if (square.length !== 2) return null;
  const file = 'abcdefgh'.indexOf(square[0]);
  const rank = Number(square[1]);
  if (file < 0 || !Number.isInteger(rank) || rank < 1 || rank > 8) return null;
  return { file, rank };
}

export function squareName(file: number, rank: number): string {
  return 'abcdefgh'[file] + String(rank);
}

/** The piece on a square, as a FEN letter (uppercase is White). */
export function pieceOn(board: Array<Array<string | null>>, square: string): string | null {
  const c = squareCoordinates(square);
  return c ? board[8 - c.rank][c.file] : null;
}

/** The square at a place of the screen (row 0 is the top), with White at the bottom unless the board is flipped. */
export function squareAt(row: number, column: number, flipped: boolean): string {
  const rank = flipped ? row + 1 : 8 - row;
  const file = flipped ? 7 - column : column;
  return squareName(file, rank);
}

export function isDarkSquare(row: number, column: number): boolean {
  return (row + column) % 2 === 1;
}

/** "Weiß" or "Schwarz", from the second field of the FEN; null when it is missing. */
export function sideToMove(fen: string): string | null {
  const fields = fen.split(' ').filter((p) => p !== '');
  if (fields.length < 2) return null;
  return fields[1] === 'b' ? 'Schwarz' : fields[1] === 'w' ? 'Weiß' : null;
}

/** German name of a piece for a screen reader: "weißer Springer". */
export function germanPieceName(piece: string): string {
  const kind = piece.toLowerCase();
  const names: Record<string, string> = { k: 'König', q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer', p: 'Bauer' };
  const color = piece === piece.toUpperCase() ? 'weiß' : 'schwarz';
  // Dame is feminine: "weiße Dame", but "weißer Turm".
  return `${color}${kind === 'q' ? 'e' : 'er'} ${names[kind] ?? 'Figur'}`;
}

export type SquareMark = 'verdict-right' | 'verdict-wrong' | 'solution' | 'pick' | null;

/** How a square is tinted: the squares of the move after the verdict (green or red), the right move after a wrong
 * answer, and the picked squares before the check. */
export function squareMark(square: string, from: string | null, to: string | null, correctMoves: readonly string[], verdict: 'right' | 'wrong' | null): SquareMark {
  const picked = square === from || square === to;
  if (verdict && picked) return verdict === 'right' ? 'verdict-right' : 'verdict-wrong';
  if (verdict === 'wrong' && correctMoves.some((m) => m.startsWith(square) || m.slice(2).startsWith(square))) return 'solution';
  if (picked) return 'pick';
  return null;
}

/** The hint under the board while a move is being found. */
export function moveHint(from: string | null, to: string | null, verdict: 'right' | 'wrong' | null): string {
  if (verdict) return '';
  if (from === null) return 'Tippe auf die Figur, die ziehen soll.';
  if (to === null) return 'Tippe auf das Zielfeld.';
  return 'Tippe auf „Prüfen“, wenn du sicher bist.';
}

// Piano

export const PianoLayout = {
  isBlack(midi: number): boolean {
    return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
  },

  whiteKeys(low: number, high: number): number[] {
    const keys: number[] = [];
    for (let m = low; m <= high; m++) if (!PianoLayout.isBlack(m)) keys.push(m);
    return keys;
  },

  /** The keys shown for an exercise: from the C below the lowest right key to the C above the highest, at least two
   * octaves, within the piano. */
  range(correct: readonly number[]): { low: number; high: number } {
    if (correct.length === 0) return { low: 60, high: 84 };
    const low = Math.min(...correct);
    const high = Math.max(...correct);
    let start = Math.floor(low / 12) * 12;
    let end = Math.floor((high + 11) / 12) * 12;
    if (end <= high) end += 12;
    if (end - start < 24) end = start + 24;
    start = Math.max(12, start);
    end = Math.min(108, Math.max(end, start + 12));
    return { low: start, high: end };
  },

  /** Where a black key's center lies, in white-key widths from the left edge of the range: between its two
   * neighbouring white keys, a little off center for the groups of three. */
  blackKeyCenter(midi: number, low: number): number {
    const whitesBefore = PianoLayout.whiteKeys(low, midi).length;
    const offsets: Record<number, number> = { 1: -0.06, 3: 0.06, 6: -0.08, 10: 0.08 };
    return whitesBefore + (offsets[((midi % 12) + 12) % 12] ?? 0);
  },

  /** The note's name for a screen reader: "C4", "F♯3". */
  name(midi: number): string {
    const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'];
    return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  },
};

// Staff

export type Accidental = 'sharp' | 'flat' | 'natural' | 'doubleSharp' | 'doubleFlat';

export const StaffRules = {
  /** The diatonic number (octave * 7 + letter) of the bottom line: E4 in the treble clef, G2 in the bass clef, F3 in
   * the alto clef. */
  bottomLine(clef: Clef): number {
    return clef === 'treble' ? 4 * 7 + 2 : clef === 'bass' ? 2 * 7 + 4 : 3 * 7 + 3;
  },

  /** Half staff spaces above the bottom line: 0 is the bottom line, 1 the first space, 8 the top line. */
  step(pitch: Pitch, clef: Clef): number {
    return pitchDiatonic(pitch) - StaffRules.bottomLine(clef);
  },

  /** The even steps with a ledger line for a note on `step`: below the staff -2, -4, ... or above it 10, 12, ... */
  ledgerSteps(step: number): number[] {
    const steps: number[] = [];
    if (step <= -2) for (let s = -2; s >= step; s -= 2) steps.push(s);
    else if (step >= 10) for (let s = 10; s <= step; s += 2) steps.push(s);
    return steps;
  },

  sharpLetters: [3, 0, 4, 1, 5, 2, 6],
  flatLetters: [6, 2, 5, 1, 4, 0, 3],

  /** Where the signs of a key signature sit: the step of each, in the order they are drawn. */
  keySignature(count: number, clef: Clef): Array<{ step: number; sharp: boolean }> {
    const n = Math.min(7, Math.abs(count));
    if (n === 0) return [];
    const sharpSteps = [8, 5, 9, 6, 3, 7, 4];
    const flatSteps = [4, 7, 3, 6, 2, 5, 1];
    const shift = clef === 'treble' ? 0 : clef === 'bass' ? -2 : -1;
    const steps = count > 0 ? sharpSteps : flatSteps;
    return Array.from({ length: n }, (_, i) => ({ step: steps[i] + shift, sharp: count > 0 }));
  },

  /** The alteration the key signature gives a letter: +1, -1 or 0. */
  keyAlteration(letter: number, key: number): number {
    const n = Math.min(7, Math.abs(key));
    if (n === 0) return 0;
    const letters = key > 0 ? StaffRules.sharpLetters : StaffRules.flatLetters;
    return letters.slice(0, n).includes(letter) ? (key > 0 ? 1 : -1) : 0;
  },

  /** The sign written before a note: none when the key signature already gives its alteration. */
  accidental(pitch: Pitch, key: number): Accidental | null {
    if (pitch.alteration === StaffRules.keyAlteration(pitch.letter, key)) return null;
    switch (pitch.alteration) {
      case 1:
        return 'sharp';
      case -1:
        return 'flat';
      case 2:
        return 'doubleSharp';
      case -2:
        return 'doubleFlat';
      default:
        return 'natural';
    }
  },

  /** Stems go up for notes below the middle line and down from it (a chord follows its middle). */
  stemUp(steps: readonly number[]): boolean {
    if (steps.length === 0) return true;
    return (Math.min(...steps) + Math.max(...steps)) / 2 < 4;
  },

  /** Chord notes a second apart cannot share a side of the stem; the upper one goes to the other side. One flag per
   * note, in the order given: true for the note that is moved. */
  shifted(steps: readonly number[]): boolean[] {
    const order = steps.map((step, index) => ({ step, index })).sort((a, b) => a.step - b.step || a.index - b.index);
    const result = new Array<boolean>(steps.length).fill(false);
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
  },

  /** Flags a stem gets: one for an eighth, two for a sixteenth. */
  flags(value: NoteValue): number {
    return value === 'eighth' ? 1 : value === 'sixteenth' ? 2 : 0;
  },
};

/** The width in staff spaces of a clef or rest glyph, for placing what follows. */
export const glyphWidth: Record<MusicGlyphName, number> = { gClef: 2.6, fClef: 3.0, cClef: 2.8, quarterRest: 1.1, eighthRest: 1.2, sixteenthRest: 1.5 };

const UNITS_PER_SPACE = 250;

/** The SVG path of a glyph outline with its origin (the bottom staff line, at the glyph's left) at (ox, oy). */
export function glyphPath(name: MusicGlyphName, ox: number, oy: number, space: number): string {
  const scale = space / UNITS_PER_SPACE;
  const values = glyphData[name];
  const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
  const px = (x: number) => fmt(ox + x * scale);
  const py = (y: number) => fmt(oy - y * scale);
  const parts: string[] = [];
  let i = 0;
  while (i < values.length) {
    const code = values[i];
    if (code === 0) {
      parts.push(`M${px(values[i + 1])} ${py(values[i + 2])}`);
      i += 3;
    } else if (code === 1) {
      parts.push(`L${px(values[i + 1])} ${py(values[i + 2])}`);
      i += 3;
    } else if (code === 2) {
      parts.push(`Q${px(values[i + 1])} ${py(values[i + 2])} ${px(values[i + 3])} ${py(values[i + 4])}`);
      i += 5;
    } else {
      parts.push('Z');
      i += 1;
    }
  }
  return parts.join('');
}

export type StaffPrimitive =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; cap?: 'round' }
  | { kind: 'fill'; d: string }
  | { kind: 'stroke'; d: string; width: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate: number; mode: 'fill' | 'stroke'; width: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'text'; x: number; y: number; size: number; text: string };

export interface StaffLayout {
  width: number;
  height: number;
  /** The distance between two staff lines. */
  space: number;
  primitives: StaffPrimitive[];
}

/** The largest distance between two staff lines; narrower staves shrink to fit. */
export const STAFF_MAX_SPACE = 12;
export const STAFF_HEIGHT = STAFF_MAX_SPACE * 13;

function clefGlyph(clef: Clef): MusicGlyphName {
  return clef === 'treble' ? 'gClef' : clef === 'bass' ? 'fClef' : 'cClef';
}

/** The distance between two staff lines: as large as fits. */
export function staffSpace(spec: StaffSpec, width: number): number {
  const slots = spec.chord ? 1 : spec.notes.length;
  const signs = Math.min(7, Math.abs(spec.keySignature));
  const time = spec.time === null ? 0 : 2.4;
  const leading = 0.6 + glyphWidth[clefGlyph(spec.clef)] + signs + time + 1.2;
  const needed = leading + Math.max(1, slots) * 3.4 + 1;
  return Math.min(STAFF_MAX_SPACE, width / needed);
}

function accidentalPrimitives(kind: Accidental, x: number, y: number, s: number): StaffPrimitive[] {
  const line = (x1: number, y1: number, x2: number, y2: number, w: number): StaffPrimitive => ({ kind: 'line', x1: x + x1 * s, y1: y + y1 * s, x2: x + x2 * s, y2: y + y2 * s, width: w * s });
  const sharp = (dx: number): StaffPrimitive[] => [
    line(dx - 0.22, -1.5, dx - 0.22, 1.3, 0.1),
    line(dx + 0.22, -1.3, dx + 0.22, 1.5, 0.1),
    line(dx - 0.5, -0.1, dx + 0.5, -0.45, 0.26),
    line(dx - 0.5, 0.55, dx + 0.5, 0.2, 0.26),
  ];
  const flat = (dx: number): StaffPrimitive[] => [
    line(dx - 0.3, -1.9, dx - 0.3, 0.6, 0.1),
    {
      kind: 'stroke',
      d: `M${r(x + (dx - 0.3) * s)} ${r(y + 0.6 * s)}C${r(x + (dx + 0.1) * s)} ${r(y + 0.45 * s)} ${r(x + (dx + 0.65) * s)} ${r(y + 0.05 * s)} ${r(x + (dx + 0.55) * s)} ${r(y - 0.35 * s)}C${r(x + (dx + 0.45) * s)} ${r(y - 0.75 * s)} ${r(x + dx * s)} ${r(y - 0.65 * s)} ${r(x + (dx - 0.3) * s)} ${r(y - 0.2 * s)}`,
      width: 0.17 * s,
    },
  ];
  switch (kind) {
    case 'sharp':
      return sharp(0);
    case 'flat':
      return flat(-0.1);
    case 'natural':
      return [
        line(-0.28, -1.4, -0.28, 0.7, 0.1),
        line(0.28, -0.7, 0.28, 1.4, 0.1),
        line(-0.28, -0.25, 0.28, -0.45, 0.24),
        line(-0.28, 0.45, 0.28, 0.25, 0.24),
      ];
    case 'doubleSharp':
      return [line(-0.5, -0.5, 0.5, 0.5, 0.3), line(0.5, -0.5, -0.5, 0.5, 0.3)];
    case 'doubleFlat':
      return [...flat(-0.45), ...flat(0.25)];
  }
}

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Everything a staff draws, as primitives in a box of the given width: lines, glyph outlines, note heads, stems,
 * flags, signs and the time signature. */
export function layoutStaff(spec: StaffSpec, width: number): StaffLayout {
  const height = STAFF_HEIGHT;
  const s = staffSpace(spec, width);
  const bottom = height / 2 + 2 * s;
  const y = (step: number) => bottom - (step * s) / 2;
  const out: StaffPrimitive[] = [];

  for (let line = 0; line < 5; line++) {
    out.push({ kind: 'line', x1: 0, y1: y(line * 2), x2: width, y2: y(line * 2), width: Math.max(1, s * 0.09) });
  }
  out.push({ kind: 'line', x1: width - 1, y1: y(0), x2: width - 1, y2: y(8), width: Math.max(1.5, s * 0.16) });

  let x = 0.6 * s;
  const clef = clefGlyph(spec.clef);
  out.push({ kind: 'fill', d: glyphPath(clef, x, bottom, s) });
  x += glyphWidth[clef] * s;

  for (const sign of StaffRules.keySignature(spec.keySignature, spec.clef)) {
    out.push(...placedAccidental(sign.sharp ? 'sharp' : 'flat', x + s * 0.4, y(sign.step), s));
    x += s;
  }
  if (spec.time !== null) {
    const parts = spec.time.split('/');
    if (parts.length === 2) {
      parts.forEach((part, index) => out.push({ kind: 'text', x: x + s * 0.8, y: y(index === 0 ? 6 : 2), size: s * 2.5, text: part }));
    }
    x += 2.4 * s;
  }
  x += 1.2 * s;

  const slotCount = spec.chord ? 1 : spec.notes.length;
  const slots = Math.max(1, slotCount);
  const slotWidth = Math.min(6 * s, Math.max(3.4 * s, (width - x - s) / slots));
  for (let slot = 0; slot < slotCount; slot++) {
    const notes = spec.chord ? spec.notes : [spec.notes[slot]];
    out.push(...slotPrimitives(spec, notes, x + slotWidth * (slot + 0.5), s, bottom, y));
  }
  return { width, height, space: s, primitives: out };
}

function placedAccidental(kind: Accidental, x: number, y: number, s: number): StaffPrimitive[] {
  // The flats sit a little higher than the line they belong to.
  const lift = kind === 'flat' || kind === 'doubleFlat' ? 0.4 * s : 0;
  return accidentalPrimitives(kind, x, y - lift, s);
}

function slotPrimitives(spec: StaffSpec, notes: StaffNote[], x: number, s: number, bottom: number, y: (step: number) => number): StaffPrimitive[] {
  const first = notes[0];
  if (!first) return [];
  const out: StaffPrimitive[] = [];
  if (first.isRest) {
    switch (first.value) {
      case 'whole':
        out.push({ kind: 'rect', x: x - 0.65 * s, y: y(6), width: 1.3 * s, height: 0.5 * s });
        break;
      case 'half':
        out.push({ kind: 'rect', x: x - 0.65 * s, y: y(4) - 0.5 * s, width: 1.3 * s, height: 0.5 * s });
        break;
      case 'quarter':
        out.push({ kind: 'fill', d: glyphPath('quarterRest', x - 0.45 * s, bottom, s) });
        break;
      case 'eighth':
        out.push({ kind: 'fill', d: glyphPath('eighthRest', x - 0.45 * s, bottom, s) });
        break;
      case 'sixteenth':
        out.push({ kind: 'fill', d: glyphPath('sixteenthRest', x - 0.6 * s, bottom, s) });
        break;
    }
    return out;
  }
  const steps = notes.map((n) => StaffRules.step(n.pitch, spec.clef));
  const up = StaffRules.stemUp(steps);
  const moved = StaffRules.shifted(steps);
  const value = first.value;

  notes.forEach((note, index) => {
    const step = steps[index];
    const headX = x + (moved[index] ? (up ? 1.15 * s : -1.15 * s) : 0);
    for (const ledger of StaffRules.ledgerSteps(step)) {
      out.push({ kind: 'line', x1: headX - s, y1: y(ledger), x2: headX + s, y2: y(ledger), width: Math.max(1, s * 0.12) });
    }
    const accidental = StaffRules.accidental(note.pitch, spec.keySignature);
    if (accidental) out.push(...placedAccidental(accidental, x - 1.5 * s, y(step), s));
    const wide = value === 'whole' ? 1.0 : 0.66;
    out.push({
      kind: 'ellipse',
      cx: headX,
      cy: y(step),
      rx: wide * s,
      ry: 0.5 * s,
      rotate: -18,
      mode: value === 'whole' || value === 'half' ? 'stroke' : 'fill',
      width: value === 'whole' ? Math.max(1.5, s * 0.26) : Math.max(1.5, s * 0.2),
    });
  });

  if (value === 'whole') return out;
  const ys = steps.map((st) => y(st));
  const low = Math.max(...ys);
  const high = Math.min(...ys);
  const stemX = x + (up ? 0.6 * s : -0.6 * s);
  const tip = up ? high - 3.3 * s : low + 3.3 * s;
  out.push({ kind: 'line', x1: stemX, y1: up ? low : high, x2: stemX, y2: tip, width: Math.max(1, s * 0.13) });
  const direction = up ? 1 : -1;
  for (let flag = 0; flag < StaffRules.flags(value); flag++) {
    const offset = flag * 0.9 * s;
    const sx = stemX;
    const sy = up ? tip + offset : tip - offset;
    out.push({
      kind: 'stroke',
      d: `M${r(sx)} ${r(sy)}C${r(sx + 0.1 * s)} ${r(sy + direction * 0.9 * s)} ${r(sx + 1.2 * s)} ${r(sy + direction * 0.9 * s)} ${r(sx + 0.95 * s)} ${r(sy + direction * 2.0 * s)}`,
      width: Math.max(1.2, s * 0.3),
    });
  }
  return out;
}

/** "Notenzeile im Violinschlüssel mit 3 Noten", for a screen reader. */
export function staffDescription(spec: StaffSpec): string {
  const clef = spec.clef === 'treble' ? 'Violinschlüssel' : spec.clef === 'bass' ? 'Bassschlüssel' : 'Altschlüssel';
  const count = spec.notes.length;
  return `Notenzeile im ${clef} mit ${count} ${count === 1 ? 'Note' : 'Noten'}`;
}

// Tones

export interface ToneNote {
  midi: number;
  /** Seconds from the start of the playback. */
  start: number;
  length: number;
  /** Rate of the exponential decay, per second. */
  decay: number;
  level: number;
}

export function midiFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** When each note of an ear exercise sounds: one after the other, or all at once as a chord, with the loudness
 * shared between the notes of a chord. */
export function toneSchedule(spec: ToneSpec): { notes: ToneNote[]; total: number } {
  const noteSeconds = spec.together ? 1.8 : 0.75;
  const gap = spec.together ? 0 : 0.05;
  const decay = spec.together ? 1.6 : 3.2;
  const groups = spec.together ? [spec.midi] : spec.midi.map((m) => [m]);
  const level = 0.5 / Math.max(1, groups[0]?.length ?? 1);
  const notes: ToneNote[] = [];
  groups.forEach((group, position) => {
    for (const midi of group) notes.push({ midi, start: position * (noteSeconds + gap), length: noteSeconds, decay, level });
  });
  return { notes, total: groups.length * (noteSeconds + gap) + 0.2 };
}

/** The harmonics of the soft piano-like tone: frequency factor and amplitude, the sum scaled to 1. */
export const toneHarmonics: ReadonlyArray<{ factor: number; amplitude: number }> = [
  { factor: 1, amplitude: 1 / 1.66 },
  { factor: 2, amplitude: 0.4 / 1.66 },
  { factor: 3, amplitude: 0.18 / 1.66 },
  { factor: 4, amplitude: 0.08 / 1.66 },
];

/** The loudness of a note at time t (seconds since its start): a quick attack, an exponential decay and a short
 * release at the end. */
export function toneEnvelope(t: number, length: number, decay: number): number {
  if (t < 0 || t > length) return 0;
  const attack = Math.min(1, t / 0.01);
  const release = Math.max(0, Math.min(1, (length - t) / 0.05));
  return attack * Math.exp(-t * decay) * release;
}

/** "Töne anhören", "Ton anhören" or "Klang anhören". */
export function toneButtonLabel(spec: ToneSpec): string {
  return spec.together ? 'Klang anhören' : spec.midi.length > 1 ? 'Töne anhören' : 'Ton anhören';
}

// Speech

export interface VoiceLike {
  lang: string;
}

/** A voice for a BCP 47 tag like "es-ES": the exact language and region first, then any voice of the language. Null
 * when the system has none, and then the screen offers no button. */
export function voiceFor<T extends VoiceLike>(voices: readonly T[], language: string): T | null {
  const wanted = language.replace('_', '-').toLowerCase();
  if (wanted === '') return null;
  const normalized = voices.map((voice) => ({ voice, lang: voice.lang.replace('_', '-').toLowerCase() }));
  const exact = normalized.find((v) => v.lang === wanted);
  if (exact) return exact.voice;
  const primary = wanted.split('-')[0];
  const same = normalized.find((v) => v.lang.split('-')[0] === primary);
  return same ? same.voice : null;
}

// Times and the path

/** "noch 15 Std" or "noch 42 Min", for the quest tile. */
export function timeLeftShort(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  if (minutes >= 60) return `noch ${Math.floor(minutes / 60)} Std`;
  return `noch ${Math.max(1, minutes)} Min`;
}

/** "noch 3 Std 12 Min" or "noch 42 Min", on the quest page. */
export function timeLeftLong(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  return minutes >= 60 ? `noch ${Math.floor(minutes / 60)} Std ${minutes % 60} Min` : `noch ${Math.max(1, minutes)} Min`;
}

const WAVE = [0, 0.55, 0.85, 0.55, 0, -0.55, -0.85, -0.55];

/** The sideways shift of a step on the path in units of the wave width: a gentle wave, right, further right, back,
 * left, further left, back. */
export function pathShift(position: number): number {
  return WAVE[position % WAVE.length];
}
