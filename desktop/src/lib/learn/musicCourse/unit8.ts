// Unit 8: key signatures, the circle of fifths and relative minor keys.
// A port of Lernwerk/Services/Learn/Music/MusicUnit8.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import { ExerciseMedia } from '../media';
import { type Pitch, staffNote, staffSpec } from '../music';
import type { LearnRandom } from '../random';
import { MusicKey } from './harmony';
import { fact as makeFact, type MusicFact, MusicKit, type MusicUnitDef, randomBool } from './kit';
import { germanName, scientificName } from './theory';

const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);
const tag = 'music.u08';

const range = (lo: number, hi: number): number[] => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const numeric = (a: number, b: number): number => a - b;

export const unit8FreshCounts: number[][] = [[0, 1, -1, 2, -2], [3, -3, 4, -4], []];
const upTo = (level: number): number[] => (level >= 3 ? range(-4, 4) : unit8FreshCounts.slice(0, level).flat());

function count(level: number, random: LearnRandom): number | undefined {
  return MusicKit.draw(level >= 4 ? range(-4, 4) : unit8FreshCounts[level - 1], upTo(level), level, random);
}

function other(c: number, deltas: number[]): number[] {
  return deltas.map((d) => c + d).filter((x) => Math.abs(x) <= 5 && x !== c);
}

function restStaff(key: number): ExerciseMedia {
  return ExerciseMedia.staff(staffSpec('treble', [staffNote(n(6, 4), 'whole', true)], { keySignature: key, time: null }));
}

const majorName = (c: number): string => MusicKey.majorName(c);
const minorName = (c: number): string => MusicKey.minorName(c);

function readKey(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(level, random);
  if (c === undefined) return null;
  const wrong = [...other(c, [1, -1]), ...(c === 0 ? [] : [-c]), ...other(c, [2, -2])].map(majorName).concat([minorName(c)]);
  return Exercises.choice(
    {
      id: `${tag}.read.${c}`,
      key: `music.key.${c}`,
      prompt: 'Welche Dur-Tonart gehört zu dieser Vorzeichnung?',
      correct: majorName(c),
      wrong,
      explanation: `${majorName(c)} hat ${MusicKit.signCount(c)}.`,
      media: restStaff(c),
    },
    random,
  );
}

function readMinor(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(Math.max(level, 3), random);
  if (c === undefined) return null;
  const wrong = [...other(c, [1, -1]), ...(c === 0 ? [] : [-c]), ...other(c, [2, -2])].map(minorName).concat([majorName(c)]);
  return Exercises.choice(
    {
      id: `${tag}.readminor.${c}`,
      key: `music.key.${c}`,
      prompt: 'Welche Molltonart gehört zu dieser Vorzeichnung?',
      correct: minorName(c),
      wrong,
      explanation: `${minorName(c)} hat ${MusicKit.signCount(c)}: dieselben wie ${majorName(c)}.`,
      media: restStaff(c),
    },
    random,
  );
}

/** A note between E4 and G5 whose sign comes from the key signature. */
function keyedNote(c: number, random: LearnRandom): Pitch | undefined {
  let pool: Array<[number, number]> = [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5]];
  const affected = pool.filter(([l]) => MusicKey.alteration(l, c) !== 0);
  if (affected.length > 0 && random.int(0, 10) < 7) pool = affected;
  const entry = random.randomElement(pool);
  if (!entry) return undefined;
  return n(entry[0], entry[1], MusicKey.alteration(entry[0], c));
}

function noteMedia(c: number, p: Pitch): ExerciseMedia {
  return ExerciseMedia.staff(staffSpec('treble', [staffNote(p)], { keySignature: c }));
}

function readNote(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(level, random);
  if (c === undefined || c === 0) return null;
  const p = keyedNote(c, random);
  if (!p) return null;
  const wrong = MusicKit.wrongNames(p, false, random);
  return Exercises.choice(
    {
      id: `${tag}.note.${c}.${scientificName(p)}`,
      key: `music.key.note.${c}`,
      prompt: 'Wie heißt diese Note? Beachte die Vorzeichen am Anfang.',
      correct: germanName(p),
      wrong,
      explanation: `Mit der Vorzeichnung gilt: ${germanName(p)}.`,
      media: noteMedia(c, p),
    },
    random,
  );
}

