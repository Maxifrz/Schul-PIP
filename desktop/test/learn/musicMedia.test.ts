import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { pitch } from '../../src/lib/learn/media';
import { PianoLayout, accidentalFor, keySignatureSigns, ledgerSteps, shiftedSteps, stemUp, stepOf } from '../../src/lib/learn/music/rules';
import { frequencyOf, renderTones } from '../../src/lib/learn/music/synth';
import { StaffView } from '../../src/views/learn/Music';

const p = (letter: number, octave = 4, alteration = 0) => pitch(letter, octave, alteration);

describe('the staff rules', () => {
  it('puts notes on steps and ledger lines', () => {
    expect(stepOf(p(2, 4), 'treble')).toBe(0);
    expect(stepOf(p(0, 4), 'treble')).toBe(-2);
    expect(ledgerSteps(-2)).toEqual([-2]);
    expect(ledgerSteps(-4)).toEqual([-2, -4]);
    expect(ledgerSteps(12)).toEqual([10, 12]);
    expect(ledgerSteps(5)).toEqual([]);
  });

  it('places key signatures', () => {
    expect(keySignatureSigns(2, 'treble')).toEqual([{ step: 8, sharp: true }, { step: 5, sharp: true }]);
    expect(keySignatureSigns(-1, 'bass')).toEqual([{ step: 2, sharp: false }]);
    expect(keySignatureSigns(0, 'treble')).toEqual([]);
    expect(accidentalFor(p(3, 4, 1), 1)).toBeNull();
    expect(accidentalFor(p(3, 4, 0), 1)).toBe('natural');
    expect(accidentalFor(p(0, 4, 1), 0)).toBe('sharp');
  });

  it('turns stems and shifts seconds', () => {
    expect(stemUp([0, 2])).toBe(true);
    expect(stemUp([6, 8])).toBe(false);
    expect(shiftedSteps([4, 5, 6])).toEqual([false, true, false]);
  });
});

describe('the keyboard', () => {
  it('covers the right keys with at least two octaves', () => {
    expect(PianoLayout.range([60])).toEqual([60, 84]);
    expect(PianoLayout.range([])).toEqual([60, 84]);
    const [low, high] = PianoLayout.range([61, 70]);
    expect(low <= 61 && high > 70 && high - low >= 24).toBe(true);
    expect(PianoLayout.name(60)).toBe('C4');
    expect(PianoLayout.name(70)).toBe('A♯4');
    expect(PianoLayout.whiteKeys(60, 71)).toHaveLength(7);
  });
});

describe('the tones', () => {
  it('has the pitch of the concert A', () => {
    expect(frequencyOf(69)).toBe(440);
    expect(frequencyOf(81)).toBeCloseTo(880, 6);
  });

  it('renders notes in a row or as a chord', () => {
    const row = renderTones({ midi: [60, 64], together: false }, 8000);
    const chord = renderTones({ midi: [60, 64, 67], together: true }, 8000);
    expect(row.length).toBe(Math.floor((2 * 0.8 + 0.2) * 8000));
    expect(chord.length).toBe(Math.floor(2 * 8000));
    expect(Math.max(...row.map(Math.abs))).toBeGreaterThan(0.05);
    expect(Math.max(...chord.map(Math.abs))).toBeLessThan(1.5);
  });
});

describe('the staff view', () => {
  it('draws five lines, a clef and a note', () => {
    const html = renderToStaticMarkup(h(StaffView, { spec: { clef: 'treble', keySignature: 2, time: '4/4', notes: [{ pitch: p(0, 4), value: 'quarter', isRest: false }], chord: false } }));
    expect((html.match(/<line/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(html).toContain('<ellipse');
    expect(html).toContain('Violinschlüssel');
  });
});
