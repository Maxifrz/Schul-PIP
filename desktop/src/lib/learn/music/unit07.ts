import type { LearnExercise } from '../exercise';
import { bank as makeBank, choice, pairs as makePairs, pianoKey } from '../exercises';
import { Pitch, midiOf, tones } from '../media';
import { LearnRandom } from '../random';
import { MusicKit, MusicMaker, MusicUnitDef, fact as mf } from './kit';
import { MusicTriad, germanName } from './theory';

const tag = 'music.u07';
const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);
const major = (root: Pitch) => new MusicTriad(root, 'major');
const minor = (root: Pitch) => new MusicTriad(root, 'minor');

/** The triads of each lesson: major on C, G, F, D; minor on A, E, D; then flats and a few more. */
const fresh: MusicTriad[][] = [
  [major(n(0, 4)), major(n(4, 4)), major(n(3, 4)), major(n(1, 4))],
  [minor(n(5, 4)), minor(n(2, 4)), minor(n(1, 4))],
  [major(n(2, 4, -1)), major(n(6, 4, -1)), major(n(5, 4, -1)), minor(n(4, 4)), minor(n(0, 4)), minor(n(3, 4))],
];
const all = (): MusicTriad[] => fresh.flat();
const upTo = (level: number): MusicTriad[] => (level >= 4 ? all() : fresh.slice(0, level).flat());
const triadOf = (level: number, random: LearnRandom): MusicTriad | null => MusicKit.draw(level >= 4 ? all() : fresh[level - 1], upTo(level), level, random);

const toneText = (t: MusicTriad): string => t.notes.map(germanName).join(' – ');
const kindWord = (t: MusicTriad): string => (t.quality === 'major' ? 'Dur' : 'Moll');
const otherQuality = (t: MusicTriad) => (t.quality === 'major' ? 'minor' as const : 'major' as const);

const staffName: MusicMaker = (random, level) => {
  const t = triadOf(level, random);
  if (!t) return null;
  const wrong: string[] = [];
  if (level >= 2) wrong.push(new MusicTriad(t.root, otherQuality(t)).name);
  wrong.push(...random.shuffled((level >= 2 ? all() : fresh[0]).filter((x) => x.name !== t.name)).map((x) => x.name));
  return choice(random, {
    id: `${tag}.staff.${t.name}`, key: `music.triad.${t.name}`, prompt: 'Welcher Dreiklang ist das?', correct: t.name, wrong,
    explanation: `Die Töne sind ${toneText(t)}.`, media: MusicKit.staff('treble', t.notes, { chord: true }),
  });
};

const staffKind: MusicMaker = (random, level) => {
  const t = triadOf(level, random);
  if (!t) return null;
  const third = midiOf(t.notes[1]) - midiOf(t.notes[0]);
  return choice(random, {
    id: `${tag}.kind.${t.name}`, key: `music.triad.${t.name}`, prompt: 'Ist das ein Dur- oder ein Moll-Dreiklang?', correct: kindWord(t),
    wrong: [t.quality === 'major' ? 'Moll' : 'Dur'],
    explanation: `Die Terz liegt ${third} Halbtöne über dem Grundton: ${t.quality === 'major' ? 'große Terz, Dur.' : 'kleine Terz, Moll.'}`,
    media: MusicKit.staff('treble', t.notes, { chord: true }),
  });
};

const hearKind: MusicMaker = (random, level) => {
  const t = triadOf(Math.max(level, 2), random);
  const octave = MusicKit.pick([3, 4], random);
  if (!t || octave === null) return null;
  const root = n(t.root.letter, octave, t.root.alteration);
  const notes = new MusicTriad(root, t.quality).notes;
  return choice(random, {
    id: `${tag}.hear.${t.name}.${octave}`, key: `music.triad.${t.name}`, prompt: 'Hör hin: Dur oder Moll?', correct: kindWord(t),
    wrong: [t.quality === 'major' ? 'Moll' : 'Dur'],
    explanation: t.quality === 'major' ? 'Dur klingt hell: Die Terz ist groß.' : 'Moll klingt dunkler: Die Terz ist klein.',
    media: { kind: 'tones', tones: tones(notes.map(midiOf), true) },
  });
};

