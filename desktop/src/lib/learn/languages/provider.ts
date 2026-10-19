import { ExerciseBuilder } from '../builder';
import { checkpointRange } from '../courseAudit';
import { Course, CourseNode, CourseProvider, CourseSection, CourseUnit, SkillFacet, SkillTag, standardUnit } from '../course';
import { LearnAnswer, LearnExercise, folded } from '../exercise';
import { arrange, bank, choice, pairs, seedFor, typed } from '../exercises';
import type { ExerciseMedia } from '../media';
import { LearnRandom } from '../random';
import { LanguageCourseData, LanguageSentence, LanguageTexts, LanguageUnitData, LanguageWord, dataProblems, fillText, formGroup, itemCount, textsFor } from './data';
import { parseCourse } from './dsl';
import { pickDistractors, extraWords, maxExercises, pairCount } from '../builder';

type ItemKind = 'word' | 'sentence' | 'form' | 'fill' | 'fact';

interface Ref {
  unit: number;
  kind: ItemKind;
  index: number;
}

const refKey = (r: Ref) => `${r.unit}:${r.kind}:${r.index}`;

/** What a node draws on and how it asks. `rounds` are the stages to try per item, in order of preference, for the first and the second exercise of each item; only `fresh` items get a second one. */
interface Plan {
  focus: Ref[];
  fresh: Set<string>;
  rounds: number[][];
  total: number;
}

/** Lessons teach about six new items each, so a unit of 18 items has three lessons and one of 30 has five. */
export const itemsPerLesson = 6;
export const lessonCountOf = (unit: LanguageUnitData): number => Math.min(5, Math.max(3, Math.floor((itemCount(unit) + itemsPerLesson - 1) / itemsPerLesson)));
export const tileCount = (sentence: string): number => sentence.split(/\s+/u).filter((w) => w !== '').length;

const trimMarks = (word: string) => word.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
const tilesOf = (sentence: string): string[] => sentence.split(/\s+/u).filter((w) => w !== '').map(trimMarks).filter((w) => w !== '');
const isWordOrSentence = (r: Ref) => r.kind === 'word' || r.kind === 'sentence';

/** Turns a language or school-subject course into lessons. Every item is met in three stages: first recognised (a choice), then put together (tiles, a choice in the other direction, hearing), then produced (typed). */
export class LanguageCourseProvider implements CourseProvider {
  readonly course: Course;
  private readonly texts: LanguageTexts;

  constructor(readonly data: LanguageCourseData) {
    this.texts = textsFor(data);
    const sections: CourseSection[] = [];
    const titles: string[] = [];
    const grouped: CourseUnit[][] = [];
    data.units.forEach((unit, index) => {
      const built = standardUnit(data.id, index + 1, unit.title, unit.summary, unit.tip, lessonCountOf(unit));
      const title = unit.sectionTitle === '' ? 'Einheiten' : unit.sectionTitle;
      if (titles[titles.length - 1] === title) grouped[grouped.length - 1].push(built);
      else {
        titles.push(title);
        grouped.push([built]);
      }
    });
    grouped.forEach((units, index) => sections.push({ id: `${data.id}.s${index + 1}`, title: titles[index], units }));
    this.course = { id: data.id, title: data.title, subtitle: data.subtitle, kind: data.kind, color: data.color, symbol: data.symbol, sections };
  }

  /** Parses the text of a course. `errors` lists every problem in the text and in the content; a shipped course has none. */
  static make(source: string): { provider: LanguageCourseProvider; errors: string[] } {
    const parsed = parseCourse(source);
    return { provider: new LanguageCourseProvider(parsed.data), errors: [...parsed.errors, ...dataProblems(parsed.data)] };
  }

  // Items

  private counts(unit: number): Array<[ItemKind, number]> {
    const u = this.data.units[unit];
    return [['word', u.words.length], ['sentence', u.sentences.length], ['form', u.forms.length], ['fill', u.fills.length], ['fact', u.facts.length]];
  }

