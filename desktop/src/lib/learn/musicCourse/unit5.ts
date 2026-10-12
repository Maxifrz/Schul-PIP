// Unit 5: major scales built from whole and half steps, and the natural minor scale.
// A port of Lernwerk/Services/Learn/Music/MusicUnit5.swift.

import { Exercises } from '../exercises';
import type { LearnExercise } from '../exercise';
import type { Pitch } from '../music';
import type { LearnRandom } from '../random';
import { compareStrings } from '../util';
import { type MusicScale, scale as makeScale, scaleAccidentalCount, scaleName, scaleNotes } from './harmony';
import { fact as makeFact, type MusicFact, MusicKit, type MusicUnitDef, randomBool } from './kit';
import { germanName } from './theory';

const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);
const tag = 'music.u05';

/** The scales of each lesson: C and G major; F and D major; B flat major and three natural minor scales. */
export const unit5Fresh: MusicScale[][] = [
  [makeScale(n(0, 4), 'major'), makeScale(n(4, 4), 'major')],
  [makeScale(n(3, 4), 'major'), makeScale(n(1, 4), 'major')],
  [makeScale(n(6, 4, -1), 'major'), makeScale(n(5, 4), 'naturalMinor'), makeScale(n(2, 4), 'naturalMinor'), makeScale(n(1, 4), 'naturalMinor')],
];
export const unit5All: MusicScale[] = unit5Fresh.flat();
const upTo = (level: number): MusicScale[] => (level >= 4 ? unit5All : unit5Fresh.slice(0, level).flat());

function pickScale(level: number, random: LearnRandom): MusicScale | undefined {
  return MusicKit.draw(level >= 4 ? unit5All : unit5Fresh[level - 1], upTo(level), level, random);
}

const names = (s: MusicScale): string[] => scaleNotes(s).map(germanName);

/** A degree (2 to 7) of the scale, most often one with a sign. */
function degreeOf(s: MusicScale, random: LearnRandom): number | undefined {
  const notes = scaleNotes(s);
  const signed = [1, 2, 3, 4, 5, 6].filter((i) => notes[i].alteration !== 0);
  if (signed.length > 0 && random.int(0, 10) < 6) return random.randomElement(signed);
  return random.randomElement([1, 2, 3, 4, 5, 6]);
}

function missing(random: LearnRandom, level: number): LearnExercise | null {
  const s = pickScale(level, random);
  const d = s === undefined ? undefined : degreeOf(s, random);
  if (s === undefined || d === undefined) return null;
  const notes = scaleNotes(s);
  const nm = scaleName(s);
  const shown = notes.map((p, i) => (i === d ? '?' : germanName(p))).join(' – ');
  const wrong = MusicKit.wrongNames(notes[d], false, random);
  return Exercises.choice(
    {
      id: `${tag}.missing.${nm}.${d}`,
      key: `music.scale.${nm}`,
      prompt: `${nm}: ${shown}. Welcher Ton fehlt?`,
      correct: germanName(notes[d]),
      wrong,
      explanation: `In ${nm} ist der ${d + 1}. Ton ${germanName(notes[d])}: Jeder Buchstabe kommt einmal vor, und die Halbtonschritte sitzen richtig.`,
    },
    random,
  );
}

function degreeType(random: LearnRandom, level: number): LearnExercise | null {
  const s = pickScale(level, random);
  const d = s === undefined ? undefined : degreeOf(s, random);
  if (s === undefined || d === undefined) return null;
  const nm = scaleName(s);
  return MusicKit.typedNote({
    id: `${tag}.degree.${nm}.${d}`,
    key: `music.scale.${nm}`,
    prompt: `Wie heißt der ${d + 1}. Ton der ${nm}-Tonleiter?`,
    answer: scaleNotes(s)[d],
    explanation: `${nm}: ` + names(s).join(' ') + '.',
  });
}

function scaleStaff(random: LearnRandom, level: number): LearnExercise | null {
  const s = pickScale(level, random);
  if (s === undefined) return null;
  const nm = scaleName(s);
  const others = random.shuffled(unit5All.filter((x) => scaleName(x) !== nm));
  const sameTonic = others.filter((x) => x.tonic.letter === s.tonic.letter && x.tonic.alteration === s.tonic.alteration);
  const wrong = [...sameTonic, ...others].map(scaleName);
  return Exercises.choice(
    {
      id: `${tag}.staff.${nm}`,
      key: `music.scale.${nm}`,
      prompt: 'Welche Tonleiter ist das?',
      correct: nm,
      wrong,
      explanation: 'Die Töne sind ' + names(s).join(' ') + '.',
      media: MusicKit.staff('treble', scaleNotes(s)),
    },
    random,
  );
}

