// Unit 1: derivative (power, sum and factor rule, f'(a), slope of the tangent, tangent line as a number).
// A port of MathUpperUnit01.swift.

import { folded } from '../../exercise';
import { insert, q, UPoly, UProblems, UQ, UText, uTemplate, type UGen, type UPairItems } from './core';
import { UCalc } from './support';

const power = uTemplate(
  'd1.power',
  (lv, g) => {
    let f: UPoly;
    switch (lv) {
      case 1:
        f = UPoly.terms([[g.int(2, 5), q(g.int(2, 6))]]);
        break;
      case 2:
        f = g.poly(g.int(2, 4), 2, [1, 6]);
        break;
      default:
        f = g.poly(g.int(3, 4), g.int(3, 4), [1, 6]);
    }
    const d = f.derivative;
    const wrong = [
      UCalc.mistaken(f, 'noMultiply'),
      UCalc.mistaken(f, 'noLower'),
      UCalc.mistaken(f, 'keepConstant'),
      UCalc.mistaken(f, 'integrate'),
    ];
    if (f.c.filter((x) => !x.isZero).length === 1 && f.c.length > 0) {
      const top = f.c.length - 1;
      wrong.push(UPoly.terms([[top - 1, q(top)]]));
    }
    const wrongPolys = wrong.filter((w) => !w.equals(d));
    return UProblems.choice({
      key: `d1.power|${f.text}`,
      prompt: `Bilde die Ableitung von ${UCalc.fx(f)}.`,
      correct: d.text,
      wrong: wrongPolys.map((w) => w.text),
      solution: `Summand für Summand: Exponent als Faktor nach vorn, Exponent um 1 senken, Konstanten fallen weg. Ergebnis: f′(x) = ${d.text}.`,
      explanation: 'Potenzregel: (a·xⁿ)′ = a·n·xⁿ⁻¹; eine Konstante hat die Ableitung 0.',
      fact: { t: 'derivPoly', f, correct: d, wrong: wrongPolys },
    });
  },
  (_lv, g: UGen): UPairItems | null => {
    const items: UPairItems = [];
    const fronts = new Set<string>();
    const backs = new Set<string>();
    for (let i = 0; i < 60 && items.length < 4; i++) {
      const n = g.int(2, 5);
      const a = g.int(1, 6);
      const f = UPoly.terms([[n, q(a)]]);
      const front = UCalc.fx(f);
      const back = 'f′(x) = ' + f.derivative.text;
      if (insert(fronts, folded(front)) && insert(backs, folded(back))) items.push({ front, back });
    }
    return items.length === 4 ? items : null;
  },
);

const value = uTemplate('d1.value', (lv, g) => {
  const f = UCalc.poly(g, lv);
  const a = lv === 1 ? g.int(1, 3) : g.int(-3, 3);
  const x = q(a);
  const answer = f.derivative.eval(x);
  const wrongs = UCalc.differing(
    [
      f.eval(x),
      UCalc.mistaken(f, 'noMultiply').eval(x),
      UCalc.mistaken(f, 'noLower').eval(x),
      UCalc.mistaken(f, 'keepConstant').eval(x),
      f.derivative.eval(q(a + 1)),
    ],
    answer,
  );
  return UProblems.numeric({
    key: `d1.value|${f.text}|${a}`,
    prompt: `Berechne f′(${UText.signed(a)}) für ${UCalc.fx(f)}.`,
    answer,
    wrongs,
    solution: `f′(x) = ${f.derivative.text}; f′(${UText.signed(a)}) = ${answer.text}.`,
    explanation: 'Erst ableiten, dann die Stelle einsetzen; setzt du in f ein, bekommst du den Funktionswert, nicht die Steigung.',
    fact: { t: 'derivAt', f, x },
  });
});

const linear = uTemplate('d1.linear', (lv, g) => {
  const m = g.nonzero(-6, 6);
  const t = g.nonzero(-9, 9);
  const kind = lv === 1 ? 0 : g.int(0, 2);
  let f: UPoly;
  let answer: UQ;
  switch (kind) {
    case 0:
      f = UPoly.ints([t, m]);
      answer = q(m);
      break;
    case 1:
      f = UPoly.ints([t]);
      answer = UQ.zero;
      break;
    default:
      f = UPoly.ints([0, 1]);
      answer = UQ.one;
  }
  let candidates: UQ[];
  switch (kind) {
    case 0:
      candidates = [q(t), q(m * t), q(m + t), UQ.zero];
      break;
    case 1:
      candidates = [q(t), UQ.one, q(t + 1), q(2)];
      break;
    default:
      candidates = [UQ.zero, q(2), UQ.one.plus(UQ.one).plus(UQ.one)];
  }
  const wrongs = UCalc.differing(candidates, answer);
  return UProblems.numeric({
    key: `d1.linear|${f.text}`,
    prompt: `Welche Steigung hat der Graph von ${UCalc.fx(f)} an jeder Stelle?`,
    answer,
    wrongs,
    solution: `f′(x) = ${f.derivative.text === '' ? '0' : f.derivative.text}, also überall ${answer.text}.`,
    explanation: 'Eine Gerade hat überall dieselbe Steigung; eine Konstante hat die Steigung 0.',
    fact: { t: 'derivAt', f, x: UQ.zero },
  });
});

