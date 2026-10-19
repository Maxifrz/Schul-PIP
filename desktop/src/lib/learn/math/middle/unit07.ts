import { Rational } from '../../rational';
import { MathGen, Problem, Q, S, Style, Template, decimals, idiv, numberProblem, q, template, textProblem } from './core';
import { mathText as T } from './text';

/** Unit 7, Potenzen und Wurzeln: Potenzen und Quadratwurzeln (lesson 1), die Potenzgesetze (2), negative Exponenten, Zehnerpotenzen und Wurzelregeln (3). */

const minus = T.minus;
const valueHint = 'Gib die Zahl an.';

function ipow(base: number, exponent: number): number {
  let result = 1;
  for (let i = 0; i < Math.max(0, exponent); i++) result *= base;
  return result;
}

const letter = (gen: MathGen): string => gen.pick(['x', 'a', 'y', 'z']);
const qs = (values: number[]): Q[] => values.map((v) => q(v));

// Lesson 1

function fractionPower(gen: MathGen): Problem | null {
  const b = gen.int(2, 5);
  const a = gen.int(1, b - 1);
  const n = gen.int(2, 4);
  if (T.gcd(a, b) !== 1 || ipow(b, n) > 1000) return null;
  const base = q(a, b);
  const value = base.power(n);
  const text = `(${a}/${b})${T.sup(n)}`;
  // Only the numerator or only the denominator raised, base times exponent, one factor too few.
  const wrong = [q(ipow(a, n), b), q(a, ipow(b, n)), q(a * n, b), base.power(n - 1)];
  return numberProblem({
    prompt: `Berechne ${text}.`, answer: value, style: S.fraction, hint: 'Gib das Ergebnis als Bruch an.', wrong, pair: text,
    solution: `${text} = ${a}${T.sup(n)}/${b}${T.sup(n)} = ${ipow(a, n)}/${ipow(b, n)}`,
    explanation: 'Bei einem Bruch in der Klammer wird Zähler und Nenner mit der Hochzahl genommen.',
  });
}

function decimalPower(gen: MathGen): Problem | null {
  const digit = gen.int(1, 9);
  const n = gen.int(2, 3);
  const base = q(digit, 10);
  const value = base.power(n);
  if (decimals([value], 6).length !== 1) return null;
  const text = `(${T.number(base)})${T.sup(n)}`;
  // The comma one place off, base times exponent, one factor too few.
  const wrong = decimals([value.times(10), value.div(10), base.times(n), base.power(n - 1)], 6);
  return numberProblem({
    prompt: `Berechne ${text}.`, answer: value, hint: 'Gib das Ergebnis als Dezimalzahl an.', wrong, pair: text,
    solution: `${T.number(base)} · ${T.number(base)}${n === 3 ? ` · ${T.number(base)}` : ''} = ${T.number(value)}`,
    explanation: 'Rechne die Faktoren mit Komma aus und zähle die Nachkommastellen: Jeder Faktor bringt eine Stelle.',
  });
}

/** "Berechne 3⁴": the base is taken as a factor as often as the exponent says. */
function powerValue(level: number, gen: MathGen): Problem | null {
  if (level === 3) return gen.chance(55) ? fractionPower(gen) : decimalPower(gen);
  let base: number;
  let exponent: number;
  if (level === 1) {
    base = gen.pick([2, 3, 4, 5, 10]);
    exponent = base === 10 ? gen.int(2, 4) : gen.int(2, base <= 3 ? 4 : 3);
  } else {
    base = gen.int(2, 9);
    exponent = base === 2 ? gen.int(5, 9) : base === 3 ? gen.int(4, 6) : 3;
  }
  const value = ipow(base, exponent);
  if (value >= 1000) return null;
  // Base times exponent, exponent to the power of the base, one factor too few or too many.
  const wrong = [base * exponent, ipow(exponent, base), ipow(base, exponent - 1), ipow(base, exponent + 1)].filter((v) => v < 100000);
  const text = T.power(base, exponent);
  const factors = Array(exponent).fill(String(base)).join(' · ');
  return numberProblem({
    prompt: `Berechne ${text}.`, answer: q(value), hint: valueHint, wrong: qs(wrong), pair: text, solution: `${text} = ${factors} = ${value}`,
    explanation: `Die Hochzahl sagt, wie oft die Basis als Faktor vorkommt: ${base}${T.sup(exponent)} heißt ${exponent} Faktoren ${base}, nicht ${base} · ${exponent}.`,
  });
}

