// Ports of LernwerkTests/MathCourseMiddleUnit08Tests.swift to Unit10Tests.swift.
import { describe, expect, it } from 'vitest';
import { NumberCheck } from '../../src/lib/learn/numberCheck';
import { type Problem, problemOptions } from '../../src/lib/learn/math/middle/core';
import { Expr, accepts, check, close, integers, match, matches, number, typedAnswer } from './mathMiddleKit';

const T60 = 120_000;
const NUM = '(\\d+(?:,\\d+)?)';
const re = (...parts: string[]): RegExp => new RegExp(parts.join(''));
const plain = (text: string): string => text.split(' ').join('').split('\n').join(' ');

// Unit 8

/** The right option, the typed answer, and the wrong options which must differ in value. */
function checkAnswer(p: Problem, expected: number): string | null {
  const right = number(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return `typed answer ${typed}`;
  for (const option of problemOptions(p)) {
    const value = number(option);
    if (value === null) return `wrong option ${option}`;
    if (close(value, expected)) return `wrong option ${option} is right`;
  }
  return null;
}

/** A unit in metres, so a conversion can be checked by going through the same base unit. */
function unitScale(unit: string): number | null {
  switch (unit) {
    case 'mm²': return 1e-6;
    case 'cm²': return 1e-4;
    case 'dm²': return 1e-2;
    case 'm²': return 1;
    case 'mm³': return 1e-9;
    case 'cm³':
    case 'ml': return 1e-6;
    case 'dm³':
    case 'l': return 1e-3;
    case 'm³': return 1;
    default: return null;
  }
}

describe('unit 8: Geometrie', { timeout: T60 }, () => {
  it('rectangle', () => {
    check('u08.rectangle', (level, p) => {
      const text = plain(p.prompt);
      let m = match(re('Ein Rechteck ist ', NUM, ' (cm|m) lang und ', NUM, ' (?:cm|m) breit\\. Berechne den (Umfang|Flächeninhalt)\\.'), text);
      if (m) {
        if (level >= 3) return 'forward below level 3';
        const [a, b] = [number(m[1])!, number(m[3])!];
        const expected = m[4] === 'Umfang' ? 2 * (a + b) : a * b;
        if (!p.correct.endsWith(m[4] === 'Umfang' ? ` ${m[2]}` : ` ${m[2]}²`)) return `unit of ${p.correct}`;
        return checkAnswer(p, expected);
      }
      m = match(re('Ein Quadrat hat die Seitenlänge ', NUM, ' (cm|m)\\. Berechne den (Umfang|Flächeninhalt)\\.'), text);
      if (m) {
        if (level !== 1) return 'squares at level 1';
        const a = number(m[1])!;
        return checkAnswer(p, m[3] === 'Umfang' ? 4 * a : a * a);
      }
      m = match(re('Ein Rechteck hat den Umfang ', NUM, ' (cm|m) und ist ', NUM, ' (?:cm|m) lang\\. Wie breit ist es\\?'), text);
      if (m) {
        if (level !== 3) return 'backwards at level 3';
        const [u, a] = [number(m[1])!, number(m[3])!];
        const right = number(p.correct);
        if (right === null || !close(2 * (a + right), u)) return 'perimeter does not fit back';
        return checkAnswer(p, right);
      }
      m = match(re('Ein Rechteck hat die Fläche ', NUM, ' (cm|m)² und ist ', NUM, ' (?:cm|m) lang\\. Wie breit ist es\\?'), text);
      if (m) {
        if (level !== 3) return 'backwards at level 3';
        const [area, a] = [number(m[1])!, number(m[3])!];
        const right = number(p.correct);
        if (right === null || !close(a * right, area)) return 'area does not fit back';
        return checkAnswer(p, right);
      }
      return 'prompt';
    });
  });

  it('area', () => {
    check('u08.area', (level, p) => {
      const text = plain(p.prompt);
      let m = match(/Dreieck hat die Grundseite (\d+) (cm|m) und die Höhe (\d+) (?:cm|m)\. Wie groß ist die Fläche\?/, text);
      if (m) return checkAnswer(p, (Number(m[1]) * Number(m[3])) / 2);
      m = match(re('Dreieck hat die Grundseite (\\d+) (cm|m) und die Fläche ', NUM, ' (?:cm|m)²\\. Wie hoch ist das Dreieck\\?'), text);
      if (m) {
        if (level !== 3) return 'backwards at level 3';
        const [g, area] = [Number(m[1]), number(m[3])!];
        const right = number(p.correct);
        if (right === null || !close((g * right) / 2, area)) return 'area does not fit back';
        return checkAnswer(p, right);
      }
      m = match(/Parallelogramm hat die Grundseite (\d+) (cm|m), die Höhe (\d+) (?:cm|m) und die schräge Seite (\d+) (?:cm|m)\./, text);
      if (m) {
        if (!(Number(m[4]) > Number(m[3]))) return 'slanted side must be longer than the height';
        return checkAnswer(p, Number(m[1]) * Number(m[3]));
      }
      m = match(/Trapez hat die parallelen Seiten (\d+) (cm|m) und (\d+) (?:cm|m) und die Höhe (\d+) (?:cm|m)\./, text);
      if (m) {
        if (level < 2) return 'trapezoid from level 2';
        return checkAnswer(p, ((Number(m[1]) + Number(m[3])) / 2) * Number(m[4]));
      }
      return 'prompt';
    });
  });

  it('circle', () => {
    check('u08.circle', (level, p) => {
      const text = plain(p.prompt);
      let m = match(/Ein Kreis hat (den Radius|den Durchmesser) (\d+) (cm|m)\. Berechne (die Fläche|den Umfang) in (?:cm|m)²?\. Gib das Ergebnis als Vielfaches von π an\./, text);
      if (m) {
        const given = Number(m[2]);
        const r = m[1] === 'den Radius' ? given : given / 2;
        if (level === 1 && m[1] !== 'den Radius') return 'level 1 gives the radius';
        // The factor in front of π, by the formula, as Double.
        const expected = m[4] === 'die Fläche' ? r * r : 2 * r;
        if (!p.correct.endsWith('π')) return 'pi';
        return checkAnswer(p, expected);
      }
      m = match(/Der Umfang eines Kreises ist (\d+)π (cm|m)\. Wie groß ist der Radius\?/, text);
      if (m) {
        if (level !== 3) return 'backwards at level 3';
        const right = number(p.correct);
        if (right === null || !close(2 * right, Number(m[1]))) return 'circumference does not fit back';
        return checkAnswer(p, right);
      }
      m = match(/Die Fläche eines Kreises ist (\d+)π (cm|m)²\. Wie groß ist der Radius\?/, text);
      if (m) {
        if (level !== 3) return 'backwards at level 3';
        const right = number(p.correct);
        if (right === null || !close(right * right, Number(m[1]))) return 'area does not fit back';
        return checkAnswer(p, right);
      }
      return 'prompt';
    });
  });

  it('cuboid', () => {
    check('u08.cuboid', (level, p) => {
      const text = plain(p.prompt);
      let m = match(/Ein Quader ist (\d+) cm lang, (\d+) cm breit und (\d+) cm hoch\. Berechne (das Volumen|die Oberfläche)\./, text);
      if (m) {
        const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const expected = m[4] === 'das Volumen' ? a * b * c : 2 * (a * b + a * c + b * c);
        if (!p.correct.endsWith(m[4] === 'das Volumen' ? 'cm³' : 'cm²')) return 'unit';
        if (level === 1 && m[4] !== 'das Volumen') return 'level 1 volume';
        return checkAnswer(p, expected);
      }
      m = match(/Ein Quader mit der Grundfläche (\d+) cm² hat das Volumen (\d+) cm³\. Wie hoch ist er\?/, text);
      if (m) {
        if (level !== 3) return 'backwards at level 3';
        const right = number(p.correct);
        if (right === null || !close(Number(m[1]) * right, Number(m[2]))) return 'volume does not fit back';
        return checkAnswer(p, right);
      }
      return 'prompt';
    });
  });

  it('solid', () => {
    check('u08.solid', (level, p) => {
      const text = plain(p.prompt);
      let m = match(/Ein Prisma hat die Grundfläche (\d+) cm² und die Höhe (\d+) cm\. Wie groß ist das Volumen\?/, text);
      if (m) {
        if (level !== 1) return 'prism at level 1';
        return checkAnswer(p, Number(m[1]) * Number(m[2]));
      }
      m = match(/Ein Zylinder hat (den Radius|den Durchmesser) (\d+) cm und die Höhe (\d+) cm\. Berechne das Volumen in cm³\. Gib das Ergebnis als Vielfaches von π an\./, text);
      if (m) {
        if (level < 2) return 'cylinder from level 2';
        const given = Number(m[2]);
        const r = m[1] === 'den Radius' ? given : given / 2;
        if (level === 2 && m[1] !== 'den Radius') return 'diameter at level 3';
        return checkAnswer(p, r * r * Number(m[3]));
      }
      return 'prompt';
    });
  });

  it('units', () => {
    check('u08.units', (level, p) => {
      const text = plain(p.prompt);
      const m = match(/^Wandle um: (\d+(?:,\d+)?) (\S+) = \? (\S+)$/, text);
      const value = m ? number(m[1]) : null;
      if (!m || value === null) return 'prompt';
      const from = unitScale(m[2]);
      const to = unitScale(m[3]);
      if (from === null || to === null) return `units ${m[2]} ${m[3]}`;
      // Area and volume units are not mixed.
      if (m[2].includes('²') !== m[3].includes('²')) return 'mixed units';
      const expected = (value * from) / to;
      if (!(expected < 1000)) return 'typed answer too big';
      if (level === 1 && (m[2].includes('³') || m[3].includes('³') || m[2] === 'l' || m[3] === 'l')) return 'level 1 has areas';
      return checkAnswer(p, expected);
    });
  });

  it('volumeWord', () => {
    check('u08.volumeWord', (level, p) => {
      const text = plain(p.prompt);
      let m = match(/(?:Ein Aquarium|Ein Wassertank|Eine Kiste) ist (\d+) (dm|cm) lang, (\d+) (?:dm|cm) breit und (\d+) (?:dm|cm) hoch\. Wie viele Liter passen hinein\?/, text);
      if (m) {
        // Through cm³: 1000 cm³ are one liter.
        const factor = m[2] === 'dm' ? 10 : 1;
        const cm3 = Number(m[1]) * factor * Number(m[3]) * factor * Number(m[4]) * factor;
        if (level === 1 && m[2] !== 'dm') return 'level 1 in dm';
        if (level === 2 && m[2] !== 'cm') return 'level 2 in cm';
        return checkAnswer(p, cm3 / 1000);
      }
      m = match(/In ein Becken \((\d+) cm lang, (\d+) cm breit\) werden (\d+) l Wasser gefüllt\. Wie hoch steht das Wasser\?/, text);
      if (m) {
        if (level !== 3) return 'water level at level 3';
        const right = number(p.correct);
        if (right === null || !close(Number(m[1]) * Number(m[2]) * right, Number(m[3]) * 1000)) return 'volume does not fit back';
        return checkAnswer(p, right);
      }
      return 'prompt';
    });
  });

  it('angles', () => {
    check('u08.angles', (level, p) => {
      const text = plain(p.prompt);
      let expected: number;
      let kind: number;
      let m: string[] | null;
      if ((m = match(/In einem Dreieck sind α = (\d+)° und β = (\d+)°\. Wie groß ist γ\?/, text))) {
        [expected, kind] = [180 - Number(m[1]) - Number(m[2]), 0];
      } else if (text.startsWith('Zwei Winkel liegen nebeneinander auf einer Geraden') && (m = match(/Einer ist (\d+)° groß\. Wie groß ist der andere\?/, text))) {
        [expected, kind] = [180 - Number(m[1]), 1];
      } else if ((m = match(/In einem Viereck sind drei Winkel (\d+)°, (\d+)° und (\d+)° groß\. Wie groß ist der vierte Winkel\?/, text))) {
        [expected, kind] = [360 - Number(m[1]) - Number(m[2]) - Number(m[3]), 2];
      } else if ((m = match(/gleichschenkliges Dreieck hat (\d+)° an der Basis\. Wie groß ist der Winkel an der Spitze\?/, text))) {
        [expected, kind] = [180 - 2 * Number(m[1]), 3];
      } else if ((m = match(/gleichschenkliges Dreieck hat (\d+)° an der Spitze\. Wie groß ist ein Basiswinkel\?/, text))) {
        [expected, kind] = [(180 - Number(m[1])) / 2, 3];
      } else if ((m = match(/In einem Dreieck ist α = (\d+)° und β ist (doppelt|dreimal) so groß wie α\. Wie groß ist γ\?/, text))) {
        const a = Number(m[1]);
        [expected, kind] = [180 - a - a * (m[2] === 'doppelt' ? 2 : 3), 4];
      } else {
        return 'prompt';
      }
      if (!(expected > 0 && expected < 180)) return `angle ${expected}`;
      if (level === 1 && kind > 1) return 'level 1 kinds';
      if (level === 3 && kind < 2) return 'level 3 kinds';
      if (!p.correct.endsWith('°')) return 'unit';
      return checkAnswer(p, expected);
    });
  });

  it('pythagoras', () => {
    check('u08.pythagoras', (level, p) => {
      const text = plain(p.prompt);
      let m = match(re('die Katheten ', NUM, ' cm und ', NUM, ' cm lang\\. Wie lang ist die Hypotenuse\\?'), text);
      if (m) {
        const [a, b] = [number(m[1])!, number(m[2])!];
        const c = number(p.correct);
        if (c === null || !close(a * a + b * b, c * c) || !(c > Math.max(a, b))) return 'a² + b² is not c²';
        if (level === 1 && (a > 12 || b > 12)) return 'level 1 small triples';
        return checkAnswer(p, Math.sqrt(a * a + b * b));
      }
      m = match(re('die Hypotenuse ', NUM, ' cm und eine Kathete ', NUM, ' cm lang\\. Wie lang ist die andere Kathete\\?'), text);
      if (m) {
        if (level < 2) return 'legs from level 2';
        const [c, a] = [number(m[1])!, number(m[2])!];
        const b = number(p.correct);
        if (b === null || !close(a * a + b * b, c * c) || !(c > a)) return 'a² + b² is not c²';
        return checkAnswer(p, Math.sqrt(c * c - a * a));
      }
      return 'prompt';
    });
  });

  it('pythagorasWord', () => {
    check('u08.pythagorasWord', (_l, p) => {
      const text = plain(p.prompt);
      let m = match(re('Eine ', NUM, ' m lange Leiter lehnt an einer Wand\\. Ihr Fuß steht ', NUM, ' m von der Wand entfernt\\. Wie hoch reicht die Leiter\\?'), text);
      if (m) {
        const [c, a] = [number(m[1])!, number(m[2])!];
        const h = number(p.correct);
        if (h === null || !close(a * a + h * h, c * c) || !(c > a)) return 'ladder';
        return checkAnswer(p, Math.sqrt(c * c - a * a));
      }
      m =
        match(re('Ein Rechteck ist ', NUM, ' cm lang und ', NUM, ' cm breit\\. Wie lang ist die Diagonale\\?'), text) ??
        match(re('Ein Sportplatz ist ', NUM, ' m lang und ', NUM, ' m breit\\. Anna läuft quer über die Diagonale\\. Wie lang ist ihr Weg\\?'), text);
      if (m) {
        const [a, b] = [number(m[1])!, number(m[2])!];
        const d = number(p.correct);
        if (d === null || !close(a * a + b * b, d * d)) return 'diagonal';
        return checkAnswer(p, Math.sqrt(a * a + b * b));
      }
      return 'prompt';
    });
  });

  it('rightAngleTest', () => {
    check('u08.rightAngleTest', (_l, p) => {
      if (p.prompt !== 'Welche Seitenlängen gehören zu einem rechtwinkligen Dreieck?') return 'prompt';
      const sides = (text: string): number[] | null => {
        const found = matches(/(\d+) cm/, text).map((m) => Number(m[1]));
        return found.length === 3 ? found.sort((a, b) => a - b) : null;
      };
      const right = sides(p.correct);
      if (!right || right[0] * right[0] + right[1] * right[1] !== right[2] * right[2]) return `correct option ${p.correct}`;
      const options = problemOptions(p);
      if (options.length !== 3) return 'three wrong options';
      for (const option of options) {
        const s = sides(option);
        if (!s) return `wrong option ${option}`;
        if (s[0] * s[0] + s[1] * s[1] === s[2] * s[2]) return `wrong option ${option} is right-angled`;
        if (s[0] + s[1] <= s[2]) return `wrong option ${option} is no triangle`;
      }
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, right[0] * right[0] + right[1] * right[1])) return 'typed answer';
      return null;
    });
  });
});

