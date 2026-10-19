import { folded } from '../../exercise';
import { UCalc } from './calc';
import { UGen, UPairs, UPoly, UQ, UTemplate, UText, choiceProblem, numeric, uq, utemplate } from './core';

/**
 * Unit 3: integral calculus (antiderivative, definite integral, area between graph and x-axis, mean value).
 * Integrands are built as derivatives of polynomials with whole coefficients, so the results are whole numbers.
 */
function wrapped(f: UPoly): string {
  const terms = f.c.filter((x) => !x.isZero).length;
  const negativeSingle = terms === 1 && (f.c.length > 0 ? f.c[f.c.length - 1].n : 0) < 0;
  return terms > 1 || negativeSingle ? `(${f.text})` : f.text;
}

const bracketed = (x: UQ): string => (x.n < 0 ? `(${x.text})` : x.text);
const integralSign = (a: number, b: number): string => `∫${UText.subscripted(a)}${UText.superscript(b)}`;
const integralText = (a: number, b: number, f: UPoly): string => `${integralSign(a, b)} ${wrapped(f)} dx`;

/** A polynomial F with whole coefficients and no constant term, and its derivative f. */
function pair(g: UGen, level: number): { F: UPoly; f: UPoly } {
  for (let i = 0; i < 40; i++) {
    let F: UPoly;
    switch (level) {
      case 1: F = g.poly(2, g.int(1, 2), [1, 3], false); break;
      case 2: F = g.poly(g.int(2, 3), 2, [1, 3]); break;
      default: F = g.poly(3, g.int(2, 3), [1, 3]);
    }
    const noConstant = new UPoly(F.c.map((x, offset) => (offset === 0 ? UQ.zero : x)));
    const f = noConstant.derivative;
    if (!f.isZero && f.degree >= 1) return { F: noConstant, f };
  }
  const F = UPoly.ofInts([0, 0, 1]);
  return { F, f: F.derivative };
}

function antiderivativePairs(_level: number, g: UGen): UPairs | null {
  const items: UPairs = [];
  const fronts = new Set<string>();
  const backs = new Set<string>();
  for (let i = 0; i < 80 && items.length < 4; i++) {
    const { F, f } = pair(g, 1);
    const front = `∫ ${wrapped(f)} dx`;
    const back = `${F.text} + C`;
    if (!fronts.has(folded(front)) && !backs.has(folded(back))) {
      fronts.add(folded(front));
      backs.add(folded(back));
      items.push({ front, back });
    }
  }
  return items.length === 4 ? items : null;
}

const antiderivative = utemplate('i.anti', (lv, g) => {
  let F: UPoly;
  let f: UPoly;
  if (lv === 3) {
    f = g.poly(g.int(2, 3), g.int(2, 3), [1, 5]);
    F = f.integral;
  } else {
    ({ F, f } = pair(g, lv));
  }
  const correct = `${F.text} + C`;
  const nonZero = f.c.map((x, offset) => ({ x, offset })).filter((e) => !e.x.isZero);
  const forgotDivide = UPoly.ofTerms(nonZero.map((e): [number, UQ] => [e.offset + 1, e.x]));
  const divideOld = UPoly.ofTerms(nonZero.map((e): [number, UQ] => [e.offset + 1, e.offset === 0 ? e.x : e.x.div(uq(e.offset))]));
  const wrongPolys = [forgotDivide, f.derivative, divideOld].filter((p) => !p.equals(F) && !p.isZero);
  return choiceProblem({
    key: `i.anti|${f.text}`, prompt: `Welche Funktion ist eine Stammfunktion von ${UCalc.fx(f)}?`, correct, wrong: wrongPolys.map((p) => `${p.text} + C`),
    solution: `Jeden Summanden aufleiten: Exponent um 1 erhöhen, durch den neuen Exponenten teilen. Dazu kommt + C. Ergebnis: F(x) = ${correct}.`,
    explanation: 'Aufleiten ist die Umkehrung des Ableitens: Leite zur Probe F ab, es muss f herauskommen.',
    fact: { k: 'antiderivative', f, correct: F, wrong: wrongPolys },
  });
}, antiderivativePairs);

