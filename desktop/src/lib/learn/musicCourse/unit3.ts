// Unit 3: note values, rests and counting beats in a bar. A port of Lernwerk/Services/Learn/Music/MusicUnit3.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import { ExerciseMedia } from '../media';
import { type NoteValue, type Pitch, type StaffNote, staffNote, staffSpec } from '../music';
import type { LearnRandom } from '../random';
import { compareStrings } from '../util';
import { fact as makeFact, type MusicFact, MusicKit, type MusicUnitDef } from './kit';
import { barSixteenths, beatsOf, meter as makeMeter, type MusicMeter, meterText, noteName, ORDERED_VALUES, restName, sixteenths } from './rhythm';
import { scientificName } from './theory';

const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);
const tag = 'music.u03';

export const unit3FreshValues: NoteValue[][] = [['whole', 'half', 'quarter'], ['eighth', 'sixteenth'], []];
const allValues = ORDERED_VALUES;
const pitches = [n(0, 5), n(1, 5), n(2, 5), n(4, 4), n(5, 4), n(6, 4)];

const valuesUpTo = (level: number): NoteValue[] => (level >= 2 ? allValues : unit3FreshValues[0]);

function value(level: number, random: LearnRandom): NoteValue | undefined {
  const fresh = level >= 4 ? allValues : unit3FreshValues[level - 1];
  return MusicKit.draw(fresh, valuesUpTo(level), level, random);
}

function plural(v: NoteValue): string {
  switch (v) {
    case 'whole': return 'Ganze Noten';
    case 'half': return 'Halbe Noten';
    case 'quarter': return 'Viertelnoten';
    case 'eighth': return 'Achtelnoten';
    case 'sixteenth': return 'Sechzehntelnoten';
  }
}

function shortName(v: NoteValue): string {
  switch (v) {
    case 'whole': return 'Ganze';
    case 'half': return 'Halbe';
    case 'quarter': return 'Viertel';
    case 'eighth': return 'Achtel';
    case 'sixteenth': return 'Sechzehntel';
  }
}

function acceptedNames(v: NoteValue): string[] {
  switch (v) {
    case 'whole': return ['Ganze', 'Ganznote', 'Ganzenote'];
    case 'half': return ['Halbe', 'Halbnote'];
    default: return [shortName(v)];
  }
}

const beats = (v: NoteValue): string => MusicKit.beatText(beatsOf(makeMeter(4, 4), v));

/** The other values, the nearest in length first. */
function others(v: NoteValue): NoteValue[] {
  const index = Math.max(0, allValues.indexOf(v));
  const dist = (x: NoteValue): number => Math.abs(Math.max(0, allValues.indexOf(x)) - index);
  return allValues.filter((x) => x !== v).sort((a, b) => dist(a) - dist(b));
}

function single(v: NoteValue, rest: boolean, p: Pitch, time: string | null = null): ExerciseMedia {
  return ExerciseMedia.staff(staffSpec('treble', [staffNote(p, v, rest)], { time }));
}

function name(random: LearnRandom, level: number): LearnExercise | null {
  const v = value(level, random);
  const p = v === undefined ? undefined : MusicKit.pick(pitches, random);
  if (v === undefined || !p) return null;
  return Exercises.choice(
    {
      id: `${tag}.name.${v}.${scientificName(p)}`,
      key: `music.value.${v}`,
      prompt: 'Wie heißt dieser Notenwert?',
      correct: noteName(v),
      wrong: others(v).map(noteName),
      explanation: `${noteName(v)}: ${beats(v)} Schlag(e) im 4/4-Takt.`,
      media: single(v, false, p),
    },
    random,
  );
}

function nameRest(random: LearnRandom, _level: number): LearnExercise | null {
  const v = MusicKit.pick(allValues, random);
  if (v === undefined) return null;
  return Exercises.choice(
    {
      id: `${tag}.rest.${v}`,
      key: `music.rest.${v}`,
      prompt: 'Wie heißt diese Pause?',
      correct: restName(v),
      wrong: others(v).map(restName),
      explanation: `${restName(v)}: sie dauert so lang wie die ${noteName(v)}.`,
      media: single(v, true, n(6, 4)),
    },
    random,
  );
}

function valueType(random: LearnRandom, level: number): LearnExercise | null {
  const v = value(level, random);
  const p = v === undefined ? undefined : MusicKit.pick(pitches, random);
  if (v === undefined || !p) return null;
  return Exercises.typed({
    id: `${tag}.valuetype.${v}.${scientificName(p)}`,
    key: `music.value.${v}`,
    prompt: 'Wie heißt dieser Notenwert?',
    answer: noteName(v),
    alternatives: acceptedNames(v),
    mode: 'exact',
    explanation: `${noteName(v)}: ${beats(v)} Schlag(e) im 4/4-Takt.`,
    media: single(v, false, p),
  });
}

