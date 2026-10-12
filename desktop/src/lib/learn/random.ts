// Seeded random numbers for the learning path: SplitMix64 and the pieces of the Swift standard library that sit on
// top of a `next() -> UInt64` generator (bounded integers, shuffle, randomElement, Double.random), reproduced step by
// step so the same seed gives the same lesson as on the iOS app. 64-bit values are bigint.
// A port of SplitMix (Lernwerk/Services/Studio/PipRun.swift) and LearnRandom (ExerciseBuilder.swift).

export const MASK64 = (1n << 64n) - 1n;

/** Anything that produces 64 random bits per call, like Swift's RandomNumberGenerator. */
export interface RandomNumberGenerator {
  next(): bigint;
}

/** A small seeded generator (SplitMix64), so a run can be replayed. */
export class SplitMix implements RandomNumberGenerator {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = seed & MASK64;
  }

  next(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
  }

  /** A Double in 0..<1 from the top 53 bits. */
  nextDouble(): number {
    return Number(this.next() >> 11n) / 2 ** 53;
  }
}

/** Seeded random numbers for the Lernpfad (SplitMix64), so the same seed builds the same lesson. */
export class LearnRandom implements RandomNumberGenerator {
  private mix: SplitMix;

  constructor(seed: bigint) {
    this.mix = new SplitMix(seed);
  }

  next(): bigint {
    return this.mix.next();
  }

  // Conveniences that call the free functions below.
  nextBelow(upperBound: bigint): bigint {
    return nextBelow(this, upperBound);
  }
  int(lower: number, upper: number): number {
    return randomInt(this, lower, upper);
  }
  intClosed(lower: number, upper: number): number {
    return randomIntClosed(this, lower, upper);
  }
  shuffle<T>(array: T[]): void {
    shuffle(array, this);
  }
  shuffled<T>(array: readonly T[]): T[] {
    return shuffled(array, this);
  }
  randomElement<T>(array: readonly T[]): T | undefined {
    return randomElement(array, this);
  }
  double(lower: number, upper: number): number {
    return randomDouble(this, lower, upper);
  }
}

/** Swift's `next(upperBound:)` for UInt64 (Lemire's multiply-and-reject): uniform in 0..<upperBound. */
export function nextBelow(rng: RandomNumberGenerator, upperBound: bigint): bigint {
  if (upperBound <= 0n) throw new RangeError('upperBound must be positive');
  let random = rng.next() & MASK64;
  let m = random * upperBound;
  let low = m & MASK64;
  if (low < upperBound) {
    const t = ((0n - upperBound) & MASK64) % upperBound;
    while (low < t) {
      random = rng.next() & MASK64;
      m = random * upperBound;
      low = m & MASK64;
    }
  }
  return m >> 64n;
}

/** `Int.random(in: lower..<upper, using:)`. */
export function randomInt(rng: RandomNumberGenerator, lower: number, upper: number): number {
  if (!(lower < upper)) throw new RangeError('Range requires lowerBound < upperBound');
  return lower + Number(nextBelow(rng, BigInt(upper - lower)));
}

/** `Int.random(in: lower...upper, using:)`. */
export function randomIntClosed(rng: RandomNumberGenerator, lower: number, upper: number): number {
  if (lower > upper) throw new RangeError('Range requires lowerBound <= upperBound');
  return lower + Number(nextBelow(rng, BigInt(upper - lower + 1)));
}

/** `Array.shuffle(using:)`, in place: the same sequence of swaps as the Swift standard library. */
export function shuffle<T>(array: T[], rng: RandomNumberGenerator): void {
  let amount = array.length;
  let i = 0;
  while (amount > 1) {
    const k = randomInt(rng, 0, amount);
    amount -= 1;
    const a = array[i];
    array[i] = array[i + k];
    array[i + k] = a;
    i += 1;
  }
}

/** `Array.shuffled(using:)`. */
export function shuffled<T>(array: readonly T[], rng: RandomNumberGenerator): T[] {
  const copy = array.slice();
  shuffle(copy, rng);
  return copy;
}

/** `randomElement(using:)`: undefined for an empty array. */
export function randomElement<T>(array: readonly T[], rng: RandomNumberGenerator): T | undefined {
  if (array.length === 0) return undefined;
  return array[randomInt(rng, 0, array.length)];
}

/** `Double.random(in: lower..<upper, using:)`. */
export function randomDouble(rng: RandomNumberGenerator, lower: number, upper: number): number {
  if (!(lower < upper)) throw new RangeError('Range requires lowerBound < upperBound');
  const delta = upper - lower;
  for (;;) {
    // The stdlib takes the low 53 bits of one word (checked against the Swift fixture), not a bounded draw.
    const rand = rng.next() & ((1n << 53n) - 1n);
    const unit = Number(rand) * 2 ** -53;
    const x = delta * unit + lower;
    if (x !== upper) return x;
  }
}
