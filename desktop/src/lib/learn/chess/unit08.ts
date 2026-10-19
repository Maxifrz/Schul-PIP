import type { LearnExercise } from '../exercise';
import { ChessTactics, attackedEnemies } from './analysis';
import { ChessGoal, ChessGoals, bestCapture, bestMove } from './goals';
import { ChessDraw, ChessKit, ChessMaker, ChessSentence } from './kit';
import { ChessNotation } from './notation';
import { ChessPosition } from './position';
import { ChessSample, discovered, focusSquare, forks, hanging, pins, samplePosition, skewers } from './samples';
import { ChessExchange } from './search';
import { ChessMove, PieceKind, Sq, Square, adjectiveStem, colorName, kindName, kindRaw, moveUci, opposite, pieceKinds } from './types';

/** How deep the search looks, in half moves: the move, the answer and the follow-up capture. */
const depth = 3;

const motifNames: Record<string, string> = { fork: 'Gabel', pin: 'Fesselung', skewer: 'Spieß', discovered: 'Abzugsangriff', hang: 'Hängende Figur' };

const pools = (): Record<string, ChessSample[]> => ({ fork: forks, pin: pins, skewer: skewers, discovered, hang: hanging });

const allThemes = ['fork', 'pin', 'skewer', 'discovered', 'hang'];

const forkSentences: ChessSentence[] = [
  { key: 'fork', words: ['Eine', 'Gabel', 'greift', 'zwei', 'Figuren', 'gleichzeitig', 'an.'], extra: ['drei', 'Turm'] },
  { key: 'hang', words: ['Eine', 'hängende', 'Figur', 'ist', 'angegriffen', 'und', 'ungedeckt.'], extra: ['gefesselt', 'gedeckt.'] },
];

const lineSentences: ChessSentence[] = [
  { key: 'pin', words: ['Eine', 'am', 'König', 'gefesselte', 'Figur', 'darf', 'ihre', 'Linie', 'nicht', 'verlassen.'], extra: ['immer', 'Dame'] },
  { key: 'skewer', words: ['Beim', 'Spieß', 'muss', 'die', 'vordere', 'Figur', 'ausweichen.'], extra: ['hintere', 'Bauer'] },
  { key: 'discovered', words: ['Beim', 'Abzugsangriff', 'gibt', 'die', 'ziehende', 'Figur', 'eine', 'Linie', 'frei.'], extra: ['gesperrte', 'Dame'] },
];

/** Unit 8, "Taktik-Grundlagen": hanging pieces, forks, pins, skewers and discovered attacks. The accepted moves are the ones the material search proves best, never an author's guess. */
export const ChessUnit8 = {
  depth,
  review: ['u8.mixed.find', 'u8.mixed.choose', 'u8.motif', 'u8.hang.which', 'u8.pin.which'],

  get makers(): Record<string, ChessMaker> {
    const table: Record<string, ChessMaker> = {
      'u8.terms': terms,
      'u8.fork.after': forkAfter,
      'u8.pin.which': pinWhich,
      'u8.hang.which': hangWhich,
      'u8.sentence.fork': ChessKit.sentenceMaker('u8.sentence.fork', forkSentences),
      'u8.sentence.line': ChessKit.sentenceMaker('u8.sentence.line', lineSentences),
      'u8.motif': motif,
    };
    for (const theme of allThemes) {
      table[`u8.${theme}.find`] = find(`u8.${theme}.find`, [theme], true);
      table[`u8.${theme}.choose`] = choose(`u8.${theme}.choose`, [theme]);
    }
    table['u8.mixed.find'] = find('u8.mixed.find', allThemes, false);
    table['u8.mixed.choose'] = choose('u8.mixed.choose', allThemes);
    return table;
  },
};

