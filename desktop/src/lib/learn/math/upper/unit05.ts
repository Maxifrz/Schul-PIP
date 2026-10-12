// Unit 5: trigonometry (radians, exact values, derivative of sin and cos, period and amplitude).
// A port of MathUpperUnit05.swift.

import {
  insert,
  q,
  uProblem,
  UProblems,
  UQ,
  UText,
  uTemplate,
  type UAmpKind,
  type UGen,
  type UPairItems,
  type UFact,
  type UProblem,
} from './core';
import { UCalc } from './support';

// MARK: Exact values

export type Magnitude = 'zero' | 'half' | 'root2over2' | 'root3over2' | 'one' | 'root3' | 'root3over3';

export function magnitudeText(m: Magnitude): string {
  switch (m) {
    case 'zero':
      return '0';
    case 'half':
      return '1/2';
    case 'root2over2':
      return '√2/2';
    case 'root3over2':
      return '√3/2';
    case 'one':
      return '1';
    case 'root3':
      return '√3';
    case 'root3over3':
      return '√3/3';
  }
}

export function magnitudeRational(m: Magnitude): UQ | null {
  switch (m) {
    case 'zero':
      return UQ.zero;
    case 'half':
      return q(1, 2);
    case 'one':
      return UQ.one;
    default:
      return null;
  }
}

export interface Exact {
  negative: boolean;
  magnitude: Magnitude;
  text: string;
  rational: UQ | null;
}

function makeExact(negative: boolean, magnitude: Magnitude): Exact {
  const rational = magnitudeRational(magnitude);
  return {
    negative,
    magnitude,
    text: (negative && magnitude !== 'zero' ? '−' : '') + magnitudeText(magnitude),
    rational: rational ? (negative ? rational.neg() : rational) : null,
  };
}

const sinMag = new Map<number, Magnitude>([[0, 'zero'], [30, 'half'], [45, 'root2over2'], [60, 'root3over2'], [90, 'one']]);
const cosMag = new Map<number, Magnitude>([[0, 'one'], [30, 'root3over2'], [45, 'root2over2'], [60, 'half'], [90, 'zero']]);
const tanMag = new Map<number, Magnitude>([[0, 'zero'], [30, 'root3over3'], [45, 'one'], [60, 'root3']]);

/** The exact value for angles whose reference angle is 0, 30, 45, 60 or 90 degrees; null where it is undefined. */
export function exact(fn: string, degrees: number): Exact | null {
  const d = ((degrees % 360) + 360) % 360;
  let reference: number;
  let quadrant: number;
  if (d <= 90) {
    reference = d;
    quadrant = 1;
  } else if (d <= 180) {
    reference = 180 - d;
    quadrant = 2;
  } else if (d <= 270) {
    reference = d - 180;
    quadrant = 3;
  } else {
    reference = 360 - d;
    quadrant = 4;
  }
  const sinNegative = quadrant >= 3;
  const cosNegative = quadrant === 2 || quadrant === 3;
  let m: Magnitude | undefined;
  switch (fn) {
    case 'sin':
      m = sinMag.get(reference);
      return m === undefined ? null : makeExact(sinNegative, m);
    case 'cos':
      m = cosMag.get(reference);
      return m === undefined ? null : makeExact(cosNegative, m);
    default:
      m = tanMag.get(reference);
      return m === undefined ? null : makeExact(sinNegative !== cosNegative, m);
  }
}

export function angleText(degrees: number, radians: boolean): string {
  return radians ? UText.piMultiple(q(degrees, 180)) : `${UText.signed(degrees)}°`;
}

/** A question whose right answer is a multiple of pi: typed as the factor, chosen as "π/3". */
function piProblem(o: {
  key: string;
  prompt: string;
  answer: UQ;
  wrongs: readonly UQ[];
  solution: string;
  explanation: string;
  fact: UFact;
}): UProblem | null {
  const correct = UText.piMultiple(o.answer);
  const texts = o.wrongs.filter((w) => !w.equals(o.answer)).map(UText.piMultiple);
  return uProblem({
    key: o.key,
    prompt: o.prompt,
    hint: '(Antworte mit dem Faktor vor π, zum Beispiel π/2 als 0,5.)',
    number: o.answer,
    correct,
    wrong: UProblems.cleaned(texts, correct),
    solution: o.solution,
    explanation: o.explanation,
    fact: o.fact,
  });
}

