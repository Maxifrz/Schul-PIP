// Unit 8, Geometrie: Umfang und Fläche ebener Figuren und des Kreises (lesson 1), Quader, Zylinder, Prisma und
// Einheiten (2), Winkelsumme und Satz des Pythagoras (3). A port of MathMiddleUnit08.swift.

import { decimals, type Gen, numberProblem, type Problem, positives, Q, R, S, template, textProblem } from './core';
import * as T from './text';

const q = Q.of;

export const templates = [
  template('u08.rectangle', 1, ['choice', 'typed', 'pairs'], rectangle),
  template('u08.area', 1, ['choice', 'typed', 'pairs'], area),
  template('u08.circle', 1, ['choice', 'typed', 'pairs'], circle),
  template('u08.cuboid', 2, ['choice', 'typed', 'pairs'], cuboid),
  template('u08.solid', 2, ['choice', 'typed', 'pairs'], solid),
  template('u08.units', 2, ['choice', 'typed', 'pairs'], units),
  template('u08.volumeWord', 2, ['choice', 'typed'], volumeWord),
  template('u08.angles', 3, ['choice', 'typed', 'pairs'], angles),
  template('u08.pythagoras', 3, ['choice', 'typed', 'pairs'], pythagoras),
  template('u08.pythagorasWord', 3, ['choice', 'typed'], pythagorasWord),
  template('u08.rightAngleTest', 3, ['choice', 'typed'], rightAngleTest),
];

const valueHint = 'Gib nur die Zahl an.';
const piHint = 'Gib nur die Zahl vor π an.';

const num = (x: Q): string => T.number(x);

// Lesson 1

/** "Ein Rechteck ist 8 cm lang und 5 cm breit. Berechne den Umfang." Perimeter, area, and the missing side. */
function rectangle(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => rectangleAttempt(level, gen));
}

function rectangleAttempt(level: number, gen: Gen): Problem | null {
  const unit = gen.pick(['cm', 'm']);
  const square = level === 1 && gen.chance(30);
  let a: Q;
  let b: Q;
  switch (level) {
    case 1:
      a = q(gen.int(2, 12));
      b = square ? a : q(gen.int(2, 12));
      break;
    case 2:
      a = q(gen.int(3, 19), 2);
      b = q(gen.int(2, 12));
      break;
    default:
      a = q(gen.int(3, 16));
      b = q(gen.int(2, 12));
  }
  if (!(square || !a.eq(b))) return null;
  const perimeter = a.plus(b).times(2);
  const areaValue = a.times(b);
  if (!perimeter.ok || !areaValue.ok || decimals([areaValue, perimeter], 1).length !== 2) return null;
  const shape = square ? `Ein Quadrat hat die Seitenlänge ${num(a)} ${unit}.` : `Ein Rechteck ist ${num(a)} ${unit} lang und ${num(b)} ${unit} breit.`;
  if (level === 3) {
    // Backwards: the missing side from the perimeter or the area.
    if (gen.chance(50)) {
      const wrong = positives(decimals([perimeter.minus(a), perimeter.over(2).plus(a), perimeter.minus(a.times(2)), perimeter], 1));
      return numberProblem({
        prompt: `Ein Rechteck hat den Umfang ${num(perimeter)} ${unit} und ist ${num(a)} ${unit} lang.\nWie breit ist es?`,
        answer: b,
        style: S.unit(unit),
        hint: valueHint,
        wrong,
        pair: `U = ${num(perimeter)} ${unit}, a = ${num(a)} ${unit}`,
        solution: `${num(perimeter)} : 2 = ${num(perimeter.over(2))}; ${num(perimeter.over(2))} ${T.minus} ${num(a)} = ${num(b)} ${unit}`,
        explanation: 'Der Umfang ist 2 · (a + b). Teile ihn durch 2, dann ziehst du die bekannte Seite ab.',
      });
    }
    const wrong = positives(decimals([areaValue.minus(a), areaValue.times(a), perimeter.over(2).minus(a), areaValue.over(2)], 1));
    return numberProblem({
      prompt: `Ein Rechteck hat die Fläche ${num(areaValue)} ${unit}² und ist ${num(a)} ${unit} lang.\nWie breit ist es?`,
      answer: b,
      style: S.unit(unit),
      hint: valueHint,
      wrong,
      pair: `A = ${num(areaValue)} ${unit}², a = ${num(a)} ${unit}`,
      solution: `A = a · b, also b = ${num(areaValue)} : ${num(a)} = ${num(b)} ${unit}`,
      explanation: 'Die Fläche ist Länge mal Breite. Die fehlende Seite findest du durch Teilen der Fläche durch die bekannte Seite.',
    });
  }
  const asksPerimeter = gen.chance(50);
  const value = asksPerimeter ? perimeter : areaValue;
  const wrong = positives(
    decimals(asksPerimeter ? [areaValue, a.plus(b), a.times(2).plus(b), areaValue.times(2)] : [perimeter, a.plus(b), a.times(2).times(b), perimeter.over(2)], 1),
  );
  return numberProblem({
    prompt: `${shape}\n` + (asksPerimeter ? 'Berechne den Umfang.' : 'Berechne den Flächeninhalt.'),
    answer: value,
    style: S.unit(asksPerimeter ? unit : unit + '²'),
    hint: valueHint,
    wrong,
    pair: (asksPerimeter ? 'Umfang: ' : 'Fläche: ') + (square ? `a = ${num(a)} ${unit}` : `${num(a)} ${unit} · ${num(b)} ${unit}`),
    solution: asksPerimeter
      ? `U = 2 · (${num(a)} + ${num(b)}) = ${num(perimeter)} ${unit}`
      : `A = ${num(a)} · ${num(b)} = ${num(areaValue)} ${unit}²`,
    explanation: asksPerimeter
      ? 'Der Umfang ist die Länge des Randes: Alle vier Seiten zusammen, also 2 · (a + b).'
      : 'Der Flächeninhalt ist Länge mal Breite. Er hat die Einheit mit Quadrat, zum Beispiel cm².',
  });
}

