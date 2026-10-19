import { LearnRandom } from '../../random';
import { Rational } from '../../rational';
import { folded } from '../../exercise';

/** An exact fraction with non-optional arithmetic, for the generators of the upper-school maths course. */
export class UQ {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
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

  /** A value to compare and to use as a map key. */
  get key(): string { return `${this.n}/${this.d}`; }
  equals(other: UQ): boolean { return this.n === other.n && this.d === other.d; }
  lessThan(other: UQ): boolean { return this.n * other.d < other.n * this.d; }
  plus(other: UQ): UQ { return new UQ(this.n * other.d + other.n * this.d, this.d * other.d); }
  minus(other: UQ): UQ { return new UQ(this.n * other.d - other.n * this.d, this.d * other.d); }
  times(other: UQ): UQ { return new UQ(this.n * other.n, this.d * other.d); }
  div(other: UQ): UQ { return new UQ(this.n * other.d, this.d * other.n); }
  get neg(): UQ { return new UQ(-this.n, this.d); }

  get isInt(): boolean { return this.d === 1; }
  get isZero(): boolean { return this.n === 0; }
  get double(): number { return this.n / this.d; }
  get magnitude(): UQ { return new UQ(Math.abs(this.n), this.d); }

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
    while (rest % 2 === 0) { rest /= 2; twos += 1; }
    while (rest % 5 === 0) { rest /= 5; fives += 1; }
    return rest === 1 && Math.max(twos, fives) <= 6;
  }

  /** A result a student can type without a calculator: a short decimal or a fraction with a small denominator. */
  get isNice(): boolean {
    if (this.isInt || this.d <= 36) return true;
    let rest = this.d;
    while (rest % 2 === 0) rest /= 2;
    while (rest % 5 === 0) rest /= 5;
    return rest === 1 && this.d <= 100000;
  }

  /** "0,375" or "3/8"; whole numbers plain; with the true minus sign for display. */
  get text(): string { return this.typed.split('-').join('−'); }

  /** The same with an ASCII hyphen, as it is stored as a typed answer. */
  get typed(): string { return Rational.of(this.n, this.d)?.germanText ?? `${this.n}/${this.d}`; }

  get fraction(): string { return this.isInt ? `${this.n}` : `${this.n}/${this.d}`; }

  get fractionDisplay(): string { return this.fraction.split('-').join('−'); }
}

export const uq = (n: number, d = 1): UQ => new UQ(n, d);

