package de.maxifrz.lernwerk.learn.skills

import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.LearnCalendar
import de.maxifrz.lernwerk.learn.LearnDay
import de.maxifrz.lernwerk.learn.adding
import de.maxifrz.lernwerk.learn.dArray
import de.maxifrz.lernwerk.learn.dBool
import de.maxifrz.lernwerk.learn.dDouble
import de.maxifrz.lernwerk.learn.dEnum
import de.maxifrz.lernwerk.learn.dInt
import de.maxifrz.lernwerk.learn.dLearnDay
import de.maxifrz.lernwerk.learn.dRecord
import de.maxifrz.lernwerk.learn.dSet
import de.maxifrz.lernwerk.learn.dString
import de.maxifrz.lernwerk.learn.dayOf
import de.maxifrz.lernwerk.learn.daysTo
import de.maxifrz.lernwerk.learn.field
import de.maxifrz.lernwerk.learn.required
import de.maxifrz.lernwerk.learn.toJson
import de.maxifrz.lernwerk.review.ReviewGrade
import de.maxifrz.lernwerk.review.SchedulingState
import de.maxifrz.lernwerk.review.SpacedRepetition
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// The rules that turn answers into a status. They are the whole definition of "mastered": no screen decides it.
// A port of SkillAssessor.swift (records, status, constants and the sentences).

/** One answer of a round as the skills see it: the first attempt of an exercise. */
data class ExerciseOutcome(
    val exerciseID: String,
    val skill: String,
    val level: CompetenceLevel,
    /** Right on the first attempt. */
    val right: Boolean,
    /** A hint was shown before the answer. */
    val helped: Boolean,
)

/** Where a skill stands. Finishing a lesson only gets a skill to "worked"; everything above needs answers. */
enum class SkillStatus(val raw: String, val title: String) {
    /** No step of it was opened. */
    NOT_STARTED("notStarted", "Noch nicht begonnen"),

    /** A lesson was begun and not finished. */
    STARTED("started", "Begonnen"),

    /** A step was finished, but the answers do not yet show much. */
    WORKED("worked", "Bearbeitet"),

    /** Enough right answers to say the student is practising it well, short of the criteria for being reached. */
    PRACTICING("practicing", "Geübt"),

    /** The criteria are met once: enough right answers at every level, and a good recent run. */
    PROVISIONAL("provisional", "Vorläufig erreicht"),

    /** Reached, and confirmed on a later day. */
    MASTERED("mastered", "Beherrscht"),

    /** Reached before, and the review is due. */
    DUE("due", "Wiederholung fällig");

    /** Reached at least once: later skills may build on it. */
    val isReached: Boolean get() = this == PROVISIONAL || this == MASTERED || this == DUE
}

private val dLevel = dEnum(CompetenceLevel.values()) { it.raw }

class Tally(
    var attempts: Int = 0,
    /** First try, no hint. */
    var right: Int = 0,
    var helped: Int = 0,
    var points: Double = 0.0,
    /** The last eight answers, true for right on the first try without a hint. */
    var recent: List<Boolean> = emptyList(),
) {
    val recentAccuracy: Double? get() = if (recent.isEmpty()) null else recent.count { it }.toDouble() / recent.size

    fun copy(): Tally = Tally(attempts, right, helped, points, recent.toList())

    fun toJson(): JsonObject = buildJsonObject {
        put("attempts", attempts)
        put("right", right)
        put("helped", helped)
        put("points", points)
        put("recent", JsonArray(recent.map { JsonPrimitive(it) }))
    }

    override fun equals(other: Any?): Boolean = other is Tally && toJson() == other.toJson()
    override fun hashCode(): Int = toJson().hashCode()
    override fun toString(): String = toJson().toString()

    companion object {
        /** The synthesized Codable: every key is required. */
        val decode: (JsonElement) -> Tally? = { v ->
            val o = v as? JsonObject
            val attempts = o?.required("attempts", dInt)
            val right = o?.required("right", dInt)
            val helped = o?.required("helped", dInt)
            val points = o?.required("points", dDouble)
            val recent = o?.required("recent", dArray(dBool))
            if (attempts == null || right == null || helped == null || points == null || recent == null) null
            else Tally(attempts, right, helped, points, recent)
        }
    }
}

