import { UCalc } from './calc';
import { UGen, UPairs, UQ, UTemplate, UText, choiceProblem, numeric, uq, utemplate } from './core';

/** Unit 4: exponential function and logarithm (derivative, antiderivative, logarithm laws, equations). */

/** "3e^(2x)", "e^x", "−e^(−x)", "2e^(3x)/5". */
function expText(coefficient: UQ, k: number): string {
  const exponent = k === 1 ? 'x' : k === -1 ? '(−x)' : `(${UText.signed(k)}x)`;
  const magnitude = coefficient.magnitude;
  const head = magnitude.n === 1 ? '' : `${magnitude.n}`;
  const tail = magnitude.d === 1 ? '' : `/${magnitude.d}`;
  return `${coefficient.n < 0 ? '−' : ''}${head}e^${exponent}${tail}`;
}

const exponentName = (k: number): string => (k === 1 ? 'x' : k === -1 ? '−x' : `${UText.signed(k)}x`);

function functionText(a: number, k: number, b: number): string {
  let text = expText(uq(a), k);
  if (b !== 0) text += `${b < 0 ? ' − ' : ' + '}${Math.abs(b) === 1 ? '' : `${Math.abs(b)}`}x²`;
  return text;
}

function derivativePairs(_level: number, g: UGen): UPairs | null {
  const items: UPairs = [];
  const ks = new Set<number>();
  for (let i = 0; i < 60 && items.length < 4; i++) {
    const k = g.int(2, 6);
    const a = g.int(1, 4);
    if (!ks.has(k)) {
      ks.add(k);
      items.push({ front: `f(x) = ${expText(uq(a), k)}`, back: `f′(x) = ${expText(uq(a * k), k)}` });
    }
  }
  return items.length === 4 ? items : null;
}

const derivative = utemplate('e.deriv', (lv, g) => {
  const k = lv === 1 ? g.pick([1, 2, 3, 4, 5]) : g.nonzero(-4, 5);
  const a = lv === 1 ? 1 : g.nonzero(-4, 4);
  const b = lv === 3 ? g.nonzero(-3, 4) : 0;
  const secondPart = (c: UQ): string => (b === 0 ? '' : `${c.n < 0 ? ' − ' : ' + '}${c.magnitude.n === 1 ? '' : `${c.magnitude.n}`}x`);
  const secondCorrect = secondPart(uq(2 * b));
  const secondWrong = secondPart(uq(b));
  const correct = expText(uq(a * k), k) + secondCorrect;
  const noChain = expText(uq(a), k) + secondCorrect;
  const integrated = expText(uq(a, k), k) + secondCorrect;
  const power = `${a * k === 1 ? '' : a * k === -1 ? '−' : UText.signed(a * k)}x·e^(${exponentName(k)} − 1)${secondCorrect}`;
  const wrong = [noChain, integrated, power];
  if (b !== 0) wrong.push(correct.split(secondCorrect).join(secondWrong));
  if (a !== 1) wrong.push(expText(uq(k), k) + secondCorrect);
  return choiceProblem({
    key: `e.deriv|${a}|${k}|${b}`, prompt: `Bilde die Ableitung von f(x) = ${functionText(a, k, b)}.`, correct, wrong,
    solution: `Kettenregel: (e^(kx))′ = k·e^(kx). Hier k = ${k}: ${correct}.`,
    explanation: 'Beim Ableiten von e^(kx) kommt die innere Ableitung k als Faktor dazu; der Exponent bleibt unverändert.',
    fact: { k: 'expDeriv', a, kk: k, b },
  });
}, derivativePairs);

const antiderivative = utemplate('e.anti', (lv, g) => {
  const k = lv === 1 ? g.pick([1, 2, 3, 4]) : g.nonzero(-4, 5);
  const a = lv === 1 ? 1 : g.nonzero(-4, 4);
  const correct = `${expText(uq(a, k), k)} + C`;
  const wrong = [`${expText(uq(a * k), k)} + C`, `${expText(uq(a), k)} + C`, `${UText.coefficient(a)}e^(${exponentName(k)} + 1)/(${exponentName(k)} + 1) + C`];
  return choiceProblem({
    key: `e.anti|${a}|${k}`, prompt: `Welche Funktion ist eine Stammfunktion von f(x) = ${expText(uq(a), k)}?`, correct, wrong,
    solution: `∫ e^(kx) dx = (1/k)·e^(kx) + C, hier mit k = ${k} und dem Faktor ${a}: ${correct}.`,
    explanation: 'Beim Aufleiten von e^(kx) musst du durch k teilen; zur Probe leitest du das Ergebnis ab.',
    fact: { k: 'expAnti', a, kk: k },
  });
});

