// Port of LernwerkTests/MathCourseMiddleTests.swift: structure, determinism, audit, and the soundness of every
// template at every level. The exactness against the Swift output is in mathMiddleFixture.test.ts.
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import { structureProblems } from '../../src/lib/learn/course';
import { type ExerciseKind, folded } from '../../src/lib/learn/exercise';
import { NumberCheck } from '../../src/lib/learn/numberCheck';
import { lessonExercises, skillMap } from '../../src/lib/learn/skills/skill';
import { catalogUnits } from '../../src/lib/learn/math/middle/catalog';
import { problemKey, problemOptions } from '../../src/lib/learn/math/middle/core';
import { Expr, close, draws, match, number, provider } from './mathMiddleKit';

const T60 = 120_000;
const chars = (s: string): number => Array.from(s).length;
const idHead = (id: string): string => id.split('.').slice(0, 2).join('.');

describe('structure', () => {
  it('the course describes itself', () => {
    const course = provider.course;
    expect(course.id).toBe('mathm');
    expect(course.title).toBe('Mathe Mittelstufe');
    expect(course.subtitle).toBe('Klasse 5 bis 10');
    expect(course.kind).toBe('math');
    expect(course.color).toBe(0x3d6fb6);
    expect(course.symbol).toBe('percent');
    expect(course.units.length).toBe(10);
    expect(structureProblems(provider)).toEqual([]);
    expect(course.units.map((u) => u.title)).toEqual([
      'Brüche verstehen', 'Bruchrechnung', 'Dezimalzahlen und Prozent', 'Terme und lineare Gleichungen',
      'Dreisatz und Proportionalität', 'Lineare Funktionen', 'Potenzen und Wurzeln', 'Geometrie',
      'Quadratische Gleichungen und Funktionen', 'Wahrscheinlichkeit',
    ]);
    for (const unit of course.units) {
      expect(unit.nodes.map((n) => n.kind), unit.id).toEqual(['lesson', 'lesson', 'lesson', 'practice', 'checkpoint', 'chest']);
      const paragraphs = unit.tip.split('\n\n').filter((p) => p !== '');
      expect(paragraphs.length >= 2 && paragraphs.length <= 5, `${unit.id} tip has ${paragraphs.length} paragraphs`).toBe(true);
      expect(unit.summary).not.toBe('');
    }
  });

  it('the skill map is the default: one skill per unit', () => {
    const map = skillMap(provider);
    expect(map.skills.length).toBe(10);
    expect(map.problems()).toEqual([]);
    for (const skill of map.skills) expect(skill.facet).toBe('main');
  });

  it('the catalog has ten units with enough templates', () => {
    const units = catalogUnits();
    expect(units.length).toBe(10);
    units.forEach((templates, index) => {
      const prefix = `u${String(index + 1).padStart(2, '0')}.`;
      expect(templates.length, `unit ${index + 1}`).toBeGreaterThanOrEqual(5);
      expect(templates.every((t) => t.id.startsWith(prefix)), `unit ${index + 1} template ids`).toBe(true);
      expect(new Set(templates.map((t) => t.id)).size, `unit ${index + 1} duplicate ids`).toBe(templates.length);
      for (let lesson = 1; lesson <= 3; lesson++) {
        expect(templates.filter((t) => t.lesson === lesson).length, `unit ${index + 1} lesson ${lesson}`).toBeGreaterThanOrEqual(2);
      }
      expect(templates.some((t) => t.forms.has('typed'))).toBe(true);
      expect(templates.some((t) => t.forms.has('pairs'))).toBe(true);
    });
  });
});

describe('audit and determinism', () => {
  it('the audit finds nothing', { timeout: T60 }, () => {
    const seeds: bigint[] = [];
    for (let s = 1n; s <= 20n; s++) seeds.push(s);
    expect(CourseAudit.problems(provider, seeds)).toEqual([]);
  });

  it('the same seed gives the same exercises and another seed others', () => {
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') {
        expect(provider.exercises(node, 1n)).toEqual([]);
        continue;
      }
      expect(provider.exercises(node, 7n), node.id).toEqual(provider.exercises(node, 7n));
      expect(provider.exercises(node, 7n).map((e) => e.prompt), node.id).not.toEqual(provider.exercises(node, 8n).map((e) => e.prompt));
    }
  });

  it('lessonExercises tags every exercise with the unit skill', () => {
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') continue;
      for (const e of lessonExercises(provider, node, 3n)) {
        expect(e.skill).toBe(node.unitID + '.main');
        expect(e.level).not.toBeNull();
      }
    }
  });
});

