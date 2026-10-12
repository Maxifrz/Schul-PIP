// Unit 4: sharps, flats, naturals, black keys, half and whole steps. A port of Lernwerk/Services/Learn/Music/MusicUnit4.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import { ExerciseMedia, toneSpec } from '../media';
import { type Pitch, pitchMidi } from '../music';
import type { LearnRandom } from '../random';
import { compareStrings } from '../util';
import { fact as makeFact, type MusicFact, MusicKit, type MusicUnitDef, randomBool } from './kit';
import { germanName, LETTER_NAMES, MusicNames, scientificName, spelled } from './theory';

const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);
const tag = 'music.u04';

/** Letters that can be raised or lowered to a note with its own name (no Eis, His, Fes or Ces). */
export const unit4Raisable = [0, 1, 3, 4, 5];
export const unit4Lowerable = [6, 2, 5, 1, 4];

function accidental(random: LearnRandom): Pitch | undefined {
  const sharp = random.randomElement([true, false]);
  const octave = random.randomElement([4, 5]);
  const letter = random.randomElement(sharp ? unit4Raisable : unit4Lowerable);
  if (sharp === undefined || octave === undefined || letter === undefined) return undefined;
  return n(letter, octave, sharp ? 1 : -1);
}

function sentence(p: Pitch): string {
  const base = LETTER_NAMES[p.letter];
  return p.alteration > 0
    ? `${germanName(p)} ist ${base} mit Kreuz: einen Halbton höher.`
    : `${germanName(p)} ist ${base} mit Be: einen Halbton tiefer.`;
}

function acc(random: LearnRandom, _level: number): LearnExercise | null {
  const p = accidental(random);
  if (!p) return null;
  const wrong = MusicKit.wrongNames(p, false, random);
  return Exercises.choice(
    {
      id: `${tag}.acc.${scientificName(p)}`,
      key: `music.acc.${germanName(p)}`,
      prompt: 'Wie heißt diese Note?',
      correct: germanName(p),
      wrong,
      explanation: sentence(p),
      media: MusicKit.staff('treble', [p]),
    },
    random,
  );
}

function accType(random: LearnRandom, _level: number): LearnExercise | null {
  const p = accidental(random);
  if (!p) return null;
  return MusicKit.typedNote({
    id: `${tag}.acctype.${scientificName(p)}`,
    key: `music.acc.${germanName(p)}`,
    prompt: 'Schreibe den Namen dieser Note.',
    answer: p,
    explanation: sentence(p),
    media: MusicKit.staff('treble', [p]),
  });
}

/** Two notes a half or a whole step apart, as a lower and an upper pitch. */
export function stepPair(random: LearnRandom): [Pitch, Pitch] | null {
  for (let attempt = 0; attempt < 20; attempt++) {
    const letter = random.randomElement([0, 1, 2, 3, 4, 5, 6]);
    const kind = random.randomElement([0, 1, 2, 3]);
    if (letter === undefined || kind === undefined) return null;
    const octave = 4;
    let lower: Pitch;
    let upper: Pitch;
    const nextLetter = (letter + 1) % 7;
    const nextOctave = letter === 6 ? octave + 1 : octave;
    switch (kind) {
      case 0: lower = n(letter, octave); upper = n(nextLetter, nextOctave); break;
      case 1: lower = n(letter, octave); upper = n(letter, octave, 1); break;
      case 2: lower = n(letter, octave); upper = n(nextLetter, nextOctave, -1); break;
      default:
        if (!unit4Raisable.includes(letter)) continue;
        lower = n(letter, octave, 1);
        upper = n(nextLetter, nextOctave);
    }
    const d = pitchMidi(upper) - pitchMidi(lower);
    if (d >= 1 && d <= 2) return [lower, upper];
  }
  return null;
}

