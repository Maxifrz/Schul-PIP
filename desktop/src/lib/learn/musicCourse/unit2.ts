// Unit 2: the bass clef and the keyboard. A port of Lernwerk/Services/Learn/Music/MusicUnit2.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import { type Clef, type Pitch, pitchMidi } from '../music';
import type { LearnRandom } from '../random';
import { compareStrings } from '../util';
import { fact as makeFact, MusicKit, type MusicFact, type MusicUnitDef, randomBool } from './kit';
import { atStep, staffPosition, staffPositionDescription } from './rhythm';
import { germanName, LETTER_NAMES, scientificName } from './theory';
import { distinctLetters, unit1All } from './unit1';

const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);
const tag = 'music.u02';

/** The lines of the bass clef, then its spaces and the notes beyond the staff. */
export const unit2FreshBass: Pitch[][] = [
  [n(4, 2), n(6, 2), n(1, 3), n(3, 3), n(5, 3)],
  [n(5, 2), n(0, 3), n(2, 3), n(4, 3), n(3, 2), n(6, 3), n(0, 4)],
  [],
];
export const unit2AllBass: Pitch[] = unit2FreshBass.flat();
const upTo = (level: number): Pitch[] => (level >= 3 ? unit2AllBass : unit2FreshBass.slice(0, level).flat());

function bass(level: number, random: LearnRandom): Pitch | undefined {
  const fresh = level >= 4 ? unit2AllBass : unit2FreshBass[level - 1];
  return MusicKit.draw(fresh, upTo(level), level, random);
}

function sentence(p: Pitch, clef: Clef): string {
  return `${germanName(p)} liegt im ${MusicKit.clefWord(clef)} ${MusicKit.phrase(staffPosition(p, clef).step)}.`;
}

function read(random: LearnRandom, level: number): LearnExercise | null {
  const p = bass(level, random);
  if (!p) return null;
  const wrong = MusicKit.wrongReadings(p, 'bass', 'treble', true, random);
  return Exercises.choice(
    {
      id: `${tag}.read.${scientificName(p)}`,
      key: `music.note.bass.${scientificName(p)}`,
      prompt: 'Wie heißt diese Note im Bassschlüssel?',
      correct: germanName(p),
      wrong,
      explanation: sentence(p, 'bass'),
      media: MusicKit.staff('bass', [p]),
    },
    random,
  );
}

function readType(random: LearnRandom, level: number): LearnExercise | null {
  const p = bass(level, random);
  if (!p) return null;
  return MusicKit.typedNote({
    id: `${tag}.type.${scientificName(p)}`,
    key: `music.note.bass.${scientificName(p)}`,
    prompt: 'Schreibe den Namen dieser Note.',
    answer: p,
    explanation: sentence(p, 'bass'),
    media: MusicKit.staff('bass', [p]),
  });
}

/** A note in either clef. */
function readMixed(random: LearnRandom, _level: number): LearnExercise | null {
  const useBass = randomBool(random);
  const clef: Clef = useBass ? 'bass' : 'treble';
  const p = useBass ? bass(4, random) : MusicKit.pick(unit1All, random);
  if (!p) return null;
  const wrong = MusicKit.wrongReadings(p, clef, useBass ? 'treble' : 'bass', true, random);
  return Exercises.choice(
    {
      id: `${tag}.mixed.${clef}.${scientificName(p)}`,
      key: `music.note.${clef}.${scientificName(p)}`,
      prompt: `Wie heißt diese Note im ${MusicKit.clefWord(clef)}?`,
      correct: germanName(p),
      wrong,
      explanation: sentence(p, clef),
      media: MusicKit.staff(clef, [p]),
    },
    random,
  );
}

