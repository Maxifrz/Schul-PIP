import type { LearnExercise } from '../exercise';
import { bank as makeBank, choice, pairs as makePairs, pianoKey } from '../exercises';
import type { Clef, Pitch } from '../media';
import { midiOf } from '../media';
import { LearnRandom } from '../random';
import { MusicKit, MusicMaker, MusicUnitDef, fact as mf } from './kit';
import { MusicUnit1, distinctLetters } from './unit01';
import { germanName, letterNames, pitchAtStep, scientificName, staffPosition } from './theory';

const tag = 'music.u02';
const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);

/** The lines of the bass clef, then its spaces and the notes beyond the staff. */
const freshBass: Pitch[][] = [
  [n(4, 2), n(6, 2), n(1, 3), n(3, 3), n(5, 3)],
  [n(5, 2), n(0, 3), n(2, 3), n(4, 3), n(3, 2), n(6, 3), n(0, 4)],
  [],
];
const allBass = (): Pitch[] => freshBass.flat();
const upTo = (level: number): Pitch[] => (level >= 3 ? allBass() : freshBass.slice(0, level).flat());

function bassNote(level: number, random: LearnRandom): Pitch | null {
  const fresh = level >= 4 ? allBass() : freshBass[level - 1];
  return MusicKit.draw(fresh, upTo(level), level, random);
}

const sentence = (p: Pitch, clef: Clef): string => `${germanName(p)} liegt im ${MusicKit.clefWord(clef)} ${MusicKit.phrase(staffPosition(p, clef).step)}.`;

const read: MusicMaker = (random, level) => {
  const p = bassNote(level, random);
  if (!p) return null;
  return choice(random, {
    id: `${tag}.read.${scientificName(p)}`, key: `music.note.bass.${scientificName(p)}`, prompt: 'Wie heißt diese Note im Bassschlüssel?',
    correct: germanName(p), wrong: MusicKit.wrongReadings(p, 'bass', 'treble', random, true), explanation: sentence(p, 'bass'), media: MusicKit.staff('bass', [p]),
  });
};

const readType: MusicMaker = (random, level) => {
  const p = bassNote(level, random);
  if (!p) return null;
  return MusicKit.typedNote({
    id: `${tag}.type.${scientificName(p)}`, key: `music.note.bass.${scientificName(p)}`, prompt: 'Schreibe den Namen dieser Note.',
    answer: p, explanation: sentence(p, 'bass'), media: MusicKit.staff('bass', [p]),
  });
};

/** A note in either clef. */
const readMixed: MusicMaker = (random) => {
  const useBass = random.bool();
  const clef: Clef = useBass ? 'bass' : 'treble';
  const p = useBass ? bassNote(4, random) : MusicKit.pick(MusicUnit1.all(), random);
  if (!p) return null;
  return choice(random, {
    id: `${tag}.mixed.${clef}.${scientificName(p)}`, key: `music.note.${clef}.${scientificName(p)}`,
    prompt: `Wie heißt diese Note im ${MusicKit.clefWord(clef)}?`, correct: germanName(p), wrong: MusicKit.wrongReadings(p, clef, useBass ? 'treble' : 'bass', random, true),
    explanation: sentence(p, clef), media: MusicKit.staff(clef, [p]),
  });
};

const compare: MusicMaker = (random) => {
  const step = MusicKit.pick([0, 1, 2, 3, 4, 5, 6, 7, 8], random);
  if (step === null) return null;
  const treble = pitchAtStep(step, 'treble');
  const low = pitchAtStep(step, 'bass');
  const wrong = [germanName(treble), ...[1, -1, 2].map((d) => germanName(pitchAtStep(step + d, 'bass')))];
  return choice(random, {
    id: `${tag}.compare.${step}`, key: `music.compare.${step}`,
    prompt: `Eine Note liegt ${MusicKit.phrase(step)}. Im Violinschlüssel heißt sie ${germanName(treble)}. Wie heißt sie im Bassschlüssel?`,
    correct: germanName(low), wrong,
    explanation: `Die Linien und Zwischenräume bleiben gleich, aber der Bassschlüssel hat andere Namen: hier ${germanName(low)}.`,
  });
};

