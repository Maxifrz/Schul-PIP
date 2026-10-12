// Unit 9, Quadratische Gleichungen und Funktionen: Scheitelpunktform, Verschiebung und Funktionswerte (lesson 1),
// rein quadratische Gleichungen, Faktorform und Nullstellen (2), pq-Formel, Diskriminante und Normalform (3).
// A port of MathMiddleUnit09.swift.
//
// Options of a choice never differ only by a sign ("S(3|2)" and "S(−3|2)"): the exercise factory reads letters and
// digits only, so such options would count as one. Sign mistakes are asked in words or in a typed answer.

import { decimals, type Gen, numberProblem, type Problem, Q, R, template, textProblem, type Typed } from './core';
import * as T from './text';

const q = Q.of;

export const templates = [
  template('u09.vertexForm', 1, ['typed', 'pairs'], vertexForm),
  template('u09.shift', 1, ['choice'], shift),
  template('u09.functionValue', 1, ['choice', 'typed', 'pairs'], functionValue),
  template('u09.extremum', 1, ['choice', 'typed', 'pairs'], extremum),
  template('u09.pureQuadratic', 2, ['choice', 'typed', 'pairs'], pureQuadratic),
  template('u09.factorForm', 2, ['typed', 'pairs'], factorForm),
  template('u09.vertexZeros', 2, ['choice', 'typed', 'pairs'], vertexZeros),
  template('u09.pqSolve', 3, ['choice', 'typed', 'pairs'], pqSolve),
  template('u09.discriminant', 3, ['choice', 'typed'], discriminant),
  template('u09.divideFirst', 3, ['choice', 'typed'], divideFirst),
  template('u09.vertexFromNormal', 3, ['choice', 'typed', 'pairs'], vertexFromNormal),
];

const valueHint = 'Gib die Zahl an.';

// Writing

const num = (x: Q): string => T.number(x);

function coefficientText(a: Q): string {
  if (a.eq(q(1))) return '';
  if (a.eq(q(-1))) return T.minus;
  return num(a);
}

/** "y = 2(x + 1)² − 5": the vertex form, with the bracket left out when d is 0. */
function vertexText(a: Q, d: number, e: number): string {
  let text = 'y = ' + coefficientText(a);
  if (d === 0) {
    text += 'x²';
  } else {
    text += `(x ${d > 0 ? T.minus : '+'} ${Math.abs(d)})²`;
  }
  if (e !== 0) text += (e > 0 ? ' + ' : ` ${T.minus} `) + String(Math.abs(e));
  return text;
}

/** "x² − 5x + 6": the normal form with a, p and q possibly decimals. */
function quadratic(a: Q, p: Q, qq: Q): string {
  let text = coefficientText(a) + 'x²';
  if (!p.isZero) text += (p.isNegative ? ` ${T.minus} ` : ' + ') + (p.magnitude.eq(q(1)) ? '' : num(p.magnitude)) + 'x';
  if (!qq.isZero) text += (qq.isNegative ? ` ${T.minus} ` : ' + ') + num(qq.magnitude);
  return text;
}

const vertexPoint = (x: Q, y: Q): string => `S(${num(x)}|${num(y)})`;

/** Two solutions, the larger first: "3 und −1". */
function pair(x: Q, y: Q): string {
  return x.lt(y) ? `${num(y)} und ${num(x)}` : `${num(x)} und ${num(y)}`;
}

/** A set of Q values as a comparable key (Swift `Set([a, b])`). */
const setKey = (list: Q[]): string => Array.from(new Set(list.map((x) => x.key))).sort().join('|');

function isqrt(n: number): number | null {
  if (n < 0) return null;
  let root = Math.trunc(Math.sqrt(n));
  while (root * root > n) root -= 1;
  while ((root + 1) * (root + 1) <= n) root += 1;
  return root * root === n ? root : null;
}

