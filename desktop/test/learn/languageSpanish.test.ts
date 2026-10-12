// Port of LernwerkTests/SpanishCourseTests.swift and SpanishCourseFactTests.swift.
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import { folded, LearnAnswer, missedKeys, type LearnExercise } from '../../src/lib/learn/exercise';
import { coverageGaps, coverageTokens, describeGap } from '../../src/lib/learn/languages/coverage';
import { spanishProvider } from '../../src/lib/learn/languages/courses';
import { formGroup, type LanguageForm } from '../../src/lib/learn/languages/data';
import { LanguageCourseProvider } from '../../src/lib/learn/languages/provider';
import { courseTexts } from '../../src/lib/learn/languages/texts';
import { chars, count, dropFirst, dropLast, firstChar, formsByCard, get, inRange, isPunct, isUpper, lastChar, lettersOnly, range, suffix, trimWith } from './languageKit';

const made = LanguageCourseProvider.make(courseTexts.es);
const provider = made.provider;
const data = provider.data;
const words = data.units.flatMap((u) => u.words);
const sentences = data.units.flatMap((u) => u.sentences);
const forms = data.units.flatMap((u) => u.forms);
const fills = data.units.flatMap((u) => u.fills);
const itemCount = (u: (typeof data.units)[number]) => u.words.length + u.sentences.length + u.forms.length + u.fills.length + u.facts.length;

