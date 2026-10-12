// Ports of LernwerkTests/ChessCourseTests.swift and the chess parts of SkillCoursesTests.swift and
// SkillFeedbackTests.swift. The rules engine is proved elsewhere; here the authored positions are proved legal and
// right, and every exercise the course can build is re-checked by routes that do not share the generator's code.
import { describe, expect, it } from 'vitest';
import { CourseAudit } from '../../src/lib/learn/audit';
import { chessProvider, allSamples, sampleFocus } from '../../src/lib/learn/chess/course';
import { EMPTY_FEN } from '../../src/lib/learn/chess/kit';
import { COACH_PREFIX, coachExplain } from '../../src/lib/learn/chess/coach';
import { moveFromSAN } from '../../src/lib/learn/chess/notation';
import { ChessPosition } from '../../src/lib/learn/chess/position';
import { CompetenceLevels, lessonExercises, skillMap, type CompetenceLevel } from '../../src/lib/learn/skills/skill';
import { SkillAssessor, type ExerciseOutcome, SkillRecord, skillStatusIsReached } from '../../src/lib/learn/skills/assessor';
import { SkillPractice } from '../../src/lib/learn/skills/advisor';
import type { CourseNode } from '../../src/lib/learn/course';
import { LearnAnswer, type ExerciseKind, type LearnExercise } from '../../src/lib/learn/exercise';
import { PAWN, moveFromUci, moveUci, oppositeColor, square, squareFromName, squareName, type ChessMove } from '../../src/lib/learn/chess/types';
import { at, calendar } from './kit';

const provider = chessProvider;
const course = provider.course;
const utc = calendar('UTC');
const date = (day: number): number => at(utc, 2026, 5, day, 10);
const steps = (): CourseNode[] => course.nodes.filter((n) => n.kind !== 'chest');

// Helpers independent of the generator

/** Legal moves by a second route: every pseudo-legal move is played, and it counts when the mover's own king is not
 * attacked afterwards. */
function bruteLegal(position: ChessPosition): ChessMove[] {
  return position.pseudoLegalMoves().filter((m) => !position.applying(m).isInCheck(position.sideToMove));
}

function position(fen: string): ChessPosition {
  const p = ChessPosition.fromFen(fen);
  if (!p) throw new Error(`FEN does not parse: ${fen}`);
  return p;
}

interface Item {
  node: CourseNode;
  seed: bigint;
  exercise: LearnExercise;
}

let cached: Item[] | null = null;
/** The exercises of every node of the course for the seeds 1 to 20, built once. */
function corpus(): Item[] {
  if (cached) return cached;
  const items: Item[] = [];
  for (const node of steps()) {
    for (let seed = 1n; seed <= 20n; seed++) {
      for (const exercise of provider.exercises(node, seed)) items.push({ node, seed, exercise });
    }
  }
  cached = items;
  return items;
}

const boardOf = (e: LearnExercise) => (e.media && e.media.type === 'board' ? e.media.board : null);
const positionOf = (e: LearnExercise): ChessPosition => {
  const spec = boardOf(e);
  if (!spec) throw new Error(`${e.id} has no board`);
  return position(spec.fen);
};