/** "−3² oder (−3)²?" Brackets decide what is squared. */
function negativeBase(level: number, gen: MathGen): Problem | null {
  if (level === 3) {
    const a = gen.int(2, 4);
    const b = gen.int(2, 4);
    const value = -a * a + ipow(b, 3);
    if (value === 0) return null;
    const text = `${minus}${a}² ${minus} (${minus}${b})³`;
    // The first minus dropped, the cube's sign dropped, both dropped, products instead of powers.
    const wrong = [a * a + ipow(b, 3), -a * a - ipow(b, 3), a * a - ipow(b, 3), -a * 2 + b * 3];
    return numberProblem({
      prompt: `Berechne ${text}.`, answer: q(value), hint: valueHint, wrong: qs(wrong), pair: text,
      solution: `${minus}${a}² = ${minus}${a * a}; (${minus}${b})³ = ${minus}${ipow(b, 3)}; ${T.int(-a * a)} ${minus} (${minus}${ipow(b, 3)}) = ${T.int(value)}`,
      explanation: 'Ohne Klammer wird nur die Zahl potenziert, das Minus bleibt davor. Mit Klammer gehört das Minus zur Basis: ungerade Hochzahl gibt Minus, gerade gibt Plus.',
    });
  }
  const a = level === 1 ? gen.int(2, 6) : gen.int(2, 5);
  const n = level === 1 ? 2 : gen.int(2, 4);
  const bracket = gen.chance(50);
  const value = bracket ? (n % 2 === 0 ? ipow(a, n) : -ipow(a, n)) : -ipow(a, n);
  const text = bracket ? `(${minus}${a})${T.sup(n)}` : `${minus}${a}${T.sup(n)}`;
  const sign = value < 0 ? -1 : 1;
  // Base times exponent, in either sign, one factor too many or too few.
  const wrong = [a * n, -a * n, sign * ipow(a, n + 1), sign * ipow(a, n - 1)];
  const working = bracket
    ? `(${minus}${a})${T.sup(n)} = ${Array(n).fill(`(${minus}${a})`).join(' · ')} = ${T.int(value)}`
    : `${minus}${a}${T.sup(n)} = ${minus}(${Array(n).fill(String(a)).join(' · ')}) = ${T.int(value)}`;
  return numberProblem({
    prompt: `Berechne ${text}.`, answer: q(value), hint: valueHint, wrong: qs(wrong), pair: text, solution: working,
    explanation: bracket
      ? 'Mit Klammer gehört das Minus zur Basis: Bei gerader Hochzahl ist das Ergebnis positiv, bei ungerader negativ.'
      : `Ohne Klammer wird nur die Zahl potenziert, das Minus bleibt davor: ${minus}${a}${T.sup(n)} ist das Negative von ${a}${T.sup(n)}.`,
  });
}