/** The exact square root of a fraction, null if it is not a fraction of squares. */
function rationalRoot(x: Q): Q | null {
  if (!x.ok || x.isNegative) return null;
  const top = isqrt(x.numerator);
  const bottom = isqrt(x.denominator);
  if (top === null || bottom === null) return null;
  return q(top, bottom);
}

// Lesson 1

/** "Lies den Scheitelpunkt ab: y = (x − 3)² + 2": the sign of d is the opposite of the sign in the bracket. */
function vertexForm(level: number, gen: Gen): Problem | null {
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
  const typed: Typed = {
    prompt: (asksX ? 'Welche x-Koordinate hat der Scheitelpunkt?' : 'Welche y-Koordinate hat der Scheitelpunkt?') + `\n${equation}`,
    answer: R(asksX ? d : e),
  };
  const problem = textProblem({
    prompt: `Lies den Scheitelpunkt ab.\n${equation}`,
    correct: vertexPoint(q(d), q(e)),
    wrong: [],
    typed,
    pair: equation,
    solution: `In y = a(x − d)² + e ist S(d|e) der Scheitelpunkt. Hier: ${vertexPoint(q(d), q(e))}${d === 0 ? '' : `; die Klammer (x ${d > 0 ? T.minus : '+'} ${Math.abs(d)}) gibt d = ${T.int(d)}`}`,
    explanation:
      'In der Scheitelpunktform y = a(x − d)² + e liest du d mit umgekehrtem Vorzeichen aus der Klammer ab; e steht ohne Änderung hinten. Der Faktor a ändert den Scheitelpunkt nicht.',
  });
  problem.pairPrompt = 'Lies den Scheitelpunkt ab und ordne zu.';
  return problem;
}

/** "Wo liegt der Scheitelpunkt?" The four ways left or right, above or below, in words. */
function shift(level: number, gen: Gen): Problem | null {
  const d = level === 1 ? gen.nonZero(-5, 5) : gen.nonZero(-8, 8);
  const e = level === 1 ? gen.nonZero(-5, 5) : gen.nonZero(-9, 9);
  const a = level === 1 ? q(1) : level === 2 ? gen.pick([q(2), q(3), q(1, 2)]) : gen.pick([q(-1), q(-2), q(2), q(-3), q(1, 2)]);
  const words = (right: boolean, up: boolean): string => `${Math.abs(d)} nach ${right ? 'rechts' : 'links'} und ${Math.abs(e)} nach ${up ? 'oben' : 'unten'}`;
  const correct = words(d > 0, e > 0);
  const wrong = [words(d < 0, e > 0), words(d > 0, e < 0), words(d < 0, e < 0)];
  return textProblem({
    prompt: `Wo liegt der Scheitelpunkt der Parabel, vom Ursprung aus gesehen?\n${vertexText(a, d, e)}`,
    correct,
    wrong,
    solution: `d = ${T.int(d)} und e = ${T.int(e)}, also S(${T.int(d)}|${T.int(e)}): ${correct}`,
    explanation: 'Die Klammer (x + 3) heißt: Verschiebung um 3 nach links, (x − 3) um 3 nach rechts. Die Zahl hinten verschiebt nach oben (plus) oder unten (minus).',
  });
}

/** "f(x) = x² − 4x + 3, berechne f(−2)": the square of a negative number is positive. */
function functionValue(level: number, gen: Gen): Problem | null {
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
  if (!(Math.abs(value) <= 120)) return null;
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
    prompt: `Gegeben: f(x) = ${term}\nBerechne f(${T.int(x)}).`,
    answer: q(value),
    hint: valueHint,
    wrong: wrong.map((v) => q(v)),
    pair: `f(x) = ${term}, f(${T.int(x)})`,
    solution: `f(${T.int(x)}) = ${expression} = ${evaluated} = ${T.int(value)}`,
    explanation: 'Setze x ein und rechne erst die Potenz, dann Punkt vor Strich. Das Quadrat einer negativen Zahl ist positiv: (−2)² = 4.',
  });
}

