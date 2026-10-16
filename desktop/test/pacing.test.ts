import { describe, expect, it } from 'vitest';
import { PollPacing } from '../src/lib/social/pacing';

describe('poll pacing', () => {
  it('asks a quiet room less and less often', () => {
    const pacing = new PollPacing();
    const waits = Array.from({ length: 10 }, () => pacing.next(false));
    expect(waits).toEqual([3000, 3000, 3000, 6000, 6000, 6000, 6000, 12000, 12000, 12000]);
  });

  it('goes back to three seconds with the first change', () => {
    const pacing = new PollPacing();
    for (let i = 0; i < 9; i++) pacing.next(false);
    expect(pacing.next(true)).toBe(3000);
    expect(pacing.next(false)).toBe(3000);
  });
});
