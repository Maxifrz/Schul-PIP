import { Rational } from '../../rational';
import { MathGen, Problem, Q, Template, Typed, decimals, numberProblem, q, template, textProblem } from './core';
import { mathText as T } from './text';

/**
 * Unit 9, Quadratische Gleichungen und Funktionen: Scheitelpunktform, Verschiebung und Funktionswerte (lesson 1), rein quadratische Gleichungen, Faktorform und Nullstellen (2), pq-Formel, Diskriminante und Normalform (3).
 *
 * Options of a choice never differ only by a sign ("S(3|2)" and "S(−3|2)"): the exercise factory reads letters and digits only, so such options would count as one. Sign mistakes are asked in words ("3 nach links") or in a typed answer, where the sign counts.
 */

const minus = T.minus;
const valueHint = 'Gib die Zahl an.';
const num = (x: Q): string => T.number(x);
const key = (x: Q): string => x.value.fractionText;
/** The two numbers as an unordered set, for comparing pairs of solutions. */
const setKey = (a: Q, b: Q): string => [key(a), key(b)].sort().join('|');

// Writing

function coefficientText(a: Q): string {
  if (a.equals(1)) return '';
  if (a.equals(-1)) return minus;
  return num(a);
}

/** "y = 2(x + 1)² − 5": the vertex form, with the bracket left out when d is 0. */
function vertexText(a: Q, d: number, e: number): string {
  let text = `y = ${coefficientText(a)}`;
  text += d === 0 ? 'x²' : `(x ${d > 0 ? minus : '+'} ${Math.abs(d)})²`;
  if (e !== 0) text += (e > 0 ? ' + ' : ` ${minus} `) + String(Math.abs(e));
  return text;
}

/** "x² − 5x + 6": the normal form with a, p and q possibly decimals. */
function quadratic(a: Q, p: Q, r: Q): string {
  let text = `${coefficientText(a)}x²`;
  if (!p.isZero) text += `${p.isNegative ? ` ${minus} ` : ' + '}${p.magnitude.equals(1) ? '' : num(p.magnitude)}x`;
  if (!r.isZero) text += (r.isNegative ? ` ${minus} ` : ' + ') + num(r.magnitude);
  return text;
}

const vertexPoint = (x: Q, y: Q): string => `S(${num(x)}|${num(y)})`;

/** Two solutions, the larger first: "3 und −1". */
const pair = (x: Q, y: Q): string => (x.lessThan(y) ? `${num(y)} und ${num(x)}` : `${num(x)} und ${num(y)}`);

function isqrt(n: number): number | null {
  if (n < 0) return null;
  let root = Math.floor(Math.sqrt(n));
  while (root * root > n) root -= 1;
  while ((root + 1) * (root + 1) <= n) root += 1;
  return root * root === n ? root : null;
}

/** The exact square root of a fraction, null if it is not a fraction of squares. */
function rationalRoot(x: Q): Q | null {
  if (!x.ok || x.isNegative) return null;
  const top = isqrt(x.numerator);
  const bottom = isqrt(x.denominator);
  return top === null || bottom === null ? null : q(top, bottom);
}

const larger = (a: Q, b: Q): Q => (a.lessThan(b) ? b : a);
const smaller = (a: Q, b: Q): Q => (a.lessThan(b) ? a : b);

// Lesson 1

/** "Lies den Scheitelpunkt ab: y = (x − 3)² + 2": the sign of d is the opposite of the sign in the bracket. */
function vertexForm(level: number, gen: MathGen): Problem | null {
  let a: Q;
  let d = gen.nonZero(-6, 6);
  let e = gen.nonZero(-8, 8);
  switch (level) {
    case 1:
      a = q(1);
      break;
    case 2:
      a = q(1);
      if (gen.chance(30)) d = 0;
      else if (gen.chance(30)) e = 0;
      break;
    default:
      a = gen.pick([q(2), q(3), q(-1), q(-2), q(1, 2), q(-1, 2), q(3)]);
  }
  if (d === 0 && e === 0) return null;
  const equation = vertexText(a, d, e);
  const asksX = gen.chance(50);
  const typed: Typed = { prompt: `${asksX ? 'Welche x-Koordinate hat der Scheitelpunkt?' : 'Welche y-Koordinate hat der Scheitelpunkt?'}\n${equation}`, answer: Rational.whole(asksX ? d : e) };
  const problem = textProblem({
    prompt: `Lies den Scheitelpunkt ab.\n${equation}`, correct: vertexPoint(q(d), q(e)), wrong: [], typed, pair: equation,
    solution: `In y = a(x − d)² + e ist S(d|e) der Scheitelpunkt. Hier: ${vertexPoint(q(d), q(e))}${d === 0 ? '' : `; die Klammer (x ${d > 0 ? minus : '+'} ${Math.abs(d)}) gibt d = ${T.int(d)}`}`,
    explanation: 'In der Scheitelpunktform y = a(x − d)² + e liest du d mit umgekehrtem Vorzeichen aus der Klammer ab; e steht ohne Änderung hinten. Der Faktor a ändert den Scheitelpunkt nicht.',
  });
  problem.pairPrompt = 'Lies den Scheitelpunkt ab und ordne zu.';
  return problem;
}