function kind(random: LearnRandom, level: number): LearnExercise | null {
  const s = pickScale(level, random);
  if (s === undefined) return null;
  const nm = scaleName(s);
  const isMajor = s.kind === 'major';
  return Exercises.choice(
    {
      id: `${tag}.kind.${nm}`,
      key: `music.scale.${nm}`,
      prompt: 'Ist das eine Dur- oder eine Molltonleiter?',
      correct: isMajor ? 'Dur' : 'Moll',
      wrong: [isMajor ? 'Moll' : 'Dur'],
      explanation: isMajor
        ? 'Der dritte Ton liegt eine große Terz über dem Grundton: Dur.'
        : 'Der dritte Ton liegt eine kleine Terz über dem Grundton: Moll.',
      media: MusicKit.staff('treble', scaleNotes(s)),
    },
    random,
  );
}

function scaleBank(random: LearnRandom, level: number): LearnExercise | null {
  const s = pickScale(level, random);
  if (s === undefined) return null;
  const nm = scaleName(s);
  const notes = scaleNotes(s).slice(0, -1);
  const extra: string[] = [];
  for (const d of [3, 6, 2]) extra.push(...MusicKit.wrongNames(notes[d], false, random).slice(0, 2));
  return Exercises.bank(
    {
      id: `${tag}.bank.${nm}`,
      key: `music.scale.${nm}`,
      prompt: `Baue die ${nm}-Tonleiter. Lege die Töne der Reihe nach.`,
      words: notes.map(germanName),
      extra,
      explanation: 'Das Muster der Ganz- und Halbtonschritte bestimmt die Vorzeichen.',
    },
    random,
  );
}

function accChoice(random: LearnRandom, level: number): LearnExercise | null {
  const s = pickScale(level, random);
  const count = s === undefined ? null : scaleAccidentalCount(s);
  if (s === undefined || count === null) return null;
  const nm = scaleName(s);
  const wrong = [count + 1, count - 1, -count, count + 2].filter((c) => c !== count && Math.abs(c) <= 3).map((c) => MusicKit.signNames(c));
  return Exercises.choice(
    {
      id: `${tag}.acc.${nm}`,
      key: `music.scale.${nm}`,
      prompt: `Welche Vorzeichen hat ${nm}?`,
      correct: MusicKit.signNames(count),
      wrong,
      explanation: `${nm} hat die Töne ` + names(s).slice(0, -1).join(' ') + '.',
    },
    random,
  );
}

function pairsAcc(random: LearnRandom, level: number): LearnExercise | null {
  const majors = upTo(level === 3 ? 4 : level).filter((x) => x.kind === 'major');
  const chosen = random.shuffled(majors).slice(0, 4);
  if (chosen.length !== 4) return null;
  const items: { key: string; front: string; back: string }[] = [];
  for (const s of chosen) {
    const count = scaleAccidentalCount(s);
    if (count === null) continue;
    items.push({ key: `music.scale.${scaleName(s)}`, front: scaleName(s), back: MusicKit.signNames(count) });
  }
  return Exercises.pairs(
    { id: `${tag}.pairs.` + chosen.map(scaleName).sort(compareStrings).join('-'), prompt: 'Welche Vorzeichen gehören dazu?', items },
    random,
  );
}

function patternBank(random: LearnRandom, level: number): LearnExercise | null {
  const major = level < 3 || randomBool(random);
  const words = major ? ['ganz', 'ganz', 'halb', 'ganz', 'ganz', 'ganz', 'halb'] : ['ganz', 'halb', 'ganz', 'ganz', 'halb', 'ganz', 'ganz'];
  return Exercises.bank(
    {
      id: `${tag}.pattern.${major ? 'dur' : 'moll'}`,
      key: `music.pattern.${major ? 'dur' : 'moll'}`,
      prompt: `Lege die Schritte der ${major ? 'Dur' : 'natürlichen Moll'}tonleiter der Reihe nach.`,
      words,
      explanation: major ? 'Dur: ganz, ganz, halb, ganz, ganz, ganz, halb.' : 'Natürliches Moll: ganz, halb, ganz, ganz, halb, ganz, ganz.',
    },
    random,
  );
}

function fact(random: LearnRandom, level: number): LearnExercise | null {
  return MusicKit.fact(unit5Facts, level, tag, random);
}

