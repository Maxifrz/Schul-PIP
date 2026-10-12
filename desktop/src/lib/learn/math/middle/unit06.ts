// Unit 6, Lineare Funktionen: Gleichung lesen, Funktionswerte und Steigungsdreieck (lesson 1), Nullstelle, Steigung aus
// zwei Punkten und Gerade durch zwei Punkte (2), Punktprobe, Parallele und Sachaufgaben (3). A port of MathMiddleUnit06.swift.

import { decimals, type Gen, numberProblem, type Problem, positives, Q, type Style, S, template, textProblem, wholes } from './core';
import * as T from './text';

const q = Q.of;

export const templates = [
  template('u06.readEquation', 1, ['choice', 'typed', 'pairs'], readEquation),
  template('u06.functionValue', 1, ['choice', 'typed', 'pairs'], functionValue),
  template('u06.slopeTriangle', 1, ['choice', 'typed', 'pairs'], slopeTriangle),
  template('u06.zeroPoint', 2, ['choice', 'typed', 'pairs'], zeroPoint),
  template('u06.slopeTwoPoints', 2, ['choice', 'typed', 'pairs'], slopeTwoPoints),
  template('u06.yIntercept', 2, ['choice', 'typed', 'pairs'], yIntercept),
  template('u06.lineThroughTwo', 2, ['choice', 'typed', 'pairs'], lineThroughTwo),
  template('u06.pointTest', 3, ['choice', 'typed'], pointTest),
  template('u06.parallel', 3, ['choice', 'typed'], parallel),
  template('u06.application', 3, ['choice', 'typed'], application),
];

// Writing a line

/** The x-term of a line: "2x", "x", "−x", "0,5x". */
function xTerm(m: Q): string {
  if (m.eq(q(1))) return 'x';
  if (m.eq(q(-1))) return T.minus + 'x';
  return T.number(m) + 'x';
}

/** "y = 2x − 3"; swapped puts the number first: "y = 5 − 2x". */
function line(m: Q, b: Q, swapped = false): string {
  if (swapped && !b.isZero) {
    return 'y = ' + T.number(b) + (m.isNegative ? ` ${T.minus} ` : ' + ') + xTerm(m.magnitude);
  }
  const tail = b.isZero ? '' : b.isNegative ? ` ${T.minus} ` + T.number(b.magnitude) : ' + ' + T.number(b);
  return 'y = ' + xTerm(m) + tail;
}

/** "P(1|2)". */
function point(name: string, x: Q, y: Q): string {
  return `${name}(${T.number(x)}|${T.number(y)})`;
}

/** A slope for the level: whole at 1, whole with either sign at 2, with halves at 3. */
function slope(level: number, gen: Gen): Q {
  switch (level) {
    case 1:
      return q(gen.int(1, 6));
    case 2:
      return q(gen.nonZero(-6, 6));
    default:
      return gen.chance(50) ? q(gen.nonZero(-9, 9), 2) : q(gen.nonZero(-5, 5));
  }
}

const valueHint = 'Gib die Zahl an.';

// Lesson 1