/** "Welchen kleinsten Wert hat y = (x − 3)² + 2?" The vertex is the lowest (a > 0) or the highest (a < 0) point. */
function extremum(level: number, gen: Gen): Problem | null {
  const a: Q = level === 1 ? q(1) : gen.pick([q(1), q(2), q(-1), q(-2), q(3), q(-3)]);
  const d = gen.nonZero(-6, 6);
  const e = gen.nonZero(-9, 9);
  const asksValue = gen.chance(50);
  const lowest = !a.isNegative;
  const equation = vertexText(a, d, e);
  const answer = asksValue ? e : d;
  const wrong = asksValue ? [d, e + d, e - d, d * e] : [e, d + e, d - e, d * e];
  let prompt: string;
  if (asksValue) {
    prompt = `Welchen ${lowest ? 'kleinsten' : 'größten'} Funktionswert hat die Parabel?\n${equation}`;
  } else {
    prompt = `Für welches x ist der Funktionswert ${lowest ? 'am kleinsten' : 'am größten'}?\n${equation}`;
  }
  const problem = numberProblem({
    prompt,
    answer: q(answer),
    hint: valueHint,
    wrong: wrong.map((v) => q(v)),
    pair: (asksValue ? (lowest ? 'kleinster Wert: ' : 'größter Wert: ') : `Stelle des ${lowest ? 'Minimums' : 'Maximums'}: `) + equation,
    solution:
      `Der Scheitelpunkt ist S(${T.int(d)}|${T.int(e)}). Die Parabel ist nach ${lowest ? 'oben' : 'unten'} geöffnet, also ist S der ${lowest ? 'tiefste' : 'höchste'} Punkt: ` +
      (asksValue ? `y = ${T.int(e)}` : `x = ${T.int(d)}`),
    explanation:
      'Bei a > 0 ist die Parabel nach oben geöffnet, ihr Scheitelpunkt ist der tiefste Punkt. Bei a < 0 ist sie nach unten geöffnet, und der Scheitelpunkt ist der höchste Punkt.',
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Aufgabe die gesuchte Zahl zu.';
  return problem;
}

// Lesson 2

/** "x² = 49": two solutions, the root and its opposite. */
function pureQuadratic(level: number, gen: Gen): Problem | null {
  const r = level === 3 ? gen.int(2, 10) : gen.int(2, 12);
  let equation: string;
  let working: string;
  switch (level) {
    case 1:
      equation = `x² = ${r * r}`;
      working = `x² = ${r * r}, also x = ${r} oder x = ${T.minus}${r}`;
      break;
    case 2:
      if (gen.chance(50)) {
        equation = `x² ${T.minus} ${r * r} = 0`;
        working = `x² = ${r * r}, also x = ${r} oder x = ${T.minus}${r}`;
      } else {
        const k = gen.int(1, 20);
        equation = `x² + ${k} = ${r * r + k}`;
        working = `x² = ${r * r + k} ${T.minus} ${k} = ${r * r}, also x = ${r} oder x = ${T.minus}${r}`;
      }
      break;
    default: {
      const a = gen.int(2, 5);
      if (gen.chance(50)) {
        equation = `${a}x² = ${a * r * r}`;
        working = `x² = ${a * r * r} : ${a} = ${r * r}, also x = ${r} oder x = ${T.minus}${r}`;
      } else {
        const b = gen.int(1, 12);
        if (!(a * r * r - b > 0)) return null;
        equation = `${a}x² ${T.minus} ${b} = ${a * r * r - b}`;
        working = `${a}x² = ${a * r * r}; x² = ${r * r}, also x = ${r} oder x = ${T.minus}${r}`;
      }
    }
  }
  // Only one solution, the root forgotten, the square halved instead of rooted.
  const wrong = [`${r}`, `${r * r} und ${T.minus}${r * r}`, pair(q(r, 2), q(-r, 2))];
  const problem = textProblem({
    prompt: `Löse die Gleichung.\n${equation}`,
    correct: `${r} und ${T.minus}${r}`,
    wrong,
    typed: { prompt: `Löse die Gleichung ${equation}.\nGib die positive Lösung an.`, answer: R(r) },
    pair: equation,
    solution: working,
    explanation: 'Forme erst nach x² um, dann ziehst du die Wurzel. Es gibt zwei Lösungen: die positive und die negative Wurzel, denn (−7)² ist auch 49.',
  });
  problem.pairPrompt = 'Löse und ordne die Lösungen zu.';
  return problem;
}

/** "(x − 2)(x + 5) = 0": a product is zero if one factor is zero. */
function factorForm(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => factorFormAttempt(level, gen));
}

function factorFormAttempt(level: number, gen: Gen): Problem | null {
  let first: string;
  let second: string;
  let r1: Q;
  let r2: Q;
  switch (level) {
    case 1: {
      const m = gen.int(1, 9);
      const n = gen.int(1, 9);
      first = `(x ${T.minus} ${m})`;
      second = `(x + ${n})`;
      [r1, r2] = [q(m), q(-n)];
      break;
    }
    case 2:
      switch (gen.int(0, 2)) {
        case 0: {
          const k = gen.int(2, 9);
          const subtracts = gen.chance(50);
          first = 'x';
          second = `(x ${subtracts ? T.minus : '+'} ${k})`;
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
          first = `(x ${T.minus} ${m})`;
          second = `(x ${T.minus} ${n})`;
          [r1, r2] = [q(m), q(n)];
        }
      }
      break;
    default: {
      // (ax − b)(cx + d): the roots b/a and −d/c.
      const a = gen.int(2, 4);
      const b = a * gen.int(1, 4);
      const c = gen.pick([1, 2, 3]);
      const d = c * gen.int(1, 4) + (gen.chance(40) ? 1 : 0);
      first = `(${a}x ${T.minus} ${b})`;
      second = `(${c === 1 ? '' : String(c)}x + ${d})`;
      [r1, r2] = [q(b, a), q(-d, c)];
    }
  }
  if (r1.eq(r2) || decimals([r1, r2], 2).length !== 2) return null;
  const equation = `${first}${second} = 0`;
  const correct = pair(r1, r2);
  const larger = r1.lt(r2) ? r2 : r1;
  const smaller = r1.lt(r2) ? r1 : r2;
  const asksLarger = gen.chance(50);
  const strip = (s: string): string => s.split('(').join('').split(')').join('');
  const problem = textProblem({
    prompt: `Löse die Gleichung.\n${equation}`,
    correct,
    wrong: [],
    typed: {
      prompt: `Löse die Gleichung ${equation}.\nGib die ${asksLarger ? 'größere' : 'kleinere'} Lösung an.`,
      answer: (asksLarger ? larger : smaller).value,
      text: num(asksLarger ? larger : smaller),
    },
    pair: equation,
    solution: `Ein Faktor muss 0 sein: ${strip(first)} = 0 oder ${strip(second)} = 0, also x = ${num(r1)} oder x = ${num(r2)}`,
    explanation: 'Ein Produkt ist 0, wenn mindestens ein Faktor 0 ist. Setze jeden Faktor einzeln gleich 0. Die Lösung hat das umgekehrte Vorzeichen der Zahl in der Klammer.',
  });
  problem.pairPrompt = 'Löse und ordne die Lösungen zu.';
  return problem;
}

/** "Nullstellen von y = (x − 1)² − 4": solve (x − 1)² = 4. */
function vertexZeros(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => vertexZerosAttempt(level, gen));
}

