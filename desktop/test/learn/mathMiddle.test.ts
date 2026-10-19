import { describe, expect, it } from 'vitest';
import { courseNodes, courseUnits } from '../../src/lib/learn/course';
import { auditProblems, exerciseListProblems } from '../../src/lib/learn/courseAudit';
import { structureProblems } from '../../src/lib/learn/course';
import { folded } from '../../src/lib/learn/exercise';
import { NumberCheck } from '../../src/lib/learn/rational';
import { problemKey, problemOptions } from '../../src/lib/learn/math/middle/core';
import { catalog, mathMiddle } from '../../src/lib/learn/math/middle/course';
import { close, draws, match, number } from './mathMiddleKit';

const provider = mathMiddle;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => BigInt(from + i));
const idOf = (id: string) => id.split('.').slice(0, 2).join('.');

describe('math middle course: structure', () => {
  it('describes itself', () => {
    const course = provider.course;
    expect([course.id, course.title, course.subtitle, course.kind, course.color, course.symbol]).toEqual(['mathm', 'Mathe Mittelstufe', 'Klasse 5 bis 10', 'math', 0x3d6fb6, 'percent']);
    const units = courseUnits(course);
    expect(units).toHaveLength(10);
    expect(structureProblems(provider)).toEqual([]);
    expect(units.map((u) => u.title)).toEqual([
      'Brüche verstehen', 'Bruchrechnung', 'Dezimalzahlen und Prozent', 'Terme und lineare Gleichungen',
      'Dreisatz und Proportionalität', 'Lineare Funktionen', 'Potenzen und Wurzeln', 'Geometrie',
      'Quadratische Gleichungen und Funktionen', 'Wahrscheinlichkeit',
    ]);
    expect(course.sections.map((s) => s.units.length)).toEqual([3, 3, 2, 2]);
    for (const unit of units) {
      expect(unit.nodes.map((n) => n.kind), unit.id).toEqual(['lesson', 'lesson', 'lesson', 'practice', 'checkpoint', 'chest']);
      const paragraphs = unit.tip.split('\n\n').filter((p) => p !== '');
      expect(paragraphs.length, `${unit.id} tip has ${paragraphs.length} paragraphs`).toBeGreaterThanOrEqual(2);
      expect(paragraphs.length, unit.id).toBeLessThanOrEqual(5);
      expect(unit.summary, unit.id).not.toBe('');
    }
  });

  it('the catalog has ten units with enough templates', () => {
    expect(catalog).toHaveLength(10);
    catalog.forEach((templates, index) => {
      const prefix = `u${String(index + 1).padStart(2, '0')}.`;
      expect(templates.length, `unit ${index + 1}`).toBeGreaterThanOrEqual(5);
      expect(templates.every((t) => t.id.startsWith(prefix)), `unit ${index + 1} template ids`).toBe(true);
      expect(new Set(templates.map((t) => t.id)).size, `unit ${index + 1} duplicate ids`).toBe(templates.length);
      for (const lesson of [1, 2, 3]) expect(templates.filter((t) => t.lesson === lesson).length, `unit ${index + 1} lesson ${lesson}`).toBeGreaterThanOrEqual(2);
      expect(templates.some((t) => t.forms.has('typed'))).toBe(true);
      expect(templates.some((t) => t.forms.has('pairs'))).toBe(true);
    });
  });

  it('the audit finds nothing', () => {
    expect(auditProblems(provider, range(1, 20))).toEqual([]);
  });

  it('the same seed gives the same exercises and another seed others', () => {
    for (const node of courseNodes(provider.course)) {
      if (node.kind === 'chest') {
        expect(provider.exercises(node, 1n)).toEqual([]);
        continue;
      }
      expect(provider.exercises(node, 7n), node.id).toEqual(provider.exercises(node, 7n));
      expect(provider.exercises(node, 7n).map((e) => e.prompt), node.id).not.toEqual(provider.exercises(node, 8n).map((e) => e.prompt));
    }
  });
});

