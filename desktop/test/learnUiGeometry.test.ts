import { describe, expect, it } from 'vitest';
import { staffSpec, staffNote, pitch } from '../src/lib/learn/music';
import {
  PianoLayout, StaffRules, boardPlacement, germanPieceName, layoutStaff, midiFrequency, moveHint, pathShift, pieceOn, sideToMove,
  squareAt, squareCoordinates, squareMark, staffDescription, staffSpace, timeLeftLong, timeLeftShort, toneEnvelope, toneSchedule, voiceFor,
} from '../src/views/learn/geometry';

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('chess board geometry', () => {
  it('reads a FEN', () => {
    const board = boardPlacement(start);
    expect(pieceOn(board, 'e1')).toBe('K');
    expect(pieceOn(board, 'd8')).toBe('q');
    expect(pieceOn(board, 'e4')).toBeNull();
    expect(pieceOn(board, 'z9')).toBeNull();
    expect(boardPlacement('8').length).toBe(8);
    expect(boardPlacement('').every((r) => r.length === 8)).toBe(true);
  });
  it('puts White at the bottom, or Black when flipped', () => {
    expect(squareAt(7, 0, false)).toBe('a1');
    expect(squareAt(0, 7, false)).toBe('h8');
    expect(squareAt(7, 0, true)).toBe('h8');
    expect(squareAt(0, 0, true)).toBe('h1');
  });
  it('names squares and sides', () => {
    expect(squareCoordinates('e4')).toEqual({ file: 4, rank: 4 });
    expect(squareCoordinates('i4')).toBeNull();
    expect(sideToMove(start)).toBe('Weiß');
    expect(sideToMove('8/8/8/8/8/8/8/8 b')).toBe('Schwarz');
    expect(sideToMove('8/8/8/8/8/8/8/8')).toBeNull();
    expect(germanPieceName('Q')).toBe('weiße Dame');
    expect(germanPieceName('n')).toBe('schwarzer Springer');
  });
  it('marks the squares of a move and the right one after a wrong answer', () => {
    expect(squareMark('e2', 'e2', 'e4', ['d2d4'], null)).toBe('pick');
    expect(squareMark('e4', 'e2', 'e4', ['d2d4'], 'right')).toBe('verdict-right');
    expect(squareMark('e4', 'e2', 'e4', ['d2d4'], 'wrong')).toBe('verdict-wrong');
    expect(squareMark('d4', 'e2', 'e4', ['d2d4'], 'wrong')).toBe('solution');
    expect(squareMark('d4', 'e2', 'e4', ['d2d4'], 'right')).toBeNull();
    expect(moveHint(null, null, null)).toContain('Figur');
    expect(moveHint('e2', null, null)).toContain('Zielfeld');
    expect(moveHint('e2', 'e4', null)).toContain('Prüfen');
    expect(moveHint('e2', 'e4', 'wrong')).toBe('');
  });
});

describe('piano', () => {
  it('shows at least two octaves around the right keys', () => {
    expect(PianoLayout.range([])).toEqual({ low: 60, high: 84 });
    expect(PianoLayout.range([60])).toEqual({ low: 60, high: 84 });
    const r = PianoLayout.range([62, 67]);
    expect(r.low % 12).toBe(0);
    expect(r.high - r.low).toBeGreaterThanOrEqual(24);
  });
  it('knows black keys and puts them between the whites', () => {
    expect(PianoLayout.isBlack(61)).toBe(true);
    expect(PianoLayout.isBlack(60)).toBe(false);
    expect(PianoLayout.whiteKeys(60, 72).length).toBe(8);
    expect(PianoLayout.blackKeyCenter(61, 60)).toBeCloseTo(0.94, 2);
    expect(PianoLayout.name(60)).toBe('C4');
    expect(PianoLayout.name(66)).toBe('F♯4');
  });
});

