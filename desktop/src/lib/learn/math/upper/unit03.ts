// Unit 3: integral calculus (antiderivative, definite integral, area between graph and x-axis, mean value).
// Integrands are built as derivatives of polynomials with whole coefficients, so the results are whole numbers.
// A port of MathUpperUnit03.swift.

import { folded } from '../../exercise';
import { insert, q, UPoly, UProblems, UQ, UText, uTemplate, type UGen, type UPairItems } from './core';
import { UCalc } from './support';

export function wrapped(f: UPoly): string {
  const terms = f.c.filter((x) => !x.isZero).length;
  const last = f.c.length > 0 ? f.c[f.c.length - 1].n : 0;
  const negativeSingle = terms === 1 && last < 0;
  return terms > 1 || negativeSingle ? '(' + f.text + ')' : f.text;
}

export function bracketed(value: UQ): string {
  return value.n < 0 ? `(${value.text})` : value.text;
}

export function integralSign(a: number, b: number): string {
  return '∫' + UText.subscripted(a) + UText.superscript(b);
}

export function integralText(a: number, b: number, f: UPoly): string {
  return integralSign(a, b) + ' ' + wrapped(f) + ' dx';
}

/** A polynomial F with whole coefficients and no constant term, and its derivative f. */
export function pair(g: UGen, level: number): { F: UPoly; f: UPoly } {
  for (let i = 0; i < 40; i++) {
    let F: UPoly;
    switch (level) {
      case 1:
        F = g.poly(2, g.int(1, 2), [1, 3], false);
        break;
      case 2:
        F = g.poly(g.int(2, 3), 2, [1, 3]);
        break;
      default:
        F = g.poly(3, g.int(2, 3), [1, 3]);
    }
    const noConstant = new UPoly(F.c.map((x, offset) => (offset === 0 ? UQ.zero : x)));
    const f = noConstant.derivative;
    if (!f.isZero && f.degree >= 1) return { F: noConstant, f };
  }
  const F = UPoly.ints([0, 0, 1]);
  return { F, f: F.derivative };
}

const antiderivative = uTemplate(
  'i.anti',
  (lv, g) => {
    let F: UPoly;
    let f: UPoly;
    if (lv === 3) {
      f = g.poly(g.int(2, 3), g.int(2, 3), [1, 5]);
      F = f.integral;
    } else {
      ({ F, f } = pair(g, lv));
    }
    const correct = F.text + ' + C';
    const nonZero = f.c.map((x, offset) => ({ offset, element: x })).filter((e) => !e.element.isZero);
    const forgotDivide = UPoly.terms(nonZero.map((e) => [e.offset + 1, e.element] as [number, UQ]));
    const divideOld = UPoly.terms(
      nonZero.map((e) => [e.offset + 1, e.offset === 0 ? e.element : e.element.div(q(e.offset))] as [number, UQ]),
    );
    const wrongPolys = [forgotDivide, f.derivative, divideOld].filter((w) => !w.equals(F) && !w.isZero);
    const wrong = wrongPolys.map((w) => w.text + ' + C');
    return UProblems.choice({
      key: `i.anti|${f.text}`,
      prompt: `Welche Funktion ist eine Stammfunktion von ${UCalc.fx(f)}?`,
      correct,
      wrong,
      solution: `Jeden Summanden aufleiten: Exponent um 1 erhöhen, durch den neuen Exponenten teilen. Dazu kommt + C. Ergebnis: F(x) = ${correct}.`,
      explanation: 'Aufleiten ist die Umkehrung des Ableitens: Leite zur Probe F ab, es muss f herauskommen.',
      fact: { t: 'antiderivative', f, correct: F, wrong: wrongPolys },
    });
  },
  (_lv, g: UGen): UPairItems | null => {
    const items: UPairItems = [];
    const fronts = new Set<string>();
    const backs = new Set<string>();
    for (let i = 0; i < 80 && items.length < 4; i++) {
      const { F, f } = pair(g, 1);
      const front = '∫ ' + wrapped(f) + ' dx';
      const back = F.text + ' + C';
      if (insert(fronts, folded(front)) && insert(backs, folded(back))) items.push({ front, back });
    }
    return items.length === 4 ? items : null;
  },
);

