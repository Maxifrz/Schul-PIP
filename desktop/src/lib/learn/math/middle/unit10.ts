// Unit 10, Wahrscheinlichkeit: Laplace-Wahrscheinlichkeit, relative Häufigkeit and what a probability can be (lesson 1),
// Gegenereignis, two dice, expected counts and the product rule with replacement (2), drawing without replacement,
// the sum rule over two paths and "mindestens einmal" (3). A port of MathMiddleUnit10.swift.
//
// Every answer is a probability in lowest terms; a typed answer accepts a fraction or a decimal by value.

import { decimals, type Gen, numberProblem, type Problem, Q, S, template, textProblem } from './core';
import * as T from './text';

const q = Q.of;

export const templates = [
  template('u10.dieEvent', 1, ['choice', 'typed', 'pairs'], dieEvent),
  template('u10.urn', 1, ['choice', 'typed', 'pairs'], urn),
  template('u10.frequency', 1, ['choice', 'typed'], frequency),
  template('u10.range', 1, ['choice'], range),
  template('u10.complement', 2, ['choice', 'typed', 'pairs'], complement),
  template('u10.twoDice', 2, ['choice', 'typed', 'pairs'], twoDice),
  template('u10.expected', 2, ['choice', 'typed'], expected),
  template('u10.withReplacement', 2, ['choice', 'typed', 'pairs'], withReplacement),
  template('u10.withoutReplacement', 3, ['choice', 'typed', 'pairs'], withoutReplacement),
  template('u10.twoPaths', 3, ['choice', 'typed'], twoPaths),
  template('u10.atLeastOne', 3, ['choice', 'typed'], atLeastOne),
];

const hint = 'Gib das Ergebnis als Bruch oder Dezimalzahl an.';

const f = (x: Q): string => T.fraction(x);

/** The candidates that can be a probability that is neither impossible nor certain. */
const probs = (candidates: Q[]): Q[] => candidates.filter((c) => c.ok && c.gt(q(0)) && c.lt(q(1)));

function prob(o: { prompt: string; answer: Q; wrong: Q[]; pair?: string | null; solution: string; explanation: string }): Problem | null {
  if (!o.answer.ok || !o.answer.gt(q(0)) || !o.answer.lt(q(1))) return null;
  const problem = numberProblem({
    prompt: o.prompt,
    answer: o.answer,
    style: S.fraction,
    hint,
    wrong: probs(o.wrong),
    pair: o.pair ?? null,
    solution: o.solution,
    explanation: o.explanation,
  });
  if (problem) problem.pairPrompt = 'Berechne die Wahrscheinlichkeit und ordne zu.';
  return problem;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i < n; i++) if (n % i === 0) return false;
  return true;
}

const colors = ['rote', 'blaue', 'grüne', 'gelbe'];

const sumOf = (list: number[]): number => list.reduce((a, b) => a + b, 0);

// Lesson 1

/** One throw of a die: favourable numbers over all numbers. */
function dieEvent(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => dieEventAttempt(level, gen));
}

function dieEventAttempt(level: number, gen: Gen): Problem | null {
  const sides = level === 1 ? 6 : level === 2 ? gen.pick([6, 8]) : gen.pick([8, 12, 20]);
  const k = gen.int(2, sides - 2);
  const m = gen.pick([2, 3, 4, 5]);
  const events: { phrase: string; test: (n: number) => boolean }[] = [
    { phrase: `größer als ${k}`, test: (n) => n > k },
    { phrase: `kleiner als ${k}`, test: (n) => n < k },
    { phrase: 'gerade', test: (n) => n % 2 === 0 },
    { phrase: 'ungerade', test: (n) => n % 2 === 1 },
  ];
  if (level >= 2) {
    events.push({ phrase: 'eine Primzahl', test: (n) => isPrime(n) });
    events.push({ phrase: `durch ${m} teilbar`, test: (n) => n % m === 0 });
  }
  const event = gen.pick(events);
  const favourable: number[] = [];
  for (let i = 1; i <= sides; i++) if (event.test(i)) favourable.push(i);
  const fav = favourable.length;
  if (!(fav >= 1 && fav < sides)) return null;
  const answer = q(fav, sides);
  const die = sides === 6 ? 'Ein Würfel' : `Ein Würfel mit den Zahlen 1 bis ${sides}`;
  const listedText = fav <= 8 ? favourable.map(String).join(', ') : `${fav} Zahlen`;
  return prob({
    prompt: `${die} wird einmal geworfen.\nWie groß ist die Wahrscheinlichkeit, dass die Zahl ${event.phrase} ist?`,
    answer,
    wrong: [q(fav, sides - fav), q(fav + 1, sides), q(fav - 1, sides), q(sides - fav, sides)],
    pair: `Zahl ${event.phrase}, 1 bis ${sides}`,
    solution: `Günstig: ${listedText}. Das sind ${fav} von ${sides} Zahlen: P = ${fav}/${sides} = ${f(answer)}`,
    explanation: 'Bei gleich wahrscheinlichen Ergebnissen gilt P = günstige Ergebnisse : alle Ergebnisse. Zähle die günstigen Zahlen einzeln ab.',
  });
}