function readNoteType(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(level, random);
  if (c === undefined || c === 0) return null;
  const p = keyedNote(c, random);
  if (!p) return null;
  return MusicKit.typedNote({
    id: `${tag}.notetype.${c}.${scientificName(p)}`,
    key: `music.key.note.${c}`,
    prompt: 'Schreibe den Namen dieser Note. Beachte die Vorzeichen am Anfang.',
    answer: p,
    explanation: `Mit der Vorzeichnung gilt: ${germanName(p)}.`,
    media: noteMedia(c, p),
  });
}

function keyOfCount(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(level, random);
  if (c === undefined || c === 0) return null;
  const wrong = [...other(c, [1, -1]), -c, ...other(c, [2, -2])].map(majorName);
  return Exercises.choice(
    {
      id: `${tag}.keyof.${c}`,
      key: `music.key.${c}`,
      prompt: `Welche Dur-Tonart hat ${MusicKit.signCount(c)}?`,
      correct: majorName(c),
      wrong,
      explanation: `${majorName(c)} hat ${MusicKit.signCount(c)}.`,
    },
    random,
  );
}

function keyOfCountType(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(level, random);
  if (c === undefined || c === 0) return null;
  return Exercises.typed({
    id: `${tag}.keyoftype.${c}`,
    key: `music.key.${c}`,
    prompt: `Welche Dur-Tonart hat ${MusicKit.signCount(c)}?`,
    answer: majorName(c),
    mode: 'exact',
    explanation: `Von C-Dur aus ${Math.abs(c)} Quinte` + (Math.abs(c) === 1 ? '' : 'n') + (c > 0 ? ' aufwärts.' : ' abwärts.'),
  });
}

function countOfKey(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(level, random);
  if (c === undefined) return null;
  const wrong = [...other(c, [1, -1]), ...(c === 0 ? [] : [-c]), ...other(c, [2, -2])].map((x) => MusicKit.signCount(x));
  return Exercises.choice(
    {
      id: `${tag}.count.${c}`,
      key: `music.key.${c}`,
      prompt: `Wie viele Vorzeichen hat ${majorName(c)}?`,
      correct: MusicKit.signCount(c),
      wrong,
      explanation: c === 0 ? 'C-Dur hat keine Vorzeichen.' : `Es sind: ${MusicKit.signNames(c)}.`,
    },
    random,
  );
}

function orderBank(random: LearnRandom, _level: number): LearnExercise | null {
  const sharps = randomBool(random);
  const names = MusicKey.accidentals(sharps ? 4 : -4).map(germanName);
  return Exercises.bank(
    {
      id: `${tag}.order.${sharps ? 'sharps' : 'flats'}`,
      key: `music.key.order.${sharps ? 'sharps' : 'flats'}`,
      prompt: `Lege die ersten vier ${sharps ? 'Kreuze' : 'Be'} in der Reihenfolge der Vorzeichnung.`,
      words: names,
      explanation: sharps ? 'Kreuze: Fis, Cis, Gis, Dis, Ais, Eis, His.' : 'Be: B, Es, As, Des, Ges, Ces, Fes.',
    },
    random,
  );
}

function relMinor(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(Math.max(level, 3), random);
  if (c === undefined) return null;
  return Exercises.typed({
    id: `${tag}.relminor.${c}`,
    key: `music.key.rel.${c}`,
    prompt: `Welche Molltonart ist die Paralleltonart von ${majorName(c)}?`,
    answer: minorName(c),
    mode: 'exact',
    explanation: `Der Grundton liegt eine kleine Terz tiefer; beide haben ${MusicKit.signCount(c)}.`,
  });
}

function relMinorChoice(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(Math.max(level, 3), random);
  if (c === undefined) return null;
  const sameTonic = germanName(MusicKey.majorTonic(c)) + '-Moll';
  const wrong = [sameTonic, ...[...other(c, [1, -1]), ...other(c, [2, -2])].map(minorName)];
  return Exercises.choice(
    {
      id: `${tag}.relminorchoice.${c}`,
      key: `music.key.rel.${c}`,
      prompt: `Welche Molltonart ist die Paralleltonart von ${majorName(c)}?`,
      correct: minorName(c),
      wrong,
      explanation: `Der Grundton liegt eine kleine Terz tiefer; beide haben ${MusicKit.signCount(c)}.`,
    },
    random,
  );
}

