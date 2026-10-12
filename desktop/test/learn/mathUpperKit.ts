// Independent checks for the upper-school maths course (a port of LernwerkTests/MathCourseUpperKit.swift). The kit
// re-computes every answer another way: numeric differentiation, Simpson integration, direct enumeration, plain
// number arithmetic and plugging solutions back in, so a mistake in a template cannot hide behind the code that
// produced it.
import { folded } from '../../src/lib/learn/exercise';
import { NumberCheck, Rational } from '../../src/lib/learn/numberCheck';
import { MathUpperCatalog } from '../../src/lib/learn/math/upper/catalog';
import { UGen, UQ, type UExtremum, type UFact, type UProblem, type USymmetry } from '../../src/lib/learn/math/upper/core';

export interface Draw {
  level: number;
  seed: bigint;
  problem: UProblem;
}

const cache = new Map<string, Draw[]>();

/** Draws of one template: levels 1 to 3, seeds 1...`seeds` (Swift uses 300). */
export function draws(id: string, seeds: number): Draw[] {
  const key = `${id}|${seeds}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const template = MathUpperCatalog.template(id);
  if (!template) throw new Error(`No template ${id}`);
  const result: Draw[] = [];
  for (let level = 1; level <= 3; level++) {
    for (let seed = 1; seed <= seeds; seed++) {
      const s = BigInt(seed) * 7919n + BigInt(level);
      const problem = template.make(level, new UGen(s));
      if (problem) result.push({ level, seed: s, problem });
    }
  }
  cache.set(key, result);
  return result;
}

export const allIDs: string[] = MathUpperCatalog.units.flatMap((u) => u.map((t) => t.id));

// Numeric tools

export function derivative(f: (x: number) => number, x: number): number {
  const h = 1e-5;
  return (f(x + h) - f(x - h)) / (2 * h);
}

export function simpson(f: (x: number) => number, a: number, b: number, n = 4000): number {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 === 0 ? 2 : 4);
  return (sum * h) / 3;
}

export function close(a: number, b: number, tolerance = 1e-4): boolean {
  return Math.abs(a - b) <= tolerance * (1 + Math.max(Math.abs(a), Math.abs(b)));
}

export const minus = (n: number): string => (n < 0 ? `−${-n}` : `${n}`);

/** "3π/4", "π/2", "−π", "0", "4π" as a multiple of pi. */
export function parsePi(text: string): number | null {
  let t = text;
  let sign = 1;
  if (t.startsWith('−')) {
    sign = -1;
    t = t.slice(1);
  }
  if (t === '0') return 0;
  const parts = t.split('π');
  if (parts.length !== 2) return null;
  const coefficient = parts[0] === '' ? 1 : Number(parts[0]);
  let denominator = 1;
  if (parts[1] !== '') {
    if (!parts[1].startsWith('/')) return null;
    const d = Number(parts[1].slice(1));
    if (Number.isNaN(d)) return null;
    denominator = d;
  }
  if (Number.isNaN(coefficient)) return null;
  return (sign * coefficient) / denominator;
}

const magnitudes: Record<string, number> = {
  '0': 0,
  '1/2': 0.5,
  '√2/2': Math.sqrt(2) / 2,
  '√3/2': Math.sqrt(3) / 2,
  '1': 1,
  '√3': Math.sqrt(3),
  '√3/3': Math.sqrt(3) / 3,
};

export function parseExact(text: string): number | null {
  let t = text;
  let sign = 1;
  if (t.startsWith('−')) {
    sign = -1;
    t = t.slice(1);
  }
  const m = Object.prototype.hasOwnProperty.call(magnitudes, t) ? magnitudes[t] : undefined;
  return m === undefined ? null : sign * m;
}

export function trig(fn: string, radians: number): number {
  switch (fn) {
    case 'sin':
      return Math.sin(radians);
    case 'cos':
      return Math.cos(radians);
    default:
      return Math.tan(radians);
  }
}

/** Reads "P(A) = 0,4" style numbers from a prompt. */
export function promptNumber(prompt: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(escaped + ' = ([0-9]+(?:,[0-9]+)?)').exec(prompt);
  if (!match) return null;
  return Number(match[1].replace(',', '.'));
}

export const vectorText = (v: readonly number[]): string => '(' + v.map(minus).join(' | ') + ')';

export function lineContains(a: number[], u: number[], p: number[]): boolean {
  let t: number | null = null;
  for (let i = 0; i < 3; i++) {
    if (u[i] === 0) {
      if (p[i] !== a[i]) return false;
      continue;
    }
    const value = (p[i] - a[i]) / u[i];
    if (t !== null) {
      if (Math.abs(t - value) > 1e-12) return false;
    } else {
      t = value;
    }
  }
  return true;
}

export function binomialDoubles(n: number): number[] {
  let row = [1];
  for (let j = 0; j < n; j++) {
    const next = [1];
    for (let i = 1; i < row.length; i++) next.push(row[i - 1] + row[i]);
    next.push(1);
    row = next;
  }
  return row;
}

export function pmfDoubles(n: number, p: number): number[] {
  const row = binomialDoubles(n);
  return row.map((c, k) => c * Math.pow(p, k) * Math.pow(1 - p, n - k));
}

const sumOf = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const dotOf = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, i) => s + x * b[i], 0);
const zero3 = (v: readonly number[]): boolean => v.every((x) => x === 0);

/** Everything wrong with a drawn problem, as readable lines (empty when sound). */
export function problems(d: Draw): string[] {
  const out: string[] = [];
  const p = d.problem;
  const fail = (text: string): void => {
    out.push(`${p.key}: ${text}`);
  };
  if (p.prompt === '' || p.solution === '' || p.explanation === '' || p.correct === '') fail('empty text');
  if (p.number === null && p.typedAllowed) fail('typed allowed without a number');
  if (p.number) {
    const n = p.number;
    if (!n.isNice) fail(`answer not nice ${n.fraction}`);
    if (Math.abs(n.double) >= 100_000) fail('answer too large');
    const parsed = NumberCheck.parse(n.typed);
    const own = Rational.make(n.n, n.d);
    if (parsed && own && !parsed.equals(own)) fail('typed text differs from the number');
    if (parsed === null) fail('typed text does not parse');
  }
  const foldedAll = [p.correct, ...p.wrong].map(folded);
  if (new Set(foldedAll).size !== foldedAll.length) fail('options read the same');
  if (p.wrong.includes(p.correct)) fail('a wrong option equals the right one');
  if (p.number === null && p.wrong.length < 2) fail('a choice problem without two wrong options');
  const right = NumberCheck.parse(p.correct);
  if (p.number && right) {
    const own = Rational.make(p.number.n, p.number.d);
    if (own && !right.equals(own)) fail('correct text is not the number');
    for (const w of p.wrong) {
      const pw = NumberCheck.parse(w);
      if (pw && pw.equals(right)) fail(`wrong option ${w} has the right value`);
    }
  }
  const hyphen = /(^|[ (])-[0-9a-zA-Z(]/;
  for (const text of [p.prompt, p.correct, p.solution, ...p.wrong]) {
    if (hyphen.test(text)) fail(`ASCII minus used as a sign in ${text}`);
  }
  return [...out, ...checkFact(d)];
}

const SYMMETRY_TEXT: Record<USymmetry, string> = {
  yAxis: 'achsensymmetrisch zur y-Achse',
  origin: 'punktsymmetrisch zum Ursprung',
  neither: 'weder noch',
};
const KIND_NAMES: Record<UExtremum, string> = { maximum: 'Hochpunkt', minimum: 'Tiefpunkt', saddle: 'Sattelpunkt' };

export function checkFact(d: Draw): string[] {
  const out: string[] = [];
  const p = d.problem;
  const fail = (text: string): void => {
    out.push(`${p.key}: ${text}`);
  };
  const number = p.number ? p.number.double : null;
  const expectNumber = (value: number, label: string): void => {
    if (number === null) {
      fail(`${label}: no number`);
      return;
    }
    if (!close(number, value)) fail(`${label}: answer ${number} but recomputed ${value}`);
  };
  const fact: UFact = p.fact;
  switch (fact.t) {
    case 'derivAt':
      expectNumber(derivative((x) => fact.f.evalDouble(x), fact.x.double), "f'(a)");
      break;
    case 'valueAt':
      expectNumber(fact.f.evalDouble(fact.x.double), 'f(a)');
      break;
    case 'slopeX':
      if (number !== null && !close(derivative((x) => fact.f.evalDouble(x), number), fact.m.double)) fail(`slope at the answer is not ${fact.m.double}`);
      break;
    case 'tangentT': {
      const m = derivative((x) => fact.f.evalDouble(x), fact.a.double);
      expectNumber(fact.f.evalDouble(fact.a.double) - m * fact.a.double, 'tangent t');
      break;
    }
    case 'tangentY': {
      const m = derivative((x) => fact.f.evalDouble(x), fact.a.double);
      expectNumber(fact.f.evalDouble(fact.a.double) + m * (fact.b.double - fact.a.double), 'tangent value');
      break;
    }
    case 'flatX':
      if (number !== null && !close(derivative((x) => fact.f.evalDouble(x), number), 0, 1e-6)) fail('slope at the answer is not 0');
      break;
    case 'flatY': {
      const candidates: number[] = [];
      for (let x = -40; x <= 40; x += 0.5) if (Math.abs(fact.f.derivative.evalDouble(x)) < 1e-9) candidates.push(x);
      if (candidates.length !== 1) fail('flat tangent not unique');
      else expectNumber(fact.f.evalDouble(candidates[0]), 'flat y');
      break;
    }
    case 'derivPoly': {
      for (const x of [-1.7, -0.4, 0.9, 2.3]) {
        if (!close(derivative((v) => fact.f.evalDouble(v), x), fact.correct.evalDouble(x), 1e-3)) fail('the correct option is not the derivative');
      }
      if (!fact.f.derivative.equals(fact.correct)) fail('exact derivative differs');
      if (fact.correct.text !== p.correct) fail('correct text differs from the polynomial');
      const wrongTexts = new Set(fact.wrong.map((w) => w.text));
      for (const w of p.wrong) if (!wrongTexts.has(w)) fail(`wrong option ${w} not computed from a mistake`);
      for (const w of fact.wrong) if (w.equals(fact.f.derivative)) fail('a mistake equals the derivative');
      break;
    }
    case 'derivOfFunction':
      expectNumber(derivative(fact.f, fact.at), 'derivative of function');
      break;
    case 'valueOfFunction':
      expectNumber(fact.f(fact.at), 'value of function');
      break;
    case 'root': {
      if (number !== null) {
        if (!fact.f.eval(new UQ(Math.trunc(number))).isZero) fail('not a root');
        const roots: number[] = [];
        for (let x = -40; x <= 40; x++) if (fact.f.eval(new UQ(x)).isZero) roots.push(x);
        const expected = fact.largest ? Math.max(...roots) : Math.min(...roots);
        if (p.typedAllowed && roots.length > 0 && expected !== number) fail(`not the ${fact.largest ? 'largest' : 'smallest'} root`);
        for (const w of p.wrong) {
          const parsed = NumberCheck.parse(w);
          if (parsed && !p.typedAllowed && fact.f.eval(new UQ(Math.trunc(parsed.doubleValue))).isZero) fail(`wrong option ${w} is a root`);
        }
      }
      break;
    }
    case 'extremumX':
      if (number !== null) {
        if (!close(fact.f.derivative.evalDouble(number), 0, 1e-9)) fail("f' not 0 at the answer");
        const second = fact.f.derivative.derivative.evalDouble(number);
        if (fact.max ? second >= 0 : second <= 0) fail(`wrong sign of f'' for ${fact.max ? 'max' : 'min'}`);
      }
      break;
    case 'extremumY': {
      const xs: number[] = [];
      for (let i = -80; i <= 80; i++) {
        const x = i / 2;
        const second = fact.f.derivative.derivative.evalDouble(x);
        if (Math.abs(fact.f.derivative.evalDouble(x)) < 1e-9 && (fact.max ? second < 0 : second > 0)) xs.push(x);
      }
      if (xs.length !== 1) fail('extremum not unique');
      else expectNumber(fact.f.evalDouble(xs[0]), 'extremum y');
      break;
    }
    case 'inflectionX':
      if (number !== null) {
        if (!close(fact.f.derivative.derivative.evalDouble(number), 0, 1e-9)) fail("f'' not 0 at the answer");
        if (close(fact.f.derivative.derivative.derivative.evalDouble(number), 0, 1e-9)) fail("f''' is 0");
      }
      break;
    case 'kindAt': {
      const x0 = fact.x.double;
      if (KIND_NAMES[fact.kind] !== p.correct) fail('correct text differs');
      const all = new Set([...p.wrong, p.correct]);
      const names = new Set(Object.values(KIND_NAMES));
      if (all.size !== names.size || [...all].some((a) => !names.has(a))) fail('options are not the three kinds');
      if (Math.abs(fact.f.derivative.evalDouble(x0)) > 1e-9) fail("f' not 0");
      const second = fact.f.derivative.derivative.evalDouble(x0);
      const before = fact.f.derivative.evalDouble(x0 - 0.1);
      const after = fact.f.derivative.evalDouble(x0 + 0.1);
      switch (fact.kind) {
        case 'maximum':
          if (!(second < 0 && before > 0 && after < 0)) fail('not a maximum');
          break;
        case 'minimum':
          if (!(second > 0 && before < 0 && after > 0)) fail('not a minimum');
          break;
        case 'saddle':
          if (!(Math.abs(second) < 1e-9 && before * after > 0)) fail('not a saddle point');
          break;
      }
      break;
    }
    case 'symmetry': {
      if (SYMMETRY_TEXT[fact.kind] !== p.correct) fail('correct text differs');
      const xs = [0.7, 1.3, 2.1];
      const even = xs.every((x) => close(fact.f.evalDouble(-x), fact.f.evalDouble(x)));
      const odd = xs.every((x) => close(fact.f.evalDouble(-x), -fact.f.evalDouble(x)));
      const actual: USymmetry = even ? 'yAxis' : odd ? 'origin' : 'neither';
      if (actual !== fact.kind) fail(`symmetry is ${actual}`);
      break;
    }
    case 'monotone': {
      const mid = (fact.lo.double + fact.hi.double) / 2;
      const risingInside = fact.f.derivative.evalDouble(mid) > 0;
      if (fact.f.derivative.evalDouble(fact.lo.double) !== 0 || fact.f.derivative.evalDouble(fact.hi.double) !== 0) fail('bounds are not stationary points');
      const outsideRising = fact.f.derivative.evalDouble(fact.hi.double + 1) > 0;
      if (risingInside === outsideRising) fail('no sign change');
      if (fact.answerBetween !== (fact.askRising === risingInside)) fail('answer side is wrong');
      if (p.correct.includes('oder') === fact.answerBetween) fail('correct text does not fit the side');
      if (p.prompt.includes('steigend') !== fact.askRising) fail('prompt direction differs');
      const lowText = minus(Math.trunc(fact.lo.double));
      const highText = minus(Math.trunc(fact.hi.double));
      const expected = fact.answerBetween ? `${lowText} < x < ${highText}` : `x < ${lowText} oder x > ${highText}`;
      if (expected !== p.correct) fail('correct interval text differs');
      break;
    }
    case 'antiderivative': {
      if (!fact.correct.derivative.equals(fact.f)) fail("F' is not f");
      for (const x of [-1.3, 0.6, 2.2]) {
        if (!close(derivative((v) => fact.correct.evalDouble(v), x), fact.f.evalDouble(x), 1e-3)) fail("numeric F' differs");
      }
      if (fact.correct.text + ' + C' !== p.correct) fail('correct text differs');
      const wrongTexts = new Set(fact.wrong.map((w) => w.text + ' + C'));
      for (const w of p.wrong) if (!wrongTexts.has(w)) fail(`wrong option ${w} not computed from a mistake`);
      for (const w of fact.wrong) if (w.derivative.equals(fact.f)) fail('a mistake is an antiderivative');
      if (p.wrong.some((w) => !w.endsWith('+ C'))) fail('an option without + C');
      break;
    }
    case 'definite': {
      const expected = simpson((x) => fact.f.evalDouble(x), fact.a.double, fact.b.double);
      if (number !== null) {
        if (!close(number, expected, 1e-6)) fail(`definite integral ${number} vs ${expected}`);
      } else {
        const parsed = NumberCheck.parse(p.correct);
        if (parsed && !close(parsed.doubleValue, expected, 1e-6)) fail(`definite integral text ${p.correct} vs ${expected}`);
      }
      break;
    }
    case 'area':
      expectNumber(simpson((x) => Math.abs(fact.f.evalDouble(x)), fact.a.double, fact.b.double, 60000), 'area');
      break;
    case 'mean':
      expectNumber(simpson((x) => fact.f.evalDouble(x), fact.a.double, fact.b.double) / (fact.b.double - fact.a.double), 'mean value');
      break;
    case 'upperLimit':
      if (number !== null) {
        if (!close(simpson((x) => fact.f.evalDouble(x), 0, number), fact.value.double, 1e-6)) fail(`integral up to the answer is not ${fact.value.double}`);
        if (number <= 0) fail('limit not positive');
      }
      break;
    case 'combination':
      expectNumber(sumOf(fact.coefficients.map((c, i) => c.double * fact.parts[i].double)), 'linear combination');
      break;
    case 'integralOfFunction':
      expectNumber(simpson(fact.f, fact.from, fact.to), 'integral of function');
      break;
    case 'approx':
      expectNumber(fact.value, 'approx');
      break;
    case 'powerEquation':
      if (number !== null && !close(Math.pow(fact.base, fact.k.double * number + fact.c.double), fact.rhs, 1e-9)) fail('equation not satisfied by the answer');
      break;
    case 'expDeriv': {
      const { a, k, b } = fact;
      const g = (x: number): number => a * Math.exp(k * x) + b * x * x;
      const formula = (x: number): number => a * k * Math.exp(k * x) + 2 * b * x;
      for (const x of [-0.4, 0.37, 1.1]) if (!close(derivative(g, x), formula(x), 1e-3)) fail('formula is not the derivative');
      const c = a * k;
      const head = c === 1 ? '' : c === -1 ? '−' : minus(c);
      const exponent = k === 1 ? 'x' : k === -1 ? '(−x)' : `(${minus(k)}x)`;
      let expected = head + 'e^' + exponent;
      if (b !== 0) expected += (b < 0 ? ' − ' : ' + ') + (Math.abs(2 * b) === 1 ? '' : `${Math.abs(2 * b)}`) + 'x';
      if (expected !== p.correct) fail(`correct text ${p.correct} vs ${expected}`);
      break;
    }
    case 'expAnti': {
      const { a, k } = fact;
      const F = (x: number): number => (a / k) * Math.exp(k * x);
      for (const x of [-0.4, 0.37, 1.1]) if (!close(derivative(F, x), a * Math.exp(k * x), 1e-3)) fail('not an antiderivative');
      const gcd = (x: number, y: number): number => (y === 0 ? Math.abs(x) : gcd(y, x % y));
      const g = gcd(a, k);
      let top = a / g;
      let bottom = k / g;
      if (bottom < 0) {
        top = -top;
        bottom = -bottom;
      }
      const exponent = k === 1 ? 'x' : k === -1 ? '(−x)' : `(${minus(k)}x)`;
      const expected = (top < 0 ? '−' : '') + (Math.abs(top) === 1 ? '' : `${Math.abs(top)}`) + 'e^' + exponent + (bottom === 1 ? '' : `/${bottom}`) + ' + C';
      if (expected !== p.correct) fail(`correct text ${p.correct} vs ${expected}`);
      break;
    }
    case 'lnSolve': {
      const { a, k } = fact;
      const x = Math.log(a) / k;
      if (!close(Math.exp(k * x), a, 1e-9)) fail('check failed');
      const expected = k === 1 ? `x = ln(${a})` : `x = ln(${a})/${k}`;
      if (expected !== p.correct) fail('correct text differs');
      const known: Record<string, number> =
        k === 1
          ? { [`x = e^${a}`]: Math.exp(a), [`x = ${a}/e`]: a / Math.E, [`x = log₁₀(${a})`]: Math.log10(a), [`x = ${a} − 1`]: a - 1 }
          : { [`x = ${k}·ln(${a})`]: k * Math.log(a), [`x = ln(${a}/${k})`]: Math.log(a / k), [`x = ln(${a}) − ${k}`]: Math.log(a) - k, [`x = e^(${a}/${k})`]: Math.exp(a / k) };
      for (const w of p.wrong) {
        const value = known[w];
        if (value === undefined) {
          fail(`unknown wrong option ${w}`);
          continue;
        }
        if (close(value, x, 1e-9)) fail(`wrong option ${w} is right`);
      }
      break;
    }
    case 'law': {
      for (const [a, b] of [[2.3, 1.7], [5.1, 0.6], [9.0, 4.0]]) {
        const [l, r] = fact.correct(a, b);
        if (!close(l, r, 1e-9)) fail('the law does not hold');
        for (const w of fact.wrong) {
          const [wl, wr] = w(a, b);
          if (close(wl, wr, 1e-9)) fail(`a wrong law holds at ${a}, ${b}`);
        }
      }
      if (p.wrong.length > fact.wrong.length) fail('every wrong option needs a counter-check');
      break;
    }
    case 'trigValue': {
      const { fn, degrees } = fact;
      const value = trig(fn, (degrees * Math.PI) / 180);
      const signs: Record<string, number> = { positiv: 1, negativ: -1, null: 0 };
      if (number !== null) {
        if (!close(number, value, 1e-9)) fail(`${fn}(${degrees}°) is ${value}, answer ${number}`);
      } else if (signs[p.correct] !== undefined) {
        const sign = signs[p.correct];
        if (Math.abs(value) < 1e-9 ? sign !== 0 : value > 0 ? sign !== 1 : sign !== -1) fail(`sign of ${fn}(${degrees}°) is wrong`);
      } else {
        const parsed = parseExact(p.correct);
        if (parsed !== null) {
          if (!close(parsed, value, 1e-9)) fail(`exact text ${p.correct} vs ${value}`);
          for (const w of p.wrong) {
            const pw = parseExact(w);
            if (pw !== null && close(pw, value, 1e-9)) fail(`wrong option ${w} has the same value`);
          }
        } else fail('cannot read the correct text');
      }
      if (p.number) {
        const r = parseExact(p.correct);
        if (r !== null && !close(r, value, 1e-9)) fail('fraction text differs');
        for (const w of p.wrong) {
          const pw = parseExact(w);
          if (pw !== null && close(pw, value, 1e-9)) fail(`wrong option ${w} has the same value`);
        }
      }
      break;
    }
    case 'degreesToPi': {
      const target = fact.degrees / 180;
      expectNumber(target, 'degrees to pi');
      const parsed = parsePi(p.correct);
      if (parsed !== null && !close(parsed, target, 1e-9)) fail(`correct text ${p.correct} differs`);
      for (const w of p.wrong) {
        const pw = parsePi(w);
        if (pw !== null && close(pw, target, 1e-9)) fail(`wrong option ${w} equals the answer`);
      }
      break;
    }
    case 'period': {
      if (number === null) break;
      const f = (x: number): number => trig(fact.fn, fact.k.double * x);
      const period = number * Math.PI;
      for (const x of [0.3, 1.1, 2.9]) if (!close(f(x + period), f(x), 1e-9)) fail('not a period');
      for (let m = 2; m <= 6; m++) {
        if (close(f(0.3 + period / m), f(0.3), 1e-9) && close(f(1.1 + period / m), f(1.1), 1e-9)) fail(`period ${period} is not the smallest`);
      }
      const parsed = parsePi(p.correct);
      if (parsed !== null && !close(parsed, number, 1e-9)) fail('correct text differs');
      break;
    }
    case 'amplitude': {
      if (number === null) break;
      const isSin = p.prompt.includes('sin');
      const f = (x: number): number => fact.a.double * (isSin ? Math.sin(fact.k.double * x) : Math.cos(fact.k.double * x)) + fact.d.double;
      let high = -Infinity;
      let low = Infinity;
      for (let i = 0; i <= 20000; i++) {
        const v = f((i / 20000) * 2 * Math.PI);
        if (v > high) high = v;
        if (v < low) low = v;
      }
      switch (fact.what) {
        case 'amplitude':
          if (!close(number, (high - low) / 2, 1e-5)) fail('amplitude');
          break;
        case 'maximum':
          if (!close(number, high, 1e-5)) fail('maximum');
          break;
        case 'minimum':
          if (!close(number, low, 1e-5)) fail('minimum');
          break;
        case 'midline':
          if (!close(number, (high + low) / 2, 1e-5)) fail('midline');
          break;
      }
      break;
    }
    case 'zerosIn': {
      const n = 4000 * fact.k;
      let count = 0;
      for (let i = 0; i <= n; i++) if (Math.abs(trig(fact.fn, ((fact.k * i) / n) * 2 * Math.PI)) < 1e-9) count += 1;
      expectNumber(count, 'zeros');
      break;
    }
    case 'trigSolve':
      if (number !== null) {
        if (!close(trig(fact.fn, number * Math.PI), fact.value.double, 1e-9)) fail('answer does not solve the equation');
        if (number < 0 || number > 0.5 + 1e-12) fail('outside [0; pi/2]');
        const parsed = parsePi(p.correct);
        if (parsed !== null && !close(parsed, number, 1e-9)) fail('text differs');
      }
      break;
    case 'cosFromSin': {
      const cosine = Math.sqrt(1 - fact.sin.double * fact.sin.double);
      expectNumber(fact.askTan ? fact.sin.double / cosine : cosine, fact.askTan ? 'tan' : 'cos');
      break;
    }
    case 'trigDeriv': {
      const { fn, a, k } = fact;
      const g = (x: number): number => a * trig(fn, k * x);
      const formula = (x: number): number => (fn === 'sin' ? a * k * Math.cos(k * x) : -(a * k) * Math.sin(k * x));
      for (const x of [-0.4, 0.37, 1.1]) if (!close(derivative(g, x), formula(x), 1e-3)) fail('formula is not the derivative');
      const c = fn === 'sin' ? a * k : -a * k;
      const head = c === 1 ? '' : c === -1 ? '−' : minus(c);
      const expected = head + (fn === 'sin' ? 'cos' : 'sin') + '(' + (k === 1 ? 'x' : `${k}x`) + ')';
      if (expected !== p.correct) fail(`correct text ${p.correct} vs ${expected}`);
      break;
    }
    case 'vecNorm':
      expectNumber(Math.sqrt(sumOf(fact.v.map((x) => x * x))), 'norm');
      break;
    case 'dot':
      expectNumber(dotOf(fact.a, fact.b), 'dot product');
      break;
    case 'orthoParam':
      if (dotOf(fact.a, fact.b) !== 0) fail('not orthogonal');
      if (number !== null && fact.a[fact.index] !== number) fail('answer is not the entry');
      break;
    case 'distance': {
      let squares = 0;
      for (let i = 0; i < 3; i++) {
        const delta = fact.b[i] - fact.a[i];
        squares += delta * delta;
      }
      expectNumber(Math.sqrt(squares), 'distance');
      break;
    }
    case 'vectorComponent':
      expectNumber(fact.to[fact.index] - fact.from[fact.index], 'component');
      break;
    case 'lineParam':
      if (number !== null) for (let i = 0; i < 3; i++) if (fact.a[i] + number * fact.u[i] !== fact.p[i]) fail('point is not a + t u');
      break;
    case 'linePoint':
      expectNumber(fact.a[fact.index] + fact.tt * fact.u[fact.index], 'line point');
      break;
    case 'midpoint':
      expectNumber((fact.a[fact.index] + fact.b[fact.index]) / 2, 'midpoint');
      break;
    case 'angle': {
      const dot = dotOf(fact.a, fact.b);
      const na = Math.sqrt(sumOf(fact.a.map((x) => x * x)));
      const nb = Math.sqrt(sumOf(fact.b.map((x) => x * x)));
      expectNumber((Math.acos(Math.max(-1, Math.min(1, dot / (na * nb)))) * 180) / Math.PI, 'angle');
      break;
    }
    case 'onLine': {
      if (!lineContains(fact.a, fact.u, fact.right)) fail('right point is not on the line');
      if (p.correct !== 'P' + vectorText(fact.right)) fail('correct text differs');
      for (const w of fact.wrong) if (lineContains(fact.a, fact.u, w)) fail('wrong point is on the line');
      const allowed = new Set(fact.wrong.map((w) => 'P' + vectorText(w)));
      if (!p.wrong.every((w) => allowed.has(w))) fail('wrong options differ from the facts');
      break;
    }
    case 'orthogonalPair':
      if (dotOf(fact.right[0], fact.right[1]) !== 0) fail('right pair is not orthogonal');
      if (zero3(fact.right[0]) || zero3(fact.right[1])) fail('zero vector');
      for (const w of fact.wrong) if (dotOf(w[0], w[1]) === 0) fail('wrong pair is orthogonal');
      break;
    case 'direction': {
      const dd = fact.a.map((x, i) => fact.b[i] - x);
      if (p.correct !== vectorText(dd)) fail('correct vector differs');
      for (const w of p.wrong) if (w === p.correct) fail('equal option');
      if (fact.a.every((x, i) => x === fact.b[i])) fail('degenerate');
      break;
    }
    case 'laplaceDice': {
      let favourable = 0;
      for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) if (fact.sums.includes(x + y)) favourable += 1;
      expectNumber(favourable / 36, 'dice probability');
      break;
    }
    case 'urn': {
      const balls = [...new Array<number>(fact.red).fill(1), ...new Array<number>(fact.blue).fill(0)];
      let good = 0;
      let all = 0;
      switch (fact.mode) {
        case 'oneRed':
          good = balls.filter((b) => b === 1).length;
          all = balls.length;
          break;
        case 'twoRedWith':
          for (const x of balls)
            for (const y of balls) {
              all += 1;
              if (x === 1 && y === 1) good += 1;
            }
          break;
        default:
          for (let i = 0; i < balls.length; i++)
            for (let j = 0; j < balls.length; j++) {
              if (i === j) continue;
              all += 1;
              if (fact.mode === 'twoRedWithout' ? balls[i] === 1 && balls[j] === 1 : balls[i] !== balls[j]) good += 1;
            }
      }
      expectNumber(good / all, 'urn');
      break;
    }
    case 'choose':
      if (!(fact.n >= fact.k && fact.k >= 0 && fact.n > 0)) fail('degenerate n, k');
      else expectNumber(binomialDoubles(fact.n)[fact.k], 'n over k');
      break;
    case 'binomial': {
      const probs = pmfDoubles(fact.n, fact.p.double);
      if (!close(sumOf(probs), 1, 1e-12)) fail('pmf does not sum to 1');
      switch (fact.kind.t) {
        case 'equal':
          expectNumber(probs[fact.kind.k], 'P(X=k)');
          break;
        case 'atMost':
          expectNumber(sumOf(probs.slice(0, fact.kind.k + 1)), 'P(X<=k)');
          break;
        case 'atLeast':
          expectNumber(sumOf(probs.slice(fact.kind.k, fact.n + 1)), 'P(X>=k)');
          break;
        case 'atLeastOne':
          expectNumber(1 - Math.pow(1 - fact.p.double, fact.n), 'at least one');
          break;
      }
      break;
    }
    case 'expectation':
      expectNumber(fact.n * fact.p.double, 'E(X)');
      break;
    case 'expectationTable':
      if (!close(sumOf(fact.probabilities.map((x) => x.double)), 1, 1e-12)) fail('probabilities do not sum to 1');
      expectNumber(sumOf(fact.values.map((v, i) => v.double * fact.probabilities[i].double)), 'E(X) of a table');
      break;
    case 'sigma':
      expectNumber(Math.sqrt(fact.n * fact.p.double * (1 - fact.p.double)), 'sigma');
      break;
    case 'table': {
      const t = fact.table;
      const n = t.total;
      const a = t.a;
      const b = t.b;
      const c = t.c;
      const dd = t.d;
      if (t.a <= 0 || t.b <= 0 || t.c <= 0 || t.d <= 0) fail('empty cell');
      let value: number;
      switch (fact.ask) {
        case 'pA':
          value = (a + b) / n;
          break;
        case 'pB':
          value = (a + c) / n;
          break;
        case 'pAandB':
          value = a / n;
          break;
        case 'pAorB':
          value = (a + b + c) / n;
          break;
        case 'pNotAandB':
          value = c / n;
          break;
        case 'pNotAandNotB':
          value = dd / n;
          break;
        case 'pAgivenB':
          value = a / (a + c);
          break;
        case 'pBgivenA':
          value = a / (a + b);
          break;
        case 'pNotBgivenA':
          value = b / (a + b);
          break;
      }
      expectNumber(value, 'table probability');
      if (p.prompt.startsWith('Für zwei Ereignisse')) {
        const pa = promptNumber(p.prompt, 'P(A)');
        if (pa !== null && !close(pa, (a + b) / n, 1e-12)) fail('P(A) in the prompt');
        const pb = promptNumber(p.prompt, 'P(B)');
        if (pb !== null && !close(pb, (a + c) / n, 1e-12)) fail('P(B) in the prompt');
        const pab = promptNumber(p.prompt, 'P(A∩B)');
        if (pab !== null && !close(pab, a / n, 1e-12)) fail('P(A∩B) in the prompt');
      }
      if (p.prompt.startsWith('Im Baumdiagramm')) {
        const pa = promptNumber(p.prompt, 'P(A)');
        if (pa !== null && !close(pa, (a + b) / n, 1e-12)) fail('tree P(A)');
        const q1 = promptNumber(p.prompt, 'P(B|A)');
        if (q1 !== null && !close(q1, a / (a + b), 1e-12)) fail('tree P(B|A)');
        const q2 = promptNumber(p.prompt, 'P(B|¬A)');
        if (q2 !== null && !close(q2, c / (c + dd), 1e-12)) fail('tree P(B|not A)');
      }
      break;
    }
    case 'independence': {
      const t = fact.table;
      const n = t.total;
      const left = t.a * n;
      const right = (t.a + t.b) * (t.a + t.c);
      const expected =
        left === right
          ? 'Ja, denn P(A∩B) = P(A)·P(B).'
          : left > right
            ? 'Nein, denn P(A∩B) ist größer als P(A)·P(B).'
            : 'Nein, denn P(A∩B) ist kleiner als P(A)·P(B).';
      if (expected !== p.correct) fail('independence verdict differs');
      break;
    }
    case 'pairs':
    case 'concept':
      break;
  }
  return out;
}
