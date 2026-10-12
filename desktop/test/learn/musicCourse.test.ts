// Port of LernwerkTests/MusicCourseTests.swift: structure, audit, and the facts of the exercises re-computed from tables
// written down here, independent of the code that generated them.
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import type { CourseNode, NodeKind } from '../../src/lib/learn/course';
import { LearnAnswer, type LearnExercise, missedKeys } from '../../src/lib/learn/exercise';
import { pitch, pitchDiatonic, pitchMidi, type StaffNote, type StaffSpec } from '../../src/lib/learn/music';
import type { ToneSpec } from '../../src/lib/learn/media';
import { LETTER_NAMES, MusicNames, musicProvider as provider, sixteenths } from '../../src/lib/learn/musicCourse';
import { germanName, pitchClass } from '../../src/lib/learn/musicCourse/theory';

const seeds: bigint[] = Array.from({ length: 20 }, (_, i) => BigInt(i + 1));

interface Item { node: CourseNode; exercise: LearnExercise }

const cache = new Map<string, Item[]>();
function all(unit: number, kinds: NodeKind[] = ['lesson', 'practice', 'checkpoint'], own = true): Item[] {
  const key = `${unit}|${kinds.join()}|${own}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const prefix = `music.u${String(unit).padStart(2, '0')}.`;
  const result: Item[] = [];
  for (const node of provider.course.nodes) {
    if (node.unitNumber !== unit || !kinds.includes(node.kind)) continue;
    for (const seed of seeds) {
      for (const exercise of provider.exercises(node, seed)) if (!own || exercise.id.startsWith(prefix)) result.push({ node, exercise });
    }
  }
  cache.set(key, result);
  return result;
}

const staff = (e: LearnExercise): StaffSpec | null => (e.media?.type === 'staff' ? e.media.staff : null);
const tones = (e: LearnExercise): ToneSpec | null => (e.media?.type === 'tones' ? e.media.tones : null);
const sixteenthsOf = (n: StaffNote): number => sixteenths(n.value);
const typed = (e: LearnExercise, text: string): Set<string> => missedKeys(e, LearnAnswer.typed(text));
const parsePitch = (name: string, octave = 4) => {
  const parsed = MusicNames.parse(name)!;
  return pitch(parsed.letter, octave, parsed.alteration);
};

describe('music course structure', () => {
  it('course shape', () => {
    const course = provider.course;
    expect(course.id).toBe('music');
    expect(course.title).toBe('Musik');
    expect(course.subtitle).toBe('Noten lesen, hören, verstehen');
    expect(course.kind).toBe('music');
    expect(course.color).toBe(0x9e6b8e);
    expect(course.symbol).toBe('music.note');
    expect(course.units.length).toBe(8);
    expect(course.sections.flatMap((s) => s.units).length).toBe(8);
    for (const unit of course.units) {
      expect(unit.nodes.length).toBe(6);
      const paragraphs = unit.tip.split('\n\n');
      expect(paragraphs.length >= 2 && paragraphs.length <= 5, `${unit.id} tip has ${paragraphs.length} paragraphs`).toBe(true);
      expect(unit.summary).not.toBe('');
    }
    expect(course.units.map((u) => u.title)).toEqual([
      'Notenlinien und Violinschlüssel', 'Bassschlüssel und Klaviatur', 'Notenwerte und Pausen', 'Vorzeichen', 'Tonleitern', 'Intervalle',
      'Dreiklänge', 'Tonarten und Quintenzirkel',
    ]);
  });

  it('audit is clean', () => {
    expect(CourseAudit.problems(provider, seeds)).toEqual([]);
  });

  it('every node has two kinds and no emoji or placeholder', () => {
    const emoji = /\p{Emoji_Presentation}/u;
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') continue;
      for (const seed of seeds) {
        const list = provider.exercises(node, seed);
        expect(new Set(list.map((e) => e.kind)).size, `${node.id} seed ${seed}`).toBeGreaterThanOrEqual(2);
        for (const e of list) {
          const text = [e.prompt, e.solution, e.explanation, ...e.options, ...e.correctAnswers].join(' ');
          expect(text.includes('TODO')).toBe(false);
          expect(emoji.test(text)).toBe(false);
        }
      }
    }
  });

  it('seeds change the exercises', () => {
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') continue;
      const ids = (s: bigint) => provider.exercises(node, s).map((e) => e.id);
      const a = ids(1n), b = ids(2n), c = ids(3n);
      expect(JSON.stringify(a) !== JSON.stringify(b) || JSON.stringify(a) !== JSON.stringify(c), `${node.id} ignores the seed`).toBe(true);
    }
  });

  it('practice mixes earlier units', () => {
    for (let unit = 2; unit <= 8; unit++) {
      const ids = new Set(all(unit, ['practice'], false).map((i) => i.exercise.id));
      const prefix = `music.u${String(unit).padStart(2, '0')}.`;
      expect([...ids].some((id) => !id.startsWith(prefix)), `practice of unit ${unit} has no review`).toBe(true);
    }
  });

  it('some variety per unit', () => {
    for (let unit = 1; unit <= 8; unit++) {
      const ids = new Set(all(unit).map((i) => i.exercise.id));
      expect(ids.size, `unit ${unit} has only ${ids.size} distinct exercises`).toBeGreaterThan(60);
    }
  });
});

describe('music course typed answers and options', () => {
  it('typed note names accept both cases', () => {
    let checked = 0;
    for (let unit = 1; unit <= 8; unit++) {
      for (const { exercise } of all(unit)) {
        if (exercise.kind !== 'typeAnswer' || exercise.mode !== 'exact') continue;
        const answer = exercise.correctAnswers[0];
        if (answer === undefined || MusicNames.parse(answer) === null) continue;
        for (const text of [answer, answer.toLowerCase(), ' ' + answer + ' ']) {
          expect(typed(exercise, text).size, `${exercise.id} rejects ${text}`).toBe(0);
        }
        const parsed = MusicNames.parse(answer)!;
        const neighbour = germanName(pitch((parsed.letter + 1) % 7, 4, parsed.alteration));
        expect(typed(exercise, neighbour).size, `${exercise.id} accepts ${neighbour}`).toBeGreaterThan(0);
        expect(typed(exercise, answer + 'is').size).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('no choice offers an enharmonic of the answer', () => {
    let checked = 0;
    for (let unit = 1; unit <= 8; unit++) {
      for (const { exercise } of all(unit)) {
        if (exercise.kind !== 'multipleChoice') continue;
        const answer = exercise.correctAnswers[0];
        const right = answer === undefined ? null : MusicNames.parse(answer);
        if (!right) continue;
        const rightClass = pitchClass(pitch(right.letter, 4, right.alteration));
        for (const option of exercise.options) {
          if (option === answer) continue;
          const parsed = MusicNames.parse(option);
          if (!parsed) continue;
          expect(pitchClass(pitch(parsed.letter, 4, parsed.alteration)), `${exercise.id}: ${option} sounds like ${answer}`).not.toBe(rightClass);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('no signs before they are taught', () => {
    for (let unit = 1; unit <= 3; unit++) {
      for (const { exercise } of all(unit)) {
        for (const text of [...exercise.options, ...exercise.correctAnswers, exercise.prompt]) {
          const parsed = MusicNames.parse(text);
          if (parsed) expect(parsed.alteration, `${exercise.id}: ${text}`).toBe(0);
        }
        const spec = staff(exercise);
        if (spec) expect(spec.notes.every((n) => n.pitch.alteration === 0), exercise.id).toBe(true);
      }
    }
  });
});

const trebleNames = ['E', 'F', 'G', 'A', 'H', 'C', 'D', 'E', 'F', 'G', 'A'];
const bassNames = ['G', 'A', 'H', 'C', 'D', 'E', 'F', 'G', 'A', 'H', 'C'];

function expectedName(note: StaffNote, clef: string): string | null {
  const diatonic = note.pitch.octave * 7 + note.pitch.letter;
  if (clef === 'treble') {
    const step = diatonic - (4 * 7 + 2);
    if (step >= 0 && step <= 10) return trebleNames[step];
    return step === -1 ? 'D' : step === -2 ? 'C' : null;
  }
  if (clef === 'bass') {
    const step = diatonic - (2 * 7 + 4);
    if (step >= 0 && step <= 10) return bassNames[step];
    return step === -1 ? 'F' : step === -2 ? 'E' : null;
  }
  return null;
}

describe('units 1 and 2: reading the staff', () => {
  it('staff reading answers match the staff', () => {
    let checked = 0;
    for (let unit = 1; unit <= 2; unit++) {
      for (const { exercise } of all(unit)) {
        if (!(exercise.id.includes('.read.') || exercise.id.includes('.type.') || exercise.id.includes('.mixed.'))) continue;
        const spec = staff(exercise);
        expect(spec && spec.notes.length > 0, `${exercise.id} has no staff`).toBe(true);
        expect(exercise.correctAnswers[0], exercise.id).toBe(expectedName(spec!.notes[0], spec!.clef));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('place and compare questions', () => {
    const phrases: Record<string, number> = {
      'auf der 1. Linie': 0, 'im 1. Zwischenraum': 1, 'auf der 2. Linie': 2, 'im 2. Zwischenraum': 3, 'auf der 3. Linie': 4,
      'im 3. Zwischenraum': 5, 'auf der 4. Linie': 6, 'im 4. Zwischenraum': 7, 'auf der 5. Linie': 8, 'über der 5. Linie': 9,
      'auf der 1. Hilfslinie über dem System': 10,
    };
    for (let unit = 1; unit <= 2; unit++) {
      for (const { exercise } of all(unit)) {
        if (!exercise.id.includes('.place.')) continue;
        const names = unit === 1 ? trebleNames : bassNames;
        let step: number | undefined;
        for (const [phrase, value] of Object.entries(phrases)) if (exercise.prompt.includes(phrase)) step = Math.max(step ?? -99, value);
        if (step !== undefined) expect(exercise.correctAnswers[0], exercise.id).toBe(names[step]);
        else if (exercise.prompt.includes('unter der 1. Linie')) expect(exercise.correctAnswers[0]).toBe(unit === 1 ? 'D' : 'F');
        else if (exercise.prompt.includes('Hilfslinie unter dem System')) expect(exercise.correctAnswers[0]).toBe(unit === 1 ? 'C' : 'E');
        else throw new Error(`unknown position in ${exercise.prompt}`);
      }
    }
    for (const { exercise } of all(2)) {
      if (!exercise.id.includes('.compare.')) continue;
      const step = Number(exercise.id.split('.').pop());
      expect(exercise.prompt.includes(`heißt sie ${trebleNames[step]}`)).toBe(true);
      expect(exercise.correctAnswers[0]).toBe(bassNames[step]);
      expect(exercise.options.includes(trebleNames[step]), 'the wrong clef reading is offered').toBe(true);
    }
  });

  it('keyboard questions', () => {
    const pitchClasses: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11 };
    let named = 0, anyOctave = 0, fromStaff = 0;
    for (const { exercise } of all(2)) {
      if (exercise.kind !== 'pianoKey') continue;
      const keys = exercise.correctAnswers.map((a) => parseInt(a, 10));
      expect(keys.length).toBe(exercise.correctAnswers.length);
      if (exercise.prompt.startsWith('Tippe das ')) {
        expect(keys.length, exercise.prompt).toBe(1);
        const words = exercise.prompt.split(' ');
        const last = words[words.length - 1];
        const letter = last.slice(0, -1).toUpperCase();
        const octave = exercise.prompt.includes('eingestrichene') ? 4 : exercise.prompt.includes('zweigestrichene') ? 5 : exercise.prompt.includes('kleine') ? 3 : 2;
        expect(keys[0], exercise.prompt).toBe(12 * (octave + 1) + pitchClasses[letter]);
        named++;
      } else if (exercise.prompt.startsWith('Tippe ein ')) {
        const letter = exercise.prompt.slice('Tippe ein '.length).slice(0, 1);
        expect(keys.every((k) => k % 12 === pitchClasses[letter]), exercise.prompt).toBe(true);
        expect(keys.length).toBe(MusicNames.keys(pitchClasses[letter]).length);
        anyOctave++;
      } else {
        const spec = staff(exercise);
        if (spec && spec.notes.length > 0) {
          expect(keys).toEqual([pitchMidi(spec.notes[0].pitch)]);
          fromStaff++;
        }
      }
    }
    expect(named).toBeGreaterThan(20);
    expect(anyOctave).toBeGreaterThan(20);
    expect(fromStaff).toBeGreaterThan(20);
    const middle = all(2).filter((i) => i.exercise.prompt === 'Tippe das eingestrichene c.');
    expect(middle.length).toBeGreaterThan(0);
    for (const item of middle) expect(item.exercise.correctAnswers).toEqual(['60']);
  });
});

const sixteenthsByName: Record<string, number> = {
  'Ganze Note': 16, 'Halbe Note': 8, Viertelnote: 4, Achtelnote: 2, Sechzehntelnote: 1,
  'Ganze Pause': 16, 'Halbe Pause': 8, Viertelpause: 4, Achtelpause: 2, Sechzehntelpause: 1,
};
const beatTexts: Record<number, string> = { 16: '4', 8: '2', 4: '1', 2: '1/2', 1: '1/4' };

describe('unit 3: values and bars', () => {
  it('note value exercises', () => {
    let names = 0, beats = 0, bars = 0, types = 0;
    for (const { exercise } of all(3)) {
      const spec = staff(exercise);
      const first = spec?.notes[0];
      if ((exercise.id.includes('.name.') || exercise.id.includes('.rest.')) && first) {
        expect(sixteenthsByName[exercise.correctAnswers[0]], exercise.id).toBe(sixteenthsOf(first));
        expect(first.isRest).toBe(exercise.id.includes('.rest.'));
        names++;
      }
      if (exercise.id.includes('.beats.') && first) {
        expect(exercise.correctAnswers[0]).toBe(beatTexts[sixteenthsOf(first)]);
        beats++;
      }
      if (exercise.id.includes('.valuetype.') && first) {
        expect(sixteenthsByName[exercise.correctAnswers[0]]).toBe(sixteenthsOf(first));
        types++;
      }
      if (exercise.id.includes('.fill.') && exercise.kind === 'multipleChoice' && spec && spec.time) {
        const bar = spec.time === '4/4' ? 16 : 12;
        const used = spec.notes.reduce((sum, n) => sum + sixteenthsOf(n), 0);
        expect(used + sixteenthsByName[exercise.correctAnswers[0]], exercise.id).toBe(bar);
        bars++;
      }
      if (exercise.id.includes('.barbeats.') && spec && spec.time) {
        const used = spec.notes.reduce((sum, n) => sum + (n.value === 'half' ? 8 : n.value === 'quarter' ? 4 : 2), 0);
        expect(Number(exercise.correctAnswers[0]), exercise.id).toBe(used / 4);
        expect(['4/4', '3/4']).toContain(spec.time);
      }
      if (exercise.id.includes('.ratio.') && exercise.kind === 'typeAnswer') {
        const smalls: Record<string, number> = { Sechzehntelnoten: 1, Achtelnoten: 2, Viertelnoten: 4, 'Halbe Noten': 8 };
        const bigs: Record<string, number> = { 'Ganze Note': 16, 'Halbe Note': 8, Viertelnote: 4, Achtelnote: 2 };
        const small = Object.entries(smalls).find(([k]) => exercise.prompt.includes(k))![1];
        const big = Object.entries(bigs).find(([k]) => exercise.prompt.endsWith(`wie eine ${k}? Schreibe eine Zahl.`))![1];
        expect(Number(exercise.correctAnswers[0]), exercise.prompt).toBe(big / small);
      }
    }
    expect(names).toBeGreaterThan(50);
    expect(beats).toBeGreaterThan(20);
    expect(bars).toBeGreaterThan(20);
    expect(types).toBeGreaterThan(20);
  });

  it('number answers are accepted in any form', () => {
    const fraction = all(3).find((i) => i.exercise.id.includes('.beatstype.eighth'))?.exercise;
    expect(fraction).toBeDefined();
    for (const text of ['1/2', '0,5', '0.5']) expect(typed(fraction!, text).size, text).toBe(0);
    expect(typed(fraction!, '1').size).toBeGreaterThan(0);
  });
});

describe('unit 4: signs', () => {
  const names4: Record<string, string> = {
    '0.1': 'Cis', '1.1': 'Dis', '3.1': 'Fis', '4.1': 'Gis', '5.1': 'Ais', '6.-1': 'B', '2.-1': 'Es', '5.-1': 'As', '1.-1': 'Des', '4.-1': 'Ges',
  };
  it('sign exercises', () => {
    let acc = 0, steps = 0, ears = 0, keys = 0;
    const pcs: Record<string, number> = { Cis: 1, Dis: 3, Fis: 6, Gis: 8, Ais: 10, Des: 1, Es: 3, Ges: 6, As: 8, B: 10 };
    for (const { exercise } of all(4)) {
      const spec = staff(exercise);
      if ((exercise.id.includes('.acc.') || exercise.id.includes('.acctype.')) && spec?.notes[0]) {
        const note = spec.notes[0];
        expect(exercise.correctAnswers[0], exercise.id).toBe(names4[`${note.pitch.letter}.${note.pitch.alteration}`]);
        acc++;
      }
      if (exercise.id.includes('.step.') && spec && spec.notes.length === 2) {
        const diff = pitchMidi(spec.notes[1].pitch) - pitchMidi(spec.notes[0].pitch);
        expect(exercise.correctAnswers[0]).toBe(diff === 1 ? 'Halbton' : 'Ganzton');
        steps++;
      }
      const t = tones(exercise);
      if (exercise.id.includes('.hear.') && t) {
        expect(t.midi.length).toBe(2);
        expect(t.together).toBe(false);
        const diff = t.midi[1] - t.midi[0];
        expect(diff === 1 || diff === 2).toBe(true);
        expect(exercise.correctAnswers[0]).toBe(diff === 1 ? 'Halbton' : 'Ganzton');
        ears++;
      }
      if (exercise.kind === 'pianoKey') {
        const name = exercise.solution;
        expect(exercise.correctAnswers.every((a) => Number(a) % 12 === pcs[name]), exercise.id).toBe(true);
        expect(exercise.correctAnswers.every((a) => [1, 3, 6, 8, 10].includes(Number(a) % 12))).toBe(true);
        keys++;
      }
      if (exercise.id.includes('.raise.')) expect(exercise.correctAnswers[0].endsWith('is')).toBe(true);
      if (exercise.id.includes('.lower.')) {
        const base = exercise.prompt.split(' ')[1];
        expect(exercise.correctAnswers[0]).toBe(({ H: 'B', E: 'Es', A: 'As', D: 'Des', G: 'Ges' } as Record<string, string>)[base]);
      }
    }
    expect(acc).toBeGreaterThan(60);
    expect(steps).toBeGreaterThan(20);
    expect(ears).toBeGreaterThan(20);
    expect(keys).toBeGreaterThan(20);
  });
});

const scales: Record<string, string[]> = {
  'C-Dur': ['C', 'D', 'E', 'F', 'G', 'A', 'H', 'C'], 'G-Dur': ['G', 'A', 'H', 'C', 'D', 'E', 'Fis', 'G'],
  'F-Dur': ['F', 'G', 'A', 'B', 'C', 'D', 'E', 'F'], 'D-Dur': ['D', 'E', 'Fis', 'G', 'A', 'H', 'Cis', 'D'],
  'B-Dur': ['B', 'C', 'D', 'Es', 'F', 'G', 'A', 'B'], 'A-Moll': ['A', 'H', 'C', 'D', 'E', 'F', 'G', 'A'],
  'E-Moll': ['E', 'Fis', 'G', 'A', 'H', 'C', 'D', 'E'], 'D-Moll': ['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'],
};
const scaleSigns: Record<string, string> = {
  'C-Dur': 'keine Vorzeichen', 'G-Dur': 'Fis', 'F-Dur': 'B', 'D-Dur': 'Fis und Cis', 'B-Dur': 'B und Es',
  'A-Moll': 'keine Vorzeichen', 'E-Moll': 'Fis', 'D-Moll': 'B',
};

describe('unit 5: scales', () => {
  it('scale exercises', () => {
    let staffs = 0, missing = 0, degrees = 0, banks = 0;
    for (const { exercise } of all(5)) {
      const spec = staff(exercise);
      if (exercise.id.includes('.staff.') && spec) {
        const answer = exercise.correctAnswers[0];
        const diffs = spec.notes.slice(1).map((n, i) => pitchMidi(n.pitch) - pitchMidi(spec.notes[i].pitch));
        expect(diffs, exercise.id).toEqual(answer.endsWith('Dur') ? [2, 2, 1, 2, 2, 2, 1] : [2, 1, 2, 2, 1, 2, 2]);
        expect(spec.notes.map((n) => germanName(n.pitch)), exercise.id).toEqual(scales[answer]);
        staffs++;
      }
      if (exercise.id.includes('.missing.')) {
        const name = exercise.prompt.slice(0, exercise.prompt.indexOf(':'));
        const body = exercise.prompt.slice(name.length + 2).split('. Welcher')[0];
        const shown = body.split(' – ');
        const index = shown.indexOf('?');
        expect(scales[name][index], exercise.id).toBe(exercise.correctAnswers[0]);
        shown.forEach((text, i) => { if (i !== index) expect(text).toBe(scales[name][i]); });
        missing++;
      }
      if (exercise.id.includes('.degree.')) {
        const tail = exercise.prompt.split(' der ').pop()!;
        const name = tail.slice(0, tail.indexOf('-')) + '-' + (exercise.prompt.includes('Dur-Tonleiter') ? 'Dur' : 'Moll');
        const number = Number(exercise.prompt.split('. Ton')[0].split(' ').pop());
        expect(scales[name][number - 1], exercise.prompt).toBe(exercise.correctAnswers[0]);
        degrees++;
      }
      if (exercise.id.includes('.bank.')) {
        const name = exercise.id.split('.').pop()!;
        expect(exercise.correctAnswers).toEqual(scales[name].slice(0, -1));
        for (const extra of exercise.options) {
          if (!exercise.correctAnswers.includes(extra)) expect(scales[name].includes(extra), `extra tile ${extra} belongs to ${name}`).toBe(false);
        }
        banks++;
      }
      if (exercise.id.includes('.acc.')) {
        const name = exercise.id.split('.acc.').pop()!;
        expect(exercise.correctAnswers[0], exercise.id).toBe(scaleSigns[name]);
      }
    }
    expect(staffs).toBeGreaterThan(30);
    expect(missing).toBeGreaterThan(60);
    expect(degrees).toBeGreaterThan(30);
    expect(banks).toBeGreaterThan(20);
  });

  it('scale pairs and first lesson scope', () => {
    const lesson1 = provider.course.nodes.find((n) => n.id === 'music.u05.l1')!;
    for (const seed of seeds) {
      for (const e of provider.exercises(lesson1, seed)) {
        if (e.id.includes('.missing.') || e.id.includes('.degree.') || e.id.includes('.bank.')) {
          expect(e.id.includes('C-Dur') || e.id.includes('G-Dur') || e.id.includes('pattern'), e.id).toBe(true);
        }
      }
    }
    for (const { exercise } of all(5)) {
      if (!exercise.id.includes('.pairs.')) continue;
      for (const pair of exercise.pairs) expect(scaleSigns[pair.front]).toBe(pair.back);
    }
  });
});

const intervalFacts: Record<string, { steps: number; semis: number }> = {
  'reine Prim': { steps: 0, semis: 0 }, 'kleine Sekunde': { steps: 1, semis: 1 }, 'große Sekunde': { steps: 1, semis: 2 },
  'kleine Terz': { steps: 2, semis: 3 }, 'große Terz': { steps: 2, semis: 4 }, 'reine Quarte': { steps: 3, semis: 5 },
  'reine Quinte': { steps: 4, semis: 7 }, 'kleine Sexte': { steps: 5, semis: 8 }, 'große Sexte': { steps: 5, semis: 9 },
  'kleine Septime': { steps: 6, semis: 10 }, 'große Septime': { steps: 6, semis: 11 }, 'reine Oktave': { steps: 7, semis: 12 },
};
const sizeSteps: Record<string, number> = { Prim: 0, Sekunde: 1, Terz: 2, Quarte: 3, Quinte: 4, Sexte: 5, Septime: 6, Oktave: 7 };
const factFor = (prompt: string) => {
  const name = Object.keys(intervalFacts).find((k) => prompt.includes(k))!;
  return intervalFacts[name];
};

describe('unit 6: intervals', () => {
  it('interval exercises', () => {
    let named = 0, numbers = 0, built = 0, ears = 0, semisAsked = 0;
    for (const { exercise } of all(6)) {
      const spec = staff(exercise);
      if ((exercise.id.includes('.name.') || exercise.id.includes('.nametype.')) && spec && spec.notes.length === 2) {
        const facts = intervalFacts[exercise.correctAnswers[0]];
        const a = spec.notes[0].pitch, b = spec.notes[1].pitch;
        expect(pitchMidi(b) - pitchMidi(a), exercise.id).toBe(facts.semis);
        expect(pitchDiatonic(b) - pitchDiatonic(a), exercise.id).toBe(facts.steps);
        named++;
      }
      if (exercise.id.includes('.num.') && spec && spec.notes.length === 2) {
        expect(pitchDiatonic(spec.notes[1].pitch) - pitchDiatonic(spec.notes[0].pitch), exercise.id).toBe(sizeSteps[exercise.correctAnswers[0]]);
        numbers++;
      }
      if ((exercise.id.includes('.build.') || exercise.id.includes('.buildchoice.')) && spec?.notes[0]) {
        const base = spec.notes[0].pitch;
        const facts = factFor(exercise.prompt);
        const parsed = MusicNames.parse(exercise.correctAnswers[0])!;
        const answer = pitch(parsed.letter, 0, parsed.alteration);
        const letterSteps = (parsed.letter - base.letter + 7) % 7;
        expect(letterSteps, exercise.id).toBe(facts.steps % 7);
        expect((pitchClass(answer) - pitchClass(base) + 12) % 12, exercise.id).toBe(facts.semis % 12);
        built++;
      }
      const t = tones(exercise);
      if (exercise.id.includes('.hear.') && t) {
        expect(t.together).toBe(false);
        expect(intervalFacts[exercise.correctAnswers[0]].semis, exercise.id).toBe(t.midi[1] - t.midi[0]);
        ears++;
      }
      if (exercise.id.includes('.semis.') && Object.keys(intervalFacts).some((k) => exercise.prompt.includes(k))) {
        expect(Number(exercise.correctAnswers[0])).toBe(factFor(exercise.prompt).semis);
        semisAsked++;
      }
      if (exercise.id.includes('.invert.')) {
        const original = factFor(exercise.prompt);
        const inverse = intervalFacts[exercise.correctAnswers[0]];
        expect(inverse.semis + original.semis).toBe(12);
        expect(inverse.steps + original.steps).toBe(7);
      }
      if (exercise.kind === 'pianoKey') {
        const facts = factFor(exercise.prompt);
        const baseName = exercise.prompt.split(' über ').pop()!.split(' ')[0];
        const base = parsePitch(baseName);
        const expected = (pitchClass(base) + facts.semis) % 12;
        expect(exercise.correctAnswers.every((a) => Number(a) % 12 === expected), exercise.id).toBe(true);
      }
    }
    expect(named).toBeGreaterThan(60);
    expect(numbers).toBeGreaterThan(60);
    expect(built).toBeGreaterThan(60);
    expect(ears).toBeGreaterThan(60);
    expect(semisAsked).toBeGreaterThan(20);
  });

  it('ear exercises only use what the lesson taught', () => {
    const allowed: Record<string, number[]> = { 'music.u06.l2': [2, 3, 4, 5, 7, 12], 'music.u06.l3': [3, 4, 5, 7, 8, 9, 10, 12] };
    for (const node of provider.course.nodes) {
      if (node.unitNumber !== 6 || node.kind === 'chest') continue;
      for (const seed of seeds) {
        for (const exercise of provider.exercises(node, seed)) {
          const spec = tones(exercise);
          if (!spec) continue;
          expect(node.id).not.toBe('music.u06.l1');
          const pool = allowed[node.id];
          if (pool) {
            expect(pool.includes(spec.midi[1] - spec.midi[0]), `${node.id}: ${spec.midi}`).toBe(true);
            for (const option of exercise.options) expect(pool.includes(intervalFacts[option].semis), `${node.id}: option ${option}`).toBe(true);
          }
          expect(spec.midi[1] - spec.midi[0], 'no tritone by ear').not.toBe(6);
        }
      }
    }
    const early = provider.course.nodes.filter((n) => n.unitNumber === 4 && n.index === 1 && n.kind === 'lesson');
    for (const node of early) expect(provider.exercises(node, 1n).every((e) => tones(e) === null)).toBe(true);
  });
});

const triads: Record<string, string[]> = {
  'C-Dur': ['C', 'E', 'G'], 'G-Dur': ['G', 'H', 'D'], 'F-Dur': ['F', 'A', 'C'], 'D-Dur': ['D', 'Fis', 'A'], 'A-Moll': ['A', 'C', 'E'],
  'E-Moll': ['E', 'G', 'H'], 'D-Moll': ['D', 'F', 'A'], 'Es-Dur': ['Es', 'G', 'B'], 'B-Dur': ['B', 'D', 'F'], 'As-Dur': ['As', 'C', 'Es'],
  'G-Moll': ['G', 'B', 'D'], 'C-Moll': ['C', 'Es', 'G'], 'F-Moll': ['F', 'As', 'C'],
};

describe('unit 7: triads', () => {
  it('triad exercises', () => {
    let staffs = 0, ears = 0, missing = 0, banks = 0, pairs = 0;
    for (const { exercise } of all(7)) {
      const spec = staff(exercise);
      if (exercise.id.includes('.staff.') && spec) {
        expect(spec.chord).toBe(true);
        expect(spec.notes.map((n) => germanName(n.pitch)), exercise.id).toEqual(triads[exercise.correctAnswers[0]]);
        staffs++;
      }
      if (exercise.id.includes('.kind.') && spec) {
        const diffs = spec.notes.slice(1).map((n, i) => pitchMidi(n.pitch) - pitchMidi(spec.notes[i].pitch));
        const major = diffs[0] === 4 && diffs[1] === 3;
        const minor = diffs[0] === 3 && diffs[1] === 4;
        expect(exercise.correctAnswers[0]).toBe(major ? 'Dur' : 'Moll');
        expect(major || minor).toBe(true);
      }
      const t = tones(exercise);
      if (exercise.id.includes('.hear.') && t) {
        expect(t.together).toBe(true);
        const diffs = t.midi.slice(1).map((m, i) => m - t.midi[i]);
        const major = diffs[0] === 4 && diffs[1] === 3;
        expect(major || (diffs[0] === 3 && diffs[1] === 4), `${t.midi}`).toBe(true);
        expect(exercise.correctAnswers[0]).toBe(major ? 'Dur' : 'Moll');
        expect(exercise.options.slice().sort()).toEqual(['Dur', 'Moll']);
        ears++;
      }
      if (exercise.id.includes('.missing.')) {
        const name = exercise.prompt.slice(0, exercise.prompt.indexOf(':'));
        const shown = exercise.prompt.slice(name.length + 2).split('. Welcher')[0].split(' – ');
        expect(triads[name][shown.indexOf('?')]).toBe(exercise.correctAnswers[0]);
        missing++;
      }
      if (exercise.id.includes('.bank.')) {
        expect(exercise.correctAnswers).toEqual(triads[exercise.id.split('.bank.').pop()!]);
        banks++;
      }
      if (exercise.id.includes('.pairs.')) {
        for (const pair of exercise.pairs) expect(pair.back).toBe(triads[pair.front].join(' – '));
        pairs++;
      }
      if (exercise.id.includes('.part.')) {
        const name = exercise.prompt.split(' des ')[1].split('-Dreiklangs')[0];
        const index = exercise.prompt.includes('Terz') ? 1 : 2;
        expect(exercise.correctAnswers[0]).toBe(triads[name][index]);
      }
    }
    expect(staffs).toBeGreaterThan(40);
    expect(ears).toBeGreaterThan(40);
    expect(missing).toBeGreaterThan(40);
    expect(banks).toBeGreaterThan(40);
    expect(pairs).toBeGreaterThan(10);
  });

  it('hearing only after both qualities are taught', () => {
    const first = provider.course.nodes.find((n) => n.id === 'music.u07.l1')!;
    for (const seed of seeds) expect(provider.exercises(first, seed).every((e) => tones(e) === null)).toBe(true);
  });
});

const majors: Record<number, string> = { 0: 'C-Dur', 1: 'G-Dur', 2: 'D-Dur', 3: 'A-Dur', 4: 'E-Dur', [-1]: 'F-Dur', [-2]: 'B-Dur', [-3]: 'Es-Dur', [-4]: 'As-Dur' };
const relatives: Record<string, string> = {
  'C-Dur': 'A-Moll', 'G-Dur': 'E-Moll', 'D-Dur': 'H-Moll', 'A-Dur': 'Fis-Moll', 'E-Dur': 'Cis-Moll', 'F-Dur': 'D-Moll',
  'B-Dur': 'G-Moll', 'Es-Dur': 'C-Moll', 'As-Dur': 'F-Moll',
};

describe('unit 8: keys', () => {
  it('key exercises', () => {
    let reads = 0, notes = 0, relations = 0, circles = 0;
    const sharpLetters = [3, 0, 4, 1, 5, 2, 6], flatLetters = [6, 2, 5, 1, 4, 0, 3];
    const table: Record<number, Record<string, string>> = {
      1: { F: 'Fis', C: 'Cis', G: 'Gis', D: 'Dis' },
      [-1]: { H: 'B', E: 'Es', A: 'As', D: 'Des' },
    };
    const signs: Record<string, string> = {
      'C-Dur': 'keine Vorzeichen', 'G-Dur': '1 Kreuz', 'D-Dur': '2 Kreuze', 'A-Dur': '3 Kreuze', 'E-Dur': '4 Kreuze',
      'F-Dur': '1 Be', 'B-Dur': '2 Be', 'Es-Dur': '3 Be', 'As-Dur': '4 Be',
    };
    for (const { exercise } of all(8)) {
      const spec = staff(exercise);
      if (exercise.id.includes('.read.') && spec) {
        expect(exercise.correctAnswers[0], exercise.id).toBe(majors[spec.keySignature]);
        reads++;
      }
      if (exercise.id.includes('.readminor.') && spec) {
        expect(exercise.correctAnswers[0], exercise.id).toBe(relatives[majors[spec.keySignature]]);
      }
      if ((exercise.id.includes('.note.') || exercise.id.includes('.notetype.')) && spec?.notes[0]) {
        const note = spec.notes[0];
        const key = spec.keySignature;
        const expected = key > 0 && sharpLetters.slice(0, key).includes(note.pitch.letter) ? 1 : key < 0 && flatLetters.slice(0, -key).includes(note.pitch.letter) ? -1 : 0;
        expect(note.pitch.alteration).toBe(expected);
        const letter = LETTER_NAMES[note.pitch.letter];
        expect(exercise.correctAnswers[0], exercise.id).toBe(expected === 0 ? letter : table[expected][letter]);
        notes++;
      }
      if (exercise.id.includes('.relminor') || exercise.id.includes('.relmajor')) {
        const major = exercise.prompt.includes('Paralleltonart von ')
          ? exercise.prompt.split('Paralleltonart von ')[1].slice(0, -1)
          : exercise.correctAnswers[0];
        const minor = exercise.id.includes('.relmajor') ? exercise.prompt.split('gehört ')[1].split(' als')[0] : exercise.correctAnswers[0];
        expect(relatives[major], exercise.id).toBe(minor);
        relations++;
      }
      if (exercise.id.includes('.keyof')) {
        const count = Number(exercise.id.split('.').pop());
        if (!Number.isNaN(count)) expect(exercise.correctAnswers[0], exercise.id).toBe(majors[count]);
      }
      if (exercise.id.includes('.circle.')) {
        const up = exercise.prompt.includes('über');
        const from = exercise.prompt.split(up ? 'über ' : 'unter ').pop()!.slice(0, -1);
        const start = Number(Object.entries(majors).find(([, v]) => v === from)![0]);
        expect(majors[start + (up ? 1 : -1)]).toBe(exercise.correctAnswers[0]);
        circles++;
      }
      if (exercise.id.includes('.order.') && exercise.kind === 'wordBank') {
        const a = JSON.stringify(exercise.correctAnswers);
        expect(a === JSON.stringify(['Fis', 'Cis', 'Gis', 'Dis']) || a === JSON.stringify(['B', 'Es', 'As', 'Des'])).toBe(true);
      }
      if (exercise.id.includes('.pairs.') && exercise.kind === 'matchPairs' && !exercise.pairs[0]?.back.includes('Moll')) {
        for (const pair of exercise.pairs) expect(signs[pair.front]).toBe(pair.back);
      }
    }
    expect(reads).toBeGreaterThan(40);
    expect(notes).toBeGreaterThan(40);
    expect(relations).toBeGreaterThan(40);
    expect(circles).toBeGreaterThan(20);
  });
});

describe('media rules', () => {
  it('media is only staff and tones', () => {
    const withStaff = new Set<number>(), withTones = new Set<number>();
    for (let unit = 1; unit <= 8; unit++) {
      for (const { exercise } of all(unit)) {
        const media = exercise.media;
        if (media === null) { /* none */ } else if (media.type === 'staff') withStaff.add(unit);
        else if (media.type === 'tones') withTones.add(unit);
        else throw new Error(`${exercise.id} uses media the course must not use`);
        expect(['multipleChoice', 'pianoKey', 'typeAnswer', 'wordBank', 'matchPairs']).toContain(exercise.kind);
        if (exercise.kind === 'pianoKey') expect(exercise.correctAnswers.length).toBeGreaterThan(0);
      }
    }
    expect([...withStaff].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...withTones].sort((a, b) => a - b)).toEqual([4, 6, 7]);
  });
});
