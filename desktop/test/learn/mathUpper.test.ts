import { describe, expect, it } from 'vitest';
import { courseNodes, courseUnits } from '../../src/lib/learn/course';
import { auditProblems, exerciseListProblems } from '../../src/lib/learn/courseAudit';
import { NumberCheck } from '../../src/lib/learn/rational';
import { UPoly, UQ, uq } from '../../src/lib/learn/math/upper/core';
import { exact } from '../../src/lib/learn/math/upper/unit05';
import { binomial, pmf } from '../../src/lib/learn/math/upper/unit07';
import { lessonGroups, mathUpper, upperTemplate, upperUnits } from '../../src/lib/learn/math/upper/course';
import { allIDs, binomialDoubles, close, draws, parseExact, problems, trig } from './mathUpperKit';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => BigInt(from + i));
const provider = mathUpper;

describe('math upper: basics', () => {
  it('fractions', () => {
    expect(uq(2, 4).equals(uq(1, 2))).toBe(true);
    expect(uq(1, -2).equals(uq(-1, 2))).toBe(true);
    expect(uq(1, 2).plus(uq(1, 3)).equals(uq(5, 6))).toBe(true);
    expect(uq(3, 4).times(uq(2, 3)).equals(uq(1, 2))).toBe(true);
    expect(uq(1, 2).div(uq(1, 4)).equals(uq(2))).toBe(true);
    expect(uq(3, 8).text).toBe('0,375');
    expect(uq(1, 3).text).toBe('1/3');
    expect(uq(-1, 2).typed).toBe('-0,5');
    expect(uq(-1, 2).text).toBe('−0,5');
    expect(uq(1, 36).isNice).toBe(true);
    expect(uq(1, 37).isNice).toBe(false);
  });

  it('polynomial printing', () => {
    expect(UPoly.ofInts([1, -4, 3]).text).toBe('3x² − 4x + 1');
    expect(UPoly.ofInts([0, 0, 0, 1]).text).toBe('x³');
    expect(UPoly.ofInts([2, 0, -1]).text).toBe('−x² + 2');
    expect(UPoly.ofInts([-5]).text).toBe('−5');
    expect(UPoly.ofInts([0, -1]).text).toBe('−x');
    expect(UPoly.ofInts([0, 1, 0, 0, 0, 0, 3]).text).toBe('3x⁶ + x');
    expect(UPoly.ofInts([]).text).toBe('0');
    expect(UPoly.ofInts([0, 0, 0, 1]).integral.text).toBe('x⁴/4');
    expect(UPoly.ofInts([0, 0, 2]).integral.text).toBe('2x³/3');
    expect(UPoly.ofInts([3, 1]).integral.text).toBe('x²/2 + 3x');
  });

  it('polynomial algebra', () => {
    const f = UPoly.fromRoots(uq(2), [uq(1), uq(-3)]);
    expect(f.equals(UPoly.ofInts([-6, 4, 2]))).toBe(true);
    expect(f.eval(uq(1)).isZero).toBe(true);
    expect(f.eval(uq(-3)).isZero).toBe(true);
    expect(f.derivative.equals(UPoly.ofInts([4, 4]))).toBe(true);
    expect(f.integral.derivative.equals(f)).toBe(true);
    expect(UPoly.ofInts([1, 1]).times(UPoly.ofInts([-1, 1])).equals(UPoly.ofInts([-1, 0, 1]))).toBe(true);
    expect(UPoly.ofInts([1, 2, 3]).eval(uq(2)).equals(uq(17))).toBe(true);
  });

  it('binomial coefficients agree with Pascal', () => {
    for (let n = 0; n <= 12; n++) {
      const row = binomialDoubles(n);
      for (let k = 0; k <= n; k++) expect(binomial(n, k), `${n} over ${k}`).toBe(row[k]);
    }
    expect(binomial(5, 2)).toBe(10);
    expect(binomial(3, 4)).toBe(0);
  });

  it('exact binomial probabilities sum to one', () => {
    for (let n = 1; n <= 6; n++) {
      for (const p of [uq(1, 2), uq(1, 4), uq(1, 5), uq(3, 10), uq(7, 10)]) {
        let total = UQ.zero;
        for (let k = 0; k <= n; k++) total = total.plus(pmf(n, p, k));
        expect(total.equals(UQ.one), `n=${n} p=${p.fraction}`).toBe(true);
      }
    }
  });

  it('the exact trig table', () => {
    for (const fn of ['sin', 'cos', 'tan']) {
      for (let degrees = -360; degrees <= 720; degrees += 15) {
        const value = exact(fn, degrees);
        if (!value) continue;
        const text = (value.negative && value.magnitude !== 'zero' ? '−' : '') + { zero: '0', half: '1/2', root2over2: '√2/2', root3over2: '√3/2', one: '1', root3: '√3', root3over3: '√3/3' }[value.magnitude];
        const parsed = parseExact(text);
        expect(parsed, `${fn} ${degrees}`).not.toBeNull();
        expect(Math.abs((parsed as number) - trig(fn, (degrees * Math.PI) / 180)), `${fn} ${degrees}`).toBeLessThan(1e-9);
      }
    }
    expect(exact('tan', 90)).toBeNull();
  });

  it('the answer check accepts fraction and decimal', () => {
    expect(NumberCheck.matches('0,375', '3/8')).toBe(true);
    expect(NumberCheck.matches('3/8', uq(3, 8).typed)).toBe(true);
    expect(NumberCheck.matches('−2', uq(-2).typed)).toBe(true);
    expect(NumberCheck.matches('38', '3/8')).toBe(false);
  });
});

