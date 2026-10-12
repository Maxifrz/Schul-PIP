// Unit 3, Dezimalzahlen und Prozent: Brüche, Dezimalzahlen und Prozent ineinander umrechnen (lesson 1), Prozentwert,
// Prozentsatz und Grundwert (2), Zu- und Abnahme (3). A port of MathMiddleUnit03.swift.

import { type Gen, numberProblem, type Problem, Q, S, template } from './core';
import * as T from './text';

const q = Q.of;

export const templates = [
  template('u03.fractionToPercent', 1, ['choice', 'typed', 'pairs'], fractionToPercent),
  template('u03.percentToDecimal', 1, ['choice', 'typed', 'pairs'], percentToDecimal),
  template('u03.decimalCalc', 1, ['choice', 'typed', 'pairs'], decimalCalc),
  template('u03.percentValue', 2, ['choice', 'typed', 'pairs'], percentValue),
  template('u03.percentRate', 2, ['choice', 'typed', 'pairs'], percentRate),
  template('u03.baseValue', 2, ['choice', 'typed'], baseValue),
  template('u03.priceChange', 3, ['choice', 'typed', 'pairs'], priceChange),
  template('u03.percentChange', 3, ['choice', 'typed'], percentChange),
  template('u03.growthFactor', 3, ['choice', 'typed', 'pairs'], growthFactor),
  template('u03.vat', 3, ['choice', 'typed'], vat),
];

function scale(places: number): number {
  let result = 1;
  for (let i = 0; i < places; i++) result *= 10;
  return result;
}

/** Whether the number has at most `places` digits after the decimal comma. */
function fits(x: Q, places: number): boolean {
  return x.ok && scale(places) % x.denominator === 0;
}

/** The digits after the comma a terminating decimal needs. */
function decimalPlaces(x: Q): number {
  let places = 0;
  while (scale(places) % x.denominator !== 0 && places < 9) places += 1;
  return places;
}

const percent = (x: Q): string => T.number(x) + ' %';

/** Two numbers calculated digit by digit with no carry (adding, digits mod 10) or no borrow (subtracting, the smaller
 * digit from the larger). */
function digitwise(a: number, b: number, subtract: boolean): number {
  let x = a;
  let y = b;
  let factor = 1;
  let result = 0;
  while (x > 0 || y > 0) {
    const dx = x % 10;
    const dy = y % 10;
    result += (subtract ? Math.abs(dx - dy) : (dx + dy) % 10) * factor;
    x = T.div(x, 10);
    y = T.div(y, 10);
    factor *= 10;
  }
  return result;
}

/** An amount with its unit; money gets cents. */
function amount(x: Q, unit: string): string {
  return unit === '€' ? T.euroAmount(x) : T.number(x) + ' ' + unit;
}

// Lesson 1

/** "Wie viel Prozent sind 3/4?" or "... 0,35?" */
function fractionToPercent(level: number, gen: Gen): Problem | null {
  let source: Q;
  let isFraction = true;
  switch (level) {
    case 1:
      source = gen.properFraction([2, 4, 5, 10]);
      break;
    case 2:
      if (gen.chance(50)) {
        source = gen.properFraction([4, 5, 20, 25, 50]);
      } else {
        isFraction = false;
        source = q(gen.int(1, 19) * 5, 100);
      }
      break;
    default:
      if (gen.chance(60)) {
        source = gen.properFraction([8, 16, 40, 80]);
      } else {
        isFraction = false;
        source = q(gen.int(1, 79) * 5, 1000);
      }
  }
  const rate = source.times(100);
  if (!rate.ok || !fits(rate, 2) || rate.isZero) return null;
  const text = isFraction ? T.fraction(source) : T.number(source);
  // The mistakes: no times 100, the rest to 100 %, the comma one place off, the digits of the fraction read together.
  const wrong: Q[] = [source, q(100).minus(rate), rate.over(10)];
  if (rate.lt(q(100))) wrong.push(rate.times(10));
  if (isFraction && source.numerator * 10 + source.denominator < 100) wrong.push(q(source.numerator * 10 + source.denominator));
  return numberProblem({
    prompt: `Wie viel Prozent sind ${text}?`,
    answer: rate,
    style: S.percent,
    hint: 'Gib die Prozentzahl ohne %-Zeichen an.',
    wrong: wrong.filter((x) => x.ok && fits(x, 3)),
    pair: text,
    solution: `${text} · 100 % = ${percent(rate)}`,
    explanation: 'Prozent heißt Hundertstel: Rechne den Anteil mal 100, oder erweitere den Bruch auf den Nenner 100.',
  });
}

