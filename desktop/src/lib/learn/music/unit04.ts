import type { LearnExercise } from '../exercise';
import { bank as makeBank, choice, pairs as makePairs, pianoKey } from '../exercises';
import { Pitch, midiOf, tones } from '../media';
import { LearnRandom } from '../random';
import { MusicKit, MusicMaker, MusicUnitDef, fact as mf } from './kit';
import { MusicNames, germanName, letterNames, scientificName, spelled } from './theory';

const tag = 'music.u04';
const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);

/** Letters that can be raised or lowered to a note with its own name (no Eis, His, Fes or Ces). */
const raisable = [0, 1, 3, 4, 5];
const lowerable = [6, 2, 5, 1, 4];

function accidental(random: LearnRandom): Pitch | null {
  const sharp = MusicKit.pick([true, false], random);
  const octave = MusicKit.pick([4, 5], random);
  const letter = sharp === null ? null : MusicKit.pick(sharp ? raisable : lowerable, random);
  if (sharp === null || octave === null || letter === null) return null;
  return n(letter, octave, sharp ? 1 : -1);
}

function sentence(p: Pitch): string {
  const base = letterNames[p.letter];
  return p.alteration > 0 ? `${germanName(p)} ist ${base} mit Kreuz: einen Halbton höher.` : `${germanName(p)} ist ${base} mit Be: einen Halbton tiefer.`;
}

const acc: MusicMaker = (random) => {
  const p = accidental(random);
  if (!p) return null;
  return choice(random, {
    id: `${tag}.acc.${scientificName(p)}`, key: `music.acc.${germanName(p)}`, prompt: 'Wie heißt diese Note?', correct: germanName(p),
    wrong: MusicKit.wrongNames(p, random), explanation: sentence(p), media: MusicKit.staff('treble', [p]),
  });
};

const accType: MusicMaker = (random) => {
  const p = accidental(random);
  if (!p) return null;
  return MusicKit.typedNote({ id: `${tag}.acctype.${scientificName(p)}`, key: `music.acc.${germanName(p)}`, prompt: 'Schreibe den Namen dieser Note.', answer: p, explanation: sentence(p), media: MusicKit.staff('treble', [p]) });
};

/** Two notes a half or a whole step apart, as a lower and an upper pitch. */
function stepPair(random: LearnRandom): [Pitch, Pitch] | null {
  for (let attempt = 0; attempt < 20; attempt++) {
    const letter = MusicKit.pick([0, 1, 2, 3, 4, 5, 6], random);
    const kind = MusicKit.pick([0, 1, 2, 3], random);
    if (letter === null || kind === null) return null;
    const octave = 4;
    const nextLetter = (letter + 1) % 7;
    const nextOctave = letter === 6 ? octave + 1 : octave;
    let lower: Pitch;
    let upper: Pitch;
    switch (kind) {
      case 0: lower = n(letter, octave); upper = n(nextLetter, nextOctave); break;
      case 1: lower = n(letter, octave); upper = n(letter, octave, 1); break;
      case 2: lower = n(letter, octave); upper = n(nextLetter, nextOctave, -1); break;
      default:
        if (!raisable.includes(letter)) continue;
        lower = n(letter, octave, 1); upper = n(nextLetter, nextOctave);
    }
    const diff = midiOf(upper) - midiOf(lower);
    if (diff >= 1 && diff <= 2) return [lower, upper];
  }
  return null;
}

const stepKind: MusicMaker = (random) => {
  const pair = stepPair(random);
  if (!pair) return null;
  const [lower, upper] = pair;
  const semis = midiOf(upper) - midiOf(lower);
  return choice(random, {
    id: `${tag}.step.${scientificName(lower)}.${scientificName(upper)}`, key: 'music.step', prompt: 'Wie groß ist der Schritt zwischen den beiden Noten?',
    correct: semis === 1 ? 'Halbton' : 'Ganzton', wrong: [semis === 1 ? 'Ganzton' : 'Halbton'],
    explanation: `Von ${germanName(lower)} nach ${germanName(upper)} sind es ${semis} Halbton${semis === 1 ? '.' : 'schritte.'}`, media: MusicKit.staff('treble', [lower, upper]),
  });
};