/** "Welche Steigung hat y = 2x − 3?" and "Wie groß ist der y-Achsenabschnitt?" */
function readEquation(level: number, gen: Gen): Problem | null {
  const m = slope(level, gen);
  const b = q(gen.nonZero(-9, 9));
  const swapped = level === 3 && gen.chance(50);
  const equation = line(m, b, swapped);
  const asksSlope = gen.chance(50);
  // The two numbers swapped, the run mixed up with the rise, the zero point taken for the intercept.
  const zero = b.over(m).negated;
  const wrong = asksSlope ? decimals([b, m.reciprocal, m.plus(b), m.times(b)], 2) : decimals([m, zero, b.plus(m), m.times(b)], 2);
  const name = asksSlope ? 'Steigung' : 'y-Achsenabschnitt';
  const answer = asksSlope ? m : b;
  const problem = numberProblem({
    prompt: asksSlope ? `Welche Steigung hat die Gerade?\n${equation}` : `Wie groß ist der y-Achsenabschnitt der Geraden?\n${equation}`,
    answer,
    hint: valueHint,
    wrong,
    pair: `${name} von ${equation}`,
    solution: `${equation} hat die Form y = mx + b: m = ${T.number(m)} ist die Steigung, b = ${T.number(b)} der y-Achsenabschnitt.`,
    explanation: 'In y = mx + b ist m die Zahl vor dem x (mit ihrem Vorzeichen) und b die Zahl ohne x. Die Reihenfolge der Summanden ändert daran nichts.',
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Aufgabe die gesuchte Zahl zu.';
  return problem;
}

/** "f(x) = 2x − 3, berechne f(4)" and, at level 3, "für welches x ist f(x) = 7". */
function functionValue(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => functionValueAttempt(level, gen));
}

function functionValueAttempt(level: number, gen: Gen): Problem | null {
  const m = level === 1 ? q(gen.int(2, 6)) : q(gen.nonZero(-6, 6));
  const b = q(gen.nonZero(-9, 9));
  const x = level === 1 ? gen.int(1, 6) : gen.nonZero(-5, 6);
  const y = m.times(x).plus(b);
  const fn = 'f(x) = ' + line(m, b).slice(4);
  if (level === 3 && gen.chance(50)) {
    // The other way round: for which x does f take this value?
    const mInt = m.int;
    const bInt = b.int;
    const yInt = y.int;
    if (mInt === null || bInt === null || yInt === null || !(Math.abs(mInt) >= 2)) return null;
    // The sign of b turned, the dividing forgotten, the number taken for the answer, multiplied instead of divided.
    const wrong = [q(yInt - bInt), q(yInt), q(mInt * yInt + bInt)];
    if ((yInt + bInt) % mInt === 0) wrong.push(q((yInt + bInt) / mInt));
    if (!(wholes(wrong).length >= 3)) return null;
    return numberProblem({
      prompt: `Gegeben: ${fn}\nFür welches x gilt f(x) = ${T.int(yInt)}?`,
      answer: q(x),
      hint: valueHint,
      wrong: wholes(wrong),
      pair: `${fn}, f(x) = ${T.int(yInt)}`,
      solution: `${T.linear(mInt, bInt)} = ${T.int(yInt)}; ${T.int(mInt)}x = ${T.int(yInt - bInt)}; x = ${T.int(x)}`,
      explanation: 'Setze den Funktionswert für f(x) ein und löse die Gleichung nach x auf.',
    });
  }
  const mInt = m.int;
  const bInt = b.int;
  const yInt = y.int;
  if (mInt === null || bInt === null || yInt === null) return null;
  // The product read as a sum, the sign of b turned, the bracket forgotten, the x lost.
  const wrong = [mInt + x + bInt, mInt * x - bInt, mInt * (x + bInt)];
  if (x < 0) wrong.push(mInt * Math.abs(x) + bInt);
  return numberProblem({
    prompt: `Gegeben: ${fn}\nBerechne f(${T.int(x)}).`,
    answer: q(yInt),
    hint: valueHint,
    wrong: wrong.map((v) => q(v)),
    pair: `${fn}, f(${T.int(x)})`,
    solution: `f(${T.int(x)}) = ${T.int(mInt)} · ${T.bracketed(x)} ${T.plusMinus(bInt)} = ${T.int(mInt * x)} ${T.plusMinus(bInt)} = ${T.int(yInt)}`,
    explanation: 'Setze die Zahl für x in den Funktionsterm ein und rechne: erst malnehmen, dann addieren.',
  });
}

/** "4 nach rechts, 6 nach oben: welche Steigung?" Rise over run, never run over rise. */
function slopeTriangle(level: number, gen: Gen): Problem | null {
  let dx: number;
  let dy: number;
  switch (level) {
    case 1:
      dx = gen.int(1, 4);
      dy = dx * gen.int(2, 4);
      break;
    case 2:
      dx = gen.int(2, 6);
      dy = gen.chance(50) ? -dx * gen.int(2, 3) : gen.int(1, 9);
      break;
    default:
      dx = gen.int(2, 7);
      dy = gen.chance(70) ? -gen.int(1, 9) : gen.int(1, 9);
  }
  if (dy === 0 || Math.abs(dy) === dx) return null;
  const m = q(dy, dx);
  const rising = dy > 0;
  const up = Math.abs(dy);
  const story = `Von einem Punkt der Geraden gehst du ${dx} Einheiten nach rechts und ${up} Einheiten nach ${rising ? 'oben' : 'unten'}, und du bist wieder auf der Geraden.\nWelche Steigung hat sie?`;
  // Run over rise, the two numbers added or subtracted, the rise alone.
  const wrong = [q(dx, up).times(rising ? 1 : -1), q(dx + up), q(up - dx).times(rising ? 1 : -1), q(dy)];
  return numberProblem({
    prompt: story,
    answer: m,
    style: S.fraction,
    hint: 'Gib die Steigung als ganze Zahl oder Bruch an, zum Beispiel 3/2.',
    wrong,
    pair: `${dx} nach rechts, ${up} nach ${rising ? 'oben' : 'unten'}`,
    solution: `m = Höhe : Breite = ${T.int(dy)} : ${dx} = ${T.fraction(m)}. Die Gerade ${rising ? 'steigt' : 'fällt'}.`,
    explanation: 'Steigung ist Höhenunterschied durch Breitenunterschied. Nach oben ist der Höhenunterschied positiv, nach unten negativ.',
  });
}

// Lesson 2

/** "Berechne die Nullstelle von y = 2x − 6": set y = 0 and solve. */
function zeroPoint(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => zeroPointAttempt(level, gen));
}