const noConstantTemplate = utemplate('i.noC', (_lv, g) => {
  const { F, f } = pair(g, 1);
  const a = g.int(0, 1);
  const b = a + g.int(1, 3);
  const value = F.eval(uq(b)).minus(F.eval(uq(a)));
  const text = (v: UQ, extra: string) => (extra === '' ? v.text : `${v.text} + ${extra}`);
  const correct = value.text;
  const wrong = [text(value, 'C'), text(value, '2C'), text(F.eval(uq(b)), 'C')];
  return choiceProblem({
    key: `i.noC|${f.text}|${a}|${b}`, prompt: `Du berechnest ${integralText(a, b, f)} mit der Stammfunktion F(x) = ${F.text} + C. Was kommt heraus?`, correct, wrong,
    solution: `F(${b}) − F(${a}) = (${F.eval(uq(b)).text} + C) − (${F.eval(uq(a)).text} + C) = ${value.text}. Das C hebt sich auf.`,
    explanation: 'Beim bestimmten Integral wird die Stammfunktion zweimal eingesetzt und subtrahiert; die Konstante C fällt dabei weg.',
    fact: { k: 'definite', f, a: uq(a), b: uq(b) },
  });
});
const definite = utemplate('i.definite', (lv, g) => {
  const { F, f } = pair(g, lv);
  const a = lv === 1 ? g.int(0, 1) : g.int(-2, 1);
  const b = Math.max(a + g.int(1, lv === 3 ? 3 : 2), 0);
  const answer = F.eval(uq(b)).minus(F.eval(uq(a)));
  const wrongs = UCalc.differing([F.eval(uq(b)), F.eval(uq(b)).plus(F.eval(uq(a))), f.eval(uq(b)).minus(f.eval(uq(a))), f.eval(uq(b)).times(uq(b - a))], answer);
  return numeric({
    key: `i.definite|${f.text}|${a}|${b}`, prompt: `Berechne ${integralText(a, b, f)}.`, answer, wrongs,
    solution: `F(x) = ${F.text}; F(${b}) − F(${a}) = ${F.eval(uq(b)).text} − ${bracketed(F.eval(uq(a)))} = ${answer.text}.`,
    explanation: 'Bestimmtes Integral: obere Grenze in F einsetzen minus untere Grenze in F einsetzen; ein C wird nicht gebraucht.',
    fact: { k: 'definite', f, a: uq(a), b: uq(b) },
  });
});

/** f = lead (x - r1)(x - r2) with a whole-number integral between the roots. */
function parabola(g: UGen, signedLead: boolean): { f: UPoly; r1: number; r2: number; integral: UQ } | null {
  for (let i = 0; i < 200; i++) {
    const r1 = g.int(-3, 2);
    const r2 = r1 + g.int(2, 6);
    if (r2 < 0) continue;
    const lead = signedLead ? g.nonzero(-3, 3) : g.int(1, 3);
    const f = UPoly.fromRoots(uq(lead), [uq(r1), uq(r2)]);
    const F = f.integral;
    const value = F.eval(uq(r2)).minus(F.eval(uq(r1)));
    if (value.isInt && value.magnitude.n <= 60) return { f, r1, r2, integral: value };
  }
  return null;
}

const signed = utemplate('i.signed', (_lv, g) => {
  const p = parabola(g, true);
  if (!p) return null;
  const F = p.f.integral;
  const wrongs = UCalc.differing([p.integral.magnitude, F.eval(uq(p.r2)), F.eval(uq(p.r2)).minus(F.eval(UQ.zero)), p.f.eval(uq(p.r2)).minus(p.f.eval(uq(p.r1)))], p.integral);
  return numeric({
    key: `i.signed|${p.f.text}`, prompt: `Berechne ${integralText(p.r1, p.r2, p.f)}. Die Grenzen sind die Nullstellen.`, answer: p.integral, wrongs,
    solution: `F(x) = ${F.text}; F(${p.r2}) − F(${p.r1}) = ${p.integral.text}. Das Vorzeichen bleibt stehen: Liegt der Graph unter der x-Achse, ist das Integral negativ.`,
    explanation: 'Das Integral zählt Flächen unter der x-Achse negativ; erst der Flächeninhalt nimmt den Betrag.',
    fact: { k: 'definite', f: p.f, a: uq(p.r1), b: uq(p.r2) },
  });
});