describe('math upper: course', () => {
  it('the audit finds nothing', () => {
    expect(auditProblems(provider, range(1, 20))).toEqual([]);
  });

  it('has the right shape', () => {
    const course = provider.course;
    expect([course.id, course.title, course.subtitle, course.kind, course.color, course.symbol]).toEqual(['matho', 'Mathe Oberstufe', 'Analysis, Vektoren, Stochastik', 'math', 0x5a5aa8, 'function']);
    const units = courseUnits(course);
    expect(units.map((u) => u.title)).toEqual(['Ableitung', 'Kurvendiskussion', 'Integralrechnung', 'e-Funktion und Logarithmus', 'Trigonometrie', 'Vektoren', 'Stochastik']);
    for (const unit of units) {
      expect(unit.nodes.map((n) => n.kind)).toEqual(['lesson', 'lesson', 'lesson', 'practice', 'checkpoint', 'chest']);
      const paragraphs = unit.tip.split('\n\n').length;
      expect(paragraphs, unit.id).toBeGreaterThan(1);
      expect(paragraphs, unit.id).toBeLessThanOrEqual(5);
    }
  });

  it('the catalog matches the lesson groups', () => {
    expect(upperUnits).toHaveLength(7);
    expect(lessonGroups).toHaveLength(7);
    const ids = allIDs();
    expect(new Set(ids).size, 'template ids are unique').toBe(ids.length);
    lessonGroups.forEach((groups, index) => {
      expect(groups).toHaveLength(3);
      const unitIDs = new Set(upperUnits[index].map((t) => t.id));
      expect(new Set(groups.flat()), `unit ${index + 1}: every template is taught in a lesson`).toEqual(unitIDs);
      for (const id of groups.flat()) expect(upperTemplate(id), id).toBeDefined();
    });
  });

  it('is deterministic and varied', () => {
    for (const node of courseNodes(provider.course)) {
      if (node.kind === 'chest') continue;
      expect(provider.exercises(node, 5n), node.id).toEqual(provider.exercises(node, 5n));
      expect(provider.exercises(node, 5n).map((e) => e.prompt), node.id).not.toEqual(provider.exercises(node, 6n).map((e) => e.prompt));
    }
  });

  it('nodes mix forms and stay honest', () => {
    for (const node of courseNodes(provider.course)) {
      if (node.kind === 'chest') {
        expect(provider.exercises(node, 1n)).toEqual([]);
        continue;
      }
      for (const seed of range(1, 60)) {
        const exercises = provider.exercises(node, seed);
        expect(new Set(exercises.map((e) => e.kind)).size, `${node.id} seed ${seed}`).toBeGreaterThanOrEqual(2);
        expect(exerciseListProblems(exercises, node), `${node.id} seed ${seed}`).toEqual([]);
        for (const e of exercises) {
          if (e.kind === 'typeAnswer') {
            expect(e.mode, e.id).toBe('number');
            for (const answer of e.correctAnswers) {
              const parsed = NumberCheck.parse(answer);
              expect(parsed, `${e.id} ${answer}`).not.toBeNull();
              if (parsed) {
                expect(NumberCheck.matches(answer, e.correctAnswers[0]), e.id).toBe(true);
                expect(Math.abs(parsed.value), e.id).toBeLessThan(100000);
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
    for (const unit of courseUnits(provider.course)) {
      const kinds = new Set<string>();
      for (const node of unit.nodes) {
        if (node.kind === 'chest') continue;
        for (const seed of range(1, 5)) provider.exercises(node, seed).forEach((e) => kinds.add(e.kind));
      }
      for (const kind of ['multipleChoice', 'typeAnswer', 'matchPairs']) expect(kinds.has(kind), `${unit.id} ${kind}`).toBe(true);
    }
  });

  it('every template is reachable and sound', () => {
    for (const id of allIDs()) {
      const all = draws(id);
      expect(all.length, `${id} produces too few problems`).toBeGreaterThan(200);
      for (const level of [1, 2, 3]) expect(all.filter((d) => d.level === level).length, `${id} level ${level}`).toBeGreaterThan(40);
      expect(new Set(all.map((d) => d.problem.key)).size, `${id} is not varied enough`).toBeGreaterThan(5);
    }
  });

  it('all problems are mathematically right', () => {
    for (const id of allIDs()) {
      const found: string[] = [];
      for (const d of draws(id)) found.push(...problems(d));
      expect([...new Set(found)].sort().slice(0, 8), id).toEqual([]);
    }
  }, 120_000);

  it('units are represented in practice and checkpoint', () => {
    courseUnits(provider.course).forEach((unit, index) => {
      const seen = new Set<string>();
      for (const seed of range(1, 40)) {
        for (const node of unit.nodes) {
          if (node.kind === 'practice' || node.kind === 'checkpoint') provider.exercises(node, seed).forEach((e) => seen.add(e.prompt));
        }
      }
      expect(seen.size, `unit ${index + 1}`).toBeGreaterThan(40);
    });
  }, 120_000);
});

void close;