/** Triangle, parallelogram and trapezoid: the base times the height, halved where it has to be. */
function area(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => areaAttempt(level, gen));
}

function areaAttempt(level: number, gen: Gen): Problem | null {
  const unit = gen.pick(['cm', 'm']);
  const kind = level === 1 ? gen.int(0, 1) : gen.int(0, 2);
  switch (kind) {
    case 0: {
      // Triangle.
      const g = level === 1 ? gen.int(3, 14) : gen.int(5, 20);
      const h = level === 1 ? gen.int(2, 12) : gen.int(4, 16);
      if ((g * h) % 2 !== 0 || g === h) return null;
      const value = q(g * h, 2);
      if (level === 3 && gen.chance(60)) {
        // The doubling forgotten, the area itself, the area doubled and not divided by the base, the height doubled.
        const wrong = positives(decimals([value.over(g), value, q(g * h), q(h * 2)], 1));
        return numberProblem({
          prompt: `Ein Dreieck hat die Grundseite ${g} ${unit} und die Fläche ${num(value)} ${unit}².\nWie hoch ist das Dreieck?`,
          answer: q(h),
          style: S.unit(unit),
          hint: valueHint,
          wrong,
          pair: `Dreieck: g = ${g} ${unit}, A = ${num(value)} ${unit}²`,
          solution: `A = g · h : 2, also h = 2 · ${num(value)} : ${g} = ${h} ${unit}`,
          explanation: 'Stelle die Formel A = g · h : 2 nach h um: Verdopple die Fläche und teile durch die Grundseite.',
        });
      }
      return numberProblem({
        prompt: `Ein Dreieck hat die Grundseite ${g} ${unit} und die Höhe ${h} ${unit}.\nWie groß ist die Fläche?`,
        answer: value,
        style: S.unit(unit + '²'),
        hint: valueHint,
        wrong: positives(decimals([q(g * h), q(g + h), q(g * h, 4), q(g * h * 2)], 1)),
        pair: `Dreieck: g = ${g} ${unit}, h = ${h} ${unit}`,
        solution: `A = g · h : 2 = ${g} · ${h} : 2 = ${num(value)} ${unit}²`,
        explanation: 'Ein Dreieck ist halb so groß wie das Rechteck mit derselben Grundseite und Höhe: A = g · h : 2.',
      });
    }
    case 1: {
      // Parallelogram: the height, not the slanted side.
      const g = gen.int(3, 16);
      const h = gen.int(2, 12);
      const slanted = h + gen.int(1, 4);
      if (g === h) return null;
      return numberProblem({
        prompt: `Ein Parallelogramm hat die Grundseite ${g} ${unit}, die Höhe ${h} ${unit} und die schräge Seite ${slanted} ${unit}.\nWie groß ist die Fläche?`,
        answer: q(g * h),
        style: S.unit(unit + '²'),
        hint: valueHint,
        wrong: positives(decimals([q(g * slanted), q(g * h, 2), q(g + h), q(2 * (g + slanted))], 1)),
        pair: `Parallelogramm: g = ${g} ${unit}, h = ${h} ${unit}`,
        solution: `A = g · h = ${g} · ${h} = ${g * h} ${unit}². Die schräge Seite wird nicht gebraucht.`,
        explanation: 'Beim Parallelogramm gilt A = g · h. Wichtig ist die Höhe (senkrecht zur Grundseite), nicht die schräge Seite.',
      });
    }
    default: {
      // Trapezoid: the mean of the parallel sides times the height.
      const a = level === 2 ? gen.int(4, 14) : gen.int(6, 20);
      const c = gen.int(2, a - 1);
      const h = gen.int(2, 12);
      if (((a + c) * h) % 2 !== 0) return null;
      const value = q((a + c) * h, 2);
      return numberProblem({
        prompt: `Ein Trapez hat die parallelen Seiten ${a} ${unit} und ${c} ${unit} und die Höhe ${h} ${unit}.\nWie groß ist die Fläche?`,
        answer: value,
        style: S.unit(unit + '²'),
        hint: valueHint,
        wrong: positives(decimals([q((a + c) * h), q(a * h, 2), q(a * c * h, 2), q(a + c + h)], 1)),
        pair: `Trapez: a = ${a} ${unit}, c = ${c} ${unit}, h = ${h} ${unit}`,
        solution: `A = (a + c) : 2 · h = (${a} + ${c}) : 2 · ${h} = ${num(value)} ${unit}²`,
        explanation: 'Beim Trapez nimmst du den Mittelwert der beiden parallelen Seiten mal die Höhe: A = (a + c) : 2 · h.',
      });
    }
  }
}