describe('math middle course: every exercise of every node', () => {
  it('is sound for many seeds', () => {
    const messages: string[] = [];
    let typedCount = 0;
    let choiceCount = 0;
    let pairCount = 0;
    for (const node of courseNodes(provider.course)) {
      if (node.kind === 'chest') continue;
      for (const seed of range(1, 60)) {
        const exercises = provider.exercises(node, seed);
        messages.push(...exerciseListProblems(exercises, node).map((m) => `${m} (seed ${seed})`));
        const kinds = new Set(exercises.map((e) => e.kind));
        if (kinds.size < 2) messages.push(`${node.id} seed ${seed}: fewer than two kinds`);
        if (!kinds.has('typeAnswer')) messages.push(`${node.id} seed ${seed}: nothing to type`);
        const asked = exercises.map((e) => `${e.prompt}|${[...e.options].sort().join(';')}`);
        if (new Set(asked).size !== asked.length) messages.push(`${node.id} seed ${seed}: the same question twice`);
        for (const exercise of exercises) {
          const label = `${node.id} seed ${seed} ${exercise.id}`;
          if (exercise.explanation.trim() === '') messages.push(`${label}: no explanation`);
          if ([...exercise.prompt].length > 260) messages.push(`${label}: prompt too long`);
          switch (exercise.kind) {
            case 'typeAnswer':
              typedCount += 1;
              if (exercise.mode !== 'number') messages.push(`${label}: typed answer not in number mode`);
              for (const answer of exercise.correctAnswers) {
                const value = NumberCheck.parse(answer);
                if (!value) { messages.push(`${label}: answer ${answer} does not parse`); continue; }
                if (Math.abs(value.value) >= 1000) messages.push(`${label}: typed answer ${answer} is 1000 or more`);
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
    expect(messages.slice(0, 12).join('\n')).toBe('');
    expect(typedCount).toBeGreaterThan(0);
    expect(choiceCount).toBeGreaterThan(0);
    expect(pairCount).toBeGreaterThan(0);
  }, 120_000);

  it('every unit uses all three forms and every template is asked in its checkpoint', () => {
    for (const unit of courseUnits(provider.course)) {
      const kinds = new Set<string>();
      for (const node of unit.nodes) {
        if (node.kind === 'chest') continue;
        for (const seed of range(1, 5)) provider.exercises(node, seed).forEach((e) => kinds.add(e.kind));
      }
      expect([...kinds].sort(), unit.id).toEqual(['matchPairs', 'multipleChoice', 'typeAnswer']);
      const checkpoint = unit.nodes.find((n) => n.kind === 'checkpoint');
      if (!checkpoint) continue;
      const templates = catalog[unit.number - 1];
      for (const seed of range(1, 30)) {
        const asked = new Set(provider.exercises(checkpoint, seed).map((e) => idOf(e.id)));
        // At most one template may be missing: a draw of the numbers can fail now and then.
        expect(templates.filter((t) => !asked.has(t.id)).length, `${checkpoint.id} seed ${seed}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('lessons teach their own third and review the earlier ones', () => {
    for (const unit of courseUnits(provider.course)) {
      const templates = catalog[unit.number - 1];
      for (const node of unit.nodes) {
        if (node.kind !== 'lesson') continue;
        let own = 0;
        let total = 0;
        for (const seed of range(1, 20)) {
          for (const exercise of provider.exercises(node, seed)) {
            const template = templates.find((t) => t.id === idOf(exercise.id));
            if (!template) throw new Error(`${exercise.id} is no template of ${unit.id}`);
            total += 1;
            if (template.lesson === node.index) own += 1;
            expect(template.lesson, `${node.id} asks ${template.id} before it is taught`).toBeLessThanOrEqual(node.index);
          }
        }
        expect(own / total, `${node.id} mostly teaches its own templates`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it('practice mixes earlier units', () => {
    for (const unit of courseUnits(provider.course)) {
      if (unit.number < 2) continue;
      const practice = unit.nodes.find((n) => n.kind === 'practice');
      if (!practice) continue;
      let earlier = 0;
      for (const seed of range(1, 20)) {
        for (const exercise of provider.exercises(practice, seed)) {
          const number = Number(exercise.id.slice(1, 3)) || 0;
          expect(number, practice.id).toBeLessThanOrEqual(unit.number);
          if (number < unit.number) earlier += 1;
        }
      }
      expect(earlier, `${practice.id} reviews earlier units`).toBeGreaterThan(20 * 2);
    }
  });
});

describe('math middle course: every template', () => {
  it('is sound at every level', () => {
    const forbidden = ['Optional', '(null)', '1/0', '/0 ', '[', ']'];
    const failures: string[] = [];
    for (const templates of catalog) {
      for (const template of templates) {
        let choiceReady = 0;
        let typedDraws = 0;
        let typedSmall = 0;
        for (const level of [1, 2, 3]) {
          const levelDraws = draws(template.id).filter((d) => d.level === level);
          if (levelDraws.length < 30) failures.push(`${template.id} level ${level} rarely makes a problem`);
          if (new Set(levelDraws.map((d) => problemKey(d.problem))).size < 5) failures.push(`${template.id} level ${level} has too little variety`);
          for (const draw of levelDraws) {
            const p = draw.problem;
            const label = `${template.id} L${level} seed ${draw.seed}`;
            if (!p.prompt || !p.correct || !p.solution || !p.explanation) failures.push(label);
            const everything = [p.prompt, p.correct, p.solution, p.explanation, p.typed?.prompt ?? '', p.pairFront ?? '', ...p.wrong.map((w) => w.text)];
            for (const text of everything) {
              for (const word of forbidden) if (text.includes(word)) failures.push(`${label}: contains ${word}: ${text}`);
              if (match('\\b(nan|inf)\\b', text)) failures.push(`${label}: not a number in ${text}`);
              // A minus zero ("−0") is a slip; a negative decimal like −0,5 is fine.
              if (match('−0(?![,.\\d])', text)) failures.push(`${label}: minus zero in ${text}`);
              if (match('\\d\\s*-\\s*\\d', text) || text.includes('*') || text.includes('×')) failures.push(`${label}: ASCII operator in ${text}`);
              if ([...text].length > 260) failures.push(`${label}: text too long`);
            }
            if ((p.typed !== undefined) !== template.forms.has('typed')) failures.push(`${label}: typed form`);
            if ((p.pairFront !== undefined) !== template.forms.has('pairs')) failures.push(`${label}: pairs form`);
            // The wrong options: no two alike for the exercise factory, none equal to the right one.
            const options = problemOptions(p);
            const foldedAll = [p.correct, ...options].map(folded);
            if (new Set(foldedAll).size !== foldedAll.length) failures.push(`${label}: options alike`);
            // Whatever the student sees as a wrong option is not worth the same as the right one.
            const right = number(p.correct);
            if (right !== null && p.correctValue !== null && !p.allowsEquivalentWrong) {
              for (const option of options) {
                const value = number(option);
                if (value !== null && close(value, right)) failures.push(`${label}: the wrong option ${option} is worth the same as ${p.correct}`);
              }
            }
            if (options.length >= 2) choiceReady += 1;
            if (p.typed) {
              typedDraws += 1;
              if (!Number.isFinite(p.typed.answer.value)) failures.push(`${label}: typed answer not finite`);
              if (Math.abs(p.typed.answer.value) < 1000) typedSmall += 1;
              if (!NumberCheck.matches(p.typed.answer.fractionText, p.typed.answer.fractionText)) failures.push(`${label}: typed answer not accepted`);
            }
          }
        }
        const total = draws(template.id).length;
        if (template.forms.has('choice') && choiceReady / total < 0.9) failures.push(`${template.id} rarely has enough wrong options`);
        if (template.forms.has('typed') && typedSmall / typedDraws < 0.95) failures.push(`${template.id} asks for big typed numbers`);
      }
    }
    expect(failures.slice(0, 12).join('\n')).toBe('');
  }, 120_000);
});
