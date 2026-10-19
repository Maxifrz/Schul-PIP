import { UCalc } from './calc';
import { UAsk, UBinom, UFact, UGen, UPairs, UProblem, UQ, UTable, UTemplate, UText, UUrn, choiceProblem, numeric, tableTotal, uq, utemplate } from './core';

/** Unit 7: stochastics (Laplace, binomial coefficient, binomial distribution, expectation, conditional probability). */

const germanTwoDecimals = '(Antworte als Bruch oder Dezimalzahl.)';

/** A probability question: typed as a fraction or decimal, chosen from the same forms. */
function probability(p: { key: string; prompt: string; answer: UQ; wrongs: UQ[]; solution: string; explanation: string; fact: UFact }): UProblem | null {
  const { answer } = p;
  return numeric({
    key: p.key, prompt: p.prompt, hint: germanTwoDecimals, answer, wrongs: p.wrongs.filter((w) => !w.lessThan(UQ.zero) && !UQ.one.lessThan(w)),
    solution: `${p.solution} Ergebnis: ${answer.fraction}${answer.isInt || answer.fraction === answer.typed ? '' : ` = ${answer.text}`}.`, explanation: p.explanation, fact: p.fact,
  });
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  if (k > 0) for (let i = 1; i <= Math.max(k, 1); i++) result = Math.trunc((result * (n - k + i)) / i);
  return result;
}

export const pmf = (n: number, p: UQ, k: number): UQ => uq(binomial(n, k)).times(p.power(k)).times(UQ.one.minus(p).power(n - k));

const range = (low: number, high: number): number[] => Array.from({ length: Math.max(0, high - low + 1) }, (_, i) => low + i);
const bracket = (n: number): string => (n < 0 ? `(${UText.signed(n)})` : `${n}`);

// Laplace

type DiceKind = { k: 'single' | 'atLeast' | 'atMost' | 'doubleOrSum'; v: number } | { k: 'even' };

const dice = utemplate('s.dice', (lv, g) => {
  let kind: DiceKind;
  switch (lv) {
    case 1: kind = { k: 'single', v: g.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) }; break;
    case 2: kind = g.pick<DiceKind>([{ k: 'atLeast', v: g.int(9, 11) }, { k: 'atMost', v: g.int(3, 5) }, { k: 'single', v: 7 }]); break;
    default: kind = g.pick<DiceKind>([{ k: 'even' }, { k: 'doubleOrSum', v: g.int(2, 3) }, { k: 'atLeast', v: g.int(7, 8) }]);
  }
  let sums: number[];
  let text: string;
  switch (kind.k) {
    case 'single': sums = [kind.v]; text = `die Augensumme ${kind.v} ist`; break;
    case 'atLeast': sums = range(kind.v, 12); text = `die Augensumme mindestens ${kind.v} ist`; break;
    case 'atMost': sums = range(2, kind.v); text = `die Augensumme höchstens ${kind.v} ist`; break;
    case 'even': sums = [2, 4, 6, 8, 10, 12]; text = 'die Augensumme gerade ist'; break;
    default: sums = [kind.v, 14 - kind.v]; text = `die Augensumme ${kind.v} oder ${14 - kind.v} ist`;
  }
  let count = 0;
  for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) if (sums.includes(x + y)) count += 1;
  const answer = uq(count, 36);
  const wrongs = [uq(sums.length, 11), uq(count, 12), uq(count + 1, 36), uq(count - 1, 36), uq(sums.length, 36), uq(count, 6)];
  return probability({
    key: `s.dice|${sums}`, prompt: `Zwei faire Würfel werden geworfen. Wie groß ist die Wahrscheinlichkeit, dass ${text}?`, answer, wrongs,
    solution: `Laplace: günstige Fälle durch mögliche Fälle. Es gibt 6·6 = 36 gleich wahrscheinliche Paare, davon ${count} günstige: ${count}/36.`,
    explanation: 'Die Augensummen sind nicht gleich wahrscheinlich; zähle die Würfelpaare, nicht die Summen.', fact: { k: 'laplaceDice', sums },
  });
});