/** Circle: the area and the circumference as a multiple of π. */
function circle(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => circleAttempt(level, gen));
}

function circleAttempt(level: number, gen: Gen): Problem | null {
  const r = level === 1 ? gen.int(2, 9) : gen.int(3, 15);
  const unit = gen.pick(['cm', 'm']);
  if (level === 3 && gen.chance(60)) {
    // Backwards from the circumference or the area.
    if (gen.chance(50)) {
      const wrong = positives([q(r * 2), q(r * r), q(r, 2), q(r * 4)]);
      return numberProblem({
        prompt: `Der Umfang eines Kreises ist ${2 * r}π ${unit}.\nWie groß ist der Radius?`,
        answer: q(r),
        style: S.unit(unit),
        hint: valueHint,
        wrong,
        pair: `U = ${2 * r}π ${unit}`,
        solution: `U = 2πr, also ${2 * r}π = 2πr und r = ${r} ${unit}`,
        explanation: 'Der Umfang ist U = 2πr. Teilst du den Umfang durch 2π, bleibt der Radius.',
      });
    }
    const wrong = positives([q(r * r), q(r, 2), q(r * r, 2), q(2 * r)]);
    return numberProblem({
      prompt: `Die Fläche eines Kreises ist ${r * r}π ${unit}².\nWie groß ist der Radius?`,
      answer: q(r),
      style: S.unit(unit),
      hint: valueHint,
      wrong,
      pair: `A = ${r * r}π ${unit}²`,
      solution: `A = πr², also r² = ${r * r} und r = ${r} ${unit}`,
      explanation: 'Die Fläche ist A = πr². Nach dem Teilen durch π bleibt r², und die Wurzel daraus ist der Radius.',
    });
  }
  const withDiameter = level >= 2 && gen.chance(50);
  const givenText = withDiameter ? `den Durchmesser ${2 * r} ${unit}` : `den Radius ${r} ${unit}`;
  const asksArea = gen.chance(50);
  const answer = asksArea ? r * r : 2 * r;
  // Area and circumference mixed up, the diameter used as the radius, the radius not squared.
  const wrong = asksArea
    ? [2 * r, r, 4 * r * r, r * r * 2, r * 2 * r * 2].map((v) => q(v))
    : [r * r, r, 4 * r * r, 4 * r, 2 * r * r].map((v) => q(v));
  return numberProblem({
    prompt: `Ein Kreis hat ${givenText}.\nBerechne ` + (asksArea ? 'die Fläche' : 'den Umfang') + ` in ${unit}` + (asksArea ? '²' : '') + '. Gib das Ergebnis als Vielfaches von π an.',
    answer: q(answer),
    style: S.pi,
    hint: piHint,
    wrong,
    pair: (asksArea ? 'Fläche: ' : 'Umfang: ') + (withDiameter ? `d = ${2 * r} ${unit}` : `r = ${r} ${unit}`),
    solution: asksArea ? `r = ${r} ${unit}; A = π · ${r}² = ${r * r}π ${unit}²` : `r = ${r} ${unit}; U = 2 · π · ${r} = ${2 * r}π ${unit}`,
    explanation: asksArea
      ? 'Die Fläche ist A = π · r². Der Radius ist der halbe Durchmesser, und nur der Radius wird quadriert.'
      : 'Der Umfang ist U = 2 · π · r. Der Radius ist der halbe Durchmesser.',
  });
}

// Lesson 2

/** Volume and surface of a cuboid, and a missing edge. */
function cuboid(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => cuboidAttempt(level, gen));
}

