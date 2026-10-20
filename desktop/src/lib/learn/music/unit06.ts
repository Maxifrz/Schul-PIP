import type { LearnExercise } from '../exercise';
import { bank as makeBank, choice, pairs as makePairs, pianoKey, typed } from '../exercises';
import { Pitch, midiOf, tones } from '../media';
import { LearnRandom } from '../random';
import { MusicKit, MusicMaker, MusicUnitDef, fact as mf } from './kit';
import { MusicInterval, germanName, intervalSizeNames, scientificName } from './theory';

const tag = 'music.u06';
const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);

/** The interval of the standard table with this many half steps. */
const interval = (semitones: number): MusicInterval | null => MusicInterval.standard.find((i) => i.semitones === semitones) ?? null;

const freshSemis: number[][] = [[0, 2, 3, 4, 5, 7], [1, 2, 3, 4, 5, 7, 12], [8, 9, 10, 11]];
const upToSemis: number[][] = [[0, 1, 2, 3, 4, 5, 7], [0, 1, 2, 3, 4, 5, 7, 12], [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]];
/** What the ear exercises of each lesson may play: only intervals the lessons so far have named. */
const hearSemis: number[][] = [[], [2, 3, 4, 5, 7, 12], [3, 4, 5, 7, 8, 9, 10, 12]];
const hearAll = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];

function pickInterval(level: number, random: LearnRandom): MusicInterval | null {
  const fresh = level >= 4 ? upToSemis[2] : freshSemis[level - 1];
  const all = level >= 4 ? upToSemis[2] : upToSemis[level - 1];
  const semis = MusicKit.draw(fresh, all, level, random);
  return semis === null ? null : interval(semis);
}

/** Two natural notes with this interval between them, the lower in the fourth octave. */
function naturalPair(i: MusicInterval, random: LearnRandom): [Pitch, Pitch] | null {
  for (const letter of random.shuffled([0, 1, 2, 3, 4, 5, 6])) {
    const lower = n(letter, 4);
    const upper = i.above(lower);
    if (upper.alteration === 0) return [lower, upper];
  }
  return null;
}

const sentence = (i: MusicInterval, lower: Pitch, upper: Pitch): string =>
  `${germanName(lower)} bis ${germanName(upper)}: ${i.number} Töne gezählt, ${i.semitones} Halbtöne, also ${i.name ?? i.sizeName}.`;

/** Wrong answers for an interval: the same number with the other size, the neighbouring numbers and the inversion. */
export function wrongIntervals(i: MusicInterval, taught: number[]): MusicInterval[] {
  const near = MusicInterval.standard.filter((other) => !other.equals(i)
    && (other.steps === i.steps || (Math.abs(other.steps - i.steps) === 1 && Math.abs(other.semitones - i.semitones) <= 2) || other.equals(i.inverted)));
  return [...near.filter((o) => taught.includes(o.semitones)), ...near.filter((o) => !taught.includes(o.semitones))];
}

const num: MusicMaker = (random, level) => {
  const i = pickInterval(level, random);
  const pair = i && i.steps <= 6 ? naturalPair(i, random) : null;
  if (!i || !pair) return null;
  const [lower, upper] = pair;
  const wrong: string[] = [];
  for (const d of [1, -1, 2, -2]) if (i.steps + d >= 0 && i.steps + d <= 7) wrong.push(intervalSizeNames[i.steps + d]);
  wrong.push(intervalSizeNames[7 - i.steps]);
  return choice(random, {
    id: `${tag}.num.${scientificName(lower)}.${scientificName(upper)}`, key: `music.interval.size.${i.steps}`,
    prompt: 'Wie heißt dieses Intervall? Zähle beide Töne mit.', correct: i.sizeName, wrong,
    explanation: `Von ${germanName(lower)} bis ${germanName(upper)} sind es ${i.number} Töne: ${i.sizeName}.`, media: MusicKit.staff('treble', [lower, upper]),
  });
};

const numType: MusicMaker = (random, level) => {
  const i = pickInterval(level, random);
  const pair = i && i.steps <= 6 ? naturalPair(i, random) : null;
  if (!i || !pair) return null;
  const [lower, upper] = pair;
  return typed({
    id: `${tag}.numtype.${scientificName(lower)}.${scientificName(upper)}`, key: `music.interval.size.${i.steps}`,
    prompt: `Wie heißt das Intervall von ${germanName(lower)} nach ${germanName(upper)}? Zähle beide Töne mit.`, answer: i.sizeName, mode: 'exact',
    explanation: `${i.number} Töne gezählt: ${i.sizeName}.`, media: MusicKit.staff('treble', [lower, upper]),
  });
};

