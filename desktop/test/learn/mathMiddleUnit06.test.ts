import { describe, it } from 'vitest';
import { Expression as Expr, check, close, match, matches, number, optionsOf, typedAnswer } from './mathMiddleKit';
import { mathText } from '../../src/lib/learn/math/middle/text';

/** Unit 6, Lineare Funktionen: every line is read back from its text and evaluated with the test's own reader;
 * answers are checked by putting points into the lines and by brute force, wrong options by being no solution. */
const NUM = '(−?\\d+(?:,\\d+)?)';
const num = (s: string) => number(s) as number;
const lastLine = (prompt: string) => prompt.split('\n').at(-1) ?? '';
const text = (value: number) => mathText.int(value);

/** The value of the right side of "y = ..." at x. */
const valueOf = (line: string, x: number): number | null => (line.startsWith('y = ') ? Expr.evaluate(line.slice(4), { x }) : null);

/** Slope and intercept of a line; null unless it is a straight line. */
function parts(line: string): { m: number; b: number } | null {
  const [f0, f1, f3, fm] = [0, 1, 3, -2].map((x) => valueOf(line, x));
  if (f0 === null || f1 === null || f3 === null || fm === null) return null;
  const m = f1 - f0;
  return close(f3, f0 + 3 * m) && close(fm, f0 - 2 * m) ? { m, b: f0 } : null;
}

const points = (s: string) => matches(`([PQ])\\(${NUM}\\|${NUM}\\)`, s).map((m) => ({ name: m[1], x: num(m[2]), y: num(m[3]) }));