/** "Schreibe 7 % als Dezimalzahl." */
function percentToDecimal(level: number, gen: Gen): Problem | null {
  let rate: Q;
  switch (level) {
    case 1:
      rate = q(gen.pick([1, 5, 10, 20, 25, 30, 40, 50, 60, 75, 80, 90]));
      break;
    case 2:
      rate = q(gen.pick([2, 3, 7, 8, 12, 15, 35, 45, 65, 95, 105, 110, 125, 150, 200]));
      break;
    default:
      rate = q(gen.pick([5, 15, 25, 35, 45, 75, 125, 375]), 10);
  }
  const value = rate.over(100);
  if (!value.ok || !fits(value, 4)) return null;
  return numberProblem({
    prompt: `Schreibe ${percent(rate)} als Dezimalzahl.`,
    answer: value,
    hint: 'Gib die Dezimalzahl an.',
    wrong: [rate.over(10), rate, rate.over(1000)].filter((x) => x.ok && fits(x, 5)),
    pair: percent(rate),
    solution: `${percent(rate)} = ${T.number(rate)}/100 = ${T.number(value)}`,
    explanation: 'Durch 100 teilen heißt, das Komma um zwei Stellen nach links zu schieben.',
  });
}

type Operation = 'add' | 'subtract' | 'multiply' | 'divide';

/** "2,4 + 1,75", "0,6 · 0,5", "7,5 : 0,25": decimals calculated with the comma in the right place. */
function decimalCalc(level: number, gen: Gen): Problem | null {
  const operations: Operation[] =
    level === 1 ? ['add', 'subtract'] : level === 2 ? ['add', 'subtract', 'multiply', 'multiply'] : ['multiply', 'divide', 'divide', 'subtract'];
  const operation = gen.pick(operations);
  switch (operation) {
    case 'add':
    case 'subtract': {
      // Level 1 has the same number of places; later ones mix one and two places, so the comma has to be placed.
      const digitsA = level === 3 ? gen.int(101, 999) : gen.int(11, 99);
      const digitsB = gen.int(11, 99);
      const placesA = level === 1 ? 1 : level === 3 ? 2 : 1;
      const placesB = level === 1 ? 1 : level === 3 ? 1 : 2;
      let first = q(digitsA, scale(placesA));
      let second = q(digitsB, scale(placesB));
      let firstDigits = digitsA;
      let secondDigits = digitsB;
      let firstPlaces = placesA;
      let secondPlaces = placesB;
      const swapAll = (): void => {
        [first, second] = [second, first];
        [firstDigits, secondDigits] = [secondDigits, firstDigits];
        [firstPlaces, secondPlaces] = [secondPlaces, firstPlaces];
      };
      if (operation === 'subtract' && first.lt(second)) {
        swapAll();
      } else if (operation === 'add' && gen.chance(50)) {
        swapAll();
      }
      const result = operation === 'add' ? first.plus(second) : first.minus(second);
      if (!result.ok || result.isZero || result.isNegative) return null;
      const places = Math.max(firstPlaces, secondPlaces);
      // Both numbers with the same number of places, as integers.
      const scaledFirst = firstDigits * scale(places - firstPlaces);
      const scaledSecond = secondDigits * scale(places - secondPlaces);
      // The digits written under each other from the right, ignoring where the comma is.
      const misaligned = operation === 'add' ? q(firstDigits + secondDigits, scale(places)) : q(firstDigits - secondDigits, scale(places));
      const slipped = q(digitwise(scaledFirst, scaledSecond, operation === 'subtract'), scale(places));
      const symbol = operation === 'add' ? '+' : '−';
      const working = `${T.fixed(first, places)} ${symbol} ${T.fixed(second, places)} = ${T.fixed(result, places)} (Komma unter Komma)`;
      return finish(first, second, symbol, result, [slipped, misaligned, result.plus(1), result.minus(1), result.times(10), result.over(10)], working);
    }
    case 'multiply': {
      let first: Q;
      let second: Q;
      if (level === 2) {
        first = gen.chance(50) ? q(gen.int(2, 9), 10) : q(gen.int(12, 49), 10);
        second = first.denominator === 10 && first.numerator > 9 ? q(gen.int(3, 9)) : q(gen.int(2, 9), 10);
      } else {
        first = q(gen.int(11, 49), 100);
        second = q(gen.int(2, 9), 10);
      }
      const result = first.times(second);
      if (!result.ok || !fits(result, 3) || !(result.double < 100)) return null;
      const [firstPlaces, secondPlaces] = [decimalPlaces(first), decimalPlaces(second)];
      const firstDigits = first.times(q(scale(firstPlaces))).numerator;
      const secondDigits = second.times(q(scale(secondPlaces))).numerator;
      const working = `${firstDigits} · ${secondDigits} = ${firstDigits * secondDigits}; zusammen ${firstPlaces + secondPlaces} Stellen nach dem Komma: ${T.number(result)}`;
      return finish(first, second, '·', result, [first.plus(second), result.times(10), result.over(10), result.times(100), result.over(100)], working);
    }
    case 'divide': {
      const divisor = gen.pick([q(5, 10), q(25, 100), q(2, 10), q(12, 10), q(4, 100), q(6, 100), q(15, 10), q(3, 10), q(25, 10), q(15, 100)]);
      const quotient = q(gen.int(2, 30), gen.pick([1, 1, 2]));
      const dividend = divisor.times(quotient);
      if (!dividend.ok || !fits(dividend, 3) || !(dividend.double <= 100)) return null;
      const shift = decimalPlaces(divisor);
      const working = `${T.number(dividend)} : ${T.number(divisor)} = ${T.number(dividend.times(q(scale(shift))))} : ${T.number(divisor.times(q(scale(shift))))} = ${T.number(quotient)} (beide Kommas um ${shift} Stellen verschoben)`;
      return finish(dividend, divisor, ':', quotient, [dividend.minus(divisor), quotient.times(10), quotient.over(10), quotient.over(100), quotient.times(100)], working);
    }
  }
}