const urn = utemplate('s.urn', (lv, g) => {
  const red = g.int(2, 6);
  const blue = g.int(2, 6);
  const n = red + blue;
  const mode: UUrn = lv === 1 ? 'oneRed' : lv === 2 ? 'twoRedWith' : g.pick<UUrn>(['twoRedWithout', 'differentWithout']);
  let answer: UQ;
  let wrongs: UQ[];
  let prompt: string;
  let solution: string;
  const r = uq(red, n);
  switch (mode) {
    case 'oneRed':
      answer = r;
      wrongs = [uq(red, blue), uq(blue, n), uq(1, n), uq(red, 2 * n)];
      prompt = `In einer Urne liegen ${red} rote und ${blue} blaue Kugeln. Wie groß ist die Wahrscheinlichkeit, eine rote Kugel zu ziehen?`;
      solution = `${red} günstige von ${n} möglichen Kugeln.`;
      break;
    case 'twoRedWith':
      answer = r.times(r);
      wrongs = [r.plus(r), uq(red, n).times(uq(red - 1, n - 1)), uq(2 * red, n), uq(red * red, n)];
      prompt = `In einer Urne liegen ${red} rote und ${blue} blaue Kugeln. Du ziehst zwei Kugeln mit Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zweimal rot?`;
      solution = `Mit Zurücklegen bleibt die Urne gleich: ${red}/${n} · ${red}/${n}.`;
      break;
    case 'twoRedWithout':
      answer = r.times(uq(red - 1, n - 1));
      wrongs = [r.times(r), uq(red - 1, n - 1), r.plus(uq(red - 1, n - 1)), uq(red * (red - 1), n * n)];
      prompt = `In einer Urne liegen ${red} rote und ${blue} blaue Kugeln. Du ziehst zwei Kugeln ohne Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zweimal rot?`;
      solution = `Beim zweiten Zug sind nur noch ${red - 1} rote unter ${n - 1} Kugeln: ${red}/${n} · ${red - 1}/${n - 1}.`;
      break;
    default:
      answer = uq(2 * red * blue, n * (n - 1));
      wrongs = [r.times(uq(blue, n - 1)), uq(red * blue, n * n), uq(2 * red * blue, n * n), uq(blue, n - 1)];
      prompt = `In einer Urne liegen ${red} rote und ${blue} blaue Kugeln. Du ziehst zwei Kugeln ohne Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zwei verschiedene Farben?`;
      solution = `Rot dann blau oder blau dann rot: 2 · ${red}/${n} · ${blue}/${n - 1}.`;
  }
  return probability({
    key: `s.urn|${red}|${blue}|${mode}`, prompt, answer, wrongs, solution,
    explanation: 'Ohne Zurücklegen ändern sich Zähler und Nenner nach dem ersten Zug; mit Zurücklegen nicht.', fact: { k: 'urn', red, blue, mode },
  });
});

function choosePairs(_level: number, g: UGen): UPairs | null {
  const items: UPairs = [];
  const fronts = new Set<string>();
  const backs = new Set<number>();
  for (let i = 0; i < 80 && items.length < 4; i++) {
    const n = g.int(4, 9);
    const k = g.int(1, n - 1);
    const value = binomial(n, k);
    const key = `${Math.min(k, n - k)}|${n}`;
    if (!fronts.has(key) && !backs.has(value)) {
      fronts.add(key);
      backs.add(value);
      items.push({ front: `${n} über ${k}`, back: `${value}` });
    }
  }
  return items.length === 4 ? items : null;
}

