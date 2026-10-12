package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.ExerciseOutcome
import de.maxifrz.lernwerk.learn.skills.Skill
import de.maxifrz.lernwerk.learn.skills.SkillAdvisor
import de.maxifrz.lernwerk.learn.skills.SkillAssessor
import de.maxifrz.lernwerk.learn.skills.SkillMap
import de.maxifrz.lernwerk.learn.skills.SkillPractice
import de.maxifrz.lernwerk.learn.skills.SkillRecord
import de.maxifrz.lernwerk.learn.skills.SkillStatus
import de.maxifrz.lernwerk.learn.skills.SkillTag
import de.maxifrz.lernwerk.learn.skills.Tally
import de.maxifrz.lernwerk.learn.skills.TestOut
import de.maxifrz.lernwerk.learn.skills.standardLevel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

private val utc = calendar("UTC")
private val provider = SampleCourse()
private fun map(): SkillMap = provider.skillMap()

class SkillAssessorTest {
    private fun date(day: Int, hour: Int = 10) = at(utc, 2026, 3, day, hour)
    private fun skill(): Skill = map().skills[0]
    private fun node(): CourseNode = provider.course.nodes[0]

    private fun outcomes(prefix: String, count: Int, level: CompetenceLevel, right: Boolean = true, helped: Boolean = false) =
        (0 until count).map { ExerciseOutcome("$prefix$it", skill().id, level, right, helped) }

    private fun play(list: List<ExerciseOutcome>, day: Int, records: MutableMap<String, SkillRecord>) =
        SkillAssessor.record(list, node(), map(), records, date(day), utc)

    private fun status(records: Map<String, SkillRecord>, day: Int, completed: Set<String> = emptySet()) =
        SkillAssessor.status(records[skill().id], skill(), completed, date(day), utc)

    @Test fun theDefaultMapHasOneSkillPerUnitAndChainsThem() {
        val m = map()
        assertEquals(3, m.skills.size)
        assertEquals(emptyList<String>(), m.problems())
        assertEquals(emptyList<String>(), m.skills[0].prerequisites)
        assertEquals(listOf(m.skills[0].id), m.skills[1].prerequisites)
        assertEquals(listOf(m.skills[1].id), m.skills[2].prerequisites)
        assertEquals(listOf(m.skills[1].id), m.dependents(m.skills[0].id).map { it.id })
        assertEquals("Du beherrschst: s", m.skills[0].goal)
        assertEquals(listOf("sample.u01.l1", "sample.u01.l2", "sample.u01.l3", "sample.u01.p", "sample.u01.t"), m.skills[0].nodeIDs)
    }

    @Test fun aMapWithACycleOrAnUnknownPrerequisiteIsReported() {
        fun sk(id: String, prerequisites: List<String>, levels: List<CompetenceLevel> = listOf(CompetenceLevel.RECOGNISE), nodeIDs: List<String> = listOf("n")) =
            Skill(id, "c", "u", 1, "U", id, id.uppercase(), "", levels, prerequisites, nodeIDs)
        assertTrue(SkillMap("c", listOf(sk("a", listOf("b")), sk("b", listOf("a")))).problems().any { it.contains("cycle") })
        assertTrue(SkillMap("c", listOf(sk("c", listOf("zzz")))).problems().any { it.contains("unknown prerequisite") })
        val d = sk("d", listOf("d"), emptyList(), emptyList())
        val found = SkillMap("c", listOf(d, d)).problems()
        for (p in listOf("duplicate skill ids", "d: no levels", "d: no steps", "d: needs itself")) assertTrue(p, p in found)
    }

    @Test fun anUntouchedSkillAndABegunLessonAreNotWorked() {
        val records = mutableMapOf<String, SkillRecord>()
        assertEquals(SkillStatus.NOT_STARTED, status(records, 1))
        SkillAssessor.begin(node(), map(), records)
        assertEquals(SkillStatus.STARTED, status(records, 1))
    }