function stepKind(random: LearnRandom, _level: number): LearnExercise | null {
  const pair = stepPair(random);
  if (!pair) return null;
  const [lower, upper] = pair;
  const semis = pitchMidi(upper) - pitchMidi(lower);
  const answer = semis === 1 ? 'Halbton' : 'Ganzton';
  return Exercises.choice(
    {
      id: `${tag}.step.${scientificName(lower)}.${scientificName(upper)}`,
      key: 'music.step',
      prompt: 'Wie groß ist der Schritt zwischen den beiden Noten?',
      correct: answer,
      wrong: [semis === 1 ? 'Ganzton' : 'Halbton'],
      explanation: `Von ${germanName(lower)} nach ${germanName(upper)} sind es ${semis} Halbton` + (semis === 1 ? '.' : 'schritte.'),
      media: MusicKit.staff('treble', [lower, upper]),
    },
    random,
  );
}

function hearStep(random: LearnRandom, _level: number): LearnExercise | null {
  const start = random.randomElement(Array.from({ length: 13 }, (_, i) => 57 + i));
  const semis = random.randomElement([1, 2]);
  if (start === undefined || semis === undefined) return null;
  const answer = semis === 1 ? 'Halbton' : 'Ganzton';
  return Exercises.choice(
    {
      id: `${tag}.hear.${start}.${semis}`,
      key: 'music.hearstep',
      prompt: 'Hör hin: Ist der Schritt ein Halbton oder ein Ganzton?',
      correct: answer,
      wrong: [semis === 1 ? 'Ganzton' : 'Halbton'],
      explanation: 'Ein Halbton ist ein Schritt zur nächsten Taste, ein Ganzton sind zwei Tasten.',
      media: ExerciseMedia.tones(toneSpec([start, start + semis])),
    },
    random,
  );
}

function place(p: Pitch): string {
  const base = LETTER_NAMES[p.letter];
  if (p.alteration > 0) return `${germanName(p)} liegt als schwarze Taste direkt rechts neben ${base}.`;
  return `${germanName(p)} liegt als schwarze Taste direkt links neben ${base}.`;
}

function keyBlack(random: LearnRandom, _level: number): LearnExercise | null {
  const p = accidental(random);
  if (!p) return null;
  const p4 = n(p.letter, 4, p.alteration);
  if (randomBool(random)) {
    const text = MusicKit.octaveText(p4);
    if (text !== null) {
      return Exercises.key({
        id: `${tag}.key.${scientificName(p4)}`,
        key: `music.acc.${germanName(p)}`,
        prompt: `Tippe ${text}.`,
        midi: [pitchMidi(p4)],
        solution: germanName(p),
        explanation: place(p),
      });
    }
  }
  return Exercises.key({
    id: `${tag}.key.any.${germanName(p)}`,
    key: `music.acc.${germanName(p)}`,
    prompt: `Tippe ein ${germanName(p)}.`,
    midi: MusicKit.keys(p),
    solution: germanName(p),
    explanation: place(p),
  });
}

const enharmonic: { sharp: string; flat: string }[] = [
  { sharp: 'Cis', flat: 'Des' },
  { sharp: 'Dis', flat: 'Es' },
  { sharp: 'Fis', flat: 'Ges' },
  { sharp: 'Gis', flat: 'As' },
  { sharp: 'Ais', flat: 'B' },
];

function enharmPairs(random: LearnRandom, _level: number): LearnExercise | null {
  const chosen = random.shuffled(enharmonic).slice(0, 4);
  return Exercises.pairs(
    {
      id: `${tag}.enh.` + chosen.map((c) => c.sharp).sort(compareStrings).join('-'),
      prompt: 'Welche Namen gehören zur selben Taste?',
      items: chosen.map((c) => ({ key: `music.enh.${c.sharp}`, front: c.sharp, back: c.flat })),
    },
    random,
  );
}

function enharmChoice(random: LearnRandom, _level: number): LearnExercise | null {
  const pair = MusicKit.pick(enharmonic, random);
  const asSharp = random.randomElement([true, false]);
  if (!pair || asSharp === undefined) return null;
  const given = asSharp ? pair.sharp : pair.flat;
  const answer = asSharp ? pair.flat : pair.sharp;
  const parsed = MusicNames.parse(answer);
  if (!parsed) return null;
  const wrong = MusicKit.wrongNames(n(parsed.letter, 4, parsed.alteration), false, random);
  return Exercises.choice(
    {
      id: `${tag}.enh.${given}`,
      key: `music.enh.${pair.sharp}`,
      prompt: `Welcher Name gehört zur selben schwarzen Taste wie ${given}?`,
      correct: answer,
      wrong,
      explanation: `${pair.sharp} und ${pair.flat} sind dieselbe Taste.`,
    },
    random,
  );
}

