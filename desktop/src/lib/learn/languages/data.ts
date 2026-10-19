import { pairsPrompt } from '../builder';
import type { CourseKind } from '../course';
import { folded } from '../exercise';

// The content of a language or school-subject course as plain values. It is written as text (see dsl.ts) and turned into
// exercises by provider.ts, so a course is data a teacher can read, not code.

/** A word or phrase in the language being learned with its meanings in the language the student knows. */
export interface LanguageWord {
  target: string;
  /** The first is shown as the right answer; every one is accepted when typed. */
  meanings: string[];
  /** Gender, case, a hint: "f", "Plural", "mit Dativ". Shown under the word in the unit's list; may be empty. */
  note: string;
  why: string;
}

export interface LanguageSentence {
  target: string;
  meanings: string[];
  why: string;
}

/** One form to produce: "ser, yo" gives "soy". Forms with the same text before the first comma belong to one group. */
export interface LanguageForm {
  prompt: string;
  answers: string[];
  why: string;
}

export const formGroup = (form: LanguageForm): string => form.prompt.split(',')[0].trim();

/** A sentence with a blank, written "Yo ___ Ana."; `options[0]` is right, the others are the wrong choices. */
export interface LanguageFill {
  sentence: string;
  options: string[];
  why: string;
}

/** A question with its answer and wrong answers. */
export interface LanguageFact {
  question: string;
  answer: string;
  wrong: string[];
  why: string;
}

export interface LanguageUnitData {
  sectionTitle: string;
  title: string;
  summary: string;
  /** Paragraphs separated by a blank line. */
  tip: string;
  words: LanguageWord[];
  sentences: LanguageSentence[];
  forms: LanguageForm[];
  fills: LanguageFill[];
  facts: LanguageFact[];
  /** Words that sentences may use without a `word:` line: names, inflected forms, function words nobody drills. */
  known: string[];
}

export const itemCount = (u: LanguageUnitData): number => u.words.length + u.sentences.length + u.forms.length + u.fills.length + u.facts.length;

export type LanguageInstruction = 'de' | 'en';

export interface LanguageCourseData {
  id: string;
  title: string;
  subtitle: string;
  kind: CourseKind;
  color: number;
  symbol: string;
  /** A BCP 47 tag for the speaker button, like "es-ES"; null for a language without a voice (Latin) or a subject. */
  speech: string | null;
  instruction: LanguageInstruction;
  /** "Spanisch": "Wie sagt man „Haus“ auf Spanisch?" */
  targetName: string;
  /** "Spanische": "Übersetze ins Spanische:" */
  intoName: string;
  /** "Deutsche": "Übersetze ins Deutsche:" */
  knownName: string;
  /** False for a course that only reads the language (Latin): nothing is asked to be said or written freely in it. */
  produces: boolean;
  units: LanguageUnitData[];
}

/** Mistakes in the content that would make an exercise unfair: a meaning two words share, a word twice, a fill without a wrong choice, a fact without wrong answers. */
export function dataProblems(data: LanguageCourseData): string[] {
  const problems: string[] = [];
  const meaningOwner = new Map<string, string>();
  const targets = new Set<string>();
  data.units.forEach((unit, index) => {
    const place = `unit ${index + 1}`;
    if (unit.tip === '') problems.push(`${place}: no tip`);
    if (itemCount(unit) < 8) problems.push(`${place}: only ${itemCount(unit)} items`);
    for (const word of unit.words) {
      const key = folded(word.target);
      if (targets.has(key)) problems.push(`${place}: ${word.target} twice`);
      targets.add(key);
      for (const meaning of word.meanings) {
        const f = folded(meaning);
        const owner = meaningOwner.get(f);
        if (owner !== undefined && owner !== word.target) problems.push(`${place}: "${meaning}" means both ${owner} and ${word.target}`);
        meaningOwner.set(f, word.target);
      }
    }
    const sentenceTargets = new Set<string>();
    for (const sentence of unit.sentences) {
      const key = folded(sentence.target);
      if (sentenceTargets.has(key)) problems.push(`${place}: sentence twice: ${sentence.target}`);
      sentenceTargets.add(key);
    }
    for (const fill of unit.fills) {
      if (!fill.sentence.includes('___')) problems.push(`${place}: no blank in ${fill.sentence}`);
      if (fill.options.length < 2) problems.push(`${place}: no wrong choice for ${fill.sentence}`);
    }
    for (const fact of unit.facts) if (fact.wrong.length === 0) problems.push(`${place}: no wrong answer for ${fact.question}`);
  });
  return problems;
}

/** The wording of the prompts in one instruction language. `{x}` is replaced by the word or sentence. */
export interface LanguageTexts {
  meaning: string;
  askTarget: string;
  listen: string;
  listenType: string;
  translateInto: string;
  translateFrom: string;
  form: string;
  fill: string;
  pairs: string;
}

export function textsFor(data: LanguageCourseData): LanguageTexts {
  if (data.kind === 'school') {
    return {
      meaning: 'Was bedeutet „{x}“?', askTarget: 'Welcher Begriff ist gemeint?\n{x}', listen: '', listenType: '', translateInto: '{x}', translateFrom: '{x}',
      form: 'Bilde die Form:\n{x}', fill: 'Welches Wort fehlt?\n{x}', pairs: pairsPrompt,
    };
  }
  if (data.instruction === 'de') {
    return {
      meaning: 'Was bedeutet „{x}“?', askTarget: `Wie sagt man „{x}“ auf ${data.targetName}?`, listen: 'Tippe auf den Lautsprecher. Was hörst du?',
      listenType: 'Tippe auf den Lautsprecher und schreib auf, was du hörst.', translateInto: `Übersetze ins ${data.intoName}:\n{x}`,
      translateFrom: `Übersetze ins ${data.knownName}:\n{x}`, form: 'Bilde die Form:\n{x}', fill: 'Welches Wort fehlt?\n{x}', pairs: pairsPrompt,
    };
  }
  return {
    meaning: 'What does “{x}” mean?', askTarget: `How do you say “{x}” in ${data.targetName}?`, listen: 'Tap the speaker. What do you hear?',
    listenType: 'Tap the speaker and type what you hear.', translateInto: `Translate into ${data.intoName}:\n{x}`,
    translateFrom: `Translate into ${data.knownName}:\n{x}`, form: 'Write the form:\n{x}', fill: 'Which word is missing?\n{x}', pairs: 'Match the pairs',
  };
}

export const fillText = (template: string, text: string): string => template.split('{x}').join(text);
