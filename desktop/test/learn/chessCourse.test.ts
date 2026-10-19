import { describe, expect, it } from 'vitest';
import { CourseNode, courseNodes, courseUnits } from '../../src/lib/learn/course';
import { auditProblems } from '../../src/lib/learn/courseAudit';
import { LearnExercise } from '../../src/lib/learn/exercise';
import { ChessCoach } from '../../src/lib/learn/chess/coach';
import { chess } from '../../src/lib/learn/chess/course';
import { ChessGoals, mateInOne, moves } from '../../src/lib/learn/chess/goals';
import { emptyFEN } from '../../src/lib/learn/chess/kit';
import { ChessNotation } from '../../src/lib/learn/chess/notation';
import { ChessPosition, positionOf, startFEN } from '../../src/lib/learn/chess/position';
import { allSamples, castling, mates, samplePosition } from '../../src/lib/learn/chess/samples';
import { ChessMove, Sq, moveFromUci, moveUci } from '../../src/lib/learn/chess/types';

/** The chess course. The rules engine is proved in chessRules.test.ts; here the authored positions are proved legal and right, and every exercise the course can build is re-checked by routes that do not share the generator's code. */

/** Legal moves by a second route: every pseudo-legal move is played, and it counts when the mover's own king is not attacked afterwards. */
const bruteLegal = (p: ChessPosition): ChessMove[] => p.pseudoLegalMoves().filter((m) => !p.applying(m).isInCheck(p.sideToMove));

interface Item { node: CourseNode; seed: bigint; exercise: LearnExercise }

const seeds = Array.from({ length: 20 }, (_, i) => BigInt(i + 1));

/** The exercises of every node of the course for the seeds 1 to 20, built once. */
let cached: Item[] | null = null;
function corpus(): Item[] {
  if (cached) return cached;
  const items: Item[] = [];
  for (const node of courseNodes(chess.course)) {
    if (node.kind === 'chest') continue;
    for (const seed of seeds) for (const exercise of chess.exercises(node, seed)) items.push({ node, seed, exercise });
  }
  cached = items;
  return items;
}

const boardOf = (e: LearnExercise) => (e.media?.kind === 'board' ? e.media.board : null);
const fenParts = (fen: string) => fen.split(' ').slice(0, 2).join(' ');

