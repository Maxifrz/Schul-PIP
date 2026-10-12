// Ports of LernwerkTests/MathCourseMiddleUnit01Tests.swift to Unit04Tests.swift: every problem is read back from its
// prompt and recomputed another way.
import { describe, it } from 'vitest';
import { type Problem, problemOptions } from '../../src/lib/learn/math/middle/core';
import * as T from '../../src/lib/learn/math/middle/text';
import { Expr, bruteGCD, bruteLCM, check, close, firstLine, int, integers, lastLine, match, matches, number, span, typedAnswer } from './mathMiddleKit';

const T60 = 120_000;
const MINUS = '−';
const dash = (s: string): string => s.split(MINUS).join('-');

// Unit 1

const fraction = (text: string): [number, number] | null => {
  const m = match(/^(\d+)\/(\d+)$/, text.trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/** All wrong options are numbers that differ from the expected value. */
function wrongDiffer(p: Problem, expected: number): string | null {
  for (const option of problemOptions(p)) {
    const value = number(option);
    if (value === null) continue;
    if (close(value, expected)) return `wrong option ${option} equals the answer`;
  }
  return null;
}

describe('unit 1: Brüche verstehen', { timeout: T60 }, () => {
  it('fractionOf', () => {
    check('u01.fractionOf', (level, p) => {
      const m = match(/Berechne (\d+)\/(\d+) von (\d+)/, p.prompt);
      if (!m) return 'prompt';
      const [n, d, whole] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const expected = (n * whole) / d;
      if (expected !== Math.round(expected)) return 'not a whole number';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed answer';
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return `correct option ${p.correct}`;
      if (bruteGCD(n, d) !== 1) return 'fraction not reduced';
      if (!p.pairFront?.startsWith(`${m[1]}/${m[2]} von ${m[3]}`)) return 'pair front';
      if (level === 1 && whole > 60) return 'level 1 too big';
      return wrongDiffer(p, expected);
    });
  });

  it('share', () => {
    check('u01.share', (level, p) => {
      const head = firstLine(p.prompt);
      const numbers = integers(head);
      if (numbers.length !== 2) return 'numbers';
      const total = Math.max(...numbers);
      const part = Math.min(...numbers);
      if (!(part < total)) return 'numbers';
      const expected = part / total;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed answer';
      const shown = fraction(p.correct);
      if (!shown || !close(shown[0] / shown[1], expected)) return `correct option ${p.correct}`;
      if (bruteGCD(shown[0], shown[1]) !== 1) return 'answer not reduced';
      const divisor = bruteGCD(part, total);
      if (level < 3 && divisor !== 1) return 'levels 1 and 2 need no reducing';
      if (level === 3 && divisor === 1) return 'level 3 reduces';
      if (part * 2 === total) return 'one half';
      if (p.pairFront !== `${part} von ${total}`) return 'pair front';
      return wrongDiffer(p, expected);
    });
  });

  it('mixedToImproper', () => {
    check('u01.mixedToImproper', (_l, p) => {
      const m = match(/Schreibe (\d+) (\d+)\/(\d+) als unechten Bruch/, p.prompt);
      if (!m) return 'prompt';
      const [whole, n, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const value = whole + n / d;
      const shown = fraction(p.correct);
      if (!shown || !close(shown[0] / shown[1], value) || shown[1] !== d || !(shown[0] > shown[1])) return `correct option ${p.correct}`;
      const typedPrompt = p.typed?.prompt;
      const t = typedPrompt ? match(/mit dem Nenner (\d+)/, typedPrompt) : null;
      if (!t || !close(Number(t[1]), d)) return 'typed prompt';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, value * d)) return 'typed answer';
      if (p.pairFront !== `${m[1]} ${m[2]}/${m[3]}`) return 'pair front';
      return wrongDiffer(p, value);
    });
  });

  it('improperToMixed', () => {
    check('u01.improperToMixed', (_l, p) => {
      const m = match(/Schreibe (\d+)\/(\d+) als gemischte Zahl/, p.prompt);
      if (!m) return 'prompt';
      const [top, bottom] = [Number(m[1]), Number(m[2])];
      const value = top / bottom;
      const parts = match(/^(\d+) (\d+)\/(\d+)$/, p.correct);
      if (!parts) return `correct option ${p.correct}`;
      const [whole, rest, denominator] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
      if (!(denominator === bottom && rest < denominator && whole >= 1 && close(whole + rest / denominator, value))) return 'mixed number wrong';
      const typed = typedAnswer(p);
      const typedPrompt = p.typed?.prompt;
      if (typed === null || !typedPrompt) return 'typed';
      // The count of wholes by counting down, the rest by subtraction.
      let left = top;
      let wholes = 0;
      while (left >= bottom) {
        left -= bottom;
        wholes += 1;
      }
      const expected = typedPrompt.includes('ganze Einheiten') ? wholes : left;
      if (!close(typed, expected)) return `typed answer ${typed} expected ${expected}`;
      if (p.pairFront !== `${top}/${bottom}`) return 'pair front';
      return wrongDiffer(p, value);
    });
  });

  it('equivalent', () => {
    check('u01.equivalent', (_l, p) => {
      const m = match(/(\d+)\/(\d+) = (\d+|\?)\/(\d+|\?)/, p.prompt);
      if (!m) return 'prompt';
      const [a, b] = [Number(m[1]), Number(m[2])];
      const missingNumerator = m[3] === '?';
      const known = Number(missingNumerator ? m[4] : m[3]);
      const expected = missingNumerator ? (a * known) / b : (b * known) / a;
      if (expected !== Math.round(expected) || !(expected > 0)) return 'no whole answer';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed answer';
      const right = number(p.correct);
      if (right === null || !close(right, expected)) return 'correct option';
      // Plug the answer in: both fractions are the same number.
      const [c, d] = missingNumerator ? [expected, known] : [known, expected];
      if (!close(a / b, c / d)) return 'fractions differ';
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return 'wrong option text';
        const [wc, wd] = missingNumerator ? [value, known] : [known, value];
        if (close(a / b, wc / wd)) return `wrong option ${option} is right`;
      }
      if (p.pairFront !== `${m[1]}/${m[2]} = ${m[3]}/${m[4]}`) return 'pair front';
      return null;
    });
  });

  it('reduce', () => {
    check('u01.reduce', (level, p) => {
      const m = match(/Kürze vollständig:\n(\d+)\/(\d+)/, p.prompt);
      if (!m) return 'prompt';
      const [a, b] = [Number(m[1]), Number(m[2])];
      const g = bruteGCD(a, b);
      if (!(g > 1 && (level === 1 ? g <= 5 : true))) return `gcd ${g}`;
      const right = fraction(p.correct);
      if (!right || right[0] !== a / g || right[1] !== b / g || bruteGCD(right[0], right[1]) !== 1) return `correct option ${p.correct}`;
      for (const option of problemOptions(p)) {
        const w = fraction(option);
        if (!w) return `wrong option ${option}`;
        if (w[0] * right[1] === w[1] * right[0] && bruteGCD(w[0], w[1]) === 1) return `wrong option ${option} is the reduced fraction`;
        if (w[0] === right[0] && w[1] === right[1]) return 'wrong option equals the answer';
      }
      if (!p.allowsEquivalentWrong) return 'flag';
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, g) || p.typed?.prompt.includes(`${a}/${b}`) !== true) return 'typed answer';
      if (p.pairFront !== `${a}/${b}`) return 'pair front';
      return null;
    });
  });

  it('isReduced', () => {
    check('u01.isReduced', (_l, p) => {
      const asksReducible = p.prompt.includes('noch kürzen');
      if (!(asksReducible || p.prompt.includes('nicht mehr kürzen'))) return 'prompt';
      const right = fraction(p.correct);
      if (!right) return 'correct option';
      const rightReducible = bruteGCD(right[0], right[1]) > 1;
      if (rightReducible !== asksReducible) return 'the right option is not the odd one';
      const options = problemOptions(p);
      if (options.length !== 3) return 'needs three wrong options';
      for (const option of options) {
        const w = fraction(option);
        if (!w) return 'wrong option';
        if (bruteGCD(w[0], w[1]) > 1 === asksReducible) return `wrong option ${option} fits the question`;
        if (w[0] >= w[1]) return 'improper fraction';
      }
      return null;
    });
  });

  it('compare', () => {
    check('u01.compare', (_l, p) => {
      const m = match(/(\d+)\/(\d+) oder (\d+)\/(\d+)/, p.prompt);
      if (!m) return 'prompt';
      const [a, b, c, d] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      // Cross products decide, not division.
      const leftLarger = a * d > c * b;
      if (a * d === c * b) return 'equal fractions';
      const larger = leftLarger ? `${a}/${b}` : `${c}/${d}`;
      const smaller = leftLarger ? `${c}/${d}` : `${a}/${b}`;
      const options = problemOptions(p);
      if (p.correct !== larger || options.length !== 2 || options[0] !== smaller || options[1] !== 'Beide sind gleich groß.') return 'options';
      const t = p.typed ? match(/auf den Nenner (\d+)/, p.typed.prompt) : null;
      if (!t) return 'typed prompt';
      const common = Number(t[1]);
      if (common !== bruteLCM(b, d)) return 'not the common denominator';
      const expected = Math.max(a * (common / b), c * (common / d));
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, expected)) return 'typed answer';
      if (p.pairFront !== `${a}/${b} oder ${c}/${d}`) return 'pair front';
      return null;
    });
  });

  it('order', () => {
    check('u01.order', (_l, p) => {
      const listing = lastLine(p.prompt);
      const given = matches(/(\d+)\/(\d+)/, listing).map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
      if (given.length !== 3) return 'three fractions';
      const sorted = given.slice().sort((x, y) => (x[0] * y[1] < y[0] * x[1] ? -1 : y[0] * x[1] < x[0] * y[1] ? 1 : 0));
      if (sorted[0][0] * sorted[1][1] === sorted[1][0] * sorted[0][1] || sorted[1][0] * sorted[2][1] === sorted[2][0] * sorted[1][1]) return 'equal fractions';
      const chain = (text: string): [number, number][] => matches(/(\d+)\/(\d+)/, text).map((m) => [Number(m[1]), Number(m[2])]);
      const right = chain(p.correct);
      if (right.length !== 3 || !right.every((r, i) => r[0] === sorted[i][0] && r[1] === sorted[i][1])) return `correct chain ${p.correct}`;
      if (p.correct.split(' < ').length !== 3) return 'chain format';
      for (const option of problemOptions(p)) {
        const w = chain(option);
        if (w.length !== 3 || [...new Set(w.map((x) => `${x[0]}/${x[1]}`))].sort().join() !== [...new Set(given.map((x) => `${x[0]}/${x[1]}`))].sort().join()) return 'wrong chain is no permutation';
        const ascending = w.slice(0, -1).every((x, i) => x[0] * w[i + 1][1] < w[i + 1][0] * x[1]);
        if (ascending) return `wrong chain ${option} is ascending`;
      }
      const t = p.typed ? match(/auf den Nenner (\d+)/, p.typed.prompt) : null;
      if (!t) return 'typed prompt';
      const common = Number(t[1]);
      if (!given.every((g) => common % g[1] === 0)) return 'not a common denominator';
      const middle = sorted[1];
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, middle[0] * (common / middle[1]))) return 'typed answer';
      return null;
    });
  });

  it('between', () => {
    check('u01.between', (_l, p) => {
      const m = match(/zwischen (\d+)\/(\d+) und (\d+)\/(\d+)/, p.prompt);
      if (!m) return 'prompt';
      const lower = Number(m[1]) / Number(m[2]);
      const upper = Number(m[3]) / Number(m[4]);
      const right = number(p.correct);
      if (!(lower < upper) || right === null || !(right > lower) || !(right < upper)) return `correct option ${p.correct}`;
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        if (value > lower && value < upper) return `wrong option ${option} lies between`;
      }
      return null;
    });
  });
});