    @Test fun aFinishedLessonWithoutAnswersIsOnlyWorked() {
        val records = mutableMapOf<String, SkillRecord>()
        play(emptyList(), 1, records)
        assertEquals(SkillStatus.WORKED, status(records, 1))
        // A lesson finished before skills existed counts as worked, never as more.
        assertEquals(SkillStatus.WORKED, status(emptyMap(), 1, setOf(node().id)))
    }

    @Test fun clickingThroughChoicesNeverReachesASkillThatAsksForTyping() {
        val records = mutableMapOf<String, SkillRecord>()
        for (round in 0 until 6) play(outcomes("r$round-", 12, CompetenceLevel.RECOGNISE), 1 + round, records)
        assertNotEquals(SkillStatus.PROVISIONAL, status(records, 8))
        assertNotEquals(SkillStatus.MASTERED, status(records, 8))
        assertTrue(SkillAssessor.missing(records.getValue(skill().id), skill()).isNotEmpty())
        assertTrue(SkillAssessor.missing(records.getValue(skill().id), skill()).any { it.contains("getippt") })
    }

    @Test fun oneRoundCannotAddMoreThanTheCap() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("big", 40, CompetenceLevel.RECALL), 1, records)
        assertTrue(records.getValue(skill().id).tally(CompetenceLevel.RECALL).points <= SkillAssessor.pointsPerRound)
    }

    @Test fun hintsHalveThePointsAndWrongAnswersGiveNone() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("h", 4, CompetenceLevel.RECALL, helped = true) + outcomes("w", 4, CompetenceLevel.RECALL, right = false), 1, records)
        val tally = records.getValue(skill().id).tally(CompetenceLevel.RECALL)
        assertEquals(4.0, tally.points, 1e-4)
        assertEquals(0, tally.right) // an answer with a hint is not a clean first try
        assertEquals(8, tally.attempts)
    }

    @Test fun recognisingAndTypingReachesProvisionallyAndAnotherDayMastersIt() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 6, CompetenceLevel.RECOGNISE) + outcomes("b", 4, CompetenceLevel.RECALL), 1, records)
        assertEquals(SkillStatus.PROVISIONAL, status(records, 1))
        assertEquals(listOf("Es fehlt noch eine gute Runde an einem anderen Tag."), SkillAssessor.missing(records.getValue(skill().id), skill()))
        // The next day the review is due; a good round confirms it.
        assertEquals(SkillStatus.DUE, status(records, 2))
        play(outcomes("c", 5, CompetenceLevel.RECOGNISE) + outcomes("d", 3, CompetenceLevel.RECALL), 2, records)
        assertEquals(SkillStatus.MASTERED, status(records, 2))
        assertEquals(SkillStatus.MASTERED, status(records, 5))
        assertEquals(SkillStatus.DUE, status(records, 9)) // six days later the review is due again
    }

    @Test fun aSecondRoundOnTheSameDayDoesNotPushTheReviewAway() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 6, CompetenceLevel.RECOGNISE) + outcomes("b", 4, CompetenceLevel.RECALL), 1, records)
        val after = records.getValue(skill().id)
        play(outcomes("c", 6, CompetenceLevel.RECOGNISE) + outcomes("d", 4, CompetenceLevel.RECALL), 1, records)
        assertEquals(after.repetitions, records.getValue(skill().id).repetitions)
        assertEquals(after.dueDay, records.getValue(skill().id).dueDay)
        assertEquals(0, records.getValue(skill().id).confirmations)
    }

    @Test fun aBadRoundAfterMasteryTakesItAway() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 6, CompetenceLevel.RECOGNISE) + outcomes("b", 4, CompetenceLevel.RECALL), 1, records)
        play(outcomes("c", 5, CompetenceLevel.RECOGNISE) + outcomes("d", 3, CompetenceLevel.RECALL), 2, records)
        assertEquals(SkillStatus.MASTERED, status(records, 3))
        play(outcomes("e", 6, CompetenceLevel.RECALL, right = false), 9, records)
        assertEquals(1, records.getValue(skill().id).lapses)
        assertNull(records.getValue(skill().id).provisionalDay)
        assertEquals(SkillStatus.PRACTICING, status(records, 9))
    }

    @Test fun theSameExerciseInOneRoundCountsOnce() {
        val records = mutableMapOf<String, SkillRecord>()
        val one = outcomes("x", 1, CompetenceLevel.RECALL)
        play(one + one + one, 1, records)
        assertEquals(1, records.getValue(skill().id).attempts)
    }

    @Test fun outcomesForUnknownSkillsAreIgnored() {
        val records = mutableMapOf<String, SkillRecord>()
        play(listOf(ExerciseOutcome("s", "nowhere.u1.main", CompetenceLevel.RECALL, right = true, helped = false)), 1, records)
        assertNull(records["nowhere.u1.main"])
    }

    @Test fun aMiddlingRoundNeitherConfirmsNorUndoes() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 6, CompetenceLevel.RECOGNISE) + outcomes("b", 4, CompetenceLevel.RECALL), 1, records)
        // Seven of ten right on the next day: a "hard", which is no confirmation.
        play(outcomes("c", 7, CompetenceLevel.RECALL) + outcomes("d", 3, CompetenceLevel.RECALL, right = false), 2, records)
        assertEquals(0, records.getValue(skill().id).confirmations)
        assertNotNull(records.getValue(skill().id).provisionalDay)
    }

    @Test fun recordsSurviveEncodingAndTolerateMissingFields() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 6, CompetenceLevel.RECOGNISE) + outcomes("b", 4, CompetenceLevel.RECALL), 1, records)
        val p = SkillProgress()
        p.records = records
        assertEquals(records, SkillProgress.fromJson(parseJsonOrNull(p.toJson().toString())).records)
        assertEquals(SkillRecord(), SkillRecord.fromJson(parseJsonOrNull("{}")))
        assertEquals(emptyMap<String, SkillRecord>(), SkillProgress.fromJson(parseJsonOrNull("""{"records":5}""")).records)
        val partial = SkillRecord.fromJson(parseJsonOrNull("""{"lapses":2}"""))
        assertEquals(0, partial.schedule.lapses) // an old shape without a schedule falls back on the default
        val scheduled = SkillRecord.fromJson(parseJsonOrNull("""{"schedule":{"lapses":2,"ease":0.1}}"""))
        assertEquals(2, scheduled.schedule.lapses)
        assertEquals(1.3, scheduled.schedule.ease, 1e-4)
    }

    @Test fun weakLevelsNameWhatToPractise() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 6, CompetenceLevel.RECOGNISE) + outcomes("b", 4, CompetenceLevel.RECALL, right = false), 1, records)
        assertEquals(listOf(CompetenceLevel.RECALL), SkillAssessor.weakLevels(records.getValue(skill().id), skill()))
        assertEquals(listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.RECALL), SkillAssessor.weakLevels(null, skill()))
    }

    // Extra cases
    @Test fun theConstantsAndTheSentencesAreThoseOfTheSwiftCode() {
        assertEquals(listOf(4.0, 10.0, 8.0), listOf(SkillAssessor.recognitionCapWithHigherLevels, SkillAssessor.recognitionCapAlone, SkillAssessor.pointsForReached))
        assertEquals(listOf(2.0, 4.0), listOf(SkillAssessor.pointsPerHigherLevel, SkillAssessor.pointsForPractising))
        assertEquals(8, SkillAssessor.attemptsForReached)
        assertEquals(listOf(0.75, 12.0, 0.7), listOf(SkillAssessor.accuracyForReached, SkillAssessor.pointsPerRound, SkillAssessor.weakAccuracy))
        assertEquals(3, SkillAssessor.answersForSession)
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 9, CompetenceLevel.RECOGNISE, right = false), 1, records)
        val wide = skill().copy(levels = listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.RECALL, CompetenceLevel.APPLY))
        assertEquals(
            listOf(
                "Es fehlen noch richtige Antworten ohne Hilfe.",
                "Du hast noch zu wenig aus dem Kopf getippt, ohne Auswahl.",
                "Du hast es noch zu selten selbst angewendet.",
                "In den letzten Antworten waren noch zu viele Fehler oder Hinweise.",
            ),
            SkillAssessor.missing(records.getValue(skill().id), wide),
        )
        assertEquals(
            listOf("Noch nicht begonnen", "Begonnen", "Bearbeitet", "Geübt", "Vorläufig erreicht", "Beherrscht", "Wiederholung fällig"),
            SkillStatus.values().map { it.title },
        )
        assertEquals(
            listOf(true, true, true, false, false),
            listOf(SkillStatus.PROVISIONAL, SkillStatus.MASTERED, SkillStatus.DUE, SkillStatus.WORKED, SkillStatus.PRACTICING).map { it.isReached },
        )
        assertEquals(listOf("Wiedererkennen", "Abrufen", "Anwenden"), CompetenceLevel.values().map { it.title })
        assertEquals(CompetenceLevel.RECALL, ExerciseKind.TYPE_ANSWER.standardLevel)
    }

    @Test fun recognisingAloneMayCountUpToTenPointsWithHigherLevelsOnlyFour() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 12, CompetenceLevel.RECOGNISE), 1, records)
        val only = skill().copy(levels = listOf(CompetenceLevel.RECOGNISE))
        val wide = skill().copy(levels = listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.RECALL))
        assertEquals(10.0, SkillAssessor.points(records.getValue(skill().id), only), 0.0)
        assertEquals(4.0, SkillAssessor.points(records.getValue(skill().id), wide), 0.0)
        assertEquals(0.5, Tally(recent = listOf(true, false)).recentAccuracy!!, 0.0)
        assertNull(Tally().recentAccuracy)
    }

    @Test fun daysAndRecentAnswersAreCapped() {
        val records = mutableMapOf<String, SkillRecord>()
        for (day in 1..25) play(outcomes("d$day-", 3, CompetenceLevel.RECALL), day, records)
        assertEquals(10, records.getValue(skill().id).recent.size)
        assertEquals(8, records.getValue(skill().id).tally(CompetenceLevel.RECALL).recent.size)
        assertEquals(25, records.getValue(skill().id).days.size)
        assertTrue(node().id in records.getValue(skill().id).worked)
    }

    @Test fun aStepFinishedWithNoAnswerForASkillCountsAsWorkedOnEverySkillItBelongsTo() {
        val records = mutableMapOf<String, SkillRecord>()
        play(outcomes("a", 3, CompetenceLevel.RECALL), 1, records)
        val m = map()
        assertTrue(node().id in records.getValue(m.skills[0].id).worked)
        assertNull(records[m.skills[1].id]) // the node belongs to unit 1 only
    }

    @Test fun theTolerantDecoderIsStrictWhereSwiftIsSynthesized() {
        // A tally without all keys makes the whole tallies field fall back on empty.
        val r = SkillRecord.fromJson(parseJsonOrNull("""{"tallies":{"recall":{"attempts":1}},"recent":[true,false],"answersToday":-4}"""))
        assertEquals(emptyMap<String, Tally>(), r.tallies)
        assertEquals(listOf(true, false), r.recent)
        assertEquals(0, r.answersToday)
        val ok = SkillRecord.fromJson(parseJsonOrNull("""{"tallies":{"recall":{"attempts":1,"right":1,"helped":0,"points":2,"recent":[true]}}}"""))
        assertEquals(2.0, ok.tally(CompetenceLevel.RECALL).points, 0.0)
        assertEquals(emptyMap<String, SkillRecord>(), SkillProgress.fromJson(parseJsonOrNull("""{"records":{"a":5}}""")).records)
        assertEquals(emptyMap<String, SkillRecord>(), SkillProgress.fromJson(parseJsonOrNull("\"x\"")).records)
    }
}

