// Unit 1, Brüche verstehen: Bruchteile und gemischte Zahlen (lesson 1), erweitern und kürzen (2), vergleichen und
// ordnen (3). A port of MathMiddleUnit01.swift.

import { type Gen, numberProblem, type Problem, Q, R, S, template, textProblem, type Wrong } from './core';
import * as T from './text';

const q = Q.of;

/** A comparator from a Swift `areInIncreasingOrder` closure (the sort is stable). */
export const byLess =
  <U>(less: (a: U, b: U) => boolean) =>
  (a: U, b: U): number =>
    less(a, b) ? -1 : less(b, a) ? 1 : 0;

export const templates = [
  template('u01.fractionOf', 1, ['choice', 'typed', 'pairs'], fractionOf),
  template('u01.share', 1, ['choice', 'typed', 'pairs'], share),
  template('u01.mixedToImproper', 1, ['choice', 'typed', 'pairs'], mixedToImproper),
  template('u01.improperToMixed', 1, ['choice', 'typed', 'pairs'], improperToMixed),
  template('u01.equivalent', 2, ['choice', 'typed', 'pairs'], equivalent),
  template('u01.reduce', 2, ['choice', 'typed', 'pairs'], reduce),
  template('u01.isReduced', 2, ['choice'], isReduced),
  template('u01.compare', 3, ['choice', 'typed', 'pairs'], compare),
  template('u01.order', 3, ['choice', 'typed'], order),
  template('u01.between', 3, ['choice'], between),
];

// Lesson 1

/** "Berechne 3/8 von 40 €." The unit fraction first, then as many of them as the numerator says. */
function fractionOf(level: number, gen: Gen): Problem | null {
  const denominator = gen.pick(level === 1 ? [3, 4, 5, 10] : level === 2 ? [3, 4, 5, 6, 8, 10, 12] : [6, 7, 8, 9, 11, 12, 15]);
  const numerator = level === 3 ? gen.int(2, denominator - 1) : gen.int(1, Math.min(denominator - 1, level === 1 ? 3 : denominator - 1));
  if (T.gcd(numerator, denominator) !== 1) return null;
  const step = gen.level(level, [2, 5], [3, 12], [4, 15]);
  const whole = denominator * step;
  const result = numerator * step;
  const unit = gen.chance(25) ? '' : gen.pick(['€', 'kg', 'm', 'l', 'cm', 'min']);
  const suffix = unit === '' ? '' : ' ' + unit;
  const fraction = `${numerator}/${denominator}`;
  return numberProblem({
    prompt: `Berechne ${fraction} von ${whole}${suffix}.`,
    answer: q(result),
    style: unit === '' ? S.plain : S.unit(unit),
    hint: 'Gib nur die Zahl an.',
    wrong: [q(step), q(whole * numerator), q(whole * denominator), q(whole - result)],
    pair: `${fraction} von ${whole}${suffix}`,
    solution: `${whole} : ${denominator} = ${step} und ${step} · ${numerator} = ${result}`,
    explanation: 'Teile die Größe durch den Nenner (das ist ein Teil) und multipliziere mit dem Zähler (so viele Teile).',
  });
}