const valueAtZero = utemplate('e.zero', (lv, g) => {
  const a = g.nonzero(-4, 4);
  const k = lv === 1 ? g.nonzero(1, 4) : g.nonzero(-4, 4);
  const b = g.nonzero(-5, 5);
  const c = g.int(-5, 5);
  const askDerivative = g.chance(0.6);
  const f = (x: number) => a * Math.exp(k * x) + b * x + c;
  const name = `${expText(uq(a), k)}${b < 0 ? ' − ' : ' + '}${Math.abs(b) === 1 ? '' : `${Math.abs(b)}`}x${c === 0 ? '' : `${c < 0 ? ' − ' : ' + '}${Math.abs(c)}`}`;
  const answer = uq(askDerivative ? a * k + b : a + c);
  const wrongs = askDerivative ? [uq(a + c), uq(a * k), uq(a + b), uq(k + b), uq(a)] : [uq(a * k + b), uq(a + b + c), uq(c), uq(a * k + c), uq(a)];
  return numeric({
    key: `e.zero|${name}|${askDerivative}`, prompt: `Berechne ${askDerivative ? 'f′(0)' : 'f(0)'} für f(x) = ${name}.`, answer, wrongs: UCalc.differing(wrongs, answer),
    solution: askDerivative
      ? `f′(x) = ${uq(a * k).text}·e^(${exponentName(k)}) + ${b}; wegen e⁰ = 1 ist f′(0) = ${a * k} + ${b} = ${answer.text}.`
      : `Wegen e⁰ = 1 ist f(0) = ${a} + 0 + ${c} = ${answer.text}.`,
    explanation: 'Setzt du x = 0 ein, wird jeder Exponent 0, und e⁰ = 1.',
    fact: askDerivative ? { k: 'derivOfFunction', fn: f, at: 0 } : { k: 'valueOfFunction', fn: f, at: 0 },
  });
});

const inverse = utemplate('e.inverse', (lv, g) => {
  const n = g.nonzero(-5, 6);
  const m = g.int(2, 9);
  const items: [string, number, string, number, UQ[]][] = [
    [`ln(e${UText.superscript(n)})`, n, 'ln und e heben sich auf: ln(e^n) = n.', n, [UQ.one, UQ.zero, uq(n * n), uq(n + 1)]],
    [`e^(ln ${m})`, m, 'e^(ln m) = m, denn e und ln sind Umkehrfunktionen.', m, [UQ.one, UQ.zero, uq(m * m), uq(m + 1)]],
    ['ln(1)', 0, 'e⁰ = 1, also ln(1) = 0.', 0, [UQ.one, uq(-1), uq(2)]],
    ['ln(e)', 1, 'e¹ = e, also ln(e) = 1.', 1, [UQ.zero, uq(2), uq(-1)]],
  ];
  const pick = lv === 1 ? g.pick([items[2], items[3], items[1]]) : g.pick(items);
  const answer = uq(pick[1]);
  const wrongs = UCalc.differing(pick[4], answer);
  return numeric({
    key: `e.inverse|${pick[0]}`, prompt: `Berechne ${pick[0]}.`, answer, wrongs, solution: `${pick[2]} Ergebnis: ${answer.text}.`,
    explanation: 'Exponentialfunktion und natürlicher Logarithmus sind Umkehrfunktionen voneinander.', fact: { k: 'approx', value: pick[3] },
  });
});

const lnDerivative = utemplate('e.lnDeriv', (lv, g) => {
  const c = g.nonzero(lv === 1 ? 1 : -5, lv === 1 ? 5 : 6);
  const p = g.pick([1, 2, 4, 5]);
  const b = lv === 3 ? g.nonzero(-3, 3) : 0;
  const answer = uq(c, p).plus(uq(2 * b * p));
  const wrongs = [uq(c * p), uq(1, p), uq(c, p * p), uq(c), uq(c, p).plus(uq(b * p))];
  const tail = b === 0 ? '' : `${b < 0 ? ' − ' : ' + '}${Math.abs(b) === 1 ? '' : `${Math.abs(b)}`}x²`;
  const head = c === 1 ? 'ln(x)' : c === -1 ? '−ln(x)' : `${UText.signed(c)}·ln(x)`;
  const f = (x: number) => c * Math.log(x) + b * x * x;
  return numeric({
    key: `e.lnDeriv|${c}|${p}|${b}`, prompt: `Berechne f′(${p}) für f(x) = ${head}${tail}.`, answer, wrongs: UCalc.differing(wrongs, answer),
    solution: `(ln x)′ = 1/x, also f′(x) = ${c}/x${b === 0 ? '' : ` + ${2 * b}x`}. Bei x = ${p}: ${answer.text}.`,
    explanation: 'Die Ableitung von ln(x) ist 1/x; ein Faktor davor bleibt erhalten.', fact: { k: 'derivOfFunction', fn: f, at: p },
  });
});