const hearStep: MusicMaker = (random) => {
  const start = MusicKit.pick(Array.from({ length: 13 }, (_, i) => 57 + i), random);
  const semis = MusicKit.pick([1, 2], random);
  if (start === null || semis === null) return null;
  return choice(random, {
    id: `${tag}.hear.${start}.${semis}`, key: 'music.hearstep', prompt: 'Hör hin: Ist der Schritt ein Halbton oder ein Ganzton?', correct: semis === 1 ? 'Halbton' : 'Ganzton',
    wrong: [semis === 1 ? 'Ganzton' : 'Halbton'], explanation: 'Ein Halbton ist ein Schritt zur nächsten Taste, ein Ganzton sind zwei Tasten.',
    media: { kind: 'tones', tones: tones([start, start + semis]) },
  });
};

function place(p: Pitch): string {
  const base = letterNames[p.letter];
  if (p.alteration > 0) return `${germanName(p)} liegt als schwarze Taste direkt rechts neben ${base}.`;
  return `${germanName(p)} liegt als schwarze Taste direkt links neben ${base}.`;
}

const keyBlack: MusicMaker = (random) => {
  const p = accidental(random);
  if (!p) return null;
  const p4 = n(p.letter, 4, p.alteration);
  const named = random.bool();
  const text = MusicKit.octaveText(p4);
  if (named && text !== null) {
    return pianoKey({ id: `${tag}.key.${scientificName(p4)}`, key: `music.acc.${germanName(p)}`, prompt: `Tippe ${text}.`, midi: [midiOf(p4)], solution: germanName(p), explanation: place(p) });
  }
  return pianoKey({ id: `${tag}.key.any.${germanName(p)}`, key: `music.acc.${germanName(p)}`, prompt: `Tippe ein ${germanName(p)}.`, midi: MusicKit.keys(p), solution: germanName(p), explanation: place(p) });
};

const enharmonic = [{ sharp: 'Cis', flat: 'Des' }, { sharp: 'Dis', flat: 'Es' }, { sharp: 'Fis', flat: 'Ges' }, { sharp: 'Gis', flat: 'As' }, { sharp: 'Ais', flat: 'B' }];

const enharmPairs: MusicMaker = (random) => {
  const chosen = random.shuffled(enharmonic).slice(0, 4);
  return makePairs(random, {
    id: `${tag}.enh.${chosen.map((c) => c.sharp).sort().join('-')}`, prompt: 'Welche Namen gehören zur selben Taste?',
    items: chosen.map((c) => ({ key: `music.enh.${c.sharp}`, front: c.sharp, back: c.flat })),
  });
};

const enharmChoice: MusicMaker = (random) => {
  const pair = MusicKit.pick(enharmonic, random);
  const asSharp = MusicKit.pick([true, false], random);
  if (!pair || asSharp === null) return null;
  const given = asSharp ? pair.sharp : pair.flat;
  const answer = asSharp ? pair.flat : pair.sharp;
  const parsed = MusicNames.parse(answer);
  if (!parsed) return null;
  return choice(random, {
    id: `${tag}.enh.${given}`, key: `music.enh.${pair.sharp}`, prompt: `Welcher Name gehört zur selben schwarzen Taste wie ${given}?`, correct: answer,
    wrong: MusicKit.wrongNames(n(parsed.letter, 4, parsed.alteration), random), explanation: `${pair.sharp} und ${pair.flat} sind dieselbe Taste.`,
  });
};

const raise: MusicMaker = (random) => {
  const letter = MusicKit.pick(raisable, random);
  if (letter === null) return null;
  const base = n(letter, 4);
  const result = n(letter, 4, 1);
  return MusicKit.typedNote({ id: `${tag}.raise.${germanName(base)}`, key: `music.acc.${germanName(result)}`, prompt: `Erhöhe ${germanName(base)} um einen Halbton. Wie heißt der neue Ton?`, answer: result, explanation: 'Erhöhte Töne bekommen die Endung -is.' });
};