/** The spaced review of the skill: one step per day, from how that day's answers went. */
class Schedule {
    var repetitions = 0
    var intervalDays = 0
    var ease = SchedulingState.INITIAL_EASE
    var lapses = 0

    /** The last day a review step was taken. */
    var reviewDay: LearnDay? = null
    var dueDay: LearnDay? = null

    /** The day the criteria were first met (again after a lapse). */
    var provisionalDay: LearnDay? = null

    /** Good days after `provisionalDay`. */
    var confirmations = 0

    fun copy(): Schedule {
        val s = Schedule()
        s.repetitions = repetitions
        s.intervalDays = intervalDays
        s.ease = ease
        s.lapses = lapses
        s.reviewDay = reviewDay
        s.dueDay = dueDay
        s.provisionalDay = provisionalDay
        s.confirmations = confirmations
        return s
    }

    fun toJson(): JsonObject = buildJsonObject {
        put("repetitions", repetitions)
        put("intervalDays", intervalDays)
        put("ease", ease)
        put("lapses", lapses)
        put("confirmations", confirmations)
        reviewDay?.let { put("reviewDay", it.toJson()) }
        dueDay?.let { put("dueDay", it.toJson()) }
        provisionalDay?.let { put("provisionalDay", it.toJson()) }
    }

    override fun equals(other: Any?): Boolean = other is Schedule && toJson() == other.toJson()
    override fun hashCode(): Int = toJson().hashCode()

    companion object {
        val decode: (JsonElement) -> Schedule? = { json ->
            val o = json as? JsonObject
            if (o == null) null else {
                val s = Schedule()
                s.repetitions = maxOf(0, o.field("repetitions", dInt, 0))
                s.intervalDays = maxOf(0, o.field("intervalDays", dInt, 0))
                s.ease = maxOf(SchedulingState.MINIMUM_EASE, o.field("ease", dDouble, SchedulingState.INITIAL_EASE))
                s.lapses = maxOf(0, o.field("lapses", dInt, 0))
                s.reviewDay = o.field("reviewDay", dLearnDay, null)
                s.dueDay = o.field("dueDay", dLearnDay, null)
                s.provisionalDay = o.field("provisionalDay", dLearnDay, null)
                s.confirmations = maxOf(0, o.field("confirmations", dInt, 0))
                s
            }
        }
    }
}

/** What one skill has shown so far. Plain values; the day and the calendar always come in as parameters. */
class SkillRecord {
    /** Keyed by the level's raw value. */
    var tallies: MutableMap<String, Tally> = LinkedHashMap()

    /** The last ten answers over all levels. */
    var recent: List<Boolean> = emptyList()
    var started: MutableSet<String> = LinkedHashSet()
    var worked: MutableSet<String> = LinkedHashSet()
    var days: List<LearnDay> = emptyList()
    var schedule = Schedule()

    /**
     * The day the counters below belong to, with the answers and the clean ones of that day, and the schedule as it
     * was before that day's review, so the review can be worked out again as the day's answers come in.
     */
    var today: LearnDay? = null
    var answersToday = 0
    var cleanToday = 0
    var scheduleBeforeToday = Schedule()

    val provisionalDay: LearnDay? get() = schedule.provisionalDay
    val confirmations: Int get() = schedule.confirmations
    val dueDay: LearnDay? get() = schedule.dueDay
    val lapses: Int get() = schedule.lapses
    val repetitions: Int get() = schedule.repetitions

    fun tally(level: CompetenceLevel): Tally = tallies[level.raw] ?: Tally()

    val attempts: Int get() = tallies.values.sumOf { it.attempts }