/** "Berechne √144", "√0,49", "√(9/16)". */
function squareRoot(level: number, gen: MathGen): Problem | null {
  const kind = level === 1 ? 0 : level === 2 ? (gen.chance(60) ? 0 : 1) : gen.int(1, 2);
  if (kind === 0) {
    const r = level === 1 ? gen.int(2, 15) : gen.int(11, 25);
    const n = r * r;
    const wrong = [r + 1, r - 1, 2 * r];
    if (n % 2 === 0) wrong.push(n / 2);
    return numberProblem({
      prompt: `Berechne √${n}.`, answer: q(r), hint: valueHint, wrong: qs(wrong), pair: `√${n}`, solution: `${r}² = ${n}, also √${n} = ${r}`,
      explanation: 'Die Wurzel fragt nach der nichtnegativen Zahl, die quadriert den Wert unter der Wurzel ergibt. Lerne die Quadratzahlen bis 15² auswendig.',
    });
  }
  if (kind === 1) {
    const r = gen.pick([2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15]);
    const places = level === 3 && gen.chance(40) ? 4 : 2;
    const radicand = q(r * r, places === 2 ? 100 : 10000);
    const root = q(r, places === 2 ? 10 : 100);
    // The comma set in the wrong place, the digits of the root alone, half of the radicand.
    const wrong = decimals([root.div(10), root.times(10), radicand.div(2), q(r)], 5);
    return numberProblem({
      prompt: `Berechne √${T.number(radicand)}.`, answer: root, hint: 'Gib das Ergebnis als Dezimalzahl an.', wrong, pair: `√${T.number(radicand)}`,
      solution: `${T.number(root)}² = ${T.number(radicand)}, also √${T.number(radicand)} = ${T.number(root)}`,
      explanation: 'Bei Dezimalzahlen zählst du die Nachkommastellen: Das Quadrat hat doppelt so viele Stellen wie die Wurzel.',
    });
  }
  const den = gen.int(2, 12);
  const p = gen.int(1, den - 1);
  if (T.gcd(p, den) !== 1) return null;
  const root = q(p, den);
  // The root of the numerator alone, of the denominator alone, half of the radicand.
  const wrong = [q(p, den * den), q(p * p, den), q(p * p, 2 * den * den), q(p, 2 * den)];
  return numberProblem({
    prompt: `Berechne √(${p * p}/${den * den}).`, answer: root, style: S.fraction, hint: 'Gib das Ergebnis als Bruch an.', wrong, pair: `√(${p * p}/${den * den})`,
    solution: `√${p * p} = ${p} und √${den * den} = ${den}, also √(${p * p}/${den * den}) = ${p}/${den}`,
    explanation: 'Bei einem Bruch ziehst du die Wurzel aus Zähler und Nenner einzeln.',
  });
}

/** "Zwischen welchen ganzen Zahlen liegt √50?" The nearest squares decide. */
function estimateRoot(level: number, gen: MathGen): Problem | null {
  const n = level === 1 ? gen.int(2, 80) : level === 2 ? gen.int(10, 150) : gen.int(30, 400);
  let low = 1;
  while ((low + 1) * (low + 1) <= n) low += 1;
  if (low * low === n || low < 1) return null;
  // The square root of n is at least low and below low + 1; the nearest whole number by comparing n with low² + low.
  const nearest = n <= low * low + low ? low : low + 1;
  const correct = `${low} und ${low + 1}`;
  // The neighbouring pairs, and half of the number taken for the root.
  const half = idiv(n, 2);
  const wrong = [`${low - 1} und ${low}`, `${low + 1} und ${low + 2}`, `${low - 2} und ${low - 1}`, `${half} und ${half + 1}`]
    .filter((s) => s !== correct && !s.startsWith('0 ') && !s.startsWith('-'));
  return textProblem({
    prompt: `Zwischen welchen zwei aufeinanderfolgenden ganzen Zahlen liegt √${n}?`, correct, wrong,
    typed: { prompt: `Welche ganze Zahl ist √${n} am nächsten?`, answer: Rational.whole(nearest) },
    pair: `√${n}`,
    solution: `${low}² = ${low * low} und ${low + 1}² = ${(low + 1) * (low + 1)}; ${n} liegt dazwischen, also liegt √${n} zwischen ${low} und ${low + 1}`,
    explanation: 'Suche die Quadratzahlen links und rechts vom Wert unter der Wurzel. Ihre Wurzeln sind die beiden ganzen Zahlen.',
  });
}

// Lesson 2

/** One power as it is written: "2³", "x⁴", and just "x" for the exponent 1. */
const powerText = (base: string, exponent: number): string => (exponent === 1 ? base : T.powerOf(base, exponent));

/** The wrong results of a law of powers: each wrong exponent written out, leaving out any that is not a sensible exponent (zero, negative, huge) or that equals the right one. */
const wrongPowers = (base: string, exponents: number[], right: number): string[] => exponents.filter((e) => e >= 1 && e <= 40 && e !== right).map((e) => powerText(base, e));

