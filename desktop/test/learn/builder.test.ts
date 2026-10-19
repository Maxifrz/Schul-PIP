import { describe, expect, it } from 'vitest';
import { ExerciseBuilder, asksTheSame, cardsNeedingDistractors, extraWords, isValidDistractor, pickDistractors, wordBankWords, wordCount } from '../../src/lib/learn/builder';
import { CardSnapshot } from '../../src/lib/learn/cards';
import { LearnExercise, difficulty, exercise, isMatch, missedKeys } from '../../src/lib/learn/exercise';
import { card } from './helpers';

const capitals = (): CardSnapshot[] => [
  card('Hauptstadt von Deutschland?', 'Berlin', 0),
  card('Hauptstadt von Frankreich?', 'Paris', 1),
  card('Hauptstadt von Italien?', 'Rom', 2),
  card('Hauptstadt von Spanien?', 'Madrid', 3),
  card('Hauptstadt von Polen?', 'Warschau', 4),
  card('Hauptstadt von Österreich?', 'Wien', 5),
];

const biology = (): CardSnapshot[] => [
  card('Was macht die Photosynthese?', 'Sie wandelt Licht in chemische Energie um', 10),
  card('Wo findet die Photosynthese statt?', 'In den Chloroplasten der Pflanzenzelle', 11),
  card('Was ist das Kraftwerk der Zelle?', 'Das Mitochondrium', 12),
  card('Was steuert die Zelle?', 'Der Zellkern mit der Erbinformation', 13),
  card('Ableitung von x²?', '2x', 14),
  card('Wie lautet die Kettenregel?', 'f′(x) = h′(g(x)) · g′(x)', 15),
];

const build = (lesson: CardSnapshot[], deck?: CardSnapshot[], seed = 1n, cached: Record<string, string[]> = {}): LearnExercise[] =>
  new ExerciseBuilder(lesson, deck ?? lesson, cached).build(seed);

const seeds = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => BigInt(from + i));
const sorted = (a: number[]) => [...a].sort((x, y) => x - y);

