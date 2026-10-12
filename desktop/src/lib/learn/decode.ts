// Tolerant decoding of persisted JSON, the way the Swift types do it: a field that is missing, null or of the wrong
// type falls back on its default (`try? container.decodeIfPresent(T.self, forKey:) ?? fallback`). A decoder returns
// the value or FAIL; any failure inside a field makes the whole field fall back, like a throwing Codable init.

export const FAIL: unique symbol = Symbol('decode failure');
export type Decoder<T> = (value: unknown) => T | typeof FAIL;

export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Int: a JSON number without a fraction (Swift's JSONDecoder refuses 5.5 for an Int). */
export const dInt: Decoder<number> = (v) => (typeof v === 'number' && Number.isInteger(v) ? v : FAIL);
export const dDouble: Decoder<number> = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : FAIL);
export const dBool: Decoder<boolean> = (v) => (typeof v === 'boolean' ? v : FAIL);
export const dString: Decoder<string> = (v) => (typeof v === 'string' ? v : FAIL);

export function dArray<T>(element: Decoder<T>): Decoder<T[]> {
  return (v) => {
    if (!Array.isArray(v)) return FAIL;
    const out: T[] = [];
    for (const item of v) {
      const decoded = element(item);
      if (decoded === FAIL) return FAIL;
      out.push(decoded);
    }
    return out;
  };
}

/** Set<String> (stored as an array). */
export function dSet<T>(element: Decoder<T>, key: (value: T) => string = String): Decoder<Set<T>> {
  const array = dArray(element);
  return (v) => {
    const list = array(v);
    if (list === FAIL) return FAIL;
    const seen = new Set<string>();
    const out = new Set<T>();
    for (const item of list) {
      const k = key(item);
      if (!seen.has(k)) {
        seen.add(k);
        out.add(item);
      }
    }
    return out;
  };
}

/** [String: T] (a JSON object). */
export function dRecord<T>(element: Decoder<T>): Decoder<Record<string, T>> {
  return (v) => {
    if (!isObject(v)) return FAIL;
    const out: Record<string, T> = {};
    for (const [k, item] of Object.entries(v)) {
      const decoded = element(item);
      if (decoded === FAIL) return FAIL;
      out[k] = decoded;
    }
    return out;
  };
}

/** An enum with string raw values. */
export function dEnum<T extends string>(values: readonly T[]): Decoder<T> {
  return (v) => (typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : FAIL);
}

/** `value(key, fallback)` of the Swift initializers: the decoded field, or the fallback when it is absent, null or wrong. */
export function field<T, F>(object: JsonObject, key: string, decoder: Decoder<T>, fallback: F): T | F {
  const raw = object[key];
  if (raw === undefined || raw === null) return fallback;
  const decoded = decoder(raw);
  return decoded === FAIL ? fallback : decoded;
}

/** A strict field of a synthesized Decodable: all keys must be present and valid. */
export function strictObject<T>(read: (object: JsonObject) => T | typeof FAIL): Decoder<T> {
  return (v) => (isObject(v) ? read(v) : FAIL);
}

export function required<T>(object: JsonObject, key: string, decoder: Decoder<T>): T | typeof FAIL {
  const raw = object[key];
  if (raw === undefined || raw === null) return FAIL;
  return decoder(raw);
}

import type { LearnDay } from './day';

/** LearnDay: the synthesized Codable, so year, month and day are all required. */
export const dLearnDay: Decoder<LearnDay> = strictObject((o) => {
  const year = required(o, 'year', dInt);
  const month = required(o, 'month', dInt);
  const day = required(o, 'day', dInt);
  if (year === FAIL || month === FAIL || day === FAIL) return FAIL;
  return { year, month, day };
});
