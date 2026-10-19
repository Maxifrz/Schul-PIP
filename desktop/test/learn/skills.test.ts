import { describe, expect, it } from 'vitest';
import { Calendar, zoneCalendar } from '../../src/lib/learn/calendar';
import { CoursePath, courseNodes, courseUnits, standardUnit, structureProblems, Course, CourseProvider, nodeWithID, courseKinds, prefersDarkText } from '../../src/lib/learn/course';
import type { CompetenceLevel } from '../../src/lib/learn/exercise';
import type { ExerciseOutcome, LessonResult } from '../../src/lib/learn/session';
import { PathMastery, Skill, SkillAssessor, SkillMap, SkillRecords, SkillStatus, decodeRecord, decodeRecords, emptyRecord, skillMapOf, SkillRecord, tallyOf } from '../../src/lib/learn/skills';
import { sampleProvider } from './sample';
import * as sm2 from '../../src/lib/sm2';
import { TestOut, mostSkillsPerRound, recommend } from '../../src/lib/learn/advisor';

const utc = zoneCalendar('UTC');
const provider = sampleProvider;
const map = SkillMap.build(provider);
const skill = map.skills[0];
const node = courseNodes(provider.course)[0];

describe('SkillAssessor', () => {
  const date = (day: number, hour = 10) => utc.at(2026, 3, day, hour);
  const outcomes = (prefix: string, count: number, level: CompetenceLevel, right = true, helped = false): ExerciseOutcome[] =>
    Array.from({ length: count }, (_, i) => ({ exerciseID: `${prefix}${i}`, skill: skill.id, level, right, helped }));
  const play = (list: ExerciseOutcome[], day: number, records: SkillRecords) => SkillAssessor.record(list, node, map, records, date(day), utc);
  const status = (records: SkillRecords, day: number, completed = new Set<string>()): SkillStatus => SkillAssessor.status(records[skill.id], skill, completed, date(day), utc);

  it('the default map has one skill per unit and chains them', () => {
    expect(map.skills).toHaveLength(3);
    expect(map.problems()).toEqual([]);
    expect(map.skills[0].prerequisites).toEqual([]);
    expect(map.skills[1].prerequisites).toEqual([map.skills[0].id]);
    expect(map.skills[2].prerequisites).toEqual([map.skills[1].id]);
    expect(map.dependents(map.skills[0].id).map((s) => s.id)).toEqual([map.skills[1].id]);
    expect(skillMapOf(provider)).toBe(skillMapOf(provider));
  });

  it('a map with a cycle or an unknown prerequisite is reported', () => {
    const make = (id: string, prerequisites: string[]): Skill => ({ id, courseID: 'c', unitID: 'u', unitNumber: 1, unitTitle: 'U', facet: id, title: id, goal: '', levels: ['recognise'], prerequisites, nodeIDs: ['n'] });
    expect(new SkillMap('c', [make('a', ['b']), make('b', ['a'])]).problems().some((p) => p.includes('cycle'))).toBe(true);
    expect(new SkillMap('c', [make('c', ['zzz'])]).problems().some((p) => p.includes('unknown prerequisite'))).toBe(true);
  });

  it('an untouched skill and a begun lesson are not worked', () => {
    const records: SkillRecords = {};
    expect(status(records, 1)).toBe('notStarted');
    SkillAssessor.begin(node, map, records);
    expect(status(records, 1)).toBe('started');
  });

  it('a finished lesson without answers is only worked', () => {
    const records: SkillRecords = {};
    play([], 1, records);
    expect(status(records, 1)).toBe('worked');
    expect(status({}, 1, new Set([node.id]))).toBe('worked');
  });

  it('clicking through choices never reaches a skill that asks for typing', () => {
    const records: SkillRecords = {};
    for (let round = 0; round < 6; round++) play(outcomes(`r${round}-`, 12, 'recognise'), 1 + round, records);
    expect(status(records, 8)).not.toBe('provisional');
    expect(status(records, 8)).not.toBe('mastered');
    expect(SkillAssessor.missing(records[skill.id], skill).length).toBeGreaterThan(0);
    expect(SkillAssessor.missing(records[skill.id], skill).some((m) => m.includes('getippt'))).toBe(true);
  });

  it('one round cannot add more than the cap', () => {
    const records: SkillRecords = {};
    play(outcomes('big', 40, 'recall'), 1, records);
    expect(tallyOf(records[skill.id], 'recall').points).toBeLessThanOrEqual(SkillAssessor.pointsPerRound);
  });

  it('hints halve the points and wrong answers give none', () => {
    const records: SkillRecords = {};
    play([...outcomes('h', 4, 'recall', true, true), ...outcomes('w', 4, 'recall', false)], 1, records);
    const tally = tallyOf(records[skill.id], 'recall');
    expect(tally.points).toBeCloseTo(4, 4);
    expect(tally.right).toBe(0);
    expect(tally.attempts).toBe(8);
  });

  it('recognising and typing reaches provisionally and another day masters it', () => {
    const records: SkillRecords = {};
    play([...outcomes('a', 6, 'recognise'), ...outcomes('b', 4, 'recall')], 1, records);
    expect(status(records, 1)).toBe('provisional');
    expect(SkillAssessor.missing(records[skill.id], skill)).toEqual(['Es fehlt noch eine gute Runde an einem anderen Tag.']);
    expect(status(records, 2)).toBe('due');
    play([...outcomes('c', 5, 'recognise'), ...outcomes('d', 3, 'recall')], 2, records);
    expect(status(records, 2)).toBe('mastered');
    expect(status(records, 5)).toBe('mastered');
    expect(status(records, 9)).toBe('due');
  });

  it('a second round on the same day does not push the review away', () => {
    const records: SkillRecords = {};
    play([...outcomes('a', 6, 'recognise'), ...outcomes('b', 4, 'recall')], 1, records);
    const after = records[skill.id];
    const repetitions = after.schedule.repetitions;
    const dueDay = after.schedule.dueDay;
    play([...outcomes('c', 6, 'recognise'), ...outcomes('d', 4, 'recall')], 1, records);
    expect(records[skill.id].schedule.repetitions).toBe(repetitions);
    expect(records[skill.id].schedule.dueDay).toEqual(dueDay);
    expect(records[skill.id].schedule.confirmations).toBe(0);
  });

  it('a bad round after mastery takes it away', () => {
    const records: SkillRecords = {};
    play([...outcomes('a', 6, 'recognise'), ...outcomes('b', 4, 'recall')], 1, records);
    play([...outcomes('c', 5, 'recognise'), ...outcomes('d', 3, 'recall')], 2, records);
    expect(status(records, 3)).toBe('mastered');
    play(outcomes('e', 6, 'recall', false), 9, records);
    expect(records[skill.id].schedule.lapses).toBe(1);
    expect(records[skill.id].schedule.provisionalDay).toBeNull();
    expect(status(records, 9)).toBe('practicing');
  });

  it('the same exercise in one round counts once', () => {
    const records: SkillRecords = {};
    const one = outcomes('x', 1, 'recall');
    play([...one, ...one, ...one], 1, records);
    expect(tallyOf(records[skill.id], 'recall').attempts).toBe(1);
  });

  it('outcomes for unknown skills are ignored', () => {
    const records: SkillRecords = {};
    play([{ exerciseID: 's', skill: 'nowhere.u1.main', level: 'recall', right: true, helped: false }], 1, records);
    expect(records['nowhere.u1.main']).toBeUndefined();
  });

  it('a middling round neither confirms nor undoes', () => {
    const records: SkillRecords = {};
    play([...outcomes('a', 6, 'recognise'), ...outcomes('b', 4, 'recall')], 1, records);
    play([...outcomes('c', 7, 'recall'), ...outcomes('d', 3, 'recall', false)], 2, records);
    expect(records[skill.id].schedule.confirmations).toBe(0);
    expect(records[skill.id].schedule.provisionalDay).not.toBeNull();
  });

  it('records survive encoding and tolerate missing fields', () => {
    const records: SkillRecords = {};
    play([...outcomes('a', 6, 'recognise'), ...outcomes('b', 4, 'recall')], 1, records);
    expect(decodeRecords(JSON.parse(JSON.stringify({ records })))).toEqual(records);
    expect(decodeRecord({})).toEqual(emptyRecord());
    expect(Object.keys(decodeRecords({ records: 5 }))).toHaveLength(0);
    expect(decodeRecord({ lapses: 2 }).schedule.lapses).toBe(0);
    const scheduled = decodeRecord({ schedule: { lapses: 2, ease: 0.1 } });
    expect(scheduled.schedule.lapses).toBe(2);
    expect(scheduled.schedule.ease).toBeCloseTo(sm2.minimumEase, 4);
  });

  it('weak levels name what to practise', () => {
    const records: SkillRecords = {};
    play([...outcomes('a', 6, 'recognise'), ...outcomes('b', 4, 'recall', false)], 1, records);
    expect(SkillAssessor.weakLevels(records[skill.id], skill)).toEqual(['recall']);
    expect(SkillAssessor.weakLevels(undefined, skill)).toEqual(['recognise', 'recall']);
  });
});