function relMajor(random: LearnRandom, level: number): LearnExercise | null {
  const c = count(Math.max(level, 3), random);
  if (c === undefined) return null;
  return Exercises.typed({
    id: `${tag}.relmajor.${c}`,
    key: `music.key.rel.${c}`,
    prompt: `Zu welcher Durtonart gehört ${minorName(c)} als Paralleltonart?`,
    answer: majorName(c),
    mode: 'exact',
    explanation: `Der Grundton der Durtonart liegt eine kleine Terz höher; beide haben ${MusicKit.signCount(c)}.`,
  });
}

function circle(random: LearnRandom, level: number): LearnExercise | null {
  const up = randomBool(random);
  const c = count(Math.max(level, 2), random);
  if (c === undefined || Math.abs(c + (up ? 1 : -1)) > 4) return null;
  const answer = c + (up ? 1 : -1);
  const wrong = [c + (up ? -1 : 1), c + (up ? 2 : -2), c + (up ? -2 : 2)].filter((x) => Math.abs(x) <= 5).map(majorName);
  return Exercises.choice(
    {
      id: `${tag}.circle.${c}.${up ? 'up' : 'down'}`,
      key: `music.key.circle.${c}`,
      prompt: `Welche Tonart liegt im Quintenzirkel eine Quinte ${up ? 'über' : 'unter'} ${majorName(c)}?`,
      correct: majorName(answer),
      wrong,
      explanation: `Eine Quinte ${up ? 'aufwärts bringt ein Kreuz mehr' : 'abwärts bringt ein Be mehr'}: ${majorName(answer)} hat ${MusicKit.signCount(answer)}.`,
    },
    random,
  );
}

function circleBank(random: LearnRandom, _level: number): LearnExercise | null {
  const up = randomBool(random);
  const words = range(0, 3).map((i) => majorName(up ? i : -i));
  const extra = up ? [majorName(-1), majorName(-2)] : [majorName(1), majorName(2)];
  return Exercises.bank(
    {
      id: `${tag}.circlebank.${up ? 'up' : 'down'}`,
      key: 'music.key.circle',
      prompt: `Lege die Tonarten in der Reihenfolge des Quintenzirkels, von C-Dur ${up ? 'aufwärts' : 'abwärts'}.`,
      words,
      extra,
      explanation: `Jede Quinte ${up ? 'aufwärts bringt ein Kreuz mehr' : 'abwärts bringt ein Be mehr'}.`,
    },
    random,
  );
}

function pairsKeys(random: LearnRandom, level: number): LearnExercise | null {
  const pool = upTo(level === 3 ? 4 : level).filter((x) => x !== 0 || level >= 3);
  const chosen = random.shuffled(pool).slice(0, 4);
  if (chosen.length !== 4) return null;
  return Exercises.pairs(
    {
      id: `${tag}.pairs.` + chosen.slice().sort(numeric).map(String).join('_'),
      prompt: 'Welche Vorzeichen hat die Tonart?',
      items: chosen.map((x) => ({ key: `music.key.${x}`, front: majorName(x), back: MusicKit.signCount(x) })),
    },
    random,
  );
}

function pairsRel(random: LearnRandom, _level: number): LearnExercise | null {
  const chosen = random.shuffled(range(-4, 4)).slice(0, 4);
  return Exercises.pairs(
    {
      id: `${tag}.pairsrel.` + chosen.slice().sort(numeric).map(String).join('_'),
      prompt: 'Welche Molltonart ist die Paralleltonart?',
      items: chosen.map((x) => ({ key: `music.key.rel.${x}`, front: majorName(x), back: minorName(x) })),
    },
    random,
  );
}

function fact(random: LearnRandom, level: number): LearnExercise | null {
  return MusicKit.fact(unit8Facts, level, tag, random);
}

