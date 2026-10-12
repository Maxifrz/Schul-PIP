// Unit 6: intervals, counted, named, built and heard. A port of Lernwerk/Services/Learn/Music/MusicUnit6.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import { ExerciseMedia, toneSpec } from '../media';
import { type Pitch } from '../music';
import type { LearnRandom } from '../random';
import { fact as makeFact, type MusicFact, MusicKit, type MusicUnitDef } from './kit';
import {
  intervalAbove, intervalName, intervalNumber, intervalSizeName, inverted, type MusicInterval, sameInterval, SIZE_NAMES, STANDARD_INTERVALS,
  germanName, scientificName,
} from './theory';

const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);
const tag = 'music.u06';

/** The interval of the standard table with this many half steps. */
export function intervalOfSemitones(semitones: number): MusicInterval | undefined {
  return STANDARD_INTERVALS.find((i) => i.semitones === semitones);
}
const interval = intervalOfSemitones;

export const unit6FreshSemis: number[][] = [[0, 2, 3, 4, 5, 7], [1, 2, 3, 4, 5, 7, 12], [8, 9, 10, 11]];
export const unit6UpToSemis: number[][] = [
  [0, 1, 2, 3, 4, 5, 7],
  [0, 1, 2, 3, 4, 5, 7, 12],
  [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12],
];
/** What the ear exercises of each lesson may play: only intervals the lessons so far have named. */
export const unit6HearSemis: number[][] = [[], [2, 3, 4, 5, 7, 12], [3, 4, 5, 7, 8, 9, 10, 12]];
export const unit6HearAll = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];

function pickInterval(level: number, random: LearnRandom): MusicInterval | undefined {
  const fresh = level >= 4 ? unit6UpToSemis[2] : unit6FreshSemis[level - 1];
  const all = level >= 4 ? unit6UpToSemis[2] : unit6UpToSemis[level - 1];
  const semis = MusicKit.draw(fresh, all, level, random);
  if (semis === undefined) return undefined;
  return interval(semis);
}

/** Two natural notes with this interval between them, the lower in the fourth octave. */
function naturalPair(i: MusicInterval, random: LearnRandom): [Pitch, Pitch] | null {
  for (const letter of random.shuffled([0, 1, 2, 3, 4, 5, 6])) {
    const lower = n(letter, 4);
    const upper = intervalAbove(i, lower);
    if (upper.alteration === 0) return [lower, upper];
  }
  return null;
}

function sentence(i: MusicInterval, lower: Pitch, upper: Pitch): string {
  return `${germanName(lower)} bis ${germanName(upper)}: ${intervalNumber(i)} Töne gezählt, ${i.semitones} Halbtöne, also ${intervalName(i) ?? intervalSizeName(i)}.`;
}

/** Wrong answers for an interval: the same number with the other size, the neighbouring numbers and the inversion. */
export function wrongIntervals(i: MusicInterval, taught: number[]): MusicInterval[] {
  const near = STANDARD_INTERVALS.filter(
    (other) =>
      !sameInterval(other, i) &&
      (other.steps === i.steps ||
        (Math.abs(other.steps - i.steps) === 1 && Math.abs(other.semitones - i.semitones) <= 2) ||
        sameInterval(other, inverted(i))),
  );
  return near.slice().sort((a, b) => {
    const ta = taught.includes(a.semitones);
    const tb = taught.includes(b.semitones);
    return ta !== tb ? (ta ? -1 : 1) : 0;
  });
}

function num(random: LearnRandom, level: number): LearnExercise | null {
  const i = pickInterval(level, random);
  if (i === undefined || i.steps > 6) return null;
  const pair = naturalPair(i, random);
  if (!pair) return null;
  const [lower, upper] = pair;
  const wrong: string[] = [];
  for (const d of [1, -1, 2, -2]) if (i.steps + d >= 0 && i.steps + d <= 7) wrong.push(SIZE_NAMES[i.steps + d]);
  wrong.push(SIZE_NAMES[7 - i.steps]);
  return Exercises.choice(
    {
      id: `${tag}.num.${scientificName(lower)}.${scientificName(upper)}`,
      key: `music.interval.size.${i.steps}`,
      prompt: 'Wie heißt dieses Intervall? Zähle beide Töne mit.',
      correct: intervalSizeName(i),
      wrong,
      explanation: `Von ${germanName(lower)} bis ${germanName(upper)} sind es ${intervalNumber(i)} Töne: ${intervalSizeName(i)}.`,
      media: MusicKit.staff('treble', [lower, upper]),
    },
    random,
  );
}

