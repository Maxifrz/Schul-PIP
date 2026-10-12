// Unit 2, Bruchrechnung: addieren und subtrahieren (lesson 1), multiplizieren und dividieren (2), gemischte Rechnungen
// und Sachaufgaben (3). A port of MathMiddleUnit02.swift.

import { type Gen, numberProblem, type Problem, Q, S, template } from './core';
import * as T from './text';

const q = Q.of;

export const templates = [
  template('u02.add', 1, ['choice', 'typed', 'pairs'], add),
  template('u02.subtract', 1, ['choice', 'typed', 'pairs'], subtract),
  template('u02.mixedAddSub', 1, ['choice', 'typed', 'pairs'], mixedAddSub),
  template('u02.multiply', 2, ['choice', 'typed', 'pairs'], multiply),
  template('u02.divide', 2, ['choice', 'typed', 'pairs'], divide),
  template('u02.fitsIn', 2, ['choice', 'typed'], fitsIn),
  template('u02.partOfPart', 2, ['choice', 'typed'], partOfPart),
  template('u02.order', 3, ['choice', 'typed', 'pairs'], order),
  template('u02.word', 3, ['choice', 'typed'], word),
  template('u02.mixedMulDiv', 3, ['choice', 'typed', 'pairs'], mixedMulDiv),
];

const fractionHint = 'Gib das Ergebnis als Bruch an, zum Beispiel 5/6.';

const show = (x: Q): string => T.fraction(x);

// Lesson 1

/** "3/7 + 2/7", "1/2 + 1/3": the denominators first, then the numerators. */
function add(level: number, gen: Gen): Problem | null {
  const [b, d] = denominators(level, gen);
  const first = gen.properFraction([b]);
  const second = gen.properFraction([d]);
  const sum = first.plus(second);
  if (!sum.ok || !(sum.denominator <= 36)) return null;
  const [a, c] = [first.numerator, second.numerator];
  const common = T.lcm(b, d);
  const top = a * T.div(common, b) + c * T.div(common, d);
  let working =
    b === d
      ? `${show(first)} + ${show(second)} = ${top}/${common}`
      : `${show(first)} + ${show(second)} = ${a * T.div(common, b)}/${common} + ${c * T.div(common, d)}/${common} = ${top}/${common}`;
  if (T.gcd(top, common) > 1) working += ` = ${show(sum)}`;
  return numberProblem({
    prompt: `Berechne:\n${show(first)} + ${show(second)}`,
    answer: sum,
    style: S.fraction,
    hint: fractionHint,
    wrong: [q(a + c, b + d), q(a + c, common), q(a + c, b * d), first.times(second), q(a * T.div(common, b) + c, common)],
    pair: `${show(first)} + ${show(second)}`,
    solution: working,
    explanation:
      'Gleiche Nenner: die Zähler addieren. Verschiedene Nenner: erst auf den gemeinsamen Nenner erweitern, dann die Zähler addieren.',
  });
}

/** Two denominators for a sum or difference: equal or one a multiple of the other (level 1), small and different
 * (level 2), up to 12 (level 3). */
function denominators(level: number, gen: Gen): [number, number] {
  switch (level) {
    case 1: {
      if (gen.chance(50)) {
        const b = gen.pick([3, 4, 5, 6, 7, 8, 10]);
        return [b, b];
      }
      const b = gen.pick([2, 3, 4, 5]);
      return [b, b * gen.pick([2, 3])];
    }
    case 2: {
      const b = gen.pick([2, 3, 4, 5, 6]);
      let d = gen.pick([2, 3, 4, 5, 6]);
      if (d === b) d = b === 6 ? 4 : b + 1;
      return [b, d];
    }
    default: {
      const b = gen.pick([3, 4, 5, 6, 8, 9, 10, 12]);
      let d = gen.pick([3, 4, 5, 6, 8, 9, 10, 12]);
      if (d === b) d = b === 12 ? 9 : b + 1;
      return [b, d];
    }
  }
}

