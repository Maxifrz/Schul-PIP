// Unit 5, Dreisatz und Proportionalität: proportionale Zuordnungen und der Dreisatz (lesson 1), antiproportionale
// Zuordnungen und das Erkennen der Art einer Zuordnung (2), Maßstab und Verhältnisse (3). A port of MathMiddleUnit05.swift.

import { decimals, type Gen, numberProblem, type Problem, positives, Q, R, type Style, S, template, textProblem } from './core';
import * as T from './text';

const q = Q.of;

export const templates = [
  template('u05.proportional', 1, ['choice', 'typed', 'pairs'], proportional),
  template('u05.unitRate', 1, ['choice', 'typed', 'pairs'], unitRate),
  template('u05.factor', 1, ['choice', 'typed', 'pairs'], factor),
  template('u05.antiproportional', 2, ['choice', 'typed', 'pairs'], antiproportional),
  template('u05.tableType', 2, ['choice'], tableType),
  template('u05.situation', 2, ['choice'], situation),
  template('u05.tableFill', 2, ['choice', 'typed', 'pairs'], tableFill),
  template('u05.scale', 3, ['choice', 'typed', 'pairs'], scale),
  template('u05.ratioSplit', 3, ['choice', 'typed', 'pairs'], ratioSplit),
  template('u05.ratioReduce', 3, ['choice', 'typed', 'pairs'], ratioReduce),
];

const valueHint = 'Gib nur die Zahl an.';

const eur = (n: number): string => T.euroAmount(q(n));

const ascending = (list: number[]): number[] => list.slice().sort((a, b) => a - b);

function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}

// Lesson 1