function numType(random: LearnRandom, level: number): LearnExercise | null {
  const i = pickInterval(level, random);
  if (i === undefined || i.steps > 6) return null;
  const pair = naturalPair(i, random);
  if (!pair) return null;
  const [lower, upper] = pair;
  return Exercises.typed({
    id: `${tag}.numtype.${scientificName(lower)}.${scientificName(upper)}`,
    key: `music.interval.size.${i.steps}`,
    prompt: `Wie heißt das Intervall von ${germanName(lower)} nach ${germanName(upper)}? Zähle beide Töne mit.`,
    answer: intervalSizeName(i),
    mode: 'exact',
    explanation: `${intervalNumber(i)} Töne gezählt: ${intervalSizeName(i)}.`,
    media: MusicKit.staff('treble', [lower, upper]),
  });
}

function pairsNum(random: LearnRandom, _level: number): LearnExercise | null {
  const chosen = random.shuffled([1, 2, 3, 4, 5, 6]).slice(0, 4);
  const items = chosen.map((steps) => ({
    key: `music.interval.size.${steps}`,
    front: SIZE_NAMES[steps],
    back: `C – ${germanName(n(steps, 4))}`,
  }));
  return Exercises.pairs(
    { id: `${tag}.pairsnum.` + chosen.slice().sort((a, b) => a - b).map(String).join(''), prompt: 'Welches Intervall liegt über C?', items },
    random,
  );
}

function name(random: LearnRandom, level: number): LearnExercise | null {
  const i = pickInterval(level, random);
  const nm = i === undefined ? null : intervalName(i);
  if (i === undefined || nm === null) return null;
  const pair = naturalPair(i, random);
  if (!pair) return null;
  const [lower, upper] = pair;
  const taught = level >= 3 ? unit6UpToSemis[2] : unit6UpToSemis[1];
  const wrong = wrongIntervals(i, taught).map(intervalName).filter((x): x is string => x !== null);
  return Exercises.choice(
    {
      id: `${tag}.name.${scientificName(lower)}.${scientificName(upper)}`,
      key: `music.interval.${i.semitones}`,
      prompt: 'Wie heißt dieses Intervall?',
      correct: nm,
      wrong,
      explanation: sentence(i, lower, upper),
      media: MusicKit.staff('treble', [lower, upper]),
    },
    random,
  );
}

function nameType(random: LearnRandom, level: number): LearnExercise | null {
  const i = pickInterval(level, random);
  const nm = i === undefined ? null : intervalName(i);
  if (i === undefined || nm === null) return null;
  const pair = naturalPair(i, random);
  if (!pair) return null;
  const [lower, upper] = pair;
  const alternatives = nm.startsWith('reine ') ? [intervalSizeName(i)] : [];
  return Exercises.typed({
    id: `${tag}.nametype.${scientificName(lower)}.${scientificName(upper)}`,
    key: `music.interval.${i.semitones}`,
    prompt: 'Wie heißt dieses Intervall? Schreibe den ganzen Namen.',
    answer: nm,
    alternatives,
    mode: 'exact',
    explanation: sentence(i, lower, upper),
    media: MusicKit.staff('treble', [lower, upper]),
  });
}