describe('the chess course: structure', () => {
  it('passes the course audit', () => {
    expect(auditProblems(chess, seeds)).toEqual([]);
  }, 120000);

  it('has the eight units in three sections', () => {
    const course = chess.course;
    expect(course.id).toBe('chess');
    expect(course.title).toBe('Schach');
    expect(course.subtitle).toBe('Vom ersten Zug bis zum Matt');
    expect(course.kind).toBe('chess');
    expect(course.color).toBe(0xd17a9e);
    const units = courseUnits(course);
    expect(units.map((u) => u.title)).toEqual(['Das Brett', 'Die Figuren und ihre Züge', 'Der Bauer', 'Schach und Matt', 'Sonderzüge', 'Werte und Tausch', 'Matt in einem Zug', 'Taktik-Grundlagen']);
    for (const unit of units) {
      expect(unit.nodes.map((n) => n.kind), unit.id).toEqual(['lesson', 'lesson', 'lesson', 'practice', 'checkpoint', 'chest']);
      expect(unit.summary).not.toBe('');
      const paragraphs = unit.tip.split('\n\n').length;
      expect(paragraphs >= 2 && paragraphs <= 5, `${unit.id} tip has ${paragraphs} paragraphs`).toBe(true);
    }
    expect(course.sections.map((s) => s.units.length)).toEqual([3, 2, 3]);
  });

  it('teaches the German terms in the tips', () => {
    const tips = courseUnits(chess.course).map((u) => u.tip.toLowerCase());
    const required: Array<[number, string[]]> = [
      [0, ['Linien', 'Reihen', 'Diagonalen', 'e4', 'a1']],
      [1, ['Springer', 'Läufer', 'Turm', 'Dame', 'König', 'Sf3']],
      [2, ['Doppelschritt', 'en passant', 'Bauernumwandlung']],
      [3, ['Schach', 'Matt', 'Patt', 'Remis']],
      [4, ['Rochade', 'O-O-O', 'Umwandlung', 'en passant']],
      [5, ['Bauer 1', 'Springer 3', 'Läufer 3', 'Turm 5', 'Dame 9']],
      [6, ['Grundreihenmatt', 'Erstickungsmatt', 'Schäfermatt', 'Leitermatt']],
      [7, ['Gabel', 'Fesselung', 'Spieß', 'Abzugsangriff']],
    ];
    for (const [index, words] of required) for (const word of words) expect(tips[index].includes(word.toLowerCase()), `unit ${index + 1} tip lacks ${word}`).toBe(true);
    for (const item of corpus().filter((i) => i.seed === 1n)) {
      for (const text of [item.exercise.prompt, item.exercise.explanation, item.exercise.solution, ...item.exercise.options]) {
        expect(/[\u{1F300}-\u{1FAFF}]/u.test(text), text).toBe(false);
        expect(text.includes('TODO'), text).toBe(false);
      }
    }
  });

  it('gives chests and unknown nodes no exercises', () => {
    for (const node of courseNodes(chess.course).filter((n) => n.kind === 'chest')) expect(chess.exercises(node, 1n)).toEqual([]);
    const strange: CourseNode = { id: 'chess.u99.l1', courseID: 'chess', unitID: 'chess.u99', unitNumber: 99, kind: 'lesson', index: 1, title: 'x' };
    expect(chess.exercises(strange, 1n)).toEqual([]);
  });

  it('uses several kinds in every step and all three kinds in every unit', () => {
    for (const unit of courseUnits(chess.course)) {
      const unitKinds = new Set<string>();
      for (const node of unit.nodes.filter((n) => n.kind !== 'chest')) {
        const kinds = new Set(chess.exercises(node, 1n).map((e) => e.kind));
        expect(kinds.size, node.id).toBeGreaterThanOrEqual(2);
        kinds.forEach((k) => unitKinds.add(k));
      }
      expect(unitKinds.size, `${unit.id} meets its items in too few forms`).toBeGreaterThanOrEqual(3);
    }
  });

  it('has the sizes of the plans', () => {
    for (const node of courseNodes(chess.course).filter((n) => n.kind !== 'chest')) {
      const expected = node.kind === 'checkpoint' ? 14 : node.kind === 'practice' ? 12 : 10;
      for (const seed of seeds) expect(chess.exercises(node, seed).length, `${node.id} seed ${seed}`).toBe(expected);
    }
  });

  it('shows other lessons for other seeds and the same lesson for the same seed', () => {
    for (const node of courseNodes(chess.course).filter((n) => n.kind !== 'chest')) {
      const runs = seeds.map((s) => chess.exercises(node, s).map((e) => e.id).join('|'));
      expect(new Set(runs).size, `${node.id} shows too few different lessons`).toBeGreaterThanOrEqual(12);
      expect(chess.exercises(node, 7n)).toEqual(chess.exercises(node, 7n));
    }
  });

  it('shows many distinct positions', () => {
    const fens = new Set<string>();
    for (const item of corpus()) {
      const board = boardOf(item.exercise);
      if (board && board.fen !== emptyFEN) fens.add(fenParts(board.fen));
    }
    expect(fens.size, `only ${fens.size} distinct positions`).toBeGreaterThanOrEqual(60);
    expect(new Set(allSamples.map((s) => fenParts(s.fen))).size).toBeGreaterThanOrEqual(150);
  });

  it('builds all lessons quickly', () => {
    const nodes = courseNodes(chess.course).filter((n) => n.kind !== 'chest');
    const start = Date.now();
    for (const node of nodes) chess.exercises(node, 987654n);
    expect((Date.now() - start) / 1000, 'building all nodes').toBeLessThan(20);
  });
});

describe('the chess course: every exercise', () => {
  it('has a sound board', () => {
    for (const item of corpus()) {
      const board = boardOf(item.exercise);
      if (!board) continue;
      const position = positionOf(board.fen);
      expect(board.flipped, `${item.exercise.id}: the board is turned towards the side to move`).toBe(position.sideToMove === 'black');
      for (const name of board.marked) expect(Sq.of(name), `${item.exercise.id}: marked ${name}`).not.toBeNull();
      if (board.fen !== emptyFEN) expect(position.validationProblems(), `${item.exercise.id} ${board.fen}`).toEqual([]);
    }
  });

  it('accepts only legal moves, and the solution names one', () => {
    let count = 0;
    for (const item of corpus().filter((i) => i.exercise.kind === 'chessMove')) {
      count += 1;
      const e = item.exercise;
      const board = boardOf(e);
      expect(board, e.id).not.toBeNull();
      const position = positionOf(board!.fen);
      const legal = new Set(bruteLegal(position).map(moveUci));
      expect(e.correctAnswers.length, e.id).toBeGreaterThan(0);
      for (const answer of e.correctAnswers) {
        if (answer.length === 5) expect(legal.has(answer), `${e.id}: ${answer} is not legal`).toBe(true);
        else expect(legal.has(answer) || legal.has(`${answer}q`), `${e.id}: ${answer} is not legal`).toBe(true);
      }
      expect(e.solution).not.toBe('');
      expect(e.explanation, e.id).not.toBe('');
      const first = e.solution.split(' oder ')[0].split(' (')[0];
      if (first !== '…') {
        const move = ChessNotation.moveFromSAN(first, position);
        expect(move, `${e.id}: solution ${first} is no move`).not.toBeNull();
        expect(e.correctAnswers.includes(moveUci(move!)) || e.correctAnswers.includes(Sq.name(move!.from) + Sq.name(move!.to)), e.id).toBe(true);
      }
    }
    expect(count).toBeGreaterThan(500);
  });

  it('has short prompts and explains every rule exercise', () => {
    for (const item of corpus()) {
      expect(item.exercise.prompt.length, item.exercise.id).toBeLessThanOrEqual(170);
      if (item.exercise.kind !== 'matchPairs' && item.exercise.kind !== 'wordBank') expect(item.exercise.explanation, `${item.exercise.id} has no explanation`).not.toBe('');
    }
  });

  it('has sound and unique authored positions', () => {
    expect(new Set(allSamples.map((s) => s.id)).size, 'sample ids are not unique').toBe(allSamples.length);
    for (const sample of allSamples) {
      const position = samplePosition(sample);
      expect(position, `${sample.id}: FEN does not parse`).not.toBeNull();
      if (!position) continue;
      expect(position.validationProblems(), sample.id).toEqual([]);
      expect(position.fen, `${sample.id}: FEN is not in the engine's own form`).toBe(sample.fen);
      if (sample.focus) expect(Sq.of(sample.focus), sample.id).not.toBeNull();
      expect(bruteLegal(position).length, sample.id).toBe(position.legalMoves().length);
    }
  });
});