/** "Von 12 Kugeln sind 9 rot. Welcher Bruchteil ist das?" */
function share(level: number, gen: Gen): Problem | null {
  const total = gen.level(level, [4, 10], [8, 20], [12, 36]);
  const part = gen.int(1, total - 1);
  const divisor = T.gcd(part, total);
  if (!(level === 3 ? divisor > 1 : divisor === 1) || part * 2 === total) return null;
  const fraction = q(part, total);
  let question: string;
  switch (gen.int(0, 3)) {
    case 0:
      question = `Eine Urne enthält ${total} Kugeln, ${part} davon sind rot.\nWelcher Bruchteil der Kugeln ist rot?`;
      break;
    case 1:
      question = `In einer Klasse mit ${total} Kindern kommen ${part} mit dem Fahrrad.\nWelcher Bruchteil der Klasse ist das?`;
      break;
    case 2:
      question = `Ein Kuchen ist in ${total} gleich große Stücke geschnitten, ${part} sind gegessen.\nWelcher Bruchteil ist gegessen?`;
      break;
    default:
      question = `Lena hat ${part} von ${total} Aufgaben richtig gelöst.\nWelcher Bruchteil ist richtig?`;
  }
  return numberProblem({
    prompt: question + (level === 3 ? '\nGib den Bruch vollständig gekürzt an.' : ''),
    answer: fraction,
    style: S.fraction,
    hint: 'Gib den Bruch an, zum Beispiel 3/8.',
    wrong: [q(total - part, total), q(total, part), q(part, total - part), q(part, total + part)].filter((x) => !x.isWhole),
    typedPrompt: question,
    pair: `${part} von ${total}`,
    solution: divisor > 1 ? `${part} von ${total} ist ${part}/${total} = ${T.fraction(fraction)}` : `${part} von ${total} ist ${part}/${total}`,
    explanation: 'Der Nenner zählt alle gleichen Teile, der Zähler die Teile, um die es geht.',
  });
}

/** "Schreibe 2 3/5 als unechten Bruch." */
function mixedToImproper(level: number, gen: Gen): Problem | null {
  // A numerator of 1 makes most typical mistakes come out the same, so the numerator is at least 2.
  const denominator = gen.level(level, [3, 5], [3, 9], [5, 12]);
  const numerator = gen.int(2, denominator - 1);
  if (T.gcd(numerator, denominator) !== 1) return null;
  const whole = gen.level(level, [1, 3], [2, 6], [3, 9]);
  const top = whole * denominator + numerator;
  const mixed = `${whole} ${numerator}/${denominator}`;
  return numberProblem({
    prompt: `Schreibe ${mixed} als unechten Bruch.`,
    answer: q(top, denominator),
    style: S.fraction,
    hint: '',
    wrong: [
      q(whole * numerator + denominator, denominator),
      q(top, numerator),
      q(whole + numerator, denominator),
      q(whole * denominator - numerator, denominator),
      q(numerator * denominator + whole, denominator),
    ].filter((x) => !x.isWhole),
    typedPrompt: `Schreibe ${mixed} als unechten Bruch mit dem Nenner ${denominator}.\nWie lautet der Zähler?`,
    typedAnswer: q(top),
    pair: mixed,
    solution: `${mixed} = (${whole} · ${denominator} + ${numerator})/${denominator} = ${top}/${denominator}`,
    explanation: 'Ganze mal Nenner plus Zähler ergibt den neuen Zähler; der Nenner bleibt.',
  });
}

/** "Schreibe 13/5 als gemischte Zahl." */
function improperToMixed(level: number, gen: Gen): Problem | null {
  const denominator = gen.level(level, [2, 5], [3, 9], [5, 12]);
  const numerator = gen.int(1, denominator - 1);
  if (T.gcd(numerator, denominator) !== 1) return null;
  const whole = gen.level(level, [1, 3], [2, 6], [3, 9]);
  const top = whole * denominator + numerator;
  const improper = `${top}/${denominator}`;
  const correct = q(top, denominator);
  const extra: Wrong[] = [
    { text: `${whole + 1} ${numerator}/${denominator}`, value: q(whole + 1).plus(q(numerator, denominator)).value },
    { text: `${whole} ${numerator}/${top}`, value: q(whole).plus(q(numerator, top)).value },
  ];
  if (whole < denominator) {
    extra.push({ text: `${numerator} ${whole}/${denominator}`, value: q(numerator).plus(q(whole, denominator)).value });
  }
  if (whole >= 2) {
    extra.push({ text: `${whole - 1} ${numerator}/${denominator}`, value: q(whole - 1).plus(q(numerator, denominator)).value });
  }
  const askWhole = gen.chance(50);
  return numberProblem({
    prompt: `Schreibe ${improper} als gemischte Zahl.`,
    answer: correct,
    style: S.mixed,
    hint: '',
    wrong: [],
    extraWrong: extra,
    typedPrompt: askWhole
      ? `Wie viele ganze Einheiten stecken in ${improper}?`
      : `Schreibe ${improper} als gemischte Zahl.\nWie lautet der Zähler des Bruchteils?`,
    typedAnswer: q(askWhole ? whole : numerator),
    pair: improper,
    solution: `${top} : ${denominator} = ${whole} Rest ${numerator}, also ${whole} ${numerator}/${denominator}`,
    explanation: 'Teile den Zähler durch den Nenner: Das Ergebnis sind die Ganzen, der Rest ist der neue Zähler.',
  });
}

