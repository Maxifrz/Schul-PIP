package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.Course
import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.CourseSection
import de.maxifrz.lernwerk.learn.CourseUnit
import de.maxifrz.lernwerk.learn.ExerciseBuilder
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnAnswer
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.folded
import de.maxifrz.lernwerk.learn.shuffle
import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.SkillFacet
import de.maxifrz.lernwerk.learn.skills.SkillTag
import de.maxifrz.lernwerk.learn.trimWs
import de.maxifrz.lernwerk.review.AnswerCheck
import java.text.BreakIterator

// Turns a language or school-subject course (see LanguageDSL.kt) into lessons. Every item is met in three stages: first
// recognised (a choice), then put together (tiles, a choice in the other direction, hearing), then produced (typed).
// A port of LanguageCourseProvider.swift and LanguageSkills.swift.

private val spaces = Regex("\\p{IsWhite_Space}+")
private val punctuationOrSpace = Regex("^[\\p{P}\\t\\p{Zs}]+|[\\p{P}\\t\\p{Zs}]+$")
private val plainText = Regex("^[^\\p{M}\\u200d\\r\\u1100-\\u11ff\\x{1F1E6}-\\x{1F1FF}\\ufe0f]*$")

/** Swift `String.count`: extended grapheme clusters. */
fun graphemeCount(text: String): Int {
    if (plainText.matches(text)) return text.codePointCount(0, text.length)
    val it = BreakIterator.getCharacterInstance()
    it.setText(text)
    var n = 0
    while (it.next() != BreakIterator.DONE) n++
    return n
}

/** Swift `ExerciseBuilder.isValidDistractor`. */
fun isValidDistractor(candidate: String, answer: String): Boolean {
    val f = folded(candidate)
    if (f.isEmpty()) return false
    if (AnswerCheck.normalize(candidate) == AnswerCheck.normalize(answer) || f == folded(answer)) return false
    if (AnswerCheck.evaluate(candidate, answer) == AnswerCheck.Verdict.CORRECT) return false
    if (AnswerCheck.evaluate(answer, candidate) == AnswerCheck.Verdict.CORRECT) return false
    return true
}

/** Swift `ExerciseBuilder.pickDistractors`: up to `count` clearly wrong answers, in the order given and none twice. */
fun pickDistractors(
    answer: String,
    candidates: Iterable<String>,
    count: Int = ExerciseBuilder.distractorCount,
    taken: List<String> = emptyList(),
): List<String> {
    val seen = taken.map { folded(it) }.toHashSet()
    val picked = mutableListOf<String>()
    if (count <= 0) return picked
    for (candidate in candidates) {
        val text = candidate.trimWs()
        if (!isValidDistractor(text, answer)) continue
        val f = folded(text)
        if (!seen.add(f)) continue
        picked.add(text)
        if (picked.size == count) break
    }
    return picked
}

/** Words of a sentence as tiles, without the punctuation at their ends: it would show which tile is the last. */
fun languageTiles(sentence: String): List<String> =
    sentence.split(spaces).map { it.replace(punctuationOrSpace, "") }.filter { it.isNotEmpty() }

fun tileCount(sentence: String): Int = sentence.split(spaces).count { it.isNotEmpty() }

private enum class ItemKind(val letter: String) { WORD("w"), SENTENCE("s"), FORM("f"), FILL("g"), FACT("q") }

private data class Ref(val unit: Int, val kind: ItemKind, val index: Int) {
    val id: String get() = "$unit/${kind.name}/$index"
    val key: String get() = "${kind.letter}$unit-$index"
}

private class Plan(val focus: List<Ref>, val fresh: Set<String>, val rounds: List<List<Int>>, val total: Int)

private fun isWordOrSentence(r: Ref) = r.kind == ItemKind.WORD || r.kind == ItemKind.SENTENCE

class LanguageCourseProvider(val data: LanguageCourseData) : CourseProvider {
    override val course: Course
    private val texts: LanguageTexts = LanguageTexts.make(data)

