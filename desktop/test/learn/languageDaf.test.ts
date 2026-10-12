// Port of LernwerkTests/DafCourseTests.swift (German for English speakers).
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import { folded } from '../../src/lib/learn/exercise';
import { coverageGaps, describeGap } from '../../src/lib/learn/languages/coverage';
import { germanForeignProvider } from '../../src/lib/learn/languages/courses';
import type { LanguageForm } from '../../src/lib/learn/languages/data';
import { LanguageCourseProvider } from '../../src/lib/learn/languages/provider';
import { courseTexts } from '../../src/lib/learn/languages/texts';
import { chars, count, dropLast, firstChar, get, inRange, isPunct, isUpper, lastChar, range, trimWith } from './languageKit';

const source = courseTexts.daf;
const made = LanguageCourseProvider.make(source);
const provider = made.provider;
const data = provider.data;
const units = data.units;
const words = units.flatMap((u) => u.words);
const sentences = units.flatMap((u) => u.sentences);
const forms = units.flatMap((u) => u.forms);
const fills = units.flatMap((u) => u.fills);
const facts = units.flatMap((u) => u.facts);
const itemCount = (u: (typeof units)[number]) => u.words.length + u.sentences.length + u.forms.length + u.fills.length + u.facts.length;

const persons = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];
const irregular: Record<string, string[]> = {
  sein: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'],
  haben: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'],
  essen: ['esse', 'isst', 'isst', 'essen', 'esst', 'essen'],
  'möchten': ['möchte', 'möchtest', 'möchte', 'möchten', 'möchtet', 'möchten'],
};
const regularVerbs = ['heißen', 'trinken', 'kommen', 'wohnen', 'lernen', 'arbeiten', 'machen', 'spielen', 'gehen'];

function conjugation(verb: string): string[] | undefined {
  const table = get(irregular, verb);
  if (table) return table;
  if (!regularVerbs.includes(verb) || !verb.endsWith('en')) return undefined;
  const stem = dropLast(verb, 2);
  const needsE = stem.endsWith('t') || stem.endsWith('d');
  const sibilant = stem.endsWith('s') || stem.endsWith('ß') || stem.endsWith('z') || stem.endsWith('x');
  const du = sibilant ? stem + 't' : stem + (needsE ? 'est' : 'st');
  const er = stem + (needsE ? 'et' : 't');
  return [stem + 'e', du, er, verb, er, verb];
}

interface Noun { gender: string; plural: string | null }
const N = (gender: string, plural: string | null): Noun => ({ gender, plural });
const nouns: Record<string, Noun> = {
  Vater: N('m', 'Väter'), Mutter: N('f', 'Mütter'), Bruder: N('m', 'Brüder'), Schwester: N('f', 'Schwestern'),
  Familie: N('f', 'Familien'), Eltern: N('f', '-'), Geschwister: N('n', '-'), 'Großvater': N('m', 'Großväter'),
  'Großmutter': N('f', 'Großmütter'), Buch: N('n', 'Bücher'), Tisch: N('m', 'Tische'), Tasche: N('f', 'Taschen'),
  Stuhl: N('m', 'Stühle'), Heft: N('n', 'Hefte'), Handy: N('n', 'Handys'), Brot: N('n', 'Brote'),
  Wasser: N('n', null), Milch: N('f', null), Kaffee: N('m', 'Kaffees'), Apfel: N('m', 'Äpfel'),
  'Käse': N('m', null), Ei: N('n', 'Eier'), Montag: N('m', null), Dienstag: N('m', null),
  Mittwoch: N('m', null), Donnerstag: N('m', null), Freitag: N('m', null), Samstag: N('m', null),
  Sonntag: N('m', null), Uhr: N('f', 'Uhren'), Monat: N('m', 'Monate'), Stadt: N('f', 'Städte'),
  Bahnhof: N('m', 'Bahnhöfe'), Schule: N('f', 'Schulen'), Supermarkt: N('m', 'Supermärkte'), Kino: N('n', 'Kinos'),
  Park: N('m', 'Parks'), 'Straße': N('f', 'Straßen'), Haus: N('n', 'Häuser'),
};
const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const articleOf: Record<string, string> = { m: 'der', f: 'die', n: 'das' };

