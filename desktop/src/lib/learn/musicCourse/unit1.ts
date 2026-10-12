// Unit 1: the staff and the treble clef. A port of Lernwerk/Services/Learn/Music/MusicUnit1.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import { type Pitch } from '../music';
import type { LearnRandom } from '../random';
import { compareStrings } from '../util';
import { fact as makeFact, type MusicFact, MusicKit, type MusicUnitDef } from './kit';
import { atStep, staffPosition, staffPositionDescription } from './rhythm';
import { germanName, LETTER_NAMES, scientificName } from './theory';

const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);

export const UNIT1_TAG = 'music.u01';
const tag = UNIT1_TAG;

/** The new notes of each lesson: the lines, the spaces, the ledger lines and the notes just beyond the staff. */
export const unit1FreshNotes: Pitch[][] = [
  [n(2, 4), n(4, 4), n(6, 4), n(1, 5), n(3, 5)],
  [n(3, 4), n(5, 4), n(0, 5), n(2, 5)],
  [n(0, 4), n(1, 4), n(4, 5), n(5, 5)],
];

export const unit1All: Pitch[] = unit1FreshNotes.flat();
const fresh = (level: number): Pitch[] => (level >= 4 ? unit1All : unit1FreshNotes[level - 1]);
export const unit1UpTo = (level: number): Pitch[] => (level >= 4 ? unit1All : unit1FreshNotes.slice(0, level).flat());

function pitchFor(level: number, random: LearnRandom): Pitch | undefined {
  return MusicKit.draw(fresh(level), unit1UpTo(level), level, random);
}

function read(random: LearnRandom, level: number): LearnExercise | null {
  const p = pitchFor(level, random);
  if (!p) return null;
  const step = staffPosition(p, 'treble').step;
  const wrong = MusicKit.wrongReadings(p, 'treble', null, true, random);
  return Exercises.choice(
    {
      id: `${tag}.read.${scientificName(p)}`,
      key: `music.note.treble.${scientificName(p)}`,
      prompt: 'Wie heißt diese Note?',
      correct: germanName(p),
      wrong,
      explanation: `${germanName(p)} liegt im Violinschlüssel ${MusicKit.phrase(step)}.`,
      media: MusicKit.staff('treble', [p]),
    },
    random,
  );
}

function readType(random: LearnRandom, level: number): LearnExercise | null {
  const p = pitchFor(level, random);
  if (!p) return null;
  const step = staffPosition(p, 'treble').step;
  return MusicKit.typedNote({
    id: `${tag}.type.${scientificName(p)}`,
    key: `music.note.treble.${scientificName(p)}`,
    prompt: 'Schreibe den Namen dieser Note.',
    answer: p,
    explanation: `${germanName(p)} liegt im Violinschlüssel ${MusicKit.phrase(step)}.`,
    media: MusicKit.staff('treble', [p]),
  });
}

function place(random: LearnRandom, level: number): LearnExercise | null {
  const p = pitchFor(level, random);
  if (!p) return null;
  const step = staffPosition(p, 'treble').step;
  const wrong = [1, -1, 2, -2].map((d) => germanName(atStep(step + d, 'treble')));
  return Exercises.choice(
    {
      id: `${tag}.place.${scientificName(p)}`,
      key: `music.note.treble.${scientificName(p)}`,
      prompt: `Welche Note liegt im Violinschlüssel ${MusicKit.phrase(step)}?`,
      correct: germanName(p),
      wrong,
      explanation: `${germanName(p)} liegt im Violinschlüssel ${MusicKit.phrase(step)}.`,
    },
    random,
  );
}

/** Four notes of different names, taken from the pool. */
export function distinctLetters(pool: Pitch[], count: number, random: LearnRandom): Pitch[] {
  const chosen: Pitch[] = [];
  for (const p of random.shuffled(pool)) {
    if (chosen.some((c) => c.letter === p.letter)) continue;
    chosen.push(p);
    if (chosen.length === count) break;
  }
  return chosen;
}

function pairs(random: LearnRandom, level: number): LearnExercise | null {
  const chosen = distinctLetters(unit1UpTo(level), 4, random);
  if (chosen.length !== 4) return null;
  const items: { key: string; front: string; back: string }[] = [];
  for (const p of chosen) {
    const text = staffPositionDescription(staffPosition(p, 'treble'));
    if (text === null) continue;
    items.push({ key: `music.note.treble.${scientificName(p)}`, front: germanName(p), back: text });
  }
  if (items.length !== 4) return null;
  const id = `${tag}.pairs.` + chosen.map(scientificName).sort(compareStrings).join('');
  return Exercises.pairs({ id, prompt: 'Wo liegt die Note im Violinschlüssel?', items }, random);
}

