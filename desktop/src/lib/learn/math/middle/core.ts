import { folded } from '../../exercise';
import { LearnRandom } from '../../random';
import { Rational } from '../../rational';
import { gcd, mathText as T } from './text';

/** Exact arithmetic without optionals, for the small numbers of the middle-school course. A result is only trusted while `ok` is true: dividing by zero or overflowing clears it, and a problem built from such a value is dropped. */
export class Q {
  readonly value: Rational;
  readonly ok: boolean;

  constructor(numerator: number | Rational | null, denominator = 1) {
    if (numerator === null) {
      this.value = Rational.whole(0);
      this.ok = false;
    } else if (typeof numerator === 'number') {
      const r = Rational.of(numerator, denominator);
      this.value = r ?? Rational.whole(0);
      this.ok = r !== null;
    } else {
      this.value = numerator;
      this.ok = true;
    }
  }

  get numerator(): number { return this.value.numerator; }
  get denominator(): number { return this.value.denominator; }
  get isWhole(): boolean { return this.value.isWhole; }
  get double(): number { return this.value.value; }
  get isZero(): boolean { return this.value.numerator === 0; }
  get isNegative(): boolean { return this.value.numerator < 0; }
  /** The value as a whole number, null for a fraction. */
  get int(): number | null { return this.value.isWhole ? this.value.numerator : null; }
  get reciprocal(): Q { return new Q(1).div(this); }
  get negated(): Q { return new Q(-this.numerator, this.denominator); }
  get magnitude(): Q { return this.isNegative ? this.negated : this; }

  private combine(other: Q | number, op: (a: Rational, b: Rational) => Rational | null): Q {
    const b = typeof other === 'number' ? new Q(other) : other;
    if (!this.ok || !b.ok) return new Q(1, 0);
    const result = op(this.value, b.value);
    return result === null ? new Q(1, 0) : new Q(result);
  }

  plus(other: Q | number): Q { return this.combine(other, (a, b) => a.plus(b)); }
  minus(other: Q | number): Q { return this.combine(other, (a, b) => a.minus(b)); }
  times(other: Q | number): Q { return this.combine(other, (a, b) => a.times(b)); }
  div(other: Q | number): Q { return this.combine(other, (a, b) => a.dividedBy(b)); }
  lessThan(other: Q | number): boolean { return this.value.lessThan((typeof other === 'number' ? new Q(other) : other).value); }
  greaterThan(other: Q | number): boolean { return (typeof other === 'number' ? new Q(other) : other).value.lessThan(this.value); }
  equals(other: Q | number): boolean { return this.value.equals((typeof other === 'number' ? new Q(other) : other).value); }

  /** This value to a whole-number power; a negative power takes the reciprocal. */
  power(exponent: number): Q {
    let result = new Q(1);
    for (let i = 0; i < Math.abs(exponent); i++) result = result.times(this);
    return exponent < 0 ? result.reciprocal : result;
  }
}

export const q = (numerator: number, denominator = 1): Q => new Q(numerator, denominator);
/** A fraction that may have overflowed: `ok` is false for null. */
export const qOf = (rational: Rational | null): Q => new Q(rational);

/** Seeded numbers for the problem templates (SplitMix64 through `LearnRandom`). The same seed draws the same numbers, in this order, on every platform. */
export class MathGen {
  private random: LearnRandom;

  constructor(seed: bigint) {
    this.random = new LearnRandom(seed);
  }

  /** A number from the range (both ends included), every value about equally likely. */
  int(low: number, high: number): number {
    return low + Number(this.random.next() % BigInt(high - low + 1));
  }

  /** A number from the range that is not zero. */
  nonZero(low: number, high: number): number {
    let value = 0;
    while (value === 0) value = this.int(low, high);
    return value;
  }