function cuboidAttempt(level: number, gen: Gen): Problem | null {
  const a = level === 1 ? gen.int(2, 8) : gen.int(3, 12);
  const b = level === 1 ? gen.int(2, 8) : gen.int(3, 10);
  const c = level === 1 ? gen.int(2, 6) : gen.int(2, 9);
  if (!(new Set([a, b, c]).size >= 2)) return null;
  const volume = a * b * c;
  const surface = 2 * (a * b + a * c + b * c);
  const sides = `Ein Quader ist ${a} cm lang, ${b} cm breit und ${c} cm hoch.`;
  if (level === 3 && gen.chance(45)) {
    // The missing edge from the volume.
    // Divided by another edge, the base area taken off, the base area alone.
    const wrong = [T.div(volume, a), volume - a * b, a * b, T.div(volume, b)].filter((v) => v > 0);
    return numberProblem({
      prompt: `Ein Quader mit der Grundfläche ${a * b} cm² hat das Volumen ${volume} cm³.\nWie hoch ist er?`,
      answer: q(c),
      style: S.unit('cm'),
      hint: valueHint,
      wrong: wrong.map((v) => q(v)),
      pair: `G = ${a * b} cm², V = ${volume} cm³`,
      solution: `V = G · h, also h = ${volume} : ${a * b} = ${c} cm`,
      explanation: 'Das Volumen ist Grundfläche mal Höhe. Die Höhe findest du, indem du das Volumen durch die Grundfläche teilst.',
    });
  }
  const asksVolume = level === 1 || gen.chance(45);
  if (asksVolume) {
    // The sum, the surface, the base area alone, a doubled volume.
    const wrong = [a + b + c, surface, a * b, 2 * volume, a * b + c];
    return numberProblem({
      prompt: `${sides}\nBerechne das Volumen.`,
      answer: q(volume),
      style: S.unit('cm³'),
      hint: valueHint,
      wrong: wrong.map((v) => q(v)),
      pair: `Volumen: ${a} cm · ${b} cm · ${c} cm`,
      solution: `V = a · b · c = ${a} · ${b} · ${c} = ${volume} cm³`,
      explanation: 'Das Volumen eines Quaders ist Länge mal Breite mal Höhe. Die Einheit hat die Hochzahl 3.',
    });
  }
  // The volume, one pair of faces missing, the sum of the three faces without doubling.
  const wrong = [volume, a * b + a * c + b * c, 2 * (a * b + a * c), a * b * 2 + c];
  return numberProblem({
    prompt: `${sides}\nBerechne die Oberfläche.`,
    answer: q(surface),
    style: S.unit('cm²'),
    hint: valueHint,
    wrong: wrong.map((v) => q(v)),
    pair: `Oberfläche: ${a} cm · ${b} cm · ${c} cm`,
    solution: `O = 2 · (a·b + a·c + b·c) = 2 · (${a * b} + ${a * c} + ${b * c}) = ${surface} cm²`,
    explanation: 'Ein Quader hat sechs Rechtecke, je zwei gleiche: O = 2 · (a·b + a·c + b·c).',
  });
}

/** Prism and cylinder: the volume is the base area times the height. */
function solid(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => solidAttempt(level, gen));
}

function solidAttempt(level: number, gen: Gen): Problem | null {
  if (level === 1) {
    const g = gen.int(4, 30);
    const h = gen.int(2, 12);
    if (g === h) return null;
    // Base plus height, half of the volume, the volume doubled.
    return numberProblem({
      prompt: `Ein Prisma hat die Grundfläche ${g} cm² und die Höhe ${h} cm.\nWie groß ist das Volumen?`,
      answer: q(g * h),
      style: S.unit('cm³'),
      hint: valueHint,
      wrong: positives(decimals([q(g + h), q(g * h, 2), q(g * h * 2), q(g * h * h)], 1)),
      pair: `Prisma: G = ${g} cm², h = ${h} cm`,
      solution: `V = G · h = ${g} · ${h} = ${g * h} cm³`,
      explanation: 'Für jedes Prisma und jeden Zylinder gilt V = G · h: Grundfläche mal Höhe.',
    });
  }
  const r = gen.int(2, 9);
  const h = gen.int(2, 12);
  const withDiameter = level === 3 && gen.chance(50);
  if (r === h) return null;
  const value = r * r * h;
  const given = withDiameter ? `den Durchmesser ${2 * r} cm` : `den Radius ${r} cm`;
  // The radius not squared, the diameter used as the radius, the lateral surface, the base area alone.
  const wrong = [r * h, 4 * r * r * h, 2 * r * h, r * r, r * r * h * 2];
  return numberProblem({
    prompt: `Ein Zylinder hat ${given} und die Höhe ${h} cm.\nBerechne das Volumen in cm³. Gib das Ergebnis als Vielfaches von π an.`,
    answer: q(value),
    style: S.pi,
    hint: piHint,
    wrong: wrong.map((v) => q(v)),
    pair: 'Zylinder: ' + (withDiameter ? `d = ${2 * r} cm` : `r = ${r} cm`) + `, h = ${h} cm`,
    solution: `r = ${r} cm; V = π · r² · h = π · ${r}² · ${h} = ${value}π cm³`,
    explanation: 'Beim Zylinder ist die Grundfläche ein Kreis: V = π · r² · h. Der Radius ist der halbe Durchmesser, und nur er wird quadriert.',
  });
}

const areaUnits = ['mm²', 'cm²', 'dm²', 'm²'];
const volumeUnits = ['cm³', 'dm³', 'm³'];

/** A value of a conversion: whole numbers from a thousand on get the thin space. */
function valueText(x: Q): string {
  const whole = x.int;
  if (whole !== null && whole >= 1000) return T.grouped(whole);
  return num(x);
}

/** "3 dm² = ? cm²": each step is 100 for areas and 1000 for volumes. */
function units(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => unitsAttempt(level, gen));
}

function ipow(base: number, exponent: number): number {
  let result = 1;
  for (let i = 0; i < Math.max(0, exponent); i++) result *= base;
  return result;
}