// Unit 9

const valueAt = (text: string, x: number): number | null => Expr.evaluate(text, { x });

/** a, b, c of the quadratic function given by the expression, from f(−1), f(0) and f(1). */
function coefficients(expression: string): { a: number; b: number; c: number } | null {
  const left = valueAt(expression, -1);
  const middle = valueAt(expression, 0);
  const right = valueAt(expression, 1);
  if (left === null || middle === null || right === null) return null;
  return { a: (left + right) / 2 - middle, b: (right - left) / 2, c: middle };
}

/** The expression of "left = right" as left − right. */
function difference(equation: string): string | null {
  const sides = equation.split(' = ');
  if (sides.length !== 2) return null;
  return `(${sides[0]}) − (${sides[1]})`;
}

function rootsOf(equation: string): number[] | null {
  const expression = difference(equation);
  const k = expression ? coefficients(expression) : null;
  if (!k || !(Math.abs(k.a) > 1e-9)) return null;
  const d = k.b * k.b - 4 * k.a * k.c;
  if (d < -1e-9) return [];
  if (Math.abs(d) <= 1e-9) return [-k.b / (2 * k.a)];
  return [(-k.b + Math.sqrt(d)) / (2 * k.a), (-k.b - Math.sqrt(d)) / (2 * k.a)].sort((a, b) => a - b);
}

