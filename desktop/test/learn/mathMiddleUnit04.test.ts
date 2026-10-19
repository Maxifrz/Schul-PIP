import { describe, it } from 'vitest';
import { Expression as Expr, check, close, match, matches, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';
import { mathText } from '../../src/lib/learn/math/middle/text';

/** Unit 4, Terme und lineare Gleichungen: terms are compared by evaluating them at several points, equations by
 * putting the solution back in, the stories by trying every whole number. */
const samples = [-4, -3, -1, 0, 1, 2, 3, 5, 7];
const lastLine = (prompt: string) => prompt.split('\n').at(-1) ?? '';
const MINUS = '−';
const asInt = (text: string) => Number(text.split(MINUS).join('-'));
const range = (low: number, high: number) => Array.from({ length: high - low + 1 }, (_, i) => low + i);

/** Whether two terms have the same value at every sample point; null when one cannot be read. */
function equivalent(a: string, b: string): boolean | null {
  for (const x of samples) {
    const left = Expr.evaluate(a, { x });
    const right = Expr.evaluate(b, { x });
    if (left === null || right === null) return null;
    if (!close(left, right)) return false;
  }
  return true;
}

/** The coefficient and the constant of a term that is linear in x, found by evaluating at 0 and 1. */
function linearParts(term: string): { coefficient: number; constant: number } | null {
  const atZero = Expr.evaluate(term, { x: 0 });
  const atOne = Expr.evaluate(term, { x: 1 });
  return atZero === null || atOne === null ? null : { coefficient: atOne - atZero, constant: atZero };
}

function checkEquation(p: Problem): string | null {
  const equation = lastLine(p.prompt);
  const x = p.prompt.startsWith('Löse die Gleichung. Welchen Wert hat x?\n') ? number(p.correct) : null;
  if (x === null) return 'prompt';
  if (Expr.holds(equation, x) !== true) return `the solution ${p.correct} does not fit ${equation}`;
  // A linear equation with one solution: the sides differ at two other points.
  if (Expr.holds(equation, x + 1) !== false || Expr.holds(equation, x - 2) !== false) return 'not a single solution';
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, x)) return 'typed answer';
  for (const option of optionsOf(p)) {
    const value = number(option);
    if (value === null) return `wrong option ${option}`;
    if (Expr.holds(equation, value) !== false) return `wrong option ${option} solves the equation`;
  }
  if (p.pairFront !== equation) return 'pair front';
  if (!(p.solution.includes('stimmt') || p.solution.includes('=')) || !p.solution.includes(mathText.int(x))) return 'solution';
  return null;
}

