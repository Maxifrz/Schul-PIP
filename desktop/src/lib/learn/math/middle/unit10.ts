import { MathGen, Problem, Q, S, Template, decimals, numberProblem, q, template, textProblem } from './core';
import { mathText as T } from './text';

/**
 * Unit 10, Wahrscheinlichkeit: Laplace-Wahrscheinlichkeit, relative Häufigkeit and what a probability can be (lesson 1), Gegenereignis, two dice, expected counts and the product rule with replacement (2), drawing without replacement, the sum rule over two paths and "mindestens einmal" (3).
 *
 * Every answer is a probability in lowest terms; a typed answer accepts a fraction or a decimal by value.
 */

const minus = T.minus;
const hint = 'Gib das Ergebnis als Bruch oder Dezimalzahl an.';
const f = (x: Q): string => T.fraction(x);
const one = q(1);
const zero = q(0);
const range = (low: number, high: number): number[] => Array.from({ length: high - low + 1 }, (_, i) => low + i);

/** The candidates that can be a probability that is neither impossible nor certain. */
const probs = (candidates: Q[]): Q[] => candidates.filter((x) => x.ok && x.greaterThan(zero) && x.lessThan(one));

function prob(p: { prompt: string; answer: Q; wrong: Q[]; pair?: string; solution: string; explanation: string }): Problem | null {
  if (!p.answer.ok || !p.answer.greaterThan(zero) || !p.answer.lessThan(one)) return null;
  const problem = numberProblem({ prompt: p.prompt, answer: p.answer, style: S.fraction, hint, wrong: probs(p.wrong), pair: p.pair, solution: p.solution, explanation: p.explanation });
  if (problem) problem.pairPrompt = 'Berechne die Wahrscheinlichkeit und ordne zu.';
  return problem;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d < n; d++) if (n % d === 0) return false;
  return true;
}

const colors = ['rote', 'blaue', 'grüne', 'gelbe'];

// Lesson 1

function dieEventAttempt(level: number, gen: MathGen): Problem | null {
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
  const favourable = range(1, sides).filter(event.test);
  const fav = favourable.length;
  if (fav < 1 || fav >= sides) return null;
  const answer = q(fav, sides);
  const die = sides === 6 ? 'Ein Würfel' : `Ein Würfel mit den Zahlen 1 bis ${sides}`;
  const listed = fav <= 8 ? favourable.join(', ') : `${fav} Zahlen`;
  return prob({
    prompt: `${die} wird einmal geworfen.\nWie groß ist die Wahrscheinlichkeit, dass die Zahl ${event.phrase} ist?`, answer,
    wrong: [q(fav, sides - fav), q(fav + 1, sides), q(fav - 1, sides), q(sides - fav, sides)], pair: `Zahl ${event.phrase}, 1 bis ${sides}`,
    solution: `Günstig: ${listed}. Das sind ${fav} von ${sides} Zahlen: P = ${fav}/${sides} = ${f(answer)}`,
    explanation: 'Bei gleich wahrscheinlichen Ergebnissen gilt P = günstige Ergebnisse : alle Ergebnisse. Zähle die günstigen Zahlen einzeln ab.',
  });
}

/** One throw of a die: favourable numbers over all numbers. */
const dieEvent = (level: number, gen: MathGen): Problem | null => gen.attempt(() => dieEventAttempt(level, gen));

