import { Rational } from '../../rational';
import { MathGen, Problem, S, Template, idiv, numberProblem, q, template, textProblem } from './core';
import { mathText as T } from './text';

/** Unit 4, Terme und lineare Gleichungen: Terme berechnen, zusammenfassen und Klammern auflösen (lesson 1), Gleichungen mit einer Unbekannten lösen (2), x auf beiden Seiten, Probe und Textaufgaben (3). */

const valueHint = 'Gib nur die Zahl an.';
const minus = T.minus;
const whole = (values: number[]) => values.map((v) => q(v));

// Lesson 1

/** "Berechne den Wert von 3x + 5 für x = 4." Level 3 has a square, so the sign of a negative x matters. */
function evalTerm(level: number, gen: MathGen): Problem | null {
  let term: string;
  let x: number;
  let value: number;
  let working: string;
  let wrong: number[];
  if (level <= 2) {
    const a = level === 1 ? gen.int(2, 9) : gen.nonZero(-9, 9);
    x = level === 1 ? gen.int(1, 6) : gen.nonZero(-5, 5);
    let b = level === 1 ? gen.int(1, 9) : gen.nonZero(-9, 9);
    if (level === 1 && gen.chance(40) && a * x > b) b = -b;
    term = T.linear(a, b);
    value = a * x + b;
    working = `${T.int(a)} · ${T.bracketed(x)} ${T.plusMinus(b)} = ${T.int(a * x)} ${T.plusMinus(b)} = ${T.int(value)}`;
    // "ax" read as a + x, the sign of b turned, the bracket forgotten, the digits written side by side.
    wrong = [a + x + b, a * x - b, a * (x + b)];
    if (a > 0 && x > 0) wrong.push(Number(`${a}${x}`) + b);
    if (x < 0) wrong.push(a * Math.abs(x) + b);
  } else {
    const a = gen.pick([1, 2, 3]);
    const b = gen.nonZero(-5, 5);
    const c = gen.nonZero(-6, 6);
    x = gen.pick([-4, -3, -2, -1, 2, 3, 4]);
    term = T.polynomial([a, b, c]);
    value = a * x * x + b * x + c;
    working = `${a} · ${T.bracketed(x)}² ${T.plusMinus(b)} · ${T.bracketed(x)} ${T.plusMinus(c)} = ${a * x * x} ${T.plusMinus(b * x)} ${T.plusMinus(c)} = ${T.int(value)}`;
    // x² read as 2x, a·x squared as a whole, a negative square taken as negative, the factor x forgotten at b.
    wrong = [2 * a * x + b * x + c, a * x * (a * x) + b * x + c, -a * x * x + b * x + c, a * x * x + b + c];
  }
  const xText = T.int(x);
  return numberProblem({
    prompt: `Berechne den Wert von ${term} für x = ${xText}.`, answer: q(value), hint: valueHint, wrong: whole(wrong),
    pair: `${term} für x = ${xText}`, solution: working,
    explanation: 'Setze die Zahl für x ein und rechne Schritt für Schritt: erst Potenzen, dann Punkt vor Strich. Eine negative Zahl kommt in Klammern.',
  });
}

/** A sum written out: "3x", "x", "5", with its sign in front unless it is the first. */
function render(terms: { coefficient: number; hasX: boolean }[]): string {
  let text = '';
  terms.forEach((term, index) => {
    const magnitude = Math.abs(term.coefficient);
    const piece = term.hasX ? (magnitude === 1 ? 'x' : `${magnitude}x`) : `${magnitude}`;
    if (index === 0) text = (term.coefficient < 0 ? minus : '') + piece;
    else text += (term.coefficient < 0 ? ` ${minus} ` : ' + ') + piece;
  });
  return text;
}

const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);

