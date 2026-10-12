// Port of LernwerkTests/FrenchCourseTests.swift.
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import { folded, missedKeys, LearnAnswer, type LearnExercise } from '../../src/lib/learn/exercise';
import { coverageGaps, coverageTokens, describeGap } from '../../src/lib/learn/languages/coverage';
import { frenchProvider } from '../../src/lib/learn/languages/courses';
import type { LanguageUnitData } from '../../src/lib/learn/languages/data';
import { LanguageCourseProvider } from '../../src/lib/learn/languages/provider';
import { courseTexts } from '../../src/lib/learn/languages/texts';
import {
  chars, count, dropFirst, firstChar, formsByCard, get, inRange, isPunct, isUpper, lastChar, lettersOnly, range, trimWith,
} from './languageKit';

const made = LanguageCourseProvider.make(courseTexts.fr);
const provider = frenchProvider;
const data = provider.data;
const units = data.units;
const words = units.flatMap((u) => u.words);
const sentences = units.flatMap((u) => u.sentences);
const forms = units.flatMap((u) => u.forms);
const fills = units.flatMap((u) => u.fills);
const facts = units.flatMap((u) => u.facts);

// Independent reference data (typed here again, not read from the course)
const persons = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
const endings: Record<string, string> = { je: 'e', tu: 'es', il: 'e', nous: 'ons', vous: 'ez', ils: 'ent' };
const irregular: Record<string, Record<string, string>> = {
  'être': { je: 'suis', tu: 'es', il: 'est', nous: 'sommes', vous: 'êtes', ils: 'sont' },
  avoir: { je: "j'ai", tu: 'as', il: 'a', nous: 'avons', vous: 'avez', ils: 'ont' },
  aller: { je: 'vais', tu: 'vas', il: 'va', nous: 'allons', vous: 'allez', ils: 'vont' },
  boire: { je: 'bois', tu: 'bois', il: 'boit', nous: 'buvons', vous: 'buvez', ils: 'boivent' },
  "s'appeler": { je: "m'appelle", tu: "t'appelles", il: "s'appelle", nous: 'nous appelons', vous: 'vous appelez', ils: "s'appellent" },
};
const regularVerbs = ['parler', 'habiter', 'aimer', 'écouter', 'regarder', 'travailler', 'jouer', 'manger'];

/** Gender of every noun the course teaches: m, f, or p for a plural noun. */
const nouns: Record<string, string> = {
  'mère': 'f', 'père': 'm', 'frère': 'm', 'sœur': 'f', fils: 'm', fille: 'f', 'grand-père': 'm', 'grand-mère': 'f',
  parents: 'p', chat: 'm', livre: 'm', table: 'f', stylo: 'm', chaise: 'f', cahier: 'm', trousse: 'f',
  sac: 'm', 'école': 'f', ami: 'm', amie: 'f', pain: 'm', eau: 'f', 'café': 'm', fromage: 'm', lait: 'm',
  viande: 'f', pomme: 'f', gare: 'f', parc: 'm', poste: 'f', 'cinéma': 'm', ville: 'f', rue: 'f',
  boulangerie: 'f', maison: 'f', 'français': 'm', allemand: 'm',
};

