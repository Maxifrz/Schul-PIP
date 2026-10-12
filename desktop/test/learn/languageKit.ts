// Small helpers for the language course tests (the Swift tests lean on String/Character/CharacterSet).
import type { CourseProvider } from '../../src/lib/learn/course';
import type { LearnExercise } from '../../src/lib/learn/exercise';

/** Characters (code points) of a text. */
export const chars = (text: string): string[] => Array.from(text);
export const isLetter = (c: string): boolean => /^\p{L}$/u.test(c);
export const isUpper = (c: string | undefined): boolean => c !== undefined && /^\p{Lu}$/u.test(c);
export const isPunct = (c: string): boolean => /^\p{P}$/u.test(c);
export const isSpace = (c: string): boolean => /^[\p{White_Space}]$/u.test(c);
export const last = <T>(a: readonly T[]): T | undefined => a[a.length - 1];
export const lastChar = (s: string): string | undefined => last(chars(s));
export const firstChar = (s: string): string | undefined => chars(s)[0];
export const dropFirst = (s: string, n = 1): string => chars(s).slice(n).join('');
export const dropLast = (s: string, n = 1): string => chars(s).slice(0, Math.max(0, chars(s).length - n)).join('');
export const suffix = (s: string, n: number): string => chars(s).slice(-n).join('');
export const prefix = (s: string, n: number): string => chars(s).slice(0, n).join('');
export const count = (s: string): number => chars(s).length;
export const has = (o: Record<string, string>, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
export const get = <T>(o: Record<string, T>, k: string): T | undefined => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);

/** Swift `trimmingCharacters(in:)` with a predicate. */
export function trimWith(text: string, drop: (c: string) => boolean): string {
  const c = chars(text);
  let a = 0;
  let b = c.length;
  while (a < b && drop(c[a])) a++;
  while (b > a && drop(c[b - 1])) b--;
  return c.slice(a, b).join('');
}

/** Swift `split(whereSeparator: \.isWhitespace)`. */
export const words = (text: string): string[] => text.split(/[\p{White_Space}]+/u).filter((p) => p !== '');

/** Swift `text.lowercased().split(whereSeparator: { !$0.isLetter })`. */
export const lettersOnly = (text: string): string[] => text.toLowerCase().split(/[^\p{L}]+/u).filter((p) => p !== '');

/** Swift `components(separatedBy:)`. */
export const parts = (text: string, separator: string): string[] => text.split(separator);

export const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const inRange = (n: number, a: number, b: number): boolean => n >= a && n <= b;

/** Every exercise of the lessons/practice/checkpoint of a unit (not the chest) for seeds. */
export function unitExercises(provider: CourseProvider, unit: number, seeds: number[]): LearnExercise[] {
  const out: LearnExercise[] = [];
  for (const node of provider.course.units[unit].nodes) {
    if (node.kind === 'chest') continue;
    for (const s of seeds) out.push(...provider.exercises(node, BigInt(s)));
  }
  return out;
}

/** exercise id -> last character, per card key (Swift `exercisesByCard`). */
export function formsByCard(provider: CourseProvider, unit: number, seeds: number[]): Map<string, Set<string>> {
  const seen = new Map<string, Set<string>>();
  for (const exercise of unitExercises(provider, unit, seeds)) {
    for (const key of exercise.cardKeys) {
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key)!.add(lastChar(exercise.id) ?? '?');
    }
  }
  return seen;
}

export const seq = (a: number, b: number): number[] => range(a, b);
export const unitNode = (course: string, unit: number, suffixId: string): string => `${course}.u${String(unit).padStart(2, '0')}.${suffixId}`;
