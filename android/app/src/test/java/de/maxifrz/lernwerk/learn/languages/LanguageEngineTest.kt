package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.CoursePath
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnAnswer
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.SkillMaps
import de.maxifrz.lernwerk.learn.at
import de.maxifrz.lernwerk.learn.calendar
import de.maxifrz.lernwerk.learn.folded
import de.maxifrz.lernwerk.learn.missedKeys
import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.ExerciseOutcome
import de.maxifrz.lernwerk.learn.skills.RecommendationKind
import de.maxifrz.lernwerk.learn.skills.SkillAdvisor
import de.maxifrz.lernwerk.learn.skills.SkillAssessor
import de.maxifrz.lernwerk.learn.skills.SkillPractice
import de.maxifrz.lernwerk.learn.skills.SkillRecord
import de.maxifrz.lernwerk.learn.skills.SkillStatus
import de.maxifrz.lernwerk.learn.skills.SkillTag
import de.maxifrz.lernwerk.learn.skills.Tally
import de.maxifrz.lernwerk.review.AnswerCheck
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

private val sample = LanguageCourseProvider.make(sampleSource).first
private fun ex(node: CourseNode, seed: Int = 1) = sample.exercises(node, seed.toULong())
private fun nodeOf(id: String) = sample.course.node(id)!!
private fun missed(e: LearnExercise, text: String) = e.missedKeys(LearnAnswer.Typed(text))
private fun seeds(a: Int, b: Int) = (a..b).map { it.toULong() }

/** The provider parts of LanguageCourseTests / LanguageDSLTests on the sample sources. */
class LanguageProviderSampleTest {
    @Test fun buildsTheCourseSectionsOfTheSample() {
        assertEquals(emptyList<String>(), LanguageCourseProvider.make(sampleSource).second)
        assertEquals(1, sample.course.sections.size)
        assertEquals(2, sample.course.units.size)
    }

    @Test fun groupsUnitsInSectionsInOrder() {
        val school = LanguageCourseProvider(
            LanguageDSL.parse(
                listOf(
                    "course: de", "title: Deutsch", "subtitle: Schulfach", "kind: school", "color: C46A55", "symbol: book.fill",
                    "section: Rechtschreibung", "unit: Das oder dass | s", "tip: Tipp", "fact: A? = a | b",
                    "section: Grammatik", "unit: Fälle | s", "tip: Tipp", "fact: B? = a | b", "unit: Zeiten | s", "tip: Tipp", "fact: C? = a | b",
                ).joinToString("\n"),
            ).data,
        )
        assertEquals(listOf("Rechtschreibung", "Grammatik"), school.course.sections.map { it.title })
        assertEquals(listOf(1, 2), school.course.sections.map { it.units.size })
        assertEquals(listOf(1, 2, 3), school.course.units.map { it.number })
    }

    @Test fun reportsTheContentProblemsThroughMake() {
        val source = listOf(
            "course: x", "title: X", "subtitle: s", "color: 336699", "symbol: globe", "unit: Eins | s", "tip: Tipp",
            "word: el coche = das Auto", "word: el auto = das Auto", "word: el coche = der Wagen", "word: a = b", "word: c = d",
            "word: e = f", "word: g = h", "sentence: Hola. = Hallo.", "sentence: Hola. = Hallo!",
        ).joinToString("\n")
        val problems = LanguageCourseProvider.make(source).second
        assertTrue(problems.any { it.contains("\"das Auto\" means both el coche and el auto") })
        assertTrue(problems.any { it.contains("el coche twice") })
        assertTrue(problems.any { it.contains("sentence twice: Hola.") })
    }

    @Test fun passesTheAudit() {
        assertEquals(emptyList<String>(), CourseAudit.problems(sample, seeds(1, 12)))
    }

    @Test fun givesTheSameLessonForTheSameSeedAndAnotherForAnotherSeed() {
        val node = nodeOf("sample.u01.l1")
        assertEquals(ex(node), ex(node))
        val variants = (1..10).map { s -> ex(node, s).joinToString(",") { it.id } }.toSet()
        assertTrue(variants.size > 3)
    }

