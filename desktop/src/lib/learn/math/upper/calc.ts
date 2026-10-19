import { UGen, UPoly, UQ, uq } from './core';

/** Typical mistakes when differentiating or integrating a polynomial term by term; the wrong options of the calculus questions are computed from these. */
export type UMistake =
  /** The exponent is lowered but the factor is forgotten: 4x³ becomes 4x². */
  | 'noMultiply'
  /** The factor is taken but the exponent stays: 4x³ becomes 12x³. */
  | 'noLower'
  /** A constant stays instead of vanishing. */
  | 'keepConstant'
  /** The antiderivative is formed instead. */
  | 'integrate';

export const UCalc = {
  mistaken(f: UPoly, mistake: UMistake): UPoly {
    const terms: [number, UQ][] = [];
    f.c.forEach((value, k) => {
      if (value.isZero) return;
      switch (mistake) {
        case 'noMultiply':
          if (k >= 1) terms.push([k - 1, value]);
          break;
        case 'noLower':
          if (k >= 1) terms.push([k, value.times(uq(k))]);
          break;
        case 'keepConstant':
          terms.push(k === 0 ? [0, value] : [k - 1, value.times(uq(k))]);
          break;
        case 'integrate':
          terms.push([k + 1, value.div(uq(k + 1))]);
          break;
      }
    });
    return UPoly.ofTerms(terms);
  },

  fx(f: UPoly, name = 'f'): string { return `${name}(x) = ${f.text}`; },

  /** A polynomial that grows in size with the level. */
  poly(g: UGen, level: number): UPoly {
    for (let i = 0; i < 30; i++) {
      let p: UPoly;
      switch (level) {
        case 1: p = g.poly(2, g.int(1, 2), [1, 4]); break;
        case 2: p = g.poly(g.int(2, 3), g.int(2, 3), [1, 5]); break;
        default: p = g.poly(g.int(3, 4), g.int(3, 4), [1, 5]);
      }
      if (p.derivative.degree >= 1) return p;
    }
    return UPoly.ofInts([1, 2, 3]);
  },

  /** Rounds a list of wrong numbers: only those that differ from the answer. */
  differing(list: UQ[], from: UQ): UQ[] {
    const seen = new Set<string>([from.key]);
    return list.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  },
};