const missing: MusicMaker = (random, level) => {
  const t = triadOf(level, random);
  const hidden = MusicKit.pick([0, 1, 2], random);
  if (!t || hidden === null) return null;
  const notes = t.notes;
  const shown = notes.map((p, i) => (i === hidden ? '?' : germanName(p))).join(' – ');
  return choice(random, {
    id: `${tag}.missing.${t.name}.${hidden}`, key: `music.triad.${t.name}`, prompt: `${t.name}: ${shown}. Welcher Ton fehlt?`, correct: germanName(notes[hidden]),
    wrong: MusicKit.wrongNames(notes[hidden], random), explanation: `${t.name} besteht aus ${toneText(t)}.`,
  });
};

const typedPart: MusicMaker = (random, level) => {
  const t = triadOf(level, random);
  const part = MusicKit.pick([1, 2], random);
  if (!t || part === null) return null;
  return MusicKit.typedNote({
    id: `${tag}.part.${t.name}.${part}`, key: `music.triad.${t.name}`, prompt: `Wie heißt die ${part === 1 ? 'Terz' : 'Quinte'} des ${t.name}-Dreiklangs?`,
    answer: t.notes[part], explanation: `${t.name} besteht aus ${toneText(t)}.`,
  });
};

const buildBank: MusicMaker = (random, level) => {
  const t = triadOf(level, random);
  if (!t) return null;
  const notes = t.notes;
  const otherThird = new MusicTriad(t.root, otherQuality(t)).notes[1];
  const extra = [germanName(otherThird), ...MusicKit.wrongNames(notes[2], random).slice(0, 1)];
  return makeBank(random, {
    id: `${tag}.bank.${t.name}`, key: `music.triad.${t.name}`, prompt: `Baue den ${t.name}-Dreiklang. Lege Grundton, Terz und Quinte der Reihe nach.`,
    words: notes.map(germanName), extra, explanation: 'Dur: große Terz und kleine Terz. Moll: kleine Terz und große Terz.',
  });
};

const pairs: MusicMaker = (random, level) => {
  const pool = upTo(level === 3 ? 3 : level);
  const chosen = random.shuffled(pool).slice(0, 4);
  if (chosen.length !== 4) return null;
  return makePairs(random, {
    id: `${tag}.pairs.${chosen.map((t) => t.name).sort().join('-')}`, prompt: 'Welche Töne gehören zum Dreiklang?',
    items: chosen.map((t) => ({ key: `music.triad.${t.name}`, front: t.name, back: toneText(t) })),
  });
};

const key: MusicMaker = (random, level) => {
  const t = triadOf(level, random);
  const part = MusicKit.pick([0, 1, 2], random);
  if (!t || part === null) return null;
  const word = ['den Grundton', 'die Terz', 'die Quinte'][part];
  return pianoKey({
    id: `${tag}.key.${t.name}.${part}`, key: `music.triad.${t.name}`, prompt: `Tippe ${word} des ${t.name}-Dreiklangs.`, midi: MusicKit.keys(t.notes[part]),
    solution: germanName(t.notes[part]), explanation: `${t.name} besteht aus ${toneText(t)}.`,
  });
};