// MARK: Templates

const degreesToRadians = uTemplate(
  't.rad',
  (lv, g) => {
    const options: number[] =
      lv === 1 ? [180, 90, 60, 30, 45, 360, 270] : lv === 2 ? [120, 135, 150, 210, 225, 240, 300, 315] : [330, 75, 15, 105, 165, 20, 40, 72];
    const d = g.pick(options);
    const answer = q(d, 180);
    const wrongs = [q(d, 360), q(180, d), q(d), q(d, 90), q(d, 270)];
    return piProblem({
      key: `t.rad|${d}`,
      prompt: `Rechne ${d}° ins Bogenmaß um.`,
      answer,
      wrongs,
      solution: `Bogenmaß = Gradmaß · π/180: ${d}·π/180 = ${UText.piMultiple(answer)}.`,
      explanation: '180° entsprechen π; also multiplizierst du das Gradmaß mit π/180.',
      fact: { t: 'degreesToPi', degrees: d },
    });
  },
  (_lv, g: UGen): UPairItems | null => {
    const items: UPairItems = [];
    const used = new Set<number>();
    for (let i = 0; i < 60 && items.length < 4; i++) {
      const d = g.pick([30, 45, 60, 90, 120, 135, 150, 180, 270, 360]);
      if (insert(used, d)) items.push({ front: `${d}°`, back: UText.piMultiple(q(d, 180)) });
    }
    return items.length === 4 ? items : null;
  },
);

const radiansToDegrees = uTemplate('t.deg', (lv, g) => {
  const d = g.pick(lv === 1 ? [180, 90, 60, 45, 30, 360] : lv === 2 ? [120, 135, 150, 270, 225, 300] : [210, 240, 330, 315, 75, 15]);
  const value = q(d, 180);
  const wrongs = [q(d).div(q(2)), q(2 * d), q(d, 360).times(q(180)), q(360 - d)];
  return UProblems.numeric({
    key: `t.deg|${d}`,
    prompt: `Wie viel Grad sind ${UText.piMultiple(value)}?`,
    answer: q(d),
    wrongs: UCalc.differing(wrongs, q(d)),
    solution: `Gradmaß = Bogenmaß · 180°/π: ${UText.piMultiple(value)} entspricht ${d}°.`,
    explanation: 'π entspricht 180°; setze für π also 180° ein.',
    fact: { t: 'approx', value: value.double * 180 },
  });
});

