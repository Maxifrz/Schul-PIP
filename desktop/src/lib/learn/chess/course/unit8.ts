// Unit 8, "Taktik-Grundlagen": hanging pieces, forks, pins, skewers and discovered attacks. The accepted moves are the
// ones the material search proves best, never an author's guess. Port of ChessUnit8.swift.

import type { LearnExercise } from '../../exercise';
import { shuffled } from '../../random';
import { attackedEnemies, ChessTactics } from '../analysis';
import { acceptedMoves, type ChessGoal } from '../goals';
import { list, nominative, sanWithoutSign } from '../kit';
import { san } from '../notation';
import type { ChessPosition } from '../position';
import {
  ALL_PIECE_KINDS, PAWN, colorAdjectiveStem, colorGermanName, kindGermanName, moveUci, movesEqual, oppositeColor, squareName,
  type ChessMove, type ChessPieceKind, type ChessSquare,
} from '../types';
import { boardMedia, choice, moveExercise, pairs, sentence, sentenceMaker, type ChessDraw, type ChessMaker } from './courseKit';
import { discovered, forks, hanging, pins, samplePosition, sampleFocus, skewers, type ChessSample } from './samples';

/** How deep the search looks, in half moves: the move, the answer and the follow-up capture. */
const DEPTH = 3;

const motifNames: Record<string, string> = { fork: 'Gabel', pin: 'Fesselung', skewer: 'Spieß', discovered: 'Abzugsangriff', hang: 'Hängende Figur' };

const THEMES = ['fork', 'pin', 'skewer', 'discovered', 'hang'];

function pools(): Record<string, ChessSample[]> {
  return { fork: forks, pin: pins, skewer: skewers, discovered, hang: hanging };
}

export const unit8Review = ['u8.mixed.find', 'u8.mixed.choose', 'u8.motif', 'u8.hang.which', 'u8.pin.which'];

const forkSentences = [
  sentence('fork', ['Eine', 'Gabel', 'greift', 'zwei', 'Figuren', 'gleichzeitig', 'an.'], ['drei', 'Turm']),
  sentence('hang', ['Eine', 'hängende', 'Figur', 'ist', 'angegriffen', 'und', 'ungedeckt.'], ['gefesselt', 'gedeckt.']),
];

const lineSentences = [
  sentence('pin', ['Eine', 'am', 'König', 'gefesselte', 'Figur', 'darf', 'ihre', 'Linie', 'nicht', 'verlassen.'], ['immer', 'Dame']),
  sentence('skewer', ['Beim', 'Spieß', 'muss', 'die', 'vordere', 'Figur', 'ausweichen.'], ['hintere', 'Bauer']),
  sentence('discovered', ['Beim', 'Abzugsangriff', 'gibt', 'die', 'ziehende', 'Figur', 'eine', 'Linie', 'frei.'], ['gesperrte', 'Dame']),
];

function terms(draw: ChessDraw): LearnExercise | null {
  return pairs(
    {
      id: 'u8.terms', prompt: 'Ordne die Begriffe zu.',
      from: [
        { key: 'u8.term.fork', front: 'Gabel', back: 'greift zwei Figuren zugleich an' },
        { key: 'u8.term.pin', front: 'Fesselung', back: 'Figur kann nicht ziehen, dahinter steht Wertvolleres' },
        { key: 'u8.term.skewer', front: 'Spieß', back: 'vordere Figur weicht, hintere fällt' },
        { key: 'u8.term.discovered', front: 'Abzugsangriff', back: 'Figur zieht weg und gibt eine Linie frei' },
      ],
    },
    draw,
  );
}

function goalFor(theme: string): ChessGoal {
  return theme === 'hang' ? { type: 'bestCapture' } : { type: 'bestMove', depth: DEPTH };
}

function nameList(squares: readonly ChessSquare[], position: ChessPosition): string {
  return list(
    squares.map((sq) => {
      const p = position.pieceAt(sq);
      return `${p ? kindGermanName(p.kind) : 'Figur'} auf ${squareName(sq)}`;
    }),
  );
}