/** Drawing one ball from a bag. */
function urn(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => urnAttempt(level, gen));
}

function urnAttempt(level: number, gen: Gen): Problem | null {
  const kinds = level === 1 ? 2 : level === 2 ? 3 : gen.pick([3, 4]);
  const counts: number[] = [];
  for (let i = 0; i < kinds; i++) counts.push(gen.level(level, [1, 5], [1, 6], [2, 8]));
  const total = sumOf(counts);
  if (!(total <= 24)) return null;
  const names = colors.slice(0, kinds);
  const combined = level === 3 && gen.chance(50);
  const first = gen.int(0, kinds - 1);
  let second = (first + gen.int(1, kinds - 1)) % kinds;
  if (second === first) second = (first + 1) % kinds;
  const chosen = combined ? [first, second].sort((a, b) => a - b) : [first];
  const fav = sumOf(chosen.map((i) => counts[i]));
  if (!(fav < total)) return null;
  const contents = T.listed(counts.map((c, i) => `${c} ${names[i]}`).slice(0, Math.min(counts.length, names.length)));
  const askedColor = chosen.map((i) => names[i]).join(' oder ');
  const askedNoun = combined ? `eine ${chosen.map((i) => names[i].slice(0, -1) + 'e').join(' oder eine ')}` : `eine ${names[first]}`;
  const wrong = [q(fav, total - fav), q(total - fav, total), q(1, kinds), q(counts[chosen[0]], total), q(counts[first], counts[second])];
  return prob({
    prompt: `In einem Beutel liegen ${contents} Kugeln. Du ziehst eine Kugel, ohne hinzusehen.\nWie groß ist die Wahrscheinlichkeit für ${askedNoun} Kugel?`,
    answer: q(fav, total),
    wrong,
    pair: `${counts.map(String).join('/')} Kugeln: ${askedColor}`,
    solution: `Insgesamt ${total} Kugeln, davon ${fav} günstig: P = ${fav}/${total} = ${f(q(fav, total))}`,
    explanation: 'Die Wahrscheinlichkeit ist die Zahl der günstigen Kugeln geteilt durch die Zahl aller Kugeln im Beutel, nicht geteilt durch die Zahl der übrigen Kugeln.',
  });
}

/** Relative frequency: hits over trials, as a decimal. */
function frequency(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => frequencyAttempt(level, gen));
}