function semis(random: LearnRandom, level: number): LearnExercise | null {
  const i = pickInterval(level, random);
  const nm = i === undefined ? null : intervalName(i);
  if (i === undefined || nm === null) return null;
  const wrong = [i.semitones + 1, i.semitones - 1, i.semitones + 2, i.semitones - 2].filter((x) => x >= 0).map(String);
  return Exercises.choice(
    {
      id: `${tag}.semis.${i.semitones}`,
      key: `music.interval.${i.semitones}`,
      prompt: `Wie viele Halbtöne hat die ${nm}?`,
      correct: `${i.semitones}`,
      wrong,
      explanation: `Die ${nm} umfasst ${i.semitones} Halbtöne.`,
    },
    random,
  );
}

function semisType(random: LearnRandom, level: number): LearnExercise | null {
  const i = pickInterval(level, random);
  const nm = i === undefined ? null : intervalName(i);
  if (i === undefined || nm === null) return null;
  return Exercises.typed({
    id: `${tag}.semistype.${i.semitones}`,
    key: `music.interval.${i.semitones}`,
    prompt: `Wie viele Halbtöne hat die ${nm}? Schreibe eine Zahl.`,
    answer: `${i.semitones}`,
    mode: 'number',
    explanation: `Die ${nm} umfasst ${i.semitones} Halbtöne.`,
  });
}

function pairsSemis(random: LearnRandom, level: number): LearnExercise | null {
  const pool = (level >= 3 ? unit6UpToSemis[2] : unit6UpToSemis[1]).filter((s) => s > 0);
  const chosen = random.shuffled(pool).slice(0, 4).sort((a, b) => a - b);
  const items: { key: string; front: string; back: string }[] = [];
  for (const s of chosen) {
    const nm = interval(s) ? intervalName(interval(s)!) : null;
    if (nm === null) continue;
    items.push({ key: `music.interval.${s}`, front: nm, back: s === 1 ? '1 Halbton' : `${s} Halbtöne` });
  }
  return Exercises.pairs(
    { id: `${tag}.pairssemis.` + chosen.map(String).join('-'), prompt: 'Wie viele Halbtöne hat das Intervall?', items },
    random,
  );
}

const weird = new Set(['Fes', 'Ces', 'Eis', 'His']);

interface BuildSetup {
  base: Pitch;
  interval: MusicInterval;
  upper: Pitch;
}

/** A base note and an interval above it whose upper note has a plain name. */
function buildSetup(level: number, random: LearnRandom): BuildSetup | null {
  const naturals = [0, 1, 2, 3, 4, 5, 6].map((l) => n(l, 4));
  const signs = [n(2, 4, -1), n(6, 4, -1), n(5, 4, -1), n(3, 4, 1)];
  for (let attempt = 0; attempt < 30; attempt++) {
    const base = MusicKit.pick(level >= 3 ? [...naturals, ...signs] : naturals, random);
    if (!base) continue;
    const s = MusicKit.draw(
      level >= 4 ? unit6UpToSemis[2] : unit6FreshSemis[level - 1],
      level >= 4 ? unit6UpToSemis[2] : unit6UpToSemis[level - 1],
      level,
      random,
    );
    if (s === undefined || !(s > 0)) continue;
    const i = interval(s);
    if (!i || intervalName(i) === null) continue;
    const upper = intervalAbove(i, base);
    if (Math.abs(upper.alteration) <= 1 && !weird.has(germanName(upper))) return { base, interval: i, upper };
  }
  return null;
}

function build(random: LearnRandom, level: number): LearnExercise | null {
  const s = buildSetup(Math.max(level, 2), random);
  const nm = s ? intervalName(s.interval) : null;
  if (!s || nm === null) return null;
  return MusicKit.typedNote({
    id: `${tag}.build.${germanName(s.base)}.${s.interval.semitones}`,
    key: `music.interval.${s.interval.semitones}`,
    prompt: `Baue eine ${nm} über ${germanName(s.base)}. Welcher Ton ist das?`,
    answer: s.upper,
    explanation: `Erst die Buchstaben zählen (${intervalNumber(s.interval)} Töne), dann die Halbtöne anpassen: ${germanName(s.upper)}.`,
    media: MusicKit.staff('treble', [s.base]),
  });
}