function terms(draw: ChessDraw): LearnExercise | null {
  return ChessKit.pairs({
    id: 'u8.terms', prompt: 'Ordne die Begriffe zu.', draw,
    from: [
      { key: 'u8.term.fork', front: 'Gabel', back: 'greift zwei Figuren zugleich an' },
      { key: 'u8.term.pin', front: 'Fesselung', back: 'Figur kann nicht ziehen, dahinter steht Wertvolleres' },
      { key: 'u8.term.skewer', front: 'Spieß', back: 'vordere Figur weicht, hintere fällt' },
      { key: 'u8.term.discovered', front: 'Abzugsangriff', back: 'Figur zieht weg und gibt eine Linie frei' },
    ],
  });
}

const goalFor = (theme: string): ChessGoal => (theme === 'hang' ? bestCapture : bestMove(depth));

const gainOf = (m: ChessMove, p: ChessPosition) => ChessExchange.gain(m, p);

function nameList(squares: Square[], position: ChessPosition): string {
  return ChessKit.list(squares.map((s) => {
    const p = position.at(s);
    return `${p ? kindName(p.kind) : 'Figur'} auf ${Sq.name(s)}`;
  }));
}

/** The sentence that says what the best move does, built from what the board shows after it. */
export function explanation(theme: string, sample: ChessSample, position: ChessPosition, move: ChessMove): string {
  const san = ChessNotation.san(move, position) ?? moveUci(move);
  const after = position.applying(move);
  const mover = position.sideToMove;
  switch (theme) {
    case 'fork': {
      const targets = ChessTactics.forkTargets(move.to, after);
      const kind = after.at(move.to)?.kind ?? 'pawn';
      return `Nach ${san} greift ${ChessKit.nominative(kind)} auf ${Sq.name(move.to)} gleichzeitig an: ${nameList(targets, after)}. Der Gegner kann nur eine Figur retten. Das ist eine Gabel.`;
    }
    case 'pin': {
      const hit = attackedEnemies(after, move.to);
      const pinned = ChessTactics.absolutePins(opposite(mover), position).map((p) => p.pinned).filter((s) => hit.includes(s));
      return `${san} greift die gefesselte Figur an: ${nameList(pinned, position)}. Sie darf ihre Linie nicht verlassen, weil dahinter der König steht, und kann sich deshalb nicht retten.`;
    }
    case 'skewer': {
      const line = ChessTactics.lineUps(mover, after).find((l) => l.attacker === move.to && ChessTactics.isSkewer(l, after));
      if (line) {
        return `${san} greift ${nameList([line.front], after)} an. Sie muss ausweichen, und dahinter steht auf derselben Linie ${nameList([line.back], after)}. Das ist ein Spieß.`;
      }
      return `${san} greift eine wertvolle Figur an, hinter der auf derselben Linie eine weitere steht. Das ist ein Spieß.`;
    }
    case 'discovered': {
      const king = after.kingSquare(opposite(mover));
      const checkers = king === null ? [] : after.attackers(king, mover);
      const captured = position.capturedPiece(move);
      const loss = captured ? ` und ${ChessKit.nominative(captured.kind)} ist nicht mehr zu retten` : '';
      const who = checkers.length > 0 ? `durch die Figur auf ${Sq.name(checkers[0])}` : '';
      return `Die ziehende Figur macht eine Linie frei: Es entsteht Schach ${who}. Der Gegner muss das Schach aufheben${loss}. Das ist ein Abzugsangriff.`;
    }
    default: {
      const target = sample.focus === undefined ? move.to : (Sq.of(sample.focus) ?? move.to);
      return `Die Figur auf ${Sq.name(target)} war angegriffen, und nichts deckt sie. Du schlägst sie, ohne etwas zu verlieren.`;
    }
  }
}

const poolOf = (themes: string[]) => themes.flatMap((theme) => (pools()[theme] ?? []).map((sample) => ({ theme, sample })));