function frequencyAttempt(level: number, gen: Gen): Problem | null {
  const n = level === 1 ? gen.pick([10, 20, 50, 100]) : level === 2 ? gen.pick([20, 25, 40, 50, 200]) : gen.pick([8, 16, 40, 125, 250]);
  const k = gen.int(1, n - 1);
  const value = q(k, n);
  const contexts = [
    `Eine Reißzwecke wird ${n}-mal geworfen und landet ${k}-mal auf dem Rücken.`,
    `Ein Basketballspieler wirft ${n}-mal auf den Korb und trifft ${k}-mal.`,
    `Bei ${n} Würfen einer Münze fällt ${k}-mal Kopf.`,
    `Von ${n} geprüften Bauteilen sind ${k} defekt.`,
  ];
  const wrong = decimals([q(k, n - k), q(n - k, n), q(k, 100), q(k + 1, n), q(k - 1, n)], 3).filter((w) => w.lt(q(1)) && w.gt(q(0)));
  const problem = numberProblem({
    prompt: `${gen.pick(contexts)}\nWie groß ist die relative Häufigkeit des Ereignisses?`,
    answer: value,
    hint: 'Gib das Ergebnis als Dezimalzahl oder Bruch an.',
    wrong,
    solution: `Relative Häufigkeit = Treffer : Versuche = ${k} : ${n} = ${T.number(value)}`,
    explanation: 'Die relative Häufigkeit ist die Zahl der Treffer geteilt durch die Zahl aller Versuche.',
  });
  if (problem && problem.typed) problem.typed.text = T.number(value);
  return problem;
}

/** Which number can not be a probability. */
function range(level: number, gen: Gen): Problem | null {
  let invalidPool: string[];
  switch (level) {
    case 1:
      invalidPool = ['1,5', '−0,2', '2', '−3', '1,2', '−0,4'];
      break;
    case 2:
      invalidPool = ['7/6', '120 %', '−1/4', '3/2', '5/4', '150 %'];
      break;
    default:
      invalidPool = ['101 %', '1,01', '9/8', '−3/100', '11/10', '−0,01'];
  }
  const valid = gen.shuffled(['0', '1', '0,35', '3/5', '7/8', '25 %', '100 %', '9/10', '1/100', '1/3', '0,5', '2/7']);
  const wrong = valid.slice(0, 3);
  const correct = gen.pick(invalidPool);
  return textProblem({
    prompt: 'Welche dieser Zahlen kann keine Wahrscheinlichkeit sein?',
    correct,
    wrong,
    solution: `${correct} liegt nicht zwischen 0 und 1 (0 % und 100 %).`,
    explanation: 'Eine Wahrscheinlichkeit liegt immer zwischen 0 und 1, also zwischen 0 % und 100 %. Negative Zahlen und Zahlen über 1 sind nie möglich.',
  });
}

// Lesson 2

/** P(not E) = 1 − P(E), as a fraction, as a percentage or for a neither-nor. */
function complement(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => complementAttempt(level, gen));
}

function complementAttempt(level: number, gen: Gen): Problem | null {
  const events: [string, string][] = [
    ['Der Bus ist pünktlich', 'Der Bus ist nicht pünktlich'],
    ['Das Los gewinnt', 'Das Los gewinnt nicht'],
    ['Es regnet morgen', 'Es regnet morgen nicht'],
    ['Ein Bauteil ist fehlerfrei', 'Ein Bauteil ist fehlerhaft'],
  ];
  const event = gen.pick(events);
  if (level === 3 && gen.chance(60)) {
    const a = q(1, gen.pick([4, 5, 6]));
    const b = q(1, gen.pick([3, 4, 10]));
    const answer = q(1).minus(a).minus(b);
    return prob({
      prompt: `Auf einem Glücksrad ist die Wahrscheinlichkeit für Rot ${f(a)} und für Blau ${f(b)}.\nWie groß ist die Wahrscheinlichkeit, dass weder Rot noch Blau kommt?`,
      answer,
      wrong: [q(1).minus(a), q(1).minus(b), a.plus(b), a.times(b)],
      pair: `weder Rot (${f(a)}) noch Blau (${f(b)})`,
      solution: `Rot oder Blau: ${f(a)} + ${f(b)} = ${f(a.plus(b))}; Gegenereignis: 1 ${T.minus} ${f(a.plus(b))} = ${f(answer)}`,
      explanation: 'Erst die Wahrscheinlichkeit für „Rot oder Blau“ addieren, dann das Gegenereignis mit 1 minus diesem Wert bilden.',
    });
  }
  if (level >= 2 && gen.chance(40)) {
    const p = level === 2 ? 5 * gen.int(1, 19) : gen.int(1, 99);
    if (p === 50) return null;
    const problem = numberProblem({
      prompt: `${event[0]} mit einer Wahrscheinlichkeit von ${p} %.\nWie groß ist die Wahrscheinlichkeit des Gegenereignisses („${event[1]}“) in Prozent?`,
      answer: q(100 - p),
      style: S.percent,
      hint: 'Gib nur die Prozentzahl an.',
      wrong: [q(p), q(100 + p), q(p, 100)],
      solution: `100 % ${T.minus} ${p} % = ${100 - p} %`,
      explanation: 'Ein Ereignis und sein Gegenereignis ergeben zusammen 100 %, also P(nicht E) = 100 % − P(E).',
    });
    if (problem) problem.pairFront = `Gegenereignis zu ${p} %`;
    return problem;
  }
  const b = gen.pick(level === 1 ? [5, 8, 10] : [6, 12, 20, 25]);
  const a = gen.int(1, b - 1);
  const value = q(a, b);
  if (!(T.gcd(a, b) === 1 || level === 1)) return null;
  const answer = q(1).minus(value);
  return prob({
    prompt: `${event[0]} mit der Wahrscheinlichkeit ${f(value)}.\nWie groß ist die Wahrscheinlichkeit, dass das nicht der Fall ist?`,
    answer,
    wrong: [value, q(b - a, a), q(b, b - a), value.times(value)],
    pair: `P(E) = ${f(value)}, P(nicht E)`,
    solution: `P(nicht E) = 1 ${T.minus} ${f(value)} = ${f(answer)}`,
    explanation: 'Das Gegenereignis ergänzt E zu 1: P(nicht E) = 1 − P(E).',
  });
}

