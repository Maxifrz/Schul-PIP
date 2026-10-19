import { SplitMix } from '../pipRun';

/** Seeded random numbers for the Lernen tab (SplitMix64), so the same seed builds the same lesson. */
export class LearnRandom {
  private mix: SplitMix;

  constructor(seed: bigint) {
    this.mix = new SplitMix(seed);
  }

  next(): bigint {
    return this.mix.next();
  }

  /** 0 up to, not including, `upper`. */
  int(upper: number): number {
    if (upper <= 1) return 0;
    return Number(this.mix.next() % BigInt(upper));
  }

  /** From `low` to `high`, both included. */
  range(low: number, high: number): number {
    return low + this.int(high - low + 1);
  }

  bool(): boolean {
    return this.int(2) === 1;
  }

  double(): number {
    return this.mix.nextDouble();
  }

  pick<T>(items: readonly T[]): T | undefined {
    return items.length === 0 ? undefined : items[this.int(items.length)];
  }

  shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  shuffled<T>(items: readonly T[]): T[] {
    const copy = [...items];
    this.shuffleInPlace(copy);
    return copy;
  }
}