class SkillAdvisorTest {
    private fun date(day: Int) = at(utc, 2026, 4, day, 9)
    private fun outcomes(skill: Skill, prefix: String, recognise: Int, recall: Int, right: Boolean = true) =
        (0 until recognise).map { ExerciseOutcome("${prefix}r$it", skill.id, CompetenceLevel.RECOGNISE, right, false) } +
            (0 until recall).map { ExerciseOutcome("${prefix}t$it", skill.id, CompetenceLevel.RECALL, right, false) }

    private fun advice(records: Map<String, SkillRecord>, completed: Set<String>, day: Int) =
        SkillAdvisor.recommend(map(), records, CoursePath.units(provider.course, completed), completed, date(day), utc)

    @Test fun aFreshCourseSuggestsItsFirstStep() {
        val result = advice(emptyMap(), emptySet(), 1)
        assertEquals(de.maxifrz.lernwerk.learn.skills.RecommendationKind.STEP, result.kind)
        assertEquals("sample.u01.l1", result.step?.id)
        assertEquals("Weiter mit Lektion 1 · Einheit 1", result.title)
        assertEquals("Der nächste Schritt auf deinem Pfad.", result.reason)
    }

    @Test fun aReachedSkillThatIsDueIsSuggestedBeforeTheNextStep() {
        val records = mutableMapOf<String, SkillRecord>()
        val first = map().skills[0]
        SkillAssessor.record(outcomes(first, "a", 6, 4), provider.course.nodes[0], map(), records, date(1), utc)
        val completed = setOf(provider.course.nodes[0].id)
        val result = advice(records, completed, 2)
        assertEquals(de.maxifrz.lernwerk.learn.skills.RecommendationKind.REVIEW, result.kind)
        assertEquals(listOf(first.id), result.skillIDs)
        assertEquals("Wiederholen: Einheit 1", result.title)
        assertEquals("Das hast du schon gekonnt. Jetzt festigst du es.", result.reason)
        assertEquals(de.maxifrz.lernwerk.learn.skills.RecommendationKind.STEP, advice(records, completed, 1).kind) // not due on the day it was reached
    }