const choose = utemplate('s.choose', (lv, g) => {
  const n = lv === 1 ? g.int(3, 6) : lv === 2 ? g.int(5, 9) : g.int(8, 12);
  const k = lv === 1 ? g.int(1, 2) : g.int(0, n);
  const value = binomial(n, k);
  let falling = 1;
  for (let i = 0; i < k; i++) falling *= n - i;
  const wrongs = UCalc.differing([uq(n * k), uq(binomial(n, k + 1)), uq(binomial(n + 1, k)), uq(falling), uq(binomial(n, k - 1)), uq(n - k)], uq(value));
  return numeric({
    key: `s.choose|${n}|${k}`, prompt: `Berechne ${n} über ${k}.`, answer: uq(value), wrongs,
    solution: `${n} über ${k} = ${n}!/(${k}!·${n - k}!) = ${value}. Probe mit der Symmetrie: ${n} über ${n - k} ist ebenfalls ${value}.`,
    explanation: 'n über k zählt, auf wie viele Arten man k aus n auswählt, ohne auf die Reihenfolge zu achten: Es gilt (n über k) = (n über n−k).', fact: { k: 'choose', n, kk: k },
  });
}, choosePairs);

// Binomial distribution

function parameters(g: UGen, level: number): { n: number; p: UQ } {
  switch (level) {
    case 1: return { n: g.int(3, 4), p: uq(1, 2) };
    case 2: return { n: g.int(3, 5), p: g.pick([uq(1, 2), uq(1, 10), uq(1, 5), uq(1, 4)]) };
    default: return { n: g.int(4, 6), p: g.pick([uq(3, 10), uq(1, 5), uq(1, 4), uq(7, 10), uq(3, 4), uq(2, 5)]) };
  }
}

const binomialEqual = utemplate('s.pmf', (lv, g) => {
  const { n, p } = parameters(g, lv);
  const k = lv === 1 ? g.pick([0, n]) : g.int(0, n);
  const q = UQ.one.minus(p);
  const answer = pmf(n, p, k);
  const wrongs = [
    p.power(k).times(q.power(n - k)), p.power(k), uq(binomial(n, k)).times(p.power(k)), uq(binomial(n, k)).times(q.power(k)).times(p.power(n - k)),
    uq(binomial(n, k)).times(p.power(k)).times(q.power(n - k + 1)), uq(binomial(n, k), 2).times(p.power(k)),
  ];
  return probability({
    key: `s.pmf|${n}|${p.fraction}|${k}`, prompt: `X ist binomialverteilt mit n = ${n} und p = ${p.text}. Berechne P(X = ${k}).`, answer, wrongs,
    solution: `P(X = ${k}) = (${n} über ${k}) · ${p.fraction}^${k} · ${q.fraction}^${n - k} = ${binomial(n, k)} · ${p.power(k).fraction} · ${q.power(n - k).fraction}.`,
    explanation: 'Bernoulli-Formel: P(X = k) = (n über k) · pᵏ · (1−p)ⁿ⁻ᵏ; der Binomialkoeffizient zählt die Anordnungen der Treffer.', fact: { k: 'binomial', n, p, kind: { k: 'equal', v: k } },
  });
});

