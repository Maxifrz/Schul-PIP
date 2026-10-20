import { describe, expect, it } from 'vitest';
import { CourseNode, NodeKind, courseNodes, courseUnits } from '../../src/lib/learn/course';
import { auditProblems } from '../../src/lib/learn/courseAudit';
import { LearnExercise, missedKeys } from '../../src/lib/learn/exercise';
import { StaffSpec, ToneSpec, diatonic, midiOf, pitch } from '../../src/lib/learn/media';
import { music } from '../../src/lib/learn/music/course';
import { MusicNames, germanName, letterNames, pitchClass } from '../../src/lib/learn/music/theory';

/** The music course as the screens will use it: structure, audit, and the facts of its exercises re-computed from tables written down here, independent of the code that generated them. */
const provider = music;
const seeds = Array.from({ length: 20 }, (_, i) => BigInt(i + 1));

type Item = { node: CourseNode; exercise: LearnExercise };
const cache = new Map<string, Item[]>();
/** The exercises of a unit's nodes over all seeds; by default only the unit's own (practice rounds also review earlier units). */
function all(unit: number, kinds: NodeKind[] = ['lesson', 'practice', 'checkpoint'], own = true): Item[] {
  const key = `${unit}|${kinds.join(',')}|${own}`;
  const known = cache.get(key);
  if (known) return known;
  const prefix = `music.u${String(unit).padStart(2, '0')}.`;
  const result: Item[] = [];
  for (const node of courseNodes(provider.course)) {
    if (node.unitNumber !== unit || !kinds.includes(node.kind)) continue;
    for (const seed of seeds) for (const exercise of provider.exercises(node, seed)) if (!own || exercise.id.startsWith(prefix)) result.push({ node, exercise });
  }
  cache.set(key, result);
  return result;
}

const staff = (e: LearnExercise): StaffSpec | null => (e.media?.kind === 'staff' ? e.media.staff : null);
const tones = (e: LearnExercise): ToneSpec | null => (e.media?.kind === 'tones' ? e.media.tones : null);
const sixteenthsOf = (v: string) => ({ whole: 16, half: 8, quarter: 4, eighth: 2, sixteenth: 1 })[v as 'whole'];
const parsed = (text: string) => MusicNames.parse(text);
const typed = (e: LearnExercise, text: string) => missedKeys(e, { type: 'typed', value: text });

describe('the music course: structure', () => {
  it('has the shape', () => {
    const course = provider.course;
    expect([course.id, course.title, course.subtitle, course.kind, course.color]).toEqual(['music', 'Musik', 'Noten lesen, hören, verstehen', 'music', 0x9e6b8e]);
    const units = courseUnits(course);
    expect(units).toHaveLength(8);
    for (const unit of units) {
      expect(unit.nodes).toHaveLength(6);
      const paragraphs = unit.tip.split('\n\n').length;
      expect(paragraphs >= 2 && paragraphs <= 5, `${unit.id} tip has ${paragraphs} paragraphs`).toBe(true);
      expect(unit.summary).not.toBe('');
    }
    expect(units.map((u) => u.title)).toEqual(['Notenlinien und Violinschlüssel', 'Bassschlüssel und Klaviatur', 'Notenwerte und Pausen', 'Vorzeichen', 'Tonleitern', 'Intervalle', 'Dreiklänge', 'Tonarten und Quintenzirkel']);
  });

  it('passes the audit', () => {
    expect(auditProblems(provider, seeds)).toEqual([]);
  }, 120000);

  it('has two kinds in every node and no emoji or placeholder', () => {
    for (const node of courseNodes(provider.course).filter((n) => n.kind !== 'chest')) {
      for (const seed of seeds) {
        const list = provider.exercises(node, seed);
        expect(new Set(list.map((e) => e.kind)).size, `${node.id} seed ${seed}`).toBeGreaterThanOrEqual(2);
        for (const e of list) {
          const text = [e.prompt, e.solution, e.explanation, ...e.options, ...e.correctAnswers].join(' ');
          expect(text.includes('TODO')).toBe(false);
          expect(/[\u{1F300}-\u{1FAFF}]/u.test(text)).toBe(false);
        }
      }
    }
  });

  it('changes the exercises with the seed', () => {
    for (const node of courseNodes(provider.course).filter((n) => n.kind !== 'chest')) {
      const [a, b, c] = [1n, 2n, 3n].map((s) => provider.exercises(node, s).map((e) => e.id).join('|'));
      expect(a !== b || a !== c, `${node.id} ignores the seed`).toBe(true);
    }
  });

  it('mixes earlier units into practice', () => {
    for (let unit = 2; unit <= 8; unit++) {
      const prefix = `music.u${String(unit).padStart(2, '0')}.`;
      expect(all(unit, ['practice'], false).some((i) => !i.exercise.id.startsWith(prefix)), `practice of unit ${unit} has no review`).toBe(true);
    }
  });

  it('has some variety per unit', () => {
    for (let unit = 1; unit <= 8; unit++) expect(new Set(all(unit).map((i) => i.exercise.id)).size, `unit ${unit}`).toBeGreaterThan(60);
  });
});