/** The sentence that says what the best move does, built from what the board shows after it. */
function explanation(theme: string, sample: ChessSample, position: ChessPosition, m: ChessMove): string {
  const text = san(m, position) ?? moveUci(m);
  const after = position.applying(m);
  const mover = position.sideToMove;
  switch (theme) {
    case 'fork': {
      const targets = ChessTactics.forkTargets(m.to, after);
      const kind = after.pieceAt(m.to)?.kind ?? PAWN;
      return `Nach ${text} greift ${nominative(kind)} auf ${squareName(m.to)} gleichzeitig an: ${nameList(targets, after)}. Der Gegner kann nur eine Figur retten. Das ist eine Gabel.`;
    }
    case 'pin': {
      const attacked = attackedEnemies(after, m.to);
      const pinned = ChessTactics.absolutePins(oppositeColor(mover), position).map((p) => p.pinned).filter((s) => attacked.includes(s));
      return `${text} greift die gefesselte Figur an: ${nameList(pinned, position)}. Sie darf ihre Linie nicht verlassen, weil dahinter der König steht, und kann sich deshalb nicht retten.`;
    }
    case 'skewer': {
      const line = ChessTactics.lineUps(mover, after).find((l) => l.attacker === m.to && ChessTactics.isSkewer(l, after));
      if (line) {
        return `${text} greift ${nameList([line.front], after)} an. Sie muss ausweichen, und dahinter steht auf derselben Linie ${nameList([line.back], after)}. Das ist ein Spieß.`;
      }
      return `${text} greift eine wertvolle Figur an, hinter der auf derselben Linie eine weitere steht. Das ist ein Spieß.`;
    }
    case 'discovered': {
      const king = after.kingSquare(oppositeColor(mover));
      const checkers = king === null ? [] : after.attackers(king, mover);
      const captured = position.capturedPiece(m);
      const loss = captured ? ` und ${nominative(captured.kind)} ist nicht mehr zu retten` : '';
      const who = checkers.length > 0 ? `durch die Figur auf ${squareName(checkers[0])}` : '';
      return `Die ziehende Figur macht eine Linie frei: Es entsteht Schach ${who}. Der Gegner muss das Schach aufheben${loss}. Das ist ein Abzugsangriff.`;
    }
    default: {
      const focus = sampleFocus(sample);
      const target = focus ?? m.to;
      return `Die Figur auf ${squareName(target)} war angegriffen, und nichts deckt sie. Du schlägst sie, ohne etwas zu verlieren.`;
    }
  }
}

function poolItems(themes: readonly string[]): { theme: string; sample: ChessSample }[] {
  const all = pools();
  return themes.flatMap((theme) => (all[theme] ?? []).map((sample) => ({ theme, sample })));
}

function find(topic: string, themes: readonly string[], hint: boolean): ChessMaker {
  return (draw) => {
    const item = draw.pick(poolItems(themes), topic, (i) => i.sample.id);
    if (!item) return null;
    const position = samplePosition(item.sample);
    if (!position) return null;
    const goal = goalFor(item.theme);
    const m = acceptedMoves(goal, position)[0];
    if (m === undefined) return null;
    let prompt = item.theme === 'hang' ? 'Schlage so, dass du am meisten gewinnst.' : 'Finde den Zug, der am meisten Material gewinnt.';
    if (hint) prompt += item.theme === 'hang' ? ' Eine Figur hängt.' : ` Tipp: ${motifNames[item.theme] ?? ''}.`;
    return moveExercise({
      id: `${topic}.${item.sample.id}`, prompt, position, goal,
      explanation: explanation(item.theme, item.sample, position, m), withSquares: false,
    });
  };
}