const exactValue = uTemplate('t.exact', (lv, g) => {
  const fn = g.pick(lv === 1 ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);
  const angles: number[] =
    lv === 1 ? [0, 30, 45, 60, 90] : lv === 2 ? [0, 30, 45, 60, 90] : [120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
  const degrees = g.pick(angles);
  const value = exact(fn, degrees);
  if (!value) return null;
  const radians = lv >= 2 && g.chance(0.5);
  const angle = angleText(degrees, radians);
  const candidates: (Exact | null)[] = [];
  for (const other of ['sin', 'cos', 'tan']) if (other !== fn) candidates.push(exact(other, degrees));
  candidates.push(exact(fn, 90 - degrees));
  candidates.push(exact(fn, 180 - degrees));
  candidates.push(exact(fn === 'sin' ? 'cos' : 'sin', 90 - degrees));
  const wrongTexts = candidates.filter((c): c is Exact => c !== null).map((c) => c.text);
  const sol = `${fn}(${angle}) = ${value.text}. Merke die Werte für 0°, 30°, 45°, 60°, 90° und beachte das Vorzeichen im Quadranten.`;
  const expl =
    'Die Tabelle der Winkel 0°, 30°, 45°, 60°, 90° gilt für sin, cos und tan; andere Winkel führst du mit dem Bezugswinkel und dem Vorzeichen des Quadranten darauf zurück.';
  const prompt = `Gib den exakten Wert von ${fn}(${angle}) an.`;
  const key = `t.exact|${fn}|${degrees}|${radians}`;
  if (value.rational) {
    const correct = value.rational.fractionDisplay;
    return uProblem({
      key,
      prompt,
      hint: '(Antworte als Zahl.)',
      number: value.rational,
      correct,
      wrong: UProblems.cleaned(wrongTexts, correct),
      solution: sol,
      explanation: expl,
      fact: { t: 'trigValue', fn, degrees },
    });
  }
  return UProblems.choice({ key, prompt, correct: value.text, wrong: wrongTexts, solution: sol, explanation: expl, fact: { t: 'trigValue', fn, degrees } });
});

const quadrantSign = uTemplate('t.sign', (_lv, g) => {
  const fn = g.pick(['sin', 'cos', 'tan']);
  const degrees = g.pick([120, 135, 150, 210, 225, 240, 300, 315, 330, 180, 270, 90]);
  const value = exact(fn, degrees);
  if (!value) return null;
  const correct = value.magnitude === 'zero' ? 'null' : value.negative ? 'negativ' : 'positiv';
  const angle = angleText(degrees, g.chance(0.5));
  return UProblems.choice({
    key: `t.sign|${fn}|${degrees}`,
    prompt: `Welches Vorzeichen hat ${fn}(${angle})?`,
    correct,
    wrong: ['positiv', 'negativ', 'null'].filter((w) => w !== correct),
    solution: `${fn}(${angle}) = ${value.text}, also ${correct}.`,
    explanation: 'sin ist im 1. und 2. Quadranten positiv, cos im 1. und 4., tan im 1. und 3.; an den Achsen kann der Wert 0 sein.',
    fact: { t: 'trigValue', fn, degrees },
  });
});

const pythagoras = uTemplate('t.pyth', (lv, g) => {
  const triples: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];
  const [a, b, c] = g.pick(lv === 1 ? triples.slice(0, 2) : triples);
  const askTan = lv === 3 && g.chance(0.5);
  const s = q(a, c);
  const answer = askTan ? q(a, b) : q(b, c);
  const wrongs = askTan
    ? [q(b, a), q(a, c), q(b, c), q(c - a, c)]
    : [q(1).minus(s), s.times(s), q(c, b), q(a, b), q(1).minus(s.times(s))];
  return UProblems.numeric({
    key: `t.pyth|${a}|${c}|${askTan}`,
    prompt: `Es gilt sin(x) = ${a}/${c} mit 0° < x < 90°. Wie groß ist ${askTan ? 'tan(x)' : 'cos(x)'}?`,
    answer,
    wrongs: UCalc.differing(wrongs, answer),
    solution:
      `sin²x + cos²x = 1, also cos²x = 1 − ${a * a}/${c * c} = ${b * b}/${c * c} und cos x = ${b}/${c}` +
      (askTan ? `; tan x = sin x / cos x = ${a}/${b}.` : '.'),
    explanation: 'Aus sin²x + cos²x = 1 folgt cos x = √(1 − sin²x); im 1. Quadranten ist cos x positiv.',
    fact: { t: 'cosFromSin', sin: s, askTan },
  });
});

export function trigText(coefficient: number, fn: string, k: UQ): string {
  let argument: string;
  if (k.equals(UQ.one)) argument = 'x';
  else if (k.isInt) argument = `${k.n}x`;
  else argument = `x/${k.d}`;
  const head = coefficient === 1 ? '' : coefficient === -1 ? '−' : coefficient < 0 ? `−${-coefficient}` : `${coefficient}`;
  return `${head}${fn}(${argument})`;
}

