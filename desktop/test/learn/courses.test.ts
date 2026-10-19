import { describe, expect, it } from 'vitest';
import { providers, practising } from './shipped';
import { SkillPractice, recommend } from '../../src/lib/learn/advisor';
import { Calendar, zoneCalendar } from '../../src/lib/learn/calendar';
import { CoursePath, courseNodes, courseUnits, lessonExercises, structureProblems, CourseProvider, nodeWithID } from '../../src/lib/learn/course';
import { auditProblems } from '../../src/lib/learn/courseAudit';
import { CompetenceLevel, LearnExercise, levelOrder, missedKeys } from '../../src/lib/learn/exercise';
import { gaps, gapText, tokensOf } from '../../src/lib/learn/languages/coverage';
import { LanguageCourseProvider } from '../../src/lib/learn/languages/provider';
import { frenchSource, germanForeignSource, germanSchoolSource, latinSource, spanish, spanishSource } from '../../src/lib/learn/languages/courses';
import type { ExerciseOutcome } from '../../src/lib/learn/session';
import { SkillAssessor, SkillRecords, emptyRecord, skillMapOf } from '../../src/lib/learn/skills';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const utc = zoneCalendar('UTC');
const date = (day: number) => utc.at(2026, 5, day, 10);
const steps = (provider: CourseProvider) => courseNodes(provider.course).filter((n) => n.kind !== 'chest');

describe('the shipped language courses', () => {
  const sources: Array<[string, string, string]> = [['es', 'Spanisch', spanishSource], ['fr', 'Französisch', frenchSource], ['la', 'Latein', latinSource], ['daf', 'Deutsch als Fremdsprache', germanForeignSource], ['de', 'Deutsch', germanSchoolSource]];

  for (const [id, title, source] of sources) {
    it(`${title} parses without errors, teaches only taught words and passes the audit`, () => {
      const made = LanguageCourseProvider.make(source);
      expect(made.errors).toEqual([]);
      expect(made.provider.course.id).toBe(id);
      // The school subject has no sentences, so no coverage to check.
      expect(gaps(made.provider.data).map(gapText)).toEqual([]);
      expect(structureProblems(made.provider)).toEqual([]);
      expect(auditProblems(made.provider, [1n, 2n, 3n])).toEqual([]);
    });
  }
});

