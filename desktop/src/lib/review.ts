// Flashcards on the desktop: the card, its scheduling, and the flow of one review with a typed answer. A port of the logic
// in Lernwerk/Models/ReviewCard.swift and Lernwerk/Views/Review/ReviewView.swift.

import { Verdict, evaluate } from './answerCheck';
import { Grade, SchedulingState, dueDate, next } from './sm2';

export interface Card extends SchedulingState {
  id: string;
  front: string;
  back: string;
  createdAt: number;
  /** Milliseconds since 1970. */
  dueAt: number;
}

export function newCard(front: string, back: string, now = Date.now(), id: string = crypto.randomUUID()): Card {
  return { id, front: front.trim(), back: back.trim(), createdAt: now, dueAt: now, intervalDays: 0, easeFactor: 2.5, repetitions: 0, lapses: 0 };
}

export function applyGrade(card: Card, grade: Grade, now = Date.now()): Card {
  const state = next(card, grade);
  return { ...card, ...state, dueAt: dueDate(state, new Date(now)).getTime() };
}

export const dueCards = (cards: Card[], now = Date.now()): Card[] => cards.filter((c) => c.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);

/**
 * One sitting with the cards: the student types an answer, the app says right or wrong. The first answer to a card decides
 * its schedule (right is "good", wrong is "again"); a retry or an overruled verdict is settled when the student moves on, and
 * only once per card and session. The card stays on screen while its verdict shows, although a graded card has already left
 * the due list.
 */
export class ReviewFlow {
  heldId: string | null = null;
  answer = '';
  verdict: Verdict | null = null;
  overruled = false;
  solutionShown = false;
  reviewedThisSession = 0;
  private graded = new Set<string>();

  constructor(
    private readonly getCards: () => Card[],
    private readonly update: (card: Card) => void,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get current(): Card | null {
    const cards = this.getCards();
    if (this.heldId) {
      const held = cards.find((c) => c.id === this.heldId);
      if (held) return held;
    }
    return dueCards(cards, this.now())[0] ?? null;
  }

  get isCorrect(): boolean {
    return this.verdict === 'correct' || this.overruled;
  }

  check(): void {
    const card = this.current;
    if (!card || this.answer.trim() === '') return;
    this.verdict = evaluate(this.answer, card.back);
    this.heldId = card.id;
    this.overruled = false;
    this.solutionShown = false;
  }

  overrule(): void {
    this.overruled = true;
  }

  showSolution(): void {
    this.solutionShown = true;
  }

  /** Asks the same question again (the "repeat when wrong" switch). */
  retry(): void {
    const card = this.current;
    if (card) this.settle(card);
    this.reset(true);
  }

  next(): void {
    const card = this.current;
    if (card) {
      this.settle(card);
      this.graded.delete(card.id);
    }
    this.reset(false);
  }

  private settle(card: Card): void {
    if (this.graded.has(card.id)) return;
    this.graded.add(card.id);
    this.update(applyGrade(card, this.isCorrect ? 'good' : 'again', this.now()));
    if (this.isCorrect) this.reviewedThisSession += 1;
  }

  private reset(keepCard: boolean): void {
    this.answer = '';
    this.verdict = null;
    this.overruled = false;
    this.solutionShown = false;
    if (!keepCard) this.heldId = null;
  }
}