    @Test fun aShakyPrerequisiteIsPractisedBeforeTheUnitThatBuildsOnIt() {
        val records = mutableMapOf<String, SkillRecord>()
        val first = map().skills[0]
        val unit = provider.course.units[0]
        val completed = mutableSetOf<String>()
        for (n in unit.nodes) {
            if (n.kind == NodeKind.CHEST) continue
            SkillAssessor.record(outcomes(first, n.id, 4, 2, false), n, map(), records, date(1), utc)
            completed.add(n.id)
        }
        val result = advice(records, completed, 1)
        assertEquals(de.maxifrz.lernwerk.learn.skills.RecommendationKind.PRACTICE, result.kind)
        assertEquals(listOf(first.id), result.skillIDs)
        assertNotNull(result.step) // the path itself stays open
        assertEquals("Üben: Einheit 1", result.title) // the chest of unit 1 is still open: the rule for a finished unit's weak skill
        // With the chest opened the next step is in unit 2, which builds on the weak goal.
        completed.add("sample.u01.k")
        val next = advice(records, completed, 1)
        assertEquals(de.maxifrz.lernwerk.learn.skills.RecommendationKind.PRACTICE, next.kind)
        assertEquals("Erst festigen: Einheit 1", next.title)
        assertEquals("Die nächste Lektion baut darauf auf, und es klappt noch nicht sicher.", next.reason)
        assertEquals("sample.u02.l1", next.step?.id)
    }