/** Two dice thrown together: 36 equally likely pairs, counted one by one. */
function twoDice(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => twoDiceAttempt(level, gen));
}

interface DiceEvent {
  name: string;
  test: (a: number, b: number) => boolean;
  isSum: boolean;
}

function twoDiceAttempt(level: number, gen: Gen): Problem | null {
  const s = gen.int(3, 11);
  let events: DiceEvent[];
  switch (level) {
    case 1:
      events = [
        { name: `Die Augensumme ist ${s}`, test: (a, b) => a + b === s, isSum: true },
        { name: 'Beide Würfel zeigen dieselbe Zahl', test: (a, b) => a === b, isSum: false },
      ];
      break;
    case 2: {
      const t = gen.int(5, 9);
      events = [
        { name: `Die Augensumme ist mindestens ${t}`, test: (a, b) => a + b >= t, isSum: false },
        { name: `Die Augensumme ist höchstens ${t}`, test: (a, b) => a + b <= t, isSum: false },
        { name: 'Beide Zahlen sind gerade', test: (a, b) => a % 2 === 0 && b % 2 === 0, isSum: false },
        { name: 'Mindestens ein Würfel zeigt eine 6', test: (a, b) => a === 6 || b === 6, isSum: false },
        { name: `Die Augensumme ist ${s}`, test: (a, b) => a + b === s, isSum: true },
      ];
      break;
    }
    default: {
      const product = gen.pick([6, 8, 12, 4, 10]);
      events = [
        { name: `Das Produkt der Zahlen ist ${product}`, test: (a, b) => a * b === product, isSum: false },
        { name: 'Das Produkt der Zahlen ist gerade', test: (a, b) => (a * b) % 2 === 0, isSum: false },
        { name: 'Die Zahlen unterscheiden sich um genau 2', test: (a, b) => Math.abs(a - b) === 2, isSum: false },
        { name: 'Die Zahlen sind verschieden', test: (a, b) => a !== b, isSum: false },
        { name: 'Die Augensumme ist eine Primzahl', test: (a, b) => isPrime(a + b), isSum: false },
      ];
    }
  }
  const event = gen.pick(events);
  let count = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (event.test(a, b)) count += 1;
  if (!(count >= 1 && count < 36)) return null;
  const answer = q(count, 36);
  const wrong = [q(count, 12), q(count, 6), q(count + 1, 36), q(count - 1, 36), q(count, 36 - count)];
  if (event.isSum) wrong.unshift(q(1, 11));
  return prob({
    prompt: `Zwei Würfel werden geworfen.\nWie groß ist die Wahrscheinlichkeit? ${event.name}.`,
    answer,
    wrong,
    pair: event.name,
    solution: `Von den 36 gleich wahrscheinlichen Paaren sind ${count} günstig: P = ${count}/36 = ${f(answer)}`,
    explanation:
      'Zwei Würfel haben 6 · 6 = 36 gleich wahrscheinliche Paare. Die Summen 2 bis 12 sind nicht gleich wahrscheinlich, weil unterschiedlich viele Paare zu ihnen gehören.',
  });
}

