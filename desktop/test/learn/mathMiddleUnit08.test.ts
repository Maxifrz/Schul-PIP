import { describe, it } from 'vitest';
import { check, close, match, matches, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';

/** Unit 8, Geometrie: every number is read back from the prompt and the formula is applied again with floating point;
 * the theorem of Pythagoras is checked by squaring, the angle sums by adding, the unit conversions through metres. */
const N = '(\\d+(?:,\\d+)?)';
const num = (s: string) => number(s) as number;
const plain = (text: string) => text.split(' ').join('').split('\n').join(' ');

/** The right option, the typed answer, and the wrong options which must differ in value. */
function verify(p: Problem, expected: number): string | null {
  const right = number(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return `typed answer ${typed}`;
  for (const option of optionsOf(p)) {
    const value = number(option);
    if (value === null) return `wrong option ${option}`;
    if (close(value, expected)) return `wrong option ${option} is right`;
  }
  return null;
}

describe('math middle unit 8', () => {
  it('rectangle', () => check('u08.rectangle', (level, p) => {
    const text = plain(p.prompt);
    let m = match(`Ein Rechteck ist ${N} (cm|m) lang und ${N} (?:cm|m) breit\\. Berechne den (Umfang|Flächeninhalt)\\.`, text);
    if (m) {
      if (level >= 3) return 'forward below level 3';
      const [a, b] = [num(m[1]), num(m[3])];
      const expected = m[4] === 'Umfang' ? 2 * (a + b) : a * b;
      if (!p.correct.endsWith(m[4] === 'Umfang' ? ` ${m[2]}` : ` ${m[2]}²`)) return `unit of ${p.correct}`;
      return verify(p, expected);
    }
    m = match(`Ein Quadrat hat die Seitenlänge ${N} (cm|m)\\. Berechne den (Umfang|Flächeninhalt)\\.`, text);
    if (m) {
      if (level !== 1) return 'squares at level 1';
      const a = num(m[1]);
      return verify(p, m[3] === 'Umfang' ? 4 * a : a * a);
    }
    m = match(`Ein Rechteck hat den Umfang ${N} (cm|m) und ist ${N} (?:cm|m) lang\\. Wie breit ist es\\?`, text);
    if (m) {
      if (level !== 3) return 'backwards at level 3';
      const [u, a] = [num(m[1]), num(m[3])];
      const right = number(p.correct);
      if (right === null || !close(2 * (a + right), u)) return 'perimeter does not fit back';
      return verify(p, right);
    }
    m = match(`Ein Rechteck hat die Fläche ${N} (cm|m)² und ist ${N} (?:cm|m) lang\\. Wie breit ist es\\?`, text);
    if (m) {
      if (level !== 3) return 'backwards at level 3';
      const [area, a] = [num(m[1]), num(m[3])];
      const right = number(p.correct);
      if (right === null || !close(a * right, area)) return 'area does not fit back';
      return verify(p, right);
    }
    return 'prompt';
  }));

  it('area', () => check('u08.area', (level, p) => {
    const text = plain(p.prompt);
    let m = match('Dreieck hat die Grundseite (\\d+) (cm|m) und die Höhe (\\d+) (?:cm|m)\\. Wie groß ist die Fläche\\?', text);
    if (m) return verify(p, (Number(m[1]) * Number(m[3])) / 2);
    m = match(`Dreieck hat die Grundseite (\\d+) (cm|m) und die Fläche ${N} (?:cm|m)²\\. Wie hoch ist das Dreieck\\?`, text);
    if (m) {
      if (level !== 3) return 'backwards at level 3';
      const [g, area] = [Number(m[1]), num(m[3])];
      const right = number(p.correct);
      if (right === null || !close((g * right) / 2, area)) return 'area does not fit back';
      return verify(p, right);
    }
    m = match('Parallelogramm hat die Grundseite (\\d+) (cm|m), die Höhe (\\d+) (?:cm|m) und die schräge Seite (\\d+) (?:cm|m)\\.', text);
    if (m) {
      if (!(Number(m[4]) > Number(m[3]))) return 'slanted side must be longer than the height';
      return verify(p, Number(m[1]) * Number(m[3]));
    }
    m = match('Trapez hat die parallelen Seiten (\\d+) (cm|m) und (\\d+) (?:cm|m) und die Höhe (\\d+) (?:cm|m)\\.', text);
    if (m) {
      if (level < 2) return 'trapezoid from level 2';
      return verify(p, ((Number(m[1]) + Number(m[3])) / 2) * Number(m[4]));
    }
    return 'prompt';
  }));

  it('circle', () => check('u08.circle', (level, p) => {
    const text = plain(p.prompt);
    let m = match('Ein Kreis hat (den Radius|den Durchmesser) (\\d+) (cm|m)\\. Berechne (die Fläche|den Umfang) in (?:cm|m)²?\\. Gib das Ergebnis als Vielfaches von π an\\.', text);
    if (m) {
      const given = Number(m[2]);
      const r = m[1] === 'den Radius' ? given : given / 2;
      if (level === 1 && m[1] !== 'den Radius') return 'level 1 gives the radius';
      // The factor in front of π, by the formula.
      const expected = m[4] === 'die Fläche' ? r * r : 2 * r;
      if (!p.correct.endsWith('π')) return 'pi';
      return verify(p, expected);
    }
    m = match('Der Umfang eines Kreises ist (\\d+)π (cm|m)\\. Wie groß ist der Radius\\?', text);
    if (m) {
      if (level !== 3) return 'backwards at level 3';
      const right = number(p.correct);
      if (right === null || !close(2 * right, Number(m[1]))) return 'circumference does not fit back';
      return verify(p, right);
    }
    m = match('Die Fläche eines Kreises ist (\\d+)π (cm|m)²\\. Wie groß ist der Radius\\?', text);
    if (m) {
      if (level !== 3) return 'backwards at level 3';
      const right = number(p.correct);
      if (right === null || !close(right * right, Number(m[1]))) return 'area does not fit back';
      return verify(p, right);
    }
    return 'prompt';
  }));

  it('cuboid', () => check('u08.cuboid', (level, p) => {
    const text = plain(p.prompt);
    let m = match('Ein Quader ist (\\d+) cm lang, (\\d+) cm breit und (\\d+) cm hoch\\. Berechne (das Volumen|die Oberfläche)\\.', text);
    if (m) {
      const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const expected = m[4] === 'das Volumen' ? a * b * c : 2 * (a * b + a * c + b * c);
      if (!p.correct.endsWith(m[4] === 'das Volumen' ? 'cm³' : 'cm²')) return 'unit';
      if (level === 1 && m[4] !== 'das Volumen') return 'level 1 volume';
      return verify(p, expected);
    }
    m = match('Ein Quader mit der Grundfläche (\\d+) cm² hat das Volumen (\\d+) cm³\\. Wie hoch ist er\\?', text);
    if (m) {
      if (level !== 3) return 'backwards at level 3';
      const right = number(p.correct);
      if (right === null || !close(Number(m[1]) * right, Number(m[2]))) return 'volume does not fit back';
      return verify(p, right);
    }
    return 'prompt';
  }));

  it('solid', () => check('u08.solid', (level, p) => {
    const text = plain(p.prompt);
    let m = match('Ein Prisma hat die Grundfläche (\\d+) cm² und die Höhe (\\d+) cm\\. Wie groß ist das Volumen\\?', text);
    if (m) {
      if (level !== 1) return 'prism at level 1';
      return verify(p, Number(m[1]) * Number(m[2]));
    }
    m = match('Ein Zylinder hat (den Radius|den Durchmesser) (\\d+) cm und die Höhe (\\d+) cm\\. Berechne das Volumen in cm³\\. Gib das Ergebnis als Vielfaches von π an\\.', text);
    if (m) {
      if (level < 2) return 'cylinder from level 2';
      const given = Number(m[2]);
      const r = m[1] === 'den Radius' ? given : given / 2;
      if (level === 2 && m[1] !== 'den Radius') return 'diameter at level 3';
      return verify(p, r * r * Number(m[3]));
    }
    return 'prompt';
  }));

  /** A unit in cubic or square metres, so a conversion can be checked by going through the same base unit. */
  const scale = (unit: string): number | null => ({
    'mm²': 1e-6, 'cm²': 1e-4, 'dm²': 1e-2, 'm²': 1, 'mm³': 1e-9, 'cm³': 1e-6, ml: 1e-6, 'dm³': 1e-3, l: 1e-3, 'm³': 1,
  } as Record<string, number>)[unit] ?? null;

  it('units', () => check('u08.units', (level, p) => {
    const text = plain(p.prompt);
    const m = match(`^Wandle um: ${N} (\\S+) = \\? (\\S+)$`, text);
    const value = m ? number(m[1]) : null;
    if (!m || value === null) return 'prompt';
    const from = scale(m[2]);
    const to = scale(m[3]);
    if (from === null || to === null) return `units ${m[2]} ${m[3]}`;
    // Area and volume units are not mixed.
    if (m[2].includes('²') !== m[3].includes('²')) return 'mixed units';
    const expected = (value * from) / to;
    if (!(expected < 1000)) return 'typed answer too big';
    if (level === 1 && (m[2].includes('³') || m[3].includes('³') || m[2] === 'l' || m[3] === 'l')) return 'level 1 has areas';
    return verify(p, expected);
  }));

  it('volumeWord', () => check('u08.volumeWord', (level, p) => {
    const text = plain(p.prompt);
    let m = match('(?:Ein Aquarium|Ein Wassertank|Eine Kiste) ist (\\d+) (dm|cm) lang, (\\d+) (?:dm|cm) breit und (\\d+) (?:dm|cm) hoch\\. Wie viele Liter passen hinein\\?', text);
    if (m) {
      // Through cm³: 1000 cm³ are one liter.
      const factor = m[2] === 'dm' ? 10 : 1;
      const cm3 = Number(m[1]) * factor * Number(m[3]) * factor * Number(m[4]) * factor;
      if (level === 1 && m[2] !== 'dm') return 'level 1 in dm';
      if (level === 2 && m[2] !== 'cm') return 'level 2 in cm';
      return verify(p, cm3 / 1000);
    }
    m = match('In ein Becken \\((\\d+) cm lang, (\\d+) cm breit\\) werden (\\d+) l Wasser gefüllt\\. Wie hoch steht das Wasser\\?', text);
    if (m) {
      if (level !== 3) return 'water level at level 3';
      const right = number(p.correct);
      if (right === null || !close(Number(m[1]) * Number(m[2]) * right, Number(m[3]) * 1000)) return 'volume does not fit back';
      return verify(p, right);
    }
    return 'prompt';
  }));

  it('angles', () => check('u08.angles', (level, p) => {
    const text = plain(p.prompt);
    let expected: number;
    let kind: number;
    let m: string[] | null;
    if ((m = match('In einem Dreieck sind α = (\\d+)° und β = (\\d+)°\\. Wie groß ist γ\\?', text))) [expected, kind] = [180 - Number(m[1]) - Number(m[2]), 0];
    else if (text.startsWith('Zwei Winkel liegen nebeneinander auf einer Geraden') && (m = match('Einer ist (\\d+)° groß\\. Wie groß ist der andere\\?', text))) [expected, kind] = [180 - Number(m[1]), 1];
    else if ((m = match('In einem Viereck sind drei Winkel (\\d+)°, (\\d+)° und (\\d+)° groß\\. Wie groß ist der vierte Winkel\\?', text))) [expected, kind] = [360 - Number(m[1]) - Number(m[2]) - Number(m[3]), 2];
    else if ((m = match('gleichschenkliges Dreieck hat (\\d+)° an der Basis\\. Wie groß ist der Winkel an der Spitze\\?', text))) [expected, kind] = [180 - 2 * Number(m[1]), 3];
    else if ((m = match('gleichschenkliges Dreieck hat (\\d+)° an der Spitze\\. Wie groß ist ein Basiswinkel\\?', text))) [expected, kind] = [(180 - Number(m[1])) / 2, 3];
    else if ((m = match('In einem Dreieck ist α = (\\d+)° und β ist (doppelt|dreimal) so groß wie α\\. Wie groß ist γ\\?', text))) {
      const a = Number(m[1]);
      [expected, kind] = [180 - a - a * (m[2] === 'doppelt' ? 2 : 3), 4];
    } else return 'prompt';
    if (!(expected > 0 && expected < 180)) return `angle ${expected}`;
    if (level === 1 && kind > 1) return 'level 1 kinds';
    if (level === 3 && kind < 2) return 'level 3 kinds';
    if (!p.correct.endsWith('°')) return 'unit';
    return verify(p, expected);
  }));

  it('pythagoras', () => check('u08.pythagoras', (level, p) => {
    const text = plain(p.prompt);
    let m = match(`die Katheten ${N} cm und ${N} cm lang\\. Wie lang ist die Hypotenuse\\?`, text);
    if (m) {
      const [a, b] = [num(m[1]), num(m[2])];
      const c = number(p.correct);
      if (c === null || !close(a * a + b * b, c * c) || !(c > Math.max(a, b))) return 'a² + b² is not c²';
      if (level === 1 && (a > 12 || b > 12)) return 'level 1 small triples';
      return verify(p, Math.sqrt(a * a + b * b));
    }
    m = match(`die Hypotenuse ${N} cm und eine Kathete ${N} cm lang\\. Wie lang ist die andere Kathete\\?`, text);
    if (m) {
      if (level < 2) return 'legs from level 2';
      const [c, a] = [num(m[1]), num(m[2])];
      const b = number(p.correct);
      if (b === null || !close(a * a + b * b, c * c) || !(c > a)) return 'a² + b² is not c²';
      return verify(p, Math.sqrt(c * c - a * a));
    }
    return 'prompt';
  }));

  it('pythagorasWord', () => check('u08.pythagorasWord', (_l, p) => {
    const text = plain(p.prompt);
    let m = match(`Eine ${N} m lange Leiter lehnt an einer Wand\\. Ihr Fuß steht ${N} m von der Wand entfernt\\. Wie hoch reicht die Leiter\\?`, text);
    if (m) {
      const [c, a] = [num(m[1]), num(m[2])];
      const h = number(p.correct);
      if (h === null || !close(a * a + h * h, c * c) || !(c > a)) return 'ladder';
      return verify(p, Math.sqrt(c * c - a * a));
    }
    m = match(`Ein Rechteck ist ${N} cm lang und ${N} cm breit\\. Wie lang ist die Diagonale\\?`, text)
      ?? match(`Ein Sportplatz ist ${N} m lang und ${N} m breit\\. Anna läuft quer über die Diagonale\\. Wie lang ist ihr Weg\\?`, text);
    if (m) {
      const [a, b] = [num(m[1]), num(m[2])];
      const d = number(p.correct);
      if (d === null || !close(a * a + b * b, d * d)) return 'diagonal';
      return verify(p, Math.sqrt(a * a + b * b));
    }
    return 'prompt';
  }));

  it('rightAngleTest', () => check('u08.rightAngleTest', (_l, p) => {
    if (p.prompt !== 'Welche Seitenlängen gehören zu einem rechtwinkligen Dreieck?') return 'prompt';
    const sides = (text: string): number[] | null => {
      const found = matches('(\\d+) cm', text).map((m) => Number(m[1]));
      return found.length === 3 ? found.sort((a, b) => a - b) : null;
    };
    const right = sides(p.correct);
    if (!right || right[0] * right[0] + right[1] * right[1] !== right[2] * right[2]) return `correct option ${p.correct}`;
    const options = optionsOf(p);
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
  }));
});