function zeroPointAttempt(level: number, gen: Gen): Problem | null {
  let m: number;
  let b: number;
  switch (level) {
    case 1:
      m = gen.int(2, 6);
      b = -m * gen.int(1, 6);
      break;
    case 2:
      m = gen.nonZero(-6, 6);
      b = -m * gen.nonZero(-6, 6);
      break;
    default:
      m = gen.nonZero(-8, 8);
      b = gen.nonZero(-12, 12);
  }
  if (!(Math.abs(m) >= 2)) return null;
  const zero = q(-b, m);
  if (!zero.ok || decimals([zero], 2).length !== 1 || zero.isZero) return null;
  if (level === 3 && zero.isWhole) return null;
  // The sign of b kept, m and b swapped, the intercept itself, the sum.
  const wrong = decimals([q(b, m), q(m, b), q(b), q(m + b)], 2);
  const equation = T.line(m, b);
  return numberProblem({
    prompt: `Berechne die Nullstelle der Funktion.\n${equation}`,
    answer: zero,
    hint: 'Gib x als Zahl an.',
    wrong,
    pair: equation,
    solution: `0 = ${T.linear(m, b)}; ${T.int(m)}x = ${T.int(-b)}; x = ${T.int(-b)} : ${T.bracketed(m)} = ${T.number(zero)}`,
    explanation: 'An der Nullstelle ist y = 0. Setze 0 für y ein und löse die Gleichung nach x auf.',
  });
}

/** "P(1|2) und Q(3|8): welche Steigung?" Rise over run again, now from two points. */
function slopeTwoPoints(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => slopeTwoPointsAttempt(level, gen));
}

function slopeTwoPointsAttempt(level: number, gen: Gen): Problem | null {
  let x1: number;
  let x2: number;
  let y1: number;
  let y2: number;
  switch (level) {
    case 1:
      x1 = gen.int(0, 4);
      x2 = x1 + gen.int(1, 4);
      y1 = gen.int(0, 6);
      y2 = y1 + (x2 - x1) * gen.int(1, 4);
      break;
    case 2:
      x1 = gen.int(-4, 3);
      x2 = x1 + gen.int(1, 5);
      y1 = gen.int(-6, 6);
      y2 = y1 + (x2 - x1) * gen.nonZero(-4, 4);
      break;
    default:
      x1 = gen.int(-5, 3);
      x2 = x1 + gen.int(2, 7);
      y1 = gen.int(-6, 6);
      y2 = gen.int(-8, 8);
  }
  if (x1 === x2 || y1 === y2 || Math.abs(y2 - y1) === Math.abs(x2 - x1)) return null;
  const dy = y2 - y1;
  const dx = x2 - x1;
  const m = q(dy, dx);
  if (!(decimals([m], 2).length === 1 || level === 3)) return null;
  // x over y, the sums, the rise alone, the run alone.
  const wrong = [q(dx, dy), q(y2 + y1, x2 + x1), q(dy), q(dx)].filter((x) => x.ok);
  const p = point('P', q(x1), q(y1));
  const qp = point('Q', q(x2), q(y2));
  return numberProblem({
    prompt: `Eine Gerade geht durch ${p} und ${qp}.\nWie groß ist ihre Steigung?`,
    answer: m,
    hint: 'Gib die Steigung als ganze Zahl, Dezimalzahl oder Bruch an.',
    wrong,
    pair: `${p}, ${qp}`,
    solution: `m = (y₂ − y₁) : (x₂ − x₁) = (${T.int(y2)} ${T.minus} ${T.bracketed(y1)}) : (${T.int(x2)} ${T.minus} ${T.bracketed(x1)}) = ${T.int(dy)} : ${T.int(dx)} = ${T.number(m)}`,
    explanation: 'Die Steigung ist der Höhenunterschied durch den Breitenunterschied: m = (y₂ − y₁) : (x₂ − x₁). Beide Differenzen in derselben Reihenfolge bilden.',
  });
}