const pairsNum: MusicMaker = (random) => {
  const chosen = random.shuffled([1, 2, 3, 4, 5, 6]).slice(0, 4);
  const items = chosen.map((steps) => ({ key: `music.interval.size.${steps}`, front: intervalSizeNames[steps], back: `C – ${germanName(n(steps, 4))}` }));
  return makePairs(random, { id: `${tag}.pairsnum.${[...chosen].sort((a, b) => a - b).join('')}`, prompt: 'Welches Intervall liegt über C?', items });
};

const name: MusicMaker = (random, level) => {
  const i = pickInterval(level, random);
  const iname = i ? i.name : null;
  const pair = i && iname ? naturalPair(i, random) : null;
  if (!i || !iname || !pair) return null;
  const [lower, upper] = pair;
  const taught = level >= 3 ? upToSemis[2] : upToSemis[1];
  const wrong = wrongIntervals(i, taught).map((x) => x.name).filter((t): t is string => t !== null);
  return choice(random, {
    id: `${tag}.name.${scientificName(lower)}.${scientificName(upper)}`, key: `music.interval.${i.semitones}`, prompt: 'Wie heißt dieses Intervall?',
    correct: iname, wrong, explanation: sentence(i, lower, upper), media: MusicKit.staff('treble', [lower, upper]),
  });
};

const nameType: MusicMaker = (random, level) => {
  const i = pickInterval(level, random);
  const iname = i ? i.name : null;
  const pair = i && iname ? naturalPair(i, random) : null;
  if (!i || !iname || !pair) return null;
  const [lower, upper] = pair;
  return typed({
    id: `${tag}.nametype.${scientificName(lower)}.${scientificName(upper)}`, key: `music.interval.${i.semitones}`,
    prompt: 'Wie heißt dieses Intervall? Schreibe den ganzen Namen.', answer: iname, alternatives: iname.startsWith('reine ') ? [i.sizeName] : [], mode: 'exact',
    explanation: sentence(i, lower, upper), media: MusicKit.staff('treble', [lower, upper]),
  });
};

const semis: MusicMaker = (random, level) => {
  const i = pickInterval(level, random);
  const iname = i ? i.name : null;
  if (!i || !iname) return null;
  const wrong = [i.semitones + 1, i.semitones - 1, i.semitones + 2, i.semitones - 2].filter((x) => x >= 0).map(String);
  return choice(random, {
    id: `${tag}.semis.${i.semitones}`, key: `music.interval.${i.semitones}`, prompt: `Wie viele Halbtöne hat die ${iname}?`, correct: String(i.semitones), wrong,
    explanation: `Die ${iname} umfasst ${i.semitones} Halbtöne.`,
  });
};

const semisType: MusicMaker = (random, level) => {
  const i = pickInterval(level, random);
  const iname = i ? i.name : null;
  if (!i || !iname) return null;
  return typed({
    id: `${tag}.semistype.${i.semitones}`, key: `music.interval.${i.semitones}`, prompt: `Wie viele Halbtöne hat die ${iname}? Schreibe eine Zahl.`,
    answer: String(i.semitones), mode: 'number', explanation: `Die ${iname} umfasst ${i.semitones} Halbtöne.`,
  });
};

const pairsSemis: MusicMaker = (random, level) => {
  const pool = (level >= 3 ? upToSemis[2] : upToSemis[1]).filter((s) => s > 0);
  const chosen = random.shuffled(pool).slice(0, 4).sort((a, b) => a - b);
  const items: Array<{ key: string; front: string; back: string }> = [];
  for (const s of chosen) {
    const iname = interval(s)?.name;
    if (iname) items.push({ key: `music.interval.${s}`, front: iname, back: s === 1 ? '1 Halbton' : `${s} Halbtöne` });
  }
  return makePairs(random, { id: `${tag}.pairssemis.${chosen.join('-')}`, prompt: 'Wie viele Halbtöne hat das Intervall?', items });
};

const weird = new Set(['Fes', 'Ces', 'Eis', 'His']);