function restType(random: LearnRandom, _level: number): LearnExercise | null {
  const v = MusicKit.pick(allValues, random);
  if (v === undefined) return null;
  let alternatives: string[];
  if (v === 'whole') alternatives = ['Ganzpause', 'Ganze'];
  else if (v === 'half') alternatives = ['Halbpause', 'Halbe'];
  else alternatives = [shortName(v)];
  return Exercises.typed({
    id: `${tag}.resttype.${v}`,
    key: `music.rest.${v}`,
    prompt: `Wie heißt die Pause, die so lang ist wie eine ${noteName(v)}?`,
    answer: restName(v),
    alternatives,
    mode: 'exact',
    explanation: 'Zu jedem Notenwert gibt es eine Pause gleicher Länge.',
  });
}

function beatsChoice(random: LearnRandom, level: number): LearnExercise | null {
  const v = value(level, random);
  const p = v === undefined ? undefined : MusicKit.pick(pitches, random);
  if (v === undefined || !p) return null;
  const wrong = others(v).map((o) => beats(o));
  return Exercises.choice(
    {
      id: `${tag}.beats.${v}.${scientificName(p)}`,
      key: `music.value.${v}`,
      prompt: 'Wie viele Schläge dauert diese Note im 4/4-Takt?',
      correct: beats(v),
      wrong,
      explanation: `Im 4/4-Takt ist eine Viertelnote ein Schlag; die ${noteName(v)} dauert ${beats(v)}.`,
      media: single(v, false, p, '4/4'),
    },
    random,
  );
}

function beatsType(random: LearnRandom, level: number): LearnExercise | null {
  const v = value(level, random);
  if (v === undefined) return null;
  const text = beats(v);
  return Exercises.typed({
    id: `${tag}.beatstype.${v}`,
    key: `music.value.${v}`,
    prompt: `Wie viele Schläge dauert eine ${noteName(v)} im 4/4-Takt? Schreibe eine Zahl.`,
    answer: text,
    mode: 'number',
    solution: `${text} Schlag` + (text === '1' ? '' : 'e'),
    explanation: `Eine Viertelnote ist ein Schlag; eine ${noteName(v)} dauert ${text}.`,
  });
}

interface Ratio {
  big: NoteValue;
  small: NoteValue;
  count: number;
}

function ratios(level: number): Ratio[] {
  const pool = valuesUpTo(level);
  const result: Ratio[] = [];
  for (const big of pool) {
    for (const small of pool) {
      if (sixteenths(small) < sixteenths(big)) result.push({ big, small, count: Math.trunc(sixteenths(big) / sixteenths(small)) });
    }
  }
  return result;
}

function ratio(random: LearnRandom, level: number): LearnExercise | null {
  const r = MusicKit.pick(ratios(level), random);
  if (!r) return null;
  return Exercises.typed({
    id: `${tag}.ratio.${r.big}.${r.small}`,
    key: `music.ratio.${r.big}.${r.small}`,
    prompt: `Wie viele ${plural(r.small)} dauern so lang wie eine ${noteName(r.big)}? Schreibe eine Zahl.`,
    answer: `${r.count}`,
    mode: 'number',
    explanation: 'Jeder Notenwert ist halb so lang wie der vorige.',
  });
}

function ratioChoice(random: LearnRandom, level: number): LearnExercise | null {
  const r = MusicKit.pick(ratios(level), random);
  if (!r) return null;
  const wrong = [r.count * 2, Math.trunc(r.count / 2), r.count + 1, r.count - 1, 3].filter((c) => c > 0 && c !== r.count).map(String);
  return Exercises.choice(
    {
      id: `${tag}.ratiochoice.${r.big}.${r.small}`,
      key: `music.ratio.${r.big}.${r.small}`,
      prompt: `Wie viele ${plural(r.small)} passen in eine ${noteName(r.big)}?`,
      correct: `${r.count}`,
      wrong,
      explanation: 'Jeder Notenwert ist halb so lang wie der vorige.',
    },
    random,
  );
}

function pairing(rest: boolean, random: LearnRandom): LearnExercise | null {
  const chosen = random.shuffled(allValues).slice(0, 4);
  const items = chosen.map((v) => {
    const text = beats(v);
    return { key: `music.value.${v}`, front: rest ? restName(v) : noteName(v), back: text === '1' ? '1 Schlag' : `${text} Schläge` };
  });
  const fixed = items.map((item) =>
    item.back === '1/2 Schläge' ? { ...item, back: '1/2 Schlag' } : item.back === '1/4 Schläge' ? { ...item, back: '1/4 Schlag' } : item,
  );
  const id = `${tag}.pairs${rest ? 'rest' : ''}.` + chosen.slice().sort(compareStrings).join('-');
  return Exercises.pairs({ id, prompt: 'Wie lange dauert es im 4/4-Takt?', items: fixed }, random);
}

