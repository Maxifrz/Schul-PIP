// Ports of LernwerkTests/MathCourseMiddleUnit05Tests.swift to Unit07Tests.swift.
import { describe, it } from 'vitest';
import { type Problem, problemOptions } from '../../src/lib/learn/math/middle/core';
import * as T from '../../src/lib/learn/math/middle/text';
import { Expr, bruteGCD, check, close, firstLine, int, lastLine, match, matches, number, span, typedAnswer } from './mathMiddleKit';

const T60 = 120_000;
const NUM = '(\\d+(?:,\\d+)?)';
const re = (...parts: string[]): RegExp => new RegExp(parts.join(''));

// Unit 5

const plain = (text: string): string => text.split(' ').join('').split('\n').join(' ');

/** The right option, the typed answer and the wrong options of a number problem; the wrong ones must come from the
 * list of mistakes and never equal the answer. */
function numbersCheck(p: Problem, expected: number, mistakes: number[]): string | null {
  const right = number(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return 'typed answer';
  for (const option of problemOptions(p)) {
    const value = number(option);
    if (value === null) return `wrong option ${option}`;
    if (close(value, expected)) return `wrong option ${option} is right`;
    if (!mistakes.some((m) => close(m, value))) return `wrong option ${option} is no known mistake`;
  }
  return null;
}

function table(text: string): { xs: number[]; ys: number[] } | null {
  const m = match(/x: ([\d, ]+)\ny: ([\d, ?]+)/, text);
  if (!m) return null;
  const numeric = (s: string): number[] => s.split(', ').filter((x) => /^\d+(\.\d+)?$/.test(x)).map(Number);
  return { xs: numeric(m[1]), ys: numeric(m[2]) };
}

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

function kind(situation: string): string | null {
  const f = models[situation];
  if (!f) return null;
  const xs = [1, 2, 3, 5, 8];
  if (xs.every((x) => close(f(x) / x, f(1)))) return 'proportional';
  if (xs.every((x) => close(f(x) * x, f(1)))) return 'antiproportional';
  return 'weder';
}

describe('unit 5: Dreisatz und Proportionalität', { timeout: T60 }, () => {
  it('proportional', () => {
    check('u05.proportional', (level, p) => {
      const text = plain(p.prompt);
      let given: [number, number, number];
      let m: string[] | null;
      if ((m = match(re(NUM, ' Hefte kosten ', NUM, ' €\\. Wie viel kosten ', NUM, ' Hefte'), text))) {
        given = [number(m[1])!, number(m[2])!, number(m[3])!];
      } else if ((m = match(re('Für ', NUM, ' Stunden Arbeit bekommt Jonas ', NUM, ' €\\. Wie viel bekommt er für ', NUM, ' Stunden'), text))) {
        given = [number(m[1])!, number(m[2])!, number(m[3])!];
      } else if ((m = match(re(NUM, ' kg Äpfel kosten ', NUM, ' €\\. Wie viel kosten ', NUM, ' kg'), text))) {
        given = [number(m[1])!, number(m[2])!, number(m[3])!];
      } else if ((m = match(re('in ', NUM, ' Minuten ', NUM, ' Flaschen\\. Wie viele Flaschen füllt sie in ', NUM, ' Minuten'), text))) {
        given = [number(m[1])!, number(m[2])!, number(m[3])!];
      } else if ((m = match(re('fährt gleichmäßig ', NUM, ' km in ', NUM, ' Stunden\\. Wie weit fährt er in ', NUM, ' Stunden'), text))) {
        given = [number(m[2])!, number(m[1])!, number(m[3])!];
      } else {
        return 'prompt';
      }
      const [n1, p1, n2] = given;
      if (n1 === n2) return 'same number';
      // The cross product decides: p1 / n1 = answer / n2.
      const expected = (p1 * n2) / n1;
      if (!close(p1 * n2, expected * n1)) return 'cross product';
      if (level === 3 && p.correct.includes(' km')) return 'level 3 is about money';
      if (level === 1 && (n1 > 10 || expected >= 1000)) return 'level 1 is small';
      if (p.pairFront === null) return 'pair front';
      return numbersCheck(p, expected, [p1 + n2 - n1, (p1 * n1) / n2, p1 * n2, p1 / n1]);
    });
  });

  it('unitRate', () => {
    check('u05.unitRate', (_l, p) => {
      const text = plain(p.prompt);
      let n: number;
      let total: number;
      let m: string[] | null;
      if ((m = match(re(NUM, ' kg Kirschen kosten ', NUM, ' €'), text))) {
        [n, total] = [number(m[1])!, number(m[2])!];
      } else if ((m = match(re('fährt ', NUM, ' km in ', NUM, ' Stunden'), text))) {
        [n, total] = [number(m[2])!, number(m[1])!];
      } else if ((m = match(re('laufen ', NUM, ' l in ', NUM, ' Minuten'), text))) {
        [n, total] = [number(m[2])!, number(m[1])!];
      } else {
        return 'prompt';
      }
      // Plugged back in: n units of the rate make the total.
      const expected = total / n;
      if (!close(expected * n, total)) return 'does not fit back';
      return numbersCheck(p, expected, [n / total, total * n, total - n, total]);
    });
  });

  it('factor', () => {
    check('u05.factor', (level, p) => {
      const m = match(/Zu x = (\d+) gehört y = (\d+)\./, p.prompt);
      if (!m) return 'prompt';
      const [x, y] = [Number(m[1]), Number(m[2])];
      if (p.pairFront !== `x = ${m[1]}, y = ${m[2]}`) return 'pair front';
      if (level >= 2 && y % x === 0) return 'levels 2 and 3 have a fraction as the factor';
      return numbersCheck(p, y / x, [x / y, y - x, x * y, y]);
    });
  });

  it('antiproportional', () => {
    check('u05.antiproportional', (level, p) => {
      const text = plain(p.prompt);
      let n1: number;
      let t1: number;
      let n2: number;
      let m: string[] | null;
      if ((m = match(/(\d+) Arbeiter brauchen für ein Dach (\d+) Tage\. Wie viele Tage brauchen (\d+) Arbeiter/, text))) {
        [n1, t1, n2] = [Number(m[1]), Number(m[2]), Number(m[3])];
      } else if ((m = match(/(\d+) gleiche Pumpen füllen ein Becken in (\d+) Stunden\. Wie lange brauchen (\d+) Pumpen/, text))) {
        [n1, t1, n2] = [Number(m[1]), Number(m[2]), Number(m[3])];
      } else if ((m = match(/reicht für (\d+) Pferde (\d+) Tage\. Wie lange reicht er für (\d+) Pferde/, text))) {
        [n1, t1, n2] = [Number(m[1]), Number(m[2]), Number(m[3])];
      } else if ((m = match(/(\d+) Freunde teilen sich die Kosten für ein Boot, jeder zahlt (\d+(?:,\d+)?) €\. Wie viel zahlt jeder bei (\d+) Freunden/, text))) {
        [n1, t1, n2] = [Number(m[1]), number(m[2])!, Number(m[3])];
      } else {
        return 'prompt';
      }
      if (n1 === n2) return 'same number';
      // The product stays the same: plugged back in.
      const expected = (n1 * t1) / n2;
      const right = number(p.correct);
      if (right === null || !close(n2 * right, n1 * t1)) return 'product';
      if (level < 3 && expected !== Math.round(expected)) return 'levels 1 and 2 have whole answers';
      return numbersCheck(p, expected, [(t1 * n2) / n1, t1 - (n2 - n1), t1 + (n2 - n1), n1 * t1]);
    });
  });

  it('tableType', () => {
    check('u05.tableType', (_l, p) => {
      const t = table(p.prompt);
      if (!t || t.xs.length !== 3 || t.ys.length !== 3) return 'table';
      const { xs, ys } = t;
      const proportional = [1, 2].every((i) => close(ys[i] / xs[i], ys[0] / xs[0]));
      const anti = [1, 2].every((i) => close(ys[i] * xs[i], ys[0] * xs[0]));
      if (proportional && anti) return 'both';
      const expected = proportional ? 'proportional' : anti ? 'antiproportional' : 'weder noch';
      if (p.correct !== expected) return `correct ${p.correct} expected ${expected}`;
      const all = [...new Set([...problemOptions(p), p.correct])].sort();
      if (all.join() !== ['antiproportional', 'proportional', 'weder noch'].join()) return `options ${problemOptions(p)}`;
      if (xs.join() !== xs.slice().sort((a, b) => a - b).join() || new Set(xs).size !== 3) return 'x values';
      return null;
    });
  });

  it('situation', () => {
    check('u05.situation', (level, p) => {
      let wanted: string;
      switch (p.prompt) {
        case 'Welche Zuordnung ist proportional?':
          wanted = 'proportional';
          break;
        case 'Welche Zuordnung ist antiproportional?':
          wanted = 'antiproportional';
          break;
        case 'Welche Zuordnung ist weder proportional noch antiproportional?':
          wanted = 'weder';
          break;
        default:
          return 'prompt';
      }
      if (level === 1 && wanted === 'antiproportional') return 'level 1 has no antiproportional question';
      if (kind(p.correct) !== wanted) return `correct option ${p.correct} is ${kind(p.correct) ?? 'unknown'}`;
      const options = problemOptions(p);
      if (options.length !== 3) return 'three wrong options';
      for (const option of options) if (kind(option) === null || kind(option) === wanted) return `wrong option ${option} is ${kind(option) ?? 'unknown'}`;
      // Both other kinds appear among the wrong options.
      if (new Set(options.map((o) => kind(o)).filter((k) => k !== null)).size !== 2) return 'wrong options of one kind only';
      return null;
    });
  });

  it('tableFill', () => {
    check('u05.tableFill', (level, p) => {
      const m = match(/^Die Zuordnung ist (proportional|antiproportional)\./, p.prompt);
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
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        if (close(value, expected)) return `wrong option ${option} is right`;
      }
      return null;
    });
  });

  it('scale', () => {
    check('u05.scale', (level, p) => {
      const text = plain(p.prompt);
      let m = match(/Maßstab 1 : (\d+)\. Eine Strecke ist auf der Karte (\d+) cm lang\. Wie lang ist sie in Wirklichkeit in (m|km)\?/, text);
      if (m) {
        if (level > 2) return 'forward only below level 3';
        const n = Number(m[1]);
        const d = Number(m[2]);
        // Centimetres first, then the unit.
        const realCm = d * n;
        const expected = m[3] === 'm' ? realCm / 100 : realCm / 100000;
        if (level === 1 && m[3] !== 'm') return 'level 1 in metres';
        if (level === 2 && m[3] !== 'km') return 'level 2 in kilometres';
        return numbersCheck(p, expected, [expected * 10, expected / 10, expected * 100, expected / 100]);
      }
      m = match(/Zwei Orte sind (\d+) km voneinander entfernt\. Wie viele cm sind das auf einer Karte im Maßstab 1 : (\d+)\?/, text);
      if (m) {
        if (level !== 3) return 'back only at level 3';
        const km = Number(m[1]);
        const n = Number(m[2]);
        const expected = (km * 100000) / n;
        // Plugged back in: the map length times the factor is the real length.
        const right = number(p.correct);
        if (right === null || !close(right * n, km * 100000)) return 'back';
        return numbersCheck(p, expected, [expected * 10, expected / 10, expected * 100, expected / 100]);
      }
      return 'prompt';
    });
  });

  it('ratioSplit', () => {
    check('u05.ratioSplit', (_l, p) => {
      const text = plain(p.prompt);
      let p1: number;
      let q1: number;
      let total: number;
      let askFirst: boolean;
      let m: string[] | null;
      if ((m = match(/Anna und Ben teilen (\d+) € im Verhältnis (\d+) : (\d+)\. Wie viel bekommt (Anna|Ben)\?/, text))) {
        [total, p1, q1, askFirst] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === 'Anna'];
      } else if ((m = match(/Verhältnis Saft : Wasser = (\d+) : (\d+) und ist (\d+) l groß\. Wie viele Liter sind (Saft|Wasser)\?/, text))) {
        [total, p1, q1, askFirst] = [Number(m[3]), Number(m[1]), Number(m[2]), m[4] === 'Saft'];
      } else if ((m = match(/Ein Gewinn von (\d+) € wird im Verhältnis (\d+) : (\d+) auf zwei Spieler verteilt\. Wie viel bekommt (der Erste|der Zweite)\?/, text))) {
        [total, p1, q1, askFirst] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === 'der Erste'];
      } else {
        return 'prompt';
      }
      const parts = p1 + q1;
      if (total % parts !== 0) return 'parts do not divide the total';
      const expected = (total * (askFirst ? p1 : q1)) / parts;
      // The two shares add up to the total.
      const other = (total * (askFirst ? q1 : p1)) / parts;
      if (!close(expected + other, total)) return 'shares';
      if (bruteGCD(p1, q1) !== 1) return 'ratio not reduced';
      const k = total / parts;
      const part = askFirst ? p1 : q1;
      return numbersCheck(p, expected, [other, k, total - k, total / 2, total / part]);
    });
  });

  it('ratioReduce', () => {
    check('u05.ratioReduce', (level, p) => {
      const text = plain(p.prompt);
      let a: number;
      let b: number;
      let m: string[] | null;
      if ((m = match(/^Kürze das Verhältnis vollständig: (\d+) : (\d+)$/, text))) {
        if (level !== 1) return 'plain only at level 1';
        [a, b] = [Number(m[1]), Number(m[2])];
      } else if (
        (m =
          match(/Ein Rezept braucht (\d+) g Mehl und (\d+) g Zucker/, text) ??
          match(/In einer Klasse sind (\d+) Mädchen und (\d+) Jungen/, text) ??
          match(/Ein Rechteck ist (\d+) cm lang und (\d+) cm breit/, text))
      ) {
        if (level !== 2) return 'stories at level 2';
        [a, b] = [Number(m[1]), Number(m[2])];
      } else if ((m = match(/Verhältnis (\d+) (g|cm|min) : (\d+) (kg|m|h), vollständig/, text))) {
        if (level !== 3) return 'units at level 3';
        const factor = ({ g: 1000, cm: 100, min: 60 } as Record<string, number>)[m[2]];
        [a, b] = [Number(m[1]), Number(m[3]) * factor];
      } else {
        return 'prompt';
      }
      const g = bruteGCD(a, b);
      const expected = `${a / g} : ${b / g}`;
      if (p.correct !== expected) return `correct ${p.correct} expected ${expected}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, b / g)) return 'typed answer';
      for (const option of problemOptions(p)) {
        const w = match(/^(\d+) : (\d+)$/, option);
        if (!w) return `wrong option ${option}`;
        const [x, y] = [Number(w[1]), Number(w[2])];
        // A wrong option is never the fully reduced ratio of the same numbers.
        if (bruteGCD(x, y) === 1 && x * (b / g) === y * (a / g)) return `wrong option ${option} is right`;
        if (option === expected) return 'wrong option equals the answer';
      }
      return null;
    });
  });
});

// Unit 6

const NUMBER6 = '(−?\\d+(?:,\\d+)?)';

/** The value of the right side of "y = ..." at x. */
function valueOf(line: string, x: number): number | null {
  if (!line.startsWith('y = ')) return null;
  return Expr.evaluate(line.slice(4), { x });
}

/** Slope and intercept of a line; null unless it is a straight line. */
function parts(line: string): { m: number; b: number } | null {
  const f0 = valueOf(line, 0);
  const f1 = valueOf(line, 1);
  const f3 = valueOf(line, 3);
  const fm = valueOf(line, -2);
  if (f0 === null || f1 === null || f3 === null || fm === null) return null;
  const m = f1 - f0;
  if (!close(f3, f0 + 3 * m) || !close(fm, f0 - 2 * m)) return null;
  return { m, b: f0 };
}

function points(text: string): { name: string; x: number; y: number }[] {
  return matches(re('([PQ])\\(', NUMBER6, '\\|', NUMBER6, '\\)'), text).map((m) => ({ name: m[1], x: number(m[2])!, y: number(m[3])! }));
}

/** A whole number the way the course writes it. */
const wholeText = (value: number): string => T.int(int(value));

describe('unit 6: Lineare Funktionen', { timeout: T60 }, () => {
  it('readEquation', () => {
    check('u06.readEquation', (level, p) => {
      const equation = lastLine(p.prompt);
      const pr = parts(equation);
      if (!pr || pr.b === 0 || pr.m === 0) return `equation ${equation}`;
      const { m, b } = pr;
      const asksSlope = p.prompt.startsWith('Welche Steigung');
      if (!(asksSlope || p.prompt.startsWith('Wie groß ist der y-Achsenabschnitt'))) return 'prompt';
      const expected = asksSlope ? m : b;
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed answer';
      const mistakes = asksSlope ? [b, 1 / m, m + b, m * b] : [m, -b / m, b + m, m * b];
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return `wrong option ${option}`;
        if (close(value, expected)) return `wrong option ${option} is right`;
        if (!mistakes.some((x) => close(x, value))) return `wrong option ${option} is no known mistake`;
      }
      if (level === 1 && (m < 1 || m !== Math.round(m))) return 'level 1 has whole positive slopes';
      if (p.pairFront !== `${asksSlope ? 'Steigung' : 'y-Achsenabschnitt'} von ${equation}`) return 'pair front';
      return null;
    });
  });

  it('functionValue', () => {
    check('u06.functionValue', (level, p) => {
      const lines = p.prompt.split('\n');
      const m = lines.length === 2 ? match(/^Gegeben: f\(x\) = (.+)$/, lines[0]) : null;
      const pr = m ? parts('y = ' + m[1]) : null;
      if (lines.length !== 2 || !m || !pr) return 'prompt';
      const rule = 'y = ' + m[1];
      let ask = match(re('^Berechne f\\(', NUMBER6, '\\)\\.$'), lines[1]);
      if (ask) {
        const x = number(ask[1])!;
        const expected = valueOf(rule, x)!;
        const right = number(p.correct);
        if (right === null || !close(right, expected)) return 'correct option';
        const typed = typedAnswer(p);
        if (typed === null || !close(typed, expected)) return 'typed';
        for (const option of problemOptions(p)) {
          const value = number(option);
          if (value === null) return 'wrong option';
          if (close(value, expected)) return `wrong option ${option} is right`;
        }
        if (level === 1 && (x <= 0 || pr.m <= 0)) return 'level 1 positive';
        if (p.pairFront !== `f(x) = ${m[1]}, f(${ask[1]})`) return 'pair front';
        return null;
      }
      ask = match(re('^Für welches x gilt f\\(x\\) = ', NUMBER6, '\\?$'), lines[1]);
      if (ask) {
        if (level !== 3) return 'inverse only at level 3';
        const y = number(ask[1])!;
        const right = number(p.correct);
        const atRight = right === null ? null : valueOf(rule, right);
        if (right === null || atRight === null || !close(atRight, y)) return 'the solution does not fit';
        const typed = typedAnswer(p);
        if (typed === null || !close(typed, right)) return 'typed';
        for (const option of problemOptions(p)) {
          const value = number(option);
          if (value === null) return 'wrong option';
          const at = valueOf(rule, value);
          if (at !== null && close(at, y)) return `wrong option ${option} fits`;
        }
        return null;
      }
      return 'second line';
    });
  });

  it('slopeTriangle', () => {
    check('u06.slopeTriangle', (level, p) => {
      const m = match(/gehst du (\d+) Einheiten nach rechts und (\d+) Einheiten nach (oben|unten)/, p.prompt);
      if (!m) return 'prompt';
      const [dx, up] = [Number(m[1]), Number(m[2])];
      const dy = m[3] === 'oben' ? up : -up;
      const expected = dy / dx;
      if (Math.abs(expected) === 1) return 'slope 1';
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return `correct option ${p.correct}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed';
      // Rising lines have a positive slope, falling ones a negative one.
      if (expected > 0 !== (m[3] === 'oben')) return 'direction';
      const mistakes = [(dx / up) * (dy > 0 ? 1 : -1), dx + up, (up - dx) * (dy > 0 ? 1 : -1), dy];
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        if (close(value, expected)) return `wrong option ${option} is right`;
        if (!mistakes.some((x) => close(x, value))) return `wrong option ${option} is no known mistake`;
      }
      if (level === 1 && (dy <= 0 || dy % dx !== 0)) return 'level 1 rises evenly';
      return null;
    });
  });

  it('zeroPoint', () => {
    check('u06.zeroPoint', (level, p) => {
      const equation = lastLine(p.prompt);
      const pr = parts(equation);
      const zero = number(p.correct);
      if (!p.prompt.startsWith('Berechne die Nullstelle') || !pr || zero === null) return 'prompt';
      const { m, b } = pr;
      const atZero = valueOf(equation, zero);
      if (atZero === null || !(Math.abs(atZero) < 1e-9)) return `f at the zero is ${atZero}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, zero)) return 'typed';
      for (const option of problemOptions(p)) {
        const value = number(option);
        const at = value === null ? null : valueOf(equation, value);
        if (value === null || at === null) return 'wrong option';
        if (Math.abs(at) < 1e-9) return `wrong option ${option} is a zero`;
        if (![b / m, m / b, b, m + b].some((x) => close(x, value))) return `wrong option ${option} is no known mistake`;
      }
      if (level === 3 && zero === Math.round(zero)) return 'level 3 has fractions';
      return null;
    });
  });

  it('slopeTwoPoints', () => {
    check('u06.slopeTwoPoints', (_l, p) => {
      const pts = points(p.prompt);
      if (pts.length !== 2 || pts[0].x === pts[1].x) return 'points';
      const expected = (pts[1].y - pts[0].y) / (pts[1].x - pts[0].x);
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return `correct option ${p.correct}`;
      // The line through P with this slope runs through Q.
      if (!close(pts[0].y + right * (pts[1].x - pts[0].x), pts[1].y)) return 'Q is not on the line';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed';
      const [dx, dy] = [pts[1].x - pts[0].x, pts[1].y - pts[0].y];
      const mistakes = [dx / dy, (pts[1].y + pts[0].y) / (pts[1].x + pts[0].x), dy, dx];
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        if (close(value, expected)) return `wrong option ${option} is right`;
        if (!mistakes.some((x) => close(x, value))) return `wrong option ${option} is no known mistake`;
      }
      if (p.pairFront !== `P(${wholeText(pts[0].x)}|${wholeText(pts[0].y)}), Q(${wholeText(pts[1].x)}|${wholeText(pts[1].y)})`) return `pair front ${p.pairFront ?? ''}`;
      return null;
    });
  });

  it('yIntercept', () => {
    check('u06.yIntercept', (_l, p) => {
      const m = match(re('Steigung ', NUMBER6, ' und geht durch ', 'P\\(', NUMBER6, '\\|', NUMBER6, '\\)'), p.prompt);
      if (!m) return 'prompt';
      const [slope, x, y] = [number(m[1])!, number(m[2])!, number(m[3])!];
      const b = number(p.correct);
      if (b === null || !close(slope * x + b, y)) return 'the point is not on the line';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, b)) return 'typed';
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        if (close(slope * x + value, y)) return `wrong option ${option} is right`;
      }
      return null;
    });
  });

  it('lineThroughTwo', () => {
    check('u06.lineThroughTwo', (level, p) => {
      const pts = points(p.prompt);
      if (pts.length !== 2) return 'points';
      const onLine = (line: string): boolean =>
        pts.every((pt) => {
          const v = valueOf(line, pt.x);
          return v !== null && close(v, pt.y);
        });
      if (!parts(p.correct) || !onLine(p.correct)) return `correct line ${p.correct}`;
      for (const option of problemOptions(p)) {
        if (!parts(option)) return `wrong option ${option} is no line`;
        if (onLine(option)) return `wrong option ${option} goes through both points`;
      }
      const pr = parts(p.correct);
      const typed = typedAnswer(p);
      if (!pr || typed === null || !close(typed, pr.b) || p.typed?.prompt.includes('y-Achsenabschnitt') !== true) return 'typed';
      if (p.pairFront !== `P(${wholeText(pts[0].x)}|${wholeText(pts[0].y)}), Q(${wholeText(pts[1].x)}|${wholeText(pts[1].y)})`) return 'pair front';
      if (level === 3 && !p.correct.includes(',') && !p.correct.includes('x')) return 'line';
      return null;
    });
  });

  it('pointTest', () => {
    check('u06.pointTest', (_l, p) => {
      const equation = lastLine(p.prompt);
      if (!p.prompt.startsWith('Welcher Punkt liegt auf der Geraden?') || !parts(equation)) return 'prompt';
      const right = points(p.correct)[0];
      const y0 = right ? valueOf(equation, right.x) : null;
      if (!right || y0 === null || !close(y0, right.y)) return `correct point ${p.correct}`;
      const options = problemOptions(p);
      if (options.length < 2) return 'options';
      for (const option of options) {
        const point = points(option)[0];
        if (!point) return `wrong option ${option}`;
        const y = valueOf(equation, point.x);
        if (y !== null && close(y, point.y)) return `wrong option ${option} lies on the line`;
      }
      const typedPrompt = p.typed?.prompt;
      const m = typedPrompt ? match(re('^Der Punkt P\\(', NUMBER6, '\\|a\\) liegt auf der Geraden\\.\\n(.+)\\nWie groß ist a\\?$'), typedPrompt) : null;
      if (!m || m[2] !== equation) return 'typed prompt';
      const typed = typedAnswer(p);
      const expected = valueOf(equation, number(m[1])!);
      if (typed === null || expected === null || !close(typed, expected) || !close(expected, right.y)) return 'typed answer';
      return null;
    });
  });

  it('parallel', () => {
    check('u06.parallel', (_l, p) => {
      const g = match(/zu\n(y = .+)\?$/, p.prompt);
      const given = g ? g[1] : null;
      const pr = given ? parts(given) : null;
      if (!p.prompt.startsWith('Welche Gerade verläuft parallel zu\n') || !given || !pr) return 'prompt';
      const right = parts(p.correct);
      if (!right || !close(right.m, pr.m) || close(right.b, pr.b)) return `correct option ${p.correct}`;
      for (const option of problemOptions(p)) {
        const w = parts(option);
        if (!w) return `wrong option ${option}`;
        if (close(w.m, pr.m)) return `wrong option ${option} is parallel`;
      }
      // Through a point: b of the parallel.
      const typedPrompt = p.typed?.prompt;
      const q = typedPrompt ? match(re('geht durch P\\(', NUMBER6, '\\|', NUMBER6, '\\)'), typedPrompt) : null;
      if (!q) return 'typed prompt';
      const [x, y] = [number(q[1])!, number(q[2])!];
      const typed = typedAnswer(p);
      if (typed === null || !close(pr.m * x + typed, y) || !close(typed, right.b)) return 'typed answer';
      return null;
    });
  });

  it('application', () => {
    check('u06.application', (level, p) => {
      const text = p.prompt.split('\n').join(' ');
      let b: number;
      let m: number;
      let askedX: number | null;
      let asksValue: boolean;
      let q: string[] | null;
      if ((q = match(re('kostet ', NUMBER6, ' € Grundgebühr im Monat und ', NUMBER6, ' € je Gesprächsminute\\. (.+)$'), text))) {
        [b, m] = [number(q[1])!, number(q[2])!];
        let a: string[] | null;
        if ((a = match(/Wie viel kostet es bei (\d+) Minuten\?/, q[3]))) {
          askedX = Number(a[1]);
          asksValue = true;
        } else if (match(re('Die Rechnung beträgt ', NUMBER6, ' €\\. Wie viele Minuten wurde telefoniert\\?'), q[3])) {
          askedX = null;
          asksValue = false;
        } else return `question ${q[3]}`;
      } else if ((q = match(re('Eine Kerze ist ', NUMBER6, ' cm hoch und brennt ', NUMBER6, ' cm in jeder Stunde ab\\. (.+)$'), text))) {
        [b, m] = [number(q[1])!, -number(q[2])!];
        let a: string[] | null;
        if ((a = match(/Wie hoch ist sie nach (\d+) Stunden\?/, q[3]))) {
          askedX = Number(a[1]);
          asksValue = true;
        } else if (match(re('Die Kerze ist nur noch ', NUMBER6, ' cm hoch\\. Wie lange brennt sie schon\\?'), q[3])) {
          askedX = null;
          asksValue = false;
        } else return `question ${q[3]}`;
      } else if ((q = match(re('In einem Becken sind ', NUMBER6, ' l Wasser\\. Es kommen ', NUMBER6, ' l je Minute dazu\\. (.+)$'), text))) {
        [b, m] = [number(q[1])!, number(q[2])!];
        let a: string[] | null;
        if ((a = match(/Wie viel Wasser ist nach (\d+) Minuten im Becken\?/, q[3]))) {
          askedX = Number(a[1]);
          asksValue = true;
        } else if (match(re('Im Becken sind jetzt ', NUMBER6, ' l\\. Wie viele Minuten läuft das Wasser schon\\?'), q[3])) {
          askedX = null;
          asksValue = false;
        } else return `question ${q[3]}`;
      } else {
        return 'prompt';
      }
      const right = number(p.correct);
      const typed = typedAnswer(p);
      if (right === null || typed === null || !close(typed, right)) return 'answer';
      if (asksValue) {
        if (!(level < 3) || askedX === null) return 'forward below level 3';
        if (!close(right, b + m * askedX) || !(right > 0)) return 'value';
      } else {
        if (level !== 3) return 'backwards only at level 3';
        // The given value: try every whole number of units.
        const target = text.includes('Rechnung')
          ? number(match(re('beträgt ', NUMBER6, ' €'), text)![1])!
          : number(match(re('(?:noch|jetzt) ', NUMBER6, ' (?:cm hoch|l)'), text)![1])!;
        const hits = span(0, 400).filter((x) => close(b + m * x, target));
        if (hits.length !== 1 || !close(hits[0], right)) return `brute force ${hits} vs ${right}`;
      }
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        if (close(value, right)) return `wrong option ${option} is right`;
      }
      return null;
    });
  });
});

// Unit 7

/** All the letters the course uses as a base stand for the same number, so a law of powers can be checked by value. */
const letters: Record<string, number> = { x: 1.3, a: 1.3, y: 1.3, z: 1.3 };

const evalText = (text: string): number | null => Expr.evaluate(text.split(' ').join(''), letters);

/** "Berechne <expression>." gives the expression. */
function expressionAfter(prefix: string, prompt: string): string | null {
  if (!prompt.startsWith(prefix) || !prompt.endsWith('.')) return null;
  return prompt.slice(prefix.length, -1);
}

function differ(p: Problem, expected: number, parse: (s: string) => number | null): string | null {
  for (const option of problemOptions(p)) {
    const value = parse(option);
    if (value === null) return `wrong option ${option}`;
    if (close(value, expected)) return `wrong option ${option} is right`;
  }
  return null;
}

const superDigits: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

/** The exponent of a power written with superscripts: "x⁷" gives 7. */
function exponentOf(power: string): number | null {
  const text = Array.from(power).map((c) => superDigits[c] ?? '').join('');
  return text === '' ? (power.includes('⁻') ? null : 1) : Number(text);
}

function checkPower(p: Problem): string | null {
  const lines = p.prompt.split('\n');
  const expected = lines.length === 2 ? evalText(lines[1]) : null;
  if (lines.length !== 2 || lines[0] !== 'Vereinfache zu einer Potenz:' || expected === null) return 'prompt';
  const right = evalText(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  const chars = Array.from(p.correct);
  const first = chars.findIndex((c) => c in superDigits);
  const n = exponentOf(first < 0 ? '' : chars.slice(first).join('')) ?? (chars.length <= 2 ? 1 : null);
  if (n === null) return `exponent of ${p.correct}`;
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, n)) return `typed ${typed} expected ${n}`;
  if (p.pairFront !== lines[1]) return 'pair front';
  return differ(p, expected, evalText);
}

describe('unit 7: Potenzen und Wurzeln', { timeout: T60 }, () => {
  it('powerValue', () => {
    check('u07.powerValue', (level, p) => {
      const text = expressionAfter('Berechne ', p.prompt);
      const expected = text === null ? null : evalText(text);
      if (text === null || expected === null) return 'prompt';
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed';
      if (p.pairFront !== text) return 'pair front';
      if (level === 3 && !text.startsWith('(')) return 'level 3 is a fraction or decimal in brackets';
      if (level < 3 && text.includes('(')) return 'no brackets below level 3';
      return differ(p, expected, number);
    });
  });

  it('negativeBase', () => {
    check('u07.negativeBase', (level, p) => {
      const text = expressionAfter('Berechne ', p.prompt);
      const expected = text === null ? null : evalText(text);
      if (text === null || expected === null) return 'prompt';
      // The sign by counting minus factors, another way than evaluating.
      const m = match(/^(\(−(\d)\)|−(\d))(⁰|¹|²|³|⁴)$/, text);
      if (m) {
        const base = Number(m[2] === '' ? m[3] : m[2]);
        const n = exponentOf(m[4])!;
        const bracketed = m[2] !== '';
        const magnitude = Math.pow(base, n);
        const negative = bracketed ? n % 2 === 1 : true;
        if (!close(expected, negative ? -magnitude : magnitude)) return `sign by counting ${expected}`;
      } else if (level !== 3) {
        return `form ${text}`;
      }
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed';
      if (level === 1 && !text.includes('²')) return 'level 1 squares';
      return differ(p, expected, number);
    });
  });

  it('squareRoot', () => {
    check('u07.squareRoot', (_l, p) => {
      const text = expressionAfter('Berechne ', p.prompt);
      const radicand = text !== null && text.startsWith('√') ? evalText(text.slice(1)) : null;
      if (text === null || radicand === null) return 'prompt';
      const right = number(p.correct);
      if (right === null) return 'correct';
      // Squared again: the answer is the number the radicand comes from.
      if (!close(right * right, radicand) || !(right > 0)) return `squared ${right} is not ${radicand}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, right)) return 'typed';
      if (p.pairFront !== text) return 'pair front';
      return differ(p, right, number);
    });
  });

  it('estimateRoot', () => {
    check('u07.estimateRoot', (_l, p) => {
      const m = match(/liegt √(\d+)\?$/, p.prompt);
      const c = match(/^(\d+) und (\d+)$/, p.correct);
      if (!m || !c) return 'prompt';
      const n = Number(m[1]);
      const [low, high] = [Number(c[1]), Number(c[2])];
      const root = Math.sqrt(n);
      if (!(high === low + 1 && low < root && root < high)) return `bounds ${low} ${high} for ${root}`;
      const typed = typedAnswer(p);
      if (typed === null || int(typed) !== int(Math.round(root))) return `nearest whole number ${typed} for ${root}`;
      for (const option of problemOptions(p)) {
        const w = match(/^(\d+) und (\d+)$/, option);
        if (!w) return `wrong option ${option}`;
        const [wl, wh] = [Number(w[1]), Number(w[2])];
        if (wl < root && root < wh) return `wrong option ${option} contains the root`;
      }
      if (p.pairFront !== `√${n}`) return 'pair front';
      return null;
    });
  });

  it('sameBase', () => {
    check('u07.sameBase', (level, p) => {
      const message = checkPower(p);
      if (message) return message;
      const expression = p.prompt.split('\n')[1];
      if (level === 1 && (expression.includes(':') || expression.includes('('))) return 'level 1 multiplies two powers';
      if (level === 3 && !(expression.includes('(') || expression.split(' · ').length === 3)) return 'level 3 form';
      return null;
    });
  });

  it('powerOfPower', () => {
    check('u07.powerOfPower', (level, p) => {
      const message = checkPower(p);
      if (message) return message;
      const expression = p.prompt.split('\n')[1];
      if (!expression.startsWith('(')) return 'bracket first';
      if (level === 1 && (expression.includes(':') || expression.includes('·'))) return 'level 1 is a plain power of a power';
      return null;
    });
  });

  it('sameExponent', () => {
    check('u07.sameExponent', (_l, p) => {
      const lines = p.prompt.split('\n');
      const expected = lines.length === 2 ? evalText(lines[1]) : null;
      if (lines.length !== 2 || lines[0] !== 'Fasse zu einer Potenz zusammen:' || expected === null) return 'prompt';
      const right = evalText(p.correct);
      if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
      const typed = typedAnswer(p);
      if (!p.typed?.prompt.endsWith('Welche Zahl steht in der Basis?') || typed === null) return 'typed prompt';
      const base = match(/^(\d+)[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/, p.correct);
      if (!base || !close(typed, Number(base[1]))) return 'typed answer';
      // Both factors have the same exponent.
      const exponents = matches(/\d+([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, lines[1]).map((m) => m[1]);
      if (exponents.length !== 2 || exponents[0] !== exponents[1]) return 'same exponent';
      return differ(p, expected, evalText);
    });
  });

  it('negativeExponent', () => {
    check('u07.negativeExponent', (level, p) => {
      const m = match(/^Schreibe (.+) als Bruch oder ganze Zahl\.$/, p.prompt);
      const expected = m ? evalText(m[1]) : null;
      if (!m || expected === null) return 'prompt';
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed';
      if (!m[1].includes('⁻')) return 'negative exponent';
      if (level < 3 && m[1].includes('(')) return 'brackets only at level 3';
      if (p.pairFront !== m[1]) return 'pair front';
      return differ(p, expected, number);
    });
  });

  it('scientific', () => {
    check('u07.scientific', (level, p) => {
      const m = match(/^Schreibe (.+) in der Form a · 10ⁿ mit 1 ≤ a < 10\.$/, p.prompt);
      if (!m) return 'prompt';
      const shown = m[1].split(' ').join('');
      const target = number(shown);
      if (target === null) return 'number';
      const partsOf = (text: string): { mantissa: number; exponent: number } | null => {
        const q = match(/^(\d+(?:,\d+)?) · 10(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/, text);
        const mantissa = q ? number(q[1]) : null;
        if (!q || mantissa === null) return null;
        const negative = q[2].startsWith('⁻');
        const e = exponentOf(q[2]);
        if (e === null) return null;
        return { mantissa, exponent: negative ? -e : e };
      };
      const right = partsOf(p.correct);
      if (!right || !(right.mantissa >= 1) || !(right.mantissa < 10)) return `correct option ${p.correct}`;
      if (!close(right.mantissa * Math.pow(10, right.exponent), target)) return `value of ${p.correct} is not ${target}`;
      if (level === 3 && right.exponent >= 0) return 'level 3 is small numbers';
      if (level < 3 && right.exponent < 0) return 'levels 1 and 2 are big numbers';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, right.exponent)) return 'typed';
      for (const option of problemOptions(p)) {
        const w = partsOf(option);
        if (!w) return `wrong option ${option}`;
        const sameValue = close(w.mantissa * Math.pow(10, w.exponent), target);
        const normalised = w.mantissa >= 1 && w.mantissa < 10;
        if (sameValue && normalised) return `wrong option ${option} is right`;
      }
      return null;
    });
  });

  it('rootOfSum', () => {
    check('u07.rootOfSum', (level, p) => {
      const text = expressionAfter('Berechne ', p.prompt);
      const expected = text !== null && text.startsWith('√(') ? evalText(text) : null;
      if (text === null || expected === null) return 'prompt';
      const right = number(p.correct);
      if (right === null || !close(right, expected) || expected !== Math.round(expected)) return `correct option ${p.correct} expected ${expected}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed';
      // The radicand is a perfect square: the answer squared is the radicand.
      const radicand = evalText(text.slice(1));
      if (radicand === null || !close(expected * expected, radicand)) return 'radicand';
      if (level === 1 && text.includes('−')) return 'level 1 adds';
      if (level === 3 && !text.includes('−')) return 'level 3 subtracts';
      return differ(p, expected, number);
    });
  });

  it('cubeRoot', () => {
    check('u07.cubeRoot', (level, p) => {
      const text = expressionAfter('Berechne ³√', p.prompt);
      const radicand = text === null ? null : evalText(text);
      if (text === null || radicand === null) return 'prompt';
      const right = number(p.correct);
      if (right === null) return 'correct';
      // Cubed again: the answer is the number the radicand comes from.
      if (!close(right * right * right, radicand)) return `cubed ${right} is not ${radicand}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, right)) return 'typed';
      if (level < 3 && (radicand < 0 || text.includes('/') || text.includes(','))) return 'plain cubes below level 3';
      if (p.pairFront !== '³√' + text) return `pair front ${p.pairFront ?? ''}`;
      return differ(p, right, number);
    });
  });
});