/** A word of the course and a German stem its first meaning has to contain (lower case). */
const gloss: Record<string, string> = {
  bonjour: 'tag', je: 'ich', salut: 'hallo', tu: 'du', 'ça va': 'geht', merci: 'danke', 'être': 'sein', oui: 'ja',
  nous: 'wir', vous: 'sie', il: 'er', elle: 'sie', 'au revoir': 'wiedersehen',
  avoir: 'haben', 'la mère': 'mutter', 'le père': 'vater', 'mon, ma, mes': 'mein', 'le frère': 'bruder', 'la sœur': 'schwester',
  'ton, ta, tes': 'dein', 'le fils': 'sohn', 'la fille': 'tochter', 'les parents': 'eltern', 'le grand-père': 'großvater',
  'la grand-mère': 'großmutter', 'son, sa, ses': 'seine',
  'le chat': 'katze', deux: 'zwei', ans: 'jahre', trois: 'drei', 'quel âge': 'alt', quatre: 'vier', cinq: 'fünf',
  six: 'sechs', sept: 'sieben', huit: 'acht', neuf: 'neun', dix: 'zehn', rouge: 'rot', bleu: 'blau',
  blanc: 'weiß', noir: 'schwarz',
  'le livre': 'buch', "c'est": 'das ist', 'la table': 'tisch', 'voilà': 'da ist', 'le stylo': 'kugelschreiber', 'la chaise': 'stuhl',
  'le cahier': 'heft', 'la trousse': 'mäppchen', 'le sac': 'tasche', "l'école": 'schule', "l'ami": 'freund', "l'amie": 'freundin',
  parler: 'sprechen', 'le français': 'französisch', habiter: 'wohnen', 'à': 'nach', aimer: 'mögen', beaucoup: 'viel',
  "l'allemand": 'deutsch', bien: 'gut', 'écouter': 'zuhören', regarder: 'anschauen', travailler: 'arbeiten', jouer: 'spielen',
  manger: 'essen', 'le pain': 'brot', boire: 'trinken', "l'eau": 'wasser', 'avoir faim': 'hunger', 'avoir soif': 'durst',
  'le café': 'kaffee', 'le fromage': 'käse', "s'il vous plaît": 'bitte', 'je voudrais': 'möchte', 'le lait': 'milch',
  'la viande': 'fleisch', 'la pomme': 'apfel',
  aller: 'gehen', 'le cinéma': 'kino', 'la gare': 'bahnhof', 'le parc': 'park', dans: 'in', chez: 'bei', 'la poste': 'post',
  'la ville': 'stadt', 'à côté de': 'neben', 'il y a': 'gibt', 'la boulangerie': 'bäckerei', 'la rue': 'straße', 'la maison': 'haus',
  'ne … pas': 'nicht', comment: 'wie', 'où': 'wo', qui: 'wer', quand: 'wann', pourquoi: 'warum', 'parce que': 'weil',
  combien: 'wie viel', 'quelle heure': 'spät', 'et demie': 'halbe', midi: 'zwölf', 'et quart': 'viertel nach',
  'moins le quart': 'viertel vor',
};

const numbers: Record<string, string> = {
  deux: 'zwei', trois: 'drei', quatre: 'vier', cinq: 'fünf', six: 'sechs', sept: 'sieben', huit: 'acht',
  neuf: 'neun', dix: 'zehn', onze: 'elf', douze: 'zwölf', quinze: 'fünfzehn', vingt: 'zwanzig',
};
const colors: Record<string, string> = {
  rouge: 'rot', bleu: 'blau', bleue: 'blau', blanc: 'weiß', blanche: 'weiß', noir: 'schwarz', noire: 'schwarz',
};

// Helpers

/** The words of a French text, lower case, without the punctuation around them; apostrophes inside stay. */
function frenchWords(text: string): string[] {
  return text
    .split(/[\p{White_Space}]+/u)
    .filter((p) => p !== '')
    .map((p) => trimWith(p, (c) => c !== "'" && (isPunct(c) || c === '\t' || /^\p{Zs}$/u.test(c))).toLowerCase())
    .filter((p) => p !== '');
}

function expectedForm(verb: string, person: string): string | undefined {
  const table = get(irregular, verb);
  if (table) return get(table, person);
  const ending = get(endings, person);
  if (!verb.endsWith('er') || ending === undefined) return undefined;
  let stem = chars(verb).slice(0, -2).join('');
  if (person === 'nous' && stem.endsWith('g')) stem += 'e';
  const first = firstChar(stem);
  if (person === 'je' && first !== undefined && 'aeiouéèêàâîôûh'.includes(first)) return "j'" + stem + ending;
  return stem + ending;
}

/** Every text a student reads in French: words, sentences, form answers, fills with their right choice put in. */
const frenchTexts: string[] = [
  ...words.map((w) => w.target), ...sentences.map((s) => s.target), ...forms.flatMap((f) => [...f.answers]),
  ...fills.filter((f) => f.options.length > 0).map((f) => f.sentence.split('___').join(f.options[0])),
];

function negated(sentence: string): string {
  const tokens = sentence.split(' ').filter((p) => p !== '');
  let subject = tokens.shift()!;
  let verb: string;
  if (subject.startsWith("j'")) {
    verb = dropFirst(subject, 2);
    subject = 'je';
  } else {
    verb = tokens.shift()!;
  }
  const vowel = 'aeiouéèêh'.includes(firstChar(verb) ?? 'x');
  const rest = tokens;
  if (rest.length > 0 && ['un', 'une', 'du', 'des'].includes(rest[0])) rest[0] = 'de';
  return [subject, vowel ? "n'" + verb : 'ne ' + verb, 'pas', ...rest].join(' ');
}

