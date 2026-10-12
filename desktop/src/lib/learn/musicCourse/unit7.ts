// Unit 7: major and minor triads, built, read and heard. A port of Lernwerk/Services/Learn/Music/MusicUnit7.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import { ExerciseMedia } from '../media';
import { type Pitch, pitchMidi, toneSpec } from '../music';
import type { LearnRandom } from '../random';
import { compareStrings } from '../util';
import { type MusicTriad, triad as makeTriad, triadName, triadNotes } from './harmony';
import { fact as makeFact, type MusicFact, MusicKit, type MusicUnitDef } from './kit';
import { germanName } from './theory';

const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);
const tag = 'music.u07';

/** The triads of each lesson: major on C, G, F, D; minor on A, E, D; then flats and a few more. */
export const unit7Fresh: MusicTriad[][] = [
  [makeTriad(n(0, 4), 'major'), makeTriad(n(4, 4), 'major'), makeTriad(n(3, 4), 'major'), makeTriad(n(1, 4), 'major')],
  [makeTriad(n(5, 4), 'minor'), makeTriad(n(2, 4), 'minor'), makeTriad(n(1, 4), 'minor')],
  [
    makeTriad(n(2, 4, -1), 'major'), makeTriad(n(6, 4, -1), 'major'), makeTriad(n(5, 4, -1), 'major'),
    makeTriad(n(4, 4), 'minor'), makeTriad(n(0, 4), 'minor'), makeTriad(n(3, 4), 'minor'),
  ],
];
export const unit7All: MusicTriad[] = unit7Fresh.flat();
const upTo = (level: number): MusicTriad[] => (level >= 4 ? unit7All : unit7Fresh.slice(0, level).flat());

function pickTriad(level: number, random: LearnRandom): MusicTriad | undefined {
  return MusicKit.draw(level >= 4 ? unit7All : unit7Fresh[level - 1], upTo(level), level, random);
}

const tones = (t: MusicTriad): string => triadNotes(t).map(germanName).join(' – ');
const kindWord = (t: MusicTriad): string => (t.quality === 'major' ? 'Dur' : 'Moll');

function staffName(random: LearnRandom, level: number): LearnExercise | null {
  const t = pickTriad(level, random);
  if (!t) return null;
  const nm = triadName(t);
  const wrong: string[] = [];
  if (level >= 2) wrong.push(triadName(makeTriad(t.root, t.quality === 'major' ? 'minor' : 'major')));
  const pool = random.shuffled((level >= 2 ? unit7All : unit7Fresh[0]).filter((x) => triadName(x) !== nm));
  wrong.push(...pool.map(triadName));
  return Exercises.choice(
    {
      id: `${tag}.staff.${nm}`,
      key: `music.triad.${nm}`,
      prompt: 'Welcher Dreiklang ist das?',
      correct: nm,
      wrong,
      explanation: `Die Töne sind ${tones(t)}.`,
      media: MusicKit.staff('treble', triadNotes(t), { chord: true }),
    },
    random,
  );
}

function staffKind(random: LearnRandom, level: number): LearnExercise | null {
  const t = pickTriad(level, random);
  if (!t) return null;
  const nm = triadName(t);
  const notes = triadNotes(t);
  const third = pitchMidi(notes[1]) - pitchMidi(notes[0]);
  return Exercises.choice(
    {
      id: `${tag}.kind.${nm}`,
      key: `music.triad.${nm}`,
      prompt: 'Ist das ein Dur- oder ein Moll-Dreiklang?',
      correct: kindWord(t),
      wrong: [t.quality === 'major' ? 'Moll' : 'Dur'],
      explanation: `Die Terz liegt ${third} Halbtöne über dem Grundton: ` + (t.quality === 'major' ? 'große Terz, Dur.' : 'kleine Terz, Moll.'),
      media: MusicKit.staff('treble', notes, { chord: true }),
    },
    random,
  );
}