/** Four moves to choose from: the best one and three that are proven worse. */
function choose(topic: string, themes: readonly string[]): ChessMaker {
  return (draw) => {
    const item = draw.pick(poolItems(themes), topic, (i) => i.sample.id);
    if (!item) return null;
    const position = samplePosition(item.sample);
    if (!position) return null;
    const best = acceptedMoves(goalFor(item.theme), position);
    const right = best[0];
    if (right === undefined) return null;
    const rightText = san(right, position);
    if (rightText === null) return null;
    // Wrong moves: the best move's own piece first, then checks and captures, then the rest.
    const mover = position.pieceAt(right.from)?.kind;
    const others = shuffled(position.legalMoves().filter((m) => !best.some((b) => movesEqual(b, m))), draw.random);
    const sameKind = others.filter((m) => position.pieceAt(m.from)?.kind === mover);
    const loud = others.filter((m) => position.givesCheck(m) || position.isCapture(m));
    const wrong: string[] = [];
    for (const m of [...sameKind, ...loud, ...others]) {
      if (wrong.length >= 3) break;
      const text = san(m, position);
      if (text === null) continue;
      const plain = sanWithoutSign(text);
      if (plain !== sanWithoutSign(rightText) && !wrong.includes(plain)) wrong.push(plain);
    }
    return choice(
      {
        id: `${topic}.${item.sample.id}`, prompt: 'Welcher Zug gewinnt hier am meisten Material?', correct: sanWithoutSign(rightText), wrong,
        explanation: explanation(item.theme, item.sample, position, right), media: boardMedia(position),
      },
      draw,
    );
  };
}

/** "Welche zwei Figuren greift die Gabel an?" */
function forkAfter(draw: ChessDraw): LearnExercise | null {
  const best = (position: ChessPosition): ChessMove | undefined => acceptedMoves({ type: 'bestMove', depth: DEPTH }, position)[0];
  const pool = forks.filter((sample) => {
    const position = samplePosition(sample);
    if (!position) return false;
    const m = best(position);
    return m !== undefined && attackedEnemies(position.applying(m), m.to).length === 2;
  });
  const sample = draw.pickSample(pool, 'u8.fork.after');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const m = best(position);
  if (m === undefined) return null;
  const text = san(m, position);
  if (text === null) return null;
  const after = position.applying(m);
  const pairText = (kinds: ChessPieceKind[]): string => [...kinds].sort((a, b) => b - a).map(kindGermanName).join(' und ');
  const actual = attackedEnemies(after, m.to).map((s) => after.pieceAt(s)?.kind).filter((k): k is ChessPieceKind => k !== undefined);
  const right = pairText(actual);
  const presentSet = new Set(after.squaresOfColor(oppositeColor(position.sideToMove)).map((s) => after.pieceAt(s)?.kind).filter((k): k is ChessPieceKind => k !== undefined));
  const present = [...presentSet].sort((a, b) => a - b);
  const all = [...ALL_PIECE_KINDS];
  const wrong: string[] = [];
  for (const pool2 of [present, all]) {
    for (const first of shuffled(pool2, draw.random)) {
      for (const second of shuffled(pool2, draw.random)) {
        if (first < second) {
          const t = pairText([first, second]);
          if (t !== right && !wrong.includes(t) && wrong.length < 3) wrong.push(t);
        }
      }
    }
  }
  return choice(
    {
      id: `u8.fork.after.${sample.id}`,
      prompt: `${colorGermanName(position.sideToMove)} spielt ${sanWithoutSign(text)}. Welche zwei Figuren greift die gezogene Figur dann an?`,
      correct: right, wrong, explanation: explanation('fork', sample, position, m), media: boardMedia(position),
    },
    draw,
  );
}