function unitsAttempt(level: number, gen: Gen): Problem | null {
  const isArea = level === 1 || gen.chance(40);
  const list = isArea ? areaUnits : volumeUnits;
  const step = isArea ? 100 : 1000;
  const wrongStep = isArea ? 10 : 100;
  const from = gen.int(0, list.length - 1);
  const delta = level === 1 ? gen.pick([-1, 1]) : level === 2 ? gen.pick([-1, 1, -2, 2]) : gen.pick([-2, 2, -1, 1]);
  const to = from + delta;
  if (!(to >= 0 && to <= list.length - 1)) return null;
  // Liters are dm³ and millilitres are cm³.
  let fromName = list[from];
  let toName = list[to];
  if (!isArea) {
    if (from === 1 && gen.chance(50)) fromName = 'l';
    if (to === 1 && gen.chance(50)) toName = 'l';
    if (from === 0 && gen.chance(30)) fromName = 'ml';
    if (to === 0 && gen.chance(30)) toName = 'ml';
  }
  const steps = Math.abs(delta);
  const factor = ipow(step, steps);
  const wrongFactor = ipow(wrongStep, steps);
  const bigToSmall = delta < 0;
  // Answers stay below 1000: a big unit into a small one only with small values.
  const bigValues: Q[] = [q(2), q(3), q(4), q(5), q(6), q(7), q(8), q(9), q(1, 5), q(1, 4), q(2, 5), q(1, 2), q(3, 5), q(3, 4), q(4, 5), q(1, 20), q(1, 50), q(3, 100), q(2, 25)];
  const smallValues: Q[] = [2, 3, 5, 6, 8, 10, 20, 25, 40, 50, 60, 75, 80, 120, 150, 200, 250, 400, 500, 600, 750, 800, 1500, 2500, 3000, 4500, 5000, 7500].map((v) => q(v));
  const candidates = (bigToSmall ? bigValues : smallValues).filter((value) => {
    const result = bigToSmall ? value.times(factor) : value.over(factor);
    return result.ok && result.double < 1000 && result.double >= 0.01 && (bigToSmall ? result.isWhole : decimals([result], 3).length === 1);
  });
  if (candidates.length === 0) return null;
  const value = gen.pick(candidates);
  const answer = bigToSmall ? value.times(factor) : value.over(factor);
  // Counting with the length factor, off by a power of ten, the wrong way round.
  const withWrongFactor = bigToSmall ? value.times(wrongFactor) : value.over(wrongFactor);
  const wrong = positives(decimals([withWrongFactor, answer.times(10), answer.over(10), bigToSmall ? value.over(factor) : value.times(factor)], 3));
  return numberProblem({
    prompt: `Wandle um:\n${valueText(value)} ${fromName} = ? ${toName}`,
    answer,
    hint: 'Gib die Zahl an.',
    wrong,
    pair: `${valueText(value)} ${fromName} in ${toName}`,
    solution: `Jede Stufe ist der Faktor ${T.grouped(step)}: ${steps} ${steps === 1 ? 'Stufe' : 'Stufen'}, ${valueText(value)} ${bigToSmall ? '·' : ':'} ${T.grouped(factor)} = ${valueText(answer)} ${toName}`,
    explanation: isArea
      ? 'Bei Flächen ist jede Stufe der Faktor 100 (1 m² = 100 dm²). Zur kleineren Einheit malnehmen, zur größeren teilen.'
      : 'Bei Volumen ist jede Stufe der Faktor 1000 (1 dm³ = 1000 cm³), und 1 l ist 1 dm³. Zur kleineren Einheit malnehmen, zur größeren teilen.',
  });
}

/** "Wie viele Liter passen in das Aquarium?" cm³ to liters, and the water level the other way. */
function volumeWord(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => volumeWordAttempt(level, gen));
}

function volumeWordAttempt(level: number, gen: Gen): Problem | null {
  if (level === 3 && gen.chance(50)) {
    // The water level: liters to cm³, divided by the base area.
    const length = gen.pick([40, 50, 60, 80]);
    const width = gen.pick([20, 25, 30, 40, 50]);
    const height = gen.int(5, 40);
    const liters = length * width * height;
    if (liters % 1000 !== 0) return null;
    const l = liters / 1000;
    if (!(l >= 2 && l <= 99)) return null;
    // The liters taken for cm³, not converted: the height too small by a thousandth; or times 10.
    const wrong = positives(decimals([q(l, length * width), q(l * 10, length * width), q(l * 1000, length), q(height * 10), q(height, 10)], 2));
    return numberProblem({
      prompt: `In ein Becken (${length} cm lang, ${width} cm breit) werden ${l} l Wasser gefüllt.\nWie hoch steht das Wasser?`,
      answer: q(height),
      style: S.unit('cm'),
      hint: valueHint,
      wrong,
      solution: `${l} l = ${T.grouped(l * 1000)} cm³; Grundfläche ${length * width} cm²; ${T.grouped(l * 1000)} : ${length * width} = ${height} cm`,
      explanation: 'Rechne die Liter in cm³ um (1 l = 1000 cm³). Das Volumen geteilt durch die Grundfläche ist die Höhe.',
    });
  }
  const inDm = level === 1;
  const a = inDm ? gen.int(2, 9) : gen.pick([20, 30, 40, 50, 60, 80, 100]);
  const b = inDm ? gen.int(2, 8) : gen.pick([20, 25, 30, 40, 50]);
  const c = inDm ? gen.int(2, 6) : gen.pick([20, 25, 30, 40, 50, 60]);
  const volume = a * b * c;
  const liters = q(volume, inDm ? 1 : 1000);
  if (!liters.ok || decimals([liters], 1).length !== 1 || !(liters.double >= 2) || !(liters.double < 1000) || a === b) return null;
  const unit = inDm ? 'dm' : 'cm';
  const thing = gen.pick(['Ein Aquarium', 'Ein Wassertank', 'Eine Kiste']);
  // Not converted, converted by 100 or 10 000, the edges added.
  const wrong = inDm
    ? [q(a + b + c), q(2 * (a * b + a * c + b * c)), liters.times(10), liters.over(10), q(volume * 1000)]
    : [q(volume), liters.over(10), liters.times(10), q(volume, 100), q(a + b + c)];
  return numberProblem({
    prompt: `${thing} ist ${a} ${unit} lang, ${b} ${unit} breit und ${c} ${unit} hoch.\nWie viele Liter passen hinein?`,
    answer: liters,
    style: S.unit('l'),
    hint: valueHint,
    wrong: positives(decimals(wrong, 2)),
    solution: inDm
      ? `V = ${a} · ${b} · ${c} = ${volume} dm³ = ${volume} l`
      : `V = ${a} · ${b} · ${c} = ${T.grouped(volume)} cm³; ${T.grouped(volume)} : 1000 = ${num(liters)} l`,
    explanation: inDm
      ? '1 dm³ ist 1 Liter. Das Volumen in dm³ ist also gleich der Anzahl der Liter.'
      : 'Zuerst das Volumen in cm³ berechnen. Dann gilt 1000 cm³ = 1 l, du teilst also durch 1000.',
  });
}

