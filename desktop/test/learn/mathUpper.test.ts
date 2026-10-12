// Ports of LernwerkTests/MathCourseUpperTests.swift and MathCourseUpperBasicsTests.swift. The exact parity with the
// Swift output is in mathUpperFixture.test.ts.
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import type { ExerciseKind } from '../../src/lib/learn/exercise';
import { NumberCheck } from '../../src/lib/learn/numberCheck';
import { MathUpperCatalog, MathUpperUnit05, MathUpperUnit07, mathUpperProvider, q, UPoly, UQ } from '../../src/lib/learn/math/upper';
import * as Kit from './mathUpperKit';

const provider = mathUpperProvider;
// Same draws as the Swift kit: 300 seeds per level.
const KIT_SEEDS = 300;

describe('upper maths basics', () => {
  it('fractions', () => {
    expect(new UQ(2, 4).equals(new UQ(1, 2))).toBe(true);
    expect(new UQ(1, -2).equals(new UQ(-1, 2))).toBe(true);
    expect(new UQ(1, 2).plus(new UQ(1, 3)).equals(new UQ(5, 6))).toBe(true);
    expect(new UQ(3, 4).times(new UQ(2, 3)).equals(new UQ(1, 2))).toBe(true);
    expect(new UQ(1, 2).div(new UQ(1, 4)).equals(new UQ(2))).toBe(true);
    expect(new UQ(3, 8).text).toBe('0,375');
    expect(new UQ(1, 3).text).toBe('1/3');
    expect(new UQ(-1, 2).typed).toBe('-0,5');
    expect(new UQ(-1, 2).text).toBe('−0,5');
    expect(new UQ(1, 36).isNice).toBe(true);
    expect(new UQ(1, 37).isNice).toBe(false);
  });

  it('polynomial printing', () => {
    expect(UPoly.ints([1, -4, 3]).text).toBe('3x² − 4x + 1');
    expect(UPoly.ints([0, 0, 0, 1]).text).toBe('x³');
    expect(UPoly.ints([2, 0, -1]).text).toBe('−x² + 2');
    expect(UPoly.ints([-5]).text).toBe('−5');
    expect(UPoly.ints([0, -1]).text).toBe('−x');
    expect(UPoly.ints([0, 1, 0, 0, 0, 0, 3]).text).toBe('3x⁶ + x');
    expect(UPoly.ints([]).text).toBe('0');
    expect(UPoly.ints([0, 0, 0, 1]).integral.text).toBe('x⁴/4');
    expect(UPoly.ints([0, 0, 2]).integral.text).toBe('2x³/3');
    expect(UPoly.ints([3, 1]).integral.text).toBe('x²/2 + 3x');
  });

  it('polynomial algebra', () => {
    const f = UPoly.fromRoots(new UQ(2), [new UQ(1), new UQ(-3)]);
    expect(f.equals(UPoly.ints([-6, 4, 2]))).toBe(true);
    expect(f.eval(new UQ(1)).isZero).toBe(true);
    expect(f.eval(new UQ(-3)).isZero).toBe(true);
    expect(f.derivative.equals(UPoly.ints([4, 4]))).toBe(true);
    expect(f.integral.derivative.equals(f)).toBe(true);
    expect(UPoly.ints([1, 1]).times(UPoly.ints([-1, 1])).equals(UPoly.ints([-1, 0, 1]))).toBe(true);
    expect(UPoly.ints([1, 2, 3]).eval(new UQ(2)).equals(new UQ(17))).toBe(true);
  });

  it('binomial coefficients against Pascal', () => {
    for (let n = 0; n <= 12; n++) {
      const row = Kit.binomialDoubles(n);
      for (let k = 0; k <= n; k++) expect(MathUpperUnit07.binomial(n, k), `${n} over ${k}`).toBe(row[k]);
    }
    expect(MathUpperUnit07.binomial(5, 2)).toBe(10);
    expect(MathUpperUnit07.binomial(3, 4)).toBe(0);
  });

  it('exact binomial probabilities sum to one', () => {
    for (let n = 1; n <= 6; n++) {
      for (const p of [q(1, 2), q(1, 4), q(1, 5), q(3, 10), q(7, 10)]) {
        let total = UQ.zero;
        for (let k = 0; k <= n; k++) total = total.plus(MathUpperUnit07.pmf(n, p, k));
        expect(total.equals(UQ.one), `n=${n} p=${p.fraction}`).toBe(true);
      }
    }
  });

  it('exact trig table', () => {
    for (const fn of ['sin', 'cos', 'tan']) {
      for (let degrees = -360; degrees <= 720; degrees += 15) {
        const value = MathUpperUnit05.exact(fn, degrees);
        const radians = (degrees * Math.PI) / 180;
        if (!value) continue;
        const parsed = Kit.parseExact(value.text);
        expect(parsed, `unreadable exact text for ${fn} ${degrees}`).not.toBeNull();
        expect(Math.abs((parsed as number) - Kit.trig(fn, radians)), `${fn} ${degrees}`).toBeLessThan(1e-9);
      }
    }
    expect(MathUpperUnit05.exact('tan', 90)).toBeNull();
  });

  it('number check accepts fraction and decimal', () => {
    expect(NumberCheck.matches('0,375', '3/8')).toBe(true);
    expect(NumberCheck.matches('3/8', new UQ(3, 8).typed)).toBe(true);
    expect(NumberCheck.matches('−2', new UQ(-2).typed)).toBe(true);
    expect(NumberCheck.matches('38', '3/8')).toBe(false);
  });
});

