import { expect } from 'vitest';
import { MathGen, Problem, Template, problemOptions } from '../../src/lib/learn/math/middle/core';
import { catalog } from '../../src/lib/learn/math/middle/course';
import { NumberCheck } from '../../src/lib/learn/rational';

/**
 * Independent checks for the middle-school maths course. The kit re-reads the prompts the student sees and recomputes the
 * answers with floating point arithmetic, brute force and by plugging solutions back in, so a mistake in a template cannot
 * hide behind the code that made it.
 */
export interface Draw {
  level: number;
  seed: bigint;
  problem: Problem;
}

export const seeds: bigint[] = Array.from({ length: 300 }, (_, i) => BigInt(i + 1));

export function templateOf(id: string): Template {
  for (const unit of catalog) {
    const found = unit.find((t) => t.id === id);
    if (found) return found;
  }
  throw new Error(`No template ${id}`);
}

const cache = new Map<string, Draw[]>();

/** A template drawn at the three levels for every seed; draws that came out null are left out. Cached. */
export function draws(id: string): Draw[] {
  const cached = cache.get(id);
  if (cached) return cached;
  const t = templateOf(id);
  const result: Draw[] = [];
  for (let level = 1; level <= 3; level++) {
    for (const seed of seeds) {
      const gen = new MathGen(BigInt.asUintN(64, seed * 7919n + BigInt(level)));
      const problem = t.make(level, gen);
      if (problem) result.push({ level, seed, problem });
    }
  }
  cache.set(id, result);
  return result;
}

/** Runs a check on every draw of a template. The body returns a message for a wrong problem, null for a good one. */
export function check(id: string, body: (level: number, p: Problem) => string | null, minimumDraws = 30): void {
  const all = draws(id);
  expect(all.length, `${id} made too few problems`).toBeGreaterThanOrEqual(minimumDraws);
  const messages: string[] = [];
  for (const draw of all) {
    const message = body(draw.level, draw.problem);
    if (message !== null) messages.push(`${id} level ${draw.level} seed ${draw.seed}: ${message}\n  ${draw.problem.prompt.split('\n').join(' | ')}`);
  }
  if (messages.length > 0) throw new Error(`${messages.length} wrong problems in ${id}:\n${messages.slice(0, 6).join('\n')}`);
}

/** The capture groups of the first match, the whole match first; null without a match. */
export function match(pattern: string, text: string): string[] | null {
  const found = new RegExp(pattern, 'u').exec(text);
  return found ? [...found].map((g) => g ?? '') : null;
}

/** The capture groups of every match. */
export function matches(pattern: string, text: string): string[][] {
  return [...text.matchAll(new RegExp(pattern, 'gu'))].map((m) => [...m].map((g) => g ?? ''));
}

/** "12", "0,75" or "3/4" at the start of the text as a number; a unit, a percent sign or a degree sign after it is ignored, a mixed number "2 3/5" is read as 2.6. The minus sign is U+2212 or "-". */
export function number(text: string): number | null {
  const cleaned = text.split('−').join('-').split(',').join('.').trim();
  let m = match('^(-?)(\\d+) (\\d+)/(\\d+)', cleaned);
  if (m) {
    const value = Number(m[2]) + Number(m[3]) / Number(m[4]);
    return m[1] === '' ? value : -value;
  }
  m = match('^(-?)(\\d+(?:\\.\\d+)?)/(\\d+(?:\\.\\d+)?)', cleaned);
  if (m) {
    const denominator = Number(m[3]);
    if (denominator === 0) return null;
    const value = Number(m[2]) / denominator;
    return m[1] === '' ? value : -value;
  }
  m = match('^(-?)(\\d+(?:\\.\\d+)?)', cleaned);
  if (m) {
    const value = Number(m[2]);
    return m[1] === '' ? value : -value;
  }
  return null;
}

/** Every unsigned number or fraction "a/b" in the text, in order. A mixed number gives its whole part and its fraction separately. */
export const numbersIn = (text: string): number[] => matches('\\d+(?:,\\d+)?(?:/\\d+(?:,\\d+)?)?', text).flatMap((m) => { const n = number(m[0]); return n === null ? [] : [n]; });

/** The whole numbers in the text, in order. */
export const integersIn = (text: string): number[] => matches('\\d+', text).map((m) => Number(m[0]));

export const close = (a: number, b: number, tolerance = 1e-9): boolean => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

/** The greatest common divisor found by trying every divisor, not by Euclid's algorithm. */
export function bruteGCD(a: number, b: number): number {
  if (!(a > 0 && b > 0)) return Math.max(a, b);
  for (let d = Math.min(a, b); d >= 1; d--) if (a % d === 0 && b % d === 0) return d;
  return 1;
}

/** The least common multiple found by counting up. */
export function bruteLCM(a: number, b: number): number {
  let multiple = Math.max(a, b);
  while (multiple % a !== 0 || multiple % b !== 0) multiple += Math.max(a, b);
  return multiple;
}

/** The typed answer of a problem as a number. */
export const typedAnswer = (p: Problem): number | null => (p.typed ? p.typed.answer.value : null);

export const optionsOf = problemOptions;

/** A number the answer check accepts, written the way a student might: the value of the typed answer. */
export const accepts = (p: Problem, text: string): boolean => (p.typed ? NumberCheck.matches(text, p.typed.answer.fractionText) : false);

