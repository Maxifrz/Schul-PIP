import type { LearnExercise } from '../exercise';
import { bestCapture } from './goals';
import { ChessDraw, ChessKit, ChessMaker, ChessSentence } from './kit';
import { ChessNotation } from './notation';
import { ChessPosition } from './position';
import { ChessExchange } from './search';
import { captureChoices, contests, detailMove, focusSquare, materialCounts, samplePosition, trades } from './samples';
import { ChessColor, ChessMove, PieceKind, Sq, adjectiveStem, colorName, colors, kindName, kindPlural, kindRaw, kindValue, moveUci, piece } from './types';

const valued: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];

const valueSentences: ChessSentence[] = [
  { key: 'queen', words: ['Die', 'Dame', 'ist', 'neun', 'Bauern', 'wert.'], extra: ['fünf', 'Springer'] },
  { key: 'rook', words: ['Ein', 'Turm', 'ist', 'fünf', 'Bauern', 'wert.'], extra: ['drei', 'Läufer'] },
  { key: 'minor', words: ['Läufer', 'und', 'Springer', 'sind', 'gleich', 'viel', 'wert.'], extra: ['Turm', 'mehr'] },
];

const valueExplanation = 'Bauer 1, Springer 3, Läufer 3, Turm 5, Dame 9. Der König hat keinen Wert, weil er nie verloren gehen darf.';

/** Unit 6, "Werte und Tausch": piece values, counting material, judging captures and exchanges. */
export const ChessUnit6 = {
  review: ['u6.valueChoice', 'u6.valueSum', 'u6.captureBest', 'u6.tradeJudge', 'u6.materialCount'],

  get makers(): Record<string, ChessMaker> {
    return {
      'u6.valueChoice': valueChoice,
      'u6.valueNumber': valueNumber,
      'u6.valuePairs': valuePairs,
      'u6.valueSum': valueSum,
      'u6.sentence.values': ChessKit.sentenceMaker('u6.sentence.values', valueSentences),
      'u6.materialCount': materialCount,
      'u6.materialWho': materialWho,
      'u6.captureBest': captureBest,
      'u6.tradeJudge': tradeJudge,
      'u6.tradeKinds': tradeKinds,
      'u6.contestCount': contestCount,
      'u6.contestJudge': contestJudge,
      'u6.contestBest': contestBest,
    };
  },
};

function valueChoice(draw: ChessDraw): LearnExercise | null {
  const kind = draw.pick(valued, 'u6.value', kindName);
  if (!kind) return null;
  const others = valued.map(kindValue).filter((v) => v !== kindValue(kind));
  return ChessKit.choice({
    id: `u6.valueChoice.${kindName(kind)}`, prompt: `Wie viele Bauern ist ${ChessKit.nominative(kind)} wert?`, correct: String(kindValue(kind)),
    wrong: ChessKit.numberWrongs({ correct: kindValue(kind), likely: draw.shuffled(others), random: draw.random, minimum: 1 }),
    explanation: valueExplanation, draw,
  });
}

function valueNumber(draw: ChessDraw): LearnExercise | null {
  const kind = draw.pick(valued, 'u6.value', kindName);
  if (!kind) return null;
  return ChessKit.number({ id: `u6.valueNumber.${kindName(kind)}`, prompt: `Wie viele Bauern ist ${ChessKit.nominative(kind)} wert?`, answer: kindValue(kind), explanation: valueExplanation });
}

function valuePairs(draw: ChessDraw): LearnExercise | null {
  const minor: PieceKind = draw.coin() ? 'knight' : 'bishop';
  const kinds: PieceKind[] = ['pawn', minor, 'rook', 'queen'];
  return ChessKit.pairs({
    id: 'u6.valuePairs', prompt: 'Wie viele Bauern ist die Figur wert?', draw,
    from: kinds.map((k) => ({ key: `u6.value.${kindName(k)}`, front: kindName(k), back: String(kindValue(k)) })),
  });
}

// Adding values

interface Group { parts: Array<{ kind: PieceKind; count: number }> }

