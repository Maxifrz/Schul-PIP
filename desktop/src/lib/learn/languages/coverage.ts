import { folded } from '../exercise';
import type { LanguageCourseData } from './data';

export interface Gap {
  unit: number;
  sentence: string;
  words: string[];
}

export const gapText = (g: Gap): string => `unit ${g.unit}: "${g.sentence}" uses ${g.words.join(', ')}`;

/** The tokens of a text as they are compared: lower case, no accents, no punctuation, no digits-only tokens. */
export function tokensOf(text: string): string[] {
  return text.split(/\s+/u).flatMap((piece) => {
    const f = folded(piece);
    return f === '' || /^\p{N}+$/u.test(f) ? [] : [f];
  });
}

/** Checks that a course's sentences only use words it has taught: the words of its units so far, the forms and the right fill words, and what `known:` lines allow. */
export function gaps(data: LanguageCourseData): Gap[] {
  const known = new Set<string>();
  const found: Gap[] = [];
  data.units.forEach((unit, index) => {
    for (const word of unit.words) tokensOf(word.target).forEach((t) => known.add(t));
    for (const form of unit.forms) form.answers.flatMap(tokensOf).forEach((t) => known.add(t));
    for (const fill of unit.fills) if (fill.options[0]) tokensOf(fill.options[0]).forEach((t) => known.add(t));
    for (const token of unit.known) tokensOf(token).forEach((t) => known.add(t));
    for (const sentence of unit.sentences) {
      const missing = tokensOf(sentence.target).filter((t) => !known.has(t));
      if (missing.length > 0) found.push({ unit: index + 1, sentence: sentence.target, words: missing });
    }
  });
  return found;
}