/** "Steigung 2, durch P(3|5): welches b?" Put the point in y = mx + b and solve for b. */
function yIntercept(level: number, gen: Gen): Problem | null {
  const m = slope(level, gen);
  const x = level === 3 && m.denominator === 2 ? 2 * gen.nonZero(-4, 4) : gen.nonZero(-5, 6);
  const b = q(gen.nonZero(-9, 9));
  const y = m.times(x).plus(b);
  if (!y.ok || !y.isWhole || !(Math.abs(y.numerator) <= 20)) return null;
  const p = point('P', q(x), y);
  const mx = m.times(x);
  // The point's y taken for b, the product added, the factor x forgotten, x subtracted.
  const wrong = decimals([y, y.plus(mx), y.minus(m), y.minus(q(x))], 2);
  return numberProblem({
    prompt: `Eine Gerade hat die Steigung ${T.number(m)} und geht durch ${p}.\nWie groß ist der y-Achsenabschnitt?`,
    answer: b,
    hint: valueHint,
    wrong,
    pair: `m = ${T.number(m)}, ${p}`,
    solution: `${T.int(y.numerator)} = ${T.number(m)} · ${T.bracketed(x)} + b; ${T.int(y.numerator)} = ${T.number(mx)} + b; b = ${T.number(b)}`,
    explanation: 'Setze die Steigung und die Koordinaten des Punktes in y = mx + b ein. Dann bleibt eine Gleichung, in der nur b fehlt.',
  });
}

/** "Gerade durch P(1|2) und Q(3|8): wie lautet die Gleichung?" The slope first, then b. */
function lineThroughTwo(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => lineThroughTwoAttempt(level, gen));
}

function lineThroughTwoAttempt(level: number, gen: Gen): Problem | null {
  const m = slope(level, gen);
  const b = q(gen.nonZero(-8, 8));
  const x1 = level === 3 && m.denominator === 2 ? 2 * gen.int(-2, 2) : gen.int(-2, 3);
  const step = level === 3 && m.denominator === 2 ? 2 * gen.int(1, 3) : gen.int(1, 3);
  const x2 = x1 + step;
  const y1 = m.times(x1).plus(b);
  const y2 = m.times(x2).plus(b);
  if (!y1.ok || !y2.ok || !y1.isWhole || !y2.isWhole || !(Math.abs(y1.numerator) <= 20) || !(Math.abs(y2.numerator) <= 20) || y1.eq(y2)) return null;
  const p = point('P', q(x1), y1);
  const qp = point('Q', q(x2), y2);
  const correct = line(m, b);
  // b taken from P or Q, b from the wrong sign, the rise taken for the slope.
  const wrongLines = [line(m, y1), line(m, y2), line(m, y1.plus(m.times(x1)))];
  const dy = y2.minus(y1);
  if (step !== 1) wrongLines.push(line(dy, y1.minus(dy.times(x1))));
  const problem = textProblem({
    prompt: `Eine Gerade geht durch ${p} und ${qp}.\nWie lautet ihre Gleichung?`,
    correct,
    wrong: wrongLines,
    typed: {
      prompt: `Eine Gerade geht durch ${p} und ${qp}.\nWie groß ist ihr y-Achsenabschnitt b?`,
      answer: b.value,
      text: T.number(b),
    },
    pair: `${p}, ${qp}`,
    solution: `m = (${T.number(y2)} ${T.minus} ${T.bracketed(y1.numerator)}) : (${x2} ${T.minus} ${T.bracketed(x1)}) = ${T.number(m)}; ${T.number(y1)} = ${T.number(m)} · ${T.bracketed(x1)} + b gibt b = ${T.number(b)}. Also ${correct}`,
    explanation: 'Erst die Steigung aus beiden Punkten bestimmen, dann einen Punkt in y = mx + b einsetzen und b ausrechnen.',
  });
  problem.pairPrompt = 'Ordne jedem Punktepaar seine Gerade zu.';
  return problem;
}

