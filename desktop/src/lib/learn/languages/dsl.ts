// Reads a course written as text. One line, one thing: `key: value`. Blank lines and lines starting with `#` are
// ignored. A value may end with ` ## why` (one sentence that explains the answer).
//
//     course: es                       the id; node ids start with it
//     title: Spanisch
//     subtitle: Für Deutschsprachige · A1
//     kind: language                   language | school
//     color: D9903A                    0xRRGGBB without the 0x
//     symbol: text.bubble.fill         an SF Symbol
//     speech: es-ES                    optional: BCP 47 tag for the speaker button
//     instruction: de                  de | en: the language of the prompts (default de)
//     target-name: Spanisch            "Wie sagt man „Haus“ auf Spanisch?"
//     into-name: Spanische             "Übersetze ins Spanische:"
//     known-name: Deutsche             "Übersetze ins Deutsche:" (default by instruction)
//     produce: no                      optional: yes (default) or no
//
//     section: A1 · Erste Schritte     starts a section; units follow
//     unit: Hallo und Tschüss | Begrüßen und sich vorstellen
//     tip: A paragraph of the unit's guide. More tip lines are more paragraphs.
//     known: Ana, Luis, Madrid         words sentences may use without a word: line
//     word: hola = hallo               target = meaning; other meanings | note
//     sentence: Me llamo Ana. = Ich heiße Ana.
//     form: ser, yo = soy ## A verb form to produce; the text before the comma names the verb
//     fill: Yo ___ Ana. = soy | eres | es      first choice is right, the others are wrong
//     fact: Welcher Fall folgt auf „mit“? = Dativ | Akkusativ | Genitiv ## Mit verlangt den Dativ.
//
// Port of Lernwerk/Services/Learn/Languages/LanguageDSL.swift.
import {
  type CourseKind,
  type LanguageCourseData,
  type LanguageFact,
  type LanguageFill,
  type LanguageForm,
  type LanguageInstruction,
  type LanguageSentence,
  type LanguageUnitData,
  type LanguageWord,
  trimWhitespace,
} from './data';

export interface ParsedCourse {
  data: LanguageCourseData;
  errors: string[];
}

interface UnitBuilder {
  sectionTitle: string;
  title: string;
  summary: string;
  tips: string[];
  words: LanguageWord[];
  sentences: LanguageSentence[];
  forms: LanguageForm[];
  fills: LanguageFill[];
  facts: LanguageFact[];
  known: string[];
}

function buildUnit(b: UnitBuilder): LanguageUnitData {
  return {
    sectionTitle: b.sectionTitle,
    title: b.title,
    summary: b.summary,
    tip: b.tips.join('\n\n'),
    words: b.words,
    sentences: b.sentences,
    forms: b.forms,
    fills: b.fills,
    facts: b.facts,
    known: b.known,
  };
}

const fieldKeys = new Set([
  'course', 'title', 'subtitle', 'kind', 'color', 'symbol', 'speech', 'instruction', 'target-name', 'into-name',
  'known-name', 'produce',
]);
const itemKeys = new Set(['tip', 'word', 'sentence', 'form', 'fill', 'fact', 'known']);

/** Splits at the first occurrence of `separator`; the second part is empty when it does not occur. */
function splitAt(text: string, separator: string): [string, string] {
  const index = text.indexOf(separator);
  if (index < 0) return [text, ''];
  return [trimWhitespace(text.slice(0, index)), trimWhitespace(text.slice(index + separator.length))];
}

/** Pieces between `separator`, trimmed, without empty ones. */
function list(text: string, separator: string): string[] {
  return text.split(separator).map(trimWhitespace).filter((piece) => piece !== '');
}

/** Swift `UInt32(text, radix: 16)`: an optional sign, then hex digits that fit 32 bits. */
function parseHex32(text: string): number | null {
  if (!/^[+]?[0-9a-fA-F]+$/.test(text)) return null;
  const value = parseInt(text, 16);
  return value <= 0xffffffff ? value : null;
}

class Parser {
  private fields = new Map<string, string>();
  private section = '';
  private current: UnitBuilder | null = null;
  private units: UnitBuilder[] = [];
  private errors: string[] = [];