function finish(first: Q, second: Q, symbol: string, result: Q, wrong: Q[], working: string): Problem | null {
  const expression = `${T.number(first)} ${symbol} ${T.number(second)}`;
  return numberProblem({
    prompt: `Berechne:\n${expression}`,
    answer: result,
    hint: 'Gib das Ergebnis als Dezimalzahl an.',
    wrong: wrong.filter((x) => x.ok && !x.isNegative && fits(x, 6)),
    pair: expression,
    solution: working,
    explanation:
      'Beim Addieren und Subtrahieren steht Komma unter Komma. Beim Multiplizieren zählst du die Nachkommastellen, beim Dividieren verschiebst du beide Kommas gleich weit.',
  });
}

// Lesson 2

const units = ['€', 'kg', 'm', 'l'];

/** "Wie viel sind 15 % von 80 €?" */
function percentValue(level: number, gen: Gen): Problem | null {
  const rate = q(level === 1 ? gen.pick([5, 10, 20, 25, 50, 75]) : level === 2 ? gen.pick([2, 8, 12, 15, 30, 35, 40, 60, 65, 90]) : gen.int(1, 99));
  const base = q(level === 1 ? gen.pick([20, 40, 60, 80, 100, 120, 200]) : gen.pick([40, 60, 80, 120, 150, 200, 250, 300, 400, 500, 600]));
  const value = base.times(rate).over(100);
  if (!value.ok || !fits(value, level === 1 ? 0 : level === 2 ? 1 : 2) || value.isZero) return null;
  const unit = gen.pick(units);
  const baseText = amount(base, unit);
  const question = gen.chance(50) ? `Wie viel sind ${percent(rate)} von ${baseText}?` : `Berechne ${percent(rate)} von ${baseText}.`;
  return numberProblem({
    prompt: question,
    answer: value,
    style: unit === '€' ? S.euro : S.unit(unit),
    hint: 'Gib nur die Zahl an.',
    wrong: [rate.times(base).over(10), value.over(10), base.minus(value), base.over(rate)].filter((x) => x.ok && fits(x, 3)),
    pair: `${percent(rate)} von ${baseText}`,
    solution: `${T.number(base)} · ${T.number(rate.over(100))} = ${amount(value, unit)}`,
    explanation: 'Der Prozentwert ist der Grundwert mal Prozentsatz: W = G · p/100. 10 % sind ein Zehntel, 1 % ein Hundertstel.',
  });
}