/** "5 Hefte kosten 10 €. Wie viel kosten 8 Hefte?" Through the value of one, then multiplied. */
function proportional(level: number, gen: Gen): Problem | null {
  // 0 to 2 are about money, 3 and 4 about counts and distances; the rates stay what they are in real life.
  const story = level === 3 ? gen.pick([0, 2]) : gen.int(0, 4);
  let n1: number;
  let n2: number;
  let p1: number;
  switch (story) {
    case 0:
    case 2:
      if (level === 3) {
        n1 = gen.pick([2, 4, 5, 10, 20, 25]);
        n2 = gen.int(3, 30);
        p1 = gen.int(3, 45);
      } else {
        n1 = level === 1 ? gen.int(2, 6) : gen.pick([3, 4, 5, 6, 8, 10, 12]);
        n2 = level === 1 ? gen.int(2, 9) : gen.int(2, 15);
        p1 = n1 * (story === 0 ? (level === 1 ? gen.int(2, 9) : gen.int(2, 12)) : level === 1 ? gen.int(2, 6) : gen.int(2, 9));
      }
      break;
    case 1:
      n1 = level === 1 ? gen.int(2, 6) : gen.pick([3, 4, 5, 6, 8]);
      n2 = gen.int(2, 12);
      p1 = n1 * (level === 1 ? gen.int(8, 15) : gen.int(8, 20));
      break;
    case 3:
      n1 = gen.pick([2, 3, 4, 5, 6, 10]);
      n2 = gen.int(2, 12);
      p1 = n1 * gen.int(3, 25);
      break;
    default:
      n1 = gen.int(2, 4);
      n2 = gen.int(2, 8);
      p1 = n1 * gen.pick([30, 40, 50, 60, 80, 90]);
  }
  if (n1 === n2) return null;
  const rate = q(p1, n1);
  const answer = q(p1 * n2, n1);
  if (!answer.ok || decimals([answer, rate], 2).length !== 2) return null;
  let prompt: string;
  let front: string;
  let style: Style;
  let unit: string;
  switch (story) {
    case 0:
      prompt = `${n1} Hefte kosten ${eur(p1)}. Wie viel kosten ${n2} Hefte?`;
      front = `${n1} Hefte = ${eur(p1)}; ${n2} Hefte?`;
      style = S.euro;
      unit = '€';
      break;
    case 1:
      prompt = `Für ${n1} Stunden Arbeit bekommt Jonas ${eur(p1)}. Wie viel bekommt er für ${n2} Stunden?`;
      front = `${n1} h = ${eur(p1)}; ${n2} h?`;
      style = S.euro;
      unit = '€';
      break;
    case 2:
      prompt = `${n1} kg Äpfel kosten ${eur(p1)}. Wie viel kosten ${n2} kg?`;
      front = `${n1} kg = ${eur(p1)}; ${n2} kg?`;
      style = S.euro;
      unit = '€';
      break;
    case 3:
      prompt = `Eine Maschine füllt in ${n1} Minuten ${p1} Flaschen. Wie viele Flaschen füllt sie in ${n2} Minuten?`;
      front = `${n1} min = ${p1} Flaschen; ${n2} min?`;
      style = S.plain;
      unit = '';
      break;
    default:
      prompt = `Ein Zug fährt gleichmäßig ${p1} km in ${n1} Stunden. Wie weit fährt er in ${n2} Stunden?`;
      front = `${p1} km in ${n1} h; ${n2} h?`;
      style = S.unit('km');
      unit = 'km';
  }
  const suffix = unit === '' ? '' : ' ' + unit;
  // The difference added, the rule turned around, the first value multiplied, only the value of one.
  const wrong = positives(decimals([q(p1 + n2 - n1), q(p1 * n1, n2), q(p1 * n2), rate], 2));
  const problem = numberProblem({
    prompt,
    answer,
    style,
    hint: valueHint,
    wrong,
    pair: front,
    solution: `Für 1: ${p1} : ${n1} = ${T.number(rate)}${suffix}; für ${n2}: ${T.number(rate)} · ${n2} = ${T.number(answer)}${suffix}`,
    explanation:
      'Beim Dreisatz rechnest du erst auf die Einheit (durch die bekannte Anzahl teilen) und dann auf die gesuchte Anzahl (malnehmen). Doppelt so viel gehört zum Doppelten.',
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Aufgabe den gesuchten Wert zu.';
  return problem;
}

/** "Wie viel kostet 1 kg, wenn 4 kg 10 € kosten?" The value of one. */
function unitRate(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => unitRateAttempt(level, gen));
}

function unitRateAttempt(level: number, gen: Gen): Problem | null {
  const story = gen.int(0, 2);
  let n: number;
  let total: number;
  if (level === 1) {
    if (story === 0) {
      n = gen.int(2, 6);
      total = n * gen.int(2, 9);
    } else if (story === 1) {
      n = gen.int(2, 6);
      total = n * gen.int(8, 25);
    } else {
      n = gen.int(2, 6);
      total = n * gen.int(2, 9);
    }
  } else if (level === 2) {
    if (story === 0) {
      n = gen.pick([2, 4, 5, 10]);
      total = gen.int(5, 80);
    } else if (story === 1) {
      n = gen.pick([2, 4, 5]);
      total = gen.int(16, 120);
    } else {
      n = gen.pick([2, 4, 5, 10]);
      total = gen.int(5, 80);
    }
  } else if (story === 0) {
    n = gen.pick([4, 5]);
    total = gen.int(5, 45);
  } else if (story === 1) {
    n = gen.pick([4, 5]);
    total = gen.int(32, 99);
  } else {
    n = gen.pick([4, 5, 20, 25, 50]);
    total = gen.int(5, 99);
  }
  // A cyclist rides between 8 and 35 kilometres in an hour.
  if (story === 1 && (total < 8 * n || total > 35 * n)) return null;
  const rate = q(total, n);
  if (!rate.ok || decimals([rate], 2).length !== 1) return null;
  let prompt: string;
  let front: string;
  let style: Style;
  let unit: string;
  switch (story) {
    case 0:
      prompt = `${n} kg Kirschen kosten ${eur(total)}. Wie viel kostet 1 kg?`;
      front = `${n} kg für ${eur(total)}`;
      style = S.euro;
      unit = '€';
      break;
    case 1:
      prompt = `Ein Radfahrer fährt ${total} km in ${n} Stunden. Wie viele Kilometer sind das pro Stunde?`;
      front = `${total} km in ${n} h`;
      style = S.unit('km');
      unit = 'km';
      break;
    default:
      prompt = `Aus einem Hahn laufen ${total} l in ${n} Minuten. Wie viele Liter sind das pro Minute?`;
      front = `${total} l in ${n} min`;
      style = S.unit('l');
      unit = 'l';
  }
  // The rule turned around, the two numbers multiplied, subtracted, or the total left as it is.
  const wrong = positives(decimals([q(n, total), q(total * n), q(total - n), q(total)], 2));
  const problem = numberProblem({
    prompt,
    answer: rate,
    style,
    hint: valueHint,
    wrong,
    pair: front,
    solution: `${total} : ${n} = ${T.number(rate)} ${unit}`,
    explanation: 'Der Wert von einem Stück ist die Gesamtmenge geteilt durch die Anzahl. Teile immer durch die Zahl, die zu 1 gehört.',
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Aufgabe den Wert für 1 zu.';
  return problem;
}

/** "Zu x = 4 gehört y = 10, die Zuordnung ist proportional. Wie groß ist der Proportionalitätsfaktor?" */
function factor(level: number, gen: Gen): Problem | null {
  let x: number;
  let y: number;
  switch (level) {
    case 1:
      x = gen.int(2, 8);
      y = x * gen.int(2, 9);
      break;
    case 2:
      x = gen.pick([2, 4, 5, 10]);
      y = gen.int(3, 60);
      break;
    default:
      x = gen.pick([4, 5, 20, 25]);
      y = gen.int(3, 60);
  }
  const k = q(y, x);
  if (!k.ok || !(k.denominator !== 1 || level === 1) || decimals([k], 2).length !== 1 || y === x) return null;
  const wrong = positives(decimals([q(x, y), q(y - x), q(x * y), q(y)], 3));
  return numberProblem({
    prompt: `Eine Zuordnung ist proportional. Zu x = ${x} gehört y = ${y}.\nWie groß ist der Proportionalitätsfaktor?`,
    answer: k,
    hint: 'Gib den Faktor als Zahl an.',
    wrong,
    pair: `x = ${x}, y = ${y}`,
    solution: `y : x = ${y} : ${x} = ${T.number(k)}`,
    explanation: 'Bei einer proportionalen Zuordnung ist der Quotient y : x immer gleich. Dieser Wert heißt Proportionalitätsfaktor.',
  });
}

// Lesson 2

/** "6 Arbeiter brauchen 8 Tage. Wie lange brauchen 4 Arbeiter?" The product stays the same. */
function antiproportional(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => antiproportionalAttempt(level, gen));
}

function antiproportionalAttempt(level: number, gen: Gen): Problem | null {
  let product: number;
  switch (level) {
    case 1:
      product = gen.pick([12, 24, 36, 48, 60]);
      break;
    case 2:
      product = gen.pick([24, 36, 48, 60, 72, 90, 120]);
      break;
    default:
      product = gen.pick([30, 36, 60, 72, 90, 120, 180]);
  }
  const divisors = range(2, 12).filter((d) => product % d === 0);
  if (divisors.length < 2) return null;
  const n1 = gen.pick(divisors);
  const n2 = gen.pick(divisors);
  if (n1 === n2) return null;
  const t1 = T.div(product, n1);
  const answer = q(product, n2);
  if (!(level === 3 || answer.isWhole) || decimals([answer], 1).length !== 1 || !(t1 >= 2) || !(answer.double >= 2)) return null;
  const story = gen.int(0, 3);
  let prompt: string;
  let front: string;
  let style: Style;
  let unit: string;
  switch (story) {
    case 0:
      prompt = `${n1} Arbeiter brauchen für ein Dach ${t1} Tage. Wie viele Tage brauchen ${n2} Arbeiter (gleich schnell)?`;
      front = `${n1} Arbeiter: ${t1} Tage; ${n2} Arbeiter?`;
      style = S.unit('Tage');
      unit = 'Tage';
      break;
    case 1:
      prompt = `${n1} gleiche Pumpen füllen ein Becken in ${t1} Stunden. Wie lange brauchen ${n2} Pumpen?`;
      front = `${n1} Pumpen: ${t1} h; ${n2} Pumpen?`;
      style = S.unit('Stunden');
      unit = 'Stunden';
      break;
    case 2:
      prompt = `Ein Futtervorrat reicht für ${n1} Pferde ${t1} Tage. Wie lange reicht er für ${n2} Pferde?`;
      front = `${n1} Pferde: ${t1} Tage; ${n2} Pferde?`;
      style = S.unit('Tage');
      unit = 'Tage';
      break;
    default:
      prompt = `${n1} Freunde teilen sich die Kosten für ein Boot, jeder zahlt ${eur(t1)}. Wie viel zahlt jeder bei ${n2} Freunden?`;
      front = `${n1} Freunde zahlen je ${eur(t1)}; ${n2} Freunde?`;
      style = S.euro;
      unit = '€';
  }
  // The rule for proportional zuordnungen used, the difference subtracted or added, the product left as it is.
  const wrong = positives(decimals([q(t1 * n2, n1), q(t1 - (n2 - n1)), q(t1 + (n2 - n1)), q(product)], 2));
  const problem = numberProblem({
    prompt,
    answer,
    style,
    hint: valueHint,
    wrong,
    pair: front,
    solution: `${n1} · ${t1} = ${product}; ${product} : ${n2} = ${T.number(answer)} ${unit}`,
    explanation:
      'Hier ist das Produkt immer gleich: Doppelt so viele brauchen halb so lange. Rechne erst das Ganze aus (Anzahl mal Wert) und teile dann durch die neue Anzahl.',
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Aufgabe den gesuchten Wert zu.';
  return problem;
}

/** "Welche Zuordnung beschreibt die Tabelle?" proportional, antiproportional or neither. */
function tableType(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => tableTypeAttempt(level, gen));
}

function tableTypeAttempt(level: number, gen: Gen): Problem | null {
  const kind = level === 1 ? gen.pick([0, 0, 1, 2]) : gen.int(0, 2);
  let xs: number[];
  let ys: number[];
  switch (kind) {
    case 0: {
      xs = ascending(gen.shuffled(level === 1 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 8, 10]).slice(0, 3));
      const k = gen.int(2, 9);
      ys = xs.map((v) => v * k);
      break;
    }
    case 1: {
      const product = gen.pick([12, 24, 36, 60, 120]);
      const divisors = range(1, 12).filter((d) => product % d === 0);
      if (divisors.length < 3) return null;
      xs = ascending(gen.shuffled(divisors).slice(0, 3));
      ys = xs.map((v) => T.div(product, v));
      break;
    }
    default:
      xs = ascending(gen.shuffled([1, 2, 3, 4, 5, 6, 8, 10]).slice(0, 3));
      switch (gen.int(0, 2)) {
        case 0: {
          // y = kx + b: grows evenly but does not start at zero.
          const k = gen.int(1, 5);
          const b = gen.int(1, 9);
          ys = xs.map((v) => v * k + b);
          break;
        }
        case 1: {
          // y = x + b, the plain "plus" rule.
          const b = gen.int(2, 9);
          ys = xs.map((v) => v + b);
          break;
        }
        default:
          // y = x²: grows faster and faster.
          if (!(level >= 2)) return null;
          ys = xs.map((v) => v * v);
      }
  }
  // Whatever the kind, it must be that one and no other.
  const ratios = new Set(xs.map((x, i) => q(ys[i], x).key));
  const products = new Set(xs.map((x, i) => x * ys[i]));
  const isProportional = ratios.size === 1;
  const anti = products.size === 1;
  if ((isProportional && anti) || isProportional !== (kind === 0) || anti !== (kind === 1)) return null;
  const names = ['proportional', 'antiproportional', 'weder noch'];
  const quotients = xs.map((x, i) => T.number(q(ys[i], x))).join('; ');
  const multiples = xs.map((x, i) => String(x * ys[i])).join('; ');
  let reason: string;
  switch (kind) {
    case 0:
      reason = `Die Quotienten y : x sind alle gleich (${quotients}), also proportional.`;
      break;
    case 1:
      reason = `Die Produkte x · y sind alle gleich (${multiples}), also antiproportional.`;
      break;
    default:
      reason = `Weder die Quotienten (${quotients}) noch die Produkte (${multiples}) sind gleich.`;
  }
  return textProblem({
    prompt: `Welche Zuordnung beschreibt die Tabelle?\nx: ${xs.map(String).join(', ')}\ny: ${ys.map(String).join(', ')}`,
    correct: names[kind],
    wrong: names.filter((_, i) => i !== kind),
    solution: reason,
    explanation: 'Proportional: y : x ist immer gleich. Antiproportional: x · y ist immer gleich. Trifft keins von beiden zu, ist es weder noch.',
  });
}

const proportionalSituations = [
  'Anzahl der Brötchen → Gesamtpreis (jedes kostet gleich viel)',
  'Fahrzeit → zurückgelegte Strecke (gleichbleibende Geschwindigkeit)',
  'Seitenlänge eines Quadrats → Umfang des Quadrats',
  'getankte Liter → Preis (fester Preis je Liter)',
  'Anzahl der Kopien → Kosten (fester Preis je Kopie)',
  'Anzahl gleicher Hefte → Gewicht aller Hefte',
];

const antiproportionalSituations = [
  'Anzahl der Arbeiter → Zeit für dieselbe Arbeit (alle gleich schnell)',
  'Geschwindigkeit → Fahrzeit für dieselbe Strecke',
  'Anzahl der Personen → Anteil jeder Person an einem festen Betrag',
  'Anzahl der Pumpen → Zeit, um dasselbe Becken zu füllen',
  'Anzahl der Fahrgäste → Fahrpreis je Person bei festen Busmiete',
  'Anzahl der Tage → Tagesration eines festen Vorrats',
];

const otherSituations = [
  'Alter eines Kindes → Körpergröße',
  'Seitenlänge eines Quadrats → Flächeninhalt',
  'gefahrene Kilometer → Taxipreis mit Grundgebühr',
  'Uhrzeit → Außentemperatur',
  'Anzahl gelesener Seiten → noch ungelesene Seiten eines Buches',
  'Radius eines Kreises → Flächeninhalt des Kreises',
];

/** "Welche Zuordnung ist proportional?" One of four everyday situations. */
function situation(level: number, gen: Gen): Problem | null {
  const target = level === 1 ? gen.pick([0, 2]) : gen.int(0, 2);
  const pools = [proportionalSituations, antiproportionalSituations, otherSituations];
  const correct = gen.pick(pools[target]);
  // One wrong situation of each of the other two kinds, and a third that is none of these two.
  const first = gen.pick(pools[(target + 1) % 3]);
  const second = gen.pick(pools[(target + 2) % 3]);
  const rest = [...pools[(target + 1) % 3], ...pools[(target + 2) % 3]].filter((s) => s !== first && s !== second);
  const third = gen.pick(rest);
  const question = ['Welche Zuordnung ist proportional?', 'Welche Zuordnung ist antiproportional?', 'Welche Zuordnung ist weder proportional noch antiproportional?'][target];
  const reason = [
    'Doppelt so viel gehört zum Doppelten: y : x ist immer gleich.',
    'Doppelt so viel gehört zur Hälfte: x · y ist immer gleich.',
    'Weder der Quotient y : x noch das Produkt x · y bleibt gleich.',
  ][target];
  return textProblem({
    prompt: question,
    correct,
    wrong: [first, second, third],
    solution: `${correct}: ${reason}`,
    explanation: 'Prüfe mit einem Beispiel: Wird das Doppelte zum Doppelten (proportional), zur Hälfte (antiproportional), oder keins von beiden?',
  });
}

/** "Die Zuordnung ist antiproportional. x: 2, 3, 6  y: 18, 12, ?" */
function tableFill(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => tableFillAttempt(level, gen));
}

function tableFillAttempt(level: number, gen: Gen): Problem | null {
  const anti = level === 1 ? false : gen.chance(55);
  let xs: number[];
  let ys: number[];
  let answer: number;
  if (anti) {
    const product = gen.pick(level === 2 ? [12, 24, 36, 60] : [24, 36, 48, 60, 72, 120]);
    const divisors = range(1, 24).filter((d) => product % d === 0);
    if (divisors.length < 3) return null;
    const picked = ascending(gen.shuffled(divisors).slice(0, 3));
    xs = picked;
    ys = picked.map((v) => T.div(product, v));
    answer = ys[2];
  } else {
    const k = level === 3 ? gen.int(3, 12) : gen.int(2, 9);
    const picked = level === 1 ? [gen.int(1, 3), gen.int(4, 6), gen.int(7, 10)] : ascending(gen.shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]).slice(0, 3));
    xs = picked;
    ys = picked.map((v) => v * k);
    answer = ys[2];
  }
  if (new Set(xs).size !== 3 || new Set(ys).size !== 3) return null;
  const ruleName = anti ? 'antiproportional' : 'proportional';
  // The other kind of rule, the difference carried over, and the neighbour's value.
  let otherRule: number | null;
  if (anti) {
    otherRule = (ys[0] * xs[2]) % xs[0] === 0 ? T.div(ys[0] * xs[2], xs[0]) : null;
  } else {
    const p = xs[0] * ys[0];
    otherRule = p % xs[2] === 0 ? T.div(p, xs[2]) : null;
  }
  const candidates = [ys[1] + (xs[2] - xs[1]), ys[1] - (xs[2] - xs[1]), ys[1]];
  if (otherRule !== null) candidates.push(otherRule);
  const wrong = positives(candidates.map((v) => q(v)));
  const product = xs[0] * ys[0];
  const working = anti
    ? `${xs[0]} · ${ys[0]} = ${product}; ${product} : ${xs[2]} = ${answer}`
    : `y : x = ${ys[0]} : ${xs[0]} = ${T.div(ys[0], xs[0])}; ${T.div(ys[0], xs[0])} · ${xs[2]} = ${answer}`;
  const table = `x: ${xs.map(String).join(', ')}\ny: ${ys[0]}, ${ys[1]}, ?`;
  const problem = numberProblem({
    prompt: `Die Zuordnung ist ${ruleName}.\n${table}\nWelche Zahl fehlt?`,
    answer: q(answer),
    hint: '',
    wrong,
    typedPrompt: `Die Zuordnung ist ${ruleName}.\n${table}\nWelche Zahl fehlt? Gib die Zahl an.`,
    pair: `${ruleName}: ${xs[0]} → ${ys[0]}, ${xs[2]} → ?`,
    solution: working,
    explanation: anti
      ? 'Bei einer antiproportionalen Zuordnung ist das Produkt x · y immer gleich. Berechne es aus einem vollständigen Paar.'
      : 'Bei einer proportionalen Zuordnung ist der Quotient y : x immer gleich. Berechne ihn aus einem vollständigen Paar.',
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Tabelle die fehlende Zahl zu.';
  return problem;
}

// Lesson 3

/** "Maßstab 1 : 50 000. 4 cm auf der Karte, wie viel in Wirklichkeit?" and the way back. */
function scale(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => scaleAttempt(level, gen));
}

