// Differential test against the Swift code: fixtures/learnScenario.json was written by the Swift program in
// fixtures/learnScenario.swift.txt (run against SkillAssessor, LearnProgress and QuestBoard on Linux), which draws a
// deterministic scenario from SplitMix: 40 days of skill rounds in mixed time zones, and 80 finished rounds with
// progress, streak, freezes, quests, claims and the timer, in mixed zones and first weekdays. This file replays the
// same draws and compares status, reward, finished quests, claims and (every few steps) the whole persisted state.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { learnCalendar } from '../../src/lib/learn/day';
import { LearnProgress } from '../../src/lib/learn/progress';
import type { NodeKind } from '../../src/lib/learn/course';
import { QuestBoard } from '../../src/lib/learn/quests';
import { lessonResult } from '../../src/lib/learn/session';
import { SplitMix } from '../../src/lib/learn/random';
import { SkillAssessor, type ExerciseOutcome, SkillRecord } from '../../src/lib/learn/skills/assessor';
import { skillMap, type CompetenceLevel } from '../../src/lib/learn/skills/skill';
import { SkillProgress } from '../../src/lib/learn/store';
import { SampleCourse } from './sample';
import type { CourseNode } from '../../src/lib/learn/course';

const swift = JSON.parse(readFileSync(new URL('./fixtures/learnScenario.json', import.meta.url), 'utf8'));
const zones = ['Europe/Berlin', 'Pacific/Auckland', 'America/New_York', 'UTC', 'Asia/Kolkata'];
let rng = new SplitMix(20260312n);
const pick = (n: number) => Number(rng.next() % BigInt(n));
const SETS = new Set(['worked', 'started', 'coursesToday', 'completedLessons']);
const sortKeys = (v: any, key = ''): any => (Array.isArray(v) ? (key === 'weekDays' ? v.map((x) => sortKeys(x)).sort((a, b) => a.year * 10000 + a.month * 100 + a.day - (b.year * 10000 + b.month * 100 + b.day)) : SETS.has(key) ? v.map((x) => sortKeys(x)).sort() : v.map((x) => sortKeys(x))) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k], k)])) : v);
const norm = (v: unknown) => sortKeys(JSON.parse(JSON.stringify(v)));

it('skill records and statuses match the Swift scenario', () => {
  rng = new SplitMix(20260312n);
  const provider = new SampleCourse();
  const map = skillMap(provider);
  const levels: CompetenceLevel[] = ['recognise', 'recall', 'apply'];
  const records: Record<string, SkillRecord> = {};
  const base = 1_770_000_000;
  for (let day = 0; day < 40; day++) {
    const c = learnCalendar(zones[pick(zones.length)], 2);
    const rounds = pick(3);
    for (let r = 0; r < rounds; r++) {
      const now = (base + day * 86400 + pick(80000)) * 1000;
      const list: ExerciseOutcome[] = [];
      const count = pick(16);
      const skill = map.skills[pick(map.skills.length)];
      const accuracy = 40 + pick(61);
      for (let i = 0; i < count; i++) {
        const id = `d${day}r${r}e${pick(count + 2)}`;
        const level = levels[pick(3)];
        const right = pick(100) < accuracy;
        const helped = pick(8) === 0;
        list.push({ exerciseID: id, skill: skill.id, level, right, helped });
      }
      const nodes = provider.course.nodes;
      const node: CourseNode | null = pick(4) === 0 ? null : nodes[pick(nodes.length)];
      SkillAssessor.record(list, node, map, records, now, c);
      if (pick(5) === 0 && node) SkillAssessor.begin(node, map, records);
    }
    const now = (base + day * 86400 + 43200) * 1000;
    const cb = learnCalendar('Europe/Berlin', 2);
    const statuses: Record<string, string> = {};
    for (const s of map.skills) statuses[s.id] = SkillAssessor.status(records[s.id], s, new Set(), now, cb);
    const p = new SkillProgress();
    p.records = records;
    expect(sortKeys(statuses)).toEqual(sortKeys(swift.skills[day].statuses));
    if (swift.skills[day].records) expect(norm(p)).toEqual(sortKeys(swift.skills[day].records));
  }
});

it('progress, streak and quests match the Swift scenario', () => {
  rng = new SplitMix(20260312n);
  const base = 1_770_000_000;
  // Burn the same random numbers as the skills scenario did.
  const progress = new LearnProgress();
  const board = new QuestBoard();
  let t = base;
  // The Swift program continued with the same generator after the skills scenario: replay it first.
  replaySkills();
  for (let i = 0; i < 80; i++) {
    t += pick(200_000) - 20_000;
    const c = learnCalendar(zones[pick(zones.length)], [1, 2][pick(2)]);
    const total = pick(14);
    const right = total === 0 ? 0 : pick(total + 1);
    const lessonID = `L${pick(6)}`;
    const retry = pick(total - right + 1);
    const result = lessonResult({ lessonID, sessionID: `s${i}`, exerciseCount: total, rightFirstTry: right, rightOnRetry: retry });
    if (pick(9) === 0) {
      progress.buyFreeze();
      progress.addGems(pick(40));
    }
    const now = t * 1000;
    const courseID = pick(3) === 0 ? null : `c${pick(3)}`;
    const completes = pick(4) !== 0;
    const reward = progress.record(result, { courseID, completes, now, calendar: c });
    const kinds: (NodeKind | null)[] = ['lesson', 'practice', 'checkpoint', null];
    const evCourse = pick(4) === 0 ? null : `c${pick(3)}`;
    const evKind = kinds[pick(4)];
    const finished = board.apply({ xp: reward?.xp ?? 0, courseID: evCourse, nodeKind: evKind, rightFirstTry: right, exerciseCount: total }, now, c);
    let claimed = 0;
    for (const q of board.daily) if (q.progress >= q.target && pick(2) === 0) claimed += board.claim(q.id);
    if (pick(3) === 0) claimed += board.claimBonus();
    const s = swift.progress[i];
    expect(reward ? { xp: reward.xp, xpToday: reward.xpToday, goal: reward.goalReached, streak: reward.streak, ext: reward.streakExtended, gems: reward.gems, used: reward.freezesUsed } : null, `reward ${i}`).toEqual(s.reward);
    expect(finished.map((q) => q.id), `finished ${i}`).toEqual(s.finished);
    expect(claimed).toBe(s.claimed);
    if (s.progress) expect(norm(progress), `progress ${i}`).toEqual(sortKeys(s.progress));
    if (s.board) expect(norm(board), `board ${i}`).toEqual(sortKeys(s.board));
    expect(progress.currentStreak(now, c)).toBe(s.streakNow);
    expect(progress.xpToday(now, c)).toBe(s.xpToday);
    expect(QuestBoard.secondsUntilNextDay(now, c)).toBeCloseTo(s.seconds, 3);
  }
});

function replaySkills() {
  const levels = 3;
  const map = skillMap(new SampleCourse());
  const nodes = new SampleCourse().course.nodes;
  for (let day = 0; day < 40; day++) {
    pick(zones.length);
    const rounds = pick(3);
    for (let r = 0; r < rounds; r++) {
      pick(80000);
      const count = pick(16);
      pick(map.skills.length);
      pick(61);
      for (let i = 0; i < count; i++) {
        pick(count + 2);
        pick(levels);
        pick(100);
        pick(8);
      }
      const nodeNil = pick(4) === 0;
      if (!nodeNil) pick(nodes.length);
      if (pick(5) === 0 && !nodeNil) { /* begin */ }
    }
  }
}