// Lesson 2

/** "3/4 = ?/20" or "18/24 = 3/?": the same number with the numerator and denominator changed by one factor. */
function equivalent(level: number, gen: Gen): Problem | null {
  const baseDenominator = gen.level(level, [2, 6], [3, 9], [4, 12]);
  const baseNumerator = gen.int(1, baseDenominator - 1);
  if (T.gcd(baseNumerator, baseDenominator) !== 1) return null;
  const factor = gen.level(level, [2, 5], [2, 9], [3, 12]);
  const reduces = level > 1 && gen.chance(40);
  const [a, b] = reduces ? [baseNumerator * factor, baseDenominator * factor] : [baseNumerator, baseDenominator];
  const [c, d] = reduces ? [baseNumerator, baseDenominator] : [baseNumerator * factor, baseDenominator * factor];
  const blankNumerator = gen.chance(50);
  const equation = blankNumerator ? `${a}/${b} = ?/${d}` : `${a}/${b} = ${c}/?`;
  const answer = blankNumerator ? c : d;
  let shifted: number;
  let unchanged: number;
  let copied: number;
  let crossed: number;
  if (blankNumerator) {
    shifted = a + (d - b);
    unchanged = a;
    copied = d;
    crossed = a * d;
  } else {
    shifted = b + (c - a);
    unchanged = b;
    copied = c;
    crossed = b * c;
  }
  const verb = reduces ? 'gekürzt' : 'erweitert';
  return numberProblem({
    prompt: `Welche Zahl gehört auf das Fragezeichen?\n${equation}`,
    answer: q(answer),
    hint: 'Gib nur die fehlende Zahl an.',
    wrong: [q(shifted), q(unchanged), q(copied), q(crossed)].filter((x) => x.numerator > 0),
    typedPrompt: `Welche Zahl gehört auf das Fragezeichen?\n${equation}`,
    pair: equation,
    solution: `Der Bruch wird mit ${factor} ${verb}: ${a}/${b} = ${c}/${d}`,
    explanation:
      'Zähler und Nenner müssen mit derselben Zahl multipliziert (erweitern) oder durch dieselbe Zahl geteilt (kürzen) werden.',
  });
}

