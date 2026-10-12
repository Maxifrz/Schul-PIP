package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.Skill
import de.maxifrz.lernwerk.learn.skills.SkillAssessor
import de.maxifrz.lernwerk.learn.skills.SkillPractice
import de.maxifrz.lernwerk.learn.skills.SkillRecord
import de.maxifrz.lernwerk.learn.skills.SkillStatus
import de.maxifrz.lernwerk.learn.skills.TestOut

// The controller logic of the lesson screen that is not drawing: what the student has picked or typed for the current
// exercise (`LessonModel`), and what happens around a lesson (`LearnController`): starting a step, a practice round or
// a unit test, opening a chest, and recording a finished round into progress, skills and quests.
// A port of LessonModel.swift and of the logic in LearnHomeView.swift. The clock, the calendar and the seeds are injected.
//
// Not ported: lessons made from flashcards (the card-based LessonModel init and the grading of due cards).

/** What a finished lesson brought besides XP, for the end screen. */
data class LessonRewards(
    val gems: Int = 0,
    /** The titles of the quests this lesson completed. */
    val quests: List<String> = emptyList(),
    /** Streak freezes that covered skipped days with this lesson. */
    val freezesUsed: Int = 0,
    val streakExtended: Boolean = false,
    /** Things worth saying in a sentence: a unit skipped, a test not passed. */
    val notes: List<String> = emptyList(),
)

sealed class PairOutcome {
    object Match : PairOutcome() { override fun toString() = "Match" }
    object Miss : PairOutcome() { override fun toString() = "Miss" }
    data class Finished(val verdict: LearnVerdict) : PairOutcome()
}

/** A front and a back that were paired wrongly, shown red until the next tap. */
data class PairMiss(val key: String, val back: Int)

typealias CoachFunction = (LearnExercise, LearnAnswer) -> String?

/**
 * The lesson on screen: the session plus what the student has picked, put together or typed for the current
 * exercise. All of it lives in this one object, so turning the device or showing the keyboard keeps every choice.
 */