    init {
        val titles = mutableListOf<String>()
        val grouped = mutableListOf<MutableList<CourseUnit>>()
        data.units.forEachIndexed { index, unit ->
            val built = CourseUnit.standard(data.id, index + 1, unit.title, unit.summary, unit.tip, lessonCount(unit))
            val title = if (unit.sectionTitle.isEmpty()) "Einheiten" else unit.sectionTitle
            if (titles.isNotEmpty() && titles.last() == title) {
                grouped.last().add(built)
            } else {
                titles.add(title)
                grouped.add(mutableListOf(built))
            }
        }
        val sections = grouped.mapIndexed { index, units -> CourseSection("${data.id}.s${index + 1}", titles[index], units) }
        course = Course(data.id, data.title, data.subtitle, data.kind, data.color, data.symbol, sections)
    }

    companion object {
        /** Lessons teach about six new items each, so a unit of 18 items has three lessons and one of 30 has five. */
        const val itemsPerLesson = 6

        /** Parses the text of a course. `errors` lists every problem in the text and in the content; a shipped course has none. */
        fun make(source: String): Pair<LanguageCourseProvider, List<String>> {
            val parsed = LanguageDSL.parse(source)
            return LanguageCourseProvider(parsed.data) to (parsed.errors + parsed.data.problems())
        }

        fun lessonCount(unit: LanguageUnitData): Int =
            minOf(5, maxOf(3, (unit.itemCount + itemsPerLesson - 1) / itemsPerLesson))
    }

    private fun counts(unit: Int): List<Pair<ItemKind, Int>> {
        val u = data.units[unit]
        return listOf(
            ItemKind.WORD to u.words.size, ItemKind.SENTENCE to u.sentences.size, ItemKind.FORM to u.forms.size,
            ItemKind.FILL to u.fills.size, ItemKind.FACT to u.facts.size,
        )
    }

    private class Positioned(val position: Double, val order: Int, val ref: Ref)

    /** The items of a unit in teaching order, or one lesson's share of it (`part` of `parts`, from 0). */
    private fun refs(unit: Int, part: Int? = null, parts: Int = 1): List<Ref> {
        val all = mutableListOf<Positioned>()
        counts(unit).forEachIndexed { order, (kind, count) ->
            if (count <= 0) return@forEachIndexed
            for (index in 0 until count) all.add(Positioned((index + 0.5) / count, order, Ref(unit, kind, index)))
        }
        val sorted = all.sortedWith { a, b -> if (a.position != b.position) a.position.compareTo(b.position) else a.order.compareTo(b.order) }
        val ordered = sorted.map { it.ref }
        if (part == null) return ordered
        return ordered.subList(ordered.size * part / parts, ordered.size * (part + 1) / parts)
    }

    /** Up to `limit` words and sentences from the units before, picked by the generator. */
    private fun earlierRefs(before: Int, limit: Int, rng: LearnRandom): List<Ref> {
        if (before <= 0 || limit <= 0) return emptyList()
        val pool = mutableListOf<Ref>()
        for (earlier in 0 until before) pool.addAll(refs(earlier).filter { isWordOrSentence(it) })
        shuffle(pool, rng)
        return pool.take(limit)
    }

    private fun plan(node: CourseNode, rng: LearnRandom): Plan {
        val unit = node.unitNumber - 1
        return when (node.kind) {
            NodeKind.LESSON -> {
                val lessons = lessonCount(data.units[unit])
                val part = minOf(lessons - 1, node.index - 1)
                val fresh = refs(unit, part, lessons)
                val review = if (part > 0) refs(unit, part - 1, lessons).filter { isWordOrSentence(it) }.takeLast(2)
                else earlierRefs(unit, 2, rng)
                Plan(fresh + review, fresh.map { it.id }.toSet(), listOf(listOf(0, 1, 2), listOf(1, 2, 0)), ExerciseBuilder.maxExercises)
            }
            NodeKind.PRACTICE -> {
                val focus = refs(unit) + earlierRefs(unit, 4, rng)
                Plan(focus, focus.map { it.id }.toSet(), listOf(listOf(1, 2, 0), listOf(2, 1, 0)), ExerciseBuilder.maxExercises)
            }
            else -> {
                val focus = refs(unit) + earlierRefs(unit, 2, rng)
                Plan(focus, focus.map { it.id }.toSet(), listOf(listOf(2, 1, 0), listOf(1, 2, 0)), CourseAudit.checkpointRange.last - 1)
            }
        }
    }