// Lesson 3

/** "Welcher Punkt liegt auf der Geraden?" Plug the coordinates in. */
function pointTest(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => pointTestAttempt(level, gen));
}

function pointTestAttempt(level: number, gen: Gen): Problem | null {
  const m = slope(level, gen);
  const b = q(gen.nonZero(-9, 9));
  const x = level === 3 && m.denominator === 2 ? 2 * gen.nonZero(-3, 3) : level === 1 ? gen.int(1, 6) : gen.nonZero(-5, 6);
  const y = m.times(x).plus(b);
  if (!y.ok || !y.isWhole || !(Math.abs(y.numerator) <= 25)) return null;
  const swapped = level === 3 && gen.chance(50);
  const equation = line(m, b, swapped);
  const xq = q(x);
  // b with the wrong sign, the x forgotten, the coordinates swapped, the product forgotten.
  let candidates: [Q, Q][] = [[xq, m.times(xq).minus(b)], [xq, m.plus(b)], [y, xq], [xq, xq.plus(b)], [xq, y.plus(m)]];
  candidates = candidates.filter((c) => c[0].isWhole && c[1].isWhole && !c[1].eq(m.times(c[0]).plus(b)));
  const wrong = candidates.map((c) => point('P', c[0], c[1]));
  const a = y;
  return textProblem({
    prompt: `Welcher Punkt liegt auf der Geraden?\n${equation}`,
    correct: point('P', xq, y),
    wrong,
    typed: {
      prompt: `Der Punkt P(${T.int(x)}|a) liegt auf der Geraden.\n${equation}\nWie groß ist a?`,
      answer: a.value,
      text: T.number(a),
    },
    solution: `x = ${T.int(x)} einsetzen: y = ${T.number(m)} · ${T.bracketed(x)} ${b.isNegative ? T.minus : '+'} ${T.number(b.magnitude)} = ${T.number(y)}`,
    explanation: 'Ein Punkt liegt auf der Geraden, wenn seine Koordinaten die Gleichung erfüllen. Setze x ein und vergleiche das Ergebnis mit dem y-Wert.',
  });
}

/** "Welche Gerade verläuft parallel zu y = 2x + 3?" Same slope, other b. */
function parallel(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => parallelAttempt(level, gen));
}

function parallelAttempt(level: number, gen: Gen): Problem | null {
  const m = slope(level, gen);
  const b1 = q(gen.nonZero(-9, 9));
  const b2 = q(gen.nonZero(-9, 9));
  if (b1.eq(b2)) return null;
  const given = line(m, b1);
  const correct = line(m, b2);
  // The slope with the other sign, the slope off by one, the two numbers swapped.
  const wrongLines = [m.negated, m.plus(1), m.minus(1)].filter((v) => !v.isZero).map((v) => line(v, b1));
  if (!b1.eq(m)) wrongLines.push(line(b1, m));
  // Through a point: the intercept of the parallel.
  const x = level === 3 && m.denominator === 2 ? 2 * gen.nonZero(-3, 3) : gen.nonZero(-4, 5);
  const y = m.times(x).plus(b2);
  if (!y.isWhole || !(Math.abs(y.numerator) <= 25)) return null;
  const p = point('P', q(x), y);
  return textProblem({
    prompt: `Welche Gerade verläuft parallel zu\n${given}?`,
    correct,
    wrong: wrongLines,
    typed: {
      prompt: `Eine Gerade ist parallel zu ${given} und geht durch ${p}.\nWie groß ist ihr y-Achsenabschnitt?`,
      answer: b2.value,
      text: T.number(b2),
    },
    solution: `Parallele Geraden haben dieselbe Steigung m = ${T.number(m)}; nur b ist anders. Also ${correct}`,
    explanation: 'Zwei Geraden sind parallel, wenn ihre Steigungen gleich sind. Der y-Achsenabschnitt darf anders sein. Mit einem Punkt findest du dann b.',
  });
}

/** Short stories with a fixed part and a part that grows or shrinks evenly. */
function application(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => applicationAttempt(level, gen));
}