    @Test fun aFinishedCourseWithNothingDueSaysSo() {
        val all = provider.course.nodes.map { it.id }.toSet()
        val result = advice(emptyMap(), all, 1)
        assertEquals(de.maxifrz.lernwerk.learn.skills.RecommendationKind.FINISHED, result.kind)
        assertEquals("Kurs geschafft", result.title)
    }

    @Test fun theMostOverdueSkillComesFirstAndAtMostThreeAreNamed() {
        val records = mutableMapOf<String, SkillRecord>()
        map().skills.forEachIndexed { index, skill ->
            SkillAssessor.record(outcomes(skill, "s$index", 6, 4), null, map(), records, date(1 + index), utc)
        }
        val result = advice(records, emptySet(), 9)
        assertEquals(de.maxifrz.lernwerk.learn.skills.RecommendationKind.REVIEW, result.kind)
        assertEquals(map().skills[0].id, result.skillIDs[0])
        assertTrue(result.skillIDs.size <= SkillAdvisor.mostSkillsPerRound)
        assertEquals("Das hast du schon gekonnt. Jetzt festigst du es, bevor es verblasst.", result.reason)
    }

    @Test fun aSkillOfAFinishedUnitThatWentBadlyIsPractised() {
        // The unit's steps are all done but the next unit is not started: rule 3 when rule 2 finds nothing to build on.
        val records = mutableMapOf<String, SkillRecord>()
        val third = map().skills[2]
        val completed = provider.course.nodes.filter { it.unitNumber < 4 }.map { it.id }.toSet()
        for (n in provider.course.units[2].nodes) if (n.kind != NodeKind.CHEST) SkillAssessor.record(outcomes(third, n.id, 4, 2, false), n, map(), records, date(1), utc)
        val units = CoursePath.units(provider.course, completed)
        val result = SkillAdvisor.recommend(map(), records, units, completed, date(1), utc)
        assertEquals(de.maxifrz.lernwerk.learn.skills.RecommendationKind.PRACTICE, result.kind)
        assertEquals("Üben: Einheit 3", result.title)
        assertEquals("Die Lektionen sind durch, aber die Antworten sind noch nicht sicher.", result.reason)
    }

