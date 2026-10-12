// Turns a language or school-subject course (see dsl.ts) into lessons. Every item is met in three stages: first
// recognised (a choice), then put together (tiles, a choice in the other direction, hearing), then produced (typed).
// A lesson teaches a third of the unit and warms up with two items from before; practice and the checkpoint cover the
// whole unit and some of the units before it, with more typing in the checkpoint.
// Port of Lernwerk/Services/Learn/Languages/LanguageCourseProvider.swift and LanguageSkills.swift.
import { evaluate, normalize } from '../../answerCheck';
import { CourseAudit } from '../audit';
import { type Course, type CourseNode, type CourseProvider, type CourseSection, type CourseUnit, makeCourse, standardUnit } from '../course';
import { folded, type LearnAnswer, type LearnExercise } from '../exercise';
import { ExerciseBuilder } from '../exerciseConstants';
import { Exercises } from '../exercises';
import { ExerciseMedia } from '../media';
import { LearnRandom, shuffle } from '../random';
import { type CompetenceLevel, type SkillFacet, skillFacet, type SkillTag } from '../skills/skill';
import { deepEqual } from '../util';
import {
  type LanguageCourseData, type LanguageSentence, type LanguageTexts, type LanguageUnitData,
  type LanguageWord, fillTemplate, formGroup, makeLanguageTexts, problems, unitItemCount,
} from './data';
import { parseLanguageCourse } from './dsl';

// MARK: Shared helpers

const wsAndNewlines = /^[\s﻿]+|[\s﻿]+$/g;