const sup: Record<string, number> = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isLetter = (c: string) => /\p{L}/u.test(c);

/** A small reader for the expressions in the prompts: numbers (3, 0,75, 3/4, 2 3/4), + − · : and brackets, powers like ² and ⁻³, √, letters as variables, and 3x or 2(x + 1) as products. It computes with floating point, so it checks the course's exact answers by another route. */
export class Expression {
  private chars: string[];
  private index = 0;

  private constructor(text: string, private variables: Record<string, number>) {
    this.chars = [...text.split('−').join('-')];
  }

  static evaluate(text: string, variables: Record<string, number> = {}): number | null {
    const reader = new Expression(text, variables);
    const value = reader.expression();
    if (value === null) return null;
    reader.skipSpaces();
    return reader.index === reader.chars.length && Number.isFinite(value) ? value : null;
  }

  /** Whether both sides of "left = right" have the same value for the variable x. */
  static holds(equation: string, x: number): boolean | null {
    const sides = equation.split(' = ');
    if (sides.length !== 2) return null;
    const left = Expression.evaluate(sides[0], { x });
    const right = Expression.evaluate(sides[1], { x });
    if (left === null || right === null) return null;
    return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
  }

  private get peek(): string | undefined { return this.chars[this.index] as string | undefined; }
  private peekAt(offset: number): string | undefined { return this.chars[this.index + offset]; }
  private skipSpaces() { while (this.peek === ' ') this.index++; }

  private expression(): number | null {
    this.skipSpaces();
    let sign = 1;
    if (this.peek === '-') { this.index++; sign = -1; } else if (this.peek === '+') this.index++;
    const first = this.term();
    if (first === null) return null;
    let value = sign * first;
    for (;;) {
      this.skipSpaces();
      const c = this.peek;
      if (c !== '+' && c !== '-') return value;
      this.index++;
      const rhs = this.term();
      if (rhs === null) return null;
      value = c === '+' ? value + rhs : value - rhs;
    }
  }

  private term(): number | null {
    this.skipSpaces();
    let value = this.product();
    if (value === null) return null;
    for (;;) {
      this.skipSpaces();
      const c = this.peek;
      if (c !== '·' && c !== ':') return value;
      this.index++;
      this.skipSpaces();
      const rhs = this.product();
      if (rhs === null) return null;
      if (c === ':') {
        if (rhs === 0) return null;
        value /= rhs;
      } else value *= rhs;
    }
  }

  /** Factors written right next to each other are multiplied: 3x, 2(x + 1), (x − 2)(x + 5). */
  private product(): number | null {
    let value = this.quotient();
    if (value === null) return null;
    for (;;) {
      const c = this.peek;
      if (!(c === '(' || c === '√' || c === 'π' || (c !== undefined && isLetter(c) && this.variables[c] !== undefined))) break;
      const rhs = this.quotient();
      if (rhs === null) return null;
      value *= rhs;
    }
    return value;
  }

  private quotient(): number | null {
    let value = this.power();
    if (value === null) return null;
    if (this.peek === '/') {
      this.index++;
      const rhs = this.power();
      if (rhs === null || rhs === 0) return null;
      value /= rhs;
    }
    return value;
  }

  private power(): number | null {
    let base = this.atom();
    if (base === null) return null;
    for (;;) {
      const c = this.peek;
      if (!(c === '⁻' || (c !== undefined && sup[c] !== undefined))) break;
      let negative = false;
      if (c === '⁻') { negative = true; this.index++; }
      let exponent = 0;
      let digits = 0;
      while (this.peek !== undefined && sup[this.peek] !== undefined) { exponent = exponent * 10 + sup[this.peek!]; digits++; this.index++; }
      if (digits === 0) return null;
      base = base ** (negative ? -exponent : exponent);
    }
    return base;
  }

  private atom(): number | null {
    const c = this.peek;
    if (c === undefined) return null;
    if (c === '(') {
      this.index++;
      const value = this.expression();
      if (value === null) return null;
      this.skipSpaces();
      if (this.peek !== ')') return null;
      this.index++;
      return value;
    }
    if (c === '√') {
      this.index++;
      const value = this.atom();
      if (value === null || value < 0) return null;
      return Math.sqrt(value);
    }
    if (c === 'π') { this.index++; return Math.PI; }
    if (isDigit(c)) return this.numberValue();
    if (isLetter(c) && this.variables[c] !== undefined) { this.index++; return this.variables[c]; }
    return null;
  }

  private digits(): string {
    let text = '';
    while (isDigit(this.peek)) { text += this.peek; this.index++; }
    return text;
  }

  private numberValue(): number | null {
    let text = this.digits();
    if (this.peek === ',' && isDigit(this.peekAt(1))) {
      this.index++;
      text += `.${this.digits()}`;
    }
    const value = Number(text);
    if (Number.isNaN(value)) return null;
    // A mixed number: a whole number, a space, then a fraction.
    if (!text.includes('.') && this.peek === ' ' && isDigit(this.peekAt(1))) {
      const start = this.index;
      this.index++;
      const numerator = this.digits();
      if ((this.peekAt(0) as string | undefined) === '/' && isDigit(this.peekAt(1))) {
        this.index++;
        const denominator = this.digits();
        const n = Number(numerator);
        const d = Number(denominator);
        if (d !== 0) return value + n / d;
      }
      this.index = start;
    }
    return value;
  }
}