function scaleAttempt(level: number, gen: Gen): Problem | null {
  let n: number;
  switch (level) {
    case 1:
      n = gen.pick([100, 500, 1000]);
      break;
    case 2:
      n = gen.pick([10000, 25000, 50000, 100000]);
      break;
    default:
      n = gen.pick([25000, 50000, 100000, 200000]);
  }
  const scaleText = '1 : ' + T.grouped(n);
  if (level <= 2) {
    const d = gen.int(2, 12);
    const meters = level === 1;
    const real = meters ? q(d * n, 100) : q(d * n, 100000);
    if (!real.ok || decimals([real], 2).length !== 1 || !(real.double < 1000)) return null;
    const unit = meters ? 'm' : 'km';
    const wrong = positives(decimals([real.times(10), real.over(10), real.times(100), real.over(100)], 2));
    return numberProblem({
      prompt: `Maßstab ${scaleText}. Eine Strecke ist auf der Karte ${d} cm lang.\nWie lang ist sie in Wirklichkeit in ${unit}?`,
      answer: real,
      style: S.unit(unit),
      hint: 'Gib nur die Zahl an.',
      wrong,
      pair: `${scaleText}, ${d} cm`,
      solution: `${d} cm · ${T.grouped(n)} = ${T.grouped(d * n)} cm = ${T.number(real)} ${unit}`,
      explanation: `Bei 1 : ${T.grouped(n)} ist 1 cm auf der Karte ${T.grouped(n)} cm in Wirklichkeit. Rechne dann um: 100 cm sind 1 m, 100 000 cm sind 1 km.`,
    });
  }
  // Back from the real distance to the map.
  const km = gen.int(2, 30);
  const onMap = q(km * 100000, n);
  if (!onMap.ok || decimals([onMap], 1).length !== 1 || !(onMap.double >= 2) || !(onMap.double < 100)) return null;
  const wrong = positives(decimals([onMap.times(10), onMap.over(10), onMap.times(100), onMap.over(100)], 1));
  return numberProblem({
    prompt: `Zwei Orte sind ${km} km voneinander entfernt. Wie viele cm sind das auf einer Karte im Maßstab ${scaleText}?`,
    answer: onMap,
    style: S.unit('cm'),
    hint: 'Gib nur die Zahl an.',
    wrong,
    pair: `${km} km bei ${scaleText}`,
    solution: `${km} km = ${T.grouped(km * 100000)} cm; ${T.grouped(km * 100000)} : ${T.grouped(n)} = ${T.number(onMap)} cm`,
    explanation: `Rechne die wirkliche Länge in cm um und teile durch den Maßstabsfaktor: Bei 1 : ${T.grouped(n)} ist die Karte ${T.grouped(n)}-mal kleiner.`,
  });
}

