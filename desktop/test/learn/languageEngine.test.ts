// Port of LernwerkTests/LanguageCourseTests.swift (the provider assertions on the sample sources), the provider parts of
// LanguageDSLTests.swift, the language parts of SkillCoursesTests.swift, SkillFeedbackTests.swift, SkillStoreTests.swift
// and SkillAdvisorTests.swift.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/lib/answerCheck';
import { CourseAudit } from '../../src/lib/learn/audit';
import { type CourseNode, courseNode } from '../../src/lib/learn/course';
import { CoursePath } from '../../src/lib/learn/coursePath';
import { type LearnExercise, LearnAnswer, learnExercise, missedKeys, folded } from '../../src/lib/learn/exercise';
import { Exercises } from '../../src/lib/learn/exercises';
import { coverageGaps, coverageTokens } from '../../src/lib/learn/languages/coverage';
import { germanForeignProvider, germanSchoolProvider, frenchProvider, languageProviders, latinProvider, spanishProvider } from '../../src/lib/learn/languages/courses';
import { parseLanguageCourse } from '../../src/lib/learn/languages/dsl';
import { LanguageAnswerAdvice, LanguageCourseProvider } from '../../src/lib/learn/languages/provider';
import { SkillAdvisor, SkillPractice } from '../../src/lib/learn/skills/advisor';
import { type ExerciseOutcome, SkillAssessor, SkillRecord, Tally, skillStatusIsReached } from '../../src/lib/learn/skills/assessor';
import { CompetenceLevels, lessonExercises, skillMap } from '../../src/lib/learn/skills/skill';
import { SkillMaps } from '../../src/lib/learn/store';
import { range } from './languageKit';
import { latinSource, sampleSource, schoolSource } from './languageSample';
import { at, calendar } from './kit';

const sample = LanguageCourseProvider.make(sampleSource).provider;
const ex = (node: CourseNode, seed = 1) => sample.exercises(node, BigInt(seed));
const nodeOf = (id: string) => courseNode(sample.course, id)!;
const missed = (e: LearnExercise, text: string) => missedKeys(e, LearnAnswer.typed(text));

describe('LanguageDSL with the provider', () => {
  it('builds the course sections of the sample', () => {
    expect(LanguageCourseProvider.make(sampleSource).errors).toEqual([]);
    expect(sample.course.sections.length).toBe(1);
    expect(sample.course.units.length).toBe(2);
  });

  it('groups units in sections in order', () => {
    const school = new LanguageCourseProvider(parseLanguageCourse([
      'course: de', 'title: Deutsch', 'subtitle: Schulfach', 'kind: school', 'color: C46A55', 'symbol: book.fill',
      'section: Rechtschreibung', 'unit: Das oder dass | s', 'tip: Tipp', 'fact: A? = a | b',
      'section: Grammatik', 'unit: Fälle | s', 'tip: Tipp', 'fact: B? = a | b', 'unit: Zeiten | s', 'tip: Tipp', 'fact: C? = a | b',
    ].join('\n')).data);
    expect(school.course.sections.map((s) => s.title)).toEqual(['Rechtschreibung', 'Grammatik']);
    expect(school.course.sections.map((s) => s.units.length)).toEqual([1, 2]);
    expect(school.course.units.map((u) => u.number)).toEqual([1, 2, 3]);
  });

  it('reports the content problems through make()', () => {
    const source = [
      'course: x', 'title: X', 'subtitle: s', 'color: 336699', 'symbol: globe', 'unit: Eins | s', 'tip: Tipp',
      'word: el coche = das Auto', 'word: el auto = das Auto', 'word: el coche = der Wagen', 'word: a = b', 'word: c = d',
      'word: e = f', 'word: g = h', 'sentence: Hola. = Hallo.', 'sentence: Hola. = Hallo!',
    ].join('\n');
    const problems = LanguageCourseProvider.make(source).errors;
    expect(problems.some((p) => p.includes('"das Auto" means both el coche and el auto'))).toBe(true);
    expect(problems.some((p) => p.includes('el coche twice'))).toBe(true);
    expect(problems.some((p) => p.includes('sentence twice: Hola.'))).toBe(true);
  });
});