function find(topic: string, themes: string[], hint: boolean): ChessMaker {
  return (draw) => {
    const item = draw.pick(poolOf(themes), topic, (i) => i.sample.id);
    const position = item ? samplePosition(item.sample) : null;
    if (!item || !position) return null;
    const goal = goalFor(item.theme);
    const move = ChessGoals.accepted(goal, position)[0];
    if (!move) return null;
    let prompt = item.theme === 'hang' ? 'Schlage so, dass du am meisten gewinnst.' : 'Finde den Zug, der am meisten Material gewinnt.';
    if (hint) prompt += item.theme === 'hang' ? ' Eine Figur hängt.' : ` Tipp: ${motifNames[item.theme] ?? ''}.`;
    return ChessKit.moveExercise({
      id: `${topic}.${item.sample.id}`, prompt, position, goal,
      explanation: explanation(item.theme, item.sample, position, move), withSquares: false,
    });
  };
}

/** Four moves to choose from: the best one and three that are proven worse. */
function choose(topic: string, themes: string[]): ChessMaker {
  return (draw) => {
    const item = draw.pick(poolOf(themes), topic, (i) => i.sample.id);
    const position = item ? samplePosition(item.sample) : null;
    if (!item || !position) return null;
    const best = ChessGoals.accepted(goalFor(item.theme), position);
    const right = best[0];
    const rightText = right ? ChessNotation.san(right, position) : null;
    if (!right || rightText === null) return null;
    // Wrong moves: the best move's own piece first, then checks and captures, then the rest.
    const mover = position.at(right.from)?.kind;
    const isBest = (m: ChessMove) => best.some((b) => b.from === m.from && b.to === m.to && b.promotion === m.promotion);
    const others = draw.shuffled(position.legalMoves().filter((m) => !isBest(m)));
    const sameKind = others.filter((m) => position.at(m.from)?.kind === mover);
    const loud = others.filter((m) => position.givesCheck(m) || position.isCapture(m));
    const wrong: string[] = [];
    for (const m of [...sameKind, ...loud, ...others]) {
      if (wrong.length >= 3) break;
      const text = ChessNotation.san(m, position);
      if (text === null) continue;
      const plain = ChessKit.sanWithoutSign(text);
      if (plain !== ChessKit.sanWithoutSign(rightText) && !wrong.includes(plain)) wrong.push(plain);
    }
    return ChessKit.choice({
      id: `${topic}.${item.sample.id}`, prompt: 'Welcher Zug gewinnt hier am meisten Material?', correct: ChessKit.sanWithoutSign(rightText), wrong,
      explanation: explanation(item.theme, item.sample, position, right), media: ChessKit.board(position), draw,
    });
  };
}

/** "Welche zwei Figuren greift die Gabel an?" */
function forkAfter(draw: ChessDraw): LearnExercise | null {
  const pool = forks.filter((sample) => {
    const position = samplePosition(sample);
    const move = position ? ChessGoals.accepted(bestMove(depth), position)[0] : undefined;
    return !!position && !!move && attackedEnemies(position.applying(move), move.to).length === 2;
  });
  const sample = draw.pickSample(pool, 'u8.fork.after');
  const position = sample ? samplePosition(sample) : null;
  const move = position ? ChessGoals.accepted(bestMove(depth), position)[0] : undefined;
  const san = move && position ? ChessNotation.san(move, position) : null;
  if (!sample || !position || !move || san === null) return null;
  const after = position.applying(move);
  const pairText = (kinds: PieceKind[]) => [...kinds].sort((a, b) => kindRaw(b) - kindRaw(a)).map(kindName).join(' und ');
  const actual = attackedEnemies(after, move.to).map((s) => after.at(s)?.kind).filter((k): k is PieceKind => k !== undefined);
  const right = pairText(actual);
  const present = [...new Set(after.squaresOfColor(opposite(position.sideToMove)).map((s) => after.at(s)?.kind).filter((k): k is PieceKind => k !== undefined))].sort((a, b) => kindRaw(a) - kindRaw(b));
  const wrong: string[] = [];
  for (const group of [present, pieceKinds]) {
    for (const first of draw.shuffled(group)) {
      for (const second of draw.shuffled(group)) {
        if (kindRaw(first) < kindRaw(second)) {
          const text = pairText([first, second]);
          if (text !== right && !wrong.includes(text) && wrong.length < 3) wrong.push(text);
        }
      }
    }
  }
  return ChessKit.choice({
    id: `u8.fork.after.${sample.id}`, prompt: `${colorName(position.sideToMove)} spielt ${ChessKit.sanWithoutSign(san)}. Welche zwei Figuren greift die gezogene Figur dann an?`,
    correct: right, wrong, explanation: explanation('fork', sample, position, move), media: ChessKit.board(position), draw,
  });
}