class LessonModel(
    lessonID: String,
    exercises: List<LearnExercise>,
    sessionID: String,
    /** Asked for a wrong answer; set by whoever opened a lesson of a course. */
    private val coach: CoachFunction? = null,
    /** The lesson's cards, for rounds made of flashcards; courses have none. */
    cardKeys: List<String> = emptyList(),
) {
    val session = LessonSession(lessonID, cardKeys, exercises, sessionID)
    var typed = ""
    var choice: String? = null

    /** Chess: the square of the piece to move, then the square to move it to. */
    var moveFrom: String? = null
    var moveTo: String? = null

    /** Word bank: positions in the options, in the order tapped. */
    var tiles: MutableList<Int> = mutableListOf()
    var matched: MutableSet<String> = LinkedHashSet()
    var matchedBacks: MutableSet<Int> = LinkedHashSet()
    var pickedFront: String? = null
    var pickedBack: Int? = null
    var lastMiss: PairMiss? = null

    /** Why the last wrong answer was wrong, when the course can tell; empty otherwise. */
    var coachNote = ""

    /** Pairs: the cards whose front was paired with a wrong back. */
    private var missed: MutableSet<String> = LinkedHashSet()
    private var reported = false

    val current: LearnExercise? get() = session.current
    val isAnswering: Boolean get() = session.phase == LessonPhase.Answering
    val verdict: LearnVerdict? get() = (session.phase as? LessonPhase.Feedback)?.verdict

    val canCheck: Boolean
        get() {
            val exercise = current
            if (!isAnswering || exercise == null) return false
            return when (exercise.kind) {
                ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.PIANO_KEY -> choice != null
                ExerciseKind.CHESS_MOVE -> moveFrom != null && moveTo != null
                ExerciseKind.TYPE_ANSWER -> typed.trimWs().isNotEmpty()
                ExerciseKind.WORD_BANK -> tiles.isNotEmpty()
                ExerciseKind.MATCH_PAIRS -> false
            }
        }

    fun check(): LearnVerdict? {
        val exercise = current
        if (!canCheck || exercise == null) return null
        val answer: LearnAnswer = when (exercise.kind) {
            ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.PIANO_KEY -> LearnAnswer.Option(choice ?: "")
            ExerciseKind.CHESS_MOVE -> LearnAnswer.Move((moveFrom ?: "") + (moveTo ?: ""))
            ExerciseKind.TYPE_ANSWER -> LearnAnswer.Typed(typed)
            ExerciseKind.WORD_BANK ->
                LearnAnswer.Words(tiles.filter { it >= 0 && it < exercise.options.size }.map { exercise.options[it] })
            ExerciseKind.MATCH_PAIRS -> LearnAnswer.Pairs(missed.toSet())
        }
        val v = session.submit(answer)
        coachNote = if (v == LearnVerdict.WRONG) coach?.invoke(exercise, answer) ?: "" else ""
        return v
    }

    /** The hints of the current exercise shown so far, and whether another is left. */
    val hintsShown: List<String> get() = session.shownHints
    val hasMoreHints: Boolean get() = session.hasMoreHints
    val hintTotal: Int get() = current?.hints?.size ?: 0

    fun showHint() {
        session.showHint()
    }

    fun overrule() = session.overrule()

    fun advance() {
        if (verdict == null) return
        session.advance()
        resetDrafts()
        coachNote = ""
    }

    /** The result, handed out once: the first time it is asked for after the lesson finished. */
    fun takeResult(): LessonResult? {
        val result = session.result
        if (reported || result == null) return null
        reported = true
        return result
    }

    // Chess

    /**
     * A tap on a square: the first picks the piece to move (a tap on it again puts it down), the next the square to
     * move it to; a third starts over from that square.
     */
    fun tapSquare(square: String) {
        if (!isAnswering || current?.kind != ExerciseKind.CHESS_MOVE) return
        if (moveFrom == null || moveTo != null) {
            moveFrom = square
            moveTo = null
        } else if (moveFrom == square) {
            moveFrom = null
        } else {
            moveTo = square
        }
    }

    // Word bank

    fun addTile(index: Int) {
        if (!isAnswering || index in tiles) return
        tiles.add(index)
    }

    fun removeTile(index: Int) {
        if (!isAnswering) return
        tiles = tiles.filter { it != index }.toMutableList()
    }

    // Pairs

    fun pickFront(key: String): PairOutcome? {
        if (!canPair || key in matched) return null
        lastMiss = null
        pickedFront = if (pickedFront == key) null else key
        return pairIfReady()
    }

    fun pickBack(index: Int): PairOutcome? {
        if (!canPair || index in matchedBacks) return null
        lastMiss = null
        pickedBack = if (pickedBack == index) null else index
        return pairIfReady()
    }

    private val canPair: Boolean get() = isAnswering && current?.kind == ExerciseKind.MATCH_PAIRS

    private fun pairIfReady(): PairOutcome? {
        val exercise = current
        val key = pickedFront
        val index = pickedBack
        if (exercise == null || key == null || index == null) return null
        pickedFront = null
        pickedBack = null
        if (index < 0 || index >= exercise.options.size) return null
        if (!exercise.isMatch(key, exercise.options[index])) {
            missed.add(key)
            lastMiss = PairMiss(key, index)
            return PairOutcome.Miss
        }
        matched.add(key)
        matchedBacks.add(index)
        if (matched.size != exercise.pairs.size) return PairOutcome.Match
        val v = session.submit(LearnAnswer.Pairs(missed.toSet()))
        return if (v != null) PairOutcome.Finished(v) else PairOutcome.Match
    }

    private fun resetDrafts() {
        typed = ""
        choice = null
        moveFrom = null
        moveTo = null
        tiles = mutableListOf()
        matched = LinkedHashSet()
        matchedBacks = LinkedHashSet()
        pickedFront = null
        pickedBack = null
        lastMiss = null
        missed = LinkedHashSet()
    }
}

