// Unit 7: stochastics (Laplace, binomial coefficient, binomial distribution, expectation, conditional probability).
// A port of MathUpperUnit07.swift.

import {
  insert,
  q,
  UProblems,
  UQ,
  UTable,
  UText,
  uTemplate,
  type UAsk,
  type UBinom,
  type UFact,
  type UGen,
  type UPairItems,
  type UProblem,
  type UUrn,
} from './core';
import { UCalc, UCalc3 } from './support';

const germanTwoDecimals = '(Antworte als Bruch oder Dezimalzahl.)';

/** A probability question: typed as a fraction or decimal, chosen from the same forms. */
function probability(o: {
  key: string;
  prompt: string;
  answer: UQ;
  wrongs: readonly UQ[];
  solution: string;
  explanation: string;
  fact: UFact;
}): UProblem | null {
  return UProblems.numeric({
    key: o.key,
    prompt: o.prompt,
    hint: germanTwoDecimals,
    answer: o.answer,
    wrongs: o.wrongs.filter((w) => w.ge(UQ.zero) && w.le(UQ.one)),
    solution:
      o.solution + ` Ergebnis: ${o.answer.fraction}${o.answer.isInt || o.answer.fraction === o.answer.typed ? '' : ` = ${o.answer.text}`}.`,
    explanation: o.explanation,
    fact: o.fact,
  });
}

export function binomial(n: number, k: number): number {
  if (!(k >= 0 && k <= n)) return 0;
  let result = 1;
  if (k > 0) {
    for (let i = 1; i <= Math.max(k, 1); i++) result = Math.trunc((result * (n - k + i)) / i);
  }
  return result;
}

export function pmf(n: number, p: UQ, k: number): UQ {
  return q(binomial(n, k)).times(p.power(k)).times(UQ.one.minus(p).power(n - k));
}

// MARK: Laplace

type DiceKind =
  | { t: 'single'; s: number }
  | { t: 'atLeast'; s: number }
  | { t: 'atMost'; s: number }
  | { t: 'even' }
  | { t: 'doubleOrSum'; s: number };

const range = (lo: number, hi: number): number[] => {
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
};

const dice = uTemplate('s.dice', (lv, g) => {
  let kind: DiceKind;
  switch (lv) {
    case 1:
      kind = { t: 'single', s: g.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) };
      break;
    case 2:
      kind = g.pick<DiceKind>([{ t: 'atLeast', s: g.int(9, 11) }, { t: 'atMost', s: g.int(3, 5) }, { t: 'single', s: 7 }]);
      break;
    default:
      kind = g.pick<DiceKind>([{ t: 'even' }, { t: 'doubleOrSum', s: g.int(2, 3) }, { t: 'atLeast', s: g.int(7, 8) }]);
  }
  let sums: number[];
  let text: string;
  switch (kind.t) {
    case 'single':
      sums = [kind.s];
      text = `die Augensumme ${kind.s} ist`;
      break;
    case 'atLeast':
      sums = range(kind.s, 12);
      text = `die Augensumme mindestens ${kind.s} ist`;
      break;
    case 'atMost':
      sums = range(2, kind.s);
      text = `die Augensumme höchstens ${kind.s} ist`;
      break;
    case 'even':
      sums = [2, 4, 6, 8, 10, 12];
      text = 'die Augensumme gerade ist';
      break;
    default:
      sums = [kind.s, 14 - kind.s];
      text = `die Augensumme ${kind.s} oder ${14 - kind.s} ist`;
  }
  let count = 0;
  for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) if (sums.includes(x + y)) count += 1;
  const answer = q(count, 36);
  const wrongs = [q(sums.length, 11), q(count, 12), q(count + 1, 36), q(count - 1, 36), q(sums.length, 36), q(count, 6)];
  return probability({
    key: `s.dice|[${sums.join(', ')}]`,
    prompt: `Zwei faire Würfel werden geworfen. Wie groß ist die Wahrscheinlichkeit, dass ${text}?`,
    answer,
    wrongs,
    solution: `Laplace: günstige Fälle durch mögliche Fälle. Es gibt 6·6 = 36 gleich wahrscheinliche Paare, davon ${count} günstige: ${count}/36.`,
    explanation: 'Die Augensummen sind nicht gleich wahrscheinlich; zähle die Würfelpaare, nicht die Summen.',
    fact: { t: 'laplaceDice', sums },
  });
});

