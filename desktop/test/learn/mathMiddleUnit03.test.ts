import { describe, it } from 'vitest';
import { Expression, check, close, match, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';

/** Unit 3, Dezimalzahlen und Prozent: every answer is recomputed from the numbers in the prompt, and where there is a
 * base value, a rate and a part, the answer is plugged back in. */
const common = (p: Problem, expected: number): string | null => {
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return `typed answer ${typed} expected ${expected}`;
  const right = number(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  for (const option of optionsOf(p)) {
    const wrong = number(option);
    if (wrong === null) return `wrong option ${option}`;
    if (close(wrong, expected)) return `wrong option ${option} is right`;
  }
  return null;
};
const N = '(\\d+(?:,\\d+)?)';
const num = (s: string) => number(s) as number;

describe('math middle unit 3', () => {
  it('fractionToPercent', () => check('u03.fractionToPercent', (_l, p) => {
    const m = match('Wie viel Prozent sind (.+)\\?', p.prompt);
    const source = m ? number(m[1]) : null;
    if (!m || source === null) return 'prompt';
    if (p.pairFront !== m[1]) return 'pair front';
    if (!p.correct.endsWith(' %')) return 'unit';
    return common(p, source * 100);
  }));

  it('percentToDecimal', () => check('u03.percentToDecimal', (_l, p) => {
    const m = match('Schreibe (.+?) % als Dezimalzahl', p.prompt);
    const rate = m ? number(m[1]) : null;
    if (!m || rate === null) return 'prompt';
    if (p.pairFront !== `${m[1]} %`) return 'pair front';
    return common(p, rate / 100);
  }));

  it('decimalCalc', () => check('u03.decimalCalc', (level, p) => {
    const lines = p.prompt.split('\n');
    const expected = lines.length === 2 && lines[0] === 'Berechne:' ? Expression.evaluate(lines[1]) : null;
    if (expected === null) return 'expression';
    if (!(expected > 0)) return 'not positive';
    if (p.pairFront !== lines[1]) return 'pair front';
    const scaled = expected * 1000;
    if (!close(scaled, Math.round(scaled), 1e-7)) return `too many places: ${expected}`;
    if (level === 1 && (lines[1].includes('·') || lines[1].includes(':'))) return 'level 1 only adds and subtracts';
    return common(p, expected);
  }));

  it('percentValue', () => check('u03.percentValue', (_l, p) => {
    const m = match(`${N} % von ${N}`, p.prompt);
    if (!m) return 'prompt';
    return common(p, (num(m[1]) * num(m[2])) / 100);
  }));

  it('percentRate', () => check('u03.percentRate', (_l, p) => {
    const patterns = ['Wie viel Prozent sind (\\d+) von (\\d+)\\?', 'Von (\\d+) Schülern fehlen (\\d+)\\.', 'Lena erreicht (\\d+) von (\\d+) Punkten'];
    let found: { i: number; m: string[] } | null = null;
    patterns.forEach((pattern, i) => { const m = match(pattern, p.prompt); if (m && !found) found = { i, m }; });
    if (!found) return 'prompt';
    const { i, m } = found as { i: number; m: string[] };
    const [part, base] = i === 1 ? [Number(m[2]), Number(m[1])] : [Number(m[1]), Number(m[2])];
    if (!(part < base)) return 'part is not smaller';
    return common(p, (part / base) * 100);
  }));

  it('baseValue', () => check('u03.baseValue', (_l, p) => {
    let rate: number;
    let part: number;
    let m: string[] | null;
    if ((m = match(`${N} % einer Menge sind ${N}`, p.prompt))) { rate = num(m[1]); part = num(m[2]); }
    else if ((m = match(`Bei ${N} % Rabatt spart Tom ${N}`, p.prompt))) { rate = num(m[1]); part = num(m[2]); }
    else if ((m = match(`^${N} \\S+ sind ${N} % des Grundwerts`, p.prompt))) { rate = num(m[2]); part = num(m[1]); }
    else return 'prompt';
    const expected = (part * 100) / rate;
    if (!close((expected * rate) / 100, part)) return 'does not fit back';
    return common(p, expected);
  }));

  it('priceChange', () => check('u03.priceChange', (_l, p) => {
    const m = match(`kostet ${N} €\\.`, p.prompt);
    if (!m) return 'base';
    const base = num(m[1]);
    let factor: number;
    let r: string[] | null;
    if ((r = match(`steigt um ${N} %`, p.prompt))) factor = 1 + num(r[1]) / 100;
    else if ((r = match(`gibt ${N} % Rabatt`, p.prompt))) factor = 1 - num(r[1]) / 100;
    else return 'rate';
    return common(p, base * factor);
  }));

  it('percentChange', () => check('u03.percentChange', (_l, p) => {
    const m = match('(steigt|sinkt) von (\\d+) € auf (\\d+) €', p.prompt);
    if (!m) return 'prompt';
    const old = Number(m[2]);
    const now = Number(m[3]);
    if ((m[1] === 'steigt') !== now > old) return 'direction';
    const expected = (Math.abs(now - old) / old) * 100;
    if (!close(old * (1 + ((now > old ? 1 : -1) * expected) / 100), now)) return 'does not fit back';
    return common(p, expected);
  }));

  it('growthFactor', () => check('u03.growthFactor', (_l, p) => {
    const m = match(`Ein Wert (steigt|sinkt) um ${N} %`, p.prompt);
    if (!m) return 'prompt';
    const rate = num(m[2]);
    const expected = m[1] === 'steigt' ? 1 + rate / 100 : 1 - rate / 100;
    if (!close(100 * expected, m[1] === 'steigt' ? 100 + rate : 100 - rate)) return 'factor';
    return common(p, expected);
  }));

  it('vat', () => check('u03.vat', (level, p) => {
    let m = match(`netto ${N} €\\. Dazu kommen (\\d+) % Mehrwertsteuer`, p.prompt);
    if (m) {
      if (level >= 3) return 'level 3 goes backwards';
      return common(p, num(m[1]) * (1 + Number(m[2]) / 100));
    }
    m = match(`brutto ${N} €, darin sind (\\d+) % Mehrwertsteuer`, p.prompt);
    if (m) {
      if (level !== 3) return 'only level 3 goes backwards';
      const gross = num(m[1]);
      const rate = Number(m[2]);
      const expected = gross / (1 + rate / 100);
      if (!close(expected * (1 + rate / 100), gross)) return 'does not fit back';
      return common(p, expected);
    }
    return 'prompt';
  }));
});