// Lesson 3

/** Angles in triangles and quadrilaterals, adjacent angles, and the isosceles triangle. */
function angles(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => anglesAttempt(level, gen));
}

function anglesAttempt(level: number, gen: Gen): Problem | null {
  const kind = level === 1 ? gen.int(0, 1) : level === 2 ? gen.int(1, 3) : gen.int(2, 4);
  switch (kind) {
    case 0: {
      // Triangle: 180° minus the two known angles.
      const a = gen.int(20, 80);
      const b = gen.int(20, 80);
      const c = 180 - a - b;
      if (!(c >= 15)) return null;
      return degrees(`In einem Dreieck sind α = ${a}° und β = ${b}°.\nWie groß ist γ?`, c, {
        wrong: [180 - a, 180 - b, a + b, 360 - a - b],
        front: `Dreieck: α = ${a}°, β = ${b}°`,
        working: `γ = 180° ${T.minus} ${a}° ${T.minus} ${b}° = ${c}°`,
        why: 'Die Winkelsumme im Dreieck ist 180°. Ziehe die beiden bekannten Winkel davon ab.',
      });
    }
    case 1: {
      // Adjacent angles add up to 180°.
      const a = gen.int(25, 155);
      if (a === 90) return null;
      return degrees(`Zwei Winkel liegen nebeneinander auf einer Geraden. Einer ist ${a}° groß.\nWie groß ist der andere?`, 180 - a, {
        wrong: [90 - a, 360 - a, a, 180 + a].filter((v) => v > 0),
        front: `Nebenwinkel von ${a}°`,
        working: `180° ${T.minus} ${a}° = ${180 - a}°`,
        why: 'Nebenwinkel ergeben zusammen 180°, weil sie auf einer Geraden liegen.',
      });
    }
    case 2: {
      // Quadrilateral: 360° minus the three known angles.
      const a = gen.int(60, 120);
      const b = gen.int(60, 120);
      const c = gen.int(60, 120);
      const d = 360 - a - b - c;
      if (!(d >= 30 && d <= 150)) return null;
      return degrees(`In einem Viereck sind drei Winkel ${a}°, ${b}° und ${c}° groß.\nWie groß ist der vierte Winkel?`, d, {
        wrong: [360 - a - b, 360 - a - c, a + b + c - 180, 360 - b - c].filter((v) => v > 0),
        front: `Viereck: ${a}°, ${b}°, ${c}°`,
        working: `δ = 360° ${T.minus} ${a}° ${T.minus} ${b}° ${T.minus} ${c}° = ${d}°`,
        why: 'Die Winkelsumme im Viereck ist 360°. Ziehe die drei bekannten Winkel davon ab.',
      });
    }
    case 3: {
      // Isosceles triangle: apex or base angle.
      if (gen.chance(50)) {
        const base = gen.int(30, 80);
        const apex = 180 - 2 * base;
        if (!(apex >= 20) || base === 60) return null;
        return degrees(`Ein gleichschenkliges Dreieck hat ${base}° an der Basis.\nWie groß ist der Winkel an der Spitze?`, apex, {
          wrong: [180 - base, base * 2, 90 - base, base].filter((v) => v > 0),
          front: `Basiswinkel ${base}°, Spitze?`,
          working: `180° ${T.minus} 2 · ${base}° = ${apex}°`,
          why: 'Im gleichschenkligen Dreieck sind die beiden Basiswinkel gleich groß. Von 180° gehen beide ab.',
        });
      }
      const apex = gen.pick([20, 30, 40, 50, 80, 100, 110, 120, 140]);
      const base = T.div(180 - apex, 2);
      return degrees(`Ein gleichschenkliges Dreieck hat ${apex}° an der Spitze.\nWie groß ist ein Basiswinkel?`, base, {
        wrong: [180 - apex, T.div(apex, 2), 90 - apex, T.div(360 - apex, 2)].filter((v) => v > 0),
        front: `Spitze ${apex}°, Basiswinkel?`,
        working: `(180° ${T.minus} ${apex}°) : 2 = ${base}°`,
        why: 'Die beiden Basiswinkel sind gleich groß. Ziehe den Winkel an der Spitze von 180° ab und teile durch 2.',
      });
    }
    default: {
      // A triangle with an angle given as a multiple of another.
      const a = gen.int(15, 40);
      const times = gen.int(2, 3);
      const b = a * times;
      const c = 180 - a - b;
      if (!(c >= 20)) return null;
      return degrees(`In einem Dreieck ist α = ${a}° und β ist ${times === 2 ? 'doppelt' : 'dreimal'} so groß wie α.\nWie groß ist γ?`, c, {
        wrong: [180 - a - a, 180 - b, b - a, a + b].filter((v) => v > 0),
        front: `α = ${a}°, β = ${times}α`,
        working: `β = ${times} · ${a}° = ${b}°; γ = 180° ${T.minus} ${a}° ${T.minus} ${b}° = ${c}°`,
        why: 'Berechne zuerst den zweiten Winkel, dann ziehst du beide von 180° ab.',
      });
    }
  }
}

