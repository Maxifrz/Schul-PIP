// Independent checks for the middle-school maths course (port of MathMiddleTestKit and MathMiddleTestExpression in
// LernwerkTests/MathCourseMiddleTests.swift). The kit re-reads the prompts the student sees and recomputes the answers
// with Double arithmetic, brute force and by plugging solutions back in.
import { expect } from 'vitest';
import { catalogUnits } from '../../src/lib/learn/math/middle/catalog';
import { Gen, type Problem, type Template } from '../../src/lib/learn/math/middle/core';
import { mathMiddleProvider } from '../../src/lib/learn/math/middle';

export const provider = mathMiddleProvider;

/** Seeds per template and level. The Swift tests use 1...300; 150 keeps the file fast and still makes 30+ draws. */
export const SEEDS = 150;

export interface Draw {
  level: number;
  seed: number;
  problem: Problem;
}

export function template(id: string): Template {
  for (const unit of catalogUnits()) {
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
  const t = template(id);
  const result: Draw[] = [];
  for (let level = 1; level <= 3; level++) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const gen = new Gen(BigInt(seed) * 7919n + BigInt(level));
      const problem = t.make(level, gen);
      if (problem) result.push({ level, seed, problem });
    }
  }
  cache.set(id, result);
  return result;
}

/** Runs a check on every draw of a template. The body returns a message for a wrong problem, null for a good one. */
export function check(id: string, body: (level: number, p: Problem) => string | null | undefined, minimumDraws = 30): void {
  const all = draws(id);
  expect(all.length, `${id} made too few problems`).toBeGreaterThanOrEqual(minimumDraws);
  const messages: string[] = [];
  for (const draw of all) {
    const message = body(draw.level, draw.problem);
    if (message) messages.push(`${id} level ${draw.level} seed ${draw.seed}: ${message}\n  ${draw.problem.prompt.split('\n').join(' | ')}`);
  }
  if (messages.length > 0) {
    throw new Error(`${messages.length} wrong problems in ${id}:\n` + messages.slice(0, 6).join('\n'));
  }
}

// Text

/** The capture groups of the first match, the whole match first; null without a match. */
export function match(pattern: string | RegExp, text: string): string[] | null {
  const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const found = re.exec(text);
  if (!found) return null;
  return Array.from(found, (g) => g ?? '');
}

/** The capture groups of every match. */
export function matches(pattern: string | RegExp, text: string): string[][] {
  const re = new RegExp(typeof pattern === 'string' ? pattern : pattern.source, 'g');
  return Array.from(text.matchAll(re), (found) => Array.from(found, (g) => g ?? ''));
}

/** "12", "0,75" or "3/4" at the start of the text as a Double; a unit, a percent sign or a degree sign after it is
 * ignored, a mixed number "2 3/5" is read as 2.6. The minus sign is U+2212 or "-". */