  /** The items of a unit in teaching order, or one lesson's share of it. The order mixes the kinds by how far along each is. Every lesson gets an even share of all of them. */
  private refs(unit: number, part?: number, parts = 1): Ref[] {
    const all: Array<{ position: number; order: number; ref: Ref }> = [];
    this.counts(unit).forEach(([kind, count], order) => {
      for (let index = 0; index < count; index++) all.push({ position: (index + 0.5) / count, order, ref: { unit, kind, index } });
    });
    all.sort((a, b) => (a.position !== b.position ? a.position - b.position : a.order - b.order));
    const ordered = all.map((a) => a.ref);
    if (part === undefined) return ordered;
    return ordered.slice(Math.floor((ordered.length * part) / parts), Math.floor((ordered.length * (part + 1)) / parts));
  }

  private earlierRefs(before: number, limit: number, rng: LearnRandom): Ref[] {
    if (before <= 0 || limit <= 0) return [];
    const pool: Ref[] = [];
    for (let earlier = 0; earlier < before; earlier++) pool.push(...this.refs(earlier).filter(isWordOrSentence));
    rng.shuffleInPlace(pool);
    return pool.slice(0, limit);
  }

  private plan(node: CourseNode, rng: LearnRandom): Plan {
    const unit = node.unitNumber - 1;
    if (node.kind === 'lesson') {
      const lessons = lessonCountOf(this.data.units[unit]);
      const part = Math.min(lessons - 1, node.index - 1);
      const fresh = this.refs(unit, part, lessons);
      const review = part > 0 ? this.refs(unit, part - 1, lessons).filter(isWordOrSentence).slice(-2) : this.earlierRefs(unit, 2, rng);
      return { focus: [...fresh, ...review], fresh: new Set(fresh.map(refKey)), rounds: [[0, 1, 2], [1, 2, 0]], total: maxExercises };
    }
    if (node.kind === 'practice') {
      const focus = [...this.refs(unit), ...this.earlierRefs(unit, 4, rng)];
      return { focus, fresh: new Set(focus.map(refKey)), rounds: [[1, 2, 0], [2, 1, 0]], total: maxExercises };
    }
    const focus = [...this.refs(unit), ...this.earlierRefs(unit, 2, rng)];
    return { focus, fresh: new Set(focus.map(refKey)), rounds: [[2, 1, 0], [1, 2, 0]], total: checkpointRange[1] - 1 };
  }

  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    if (node.kind === 'chest' || node.unitNumber - 1 < 0 || node.unitNumber - 1 >= this.data.units.length) return [];
    const rng = new LearnRandom(seedFor(node, seed));
    const plan = this.plan(node, rng);

    const chosen: LearnExercise[] = [];
    const ids = new Set<string>();
    const take = (item: LearnExercise | null | undefined): boolean => {
      if (!item || ids.has(item.id)) return false;
      ids.add(item.id);
      chosen.push(item);
      return true;
    };

    // Pairs of words first: one in a lesson, two in the longer rounds. A lesson with fewer than four words of its own matches some of the unit's other words too.
    const unitWords = this.refs(node.unitNumber - 1).filter((r) => r.kind === 'word');
    let words = plan.focus.filter((r) => r.kind === 'word');
    const have = new Set(words.map(refKey));
    words = [...words, ...unitWords.filter((r) => !have.has(refKey(r)))];
    take(this.pairsExercise(words, node, 'p1', rng));
    if (node.kind !== 'lesson' && words.length >= 8) take(this.pairsExercise([...words].reverse(), node, 'p2', rng));