function degrees(prompt: string, answer: number, o: { wrong: number[]; front: string; working: string; why: string }): Problem | null {
  const problem = numberProblem({
    prompt,
    answer: q(answer),
    style: S.degrees,
    hint: 'Gib die Gradzahl ohne ° an.',
    wrong: o.wrong.map((v) => q(v)),
    pair: o.front,
    solution: o.working,
    explanation: o.why,
  });
  if (problem) problem.pairPrompt = 'Ordne jeder Aufgabe den gesuchten Winkel zu.';
  return problem;
}

const triples: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [15, 20, 25], [20, 21, 29]];

/** A triple at the level; level 3 scales a small one by 0,5, 1,5 or 2,5. */
function pickTriple(level: number, gen: Gen): [Q, Q, Q] {
  switch (level) {
    case 1: {
      const t = gen.pick(triples.slice(0, 3));
      return [q(t[0]), q(t[1]), q(t[2])];
    }
    case 2: {
      const t = gen.pick(triples.slice(0, 6));
      return [q(t[0]), q(t[1]), q(t[2])];
    }
    default: {
      if (gen.chance(50)) {
        const t = gen.pick([...triples.slice(0, 2), [5, 12, 13] as [number, number, number]]);
        const k = q(gen.pick([1, 3, 5]), 2);
        return [k.times(t[0]), k.times(t[1]), k.times(t[2])];
      }
      const t = gen.pick(triples);
      return [q(t[0]), q(t[1]), q(t[2])];
    }
  }
}

/** Hypotenuse or leg of a right triangle. */
function pythagoras(level: number, gen: Gen): Problem | null {
  const triple = pickTriple(level, gen);
  const swap = gen.chance(50);
  const [a, b, c] = [swap ? triple[1] : triple[0], swap ? triple[0] : triple[1], triple[2]];
  const findsHypotenuse = level === 1 || gen.chance(50);
  const sq = (x: Q): Q => x.times(x);
  if (findsHypotenuse) {
    // The legs added, the squares added without a root, the difference of the legs.
    const wrong = positives(decimals([a.plus(b), sq(a).plus(sq(b)), b.minus(a).magnitude, c.plus(1)], 2));
    return numberProblem({
      prompt: `In einem rechtwinkligen Dreieck sind die Katheten ${num(a)} cm und ${num(b)} cm lang.\nWie lang ist die Hypotenuse?`,
      answer: c,
      style: S.unit('cm'),
      hint: valueHint,
      wrong,
      pair: `Katheten ${num(a)} cm, ${num(b)} cm`,
      solution: `c² = ${num(a)}² + ${num(b)}² = ${num(sq(a))} + ${num(sq(b))} = ${num(sq(c))}; c = ${num(c)} cm`,
      explanation: 'Im rechtwinkligen Dreieck gilt a² + b² = c². Die Hypotenuse c liegt gegenüber dem rechten Winkel.',
    });
  }
  // The other leg: the hypotenuse squared minus the known leg squared.
  const wrong = positives(decimals([c.minus(a), c.plus(a), sq(c).plus(sq(a)), sq(c).minus(sq(a))], 2));
  return numberProblem({
    prompt: `In einem rechtwinkligen Dreieck ist die Hypotenuse ${num(c)} cm und eine Kathete ${num(a)} cm lang.\nWie lang ist die andere Kathete?`,
    answer: b,
    style: S.unit('cm'),
    hint: valueHint,
    wrong,
    pair: `c = ${num(c)} cm, a = ${num(a)} cm`,
    solution: `b² = c² ${T.minus} a² = ${num(sq(c))} ${T.minus} ${num(sq(a))} = ${num(sq(b))}; b = ${num(b)} cm`,
    explanation: 'Stelle a² + b² = c² um: b² = c² − a². Die Hypotenuse ist die längste Seite und wird nicht abgezogen, sondern steht allein.',
  });
}