/** "Wo liegt der Scheitelpunkt?" The four ways left or right, above or below, in words. */
function shift(level: number, gen: MathGen): Problem | null {
  const d = level === 1 ? gen.nonZero(-5, 5) : gen.nonZero(-8, 8);
  const e = level === 1 ? gen.nonZero(-5, 5) : gen.nonZero(-9, 9);
  const a = level === 1 ? q(1) : level === 2 ? gen.pick([q(2), q(3), q(1, 2)]) : gen.pick([q(-1), q(-2), q(2), q(-3), q(1, 2)]);
  const words = (right: boolean, up: boolean) => `${Math.abs(d)} nach ${right ? 'rechts' : 'links'} und ${Math.abs(e)} nach ${up ? 'oben' : 'unten'}`;
  const correct = words(d > 0, e > 0);
  const wrong = [words(d < 0, e > 0), words(d > 0, e < 0), words(d < 0, e < 0)];
  return textProblem({
    prompt: `Wo liegt der Scheitelpunkt der Parabel, vom Ursprung aus gesehen?\n${vertexText(a, d, e)}`, correct, wrong,
    solution: `d = ${T.int(d)} und e = ${T.int(e)}, also S(${T.int(d)}|${T.int(e)}): ${correct}`,
    explanation: 'Die Klammer (x + 3) heißt: Verschiebung um 3 nach links, (x − 3) um 3 nach rechts. Die Zahl hinten verschiebt nach oben (plus) oder unten (minus).',
  });
}

/** "f(x) = x² − 4x + 3, berechne f(−2)": the square of a negative number is positive. */
function functionValue(level: number, gen: MathGen): Problem | null {
  let a: number;
  let b: number;
  let c: number;
  let x: number;
  switch (level) {
    case 1:
      a = gen.pick([1, 1, 2, 3]);
      b = 0;
      c = gen.int(-9, 9);
      x = gen.int(1, 5);
      break;
    case 2:
      a = 1;
      b = gen.nonZero(-6, 6);
      c = gen.nonZero(-9, 9);
      x = gen.nonZero(-4, 4);
      break;
    default:
      a = gen.pick([2, 3, -1, -2, 1]);
      b = gen.nonZero(-6, 6);
      c = gen.nonZero(-9, 9);
      x = gen.nonZero(-4, 4);
  }
  const value = a * x * x + b * x + c;
  const term = T.polynomial([a, b, c]);
  if (Math.abs(value) > 120) return null;
  // x² read as 2x or as x, a·x squared as a whole, a negative square taken as negative, the factor x forgotten at b.
  const wrong = [2 * a * x + b * x + c, a * x + b * x + c, a * x * (a * x) + b * x + c, -a * x * x + b * x + c, a * x * x + b + c, a * x * x - b * x + c];
  let expression = `${a} · ${T.bracketed(x)}²`;
  let evaluated = T.int(a * x * x);
  if (b !== 0) {
    expression += ` ${T.plusMinus(b)} · ${T.bracketed(x)}`;
    evaluated += ` ${T.plusMinus(b * x)}`;
  }
  if (c !== 0) {
    expression += ` ${T.plusMinus(c)}`;
    evaluated += ` ${T.plusMinus(c)}`;
  }
  return numberProblem({
    prompt: `Gegeben: f(x) = ${term}\nBerechne f(${T.int(x)}).`, answer: q(value), hint: valueHint, wrong: wrong.map((v) => q(v)),
    pair: `f(x) = ${term}, f(${T.int(x)})`, solution: `f(${T.int(x)}) = ${expression} = ${evaluated} = ${T.int(value)}`,
    explanation: 'Setze x ein und rechne erst die Potenz, dann Punkt vor Strich. Das Quadrat einer negativen Zahl ist positiv: (−2)² = 4.',
  });
}

