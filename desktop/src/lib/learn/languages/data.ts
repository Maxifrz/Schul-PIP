// The content of a language or school-subject course as plain values. It is written as text (see dsl.ts) and
// turned into exercises by the course provider, so a course is data a teacher can read, not code.
// Port of Lernwerk/Services/Learn/Languages/LanguageData.swift.
import type { CourseKind } from '../course';
import { folded } from '../exercise';
import { ExerciseBuilder } from '../exerciseConstants';

export type { CourseKind };
export { folded };

const pairsPrompt = ExerciseBuilder.pairsPrompt;

/** A word or phrase in the language being learned with its meanings in the language the student knows. */
export interface LanguageWord {
  readonly target: string;
  /** The first is shown as the right answer; every one is accepted when typed. */
  readonly meanings: readonly string[];
  /** Gender, case, a hint: "f", "Plural", "mit Dativ". Shown under the word in the unit's list; may be empty. */
  readonly note: string;
  readonly why: string;
}

export interface LanguageSentence {
  readonly target: string;
  readonly meanings: readonly string[];
  readonly why: string;
}

/** One form to produce: "ser, yo" gives "soy". Forms with the same text before the first comma belong to one group. */
export interface LanguageForm {
  readonly prompt: string;
  readonly answers: readonly string[];
  readonly why: string;
}

/** A sentence with a blank, written "Yo ___ Ana."; `options[0]` is right, the others are the wrong choices. */
export interface LanguageFill {
  readonly sentence: string;
  readonly options: readonly string[];
  readonly why: string;
}

/** A question with its answer and wrong answers. */
export interface LanguageFact {
  readonly question: string;
  readonly answer: string;
  readonly wrong: readonly string[];
  readonly why: string;
}

export interface LanguageUnitData {
  readonly sectionTitle: string;
  readonly title: string;
  readonly summary: string;
  /** Paragraphs separated by a blank line. */
  readonly tip: string;
  readonly words: readonly LanguageWord[];
  readonly sentences: readonly LanguageSentence[];
  readonly forms: readonly LanguageForm[];
  readonly fills: readonly LanguageFill[];
  readonly facts: readonly LanguageFact[];
  /** Words that sentences may use without a `word:` line: names, inflected forms, function words nobody drills. */
  readonly known: readonly string[];
}

/** The language the prompts are written in. */
export type LanguageInstruction = 'de' | 'en';

export interface LanguageCourseData {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly kind: CourseKind;
  readonly color: number;
  readonly symbol: string;
  /** A BCP 47 tag for the speaker button, like "es-ES"; null for a language without a voice (Latin) or a subject. */
  readonly speech: string | null;
  readonly instruction: LanguageInstruction;
  /** "Spanisch": "Wie sagt man „Haus“ auf Spanisch?" */
  readonly targetName: string;
  /** "Spanische": "Übersetze ins Spanische:" */
  readonly intoName: string;
  /** "Deutsche": "Übersetze ins Deutsche:" */
  readonly knownName: string;
  /** False for a course that only reads the language (Latin). */
  readonly produces: boolean;
  readonly units: readonly LanguageUnitData[];
}

export function unitItemCount(unit: LanguageUnitData): number {
  return unit.words.length + unit.sentences.length + unit.forms.length + unit.fills.length + unit.facts.length;
}

/** Forms with the same text before the first comma belong to one group (the verb). */
export function formGroup(form: LanguageForm): string {
  const prompt = form.prompt;
  // Swift: prompt.split(separator: ",", maxSplits: 1).first (empty pieces are omitted)
  let start = 0;
  while (start < prompt.length && prompt[start] === ',') start++;
  if (start >= prompt.length) return prompt;
  const end = prompt.indexOf(',', start);
  return trimWhitespace(prompt.slice(start, end < 0 ? prompt.length : end));
}