const groupSum = (g: Group) => g.parts.reduce((s, p) => s + kindValue(p.kind) * p.count, 0);
const groupText = (g: Group) => g.parts.map((p) => (p.count === 1 ? ChessKit.indefinite(p.kind) : `zwei ${kindPlural(p.kind)}`)).join(' und ');
const groupKey = (g: Group) => g.parts.map((p) => `${kindRaw(p.kind)}x${p.count}`).join('-');
function groupCalculation(g: Group): string {
  const values = g.parts.flatMap((p) => Array.from({ length: p.count }, () => String(kindValue(p.kind))));
  return values.length === 1 ? values[0] : `${values.join(' + ')} = ${groupSum(g)}`;
}

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function valueSum(draw: ChessDraw): LearnExercise | null {
  for (let i = 0; i < 30; i++) {
    const single = draw.randomElement(valued);
    const first = draw.randomElement(valued);
    const second = draw.randomElement(valued);
    if (single === null || first === null || second === null) return null;
    const one: Group = { parts: [{ kind: single, count: 1 }] };
    const two: Group = first === second ? { parts: [{ kind: first, count: 2 }] } : { parts: [{ kind: first, count: 1 }, { kind: second, count: 1 }] };
    if (groupSum(one) === groupSum(two) || groupKey(one) === groupKey(two)) continue;
    const [bigger, smaller] = groupSum(one) > groupSum(two) ? [one, two] : [two, one];
    return ChessKit.choice({
      id: `u6.valueSum.${groupKey(one)}.${groupKey(two)}`, prompt: 'Was ist mehr wert?', correct: capitalised(groupText(bigger)), wrong: [capitalised(groupText(smaller))],
      explanation: `${capitalised(groupText(bigger))}: ${groupCalculation(bigger)}. ${capitalised(groupText(smaller))}: ${groupCalculation(smaller)}.`, draw,
    });
  }
  return null;
}

// Counting material

/** "1 Turm (5) + 3 Bauern (3) = 8". */
export function materialSum(color: ChessColor, position: ChessPosition): string {
  const parts: string[] = [];
  for (const kind of ['queen', 'rook', 'bishop', 'knight', 'pawn'] as PieceKind[]) {
    const count = position.count(piece(color, kind));
    if (count === 0) continue;
    parts.push(`${count} ${count === 1 ? kindName(kind) : kindPlural(kind)} (${count * kindValue(kind)})`);
  }
  return parts.length === 0 ? '0' : `${parts.join(' + ')} = ${position.material(color)}`;
}

function materialCount(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(materialCounts, 'u6.materialCount');
  const position = sample ? samplePosition(sample) : null;
  const color = draw.randomElement(colors);
  if (!sample || !position || color === null) return null;
  return ChessKit.number({
    id: `u6.materialCount.${sample.id}.${adjectiveStem(color)}`, prompt: `Wie viel Material hat ${colorName(color)}? Zähle ohne den König.`,
    answer: position.material(color), explanation: `${materialSum(color, position)}.`, media: ChessKit.board(position),
  });
}

function materialWho(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(materialCounts, 'u6.materialWho');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  const white = position.material('white');
  const black = position.material('black');
  const right = white > black ? 'Weiß' : black > white ? 'Schwarz' : 'Beide gleich viel';
  return ChessKit.choice({
    id: `u6.materialWho.${sample.id}`, prompt: 'Wer hat mehr Material? Zähle ohne die Könige.', correct: right,
    wrong: ['Weiß', 'Schwarz', 'Beide gleich viel'].filter((t) => t !== right),
    explanation: `Weiß: ${white}, Schwarz: ${black}.`, media: ChessKit.board(position), draw,
  });
}

// Captures and exchanges

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function gainList(position: ChessPosition): string {
  return ChessExchange.captures(position)
    .map((entry) => {
      const san = ChessNotation.san(entry.move, position);
      return san === null ? null : `${san} ${signed(entry.gain)}`;
    })
    .filter((t): t is string => t !== null)
    .join(', ');
}

function captureBest(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(captureChoices, 'u6.captureBest');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position || ChessExchange.bestCaptures(position).moves.length === 0) return null;
  return ChessKit.moveExercise({
    id: `u6.captureBest.${sample.id}`, prompt: 'Schlage so, dass du am meisten gewinnst.', position, goal: bestCapture,
    explanation: `Gewinn pro Schlag, nachdem beide Seiten auf dem Feld alles getauscht haben, was sich lohnt: ${gainList(position)}. Prüfe immer, ob die Figur gedeckt ist.`,
  });
}

const judgement = (gain: number): string => (gain > 0 ? 'Das gewinnt Material' : gain < 0 ? 'Das verliert Material' : 'Das ist ausgeglichen');