function applicationAttempt(level: number, gen: Gen): Problem | null {
  // 0 phone (grows), 1 candle (shrinks), 2 pool (grows).
  const story = level === 1 ? gen.pick([0, 2]) : gen.int(0, 2);
  let m: Q;
  let b: Q;
  let x: number;
  let unit: string;
  let fn: string;
  switch (story) {
    case 0:
      m = q(gen.pick([5, 10, 15, 20, 25]), 100);
      b = q(gen.int(3, 9));
      x = gen.pick([20, 40, 60, 80, 100, 120, 150, 200]);
      unit = '€';
      fn = `Ein Handytarif kostet ${T.euroAmount(b)} Grundgebühr im Monat und ${T.euro(m)} je Gesprächsminute.`;
      break;
    case 1:
      m = q(-gen.int(2, 5));
      b = q(gen.int(5, 12) * 5);
      x = gen.int(2, 9);
      unit = 'cm';
      fn = `Eine Kerze ist ${T.number(b)} cm hoch und brennt ${T.number(m.magnitude)} cm in jeder Stunde ab.`;
      break;
    default:
      m = q(gen.int(3, 15));
      b = q(gen.int(4, 20) * 10);
      x = gen.int(2, 12);
      unit = 'l';
      fn = `In einem Becken sind ${T.number(b)} l Wasser. Es kommen ${T.number(m)} l je Minute dazu.`;
  }
  const y = b.plus(m.times(x));
  if (!y.ok || !(y.double > 0) || decimals([y], 2).length !== 1) return null;
  const style: Style = unit === '€' ? S.euro : S.unit(unit);
  if (level === 3) {
    // Backwards: after how long is the value reached?
    let verb: string;
    let valueText: string;
    switch (story) {
      case 0:
        [verb, valueText] = ['Die Rechnung beträgt', T.euroAmount(y)];
        break;
      case 1:
        [verb, valueText] = ['Die Kerze ist nur noch', T.number(y) + ' cm hoch'];
        break;
      default:
        [verb, valueText] = ['Im Becken sind jetzt', T.number(y) + ' l'];
    }
    const question = story === 0 ? 'Wie viele Minuten wurde telefoniert?' : story === 1 ? 'Wie lange brennt sie schon?' : 'Wie viele Minuten läuft das Wasser schon?';
    // The rate not divided, the fixed part added instead of taken off, the fixed part not taken off.
    const rate = m.magnitude;
    const wrong = positives(decimals([y.minus(b).magnitude, y.plus(b).over(rate), y.over(rate)], 2));
    if (!(wrong.length >= 3)) return null;
    return numberProblem({
      prompt: `${fn}\n${verb} ${valueText}. ${question}`,
      answer: q(x),
      style: S.unit(story === 1 ? 'Stunden' : 'Minuten'),
      hint: 'Gib nur die Zahl an.',
      wrong,
      solution: `${T.number(y)} = ${T.number(b)} ${m.isNegative ? T.minus : '+'} ${T.number(rate)} · x; ${T.number(rate)} · x = ${T.number(y.minus(b).magnitude)}; x = ${x}`,
      explanation:
        'Der Wert besteht aus dem festen Anfangswert und dem Anteil, der mit x wächst oder schrumpft. Ziehe zuerst den Anfangswert ab, dann teilst du durch die Änderung je Einheit.',
    });
  }
  const rate = m.magnitude;
  // The fixed part forgotten, rate and fixed part added, the wrong direction, the fixed part multiplied too.
  const wrong = [rate.times(x), rate.plus(b), b.minus(m.times(x)), b.times(x)];
  const target = story === 1 ? `Wie hoch ist sie nach ${x} Stunden?` : story === 0 ? `Wie viel kostet es bei ${x} Minuten?` : `Wie viel Wasser ist nach ${x} Minuten im Becken?`;
  return numberProblem({
    prompt: `${fn}\n${target}`,
    answer: y,
    style,
    hint: 'Gib nur die Zahl an.',
    wrong: positives(decimals(wrong, 2)),
    solution: `y = ${T.number(b)} ${m.isNegative ? T.minus : '+'} ${T.number(rate)} · ${x} = ${T.number(y)} ${unit}`,
    explanation: 'Rechne den veränderlichen Teil (Änderung je Einheit mal Anzahl) aus und addiere ihn zum festen Anfangswert, oder ziehe ihn ab, wenn der Wert sinkt.',
  });
}
