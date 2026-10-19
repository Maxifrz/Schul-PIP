import { describe, it } from 'vitest';
import { bruteGCD, check, close, match, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';

/** Unit 5, Dreisatz und Proportionalität: every answer is recomputed from the numbers in the prompt, tables are
 * classified by their quotients and products, and every wrong option must be one of the known typical mistakes. */
const plain = (text: string) => text.split(' ').join('').split('\n').join(' ');
const N = '(\\d+(?:,\\d+)?)';
const num = (s: string) => number(s) as number;

/** The right option, the typed answer and the wrong options of a number problem; the wrong ones must come from the list of mistakes and never equal the answer. */
function numbers(p: Problem, expected: number, mistakes: number[]): string | null {
  const right = number(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return 'typed answer';
  for (const option of optionsOf(p)) {
    const value = number(option);
    if (value === null) return `wrong option ${option}`;
    if (close(value, expected)) return `wrong option ${option} is right`;
    if (!mistakes.some((m) => close(m, value))) return `wrong option ${option} is no known mistake`;
  }
  return null;
}

describe('math middle unit 5', () => {
  it('proportional', () => check('u05.proportional', (level, p) => {
    const text = plain(p.prompt);
    let given: [number, number, number];
    let m: string[] | null;
    if ((m = match(`${N} Hefte kosten ${N} €\\. Wie viel kosten ${N} Hefte`, text))) given = [num(m[1]), num(m[2]), num(m[3])];
    else if ((m = match(`Für ${N} Stunden Arbeit bekommt Jonas ${N} €\\. Wie viel bekommt er für ${N} Stunden`, text))) given = [num(m[1]), num(m[2]), num(m[3])];
    else if ((m = match(`${N} kg Äpfel kosten ${N} €\\. Wie viel kosten ${N} kg`, text))) given = [num(m[1]), num(m[2]), num(m[3])];
    else if ((m = match(`in ${N} Minuten ${N} Flaschen\\. Wie viele Flaschen füllt sie in ${N} Minuten`, text))) given = [num(m[1]), num(m[2]), num(m[3])];
    else if ((m = match(`fährt gleichmäßig ${N} km in ${N} Stunden\\. Wie weit fährt er in ${N} Stunden`, text))) given = [num(m[2]), num(m[1]), num(m[3])];
    else return 'prompt';
    const [n1, p1, n2] = given;
    if (n1 === n2) return 'same number';
    // The cross product decides: p1 / n1 = answer / n2.
    const expected = (p1 * n2) / n1;
    if (!close(p1 * n2, expected * n1)) return 'cross product';
    if (level === 3 && p.correct.includes(' km')) return 'level 3 is about money';
    if (level === 1 && (n1 > 10 || expected >= 1000)) return 'level 1 is small';
    if (p.pairFront === undefined) return 'pair front';
    return numbers(p, expected, [p1 + n2 - n1, (p1 * n1) / n2, p1 * n2, p1 / n1]);
  }));

  it('unitRate', () => check('u05.unitRate', (_l, p) => {
    const text = plain(p.prompt);
    let n: number;
    let total: number;
    let m: string[] | null;
    if ((m = match(`${N} kg Kirschen kosten ${N} €`, text))) [n, total] = [num(m[1]), num(m[2])];
    else if ((m = match(`fährt ${N} km in ${N} Stunden`, text))) [n, total] = [num(m[2]), num(m[1])];
    else if ((m = match(`laufen ${N} l in ${N} Minuten`, text))) [n, total] = [num(m[2]), num(m[1])];
    else return 'prompt';
    // Plugged back in: n units of the rate make the total.
    const expected = total / n;
    if (!close(expected * n, total)) return 'does not fit back';
    return numbers(p, expected, [n / total, total * n, total - n, total]);
  }));

  it('factor', () => check('u05.factor', (level, p) => {
    const m = match('Zu x = (\\d+) gehört y = (\\d+)\\.', p.prompt);
    if (!m) return 'prompt';
    const [x, y] = [Number(m[1]), Number(m[2])];
    if (p.pairFront !== `x = ${m[1]}, y = ${m[2]}`) return 'pair front';
    if (level >= 2 && y % x === 0) return 'levels 2 and 3 have a fraction as the factor';
    return numbers(p, y / x, [x / y, y - x, x * y, y]);
  }));

  it('antiproportional', () => check('u05.antiproportional', (level, p) => {
    const text = plain(p.prompt);
    let n1: number;
    let t1: number;
    let n2: number;
    let m: string[] | null;
    if ((m = match('(\\d+) Arbeiter brauchen für ein Dach (\\d+) Tage\\. Wie viele Tage brauchen (\\d+) Arbeiter', text))) [n1, t1, n2] = [Number(m[1]), Number(m[2]), Number(m[3])];
    else if ((m = match('(\\d+) gleiche Pumpen füllen ein Becken in (\\d+) Stunden\\. Wie lange brauchen (\\d+) Pumpen', text))) [n1, t1, n2] = [Number(m[1]), Number(m[2]), Number(m[3])];
    else if ((m = match('reicht für (\\d+) Pferde (\\d+) Tage\\. Wie lange reicht er für (\\d+) Pferde', text))) [n1, t1, n2] = [Number(m[1]), Number(m[2]), Number(m[3])];
    else if ((m = match(`(\\d+) Freunde teilen sich die Kosten für ein Boot, jeder zahlt ${N} €\\. Wie viel zahlt jeder bei (\\d+) Freunden`, text))) [n1, t1, n2] = [Number(m[1]), num(m[2]), Number(m[3])];
    else return 'prompt';
    if (n1 === n2) return 'same number';
    // The product stays the same: plugged back in.
    const expected = (n1 * t1) / n2;
    const right = number(p.correct);
    if (right === null || !close(n2 * right, n1 * t1)) return 'product';
    if (level < 3 && expected !== Math.round(expected)) return 'levels 1 and 2 have whole answers';
    return numbers(p, expected, [(t1 * n2) / n1, t1 - (n2 - n1), t1 + (n2 - n1), n1 * t1]);
  }));

  const table = (text: string): { xs: number[]; ys: number[] } | null => {
    const m = match('x: ([\\d, ]+)\\ny: ([\\d, ?]+)', text);
    if (!m) return null;
    const numeric = (s: string) => s.split(', ').map(Number).filter((v) => !Number.isNaN(v));
    return { xs: numeric(m[1]), ys: numeric(m[2]) };
  };

  it('tableType', () => check('u05.tableType', (_l, p) => {
    const t = table(p.prompt);
    if (!t || t.xs.length !== 3 || t.ys.length !== 3) return 'table';
    const { xs, ys } = t;
    const proportional = [1, 2].every((i) => close(ys[i] / xs[i], ys[0] / xs[0]));
    const anti = [1, 2].every((i) => close(ys[i] * xs[i], ys[0] * xs[0]));
    if (proportional && anti) return 'both';
    const expected = proportional ? 'proportional' : anti ? 'antiproportional' : 'weder noch';
    if (p.correct !== expected) return `correct ${p.correct} expected ${expected}`;
    if (new Set([...optionsOf(p), p.correct]).size !== 3) return `options ${optionsOf(p)}`;
    if (xs.some((x, i) => i > 0 && x <= xs[i - 1])) return 'x values';
    return null;
  }));

  /** Each situation as a function of x: the kind follows from the numbers, not from a label. */
  const models: Record<string, (x: number) => number> = {
    'Anzahl der Brötchen → Gesamtpreis (jedes kostet gleich viel)': (x) => 0.4 * x,
    'Fahrzeit → zurückgelegte Strecke (gleichbleibende Geschwindigkeit)': (x) => 80 * x,
    'Seitenlänge eines Quadrats → Umfang des Quadrats': (x) => 4 * x,
    'getankte Liter → Preis (fester Preis je Liter)': (x) => 1.8 * x,
    'Anzahl der Kopien → Kosten (fester Preis je Kopie)': (x) => 0.1 * x,
    'Anzahl gleicher Hefte → Gewicht aller Hefte': (x) => 60 * x,
    'Anzahl der Arbeiter → Zeit für dieselbe Arbeit (alle gleich schnell)': (x) => 120 / x,
    'Geschwindigkeit → Fahrzeit für dieselbe Strecke': (x) => 240 / x,
    'Anzahl der Personen → Anteil jeder Person an einem festen Betrag': (x) => 60 / x,
    'Anzahl der Pumpen → Zeit, um dasselbe Becken zu füllen': (x) => 12 / x,
    'Anzahl der Fahrgäste → Fahrpreis je Person bei festen Busmiete': (x) => 300 / x,
    'Anzahl der Tage → Tagesration eines festen Vorrats': (x) => 90 / x,
    'Alter eines Kindes → Körpergröße': (x) => 50 + 6 * x,
    'Seitenlänge eines Quadrats → Flächeninhalt': (x) => x * x,
    'gefahrene Kilometer → Taxipreis mit Grundgebühr': (x) => 4 + 2 * x,
    'Uhrzeit → Außentemperatur': (x) => 10 + 8 * Math.sin(x / 4),
    'Anzahl gelesener Seiten → noch ungelesene Seiten eines Buches': (x) => 300 - x,
    'Radius eines Kreises → Flächeninhalt des Kreises': (x) => Math.PI * x * x,
  };
  const kind = (situation: string): string | null => {
    const f = models[situation];
    if (!f) return null;
    const xs = [1, 2, 3, 5, 8];
    if (xs.every((x) => close(f(x) / x, f(1)))) return 'proportional';
    if (xs.every((x) => close(f(x) * x, f(1)))) return 'antiproportional';
    return 'weder';
  };

  it('situation', () => check('u05.situation', (level, p) => {
    const wanted = ({
      'Welche Zuordnung ist proportional?': 'proportional',
      'Welche Zuordnung ist antiproportional?': 'antiproportional',
      'Welche Zuordnung ist weder proportional noch antiproportional?': 'weder',
    } as Record<string, string>)[p.prompt];
    if (!wanted) return 'prompt';
    if (level === 1 && wanted === 'antiproportional') return 'level 1 has no antiproportional question';
    if (kind(p.correct) !== wanted) return `correct option ${p.correct} is ${kind(p.correct) ?? 'unknown'}`;
    const options = optionsOf(p);
    if (options.length !== 3) return 'three wrong options';
    for (const option of options) if (kind(option) === null || kind(option) === wanted) return `wrong option ${option} is ${kind(option) ?? 'unknown'}`;
    // Both other kinds appear among the wrong options.
    if (new Set(options.map(kind)).size !== 2) return 'wrong options of one kind only';
    return null;
  }));

  it('tableFill', () => check('u05.tableFill', (level, p) => {
    const m = match('^Die Zuordnung ist (proportional|antiproportional)\\.', p.prompt);
    const t = table(p.prompt);
    if (!m || !t || t.xs.length !== 3 || t.ys.length !== 2) return 'prompt';
    const { xs, ys } = t;
    const anti = m[1] === 'antiproportional';
    if (level === 1 && anti) return 'level 1 is proportional';
    // The missing value from the first pair, by the rule of the kind.
    const expected = anti ? (xs[0] * ys[0]) / xs[2] : (ys[0] / xs[0]) * xs[2];
    if (expected !== Math.round(expected) || !(expected > 0)) return 'not whole';
    // The second pair obeys the same rule.
    if (!(anti ? close(xs[1] * ys[1], xs[0] * ys[0]) : close(ys[1] / xs[1], ys[0] / xs[0]))) return 'second pair';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return 'correct option';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return 'wrong option';
      if (close(value, expected)) return `wrong option ${option} is right`;
    }
    return null;
  }));

  it('scale', () => check('u05.scale', (level, p) => {
    const text = plain(p.prompt);
    let m = match('Maßstab 1 : (\\d+)\\. Eine Strecke ist auf der Karte (\\d+) cm lang\\. Wie lang ist sie in Wirklichkeit in (m|km)\\?', text);
    if (m) {
      if (level > 2) return 'forward only below level 3';
      const [n, d] = [Number(m[1]), Number(m[2])];
      // Centimetres first, then the unit.
      const realCm = d * n;
      const expected = m[3] === 'm' ? realCm / 100 : realCm / 100000;
      if (level === 1 && m[3] !== 'm') return 'level 1 in metres';
      if (level === 2 && m[3] !== 'km') return 'level 2 in kilometres';
      return numbers(p, expected, [expected * 10, expected / 10, expected * 100, expected / 100]);
    }
    m = match('Zwei Orte sind (\\d+) km voneinander entfernt\\. Wie viele cm sind das auf einer Karte im Maßstab 1 : (\\d+)\\?', text);
    if (m) {
      if (level !== 3) return 'back only at level 3';
      const [km, n] = [Number(m[1]), Number(m[2])];
      const expected = (km * 100000) / n;
      // Plugged back in: the map length times the factor is the real length.
      const right = number(p.correct);
      if (right === null || !close(right * n, km * 100000)) return 'back';
      return numbers(p, expected, [expected * 10, expected / 10, expected * 100, expected / 100]);
    }
    return 'prompt';
  }));

  it('ratioSplit', () => check('u05.ratioSplit', (_l, p) => {
    const text = plain(p.prompt);
    let p1: number;
    let q1: number;
    let total: number;
    let askFirst: boolean;
    let m: string[] | null;
    if ((m = match('Anna und Ben teilen (\\d+) € im Verhältnis (\\d+) : (\\d+)\\. Wie viel bekommt (Anna|Ben)\\?', text))) [total, p1, q1, askFirst] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === 'Anna'];
    else if ((m = match('Verhältnis Saft : Wasser = (\\d+) : (\\d+) und ist (\\d+) l groß\\. Wie viele Liter sind (Saft|Wasser)\\?', text))) [total, p1, q1, askFirst] = [Number(m[3]), Number(m[1]), Number(m[2]), m[4] === 'Saft'];
    else if ((m = match('Ein Gewinn von (\\d+) € wird im Verhältnis (\\d+) : (\\d+) auf zwei Spieler verteilt\\. Wie viel bekommt (der Erste|der Zweite)\\?', text))) [total, p1, q1, askFirst] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === 'der Erste'];
    else return 'prompt';
    const parts = p1 + q1;
    if (total % parts !== 0) return 'parts do not divide the total';
    const expected = (total * (askFirst ? p1 : q1)) / parts;
    // The two shares add up to the total.
    const other = (total * (askFirst ? q1 : p1)) / parts;
    if (!close(expected + other, total)) return 'shares';
    if (bruteGCD(p1, q1) !== 1) return 'ratio not reduced';
    const k = total / parts;
    const part = askFirst ? p1 : q1;
    return numbers(p, expected, [other, k, total - k, total / 2, total / part]);
  }));

  it('ratioReduce', () => check('u05.ratioReduce', (level, p) => {
    const text = plain(p.prompt);
    let a: number;
    let b: number;
    let m: string[] | null;
    if ((m = match('^Kürze das Verhältnis vollständig: (\\d+) : (\\d+)$', text))) {
      if (level !== 1) return 'plain only at level 1';
      [a, b] = [Number(m[1]), Number(m[2])];
    } else if ((m = match('Ein Rezept braucht (\\d+) g Mehl und (\\d+) g Zucker', text) ?? match('In einer Klasse sind (\\d+) Mädchen und (\\d+) Jungen', text) ?? match('Ein Rechteck ist (\\d+) cm lang und (\\d+) cm breit', text))) {
      if (level !== 2) return 'stories at level 2';
      [a, b] = [Number(m[1]), Number(m[2])];
    } else if ((m = match('Verhältnis (\\d+) (g|cm|min) : (\\d+) (kg|m|h), vollständig', text))) {
      if (level !== 3) return 'units at level 3';
      const factor = ({ g: 1000, cm: 100, min: 60 } as Record<string, number>)[m[2]];
      [a, b] = [Number(m[1]), Number(m[3]) * factor];
    } else return 'prompt';
    const g = bruteGCD(a, b);
    const expected = `${a / g} : ${b / g}`;
    if (p.correct !== expected) return `correct ${p.correct} expected ${expected}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, b / g)) return 'typed answer';
    for (const option of optionsOf(p)) {
      const o = match('^(\\d+) : (\\d+)$', option);
      if (!o) return `wrong option ${option}`;
      const [x, y] = [Number(o[1]), Number(o[2])];
      // A wrong option is never the fully reduced ratio of the same numbers.
      if (bruteGCD(x, y) === 1 && x * (b / g) === y * (a / g)) return `wrong option ${option} is right`;
      if (option === expected) return 'wrong option equals the answer';
    }
    return null;
  }));
});