describe('PathMastery', () => {
  const steps = (done: Set<string>) => CoursePath.units(provider.course, done).flatMap((u) => u.steps);
  const mastery = (status: SkillStatus, skillID: string) => new PathMastery(map, { [skillID]: status });
  const unit0 = courseUnits(provider.course)[0];
  const skill0 = map.skillsInUnit(unit0.id)[0].id;

  it('the banner counts reached goals of its unit', () => {
    expect(mastery('practicing', skill0).unit(unit0.id)).toEqual({ reached: 0, total: 1, due: 0 });
    const text = (s: SkillStatus) => { const m = mastery(s, skill0).unit(unit0.id); return `${m.reached} von ${m.total} erreicht${m.due > 0 ? `, ${m.due} fällig` : ''}`; };
    expect(text('provisional')).toBe('1 von 1 erreicht');
    expect(text('due')).toBe('1 von 1 erreicht, 1 fällig');
    expect(mastery('mastered', skill0).unit(courseUnits(provider.course)[1].id).reached).toBe(0);
  });

  it('a finished step sits only when every goal it shows is reached', () => {
    const lesson = unit0.nodes[0].id;
    const step = steps(new Set([lesson])).find((s) => s.node.id === lesson)!;
    expect(mastery('worked', skill0).node(step)).toBe('worked');
    expect(mastery('practicing', skill0).node(step)).toBe('worked');
    expect(mastery('provisional', skill0).node(step)).toBe('sits');
    expect(mastery('mastered', skill0).node(step)).toBe('sits');
    expect(mastery('due', skill0).node(step)).toBe('due');
  });

  it('an open or locked step and a chest say nothing', () => {
    const all = mastery('mastered', skill0);
    const path = steps(new Set([unit0.nodes[0].id]));
    expect(all.node(path.find((s) => s.state === 'open')!)).toBe('none');
    expect(all.node(path.find((s) => s.state === 'locked')!)).toBe('none');
    const chest = steps(new Set(courseNodes(provider.course).map((n) => n.id))).find((s) => s.node.kind === 'chest')!;
    expect(all.node(chest)).toBe('none');
  });

  it('statuses come from the records and the day', () => {
    const now = 1_780_000_000_000;
    const fresh = PathMastery.from(map, {}, new Set(), now, utc);
    expect(Object.values(fresh.statuses).every((s) => s === 'notStarted')).toBe(true);
    const worked = PathMastery.from(map, {}, new Set(courseNodes(provider.course).map((n) => n.id)), now, utc);
    expect(Object.values(worked.statuses).every((s) => s === 'worked')).toBe(true);
    expect(worked.unit(unit0.id).reached).toBe(0);
  });
});

