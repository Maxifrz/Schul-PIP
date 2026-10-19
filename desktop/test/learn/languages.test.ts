import { describe, expect, it } from 'vitest';
import * as AnswerCheck from '../../src/lib/answerCheck';
import { gaps, gapText, tokensOf } from '../../src/lib/learn/languages/coverage';
import { formGroup, textsFor, fillText } from '../../src/lib/learn/languages/data';
import { parseCourse } from '../../src/lib/learn/languages/dsl';
import { LanguageCourseProvider, answerAdvice } from '../../src/lib/learn/languages/provider';
import { CourseNode, courseNodes, courseUnits, nodeWithID } from '../../src/lib/learn/course';
import { auditProblems } from '../../src/lib/learn/courseAudit';
import { LearnExercise, folded, missedKeys } from '../../src/lib/learn/exercise';
import { latinSource, sampleSource, schoolSource } from './languageSample';

const sample = LanguageCourseProvider.make(sampleSource).provider;
const exercisesOf = (provider: LanguageCourseProvider, node: CourseNode, seed = 1n) => provider.exercises(node, seed);
const node = (provider: LanguageCourseProvider, id: string): CourseNode => nodeWithID(provider.course, id)!;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const typedMiss = (item: LearnExercise, text: string) => missedKeys(item, { type: 'typed', value: text });

describe('language DSL', () => {
  it('the sample parses without problems', () => {
    const made = LanguageCourseProvider.make(sampleSource);
    expect(made.errors).toEqual([]);
    const data = made.provider.data;
    expect([data.id, data.kind, data.color, data.speech, data.instruction, data.knownName]).toEqual(['sample', 'language', 0xd9903a, 'es-ES', 'de', 'Deutsche']);
    expect(data.units).toHaveLength(2);
    const first = data.units[0];
    expect([first.title, first.summary, first.sectionTitle]).toEqual(['Hallo und Tschüss', 'Begrüßen und sich vorstellen', 'A1 · Erste Schritte']);
    expect([first.words.length, first.sentences.length, first.forms.length, first.fills.length, first.facts.length]).toEqual([12, 8, 4, 3, 2]);
    expect(first.tip.split('\n\n')).toHaveLength(2);
    expect(first.words[1]).toEqual({ target: 'adiós', meanings: ['tschüss', 'auf Wiedersehen'], note: '', why: '' });
    expect(data.units[1].words[0].note).toBe('f');
    expect(first.forms[0].why).toBe('Mit „yo“ steht „soy“.');
    expect(formGroup(first.forms[0])).toBe('ser');
    expect(first.fills[0].options).toEqual(['soy', 'eres', 'es']);
    expect(first.facts[1].answer).toBe('¿');
    expect(first.facts[1].wrong).toEqual(['!', '?']);
    expect(made.provider.course.sections).toHaveLength(1);
    expect(courseUnits(made.provider.course)).toHaveLength(2);
  });

  it('every problem is reported with its line', () => {
    const errors = parseCourse(`course: x
title: X
subtitle: s
color: 12
symbol: globe
word: hola = hallo
unit: Eins
word: hola
word: = nichts
fill: Yo soy = a | b
fill: Yo ___ = nur
fact: Frage? = nur eine Antwort
colour: red
tip:
no colon here
unit:
`).errors;
    for (const text of [
      'line 6: word before the first unit', 'line 8: word needs " = "', 'line 9: word needs " = "', 'line 10: fill without ___', 'line 11: fill needs a right and a wrong choice',
      'line 12: fact needs an answer and a wrong answer', 'line 13: unknown key "colour"', 'line 14: empty tip', 'line 15: no "key: value"', 'line 16: unit without a title', 'color must be six hex digits',
    ]) expect(errors, text).toContain(text);
  });

  it('content problems are found', () => {
    const problems = LanguageCourseProvider.make(`course: x
title: X
subtitle: s
color: 336699
symbol: globe
unit: Eins | s
tip: Tipp
word: el coche = das Auto
word: el auto = das Auto
word: el coche = der Wagen
word: a = b
word: c = d
word: e = f
word: g = h
sentence: Hola. = Hallo.
sentence: Hola. = Hallo!
`).errors;
    expect(problems.some((p) => p.includes('"das Auto" means both el coche and el auto'))).toBe(true);
    expect(problems.some((p) => p.includes('el coche twice'))).toBe(true);
    expect(problems.some((p) => p.includes('sentence twice: Hola.'))).toBe(true);
  });

  it('sections group units in order and school courses need no speech', () => {
    const data = parseCourse(`course: de
title: Deutsch
subtitle: Schulfach
kind: school
color: C46A55
symbol: book.fill
section: Rechtschreibung
unit: Das oder dass | s
tip: Tipp
fact: A? = a | b
section: Grammatik
unit: Fälle | s
tip: Tipp
fact: B? = a | b
unit: Zeiten | s
tip: Tipp
fact: C? = a | b
`).data;
    expect(data.kind).toBe('school');
    expect(data.speech).toBeNull();
    const course = new LanguageCourseProvider(data).course;
    expect(course.sections.map((s) => s.title)).toEqual(['Rechtschreibung', 'Grammatik']);
    expect(course.sections.map((s) => s.units.length)).toEqual([1, 2]);
    expect(courseUnits(course).map((u) => u.number)).toEqual([1, 2, 3]);
  });

  it('English instructions for a foreign language course', () => {
    const data = parseCourse(`course: daf
title: Deutsch als Fremdsprache
subtitle: For English speakers · A1
color: B8A04A
symbol: textformat
speech: de-DE
instruction: en
target-name: German
into-name: German
unit: Hello | Greetings
tip: In German, nouns are capitalised.
word: Hallo = hello
`).data;
    expect([data.instruction, data.knownName]).toEqual(['en', 'English']);
    const texts = textsFor(data);
    expect(fillText(texts.askTarget, 'house')).toBe('How do you say “house” in German?');
    expect(fillText(texts.translateFrom, 'Haus')).toBe('Translate into English:\nHaus');
    expect(texts.pairs).toBe('Match the pairs');
    const german = textsFor(sample.data);
    expect(fillText(german.askTarget, 'Haus')).toBe('Wie sagt man „Haus“ auf Spanisch?');
    expect(fillText(german.translateInto, 'Haus')).toBe('Übersetze ins Spanische:\nHaus');
  });
});