/** "Fasse zusammen: 3x + 5 − x + 2": like terms together, x with x and numbers with numbers. */
function simplify(level: number, gen: MathGen): Problem | null {
  let xs: number[];
  let ks: number[];
  switch (level) {
    case 1:
      xs = [gen.int(1, 6), gen.int(1, 6)];
      ks = gen.chance(50) ? [gen.int(1, 9), gen.int(1, 9)] : [gen.int(1, 9)];
      break;
    case 2:
      xs = [gen.int(3, 9), -gen.int(1, 6)];
      ks = [gen.int(1, 9), -gen.int(1, 9)];
      break;
    default:
      xs = [gen.nonZero(-7, 7), gen.nonZero(-7, 7), gen.nonZero(-7, 7)];
      ks = [gen.nonZero(-9, 9), gen.nonZero(-9, 9)];
  }
  const sumX = sum(xs);
  const sumK = sum(ks);
  if (sumX === 0 || sumK === 0 || Math.abs(sumX) > 14 || Math.abs(sumK) > 18) return null;
  // Levels 2 and 3 subtract: at least one summand is negative.
  if (level !== 1 && ![...xs, ...ks].some((v) => v < 0)) return null;
  const terms = gen.shuffled([...xs.map((c) => ({ coefficient: c, hasX: true })), ...ks.map((c) => ({ coefficient: c, hasX: false }))]);
  const expression = render(terms);
  const correct = T.linear(sumX, sumK);
  // Unlike terms put together, x·x written as x², a term left out, a sign turned.
  const negativeX = xs.find((v) => v < 0);
  const negativeK = ks.find((v) => v < 0);
  const wrong = [
    T.linear(sumX + sumK, 0),
    T.polynomial([sumX, 0, sumK]),
    negativeX !== undefined ? T.linear(sumX - 2 * negativeX, sumK) : T.linear(sumX - xs[0], sumK),
    negativeK !== undefined ? T.linear(sumX, sumK - 2 * negativeK) : T.linear(sumX, sumK - ks[ks.length - 1]),
  ];
  const asksCoefficient = Math.abs(sumX) !== 1 && gen.chance(50);
  const problem = textProblem({
    prompt: `Fasse zusammen:\n${expression}`, correct, wrong,
    typed: { prompt: `Fasse zusammen: ${expression}\n` + (asksCoefficient ? 'Welche Zahl steht danach vor dem x?' : 'Welche Zahl steht danach ohne x?'), answer: Rational.whole(asksCoefficient ? sumX : sumK) },
    pair: expression, solution: `x-Terme: ${T.int(sumX)}x, Zahlen: ${T.int(sumK)}; zusammen ${correct}`,
    explanation: 'Nur gleichartige Summanden darfst du zusammenfassen: x mit x und Zahlen mit Zahlen. Das Vorzeichen gehört zum Summanden dahinter.',
  });
  problem.pairPrompt = 'Fasse zusammen und ordne zu.';
  return problem;
}