describe('SkillAdvisor', () => {
  const date = (day: number) => utc.at(2026, 4, day, 9);
  const outcomes = (s: Skill, prefix: string, recognise: number, recall: number, right = true): ExerciseOutcome[] => [
    ...Array.from({ length: recognise }, (_, i) => ({ exerciseID: `${prefix}r${i}`, skill: s.id, level: 'recognise' as const, right, helped: false })),
    ...Array.from({ length: recall }, (_, i) => ({ exerciseID: `${prefix}t${i}`, skill: s.id, level: 'recall' as const, right, helped: false })),
  ];
  const advice = (records: SkillRecords, completed: Set<string>, day: number) =>
    recommend(map, records, CoursePath.units(provider.course, completed), completed, date(day), utc);
  const nodes = courseNodes(provider.course);

  it('a fresh course suggests its first step', () => {
    const result = advice({}, new Set(), 1);
    expect(result.kind).toBe('step');
    expect(result.step?.node.id).toBe('sample.u01.l1');
  });

  it('a reached skill that is due is suggested before the next step', () => {
    const records: SkillRecords = {};
    const first = map.skills[0];
    SkillAssessor.record(outcomes(first, 'a', 6, 4), nodes[0], map, records, date(1), utc);
    const done = new Set([nodes[0].id]);
    const result = advice(records, done, 2);
    expect(result.kind).toBe('review');
    expect(result.skillIDs).toEqual([first.id]);
    expect(advice(records, done, 1).kind).toBe('step');
  });

  it('a shaky prerequisite is practised before the unit that builds on it', () => {
    const records: SkillRecords = {};
    const first = map.skills[0];
    const completed = new Set<string>();
    for (const n of courseUnits(provider.course)[0].nodes) {
      if (n.kind === 'chest') continue;
      SkillAssessor.record(outcomes(first, n.id, 4, 2, false), n, map, records, date(1), utc);
      completed.add(n.id);
    }
    const result = advice(records, completed, 1);
    expect(result.kind).toBe('practice');
    expect(result.skillIDs).toEqual([first.id]);
    expect(result.step).not.toBeNull();
  });

  it('a finished course with nothing due says so', () => {
    expect(advice({}, new Set(nodes.map((n) => n.id)), 1).kind).toBe('finished');
  });

  it('the most overdue skill comes first and at most three are named', () => {
    const records: SkillRecords = {};
    map.skills.forEach((s, index) => SkillAssessor.record(outcomes(s, `s${index}`, 6, 4), null, map, records, date(1 + index), utc));
    const result = advice(records, new Set(), 9);
    expect(result.kind).toBe('review');
    expect(result.skillIDs[0]).toBe(map.skills[0].id);
    expect(result.skillIDs.length).toBeLessThanOrEqual(mostSkillsPerRound);
  });

  it('only an untouched frontier unit can be tested out', () => {
    expect(TestOut.candidate(CoursePath.units(provider.course, new Set()))?.unit.id).toBe('sample.u01');
    expect(TestOut.candidate(CoursePath.units(provider.course, new Set(['sample.u01.l1'])))).toBeUndefined();
    const firstDone = new Set(courseUnits(provider.course)[0].nodes.map((n) => n.id));
    expect(TestOut.candidate(CoursePath.units(provider.course, firstDone))?.unit.id).toBe('sample.u02');
    expect(TestOut.candidate(CoursePath.units(provider.course, new Set(nodes.map((n) => n.id))))).toBeUndefined();
  });

  it('passing needs enough exercises and accuracy', () => {
    const result = (count: number, right: number): LessonResult => ({ lessonID: 't', sessionID: 's', exerciseCount: count, rightFirstTry: right, rightOnRetry: 0, cardKeys: [], cardsRightFirstTry: new Set(), outcomes: [] });
    expect(TestOut.passed(result(14, 12))).toBe(true);
    expect(TestOut.passed(result(14, 11))).toBe(false);
    expect(TestOut.passed(result(5, 5))).toBe(false);
  });

  it('a pass marks everything but the chest', () => {
    const unit = courseUnits(provider.course)[0];
    const marked = TestOut.nodesToComplete(unit);
    const chests = unit.nodes.filter((n) => n.kind === 'chest').map((n) => n.id);
    expect(chests.length).toBeGreaterThan(0);
    expect(chests.some((c) => marked.includes(c))).toBe(false);
    expect(marked).toHaveLength(unit.nodes.length - chests.length);
  });
});