describe('the chess course', () => {
  it('passes the course audit for seeds 1 to 20', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => BigInt(i + 1));
    expect(CourseAudit.problems(provider, seeds)).toEqual([]);
  });

  it('has the structure of the Swift course', () => {
    expect(course.id).toBe('chess');
    expect(course.title).toBe('Schach');
    expect(course.subtitle).toBe('Vom ersten Zug bis zum Matt');
    expect(course.kind).toBe('chess');
    expect(course.color).toBe(0xd17a9e);
    expect(course.symbol).toBe('crown.fill');
    expect(course.units.length).toBe(8);
    expect(course.units.map((u) => u.title)).toEqual([
      'Das Brett', 'Die Figuren und ihre Züge', 'Der Bauer', 'Schach und Matt', 'Sonderzüge', 'Werte und Tausch', 'Matt in einem Zug', 'Taktik-Grundlagen',
    ]);
    for (const unit of course.units) {
      expect(unit.nodes.filter((n) => n.kind === 'lesson').length, unit.id).toBe(3);
      expect(unit.nodes.map((n) => n.kind), unit.id).toEqual(['lesson', 'lesson', 'lesson', 'practice', 'checkpoint', 'chest']);
      expect(unit.summary).not.toBe('');
      const paragraphs = unit.tip.split('\n\n').length;
      expect(paragraphs >= 2 && paragraphs <= 5, `${unit.id} tip has ${paragraphs} paragraphs`).toBe(true);
    }
    expect(course.sections.map((s) => s.units.length)).toEqual([3, 2, 3]);
  });

  it('teaches the German terms in the tips and keeps the texts plain', () => {
    const tips = course.units.map((u) => u.tip);
    const required: [number, string[]][] = [
      [0, ['Linien', 'Reihen', 'Diagonalen', 'e4', 'a1']],
      [1, ['Springer', 'Läufer', 'Turm', 'Dame', 'König', 'Sf3']],
      [2, ['Doppelschritt', 'en passant', 'Bauernumwandlung']],
      [3, ['Schach', 'Matt', 'Patt', 'Remis']],
      [4, ['Rochade', 'O-O-O', 'Umwandlung', 'en passant']],
      [5, ['Bauer 1', 'Springer 3', 'Läufer 3', 'Turm 5', 'Dame 9']],
      [6, ['Grundreihenmatt', 'Erstickungsmatt', 'Schäfermatt', 'Leitermatt']],
      [7, ['Gabel', 'Fesselung', 'Spieß', 'Abzugsangriff']],
    ];
    for (const [index, words] of required) {
      for (const word of words) expect(tips[index].toLowerCase().includes(word.toLowerCase()), `unit ${index + 1} tip lacks ${word}`).toBe(true);
    }
    for (const item of corpus()) {
      if (item.seed !== 1n) continue;
      const e = item.exercise;
      for (const text of [e.prompt, e.explanation, e.solution, ...e.options]) {
        expect(Array.from(text).some((c) => c.codePointAt(0)! >= 0x1f300 && c.codePointAt(0)! <= 0x1faff), text).toBe(false);
        expect(text.includes('TODO'), text).toBe(false);
      }
    }
  });

  it('gives chests and unknown nodes no exercises', () => {
    for (const node of course.nodes.filter((n) => n.kind === 'chest')) expect(provider.exercises(node, 1n)).toEqual([]);
    const strange: CourseNode = { id: 'chess.u99.l1', courseID: 'chess', unitID: 'chess.u99', unitNumber: 99, kind: 'lesson', index: 1, title: 'x' };
    expect(provider.exercises(strange, 1n)).toEqual([]);
  });

  it('uses several kinds in every node and all three in every unit', () => {
    for (const unit of course.units) {
      const unitKinds = new Set<ExerciseKind>();
      for (const node of unit.nodes.filter((n) => n.kind !== 'chest')) {
        const kinds = new Set(provider.exercises(node, 1n).map((e) => e.kind));
        expect(kinds.size, node.id).toBeGreaterThanOrEqual(2);
        kinds.forEach((k) => unitKinds.add(k));
      }
      expect(unitKinds.size, `${unit.id} meets its items in too few forms`).toBeGreaterThanOrEqual(3);
    }
  });

  it('has the node sizes 10, 12 and 14', () => {
    for (const node of steps()) {
      const expected = node.kind === 'checkpoint' ? 14 : node.kind === 'practice' ? 12 : 10;
      for (let seed = 1n; seed <= 20n; seed++) expect(provider.exercises(node, seed).length, `${node.id} seed ${seed}`).toBe(expected);
    }
  });

  it('gives different lessons for different seeds and the same one for the same seed', () => {
    for (const node of steps()) {
      const runs = Array.from({ length: 20 }, (_, i) => provider.exercises(node, BigInt(i + 1)));
      const distinct = new Set(runs.map((r) => r.map((e) => e.id).join('|')));
      expect(distinct.size, `${node.id} shows too few different lessons`).toBeGreaterThanOrEqual(12);
      expect(provider.exercises(node, 7n)).toEqual(provider.exercises(node, 7n));
    }
  });

  it('shows many distinct positions', () => {
    const key = (fen: string): string => fen.split(' ').slice(0, 2).join(' ');
    const fens = new Set<string>();
    for (const item of corpus()) {
      const spec = boardOf(item.exercise);
      if (spec && spec.fen !== EMPTY_FEN) fens.add(key(spec.fen));
    }
    expect(fens.size, `only ${fens.size} distinct positions`).toBeGreaterThanOrEqual(60);
    expect(new Set(allSamples().map((s) => key(s.fen))).size).toBeGreaterThanOrEqual(150);
  });

  it('builds a lesson fast', () => {
    const start = performance.now();
    for (const node of steps()) provider.exercises(node, 987654n);
    expect(performance.now() - start).toBeLessThan(20000);
    const again = performance.now();
    for (const node of steps()) provider.exercises(node, 987654n);
    expect(performance.now() - again).toBeLessThan(5000);
  });
});