/** "Kürze vollständig: 18/24". The typical mistakes: stopping early, subtracting, reducing only one part. */
function reduce(level: number, gen: Gen): Problem | null {
  const denominator = gen.level(level, [3, 6], [4, 9], [5, 12]);
  const numerator = gen.int(1, denominator - 1);
  if (T.gcd(numerator, denominator) !== 1) return null;
  const divisor = gen.level(level, [2, 5], [3, 9], [6, 12]);
  const a = numerator * divisor;
  const b = denominator * divisor;
  const reduced = q(numerator, denominator);
  // Divisors that stop short of the greatest one: the typical "not reduced all the way".
  const stops: number[] = [];
  for (let s = 2; s < divisor; s++) if (divisor % s === 0) stops.push(s);
  const wrong: Wrong[] = [];
  const stop = stops.length === 0 ? null : gen.pick(stops);
  if (stop !== null) {
    wrong.push({ text: `${a / stop}/${b / stop}`, value: reduced.value });
  }
  if (b - divisor > 0 && a - divisor > 0) {
    wrong.push({ text: `${a - divisor}/${b - divisor}`, value: q(a - divisor, b - divisor).value });
  }
  wrong.push({ text: `${numerator}/${b}`, value: q(numerator, b).value });
  wrong.push({ text: `${a}/${denominator}`, value: q(a, denominator).value });
  wrong.push({ text: `${denominator}/${numerator}`, value: q(denominator, numerator).value });
  const problem = textProblem({
    prompt: `Kürze vollständig:\n${a}/${b}`,
    correct: `${numerator}/${denominator}`,
    wrong: [],
    typed: {
      prompt: `Du kürzt ${a}/${b} so weit wie möglich.\nDurch welche Zahl teilst du dafür Zähler und Nenner?\nGib die Zahl an.`,
      answer: R(divisor),
    },
    pair: `${a}/${b}`,
    solution: `ggT(${a}, ${b}) = ${divisor}; ${a} : ${divisor} = ${numerator} und ${b} : ${divisor} = ${denominator}, also ${numerator}/${denominator}`,
    explanation: 'Kürze mit dem größten gemeinsamen Teiler von Zähler und Nenner; dann geht es nicht weiter.',
  });
  problem.correctValue = reduced.value;
  problem.wrong = wrong;
  problem.allowsEquivalentWrong = true;
  problem.pairPrompt = 'Kürze vollständig und ordne zu.';
  return problem;
}

