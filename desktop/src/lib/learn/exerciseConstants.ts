// The constants of Swift's `ExerciseBuilder` that the exercise factory and the audit use. The card-based
// ExerciseBuilder itself (lessons made from flashcards) is not part of the desktop port.

export const ExerciseBuilder = {
  maxExercises: 12,
  minExercises: 8,
  distractorCount: 3,
  pairCount: 4,
  maxPairWords: 6,
  /** `3...8` */
  wordBankRange: { lower: 3, upper: 8 },
  extraWords: 2,
  /** Answers with these (or with digits) are formulas, and formulas are typed, not put together from tiles. */
  formulaSymbols: '=+−*/^²³√π·×()<>[]{}|∫′⇒→←↔≤≥≈≠∑∞%_\\',
  pairsPrompt: 'Finde die Paare',
  /** From this many cards on, a lesson always has at least `minExercises`. */
  fullLessonCards: 4,
} as const;
