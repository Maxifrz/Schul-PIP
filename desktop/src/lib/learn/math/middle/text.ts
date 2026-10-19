import type { Q } from './core';

export const minus = '−';

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
};

export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;

const superscripts: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const subscripts: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const unicodeMinus = (text: string) => text.split('-').join(minus);
const trunc = Math.trunc;

/** Maths text the way a student reads it in the app: − (U+2212) for minus, · for times, : for divided by, ² ³ for powers, fractions as 3/4, the decimal comma. */
export const mathText = {
  minus,
  gcd,
  lcm,

  /** "−5", "0", "12". */
  int(n: number): string {
    return n < 0 ? minus + String(-n) : String(n);
  },

  /** With the sign in front, also for plus: "+5", "−5". */
  signed(n: number): string {
    return n < 0 ? minus + String(-n) : `+${n}`;
  },

  /** A fraction as "3/4" or "−3/4", a whole number as "2". */
  fraction(q: Q): string {
    return unicodeMinus(q.value.fractionText);
  },

  /** A fraction with the numerator and denominator as given, not reduced. */
  fractionOf(numerator: number, denominator: number): string {
    return `${mathText.int(numerator)}/${denominator}`;
  },

  /** A number with the decimal comma when its decimal ends ("0,75"), else a fraction ("1/3"). */
  number(q: Q): string {
    return unicodeMinus(q.value.germanText);
  },

  /** A mixed number "2 3/5", "−1 1/2"; a proper fraction or a whole number as is. */
  mixed(q: Q): string {
    const value = q.value;
    if (value.isWhole || Math.abs(value.numerator) <= value.denominator) return mathText.fraction(q);
    const whole = trunc(Math.abs(value.numerator) / value.denominator);
    const rest = Math.abs(value.numerator) % value.denominator;
    return `${value.numerator < 0 ? minus : ''}${whole} ${rest}/${value.denominator}`;
  },

  /** An exponent in superscript digits: 2 gives "²", −3 gives "⁻³". */
  sup(n: number): string {
    return [...String(n)].map((c) => superscripts[c] ?? c).join('');
  },

  /** An index in subscript digits: 1 gives "₁". */
  sub(n: number): string {
    return [...String(n)].map((c) => subscripts[c] ?? c).join('');
  },

  /** "3⁴", "(−2)³": a negative base gets brackets. */
  power(base: number, exponent: number): string {
    return (base < 0 ? `(${mathText.int(base)})` : String(base)) + mathText.sup(exponent);
  },

  /** A power of a letter or a bracket: "x³", "a⁻²". */
  powerOf(base: string, exponent: number): string {
    return base + mathText.sup(exponent);
  },

  /** A polynomial from its coefficients, the highest power first: `[2, -3, 1]` with "x" gives "2x² − 3x + 1". Zero terms are left out; all zero gives "0". */
  polynomial(coefficients: number[], variable = 'x'): string {
    const monomial = (coefficient: number, name: string): string => {
      if (name === '') return mathText.int(coefficient);
      if (coefficient === 1) return name;
      if (coefficient === -1) return minus + name;
      return mathText.int(coefficient) + name;
    };
    let text = '';
    const top = coefficients.length - 1;
    coefficients.forEach((coefficient, index) => {
      if (coefficient === 0) return;
      const power = top - index;
      const name = power === 0 ? '' : power === 1 ? variable : variable + mathText.sup(power);
      const piece = monomial(Math.abs(coefficient), name);
      if (text === '') text = (coefficient < 0 ? minus : '') + piece;
      else text += (coefficient < 0 ? ` ${minus} ` : ' + ') + piece;
    });
    return text === '' ? '0' : text;
  },

  /** "2x − 3", "−x + 4", "5". */
  linear(a: number, b: number, variable = 'x'): string {
    return mathText.polynomial([a, b], variable);
  },

  /** "y = 2x − 3". */
  line(m: number, b: number): string {
    return `y = ${mathText.linear(m, b)}`;
  },

  /** A term with a bracket: "3(x − 4)" from the factor and the bracket content. */
  bracket(factor: number, inside: string): string {
    return (factor === 1 ? '' : factor === -1 ? minus : mathText.int(factor)) + `(${inside})`;
  },

  /** The decimal text of a number with exactly `places` digits after the comma: 3.5 with 2 places gives "3,50". */
  fixed(q: Q, places: number): string {
    const scale = 10 ** places;
    const scaled = trunc((q.numerator * scale) / q.denominator);
    const sign = scaled < 0 ? minus : '';
    let digits = String(Math.abs(scaled));
    while ([...digits].length <= places) digits = `0${digits}`;
    const cut = digits.length - places;
    return places === 0 ? sign + digits : `${sign}${digits.slice(0, cut)},${digits.slice(cut)}`;
  },

  /** Euros with two decimals: "9,60 €". */
  euro(q: Q): string {
    return `${mathText.fixed(q, 2)} €`;
  },

  /** A price: "92 €" when it is a whole number of euros, else with cents ("37,50 €"). */
  euroAmount(q: Q): string {
    if (q.isWhole) return `${mathText.int(q.numerator)} €`;
    return 100 % q.denominator === 0 ? mathText.euro(q) : `${mathText.number(q)} €`;
  },

  /** A quantity the way it is written in a text: with the decimal comma when that ends, else as a mixed number. */
  amount(q: Q): string {
    const decimal = mathText.number(q);
    return decimal.includes('/') ? mathText.mixed(q) : decimal;
  },

  /** A list the German way: "a", "a und b", "a, b und c". */
  listed(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
  },

  /** A number in a calculation: a negative one gets brackets, "(−3)". */
  bracketed(n: number): string {
    return n < 0 ? `(${mathText.int(n)})` : String(n);
  },

  /** A whole number with a thin space between the thousands, as it is written in Germany: 50 000. */
  grouped(n: number): string {
    const digits = String(Math.abs(n));
    let result = n < 0 ? minus : '';
    [...digits].forEach((c, index) => {
      if (index > 0 && (digits.length - index) % 3 === 0) result += ' ';
      result += c;
    });
    return result;
  },

  /** A sum or difference with the sign in front of the second summand: "x + 3", "x − 3". */
  plusMinus(n: number): string {
    return n < 0 ? `${minus} ${-n}` : `+ ${n}`;
  },
};