export function number(text: string): number | null {
  let cleaned = text.split('−').join('-').split(',').join('.');
  cleaned = cleaned.replace(/^[ \t]+|[ \t]+$/g, '');
  let m = match(/^(-?)(\d+) (\d+)\/(\d+)/, cleaned);
  if (m) {
    const value = Number(m[2]) + Number(m[3]) / Number(m[4]);
    return m[1] === '' ? value : -value;
  }
  m = match(/^(-?)(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/, cleaned);
  if (m) {
    const denominator = Number(m[3]);
    if (denominator === 0) return null;
    const value = Number(m[2]) / denominator;
    return m[1] === '' ? value : -value;
  }
  m = match(/^(-?)(\d+(?:\.\d+)?)/, cleaned);
  if (m) {
    const value = Number(m[2]);
    return m[1] === '' ? value : -value;
  }
  return null;
}

/** Every unsigned number or fraction "a/b" in the text, in order. */
export function numbers(text: string): number[] {
  return matches(/\d+(?:,\d+)?(?:\/\d+(?:,\d+)?)?/, text)
    .map((m) => number(m[0]))
    .filter((v): v is number => v !== null);
}

/** The whole numbers in the text, in order. */
export function integers(text: string): number[] {
  return matches(/\d+/, text).map((m) => Number(m[0]));
}

export function close(a: number, b: number, tolerance = 1e-9): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/** The greatest common divisor found by trying every divisor, not by Euclid's algorithm. */
export function bruteGCD(a: number, b: number): number {
  if (!(a > 0 && b > 0)) return Math.max(a, b);
  for (let divisor = Math.min(a, b); divisor >= 1; divisor--) if (a % divisor === 0 && b % divisor === 0) return divisor;
  return 1;
}

/** The least common multiple found by counting up. */
export function bruteLCM(a: number, b: number): number {
  let multiple = Math.max(a, b);
  while (multiple % a !== 0 || multiple % b !== 0) multiple += Math.max(a, b);
  return multiple;
}

/** The typed answer of a problem as a Double. */
export function typedAnswer(p: Problem): number | null {
  return p.typed ? p.typed.answer.doubleValue : null;
}

/** Swift `Int(x)` of a finite Double (truncation). */
export const int = (x: number): number => Math.trunc(x);

/** The text of the last line of a prompt. */
export const lastLine = (prompt: string): string => prompt.split('\n').pop() ?? '';

/** The first line of a prompt. */
export const firstLine = (prompt: string): string => prompt.split('\n')[0] ?? '';

/** Swift `.sorted()` for numbers. */
export const sortedNumbers = (list: number[]): number[] => list.slice().sort((a, b) => a - b);

/** A range as Swift `a...b`. */
export function span(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

// A small reader for the expressions in the prompts: numbers (3, 0,75, 3/4, 2 3/4), + − · : and brackets, powers like
// ² and ⁻³, √, letters as variables, and 3x or 2(x + 1) as products. It computes with Doubles.

const superscripts: Record<string, number> = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isLetter = (c: string): boolean => /^\p{L}$/u.test(c);

export class Expr {
  private chars: string[];
  private index = 0;
  private variables: Record<string, number>;

  private constructor(text: string, variables: Record<string, number>) {
    this.chars = Array.from(text.split('−').join('-'));
    this.variables = variables;
  }

  static evaluate(text: string, variables: Record<string, number> = {}): number | null {
    const reader = new Expr(text, variables);
    const value = reader.expression();
    if (value === null) return null;
    reader.skipSpaces();
    return reader.index === reader.chars.length && Number.isFinite(value) ? value : null;
  }

  /** Whether both sides of "left = right" have the same value for the variable x. */
  static holds(equation: string, x: number): boolean | null {
    const sides = equation.split(' = ');
    if (sides.length !== 2) return null;
    const left = Expr.evaluate(sides[0], { x });
    const right = Expr.evaluate(sides[1], { x });
    if (left === null || right === null) return null;
    return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
  }

  private peek(offset = 0): string | undefined {
    return this.index + offset < this.chars.length ? this.chars[this.index + offset] : undefined;
  }

  private skipSpaces(): void {
    while (this.index < this.chars.length && this.chars[this.index] === ' ') this.index += 1;
  }

  private expression(): number | null {
    this.skipSpaces();
    let sign = 1;
    if (this.peek() === '-') {
      this.index += 1;
      sign = -1;
    } else if (this.peek() === '+') {
      this.index += 1;
    }
    const first = this.term();
    if (first === null) return null;
    let value = sign * first;
    for (;;) {
      this.skipSpaces();
      const c = this.peek();
      if (c !== '+' && c !== '-') return value;
      this.index += 1;
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
      const c = this.peek();
      if (c !== '·' && c !== ':') return value;
      this.index += 1;
      this.skipSpaces();
      const rhs = this.product();
      if (rhs === null) return null;
      if (c === ':') {
        if (rhs === 0) return null;
        value /= rhs;
      } else {
        value *= rhs;
      }
    }
  }

  /** Factors written right next to each other are multiplied: 3x, 2(x + 1), (x − 2)(x + 5). */
  private product(): number | null {
    let value = this.quotient();
    if (value === null) return null;
    for (;;) {
      const c = this.peek();
      if (c === undefined || !(c === '(' || c === '√' || c === 'π' || (isLetter(c) && c in this.variables))) break;
      const rhs = this.quotient();
      if (rhs === null) return null;
      value *= rhs;
    }
    return value;
  }

  private quotient(): number | null {
    let value = this.power();
    if (value === null) return null;
    if (this.peek() === '/') {
      this.index += 1;
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
      const c = this.peek();
      if (c === undefined || !(c === '⁻' || c in superscripts)) break;
      let negative = false;
      if (c === '⁻') {
        negative = true;
        this.index += 1;
      }
      let exponent = 0;
      let digits = 0;
      for (;;) {
        const d = this.peek();
        if (d === undefined || !(d in superscripts)) break;
        exponent = exponent * 10 + superscripts[d];
        digits += 1;
        this.index += 1;
      }
      if (digits === 0) return null;
      base = Math.pow(base, negative ? -exponent : exponent);
    }
    return base;
  }

  private atom(): number | null {
    const c = this.peek();
    if (c === undefined) return null;
    if (c === '(') {
      this.index += 1;
      const value = this.expression();
      if (value === null) return null;
      this.skipSpaces();
      if (this.peek() !== ')') return null;
      this.index += 1;
      return value;
    }
    if (c === '√') {
      this.index += 1;
      const value = this.atom();
      if (value === null || value < 0) return null;
      return Math.sqrt(value);
    }
    if (c === 'π') {
      this.index += 1;
      return Math.PI;
    }
    if (isDigit(c)) return this.numberValue();
    if (isLetter(c) && c in this.variables) {
      this.index += 1;
      return this.variables[c];
    }
    return null;
  }

  private digits(): string {
    let text = '';
    while (isDigit(this.peek())) {
      text += this.peek();
      this.index += 1;
    }
    return text;
  }

  private numberValue(): number | null {
    let text = this.digits();
    if (this.peek() === ',' && isDigit(this.peek(1))) {
      this.index += 1;
      text += '.' + this.digits();
    }
    if (text === '') return null;
    const value = Number(text);
    // A mixed number: a whole number, a space, then a fraction.
    if (!text.includes('.') && this.peek() === ' ' && isDigit(this.peek(1))) {
      const start = this.index;
      this.index += 1;
      const numerator = this.digits();
      if (this.peek() === '/' && isDigit(this.peek(1))) {
        this.index += 1;
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