/** "Wie viel Prozent sind 12 von 80?" */
function percentRate(level: number, gen: Gen): Problem | null {
  let base: number;
  let part: number;
  switch (level) {
    case 1:
      base = gen.pick([20, 40, 50, 80, 100, 200]);
      part = T.div(base * gen.pick([10, 20, 25, 50, 75]), 100);
      break;
    case 2:
      base = gen.pick([40, 50, 60, 80, 120, 150, 200, 250, 400]);
      part = gen.int(1, base - 1);
      break;
    default:
      base = gen.pick([40, 80, 120, 160, 200, 400, 800]);
      part = gen.int(1, base - 1);
  }
  const rate = q(part * 100, base);
  if (!rate.ok || !fits(rate, level === 3 ? 1 : 0) || !(part > 0) || !(part < base)) return null;
  let question: string;
  switch (gen.int(0, 2)) {
    case 0:
      question = `Wie viel Prozent sind ${part} von ${base}?`;
      break;
    case 1:
      question = `Von ${base} Schülern fehlen ${part}.\nWie viel Prozent fehlen?`;
      break;
    default:
      question = `Lena erreicht ${part} von ${base} Punkten.\nWie viel Prozent sind das?`;
  }
  return numberProblem({
    prompt: question,
    answer: rate,
    style: S.percent,
    hint: 'Gib die Prozentzahl ohne %-Zeichen an.',
    wrong: [q(part, base), q(100).minus(rate), rate.times(10), rate.over(10)].filter((x) => x.ok && fits(x, 4)),
    pair: `${part} von ${base}`,
    solution: `${part} : ${base} = ${T.number(q(part, base))} = ${percent(rate)}`,
    explanation: 'Der Prozentsatz ist der Anteil Prozentwert : Grundwert, mal 100: p = W : G · 100.',
  });
}

/** "15 % sind 12 €. Wie groß ist der Grundwert?" */
function baseValue(level: number, gen: Gen): Problem | null {
  const rate = q(level === 1 ? gen.pick([10, 20, 25, 50]) : level === 2 ? gen.pick([5, 15, 30, 40, 60, 75]) : gen.pick([8, 12, 35, 45, 65, 16, 24]));
  const base = q(level === 1 ? gen.pick([40, 60, 80, 100, 200]) : gen.pick([40, 60, 80, 120, 150, 200, 250, 400, 500]));
  const part = base.times(rate).over(100);
  if (!part.ok || !fits(part, 2) || part.isZero) return null;
  const kind = gen.int(0, 2);
  const unit = kind === 1 ? '€' : gen.pick(units);
  const partText = amount(part, unit);
  let question: string;
  switch (kind) {
    case 0:
      question = `${percent(rate)} einer Menge sind ${partText}.\nWie groß ist die ganze Menge?`;
      break;
    case 1:
      question = `Bei ${percent(rate)} Rabatt spart Tom ${partText}.\nWie teuer war der Artikel vorher?`;
      break;
    default:
      question = `${partText} sind ${percent(rate)} des Grundwerts.\nWie groß ist der Grundwert?`;
  }
  return numberProblem({
    prompt: question,
    answer: base,
    style: unit === '€' ? S.euro : S.unit(unit),
    hint: 'Gib nur die Zahl an.',
    wrong: [part.times(rate).over(100), part.plus(rate), part.times(rate), part.over(rate)].filter((x) => x.ok && fits(x, 4)),
    solution: `1 % sind ${T.number(part.over(rate))}, also 100 % = ${T.number(part.over(rate))} · 100 = ${amount(base, unit)}`,
    explanation: 'Rechne erst auf 1 % (Prozentwert : Prozentsatz), dann auf 100 %. Der Grundwert ist das Ganze.',
  });
}

// Lesson 3