// Unit 2

/** The line after "Berechne:" evaluated, or null. */
function valueOf(prompt: string): number | null {
  const lines = prompt.split('\n');
  if (lines.length < 2 || lines[0] !== 'Berechne:') return null;
  return Expr.evaluate(lines[1]);
}

const expressionOf = (prompt: string): string => prompt.split('\n')[1] ?? '';

/** Checks an arithmetic template: the expression, the typed answer, the right option, the wrong ones, the pair. */
function checkArithmetic(id: string, more?: (level: number, p: Problem, expected: number) => string | null): void {
  check(id, (level, p) => {
    const expected = valueOf(p.prompt);
    if (expected === null) return 'cannot read the expression';
    if (expected <= 0) return 'result not positive';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return `typed answer ${typed} expected ${expected}`;
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct}`;
    for (const option of problemOptions(p)) {
      const wrong = number(option);
      if (wrong === null) return `wrong option ${option}`;
      if (close(wrong, expected)) return `wrong option ${option} is right`;
    }
    if (p.pairFront !== expressionOf(p.prompt)) return `pair front ${p.pairFront ?? ''}`;
    return more ? more(level, p, expected) : null;
  });
}

/** The typed answer, the right option and the wrong options against a value computed from the prompt. */
function commonAnswer(p: Problem, expected: number): string | null {
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, expected)) return `typed answer ${typed} expected ${expected}`;
  const right = number(p.correct);
  if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
  for (const option of problemOptions(p)) {
    const wrong = number(option);
    if (wrong === null) return `wrong option ${option}`;
    if (close(wrong, expected)) return `wrong option ${option} is right`;
  }
  return null;
}

describe('unit 2: Bruchrechnung', { timeout: T60 }, () => {
  it('add', () => {
    checkArithmetic('u02.add', (level, p, expected) => {
      // Two proper fractions, and the denominators fit the level.
      const fractions = matches(/(\d+)\/(\d+)/, expressionOf(p.prompt)).map((m) => [Number(m[1]), Number(m[2])]);
      if (fractions.length !== 2 || !fractions.every((f) => f[0] < f[1] && bruteGCD(f[0], f[1]) === 1)) return 'operands';
      if (level === 1 && fractions[0][1] !== fractions[1][1] && fractions[1][1] % fractions[0][1] !== 0) return 'level 1 denominators';
      if (expected > 2) return 'sum too big';
      return null;
    });
  });

  it('subtract', () => {
    checkArithmetic('u02.subtract', (_l, _p, expected) => (expected < 1 ? null : 'difference too big'));
  });

  it('mixedAddSub', () => {
    checkArithmetic('u02.mixedAddSub', (level, p) => {
      const line = expressionOf(p.prompt);
      if (level === 3 && !line.includes('−')) return 'level 3 subtracts';
      if (level < 3 && !line.includes('+')) return 'levels 1 and 2 add';
      const parts = match(/^(\d+) (\d+)\/(\d+) [+−] (\d+) (\d+)\/(\d+)$/, line);
      if (!parts) return 'operands are two mixed numbers';
      if (!(Number(parts[2]) < Number(parts[3]) && Number(parts[5]) < Number(parts[6]))) return 'improper fraction part';
      return null;
    });
  });

  it('multiply', () => {
    checkArithmetic('u02.multiply');
  });

  it('divide', () => {
    checkArithmetic('u02.divide');
  });

  it('order of operations', () => {
    checkArithmetic('u02.order', (_l, p) => (expressionOf(p.prompt) === '' ? 'no expression' : null));
  });

  it('mixedMulDiv', () => {
    checkArithmetic('u02.mixedMulDiv');
  });

  it('fitsIn', () => {
    check('u02.fitsIn', (_l, p) => {
      const patterns = [
        /Aus (.+?) l Saft werden Gläser zu (\d+\/\d+) l/,
        /Ein Band ist (.+?) m lang\. Daraus werden Stücke zu (\d+\/\d+) m/,
        /Ein Sack enthält (.+?) kg Mehl\. Jede Tüte fasst (\d+\/\d+) kg/,
      ];
      const m = patterns.map((re) => match(re, p.prompt)).find((x) => x !== null);
      if (!m) return 'prompt';
      const total = number(m[1]);
      const portion = number(m[2]);
      if (total === null || portion === null) return 'numbers';
      const expected = total / portion;
      if (!close(expected, Math.round(expected)) || !close(Math.round(expected) * portion, total)) return `not a whole number of portions: ${expected}`;
      return commonAnswer(p, expected);
    });
  });

  it('partOfPart', () => {
    check('u02.partOfPart', (_l, p) => {
      const first = firstLine(p.prompt);
      const fractions = matches(/(\d+)\/(\d+)/, first).map((m) => Number(m[1]) / Number(m[2]));
      if (fractions.length !== 2) return 'two fractions';
      return commonAnswer(p, fractions[0] * fractions[1]);
    });
  });

  it('word', () => {
    check('u02.word', (_l, p) => {
      const first = firstLine(p.prompt);
      let expected: number;
      const m = match(/Für (\d+) Portionen braucht man (\d+)\/(\d+)/, first);
      if (m) {
        expected = Number(m[2]) / Number(m[3]) / Number(m[1]);
      } else {
        const fractions = matches(/(\d+)\/(\d+)/, first).map((x) => Number(x[1]) / Number(x[2]));
        if (fractions.length !== 2 || !(fractions[0] + fractions[1] < 1)) return 'two fractions';
        expected = 1 - fractions[0] - fractions[1];
      }
      return commonAnswer(p, expected);
    });
  });
});

// Unit 3

describe('unit 3: Dezimalzahlen und Prozent', { timeout: T60 }, () => {
  it('fractionToPercent', () => {
    check('u03.fractionToPercent', (_l, p) => {
      const m = match(/Wie viel Prozent sind (.+)\?/, p.prompt);
      const source = m ? number(m[1]) : null;
      if (!m || source === null) return 'prompt';
      if (p.pairFront !== m[1]) return 'pair front';
      if (!p.correct.endsWith(' %')) return 'unit';
      return commonAnswer(p, source * 100);
    });
  });

  it('percentToDecimal', () => {
    check('u03.percentToDecimal', (_l, p) => {
      const m = match(/Schreibe (.+?) % als Dezimalzahl/, p.prompt);
      const rate = m ? number(m[1]) : null;
      if (!m || rate === null) return 'prompt';
      if (p.pairFront !== `${m[1]} %`) return 'pair front';
      return commonAnswer(p, rate / 100);
    });
  });

  it('decimalCalc', () => {
    check('u03.decimalCalc', (level, p) => {
      const lines = p.prompt.split('\n');
      const expected = lines.length === 2 && lines[0] === 'Berechne:' ? Expr.evaluate(lines[1]) : null;
      if (expected === null) return 'expression';
      if (!(expected > 0)) return 'not positive';
      if (p.pairFront !== lines[1]) return 'pair front';
      // The result has few places after the comma.
      const scaled = expected * 1000;
      if (!close(scaled, Math.round(scaled), 1e-7)) return `too many places: ${expected}`;
      if (level === 1 && (lines[1].includes('·') || lines[1].includes(':'))) return 'level 1 only adds and subtracts';
      return commonAnswer(p, expected);
    });
  });

  it('percentValue', () => {
    check('u03.percentValue', (_l, p) => {
      const m = match(/(\d+(?:,\d+)?) % von (\d+(?:,\d+)?)/, p.prompt);
      const rate = m ? number(m[1]) : null;
      const base = m ? number(m[2]) : null;
      if (rate === null || base === null) return 'prompt';
      return commonAnswer(p, (rate * base) / 100);
    });
  });

  it('percentRate', () => {
    check('u03.percentRate', (_l, p) => {
      const patterns = [/Wie viel Prozent sind (\d+) von (\d+)\?/, /Von (\d+) Schülern fehlen (\d+)\./, /Lena erreicht (\d+) von (\d+) Punkten/];
      let index = -1;
      let m: string[] | null = null;
      patterns.forEach((re, i) => {
        if (m === null) {
          const found = match(re, p.prompt);
          if (found) {
            m = found;
            index = i;
          }
        }
      });
      if (!m) return 'prompt';
      const g = m as string[];
      const [part, base] = index === 1 ? [Number(g[2]), Number(g[1])] : [Number(g[1]), Number(g[2])];
      if (!(part < base)) return 'part is not smaller';
      return commonAnswer(p, (part / base) * 100);
    });
  });

  it('baseValue', () => {
    check('u03.baseValue', (_l, p) => {
      const num = '(\\d+(?:,\\d+)?)';
      let rate: number;
      let part: number;
      let m = match(new RegExp(num + ' % einer Menge sind ' + num), p.prompt);
      if (m) {
        [rate, part] = [number(m[1])!, number(m[2])!];
      } else if ((m = match(new RegExp('Bei ' + num + ' % Rabatt spart Tom ' + num), p.prompt))) {
        [rate, part] = [number(m[1])!, number(m[2])!];
      } else if ((m = match(new RegExp('^' + num + ' \\S+ sind ' + num + ' % des Grundwerts'), p.prompt))) {
        [rate, part] = [number(m[2])!, number(m[1])!];
      } else {
        return 'prompt';
      }
      const expected = (part * 100) / rate;
      // Plugged back in: the rate of the answer is the part.
      if (!close((expected * rate) / 100, part)) return 'does not fit back';
      return commonAnswer(p, expected);
    });
  });

  it('priceChange', () => {
    check('u03.priceChange', (_l, p) => {
      const m = match(/kostet (\d+(?:,\d+)?) €\./, p.prompt);
      const base = m ? number(m[1]) : null;
      if (base === null) return 'base';
      let factor: number;
      const up = match(/steigt um (\d+(?:,\d+)?) %/, p.prompt);
      const down = match(/gibt (\d+(?:,\d+)?) % Rabatt/, p.prompt);
      if (up && number(up[1]) !== null) factor = 1 + number(up[1])! / 100;
      else if (down && number(down[1]) !== null) factor = 1 - number(down[1])! / 100;
      else return 'rate';
      return commonAnswer(p, base * factor);
    });
  });

  it('percentChange', () => {
    check('u03.percentChange', (_l, p) => {
      const m = match(/(steigt|sinkt) von (\d+) € auf (\d+) €/, p.prompt);
      if (!m) return 'prompt';
      const [old, nu] = [Number(m[2]), Number(m[3])];
      if ((m[1] === 'steigt') !== nu > old) return 'direction';
      const expected = (Math.abs(nu - old) / old) * 100;
      // Plugged back in.
      if (!close(old * (1 + ((nu > old ? 1 : -1) * expected) / 100), nu)) return 'does not fit back';
      return commonAnswer(p, expected);
    });
  });

  it('growthFactor', () => {
    check('u03.growthFactor', (_l, p) => {
      const m = match(/Ein Wert (steigt|sinkt) um (\d+(?:,\d+)?) %/, p.prompt);
      const rate = m ? number(m[2]) : null;
      if (!m || rate === null) return 'prompt';
      const expected = m[1] === 'steigt' ? 1 + rate / 100 : 1 - rate / 100;
      // 100 multiplied by the factor is 100 changed by the rate.
      if (!close(100 * expected, m[1] === 'steigt' ? 100 + rate : 100 - rate)) return 'factor';
      return commonAnswer(p, expected);
    });
  });

  it('vat', () => {
    check('u03.vat', (level, p) => {
      const money = '(\\d+(?:,\\d+)?)';
      const forwards = match(new RegExp('netto ' + money + ' €\\. Dazu kommen (\\d+) % Mehrwertsteuer'), p.prompt);
      if (forwards && number(forwards[1]) !== null) {
        if (level >= 3) return 'level 3 goes backwards';
        return commonAnswer(p, number(forwards[1])! * (1 + Number(forwards[2]) / 100));
      }
      const backwards = match(new RegExp('brutto ' + money + ' €, darin sind (\\d+) % Mehrwertsteuer'), p.prompt);
      if (backwards && number(backwards[1]) !== null) {
        if (level !== 3) return 'only level 3 goes backwards';
        const gross = number(backwards[1])!;
        const rate = Number(backwards[2]);
        const expected = gross / (1 + rate / 100);
        if (!close(expected * (1 + rate / 100), gross)) return 'does not fit back';
        // The classic mistake is never the right answer.
        return commonAnswer(p, expected);
      }
      return 'prompt';
    });
  });
});

// Unit 4

const samples = [-4, -3, -1, 0, 1, 2, 3, 5, 7];

/** Whether two terms have the same value at every sample point. */
function equivalent(a: string, b: string): boolean | null {
  for (const x of samples) {
    const left = Expr.evaluate(a, { x });
    const right = Expr.evaluate(b, { x });
    if (left === null || right === null) return null;
    if (!close(left, right)) return false;
  }
  return true;
}

/** The constant and the coefficient of a term that is linear in x, found by evaluating at 0 and 1. */
function linearParts(term: string): { coefficient: number; constant: number } | null {
  const atZero = Expr.evaluate(term, { x: 0 });
  const atOne = Expr.evaluate(term, { x: 1 });
  if (atZero === null || atOne === null) return null;
  return { coefficient: atOne - atZero, constant: atZero };
}

/** "Löse die Gleichung. Welchen Wert hat x?" plus the equation; the solution fits, the wrong options do not. */
function checkEquation(p: Problem): string | null {
  const equation = lastLine(p.prompt);
  const x = number(p.correct);
  if (!p.prompt.startsWith('Löse die Gleichung. Welchen Wert hat x?\n') || x === null) return 'prompt';
  if (Expr.holds(equation, x) !== true) return `the solution ${p.correct} does not fit ${equation}`;
  // A linear equation with one solution: the sides differ at two other points.
  if (Expr.holds(equation, x + 1) !== false || Expr.holds(equation, x - 2) !== false) return 'not a single solution';
  const typed = typedAnswer(p);
  if (typed === null || !close(typed, x)) return 'typed answer';
  for (const option of problemOptions(p)) {
    const value = number(option);
    if (value === null) return `wrong option ${option}`;
    if (Expr.holds(equation, value) !== false) return `wrong option ${option} solves the equation`;
  }
  if (p.pairFront !== equation) return 'pair front';
  if (!(p.solution.includes('stimmt') || p.solution.includes('=')) || !p.solution.includes(T.int(int(x)))) return 'solution';
  return null;
}

describe('unit 4: Terme und lineare Gleichungen', { timeout: T60 }, () => {
  it('evalTerm', () => {
    check('u04.evalTerm', (level, p) => {
      const m = match(/^Berechne den Wert von (.+) für x = (−?\d+)\.$/, p.prompt);
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
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return `wrong option ${option}`;
        if (close(value, expected)) return `wrong option ${option} is right`;
      }
      if (p.pairFront !== `${m[1]} für x = ${m[2]}`) return 'pair front';
      // The worked result ends in the answer.
      const all = matches(/= (−?\d+)$/, p.solution);
      const last = all.length > 0 ? number(all[all.length - 1][1]) : null;
      if (last === null || !close(last, expected)) return `solution ${p.solution}`;
      return null;
    });
  });

  it('simplify', () => {
    check('u04.simplify', (level, p) => {
      const expression = lastLine(p.prompt);
      const parts = linearParts(p.correct);
      if (!p.prompt.startsWith('Fasse zusammen:\n') || !parts) return 'prompt';
      if (equivalent(expression, p.correct) !== true) return `correct option ${p.correct} differs from the term`;
      // Neither x-terms nor numbers are lost.
      if (parts.coefficient === 0 || parts.constant === 0) return 'degenerate result';
      const typed = typedAnswer(p);
      const typedPrompt = p.typed?.prompt;
      if (typed === null || !typedPrompt) return 'typed';
      const asksCoefficient = typedPrompt.includes('vor dem x');
      if (!close(typed, asksCoefficient ? parts.coefficient : parts.constant)) return `typed answer ${typed}`;
      if (asksCoefficient && Math.abs(parts.coefficient) === 1) return 'asks for an invisible 1';
      for (const option of problemOptions(p)) if (equivalent(expression, option) !== false) return `wrong option ${option} is equivalent`;
      if (p.pairFront !== expression) return 'pair front';
      // Level 1 has no minus; levels 2 and 3 have.
      if (level === 1 && expression.includes(MINUS)) return 'level 1 without minus';
      if (level >= 2 && !expression.includes(MINUS)) return 'levels 2 and 3 subtract';
      return null;
    });
  });

  it('expand', () => {
    check('u04.expand', (level, p) => {
      const expression = lastLine(p.prompt);
      const parts = linearParts(p.correct);
      if (!p.prompt.startsWith('Löse die Klammer auf:\n') || !parts) return 'prompt';
      if (equivalent(expression, p.correct) !== true) return `correct option ${p.correct} differs from ${expression}`;
      if (p.correct.includes('(') || !expression.includes('(')) return 'bracket';
      const typed = typedAnswer(p);
      const typedPrompt = p.typed?.prompt;
      if (typed === null || !typedPrompt) return 'typed';
      const asksCoefficient = typedPrompt.includes('vor dem x');
      if (!close(typed, asksCoefficient ? parts.coefficient : parts.constant)) return 'typed answer';
      for (const option of problemOptions(p)) if (equivalent(expression, option) !== false) return `wrong option ${option} is equivalent`;
      const hard = match(/^\d+ − \d+\(x \+ \d+\)$/, expression) !== null || match(/^\d+\(\d+x − \d+\)$/, expression) !== null;
      if (level === 3 && !hard) return `level 3 form ${expression}`;
      if (level < 3 && hard) return 'hard form below level 3';
      if (p.pairFront !== expression) return 'pair front';
      return null;
    });
  });

  it('oneStep', () => {
    check('u04.oneStep', (level, p) => {
      const message = checkEquation(p);
      if (message) return message;
      const equation = lastLine(p.prompt);
      const whole = (text: string): number => Number(dash(text));
      // Each of the four forms solved by trying every whole number.
      let solutions: number[];
      let m: string[] | null;
      if ((m = match(/^x \+ (\d+) = (−?\d+)$/, equation))) {
        const g = m;
        solutions = span(-300, 300).filter((x) => x + whole(g[1]) === whole(g[2]));
      } else if ((m = match(/^x − (\d+) = (−?\d+)$/, equation))) {
        const g = m;
        solutions = span(-300, 300).filter((x) => x - whole(g[1]) === whole(g[2]));
      } else if ((m = match(/^(−?\d+)x = (−?\d+)$/, equation))) {
        const g = m;
        solutions = span(-300, 300).filter((x) => whole(g[1]) * x === whole(g[2]));
      } else if ((m = match(/^x : (\d+) = (−?\d+)$/, equation))) {
        const g = m;
        solutions = span(-300, 300).filter((x) => x % whole(g[1]) === 0 && Math.trunc(x / whole(g[1])) === whole(g[2]));
      } else {
        return `form ${equation}`;
      }
      const right = number(p.correct);
      if (solutions.length !== 1 || right === null || int(right) !== solutions[0]) return `brute force ${solutions}`;
      if (level === 1 && !(equation.startsWith('x + ') || equation.startsWith('x − '))) return 'level 1 adds and subtracts';
      if (level === 1 && right < 1) return 'level 1 has positive solutions';
      return null;
    });
  });

  it('twoStep', () => {
    check('u04.twoStep', (level, p) => {
      const message = checkEquation(p);
      if (message) return message;
      const equation = lastLine(p.prompt);
      const m = match(/^(−?\d*)x (\+|−) (\d+) = (−?\d+)$/, equation);
      if (!m) return `form ${equation}`;
      const a = m[1] === '' ? 1 : m[1] === MINUS ? -1 : Number(dash(m[1]));
      if (!(Math.abs(a) >= 2)) return `factor ${a}`;
      if (level === 1 && a < 0) return 'level 1 positive';
      // Brute force over the whole numbers, no algebra.
      const b = Number(m[3]) * (m[2] === '+' ? 1 : -1);
      const c = Number(dash(m[4]));
      const solutions = span(-60, 60).filter((x) => a * x + b === c);
      const right = number(p.correct);
      if (solutions.length !== 1 || right === null || int(right) !== solutions[0]) return `brute force ${solutions}`;
      return null;
    });
  });

  it('brackets', () => {
    check('u04.brackets', (level, p) => {
      const message = checkEquation(p);
      if (message) return message;
      const equation = lastLine(p.prompt);
      const m = match(/^(\d)\(x (\+|−) (\d)\)(?: (\+|−) (\d+))? = (−?\d+)$/, equation);
      if (!m) return `form ${equation}`;
      const a = Number(m[1]);
      const shift = Number(m[3]) * (m[2] === '+' ? 1 : -1);
      const d = m[4] === '' ? 0 : Number(m[5]) * (m[4] === '+' ? 1 : -1);
      const e = Number(dash(m[6]));
      const solutions = span(-60, 60).filter((x) => a * (x + shift) + d === e);
      const right = number(p.correct);
      if (solutions.length !== 1 || right === null || int(right) !== solutions[0]) return 'brute force';
      if (level < 3 && d !== 0) return 'outside number only at level 3';
      if (level === 3 && d === 0) return 'level 3 has a number outside';
      if (level === 1 && shift < 0) return 'level 1 adds inside';
      return null;
    });
  });

  it('bothSides', () => {
    check('u04.bothSides', (level, p) => {
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
    });
  });

  it('plugIn', () => {
    check('u04.plugIn', (level, p) => {
      const equation = lastLine(p.prompt);
      const x = number(p.correct);
      if (!p.prompt.startsWith('Welche Zahl ist die Lösung der Gleichung? Setze zur Probe ein.\n') || x === null) return 'prompt';
      const sides = equation.split(' = ');
      if (sides.length !== 2 || Expr.holds(equation, x) !== true) return 'the solution does not fit';
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return `wrong option ${option}`;
        if (Expr.holds(equation, value) !== false) return `wrong option ${option} fits`;
      }
      const typedPrompt = p.typed?.prompt;
      const m = typedPrompt ? match(/Die Lösung der Gleichung (.+) ist x = (−?\d+)\.\nWelchen Wert haben beide Seiten/, typedPrompt) : null;
      if (!m) return 'typed prompt';
      if (m[1] !== equation || number(m[2]) !== x) return 'typed equation';
      const both = Expr.evaluate(sides[0], { x })!;
      const typed = typedAnswer(p);
      if (!close(both, Expr.evaluate(sides[1], { x })!) || typed === null || !close(typed, both)) return 'typed answer';
      if (level === 3 && !sides[0].includes('(')) return 'level 3 has a bracket';
      return null;
    });
  });

  it('word', () => {
    check('u04.word', (level, p) => {
      const right = number(p.correct);
      if (right === null) return 'correct';
      const prompt = p.prompt.split('\n').join(' ');
      let truth: number[] = [];
      let m: string[] | null;
      if ((m = match(/^Ich denke mir eine Zahl\. (Ich verdopple sie|Ich multipliziere sie mit (\d+)) und (addiere|subtrahiere) (\d+)\. Das Ergebnis ist (\d+)\./, prompt))) {
        if (level !== 1) return 'puzzle only at level 1';
        const factor = m[1] === 'Ich verdopple sie' ? 2 : Number(m[2]);
        const b = Number(m[4]) * (m[3] === 'addiere' ? 1 : -1);
        const result = Number(m[5]);
        truth = span(0, 300).filter((x) => factor * x + b === result);
      } else if ((m = match(/(\d+) € (?:Grundgebühr|Pauschale|für die Anfahrt) und (\d+) € je .+?(\d+) €/, prompt))) {
        if (level !== 2) return 'tariff only at level 2';
        const [b, a, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
        truth = span(0, 300).filter((x) => b + a * x === c);
      } else if ((m = match(/hat (\d+) € und spart (\d+) € pro Woche\. \w+ hat (\d+) € und spart (\d+) € pro Woche/, prompt))) {
        if (level !== 3) return 'equal amounts only at level 3';
        const [p1, r1, p2, r2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
        truth = span(0, 300).filter((x) => p1 + r1 * x === p2 + r2 * x);
        if (!(r1 - r2 >= 2)) return 'rates too close';
      } else {
        return 'prompt';
      }
      if (truth.length !== 1 || int(right) !== truth[0]) return `brute force ${truth} vs ${p.correct}`;
      const typed = typedAnswer(p);
      if (typed === null || !close(typed, right)) return 'typed';
      for (const option of problemOptions(p)) {
        const value = number(option);
        if (value === null) return 'wrong option';
        if (close(value, right)) return `wrong option ${option} is right`;
      }
      if (right < 2) return 'answer too small for a plural';
      return null;
    });
  });
});
