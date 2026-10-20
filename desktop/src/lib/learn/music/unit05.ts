import type { LearnExercise } from '../exercise';
import { bank as makeBank, choice, pairs as makePairs } from '../exercises';
import type { Pitch } from '../media';
import { LearnRandom } from '../random';
import { MusicKit, MusicMaker, MusicUnitDef, fact as mf } from './kit';
import { MusicScale, germanName } from './theory';

const tag = 'music.u05';
const n = (letter: number, octave: number, alteration = 0): Pitch => MusicKit.note(letter, octave, alteration);

/** The scales of each lesson: C and G major; F and D major; B flat major and three natural minor scales. */
const fresh: MusicScale[][] = [
  [new MusicScale(n(0, 4), 'major'), new MusicScale(n(4, 4), 'major')],
  [new MusicScale(n(3, 4), 'major'), new MusicScale(n(1, 4), 'major')],
  [new MusicScale(n(6, 4, -1), 'major'), new MusicScale(n(5, 4), 'naturalMinor'), new MusicScale(n(2, 4), 'naturalMinor'), new MusicScale(n(1, 4), 'naturalMinor')],
];
const all = (): MusicScale[] => fresh.flat();
const upTo = (level: number): MusicScale[] => (level >= 4 ? all() : fresh.slice(0, level).flat());
const scaleOf = (level: number, random: LearnRandom): MusicScale | null => MusicKit.draw(level >= 4 ? all() : fresh[level - 1], upTo(level), level, random);

const names = (s: MusicScale): string[] => s.notes.map(germanName);

/** A degree (2 to 7) of the scale, most often one with a sign. */
function degreeOf(scale: MusicScale, random: LearnRandom): number | null {
  const notes = scale.notes;
  const signed = [1, 2, 3, 4, 5, 6].filter((i) => notes[i].alteration !== 0);
  if (signed.length > 0 && random.int(10) < 6) return MusicKit.pick(signed, random);
  return MusicKit.pick([1, 2, 3, 4, 5, 6], random);
}

const missing: MusicMaker = (random, level) => {
  const s = scaleOf(level, random);
  const d = s ? degreeOf(s, random) : null;
  if (!s || d === null) return null;
  const notes = s.notes;
  const shown = notes.map((p, i) => (i === d ? '?' : germanName(p))).join(' – ');
  return choice(random, {
    id: `${tag}.missing.${s.name}.${d}`, key: `music.scale.${s.name}`, prompt: `${s.name}: ${shown}. Welcher Ton fehlt?`, correct: germanName(notes[d]),
    wrong: MusicKit.wrongNames(notes[d], random),
    explanation: `In ${s.name} ist der ${d + 1}. Ton ${germanName(notes[d])}: Jeder Buchstabe kommt einmal vor, und die Halbtonschritte sitzen richtig.`,
  });
};

const degreeType: MusicMaker = (random, level) => {
  const s = scaleOf(level, random);
  const d = s ? degreeOf(s, random) : null;
  if (!s || d === null) return null;
  return MusicKit.typedNote({
    id: `${tag}.degree.${s.name}.${d}`, key: `music.scale.${s.name}`, prompt: `Wie heißt der ${d + 1}. Ton der ${s.name}-Tonleiter?`, answer: s.notes[d],
    explanation: `${s.name}: ${names(s).join(' ')}.`,
  });
};

const scaleStaff: MusicMaker = (random, level) => {
  const s = scaleOf(level, random);
  if (!s) return null;
  const others = random.shuffled(all().filter((x) => x.name !== s.name));
  const sameTonic = others.filter((x) => x.tonic.letter === s.tonic.letter && x.tonic.alteration === s.tonic.alteration);
  return choice(random, {
    id: `${tag}.staff.${s.name}`, key: `music.scale.${s.name}`, prompt: 'Welche Tonleiter ist das?', correct: s.name, wrong: [...sameTonic, ...others].map((x) => x.name),
    explanation: `Die Töne sind ${names(s).join(' ')}.`, media: MusicKit.staff('treble', s.notes),
  });
};

const kind: MusicMaker = (random, level) => {
  const s = scaleOf(level, random);
  if (!s) return null;
  const isMajor = s.kind === 'major';
  return choice(random, {
    id: `${tag}.kind.${s.name}`, key: `music.scale.${s.name}`, prompt: 'Ist das eine Dur- oder eine Molltonleiter?', correct: isMajor ? 'Dur' : 'Moll',
    wrong: [isMajor ? 'Moll' : 'Dur'],
    explanation: isMajor ? 'Der dritte Ton liegt eine große Terz über dem Grundton: Dur.' : 'Der dritte Ton liegt eine kleine Terz über dem Grundton: Moll.',
    media: MusicKit.staff('treble', s.notes),
  });
};