/** "5/6 − 1/4": the larger fraction first, so the difference is positive. */
function subtract(level: number, gen: Gen): Problem | null {
  const [b, d] = denominators(level, gen);
  let first = gen.properFraction([b]);
  let second = gen.properFraction([d]);
  if (first.lt(second)) [first, second] = [second, first];
  const difference = first.minus(second);
  if (!difference.ok || difference.isZero || !(difference.denominator <= 36)) return null;
  // After the swap the denominators belong to the other fractions.
  const [fb, sd] = [first.denominator, second.denominator];
  const [a, c] = [first.numerator, second.numerator];
  const common = T.lcm(fb, sd);
  const top = a * T.div(common, fb) - c * T.div(common, sd);
  let working =
    fb === sd
      ? `${show(first)} − ${show(second)} = ${top}/${common}`
      : `${show(first)} − ${show(second)} = ${a * T.div(common, fb)}/${common} − ${c * T.div(common, sd)}/${common} = ${top}/${common}`;
  if (T.gcd(top, common) > 1) working += ` = ${show(difference)}`;
  return numberProblem({
    prompt: `Berechne:\n${show(first)} − ${show(second)}`,
    answer: difference,
    style: S.fraction,
    hint: fractionHint,
    wrong: [q(a - c, fb - sd), q(a - c, common), q(a - c, fb * sd), q(a * T.div(common, fb) - c, common), first.plus(second)].filter(
      (x) => x.ok && !x.isNegative && !x.isZero,
    ),
    pair: `${show(first)} − ${show(second)}`,
    solution: working,
    explanation: 'Wie beim Addieren: erst auf den gemeinsamen Nenner erweitern, dann die Zähler subtrahieren. Der Nenner bleibt.',
  });
}

/** "2 3/4 + 1 1/2": the wholes and the fractions apart, then together. Level 3 subtracts and has to borrow. */
function mixedAddSub(level: number, gen: Gen): Problem | null {
  let d1: number;
  let d2: number;
  switch (level) {
    case 1:
      d1 = gen.pick([3, 4, 5, 6, 8]);
      d2 = d1;
      break;
    case 2:
      d1 = gen.pick([2, 3, 4]);
      d2 = d1 * gen.pick([1, 2]);
      break;
    default:
      d1 = gen.pick([3, 4, 6]);
      d2 = gen.pick([3, 4, 6, 8, 12]);
  }
  const f1 = gen.properFraction([d1]);
  const f2 = gen.properFraction([d2]);
  const w1 = gen.level(level, [1, 4], [2, 6], [3, 9]);
  const w2 = gen.level(level, [1, 3], [1, 5], [1, w1 - 1 > 0 ? w1 - 1 : 1]);
  const first = q(w1).plus(f1);
  const second = q(w2).plus(f2);
  const subtracts = level === 3;
  let result: Q;
  let wrong: Q[] = [];
  if (subtracts) {
    // The borrowing case: the fraction of the first number is smaller than that of the second.
    if (!(f1.lt(f2) && w1 > w2)) return null;
    result = first.minus(second);
    // Smaller from larger in the fractions; borrowing a whole without taking it off; the fractions forgotten.
    wrong = [q(w1 - w2).plus(f2.minus(f1)), q(w1 - w2).plus(q(1)).plus(f1.minus(f2)), q(w1 - w2)];
  } else {
    if (level === 1 && f1.plus(f2).ge(q(1))) return null;
    result = first.plus(second);
    wrong = [
      q(w1 + w2).plus(q(f1.numerator + f2.numerator, d1 + d2)),
      q(w1 + w2),
      q(w1 + w2).plus(q(f1.numerator + f2.numerator, d1)),
    ];
  }
  if (!result.ok || !(result.denominator <= 24)) return null;
  const sign = subtracts ? '−' : '+';
  const expression = `${T.mixed(first)} ${sign} ${T.mixed(second)}`;
  const working = subtracts
    ? `${T.mixed(first)} − ${T.mixed(second)} = ${show(first)} − ${show(second)} = ${T.mixed(result)}`
    : `${T.mixed(first)} + ${T.mixed(second)} = ${w1 + w2} + (${show(f1)} + ${show(f2)}) = ${T.mixed(result)}`;
  return numberProblem({
    prompt: `Berechne:\n${expression}`,
    answer: result,
    style: S.mixed,
    hint: 'Gib das Ergebnis als gemischte Zahl oder Bruch an, zum Beispiel 2 1/4.',
    wrong: wrong.filter((x) => x.ok && !x.isNegative),
    pair: expression,
    solution: working,
    explanation: subtracts
      ? 'Reicht der Bruch der ersten Zahl nicht aus, löst du ein Ganzes in Bruchteile auf. Oder du schreibst beide Zahlen als unechte Brüche.'
      : 'Rechne die Ganzen und die Brüche getrennt. Ist die Summe der Brüche größer als 1, gibt das ein weiteres Ganzes.',
  });
}