describe('French course: shape', () => {
  it('parses and has no content problems', () => {
    expect(made.errors).toEqual([]);
  });

  it('has the header and provider the catalog expects', () => {
    expect(data.id).toBe('fr');
    expect(data.title).toBe('Französisch');
    expect(data.subtitle).toBe('Für Deutschsprachige · A1');
    expect(data.kind).toBe('language');
    expect(data.color).toBe(0x5a7fc4);
    expect(data.symbol).toBe('text.bubble.fill');
    expect(data.speech).toBe('fr-FR');
    expect(data.instruction).toBe('de');
    expect(data.targetName).toBe('Französisch');
    expect(data.intoName).toBe('Französische');
    expect(data.produces).toBe(true);
    expect(provider.course.id).toBe('fr');
    expect(provider.course.units.length).toBe(8);
    expect(provider.course.units.map((u) => u.title)).toEqual(units.map((u) => u.title));
  });

  it('passes the engine audit', () => {
    expect(CourseAudit.problems(provider, range(1, 3).map(BigInt))).toEqual([]);
  });

  it('teaches every word of a sentence before', () => {
    expect(coverageGaps(data).map(describeGap)).toEqual([]);
  });

  it('has the agreed size', () => {
    expect(units.length).toBe(8);
    expect(words.length).toBeGreaterThanOrEqual(100);
    expect(sentences.length).toBeGreaterThanOrEqual(50);
    expect(forms.length).toBeGreaterThanOrEqual(35);
    expect(fills.length).toBeGreaterThanOrEqual(20);
    expect(facts.length).toBeGreaterThanOrEqual(12);
    units.forEach((unit, index) => {
      const place = `unit ${index + 1} ${unit.title}`;
      const itemCount = unit.words.length + unit.sentences.length + unit.forms.length + unit.fills.length + unit.facts.length;
      expect(inRange(itemCount, 22, 30), `${place}: ${itemCount} items`).toBe(true);
      expect(inRange(unit.words.length, 10, 16), `${place}: words`).toBe(true);
      expect(inRange(unit.sentences.length, 6, 10), `${place}: sentences`).toBe(true);
      expect(inRange(unit.forms.length, 3, 6), `${place}: forms`).toBe(true);
      expect(inRange(unit.fills.length, 2, 4), `${place}: fills`).toBe(true);
      expect(inRange(unit.facts.length, 1, 3), `${place}: facts`).toBe(true);
      expect(LanguageCourseProvider.lessonCount(unit), place).toBe(5);
      const tips = unit.tip.split('\n\n');
      expect(inRange(tips.length, 3, 5), `${place}: ${tips.length} tip paragraphs`).toBe(true);
      for (const tip of tips) {
        expect(count(tip), `${place}: a tip paragraph that is too short`).toBeGreaterThan(120);
        expect(count(tip), `${place}: a tip paragraph that is too long`).toBeLessThan(800);
      }
    });
  });

  it('explains every rule-based item', () => {
    for (const f of forms) expect(f.why, `form without explanation: ${f.prompt}`).not.toBe('');
    for (const f of fills) expect(f.why, `fill without explanation: ${f.sentence}`).not.toBe('');
    for (const f of facts) expect(f.why, `fact without explanation: ${f.question}`).not.toBe('');
    for (const item of [...forms.map((f) => f.why), ...fills.map((f) => f.why), ...facts.map((f) => f.why)]) {
      expect(item.endsWith('.'), `an explanation is a sentence: ${item}`).toBe(true);
    }
  });
});