describe('LanguageCourseProvider on the sample', () => {
  it('passes the audit', () => {
    expect(CourseAudit.problems(sample, range(1, 12).map(BigInt))).toEqual([]);
  });

  it('gives the same lesson for the same seed and another for another seed', () => {
    const node = nodeOf('sample.u01.l1');
    expect(ex(node)).toEqual(ex(node));
    const variants = new Set(range(1, 10).map((s) => ex(node, s).map((e) => e.id).join(',')));
    expect(variants.size).toBeGreaterThan(3);
  });

  it('mixes kinds in every lesson and goes from easy to hard', () => {
    for (const node of sample.course.nodes) {
      if (node.kind === 'chest') continue;
      for (const seed of range(1, 5)) {
        const list = ex(node, seed);
        expect(new Set(list.map((e) => e.kind)).size, `${node.id} seed ${seed}: ${list.map((e) => e.kind)}`).toBeGreaterThanOrEqual(3);
        expect(list[0]?.kind).toBe('multipleChoice');
      }
    }
  });

  it('teaches a lesson its share and the checkpoint the whole unit', () => {
    const unit = sample.data.units[0];
    expect(sample.course.units[0].nodes.filter((n) => n.kind === 'lesson').length, '29 items, six per lesson').toBe(5);
    const wordsOf = (id: string): Set<string> => {
      const seen = new Set<string>();
      const node = nodeOf(id);
      for (const seed of range(1, 6)) {
        for (const exercise of ex(node, seed)) {
          unit.words.forEach((word, index) => { if (exercise.id.includes(`#w0-${index}`)) seen.add(word.target); });
        }
      }
      return seen;
    };
    const first = wordsOf('sample.u01.l1');
    const last = wordsOf('sample.u01.l5');
    expect(first.has('hola')).toBe(true);
    expect(first.has('tú'), 'the last words are for the last lessons').toBe(false);
    expect(last.has('tú') || last.has('el nombre')).toBe(true);
    expect(last.has('hola')).toBe(false);
    expect(wordsOf('sample.u01.t').size, 'the checkpoint covers most of the unit').toBeGreaterThan(8);
  });

  it('meets every word in several forms across the unit', () => {
    const unit = sample.data.units[0];
    unit.words.forEach((word, index) => {
      const forms = new Set<string>();
      for (const node of sample.course.units[0].nodes) {
        if (node.kind === 'chest') continue;
        for (const seed of range(1, 3)) for (const e of ex(node, seed)) if (e.id.includes(`#w0-${index}`)) forms.add(e.id[e.id.length - 1]);
      }
      expect(forms.size, `${word.target}: ${[...forms].sort()}`).toBeGreaterThanOrEqual(3);
    });
  });

  it('never makes a wrong answer of words and sentences also right', () => {
    const words = sample.data.units.flatMap((u) => u.words);
    for (const node of sample.course.nodes) {
      if (node.kind === 'chest') continue;
      for (const seed of range(1, 6)) {
        for (const exercise of ex(node, seed)) {
          if (exercise.kind !== 'multipleChoice') continue;
          if (!(exercise.id.includes('#w') || exercise.id.includes('#s'))) continue;
          const wrong = exercise.options.filter((o) => !exercise.correctAnswers.includes(o));
          for (const option of wrong) expect(evaluate(option, exercise.correctAnswers[0]), `${exercise.id}: ${option} vs ${exercise.correctAnswers[0]}`).not.toBe('correct');
          if (exercise.id.endsWith('a') && exercise.prompt.startsWith('Was bedeutet')) {
            for (const word of words) {
              if (!exercise.prompt.includes(`„${word.target}“`)) continue;
              const mine = new Set(word.meanings.map(folded));
              expect(wrong.map(folded).some((w) => mine.has(w))).toBe(false);
            }
          }
        }
      }
    }
  });

  it('is strict about typed answers in the language being learned', () => {
    const node = nodeOf('sample.u02.t');
    const all: LearnExercise[] = [];
    for (let seed = 1; seed <= 40; seed++) all.push(...ex(node, seed));
    const exact = all.filter((e) => e.kind === 'typeAnswer' && e.mode === 'exact');
    const word = exact.find((e) => e.correctAnswers.length === 1 && e.correctAnswers[0] === 'el hermano')!;
    expect(missed(word, 'El Hermano')).toEqual(new Set());
    expect(missed(word, 'el hermana'), 'one letter is another word in Spanish').toEqual(new Set([word.cardKeys[0]]));
    const sentence = exact.find((e) => e.correctAnswers.length === 1 && ['Me llamo Ana.', 'Tengo un hermano.'].includes(e.correctAnswers[0]))!;
    expect(sentence).toBeDefined();
    const right = sentence.correctAnswers[0];
    expect(missed(sentence, right.toLowerCase())).toEqual(new Set());
    const reversed = right.split(' ').reverse().join(' ');
    expect(missed(sentence, reversed), 'word order matters').toEqual(new Set([sentence.cardKeys[0]]));
  });

  it('offers listening and speech only with a voice', () => {
    const node = nodeOf('sample.u01.p');
    const list = range(1, 6).flatMap((s) => ex(node, s));
    expect(list.some((e) => e.prompt.startsWith('Tippe auf den Lautsprecher') && e.media?.type === 'speech' && e.media.text === e.correctAnswers[0] && e.media.language === 'es-ES')).toBe(true);
    expect(list.some((e) => e.media?.type === 'speech')).toBe(true);
    const silent = LanguageCourseProvider.make(sampleSource.split('speech: es-ES\n').join('')).provider;
    expect(silent.data.speech).toBeNull();
    for (const n of silent.course.nodes) {
      if (n.kind === 'chest') continue;
      for (const e of silent.exercises(n, 2n)) {
        expect(e.media).toBeNull();
        expect(e.prompt.startsWith('Tippe auf den Lautsprecher')).toBe(false);
      }
    }
    expect(CourseAudit.problems(silent, [1n, 2n, 3n])).toEqual([]);
  });

  it('accepts alternatives and forgives accents and typos when typed in the known language', () => {
    const node = nodeOf('sample.u01.t');
    let checked = 0;
    for (const seed of range(1, 30)) {
      for (const e of ex(node, seed)) {
        if (e.kind === 'typeAnswer' && e.id.endsWith('e') && e.correctAnswers.length > 1) {
          expect(missed(e, e.correctAnswers[1])).toEqual(new Set());
          checked++;
        }
      }
    }
    expect(checked, 'adiós has two meanings and appears typed in some checkpoint').toBeGreaterThan(0);
    const pool: LearnExercise[] = [];
    for (let seed = 1; seed <= 60; seed++) pool.push(...ex(node, seed));
    const typed = pool.find((e) => e.kind === 'typeAnswer' && e.correctAnswers[0] === 'buenos días')!;
    expect(typed).toBeDefined();
    expect(missed(typed, 'buenos dias'), 'accents are forgiven').toEqual(new Set());
    expect(missed(typed, 'buenas noches')).toEqual(new Set([typed.cardKeys[0]]));
  });

  it('chooses forms from their own verb and keeps the choices of fills', () => {
    const lessons = sample.course.units[0].nodes.filter((n) => n.kind === 'lesson');
    const list = range(1, 8).flatMap((seed) => lessons.flatMap((l) => ex(l, seed)));
    const form = list.find((e) => e.prompt.startsWith('Bilde die Form') && e.kind === 'multipleChoice');
    expect(form).toBeDefined();
    expect(form!.options.every((o) => ['soy', 'eres', 'es', 'somos'].includes(o)), form!.options.join()).toBe(true);
    const fill = list.find((e) => e.prompt.startsWith('Welches Wort fehlt') && e.kind === 'multipleChoice');
    expect(fill).toBeDefined();
    expect(fill!.solution.includes(fill!.correctAnswers[0]) && !fill!.solution.includes('___')).toBe(true);
  });

  it('gives word bank tiles without punctuation that accept the right order', () => {
    const node = nodeOf('sample.u01.p');
    const banks = range(1, 20).flatMap((s) => ex(node, s)).filter((e) => e.kind === 'wordBank');
    expect(banks.length).toBeGreaterThan(0);
    for (const bank of banks) {
      expect(bank.options.every((o) => !o.includes('.') && !o.includes('¿') && !o.includes('?') && !o.includes(',')), bank.options.join()).toBe(true);
      expect(missedKeys(bank, LearnAnswer.words(bank.correctAnswers)).size).toBe(0);
      expect(bank.solution).not.toBe('');
    }
  });

  it('matches words to meanings in pairs', () => {
    const node = nodeOf('sample.u02.t');
    const pairs = range(1, 10).flatMap((s) => ex(node, s)).filter((e) => e.kind === 'matchPairs');
    expect(pairs.length).toBeGreaterThan(0);
    const words = new Map(sample.data.units.flatMap((u) => u.words).map((w) => [w.target, w.meanings[0]]));
    for (const e of pairs) {
      expect(e.pairs.length).toBe(4);
      for (const pair of e.pairs) expect(words.get(pair.front)).toBe(pair.back);
    }
  });

  it('brings earlier units back in practice', () => {
    const ids = range(1, 10).flatMap((s) => ex(nodeOf('sample.u02.p'), s)).map((e) => e.id);
    expect(ids.some((id) => id.includes('#w0-') || id.includes('#s0-')), 'words of the first unit return in the second unit\'s practice').toBe(true);
    expect(ids.some((id) => id.includes('#w1-') || id.includes('#s1-'))).toBe(true);
  });

  it('has no exercises for chests and unknown nodes', () => {
    expect(ex(nodeOf('sample.u01.k'))).toEqual([]);
    const stranger: CourseNode = { id: 'sample.u09.l1', courseID: 'sample', unitID: 'sample.u09', unitNumber: 9, kind: 'lesson', index: 1, title: 'x' };
    expect(ex(stranger)).toEqual([]);
  });
});