// Lesson 2

/** "3 · 2/5", "3/4 · 2/9": numerator times numerator, denominator times denominator. */
function multiply(level: number, gen: Gen): Problem | null {
  let first: Q;
  let second: Q;
  switch (level) {
    case 1:
      if (gen.chance(50)) {
        first = q(gen.int(2, 6));
        second = gen.properFraction([2, 3, 4, 5, 6, 8]);
      } else {
        first = q(1, gen.int(2, 6));
        second = q(1, gen.int(2, 6));
      }
      break;
    case 2:
      first = gen.properFraction([3, 4, 5, 6, 8, 9]);
      second = gen.properFraction([3, 4, 5, 6, 8, 9]);
      break;
    default:
      first = gen.properFraction([6, 7, 8, 9, 10, 12]);
      second = q(gen.int(5, 11), gen.pick([3, 4, 5, 6, 7, 8, 9]));
  }
  const product = first.times(second);
  if (!product.ok || !(product.numerator <= 60) || !(product.denominator <= 60)) return null;
  const [a, b, c, d] = [first.numerator, first.denominator, second.numerator, second.denominator];
  const working = `${show(first)} · ${show(second)} = ${a * c}/${b * d}` + (T.gcd(a * c, b * d) > 1 ? ` = ${show(product)}` : '');
  return numberProblem({
    prompt: `Berechne:\n${show(first)} · ${show(second)}`,
    answer: product,
    style: S.fraction,
    hint: fractionHint,
    wrong: [q(a * c, b + d), first.over(second), first.plus(second), q(a * c, b)].filter((x) => !x.isWhole || product.isWhole),
    pair: `${show(first)} · ${show(second)}`,
    solution: working,
    explanation: 'Zähler mal Zähler und Nenner mal Nenner. Kürzen kannst du schon vor dem Multiplizieren.',
  });
}

/** "3/4 : 3/8": multiply by the reciprocal of the second number. */
function divide(level: number, gen: Gen): Problem | null {
  let first: Q;
  let second: Q;
  switch (level) {
    case 1:
      if (gen.chance(50)) {
        first = gen.properFraction([3, 4, 5, 6, 8]);
        second = q(gen.int(2, 5));
      } else {
        first = q(gen.int(2, 5));
        second = q(1, gen.pick([2, 3, 4, 5]));
      }
      break;
    case 2:
      first = gen.properFraction([3, 4, 5, 6, 8, 9, 10]);
      second = gen.properFraction([3, 4, 5, 6, 8, 9, 10]);
      break;
    default:
      first = q(gen.int(3, 11), gen.pick([4, 5, 6, 8, 9, 10, 12]));
      second = gen.properFraction([4, 5, 6, 8, 9, 10, 12]);
  }
  const quotient = first.over(second);
  if (!quotient.ok || first.eq(second) || !(quotient.numerator <= 24) || !(quotient.denominator <= 24)) return null;
  // The reciprocal of the second number as it is written.
  const flipped = second.reciprocal;
  const working = `${show(first)} : ${show(second)} = ${show(first)} · ${show(flipped)} = ${show(quotient)}`;
  return numberProblem({
    prompt: `Berechne:\n${show(first)} : ${show(second)}`,
    answer: quotient,
    style: S.fraction,
    hint: fractionHint,
    wrong: [first.times(second), second.over(first), first.times(second).reciprocal],
    pair: `${show(first)} : ${show(second)}`,
    solution: working,
    explanation: 'Durch einen Bruch teilst du, indem du mit seinem Kehrwert malnimmst. Nur der zweite Bruch wird umgedreht.',
  });
}