    val recentAccuracy: Double? get() = if (recent.isEmpty()) null else recent.count { it }.toDouble() / recent.size

    fun copy(): SkillRecord {
        val r = SkillRecord()
        for ((k, v) in tallies) r.tallies[k] = v.copy()
        r.recent = recent.toList()
        r.started = LinkedHashSet(started)
        r.worked = LinkedHashSet(worked)
        r.days = days.toList()
        r.schedule = schedule.copy()
        r.today = today
        r.answersToday = answersToday
        r.cleanToday = cleanToday
        r.scheduleBeforeToday = scheduleBeforeToday.copy()
        return r
    }

    fun toJson(): JsonObject = buildJsonObject {
        put("tallies", JsonObject(tallies.keys.sorted().associateWith { tallies.getValue(it).toJson() }))
        put("recent", JsonArray(recent.map { JsonPrimitive(it) }))
        put("started", JsonArray(started.sorted().map { JsonPrimitive(it) }))
        put("worked", JsonArray(worked.sorted().map { JsonPrimitive(it) }))
        put("days", JsonArray(days.map { it.toJson() }))
        put("schedule", schedule.toJson())
        put("answersToday", answersToday)
        put("cleanToday", cleanToday)
        put("scheduleBeforeToday", scheduleBeforeToday.toJson())
        today?.let { put("today", it.toJson()) }
    }

    override fun equals(other: Any?): Boolean = other is SkillRecord && toJson() == other.toJson()
    override fun hashCode(): Int = toJson().hashCode()
    override fun toString(): String = toJson().toString()

    companion object {
        /** A saved record from an older version lacks newer fields; each one falls back on its default. */
        val decode: (JsonElement) -> SkillRecord? = { json ->
            val o = json as? JsonObject
            if (o == null) null else {
                val r = SkillRecord()
                r.tallies = LinkedHashMap(o.field("tallies", dRecord(Tally.decode), emptyMap()))
                r.recent = o.field("recent", dArray(dBool), emptyList())
                r.started = LinkedHashSet(o.field("started", dSet(dString), emptySet()))
                r.worked = LinkedHashSet(o.field("worked", dSet(dString), emptySet()))
                r.days = o.field("days", dArray(dLearnDay), emptyList())
                r.schedule = o.field("schedule", Schedule.decode, Schedule())
                r.today = o.field("today", dLearnDay, null)
                r.answersToday = maxOf(0, o.field("answersToday", dInt, 0))
                r.cleanToday = maxOf(0, o.field("cleanToday", dInt, 0))
                r.scheduleBeforeToday = o.field("scheduleBeforeToday", Schedule.decode, Schedule())
                r
            }
        }

        fun fromJson(json: JsonElement?): SkillRecord = (if (json == null) null else decode(json)) ?: SkillRecord()
    }
}

/** The rules that turn answers into a status. They are the whole definition of "mastered": no screen decides it. */
object SkillAssessor {
    /** Points that count towards recognising when the skill also asks for more: recognising is the weakest proof. */
    const val recognitionCapWithHigherLevels = 4.0
    const val recognitionCapAlone = 10.0

    /** Points a skill needs in all: eight is four typed answers, or two typed and four recognised. */
    const val pointsForReached = 8.0

    /** Points at each level above recognising that the skill asks for. */
    const val pointsPerHigherLevel = 2.0

    /** A finished lesson and a few right answers: practising. */
    const val pointsForPractising = 4.0
    const val attemptsForReached = 8
    const val accuracyForReached = 0.75

    /** A round counts as a review session with at least this many answers for the skill. */
    const val answersForSession = 3

    /** The most points one round can add to one skill, so a long run of easy answers does not do it alone. */
    const val pointsPerRound = 12.0
    const val weakAccuracy = 0.7

    // Recording