const binomialCumulative = utemplate('s.cum', (lv, g) => {
  const { n, p } = parameters(g, Math.max(lv, 2));
  const q = UQ.one.minus(p);
  const k = g.int(1, n - 1);
  const variants = lv === 1 ? 1 : 3;
  const variant = g.int(0, variants);
  let answer: UQ;
  let text: string;
  let wrongs: UQ[];
  let kind: UBinom;
  const sum = (low: number, high: number): UQ => range(low, high).reduce((total, i) => total.plus(pmf(n, p, i)), UQ.zero);
  switch (variant) {
    case 0:
      answer = sum(0, k); text = `P(X ≤ ${k})`; kind = { k: 'atMost', v: k };
      wrongs = [pmf(n, p, k), sum(0, k - 1), UQ.one.minus(sum(0, k)), sum(0, k + 1)];
      break;
    case 1:
      answer = UQ.one.minus(q.power(n)); text = 'die Wahrscheinlichkeit für mindestens einen Treffer'; kind = { k: 'atLeastOne' };
      wrongs = [p.power(n), q.power(n), uq(n).times(p), UQ.one.minus(p.power(n))];
      break;
    case 2:
      answer = sum(k, n); text = `P(X ≥ ${k})`; kind = { k: 'atLeast', v: k };
      wrongs = [UQ.one.minus(sum(0, k)), sum(0, k), pmf(n, p, k), sum(k + 1, n)];
      break;
    default:
      answer = sum(0, k - 1); text = `P(X < ${k})`; kind = { k: 'atMost', v: k - 1 };
      wrongs = [sum(0, k), pmf(n, p, k), UQ.one.minus(sum(0, k - 1)), pmf(n, p, k - 1)];
  }
  let sol: string;
  switch (variant) {
    case 1: sol = `Gegenereignis: 1 − P(kein Treffer) = 1 − ${q.fraction}^${n}.`; break;
    case 2: sol = `P(X ≥ ${k}) = 1 − P(X ≤ ${k - 1}) oder die Summe von P(X = ${k}) bis P(X = ${n}).`; break;
    case 3: sol = `P(X < ${k}) = P(X ≤ ${k - 1}): addiere P(X = 0) bis P(X = ${k - 1}).`; break;
    default: sol = `Addiere P(X = 0) bis P(X = ${k}).`;
  }
  return probability({
    key: `s.cum|${n}|${p.fraction}|${k}|${variant}`,
    prompt: variant === 1 ? `Bei einem Zufallsversuch mit p = ${p.text} wird ${n}-mal unabhängig wiederholt. Wie groß ist ${text}?` : `X ist binomialverteilt mit n = ${n} und p = ${p.text}. Berechne ${text}.`,
    answer, wrongs, solution: sol, explanation: 'Bei „höchstens“ addierst du die Einzelwahrscheinlichkeiten; bei „mindestens“ ist oft das Gegenereignis kürzer.', fact: { k: 'binomial', n, p, kind },
  });
});

function isqrt(n: number): number | null {
  if (n < 0) return null;
  const r = Math.round(Math.sqrt(n));
  return r * r === n ? r : null;
}

function squareRoot(q: UQ): UQ | null {
  const top = isqrt(q.n);
  const bottom = isqrt(q.d);
  return top === null || bottom === null ? null : uq(top, bottom);
}

const expectation = utemplate('s.expect', (lv, g) => {
  if (lv === 1) {
    const p = g.pick([uq(1, 2), uq(1, 4), uq(1, 5), uq(1, 10), uq(3, 10)]);
    const n = p.d * g.int(1, 6);
    const answer = uq(n).times(p);
    return numeric({
      key: `s.expect|np|${n}|${p.fraction}`, prompt: `X ist binomialverteilt mit n = ${n} und p = ${p.text}. Wie groß ist der Erwartungswert E(X)?`, answer,
      wrongs: UCalc.differing([uq(n).div(p), uq(n).plus(p), uq(n).times(UQ.one.minus(p)), p], answer),
      solution: `E(X) = n·p = ${n}·${p.fraction} = ${answer.fraction}.`, explanation: 'Bei einer Binomialverteilung ist der Erwartungswert n·p.', fact: { k: 'expectation', n, p },
    });
  }
  if (lv === 2) {
    const values = [g.int(-3, 0), g.int(1, 4), g.int(5, 10)];
    const tenths = [g.int(1, 5), g.int(1, 4)];
    const last = 10 - tenths[0] - tenths[1];
    if (last < 1) return null;
    const probabilities = [uq(tenths[0], 10), uq(tenths[1], 10), uq(last, 10)];
    const answer = values.reduce((total, v, i) => total.plus(uq(v).times(probabilities[i])), UQ.zero);
    const table = values.map((v, i) => `P(X = ${UText.signed(v)}) = ${probabilities[i].text}`).join('; ');
    const wrongs = [uq(values.reduce((a, b) => a + b, 0), 3), uq(Math.max(...values)), uq(values[0]).times(probabilities[0]).plus(uq(values[1]).times(probabilities[1]))];
    return numeric({
      key: `s.expect|table|${values}|${tenths}`, prompt: `Eine Zufallsgröße X hat die Verteilung ${table}. Berechne E(X).`, answer, wrongs: UCalc.differing(wrongs, answer),
      solution: `E(X) = Σ x · P(X = x) = ${values.map((v, i) => `${bracket(v)}·${probabilities[i].text}`).join(' + ')} = ${answer.text}.`,
      explanation: 'Der Erwartungswert ist die mit den Wahrscheinlichkeiten gewichtete Summe aller Werte.', fact: { k: 'expectationTable', values: values.map((v) => uq(v)), probabilities },
    });
  }
  for (let i = 0; i < 200; i++) {
    const p = g.pick([uq(1, 2), uq(1, 5), uq(1, 4), uq(3, 10), uq(1, 10), uq(3, 4), uq(4, 5)]);
    const n = g.int(4, 200);
    const variance = uq(n).times(p).times(UQ.one.minus(p));
    const root = squareRoot(variance);
    if (!root) continue;
    return numeric({
      key: `s.expect|sigma|${n}|${p.fraction}`, prompt: `X ist binomialverteilt mit n = ${n} und p = ${p.text}. Berechne die Standardabweichung σ.`, answer: root,
      wrongs: UCalc.differing([variance, uq(n).times(p), uq(n).times(UQ.one.minus(p)), root.times(uq(2))], root),
      solution: `σ = √(n·p·(1−p)) = √(${variance.fraction}) = ${root.fraction}.`,
      explanation: 'Die Standardabweichung der Binomialverteilung ist √(n·p·(1−p)); ohne die Wurzel hättest du die Varianz.', fact: { k: 'sigma', n, p },
    });
  }
  return null;
});