/** "Wie viele Gläser zu 1/4 l füllst du mit 3 l?" A division of an amount by a fraction, in words. */
function fitsIn(level: number, gen: Gen): Problem | null {
  let portion: Q;
  let count: number;
  switch (level) {
    case 1:
      portion = q(1, gen.pick([2, 3, 4, 5, 8]));
      count = gen.int(2, 5) * portion.denominator;
      break;
    case 2:
      portion = gen.properFraction([3, 4, 5, 6, 8]);
      count = gen.int(3, 12);
      break;
    default:
      portion = gen.properFraction([4, 5, 6, 8, 9, 10, 12]);
      count = gen.int(4, 15);
  }
  const total = portion.times(count);
  if (!total.ok || !(total.denominator <= 12) || !(total.double <= 40)) return null;
  let question: string;
  let unit: string;
  switch (gen.int(0, 2)) {
    case 0:
      unit = 'l';
      question = `Aus ${T.amount(total)} l Saft werden Gläser zu ${show(portion)} l gefüllt.\nWie viele Gläser werden voll?`;
      break;
    case 1:
      unit = 'm';
      question = `Ein Band ist ${T.amount(total)} m lang. Daraus werden Stücke zu ${show(portion)} m geschnitten.\nWie viele Stücke sind das?`;
      break;
    default:
      unit = 'kg';
      question = `Ein Sack enthält ${T.amount(total)} kg Mehl. Jede Tüte fasst ${show(portion)} kg.\nWie viele Tüten werden gefüllt?`;
  }
  return numberProblem({
    prompt: question,
    answer: q(count),
    hint: 'Gib nur die Zahl an.',
    wrong: [total.times(portion), portion.over(total), total.times(portion.denominator)],
    solution: `${T.amount(total)} ${unit} : ${show(portion)} ${unit} = ${show(total)} · ${show(portion.reciprocal)} = ${count}`,
    explanation: 'Gefragt ist, wie oft der Bruchteil in die Gesamtmenge passt. Das ist eine Division durch den Bruch.',
  });
}

/** "Lena isst 2/3 von 3/4 einer Torte": "von" means times. */
function partOfPart(level: number, gen: Gen): Problem | null {
  let first: Q;
  let second: Q;
  switch (level) {
    case 1:
      first = q(1, gen.int(2, 5));
      second = q(1, gen.int(2, 5));
      break;
    case 2:
      first = gen.properFraction([3, 4, 5, 6]);
      second = gen.properFraction([3, 4, 5, 6]);
      break;
    default:
      first = gen.properFraction([6, 8, 9, 10, 12]);
      second = gen.properFraction([4, 5, 6, 8, 9]);
  }
  const product = first.times(second);
  if (!product.ok || !(product.denominator <= 60)) return null;
  const [a, b, c, d] = [first.numerator, first.denominator, second.numerator, second.denominator];
  let question: string;
  switch (gen.int(0, 2)) {
    case 0:
      question = `Von einer Torte sind noch ${show(first)} übrig. Lena isst ${show(second)} davon.\nWelcher Bruchteil der ganzen Torte ist das?`;
      break;
    case 1:
      question = `Ein Tank ist zu ${show(first)} gefüllt. Davon werden ${show(second)} verbraucht.\nWelcher Bruchteil des ganzen Tanks ist das?`;
      break;
    default:
      question = `${show(first)} der Klasse sind Mädchen, ${show(second)} davon spielen Fußball.\nWelcher Bruchteil der Klasse ist das?`;
  }
  return numberProblem({
    prompt: question,
    answer: product,
    style: S.fraction,
    hint: fractionHint,
    wrong: [first.plus(second), first.over(second), second.over(first), q(a * c, b + d)].filter((x) => x.ok && !x.isWhole),
    solution:
      `${show(second)} von ${show(first)} = ${show(second)} · ${show(first)} = ${a * c}/${b * d}` +
      (T.gcd(a * c, b * d) > 1 ? ` = ${show(product)}` : ''),
    explanation: '„Davon“ und „von“ bedeuten malnehmen: Ein Bruchteil von einem Bruchteil ist das Produkt der Brüche.',
  });
}

// Lesson 3

