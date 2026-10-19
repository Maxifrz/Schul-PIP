import * as AnswerCheck from '../answerCheck';
import type { CardSnapshot } from './cards';
import { LearnExercise, difficulty, exercise, exerciseKinds, folded } from './exercise';
import { LearnRandom } from './random';

export const maxExercises = 12;
export const minExercises = 8;
export const distractorCount = 3;
export const pairCount = 4;
export const maxPairWords = 6;
export const extraWords = 2;
/** From this many cards on, a lesson always has at least `minExercises`. */
export const fullLessonCards = 4;
export const pairsPrompt = 'Finde die Paare';

/** Answers with these (or with digits) are formulas, and formulas are typed, not put together from tiles. */
const formulaSymbols = new Set([...'=+−*/^²³√π·×()<>[]{}|∫′⇒→←↔≤≥≈≠∑∞%_\\']);
const hasFormulaSymbol = (text: string) => [...text].some((ch) => formulaSymbols.has(ch));
const hasNumber = (text: string) => /\p{N}/u.test(text);
const words = (text: string) => text.split(/\s+/u).filter((w) => w !== '');
const trimmedWord = (word: string) => word.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');

function unique(cards: CardSnapshot[]): CardSnapshot[] {
  const seen = new Set<string>();
  return cards.filter((c) => !seen.has(c.key) && !!seen.add(c.key));
}

/** A wrong answer has to be wrong for the answer check in both directions. */
export function isValidDistractor(candidate: string, answer: string): boolean {
  const f = folded(candidate);
  if (f === '') return false;
  if (AnswerCheck.normalize(candidate) === AnswerCheck.normalize(answer) || f === folded(answer)) return false;
  if (AnswerCheck.evaluate(candidate, answer) === 'correct') return false;
  if (AnswerCheck.evaluate(answer, candidate) === 'correct') return false;
  return true;
}

/** Up to `count` clearly wrong answers, in the order given and none twice. */
export function pickDistractors(answer: string, candidates: Iterable<string>, count = distractorCount, excluding: string[] = []): string[] {
  const seen = new Set(excluding.map(folded));
  const picked: string[] = [];
  if (count <= 0) return picked;
  for (const candidate of candidates) {
    const text = candidate.trim();
    if (!isValidDistractor(text, answer)) continue;
    const key = folded(text);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(text);
    if (picked.length === count) break;
  }
  return picked;
}

/** The same card, or one whose question the answer check would take for this one's in either direction. */
export function asksTheSame(card: CardSnapshot, other: CardSnapshot): boolean {
  if (card.key === other.key || folded(card.front) === folded(other.front)) return true;
  return AnswerCheck.evaluate(card.front, other.front) === 'correct' || AnswerCheck.evaluate(other.front, card.front) === 'correct';
}

/** The cards for which the deck has fewer than three wrong answers; only these are worth asking a model about. */
export function cardsNeedingDistractors(deck: CardSnapshot[]): CardSnapshot[] {
  const cards = unique(deck);
  return cards.filter((card) => {
    const candidates = cards.filter((c) => !asksTheSame(card, c)).map((c) => c.back);
    return pickDistractors(card.back, candidates).length < distractorCount;
  });
}

/** The words of a back of three to eight words without digits or formula symbols, else null. */
export function wordBankWords(text: string): string[] | null {
  if (hasNumber(text) || hasFormulaSymbol(text)) return null;
  const raw = words(text);
  // A minus between spaces is arithmetic.
  if (raw.includes('-')) return null;
  const list = raw.map(trimmedWord).filter((w) => folded(w) !== '');
  return list.length >= 3 && list.length <= 8 ? list : null;
}

/** Words of at least three letters without digits or formula symbols, as extra tiles. */
export function plainWords(text: string): string[] {
  return words(text).map(trimmedWord).filter((w) => !hasNumber(w) && !hasFormulaSymbol(w) && [...folded(w)].length >= 3);
}

export const wordCount = (text: string) => words(text).length;

/**
 * Builds a lesson's exercises from its cards, easy to hard, and every card ends with typing its answer. Wrong answers
 * come from the student's other cards, or from wrong answers a model wrote for the card and that passed the same
 * check; nothing is made up here. A card without three of them gets no multiple choice.
 */