describe('staff rules', () => {
  it('counts steps from the bottom line', () => {
    expect(StaffRules.step(pitch(2, 4), 'treble')).toBe(0);
    expect(StaffRules.step(pitch(0, 4), 'treble')).toBe(-2);
    expect(StaffRules.step(pitch(4, 2), 'bass')).toBe(0);
    expect(StaffRules.step(pitch(3, 3), 'alto')).toBe(0);
  });
  it('draws ledger lines outside the staff only', () => {
    expect(StaffRules.ledgerSteps(4)).toEqual([]);
    expect(StaffRules.ledgerSteps(-4)).toEqual([-2, -4]);
    expect(StaffRules.ledgerSteps(12)).toEqual([10, 12]);
  });
  it('places key signatures and accidentals', () => {
    expect(StaffRules.keySignature(2, 'treble')).toEqual([{ step: 8, sharp: true }, { step: 5, sharp: true }]);
    expect(StaffRules.keySignature(-1, 'bass')).toEqual([{ step: 2, sharp: false }]);
    expect(StaffRules.keySignature(0, 'treble')).toEqual([]);
    expect(StaffRules.keyAlteration(3, 1)).toBe(1);
    expect(StaffRules.keyAlteration(6, -1)).toBe(-1);
    expect(StaffRules.accidental(pitch(3, 4, 1), 2)).toBeNull();
    expect(StaffRules.accidental(pitch(3, 4, 0), 2)).toBe('natural');
    expect(StaffRules.accidental(pitch(1, 4, -1), 0)).toBe('flat');
    expect(StaffRules.accidental(pitch(1, 4, 2), 0)).toBe('doubleSharp');
  });
  it('chooses stem direction and shifts seconds in a chord', () => {
    expect(StaffRules.stemUp([0, 2])).toBe(true);
    expect(StaffRules.stemUp([6, 8])).toBe(false);
    expect(StaffRules.shifted([0, 1, 2])).toEqual([false, true, false]);
    expect(StaffRules.shifted([0, 2, 4])).toEqual([false, false, false]);
    expect(StaffRules.flags('eighth')).toBe(1);
    expect(StaffRules.flags('sixteenth')).toBe(2);
    expect(StaffRules.flags('quarter')).toBe(0);
  });
  it('lays a staff out', () => {
    const spec = staffSpec('treble', [staffNote(pitch(0, 4)), staffNote(pitch(2, 4), 'half'), staffNote(pitch(4, 4), 'quarter', true)], { keySignature: 2, time: '4/4' });
    const layout = layoutStaff(spec, 520);
    expect(layout.primitives.filter((p) => p.kind === 'ellipse').length).toBe(2);
    expect(layout.primitives.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''))).toEqual(['4', '4']);
    expect(layout.primitives.some((p) => p.kind === 'fill')).toBe(true);
    expect(staffSpace(spec, 520)).toBeLessThanOrEqual(12);
    expect(staffSpace(spec, 100)).toBeLessThan(staffSpace(spec, 520));
    // The note below the staff gets a ledger line of its own.
    const lines = layout.primitives.filter((p) => p.kind === 'line');
    expect(lines.length).toBeGreaterThan(6);
    const chord = layoutStaff(staffSpec('bass', [staffNote(pitch(0, 3)), staffNote(pitch(2, 3)), staffNote(pitch(4, 3))], { chord: true }), 520);
    expect(chord.primitives.filter((p) => p.kind === 'ellipse').length).toBe(3);
    expect(staffDescription(spec)).toBe('Notenzeile im Violinschlüssel mit 3 Noten');
  });
});

describe('tones', () => {
  it('schedules notes one after the other or together', () => {
    const seq = toneSchedule({ midi: [60, 64, 67], together: false });
    expect(seq.notes.map((n) => n.start)).toEqual([0, 0.8, 1.6]);
    expect(seq.total).toBeCloseTo(2.6, 5);
    const chord = toneSchedule({ midi: [60, 64, 67], together: true });
    expect(chord.notes.every((n) => n.start === 0)).toBe(true);
    expect(chord.notes[0].level).toBeCloseTo(0.5 / 3, 5);
  });
  it('has a frequency and an envelope', () => {
    expect(midiFrequency(69)).toBeCloseTo(440, 5);
    expect(midiFrequency(60)).toBeCloseTo(261.63, 1);
    expect(toneEnvelope(0, 0.75, 3.2)).toBe(0);
    expect(toneEnvelope(0.01, 0.75, 3.2)).toBeGreaterThan(0.9);
    expect(toneEnvelope(0.75, 0.75, 3.2)).toBe(0);
    expect(toneEnvelope(1, 0.75, 3.2)).toBe(0);
  });
});

describe('voices and times', () => {
  const voices = [{ lang: 'en_US' }, { lang: 'es-MX' }, { lang: 'fr-FR' }];
  it('finds a voice of the language, preferring the region', () => {
    expect(voiceFor(voices, 'fr-FR')).toBe(voices[2]);
    expect(voiceFor(voices, 'es-ES')).toBe(voices[1]);
    expect(voiceFor(voices, 'la')).toBeNull();
    expect(voiceFor([], 'es-ES')).toBeNull();
    expect(voiceFor(voices, '')).toBeNull();
  });
  it('words the time left', () => {
    expect(timeLeftShort(15 * 3600 + 5)).toBe('noch 15 Std');
    expect(timeLeftShort(42 * 60)).toBe('noch 42 Min');
    expect(timeLeftShort(10)).toBe('noch 1 Min');
    expect(timeLeftLong(3 * 3600 + 12 * 60)).toBe('noch 3 Std 12 Min');
    expect(timeLeftLong(42 * 60)).toBe('noch 42 Min');
  });
  it('waves the path', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(pathShift)).toEqual([0, 0.55, 0.85, 0.55, 0, -0.55, -0.85, -0.55, 0]);
  });
});