describe('exercises', () => {
  it('every exercise of every seed is sound', { timeout: T60 }, () => {
    const messages: string[] = [];
    let typedCount = 0;
    let choiceCount = 0;
    let pairCount = 0;
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') continue;
      for (let s = 1n; s <= 30n; s++) {
        const exercises = provider.exercises(node, s);
        messages.push(...CourseAudit.problemsInExercises(exercises, node).map((p) => `${p} (seed ${s})`));
        const kinds = new Set(exercises.map((e) => e.kind));
        if (kinds.size < 2) messages.push(`${node.id} seed ${s}: fewer than two kinds`);
        if (!kinds.has('typeAnswer')) messages.push(`${node.id} seed ${s}: nothing to type`);
        const asked = exercises.map((e) => e.prompt + '|' + e.options.slice().sort().join(';'));
        if (new Set(asked).size !== asked.length) messages.push(`${node.id} seed ${s}: the same question twice`);
        for (const exercise of exercises) {
          const label = `${node.id} seed ${s} ${exercise.id}`;
          if (exercise.explanation.trim() === '') messages.push(`${label}: no explanation`);
          if (chars(exercise.prompt) > 260) messages.push(`${label}: prompt too long`);
          switch (exercise.kind) {
            case 'typeAnswer':
              typedCount += 1;
              if (exercise.mode !== 'number') messages.push(`${label}: typed answer not in number mode`);
              for (const answer of exercise.correctAnswers) {
                const value = NumberCheck.parse(answer);
                if (!value) {
                  messages.push(`${label}: answer ${answer} does not parse`);
                  continue;
                }
                if (Math.abs(value.doubleValue) >= 1000) messages.push(`${label}: typed answer ${answer} is 1000 or more`);
                // The answer written as a decimal and, for a mixed number, as one is accepted as well.
                if (!NumberCheck.matches(value.germanText, answer)) messages.push(`${label}: ${value.germanText} not accepted`);
                if (!NumberCheck.matches(value.fractionText, answer)) messages.push(`${label}: ${value.fractionText} not accepted`);
              }
              break;
            case 'multipleChoice':
              choiceCount += 1;
              if (exercise.options.length < 3) messages.push(`${label}: only ${exercise.options.length} options`);
              break;
            case 'matchPairs':
              pairCount += 1;
              break;
            default:
              messages.push(`${label}: unexpected kind ${exercise.kind}`);
          }
        }
      }
    }
    expect(messages.slice(0, 12)).toEqual([]);
    expect(typedCount).toBeGreaterThan(0);
    expect(choiceCount).toBeGreaterThan(0);
    expect(pairCount).toBeGreaterThan(0);
  });

  it('every unit uses all three forms and every template is asked in its checkpoint', { timeout: T60 }, () => {
    for (const unit of provider.course.units) {
      const kinds = new Set<ExerciseKind>();
      for (const node of unit.nodes) {
        if (node.kind === 'chest') continue;
        for (let s = 1n; s <= 5n; s++) provider.exercises(node, s).forEach((e) => kinds.add(e.kind));
      }
      expect([...kinds].sort(), unit.id).toEqual(['matchPairs', 'multipleChoice', 'typeAnswer']);
      const checkpoint = unit.nodes.find((n) => n.kind === 'checkpoint');
      if (!checkpoint) continue;
      const templates = catalogUnits()[unit.number - 1];
      for (let s = 1n; s <= 30n; s++) {
        const asked = new Set(provider.exercises(checkpoint, s).map((e) => idHead(e.id)));
        // At most one template may be missing: a draw of the numbers can fail now and then.
        expect(templates.filter((t) => !asked.has(t.id)).length, `${checkpoint.id} seed ${s}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('lessons teach their own third and review the earlier ones', { timeout: T60 }, () => {
    for (const unit of provider.course.units) {
      const templates = catalogUnits()[unit.number - 1];
      for (const node of unit.nodes) {
        if (node.kind !== 'lesson') continue;
        let own = 0;
        let total = 0;
        for (let s = 1n; s <= 20n; s++) {
          for (const exercise of provider.exercises(node, s)) {
            const id = idHead(exercise.id);
            const t = templates.find((x) => x.id === id);
            if (!t) throw new Error(`${exercise.id} is no template of ${unit.id}`);
            total += 1;
            if (t.lesson === node.index) own += 1;
            expect(t.lesson, `${node.id} asks ${t.id} before it is taught`).toBeLessThanOrEqual(node.index);
          }
        }
        expect(own / total, `${node.id} mostly teaches its own templates`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it('practice mixes earlier units', { timeout: T60 }, () => {
    for (const unit of provider.course.units) {
      if (unit.number < 2) continue;
      const practice = unit.nodes.find((n) => n.kind === 'practice');
      if (!practice) continue;
      let earlier = 0;
      for (let s = 1n; s <= 20n; s++) {
        for (const exercise of provider.exercises(practice, s)) {
          const number = Number(exercise.id.slice(1, 3)) || 0;
          expect(number, practice.id).toBeLessThanOrEqual(unit.number);
          if (number < unit.number) earlier += 1;
        }
      }
      expect(earlier, `${practice.id} reviews earlier units`).toBeGreaterThan(20 * 2);
    }
  });
});

describe('templates', () => {
  it('every template is sound at every level', { timeout: T60 }, () => {
    const forbidden = ['Optional', '(null)', '1/0', '/0 ', '[', ']'];
    const failures: string[] = [];
    const fail = (message: string): void => {
      failures.push(message);
    };
    for (const templates of catalogUnits()) {
      for (const t of templates) {
        let choiceReady = 0;
        let typedDraws = 0;
        let typedSmall = 0;
        const all = draws(t.id);
        for (let level = 1; level <= 3; level++) {
          const atLevel = all.filter((d) => d.level === level);
          if (atLevel.length < 30) fail(`${t.id} level ${level} rarely makes a problem`);
          if (new Set(atLevel.map((d) => problemKey(d.problem))).size < 5) fail(`${t.id} level ${level} has too little variety`);
          for (const draw of atLevel) {
            const p = draw.problem;
            const label = `${t.id} L${level} seed ${draw.seed}`;
            if (p.prompt === '' || p.correct === '' || p.solution === '' || p.explanation === '') fail(label);
            const everything = [p.prompt, p.correct, p.solution, p.explanation, p.typed?.prompt ?? '', p.pairFront ?? '', ...p.wrong.map((w) => w.text)];
            for (const text of everything) {
              for (const word of forbidden) if (text.includes(word)) fail(`${label}: contains ${word}: ${text}`);
              if (match(/\b(nan|inf)\b/, text)) fail(`${label}: not a number in ${text}`);
              // A minus zero ("−0") is a slip; a negative decimal like −0,5 is fine.
              if (match(/‒0(?![,.\d])/, text)) fail(`${label}: minus zero in ${text}`);
              if (match(/\d\s*-\s*\d/, text) || text.includes('*') || text.includes('×')) fail(`${label}: ASCII operator in ${text}`);
              if (chars(text) > 260) fail(`${label}: text too long`);
            }
            if ((p.typed !== null) !== t.forms.has('typed')) fail(`${label}: typed form`);
            if ((p.pairFront !== null) !== t.forms.has('pairs')) fail(`${label}: pair form`);
            // The wrong options: no two alike for the exercise factory, none equal to the right one.
            const options = problemOptions(p);
            const foldedAll = [p.correct, ...options].map(folded);
            if (new Set(foldedAll).size !== foldedAll.length) fail(`${label}: options alike`);
            // Whatever the student sees as a wrong option is not worth the same as the right one.
            const right = number(p.correct);
            if (right !== null && p.correctValue !== null && !p.allowsEquivalentWrong) {
              for (const option of options) {
                const value = number(option);
                if (value !== null && close(value, right)) fail(`${label}: the wrong option ${option} is worth the same as ${p.correct}`);
              }
            }
            if (options.length >= 2) choiceReady += 1;
            if (p.typed) {
              typedDraws += 1;
              if (!Number.isFinite(p.typed.answer.doubleValue)) fail(label);
              if (Math.abs(p.typed.answer.doubleValue) < 1000) typedSmall += 1;
              if (!NumberCheck.matches(p.typed.answer.fractionText, p.typed.answer.fractionText)) fail(label);
            }
          }
        }
        if (t.forms.has('choice') && choiceReady / all.length < 0.9) fail(`${t.id} rarely has enough wrong options`);
        if (t.forms.has('typed') && typedSmall / typedDraws < 0.95) fail(`${t.id} asks for big typed numbers`);
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });
});

describe('the test expression reader', () => {
  it('reads the notation of the prompts', () => {
    expect(Expr.evaluate('2 3/4 + 1 1/2')).toBeCloseTo(4.25);
    expect(Expr.evaluate('3(x − 4)', { x: 6 })).toBe(6);
    expect(Expr.evaluate('(−2)³ : 4')).toBe(-2);
    expect(Expr.evaluate('2⁻³')).toBeCloseTo(0.125);
    expect(Expr.evaluate('√(9 + 16)')).toBe(5);
    expect(Expr.evaluate('1/0')).toBeNull();
    expect(Expr.holds('2x + 1 = 7', 3)).toBe(true);
    expect(Expr.holds('2x + 1 = 7', 4)).toBe(false);
    expect(number('−3/4')).toBeCloseTo(-0.75);
    expect(number('2 3/5 kg')).toBeCloseTo(2.6);
    expect(number('0,75 %')).toBeCloseTo(0.75);
  });
});
