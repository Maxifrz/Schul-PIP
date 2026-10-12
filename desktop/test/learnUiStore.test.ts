import { describe, expect, it } from 'vitest';
import { LearnProgressStore, QuestStore, SkillStore } from '../src/lib/learn';
import { providers } from '../src/lib/learn/catalog';
import { registerCourses } from '../src/lib/learn/courses';
import { AppKeyValueStore, newSeed } from '../src/store/learn';

describe('the learn key-value store', () => {
  it('keeps the keys of the core and writes them through in order', async () => {
    const writes: Array<[string, string]> = [];
    const kv = new AppKeyValueStore(async (file, text) => {
      writes.push([file, text]);
    });
    const progress = new LearnProgressStore(kv);
    progress.setDailyGoal(50);
    const quests = new QuestStore(kv);
    quests.refresh(1_800_000_000_000, { timeZone: 'Europe/Berlin', firstWeekday: 2 });
    new SkillStore(kv);
    await kv.flush();
    expect(writes.map((w) => w[0])).toEqual(['learn-progress', 'learn-quests']);
    expect(JSON.parse(writes[0][1]).dailyGoal).toBe(50);
    // A second start reads what was written.
    const again = new AppKeyValueStore(async () => undefined);
    again.preload('learn.progress', writes[0][1]);
    expect(new LearnProgressStore(again).progress.dailyGoal).toBe(50);
    expect(new LearnProgressStore(new AppKeyValueStore(async () => undefined)).progress.dailyGoal).toBe(20);
  });

  it('makes seeds in 1 to 2^64-1', () => {
    for (let i = 0; i < 20; i++) {
      const seed = newSeed();
      expect(seed > 0n && seed < 1n << 64n).toBe(true);
    }
  });
});

describe('the courses', () => {
  it('registers every provider once, with a structure the screens rely on', () => {
    const ids = registerCourses();
    expect(ids).toContain('es');
    expect(new Set(ids).size).toBe(ids.length);
    expect(registerCourses()).toEqual(ids);
    for (const p of providers()) expect(p.course.nodes.length).toBeGreaterThan(0);
  });
});
