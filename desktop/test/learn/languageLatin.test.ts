// Port of LernwerkTests/LatinCourseTests.swift.
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import { coverageGaps, describeGap } from '../../src/lib/learn/languages/coverage';
import { latinProvider } from '../../src/lib/learn/languages/courses';
import { LanguageCourseProvider } from '../../src/lib/learn/languages/provider';
import { courseTexts } from '../../src/lib/learn/languages/texts';
import { chars, dropLast, get, inRange, lastChar, lettersOnly, range } from './languageKit';

const made = LanguageCourseProvider.make(courseTexts.la);
const data = made.provider.data;
const units = data.units;
const words = units.flatMap((u) => u.words);
const sentences = units.flatMap((u) => u.sentences);
const forms = units.flatMap((u) => u.forms);
const itemCount = (u: (typeof units)[number]) => u.words.length + u.sentences.length + u.forms.length + u.fills.length + u.facts.length;

// Reference data typed again here
const aEndings: Record<string, string> = {
  'Nominativ Singular': 'a', 'Nominativ Plural': 'ae', 'Genitiv Singular': 'ae', 'Genitiv Plural': 'arum',
  'Dativ Singular': 'ae', 'Dativ Plural': 'is', 'Akkusativ Singular': 'am', 'Akkusativ Plural': 'as',
  'Ablativ Singular': 'a', 'Ablativ Plural': 'is',
};
const oEndings: Record<string, string> = {
  'Genitiv Singular': 'i', 'Genitiv Plural': 'orum', 'Dativ Singular': 'o', 'Dativ Plural': 'is',
  'Akkusativ Singular': 'um', 'Akkusativ Plural': 'os', 'Ablativ Singular': 'o', 'Ablativ Plural': 'is',
  'Nominativ Plural': 'i',
};
const nStem: Record<string, string> = {
  puella: 'puell', femina: 'femin', agricola: 'agricol', nauta: 'naut', rosa: 'ros', via: 'vi', villa: 'vill', domina: 'domin',
};
const oMasc: Record<string, string> = { servus: 'serv', hortus: 'hort', dominus: 'domin', amicus: 'amic' };
const oNeut: Record<string, string> = { templum: 'templ' };
const gender: Record<string, string> = {
  puella: 'f', femina: 'f', amica: 'f', dea: 'f', agricola: 'm', nauta: 'm', rosa: 'f', aqua: 'f',
  villa: 'f', via: 'f', silva: 'f', terra: 'f', amicus: 'm', servus: 'm', dominus: 'm', filius: 'm',
  equus: 'm', hortus: 'm', templum: 'n', oppidum: 'n', bellum: 'n', donum: 'n', schola: 'f', porta: 'f',
  insula: 'f', murus: 'm', discipulus: 'm', domina: 'f', fabula: 'f', pecunia: 'f', gloria: 'f',
  gladius: 'm', vita: 'f',
};
const verbStem: Record<string, string> = { amare: 'am', habere: 'hab', audire: 'aud', monere: 'mon', venire: 'ven' };
const personEnd: Record<string, number> = { '1. Person Singular': 0, '2. Person Singular': 1, '1. Person Plural': 3, '2. Person Plural': 4 };
const conj: Record<string, string[]> = {
  amare: ['o', 'as', 'at', 'amus', 'atis', 'ant'],
  habere: ['eo', 'es', 'et', 'emus', 'etis', 'ent'],
  audire: ['io', 'is', 'it', 'imus', 'itis', 'iunt'],
};
const esse = ['sum', 'es', 'est', 'sumus', 'estis', 'sunt'];

function split(prompt: string): [string, string] | null {
  const i = prompt.indexOf(', ');
  return i < 0 ? null : [prompt.slice(0, i), prompt.slice(i + 2)];
}