const urn = uTemplate('s.urn', (lv, g) => {
  const red = g.int(2, 6);
  const blue = g.int(2, 6);
  const n = red + blue;
  const mode: UUrn = lv === 1 ? 'oneRed' : lv === 2 ? 'twoRedWith' : g.pick<UUrn>(['twoRedWithout', 'differentWithout']);
  let answer: UQ;
  let wrongs: UQ[];
  let prompt: string;
  let solution: string;
  const r = q(red, n);
  switch (mode) {
    case 'oneRed':
      answer = r;
      wrongs = [q(red, blue), q(blue, n), q(1, n), q(red, 2 * n)];
      prompt = `In einer Urne liegen ${red} rote und ${blue} blaue Kugeln. Wie groß ist die Wahrscheinlichkeit, eine rote Kugel zu ziehen?`;
      solution = `${red} günstige von ${n} möglichen Kugeln.`;
      break;
    case 'twoRedWith':
      answer = r.times(r);
      wrongs = [r.plus(r), q(red, n).times(q(red - 1, n - 1)), q(2 * red, n), q(red * red, n)];
      prompt = `In einer Urne liegen ${red} rote und ${blue} blaue Kugeln. Du ziehst zwei Kugeln mit Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zweimal rot?`;
      solution = `Mit Zurücklegen bleibt die Urne gleich: ${red}/${n} · ${red}/${n}.`;
      break;
    case 'twoRedWithout':
      answer = r.times(q(red - 1, n - 1));
      wrongs = [r.times(r), q(red - 1, n - 1), r.plus(q(red - 1, n - 1)), q(red * (red - 1), n * n)];
      prompt = `In einer Urne liegen ${red} rote und ${blue} blaue Kugeln. Du ziehst zwei Kugeln ohne Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zweimal rot?`;
      solution = `Beim zweiten Zug sind nur noch ${red - 1} rote unter ${n - 1} Kugeln: ${red}/${n} · ${red - 1}/${n - 1}.`;
      break;
    default:
      answer = q(2 * red * blue, n * (n - 1));
      wrongs = [r.times(q(blue, n - 1)), q(red * blue, n * n), q(2 * red * blue, n * n), q(blue, n - 1)];
      prompt = `In einer Urne liegen ${red} rote und ${blue} blaue Kugeln. Du ziehst zwei Kugeln ohne Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zwei verschiedene Farben?`;
      solution = `Rot dann blau oder blau dann rot: 2 · ${red}/${n} · ${blue}/${n - 1}.`;
  }
  return probability({
    key: `s.urn|${red}|${blue}|${mode}`,
    prompt,
    answer,
    wrongs,
    solution,
    explanation: 'Ohne Zurücklegen ändern sich Zähler und Nenner nach dem ersten Zug; mit Zurücklegen nicht.',
    fact: { t: 'urn', red, blue, mode },
  });
});

const choose = uTemplate(
  's.choose',
  (lv, g) => {
    const n = lv === 1 ? g.int(3, 6) : lv === 2 ? g.int(5, 9) : g.int(8, 12);
    const k = lv === 1 ? g.int(1, 2) : g.int(0, n);
    const value = binomial(n, k);
    let falling = 1;
    for (let i = 0; i < k; i++) falling *= n - i;
    const wrongs = UCalc.differing(
      [q(n * k), q(binomial(n, k + 1)), q(binomial(n + 1, k)), q(falling), q(binomial(n, k - 1)), q(n - k)],
      q(value),
    );
    return UProblems.numeric({
      key: `s.choose|${n}|${k}`,
      prompt: `Berechne ${n} über ${k}.`,
      answer: q(value),
      wrongs,
      solution: `${n} über ${k} = ${n}!/(${k}!·${n - k}!) = ${value}. Probe mit der Symmetrie: ${n} über ${n - k} ist ebenfalls ${value}.`,
      explanation:
        'n über k zählt, auf wie viele Arten man k aus n auswählt, ohne auf die Reihenfolge zu achten: Es gilt (n über k) = (n über n−k).',
      fact: { t: 'choose', n, k },
    });
  },
  (_lv, g: UGen): UPairItems | null => {
    const items: UPairItems = [];
    const fronts = new Set<string>();
    const backs = new Set<number>();
    for (let i = 0; i < 80 && items.length < 4; i++) {
      const n = g.int(4, 9);
      const k = g.int(1, n - 1);
      const value = binomial(n, k);
      if (insert(fronts, `${Math.min(k, n - k)}|${n}`) && insert(backs, value)) items.push({ front: `${n} über ${k}`, back: `${value}` });
    }
    return items.length === 4 ? items : null;
  },
);

