// Exact arithmetic without optionals, seeded numbers and the problem/template types of the middle-school maths
// course. A port of MathMiddleCore.swift and MathMiddleSupport.swift. Swift operators on `MathMiddleQ` are methods
// here (`plus`, `minus`, `times`, `over`) and take another Q or a whole number.

import { LearnRandom } from '../../random';
import { Rational } from '../../numberCheck';
import { folded } from '../../exercise';
import * as T from './text';

/** A value that is only trusted while `ok` is true: dividing by zero or overflowing clears it. */
export class Q {
  readonly value: Rational;
  readonly ok: boolean;

  private constructor(value: Rational, ok: boolean) {
    this.value = value;
    this.ok = ok;
  }

  /** Swift `MathMiddleQ(numerator, denominator)`. */
  static of(numerator: number | bigint, denominator: number | bigint = 1): Q {
    const r = Rational.make(numerator, denominator);
    return r ? new Q(r, true) : new Q(Rational.whole(0), false);
  }

  /** Swift `MathMiddleQ(Rational?)`. */
  static from(rational: Rational | null | undefined): Q {
    return rational ? new Q(rational, true) : new Q(Rational.whole(0), false);
  }

  get numerator(): number {
    return Number(this.value.numerator);
  }
  get denominator(): number {
    return Number(this.value.denominator);
  }
  get isWhole(): boolean {
    return this.value.isWhole;
  }
  get double(): number {
    return this.value.doubleValue;
  }
  get isZero(): boolean {
    return this.value.numerator === 0n;
  }
  get isNegative(): boolean {
    return this.value.numerator < 0n;
  }
  /** The value as a whole number, null for a fraction. */
  get int(): number | null {
    return this.value.isWhole ? Number(this.value.numerator) : null;
  }

  get reciprocal(): Q {
    return Q.of(1).over(this);
  }
  get negated(): Q {
    return Q.of(-this.value.numerator, this.value.denominator);
  }
  get magnitude(): Q {
    return this.isNegative ? this.negated : this;
  }

  plus(b: Q | number): Q {
    const o = typeof b === 'number' ? Q.of(b) : b;
    const sum = Q.from(this.value.plus(o.value));
    return this.ok && o.ok && sum.ok ? sum : Q.of(1, 0);
  }
  minus(b: Q | number): Q {
    const o = typeof b === 'number' ? Q.of(b) : b;
    const d = Q.from(this.value.minus(o.value));
    return this.ok && o.ok && d.ok ? d : Q.of(1, 0);
  }
  times(b: Q | number): Q {
    const o = typeof b === 'number' ? Q.of(b) : b;
    const p = Q.from(this.value.times(o.value));
    return this.ok && o.ok && p.ok ? p : Q.of(1, 0);
  }
  over(b: Q | number): Q {
    const o = typeof b === 'number' ? Q.of(b) : b;
    const quotient = Q.from(this.value.dividedBy(o.value));
    return this.ok && o.ok && quotient.ok ? quotient : Q.of(1, 0);
  }

  lt(b: Q): boolean {
    return this.value.lessThan(b.value);
  }
  gt(b: Q): boolean {
    return b.value.lessThan(this.value);
  }
  /** Swift's derived `<=`. */
  le(b: Q): boolean {
    return !b.value.lessThan(this.value);
  }
  ge(b: Q): boolean {
    return !this.value.lessThan(b.value);
  }
  /** Swift's synthesized `==`: the same value and the same validity. */
  eq(b: Q): boolean {
    return this.ok === b.ok && this.value.equals(b.value);
  }
  /** A key for Set/Dictionary use (Swift Hashable). */
  get key(): string {
    return `${this.value.numerator}/${this.value.denominator}/${this.ok}`;
  }

  /** This value to a whole-number power; a negative power takes the reciprocal. */
  power(exponent: number): Q {
    let result = Q.of(1);
    for (let i = 0; i < Math.abs(exponent); i++) result = result.times(this);
    return exponent < 0 ? result.reciprocal : result;
  }
}

/** Swift `Rational(Int)`. */
export const R = (n: number): Rational => Rational.whole(n);

export type Range = readonly [number, number];

/** Seeded numbers for the problem templates (SplitMix64 through `LearnRandom`). */
export class Gen {
  private random: LearnRandom;

  constructor(seed: bigint) {
    this.random = new LearnRandom(seed);
  }

  /** A number from the closed range lo...hi, every value about equally likely (`next() % span`, not Lemire). */
  int(lower: number, upper: number): number {
    const span = BigInt(upper - lower + 1);
    return lower + Number(this.random.next() % span);
  }