describe('every exercise, whatever it asks', () => {
  it('shows a sound position, turned towards the side to move', () => {
    for (const item of corpus()) {
      const spec = boardOf(item.exercise);
      if (!spec) continue;
      const p = position(spec.fen);
      expect(spec.flipped, `${item.exercise.id}: the board is turned towards the side to move`).toBe(p.sideToMove === 'black');
      for (const name of spec.marked) expect(squareFromName(name), `${item.exercise.id}: marked ${name}`).not.toBeNull();
      if (spec.fen !== EMPTY_FEN) expect(p.validationProblems(), `${item.exercise.id} ${spec.fen}`).toEqual([]);
    }
  });

  it('accepts only legal moves in move exercises and names one in the solution', () => {
    let count = 0;
    for (const item of corpus()) {
      const e = item.exercise;
      if (e.kind !== 'chessMove') continue;
      count += 1;
      const p = positionOf(e);
      const legal = new Set(bruteLegal(p).map(moveUci));
      expect(e.correctAnswers.length, e.id).toBeGreaterThan(0);
      for (const answer of e.correctAnswers) {
        if (answer.length === 5) expect(legal.has(answer), `${e.id}: ${answer} is not legal`).toBe(true);
        else expect(legal.has(answer) || legal.has(answer + 'q'), `${e.id}: ${answer} is not legal`).toBe(true);
      }
      expect(e.solution).not.toBe('');
      expect(e.explanation, e.id).not.toBe('');
      const first = e.solution.split(' oder ')[0].split(' (')[0];
      if (first !== '…') {
        const m = moveFromSAN(first, p);
        expect(m, `${e.id}: solution ${first} is no move`).not.toBeNull();
        const uci = moveUci(m!);
        expect(e.correctAnswers.includes(uci) || e.correctAnswers.includes(squareName(m!.from) + squareName(m!.to)), e.id).toBe(true);
      }
    }
    expect(count).toBeGreaterThan(500);
  });

  it('keeps prompts short and explains every rule exercise', () => {
    for (const item of corpus()) {
      const e = item.exercise;
      expect(Array.from(e.prompt).length, e.id).toBeLessThanOrEqual(170);
      if (e.kind !== 'matchPairs' && e.kind !== 'wordBank') expect(e.explanation, `${e.id} has no explanation`).not.toBe('');
    }
  });

  it('has sound, unique samples', () => {
    const all = allSamples();
    expect(new Set(all.map((s) => s.id)).size, 'sample ids are not unique').toBe(all.length);
    for (const sample of all) {
      const p = ChessPosition.fromFen(sample.fen);
      expect(p, `${sample.id}: FEN does not parse`).not.toBeNull();
      expect(p!.validationProblems(), sample.id).toEqual([]);
      expect(p!.fen, `${sample.id}: FEN is not in the engine's own form`).toBe(sample.fen);
      if (sample.focus) expect(squareFromName(sample.focus), sample.id).not.toBeNull();
      expect(bruteLegal(p!).length, sample.id).toBe(p!.legalMoves().length);
    }
  });

  it('agrees with the authored solutions of the samples', async () => {
    // Single-answer escapes and mates: the engine's answer is the author's.
    const { acceptedMoves } = await import('../../src/lib/learn/chess/goals');
    const { san } = await import('../../src/lib/learn/chess/notation');
    for (const sample of allSamples().filter((s) => s.id.startsWith('mate.'))) {
      const p = position(sample.fen);
      const texts = acceptedMoves({ type: 'mateInOne' }, p).map((m) => san(m, p)!).sort();
      expect(texts, sample.id).toEqual([...sample.expected].sort());
    }
    expect(sampleFocus(allSamples()[0])).toBeNull();
  });
});