/** "Welchen kleinsten Wert hat y = (x − 3)² + 2?" The vertex is the lowest (a > 0) or the highest (a < 0) point. */
function extremum(level: number, gen: MathGen): Problem | null {
  const a: Q = level === 1 ? q(1) : gen.pick([q(1), q(2), q(-1), q(-2), q(3), q(-3)]);
  const d = gen.nonZero(-6, 6);
  const e = gen.nonZero(-9, 9);
  const asksValue = gen.chance(50);
  const lowest = !a.isNegative;
  const equation = vertexText(a, d, e);
  const answer = asksValue ? e : d;
  const wrong = asksValue ? [d, e + d, e - d, d * e] : [e, d + e, d - e, d * e];
  const prompt = asksValue
    ? `Welchen ${lowest ? 'kleinsten' : 'größten'} Funktionswert hat die Parabel?\n${equation}`
    : `Für welches x ist der Funktionswert ${lowest ? 'am kleinsten' : 'am größten'}?\n${equation}`;
  const problem = numberProblem({
    prompt, answer: q(answer), hint: valueHint, wrong: wrong.map((v) => q(v)),
    pair: (asksValue ? (lowest ? 'kleinster Wert: ' : 'größter Wert: ') : `Stelle des ${lowest ? 'Minimums' : 'Maximums'}: `) + equation,
    solution: `Der Scheitelpunkt ist S(${T.int(d)}|${T.int(e)}). Die Parabel ist nach ${lowest ? 'oben' : 'unten'} geöffnet, also ist S der ${lowest ? 'tiefste' : 'höchste'} Punkt: ${asksValue ? `y = ${T.int(e)}` : `x = ${T.int(d)}`}`,
    explanation: 'Bei a > 0 ist die Parabel nach oben geöffnet, ihr Scheitelpunkt ist der tiefste Punkt. Bei a < 0 ist sie nach unten geöffnet, und der Scheitelpunkt ist der höchste Punkt.',
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Aufgabe die gesuchte Zahl zu.';
  return problem;
}

// Lesson 2

/** "x² = 49": two solutions, the root and its opposite. */
function pureQuadratic(level: number, gen: MathGen): Problem | null {
  const r = level === 3 ? gen.int(2, 10) : gen.int(2, 12);
  let equation: string;
  let working: string;
  const both = `also x = ${r} oder x = ${minus}${r}`;
  if (level === 1) {
    equation = `x² = ${r * r}`;
    working = `x² = ${r * r}, ${both}`;
  } else if (level === 2) {
    if (gen.chance(50)) {
      equation = `x² ${minus} ${r * r} = 0`;
      working = `x² = ${r * r}, ${both}`;
    } else {
      const k = gen.int(1, 20);
      equation = `x² + ${k} = ${r * r + k}`;
      working = `x² = ${r * r + k} ${minus} ${k} = ${r * r}, ${both}`;
    }
  } else {
    const a = gen.int(2, 5);
    if (gen.chance(50)) {
      equation = `${a}x² = ${a * r * r}`;
      working = `x² = ${a * r * r} : ${a} = ${r * r}, ${both}`;
    } else {
      const b = gen.int(1, 12);
      if (!(a * r * r - b > 0)) return null;
      equation = `${a}x² ${minus} ${b} = ${a * r * r - b}`;
      working = `${a}x² = ${a * r * r}; x² = ${r * r}, ${both}`;
    }
  }
  // Only one solution, the root forgotten, the square halved instead of rooted.
  const wrong = [`${r}`, `${r * r} und ${minus}${r * r}`, pair(q(r, 2), q(-r, 2))];
  const problem = textProblem({
    prompt: `Löse die Gleichung.\n${equation}`, correct: `${r} und ${minus}${r}`, wrong,
    typed: { prompt: `Löse die Gleichung ${equation}.\nGib die positive Lösung an.`, answer: Rational.whole(r) },
    pair: equation, solution: working,
    explanation: 'Forme erst nach x² um, dann ziehst du die Wurzel. Es gibt zwei Lösungen: die positive und die negative Wurzel, denn (−7)² ist auch 49.',
  });
  problem.pairPrompt = 'Löse und ordne die Lösungen zu.';
  return problem;
}

const unbracket = (s: string): string => s.split('(').join('').split(')').join('');

function factorFormAttempt(level: number, gen: MathGen): Problem | null {
  let first: string;
  let second: string;
  let r1: Q;
  let r2: Q;
  if (level === 1) {
    const m = gen.int(1, 9);
    const n = gen.int(1, 9);
    first = `(x ${minus} ${m})`;
    second = `(x + ${n})`;
    [r1, r2] = [q(m), q(-n)];
  } else if (level === 2) {
    switch (gen.int(0, 2)) {
      case 0: {
        const k = gen.int(2, 9);
        const subtracts = gen.chance(50);
        first = 'x';
        second = `(x ${subtracts ? minus : '+'} ${k})`;
        r1 = q(0);
        r2 = q(subtracts ? k : -k);
        break;
      }
      case 1: {
        const m = gen.int(1, 9);
        const n = gen.int(1, 9);
        first = `(x + ${m})`;
        second = `(x + ${n})`;
        [r1, r2] = [q(-m), q(-n)];
        break;
      }
      default: {
        const m = gen.int(1, 9);
        const n = gen.int(1, 9);
        first = `(x ${minus} ${m})`;
        second = `(x ${minus} ${n})`;
        [r1, r2] = [q(m), q(n)];
      }
    }
  } else {
    // (ax − b)(cx + d): the roots b/a and −d/c.
    const a = gen.int(2, 4);
    const b = a * gen.int(1, 4);
    const c = gen.pick([1, 2, 3]);
    const d = c * gen.int(1, 4) + (gen.chance(40) ? 1 : 0);
    first = `(${a}x ${minus} ${b})`;
    second = `(${c === 1 ? '' : String(c)}x + ${d})`;
    [r1, r2] = [q(b, a), q(-d, c)];
  }
  if (r1.equals(r2) || decimals([r1, r2], 2).length !== 2) return null;
  const equation = `${first}${second} = 0`;
  const correct = pair(r1, r2);
  const asksLarger = gen.chance(50);
  const asked = asksLarger ? larger(r1, r2) : smaller(r1, r2);
  const problem = textProblem({
    prompt: `Löse die Gleichung.\n${equation}`, correct, wrong: [],
    typed: { prompt: `Löse die Gleichung ${equation}.\nGib die ${asksLarger ? 'größere' : 'kleinere'} Lösung an.`, answer: asked.value, text: num(asked) },
    pair: equation,
    solution: `Ein Faktor muss 0 sein: ${unbracket(first)} = 0 oder ${unbracket(second)} = 0, also x = ${num(r1)} oder x = ${num(r2)}`,
    explanation: 'Ein Produkt ist 0, wenn mindestens ein Faktor 0 ist. Setze jeden Faktor einzeln gleich 0. Die Lösung hat das umgekehrte Vorzeichen der Zahl in der Klammer.',
  });
  problem.pairPrompt = 'Löse und ordne die Lösungen zu.';
  return problem;
}

/** "(x − 2)(x + 5) = 0": a product is zero if one factor is zero. */
const factorForm = (level: number, gen: MathGen): Problem | null => gen.attempt(() => factorFormAttempt(level, gen));

function vertexZerosAttempt(level: number, gen: MathGen): Problem | null {
  const r = level === 1 ? gen.int(1, 4) : gen.int(2, 6);
  const d = gen.nonZero(-6, 6);
  const a: Q = level === 3 ? gen.pick([q(2), q(3), q(-1), q(-2)]) : q(1);
  // y = a(x − d)² + e with e = −a·r²: the zeros are d ± r.
  const e = a.times(-(r * r)).int;
  if (e === null) return null;
  const upper = q(d + r);
  const lower = q(d - r);
  if (upper.equals(lower) || Math.abs(e) > 50) return null;
  const equation = vertexText(a, d, e);
  // The sign of d turned, the shift forgotten, the number under the root left unrooted.
  const wrongSets: [Q, Q][] = ([[q(-d + r), q(-d - r)], [q(r), q(-r)], [q(d + r * r), q(d - r * r)]] as [Q, Q][]).filter((s) => setKey(s[0], s[1]) !== setKey(upper, lower));
  const wrong = wrongSets.map((s) => pair(s[0], s[1]));
  const asksLarger = gen.chance(50);
  const asked = asksLarger ? upper : lower;
  const problem = textProblem({
    prompt: `Berechne die Nullstellen.\n${equation}`, correct: pair(upper, lower), wrong,
    typed: { prompt: `Berechne die Nullstellen von ${equation}.\nGib die ${asksLarger ? 'größere' : 'kleinere'} Nullstelle an.`, answer: asked.value, text: num(asked) },
    pair: equation,
    solution: `0 = ${equation.slice(4)}; (x ${d > 0 ? minus : '+'} ${Math.abs(d)})² = ${r * r}; x ${d > 0 ? minus : '+'} ${Math.abs(d)} = ${r} oder ${minus}${r}; x = ${num(upper)} oder x = ${num(lower)}`,
    explanation: 'Setze y = 0 und bringe die Zahl hinten auf die andere Seite. Teile durch a, ziehe die Wurzel (zwei Vorzeichen!) und verschiebe um d.',
  });
  problem.pairPrompt = 'Berechne und ordne die Nullstellen zu.';
  return problem;
}

/** "Nullstellen von y = (x − 1)² − 4": solve (x − 1)² = 4. */
const vertexZeros = (level: number, gen: MathGen): Problem | null => gen.attempt(() => vertexZerosAttempt(level, gen));

// Lesson 3

function pqSolveAttempt(level: number, gen: MathGen): Problem | null {
  let r1: Q;
  let r2: Q;
  switch (level) {
    case 1:
      r1 = q(gen.int(1, 8));
      r2 = q(gen.int(1, 8));
      break;
    case 2:
      r1 = q(gen.nonZero(-8, 8));
      r2 = q(gen.nonZero(-8, 8));
      break;
    default:
      r1 = q(gen.nonZero(-9, 9), 2);
      r2 = gen.chance(50) ? q(gen.nonZero(-9, 9), 2) : q(gen.nonZero(-6, 6));
  }
  if (r1.equals(r2)) return null;
  const p = r1.plus(r2).negated;
  const r = r1.times(r2);
  if (!p.ok || !r.ok || decimals([p, r], 2).length !== 2 || p.isZero) return null;
  const half = p.div(2);
  const discriminantValue = half.times(half).minus(r);
  const root = rationalRoot(discriminantValue);
  if (root === null || root.isZero) return null;
  const correct = pair(r1, r2);
  // p not halved, the sign of q turned, the root forgotten.
  const wrongSets: [Q, Q][] = [];
  const bigRoot = rationalRoot(p.times(p).minus(r));
  if (bigRoot) wrongSets.push([p.negated.plus(bigRoot), p.negated.minus(bigRoot)]);
  const plusRoot = rationalRoot(half.times(half).plus(r));
  if (plusRoot) wrongSets.push([half.negated.plus(plusRoot), half.negated.minus(plusRoot)]);
  wrongSets.push([half.negated.plus(discriminantValue), half.negated.minus(discriminantValue)]);
  // The sign of p/2 not turned, p not halved but the right root.
  wrongSets.push([half.plus(root), half.minus(root)]);
  wrongSets.push([p.negated.plus(root), p.negated.minus(root)]);
  const wrong = wrongSets.filter((s) => setKey(s[0], s[1]) !== setKey(r1, r2)).map((s) => pair(s[0], s[1]));
  if (new Set(wrong).size < 2) return null;
  const equation = `${quadratic(q(1), p, r)} = 0`;
  const asksLarger = gen.chance(50);
  const asked = asksLarger ? larger(r1, r2) : smaller(r1, r2);
  const problem = textProblem({
    prompt: `Löse mit der pq-Formel.\n${equation}`, correct, wrong,
    typed: { prompt: `Löse ${equation} mit der pq-Formel.\nGib die ${asksLarger ? 'größere' : 'kleinere'} Lösung an.`, answer: asked.value, text: num(asked) },
    pair: equation,
    solution: `p = ${num(p)}, q = ${num(r)}; x = ${num(half.negated)} ± √(${num(half.times(half))} ${r.isNegative ? '+' : minus} ${num(r.magnitude)}) = ${num(half.negated)} ± √${num(discriminantValue)} = ${num(half.negated)} ± ${num(root)}; x = ${correct.split(' und ').join(' oder x = ')}`,
    explanation: 'Bei x² + px + q = 0 gilt x = −p/2 ± √((p/2)² − q). Rechne erst p/2, dann den Wert unter der Wurzel, dann die Wurzel; das ± gibt die zwei Lösungen.',
  });
  problem.pairPrompt = 'Löse und ordne die Lösungen zu.';
  return problem;
}

/** "x² − 5x + 6 = 0" by the pq-formula. */
const pqSolve = (level: number, gen: MathGen): Problem | null => gen.attempt(() => pqSolveAttempt(level, gen));

function discriminantAttempt(level: number, gen: MathGen): Problem | null {
  const p = level === 1 ? q(2 * gen.nonZero(-4, 4)) : level === 2 ? q(gen.nonZero(-9, 9)) : q(gen.nonZero(-19, 19), 2);
  const half = p.div(2);
  const square = half.times(half);
  const kind = gen.int(0, 2);
  const offset = q(gen.int(1, 6), level === 3 ? 4 : 1);
  const r = kind === 0 ? square.plus(offset) : kind === 1 ? square : square.minus(offset);
  if (!r.ok || r.isZero || decimals([p, r], 2).length !== 2) return null;
  const d = square.minus(r);
  if (!d.ok) return null;
  const equation = `${quadratic(q(1), p, r)} = 0`;
  const options = ['keine Lösung', 'genau eine Lösung', 'zwei Lösungen'];
  const right = d.isNegative ? 0 : d.isZero ? 1 : 2;
  const reason = right === 0 ? 'D < 0: keine Lösung' : right === 1 ? 'D = 0: genau eine Lösung' : 'D > 0: zwei Lösungen';
  const halfShown = half.isNegative ? `(${num(half)})` : num(half);
  const qShown = r.isNegative ? `(${num(r)})` : num(r);
  return textProblem({
    prompt: `Wie viele Lösungen hat die Gleichung?\n${equation}`, correct: options[right], wrong: options.filter((_, i) => i !== right),
    typed: { prompt: `Berechne die Diskriminante D = (p/2)² − q.\n${equation}`, answer: d.value, text: num(d) },
    solution: `D = ${halfShown}² ${minus} ${qShown} = ${num(square)} ${minus} ${qShown} = ${num(d)}; ${reason}`,
    explanation: 'Die Diskriminante D = (p/2)² − q steht unter der Wurzel der pq-Formel. Ist D positiv, gibt es zwei Lösungen, bei D = 0 genau eine, bei negativem D keine.',
  });
}

/** "Wie viele Lösungen hat x² + 4x + 7 = 0?" The sign of D = (p/2)² − q decides. */
const discriminant = (level: number, gen: MathGen): Problem | null => gen.attempt(() => discriminantAttempt(level, gen));

function divideFirstAttempt(level: number, gen: MathGen): Problem | null {
  const a = level === 1 ? 2 : gen.int(2, 5);
  const r1 = level === 3 ? gen.nonZero(-9, 9) : gen.int(1, 8);
  const r2 = level === 3 ? gen.nonZero(-9, 9) : gen.int(1, 8);
  if (r1 === r2) return null;
  const p = -(r1 + r2);
  const r = r1 * r2;
  if (p === 0) return null;
  const given = `${quadratic(q(a), q(a * p), q(a * r))} = 0`;
  const correct = `${quadratic(q(1), q(p), q(r))} = 0`;
  // Only x² divided, x² and x divided, x² and the number divided.
  const wrong = [`${quadratic(q(1), q(a * p), q(a * r))} = 0`, `${quadratic(q(1), q(p), q(a * r))} = 0`, `${quadratic(q(1), q(a * p), q(r))} = 0`];
  const largest = Math.max(r1, r2);
  const asksSolution = level === 3 && gen.chance(50);
  const askP = gen.chance(50);
  const typed: Typed = asksSolution
    ? { prompt: `Löse ${given}.\nGib die größere Lösung an.`, answer: Rational.whole(largest) }
    : { prompt: `Teile ${given} durch ${a}.\nWelche Zahl steht dann ${askP ? 'vor dem x' : 'ohne x'}?`, answer: Rational.whole(askP ? p : r) };
  return textProblem({
    prompt: `Welche Gleichung entsteht, wenn du durch den Faktor vor x² teilst?\n${given}`, correct, wrong, typed,
    solution: `Alle Summanden durch ${a} teilen: ${correct}${asksSolution ? `; die Lösungen sind ${r1} und ${r2}` : ''}`,
    explanation: 'Die pq-Formel gilt nur für x² + px + q = 0. Steht vor x² eine andere Zahl, teile die ganze Gleichung durch sie, auch den Teil ohne x.',
  });
}

/** "2x² − 8x + 6 = 0": the pq-formula needs x² alone, so all terms are divided by the factor in front. */
const divideFirst = (level: number, gen: MathGen): Problem | null => gen.attempt(() => divideFirstAttempt(level, gen));

function vertexFromNormalAttempt(level: number, gen: MathGen): Problem | null {
  let p: Q;
  let r: Q;
  switch (level) {
    case 1:
      p = q(2 * gen.nonZero(-5, 5));
      r = q(gen.int(1, 15));
      break;
    case 2:
      p = q(2 * gen.nonZero(-6, 6));
      r = q(gen.nonZero(-12, 15));
      break;
    default:
      p = q(gen.nonZero(-11, 11));
      r = q(gen.nonZero(-12, 15));
  }
  const half = p.div(2);
  const d = half.negated;
  const e = r.minus(half.times(half));
  if (decimals([d, e], 2).length !== 2 || e.equals(r)) return null;
  const equation = `y = ${quadratic(q(1), p, r)}`;
  // The number q left as it is, the square added instead of taken off, p/2 not squared, p not halved.
  const candidates = [vertexPoint(d, r), vertexPoint(d, r.plus(half.times(half))), vertexPoint(d, r.minus(half)), vertexPoint(p.negated, e)];
  const correct = vertexPoint(d, e);
  const asksX = gen.chance(50);
  const asked = asksX ? d : e;
  const problem = textProblem({
    prompt: `Bestimme den Scheitelpunkt.\n${equation}`, correct, wrong: candidates.filter((c) => c !== correct),
    typed: { prompt: `Bestimme den Scheitelpunkt von ${equation}.\n${asksX ? 'Welche x-Koordinate hat er?' : 'Welche y-Koordinate hat er?'}`, answer: asked.value, text: num(asked) },
    pair: equation,
    solution: `d = ${minus}p/2 = ${minus}(${num(half)}) = ${num(d)}; e = q ${minus} (p/2)² = ${num(r)} ${minus} ${num(half.times(half))} = ${num(e)}; ${correct}`,
    explanation: 'Aus y = x² + px + q folgt die quadratische Ergänzung: x-Koordinate −p/2, y-Koordinate q − (p/2)². Das ist dasselbe wie die Scheitelpunktform.',
  });
  problem.pairPrompt = 'Bestimme den Scheitelpunkt und ordne zu.';
  return problem;
}

/** "y = x² − 6x + 11": the vertex from the normal form, d = −p/2 and e = q − (p/2)². */
const vertexFromNormal = (level: number, gen: MathGen): Problem | null => gen.attempt(() => vertexFromNormalAttempt(level, gen));

export const unit09: Template[] = [
  template('u09.vertexForm', 1, vertexForm, ['typed', 'pairs']),
  template('u09.shift', 1, shift, ['choice']),
  template('u09.functionValue', 1, functionValue, ['choice', 'typed', 'pairs']),
  template('u09.extremum', 1, extremum, ['choice', 'typed', 'pairs']),
  template('u09.pureQuadratic', 2, pureQuadratic, ['choice', 'typed', 'pairs']),
  template('u09.factorForm', 2, factorForm, ['typed', 'pairs']),
  template('u09.vertexZeros', 2, vertexZeros, ['choice', 'typed', 'pairs']),
  template('u09.pqSolve', 3, pqSolve, ['choice', 'typed', 'pairs']),
  template('u09.discriminant', 3, discriminant, ['choice', 'typed']),
  template('u09.divideFirst', 3, divideFirst, ['choice', 'typed']),
  template('u09.vertexFromNormal', 3, vertexFromNormal, ['choice', 'typed', 'pairs']),
];