/** Expected number of successes: probability times number of trials. */
function expected(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => expectedAttempt(level, gen));
}

function expectedAttempt(level: number, gen: Gen): Problem | null {
  let p: Q;
  let shown: string;
  let n: number;
  if (level === 3) {
    const percent = gen.pick([5, 10, 12, 15, 20, 35, 40, 45, 60]);
    p = q(percent, 100);
    shown = `${percent} %`;
    n = gen.pick([100, 200, 400, 500]);
  } else {
    const den = level === 1 ? gen.pick([2, 4, 5, 10]) : gen.pick([3, 6, 8, 10, 12]);
    const numerator = level === 1 ? 1 : gen.int(1, den - 1);
    p = q(numerator, den);
    shown = f(p);
    n = den * (level === 1 ? gen.int(3, 20) : gen.int(2, 12));
  }
  const answer = p.times(n);
  if (!answer.ok || !answer.isWhole || !(answer.numerator >= 1) || !(n >= 8)) return null;
  const wrong = [q(n).minus(answer), answer.times(10), q(n, p.denominator), q(n * p.denominator)];
  const contexts = [
    `Ein Glücksrad gewinnt mit der Wahrscheinlichkeit ${shown}. Es wird ${n}-mal gedreht.`,
    `Ein Spieler trifft mit der Wahrscheinlichkeit ${shown}. Er wirft ${n}-mal.`,
    `Eine Maschine fertigt mit der Wahrscheinlichkeit ${shown} ein fehlerhaftes Teil. Es werden ${n} Teile gefertigt.`,
  ];
  return numberProblem({
    prompt: `${gen.pick(contexts)}\nWie oft ist das Ereignis ungefähr zu erwarten?`,
    answer,
    hint: 'Gib die Anzahl an.',
    wrong: decimals(wrong, 2),
    solution: `Erwartet: ${shown} von ${n} = ${n} · ${shown} = ${T.number(answer)}`,
    explanation: 'Die erwartete Anzahl ist die Wahrscheinlichkeit mal die Zahl der Versuche; tatsächlich weicht das Ergebnis meist etwas davon ab.',
  });
}

/** Two draws with replacement: the first path rule. */
function withReplacement(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => withReplacementAttempt(level, gen));
}

function withReplacementAttempt(level: number, gen: Gen): Problem | null {
  const n = level === 1 ? gen.pick([4, 5, 6]) : level === 2 ? gen.pick([5, 6, 8, 10]) : gen.pick([8, 9, 10, 12]);
  const r = gen.int(1, n - 1);
  const b = n - r;
  const p = q(r, n);
  const qb = q(b, n);
  const kinds = ['rr', 'bb', 'rb'];
  if (level === 3) kinds.push('same');
  const kind = gen.pick(kinds);
  let name: string;
  let answer: Q;
  let wrong: Q[];
  switch (kind) {
    case 'rr':
      name = 'beide Kugeln sind rot';
      answer = p.times(p);
      wrong = [p.plus(p), q(r * (r - 1), n * (n - 1)), p.times(qb), q(r, 2 * n)];
      break;
    case 'bb':
      name = 'beide Kugeln sind blau';
      answer = qb.times(qb);
      wrong = [qb.plus(qb), q(b * (b - 1), n * (n - 1)), p.times(qb), q(b, 2 * n)];
      break;
    case 'rb':
      name = 'die erste Kugel ist rot und die zweite blau';
      answer = p.times(qb);
      wrong = [p.plus(qb), q(r * b, n * (n - 1)), p.times(p), qb.times(qb)];
      break;
    default:
      name = 'beide Kugeln haben dieselbe Farbe';
      answer = p.times(p).plus(qb.times(qb));
      wrong = [p.times(p), qb.times(qb), q(2).times(p).times(qb), p.plus(qb)];
  }
  if (!(r >= 1 && b >= 1 && (r !== b || kind === 'rb' || kind === 'same' || level === 1))) return null;
  const steps =
    kind === 'same'
      ? `${f(p)} · ${f(p)} + ${f(qb)} · ${f(qb)} = ${f(p.times(p))} + ${f(qb.times(qb))} = ${f(answer)}`
      : `${f(kind === 'bb' ? qb : p)} · ${f(kind === 'rb' ? qb : kind === 'bb' ? qb : p)} = ${f(answer)}`;
  return prob({
    prompt: `Im Beutel liegen ${r} rote und ${b} blaue Kugeln. Du ziehst zweimal und legst die Kugel nach jedem Zug zurück.\nWie groß ist die Wahrscheinlichkeit, dass ${name}?`,
    answer,
    wrong,
    pair: `${r} rot, ${b} blau, mit Zurücklegen: ${name}`,
    solution: `Beide Züge haben dieselben Wahrscheinlichkeiten. Pfadregel: ${steps}`,
    explanation: 'Beim Ziehen mit Zurücklegen ändert sich der Beutel nicht. Entlang eines Pfades multiplizierst du die Wahrscheinlichkeiten der Züge.',
  });
}