/** "2³ · 2⁴" and "5⁹ : 5⁶": same base, exponents added or subtracted. */
function sameBase(level: number, gen: MathGen): Problem | null {
  const useLetter = level >= 2 && gen.chance(55);
  const base = useLetter ? letter(gen) : String(gen.pick(level === 1 ? [2, 3, 5, 10] : [2, 3, 4, 5, 6, 7, 10]));
  const numeric = /^\d+$/.test(base) ? Number(base) : null;
  const power = (e: number) => powerText(base, e);
  let expression: string;
  let exponent: number;
  let wrong: string[];
  let working: string;
  const multiplies = level === 1 || (level === 2 && gen.chance(55));
  if (multiplies) {
    const e1 = gen.int(2, 7);
    const e2 = gen.int(2, 7);
    expression = `${power(e1)} · ${power(e2)}`;
    exponent = e1 + e2;
    // The exponents multiplied, subtracted, one too many; the bases multiplied.
    wrong = wrongPowers(base, [e1 * e2, Math.abs(e1 - e2), e1 + e2 + 1], exponent);
    if (numeric !== null) wrong.push(T.power(numeric * numeric, e1 + e2));
    working = `${expression} = ${power(exponent)}, denn ${e1} + ${e2} = ${exponent}`;
  } else if (level === 2) {
    const e2 = gen.int(2, 5);
    const e1 = e2 + gen.int(2, 6);
    expression = `${power(e1)} : ${power(e2)}`;
    exponent = e1 - e2;
    // The exponents added or multiplied, one too many; the bases divided to 1.
    wrong = wrongPowers(base, [e1 + e2, e1 * e2, e1 + e2 - 1, ...(e1 % e2 === 0 ? [idiv(e1, e2)] : [])], exponent);
    if (numeric !== null) wrong.push(T.power(1, exponent));
    working = `${expression} = ${power(exponent)}, denn ${e1} ${minus} ${e2} = ${exponent}`;
  } else if (gen.chance(50)) {
    const e1 = gen.int(2, 4);
    const e2 = gen.int(2, 4);
    const e3 = gen.int(1, 4);
    expression = `${power(e1)} · ${power(e2)} · ${power(e3)}`;
    exponent = e1 + e2 + e3;
    // All exponents multiplied, the order of operations ignored.
    wrong = wrongPowers(base, [e1 * e2 * e3, e1 + e2 * e3, e1 * e2 + e3, exponent + 1], exponent);
    working = `${expression} = ${power(exponent)}, denn ${e1} + ${e2} + ${e3} = ${exponent}`;
  } else {
    const e1 = gen.int(3, 6);
    const e2 = gen.int(2, 4);
    const e3 = gen.int(2, 4);
    if (!(e1 + e2 > e3)) return null;
    expression = `(${power(e1)} · ${power(e2)}) : ${power(e3)}`;
    exponent = e1 + e2 - e3;
    // Multiplied instead of added, everything added, subtracted twice.
    wrong = wrongPowers(base, [e1 * e2 - e3, e1 + e2 + e3, e1 - e2 - e3, e1 + e2 * e3], exponent);
    working = `${power(e1)} · ${power(e2)} = ${power(e1 + e2)}; ${power(e1 + e2)} : ${power(e3)} = ${power(exponent)}`;
  }
  if (exponent < 1) return null;
  const problem = textProblem({
    prompt: `Vereinfache zu einer Potenz:\n${expression}`, correct: power(exponent), wrong,
    typed: { prompt: `Vereinfache ${expression} zu einer Potenz.\nWelche Zahl steht im Exponenten?`, answer: Rational.whole(exponent) },
    pair: expression, solution: working,
    explanation: 'Gleiche Basis: Beim Malnehmen addierst du die Exponenten, beim Teilen subtrahierst du sie. Die Basis bleibt.',
  });
  problem.pairPrompt = 'Vereinfache und ordne zu.';
  return problem;
}