describe('French course: verbs', () => {
  it('has the right form for every person', () => {
    let checked = 0;
    for (const form of forms) {
      const p = form.prompt.split(', ');
      if (p.length !== 2 || !persons.includes(p[1])) continue;
      const expected = expectedForm(p[0], p[1]);
      expect(expected, `a form of a verb the test does not know: ${form.prompt}`).toBeDefined();
      expect(form.answers[0], form.prompt).toBe(expected);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  it('has every verb table of a word note with six persons and the right forms', () => {
    let tables = 0;
    for (const word of words) {
      const colon = word.note.indexOf(':');
      if (colon < 0 || !(word.note.startsWith('unregelmäßig') || word.note.startsWith('Verb auf -er'))) continue;
      const verb = word.target;
      const entries = word.note.slice(colon + 1).split(', ').map((e) => e.trim());
      if (word.note.startsWith('unregelmäßig')) {
        expect(entries.length, `${verb}: a full table has six persons`).toBe(6);
        expect(get(irregular, verb) !== undefined, `${verb} is not in the reference table`).toBe(true);
      }
      for (const entry of entries) {
        let person: string;
        let form: string;
        if (entry.startsWith("j'")) {
          person = 'je';
          form = entry;
        } else {
          const space = entry.indexOf(' ');
          const pieces = space < 0 ? [entry] : [entry.slice(0, space), entry.slice(space + 1)];
          expect(pieces.length, `${verb}: ${entry}`).toBe(2);
          if (pieces.length !== 2) continue;
          [person, form] = pieces;
        }
        expect(form, `${verb}: ${entry}`).toBe(expectedForm(verb, person));
      }
      if (word.note.startsWith('unregelmäßig')) {
        const order = entries.map((e) => (e.startsWith("j'") ? 'je' : e.split(' ')[0]));
        expect(order, `${verb}: the persons come in the usual order`).toEqual(persons);
      }
      tables++;
    }
    expect(tables).toBeGreaterThanOrEqual(7);
  });

  it('shows every drilled verb form in the unit tip', () => {
    units.forEach((unit, index) => {
      for (const form of unit.forms) {
        const p = form.prompt.split(', ');
        if (p.length !== 2 || !persons.includes(p[1]) || form.answers.length === 0) continue;
        expect(unit.tip.includes(form.answers[0]), `unit ${index + 1}: the tip never shows ${form.answers[0]} (${form.prompt})`).toBe(true);
      }
    });
  });
});

describe('French course: derived forms follow the rule the tip teaches', () => {
  it('every derived form follows its rule', () => {
    const numberWords: Record<string, string> = { '11': 'onze', '12': 'douze', '13': 'treize', '14': 'quatorze', '15': 'quinze', '16': 'seize', '20': 'vingt' };
    const feminine: Record<string, string> = { noir: 'noire', blanc: 'blanche', bleu: 'bleue', rouge: 'rouge', vert: 'verte' };
    const seen = new Set<string>();
    for (const form of forms) {
      const comma = form.prompt.indexOf(',');
      if (comma < 0 || form.answers.length === 0) continue;
      const answer = form.answers[0];
      const group = form.prompt.slice(0, comma);
      const subject = form.prompt.slice(comma + 2);
      seen.add(group);
      switch (group) {
        case 'Plural': {
          const noun = subject.startsWith("l'") ? dropFirst(subject, 2) : subject.split(' ').slice(1).join(' ');
          expect(answer, form.prompt).toBe(`les ${noun}s`);
          break;
        }
        case 'weiblich':
          expect(answer, form.prompt).toBe(get(feminine, subject));
          break;
        case 'Teilungsartikel':
          if (subject.startsWith('le ')) expect(answer, form.prompt).toBe('du ' + dropFirst(subject, 3));
          else if (subject.startsWith('la ')) expect(answer, form.prompt).toBe('de la ' + dropFirst(subject, 3));
          else if (subject.startsWith("l'")) expect(answer, form.prompt).toBe("de l'" + dropFirst(subject, 2));
          else expect.fail(`unexpected: ${form.prompt}`);
          break;
        case 'à + Artikel':
          if (subject.startsWith('le ')) expect(answer, form.prompt).toBe('au ' + dropFirst(subject, 3));
          else if (subject.startsWith('la ')) expect(answer, form.prompt).toBe('à la ' + dropFirst(subject, 3));
          else if (subject.startsWith("l'")) expect(answer, form.prompt).toBe("à l'" + dropFirst(subject, 2));
          else if (subject.startsWith('les ')) expect(answer, form.prompt).toBe('aux ' + dropFirst(subject, 4));
          else expect.fail(`unexpected: ${form.prompt}`);
          break;
        case 'Zahl in Worten':
          expect(answer, form.prompt).toBe(get(numberWords, subject));
          break;
        case 'Frage mit est-ce que':
          expect(answer, form.prompt).toBe('est-ce que ' + subject);
          break;
        case 'verneinen':
          expect(answer, form.prompt).toBe(negated(subject));
          break;
        default:
          break;
      }
    }
    for (const group of ['Plural', 'weiblich', 'Teilungsartikel', 'à + Artikel', 'Zahl in Worten', 'Frage mit est-ce que', 'verneinen']) {
      expect(seen.has(group), `no form drills ${group}`).toBe(true);
    }
  });

  it('fills with verbs have exactly the right form for their subject', () => {
    const subjects: Record<string, string> = {
      je: 'je', tu: 'tu', il: 'il', elle: 'il', 'léa': 'il', paul: 'il', 'frère': 'il', 'sœur': 'il',
      nous: 'nous', vous: 'vous', ils: 'ils', elles: 'ils', amis: 'ils', parents: 'ils',
    };
    const byForm = new Map<string, Set<string>>();
    const add = (form: string, person: string) => {
      if (!byForm.has(form)) byForm.set(form, new Set());
      byForm.get(form)!.add(person);
    };
    for (const table of Object.values(irregular)) for (const [person, form] of Object.entries(table)) add(form, person);
    for (const verb of regularVerbs) for (const person of persons) {
      const form = expectedForm(verb, person);
      if (form !== undefined) add(form, person);
    }
    let checked = 0;
    for (const fill of fills) {
      const blank = fill.sentence.indexOf('___');
      if (blank < 0) continue;
      const lastWord = frenchWords(fill.sentence.slice(0, blank)).pop();
      if (lastWord === undefined) continue;
      const person = get(subjects, lastWord);
      if (person === undefined || fill.options.length < 2) continue;
      const right = fill.options[0];
      expect(byForm.get(right)?.has(person) === true, `${fill.sentence}: ${right} does not go with ${lastWord}`).toBe(true);
      const matching = fill.options.filter((o) => byForm.get(o)?.has(person) === true);
      if (matching.length === 1) expect(matching, `${fill.sentence}: a wrong choice also fits ${lastWord}`).toEqual([right]);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(12);
  });
});

describe('French course: nouns, genders, agreement', () => {
  it('gives every noun its gender note and an article that agrees', () => {
    let checked = 0;
    for (const word of words) {
      const target = word.target;
      let article: string;
      let noun: string;
      const space = target.indexOf(' ');
      if (target.startsWith("l'")) {
        article = "l'";
        noun = dropFirst(target, 2);
      } else if (space >= 0 && ['le', 'la', 'les'].includes(target.slice(0, space))) {
        article = target.slice(0, space);
        noun = target.slice(space + 1);
      } else continue;
      const gender = get(nouns, noun);
      expect(gender, `a noun the test does not know: ${target}`).toBeDefined();
      if (gender === undefined) continue;
      const note = (word.note.split(';')[0] ?? '').trim();
      if (gender === 'm') {
        expect(note, target).toBe('m');
        expect(article === 'le' || article === "l'", `${target} is masculine`).toBe(true);
      } else if (gender === 'f') {
        expect(note, target).toBe('f');
        expect(article === 'la' || article === "l'", `${target} is feminine`).toBe(true);
      } else {
        expect(note, target).toBe('Plural');
        expect(article).toBe('les');
      }
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(35);
  });

  it('teaches no noun without its article', () => {
    for (const word of words) expect(get(nouns, word.target), `${word.target} is taught without its article`).toBeUndefined();
  });

  it('lets possessives and articles agree with their nouns in every text', () => {
    const masculine = new Set(Object.entries(nouns).filter(([, v]) => v === 'm').map(([k]) => k));
    const feminine = new Set(Object.entries(nouns).filter(([, v]) => v === 'f').map(([k]) => k));
    const vowels = 'aeiouéèêh';
    for (const text of frenchTexts) {
      const tokens = frenchWords(text);
      tokens.slice(0, -1).forEach((token, index) => {
        const next = tokens[index + 1];
        switch (token) {
          case 'ma': case 'ta': case 'sa':
            expect(vowels.includes(firstChar(next) ?? 'x'), `${text}: before a vowel it is mon/ton/son`).toBe(false);
            expect(masculine.has(next), `${text}: ${token} before masculine ${next}`).toBe(false);
            break;
          case 'mon': case 'ton': case 'son':
            expect(feminine.has(next) && !vowels.includes(firstChar(next) ?? 'x'), `${text}: ${token} before feminine ${next}`).toBe(false);
            break;
          case 'un':
            expect(feminine.has(next), `${text}: un before feminine ${next}`).toBe(false);
            break;
          case 'une':
            expect(masculine.has(next), `${text}: une before masculine ${next}`).toBe(false);
            break;
          default:
            break;
        }
      });
    }
  });
});

describe('French course: spelling, elision, contractions', () => {
  it('has no broken elision or contraction', () => {
    const vowelStart = 'aeiouéèêâîôûàh';
    for (const text of frenchTexts) {
      const tokens = frenchWords(text);
      tokens.forEach((token, index) => {
        if (index + 1 >= tokens.length) return;
        const next = tokens[index + 1];
        if (['je', 'ne', 'me', 'te', 'se', 'le', 'la', 'de', 'que', 'ce', 'si'].includes(token) && vowelStart.includes(firstChar(next) ?? 'x')) {
          expect.fail(`${text}: ${token} ${next} needs an apostrophe`);
        }
        if (token === 'de' && (next === 'le' || next === 'les')) expect.fail(`${text}: de ${next} is du/des`);
        if (token === 'à' && (next === 'le' || next === 'les')) expect.fail(`${text}: à ${next} is au/aux`);
      });
      expect(text.includes('’'), `${text}: use the plain apostrophe so that typing works`).toBe(false);
      expect(text.includes('  '), `${text}: double space`).toBe(false);
    }
  });

  it('misses no accent', () => {
    const unaccented = new Set([
      'etre', 'pere', 'mere', 'frere', 'soeur', 'cafe', 'ecole', 'voila', 'cinema', 'age', 'francais', 'plait', 'ecoute',
      'ecouter', 'ecoutons', 'cote', 'ca', 'lecole', 'meme', 'ete', 'deja', 'tres', 'apres', 'bientot', 'grandpere',
      'grandmere', 'lecole',
    ]);
    for (const text of [...frenchTexts, ...fills.flatMap((f) => [...f.options])]) {
      for (const token of lettersOnly(text)) if (unaccented.has(token)) expect.fail(`${text}: ${token} needs its accent`);
    }
  });

  it('keeps sentences short, well formed and ending in punctuation', () => {
    for (const sentence of sentences) {
      const n = frenchWords(sentence.target).length;
      expect(n, `${sentence.target}: ${n} words`).toBeLessThanOrEqual(8);
      expect(isUpper(firstChar(sentence.target)), sentence.target).toBe(true);
      expect('.?!'.includes(lastChar(sentence.target) ?? 'x'), sentence.target).toBe(true);
      if (sentence.target.endsWith(' ?') || sentence.target.endsWith(' !')) continue;
      expect(sentence.target.endsWith('?') || sentence.target.endsWith('!'), `French puts a space before ? and !: ${sentence.target}`).toBe(false);
    }
  });

  it('repeats no sentence across the course', () => {
    const seen = new Set<string>();
    for (const sentence of sentences) {
      const f = folded(sentence.target);
      expect(seen.has(f), `repeated: ${sentence.target}`).toBe(false);
      seen.add(f);
    }
    const answers = new Set(forms.flatMap((f) => [...f.answers]).map(folded));
    for (const sentence of sentences) expect(answers.has(folded(sentence.target)), `a form answer is also a sentence: ${sentence.target}`).toBe(false);
  });
});

describe('French course: German side', () => {
  it('has no leftover French and matches in punctuation', () => {
    const frenchOnlyLetters = new Set(chars('àâçèêëîïôùûœ'));
    const frenchFunctionWords = new Set([
      'le', 'la', 'les', 'un', 'une', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'est', 'et', 'de', 'pas', 'ne',
      'au', 'aux', 'dans', 'chez', 'sont', 'suis', 'oui', 'non', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'sa', 'ses',
      'merci', 'bonjour', 'salut', 'voilà', 'c', 'j', 'l', 'qu',
    ]);
    const names = ['Léa', 'Léas'];
    const check = (meaning: string, context: string) => {
      let text = meaning;
      for (const name of names) text = text.split(name).join('');
      expect(chars(text).filter((c) => frenchOnlyLetters.has(c)), `${context}: French letters in the German: ${meaning}`).toEqual([]);
      expect(meaning, context).toBe(trimWith(meaning, (c) => c === '\t' || /^\p{Zs}$/u.test(c)));
      for (const token of lettersOnly(text)) {
        if (frenchFunctionWords.has(token)) expect.fail(`${context}: leftover French word "${token}" in ${meaning}`);
      }
    };
    for (const sentence of sentences) {
      for (const meaning of sentence.meanings) {
        check(meaning, sentence.target);
        expect(lastChar(meaning), `${sentence.target} / ${meaning}: the sentence ends the same way`).toBe(lastChar(sentence.target));
      }
    }
    for (const word of words) for (const meaning of word.meanings) if (!meaning.startsWith('Viertel')) check(meaning, word.target);
  });

  it('lets the subject of a sentence survive translation', () => {
    const german: Record<string, string[]> = { je: ['ich'], j: ['ich'], tu: ['du'], nous: ['wir'], vous: ['sie', 'ihr'] };
    let checked = 0;
    for (const sentence of sentences) {
      const first = lettersOnly(sentence.target)[0] ?? '';
      const expected = get(german, first);
      const meaning = sentence.meanings[0];
      if (expected === undefined || meaning === undefined) continue;
      expect(lettersOnly(meaning).some((w) => expected.includes(w)), `${sentence.target} / ${meaning}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  it('translates numbers and colors with the right word', () => {
    let checked = 0;
    for (const sentence of sentences) {
      const meaning = sentence.meanings[0]?.toLowerCase();
      if (meaning === undefined) continue;
      for (const token of lettersOnly(sentence.target)) {
        const number = get(numbers, token);
        if (number !== undefined) { expect(meaning.includes(number), `${sentence.target} / ${meaning}`).toBe(true); checked++; }
        const color = get(colors, token);
        if (color !== undefined) { expect(meaning.includes(color), `${sentence.target} / ${meaning}`).toBe(true); checked++; }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(8);
    for (const word of words) {
      const number = get(numbers, word.target);
      if (number !== undefined) expect(word.meanings[0]).toBe(number);
      const color = get(colors, word.target);
      if (color !== undefined) expect(word.meanings[0]).toBe(color);
    }
  });

  it('has the German key word in every first meaning', () => {
    for (const word of words) {
      const stem = get(gloss, word.target);
      expect(stem, `a word the test has no gloss for: ${word.target}`).toBeDefined();
      if (stem === undefined) continue;
      expect(word.meanings[0]?.toLowerCase().includes(stem), `${word.target}: ${word.meanings}`).toBe(true);
    }
    expect(Object.keys(gloss).length, 'the reference list and the course list the same words').toBe(words.length);
  });

  it('says age with avoir and counts time the French way', () => {
    for (const sentence of sentences.filter((s) => lettersOnly(s.target).includes('ans'))) {
      const tokens = lettersOnly(sentence.target);
      expect(tokens.includes('suis') || tokens.includes('est'), sentence.target).toBe(false);
      expect(sentence.meanings[0].includes('Jahre alt'), sentence.meanings[0]).toBe(true);
    }
    const demie = facts.find((f) => f.question.includes('trois heures et demie'));
    expect(demie?.answer).toBe('3:30 Uhr');
    expect(facts.filter((f) => f.question.includes('trois heures et demie')).length).toBe(1);
  });
});

describe('French course: fills and facts', () => {
  it('has one blank and distinct choices in every fill', () => {
    for (const fill of fills) {
      expect(fill.sentence.split('___').length, fill.sentence).toBe(2);
      expect(inRange(fill.options.length, 2, 4), fill.sentence).toBe(true);
      expect(new Set(fill.options.map(folded)).size, `${fill.sentence}: choices that read the same`).toBe(fill.options.length);
      for (const text of fill.options.slice(1).map((o) => fill.sentence.split('___').join(o))) {
        expect(sentences.some((s) => folded(s.target) === folded(text)), `a wrong choice is a sentence of the course: ${text}`).toBe(false);
      }
    }
  });

  it('has distinct answers in every fact', () => {
    for (const fact of facts) {
      const all = [fact.answer, ...fact.wrong];
      expect(inRange(all.length, 2, 4), fact.question).toBe(true);
      expect(new Set(all.map(folded)).size, `${fact.question}: answers that read the same`).toBe(all.length);
    }
  });
});

describe('French course: teaching order and the engine', () => {
  /** Which lesson (0 based) teaches an item, worked out as the engine cuts a unit. */
  function lesson(index: number, kind: number, unit: LanguageUnitData): number {
    const counts = [unit.words.length, unit.sentences.length, unit.forms.length, unit.fills.length, unit.facts.length];
    const all: Array<{ position: number; order: number; kind: number; index: number }> = [];
    counts.forEach((c, order) => { for (let i = 0; i < c; i++) all.push({ position: (i + 0.5) / c, order, kind: order, index: i }); });
    all.sort((a, b) => (a.position !== b.position ? a.position - b.position : a.order - b.order));
    const lessons = LanguageCourseProvider.lessonCount(unit);
    const place = Math.max(0, all.findIndex((e) => e.kind === kind && e.index === index));
    const found = range(0, lessons - 1).find((l) => place < Math.floor((all.length * (l + 1)) / lessons));
    return found ?? lessons - 1;
  }

  it('lets a sentence only use words taught in its lesson or earlier', () => {
    let known = new Set<string>();
    for (const unit of units) {
      const lessons = LanguageCourseProvider.lessonCount(unit);
      const taught: Array<Set<string>> = Array.from({ length: lessons }, () => new Set<string>());
      unit.words.forEach((w, i) => coverageTokens(w.target).forEach((t) => taught[lesson(i, 0, unit)].add(t)));
      unit.forms.forEach((f, i) => f.answers.flatMap(coverageTokens).forEach((t) => taught[lesson(i, 2, unit)].add(t)));
      unit.fills.forEach((f, i) => { if (f.options.length > 0) coverageTokens(f.options[0]).forEach((t) => taught[lesson(i, 3, unit)].add(t)); });
      const unitKnown = new Set(unit.known.flatMap(coverageTokens));
      unit.sentences.forEach((sentence, i) => {
        const place = lesson(i, 1, unit);
        const available = new Set([...known, ...unitKnown]);
        for (let l = 0; l <= place; l++) taught[l].forEach((t) => available.add(t));
        const late = coverageTokens(sentence.target).filter((t) => !available.has(t));
        expect(late, `${unit.title}, lesson ${place + 1}: ${sentence.target} uses words taught later`).toEqual([]);
      });
      known = new Set([...known, ...unitKnown]);
      for (const tokens of taught) tokens.forEach((t) => known.add(t));
    }
  });

  it('meets the student with every word and sentence in at least three forms within the unit', () => {
    units.forEach((unit, index) => {
      const seen = formsByCard(provider, index, [1, 2, 3, 4]);
      unit.words.forEach((w, i) => expect(seen.get(`w${index}-${i}`)?.size ?? 0, `${w.target}`).toBeGreaterThanOrEqual(3));
      unit.sentences.forEach((s, i) => expect(seen.get(`s${index}-${i}`)?.size ?? 0, `${s.target}`).toBeGreaterThanOrEqual(3));
      unit.forms.forEach((f, i) => expect(seen.get(`f${index}-${i}`)?.size ?? 0, f.prompt).toBeGreaterThanOrEqual(2));
    });
  });

  it('forgives accents and apostrophes in typed French but not letters', () => {
    const typed = (answer: string, unit: number): LearnExercise => {
      const node = provider.course.nodes.find((n) => n.id === `fr.u${String(unit).padStart(2, '0')}.t`)!;
      const pool: LearnExercise[] = [];
      for (let seed = 1; seed <= 80; seed++) pool.push(...provider.exercises(node, BigInt(seed)));
      const found = pool.find((e) => e.kind === 'typeAnswer' && e.mode === 'exact' && e.correctAnswers.length === 1 && e.correctAnswers[0] === answer);
      expect(found, answer).toBeDefined();
      return found!;
    };
    const miss = (e: LearnExercise, text: string) => missedKeys(e, LearnAnswer.typed(text)).size;
    const etes = typed('êtes', 1);
    expect(miss(etes, 'etes')).toBe(0);
    expect(miss(etes, 'Êtes')).toBe(0);
    expect(miss(etes, 'êtez')).not.toBe(0);
    const jai = typed("j'ai", 2);
    expect(miss(jai, "j'ai")).toBe(0);
    expect(miss(jai, 'jai')).toBe(0);
    expect(miss(jai, 'je ai')).not.toBe(0);
    const sentence = typed('Je vais à la gare.', 7);
    expect(miss(sentence, 'je vais a la gare')).toBe(0);
    expect(miss(sentence, 'je vais a la garage')).not.toBe(0);
    expect(miss(sentence, 'a la gare je vais'), 'word order matters').not.toBe(0);
  });

  it('uses the French voice for every spoken exercise', () => {
    let spoken = 0;
    for (const node of provider.course.nodes) {
      if (node.kind === 'chest') continue;
      for (const exercise of provider.exercises(node, 3n)) {
        if (exercise.media?.type === 'speech') {
          expect(exercise.media.language).toBe('fr-FR');
          expect(exercise.media.text).not.toBe('');
          spoken++;
        }
      }
    }
    expect(spoken).toBeGreaterThan(100);
  });

  it('gives the same lesson for the same seed and brings earlier units back in practice', () => {
    const lessonNode = provider.course.nodes.find((n) => n.id === 'fr.u03.l2')!;
    expect(provider.exercises(lessonNode, 5n)).toEqual(provider.exercises(lessonNode, 5n));
    const practice = provider.course.nodes.find((n) => n.id === 'fr.u06.p')!;
    const ids: string[] = [];
    for (let seed = 1; seed <= 10; seed++) ids.push(...provider.exercises(practice, BigInt(seed)).map((e) => e.id));
    expect(ids.some((id) => id.includes('#w5-') || id.includes('#s5-'))).toBe(true);
    expect(ids.some((id) => ['#w0-', '#w1-', '#s0-', '#s1-', '#w2-', '#w3-', '#w4-'].some((m) => id.includes(m)))).toBe(true);
  });
});