/** "Löse die Klammer auf: 3(x − 4)": every summand inside is multiplied by the factor in front. */
function expand(level: number, gen: MathGen): Problem | null {
  let expression: string;
  let coefficient: number;
  let constant: number;
  let wrong: string[];
  let working: string;
  if (level === 1) {
    const a = gen.int(2, 9);
    const b = gen.int(1, 9);
    expression = `${a}(x + ${b})`;
    [coefficient, constant] = [a, a * b];
    wrong = [T.linear(a, b), T.linear(1, a * b), T.linear(a, a + b)];
    working = `${a} · x + ${a} · ${b} = ${T.linear(coefficient, constant)}`;
  } else if (level === 2) {
    const a = gen.int(2, 9);
    const b = gen.int(1, 9);
    expression = `${a}(x ${minus} ${b})`;
    [coefficient, constant] = [a, -a * b];
    wrong = [T.linear(a, -b), T.linear(1, a - b), T.linear(1, -a * b), T.linear(a, a * b)];
    working = `${a} · x ${minus} ${a} · ${b} = ${T.linear(coefficient, constant)}`;
  } else if (gen.chance(50)) {
    // c − a(x + b): the minus in front turns both signs inside.
    const a = gen.int(2, 5);
    const b = gen.int(1, 6);
    const c = gen.int(1, 9);
    // A number of 0 outside x would make "the number without x" a trick question.
    if (c === a * b) return null;
    expression = `${c} ${minus} ${a}(x + ${b})`;
    [coefficient, constant] = [-a, c - a * b];
    wrong = [T.linear(-a, c - b), T.linear(-a, c + a * b), T.linear(c - a, (c - a) * b)];
    working = `${c} ${minus} ${a}x ${minus} ${a * b} = ${T.linear(coefficient, constant)}`;
  } else {
    // a(bx − c): both summands inside are multiplied.
    const a = gen.int(2, 5);
    const b = gen.int(2, 5);
    const c = gen.int(1, 6);
    expression = `${a}(${b}x ${minus} ${c})`;
    [coefficient, constant] = [a * b, -a * c];
    wrong = [T.linear(a * b, -c), T.linear(b, -a * c), T.linear(a + b, -c * a), T.linear(a * b, a * c)];
    working = `${a} · ${b}x ${minus} ${a} · ${c} = ${T.linear(coefficient, constant)}`;
  }
  const asksCoefficient = gen.chance(50);
  const problem = textProblem({
    prompt: `Löse die Klammer auf:\n${expression}`, correct: T.linear(coefficient, constant), wrong,
    typed: { prompt: `Löse die Klammer auf: ${expression}\n` + (asksCoefficient ? 'Welche Zahl steht danach vor dem x?' : 'Welche Zahl steht danach ohne x?'), answer: Rational.whole(asksCoefficient ? coefficient : constant) },
    pair: expression, solution: working,
    explanation: 'Multipliziere jeden Summanden in der Klammer mit dem Faktor davor. Steht ein Minus vor der Klammer, drehen sich die Vorzeichen um.',
  });
  problem.pairPrompt = 'Löse die Klammer auf und ordne zu.';
  return problem;
}

// Lesson 2

const solveHint = 'Gib die Zahl an.';

/** "x + 7 = 15", "3x = 21", "x : 4 = 5": one step undoes the operation. */
function oneStep(level: number, gen: MathGen): Problem | null {
  const kind = level === 1 ? gen.int(0, 1) : gen.int(0, 3);
  let equation: string;
  let x: number;
  let wrong: number[];
  let step: string;
  let probe: string;
  switch (kind) {
    case 0: {
      const b = level === 3 ? gen.int(4, 15) : gen.int(2, 12);
      x = level === 3 ? gen.int(-12, -1) : gen.int(1, 15);
      const c = x + b;
      equation = `x + ${b} = ${T.int(c)}`;
      wrong = [c + b, b - c, c * b, c];
      step = `x = ${T.int(c)} ${minus} ${b} = ${T.int(x)}`;
      probe = `${T.bracketed(x)} + ${b} = ${T.int(c)}`;
      break;
    }
    case 1: {
      const b = level === 3 ? gen.int(4, 15) : gen.int(2, 12);
      x = level === 3 ? gen.int(-12, -1) : gen.int(2, 20);
      const c = x - b;
      equation = `x ${minus} ${b} = ${T.int(c)}`;
      wrong = [c - b, b - c, c * b, c];
      step = `x = ${T.int(c)} + ${b} = ${T.int(x)}`;
      probe = `${T.bracketed(x)} ${minus} ${b} = ${T.int(c)}`;
      break;
    }
    case 2: {
      const a = level === 3 ? -gen.int(2, 9) : gen.int(2, 9);
      x = level === 3 ? gen.nonZero(-9, 9) : gen.int(2, 12);
      const c = a * x;
      equation = `${T.int(a)}x = ${T.int(c)}`;
      wrong = [c - a, c * a, c + a, a - c];
      step = `x = ${T.int(c)} : ${T.bracketed(a)} = ${T.int(x)}`;
      probe = `${T.int(a)} · ${T.bracketed(x)} = ${T.int(c)}`;
      break;
    }
    default: {
      const a = gen.int(2, 9);
      const c = level === 3 ? gen.nonZero(-9, 9) : gen.int(2, 9);
      x = c * a;
      equation = `x : ${a} = ${T.int(c)}`;
      wrong = c % a === 0 ? [c - a, c + a, a - c, idiv(c, a)] : [c - a, c + a, a - c];
      step = `x = ${T.int(c)} · ${a} = ${T.int(x)}`;
      probe = `${T.bracketed(x)} : ${a} = ${T.int(c)}`;
    }
  }
  return numberProblem({
    prompt: `Löse die Gleichung. Welchen Wert hat x?\n${equation}`, answer: q(x), hint: solveHint, wrong: whole(wrong),
    pair: equation, solution: `${step}. Probe: ${probe} stimmt.`,
    explanation: 'Mache die Rechnung auf beiden Seiten rückgängig: Plus mit Minus, Mal mit Geteilt.',
  });
}