const noC = uTemplate('i.noC', (_lv, g) => {
  const { F, f } = pair(g, 1);
  const a = g.int(0, 1);
  const b = a + g.int(1, 3);
  const value = F.eval(q(b)).minus(F.eval(q(a)));
  const text = (v: UQ, extra: string): string => (extra === '' ? v.text : `${v.text} + ${extra}`);
  const correct = value.text;
  const wrong = [text(value, 'C'), text(value, '2C'), text(F.eval(q(b)), 'C')];
  return UProblems.choice({
    key: `i.noC|${f.text}|${a}|${b}`,
    prompt: `Du berechnest ${integralText(a, b, f)} mit der Stammfunktion F(x) = ${F.text} + C. Was kommt heraus?`,
    correct,
    wrong,
    solution: `F(${b}) − F(${a}) = (${F.eval(q(b)).text} + C) − (${F.eval(q(a)).text} + C) = ${value.text}. Das C hebt sich auf.`,
    explanation: 'Beim bestimmten Integral wird die Stammfunktion zweimal eingesetzt und subtrahiert; die Konstante C fällt dabei weg.',
    fact: { t: 'definite', f, a: q(a), b: q(b) },
  });
});

const definite = uTemplate('i.definite', (lv, g) => {
  const { F, f } = pair(g, lv);
  const a = lv === 1 ? g.int(0, 1) : g.int(-2, 1);
  const b = Math.max(a + g.int(1, lv === 3 ? 3 : 2), 0);
  const answer = F.eval(q(b)).minus(F.eval(q(a)));
  const wrongs = UCalc.differing(
    [F.eval(q(b)), F.eval(q(b)).plus(F.eval(q(a))), f.eval(q(b)).minus(f.eval(q(a))), f.eval(q(b)).times(q(b - a))],
    answer,
  );
  return UProblems.numeric({
    key: `i.definite|${f.text}|${a}|${b}`,
    prompt: `Berechne ${integralText(a, b, f)}.`,
    answer,
    wrongs,
    solution: `F(x) = ${F.text}; F(${b}) − F(${a}) = ${F.eval(q(b)).text} − ${bracketed(F.eval(q(a)))} = ${answer.text}.`,
    explanation: 'Bestimmtes Integral: obere Grenze in F einsetzen minus untere Grenze in F einsetzen; ein C wird nicht gebraucht.',
    fact: { t: 'definite', f, a: q(a), b: q(b) },
  });
});

interface Parabola {
  f: UPoly;
  r1: number;
  r2: number;
  integral: UQ;
}

/** f = lead (x - r1)(x - r2) with a whole-number integral between the roots. */
function parabola(g: UGen, signedLead: boolean): Parabola | null {
  for (let i = 0; i < 200; i++) {
    const r1 = g.int(-3, 2);
    const r2 = r1 + g.int(2, 6);
    if (r2 < 0) continue;
    const lead = signedLead ? g.nonzero(-3, 3) : g.int(1, 3);
    const f = UPoly.fromRoots(q(lead), [q(r1), q(r2)]);
    const F = f.integral;
    const value = F.eval(q(r2)).minus(F.eval(q(r1)));
    if (value.isInt && value.magnitude.n <= 60) return { f, r1, r2, integral: value };
  }
  return null;
}

const signed = uTemplate('i.signed', (_lv, g) => {
  const p = parabola(g, true);
  if (!p) return null;
  const F = p.f.integral;
  const wrongs = UCalc.differing(
    [p.integral.magnitude, F.eval(q(p.r2)), F.eval(q(p.r2)).minus(F.eval(UQ.zero)), p.f.eval(q(p.r2)).minus(p.f.eval(q(p.r1)))],
    p.integral,
  );
  return UProblems.numeric({
    key: `i.signed|${p.f.text}`,
    prompt: `Berechne ${integralText(p.r1, p.r2, p.f)}. Die Grenzen sind die Nullstellen.`,
    answer: p.integral,
    wrongs,
    solution: `F(x) = ${F.text}; F(${p.r2}) − F(${p.r1}) = ${p.integral.text}. Das Vorzeichen bleibt stehen: Liegt der Graph unter der x-Achse, ist das Integral negativ.`,
    explanation: 'Das Integral zählt Flächen unter der x-Achse negativ; erst der Flächeninhalt nimmt den Betrag.',
    fact: { t: 'definite', f: p.f, a: q(p.r1), b: q(p.r2) },
  });
});

