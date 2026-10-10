import { describe, expect, it } from 'vitest';
import { Spring, lively, project, releaseVelocity, rubberband, smooth } from '../src/lib/spring';

function run(spring: Spring, seconds: number, fps = 60) {
  const peak = { value: spring.value };
  for (let i = 0; i < seconds * fps; i++) {
    spring.step(1 / fps);
    peak.value = Math.max(peak.value, spring.value);
  }
  return peak.value;
}

describe('Spring', () => {
  it('critically damped never overshoots and settles', () => {
    const spring = new Spring(0, smooth, () => {});
    spring.target = 100;
    const peak = run(spring, 2);
    expect(peak).toBeLessThanOrEqual(100);
    expect(spring.atRest).toBe(true);
    expect(spring.value).toBe(100);
  });

  it('under-damped overshoots, then settles', () => {
    const spring = new Spring(0, lively, () => {});
    spring.target = 100;
    expect(run(spring, 3)).toBeGreaterThan(100);
    expect(spring.value).toBe(100);
  });

  it('keeps the velocity it is given instead of starting from zero', () => {
    const slow = new Spring(0, smooth, () => {});
    const fast = new Spring(0, smooth, () => {});
    slow.target = fast.target = 100;
    fast.velocity = 800;
    slow.step(1 / 60);
    fast.step(1 / 60);
    expect(fast.value).toBeGreaterThan(slow.value * 2);
  });

  it('re-targets from the live value without a jump', () => {
    const seen: number[] = [];
    const spring = new Spring(0, smooth, (v) => seen.push(v));
    spring.target = 100;
    run(spring, 0.15);
    const before = spring.value;
    const velocity = spring.velocity;
    spring.target = 0;
    spring.step(1 / 240);
    expect(Math.abs(spring.value - before)).toBeLessThan(Math.abs(velocity) / 240 + 0.5);
  });

  it('jump and grab keep the live value', () => {
    const spring = new Spring(0, smooth, () => {});
    spring.jump(42);
    expect(spring.grab()).toBe(42);
    expect(spring.velocity).toBe(0);
  });
});

describe('momentum', () => {
  it('projects a flick forward like a scroll view', () => {
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(-1000)).toBeCloseTo(-499, 0);
    expect(project(0)).toBe(0);
  });

  it('rubber-bands with growing resistance and never reaches the dimension', () => {
    const near = rubberband(20, 600);
    const far = rubberband(400, 600);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(20);
    expect(far / 400).toBeLessThan(near / 20);
    expect(rubberband(100000, 600)).toBeLessThan(600);
    expect(rubberband(0, 600)).toBe(0);
  });

  it('measures release velocity over the last 100 ms', () => {
    const samples = [{ t: 0, v: 0 }, { t: 50, v: 5 }, { t: 160, v: 60 }, { t: 200, v: 100 }, { t: 220, v: 120 }];
    expect(releaseVelocity(samples)).toBeCloseTo(((120 - 60) / 60) * 1000, 0);
    expect(releaseVelocity([{ t: 0, v: 0 }])).toBe(0);
  });
});