    @Test fun mixesKindsInEveryLessonAndGoesFromEasyToHard() {
        for (node in sample.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            for (seed in 1..5) {
                val list = ex(node, seed)
                assertTrue("${node.id} seed $seed", list.map { it.kind }.toSet().size >= 3)
                assertEquals(ExerciseKind.MULTIPLE_CHOICE, list[0].kind)
            }
        }
    }

    @Test fun teachesALessonItsShareAndTheCheckpointTheWholeUnit() {
        val unit = sample.data.units[0]
        assertEquals("29 items, six per lesson", 5, sample.course.units[0].nodes.count { it.kind == NodeKind.LESSON })
        fun wordsOf(id: String): Set<String> {
            val seen = mutableSetOf<String>()
            val node = nodeOf(id)
            for (seed in 1..6) for (e in ex(node, seed)) unit.words.forEachIndexed { i, w -> if (e.id.contains("#w0-$i")) seen.add(w.target) }
            return seen
        }
        val first = wordsOf("sample.u01.l1")
        val last = wordsOf("sample.u01.l5")
        assertTrue(first.contains("hola"))
        assertFalse("the last words are for the last lessons", first.contains("tú"))
        assertTrue(last.contains("tú") || last.contains("el nombre"))
        assertFalse(last.contains("hola"))
        assertTrue("the checkpoint covers most of the unit", wordsOf("sample.u01.t").size > 8)
    }

    @Test fun meetsEveryWordInSeveralFormsAcrossTheUnit() {
        val unit = sample.data.units[0]
        unit.words.forEachIndexed { index, word ->
            val forms = mutableSetOf<Char>()
            for (node in sample.course.units[0].nodes) {
                if (node.kind == NodeKind.CHEST) continue
                for (seed in 1..3) for (e in ex(node, seed)) if (e.id.contains("#w0-$index")) forms.add(e.id.last())
            }
            assertTrue("${word.target}: $forms", forms.size >= 3)
        }
    }

    @Test fun neverMakesAWrongAnswerOfWordsAndSentencesAlsoRight() {
        val words = sample.data.units.flatMap { it.words }
        for (node in sample.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            for (seed in 1..6) {
                for (e in ex(node, seed)) {
                    if (e.kind != ExerciseKind.MULTIPLE_CHOICE) continue
                    if (!(e.id.contains("#w") || e.id.contains("#s"))) continue
                    val wrong = e.options.filter { it !in e.correctAnswers }
                    for (option in wrong) {
                        assertNotEquals("${e.id}: $option vs ${e.correctAnswers[0]}", AnswerCheck.Verdict.CORRECT, AnswerCheck.evaluate(option, e.correctAnswers[0]))
                    }
                    if (e.id.endsWith("a") && e.prompt.startsWith("Was bedeutet")) {
                        for (word in words) {
                            if (!e.prompt.contains("„${word.target}“")) continue
                            val mine = word.meanings.map { folded(it) }.toSet()
                            assertFalse(wrong.map { folded(it) }.any { it in mine })
                        }
                    }
                }
            }
        }
    }

    @Test fun isStrictAboutTypedAnswersInTheLanguageBeingLearned() {
        val node = nodeOf("sample.u02.t")
        val all = (1..40).flatMap { ex(node, it) }
        val exact = all.filter { it.kind == ExerciseKind.TYPE_ANSWER && it.mode == AnswerMode.EXACT }
        val word = exact.first { it.correctAnswers.size == 1 && it.correctAnswers[0] == "el hermano" }
        assertEquals(emptySet<String>(), missed(word, "El Hermano"))
        assertEquals("one letter is another word in Spanish", setOf(word.cardKeys[0]), missed(word, "el hermana"))
        val sentence = exact.first { it.correctAnswers.size == 1 && it.correctAnswers[0] in listOf("Me llamo Ana.", "Tengo un hermano.") }
        val right = sentence.correctAnswers[0]
        assertEquals(emptySet<String>(), missed(sentence, right.lowercase()))
        val reversed = right.split(" ").reversed().joinToString(" ")
        assertEquals("word order matters", setOf(sentence.cardKeys[0]), missed(sentence, reversed))
    }

