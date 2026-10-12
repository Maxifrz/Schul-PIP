// Port of LernwerkTests/GermanCourseTests.swift (the school course Deutsch).
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import { folded } from '../../src/lib/learn/exercise';
import { germanSchoolProvider } from '../../src/lib/learn/languages/courses';
import { LanguageCourseProvider } from '../../src/lib/learn/languages/provider';
import { courseTexts } from '../../src/lib/learn/languages/texts';
import { chars, count, dropFirst, dropLast, firstChar, get, inRange, isUpper, range, suffix } from './languageKit';

const source = courseTexts.de;
const made = LanguageCourseProvider.make(source);
const provider = made.provider;
const units = provider.data.units;
const words = units.flatMap((u) => u.words);
const forms = units.flatMap((u) => u.forms);
const fills = units.flatMap((u) => u.fills);
const facts = units.flatMap((u) => u.facts);
const itemCount = (u: (typeof units)[number]) => u.words.length + u.sentences.length + u.forms.length + u.fills.length + u.facts.length;

describe('Deutsch (school) course: engine checks', () => {
  it('parses without errors', () => {
    expect(made.errors).toEqual([]);
    expect(provider.data.kind).toBe('school');
    expect(provider.data.id).toBe('de');
    expect(provider.data.title).toBe('Deutsch');
    expect(provider.data.instruction).toBe('de');
  });

  it('needs no coverage and has no sentences', () => {
    expect(units.every((u) => u.sentences.length === 0)).toBe(true);
  });

  it('passes the audit', () => {
    expect(CourseAudit.problems(provider, range(1, 4).map(BigInt))).toEqual([]);
    expect(CourseAudit.problems(germanSchoolProvider, [1n, 2n])).toEqual([]);
  });

  it('has the minimum counts', () => {
    expect(units.length).toBeGreaterThanOrEqual(10);
    expect(words.length).toBeGreaterThanOrEqual(80);
    expect(forms.length).toBeGreaterThanOrEqual(40);
    expect(fills.length).toBeGreaterThanOrEqual(90);
    expect(facts.length).toBeGreaterThanOrEqual(60);
  });

  it('gives every unit the right size', () => {
    units.forEach((unit, index) => {
      const place = `unit ${index + 1} ${unit.title}`;
      expect(inRange(itemCount(unit), 22, 30), `${place}: ${itemCount(unit)} items`).toBe(true);
      expect(inRange(unit.words.length, 6, 10), `${place}: terms`).toBe(true);
      expect(inRange(unit.fills.length, 6, 10), `${place}: fills`).toBe(true);
      expect(inRange(unit.facts.length, 4, 8), `${place}: facts`).toBe(true);
      expect(inRange(unit.forms.length, 3, 6), `${place}: forms`).toBe(true);
      const tips = unit.tip.split('\n\n');
      expect(inRange(tips.length, 3, 5), `${place}: ${tips.length} tips`).toBe(true);
      for (const tip of tips) expect(count(tip), `${place}: a tip is too short`).toBeGreaterThan(100);
    });
  });
});