// Conditional probability

function randomTable(g: UGen): UTable | null {
  const total = g.pick([100, 100, 200, 1000]);
  for (let i = 0; i < 100; i++) {
    const step = Math.trunc(total / 20);
    const cells = [0, 1, 2].map(() => g.int(1, 6) * step);
    const rest = total - cells.reduce((a, b) => a + b, 0);
    if (rest >= step) return { a: cells[0], b: cells[1], c: cells[2], d: rest };
  }
  return null;
}

export function tableValue(t: UTable, ask: UAsk): UQ {
  const n = tableTotal(t);
  switch (ask) {
    case 'pA': return uq(t.a + t.b, n);
    case 'pB': return uq(t.a + t.c, n);
    case 'pAandB': return uq(t.a, n);
    case 'pAorB': return uq(t.a + t.b + t.c, n);
    case 'pNotAandB': return uq(t.c, n);
    case 'pNotAandNotB': return uq(t.d, n);
    case 'pAgivenB': return uq(t.a, t.a + t.c);
    case 'pBgivenA': return uq(t.a, t.a + t.b);
    case 'pNotBgivenA': return uq(t.b, t.a + t.b);
  }
}

const given = (t: UTable): string => `P(A) = ${tableValue(t, 'pA').text}, P(B) = ${tableValue(t, 'pB').text}, P(A∩B) = ${tableValue(t, 'pAandB').text}`;