  /** A number from the range that is not zero. */
  nonZero(lower: number, upper: number): number {
    let value = 0;
    while (value === 0) value = this.int(lower, upper);
    return value;
  }

  /** A number from the range for the difficulty level 1, 2 or 3. */
  level(level: number, easy: Range, medium: Range, hard: Range): number {
    const r = level <= 1 ? easy : level === 2 ? medium : hard;
    return this.int(r[0], r[1]);
  }

  pick<U>(items: readonly U[]): U {
    return items[this.int(0, items.length - 1)];
  }

  /** True in `percent` of 100 draws. */
  chance(percent: number): boolean {
    return this.int(1, 100) <= percent;
  }

  sign(): number {
    return this.chance(50) ? 1 : -1;
  }

  shuffled<U>(items: readonly U[]): U[] {
    const result = items.slice();
    if (result.length <= 1) return result;
    for (let index = result.length - 1; index > 0; index--) {
      const j = this.int(0, index);
      const a = result[index];
      result[index] = result[j];
      result[j] = a;
    }
    return result;
  }

  /** The generator itself, for the exercise factory that shuffles the options. */
  get rng(): LearnRandom {
    return this.random;
  }

  /** A fraction between 0 and 1 in lowest terms, with a denominator from the list (each at least 2). */
  properFraction(denominators: number[]): Q {
    for (let i = 0; i < 60; i++) {
      const denominator = this.pick(denominators);
      const numerator = this.int(1, denominator - 1);
      if (T.gcd(numerator, denominator) === 1) return Q.of(numerator, denominator);
    }
    return Q.of(1, denominators[0]);
  }

  /** A whole number from the range that has no common factor with `other`. */
  coprime(other: number, lower: number, upper: number): number | null {
    for (let i = 0; i < 60; i++) {
      const value = this.int(lower, upper);
      if (T.gcd(value, other) === 1) return value;
    }
    return null;
  }

  /** The first result of up to `tries` attempts that is not null. */
  attempt<U>(body: () => U | null | undefined, tries = 40): U | null {
    for (let i = 0; i < tries; i++) {
      const result = body();
      if (result !== null && result !== undefined) return result;
    }
    return null;
  }
}

// Lists of Q

/** The values that are whole numbers. */
export const wholes = (list: Q[]): Q[] => list.filter((q) => q.ok && q.isWhole);
/** The values above zero. */
export const positives = (list: Q[]): Q[] => list.filter((q) => q.ok && !q.isNegative && !q.isZero);
/** The values that end after at most `places` digits after the comma. */
export function decimals(list: Q[], places: number): Q[] {
  let scale = 1;
  for (let i = 0; i < places; i++) scale *= 10;
  return list.filter((q) => q.ok && scale % q.denominator === 0);
}

// Problems

/** How a number is shown to the student. */
export type Style =
  | { kind: 'plain' }
  | { kind: 'fraction' }
  | { kind: 'mixed' }
  | { kind: 'percent' }
  | { kind: 'degrees' }
  | { kind: 'unit'; unit: string }
  | { kind: 'pi' }
  | { kind: 'fractionUnit'; unit: string }
  | { kind: 'euro' };

export const S = {
  plain: { kind: 'plain' } as Style,
  fraction: { kind: 'fraction' } as Style,
  mixed: { kind: 'mixed' } as Style,
  percent: { kind: 'percent' } as Style,
  degrees: { kind: 'degrees' } as Style,
  pi: { kind: 'pi' } as Style,
  euro: { kind: 'euro' } as Style,
  unit: (unit: string): Style => ({ kind: 'unit', unit }),
  fractionUnit: (unit: string): Style => ({ kind: 'fractionUnit', unit }),
};

export function styleText(style: Style, value: Q, bare = false): string {
  switch (style.kind) {
    case 'plain':
      return T.number(value);
    case 'fraction':
      return T.fraction(value);
    case 'mixed':
      return T.mixed(value);
    case 'percent':
      return T.number(value) + (bare ? '' : ' %');
    case 'degrees':
      return T.number(value) + (bare ? '' : '°');
    case 'unit':
      return T.number(value) + (bare ? '' : ' ' + style.unit);
    case 'pi':
      return T.number(value) + (bare ? '' : 'π');
    case 'fractionUnit':
      return T.fraction(value) + (bare ? '' : ' ' + style.unit);
    case 'euro':
      return bare ? T.euroAmount(value).split(' €').join('') : T.euroAmount(value);
  }
}

/** A wrong answer: its text and, when it is a number, its value, so it can never equal the right answer. */
export interface Wrong {
  text: string;
  value: Rational | null;
}