describe('math middle unit 4', () => {
  it('evalTerm', () => check('u04.evalTerm', (level, p) => {
    const m = match(`^Berechne den Wert von (.+) für x = (${MINUS}?\\d+)\\.$`, p.prompt);
    const x = m ? number(m[2]) : null;
    if (!m || x === null) return 'prompt';
    const expected = Expr.evaluate(m[1], { x });
    if (expected === null) return `term ${m[1]}`;
    if (level === 3 && !m[1].includes('²')) return 'level 3 has a square';
    if (level === 1 && x <= 0) return 'level 1 has positive x';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return `wrong option ${option}`;
      if (close(value, expected)) return `wrong option ${option} is right`;
    }
    if (p.pairFront !== `${m[1]} für x = ${m[2]}`) return 'pair front';
    // The worked result ends in the answer.
    const last = matches(`= (${MINUS}?\\d+)$`, p.solution).at(-1);
    const lastValue = last ? number(last[1]) : null;
    if (lastValue === null || !close(lastValue, expected)) return `solution ${p.solution}`;
    return null;
  }));

  it('simplify', () => check('u04.simplify', (level, p) => {
    const expression = lastLine(p.prompt);
    const parts = p.prompt.startsWith('Fasse zusammen:\n') ? linearParts(p.correct) : null;
    if (!parts) return 'prompt';
    if (equivalent(expression, p.correct) !== true) return `correct option ${p.correct} differs from the term`;
    // Neither x-terms nor numbers are lost.
    if (parts.coefficient === 0 || parts.constant === 0) return 'degenerate result';
    const typed = typedAnswer(p);
    const typedPrompt = p.typed?.prompt;
    if (typed === null || !typedPrompt) return 'typed';
    const asksCoefficient = typedPrompt.includes('vor dem x');
    if (!close(typed, asksCoefficient ? parts.coefficient : parts.constant)) return `typed answer ${typed}`;
    if (asksCoefficient && Math.abs(parts.coefficient) === 1) return 'asks for an invisible 1';
    for (const option of optionsOf(p)) if (equivalent(expression, option) !== false) return `wrong option ${option} is equivalent`;
    if (p.pairFront !== expression) return 'pair front';
    if (level === 1 && expression.includes(MINUS)) return 'level 1 without minus';
    if (level >= 2 && !expression.includes(MINUS)) return 'levels 2 and 3 subtract';
    return null;
  }));

  it('expand', () => check('u04.expand', (level, p) => {
    const expression = lastLine(p.prompt);
    const parts = p.prompt.startsWith('Löse die Klammer auf:\n') ? linearParts(p.correct) : null;
    if (!parts) return 'prompt';
    if (equivalent(expression, p.correct) !== true) return `correct option ${p.correct} differs from ${expression}`;
    if (p.correct.includes('(') || !expression.includes('(')) return 'bracket';
    const typed = typedAnswer(p);
    const typedPrompt = p.typed?.prompt;
    if (typed === null || !typedPrompt) return 'typed';
    const asksCoefficient = typedPrompt.includes('vor dem x');
    if (!close(typed, asksCoefficient ? parts.coefficient : parts.constant)) return 'typed answer';
    for (const option of optionsOf(p)) if (equivalent(expression, option) !== false) return `wrong option ${option} is equivalent`;
    const hard = match(`^\\d+ ${MINUS} \\d+\\(x \\+ \\d+\\)$`, expression) !== null || match(`^\\d+\\(\\d+x ${MINUS} \\d+\\)$`, expression) !== null;
    if (level === 3 && !hard) return `level 3 form ${expression}`;
    if (level < 3 && hard) return 'hard form below level 3';
    if (p.pairFront !== expression) return 'pair front';
    return null;
  }));

  it('oneStep', () => check('u04.oneStep', (level, p) => {
    const message = checkEquation(p);
    if (message) return message;
    const equation = lastLine(p.prompt);
    let solutions: number[];
    let m: string[] | null;
    if ((m = match(`^x \\+ (\\d+) = (${MINUS}?\\d+)$`, equation))) solutions = range(-300, 300).filter((v) => v + asInt(m![1]) === asInt(m![2]));
    else if ((m = match(`^x ${MINUS} (\\d+) = (${MINUS}?\\d+)$`, equation))) solutions = range(-300, 300).filter((v) => v - asInt(m![1]) === asInt(m![2]));
    else if ((m = match(`^(${MINUS}?\\d+)x = (${MINUS}?\\d+)$`, equation))) solutions = range(-300, 300).filter((v) => asInt(m![1]) * v === asInt(m![2]));
    else if ((m = match(`^x : (\\d+) = (${MINUS}?\\d+)$`, equation))) solutions = range(-300, 300).filter((v) => v % asInt(m![1]) === 0 && Math.trunc(v / asInt(m![1])) === asInt(m![2]));
    else return `form ${equation}`;
    const right = number(p.correct);
    if (solutions.length !== 1 || right === null || right !== solutions[0]) return `brute force ${solutions}`;
    if (level === 1 && !(equation.startsWith('x + ') || equation.startsWith(`x ${MINUS} `))) return 'level 1 adds and subtracts';
    if (level === 1 && right < 1) return 'level 1 has positive solutions';
    return null;
  }));

  it('twoStep', () => check('u04.twoStep', (level, p) => {
    const message = checkEquation(p);
    if (message) return message;
    const equation = lastLine(p.prompt);
    const m = match(`^(${MINUS}?\\d*)x (\\+|${MINUS}) (\\d+) = (${MINUS}?\\d+)$`, equation);
    if (!m) return `form ${equation}`;
    const a = m[1] === '' ? 1 : m[1] === MINUS ? -1 : asInt(m[1]);
    if (Math.abs(a) < 2) return `factor ${a}`;
    if (level === 1 && a < 0) return 'level 1 positive';
    // Brute force over the whole numbers, no algebra.
    const b = Number(m[3]) * (m[2] === '+' ? 1 : -1);
    const c = asInt(m[4]);
    const solutions = range(-60, 60).filter((v) => a * v + b === c);
    const right = number(p.correct);
    if (solutions.length !== 1 || right === null || right !== solutions[0]) return `brute force ${solutions}`;
    return null;
  }));

  it('brackets', () => check('u04.brackets', (level, p) => {
    const message = checkEquation(p);
    if (message) return message;
    const equation = lastLine(p.prompt);
    const m = match(`^(\\d)\\(x (\\+|${MINUS}) (\\d)\\)(?: (\\+|${MINUS}) (\\d+))? = (${MINUS}?\\d+)$`, equation);
    if (!m) return `form ${equation}`;
    const a = Number(m[1]);
    const shift = Number(m[3]) * (m[2] === '+' ? 1 : -1);
    const d = m[4] === '' ? 0 : Number(m[5]) * (m[4] === '+' ? 1 : -1);
    const e = asInt(m[6]);
    const solutions = range(-60, 60).filter((v) => a * (v + shift) + d === e);
    const right = number(p.correct);
    if (solutions.length !== 1 || right === null || right !== solutions[0]) return 'brute force';
    if (level < 3 && d !== 0) return 'outside number only at level 3';
    if (level === 3 && d === 0) return 'level 3 has a number outside';
    if (level === 1 && shift < 0) return 'level 1 adds inside';
    return null;
  }));

  it('bothSides', () => check('u04.bothSides', (level, p) => {
    const message = checkEquation(p);
    if (message) return message;
    const equation = lastLine(p.prompt);
    const sides = equation.split(' = ');
    if (sides.length !== 2 || !sides.every((s) => s.includes('x'))) return 'x on both sides';
    if (level === 3 && !sides[0].includes('(')) return 'level 3 has a bracket';
    if (level < 3 && equation.includes('(')) return 'brackets only at level 3';
    // Different slopes: exactly one solution, and two sample points give two different differences.
    const diff0 = Expr.evaluate(sides[0], { x: 0 })! - Expr.evaluate(sides[1], { x: 0 })!;
    const diff1 = Expr.evaluate(sides[0], { x: 1 })! - Expr.evaluate(sides[1], { x: 1 })!;
    if (diff0 === diff1) return 'parallel sides';
    // The solution by the intercept formula, another way than the generator's.
    if (!close(-diff0 / (diff1 - diff0), number(p.correct)!)) return 'intercept formula';
    return null;
  }));

  it('plugIn', () => check('u04.plugIn', (level, p) => {
    const equation = lastLine(p.prompt);
    const x = p.prompt.startsWith('Welche Zahl ist die Lösung der Gleichung? Setze zur Probe ein.\n') ? number(p.correct) : null;
    if (x === null) return 'prompt';
    const sides = equation.split(' = ');
    if (sides.length !== 2 || Expr.holds(equation, x) !== true) return 'the solution does not fit';
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return `wrong option ${option}`;
      if (Expr.holds(equation, value) !== false) return `wrong option ${option} fits`;
    }
    const typedPrompt = p.typed?.prompt;
    const m = typedPrompt ? match(`Die Lösung der Gleichung (.+) ist x = (${MINUS}?\\d+)\\.\\nWelchen Wert haben beide Seiten`, typedPrompt) : null;
    if (!m) return 'typed prompt';
    if (m[1] !== equation || number(m[2]) !== x) return 'typed equation';
    const both = Expr.evaluate(sides[0], { x })!;
    const typed = typedAnswer(p);
    if (!close(both, Expr.evaluate(sides[1], { x })!) || typed === null || !close(typed, both)) return 'typed answer';
    if (level === 3 && !sides[0].includes('(')) return 'level 3 has a bracket';
    return null;
  }));

  it('word', () => check('u04.word', (level, p) => {
    const right = number(p.correct);
    if (right === null) return 'correct';
    const prompt = p.prompt.split('\n').join(' ');
    let truth: number[];
    let m: string[] | null;
    if ((m = match('^Ich denke mir eine Zahl\\. (Ich verdopple sie|Ich multipliziere sie mit (\\d+)) und (addiere|subtrahiere) (\\d+)\\. Das Ergebnis ist (\\d+)\\.', prompt))) {
      if (level !== 1) return 'puzzle only at level 1';
      const factor = m[1] === 'Ich verdopple sie' ? 2 : Number(m[2]);
      const b = Number(m[4]) * (m[3] === 'addiere' ? 1 : -1);
      const result = Number(m[5]);
      truth = range(0, 300).filter((v) => factor * v + b === result);
    } else if ((m = match('(\\d+) € (?:Grundgebühr|Pauschale|für die Anfahrt) und (\\d+) € je .+?(\\d+) €', prompt))) {
      if (level !== 2) return 'tariff only at level 2';
      const [b, a, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
      truth = range(0, 300).filter((v) => b + a * v === c);
    } else if ((m = match('hat (\\d+) € und spart (\\d+) € pro Woche\\. \\w+ hat (\\d+) € und spart (\\d+) € pro Woche', prompt))) {
      if (level !== 3) return 'equal amounts only at level 3';
      const [p1, r1, p2, r2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      truth = range(0, 300).filter((v) => p1 + r1 * v === p2 + r2 * v);
      if (r1 - r2 < 2) return 'rates too close';
    } else return 'prompt';
    if (truth.length !== 1 || right !== truth[0]) return `brute force ${truth} vs ${p.correct}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, right)) return 'typed';
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return 'wrong option';
      if (close(value, right)) return `wrong option ${option} is right`;
    }
    if (right < 2) return 'answer too small for a plural';
    return null;
  }));
});