const logName = (base: number, argument: string): string => `log${UText.subscripted(base)}(${argument})`;

const logValue = utemplate('e.log', (lv, g) => {
  const base = g.pick(lv === 1 ? [2, 3, 10] : [2, 3, 5, 10]);
  const n = lv === 1 ? g.int(1, 4) : g.int(2, 5);
  let argument = 1;
  for (let i = 0; i < n; i++) argument *= base;
  if (argument > 100000) return null;
  const answer = uq(n);
  const wrongs = UCalc.differing([uq(Math.trunc(argument / base)), uq(argument), uq(argument, base), uq(n + 1), uq(n - 1)], answer);
  return numeric({
    key: `e.log|${base}|${n}`, prompt: `Berechne ${logName(base, `${argument}`)}.`, answer, wrongs,
    solution: `${base}^${n} = ${argument}, also ${logName(base, `${argument}`)} = ${n}.`,
    explanation: 'log_b(x) ist der Exponent, mit dem du b potenzieren musst, um x zu erhalten.', fact: { k: 'approx', value: Math.log(argument) / Math.log(base) },
  });
});

const lawChoice = utemplate('e.lawChoice', (_lv, g) => {
  const which = g.int(0, 2);
  const base = g.pick([0, 2, 3, 5, 10]);
  const name = base === 0 ? 'ln' : `log${UText.subscripted(base)}`;
  const L = (x: number) => (base === 0 ? Math.log(x) : Math.log(x) / Math.log(base));
  let correct: string;
  let wrong: string[];
  let c: (a: number, b: number) => [number, number];
  let w: Array<(a: number, b: number) => [number, number]>;
  let rule: string;
  let subject: string;
  switch (which) {
    case 0:
      subject = `${name}(a·b)`;
      correct = `Summe: ${name}(a) + ${name}(b)`;
      wrong = [`Produkt: ${name}(a) · ${name}(b)`, `Logarithmus der Summe: ${name}(a + b)`, `Summe: ${name}(a) + b`];
      c = (a, b) => [L(a * b), L(a) + L(b)];
      w = [(a, b) => [L(a * b), L(a) * L(b)], (a, b) => [L(a * b), L(a + b)], (a, b) => [L(a * b), L(a) + b]];
      rule = 'Ein Produkt im Logarithmus wird zur Summe der Logarithmen.';
      break;
    case 1:
      subject = `${name}(a/b)`;
      correct = `Differenz: ${name}(a) − ${name}(b)`;
      wrong = [`Quotient: ${name}(a) / ${name}(b)`, `Logarithmus der Differenz: ${name}(a − b)`, `Summe: ${name}(a) + ${name}(b)`];
      c = (a, b) => [L(a / b), L(a) - L(b)];
      w = [(a, b) => [L(a / b), L(a) / L(b)], (a, b) => [L(a / b), L(a - b)], (a, b) => [L(a / b), L(a) + L(b)]];
      rule = 'Ein Quotient im Logarithmus wird zur Differenz der Logarithmen.';
      break;
    default:
      subject = `${name}(aⁿ)`;
      correct = `Faktor vor dem Logarithmus: n·${name}(a)`;
      wrong = [`Potenz des Logarithmus: (${name} a)ⁿ`, `Summe: ${name}(a) + n`, `Faktor im Argument: ${name}(n·a)`];
      c = (a) => [L(a ** 3), 3 * L(a)];
      w = [(a) => [L(a ** 3), L(a) ** 3], (a) => [L(a ** 3), L(a) + 3], (a) => [L(a ** 3), L(3 * a)]];
      rule = 'Ein Exponent im Argument wird zum Faktor vor dem Logarithmus.';
  }
  return choiceProblem({
    key: `e.lawChoice|${which}|${base}`, prompt: `Wie lässt sich ${subject} umformen? Es gilt a, b > 0 und n ≥ 1.`, correct, wrong,
    solution: `${rule} Richtig ist: ${correct}`, explanation: 'Die Logarithmusgesetze verwandeln Rechenarten eine Stufe niedriger: Produkt zu Summe, Quotient zu Differenz, Potenz zu Produkt.',
    fact: { k: 'law', correct: c, wrong: w },
  });
});