const derivative = uTemplate('t.deriv', (lv, g) => {
  const fn = g.pick(['sin', 'cos']);
  const k = lv === 1 ? 1 : g.int(2, 5);
  const a = lv === 1 ? g.int(2, 4) : g.nonzero(-4, 4);
  const factor = fn === 'sin' ? a * k : -a * k;
  const derivFn = fn === 'sin' ? 'cos' : 'sin';
  const correct = trigText(factor, derivFn, q(k));
  const sign = fn === 'sin' ? 1 : -1;
  const wrong = [
    trigText(sign * a, derivFn, q(k)),
    trigText(factor, fn, q(k)),
    trigText(factor, derivFn, q(1)),
    trigText(sign * k, derivFn, q(k)),
  ];
  return UProblems.choice({
    key: `t.deriv|${fn}|${a}|${k}`,
    prompt: `Bilde die Ableitung von f(x) = ${trigText(a, fn, q(k))}.`,
    correct,
    wrong,
    solution: `(sin x)′ = cos x und (cos x)′ = −sin x; die innere Ableitung ${k} kommt als Faktor dazu. Ergebnis: ${correct}.`,
    explanation: 'Bei sin(kx) und cos(kx) kommt k als Faktor vor die Ableitung; die Ableitung von cos hat ein Minuszeichen.',
    fact: { t: 'trigDeriv', fn, a, k },
  });
});

const derivativeAt = uTemplate('t.derivAt', (lv, g) => {
  const fn = g.pick(['sin', 'cos']);
  const k = lv === 1 ? 1 : g.int(2, 4);
  const a = lv === 1 ? g.int(1, 3) : g.nonzero(-4, 4);
  const phase = g.pick([0, 1, 2, 3, 4]); // k x0 = phase * pi / 2
  const x0 = q(phase, 2 * k);
  const f = (x: number): number => (fn === 'sin' ? a * Math.sin(k * x) : a * Math.cos(k * x));
  const cosPhase = [1, 0, -1, 0, 1][phase];
  const sinPhase = [0, 1, 0, -1, 0][phase];
  const answer = q(fn === 'sin' ? a * k * cosPhase : -a * k * sinPhase);
  const atFunction = q(fn === 'sin' ? a * sinPhase : a * cosPhase);
  const wrongs = [
    q(fn === 'sin' ? a * cosPhase : -a * sinPhase),
    atFunction,
    q(fn === 'sin' ? a * k * sinPhase : a * k * cosPhase),
    q(fn === 'sin' ? -a * k * sinPhase : -a * k * cosPhase),
  ];
  const xText = x0.isZero ? '0' : UText.piMultiple(x0);
  return UProblems.numeric({
    key: `t.derivAt|${fn}|${a}|${k}|${phase}`,
    prompt: `Berechne f′(${xText}) für f(x) = ${trigText(a, fn, q(k))}.`,
    answer,
    wrongs: UCalc.differing(wrongs, answer),
    solution: `f′(x) = ${trigText(fn === 'sin' ? a * k : -a * k, fn === 'sin' ? 'cos' : 'sin', q(k))}. Bei x = ${xText} ist ${k}·x = ${UText.piMultiple(q(phase, 2))}; damit f′ = ${answer.text}.`,
    explanation: 'Erst mit Kettenregel ableiten, dann einsetzen; sin und cos haben bei Vielfachen von π/2 die Werte 0, 1 oder −1.',
    fact: { t: 'derivOfFunction', f, at: x0.double * Math.PI },
  });
});

const solveInQuadrant = uTemplate('t.solve', (_lv, g) => {
  const table: [string, UQ, UQ][] = [
    ['sin', UQ.zero, UQ.zero],
    ['sin', q(1, 2), q(1, 6)],
    ['sin', UQ.one, q(1, 2)],
    ['cos', UQ.one, UQ.zero],
    ['cos', q(1, 2), q(1, 3)],
    ['cos', UQ.zero, q(1, 2)],
  ];
  const [fn, value, x] = g.pick(table);
  const standard = [UQ.zero, q(1, 6), q(1, 4), q(1, 3), q(1, 2)];
  const wrongs = [...standard, q(1, 2).minus(x), q(2, 3)];
  return piProblem({
    key: `t.solve|${fn}|${value.fraction}`,
    prompt: `Löse ${fn}(x) = ${value.fraction} für 0 ≤ x ≤ π/2.`,
    answer: x,
    wrongs,
    solution: `${fn}(${UText.piMultiple(x)}) = ${value.fraction} laut Wertetabelle; im Intervall [0; π/2] gibt es genau eine Lösung: x = ${UText.piMultiple(x)}.`,
    explanation: 'Lies die Wertetabelle von sin und cos rückwärts; im ersten Quadranten ist die Lösung eindeutig.',
    fact: { t: 'trigSolve', fn, value },
  });
});

