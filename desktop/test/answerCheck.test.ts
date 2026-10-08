import { describe, expect, it } from 'vitest';
import { distance, evaluate, keyTokens, normalize, tokens } from '../src/lib/answerCheck';

const verdict = (answer: string, expected: string) => evaluate(answer, expected);

describe('answer check (same cases as the Swift and Kotlin tests)', () => {
  it('ignores word order, filler words and spelling', () => {
    const expected = 'Äußere Ableitung mal innere Ableitung';
    expect(verdict('Äußere mal innere Ableitung', expected)).toBe('correct');
    expect(verdict('aeussere mal innere ableitung', expected)).toBe('correct');
    expect(verdict('Quotientenregel', 'Die Quotientenregel')).toBe('correct');
    expect(verdict('kettenregl', 'Kettenregel')).toBe('correct');
    expect(verdict('Ableitungen', 'Ableitung')).toBe('correct');
  });

  it('rejects wrong or missing answers', () => {
    expect(verdict('Produktregel', 'Quotientenregel')).toBe('wrong');
    expect(verdict('Hauptstadt', 'Berlin')).toBe('wrong');
    expect(verdict('   ', 'Ableitung')).toBe('wrong');
    expect(verdict('Aeussere Ableitung', 'Äußere Ableitung mal innere Ableitung')).toBe('wrong');
    expect(verdict('Photosynthese', 'Die Photosynthese wandelt Licht in chemische Energie um')).toBe('wrong');
  });

  it('needs most key words in long answers', () => {
    expect(verdict('Photosynthese wandelt Licht in chemische Energie', 'Die Photosynthese wandelt Licht in chemische Energie um')).toBe('correct');
  });

  it('is exact about numbers and formulas', () => {
    expect(verdict('0,5', '0.5')).toBe('correct');
    expect(verdict('x^2', 'x²')).toBe('correct');
    expect(verdict('2x', '2 x')).toBe('correct');
    expect(verdict('12', '12')).toBe('correct');
    expect(verdict('3', '4')).toBe('wrong');
    expect(verdict('y', 'x')).toBe('wrong');
    expect(verdict('Ableitung von x^3 ist 3x^3', 'Die Ableitung von x^3 ist 3x^2')).toBe('wrong');
    expect(verdict('Ableitung von x^3 ist 3x^2', 'Die Ableitung von x^3 ist 3x^2')).toBe('correct');
  });

  it('accepts either alternative', () => {
    expect(verdict('Berlin', 'Berlin / Bundeshauptstadt')).toBe('correct');
    expect(verdict('Bundeshauptstadt', 'Berlin oder Bundeshauptstadt')).toBe('correct');
    expect(verdict('a/b', 'a/b')).toBe('correct');
    expect(verdict('a', 'a/b')).toBe('wrong');
  });

  it('has working helpers', () => {
    expect(distance('kitten', 'sitting')).toBe(3);
    expect(normalize('Äußere')).toBe('aussere');
    expect(tokens('pi = 3.14.')).toEqual(['pi', '3.14']);
    expect(keyTokens('die ableitung von f')).toContain('ableitung');
    expect(keyTokens('die ableitung von f')).not.toContain('die');
  });
});
