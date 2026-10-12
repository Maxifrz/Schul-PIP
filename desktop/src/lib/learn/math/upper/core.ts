// Building blocks of the upper-school maths course: exact fractions, polynomials, the seeded generator, the
// problem type and the template type. A port of Lernwerk/Services/Learn/MathUpper/MathUpperCore.swift.
// Swift's Int is 64-bit and traps on overflow; the generators stay far below 2^53, so plain numbers are exact here.

import { folded } from '../../exercise';
import { LearnRandom, randomDouble, randomElement, randomIntClosed, shuffled } from '../../random';
import { Rational } from '../../numberCheck';

/** `a / b` for Swift Int (truncating); a result of -0 becomes 0. */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b) + 0;
}

/** An exact fraction with non-optional arithmetic (a zero denominator gives 0). */
export class UQ {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d: number = 1) {
    if (d === 0) {
      this.n = 0;
      this.d = 1;
      return;
    }
    let a = Math.abs(n);
    let b = Math.abs(d);
    while (b !== 0) [a, b] = [b, a % b];
    const g = Math.max(a, 1);
    const sign = d < 0 ? -1 : 1;
    this.n = (sign * n) / g + 0;
    this.d = Math.abs(d) / g;
  }

  static readonly zero = new UQ(0);
  static readonly one = new UQ(1);

  lt(o: UQ): boolean {
    return this.n * o.d < o.n * this.d;
  }
  gt(o: UQ): boolean {
    return o.lt(this);
  }
  le(o: UQ): boolean {
    return !o.lt(this);
  }
  ge(o: UQ): boolean {
    return !this.lt(o);
  }
  equals(o: UQ): boolean {
    return this.n === o.n && this.d === o.d;
  }
  plus(o: UQ): UQ {
    return new UQ(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  minus(o: UQ): UQ {
    return new UQ(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  times(o: UQ): UQ {
    return new UQ(this.n * o.n, this.d * o.d);
  }
  div(o: UQ): UQ {
    return new UQ(this.n * o.d, this.d * o.n);
  }
  neg(): UQ {
    return new UQ(-this.n, this.d);
  }

  get isInt(): boolean {
    return this.d === 1;
  }
  get isZero(): boolean {
    return this.n === 0;
  }
  get double(): number {
    return this.n / this.d;
  }
  get magnitude(): UQ {
    return new UQ(Math.abs(this.n), this.d);
  }
  /** A hashable identity, for sets and dictionaries. */
  get id(): string {
    return `${this.n}/${this.d}`;
  }

  power(e: number): UQ {
    let result = UQ.one;
    for (let i = 0; i < Math.max(e, 0); i++) result = result.times(this);
    return result;
  }

  /** True when the decimal expansion ends after at most six digits. */
  get terminates(): boolean {
    let rest = this.d;
    let twos = 0;
    let fives = 0;
    while (rest % 2 === 0) {
      rest /= 2;
      twos += 1;
    }
    while (rest % 5 === 0) {
      rest /= 5;
      fives += 1;
    }
    return rest === 1 && Math.max(twos, fives) <= 6;
  }

  /** A result a student can type without a calculator: a short decimal or a fraction with a small denominator. */
  get isNice(): boolean {
    if (this.isInt || this.d <= 36) return true;
    let rest = this.d;
    while (rest % 2 === 0) rest /= 2;
    while (rest % 5 === 0) rest /= 5;
    return rest === 1 && this.d <= 100_000;
  }

  /** The same with an ASCII hyphen, as it is stored as a typed answer. */
  get typed(): string {
    const r = Rational.make(this.n, this.d);
    return r ? r.germanText : `${this.n}/${this.d}`;
  }

  /** "0,375" or "3/8"; whole numbers plain; with the true minus sign for display. */
  get text(): string {
    return this.typed.split('-').join('−');
  }

  get fraction(): string {
    return this.isInt ? `${this.n}` : `${this.n}/${this.d}`;
  }

  get fractionDisplay(): string {
    return this.fraction.split('-').join('−');
  }
}

/** Swift's `Set.insert(x).inserted`: adds the element and tells whether it was new. */
export function insert<T>(set: Set<T>, value: T): boolean {
  if (set.has(value)) return false;
  set.add(value);
  return true;
}

export const q = (n: number, d: number = 1): UQ => new UQ(n, d);

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '-': '₋' };

export const UText = {
  /** Replaces a hyphen that is used as a sign by the real minus sign. */
  signs(text: string): string {
    return text.replace(/(?<![0-9A-Za-z])-(?=[0-9A-Za-z(])/g, '−');
  },

  /** "", "−" or the number: the coefficient in front of a term. */
  coefficient(n: number): string {
    return n === 1 ? '' : n === -1 ? '−' : UText.signed(n);
  },

  superscript(n: number): string {
    return Array.from(String(n))
      .map((c) => SUP[c] ?? c)
      .join('');
  },
  subscripted(n: number): string {
    return Array.from(String(n))
      .map((c) => SUB[c] ?? c)
      .join('');
  },
  signed(n: number): string {
    return n < 0 ? `−${-n}` : `${n}`;
  },

  /** A decimal or fraction in the form a student types it. */
  number(value: UQ): string {
    return value.text;
  },

  /** A coefficient times pi: "π/3", "2π/3", "π", "0". */
  piMultiple(value: UQ): string {
    if (value.isZero) return '0';
    const sign = value.n < 0 ? '−' : '';
    const top = Math.abs(value.n);
    const head = top === 1 ? 'π' : `${top}π`;
    return sign + (value.d === 1 ? head : `${head}/${value.d}`);
  },

  /** A vector as row "(1 | 2 | 3)". */
  vector(v: readonly number[]): string {
    return '(' + v.map(UText.signed).join(' | ') + ')';
  },
  point(name: string, v: readonly number[]): string {
    return name + '(' + v.map(UText.signed).join(' | ') + ')';
  },
};

/** A polynomial with exact coefficients, lowest degree first. */
export class UPoly {
  readonly c: UQ[];

  constructor(coefficients: readonly UQ[]) {
    const a = coefficients.slice();
    while (a.length > 0 && a[a.length - 1].isZero) a.pop();
    this.c = a;
  }

  static ints(ints: readonly number[]): UPoly {
    return new UPoly(ints.map((i) => new UQ(i)));
  }

  /** Coefficients by exponent: [(exponent, coefficient)]. */
  static terms(terms: readonly (readonly [number, UQ])[]): UPoly {
    const top = terms.length === 0 ? 0 : Math.max(...terms.map((t) => t[0]));
    const a: UQ[] = new Array(top + 1).fill(UQ.zero);
    for (const [e, value] of terms) a[e] = a[e].plus(value);
    return new UPoly(a);
  }

  /** lead * (x - r1) * (x - r2) ... */
  static fromRoots(lead: UQ, roots: readonly UQ[]): UPoly {
    let p = new UPoly([lead]);
    for (const r of roots) p = p.times(new UPoly([r.neg(), UQ.one]));
    return p;
  }

  get degree(): number {
    return this.c.length - 1;
  }
  get isZero(): boolean {
    return this.c.length === 0;
  }
  coefficient(i: number): UQ {
    return i < this.c.length && i >= 0 ? this.c[i] : UQ.zero;
  }

  equals(o: UPoly): boolean {
    return this.c.length === o.c.length && this.c.every((x, i) => x.equals(o.c[i]));
  }

  eval(x: UQ): UQ {
    let result = UQ.zero;
    for (let i = this.c.length - 1; i >= 0; i--) result = result.times(x).plus(this.c[i]);
    return result;
  }

  evalDouble(x: number): number {
    let result = 0;
    for (let i = this.c.length - 1; i >= 0; i--) result = result * x + this.c[i].double;
    return result;
  }

  get derivative(): UPoly {
    if (this.c.length <= 1) return new UPoly([]);
    const out: UQ[] = [];
    for (let i = 1; i < this.c.length; i++) out.push(this.c[i].times(new UQ(i)));
    return new UPoly(out);
  }

  get integral(): UPoly {
    return new UPoly([UQ.zero, ...this.c.map((value, i) => value.div(new UQ(i + 1)))]);
  }

  plus(o: UPoly): UPoly {
    const n = Math.max(this.c.length, o.c.length);
    const out: UQ[] = [];
    for (let i = 0; i < n; i++) out.push(this.coefficient(i).plus(o.coefficient(i)));
    return new UPoly(out);
  }

  times(o: UPoly): UPoly {
    if (this.isZero || o.isZero) return new UPoly([]);
    const out: UQ[] = new Array(this.c.length + o.c.length - 1).fill(UQ.zero);
    this.c.forEach((x, i) => o.c.forEach((y, j) => (out[i + j] = out[i + j].plus(x.times(y)))));
    return new UPoly(out);
  }

  scaled(factor: UQ): UPoly {
    return new UPoly(this.c.map((x) => x.times(factor)));
  }

  /** "3x² − 4x + 1"; fractions as "x³/3" and "2x³/3". */
  get text(): string {
    if (this.c.length === 0) return '0';
    let out = '';
    for (let i = this.c.length - 1; i >= 0; i--) {
      const value = this.c[i];
      if (value.isZero) continue;
      const magnitude = value.magnitude;
      let body: string;
      if (i === 0) {
        body = magnitude.fraction;
      } else {
        const coefficient = magnitude.n === 1 ? '' : `${magnitude.n}`;
        body = coefficient + 'x' + (i === 1 ? '' : UText.superscript(i)) + (magnitude.isInt ? '' : `/${magnitude.d}`);
      }
      if (out === '') out = (value.n < 0 ? '−' : '') + body;
      else out += (value.n < 0 ? ' − ' : ' + ') + body;
    }
    return out;
  }
}

/** The seeded source of randomness of one node. */
export class UGen {
  private rng: LearnRandom;

  constructor(seed: bigint) {
    this.rng = new LearnRandom(seed);
  }

  /** `Int.random(in: lo...hi)` */
  int(lo: number, hi: number): number {
    return randomIntClosed(this.rng, lo, hi);
  }

  nonzero(lo: number, hi: number): number {
    for (let i = 0; i < 50; i++) {
      const v = this.int(lo, hi);
      if (v !== 0) return v;
    }
    return hi === 0 ? lo : hi;
  }

  sign(): number {
    return this.int(0, 1) === 0 ? -1 : 1;
  }
  chance(p: number): boolean {
    return randomDouble(this.rng, 0, 1) < p;
  }
  pick<T>(items: readonly T[]): T {
    // Int.random(in: 0..<count): a bounded draw like randomElement; an empty array would trap in Swift.
    const value = randomElement(items, this.rng);
    if (value === undefined && items.length === 0) throw new RangeError('pick from an empty array');
    return value as T;
  }
  shuffled<T>(items: readonly T[]): T[] {
    return shuffled(items, this.rng);
  }
  withRandom<T>(body: (rng: LearnRandom) => T): T {
    return body(this.rng);
  }

  /** A random polynomial of the given degree with `terms` non-zero terms (the leading one included). */
  poly(degree: number, terms: number, coefficients: readonly [number, number] = [1, 5], negatives: boolean = true): UPoly {
    const exponents = new Set<number>([degree]);
    const base: number[] = [];
    for (let i = 0; i < degree; i++) base.push(i);
    const candidates = this.shuffled(base);
    for (const e of candidates) {
      if (exponents.size < Math.min(terms, degree + 1)) exponents.add(e);
    }
    const list: [number, UQ][] = [...exponents]
      .sort((x, y) => x - y)
      .map((e) => {
        const base = this.int(coefficients[0], coefficients[1]);
        const v = base * (negatives && e !== degree ? this.sign() : 1);
        return [e, new UQ(v)];
      });
    return UPoly.terms(list);
  }
}

// What a test needs to re-check an answer by another route. The fields are the raw inputs.
export type UUrn = 'oneRed' | 'twoRedWith' | 'twoRedWithout' | 'differentWithout';
export type UBinom = { t: 'equal'; k: number } | { t: 'atMost'; k: number } | { t: 'atLeast'; k: number } | { t: 'atLeastOne' };
export type UExtremum = 'maximum' | 'minimum' | 'saddle';
export type USymmetry = 'yAxis' | 'origin' | 'neither';
export type UAmpKind = 'amplitude' | 'maximum' | 'minimum' | 'midline';
export type UAsk = 'pA' | 'pB' | 'pAandB' | 'pAorB' | 'pNotAandB' | 'pNotAandNotB' | 'pAgivenB' | 'pBgivenA' | 'pNotBgivenA';

/** A Vierfeldertafel in counts: a = A and B, b = A and not B, c = not A and B, d = neither. */
export class UTable {
  constructor(
    readonly a: number,
    readonly b: number,
    readonly c: number,
    readonly d: number,
  ) {}
  get total(): number {
    return this.a + this.b + this.c + this.d;
  }
}

type Vec = number[];
type RealFn = (x: number) => number;

export type UFact =
  | { t: 'derivAt'; f: UPoly; x: UQ }
  | { t: 'valueAt'; f: UPoly; x: UQ }
  | { t: 'slopeX'; f: UPoly; m: UQ }
  | { t: 'tangentT'; f: UPoly; a: UQ }
  | { t: 'tangentY'; f: UPoly; a: UQ; b: UQ }
  | { t: 'flatX'; f: UPoly }
  | { t: 'flatY'; f: UPoly }
  | { t: 'derivPoly'; f: UPoly; correct: UPoly; wrong: UPoly[] }
  | { t: 'derivOfFunction'; f: RealFn; at: number }
  | { t: 'valueOfFunction'; f: RealFn; at: number }
  | { t: 'root'; f: UPoly; largest: boolean }
  | { t: 'extremumX'; f: UPoly; max: boolean }
  | { t: 'extremumY'; f: UPoly; max: boolean }
  | { t: 'inflectionX'; f: UPoly }
  | { t: 'kindAt'; f: UPoly; x: UQ; kind: UExtremum }
  | { t: 'symmetry'; f: UPoly; kind: USymmetry }
  | { t: 'monotone'; f: UPoly; lo: UQ; hi: UQ; askRising: boolean; answerBetween: boolean }
  | { t: 'antiderivative'; f: UPoly; correct: UPoly; wrong: UPoly[] }
  | { t: 'definite'; f: UPoly; a: UQ; b: UQ }
  | { t: 'area'; f: UPoly; a: UQ; b: UQ }
  | { t: 'mean'; f: UPoly; a: UQ; b: UQ }
  | { t: 'upperLimit'; f: UPoly; value: UQ }
  | { t: 'combination'; coefficients: UQ[]; parts: UQ[] }
  | { t: 'integralOfFunction'; f: RealFn; from: number; to: number }
  | { t: 'approx'; value: number }
  | { t: 'powerEquation'; base: number; k: UQ; c: UQ; rhs: number }
  | { t: 'expDeriv'; a: number; k: number; b: number }
  | { t: 'expAnti'; a: number; k: number }
  | { t: 'lnSolve'; a: number; k: number }
  | { t: 'law'; correct: (a: number, b: number) => [number, number]; wrong: ((a: number, b: number) => [number, number])[] }
  | { t: 'trigValue'; fn: string; degrees: number }
  | { t: 'degreesToPi'; degrees: number }
  | { t: 'period'; fn: string; k: UQ }
  | { t: 'amplitude'; a: UQ; k: UQ; d: UQ; what: UAmpKind }
  | { t: 'zerosIn'; fn: string; k: number }
  | { t: 'trigSolve'; fn: string; value: UQ }
  | { t: 'cosFromSin'; sin: UQ; askTan: boolean }
  | { t: 'trigDeriv'; fn: string; a: number; k: number }
  | { t: 'vecNorm'; v: Vec }
  | { t: 'dot'; a: Vec; b: Vec }
  | { t: 'orthoParam'; a: Vec; b: Vec; index: number }
  | { t: 'distance'; a: Vec; b: Vec }
  | { t: 'vectorComponent'; from: Vec; to: Vec; index: number }
  | { t: 'lineParam'; a: Vec; u: Vec; p: Vec }
  | { t: 'linePoint'; a: Vec; u: Vec; tt: number; index: number }
  | { t: 'midpoint'; a: Vec; b: Vec; index: number }
  | { t: 'angle'; a: Vec; b: Vec }
  | { t: 'onLine'; a: Vec; u: Vec; right: Vec; wrong: Vec[] }
  | { t: 'orthogonalPair'; right: [Vec, Vec]; wrong: [Vec, Vec][] }
  | { t: 'direction'; a: Vec; b: Vec }
  | { t: 'laplaceDice'; sums: number[] }
  | { t: 'urn'; red: number; blue: number; mode: UUrn }
  | { t: 'choose'; n: number; k: number }
  | { t: 'binomial'; n: number; p: UQ; kind: UBinom }
  | { t: 'expectation'; n: number; p: UQ }
  | { t: 'expectationTable'; values: UQ[]; probabilities: UQ[] }
  | { t: 'sigma'; n: number; p: UQ }
  | { t: 'table'; table: UTable; ask: UAsk }
  | { t: 'independence'; table: UTable }
  | { t: 'pairs' }
  | { t: 'concept' };

/** One generated question of the course. */
export interface UProblem {
  key: string;
  prompt: string;
  hint: string;
  number: UQ | null;
  correct: string;
  wrong: string[];
  solution: string;
  explanation: string;
  fact: UFact;
  typedAllowed: boolean;
}

export function canChoice(problem: UProblem): boolean {
  return problem.wrong.length >= 2;
}

/** A problem with the defaults of the Swift memberwise initializer (hint empty, typed allowed). */
export function uProblem(fields: Omit<UProblem, 'hint' | 'typedAllowed'> & Partial<Pick<UProblem, 'hint' | 'typedAllowed'>>): UProblem {
  return { hint: '', typedAllowed: true, ...fields };
}

/** Every text of the problem with the real minus sign instead of a hyphen used as a sign. */
export function sanitize(problem: UProblem): void {
  problem.prompt = UText.signs(problem.prompt);
  problem.correct = UText.signs(problem.correct);
  problem.wrong = problem.wrong.map(UText.signs);
  problem.solution = UText.signs(problem.solution);
  problem.explanation = UText.signs(problem.explanation);
}

export const UProblems = {
  /** Wrong answers without anything that reads like the right one or like each other. */
  cleaned(wrong: readonly string[], against: string): string[] {
    const seen = new Set<string>([folded(against)]);
    const out: string[] = [];
    for (const w of wrong) {
      if (w === '') continue;
      const f = folded(w);
      if (seen.has(f)) continue;
      seen.add(f);
      out.push(w);
    }
    return out;
  },

  /** A question with a number as the answer; `wrongs` are the results of typical mistakes. */
  numeric(o: {
    key: string;
    prompt: string;
    hint?: string;
    answer: UQ;
    wrongs: readonly UQ[];
    solution: string;
    explanation: string;
    fact: UFact;
    typed?: boolean;
  }): UProblem | null {
    if (!(o.answer.isNice && Math.abs(o.answer.double) < 100_000)) return null;
    const correct = o.answer.text;
    const texts: string[] = [];
    for (const w of o.wrongs) {
      if (!w.equals(o.answer) && w.isNice && Math.abs(w.double) < 1_000_000) texts.push(w.text);
    }
    return uProblem({
      key: o.key,
      prompt: o.prompt,
      hint: o.hint ?? '',
      number: o.answer,
      correct,
      wrong: UProblems.cleaned(texts, correct),
      solution: o.solution,
      explanation: o.explanation,
      fact: o.fact,
      typedAllowed: o.typed ?? true,
    });
  },

  /** A question whose options are terms or statements. */
  choice(o: {
    key: string;
    prompt: string;
    correct: string;
    wrong: readonly string[];
    solution: string;
    explanation: string;
    fact: UFact;
  }): UProblem | null {
    const w = UProblems.cleaned(o.wrong, o.correct);
    if (w.length < 2) return null;
    return uProblem({
      key: o.key,
      prompt: o.prompt,
      number: null,
      correct: o.correct,
      wrong: w,
      solution: o.solution,
      explanation: o.explanation,
      fact: o.fact,
      typedAllowed: false,
    });
  },
};

export type UPairItems = { front: string; back: string }[];

/** A template draws one problem of a level from 1 (easy) to 3 (hard); null means the draw did not work out. */
export interface UTemplate {
  readonly id: string;
  readonly make: (level: number, gen: UGen) => UProblem | null;
  readonly pairs?: (level: number, gen: UGen) => UPairItems | null;
}

export function uTemplate(
  id: string,
  make: (level: number, gen: UGen) => UProblem | null,
  pairs?: (level: number, gen: UGen) => UPairItems | null,
): UTemplate {
  return {
    id,
    make: (level, gen) => {
      const problem = make(level, gen);
      if (!problem) return null;
      sanitize(problem);
      return problem;
    },
    pairs,
  };
}