describe('Spanish course: shape', () => {
  it('parses without errors', () => {
    expect(made.errors).toEqual([]);
  });

  it('uses only taught words in sentences', () => {
    expect(coverageGaps(data).map(describeGap)).toEqual([]);
  });

  it('has a clean course audit', () => {
    expect(CourseAudit.problems(spanishProvider, range(1, 3).map(BigInt))).toEqual([]);
  });

  it('describes the Spanish course for German speakers', () => {
    expect(data.id).toBe('es');
    expect(data.title).toBe('Spanisch');
    expect(data.subtitle).toBe('Für Deutschsprachige · A1');
    expect(data.kind).toBe('language');
    expect(data.color).toBe(0xd9903a);
    expect(data.symbol).toBe('text.bubble.fill');
    expect(data.speech).toBe('es-ES');
    expect(data.instruction).toBe('de');
    expect(data.targetName).toBe('Spanisch');
    expect(data.intoName).toBe('Spanische');
    expect(data.produces).toBe(true);
    expect(spanishProvider.course.id).toBe('es');
  });

  it('is large enough and every unit has the right size', () => {
    expect(data.units.length).toBeGreaterThanOrEqual(8);
    expect(words.length).toBeGreaterThanOrEqual(120);
    expect(sentences.length).toBeGreaterThanOrEqual(60);
    expect(forms.length).toBeGreaterThanOrEqual(50);
    expect(fills.length).toBeGreaterThanOrEqual(18);
    expect(data.units.flatMap((u) => u.facts).length).toBeGreaterThanOrEqual(10);
    data.units.forEach((unit, index) => {
      const place = `unit ${index + 1} ${unit.title}`;
      expect(inRange(itemCount(unit), 22, 32), `${place}: ${itemCount(unit)} items`).toBe(true);
      expect(inRange(unit.words.length, 10, 15), `${place}: words`).toBe(true);
      expect(inRange(unit.sentences.length, 6, 10), `${place}: sentences`).toBe(true);
      expect(inRange(unit.forms.length, 3, 8), `${place}: forms`).toBe(true);
      expect(inRange(unit.fills.length, 2, 4), `${place}: fills`).toBe(true);
      expect(inRange(unit.facts.length, 1, 3), `${place}: facts`).toBe(true);
      const paragraphs = unit.tip.split('\n\n');
      expect(inRange(paragraphs.length, 3, 5), `${place}: ${paragraphs.length} tip paragraphs`).toBe(true);
      for (const p of paragraphs) expect(count(p), `${place}: a tip paragraph is too short`).toBeGreaterThan(80);
      expect(spanishProvider.course.units[index].nodes.filter((n) => n.kind === 'lesson').length, `${place}: 25 or more items make five lessons`).toBe(5);
    });
  });

  it('teaches with examples from the unit\'s own words in every tip', () => {
    data.units.forEach((unit, index) => {
      const tipTokens = new Set(coverageTokens(unit.tip));
      const own = unit.words.flatMap((w) => coverageTokens(w.target)).filter((t) => count(t) >= 4);
      expect(own.filter((t) => tipTokens.has(t)).length, `unit ${index + 1}: the tip should use the unit's own words`).toBeGreaterThanOrEqual(3);
    });
    const first = data.units[0].tip;
    for (const mark of ['¿', '¡', 'á', 'é', 'í', 'ó', 'ú', 'ñ']) expect(first.includes(mark), `the first unit teaches ${mark}`).toBe(true);
  });

  it('meets the student with every word in at least three forms across its unit', () => {
    // A node holds at most 12 exercises; over a few plays (seeds) a word always shows three forms.
    data.units.forEach((unit, unitIndex) => {
      const seen = formsByCard(provider, unitIndex, range(1, 5));
      unit.words.forEach((word, index) => {
        const forms3 = seen.get(`w${unitIndex}-${index}`) ?? new Set();
        expect(forms3.size, `${word.target}: ${[...forms3].sort()}`).toBeGreaterThanOrEqual(3);
      });
    });
  });

  it('shows every sentence, form, fill and fact in the unit\'s exercises', () => {
    data.units.forEach((unit, unitIndex) => {
      const seen = new Set<string>();
      const nodes = provider.course.units[unitIndex].nodes.filter((n) => n.kind !== 'chest');
      for (const node of nodes) for (const seed of range(1, 4)) for (const e of provider.exercises(node, BigInt(seed))) seen.add(e.cardKeys[0] ?? '');
      const expected = [
        ...unit.words.map((_, i) => `w${unitIndex}-${i}`), ...unit.sentences.map((_, i) => `s${unitIndex}-${i}`),
        ...unit.forms.map((_, i) => `f${unitIndex}-${i}`), ...unit.fills.map((_, i) => `g${unitIndex}-${i}`),
        ...unit.facts.map((_, i) => `q${unitIndex}-${i}`),
      ];
      for (const key of expected) expect(seen.has(key), `unit ${unitIndex + 1}: ${key} never comes up`).toBe(true);
    });
  });

  it('speaks with the Spanish voice of Spain', () => {
    const node = provider.course.nodes.find((n) => n.id === 'es.u01.p')!;
    const list: LearnExercise[] = [];
    for (let seed = 1; seed <= 4; seed++) list.push(...provider.exercises(node, BigInt(seed)));
    const speech = list.flatMap((e) => (e.media?.type === 'speech' ? [e.media.language] : []));
    expect(speech.length).toBeGreaterThan(0);
    expect(speech.every((l) => l === 'es-ES')).toBe(true);
  });

  it('is strict about letters but forgives accents and capitals when typed', () => {
    const node = provider.course.nodes.find((n) => n.id === 'es.u02.t')!;
    const pool: LearnExercise[] = [];
    for (let seed = 1; seed <= 40; seed++) pool.push(...provider.exercises(node, BigInt(seed)));
    const typed = pool.filter((e) => e.kind === 'typeAnswer' && e.mode === 'exact');
    const same = (e: LearnExercise, a: string[]) => e.correctAnswers.length === a.length && e.correctAnswers.every((x, i) => x === a[i]);
    const brother = typed.find((e) => same(e, ['el hermano']))!;
    expect(brother).toBeDefined();
    expect(missedKeys(brother, LearnAnswer.typed('El Hermano'))).toEqual(new Set());
    expect(missedKeys(brother, LearnAnswer.typed('el hermana'))).toEqual(new Set([brother.cardKeys[0]]));
    const sister = typed.find((e) => same(e, ['la hermana']))!;
    expect(sister).toBeDefined();
    expect(missedKeys(sister, LearnAnswer.typed('la hermano'))).toEqual(new Set([sister.cardKeys[0]]));
  });

  it('has word bank tiles without Spanish punctuation marks', () => {
    data.units.forEach((_, unit) => {
      const node = provider.course.nodes.find((n) => n.id === `es.u${String(unit + 1).padStart(2, '0')}.p`)!;
      for (const e of provider.exercises(node, 3n)) {
        if (e.kind !== 'wordBank') continue;
        for (const tile of e.options) expect(chars(tile).some((c) => '¿?¡!.,'.includes(c)), `${e.id}: ${tile}`).toBe(false);
      }
    });
  });
});

// Facts: tables and rules written down here again, not copied from the course.