/** Swift `trimmingCharacters(in: .whitespaces)`: tab and the space separators, not newlines. */
export function trimWhitespace(text: string): string {
  return text.replace(/^[\t\p{Zs}]+/u, '').replace(/[\t\p{Zs}]+$/u, '');
}

/**
 * Mistakes in the content that would make an exercise unfair: a meaning two words share (a typed answer would be
 * ambiguous), a word twice, a fill without a wrong choice, a fact without wrong answers.
 */
export function problems(data: LanguageCourseData): string[] {
  const result: string[] = [];
  const meaningOwner = new Map<string, string>();
  const targets = new Set<string>();
  data.units.forEach((unit, index) => {
    const place = `unit ${index + 1}`;
    if (unit.tip === '') result.push(`${place}: no tip`);
    if (unitItemCount(unit) < 8) result.push(`${place}: only ${unitItemCount(unit)} items`);
    for (const word of unit.words) {
      const key = folded(word.target);
      if (targets.has(key)) result.push(`${place}: ${word.target} twice`);
      else targets.add(key);
      for (const meaning of word.meanings) {
        const foldedMeaning = folded(meaning);
        const owner = meaningOwner.get(foldedMeaning);
        if (owner !== undefined && owner !== word.target) {
          result.push(`${place}: "${meaning}" means both ${owner} and ${word.target}`);
        }
        meaningOwner.set(foldedMeaning, word.target);
      }
    }
    const sentenceTargets = new Set<string>();
    for (const sentence of unit.sentences) {
      const key = folded(sentence.target);
      if (sentenceTargets.has(key)) result.push(`${place}: sentence twice: ${sentence.target}`);
      else sentenceTargets.add(key);
    }
    for (const fill of unit.fills) {
      if (!fill.sentence.includes('___')) result.push(`${place}: no blank in ${fill.sentence}`);
      if (fill.options.length < 2) result.push(`${place}: no wrong choice for ${fill.sentence}`);
    }
    for (const fact of unit.facts) {
      if (fact.wrong.length === 0) result.push(`${place}: no wrong answer for ${fact.question}`);
    }
  });
  return result;
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

export function makeLanguageTexts(data: LanguageCourseData): LanguageTexts {
  if (data.kind === 'school') {
    return {
      meaning: 'Was bedeutet „{x}“?',
      askTarget: 'Welcher Begriff ist gemeint?\n{x}',
      listen: '',
      listenType: '',
      translateInto: '{x}',
      translateFrom: '{x}',
      form: 'Bilde die Form:\n{x}',
      fill: 'Welches Wort fehlt?\n{x}',
      pairs: pairsPrompt,
    };
  }
  if (data.instruction === 'de') {
    return {
      meaning: 'Was bedeutet „{x}“?',
      askTarget: `Wie sagt man „{x}“ auf ${data.targetName}?`,
      listen: 'Tippe auf den Lautsprecher. Was hörst du?',
      listenType: 'Tippe auf den Lautsprecher und schreib auf, was du hörst.',
      translateInto: `Übersetze ins ${data.intoName}:\n{x}`,
      translateFrom: `Übersetze ins ${data.knownName}:\n{x}`,
      form: 'Bilde die Form:\n{x}',
      fill: 'Welches Wort fehlt?\n{x}',
      pairs: pairsPrompt,
    };
  }
  return {
    meaning: 'What does “{x}” mean?',
    askTarget: `How do you say “{x}” in ${data.targetName}?`,
    listen: 'Tap the speaker. What do you hear?',
    listenType: 'Tap the speaker and type what you hear.',
    translateInto: `Translate into ${data.intoName}:\n{x}`,
    translateFrom: `Translate into ${data.knownName}:\n{x}`,
    form: 'Write the form:\n{x}',
    fill: 'Which word is missing?\n{x}',
    pairs: 'Match the pairs',
  };
}

/** Replaces every `{x}` of a template. */
export function fillTemplate(template: string, text: string): string {
  return template.split('{x}').join(text);
}