function compare(random: LearnRandom, _level: number): LearnExercise | null {
  const step = random.randomElement([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  if (step === undefined) return null;
  const treble = atStep(step, 'treble');
  const low = atStep(step, 'bass');
  const wrong = [germanName(treble), ...[1, -1, 2].map((d) => germanName(atStep(step + d, 'bass')))];
  return Exercises.choice(
    {
      id: `${tag}.compare.${step}`,
      key: `music.compare.${step}`,
      prompt: `Eine Note liegt ${MusicKit.phrase(step)}. Im Violinschlüssel heißt sie ${germanName(treble)}. Wie heißt sie im Bassschlüssel?`,
      correct: germanName(low),
      wrong,
      explanation: `Die Linien und Zwischenräume bleiben gleich, aber der Bassschlüssel hat andere Namen: hier ${germanName(low)}.`,
    },
    random,
  );
}

function place(random: LearnRandom, level: number): LearnExercise | null {
  const p = bass(level, random);
  if (!p) return null;
  const step = staffPosition(p, 'bass').step;
  const wrong = [1, -1, 2, -2].map((d) => germanName(atStep(step + d, 'bass')));
  return Exercises.choice(
    {
      id: `${tag}.place.${scientificName(p)}`,
      key: `music.note.bass.${scientificName(p)}`,
      prompt: `Welche Note liegt im Bassschlüssel ${MusicKit.phrase(step)}?`,
      correct: germanName(p),
      wrong,
      explanation: sentence(p, 'bass'),
    },
    random,
  );
}

function pairs(random: LearnRandom, level: number): LearnExercise | null {
  const chosen = distinctLetters(upTo(level), 4, random);
  if (chosen.length !== 4) return null;
  const items: { key: string; front: string; back: string }[] = [];
  for (const p of chosen) {
    const text = staffPositionDescription(staffPosition(p, 'bass'));
    if (text === null) continue;
    items.push({ key: `music.note.bass.${scientificName(p)}`, front: germanName(p), back: text });
  }
  if (items.length !== 4) return null;
  return Exercises.pairs(
    { id: `${tag}.pairs.` + chosen.map(scientificName).sort(compareStrings).join(''), prompt: 'Wo liegt die Note im Bassschlüssel?', items },
    random,
  );
}

function bank(random: LearnRandom, level: number): LearnExercise | null {
  const chosen = distinctLetters(upTo(level), 4, random);
  if (chosen.length !== 4) return null;
  const others = random.shuffled([0, 1, 2, 3, 4, 5, 6].filter((letter) => !chosen.some((c) => c.letter === letter)));
  return Exercises.bank(
    {
      id: `${tag}.bank.` + chosen.map(scientificName).join('-'),
      key: 'music.bank.bass',
      prompt: 'Wie heißen die Noten im Bassschlüssel? Lege sie der Reihe nach.',
      words: chosen.map(germanName),
      extra: others.slice(0, 2).map((l) => LETTER_NAMES[l]),
      media: MusicKit.staff('bass', chosen),
    },
    random,
  );
}

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
function key(random: LearnRandom, _level: number): LearnExercise | null {
  const letter = random.randomElement([0, 1, 2, 3, 4, 5, 6]);
  const octave = random.randomElement([3, 4, 4, 5]);
  if (letter === undefined || octave === undefined) return null;
  const p = n(letter, octave);
  const hint = keyHints[letter];
  if (randomBool(random)) {
    const text = MusicKit.octaveText(p);
    if (text !== null) {
      return Exercises.key({
        id: `${tag}.key.${scientificName(p)}`,
        key: `music.key.${germanName(p)}`,
        prompt: `Tippe ${text}.`,
        midi: [pitchMidi(p)],
        solution: `${germanName(p)}${octave}`,
        explanation: hint,
      });
    }
  }
  return Exercises.key({
    id: `${tag}.key.any.${germanName(p)}`,
    key: `music.key.${germanName(p)}`,
    prompt: `Tippe ein ${germanName(p)}.`,
    midi: MusicKit.keys(p),
    solution: germanName(p),
    explanation: hint,
  });
}

function keyStaff(random: LearnRandom, _level: number): LearnExercise | null {
  const useBass = randomBool(random);
  const p = useBass ? MusicKit.pick(unit2AllBass, random) : MusicKit.pick(unit1All, random);
  if (!p) return null;
  const clef: Clef = useBass ? 'bass' : 'treble';
  return Exercises.key({
    id: `${tag}.keystaff.${clef}.${scientificName(p)}`,
    key: `music.note.${clef}.${scientificName(p)}`,
    prompt: 'Tippe diese Note auf der Klaviatur.',
    midi: [pitchMidi(p)],
    solution: germanName(p),
    explanation: sentence(p, clef),
    media: MusicKit.staff(clef, [p]),
  });
}

function terms(random: LearnRandom, _level: number): LearnExercise | null {
  return Exercises.pairs(
    {
      id: `${tag}.terms`,
      prompt: 'Was gehört zusammen?',
      items: [
        { key: 'music.term.violin', front: 'Violinschlüssel', back: 'G-Schlüssel' },
        { key: 'music.term.bass', front: 'Bassschlüssel', back: 'F-Schlüssel' },
        { key: 'music.term.middlec', front: 'Das eingestrichene c', back: 'liegt etwa in der Mitte der Klaviatur' },
        { key: 'music.term.black', front: 'Schwarze Tasten', back: 'stehen in Gruppen zu zwei und drei' },
      ],
    },
    random,
  );
}

function fact(random: LearnRandom, level: number): LearnExercise | null {
  return MusicKit.fact(unit2Facts, level, tag, random);
}

export const unit2Facts: MusicFact[] = [
  makeFact('fclef', 1, 'Welcher Buchstabe gehört zum Bassschlüssel?', 'F', ['G', 'C', 'A'], 'Der Bassschlüssel heißt auch F-Schlüssel.'),
  makeFact('dots', 1, 'Zwischen den zwei Punkten des Bassschlüssels liegt eine Linie. Welche?', '4. Linie', ['2. Linie', '3. Linie', '5. Linie'], 'Die Punkte umfassen die 4. Linie, auf der das F liegt.'),
  makeFact('low', 1, 'Wofür wird der Bassschlüssel meistens gebraucht?', 'für tiefe Töne', ['für hohe Töne', 'für laute Töne', 'für kurze Töne'], 'Tiefe Instrumente und die linke Hand am Klavier lesen oft im Bassschlüssel.'),
  makeFact('c4bass', 2, 'Wo liegt das eingestrichene C im Bassschlüssel?', 'auf der 1. Hilfslinie über dem System', ['auf der 1. Hilfslinie unter dem System', 'im 4. Zwischenraum', 'auf der 5. Linie'], 'Über der obersten Linie A folgen H und dann C auf der Hilfslinie.', MusicKit.staff('bass', [n(0, 4)])),
  makeFact('blackgroups', 3, 'Wie sind die schwarzen Tasten angeordnet?', 'abwechselnd zu zwei und zu drei', ['alle einzeln', 'immer zu dritt', 'immer zu zweit'], 'Zwei und drei schwarze Tasten wechseln sich ab; so findet man sich zurecht.'),
  makeFact('cleft', 3, 'Welche weiße Taste liegt links neben den zwei schwarzen Tasten?', 'C', ['D', 'E', 'F'], 'Das C liegt direkt links von der Zweiergruppe.'),
  makeFact('fleft', 3, 'Welche weiße Taste liegt links neben den drei schwarzen Tasten?', 'F', ['C', 'G', 'H'], 'Das F liegt direkt links von der Dreiergruppe.'),
  makeFact('octaveName', 3, 'Wie heißt die Oktave, in der das mittlere C liegt?', 'eingestrichene Oktave', ['kleine Oktave', 'große Oktave', 'zweigestrichene Oktave'], 'Das mittlere C ist das eingestrichene c.'),
  makeFact('smallc', 3, 'Wie heißt das C eine Oktave unter dem eingestrichenen c?', 'kleines c', ['großes C', 'zweigestrichenes c', 'eingestrichenes c'], 'Eine Oktave tiefer beginnt die kleine Oktave mit dem kleinen c.'),
];

export const unit2Def: MusicUnitDef = {
  makers: { fact, read, readType, readMixed, compare, place, pairs, bank, key, keyStaff, terms },
  lessons: [
    ['fact', 'fact', 'read', 'read', 'read', 'place', 'compare', 'pairs', 'bank', 'readType', 'readType'],
    ['fact', 'read', 'read', 'readMixed', 'place', 'compare', 'keyStaff', 'pairs', 'bank', 'readType', 'readType'],
    ['fact', 'fact', 'key', 'key', 'key', 'keyStaff', 'keyStaff', 'terms', 'readMixed', 'bank', 'readType', 'readType'],
  ],
  practice: ['fact', 'read', 'readMixed', 'key', 'keyStaff', 'compare', 'readType', 'readType', '~', '~', '~', '~'],
  checkpoint: ['fact', 'fact', 'read', 'readMixed', 'readMixed', 'place', 'compare', 'pairs', 'terms', 'key', 'key', 'keyStaff', 'readType', 'readType'],
  review: ['read', 'readType', 'key', 'keyStaff'],
};