// MARK: Binomial distribution

function parameters(g: UGen, level: number): { n: number; p: UQ } {
  switch (level) {
    case 1:
      return { n: g.int(3, 4), p: q(1, 2) };
    case 2: {
      const n = g.int(3, 5);
      return { n, p: g.pick([q(1, 2), q(1, 10), q(1, 5), q(1, 4)]) };
    }
    default: {
      const n = g.int(4, 6);
      return { n, p: g.pick([q(3, 10), q(1, 5), q(1, 4), q(7, 10), q(3, 4), q(2, 5)]) };
    }
  }
}

const binomialEqual = uTemplate('s.pmf', (lv, g) => {
  const { n, p } = parameters(g, lv);
  const k = lv === 1 ? g.pick([0, n]) : g.int(0, n);
  const qq = UQ.one.minus(p);
  const answer = pmf(n, p, k);
  const coeff = q(binomial(n, k));
  const wrongs = [
    p.power(k).times(qq.power(n - k)),
    p.power(k),
    coeff.times(p.power(k)),
    coeff.times(qq.power(k)).times(p.power(n - k)),
    coeff.times(p.power(k)).times(qq.power(n - k + 1)),
    q(binomial(n, k), 2).times(p.power(k)),
  ];
  return probability({
    key: `s.pmf|${n}|${p.fraction}|${k}`,
    prompt: `X ist binomialverteilt mit n = ${n} und p = ${p.text}. Berechne P(X = ${k}).`,
    answer,
    wrongs,
    solution: `P(X = ${k}) = (${n} über ${k}) · ${p.fraction}^${k} · ${qq.fraction}^${n - k} = ${binomial(n, k)} · ${p.power(k).fraction} · ${qq.power(n - k).fraction}.`,
    explanation: 'Bernoulli-Formel: P(X = k) = (n über k) · pᵏ · (1−p)ⁿ⁻ᵏ; der Binomialkoeffizient zählt die Anordnungen der Treffer.',
    fact: { t: 'binomial', n, p, kind: { t: 'equal', k } },
  });
});