const facts = () => [
  mf('names', 1, 'Wie heißen die drei Töne eines Dreiklangs?', { correct: 'Grundton, Terz, Quinte', wrong: ['Prim, Sekunde, Terz', 'Grundton, Quarte, Sexte', 'Terz, Quinte, Septime'], explanation: 'Die Töne stehen im Abstand von Terzen übereinander.' }),
  mf('major', 1, 'Wie ist ein Dur-Dreiklang aufgebaut?', { correct: 'große Terz und darüber kleine Terz', wrong: ['kleine Terz und darüber große Terz', 'zwei große Terzen', 'zwei kleine Terzen'], explanation: 'C–E ist eine große Terz, E–G eine kleine.' }),
  mf('cmajor', 1, 'Welche Töne hat der C-Dur-Dreiklang?', { correct: 'C, E, G', wrong: ['C, Es, G', 'C, F, G', 'C, E, A'], explanation: 'Jeder zweite Buchstabe: C E G.' }),
  mf('minor', 2, 'Wie ist ein Moll-Dreiklang aufgebaut?', { correct: 'kleine Terz und darüber große Terz', wrong: ['große Terz und darüber kleine Terz', 'zwei große Terzen', 'zwei kleine Terzen'], explanation: 'A–C ist eine kleine Terz, C–E eine große.' }),
  mf('change', 2, 'Wie wird aus einem Dur-Dreiklang ein Moll-Dreiklang?', { correct: 'Die Terz wird einen Halbton tiefer.', wrong: ['Die Quinte wird einen Halbton tiefer.', 'Der Grundton wird einen Halbton höher.', 'Die Terz wird einen Halbton höher.'], explanation: 'C E G wird zu C Es G.' }),
  mf('fifth', 2, 'Wie viele Halbtöne liegen in einem Dur- oder Moll-Dreiklang zwischen Grundton und Quinte?', { correct: '7', wrong: ['5', '6', '8'], explanation: 'Die Quinte ist rein und hat sieben Halbtöne.' }),
  mf('esdur', 3, 'Welche Töne hat der Es-Dur-Dreiklang?', { correct: 'Es, G, B', wrong: ['Es, G, H', 'Es, Ges, B', 'E, G, B'], explanation: 'Es–G ist eine große Terz, G–B eine kleine.' }),
  mf('fminor', 3, 'Welche Töne hat der F-Moll-Dreiklang?', { correct: 'F, As, C', wrong: ['F, A, C', 'F, As, Ces', 'F, G, C'], explanation: 'F–As ist eine kleine Terz, As–C eine große.' }),
  mf('gminor', 3, 'Welche Töne hat der G-Moll-Dreiklang?', { correct: 'G, B, D', wrong: ['G, H, D', 'G, B, Des', 'G, A, D'], explanation: 'G–B ist eine kleine Terz, B–D eine große.' }),
];

const fact: MusicMaker = (random, level): LearnExercise | null => MusicKit.fact(facts(), level, tag, random);

export const MusicUnit7 = {
  tag, fresh, all, upTo, facts,
  def: {
    makers: { fact, staffName, staffKind, hearKind, missing, typed: typedPart, buildBank, pairs, key },
    lessons: [
      ['fact', 'fact', 'staffName', 'staffName', 'missing', 'missing', 'buildBank', 'buildBank', 'typed', 'typed', 'pairs'],
      ['fact', 'fact', 'staffKind', 'staffKind', 'hearKind', 'hearKind', 'hearKind', 'staffName', 'missing', 'buildBank', 'typed', 'key'],
      ['fact', 'staffName', 'staffName', 'staffKind', 'hearKind', 'hearKind', 'missing', 'missing', 'buildBank', 'buildBank', 'typed', 'typed'],
    ],
    practice: ['fact', 'staffName', 'staffKind', 'hearKind', 'hearKind', 'missing', 'buildBank', 'typed', 'pairs', 'key', '~', '~'],
    checkpoint: ['fact', 'fact', 'staffName', 'staffName', 'staffKind', 'hearKind', 'hearKind', 'hearKind', 'missing', 'buildBank', 'typed', 'typed', 'pairs', 'key'],
    review: ['staffName', 'hearKind', 'missing', 'typed'],
  } as MusicUnitDef,
};