/** "3x + 5 = 20": undo the addition first, then the multiplication. */
function twoStep(level: number, gen: MathGen): Problem | null {
  let a: number;
  let b: number;
  let x: number;
  switch (level) {
    case 1:
      a = gen.int(2, 5);
      x = gen.int(1, 9);
      b = gen.int(1, 9);
      break;
    case 2:
      a = gen.int(2, 9);
      x = gen.int(2, 12);
      b = gen.nonZero(-12, 12);
      break;
    default:
      a = gen.nonZero(-9, 9);
      x = gen.nonZero(-9, 9);
      b = gen.nonZero(-12, 12);
  }
  if (Math.abs(a) < 2) return null;
  const c = a * x + b;
  const equation = `${T.linear(a, b)} = ${T.int(c)}`;
  // Dividing forgotten, multiplied instead of divided, the sign of b turned, only c divided.
  const wrong = [c - b, (c - b) * a, c + b];
  if ((c + b) % a === 0) wrong.push(idiv(c + b, a));
  if (c % a === 0) wrong.push(idiv(c, a) - b);
  const step = `${T.int(a)}x = ${T.int(c)} ${b < 0 ? '+' : minus} ${Math.abs(b)} = ${T.int(c - b)}; x = ${T.int(c - b)} : ${T.bracketed(a)} = ${T.int(x)}`;
  return numberProblem({
    prompt: `Löse die Gleichung. Welchen Wert hat x?\n${equation}`, answer: q(x), hint: solveHint, wrong: whole(wrong),
    pair: equation, solution: `${step}. Probe: ${T.int(a)} · ${T.bracketed(x)} ${T.plusMinus(b)} = ${T.int(c)} stimmt.`,
    explanation: 'Mache die Rechenschritte in umgekehrter Reihenfolge rückgängig: erst die Zahl ohne x auf die andere Seite, dann durch die Zahl vor x teilen.',
  });
}

function probeBrackets(a: number, inside: string, d: number, x: number, result: number): string {
  const value = inside.split('x').join(T.bracketed(x));
  const tail = d === 0 ? '' : ` ${T.plusMinus(d)}`;
  return `${a}(${value})${tail} = ${T.int(result)} stimmt.`;
}