function vertexZerosAttempt(level: number, gen: Gen): Problem | null {
  const r = level === 1 ? gen.int(1, 4) : gen.int(2, 6);
  const d = gen.nonZero(-6, 6);
  const a: Q = level === 3 ? gen.pick([q(2), q(3), q(-1), q(-2)]) : q(1);
  // y = a(x − d)² + e with e = −a·r²: the zeros are d ± r.
  const e = a.times(-(r * r)).int;
  if (e === null) return null;
  const upper = q(d + r);
  const lower = q(d - r);
  if (upper.eq(lower) || !(Math.abs(e) <= 50)) return null;
  const equation = vertexText(a, d, e);
  // The sign of d turned, the shift forgotten, the number under the root left unrooted.
  let wrongSets: [Q, Q][] = [[q(-d + r), q(-d - r)], [q(r), q(-r)], [q(d + r * r), q(d - r * r)]];
  wrongSets = wrongSets.filter((s) => setKey([s[0], s[1]]) !== setKey([upper, lower]));
  const wrong = wrongSets.map((s) => pair(s[0], s[1]));
  const asksLarger = gen.chance(50);
  const problem = textProblem({
    prompt: `Berechne die Nullstellen.\n${equation}`,
    correct: pair(upper, lower),
    wrong,
    typed: {
      prompt: `Berechne die Nullstellen von ${equation}.\nGib die ${asksLarger ? 'größere' : 'kleinere'} Nullstelle an.`,
      answer: (asksLarger ? upper : lower).value,
      text: num(asksLarger ? upper : lower),
    },
    pair: equation,
    solution: `0 = ${equation.slice(4)}; (x ${d > 0 ? T.minus : '+'} ${Math.abs(d)})² = ${r * r}; x ${d > 0 ? T.minus : '+'} ${Math.abs(d)} = ${r} oder ${T.minus}${r}; x = ${num(upper)} oder x = ${num(lower)}`,
    explanation: 'Setze y = 0 und bringe die Zahl hinten auf die andere Seite. Teile durch a, ziehe die Wurzel (zwei Vorzeichen!) und verschiebe um d.',
  });
  problem.pairPrompt = 'Berechne und ordne die Nullstellen zu.';
  return problem;
}

