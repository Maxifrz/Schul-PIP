// Unit 6, "Werte und Tausch": piece values, counting material, judging captures and exchanges.
// Port of ChessUnit6.swift.

import type { LearnExercise } from '../../exercise';
import { randomElement, shuffled } from '../../random';
import { accusative, dative, hasHiddenAttackers, indefinite, indefiniteAccusative, list, nominative } from '../kit';
import { san } from '../notation';
import type { ChessPosition } from '../position';
import { ChessExchange } from '../search';
import {
  BISHOP, CHESS_COLORS, KNIGHT, PAWN, QUEEN, ROOK, colorAdjectiveStem, colorGermanName, kindGermanName, kindGermanPlural, kindValue, moveUci,
  piece, squareName, type ChessColor, type ChessMove, type ChessPieceKind,
} from '../types';
import {
  boardMedia, choice, moveExercise, number, numberWrongs, pairs, sentence, sentenceMaker, type ChessDraw, type ChessMaker,
} from './courseKit';
import { captureChoices, contests, materialCounts, sampleDetailMove, sampleFocus, samplePosition, trades, type ChessSample } from './samples';

const valued: ChessPieceKind[] = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN];

export const unit6Review = ['u6.valueChoice', 'u6.valueSum', 'u6.captureBest', 'u6.tradeJudge', 'u6.materialCount'];

const valueSentences = [
  sentence('queen', ['Die', 'Dame', 'ist', 'neun', 'Bauern', 'wert.'], ['fünf', 'Springer']),
  sentence('rook', ['Ein', 'Turm', 'ist', 'fünf', 'Bauern', 'wert.'], ['drei', 'Läufer']),
  sentence('minor', ['Läufer', 'und', 'Springer', 'sind', 'gleich', 'viel', 'wert.'], ['Turm', 'mehr']),
];

const valueExplanation = 'Bauer 1, Springer 3, Läufer 3, Turm 5, Dame 9. Der König hat keinen Wert, weil er nie verloren gehen darf.';

function valueChoice(draw: ChessDraw): LearnExercise | null {
  const kind = draw.pick(valued, 'u6.value', kindGermanName);
  if (kind === null) return null;
  const others = valued.map(kindValue).filter((v) => v !== kindValue(kind));
  const likely = shuffled(others, draw.random);
  return choice(
    {
      id: `u6.valueChoice.${kindGermanName(kind)}`, prompt: `Wie viele Bauern ist ${nominative(kind)} wert?`, correct: String(kindValue(kind)),
      wrong: numberWrongs(kindValue(kind), likely, draw.random, 1), explanation: valueExplanation,
    },
    draw,
  );
}

function valueNumber(draw: ChessDraw): LearnExercise | null {
  const kind = draw.pick(valued, 'u6.value', kindGermanName);
  if (kind === null) return null;
  return number({
    id: `u6.valueNumber.${kindGermanName(kind)}`, prompt: `Wie viele Bauern ist ${nominative(kind)} wert?`, answer: kindValue(kind),
    explanation: valueExplanation,
  });
}

function valuePairs(draw: ChessDraw): LearnExercise | null {
  const minor: ChessPieceKind = draw.coin() ? KNIGHT : BISHOP;
  const kinds: ChessPieceKind[] = [PAWN, minor, ROOK, QUEEN];
  return pairs(
    {
      id: 'u6.valuePairs', prompt: 'Wie viele Bauern ist die Figur wert?',
      from: kinds.map((k) => ({ key: `u6.value.${kindGermanName(k)}`, front: kindGermanName(k), back: String(kindValue(k)) })),
    },
    draw,
  );
}

// Adding values

interface Group {
  parts: { kind: ChessPieceKind; count: number }[];
}

const groupSum = (g: Group): number => g.parts.reduce((total, p) => total + kindValue(p.kind) * p.count, 0);
const groupText = (g: Group): string =>
  g.parts.map((p) => (p.count === 1 ? indefinite(p.kind) : `zwei ${kindGermanPlural(p.kind)}`)).join(' und ');
