// Compares typed numbers by value: "0,75", "0.75" and "3/4" are the same answer, "34" is not.
// A port of Lernwerk/Services/Learn/Course/NumberCheck.swift. Swift's Int is 64-bit and the arithmetic checks for
// overflow; here the values are bigint with the same int64 range check, and an overflow gives null.

const INT64_MIN = -(1n << 63n);
const INT64_MAX = (1n << 63n) - 1n;

const fits = (value: bigint): boolean => value >= INT64_MIN && value <= INT64_MAX;

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x > 1n ? x : 1n;
}

/** a * b, or null when it does not fit in an Int64. */
function mul(a: bigint, b: bigint): bigint | null {
  const product = a * b;
  return fits(product) ? product : null;
}

/** A fraction in lowest terms with a positive denominator, so equal numbers are equal values. */
export class Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;

  private constructor(numerator: bigint, denominator: bigint) {
    this.numerator = numerator;
    this.denominator = denominator;
  }

  /** nil (null) for a zero denominator or Int64.min. */
  static make(numerator: bigint | number, denominator: bigint | number): Rational | null {
    const n = BigInt(numerator);
    const d = BigInt(denominator);
    if (d === 0n || n === INT64_MIN || d === INT64_MIN) return null;
    const divisor = gcd(abs(n), abs(d));
    const sign = d < 0n ? -1n : 1n;
    return new Rational((sign * n) / divisor, abs(d) / divisor);
  }

  /** A whole number. */
  static whole(value: bigint | number): Rational {
    return new Rational(BigInt(value), 1n);
  }

  get isWhole(): boolean {
    return this.denominator === 1n;
  }

  get doubleValue(): number {
    return Number(this.numerator) / Number(this.denominator);
  }

  equals(other: Rational): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator;
  }

  lessThan(other: Rational): boolean {
    const left = mul(this.numerator, other.denominator);
    const right = mul(other.numerator, this.denominator);
    if (left === null || right === null) return this.doubleValue < other.doubleValue;
    return left < right;
  }

  plus(other: Rational): Rational | null {
    const x = mul(this.numerator, other.denominator);
    const y = mul(other.numerator, this.denominator);
    const d = mul(this.denominator, other.denominator);
    if (x === null || y === null || d === null) return null;
    const n = x + y;
    if (!fits(n)) return null;
    return Rational.make(n, d);
  }

  minus(other: Rational): Rational | null {
    const negated = Rational.make(-other.numerator, other.denominator);
    if (!negated) return null;
    return this.plus(negated);
  }

  times(other: Rational): Rational | null {
    const n = mul(this.numerator, other.numerator);
    const d = mul(this.denominator, other.denominator);
    if (n === null || d === null) return null;
    return Rational.make(n, d);
  }

  dividedBy(other: Rational): Rational | null {
    if (other.numerator === 0n) return null;
    const inverse = Rational.make(other.denominator, other.numerator);
    if (!inverse) return null;
    return this.times(inverse);
  }

  /** "3/4", or "2" for a whole number. */
  get fractionText(): string {
    return this.isWhole ? `${this.numerator}` : `${this.numerator}/${this.denominator}`;
  }

  /** With the decimal comma when the fraction ends after at most six digits, else as a fraction ("1/3"). */
  get germanText(): string {
    if (this.isWhole) return `${this.numerator}`;
    let rest = this.denominator;
    let twos = 0;
    let fives = 0;
    while (rest % 2n === 0n) {
      rest /= 2n;
      twos += 1;
    }
    while (rest % 5n === 0n) {
      rest /= 5n;
      fives += 1;
    }
    const digits = Math.max(twos, fives);
    if (rest !== 1n || digits > 6) return this.fractionText;
    const scale = 10n ** BigInt(digits);
    const scaled = this.numerator * (scale / this.denominator);
    const sign = scaled < 0n ? '-' : '';
    let text = abs(scaled).toString();
    while (text.length <= digits) text = '0' + text;
    const cut = text.length - digits;
    return sign + text.slice(0, cut) + ',' + text.slice(cut);
  }
}

const isAsciiDigits = (text: string): boolean => /^[0-9]+$/.test(text);

/** Compares typed numbers by value: "0,75", "0.75" and "3/4" are the same answer, "34" is not. `AnswerCheck` cannot
 * do this, it reads "3/4" as the letters and digits "34". */
export const NumberCheck = {
  /** A whole number, a decimal fraction with comma or point, a fraction "a/b" or a mixed number "1 1/2", with a
   * sign, and a trailing percent or degree sign that is ignored. Nothing else: no letters, no terms. */
  parse(text: string): Rational | null {
    // Swift's `.whitespacesAndNewlines`.
    let cleaned = text.replace(/^[\s]+|[\s]+$/g, '');
    for (const minus of ['−', '–', '—', '‐']) cleaned = cleaned.split(minus).join('-');
    cleaned = cleaned.split(' ').join(' ');
    while (cleaned.length > 0) {
      const last = cleaned[cleaned.length - 1];
      if (last === '%' || last === '°' || last === ' ') cleaned = cleaned.slice(0, -1);
      else break;
    }
    if (cleaned === '') return null;

    let negative = false;
    if (cleaned.startsWith('-')) {
      negative = true;
      cleaned = cleaned.slice(1);
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }
    cleaned = cleaned.replace(/^[ \t]+|[ \t]+$/g, '');

    const parts = cleaned.split(' ').filter((p) => p !== '');
    let value: Rational | null = null;
    if (parts.length === 1) {
      value = parseUnsigned(parts[0]);
    } else if (parts.length === 2) {
      // "1 1/2": a whole number and a proper fraction, nothing else.
      const whole = parseWhole(parts[0]);
      if (whole !== null && parts[1].includes('/')) {
        const fraction = parseUnsigned(parts[1]);
        if (fraction && fraction.lessThan(Rational.whole(1))) value = Rational.whole(whole).plus(fraction);
      }
    }
    if (!value) return null;
    return negative ? Rational.make(-value.numerator, value.denominator) : value;
  },

  matches(given: string, expected: string): boolean {
    const a = NumberCheck.parse(given);
    const b = NumberCheck.parse(expected);
    if (!a || !b) return false;
    return a.equals(b);
  },
};

function parseWhole(text: string): bigint | null {
  if (text === '' || Array.from(text).length > 15 || !isAsciiDigits(text)) return null;
  return BigInt(text);
}

function parseUnsigned(text: string): Rational | null {
  const slash = text.indexOf('/');
  if (slash >= 0) {
    const n = parseDecimalOrWhole(text.slice(0, slash));
    const d = parseDecimalOrWhole(text.slice(slash + 1));
    if (!n || !d) return null;
    return n.dividedBy(d);
  }
  return parseDecimalOrWhole(text);
}

function parseDecimalOrWhole(text: string): Rational | null {
  const unified = text.split(',').join('.');
  const pieces = unified.split('.');
  if (pieces.length > 2) return null;
  const integer = pieces[0];
  if (integer === '' && pieces.length !== 2) return null;
  const whole = integer === '' ? 0n : parseWhole(integer);
  if (whole === null) return null;
  if (pieces.length !== 2) return Rational.whole(whole);
  const fraction = pieces[1];
  if (fraction === '' || fraction.length > 9 || !isAsciiDigits(fraction)) return null;
  const digits = BigInt(fraction);
  const scale = 10n ** BigInt(fraction.length);
  const top = mul(whole, scale);
  if (top === null) return null;
  const total = top + digits;
  if (!fits(total)) return null;
  return Rational.make(total, scale);
}
