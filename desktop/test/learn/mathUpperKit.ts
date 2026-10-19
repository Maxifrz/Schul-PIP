import { NumberCheck, Rational } from '../../src/lib/learn/rational';
import { folded } from '../../src/lib/learn/exercise';
import { UGen, UPoly, UProblem, UQ, UFact, USymmetry, uq, tableTotal } from '../../src/lib/learn/math/upper/core';
import { upperTemplate, upperUnits } from '../../src/lib/learn/math/upper/course';

/**
 * Independent checks for the upper-school maths course. The kit re-computes every answer another way: numeric
 * differentiation, Simpson integration, direct enumeration, plain floating point arithmetic and plugging solutions back in, so a
 * mistake in a template cannot hide behind the code that produced it.
 */
export interface Draw {
  level: number;
  seed: bigint;
  problem: UProblem;
}

const cache = new Map<string, Draw[]>();

export function draws(id: string): Draw[] {
  const cached = cache.get(id);
  if (cached) return cached;
  const template = upperTemplate(id);
  if (!template) throw new Error(`No template ${id}`);
  const result: Draw[] = [];
  for (let level = 1; level <= 3; level++) {
    for (let seed = 1; seed <= 300; seed++) {
      const s = BigInt.asUintN(64, BigInt(seed) * 7919n + BigInt(level));
      const problem = template.make(level, new UGen(s));
      if (problem) result.push({ level, seed: s, problem });
    }
  }
  cache.set(id, result);
  return result;
}

export const allIDs = (): string[] => upperUnits.flatMap((u) => u.map((t) => t.id));

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

export const close = (a: number, b: number, tolerance = 1e-4): boolean => Math.abs(a - b) <= tolerance * (1 + Math.max(Math.abs(a), Math.abs(b)));

export const minus = (n: number): string => (n < 0 ? `−${-n}` : `${n}`);

/** "3π/4", "π/2", "−π", "0", "4π" as a multiple of pi. */
export function parsePi(text: string): number | null {
  let t = text;
  let sign = 1;
  if (t.startsWith('−')) { sign = -1; t = t.slice(1); }
  if (t === '0') return 0;
  const parts = t.split('π');
  if (parts.length !== 2) return null;
  const coefficient = parts[0] === '' ? 1 : Number(parts[0]);
  let denominator = 1;
  if (parts[1] !== '') {
    if (!parts[1].startsWith('/')) return null;
    denominator = Number(parts[1].slice(1));
    if (Number.isNaN(denominator)) return null;
  }
  if (Number.isNaN(coefficient)) return null;
  return (sign * coefficient) / denominator;
}

const magnitudes: Record<string, number> = { '0': 0, '1/2': 0.5, '√2/2': Math.SQRT2 / 2, '√3/2': Math.sqrt(3) / 2, '1': 1, '√3': Math.sqrt(3), '√3/3': Math.sqrt(3) / 3 };

export function parseExact(text: string): number | null {
  let t = text;
  let sign = 1;
  if (t.startsWith('−')) { sign = -1; t = t.slice(1); }
  return magnitudes[t] === undefined ? null : sign * magnitudes[t];
}

export function trig(fn: string, radians: number): number {
  switch (fn) {
    case 'sin': return Math.sin(radians);
    case 'cos': return Math.cos(radians);
    default: return Math.tan(radians);
  }
}