  read(raw: string, number: number): void {
    const line = trimWhitespace(raw);
    if (line === '' || line.startsWith('#')) return;
    const colon = line.indexOf(':');
    if (colon < 0) {
      this.errors.push(`line ${number}: no "key: value"`);
      return;
    }
    const key = trimWhitespace(line.slice(0, colon)).toLowerCase();
    const value = trimWhitespace(line.slice(colon + 1));
    if (fieldKeys.has(key)) {
      this.fields.set(key, value);
    } else if (key === 'section') {
      this.flush();
      this.section = value;
    } else if (key === 'unit') {
      this.flush();
      const parts = value.split(' | ');
      const title = trimWhitespace(parts[0]);
      if (title === '') this.errors.push(`line ${number}: unit without a title`);
      this.current = {
        sectionTitle: this.section,
        title,
        summary: parts.length > 1 ? trimWhitespace(parts[1]) : '',
        tips: [], words: [], sentences: [], forms: [], fills: [], facts: [], known: [],
      };
    } else if (itemKeys.has(key)) {
      if (this.current === null) {
        this.errors.push(`line ${number}: ${key} before the first unit`);
        return;
      }
      this.item(this.current, key, value, number);
    } else {
      this.errors.push(`line ${number}: unknown key "${key}"`);
    }
  }

  private item(unit: UnitBuilder, key: string, value: string, number: number): void {
    if (key === 'tip') {
      if (value === '') this.errors.push(`line ${number}: empty tip`);
      else unit.tips.push(value);
      return;
    }
    if (key === 'known') {
      const tokens = list(value, ',');
      if (tokens.length === 0) this.errors.push(`line ${number}: empty known`);
      else unit.known.push(...tokens);
      return;
    }
    const [body, why] = splitAt(value, ' ## ');
    const equals = body.indexOf(' = ');
    if (equals < 0) {
      this.errors.push(`line ${number}: ${key} needs " = "`);
      return;
    }
    const left = trimWhitespace(body.slice(0, equals));
    const right = trimWhitespace(body.slice(equals + 3));
    if (left === '' || right === '') {
      this.errors.push(`line ${number}: ${key} with an empty side`);
      return;
    }
    switch (key) {
      case 'word': {
        const [meaningText, note] = splitAt(right, ' | ');
        const meanings = list(meaningText, ';');
        if (meanings.length === 0) this.errors.push(`line ${number}: word without a meaning`);
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
        if (!left.includes('___')) this.errors.push(`line ${number}: fill without ___`);
        if (options.length < 2) this.errors.push(`line ${number}: fill needs a right and a wrong choice`);
        unit.fills.push({ sentence: left, options, why });
        break;
      }
      default: {
        const answers = list(right, '|');
        if (answers.length < 2) this.errors.push(`line ${number}: fact needs an answer and a wrong answer`);
        unit.facts.push({ question: left, answer: answers[0] ?? '', wrong: answers.slice(1), why });
      }
    }
  }

  private flush(): void {
    if (this.current !== null) this.units.push(this.current);
    this.current = null;
  }

  finish(): ParsedCourse {
    this.flush();
    const errors = this.errors;
    const fields = this.fields;
    const field = (key: string): string => {
      if (!fields.has(key)) errors.push(`missing "${key}:"`);
      return fields.get(key) ?? '';
    };
    const id = field('course');
    const kindText = fields.get('kind') ?? 'language';
    const kind: CourseKind = kindText === 'school' ? 'school' : 'language';
    if (!['language', 'school'].includes(kindText)) errors.push('kind must be language or school');
    const produceText = fields.get('produce');
    if (produceText !== undefined && !['yes', 'no'].includes(produceText)) errors.push('produce must be yes or no');
    const instructionText = fields.get('instruction');
    const instruction: LanguageInstruction = instructionText === 'en' ? 'en' : 'de';
    if (instructionText !== undefined && instructionText !== 'de' && instructionText !== 'en') {
      errors.push('instruction must be de or en');
    }
    const colorText = field('color');
    const color = parseHex32(colorText);
    if (color === null || Array.from(colorText).length !== 6) errors.push('color must be six hex digits');
    if (this.units.length === 0) errors.push('no units');
    const title = field('title');
    const subtitle = field('subtitle');
    const symbol = field('symbol');
    const speech = fields.get('speech');
    const data: LanguageCourseData = {
      id,
      title,
      subtitle,
      kind,
      color: color ?? 0x888888,
      symbol,
      speech: speech === undefined || speech === '' ? null : speech,
      instruction,
      targetName: fields.get('target-name') ?? fields.get('title') ?? '',
      intoName: fields.get('into-name') ?? fields.get('title') ?? '',
      knownName: fields.get('known-name') ?? (instruction === 'de' ? 'Deutsche' : 'English'),
      produces: fields.get('produce') !== 'no',
      units: this.units.map(buildUnit),
    };
    return { data, errors };
  }
}

/** Parses a course text. `errors` are the format errors, each with its line number. */
export function parseLanguageCourse(source: string): ParsedCourse {
  const parser = new Parser();
  // Swift: components(separatedBy: .newlines) splits at every single newline character ("\r\n" counts twice).
  source.split(/[\n\r\u000B\u000C\u0085\u2028\u2029]/).forEach((raw, offset) => parser.read(raw, offset + 1));
  return parser.finish();
}

export const LanguageDSL = { parse: parseLanguageCourse };