function urnAttempt(level: number, gen: MathGen): Problem | null {
  const kinds = level === 1 ? 2 : level === 2 ? 3 : gen.pick([3, 4]);
  const counts = range(0, kinds - 1).map(() => gen.level(level, [1, 5], [1, 6], [2, 8]));
  const total = counts.reduce((a, b) => a + b, 0);
  if (total > 24) return null;
  const names = colors.slice(0, kinds);
  const combined = level === 3 && gen.chance(50);
  const first = gen.int(0, kinds - 1);
  let second = (first + gen.int(1, kinds - 1)) % kinds;
  if (second === first) second = (first + 1) % kinds;
  const chosen = combined ? [first, second].sort((a, b) => a - b) : [first];
  const fav = chosen.map((i) => counts[i]).reduce((a, b) => a + b, 0);
  if (fav >= total) return null;
  const contents = T.listed(counts.map((c, i) => `${c} ${names[i]}`));
  const askedColor = chosen.map((i) => names[i]).join(' oder ');
  const askedNoun = combined ? `eine ${chosen.map((i) => `${names[i].slice(0, -1)}e`).join(' oder eine ')}` : `eine ${names[first]}`;
  const wrong = [q(fav, total - fav), q(total - fav, total), q(1, kinds), q(counts[chosen[0]], total), q(counts[first], counts[second])];
  return prob({
    prompt: `In einem Beutel liegen ${contents} Kugeln. Du ziehst eine Kugel, ohne hinzusehen.\nWie groß ist die Wahrscheinlichkeit für ${askedNoun} Kugel?`,
    answer: q(fav, total), wrong, pair: `${counts.join('/')} Kugeln: ${askedColor}`,
    solution: `Insgesamt ${total} Kugeln, davon ${fav} günstig: P = ${fav}/${total} = ${f(q(fav, total))}`,
    explanation: 'Die Wahrscheinlichkeit ist die Zahl der günstigen Kugeln geteilt durch die Zahl aller Kugeln im Beutel, nicht geteilt durch die Zahl der übrigen Kugeln.',
  });
}

/** Drawing one ball from a bag. */
const urn = (level: number, gen: MathGen): Problem | null => gen.attempt(() => urnAttempt(level, gen));

function frequencyAttempt(level: number, gen: MathGen): Problem | null {
  const n = level === 1 ? gen.pick([10, 20, 50, 100]) : level === 2 ? gen.pick([20, 25, 40, 50, 200]) : gen.pick([8, 16, 40, 125, 250]);
  const k = gen.int(1, n - 1);
  const value = q(k, n);
  const contexts = [
    `Eine Reißzwecke wird ${n}-mal geworfen und landet ${k}-mal auf dem Rücken.`,
    `Ein Basketballspieler wirft ${n}-mal auf den Korb und trifft ${k}-mal.`,
    `Bei ${n} Würfen einer Münze fällt ${k}-mal Kopf.`,
    `Von ${n} geprüften Bauteilen sind ${k} defekt.`,
  ];
  const wrong = decimals([q(k, n - k), q(n - k, n), q(k, 100), q(k + 1, n), q(k - 1, n)], 3).filter((x) => x.lessThan(one) && x.greaterThan(zero));
  const problem = numberProblem({
    prompt: `${gen.pick(contexts)}\nWie groß ist die relative Häufigkeit des Ereignisses?`, answer: value, hint: 'Gib das Ergebnis als Dezimalzahl oder Bruch an.', wrong,
    solution: `Relative Häufigkeit = Treffer : Versuche = ${k} : ${n} = ${T.number(value)}`,
    explanation: 'Die relative Häufigkeit ist die Zahl der Treffer geteilt durch die Zahl aller Versuche.',
  });
  if (problem?.typed) problem.typed.text = T.number(value);
  return problem;
}

/** Relative frequency: hits over trials, as a decimal. */
const frequency = (level: number, gen: MathGen): Problem | null => gen.attempt(() => frequencyAttempt(level, gen));

/** Which number can not be a probability. */
function range_(level: number, gen: MathGen): Problem | null {
  const invalidPool = level === 1 ? ['1,5', `${minus}0,2`, '2', `${minus}3`, '1,2', `${minus}0,4`]
    : level === 2 ? ['7/6', '120 %', `${minus}1/4`, '3/2', '5/4', '150 %']
      : ['101 %', '1,01', '9/8', `${minus}3/100`, '11/10', `${minus}0,01`];
  const valid = gen.shuffled(['0', '1', '0,35', '3/5', '7/8', '25 %', '100 %', '9/10', '1/100', '1/3', '0,5', '2/7']);
  const wrong = valid.slice(0, 3);
  const correct = gen.pick(invalidPool);
  return textProblem({
    prompt: 'Welche dieser Zahlen kann keine Wahrscheinlichkeit sein?', correct, wrong, solution: `${correct} liegt nicht zwischen 0 und 1 (0 % und 100 %).`,
    explanation: 'Eine Wahrscheinlichkeit liegt immer zwischen 0 und 1, also zwischen 0 % und 100 %. Negative Zahlen und Zahlen über 1 sind nie möglich.',
  });
}

// Lesson 2