const table = utemplate('s.table', (_lv, g) => {
  const t = randomTable(g);
  if (!t) return null;
  const v = (ask: UAsk) => tableValue(t, ask);
  const ask = g.pick<UAsk>(['pAorB', 'pNotAandB', 'pNotAandNotB']);
  const answer = v(ask);
  let name: string;
  let wrong: UQ[];
  let how: string;
  switch (ask) {
    case 'pAorB':
      name = 'P(A∪B)'; wrong = [v('pA').plus(v('pB')), v('pAandB'), v('pA').times(v('pB')), UQ.one.minus(v('pAandB'))];
      how = 'P(A∪B) = P(A) + P(B) − P(A∩B).';
      break;
    case 'pNotAandB':
      name = 'P(¬A∩B)'; wrong = [UQ.one.minus(v('pA')), v('pB'), v('pAandB'), v('pB').plus(v('pAandB'))];
      how = 'P(¬A∩B) = P(B) − P(A∩B).';
      break;
    default:
      name = 'P(¬A∩¬B)'; wrong = [UQ.one.minus(v('pA')).minus(v('pB')), v('pAorB'), UQ.one.minus(v('pA')).times(UQ.one.minus(v('pB'))), UQ.one.minus(v('pAandB'))];
      how = 'P(¬A∩¬B) = 1 − P(A∪B).';
  }
  return probability({
    key: `s.table|${t.a}|${t.b}|${t.c}|${ask}`, prompt: `Für zwei Ereignisse gilt ${given(t)}. Wie groß ist ${name}?`, answer, wrongs: wrong,
    solution: `${how} Mit der Vierfeldertafel: ${answer.text}.`,
    explanation: 'Eine Vierfeldertafel ordnet alle vier Zellen A∩B, A∩¬B, ¬A∩B, ¬A∩¬B; Zeilen- und Spaltensummen liefern die fehlenden Werte.', fact: { k: 'table', t, ask },
  });
});

const conditional = utemplate('s.cond', (lv, g) => {
  for (let i = 0; i < 100; i++) {
    const t = randomTable(g);
    if (!t) continue;
    const v = (ask: UAsk) => tableValue(t, ask);
    const ask = g.pick<UAsk>(lv === 3 ? ['pAgivenB', 'pBgivenA', 'pNotBgivenA'] : ['pAgivenB', 'pBgivenA']);
    const answer = v(ask);
    if (!answer.isNice || (ask === 'pAgivenB' && answer.equals(v('pBgivenA')))) continue;
    let name: string;
    let wrong: UQ[];
    let how: string;
    switch (ask) {
      case 'pAgivenB':
        name = 'P(A|B)'; how = `P(A|B) = P(A∩B) / P(B) = ${v('pAandB').text} / ${v('pB').text}.`;
        wrong = [v('pAandB'), v('pBgivenA'), v('pA'), v('pA').times(v('pB'))];
        break;
      case 'pBgivenA':
        name = 'P(B|A)'; how = `P(B|A) = P(A∩B) / P(A) = ${v('pAandB').text} / ${v('pA').text}.`;
        wrong = [v('pAandB'), v('pAgivenB'), v('pB'), v('pA').times(v('pB'))];
        break;
      default:
        name = 'P(¬B|A)'; how = `P(¬B|A) = 1 − P(B|A) = 1 − ${v('pBgivenA').text}.`;
        wrong = [v('pBgivenA'), v('pAandB'), v('pA').minus(v('pAandB')), UQ.one.minus(v('pAgivenB'))];
    }
    return probability({
      key: `s.cond|${t.a}|${t.b}|${t.c}|${ask}`, prompt: `Für zwei Ereignisse gilt ${given(t)}. Wie groß ist ${name}?`, answer, wrongs: wrong, solution: how,
      explanation: 'Die bedingte Wahrscheinlichkeit teilt P(A∩B) durch die Wahrscheinlichkeit der Bedingung; P(A∩B) und P(A|B) sind verschiedene Größen.', fact: { k: 'table', t, ask },
    });
  }
  return null;
});

const independentText = 'Ja, denn P(A∩B) = P(A)·P(B).';
const greaterText = 'Nein, denn P(A∩B) ist größer als P(A)·P(B).';
const smallerText = 'Nein, denn P(A∩B) ist kleiner als P(A)·P(B).';

/** A table in which A and B are independent: percentages of A and B whose product is a whole percentage. */
function independentTable(g: UGen): UTable | null {
  const shares = [20, 25, 40, 50, 60, 80];
  for (let i = 0; i < 100; i++) {
    const pa = g.pick(shares);
    const pb = g.pick(shares);
    if ((pa * pb) % 100 !== 0) continue;
    const both = Math.trunc((pa * pb) / 100);
    const t = { a: both, b: pa - both, c: pb - both, d: 100 - pa - pb + both };
    if (t.a > 0 && t.b > 0 && t.c > 0 && t.d > 0) return t;
  }
  return null;
}