/** "1/2 + 1/3 · 3/4": multiplication and division before addition and subtraction, brackets first. */
function order(level: number, gen: Gen): Problem | null {
  const dens = level === 1 ? [2, 3, 4] : [2, 3, 4, 5, 6];
  const a = gen.properFraction(dens);
  const b = gen.properFraction(dens);
  const c = gen.properFraction(dens);
  const kinds: number[] = level === 1 ? [0] : level === 2 ? [0, 1, 2] : [1, 2, 3];
  const kind = gen.pick(kinds);
  let expression: string;
  let result: Q;
  let wrong: Q[];
  switch (kind) {
    case 0:
      expression = `${show(a)} + ${show(b)} · ${show(c)}`;
      result = a.plus(b.times(c));
      wrong = [a.plus(b).times(c), a.plus(b).plus(c), q(a.numerator + b.times(c).numerator, a.denominator + b.times(c).denominator)];
      break;
    case 1:
      expression = `(${show(a)} + ${show(b)}) · ${show(c)}`;
      result = a.plus(b).times(c);
      wrong = [a.plus(b.times(c)), a.plus(b).plus(c), a.times(c).plus(b)];
      break;
    case 2:
      if (!a.gt(b.over(c))) return null;
      expression = `${show(a)} − ${show(b)} : ${show(c)}`;
      result = a.minus(b.over(c));
      wrong = [a.minus(b).over(c), a.minus(b).minus(c), a.minus(b.times(c))].filter((x) => !x.isNegative);
      break;
    default:
      if (!a.gt(b)) return null;
      expression = `(${show(a)} − ${show(b)}) : ${show(c)}`;
      result = a.minus(b).over(c);
      wrong = [a.minus(b.over(c)), a.minus(b.times(c)), a.minus(b).times(c)].filter((x) => !x.isNegative);
  }
  if (!result.ok || result.isNegative || result.isZero || !(result.denominator <= 60) || !(result.numerator <= 60)) return null;
  wrong = wrong.filter((x) => x.ok && !x.isNegative && x.denominator <= 200);
  let rule: string;
  switch (kind) {
    case 0:
      rule = `Punkt vor Strich: erst ${show(b)} · ${show(c)} = ${show(b.times(c))}, dann ${show(a)} + ${show(b.times(c))} = ${show(result)}`;
      break;
    case 1:
      rule = `Klammer zuerst: ${show(a)} + ${show(b)} = ${show(a.plus(b))}, dann ${show(a.plus(b))} · ${show(c)} = ${show(result)}`;
      break;
    case 2:
      rule = `Punkt vor Strich: erst ${show(b)} : ${show(c)} = ${show(b.over(c))}, dann ${show(a)} − ${show(b.over(c))} = ${show(result)}`;
      break;
    default:
      rule = `Klammer zuerst: ${show(a)} − ${show(b)} = ${show(a.minus(b))}, dann ${show(a.minus(b))} : ${show(c)} = ${show(result)}`;
  }
  return numberProblem({
    prompt: `Berechne:\n${expression}`,
    answer: result,
    style: S.fraction,
    hint: fractionHint,
    wrong,
    pair: expression,
    solution: rule,
    explanation: 'Klammern zuerst, dann Punkt vor Strich. Wer einfach von links nach rechts rechnet, kommt hier zu einem falschen Ergebnis.',
  });
}