/** "(2³)²" and "(x⁴)³ : x⁵": a power of a power multiplies the exponents. */
function powerOfPower(level: number, gen: MathGen): Problem | null {
  const useLetter = level >= 2 || gen.chance(50);
  const base = useLetter ? letter(gen) : String(gen.pick([2, 3, 5, 10]));
  const power = (e: number) => powerText(base, e);
  let expression: string;
  let exponent: number;
  let wrongExponents: number[];
  let working: string;
  if (level === 1) {
    const e1 = gen.int(2, 5);
    const e2 = gen.int(2, 4);
    expression = `(${power(e1)})${T.sup(e2)}`;
    exponent = e1 * e2;
    // The exponents added, or one raised to the other.
    wrongExponents = [e1 + e2, ipow(e1, e2), ipow(e2, e1)];
    working = `${expression} = ${power(exponent)}, denn ${e1} · ${e2} = ${exponent}`;
  } else if (level === 2) {
    const e1 = gen.int(2, 5);
    const e2 = gen.int(2, 4);
    const e3 = gen.int(2, 6);
    if (!(e1 * e2 > e3)) return null;
    expression = `(${power(e1)})${T.sup(e2)} : ${power(e3)}`;
    exponent = e1 * e2 - e3;
    // Added in the bracket, everything multiplied, the quotient taken at the end.
    wrongExponents = [e1 + e2 - e3, e1 * e2 * e3, e1 * e2 + e3, e1 * (e2 - e3)];
    working = `(${power(e1)})${T.sup(e2)} = ${power(e1 * e2)}; ${power(e1 * e2)} : ${power(e3)} = ${power(exponent)}`;
  } else {
    const e1 = gen.int(2, 4);
    const e2 = gen.int(2, 4);
    const e3 = gen.int(1, 5);
    expression = `(${power(e1)})${T.sup(e2)} · ${power(e3)}`;
    exponent = e1 * e2 + e3;
    // The last factor put into the bracket, everything added, everything multiplied.
    wrongExponents = [e1 * (e2 + e3), e1 + e2 + e3, e1 * e2 * e3, e1 + e2 * e3];
    working = `(${power(e1)})${T.sup(e2)} = ${power(e1 * e2)}; ${power(e1 * e2)} · ${power(e3)} = ${power(exponent)}`;
  }
  if (exponent < 2 || exponent > 40) return null;
  const problem = textProblem({
    prompt: `Vereinfache zu einer Potenz:\n${expression}`, correct: power(exponent), wrong: wrongPowers(base, wrongExponents, exponent),
    typed: { prompt: `Vereinfache ${expression} zu einer Potenz.\nWelche Zahl steht im Exponenten?`, answer: Rational.whole(exponent) },
    pair: expression, solution: working,
    explanation: 'Eine Potenz von einer Potenz: Die Exponenten werden multipliziert. Gleiche Basen beim Malnehmen: addieren, beim Teilen: subtrahieren.',
  });
  problem.pairPrompt = 'Vereinfache und ordne zu.';
  return problem;
}

function sameExponentAttempt(level: number, gen: MathGen): Problem | null {
  const multiplies = level === 1 || (level === 2 && gen.chance(50)) || (level === 3 && gen.chance(30));
  const n = level === 1 ? 2 : gen.int(2, 4);
  let a: number;
  let b: number;
  if (multiplies) {
    a = level === 1 ? gen.int(2, 5) : gen.int(2, 9);
    b = level === 1 ? gen.int(2, 5) : gen.int(2, 9);
  } else {
    b = level === 2 ? gen.int(2, 6) : gen.int(3, 9);
    a = b * (level === 2 ? gen.int(2, 5) : gen.int(2, 8));
  }
  if (!(a !== b || !multiplies)) return null;
  const result = multiplies ? a * b : idiv(a, b);
  if (result > 100 || result < 2) return null;
  const expression = multiplies ? `${T.power(a, n)} · ${T.power(b, n)}` : `${T.power(a, n)} : ${T.power(b, n)}`;
  const correct = T.power(result, n);
  const wrong = multiplies
    ? [T.power(a + b, n), T.power(a * b, 2 * n), T.power(a * b, n + 1), T.power(a * b, n - 1)]
    : [T.power(a - b, n), T.power(idiv(a, b), 1), T.power(idiv(a, b), 2 * n)];
  const problem = textProblem({
    prompt: `Fasse zu einer Potenz zusammen:\n${expression}`, correct, wrong: wrong.filter((w) => w !== correct && !w.endsWith('⁰')),
    typed: { prompt: `Fasse ${expression} zu einer Potenz zusammen.\nWelche Zahl steht in der Basis?`, answer: Rational.whole(result) },
    pair: expression,
    solution: multiplies ? `${expression} = (${a} · ${b})${T.sup(n)} = ${correct}` : `${expression} = (${a} : ${b})${T.sup(n)} = ${correct}`,
    explanation: 'Haben zwei Potenzen denselben Exponenten, darfst du die Basen malnehmen oder teilen und den Exponenten behalten.',
  });
  problem.pairPrompt = 'Fasse zusammen und ordne zu.';
  return problem;
}