const independence = utemplate('s.indep', (_lv, g) => {
  let t: UTable | null = null;
  if (g.chance(0.4)) t = independentTable(g);
  if (!t) t = randomTable(g);
  if (!t) return null;
  const pA = tableValue(t, 'pA');
  const pB = tableValue(t, 'pB');
  const both = tableValue(t, 'pAandB');
  const product = pA.times(pB);
  const correct = both.equals(product) ? independentText : product.lessThan(both) ? greaterText : smallerText;
  return choiceProblem({
    key: `s.indep|${t.a}|${t.b}|${t.c}`, prompt: `Für zwei Ereignisse gilt ${given(t)}. Sind A und B stochastisch unabhängig?`, correct, wrong: [independentText, greaterText, smallerText].filter((s) => s !== correct),
    solution: `P(A)·P(B) = ${pA.text}·${pB.text} = ${product.text} und P(A∩B) = ${both.text}. ${correct}`, explanation: 'A und B sind genau dann unabhängig, wenn P(A∩B) = P(A)·P(B) gilt.',
    fact: { k: 'independence', t },
  });
});

const bayes = utemplate('s.bayes', (lv, g) => {
  for (let i = 0; i < 300; i++) {
    const pA = g.pick([uq(1, 10), uq(1, 5), uq(1, 4), uq(2, 5), uq(1, 2)]);
    const pBA = g.pick([uq(1, 2), uq(4, 5), uq(9, 10), uq(3, 4)]);
    const pBn = g.pick([uq(1, 10), uq(1, 5), uq(1, 20), uq(3, 10)]);
    const total = 1000;
    const counts = [pA.times(pBA), pA.times(UQ.one.minus(pBA)), UQ.one.minus(pA).times(pBn), UQ.one.minus(pA).times(UQ.one.minus(pBn))].map((x) => x.times(uq(total)));
    if (!counts.every((x) => x.isInt)) continue;
    const t: UTable = { a: counts[0].n, b: counts[1].n, c: counts[2].n, d: counts[3].n };
    const askPosterior = lv === 3;
    const ask: UAsk = askPosterior ? 'pAgivenB' : 'pB';
    const answer = tableValue(t, ask);
    if (!answer.isNice) continue;
    const wrongs: UQ[] = askPosterior
      ? [pBA, pA.times(pBA), pA, tableValue(t, 'pB'), pBA.div(tableValue(t, 'pB'))]
      : [pA.times(pBA), pBA.plus(pBn), pBn, pBA.plus(pBn).div(uq(2))];
    return probability({
      key: `s.bayes|${pA.fraction}|${pBA.fraction}|${pBn.fraction}|${askPosterior}`,
      prompt: `Im Baumdiagramm gilt P(A) = ${pA.text}, P(B|A) = ${pBA.text} und P(B|¬A) = ${pBn.text}. ${askPosterior ? 'Wie groß ist P(A|B)?' : 'Wie groß ist P(B)?'}`, answer, wrongs,
      solution: askPosterior
        ? `Auf 1000 Fälle: ${t.a} mit A und B, ${t.c} mit ¬A und B. P(A|B) = ${t.a}/${t.a + t.c}.`
        : `Totale Wahrscheinlichkeit: P(B) = P(A)·P(B|A) + P(¬A)·P(B|¬A) = ${t.a + t.c}/1000.`,
      explanation: askPosterior
        ? 'Die gesuchte Wahrscheinlichkeit P(A|B) ist der Anteil von A unter allen Fällen, in denen B eintritt, nicht P(B|A).'
        : 'Alle Pfade, die zu B führen, addierst du; jeder Pfad ist das Produkt seiner Wahrscheinlichkeiten.',
      fact: { k: 'table', t, ask },
    });
  }
  return null;
});

export const unit07: UTemplate[] = [dice, urn, choose, binomialEqual, binomialCumulative, expectation, table, conditional, independence, bayes];