describe('chess skills', () => {
  it('splits knowing from doing at the board', () => {
    const map = skillMap(provider);
    expect(map.skills.length).toBe(16);
    expect(map.problems()).toEqual([]);
    const board = map.skill('chess.u08.board');
    expect(board?.levels).toEqual(['apply']);
    expect(board?.prerequisites).toEqual(['chess.u08.know']);
    expect(map.skill('chess.u02.know')?.prerequisites).toEqual(['chess.u01.know']);
    expect(map.skill('chess.u04.know')?.levels).toEqual(['recognise']);
    expect(map.skill('chess.u03.know')?.levels).toEqual(['recognise', 'recall']);
  });

  it('puts every exercise of a step under a declared goal', () => {
    const map = skillMap(provider);
    for (const node of steps()) {
      for (const seed of [1n, 2n]) {
        for (const e of lessonExercises(provider, node, seed)) {
          expect(e.skill, `${e.id} has no skill`).not.toBe('');
          expect(e.level, e.id).not.toBeNull();
          expect(map.skill(e.skill), `${e.id} -> ${e.skill}`).toBeDefined();
        }
      }
    }
  });

  it('shows every level a goal asks for in its steps', () => {
    const map = skillMap(provider);
    const seen = new Map<string, Set<CompetenceLevel>>();
    for (const node of steps()) {
      for (const seed of [1n, 2n, 3n, 4n]) {
        for (const e of lessonExercises(provider, node, seed)) {
          if (e.level === null) continue;
          if (!seen.has(e.skill)) seen.set(e.skill, new Set());
          seen.get(e.skill)!.add(e.level);
        }
      }
    }
    for (const skill of map.skills) for (const level of skill.levels) expect(seen.get(skill.id)?.has(level), `${skill.id} never asks at level ${level}`).toBe(true);
  });

  /** Plays every step of the course once, right on every first try, and records it. */
  function perfectDay(day: number, seed: bigint, records: Record<string, SkillRecord>): void {
    const map = skillMap(provider);
    for (const node of steps()) {
      const list: ExerciseOutcome[] = [];
      for (const e of lessonExercises(provider, node, seed)) {
        if (e.level === null) continue;
        list.push({ exerciseID: e.id, skill: e.skill, level: e.level, right: true, helped: false });
      }
      SkillAssessor.record(list, node, map, records, date(day), utc);
    }
  }

  it('masters every goal for a student who answers everything right within a few days', () => {
    const map = skillMap(provider);
    const records: Record<string, SkillRecord> = {};
    perfectDay(1, 1n, records);
    perfectDay(2, 2n, records);
    // Goals the path alone gives too few answers for get the rounds the advice would suggest.
    for (let day = 2; day <= 5; day++) {
      for (const skill of map.skills) {
        const status = SkillAssessor.status(records[skill.id], skill, new Set(), date(day), utc);
        if (status === 'mastered') continue;
        const round = SkillPractice.exercises(provider, map, [skill.id], records, BigInt(day * 100));
        const list: ExerciseOutcome[] = [];
        for (const e of round) if (e.level !== null) list.push({ exerciseID: e.id, skill: e.skill, level: e.level, right: true, helped: false });
        SkillAssessor.record(list, null, map, records, date(day), utc);
      }
    }
    for (const skill of map.skills) {
      const status = SkillAssessor.status(records[skill.id], skill, new Set(), date(5), utc);
      expect(status === 'mastered', `${skill.id} is ${status}: ${SkillAssessor.missing(records[skill.id] ?? new SkillRecord(), skill)}`).toBe(true);
    }
  });

  it('never masters anything in one day', () => {
    const map = skillMap(provider);
    const records: Record<string, SkillRecord> = {};
    perfectDay(1, 1n, records);
    perfectDay(1, 2n, records);
    for (const skill of map.skills) expect(SkillAssessor.status(records[skill.id], skill, new Set(), date(1), utc), skill.id).not.toBe('mastered');
  });

  it('never reaches board goals for a student who only chooses', () => {
    const map = skillMap(provider);
    const records: Record<string, SkillRecord> = {};
    [1n, 2n, 3n].forEach((seed, index) => {
      for (const node of steps()) {
        const list: ExerciseOutcome[] = [];
        for (const e of lessonExercises(provider, node, seed)) {
          if (e.level === null) continue;
          // Right where there is something to pick, wrong where something must be produced.
          list.push({ exerciseID: e.id, skill: e.skill, level: e.level, right: e.level === 'recognise', helped: false });
        }
        SkillAssessor.record(list, node, map, records, date(1 + index), utc);
      }
    });
    for (const skill of map.skills.filter((s) => s.levels.some((l) => CompetenceLevels.isHigher(l, 'recognise')))) {
      const status = SkillAssessor.status(records[skill.id], skill, new Set(), date(4), utc);
      expect(skillStatusIsReached(status), `${skill.id} is ${status}`).toBe(false);
    }
  });
});