/** Reads "P(A) = 0,4" style numbers from a prompt. */
export function promptNumber(prompt: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped} = ([0-9]+(?:,[0-9]+)?)`, 'u').exec(prompt);
  return m ? Number(m[1].replace(',', '.')) : null;
}

export const vectorText = (v: number[]): string => `(${v.map(minus).join(' | ')})`;

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
    } else t = value;
  }
  return true;
}

export function binomialDoubles(n: number): number[] {
  let row = [1];
  for (let i = 0; i < n; i++) {
    const next = [1];
    for (let j = 1; j < row.length; j++) next.push(row[j - 1] + row[j]);
    next.push(1);
    row = next;
  }
  return row;
}

export function pmf(n: number, p: number): number[] {
  const row = binomialDoubles(n);
  return Array.from({ length: n + 1 }, (_, k) => row[k] * p ** k * (1 - p) ** (n - k));
}

const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
const dotOf = (a: number[], b: number[]) => sum(a.map((x, i) => x * b[i]));
const norm = (v: number[]) => Math.sqrt(sum(v.map((x) => x * x)));

// Verification of one draw

/** Everything wrong with a drawn problem, as readable lines (empty when sound). */
export function problems(d: Draw): string[] {
  const out: string[] = [];
  const p = d.problem;
  const fail = (text: string) => out.push(`${p.key}: ${text}`);
  if (p.prompt === '' || p.solution === '' || p.explanation === '' || p.correct === '') fail('empty text');
  if (p.number === undefined && p.typedAllowed) fail('typed allowed without a number');
  if (p.number) {
    const n = p.number;
    if (!n.isNice) fail(`answer not nice ${n.fraction}`);
    if (Math.abs(n.double) >= 100000) fail('answer too large');
    const parsed = NumberCheck.parse(n.typed);
    if (!parsed) fail('typed text does not parse');
    else if (!parsed.equals(Rational.of(n.n, n.d)!)) fail('typed text differs from the number');
  }
  const foldedAll = [p.correct, ...p.wrong].map(folded);
  if (new Set(foldedAll).size !== foldedAll.length) fail('options read the same');
  if (p.wrong.includes(p.correct)) fail('a wrong option equals the right one');
  if (p.number === undefined && p.wrong.length < 2) fail('a choice problem without two wrong options');
  const right = NumberCheck.parse(p.correct);
  if (p.number && right) {
    if (!right.equals(Rational.of(p.number.n, p.number.d)!)) fail('correct text is not the number');
    for (const w of p.wrong) {
      const parsed = NumberCheck.parse(w);
      if (parsed && parsed.equals(right)) fail(`wrong option ${w} has the right value`);
    }
  }
  for (const text of [p.prompt, p.correct, p.solution, ...p.wrong]) {
    if (/(^|[ (])-[0-9a-zA-Z(]/u.test(text)) fail(`ASCII minus used as a sign in ${text}`);
  }
  out.push(...checkFact(d));
  return out;
}

export function checkFact(d: Draw): string[] {
  const out: string[] = [];
  const p = d.problem;
  const fail = (text: string) => out.push(`${p.key}: ${text}`);
  const number = p.number?.double;
  const expectNumber = (value: number, label: string) => {
    if (number === undefined) { fail(`${label}: no number`); return; }
    if (!close(number, value)) fail(`${label}: answer ${number} but recomputed ${value}`);
  };
  const fact: UFact = p.fact;
  switch (fact.k) {
    case 'derivAt': expectNumber(derivative((x) => fact.f.evalDouble(x), fact.x.double), "f'(a)"); break;
    case 'valueAt': expectNumber(fact.f.evalDouble(fact.x.double), 'f(a)'); break;
    case 'slopeX':
      if (number !== undefined && !close(derivative((x) => fact.f.evalDouble(x), number), fact.m.double)) fail(`slope at the answer is not ${fact.m.double}`);
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
      if (number !== undefined && !close(derivative((x) => fact.f.evalDouble(x), number), 0, 1e-6)) fail('slope at the answer is not 0');
      break;
    case 'flatY': {
      const candidates: number[] = [];
      for (let x = -40; x <= 40; x += 0.5) if (Math.abs(fact.f.derivative.evalDouble(x)) < 1e-9) candidates.push(x);
      if (candidates.length !== 1) fail('flat tangent not unique');
      else expectNumber(fact.f.evalDouble(candidates[0]), 'flat y');
      break;
    }
    case 'derivPoly': {
      for (const x of [-1.7, -0.4, 0.9, 2.3]) if (!close(derivative((v) => fact.f.evalDouble(v), x), fact.correct.evalDouble(x), 1e-3)) fail('the correct option is not the derivative');
      if (!fact.f.derivative.equals(fact.correct)) fail('exact derivative differs');
      if (fact.correct.text !== p.correct) fail('correct text differs from the polynomial');
      const wrongTexts = new Set(fact.wrong.map((w) => w.text));
      for (const w of p.wrong) if (!wrongTexts.has(w)) fail(`wrong option ${w} not computed from a mistake`);
      for (const w of fact.wrong) if (w.equals(fact.f.derivative)) fail('a mistake equals the derivative');
      break;
    }
    case 'derivOfFunction': expectNumber(derivative(fact.fn, fact.at), 'derivative of function'); break;
    case 'valueOfFunction': expectNumber(fact.fn(fact.at), 'value of function'); break;
    case 'root':
      if (number !== undefined) {
        if (!fact.f.eval(uq(Math.trunc(number))).isZero) fail('not a root');
        const roots: number[] = [];
        for (let x = -40; x <= 40; x++) if (fact.f.eval(uq(x)).isZero) roots.push(x);
        const expected = fact.largest ? Math.max(...roots) : Math.min(...roots);
        if (p.typedAllowed && roots.length > 0 && expected !== number) fail(`not the ${fact.largest ? 'largest' : 'smallest'} root`);
        for (const w of p.wrong) {
          const q = NumberCheck.parse(w);
          if (q && !p.typedAllowed && fact.f.eval(uq(Math.trunc(q.value))).isZero) fail(`wrong option ${w} is a root`);
        }
      }
      break;
    case 'extremumX':
      if (number !== undefined) {
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
      if (number !== undefined) {
        if (!close(fact.f.derivative.derivative.evalDouble(number), 0, 1e-9)) fail("f'' not 0 at the answer");
        if (close(fact.f.derivative.derivative.derivative.evalDouble(number), 0, 1e-9)) fail("f''' is 0");
      }
      break;
    case 'kindAt': {
      const x0 = fact.x.double;
      const names = { maximum: 'Hochpunkt', minimum: 'Tiefpunkt', saddle: 'Sattelpunkt' };
      if (names[fact.kind] !== p.correct) fail('correct text differs');
      if (new Set([...p.wrong, p.correct]).size !== 3 || ![...p.wrong, p.correct].every((t) => Object.values(names).includes(t))) fail('options are not the three kinds');
      if (Math.abs(fact.f.derivative.evalDouble(x0)) > 1e-9) fail("f' not 0");
      const second = fact.f.derivative.derivative.evalDouble(x0);
      const before = fact.f.derivative.evalDouble(x0 - 0.1);
      const after = fact.f.derivative.evalDouble(x0 + 0.1);
      switch (fact.kind) {
        case 'maximum': if (!(second < 0 && before > 0 && after < 0)) fail('not a maximum'); break;
        case 'minimum': if (!(second > 0 && before < 0 && after > 0)) fail('not a minimum'); break;
        default: if (!(Math.abs(second) < 1e-9 && before * after > 0)) fail('not a saddle point');
      }
      break;
    }
    case 'symmetry': {
      const texts: Record<USymmetry, string> = { yAxis: 'achsensymmetrisch zur y-Achse', origin: 'punktsymmetrisch zum Ursprung', neither: 'weder noch' };
      if (texts[fact.kind] !== p.correct) fail('correct text differs');
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
      for (const x of [-1.3, 0.6, 2.2]) if (!close(derivative((v) => fact.correct.evalDouble(v), x), fact.f.evalDouble(x), 1e-3)) fail("numeric F' differs");
      if (`${fact.correct.text} + C` !== p.correct) fail('correct text differs');
      const wrongTexts = new Set(fact.wrong.map((w) => `${w.text} + C`));
      for (const w of p.wrong) if (!wrongTexts.has(w)) fail(`wrong option ${w} not computed from a mistake`);
      for (const w of fact.wrong) if (w.derivative.equals(fact.f)) fail('a mistake is an antiderivative');
      if (p.wrong.some((w) => !w.endsWith('+ C'))) fail('an option without + C');
      break;
    }
    case 'definite': {
      const expected = simpson((x) => fact.f.evalDouble(x), fact.a.double, fact.b.double);
      if (number !== undefined) { if (!close(number, expected, 1e-6)) fail(`definite integral ${number} vs ${expected}`); }
      else {
        const q = NumberCheck.parse(p.correct);
        if (q && !close(q.value, expected, 1e-6)) fail(`definite integral text ${p.correct} vs ${expected}`);
      }
      break;
    }
    case 'area': expectNumber(simpson((x) => Math.abs(fact.f.evalDouble(x)), fact.a.double, fact.b.double, 60000), 'area'); break;
    case 'mean': expectNumber(simpson((x) => fact.f.evalDouble(x), fact.a.double, fact.b.double) / (fact.b.double - fact.a.double), 'mean value'); break;
    case 'upperLimit':
      if (number !== undefined) {
        if (!close(simpson((x) => fact.f.evalDouble(x), 0, number), fact.value.double, 1e-6)) fail(`integral up to the answer is not ${fact.value.double}`);
        if (number <= 0) fail('limit not positive');
      }
      break;
    case 'combination': expectNumber(sum(fact.coefficients.map((c, i) => c.double * fact.parts[i].double)), 'linear combination'); break;
    case 'integralOfFunction': expectNumber(simpson(fact.fn, fact.from, fact.to), 'integral of function'); break;
    case 'approx': expectNumber(fact.value, 'approx'); break;
    case 'powerEquation':
      if (number !== undefined && !close(fact.base ** (fact.kk.double * number + fact.c.double), fact.rhs, 1e-9)) fail('equation not satisfied by the answer');
      break;
    case 'expDeriv': {
      const { a, kk, b } = fact;
      const g = (x: number) => a * Math.exp(kk * x) + b * x * x;
      const formula = (x: number) => a * kk * Math.exp(kk * x) + 2 * b * x;
      for (const x of [-0.4, 0.37, 1.1]) if (!close(derivative(g, x), formula(x), 1e-3)) fail('formula is not the derivative');
      const c = a * kk;
      const head = c === 1 ? '' : c === -1 ? '−' : minus(c);
      const exponent = kk === 1 ? 'x' : kk === -1 ? '(−x)' : `(${minus(kk)}x)`;
      let expected = `${head}e^${exponent}`;
      if (b !== 0) expected += `${b < 0 ? ' − ' : ' + '}${Math.abs(2 * b) === 1 ? '' : `${Math.abs(2 * b)}`}x`;
      if (expected !== p.correct) fail(`correct text ${p.correct} vs ${expected}`);
      break;
    }
    case 'expAnti': {
      const { a, kk } = fact;
      const F = (x: number) => (a / kk) * Math.exp(kk * x);
      for (const x of [-0.4, 0.37, 1.1]) if (!close(derivative(F, x), a * Math.exp(kk * x), 1e-3)) fail('not an antiderivative');
      const gcd = (x: number, y: number): number => (y === 0 ? Math.abs(x) : gcd(y, x % y));
      const g = gcd(a, kk);
      let top = a / g;
      let bottom = kk / g;
      if (bottom < 0) { top = -top; bottom = -bottom; }
      const exponent = kk === 1 ? 'x' : kk === -1 ? '(−x)' : `(${minus(kk)}x)`;
      const expected = `${top < 0 ? '−' : ''}${Math.abs(top) === 1 ? '' : `${Math.abs(top)}`}e^${exponent}${bottom === 1 ? '' : `/${bottom}`} + C`;
      if (expected !== p.correct) fail(`correct text ${p.correct} vs ${expected}`);
      break;
    }
    case 'lnSolve': {
      const { a, kk } = fact;
      const x = Math.log(a) / kk;
      if (!close(Math.exp(kk * x), a, 1e-9)) fail('check failed');
      const expected = kk === 1 ? `x = ln(${a})` : `x = ln(${a})/${kk}`;
      if (expected !== p.correct) fail('correct text differs');
      const known: Record<string, number> = kk === 1
        ? { [`x = e^${a}`]: Math.exp(a), [`x = ${a}/e`]: a / Math.E, [`x = log₁₀(${a})`]: Math.log10(a), [`x = ${a} − 1`]: a - 1 }
        : { [`x = ${kk}·ln(${a})`]: kk * Math.log(a), [`x = ln(${a}/${kk})`]: Math.log(a / kk), [`x = ln(${a}) − ${kk}`]: Math.log(a) - kk, [`x = e^(${a}/${kk})`]: Math.exp(a / kk) };
      for (const w of p.wrong) {
        if (known[w] === undefined) { fail(`unknown wrong option ${w}`); continue; }
        if (close(known[w], x, 1e-9)) fail(`wrong option ${w} is right`);
      }
      break;
    }
    case 'law':
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
    case 'trigValue': {
      const value = trig(fact.fn, (fact.degrees * Math.PI) / 180);
      const signs: Record<string, number> = { positiv: 1, negativ: -1, null: 0 };
      if (number !== undefined) { if (!close(number, value, 1e-9)) fail(`${fact.fn}(${fact.degrees}°) is ${value}, answer ${number}`); }
      else if (signs[p.correct] !== undefined) {
        const sign = signs[p.correct];
        if (Math.abs(value) < 1e-9 ? sign !== 0 : value > 0 ? sign !== 1 : sign !== -1) fail(`sign of ${fact.fn}(${fact.degrees}°) is wrong`);
      } else {
        const parsed = parseExact(p.correct);
        if (parsed !== null) {
          if (!close(parsed, value, 1e-9)) fail(`exact text ${p.correct} vs ${value}`);
          for (const w of p.wrong) { const pw = parseExact(w); if (pw !== null && close(pw, value, 1e-9)) fail(`wrong option ${w} has the same value`); }
        } else fail('cannot read the correct text');
      }
      if (p.number !== undefined) {
        const right = parseExact(p.correct);
        if (right !== null && !close(right, value, 1e-9)) fail('fraction text differs');
        for (const w of p.wrong) { const pw = parseExact(w); if (pw !== null && close(pw, value, 1e-9)) fail(`wrong option ${w} has the same value`); }
      }
      break;
    }
    case 'degreesToPi': {
      expectNumber(fact.degrees / 180, 'degrees to pi');
      const parsed = parsePi(p.correct);
      if (parsed !== null && !close(parsed, fact.degrees / 180, 1e-9)) fail(`correct text ${p.correct} differs`);
      for (const w of p.wrong) { const pw = parsePi(w); if (pw !== null && close(pw, fact.degrees / 180, 1e-9)) fail(`wrong option ${w} equals the answer`); }
      break;
    }
    case 'period': {
      if (number === undefined) break;
      const f = (x: number) => trig(fact.fn, fact.kk.double * x);
      const period = number * Math.PI;
      for (const x of [0.3, 1.1, 2.9]) if (!close(f(x + period), f(x), 1e-9)) fail('not a period');
      for (let m = 2; m <= 6; m++) if (close(f(0.3 + period / m), f(0.3), 1e-9) && close(f(1.1 + period / m), f(1.1), 1e-9)) fail(`period ${period} is not the smallest`);
      const parsed = parsePi(p.correct);
      if (parsed !== null && !close(parsed, number, 1e-9)) fail('correct text differs');
      break;
    }
    case 'amplitude': {
      if (number === undefined) break;
      const isSin = p.prompt.includes('sin');
      const f = (x: number) => fact.a.double * (isSin ? Math.sin(fact.kk.double * x) : Math.cos(fact.kk.double * x)) + fact.d.double;
      let high = -Infinity;
      let low = Infinity;
      for (let i = 0; i <= 20000; i++) {
        const v = f((i / 20000) * 2 * Math.PI);
        high = Math.max(high, v);
        low = Math.min(low, v);
      }
      switch (fact.what) {
        case 'amplitude': if (!close(number, (high - low) / 2, 1e-5)) fail('amplitude'); break;
        case 'maximum': if (!close(number, high, 1e-5)) fail('maximum'); break;
        case 'minimum': if (!close(number, low, 1e-5)) fail('minimum'); break;
        default: if (!close(number, (high + low) / 2, 1e-5)) fail('midline');
      }
      break;
    }
    case 'zerosIn': {
      const n = 4000 * fact.kk;
      let count = 0;
      for (let i = 0; i <= n; i++) if (Math.abs(trig(fact.fn, ((fact.kk * i) / n) * 2 * Math.PI)) < 1e-9) count += 1;
      expectNumber(count, 'zeros');
      break;
    }
    case 'trigSolve':
      if (number !== undefined) {
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
      const { fn, a, kk } = fact;
      const g = (x: number) => a * trig(fn, kk * x);
      const formula = (x: number) => (fn === 'sin' ? a * kk * Math.cos(kk * x) : -a * kk * Math.sin(kk * x));
      for (const x of [-0.4, 0.37, 1.1]) if (!close(derivative(g, x), formula(x), 1e-3)) fail('formula is not the derivative');
      const c = fn === 'sin' ? a * kk : -a * kk;
      const head = c === 1 ? '' : c === -1 ? '−' : minus(c);
      const expected = `${head}${fn === 'sin' ? 'cos' : 'sin'}(${kk === 1 ? 'x' : `${kk}x`})`;
      if (expected !== p.correct) fail(`correct text ${p.correct} vs ${expected}`);
      break;
    }
    case 'vecNorm': expectNumber(norm(fact.v), 'norm'); break;
    case 'dot': expectNumber(dotOf(fact.a, fact.b), 'dot product'); break;
    case 'orthoParam':
      if (dotOf(fact.a, fact.b) !== 0) fail('not orthogonal');
      if (number !== undefined && fact.a[fact.index] !== number) fail('answer is not the entry');
      break;
    case 'distance': expectNumber(norm(fact.a.map((x, i) => fact.b[i] - x)), 'distance'); break;
    case 'vectorComponent': expectNumber(fact.to[fact.index] - fact.from[fact.index], 'component'); break;
    case 'lineParam':
      if (number !== undefined) for (let i = 0; i < 3; i++) if (fact.a[i] + number * fact.u[i] !== fact.p[i]) fail('point is not a + t u');
      break;
    case 'linePoint': expectNumber(fact.a[fact.index] + fact.t * fact.u[fact.index], 'line point'); break;
    case 'midpoint': expectNumber((fact.a[fact.index] + fact.b[fact.index]) / 2, 'midpoint'); break;
    case 'angle': {
      const dot = dotOf(fact.a, fact.b);
      expectNumber((Math.acos(Math.max(-1, Math.min(1, dot / (norm(fact.a) * norm(fact.b))))) * 180) / Math.PI, 'angle');
      break;
    }
    case 'onLine':
      if (!lineContains(fact.a, fact.u, fact.right)) fail('right point is not on the line');
      if (p.correct !== `P${vectorText(fact.right)}`) fail('correct text differs');
      for (const w of fact.wrong) if (lineContains(fact.a, fact.u, w)) fail('wrong point is on the line');
      if (!p.wrong.every((w) => fact.wrong.map((x) => `P${vectorText(x)}`).includes(w))) fail('wrong options differ from the facts');
      break;
    case 'orthogonalPair':
      if (dotOf(fact.right[0], fact.right[1]) !== 0) fail('right pair is not orthogonal');
      if (fact.right[0].every((x) => x === 0) || fact.right[1].every((x) => x === 0)) fail('zero vector');
      for (const w of fact.wrong) if (dotOf(w[0], w[1]) === 0) fail('wrong pair is orthogonal');
      break;
    case 'direction': {
      const dir = fact.a.map((x, i) => fact.b[i] - x);
      if (p.correct !== vectorText(dir)) fail('correct vector differs');
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
      const balls = [...Array(fact.red).fill(1), ...Array(fact.blue).fill(0)] as number[];
      let good = 0;
      let all = 0;
      switch (fact.mode) {
        case 'oneRed': good = balls.filter((b) => b === 1).length; all = balls.length; break;
        case 'twoRedWith':
          for (const x of balls) for (const y of balls) { all += 1; if (x === 1 && y === 1) good += 1; }
          break;
        default:
          balls.forEach((x, i) => balls.forEach((y, j) => {
            if (i === j) return;
            all += 1;
            if (fact.mode === 'twoRedWithout' ? x === 1 && y === 1 : x !== y) good += 1;
          }));
      }
      expectNumber(good / all, 'urn');
      break;
    }
    case 'choose':
      if (!(fact.n >= fact.kk && fact.kk >= 0 && fact.n > 0)) { fail('degenerate n, k'); break; }
      expectNumber(binomialDoubles(fact.n)[fact.kk], 'n over k');
      break;
    case 'binomial': {
      const probs = pmf(fact.n, fact.p.double);
      if (!close(sum(probs), 1, 1e-12)) fail('pmf does not sum to 1');
      switch (fact.kind.k) {
        case 'equal': expectNumber(probs[fact.kind.v], 'P(X=k)'); break;
        case 'atMost': expectNumber(sum(probs.slice(0, fact.kind.v + 1)), 'P(X<=k)'); break;
        case 'atLeast': expectNumber(sum(probs.slice(fact.kind.v)), 'P(X>=k)'); break;
        default: expectNumber(1 - (1 - fact.p.double) ** fact.n, 'at least one');
      }
      break;
    }
    case 'expectation': expectNumber(fact.n * fact.p.double, 'E(X)'); break;
    case 'expectationTable':
      if (!close(sum(fact.probabilities.map((x) => x.double)), 1, 1e-12)) fail('probabilities do not sum to 1');
      expectNumber(sum(fact.values.map((v, i) => v.double * fact.probabilities[i].double)), 'E(X) of a table');
      break;
    case 'sigma': expectNumber(Math.sqrt(fact.n * fact.p.double * (1 - fact.p.double)), 'sigma'); break;
    case 'table': {
      const t = fact.t;
      const n = tableTotal(t);
      const [a, b, c, dd] = [t.a, t.b, t.c, t.d];
      if (t.a <= 0 || t.b <= 0 || t.c <= 0 || t.d <= 0) fail('empty cell');
      let value: number;
      switch (fact.ask) {
        case 'pA': value = (a + b) / n; break;
        case 'pB': value = (a + c) / n; break;
        case 'pAandB': value = a / n; break;
        case 'pAorB': value = (a + b + c) / n; break;
        case 'pNotAandB': value = c / n; break;
        case 'pNotAandNotB': value = dd / n; break;
        case 'pAgivenB': value = a / (a + c); break;
        case 'pBgivenA': value = a / (a + b); break;
        default: value = b / (a + b);
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
      const t = fact.t;
      const n = tableTotal(t);
      const left = t.a * n;
      const right = (t.a + t.b) * (t.a + t.c);
      const expected = left === right ? 'Ja, denn P(A∩B) = P(A)·P(B).' : left > right ? 'Nein, denn P(A∩B) ist größer als P(A)·P(B).' : 'Nein, denn P(A∩B) ist kleiner als P(A)·P(B).';
      if (expected !== p.correct) fail('independence verdict differs');
      break;
    }
    case 'pairs':
    case 'concept':
      break;
  }
  return out;
}

export { UPoly, UQ };
