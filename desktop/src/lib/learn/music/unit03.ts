import type { LearnExercise } from '../exercise';
import { bank as makeBank, choice, pairs as makePairs, typed } from '../exercises';
import type { ExerciseMedia, NoteValue, Pitch, StaffNote } from '../media';
import { LearnRandom } from '../random';
import { MusicKit, MusicMaker, MusicUnitDef, fact as mf } from './kit';
import { MusicMeter, noteName, noteValuesOrdered, restName, scientificName, sixteenths } from './theory';

const tag = 'music.u03';
const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);

const freshValues: NoteValue[][] = [['whole', 'half', 'quarter'], ['eighth', 'sixteenth'], []];
const allValues = noteValuesOrdered;
const pitches = [n(0, 5), n(1, 5), n(2, 5), n(4, 4), n(5, 4), n(6, 4)];

const valuesUpTo = (level: number): NoteValue[] => (level >= 2 ? allValues : freshValues[0]);

function valueOf(level: number, random: LearnRandom): NoteValue | null {
  const fresh = level >= 4 ? allValues : freshValues[level - 1];
  return MusicKit.draw(fresh, valuesUpTo(level), level, random);
}

const plural = (v: NoteValue): string => ({ whole: 'Ganze Noten', half: 'Halbe Noten', quarter: 'Viertelnoten', eighth: 'Achtelnoten', sixteenth: 'Sechzehntelnoten' })[v];
const shortName = (v: NoteValue): string => ({ whole: 'Ganze', half: 'Halbe', quarter: 'Viertel', eighth: 'Achtel', sixteenth: 'Sechzehntel' })[v];

function acceptedNames(v: NoteValue): string[] {
  switch (v) {
    case 'whole': return ['Ganze', 'Ganznote', 'Ganzenote'];
    case 'half': return ['Halbe', 'Halbnote'];
    default: return [shortName(v)];
  }
}

const beats = (v: NoteValue): string => MusicKit.beatText(new MusicMeter(4, 4).beatsOf(v));

/** The other values, the nearest in length first. */
function others(v: NoteValue): NoteValue[] {
  const index = allValues.indexOf(v);
  return allValues.filter((x) => x !== v).sort((a, b) => Math.abs(allValues.indexOf(a) - index) - Math.abs(allValues.indexOf(b) - index));
}

const single = (value: NoteValue, rest: boolean, p: Pitch, time: string | null = null): ExerciseMedia =>
  ({ kind: 'staff', staff: { clef: 'treble', keySignature: 0, time, notes: [{ pitch: p, value, isRest: rest }], chord: false } });

const name: MusicMaker = (random, level) => {
  const v = valueOf(level, random);
  const p = MusicKit.pick(pitches, random);
  if (!v || !p) return null;
  return choice(random, {
    id: `${tag}.name.${v}.${scientificName(p)}`, key: `music.value.${v}`, prompt: 'Wie heißt dieser Notenwert?',
    correct: noteName(v), wrong: others(v).map(noteName), explanation: `${noteName(v)}: ${beats(v)} Schlag(e) im 4/4-Takt.`, media: single(v, false, p),
  });
};

const nameRest: MusicMaker = (random) => {
  const v = MusicKit.pick(allValues, random);
  if (!v) return null;
  return choice(random, {
    id: `${tag}.rest.${v}`, key: `music.rest.${v}`, prompt: 'Wie heißt diese Pause?', correct: restName(v),
    wrong: others(v).map(restName), explanation: `${restName(v)}: sie dauert so lang wie die ${noteName(v)}.`, media: single(v, true, n(6, 4)),
  });
};

const valueType: MusicMaker = (random, level) => {
  const v = valueOf(level, random);
  const p = MusicKit.pick(pitches, random);
  if (!v || !p) return null;
  return typed({
    id: `${tag}.valuetype.${v}.${scientificName(p)}`, key: `music.value.${v}`, prompt: 'Wie heißt dieser Notenwert?',
    answer: noteName(v), alternatives: acceptedNames(v), mode: 'exact', explanation: `${noteName(v)}: ${beats(v)} Schlag(e) im 4/4-Takt.`, media: single(v, false, p),
  });
};