/** A base note and an interval above it whose upper note has a plain name. */
function buildSetup(level: number, random: LearnRandom): { base: Pitch; interval: MusicInterval; upper: Pitch } | null {
  const naturals = [0, 1, 2, 3, 4, 5, 6].map((l) => n(l, 4));
  const signs = [n(2, 4, -1), n(6, 4, -1), n(5, 4, -1), n(3, 4, 1)];
  for (let attempt = 0; attempt < 30; attempt++) {
    const base = MusicKit.pick(level >= 3 ? [...naturals, ...signs] : naturals, random);
    const s = MusicKit.draw(level >= 4 ? upToSemis[2] : freshSemis[level - 1], level >= 4 ? upToSemis[2] : upToSemis[level - 1], level, random);
    const i = s !== null && s > 0 ? interval(s) : null;
    if (!base || !i || i.name === null) continue;
    const upper = i.above(base);
    if (Math.abs(upper.alteration) <= 1 && !weird.has(germanName(upper))) return { base, interval: i, upper };
  }
  return null;
}

const build: MusicMaker = (random, level) => {
  const s = buildSetup(Math.max(level, 2), random);
  const iname = s ? s.interval.name : null;
  if (!s || !iname) return null;
  return MusicKit.typedNote({
    id: `${tag}.build.${germanName(s.base)}.${s.interval.semitones}`, key: `music.interval.${s.interval.semitones}`,
    prompt: `Baue eine ${iname} über ${germanName(s.base)}. Welcher Ton ist das?`, answer: s.upper,
    explanation: `Erst die Buchstaben zählen (${s.interval.number} Töne), dann die Halbtöne anpassen: ${germanName(s.upper)}.`, media: MusicKit.staff('treble', [s.base]),
  });
};

const buildChoice: MusicMaker = (random, level) => {
  const s = buildSetup(Math.max(level, 2), random);
  const iname = s ? s.interval.name : null;
  if (!s || !iname) return null;
  return choice(random, {
    id: `${tag}.buildchoice.${germanName(s.base)}.${s.interval.semitones}`, key: `music.interval.${s.interval.semitones}`,
    prompt: `Welcher Ton liegt eine ${iname} über ${germanName(s.base)}?`, correct: germanName(s.upper), wrong: MusicKit.wrongNames(s.upper, random),
    explanation: `Erst die Buchstaben zählen (${s.interval.number} Töne), dann die Halbtöne anpassen: ${germanName(s.upper)}.`, media: MusicKit.staff('treble', [s.base]),
  });
};

const keyTap: MusicMaker = (random) => {
  const s = buildSetup(2, random);
  const iname = s ? s.interval.name : null;
  if (!s || !iname) return null;
  return pianoKey({
    id: `${tag}.key.${germanName(s.base)}.${s.interval.semitones}`, key: `music.interval.${s.interval.semitones}`,
    prompt: `Tippe den Ton, der eine ${iname} über ${germanName(s.base)} liegt.`, midi: MusicKit.keys(s.upper), solution: germanName(s.upper),
    explanation: `${s.interval.semitones} Halbtöne über ${germanName(s.base)} liegt ${germanName(s.upper)}.`, media: MusicKit.staff('treble', [s.base]),
  });
};

const hear: MusicMaker = (random, level) => {
  const pool = level >= 4 ? hearAll : hearSemis[Math.min(Math.max(level, 2), 3) - 1];
  const s = MusicKit.pick(pool, random);
  const start = MusicKit.pick(Array.from({ length: 13 }, (_, k) => 55 + k), random);
  const i = s === null ? null : interval(s);
  const iname = i ? i.name : null;
  if (s === null || start === null || !iname) return null;
  const wrong = random.shuffled(pool.filter((x) => x !== s)).map((x) => interval(x)?.name).filter((t): t is string => !!t);
  return choice(random, {
    id: `${tag}.hear.${start}.${s}`, key: `music.interval.${s}`, prompt: 'Hör hin: Welches Intervall erklingt?', correct: iname, wrong,
    explanation: `Der zweite Ton liegt ${s} Halbtöne über dem ersten: ${iname}.`, media: { kind: 'tones', tones: tones([start, start + s]) },
  });
};

const invert: MusicMaker = (random) => {
  const pool = upToSemis[2].filter((s) => s >= 1 && s <= 11 && s !== 6);
  const s = MusicKit.pick(pool, random);
  const i = s === null ? null : interval(s);
  const iname = i ? i.name : null;
  const inverted = i ? i.inverted.name : null;
  if (s === null || !i || !iname || !inverted) return null;
  const wrong = wrongIntervals(i.inverted, upToSemis[2]).map((x) => x.name).filter((t): t is string => t !== null);
  wrong.unshift(iname);
  return choice(random, {
    id: `${tag}.invert.${s}`, key: `music.interval.invert.${s}`, prompt: `Welches Intervall entsteht, wenn man die ${iname} umkehrt?`, correct: inverted, wrong,
    explanation: `Intervall und Umkehrung ergeben zusammen eine Oktave: ${i.number} + ${i.inverted.number} = 9 gezählt, 12 Halbtöne.`,
  });
};

