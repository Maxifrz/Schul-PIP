import type { CourseKind } from '../course';
import { LanguageCourseData, LanguageFact, LanguageFill, LanguageForm, LanguageInstruction, LanguageSentence, LanguageUnitData, LanguageWord } from './data';

/**
 * Reads a course written as text. One line, one thing: `key: value`. Blank lines and lines starting with `#` are ignored.
 * A value may end with ` ## why` (one sentence that explains the answer).
 *
 *     course: es                       the id; node ids start with it
 *     title / subtitle / kind (language | school) / color (RRGGBB) / symbol / speech / instruction (de | en)
 *     target-name / into-name / known-name / produce (yes | no)
 *     section: A1 · Erste Schritte     starts a section; units follow
 *     unit: Hallo und Tschüss | Begrüßen und sich vorstellen
 *     tip: / known: / word: target = meaning; other | note / sentence: / form: / fill: Yo ___ Ana. = soy | eres | es / fact: q = answer | wrong
 */
export function parseCourse(source: string): { data: LanguageCourseData; errors: string[] } {
  const fields: Record<string, string> = {};
  const errors: string[] = [];
  const units: Array<{ sectionTitle: string; title: string; summary: string; tips: string[]; words: LanguageWord[]; sentences: LanguageSentence[]; forms: LanguageForm[]; fills: LanguageFill[]; facts: LanguageFact[]; known: string[] }> = [];
  let section = '';
  let current: (typeof units)[number] | null = null;

  const flush = () => {
    if (current) units.push(current);
    current = null;
  };
  const split = (text: string, separator: string): [string, string] => {
    const at = text.indexOf(separator);
    return at < 0 ? [text, ''] : [text.slice(0, at).trim(), text.slice(at + separator.length).trim()];
  };
  const list = (text: string, separator: string) => text.split(separator).map((s) => s.trim()).filter((s) => s !== '');

  source.split(/\r?\n/).forEach((raw, offset) => {
    const number = offset + 1;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const colon = line.indexOf(':');
    if (colon < 0) {
      errors.push(`line ${number}: no "key: value"`);
      return;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    switch (key) {
      case 'course': case 'title': case 'subtitle': case 'kind': case 'color': case 'symbol': case 'speech': case 'instruction': case 'target-name': case 'into-name': case 'known-name': case 'produce':
        fields[key] = value;
        return;
      case 'section':
        flush();
        section = value;
        return;
      case 'unit': {
        flush();
        const parts = value.split(' | ');
        const title = parts[0].trim();
        if (title === '') errors.push(`line ${number}: unit without a title`);
        current = { sectionTitle: section, title, summary: parts.length > 1 ? parts[1].trim() : '', tips: [], words: [], sentences: [], forms: [], fills: [], facts: [], known: [] };
        return;
      }
      case 'tip': case 'word': case 'sentence': case 'form': case 'fill': case 'fact': case 'known':
        if (!current) {
          errors.push(`line ${number}: ${key} before the first unit`);
          return;
        }
        break;
      default:
        errors.push(`line ${number}: unknown key "${key}"`);
        return;
    }
    const unit = current!;
    if (key === 'tip') {
      if (value === '') errors.push(`line ${number}: empty tip`);
      else unit.tips.push(value);
      return;
    }
    if (key === 'known') {
      const tokens = list(value, ',');
      if (tokens.length === 0) errors.push(`line ${number}: empty known`);
      else unit.known.push(...tokens);
      return;
    }
    const [body, why] = split(value, ' ## ');
    const equals = body.indexOf(' = ');
    if (equals < 0) {
      errors.push(`line ${number}: ${key} needs " = "`);
      return;
    }
    const left = body.slice(0, equals).trim();
    const right = body.slice(equals + 3).trim();
    if (left === '' || right === '') {
      errors.push(`line ${number}: ${key} with an empty side`);
      return;
    }
    switch (key) {
      case 'word': {
        const [meaningText, note] = split(right, ' | ');
        const meanings = list(meaningText, ';');
        if (meanings.length === 0) errors.push(`line ${number}: word without a meaning`);
        unit.words.push({ target: left, meanings, note, why });
        break;
      }
      case 'sentence':
        unit.sentences.push({ target: left, meanings: list(right, ';'), why });
        break;
      case 'form':
        unit.forms.push({ prompt: left, answers: list(right, ';'), why });
        break;
      case 'fill': {
        const options = list(right, '|');
        if (!left.includes('___')) errors.push(`line ${number}: fill without ___`);
        if (options.length < 2) errors.push(`line ${number}: fill needs a right and a wrong choice`);
        unit.fills.push({ sentence: left, options, why });
        break;
      }
      default: {
        const answers = list(right, '|');
        if (answers.length < 2) errors.push(`line ${number}: fact needs an answer and a wrong answer`);
        unit.facts.push({ question: left, answer: answers[0] ?? '', wrong: answers.slice(1), why });
      }
    }
  });
  flush();

  const field = (key: string): string => {
    if (fields[key] === undefined) errors.push(`missing "${key}:"`);
    return fields[key] ?? '';
  };
  const id = field('course');
  const kindText = fields.kind ?? 'language';
  const kind: CourseKind = kindText === 'school' ? 'school' : 'language';
  if (!['language', 'school'].includes(kindText)) errors.push('kind must be language or school');
  if (fields.produce !== undefined && !['yes', 'no'].includes(fields.produce)) errors.push('produce must be yes or no');
  const instruction: LanguageInstruction = fields.instruction === 'en' ? 'en' : 'de';
  if (fields.instruction !== undefined && !['de', 'en'].includes(fields.instruction)) errors.push('instruction must be de or en');
  const colorText = field('color');
  if (!/^[0-9a-fA-F]{6}$/.test(colorText)) errors.push('color must be six hex digits');
  if (units.length === 0) errors.push('no units');
  const built: LanguageUnitData[] = units.map((u) => ({
    sectionTitle: u.sectionTitle, title: u.title, summary: u.summary, tip: u.tips.join('\n\n'), words: u.words, sentences: u.sentences,
    forms: u.forms, fills: u.fills, facts: u.facts, known: u.known,
  }));
  const data: LanguageCourseData = {
    id, title: field('title'), subtitle: field('subtitle'), kind, color: /^[0-9a-fA-F]{6}$/.test(colorText) ? parseInt(colorText, 16) : 0x888888,
    symbol: field('symbol'), speech: fields.speech ? fields.speech : null, instruction, targetName: fields['target-name'] ?? fields.title ?? '',
    intoName: fields['into-name'] ?? fields.title ?? '', knownName: fields['known-name'] ?? (instruction === 'de' ? 'Deutsche' : 'English'),
    produces: fields.produce !== 'no', units: built,
  };
  return { data, errors };
}