describe('Language course variants', () => {
  it('asks a reading course for no free production', () => {
    const made = LanguageCourseProvider.make(latinSource);
    expect(made.errors).toEqual([]);
    expect(made.provider.data.produces).toBe(false);
    expect(CourseAudit.problems(made.provider, range(1, 6).map(BigInt))).toEqual([]);
    let forms = 0;
    let translations = 0;
    for (const node of made.provider.course.nodes) {
      if (node.kind === 'chest') continue;
      for (const seed of range(1, 6)) {
        for (const e of made.provider.exercises(node, BigInt(seed))) {
          expect(e.prompt.startsWith('Wie sagt man'), e.prompt).toBe(false);
          expect(e.prompt.startsWith('Übersetze ins Lateinische'), e.prompt).toBe(false);
          if (e.prompt.startsWith('Bilde die Form')) forms++;
          if (e.id.endsWith('f')) { translations++; expect(e.mode).toBe('text'); }
          expect(e.media, 'no voice for Latin').toBeNull();
        }
      }
    }
    expect(forms).toBeGreaterThan(0);
    expect(translations).toBeGreaterThan(0);
  });

  it('uses the words grammar note as the explanation', () => {
    const provider = LanguageCourseProvider.make(latinSource).provider;
    const lesson = courseNode(provider.course, 'la.u01.l1')!;
    const list = range(1, 10).flatMap((s) => provider.exercises(lesson, BigInt(s)));
    const word = list.find((e) => e.id.includes('#w0-0a'))!;
    expect(word.explanation).toBe('puella · -ae f.');
  });

  it('asks a school subject for terms, not translations', () => {
    const made = LanguageCourseProvider.make(schoolSource);
    expect(made.errors).toEqual([]);
    expect(made.provider.course.kind).toBe('school');
    expect(CourseAudit.problems(made.provider, range(1, 6).map(BigInt))).toEqual([]);
    for (const node of made.provider.course.nodes) {
      if (node.kind === 'chest') continue;
      for (const seed of range(1, 4)) {
        for (const e of made.provider.exercises(node, BigInt(seed))) {
          expect(e.id.endsWith('e') && e.kind === 'typeAnswer' && e.id.includes('#w'), 'no typed definitions').toBe(false);
          expect(e.prompt.includes('auf Deutsch')).toBe(false);
        }
      }
    }
  });

  it('finds sentences with words not taught yet (coverage)', () => {
    const latin = LanguageCourseProvider.make(latinSource).provider.data;
    expect(coverageGaps(latin), 'known: and the words cover every sentence').toEqual([]);
    const gaps = coverageGaps(sample.data);
    expect(gaps.length, 'the sample uses words it never lists').toBeGreaterThan(0);
    expect(gaps.some((g) => g.sentence === 'Me llamo Ana.' && g.words.includes('llamo'))).toBe(true);
    expect(gaps.some((g) => g.sentence === 'No, gracias.'), 'no and gracias are words of the unit').toBe(false);
    expect(coverageTokens('¿Cómo te llamas? 12')).toEqual(['como', 'te', 'llamas']);
  });
});