const area = utemplate('i.area', (lv, g) => {
  if (lv === 3) {
    for (let i = 0; i < 300; i++) {
      const set = new Set<number>();
      while (set.size < 3) set.add(g.int(-3, 3));
      const r = [...set].sort((a, b) => a - b);
      const f = UPoly.fromRoots(uq(g.pick([1, 1, -1, 2])), r.map((x) => uq(x)));
      const F = f.integral;
      const first = F.eval(uq(r[1])).minus(F.eval(uq(r[0])));
      const second = F.eval(uq(r[2])).minus(F.eval(uq(r[1])));
      const total = first.magnitude.plus(second.magnitude);
      if (!(total.d <= 2 && total.n > 0)) continue;
      const wrongs = UCalc.differing([first.plus(second), first.plus(second).magnitude, first.magnitude, second.magnitude], total);
      return numeric({
        key: `i.area3|${f.text}`, prompt: `Wie groß ist der Flächeninhalt zwischen dem Graphen von ${UCalc.fx(f)} und der x-Achse zwischen der kleinsten und der größten Nullstelle?`, answer: total, wrongs,
        solution: `Nullstellen ${r.join(', ')}. Teilflächen einzeln: |${first.text}| + |${second.text}| = ${total.text}. Würdest du in einem Stück integrieren, höben sich die Teile teilweise auf.`,
        explanation: 'Bei einem Vorzeichenwechsel zwischen den Grenzen rechnest du an jeder Nullstelle getrennt und addierst die Beträge.',
        fact: { k: 'area', f, a: uq(r[0]), b: uq(r[2]) },
      });
    }
    return null;
  }
  const p = parabola(g, lv === 2);
  if (!p) return null;
  const F = p.f.integral;
  const answer = p.integral.magnitude;
  const wrongs = UCalc.differing([F.eval(uq(p.r2)).magnitude, F.eval(uq(p.r2)).minus(F.eval(UQ.zero)).magnitude, answer.plus(answer), uq(p.r2 - p.r1).times(p.f.eval(uq(p.r1 + p.r2, 2)).magnitude)], answer);
  return numeric({
    key: `i.area|${p.f.text}`, prompt: `Wie groß ist der Flächeninhalt zwischen dem Graphen von ${UCalc.fx(p.f)} und der x-Achse?`, answer, wrongs,
    solution: `Nullstellen ${p.r1} und ${p.r2}. Integral von ${p.r1} bis ${p.r2}: ${p.integral.text}; der Flächeninhalt ist der Betrag: ${answer.text}.`,
    explanation: 'Zwischen zwei benachbarten Nullstellen liegt der Graph auf einer Seite; der Flächeninhalt ist der Betrag des Integrals.',
    fact: { k: 'area', f: p.f, a: uq(p.r1), b: uq(p.r2) },
  });
});

const rules = utemplate('i.rules', (_lv, g) => {
  const a = g.int(0, 2);
  const b = a + g.int(1, 3);
  const c = b + g.int(1, 3);
  const p = g.int(2, 9);
  const q = g.int(1, 8);
  switch (g.int(0, 4)) {
    case 0: {
      const answer = uq(p + q);
      return numeric({
        key: `i.rules|add|${p}|${q}|${a}|${b}|${c}`, prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p} und ${integralSign(b, c)} f(x) dx = ${q}. Wie groß ist ${integralSign(a, c)} f(x) dx?`,
        answer, wrongs: UCalc.differing([uq(p * q), uq(p - q), uq(p)], answer), solution: `Aneinandergrenzende Intervalle addierst du: ${p} + ${q} = ${p + q}.`,
        explanation: 'Integrale über aneinandergrenzende Intervalle darfst du addieren.', fact: { k: 'combination', coefficients: [UQ.one, UQ.one], parts: [uq(p), uq(q)] },
      });
    }
    case 1: {
      const k = g.int(2, 5);
      return numeric({
        key: `i.rules|factor|${p}|${k}|${a}|${b}`, prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p}. Wie groß ist ${integralSign(a, b)} ${k}·f(x) dx?`,
        answer: uq(k * p), wrongs: UCalc.differing([uq(k + p), uq(p), uq(k * p * (b - a))], uq(k * p)), solution: `Ein Faktor kommt vor das Integral: ${k}·${p} = ${k * p}.`,
        explanation: 'Konstante Faktoren darfst du vor das Integral ziehen.', fact: { k: 'combination', coefficients: [uq(k)], parts: [uq(p)] },
      });
    }
    case 2:
      return numeric({
        key: `i.rules|swap|${p}|${a}|${b}`, prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p}. Wie groß ist ${integralSign(b, a)} f(x) dx?`,
        answer: uq(-p), wrongs: UCalc.differing([uq(p), UQ.zero, uq(2 * p), uq(p + 1)], uq(-p)), solution: `Vertauschst du die Grenzen, wechselt das Vorzeichen: −${p}.`,
        explanation: 'Vertauschte Grenzen drehen das Vorzeichen des Integrals um.', fact: { k: 'combination', coefficients: [uq(-1)], parts: [uq(p)] },
      });
    case 3: {
      const k = g.int(2, 4);
      const answer = uq(p - k * q);
      return numeric({
        key: `i.rules|lin|${p}|${q}|${k}|${a}|${b}`, prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p} und ${integralSign(a, b)} g(x) dx = ${q}. Wie groß ist ${integralSign(a, b)} (f(x) − ${k}·g(x)) dx?`,
        answer, wrongs: UCalc.differing([uq(p - q), uq(p + k * q), uq(p - k + q), uq(p * q)], answer), solution: `Summen und Faktoren darfst du aufteilen: ${p} − ${k}·${q} = ${answer.text}.`,
        explanation: 'Das Integral ist linear: Differenzen und konstante Faktoren darfst du einzeln integrieren.', fact: { k: 'combination', coefficients: [UQ.one, uq(-k)], parts: [uq(p), uq(q)] },
      });
    }
    default:
      return numeric({
        key: `i.rules|zero|${a}|${p}`, prompt: `Es gilt ${integralSign(a, b)} f(x) dx = ${p}. Wie groß ist ${integralSign(a, a)} f(x) dx?`,
        answer: UQ.zero, wrongs: UCalc.differing([uq(p), uq(-p), uq(a), uq(1)], UQ.zero), solution: 'Sind obere und untere Grenze gleich, gibt es keine Breite: 0.',
        explanation: 'Ein Integral mit gleichen Grenzen ist immer 0.', fact: { k: 'combination', coefficients: [UQ.zero], parts: [uq(p)] },
      });
  }
});