    override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
        if (node.kind == NodeKind.CHEST || node.unitNumber - 1 !in data.units.indices) return emptyList()
        val rng = LearnRandom(Exercises.seed(node, seed))
        val plan = plan(node, rng)

        val chosen = mutableListOf<LearnExercise>()
        val ids = HashSet<String>()
        fun take(exercise: LearnExercise?): Boolean {
            if (exercise == null || exercise.id in ids) return false
            ids.add(exercise.id)
            chosen.add(exercise)
            return true
        }

        // Pairs of words first: one in a lesson, two in the longer rounds.
        val unitWords = refs(node.unitNumber - 1).filter { it.kind == ItemKind.WORD }
        var words = plan.focus.filter { it.kind == ItemKind.WORD }
        val have = words.map { it.id }.toSet()
        words = words + unitWords.filter { it.id !in have }
        take(pairsExercise(words, node, "p1", rng))
        if (node.kind != NodeKind.LESSON && words.size >= 8) take(pairsExercise(words.reversed(), node, "p2", rng))

        // Every item gets its first exercise before any item gets a second; items that came up less often go first.
        val usage = IntArray(plan.focus.size)
        plan.rounds.forEachIndexed { round, stages ->
            val shuffledOrder = plan.focus.indices.toMutableList()
            shuffle(shuffledOrder, rng)
            val order = shuffledOrder.sortedBy { usage[it] }
            order.forEachIndexed { position, index ->
                if (chosen.size >= plan.total) return@forEachIndexed
                val ref = plan.focus[index]
                if (round > 0 && ref.id !in plan.fresh) return@forEachIndexed
                var preference = stages
                if (round > 0 && position % 2 == 1) preference = listOf(stages[1], stages[0], stages[2])
                if (round == 0 && ref.kind == ItemKind.SENTENCE && position % 2 == 1 && stages[0] == 0) preference = listOf(1, 0, 2)
                if (round == 0 && stages[0] == 2 && position % 3 == 0) preference = listOf(1, 2, 0)
                for (stage in preference) {
                    val candidates = itemExercises(ref, stage, node, rng).filter { it.id !in ids }.toMutableList()
                    if (candidates.isEmpty()) continue
                    shuffle(candidates, rng)
                    if (take(candidates[0])) {
                        usage[index] += 1
                        break
                    }
                }
            }
        }
        return Exercises.arrange(chosen, plan.total)
    }

    private fun pairsExercise(words: List<Ref>, node: CourseNode, tag: String, rng: LearnRandom): LearnExercise? {
        val seen = HashSet<String>()
        val items = mutableListOf<PairItem>()
        for (ref in words) {
            val word = data.units[ref.unit].words[ref.index]
            val meaning = word.meanings.firstOrNull() ?: continue
            if (!seen.add(folded(word.target))) continue
            if (!seen.add(folded(meaning))) continue
            items.add(PairItem(ref.key, word.target, meaning))
            if (items.size == ExerciseBuilder.pairCount) break
        }
        return Exercises.pairs(id = "${node.id}#$tag", prompt = texts.pairs, items = items, random = rng)
    }

    // Exercises of one item

    private fun speech(text: String): ExerciseMedia? = data.speech?.let { ExerciseMedia.Speech(text, it) }

    /** The exercises an item has at a stage: 0 recognise (a choice), 1 assemble or hear, 2 produce (typed). */
    private fun itemExercises(ref: Ref, stage: Int, node: CourseNode, rng: LearnRandom): List<LearnExercise> {
        val made = when (ref.kind) {
            ItemKind.WORD -> wordExercises(ref, stage, node, rng)
            ItemKind.SENTENCE -> sentenceExercises(ref, stage, node, rng)
            ItemKind.FORM -> formExercises(ref, stage, node, rng)
            ItemKind.FILL -> fillExercises(ref, stage, node, rng)
            ItemKind.FACT -> factExercises(ref, stage, node, rng)
        }
        return made.filterNotNull()
    }

    private fun wordExercises(ref: Ref, stage: Int, node: CourseNode, rng: LearnRandom): List<LearnExercise?> {
        val word = data.units[ref.unit].words[ref.index]
        val meaning = word.meanings.firstOrNull() ?: return emptyList()
        val k = ref.key
        val id = "${node.id}#$k"
        val t = texts
        val askTarget = fillTemplate(t.askTarget, meaning)
        val askMeaning = fillTemplate(t.meaning, word.target)
        // What a wrong answer is told: the author's sentence, or the word with its grammar note ("puella · -ae f.").
        val why = if (word.why.isNotEmpty()) word.why else if (word.note.isEmpty()) "" else "${word.target} · ${word.note}"
        when (stage) {
            0 -> {
                val wrong = meaningDistractors(word, ref.unit, rng)
                return listOf(Exercises.choice(id = id + "a", key = k, prompt = askMeaning, correct = meaning, wrong = wrong, explanation = why, media = speech(word.target), random = rng))
            }
            1 -> {
                if (!data.produces) return emptyList()
                val wrong = targetDistractors(word, ref.unit, rng)
                val list = mutableListOf<LearnExercise?>(
                    Exercises.choice(id = id + "b", key = k, prompt = askTarget, correct = word.target, wrong = wrong, explanation = why, random = rng),
                )
                if (data.speech != null) {
                    list.add(Exercises.choice(id = id + "c", key = k, prompt = t.listen, correct = word.target, wrong = wrong, explanation = why, media = speech(word.target), random = rng))
                }
                return list
            }
            else -> {
                val list = mutableListOf<LearnExercise?>()
                if (data.produces) {
                    list.add(Exercises.typed(id = id + "d", key = k, prompt = askTarget, answer = word.target, mode = AnswerMode.EXACT, explanation = why))
                }
                // A subject's terms have a definition for a meaning, which nobody types.
                if (data.kind != de.maxifrz.lernwerk.learn.CourseKind.SCHOOL) {
                    list.add(
                        Exercises.typed(
                            id = id + "e", key = k, prompt = askMeaning, answer = meaning, alternatives = word.meanings.drop(1),
                            explanation = why, media = speech(word.target),
                        ),
                    )
                }
                return list
            }
        }
    }

    private fun sentenceExercises(ref: Ref, stage: Int, node: CourseNode, rng: LearnRandom): List<LearnExercise?> {
        val sentence = data.units[ref.unit].sentences[ref.index]
        val meaning = sentence.meanings.firstOrNull() ?: return emptyList()
        val k = ref.key
        val id = "${node.id}#$k"
        val t = texts
        val others = otherSentences(sentence, ref.unit, rng)
        val targetTiles = languageTiles(sentence.target)
        val knownTiles = languageTiles(meaning)
        when (stage) {
            0 -> {
                val wrong = pickDistractors(meaning, others.map { it.meanings[0] })
                return listOf(
                    Exercises.choice(
                        id = id + "a", key = k, prompt = fillTemplate(t.translateFrom, sentence.target), correct = meaning, wrong = wrong,
                        explanation = sentence.why, media = speech(sentence.target), random = rng,
                    ),
                )
            }
            1 -> {
                // Evaluation order matters: the tiles' extras draw from the generator.
                val first = if (data.produces) {
                    Exercises.bank(
                        id = id + "b", key = k, prompt = fillTemplate(t.translateInto, meaning), words = targetTiles,
                        extra = extraTiles(others.map { it.target }, targetTiles, rng), solution = sentence.target,
                        explanation = sentence.why, random = rng,
                    )
                } else null
                val second = Exercises.bank(
                    id = id + "c", key = k, prompt = fillTemplate(t.translateFrom, sentence.target), words = knownTiles,
                    extra = extraTiles(others.map { it.meanings[0] }, knownTiles, rng), solution = meaning,
                    explanation = sentence.why, media = speech(sentence.target), random = rng,
                )
                return listOf(first, second)
            }
            else -> {
                val list = mutableListOf<LearnExercise?>()
                if (data.produces && targetTiles.size <= 8) {
                    list.add(
                        Exercises.typed(
                            id = id + "d", key = k, prompt = fillTemplate(t.translateInto, meaning), answer = sentence.target,
                            mode = AnswerMode.EXACT, explanation = sentence.why,
                        ),
                    )
                    if (data.speech != null) {
                        list.add(
                            Exercises.typed(
                                id = id + "e", key = k, prompt = t.listenType, answer = sentence.target, mode = AnswerMode.EXACT,
                                explanation = sentence.why, media = speech(sentence.target),
                            ),
                        )
                    }
                }
                if (!data.produces) {
                    // Translated into the known language, where the meaning counts, not the exact words.
                    list.add(
                        Exercises.typed(
                            id = id + "f", key = k, prompt = fillTemplate(t.translateFrom, sentence.target), answer = meaning,
                            alternatives = sentence.meanings.drop(1), explanation = sentence.why, media = speech(sentence.target),
                        ),
                    )
                }
                return list
            }
        }
    }

    private fun formExercises(ref: Ref, stage: Int, node: CourseNode, rng: LearnRandom): List<LearnExercise?> {
        val form = data.units[ref.unit].forms[ref.index]
        val answer = form.answers.firstOrNull() ?: return emptyList()
        val id = "${node.id}#${ref.key}"
        val prompt = fillTemplate(texts.form, form.prompt)
        if (stage == 1) return emptyList()
        if (stage == 2) {
            return listOf(
                Exercises.typed(
                    id = id + "d", key = ref.key, prompt = prompt, answer = answer, alternatives = form.answers.drop(1),
                    mode = AnswerMode.EXACT, explanation = form.why,
                ),
            )
        }
        val siblings = mutableListOf<String>()
        val others = mutableListOf<String>()
        for (other in data.units[ref.unit].forms) {
            if (other == form) continue
            val first = other.answers.firstOrNull() ?: continue
            if (formGroup(other) == formGroup(form)) siblings.add(first) else others.add(first)
        }
        shuffle(siblings, rng)
        shuffle(others, rng)
        val wrong = pickDistractors(answer, siblings + others)
        return listOf(Exercises.choice(id = id + "a", key = ref.key, prompt = prompt, correct = answer, wrong = wrong, explanation = form.why, random = rng))
    }

    private fun fillExercises(ref: Ref, stage: Int, node: CourseNode, rng: LearnRandom): List<LearnExercise?> {
        val fill = data.units[ref.unit].fills[ref.index]
        val answer = fill.options.firstOrNull() ?: return emptyList()
        val id = "${node.id}#${ref.key}"
        val prompt = fillTemplate(texts.fill, fill.sentence)
        val whole = fill.sentence.replace("___", answer)
        if (stage == 1) return emptyList()
        if (stage == 2) {
            return listOf(Exercises.typed(id = id + "d", key = ref.key, prompt = prompt, answer = answer, mode = AnswerMode.EXACT, solution = whole, explanation = fill.why))
        }
        return listOf(
            Exercises.choice(id = id + "a", key = ref.key, prompt = prompt, correct = answer, wrong = fill.options.drop(1), solution = whole, explanation = fill.why, random = rng),
        )
    }

    private fun factExercises(ref: Ref, stage: Int, node: CourseNode, rng: LearnRandom): List<LearnExercise?> {
        if (stage != 0) return emptyList()
        val fact = data.units[ref.unit].facts[ref.index]
        return listOf(
            Exercises.choice(
                id = "${node.id}#${ref.key}a", key = ref.key, prompt = fact.question, correct = fact.answer, wrong = fact.wrong,
                explanation = fact.why, random = rng,
            ),
        )
    }

    // Wrong answers

    /** Other words of this unit and the units before it; never one that shares a meaning with this word. */
    private fun otherWords(word: LanguageWord, unit: Int, rng: LearnRandom): List<LanguageWord> {
        val mine = word.meanings.map { folded(it) }.toSet()
        val same = mutableListOf<LanguageWord>()
        val earlier = mutableListOf<LanguageWord>()
        data.units.forEachIndexed { index, unitData ->
            if (index > unit) return@forEachIndexed
            for (other in unitData.words) {
                if (other == word || other.meanings.isEmpty()) continue
                if (other.meanings.map { folded(it) }.any { it in mine }) continue
                if (index == unit) same.add(other) else earlier.add(other)
            }
        }
        shuffle(same, rng)
        shuffle(earlier, rng)
        return same + earlier
    }

    private fun meaningDistractors(word: LanguageWord, unit: Int, rng: LearnRandom): List<String> =
        pickDistractors(word.meanings[0], otherWords(word, unit, rng).map { it.meanings[0] })

    private fun targetDistractors(word: LanguageWord, unit: Int, rng: LearnRandom): List<String> =
        pickDistractors(word.target, otherWords(word, unit, rng).map { it.target })

    /** Other sentences of this unit and the units before it, those of a similar length first. */
    private fun otherSentences(sentence: LanguageSentence, unit: Int, rng: LearnRandom): List<LanguageSentence> {
        val pool = mutableListOf<LanguageSentence>()
        data.units.forEachIndexed { index, unitData ->
            if (index > unit) return@forEachIndexed
            pool.addAll(unitData.sentences.filter { it != sentence && it.meanings.isNotEmpty() })
        }
        shuffle(pool, rng)
        val length = graphemeCount(sentence.target)
        return pool.sortedBy { Math.abs(graphemeCount(it.target) - length) }
    }

    /** Up to two words from other sentences that are not in this one. */
    private fun extraTiles(sentences: List<String>, own: List<String>, rng: LearnRandom): List<String> {
        val used = own.map { folded(it) }.toSet()
        val pool = mutableListOf<String>()
        for (sentence in sentences) {
            for (tile in languageTiles(sentence)) {
                val f = folded(tile)
                if (f !in used && graphemeCount(f) >= 2) pool.add(tile)
            }
        }
        shuffle(pool, rng)
        return pool.take(ExerciseBuilder.extraWords)
    }

    // Skills (LanguageSkills.swift)

    override fun skillFacets(unit: CourseUnit): List<SkillFacet> {
        val index = unit.number - 1
        if (index !in data.units.indices) return emptyList()
        val content = data.units[index]
        val facets = mutableListOf<SkillFacet>()
        val hasWords = content.words.isNotEmpty()
        if (hasWords) {
            // A school subject's terms have a definition, which nobody types; typing needs a language to write.
            val recall = data.produces || data.kind != de.maxifrz.lernwerk.learn.CourseKind.SCHOOL
            facets.add(
                SkillFacet(
                    "vocab", "Wortschatz",
                    if (recall) "Du erkennst die Wörter dieser Einheit und rufst sie ohne Auswahl ab." else "Du erkennst die Begriffe dieser Einheit.",
                    if (recall) listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.RECALL) else listOf(CompetenceLevel.RECOGNISE),
                    after = "vocab",
                ),
            )
        }
        val base = if (hasWords) listOf("vocab") else emptyList()
        if (content.sentences.isNotEmpty()) {
            facets.add(
                SkillFacet(
                    "sentences", "Sätze und Satzbau", "Du verstehst die Sätze und setzt sie selbst richtig zusammen.",
                    listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.APPLY), requires = base,
                ),
            )
        }
        if (content.forms.isNotEmpty() || content.fills.isNotEmpty() || content.facts.isNotEmpty()) {
            val applies = content.forms.isNotEmpty() || content.fills.isNotEmpty()
            facets.add(
                SkillFacet(
                    "grammar", "Grammatik",
                    if (applies) "Du bildest die Formen und wendest die Regeln im Satz an." else "Du kennst die Regeln dieser Einheit.",
                    if (applies) listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.APPLY) else listOf(CompetenceLevel.RECOGNISE),
                    requires = base,
                ),
            )
        }
        if (data.speech != null && data.produces) {
            // Hearing a word and choosing it, and hearing a sentence and typing it.
            val typed = content.sentences.any { tileCount(it.target) <= 8 }
            val levels = mutableListOf<CompetenceLevel>()
            if (hasWords) levels.add(CompetenceLevel.RECOGNISE)
            if (typed) levels.add(CompetenceLevel.APPLY)
            if (levels.isNotEmpty()) {
                facets.add(SkillFacet("listening", "Hören", "Du verstehst gesprochene Wörter und Sätze.", levels, requires = base))
            }
        }
        return facets
    }

    override fun skillTag(exercise: LearnExercise, node: CourseNode): SkillTag {
        // The id is "<node>#<kind letter><unit>-<index><suffix letter>", or "<node>#p1" for pairs of words.
        val hash = exercise.id.lastIndexOf('#')
        val fallback = SkillTag("vocab", CompetenceLevel.RECOGNISE)
        if (hash < 0) return fallback
        val tail = exercise.id.substring(hash + 1).codePoints().toArray()
        if (tail.isEmpty()) return fallback
        val kind = String(Character.toChars(tail[0]))
        val suffix = String(Character.toChars(tail[tail.size - 1]))
        if (kind == "p") return fallback
        if (kind == "w") {
            if (suffix == "c") return SkillTag("listening", CompetenceLevel.RECOGNISE)
            if (suffix == "d" || suffix == "e") return SkillTag("vocab", CompetenceLevel.RECALL)
            return fallback
        }
        if (kind == "s") {
            if (suffix == "a") return SkillTag("sentences", CompetenceLevel.RECOGNISE)
            if (suffix == "e") return SkillTag("listening", CompetenceLevel.APPLY)
            if (suffix == "f") return SkillTag("sentences", CompetenceLevel.RECALL)
            return SkillTag("sentences", CompetenceLevel.APPLY)
        }
        if ((kind == "f" || kind == "g") && suffix == "d") return SkillTag("grammar", CompetenceLevel.APPLY)
        if (kind == "f" || kind == "g" || kind == "q") return SkillTag("grammar", CompetenceLevel.RECOGNISE)
        return fallback
    }

    /** Say what kind of slip a typed answer is. Only for answers the exact check rejected. */
    override fun feedback(exercise: LearnExercise, answer: LearnAnswer): String? {
        if (exercise.kind != ExerciseKind.TYPE_ANSWER || exercise.mode != AnswerMode.EXACT || answer !is LearnAnswer.Typed) return null
        return LanguageAnswerAdvice.advice(answer.value, exercise.correctAnswers)
    }
}