describe('Deutsch (school) course: shape of the text', () => {
  it('explains every fill and fact and has sound choices', () => {
    for (const fill of fills) {
      expect(fill.why, fill.sentence).not.toBe('');
      expect(fill.sentence.split('___').length, `one blank: ${fill.sentence}`).toBe(2);
      const f = fill.options.map(folded);
      expect(new Set(f).size, `options that read the same: ${fill.sentence}`).toBe(f.length);
      expect(inRange(fill.options.length, 2, 4), fill.sentence).toBe(true);
    }
    for (const fact of facts) {
      expect(fact.why, fact.question).not.toBe('');
      const all = [fact.answer, ...fact.wrong];
      expect(new Set(all.map(folded)).size, `options that read the same: ${fact.question}`).toBe(all.length);
      expect(inRange(all.length, 2, 4), fact.question).toBe(true);
    }
    for (const form of forms) expect(form.why, form.prompt).not.toBe('');
  });

  it('has no term definition that contains its own term', () => {
    for (const word of words) {
      const term = folded(word.target);
      expect(word.meanings.length, word.target).not.toBe(0);
      for (const meaning of word.meanings) expect(folded(meaning).includes(term), `${word.target} is in its definition`).toBe(false);
    }
  });

  it('has no old spelling and no straight quotes', () => {
    for (const old of ['daß', 'muß', 'läßt', 'Fluß', 'Kuß', 'Schloß', 'bißchen', 'Gemse', 'Stengel']) expect(source.includes(old), old).toBe(false);
    expect(source.includes('"'), 'use the German quotation marks').toBe(false);
    expect(source.includes('  '), 'double spaces').toBe(false);
  });

  it('asks no question or fill twice', () => {
    const questions = facts.map((f) => folded(f.question + f.answer));
    expect(new Set(questions).size).toBe(questions.length);
    const sentences = fills.map((f) => folded(f.sentence));
    expect(new Set(sentences).size).toBe(sentences.length);
    const prompts = forms.map((f) => folded(f.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);
  });
});

describe('Deutsch (school) course: content against tables typed here', () => {
  it('unit 1: das or dass fills', () => {
    const expected: Record<string, string> = {
      'Ich weiß, ___ du kommst.': 'dass', '___ Buch liegt auf dem Tisch.': 'Das',
      'Das Kind, ___ dort steht, ist mein Bruder.': 'das', 'Er sagt, ___ es regnet.': 'dass',
      'Das ist das Haus, ___ wir kaufen wollen.': 'das', 'Ich hoffe, ___ wir gewinnen.': 'dass',
      '___ er schon da ist, freut mich.': 'Dass', 'Sie hat das Fahrrad, ___ ich mir wünsche.': 'das',
      'Es ist schön, ___ du da bist.': 'dass', 'Wir wissen, ___ ihr Hilfe braucht.': 'dass',
    };
    expect(units[0].fills.length).toBe(Object.keys(expected).length);
    for (const fill of units[0].fills) expect(get(expected, fill.sentence), fill.sentence).toBe(fill.options[0]);
    for (const fill of units[0].fills) if (fill.options[0]?.toLowerCase() === 'dass') expect(fill.why.includes('dass'), fill.sentence).toBe(true);
  });

  it('unit 1: relative pronouns follow the gender of their noun', () => {
    const gender: Record<string, string> = { 'das Mädchen': 'das', 'der Mann': 'der', 'die Frau': 'die' };
    expect(units[0].forms.length).toBe(3);
    for (const form of units[0].forms) {
      const noun = form.prompt.split(', ').pop() ?? '';
      expect(get(gender, noun), form.prompt).toBe(form.answers[0]);
    }
  });

  it('unit 2: nominalisation suffixes', () => {
    for (const form of units[1].forms) {
      const parts = form.prompt.split(', Nomen auf -');
      expect(parts.length, form.prompt).toBe(2);
      const [base, suf] = parts;
      const answer = form.answers[0];
      expect(answer.endsWith(suf), `${answer} should end in ${suf}`).toBe(true);
      expect(isUpper(firstChar(answer)), `${answer} is a noun`).toBe(true);
      const stem = base.endsWith('en') ? dropLast(base, 2) : base;
      expect(answer.toLowerCase().startsWith(stem), `${answer} comes from ${base}`).toBe(true);
    }
    for (const fill of units[1].fills) {
      const rest = fill.sentence.split('___')[0].split(' ').filter((p) => p !== '').pop() ?? '';
      const word = rest + fill.options[0];
      expect(isUpper(firstChar(word)), `the filled word ${word} is a noun`).toBe(true);
      expect(['schaft', 'heit', 'keit', 'nis'].includes(fill.options[0]), fill.sentence).toBe(true);
      expect(['Freundschaft', 'Krankheit', 'Höflichkeit', 'Gedächtnis', 'Verständnis', 'Heiterkeit'].includes(word), word).toBe(true);
    }
  });

  it('unit 3: s sounds', () => {
    const table: Record<string, string> = { 'essen, Präteritum ich': 'aß', 'lesen, Präteritum ich': 'las', 'wissen, Präsens ich': 'weiß', 'fließen, Präteritum es': 'floss' };
    for (const form of units[2].forms) expect(get(table, form.prompt), form.prompt).toBe(form.answers[0]);
    expect(units[2].forms.length).toBe(Object.keys(table).length);
    const withEsszet = ['Fuß', 'Gruß', 'Straße', 'heißen', 'draußen', 'groß'];
    const withDoubleS = ['Fluss', 'Wasser', 'wissen', 'müssen', 'Rasse', 'Gasse', 'Fass', 'muss'];
    for (const fact of units[2].facts) {
      if (fact.question.startsWith('Welches Wort wird mit ß')) {
        expect(withEsszet.includes(fact.answer), fact.question).toBe(true);
        expect(fact.wrong.every((w) => withDoubleS.includes(w)), fact.question).toBe(true);
      }
      if (fact.question.startsWith('Welches Wort wird mit ss')) {
        expect(withDoubleS.includes(fact.answer), fact.question).toBe(true);
        expect(fact.wrong.every((w) => withEsszet.includes(w)), fact.question).toBe(true);
      }
    }
  });

  it('unit 4: plural forms', () => {
    const plural: Record<string, string> = {
      'der Baum': 'die Bäume', 'der Zahn': 'die Zähne', 'die Hand': 'die Hände', 'der Hals': 'die Hälse',
      'die Metapher': 'die Metaphern', 'die Hyperbel': 'die Hyperbeln', 'die Alliteration': 'die Alliterationen',
      'der Vergleich': 'die Vergleiche', 'das Gedicht': 'die Gedichte', 'der Vers': 'die Verse',
      'die Strophe': 'die Strophen', 'das Drama': 'die Dramen',
    };
    let seen = 0;
    for (const form of forms) {
      if (!form.prompt.endsWith(', Plural')) continue;
      const noun = form.prompt.split(', Plural').join('');
      expect(get(plural, noun), form.prompt).toBe(form.answers[0]);
      seen++;
    }
    expect(seen).toBe(Object.keys(plural).length);
  });

  it('unit 5: zu infinitive', () => {
    const separable = ['auf', 'mit', 'an', 'ab', 'aus', 'ein'];
    for (const form of units[4].forms) {
      const verb = form.prompt.split(', ').pop() ?? '';
      const prefix = separable.find((p) => verb.startsWith(p));
      const expected = prefix !== undefined ? prefix + 'zu' + dropFirst(verb, count(prefix)) : 'zu ' + verb;
      expect(form.answers[0], form.prompt).toBe(expected);
    }
  });

  it('unit 6: comparison', () => {
    const table: Record<string, string> = {
      'schnell, Komparativ': 'schneller', 'schnell, Superlativ': 'am schnellsten', 'gut, Komparativ': 'besser',
      'gut, Superlativ': 'am besten', 'hoch, Komparativ': 'höher',
    };
    for (const form of units[5].forms) expect(get(table, form.prompt), form.prompt).toBe(form.answers[0]);
    expect(units[5].forms.length).toBe(Object.keys(table).length);
    for (const form of units[5].forms) {
      if (!form.prompt.endsWith('Superlativ')) continue;
      expect(form.answers.some((a) => a.startsWith('am ')), form.prompt).toBe(true);
      expect(form.answers.some((a) => !a.startsWith('am ')), 'the bare form is accepted too').toBe(true);
    }
  });

  it('unit 7: cases', () => {
    const articles: Record<string, Record<string, string>> = {
      der: { Nominativ: 'der', Genitiv: 'des', Dativ: 'dem', Akkusativ: 'den' },
      die: { Nominativ: 'die', Genitiv: 'der', Dativ: 'der', Akkusativ: 'die' },
      das: { Nominativ: 'das', Genitiv: 'des', Dativ: 'dem', Akkusativ: 'das' },
    };
    for (const form of units[6].forms) {
      const parts = form.prompt.split(', ');
      expect(parts.length, form.prompt).toBe(2);
      const noun = parts[0].split(' ').filter((p) => p !== '');
      const [article, stem] = noun;
      const caseName = parts[1];
      const wanted = get(articles, article)?.[caseName];
      for (const answer of form.answers) {
        const w = answer.split(' ').filter((p) => p !== '');
        expect(w.length, answer).toBe(2);
        expect(w[0], answer).toBe(wanted);
        if (caseName === 'Genitiv' && article !== 'die') expect(w[1] === stem + 'es' || w[1] === stem + 's', answer).toBe(true);
        else expect(w[1], answer).toBe(stem);
      }
    }
    expect(units[6].forms.length).toBe(5);
    const expected: Record<string, string> = {
      'Ich gebe ___ Kind einen Apfel.': 'dem', 'Er sieht ___ Hund im Garten.': 'den',
      'Wir fahren mit ___ Bus zur Schule.': 'dem', 'Das ist das Auto ___ Lehrers.': 'des',
      'Sie wartet auf ___ Zug.': 'den', 'Ich danke ___ für die Hilfe.': 'dir',
      'Wegen ___ Regens fällt das Spiel aus.': 'des', 'Er hilft ___ Freundin bei den Hausaufgaben.': 'seiner',
    };
    expect(units[6].fills.length).toBe(Object.keys(expected).length);
    for (const fill of units[6].fills) expect(get(expected, fill.sentence), fill.sentence).toBe(fill.options[0]);
    const accusative = ['für', 'durch', 'gegen', 'ohne', 'um'];
    const dative = ['mit', 'aus', 'bei', 'nach', 'von', 'zu', 'seit'];
    const genitive = ['wegen', 'trotz', 'während', 'statt'];
    for (const fact of units[6].facts) {
      if (fact.question.startsWith('Welcher Fall folgt auf')) {
        const preposition = fact.question.split('„')[1].split('“')[0];
        const exp = accusative.includes(preposition) ? 'Akkusativ' : dative.includes(preposition) ? 'Dativ' : genitive.includes(preposition) ? 'Genitiv' : '?';
        expect(fact.answer, preposition).toBe(exp);
      }
      if (fact.question.startsWith('Welche Präposition verlangt den Genitiv')) {
        expect(genitive.includes(fact.answer)).toBe(true);
        expect(fact.wrong.every((w) => !genitive.includes(w))).toBe(true);
      }
    }
  });

  it('unit 8: tenses', () => {
    const stems: Record<string, { past: string; participle: string; aux: string }> = {
      gehen: { past: 'ging', participle: 'gegangen', aux: 'sein' }, bringen: { past: 'brachte', participle: 'gebracht', aux: 'haben' },
      schreiben: { past: 'schrieb', participle: 'geschrieben', aux: 'haben' }, lesen: { past: 'las', participle: 'gelesen', aux: 'haben' },
      kommen: { past: 'kam', participle: 'gekommen', aux: 'sein' },
    };
    for (const form of units[7].forms) {
      const parts = form.prompt.split(', ');
      const [verb, tense] = parts;
      const answer = form.answers[0];
      const entry = get(stems, verb);
      if (!entry) { expect.fail(form.prompt); return; }
      switch (tense) {
        case 'Präteritum ich': expect(answer, form.prompt).toBe(entry.past); break;
        case 'Partizip II': expect(answer, form.prompt).toBe(verb === 'bringen' ? 'gebracht' : entry.participle); break;
        case 'Perfekt ich': expect(answer, form.prompt).toBe((entry.aux === 'sein' ? 'bin ' : 'habe ') + entry.participle); break;
        case 'Plusquamperfekt ich': expect(answer, form.prompt).toBe((entry.aux === 'sein' ? 'war ' : 'hatte ') + entry.participle); break;
        default: expect.fail(`unknown tense ${tense}`);
      }
    }
    for (const fill of units[7].fills) {
      const sentence = fill.sentence.split('___').join(fill.options[0]);
      if (sentence.includes('gefahren')) expect(fill.options[0]).toBe('sind');
      if (sentence.includes('geschlafen') || sentence.includes('gelesen') || sentence.includes('gemacht')) {
        expect(['habe', 'hat'].includes(fill.options[0]), sentence).toBe(true);
      }
    }
  });

  it('unit 9: Konjunktiv', () => {
    const table: Record<string, string> = {
      'sein, Konjunktiv I er': 'sei', 'sein, Konjunktiv II ich': 'wäre', 'haben, Konjunktiv II ich': 'hätte',
      'kommen, Konjunktiv II ich': 'käme', 'werden, Konjunktiv II ich': 'würde', 'können, Konjunktiv II ich': 'könnte',
    };
    for (const form of units[8].forms) expect(get(table, form.prompt), form.prompt).toBe(form.answers[0]);
    expect(units[8].forms.length).toBe(Object.keys(table).length);
    for (const form of units[8].forms) {
      if (form.prompt.includes('Konjunktiv II')) expect(chars(form.answers[0]).some((c) => 'äöü'.includes(c)), form.prompt).toBe(true);
    }
    for (const fill of units[8].fills) {
      expect(fill.sentence.startsWith('Konjunktiv I:') || fill.sentence.startsWith('Konjunktiv II:'), fill.sentence).toBe(true);
      const first = fill.options[0];
      if (fill.sentence.startsWith('Konjunktiv I:')) expect(['sei', 'seien', 'habe'].includes(first), fill.sentence).toBe(true);
      else expect(['hätte', 'wäre', 'Könntest'].includes(first), fill.sentence).toBe(true);
    }
  });

  it('units 10 and 11: terms and rhyme schemes', () => {
    const terms = new Set(units[9].words.map((w) => w.target));
    for (const fill of units[9].fills) for (const option of fill.options) expect(terms.has(option), `${option} is not a term of the unit`).toBe(true);
    const letters: Record<string, string> = { Paarreim: 'aabb', Kreuzreim: 'abab' };
    for (const word of units[10].words) if (get(letters, word.target) !== undefined) expect(word.note).toBe(letters[word.target]);
    for (const fill of units[10].fills) {
      if (!fill.sentence.startsWith('Reimschema')) continue;
      const line = fill.sentence.split('„')[1].split('“')[0];
      const w = line.split(', ');
      expect(w.length).toBe(4);
      const devoiced = (word: string): string => {
        let text = word.toLowerCase();
        if (text.endsWith('d')) text = dropLast(text) + 't';
        if (text.endsWith('g')) text = dropLast(text) + 'k';
        return text;
      };
      const rhymes = (a: string, b: string): boolean => suffix(devoiced(a), 2) === suffix(devoiced(b), 2);
      const scheme = rhymes(w[0], w[1]) && rhymes(w[2], w[3]) ? 'Paarreim' : rhymes(w[0], w[2]) && rhymes(w[1], w[3]) ? 'Kreuzreim' : '?';
      expect(fill.options[0], fill.sentence).toBe(scheme);
    }
  });
});