/** A typed variant of the problem: what to ask and the exact answer. */
export interface Typed {
  prompt: string;
  answer: Rational;
  /** How the answer is written when it is shown; the decimal comma when it ends, else a fraction. */
  text?: string | null;
}

export interface Problem {
  prompt: string;
  correct: string;
  correctValue: Rational | null;
  wrong: Wrong[];
  typed: Typed | null;
  pairFront: string | null;
  pairPrompt: string;
  pairExplanation: string | null;
  solution: string;
  explanation: string;
  allowsEquivalentWrong: boolean;
}

export interface NumberProblemArgs {
  prompt: string;
  answer: Q;
  style?: Style;
  hint: string;
  wrong: Q[];
  extraWrong?: Wrong[];
  typedPrompt?: string | null;
  typedAnswer?: Q | null;
  pair?: string | null;
  solution: string;
  explanation: string;
}

/** A problem with a number as the answer. `wrong` are the values of typical mistakes (values equal to the answer are
 * dropped when the options are built), `extraWrong` mistakes that need their own text. */
export function numberProblem(a: NumberProblemArgs): Problem | null {
  const style = a.style ?? S.plain;
  const asked = a.typedAnswer ?? a.answer;
  if (!a.answer.ok || !asked.ok) return null;
  const typedPrompt = a.typedPrompt ?? a.prompt;
  return {
    prompt: a.prompt,
    correct: styleText(style, a.answer),
    correctValue: a.answer.value,
    wrong: [...a.wrong.filter((q) => q.ok).map((q) => ({ text: styleText(style, q), value: q.value })), ...(a.extraWrong ?? [])],
    typed: {
      prompt: typedPrompt + (a.hint === '' ? '' : '\n' + a.hint),
      answer: asked.value,
      text: a.typedAnswer == null ? styleText(style, asked, true) : T.number(asked),
    },
    pairFront: a.pair ?? null,
    pairPrompt: 'Ordne jeder Aufgabe ihr Ergebnis zu.',
    pairExplanation: null,
    solution: a.solution,
    explanation: a.explanation,
    allowsEquivalentWrong: false,
  };
}

export interface TextProblemArgs {
  prompt: string;
  correct: string;
  wrong: string[];
  typed?: Typed | null;
  pair?: string | null;
  solution: string;
  explanation: string;
}

/** A problem whose answer is a text (a term, a statement). */
export function textProblem(a: TextProblemArgs): Problem {
  return {
    prompt: a.prompt,
    correct: a.correct,
    correctValue: null,
    wrong: a.wrong.map((text) => ({ text, value: null })),
    typed: a.typed ?? null,
    pairFront: a.pair ?? null,
    pairPrompt: 'Ordne jeder Aufgabe ihr Ergebnis zu.',
    pairExplanation: null,
    solution: a.solution,
    explanation: a.explanation,
    allowsEquivalentWrong: false,
  };
}

/** What makes the problem this one: asking it twice with the same numbers is a repeat. */
export function problemKey(p: Problem): string {
  return p.prompt + '\u001F' + p.correct;
}

const trim = (text: string): string => text.replace(/^[\s]+|[\s]+$/g, '');

/** The wrong options that survive: not equal to the right answer in value or in the characters that count, and no
 * two alike. */
export function problemOptions(p: Problem): string[] {
  const seen = new Set<string>([folded(p.correct)]);
  const result: string[] = [];
  for (const candidate of p.wrong) {
    if (candidate.value !== null && p.correctValue !== null && candidate.value.equals(p.correctValue) && !p.allowsEquivalentWrong) continue;
    const text = trim(candidate.text);
    if (text === '') continue;
    const f = folded(text);
    if (seen.has(f)) continue;
    seen.add(f);
    result.push(text);
  }
  return result;
}

export type Form = 'choice' | 'typed' | 'pairs';

export interface Template {
  /** Like "u03.percentValue"; the ids of a unit start with its number. */
  id: string;
  /** The lesson of its unit that teaches it first, 1 to 3. */
  lesson: number;
  forms: ReadonlySet<Form>;
  make: (level: number, gen: Gen) => Problem | null;
}

export function template(
  id: string,
  lesson: number,
  forms: Form[] | null,
  make: (level: number, gen: Gen) => Problem | null,
): Template {
  const set = new Set<Form>(forms ?? ['choice', 'typed']);
  return {
    id,
    lesson,
    forms: set,
    make: (level, gen) => {
      const problem = make(level, gen);
      if (!problem) return null;
      // A choice needs two wrong options that survive; a draw with fewer is drawn again.
      if (set.has('choice') && problemOptions(problem).length < 2) return null;
      if (!set.has('typed')) problem.typed = null;
      if (!set.has('pairs')) problem.pairFront = null;
      return problem;
    },
  };
}
