// Port of LernwerkTests/MusicCourseTheoryTests.swift.
import { describe, expect, it } from 'vitest';
import { type Pitch, pitch, pitchMidi } from '../../src/lib/learn/music';
import {
  atStep, barSixteenths, beatsOf, bottomLineDiatonic, isFull, ledgerLines, MusicKey, MusicNames, noteName, ORDERED_VALUES, parseMeter,
  pitchClass, restName, scale, scaleAccidentalCount, scaleName, scaleNotes, sixteenths, staffPosition, staffPositionDescription,
  staffPositionIndex, staffPositionIsLine, triad, triadName, triadNotes,
} from '../../src/lib/learn/musicCourse';
import {
  germanName, interval, intervalAbove, intervalBelow, intervalBetween, intervalName, intervalNumber, inverted, isEnharmonic, isTritone, octaveName,
  sameInterval, scientificName, spelled, STANDARD_INTERVALS,
} from '../../src/lib/learn/musicCourse/theory';

const C = 0, D = 1, E = 2, F = 3, G = 4, A = 5, H = 6;
const p = (letter: number, octave = 4, alteration = 0): Pitch => pitch(letter, octave, alteration);
const names = (notes: Pitch[]): string[] => notes.map(germanName);
const iv = (a: Pitch, b: Pitch) => intervalBetween(a, b);