export class ExerciseBuilder {
  constructor(
    private readonly lesson: CardSnapshot[],
    /** Every card of the student, the lesson's own included or not. */
    private readonly deck: CardSnapshot[],
    /** Checked wrong answers from the tutor model, by card key; used only when the deck has too few of its own. */
    private readonly cachedDistractors: Record<string, string[]> = {},
  ) {}

  build(seed: bigint): LearnExercise[] {
    return this.buildWith(new LearnRandom(seed));
  }

  buildWith(random: LearnRandom): LearnExercise[] {
    const cards = unique(this.lesson);
    if (cards.length === 0) return [];
    const choice = new Map<string, LearnExercise | null>();
    const bank = new Map<string, LearnExercise | null>();
    for (const card of cards) {
      choice.set(card.key, this.multipleChoice(card, random));
      bank.set(card.key, this.wordBank(card, random));
    }
    const pairRounds = this.matchPairs(cards, random);

    // Every card is typed once at the end; the easier exercises share what is left of the twelve.
    const budget = Math.max(0, maxExercises - cards.length);
    const extras: LearnExercise[] = [];
    const used = new Set<string>();
    const covered = new Set<string>();
    // One round of pairs covers four cards with one exercise.
    if (budget > 0 && pairRounds.length > 0) {
      const first = pairRounds[0];
      extras.push(first);
      used.add(first.id);
      first.cardKeys.forEach((k) => covered.add(k));
    }
    // Every other card gets one easy exercise: multiple choice, else a word bank.
    for (const card of cards) {
      if (covered.has(card.key) || extras.length >= budget) continue;
      const item = choice.get(card.key) ?? bank.get(card.key);
      if (!item) continue;
      extras.push(item);
      used.add(item.id);
      covered.add(card.key);
    }
    // The rest of the budget: word banks, more pairs, then multiple choice for the cards the pairs covered.
    const more = [
      ...cards.map((c) => bank.get(c.key)).filter((e): e is LearnExercise => !!e),
      ...pairRounds.slice(1),
      ...cards.map((c) => choice.get(c.key)).filter((e): e is LearnExercise => !!e),
    ];
    for (const item of more) {
      if (extras.length >= budget || used.has(item.id)) continue;
      extras.push(item);
      used.add(item.id);
    }
    // Too short a lesson repeats exercises once, shuffled anew: its easy ones and, from four cards on, typing a card
    // a second time. Below four cards it stays short rather than repeat the same few questions over and over.
    const again = [...extras];
    if (cards.length >= fullLessonCards) again.push(...cards.map((c) => this.typeAnswer(c)));
    for (const item of again) {
      if (cards.length + extras.length < minExercises) extras.push(this.repeated(item, random));
    }

    const all = [...extras, ...cards.map((c) => this.typeAnswer(c))];
    const ordered: LearnExercise[] = [];
    for (const kind of [...exerciseKinds].sort((a, b) => difficulty(a) - difficulty(b))) {
      const group = all.filter((e) => e.kind === kind);
      random.shuffleInPlace(group);
      ordered.push(...group);
    }
    return ordered;
  }

  // Multiple choice

  private multipleChoice(card: CardSnapshot, random: LearnRandom): LearnExercise | null {
    const candidates = this.distractorCandidates(card, random).filter((c) => !asksTheSame(card, c)).map((c) => c.back);
    let picked = pickDistractors(card.back, candidates);
    const cached = this.cachedDistractors[card.key];
    if (picked.length < distractorCount && cached) {
      picked = [...picked, ...pickDistractors(card.back, cached, distractorCount - picked.length, picked)];
    }
    if (picked.length !== distractorCount) return null;
    return exercise({
      id: `multipleChoice:${card.key}`, kind: 'multipleChoice', cardKeys: [card.key], prompt: card.front,
      correctAnswers: [card.back], options: random.shuffled([card.back, ...picked]), solution: card.back,
    });
  }