const wholePositive = (values: number[]): Q[] => positives(values.map((v) => q(v)));

/** "150 € werden im Verhältnis 2 : 3 geteilt. Wie viel bekommt der Zweite?" */
function ratioSplit(level: number, gen: Gen): Problem | null {
  let parts: [number, number][];
  let k: number;
  switch (level) {
    case 1:
      parts = [[1, 2], [1, 3], [2, 3], [1, 4]];
      k = gen.int(2, 10);
      break;
    case 2:
      parts = [[3, 4], [2, 5], [3, 5], [1, 5], [4, 5], [1, 6]];
      k = gen.int(2, 15);
      break;
    default:
      parts = [[3, 7], [5, 7], [2, 7], [5, 8], [3, 8], [7, 9], [4, 9]];
      k = gen.int(3, 20);
  }
  let [p, r] = gen.pick(parts);
  if (gen.chance(50)) [p, r] = [r, p];
  const total = (p + r) * k;
  const askFirst = gen.chance(50);
  const share = (askFirst ? p : r) * k;
  const swapped = (askFirst ? r : p) * k;
  const story = gen.int(0, 2);
  const ordinal = askFirst ? 'der Erste' : 'der Zweite';
  let prompt: string;
  let style: Style;
  let unit: string;
  switch (story) {
    case 0:
      prompt = `Anna und Ben teilen ${total} € im Verhältnis ${p} : ${r}. Wie viel bekommt ${askFirst ? 'Anna' : 'Ben'}?`;
      style = S.euro;
      unit = '€';
      break;
    case 1:
      prompt = `Eine Mischung aus Saft und Wasser hat das Verhältnis Saft : Wasser = ${p} : ${r} und ist ${total} l groß. Wie viele Liter sind ${askFirst ? 'Saft' : 'Wasser'}?`;
      style = S.unit('l');
      unit = 'l';
      break;
    default:
      prompt = `Ein Gewinn von ${total} € wird im Verhältnis ${p} : ${r} auf zwei Spieler verteilt. Wie viel bekommt ${ordinal}?`;
      style = S.euro;
      unit = '€';
  }
  // The other share, one part only, half and half, the total divided by the number of this share.
  const wrong = [swapped, k, total - k];
  if (total % 2 === 0) wrong.push(total / 2);
  if (total % (askFirst ? p : r) === 0) wrong.push(total / (askFirst ? p : r));
  const ordinalPart = askFirst ? p : r;
  const problem = numberProblem({
    prompt,
    answer: q(share),
    style,
    hint: valueHint,
    wrong: wholePositive(wrong),
    pair: `${total} im Verhältnis ${p} : ${r}, ${askFirst ? '1. Teil' : '2. Teil'}`,
    solution: `${p} + ${r} = ${p + r} Teile; ${total} : ${p + r} = ${k} je Teil; ${k} · ${ordinalPart} = ${share} ${unit}`,
    explanation: `Zähle alle Teile zusammen (${p} + ${r}), teile das Ganze durch diese Zahl und nimm das Ergebnis mal die Teile des Gesuchten.`,
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Aufgabe den gesuchten Anteil zu.';
  return problem;
}

/** "Kürze das Verhältnis 12 : 18 vollständig." Level 3 has two units to bring to one first. */
function ratioReduce(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => ratioReduceAttempt(level, gen));
}

function ratioReduceAttempt(level: number, gen: Gen): Problem | null {
  let prompt: string;
  let front: string;
  let working: string;
  let reduced: [number, number];
  let wrong: string[] = [];
  const ratio = (x: number, y: number): string => `${x} : ${y}`;
  if (level <= 2) {
    const base = gen.pick<[number, number]>([[1, 2], [1, 3], [2, 3], [3, 4], [3, 5], [2, 5], [4, 5], [1, 4], [5, 6]]);
    const divisor = level === 1 ? gen.int(2, 6) : gen.int(4, 15);
    const a = base[0] * divisor;
    const b = base[1] * divisor;
    reduced = base;
    if (level === 1) {
      prompt = `Kürze das Verhältnis vollständig:\n${a} : ${b}`;
      front = ratio(a, b);
      working = `ggT(${a}, ${b}) = ${divisor}; ${ratio(a, b)} = ${ratio(base[0], base[1])}`;
    } else {
      switch (gen.int(0, 2)) {
        case 0:
          prompt = `Ein Rezept braucht ${a * 10} g Mehl und ${b * 10} g Zucker.\nWie lautet das Verhältnis Mehl : Zucker, vollständig gekürzt?`;
          front = `${a * 10} g : ${b * 10} g`;
          working = `ggT(${a * 10}, ${b * 10}) = ${divisor * 10}; also ${ratio(base[0], base[1])}`;
          break;
        case 1:
          prompt = `In einer Klasse sind ${a} Mädchen und ${b} Jungen.\nWie lautet das Verhältnis Mädchen : Jungen, vollständig gekürzt?`;
          front = `${a} Mädchen : ${b} Jungen`;
          working = `ggT(${a}, ${b}) = ${divisor}; also ${ratio(base[0], base[1])}`;
          break;
        default:
          prompt = `Ein Rechteck ist ${a} cm lang und ${b} cm breit.\nWie lautet das Verhältnis Länge : Breite, vollständig gekürzt?`;
          front = `${a} cm : ${b} cm`;
          working = `ggT(${a}, ${b}) = ${divisor}; also ${ratio(base[0], base[1])}`;
      }
    }
    // Stopped halfway, the two sides switched, only one side shortened.
    const stops = range(2, divisor - 1).filter((s) => divisor % s === 0);
    if (stops.length > 0) {
      const stop = stops[stops.length - 1];
      wrong.push(ratio(base[0] * T.div(divisor, stop), base[1] * T.div(divisor, stop)));
    }
    wrong.push(ratio(base[1], base[0]), ratio(a, base[1]), ratio(base[0], b));
  } else {
    // The second quantity in the larger unit: 250 g : 1 kg is 250 : 1000.
    const [small, large, fac] = gen.pick<[string, string, number]>([['g', 'kg', 1000], ['cm', 'm', 100], ['min', 'h', 60]]);
    const big = gen.int(1, 4);
    const inSmall = big * fac;
    const smallValue = gen.int(1, 19) * (fac === 60 ? 5 : fac === 100 ? 5 : 50);
    const divisor = T.gcd(smallValue, inSmall);
    reduced = [T.div(smallValue, divisor), T.div(inSmall, divisor)];
    if (!(reduced[0] < reduced[1]) || !(reduced[1] <= 40) || reduced[0] === smallValue) return null;
    prompt = `Wie lautet das Verhältnis ${smallValue} ${small} : ${big} ${large}, vollständig gekürzt?`;
    front = `${smallValue} ${small} : ${big} ${large}`;
    working = `${big} ${large} = ${inSmall} ${small}; ${ratio(smallValue, inSmall)} = ${ratio(reduced[0], reduced[1])}`;
    // The units ignored, left unreduced, the sides switched.
    const ignored = T.gcd(smallValue, big);
    wrong = [ratio(T.div(smallValue, ignored), T.div(big, ignored)), ratio(smallValue, inSmall), ratio(reduced[1], reduced[0])];
  }
  const problem = textProblem({
    prompt,
    correct: ratio(reduced[0], reduced[1]),
    wrong,
    typed: { prompt: prompt.split('\n').join(' ') + '\nWelche Zahl steht rechts?', answer: R(reduced[1]) },
    pair: front,
    solution: working,
    explanation: 'Kürze ein Verhältnis wie einen Bruch: Teile beide Zahlen durch den größten gemeinsamen Teiler. Haben sie verschiedene Einheiten, rechne zuerst um.',
  });
  problem.pairPrompt = 'Kürze vollständig und ordne zu.';
  return problem;
}