const binomialCumulative = uTemplate('s.cum', (lv, g) => {
  const { n, p } = parameters(g, Math.max(lv, 2));
  const qq = UQ.one.minus(p);
  const k = g.int(1, n - 1);
  const variants = lv === 1 ? 1 : 3;
  const variant = g.int(0, variants);
  const sum = (lo: number, hi: number): UQ => {
    let total = UQ.zero;
    for (let i = lo; i <= hi; i++) total = total.plus(pmf(n, p, i));
    return total;
  };
  let answer: UQ;
  let text: string;
  let wrongs: UQ[];
  let kind: UBinom;
  switch (variant) {
    case 0:
      answer = sum(0, k);
      text = `P(X ≤ ${k})`;
      kind = { t: 'atMost', k };
      wrongs = [pmf(n, p, k), sum(0, k - 1), UQ.one.minus(sum(0, k)), sum(0, k + 1)];
      break;
    case 1:
      answer = UQ.one.minus(qq.power(n));
      text = 'die Wahrscheinlichkeit für mindestens einen Treffer';
      kind = { t: 'atLeastOne' };
      wrongs = [p.power(n), qq.power(n), q(n).times(p), UQ.one.minus(p.power(n))];
      break;
    case 2:
      answer = sum(k, n);
      text = `P(X ≥ ${k})`;
      kind = { t: 'atLeast', k };
      wrongs = [UQ.one.minus(sum(0, k)), sum(0, k), pmf(n, p, k), sum(k + 1, n)];
      break;
    default:
      answer = sum(0, k - 1);
      text = `P(X < ${k})`;
      kind = { t: 'atMost', k: k - 1 };
      wrongs = [sum(0, k), pmf(n, p, k), UQ.one.minus(sum(0, k - 1)), pmf(n, p, k - 1)];
  }
  let sol: string;
  switch (variant) {
    case 1:
      sol = `Gegenereignis: 1 − P(kein Treffer) = 1 − ${qq.fraction}^${n}.`;
      break;
    case 2:
      sol = `P(X ≥ ${k}) = 1 − P(X ≤ ${k - 1}) oder die Summe von P(X = ${k}) bis P(X = ${n}).`;
      break;
    case 3:
      sol = `P(X < ${k}) = P(X ≤ ${k - 1}): addiere P(X = 0) bis P(X = ${k - 1}).`;
      break;
    default:
      sol = `Addiere P(X = 0) bis P(X = ${k}).`;
  }
  return probability({
    key: `s.cum|${n}|${p.fraction}|${k}|${variant}`,
    prompt:
      variant === 1
        ? `Bei einem Zufallsversuch mit p = ${p.text} wird ${n}-mal unabhängig wiederholt. Wie groß ist ${text}?`
        : `X ist binomialverteilt mit n = ${n} und p = ${p.text}. Berechne ${text}.`,
    answer,
    wrongs,
    solution: sol,
    explanation: 'Bei „höchstens“ addierst du die Einzelwahrscheinlichkeiten; bei „mindestens“ ist oft das Gegenereignis kürzer.',
    fact: { t: 'binomial', n, p, kind },
  });
});

export function squareRoot(value: UQ): UQ | null {
  const isqrt = (n: number): number | null => {
    if (n < 0) return null;
    const r = Math.round(Math.sqrt(n));
    return r * r === n ? r : null;
  };
  const top = isqrt(value.n);
  const bottom = isqrt(value.d);
  if (top === null || bottom === null) return null;
  return q(top, bottom);
}