function complementAttempt(level: number, gen: MathGen): Problem | null {
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
    const answer = one.minus(a).minus(b);
    return prob({
      prompt: `Auf einem Glücksrad ist die Wahrscheinlichkeit für Rot ${f(a)} und für Blau ${f(b)}.\nWie groß ist die Wahrscheinlichkeit, dass weder Rot noch Blau kommt?`, answer,
      wrong: [one.minus(a), one.minus(b), a.plus(b), a.times(b)], pair: `weder Rot (${f(a)}) noch Blau (${f(b)})`,
      solution: `Rot oder Blau: ${f(a)} + ${f(b)} = ${f(a.plus(b))}; Gegenereignis: 1 ${minus} ${f(a.plus(b))} = ${f(answer)}`,
      explanation: 'Erst die Wahrscheinlichkeit für „Rot oder Blau“ addieren, dann das Gegenereignis mit 1 minus diesem Wert bilden.',
    });
  }
  if (level >= 2 && gen.chance(40)) {
    const p = level === 2 ? 5 * gen.int(1, 19) : gen.int(1, 99);
    if (p === 50) return null;
    const problem = numberProblem({
      prompt: `${event[0]} mit einer Wahrscheinlichkeit von ${p} %.\nWie groß ist die Wahrscheinlichkeit des Gegenereignisses („${event[1]}“) in Prozent?`, answer: q(100 - p), style: S.percent,
      hint: 'Gib nur die Prozentzahl an.', wrong: [q(p), q(100 + p), q(p, 100)], solution: `100 % ${minus} ${p} % = ${100 - p} %`,
      explanation: 'Ein Ereignis und sein Gegenereignis ergeben zusammen 100 %, also P(nicht E) = 100 % − P(E).',
    });
    if (problem) problem.pairFront = `Gegenereignis zu ${p} %`;
    return problem;
  }
  const b = gen.pick(level === 1 ? [5, 8, 10] : [6, 12, 20, 25]);
  const a = gen.int(1, b - 1);
  const value = q(a, b);
  if (!(T.gcd(a, b) === 1 || level === 1)) return null;
  const answer = one.minus(value);
  return prob({
    prompt: `${event[0]} mit der Wahrscheinlichkeit ${f(value)}.\nWie groß ist die Wahrscheinlichkeit, dass das nicht der Fall ist?`, answer,
    wrong: [value, q(b - a, a), q(b, b - a), value.times(value)], pair: `P(E) = ${f(value)}, P(nicht E)`,
    solution: `P(nicht E) = 1 ${minus} ${f(value)} = ${f(answer)}`, explanation: 'Das Gegenereignis ergänzt E zu 1: P(nicht E) = 1 − P(E).',
  });
}

/** P(not E) = 1 − P(E), as a fraction, as a percentage or for a neither-nor. */
const complement = (level: number, gen: MathGen): Problem | null => gen.attempt(() => complementAttempt(level, gen));

function twoDiceAttempt(level: number, gen: MathGen): Problem | null {
  const s = gen.int(3, 11);
  let events: { name: string; test: (a: number, b: number) => boolean; isSum: boolean }[];
  if (level === 1) {
    events = [
      { name: `Die Augensumme ist ${s}`, test: (a, b) => a + b === s, isSum: true },
      { name: 'Beide Würfel zeigen dieselbe Zahl', test: (a, b) => a === b, isSum: false },
    ];
  } else if (level === 2) {
    const t = gen.int(5, 9);
    events = [
      { name: `Die Augensumme ist mindestens ${t}`, test: (a, b) => a + b >= t, isSum: false },
      { name: `Die Augensumme ist höchstens ${t}`, test: (a, b) => a + b <= t, isSum: false },
      { name: 'Beide Zahlen sind gerade', test: (a, b) => a % 2 === 0 && b % 2 === 0, isSum: false },
      { name: 'Mindestens ein Würfel zeigt eine 6', test: (a, b) => a === 6 || b === 6, isSum: false },
      { name: `Die Augensumme ist ${s}`, test: (a, b) => a + b === s, isSum: true },
    ];
  } else {
    const target = gen.pick([6, 8, 12, 4, 10]);
    events = [
      { name: `Das Produkt der Zahlen ist ${target}`, test: (a, b) => a * b === target, isSum: false },
      { name: 'Das Produkt der Zahlen ist gerade', test: (a, b) => (a * b) % 2 === 0, isSum: false },
      { name: 'Die Zahlen unterscheiden sich um genau 2', test: (a, b) => Math.abs(a - b) === 2, isSum: false },
      { name: 'Die Zahlen sind verschieden', test: (a, b) => a !== b, isSum: false },
      { name: 'Die Augensumme ist eine Primzahl', test: (a, b) => isPrime(a + b), isSum: false },
    ];
  }
  const event = gen.pick(events);
  let count = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (event.test(a, b)) count += 1;
  if (count < 1 || count >= 36) return null;
  const answer = q(count, 36);
  const wrong = [q(count, 12), q(count, 6), q(count + 1, 36), q(count - 1, 36), q(count, 36 - count)];
  if (event.isSum) wrong.unshift(q(1, 11));
  return prob({
    prompt: `Zwei Würfel werden geworfen.\nWie groß ist die Wahrscheinlichkeit? ${event.name}.`, answer, wrong, pair: event.name,
    solution: `Von den 36 gleich wahrscheinlichen Paaren sind ${count} günstig: P = ${count}/36 = ${f(answer)}`,
    explanation: 'Zwei Würfel haben 6 · 6 = 36 gleich wahrscheinliche Paare. Die Summen 2 bis 12 sind nicht gleich wahrscheinlich, weil unterschiedlich viele Paare zu ihnen gehören.',
  });
}

