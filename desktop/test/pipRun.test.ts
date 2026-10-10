import { describe, expect, it } from 'vitest';
import { PipRun, duckHeight, duckTime, minimumGap, pipX, restartDelay, standHeight } from '../src/lib/pipRun';

function run(game: PipRun, seconds: number, each: (g: PipRun) => void = () => {}) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    each(game);
    game.step(1 / 60);
  }
}

describe('Pip run (same cases as the Swift tests)', () => {
  it('waits for the start', () => {
    const game = new PipRun(3n);
    game.step(1);
    expect(game.phase).toBe('ready');
    expect(game.distance).toBe(0);
    game.start();
    expect(game.phase).toBe('running');
  });

  it('jumps, peaks and lands', () => {
    const game = new PipRun(3n);
    game.jump();
    expect(game.isAirborne).toBe(true);
    let peak = 0;
    run(game, 0.3, (g) => (peak = Math.max(peak, g.y)));
    expect(peak).toBeGreaterThan(60);
    expect(peak).toBeLessThan(100);
    run(game, 0.4);
    expect(game.isAirborne).toBe(false);
    expect(game.phase).toBe('running');
  });

  it('does not jump twice in the air', () => {
    const game = new PipRun(3n);
    game.jump();
    run(game, 0.1);
    const before = game.vy;
    game.jump();
    expect(game.vy).toBe(before);
  });

  it('ducks on the ground and drops in the air', () => {
    const game = new PipRun(3n);
    game.start();
    game.duck();
    expect(game.isDucking).toBe(true);
    expect(game.pipHeight).toBe(duckHeight);
    run(game, duckTime + 0.1);
    expect(game.pipHeight).toBe(standHeight);
    game.jump();
    run(game, 0.1);
    game.duck();
    expect(game.vy).toBeLessThanOrEqual(-1000);
    expect(game.isDucking).toBe(false);
  });

  it('hits a standing Pip with a high bird, not a ducking one', () => {
    const standing = new PipRun(3n);
    standing.start();
    standing.place({ x: 50, kind: 'birdHigh' });
    standing.step(0.016);
    expect(standing.phase).toBe('over');
    const ducking = new PipRun(3n);
    ducking.start();
    ducking.place({ x: 50, kind: 'birdHigh' });
    ducking.duck();
    ducking.step(0.016);
    expect(ducking.phase).toBe('running');
  });

  it('hits on the ground but not in a jump', () => {
    const onGround = new PipRun(3n);
    onGround.start();
    onGround.place({ x: 60, kind: 'cactusTall' });
    onGround.step(0.016);
    expect(onGround.phase).toBe('over');
    const jumping = new PipRun(3n);
    jumping.jump();
    run(jumping, 0.2);
    jumping.place({ x: 60, kind: 'cactusTall' });
    jumping.step(0.016);
    expect(jumping.phase).toBe('running');
  });

  it('ends the run, keeps the best and restarts after a short pause', () => {
    const game = new PipRun(5n);
    game.start();
    while (game.phase === 'running') game.step(1 / 60);
    const best = game.best;
    expect(best).toBeGreaterThan(0);
    game.jump();
    expect(game.phase).toBe('over');
    run(game, restartDelay + 0.1);
    game.jump();
    expect(game.phase).toBe('running');
    expect(game.score).toBe(0);
    expect(game.best).toBe(best);
  });

  it('plays the same course for the same seed', () => {
    const course = (seed: bigint) => {
      const game = new PipRun(seed);
      game.start();
      run(game, 1.2);
      return game.obstacles.map((o) => o.x);
    };
    expect(course(9n)).toEqual(course(9n));
  });

  it('leaves room for a jump between obstacles', () => {
    for (let speed = 280; speed <= 620; speed += 20) {
      expect(minimumGap(speed)).toBeGreaterThan(speed * ((2 * 740) / 2900) + 66);
    }
  });

  it('can be played: a careful bot survives a minute on many courses', () => {
    for (let seed = 1n; seed <= 40n; seed++) {
      const game = new PipRun(seed);
      game.jump();
      run(game, 60, (g) => {
        const next = g.obstacles.find((o) => o.x + (o.kind === 'cactusSmall' ? 14 : o.kind === 'cactusTall' ? 18 : o.kind === 'cactusDouble' ? 34 : 28) >= pipX - 2);
        if (!next || g.isAirborne) return;
        if (next.kind === 'birdHigh') {
          if (next.x < 200) g.duck();
        } else if (next.x <= 55 + g.speed * 0.255 && next.x > pipX - 10) {
          g.jump();
        }
      });
      expect(game.phase, `seed ${seed} crashed at ${game.score}`).toBe('running');
    }
  });
});