const scaleBank: MusicMaker = (random, level) => {
  const s = scaleOf(level, random);
  if (!s) return null;
  const notes = s.notes.slice(0, -1);
  const extra: string[] = [];
  for (const d of [3, 6, 2]) extra.push(...MusicKit.wrongNames(notes[d], random).slice(0, 2));
  return makeBank(random, {
    id: `${tag}.bank.${s.name}`, key: `music.scale.${s.name}`, prompt: `Baue die ${s.name}-Tonleiter. Lege die Töne der Reihe nach.`,
    words: notes.map(germanName), extra, explanation: 'Das Muster der Ganz- und Halbtonschritte bestimmt die Vorzeichen.',
  });
};

const accChoice: MusicMaker = (random, level) => {
  const s = scaleOf(level, random);
  const count = s ? s.accidentalCount : null;
  if (!s || count === null) return null;
  const wrong = [count + 1, count - 1, -count, count + 2].filter((c) => c !== count && Math.abs(c) <= 3).map((c) => MusicKit.signNames(c));
  return choice(random, {
    id: `${tag}.acc.${s.name}`, key: `music.scale.${s.name}`, prompt: `Welche Vorzeichen hat ${s.name}?`, correct: MusicKit.signNames(count), wrong,
    explanation: `${s.name} hat die Töne ${names(s).slice(0, -1).join(' ')}.`,
  });
};

const pairsAcc: MusicMaker = (random, level) => {
  const majors = upTo(level === 3 ? 4 : level).filter((s) => s.kind === 'major');
  const chosen = random.shuffled(majors).slice(0, 4);
  if (chosen.length !== 4) return null;
  const items: Array<{ key: string; front: string; back: string }> = [];
  for (const s of chosen) {
    const count = s.accidentalCount;
    if (count !== null) items.push({ key: `music.scale.${s.name}`, front: s.name, back: MusicKit.signNames(count) });
  }
  return makePairs(random, { id: `${tag}.pairs.${chosen.map((s) => s.name).sort().join('-')}`, prompt: 'Welche Vorzeichen gehören dazu?', items });
};

const patternBank: MusicMaker = (random, level) => {
  const major = level < 3 || random.bool();
  const words = major ? ['ganz', 'ganz', 'halb', 'ganz', 'ganz', 'ganz', 'halb'] : ['ganz', 'halb', 'ganz', 'ganz', 'halb', 'ganz', 'ganz'];
  return makeBank(random, {
    id: `${tag}.pattern.${major ? 'dur' : 'moll'}`, key: `music.pattern.${major ? 'dur' : 'moll'}`,
    prompt: `Lege die Schritte der ${major ? 'Dur' : 'natürlichen Moll'}tonleiter der Reihe nach.`, words,
    explanation: major ? 'Dur: ganz, ganz, halb, ganz, ganz, ganz, halb.' : 'Natürliches Moll: ganz, halb, ganz, ganz, halb, ganz, ganz.',
  });
};