const slope = uTemplate('d1.slope', (lv, g) => {
  const f = UCalc.poly(g, lv);
  const a = lv === 1 ? g.int(1, 3) : g.nonzero(-3, 3);
  const x = q(a);
  const y = f.eval(x);
  const answer = f.derivative.eval(x);
  const wrongs = UCalc.differing(
    [y, y.div(x), UCalc.mistaken(f, 'noMultiply').eval(x), UCalc.mistaken(f, 'noLower').eval(x), f.derivative.eval(UQ.zero)],
    answer,
  );
  return UProblems.numeric({
    key: `d1.slope|${f.text}|${a}`,
    prompt: `Der Graph von ${UCalc.fx(f)} geht durch P(${UText.signed(a)} | ${y.text}). Wie groß ist die Steigung der Tangente in P?`,
    answer,
    wrongs,
    solution: `Die Tangentensteigung ist f′(${UText.signed(a)}): f′(x) = ${f.derivative.text}, also ${answer.text}.`,
    explanation: 'Die Steigung der Tangente in einem Punkt ist die Ableitung an dieser Stelle, nicht der y-Wert des Punktes.',
    fact: { t: 'derivAt', f, x },
  });
});

const whereSlope = uTemplate('d1.where', (lv, g) => {
  const a = lv === 3 ? g.nonzero(-3, 3) : g.int(1, 3);
  const x0 = g.int(-3, 3);
  const b = g.int(-5, 5);
  const c = g.int(-6, 6);
  const f = UPoly.ints([c, b, a]);
  const m = 2 * a * x0 + b;
  const answer = q(x0);
  const wrongs = UCalc.differing([q(m - b, a), q(m, 2 * a), q(m + b, 2 * a), q(m - b), q(b, 2 * a)], answer);
  return UProblems.numeric({
    key: `d1.where|${f.text}|${m}`,
    prompt: `An welcher Stelle hat der Graph von ${UCalc.fx(f)} die Steigung ${UText.signed(m)}?`,
    answer,
    wrongs,
    solution: `f′(x) = ${f.derivative.text} = ${UText.signed(m)} ergibt x = ${x0}.`,
    explanation: 'Setze die Ableitung gleich der gesuchten Steigung und löse nach x auf.',
    fact: { t: 'slopeX', f, m: q(m) },
  });
});

const tangentT = uTemplate('d1.tangentT', (lv, g) => {
  const f = UCalc.poly(g, lv);
  const a = lv === 1 ? g.int(1, 2) : g.int(-2, 3);
  const x = q(a);
  const m = f.derivative.eval(x);
  const y = f.eval(x);
  const t = y.minus(m.times(x));
  const wrongs = UCalc.differing([y, y.plus(m.times(x)), m.times(x), m, UCalc.mistaken(f, 'noMultiply').eval(x)], t);
  return UProblems.numeric({
    key: `d1.tangentT|${f.text}|${a}`,
    prompt: `Die Tangente an ${UCalc.fx(f)} bei x = ${UText.signed(a)} hat die Gleichung y = m·x + t. Wie groß ist t?`,
    answer: t,
    wrongs,
    solution: `m = f′(${UText.signed(a)}) = ${m.text}, Punkt (${UText.signed(a)} | ${y.text}). Aus ${y.text} = ${m.text}·${UText.signed(a)} + t folgt t = ${t.text}.`,
    explanation: 'Setze Steigung und Punkt in y = m·x + t ein und löse nach t auf.',
    fact: { t: 'tangentT', f, a: x },
  });
});