describe('the Spanish course', () => {
  const made = LanguageCourseProvider.make(spanishSource);
  const data = made.provider.data;

  it('describes the Spanish course for German speakers', () => {
    expect([data.id, data.title, data.subtitle, data.kind, data.color, data.symbol, data.speech, data.instruction, data.targetName, data.intoName, data.produces])
      .toEqual(['es', 'Spanisch', 'Für Deutschsprachige · A1', 'language', 0xd9903a, 'text.bubble.fill', 'es-ES', 'de', 'Spanisch', 'Spanische', true]);
  });

  it('is large enough and every unit has the right size', () => {
    expect(data.units.length).toBeGreaterThanOrEqual(8);
    expect(data.units.flatMap((u) => u.words).length).toBeGreaterThanOrEqual(120);
    expect(data.units.flatMap((u) => u.sentences).length).toBeGreaterThanOrEqual(60);
    expect(data.units.flatMap((u) => u.forms).length).toBeGreaterThanOrEqual(50);
    data.units.forEach((unit, index) => {
      const place = `unit ${index + 1} ${unit.title}`;
      const items = unit.words.length + unit.sentences.length + unit.forms.length + unit.fills.length + unit.facts.length;
      expect(items >= 22 && items <= 32, `${place}: ${items} items`).toBe(true);
      expect(unit.words.length >= 10 && unit.words.length <= 15, `${place}: words`).toBe(true);
      expect(unit.sentences.length >= 6 && unit.sentences.length <= 10, `${place}: sentences`).toBe(true);
      const paragraphs = unit.tip.split('\n\n');
      expect(paragraphs.length >= 3 && paragraphs.length <= 5, `${place}: ${paragraphs.length} tip paragraphs`).toBe(true);
      expect(courseUnits(made.provider.course)[index].nodes.filter((n) => n.kind === 'lesson')).toHaveLength(5);
    });
  });

  it("every unit's tip teaches with examples from its own words", () => {
    data.units.forEach((unit, index) => {
      const tip = new Set(tokensOf(unit.tip));
      const own = unit.words.flatMap((w) => tokensOf(w.target)).filter((t) => [...t].length >= 4);
      expect(own.filter((t) => tip.has(t)).length, `unit ${index + 1}`).toBeGreaterThanOrEqual(3);
    });
    for (const mark of ['¿', '¡', 'á', 'é', 'í', 'ó', 'ú', 'ñ']) expect(data.units[0].tip).toContain(mark);
  });

  it('every word meets the student in at least three forms across its unit', () => {
    data.units.forEach((unit, unitIndex) => {
      // One pass over the unit's steps and a few plays (seeds), noting which forms each word came up in.
      const forms = unit.words.map(() => new Set<string>());
      for (const n of courseUnits(made.provider.course)[unitIndex].nodes) {
        if (n.kind === 'chest') continue;
        for (let seed = 1n; seed <= 8n; seed++) {
          for (const e of made.provider.exercises(n, seed)) {
            const match = /#w(\d+)-(\d+)/.exec(e.id);
            if (match && Number(match[1]) === unitIndex) forms[Number(match[2])].add(e.id[e.id.length - 1]);
          }
        }
      }
      unit.words.forEach((word, index) => expect(forms[index].size, `${word.target}: ${[...forms[index]].sort()}`).toBeGreaterThanOrEqual(3));
    });
  });

  it('every sentence, form, fill and fact appears in the unit exercises', () => {
    data.units.forEach((unit, unitIndex) => {
      const seen = new Set<string>();
      for (const n of courseUnits(made.provider.course)[unitIndex].nodes) {
        if (n.kind === 'chest') continue;
        for (let seed = 1n; seed <= 4n; seed++) for (const e of made.provider.exercises(n, seed)) seen.add(e.cardKeys[0] ?? '');
      }
      const expected = [
        ...unit.words.map((_, i) => `w${unitIndex}-${i}`), ...unit.sentences.map((_, i) => `s${unitIndex}-${i}`), ...unit.forms.map((_, i) => `f${unitIndex}-${i}`),
        ...unit.fills.map((_, i) => `g${unitIndex}-${i}`), ...unit.facts.map((_, i) => `q${unitIndex}-${i}`),
      ];
      for (const key of expected) expect(seen.has(key), `unit ${unitIndex + 1}: ${key} never comes up`).toBe(true);
    });
  });

  it('speech uses the Spanish voice of Spain', () => {
    const list: LearnExercise[] = [];
    for (let seed = 1n; seed <= 4n; seed++) list.push(...made.provider.exercises(nodeWithID(made.provider.course, 'es.u01.p')!, seed));
    const languages = list.flatMap((e) => (e.media?.kind === 'speech' ? [e.media.language] : []));
    expect(languages.length).toBeGreaterThan(0);
    expect(languages.every((l) => l === 'es-ES')).toBe(true);
  });

  it('typed Spanish is strict about letters but forgives accents and capitals', () => {
    const pool: LearnExercise[] = [];
    for (let seed = 1n; seed <= 40n; seed++) pool.push(...made.provider.exercises(nodeWithID(made.provider.course, 'es.u02.t')!, seed));
    const typed = pool.filter((e) => e.kind === 'typeAnswer' && e.mode === 'exact');
    const brother = typed.find((e) => e.correctAnswers.length === 1 && e.correctAnswers[0] === 'el hermano')!;
    expect(missedKeys(brother, { type: 'typed', value: 'El Hermano' })).toEqual(new Set());
    expect(missedKeys(brother, { type: 'typed', value: 'el hermana' })).toEqual(new Set([brother.cardKeys[0]]));
    const sister = typed.find((e) => e.correctAnswers[0] === 'la hermana')!;
    expect(missedKeys(sister, { type: 'typed', value: 'la hermano' })).toEqual(new Set([sister.cardKeys[0]]));
  });

  it('word bank tiles have no Spanish punctuation marks', () => {
    data.units.forEach((_, unit) => {
      const n = nodeWithID(made.provider.course, `es.u${String(unit + 1).padStart(2, '0')}.p`)!;
      for (const e of made.provider.exercises(n, 3n)) if (e.kind === 'wordBank') for (const tile of e.options) expect(/[¿?¡!.,]/.test(tile), `${e.id}: ${tile}`).toBe(false);
    });
  });
});