function groupCalculation(g: Group): string {
  const values = g.parts.flatMap((p) => Array.from({ length: p.count }, () => String(kindValue(p.kind))));
  return values.length === 1 ? values[0] : values.join(' + ') + ` = ${groupSum(g)}`;
}
const groupKey = (g: Group): string => g.parts.map((p) => `${p.kind}x${p.count}`).join('-');

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function valueSum(draw: ChessDraw): LearnExercise | null {
  for (let i = 0; i < 30; i++) {
    const single = randomElement(valued, draw.random);
    const first = randomElement(valued, draw.random);
    const second = randomElement(valued, draw.random);
    if (single === undefined || first === undefined || second === undefined) return null;
    const one: Group = { parts: [{ kind: single, count: 1 }] };
    const two: Group = first === second ? { parts: [{ kind: first, count: 2 }] } : { parts: [{ kind: first, count: 1 }, { kind: second, count: 1 }] };
    if (groupSum(one) === groupSum(two) || groupKey(one) === groupKey(two)) continue;
    const [bigger, smaller] = groupSum(one) > groupSum(two) ? [one, two] : [two, one];
    return choice(
      {
        id: `u6.valueSum.${groupKey(one)}.${groupKey(two)}`, prompt: 'Was ist mehr wert?', correct: capitalised(groupText(bigger)),
        wrong: [capitalised(groupText(smaller))],
        explanation: `${capitalised(groupText(bigger))}: ${groupCalculation(bigger)}. ${capitalised(groupText(smaller))}: ${groupCalculation(smaller)}.`,
      },
      draw,
    );
  }
  return null;
}

// Counting material

/** "1 Turm (5) + 3 Bauern (3) = 8". */
export function materialSum(color: ChessColor, position: ChessPosition): string {
  const parts: string[] = [];
  for (const kind of [QUEEN, ROOK, BISHOP, KNIGHT, PAWN] as ChessPieceKind[]) {
    const count = position.count(piece(color, kind));
    if (count <= 0) continue;
    parts.push(`${count} ${count === 1 ? kindGermanName(kind) : kindGermanPlural(kind)} (${count * kindValue(kind)})`);
  }
  return parts.length === 0 ? '0' : parts.join(' + ') + ` = ${position.material(color)}`;
}

function materialCount(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(materialCounts, 'u6.materialCount');
  if (!sample) return null;
  const position = samplePosition(sample);
  const color = randomElement(CHESS_COLORS, draw.random);
  if (!position || color === undefined) return null;
  return number({
    id: `u6.materialCount.${sample.id}.${colorAdjectiveStem(color)}`, prompt: `Wie viel Material hat ${colorGermanName(color)}? Zähle ohne den König.`,
    answer: position.material(color), explanation: materialSum(color, position) + '.', media: boardMedia(position),
  });
}

function materialWho(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(materialCounts, 'u6.materialWho');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const white = position.material('white');
  const black = position.material('black');
  const right = white > black ? 'Weiß' : black > white ? 'Schwarz' : 'Beide gleich viel';
  return choice(
    {
      id: `u6.materialWho.${sample.id}`, prompt: 'Wer hat mehr Material? Zähle ohne die Könige.', correct: right,
      wrong: ['Weiß', 'Schwarz', 'Beide gleich viel'].filter((t) => t !== right), explanation: `Weiß: ${white}, Schwarz: ${black}.`,
      media: boardMedia(position),
    },
    draw,
  );
}

// Captures and exchanges

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function captureList(position: ChessPosition): string {
  const entries: string[] = [];
  for (const entry of ChessExchange.captures(position)) {
    const text = san(entry.move, position);
    if (text !== null) entries.push(`${text} ${signed(entry.gain)}`);
  }
  return entries.join(', ');
}

function captureBest(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(captureChoices, 'u6.captureBest');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  const best = ChessExchange.bestCaptures(position).moves[0];
  if (best === undefined) return null;
  return moveExercise({
    id: `u6.captureBest.${sample.id}`, prompt: 'Schlage so, dass du am meisten gewinnst.', position, goal: { type: 'bestCapture' },
    explanation: `Gewinn pro Schlag, nachdem beide Seiten auf dem Feld alles getauscht haben, was sich lohnt: ${captureList(position)}. Prüfe immer, ob die Figur gedeckt ist.`,
  });
}

const judgement = (gain: number): string =>
  gain > 0 ? 'Das gewinnt Material' : gain < 0 ? 'Das verliert Material' : 'Das ist ausgeglichen';

function judgeExercise(id: string, position: ChessPosition, m: ChessMove, draw: ChessDraw): LearnExercise | null {
  const p = position.pieceAt(m.from);
  if (!p || !position.isCapture(m)) return null;
  const gain = ChessExchange.gain(m, position);
  const color = position.sideToMove;
  const to = squareName(m.to);
  let explanation: string;
  if (gain > 0) {
    explanation = `Nach allen Schlägen auf ${to} hat ${colorGermanName(color)} ${gain} ${gain === 1 ? 'Punkt' : 'Punkte'} mehr.`;
  } else if (gain < 0) {
    explanation = `Nach allen Schlägen auf ${to} hat ${colorGermanName(color)} ${-gain} ${gain === -1 ? 'Punkt' : 'Punkte'} weniger.`;
  } else {
    explanation = `Nach allen Schlägen auf ${to} ist das Material gleich geblieben.`;
  }
  const options = [judgement(1), judgement(0), judgement(-1)];
  return choice(
    {
      id, prompt: `${colorGermanName(color)} schlägt mit ${dative(p.kind)} auf ${to}. Wie ist das für ${colorGermanName(color)}?`,
      correct: judgement(gain), wrong: options.filter((o) => o !== judgement(gain)), explanation,
      media: boardMedia(position, [squareName(m.from), to]),
    },
    draw,
  );
}