// SkillFeedbackTests, language part

describe('LanguageAnswerAdvice', () => {
  it('names the kind of slip', () => {
    const advice = LanguageAnswerAdvice.advice;
    expect(advice('el hermano', ['el hermano'])).toBeNull();
    expect(advice('El Hermano', ['el hermano'])).toBeNull();
    expect(advice('el hermana', ['el hermano'])?.includes('Endung')).toBe(true);
    expect(advice('hermano el', ['el hermano'])).toBe('Die Wörter stimmen, aber die Reihenfolge nicht.');
    expect(advice('el', ['el hermano'])).toBe('Es fehlt mindestens ein Wort.');
    expect(advice('el hermano grande', ['el hermano'])).toBe('Es sind zu viele Wörter.');
    expect(advice('el libro', ['el hermano'])?.includes('Ein Wort stimmt nicht')).toBe(true);
    expect(advice('la casa', ['el hermano']), 'two words wrong: no sure advice').toBeNull();
    expect(advice('  ', ['el hermano'])).toBeNull();
  });

  it('gives advice only for strict typed answers', () => {
    const strict = Exercises.typed({ id: 'x', prompt: '?', answer: 'el hermano', mode: 'exact' })!;
    expect(sample.feedback(strict, LearnAnswer.typed('el hermana'))).not.toBeNull();
    const loose = Exercises.typed({ id: 'y', prompt: '?', answer: 'Haus', mode: 'text' })!;
    expect(sample.feedback(loose, LearnAnswer.typed('Haus2'))).toBeNull();
    expect(sample.feedback(strict, LearnAnswer.option('el hermana'))).toBeNull();
  });

  it('tags exercises so that recognising and producing are separate', () => {
    const tag = (id: string) => sample.skillTag(learnExercise({ id, kind: 'multipleChoice', prompt: '?', correctAnswers: ['a'], options: ['a', 'b'], solution: 'a' }), sample.course.nodes[0]);
    expect(tag('n#w1-0a')).toEqual({ facet: 'vocab', level: 'recognise' });
    expect(tag('n#w1-0c')).toEqual({ facet: 'listening', level: 'recognise' });
    expect(tag('n#w1-0d')).toEqual({ facet: 'vocab', level: 'recall' });
    expect(tag('n#s1-2b')).toEqual({ facet: 'sentences', level: 'apply' });
    expect(tag('n#s1-2e')).toEqual({ facet: 'listening', level: 'apply' });
    expect(tag('n#f1-0d')).toEqual({ facet: 'grammar', level: 'apply' });
    expect(tag('n#g1-0a')).toEqual({ facet: 'grammar', level: 'recognise' });
    expect(tag('n#p1')).toEqual({ facet: 'vocab', level: 'recognise' });
    expect(tag('n#s1-2a')).toEqual({ facet: 'sentences', level: 'recognise' });
    expect(tag('n#s1-2f')).toEqual({ facet: 'sentences', level: 'recall' });
    expect(tag('n#q1-0a')).toEqual({ facet: 'grammar', level: 'recognise' });
  });
});