const place: MusicMaker = (random, level) => {
  const p = bassNote(level, random);
  if (!p) return null;
  const step = staffPosition(p, 'bass').step;
  return choice(random, {
    id: `${tag}.place.${scientificName(p)}`, key: `music.note.bass.${scientificName(p)}`,
    prompt: `Welche Note liegt im Bassschlüssel ${MusicKit.phrase(step)}?`, correct: germanName(p),
    wrong: [1, -1, 2, -2].map((d) => germanName(pitchAtStep(step + d, 'bass'))), explanation: sentence(p, 'bass'),
  });
};

const pairs: MusicMaker = (random, level) => {
  const chosen = distinctLetters(upTo(level), 4, random);
  if (chosen.length !== 4) return null;
  const items: Array<{ key: string; front: string; back: string }> = [];
  for (const p of chosen) {
    const text = staffPosition(p, 'bass').description;
    if (text !== null) items.push({ key: `music.note.bass.${scientificName(p)}`, front: germanName(p), back: text });
  }
  if (items.length !== 4) return null;
  return makePairs(random, { id: `${tag}.pairs.${chosen.map(scientificName).sort().join('')}`, prompt: 'Wo liegt die Note im Bassschlüssel?', items });
};

const bank: MusicMaker = (random, level) => {
  const chosen = distinctLetters(upTo(level), 4, random);
  if (chosen.length !== 4) return null;
  const others = random.shuffled([0, 1, 2, 3, 4, 5, 6].filter((l) => !chosen.some((c) => c.letter === l)));
  return makeBank(random, {
    id: `${tag}.bank.${chosen.map(scientificName).join('-')}`, key: 'music.bank.bass', prompt: 'Wie heißen die Noten im Bassschlüssel? Lege sie der Reihe nach.',
    words: chosen.map(germanName), extra: others.slice(0, 2).map((l) => letterNames[l]), media: MusicKit.staff('bass', chosen),
  });
};

const keyHints = [
  'Das C liegt links neben der Gruppe aus zwei schwarzen Tasten.',
  'Das D liegt zwischen den zwei schwarzen Tasten.',
  'Das E liegt rechts neben der Gruppe aus zwei schwarzen Tasten.',
  'Das F liegt links neben der Gruppe aus drei schwarzen Tasten.',
  'Das G liegt zwischen der ersten und der zweiten schwarzen Taste der Dreiergruppe.',
  'Das A liegt zwischen der zweiten und der dritten schwarzen Taste der Dreiergruppe.',
  'Das H liegt rechts neben der Gruppe aus drei schwarzen Tasten.',
];

/** Tap a key by name, in one octave when the question names it, in any octave otherwise. */
const key: MusicMaker = (random) => {
  const letter = MusicKit.pick([0, 1, 2, 3, 4, 5, 6], random);
  const octave = MusicKit.pick([3, 4, 4, 5], random);
  if (letter === null || octave === null) return null;
  const p = n(letter, octave);
  const hint = keyHints[letter];
  const named = random.bool();
  const text = MusicKit.octaveText(p);
  if (named && text !== null) {
    return pianoKey({ id: `${tag}.key.${scientificName(p)}`, key: `music.key.${germanName(p)}`, prompt: `Tippe ${text}.`, midi: [midiOf(p)], solution: `${germanName(p)}${octave}`, explanation: hint });
  }
  return pianoKey({ id: `${tag}.key.any.${germanName(p)}`, key: `music.key.${germanName(p)}`, prompt: `Tippe ein ${germanName(p)}.`, midi: MusicKit.keys(p), solution: germanName(p), explanation: hint });
};

const keyStaff: MusicMaker = (random) => {
  const useBass = random.bool();
  const p = useBass ? MusicKit.pick(allBass(), random) : MusicKit.pick(MusicUnit1.all(), random);
  if (!p) return null;
  const clef: Clef = useBass ? 'bass' : 'treble';
  return pianoKey({
    id: `${tag}.keystaff.${clef}.${scientificName(p)}`, key: `music.note.${clef}.${scientificName(p)}`, prompt: 'Tippe diese Note auf der Klaviatur.',
    midi: [midiOf(p)], solution: germanName(p), explanation: sentence(p, clef), media: MusicKit.staff(clef, [p]),
  });
};

const terms: MusicMaker = (random) => makePairs(random, {
  id: `${tag}.terms`, prompt: 'Was gehört zusammen?',
  items: [
    { key: 'music.term.violin', front: 'Violinschlüssel', back: 'G-Schlüssel' },
    { key: 'music.term.bass', front: 'Bassschlüssel', back: 'F-Schlüssel' },
    { key: 'music.term.middlec', front: 'Das eingestrichene c', back: 'liegt etwa in der Mitte der Klaviatur' },
    { key: 'music.term.black', front: 'Schwarze Tasten', back: 'stehen in Gruppen zu zwei und drei' },
  ],
});