const plainTokens = (text: string): string[] => lettersOnly(text);
const persons = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];

function personOf(form: LanguageForm): number | null {
  const parts = form.prompt.split(', ');
  if (parts.length !== 2) return null;
  const i = persons.indexOf(parts[1]);
  return i < 0 ? null : i;
}

describe('Spanish course: verb tables', () => {
  it('has the irregular verbs with all six persons and the right forms', () => {
    const tables: Record<string, string[]> = {
      ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
      tener: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
      estar: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
    };
    for (const [verb, expected] of Object.entries(tables)) {
      const own = forms.filter((f) => formGroup(f) === verb);
      expect(own.length, `${verb} is taught with six forms`).toBe(6);
      const found: Array<string | null> = Array(6).fill(null);
      for (const form of own) {
        const index = personOf(form);
        if (index === null) { expect.fail(`${form.prompt}: no person`); continue; }
        expect(found[index], `${verb}: person ${persons[index]} twice`).toBeNull();
        found[index] = form.answers[0] ?? null;
        expect(form.answers.length, form.prompt).toBe(1);
      }
      expect(found.map((f) => f ?? ''), verb).toEqual(expected);
    }
  });

  it('follows the tip with the endings of the regular verbs', () => {
    const endings: Record<string, string[]> = {
      ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
    };
    const regular = forms.filter((f) => ['hablar', 'comer', 'vivir'].includes(formGroup(f)));
    expect(regular.length).toBeGreaterThanOrEqual(8);
    const groups = new Set<string>();
    for (const form of regular) {
      const infinitive = formGroup(form);
      const group = suffix(infinitive, 2);
      groups.add(group);
      const index = personOf(form);
      const table = get(endings, group);
      if (index === null || !table) { expect.fail(form.prompt); continue; }
      expect(form.answers, form.prompt).toEqual([dropLast(infinitive, 2) + table[index]]);
    }
    expect(groups).toEqual(new Set(['ar', 'er', 'ir']));
    const tip = data.units[6].tip;
    for (const [group, table] of Object.entries(endings)) {
      expect(tip.includes(`Verben auf -${group}: ` + table.map((t) => '-' + t).join(', ')), group).toBe(true);
    }
  });

  it('has the ending the note says on the regular verbs', () => {
    for (const word of words) {
      if (!word.note.startsWith('Verb auf -')) continue;
      const ending = chars(word.note.slice('Verb auf -'.length)).slice(0, 2).join('');
      expect(word.target.endsWith(ending), `${word.target}: ${word.note}`).toBe(true);
    }
    for (const word of words) {
      if (['ar', 'er', 'ir'].includes(suffix(word.target, 2)) && !word.target.includes(' ')) {
        expect(word.note.startsWith('Verb auf -') || word.note === 'unregelmäßig', `${word.target} needs a note`).toBe(true);
      }
    }
  });

  it('matches gustar forms to person and number', () => {
    const pronouns: Record<string, string> = { 'a mí': 'me', 'a ti': 'te', 'a ella': 'le', 'a él': 'le' };
    const gustar = forms.filter((f) => formGroup(f) === 'gustar');
    expect(gustar.length).toBeGreaterThanOrEqual(4);
    for (const form of gustar) {
      const rest = form.prompt.split(', ')[1].split(' + ');
      expect(rest.length, form.prompt).toBe(2);
      const pronoun = rest.length === 2 ? get(pronouns, rest[0]) : undefined;
      if (pronoun === undefined) { expect.fail(form.prompt); continue; }
      expect(form.answers, form.prompt).toEqual([`${pronoun} ${rest[1] === 'Singular' ? 'gusta' : 'gustan'}`]);
    }
    expect(gustar.some((f) => f.answers.length === 1 && f.answers[0] === 'me gusta') && gustar.some((f) => f.answers.length === 1 && f.answers[0] === 'te gustan')).toBe(true);
  });
});

