/** One flashcard as the Lernpfad sees it: plain values, so the path, the exercises and the tests need no store. */
export interface CardSnapshot {
  /** Stays the same as long as the card's text, material and creation time do. */
  key: string;
  front: string;
  back: string;
  materialID: string | null;
  createdAt: number;
  dueDate: number;
}

/** FNV-1a with 64 bits: the same text gives the same id on every launch. */
export function stableHash(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x00000100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

/** A card whose text changes gets a new key, so its lesson counts as new and its cached wrong answers are asked for again. */
export function cardKey(front: string, back: string, materialID: string | null, createdAt: number): string {
  return `c${stableHash([String(Math.round(createdAt)), materialID ?? '-', front, back].join('\u001F'))}`;
}

export function snapshot(front: string, back: string, materialID: string | null, createdAt: number, dueDate: number): CardSnapshot {
  return { key: cardKey(front, back, materialID, createdAt), front, back, materialID, createdAt, dueDate };
}

export type LessonState = 'locked' | 'open' | 'done';

export interface LearnLesson {
  id: string;
  /** Position in its unit, from 0. */
  index: number;
  cards: CardSnapshot[];
  state: LessonState;
}

/** The cards of one material (or the ones without a material) as a row of lessons. */
export interface LearnUnit {
  id: string;
  materialID: string | null;
  lessons: LearnLesson[];
}

/** The Lernpfad of the student's own cards: grouped into units by material and cut into short lessons that open one after the other. */
export const LearnPath = {
  lessonSize: 6,
  /** A last lesson with fewer cards than this joins the one before it. */
  smallestLastLesson: 4,
  /** With fewer cards in total the path explains where cards come from instead. */
  minimumCards: 4,
  otherUnitID: 'sonstiges',
  otherUnitTitle: 'Sonstiges',

  units(cards: CardSnapshot[], completed: Set<string>): LearnUnit[] {
    const seen = new Set<string>();
    const unique = cards.filter((c) => !seen.has(c.key) && !!seen.add(c.key));
    const groups = new Map<string | null, CardSnapshot[]>();
    for (const card of unique) {
      const list = groups.get(card.materialID) ?? [];
      list.push(card);
      groups.set(card.materialID, list);
    }
    const sorted = [...groups.entries()]
      .map(([materialID, list]) => ({ materialID, cards: [...list].sort(cardOrder) }))
      .sort((a, b) => {
        const first = a.cards[0];
        const second = b.cards[0];
        if (first.createdAt !== second.createdAt) return first.createdAt - second.createdAt;
        return LearnPath.unitID(a.materialID) < LearnPath.unitID(b.materialID) ? -1 : 1;
      });
    return sorted.map((group) => {
      const lessons: LearnLesson[] = [];
      let previousDone = true;
      LearnPath.chunk(group.cards).forEach((chunk, index) => {
        const id = LearnPath.lessonID(chunk.map((c) => c.key));
        const state: LessonState = completed.has(id) ? 'done' : previousDone ? 'open' : 'locked';
        lessons.push({ id, index, cards: chunk, state });
        previousDone = state === 'done';
      });
      return { id: LearnPath.unitID(group.materialID), materialID: group.materialID, lessons };
    });
  },

  /** Up to six cards in a row; a last lesson of one to three cards is added to the one before. */
  chunk(cards: CardSnapshot[]): CardSnapshot[][] {
    const chunks: CardSnapshot[][] = [];
    for (let i = 0; i < cards.length; i += LearnPath.lessonSize) chunks.push(cards.slice(i, i + LearnPath.lessonSize));
    if (chunks.length > 1 && chunks[chunks.length - 1].length < LearnPath.smallestLastLesson) {
      const last = chunks.pop()!;
      chunks[chunks.length - 1].push(...last);
    }
    return chunks;
  },

  /** Derived from the cards, so a lesson whose cards change is a new lesson. */
  lessonID(cardKeys: string[]): string {
    return `L${stableHash(cardKeys.join(','))}`;
  },

  unitID(materialID: string | null): string {
    return materialID ?? LearnPath.otherUnitID;
  },

  lesson(id: string, units: LearnUnit[]): LearnLesson | undefined {
    for (const unit of units) {
      const found = unit.lessons.find((l) => l.id === id);
      if (found) return found;
    }
    return undefined;
  },

  /** The first lesson the student can start, for the path to scroll to. */
  nextOpenLesson(units: LearnUnit[]): LearnLesson | undefined {
    return units.flatMap((u) => u.lessons).find((l) => l.state === 'open');
  },

  dueKeys(cards: CardSnapshot[], now: number): Set<string> {
    return new Set(cards.filter((c) => c.dueDate <= now).map((c) => c.key));
  },
};

function cardOrder(a: CardSnapshot, b: CardSnapshot): number {
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}
