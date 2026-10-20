import type { LearnExercise } from '../exercise';
import { bank as makeBank, choice, pairs as makePairs, typed } from '../exercises';
import type { ExerciseMedia, Pitch } from '../media';
import { LearnRandom } from '../random';
import { MusicKit, MusicMaker, MusicUnitDef, fact as mf } from './kit';
import { MusicKey, germanName, scientificName } from './theory';

const tag = 'music.u08';
const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);

const range = (low: number, high: number): number[] => Array.from({ length: high - low + 1 }, (_, i) => low + i);
const freshCounts: number[][] = [[0, 1, -1, 2, -2], [3, -3, 4, -4], []];
const upTo = (level: number): number[] => (level >= 3 ? range(-4, 4) : freshCounts.slice(0, level).flat());
const countOf = (level: number, random: LearnRandom): number | null => MusicKit.draw(level >= 4 ? range(-4, 4) : freshCounts[level - 1], upTo(level), level, random);

const other = (count: number, deltas: number[]): number[] => deltas.map((d) => count + d).filter((x) => Math.abs(x) <= 5 && x !== count);

const restStaff = (key: number): ExerciseMedia => ({ kind: 'staff', staff: { clef: 'treble', keySignature: key, time: null, notes: [{ pitch: n(6, 4), value: 'whole', isRest: true }], chord: false } });
const noteStaff = (key: number, p: Pitch): ExerciseMedia => ({ kind: 'staff', staff: { clef: 'treble', keySignature: key, time: null, notes: [{ pitch: p, value: 'quarter', isRest: false }], chord: false } });

const readKey: MusicMaker = (random, level) => {
  const c = countOf(level, random);
  if (c === null) return null;
  const wrong = [...other(c, [1, -1]), ...(c === 0 ? [] : [-c]), ...other(c, [2, -2])].map(MusicKey.majorName).concat([MusicKey.minorName(c)]);
  return choice(random, {
    id: `${tag}.read.${c}`, key: `music.key.${c}`, prompt: 'Welche Dur-Tonart gehört zu dieser Vorzeichnung?', correct: MusicKey.majorName(c), wrong,
    explanation: `${MusicKey.majorName(c)} hat ${MusicKit.signCount(c)}.`, media: restStaff(c),
  });
};

const readMinor: MusicMaker = (random, level) => {
  const c = countOf(Math.max(level, 3), random);
  if (c === null) return null;
  const wrong = [...other(c, [1, -1]), ...(c === 0 ? [] : [-c]), ...other(c, [2, -2])].map(MusicKey.minorName).concat([MusicKey.majorName(c)]);
  return choice(random, {
    id: `${tag}.readminor.${c}`, key: `music.key.${c}`, prompt: 'Welche Molltonart gehört zu dieser Vorzeichnung?', correct: MusicKey.minorName(c), wrong,
    explanation: `${MusicKey.minorName(c)} hat ${MusicKit.signCount(c)}: dieselben wie ${MusicKey.majorName(c)}.`, media: restStaff(c),
  });
};

/** A note between E4 and G5 whose sign comes from the key signature. */
function keyedNote(c: number, random: LearnRandom): Pitch | null {
  let pool: Array<[number, number]> = [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5]];
  const affected = pool.filter(([letter]) => MusicKey.alteration(letter, c) !== 0);
  if (affected.length > 0 && random.int(10) < 7) pool = affected;
  const chosen = MusicKit.pick(pool, random);
  return chosen ? n(chosen[0], chosen[1], MusicKey.alteration(chosen[0], c)) : null;
}

const readNote: MusicMaker = (random, level) => {
  const c = countOf(level, random);
  const p = c !== null && c !== 0 ? keyedNote(c, random) : null;
  if (c === null || !p) return null;
  return choice(random, {
    id: `${tag}.note.${c}.${scientificName(p)}`, key: `music.key.note.${c}`, prompt: 'Wie heißt diese Note? Beachte die Vorzeichen am Anfang.', correct: germanName(p),
    wrong: MusicKit.wrongNames(p, random), explanation: `Mit der Vorzeichnung gilt: ${germanName(p)}.`, media: noteStaff(c, p),
  });
};

