/** A fraction in lowest terms with a positive denominator, so equal numbers are equal values. Exact while the parts stay safe integers; beyond that an operation gives null. */
export class Rational {
  private constructor(readonly numerator: number, readonly denominator: number) {}

  static of(numerator: number, denominator = 1): Rational | null {
    if (denominator === 0 || !Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return null;
    const divisor = gcd(Math.abs(numerator), Math.abs(denominator));
    const sign = denominator < 0 ? -1 : 1;
    return new Rational((sign * numerator) / divisor, Math.abs(denominator) / divisor);
  }

  static whole(value: number): Rational {
    return new Rational(value, 1);
  }

  get isWhole(): boolean {
    return this.denominator === 1;
  }

  get value(): number {
    return this.numerator / this.denominator;
  }

  equals(other: Rational): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator;
  }

  compare(other: Rational): number {
    const left = this.numerator * other.denominator;
    const right = other.numerator * this.denominator;
    if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) return Math.sign(this.value - other.value);
    return Math.sign(left - right);
  }

  lessThan(other: Rational): boolean {
    return this.compare(other) < 0;
  }

  plus(other: Rational): Rational | null {
    return Rational.of(this.numerator * other.denominator + other.numerator * this.denominator, this.denominator * other.denominator);
  }

  minus(other: Rational): Rational | null {
    return Rational.of(this.numerator * other.denominator - other.numerator * this.denominator, this.denominator * other.denominator);
  }

  times(other: Rational): Rational | null {
    return Rational.of(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  dividedBy(other: Rational): Rational | null {
    if (other.numerator === 0) return null;
    return Rational.of(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  negated(): Rational {
    return new Rational(-this.numerator, this.denominator);
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
    while (rest % 2 === 0) { rest /= 2; twos++; }
    while (rest % 5 === 0) { rest /= 5; fives++; }
    const digits = Math.max(twos, fives);
    if (rest !== 1 || digits > 6) return this.fractionText;
    const scale = 10 ** digits;
    const scaled = this.numerator * (scale / this.denominator);
    const sign = scaled < 0 ? '-' : '';
    let text = String(Math.abs(scaled));
    while (text.length <= digits) text = `0${text}`;
    const cut = text.length - digits;
    return `${sign}${text.slice(0, cut)},${text.slice(cut)}`;
  }
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) [x, y] = [y, x % y];
  return Math.max(x, 1);
}

const isDigits = (text: string) => /^[0-9]+$/.test(text);

/** Compares typed numbers by value: "0,75", "0.75" and "3/4" are the same answer, "34" is not. */
export const NumberCheck = {
  /** A whole number, a decimal fraction with comma or point, a fraction "a/b" or a mixed number "1 1/2", with a sign, and a trailing percent or degree sign that is ignored. Nothing else. */
  parse(text: string): Rational | null {
    let cleaned = text.trim();
    for (const minus of ['−', '–', '—', '‐']) cleaned = cleaned.split(minus).join('-');
    cleaned = cleaned.split(' ').join(' ');
    while (cleaned.length > 0 && ['%', '°', ' '].includes(cleaned[cleaned.length - 1])) cleaned = cleaned.slice(0, -1);
    if (cleaned === '') return null;

    let negative = false;
    if (cleaned.startsWith('-')) {
      negative = true;
      cleaned = cleaned.slice(1);
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }
    cleaned = cleaned.trim();

    const parts = cleaned.split(' ').filter((p) => p !== '');
    let value: Rational | null = null;
    if (parts.length === 1) {
      value = parseUnsigned(parts[0]);
    } else if (parts.length === 2) {
      // "1 1/2": a whole number and a proper fraction, nothing else.
      const whole = parseWhole(parts[0]);
      const fraction = parts[1].includes('/') ? parseUnsigned(parts[1]) : null;
      if (whole !== null && fraction !== null && fraction.lessThan(Rational.whole(1))) value = Rational.whole(whole).plus(fraction);
    }
    if (value === null) return null;
    return negative ? value.negated() : value;
  },

  matches(given: string, expected: string): boolean {
    const a = NumberCheck.parse(given);
    const b = NumberCheck.parse(expected);
    return a !== null && b !== null && a.equals(b);
  },
};

function parseWhole(text: string): number | null {
  if (text === '' || text.length > 15 || !isDigits(text)) return null;
  return Number(text);
}

function parseUnsigned(text: string): Rational | null {
  const slash = text.indexOf('/');
  if (slash >= 0) {
    const n = parseDecimalOrWhole(text.slice(0, slash));
    const d = parseDecimalOrWhole(text.slice(slash + 1));
    return n && d ? n.dividedBy(d) : null;
  }
  return parseDecimalOrWhole(text);
}

function parseDecimalOrWhole(text: string): Rational | null {
  const pieces = text.split(',').join('.').split('.');
  if (pieces.length > 2 || (pieces[0] === '' && pieces.length !== 2)) return null;
  const whole = pieces[0] === '' ? 0 : parseWhole(pieces[0]);
  if (whole === null) return null;
  if (pieces.length === 1) return Rational.whole(whole);
  const fraction = pieces[1];
  if (fraction === '' || fraction.length > 9 || !isDigits(fraction)) return null;
  const scale = 10 ** fraction.length;
  return Rational.of(whole * scale + Number(fraction), scale);
}