  /** The other cards of the unit first, then of the other units. */
  private distractorCandidates(card: CardSnapshot, random: LearnRandom): CardSnapshot[] {
    const pool = unique([...this.lesson, ...this.deck]).filter((c) => c.key !== card.key);
    const sameUnit = pool.filter((c) => c.materialID === card.materialID);
    const otherUnits = pool.filter((c) => c.materialID !== card.materialID);
    random.shuffleInPlace(sameUnit);
    random.shuffleInPlace(otherUnits);
    return [...sameUnit, ...otherUnits];
  }

  // Word bank

  private wordBank(card: CardSnapshot, random: LearnRandom): LearnExercise | null {
    const tiles = wordBankWords(card.back);
    if (!tiles) return null;
    const pool = unique([...this.lesson, ...this.deck]);
    const sameUnit = pool.filter((c) => c.key !== card.key && c.materialID === card.materialID);
    const otherUnits = pool.filter((c) => c.materialID !== card.materialID);
    random.shuffleInPlace(sameUnit);
    random.shuffleInPlace(otherUnits);
    const seen = new Set(tiles.map(folded));
    const extras: string[] = [];
    // One word from each of up to two other cards.
    for (const source of [...sameUnit, ...otherUnits]) {
      if (extras.length >= extraWords) break;
      const candidates = plainWords(source.back);
      random.shuffleInPlace(candidates);
      const word = candidates.find((w) => !seen.has(folded(w)));
      if (word !== undefined) {
        seen.add(folded(word));
        extras.push(word);
      }
    }
    let options = random.shuffled([...tiles, ...extras]);
    // Tiles that already lie in the right order give the answer away.
    let attempts = 0;
    while (sameOrder(options.slice(0, tiles.length), tiles) && new Set(options).size > 1 && attempts < 3) {
      options = random.shuffled(options);
      attempts++;
    }
    return exercise({
      id: `wordBank:${card.key}`, kind: 'wordBank', cardKeys: [card.key], prompt: card.front,
      correctAnswers: tiles, options, solution: card.back,
    });
  }

  // Pairs

  /** Groups of four cards with short backs; within a group no two fronts or backs could be taken for each other. */
  private matchPairs(cards: CardSnapshot[], random: LearnRandom): LearnExercise[] {
    let rest = cards.filter((c) => wordCount(c.back) <= maxPairWords && folded(c.back) !== '' && folded(c.front) !== '');
    random.shuffleInPlace(rest);
    const rounds: LearnExercise[] = [];
    while (rest.length >= pairCount) {
      const group: CardSnapshot[] = [];
      const skipped: CardSnapshot[] = [];
      for (const card of rest) {
        const fits = group.length < pairCount && group.every((other) => !asksTheSame(card, other) && isValidDistractor(card.back, other.back));
        if (fits) group.push(card);
        else skipped.push(card);
      }
      if (group.length !== pairCount) break;
      const pairs = random.shuffled(group.map((c) => ({ key: c.key, front: c.front, back: c.back })));
      rounds.push(exercise({
        id: `matchPairs:${group.map((c) => c.key).sort().join('+')}`, kind: 'matchPairs', cardKeys: group.map((c) => c.key),
        prompt: pairsPrompt, correctAnswers: pairs.map((p) => p.back), options: random.shuffled(pairs.map((p) => p.back)), pairs,
        solution: pairs.map((p) => `${p.front} – ${p.back}`).join('\n'),
      }));
      rest = skipped;
    }
    return rounds;
  }

  // Typing

  private typeAnswer(card: CardSnapshot): LearnExercise {
    return exercise({ id: `typeAnswer:${card.key}`, kind: 'typeAnswer', cardKeys: [card.key], prompt: card.front, correctAnswers: [card.back], solution: card.back });
  }

  /** The same exercise again with its options and pairs shuffled anew. */
  private repeated(item: LearnExercise, random: LearnRandom): LearnExercise {
    const pairs = random.shuffled(item.pairs);
    return {
      ...item, id: `${item.id}#2`, correctAnswers: item.kind === 'matchPairs' ? pairs.map((p) => p.back) : item.correctAnswers,
      options: random.shuffled(item.options), pairs,
    };
  }
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