/** "2³ · 5³ = ?³": the same exponent lets you put the bases together. */
const sameExponent = (level: number, gen: MathGen): Problem | null => gen.attempt(() => sameExponentAttempt(level, gen));

// Lesson 3

function negativeExponentAttempt(level: number, gen: MathGen): Problem | null {
  let text: string;
  let value: Q;
  let wrong: Q[];
  let working: string;
  if (level === 1) {
    const base = gen.pick([2, 3, 10, 5]);
    const n = gen.int(1, 3);
    value = q(1, ipow(base, n));
    text = T.power(base, -n);
    wrong = [q(ipow(base, n)), q(-base * n), q(1, base * n), q(1, ipow(base, Math.max(1, n - 1)))];
    working = `${text} = 1/${base}${T.sup(n)} = 1/${ipow(base, n)}`;
  } else if (level === 2) {
    const base = gen.int(2, 6);
    const n = gen.int(2, 3);
    value = q(1, ipow(base, n));
    text = T.power(base, -n);
    wrong = [q(ipow(base, n)), q(1, base * n), q(-base * n), q(1, ipow(base, n - 1)), q(1, ipow(base, n + 1))];
    working = `${text} = 1/${base}${T.sup(n)} = 1/${ipow(base, n)}`;
  } else if (gen.chance(50)) {
    // A fraction as base: the reciprocal of the fraction.
    const b = gen.int(2, 4);
    const a = gen.int(1, b + 1);
    if (a === b || T.gcd(a, b) !== 1) return null;
    const n = gen.int(2, 3);
    text = `(${a}/${b})${T.sup(-n)}`;
    value = q(b, a).power(n);
    wrong = [q(a, b).power(n), q(-a * n, b), q(b, a * n), q(b * n, a)];
    working = `(${a}/${b})${T.sup(-n)} = (${b}/${a})${T.sup(n)} = ${T.fraction(value)}`;
  } else {
    const base = gen.int(2, 4);
    const n = gen.pick([3, 5]);
    text = `(${minus}${base})${T.sup(-n)}`;
    value = q(1, -ipow(base, n));
    wrong = [q(ipow(base, n)), q(-base * n), q(1, base * n), q(1, ipow(base, n - 1))];
    working = `(${minus}${base})${T.sup(-n)} = 1/(${minus}${base})${T.sup(n)} = ${T.fraction(value)}`;
  }
  if (!value.ok || !(Math.abs(value.double) < 1000) || wrong.filter((w) => w.ok && !w.equals(value)).length < 2) return null;
  return numberProblem({
    prompt: `Schreibe ${text} als Bruch oder ganze Zahl.`, answer: value, style: S.fraction, hint: 'Gib das Ergebnis als Bruch oder ganze Zahl an, zum Beispiel 1/8.', wrong,
    pair: text, solution: working,
    explanation: `Ein negativer Exponent bedeutet den Kehrwert: a${T.sup(-2)} = 1/a². Das Vorzeichen des Exponenten ändert nicht das Vorzeichen der Zahl.`,
  });
}

/** "2⁻³ als Bruch": a negative exponent takes the reciprocal. */
const negativeExponent = (level: number, gen: MathGen): Problem | null => gen.attempt(() => negativeExponentAttempt(level, gen));