/** Swift `String.count`: extended grapheme clusters. */
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const plainText = /^[^\p{M}\u200d\r\u1100-\u11ff\u{1f1e6}-\u{1f1ff}\ufe0f]*$/u;
export function graphemeCount(text: string): number {
  // Without combining marks, joiners, Hangul jamo, flags or CRLF every code point is one cluster.
  if (plainText.test(text)) return Array.from(text).length;
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

/** Swift `ExerciseBuilder.isValidDistractor`. */
export function isValidDistractor(candidate: string, answer: string): boolean {
  const f = folded(candidate);
  if (f === '') return false;
  if (normalize(candidate) === normalize(answer) || f === folded(answer)) return false;
  if (evaluate(candidate, answer) === 'correct') return false;
  if (evaluate(answer, candidate) === 'correct') return false;
  return true;
}

/** Swift `ExerciseBuilder.pickDistractors`: up to `count` clearly wrong answers, in the order given and none twice. */
export function pickDistractors(
  answer: string,
  candidates: Iterable<string>,
  count: number = ExerciseBuilder.distractorCount,
  taken: readonly string[] = [],
): string[] {
  const seen = new Set(taken.map(folded));
  const picked: string[] = [];
  if (count <= 0) return picked;
  for (const candidate of candidates) {
    const text = candidate.replace(wsAndNewlines, '');
    if (!isValidDistractor(text, answer)) continue;
    const f = folded(text);
    if (seen.has(f)) continue;
    seen.add(f);
    picked.push(text);
    if (picked.length === count) break;
  }
  return picked;
}

// MARK: Items

type ItemKind = 'word' | 'sentence' | 'form' | 'fill' | 'fact';
interface Ref {
  unit: number;
  kind: ItemKind;
  index: number;
}
const refId = (r: Ref): string => `${r.unit}/${r.kind}/${r.index}`;

interface Plan {
  focus: Ref[];
  fresh: Set<string>;
  rounds: number[][];
  total: number;
}

const isWordOrSentence = (r: Ref): boolean => r.kind === 'word' || r.kind === 'sentence';

const punctuationOrSpace = /^[\p{P}\t\p{Zs}]+|[\p{P}\t\p{Zs}]+$/gu;

/** Words of a sentence as tiles, without the punctuation at their ends: it would show which tile is the last. */
export function languageTiles(sentence: string): string[] {
  return sentence
    .split(/[\p{White_Space}]+/u)
    .map((piece) => piece.replace(punctuationOrSpace, ''))
    .filter((t) => t !== '');
}

export function tileCount(sentence: string): number {
  return sentence.split(/[\p{White_Space}]+/u).filter((p) => p !== '').length;
}

export class LanguageCourseProvider implements CourseProvider {
  /** Lessons teach about six new items each, so a unit of 18 items has three lessons and one of 30 has five. */
  static readonly itemsPerLesson = 6;

  readonly data: LanguageCourseData;
  readonly course: Course;
  private readonly texts: LanguageTexts;

  constructor(data: LanguageCourseData) {
    this.data = data;
    this.texts = makeLanguageTexts(data);
    const titles: string[] = [];
    const grouped: CourseUnit[][] = [];
    data.units.forEach((unit, index) => {
      const built = standardUnit(data.id, index + 1, unit.title, unit.summary, unit.tip, LanguageCourseProvider.lessonCount(unit));
      const title = unit.sectionTitle === '' ? 'Einheiten' : unit.sectionTitle;
      if (titles.length > 0 && titles[titles.length - 1] === title) {
        grouped[grouped.length - 1].push(built);
      } else {
        titles.push(title);
        grouped.push([built]);
      }
    });
    const sections: CourseSection[] = grouped.map((units, index) => ({ id: `${data.id}.s${index + 1}`, title: titles[index], units }));
    this.course = makeCourse({
      id: data.id, title: data.title, subtitle: data.subtitle, kind: data.kind, color: data.color, symbol: data.symbol, sections,
    });
  }

  /** Parses the text of a course. `errors` lists every problem in the text and in the content; a shipped course has none. */
  static make(source: string): { provider: LanguageCourseProvider; errors: string[] } {
    const parsed = parseLanguageCourse(source);
    return { provider: new LanguageCourseProvider(parsed.data), errors: [...parsed.errors, ...problems(parsed.data)] };
  }

  static lessonCount(unit: LanguageUnitData): number {
    return Math.min(5, Math.max(3, Math.floor((unitItemCount(unit) + LanguageCourseProvider.itemsPerLesson - 1) / LanguageCourseProvider.itemsPerLesson)));
  }

  private counts(unit: number): Array<[ItemKind, number]> {
    const u = this.data.units[unit];
    return [['word', u.words.length], ['sentence', u.sentences.length], ['form', u.forms.length], ['fill', u.fills.length], ['fact', u.facts.length]];
  }

  /** The items of a unit in teaching order, or one lesson's share of it (`part` of `parts`, from 0). */
  private refs(unit: number, part?: number, parts = 1): Ref[] {
    const all: Array<{ position: number; order: number; ref: Ref }> = [];
    this.counts(unit).forEach(([kind, count], order) => {
      if (count <= 0) return;
      for (let index = 0; index < count; index++) {
        all.push({ position: (index + 0.5) / count, order, ref: { unit, kind, index } });
      }
    });
    all.sort((a, b) => (a.position !== b.position ? a.position - b.position : a.order - b.order));
    const ordered = all.map((e) => e.ref);
    if (part === undefined) return ordered;
    return ordered.slice(Math.floor((ordered.length * part) / parts), Math.floor((ordered.length * (part + 1)) / parts));
  }

  /** Up to `limit` words and sentences from the units before, picked by the generator. */
  private earlierRefs(before: number, limit: number, rng: LearnRandom): Ref[] {
    if (before <= 0 || limit <= 0) return [];
    let pool: Ref[] = [];
    for (let earlier = 0; earlier < before; earlier++) pool = pool.concat(this.refs(earlier).filter(isWordOrSentence));
    shuffle(pool, rng);
    return pool.slice(0, limit);
  }

  private plan(node: CourseNode, rng: LearnRandom): Plan {
    const unit = node.unitNumber - 1;
    switch (node.kind) {
      case 'lesson': {
        const lessons = LanguageCourseProvider.lessonCount(this.data.units[unit]);
        const part = Math.min(lessons - 1, node.index - 1);
        const fresh = this.refs(unit, part, lessons);
        const review = part > 0
          ? this.refs(unit, part - 1, lessons).filter(isWordOrSentence).slice(-2)
          : this.earlierRefs(unit, 2, rng);
        return { focus: [...fresh, ...review], fresh: new Set(fresh.map(refId)), rounds: [[0, 1, 2], [1, 2, 0]], total: ExerciseBuilder.maxExercises };
      }
      case 'practice': {
        const focus = [...this.refs(unit), ...this.earlierRefs(unit, 4, rng)];
        return { focus, fresh: new Set(focus.map(refId)), rounds: [[1, 2, 0], [2, 1, 0]], total: ExerciseBuilder.maxExercises };
      }
      default: {
        const focus = [...this.refs(unit), ...this.earlierRefs(unit, 2, rng)];
        return { focus, fresh: new Set(focus.map(refId)), rounds: [[2, 1, 0], [1, 2, 0]], total: CourseAudit.checkpointRange.upper - 1 };
      }
    }
  }

  exercises(node: CourseNode, seed: bigint): LearnExercise[] {
    if (node.kind === 'chest' || !(node.unitNumber - 1 >= 0 && node.unitNumber - 1 < this.data.units.length)) return [];
    const rng = new LearnRandom(Exercises.seed(node, seed));
    const plan = this.plan(node, rng);

    const chosen: LearnExercise[] = [];
    const ids = new Set<string>();
    const take = (exercise: LearnExercise | null | undefined): boolean => {
      if (!exercise || ids.has(exercise.id)) return false;
      ids.add(exercise.id);
      chosen.push(exercise);
      return true;
    };

    // Pairs of words first: one in a lesson, two in the longer rounds.
    const unitWords = this.refs(node.unitNumber - 1).filter((r) => r.kind === 'word');
    let words = plan.focus.filter((r) => r.kind === 'word');
    const have = new Set(words.map(refId));
    words = words.concat(unitWords.filter((r) => !have.has(refId(r))));
    take(this.pairsExercise(words, node, 'p1', rng));
    if (node.kind !== 'lesson' && words.length >= 8) take(this.pairsExercise(words.slice().reverse(), node, 'p2', rng));

    // Every item gets its first exercise before any item gets a second; items that came up less often go first.
    const usage = plan.focus.map(() => 0);
    plan.rounds.forEach((stages, round) => {
      const shuffledOrder = plan.focus.map((_, i) => i);
      shuffle(shuffledOrder, rng);
      const order = shuffledOrder
        .map((element, offset) => ({ element, offset }))
        .sort((a, b) => (usage[a.element] !== usage[b.element] ? usage[a.element] - usage[b.element] : a.offset - b.offset))
        .map((e) => e.element);
      order.forEach((index, position) => {
        if (!(chosen.length < plan.total)) return;
        const ref = plan.focus[index];
        if (round > 0 && !plan.fresh.has(refId(ref))) return;
        // Alternate the order of the stages from item to item (by place in this run's shuffled order).
        let preference = stages;
        if (round > 0 && position % 2 === 1) preference = [stages[1], stages[0], stages[2]];
        if (round === 0 && ref.kind === 'sentence' && position % 2 === 1 && stages[0] === 0) preference = [1, 0, 2];
        if (round === 0 && stages[0] === 2 && position % 3 === 0) preference = [1, 2, 0];
        for (const stage of preference) {
          const candidates = this.itemExercises(ref, stage, node, rng).filter((e) => !ids.has(e.id));
          if (candidates.length === 0) continue;
          shuffle(candidates, rng);
          if (take(candidates[0])) {
            usage[index] += 1;
            break;
          }
        }
      });
    });
    return Exercises.arrange(chosen, plan.total);
  }

  private pairsExercise(words: Ref[], node: CourseNode, tag: string, rng: LearnRandom): LearnExercise | null {
    const seen = new Set<string>();
    const items: Array<{ key: string; front: string; back: string }> = [];
    for (const ref of words) {
      const word = this.data.units[ref.unit].words[ref.index];
      const meaning = word.meanings[0];
      if (meaning === undefined) continue;
      const a = folded(word.target);
      if (seen.has(a)) continue;
      seen.add(a);
      const b = folded(meaning);
      if (seen.has(b)) continue;
      seen.add(b);
      items.push({ key: itemKey(ref), front: word.target, back: meaning });
      if (items.length === ExerciseBuilder.pairCount) break;
    }
    return Exercises.pairs({ id: `${node.id}#${tag}`, prompt: this.texts.pairs, items }, rng);
  }

  // MARK: Exercises of one item

  private speech(text: string): ExerciseMedia | null {
    return this.data.speech === null ? null : ExerciseMedia.speech(text, this.data.speech);
  }

  /** The exercises an item has at a stage: 0 recognise (a choice), 1 assemble or hear, 2 produce (typed). */
  private itemExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): LearnExercise[] {
    let made: Array<LearnExercise | null>;
    switch (ref.kind) {
      case 'word': made = this.wordExercises(ref, stage, node, rng); break;
      case 'sentence': made = this.sentenceExercises(ref, stage, node, rng); break;
      case 'form': made = this.formExercises(ref, stage, node, rng); break;
      case 'fill': made = this.fillExercises(ref, stage, node, rng); break;
      default: made = this.factExercises(ref, stage, node, rng); break;
    }
    return made.filter((e): e is LearnExercise => e !== null);
  }

  private wordExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    const word = this.data.units[ref.unit].words[ref.index];
    const meaning = word.meanings[0];
    if (meaning === undefined) return [];
    const id = `${node.id}#${itemKey(ref)}`;
    const k = itemKey(ref);
    const t = this.texts;
    const askTarget = fillTemplate(t.askTarget, meaning);
    const askMeaning = fillTemplate(t.meaning, word.target);
    // What a wrong answer is told: the author's sentence, or the word with its grammar note ("puella · -ae f.").
    const why = word.why !== '' ? word.why : word.note === '' ? '' : `${word.target} · ${word.note}`;
    switch (stage) {
      case 0: {
        const wrong = this.meaningDistractors(word, ref.unit, rng);
        return [Exercises.choice({ id: id + 'a', key: k, prompt: askMeaning, correct: meaning, wrong, explanation: why, media: this.speech(word.target) }, rng)];
      }
      case 1: {
        if (!this.data.produces) return [];
        const wrong = this.targetDistractors(word, ref.unit, rng);
        const list = [Exercises.choice({ id: id + 'b', key: k, prompt: askTarget, correct: word.target, wrong, explanation: why }, rng)];
        if (this.data.speech !== null) {
          list.push(Exercises.choice({ id: id + 'c', key: k, prompt: t.listen, correct: word.target, wrong, explanation: why, media: this.speech(word.target) }, rng));
        }
        return list;
      }
      default: {
        const list: Array<LearnExercise | null> = [];
        if (this.data.produces) {
          list.push(Exercises.typed({ id: id + 'd', key: k, prompt: askTarget, answer: word.target, mode: 'exact', explanation: why }));
        }
        // A subject's terms have a definition for a meaning, which nobody types.
        if (this.data.kind !== 'school') {
          list.push(Exercises.typed({
            id: id + 'e', key: k, prompt: askMeaning, answer: meaning, alternatives: word.meanings.slice(1), explanation: why,
            media: this.speech(word.target),
          }));
        }
        return list;
      }
    }
  }

  private sentenceExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    const sentence = this.data.units[ref.unit].sentences[ref.index];
    const meaning = sentence.meanings[0];
    if (meaning === undefined) return [];
    const id = `${node.id}#${itemKey(ref)}`;
    const k = itemKey(ref);
    const t = this.texts;
    const others = this.otherSentences(sentence, ref.unit, rng);
    const targetTiles = languageTiles(sentence.target);
    const knownTiles = languageTiles(meaning);
    switch (stage) {
      case 0: {
        const wrong = pickDistractors(meaning, others.map((o) => o.meanings[0]));
        return [Exercises.choice({
          id: id + 'a', key: k, prompt: fillTemplate(t.translateFrom, sentence.target), correct: meaning, wrong,
          explanation: sentence.why, media: this.speech(sentence.target),
        }, rng)];
      }
      case 1: {
        // Swift evaluates the array elements in order, and the tiles' extras draw from the generator.
        const first = this.data.produces
          ? Exercises.bank({
              id: id + 'b', key: k, prompt: fillTemplate(t.translateInto, meaning), words: targetTiles,
              extra: this.extraTiles(others.map((o) => o.target), targetTiles, rng), solution: sentence.target, explanation: sentence.why,
            }, rng)
          : null;
        const second = Exercises.bank({
          id: id + 'c', key: k, prompt: fillTemplate(t.translateFrom, sentence.target), words: knownTiles,
          extra: this.extraTiles(others.map((o) => o.meanings[0]), knownTiles, rng), solution: meaning, explanation: sentence.why,
          media: this.speech(sentence.target),
        }, rng);
        return [first, second];
      }
      default: {
        const list: Array<LearnExercise | null> = [];
        if (this.data.produces && targetTiles.length <= 8) {
          list.push(Exercises.typed({
            id: id + 'd', key: k, prompt: fillTemplate(t.translateInto, meaning), answer: sentence.target, mode: 'exact', explanation: sentence.why,
          }));
          if (this.data.speech !== null) {
            list.push(Exercises.typed({
              id: id + 'e', key: k, prompt: t.listenType, answer: sentence.target, mode: 'exact', explanation: sentence.why,
              media: this.speech(sentence.target),
            }));
          }
        }
        if (!this.data.produces) {
          // Translated into the known language, where the meaning counts, not the exact words.
          list.push(Exercises.typed({
            id: id + 'f', key: k, prompt: fillTemplate(t.translateFrom, sentence.target), answer: meaning,
            alternatives: sentence.meanings.slice(1), explanation: sentence.why, media: this.speech(sentence.target),
          }));
        }
        return list;
      }
    }
  }

  private formExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    const form = this.data.units[ref.unit].forms[ref.index];
    const answer = form.answers[0];
    if (answer === undefined) return [];
    const id = `${node.id}#${itemKey(ref)}`;
    const prompt = fillTemplate(this.texts.form, form.prompt);
    if (stage === 1) return [];
    if (stage === 2) {
      return [Exercises.typed({
        id: id + 'd', key: itemKey(ref), prompt, answer, alternatives: form.answers.slice(1), mode: 'exact', explanation: form.why,
      })];
    }
    const siblings: string[] = [];
    const others: string[] = [];
    for (const other of this.data.units[ref.unit].forms) {
      if (deepEqual(other, form)) continue;
      const first = other.answers[0];
      if (first === undefined) continue;
      if (formGroup(other) === formGroup(form)) siblings.push(first);
      else others.push(first);
    }
    shuffle(siblings, rng);
    shuffle(others, rng);
    const wrong = pickDistractors(answer, [...siblings, ...others]);
    return [Exercises.choice({ id: id + 'a', key: itemKey(ref), prompt, correct: answer, wrong, explanation: form.why }, rng)];
  }

  private fillExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    const fill = this.data.units[ref.unit].fills[ref.index];
    const answer = fill.options[0];
    if (answer === undefined) return [];
    const id = `${node.id}#${itemKey(ref)}`;
    const prompt = fillTemplate(this.texts.fill, fill.sentence);
    const whole = fill.sentence.split('___').join(answer);
    if (stage === 1) return [];
    if (stage === 2) {
      return [Exercises.typed({ id: id + 'd', key: itemKey(ref), prompt, answer, mode: 'exact', solution: whole, explanation: fill.why })];
    }
    return [Exercises.choice({
      id: id + 'a', key: itemKey(ref), prompt, correct: answer, wrong: fill.options.slice(1), solution: whole, explanation: fill.why,
    }, rng)];
  }

  private factExercises(ref: Ref, stage: number, node: CourseNode, rng: LearnRandom): Array<LearnExercise | null> {
    if (stage !== 0) return [];
    const fact = this.data.units[ref.unit].facts[ref.index];
    return [Exercises.choice({
      id: `${node.id}#${itemKey(ref)}a`, key: itemKey(ref), prompt: fact.question, correct: fact.answer, wrong: [...fact.wrong],
      explanation: fact.why,
    }, rng)];
  }

  // MARK: Wrong answers

  /** Other words of this unit and the units before it; never one that shares a meaning with this word. */
  private otherWords(word: LanguageWord, unit: number, rng: LearnRandom): LanguageWord[] {
    const mine = new Set(word.meanings.map(folded));
    const same: LanguageWord[] = [];
    const earlier: LanguageWord[] = [];
    this.data.units.forEach((unitData, index) => {
      if (index > unit) return;
      for (const other of unitData.words) {
        if (deepEqual(other, word) || other.meanings.length === 0) continue;
        if (other.meanings.map(folded).some((m) => mine.has(m))) continue;
        if (index === unit) same.push(other);
        else earlier.push(other);
      }
    });
    shuffle(same, rng);
    shuffle(earlier, rng);
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
    let pool: LanguageSentence[] = [];
    this.data.units.forEach((unitData, index) => {
      if (index > unit) return;
      pool = pool.concat(unitData.sentences.filter((s) => !deepEqual(s, sentence) && s.meanings.length > 0));
    });
    shuffle(pool, rng);
    const length = graphemeCount(sentence.target);
    return pool
      .map((element, offset) => ({ element, offset }))
      .sort((a, b) => {
        const da = Math.abs(graphemeCount(a.element.target) - length);
        const db = Math.abs(graphemeCount(b.element.target) - length);
        return da !== db ? da - db : a.offset - b.offset;
      })
      .map((e) => e.element);
  }

  /** Up to two words from other sentences that are not in this one. */
  private extraTiles(sentences: string[], own: string[], rng: LearnRandom): string[] {
    const used = new Set(own.map(folded));
    const pool: string[] = [];
    for (const sentence of sentences) {
      for (const tile of languageTiles(sentence)) {
        const f = folded(tile);
        if (!used.has(f) && graphemeCount(f) >= 2) pool.push(tile);
      }
    }
    shuffle(pool, rng);
    return pool.slice(0, ExerciseBuilder.extraWords);
  }

  // MARK: Skills (LanguageSkills.swift)

  skillFacets(unit: CourseUnit): SkillFacet[] {
    const index = unit.number - 1;
    if (!(index >= 0 && index < this.data.units.length)) return [];
    const content = this.data.units[index];
    const data = this.data;
    const facets: SkillFacet[] = [];
    const hasWords = content.words.length > 0;
    if (hasWords) {
      // A school subject's terms have a definition, which nobody types; typing needs a language to write.
      const recall = data.produces || data.kind !== 'school';
      facets.push(skillFacet(
        'vocab', 'Wortschatz',
        recall ? 'Du erkennst die Wörter dieser Einheit und rufst sie ohne Auswahl ab.' : 'Du erkennst die Begriffe dieser Einheit.',
        recall ? ['recognise', 'recall'] : ['recognise'], { after: 'vocab' },
      ));
    }
    const base = hasWords ? ['vocab'] : [];
    if (content.sentences.length > 0) {
      facets.push(skillFacet('sentences', 'Sätze und Satzbau', 'Du verstehst die Sätze und setzt sie selbst richtig zusammen.', ['recognise', 'apply'], { requires: base }));
    }
    if (content.forms.length > 0 || content.fills.length > 0 || content.facts.length > 0) {
      const applies = content.forms.length > 0 || content.fills.length > 0;
      facets.push(skillFacet(
        'grammar', 'Grammatik',
        applies ? 'Du bildest die Formen und wendest die Regeln im Satz an.' : 'Du kennst die Regeln dieser Einheit.',
        applies ? ['recognise', 'apply'] : ['recognise'], { requires: base },
      ));
    }
    if (data.speech !== null && data.produces) {
      // Hearing a word and choosing it, and hearing a sentence and typing it.
      const typed = content.sentences.some((s) => tileCount(s.target) <= 8);
      const levels: CompetenceLevel[] = [...(hasWords ? (['recognise'] as const) : []), ...(typed ? (['apply'] as const) : [])];
      if (levels.length > 0) {
        facets.push(skillFacet('listening', 'Hören', 'Du verstehst gesprochene Wörter und Sätze.', levels, { requires: base }));
      }
    }
    return facets;
  }

  skillTag(exercise: LearnExercise, _node: CourseNode): SkillTag {
    // The id is "<node>#<kind letter><unit>-<index><suffix letter>", or "<node>#p1" for pairs of words.
    const hash = exercise.id.lastIndexOf('#');
    const fallback: SkillTag = { facet: 'vocab', level: 'recognise' };
    if (hash < 0) return fallback;
    const tail = Array.from(exercise.id.slice(hash + 1));
    if (tail.length === 0) return fallback;
    const kind = tail[0];
    const suffix = tail[tail.length - 1];
    if (kind === 'p') return fallback;
    if (kind === 'w') {
      if (suffix === 'c') return { facet: 'listening', level: 'recognise' };
      if (suffix === 'd' || suffix === 'e') return { facet: 'vocab', level: 'recall' };
      return fallback;
    }
    if (kind === 's') {
      if (suffix === 'a') return { facet: 'sentences', level: 'recognise' };
      if (suffix === 'e') return { facet: 'listening', level: 'apply' };
      if (suffix === 'f') return { facet: 'sentences', level: 'recall' };
      return { facet: 'sentences', level: 'apply' };
    }
    if ((kind === 'f' || kind === 'g') && suffix === 'd') return { facet: 'grammar', level: 'apply' };
    if (kind === 'f' || kind === 'g' || kind === 'q') return { facet: 'grammar', level: 'recognise' };
    return fallback;
  }

  /** Say what kind of slip a typed answer is. Only for answers the exact check rejected. */
  feedback(exercise: LearnExercise, answer: LearnAnswer): string | null {
    if (exercise.kind !== 'typeAnswer' || exercise.mode !== 'exact' || answer.type !== 'typed') return null;
    return LanguageAnswerAdvice.advice(answer.value, exercise.correctAnswers);
  }
}