// SkillCoursesTests, language part

const utc = calendar('UTC');
const date = (day: number) => at(utc, 2026, 5, day, 10);
const steps = (p: { course: { nodes: CourseNode[] } }) => p.course.nodes.filter((n) => n.kind !== 'chest');

const outcomeOf = (e: LearnExercise, right = true): ExerciseOutcome | null =>
  e.level === null ? null : { exerciseID: e.id, skill: e.skill, level: e.level, right, helped: false };
const outcomesOf = (list: LearnExercise[], right: (e: LearnExercise) => boolean = () => true): ExerciseOutcome[] =>
  list.map((e) => outcomeOf(e, right(e))).filter((o): o is ExerciseOutcome => o !== null);

function perfectDay(provider: (typeof languageProviders)[number], day: number, seed: number, records: Record<string, SkillRecord>): void {
  const map = skillMap(provider);
  for (const node of steps(provider)) {
    SkillAssessor.record(outcomesOf(lessonExercises(provider, node, BigInt(seed))), node, map, records, date(day), utc);
  }
}

describe('skills of the language courses', () => {
  it('gives every course a sound skill map with a skill in every unit', () => {
    for (const provider of languageProviders) {
      const map = skillMap(provider);
      expect(map.problems(), provider.course.id).toEqual([]);
      for (const unit of provider.course.units) expect(map.skillsInUnit(unit.id).length, `${provider.course.id} ${unit.id} has no skill`).toBeGreaterThan(0);
    }
  });

  it('gives language units their own goals with prerequisites', () => {
    const map = skillMap(spanishProvider);
    const first = map.skillsInUnit('es.u01');
    expect(first.some((s) => s.facet === 'vocab')).toBe(true);
    expect(first.find((s) => s.facet === 'sentences')?.prerequisites).toEqual(['es.u01.vocab']);
    expect(map.skills.find((s) => s.id === 'es.u02.vocab')?.prerequisites, 'words of the next unit build on the words before').toEqual(['es.u01.vocab']);
  });

  it('tags every exercise of a language step with a declared goal', () => {
    for (const provider of languageProviders) {
      const map = skillMap(provider);
      for (const node of steps(provider)) {
        for (const seed of [1n, 2n]) {
          for (const e of lessonExercises(provider, node, seed)) {
            expect(e.skill, `${e.id} has no skill`).not.toBe('');
            expect(e.level, e.id).not.toBeNull();
            expect(map.skill(e.skill), `${e.id} -> ${e.skill}`).toBeDefined();
          }
        }
      }
    }
  });

  it('shows every level a goal asks for in its steps', () => {
    for (const provider of languageProviders) {
      const map = skillMap(provider);
      const seen = new Map<string, Set<string>>();
      for (const node of steps(provider)) {
        for (const seed of range(1, 2)) {
          for (const e of lessonExercises(provider, node, BigInt(seed))) {
            if (e.level) {
              if (!seen.has(e.skill)) seen.set(e.skill, new Set());
              seen.get(e.skill)!.add(e.level);
            }
          }
        }
      }
      for (const skill of map.skills) for (const level of skill.levels) expect(seen.get(skill.id)?.has(level) ?? false, `${skill.id} never asks at level ${level}`).toBe(true);
    }
  });

  it('masters every goal of every language for a student who answers everything right within a few days', () => {
    for (const provider of languageProviders) {
      const map = skillMap(provider);
      const records: Record<string, SkillRecord> = {};
      perfectDay(provider, 1, 1, records);
      perfectDay(provider, 2, 2, records);
      // Goals the path alone gives too few answers for get the rounds the advice would suggest.
      for (let day = 2; day <= 5; day++) {
        for (const skill of map.skills) {
          const status = SkillAssessor.status(records[skill.id], skill, new Set(), date(day), utc);
          if (status === 'mastered') continue;
          const round = SkillPractice.exercises(provider, map, [skill.id], records, BigInt(day * 100));
          SkillAssessor.record(outcomesOf(round), null, map, records, date(day), utc);
        }
      }
      for (const skill of map.skills) {
        const status = SkillAssessor.status(records[skill.id], skill, new Set(), date(5), utc);
        expect(status === 'mastered', `${provider.course.id} ${skill.id} is ${status}: ${SkillAssessor.missing(records[skill.id] ?? new SkillRecord(), skill)}`).toBe(true);
      }
    }
  }, 120_000);

  it('never masters anything in one day alone', () => {
    const map = skillMap(spanishProvider);
    const records: Record<string, SkillRecord> = {};
    perfectDay(spanishProvider, 1, 1, records);
    perfectDay(spanishProvider, 1, 2, records);
    for (const skill of map.skills) expect(SkillAssessor.status(records[skill.id], skill, new Set(), date(1), utc), skill.id).not.toBe('mastered');
  });

  it('never reaches typed goals for a student who only chooses', () => {
    const provider = spanishProvider;
    const map = skillMap(provider);
    const records: Record<string, SkillRecord> = {};
    [1, 2, 3].forEach((seed, index) => {
      for (const node of steps(provider)) {
        // Right where there is something to pick, wrong where something must be produced.
        const list = outcomesOf(lessonExercises(provider, node, BigInt(seed)), (e) => e.level === 'recognise');
        SkillAssessor.record(list, node, map, records, date(1 + index), utc);
      }
    });
    for (const skill of map.skills) {
      if (!skill.levels.some((l) => CompetenceLevels.isHigher(l, 'recognise'))) continue;
      const status = SkillAssessor.status(records[skill.id], skill, new Set(), date(4), utc);
      expect(skillStatusIsReached(status), `${skill.id} is ${status}`).toBe(false);
    }
  });

  it('recommends practising unit 1 before unit 2 for a student who did it badly', () => {
    const provider = spanishProvider;
    const map = skillMap(provider);
    const records: Record<string, SkillRecord> = {};
    const unit = provider.course.units[0];
    const completed = new Set<string>();
    for (const node of unit.nodes) {
      if (node.kind === 'chest') continue;
      SkillAssessor.record(outcomesOf(lessonExercises(provider, node, 1n), () => false), node, map, records, date(1), utc);
      completed.add(node.id);
    }
    const units = CoursePath.units(provider.course, completed);
    const advice = SkillAdvisor.recommend(map, records, units, completed, date(1), utc);
    expect(advice.kind).toBe('practice');
    expect(advice.skillIDs.every((id) => id.startsWith('es.u01.'))).toBe(true);
  });
});