// Lesson 3

/** "x² − 5x + 6 = 0" by the pq-formula. */
function pqSolve(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => pqSolveAttempt(level, gen));
}

function pqSolveAttempt(level: number, gen: Gen): Problem | null {
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
  if (r1.eq(r2)) return null;
  const p = r1.plus(r2).negated;
  const qv = r1.times(r2);
  if (!p.ok || !qv.ok || decimals([p, qv], 2).length !== 2 || p.isZero) return null;
  const half = p.over(2);
  const disc = half.times(half).minus(qv);
  const root = rationalRoot(disc);
  if (root === null || root.isZero) return null;
  const correct = pair(r1, r2);
  // p not halved, the sign of q turned, the root forgotten.
  const wrongSets: [Q, Q][] = [];
  const bigRoot = rationalRoot(p.times(p).minus(qv));
  if (bigRoot) wrongSets.push([p.negated.plus(bigRoot), p.negated.minus(bigRoot)]);
  const plusRoot = rationalRoot(half.times(half).plus(qv));
  if (plusRoot) wrongSets.push([half.negated.plus(plusRoot), half.negated.minus(plusRoot)]);
  wrongSets.push([half.negated.plus(disc), half.negated.minus(disc)]);
  // The sign of p/2 not turned, p not halved but the right root.
  wrongSets.push([half.plus(root), half.minus(root)]);
  wrongSets.push([p.negated.plus(root), p.negated.minus(root)]);
  const wrong = wrongSets.filter((s) => setKey([s[0], s[1]]) !== setKey([r1, r2])).map((s) => pair(s[0], s[1]));
  if (!(new Set(wrong).size >= 2)) return null;
  const equation = quadratic(q(1), p, qv) + ' = 0';
  const larger = r1.lt(r2) ? r2 : r1;
  const smaller = r1.lt(r2) ? r1 : r2;
  const asksLarger = gen.chance(50);
  const problem = textProblem({
    prompt: `Löse mit der pq-Formel.\n${equation}`,
    correct,
    wrong,
    typed: {
      prompt: `Löse ${equation} mit der pq-Formel.\nGib die ${asksLarger ? 'größere' : 'kleinere'} Lösung an.`,
      answer: (asksLarger ? larger : smaller).value,
      text: num(asksLarger ? larger : smaller),
    },
    pair: equation,
    solution: `p = ${num(p)}, q = ${num(qv)}; x = ${num(half.negated)} ± √(${num(half.times(half))} ${qv.isNegative ? '+' : T.minus} ${num(qv.magnitude)}) = ${num(half.negated)} ± √${num(disc)} = ${num(half.negated)} ± ${num(root)}; x = ${correct.split(' und ').join(' oder x = ')}`,
    explanation:
      'Bei x² + px + q = 0 gilt x = −p/2 ± √((p/2)² − q). Rechne erst p/2, dann den Wert unter der Wurzel, dann die Wurzel; das ± gibt die zwei Lösungen.',
  });
  problem.pairPrompt = 'Löse und ordne die Lösungen zu.';
  return problem;
}