describe('math middle unit 6', () => {
  it('readEquation', () => check('u06.readEquation', (level, p) => {
    const equation = lastLine(p.prompt);
    const ab = parts(equation);
    if (!ab || ab.b === 0 || ab.m === 0) return `equation ${equation}`;
    const { m, b } = ab;
    const asksSlope = p.prompt.startsWith('Welche Steigung');
    if (!(asksSlope || p.prompt.startsWith('Wie groß ist der y-Achsenabschnitt'))) return 'prompt';
    const expected = asksSlope ? m : b;
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    const mistakes = asksSlope ? [b, 1 / m, m + b, m * b] : [m, -b / m, b + m, m * b];
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return `wrong option ${option}`;
      if (close(value, expected)) return `wrong option ${option} is right`;
      if (!mistakes.some((x) => close(x, value))) return `wrong option ${option} is no known mistake`;
    }
    if (level === 1 && (m < 1 || m !== Math.round(m))) return 'level 1 has whole positive slopes';
    if (p.pairFront !== `${asksSlope ? 'Steigung' : 'y-Achsenabschnitt'} von ${equation}`) return 'pair front';
    return null;
  }));

  it('functionValue', () => check('u06.functionValue', (level, p) => {
    const lines = p.prompt.split('\n');
    const head = lines.length === 2 ? match('^Gegeben: f\\(x\\) = (.+)$', lines[0]) : null;
    const slope = head ? parts(`y = ${head[1]}`) : null;
    if (!head || !slope) return 'prompt';
    const rule = `y = ${head[1]}`;
    let ask = match(`^Berechne f\\(${NUM}\\)\\.$`, lines[1]);
    if (ask) {
      const x = num(ask[1]);
      const expected = valueOf(rule, x)!;
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return 'correct option';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed';
      for (const option of optionsOf(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        if (close(value, expected)) return `wrong option ${option} is right`;
      }
      if (level === 1 && (x <= 0 || slope.m <= 0)) return 'level 1 positive';
      if (p.pairFront !== `f(x) = ${head[1]}, f(${ask[1]})`) return 'pair front';
      return null;
    }
    ask = match(`^Für welches x gilt f\\(x\\) = ${NUM}\\?$`, lines[1]);
    if (ask) {
      if (level !== 3) return 'inverse only at level 3';
      const y = num(ask[1]);
      const right = number(p.correct);
      const atRight = right === null ? null : valueOf(rule, right);
      if (right === null || atRight === null || !close(atRight, y)) return 'the solution does not fit';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, right)) return 'typed';
      for (const option of optionsOf(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        const at = valueOf(rule, value);
        if (at !== null && close(at, y)) return `wrong option ${option} fits`;
      }
      return null;
    }
    return 'second line';
  }));

  it('slopeTriangle', () => check('u06.slopeTriangle', (level, p) => {
    const m = match('gehst du (\\d+) Einheiten nach rechts und (\\d+) Einheiten nach (oben|unten)', p.prompt);
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
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return 'wrong option';
      if (close(value, expected)) return `wrong option ${option} is right`;
      if (!mistakes.some((x) => close(x, value))) return `wrong option ${option} is no known mistake`;
    }
    if (level === 1 && (dy <= 0 || dy % dx !== 0)) return 'level 1 rises evenly';
    return null;
  }));

  it('zeroPoint', () => check('u06.zeroPoint', (level, p) => {
    const equation = lastLine(p.prompt);
    const ab = p.prompt.startsWith('Berechne die Nullstelle') ? parts(equation) : null;
    const zero = number(p.correct);
    if (!ab || zero === null) return 'prompt';
    const atZero = valueOf(equation, zero);
    if (atZero === null || Math.abs(atZero) >= 1e-9) return `f at the zero is ${atZero}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, zero)) return 'typed';
    for (const option of optionsOf(p)) {
      const value = number(option);
      const at = value === null ? null : valueOf(equation, value);
      if (value === null || at === null) return 'wrong option';
      if (Math.abs(at) < 1e-9) return `wrong option ${option} is a zero`;
      if (![ab.b / ab.m, ab.m / ab.b, ab.b, ab.m + ab.b].some((x) => close(x, value))) return `wrong option ${option} is no known mistake`;
    }
    if (level === 3 && zero === Math.round(zero)) return 'level 3 has fractions';
    return null;
  }));

  it('slopeTwoPoints', () => check('u06.slopeTwoPoints', (_l, p) => {
    const pts = points(p.prompt);
    if (pts.length !== 2 || pts[0].x === pts[1].x) return 'points';
    const [dx, dy] = [pts[1].x - pts[0].x, pts[1].y - pts[0].y];
    const expected = dy / dx;
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct}`;
    // The line through P with this slope runs through Q.
    if (!close(pts[0].y + right * dx, pts[1].y)) return 'Q is not on the line';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed';
    const mistakes = [dx / dy, (pts[1].y + pts[0].y) / (pts[1].x + pts[0].x), dy, dx];
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return 'wrong option';
      if (close(value, expected)) return `wrong option ${option} is right`;
      if (!mistakes.some((x) => close(x, value))) return `wrong option ${option} is no known mistake`;
    }
    if (p.pairFront !== `P(${text(pts[0].x)}|${text(pts[0].y)}), Q(${text(pts[1].x)}|${text(pts[1].y)})`) return `pair front ${p.pairFront ?? ''}`;
    return null;
  }));

  it('yIntercept', () => check('u06.yIntercept', (_l, p) => {
    const m = match(`Steigung ${NUM} und geht durch P\\(${NUM}\\|${NUM}\\)`, p.prompt);
    if (!m) return 'prompt';
    const [slope, x, y] = [num(m[1]), num(m[2]), num(m[3])];
    const b = number(p.correct);
    if (b === null || !close(slope * x + b, y)) return 'the point is not on the line';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, b)) return 'typed';
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return 'wrong option';
      if (close(slope * x + value, y)) return `wrong option ${option} is right`;
    }
    return null;
  }));

  it('lineThroughTwo', () => check('u06.lineThroughTwo', (level, p) => {
    const pts = points(p.prompt);
    if (pts.length !== 2) return 'points';
    const onLine = (line: string) => pts.every((pt) => { const v = valueOf(line, pt.x); return v !== null && close(v, pt.y); });
    if (!parts(p.correct) || !onLine(p.correct)) return `correct line ${p.correct}`;
    for (const option of optionsOf(p)) {
      if (!parts(option)) return `wrong option ${option} is no line`;
      if (onLine(option)) return `wrong option ${option} goes through both points`;
    }
    const ab = parts(p.correct)!;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, ab.b) || !p.typed?.prompt.includes('y-Achsenabschnitt')) return 'typed';
    if (p.pairFront !== `P(${text(pts[0].x)}|${text(pts[0].y)}), Q(${text(pts[1].x)}|${text(pts[1].y)})`) return 'pair front';
    if (level === 3 && !p.correct.includes(',') && !p.correct.includes('x')) return 'line';
    return null;
  }));

  it('pointTest', () => check('u06.pointTest', (_l, p) => {
    const equation = lastLine(p.prompt);
    if (!p.prompt.startsWith('Welcher Punkt liegt auf der Geraden?') || !parts(equation)) return 'prompt';
    const right = points(p.correct)[0];
    const y = right ? valueOf(equation, right.x) : null;
    if (!right || y === null || !close(y, right.y)) return `correct point ${p.correct}`;
    const options = optionsOf(p);
    if (options.length < 2) return 'options';
    for (const option of options) {
      const point = points(option)[0];
      if (!point) return `wrong option ${option}`;
      const v = valueOf(equation, point.x);
      if (v !== null && close(v, point.y)) return `wrong option ${option} lies on the line`;
    }
    const m = p.typed ? match(`^Der Punkt P\\(${NUM}\\|a\\) liegt auf der Geraden\\.\\n(.+)\\nWie groß ist a\\?$`, p.typed.prompt) : null;
    if (!m || m[2] !== equation) return 'typed prompt';
    const typed = typedAnswer(p);
    const expected = valueOf(equation, num(m[1]));
    if (typed === null || expected === null || !close(typed, expected) || !close(expected, right.y)) return 'typed answer';
    return null;
  }));

  it('parallel', () => check('u06.parallel', (_l, p) => {
    const given = p.prompt.startsWith('Welche Gerade verläuft parallel zu\n') ? match('zu\\n(y = .+)\\?$', p.prompt)?.[1] : undefined;
    const ab = given ? parts(given) : null;
    if (!ab) return 'prompt';
    const right = parts(p.correct);
    if (!right || !close(right.m, ab.m) || close(right.b, ab.b)) return `correct option ${p.correct}`;
    for (const option of optionsOf(p)) {
      const w = parts(option);
      if (!w) return `wrong option ${option}`;
      if (close(w.m, ab.m)) return `wrong option ${option} is parallel`;
    }
    // Through a point: b of the parallel.
    const q = p.typed ? match(`geht durch P\\(${NUM}\\|${NUM}\\)`, p.typed.prompt) : null;
    if (!q) return 'typed prompt';
    const [x, y] = [num(q[1]), num(q[2])];
    const typed = typedAnswer(p);
    if (typed === null || !close(ab.m * x + typed, y) || !close(typed, right.b)) return 'typed answer';
    return null;
  }));

  it('application', () => check('u06.application', (level, p) => {
    const t = p.prompt.split('\n').join(' ');
    let b: number;
    let m: number;
    let askedX: number | null;
    let asksValue: boolean;
    let q: string[] | null;
    const question = (rest: string, forward: string, backward: string): boolean => {
      const a = match(forward, rest);
      if (a) { askedX = Number(a[1]); asksValue = true; return true; }
      if (match(backward, rest)) { askedX = null; asksValue = false; return true; }
      return false;
    };
    if ((q = match(`kostet ${NUM} € Grundgebühr im Monat und ${NUM} € je Gesprächsminute\\. (.+)$`, t))) {
      [b, m] = [num(q[1]), num(q[2])];
      if (!question(q[3], 'Wie viel kostet es bei (\\d+) Minuten\\?', `Die Rechnung beträgt ${NUM} €\\. Wie viele Minuten wurde telefoniert\\?`)) return `question ${q[3]}`;
    } else if ((q = match(`Eine Kerze ist ${NUM} cm hoch und brennt ${NUM} cm in jeder Stunde ab\\. (.+)$`, t))) {
      [b, m] = [num(q[1]), -num(q[2])];
      if (!question(q[3], 'Wie hoch ist sie nach (\\d+) Stunden\\?', `Die Kerze ist nur noch ${NUM} cm hoch\\. Wie lange brennt sie schon\\?`)) return `question ${q[3]}`;
    } else if ((q = match(`In einem Becken sind ${NUM} l Wasser\\. Es kommen ${NUM} l je Minute dazu\\. (.+)$`, t))) {
      [b, m] = [num(q[1]), num(q[2])];
      if (!question(q[3], 'Wie viel Wasser ist nach (\\d+) Minuten im Becken\\?', `Im Becken sind jetzt ${NUM} l\\. Wie viele Minuten läuft das Wasser schon\\?`)) return `question ${q[3]}`;
    } else return 'prompt';
    const right = number(p.correct);
    const typed = typedAnswer(p);
    if (right === null || typed === null || !close(typed, right)) return 'answer';
    if (asksValue!) {
      if (level >= 3 || askedX! === null) return 'forward below level 3';
      if (!close(right, b + m * askedX!) || !(right > 0)) return 'value';
    } else {
      if (level !== 3) return 'backwards only at level 3';
      // The given value: try every whole number of units.
      const target = t.includes('Rechnung') ? num(match(`beträgt ${NUM} €`, t)![1]) : num(match(`(?:noch|jetzt) ${NUM} (?:cm hoch|l)`, t)![1]);
      const hits = Array.from({ length: 401 }, (_, i) => i).filter((i) => close(b + m * i, target));
      if (hits.length !== 1 || !close(hits[0], right)) return `brute force ${hits} vs ${right}`;
    }
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return 'wrong option';
      if (close(value, right)) return `wrong option ${option} is right`;
    }
    return null;
  }));
});