/** "3 und −1" or "5" as numbers, sorted. */
function solutionSet(text: string): number[] | null {
  const parts = text.split(' und ').map((t) => number(t));
  if (parts.some((x) => x === null)) return null;
  return (parts as number[]).sort((a, b) => a - b);
}

const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((x, i) => close(x, b[i]));

/** After the first line of the prompt. */
const body = (p: Problem): string => p.prompt.split('\n').slice(1).join('\n');

function vertexOf(equation: string): { x: number; y: number } | null {
  if (!equation.startsWith('y = ')) return null;
  const k = coefficients(equation.slice(4));
  if (!k || !(Math.abs(k.a) > 1e-9)) return null;
  const x = -k.b / (2 * k.a);
  const y = valueAt(equation.slice(4), x);
  if (y === null) return null;
  return { x, y };
}

function typedMatches(p: Problem, expected: number): string | null {
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return `typed answer ${typed} expected ${expected}`;
  return null;
}

/** The correct option and the typed answer are the roots of the equation; no wrong option is the same set. */
function checkSolutions(p: Problem, equation: string, typedIsLarger: boolean | null): string | null {
  const truth = rootsOf(equation);
  if (!truth || truth.length !== 2) return `roots of ${equation}`;
  const given = solutionSet(p.correct);
  if (!given || !same(given, truth)) return `correct option ${p.correct} roots ${truth}`;
  // The solutions plugged back in.
  for (const x of given) {
    const expression = difference(equation);
    const residual = expression ? valueAt(expression, x) : null;
    if (residual === null || !(Math.abs(residual) < 1e-9)) return `${x} does not solve ${equation}`;
  }
  for (const option of problemOptions(p)) {
    const set = solutionSet(option);
    if (!set) return `wrong option ${option}`;
    if (same(set, truth)) return `wrong option ${option} is right`;
  }
  if (typedIsLarger !== null) return typedMatches(p, typedIsLarger ? truth[1] : truth[0]);
  return null;
}