    @Test fun offersListeningAndSpeechOnlyWithAVoice() {
        val node = nodeOf("sample.u01.p")
        val list = (1..6).flatMap { ex(node, it) }
        assertTrue(
            list.any {
                val m = it.media
                it.prompt.startsWith("Tippe auf den Lautsprecher") && m is ExerciseMedia.Speech && m.text == it.correctAnswers[0] && m.language == "es-ES"
            },
        )
        assertTrue(list.any { it.media is ExerciseMedia.Speech })
        val silent = LanguageCourseProvider.make(sampleSource.replace("speech: es-ES\n", "")).first
        assertNull(silent.data.speech)
        for (n in silent.course.nodes) {
            if (n.kind == NodeKind.CHEST) continue
            for (e in silent.exercises(n, 2uL)) {
                assertNull(e.media)
                assertFalse(e.prompt.startsWith("Tippe auf den Lautsprecher"))
            }
        }
        assertEquals(emptyList<String>(), CourseAudit.problems(silent, seeds(1, 3)))
    }

    @Test fun acceptsAlternativesAndForgivesAccentsAndTyposWhenTypedInTheKnownLanguage() {
        val node = nodeOf("sample.u01.t")
        var checked = 0
        for (seed in 1..30) {
            for (e in ex(node, seed)) {
                if (e.kind == ExerciseKind.TYPE_ANSWER && e.id.endsWith("e") && e.correctAnswers.size > 1) {
                    assertEquals(emptySet<String>(), missed(e, e.correctAnswers[1]))
                    checked++
                }
            }
        }
        assertTrue("adiós has two meanings and appears typed in some checkpoint", checked > 0)
        val pool = (1..60).flatMap { ex(node, it) }
        val typed = pool.first { it.kind == ExerciseKind.TYPE_ANSWER && it.correctAnswers[0] == "buenos días" }
        assertEquals("accents are forgiven", emptySet<String>(), missed(typed, "buenos dias"))
        assertEquals(setOf(typed.cardKeys[0]), missed(typed, "buenas noches"))
    }

    @Test fun choosesFormsFromTheirOwnVerbAndKeepsTheChoicesOfFills() {
        val lessons = sample.course.units[0].nodes.filter { it.kind == NodeKind.LESSON }
        val list = (1..8).flatMap { seed -> lessons.flatMap { ex(it, seed) } }
        val form = list.first { it.prompt.startsWith("Bilde die Form") && it.kind == ExerciseKind.MULTIPLE_CHOICE }
        assertTrue(form.options.joinToString(), form.options.all { it in listOf("soy", "eres", "es", "somos") })
        val fill = list.first { it.prompt.startsWith("Welches Wort fehlt") && it.kind == ExerciseKind.MULTIPLE_CHOICE }
        assertTrue(fill.solution.contains(fill.correctAnswers[0]) && !fill.solution.contains("___"))
    }

    @Test fun givesWordBankTilesWithoutPunctuationThatAcceptTheRightOrder() {
        val node = nodeOf("sample.u01.p")
        val banks = (1..20).flatMap { ex(node, it) }.filter { it.kind == ExerciseKind.WORD_BANK }
        assertTrue(banks.isNotEmpty())
        for (bank in banks) {
            assertTrue(bank.options.joinToString(), bank.options.all { !it.contains(".") && !it.contains("¿") && !it.contains("?") && !it.contains(",") })
            assertEquals(0, bank.missedKeys(LearnAnswer.Words(bank.correctAnswers)).size)
            assertNotEquals("", bank.solution)
        }
    }

    @Test fun matchesWordsToMeaningsInPairs() {
        val node = nodeOf("sample.u02.t")
        val pairs = (1..10).flatMap { ex(node, it) }.filter { it.kind == ExerciseKind.MATCH_PAIRS }
        assertTrue(pairs.isNotEmpty())
        val words = sample.data.units.flatMap { it.words }.associate { it.target to it.meanings[0] }
        for (e in pairs) {
            assertEquals(4, e.pairs.size)
            for (pair in e.pairs) assertEquals(words[pair.front], pair.back)
        }
    }

    @Test fun bringsEarlierUnitsBackInPractice() {
        val ids = (1..10).flatMap { ex(nodeOf("sample.u02.p"), it) }.map { it.id }
        assertTrue(ids.any { it.contains("#w0-") || it.contains("#s0-") })
        assertTrue(ids.any { it.contains("#w1-") || it.contains("#s1-") })
    }