/** "Wie viele Lösungen hat x² + 4x + 7 = 0?" The sign of D = (p/2)² − q decides. */
function discriminant(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => discriminantAttempt(level, gen));
}

function discriminantAttempt(level: number, gen: Gen): Problem | null {
  let p: Q;
  switch (level) {
    case 1:
      p = q(2 * gen.nonZero(-4, 4));
      break;
    case 2:
      p = q(gen.nonZero(-9, 9));
      break;
    default:
      p = q(gen.nonZero(-19, 19), 2);
  }
  const half = p.over(2);
  const square = half.times(half);
  const kind = gen.int(0, 2);
  const offset = q(gen.int(1, 6), level === 3 ? 4 : 1);
  let qv: Q;
  switch (kind) {
    case 0:
      qv = square.plus(offset);
      break;
    case 1:
      qv = square;
      break;
    default:
      qv = square.minus(offset);
  }
  if (!qv.ok || qv.isZero || decimals([p, qv], 2).length !== 2) return null;
  const d = square.minus(qv);
  if (!d.ok) return null;
  const equation = quadratic(q(1), p, qv) + ' = 0';
  const options = ['keine Lösung', 'genau eine Lösung', 'zwei Lösungen'];
  const right = d.isNegative ? 0 : d.isZero ? 1 : 2;
  const reason = right === 0 ? 'D < 0: keine Lösung' : right === 1 ? 'D = 0: genau eine Lösung' : 'D > 0: zwei Lösungen';
  const halfShown = half.isNegative ? `(${num(half)})` : num(half);
  const qShown = qv.isNegative ? `(${num(qv)})` : num(qv);
  return textProblem({
    prompt: `Wie viele Lösungen hat die Gleichung?\n${equation}`,
    correct: options[right],
    wrong: options.filter((_, i) => i !== right),
    typed: { prompt: `Berechne die Diskriminante D = (p/2)² − q.\n${equation}`, answer: d.value, text: num(d) },
    solution: `D = ${halfShown}² ${T.minus} ${qShown} = ${num(square)} ${T.minus} ${qShown} = ${num(d)}; ${reason}`,
    explanation: 'Die Diskriminante D = (p/2)² − q steht unter der Wurzel der pq-Formel. Ist D positiv, gibt es zwei Lösungen, bei D = 0 genau eine, bei negativem D keine.',
  });
}

/** "2x² − 8x + 6 = 0": the pq-formula needs x² alone, so all terms are divided by the factor in front. */
function divideFirst(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => divideFirstAttempt(level, gen));
}