function buildChoice(random: LearnRandom, level: number): LearnExercise | null {
  const s = buildSetup(Math.max(level, 2), random);
  const nm = s ? intervalName(s.interval) : null;
  if (!s || nm === null) return null;
  const wrong = MusicKit.wrongNames(s.upper, false, random);
  return Exercises.choice(
    {
      id: `${tag}.buildchoice.${germanName(s.base)}.${s.interval.semitones}`,
      key: `music.interval.${s.interval.semitones}`,
      prompt: `Welcher Ton liegt eine ${nm} über ${germanName(s.base)}?`,
      correct: germanName(s.upper),
      wrong,
      explanation: `Erst die Buchstaben zählen (${intervalNumber(s.interval)} Töne), dann die Halbtöne anpassen: ${germanName(s.upper)}.`,
      media: MusicKit.staff('treble', [s.base]),
    },
    random,
  );
}

function keyTap(random: LearnRandom, _level: number): LearnExercise | null {
  const s = buildSetup(2, random);
  const nm = s ? intervalName(s.interval) : null;
  if (!s || nm === null) return null;
  return Exercises.key({
    id: `${tag}.key.${germanName(s.base)}.${s.interval.semitones}`,
    key: `music.interval.${s.interval.semitones}`,
    prompt: `Tippe den Ton, der eine ${nm} über ${germanName(s.base)} liegt.`,
    midi: MusicKit.keys(s.upper),
    solution: germanName(s.upper),
    explanation: `${s.interval.semitones} Halbtöne über ${germanName(s.base)} liegt ${germanName(s.upper)}.`,
    media: MusicKit.staff('treble', [s.base]),
  });
}

function hear(random: LearnRandom, level: number): LearnExercise | null {
  const pool = level >= 4 ? unit6HearAll : unit6HearSemis[Math.min(Math.max(level, 2), 3) - 1];
  const s = MusicKit.pick(pool, random);
  if (s === undefined) return null;
  const start = random.randomElement(Array.from({ length: 13 }, (_, k) => 55 + k));
  if (start === undefined) return null;
  const i = interval(s);
  const nm = i ? intervalName(i) : null;
  if (!i || nm === null) return null;
  const wrong = random
    .shuffled(pool.filter((x) => x !== s))
    .map((x) => (interval(x) ? intervalName(interval(x)!) : null))
    .filter((x): x is string => x !== null);
  return Exercises.choice(
    {
      id: `${tag}.hear.${start}.${s}`,
      key: `music.interval.${s}`,
      prompt: 'Hör hin: Welches Intervall erklingt?',
      correct: nm,
      wrong,
      explanation: `Der zweite Ton liegt ${s} Halbtöne über dem ersten: ${nm}.`,
      media: ExerciseMedia.tones(toneSpec([start, start + s])),
    },
    random,
  );
}

function invert(random: LearnRandom, _level: number): LearnExercise | null {
  const pool = unit6UpToSemis[2].filter((s) => s >= 1 && s <= 11 && s !== 6);
  const s = MusicKit.pick(pool, random);
  if (s === undefined) return null;
  const i = interval(s);
  if (!i) return null;
  const nm = intervalName(i);
  const invName = intervalName(inverted(i));
  if (nm === null || invName === null) return null;
  const wrong = wrongIntervals(inverted(i), unit6UpToSemis[2]).map(intervalName).filter((x): x is string => x !== null);
  wrong.unshift(nm);
  return Exercises.choice(
    {
      id: `${tag}.invert.${s}`,
      key: `music.interval.invert.${s}`,
      prompt: `Welches Intervall entsteht, wenn man die ${nm} umkehrt?`,
      correct: invName,
      wrong,
      explanation: `Intervall und Umkehrung ergeben zusammen eine Oktave: ${intervalNumber(i)} + ${intervalNumber(inverted(i))} = 9 gezählt, 12 Halbtöne.`,
    },
    random,
  );
}