function hearKind(random: LearnRandom, level: number): LearnExercise | null {
  const t = pickTriad(Math.max(level, 2), random);
  const octave = t ? random.randomElement([3, 4]) : undefined;
  if (!t || octave === undefined) return null;
  const nm = triadName(t);
  const root = n(t.root.letter, octave, t.root.alteration);
  const notes = triadNotes(makeTriad(root, t.quality));
  return Exercises.choice(
    {
      id: `${tag}.hear.${nm}.${octave}`,
      key: `music.triad.${nm}`,
      prompt: 'Hör hin: Dur oder Moll?',
      correct: kindWord(t),
      wrong: [t.quality === 'major' ? 'Moll' : 'Dur'],
      explanation: t.quality === 'major' ? 'Dur klingt hell: Die Terz ist groß.' : 'Moll klingt dunkler: Die Terz ist klein.',
      media: ExerciseMedia.tones(toneSpec(notes.map(pitchMidi), true)),
    },
    random,
  );
}

function missing(random: LearnRandom, level: number): LearnExercise | null {
  const t = pickTriad(level, random);
  const hidden = t ? random.randomElement([0, 1, 2]) : undefined;
  if (!t || hidden === undefined) return null;
  const nm = triadName(t);
  const notes = triadNotes(t);
  const shown = notes.map((p, i) => (i === hidden ? '?' : germanName(p))).join(' – ');
  const wrong = MusicKit.wrongNames(notes[hidden], false, random);
  return Exercises.choice(
    {
      id: `${tag}.missing.${nm}.${hidden}`,
      key: `music.triad.${nm}`,
      prompt: `${nm}: ${shown}. Welcher Ton fehlt?`,
      correct: germanName(notes[hidden]),
      wrong,
      explanation: `${nm} besteht aus ${tones(t)}.`,
    },
    random,
  );
}

function typedPart(random: LearnRandom, level: number): LearnExercise | null {
  const t = pickTriad(level, random);
  const part = t ? random.randomElement([1, 2]) : undefined;
  if (!t || part === undefined) return null;
  const nm = triadName(t);
  const word = part === 1 ? 'Terz' : 'Quinte';
  return MusicKit.typedNote({
    id: `${tag}.part.${nm}.${part}`,
    key: `music.triad.${nm}`,
    prompt: `Wie heißt die ${word} des ${nm}-Dreiklangs?`,
    answer: triadNotes(t)[part],
    explanation: `${nm} besteht aus ${tones(t)}.`,
  });
}

function buildBank(random: LearnRandom, level: number): LearnExercise | null {
  const t = pickTriad(level, random);
  if (!t) return null;
  const nm = triadName(t);
  const notes = triadNotes(t);
  const otherThird = triadNotes(makeTriad(t.root, t.quality === 'major' ? 'minor' : 'major'))[1];
  const extra = [germanName(otherThird), ...MusicKit.wrongNames(notes[2], false, random).slice(0, 1)];
  return Exercises.bank(
    {
      id: `${tag}.bank.${nm}`,
      key: `music.triad.${nm}`,
      prompt: `Baue den ${nm}-Dreiklang. Lege Grundton, Terz und Quinte der Reihe nach.`,
      words: notes.map(germanName),
      extra,
      explanation: 'Dur: große Terz und kleine Terz. Moll: kleine Terz und große Terz.',
    },
    random,
  );
}

function pairs(random: LearnRandom, level: number): LearnExercise | null {
  const pool = upTo(level === 3 ? 3 : level);
  const chosen = random.shuffled(pool).slice(0, 4);
  if (chosen.length !== 4) return null;
  return Exercises.pairs(
    {
      id: `${tag}.pairs.` + chosen.map(triadName).sort(compareStrings).join('-'),
      prompt: 'Welche Töne gehören zum Dreiklang?',
      items: chosen.map((c) => ({ key: `music.triad.${triadName(c)}`, front: triadName(c), back: tones(c) })),
    },
    random,
  );
}

function key(random: LearnRandom, level: number): LearnExercise | null {
  const t = pickTriad(level, random);
  const part = t ? random.randomElement([0, 1, 2]) : undefined;
  if (!t || part === undefined) return null;
  const nm = triadName(t);
  const word = ['den Grundton', 'die Terz', 'die Quinte'][part];
  const notes = triadNotes(t);
  return Exercises.key({
    id: `${tag}.key.${nm}.${part}`,
    key: `music.triad.${nm}`,
    prompt: `Tippe ${word} des ${nm}-Dreiklangs.`,
    midi: MusicKit.keys(notes[part]),
    solution: germanName(notes[part]),
    explanation: `${nm} besteht aus ${tones(t)}.`,
  });
}