const pluralForms = new Set([
  ...Object.values(nouns).map((n) => n.plural).filter((p): p is string => p !== null && p !== '-').map((p) => p.toLowerCase()),
  'eltern', 'geschwister',
]);
const singularGender: Record<string, string> = {};
for (const [noun, info] of Object.entries(nouns)) if (info.plural !== '-') singularGender[noun.toLowerCase()] = info.gender;

const gloss: Record<string, string> = {
  hallo: 'hello', 'guten Tag': 'good day', 'tschüss': 'bye', 'auf Wiedersehen': 'goodbye', danke: 'thank you',
  ich: 'I', du: 'you (informal)', er: 'he', sie: 'she', wie: 'how', gut: 'good', sein: 'to be',
  'heißen': 'to be called',
  null: 'zero', eins: 'one', zwei: 'two', drei: 'three', vier: 'four', 'fünf': 'five', sechs: 'six',
  sieben: 'seven', acht: 'eight', neun: 'nine', zehn: 'ten', alt: 'old', ja: 'yes', nein: 'no',
  'die Familie': 'family', 'der Vater': 'father', 'die Mutter': 'mother', 'der Bruder': 'brother',
  'die Schwester': 'sister', 'die Eltern': 'parents', 'die Geschwister': 'siblings', 'der Großvater': 'grandfather',
  'die Großmutter': 'grandmother', mein: 'my', dein: 'your (informal)', haben: 'to have', und: 'and',
  der: 'the (masculine)', die: 'the (feminine, plural)', das: 'the (neuter)', ein: 'a', kein: 'not a',
  'das Buch': 'book', 'der Tisch': 'table', 'die Tasche': 'bag', 'der Stuhl': 'chair', 'das Heft': 'notebook',
  'das Handy': 'mobile phone', hier: 'here',
  bitte: 'please', 'möchten': 'would like', essen: 'to eat', trinken: 'to drink', 'das Brot': 'bread',
  'das Wasser': 'water', 'die Milch': 'milk', 'der Kaffee': 'coffee', 'der Apfel': 'apple', 'der Käse': 'cheese',
  'das Ei': 'egg', was: 'what',
  wir: 'we', ihr: 'you (plural)', kommen: 'to come', wohnen: 'to live', lernen: 'to learn',
  arbeiten: 'to work', machen: 'to do', spielen: 'to play', aus: 'from', woher: 'where from',
  wo: 'where', in: 'in', heute: 'today',
  'der Montag': 'Monday', 'der Dienstag': 'Tuesday', 'der Mittwoch': 'Wednesday', 'der Donnerstag': 'Thursday',
  'der Freitag': 'Friday', 'der Samstag': 'Saturday', 'der Sonntag': 'Sunday', 'die Uhr': "o'clock", 'spät': 'late',
  wann: 'when', um: 'at (a time)', 'der Monat': 'month',
  'die Stadt': 'city', 'der Bahnhof': 'train station', 'die Schule': 'school', 'der Supermarkt': 'supermarket',
  'das Kino': 'cinema', 'der Park': 'park', 'die Straße': 'street', 'das Haus': 'house', gehen: 'to go',
  nach: 'to (a city or country)', wohin: 'where to', dort: 'there',
};

const numberWords: Record<number, string> = {
  0: 'null', 1: 'ein', 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'fünf', 6: 'sechs', 7: 'sieben', 8: 'acht', 9: 'neun',
  10: 'zehn', 11: 'elf', 12: 'zwölf', 13: 'dreizehn', 14: 'vierzehn', 15: 'fünfzehn', 16: 'sechzehn',
  17: 'siebzehn', 18: 'achtzehn', 19: 'neunzehn', 20: 'zwanzig',
};

/** The words of a German text as written (case kept), without the punctuation around them; inner apostrophes stay. */
function germanTokens(text: string): string[] {
  return text
    .split(/[\p{White_Space}]+/u)
    .filter((p) => p !== '')
    .map((p) => trimWith(p, (c) => c !== "'" && (isPunct(c) || c === '\t' || /^\p{Zs}$/u.test(c))))
    .filter((p) => p !== '');
}

const germanTexts: string[] = [
  ...words.map((w) => w.target), ...sentences.map((s) => s.target), ...forms.flatMap((f) => [...f.answers]),
  ...fills.filter((f) => f.options.length > 0).map((f) => f.sentence.split('___').join(f.options[0])),
];