const readNoteType: MusicMaker = (random, level) => {
  const c = countOf(level, random);
  const p = c !== null && c !== 0 ? keyedNote(c, random) : null;
  if (c === null || !p) return null;
  return MusicKit.typedNote({
    id: `${tag}.notetype.${c}.${scientificName(p)}`, key: `music.key.note.${c}`, prompt: 'Schreibe den Namen dieser Note. Beachte die Vorzeichen am Anfang.', answer: p,
    explanation: `Mit der Vorzeichnung gilt: ${germanName(p)}.`, media: noteStaff(c, p),
  });
};

const keyOfCount: MusicMaker = (random, level) => {
  const c = countOf(level, random);
  if (c === null || c === 0) return null;
  const wrong = [...other(c, [1, -1]), -c, ...other(c, [2, -2])].map(MusicKey.majorName);
  return choice(random, {
    id: `${tag}.keyof.${c}`, key: `music.key.${c}`, prompt: `Welche Dur-Tonart hat ${MusicKit.signCount(c)}?`, correct: MusicKey.majorName(c), wrong,
    explanation: `${MusicKey.majorName(c)} hat ${MusicKit.signCount(c)}.`,
  });
};

const keyOfCountType: MusicMaker = (random, level) => {
  const c = countOf(level, random);
  if (c === null || c === 0) return null;
  return typed({
    id: `${tag}.keyoftype.${c}`, key: `music.key.${c}`, prompt: `Welche Dur-Tonart hat ${MusicKit.signCount(c)}?`, answer: MusicKey.majorName(c), mode: 'exact',
    explanation: `Von C-Dur aus ${Math.abs(c)} Quinte${Math.abs(c) === 1 ? '' : 'n'}${c > 0 ? ' aufwärts.' : ' abwärts.'}`,
  });
};

const countOfKey: MusicMaker = (random, level) => {
  const c = countOf(level, random);
  if (c === null) return null;
  const wrong = [...other(c, [1, -1]), ...(c === 0 ? [] : [-c]), ...other(c, [2, -2])].map(MusicKit.signCount);
  return choice(random, {
    id: `${tag}.count.${c}`, key: `music.key.${c}`, prompt: `Wie viele Vorzeichen hat ${MusicKey.majorName(c)}?`, correct: MusicKit.signCount(c), wrong,
    explanation: c === 0 ? 'C-Dur hat keine Vorzeichen.' : `Es sind: ${MusicKit.signNames(c)}.`,
  });
};

const orderBank: MusicMaker = (random) => {
  const sharps = random.bool();
  const names = MusicKey.accidentals(sharps ? 4 : -4).map(germanName);
  return makeBank(random, {
    id: `${tag}.order.${sharps ? 'sharps' : 'flats'}`, key: `music.key.order.${sharps ? 'sharps' : 'flats'}`,
    prompt: `Lege die ersten vier ${sharps ? 'Kreuze' : 'Be'} in der Reihenfolge der Vorzeichnung.`, words: names,
    explanation: sharps ? 'Kreuze: Fis, Cis, Gis, Dis, Ais, Eis, His.' : 'Be: B, Es, As, Des, Ges, Ces, Fes.',
  });
};

const relMinor: MusicMaker = (random, level) => {
  const c = countOf(Math.max(level, 3), random);
  if (c === null) return null;
  return typed({
    id: `${tag}.relminor.${c}`, key: `music.key.rel.${c}`, prompt: `Welche Molltonart ist die Paralleltonart von ${MusicKey.majorName(c)}?`, answer: MusicKey.minorName(c), mode: 'exact',
    explanation: `Der Grundton liegt eine kleine Terz tiefer; beide haben ${MusicKit.signCount(c)}.`,
  });
};

const relMinorChoice: MusicMaker = (random, level) => {
  const c = countOf(Math.max(level, 3), random);
  if (c === null) return null;
  const sameTonic = `${germanName(MusicKey.majorTonic(c))}-Moll`;
  const wrong = [sameTonic, ...[...other(c, [1, -1]), ...other(c, [2, -2])].map(MusicKey.minorName)];
  return choice(random, {
    id: `${tag}.relminorchoice.${c}`, key: `music.key.rel.${c}`, prompt: `Welche Molltonart ist die Paralleltonart von ${MusicKey.majorName(c)}?`, correct: MusicKey.minorName(c), wrong,
    explanation: `Der Grundton liegt eine kleine Terz tiefer; beide haben ${MusicKit.signCount(c)}.`,
  });
};