// What the home screen does around a lesson.

/** One round on screen: a step of a course, or a round on chosen goals. */
data class LessonRun(
    val courseID: String,
    val kind: NodeKind,
    val lessonID: String,
    val exercises: List<LearnExercise>,
    /** The step the round belongs to; null for a round on chosen goals. */
    val node: CourseNode?,
    /** Whether finishing it marks the step as done. */
    val completes: Boolean,
    /** The unit whose test this is, for skipping it. */
    val testOut: CourseUnit?,
    val coach: CoachFunction?,
)

sealed class StartResult {
    data class Run(val run: LessonRun) : StartResult()
    data class Chest(val gems: Int, val notice: String) : StartResult()
    data class None(val notice: String? = null) : StartResult()
}

class LearnControllerDeps(
    val progress: LearnProgressStore,
    val quests: QuestStore,
    val skills: SkillStore,
    /** Epoch milliseconds. */
    val clock: () -> Long,
    val calendar: () -> LearnCalendar,
    /** A fresh seed per round (Swift: `UInt64.random(in: 1...UInt64.max)`); the UI supplies a random one. */
    val newSeed: () -> ULong,
    /** The provider of a course; defaults to the registry. */
    val provider: (String) -> CourseProvider? = { CourseCatalog.provider(it) },
)

data class SkillRow(
    val skill: Skill,
    val status: SkillStatus,
    val reasons: List<String>,
    /** The prerequisites that are not reached yet, like "Wortschatz (Einheit 1)". */
    val waitingFor: List<String>,
)

class LearnController(private val deps: LearnControllerDeps) {
    private fun provider(courseID: String): CourseProvider? = deps.provider(courseID)

    private fun coachOf(provider: CourseProvider): CoachFunction = { e, a -> provider.feedback(e, a) }

    /** Tapping a step: a chest opens, anything else becomes a round. Locked steps do nothing. */
    fun startStep(step: PathStep, courseID: String): StartResult {
        val node = step.node
        if (step.state == LessonState.LOCKED) return StartResult.None()
        if (node.kind == NodeKind.CHEST) {
            if (deps.progress.progress.isCompleted(node.id)) return StartResult.None()
            val gems = CoursePath.chestGems(node)
            if (deps.progress.openChest(node.id, gems)) return StartResult.Chest(gems, "Du hast $gems Gems gefunden.")
            return StartResult.None()
        }
        val provider = provider(courseID) ?: return StartResult.None()
        val exercises = provider.lessonExercises(node, deps.newSeed())
        if (exercises.isEmpty()) return StartResult.None()
        deps.skills.begin(node, SkillMaps.map(provider))
        return StartResult.Run(
            LessonRun(
                courseID = courseID, kind = node.kind, lessonID = node.id, exercises = exercises, node = node,
                completes = true, testOut = null, coach = coachOf(provider),
            ),
        )
    }

    /** A round of exercises that fit what the chosen goals still need. It earns XP and counts for the quests, and marks no step as done. */
    fun startPractice(targets: List<String>, courseID: String): StartResult {
        val provider = provider(courseID) ?: return StartResult.None()
        val exercises = SkillPractice.exercises(provider, SkillMaps.map(provider), targets, deps.skills.records, deps.newSeed())
        if (exercises.isEmpty()) return StartResult.None("Dazu gibt es gerade nichts zu üben.")
        return StartResult.Run(
            LessonRun(
                courseID = courseID, kind = NodeKind.PRACTICE, lessonID = "practice.$courseID", exercises = exercises,
                node = null, completes = false, testOut = null, coach = coachOf(provider),
            ),
        )
    }