  /** A number for the difficulty level 1, 2 or 3. */
  level(level: number, easy: [number, number], medium: [number, number], hard: [number, number]): number {
    const [low, high] = level <= 1 ? easy : level === 2 ? medium : hard;
    return this.int(low, high);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** True in `percent` of 100 draws. */
  chance(percent: number): boolean {
    return this.int(1, 100) <= percent;
  }

  sign(): number {
    return this.chance(50) ? 1 : -1;
  }

  shuffled<T>(items: readonly T[]): T[] {
    const result = [...items];
    if (result.length <= 1) return result;
    for (let index = result.length - 1; index > 0; index--) {
      const other = this.int(0, index);
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  /** The generator itself, for the exercise factory that shuffles the options. */
  withRandom<R>(body: (random: LearnRandom) => R): R {
    return body(this.random);
  }

  /** A fraction between 0 and 1 in lowest terms, with a denominator from the list (each at least 2). */
  properFraction(denominators: number[]): Q {
    for (let i = 0; i < 60; i++) {
      const denominator = this.pick(denominators);
      const numerator = this.int(1, denominator - 1);
      if (gcd(numerator, denominator) === 1) return q(numerator, denominator);
    }
    return q(1, denominators[0]);
  }

  /** A whole number from the range that has no common factor with `other`. */
  coprime(other: number, low: number, high: number): number | null {
    for (let i = 0; i < 60; i++) {
      const value = this.int(low, high);
      if (gcd(value, other) === 1) return value;
    }
    return null;
  }

  /** The first result of up to `tries` attempts that is not null. A template draws its numbers inside the attempt, so a draw whose typical mistakes come out ugly is simply drawn again. */
  attempt<R>(body: () => R | null | undefined, tries = 40): R | null {
    for (let i = 0; i < tries; i++) {
      const result = body();
      if (result !== null && result !== undefined) return result;
    }
    return null;
  }
}

/** The values that are whole numbers; a list of wrong options for a whole-number answer keeps no ugly fractions. */
export const wholes = (list: Q[]): Q[] => list.filter((x) => x.ok && x.isWhole);
/** The values above zero. */
export const positives = (list: Q[]): Q[] => list.filter((x) => x.ok && !x.isNegative && !x.isZero);
/** The values that end after at most `places` digits after the comma. */
export const decimals = (list: Q[], places: number): Q[] => list.filter((x) => x.ok && 10 ** places % x.denominator === 0);

/** How a number is shown to the student. */
export type Style =
  | { k: 'plain' } | { k: 'fraction' } | { k: 'mixed' } | { k: 'percent' } | { k: 'degrees' } | { k: 'pi' } | { k: 'euro' }
  | { k: 'unit'; unit: string } | { k: 'fractionUnit'; unit: string };

export const S = {
  plain: { k: 'plain' } as Style,
  fraction: { k: 'fraction' } as Style,
  mixed: { k: 'mixed' } as Style,
  percent: { k: 'percent' } as Style,
  degrees: { k: 'degrees' } as Style,
  pi: { k: 'pi' } as Style,
  euro: { k: 'euro' } as Style,
  unit: (unit: string): Style => ({ k: 'unit', unit }),
  fractionUnit: (unit: string): Style => ({ k: 'fractionUnit', unit }),
};

export function styleText(style: Style, value: Q, bare = false): string {
  switch (style.k) {
    case 'plain': return T.number(value);
    case 'fraction': return T.fraction(value);
    case 'mixed': return T.mixed(value);
    case 'percent': return T.number(value) + (bare ? '' : ' %');
    case 'degrees': return T.number(value) + (bare ? '' : '°');
    case 'unit': return T.number(value) + (bare ? '' : ` ${style.unit}`);
    case 'pi': return T.number(value) + (bare ? '' : 'π');
    case 'fractionUnit': return T.fraction(value) + (bare ? '' : ` ${style.unit}`);
    case 'euro': return bare ? T.euroAmount(value).replace(' €', '') : T.euroAmount(value);
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
  text?: string;
}

/** One generated problem before it is put to the student: the question, the exact answer and the wrong answers that come from typical mistakes. */
export interface Problem {
  /** The question for a choice, and the base of the typed question. */
  prompt: string;
  /** The right option, as the student reads it. */
  correct: string;
  correctValue: Rational | null;
  wrong: Wrong[];
  typed?: Typed;
  /** A short front for a round of pairs; the back is `correct`. */
  pairFront?: string;
  pairPrompt: string;
  pairExplanation?: string;
  /** The worked result, shown after a wrong answer. */
  solution: string;
  /** One or two sentences on the method. */
  explanation: string;
  /** For the one template in which a wrong option may be equal in value to the right one: reducing "so weit wie möglich". */
  allowsEquivalentWrong: boolean;
}

export const pairPromptDefault = 'Ordne jeder Aufgabe ihr Ergebnis zu.';

/** A problem with a number as the answer. `wrong` are the values of typical mistakes (values equal to the answer are dropped when the options are built), `extraWrong` mistakes that need their own text. */
export function numberProblem(p: {
  prompt: string; answer: Q; style?: Style; hint: string; wrong: Q[]; extraWrong?: Wrong[]; typedPrompt?: string; typedAnswer?: Q; pair?: string; solution: string; explanation: string;
}): Problem | null {
  const style = p.style ?? S.plain;
  const asked = p.typedAnswer ?? p.answer;
  if (!p.answer.ok || !asked.ok) return null;
  return {
    prompt: p.prompt, correct: styleText(style, p.answer), correctValue: p.answer.value,
    wrong: [...p.wrong.filter((w) => w.ok).map((w) => ({ text: styleText(style, w), value: w.value })), ...(p.extraWrong ?? [])],
    typed: { prompt: (p.typedPrompt ?? p.prompt) + (p.hint === '' ? '' : `\n${p.hint}`), answer: asked.value, text: p.typedAnswer === undefined ? styleText(style, asked, true) : T.number(asked) },
    pairFront: p.pair, pairPrompt: pairPromptDefault, solution: p.solution, explanation: p.explanation, allowsEquivalentWrong: false,
  };
}

/** A problem whose answer is a text (a term, a statement); `wrong` are the texts of typical mistakes. Give `typed` when a number can be asked about the same situation. */
export function textProblem(p: { prompt: string; correct: string; wrong: string[]; typed?: Typed; pair?: string; solution: string; explanation: string }): Problem {
  return {
    prompt: p.prompt, correct: p.correct, correctValue: null, wrong: p.wrong.map((text) => ({ text, value: null })), typed: p.typed, pairFront: p.pair,
    pairPrompt: pairPromptDefault, solution: p.solution, explanation: p.explanation, allowsEquivalentWrong: false,
  };
}

/** What makes the problem this one: asking it twice with the same numbers is a repeat. */
export const problemKey = (p: Problem): string => `${p.prompt}\u001F${p.correct}`;

/** The wrong options that survive: not equal to the right answer in value or in the characters that count, and no two alike. */
export function problemOptions(p: Problem): string[] {
  const seen = new Set([folded(p.correct)]);
  const result: string[] = [];
  for (const candidate of p.wrong) {
    if (candidate.value && p.correctValue && candidate.value.equals(p.correctValue) && !p.allowsEquivalentWrong) continue;
    const text = candidate.text.trim();
    if (text === '' || seen.has(folded(text))) continue;
    seen.add(folded(text));
    result.push(text);
  }
  return result;
}

export type Form = 'choice' | 'typed' | 'pairs';

/** A kind of problem the course can draw again and again with new numbers. */
export interface Template {
  /** Like "u03.percentValue"; the ids of a unit start with its number. */
  id: string;
  /** The lesson of its unit that teaches it first, 1 to 3. */
  lesson: number;
  /** The forms it can be put in. A template that lists a form always has the material for it. */
  forms: Set<Form>;
  /** A problem at the difficulty level 1 (easy), 2 (medium) or 3 (hard), or null when the numbers drawn are no good. */
  make(level: number, gen: MathGen): Problem | null;
}

export function template(id: string, lesson: number, make: (level: number, gen: MathGen) => Problem | null, forms: Form[] = ['choice', 'typed']): Template {
  const set = new Set(forms);
  return {
    id, lesson, forms: set,
    make(level, gen) {
      const made = make(level, gen);
      if (!made) return null;
      const problem = { ...made };
      // A choice needs two wrong options that survive; a draw with fewer is drawn again.
      if (set.has('choice') && problemOptions(problem).length < 2) return null;
      // A form the template does not list is not offered, so what a problem carries always matches `forms`.
      if (!set.has('typed')) delete problem.typed;
      if (!set.has('pairs')) delete problem.pairFront;
      return problem;
    },
  };
}

/** Sorts by a "comes before" predicate, the way Swift's `sorted(by:)` takes it. */
export function sortedBy<T>(list: readonly T[], less: (a: T, b: T) => boolean): T[] {
  return list.map((item, index) => ({ item, index })).sort((a, b) => (less(a.item, b.item) ? -1 : less(b.item, a.item) ? 1 : a.index - b.index)).map((e) => e.item);
}

/** Whole-number division that cuts towards zero, like Swift's `/` on integers. */
export const idiv = (a: number, b: number): number => Math.trunc(a / b);

/** The distinct values of a list of fractions. */
export const distinctCount = (list: Q[]): number => new Set(list.map((x) => x.value.fractionText)).size;