    @Test fun hasNoExercisesForChestsAndUnknownNodes() {
        assertEquals(emptyList<LearnExercise>(), ex(nodeOf("sample.u01.k")))
        val stranger = CourseNode("sample.u09.l1", "sample", "sample.u09", 9, NodeKind.LESSON, 1, "x")
        assertEquals(emptyList<LearnExercise>(), ex(stranger))
    }
}

class LanguageVariantsTest {
    @Test fun asksAReadingCourseForNoFreeProduction() {
        val made = LanguageCourseProvider.make(latinSource)
        assertEquals(emptyList<String>(), made.second)
        val provider = made.first
        assertFalse(provider.data.produces)
        assertEquals(emptyList<String>(), CourseAudit.problems(provider, seeds(1, 6)))
        var forms = 0
        var translations = 0
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            for (seed in 1..6) {
                for (e in provider.exercises(node, seed.toULong())) {
                    assertFalse(e.prompt, e.prompt.startsWith("Wie sagt man"))
                    assertFalse(e.prompt, e.prompt.startsWith("Übersetze ins Lateinische"))
                    if (e.prompt.startsWith("Bilde die Form")) forms++
                    if (e.id.endsWith("f")) { translations++; assertEquals(AnswerMode.TEXT, e.mode) }
                    assertNull("no voice for Latin", e.media)
                }
            }
        }
        assertTrue(forms > 0)
        assertTrue(translations > 0)
    }

    @Test fun usesTheWordsGrammarNoteAsTheExplanation() {
        val provider = LanguageCourseProvider.make(latinSource).first
        val lesson = provider.course.node("la.u01.l1")!!
        val list = (1..10).flatMap { provider.exercises(lesson, it.toULong()) }
        val word = list.first { it.id.contains("#w0-0a") }
        assertEquals("puella · -ae f.", word.explanation)
    }

    @Test fun asksASchoolSubjectForTermsNotTranslations() {
        val made = LanguageCourseProvider.make(schoolSource)
        assertEquals(emptyList<String>(), made.second)
        val provider = made.first
        assertEquals(CourseKind.SCHOOL, provider.course.kind)
        assertEquals(emptyList<String>(), CourseAudit.problems(provider, seeds(1, 6)))
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            for (seed in 1..4) {
                for (e in provider.exercises(node, seed.toULong())) {
                    assertFalse("no typed definitions", e.id.endsWith("e") && e.kind == ExerciseKind.TYPE_ANSWER && e.id.contains("#w"))
                    assertFalse(e.prompt.contains("auf Deutsch"))
                }
            }
        }
    }

    @Test fun coverageFindsSentencesWithWordsNotTaughtYet() {
        val latin = LanguageCourseProvider.make(latinSource).first.data
        assertEquals(emptyList<CoverageGap>(), LanguageCoverage.gaps(latin))
        val gaps = LanguageCoverage.gaps(sample.data)
        assertTrue(gaps.isNotEmpty())
        assertTrue(gaps.any { it.sentence == "Me llamo Ana." && it.words.contains("llamo") })
        assertFalse(gaps.any { it.sentence == "No, gracias." })
        assertEquals(listOf("como", "te", "llamas"), LanguageCoverage.tokens("¿Cómo te llamas? 12"))
    }
}

// SkillFeedbackTests, language part
class LanguageAnswerAdviceTest {
    private fun advice(given: String, vararg expected: String) = LanguageAnswerAdvice.advice(given, expected.toList())

    @Test fun namesTheKindOfSlip() {
        assertNull(advice("el hermano", "el hermano"))
        assertNull(advice("El Hermano", "el hermano"))
        assertTrue(advice("el hermana", "el hermano")!!.contains("Endung"))
        assertEquals("Die Wörter stimmen, aber die Reihenfolge nicht.", advice("hermano el", "el hermano"))
        assertEquals("Es fehlt mindestens ein Wort.", advice("el", "el hermano"))
        assertEquals("Es sind zu viele Wörter.", advice("el hermano grande", "el hermano"))
        assertTrue(advice("el libro", "el hermano")!!.contains("Ein Wort stimmt nicht"))
        assertNull("two words wrong: no sure advice", advice("la casa", "el hermano"))
        assertNull(advice("  ", "el hermano"))
    }