/** "2(x + 3) = 14": a bracket times a factor equals a number; level 3 has a number added outside. */
function brackets(level: number, gen: MathGen): Problem | null {
  const a = gen.int(2, 5);
  const b = gen.int(1, 6);
  const isMinus = level >= 2 && gen.chance(50);
  const x = level === 1 ? gen.int(1, 8) : gen.int(-3, 10);
  // What the bracket adds to x: +b for (x + b), −b for (x − b).
  const shift = isMinus ? -b : b;
  const d = level === 3 ? gen.nonZero(-9, 9) : 0;
  const e = a * (x + shift) + d;
  const inside = isMinus ? `x ${minus} ${b}` : `x + ${b}`;
  const left = d === 0 ? `${a}(${inside})` : `${a}(${inside}) ${T.plusMinus(d)}`;
  const equation = `${left} = ${T.int(e)}`;
  // After the number outside the bracket is taken off, a times the bracket is left.
  const product = e - d;
  const quotient = idiv(product, a);
  // The shift forgotten, the shift added instead of taken off, the factor ignored, b not multiplied by the factor.
  const wrong = [quotient, quotient + shift, product - shift];
  if ((product - shift) % a === 0) wrong.push(idiv(product - shift, a));
  const firstStep = d === 0 ? '' : `${T.int(e)} ${d < 0 ? '+' : minus} ${Math.abs(d)} = ${T.int(product)}; `;
  return numberProblem({
    prompt: `Löse die Gleichung. Welchen Wert hat x?\n${equation}`, answer: q(x), hint: solveHint, wrong: whole(wrong),
    pair: equation,
    solution: `${firstStep}${T.int(product)} : ${a} = ${T.int(quotient)}, also x ${isMinus ? `${minus} ${b}` : `+ ${b}`} = ${T.int(quotient)} und x = ${T.int(x)}. Probe: ${probeBrackets(a, inside, d, x, e)}`,
    explanation: 'Rechne zuerst das Äußere rückgängig: die Zahl neben der Klammer, dann den Faktor vor der Klammer. Danach bleibt eine einfache Gleichung.',
  });
}

// Lesson 3

function bothSidesAttempt(level: number, gen: MathGen): Problem | null {
  let a: number;
  let c: number;
  let x: number;
  switch (level) {
    case 1:
      c = gen.int(1, 4);
      a = c + gen.int(1, 5);
      x = gen.int(1, 9);
      break;
    case 2:
      c = gen.nonZero(-5, 6);
      a = gen.nonZero(-5, 9);
      x = gen.nonZero(-8, 9);
      break;
    default:
      c = gen.nonZero(-4, 6);
      a = gen.int(2, 6);
      x = gen.nonZero(-8, 9);
  }
  if (a === c) return null;
  // a x + p = c x + q, where level 3 writes the left side as a(x + e) with p = a e.
  const slope = a - c;
  let equation: string;
  let p: number;
  let qq: number;
  if (level === 3) {
    const e = gen.nonZero(-9, 9);
    p = a * e;
    qq = a * (x + e) - c * x;
    equation = `${a}(x ${T.plusMinus(e)}) = ${T.linear(c, qq)}`;
  } else {
    p = gen.nonZero(-9, 9);
    qq = slope * x + p;
    equation = `${T.linear(a, p)} = ${T.linear(c, qq)}`;
  }
  const moved = qq - p;
  // Forgotten to divide, the sign of the number turned, the x-terms added instead of taken off.
  let wrong = [moved, qq + p];
  if ((qq + p) % slope === 0) wrong.push(idiv(qq + p, slope));
  if (a + c !== 0 && moved % (a + c) === 0) wrong.push(idiv(moved, a + c));
  wrong = wrong.filter((v) => v !== x);
  if (new Set(wrong).size < 3) return null;
  const opening = level === 3 ? `Klammer auflösen: ${T.linear(a, p)} = ${T.linear(c, qq)}; ` : '';
  return numberProblem({
    prompt: `Löse die Gleichung. Welchen Wert hat x?\n${equation}`, answer: q(x), hint: solveHint, wrong: whole(wrong),
    pair: equation, solution: `${opening}${T.int(slope)}x = ${T.int(moved)}; x = ${T.int(moved)} : ${T.bracketed(slope)} = ${T.int(x)}`,
    explanation: 'Bringe alle x auf eine Seite und alle Zahlen auf die andere, jeweils mit der Gegenoperation. Dann teilst du durch die Zahl vor x.',
  });
}