function scientificAttempt(level: number, gen: MathGen): Problem | null {
  // The digits of the mantissa as 1 to 99: 7 stands for 7, 45 for 4,5.
  const digits = gen.chance(40) ? gen.int(1, 9) : gen.int(11, 99);
  if (digits % 10 === 0) return null;
  const hasDecimal = digits >= 10;
  const mantissa = hasDecimal ? q(digits, 10) : q(digits);
  const exponent = level === 1 ? gen.int(2, 5) : level === 2 ? gen.int(4, 9) : -gen.int(2, 7);
  const value = mantissa.times(q(10).power(exponent));
  if (!value.ok) return null;
  let shown: string;
  if (exponent >= 0) {
    const whole = value.int;
    if (whole === null) return null;
    shown = T.grouped(whole);
  } else {
    shown = T.fixed(value, -exponent + (hasDecimal ? 1 : 0));
  }
  const form = (m: Q, e: number) => `${T.number(m)} · 10${T.sup(e)}`;
  const correct = form(mantissa, exponent);
  // Not normalised (the mantissa too big or too small), the exponent off by one, the wrong direction.
  const wrong = [form(mantissa.times(10), exponent - 1), form(mantissa.div(10), exponent + 1), form(mantissa, exponent - 1), form(mantissa, exponent + 1), form(mantissa.times(100), exponent - 2)];
  const problem = textProblem({
    prompt: `Schreibe ${shown} in der Form a · 10ⁿ mit 1 ≤ a < 10.`, correct, wrong,
    typed: { prompt: `Schreibe ${shown} in der Form a · 10ⁿ mit 1 ≤ a < 10.\nWelche Zahl steht im Exponenten?`, answer: Rational.whole(exponent) },
    pair: shown,
    solution: exponent >= 0 ? `Das Komma wandert um ${exponent} Stellen nach rechts: ${correct}` : `Das Komma wandert um ${-exponent} Stellen nach links, der Exponent ist negativ: ${correct}`,
    explanation: 'Vor dem Komma soll genau eine Ziffer ungleich 0 stehen. Der Exponent zählt, um wie viele Stellen das Komma dafür wandert: nach links positiv, nach rechts negativ.',
  });
  problem.pairPrompt = 'Schreibe mit Zehnerpotenz und ordne zu.';
  return problem;
}

/** "Schreibe 45 000 in der Form a · 10ⁿ mit 1 ≤ a < 10." Big and small numbers. */
const scientific = (level: number, gen: MathGen): Problem | null => gen.attempt(() => scientificAttempt(level, gen));

/** "Berechne √(9 + 16)": the root of a sum is not the sum of the roots. */
function rootOfSum(level: number, gen: MathGen): Problem | null {
  const triples: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [15, 20, 25], [20, 21, 29]];
  const [first, second, c] = gen.pick(level === 1 ? triples.slice(0, 3) : level === 2 ? triples.slice(0, 6) : triples);
  // The two legs in either order.
  const [a, b] = gen.chance(50) ? [first, second] : [second, first];
  const subtracts = level === 3 || (level === 2 && gen.chance(40));
  let text: string;
  let value: number;
  let wrong: number[];
  let working: string;
  if (subtracts) {
    const [x, y] = gen.chance(50) ? [a, b] : [b, a];
    text = `√(${c * c} ${minus} ${x * x})`;
    value = y;
    // The roots subtracted, the radicands subtracted without a root, half of that.
    wrong = [c - x, c * c - x * x, idiv(c * c - x * x, 2), c + x];
    working = `${c * c} ${minus} ${x * x} = ${y * y}, also √${y * y} = ${y}`;
  } else {
    text = `√(${a * a} + ${b * b})`;
    value = c;
    // The roots added, the radicands added without a root, half of that.
    wrong = [a + b, a * a + b * b, idiv(a * a + b * b, 2), c + 1];
    working = `${a * a} + ${b * b} = ${c * c}, also √${c * c} = ${c}`;
  }
  return numberProblem({
    prompt: `Berechne ${text}.`, answer: q(value), hint: valueHint, wrong: qs(wrong), pair: text, solution: working,
    explanation: 'Rechne zuerst unter der Wurzel. Die Wurzel einer Summe ist nicht die Summe der Wurzeln: √(9 + 16) = 5, aber √9 + √16 = 7.',
  });
}