/** "Welcher Bruch lässt sich nicht mehr kürzen?" One fraction is different from the three others. */
function isReduced(level: number, gen: Gen): Problem | null {
  const limit = level === 1 ? 12 : level === 2 ? 20 : 40;
  const asksReducible = gen.chance(35);
  const fraction = (coprime: boolean): [number, number] | null => {
    for (let i = 0; i < 40; i++) {
      const b = gen.int(4, limit);
      const a = gen.int(2, b - 1);
      if ((T.gcd(a, b) === 1) === coprime) return [a, b];
    }
    return null;
  };
  // The odd one out, then three of the other kind.
  const odd = fraction(!asksReducible);
  if (!odd) return null;
  const others: [number, number][] = [];
  const seen = new Set<string>([`${odd[0]}/${odd[1]}`]);
  for (let i = 0; i < 30; i++) {
    if (others.length >= 3) continue;
    const candidate = fraction(asksReducible);
    if (candidate) {
      const key = `${candidate[0]}/${candidate[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        others.push(candidate);
      }
    }
  }
  if (others.length !== 3) return null;
  const oddText = `${odd[0]}/${odd[1]}`;
  const divisor = T.gcd(odd[0], odd[1]);
  const solution = asksReducible
    ? `ggT(${odd[0]}, ${odd[1]}) = ${divisor}, also ${oddText} = ${T.fraction(q(odd[0], odd[1]))}`
    : `ggT(${odd[0]}, ${odd[1]}) = 1, also lässt sich ${oddText} nicht weiter kürzen`;
  return textProblem({
    prompt: asksReducible ? 'Welcher Bruch lässt sich noch kürzen?' : 'Welcher Bruch lässt sich nicht mehr kürzen?',
    correct: oddText,
    wrong: others.map((o) => `${o[0]}/${o[1]}`),
    solution,
    explanation: 'Ein Bruch ist vollständig gekürzt, wenn Zähler und Nenner außer der 1 keinen gemeinsamen Teiler haben.',
  });
}

// Lesson 3

/** "Welcher Bruch ist größer: 5/8 oder 7/12?" */
function compare(level: number, gen: Gen): Problem | null {
  let a: number;
  let b: number;
  let c: number;
  let d: number;
  switch (level) {
    case 1:
      b = gen.int(4, 12);
      d = b;
      a = gen.int(1, b - 1);
      c = gen.int(1, b - 1);
      break;
    case 2:
      b = gen.pick([2, 3, 4, 5, 6]);
      d = b * gen.int(2, 4);
      a = gen.int(1, b - 1);
      c = gen.int(1, d - 1);
      break;
    default:
      b = gen.int(3, 12);
      d = gen.int(3, 12);
      if (b === d || !(T.gcd(b, d) < Math.min(b, d))) return null;
      a = gen.int(1, b - 1);
      c = gen.int(1, d - 1);
  }
  const left = q(a, b);
  const right = q(c, d);
  if (left.eq(right)) return null;
  const common = T.lcm(b, d);
  const leftTop = a * T.div(common, b);
  const rightTop = c * T.div(common, d);
  const leftText = `${a}/${b}`;
  const rightText = `${c}/${d}`;
  const leftIsLarger = left.gt(right);
  const larger = leftIsLarger ? leftText : rightText;
  const smaller = leftIsLarger ? rightText : leftText;
  const problem = textProblem({
    prompt: `Welcher Bruch ist größer?\n${leftText} oder ${rightText}`,
    correct: larger,
    wrong: [smaller, 'Beide sind gleich groß.'],
    typed: {
      prompt: `Bringe ${leftText} und ${rightText} auf den Nenner ${common}.\nWie lautet der größere der beiden Zähler?`,
      answer: R(Math.max(leftTop, rightTop)),
    },
    pair: `${leftText} oder ${rightText}`,
    solution: `Nenner ${common}: ${leftText} = ${leftTop}/${common} und ${rightText} = ${rightTop}/${common}, also ist ${larger} größer`,
    explanation: 'Bring Brüche auf denselben Nenner; dann entscheidet der Zähler, welcher Bruch größer ist.',
  });
  problem.pairPrompt = 'Ordne jedem Paar den größeren Bruch zu.';
  return problem;
}

/** "Ordne der Größe nach, der kleinste zuerst: 3/4, 1/2, 5/6" */
function order(level: number, gen: Gen): Problem | null {
  let fractions: [number, number][] = [];
  switch (level) {
    case 1: {
      // The same numerator: the bigger the denominator, the smaller the fraction.
      const numerator = gen.int(1, 3);
      const denominators = gen.shuffled([4, 5, 6, 8, 10]).slice(0, 3);
      fractions = denominators.map((d) => [numerator, d] as [number, number]);
      break;
    }
    case 2: {
      const family = gen.pick([[2, 4, 8], [3, 6, 12], [5, 10, 20], [2, 4, 6], [4, 8, 16]]);
      fractions = family.map((d) => [gen.int(1, d - 1), d] as [number, number]);
      break;
    }
    default: {
      const family = gen.pick([[3, 4, 6], [4, 5, 10], [6, 8, 12], [3, 5, 15], [4, 6, 12], [2, 3, 5]]);
      fractions = family.map((d) => [gen.int(1, d - 1), d] as [number, number]);
    }
  }
  const values = fractions.map((f) => q(f[0], f[1]));
  if (new Set(values.map((v) => v.key)).size !== 3) return null;
  const ascending = fractions
    .map((element, offset) => ({ element, offset }))
    .sort(byLess((x, y) => values[x.offset].lt(values[y.offset])))
    .map((e) => e.element);
  const join = (list: [number, number][]): string => list.map((f) => `${f[0]}/${f[1]}`).join(' < ');
  const correct = join(ascending);
  // The typical mistakes: judging by the numerator or by the denominator alone, or the order the wrong way round.
  const byNumerator = fractions.slice().sort(byLess((x, y) => x[0] < y[0] || (x[0] === y[0] && x[1] < y[1])));
  const byDenominator = fractions.slice().sort(byLess((x, y) => x[1] < y[1] || (x[1] === y[1] && x[0] < y[0])));
  const byDenominatorDown = fractions.slice().sort(byLess((x, y) => x[1] > y[1] || (x[1] === y[1] && x[0] < y[0])));
  const wrong: string[] = [];
  for (const candidate of [join(byDenominatorDown), join(byNumerator), join(byDenominator), join(ascending.slice().reverse())]) {
    if (candidate !== correct && !wrong.includes(candidate)) wrong.push(candidate);
  }
  // With equal numerators there are fewer typical mistakes; the other orders of the same fractions fill up.
  if (wrong.length < 3) {
    const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const permutation of gen.shuffled(permutations)) {
      if (wrong.length >= 3) continue;
      const candidate = join(permutation.map((i) => fractions[i]));
      if (candidate !== correct && !wrong.includes(candidate)) wrong.push(candidate);
    }
  }
  const shownParts = gen.shuffled(fractions).map((f) => `${f[0]}/${f[1]}`);
  const shown = shownParts.join(', ');
  const common = fractions.map((f) => f[1]).reduce((x, y) => T.lcm(x, y), 1);
  const expanded = ascending.map((f) => `${f[0]}/${f[1]} = ${f[0] * T.div(common, f[1])}/${common}`).join(', ');
  const middle = ascending[1];
  return textProblem({
    prompt: `Ordne der Größe nach, der kleinste zuerst:\n${shown}`,
    correct,
    wrong,
    typed: {
      prompt: `Bringe ${shownParts[0]}, ${shownParts[1]} und ${shownParts[2]} auf den Nenner ${common}.\nWie lautet der mittlere der drei Zähler?`,
      answer: R(middle[0] * T.div(common, middle[1])),
    },
    solution: `Nenner ${common}: ${expanded}. Also ${correct}`,
    explanation: 'Auf denselben Nenner gebracht, ist der Bruch mit dem größeren Zähler der größere.',
  });
}

/** "Welcher Bruch liegt zwischen 1/3 und 1/2?" The right one is in the middle; the wrong ones lie just outside. */
function between(level: number, gen: Gen): Problem | null {
  let lower: Q;
  let upper: Q;
  switch (level) {
    case 1: {
      const d = gen.int(8, 12);
      const a = gen.int(3, d - 5);
      lower = q(a, d);
      upper = q(a + 2, d);
      break;
    }
    case 2: {
      const pairs = [[1, 3, 1, 2], [1, 4, 1, 3], [1, 5, 1, 4], [2, 5, 1, 2], [1, 6, 1, 4], [3, 4, 5, 6], [1, 2, 3, 4], [2, 3, 3, 4]];
      const p = gen.pick(pairs);
      lower = q(p[0], p[1]);
      upper = q(p[2], p[3]);
      break;
    }
    default: {
      const pairs = [[3, 5, 2, 3], [5, 8, 2, 3], [3, 7, 1, 2], [4, 9, 1, 2], [5, 6, 6, 7], [7, 8, 8, 9], [2, 5, 3, 7], [3, 8, 2, 5]];
      const p = gen.pick(pairs);
      lower = q(p[0], p[1]);
      upper = q(p[2], p[3]);
    }
  }
  if (!lower.lt(upper)) return null;
  const middle = lower.plus(upper).over(2);
  const gap = upper.minus(lower);
  const wrong = [lower.minus(gap.over(2)), upper.plus(gap.over(2)), upper.plus(gap), lower.minus(gap)];
  if (!middle.ok || !wrong.every((w) => w.ok && w.value.numerator > 0n)) return null;
  const common = T.lcm(lower.denominator, upper.denominator);
  const step = common * 2;
  const solution =
    `Nenner ${step}: ${T.fraction(lower)} = ${lower.numerator * T.div(step, lower.denominator)}/${step} und ` +
    `${T.fraction(upper)} = ${upper.numerator * T.div(step, upper.denominator)}/${step}; dazwischen liegt ${T.fraction(middle)}`;
  return numberProblem({
    prompt: `Welcher Bruch liegt zwischen ${T.fraction(lower)} und ${T.fraction(upper)}?`,
    answer: middle,
    style: S.fraction,
    hint: '',
    wrong,
    solution,
    explanation: 'Bringe beide Brüche auf einen Nenner; ein Bruch dazwischen hat dort einen Zähler zwischen den beiden Zählern.',
  });
}
