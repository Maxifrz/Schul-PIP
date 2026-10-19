import { UCalc } from './calc';
import { UExtremum, UGen, UPoly, USymmetry, UTemplate, UText, UQ, choiceProblem, numeric, uq, utemplate } from './core';

/**
 * Unit 2: curve sketching (roots, extrema, inflection points, monotonicity, kind of extremum, symmetry).
 * Functions are built backwards from chosen roots and extrema, so every answer is a whole number or a half.
 */
interface Cubic {
  f: UPoly;
  x1: number;
  x2: number;
  k: number;
  maxX: number;
  minX: number;
}

/** f' = k (x - x1)(x - x2) with x1 < x2; k = ±3 or ±6, so f has whole-number coefficients. */
function cubic(g: UGen, simple = false): Cubic {
  const make = (f: UPoly, x1: number, x2: number, k: number): Cubic => ({ f, x1, x2, k, maxX: k > 0 ? x1 : x2, minX: k > 0 ? x2 : x1 });
  for (let i = 0; i < 300; i++) {
    const k = g.pick(simple ? [6, 3] : [3, 6, -3, -6]);
    const x1 = g.int(-3, 2);
    const x2 = x1 + g.int(1, 4);
    if (Math.abs(k) === 3 && (x1 + x2) % 2 !== 0) continue;
    const derivative = UPoly.fromRoots(uq(k), [uq(x1), uq(x2)]);
    const f = derivative.integral.plus(new UPoly([uq(g.int(-6, 6))]));
    if (f.c.every((x) => x.isInt)) return make(f, x1, x2, k);
  }
  return make(UPoly.ofInts([0, 0, -3, 2]), 0, 1, 6);
}

const yIntercept = utemplate('k.yaxis', (lv, g) => {
  const f = lv === 1 ? g.poly(2, 3, [1, 6]) : g.poly(3, 4, [1, 7]);
  const c = f.coefficient(0);
  const b = f.coefficient(1);
  if (c.isZero) return null;
  return numeric({
    key: `k.yaxis|${f.text}`, prompt: `Bei welchem y-Wert schneidet der Graph von ${UCalc.fx(f)} die y-Achse?`, answer: c,
    wrongs: UCalc.differing([b, f.eval(UQ.one), f.eval(uq(-1)), f.derivative.eval(UQ.zero)], c),
    solution: `Der Schnittpunkt mit der y-Achse liegt bei x = 0: f(0) = ${c.text}.`, explanation: 'Auf der y-Achse ist x = 0; nur das absolute Glied bleibt übrig.',
    fact: { k: 'valueAt', f, x: UQ.zero },
  });
});

const root = utemplate('k.root', (lv, g) => {
  let roots: number[];
  let lead = 1;
  switch (lv) {
    case 1: {
      const r1 = g.int(-5, 3);
      roots = [r1, r1 + g.int(1, 5)];
      break;
    }
    case 2: {
      const r1 = g.int(-5, 3);
      roots = [r1, r1 + g.int(1, 5)];
      lead = g.pick([2, 3, -1, -2]);
      break;
    }
    default: {
      const set = new Set<number>([0]);
      while (set.size < 3) set.add(g.int(-4, 4));
      roots = [...set].sort((a, b) => a - b);
      lead = g.pick([1, 1, 2, -1]);
    }
  }
  const f = UPoly.fromRoots(uq(lead), roots.map((r) => uq(r)));
  const largest = g.chance(0.5);
  const answer = uq(largest ? roots[roots.length - 1] : roots[0]);
  const sum = uq(roots.reduce((a, b) => a + b, 0));
  const product = uq(roots.reduce((a, b) => a * b, 1));
  const others = roots.filter((r) => !uq(r).equals(answer)).map((r) => uq(r));
  const wrongs = UCalc.differing([...others, sum, product, f.coefficient(0)], answer);
  const how = lv === 3 ? 'Klammere x aus und löse den Rest. ' : 'Löse f(x) = 0. ';
  return numeric({
    key: `k.root|${f.text}|${largest}`, prompt: `Bestimme die ${largest ? 'größte' : 'kleinste'} Nullstelle von ${UCalc.fx(f)}.`, answer, wrongs,
    solution: `${how}Die Nullstellen sind ${roots.join(', ')}; die ${largest ? 'größte' : 'kleinste'} ist ${answer.text}.`,
    explanation: 'Eine Nullstelle ist ein x mit f(x) = 0; bei einem Produkt reicht es, wenn ein Faktor null ist.',
    fact: { k: 'root', f, largest },
  });
});