const facts = () => [
  mf('fclef', 1, 'Welcher Buchstabe gehört zum Bassschlüssel?', { correct: 'F', wrong: ['G', 'C', 'A'], explanation: 'Der Bassschlüssel heißt auch F-Schlüssel.' }),
  mf('dots', 1, 'Zwischen den zwei Punkten des Bassschlüssels liegt eine Linie. Welche?', { correct: '4. Linie', wrong: ['2. Linie', '3. Linie', '5. Linie'], explanation: 'Die Punkte umfassen die 4. Linie, auf der das F liegt.' }),
  mf('low', 1, 'Wofür wird der Bassschlüssel meistens gebraucht?', { correct: 'für tiefe Töne', wrong: ['für hohe Töne', 'für laute Töne', 'für kurze Töne'], explanation: 'Tiefe Instrumente und die linke Hand am Klavier lesen oft im Bassschlüssel.' }),
  mf('c4bass', 2, 'Wo liegt das eingestrichene C im Bassschlüssel?', {
    correct: 'auf der 1. Hilfslinie über dem System', wrong: ['auf der 1. Hilfslinie unter dem System', 'im 4. Zwischenraum', 'auf der 5. Linie'],
    explanation: 'Über der obersten Linie A folgen H und dann C auf der Hilfslinie.', media: MusicKit.staff('bass', [n(0, 4)]),
  }),
  mf('blackgroups', 3, 'Wie sind die schwarzen Tasten angeordnet?', { correct: 'abwechselnd zu zwei und zu drei', wrong: ['alle einzeln', 'immer zu dritt', 'immer zu zweit'], explanation: 'Zwei und drei schwarze Tasten wechseln sich ab; so findet man sich zurecht.' }),
  mf('cleft', 3, 'Welche weiße Taste liegt links neben den zwei schwarzen Tasten?', { correct: 'C', wrong: ['D', 'E', 'F'], explanation: 'Das C liegt direkt links von der Zweiergruppe.' }),
  mf('fleft', 3, 'Welche weiße Taste liegt links neben den drei schwarzen Tasten?', { correct: 'F', wrong: ['C', 'G', 'H'], explanation: 'Das F liegt direkt links von der Dreiergruppe.' }),
  mf('octaveName', 3, 'Wie heißt die Oktave, in der das mittlere C liegt?', { correct: 'eingestrichene Oktave', wrong: ['kleine Oktave', 'große Oktave', 'zweigestrichene Oktave'], explanation: 'Das mittlere C ist das eingestrichene c.' }),
  mf('smallc', 3, 'Wie heißt das C eine Oktave unter dem eingestrichenen c?', { correct: 'kleines c', wrong: ['großes C', 'zweigestrichenes c', 'eingestrichenes c'], explanation: 'Eine Oktave tiefer beginnt die kleine Oktave mit dem kleinen c.' }),
];

const fact: MusicMaker = (random, level): LearnExercise | null => MusicKit.fact(facts(), level, tag, random);

export const MusicUnit2 = {
  tag, freshBass, allBass, upTo, facts,
  def: {
    makers: { fact, read, readType, readMixed, compare, place, pairs, bank, key, keyStaff, terms },
    lessons: [
      ['fact', 'fact', 'read', 'read', 'read', 'place', 'compare', 'pairs', 'bank', 'readType', 'readType'],
      ['fact', 'read', 'read', 'readMixed', 'place', 'compare', 'keyStaff', 'pairs', 'bank', 'readType', 'readType'],
      ['fact', 'fact', 'key', 'key', 'key', 'keyStaff', 'keyStaff', 'terms', 'readMixed', 'bank', 'readType', 'readType'],
    ],
    practice: ['fact', 'read', 'readMixed', 'key', 'keyStaff', 'compare', 'readType', 'readType', '~', '~', '~', '~'],
    checkpoint: ['fact', 'fact', 'read', 'readMixed', 'readMixed', 'place', 'compare', 'pairs', 'terms', 'key', 'key', 'keyStaff', 'readType', 'readType'],
    review: ['read', 'readType', 'key', 'keyStaff'],
  } as MusicUnitDef,
};
