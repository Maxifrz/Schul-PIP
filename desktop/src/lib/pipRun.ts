// The game behind the Heute card: Pip runs, jumps cacti and ducks under birds, like the dinosaur in Chrome's offline page.
// A port of Lernwerk/Services/Studio/PipRun.swift (same numbers, same seeds, same course).

export type Phase = 'ready' | 'running' | 'over';
export type Kind = 'cactusSmall' | 'cactusTall' | 'cactusDouble' | 'birdLow' | 'birdHigh';

export interface Obstacle {
  x: number;
  kind: Kind;
}

export const obstacleWidth = (o: Obstacle): number => (o.kind === 'cactusSmall' ? 14 : o.kind === 'cactusTall' ? 18 : o.kind === 'cactusDouble' ? 34 : 28);
export const obstacleHeight = (o: Obstacle): number => (o.kind === 'cactusTall' ? 38 : o.kind === 'cactusSmall' || o.kind === 'cactusDouble' ? 26 : 14);
/** Height of the underside above the ground; a high bird flies where a standing Pip's head is. */
export const obstacleLift = (o: Obstacle): number => (o.kind === 'birdHigh' ? 18 : 0);
export const isBird = (o: Obstacle): boolean => o.kind === 'birdLow' || o.kind === 'birdHigh';

export const world = { width: 600, height: 160 };
export const pipX = 48;
export const pipWidth = 26;
export const standHeight = 26;
export const duckHeight = 16;
const gravity = 2900;
const jumpSpeed = 740;
const fallSpeed = 1000;
export const duckTime = 0.45;
const startSpeed = 280;
const topSpeed = 620;
const acceleration = 8;
const unitsPerPoint = 12;
const birdsFromScore = 150;
const leniency = 4;
export const restartDelay = 0.4;

/** A small seeded generator (SplitMix64), so a run can be replayed. */
export class SplitMix {
  private state: bigint;
  constructor(seed: bigint) {
    this.state = BigInt.asUintN(64, seed);
  }
  next(): bigint {
    this.state = BigInt.asUintN(64, this.state + 0x9e3779b97f4a7c15n);
    let z = this.state;
    z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
    z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
    return z ^ (z >> 31n);
  }
  nextDouble(): number {
    return Number(this.next() >> 11n) / 2 ** 53;
  }
}

/** The least space between two obstacles: more than a jump covers at this speed, plus the widest obstacle and Pip. */
export const minimumGap = (speed: number) => speed * 0.55 + 90;

export class PipRun {
  phase: Phase = 'ready';
  y = 0;
  vy = 0;
  duckLeft = 0;
  obstacles: Obstacle[] = [];
  speed = startSpeed;
  distance = 0;
  best: number;
  overFor = 0;
  private untilNext = 240;
  private random: SplitMix;

  constructor(seed: bigint = 1n, best = 0) {
    this.random = new SplitMix(seed);
    this.best = best;
  }

  get score(): number {
    return Math.floor(this.distance / unitsPerPoint);
  }
  get isAirborne(): boolean {
    return this.y > 0;
  }
  get isDucking(): boolean {
    return this.duckLeft > 0 && !this.isAirborne;
  }
  get pipHeight(): number {
    return this.isDucking ? duckHeight : standHeight;
  }

  /** Up arrow, space or a tap: starts the game, jumps, or starts again after a crash. */
  jump(): void {
    if (this.phase === 'ready') {
      this.phase = 'running';
      this.launch();
    } else if (this.phase === 'running') {
      this.launch();
    } else {
      this.restart();
    }
  }

  /** Right arrow: starts the game, or starts it again after a crash; while it runs, nothing happens. */
  start(): void {
    if (this.phase === 'ready') this.phase = 'running';
    else if (this.phase === 'over') this.restart();
  }

  /** Down arrow: ducks on the ground, drops faster in the air. */
  duck(): void {
    if (this.phase === 'ready') this.phase = 'running';
    else if (this.phase === 'running') {
      if (this.isAirborne) this.vy = Math.min(this.vy, -fallSpeed);
      else this.duckLeft = duckTime;
    } else this.restart();
  }

  /** Puts an obstacle into the course; the tests use it to set up a situation. */
  place(obstacle: Obstacle): void {
    this.obstacles.push(obstacle);
  }

  private launch(): void {
    if (this.isAirborne) return;
    this.duckLeft = 0;
    this.vy = jumpSpeed;
    this.y = 0.001;
  }

  private restart(): void {
    if (this.overFor < restartDelay) return;
    const fresh = new PipRun(this.random.next(), this.best);
    Object.assign(this, fresh);
    this.phase = 'running';
  }

  step(seconds: number): void {
    const dt = Math.min(Math.max(seconds, 0), 0.05);
    if (this.phase === 'ready') return;
    if (this.phase === 'over') {
      this.overFor += dt;
      return;
    }
    if (this.isAirborne || this.vy > 0) {
      this.vy -= gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
      }
    }
    this.duckLeft = Math.max(0, this.duckLeft - dt);
    this.speed = Math.min(topSpeed, this.speed + acceleration * dt);
    const travelled = this.speed * dt;
    this.distance += travelled;
    for (const o of this.obstacles) o.x -= travelled;
    this.obstacles = this.obstacles.filter((o) => o.x + obstacleWidth(o) >= -10);
    this.untilNext -= travelled;
    if (this.untilNext <= 0) this.spawn();
    if (this.obstacles.some((o) => this.hits(o))) {
      this.phase = 'over';
      this.overFor = 0;
      this.best = Math.max(this.best, this.score);
    }
  }

  private spawn(): void {
    const roll = this.random.nextDouble();
    let kind: Kind;
    if (this.score >= birdsFromScore && roll < 0.28) {
      kind = this.random.nextDouble() < 0.55 ? 'birdHigh' : 'birdLow';
    } else {
      const pick = this.random.nextDouble();
      kind = pick < 0.4 ? 'cactusSmall' : pick < 0.75 ? 'cactusTall' : 'cactusDouble';
    }
    this.obstacles.push({ x: world.width + 20, kind });
    const gap = minimumGap(this.speed);
    this.untilNext = gap + this.random.nextDouble() * gap * 0.9;
  }

  private hits(o: Obstacle): boolean {
    const left = o.x + leniency;
    const right = o.x + obstacleWidth(o) - leniency;
    const bottom = obstacleLift(o) + leniency;
    const top = obstacleLift(o) + obstacleHeight(o) - leniency;
    return right > pipX && left < pipX + pipWidth && top > this.y && bottom < this.y + this.pipHeight;
  }
}
