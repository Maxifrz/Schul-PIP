/**
 * Springs for gesture-driven motion. A spring has no duration: it chases a target, starts from the value that is
 * on screen right now and keeps the velocity it already has, so it can be grabbed and redirected at any instant.
 *
 * `damping` is the damping ratio (1 = no overshoot, below 1 = bounce), `response` the time in seconds the value
 * needs to get to the target (not a duration; the settle time follows from both).
 */

export interface SpringConfig {
  damping: number;
  response: number;
}

/** Default for everything the user touches: critically damped. */
export const smooth: SpringConfig = { damping: 1, response: 0.38 };
/** Only for motion that carries momentum, such as a flick that is released. */
export const lively: SpringConfig = { damping: 0.8, response: 0.34 };

const REST_DISTANCE = 0.002;
const REST_SPEED = 0.02;
const MAX_STEP = 1 / 240;

export class Spring {
  value: number;
  velocity = 0;
  target: number;
  private frame = 0;
  private last = 0;
  private onRest: (() => void) | undefined;

  constructor(initial: number, private config: SpringConfig, private apply: (value: number) => void) {
    this.value = initial;
    this.target = initial;
  }

  get running(): boolean {
    return this.frame !== 0;
  }

  /** Move towards `target`. Pass the gesture's release velocity (units per second) to continue it without a seam. */
  to(target: number, options: { velocity?: number; config?: SpringConfig; onRest?: () => void } = {}): void {
    this.target = target;
    if (options.velocity !== undefined) this.velocity = options.velocity;
    if (options.config) this.config = options.config;
    this.onRest = options.onRest;
    if (reducedMotion()) {
      this.settle();
      return;
    }
    if (this.frame === 0 && typeof requestAnimationFrame === 'function') {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  /** Put the value somewhere without animation (while a finger drags, or for the first paint). */
  jump(value: number): void {
    this.halt();
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.apply(value);
  }

  /** Stop where the element is on screen. Returns the live value, which is where the next animation starts. */
  grab(): number {
    this.halt();
    this.onRest = undefined;
    return this.value;
  }

  /** Advance the simulation by `seconds`. Public so tests can run it without a clock. */
  step(seconds: number): void {
    const omega = (2 * Math.PI) / this.config.response;
    const stiffness = omega * omega;
    const friction = 2 * this.config.damping * omega;
    let left = seconds;
    while (left > 0) {
      const dt = Math.min(left, MAX_STEP);
      const acceleration = -stiffness * (this.value - this.target) - friction * this.velocity;
      this.velocity += acceleration * dt;
      this.value += this.velocity * dt;
      left -= dt;
    }
    if (Math.abs(this.value - this.target) < REST_DISTANCE && Math.abs(this.velocity) < REST_SPEED) {
      this.value = this.target;
      this.velocity = 0;
    }
    this.apply(this.value);
  }

  get atRest(): boolean {
    return this.value === this.target && this.velocity === 0;
  }

  private tick = (now: number) => {
    const seconds = this.last === 0 ? 1 / 60 : Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.step(seconds);
    if (this.atRest) {
      this.frame = 0;
      this.finish();
    } else {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private settle() {
    this.halt();
    this.value = this.target;
    this.velocity = 0;
    this.apply(this.value);
    this.finish();
  }

  private finish() {
    const callback = this.onRest;
    this.onRest = undefined;
    callback?.();
  }

  private halt() {
    if (this.frame !== 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}

/** Where a release with this velocity (px/s) would come to rest if it decelerated like a scroll view. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Resistance past an edge: the further out, the less the element follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (overshoot === 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Velocity in px/s from the last pointer samples (`t` in ms), looking at the most recent 100 ms only. */
export function releaseVelocity(samples: Array<{ t: number; v: number }>): number {
  if (samples.length < 2) return 0;
  const end = samples[samples.length - 1];
  const start = samples.find((s) => end.t - s.t <= 100) ?? samples[samples.length - 2];
  const elapsed = end.t - start.t;
  return elapsed > 0 ? ((end.v - start.v) / elapsed) * 1000 : 0;
}

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