const restType: MusicMaker = (random) => {
  const v = MusicKit.pick(allValues, random);
  if (!v) return null;
  const alternatives = v === 'whole' ? ['Ganzpause', 'Ganze'] : v === 'half' ? ['Halbpause', 'Halbe'] : [shortName(v)];
  return typed({
    id: `${tag}.resttype.${v}`, key: `music.rest.${v}`, prompt: `Wie heißt die Pause, die so lang ist wie eine ${noteName(v)}?`,
    answer: restName(v), alternatives, mode: 'exact', explanation: 'Zu jedem Notenwert gibt es eine Pause gleicher Länge.',
  });
};

const beatsChoice: MusicMaker = (random, level) => {
  const v = valueOf(level, random);
  const p = MusicKit.pick(pitches, random);
  if (!v || !p) return null;
  return choice(random, {
    id: `${tag}.beats.${v}.${scientificName(p)}`, key: `music.value.${v}`, prompt: 'Wie viele Schläge dauert diese Note im 4/4-Takt?',
    correct: beats(v), wrong: others(v).map(beats), explanation: `Im 4/4-Takt ist eine Viertelnote ein Schlag; die ${noteName(v)} dauert ${beats(v)}.`,
    media: single(v, false, p, '4/4'),
  });
};

const beatsType: MusicMaker = (random, level) => {
  const v = valueOf(level, random);
  if (!v) return null;
  const text = beats(v);
  return typed({
    id: `${tag}.beatstype.${v}`, key: `music.value.${v}`, prompt: `Wie viele Schläge dauert eine ${noteName(v)} im 4/4-Takt? Schreibe eine Zahl.`,
    answer: text, mode: 'number', solution: `${text} Schlag${text === '1' ? '' : 'e'}`, explanation: `Eine Viertelnote ist ein Schlag; eine ${noteName(v)} dauert ${text}.`,
  });
};

interface Ratio { big: NoteValue; small: NoteValue; count: number }

function ratios(level: number): Ratio[] {
  const pool = valuesUpTo(level);
  const result: Ratio[] = [];
  for (const big of pool) for (const small of pool) if (sixteenths(small) < sixteenths(big)) result.push({ big, small, count: sixteenths(big) / sixteenths(small) });
  return result;
}

const ratio: MusicMaker = (random, level) => {
  const r = MusicKit.pick(ratios(level), random);
  if (!r) return null;
  return typed({
    id: `${tag}.ratio.${r.big}.${r.small}`, key: `music.ratio.${r.big}.${r.small}`,
    prompt: `Wie viele ${plural(r.small)} dauern so lang wie eine ${noteName(r.big)}? Schreibe eine Zahl.`, answer: String(r.count), mode: 'number',
    explanation: 'Jeder Notenwert ist halb so lang wie der vorige.',
  });
};

const ratioChoice: MusicMaker = (random, level) => {
  const r = MusicKit.pick(ratios(level), random);
  if (!r) return null;
  const wrong = [r.count * 2, Math.trunc(r.count / 2), r.count + 1, r.count - 1, 3].filter((x) => x > 0 && x !== r.count).map(String);
  return choice(random, {
    id: `${tag}.ratiochoice.${r.big}.${r.small}`, key: `music.ratio.${r.big}.${r.small}`, prompt: `Wie viele ${plural(r.small)} passen in eine ${noteName(r.big)}?`,
    correct: String(r.count), wrong, explanation: 'Jeder Notenwert ist halb so lang wie der vorige.',
  });
};

function pairing(rest: boolean, random: LearnRandom): LearnExercise | null {
  const chosen = random.shuffled(allValues).slice(0, 4);
  const items = chosen.map((v) => {
    const text = beats(v);
    const back = text === '1' ? '1 Schlag' : text === '1/2' ? '1/2 Schlag' : text === '1/4' ? '1/4 Schlag' : `${text} Schläge`;
    return { key: `music.value.${v}`, front: rest ? restName(v) : noteName(v), back };
  });
  const id = `${tag}.pairs${rest ? 'rest' : ''}.${[...chosen].sort().join('-')}`;
  return makePairs(random, { id, prompt: 'Wie lange dauert es im 4/4-Takt?', items });
}

const pairs: MusicMaker = (random) => pairing(false, random);
const pairsRest: MusicMaker = (random) => pairing(true, random);

const order: MusicMaker = (random, level) => {
  const pool = valuesUpTo(level);
  const count = Math.min(4, pool.length);
  const chosen = random.shuffled(pool).slice(0, count).sort((a, b) => sixteenths(b) - sixteenths(a));
  return makeBank(random, {
    id: `${tag}.order.${chosen.join('-')}`, key: 'music.order', prompt: 'Ordne die Notenwerte vom längsten zum kürzesten.', words: chosen.map(shortName),
    explanation: 'Ganze, Halbe, Viertel, Achtel, Sechzehntel: jede Note ist halb so lang wie die davor.',
  });
};