export const unit5Facts: MusicFact[] = [
  makeFact("pattern", 1, "Welches Stufenmuster hat jede Durtonleiter?", "ganz, ganz, halb, ganz, ganz, ganz, halb", ["ganz, halb, ganz, ganz, halb, ganz, ganz", "ganz, ganz, ganz, halb, ganz, ganz, halb", "halb, ganz, ganz, ganz, halb, ganz, ganz"], "Das ist das Muster von C-Dur auf den weißen Tasten."),
  makeFact("halfSteps", 1, "Zwischen welchen Stufen liegen in Dur die Halbtonschritte?", "3.–4. und 7.–8. Stufe", ["2.–3. und 5.–6. Stufe", "1.–2. und 4.–5. Stufe", "4.–5. und 7.–8. Stufe"], "In C-Dur sind es E–F und H–C."),
  makeFact("cdur", 1, "Welche Tasten braucht die C-Dur-Tonleiter?", "nur weiße Tasten", ["eine schwarze Taste", "zwei schwarze Tasten", "nur schwarze Tasten"], "C D E F G A H C haben keine Vorzeichen."),
  makeFact("fis", 1, "Warum hat G-Dur ein Fis?", "Sonst läge zwischen 7. Ton und Grundton ein Ganzton.", ["Sonst wäre die Tonleiter zu tief.", "Weil G-Dur mit einem Be beginnt.", "Weil Dur immer ein Kreuz braucht."], "Vor dem Grundton muss ein Halbton liegen: Fis–G."),
  makeFact("letters", 2, "Warum heißt der vierte Ton von F-Dur B und nicht Ais?", "Nach A kommt in der Tonleiter der Buchstabe H.", ["Weil B tiefer klingt als Ais.", "Weil F-Dur Kreuze braucht."], "Jeder Buchstabe kommt in einer Tonleiter genau einmal vor."),
  makeFact("bflat", 2, "Welcher Ton ist in F-Dur anders als in C-Dur?", "B statt H", ["Fis statt F", "Es statt E", "Cis statt C"], "Damit der Halbton zwischen 3. und 4. Stufe liegt, wird H zu B."),
  makeFact("dsharp", 2, "Welche Vorzeichen hat D-Dur?", "Fis und Cis", ["Fis", "B und Es", "Cis und Gis"], "D E Fis G A H Cis D."),
  makeFact("minorPattern", 3, "Welches Stufenmuster hat die natürliche Molltonleiter?", "ganz, halb, ganz, ganz, halb, ganz, ganz", ["ganz, ganz, halb, ganz, ganz, ganz, halb", "ganz, halb, ganz, ganz, ganz, halb, ganz", "halb, ganz, ganz, halb, ganz, ganz, ganz"], "Das Muster entspricht den weißen Tasten von A nach A."),
  makeFact("minorHalf", 3, "Zwischen welchen Stufen liegen in natürlichem Moll die Halbtonschritte?", "2.–3. und 5.–6. Stufe", ["3.–4. und 7.–8. Stufe", "1.–2. und 4.–5. Stufe", "2.–3. und 6.–7. Stufe"], "In A-Moll sind es H–C und E–F."),
  makeFact("minorThird", 3, "Woran erkennt man Moll am schnellsten?", "an der kleinen Terz über dem Grundton", ["an der großen Terz über dem Grundton", "an der Quinte", "an dem Halbton am Ende"], "Der dritte Ton liegt in Moll nur drei Halbtöne über dem Grundton."),
  makeFact("bdur", 3, "Welche Vorzeichen hat B-Dur?", "B und Es", ["nur B", "Fis und Cis", "B, Es und As"], "B C D Es F G A B."),
];


export const unit5Def: MusicUnitDef = {
  makers: { fact, missing, degree: degreeType, scaleStaff, kind, scaleBank, accChoice, pairsAcc, patternBank },
  lessons: [
    ['fact', 'fact', 'patternBank', 'missing', 'missing', 'scaleStaff', 'scaleStaff', 'scaleBank', 'degree', 'degree'],
    ['fact', 'missing', 'missing', 'missing', 'scaleStaff', 'scaleStaff', 'scaleBank', 'degree', 'degree', 'accChoice', 'pairsAcc'],
    ['fact', 'fact', 'kind', 'kind', 'missing', 'scaleStaff', 'scaleStaff', 'scaleBank', 'degree', 'degree', 'patternBank'],
  ],
  practice: ['fact', 'missing', 'missing', 'scaleStaff', 'kind', 'scaleBank', 'degree', 'degree', 'accChoice', 'pairsAcc', '~', '~'],
  checkpoint: ['fact', 'fact', 'missing', 'missing', 'scaleStaff', 'scaleStaff', 'kind', 'scaleBank', 'degree', 'degree', 'accChoice', 'accChoice', 'pairsAcc', 'patternBank'],
  review: ['missing', 'scaleStaff', 'degree', 'accChoice'],
};