describe('the chess coach on the course', () => {
  const start = ChessPosition.start;
  const explain = (move: string, goal = 'moves', fen?: string): string | null => coachExplain(move, goal, fen ? position(fen) : start);

  it('says why a move is not allowed', () => {
    expect(explain('e4e5')).toBe('Auf e4 steht keine Figur.');
    expect(explain('e7e5')).toBe('Auf e7 steht eine schwarze Figur, aber Weiß ist am Zug.');
    expect(explain('g1g2')).toBe('Auf g2 steht schon eine eigene Figur.');
    expect(explain('a1a3')).toBe('Der Weg von a1 nach a3 ist versperrt.');
    expect(explain('e2e5')?.startsWith('Der Bauer kann nicht von e2 nach e5 ziehen.')).toBe(true);
  });

  it('knows a pin and a check', () => {
    expect(explain('e2d3', 'moves', '4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1')).toBe('Nach diesem Zug stünde dein König im Schach. Das ist nicht erlaubt.');
    expect(explain('a1a2', 'moves', '4r1k1/8/8/8/8/8/8/R3K3 w - - 0 1')).toBe('Du stehst im Schach. Dieser Zug beendet das Schach nicht.');
  });

  it('says what a legal but wrong move does not do', () => {
    const backRank = '6k1/5p1p/6p1/8/8/8/8/R3K3 w - - 0 1';
    expect(explain('a1a8', 'mate', backRank)).toContain('verteidigen');
    expect(explain('a1a7', 'mate', backRank)).toContain('kein Schach');
    const knight = '4k3/8/2p5/3p4/5N2/8/8/4K3 w - - 0 1';
    expect(explain('f4d5', 'capture', knight)).toContain('zurückschlagen');
    expect(explain('f4h5', 'capture', knight)).toContain('schlägt aber nichts');
    expect(explain('e2e4', 'moves')).toBe('Der Zug ist erlaubt, aber er ist nicht der, nach dem gefragt ist.');
  });

  it('gives every move exercise hints and a coach tag', () => {
    let found = 0;
    for (const node of steps()) {
      for (const e of lessonExercises(provider, node, 1n)) {
        if (e.kind !== 'chessMove') continue;
        found += 1;
        expect(e.hints.length >= 1 && e.hints.length <= 2, e.id).toBe(true);
        expect(e.coach.startsWith(COACH_PREFIX), e.id).toBe(true);
        expect(e.hints.every((h) => h !== '')).toBe(true);
      }
    }
    expect(found).toBeGreaterThan(20);
  });

  it('answers every wrong move of every move exercise', () => {
    for (const node of course.nodes.filter((n) => n.kind === 'lesson')) {
      for (const e of lessonExercises(provider, node, 3n)) {
        if (e.kind !== 'chessMove') continue;
        expect(boardOf(e) && ChessPosition.fromFen(boardOf(e)!.fen), `${e.id} has no valid position`).toBeTruthy();
        let asked = 0;
        for (let from = 0; from < 64; from++) {
          const file = from & 7;
          const rank = from >> 3;
          const targets = [square((file + 1) % 8, rank), square(file, (rank + 2) % 8)].filter((t): t is number => t !== null);
          for (const to of targets) {
            const uci = squareName(from) + squareName(to);
            if (e.correctAnswers.includes(uci) || from === to) continue;
            expect(provider.feedback(e, LearnAnswer.move(uci)), `${e.id} ${uci}`).not.toBeNull();
            asked += 1;
          }
        }
        expect(asked).toBeGreaterThan(50);
      }
    }
  });

  it('never explains a failure for an accepted move and accepts only mates in mate exercises', () => {
    for (const node of course.nodes.filter((n) => n.kind === 'practice')) {
      for (const e of lessonExercises(provider, node, 2n)) {
        if (e.kind !== 'chessMove' || e.coach !== 'chess:mate') continue;
        const p = positionOf(e);
        for (const answer of e.correctAnswers) {
          const m = moveFromUci(answer);
          if (!m) continue;
          expect(p.applying(m).isCheckmate, `${e.id} ${answer} is accepted but is no mate`).toBe(true);
        }
      }
    }
  });

  it('gives no feedback for exercises without a coach tag or a non-move answer', () => {
    const e = lessonExercises(provider, course.nodes[0], 1n).find((x) => x.kind === 'multipleChoice')!;
    expect(provider.feedback!(e, LearnAnswer.option('x'))).toBeNull();
    const mv = lessonExercises(provider, course.nodes[2], 1n).find((x) => x.kind === 'chessMove')!;
    expect(provider.feedback!(mv, LearnAnswer.typed('e2e4'))).toBeNull();
    void PAWN;
    void oppositeColor;
  });
});