/** A bar of notes and rests that needs exactly `missing` to be full. */
export function bar(meter: MusicMeter, missing: NoteValue, random: LearnRandom): StaffNote[] | null {
  const choices: NoteValue[] = ['half', 'quarter', 'quarter', 'eighth'];
  for (let attempt = 0; attempt < 30; attempt++) {
    let remaining = meter.barSixteenths - sixteenths(missing);
    const notes: StaffNote[] = [];
    while (remaining > 0 && notes.length <= 5) {
      const usable = choices.filter((v) => sixteenths(v) <= remaining);
      const value = MusicKit.pick(usable, random);
      const p = MusicKit.pick(pitches, random);
      if (!value || !p) break;
      const isRest = random.int(4) === 0;
      notes.push({ pitch: isRest ? n(6, 4) : p, value, isRest });
      remaining -= sixteenths(value);
    }
    if (remaining === 0 && notes.length >= 1 && notes.length <= 5) return notes;
  }
  return null;
}

function barSetup(random: LearnRandom, wholeBeatsOnly: boolean): { meter: MusicMeter; missing: NoteValue; notes: StaffNote[] } | null {
  const meters = [new MusicMeter(4, 4), new MusicMeter(3, 4)];
  const missings: NoteValue[] = wholeBeatsOnly ? ['half', 'quarter'] : ['half', 'quarter', 'eighth'];
  const meter = MusicKit.pick(meters, random);
  const missing = MusicKit.pick(missings, random);
  const notes = meter && missing ? bar(meter, missing, random) : null;
  if (!meter || !missing || !notes) return null;
  return { meter, missing, notes };
}

const signature = (notes: StaffNote[]): string => notes.map((x) => (x.isRest ? 'r' : 'n') + x.value.slice(0, 2)).join('-');

const barMedia = (meter: MusicMeter, notes: StaffNote[]): ExerciseMedia => ({ kind: 'staff', staff: { clef: 'treble', keySignature: 0, time: meter.text, notes, chord: false } });

const fill: MusicMaker = (random) => {
  const setup = barSetup(random, false);
  if (!setup) return null;
  return choice(random, {
    id: `${tag}.fill.${setup.meter.beats}.${setup.missing}.${signature(setup.notes)}`, key: 'music.fill',
    prompt: `Im ${setup.meter.text}-Takt fehlt noch eine Note. Welcher Notenwert macht den Takt voll?`,
    correct: noteName(setup.missing), wrong: others(setup.missing).map(noteName),
    explanation: `Der ${setup.meter.text}-Takt hat ${setup.meter.beats} Viertel; mit der ${noteName(setup.missing)} wird er genau voll.`, media: barMedia(setup.meter, setup.notes),
  });
};

const fillType: MusicMaker = (random) => {
  const setup = barSetup(random, false);
  if (!setup) return null;
  return typed({
    id: `${tag}.filltype.${setup.meter.beats}.${setup.missing}.${signature(setup.notes)}`, key: 'music.fill',
    prompt: `Welcher Notenwert fehlt, damit der ${setup.meter.text}-Takt voll ist?`, answer: noteName(setup.missing),
    alternatives: acceptedNames(setup.missing), mode: 'exact',
    explanation: `Der ${setup.meter.text}-Takt hat ${setup.meter.beats} Viertel; mit der ${noteName(setup.missing)} wird er genau voll.`, media: barMedia(setup.meter, setup.notes),
  });
};

const beatsInBar: MusicMaker = (random) => {
  const setup = barSetup(random, true);
  if (!setup) return null;
  const total = (setup.meter.barSixteenths - sixteenths(setup.missing)) / 4;
  return typed({
    id: `${tag}.barbeats.${setup.meter.beats}.${setup.missing}.${signature(setup.notes)}`, key: 'music.fill',
    prompt: 'Wie viele Schläge dauern diese Noten und Pausen zusammen? Schreibe eine Zahl.', answer: String(total), mode: 'number',
    explanation: 'Zähle Noten und Pausen zusammen: eine Viertel ist ein Schlag.', media: barMedia(setup.meter, setup.notes),
  });
};

