import { describe, expect, it } from 'vitest';
import { accepts, check, close, integersIn, match, matches, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';
import { NumberCheck } from '../../src/lib/learn/rational';

/** Unit 10, Wahrscheinlichkeit: every prompt is read back and the probability is found again by listing all outcomes
 * (balls as indices, pairs of dice, every success/failure sequence), with floating point. */
const plain = (text: string) => text.split('\n').join(' ');

/** The right option and the typed answer equal `expected`; the wrong options are other numbers, and a probability
 * strictly between 0 and 1 unless `percent`. The typed answer accepts an unreduced fraction and a decimal. */
function verify(p: Problem, expected: number, percent = false): string | null {
  const right = number(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return `typed answer ${typed}`;
  for (const option of optionsOf(p)) {
    const value = number(option);
    if (value === null) return `wrong option ${option}`;
    if (close(value, expected)) return `wrong option ${option} is right`;
    if (!percent && (value <= 0 || value >= 1)) return `wrong option ${option} is not a probability`;
  }
  const answer = p.typed?.answer;
  if (!answer) return 'no typed answer';
  if (!percent) {
    const hint = p.typed?.prompt ?? '';
    if (!(hint.includes('Bruch oder Dezimalzahl') || hint.includes('Dezimalzahl oder Bruch'))) return 'the typed prompt names the forms';
    const unreduced = `${answer.numerator * 3}/${answer.denominator * 3}`;
    if (!accepts(p, unreduced)) return `unreduced ${unreduced} not accepted`;
    let rest = answer.denominator;
    for (const prime of [2, 5]) while (rest % prime === 0) rest /= prime;
    if (rest === 1) {
      const decimal = String(Number(expected.toPrecision(9))).replace('.', ',');
      if (!accepts(p, decimal)) return `decimal ${decimal} not accepted`;
    }
    if (!accepts(p, p.correct)) return `${p.correct} not accepted`;
    if (accepts(p, `${answer.numerator + 1}/${answer.denominator}`)) return 'a wrong fraction is accepted';
  }
  return null;
}

const isPrimeFace = (face: number) => face > 1 && Array.from({ length: Math.max(0, face - 2) }, (_, i) => i + 2).every((d) => face % d !== 0);

describe('math middle unit 10', () => {
  it('dieEvent', () => check('u10.dieEvent', (level, p) => {
    const text = plain(p.prompt);
    const m = match('dass die Zahl (.+) ist\\?$', text);
    if (!m) return 'prompt';
    const s = match('Zahlen 1 bis (\\d+)', text);
    const sides = s ? Number(s[1]) : 6;
    if (level === 1 && sides !== 6) return 'level 1 is the ordinary die';
    let count = 0;
    for (let face = 1; face <= sides; face++) {
      const phrase = m[1];
      let hit: boolean;
      let g: string[] | null;
      if ((g = match('^größer als (\\d+)$', phrase))) hit = face > Number(g[1]);
      else if ((g = match('^kleiner als (\\d+)$', phrase))) hit = face < Number(g[1]);
      else if (phrase === 'gerade') hit = face % 2 === 0;
      else if (phrase === 'ungerade') hit = face % 2 === 1;
      else if (phrase === 'eine Primzahl') hit = isPrimeFace(face);
      else if ((g = match('^durch (\\d+) teilbar$', phrase))) hit = face % Number(g[1]) === 0;
      else return `event ${phrase}`;
      if (hit) count += 1;
    }
    return verify(p, count / sides);
  }));

  it('urn', () => check('u10.urn', (level, p) => {
    const text = plain(p.prompt);
    const contents = matches('(\\d+) (rote|blaue|grüne|gelbe)', text.split(' Du ziehst')[0] ?? '');
    const ask = match('für eine (\\p{L}+)(?: oder eine (\\p{L}+))? Kugel\\?', text);
    if (contents.length < 2 || !ask) return 'prompt';
    if (level === 1 && contents.length !== 2) return 'two colours at level 1';
    const balls: string[] = [];
    for (const entry of contents) for (let i = 0; i < Number(entry[1]); i++) balls.push(entry[2]);
    const asked = [ask[1], ask[2]].filter((s) => s !== '');
    if (!asked.every((name) => contents.some((c) => c[2] === name))) return 'asked colour is not in the bag';
    const hits = balls.filter((b) => asked.includes(b)).length;
    if (hits <= 0 || hits >= balls.length) return 'impossible or certain';
    return verify(p, hits / balls.length);
  }));

  it('frequency', () => check('u10.frequency', (_l, p) => {
    const first = plain(p.prompt).split(' Wie groß')[0] ?? '';
    const numbers = integersIn(first);
    if (numbers.length !== 2 || numbers[1] >= numbers[0]) return 'prompt';
    return verify(p, numbers[1] / numbers[0]);
  }));

  it('range', () => check('u10.range', (_l, p) => {
    const isProbability = (text: string): boolean => {
      const value = number(text);
      if (value === null) return false;
      const scaled = text.includes('%') ? value / 100 : value;
      const negative = text.startsWith('−') || text.startsWith('-');
      return !negative && scaled >= 0 && scaled <= 1;
    };
    if (isProbability(p.correct)) return `the right option ${p.correct} is a probability`;
    const options = optionsOf(p);
    for (const option of options) if (!isProbability(option)) return `wrong option ${option} is no probability`;
    return options.length >= 3 ? null : `only ${options.length} probabilities`;
  }));

  it('complement', () => check('u10.complement', (level, p) => {
    const text = plain(p.prompt);
    if (text.includes('weder Rot noch Blau')) {
      const m = match('Rot (\\d+)/(\\d+) und für Blau (\\d+)/(\\d+)\\.', text);
      if (level !== 3 || !m) return 'prompt';
      const a = Number(m[1]) / Number(m[2]);
      const b = Number(m[3]) / Number(m[4]);
      if (!(a + b < 1)) return 'the two colours leave nothing';
      return verify(p, 1 - a - b);
    }
    let m = match('von (\\d+) %\\.', text);
    if (m) {
      if (level < 2) return 'percent from level 2';
      if (!p.correct.endsWith(' %')) return 'percent sign';
      return verify(p, 100 - Number(m[1]), true);
    }
    m = match('mit der Wahrscheinlichkeit (\\d+)/(\\d+)\\.', text);
    if (m) {
      const value = Number(m[1]) / Number(m[2]);
      if (!(value > 0 && value < 1)) return 'not a proper probability';
      return verify(p, 1 - value);
    }
    return 'prompt';
  }));

  it('twoDice', () => check('u10.twoDice', (level, p) => {
    const text = plain(p.prompt);
    const m = match('Wahrscheinlichkeit\\? (.+)\\.$', text);
    if (!m) return 'prompt';
    const event = m[1];
    let count = 0;
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        let hit: boolean;
        let g: string[] | null;
        if ((g = match('^Die Augensumme ist (\\d+)$', event))) hit = a + b === Number(g[1]);
        else if ((g = match('^Die Augensumme ist mindestens (\\d+)$', event))) hit = a + b >= Number(g[1]);
        else if ((g = match('^Die Augensumme ist höchstens (\\d+)$', event))) hit = a + b <= Number(g[1]);
        else if ((g = match('^Das Produkt der Zahlen ist (\\d+)$', event))) hit = a * b === Number(g[1]);
        else if (event === 'Beide Würfel zeigen dieselbe Zahl') hit = a === b;
        else if (event === 'Beide Zahlen sind gerade') hit = a % 2 === 0 && b % 2 === 0;
        else if (event === 'Mindestens ein Würfel zeigt eine 6') hit = a === 6 || b === 6;
        else if (event === 'Das Produkt der Zahlen ist gerade') hit = (a * b) % 2 === 0;
        else if (event === 'Die Zahlen unterscheiden sich um genau 2') hit = Math.abs(a - b) === 2;
        else if (event === 'Die Zahlen sind verschieden') hit = a !== b;
        else if (event === 'Die Augensumme ist eine Primzahl') hit = [2, 3, 5, 7, 11].includes(a + b);
        else return `event ${event}`;
        if (hit) count += 1;
      }
    }
    if (level === 1 && !(event.startsWith('Die Augensumme ist ') || event.startsWith('Beide Würfel'))) return 'level 1 events';
    return verify(p, count / 36);
  }));

  it('expected', () => check('u10.expected', (_l, p) => {
    const text = plain(p.prompt);
    const shown = match('Wahrscheinlichkeit (\\d+/\\d+|\\d+ %)[ .]', text);
    const trials = match('(?:(\\d+)-mal|werden (\\d+) Teile)', text);
    if (!shown || !trials) return 'prompt';
    const probability = shown[1].endsWith('%') ? number(shown[1])! / 100 : number(shown[1])!;
    const n = Number(trials[1] === '' ? trials[2] : trials[1]);
    const expected = probability * n;
    if (!close(expected, Math.round(expected)) || expected < 1) return 'expected count is not a whole number';
    return verify(p, expected, true);
  }));

  /** The balls of the bag in the prompt: "R rote und B blaue Kugeln". */
  const bag = (text: string): string[] | null => {
    const m = match('(\\d+) rote und (\\d+) blaue Kugeln', text);
    return m ? [...Array(Number(m[1])).fill('r'), ...Array(Number(m[2])).fill('b')] : null;
  };

  /** The share of the ordered draws of two balls, each ball one index, for which the test holds. */
  function share(balls: string[], replacing: boolean, test: (a: string, b: string) => boolean): number {
    let total = 0;
    let hits = 0;
    balls.forEach((x, i) => balls.forEach((y, j) => {
      if (!replacing && i === j) return;
      total += 1;
      if (test(x, y)) hits += 1;
    }));
    return hits / total;
  }

  it('withReplacement', () => check('u10.withReplacement', (level, p) => {
    const text = plain(p.prompt);
    const balls = bag(text);
    const m = match('dass (.+)\\?$', text);
    if (!balls || !text.includes('legst die Kugel nach jedem Zug zurück') || !m) return 'prompt';
    let test: (a: string, b: string) => boolean;
    switch (m[1]) {
      case 'beide Kugeln sind rot': test = (a, b) => a === 'r' && b === 'r'; break;
      case 'beide Kugeln sind blau': test = (a, b) => a === 'b' && b === 'b'; break;
      case 'die erste Kugel ist rot und die zweite blau': test = (a, b) => a === 'r' && b === 'b'; break;
      case 'beide Kugeln haben dieselbe Farbe':
        if (level !== 3) return 'same colour at level 3';
        test = (a, b) => a === b;
        break;
      default: return `event ${m[1]}`;
    }
    return verify(p, share(balls, true, test));
  }));

  it('withoutReplacement', () => check('u10.withoutReplacement', (level, p) => {
    const text = plain(p.prompt);
    const balls = bag(text);
    const m = match('dass (.+)\\?$', text);
    if (!balls || !text.includes('ohne zurückzulegen') || !m) return 'prompt';
    let test: (a: string, b: string) => boolean;
    switch (m[1]) {
      case 'beide Kugeln sind rot': test = (a, b) => a === 'r' && b === 'r'; break;
      case 'beide Kugeln sind blau': test = (a, b) => a === 'b' && b === 'b'; break;
      case 'die erste Kugel ist rot und die zweite blau': test = (a, b) => a === 'r' && b === 'b'; break;
      case 'mindestens eine Kugel ist rot':
        if (level !== 3) return 'at least one at level 3';
        test = (a, b) => a === 'r' || b === 'r';
        break;
      default: return `event ${m[1]}`;
    }
    return verify(p, share(balls, false, test));
  }));

  it('twoPaths', () => check('u10.twoPaths', (_l, p) => {
    const text = plain(p.prompt);
    const balls = bag(text);
    if (!balls || !text.includes('zwei verschiedene Farben')) return 'prompt';
    const replacing = text.includes('legst die Kugel nach jedem Zug zurück');
    if (!(replacing || text.includes('ohne zurückzulegen'))) return 'kind of draw';
    return verify(p, share(balls, replacing, (a, b) => a !== b));
  }));

  it('atLeastOne', () => check('u10.atLeastOne', (level, p) => {
    const text = plain(p.prompt);
    let success: number;
    let trials: number;
    let m: string[] | null;
    if ((m = match('Du wirfst eine Münze (\\d+)-mal', text))) [success, trials] = [0.5, Number(m[1])];
    else if ((m = match('Du würfelst (\\d+)-mal', text))) [success, trials] = [1 / 6, Number(m[1])];
    else if ((m = match('Wahrscheinlichkeit 1/(\\d+)\\. Du drehst (\\d+)-mal', text))) [success, trials] = [1 / Number(m[1]), Number(m[2])];
    else return 'prompt';
    if (level === 1 && trials > 3) return 'few trials at level 1';
    // Every sequence of hits and misses, the probabilities multiplied along it.
    let total = 0;
    for (let mask = 1; mask < 1 << trials; mask++) {
      let chance = 1;
      for (let bit = 0; bit < trials; bit++) chance *= (mask >> bit) & 1 ? success : 1 - success;
      total += chance;
    }
    return verify(p, total);
  }));

  it('the typed forms are accepted', () => {
    for (const text of ['3/4', '0,75', '6/8', '0.75']) expect(NumberCheck.matches(text, '3/4'), text).toBe(true);
    expect(NumberCheck.matches('3/5', '3/4')).toBe(false);
  });
});