/** Two dice thrown together: 36 equally likely pairs, counted one by one. */
const twoDice = (level: number, gen: MathGen): Problem | null => gen.attempt(() => twoDiceAttempt(level, gen));

function expectedAttempt(level: number, gen: MathGen): Problem | null {
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
  if (!answer.ok || !answer.isWhole || answer.numerator < 1 || n < 8) return null;
  const wrong = [q(n).minus(answer), answer.times(10), q(n, p.denominator), q(n * p.denominator)];
  const contexts = [
    `Ein Glücksrad gewinnt mit der Wahrscheinlichkeit ${shown}. Es wird ${n}-mal gedreht.`,
    `Ein Spieler trifft mit der Wahrscheinlichkeit ${shown}. Er wirft ${n}-mal.`,
    `Eine Maschine fertigt mit der Wahrscheinlichkeit ${shown} ein fehlerhaftes Teil. Es werden ${n} Teile gefertigt.`,
  ];
  return numberProblem({
    prompt: `${gen.pick(contexts)}\nWie oft ist das Ereignis ungefähr zu erwarten?`, answer, hint: 'Gib die Anzahl an.', wrong: decimals(wrong, 2),
    solution: `Erwartet: ${shown} von ${n} = ${n} · ${shown} = ${T.number(answer)}`,
    explanation: 'Die erwartete Anzahl ist die Wahrscheinlichkeit mal die Zahl der Versuche; tatsächlich weicht das Ergebnis meist etwas davon ab.',
  });
}

/** Expected number of successes: probability times number of trials. */
const expected = (level: number, gen: MathGen): Problem | null => gen.attempt(() => expectedAttempt(level, gen));

function withReplacementAttempt(level: number, gen: MathGen): Problem | null {
  const n = level === 1 ? gen.pick([4, 5, 6]) : level === 2 ? gen.pick([5, 6, 8, 10]) : gen.pick([8, 9, 10, 12]);
  const r = gen.int(1, n - 1);
  const b = n - r;
  const p = q(r, n);
  const qq = q(b, n);
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
      wrong = [p.plus(p), q(r * (r - 1), n * (n - 1)), p.times(qq), q(r, 2 * n)];
      break;
    case 'bb':
      name = 'beide Kugeln sind blau';
      answer = qq.times(qq);
      wrong = [qq.plus(qq), q(b * (b - 1), n * (n - 1)), p.times(qq), q(b, 2 * n)];
      break;
    case 'rb':
      name = 'die erste Kugel ist rot und die zweite blau';
      answer = p.times(qq);
      wrong = [p.plus(qq), q(r * b, n * (n - 1)), p.times(p), qq.times(qq)];
      break;
    default:
      name = 'beide Kugeln haben dieselbe Farbe';
      answer = p.times(p).plus(qq.times(qq));
      wrong = [p.times(p), qq.times(qq), p.times(2).times(qq), p.plus(qq)];
  }
  if (!(r >= 1 && b >= 1 && (r !== b || kind === 'rb' || kind === 'same' || level === 1))) return null;
  const steps = kind === 'same'
    ? `${f(p)} · ${f(p)} + ${f(qq)} · ${f(qq)} = ${f(p.times(p))} + ${f(qq.times(qq))} = ${f(answer)}`
    : `${f(kind === 'bb' ? qq : p)} · ${f(kind === 'rb' ? qq : kind === 'bb' ? qq : p)} = ${f(answer)}`;
  return prob({
    prompt: `Im Beutel liegen ${r} rote und ${b} blaue Kugeln. Du ziehst zweimal und legst die Kugel nach jedem Zug zurück.\nWie groß ist die Wahrscheinlichkeit, dass ${name}?`, answer, wrong,
    pair: `${r} rot, ${b} blau, mit Zurücklegen: ${name}`, solution: `Beide Züge haben dieselben Wahrscheinlichkeiten. Pfadregel: ${steps}`,
    explanation: 'Beim Ziehen mit Zurücklegen ändert sich der Beutel nicht. Entlang eines Pfades multiplizierst du die Wahrscheinlichkeiten der Züge.',
  });
}