const rootTest = utemplate('k.rootTest', (lv, g) => {
  const r1 = g.int(-5, 3);
  const roots = lv === 1 ? [r1, r1 + g.int(1, 4)] : [r1, r1 + g.int(1, 4), g.int(-5, 5)];
  const f = UPoly.fromRoots(UQ.one, roots.map((r) => uq(r)));
  const r = uq(roots[0]);
  const candidates = [r.neg, r.plus(UQ.one), r.minus(UQ.one), uq(roots[0] + roots[1]), f.coefficient(0), r.times(uq(2))];
  const wrongs = candidates.filter((x) => !f.eval(x).isZero);
  return numeric({
    key: `k.rootTest|${f.text}`, prompt: `Welche Zahl ist eine Nullstelle von ${UCalc.fx(f)}?`, answer: r, wrongs,
    solution: `Setze ein: f(${r.text}) = 0. Bei den anderen Zahlen kommt nicht 0 heraus.`, explanation: 'Eine Zahl ist genau dann Nullstelle, wenn beim Einsetzen 0 herauskommt.',
    fact: { k: 'root', f, largest: false }, typed: false,
  });
});

const symmetryTemplate = utemplate('k.sym', (lv, g) => {
  const want = g.pick<USymmetry>(['yAxis', 'origin', 'neither']);
  let exponents: number[];
  switch (want) {
    case 'yAxis':
      exponents = lv === 1 ? [2, 0] : [4, 2, 0];
      if (lv === 3) exponents = [4, 2];
      break;
    case 'origin':
      exponents = lv === 1 ? [3, 1] : [5, 3, 1];
      if (lv === 3) exponents = [3, 1];
      break;
    default:
      exponents = lv === 1 ? [2, 1] : [3, 2, 0];
      if (lv === 3) exponents = [4, 1];
  }
  const f = UPoly.ofTerms(exponents.map((e): [number, UQ] => [e, uq(g.nonzero(-5, 5))]));
  const correct = want === 'yAxis' ? 'achsensymmetrisch zur y-Achse' : want === 'origin' ? 'punktsymmetrisch zum Ursprung' : 'weder noch';
  const all = ['achsensymmetrisch zur y-Achse', 'punktsymmetrisch zum Ursprung', 'weder noch'];
  return choiceProblem({
    key: `k.sym|${f.text}`, prompt: `Wie verhält sich der Graph von ${UCalc.fx(f)}?`, correct, wrong: all.filter((a) => a !== correct),
    solution: `Prüfe f(−x): Nur gerade Exponenten (auch das absolute Glied) geben f(−x) = f(x); nur ungerade Exponenten geben f(−x) = −f(x). Hier: ${correct}.`,
    explanation: 'Gerade Exponenten ergeben die Symmetrie zur y-Achse, ungerade die zum Ursprung; bei einer Mischung gibt es keine.',
    fact: { k: 'symmetry', f, kind: want },
  });
});

const extremumX = utemplate('k.extX', (lv, g) => {
  if (lv === 1) {
    const a = g.pick([1, 2, -1, -2]);
    const h = g.int(-4, 4);
    const top = g.int(-5, 5);
    const f = UPoly.ofInts([a * h * h + top, -2 * a * h, a]);
    const isMax = a < 0;
    const answer = uq(h);
    const wrongs = UCalc.differing([uq(2 * h), uq(top), f.coefficient(0), f.coefficient(1)], answer);
    return numeric({
      key: `k.extX|${f.text}`, prompt: `Bei welchem x liegt der ${isMax ? 'Hochpunkt' : 'Tiefpunkt'} von ${UCalc.fx(f)}?`, answer, wrongs,
      solution: `f′(x) = ${f.derivative.text} = 0 ergibt x = ${h}. f″ = ${2 * a} ${isMax ? '< 0: Hochpunkt' : '> 0: Tiefpunkt'}.`,
      explanation: 'Notwendig ist f′(x) = 0; das Vorzeichen von f″ zeigt, ob es ein Hoch- oder Tiefpunkt ist.',
      fact: { k: 'extremumX', f, max: isMax },
    });
  }
  const c = cubic(g);
  const isMax = g.chance(0.5);
  const answer = uq(isMax ? c.maxX : c.minX);
  const other = uq(isMax ? c.minX : c.maxX);
  const wrongs = UCalc.differing([other, uq(c.x1 + c.x2, 2), c.f.eval(answer), c.f.coefficient(0)], answer);
  return numeric({
    key: `k.extX|${c.f.text}|${isMax}`, prompt: `Bei welchem x liegt der ${isMax ? 'Hochpunkt' : 'Tiefpunkt'} von ${UCalc.fx(c.f)}?`, answer, wrongs,
    solution: `f′(x) = ${c.f.derivative.text} = 0 ergibt x = ${c.x1} oder x = ${c.x2}. Mit f″(x) = ${c.f.derivative.derivative.text} prüfst du: Der ${isMax ? 'Hochpunkt' : 'Tiefpunkt'} liegt bei x = ${answer.text}.`,
    explanation: 'Bei f″(x) < 0 liegt ein Hochpunkt vor, bei f″(x) > 0 ein Tiefpunkt.', fact: { k: 'extremumX', f: c.f, max: isMax },
  });
});