const facts = () => [
  mf('valueWord', 1, 'Wie nennt man die Länge eines Tons in der Notenschrift?', { correct: 'Notenwert', wrong: ['Tonhöhe', 'Lautstärke', 'Tonart'], explanation: 'Der Notenwert sagt, wie lange ein Ton dauert.' }),
  mf('whole', 1, 'Welche Note dauert im 4/4-Takt einen ganzen Takt?', { correct: 'Ganze Note', wrong: ['Halbe Note', 'Viertelnote', 'Achtelnote'], explanation: 'Die Ganze Note dauert vier Schläge: so viele, wie der 4/4-Takt hat.' }),
  mf('half', 2, 'Welche Note ist halb so lang wie eine Viertelnote?', { correct: 'Achtelnote', wrong: ['Halbe Note', 'Sechzehntelnote', 'Ganze Note'], explanation: 'Zwei Achtel dauern so lang wie eine Viertelnote.' }),
  mf('restMeaning', 2, 'Was bedeutet eine Pause?', { correct: 'Stille für die Länge des Notenwerts', wrong: ['Der Ton wird länger gehalten', 'Der Ton wird lauter', 'Das Stück ist zu Ende'], explanation: 'In der Pause klingt nichts, aber sie wird mitgezählt.' }),
  mf('beats44', 3, 'Wie viele Viertel hat ein 4/4-Takt?', { correct: '4', wrong: ['3', '2', '8'], explanation: 'Die obere Zahl 4 zählt die Schläge, die untere 4 meint Viertel.' }),
  mf('beats34', 3, 'Wie viele Schläge hat ein 3/4-Takt?', { correct: '3', wrong: ['4', '2', '6'], explanation: 'Die obere Zahl nennt die Schläge pro Takt.' }),
  mf('lower', 3, 'Was sagt die untere Zahl der Taktangabe 3/4?', { correct: 'Ein Schlag ist eine Viertelnote.', wrong: ['Ein Schlag ist eine Halbe Note.', 'Ein Schlag ist eine Achtelnote.', 'Der Takt hat vier Schläge.'], explanation: 'Die untere 4 steht für Viertel.' }),
  mf('upper', 3, 'Was sagt die obere Zahl der Taktangabe 4/4?', { correct: 'Der Takt hat vier Schläge.', wrong: ['Der Takt hat zwei Schläge.', 'Das Stück hat vier Teile.', 'Ein Schlag ist eine Halbe Note.'], explanation: 'Die obere Zahl zählt die Schläge pro Takt.' }),
  mf('eighths34', 3, 'Wie viele Achtelnoten passen in einen 3/4-Takt?', { correct: '6', wrong: ['3', '4', '8'], explanation: 'Drei Viertel sind sechs Achtel.' }),
  mf('barline', 3, 'Was trennt zwei Takte voneinander?', { correct: 'der Taktstrich', wrong: ['die Hilfslinie', 'der Bogen', 'der Schlüssel'], explanation: 'Der Taktstrich steht senkrecht im Notensystem.' }),
];

const fact: MusicMaker = (random, level) => MusicKit.fact(facts(), level, tag, random);

export const MusicUnit3 = {
  tag, freshValues, allValues, pitches, valuesUpTo, facts,
  def: {
    makers: { fact, name, nameRest, valueType, restType, beats: beatsChoice, beatsType, ratio, ratioChoice, pairs, pairsRest, order, fill, fillType, beatsInBar },
    lessons: [
      ['fact', 'name', 'name', 'beats', 'beatsType', 'beatsType', 'ratio', 'ratio', 'order', 'valueType'],
      ['fact', 'name', 'nameRest', 'nameRest', 'ratioChoice', 'ratio', 'pairs', 'pairsRest', 'order', 'restType', 'valueType'],
      ['fact', 'fact', 'fill', 'fill', 'fill', 'beatsInBar', 'beatsInBar', 'fillType', 'fillType', 'order'],
    ],
    practice: ['fact', 'name', 'nameRest', 'beats', 'ratio', 'ratioChoice', 'pairs', 'order', 'fill', 'beatsInBar', '~', '~'],
    checkpoint: ['fact', 'name', 'nameRest', 'beats', 'beatsType', 'ratio', 'ratioChoice', 'pairs', 'pairsRest', 'order', 'fill', 'fill', 'beatsInBar', 'fillType'],
    review: ['name', 'beats', 'ratio', 'pairs'],
  } as MusicUnitDef,
};