/** Two draws with replacement: the first path rule. */
const withReplacement = (level: number, gen: MathGen): Problem | null => gen.attempt(() => withReplacementAttempt(level, gen));

// Lesson 3

function withoutReplacementAttempt(level: number, gen: MathGen): Problem | null {
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
      answer = q(r * (r - 1)).div(m);
      wrong = [q(r * r, n * n), q(r * r, n * (n - 1)), q(r * (r - 1), n * n), q(r, n).plus(q(r - 1, n - 1))];
      steps = `${r}/${n} · ${r - 1}/${n - 1} = ${f(answer)}`;
      break;
    case 'bb':
      name = 'beide Kugeln sind blau';
      answer = q(b * (b - 1)).div(m);
      wrong = [q(b * b, n * n), q(b * b, n * (n - 1)), q(b * (b - 1), n * n), q(b, n).plus(q(b - 1, n - 1))];
      steps = `${b}/${n} · ${b - 1}/${n - 1} = ${f(answer)}`;
      break;
    case 'rb':
      name = 'die erste Kugel ist rot und die zweite blau';
      answer = q(r * b).div(m);
      wrong = [q(r * b, n * n), q(r * (b - 1), n * (n - 1)), q(r, n).plus(q(b, n - 1)), q(r * b, (n - 1) * (n - 1))];
      steps = `${r}/${n} · ${b}/${n - 1} = ${f(answer)}`;
      break;
    default: {
      name = 'mindestens eine Kugel ist rot';
      const none = q(b * (b - 1)).div(m);
      answer = one.minus(none);
      wrong = [none, one.minus(q(b * b, n * n)), q(r * (r - 1)).div(m), q(r, n).times(2)];
      steps = `keine rote: ${b}/${n} · ${b - 1}/${n - 1} = ${f(none)}; 1 ${minus} ${f(none)} = ${f(answer)}`;
    }
  }
  if (!answer.greaterThan(zero) || !answer.lessThan(one)) return null;
  return prob({
    prompt: `Im Beutel liegen ${r} rote und ${b} blaue Kugeln. Du ziehst zwei Kugeln nacheinander, ohne zurückzulegen.\nWie groß ist die Wahrscheinlichkeit, dass ${name}?`, answer, wrong,
    pair: `${r} rot, ${b} blau, ohne Zurücklegen: ${name}`, solution: `Im zweiten Zug sind nur noch ${n - 1} Kugeln im Beutel: ${steps}`,
    explanation: 'Ohne Zurücklegen sinkt die Zahl der Kugeln im zweiten Zug um eins, und bei gleicher Farbe auch die Zahl der günstigen Kugeln.',
  });
}

/** Two draws without replacement: the second factor has one ball less. */
const withoutReplacement = (level: number, gen: MathGen): Problem | null => gen.attempt(() => withoutReplacementAttempt(level, gen));

