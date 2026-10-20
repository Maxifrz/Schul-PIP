import { describe, expect, it } from 'vitest';
import { Pitch, pitch, midiOf } from '../../src/lib/learn/media';
import {
  MusicInterval, MusicKey, MusicMeter, MusicNames, MusicScale, MusicScaleKind, MusicTriad, MusicTriadQuality, germanName, noteName, noteValuesOrdered,
  octaveName, pitchAtStep, pitchClass, restName, scientificName, sixteenths, spelled, staffPosition,
} from '../../src/lib/learn/music/theory';

/** Checks the theory against facts known independently of the code. */
const C = 0, D = 1, E = 2, F = 3, G = 4, A = 5, H = 6;
const p = (letter: number, octave = 4, alteration = 0): Pitch => pitch(letter, octave, alteration);
const names = (notes: Pitch[]) => notes.map(germanName);
const between = (a: Pitch, b: Pitch) => MusicInterval.between(a, b);

describe('music theory', () => {
  it('numbers the notes in MIDI', () => {
    expect([midiOf(p(C)), midiOf(p(A)), midiOf(p(C, 5)), midiOf(p(H, 3)), midiOf(p(C, 4, 1)), midiOf(p(H, 3, 1)), midiOf(p(A, 0)), midiOf(p(C, 8))]).toEqual([60, 69, 72, 59, 61, 60, 21, 108]);
  });

  it('names notes in German', () => {
    const all = [p(C), p(C, 4, 1), p(D, 4, -1), p(D), p(D, 4, 1), p(E, 4, -1), p(E), p(F), p(F, 4, 1), p(G, 4, -1), p(G), p(G, 4, 1), p(A, 4, -1), p(A), p(A, 4, 1), p(H, 4, -1), p(H)];
    expect(names(all)).toEqual(['C', 'Cis', 'Des', 'D', 'Dis', 'Es', 'E', 'F', 'Fis', 'Ges', 'G', 'Gis', 'As', 'A', 'Ais', 'B', 'H']);
    expect([germanName(p(H, 4, 1)), germanName(p(C, 4, -1)), germanName(p(F, 4, 2)), germanName(p(H, 4, -2)), germanName(p(E, 4, -2)), germanName(p(A, 4, -2))]).toEqual(['His', 'Ces', 'Fisis', 'Heses', 'Eses', 'Asas']);
  });

  it('parses names', () => {
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

  it('spells MIDI numbers', () => {
    expect(germanName(spelled(61))).toBe('Cis');
    expect(germanName(spelled(61, true))).toBe('Des');
    expect(germanName(spelled(70, true))).toBe('B');
    expect(germanName(spelled(70))).toBe('Ais');
    for (let m = 21; m <= 108; m++) {
      expect(midiOf(spelled(m))).toBe(m);
      expect(midiOf(spelled(m, true))).toBe(m);
    }
  });

  it('names octaves', () => {
    expect(octaveName(4)).toBe('eingestrichene Oktave');
    expect(octaveName(3)).toBe('kleine Oktave');
    expect(octaveName(2)).toBe('große Oktave');
    expect(scientificName(p(C, 4))).toBe('C4');
  });

  it('names intervals', () => {
    const cg = between(p(C), p(G));
    expect([cg.name, cg.semitones, cg.number]).toEqual(['reine Quinte', 7, 5]);
    const table: Array<[Pitch, Pitch, string]> = [
      [p(C), p(E), 'große Terz'], [p(E), p(G), 'kleine Terz'], [p(C), p(D), 'große Sekunde'], [p(E), p(F), 'kleine Sekunde'], [p(C), p(F), 'reine Quarte'],
      [p(F), p(H), 'übermäßige Quarte'], [p(H), p(F, 5), 'verminderte Quinte'], [p(C), p(A), 'große Sexte'], [p(E), p(C, 5), 'kleine Sexte'],
      [p(C), p(H), 'große Septime'], [p(D), p(C, 5), 'kleine Septime'], [p(C), p(C, 5), 'reine Oktave'], [p(C), p(C), 'reine Prim'], [p(C), p(C, 4, 1), 'übermäßige Prim'],
    ];
    for (const [a, b, name] of table) expect(between(a, b).name).toBe(name);
    expect(between(p(F), p(H)).isTritone).toBe(true);
    expect(between(p(C), p(G, 4, -1)).isTritone).toBe(true);
    expect(between(p(C), p(G, 4, -1)).name).not.toBe(between(p(C), p(F, 4, 1)).name);
  });

  it('has the semitone table', () => {
    const expected: Array<[string, number]> = [
      ['reine Prim', 0], ['kleine Sekunde', 1], ['große Sekunde', 2], ['kleine Terz', 3], ['große Terz', 4], ['reine Quarte', 5],
      ['reine Quinte', 7], ['kleine Sexte', 8], ['große Sexte', 9], ['kleine Septime', 10], ['große Septime', 11], ['reine Oktave', 12],
    ];
    expect(MusicInterval.standard).toHaveLength(expected.length);
    MusicInterval.standard.forEach((i, k) => expect([i.name, i.semitones]).toEqual(expected[k]));
  });

  it('builds intervals spelled by letter', () => {
    const majorThird = new MusicInterval(2, 4);
    expect(germanName(majorThird.above(p(D)))).toBe('Fis');
    expect(germanName(majorThird.above(p(F)))).toBe('A');
    expect(germanName(majorThird.above(p(E, 4, -1)))).toBe('G');
    expect(germanName(new MusicInterval(2, 3).above(p(D)))).toBe('F');
    expect(germanName(new MusicInterval(4, 7).above(p(H)))).toBe('Fis');
    expect(germanName(new MusicInterval(4, 7).above(p(F)))).toBe('C');
    expect(germanName(new MusicInterval(4, 7).above(p(D, 4, -1)))).toBe('As');
    expect(germanName(new MusicInterval(4, 7).below(p(C)))).toBe('F');
    expect(germanName(new MusicInterval(3, 6).above(p(F)))).toBe('H');
    expect(germanName(new MusicInterval(4, 6).above(p(F)))).toBe('Ces');
  });

  it('inverts intervals', () => {
    for (const i of MusicInterval.standard) {
      expect(i.inverted.inverted.equals(i)).toBe(true);
      expect(i.number + i.inverted.number).toBe(9);
      expect(i.semitones + i.inverted.semitones).toBe(12);
    }
    expect(new MusicInterval(2, 4).inverted.name).toBe('kleine Sexte');
    expect(new MusicInterval(4, 7).inverted.name).toBe('reine Quarte');
    expect(new MusicInterval(1, 2).inverted.name).toBe('kleine Septime');
  });

  it('builds major scales', () => {
    const scale = (t: Pitch) => names(new MusicScale(t, 'major').notes);
    expect(scale(p(C))).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'H', 'C']);
    expect(scale(p(G))).toEqual(['G', 'A', 'H', 'C', 'D', 'E', 'Fis', 'G']);
    expect(scale(p(F))).toEqual(['F', 'G', 'A', 'B', 'C', 'D', 'E', 'F']);
    expect(scale(p(D))).toEqual(['D', 'E', 'Fis', 'G', 'A', 'H', 'Cis', 'D']);
    expect(scale(p(H, 4, -1))).toEqual(['B', 'C', 'D', 'Es', 'F', 'G', 'A', 'B']);
    expect(scale(p(E, 4, -1))).toEqual(['Es', 'F', 'G', 'As', 'B', 'C', 'D', 'Es']);
    expect(scale(p(F, 4, 1))).toEqual(['Fis', 'Gis', 'Ais', 'H', 'Cis', 'Dis', 'Eis', 'Fis']);
    expect(scale(p(D, 4, -1))).toEqual(['Des', 'Es', 'F', 'Ges', 'As', 'B', 'C', 'Des']);
    expect(new MusicScale(p(G), 'major').name).toBe('G-Dur');
  });

  it('builds minor scales', () => {
    const scale = (t: Pitch, k: MusicScaleKind) => names(new MusicScale(t, k).notes);
    expect(scale(p(A), 'naturalMinor')).toEqual(['A', 'H', 'C', 'D', 'E', 'F', 'G', 'A']);
    expect(scale(p(A), 'harmonicMinor')).toEqual(['A', 'H', 'C', 'D', 'E', 'F', 'Gis', 'A']);
    expect(scale(p(E), 'naturalMinor')).toEqual(['E', 'Fis', 'G', 'A', 'H', 'C', 'D', 'E']);
    expect(scale(p(D), 'naturalMinor')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D']);
    expect(scale(p(D), 'harmonicMinor')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'Cis', 'D']);
    expect(new MusicScale(p(A), 'naturalMinor').name).toBe('A-Moll');
  });

  it('keeps octave and intervals of every scale', () => {
    for (let count = -6; count <= 6; count++) {
      const notes = new MusicScale(MusicKey.majorTonic(count), 'major').notes;
      expect(notes).toHaveLength(8);
      expect(midiOf(notes[7]) - midiOf(notes[0])).toBe(12);
      expect(new Set(notes.slice(0, -1).map((n) => n.letter)).size).toBe(7);
      expect(between(notes[0], notes[2]).name).toBe('große Terz');
      expect(between(notes[0], notes[4]).name).toBe('reine Quinte');
    }
  });

  it('writes key signatures', () => {
    expect(names(MusicKey.accidentals(1))).toEqual(['Fis']);
    expect(names(MusicKey.accidentals(7))).toEqual(['Fis', 'Cis', 'Gis', 'Dis', 'Ais', 'Eis', 'His']);
    expect(names(MusicKey.accidentals(-1))).toEqual(['B']);
    expect(names(MusicKey.accidentals(-7))).toEqual(['B', 'Es', 'As', 'Des', 'Ges', 'Ces', 'Fes']);
    expect(MusicKey.accidentals(0)).toEqual([]);
  });

  it('follows the circle of fifths', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(MusicKey.majorName)).toEqual(['C-Dur', 'G-Dur', 'D-Dur', 'A-Dur', 'E-Dur', 'H-Dur', 'Fis-Dur', 'Cis-Dur']);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => MusicKey.majorName(-i))).toEqual(['C-Dur', 'F-Dur', 'B-Dur', 'Es-Dur', 'As-Dur', 'Des-Dur', 'Ges-Dur', 'Ces-Dur']);
    expect([0, 1, 3, -1, -3, -2].map(MusicKey.minorName)).toEqual(['A-Moll', 'E-Moll', 'Fis-Moll', 'D-Moll', 'C-Moll', 'G-Moll']);
    expect(MusicKey.countOfMajorTonic(p(D))).toBe(2);
    expect(MusicKey.countOfMajorTonic(p(E, 4, -1))).toBe(-3);
    expect(MusicKey.countOfMinorTonic(p(A))).toBe(0);
    expect(MusicKey.countOfMinorTonic(p(F, 4, 1))).toBe(3);
  });

  it('lets key signatures agree with scales', () => {
    for (let count = -7; count <= 7; count++) {
      const scale = new MusicScale(MusicKey.majorTonic(count), 'major');
      for (const n of scale.notes) expect(n.alteration, `${scale.name} ${germanName(n)}`).toBe(MusicKey.alteration(n.letter, count));
      expect(scale.accidentalCount).toBe(count);
      const minor = new MusicScale(MusicKey.minorTonic(count), 'naturalMinor');
      expect(minor.accidentalCount).toBe(count);
      const major = scale.notes.slice(0, -1);
      expect(minor.notes.slice(0, -1).map(pitchClass)).toEqual([0, 1, 2, 3, 4, 5, 6].map((k) => pitchClass(major[(k + 5) % 7])));
    }
  });

  it('builds triads', () => {
    const triad = (root: Pitch, q: MusicTriadQuality) => names(new MusicTriad(root, q).notes);
    expect(triad(p(C), 'major')).toEqual(['C', 'E', 'G']);
    expect(triad(p(E, 4, -1), 'major')).toEqual(['Es', 'G', 'B']);
    expect(triad(p(A), 'minor')).toEqual(['A', 'C', 'E']);
    expect(triad(p(D), 'major')).toEqual(['D', 'Fis', 'A']);
    expect(triad(p(G), 'minor')).toEqual(['G', 'B', 'D']);
    expect(triad(p(F), 'minor')).toEqual(['F', 'As', 'C']);
    expect(triad(p(H), 'diminished')).toEqual(['H', 'D', 'F']);
    expect(triad(p(C), 'augmented')).toEqual(['C', 'E', 'Gis']);
    expect(triad(p(F, 4, 1), 'minor')).toEqual(['Fis', 'A', 'Cis']);
    expect(new MusicTriad(p(E, 4, -1), 'major').name).toBe('Es-Dur');
    expect(new MusicTriad(p(C), 'major').notes.map(midiOf)).toEqual([60, 64, 67]);
    expect(new MusicTriad(p(C), 'minor').notes.map(midiOf)).toEqual([60, 63, 67]);
  });

  it('measures note values and bars', () => {
    expect(noteValuesOrdered.map(sixteenths)).toEqual([16, 8, 4, 2, 1]);
    const m44 = MusicMeter.parse('4/4')!, m34 = MusicMeter.parse('3/4')!, m68 = MusicMeter.parse('6/8')!;
    expect([m44.barSixteenths, m34.barSixteenths, m68.barSixteenths]).toEqual([16, 12, 12]);
    expect(['whole', 'half', 'quarter', 'eighth', 'sixteenth'].map((v) => m44.beatsOf(v as never))).toEqual([[4, 1], [2, 1], [1, 1], [1, 2], [1, 4]]);
    expect(m68.beatsOf('eighth')).toEqual([1, 1]);
    expect(m68.beatsOf('quarter')).toEqual([2, 1]);
    expect(m44.isFull(['half', 'quarter', 'eighth', 'eighth'])).toBe(true);
    expect(m34.isFull(['half', 'half'])).toBe(false);
    expect(m34.isFull(['half', 'quarter'])).toBe(true);
    expect(MusicMeter.parse('4/5')).toBeNull();
    expect(MusicMeter.parse('x')).toBeNull();
    expect(restName('eighth')).toBe('Achtelpause');
    expect(noteName('half')).toBe('Halbe Note');
  });

  it('places notes on the staff', () => {
    const pos = (n: Pitch, c: 'treble' | 'bass') => staffPosition(n, c);
    expect(pos(p(E, 4), 'treble').step).toBe(0);
    expect(pos(p(G, 4), 'treble').index).toBe(2);
    expect(pos(p(G, 4), 'treble').isLine).toBe(true);
    expect(pos(p(F, 5), 'treble').step).toBe(8);
    expect(pos(p(F, 4), 'treble').description).toBe('1. Zwischenraum');
    expect(pos(p(C, 4), 'treble').step).toBe(-2);
    expect([p(C, 4), p(D, 4), p(A, 3), p(A, 5), p(G, 5), p(C, 6)].map((n) => pos(n, 'treble').ledgerLines)).toEqual([1, 0, 2, 1, 0, 2]);
    expect(pos(p(G, 2), 'bass').step).toBe(0);
    expect(pos(p(A, 3), 'bass').step).toBe(8);
    expect(pos(p(F, 3), 'bass').index).toBe(4);
    expect(pos(p(C, 4), 'bass').ledgerLines).toBe(1);
    expect(pos(p(C, 4), 'bass').description).toBe('1. Hilfslinie oben');
    expect(pos(p(E, 2), 'bass').ledgerLines).toBe(1);
    for (const clef of ['treble', 'bass'] as const) for (let step = -6; step <= 14; step++) expect(staffPosition(pitchAtStep(step, clef), clef).step).toBe(step);
    expect(germanName(pitchAtStep(0, 'bass'))).toBe('G');
  });

  it('finds piano keys', () => {
    expect(MusicNames.keys(0)[0]).toBe(24);
    expect(MusicNames.keys(0)).toContain(60);
    expect(MusicNames.keys(9)).toHaveLength(8);
    expect(MusicNames.isBlackKey(61)).toBe(true);
    expect(MusicNames.isBlackKey(60)).toBe(false);
  });
});
