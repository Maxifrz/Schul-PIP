import type { LearnExercise } from '../exercise';
import { bank as makeBank, choice, pairs as makePairs } from '../exercises';
import type { Pitch } from '../media';
import { LearnRandom } from '../random';
import { MusicKit, MusicMaker, MusicUnitDef, fact as mf } from './kit';
import { germanName, letterNames, pitchAtStep, scientificName, staffPosition } from './theory';

const tag = 'music.u01';
const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);

/** The new notes of each lesson: the lines, the spaces, the ledger lines and the notes just beyond the staff. */
const freshNotes: Pitch[][] = [
  [n(2, 4), n(4, 4), n(6, 4), n(1, 5), n(3, 5)],
  [n(3, 4), n(5, 4), n(0, 5), n(2, 5)],
  [n(0, 4), n(1, 4), n(4, 5), n(5, 5)],
];
const all = (): Pitch[] => freshNotes.flat();
const fresh = (level: number): Pitch[] => (level >= 4 ? all() : freshNotes[level - 1]);
const upTo = (level: number): Pitch[] => (level >= 4 ? all() : freshNotes.slice(0, level).flat());

const pitchOf = (level: number, random: LearnRandom): Pitch | null => MusicKit.draw(fresh(level), upTo(level), level, random);

const read: MusicMaker = (random, level) => {
  const p = pitchOf(level, random);
  if (!p) return null;
  const step = staffPosition(p, 'treble').step;
  return choice(random, {
    id: `${tag}.read.${scientificName(p)}`, key: `music.note.treble.${scientificName(p)}`, prompt: 'Wie heißt diese Note?',
    correct: germanName(p), wrong: MusicKit.wrongReadings(p, 'treble', null, random, true),
    explanation: `${germanName(p)} liegt im Violinschlüssel ${MusicKit.phrase(step)}.`, media: MusicKit.staff('treble', [p]),
  });
};

const readType: MusicMaker = (random, level) => {
  const p = pitchOf(level, random);
  if (!p) return null;
  const step = staffPosition(p, 'treble').step;
  return MusicKit.typedNote({
    id: `${tag}.type.${scientificName(p)}`, key: `music.note.treble.${scientificName(p)}`, prompt: 'Schreibe den Namen dieser Note.',
    answer: p, explanation: `${germanName(p)} liegt im Violinschlüssel ${MusicKit.phrase(step)}.`, media: MusicKit.staff('treble', [p]),
  });
};

const place: MusicMaker = (random, level) => {
  const p = pitchOf(level, random);
  if (!p) return null;
  const step = staffPosition(p, 'treble').step;
  return choice(random, {
    id: `${tag}.place.${scientificName(p)}`, key: `music.note.treble.${scientificName(p)}`,
    prompt: `Welche Note liegt im Violinschlüssel ${MusicKit.phrase(step)}?`, correct: germanName(p),
    wrong: [1, -1, 2, -2].map((d) => germanName(pitchAtStep(step + d, 'treble'))),
    explanation: `${germanName(p)} liegt im Violinschlüssel ${MusicKit.phrase(step)}.`,
  });
};

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

const pairs: MusicMaker = (random, level) => {
  const chosen = distinctLetters(upTo(level), 4, random);
  if (chosen.length !== 4) return null;
  const items: Array<{ key: string; front: string; back: string }> = [];
  for (const p of chosen) {
    const text = staffPosition(p, 'treble').description;
    if (text === null) continue;
    items.push({ key: `music.note.treble.${scientificName(p)}`, front: germanName(p), back: text });
  }
  if (items.length !== 4) return null;
  return makePairs(random, { id: `${tag}.pairs.${chosen.map(scientificName).sort().join('')}`, prompt: 'Wo liegt die Note im Violinschlüssel?', items });
};

const bank: MusicMaker = (random, level) => {
  const chosen = distinctLetters(upTo(level), 4, random);
  if (chosen.length !== 4) return null;
  const others = random.shuffled([0, 1, 2, 3, 4, 5, 6].filter((l) => !chosen.some((c) => c.letter === l)));
  return makeBank(random, {
    id: `${tag}.bank.${chosen.map(scientificName).join('-')}`, key: 'music.bank.treble', prompt: 'Wie heißen die Noten? Lege sie der Reihe nach.',
    words: chosen.map(germanName), extra: others.slice(0, 2).map((l) => letterNames[l]), media: MusicKit.staff('treble', chosen),
  });
};