describe('the music course: typed answers and choices', () => {
  it('accepts note names in both cases and never a neighbour', () => {
    let checked = 0;
    for (let unit = 1; unit <= 8; unit++) {
      for (const { exercise } of all(unit)) {
        if (exercise.kind !== 'typeAnswer' || exercise.mode !== 'exact') continue;
        const answer = exercise.correctAnswers[0];
        const p = parsed(answer);
        if (!answer || !p) continue;
        for (const text of [answer, answer.toLowerCase(), ` ${answer} `]) expect(typed(exercise, text).size, `${exercise.id} rejects ${text}`).toBe(0);
        const neighbour = germanName(pitch((p.letter + 1) % 7, 4, p.alteration));
        expect(typed(exercise, neighbour).size, `${exercise.id} accepts ${neighbour}`).toBeGreaterThan(0);
        expect(typed(exercise, `${answer}is`).size).toBeGreaterThan(0);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('never offers an enharmonic of the answer', () => {
    let checked = 0;
    for (let unit = 1; unit <= 8; unit++) {
      for (const { exercise } of all(unit)) {
        if (exercise.kind !== 'multipleChoice') continue;
        const answer = exercise.correctAnswers[0];
        const right = answer ? parsed(answer) : null;
        if (!right) continue;
        const rightClass = pitchClass(pitch(right.letter, 4, right.alteration));
        for (const option of exercise.options.filter((o) => o !== answer)) {
          const p = parsed(option);
          if (p) expect(pitchClass(pitch(p.letter, 4, p.alteration)), `${exercise.id}: ${option} sounds like ${answer}`).not.toBe(rightClass);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('shows no signs before they are taught', () => {
    for (let unit = 1; unit <= 3; unit++) {
      for (const { exercise } of all(unit)) {
        for (const text of [...exercise.options, ...exercise.correctAnswers, exercise.prompt]) {
          const p = parsed(text);
          if (p) expect(p.alteration, `${exercise.id}: ${text}`).toBe(0);
        }
        const spec = staff(exercise);
        if (spec) expect(spec.notes.every((n) => n.pitch.alteration === 0), exercise.id).toBe(true);
      }
    }
  });
});

const trebleNames = ['E', 'F', 'G', 'A', 'H', 'C', 'D', 'E', 'F', 'G', 'A'];
const bassNames = ['G', 'A', 'H', 'C', 'D', 'E', 'F', 'G', 'A', 'H', 'C'];

describe('the music course: units 1 and 2', () => {
  it('has staff reading answers that match the staff', () => {
    let checked = 0;
    for (let unit = 1; unit <= 2; unit++) {
      for (const { exercise } of all(unit)) {
        if (!(exercise.id.includes('.read.') || exercise.id.includes('.type.') || exercise.id.includes('.mixed.'))) continue;
        const spec = staff(exercise);
        const note = spec?.notes[0];
        expect(note, `${exercise.id} has no staff`).toBeTruthy();
        const d = diatonic(note!.pitch);
        let expected: string | null = null;
        if (spec!.clef === 'treble') {
          const step = d - (4 * 7 + 2);
          expected = step >= 0 && step <= 10 ? trebleNames[step] : step === -1 ? 'D' : step === -2 ? 'C' : null;
        } else if (spec!.clef === 'bass') {
          const step = d - (2 * 7 + 4);
          expected = step >= 0 && step <= 10 ? bassNames[step] : step === -1 ? 'F' : step === -2 ? 'E' : null;
        }
        expect(exercise.correctAnswers[0], exercise.id).toBe(expected);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('answers place and compare questions right', () => {
    const phrases: Array<[string, number]> = [['auf der 1. Linie', 0], ['im 1. Zwischenraum', 1], ['auf der 2. Linie', 2], ['im 2. Zwischenraum', 3], ['auf der 3. Linie', 4], ['im 3. Zwischenraum', 5], ['auf der 4. Linie', 6], ['im 4. Zwischenraum', 7], ['auf der 5. Linie', 8], ['über der 5. Linie', 9], ['auf der 1. Hilfslinie über dem System', 10]];
    for (let unit = 1; unit <= 2; unit++) {
      for (const { exercise } of all(unit).filter((i) => i.exercise.id.includes('.place.'))) {
        const names = unit === 1 ? trebleNames : bassNames;
        let step: number | null = null;
        for (const [phrase, value] of phrases) if (exercise.prompt.includes(phrase)) step = Math.max(step ?? -99, value);
        if (step !== null) expect(exercise.correctAnswers[0], exercise.id).toBe(names[step]);
        else if (exercise.prompt.includes('unter der 1. Linie')) expect(exercise.correctAnswers[0]).toBe(unit === 1 ? 'D' : 'F');
        else if (exercise.prompt.includes('Hilfslinie unter dem System')) expect(exercise.correctAnswers[0]).toBe(unit === 1 ? 'C' : 'E');
        else throw new Error(`unknown position in ${exercise.prompt}`);
      }
    }
    for (const { exercise } of all(2).filter((i) => i.exercise.id.includes('.compare.'))) {
      const step = Number(exercise.id.split('.').pop());
      expect(exercise.prompt).toContain(`heißt sie ${trebleNames[step]}`);
      expect(exercise.correctAnswers[0]).toBe(bassNames[step]);
      expect(exercise.options).toContain(trebleNames[step]);
    }
  });

  it('answers keyboard questions right', () => {
    const classes: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11 };
    let named = 0, anyOctave = 0, fromStaff = 0;
    for (const { exercise } of all(2).filter((i) => i.exercise.kind === 'pianoKey')) {
      const keys = exercise.correctAnswers.map(Number);
      if (exercise.prompt.startsWith('Tippe das ')) {
        expect(keys).toHaveLength(1);
        const letter = exercise.prompt.split(' ').pop()!.slice(0, -1).toUpperCase();
        const octave = exercise.prompt.includes('eingestrichene') ? 4 : exercise.prompt.includes('zweigestrichene') ? 5 : exercise.prompt.includes('kleine') ? 3 : 2;
        expect(keys[0], exercise.prompt).toBe(12 * (octave + 1) + classes[letter]);
        named += 1;
      } else if (exercise.prompt.startsWith('Tippe ein ')) {
        const letter = exercise.prompt.slice('Tippe ein '.length, 'Tippe ein '.length + 1);
        expect(keys.every((k) => k % 12 === classes[letter]), exercise.prompt).toBe(true);
        expect(keys).toHaveLength(MusicNames.keys(classes[letter]).length);
        anyOctave += 1;
      } else {
        const note = staff(exercise)?.notes[0];
        if (note) { expect(keys).toEqual([midiOf(note.pitch)]); fromStaff += 1; }
      }
    }
    expect([named, anyOctave, fromStaff].every((c) => c > 20), `${named} ${anyOctave} ${fromStaff}`).toBe(true);
    const middle = all(2).filter((i) => i.exercise.prompt === 'Tippe das eingestrichene c.');
    expect(middle.length).toBeGreaterThan(0);
    for (const item of middle) expect(item.exercise.correctAnswers).toEqual(['60']);
  });
});

describe('the music course: unit 3', () => {
  const sixteenths: Record<string, number> = { 'Ganze Note': 16, 'Halbe Note': 8, Viertelnote: 4, Achtelnote: 2, Sechzehntelnote: 1, 'Ganze Pause': 16, 'Halbe Pause': 8, Viertelpause: 4, Achtelpause: 2, Sechzehntelpause: 1 };
  const beatTexts: Record<number, string> = { 16: '4', 8: '2', 4: '1', 2: '1/2', 1: '1/4' };

  it('has right note value exercises', () => {
    let names = 0, beats = 0, bars = 0, types = 0;
    for (const { exercise } of all(3)) {
      const spec = staff(exercise);
      const note = spec?.notes[0];
      if ((exercise.id.includes('.name.') || exercise.id.includes('.rest.')) && note) {
        expect(sixteenths[exercise.correctAnswers[0]], exercise.id).toBe(sixteenthsOf(note.value));
        expect(note.isRest).toBe(exercise.id.includes('.rest.'));
        names += 1;
      }
      if (exercise.id.includes('.beats.') && note) { expect(exercise.correctAnswers[0]).toBe(beatTexts[sixteenthsOf(note.value)]); beats += 1; }
      if (exercise.id.includes('.valuetype.') && note) { expect(sixteenths[exercise.correctAnswers[0]]).toBe(sixteenthsOf(note.value)); types += 1; }
      if (exercise.id.includes('.fill.') && exercise.kind === 'multipleChoice' && spec?.time) {
        const bar = spec.time === '4/4' ? 16 : 12;
        const used = spec.notes.reduce((s, x) => s + sixteenthsOf(x.value), 0);
        expect(used + sixteenths[exercise.correctAnswers[0]], exercise.id).toBe(bar);
        bars += 1;
      }
      if (exercise.id.includes('.barbeats.') && spec?.time) {
        const used = spec.notes.reduce((s, x) => s + sixteenthsOf(x.value), 0);
        expect(Number(exercise.correctAnswers[0]), exercise.id).toBe(used / 4);
        expect(['4/4', '3/4']).toContain(spec.time);
      }
      if (exercise.id.includes('.ratio.') && exercise.kind === 'typeAnswer') {
        const small = Object.entries({ Sechzehntelnoten: 1, Achtelnoten: 2, Viertelnoten: 4, 'Halbe Noten': 8 }).find(([k]) => exercise.prompt.includes(k))!;
        const big = Object.entries({ 'Ganze Note': 16, 'Halbe Note': 8, Viertelnote: 4, Achtelnote: 2 }).find(([k]) => exercise.prompt.endsWith(`wie eine ${k}? Schreibe eine Zahl.`))!;
        expect(Number(exercise.correctAnswers[0]), exercise.prompt).toBe(big[1] / small[1]);
      }
    }
    expect([names, beats, bars, types].every((c) => c > 20) && names > 50).toBe(true);
  });

  it('accepts number answers in any form', () => {
    const fraction = all(3).find((i) => i.exercise.id.includes('.beatstype.eighth'))?.exercise;
    expect(fraction).toBeDefined();
    for (const text of ['1/2', '0,5', '0.5']) expect(typed(fraction!, text).size, text).toBe(0);
    expect(typed(fraction!, '1').size).toBeGreaterThan(0);
  });
});

describe('the music course: unit 4', () => {
  const names4: Record<string, string> = { '0.1': 'Cis', '1.1': 'Dis', '3.1': 'Fis', '4.1': 'Gis', '5.1': 'Ais', '6.-1': 'B', '2.-1': 'Es', '5.-1': 'As', '1.-1': 'Des', '4.-1': 'Ges' };

  it('has right sign exercises', () => {
    let acc = 0, steps = 0, ears = 0, keys = 0;
    const pcs: Record<string, number> = { Cis: 1, Dis: 3, Fis: 6, Gis: 8, Ais: 10, Des: 1, Es: 3, Ges: 6, As: 8, B: 10 };
    for (const { exercise } of all(4)) {
      const spec = staff(exercise);
      if ((exercise.id.includes('.acc.') || exercise.id.includes('.acctype.')) && spec?.notes[0]) {
        const n = spec.notes[0].pitch;
        expect(exercise.correctAnswers[0], exercise.id).toBe(names4[`${n.letter}.${n.alteration}`]);
        acc += 1;
      }
      if (exercise.id.includes('.step.') && spec && spec.notes.length === 2) {
        const diff = midiOf(spec.notes[1].pitch) - midiOf(spec.notes[0].pitch);
        expect(exercise.correctAnswers[0]).toBe(diff === 1 ? 'Halbton' : 'Ganzton');
        steps += 1;
      }
      const t = tones(exercise);
      if (exercise.id.includes('.hear.') && t) {
        expect(t.midi).toHaveLength(2);
        expect(t.together).toBe(false);
        const diff = t.midi[1] - t.midi[0];
        expect(diff === 1 || diff === 2).toBe(true);
        expect(exercise.correctAnswers[0]).toBe(diff === 1 ? 'Halbton' : 'Ganzton');
        ears += 1;
      }
      if (exercise.kind === 'pianoKey') {
        expect(exercise.correctAnswers.every((a) => Number(a) % 12 === pcs[exercise.solution]), exercise.id).toBe(true);
        expect(exercise.correctAnswers.every((a) => [1, 3, 6, 8, 10].includes(Number(a) % 12))).toBe(true);
        keys += 1;
      }
      if (exercise.id.includes('.raise.')) expect(exercise.correctAnswers[0].endsWith('is')).toBe(true);
      if (exercise.id.includes('.lower.')) {
        const base = exercise.prompt.split(' ')[1];
        expect(exercise.correctAnswers[0]).toBe(({ H: 'B', E: 'Es', A: 'As', D: 'Des', G: 'Ges' } as Record<string, string>)[base]);
      }
    }
    expect(acc).toBeGreaterThan(60);
    expect([steps, ears, keys].every((c) => c > 20)).toBe(true);
  });
});

describe('the music course: unit 5', () => {
  const scales: Record<string, string[]> = {
    'C-Dur': ['C', 'D', 'E', 'F', 'G', 'A', 'H', 'C'], 'G-Dur': ['G', 'A', 'H', 'C', 'D', 'E', 'Fis', 'G'], 'F-Dur': ['F', 'G', 'A', 'B', 'C', 'D', 'E', 'F'],
    'D-Dur': ['D', 'E', 'Fis', 'G', 'A', 'H', 'Cis', 'D'], 'B-Dur': ['B', 'C', 'D', 'Es', 'F', 'G', 'A', 'B'], 'A-Moll': ['A', 'H', 'C', 'D', 'E', 'F', 'G', 'A'],
    'E-Moll': ['E', 'Fis', 'G', 'A', 'H', 'C', 'D', 'E'], 'D-Moll': ['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'],
  };
  const signs: Record<string, string> = { 'C-Dur': 'keine Vorzeichen', 'G-Dur': 'Fis', 'F-Dur': 'B', 'D-Dur': 'Fis und Cis', 'B-Dur': 'B und Es', 'A-Moll': 'keine Vorzeichen', 'E-Moll': 'Fis', 'D-Moll': 'B' };

  it('has right scale exercises', () => {
    let staffs = 0, missing = 0, degrees = 0, banks = 0;
    for (const { exercise } of all(5)) {
      const spec = staff(exercise);
      if (exercise.id.includes('.staff.') && spec) {
        const answer = exercise.correctAnswers[0];
        const diffs = spec.notes.slice(1).map((n, i) => midiOf(n.pitch) - midiOf(spec.notes[i].pitch));
        expect(diffs, exercise.id).toEqual(answer.endsWith('Dur') ? [2, 2, 1, 2, 2, 2, 1] : [2, 1, 2, 2, 1, 2, 2]);
        expect(spec.notes.map((n) => germanName(n.pitch)), exercise.id).toEqual(scales[answer]);
        staffs += 1;
      }
      if (exercise.id.includes('.missing.')) {
        const name = exercise.prompt.split(':')[0];
        const body = exercise.prompt.slice(name.length + 2).split('. Welcher')[0];
        const shown = body.split(' – ');
        const index = shown.indexOf('?');
        expect(scales[name][index], exercise.id).toBe(exercise.correctAnswers[0]);
        shown.forEach((text, i) => { if (i !== index) expect(text).toBe(scales[name][i]); });
        missing += 1;
      }
      if (exercise.id.includes('.degree.')) {
        const tail = exercise.prompt.split(' der ').pop()!;
        const name = `${tail.split('-')[0]}-${exercise.prompt.includes('Dur-Tonleiter') ? 'Dur' : 'Moll'}`;
        const number = Number(exercise.prompt.split('. Ton')[0].split(' ').pop());
        expect(scales[name][number - 1], exercise.prompt).toBe(exercise.correctAnswers[0]);
        degrees += 1;
      }
      if (exercise.id.includes('.bank.')) {
        const name = exercise.id.split('.').pop()!;
        expect(exercise.correctAnswers).toEqual(scales[name].slice(0, -1));
        for (const extra of exercise.options.filter((o) => !exercise.correctAnswers.includes(o))) expect(scales[name].includes(extra), `extra tile ${extra} belongs to ${name}`).toBe(false);
        banks += 1;
      }
      if (exercise.id.includes('.acc.')) expect(exercise.correctAnswers[0], exercise.id).toBe(signs[exercise.id.split('.acc.').pop()!]);
    }
    expect(staffs).toBeGreaterThan(30);
    expect(missing).toBeGreaterThan(60);
    expect(degrees).toBeGreaterThan(30);
    expect(banks).toBeGreaterThan(20);
  });

  it('limits lesson 1 to C and G major and pairs the signs right', () => {
    const lesson1 = courseNodes(provider.course).find((n) => n.id === 'music.u05.l1')!;
    for (const seed of seeds) {
      for (const e of provider.exercises(lesson1, seed).filter((x) => x.id.includes('.missing.') || x.id.includes('.degree.') || x.id.includes('.bank.'))) {
        expect(e.id.includes('C-Dur') || e.id.includes('G-Dur') || e.id.includes('pattern'), e.id).toBe(true);
      }
    }
    const major: Record<string, string> = { 'C-Dur': 'keine Vorzeichen', 'G-Dur': 'Fis', 'F-Dur': 'B', 'D-Dur': 'Fis und Cis', 'B-Dur': 'B und Es' };
    for (const { exercise } of all(5).filter((i) => i.exercise.id.includes('.pairs.'))) for (const pair of exercise.pairs) expect(major[pair.front]).toBe(pair.back);
  });
});

describe('the music course: unit 6', () => {
  const facts: Record<string, [number, number]> = {
    'reine Prim': [0, 0], 'kleine Sekunde': [1, 1], 'große Sekunde': [1, 2], 'kleine Terz': [2, 3], 'große Terz': [2, 4], 'reine Quarte': [3, 5],
    'reine Quinte': [4, 7], 'kleine Sexte': [5, 8], 'große Sexte': [5, 9], 'kleine Septime': [6, 10], 'große Septime': [6, 11], 'reine Oktave': [7, 12],
  };
  const sizeSteps: Record<string, number> = { Prim: 0, Sekunde: 1, Terz: 2, Quarte: 3, Quinte: 4, Sexte: 5, Septime: 6, Oktave: 7 };
  const nameIn = (text: string) => Object.keys(facts).find((k) => text.includes(k))!;

  it('has right interval exercises', () => {
    let named = 0, numbers = 0, built = 0, ears = 0, semisAsked = 0;
    for (const { exercise } of all(6)) {
      const spec = staff(exercise);
      if ((exercise.id.includes('.name.') || exercise.id.includes('.nametype.')) && spec && spec.notes.length === 2) {
        const [steps, semis] = facts[exercise.correctAnswers[0]];
        const a = spec.notes[0].pitch, b = spec.notes[1].pitch;
        expect(midiOf(b) - midiOf(a), exercise.id).toBe(semis);
        expect(diatonic(b) - diatonic(a), exercise.id).toBe(steps);
        named += 1;
      }
      if (exercise.id.includes('.num.') && spec && spec.notes.length === 2) {
        expect(diatonic(spec.notes[1].pitch) - diatonic(spec.notes[0].pitch), exercise.id).toBe(sizeSteps[exercise.correctAnswers[0]]);
        numbers += 1;
      }
      if ((exercise.id.includes('.build.') || exercise.id.includes('.buildchoice.')) && spec?.notes[0]) {
        const base = spec.notes[0].pitch;
        const [steps, semis] = facts[nameIn(exercise.prompt)];
        const p = parsed(exercise.correctAnswers[0])!;
        expect((p.letter - base.letter + 7) % 7, exercise.id).toBe(steps % 7);
        expect((pitchClass(pitch(p.letter, 0, p.alteration)) - pitchClass(base) + 12) % 12, exercise.id).toBe(semis % 12);
        built += 1;
      }
      const t = tones(exercise);
      if (exercise.id.includes('.hear.') && t) {
        expect(t.together).toBe(false);
        expect(facts[exercise.correctAnswers[0]][1], exercise.id).toBe(t.midi[1] - t.midi[0]);
        ears += 1;
      }
      if (exercise.id.includes('.semis.')) {
        expect(Number(exercise.correctAnswers[0])).toBe(facts[nameIn(exercise.prompt)][1]);
        semisAsked += 1;
      }
      if (exercise.id.includes('.invert.')) {
        const inverse = facts[exercise.correctAnswers[0]], original = facts[nameIn(exercise.prompt)];
        expect(inverse[1] + original[1]).toBe(12);
        expect(inverse[0] + original[0]).toBe(7);
      }
      if (exercise.kind === 'pianoKey') {
        const [, semis] = facts[nameIn(exercise.prompt)];
        const base = parsed(exercise.prompt.split(' über ').pop()!.split(' ')[0].replace(/\.$/, ''))!;
        const expected = (pitchClass(pitch(base.letter, 4, base.alteration)) + semis) % 12;
        expect(exercise.correctAnswers.every((a) => Number(a) % 12 === expected), exercise.id).toBe(true);
      }
    }
    expect([named, numbers, built, ears].every((c) => c > 60)).toBe(true);
    expect(semisAsked).toBeGreaterThan(20);
  });

  it('uses only taught intervals by ear', () => {
    const allowed: Record<string, Set<number>> = { 'music.u06.l2': new Set([2, 3, 4, 5, 7, 12]), 'music.u06.l3': new Set([3, 4, 5, 7, 8, 9, 10, 12]) };
    for (const node of courseNodes(provider.course).filter((n) => n.unitNumber === 6 && n.kind !== 'chest')) {
      for (const seed of seeds) {
        for (const exercise of provider.exercises(node, seed)) {
          const t = tones(exercise);
          if (!t) continue;
          expect(node.id).not.toBe('music.u06.l1');
          const pool = allowed[node.id];
          if (pool) {
            expect(pool.has(t.midi[1] - t.midi[0]), `${node.id}: ${t.midi}`).toBe(true);
            for (const option of exercise.options) expect(pool.has(facts[option][1]), `${node.id}: option ${option}`).toBe(true);
          }
          expect(t.midi[1] - t.midi[0], 'no tritone by ear').not.toBe(6);
        }
      }
    }
    for (const node of courseNodes(provider.course).filter((n) => n.unitNumber === 4 && n.index === 1 && n.kind === 'lesson')) expect(provider.exercises(node, 1n).every((e) => tones(e) === null)).toBe(true);
  });
});

describe('the music course: units 7 and 8', () => {
  const triads: Record<string, string[]> = {
    'C-Dur': ['C', 'E', 'G'], 'G-Dur': ['G', 'H', 'D'], 'F-Dur': ['F', 'A', 'C'], 'D-Dur': ['D', 'Fis', 'A'], 'A-Moll': ['A', 'C', 'E'], 'E-Moll': ['E', 'G', 'H'],
    'D-Moll': ['D', 'F', 'A'], 'Es-Dur': ['Es', 'G', 'B'], 'B-Dur': ['B', 'D', 'F'], 'As-Dur': ['As', 'C', 'Es'], 'G-Moll': ['G', 'B', 'D'], 'C-Moll': ['C', 'Es', 'G'], 'F-Moll': ['F', 'As', 'C'],
  };

  it('has right triad exercises', () => {
    let staffs = 0, ears = 0, missing = 0, banks = 0, pairs = 0;
    for (const { exercise } of all(7)) {
      const spec = staff(exercise);
      if (exercise.id.includes('.staff.') && spec) {
        expect(spec.chord).toBe(true);
        expect(spec.notes.map((n) => germanName(n.pitch)), exercise.id).toEqual(triads[exercise.correctAnswers[0]]);
        staffs += 1;
      }
      if (exercise.id.includes('.kind.') && spec) {
        const diffs = spec.notes.slice(1).map((n, i) => midiOf(n.pitch) - midiOf(spec.notes[i].pitch));
        const major = diffs[0] === 4 && diffs[1] === 3;
        expect(exercise.correctAnswers[0]).toBe(major ? 'Dur' : 'Moll');
        expect(major || (diffs[0] === 3 && diffs[1] === 4)).toBe(true);
      }
      const t = tones(exercise);
      if (exercise.id.includes('.hear.') && t) {
        expect(t.together).toBe(true);
        const diffs = t.midi.slice(1).map((m, i) => m - t.midi[i]);
        const major = diffs[0] === 4 && diffs[1] === 3;
        expect(major || (diffs[0] === 3 && diffs[1] === 4), `${t.midi}`).toBe(true);
        expect(exercise.correctAnswers[0]).toBe(major ? 'Dur' : 'Moll');
        expect([...exercise.options].sort()).toEqual(['Dur', 'Moll']);
        ears += 1;
      }
      if (exercise.id.includes('.missing.')) {
        const name = exercise.prompt.split(':')[0];
        const shown = exercise.prompt.slice(name.length + 2).split('. Welcher')[0].split(' – ');
        expect(triads[name][shown.indexOf('?')]).toBe(exercise.correctAnswers[0]);
        missing += 1;
      }
      if (exercise.id.includes('.bank.')) { expect(exercise.correctAnswers).toEqual(triads[exercise.id.split('.bank.').pop()!]); banks += 1; }
      if (exercise.id.includes('.pairs.')) { for (const pair of exercise.pairs) expect(pair.back).toBe(triads[pair.front].join(' – ')); pairs += 1; }
      if (exercise.id.includes('.part.')) {
        const name = exercise.prompt.split(' des ')[1].split('-Dreiklangs')[0];
        expect(exercise.correctAnswers[0]).toBe(triads[name][exercise.prompt.includes('Terz') ? 1 : 2]);
      }
    }
    expect([staffs, ears, missing, banks].every((c) => c > 40)).toBe(true);
    expect(pairs).toBeGreaterThan(10);
  });

  it('plays no triad by ear in lesson 1', () => {
    const first = courseNodes(provider.course).find((n) => n.id === 'music.u07.l1')!;
    for (const seed of seeds) expect(provider.exercises(first, seed).every((e) => tones(e) === null)).toBe(true);
  });

  const majors: Record<number, string> = { 0: 'C-Dur', 1: 'G-Dur', 2: 'D-Dur', 3: 'A-Dur', 4: 'E-Dur', [-1]: 'F-Dur', [-2]: 'B-Dur', [-3]: 'Es-Dur', [-4]: 'As-Dur' };
  const relatives: Record<string, string> = { 'C-Dur': 'A-Moll', 'G-Dur': 'E-Moll', 'D-Dur': 'H-Moll', 'A-Dur': 'Fis-Moll', 'E-Dur': 'Cis-Moll', 'F-Dur': 'D-Moll', 'B-Dur': 'G-Moll', 'Es-Dur': 'C-Moll', 'As-Dur': 'F-Moll' };

  it('has right key exercises', () => {
    let reads = 0, notes = 0, relations = 0, circles = 0;
    const sharpLetters = [3, 0, 4, 1, 5, 2, 6], flatLetters = [6, 2, 5, 1, 4, 0, 3];
    for (const { exercise } of all(8)) {
      const spec = staff(exercise);
      if (exercise.id.includes('.read.') && spec) { expect(exercise.correctAnswers[0], exercise.id).toBe(majors[spec.keySignature]); reads += 1; }
      if (exercise.id.includes('.readminor.') && spec) expect(exercise.correctAnswers[0], exercise.id).toBe(relatives[majors[spec.keySignature]]);
      if ((exercise.id.includes('.note.') || exercise.id.includes('.notetype.')) && spec?.notes[0]) {
        const key = spec.keySignature;
        const n = spec.notes[0].pitch;
        const expected = key > 0 && sharpLetters.slice(0, key).includes(n.letter) ? 1 : key < 0 && flatLetters.slice(0, -key).includes(n.letter) ? -1 : 0;
        expect(n.alteration).toBe(expected);
        const table: Record<number, Record<string, string>> = { 1: { F: 'Fis', C: 'Cis', G: 'Gis', D: 'Dis' }, [-1]: { H: 'B', E: 'Es', A: 'As', D: 'Des' } };
        const letter = letterNames[n.letter];
        expect(exercise.correctAnswers[0], exercise.id).toBe(expected === 0 ? letter : table[expected][letter]);
        notes += 1;
      }
      if (exercise.id.includes('.relminor') || exercise.id.includes('.relmajor')) {
        const major = exercise.prompt.includes('Paralleltonart von ') ? exercise.prompt.split('Paralleltonart von ')[1].slice(0, -1) : exercise.correctAnswers[0];
        const minor = exercise.id.includes('.relmajor') ? exercise.prompt.split('gehört ')[1].split(' als')[0] : exercise.correctAnswers[0];
        expect(relatives[major], exercise.id).toBe(minor);
        relations += 1;
      }
      if (exercise.id.includes('.keyof')) expect(exercise.correctAnswers[0], exercise.id).toBe(majors[Number(exercise.id.split('.').pop())]);
      if (exercise.id.includes('.circle.')) {
        const up = exercise.prompt.includes('über');
        const from = exercise.prompt.split(up ? 'über ' : 'unter ').pop()!.slice(0, -1);
        const start = Number(Object.entries(majors).find(([, v]) => v === from)![0]);
        expect(majors[start + (up ? 1 : -1)]).toBe(exercise.correctAnswers[0]);
        circles += 1;
      }
      if (exercise.id.includes('.order.') && exercise.kind === 'wordBank') {
        const a = exercise.correctAnswers.join(',');
        expect(a === 'Fis,Cis,Gis,Dis' || a === 'B,Es,As,Des').toBe(true);
      }
      if (exercise.id.includes('.pairs.') && exercise.kind === 'matchPairs' && !exercise.pairs[0]?.back.includes('Moll')) {
        const signs: Record<string, string> = { 'C-Dur': 'keine Vorzeichen', 'G-Dur': '1 Kreuz', 'D-Dur': '2 Kreuze', 'A-Dur': '3 Kreuze', 'E-Dur': '4 Kreuze', 'F-Dur': '1 Be', 'B-Dur': '2 Be', 'Es-Dur': '3 Be', 'As-Dur': '4 Be' };
        for (const pair of exercise.pairs) expect(signs[pair.front]).toBe(pair.back);
      }
    }
    expect([reads, notes, relations].every((c) => c > 40)).toBe(true);
    expect(circles).toBeGreaterThan(20);
  });
});

describe('the music course: media', () => {
  it('uses only staff and tones', () => {
    const withStaff = new Set<number>(), withTones = new Set<number>();
    for (let unit = 1; unit <= 8; unit++) {
      for (const { exercise } of all(unit)) {
        const kind = exercise.media?.kind;
        if (kind === 'staff') withStaff.add(unit);
        else if (kind === 'tones') withTones.add(unit);
        else expect(kind, `${exercise.id} uses media the course must not use`).toBeUndefined();
        expect(['multipleChoice', 'pianoKey', 'typeAnswer', 'wordBank', 'matchPairs']).toContain(exercise.kind);
        if (exercise.kind === 'pianoKey') expect(exercise.correctAnswers.length).toBeGreaterThan(0);
      }
    }
    expect([...withStaff].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...withTones].sort()).toEqual([4, 6, 7]);
  });
});