export const unit8Facts: MusicFact[] = [
  makeFact("what", 1, "Was zeigt die Vorzeichnung am Anfang eines Stücks?", "die Tonart", ["das Tempo", "die Taktart", "die Lautstärke"], "Die Vorzeichen am Anfang gelten für das ganze Stück."),
  makeFact("firstSharp", 1, "Welches Kreuz steht in der Vorzeichnung zuerst?", "Fis", ["Cis", "Gis", "B"], "Die Kreuze folgen: Fis, Cis, Gis, Dis, Ais, Eis, His."),
  makeFact("firstFlat", 1, "Welches Be steht in der Vorzeichnung zuerst?", "B", ["Es", "As", "Fis"], "Die Be folgen: B, Es, As, Des, Ges, Ces, Fes."),
  makeFact("none", 1, "Welche Durtonart hat keine Vorzeichen?", "C-Dur", ["A-Dur", "G-Dur", "F-Dur"], "C-Dur nutzt nur weiße Tasten."),
  makeFact("circleUp", 2, "Was ändert sich im Quintenzirkel bei jeder Quinte aufwärts?", "Ein Kreuz kommt dazu (oder ein Be fällt weg).", ["Ein Be kommt dazu (oder ein Kreuz fällt weg).", "Zwei Kreuze kommen dazu.", "Es ändert sich nichts."], "C-Dur, G-Dur (1 Kreuz), D-Dur (2 Kreuze) ..."),
  makeFact("circleDown", 2, "Was ändert sich im Quintenzirkel bei jeder Quinte abwärts?", "Ein Be kommt dazu (oder ein Kreuz fällt weg).", ["Ein Kreuz kommt dazu (oder ein Be fällt weg).", "Zwei Be kommen dazu.", "Es ändert sich nichts."], "C-Dur, F-Dur (1 Be), B-Dur (2 Be) ..."),
  makeFact("parallel", 3, "Was haben Paralleltonarten gemeinsam?", "dieselben Vorzeichen", ["denselben Grundton", "dieselbe Stufenfolge aus Ganz- und Halbtönen", "denselben Dreiklang"], "C-Dur und A-Moll haben beide keine Vorzeichen."),
  makeFact("terz", 3, "Wo liegt der Grundton der Paralleltonart in Moll?", "eine kleine Terz unter dem Grundton der Dur-Tonart", ["eine große Terz unter dem Grundton der Dur-Tonart", "eine Quinte unter dem Grundton der Dur-Tonart", "eine kleine Terz über dem Grundton der Dur-Tonart"], "C–A ist eine kleine Terz abwärts."),
  makeFact("aMinor", 3, "Welche Molltonart hat keine Vorzeichen?", "A-Moll", ["E-Moll", "D-Moll", "C-Moll"], "A-Moll ist die Paralleltonart von C-Dur."),
];


export const unit8Def: MusicUnitDef = {
  makers: {
    fact, readKey, readMinor, readNote, readNoteType, keyOfCount, keyOfCountType, countOfKey, orderBank, relMinor, relMinorChoice, relMajor,
    circle, circleBank, pairsKeys, pairsRel,
  },
  lessons: [
    ['fact', 'fact', 'readKey', 'readKey', 'readKey', 'readNote', 'readNote', 'countOfKey', 'orderBank', 'keyOfCountType', 'readNoteType'],
    ['fact', 'fact', 'readKey', 'readKey', 'readNote', 'countOfKey', 'keyOfCount', 'circle', 'circleBank', 'pairsKeys', 'keyOfCountType', 'readNoteType'],
    ['fact', 'fact', 'relMinorChoice', 'relMinorChoice', 'readMinor', 'relMinor', 'relMinor', 'relMajor', 'pairsRel', 'circle', 'readKey'],
  ],
  practice: ['fact', 'readKey', 'readMinor', 'readNote', 'countOfKey', 'keyOfCountType', 'relMinor', 'circle', 'circleBank', 'pairsKeys', '~', '~'],
  checkpoint: ['fact', 'fact', 'readKey', 'readKey', 'readMinor', 'readNote', 'readNoteType', 'countOfKey', 'keyOfCountType', 'relMinor', 'relMajor', 'circle', 'pairsKeys', 'pairsRel'],
  review: ['readKey', 'countOfKey', 'relMinorChoice', 'circle'],
};