    @Test fun stepTitles() {
        val units = CoursePath.units(provider.course, emptySet())
        fun step(id: String) = units[0].steps.first { it.id == id }
        assertEquals("der Übungsrunde · Einheit 1", SkillAdvisor.stepTitle(step("sample.u01.p"), units))
        assertEquals("dem Einheitentest · Einheit 1", SkillAdvisor.stepTitle(step("sample.u01.t"), units))
        assertEquals("der Truhe · Einheit 1", SkillAdvisor.stepTitle(step("sample.u01.k"), units))
        assertEquals("Lektion 1", SkillAdvisor.stepTitle(step("sample.u01.l1"), emptyList()))
    }
}

// Practice rounds: the Swift tests use the Spanish course; here a provider that tags its exercises by kind.
open class RichProvider : CourseProvider {
    override val course = Course(
        "rich", "Rich", "", CourseKind.LANGUAGE, 0, "x",
        listOf(CourseSection("rich.a", "A", listOf(CourseUnit.standard("rich", 1, "Eins", "s", "t"), CourseUnit.standard("rich", 2, "Zwei", "s", "t")))),
    )

    override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
        if (node.kind == NodeKind.CHEST) return emptyList()
        val rng = LearnRandom(Exercises.seed(node, seed))
        val list = mutableListOf<LearnExercise?>()
        for (i in 0 until 6) list.add(Exercises.choice(id = "${node.id}#c$i", prompt = "?", correct = "A", wrong = listOf("B", "C"), random = rng))
        for (i in 0 until 4) list.add(Exercises.typed(id = "${node.id}#t$i", prompt = "?", answer = "A"))
        return Exercises.arrange(list)
    }
}

class SkillPracticeTest {
    private val rich = RichProvider()
    private val richMap = rich.skillMap()
    private val target = richMap.skills[0].id

    @Test fun aRoundHoldsOnlyExercisesOfTheTargetsAndIsRepeatable() {
        val first = SkillPractice.exercises(rich, richMap, listOf(target), emptyMap(), 5uL)
        assertTrue(first.isNotEmpty())
        assertTrue(first.size <= SkillPractice.size)
        assertTrue(first.any { it.skill == target })
        assertEquals(first.size, first.map { it.id }.toSet().size) // no exercise twice
        assertEquals(first, SkillPractice.exercises(rich, richMap, listOf(target), emptyMap(), 5uL))
        assertNotEquals(first.map { it.id }, SkillPractice.exercises(rich, richMap, listOf(target), emptyMap(), 6uL).map { it.id })
        val difficulties = first.map { if (it.kind == ExerciseKind.TYPE_ANSWER) 3 else 0 }
        assertEquals(difficulties.sorted(), difficulties)
    }