/** Short stories: what is left, and the share of one portion. */
function word(level: number, gen: Gen): Problem | null {
  if (gen.chance(55)) {
    const dens = level === 1 ? [4, 5, 6, 8, 10] : [3, 4, 5, 6, 8, 10, 12];
    const a = gen.properFraction(dens);
    const b = gen.properFraction(dens);
    const used = a.plus(b);
    if (!used.ok || !used.lt(q(1)) || !(used.denominator <= 60) || !(q(1).minus(used).denominator <= 60)) return null;
    const rest = q(1).minus(used);
    let question: string;
    switch (gen.int(0, 2)) {
      case 0:
        question = `Max liest am Montag ${show(a)} eines Buches und am Dienstag ${show(b)}.\nWelcher Bruchteil des Buches ist noch übrig?`;
        break;
      case 1:
        question = `Lena gibt ${show(a)} ihres Taschengelds fürs Kino und ${show(b)} für Süßigkeiten aus.\nWelcher Bruchteil bleibt übrig?`;
        break;
      default:
        question = `Ein Fass ist voll. Am ersten Tag werden ${show(a)} entnommen, am zweiten ${show(b)}.\nWelcher Bruchteil ist noch im Fass?`;
    }
    return numberProblem({
      prompt: question,
      answer: rest,
      style: S.fraction,
      hint: fractionHint,
      wrong: [used, q(1).minus(a), q(1).minus(b), q(1).minus(q(a.numerator + b.numerator, a.denominator + b.denominator))],
      solution: `${show(a)} + ${show(b)} = ${show(used)}; 1 − ${show(used)} = ${show(rest)}`,
      explanation: 'Zähle zusammen, was verbraucht ist, und ziehe die Summe vom Ganzen (1) ab.',
    });
  }
  const portions = gen.int(2, 6);
  const amount = gen.properFraction(level === 1 ? [2, 3, 4] : [3, 4, 5, 6, 8]);
  const each = amount.over(portions);
  if (!each.ok || !(each.denominator <= 60)) return null;
  const unit = gen.pick(['l', 'kg']);
  const thing = unit === 'l' ? 'Milch' : 'Mehl';
  return numberProblem({
    prompt: `Für ${portions} Portionen braucht man ${show(amount)} ${unit} ${thing}.\nWie viel ${unit === 'l' ? 'Milch' : 'Mehl'} ist das für eine Portion?`,
    answer: each,
    style: S.fractionUnit(unit),
    hint: 'Gib das Ergebnis als Bruch an, ohne Einheit.',
    wrong: [amount.times(portions), q(portions).over(amount), q(1, portions), q(amount.numerator, amount.denominator + portions)],
    solution: `${show(amount)} : ${portions} = ${show(each)} ${unit}`,
    explanation: 'Eine Portion ist ein Teil von mehreren gleichen: Teile die Gesamtmenge durch die Zahl der Portionen.',
  });
}

/** "2 1/2 · 4/5", "1 1/3 : 2/3": mixed numbers become improper fractions first. */
function mixedMulDiv(level: number, gen: Gen): Problem | null {
  const dens = level === 1 ? [2, 3, 4] : [2, 3, 4, 5, 6];
  const whole = gen.level(level, [1, 2], [1, 3], [2, 4]);
  const fraction = gen.properFraction(dens);
  const mixed = q(whole).plus(fraction);
  const other = gen.properFraction(level === 1 ? [2, 3, 4] : [3, 4, 5, 6, 8]);
  const divides = level >= 2 && gen.chance(45);
  const result = divides ? mixed.over(other) : mixed.times(other);
  if (!result.ok || !(result.numerator <= 40) || !(result.denominator <= 40)) return null;
  const sign = divides ? ':' : '·';
  const improper = q(whole * fraction.denominator + fraction.numerator, fraction.denominator);
  // The typical mistakes: the whole times the fraction, whole plus numerator over the denominator, the whole left alone.
  const wholeTimes = q(whole).times(fraction);
  const sum = q(whole + fraction.numerator, fraction.denominator);
  let wrong: Q[];
  if (divides) {
    wrong = [wholeTimes.over(other), sum.over(other), mixed.times(other), q(whole).plus(fraction.over(other))];
  } else {
    wrong = [wholeTimes.times(other), sum.times(other), q(whole).plus(fraction.times(other)), mixed.plus(other)];
  }
  const expression = `${T.mixed(mixed)} ${sign} ${show(other)}`;
  const step = divides ? `${show(improper)} · ${show(other.reciprocal)}` : `${show(improper)} · ${show(other)}`;
  return numberProblem({
    prompt: `Berechne:\n${expression}`,
    answer: result,
    style: S.fraction,
    hint: fractionHint,
    wrong: wrong.filter((x) => x.ok && x.denominator <= 200),
    pair: expression,
    solution: `${T.mixed(mixed)} ${sign} ${show(other)} = ${show(improper)} ${sign} ${show(other)} = ${step} = ${show(result)}`,
    explanation: 'Wandle die gemischte Zahl zuerst in einen unechten Bruch um; dann multiplizierst du oder teilst wie bei gewöhnlichen Brüchen.',
  });
}