function cubeProblem(radicand: string, root: Q, working: string, wrong: Q[], style: Style, hint: string): Problem | null {
  const text = `³√${radicand.startsWith(minus) ? `(${radicand})` : radicand}`;
  const problem = numberProblem({
    prompt: `Berechne ${text}.`, answer: root, style, hint, wrong: wrong.filter((w) => w.ok && !w.isZero), pair: text, solution: working,
    explanation: 'Die dritte Wurzel fragt nach der Zahl, die hoch 3 den Wert unter der Wurzel ergibt. Aus einer negativen Zahl darf man sie ziehen.',
  });
  if (problem) problem.pairPrompt = 'Berechne und ordne zu.';
  return problem;
}

/** "Berechne ³√125": the number that cubed gives the radicand. */
function cubeRoot(level: number, gen: MathGen): Problem | null {
  const r = level === 1 ? gen.int(2, 6) : level === 2 ? gen.int(3, 10) : gen.int(2, 9);
  if (level === 3) {
    switch (gen.int(0, 2)) {
      case 0: {
        // A negative radicand: the root is negative too.
        const n = ipow(r, 3);
        return cubeProblem(`${minus}${n}`, q(-r), `(${minus}${r})³ = ${minus}${n}, also ³√(${minus}${n}) = ${minus}${r}`, [q(r), q(-r * r), q(-3 * r), q(r * r)], S.plain, valueHint);
      }
      case 1: {
        const radicand = q(ipow(r, 3), 1000);
        const root = q(r, 10);
        if (r % 10 === 0) return null;
        return cubeProblem(T.number(radicand), root, `${T.number(root)}³ = ${T.number(radicand)}, also ³√${T.number(radicand)} = ${T.number(root)}`, [root.div(10), root.times(10), root.times(3), q(r)], S.plain, 'Gib das Ergebnis als Dezimalzahl an.');
      }
      default: {
        const den = gen.int(2, 5);
        const p = gen.int(1, den - 1);
        if (T.gcd(p, den) !== 1) return null;
        return cubeProblem(`(${ipow(p, 3)}/${ipow(den, 3)})`, q(p, den), `³√${ipow(p, 3)} = ${p} und ³√${ipow(den, 3)} = ${den}, also ${p}/${den}`, [q(p, ipow(den, 3)), q(ipow(p, 3), den), q(p * 3, den), q(p, den * 3)], S.fraction, 'Gib das Ergebnis als Bruch an.');
      }
    }
  }
  const n = ipow(r, 3);
  // The square instead of the root, three times the root, the root off by one, the number divided by 3.
  const wrong = [r * r, 3 * r, r + 1, r - 1];
  if (n % 3 === 0) wrong.push(n / 3);
  return cubeProblem(String(n), q(r), `${r}³ = ${n}, also ³√${n} = ${r}`, qs(wrong), S.plain, valueHint);
}

export const unit07: Template[] = [
  template('u07.powerValue', 1, powerValue, ['choice', 'typed', 'pairs']),
  template('u07.negativeBase', 1, negativeBase, ['choice', 'typed', 'pairs']),
  template('u07.squareRoot', 1, squareRoot, ['choice', 'typed', 'pairs']),
  template('u07.estimateRoot', 1, estimateRoot, ['choice', 'typed', 'pairs']),
  template('u07.sameBase', 2, sameBase, ['choice', 'typed', 'pairs']),
  template('u07.powerOfPower', 2, powerOfPower, ['choice', 'typed', 'pairs']),
  template('u07.sameExponent', 2, sameExponent, ['choice', 'typed', 'pairs']),
  template('u07.negativeExponent', 3, negativeExponent, ['choice', 'typed', 'pairs']),
  template('u07.scientific', 3, scientific, ['choice', 'typed', 'pairs']),
  template('u07.rootOfSum', 3, rootOfSum, ['choice', 'typed', 'pairs']),
  template('u07.cubeRoot', 3, cubeRoot, ['choice', 'typed', 'pairs']),
];