const relMajor: MusicMaker = (random, level) => {
  const c = countOf(Math.max(level, 3), random);
  if (c === null) return null;
  return typed({
    id: `${tag}.relmajor.${c}`, key: `music.key.rel.${c}`, prompt: `Zu welcher Durtonart gehört ${MusicKey.minorName(c)} als Paralleltonart?`, answer: MusicKey.majorName(c), mode: 'exact',
    explanation: `Der Grundton der Durtonart liegt eine kleine Terz höher; beide haben ${MusicKit.signCount(c)}.`,
  });
};

const circle: MusicMaker = (random, level) => {
  const up = random.bool();
  const c = countOf(Math.max(level, 2), random);
  if (c === null || Math.abs(c + (up ? 1 : -1)) > 4) return null;
  const answer = c + (up ? 1 : -1);
  const wrong = [c + (up ? -1 : 1), c + (up ? 2 : -2), c + (up ? -2 : 2)].filter((x) => Math.abs(x) <= 5).map(MusicKey.majorName);
  return choice(random, {
    id: `${tag}.circle.${c}.${up ? 'up' : 'down'}`, key: `music.key.circle.${c}`,
    prompt: `Welche Tonart liegt im Quintenzirkel eine Quinte ${up ? 'über' : 'unter'} ${MusicKey.majorName(c)}?`, correct: MusicKey.majorName(answer), wrong,
    explanation: `Eine Quinte ${up ? 'aufwärts bringt ein Kreuz mehr' : 'abwärts bringt ein Be mehr'}: ${MusicKey.majorName(answer)} hat ${MusicKit.signCount(answer)}.`,
  });
};

const circleBank: MusicMaker = (random) => {
  const up = random.bool();
  const words = range(0, 3).map((i) => MusicKey.majorName(up ? i : -i));
  const extra = up ? [MusicKey.majorName(-1), MusicKey.majorName(-2)] : [MusicKey.majorName(1), MusicKey.majorName(2)];
  return makeBank(random, {
    id: `${tag}.circlebank.${up ? 'up' : 'down'}`, key: 'music.key.circle', prompt: `Lege die Tonarten in der Reihenfolge des Quintenzirkels, von C-Dur ${up ? 'aufwärts' : 'abwärts'}.`,
    words, extra, explanation: `Jede Quinte ${up ? 'aufwärts bringt ein Kreuz mehr' : 'abwärts bringt ein Be mehr'}.`,
  });
};

const pairsKeys: MusicMaker = (random, level) => {
  const pool = upTo(level === 3 ? 4 : level).filter((x) => x !== 0 || level >= 3);
  const chosen = random.shuffled(pool).slice(0, 4);
  if (chosen.length !== 4) return null;
  return makePairs(random, {
    id: `${tag}.pairs.${[...chosen].sort((a, b) => a - b).join('_')}`, prompt: 'Welche Vorzeichen hat die Tonart?',
    items: chosen.map((x) => ({ key: `music.key.${x}`, front: MusicKey.majorName(x), back: MusicKit.signCount(x) })),
  });
};

const pairsRel: MusicMaker = (random) => {
  const chosen = random.shuffled(range(-4, 4)).slice(0, 4);
  return makePairs(random, {
    id: `${tag}.pairsrel.${[...chosen].sort((a, b) => a - b).join('_')}`, prompt: 'Welche Molltonart ist die Paralleltonart?',
    items: chosen.map((x) => ({ key: `music.key.rel.${x}`, front: MusicKey.majorName(x), back: MusicKey.minorName(x) })),
  });
};

