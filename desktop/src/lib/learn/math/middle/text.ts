// Maths text the way a student reads it in the app: − (U+2212) for minus, · for times, : for divided by, ² ³ for
// powers, fractions as 3/4, the decimal comma. A port of MathMiddleText (MathMiddleText.swift and the extensions of
// MathMiddleSupport.swift). Swift `Int` division truncates toward zero; `div` does the same.

import type { Q } from './core';

export const minus = '−';

/** Swift's Int `/`: truncates toward zero. */
export function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** "−5", "0", "12". */
export function int(n: number): string {
  return n < 0 ? minus + String(-n) : String(n);
}

/** With the sign in front, also for plus: "+5", "−5". */
export function signed(n: number): string {
  return n < 0 ? minus + String(-n) : '+' + String(n);
}

function unicodeMinus(text: string): string {
  return text.split('-').join(minus);
}

/** A fraction as "3/4" or "−3/4", a whole number as "2". */
export function fraction(q: Q): string;
/** A fraction with the numerator and denominator as given, not reduced. */
export function fraction(numerator: number, denominator: number): string;
export function fraction(a: Q | number, b?: number): string {
  if (typeof a === 'number') return int(a) + '/' + String(b);
  return unicodeMinus(a.value.fractionText);
}

/** A number with the decimal comma when its decimal ends ("0,75"), else a fraction ("1/3"). */
export function number(q: Q): string {
  return unicodeMinus(q.value.germanText);
}

/** A mixed number "2 3/5", "−1 1/2"; a proper fraction or a whole number as is. */
export function mixed(q: Q): string {
  const value = q.value;
  const n = Number(value.numerator);
  const d = Number(value.denominator);
  if (value.isWhole || !(Math.abs(n) > d)) return fraction(q);
  const whole = div(Math.abs(n), d);
  const rest = Math.abs(n) % d;
  return (n < 0 ? minus : '') + `${whole} ${rest}/${d}`;
}

// Powers

const superscripts: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};
const subscripts: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

/** An exponent in superscript digits: 2 gives "²", −3 gives "⁻³". */
export function sup(n: number): string {
  return Array.from(String(n)).map((c) => superscripts[c] ?? c).join('');
}

/** An index in subscript digits: 1 gives "₁". */
export function sub(n: number): string {
  return Array.from(String(n)).map((c) => subscripts[c] ?? c).join('');
}

/** "3⁴", "(−2)³": a negative base gets brackets. */
export function power(base: number | string, exponent: number): string {
  // A string base is a letter or a bracket: "x³", "a⁻²".
  if (typeof base === 'string') return base + sup(exponent);
  return (base < 0 ? '(' + int(base) + ')' : String(base)) + sup(exponent);
}

// Terms

function monomial(coefficient: number, variable: string): string {
  if (variable === '') return int(coefficient);
  switch (coefficient) {
    case 1:
      return variable;
    case -1:
      return minus + variable;
    default:
      return int(coefficient) + variable;
  }
}

/** A polynomial from its coefficients, the highest power first: `[2, -3, 1]` with "x" gives "2x² − 3x + 1". Zero
 * terms are left out; all zero gives "0". */
export function polynomial(coefficients: number[], variable = 'x'): string {
  let text = '';
  const top = coefficients.length - 1;
  coefficients.forEach((coefficient, index) => {
    if (coefficient === 0) return;
    const p = top - index;
    const name = p === 0 ? '' : p === 1 ? variable : variable + sup(p);
    const piece = monomial(Math.abs(coefficient), name);
    if (text === '') {
      text = (coefficient < 0 ? minus : '') + piece;
    } else {
      text += (coefficient < 0 ? ` ${minus} ` : ' + ') + piece;
    }
  });
  return text === '' ? '0' : text;
}

/** "2x − 3", "−x + 4", "5". */
export function linear(a: number, b: number, variable = 'x'): string {
  return polynomial([a, b], variable);
}

/** "y = 2x − 3". */
export function line(m: number, b: number): string {
  return 'y = ' + linear(m, b);
}

/** A term with a bracket: "3(x − 4)" from the factor and the bracket content. */
export function bracket(factor: number, inside: string): string {
  return (factor === 1 ? '' : factor === -1 ? minus : int(factor)) + '(' + inside + ')';
}

/** The decimal text of a number with exactly `places` digits after the comma: 3.5 with 2 places gives "3,50". */
export function fixed(q: Q, places: number): string {
  let scale = 1;
  for (let i = 0; i < places; i++) scale *= 10;
  const scaled = div(q.numerator * scale, q.denominator);
  const sign = scaled < 0 ? minus : '';
  let digits = String(Math.abs(scaled));
  while (digits.length <= places) digits = '0' + digits;
  const cut = digits.length - places;
  return places === 0 ? sign + digits : sign + digits.slice(0, cut) + ',' + digits.slice(cut);
}

/** Euros with two decimals: "9,60 €". */
export function euro(q: Q): string {
  return fixed(q, 2) + ' €';
}

/** A price: "92 €" when it is a whole number of euros, else with cents ("37,50 €"). */
export function euroAmount(q: Q): string {
  if (q.isWhole) return int(q.numerator) + ' €';
  return 100 % q.denominator === 0 ? euro(q) : number(q) + ' €';
}

/** Greatest common divisor of two whole numbers. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/** Least common multiple of two positive whole numbers. */
export function lcm(a: number, b: number): number {
  return div(a, gcd(a, b)) * b;
}

// From MathMiddleSupport.swift

/** A quantity the way it is written in a text: with the decimal comma when that ends, else as a mixed number. */
export function amount(q: Q): string {
  const decimal = number(q);
  return decimal.includes('/') ? mixed(q) : decimal;
}

/** A list the German way: "a", "a und b", "a, b und c". */
export function listed(items: string[]): string {
  if (items.length === 0) return '';
  const last = items[items.length - 1];
  if (items.length === 1) return last;
  return items.slice(0, -1).join(', ') + ' und ' + last;
}

/** A number in a calculation: a negative one gets brackets, "(−3)". */
export function bracketed(n: number): string {
  return n < 0 ? '(' + int(n) + ')' : String(n);
}

/** A whole number with a thin space between the thousands, as it is written in Germany: 50 000. */
export function grouped(n: number): string {
  const digits = String(Math.abs(n));
  let result = n < 0 ? minus : '';
  Array.from(digits).forEach((character, index) => {
    if (index > 0 && (digits.length - index) % 3 === 0) result += ' ';
    result += character;
  });
  return result;
}

/** A sum or difference with the sign in front of the second summand: "x + 3", "x − 3". */
export function plusMinus(n: number): string {
  return n < 0 ? `${minus} ${-n}` : `+ ${n}`;
}