function divideFirstAttempt(level: number, gen: Gen): Problem | null {
  const a = level === 1 ? 2 : gen.int(2, 5);
  const r1 = level === 3 ? gen.nonZero(-9, 9) : gen.int(1, 8);
  const r2 = level === 3 ? gen.nonZero(-9, 9) : gen.int(1, 8);
  if (r1 === r2) return null;
  const p = -(r1 + r2);
  const qv = r1 * r2;
  if (p === 0) return null;
  const given = quadratic(q(a), q(a * p), q(a * qv)) + ' = 0';
  const correct = quadratic(q(1), q(p), q(qv)) + ' = 0';
  // Only x² divided, x² and x divided, x² and the number divided.
  const wrong = [
    quadratic(q(1), q(a * p), q(a * qv)) + ' = 0',
    quadratic(q(1), q(p), q(a * qv)) + ' = 0',
    quadratic(q(1), q(a * p), q(qv)) + ' = 0',
  ];
  const larger = Math.max(r1, r2);
  const asksSolution = level === 3 && gen.chance(50);
  const askP = gen.chance(50);
  const typed: Typed = asksSolution
    ? { prompt: `Löse ${given}.\nGib die größere Lösung an.`, answer: R(larger) }
    : { prompt: `Teile ${given} durch ${a}.\nWelche Zahl steht dann ${askP ? 'vor dem x' : 'ohne x'}?`, answer: R(askP ? p : qv) };
  return textProblem({
    prompt: `Welche Gleichung entsteht, wenn du durch den Faktor vor x² teilst?\n${given}`,
    correct,
    wrong,
    typed,
    solution: `Alle Summanden durch ${a} teilen: ${correct}` + (asksSolution ? `; die Lösungen sind ${r1} und ${r2}` : ''),
    explanation: 'Die pq-Formel gilt nur für x² + px + q = 0. Steht vor x² eine andere Zahl, teile die ganze Gleichung durch sie, auch den Teil ohne x.',
  });
}

/** "y = x² − 6x + 11": the vertex from the normal form, d = −p/2 and e = q − (p/2)². */
function vertexFromNormal(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => vertexFromNormalAttempt(level, gen));
}

function vertexFromNormalAttempt(level: number, gen: Gen): Problem | null {
  let p: Q;
  let qv: Q;
  switch (level) {
    case 1:
      p = q(2 * gen.nonZero(-5, 5));
      qv = q(gen.int(1, 15));
      break;
    case 2:
      p = q(2 * gen.nonZero(-6, 6));
      qv = q(gen.nonZero(-12, 15));
      break;
    default:
      p = q(gen.nonZero(-11, 11));
      qv = q(gen.nonZero(-12, 15));
  }
  const half = p.over(2);
  const d = half.negated;
  const e = qv.minus(half.times(half));
  if (decimals([d, e], 2).length !== 2 || e.eq(qv)) return null;
  const equation = 'y = ' + quadratic(q(1), p, qv);
  // The number q left as it is, the square added instead of taken off, p/2 not squared, p not halved.
  const candidates = [vertexPoint(d, qv), vertexPoint(d, qv.plus(half.times(half))), vertexPoint(d, qv.minus(half)), vertexPoint(p.negated, e)];
  const correct = vertexPoint(d, e);
  const asksX = gen.chance(50);
  const problem = textProblem({
    prompt: `Bestimme den Scheitelpunkt.\n${equation}`,
    correct,
    wrong: candidates.filter((c) => c !== correct),
    typed: {
      prompt: `Bestimme den Scheitelpunkt von ${equation}.\n` + (asksX ? 'Welche x-Koordinate hat er?' : 'Welche y-Koordinate hat er?'),
      answer: (asksX ? d : e).value,
      text: num(asksX ? d : e),
    },
    pair: equation,
    solution: `d = ${T.minus}p/2 = ${T.minus}(${num(half)}) = ${num(d)}; e = q ${T.minus} (p/2)² = ${num(qv)} ${T.minus} ${num(half.times(half))} = ${num(e)}; ${correct}`,
    explanation: 'Aus y = x² + px + q folgt die quadratische Ergänzung: x-Koordinate −p/2, y-Koordinate q − (p/2)². Das ist dasselbe wie die Scheitelpunktform.',
  });
  problem.pairPrompt = 'Bestimme den Scheitelpunkt und ordne zu.';
  return problem;
}