const area = uTemplate('i.area', (lv, g) => {
  if (lv === 3) {
    for (let i = 0; i < 300; i++) {
      const roots = new Set<number>();
      while (roots.size < 3) roots.add(g.int(-3, 3));
      const r = [...roots].sort((a, b) => a - b);
      const f = UPoly.fromRoots(q(g.pick([1, 1, -1, 2])), r.map((x) => q(x)));
      const F = f.integral;
      const first = F.eval(q(r[1])).minus(F.eval(q(r[0])));
      const second = F.eval(q(r[2])).minus(F.eval(q(r[1])));
      const total = first.magnitude.plus(second.magnitude);
      if (!(total.d <= 2 && total.n > 0)) continue;
      const wrongs = UCalc.differing([first.plus(second), first.plus(second).magnitude, first.magnitude, second.magnitude], total);
      return UProblems.numeric({
        key: `i.area3|${f.text}`,
        prompt: `Wie groß ist der Flächeninhalt zwischen dem Graphen von ${UCalc.fx(f)} und der x-Achse zwischen der kleinsten und der größten Nullstelle?`,
        answer: total,
        wrongs,
        solution: `Nullstellen ${r.join(', ')}. Teilflächen einzeln: |${first.text}| + |${second.text}| = ${total.text}. Würdest du in einem Stück integrieren, höben sich die Teile teilweise auf.`,
        explanation: 'Bei einem Vorzeichenwechsel zwischen den Grenzen rechnest du an jeder Nullstelle getrennt und addierst die Beträge.',
        fact: { t: 'area', f, a: q(r[0]), b: q(r[2]) },
      });
    }
    return null;
  }
  const p = parabola(g, lv === 2);
  if (!p) return null;
  const F = p.f.integral;
  const answer = p.integral.magnitude;
  const wrongs = UCalc.differing(
    [
      F.eval(q(p.r2)).magnitude,
      F.eval(q(p.r2)).minus(F.eval(UQ.zero)).magnitude,
      answer.plus(answer),
      q(p.r2 - p.r1).times(p.f.eval(q(p.r1 + p.r2, 2)).magnitude),
    ],
    answer,
  );
  return UProblems.numeric({
    key: `i.area|${p.f.text}`,
    prompt: `Wie groß ist der Flächeninhalt zwischen dem Graphen von ${UCalc.fx(p.f)} und der x-Achse?`,
    answer,
    wrongs,
    solution: `Nullstellen ${p.r1} und ${p.r2}. Integral von ${p.r1} bis ${p.r2}: ${p.integral.text}; der Flächeninhalt ist der Betrag: ${answer.text}.`,
    explanation: 'Zwischen zwei benachbarten Nullstellen liegt der Graph auf einer Seite; der Flächeninhalt ist der Betrag des Integrals.',
    fact: { t: 'area', f: p.f, a: q(p.r1), b: q(p.r2) },
  });
});