const extremumY = utemplate('k.extY', (lv, g) => {
  const c = cubic(g, lv === 1);
  const isMax = g.chance(0.5);
  const x = uq(isMax ? c.maxX : c.minX);
  const answer = c.f.eval(x);
  const otherValue = c.f.eval(uq(isMax ? c.minX : c.maxX));
  const wrongs = UCalc.differing([x, otherValue, c.f.coefficient(0), c.f.derivative.eval(x), c.f.eval(uq(c.x1 + c.x2, 2))], answer);
  return numeric({
    key: `k.extY|${c.f.text}|${isMax}`, prompt: `Welchen y-Wert hat der ${isMax ? 'Hochpunkt' : 'Tiefpunkt'} von ${UCalc.fx(c.f)}?`, answer, wrongs,
    solution: `Die Extremstelle ist x = ${x.text} (aus f′(x) = 0 und dem Vorzeichen von f″). Einsetzen in f: f(${x.text}) = ${answer.text}.`,
    explanation: 'Die Extremstelle setzt du in f ein, nicht in f′: f′ ist dort null.', fact: { k: 'extremumY', f: c.f, max: isMax },
  });
});

const kind = utemplate('k.kind', (lv, g) => {
  const names: Record<UExtremum, string> = { maximum: 'Hochpunkt', minimum: 'Tiefpunkt', saddle: 'Sattelpunkt' };
  let f: UPoly;
  let x: number;
  let want: UExtremum;
  if (lv === 3 && g.chance(0.5)) {
    const s = g.int(-2, 3);
    f = UPoly.fromRoots(UQ.one, [uq(s), uq(s), uq(s)]).plus(new UPoly([uq(g.int(-4, 4))]));
    x = s;
    want = 'saddle';
  } else {
    const c = cubic(g);
    const atMax = g.chance(0.5);
    f = c.f;
    x = atMax ? c.maxX : c.minX;
    want = atMax ? 'maximum' : 'minimum';
  }
  const second = f.derivative.derivative.eval(uq(x));
  let sol: string;
  switch (want) {
    case 'saddle': sol = `f′(x) = ${f.derivative.text} hat bei x = ${x} eine doppelte Nullstelle, f′ wechselt dort das Vorzeichen nicht (f″(${x}) = 0). Es ist ein Sattelpunkt.`; break;
    case 'maximum': sol = `f′(${x}) = 0 und f″(${x}) = ${second.text} < 0: Hochpunkt.`; break;
    default: sol = `f′(${x}) = 0 und f″(${x}) = ${second.text} > 0: Tiefpunkt.`;
  }
  return choiceProblem({
    key: `k.kind|${f.text}|${x}`, prompt: `Der Graph von ${UCalc.fx(f)} hat bei x = ${UText.signed(x)} eine waagerechte Tangente. Welcher Punkt liegt dort vor?`,
    correct: names[want], wrong: (Object.keys(names) as UExtremum[]).filter((e) => e !== want).map((e) => names[e]).sort(), solution: sol,
    explanation: 'f″ < 0 gibt einen Hochpunkt, f″ > 0 einen Tiefpunkt; bei f″ = 0 und ohne Vorzeichenwechsel von f′ ist es ein Sattelpunkt.',
    fact: { k: 'kindAt', f, x: uq(x), kind: want },
  });
});