function bank(random: LearnRandom, level: number): LearnExercise | null {
  const chosen = distinctLetters(unit1UpTo(level), 4, random);
  if (chosen.length !== 4) return null;
  const letters = [0, 1, 2, 3, 4, 5, 6].filter((letter) => !chosen.some((c) => c.letter === letter));
  const others = random.shuffled(letters);
  const extra = others.slice(0, 2).map((l) => LETTER_NAMES[l]);
  const words = chosen.map(germanName);
  return Exercises.bank(
    {
      id: `${tag}.bank.` + chosen.map(scientificName).join('-'),
      key: 'music.bank.treble',
      prompt: 'Wie heißen die Noten? Lege sie der Reihe nach.',
      words,
      extra,
      media: MusicKit.staff('treble', chosen),
    },
    random,
  );
}

function terms(random: LearnRandom, _level: number): LearnExercise | null {
  return Exercises.pairs(
    {
      id: `${tag}.terms`,
      prompt: 'Was bedeutet das Wort?',
      items: [
        { key: 'music.term.system', front: 'Notensystem', back: 'fünf Linien' },
        { key: 'music.term.violin', front: 'Violinschlüssel', back: 'G-Schlüssel' },
        { key: 'music.term.ledger', front: 'Hilfslinie', back: 'kurzer Strich außerhalb des Systems' },
        { key: 'music.term.space', front: 'Zwischenraum', back: 'Platz zwischen zwei Linien' },
      ],
    },
    random,
  );
}

function fact(random: LearnRandom, level: number): LearnExercise | null {
  return MusicKit.fact(unit1Facts, level, tag, random);
}

export const unit1Facts: MusicFact[] = [
  makeFact('lines', 1, 'Wie viele Linien hat ein Notensystem?', '5', ['4', '6', '3'], 'Ein Notensystem hat fünf Linien und vier Zwischenräume.'),
  makeFact('spaces', 1, 'Wie viele Zwischenräume hat ein Notensystem?', '4', ['3', '5', '6'], 'Vier Zwischenräume liegen zwischen den fünf Linien.'),
  makeFact('count', 1, 'Von wo aus zählt man die Linien?', 'von unten nach oben', ['von oben nach unten', 'von der mittleren Linie aus'], 'Die unterste Linie ist die 1. Linie.'),
  makeFact('gclef', 1, 'Der Violinschlüssel heißt auch G-Schlüssel. Welche Linie markiert er?', '2. Linie', ['1. Linie', '3. Linie', '4. Linie'], 'Die Schnecke des Violinschlüssels legt sich um die 2. Linie: dort liegt das G.'),
  makeFact('high', 2, 'Eine Note steht höher im Notensystem. Wie klingt sie?', 'höher', ['tiefer', 'lauter', 'länger'], 'Je höher eine Note steht, desto höher ist der Ton.'),
  makeFact('between', 2, 'Welche Note liegt im Violinschlüssel im Zwischenraum zwischen den Linien E und G?', 'F', ['D', 'A', 'H'], 'Zwischen E und G liegt F: Die Buchstaben folgen aufeinander.'),
  makeFact('ledger', 3, 'Was ist eine Hilfslinie?', 'ein kurzer Strich über oder unter dem System', ['der Strich zwischen zwei Takten', 'der Bogen, der zwei Noten verbindet'], 'Hilfslinien verlängern das Notensystem nach oben oder unten.'),
  makeFact('middlec', 3, 'Wo liegt das eingestrichene C im Violinschlüssel?', 'auf der 1. Hilfslinie unter dem System', ['auf der 1. Linie', 'im 1. Zwischenraum', 'unter der 1. Linie'], 'Das eingestrichene C sitzt auf einer kurzen Hilfslinie unter den fünf Linien.', MusicKit.staff('treble', [n(0, 4)])),
];

export const unit1Def: MusicUnitDef = {
  makers: { fact, read, readType, place, pairs, bank, terms },
  lessons: [
    ['fact', 'fact', 'read', 'read', 'read', 'place', 'pairs', 'bank', 'readType', 'readType'],
    ['fact', 'read', 'read', 'read', 'place', 'place', 'pairs', 'bank', 'readType', 'readType', 'readType'],
    ['fact', 'fact', 'read', 'read', 'read', 'place', 'terms', 'bank', 'readType', 'readType'],
  ],
  practice: ['fact', 'read', 'read', 'read', 'place', 'pairs', 'terms', 'bank', 'readType', 'readType', 'readType', 'readType'],
  checkpoint: ['fact', 'fact', 'read', 'read', 'read', 'read', 'place', 'place', 'pairs', 'bank', 'readType', 'readType', 'readType', 'readType'],
  review: ['read', 'readType', 'place', 'pairs'],
};