/** "5x − 3 = 2x + 9": collect the x on one side first. */
const bothSides = (level: number, gen: MathGen): Problem | null => gen.attempt(() => bothSidesAttempt(level, gen));

/** "Welche Zahl ist die Lösung?" by trying the numbers; typed: the value both sides take when the solution is put in. */
function plugIn(level: number, gen: MathGen): Problem | null {
  let a: number;
  let c: number;
  let b: number;
  let x: number;
  switch (level) {
    case 1:
      c = gen.int(1, 4);
      a = c + gen.int(1, 4);
      x = gen.int(1, 9);
      b = gen.int(1, 9);
      break;
    case 2:
      c = gen.nonZero(-4, 5);
      a = gen.nonZero(-4, 8);
      x = gen.nonZero(-6, 9);
      b = gen.nonZero(-9, 9);
      break;
    default:
      c = gen.nonZero(-4, 5);
      a = gen.int(2, 6);
      x = gen.nonZero(-6, 9);
      b = gen.nonZero(-6, 6);
  }
  if (a === c) return null;
  let left: string;
  let right: string;
  let value: number;
  if (level === 3) {
    // a(x + b) = c x + d
    const d = a * (x + b) - c * x;
    left = `${a}(x ${T.plusMinus(b)})`;
    right = T.linear(c, d);
    value = a * (x + b);
  } else {
    const d = (a - c) * x + b;
    left = T.linear(a, b);
    right = T.linear(c, d);
    value = a * x + b;
  }
  const equation = `${left} = ${right}`;
  // Numbers next to the solution: the usual slips of one or two.
  const wrong = [x + 1, x - 1, x + 2, x - 2];
  const both = T.int(value);
  return numberProblem({
    prompt: `Welche Zahl ist die Lösung der Gleichung? Setze zur Probe ein.\n${equation}`, answer: q(x), hint: '', wrong: whole(wrong),
    typedPrompt: `Die Lösung der Gleichung ${equation} ist x = ${T.int(x)}.\nWelchen Wert haben beide Seiten, wenn du ${T.int(x)} einsetzt?`, typedAnswer: q(value),
    solution: `Probe mit x = ${T.int(x)}: links ${both} und rechts ${both}. Beide Seiten sind gleich, also stimmt die Lösung.`,
    explanation: 'Eine Zahl ist die Lösung, wenn beide Seiten der Gleichung nach dem Einsetzen denselben Wert haben.',
  });
}