const lower: MusicMaker = (random) => {
  const letter = MusicKit.pick(lowerable, random);
  if (letter === null) return null;
  const base = n(letter, 4);
  const result = n(letter, 4, -1);
  return MusicKit.typedNote({ id: `${tag}.lower.${germanName(base)}`, key: `music.acc.${germanName(result)}`, prompt: `Erniedrige ${germanName(base)} um einen Halbton. Wie heißt der neue Ton?`, answer: result, explanation: 'Erniedrigte Töne bekommen die Endung -es; E wird Es, A wird As und H wird B.' });
};

const terms: MusicMaker = (random) => makePairs(random, {
  id: `${tag}.terms`, prompt: 'Was bedeutet das Wort?',
  items: [
    { key: 'music.term.sharp', front: 'Kreuz', back: 'erhöht um einen Halbton' },
    { key: 'music.term.flat', front: 'Be', back: 'erniedrigt um einen Halbton' },
    { key: 'music.term.natural', front: 'Auflösungszeichen', back: 'hebt Kreuz oder Be wieder auf' },
    { key: 'music.term.semitone', front: 'Halbton', back: 'kleinster Abstand zwischen zwei Tasten' },
  ],
});

const bank: MusicMaker = (random) => {
  const start = MusicKit.pick([0, 1, 3, 4, 5], random);
  if (start === null) return null;
  const first = n(start, 4);
  const notes = [0, 1, 2, 3, 4].map((i) => spelled(midiOf(first) + i));
  return makeBank(random, {
    id: `${tag}.bank.${germanName(first)}`, key: 'music.bank.chromatic', prompt: 'Wie heißen die Noten? Lege sie der Reihe nach.',
    words: notes.map(germanName), explanation: 'Hier geht es in Halbtonschritten aufwärts.', media: MusicKit.staff('treble', notes),
  });
};

