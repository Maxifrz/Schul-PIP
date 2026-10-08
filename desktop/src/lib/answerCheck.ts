// Checks a typed answer against a flashcard's back without any AI. A port of Lernwerk/Services/Review/AnswerCheck.swift
// and android/.../AnswerCheck.kt: the same algorithm, so a card is judged the same on every device.

export type Verdict = 'correct' | 'wrong';

const isLetter = (c: string) => /\p{L}/u.test(c);
const isNumber = (c: string) => /\p{N}/u.test(c);
const hasNumber = (s: string) => Array.from(s).some(isNumber);
const length = (s: string) => Array.from(s).length;

export function evaluate(answer: string, expected: string): Verdict {
  const given = normalize(answer);
  if (compact(given) === '') return 'wrong';
  for (const alternative of alternatives(expected)) {
    if (matches(given, alternative)) return 'correct';
  }
  return matches(given, expected) ? 'correct' : 'wrong';
}

/** "Berlin / Bundeshauptstadt", "A; B" or "A oder B" accept either part. A slash inside a fraction does not split. */
export function alternatives(expected: string): string[] {
  let parts = [expected];
  for (const separator of [' / ', ';', '\n', ' oder ']) {
    parts = parts.flatMap((part) => part.split(separator));
  }
  const trimmed = parts.map((part) => part.trim()).filter((part) => part !== '');
  return trimmed.length > 1 ? trimmed : [];
}

/** Lower case without umlauts and ß, "ae/oe/ue" folded to the same letters, decimal comma as a point and the usual
 * maths symbols as plain characters, so "x²" and "x^2" or "0,5" and "0.5" read the same. */
export function normalize(text: string): string {
  let result = text.toLowerCase();
  const symbols: Array<[string, string]> = [
    ['ß', 'ss'], ['²', '^2'], ['³', '^3'], ['×', '*'], ['·', '*'], ['−', '-'], ['–', '-'], ['√', 'sqrt'], ['π', 'pi'],
  ];
  for (const [from, to] of symbols) result = result.split(from).join(to);
  result = result.replace(/(\d),(\d)/g, '$1.$2');
  result = result.normalize('NFD').replace(/\p{M}/gu, '');
  for (const [from, to] of [['ae', 'a'], ['oe', 'o'], ['ue', 'u']] as const) result = result.split(from).join(to);
  return result;
}

/** Letters and digits only: "2 x" and "2x", "x^2" and "x2" are the same formula. */
export function compact(normalized: string): string {
  return Array.from(normalized).filter((c) => isLetter(c) || isNumber(c)).join('');
}

export function tokens(normalized: string): string[] {
  const result: string[] = [];
  let current = '';
  const flush = () => {
    while (current.endsWith('.')) current = current.slice(0, -1);
    if (current !== '') result.push(current);
    current = '';
  };
  for (const character of Array.from(normalized)) {
    const last = current === '' ? '' : (Array.from(current).pop() as string);
    if (isLetter(character) || isNumber(character) || (character === '.' && last !== '' && isNumber(last))) {
      current += character;
    } else {
      flush();
    }
  }
  flush();
  return result;
}

const stopwords = new Set(
  (
    'der die das den dem des ein eine einer einem einen eines und oder ist sind war waren wird werden wurde wurden ' +
    'hat haben hatte kann können nicht mit von zu zum zur im in an auf aus bei für nach als auch wenn dann dass da ' +
    'so wie man es sie er wir ihr ihre sein seine seiner durch über unter vor zwischen nur noch sich dies diese ' +
    'dieser dieses was wer wo wann um am vom beim ins sowie also bzw ca etwa'
  )
    .split(' ')
    .map(normalize),
);

/** The words that carry the meaning: no filler words, nothing shorter than three letters unless it has a digit. */
export function keyTokens(normalized: string): string[] {
  const seen: string[] = [];
  for (const token of tokens(normalized)) {
    if (stopwords.has(token)) continue;
    if (!(length(token) >= 3 || hasNumber(token)) || seen.includes(token)) continue;
    seen.push(token);
  }
  return seen;
}

function matches(given: string, expectedRaw: string): boolean {
  const wanted = normalize(expectedRaw);
  const givenCompact = compact(given);
  const wantedCompact = compact(wanted);
  if (givenCompact === wantedCompact) return true;
  const keys = keyTokens(wanted);
  if (keys.length === 0) {
    return distance(givenCompact, wantedCompact) <= (length(wantedCompact) >= 8 ? 1 : 0);
  }
  const answerTokens = tokens(given);
  // Numbers have to be exactly right.
  for (const key of keys) {
    if (hasNumber(key) && !answerTokens.includes(key)) return false;
  }
  const found = keys.filter((key) => answerTokens.some((token) => tokenMatch(token, key))).length;
  // Up to three key words must all be there; for longer answers three in five are enough.
  const needed = keys.length <= 3 ? keys.length : Math.ceil(keys.length * 0.6);
  return found >= needed;
}

/** Equal, one the beginning of the other ("Ableitung" and "Ableitungen"), or a typo away for words of five letters or
 * more. */
export function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (hasNumber(a) || hasNumber(b)) return false;
  const [shorter, longer] = length(a) <= length(b) ? [a, b] : [b, a];
  if (length(shorter) < 5) return false;
  if (longer.startsWith(shorter) && length(longer) - length(shorter) <= 4) return true;
  return distance(a, b) <= (length(longer) >= 9 ? 2 : 1);
}

/** Levenshtein distance. */
export function distance(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let previous = Array.from({ length: y.length + 1 }, (_, index) => index);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) {
      row.push(Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)));
    }
    previous = row;
  }
  return previous[y.length];
}