function twoPathsAttempt(level: number, gen: MathGen): Problem | null {
  const n = level === 1 ? gen.pick([4, 5, 6]) : level === 2 ? gen.pick([5, 6, 8]) : gen.pick([7, 8, 9, 10]);
  const r = gen.int(1, n - 1);
  const b = n - r;
  const replacing = level === 1 ? true : gen.chance(50);
  const denominator = replacing ? n * n : n * (n - 1);
  const other = replacing ? n * (n - 1) : n * n;
  const path = q(r * b, denominator);
  const answer = path.times(2);
  const wrong = [path, q(2 * r * b, other), q(r * r + b * b, denominator), q(r + b, n).times(path)];
  return prob({
    prompt: `Im Beutel liegen ${r} rote und ${b} blaue Kugeln. Du ziehst zweimal ${replacing ? 'und legst die Kugel nach jedem Zug zurück' : 'ohne zurückzulegen'}.\nWie groß ist die Wahrscheinlichkeit für zwei verschiedene Farben?`,
    answer, wrong, solution: `Zwei Pfade: rot-blau und blau-rot, beide mit ${f(path)}. Zweite Pfadregel: ${f(path)} + ${f(path)} = ${f(answer)}`,
    explanation: 'Zwei verschiedene Farben können auf zwei Pfaden entstehen (erst rot oder erst blau). Die Wahrscheinlichkeiten der Pfade werden addiert.',
  });
}

/** Two different colours: two paths whose probabilities are added. */
const twoPaths = (level: number, gen: MathGen): Problem | null => gen.attempt(() => twoPathsAttempt(level, gen));

function atLeastOneAttempt(level: number, gen: MathGen): Problem | null {
  const kind = gen.int(0, 2);
  let p: Q;
  let n: number;
  let event: string;
  if (kind === 0) {
    p = q(1, 2);
    n = level === 1 ? gen.int(2, 3) : gen.int(3, 5);
    event = `Du wirfst eine Münze ${n}-mal. Wie groß ist die Wahrscheinlichkeit, dass mindestens einmal Kopf fällt?`;
  } else if (kind === 1) {
    p = q(1, 6);
    n = level === 1 ? 2 : gen.int(2, 3);
    event = `Du würfelst ${n}-mal. Wie groß ist die Wahrscheinlichkeit, dass mindestens eine Sechs dabei ist?`;
  } else {
    p = q(1, gen.pick([3, 4, 5]));
    n = level === 1 ? 2 : gen.int(2, 3);
    event = `Ein Glücksrad gewinnt mit der Wahrscheinlichkeit ${f(p)}. Du drehst ${n}-mal. Wie groß ist die Wahrscheinlichkeit für mindestens einen Gewinn?`;
  }
  const miss = one.minus(p);
  const none = miss.power(n);
  const answer = one.minus(none);
  const wrong = [q(n).times(p), none, one.minus(p.power(n)), p.power(n), one.minus(miss.times(n)), p];
  return prob({
    prompt: event, answer, wrong,
    solution: `Gegenereignis „nie“: ${f(miss)}${T.sup(n)} = ${f(none)}; mindestens einmal: 1 ${minus} ${f(none)} = ${f(answer)}`,
    explanation: 'Bei „mindestens einmal“ rechnest du über das Gegenereignis „kein einziges Mal“ und ziehst von 1 ab. Die Wahrscheinlichkeiten der einzelnen Versuche darfst du nicht einfach addieren.',
  });
}

/** "At least once" through the complementary event. */
const atLeastOne = (level: number, gen: MathGen): Problem | null => gen.attempt(() => atLeastOneAttempt(level, gen));

export const unit10: Template[] = [
  template('u10.dieEvent', 1, dieEvent, ['choice', 'typed', 'pairs']),
  template('u10.urn', 1, urn, ['choice', 'typed', 'pairs']),
  template('u10.frequency', 1, frequency, ['choice', 'typed']),
  template('u10.range', 1, range_, ['choice']),
  template('u10.complement', 2, complement, ['choice', 'typed', 'pairs']),
  template('u10.twoDice', 2, twoDice, ['choice', 'typed', 'pairs']),
  template('u10.expected', 2, expected, ['choice', 'typed']),
  template('u10.withReplacement', 2, withReplacement, ['choice', 'typed', 'pairs']),
  template('u10.withoutReplacement', 3, withoutReplacement, ['choice', 'typed', 'pairs']),
  template('u10.twoPaths', 3, twoPaths, ['choice', 'typed']),
  template('u10.atLeastOne', 3, atLeastOne, ['choice', 'typed']),
];