const inflection = utemplate('k.inflect', (lv, g) => {
  const c = cubic(g, lv === 1);
  const answer = uq(c.x1 + c.x2, 2);
  const a = c.f.coefficient(3);
  const b = c.f.coefficient(2);
  const wrongs = UCalc.differing([uq(c.x1), uq(c.x2), c.f.eval(answer), b.neg.div(a), b.neg.div(a.times(uq(6)))], answer);
  return numeric({
    key: `k.inflect|${c.f.text}`, prompt: `An welcher Stelle hat der Graph von ${UCalc.fx(c.f)} seinen Wendepunkt?`, answer, wrongs,
    solution: `f″(x) = ${c.f.derivative.derivative.text} = 0 ergibt x = ${answer.text}; f‴ ≠ 0, also liegt dort ein Wendepunkt.`,
    explanation: 'Eine Wendestelle erfüllt f″(x) = 0 und f‴(x) ≠ 0.', fact: { k: 'inflectionX', f: c.f },
  });
});

const monotone = utemplate('k.mono', (_lv, g) => {
  const c = cubic(g);
  const betweenRising = c.k < 0;
  const askRising = g.chance(0.5);
  const between = `${UText.signed(c.x1)} < x < ${UText.signed(c.x2)}`;
  const outside = `x < ${UText.signed(c.x1)} oder x > ${UText.signed(c.x2)}`;
  const betweenIsAnswer = askRising === betweenRising;
  const correct = betweenIsAnswer ? between : outside;
  const wrong = [betweenIsAnswer ? outside : between, `x < ${UText.signed(c.x2)}`, `x > ${UText.signed(c.x1)}`, `x < ${UText.signed(c.x1)}`];
  return choiceProblem({
    key: `k.mono|${c.f.text}|${askRising}`, prompt: `In welchem Bereich ist ${UCalc.fx(c.f)} streng monoton ${askRising ? 'steigend' : 'fallend'}?`, correct, wrong: wrong.filter((w) => w !== correct),
    solution: `f′(x) = ${c.f.derivative.text} hat die Nullstellen ${c.x1} und ${c.x2}. Zwischen ihnen ist f′ ${c.k > 0 ? 'negativ' : 'positiv'}, außerhalb ${c.k > 0 ? 'positiv' : 'negativ'}. Gesucht: ${correct}.`,
    explanation: 'Wo f′ > 0 ist, steigt der Graph, wo f′ < 0 ist, fällt er.',
    fact: { k: 'monotone', f: c.f, lo: uq(c.x1), hi: uq(c.x2), askRising, answerBetween: betweenIsAnswer },
  });
});

const slopeMeaning = utemplate('k.slope', (_lv, g) => {
  const a = g.int(1, 5);
  const sign = g.int(-1, 1);
  const value = sign * g.int(1, 4);
  const shown = UText.signed(value);
  const fall = `Der Graph fällt an der Stelle x = ${a}.`;
  const rise = `Der Graph steigt an der Stelle x = ${a}.`;
  const flat = `Der Graph hat an der Stelle x = ${a} eine waagerechte Tangente.`;
  const zero = `Der Graph hat bei x = ${a} eine Nullstelle.`;
  const valueWrong = `Der Funktionswert ist f(${a}) = ${shown}.`;
  let correct: string;
  let wrong: string[];
  if (sign < 0) { correct = fall; wrong = [rise, zero, valueWrong]; }
  else if (sign > 0) { correct = rise; wrong = [fall, zero, valueWrong]; }
  else { correct = flat; wrong = [rise, fall, zero]; }
  const statement = sign === 0 ? `f′(${a}) = 0` : `f′(${a}) = ${shown}`;
  return choiceProblem({
    key: `k.slope|${a}|${sign}|${value}`, prompt: `Für eine Funktion f gilt ${statement}. Was folgt daraus?`, correct, wrong,
    solution: `f′ gibt die Steigung an: ${statement} bedeutet: ${correct}`,
    explanation: 'Das Vorzeichen von f′ sagt, ob der Graph steigt (+) oder fällt (−); f′ = 0 heißt waagerechte Tangente.', fact: { k: 'concept' },
  });
});

export const unit02: UTemplate[] = [yIntercept, root, rootTest, symmetryTemplate, extremumX, extremumY, kind, inflection, monotone, slopeMeaning];