export const UText = {
  /** Replaces a hyphen that is used as a sign by the real minus sign. */
  signs(text: string): string {
    return text.replace(/(?<![0-9A-Za-z])-(?=[0-9A-Za-z(])/gu, '−');
  },

  /** "", "−" or the number: the coefficient in front of a term. */
  coefficient(n: number): string { return n === 1 ? '' : n === -1 ? '−' : UText.signed(n); },

  superscript(n: number): string { return [...String(n)].map((c) => ({ '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' } as Record<string, string>)[c] ?? c).join(''); },
  subscripted(n: number): string { return [...String(n)].map((c) => ({ '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '-': '₋' } as Record<string, string>)[c] ?? c).join(''); },
  signed(n: number): string { return n < 0 ? `−${-n}` : `${n}`; },

  /** A decimal or fraction in the form a student types it. */
  number(x: UQ): string { return x.text; },

  /** A coefficient times pi: "π/3", "2π/3", "π", "0". */
  piMultiple(x: UQ): string {
    if (x.isZero) return '0';
    const sign = x.n < 0 ? '−' : '';
    const top = Math.abs(x.n);
    const head = top === 1 ? 'π' : `${top}π`;
    return sign + (x.d === 1 ? head : `${head}/${x.d}`);
  },

  /** A vector as row "(1 | 2 | 3)". */
  vector(v: number[]): string { return `(${v.map(UText.signed).join(' | ')})`; },
  point(name: string, v: number[]): string { return `${name}(${v.map(UText.signed).join(' | ')})`; },
};

/** A polynomial with exact coefficients, lowest degree first. */
export class UPoly {
  readonly c: UQ[];

  constructor(coefficients: UQ[]) {
    const a = [...coefficients];
    while (a.length > 0 && a[a.length - 1].isZero) a.pop();
    this.c = a;
  }

  static ofInts(ints: number[]): UPoly { return new UPoly(ints.map((v) => uq(v))); }

  /** Coefficients by exponent: [(exponent, coefficient)]. */
  static ofTerms(terms: [number, UQ][]): UPoly {
    const top = terms.length === 0 ? 0 : Math.max(...terms.map((t) => t[0]));
    const a: UQ[] = Array.from({ length: top + 1 }, () => UQ.zero);
    for (const [e, value] of terms) a[e] = a[e].plus(value);
    return new UPoly(a);
  }

  /** lead * (x - r1) * (x - r2) ... */
  static fromRoots(lead: UQ, roots: UQ[]): UPoly {
    let p = new UPoly([lead]);
    for (const r of roots) p = p.times(new UPoly([r.neg, UQ.one]));
    return p;
  }

  get degree(): number { return this.c.length - 1; }
  get isZero(): boolean { return this.c.length === 0; }
  coefficient(i: number): UQ { return i < this.c.length && i >= 0 ? this.c[i] : UQ.zero; }
  equals(other: UPoly): boolean { return this.c.length === other.c.length && this.c.every((x, i) => x.equals(other.c[i])); }

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
    return new UPoly(this.c.slice(1).map((value, i) => value.times(uq(i + 1))));
  }

  get integral(): UPoly {
    return new UPoly([UQ.zero, ...this.c.map((value, i) => value.div(uq(i + 1)))]);
  }

  plus(other: UPoly): UPoly {
    const length = Math.max(this.c.length, other.c.length);
    return new UPoly(Array.from({ length }, (_, i) => this.coefficient(i).plus(other.coefficient(i))));
  }

  times(other: UPoly): UPoly {
    if (this.isZero || other.isZero) return new UPoly([]);
    const out: UQ[] = Array.from({ length: this.c.length + other.c.length - 1 }, () => UQ.zero);
    this.c.forEach((x, i) => other.c.forEach((y, j) => { out[i + j] = out[i + j].plus(x.times(y)); }));
    return new UPoly(out);
  }

  scaled(factor: UQ): UPoly { return new UPoly(this.c.map((x) => x.times(factor))); }

  /** "3x² − 4x + 1"; fractions as "x³/3" and "2x³/3". */
  get text(): string {
    if (this.c.length === 0) return '0';
    let out = '';
    for (let i = this.c.length - 1; i >= 0; i--) {
      const value = this.c[i];
      if (value.isZero) continue;
      const magnitude = value.magnitude;
      let body: string;
      if (i === 0) body = magnitude.fraction;
      else {
        const coefficient = magnitude.n === 1 ? '' : `${magnitude.n}`;
        body = `${coefficient}x${i === 1 ? '' : UText.superscript(i)}${magnitude.isInt ? '' : `/${magnitude.d}`}`;
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

  int(low: number, high: number): number { return low + Number(this.rng.next() % BigInt(high - low + 1)); }

  nonzero(low: number, high: number): number {
    for (let i = 0; i < 50; i++) {
      const v = this.int(low, high);
      if (v !== 0) return v;
    }
    return high === 0 ? low : high;
  }

  sign(): number { return this.int(0, 1) === 0 ? -1 : 1; }
  chance(p: number): boolean { return Number(this.rng.next() >> 11n) / 2 ** 53 < p; }
  pick<T>(items: readonly T[]): T { return items[Number(this.rng.next() % BigInt(items.length))]; }

  shuffled<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Number(this.rng.next() % BigInt(i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  withRandom<R>(body: (random: LearnRandom) => R): R { return body(this.rng); }

  /** A random polynomial of the given degree with `terms` non-zero terms (the leading one included). */
  poly(degree: number, terms: number, coefficients: [number, number] = [1, 5], negatives = true): UPoly {
    const exponents = new Set<number>([degree]);
    const candidates = this.shuffled(Array.from({ length: degree }, (_, i) => i));
    for (const e of candidates) if (exponents.size < Math.min(terms, degree + 1)) exponents.add(e);
    const list = [...exponents].sort((a, b) => a - b).map((e): [number, UQ] => {
      const v = this.int(coefficients[0], coefficients[1]) * (negatives && e !== degree ? this.sign() : 1);
      return [e, uq(v)];
    });
    return UPoly.ofTerms(list);
  }
}

export type UExtremum = 'maximum' | 'minimum' | 'saddle';
export type USymmetry = 'yAxis' | 'origin' | 'neither';
export type UAmpKind = 'amplitude' | 'maximum' | 'minimum' | 'midline';
export type UUrn = 'oneRed' | 'twoRedWith' | 'twoRedWithout' | 'differentWithout';
export type UBinom = { k: 'equal'; v: number } | { k: 'atMost'; v: number } | { k: 'atLeast'; v: number } | { k: 'atLeastOne' };

/** A Vierfeldertafel in counts: a = A and B, b = A and not B, c = not A and B, d = neither. */
export interface UTable { a: number; b: number; c: number; d: number }
export const tableTotal = (t: UTable): number => t.a + t.b + t.c + t.d;

export type UAsk = 'pA' | 'pB' | 'pAandB' | 'pAorB' | 'pNotAandB' | 'pNotAandNotB' | 'pAgivenB' | 'pBgivenA' | 'pNotBgivenA';

/** What a test needs to re-check an answer by another route. The fields are the raw inputs. */
export type UFact =
  | { k: 'derivAt'; f: UPoly; x: UQ }
  | { k: 'valueAt'; f: UPoly; x: UQ }
  | { k: 'slopeX'; f: UPoly; m: UQ }
  | { k: 'tangentT'; f: UPoly; a: UQ }
  | { k: 'tangentY'; f: UPoly; a: UQ; b: UQ }
  | { k: 'flatX'; f: UPoly }
  | { k: 'flatY'; f: UPoly }
  | { k: 'derivPoly'; f: UPoly; correct: UPoly; wrong: UPoly[] }
  | { k: 'derivOfFunction'; fn: (x: number) => number; at: number }
  | { k: 'valueOfFunction'; fn: (x: number) => number; at: number }
  | { k: 'root'; f: UPoly; largest: boolean }
  | { k: 'extremumX'; f: UPoly; max: boolean }
  | { k: 'extremumY'; f: UPoly; max: boolean }
  | { k: 'inflectionX'; f: UPoly }
  | { k: 'kindAt'; f: UPoly; x: UQ; kind: UExtremum }
  | { k: 'symmetry'; f: UPoly; kind: USymmetry }
  | { k: 'monotone'; f: UPoly; lo: UQ; hi: UQ; askRising: boolean; answerBetween: boolean }
  | { k: 'antiderivative'; f: UPoly; correct: UPoly; wrong: UPoly[] }
  | { k: 'definite'; f: UPoly; a: UQ; b: UQ }
  | { k: 'area'; f: UPoly; a: UQ; b: UQ }
  | { k: 'mean'; f: UPoly; a: UQ; b: UQ }
  | { k: 'upperLimit'; f: UPoly; value: UQ }
  | { k: 'combination'; coefficients: UQ[]; parts: UQ[] }
  | { k: 'integralOfFunction'; fn: (x: number) => number; from: number; to: number }
  | { k: 'approx'; value: number }
  | { k: 'powerEquation'; base: number; kk: UQ; c: UQ; rhs: number }
  | { k: 'expDeriv'; a: number; kk: number; b: number }
  | { k: 'expAnti'; a: number; kk: number }
  | { k: 'lnSolve'; a: number; kk: number }
  | { k: 'law'; correct: (a: number, b: number) => [number, number]; wrong: Array<(a: number, b: number) => [number, number]> }
  | { k: 'trigValue'; fn: string; degrees: number }
  | { k: 'degreesToPi'; degrees: number }
  | { k: 'period'; fn: string; kk: UQ }
  | { k: 'amplitude'; a: UQ; kk: UQ; d: UQ; what: UAmpKind }
  | { k: 'zerosIn'; fn: string; kk: number }
  | { k: 'trigSolve'; fn: string; value: UQ }
  | { k: 'cosFromSin'; sin: UQ; askTan: boolean }
  | { k: 'trigDeriv'; fn: string; a: number; kk: number }
  | { k: 'vecNorm'; v: number[] }
  | { k: 'dot'; a: number[]; b: number[] }
  | { k: 'orthoParam'; a: number[]; b: number[]; index: number }
  | { k: 'distance'; a: number[]; b: number[] }
  | { k: 'vectorComponent'; from: number[]; to: number[]; index: number }
  | { k: 'lineParam'; a: number[]; u: number[]; p: number[] }
  | { k: 'linePoint'; a: number[]; u: number[]; t: number; index: number }
  | { k: 'midpoint'; a: number[]; b: number[]; index: number }
  | { k: 'angle'; a: number[]; b: number[] }
  | { k: 'onLine'; a: number[]; u: number[]; right: number[]; wrong: number[][] }
  | { k: 'orthogonalPair'; right: [number[], number[]]; wrong: Array<[number[], number[]]> }
  | { k: 'direction'; a: number[]; b: number[] }
  | { k: 'laplaceDice'; sums: number[] }
  | { k: 'urn'; red: number; blue: number; mode: UUrn }
  | { k: 'choose'; n: number; kk: number }
  | { k: 'binomial'; n: number; p: UQ; kind: UBinom }
  | { k: 'expectation'; n: number; p: UQ }
  | { k: 'expectationTable'; values: UQ[]; probabilities: UQ[] }
  | { k: 'sigma'; n: number; p: UQ }
  | { k: 'table'; t: UTable; ask: UAsk }
  | { k: 'independence'; t: UTable }
  | { k: 'pairs' }
  | { k: 'concept' };

/** One generated question of the course. */
export interface UProblem {
  key: string;
  prompt: string;
  hint: string;
  number?: UQ;
  correct: string;
  wrong: string[];
  solution: string;
  explanation: string;
  fact: UFact;
  typedAllowed: boolean;
}

export const canChoice = (p: UProblem): boolean => p.wrong.length >= 2;

/** Every text of the problem with the real minus sign instead of a hyphen used as a sign. */
export function sanitize(p: UProblem): UProblem {
  return { ...p, prompt: UText.signs(p.prompt), correct: UText.signs(p.correct), wrong: p.wrong.map(UText.signs), solution: UText.signs(p.solution), explanation: UText.signs(p.explanation) };
}

/** Wrong answers without anything that reads like the right one or like each other. */
export function cleaned(wrong: string[], against: string): string[] {
  const seen = new Set<string>([folded(against)]);
  const out: string[] = [];
  for (const w of wrong) {
    if (w === '' || seen.has(folded(w))) continue;
    seen.add(folded(w));
    out.push(w);
  }
  return out;
}

/** A question with a number as the answer; `wrongs` are the results of typical mistakes. */
export function numeric(p: { key: string; prompt: string; hint?: string; answer: UQ; wrongs: UQ[]; solution: string; explanation: string; fact: UFact; typed?: boolean }): UProblem | null {
  if (!p.answer.isNice || !(Math.abs(p.answer.double) < 100000)) return null;
  const correct = p.answer.text;
  const texts: string[] = [];
  for (const w of p.wrongs) if (!w.equals(p.answer) && w.isNice && Math.abs(w.double) < 1000000) texts.push(w.text);
  return {
    key: p.key, prompt: p.prompt, hint: p.hint ?? '', number: p.answer, correct, wrong: cleaned(texts, correct),
    solution: p.solution, explanation: p.explanation, fact: p.fact, typedAllowed: p.typed ?? true,
  };
}

/** A question whose options are terms or statements. */
export function choiceProblem(p: { key: string; prompt: string; correct: string; wrong: string[]; solution: string; explanation: string; fact: UFact }): UProblem | null {
  const w = cleaned(p.wrong, p.correct);
  if (w.length < 2) return null;
  return { key: p.key, prompt: p.prompt, hint: '', correct: p.correct, wrong: w, solution: p.solution, explanation: p.explanation, fact: p.fact, typedAllowed: false };
}

export type UPairs = Array<{ front: string; back: string }>;

/** A template draws one problem of a level from 1 (easy) to 3 (hard); null means the draw did not work out. */
export interface UTemplate {
  id: string;
  make: (level: number, gen: UGen) => UProblem | null;
  pairs?: (level: number, gen: UGen) => UPairs | null;
}

export function utemplate(id: string, make: (level: number, gen: UGen) => UProblem | null, pairs?: (level: number, gen: UGen) => UPairs | null): UTemplate {
  return { id, make: (level, gen) => { const problem = make(level, gen); return problem ? sanitize(problem) : null; }, pairs };
}