function judgeExercise(id: string, position: ChessPosition, move: ChessMove, draw: ChessDraw): LearnExercise | null {
  const mover = position.at(move.from);
  if (!mover || !position.isCapture(move)) return null;
  const gain = ChessExchange.gain(move, position);
  const color = position.sideToMove;
  let explanation: string;
  if (gain > 0) explanation = `Nach allen Schlägen auf ${Sq.name(move.to)} hat ${colorName(color)} ${gain} ${gain === 1 ? 'Punkt' : 'Punkte'} mehr.`;
  else if (gain < 0) explanation = `Nach allen Schlägen auf ${Sq.name(move.to)} hat ${colorName(color)} ${-gain} ${gain === -1 ? 'Punkt' : 'Punkte'} weniger.`;
  else explanation = `Nach allen Schlägen auf ${Sq.name(move.to)} ist das Material gleich geblieben.`;
  const options = [judgement(1), judgement(0), judgement(-1)];
  return ChessKit.choice({
    id, prompt: `${colorName(color)} schlägt mit ${ChessKit.dative(mover.kind)} auf ${Sq.name(move.to)}. Wie ist das für ${colorName(color)}?`,
    correct: judgement(gain), wrong: options.filter((t) => t !== judgement(gain)), explanation,
    media: ChessKit.board(position, [Sq.name(move.from), Sq.name(move.to)]), draw,
  });
}

function tradeJudge(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(trades, 'u6.tradeJudge');
  const position = sample ? samplePosition(sample) : null;
  const move = sample ? detailMove(sample) : null;
  if (!sample || !position || !move) return null;
  return judgeExercise(`u6.tradeJudge.${sample.id}`, position, move, draw);
}

function tradeKinds(draw: ChessDraw): LearnExercise | null {
  const attacker = draw.randomElement(valued);
  const victim = draw.randomElement(valued);
  if (attacker === null || victim === null) return null;
  const difference = kindValue(victim) - kindValue(attacker);
  const options = [judgement(1), judgement(0), judgement(-1)];
  return ChessKit.choice({
    id: `u6.tradeKinds.${kindName(attacker)}.${kindName(victim)}`,
    prompt: `Du schlägst mit ${ChessKit.dative(attacker)} ${ChessKit.indefiniteAccusative(victim)}. Dein Gegner schlägt sofort zurück. Wie ist das für dich?`,
    correct: judgement(difference), wrong: options.filter((t) => t !== judgement(difference)),
    explanation: `Du bekommst ${kindValue(victim)} und gibst ${kindValue(attacker)} her: ${signed(difference)}.`, draw,
  });
}

// Several attackers

const openContests = () => contests.filter((sample) => {
  const position = samplePosition(sample);
  const square = focusSquare(sample);
  return !!position && square !== null && !ChessKit.hasHiddenAttackers(square, position);
});

function contestCount(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(openContests(), 'u6.contestCount');
  const position = sample ? samplePosition(sample) : null;
  const square = sample ? focusSquare(sample) : null;
  const target = position && square !== null ? position.at(square) : null;
  const color = draw.randomElement(colors);
  if (!sample || !position || square === null || !target || color === null) return null;
  const attackers = position.attackers(square, color);
  const attacking = color !== target.color;
  const prompt = attacking
    ? `Wie viele ${adjectiveStem(color)}e Figuren greifen ${ChessKit.accusative(target.kind)} auf ${Sq.name(square)} an?`
    : `Wie viele ${adjectiveStem(color)}e Figuren decken ${ChessKit.accusative(target.kind)} auf ${Sq.name(square)}?`;
  return ChessKit.number({
    id: `u6.contestCount.${sample.id}.${adjectiveStem(color)}`, prompt, answer: attackers.length,
    explanation: attackers.length === 0 ? `Keine ${adjectiveStem(color)}e Figur kann auf ${Sq.name(square)} schlagen.` : `Auf ${Sq.name(square)} können schlagen: ${ChessKit.list(attackers.map(Sq.name))}.`,
    media: ChessKit.board(position, [Sq.name(square)]),
  });
}

function contestJudge(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(contests, 'u6.contestJudge');
  const position = sample ? samplePosition(sample) : null;
  const square = sample ? focusSquare(sample) : null;
  if (!sample || !position || square === null) return null;
  const move = draw.randomElement(position.legalMoves().filter((m) => m.to === square && position.isCapture(m)));
  if (move === null) return null;
  return judgeExercise(`u6.contestJudge.${sample.id}.${moveUci(move)}`, position, move, draw);
}

function contestBest(draw: ChessDraw): LearnExercise | null {
  const sample = draw.pickSample(contests, 'u6.contestBest');
  const position = sample ? samplePosition(sample) : null;
  if (!sample || !position) return null;
  return ChessKit.moveExercise({
    id: `u6.contestBest.${sample.id}`, prompt: 'Schlage so, dass du am meisten gewinnst.', position, goal: bestCapture,
    explanation: `Zähle die Schläge der Reihe nach durch. Gewinn pro Schlag: ${gainList(position)}.`,
  });
}