/** Tells the student what is off about a typed answer in the language being learned, when that can be said for sure. */
object LanguageAnswerAdvice {
    fun advice(given: String, expected: List<String>): String? {
        val typed = given.trimWs()
        if (typed.isEmpty() || expected.isEmpty()) return null
        val target = expected[0]
        val f = folded(typed)
        if (expected.any { folded(it) == f }) return null

        val typedWords = wordsOf(typed)
        val targetWords = wordsOf(target)
        // The same words in another order: only the word order is wrong.
        if (typedWords.size > 1 && typedWords.sorted() == targetWords.sorted()) {
            return "Die Wörter stimmen, aber die Reihenfolge nicht."
        }
        // The same number of words and all but one right: say which word, and whether it is only the ending.
        if (typedWords.size == targetWords.size) {
            val wrong = typedWords.indices.filter { typedWords[it] != targetWords[it] }
            if (wrong.size == 1) {
                val offset = wrong[0]
                val got = typedWords[offset]
                val right = targetWords[offset]
                val place = if (targetWords.size > 1) " (Wort ${offset + 1})" else ""
                val shared = commonPrefix(got, right)
                if (shared >= 3 && shared >= minOf(got.codePointCount(0, got.length), right.codePointCount(0, right.length)) - 3) {
                    return "Fast: Der Wortanfang stimmt, die Endung$place nicht."
                }
                return "Ein Wort stimmt nicht$place."
            }
        }
        if (typedWords.size < targetWords.size) return "Es fehlt mindestens ein Wort."
        if (typedWords.size > targetWords.size) return "Es sind zu viele Wörter."
        return null
    }

    private fun wordsOf(text: String): List<String> =
        text.split(spaces).filter { it.isNotEmpty() }.map { folded(it) }.filter { it.isNotEmpty() }

    private fun commonPrefix(a: String, b: String): Int {
        val x = a.codePoints().toArray()
        val y = b.codePoints().toArray()
        var n = 0
        while (n < x.size && n < y.size && x[n] == y[n]) n++
        return n
    }
}