function wordAttempt(level: number, gen: MathGen): Problem | null {
  if (level === 1) {
    const a = gen.int(2, 9);
    const x = gen.int(2, 12);
    const b = gen.int(1, 12);
    const adds = gen.chance(50);
    const c = adds ? a * x + b : a * x - b;
    if (!(c > 0)) return null;
    const factor = a === 2 ? 'Ich verdopple sie' : `Ich multipliziere sie mit ${a}`;
    const signed = adds ? b : -b;
    // Dividing forgotten, the sign of the number turned, the number ignored, the sign turned and then divided.
    const options = [c - signed, c + signed];
    if (c % a === 0) options.push(idiv(c, a));
    if ((c + signed) % a === 0) options.push(idiv(c + signed, a));
    return numberProblem({
      prompt: `Ich denke mir eine Zahl. ${factor} und ${adds ? 'addiere' : 'subtrahiere'} ${b}. Das Ergebnis ist ${c}.\nWelche Zahl habe ich mir gedacht?`,
      answer: q(x), hint: solveHint, wrong: whole(options.filter((v) => v !== x)),
      solution: `${T.linear(a, signed)} = ${c}; ${a}x = ${c - signed}; x = ${x}`,
      explanation: 'Schreibe die Geschichte als Gleichung (die gedachte Zahl ist x) und löse sie wie gewohnt.',
    });
  }
  if (level === 2) {
    const a = gen.int(2, 5);
    const x = gen.int(3, 15);
    const b = gen.int(3, 12);
    const c = a * x + b;
    const [story, unit] = gen.pick<[string, string]>([
      [`Ein Taxi berechnet ${b} € Grundgebühr und ${a} € je Kilometer. Die Fahrt kostet ${c} €.\nWie viele Kilometer ist sie lang?`, 'km'],
      [`Ein Fahrradverleih nimmt ${b} € Pauschale und ${a} € je Stunde. Tim zahlt ${c} €.\nWie viele Stunden hat er das Rad geliehen?`, 'Stunden'],
      [`Ein Handwerker berechnet ${b} € für die Anfahrt und ${a} € je Arbeitsstunde. Die Rechnung beträgt ${c} €.\nWie viele Stunden hat er gearbeitet?`, 'Stunden'],
    ]);
    const options = [c - b, idiv(c, a), x + b, (c - b) * a];
    if (c % a !== 0) options.splice(1, 1);
    return numberProblem({
      prompt: story, answer: q(x), style: S.unit(unit), hint: valueHint, wrong: whole(options.filter((v) => v !== x)),
      solution: `${T.linear(a, b)} = ${c} mit x als Anzahl der ${unit}; ${a}x = ${c - b}; x = ${x}`,
      explanation: 'Die Grundgebühr wird nur einmal bezahlt. Ziehe sie zuerst vom Gesamtpreis ab und teile dann durch den Preis je Einheit.',
    });
  }
  const r2 = gen.int(2, 6);
  const difference = gen.int(2, 5);
  const r1 = r2 + difference;
  const x = gen.int(3, 12);
  const p1 = gen.int(2, 12) * 5;
  const p2 = p1 + difference * x;
  const names = gen.pick<[string, string]>([['Tom', 'Lena'], ['Mia', 'Jan'], ['Ali', 'Eva']]);
  const gap = p2 - p1;
  const candidates: [number, boolean][] = [
    [gap, true], [idiv(gap, r1), gap % r1 === 0], [idiv(gap, r2), gap % r2 === 0], [idiv(gap, r1 + r2), gap % (r1 + r2) === 0],
    [idiv(p1 + p2, difference), (p1 + p2) % difference === 0],
  ];
  const options = candidates.filter(([, keep]) => keep).map(([v]) => v).filter((v) => v !== x);
  if (new Set(options).size < 3) return null;
  return numberProblem({
    prompt: `${names[0]} hat ${p1} € und spart ${r1} € pro Woche. ${names[1]} hat ${p2} € und spart ${r2} € pro Woche.\nNach wie vielen Wochen haben beide gleich viel?`,
    answer: q(x), style: S.unit('Wochen'), hint: valueHint, wrong: whole(options),
    solution: `${p1} + ${r1}x = ${p2} + ${r2}x; ${difference}x = ${gap}; x = ${x}`,
    explanation: 'Beide Beträge nach x Wochen setzt du gleich. Dann sammelst du die x auf einer Seite und löst die Gleichung.',
  });
}

/** Short stories that lead to one equation. */
const word = (level: number, gen: MathGen): Problem | null => gen.attempt(() => wordAttempt(level, gen));

export const unit04: Template[] = [
  template('u04.evalTerm', 1, evalTerm, ['choice', 'typed', 'pairs']),
  template('u04.simplify', 1, simplify, ['choice', 'typed', 'pairs']),
  template('u04.expand', 1, expand, ['choice', 'typed', 'pairs']),
  template('u04.oneStep', 2, oneStep, ['choice', 'typed', 'pairs']),
  template('u04.twoStep', 2, twoStep, ['choice', 'typed', 'pairs']),
  template('u04.brackets', 2, brackets, ['choice', 'typed', 'pairs']),
  template('u04.bothSides', 3, bothSides, ['choice', 'typed', 'pairs']),
  template('u04.plugIn', 3, plugIn, ['choice', 'typed']),
  template('u04.word', 3, word, ['choice', 'typed']),
];