describe('music theory', () => {
  it('midi numbers', () => {
    expect(pitchMidi(p(C))).toBe(60);
    expect(pitchMidi(p(A))).toBe(69);
    expect(pitchMidi(p(C, 5))).toBe(72);
    expect(pitchMidi(p(H, 3))).toBe(59);
    expect(pitchMidi(p(C, 4, 1))).toBe(61);
    expect(pitchMidi(p(H, 3, 1))).toBe(60);
    expect(pitchMidi(p(A, 0))).toBe(21);
    expect(pitchMidi(p(C, 8))).toBe(108);
  });

  it('german names', () => {
    const all = [p(C), p(C, 4, 1), p(D, 4, -1), p(D), p(D, 4, 1), p(E, 4, -1), p(E), p(F), p(F, 4, 1), p(G, 4, -1), p(G), p(G, 4, 1), p(A, 4, -1), p(A), p(A, 4, 1), p(H, 4, -1), p(H)];
    expect(names(all)).toEqual(['C', 'Cis', 'Des', 'D', 'Dis', 'Es', 'E', 'F', 'Fis', 'Ges', 'G', 'Gis', 'As', 'A', 'Ais', 'B', 'H']);
    expect(germanName(p(H, 4, 1))).toBe('His');
    expect(germanName(p(C, 4, -1))).toBe('Ces');
    expect(germanName(p(F, 4, 2))).toBe('Fisis');
    expect(germanName(p(H, 4, -2))).toBe('Heses');
    expect(germanName(p(E, 4, -2))).toBe('Eses');
    expect(germanName(p(A, 4, -2))).toBe('Asas');
  });

  it('name parsing', () => {
    for (const name of ['C', 'Cis', 'Des', 'Es', 'As', 'B', 'H', 'Fis', 'Ges', 'Gis', 'Ais', 'Ces', 'His']) {
      const parsed = MusicNames.parse(name);
      expect(parsed, name).not.toBeNull();
      expect(germanName(pitch(parsed!.letter, 4, parsed!.alteration))).toBe(name);
      expect(MusicNames.parse(name.toLowerCase())).not.toBeNull();
    }
    expect(MusicNames.parse('Xis')).toBeNull();
    expect(MusicNames.parse('Hes')).toBeNull();
    expect(MusicNames.parse('')).toBeNull();
  });

  it('spelling from midi', () => {
    expect(germanName(spelled(61))).toBe('Cis');
    expect(germanName(spelled(61, true))).toBe('Des');
    expect(germanName(spelled(70, true))).toBe('B');
    expect(germanName(spelled(70))).toBe('Ais');
    for (let midi = 21; midi <= 108; midi++) {
      expect(pitchMidi(spelled(midi))).toBe(midi);
      expect(pitchMidi(spelled(midi, true))).toBe(midi);
    }
    expect(isEnharmonic(p(C, 4, 1), p(D, 4, -1))).toBe(true);
  });

  it('octave names', () => {
    expect(octaveName(4)).toBe('eingestrichene Oktave');
    expect(octaveName(3)).toBe('kleine Oktave');
    expect(octaveName(2)).toBe('große Oktave');
    expect(scientificName(p(C, 4))).toBe('C4');
  });

  it('interval names and sizes', () => {
    const cg = iv(p(C), p(G));
    expect(intervalName(cg)).toBe('reine Quinte');
    expect(cg.semitones).toBe(7);
    expect(intervalNumber(cg)).toBe(5);
    expect(intervalName(iv(p(C), p(E)))).toBe('große Terz');
    expect(intervalName(iv(p(E), p(G)))).toBe('kleine Terz');
    expect(intervalName(iv(p(C), p(D)))).toBe('große Sekunde');
    expect(intervalName(iv(p(E), p(F)))).toBe('kleine Sekunde');
    expect(intervalName(iv(p(C), p(F)))).toBe('reine Quarte');
    expect(intervalName(iv(p(F), p(H)))).toBe('übermäßige Quarte');
    expect(intervalName(iv(p(H), p(F, 5)))).toBe('verminderte Quinte');
    expect(isTritone(iv(p(F), p(H)))).toBe(true);
    expect(isTritone(iv(p(C), p(G, 4, -1)))).toBe(true);
    expect(intervalName(iv(p(C), p(A)))).toBe('große Sexte');
    expect(intervalName(iv(p(E), p(C, 5)))).toBe('kleine Sexte');
    expect(intervalName(iv(p(C), p(H)))).toBe('große Septime');
    expect(intervalName(iv(p(D), p(C, 5)))).toBe('kleine Septime');
    expect(intervalName(iv(p(C), p(C, 5)))).toBe('reine Oktave');
    expect(intervalName(iv(p(C), p(C)))).toBe('reine Prim');
    expect(intervalName(iv(p(C), p(C, 4, 1)))).toBe('übermäßige Prim');
    expect(intervalName(iv(p(C), p(G, 4, -1)))).not.toBe(intervalName(iv(p(C), p(F, 4, 1))));
  });

  it('interval semitone table', () => {
    const expected: Array<[string, number]> = [
      ['reine Prim', 0], ['kleine Sekunde', 1], ['große Sekunde', 2], ['kleine Terz', 3], ['große Terz', 4], ['reine Quarte', 5],
      ['reine Quinte', 7], ['kleine Sexte', 8], ['große Sexte', 9], ['kleine Septime', 10], ['große Septime', 11], ['reine Oktave', 12],
    ];
    expect(STANDARD_INTERVALS.length).toBe(expected.length);
    STANDARD_INTERVALS.forEach((i, k) => {
      expect(intervalName(i)).toBe(expected[k][0]);
      expect(i.semitones).toBe(expected[k][1]);
    });
  });

  it('building intervals spells by letter', () => {
    const majorThird = interval(2, 4);
    expect(germanName(intervalAbove(majorThird, p(D)))).toBe('Fis');
    expect(germanName(intervalAbove(majorThird, p(F)))).toBe('A');
    expect(germanName(intervalAbove(majorThird, p(E, 4, -1)))).toBe('G');
    expect(germanName(intervalAbove(interval(2, 3), p(D)))).toBe('F');
    expect(germanName(intervalAbove(interval(4, 7), p(H)))).toBe('Fis');
    expect(germanName(intervalAbove(interval(4, 7), p(F)))).toBe('C');
    expect(germanName(intervalAbove(interval(4, 7), p(D, 4, -1)))).toBe('As');
    expect(germanName(intervalBelow(interval(4, 7), p(C)))).toBe('F');
    expect(germanName(intervalAbove(interval(3, 6), p(F)))).toBe('H');
    expect(germanName(intervalAbove(interval(4, 6), p(F)))).toBe('Ces');
  });

  it('inversion', () => {
    for (const i of STANDARD_INTERVALS) {
      expect(sameInterval(inverted(inverted(i)), i)).toBe(true);
      expect(intervalNumber(i) + intervalNumber(inverted(i))).toBe(9);
      expect(i.semitones + inverted(i).semitones).toBe(12);
    }
    expect(intervalName(inverted(interval(2, 4)))).toBe('kleine Sexte');
    expect(intervalName(inverted(interval(4, 7)))).toBe('reine Quarte');
    expect(intervalName(inverted(interval(1, 2)))).toBe('kleine Septime');
  });

  it('major scales', () => {
    const s = (t: Pitch) => names(scaleNotes(scale(t, 'major')));
    expect(s(p(C))).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'H', 'C']);
    expect(s(p(G))).toEqual(['G', 'A', 'H', 'C', 'D', 'E', 'Fis', 'G']);
    expect(s(p(F))).toEqual(['F', 'G', 'A', 'B', 'C', 'D', 'E', 'F']);
    expect(s(p(D))).toEqual(['D', 'E', 'Fis', 'G', 'A', 'H', 'Cis', 'D']);
    expect(s(p(H, 4, -1))).toEqual(['B', 'C', 'D', 'Es', 'F', 'G', 'A', 'B']);
    expect(s(p(E, 4, -1))).toEqual(['Es', 'F', 'G', 'As', 'B', 'C', 'D', 'Es']);
    expect(s(p(F, 4, 1))).toEqual(['Fis', 'Gis', 'Ais', 'H', 'Cis', 'Dis', 'Eis', 'Fis']);
    expect(s(p(D, 4, -1))).toEqual(['Des', 'Es', 'F', 'Ges', 'As', 'B', 'C', 'Des']);
    expect(scaleName(scale(p(G), 'major'))).toBe('G-Dur');
  });

  it('minor scales', () => {
    const s = (t: Pitch, k: 'naturalMinor' | 'harmonicMinor') => names(scaleNotes(scale(t, k)));
    expect(s(p(A), 'naturalMinor')).toEqual(['A', 'H', 'C', 'D', 'E', 'F', 'G', 'A']);
    expect(s(p(A), 'harmonicMinor')).toEqual(['A', 'H', 'C', 'D', 'E', 'F', 'Gis', 'A']);
    expect(s(p(E), 'naturalMinor')).toEqual(['E', 'Fis', 'G', 'A', 'H', 'C', 'D', 'E']);
    expect(s(p(D), 'naturalMinor')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D']);
    expect(s(p(D), 'harmonicMinor')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'Cis', 'D']);
    expect(scaleName(scale(p(A), 'naturalMinor'))).toBe('A-Moll');
  });

  it('scale octave and intervals', () => {
    for (let count = -6; count <= 6; count++) {
      const notes = scaleNotes(scale(MusicKey.majorTonic(count), 'major'));
      expect(notes.length).toBe(8);
      expect(pitchMidi(notes[7]) - pitchMidi(notes[0])).toBe(12);
      expect(new Set(notes.slice(0, -1).map((n) => n.letter)).size).toBe(7);
      expect(intervalName(iv(notes[0], notes[2]))).toBe('große Terz');
      expect(intervalName(iv(notes[0], notes[4]))).toBe('reine Quinte');
    }
  });

  it('key signatures', () => {
    expect(names(MusicKey.accidentals(1))).toEqual(['Fis']);
    expect(names(MusicKey.accidentals(7))).toEqual(['Fis', 'Cis', 'Gis', 'Dis', 'Ais', 'Eis', 'His']);
    expect(names(MusicKey.accidentals(-1))).toEqual(['B']);
    expect(names(MusicKey.accidentals(-7))).toEqual(['B', 'Es', 'As', 'Des', 'Ges', 'Ces', 'Fes']);
    expect(MusicKey.accidentals(0)).toEqual([]);
  });

  it('circle of fifths', () => {
    const range = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(range.map((i) => MusicKey.majorName(i))).toEqual(['C-Dur', 'G-Dur', 'D-Dur', 'A-Dur', 'E-Dur', 'H-Dur', 'Fis-Dur', 'Cis-Dur']);
    expect(range.map((i) => MusicKey.majorName(-i))).toEqual(['C-Dur', 'F-Dur', 'B-Dur', 'Es-Dur', 'As-Dur', 'Des-Dur', 'Ges-Dur', 'Ces-Dur']);
    expect(MusicKey.minorName(0)).toBe('A-Moll');
    expect(MusicKey.minorName(1)).toBe('E-Moll');
    expect(MusicKey.minorName(3)).toBe('Fis-Moll');
    expect(MusicKey.minorName(-1)).toBe('D-Moll');
    expect(MusicKey.minorName(-3)).toBe('C-Moll');
    expect(MusicKey.minorName(-2)).toBe('G-Moll');
    expect(MusicKey.countOfMajorTonic(p(D))).toBe(2);
    expect(MusicKey.countOfMajorTonic(p(E, 4, -1))).toBe(-3);
    expect(MusicKey.countOfMinorTonic(p(A))).toBe(0);
    expect(MusicKey.countOfMinorTonic(p(F, 4, 1))).toBe(3);
  });

  it('key signature agrees with scales', () => {
    for (let count = -7; count <= 7; count++) {
      const s = scale(MusicKey.majorTonic(count), 'major');
      for (const note of scaleNotes(s)) expect(note.alteration, `${scaleName(s)} ${germanName(note)}`).toBe(MusicKey.alteration(note.letter, count));
      expect(scaleAccidentalCount(s)).toBe(count);
      const minor = scale(MusicKey.minorTonic(count), 'naturalMinor');
      expect(scaleAccidentalCount(minor)).toBe(count);
      const majorNotes = scaleNotes(s).slice(0, -1);
      expect(scaleNotes(minor).slice(0, -1).map(pitchClass)).toEqual([0, 1, 2, 3, 4, 5, 6].map((k) => pitchClass(majorNotes[(k + 5) % 7])));
    }
  });

  it('triads', () => {
    const t = (root: Pitch, q: 'major' | 'minor' | 'diminished' | 'augmented') => names(triadNotes(triad(root, q)));
    expect(t(p(C), 'major')).toEqual(['C', 'E', 'G']);
    expect(t(p(E, 4, -1), 'major')).toEqual(['Es', 'G', 'B']);
    expect(t(p(A), 'minor')).toEqual(['A', 'C', 'E']);
    expect(t(p(D), 'major')).toEqual(['D', 'Fis', 'A']);
    expect(t(p(G), 'minor')).toEqual(['G', 'B', 'D']);
    expect(t(p(F), 'minor')).toEqual(['F', 'As', 'C']);
    expect(t(p(H), 'diminished')).toEqual(['H', 'D', 'F']);
    expect(t(p(C), 'augmented')).toEqual(['C', 'E', 'Gis']);
    expect(t(p(F, 4, 1), 'minor')).toEqual(['Fis', 'A', 'Cis']);
    expect(triadName(triad(p(E, 4, -1), 'major'))).toBe('Es-Dur');
    expect(triadNotes(triad(p(C), 'major')).map(pitchMidi)).toEqual([60, 64, 67]);
    expect(triadNotes(triad(p(C), 'minor')).map(pitchMidi)).toEqual([60, 63, 67]);
  });

  it('note values', () => {
    expect(ORDERED_VALUES.map(sixteenths)).toEqual([16, 8, 4, 2, 1]);
    const m44 = parseMeter('4/4')!, m34 = parseMeter('3/4')!, m68 = parseMeter('6/8')!;
    expect(barSixteenths(m44)).toBe(16);
    expect(barSixteenths(m34)).toBe(12);
    expect(barSixteenths(m68)).toBe(12);
    expect(beatsOf(m44, 'whole')).toEqual([4, 1]);
    expect(beatsOf(m44, 'half')).toEqual([2, 1]);
    expect(beatsOf(m44, 'quarter')).toEqual([1, 1]);
    expect(beatsOf(m44, 'eighth')).toEqual([1, 2]);
    expect(beatsOf(m44, 'sixteenth')).toEqual([1, 4]);
    expect(beatsOf(m68, 'eighth')).toEqual([1, 1]);
    expect(beatsOf(m68, 'quarter')).toEqual([2, 1]);
    expect(isFull(m44, ['half', 'quarter', 'eighth', 'eighth'])).toBe(true);
    expect(isFull(m34, ['half', 'half'])).toBe(false);
    expect(isFull(m34, ['half', 'quarter'])).toBe(true);
    expect(parseMeter('4/5')).toBeNull();
    expect(parseMeter('x')).toBeNull();
    expect(restName('eighth')).toBe('Achtelpause');
    expect(noteName('half')).toBe('Halbe Note');
  });

  it('staff positions', () => {
    const tp = (q: Pitch) => staffPosition(q, 'treble');
    const bp = (q: Pitch) => staffPosition(q, 'bass');
    expect(tp(p(E, 4)).step).toBe(0);
    expect(staffPositionIndex(tp(p(G, 4)))).toBe(2);
    expect(staffPositionIsLine(tp(p(G, 4)))).toBe(true);
    expect(tp(p(F, 5)).step).toBe(8);
    expect(staffPositionDescription(tp(p(F, 4)))).toBe('1. Zwischenraum');
    expect(tp(p(C, 4)).step).toBe(-2);
    expect(ledgerLines(tp(p(C, 4)))).toBe(1);
    expect(ledgerLines(tp(p(D, 4)))).toBe(0);
    expect(ledgerLines(tp(p(A, 3)))).toBe(2);
    expect(ledgerLines(tp(p(A, 5)))).toBe(1);
    expect(ledgerLines(tp(p(G, 5)))).toBe(0);
    expect(ledgerLines(tp(p(C, 6)))).toBe(2);
    expect(bp(p(G, 2)).step).toBe(0);
    expect(bp(p(A, 3)).step).toBe(8);
    expect(staffPositionIndex(bp(p(F, 3)))).toBe(4);
    expect(ledgerLines(bp(p(C, 4)))).toBe(1);
    expect(staffPositionDescription(bp(p(C, 4)))).toBe('1. Hilfslinie oben');
    expect(ledgerLines(bp(p(E, 2)))).toBe(1);
    for (const clef of ['treble', 'bass'] as const) {
      for (let step = -6; step <= 14; step++) expect(staffPosition(atStep(step, clef), clef).step).toBe(step);
    }
    expect(germanName(atStep(0, 'bass'))).toBe('G');
    expect(bottomLineDiatonic('treble')).toBe(30);
  });

  it('piano keys', () => {
    expect(MusicNames.keys(0)[0]).toBe(24);
    expect(MusicNames.keys(0)).toContain(60);
    expect(MusicNames.keys(9).length).toBe(8);
    expect(MusicNames.isBlackKey(61)).toBe(true);
    expect(MusicNames.isBlackKey(60)).toBe(false);
  });
});