function tradeJudge(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(trades, 'u6.tradeJudge');
  if (!sample) return null;
  const position = samplePosition(sample);
  const m = sampleDetailMove(sample);
  if (!position || !m) return null;
  return judgeExercise(`u6.tradeJudge.${sample.id}`, position, m, draw);
}

function tradeKinds(draw: ChessDraw): LearnExercise | null {
  const attacker = randomElement(valued, draw.random);
  const victim = randomElement(valued, draw.random);
  if (attacker === undefined || victim === undefined) return null;
  const difference = kindValue(victim) - kindValue(attacker);
  const options = [judgement(1), judgement(0), judgement(-1)];
  return choice(
    {
      id: `u6.tradeKinds.${kindGermanName(attacker)}.${kindGermanName(victim)}`,
      prompt: `Du schlägst mit ${dative(attacker)} ${indefiniteAccusative(victim)}. Dein Gegner schlägt sofort zurück. Wie ist das für dich?`,
      correct: judgement(difference), wrong: options.filter((o) => o !== judgement(difference)),
      explanation: `Du bekommst ${kindValue(victim)} und gibst ${kindValue(attacker)} her: ${signed(difference)}.`,
    },
    draw,
  );
}

// Several attackers

function openContests(): ChessSample[] {
  return contests.filter((sample) => {
    const position = samplePosition(sample);
    const sq = sampleFocus(sample);
    if (!position || sq === null) return false;
    return !hasHiddenAttackers(sq, position);
  });
}

function contestCount(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(openContests(), 'u6.contestCount');
  if (!sample) return null;
  const position = samplePosition(sample);
  const sq = sampleFocus(sample);
  if (!position || sq === null) return null;
  const p = position.pieceAt(sq);
  const color = randomElement(CHESS_COLORS, draw.random);
  if (!p || color === undefined) return null;
  const attackers = position.attackers(sq, color);
  const count = attackers.length;
  const attacking = color !== p.color;
  const name = squareName(sq);
  const prompt = attacking
    ? `Wie viele ${colorAdjectiveStem(color)}e Figuren greifen ${accusative(p.kind)} auf ${name} an?`
    : `Wie viele ${colorAdjectiveStem(color)}e Figuren decken ${accusative(p.kind)} auf ${name}?`;
  const squares = attackers.map(squareName);
  return number({
    id: `u6.contestCount.${sample.id}.${colorAdjectiveStem(color)}`, prompt, answer: count,
    explanation: count === 0 ? `Keine ${colorAdjectiveStem(color)}e Figur kann auf ${name} schlagen.` : `Auf ${name} können schlagen: ${list(squares)}.`,
    media: boardMedia(position, [name]),
  });
}

function contestJudge(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(contests, 'u6.contestJudge');
  if (!sample) return null;
  const position = samplePosition(sample);
  const sq = sampleFocus(sample);
  if (!position || sq === null) return null;
  const captures = position.legalMoves().filter((m) => m.to === sq && position.isCapture(m));
  const m = randomElement(captures, draw.random);
  if (m === undefined) return null;
  return judgeExercise(`u6.contestJudge.${sample.id}.${moveUci(m)}`, position, m, draw);
}

function contestBest(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(contests, 'u6.contestBest');
  if (!sample) return null;
  const position = samplePosition(sample);
  if (!position) return null;
  return moveExercise({
    id: `u6.contestBest.${sample.id}`, prompt: 'Schlage so, dass du am meisten gewinnst.', position, goal: { type: 'bestCapture' },
    explanation: `Zähle die Schläge der Reihe nach durch. Gewinn pro Schlag: ${captureList(position)}.`,
  });
}

export const unit6Makers: Record<string, ChessMaker> = {
  'u6.valueChoice': valueChoice,
  'u6.valueNumber': valueNumber,
  'u6.valuePairs': valuePairs,
  'u6.valueSum': valueSum,
  'u6.sentence.values': sentenceMaker('u6.sentence.values', valueSentences),
  'u6.materialCount': materialCount,
  'u6.materialWho': materialWho,
  'u6.captureBest': captureBest,
  'u6.tradeJudge': tradeJudge,
  'u6.tradeKinds': tradeKinds,
  'u6.contestCount': contestCount,
  'u6.contestJudge': contestJudge,
  'u6.contestBest': contestBest,
};