const mean = utemplate('i.mean', (lv, g) => {
  for (let i = 0; i < 200; i++) {
    const f = g.poly(lv === 3 ? 3 : 2, lv === 1 ? 2 : 3, [1, 5], lv !== 1);
    const a = lv === 1 ? 0 : g.int(-1, 1);
    const b = a + g.int(1, 4);
    const F = f.integral;
    const integral = F.eval(uq(b)).minus(F.eval(uq(a)));
    const answer = integral.div(uq(b - a));
    if (!(answer.d <= 2 && Math.abs(answer.double) < 500)) continue;
    const midpoint = f.eval(uq(a + b, 2));
    const wrongs = UCalc.differing([integral, f.eval(uq(a)).plus(f.eval(uq(b))).div(uq(2)), midpoint, integral.div(uq(b))], answer);
    return numeric({
      key: `i.mean|${f.text}|${a}|${b}`, prompt: `Bestimme den Mittelwert von ${UCalc.fx(f)} auf dem Intervall [${UText.signed(a)}; ${b}].`, answer, wrongs,
      solution: `Mittelwert = 1/(b − a) · Integral = 1/${b - a} · ${integral.text} = ${answer.text}.`,
      explanation: 'Der Mittelwert ist das Integral geteilt durch die Länge des Intervalls.', fact: { k: 'mean', f, a: uq(a), b: uq(b) },
    });
  }
  return null;
});

const upper = utemplate('i.upper', (lv, g) => {
  const b = g.int(1, 5);
  let f: UPoly;
  let value: number;
  if (lv === 3) {
    const m = 3 * g.int(1, 3);
    f = UPoly.ofTerms([[2, uq(m)]]);
    value = Math.trunc((m * b * b * b) / 3);
  } else {
    const m = 2 * g.int(1, 3);
    f = UPoly.ofTerms([[1, uq(m)]]);
    value = Math.trunc((m * b * b) / 2);
  }
  const answer = uq(b);
  const m = f.c[f.c.length - 1].n;
  const wrongs = UCalc.differing([uq(value, m), uq(value, 2), uq(value - m), uq(2 * value, m)], answer);
  return numeric({
    key: `i.upper|${f.text}|${b}`, prompt: `Für welches b > 0 gilt ∫₀ᵇ ${f.text} dx = ${value}?`, answer, wrongs,
    solution: `Stammfunktion ${f.integral.text}; an der Grenze b: ${f.integral.eval(uq(b)).text} mit b = ${b} gibt ${value}. Also b = ${b}.`,
    explanation: 'Rechne das Integral mit der Grenze b aus und löse die entstehende Gleichung nach b.', fact: { k: 'upperLimit', f, value: uq(value) },
  });
});

export const unit03: UTemplate[] = [antiderivative, noConstantTemplate, definite, signed, area, rules, mean, upper];