/** "Welche schwarze Figur ist gefesselt?" */
function pinWhich(draw: ChessDraw): LearnExercise | null {
  const pool = pins.filter((sample) => {
    const position = samplePosition(sample);
    return position ? ChessTactics.absolutePins(oppositeColor(position.sideToMove), position).length === 1 : false;
  });
  const sample = draw.pickSample(pool, 'u8.pin.which');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const color = oppositeColor(position.sideToMove);
  const pin = ChessTactics.absolutePins(color, position)[0];
  const king = position.kingSquare(color);
  if (pin === undefined || king === null) return null;
  const wrong = shuffled(position.squaresOfColor(color).filter((s) => s !== pin.pinned && s !== king), draw.random).map(squareName);
  return choice(
    {
      id: `u8.pin.which.${sample.id}`, prompt: `Welche ${colorAdjectiveStem(color)}e Figur ist gefesselt?`, correct: squareName(pin.pinned), wrong,
      explanation: `Die Figur auf ${squareName(pin.pinned)} steht zwischen der Figur auf ${squareName(pin.pinner)} und dem König auf ${squareName(king)}. Sie darf ihre Linie nicht verlassen.`,
      media: boardMedia(position),
    },
    draw,
  );
}

/** "Welche schwarze Figur hängt?" */
function hangWhich(draw: ChessDraw): LearnExercise | null {
  const pool = hanging.filter((sample) => {
    const position = samplePosition(sample);
    return position ? ChessTactics.hangingPieces(oppositeColor(position.sideToMove), position).length === 1 : false;
  });
  const sample = draw.pickSample(pool, 'u8.hang.which');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const color = oppositeColor(position.sideToMove);
  const hang = ChessTactics.hangingPieces(color, position)[0];
  const king = position.kingSquare(color);
  if (hang === undefined || king === null) return null;
  const wrong = shuffled(position.squaresOfColor(color).filter((s) => s !== hang && s !== king), draw.random).map(squareName);
  return choice(
    {
      id: `u8.hang.which.${sample.id}`, prompt: `Welche ${colorAdjectiveStem(color)}e Figur hängt?`, correct: squareName(hang), wrong,
      explanation: `Die Figur auf ${squareName(hang)} ist angegriffen und nicht gedeckt: Du kannst sie ohne Verlust schlagen.`,
      media: boardMedia(position),
    },
    draw,
  );
}

/** "Welches Motiv steckt in diesem Zug?" */
function motif(draw: ChessDraw): LearnExercise | null {
  const pool = poolItems(THEMES).sort((a, b) => (a.sample.id < b.sample.id ? -1 : a.sample.id > b.sample.id ? 1 : 0));
  const item = draw.pick(pool, 'u8.motif', (i) => i.sample.id);
  if (!item) return null;
  const position = samplePosition(item.sample);
  if (!position) return null;
  const m = acceptedMoves(goalFor(item.theme), position)[0];
  if (m === undefined) return null;
  const text = san(m, position);
  const right = motifNames[item.theme];
  if (text === null || right === undefined) return null;
  const wrong = Object.keys(motifNames).filter((k) => k !== item.theme && k !== 'hang').map((k) => motifNames[k]).sort();
  return choice(
    {
      id: `u8.motif.${item.sample.id}`, prompt: `${colorGermanName(position.sideToMove)} spielt ${text}. Welches Motiv steckt darin?`, correct: right,
      wrong: item.theme === 'hang' ? wrong : wrong.filter((w) => w !== right).concat(['Hängende Figur']),
      explanation: explanation(item.theme, item.sample, position, m), media: boardMedia(position),
    },
    draw,
  );
}

function buildMakers(): Record<string, ChessMaker> {
  const table: Record<string, ChessMaker> = {
    'u8.terms': terms,
    'u8.fork.after': forkAfter,
    'u8.pin.which': pinWhich,
    'u8.hang.which': hangWhich,
    'u8.sentence.fork': sentenceMaker('u8.sentence.fork', forkSentences),
    'u8.sentence.line': sentenceMaker('u8.sentence.line', lineSentences),
    'u8.motif': motif,
  };
  for (const theme of THEMES) {
    table[`u8.${theme}.find`] = find(`u8.${theme}.find`, [theme], true);
    table[`u8.${theme}.choose`] = choose(`u8.${theme}.choose`, [theme]);
  }
  table['u8.mixed.find'] = find('u8.mixed.find', THEMES, false);
  table['u8.mixed.choose'] = choose('u8.mixed.choose', THEMES);
  return table;
}

export const unit8Makers: Record<string, ChessMaker> = buildMakers();
