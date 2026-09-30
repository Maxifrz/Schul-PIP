// Structured errors of the chemistry engine. Every error has a stable code (for tests and for the UI) and a German
// message a student can read.

export const CODES = {
  CHEM_FORMULA_INVALID: 'Die Formel ist ungültig.',
  CHEM_UNKNOWN_ELEMENT: 'Unbekanntes Element.',
  CHEM_UNKNOWN_SUBSTANCE: 'Dieser Stoff ist nicht in der Datenbank.',
  CHEM_INVALID_CHARGE: 'Die Ladung ist ungültig.',
  CHEM_UNIT_MISMATCH: 'Die Einheiten passen nicht zusammen.',
  CHEM_NO_SOLUTION: 'Es gibt keine Lösung.',
  CHEM_MULTIPLE_SOLUTIONS: 'Die Lösung ist nicht eindeutig.',
  CHEM_NEGATIVE_CONCENTRATION: 'Eine Konzentration würde negativ.',
  CHEM_UNBALANCED_REACTION: 'Die Reaktionsgleichung ist nicht ausgeglichen.',
  CHEM_MISSING_CONSTANT: 'Eine benötigte Konstante fehlt.',
  CHEM_OUTSIDE_MODEL: 'Die Aufgabe liegt außerhalb des Gültigkeitsbereichs des Modells.',
  CHEM_DATA_UNAVAILABLE: 'Dazu liegen keine Daten vor.',
  CHEM_SYNTAX: 'Die Eingabe ist nicht lesbar.',
};

export class ChemError extends Error {
  /** `code` is one of CODES; `message` says what exactly is wrong; `details` carries data for the UI */
  constructor(code, message, details) {
    super(message || CODES[code] || code);
    this.name = 'ChemError';
    this.code = code;
    this.details = details || null;
  }
}

export const fail = (code, message, details) => {
  throw new ChemError(code, message, details);
};