    @Test fun aWeakLevelIsAskedMoreOftenThanAStrongOne() {
        val weak = SkillRecord()
        weak.tallies["recall"] = Tally(8, 1, 0, 2.0, listOf(false, false, false, true, false, false, false, false))
        weak.tallies["recognise"] = Tally(8, 8, 0, 8.0, List(8) { true })
        val records = mapOf(target to weak)
        val recall = LearnExercise(id = "x", kind = ExerciseKind.TYPE_ANSWER, prompt = "", correctAnswers = listOf("a"), solution = "a", skill = target, level = CompetenceLevel.RECALL)
        val recognise = LearnExercise(id = "y", kind = ExerciseKind.MULTIPLE_CHOICE, prompt = "", correctAnswers = listOf("a"), options = listOf("a", "b"), solution = "a", skill = target, level = CompetenceLevel.RECOGNISE)
        assertEquals(3.0, SkillPractice.weight(recall, records, richMap), 0.0)
        assertEquals(0.5, SkillPractice.weight(recognise, records, richMap), 0.0)
        assertEquals(2.0, SkillPractice.weight(recognise, emptyMap(), richMap), 0.0)
        assertEquals(1.0, SkillPractice.weight(LearnExercise(id = "z", kind = ExerciseKind.TYPE_ANSWER, prompt = "", correctAnswers = listOf("a"), solution = "a"), records, richMap), 0.0)
        assertEquals(2.0, SkillPractice.weight(recall, mapOf(target to SkillRecord()), richMap), 0.0)
        var recalls = 0
        var recognises = 0
        for (seed in 1uL..12uL) {
            for (e in SkillPractice.exercises(rich, richMap, listOf(target), records, seed)) {
                if (e.skill != target) continue
                if (e.level == CompetenceLevel.RECALL) recalls += 1
                if (e.level == CompetenceLevel.RECOGNISE) recognises += 1
            }
        }
        assertTrue(recalls + recognises > 0)
    }

    @Test fun anUnknownTargetMakesNoRound() {
        assertEquals(emptyList<LearnExercise>(), SkillPractice.exercises(rich, richMap, listOf("nope"), emptyMap(), 1uL))
    }

    @Test fun aGoalWithFewExercisesGetsCompanyFromTheSameUnits() {
        val thin = object : RichProvider() {
            override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
                if (node.kind != NodeKind.LESSON) return emptyList()
                return listOf(
                    Exercises.typed(id = "${node.id}#a", prompt = "?", answer = "A")!!,
                    Exercises.typed(id = "${node.id}#b", prompt = "?", answer = "A")!!,
                )
            }
        }
        val thinMap = thin.skillMap()
        val round = SkillPractice.exercises(thin, thinMap, listOf(thinMap.skills[0].id), emptyMap(), 3uL)
        assertEquals(6, round.size) // three lessons with two each: all of them
    }

    @Test fun lessonExercisesTagByKindAndDropAFacetTheUnitDoesNotDeclare() {
        val tagged = rich.lessonExercises(rich.course.nodes[0], 1uL)
        assertTrue(tagged.all { it.skill == "rich.u01.main" })
        assertTrue(tagged.filter { it.kind == ExerciseKind.TYPE_ANSWER }.all { it.level == CompetenceLevel.RECALL })
        assertTrue(tagged.filter { it.kind == ExerciseKind.MULTIPLE_CHOICE }.all { it.level == CompetenceLevel.RECOGNISE })
        val odd = object : CourseProvider {
            override val course = provider.course
            override fun exercises(node: CourseNode, seed: ULong) = listOf(Exercises.typed(id = "${node.id}#a", prompt = "?", answer = "x")!!)
            override fun skillTag(exercise: LearnExercise, node: CourseNode) = SkillTag("ghost", CompetenceLevel.RECALL)
        }
        val list = odd.lessonExercises(provider.course.nodes[0], 1uL)
        assertEquals("", list[0].skill)
        assertNull(list[0].level)
    }

    @Test fun theDefaultMethodsAnswerEverything() {
        assertEquals("main", rich.skillFacets(rich.course.units[0])[0].key)
        assertEquals(2, rich.skillMap().skills.size)
        assertNull(rich.feedback(LearnExercise(id = "a", kind = ExerciseKind.TYPE_ANSWER, prompt = "", correctAnswers = listOf("a"), solution = "a"), LearnAnswer.Typed("b")))
        assertTrue(rich.lessonExercises(rich.course.nodes[0], 1uL).isNotEmpty())
    }
}