function itemKey(ref: Ref): string {
  const letter = { word: 'w', sentence: 's', form: 'f', fill: 'g', fact: 'q' }[ref.kind];
  return `${letter}${ref.unit}-${ref.index}`;
}

/** Tells the student what is off about a typed answer in the language being learned, when that can be said for sure. */
export const LanguageAnswerAdvice = {
  advice(given: string, expected: readonly string[]): string | null {
    const typed = given.replace(wsAndNewlines, '');
    if (typed === '' || expected.length === 0) return null;
    const target = expected[0];
    const f = folded(typed);
    if (expected.some((e) => folded(e) === f)) return null;

    const typedWords = wordsOf(typed);
    const targetWords = wordsOf(target);
    // The same words in another order: only the word order is wrong.
    if (typedWords.length > 1 && sortedKey(typedWords) === sortedKey(targetWords)) {
      return 'Die Wörter stimmen, aber die Reihenfolge nicht.';
    }
    // The same number of words and all but one right: say which word, and whether it is only the ending.
    if (typedWords.length === targetWords.length) {
      const wrong: Array<[number, string, string]> = [];
      typedWords.forEach((w, i) => {
        if (w !== targetWords[i]) wrong.push([i, w, targetWords[i]]);
      });
      if (wrong.length === 1) {
        const [offset, got, right] = wrong[0];
        const place = targetWords.length > 1 ? ` (Wort ${offset + 1})` : '';
        const shared = commonPrefix(got, right);
        if (shared >= 3 && shared >= Math.min(Array.from(got).length, Array.from(right).length) - 3) {
          return `Fast: Der Wortanfang stimmt, die Endung${place} nicht.`;
        }
        return `Ein Wort stimmt nicht${place}.`;
      }
    }
    if (typedWords.length < targetWords.length) return 'Es fehlt mindestens ein Wort.';
    if (typedWords.length > targetWords.length) return 'Es sind zu viele Wörter.';
    return null;
  },
};

function wordsOf(text: string): string[] {
  return text.split(/[\p{White_Space}]+/u).filter((p) => p !== '').map(folded).filter((w) => w !== '');
}

function sortedKey(words: string[]): string {
  return JSON.stringify(words.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
}

function commonPrefix(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n;
}