const pairs = (random: LearnRandom, _level: number): LearnExercise | null => pairing(false, random);
const pairsRest = (random: LearnRandom, _level: number): LearnExercise | null => pairing(true, random);

function order(random: LearnRandom, level: number): LearnExercise | null {
  const pool = valuesUpTo(level);
  const count = Math.min(4, pool.length);
  const chosen = random.shuffled(pool).slice(0, count).sort((a, b) => sixteenths(b) - sixteenths(a));
  return Exercises.bank(
    {
      id: `${tag}.order.` + chosen.join('-'),
      key: 'music.order',
      prompt: 'Ordne die Notenwerte vom längsten zum kürzesten.',
      words: chosen.map(shortName),
      explanation: 'Ganze, Halbe, Viertel, Achtel, Sechzehntel: jede Note ist halb so lang wie die davor.',
    },
    random,
  );
}

/** A bar of notes and rests that needs exactly `missing` to be full. */
export function bar(m: MusicMeter, missing: NoteValue, random: LearnRandom): StaffNote[] | null {
  const choices: NoteValue[] = ['half', 'quarter', 'quarter', 'eighth'];
  for (let attempt = 0; attempt < 30; attempt++) {
    let remaining = barSixteenths(m) - sixteenths(missing);
    const notes: StaffNote[] = [];
    while (remaining > 0 && notes.length <= 5) {
      const usable = choices.filter((c) => sixteenths(c) <= remaining);
      const v = random.randomElement(usable);
      if (v === undefined) break;
      const p = MusicKit.pick(pitches, random);
      if (!p) break;
      const isRest = random.int(0, 4) === 0;
      notes.push(staffNote(isRest ? n(6, 4) : p, v, isRest));
      remaining -= sixteenths(v);
    }
    if (remaining === 0 && notes.length >= 1 && notes.length <= 5) return notes;
  }
  return null;
}

interface BarSetup {
  meter: MusicMeter;
  missing: NoteValue;
  notes: StaffNote[];
}

function barSetup(random: LearnRandom, wholeBeatsOnly: boolean): BarSetup | null {
  const meters = [makeMeter(4, 4), makeMeter(3, 4)];
  const missings: NoteValue[] = wholeBeatsOnly ? ['half', 'quarter'] : ['half', 'quarter', 'eighth'];
  const m = MusicKit.pick(meters, random);
  if (!m) return null;
  const missing = MusicKit.pick(missings, random);
  if (missing === undefined) return null;
  const notes = bar(m, missing, random);
  if (!notes) return null;
  return { meter: m, missing, notes };
}

function signature(notes: StaffNote[]): string {
  return notes.map((x) => (x.isRest ? 'r' : 'n') + x.value.slice(0, 2)).join('-');
}

function barMedia(setup: BarSetup): ExerciseMedia {
  return ExerciseMedia.staff(staffSpec('treble', setup.notes, { time: meterText(setup.meter) }));
}

function fill(random: LearnRandom, _level: number): LearnExercise | null {
  const setup = barSetup(random, false);
  if (!setup) return null;
  const media = barMedia(setup);
  const mt = meterText(setup.meter);
  return Exercises.choice(
    {
      id: `${tag}.fill.${setup.meter.beats}.${setup.missing}.${signature(setup.notes)}`,
      key: 'music.fill',
      prompt: `Im ${mt}-Takt fehlt noch eine Note. Welcher Notenwert macht den Takt voll?`,
      correct: noteName(setup.missing),
      wrong: others(setup.missing).map(noteName),
      explanation: `Der ${mt}-Takt hat ${setup.meter.beats} Viertel; mit der ${noteName(setup.missing)} wird er genau voll.`,
      media,
    },
    random,
  );
}

function fillType(random: LearnRandom, _level: number): LearnExercise | null {
  const setup = barSetup(random, false);
  if (!setup) return null;
  const media = barMedia(setup);
  const mt = meterText(setup.meter);
  return Exercises.typed({
    id: `${tag}.filltype.${setup.meter.beats}.${setup.missing}.${signature(setup.notes)}`,
    key: 'music.fill',
    prompt: `Welcher Notenwert fehlt, damit der ${mt}-Takt voll ist?`,
    answer: noteName(setup.missing),
    alternatives: acceptedNames(setup.missing),
    mode: 'exact',
    explanation: `Der ${mt}-Takt hat ${setup.meter.beats} Viertel; mit der ${noteName(setup.missing)} wird er genau voll.`,
    media,
  });
}