const terms: MusicMaker = (random) => makePairs(random, {
  id: `${tag}.terms`, prompt: 'Was bedeutet das Wort?',
  items: [
    { key: 'music.term.system', front: 'Notensystem', back: 'fünf Linien' },
    { key: 'music.term.violin', front: 'Violinschlüssel', back: 'G-Schlüssel' },
    { key: 'music.term.ledger', front: 'Hilfslinie', back: 'kurzer Strich außerhalb des Systems' },
    { key: 'music.term.space', front: 'Zwischenraum', back: 'Platz zwischen zwei Linien' },
  ],
});

const facts = () => [
  mf('lines', 1, 'Wie viele Linien hat ein Notensystem?', { correct: '5', wrong: ['4', '6', '3'], explanation: 'Ein Notensystem hat fünf Linien und vier Zwischenräume.' }),
  mf('spaces', 1, 'Wie viele Zwischenräume hat ein Notensystem?', { correct: '4', wrong: ['3', '5', '6'], explanation: 'Vier Zwischenräume liegen zwischen den fünf Linien.' }),
  mf('count', 1, 'Von wo aus zählt man die Linien?', { correct: 'von unten nach oben', wrong: ['von oben nach unten', 'von der mittleren Linie aus'], explanation: 'Die unterste Linie ist die 1. Linie.' }),
  mf('gclef', 1, 'Der Violinschlüssel heißt auch G-Schlüssel. Welche Linie markiert er?', { correct: '2. Linie', wrong: ['1. Linie', '3. Linie', '4. Linie'], explanation: 'Die Schnecke des Violinschlüssels legt sich um die 2. Linie: dort liegt das G.' }),
  mf('high', 2, 'Eine Note steht höher im Notensystem. Wie klingt sie?', { correct: 'höher', wrong: ['tiefer', 'lauter', 'länger'], explanation: 'Je höher eine Note steht, desto höher ist der Ton.' }),
  mf('between', 2, 'Welche Note liegt im Violinschlüssel im Zwischenraum zwischen den Linien E und G?', { correct: 'F', wrong: ['D', 'A', 'H'], explanation: 'Zwischen E und G liegt F: Die Buchstaben folgen aufeinander.' }),
  mf('ledger', 3, 'Was ist eine Hilfslinie?', { correct: 'ein kurzer Strich über oder unter dem System', wrong: ['der Strich zwischen zwei Takten', 'der Bogen, der zwei Noten verbindet'], explanation: 'Hilfslinien verlängern das Notensystem nach oben oder unten.' }),
  mf('middlec', 3, 'Wo liegt das eingestrichene C im Violinschlüssel?', {
    correct: 'auf der 1. Hilfslinie unter dem System', wrong: ['auf der 1. Linie', 'im 1. Zwischenraum', 'unter der 1. Linie'],
    explanation: 'Das eingestrichene C sitzt auf einer kurzen Hilfslinie unter den fünf Linien.', media: MusicKit.staff('treble', [n(0, 4)]),
  }),
];

const fact: MusicMaker = (random, level): LearnExercise | null => MusicKit.fact(facts(), level, tag, random);

export const MusicUnit1 = {
  tag, freshNotes, all, fresh, upTo, pitch: pitchOf, facts,
  def: {
    makers: { fact, read, readType, place, pairs, bank, terms },
    lessons: [
      ['fact', 'fact', 'read', 'read', 'read', 'place', 'pairs', 'bank', 'readType', 'readType'],
      ['fact', 'read', 'read', 'read', 'place', 'place', 'pairs', 'bank', 'readType', 'readType', 'readType'],
      ['fact', 'fact', 'read', 'read', 'read', 'place', 'terms', 'bank', 'readType', 'readType'],
    ],
    practice: ['fact', 'read', 'read', 'read', 'place', 'pairs', 'terms', 'bank', 'readType', 'readType', 'readType', 'readType'],
    checkpoint: ['fact', 'fact', 'read', 'read', 'read', 'read', 'place', 'place', 'pairs', 'bank', 'readType', 'readType', 'readType', 'readType'],
    review: ['read', 'readType', 'place', 'pairs'],
  } as MusicUnitDef,
};