const expectation = uTemplate('s.expect', (lv, g) => {
  if (lv === 1) {
    const p = g.pick([q(1, 2), q(1, 4), q(1, 5), q(1, 10), q(3, 10)]);
    const n = p.d * g.int(1, 6);
    const answer = q(n).times(p);
    return UProblems.numeric({
      key: `s.expect|np|${n}|${p.fraction}`,
      prompt: `X ist binomialverteilt mit n = ${n} und p = ${p.text}. Wie groß ist der Erwartungswert E(X)?`,
      answer,
      wrongs: UCalc.differing([q(n).div(p), q(n).plus(p), q(n).times(UQ.one.minus(p)), p], answer),
      solution: `E(X) = n·p = ${n}·${p.fraction} = ${answer.fraction}.`,
      explanation: 'Bei einer Binomialverteilung ist der Erwartungswert n·p.',
      fact: { t: 'expectation', n, p },
    });
  }
  if (lv === 2) {
    const values = [g.int(-3, 0), g.int(1, 4), g.int(5, 10)];
    const tenths = [g.int(1, 5), g.int(1, 4)];
    const last = 10 - tenths[0] - tenths[1];
    if (!(last >= 1)) return null;
    const probabilities = [q(tenths[0], 10), q(tenths[1], 10), q(last, 10)];
    const answer = values.reduce((acc, v, i) => acc.plus(q(v).times(probabilities[i])), UQ.zero);
    const table = values.map((v, i) => `P(X = ${UText.signed(v)}) = ${probabilities[i].text}`).join('; ');
    const wrongs = [
      q(values.reduce((a, b) => a + b, 0), 3),
      q(Math.max(...values)),
      q(values[0]).times(probabilities[0]).plus(q(values[1]).times(probabilities[1])),
    ];
    return UProblems.numeric({
      key: `s.expect|table|[${values.join(', ')}]|[${tenths.join(', ')}]`,
      prompt: `Eine Zufallsgröße X hat die Verteilung ${table}. Berechne E(X).`,
      answer,
      wrongs: UCalc.differing(wrongs, answer),
      solution: `E(X) = Σ x · P(X = x) = ${values.map((v, i) => `${UCalc3.bracket(v)}·${probabilities[i].text}`).join(' + ')} = ${answer.text}.`,
      explanation: 'Der Erwartungswert ist die mit den Wahrscheinlichkeiten gewichtete Summe aller Werte.',
      fact: { t: 'expectationTable', values: values.map((v) => q(v)), probabilities },
    });
  }
  for (let i = 0; i < 200; i++) {
    const p = g.pick([q(1, 2), q(1, 5), q(1, 4), q(3, 10), q(1, 10), q(3, 4), q(4, 5)]);
    const n = g.int(4, 200);
    const variance = q(n).times(p).times(UQ.one.minus(p));
    const root = squareRoot(variance);
    if (!root) continue;
    return UProblems.numeric({
      key: `s.expect|sigma|${n}|${p.fraction}`,
      prompt: `X ist binomialverteilt mit n = ${n} und p = ${p.text}. Berechne die Standardabweichung σ.`,
      answer: root,
      wrongs: UCalc.differing([variance, q(n).times(p), q(n).times(UQ.one.minus(p)), root.times(q(2))], root),
      solution: `σ = √(n·p·(1−p)) = √(${variance.fraction}) = ${root.fraction}.`,
      explanation: 'Die Standardabweichung der Binomialverteilung ist √(n·p·(1−p)); ohne die Wurzel hättest du die Varianz.',
      fact: { t: 'sigma', n, p },
    });
  }
  return null;
});

// MARK: Conditional probability

function randomTable(g: UGen): UTable | null {
  const total = g.pick([100, 100, 200, 1000]);
  for (let i = 0; i < 100; i++) {
    const step = Math.trunc(total / 20);
    const cells = [0, 1, 2].map(() => g.int(1, 6) * step);
    const rest = total - cells.reduce((a, b) => a + b, 0);
    if (rest >= step) return new UTable(cells[0], cells[1], cells[2], rest);
  }
  return null;
}

export function value(t: UTable, ask: UAsk): UQ {
  const n = t.total;
  switch (ask) {
    case 'pA':
      return q(t.a + t.b, n);
    case 'pB':
      return q(t.a + t.c, n);
    case 'pAandB':
      return q(t.a, n);
    case 'pAorB':
      return q(t.a + t.b + t.c, n);
    case 'pNotAandB':
      return q(t.c, n);
    case 'pNotAandNotB':
      return q(t.d, n);
    case 'pAgivenB':
      return q(t.a, t.a + t.c);
    case 'pBgivenA':
      return q(t.a, t.a + t.b);
    case 'pNotBgivenA':
      return q(t.b, t.a + t.b);
  }
}

function given(t: UTable): string {
  return `P(A) = ${value(t, 'pA').text}, P(B) = ${value(t, 'pB').text}, P(A∩B) = ${value(t, 'pAandB').text}`;
}