const facts = () => [
  mf('sharp', 1, 'Was bewirkt ein Kreuz vor einer Note?', { correct: 'Der Ton wird einen Halbton höher.', wrong: ['Der Ton wird einen Halbton tiefer.', 'Der Ton wird einen Ganzton höher.', 'Der Ton wird aufgehoben.'], explanation: 'Das Kreuz erhöht um einen Halbton.' }),
  mf('flat', 1, 'Welches Zeichen erniedrigt eine Note um einen Halbton?', { correct: 'Be', wrong: ['Kreuz', 'Auflösungszeichen'], explanation: 'Das Be erniedrigt um einen Halbton.' }),
  mf('natural', 1, 'Welches Zeichen hebt ein Kreuz oder ein Be wieder auf?', { correct: 'Auflösungszeichen', wrong: ['Kreuz', 'Be'], explanation: 'Das Auflösungszeichen macht den Ton wieder zur weißen Taste.' }),
  mf('bar', 1, 'Wie lange gilt ein Vorzeichen vor einer Note?', { correct: 'bis zum Ende des Taktes', wrong: ['bis zum Ende des Stücks', 'bis zur nächsten Pause', 'nur für die nächste Note im nächsten Takt'], explanation: 'Ein Vorzeichen gilt für denselben Ton bis zum Taktstrich.' }),
  mf('cis', 1, 'Was ist Cis?', { correct: 'C, einen Halbton erhöht', wrong: ['C, einen Halbton erniedrigt', 'D, einen Halbton erhöht', 'C, einen Ganzton erhöht'], explanation: 'Die Endung -is zeigt einen erhöhten Ton an.' }),
  mf('des', 1, 'Was ist Des?', { correct: 'D, einen Halbton erniedrigt', wrong: ['D, einen Halbton erhöht', 'C, einen Halbton erniedrigt', 'D, einen Ganzton erniedrigt'], explanation: 'Die Endung -es zeigt einen erniedrigten Ton an.' }),
  mf('hb', 1, 'Wie heißt H mit einem Be?', { correct: 'B', wrong: ['Hes', 'His', 'Ces'], explanation: 'H mit Be heißt B.' }),
  mf('es', 1, 'Wie heißt E mit einem Be?', { correct: 'Es', wrong: ['Eis', 'Fes', 'Des'], explanation: 'E mit Be heißt Es.' }),
  mf('as', 1, 'Wie heißt A mit einem Be?', { correct: 'As', wrong: ['Ais', 'Ges', 'G'], explanation: 'A mit Be heißt As.' }),
  mf('whole', 2, 'Wie viele Halbtöne sind ein Ganzton?', { correct: '2', wrong: ['1', '3', '4'], explanation: 'Ein Ganzton besteht aus zwei Halbtönen.' }),
  mf('semitone', 2, 'Was ist ein Halbton?', { correct: 'der Schritt zur nächsten Taste', wrong: ['der Schritt zur übernächsten Taste', 'der Schritt von C nach D', 'der Abstand einer Oktave'], explanation: 'Der Halbton ist der kleinste Schritt auf dem Klavier.' }),
  mf('hc', 2, 'Zwischen welchen weißen Tasten liegt ein Halbton?', { correct: 'H und C', wrong: ['C und D', 'D und E', 'G und A'], explanation: 'Zwischen H und C gibt es keine schwarze Taste.' }),
  mf('ef', 2, 'Zwischen welchen weißen Tasten liegt ein Halbton?', { correct: 'E und F', wrong: ['F und G', 'A und H', 'D und E'], explanation: 'Zwischen E und F gibt es keine schwarze Taste.' }),
  mf('black', 2, 'Wie viele schwarze Tasten hat eine Oktave?', { correct: '5', wrong: ['7', '4', '12'], explanation: 'Zwei und drei schwarze Tasten ergeben fünf.' }),
  mf('twelve', 2, 'Wie viele Halbtonschritte hat eine Oktave?', { correct: '12', wrong: ['7', '8', '10'], explanation: 'Sieben weiße und fünf schwarze Tasten ergeben zwölf.' }),
  mf('sameKey', 3, 'Was gilt für Cis und Des?', { correct: 'Sie sind dieselbe Taste mit zwei Namen.', wrong: ['Cis ist höher als Des.', 'Cis ist tiefer als Des.', 'Beide sind weiße Tasten.'], explanation: 'Das nennt man enharmonische Verwechslung.' }),
  mf('enharmonic', 3, 'Wie nennt man Töne mit gleicher Taste, aber verschiedenem Namen?', { correct: 'enharmonisch verwechselt', wrong: ['chromatisch', 'diatonisch', 'parallel'], explanation: 'Zum Beispiel Fis und Ges.' }),
];

const fact: MusicMaker = (random, level): LearnExercise | null => MusicKit.fact(facts(), level, tag, random);

export const MusicUnit4 = {
  tag, raisable, lowerable, accidental, facts,
  def: {
    makers: { fact, acc, accType, stepKind, hearStep, keyBlack, enharmPairs, enharmChoice, raise, lower, terms, bank },
    lessons: [
      ['fact', 'fact', 'fact', 'acc', 'acc', 'acc', 'terms', 'accType', 'accType', 'accType'],
      ['fact', 'fact', 'stepKind', 'stepKind', 'hearStep', 'hearStep', 'keyBlack', 'keyBlack', 'keyBlack', 'acc', 'accType', 'bank'],
      ['fact', 'fact', 'enharmChoice', 'enharmChoice', 'enharmPairs', 'keyBlack', 'raise', 'raise', 'lower', 'lower', 'accType', 'acc'],
    ],
    practice: ['fact', 'acc', 'stepKind', 'hearStep', 'keyBlack', 'enharmChoice', 'enharmPairs', 'raise', 'lower', 'bank', '~', '~'],
    checkpoint: ['fact', 'fact', 'acc', 'acc', 'accType', 'accType', 'stepKind', 'hearStep', 'keyBlack', 'keyBlack', 'enharmChoice', 'enharmPairs', 'raise', 'lower'],
    review: ['acc', 'accType', 'keyBlack', 'stepKind'],
  } as MusicUnitDef,
};