const facts = () => [
  mf('pattern', 1, 'Welches Stufenmuster hat jede Durtonleiter?', { correct: 'ganz, ganz, halb, ganz, ganz, ganz, halb', wrong: ['ganz, halb, ganz, ganz, halb, ganz, ganz', 'ganz, ganz, ganz, halb, ganz, ganz, halb', 'halb, ganz, ganz, ganz, halb, ganz, ganz'], explanation: 'Das ist das Muster von C-Dur auf den weißen Tasten.' }),
  mf('halfSteps', 1, 'Zwischen welchen Stufen liegen in Dur die Halbtonschritte?', { correct: '3.–4. und 7.–8. Stufe', wrong: ['2.–3. und 5.–6. Stufe', '1.–2. und 4.–5. Stufe', '4.–5. und 7.–8. Stufe'], explanation: 'In C-Dur sind es E–F und H–C.' }),
  mf('cdur', 1, 'Welche Tasten braucht die C-Dur-Tonleiter?', { correct: 'nur weiße Tasten', wrong: ['eine schwarze Taste', 'zwei schwarze Tasten', 'nur schwarze Tasten'], explanation: 'C D E F G A H C haben keine Vorzeichen.' }),
  mf('fis', 1, 'Warum hat G-Dur ein Fis?', { correct: 'Sonst läge zwischen 7. Ton und Grundton ein Ganzton.', wrong: ['Sonst wäre die Tonleiter zu tief.', 'Weil G-Dur mit einem Be beginnt.', 'Weil Dur immer ein Kreuz braucht.'], explanation: 'Vor dem Grundton muss ein Halbton liegen: Fis–G.' }),
  mf('letters', 2, 'Warum heißt der vierte Ton von F-Dur B und nicht Ais?', { correct: 'Nach A kommt in der Tonleiter der Buchstabe H.', wrong: ['Weil B tiefer klingt als Ais.', 'Weil F-Dur Kreuze braucht.'], explanation: 'Jeder Buchstabe kommt in einer Tonleiter genau einmal vor.' }),
  mf('bflat', 2, 'Welcher Ton ist in F-Dur anders als in C-Dur?', { correct: 'B statt H', wrong: ['Fis statt F', 'Es statt E', 'Cis statt C'], explanation: 'Damit der Halbton zwischen 3. und 4. Stufe liegt, wird H zu B.' }),
  mf('dsharp', 2, 'Welche Vorzeichen hat D-Dur?', { correct: 'Fis und Cis', wrong: ['Fis', 'B und Es', 'Cis und Gis'], explanation: 'D E Fis G A H Cis D.' }),
  mf('minorPattern', 3, 'Welches Stufenmuster hat die natürliche Molltonleiter?', { correct: 'ganz, halb, ganz, ganz, halb, ganz, ganz', wrong: ['ganz, ganz, halb, ganz, ganz, ganz, halb', 'ganz, halb, ganz, ganz, ganz, halb, ganz', 'halb, ganz, ganz, halb, ganz, ganz, ganz'], explanation: 'Das Muster entspricht den weißen Tasten von A nach A.' }),
  mf('minorHalf', 3, 'Zwischen welchen Stufen liegen in natürlichem Moll die Halbtonschritte?', { correct: '2.–3. und 5.–6. Stufe', wrong: ['3.–4. und 7.–8. Stufe', '1.–2. und 4.–5. Stufe', '2.–3. und 6.–7. Stufe'], explanation: 'In A-Moll sind es H–C und E–F.' }),
  mf('minorThird', 3, 'Woran erkennt man Moll am schnellsten?', { correct: 'an der kleinen Terz über dem Grundton', wrong: ['an der großen Terz über dem Grundton', 'an der Quinte', 'an dem Halbton am Ende'], explanation: 'Der dritte Ton liegt in Moll nur drei Halbtöne über dem Grundton.' }),
  mf('bdur', 3, 'Welche Vorzeichen hat B-Dur?', { correct: 'B und Es', wrong: ['nur B', 'Fis und Cis', 'B, Es und As'], explanation: 'B C D Es F G A B.' }),
];

const fact: MusicMaker = (random, level): LearnExercise | null => MusicKit.fact(facts(), level, tag, random);

export const MusicUnit5 = {
  tag, fresh, all, upTo, scale: scaleOf, facts,
  def: {
    makers: { fact, missing, degree: degreeType, scaleStaff, kind, scaleBank, accChoice, pairsAcc, patternBank },
    lessons: [
      ['fact', 'fact', 'patternBank', 'missing', 'missing', 'scaleStaff', 'scaleStaff', 'scaleBank', 'degree', 'degree'],
      ['fact', 'missing', 'missing', 'missing', 'scaleStaff', 'scaleStaff', 'scaleBank', 'degree', 'degree', 'accChoice', 'pairsAcc'],
      ['fact', 'fact', 'kind', 'kind', 'missing', 'scaleStaff', 'scaleStaff', 'scaleBank', 'degree', 'degree', 'patternBank'],
    ],
    practice: ['fact', 'missing', 'missing', 'scaleStaff', 'kind', 'scaleBank', 'degree', 'degree', 'accChoice', 'pairsAcc', '~', '~'],
    checkpoint: ['fact', 'fact', 'missing', 'missing', 'scaleStaff', 'scaleStaff', 'kind', 'scaleBank', 'degree', 'degree', 'accChoice', 'accChoice', 'pairsAcc', 'patternBank'],
    review: ['missing', 'scaleStaff', 'degree', 'accChoice'],
  } as MusicUnitDef,
};