function fact(random: LearnRandom, level: number): LearnExercise | null {
  return MusicKit.fact(unit7Facts, level, tag, random);
}

export const unit7Facts: MusicFact[] = [
  makeFact("names", 1, "Wie heißen die drei Töne eines Dreiklangs?", "Grundton, Terz, Quinte", ["Prim, Sekunde, Terz", "Grundton, Quarte, Sexte", "Terz, Quinte, Septime"], "Die Töne stehen im Abstand von Terzen übereinander."),
  makeFact("major", 1, "Wie ist ein Dur-Dreiklang aufgebaut?", "große Terz und darüber kleine Terz", ["kleine Terz und darüber große Terz", "zwei große Terzen", "zwei kleine Terzen"], "C–E ist eine große Terz, E–G eine kleine."),
  makeFact("cmajor", 1, "Welche Töne hat der C-Dur-Dreiklang?", "C, E, G", ["C, Es, G", "C, F, G", "C, E, A"], "Jeder zweite Buchstabe: C E G."),
  makeFact("minor", 2, "Wie ist ein Moll-Dreiklang aufgebaut?", "kleine Terz und darüber große Terz", ["große Terz und darüber kleine Terz", "zwei große Terzen", "zwei kleine Terzen"], "A–C ist eine kleine Terz, C–E eine große."),
  makeFact("change", 2, "Wie wird aus einem Dur-Dreiklang ein Moll-Dreiklang?", "Die Terz wird einen Halbton tiefer.", ["Die Quinte wird einen Halbton tiefer.", "Der Grundton wird einen Halbton höher.", "Die Terz wird einen Halbton höher."], "C E G wird zu C Es G."),
  makeFact("fifth", 2, "Wie viele Halbtöne liegen in einem Dur- oder Moll-Dreiklang zwischen Grundton und Quinte?", "7", ["5", "6", "8"], "Die Quinte ist rein und hat sieben Halbtöne."),
  makeFact("esdur", 3, "Welche Töne hat der Es-Dur-Dreiklang?", "Es, G, B", ["Es, G, H", "Es, Ges, B", "E, G, B"], "Es–G ist eine große Terz, G–B eine kleine."),
  makeFact("fminor", 3, "Welche Töne hat der F-Moll-Dreiklang?", "F, As, C", ["F, A, C", "F, As, Ces", "F, G, C"], "F–As ist eine kleine Terz, As–C eine große."),
  makeFact("gminor", 3, "Welche Töne hat der G-Moll-Dreiklang?", "G, B, D", ["G, H, D", "G, B, Des", "G, A, D"], "G–B ist eine kleine Terz, B–D eine große."),
];


export const unit7Def: MusicUnitDef = {
  makers: { fact, staffName, staffKind, hearKind, missing, typed: typedPart, buildBank, pairs, key },
  lessons: [
    ['fact', 'fact', 'staffName', 'staffName', 'missing', 'missing', 'buildBank', 'buildBank', 'typed', 'typed', 'pairs'],
    ['fact', 'fact', 'staffKind', 'staffKind', 'hearKind', 'hearKind', 'hearKind', 'staffName', 'missing', 'buildBank', 'typed', 'key'],
    ['fact', 'staffName', 'staffName', 'staffKind', 'hearKind', 'hearKind', 'missing', 'missing', 'buildBank', 'buildBank', 'typed', 'typed'],
  ],
  practice: ['fact', 'staffName', 'staffKind', 'hearKind', 'hearKind', 'missing', 'buildBank', 'typed', 'pairs', 'key', '~', '~'],
  checkpoint: ['fact', 'fact', 'staffName', 'staffName', 'staffKind', 'hearKind', 'hearKind', 'hearKind', 'missing', 'buildBank', 'typed', 'typed', 'pairs', 'key'],
  review: ['staffName', 'hearKind', 'missing', 'typed'],
};