describe('upper maths course', () => {
  it('passes the course audit for seeds 1...20', () => {
    const seeds: bigint[] = [];
    for (let s = 1n; s <= 20n; s++) seeds.push(s);
    expect(CourseAudit.problems(provider, seeds)).toEqual([]);
  }, 120_000);

  it('has the right shape', () => {
    const course = provider.course;
    expect(course.id).toBe('matho');
    expect(course.title).toBe('Mathe Oberstufe');
    expect(course.subtitle).toBe('Analysis, Vektoren, Stochastik');
    expect(course.kind).toBe('math');
    expect(course.color).toBe(0x5a5aa8);
    expect(course.symbol).toBe('function');
    expect(course.units.length).toBe(7);
    expect(course.units.map((u) => u.title)).toEqual([
      'Ableitung',
      'Kurvendiskussion',
      'Integralrechnung',
      'e-Funktion und Logarithmus',
      'Trigonometrie',
      'Vektoren',
      'Stochastik',
    ]);
    for (const unit of course.units) {
      expect(unit.nodes.map((n) => n.kind)).toEqual(['lesson', 'lesson', 'lesson', 'practice', 'checkpoint', 'chest']);
      const paragraphs = unit.tip.split('\n\n').filter((s) => s !== '').length;
      expect(paragraphs, unit.id).toBeGreaterThan(1);
      expect(paragraphs, unit.id).toBeLessThanOrEqual(5);
    }
  });

  it('catalog matches the lesson groups', () => {
    expect(MathUpperCatalog.units.length).toBe(7);
    expect(MathUpperCatalog.lessonGroups.length).toBe(7);
    expect(new Set(Kit.allIDs).size, 'template ids are unique').toBe(Kit.allIDs.length);
    MathUpperCatalog.lessonGroups.forEach((groups, index) => {
      expect(groups.length).toBe(3);
      const unitIDs = new Set(MathUpperCatalog.units[index].map((t) => t.id));
      expect(new Set(groups.flat()), `unit ${index + 1}: every template is taught in a lesson`).toEqual(unitIDs);
      for (const id of groups.flat()) expect(MathUpperCatalog.template(id), id).toBeDefined();
    });
  });

  it('is deterministic and varied', () => {
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') continue;
      expect(provider.exercises(node, 5n), node.id).toEqual(provider.exercises(node, 5n));
      expect(provider.exercises(node, 5n).map((e) => e.prompt), node.id).not.toEqual(provider.exercises(node, 6n).map((e) => e.prompt));
    }
  });

  it('nodes mix forms and stay honest', () => {
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') {
        expect(provider.exercises(node, 1n)).toEqual([]);
        continue;
      }
      for (let seed = 1n; seed <= 25n; seed++) {
        const exercises = provider.exercises(node, seed);
        const label = `${node.id} seed ${seed}`;
        expect(new Set(exercises.map((e) => e.kind)).size, label).toBeGreaterThanOrEqual(2);
        expect(CourseAudit.problemsInExercises(exercises, node), label).toEqual([]);
        for (const e of exercises) {
          if (e.kind === 'typeAnswer') {
            expect(e.mode, e.id).toBe('number');
            for (const answer of e.correctAnswers) {
              const parsed = NumberCheck.parse(answer);
              expect(parsed, `${e.id} ${answer}`).not.toBeNull();
              if (parsed) {
                expect(NumberCheck.matches(answer, e.correctAnswers[0]), e.id).toBe(true);
                expect(Math.abs(parsed.doubleValue), e.id).toBeLessThan(100_000);
              }
            }
          }
          if (e.kind === 'multipleChoice') {
            expect(e.options.filter((o) => e.correctAnswers.includes(o)).length, e.id).toBe(1);
            expect(e.explanation, e.id).not.toBe('');
          }
          expect(e.explanation === '' && e.kind !== 'matchPairs', e.id).toBe(false);
        }
      }
    }
  }, 120_000);

  it('every unit has three forms across its nodes', () => {
    for (const unit of provider.course.units) {
      const kinds = new Set<ExerciseKind>();
      for (const node of unit.nodes) {
        if (node.kind === 'chest') continue;
        for (let seed = 1n; seed <= 5n; seed++) provider.exercises(node, seed).forEach((e) => kinds.add(e.kind));
      }
      for (const kind of ['multipleChoice', 'typeAnswer', 'matchPairs'] as ExerciseKind[]) expect(kinds.has(kind), `${unit.id} ${kind}`).toBe(true);
    }
  });

  it('every template is reachable and sound', () => {
    for (const id of Kit.allIDs) {
      const list = Kit.draws(id, KIT_SEEDS);
      expect(list.length, `${id} produces too few problems`).toBeGreaterThan(Math.floor(KIT_SEEDS * 3 * (200 / 900)));
      for (let level = 1; level <= 3; level++) {
        expect(list.filter((d) => d.level === level).length, `${id} level ${level}`).toBeGreaterThan(Math.floor(KIT_SEEDS * (40 / 300)));
      }
      expect(new Set(list.map((d) => d.problem.key)).size, `${id} is not varied enough`).toBeGreaterThan(5);
    }
  }, 120_000);

  it('all problems are mathematically right', () => {
    for (const id of Kit.allIDs) {
      const found: string[] = [];
      for (const draw of Kit.draws(id, KIT_SEEDS)) found.push(...Kit.problems(draw));
      expect([...new Set(found)].sort().slice(0, 8), id).toEqual([]);
    }
  }, 300_000);

  it('units are represented in every node kind', () => {
    // Every template of a unit must show up in the unit's practice or checkpoint over many seeds.
    provider.course.units.forEach((unit, index) => {
      const seen = new Set<string>();
      for (let seed = 1n; seed <= 20n; seed++) {
        for (const node of unit.nodes) {
          if (node.kind !== 'practice' && node.kind !== 'checkpoint') continue;
          provider.exercises(node, seed).forEach((e) => seen.add(e.prompt));
        }
      }
      expect(seen.size, `unit ${index + 1}`).toBeGreaterThan(40);
    });
  }, 120_000);
});