describe('the skills of the shipped courses', () => {
  it('every shipped course has a sound skill map', () => {
    expect(providers.length).toBeGreaterThanOrEqual(5);
    for (const provider of providers) {
      const map = skillMapOf(provider);
      expect(map.problems(), provider.course.id).toEqual([]);
      for (const unit of courseUnits(provider.course)) expect(map.skillsInUnit(unit.id).length, `${provider.course.id} ${unit.id} has no skill`).toBeGreaterThan(0);
    }
  });

  it('language units have their own goals with prerequisites', () => {
    const map = skillMapOf(spanish);
    const first = map.skillsInUnit('es.u01');
    expect(first.some((s) => s.facet === 'vocab')).toBe(true);
    expect(first.find((s) => s.facet === 'sentences')?.prerequisites).toEqual(['es.u01.vocab']);
    expect(map.skill('es.u02.vocab')?.prerequisites).toEqual(['es.u01.vocab']);
  });

  it('every exercise of a step belongs to a declared goal', () => {
    for (const provider of practising()) {
      const map = skillMapOf(provider);
      for (const node of steps(provider)) {
        for (let seed = 1n; seed <= 2n; seed++) {
          for (const e of lessonExercises(provider, node, seed)) {
            expect(e.skill, `${e.id} has no skill`).not.toBe('');
            expect(e.level, e.id).toBeDefined();
            expect(map.skill(e.skill), `${e.id} -> ${e.skill}`).toBeDefined();
          }
        }
      }
    }
  });

  it('every level a goal asks for is shown in its steps', () => {
    for (const provider of practising()) {
      const map = skillMapOf(provider);
      const seen = new Map<string, Set<CompetenceLevel>>();
      for (const node of steps(provider)) {
        for (let seed = 1n; seed <= 4n; seed++) {
          for (const e of lessonExercises(provider, node, seed)) if (e.level) seen.set(e.skill, (seen.get(e.skill) ?? new Set()).add(e.level));
        }
      }
      for (const skill of map.skills) for (const level of skill.levels) expect(seen.get(skill.id)?.has(level) ?? false, `${skill.id} never asks at level ${level}`).toBe(true);
    }
  });

  const outcomesOf = (list: LearnExercise[], right: (level: CompetenceLevel) => boolean): ExerciseOutcome[] =>
    list.flatMap((e) => (e.level ? [{ exerciseID: e.id, skill: e.skill, level: e.level, right: right(e.level), helped: false }] : []));

  /** Plays every step of the course once, right on every first try, and records it. */
  const perfectDay = (provider: CourseProvider, day: number, seed: bigint, records: SkillRecords) => {
    const map = skillMapOf(provider);
    for (const node of steps(provider)) SkillAssessor.record(outcomesOf(lessonExercises(provider, node, seed), () => true), node, map, records, date(day), utc);
  };

  it('a student who answers everything right masters every goal within a few days of path', () => {
    for (const provider of practising()) {
      const map = skillMapOf(provider);
      const records: SkillRecords = {};
      perfectDay(provider, 1, 1n, records);
      perfectDay(provider, 2, 2n, records);
      // Goals the path alone gives too few answers for get the rounds the advice would suggest.
      for (let day = 2; day <= 5; day++) {
        for (const skill of map.skills) {
          if (SkillAssessor.status(records[skill.id], skill, new Set(), date(day), utc) === 'mastered') continue;
          const round = SkillPractice.exercises(provider, map, [skill.id], records, BigInt(day * 100));
          SkillAssessor.record(outcomesOf(round, () => true), null, map, records, date(day), utc);
        }
      }
      for (const skill of map.skills) {
        const status = SkillAssessor.status(records[skill.id], skill, new Set(), date(5), utc);
        expect(status, `${skill.id} is ${status}: ${SkillAssessor.missing(records[skill.id] ?? emptyRecord(), skill)}`).toBe('mastered');
      }
    }
  });

  it('one day alone never masters anything', () => {
    const provider = spanish;
    const map = skillMapOf(provider);
    const records: SkillRecords = {};
    perfectDay(provider, 1, 1n, records);
    perfectDay(provider, 1, 2n, records);
    for (const skill of map.skills) expect(SkillAssessor.status(records[skill.id], skill, new Set(), date(1), utc), skill.id).not.toBe('mastered');
  });

  it('a student who only chooses never reaches typed or applied goals', () => {
    for (const provider of [spanish]) {
      const map = skillMapOf(provider);
      const records: SkillRecords = {};
      [1n, 2n, 3n].forEach((seed, index) => {
        for (const node of steps(provider)) SkillAssessor.record(outcomesOf(lessonExercises(provider, node, seed), (level) => level === 'recognise'), node, map, records, date(1 + index), utc);
      });
      for (const skill of map.skills.filter((s) => s.levels.some((l) => levelOrder(l) > 0))) {
        const status = SkillAssessor.status(records[skill.id], skill, new Set(), date(4), utc);
        expect(['provisional', 'mastered', 'due'].includes(status), `${skill.id} is ${status}`).toBe(false);
      }
    }
  });

  it('a student who did unit 1 badly is told to practise it before unit 2', () => {
    const provider = spanish;
    const map = skillMapOf(provider);
    const records: SkillRecords = {};
    const completed = new Set<string>();
    for (const node of courseUnits(provider.course)[0].nodes) {
      if (node.kind === 'chest') continue;
      SkillAssessor.record(outcomesOf(lessonExercises(provider, node, 1n), () => false), node, map, records, date(1), utc);
      completed.add(node.id);
    }
    const units = CoursePath.units(provider.course, completed);
    const advice = recommend(map, records, units, completed, date(1), utc);
    expect(advice.kind).toBe('practice');
    expect(advice.skillIDs.every((id) => id.startsWith('es.u01.'))).toBe(true);
  });

  it('a practice round holds only exercises of the targets and is repeatable', () => {
    const map = skillMapOf(spanish);
    const target = 'es.u01.vocab';
    const first = SkillPractice.exercises(spanish, map, [target], {}, 5n);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(SkillPractice.size);
    expect(first.some((e) => e.skill === target)).toBe(true);
    expect(new Set(first.map((e) => e.id)).size).toBe(first.length);
    expect(first).toEqual(SkillPractice.exercises(spanish, map, [target], {}, 5n));
    expect(first.map((e) => e.id)).not.toEqual(SkillPractice.exercises(spanish, map, [target], {}, 6n).map((e) => e.id));
    expect(SkillPractice.exercises(spanish, map, ['nope'], {}, 1n)).toEqual([]);
  });
});

describe('the catalog', () => {
  it('has unique course ids that are no prefix of another and unique node ids', () => {
    const ids = providers.map((p) => p.course.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const first of ids) for (const second of ids) if (first !== second) expect(second.startsWith(`${first}.`), `${first} is a prefix of ${second}`).toBe(false);
    const nodeIDs = new Set<string>();
    for (const p of providers) for (const n of courseNodes(p.course)) expect(nodeIDs.add(n.id), n.id).toBe(nodeIDs);
  });
});