function beatsInBar(random: LearnRandom, _level: number): LearnExercise | null {
  const setup = barSetup(random, true);
  if (!setup) return null;
  const total = Math.trunc((barSixteenths(setup.meter) - sixteenths(setup.missing)) / 4);
  const media = barMedia(setup);
  return Exercises.typed({
    id: `${tag}.barbeats.${setup.meter.beats}.${setup.missing}.${signature(setup.notes)}`,
    key: 'music.fill',
    prompt: 'Wie viele Schläge dauern diese Noten und Pausen zusammen? Schreibe eine Zahl.',
    answer: `${total}`,
    mode: 'number',
    explanation: 'Zähle Noten und Pausen zusammen: eine Viertel ist ein Schlag.',
    media,
  });
}

function fact(random: LearnRandom, level: number): LearnExercise | null {
  return MusicKit.fact(unit3Facts, level, tag, random);
}

export const unit3Facts: MusicFact[] = [
  makeFact('valueWord', 1, 'Wie nennt man die Länge eines Tons in der Notenschrift?', 'Notenwert', ['Tonhöhe', 'Lautstärke', 'Tonart'], 'Der Notenwert sagt, wie lange ein Ton dauert.'),
  makeFact('whole', 1, 'Welche Note dauert im 4/4-Takt einen ganzen Takt?', 'Ganze Note', ['Halbe Note', 'Viertelnote', 'Achtelnote'], 'Die Ganze Note dauert vier Schläge: so viele, wie der 4/4-Takt hat.'),
  makeFact('half', 2, 'Welche Note ist halb so lang wie eine Viertelnote?', 'Achtelnote', ['Halbe Note', 'Sechzehntelnote', 'Ganze Note'], 'Zwei Achtel dauern so lang wie eine Viertelnote.'),
  makeFact('restMeaning', 2, 'Was bedeutet eine Pause?', 'Stille für die Länge des Notenwerts', ['Der Ton wird länger gehalten', 'Der Ton wird lauter', 'Das Stück ist zu Ende'], 'In der Pause klingt nichts, aber sie wird mitgezählt.'),
  makeFact('beats44', 3, 'Wie viele Viertel hat ein 4/4-Takt?', '4', ['3', '2', '8'], 'Die obere Zahl 4 zählt die Schläge, die untere 4 meint Viertel.'),
  makeFact('beats34', 3, 'Wie viele Schläge hat ein 3/4-Takt?', '3', ['4', '2', '6'], 'Die obere Zahl nennt die Schläge pro Takt.'),
  makeFact('lower', 3, 'Was sagt die untere Zahl der Taktangabe 3/4?', 'Ein Schlag ist eine Viertelnote.', ['Ein Schlag ist eine Halbe Note.', 'Ein Schlag ist eine Achtelnote.', 'Der Takt hat vier Schläge.'], 'Die untere 4 steht für Viertel.'),
  makeFact('upper', 3, 'Was sagt die obere Zahl der Taktangabe 4/4?', 'Der Takt hat vier Schläge.', ['Der Takt hat zwei Schläge.', 'Das Stück hat vier Teile.', 'Ein Schlag ist eine Halbe Note.'], 'Die obere Zahl zählt die Schläge pro Takt.'),
  makeFact('eighths34', 3, 'Wie viele Achtelnoten passen in einen 3/4-Takt?', '6', ['3', '4', '8'], 'Drei Viertel sind sechs Achtel.'),
  makeFact('barline', 3, 'Was trennt zwei Takte voneinander?', 'der Taktstrich', ['die Hilfslinie', 'der Bogen', 'der Schlüssel'], 'Der Taktstrich steht senkrecht im Notensystem.'),
];

export const unit3Def: MusicUnitDef = {
  makers: {
    fact, name, nameRest, valueType, restType, beats: beatsChoice, beatsType, ratio, ratioChoice, pairs, pairsRest, order, fill, fillType, beatsInBar,
  },
  lessons: [
    ['fact', 'name', 'name', 'beats', 'beatsType', 'beatsType', 'ratio', 'ratio', 'order', 'valueType'],
    ['fact', 'name', 'nameRest', 'nameRest', 'ratioChoice', 'ratio', 'pairs', 'pairsRest', 'order', 'restType', 'valueType'],
    ['fact', 'fact', 'fill', 'fill', 'fill', 'beatsInBar', 'beatsInBar', 'fillType', 'fillType', 'order'],
  ],
  practice: ['fact', 'name', 'nameRest', 'beats', 'ratio', 'ratioChoice', 'pairs', 'order', 'fill', 'beatsInBar', '~', '~'],
  checkpoint: ['fact', 'name', 'nameRest', 'beats', 'beatsType', 'ratio', 'ratioChoice', 'pairs', 'pairsRest', 'order', 'fill', 'fill', 'beatsInBar', 'fillType'],
  review: ['name', 'beats', 'ratio', 'pairs'],
};