/** "Welche schwarze Figur ist gefesselt?" */
function pinWhich(draw: ChessDraw): LearnExercise | null {
  const pool = pins.filter((sample) => {
    const position = samplePosition(sample);
    return !!position && ChessTactics.absolutePins(opposite(position.sideToMove), position).length === 1;
  });
  const sample = draw.pickSample(pool, 'u8.pin.which');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const color = opposite(position.sideToMove);
  const pin = ChessTactics.absolutePins(color, position)[0];
  const king = position.kingSquare(color);
  if (!pin || king === null) return null;
  const wrong = draw.shuffled(position.squaresOfColor(color).filter((s) => s !== pin.pinned && s !== king)).map(Sq.name);
  return ChessKit.choice({
    id: `u8.pin.which.${sample.id}`, prompt: `Welche ${adjectiveStem(color)}e Figur ist gefesselt?`, correct: Sq.name(pin.pinned), wrong,
    explanation: `Die Figur auf ${Sq.name(pin.pinned)} steht zwischen der Figur auf ${Sq.name(pin.pinner)} und dem König auf ${Sq.name(king)}. Sie darf ihre Linie nicht verlassen.`,
    media: ChessKit.board(position), draw,
  });
}

/** "Welche schwarze Figur hängt?" */
function hangWhich(draw: ChessDraw): LearnExercise | null {
  const pool = hanging.filter((sample) => {
    const position = samplePosition(sample);
    return !!position && ChessTactics.hangingPieces(opposite(position.sideToMove), position, gainOf).length === 1;
  });
  const sample = draw.pickSample(pool, 'u8.hang.which');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const color = opposite(position.sideToMove);
  const hung = ChessTactics.hangingPieces(color, position, gainOf)[0];
  const king = position.kingSquare(color);
  if (hung === undefined || king === null) return null;
  const wrong = draw.shuffled(position.squaresOfColor(color).filter((s) => s !== hung && s !== king)).map(Sq.name);
  return ChessKit.choice({
    id: `u8.hang.which.${sample.id}`, prompt: `Welche ${adjectiveStem(color)}e Figur hängt?`, correct: Sq.name(hung), wrong,
    explanation: `Die Figur auf ${Sq.name(hung)} ist angegriffen und nicht gedeckt: Du kannst sie ohne Verlust schlagen.`,
    media: ChessKit.board(position), draw,
  });
}

/** "Welches Motiv steckt in diesem Zug?" */
function motif(draw: ChessDraw): LearnExercise | null {
  const pool = Object.entries(pools()).flatMap(([theme, samples]) => samples.map((sample) => ({ theme, sample })))
    .sort((a, b) => (a.sample.id < b.sample.id ? -1 : a.sample.id > b.sample.id ? 1 : 0));
  const item = draw.pick(pool, 'u8.motif', (i) => i.sample.id);
  const position = item ? samplePosition(item.sample) : null;
  const move = item && position ? ChessGoals.accepted(goalFor(item.theme), position)[0] : undefined;
  const san = move && position ? ChessNotation.san(move, position) : null;
  const right = item ? motifNames[item.theme] : undefined;
  if (!item || !position || !move || san === null || right === undefined) return null;
  const wrong = Object.entries(motifNames).filter(([k]) => k !== item.theme && k !== 'hang').map(([, v]) => v).sort();
  return ChessKit.choice({
    id: `u8.motif.${item.sample.id}`, prompt: `${colorName(position.sideToMove)} spielt ${san}. Welches Motiv steckt darin?`, correct: right,
    wrong: item.theme === 'hang' ? wrong : [...wrong.filter((t) => t !== right), 'Hängende Figur'],
    explanation: explanation(item.theme, item.sample, position, move), media: ChessKit.board(position), draw,
  });
}

void focusSquare;