/** "Das Fahrrad kostet 240 €. Der Preis steigt um 15 %." */
function priceChange(level: number, gen: Gen): Problem | null {
  const rate = q(level === 1 ? gen.pick([10, 20, 25, 50]) : level === 2 ? gen.pick([5, 15, 30, 40, 12, 8]) : gen.pick([3, 7, 12, 18, 35, 45, 6]));
  const base = q(level === 1 ? gen.pick([40, 60, 80, 100, 120, 200]) : gen.pick([40, 60, 80, 120, 150, 200, 250, 300, 400, 500]));
  const rises = gen.chance(50);
  const change = base.times(rate).over(100);
  const result = rises ? base.plus(change) : base.minus(change);
  if (!result.ok || !fits(result, 2) || !fits(change, 2)) return null;
  const [article, noun, pronoun] = gen.pick([['Das', 'Fahrrad', 'es'], ['Der', 'Rucksack', 'er'], ['Der', 'Mantel', 'er'], ['Der', 'Tisch', 'er'], ['Das', 'Handy', 'es']]);
  const baseText = T.euroAmount(base);
  const question = rises
    ? `${article} ${noun} kostet ${baseText}. Der Preis steigt um ${percent(rate)}.\nWie viel kostet ${pronoun} danach?`
    : `${article} ${noun} kostet ${baseText}. Es gibt ${percent(rate)} Rabatt.\nWie viel kostet ${pronoun} danach?`;
  const absolute = rises ? base.plus(rate) : base.minus(rate);
  const opposite = rises ? base.minus(change) : base.plus(change);
  const sign = rises ? '+' : '−';
  return numberProblem({
    prompt: question,
    answer: result,
    style: S.euro,
    hint: 'Gib den Preis in Euro an, ohne €.',
    wrong: [change, absolute, opposite],
    pair: `${baseText} ${sign} ${percent(rate)}`,
    solution: `${percent(rate)} von ${baseText} = ${T.euroAmount(change)}; ${baseText} ${sign} ${T.euroAmount(change)} = ${T.euroAmount(result)}`,
    explanation: rises
      ? 'Bei einer Zunahme rechnest du Grundwert plus Prozentwert, oder den Grundwert mal (1 + p/100).'
      : 'Bei einer Abnahme rechnest du Grundwert minus Prozentwert, oder den Grundwert mal (1 − p/100).',
  });
}

/** "Der Preis steigt von 50 € auf 60 €. Um wie viel Prozent?" */
function percentChange(level: number, gen: Gen): Problem | null {
  const rate = q(level === 1 ? gen.pick([10, 20, 25, 50]) : level === 2 ? gen.pick([5, 15, 30, 40, 60]) : gen.pick([12, 35, 45, 8, 16, 24, 36]));
  const old = q(level === 1 ? gen.pick([40, 50, 80, 100, 200]) : gen.pick([50, 60, 80, 100, 120, 150, 200, 250, 400]));
  const rises = gen.chance(55);
  const change = old.times(rate).over(100);
  const newValue = rises ? old.plus(change) : old.minus(change);
  if (!newValue.ok || !newValue.isWhole || !change.isWhole || rate.isZero) return null;
  const thing = gen.pick(['Preis', 'Eintritt', 'Monatsbeitrag']);
  const verb = rises ? 'steigt' : 'sinkt';
  const word = rises ? 'Zunahme' : 'Abnahme';
  // The new value taken as 100 % gives a different percentage.
  const wrongBase = change.over(newValue).times(100);
  return numberProblem({
    prompt: `Der ${thing} ${verb} von ${T.euroAmount(old)} auf ${T.euroAmount(newValue)}.\nUm wie viel Prozent ${verb} er?`,
    answer: rate,
    style: S.percent,
    hint: 'Gib die Prozentzahl ohne %-Zeichen an.',
    wrong: [change, newValue.over(old).times(100), rate.over(10), wrongBase].filter((x) => x.ok && fits(x, 2)),
    solution: `${word} um ${T.euroAmount(change)}; ${T.number(change)} : ${T.number(old)} = ${T.number(change.over(old))} = ${percent(rate)}`,
    explanation: 'Vergleiche die Änderung mit dem alten Wert, nicht mit dem neuen: p = Änderung : alter Wert · 100.',
  });
}