describe('CoursePath', () => {
  const course = provider.course;

  it('a unit has three lessons, practice, checkpoint and chest', () => {
    const unit = courseUnits(course)[0];
    expect(unit.id).toBe('sample.u01');
    expect(unit.nodes.map((n) => n.id)).toEqual(['sample.u01.l1', 'sample.u01.l2', 'sample.u01.l3', 'sample.u01.p', 'sample.u01.t', 'sample.u01.k']);
    expect(unit.nodes.map((n) => n.kind)).toEqual(['lesson', 'lesson', 'lesson', 'practice', 'checkpoint', 'chest']);
    expect(unit.nodes.map((n) => n.index)).toEqual([1, 2, 3, 1, 1, 1]);
    expect(courseNodes(course)).toHaveLength(18);
    expect(nodeWithID(course, 'sample.u02.t')?.unitNumber).toBe(2);
    expect(structureProblems(provider)).toEqual([]);
    expect(standardUnit('x', 12, 'T', '', 't', 4).id).toBe('x.u12');
    expect(standardUnit('x', 1, 'T', '', 't', 4).nodes).toHaveLength(7);
  });

  it('steps open one after the other through the whole course', () => {
    let done = new Set<string>();
    let units = CoursePath.units(course, done);
    expect(units).toHaveLength(3);
    expect(units[0].steps.map((s) => s.state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(units[1].steps[0].state).toBe('locked');
    expect(CoursePath.current(units)?.node.id).toBe('sample.u01.l1');
    expect([units[0].sectionNumber, units[2].sectionNumber]).toEqual([1, 2]);
    done = new Set(courseUnits(course)[0].nodes.map((n) => n.id));
    units = CoursePath.units(course, done);
    expect(units[0].steps.every((s) => s.state === 'done')).toBe(true);
    expect(units[1].steps[0].state).toBe('open');
    expect(CoursePath.current(units)?.node.id).toBe('sample.u02.l1');
    units = CoursePath.units(course, new Set(['sample.u01.l1', 'sample.u01.l3']));
    expect(units[0].steps.map((s) => s.state)).toEqual(['done', 'open', 'done', 'locked', 'locked', 'locked']);
  });

  it('progress counts everything but chests', () => {
    const done = new Set(courseUnits(course)[0].nodes.map((n) => n.id));
    expect(CoursePath.fraction(course, done)).toBeCloseTo(5 / 15, 4);
    done.delete('sample.u01.k');
    expect(CoursePath.fraction(course, done)).toBeCloseTo(5 / 15, 4);
    const all = new Set(courseNodes(course).map((n) => n.id));
    expect(CoursePath.fraction(course, all)).toBe(1);
    expect(CoursePath.isFinished(course, all)).toBe(true);
    expect(CoursePath.isFinished(course, done)).toBe(false);
    expect(CoursePath.current(CoursePath.units(course, all))).toBeUndefined();
  });

  it('chests pay ten, fifteen or twenty', () => {
    expect(courseNodes(course).filter((n) => n.kind === 'chest').map(CoursePath.chestGems)).toEqual([15, 20, 10]);
  });

  it('the next node', () => {
    const nodes = courseNodes(course);
    expect(CoursePath.next(nodes[0], course)?.id).toBe('sample.u01.l2');
    expect(CoursePath.next(nodes[nodes.length - 1], course)).toBeUndefined();
  });

  it('text on a course color is the one that contrasts more', () => {
    const colored = (color: number): Course => ({ id: 'c', title: 'C', subtitle: '', kind: 'math', color, symbol: 'x', sections: [] });
    expect(prefersDarkText(colored(0xffffff))).toBe(true);
    expect(prefersDarkText(colored(0x000000))).toBe(false);
    expect(prefersDarkText(colored(0xb8a04a))).toBe(true);
    expect(prefersDarkText(colored(0xd9903a))).toBe(true);
    expect(prefersDarkText(colored(0x3d6fb6))).toBe(false);
    expect(prefersDarkText(colored(0x5a5aa8))).toBe(false);
    expect(prefersDarkText(colored(0x9e6b8e))).toBe(false);
    expect(courseKinds).toHaveLength(5);
  });

  it('structure problems are found', () => {
    const good = standardUnit('broken', 1, 'T', '', 't');
    const twin = standardUnit('broken', 1, '', '', '');
    const broken: CourseProvider = {
      course: { id: 'broken', title: 'B', subtitle: '', kind: 'math', color: 0, symbol: 'x', sections: [{ id: 's', title: 'S', units: [good, twin] }] },
      exercises: () => [],
    };
    const problems = structureProblems(broken);
    expect(problems.some((p) => p.includes('not unique'))).toBe(true);
    expect(problems.some((p) => p.includes('no title or tip'))).toBe(true);
    expect(problems.some((p) => p.includes('expected 2'))).toBe(true);
  });
});
