import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Exercises } from '../../src/lib/learn/exercises';
import { LearnRandom, SplitMix, nextBelow, randomDouble, randomElement, randomInt, randomIntClosed, shuffle } from '../../src/lib/learn/random';
import { standardUnit } from '../../src/lib/learn/course';

interface Stream {
  seed: string;
  words: string[];
  bounded: number[];
  closed: number[];
  doubleBits: string[];
  shuffles: number[][];
  picks: number[];
}
const fixture = JSON.parse(readFileSync(new URL('../../../content/fixtures/random.json', import.meta.url), 'utf8')) as {
  streams: Stream[];
  nodeSeeds: { base: string; node: string; seed: string }[];
};

describe('LearnRandom against the Swift fixture', () => {
  it('has streams for several seeds', () => {
    expect(fixture.streams.length).toBeGreaterThanOrEqual(5);
  });

  for (const stream of fixture.streams) {
    const seed = BigInt(stream.seed);

    it(`seed ${stream.seed}: raw words`, () => {
      const rng = new LearnRandom(seed);
      expect(stream.words.map(() => rng.next().toString())).toEqual(stream.words);
    });

    it(`seed ${stream.seed}: bounded and closed integers`, () => {
      const bounded = new LearnRandom(seed);
      expect(stream.bounded.map((_, i) => randomInt(bounded, 0, ((i + 3) * 7) % 23 + 2))).toEqual(stream.bounded);
      const closed = new LearnRandom(seed);
      expect(stream.closed.map(() => randomIntClosed(closed, -5, 12))).toEqual(stream.closed);
    });

    it(`seed ${stream.seed}: doubles`, () => {
      const rng = new LearnRandom(seed);
      const buffer = new DataView(new ArrayBuffer(8));
      const bits = stream.doubleBits.map(() => {
        buffer.setFloat64(0, randomDouble(rng, 0, 7.5));
        return buffer.getBigUint64(0).toString();
      });
      expect(bits).toEqual(stream.doubleBits);
    });

    it(`seed ${stream.seed}: shuffles and picks`, () => {
      const rng = new LearnRandom(seed);
      const sizes = stream.shuffles.map((s) => s.length);
      const shuffles = sizes.map((n) => {
        const a = Array.from({ length: n }, (_, i) => i);
        shuffle(a, rng);
        return a;
      });
      expect(shuffles).toEqual(stream.shuffles);
      const picks = new LearnRandom(seed);
      expect(stream.picks.map(() => randomElement([10, 20, 30, 40, 50], picks))).toEqual(stream.picks);
    });
  }

  it('Exercises.seed matches Exercises.seed(for:base:)', () => {
    expect(fixture.nodeSeeds.length).toBeGreaterThan(10);
    for (const entry of fixture.nodeSeeds) {
      expect(Exercises.seed({ id: entry.node }, BigInt(entry.base)).toString()).toBe(entry.seed);
    }
  });
});

describe('random helpers', () => {
  it('SplitMix.nextDouble is next() >> 11 over 2^53', () => {
    const a = new SplitMix(42n);
    const b = new SplitMix(42n);
    expect(a.nextDouble()).toBe(Number(b.next() >> 11n) / 2 ** 53);
  });

  it('randomElement of an empty array is undefined; ranges are checked', () => {
    expect(randomElement([], new LearnRandom(1n))).toBeUndefined();
    expect(() => randomInt(new LearnRandom(1n), 3, 3)).toThrow();
    expect(() => nextBelow(new LearnRandom(1n), 0n)).toThrow();
  });

  it('shuffle keeps the elements and a short array is untouched', () => {
    const rng = new LearnRandom(9n);
    const a = [1, 2, 3, 4, 5, 6];
    shuffle(a, rng);
    expect(a.slice().sort()).toEqual([1, 2, 3, 4, 5, 6]);
    const one = [7];
    shuffle(one, rng);
    expect(one).toEqual([7]);
  });

  it('seeds of the same node repeat, other nodes differ', () => {
    const unit = standardUnit('x', 1, 'T', '', 't');
    expect(Exercises.seed(unit.nodes[0], 5n)).toBe(Exercises.seed(unit.nodes[0], 5n));
    expect(Exercises.seed(unit.nodes[0], 5n)).not.toBe(Exercises.seed(unit.nodes[1], 5n));
  });
});