    @Test fun givesAdviceOnlyForStrictTypedAnswers() {
        val strict = Exercises.typed(id = "x", prompt = "?", answer = "el hermano", mode = AnswerMode.EXACT)!!
        assertNotNull(sample.feedback(strict, LearnAnswer.Typed("el hermana")))
        val loose = Exercises.typed(id = "y", prompt = "?", answer = "Haus", mode = AnswerMode.TEXT)!!
        assertNull(sample.feedback(loose, LearnAnswer.Typed("Haus2")))
        assertNull(sample.feedback(strict, LearnAnswer.Option("el hermana")))
    }

    @Test fun tagsExercisesSoThatRecognisingAndProducingAreSeparate() {
        fun tag(id: String): SkillTag = sample.skillTag(
            LearnExercise(id = id, kind = ExerciseKind.MULTIPLE_CHOICE, prompt = "?", correctAnswers = listOf("a"), options = listOf("a", "b"), solution = "a"),
            sample.course.nodes[0],
        )
        assertEquals(SkillTag("vocab", CompetenceLevel.RECOGNISE), tag("n#w1-0a"))
        assertEquals(SkillTag("listening", CompetenceLevel.RECOGNISE), tag("n#w1-0c"))
        assertEquals(SkillTag("vocab", CompetenceLevel.RECALL), tag("n#w1-0d"))
        assertEquals(SkillTag("sentences", CompetenceLevel.APPLY), tag("n#s1-2b"))
        assertEquals(SkillTag("listening", CompetenceLevel.APPLY), tag("n#s1-2e"))
        assertEquals(SkillTag("grammar", CompetenceLevel.APPLY), tag("n#f1-0d"))
        assertEquals(SkillTag("grammar", CompetenceLevel.RECOGNISE), tag("n#g1-0a"))
        assertEquals(SkillTag("vocab", CompetenceLevel.RECOGNISE), tag("n#p1"))
        assertEquals(SkillTag("sentences", CompetenceLevel.RECOGNISE), tag("n#s1-2a"))
        assertEquals(SkillTag("sentences", CompetenceLevel.RECALL), tag("n#s1-2f"))
        assertEquals(SkillTag("grammar", CompetenceLevel.RECOGNISE), tag("n#q1-0a"))
    }
}

// SkillCoursesTests, language part
class LanguageSkillsTest {
    private val utc = calendar("UTC")
    private fun date(day: Int) = at(utc, 2026, 5, day, 10)
    private fun steps(p: LanguageCourseProvider) = p.course.nodes.filter { it.kind != NodeKind.CHEST }
    private val providers get() = Languages.all.all

    private fun outcomeOf(e: LearnExercise, right: Boolean = true): ExerciseOutcome? =
        e.level?.let { ExerciseOutcome(e.id, e.skill, it, right, false) }

    private fun outcomesOf(list: List<LearnExercise>, right: (LearnExercise) -> Boolean = { true }) =
        list.mapNotNull { outcomeOf(it, right(it)) }

    private fun perfectDay(provider: LanguageCourseProvider, day: Int, seed: Int, records: MutableMap<String, SkillRecord>) {
        val map = provider.skillMap()
        for (node in steps(provider)) {
            SkillAssessor.record(outcomesOf(provider.lessonExercises(node, seed.toULong())), node, map, records, date(day), utc)
        }
    }

    @Test fun givesEveryCourseASoundSkillMapWithASkillInEveryUnit() {
        for (provider in providers) {
            val map = provider.skillMap()
            assertEquals(provider.course.id, emptyList<String>(), map.problems())
            for (unit in provider.course.units) assertTrue("${provider.course.id} ${unit.id} has no skill", map.skillsInUnit(unit.id).isNotEmpty())
        }
    }

    @Test fun givesLanguageUnitsTheirOwnGoalsWithPrerequisites() {
        val map = Languages.es.skillMap()
        val first = map.skillsInUnit("es.u01")
        assertTrue(first.any { it.facet == "vocab" })
        assertEquals(listOf("es.u01.vocab"), first.firstOrNull { it.facet == "sentences" }?.prerequisites)
        assertEquals(listOf("es.u01.vocab"), map.skills.firstOrNull { it.id == "es.u02.vocab" }?.prerequisites)
    }