const table = uTemplate('s.table', (_lv, g) => {
  const t = randomTable(g);
  if (!t) return null;
  const ask = g.pick<UAsk>(['pAorB', 'pNotAandB', 'pNotAandNotB']);
  const answer = value(t, ask);
  const v = (a: UAsk): UQ => value(t, a);
  let name: string;
  let wrong: UQ[];
  let how: string;
  switch (ask) {
    case 'pAorB':
      name = 'P(A∪B)';
      wrong = [v('pA').plus(v('pB')), v('pAandB'), v('pA').times(v('pB')), UQ.one.minus(v('pAandB'))];
      how = 'P(A∪B) = P(A) + P(B) − P(A∩B).';
      break;
    case 'pNotAandB':
      name = 'P(¬A∩B)';
      wrong = [UQ.one.minus(v('pA')), v('pB'), v('pAandB'), v('pB').plus(v('pAandB'))];
      how = 'P(¬A∩B) = P(B) − P(A∩B).';
      break;
    default:
      name = 'P(¬A∩¬B)';
      wrong = [
        UQ.one.minus(v('pA')).minus(v('pB')),
        v('pAorB'),
        UQ.one.minus(v('pA')).times(UQ.one.minus(v('pB'))),
        UQ.one.minus(v('pAandB')),
      ];
      how = 'P(¬A∩¬B) = 1 − P(A∪B).';
  }
  return probability({
    key: `s.table|${t.a}|${t.b}|${t.c}|${ask}`,
    prompt: `Für zwei Ereignisse gilt ${given(t)}. Wie groß ist ${name}?`,
    answer,
    wrongs: wrong,
    solution: `${how} Mit der Vierfeldertafel: ${answer.text}.`,
    explanation:
      'Eine Vierfeldertafel ordnet alle vier Zellen A∩B, A∩¬B, ¬A∩B, ¬A∩¬B; Zeilen- und Spaltensummen liefern die fehlenden Werte.',
    fact: { t: 'table', table: t, ask },
  });
});

const conditional = uTemplate('s.cond', (lv, g) => {
  for (let i = 0; i < 100; i++) {
    const t = randomTable(g);
    if (!t) continue;
    const ask = g.pick<UAsk>(lv === 3 ? ['pAgivenB', 'pBgivenA', 'pNotBgivenA'] : ['pAgivenB', 'pBgivenA']);
    const answer = value(t, ask);
    if (!answer.isNice || (ask === 'pAgivenB' && answer.equals(value(t, 'pBgivenA')))) continue;
    const v = (a: UAsk): UQ => value(t, a);
    let name: string;
    let wrong: UQ[];
    let how: string;
    switch (ask) {
      case 'pAgivenB':
        name = 'P(A|B)';
        how = `P(A|B) = P(A∩B) / P(B) = ${v('pAandB').text} / ${v('pB').text}.`;
        wrong = [v('pAandB'), v('pBgivenA'), v('pA'), v('pA').times(v('pB'))];
        break;
      case 'pBgivenA':
        name = 'P(B|A)';
        how = `P(B|A) = P(A∩B) / P(A) = ${v('pAandB').text} / ${v('pA').text}.`;
        wrong = [v('pAandB'), v('pAgivenB'), v('pB'), v('pA').times(v('pB'))];
        break;
      default:
        name = 'P(¬B|A)';
        how = `P(¬B|A) = 1 − P(B|A) = 1 − ${v('pBgivenA').text}.`;
        wrong = [v('pBgivenA'), v('pAandB'), v('pA').minus(v('pAandB')), UQ.one.minus(v('pAgivenB'))];
    }
    return probability({
      key: `s.cond|${t.a}|${t.b}|${t.c}|${ask}`,
      prompt: `Für zwei Ereignisse gilt ${given(t)}. Wie groß ist ${name}?`,
      answer,
      wrongs: wrong,
      solution: how,
      explanation:
        'Die bedingte Wahrscheinlichkeit teilt P(A∩B) durch die Wahrscheinlichkeit der Bedingung; P(A∩B) und P(A|B) sind verschiedene Größen.',
      fact: { t: 'table', table: t, ask },
    });
  }
  return null;
});

const independent = 'Ja, denn P(A∩B) = P(A)·P(B).';
const greater = 'Nein, denn P(A∩B) ist größer als P(A)·P(B).';
const smaller = 'Nein, denn P(A∩B) ist kleiner als P(A)·P(B).';

/** A table in which A and B are independent: percentages of A and B whose product is a whole percentage. */
function independentTable(g: UGen): UTable | null {
  const shares = [20, 25, 40, 50, 60, 80];
  for (let i = 0; i < 100; i++) {
    const pa = g.pick(shares);
    const pb = g.pick(shares);
    if ((pa * pb) % 100 !== 0) continue;
    const both = Math.trunc((pa * pb) / 100);
    const t = new UTable(both, pa - both, pb - both, 100 - pa - pb + both);
    if (t.a > 0 && t.b > 0 && t.c > 0 && t.d > 0) return t;
  }
  return null;
}