// Lesson 3

/** Two draws without replacement: the second factor has one ball less. */
function withoutReplacement(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => withoutReplacementAttempt(level, gen));
}

function withoutReplacementAttempt(level: number, gen: Gen): Problem | null {
  const n = level === 1 ? gen.pick([5, 6, 7]) : level === 2 ? gen.pick([6, 8, 9, 10]) : gen.pick([8, 9, 10, 12]);
  const r = gen.int(2, n - 2);
  const b = n - r;
  const kinds = ['rr', 'rb'];
  if (level >= 2) kinds.push('bb');
  if (level === 3) kinds.push('atLeastRed');
  const kind = gen.pick(kinds);
  const m = q(n * (n - 1));
  let name: string;
  let answer: Q;
  let wrong: Q[];
  let steps: string;
  switch (kind) {
    case 'rr':
      name = 'beide Kugeln sind rot';
      answer = q(r * (r - 1)).over(m);
      wrong = [q(r * r, n * n), q(r * r, n * (n - 1)), q(r * (r - 1), n * n), q(r, n).plus(q(r - 1, n - 1))];
      steps = `${r}/${n} · ${r - 1}/${n - 1} = ${f(answer)}`;
      break;
    case 'bb':
      name = 'beide Kugeln sind blau';
      answer = q(b * (b - 1)).over(m);
      wrong = [q(b * b, n * n), q(b * b, n * (n - 1)), q(b * (b - 1), n * n), q(b, n).plus(q(b - 1, n - 1))];
      steps = `${b}/${n} · ${b - 1}/${n - 1} = ${f(answer)}`;
      break;
    case 'rb':
      name = 'die erste Kugel ist rot und die zweite blau';
      answer = q(r * b).over(m);
      wrong = [q(r * b, n * n), q(r * (b - 1), n * (n - 1)), q(r, n).plus(q(b, n - 1)), q(r * b, (n - 1) * (n - 1))];
      steps = `${r}/${n} · ${b}/${n - 1} = ${f(answer)}`;
      break;
    default: {
      name = 'mindestens eine Kugel ist rot';
      const none = q(b * (b - 1)).over(m);
      answer = q(1).minus(none);
      wrong = [none, q(1).minus(q(b * b, n * n)), q(r * (r - 1)).over(m), q(r, n).times(2)];
      steps = `keine rote: ${b}/${n} · ${b - 1}/${n - 1} = ${f(none)}; 1 ${T.minus} ${f(none)} = ${f(answer)}`;
    }
  }
  if (!(answer.gt(q(0)) && answer.lt(q(1)))) return null;
  return prob({
    prompt: `Im Beutel liegen ${r} rote und ${b} blaue Kugeln. Du ziehst zwei Kugeln nacheinander, ohne zurückzulegen.\nWie groß ist die Wahrscheinlichkeit, dass ${name}?`,
    answer,
    wrong,
    pair: `${r} rot, ${b} blau, ohne Zurücklegen: ${name}`,
    solution: `Im zweiten Zug sind nur noch ${n - 1} Kugeln im Beutel: ${steps}`,
    explanation: 'Ohne Zurücklegen sinkt die Zahl der Kugeln im zweiten Zug um eins, und bei gleicher Farbe auch die Zahl der günstigen Kugeln.',
  });
}