function nounOf(subject: string): [string, string] | null {
  const parts = subject.split(' ').filter((p) => p !== '');
  if (parts.length !== 2 || !['der', 'die', 'das', 'ein', 'kein', 'eine'].includes(parts[0])) return null;
  return [parts[0], parts[1]];
}

function groupAndSubject(form: LanguageForm): [string, string] | null {
  const comma = form.prompt.indexOf(',');
  if (comma < 0) return null;
  return [form.prompt.slice(0, comma), form.prompt.slice(comma + 2)];
}

describe('DaF course: shape', () => {
  it('parses and has no content problems', () => {
    expect(made.errors).toEqual([]);
  });

  it('has the header and provider the catalog expects', () => {
    expect(data.id).toBe('daf');
    expect(data.title).toBe('Deutsch als Fremdsprache');
    expect(data.subtitle).toBe('German for English speakers · A1');
    expect(data.kind).toBe('language');
    expect(data.color).toBe(0xb8a04a);
    expect(data.symbol).toBe('textformat');
    expect(data.speech).toBe('de-DE');
    expect(data.instruction).toBe('en');
    expect(data.targetName).toBe('German');
    expect(data.intoName).toBe('German');
    expect(data.knownName).toBe('English');
    expect(data.produces).toBe(true);
    expect(germanForeignProvider.course.id).toBe('daf');
    expect(germanForeignProvider.course.units.length).toBe(8);
    expect(germanForeignProvider.course.units.map((u) => u.title)).toEqual(units.map((u) => u.title));
  });

  it('passes the engine audit', () => {
    expect(CourseAudit.problems(germanForeignProvider, range(1, 3).map(BigInt))).toEqual([]);
  });

  it('teaches every word of a sentence before', () => {
    expect(coverageGaps(data).map(describeGap)).toEqual([]);
  });

  it('has the agreed size', () => {
    expect(units.length).toBe(8);
    expect(words.length).toBeGreaterThanOrEqual(95);
    expect(sentences.length).toBeGreaterThanOrEqual(60);
    expect(forms.length).toBeGreaterThanOrEqual(40);
    expect(fills.length).toBeGreaterThanOrEqual(16);
    expect(facts.length).toBeGreaterThanOrEqual(12);
    units.forEach((unit, index) => {
      const place = `unit ${index + 1} ${unit.title}`;
      expect(inRange(itemCount(unit), 22, 30), `${place}: ${itemCount(unit)} items`).toBe(true);
      expect(inRange(unit.words.length, 10, 14), `${place}: words`).toBe(true);
      expect(inRange(unit.sentences.length, 6, 10), `${place}: sentences`).toBe(true);
      expect(inRange(unit.forms.length, 3, 7), `${place}: forms`).toBe(true);
      expect(inRange(unit.fills.length, 2, 4), `${place}: fills`).toBe(true);
      expect(inRange(unit.facts.length, 1, 3), `${place}: facts`).toBe(true);
      expect(LanguageCourseProvider.lessonCount(unit), place).toBe(5);
      const tips = unit.tip.split('\n\n');
      expect(inRange(tips.length, 3, 5), `${place}: ${tips.length} tip paragraphs`).toBe(true);
      for (const tip of tips) {
        expect(count(tip), `${place}: too short`).toBeGreaterThan(120);
        expect(count(tip), `${place}: too long`).toBeLessThan(800);
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

  it('has the gloss of every word a teacher expects', () => {
    const seen = new Set<string>();
    for (const word of words) {
      const expected = get(gloss, word.target);
      expect(expected, `a word the test does not know: ${word.target}`).toBeDefined();
      if (expected === undefined) continue;
      expect(word.meanings[0], word.target).toBe(expected);
      seen.add(word.target);
    }
    expect(seen.size, 'the test lists a word the course does not teach').toBe(Object.keys(gloss).length);
  });
});

describe('DaF course: verbs', () => {
  it('has all six persons and the right forms in every verb table', () => {
    let tables = 0;
    for (const word of words) {
      if (!word.note.startsWith('forms: ')) continue;
      const verb = word.target;
      const entries = word.note.slice('forms: '.length).split(', ');
      expect(entries.length, `${verb}: a full table has six persons`).toBe(6);
      const expected = conjugation(verb);
      expect(expected, `a verb the test does not know: ${verb}`).toBeDefined();
      if (!expected) continue;
      entries.forEach((entry, index) => {
        if (index < 6) expect(entry, `${verb}: ${entry}`).toBe(`${persons[index]} ${expected[index]}`);
      });
      tables++;
    }
    expect(tables, 'every verb of the course has a table').toBe(13);
    const verbs = new Set(words.filter((w) => w.note.startsWith('forms: ')).map((w) => w.target));
    expect(verbs).toEqual(new Set([...Object.keys(irregular), ...regularVerbs]));
  });

  it('has the right form for its person in every verb form', () => {
    let checked = 0;
    for (const form of forms) {
      const parts = form.prompt.split(', ');
      if (parts.length !== 2 || !persons.includes(parts[1])) continue;
      const table = conjugation(parts[0]);
      expect(table, `a form of a verb the test does not know: ${form.prompt}`).toBeDefined();
      if (!table) continue;
      expect(form.answers[0], form.prompt).toBe(table[persons.indexOf(parts[1])]);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(17);
  });

  it('shows every drilled verb form in a tip', () => {
    units.forEach((unit, index) => {
      for (const form of unit.forms) {
        const parts = form.prompt.split(', ');
        if (parts.length !== 2 || !persons.includes(parts[1]) || form.answers.length === 0) continue;
        const tips = units.slice(0, index + 1).map((u) => u.tip).join(' ');
        expect(tips.includes(form.answers[0]), `unit ${index + 1}: no tip shows ${form.answers[0]} (${form.prompt})`).toBe(true);
      }
    });
  });

  it('has exactly the right form for the subject in fills with verbs', () => {
    const byForm = new Map<string, Set<number>>();
    const add = (form: string, i: number) => {
      if (!byForm.has(form)) byForm.set(form, new Set());
      byForm.get(form)!.add(i);
    };
    for (const verb of [...Object.keys(irregular), ...regularVerbs]) conjugation(verb)?.forEach((form, i) => add(form, i));
    add('bin', 0);
    const subjects: Record<string, number> = { ich: 0, du: 1, er: 2, wir: 3, ihr: 4 };
    let checked = 0;
    for (const fill of fills) {
      const tokens = germanTokens(fill.sentence.split('___').join('BLANK'));
      const blank = tokens.indexOf('BLANK');
      if (blank < 0) { expect.fail(`no blank: ${fill.sentence}`); continue; }
      let person: number | undefined;
      if (blank > 0 && get(subjects, tokens[blank - 1].toLowerCase()) !== undefined) person = subjects[tokens[blank - 1].toLowerCase()];
      else if (blank > 0 && tokens[blank - 1] === 'Sie' && blank === 1) person = 2;
      else if (blank + 1 < tokens.length && tokens[blank + 1] === 'Sie' && blank > 0) person = 5;
      else if (blank + 1 < tokens.length && get(subjects, tokens[blank + 1].toLowerCase()) !== undefined) person = subjects[tokens[blank + 1].toLowerCase()];
      if (person === undefined || !fill.options.every((o) => byForm.has(o))) continue;
      expect(byForm.get(fill.options[0])?.has(person) === true, `${fill.sentence}: ${fill.options[0]} does not fit`).toBe(true);
      for (const wrong of fill.options.slice(1)) {
        expect(byForm.get(wrong)?.has(person) === true, `${fill.sentence}: ${wrong} also fits`).toBe(false);
      }
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });
});

describe('DaF course: nouns, genders, plurals', () => {
  it('gives every noun its article and a plural note that agree', () => {
    let checked = 0;
    for (const word of words) {
      const parts = word.target.split(' ').filter((p) => p !== '');
      if (parts.length !== 2 || !['der', 'die', 'das'].includes(parts[0])) continue;
      const name = parts[1];
      const info = get(nouns, name);
      expect(info, `a noun the test does not know: ${word.target}`).toBeDefined();
      if (!info) continue;
      expect(parts[0], `${word.target} has the wrong article`).toBe(info.plural === '-' ? 'die' : articleOf[info.gender]);
      if (info.plural === null) expect(word.note, word.target).toBe(days.includes(name) ? 'all days are masculine' : 'no plural');
      else if (info.plural === '-') expect(word.note, word.target).toBe('plural only');
      else expect(word.note, word.target).toBe(`pl. die ${info.plural}`);
      checked++;
    }
    expect(checked, 'number of nouns taught with an article').toBe(Object.keys(nouns).length);
  });

  it('teaches every noun with its article', () => {
    const targets = new Set(words.map((w) => w.target));
    for (const name of Object.keys(nouns)) expect(targets.has(name), `${name} is taught without its article`).toBe(false);
    const taught = new Set<string>();
    for (const word of words) {
      const parts = word.target.split(' ').filter((p) => p !== '');
      if (parts.length === 2 && ['der', 'die', 'das'].includes(parts[0])) taught.add(parts[1]);
    }
    expect(taught).toEqual(new Set(Object.keys(nouns)));
  });

  it('forms plurals by the table', () => {
    let checked = 0;
    for (const form of forms) {
      const gs = groupAndSubject(form);
      if (!gs || gs[0] !== 'Plural') continue;
      const n = nounOf(gs[1]);
      const plural = n ? get(nouns, n[1])?.plural : undefined;
      if (!n || plural === undefined || plural === null || plural === '-') continue;
      expect(form.answers[0], form.prompt).toBe(`die ${plural}`);
      checked++;
    }
    expect(checked).toBe(4);
  });

  it('changes only masculine nouns in the accusative', () => {
    let checked = 0;
    for (const form of forms) {
      const gs = groupAndSubject(form);
      if (!gs || gs[0] !== 'accusative') continue;
      const n = nounOf(gs[1]);
      const info = n ? get(nouns, n[1]) : undefined;
      if (!n || !info) continue;
      expect(info.gender, `${form.prompt}: the drill is about the one gender that changes`).toBe('m');
      const changed = get({ der: 'den', ein: 'einen', kein: 'keinen' } as Record<string, string>, n[0]);
      expect(form.answers[0], form.prompt).toBe(`${changed ?? '?'} ${n[1]}`);
      checked++;
    }
    expect(checked).toBe(3);
  });

  it('makes possessive and indefinite forms agree with the noun', () => {
    let checked = 0;
    for (const form of forms) {
      const gs = groupAndSubject(form);
      if (!gs || !['mein', 'dein', 'ein', 'kein'].includes(gs[0])) continue;
      const n = nounOf(gs[1]);
      const info = n ? get(nouns, n[1]) : undefined;
      if (!n || !info) continue;
      const plural = gs[1].startsWith('die ') && info.plural === '-';
      const ending = info.gender === 'f' || plural ? 'e' : '';
      expect(form.answers[0], form.prompt).toBe(`${gs[0]}${ending} ${n[1]}`);
      checked++;
    }
    expect(checked).toBe(5);
  });

  it('spells numbers as the rules say', () => {
    const seen = new Set<number>();
    for (const form of forms) {
      const gs = groupAndSubject(form);
      if (!gs || gs[0] !== 'in words' || !/^[+-]?\d+$/.test(gs[1])) continue;
      const value = Number(gs[1]);
      expect(form.answers[0], form.prompt).toBe(numberWords[value] === 'ein' ? 'eins' : numberWords[value]);
      if (inRange(value, 13, 19) && value !== 16 && value !== 17) expect(form.answers[0]).toBe(numberWords[value - 10] + 'zehn');
      seen.add(value);
    }
    expect(seen).toEqual(new Set([11, 12, 13, 16, 17, 20]));
    const taught = words.filter((w) => !w.target.includes(' ')).map((w) => w.target);
    for (const [value, name] of Object.entries(numberWords)) {
      if (Number(value) > 10) continue;
      const target = name === 'ein' ? 'eins' : name;
      expect(taught.includes(target), `the number ${value} is not taught: ${target}`).toBe(true);
    }
  });

  it('computes clock times from the digits', () => {
    const hours: Record<number, string> = { 1: 'ein', 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'fünf', 6: 'sechs', 7: 'sieben', 8: 'acht', 9: 'neun', 10: 'zehn', 11: 'elf', 12: 'zwölf' };
    let checked = 0;
    for (const form of forms) {
      const gs = groupAndSubject(form);
      if (!gs || gs[0] !== 'time') continue;
      const parts = gs[1].split(':').map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n));
      expect(parts.length, form.prompt).toBe(2);
      const [hour, minute] = parts;
      const next = (hour % 12) + 1;
      let expected: string;
      switch (minute) {
        case 0: expected = `Es ist ${hours[hour]} Uhr.`; break;
        case 15: expected = `Es ist Viertel nach ${hours[hour]}.`; break;
        case 30: expected = `Es ist halb ${hours[next]}.`; break;
        case 45: expected = `Es ist Viertel vor ${hours[next]}.`; break;
        default: expected = '?';
      }
      expect(form.answers[0], form.prompt).toBe(expected);
      checked++;
    }
    expect(checked).toBe(4);
  });

  it('follows the cases in contractions and preposition forms', () => {
    let checked = 0;
    for (const form of forms) {
      const gs = groupAndSubject(form);
      if (!gs) continue;
      const n = nounOf(gs[1]);
      const info = n ? get(nouns, n[1]) : undefined;
      if (!n || !info) continue;
      const name = n[1];
      switch (gs[0]) {
        case 'Wo? in':
          expect(form.answers[0], form.prompt).toBe(info.gender === 'f' ? `in der ${name}` : `im ${name}`);
          break;
        case 'Wohin? in':
          expect(form.answers[0], form.prompt).toBe(info.gender === 'm' ? `in den ${name}` : info.gender === 'n' ? `ins ${name}` : `in die ${name}`);
          break;
        case 'zu':
          expect(form.answers[0], form.prompt).toBe(info.gender === 'f' ? `zur ${name}` : `zum ${name}`);
          break;
        case 'on':
          expect(form.answers[0], form.prompt).toBe(`am ${name}`);
          expect(days.includes(name), form.prompt).toBe(true);
          break;
        default:
          continue;
      }
      checked++;
    }
    expect(checked).toBe(7);
  });
});

describe('DaF course: agreement in every text', () => {
  it('lets articles and possessives agree with their nouns everywhere', () => {
    const kind = (token: string): string | undefined => {
      const key = token.toLowerCase();
      if (pluralForms.has(key)) return 'p';
      return get(singularGender, key);
    };
    let checked = 0;
    for (const text of germanTexts) {
      const tokens = germanTokens(text);
      for (let index = 0; index < tokens.length - 1; index++) {
        const token = tokens[index];
        const next = kind(tokens[index + 1]);
        if (next === undefined) continue;
        const previous = index > 0 ? tokens[index - 1].toLowerCase() : '';
        const lower = token.toLowerCase();
        const after = tokens[index + 1];
        if (lower === 'ein' && after === 'Uhr') continue; // "ein Uhr" is the clock form of eins
        if (['ein', 'kein', 'mein', 'dein'].includes(lower)) expect(next === 'm' || next === 'n', `${text}: ${token} before ${after}`).toBe(true);
        else if (['eine', 'keine', 'meine', 'deine'].includes(lower)) expect(next === 'f' || next === 'p', `${text}: ${token} before ${after}`).toBe(true);
        else if (lower === 'einen' || lower === 'keinen') expect(next, `${text}: ${token} before ${after}`).toBe('m');
        else if (lower === 'den') expect(next === 'm', `${text}: den before ${after}`).toBe(true);
        else if (lower === 'der') expect(next === 'm' || (next === 'f' && ['in', 'zu'].includes(previous)), `${text}: der before ${after}`).toBe(true);
        else if (lower === 'die') expect(next === 'f' || next === 'p', `${text}: die before ${after}`).toBe(true);
        else if (lower === 'das') expect(next, `${text}: das before ${after}`).toBe('n');
        else if (lower === 'im' || lower === 'zum') expect(next === 'm' || next === 'n', `${text}: ${token} before ${after}`).toBe(true);
        else if (lower === 'ins') expect(next, `${text}: ins before ${after}`).toBe('n');
        else if (lower === 'zur') expect(next, `${text}: zur before ${after}`).toBe('f');
        else continue;
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(80);
  });

  it('writes every noun with a capital letter', () => {
    const all = new Set([...Object.keys(nouns).map((n) => n.toLowerCase()), ...pluralForms]);
    for (const text of germanTexts) {
      for (const token of germanTokens(text)) {
        if (all.has(token.toLowerCase())) expect(isUpper(firstChar(token)), `${text}: ${token} is a noun and needs a capital`).toBe(true);
      }
    }
  });
});

describe('DaF course: sentences and glosses', () => {
  it('has short well-formed sentences that are never repeated', () => {
    const seen = new Set<string>();
    units.forEach((unit, index) => {
      for (const sentence of unit.sentences) {
        const tokens = germanTokens(sentence.target);
        expect(tokens.length, `unit ${index + 1}: too long to type: ${sentence.target}`).toBeLessThanOrEqual(8);
        expect(isUpper(firstChar(sentence.target)), `starts with a capital: ${sentence.target}`).toBe(true);
        expect('.?!'.includes(lastChar(sentence.target) ?? 'x'), `ends with a mark: ${sentence.target}`).toBe(true);
        const f = folded(sentence.target);
        expect(seen.has(f), `repeated: ${sentence.target}`).toBe(false);
        seen.add(f);
        expect(sentence.meanings.length).not.toBe(0);
        for (const meaning of sentence.meanings) {
          const bare = meaning.split(' (formal)').join('');
          expect('.?!'.includes(lastChar(bare) ?? 'x'), `the translation ends with a mark: ${meaning}`).toBe(true);
        }
      }
    });
  });

  it('leaves no German in the translations', () => {
    const german = new Set([
      'ich', 'du', 'er', 'wir', 'ihr', 'ist', 'sind', 'bin', 'bist', 'und', 'der', 'die', 'das', 'ein', 'eine', 'einen',
      'nicht', 'kein', 'keine', 'mein', 'meine', 'habe', 'hat', 'hast', 'heißt', 'heiße', 'wie', 'wo', 'was', 'gut',
      'danke', 'hallo', 'nach', 'aus', 'im', 'ins', 'zum', 'heute', 'dort', 'hier',
    ]);
    const names = new Set(['müller', 'weber', 'anna', 'max', 'peter', 'julia', 'berlin']);
    for (const sentence of sentences) {
      for (const meaning of sentence.meanings) {
        for (const token of germanTokens(meaning)) {
          const lower = token.toLowerCase();
          expect(german.has(lower), `${meaning}: ${token} is German`).toBe(false);
          if (!names.has(lower)) expect(chars(lower).some((c) => 'äöüß'.includes(c)), `${meaning}: ${token} has a German letter`).toBe(false);
        }
      }
    }
    for (const word of words) {
      for (const meaning of word.meanings) {
        if (meaning.includes('Sie')) continue;
        expect(chars(meaning).some((c) => 'äöüß'.includes(c)), `${word.target}: ${meaning}`).toBe(false);
      }
    }
  });

  it('shares no meaning between two words', () => {
    const owner = new Map<string, string>();
    for (const word of words) {
      for (const meaning of word.meanings) {
        const key = folded(meaning);
        const other = owner.get(key);
        if (other !== undefined && other !== word.target) expect.fail(`"${meaning}" means ${other} and ${word.target}`);
        owner.set(key, word.target);
      }
    }
  });

  it('has fills with one right choice and facts as questions', () => {
    for (const fill of fills) {
      expect(fill.sentence.split('___').length, `exactly one blank: ${fill.sentence}`).toBe(2);
      expect(new Set(fill.options).size, `a choice twice: ${fill.sentence}`).toBe(fill.options.length);
      expect(inRange(fill.options.length, 3, 4), `three choices are enough: ${fill.sentence}`).toBe(true);
    }
    for (const fact of facts) {
      expect(new Set([fact.answer, ...fact.wrong]).size, `a choice twice: ${fact.question}`).toBe(fact.wrong.length + 1);
      expect(fact.question.endsWith('?'), fact.question).toBe(true);
    }
  });

  it('is taught in English with German examples', () => {
    for (const unit of units) {
      for (const phrase of ['Dies ist', 'Das bedeutet', 'Man sagt', 'Beachte']) expect(unit.tip.includes(phrase), `${unit.title}: ${phrase}`).toBe(false);
      expect(unit.title).not.toBe('');
      expect(unit.summary).not.toBe('');
    }
    expect(source.includes('\u{1F600}')).toBe(false);
  });

  it('covers a unit\'s new items in its lessons', () => {
    for (let number = 1; number <= 8; number++) {
      const unit = germanForeignProvider.course.units[number - 1];
      expect(unit.nodes.filter((n) => n.kind === 'lesson').length, unit.title).toBe(5);
      for (const node of unit.nodes) {
        if (node.kind === 'chest') continue;
        const exercises = germanForeignProvider.exercises(node, 7n);
        expect(exercises.length, node.id).toBeGreaterThanOrEqual(8);
        expect(new Set(exercises.map((e) => e.kind)).size, node.id).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