    /**
     * Counts a finished round. `node` is the step the round came from (null for a mixed practice round). `records`
     * is changed in place; `now` is epoch milliseconds.
     */
    fun record(
        outcomes: List<ExerciseOutcome>,
        node: CourseNode?,
        map: SkillMap,
        records: MutableMap<String, SkillRecord>,
        now: Long,
        calendar: LearnCalendar,
    ) {
        val today = dayOf(now, calendar)
        val seen = HashSet<String>()
        val unique = outcomes.filter { o -> seen.add(o.exerciseID) && map.skill(o.skill) != null }
        val bySkill = LinkedHashMap<String, MutableList<ExerciseOutcome>>()
        for (outcome in unique) bySkill.getOrPut(outcome.skill) { mutableListOf() }.add(outcome)
        for ((id, list) in bySkill) {
            val skill = map.skill(id) ?: continue
            val record = records[id]?.copy() ?: SkillRecord()
            var added = 0.0
            for (outcome in list) {
                val tally = record.tally(outcome.level).copy()
                tally.attempts += 1
                val clean = outcome.right && !outcome.helped
                if (outcome.helped) tally.helped += 1
                if (clean) tally.right += 1
                var gain = 0.0
                if (outcome.right) gain = outcome.level.weight * (if (outcome.helped) 0.5 else 1.0)
                gain = minOf(gain, pointsPerRound - added)
                added += gain
                tally.points += gain
                tally.recent = (tally.recent + clean).takeLast(8)
                record.tallies[outcome.level.raw] = tally
                record.recent = (record.recent + clean).takeLast(10)
            }
            val lastDay = record.days.lastOrNull()
            if (lastDay != today) record.days = (record.days + today).takeLast(60)
            if (node != null && node.id in skill.nodeIDs) record.worked.add(node.id)
            if (record.today != today) {
                record.today = today
                record.answersToday = 0
                record.cleanToday = 0
                record.scheduleBeforeToday = record.schedule.copy()
            }
            record.answersToday += list.size
            record.cleanToday += list.count { it.right && !it.helped }
            review(record, today)
            if (record.schedule.provisionalDay == null && meetsCriteria(record, skill)) {
                record.schedule.provisionalDay = today
            }
            records[id] = record
        }
        if (node != null) {
            // A step finished with no answer for a skill still counts as worked on it.
            for (skill in map.skills) {
                if (node.id in skill.nodeIDs && skill.id !in bySkill) {
                    val record = records[skill.id]?.copy() ?: SkillRecord()
                    record.worked.add(node.id)
                    records[skill.id] = record
                }
            }
        }
    }

    fun begin(node: CourseNode, map: SkillMap, records: MutableMap<String, SkillRecord>) {
        for (skill in map.skills) {
            if (node.id !in skill.nodeIDs) continue
            val record = records[skill.id]?.copy() ?: SkillRecord()
            record.started.add(node.id)
            records[skill.id] = record
        }
    }

    // Reading

    fun points(record: SkillRecord, skill: Skill): Double {
        val higher = skill.levels.any { it.isHigher(CompetenceLevel.RECOGNISE) }
        val cap = if (higher) recognitionCapWithHigherLevels else recognitionCapAlone
        return CompetenceLevel.values().fold(0.0) { sum, level ->
            val points = record.tally(level).points
            sum + (if (level == CompetenceLevel.RECOGNISE) minOf(points, cap) else points)
        }
    }

    fun meetsCriteria(record: SkillRecord, skill: Skill): Boolean = missing(record, skill, false).isEmpty()