describe('unit 9: Quadratische Gleichungen und Funktionen', { timeout: T60 }, () => {
  it('vertexForm', () => {
    check('u09.vertexForm', (_l, p) => {
      const m = match(/^Lies den Scheitelpunkt ab\.\n(y = .+)$/, p.prompt);
      const v = m ? vertexOf(m[1]) : null;
      if (!m || !v) return 'prompt';
      const s = match(/^S\((.+)\|(.+)\)$/, p.correct);
      if (!s || !close(number(s[1])!, v.x) || !close(number(s[2])!, v.y)) return `correct ${p.correct} vertex ${v.x},${v.y}`;
      if (p.pairFront !== m[1]) return 'pair front';
      const asksX = p.typed?.prompt.includes('x-Koordinate') === true;
      return typedMatches(p, asksX ? v.x : v.y);
    });
  });

  it('shift', () => {
    check('u09.shift', (_l, p) => {
      const v = vertexOf(body(p));
      if (!v) return 'prompt';
      const m = match(/^(\d+) nach (rechts|links) und (\d+) nach (oben|unten)$/, p.correct);
      if (!m) return 'correct text';
      const x = (m[2] === 'rechts' ? 1 : -1) * Number(m[1]);
      const y = (m[4] === 'oben' ? 1 : -1) * Number(m[3]);
      if (!close(x, v.x) || !close(y, v.y)) return `${p.correct} vertex ${v.x},${v.y}`;
      return problemOptions(p).includes(p.correct) ? 'right option among the wrong' : null;
    });
  });

  it('functionValue', () => {
    check('u09.functionValue', (_l, p) => {
      const m = match(/^Gegeben: f\(x\) = (.+)\nBerechne f\((.+)\)\.$/, p.prompt);
      const x = m ? number(m[2]) : null;
      const y = m && x !== null ? valueAt(m[1], x) : null;
      if (!m || x === null || y === null) return 'prompt';
      const right = number(p.correct);
      if (right === null || !close(right, y)) return `correct ${p.correct} expected ${y}`;
      for (const option of problemOptions(p)) {
        const v = number(option);
        if (v === null) return `wrong option ${option}`;
        if (close(v, y)) return `wrong option ${option} is right`;
      }
      return typedMatches(p, y);
    });
  });

  it('extremum', () => {
    check('u09.extremum', (_l, p) => {
      const equation = body(p);
      const v = vertexOf(equation);
      const k = coefficients(equation.slice(4));
      if (!v || !k) return 'prompt';
      const lowest = k.a > 0;
      if (p.prompt.startsWith('Welchen')) {
        if (!p.prompt.includes(lowest ? 'kleinsten' : 'größten')) return 'wrong extreme';
        const right = number(p.correct);
        if (right === null || !close(right, v.y)) return `correct ${p.correct} vertex ${v.x},${v.y}`;
        // The value really is the extreme: compare with nearby points.
        for (const dx of [-1, -0.5, 0.5, 1]) {
          const near = valueAt(equation.slice(4), v.x + dx);
          if (near === null) return 'evaluation';
          if (lowest ? near < v.y - 1e-9 : near > v.y + 1e-9) return 'not the extreme';
        }
        return typedMatches(p, v.y);
      }
      if (!p.prompt.includes(lowest ? 'am kleinsten' : 'am größten')) return 'wrong extreme';
      const right = number(p.correct);
      if (right === null || !close(right, v.x)) return `correct ${p.correct} vertex ${v.x},${v.y}`;
      return typedMatches(p, v.x);
    });
  });

  it('pureQuadratic', () => {
    check('u09.pureQuadratic', (_l, p) => {
      const equation = body(p);
      const message = checkSolutions(p, equation, null);
      if (message) return message;
      const truth = rootsOf(equation);
      if (!truth) return 'roots';
      return typedMatches(p, truth[1]);
    });
  });

  it('factorForm', () => {
    check('u09.factorForm', (_l, p) => {
      const equation = body(p);
      if (!equation.endsWith(' = 0')) return 'prompt';
      return checkSolutions(p, equation, p.typed?.prompt.includes('größere') === true);
    });
  });

  it('vertexZeros', () => {
    check('u09.vertexZeros', (level, p) => {
      const equation = body(p);
      if (!equation.startsWith('y = ')) return 'prompt';
      const asEquation = equation.slice(4) + ' = 0';
      if (level === 1 && p.typed === null) return 'typed';
      return checkSolutions(p, asEquation, p.typed?.prompt.includes('größere') === true);
    });
  });

  it('pqSolve', () => {
    check('u09.pqSolve', (_l, p) => {
      const equation = body(p);
      const k = equation.endsWith(' = 0') ? coefficients(equation.slice(0, -4)) : null;
      if (!k || !close(k.a, 1)) return 'normal form';
      if (p.pairFront !== equation) return 'pair front';
      return checkSolutions(p, equation, p.typed?.prompt.includes('größere') === true);
    });
  });

  it('discriminant', () => {
    check('u09.discriminant', (_l, p) => {
      const equation = body(p);
      const k = coefficients(equation.slice(0, -4));
      if (!k || !close(k.a, 1)) return 'normal form';
      // D = (p/2)² − q, once by that formula and once as the discriminant b² − 4ac divided by 4.
      const d = (k.b / 2) * (k.b / 2) - k.c;
      if (!close(d, (k.b * k.b - 4 * k.a * k.c) / 4)) return 'discriminant formulas';
      const expected = d < -1e-9 ? 'keine Lösung' : Math.abs(d) <= 1e-9 ? 'genau eine Lösung' : 'zwei Lösungen';
      if (p.correct !== expected) return `correct ${p.correct} expected ${expected}`;
      const truth = rootsOf(equation);
      if (!truth || truth.length !== (d < -1e-9 ? 0 : Math.abs(d) <= 1e-9 ? 1 : 2)) return 'root count';
      const typedEquation = p.typed ? match(/\n(.+ = 0)$/, p.typed.prompt) : null;
      if (!typedEquation || typedEquation[1] !== equation) return 'typed prompt';
      return typedMatches(p, d);
    });
  });

  it('divideFirst', () => {
    check('u09.divideFirst', (_l, p) => {
      const given = body(p);
      const kGiven = coefficients(given.slice(0, -4));
      if (!kGiven || !(kGiven.a > 1)) return 'prompt';
      // The correct equation is the given one with every coefficient divided by a, so x² stands alone.
      const c = p.correct.endsWith(' = 0') ? coefficients(p.correct.slice(0, -4)) : null;
      if (!c || !(close(c.a, 1) && close(c.b, kGiven.b / kGiven.a) && close(c.c, kGiven.c / kGiven.a))) return `correct ${p.correct}`;
      for (const option of problemOptions(p)) {
        const truth = rootsOf(option);
        const original = rootsOf(given);
        if (truth && original && same(truth, original)) return `wrong option ${option} keeps the roots`;
      }
      if (!p.typed) return 'typed';
      if (p.typed.prompt.startsWith('Löse')) {
        const original = rootsOf(given);
        if (!original) return 'roots';
        return typedMatches(p, original[original.length - 1]);
      }
      return typedMatches(p, p.typed.prompt.includes('vor dem x') ? c.b : c.c);
    });
  });

  it('vertexFromNormal', () => {
    check('u09.vertexFromNormal', (_l, p) => {
      const equation = body(p);
      const v = vertexOf(equation);
      if (!v) return 'prompt';
      const s = match(/^S\((.+)\|(.+)\)$/, p.correct);
      if (!s || !close(number(s[1])!, v.x) || !close(number(s[2])!, v.y)) return `correct ${p.correct} vertex ${v.x},${v.y}`;
      for (const option of problemOptions(p)) {
        const w = match(/^S\((.+)\|(.+)\)$/, option);
        if (!w) return `wrong option ${option}`;
        if (close(number(w[1])!, v.x) && close(number(w[2])!, v.y)) return `wrong option ${option} is right`;
      }
      return typedMatches(p, p.typed?.prompt.includes('x-Koordinate') === true ? v.x : v.y);
    });
  });
});