    @Test fun tagsEveryExerciseOfALanguageStepWithADeclaredGoal() {
        for (provider in providers) {
            val map = provider.skillMap()
            for (node in steps(provider)) for (seed in listOf(1uL, 2uL)) {
                for (e in provider.lessonExercises(node, seed)) {
                    assertNotEquals("${e.id} has no skill", "", e.skill)
                    assertNotNull(e.id, e.level)
                    assertNotNull("${e.id} -> ${e.skill}", map.skill(e.skill))
                }
            }
        }
    }

    @Test fun showsEveryLevelAGoalAsksForInItsSteps() {
        for (provider in providers) {
            val map = provider.skillMap()
            val seen = HashMap<String, MutableSet<CompetenceLevel>>()
            for (node in steps(provider)) for (seed in 1..2) {
                for (e in provider.lessonExercises(node, seed.toULong())) {
                    e.level?.let { seen.getOrPut(e.skill) { mutableSetOf() }.add(it) }
                }
            }
            for (skill in map.skills) for (level in skill.levels) {
                assertTrue("${skill.id} never asks at level $level", seen[skill.id]?.contains(level) ?: false)
            }
        }
    }

    @Test fun mastersEveryGoalOfEveryLanguageForAStudentWhoAnswersEverythingRightWithinAFewDays() {
        for (provider in providers) {
            val map = provider.skillMap()
            val records = LinkedHashMap<String, SkillRecord>()
            perfectDay(provider, 1, 1, records)
            perfectDay(provider, 2, 2, records)
            // Goals the path alone gives too few answers for get the rounds the advice would suggest.
            for (day in 2..5) {
                for (skill in map.skills) {
                    val status = SkillAssessor.status(records[skill.id], skill, emptySet(), date(day), utc)
                    if (status == SkillStatus.MASTERED) continue
                    val round = SkillPractice.exercises(provider, map, listOf(skill.id), records, (day * 100).toULong())
                    SkillAssessor.record(outcomesOf(round), null, map, records, date(day), utc)
                }
            }
            for (skill in map.skills) {
                val status = SkillAssessor.status(records[skill.id], skill, emptySet(), date(5), utc)
                assertTrue(
                    "${provider.course.id} ${skill.id} is $status: ${SkillAssessor.missing(records[skill.id] ?: SkillRecord(), skill)}",
                    status == SkillStatus.MASTERED,
                )
            }
        }
    }

    @Test fun neverMastersAnythingInOneDayAlone() {
        val provider = Languages.es
        val map = provider.skillMap()
        val records = LinkedHashMap<String, SkillRecord>()
        perfectDay(provider, 1, 1, records)
        perfectDay(provider, 1, 2, records)
        for (skill in map.skills) assertNotEquals(skill.id, SkillStatus.MASTERED, SkillAssessor.status(records[skill.id], skill, emptySet(), date(1), utc))
    }

    @Test fun neverReachesTypedGoalsForAStudentWhoOnlyChooses() {
        val provider = Languages.es
        val map = provider.skillMap()
        val records = LinkedHashMap<String, SkillRecord>()
        listOf(1, 2, 3).forEachIndexed { index, seed ->
            for (node in steps(provider)) {
                // Right where there is something to pick, wrong where something must be produced.
                val list = outcomesOf(provider.lessonExercises(node, seed.toULong())) { it.level == CompetenceLevel.RECOGNISE }
                SkillAssessor.record(list, node, map, records, date(1 + index), utc)
            }
        }
        for (skill in map.skills) {
            if (!skill.levels.any { it.isHigher(CompetenceLevel.RECOGNISE) }) continue
            val status = SkillAssessor.status(records[skill.id], skill, emptySet(), date(4), utc)
            assertFalse("${skill.id} is $status", status.isReached)
        }
    }