function kText(k: UQ): string {
  if (k.equals(UQ.one)) return 'x';
  return k.isInt ? `${k.n}x` : `x/${k.d}`;
}

const period = uTemplate('t.period', (lv, g) => {
  const fn = g.pick(['sin', 'cos']);
  const k = g.pick(lv === 1 ? [q(1), q(2)] : [q(2), q(3), q(4), q(1, 2), q(1, 3), q(6)]);
  const d = lv === 3 ? g.nonzero(-3, 3) : 0;
  const a = lv === 1 ? 1 : g.nonzero(-3, 3);
  const answer = q(2).div(k);
  const wrongs = [q(2).times(k), q(1).div(k), k, q(2), q(1).times(k)];
  const text =
    (a === 1 ? '' : a === -1 ? '−' : `${UText.signed(a)}·`) +
    `${fn}(${kText(k)})` +
    (d === 0 ? '' : (d < 0 ? ' − ' : ' + ') + `${Math.abs(d)}`);
  return piProblem({
    key: `t.period|${fn}|${a}|${k.fraction}|${d}`,
    prompt: `Welche Periode hat f(x) = ${text}?`,
    answer,
    wrongs,
    solution: `Die Periode von ${fn}(kx) ist 2π/k. Hier k = ${k.fraction}: ${UText.piMultiple(answer)}. Faktor und Verschiebung ändern die Periode nicht.`,
    explanation: 'Der Faktor k vor x staucht den Graphen: die Periode ist 2π geteilt durch k.',
    fact: { t: 'period', fn, k },
  });
});

const amplitude = uTemplate('t.amp', (lv, g) => {
  const fn = g.pick(['sin', 'cos']);
  const a = lv === 1 ? g.nonzero(1, 4) : g.nonzero(-5, 5);
  const k = lv === 1 ? 1 : g.int(1, 4);
  const d = lv === 1 ? 0 : g.int(-3, 4);
  const kinds: UAmpKind[] =
    lv === 1 ? ['amplitude', 'maximum'] : lv === 2 ? ['amplitude', 'maximum', 'minimum'] : ['maximum', 'minimum', 'midline'];
  const kind = g.pick(kinds);
  const amp = Math.abs(a);
  let answer: number;
  let question: string;
  let wrongs: number[];
  switch (kind) {
    case 'amplitude':
      answer = amp;
      question = 'Wie groß ist die Amplitude von';
      wrongs = [a * k, amp + d, d, amp * 2];
      break;
    case 'maximum':
      answer = amp + d;
      question = 'Welchen größten Funktionswert hat';
      wrongs = [amp, a + d, d - amp, amp * k + d];
      break;
    case 'minimum':
      answer = d - amp;
      question = 'Welchen kleinsten Funktionswert hat';
      wrongs = [-amp, d + amp, d, a + d];
      break;
    default:
      answer = d;
      question = 'Bei welchem y-Wert liegt die Mittellinie von';
      wrongs = [amp, amp + d, d - amp, a];
  }
  const text =
    (a === 1 ? '' : a === -1 ? '−' : `${UText.signed(a)}·`) +
    `${fn}(${k === 1 ? 'x' : `${k}x`})` +
    (d === 0 ? '' : (d < 0 ? ' − ' : ' + ') + `${Math.abs(d)}`);
  return UProblems.numeric({
    key: `t.amp|${fn}|${a}|${k}|${d}|${kind}`,
    prompt: `${question} f(x) = ${text}?`,
    answer: q(answer),
    wrongs: UCalc.differing(wrongs.map((w) => q(w)), q(answer)),
    solution: `Bei f(x) = a·${fn}(kx) + d ist die Amplitude |a| = ${amp}, die Mittellinie y = ${d}, das Maximum ${amp + d}, das Minimum ${d - amp}. Gesucht: ${answer}.`,
    explanation: 'Der Faktor a streckt die Schwingung (Amplitude |a|), die Zahl d verschiebt sie nach oben oder unten.',
    fact: { t: 'amplitude', a: q(a), k: q(k), d: q(d), what: kind },
  });
});