    /** Whether the unit may be skipped by its test: only the first, untouched unit that is not done. */
    fun canTestOut(unit: CourseUnit, courseID: String): Boolean {
        val provider = provider(courseID) ?: return false
        val units = CoursePath.units(provider.course, deps.progress.progress.completedLessons)
        return TestOut.candidate(units)?.unit?.id == unit.id && unit.nodes.any { it.kind == NodeKind.CHECKPOINT }
    }

    /** The test of the first unit, for a student who knows it: null unless this unit may be skipped. */
    fun startTestOut(unit: CourseUnit, courseID: String): LessonRun? {
        val provider = provider(courseID)
        if (provider == null || !canTestOut(unit, courseID)) return null
        val node = unit.nodes.firstOrNull { it.kind == NodeKind.CHECKPOINT } ?: return null
        val exercises = provider.lessonExercises(node, deps.newSeed())
        if (exercises.isEmpty()) return null
        return LessonRun(
            courseID = courseID, kind = NodeKind.CHECKPOINT, lessonID = node.id, exercises = exercises, node = node,
            completes = false, testOut = unit, coach = coachOf(provider),
        )
    }

    fun newModel(run: LessonRun, sessionID: String): LessonModel =
        LessonModel(lessonID = run.lessonID, exercises = run.exercises, sessionID = sessionID, coach = run.coach)

    /**
     * Records the round once (a run the store has seen before counts for nothing): XP and streak, the evidence for the
     * skills, the quests, and, for a unit test, whether the unit is skipped. What it brought goes to the end screen.
     */
    fun finish(result: LessonResult, run: LessonRun): LessonRewards {
        val now = deps.clock()
        val calendar = deps.calendar()
        val reward = deps.progress.record(result, now, calendar, courseID = run.courseID, completes = run.completes)
            ?: return LessonRewards()
        val provider = provider(run.courseID)
        if (provider != null) deps.skills.record(result.outcomes, run.node, SkillMaps.map(provider), now, calendar)
        val notes = mutableListOf<String>()
        val testOut = run.testOut
        if (testOut != null) {
            if (TestOut.passed(result)) {
                deps.progress.complete(TestOut.nodesToComplete(testOut))
                notes.add("Einheit übersprungen: ${testOut.title}. Als Fähigkeit zählt nur, was der Test gezeigt hat.")
            } else {
                notes.add("Für das Überspringen brauchst du 85 % richtig, ohne Hilfe. Lern die Einheit jetzt Schritt für Schritt.")
            }
        }
        val finished = deps.quests.record(
            QuestEvent(
                xp = reward.xp, courseID = run.courseID, nodeKind = run.kind,
                rightFirstTry = result.rightFirstTry, exerciseCount = result.exerciseCount,
            ),
            now, calendar,
        )
        return LessonRewards(
            gems = reward.gems, quests = finished.map { it.title }, freezesUsed = reward.freezesUsed,
            streakExtended = reward.streakExtended, notes = notes,
        )
    }

    /** The rows of the skills screen: status, what is missing and what the goal waits for. */
    fun skillRows(provider: CourseProvider): List<SkillRow> {
        val map = SkillMaps.map(provider)
        val now = deps.clock()
        val calendar = deps.calendar()
        val completed = deps.progress.progress.completedLessons
        val records = deps.skills.records
        fun status(skill: Skill) = SkillAssessor.status(records[skill.id], skill, completed, now, calendar)
        return map.skills.map { skill ->
            val state = status(skill)
            val waitingFor = skill.prerequisites.mapNotNull { map.skill(it) }
                .filter { !status(it).isReached }
                .map { "${it.title} (Einheit ${it.unitNumber})" }
            val reasons = when (state) {
                SkillStatus.MASTERED -> emptyList()
                SkillStatus.DUE -> listOf("Die Wiederholung ist fällig, damit du es nicht vergisst.")
                else -> SkillAssessor.missing(records[skill.id] ?: SkillRecord(), skill)
            }
            SkillRow(skill, state, reasons, waitingFor)
        }
    }
}