/** Ladder, diagonal and shortcut: Pythagoras in a story. */
function pythagorasWord(level: number, gen: Gen): Problem | null {
  const triple = pickTriple(level === 1 ? 2 : level, gen);
  const swap = gen.chance(50);
  const [a, b, c] = [swap ? triple[1] : triple[0], swap ? triple[0] : triple[1], triple[2]];
  const story = gen.int(0, 2);
  const unit = story === 1 ? 'cm' : 'm';
  let prompt: string;
  let answer: Q;
  let working: string;
  let wrong: Q[];
  switch (story) {
    case 0:
      // Ladder: the length is the hypotenuse, the foot distance a leg: the height is the other leg.
      prompt = `Eine ${num(c)} m lange Leiter lehnt an einer Wand. Ihr Fuß steht ${num(a)} m von der Wand entfernt.\nWie hoch reicht die Leiter?`;
      answer = b;
      wrong = [c.minus(a), c.plus(a), c.times(c).minus(a.times(a)), a.plus(b)];
      working = `h² = ${num(c)}² ${T.minus} ${num(a)}² = ${num(c.times(c).minus(a.times(a)))}; h = ${num(b)} m`;
      break;
    case 1:
      prompt = `Ein Rechteck ist ${num(a)} cm lang und ${num(b)} cm breit.\nWie lang ist die Diagonale?`;
      answer = c;
      wrong = [a.plus(b), a.times(a).plus(b.times(b)), b.minus(a).magnitude, a.times(b)];
      working = `d² = ${num(a)}² + ${num(b)}² = ${num(a.times(a).plus(b.times(b)))}; d = ${num(c)} cm`;
      break;
    default:
      prompt = `Ein Sportplatz ist ${num(a)} m lang und ${num(b)} m breit. Anna läuft quer über die Diagonale.\nWie lang ist ihr Weg?`;
      answer = c;
      wrong = [a.plus(b), a.times(a).plus(b.times(b)), b.minus(a).magnitude, a.times(b)];
      working = `d² = ${num(a)}² + ${num(b)}² = ${num(a.times(a).plus(b.times(b)))}; d = ${num(c)} m`;
  }
  return numberProblem({
    prompt,
    answer,
    style: S.unit(unit),
    hint: valueHint,
    wrong: positives(decimals(wrong, 2)),
    solution: working,
    explanation: 'Suche das rechtwinklige Dreieck in der Geschichte und die Hypotenuse (die Seite gegenüber dem rechten Winkel). Dann gilt a² + b² = c².',
  });
}

/** Which set of sides makes a right triangle? The converse of the theorem. */
function rightAngleTest(level: number, gen: Gen): Problem | null {
  return gen.attempt(() => rightAngleTestAttempt(level, gen));
}

function rightAngleTestAttempt(level: number, gen: Gen): Problem | null {
  const pool = level === 1 ? triples.slice(0, 5) : level === 2 ? triples.slice(0, 6) : triples;
  const [a, b, c] = gen.pick(pool);
  const isRight = (x: number, y: number, z: number): boolean => {
    const sides = [x, y, z].sort((m, n) => m - n);
    return sides[0] * sides[0] + sides[1] * sides[1] === sides[2] * sides[2];
  };
  const text = (x: number, y: number, z: number): string => `${x} cm, ${y} cm, ${z} cm`;
  // One side too long or too short by 1 or 2, two sides swapped for a shorter one.
  const candidates = ([[a, b, c + 1], [a, b, c - 1], [a + 1, b, c], [a, b + 1, c], [a, b, c + 2], [a - 1, b, c], [a, b - 1, c]] as [number, number, number][]).filter(
    (t) => t[0] > 0 && t[1] > 0 && t[2] > 0 && !isRight(t[0], t[1], t[2]) && t[0] + t[1] > t[2],
  );
  const wrong = gen.shuffled(candidates).slice(0, 3).map((t) => text(t[0], t[1], t[2]));
  if (wrong.length !== 3) return null;
  const [small1, small2] = a < b ? [a, b] : [b, a];
  return textProblem({
    prompt: 'Welche Seitenlängen gehören zu einem rechtwinkligen Dreieck?',
    correct: text(a, b, c),
    wrong,
    typed: {
      prompt: `Ein Dreieck hat die Seiten ${text(a, b, c)}.\nBerechne a² + b² mit den beiden kürzeren Seiten.`,
      answer: R(small1 * small1 + small2 * small2),
    },
    solution: `${a}² + ${b}² = ${a * a + b * b} und ${c}² = ${c * c}: Die Summe der Quadrate der kurzen Seiten gleicht dem Quadrat der längsten, also ist es rechtwinklig.`,
    explanation: 'Gilt a² + b² = c² für die drei Seiten (c ist die längste), ist das Dreieck rechtwinklig. Bei den anderen Dreiecken stimmt die Gleichung nicht.',
  });
}