/** Two different colours: two paths whose probabilities are added. */
function twoPaths(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => twoPathsAttempt(level, gen));
}

function twoPathsAttempt(level: number, gen: Gen): Problem | null {
  const n = level === 1 ? gen.pick([4, 5, 6]) : level === 2 ? gen.pick([5, 6, 8]) : gen.pick([7, 8, 9, 10]);
  const r = gen.int(1, n - 1);
  const b = n - r;
  const replacing = level === 1 ? true : gen.chance(50);
  const denominator = replacing ? n * n : n * (n - 1);
  const other = replacing ? n * (n - 1) : n * n;
  const one = q(r * b, denominator);
  const answer = q(2).times(one);
  const wrong = [one, q(2 * r * b, other), q(r * r + b * b, denominator), q(r + b, n).times(one)];
  return prob({
    prompt: `Im Beutel liegen ${r} rote und ${b} blaue Kugeln. Du ziehst zweimal ${replacing ? 'und legst die Kugel nach jedem Zug zurück' : 'ohne zurückzulegen'}.\nWie groß ist die Wahrscheinlichkeit für zwei verschiedene Farben?`,
    answer,
    wrong,
    pair: null,
    solution: `Zwei Pfade: rot-blau und blau-rot, beide mit ${f(one)}. Zweite Pfadregel: ${f(one)} + ${f(one)} = ${f(answer)}`,
    explanation: 'Zwei verschiedene Farben können auf zwei Pfaden entstehen (erst rot oder erst blau). Die Wahrscheinlichkeiten der Pfade werden addiert.',
  });
}

/** "At least once" through the complementary event. */
function atLeastOne(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => atLeastOneAttempt(level, gen));
}

function atLeastOneAttempt(level: number, gen: Gen): Problem | null {
  const kind = gen.int(0, 2);
  let p: Q;
  let n: number;
  let event: string;
  switch (kind) {
    case 0:
      p = q(1, 2);
      n = level === 1 ? gen.int(2, 3) : gen.int(3, 5);
      event = `Du wirfst eine Münze ${n}-mal. Wie groß ist die Wahrscheinlichkeit, dass mindestens einmal Kopf fällt?`;
      break;
    case 1:
      p = q(1, 6);
      n = level === 1 ? 2 : gen.int(2, 3);
      event = `Du würfelst ${n}-mal. Wie groß ist die Wahrscheinlichkeit, dass mindestens eine Sechs dabei ist?`;
      break;
    default:
      p = q(1, gen.pick([3, 4, 5]));
      n = level === 1 ? 2 : gen.int(2, 3);
      event = `Ein Glücksrad gewinnt mit der Wahrscheinlichkeit ${f(p)}. Du drehst ${n}-mal. Wie groß ist die Wahrscheinlichkeit für mindestens einen Gewinn?`;
  }
  const miss = q(1).minus(p);
  const none = miss.power(n);
  const answer = q(1).minus(none);
  const wrong = [q(n).times(p), none, q(1).minus(p.power(n)), p.power(n), q(1).minus(miss.times(n)), p];
  return prob({
    prompt: event,
    answer,
    wrong,
    pair: null,
    solution: `Gegenereignis „nie“: ${f(miss)}${T.sup(n)} = ${f(none)}; mindestens einmal: 1 ${T.minus} ${f(none)} = ${f(answer)}`,
    explanation:
      'Bei „mindestens einmal“ rechnest du über das Gegenereignis „kein einziges Mal“ und ziehst von 1 ab. Die Wahrscheinlichkeiten der einzelnen Versuche darfst du nicht einfach addieren.',
  });
}