const tangentY = uTemplate('d1.tangentY', (lv, g) => {
  const f = UCalc.poly(g, lv);
  const a = g.int(1, 2);
  let b = g.int(-3, 3);
  if (b === a) b += 1;
  const x = q(a);
  const xb = q(b);
  const m = f.derivative.eval(x);
  const y = f.eval(x);
  const answer = y.plus(m.times(xb.minus(x)));
  const wrongs = UCalc.differing([f.eval(xb), y.plus(m.times(xb)), m.times(xb.minus(x)), y.plus(m), y.times(m)], answer);
  return UProblems.numeric({
    key: `d1.tangentY|${f.text}|${a}|${b}`,
    prompt: `Die Tangente an ${UCalc.fx(f)} bei x = ${a} wird nach x = ${UText.signed(b)} verlängert. Welchen y-Wert hat sie dort?`,
    answer,
    wrongs,
    solution: `Tangente: y = ${y.text} + ${m.text}·(x − ${a}). Bei x = ${UText.signed(b)}: y = ${answer.text}.`,
    explanation: 'Die Tangente ist y = f(a) + f′(a)·(x − a); der Funktionswert f(b) gehört zur Kurve, nicht zur Tangente.',
    fact: { t: 'tangentY', f, a: x, b: xb },
  });
});

const horizontal = uTemplate('d1.flat', (lv, g) => {
  const a = lv === 3 ? g.nonzero(-3, 3) : g.int(1, 3);
  const h = g.int(-4, 4);
  const k = g.int(-5, 5);
  const f = UPoly.ints([a * h * h + k, -2 * a * h, a]);
  const askY = lv >= 2;
  const answer = q(askY ? k : h);
  const wrongs: UQ[] = askY ? [q(a * h * h + k), q(h), q(a * k), q(-2 * a * h)] : [q(2 * h), q(k), q(a * h * h + k), q(-2 * a * h)];
  return UProblems.numeric({
    key: `d1.flat|${f.text}|${askY}`,
    prompt: askY
      ? `Der Graph von ${UCalc.fx(f)} hat eine waagerechte Tangente. Welchen y-Wert hat der Berührpunkt?`
      : `An welcher Stelle hat der Graph von ${UCalc.fx(f)} eine waagerechte Tangente?`,
    answer,
    wrongs: UCalc.differing(wrongs, answer),
    solution: `f′(x) = ${f.derivative.text} = 0 ergibt x = ${h}; f(${h}) = ${k}.`,
    explanation: 'Eine waagerechte Tangente hat die Steigung 0, also f′(x) = 0.',
    fact: askY ? { t: 'flatY', f } : { t: 'flatX', f },
  });
});

const negativeExponent = uTemplate('d1.negexp', (lv, g) => {
  const useRoot = lv >= 2 && g.chance(0.4);
  if (useRoot) {
    const c = g.int(1, 6) * 2;
    const r = g.int(1, 5);
    const x = r * r;
    const answer = q(c, 2 * r);
    const name = c === 1 ? '√x' : `${c}√x`;
    const wrongs = UCalc.differing([q(c, r), q(c * r, 2), q(1, 2 * r), q(c, 2 * x)], answer);
    return UProblems.numeric({
      key: `d1.negexp|root|${c}|${x}`,
      prompt: `Berechne f′(${x}) für f(x) = ${name}.`,
      answer,
      wrongs,
      solution: `√x = x^(1/2), also f′(x) = ${c}·1/2·x^(−1/2) = ${c}/(2√x). Bei x = ${x}: ${answer.text}.`,
      explanation: 'Wurzeln schreibst du als Potenz: √x = x^(1/2); dann gilt die Potenzregel.',
      fact: { t: 'derivOfFunction', f: (v) => c * Math.sqrt(v), at: x },
    });
  }
  const n = lv === 1 ? g.int(1, 2) : g.int(2, 3);
  const c = g.int(1, 5);
  const a = lv === 1 ? 1 : g.int(1, 2);
  const answer = q(-n * c).div(q(a).power(n + 1));
  const wrongs = UCalc.differing(
    [q(n * c).div(q(a).power(n)), q(c).div(q(a).power(n + 1)), q(-(n - 1) * c).div(q(a).power(n)), q(-n * c).div(q(a).power(n))],
    answer,
  );
  const name = (c === 1 ? '1' : `${c}`) + '/x' + (n === 1 ? '' : UText.superscript(n));
  return UProblems.numeric({
    key: `d1.negexp|${c}|${n}|${a}`,
    prompt: `Berechne f′(${a}) für f(x) = ${name}.`,
    answer,
    wrongs,
    solution: `f(x) = ${c}·x^(−${n}), also f′(x) = −${n * c}·x^(−${n + 1}) = −${n * c}/x^${n + 1}. Bei x = ${a}: ${answer.text}.`,
    explanation: 'Schreibe 1/xⁿ als x⁻ⁿ; die Potenzregel gilt auch für negative Exponenten.',
    fact: { t: 'derivOfFunction', f: (v) => c / Math.pow(v, n), at: a },
  });
});

export const MathUpperUnit01 = {
  templates: [power, value, linear, slope, whereSlope, tangentT, tangentY, horizontal, negativeExponent],
};
