// Checks that a course's sentences only use words it has taught: the words of its units so far, the forms and the
// right fill words, and what `known:` lines allow. A course that fails teaches a student sentences they cannot read.
// Port of Lernwerk/Services/Learn/Languages/LanguageCoverage.swift.
import { type LanguageCourseData, folded } from './data';

export interface CoverageGap {
  readonly unit: number;
  readonly sentence: string;
  readonly words: readonly string[];
}

export function describeGap(gap: CoverageGap): string {
  return `unit ${gap.unit}: "${gap.sentence}" uses ${gap.words.join(', ')}`;
}

/** The tokens of a text as they are compared: lower case, no accents, no punctuation, no digits-only tokens. */
export function coverageTokens(text: string): string[] {
  const result: string[] = [];
  for (const piece of text.split(/[\p{White_Space}]+/u)) {
    if (piece === '') continue;
    const f = folded(piece);
    if (f === '' || /^\p{N}+$/u.test(f)) continue;
    result.push(f);
  }
  return result;
}

export function coverageGaps(data: LanguageCourseData): CoverageGap[] {
  const known = new Set<string>();
  const gaps: CoverageGap[] = [];
  data.units.forEach((unit, index) => {
    for (const word of unit.words) coverageTokens(word.target).forEach((t) => known.add(t));
    for (const form of unit.forms) form.answers.flatMap(coverageTokens).forEach((t) => known.add(t));
    for (const fill of unit.fills) {
      if (fill.options.length > 0) coverageTokens(fill.options[0]).forEach((t) => known.add(t));
    }
    for (const token of unit.known) coverageTokens(token).forEach((t) => known.add(t));
    for (const sentence of unit.sentences) {
      const missing = coverageTokens(sentence.target).filter((t) => !known.has(t));
      if (missing.length > 0) gaps.push({ unit: index + 1, sentence: sentence.target, words: missing });
    }
  });
  return gaps;
}

export const LanguageCoverage = { tokens: coverageTokens, gaps: coverageGaps, describe: describeGap };