const zeros = uTemplate('t.zeros', (lv, g) => {
  const fn = g.pick(['sin', 'cos']);
  const k = lv <= 2 ? g.int(1, 3) : g.int(2, 4);
  const answer = fn === 'sin' ? 2 * k + 1 : 2 * k;
  const wrongs = [2 * k, 2 * k + 2, k, 4 * k, 2 * k - 1, k + 1];
  return UProblems.numeric({
    key: `t.zeros|${fn}|${k}`,
    prompt: `Wie viele Nullstellen hat f(x) = ${fn}(${k === 1 ? 'x' : `${k}x`}) im Intervall [0; 2π]? Die Randpunkte zählen mit.`,
    answer: q(answer),
    wrongs: UCalc.differing(wrongs.map((w) => q(w)), q(answer)),
    solution:
      fn === 'sin'
        ? `sin(kx) = 0 für kx = 0, π, 2π, …; bis 2π sind das ${2 * k + 1} Nullstellen (x = j·π/${k} für j = 0 bis ${2 * k}).`
        : `cos(kx) = 0 für kx = π/2, 3π/2, …; bis 2π sind das ${2 * k} Nullstellen.`,
    explanation: 'Skizziere die Schwingung: Im Intervall [0; 2π] hat sin(kx) genau k Perioden.',
    fact: { t: 'zerosIn', fn, k },
  });
});

const integral = uTemplate('t.int', (_lv, g) => {
  const a = g.int(1, 4);
  const variants = ['sinHalf', 'cosQuarter', 'sinFull'] as const;
  const variant = g.pick(variants);
  const k = g.int(1, 3);
  let f: (x: number) => number;
  let to: number;
  let text: string;
  let answer: UQ;
  let bound: string;
  switch (variant) {
    case 'sinHalf':
      f = (x) => a * Math.sin(k * x);
      to = Math.PI / k;
      answer = q(2 * a, k);
      bound = UText.piMultiple(q(1, k));
      text = trigText(a, 'sin', q(k));
      break;
    case 'cosQuarter':
      f = (x) => a * Math.cos(k * x);
      to = Math.PI / (2 * k);
      answer = q(a, k);
      bound = UText.piMultiple(q(1, 2 * k));
      text = trigText(a, 'cos', q(k));
      break;
    default:
      f = (x) => a * Math.cos(k * x);
      to = Math.PI;
      answer = UQ.zero;
      bound = 'π';
      text = trigText(a, 'cos', q(k));
  }
  const wrongs = [q(a * k), q(2 * a), q(a), q(a, k * k), q(2 * a * k), q(a, 2 * k)];
  return UProblems.numeric({
    key: `t.int|${variant}|${a}|${k}`,
    prompt: `Berechne das Integral von ${text} dx von x = 0 bis x = ${bound}.`,
    answer,
    wrongs: UCalc.differing(wrongs, answer),
    solution: `Stammfunktion von ${text} ist ${variant === 'sinHalf' ? `−${a}/${k}·cos` : `${a}/${k}·sin`}(${k === 1 ? 'x' : `${k}x`}). Obere Grenze minus untere Grenze ergibt ${answer.text}.`,
    explanation: 'Beim Aufleiten von sin(kx) und cos(kx) teilst du durch k; ∫ sin x dx = −cos x + C und ∫ cos x dx = sin x + C.',
    fact: { t: 'integralOfFunction', f, from: 0, to },
  });
});

export const MathUpperUnit05 = {
  templates: [
    degreesToRadians,
    radiansToDegrees,
    exactValue,
    quadrantSign,
    pythagoras,
    derivative,
    derivativeAt,
    solveInQuadrant,
    period,
    amplitude,
    zeros,
    integral,
  ],
  exact,
};