    /** Why the skill is not reached yet, in sentences the student can act on. Empty when the criteria are met. */
    fun missing(record: SkillRecord, skill: Skill, includeConfirmation: Boolean = true): List<String> {
        val reasons = mutableListOf<String>()
        val total = points(record, skill)
        if (record.attempts < attemptsForReached || total < pointsForReached) {
            reasons.add("Es fehlen noch richtige Antworten ohne Hilfe.")
        }
        for (level in skill.levels) {
            if (level.isHigher(CompetenceLevel.RECOGNISE) && record.tally(level).points < pointsPerHigherLevel) {
                when (level) {
                    CompetenceLevel.RECALL -> reasons.add("Du hast noch zu wenig aus dem Kopf getippt, ohne Auswahl.")
                    CompetenceLevel.APPLY -> reasons.add("Du hast es noch zu selten selbst angewendet.")
                    CompetenceLevel.RECOGNISE -> {}
                }
            }
        }
        val accuracy = record.recentAccuracy
        if (accuracy != null && accuracy < accuracyForReached) {
            reasons.add("In den letzten Antworten waren noch zu viele Fehler oder Hinweise.")
        }
        if (reasons.isEmpty() && includeConfirmation && record.provisionalDay != null && record.confirmations < 1) {
            reasons.add("Es fehlt noch eine gute Runde an einem anderen Tag.")
        }
        return reasons
    }

    fun status(record: SkillRecord?, skill: Skill, completed: Set<String>, now: Long, calendar: LearnCalendar): SkillStatus {
        val rec = record ?: SkillRecord()
        val today = dayOf(now, calendar)
        val worked = rec.worked.isNotEmpty() || skill.nodeIDs.any { it in completed }
        if (rec.attempts == 0) {
            if (worked) return SkillStatus.WORKED
            return if (rec.started.isEmpty()) SkillStatus.NOT_STARTED else SkillStatus.STARTED
        }
        if (rec.provisionalDay != null) {
            val confirmed = rec.confirmations >= 1 && (rec.recentAccuracy ?: 0.0) >= accuracyForReached
            val due = rec.dueDay
            if (due != null && daysTo(due, today) >= 0) return SkillStatus.DUE
            return if (confirmed) SkillStatus.MASTERED else SkillStatus.PROVISIONAL
        }
        return if (points(rec, skill) >= pointsForPractising) SkillStatus.PRACTICING else SkillStatus.WORKED
    }

    /** Levels in which the answers are weak or missing, weakest first; what a targeted round leans on. */
    fun weakLevels(record: SkillRecord?, skill: Skill): List<CompetenceLevel> {
        val rec = record ?: SkillRecord()
        return skill.levels
            .map { it to (rec.tally(it).recentAccuracy ?: -1.0) }
            .filter { it.second < weakAccuracy }
            .sortedBy { it.second } // stable
            .map { it.first }
    }

    /**
     * One scheduling step per skill and day, worked out from all of the day's answers and worked out again as more
     * come in: a second round the same day adds evidence but does not push the review further away. A day with fewer
     * than three answers for the skill takes no step.
     */
    private fun review(record: SkillRecord, today: LearnDay) {
        if (record.answersToday < answersForSession) return
        val schedule = record.scheduleBeforeToday.copy()
        val accuracy = record.cleanToday.toDouble() / record.answersToday
        val grade = if (accuracy >= 0.85) ReviewGrade.GOOD else if (accuracy >= 0.6) ReviewGrade.HARD else ReviewGrade.AGAIN
        val reached = schedule.provisionalDay
        if (reached != null && reached != today && grade == ReviewGrade.GOOD) {
            // A later day with a good run confirms it; a middling one does not count for or against.
            schedule.confirmations += 1
        }
        if (grade == ReviewGrade.AGAIN) {
            schedule.confirmations = 0
            schedule.provisionalDay = null
        }
        val state = SpacedRepetition.next(
            SchedulingState(
                intervalDays = schedule.intervalDays, easeFactor = schedule.ease,
                repetitions = schedule.repetitions, lapses = schedule.lapses,
            ),
            grade,
        )
        schedule.intervalDays = state.intervalDays
        schedule.ease = state.easeFactor
        schedule.repetitions = state.repetitions
        schedule.lapses = state.lapses
        schedule.reviewDay = today
        schedule.dueDay = adding(today, state.intervalDays)
        record.schedule = schedule
    }
}