describe('Latin course', () => {
  it('parses without problems', () => {
    expect(made.errors).toEqual([]);
  });

  it('has the header', () => {
    expect(data.id).toBe('la');
    expect(data.title).toBe('Latein');
    expect(data.kind).toBe('language');
    expect(data.color).toBe(0x9a7b5b);
    expect(data.speech).toBeNull();
    expect(data.produces).toBe(false);
    expect(data.instruction).toBe('de');
  });

  it('has full coverage and a clean audit', () => {
    expect(coverageGaps(data).map(describeGap)).toEqual([]);
    expect(CourseAudit.problems(made.provider, range(1, 5).map(BigInt))).toEqual([]);
    expect(latinProvider.course.id).toBe('la');
  });

  it('has the sizes', () => {
    expect(units.length).toBe(8);
    expect(words.length).toBeGreaterThanOrEqual(85);
    expect(sentences.length).toBeGreaterThanOrEqual(60);
    expect(forms.length).toBeGreaterThanOrEqual(40);
    units.forEach((unit, i) => {
      expect(inRange(itemCount(unit), 22, 30), `unit ${i + 1} has ${itemCount(unit)} items`).toBe(true);
      expect(inRange(unit.tip.split('\n\n').length, 3, 5), `unit ${i + 1} tips`).toBe(true);
      expect(unit.sentences.every((s) => s.target.split(' ').length <= 10)).toBe(true);
    });
  });

  it('gives noun genders in the note', () => {
    for (const word of words) {
      const g = get(gender, word.target);
      if (g === undefined) continue;
      expect(word.note.endsWith(` ${g}.`), `${word.target}: ${word.note}`).toBe(true);
      const expectedEnding = word.target.endsWith('a') ? '-ae' : word.target.endsWith('um') ? '-i' : word.target.endsWith('us') ? '-i' : '?';
      expect(word.note.startsWith(expectedEnding), `${word.target}: ${word.note}`).toBe(true);
    }
    const nounWords = words.filter((w) => w.note.endsWith(' f.') || w.note.endsWith(' m.') || w.note.endsWith(' n.'));
    for (const noun of nounWords) expect(get(gender, noun.target), `${noun.target} missing in reference list`).toBeDefined();
  });

  it('forms declensions by the endings', () => {
    let checked = 0;
    for (const form of forms) {
      const s = split(form.prompt);
      const answer = form.answers[0];
      if (!s || answer === undefined) continue;
      const [lemma, info] = s;
      if (get(nStem, lemma) !== undefined && get(aEndings, info) !== undefined) {
        expect(answer, form.prompt).toBe(nStem[lemma] + aEndings[info]);
        checked++;
      } else {
        const stem = get(oMasc, lemma) ?? get(oNeut, lemma);
        const end = get(oEndings, info);
        if (stem !== undefined && end !== undefined) {
          let ending = end;
          if (get(oNeut, lemma) !== undefined) {
            if (info === 'Nominativ Plural' || info === 'Akkusativ Plural') ending = 'a';
            if (info === 'Akkusativ Singular') ending = 'um';
          }
          expect(answer, form.prompt).toBe(stem + ending);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(18);
  });

  it('forms verbs by the tables', () => {
    let checked = 0;
    for (const form of forms) {
      const s = split(form.prompt);
      const answer = form.answers[0];
      if (!s || answer === undefined) continue;
      const [verb, info] = s;
      const i = get(personEnd, info);
      if (verb === 'esse' && i !== undefined) {
        expect(answer).toBe(esse[i]);
        checked++;
      } else if (verb === 'amare' && i !== undefined) {
        expect(answer, form.prompt).toBe(['amo', 'amas', 'amat', 'amamus', 'amatis', 'amant'][i]);
        checked++;
      } else if (get(conj, verb) !== undefined && get(verbStem, verb) !== undefined && i !== undefined) {
        expect(answer, form.prompt).toBe(verbStem[verb] + conj[verb][i]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(14);
  });

  it('has the imperatives', () => {
    const expected: Record<string, string> = {
      'amare, Imperativ Singular': 'ama', 'amare, Imperativ Plural': 'amate', 'audire, Imperativ Plural': 'audite',
      'venire, Imperativ Plural': 'venite',
    };
    for (const [prompt, answer] of Object.entries(expected)) {
      expect(forms.find((f) => f.prompt === prompt)?.answers[0], prompt).toBe(answer);
    }
    for (const form of forms) {
      if (form.prompt.includes('Imperativ Plural')) expect(form.answers[0].endsWith('te')).toBe(true);
      if (form.prompt.includes('Imperativ Singular')) expect(form.answers[0].endsWith('te')).toBe(false);
    }
  });

  it('gives every verb word a third-person pair with the right endings', () => {
    for (const word of words) {
      if (!(word.note.includes('konjugation') && word.target.includes(', '))) continue;
      const parts = word.target.split(', ');
      expect(parts.length, word.target).toBe(2);
      expect(parts[0].endsWith('t'), word.target).toBe(true);
      expect(parts[1].endsWith('nt'), word.target).toBe(true);
      expect(dropLast(parts[1], 2).split('iu').join('i'), word.target).toBe(dropLast(parts[0], 1));
    }
  });

  it('repeats no sentence and leaves no Latin in the translations', () => {
    const seen = new Set<string>();
    const names = new Set(['marcus', 'iulia']);
    const latinWords = new Set(
      [...new Set(sentences.flatMap((s) => lettersOnly(s.target)))].filter((t) => !names.has(t) && chars(t).length >= 4),
    );
    for (const sentence of sentences) {
      const key = sentence.target.toLowerCase();
      expect(seen.has(key), sentence.target).toBe(false);
      seen.add(key);
      for (const meaning of sentence.meanings) {
        for (const token of lettersOnly(meaning)) if (latinWords.has(token)) expect.fail(`${sentence.target} -> ${meaning} contains ${token}`);
        expect(meaning.endsWith('.') || meaning.endsWith('!') || meaning.endsWith('?'), meaning).toBe(true);
      }
      expect(lastChar(sentence.target), sentence.target).toBe(lastChar(sentence.meanings[0]));
    }
  });

  it('keeps fills and forms consistent', () => {
    for (const unit of units) {
      for (const fill of unit.fills) {
        expect(new Set(fill.options).size, fill.sentence).toBe(fill.options.length);
        expect(fill.why, fill.sentence).not.toBe('');
      }
      const answers = unit.forms.map((f) => f.answers[0]);
      expect(new Set(unit.forms.map((f) => f.prompt)).size).toBe(unit.forms.length);
      expect(new Set(answers).size, 'a unit repeats a form answer').toBe(answers.length);
    }
  });

  it('has no long vowel marks and no special characters', () => {
    const macrons = /[āēīōūĀĒĪŌŪ]/u;
    const ascii = (t: string) => chars(t).every((c) => c.codePointAt(0)! < 128);
    for (const word of words) {
      expect(macrons.test(word.target)).toBe(false);
      expect(ascii(word.target), word.target).toBe(true);
    }
    for (const sentence of sentences) expect(ascii(sentence.target), sentence.target).toBe(true);
    for (const form of forms) expect(form.answers.every((a) => chars(a).every((c) => /^\p{Ll}$/u.test(c)))).toBe(true);
  });

  it('has the German meanings of key words', () => {
    const gloss: Record<string, string> = {
      puella: 'mädchen', agricola: 'bauer', nauta: 'seemann', servus: 'sklave', dominus: 'herr', templum: 'tempel',
      cum: 'mit', sine: 'ohne', ad: 'zu', per: 'durch', et: 'und', non: 'nicht', sed: 'aber', ubi: 'wo',
      cur: 'warum', quid: 'was', ego: 'ich', tu: 'du', nos: 'wir', vos: 'ihr', 'magnus, -a, -um': 'groß',
      'parvus, -a, -um': 'klein', 'bonus, -a, -um': 'gut', 'malus, -a, -um': 'schlecht', 'longus, -a, -um': 'lang',
      'amat, amant': 'lieben', 'portat, portant': 'tragen', 'dat, dant': 'geben', 'audit, audiunt': 'hören',
      'dormit, dormiunt': 'schlafen', 'venit, veniunt': 'kommen', 'videt, vident': 'sehen', 'est, sunt': 'sein',
      'habet, habent': 'haben', 'tacet, tacent': 'schweigen', hodie: 'heute', semper: 'immer', etiam: 'auch',
    };
    for (const [latin, stem] of Object.entries(gloss)) {
      const word = words.find((w) => w.target === latin);
      expect(word, latin).toBeDefined();
      expect(word?.meanings[0].toLowerCase().includes(stem), latin).toBe(true);
    }
  });
});