function order(random: LearnRandom, level: number): LearnExercise | null {
  const pool = (level >= 3 ? unit6UpToSemis[2] : unit6UpToSemis[1]).filter((s) => s > 0);
  const chosen = random.shuffled(pool).slice(0, 4).sort((a, b) => a - b);
  const words = chosen.map((s) => (interval(s) ? intervalName(interval(s)!) : null)).filter((x): x is string => x !== null);
  return Exercises.bank(
    {
      id: `${tag}.order.` + chosen.map(String).join('-'),
      key: 'music.interval.order',
      prompt: 'Ordne die Intervalle vom kleinsten zum größten.',
      words,
      explanation: 'Je mehr Halbtöne, desto größer das Intervall.',
    },
    random,
  );
}

function fact(random: LearnRandom, level: number): LearnExercise | null {
  return MusicKit.fact(unit6Facts, level, tag, random);
}

export const unit6Facts: MusicFact[] = [
  makeFact("count", 1, "Wie zählt man ein Intervall?", "Beide Töne zählen mit.", ["Nur die Töne dazwischen zählen.", "Nur den oberen Ton zählen.", "Die Halbtöne zählen."], "C bis E: C, D, E sind drei Töne, also eine Terz."),
  makeFact("prim", 1, "Wie heißt der Abstand zwischen zwei gleichen Tönen?", "Prim", ["Sekunde", "Oktave", "Quinte"], "Ein einziger Ton ergibt gezählt die 1: die Prim."),
  makeFact("octave", 1, "Wie viele Töne umfasst eine Oktave, wenn man beide Töne mitzählt?", "8", ["7", "6", "12"], "Okto bedeutet acht: C D E F G A H C."),
  makeFact("pure", 2, "Welche Intervalle heißen rein?", "Prim, Quarte, Quinte und Oktave", ["Sekunde, Terz, Sexte und Septime", "Terz und Sexte", "nur die Oktave"], "Sekunde, Terz, Sexte und Septime gibt es dagegen klein und groß."),
  makeFact("majorMinor", 2, "Was unterscheidet eine große von einer kleinen Terz?", "Die große Terz ist einen Halbton weiter.", ["Die große Terz ist einen Ganzton weiter.", "Die große Terz hat einen Ton mehr.", "Die kleine Terz ist rein."], "Große Terz: 4 Halbtöne, kleine Terz: 3 Halbtöne."),
  makeFact("tritone", 3, "Wie viele Halbtöne hat der Tritonus?", "6", ["5", "7", "4"], "Der Tritonus besteht aus drei Ganztönen, also sechs Halbtönen."),
  makeFact("tritoneWhole", 3, "Aus wie vielen Ganztönen besteht der Tritonus?", "3", ["2", "4", "6"], "Tri bedeutet drei."),
  makeFact("inversion", 3, "Wozu ergänzen sich ein Intervall und seine Umkehrung?", "zu einer Oktave", ["zu einer Quinte", "zu einer Septime", "zu einer Prim"], "Die große Terz und die kleine Sexte ergeben zusammen eine Oktave."),
];


export const unit6Def: MusicUnitDef = {
  makers: { fact, num, numType, pairsNum, name, nameType, semis, semisType, pairsSemis, build, buildChoice, keyTap, hear, invert, order },
  lessons: [
    ['fact', 'fact', 'num', 'num', 'num', 'num', 'numType', 'numType', 'pairsNum', 'fact'],
    ['fact', 'name', 'name', 'name', 'nameType', 'semis', 'semisType', 'hear', 'hear', 'hear', 'pairsSemis', 'keyTap'],
    ['fact', 'fact', 'name', 'name', 'build', 'build', 'buildChoice', 'hear', 'hear', 'invert', 'order', 'nameType'],
  ],
  practice: ['fact', 'num', 'name', 'nameType', 'semis', 'build', 'buildChoice', 'hear', 'hear', 'pairsSemis', '~', '~'],
  checkpoint: ['fact', 'num', 'name', 'name', 'nameType', 'semis', 'semisType', 'build', 'buildChoice', 'hear', 'hear', 'invert', 'order', 'pairsSemis'],
  review: ['name', 'nameType', 'build', 'hear'],
};