function raise(random: LearnRandom, _level: number): LearnExercise | null {
  const letter = MusicKit.pick(unit4Raisable, random);
  if (letter === undefined) return null;
  const base = n(letter, 4);
  const result = n(letter, 4, 1);
  return MusicKit.typedNote({
    id: `${tag}.raise.${germanName(base)}`,
    key: `music.acc.${germanName(result)}`,
    prompt: `Erhöhe ${germanName(base)} um einen Halbton. Wie heißt der neue Ton?`,
    answer: result,
    explanation: 'Erhöhte Töne bekommen die Endung -is.',
  });
}

function lower(random: LearnRandom, _level: number): LearnExercise | null {
  const letter = MusicKit.pick(unit4Lowerable, random);
  if (letter === undefined) return null;
  const base = n(letter, 4);
  const result = n(letter, 4, -1);
  return MusicKit.typedNote({
    id: `${tag}.lower.${germanName(base)}`,
    key: `music.acc.${germanName(result)}`,
    prompt: `Erniedrige ${germanName(base)} um einen Halbton. Wie heißt der neue Ton?`,
    answer: result,
    explanation: 'Erniedrigte Töne bekommen die Endung -es; E wird Es, A wird As und H wird B.',
  });
}

function terms(random: LearnRandom, _level: number): LearnExercise | null {
  return Exercises.pairs(
    {
      id: `${tag}.terms`,
      prompt: 'Was bedeutet das Wort?',
      items: [
        { key: 'music.term.sharp', front: 'Kreuz', back: 'erhöht um einen Halbton' },
        { key: 'music.term.flat', front: 'Be', back: 'erniedrigt um einen Halbton' },
        { key: 'music.term.natural', front: 'Auflösungszeichen', back: 'hebt Kreuz oder Be wieder auf' },
        { key: 'music.term.semitone', front: 'Halbton', back: 'kleinster Abstand zwischen zwei Tasten' },
      ],
    },
    random,
  );
}

function bank(random: LearnRandom, _level: number): LearnExercise | null {
  const start = random.randomElement([0, 1, 3, 4, 5]);
  if (start === undefined) return null;
  const first = n(start, 4);
  const notes = [0, 1, 2, 3, 4].map((i) => spelled(pitchMidi(first) + i));
  return Exercises.bank(
    {
      id: `${tag}.bank.${germanName(first)}`,
      key: 'music.bank.chromatic',
      prompt: 'Wie heißen die Noten? Lege sie der Reihe nach.',
      words: notes.map(germanName),
      explanation: 'Hier geht es in Halbtonschritten aufwärts.',
      media: MusicKit.staff('treble', notes),
    },
    random,
  );
}

function fact(random: LearnRandom, level: number): LearnExercise | null {
  return MusicKit.fact(unit4Facts, level, tag, random);
}