    @Test fun recommendsPractisingUnit1BeforeUnit2ForAStudentWhoDidItBadly() {
        val provider = Languages.es
        val map = provider.skillMap()
        val records = LinkedHashMap<String, SkillRecord>()
        val unit = provider.course.units[0]
        val completed = linkedSetOf<String>()
        for (node in unit.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            SkillAssessor.record(outcomesOf(provider.lessonExercises(node, 1uL)) { false }, node, map, records, date(1), utc)
            completed.add(node.id)
        }
        val units = CoursePath.units(provider.course, completed)
        val advice = SkillAdvisor.recommend(map, records, units, completed, date(1), utc)
        assertEquals(RecommendationKind.PRACTICE, advice.kind)
        assertTrue(advice.skillIDs.all { it.startsWith("es.u01.") })
    }
}

// SkillStoreTests / SkillAdvisorTests, Spanish parts
class LanguageSpanishSkillsTest {
    @Test fun buildsTheMapOfACourseOnce() {
        SkillMaps.clear()
        val first = SkillMaps.map(Languages.es)
        val second = SkillMaps.map(Languages.es)
        assertSame(second, first)
        assertEquals("es", first.courseID)
    }

    @Test fun makesAPracticeRoundOfOnlyTheTargetsExercisesRepeatable() {
        val map = Languages.es.skillMap()
        val target = "es.u01.vocab"
        val first = SkillPractice.exercises(Languages.es, map, listOf(target), emptyMap(), 5uL)
        assertTrue(first.isNotEmpty())
        assertTrue(first.size <= SkillPractice.size)
        assertTrue(first.any { it.skill == target })
        assertEquals("no exercise twice", first.size, first.map { it.id }.toSet().size)
        assertEquals(first, SkillPractice.exercises(Languages.es, map, listOf(target), emptyMap(), 5uL))
        assertNotEquals(first.map { it.id }, SkillPractice.exercises(Languages.es, map, listOf(target), emptyMap(), 6uL).map { it.id })
    }

    @Test fun asksAWeakLevelMoreOftenThanAStrongOne() {
        val map = Languages.es.skillMap()
        val target = map.skill("es.u01.vocab")!!
        val weakRecall = SkillRecord()
        weakRecall.tallies["recall"] = Tally(attempts = 8, right = 1, helped = 0, points = 2.0, recent = listOf(false, false, false, true, false, false, false, false))
        weakRecall.tallies["recognise"] = Tally(attempts = 8, right = 8, helped = 0, points = 8.0, recent = List(8) { true })
        var recall = 0
        var recognise = 0
        for (seed in 1..12) {
            for (e in SkillPractice.exercises(Languages.es, map, listOf(target.id), mapOf(target.id to weakRecall), seed.toULong())) {
                if (e.skill != target.id) continue
                if (e.level == CompetenceLevel.RECALL) recall++
                if (e.level == CompetenceLevel.RECOGNISE) recognise++
            }
        }
        val evenRecall = SkillPractice.weight(
            LearnExercise(id = "x", kind = ExerciseKind.TYPE_ANSWER, prompt = "", correctAnswers = listOf("a"), solution = "a", skill = target.id, level = CompetenceLevel.RECALL),
            mapOf(target.id to weakRecall), map,
        )
        val evenRecognise = SkillPractice.weight(
            LearnExercise(id = "y", kind = ExerciseKind.MULTIPLE_CHOICE, prompt = "", correctAnswers = listOf("a"), options = listOf("a", "b"), solution = "a", skill = target.id, level = CompetenceLevel.RECOGNISE),
            mapOf(target.id to weakRecall), map,
        )
        assertTrue(evenRecall > evenRecognise)
        assertTrue(recall + recognise > 0)
    }

    @Test fun makesNoRoundForAnUnknownTarget() {
        assertEquals(emptyList<LearnExercise>(), SkillPractice.exercises(Languages.es, Languages.es.skillMap(), listOf("nope"), emptyMap(), 1uL))
    }

    @Test fun theShippedProvidersAreInCourseOrderWithTheIdsOfTheirTexts() {
        assertEquals(listOf("es", "fr", "la", "daf", "de"), Languages.all.all.map { it.course.id })
        assertEquals(
            listOf(CourseKind.LANGUAGE, CourseKind.LANGUAGE, CourseKind.LANGUAGE, CourseKind.LANGUAGE, CourseKind.SCHOOL),
            Languages.all.all.map { it.course.kind },
        )
    }
}