const lawCalculation = utemplate('e.laws', (lv, g) => {
  const base = g.pick([2, 3, 5]);
  const m = g.int(1, 4);
  const n = g.int(1, 3);
  const power = (e: number): number => base ** e;
  const variant = lv === 2 ? g.int(0, 1) : g.int(0, 3);
  let text: string;
  let answer: number;
  let wrongs: number[];
  let how: string;
  switch (variant) {
    case 0:
      text = `${logName(base, `${power(m)}`)} + ${logName(base, `${power(n)}`)}`;
      answer = m + n;
      wrongs = [m * n, m - n, power(m) + power(n)];
      how = `${m} + ${n} = ${m + n}; oder zusammen: ${logName(base, `${power(m + n)}`)}.`;
      break;
    case 1:
      text = `${logName(base, `${power(m + n)}`)} − ${logName(base, `${power(n)}`)}`;
      answer = m;
      wrongs = [m + 2 * n, m * n, power(m)];
      how = `${m + n} − ${n} = ${m}.`;
      break;
    case 2:
      text = `${n + 1}·${logName(base, `${power(m)}`)}`;
      answer = (n + 1) * m;
      wrongs = [m + n + 1, power(m * (n + 1)), m];
      how = `${n + 1}·${m} = ${(n + 1) * m}.`;
      break;
    default:
      text = logName(base, `${power(m)}·${power(n)}`);
      answer = m + n;
      wrongs = [m * n, power(m + n), power(m) * power(n)];
      how = `Produkt im Argument: ${m} + ${n} = ${m + n}.`;
  }
  return numeric({
    key: `e.laws|${text}`, prompt: `Berechne ${text}.`, answer: uq(answer), wrongs: UCalc.differing(wrongs.map((x) => uq(x)), uq(answer)),
    solution: how, explanation: 'Wende die Logarithmusgesetze an oder berechne jeden Logarithmus einzeln als Exponent.', fact: { k: 'approx', value: answer },
  });
});

const solveEquation = utemplate('e.solve', (lv, g) => {
  const bases: [string, number][] = lv === 1 ? [['2', 2], ['3', 3], ['10', 10]] : [['e', Math.E], ['2', 2], ['3', 3], ['5', 5], ['10', 10]];
  const [name, base] = g.pick(bases);
  const k = lv === 1 ? 1 : g.int(1, 3);
  const c = lv === 1 ? 0 : g.int(-2, 2);
  const x0 = g.int(0, 4);
  const m = k * x0 + c;
  if (name !== 'e' && m < 0) return null;
  if (name !== 'e' && m > 6) return null;
  const rhs = name === 'e' ? (m === 0 ? '1' : `e${UText.superscript(m)}`) : `${Math.trunc(base ** m)}`;
  const exponent = (k === 1 ? 'x' : `${k}x`) + (c === 0 ? '' : `${c < 0 ? ' − ' : ' + '}${Math.abs(c)}`);
  const answer = uq(x0);
  const wrongs = [uq(m, k), uq(m + c, k), uq(m - c), uq(m), uq(x0 + 1)];
  return numeric({
    key: `e.solve|${name}|${k}|${c}|${x0}`, prompt: `Löse ${name}^(${exponent}) = ${rhs}.`, answer, wrongs: UCalc.differing(wrongs, answer),
    solution: `Beide Seiten sind Potenzen von ${name}: ${exponent} = ${m}. Daraus x = ${x0}.`, explanation: 'Schreibe beide Seiten als Potenz derselben Basis und vergleiche die Exponenten.',
    fact: { k: 'powerEquation', base, kk: uq(k), c: uq(c), rhs: base ** m },
  });
});

const lnSolve = utemplate('e.lnSolve', (lv, g) => {
  const a = g.pick([2, 3, 5, 6, 7, 10, 12, 20]);
  const k = lv === 1 ? 1 : g.int(2, 5);
  const correct = k === 1 ? `x = ln(${a})` : `x = ln(${a})/${k}`;
  const wrong = k === 1 ? [`x = e^${a}`, `x = ${a}/e`, `x = log₁₀(${a})`, `x = ${a} − 1`] : [`x = ${k}·ln(${a})`, `x = ln(${a}/${k})`, `x = ln(${a}) − ${k}`, `x = e^(${a}/${k})`];
  const equation = k === 1 ? `e^x = ${a}` : `e^(${k}x) = ${a}`;
  return choiceProblem({
    key: `e.lnSolve|${a}|${k}`, prompt: `Welche Lösung hat ${equation}?`, correct, wrong,
    solution: `Logarithmieren mit ln: ${k === 1 ? 'x' : `${k}x`} = ln(${a})${k === 1 ? '' : `, dann durch ${k} teilen`}. Ergebnis: ${correct}.`,
    explanation: 'ln ist die Umkehrfunktion von e^x; bei e^(kx) = a wird zuerst ln(a) gebildet und dann durch k geteilt.',
    fact: { k: 'lnSolve', a, kk: k },
  });
});

export const unit04: UTemplate[] = [derivative, antiderivative, valueAtZero, inverse, lnDerivative, logValue, lawChoice, lawCalculation, solveEquation, lnSolve];