// SkillStoreTests / SkillAdvisorTests, Spanish parts

describe('skills with the Spanish course', () => {
  it('builds the map of a course once', () => {
    SkillMaps.clear();
    const first = SkillMaps.map(spanishProvider);
    const second = SkillMaps.map(spanishProvider);
    expect(second).toBe(first);
    expect(first.courseID).toBe('es');
  });

  it('makes a practice round of only the targets\' exercises, repeatable', () => {
    const map = skillMap(spanishProvider);
    const target = 'es.u01.vocab';
    const first = SkillPractice.exercises(spanishProvider, map, [target], {}, 5n);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(SkillPractice.size);
    expect(first.some((e) => e.skill === target)).toBe(true);
    expect(new Set(first.map((e) => e.id)).size, 'no exercise twice').toBe(first.length);
    expect(first).toEqual(SkillPractice.exercises(spanishProvider, map, [target], {}, 5n));
    expect(first.map((e) => e.id)).not.toEqual(SkillPractice.exercises(spanishProvider, map, [target], {}, 6n).map((e) => e.id));
  });

  it('asks a weak level more often than a strong one', () => {
    const map = skillMap(spanishProvider);
    const target = map.skill('es.u01.vocab')!;
    const weakRecall = new SkillRecord();
    weakRecall.tallies['recall'] = new Tally({ attempts: 8, right: 1, helped: 0, points: 2, recent: [false, false, false, true, false, false, false, false] });
    weakRecall.tallies['recognise'] = new Tally({ attempts: 8, right: 8, helped: 0, points: 8, recent: Array(8).fill(true) });
    let recall = 0;
    let recognise = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (const e of SkillPractice.exercises(spanishProvider, map, [target.id], { [target.id]: weakRecall }, BigInt(seed))) {
        if (e.skill !== target.id) continue;
        if (e.level === 'recall') recall++;
        if (e.level === 'recognise') recognise++;
      }
    }
    const evenRecall = SkillPractice.weight(learnExercise({ id: 'x', kind: 'typeAnswer', prompt: '', correctAnswers: ['a'], solution: 'a', skill: target.id, level: 'recall' }), { [target.id]: weakRecall }, map);
    const evenRecognise = SkillPractice.weight(learnExercise({ id: 'y', kind: 'multipleChoice', prompt: '', correctAnswers: ['a'], options: ['a', 'b'], solution: 'a', skill: target.id, level: 'recognise' }), { [target.id]: weakRecall }, map);
    expect(evenRecall).toBeGreaterThan(evenRecognise);
    expect(recall + recognise).toBeGreaterThan(0);
  });

  it('makes no round for an unknown target', () => {
    expect(SkillPractice.exercises(spanishProvider, skillMap(spanishProvider), ['nope'], {}, 1n)).toEqual([]);
  });
});

describe('the shipped providers', () => {
  it('are registered in course order with the ids of their texts', () => {
    expect(languageProviders.map((p) => p.course.id)).toEqual(['es', 'fr', 'la', 'daf', 'de']);
    expect([spanishProvider, frenchProvider, latinProvider, germanForeignProvider, germanSchoolProvider].map((p) => p.course.kind)).toEqual(['language', 'language', 'language', 'language', 'school']);
    for (const p of languageProviders) expect(p.skillFacets !== undefined && p.skillTag !== undefined && p.feedback !== undefined).toBe(true);
  });
});