    // Every item gets its first exercise before any item gets a second; items that came up less often go first.
    const usage = plan.focus.map(() => 0);
    plan.rounds.forEach((stages, round) => {
      let order = plan.focus.map((_, i) => i);
      rng.shuffleInPlace(order);
      order = order
        .map((element, offset) => ({ element, offset }))
        .sort((a, b) => (usage[a.element] !== usage[b.element] ? usage[a.element] - usage[b.element] : a.offset - b.offset))
        .map((o) => o.element);
      order.forEach((index, position) => {
        if (chosen.length >= plan.total) return;
        const ref = plan.focus[index];
        if (round > 0 && !plan.fresh.has(refKey(ref))) return;
        // Alternate the order of the stages from item to item, so a round is not all of one kind.
        let preference = stages;
        if (round > 0 && position % 2 === 1) preference = [stages[1], stages[0], stages[2]];
        if (round === 0 && ref.kind === 'sentence' && position % 2 === 1 && stages[0] === 0) preference = [1, 0, 2];
        if (round === 0 && stages[0] === 2 && position % 3 === 0) preference = [1, 2, 0];
        for (const stage of preference) {
          const candidates = this.exercisesOf(ref, stage, node, rng).filter((e) => !ids.has(e.id));
          if (candidates.length === 0) continue;
          rng.shuffleInPlace(candidates);
          if (take(candidates[0])) {
            usage[index] += 1;
            break;
          }
        }
      });
    });
    return arrange(chosen, plan.total);
  }

  private pairsExercise(words: Ref[], node: CourseNode, tag: string, rng: LearnRandom): LearnExercise | null {
    const seen = new Set<string>();
    const items: Array<{ key: string; front: string; back: string }> = [];
    for (const ref of words) {
      const word = this.data.units[ref.unit].words[ref.index];
      const meaning = word.meanings[0];
      if (meaning === undefined || seen.has(folded(word.target))) continue;
      seen.add(folded(word.target));
      if (seen.has(folded(meaning))) continue;
      seen.add(folded(meaning));
      items.push({ key: this.key(ref), front: word.target, back: meaning });
      if (items.length === pairCount) break;
    }
    return pairs(rng, { id: `${node.id}#${tag}`, prompt: this.texts.pairs, items });
  }

  // Exercises of one item

  private speech(text: string): ExerciseMedia | undefined {
    return this.data.speech ? { kind: 'speech', text, language: this.data.speech } : undefined;
  }

  private key(ref: Ref): string {
    const letter = { word: 'w', sentence: 's', form: 'f', fill: 'g', fact: 'q' }[ref.kind];
    return `${letter}${ref.unit}-${ref.index}`;
  }

  /** The exercises an item has at a stage: 0 recognise (a choice), 1 assemble or hear (the other direction, tiles, listening), 2 produce (typed). Not every item has every stage; the node's plan falls back to another. */
  private exercisesOf(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): LearnExercise[] {
    let made: Array<LearnExercise | null>;
    switch (ref.kind) {
      case 'word': made = this.wordExercises(ref, stage, node, rng); break;
      case 'sentence': made = this.sentenceExercises(ref, stage, node, rng); break;
      case 'form': made = this.formExercises(ref, stage, node, rng); break;
      case 'fill': made = this.fillExercises(ref, stage, node, rng); break;
      case 'fact': made = this.factExercises(ref, stage, node, rng); break;
    }
    return made.filter((e): e is LearnExercise => e !== null);
  }

  private wordExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    const word = this.data.units[ref.unit].words[ref.index];
    const meaning = word.meanings[0];
    if (meaning === undefined) return [];
    const id = `${node.id}#${this.key(ref)}`;
    const key = this.key(ref);
    const askTarget = fillText(this.texts.askTarget, meaning);
    const askMeaning = fillText(this.texts.meaning, word.target);
    // What a wrong answer is told: the author's sentence, or the word with its grammar note.
    const why = word.why !== '' ? word.why : word.note === '' ? '' : `${word.target} · ${word.note}`;
    switch (stage) {
      case 0:
        return [choice(rng, { id: `${id}a`, key, prompt: askMeaning, correct: meaning, wrong: this.meaningDistractors(word, ref.unit, rng), explanation: why, media: this.speech(word.target) })];
      case 1: {
        if (!this.data.produces) return [];
        const wrong = this.targetDistractors(word, ref.unit, rng);
        const list = [choice(rng, { id: `${id}b`, key, prompt: askTarget, correct: word.target, wrong, explanation: why })];
        if (this.data.speech) list.push(choice(rng, { id: `${id}c`, key, prompt: this.texts.listen, correct: word.target, wrong, explanation: why, media: this.speech(word.target) }));
        return list;
      }
      default: {
        const list: Array<LearnExercise | null> = [];
        if (this.data.produces) list.push(typed({ id: `${id}d`, key, prompt: askTarget, answer: word.target, mode: 'exact', explanation: why }));
        // A subject's terms have a definition for a meaning, which nobody types.
        if (this.data.kind !== 'school') {
          list.push(typed({ id: `${id}e`, key, prompt: askMeaning, answer: meaning, alternatives: word.meanings.slice(1), explanation: why, media: this.speech(word.target) }));
        }
        return list;
      }
    }
  }

  private sentenceExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    const sentence = this.data.units[ref.unit].sentences[ref.index];
    const meaning = sentence.meanings[0];
    if (meaning === undefined) return [];
    const id = `${node.id}#${this.key(ref)}`;
    const key = this.key(ref);
    const others = this.otherSentences(sentence, ref.unit, rng);
    const targetTiles = tilesOf(sentence.target);
    const knownTiles = tilesOf(meaning);
    switch (stage) {
      case 0:
        return [choice(rng, {
          id: `${id}a`, key, prompt: fillText(this.texts.translateFrom, sentence.target), correct: meaning,
          wrong: pickDistractors(meaning, others.map((o) => o.meanings[0])), explanation: sentence.why, media: this.speech(sentence.target),
        })];
      case 1:
        return [
          this.data.produces
            ? bank(rng, { id: `${id}b`, key, prompt: fillText(this.texts.translateInto, meaning), words: targetTiles, extra: this.extraTiles(others.map((o) => o.target), targetTiles, rng), solution: sentence.target, explanation: sentence.why })
            : null,
          bank(rng, { id: `${id}c`, key, prompt: fillText(this.texts.translateFrom, sentence.target), words: knownTiles, extra: this.extraTiles(others.map((o) => o.meanings[0]), knownTiles, rng), solution: meaning, explanation: sentence.why, media: this.speech(sentence.target) }),
        ];
      default: {
        const list: Array<LearnExercise | null> = [];
        if (this.data.produces && targetTiles.length <= 8) {
          list.push(typed({ id: `${id}d`, key, prompt: fillText(this.texts.translateInto, meaning), answer: sentence.target, mode: 'exact', explanation: sentence.why }));
          if (this.data.speech) list.push(typed({ id: `${id}e`, key, prompt: this.texts.listenType, answer: sentence.target, mode: 'exact', explanation: sentence.why, media: this.speech(sentence.target) }));
        }
        if (!this.data.produces) {
          // Translated into the known language, where the meaning counts, not the exact words.
          list.push(typed({ id: `${id}f`, key, prompt: fillText(this.texts.translateFrom, sentence.target), answer: meaning, alternatives: sentence.meanings.slice(1), explanation: sentence.why, media: this.speech(sentence.target) }));
        }
        return list;
      }
    }
  }

  private formExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    const form = this.data.units[ref.unit].forms[ref.index];
    const answer = form.answers[0];
    if (answer === undefined) return [];
    const id = `${node.id}#${this.key(ref)}`;
    const prompt = fillText(this.texts.form, form.prompt);
    if (stage === 1) return [];
    if (stage === 2) return [typed({ id: `${id}d`, key: this.key(ref), prompt, answer, alternatives: form.answers.slice(1), mode: 'exact', explanation: form.why })];
    const siblings: string[] = [];
    const others: string[] = [];
    for (const other of this.data.units[ref.unit].forms) {
      if (other === form || other.answers[0] === undefined) continue;
      (formGroup(other) === formGroup(form) ? siblings : others).push(other.answers[0]);
    }
    rng.shuffleInPlace(siblings);
    rng.shuffleInPlace(others);
    return [choice(rng, { id: `${id}a`, key: this.key(ref), prompt, correct: answer, wrong: pickDistractors(answer, [...siblings, ...others]), explanation: form.why })];
  }

  private fillExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    const fill = this.data.units[ref.unit].fills[ref.index];
    const answer = fill.options[0];
    if (answer === undefined) return [];
    const id = `${node.id}#${this.key(ref)}`;
    const prompt = fillText(this.texts.fill, fill.sentence);
    const whole = fill.sentence.split('___').join(answer);
    if (stage === 1) return [];
    if (stage === 2) return [typed({ id: `${id}d`, key: this.key(ref), prompt, answer, mode: 'exact', solution: whole, explanation: fill.why })];
    return [choice(rng, { id: `${id}a`, key: this.key(ref), prompt, correct: answer, wrong: fill.options.slice(1), solution: whole, explanation: fill.why })];
  }

  private factExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    if (stage !== 0) return [];
    const fact = this.data.units[ref.unit].facts[ref.index];
    return [choice(rng, { id: `${node.id}#${this.key(ref)}a`, key: this.key(ref), prompt: fact.question, correct: fact.answer, wrong: fact.wrong, explanation: fact.why })];
  }

  // Wrong answers

  /** First meanings of other words of this unit and the units before it; never one that a word with a shared meaning would also make right. */
  private otherWords(word: LanguageWord, unit: number, rng: LearnRandom): LanguageWord[] {
    const mine = new Set(word.meanings.map(folded));
    const same: LanguageWord[] = [];
    const earlier: LanguageWord[] = [];
    this.data.units.forEach((unitData, index) => {
      if (index > unit) return;
      for (const other of unitData.words) {
        if (other === word || other.meanings.length === 0) continue;
        if (other.meanings.some((m) => mine.has(folded(m)))) continue;
        (index === unit ? same : earlier).push(other);
      }
    });
    rng.shuffleInPlace(same);
    rng.shuffleInPlace(earlier);
    return [...same, ...earlier];
  }

  private meaningDistractors(word: LanguageWord, unit: number, rng: LearnRandom): string[] {
    return pickDistractors(word.meanings[0], this.otherWords(word, unit, rng).map((w) => w.meanings[0]));
  }

  private targetDistractors(word: LanguageWord, unit: number, rng: LearnRandom): string[] {
    return pickDistractors(word.target, this.otherWords(word, unit, rng).map((w) => w.target));
  }

  /** Other sentences of this unit and the units before it, those of a similar length first. */
  private otherSentences(sentence: LanguageSentence, unit: number, rng: LearnRandom): LanguageSentence[] {
    const pool: LanguageSentence[] = [];
    this.data.units.forEach((unitData, index) => {
      if (index <= unit) pool.push(...unitData.sentences.filter((s) => s !== sentence && s.meanings.length > 0));
    });
    rng.shuffleInPlace(pool);
    const length = [...sentence.target].length;
    return pool
      .map((element, offset) => ({ element, offset }))
      .sort((a, b) => {
        const da = Math.abs([...a.element.target].length - length);
        const db = Math.abs([...b.element.target].length - length);
        return da !== db ? da - db : a.offset - b.offset;
      })
      .map((o) => o.element);
  }

  /** Up to two words from other sentences that are not in this one. */
  private extraTiles(sentences: string[], own: string[], rng: LearnRandom): string[] {
    const used = new Set(own.map(folded));
    const pool: string[] = [];
    for (const sentence of sentences) {
      for (const tile of tilesOf(sentence)) if (!used.has(folded(tile)) && [...folded(tile)].length >= 2) pool.push(tile);
    }
    rng.shuffleInPlace(pool);
    return pool.slice(0, extraWords);
  }

  // Skills: a language unit teaches up to four things, and a student can be good at one and weak at another.

  skillFacets(unit: CourseUnit): SkillFacet[] {
    const content = this.data.units[unit.number - 1];
    if (!content) return [];
    const facets: SkillFacet[] = [];
    const hasWords = content.words.length > 0;
    if (hasWords) {
      // A school subject's terms have a definition, which nobody types; typing needs a language to write.
      const recall = this.data.produces || this.data.kind !== 'school';
      facets.push({
        key: 'vocab', title: 'Wortschatz',
        goal: recall ? 'Du erkennst die Wörter dieser Einheit und rufst sie ohne Auswahl ab.' : 'Du erkennst die Begriffe dieser Einheit.',
        levels: recall ? ['recognise', 'recall'] : ['recognise'], after: 'vocab',
      });
    }
    const base = hasWords ? ['vocab'] : [];
    if (content.sentences.length > 0) {
      facets.push({ key: 'sentences', title: 'Sätze und Satzbau', goal: 'Du verstehst die Sätze und setzt sie selbst richtig zusammen.', levels: ['recognise', 'apply'], requires: base });
    }
    if (content.forms.length > 0 || content.fills.length > 0 || content.facts.length > 0) {
      const applies = content.forms.length > 0 || content.fills.length > 0;
      facets.push({
        key: 'grammar', title: 'Grammatik', goal: applies ? 'Du bildest die Formen und wendest die Regeln im Satz an.' : 'Du kennst die Regeln dieser Einheit.',
        levels: applies ? ['recognise', 'apply'] : ['recognise'], requires: base,
      });
    }
    if (this.data.speech && this.data.produces) {
      // Hearing a word and choosing it, and hearing a sentence and typing it.
      const typedSentences = content.sentences.some((s) => tileCount(s.target) <= 8);
      const levels: SkillFacet['levels'] = [...(hasWords ? (['recognise'] as const) : []), ...(typedSentences ? (['apply'] as const) : [])];
      if (levels.length > 0) facets.push({ key: 'listening', title: 'Hören', goal: 'Du verstehst gesprochene Wörter und Sätze.', levels, requires: base });
    }
    return facets;
  }

  skillTag(item: LearnExercise): SkillTag {
    // The id is "<node>#<kind letter><unit>-<index><suffix letter>", or "<node>#p1" for pairs of words.
    const hash = item.id.lastIndexOf('#');
    if (hash < 0) return { facet: 'vocab', level: 'recognise' };
    const tail = item.id.slice(hash + 1);
    const kind = tail[0];
    const suffix = tail[tail.length - 1];
    if (kind === undefined) return { facet: 'vocab', level: 'recognise' };
    if (kind === 'p') return { facet: 'vocab', level: 'recognise' };
    if (kind === 'w') return suffix === 'c' ? { facet: 'listening', level: 'recognise' } : suffix === 'd' || suffix === 'e' ? { facet: 'vocab', level: 'recall' } : { facet: 'vocab', level: 'recognise' };
    if (kind === 's') return suffix === 'a' ? { facet: 'sentences', level: 'recognise' } : suffix === 'e' ? { facet: 'listening', level: 'apply' } : suffix === 'f' ? { facet: 'sentences', level: 'recall' } : { facet: 'sentences', level: 'apply' };
    if ((kind === 'f' || kind === 'g') && suffix === 'd') return { facet: 'grammar', level: 'apply' };
    if (kind === 'f' || kind === 'g' || kind === 'q') return { facet: 'grammar', level: 'recognise' };
    return { facet: 'vocab', level: 'recognise' };
  }

  /** Say what kind of slip a typed answer is: the right word with a wrong ending, the right letters in the wrong order. Only for answers the exact check rejected. */
  feedback(item: LearnExercise, answer: LearnAnswer): string | null {
    if (item.kind !== 'typeAnswer' || item.mode !== 'exact' || answer.type !== 'typed') return null;
    return answerAdvice(answer.value, item.correctAnswers);
  }
}

