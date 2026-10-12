// Port of LernwerkTests/LanguageDSLTests.swift (parser part) and the parser/data/coverage parts of LanguageCourseTests.swift.
// The provider assertions of those Swift tests (sections, nodes, exercises) follow with the provider.
import { describe, expect, it } from 'vitest';
import { coverageGaps, coverageTokens } from '../../src/lib/learn/languages/coverage';
import {
  fillTemplate, formGroup, makeLanguageTexts, problems, unitItemCount,
} from '../../src/lib/learn/languages/data';
import { parseLanguageCourse } from '../../src/lib/learn/languages/dsl';
import { courseTextIds, courseTexts } from '../../src/lib/learn/languages/texts';
import { latinSource, sampleSource, schoolSource } from './languageSample';

describe('LanguageDSL', () => {
  it('parses the sample without problems', () => {
    const { data, errors } = parseLanguageCourse(sampleSource);
    expect(errors).toEqual([]);
    expect(problems(data)).toEqual([]);
    expect(data.id).toBe('sample');
    expect(data.kind).toBe('language');
    expect(data.color).toBe(0xd9903a);
    expect(data.speech).toBe('es-ES');
    expect(data.instruction).toBe('de');
    expect(data.knownName).toBe('Deutsche');
    expect(data.units.length).toBe(2);
    const first = data.units[0];
    expect(first.title).toBe('Hallo und Tschüss');
    expect(first.summary).toBe('Begrüßen und sich vorstellen');
    expect(first.sectionTitle).toBe('A1 · Erste Schritte');
    expect(first.words.length).toBe(12);
    expect(first.sentences.length).toBe(8);
    expect(first.forms.length).toBe(4);
    expect(first.fills.length).toBe(3);
    expect(first.facts.length).toBe(2);
    expect(unitItemCount(first)).toBe(29);
    expect(first.tip.split('\n\n').length).toBe(2);
    expect(first.words[1]).toEqual({ target: 'adiós', meanings: ['tschüss', 'auf Wiedersehen'], note: '', why: '' });
    expect(data.units[1].words[0].note).toBe('f');
    expect(first.forms[0].why).toBe('Mit „yo“ steht „soy“.');
    expect(formGroup(first.forms[0])).toBe('ser');
    expect(first.fills[0].options).toEqual(['soy', 'eres', 'es']);
    expect(first.facts[1].answer).toBe('¿');
    expect(first.facts[1].wrong).toEqual(['!', '?']);
  });

  it('reports every problem with its line', () => {
    const source = [
      'course: x', 'title: X', 'subtitle: s', 'color: 12', 'symbol: globe', 'word: hola = hallo', 'unit: Eins',
      'word: hola', 'word: = nichts', 'fill: Yo soy = a | b', 'fill: Yo ___ = nur', 'fact: Frage? = nur eine Antwort',
      'colour: red', 'tip:', 'no colon here', 'unit:',
    ].join('\n');
    const errors = parseLanguageCourse(source).errors;
    for (const text of [
      'line 6: word before the first unit',
      'line 8: word needs " = "',
      'line 9: word needs " = "',
      'line 10: fill without ___',
      'line 11: fill needs a right and a wrong choice',
      'line 12: fact needs an answer and a wrong answer',
      'line 13: unknown key "colour"',
      'line 14: empty tip',
      'line 15: no "key: value"',
      'line 16: unit without a title',
      'color must be six hex digits',
    ]) {
      expect(errors, text).toContain(text);
    }
  });

  it('finds content problems', () => {
    const source = [
      'course: x', 'title: X', 'subtitle: s', 'color: 336699', 'symbol: globe', 'unit: Eins | s', 'tip: Tipp',
      'word: el coche = das Auto', 'word: el auto = das Auto', 'word: el coche = der Wagen', 'word: a = b',
      'word: c = d', 'word: e = f', 'word: g = h', 'sentence: Hola. = Hallo.', 'sentence: Hola. = Hallo!',
    ].join('\n');
    const parsed = parseLanguageCourse(source);
    expect(parsed.errors).toEqual([]);
    const found = problems(parsed.data);
    expect(found.some((p) => p.includes('"das Auto" means both el coche and el auto'))).toBe(true);
    expect(found.some((p) => p.includes('el coche twice'))).toBe(true);
    expect(found.some((p) => p.includes('sentence twice: Hola.'))).toBe(true);
  });

  it('also reports a unit without a tip, few items, fills without a blank or a wrong choice, facts without wrong answers', () => {
    const data = parseLanguageCourse(
      ['course: x', 'title: X', 'subtitle: s', 'color: 336699', 'symbol: g', 'unit: Eins', 'fill: a = b | c'].join('\n'),
    ).data;
    const found = problems(data);
    expect(found).toContain('unit 1: no tip');
    expect(found).toContain('unit 1: only 1 items');
    expect(found).toContain('unit 1: no blank in a');
  });

  it('groups units in sections in order; school courses need no speech', () => {
    const source = [
      'course: de', 'title: Deutsch', 'subtitle: Schulfach', 'kind: school', 'color: C46A55', 'symbol: book.fill',
      'section: Rechtschreibung', 'unit: Das oder dass | s', 'tip: Tipp', 'fact: A? = a | b',
      'section: Grammatik', 'unit: Fälle | s', 'tip: Tipp', 'fact: B? = a | b', 'unit: Zeiten | s', 'tip: Tipp',
      'fact: C? = a | b',
    ].join('\n');
    const { data } = parseLanguageCourse(source);
    expect(data.kind).toBe('school');
    expect(data.speech).toBeNull();
    expect(data.units.map((u) => u.sectionTitle)).toEqual(['Rechtschreibung', 'Grammatik', 'Grammatik']);
    expect(data.units.map((u) => u.title)).toEqual(['Das oder dass', 'Fälle', 'Zeiten']);
  });

  it('supports English instructions for a foreign-language course', () => {
    const source = [
      'course: daf', 'title: Deutsch als Fremdsprache', 'subtitle: For English speakers · A1', 'color: B8A04A',
      'symbol: textformat', 'speech: de-DE', 'instruction: en', 'target-name: German', 'into-name: German',
      'unit: Hello | Greetings', 'tip: In German, nouns are capitalised.', 'word: Hallo = hello',
    ].join('\n');
    const { data } = parseLanguageCourse(source);
    expect(data.instruction).toBe('en');
    expect(data.knownName).toBe('English');
    const texts = makeLanguageTexts(data);
    expect(fillTemplate(texts.askTarget, 'house')).toBe('How do you say “house” in German?');
    expect(fillTemplate(texts.translateFrom, 'Haus')).toBe('Translate into English:\nHaus');
    expect(texts.pairs).toBe('Match the pairs');
    const german = makeLanguageTexts(parseLanguageCourse(sampleSource).data);
    expect(fillTemplate(german.askTarget, 'Haus')).toBe('Wie sagt man „Haus“ auf Spanisch?');
    expect(fillTemplate(german.translateInto, 'Haus')).toBe('Übersetze ins Spanische:\nHaus');
    expect(german.pairs).toBe('Finde die Paare');
  });

  it('reads the latin variant (no voice, produce: no, known:) and the school source', () => {
    const latin = parseLanguageCourse(latinSource);
    expect(latin.errors).toEqual([]);
    expect(problems(latin.data)).toEqual([]);
    expect(latin.data.produces).toBe(false);
    expect(latin.data.speech).toBeNull();
    expect(latin.data.units[0].known).toEqual(['Marcus', 'Roma', 'aquam', 'terram', 'habitant']);
    expect(latin.data.units[0].words[0]).toEqual({ target: 'puella', meanings: ['das Mädchen'], note: '-ae f.', why: '' });
    expect(formGroup(latin.data.units[0].forms[0])).toBe('puella');
    const school = parseLanguageCourse(schoolSource);
    expect(school.errors).toEqual([]);
    expect(problems(school.data)).toEqual([]);
    expect(school.data.kind).toBe('school');
    expect(makeLanguageTexts(school.data).askTarget).toBe('Welcher Begriff ist gemeint?\n{x}');
  });

  it('keeps the edge cases of the Swift parser', () => {
    const errors = parseLanguageCourse('kind: x\nproduce: maybe\ninstruction: fr\ncolor: GG0000\nspeech:').errors;
    expect(errors).toContain('kind must be language or school');
    expect(errors).toContain('produce must be yes or no');
    expect(errors).toContain('instruction must be de or en');
    expect(errors).toContain('color must be six hex digits');
    expect(errors).toContain('no units');
    expect(errors).toContain('missing "course:"');
    // every newline character is a line break, so "\r\n" counts two lines like Swift's .newlines
    expect(parseLanguageCourse('a\r\nb').errors.slice(0, 2)).toEqual(['line 1: no "key: value"', 'line 3: no "key: value"']);
    expect(formGroup({ prompt: 'ser , yo', answers: [], why: '' })).toBe('ser');
    expect(formGroup({ prompt: 'nosotros', answers: [], why: '' })).toBe('nosotros');
  });
});

