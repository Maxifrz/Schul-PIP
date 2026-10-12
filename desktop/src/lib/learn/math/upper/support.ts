// Typical mistakes when differentiating or integrating a polynomial term by term (the wrong options of the calculus
// questions are computed from these) and small helpers. A port of MathUpperSupport.swift.

import { UPoly, UQ, UText, type UGen } from './core';

/** noMultiply: the exponent is lowered but the factor is forgotten (4x³ becomes 4x²). noLower: the factor is taken but
 * the exponent stays (4x³ becomes 12x³). keepConstant: a constant stays instead of vanishing. integrate: the
 * antiderivative is formed instead. */
export type UMistake = 'noMultiply' | 'noLower' | 'keepConstant' | 'integrate';

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
          if (k >= 1) terms.push([k, value.times(new UQ(k))]);
          break;
        case 'keepConstant':
          if (k === 0) terms.push([0, value]);
          else terms.push([k - 1, value.times(new UQ(k))]);
          break;
        case 'integrate':
          terms.push([k + 1, value.div(new UQ(k + 1))]);
          break;
      }
    });
    return UPoly.terms(terms);
  },

  fx(f: UPoly, name: string = 'f'): string {
    return `${name}(x) = ` + f.text;
  },

  /** A polynomial that grows in size with the level. */
  poly(g: UGen, level: number): UPoly {
    for (let i = 0; i < 30; i++) {
      let p: UPoly;
      switch (level) {
        case 1:
          p = g.poly(2, g.int(1, 2), [1, 4]);
          break;
        case 2:
          p = g.poly(g.int(2, 3), g.int(2, 3), [1, 5]);
          break;
        default:
          p = g.poly(g.int(3, 4), g.int(3, 4), [1, 5]);
      }
      if (p.derivative.degree >= 1) return p;
    }
    return UPoly.ints([1, 2, 3]);
  },

  /** Rounds a list of wrong numbers: only those that differ from the answer (and from each other). */
  differing(list: readonly UQ[], from: UQ): UQ[] {
    const seen = new Set<string>([from.id]);
    return list.filter((value) => {
      if (seen.has(value.id)) return false;
      seen.add(value.id);
      return true;
    });
  },
};

/** A whole number in brackets when it is negative. */
export const UCalc3 = {
  bracket(n: number): string {
    return n < 0 ? `(${UText.signed(n)})` : `${n}`;
  },
};