// Unit 10

/** The right option and the typed answer equal `expected`; the wrong options are other numbers, and a probability
 * strictly between 0 and 1 unless `percent`. The typed answer accepts an unreduced fraction and a decimal. */
function checkProbability(p: Problem, expected: number, percent = false): string | null {
  const right = number(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return `typed answer ${typed}`;
  for (const option of problemOptions(p)) {
    const value = number(option);
    if (value === null) return `wrong option ${option}`;
    if (close(value, expected)) return `wrong option ${option} is right`;
    if (!percent && (value <= 0 || value >= 1)) return `wrong option ${option} is not a probability`;
  }
  const answer = p.typed?.answer;
  if (!answer) return 'no typed answer';
  if (!percent) {
    const hint = p.typed?.prompt;
    if (!hint || !(hint.includes('Bruch oder Dezimalzahl') || hint.includes('Dezimalzahl oder Bruch'))) return 'the typed prompt names the forms';
    const unreduced = `${answer.numerator * 3n}/${answer.denominator * 3n}`;
    if (!accepts(p, unreduced)) return `unreduced ${unreduced} not accepted`;
    let rest = answer.denominator;
    for (const prime of [2n, 5n]) while (rest % prime === 0n) rest /= prime;
    if (rest === 1n) {
      const decimal = String(parseFloat(expected.toPrecision(9))).split('.').join(',');
      if (!accepts(p, decimal)) return `decimal ${decimal} not accepted`;
    }
    if (!accepts(p, p.correct)) return `${p.correct} not accepted`;
    if (accepts(p, `${answer.numerator + 1n}/${answer.denominator}`)) return 'a wrong fraction is accepted';
  }
  return null;
}

/** The balls of the bag in the prompt: "R rote und B blaue Kugeln". */
function bag(text: string): string[] | null {
  const m = match(/(\d+) rote und (\d+) blaue Kugeln/, text);
  if (!m) return null;
  return [...Array(Number(m[1])).fill('r'), ...Array(Number(m[2])).fill('b')];
}

/** The share of the ordered draws of two balls, each ball one index, for which the test holds. */
function share(balls: string[], replacing: boolean, test: (a: string, b: string) => boolean): number {
  let total = 0;
  let hits = 0;
  for (let i = 0; i < balls.length; i++) {
    for (let j = 0; j < balls.length; j++) {
      if (!(replacing || i !== j)) continue;
      total += 1;
      if (test(balls[i], balls[j])) hits += 1;
    }
  }
  return hits / total;
}

describe('unit 10: Wahrscheinlichkeit', { timeout: T60 }, () => {
  it('dieEvent', () => {
    check('u10.dieEvent', (level, p) => {
      const text = plain(p.prompt);
      const m = match(/dass die Zahl (.+) ist\?$/, text);
      if (!m) return 'prompt';
      const sidesMatch = match(/Zahlen 1 bis (\d+)/, text);
      const sides = sidesMatch ? Number(sidesMatch[1]) : 6;
      if (level === 1 && sides !== 6) return 'level 1 is the ordinary die';
      let count = 0;
      for (let face = 1; face <= sides; face++) {
        const phrase = m[1];
        let hit = false;
        let g: string[] | null;
        if ((g = match(/^größer als (\d+)$/, phrase))) hit = face > Number(g[1]);
        else if ((g = match(/^kleiner als (\d+)$/, phrase))) hit = face < Number(g[1]);
        else if (phrase === 'gerade') hit = face % 2 === 0;
        else if (phrase === 'ungerade') hit = face % 2 === 1;
        else if (phrase === 'eine Primzahl') {
          hit = face > 1;
          for (let d = 2; d < face; d++) if (face % d === 0) hit = false;
        } else if ((g = match(/^durch (\d+) teilbar$/, phrase))) hit = face % Number(g[1]) === 0;
        else return `event ${phrase}`;
        if (hit) count += 1;
      }
      return checkProbability(p, count / sides);
    });
  });

  it('urn', () => {
    check('u10.urn', (level, p) => {
      const text = plain(p.prompt);
      const contents = matches(/(\d+) (rote|blaue|grüne|gelbe)/, text.split(' Du ziehst')[0] ?? '');
      const ask = match(/für eine (\S+)(?: oder eine (\S+))? Kugel\?/, text);
      if (contents.length < 2 || !ask) return 'prompt';
      if (level === 1 && contents.length !== 2) return 'two colours at level 1';
      let balls: string[] = [];
      for (const entry of contents) balls = balls.concat(Array(Number(entry[1])).fill(entry[2]));
      const asked = [ask[1], ask[2]].filter((x) => x !== '');
      if (!asked.every((name) => contents.some((c) => c[2] === name))) return 'asked colour is not in the bag';
      const hits = balls.filter((b) => asked.includes(b)).length;
      if (!(hits > 0 && hits < balls.length)) return 'impossible or certain';
      return checkProbability(p, hits / balls.length);
    });
  });

  it('frequency', () => {
    check('u10.frequency', (_l, p) => {
      const first = plain(p.prompt).split(' Wie groß')[0] ?? '';
      const numbers = integers(first);
      if (numbers.length !== 2 || !(numbers[1] < numbers[0])) return 'prompt';
      return checkProbability(p, numbers[1] / numbers[0]);
    });
  });

  it('range', () => {
    check('u10.range', (_l, p) => {
      const isProbability = (text: string): boolean => {
        const value = number(text);
        if (value === null) return false;
        const scaled = text.includes('%') ? value / 100 : value;
        const negative = text.startsWith('−') || text.startsWith('-');
        return !negative && scaled >= 0 && scaled <= 1;
      };
      if (isProbability(p.correct)) return `the right option ${p.correct} is a probability`;
      const options = problemOptions(p);
      for (const option of options) if (!isProbability(option)) return `wrong option ${option} is no probability`;
      return options.length >= 3 ? null : `only ${options.length} probabilities`;
    });
  });

  it('complement', () => {
    check('u10.complement', (level, p) => {
      const text = plain(p.prompt);
      if (text.includes('weder Rot noch Blau')) {
        const m = match(/Rot (\d+)\/(\d+) und für Blau (\d+)\/(\d+)\./, text);
        if (level !== 3 || !m) return 'prompt';
        const a = Number(m[1]) / Number(m[2]);
        const b = Number(m[3]) / Number(m[4]);
        if (!(a + b < 1)) return 'the two colours leave nothing';
        return checkProbability(p, 1 - a - b);
      }
      let m = match(/von (\d+) %\./, text);
      if (m) {
        if (level < 2) return 'percent from level 2';
        if (!p.correct.endsWith(' %')) return 'percent sign';
        return checkProbability(p, 100 - Number(m[1]), true);
      }
      m = match(/mit der Wahrscheinlichkeit (\d+)\/(\d+)\./, text);
      if (m) {
        const value = Number(m[1]) / Number(m[2]);
        if (!(value > 0 && value < 1)) return 'not a proper probability';
        return checkProbability(p, 1 - value);
      }
      return 'prompt';
    });
  });

  it('twoDice', () => {
    check('u10.twoDice', (level, p) => {
      const text = plain(p.prompt);
      const m = match(/Wahrscheinlichkeit\? (.+)\.$/, text);
      if (!m) return 'prompt';
      const event = m[1];
      let count = 0;
      for (let a = 1; a <= 6; a++) {
        for (let b = 1; b <= 6; b++) {
          let hit = false;
          let g: string[] | null;
          if ((g = match(/^Die Augensumme ist (\d+)$/, event))) hit = a + b === Number(g[1]);
          else if ((g = match(/^Die Augensumme ist mindestens (\d+)$/, event))) hit = a + b >= Number(g[1]);
          else if ((g = match(/^Die Augensumme ist höchstens (\d+)$/, event))) hit = a + b <= Number(g[1]);
          else if ((g = match(/^Das Produkt der Zahlen ist (\d+)$/, event))) hit = a * b === Number(g[1]);
          else if (event === 'Beide Würfel zeigen dieselbe Zahl') hit = a === b;
          else if (event === 'Beide Zahlen sind gerade') hit = a % 2 === 0 && b % 2 === 0;
          else if (event === 'Mindestens ein Würfel zeigt eine 6') hit = a === 6 || b === 6;
          else if (event === 'Das Produkt der Zahlen ist gerade') hit = (a * b) % 2 === 0;
          else if (event === 'Die Zahlen unterscheiden sich um genau 2') hit = Math.abs(a - b) === 2;
          else if (event === 'Die Zahlen sind verschieden') hit = a !== b;
          else if (event === 'Die Augensumme ist eine Primzahl') hit = [2, 3, 5, 7, 11].includes(a + b);
          else return `event ${event}`;
          if (hit) count += 1;
        }
      }
      if (level === 1 && !(event.startsWith('Die Augensumme ist ') || event.startsWith('Beide Würfel'))) return 'level 1 events';
      return checkProbability(p, count / 36);
    });
  });

  it('expected', () => {
    check('u10.expected', (_l, p) => {
      const text = plain(p.prompt);
      const shown = match(/Wahrscheinlichkeit (\d+\/\d+|\d+ %)[ .]/, text);
      const trials = match(/(?:(\d+)-mal|werden (\d+) Teile)/, text);
      if (!shown || !trials) return 'prompt';
      const probability = shown[1].endsWith('%') ? number(shown[1])! / 100 : number(shown[1])!;
      const n = Number(trials[1] === '' ? trials[2] : trials[1]);
      const expected = probability * n;
      if (!close(expected, Math.round(expected)) || !(expected >= 1)) return 'expected count is not a whole number';
      return checkProbability(p, expected, true);
    });
  });

  it('withReplacement', () => {
    check('u10.withReplacement', (level, p) => {
      const text = plain(p.prompt);
      const balls = bag(text);
      const m = match(/dass (.+)\?$/, text);
      if (!balls || !text.includes('legst die Kugel nach jedem Zug zurück') || !m) return 'prompt';
      let test: (a: string, b: string) => boolean;
      switch (m[1]) {
        case 'beide Kugeln sind rot':
          test = (a, b) => a === 'r' && b === 'r';
          break;
        case 'beide Kugeln sind blau':
          test = (a, b) => a === 'b' && b === 'b';
          break;
        case 'die erste Kugel ist rot und die zweite blau':
          test = (a, b) => a === 'r' && b === 'b';
          break;
        case 'beide Kugeln haben dieselbe Farbe':
          if (level !== 3) return 'same colour at level 3';
          test = (a, b) => a === b;
          break;
        default:
          return `event ${m[1]}`;
      }
      return checkProbability(p, share(balls, true, test));
    });
  });

  it('withoutReplacement', () => {
    check('u10.withoutReplacement', (level, p) => {
      const text = plain(p.prompt);
      const balls = bag(text);
      const m = match(/dass (.+)\?$/, text);
      if (!balls || !text.includes('ohne zurückzulegen') || !m) return 'prompt';
      let test: (a: string, b: string) => boolean;
      switch (m[1]) {
        case 'beide Kugeln sind rot':
          test = (a, b) => a === 'r' && b === 'r';
          break;
        case 'beide Kugeln sind blau':
          test = (a, b) => a === 'b' && b === 'b';
          break;
        case 'die erste Kugel ist rot und die zweite blau':
          test = (a, b) => a === 'r' && b === 'b';
          break;
        case 'mindestens eine Kugel ist rot':
          if (level !== 3) return 'at least one at level 3';
          test = (a, b) => a === 'r' || b === 'r';
          break;
        default:
          return `event ${m[1]}`;
      }
      return checkProbability(p, share(balls, false, test));
    });
  });

  it('twoPaths', () => {
    check('u10.twoPaths', (_l, p) => {
      const text = plain(p.prompt);
      const balls = bag(text);
      if (!balls || !text.includes('zwei verschiedene Farben')) return 'prompt';
      const replacing = text.includes('legst die Kugel nach jedem Zug zurück');
      if (!(replacing || text.includes('ohne zurückzulegen'))) return 'kind of draw';
      return checkProbability(p, share(balls, replacing, (a, b) => a !== b));
    });
  });

  it('atLeastOne', () => {
    check('u10.atLeastOne', (level, p) => {
      const text = plain(p.prompt);
      let success: number;
      let trials: number;
      let m: string[] | null;
      if ((m = match(/Du wirfst eine Münze (\d+)-mal/, text))) {
        [success, trials] = [0.5, Number(m[1])];
      } else if ((m = match(/Du würfelst (\d+)-mal/, text))) {
        [success, trials] = [1 / 6, Number(m[1])];
      } else if ((m = match(/Wahrscheinlichkeit 1\/(\d+)\. Du drehst (\d+)-mal/, text))) {
        [success, trials] = [1 / Number(m[1]), Number(m[2])];
      } else {
        return 'prompt';
      }
      if (level === 1 && trials > 3) return 'few trials at level 1';
      // Every sequence of hits and misses, the probabilities multiplied along it.
      let total = 0;
      for (let mask = 1; mask < 1 << trials; mask++) {
        let chance = 1;
        for (let bit = 0; bit < trials; bit++) chance *= (mask >> bit) & 1 ? success : 1 - success;
        total += chance;
      }
      return checkProbability(p, total);
    });
  });

  it('the typed forms are accepted', () => {
    for (const text of ['3/4', '0,75', '6/8', '0.75']) expect(NumberCheck.matches(text, '3/4'), text).toBe(true);
    expect(NumberCheck.matches('3/5', '3/4')).toBe(false);
  });
});