describe('language engine', () => {
  it('the sample course passes the audit', () => {
    expect(auditProblems(sample, range(1, 12).map(BigInt))).toEqual([]);
  });

  it('the same seed gives the same lesson and another seed shuffles it', () => {
    const n = node(sample, 'sample.u01.l1');
    expect(exercisesOf(sample, n)).toEqual(exercisesOf(sample, n));
    const variants = new Set(range(1, 10).map((s) => exercisesOf(sample, n, BigInt(s)).map((e) => e.id).join(',')));
    expect(variants.size).toBeGreaterThan(3);
  });

  it('every lesson mixes kinds and goes from easy to hard', () => {
    for (const n of courseNodes(sample.course)) {
      if (n.kind === 'chest') continue;
      for (let seed = 1n; seed <= 5n; seed++) {
        const list = exercisesOf(sample, n, seed);
        expect(new Set(list.map((e) => e.kind)).size, `${n.id} seed ${seed}`).toBeGreaterThanOrEqual(3);
        expect(list[0].kind).toBe('multipleChoice');
      }
    }
  });

  it('a lesson teaches its share and the checkpoint the whole unit', () => {
    const unit = sample.data.units[0];
    expect(courseUnits(sample.course)[0].nodes.filter((n) => n.kind === 'lesson')).toHaveLength(5);
    const words = (id: string) => {
      const seen = new Set<string>();
      for (let seed = 1n; seed <= 6n; seed++) {
        for (const e of exercisesOf(sample, node(sample, id), seed)) unit.words.forEach((w, i) => { if (e.id.includes(`#w0-${i}`)) seen.add(w.target); });
      }
      return seen;
    };
    const first = words('sample.u01.l1');
    const last = words('sample.u01.l5');
    expect(first.has('hola')).toBe(true);
    expect(first.has('tú')).toBe(false);
    expect(last.has('tú') || last.has('el nombre')).toBe(true);
    expect(last.has('hola')).toBe(false);
    expect(words('sample.u01.t').size).toBeGreaterThan(8);
  });

  it('every word meets the student in several forms across the unit', () => {
    sample.data.units[0].words.forEach((word, index) => {
      const forms = new Set<string>();
      for (const n of courseUnits(sample.course)[0].nodes) {
        if (n.kind === 'chest') continue;
        for (let seed = 1n; seed <= 3n; seed++) for (const e of exercisesOf(sample, n, seed)) if (e.id.includes(`#w0-${index}`)) forms.add(e.id[e.id.length - 1]);
      }
      expect(forms.size, `${word.target}: ${[...forms]}`).toBeGreaterThanOrEqual(3);
    });
  });

  it('wrong answers of words and sentences are never also right', () => {
    const words = sample.data.units.flatMap((u) => u.words);
    for (const n of courseNodes(sample.course)) {
      if (n.kind === 'chest') continue;
      for (let seed = 1n; seed <= 6n; seed++) {
        for (const e of exercisesOf(sample, n, seed)) {
          if (e.kind !== 'multipleChoice' || !(e.id.includes('#w') || e.id.includes('#s'))) continue;
          const wrong = e.options.filter((o) => !e.correctAnswers.includes(o));
          for (const option of wrong) expect(AnswerCheck.evaluate(option, e.correctAnswers[0]), `${e.id}: ${option} vs ${e.correctAnswers[0]}`).not.toBe('correct');
          if (e.id.endsWith('a') && e.prompt.startsWith('Was bedeutet')) {
            for (const word of words.filter((w) => e.prompt.includes(`„${w.target}“`))) {
              const meanings = new Set(word.meanings.map(folded));
              expect(wrong.some((w) => meanings.has(folded(w)))).toBe(false);
            }
          }
        }
      }
    }
  });

  it('typed answers in the language being learned are strict', () => {
    const n = node(sample, 'sample.u02.t');
    const all: LearnExercise[] = [];
    for (let seed = 1n; seed <= 40n; seed++) all.push(...exercisesOf(sample, n, seed));
    const exact = all.filter((e) => e.kind === 'typeAnswer' && e.mode === 'exact');
    const word = exact.find((e) => e.correctAnswers.length === 1 && e.correctAnswers[0] === 'el hermano')!;
    expect(typedMiss(word, 'El Hermano')).toEqual(new Set());
    expect(typedMiss(word, 'el hermana')).toEqual(new Set([word.cardKeys[0]]));
    const sentence = exact.find((e) => ['Me llamo Ana.', 'Tengo un hermano.'].includes(e.correctAnswers[0]))!;
    const right = sentence.correctAnswers[0];
    expect(typedMiss(sentence, right.toLowerCase())).toEqual(new Set());
    expect(typedMiss(sentence, right.split(' ').reverse().join(' '))).toEqual(new Set([sentence.cardKeys[0]]));
  });

  it('listening and speech only with a voice', () => {
    const list = range(1, 6).flatMap((s) => exercisesOf(sample, node(sample, 'sample.u01.p'), BigInt(s)));
    expect(list.some((e) => e.prompt.startsWith('Tippe auf den Lautsprecher') && e.media?.kind === 'speech' && e.media.text === e.correctAnswers[0] && e.media.language === 'es-ES')).toBe(true);
    const silent = LanguageCourseProvider.make(sampleSource.replace('speech: es-ES\n', '')).provider;
    expect(silent.data.speech).toBeNull();
    for (const n of courseNodes(silent.course)) {
      if (n.kind === 'chest') continue;
      for (const e of silent.exercises(n, 2n)) {
        expect(e.media).toBeUndefined();
        expect(e.prompt.startsWith('Tippe auf den Lautsprecher')).toBe(false);
      }
    }
    expect(auditProblems(silent, [1n, 2n, 3n])).toEqual([]);
  });

  it('typed answers accept alternatives and forgive accents', () => {
    const n = node(sample, 'sample.u01.t');
    let checked = 0;
    for (let seed = 1n; seed <= 30n; seed++) {
      for (const e of exercisesOf(sample, n, seed)) {
        if (e.kind === 'typeAnswer' && e.id.endsWith('e') && e.correctAnswers.length > 1) {
          expect(typedMiss(e, e.correctAnswers[1])).toEqual(new Set());
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    const pool: LearnExercise[] = [];
    for (let seed = 1n; seed <= 60n; seed++) pool.push(...exercisesOf(sample, n, seed));
    const typed = pool.find((e) => e.kind === 'typeAnswer' && e.correctAnswers[0] === 'buenos días')!;
    expect(typedMiss(typed, 'buenos dias')).toEqual(new Set());
    expect(typedMiss(typed, 'buenas noches')).toEqual(new Set([typed.cardKeys[0]]));
  });

  it('forms are chosen from their own verb and fills keep their choices', () => {
    const lessons = courseUnits(sample.course)[0].nodes.filter((n) => n.kind === 'lesson');
    const list = range(1, 8).flatMap((seed) => lessons.flatMap((l) => exercisesOf(sample, l, BigInt(seed))));
    const form = list.find((e) => e.prompt.startsWith('Bilde die Form') && e.kind === 'multipleChoice');
    expect(form).toBeDefined();
    expect(form!.options.every((o) => ['soy', 'eres', 'es', 'somos'].includes(o))).toBe(true);
    const fill = list.find((e) => e.prompt.startsWith('Welches Wort fehlt') && e.kind === 'multipleChoice');
    expect(fill).toBeDefined();
    expect(fill!.solution.includes(fill!.correctAnswers[0]) && !fill!.solution.includes('___')).toBe(true);
  });

  it('word bank tiles have no punctuation and accept the right order', () => {
    const banks = range(1, 20).flatMap((s) => exercisesOf(sample, node(sample, 'sample.u01.p'), BigInt(s))).filter((e) => e.kind === 'wordBank');
    expect(banks.length).toBeGreaterThan(0);
    for (const bank of banks) {
      expect(bank.options.every((o) => !/[.¿?,]/.test(o)), `${bank.options}`).toBe(true);
      expect(missedKeys(bank, { type: 'words', value: bank.correctAnswers })).toEqual(new Set());
      expect(bank.solution).not.toBe('');
    }
  });

  it('pairs match words to meanings', () => {
    const pairs = range(1, 10).flatMap((s) => exercisesOf(sample, node(sample, 'sample.u02.t'), BigInt(s))).filter((e) => e.kind === 'matchPairs');
    expect(pairs.length).toBeGreaterThan(0);
    const words = new Map(sample.data.units.flatMap((u) => u.words).map((w) => [w.target, w.meanings[0]]));
    for (const e of pairs) {
      expect(e.pairs).toHaveLength(4);
      for (const pair of e.pairs) expect(words.get(pair.front)).toBe(pair.back);
    }
  });

  it('practice brings back earlier units', () => {
    const ids = range(1, 10).flatMap((s) => exercisesOf(sample, node(sample, 'sample.u02.p'), BigInt(s))).map((e) => e.id);
    expect(ids.some((id) => id.includes('#w0-') || id.includes('#s0-'))).toBe(true);
    expect(ids.some((id) => id.includes('#w1-') || id.includes('#s1-'))).toBe(true);
  });

  it('chests and unknown nodes have no exercises', () => {
    expect(exercisesOf(sample, node(sample, 'sample.u01.k'))).toEqual([]);
    expect(exercisesOf(sample, { id: 'sample.u09.l1', courseID: 'sample', unitID: 'sample.u09', unitNumber: 9, kind: 'lesson', index: 1, title: 'x' })).toEqual([]);
  });

  it('a course that only reads never asks for free production', () => {
    const made = LanguageCourseProvider.make(latinSource);
    expect(made.errors).toEqual([]);
    expect(made.provider.data.produces).toBe(false);
    expect(auditProblems(made.provider, range(1, 12).map(BigInt))).toEqual([]);
    let forms = 0;
    let translations = 0;
    for (const n of courseNodes(made.provider.course)) {
      if (n.kind === 'chest') continue;
      for (let seed = 1n; seed <= 6n; seed++) {
        for (const e of made.provider.exercises(n, seed)) {
          expect(e.prompt.startsWith('Wie sagt man'), e.prompt).toBe(false);
          expect(e.prompt.startsWith('Übersetze ins Lateinische'), e.prompt).toBe(false);
          if (e.prompt.startsWith('Bilde die Form')) forms++;
          if (e.id.endsWith('f')) { translations++; expect(e.mode).toBe('text'); }
          expect(e.media).toBeUndefined();
        }
      }
    }
    expect(forms).toBeGreaterThan(0);
    expect(translations).toBeGreaterThan(0);
  });

  it("the word's grammar note is the explanation", () => {
    const provider = LanguageCourseProvider.make(latinSource).provider;
    const list = range(1, 10).flatMap((s) => provider.exercises(node(provider, 'la.u01.l1'), BigInt(s)));
    expect(list.find((e) => e.id.includes('#w0-0a'))?.explanation).toBe('puella · -ae f.');
  });

  it('a school subject asks for terms, not for translations', () => {
    const made = LanguageCourseProvider.make(schoolSource);
    expect(made.errors).toEqual([]);
    expect(made.provider.course.kind).toBe('school');
    expect(auditProblems(made.provider, range(1, 12).map(BigInt))).toEqual([]);
    for (const n of courseNodes(made.provider.course)) {
      if (n.kind === 'chest') continue;
      for (let seed = 1n; seed <= 4n; seed++) {
        for (const e of made.provider.exercises(n, seed)) {
          expect(e.id.endsWith('e') && e.kind === 'typeAnswer' && e.id.includes('#w')).toBe(false);
          expect(e.prompt.includes('auf Deutsch')).toBe(false);
        }
      }
    }
  });

  it('coverage finds sentences with words not taught yet', () => {
    expect(gaps(LanguageCourseProvider.make(latinSource).provider.data)).toEqual([]);
    const found = gaps(sample.data);
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((g) => g.sentence === 'Me llamo Ana.' && g.words.includes('llamo'))).toBe(true);
    expect(found.some((g) => g.sentence === 'No, gracias.')).toBe(false);
    expect(tokensOf('¿Cómo te llamas? 12')).toEqual(['como', 'te', 'llamas']);
    expect(gapText(found[0])).toContain('uses');
  });

  it('says what is off about a typed answer', () => {
    expect(answerAdvice('me llamo', ['Me llamo Ana.'])).toBe('Es fehlt mindestens ein Wort.');
    expect(answerAdvice('Ana llamo me', ['Me llamo Ana.'])).toBe('Die Wörter stimmen, aber die Reihenfolge nicht.');
    expect(answerAdvice('Me llamo Ana mucho', ['Me llamo Ana.'])).toBe('Es sind zu viele Wörter.');
    expect(answerAdvice('Me llama Ana', ['Me llamo Ana.'])).toBe('Fast: Der Wortanfang stimmt, die Endung (Wort 2) nicht.');
    expect(answerAdvice('Te llamo Ana', ['Me llamo Ana.'])).toBe('Ein Wort stimmt nicht (Wort 1).');
    expect(answerAdvice('me llamo ana', ['Me llamo Ana.'])).toBeNull();
    expect(answerAdvice('', ['x'])).toBeNull();
  });
});