/** "Ein Wert steigt um 8 %. Mit welchem Faktor multiplizierst du?" */
function growthFactor(level: number, gen: Gen): Problem | null {
  let rate: Q;
  switch (level) {
    case 1:
      rate = q(gen.pick([10, 20, 50, 5, 25]));
      break;
    case 2:
      rate = q(gen.pick([8, 12, 15, 30, 40, 4, 6]));
      break;
    default:
      rate = gen.pick([q(5, 2), q(15, 2), q(1, 2), q(3), q(7), q(18), q(125, 10), q(75, 10)]);
  }
  const rises = gen.chance(50);
  const factor = rises ? q(1).plus(rate.over(100)) : q(1).minus(rate.over(100));
  if (!factor.ok || !fits(factor, 4) || factor.isNegative || factor.isZero) return null;
  const opposite = rises ? q(1).minus(rate.over(100)) : q(1).plus(rate.over(100));
  const verb = rises ? 'steigt' : 'sinkt';
  const word = rises ? 'Zunahme' : 'Abnahme';
  const sign = rises ? '+' : '−';
  const problem = numberProblem({
    prompt: `Ein Wert ${verb} um ${percent(rate)}.\nMit welchem Faktor multiplizierst du ihn?`,
    answer: factor,
    hint: 'Gib den Faktor als Dezimalzahl an.',
    wrong: [rate.over(100), opposite, rises ? q(1).plus(rate.over(10)) : q(1).minus(rate.over(10)), rate].filter((x) => x.ok && !x.isNegative),
    pair: `${word} um ${percent(rate)}`,
    solution: `1 ${sign} ${percent(rate)} = 1 ${sign} ${T.number(rate.over(100))} = ${T.number(factor)}`,
    explanation: `Der neue Wert ist 100 % plus oder minus die Änderung: Der Faktor ist 1 ${sign} p/100.`,
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Änderung den Faktor zu.';
  return problem;
}

/** "Netto 200 €, Mehrwertsteuer 19 %": forwards at levels 1 and 2, backwards at level 3. */
function vat(level: number, gen: Gen): Problem | null {
  const rate = q(gen.pick([19, 19, 7]));
  const net = q(
    level === 1 ? gen.pick([100, 200, 300, 400, 500]) : level === 2 ? gen.pick([50, 150, 250, 20, 40, 60, 80, 120]) : gen.pick([100, 200, 300, 400, 500, 600, 800]),
  );
  const factor = q(1).plus(rate.over(100));
  const gross = net.times(factor);
  if (!gross.ok || !fits(gross, 2)) return null;
  if (level === 3) {
    if (!(gross.double < 1000)) return null;
    return numberProblem({
      prompt: `Ein Gerät kostet brutto ${T.euroAmount(gross)}, darin sind ${percent(rate)} Mehrwertsteuer.\nWie hoch ist der Nettopreis?`,
      answer: net,
      style: S.euro,
      hint: 'Gib den Preis in Euro an, ohne €.',
      wrong: [gross.times(q(1).minus(rate.over(100))), gross.minus(rate), gross.times(rate).over(100)],
      solution: `Brutto sind ${T.number(q(100).plus(rate))} % des Nettopreises: ${T.number(gross)} : ${T.number(factor)} = ${T.number(net)} €`,
      explanation:
        'Der Bruttopreis ist 100 % plus Steuersatz. Teile ihn durch den Faktor, zum Beispiel 1,19. Die Steuer vom Bruttopreis abzuziehen ist falsch.',
    });
  }
  const tax = net.times(rate).over(100);
  return numberProblem({
    prompt: `Ein Gerät kostet netto ${T.euroAmount(net)}. Dazu kommen ${percent(rate)} Mehrwertsteuer.\nWie hoch ist der Bruttopreis?`,
    answer: gross,
    style: S.euro,
    hint: 'Gib den Preis in Euro an, ohne €.',
    wrong: [tax, net.plus(rate), net.times(q(1).minus(rate.over(100))), net.times(rate)].filter((x) => x.ok && x.double < 10000),
    solution: `Steuer: ${T.euroAmount(tax)}; ${T.euroAmount(net)} + ${T.euroAmount(tax)} = ${T.euroAmount(gross)}`,
    explanation: 'Brutto ist Netto plus Mehrwertsteuer, also Netto mal (1 + Steuersatz), zum Beispiel mal 1,19.',
  });
}