const independence = uTemplate('s.indep', (_lv, g) => {
  let t: UTable;
  let made: UTable | null = null;
  if (g.chance(0.4)) made = independentTable(g);
  if (made) {
    t = made;
  } else {
    const other = randomTable(g);
    if (!other) return null;
    t = other;
  }
  const pA = value(t, 'pA');
  const pB = value(t, 'pB');
  const both = value(t, 'pAandB');
  const product = pA.times(pB);
  const correct = both.equals(product) ? independent : both.gt(product) ? greater : smaller;
  return UProblems.choice({
    key: `s.indep|${t.a}|${t.b}|${t.c}`,
    prompt: `Für zwei Ereignisse gilt ${given(t)}. Sind A und B stochastisch unabhängig?`,
    correct,
    wrong: [independent, greater, smaller].filter((w) => w !== correct),
    solution: `P(A)·P(B) = ${pA.text}·${pB.text} = ${product.text} und P(A∩B) = ${both.text}. ${correct}`,
    explanation: 'A und B sind genau dann unabhängig, wenn P(A∩B) = P(A)·P(B) gilt.',
    fact: { t: 'independence', table: t },
  });
});

const bayes = uTemplate('s.bayes', (lv, g) => {
  for (let i = 0; i < 300; i++) {
    const pA = g.pick([q(1, 10), q(1, 5), q(1, 4), q(2, 5), q(1, 2)]);
    const pBA = g.pick([q(1, 2), q(4, 5), q(9, 10), q(3, 4)]);
    const pBn = g.pick([q(1, 10), q(1, 5), q(1, 20), q(3, 10)]);
    const total = 1000;
    const counts = [
      pA.times(pBA),
      pA.times(UQ.one.minus(pBA)),
      UQ.one.minus(pA).times(pBn),
      UQ.one.minus(pA).times(UQ.one.minus(pBn)),
    ].map((x) => x.times(q(total)));
    if (!counts.every((x) => x.isInt)) continue;
    const t = new UTable(counts[0].n, counts[1].n, counts[2].n, counts[3].n);
    const askPosterior = lv === 3;
    const ask: UAsk = askPosterior ? 'pAgivenB' : 'pB';
    const answer = value(t, ask);
    if (!answer.isNice) continue;
    const wrongs: UQ[] = askPosterior
      ? [pBA, pA.times(pBA), pA, value(t, 'pB'), pBA.div(value(t, 'pB'))]
      : [pA.times(pBA), pBA.plus(pBn), pBn, pBA.plus(pBn).div(q(2))];
    return probability({
      key: `s.bayes|${pA.fraction}|${pBA.fraction}|${pBn.fraction}|${askPosterior}`,
      prompt: `Im Baumdiagramm gilt P(A) = ${pA.text}, P(B|A) = ${pBA.text} und P(B|¬A) = ${pBn.text}. ${askPosterior ? 'Wie groß ist P(A|B)?' : 'Wie groß ist P(B)?'}`,
      answer,
      wrongs,
      solution: askPosterior
        ? `Auf 1000 Fälle: ${t.a} mit A und B, ${t.c} mit ¬A und B. P(A|B) = ${t.a}/${t.a + t.c}.`
        : `Totale Wahrscheinlichkeit: P(B) = P(A)·P(B|A) + P(¬A)·P(B|¬A) = ${t.a + t.c}/1000.`,
      explanation: askPosterior
        ? 'Die gesuchte Wahrscheinlichkeit P(A|B) ist der Anteil von A unter allen Fällen, in denen B eintritt, nicht P(B|A).'
        : 'Alle Pfade, die zu B führen, addierst du; jeder Pfad ist das Produkt seiner Wahrscheinlichkeiten.',
      fact: { t: 'table', table: t, ask },
    });
  }
  return null;
});

export const MathUpperUnit07 = {
  templates: [dice, urn, choose, binomialEqual, binomialCumulative, expectation, table, conditional, independence, bayes],
  binomial,
  pmf,
  value,
};