describe('ExerciseBuilder', () => {
  it('a lesson has eight to twelve exercises from easy to hard and every card ends typed', () => {
    for (const seed of seeds(1, 20)) {
      const built = build(capitals(), [...capitals(), ...biology()], seed);
      expect(built.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      expect(built.length).toBeLessThanOrEqual(12);
      const d = built.map((e) => difficulty(e.kind));
      expect(d).toEqual(sorted(d));
      expect(new Set(built.map((e) => e.id)).size).toBe(built.length);
      for (const c of capitals()) {
        const mine = built.filter((e) => e.cardKeys.includes(c.key));
        expect(mine[mine.length - 1].kind).toBe('typeAnswer');
        expect(mine.filter((e) => e.kind === 'typeAnswer')).toHaveLength(1);
        expect(mine.length).toBeGreaterThan(1);
      }
    }
  });

  it('the same seed builds the same lesson', () => {
    const deck = [...capitals(), ...biology()];
    expect(build(biology(), deck, 42n)).toEqual(build(biology(), deck, 42n));
    expect(build(capitals(), deck, 7n)).toEqual(build(capitals(), deck, 7n));
    const variants = seeds(1, 10).map((s) => build(capitals(), deck, s));
    expect(new Set(variants.map((v) => JSON.stringify([v.map((e) => e.id), v.flatMap((e) => e.options)]))).size).toBeGreaterThan(1);
  });

  it('without three wrong answers a card is only typed', () => {
    const small = capitals().slice(0, 3);
    const built = build(small);
    expect(built.some((e) => e.kind === 'multipleChoice')).toBe(false);
    expect(new Set(built.filter((e) => e.kind === 'typeAnswer').flatMap((e) => e.cardKeys))).toEqual(new Set(small.map((c) => c.key)));
  });

  it('a wrong answer the check would accept is dropped', () => {
    const berlin = card('Hauptstadt von Deutschland?', 'Berlin', 0);
    const lookalikes = [card('Größte Stadt?', 'berlin', 1), card('Regierungssitz?', 'Berlin.', 2), card('Bundeshauptstadt?', 'Berlin / Bundeshauptstadt', 3), card('Stadt an der Spree?', 'Berlinn', 4)];
    const thin = build([berlin], [berlin, ...lookalikes, card('Frankreich?', 'Paris', 5)]);
    expect(thin.some((e) => e.kind === 'multipleChoice' && e.cardKeys.length === 1 && e.cardKeys[0] === berlin.key)).toBe(false);

    const deck = [berlin, ...lookalikes, ...capitals().slice(1)];
    for (const seed of seeds(1, 10)) {
      const choice = build([berlin], deck, seed).find((e) => e.kind === 'multipleChoice');
      expect(choice).toBeDefined();
      expect(choice!.options).toHaveLength(4);
      expect(choice!.options.filter((o) => o === 'Berlin')).toHaveLength(1);
      expect(choice!.options.every((o) => ['Berlin', 'Paris', 'Rom', 'Madrid', 'Warschau', 'Wien'].includes(o))).toBe(true);
    }
    expect(isValidDistractor('berlin', 'Berlin')).toBe(false);
    expect(isValidDistractor('Berlinn', 'Berlin')).toBe(false);
    expect(isValidDistractor('Die Kettenregel', 'Kettenregel')).toBe(false);
    expect(isValidDistractor('Kettenregel', 'Kettenregel oder Produktregel')).toBe(false);
    expect(isValidDistractor('   ', 'Berlin')).toBe(false);
    expect(isValidDistractor('Produktregel', 'Kettenregel')).toBe(true);
    expect(isValidDistractor('3', '4')).toBe(true);
    expect(pickDistractors('Berlin', ['Paris', 'paris', 'Berlin', 'Rom', 'Wien', 'Madrid'])).toEqual(['Paris', 'Rom', 'Wien']);
  });

  it('wrong answers come from the unit first', () => {
    const other = '00000000-0000-0000-0000-0000000000D2';
    const foreign = [card('Farbe des Himmels?', 'Blau', 20, other), card('Farbe von Gras?', 'Grün', 21, other)];
    for (const seed of seeds(1, 10)) {
      const choice = build([capitals()[0]], [...capitals(), ...foreign], seed).find((e) => e.kind === 'multipleChoice');
      expect(choice).toBeDefined();
      expect(choice!.options).not.toContain('Blau');
      expect(choice!.options).not.toContain('Grün');
    }
    const pair = [card('A?', 'Eins', 30, other), card('B?', 'Zwei', 31, other)];
    const borrowed = build([pair[0]], [...pair, ...capitals()]).find((e) => e.kind === 'multipleChoice');
    expect(borrowed?.options).toContain('Zwei');
  });

  it('pairs need four short backs', () => {
    const short = capitals().slice(0, 4);
    const pairs = build(short, capitals()).filter((e) => e.kind === 'matchPairs');
    expect(pairs).toHaveLength(1);
    expect(new Set(pairs[0].cardKeys)).toEqual(new Set(short.map((c) => c.key)));
    expect(pairs[0].pairs).toHaveLength(4);
    expect(new Set(pairs[0].options)).toEqual(new Set(short.map((c) => c.back)));
    expect(pairs[0].correctAnswers).toEqual(pairs[0].pairs.map((p) => p.back));
    expect(isMatch(pairs[0], short[1].key, 'Paris')).toBe(true);
    expect(isMatch(pairs[0], short[1].key, 'Rom')).toBe(false);

    const long = [...short];
    long[3] = card('Hauptstadt von Spanien?', 'Madrid ist die Hauptstadt und größte Stadt Spaniens', 3);
    expect(build(long, capitals()).some((e) => e.kind === 'matchPairs')).toBe(false);
    expect(wordCount('Madrid ist die Hauptstadt und größte Stadt Spaniens')).toBe(8);
  });

  it('a word bank only for plain sentences', () => {
    expect(wordBankWords('Sie wandelt Licht in chemische Energie um.')).toEqual(['Sie', 'wandelt', 'Licht', 'in', 'chemische', 'Energie', 'um']);
    expect(wordBankWords('Das Mitochondrium – die Zellatmung')).toEqual(['Das', 'Mitochondrium', 'die', 'Zellatmung']);
    expect(wordBankWords('f′(x) = h′(g(x)) · g′(x)')).toBeNull();
    expect(wordBankWords('x / Wurzel aus x')).toBeNull();
    expect(wordBankWords('a - b ist negativ')).toBeNull();
    expect(wordBankWords('Es sind 3 Stück')).toBeNull();
    expect(wordBankWords('Das Mitochondrium')).toBeNull();
    expect(wordBankWords('eins zwei drei vier fünf sechs sieben acht neun')).toBeNull();

    const built = build(biology(), [...biology(), ...capitals()]);
    const banks = built.filter((e) => e.kind === 'wordBank');
    const formulaKeys = new Set([biology()[4].key, biology()[5].key]);
    expect(banks.every((b) => !b.cardKeys.some((k) => formulaKeys.has(k)))).toBe(true);
    for (const bank of banks) {
      expect(bank.options.length).toBeLessThanOrEqual(bank.correctAnswers.length + extraWords);
      expect(bank.options.length).toBeGreaterThan(bank.correctAnswers.length);
      const tiles = [...bank.options];
      for (const word of bank.correctAnswers) {
        const index = tiles.indexOf(word);
        expect(index, `missing tile ${word}`).toBeGreaterThanOrEqual(0);
        tiles.splice(index, 1);
      }
    }
  });

  it('answers are checked per kind', () => {
    const built = build(capitals(), [...capitals(), ...biology()]);
    const choice = built.find((e) => e.kind === 'multipleChoice')!;
    const typed = built.find((e) => e.kind === 'typeAnswer' && e.cardKeys[0] === capitals()[0].key)!;
    expect(missedKeys(choice, { type: 'option', value: choice.correctAnswers[0] })).toEqual(new Set());
    const wrong = choice.options.find((o) => o !== choice.correctAnswers[0]) ?? '';
    expect(missedKeys(choice, { type: 'option', value: wrong })).toEqual(new Set(choice.cardKeys));
    expect(missedKeys(typed, { type: 'typed', value: 'berlin' })).toEqual(new Set());
    expect(missedKeys(typed, { type: 'typed', value: 'Paris' })).toEqual(new Set([capitals()[0].key]));
    expect(missedKeys(typed, { type: 'option', value: 'Berlin' })).toEqual(new Set([capitals()[0].key]));

    const bank = exercise({ id: 'b', kind: 'wordBank', cardKeys: ['k'], prompt: '?', correctAnswers: ['Äußere', 'mal', 'innere'], solution: '' });
    expect(missedKeys(bank, { type: 'words', value: ['aeussere', 'Mal', 'innere'] })).toEqual(new Set());
    expect(missedKeys(bank, { type: 'words', value: ['innere', 'mal', 'Äußere'] })).toEqual(new Set(['k']));
    expect(missedKeys(bank, { type: 'words', value: ['Äußere', 'mal'] })).toEqual(new Set(['k']));
  });

  it('cached wrong answers fill a thin deck', () => {
    const small = capitals().slice(0, 2);
    const berlin = small[0];
    expect(cardsNeedingDistractors(small).map((c) => c.key)).toEqual(small.map((c) => c.key));
    expect(cardsNeedingDistractors(capitals())).toHaveLength(0);
    const choice = build([berlin], small, 1n, { [berlin.key]: ['München', 'berlin', 'Hamburg', 'Köln'] }).find((e) => e.kind === 'multipleChoice');
    expect(choice).toBeDefined();
    expect(new Set(choice!.options)).toEqual(new Set(['Berlin', 'Paris', 'München', 'Hamburg']));
    expect(build([berlin], small, 1n, { [berlin.key]: ['Berlin', 'Bonn'] }).some((e) => e.kind === 'multipleChoice')).toBe(false);
  });

  it('a card with the same question is no wrong answer', () => {
    const rule = card('Wie lautet die Kettenregel?', 'Äußere Ableitung mal innere Ableitung', 0);
    const formula = card('Wie lautet die Kettenregel?', 'f′(x) = u′(v(x)) · v′(x)', 1);
    const longer = card('Wie lautet die Kettenregel für verkettete Funktionen?', 'Nachdifferenzieren', 2);
    const others = [card('Produktregel?', 'u′v + uv′', 3), card('Quotientenregel?', '(u′v − uv′) / v²', 4), card('Ableitung von sin?', 'cos', 5)];
    expect(asksTheSame(rule, formula)).toBe(true);
    expect(asksTheSame(rule, longer)).toBe(true);
    expect(asksTheSame(rule, others[0])).toBe(false);
    expect(asksTheSame(capitals()[0], capitals()[1])).toBe(false);
    const deck = [rule, formula, longer, ...others];
    for (const seed of seeds(1, 20)) {
      const choice = build([rule], deck, seed).find((e) => e.kind === 'multipleChoice');
      expect(choice).toBeDefined();
      expect(choice!.options).not.toContain(formula.back);
      expect(choice!.options).not.toContain(longer.back);
    }
    expect(cardsNeedingDistractors([rule, formula, longer, others[0], others[1]]).map((c) => c.key)).toContain(rule.key);
  });

  it('from four cards a lesson always reaches eight', () => {
    const formulas = [
      card('Nenne eine binomische Formel.', '(a + b)² = a² + 2ab + b²', 0),
      card('Nenne eine binomische Formel.', '(a − b)² = a² − 2ab + b²', 1),
      card('Nenne eine binomische Formel.', '(a + b) · (a − b) = a² − b²', 2),
      card('Nenne eine binomische Formel.', '(a + b)³ = a³ + 3a²b + 3ab² + b³', 3),
    ];
    const only = build(formulas, formulas);
    expect(only).toHaveLength(8);
    expect(only.every((e) => e.kind === 'typeAnswer')).toBe(true);
    expect(new Set(only.map((e) => e.id)).size).toBe(8);
    for (const c of formulas) expect(only.filter((e) => e.cardKeys.length === 1 && e.cardKeys[0] === c.key)).toHaveLength(2);
    for (let count = 4; count <= 9; count++) {
      const lesson = Array.from({ length: count }, (_, i) => card(`Frage ${i}?`, `Antwort mit ${i} Punkten und Komma, lang genug für keine Paare hier`, i));
      for (const seed of seeds(1, 5)) {
        const built = build(lesson, lesson, seed);
        expect(built.length, `${count} cards`).toBeGreaterThanOrEqual(8);
        expect(built.length).toBeLessThanOrEqual(12);
        const d = built.map((e) => difficulty(e.kind));
        expect(d).toEqual(sorted(d));
        expect(new Set(built.map((e) => e.id)).size).toBe(built.length);
      }
    }
  });

  it('a short lesson repeats its easy exercises once', () => {
    const two = capitals().slice(0, 2);
    const built = build(two, capitals());
    expect(built.filter((e) => e.kind === 'typeAnswer')).toHaveLength(2);
    expect(built.filter((e) => e.kind === 'multipleChoice')).toHaveLength(4);
    expect(new Set(built.map((e) => e.id)).size).toBe(built.length);
    expect(build([], capitals())).toHaveLength(0);
  });
});