const order: MusicMaker = (random, level) => {
  const pool = (level >= 3 ? upToSemis[2] : upToSemis[1]).filter((s) => s > 0);
  const chosen = random.shuffled(pool).slice(0, 4).sort((a, b) => a - b);
  const words = chosen.map((s) => interval(s)?.name).filter((t): t is string => !!t);
  return makeBank(random, {
    id: `${tag}.order.${chosen.join('-')}`, key: 'music.interval.order', prompt: 'Ordne die Intervalle vom kleinsten zum größten.', words,
    explanation: 'Je mehr Halbtöne, desto größer das Intervall.',
  });
};

const facts = () => [
  mf('count', 1, 'Wie zählt man ein Intervall?', { correct: 'Beide Töne zählen mit.', wrong: ['Nur die Töne dazwischen zählen.', 'Nur den oberen Ton zählen.', 'Die Halbtöne zählen.'], explanation: 'C bis E: C, D, E sind drei Töne, also eine Terz.' }),
  mf('prim', 1, 'Wie heißt der Abstand zwischen zwei gleichen Tönen?', { correct: 'Prim', wrong: ['Sekunde', 'Oktave', 'Quinte'], explanation: 'Ein einziger Ton ergibt gezählt die 1: die Prim.' }),
  mf('octave', 1, 'Wie viele Töne umfasst eine Oktave, wenn man beide Töne mitzählt?', { correct: '8', wrong: ['7', '6', '12'], explanation: 'Okto bedeutet acht: C D E F G A H C.' }),
  mf('pure', 2, 'Welche Intervalle heißen rein?', { correct: 'Prim, Quarte, Quinte und Oktave', wrong: ['Sekunde, Terz, Sexte und Septime', 'Terz und Sexte', 'nur die Oktave'], explanation: 'Sekunde, Terz, Sexte und Septime gibt es dagegen klein und groß.' }),
  mf('majorMinor', 2, 'Was unterscheidet eine große von einer kleinen Terz?', { correct: 'Die große Terz ist einen Halbton weiter.', wrong: ['Die große Terz ist einen Ganzton weiter.', 'Die große Terz hat einen Ton mehr.', 'Die kleine Terz ist rein.'], explanation: 'Große Terz: 4 Halbtöne, kleine Terz: 3 Halbtöne.' }),
  mf('tritone', 3, 'Wie viele Halbtöne hat der Tritonus?', { correct: '6', wrong: ['5', '7', '4'], explanation: 'Der Tritonus besteht aus drei Ganztönen, also sechs Halbtönen.' }),
  mf('tritoneWhole', 3, 'Aus wie vielen Ganztönen besteht der Tritonus?', { correct: '3', wrong: ['2', '4', '6'], explanation: 'Tri bedeutet drei.' }),
  mf('inversion', 3, 'Wozu ergänzen sich ein Intervall und seine Umkehrung?', { correct: 'zu einer Oktave', wrong: ['zu einer Quinte', 'zu einer Septime', 'zu einer Prim'], explanation: 'Die große Terz und die kleine Sexte ergeben zusammen eine Oktave.' }),
];

const fact: MusicMaker = (random, level): LearnExercise | null => MusicKit.fact(facts(), level, tag, random);

export const MusicUnit6 = {
  tag, interval, freshSemis, upToSemis, hearSemis, hearAll, facts,
  def: {
    makers: { fact, num, numType, pairsNum, name, nameType, semis, semisType, pairsSemis, build, buildChoice, keyTap, hear, invert, order },
    lessons: [
      ['fact', 'fact', 'num', 'num', 'num', 'num', 'numType', 'numType', 'pairsNum', 'fact'],
      ['fact', 'name', 'name', 'name', 'nameType', 'semis', 'semisType', 'hear', 'hear', 'hear', 'pairsSemis', 'keyTap'],
      ['fact', 'fact', 'name', 'name', 'build', 'build', 'buildChoice', 'hear', 'hear', 'invert', 'order', 'nameType'],
    ],
    practice: ['fact', 'num', 'name', 'nameType', 'semis', 'build', 'buildChoice', 'hear', 'hear', 'pairsSemis', '~', '~'],
    checkpoint: ['fact', 'num', 'name', 'name', 'nameType', 'semis', 'semisType', 'build', 'buildChoice', 'hear', 'hear', 'invert', 'order', 'pairsSemis'],
    review: ['name', 'nameType', 'build', 'hear'],
  } as MusicUnitDef,
};

void midiOf;