describe('LanguageCoverage', () => {
  it('finds sentences with words not taught yet', () => {
    const latin = parseLanguageCourse(latinSource).data;
    expect(coverageGaps(latin)).toEqual([]);
    const spanish = parseLanguageCourse(sampleSource).data;
    const gaps = coverageGaps(spanish);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some((g) => g.sentence === 'Me llamo Ana.' && g.words.includes('llamo'))).toBe(true);
    expect(gaps.some((g) => g.sentence === 'No, gracias.')).toBe(false);
    expect(coverageTokens('¿Cómo te llamas? 12')).toEqual(['como', 'te', 'llamas']);
  });
});

describe('the shared course texts', () => {
  it('has the five courses', () => {
    expect(courseTextIds.slice().sort()).toEqual(['daf', 'de', 'es', 'fr', 'la']);
    expect(Object.keys(courseTexts).sort()).toEqual(['daf', 'de', 'es', 'fr', 'la']);
  });

  for (const id of ['es', 'fr', 'la', 'daf', 'de']) {
    it(`${id} parses without errors, has no content problems and full coverage`, () => {
      const { data, errors } = parseLanguageCourse(courseTexts[id]);
      expect(errors).toEqual([]);
      expect(data.id).toBe(id);
      expect(problems(data)).toEqual([]);
      if (data.kind !== 'school') expect(coverageGaps(data).map((g) => `${g.unit}: ${g.sentence} ${g.words}`)).toEqual([]);
      expect(data.units.length).toBeGreaterThan(0);
    });
  }
});