describe('Spanish course: nouns', () => {
  /** The plural of "el amigo" as the rules of the unit say. */
  function plural(phrase: string): string {
    const parts = phrase.split(' ');
    const article = parts[0] === 'el' ? 'los' : 'las';
    let noun = parts.slice(1).join(' ');
    const lastC = lastChar(noun);
    if (noun.endsWith('z')) noun = dropLast(noun) + 'ces';
    else if (lastC !== undefined && 'aeiouáéíóú'.includes(lastC)) noun += 's';
    else if (noun.endsWith('s')) noun += '';
    else noun += 'es';
    return `${article} ${noun}`;
  }

  it('gives every noun with an article the gender of its article', () => {
    let checked = 0;
    for (const word of words) {
      if (!(word.target.startsWith('el ') || word.target.startsWith('la '))) continue;
      const masculine = word.target.startsWith('el ');
      const note = word.note;
      if (word.target === 'el agua') expect(note.startsWith('f'), 'agua is feminine').toBe(true);
      else {
        expect(note.startsWith(masculine ? 'm' : 'f'), `${word.target}: ${note}`).toBe(true);
        expect(note.startsWith(masculine ? 'f' : 'm'), `${word.target}: ${note}`).toBe(false);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
    expect(words.find((w) => w.target === 'el día')?.note.startsWith('m')).toBe(true);
    expect(words.find((w) => w.target === 'la mano')).toBeUndefined();
  });

  it('follows the rule in plural notes and plural forms', () => {
    let checkedNotes = 0;
    for (const word of words) {
      if (!(word.target.startsWith('el ') || word.target.startsWith('la '))) continue;
      const at = word.note.indexOf('Pl. ');
      if (at < 0) continue;
      let written = word.note.slice(at + 4);
      const bracket = written.indexOf(' (');
      if (bracket >= 0) written = written.slice(0, bracket);
      expect(written, word.target).toBe(word.target === 'el agua' ? 'las aguas' : plural(word.target));
      checkedNotes++;
    }
    expect(checkedNotes).toBeGreaterThan(35);
    let checkedForms = 0;
    for (const form of forms) {
      if (!form.prompt.endsWith(', Plural')) continue;
      const singular = form.prompt.split(', ')[0];
      if (!(singular.startsWith('el ') || singular.startsWith('la '))) continue;
      expect(form.answers, form.prompt).toEqual([plural(singular)]);
      checkedForms++;
    }
    expect(checkedForms).toBeGreaterThanOrEqual(8);
  });

  it('forms adjectives by the endings', () => {
    const agree = (adjective: string, feminine: boolean, pl: boolean): string => {
      let result = adjective;
      if (result.endsWith('o') && feminine) result = dropLast(result) + 'a';
      if (pl) result += 'aeiou'.includes(lastChar(result) ?? '') ? 's' : 'es';
      return result;
    };
    const adjectives = forms.filter(
      (f) => !f.prompt.startsWith('gustar') && (f.prompt.includes(', weiblich') || (f.prompt.includes('Plural') && !f.prompt.startsWith('el ') && !f.prompt.startsWith('la '))),
    );
    expect(adjectives.length).toBeGreaterThanOrEqual(6);
    for (const form of adjectives) {
      const parts = form.prompt.split(', ');
      let expected: string;
      switch (parts[1]) {
        case 'weiblich': expected = agree(parts[0], true, false); break;
        case 'Plural': expected = agree(parts[0], false, true); break;
        case 'weiblicher Plural': expected = agree(parts[0], true, true); break;
        default: expect.fail(form.prompt); continue;
      }
      expect(form.answers, form.prompt).toEqual([expected]);
    }
    for (const word of data.units[7].words) {
      if (!(word.note.includes(', ') && word.note.includes(word.target))) continue;
      const listed = word.note.split('; ').pop()!.split(', ');
      const stem = dropLast(word.target);
      expect(listed.length, word.target).toBe(4);
      expect(listed, word.target).toEqual([word.target, stem + 'a', stem + 'os', stem + 'as']);
    }
  });
});

const numberNames: Array<[string, string]> = [
  ['cero', 'null'], ['uno', 'eins'], ['dos', 'zwei'], ['tres', 'drei'], ['cuatro', 'vier'], ['cinco', 'fünf'],
  ['seis', 'sechs'], ['siete', 'sieben'], ['ocho', 'acht'], ['nueve', 'neun'], ['diez', 'zehn'], ['once', 'elf'],
  ['doce', 'zwölf'], ['trece', 'dreizehn'], ['catorce', 'vierzehn'], ['quince', 'fünfzehn'], ['dieciséis', 'sechzehn'],
  ['diecisiete', 'siebzehn'], ['dieciocho', 'achtzehn'], ['diecinueve', 'neunzehn'], ['veinte', 'zwanzig'],
];

describe('Spanish course: numbers, days, months', () => {
  it('has the number words in counting order', () => {
    const taught = words.filter((w) => numberNames.some(([es]) => es === w.target));
    expect(taught.map((w) => w.target), '0 to 20, each once, in counting order').toEqual(numberNames.map(([es]) => es));
    for (const word of taught) expect(word.meanings[0], word.target).toBe(numberNames.find(([es]) => es === word.target)![1]);
    expect(numberNames.length).toBe(21);
  });

  it('has numbers in sentences matching their translation and right sums', () => {
    const values: Record<string, number> = {};
    numberNames.forEach(([es], i) => { values[es] = i; });
    let checked = 0;
    for (const sentence of sentences) {
      const tokens = plainTokens(sentence.target);
      const german = plainTokens(sentence.meanings[0]);
      for (const token of tokens) {
        if (token === 'uno') continue;
        const value = get(values, token);
        if (value === undefined) continue;
        const name = numberNames[value][1];
        expect(german.some((g) => g.startsWith(name)), `${sentence.target}: ${name} missing in ${sentence.meanings[0]}`).toBe(true);
        checked++;
      }
      const plus = tokens.indexOf('más');
      const sum = tokens.indexOf('son');
      if (plus > 0 && sum >= 0 && sum + 1 < tokens.length) {
        const a = get(values, tokens[plus - 1]);
        const b = get(values, tokens[plus + 1]);
        const c = get(values, tokens[sum + 1]);
        if (a !== undefined && b !== undefined && c !== undefined) {
          expect(a + b, sentence.target).toBe(c);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(15);
    for (const fill of fills) {
      if (!fill.sentence.includes(' más ___ ')) continue;
      const tokens = plainTokens(fill.sentence.split('___').join(fill.options[0]));
      const plus = tokens.indexOf('más');
      const a = plus > 0 ? get(values, tokens[plus - 1]) : undefined;
      const b = plus >= 0 ? get(values, tokens[plus + 1]) : undefined;
      const c = plus >= 0 ? get(values, tokens[plus + 3]) : undefined;
      if (a !== undefined && b !== undefined && c !== undefined) expect(a + b, fill.sentence).toBe(c);
      else expect.fail(fill.sentence);
      for (const wrong of fill.options.slice(1)) {
        const other = plainTokens(fill.sentence.split('___').join(wrong));
        const p = other.indexOf('más');
        const x = p > 0 ? get(values, other[p - 1]) : undefined;
        const y = p >= 0 ? get(values, other[p + 1]) : undefined;
        const z = p >= 0 ? get(values, other[p + 3]) : undefined;
        if (x !== undefined && y !== undefined && z !== undefined) expect(x + y, `${wrong} would be right too`).not.toBe(z);
      }
    }
  });

  it('has the days and months in order', () => {
    const days: Array<[string, string]> = [['lunes', 'Montag'], ['martes', 'Dienstag'], ['miércoles', 'Mittwoch'], ['jueves', 'Donnerstag'], ['viernes', 'Freitag'], ['sábado', 'Samstag'], ['domingo', 'Sonntag']];
    const months: Array<[string, string]> = [['enero', 'Januar'], ['febrero', 'Februar'], ['marzo', 'März'], ['abril', 'April'], ['mayo', 'Mai'], ['junio', 'Juni'], ['julio', 'Juli'], ['agosto', 'August'], ['septiembre', 'September'], ['octubre', 'Oktober'], ['noviembre', 'November'], ['diciembre', 'Dezember']];
    for (const table of [days, months]) {
      const taught = words.filter((w) => table.some(([es]) => es === w.target));
      expect(taught.map((w) => w.target)).toEqual(table.map(([es]) => es));
      for (const word of taught) expect(word.meanings[0]).toBe(table.find(([es]) => es === word.target)![1]);
      for (const word of taught) expect(word.target, 'written small').toBe(word.target.toLowerCase());
    }
  });
});

describe('Spanish course: clock and calendar', () => {
  function spanishTime(hour: number, minute: number): string | null {
    const name = (h: number) => numberNames[h][0];
    const lead = (h: number) => (h === 1 ? 'Es la una' : `Son las ${name(h)}`);
    switch (minute) {
      case 0: return lead(hour) + '.';
      case 10: return lead(hour) + ' y diez.';
      case 15: return lead(hour) + ' y cuarto.';
      case 30: return lead(hour) + ' y media.';
      case 45: return lead((hour % 12) + 1) + ' menos cuarto.';
      default: return null;
    }
  }

  it('has every clock form as the time it asks for', () => {
    const clock = forms.filter((f) => f.prompt.startsWith('Uhrzeit auf Spanisch, '));
    expect(clock.length).toBeGreaterThanOrEqual(5);
    const kinds = new Set<number>();
    for (const form of clock) {
      const digits = form.prompt.split(', ')[1].split(' Uhr').join('').split(':');
      const hour = parseInt(digits[0], 10);
      const minute = parseInt(digits[1], 10);
      if (digits.length !== 2 || Number.isNaN(hour) || Number.isNaN(minute)) { expect.fail(form.prompt); continue; }
      expect(form.answers, form.prompt).toEqual([spanishTime(hour, minute) ?? '?']);
      kinds.add(minute);
    }
    expect(kinds, 'full hours and every kind of minutes the tip names').toEqual(new Set([0, 10, 15, 30, 45]));
    expect(clock.some((f) => f.answers[0]?.startsWith('Es la una')), 'one o\'clock is singular').toBe(true);
  });

  it('has every date form as the date it asks for', () => {
    const months: Record<string, string> = {
      Januar: 'enero', Februar: 'febrero', 'März': 'marzo', April: 'abril', Mai: 'mayo', Juni: 'junio', Juli: 'julio', August: 'agosto',
      September: 'septiembre', Oktober: 'octubre', November: 'noviembre', Dezember: 'diciembre',
    };
    const dates = forms.filter((f) => f.prompt.startsWith('Datum auf Spanisch, '));
    expect(dates.length).toBeGreaterThanOrEqual(4);
    for (const form of dates) {
      const parts = form.prompt.split(', ')[1].split('. ');
      const day = parseInt(parts[0], 10);
      const month = parts.length === 2 ? get(months, parts[1]) : undefined;
      if (parts.length !== 2 || Number.isNaN(day) || !inRange(day, 1, 20) || month === undefined) { expect.fail(form.prompt); continue; }
      const expected = `el ${numberNames[day][0]} de ${month}`;
      expect(form.answers.includes(expected), form.prompt).toBe(true);
      if (day === 1) expect(new Set(form.answers)).toEqual(new Set([expected, `el primero de ${month}`]));
      else expect(form.answers).toEqual([expected]);
    }
  });

  it('writes weekday and month phrases in sentences small', () => {
    const names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    for (const sentence of sentences) {
      for (const token of sentence.target.split(' ').filter((p) => p !== '').slice(1)) {
        const bare = trimWith(token, isPunct);
        expect(names.includes(bare.toLowerCase()) && bare !== bare.toLowerCase(), `${sentence.target}: ${bare}`).toBe(false);
      }
    }
  });
});

describe('Spanish course: sentences', () => {
  it('punctuates correctly and keeps sentences short', () => {
    const n = (t: string, c: string) => chars(t).filter((x) => x === c).length;
    for (const sentence of sentences) {
      const target = sentence.target;
      expect(n(target, '¿'), target).toBe(n(target, '?'));
      expect(n(target, '¡'), target).toBe(n(target, '!'));
      expect('.?!'.includes(lastChar(target)!), target).toBe(true);
      const first = firstChar(target)!;
      expect(first === '¿' || first === '¡' || isUpper(first), target).toBe(true);
      expect(target.split(' ').filter((p) => p !== '').length, target).toBeLessThanOrEqual(10);
      const german = sentence.meanings[0];
      expect(lastChar(target) === '?', `${target}: the question mark of the translation`).toBe(lastChar(german) === '?');
      expect(german.toLowerCase()).not.toBe(target.toLowerCase());
      expect(sentence.meanings.length, `${target}: one translation is the one the tiles ask for`).toBe(1);
    }
  });

  it('repeats no sentence of an earlier unit', () => {
    const seen = new Set<string>();
    for (const unit of data.units) {
      for (const sentence of unit.sentences) {
        const f = folded(sentence.target);
        expect(seen.has(f), `twice: ${sentence.target}`).toBe(false);
        seen.add(f);
      }
    }
    const fillSentences = new Set(fills.map((f) => folded(f.sentence.split('___').join(f.options[0]))));
    expect([...fillSentences].some((f) => seen.has(f)), 'a fill must not be a sentence of the course with its blank filled').toBe(false);
  });

  it('leaves no Spanish in the translations', () => {
    const names = ['Lucía', 'Berlín', 'Madrid'];
    const spanishMarks = new Set(chars('áéíóúñ¿¡'));
    const spanishWords = new Set(words.flatMap((w) => coverageTokens(w.target)).filter((t) => count(t) >= 4));
    const germanWords = new Set(['gusto', 'plus', 'mich', 'nett', 'casa', 'sehr', 'gut', 'ist', 'der', 'die', 'das']);
    for (const sentence of sentences) {
      let german = sentence.meanings[0];
      for (const name of names) german = german.split(name).join('');
      expect(chars(german).every((c) => !spanishMarks.has(c)), german).toBe(true);
      for (const token of coverageTokens(german)) {
        if (spanishWords.has(token) && !germanWords.has(token)) {
          const t = coverageTokens(sentence.target);
          expect(t.length > 0 && t.includes(token), `${german}: ${token} is Spanish`).toBe(false);
        }
      }
    }
    for (const word of words) for (const meaning of word.meanings) expect(chars(meaning).some((c) => spanishMarks.has(c)), meaning).toBe(false);
  });

  it('lets the verb agree with the subject in every sentence', () => {
    const singular = new Set(['mi', 'tu', 'su', 'el', 'la', 'él', 'ella', 'nuestra', 'nuestro']);
    const pluralSet = new Set(['mis', 'tus', 'sus', 'los', 'las', 'nosotros', 'ellos', 'ellas']);
    const singularVerbs = new Set(['es', 'tiene', 'está', 'gusta', 'trabaja']);
    const pluralVerbs = new Set(['son', 'tienen', 'están', 'gustan', 'trabajan']);
    let checked = 0;
    for (const sentence of sentences) {
      const tokens = plainTokens(sentence.target);
      const first = tokens[0];
      if (first === undefined || !(singular.has(first) || pluralSet.has(first))) continue;
      const verb = tokens.find((t) => singularVerbs.has(t) || pluralVerbs.has(t));
      if (verb === undefined) continue;
      expect(pluralSet.has(first), sentence.target).toBe(pluralVerbs.has(verb));
      checked++;
    }
    expect(checked).toBeGreaterThan(15);
  });

  it('lets adjectives agree with their noun in the description sentences', () => {
    const gender: Record<string, boolean> = {};
    for (const word of words) {
      const parts = word.target.split(' ');
      if (parts.length === 2 && (parts[0] === 'el' || parts[0] === 'la')) {
        gender[parts[1]] = parts[0] === 'el';
        gender[parts[1] + 's'] = parts[0] === 'el';
      }
    }
    gender['lápices'] = true; gender['chicos'] = true; gender['libros'] = true; gender['mochila'] = false; gender['mochilas'] = false;
    let checked = 0;
    for (const sentence of data.units[7].sentences) {
      const tokens = plainTokens(sentence.target);
      const isPlural = ['son', 'mis', 'dos'].some((t) => tokens.includes(t));
      const lastT = tokens[tokens.length - 1];
      if (lastT === undefined || !(lastT.endsWith('o') || lastT.endsWith('a') || lastT.endsWith('os') || lastT.endsWith('as') || lastT.endsWith('es') || lastT.endsWith('l'))) continue;
      const noun = tokens.find((t) => get(gender as Record<string, boolean>, t) !== undefined);
      if (noun === undefined) continue;
      const masculine = gender[noun];
      if (lastT.endsWith('os') || lastT.endsWith('as')) {
        expect(lastT.endsWith('os'), sentence.target).toBe(masculine);
        expect(isPlural, sentence.target).toBe(true);
      }
      if (lastT.endsWith('o')) expect(masculine && !isPlural, sentence.target).toBe(true);
      if (lastT.endsWith('a') && !lastT.endsWith('as') && !['tengo', 'tienes'].includes(lastT)) expect(!masculine || isPlural === false, sentence.target).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });
});

describe('Spanish course: fills, facts and words', () => {
  it('has fills with one right choice, none also a sentence of the course', () => {
    const known = new Set(sentences.map((s) => folded(s.target)));
    for (const fill of fills) {
      expect(inRange(fill.options.length, 2, 4), fill.sentence).toBe(true);
      expect(new Set(fill.options.map(folded)).size, `choices that read the same: ${fill.sentence}`).toBe(fill.options.length);
      expect(fill.sentence.split('___').length, `one blank: ${fill.sentence}`).toBe(2);
      for (const wrong of fill.options.slice(1)) {
        expect(known.has(folded(fill.sentence.split('___').join(wrong))), `${fill.sentence} with ${wrong} is a sentence of the course`).toBe(false);
      }
      expect(fill.why, `${fill.sentence} needs a reason`).not.toBe('');
    }
  });

  it('asks the verb fills for the form the paradigm gives', () => {
    const find = (s: string) => fills.find((f) => f.sentence === s)?.options[0];
    expect(find('Yo ___ Marta.')).toBe('soy');
    expect(find('¿De dónde ___ tú?')).toBe('eres');
    expect(find('Mi padre ___ un hermano.')).toBe('tiene');
    expect(find('Nosotros ___ en Madrid.')).toBe('vivimos');
    expect(find('El parque ___ cerca de mi casa.')).toBe('está');
    for (const fill of fills) {
      if (plainTokens(fill.sentence)[0] === 'yo' && ['soy', 'tengo', 'estoy'].includes(fill.options[0])) expect(fill.options[0], fill.sentence).toBe('soy');
    }
  });

  it('has facts with one right answer and real wrong ones', () => {
    for (const fact of data.units.flatMap((u) => u.facts)) {
      expect(fact.wrong.length, fact.question).not.toBe(0);
      expect(fact.wrong.length, fact.question).toBeLessThanOrEqual(3);
      const all = [fact.answer, ...fact.wrong].map(folded);
      expect(new Set(all).size, `answers that read the same: ${fact.question}`).toBe(all.length);
      expect(all.includes(''), `an answer of only punctuation reads empty to the engine: ${fact.question}`).toBe(false);
      expect(fact.why, fact.question).not.toBe('');
    }
  });

  it('shares no meaning between two words and teaches no word twice', () => {
    const owner = new Map<string, string>();
    const targets = new Set<string>();
    for (const word of words) {
      const t = folded(word.target);
      expect(targets.has(t), `twice: ${word.target}`).toBe(false);
      targets.add(t);
      for (const meaning of word.meanings) {
        const key = folded(meaning);
        expect(owner.get(key) === undefined || owner.get(key) === word.target, `${meaning}: ${owner.get(key) ?? ''} and ${word.target}`).toBe(true);
        owner.set(key, word.target);
      }
    }
  });

  it('does not teach both words of an accent pair', () => {
    for (const [accented, plain] of [['tú', 'tu'], ['él', 'el'], ['sí', 'si'], ['mí', 'mi'], ['qué', 'que']]) {
      expect(words.filter((w) => w.target === accented || w.target === plain).length, `${accented} and ${plain}`).toBeLessThanOrEqual(1);
    }
    expect(words.some((w) => w.target === 'tú') && words.some((w) => w.target === 'él')).toBe(true);
  });

  it('means what the greetings should at the right time of day', () => {
    const meanings = (t: string) => words.find((w) => w.target === t)?.meanings ?? [];
    expect(meanings('buenos días')).toEqual(['guten Morgen']);
    expect(meanings('buenas tardes')).toContain('guten Tag');
    expect(meanings('buenas noches')).toContain('gute Nacht');
    expect(meanings('¿qué tal?')).toContain("wie geht's?");
    expect(words.find((w) => w.target === 'buenos días')?.note).toBe('bis zum Mittagessen');
  });

  it('has the family words in pairs of one gender each', () => {
    const pairs: Array<[string, string]> = [['el padre', 'la madre'], ['el hermano', 'la hermana'], ['el abuelo', 'la abuela'], ['el hijo', 'la hija'], ['el amigo', 'la amiga'], ['el chico', 'la chica']];
    for (const [man, woman] of pairs) {
      expect(words.find((w) => w.target === man), man).toBeDefined();
      expect(words.find((w) => w.target === woman), woman).toBeDefined();
    }
    for (const [man, woman] of pairs.filter((p) => p[0] !== 'el padre')) {
      expect(dropLast(dropFirst(man, 3)), `${man} / ${woman} share a stem`).toBe(dropLast(dropFirst(woman, 3)));
      expect(man.endsWith('o') && woman.endsWith('a')).toBe(true);
    }
  });
});