class TestOutTest {
    @Test fun onlyAnUntouchedFrontierUnitCanBeTestedOut() {
        val fresh = CoursePath.units(provider.course, emptySet())
        assertEquals("sample.u01", TestOut.candidate(fresh)?.unit?.id)
        val started = CoursePath.units(provider.course, setOf("sample.u01.l1"))
        assertNull(TestOut.candidate(started))
        val firstDone = provider.course.units[0].nodes.map { it.id }.toSet()
        assertEquals("sample.u02", TestOut.candidate(CoursePath.units(provider.course, firstDone))?.unit?.id)
        assertNull(TestOut.candidate(CoursePath.units(provider.course, provider.course.nodes.map { it.id }.toSet())))
    }

    @Test fun passingNeedsEnoughExercisesAndAccuracy() {
        fun result(count: Int, right: Int) = LessonResult("t", "s", count, right, 0)
        assertTrue(TestOut.passed(result(14, 12)))
        assertFalse(TestOut.passed(result(14, 11)))
        assertFalse(TestOut.passed(result(5, 5))) // a short round proves nothing
    }

    @Test fun aPassMarksEverythingButTheChest() {
        val unit = provider.course.units[0]
        val nodes = TestOut.nodesToComplete(unit)
        val chests = unit.nodes.filter { it.kind == NodeKind.CHEST }.map { it.id }.toSet()
        assertTrue(chests.isNotEmpty())
        assertFalse(nodes.any { it in chests })
        assertEquals(unit.nodes.size - chests.size, nodes.size)
    }
}

class SkillStoreTest {
    private fun now(day: Int) = at(utc, 2026, 6, day, 8)

    @Test fun whatWasRecordedIsThereAfterARestart() {
        val storage = MemoryStore()
        val m = map()
        val skill = m.skills[0]
        val node = provider.course.nodes[0]
        val store = SkillStore(storage)
        store.begin(node, m)
        val list = (0 until 10).map { ExerciseOutcome("e$it", skill.id, if (it < 6) CompetenceLevel.RECOGNISE else CompetenceLevel.RECALL, right = true, helped = false) }
        store.record(list, node, m, now(1), utc)

        val restarted = SkillStore(storage)
        assertEquals(store.records, restarted.records)
        assertEquals(SkillStatus.PROVISIONAL, SkillAssessor.status(restarted.records[skill.id], skill, emptySet(), now(1), utc))
        // And the review plan survives it: due the next day.
        assertEquals(SkillStatus.DUE, SkillAssessor.status(restarted.records[skill.id], skill, emptySet(), now(2), utc))
        assertEquals("learn.skills", SkillStore.key)
    }

    @Test fun brokenDataStartsEmptyInsteadOfCrashing() {
        val storage = MemoryStore()
        storage.set(SkillStore.key, "not json")
        assertEquals(0, SkillStore(storage).records.size)
    }

    @Test fun recordsOfSkillsThatNoLongerExistAreHarmless() {
        val storage = MemoryStore()
        val progress = SkillProgress()
        progress.records["gone.u01.main"] = SkillRecord()
        storage.set(SkillStore.key, progress.toJson().toString())
        val store = SkillStore(storage)
        val m = map()
        assertNull(m.skill("gone.u01.main"))
        store.record(emptyList(), provider.course.nodes[0], m, now(1), utc)
        assertNotNull(store.records["gone.u01.main"])
    }

    @Test fun theMapOfACourseIsBuiltOnce() {
        SkillMaps.clear()
        val first = SkillMaps.map(provider)
        val second = SkillMaps.map(provider)
        assertSame(first, second)
        assertEquals("sample", first.courseID)
    }
}