const rules = uTemplate('i.rules', (_lv, g) => {
  const a = g.int(0, 2);
  const b = a + g.int(1, 3);
  const c = b + g.int(1, 3);
  const p = g.int(2, 9);
  const qq = g.int(1, 8);
  switch (g.int(0, 4)) {
    case 0: {
      const answer = q(p + qq);
      return UProblems.numeric({
        key: `i.rules|add|${p}|${qq}|${a}|${b}|${c}`,
        prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p} und ${integralSign(b, c)} f(x) dx = ${qq}. Wie groß ist ${integralSign(a, c)} f(x) dx?`,
        answer,
        wrongs: UCalc.differing([q(p * qq), q(p - qq), q(p)], answer),
        solution: `Aneinandergrenzende Intervalle addierst du: ${p} + ${qq} = ${p + qq}.`,
        explanation: 'Integrale über aneinandergrenzende Intervalle darfst du addieren.',
        fact: { t: 'combination', coefficients: [UQ.one, UQ.one], parts: [q(p), q(qq)] },
      });
    }
    case 1: {
      const k = g.int(2, 5);
      return UProblems.numeric({
        key: `i.rules|factor|${p}|${k}|${a}|${b}`,
        prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p}. Wie groß ist ${integralSign(a, b)} ${k}·f(x) dx?`,
        answer: q(k * p),
        wrongs: UCalc.differing([q(k + p), q(p), q(k * p * (b - a))], q(k * p)),
        solution: `Ein Faktor kommt vor das Integral: ${k}·${p} = ${k * p}.`,
        explanation: 'Konstante Faktoren darfst du vor das Integral ziehen.',
        fact: { t: 'combination', coefficients: [q(k)], parts: [q(p)] },
      });
    }
    case 2:
      return UProblems.numeric({
        key: `i.rules|swap|${p}|${a}|${b}`,
        prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p}. Wie groß ist ${integralSign(b, a)} f(x) dx?`,
        answer: q(-p),
        wrongs: UCalc.differing([q(p), UQ.zero, q(2 * p), q(p + 1)], q(-p)),
        solution: `Vertauschst du die Grenzen, wechselt das Vorzeichen: −${p}.`,
        explanation: 'Vertauschte Grenzen drehen das Vorzeichen des Integrals um.',
        fact: { t: 'combination', coefficients: [q(-1)], parts: [q(p)] },
      });
    case 3: {
      const k = g.int(2, 4);
      const answer = q(p - k * qq);
      return UProblems.numeric({
        key: `i.rules|lin|${p}|${qq}|${k}|${a}|${b}`,
        prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p} und ${integralSign(a, b)} g(x) dx = ${qq}. Wie groß ist ${integralSign(a, b)} (f(x) − ${k}·g(x)) dx?`,
        answer,
        wrongs: UCalc.differing([q(p - qq), q(p + k * qq), q(p - k + qq), q(p * qq)], answer),
        solution: `Summen und Faktoren darfst du aufteilen: ${p} − ${k}·${qq} = ${answer.text}.`,
        explanation: 'Das Integral ist linear: Differenzen und konstante Faktoren darfst du einzeln integrieren.',
        fact: { t: 'combination', coefficients: [UQ.one, q(-k)], parts: [q(p), q(qq)] },
      });
    }
    default:
      return UProblems.numeric({
        key: `i.rules|zero|${a}|${p}`,
        prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p}. Wie groß ist ${integralSign(a, a)} f(x) dx?`,
        answer: UQ.zero,
        wrongs: UCalc.differing([q(p), q(-p), q(a), q(1)], UQ.zero),
        solution: 'Sind obere und untere Grenze gleich, gibt es keine Breite: 0.',
        explanation: 'Ein Integral mit gleichen Grenzen ist immer 0.',
        fact: { t: 'combination', coefficients: [UQ.zero], parts: [q(p)] },
      });
  }
});

const mean = uTemplate('i.mean', (lv, g) => {
  for (let i = 0; i < 200; i++) {
    const f = g.poly(lv === 3 ? 3 : 2, lv === 1 ? 2 : 3, [1, 5], lv !== 1);
    const a = lv === 1 ? 0 : g.int(-1, 1);
    const b = a + g.int(1, 4);
    const F = f.integral;
    const integral = F.eval(q(b)).minus(F.eval(q(a)));
    const answer = integral.div(q(b - a));
    if (!(answer.d <= 2 && Math.abs(answer.double) < 500)) continue;
    const midpoint = f.eval(q(a + b, 2));
    const wrongs = UCalc.differing([integral, f.eval(q(a)).plus(f.eval(q(b))).div(q(2)), midpoint, integral.div(q(b))], answer);
    return UProblems.numeric({
      key: `i.mean|${f.text}|${a}|${b}`,
      prompt: `Bestimme den Mittelwert von ${UCalc.fx(f)} auf dem Intervall [${UText.signed(a)}; ${b}].`,
      answer,
      wrongs,
      solution: `Mittelwert = 1/(b − a) · Integral = 1/${b - a} · ${integral.text} = ${answer.text}.`,
      explanation: 'Der Mittelwert ist das Integral geteilt durch die Länge des Intervalls.',
      fact: { t: 'mean', f, a: q(a), b: q(b) },
    });
  }
  return null;
});

const upper = uTemplate('i.upper', (lv, g) => {
  const b = g.int(1, 5);
  let f: UPoly;
  let value: number;
  if (lv === 3) {
    const m = 3 * g.int(1, 3);
    f = UPoly.terms([[2, q(m)]]);
    value = Math.trunc((m * b * b * b) / 3);
  } else {
    const m = 2 * g.int(1, 3);
    f = UPoly.terms([[1, q(m)]]);
    value = Math.trunc((m * b * b) / 2);
  }
  const answer = q(b);
  const m = f.c[f.c.length - 1].n;
  const wrongs = UCalc.differing([q(value, m), q(value, 2), q(value - m), q(2 * value, m)], answer);
  return UProblems.numeric({
    key: `i.upper|${f.text}|${b}`,
    prompt: `Für welches b > 0 gilt ∫₀ᵇ ${f.text} dx = ${value}?`,
    answer,
    wrongs,
    solution: `Stammfunktion ${f.integral.text}; an der Grenze b: ${f.integral.eval(q(b)).text} mit b = ${b} gibt ${value}. Also b = ${b}.`,
    explanation: 'Rechne das Integral mit der Grenze b aus und löse die entstehende Gleichung nach b.',
    fact: { t: 'upperLimit', f, value: q(value) },
  });
});

export const MathUpperUnit03 = {
  templates: [antiderivative, noC, definite, signed, area, rules, mean, upper],
  wrapped,
  bracketed,
  integralSign,
  integralText,
  pair,
};