describe('the chess coach', () => {
  const start = positionOf(startFEN);
  const explain = (move: string, goal = 'moves', fen?: string) => ChessCoach.explain(move, goal, fen ? positionOf(fen) : start);

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

  it('gives every move exercise hints and a coach', () => {
    let found = 0;
    for (const node of courseNodes(chess.course).filter((n) => n.kind !== 'chest')) {
      for (const e of chess.exercises(node, 1n).filter((x) => x.kind === 'chessMove')) {
        found += 1;
        expect(e.hints.length >= 1 && e.hints.length <= 2, e.id).toBe(true);
        expect(e.coach.startsWith(ChessCoach.prefix), e.id).toBe(true);
        expect(e.hints.every((h) => h !== '')).toBe(true);
      }
    }
    expect(found).toBeGreaterThan(20);
  });

  it('answers every wrong move of every move exercise', () => {
    for (const node of courseNodes(chess.course).filter((n) => n.kind === 'lesson')) {
      for (const e of chess.exercises(node, 3n).filter((x) => x.kind === 'chessMove')) {
        const board = boardOf(e);
        expect(board && ChessPosition.fromFEN(board.fen), `${e.id} has no valid position`).toBeTruthy();
        let asked = 0;
        for (const from of Sq.all) {
          const targets = [Sq.at((Sq.file(from) + 1) % 8, Sq.rank(from)), Sq.at(Sq.file(from), (Sq.rank(from) + 2) % 8)];
          for (const to of targets) {
            if (to === null || to === from) continue;
            const uci = Sq.name(from) + Sq.name(to);
            if (e.correctAnswers.includes(uci)) continue;
            expect(chess.feedback(e, { type: 'move', value: uci }), `${e.id} ${uci}`).not.toBeNull();
            asked += 1;
          }
        }
        expect(asked).toBeGreaterThan(50);
      }
    }
  });

  it('never explains why an accepted move fails', () => {
    for (const node of courseNodes(chess.course).filter((n) => n.kind === 'practice')) {
      for (const e of chess.exercises(node, 2n).filter((x) => x.kind === 'chessMove' && x.coach === 'chess:mate')) {
        const board = boardOf(e);
        const position = board ? ChessPosition.fromFEN(board.fen) : null;
        if (!position) continue;
        for (const answer of e.correctAnswers) {
          const move = moveFromUci(answer);
          if (move) expect(position.applying(move).isCheckmate, `${e.id} ${answer} is accepted but is no mate`).toBe(true);
        }
      }
    }
  });
});

describe('the goals of the chess course', () => {
  it('handles the promotion tap', () => {
    const up = moveFromUci('a7a8q') as ChessMove;
    const rook = moveFromUci('a7a8r') as ChessMove;
    expect(ChessGoals.answers([up])).toEqual(['a7a8q', 'a7a8']);
    expect(ChessGoals.answers([up, rook])).toEqual(['a7a8q', 'a7a8', 'a7a8r']);
    expect(ChessGoals.answers([rook])).toBeNull();
    expect(ChessGoals.answers([moveFromUci('e2e4') as ChessMove])).toEqual(['e2e4']);
  });
});

describe('the authored positions agree with the engine', () => {
  it('castling samples say yes or no as the engine does', () => {
    for (const sample of castling) {
      const position = samplePosition(sample) as ChessPosition;
      const side = sample.detail === 'kurz' ? 'kingside' : 'queenside';
      const possible = ChessGoals.accepted(moves({ castling: side }), position).length > 0;
      expect(possible ? 'ja' : 'nein', sample.id).toBe(sample.expected[0]);
    }
  });

  it('mate samples list the mating moves the engine finds', () => {
    let checked = 0;
    for (const sample of mates) {
      if (sample.expected.length === 0) continue;
      const position = samplePosition(sample) as ChessPosition;
      const found = ChessGoals.accepted(mateInOne, position).map((m) => ChessNotation.san(m, position)).filter((t): t is string => t !== null);
      expect([...found].sort(), sample.id).toEqual([...sample.expected].sort());
      checked += 1;
    }
    expect(checked).toBeGreaterThan(10);
  });
});