export const unit4Facts: MusicFact[] = [
  makeFact("sharp", 1, "Was bewirkt ein Kreuz vor einer Note?", "Der Ton wird einen Halbton höher.", ["Der Ton wird einen Halbton tiefer.", "Der Ton wird einen Ganzton höher.", "Der Ton wird aufgehoben."], "Das Kreuz erhöht um einen Halbton."),
  makeFact("flat", 1, "Welches Zeichen erniedrigt eine Note um einen Halbton?", "Be", ["Kreuz", "Auflösungszeichen"], "Das Be erniedrigt um einen Halbton."),
  makeFact("natural", 1, "Welches Zeichen hebt ein Kreuz oder ein Be wieder auf?", "Auflösungszeichen", ["Kreuz", "Be"], "Das Auflösungszeichen macht den Ton wieder zur weißen Taste."),
  makeFact("bar", 1, "Wie lange gilt ein Vorzeichen vor einer Note?", "bis zum Ende des Taktes", ["bis zum Ende des Stücks", "bis zur nächsten Pause", "nur für die nächste Note im nächsten Takt"], "Ein Vorzeichen gilt für denselben Ton bis zum Taktstrich."),
  makeFact("cis", 1, "Was ist Cis?", "C, einen Halbton erhöht", ["C, einen Halbton erniedrigt", "D, einen Halbton erhöht", "C, einen Ganzton erhöht"], "Die Endung -is zeigt einen erhöhten Ton an."),
  makeFact("des", 1, "Was ist Des?", "D, einen Halbton erniedrigt", ["D, einen Halbton erhöht", "C, einen Halbton erniedrigt", "D, einen Ganzton erniedrigt"], "Die Endung -es zeigt einen erniedrigten Ton an."),
  makeFact("hb", 1, "Wie heißt H mit einem Be?", "B", ["Hes", "His", "Ces"], "H mit Be heißt B."),
  makeFact("es", 1, "Wie heißt E mit einem Be?", "Es", ["Eis", "Fes", "Des"], "E mit Be heißt Es."),
  makeFact("as", 1, "Wie heißt A mit einem Be?", "As", ["Ais", "Ges", "G"], "A mit Be heißt As."),
  makeFact("whole", 2, "Wie viele Halbtöne sind ein Ganzton?", "2", ["1", "3", "4"], "Ein Ganzton besteht aus zwei Halbtönen."),
  makeFact("semitone", 2, "Was ist ein Halbton?", "der Schritt zur nächsten Taste", ["der Schritt zur übernächsten Taste", "der Schritt von C nach D", "der Abstand einer Oktave"], "Der Halbton ist der kleinste Schritt auf dem Klavier."),
  makeFact("hc", 2, "Zwischen welchen weißen Tasten liegt ein Halbton?", "H und C", ["C und D", "D und E", "G und A"], "Zwischen H und C gibt es keine schwarze Taste."),
  makeFact("ef", 2, "Zwischen welchen weißen Tasten liegt ein Halbton?", "E und F", ["F und G", "A und H", "D und E"], "Zwischen E und F gibt es keine schwarze Taste."),
  makeFact("black", 2, "Wie viele schwarze Tasten hat eine Oktave?", "5", ["7", "4", "12"], "Zwei und drei schwarze Tasten ergeben fünf."),
  makeFact("twelve", 2, "Wie viele Halbtonschritte hat eine Oktave?", "12", ["7", "8", "10"], "Sieben weiße und fünf schwarze Tasten ergeben zwölf."),
  makeFact("sameKey", 3, "Was gilt für Cis und Des?", "Sie sind dieselbe Taste mit zwei Namen.", ["Cis ist höher als Des.", "Cis ist tiefer als Des.", "Beide sind weiße Tasten."], "Das nennt man enharmonische Verwechslung."),
  makeFact("enharmonic", 3, "Wie nennt man Töne mit gleicher Taste, aber verschiedenem Namen?", "enharmonisch verwechselt", ["chromatisch", "diatonisch", "parallel"], "Zum Beispiel Fis und Ges."),
];


export const unit4Def: MusicUnitDef = {
  makers: { fact, acc, accType, stepKind, hearStep, keyBlack, enharmPairs, enharmChoice, raise, lower, terms, bank },
  lessons: [
    ['fact', 'fact', 'fact', 'acc', 'acc', 'acc', 'terms', 'accType', 'accType', 'accType'],
    ['fact', 'fact', 'stepKind', 'stepKind', 'hearStep', 'hearStep', 'keyBlack', 'keyBlack', 'keyBlack', 'acc', 'accType', 'bank'],
    ['fact', 'fact', 'enharmChoice', 'enharmChoice', 'enharmPairs', 'keyBlack', 'raise', 'raise', 'lower', 'lower', 'accType', 'acc'],
  ],
  practice: ['fact', 'acc', 'stepKind', 'hearStep', 'keyBlack', 'enharmChoice', 'enharmPairs', 'raise', 'lower', 'bank', '~', '~'],
  checkpoint: ['fact', 'fact', 'acc', 'acc', 'accType', 'accType', 'stepKind', 'hearStep', 'keyBlack', 'keyBlack', 'enharmChoice', 'enharmPairs', 'raise', 'lower'],
  review: ['acc', 'accType', 'keyBlack', 'stepKind'],
};