const facts = () => [
  mf('what', 1, 'Was zeigt die Vorzeichnung am Anfang eines Stücks?', { correct: 'die Tonart', wrong: ['das Tempo', 'die Taktart', 'die Lautstärke'], explanation: 'Die Vorzeichen am Anfang gelten für das ganze Stück.' }),
  mf('firstSharp', 1, 'Welches Kreuz steht in der Vorzeichnung zuerst?', { correct: 'Fis', wrong: ['Cis', 'Gis', 'B'], explanation: 'Die Kreuze folgen: Fis, Cis, Gis, Dis, Ais, Eis, His.' }),
  mf('firstFlat', 1, 'Welches Be steht in der Vorzeichnung zuerst?', { correct: 'B', wrong: ['Es', 'As', 'Fis'], explanation: 'Die Be folgen: B, Es, As, Des, Ges, Ces, Fes.' }),
  mf('none', 1, 'Welche Durtonart hat keine Vorzeichen?', { correct: 'C-Dur', wrong: ['A-Dur', 'G-Dur', 'F-Dur'], explanation: 'C-Dur nutzt nur weiße Tasten.' }),
  mf('circleUp', 2, 'Was ändert sich im Quintenzirkel bei jeder Quinte aufwärts?', { correct: 'Ein Kreuz kommt dazu (oder ein Be fällt weg).', wrong: ['Ein Be kommt dazu (oder ein Kreuz fällt weg).', 'Zwei Kreuze kommen dazu.', 'Es ändert sich nichts.'], explanation: 'C-Dur, G-Dur (1 Kreuz), D-Dur (2 Kreuze) ...' }),
  mf('circleDown', 2, 'Was ändert sich im Quintenzirkel bei jeder Quinte abwärts?', { correct: 'Ein Be kommt dazu (oder ein Kreuz fällt weg).', wrong: ['Ein Kreuz kommt dazu (oder ein Be fällt weg).', 'Zwei Be kommen dazu.', 'Es ändert sich nichts.'], explanation: 'C-Dur, F-Dur (1 Be), B-Dur (2 Be) ...' }),
  mf('parallel', 3, 'Was haben Paralleltonarten gemeinsam?', { correct: 'dieselben Vorzeichen', wrong: ['denselben Grundton', 'dieselbe Stufenfolge aus Ganz- und Halbtönen', 'denselben Dreiklang'], explanation: 'C-Dur und A-Moll haben beide keine Vorzeichen.' }),
  mf('terz', 3, 'Wo liegt der Grundton der Paralleltonart in Moll?', {
    correct: 'eine kleine Terz unter dem Grundton der Dur-Tonart',
    wrong: ['eine große Terz unter dem Grundton der Dur-Tonart', 'eine Quinte unter dem Grundton der Dur-Tonart', 'eine kleine Terz über dem Grundton der Dur-Tonart'],
    explanation: 'C–A ist eine kleine Terz abwärts.',
  }),
  mf('aMinor', 3, 'Welche Molltonart hat keine Vorzeichen?', { correct: 'A-Moll', wrong: ['E-Moll', 'D-Moll', 'C-Moll'], explanation: 'A-Moll ist die Paralleltonart von C-Dur.' }),
];

const fact: MusicMaker = (random, level): LearnExercise | null => MusicKit.fact(facts(), level, tag, random);

export const MusicUnit8 = {
  tag, freshCounts, upTo, facts,
  def: {
    makers: { fact, readKey, readMinor, readNote, readNoteType, keyOfCount, keyOfCountType, countOfKey, orderBank, relMinor, relMinorChoice, relMajor, circle, circleBank, pairsKeys, pairsRel },
    lessons: [
      ['fact', 'fact', 'readKey', 'readKey', 'readKey', 'readNote', 'readNote', 'countOfKey', 'orderBank', 'keyOfCountType', 'readNoteType'],
      ['fact', 'fact', 'readKey', 'readKey', 'readNote', 'countOfKey', 'keyOfCount', 'circle', 'circleBank', 'pairsKeys', 'keyOfCountType', 'readNoteType'],
      ['fact', 'fact', 'relMinorChoice', 'relMinorChoice', 'readMinor', 'relMinor', 'relMinor', 'relMajor', 'pairsRel', 'circle', 'readKey'],
    ],
    practice: ['fact', 'readKey', 'readMinor', 'readNote', 'countOfKey', 'keyOfCountType', 'relMinor', 'circle', 'circleBank', 'pairsKeys', '~', '~'],
    checkpoint: ['fact', 'fact', 'readKey', 'readKey', 'readMinor', 'readNote', 'readNoteType', 'countOfKey', 'keyOfCountType', 'relMinor', 'relMajor', 'circle', 'pairsKeys', 'pairsRel'],
    review: ['readKey', 'countOfKey', 'relMinorChoice', 'circle'],
  } as MusicUnitDef,
};