const wordsOf = (text: string): string[] => text.split(/\s+/u).map(folded).filter((w) => w !== '');

function commonPrefix(a: string, b: string): string {
  let result = '';
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) break;
    result += x[i];
  }
  return result;
}

/** Tells the student what is off about a typed answer in the language being learned, when that can be said for sure. */
export function answerAdvice(given: string, expected: string[]): string | null {
  const typedText = given.trim();
  const target = expected[0];
  if (typedText === '' || target === undefined) return null;
  const f = folded(typedText);
  if (expected.some((e) => folded(e) === f)) return null;
  const typedWords = wordsOf(typedText);
  const targetWords = wordsOf(target);
  // The same words in another order: only the word order is wrong.
  if (typedWords.length > 1 && [...typedWords].sort().join('\u0000') === [...targetWords].sort().join('\u0000')) return 'Die Wörter stimmen, aber die Reihenfolge nicht.';
  // The same number of words and all but one right: say which word, and whether it is only the ending.
  if (typedWords.length === targetWords.length) {
    const wrong = typedWords.map((w, i) => ({ w, r: targetWords[i], i })).filter((p) => p.w !== p.r);
    if (wrong.length === 1) {
      const { w, r, i } = wrong[0];
      const place = targetWords.length > 1 ? ` (Wort ${i + 1})` : '';
      const shared = commonPrefix(w, r);
      if ([...shared].length >= 3 && [...shared].length >= Math.min([...w].length, [...r].length) - 3) return `Fast: Der Wortanfang stimmt, die Endung${place} nicht.`;
      return `Ein Wort stimmt nicht${place}.`;
    }
  }
  if (typedWords.length < targetWords.length) return 'Es fehlt mindestens ein Wort.';
  if (typedWords.length > targetWords.length) return 'Es sind zu viele Wörter.';
  return null;
}

