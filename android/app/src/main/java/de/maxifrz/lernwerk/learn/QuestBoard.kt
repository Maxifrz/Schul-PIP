package de.maxifrz.lernwerk.learn

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Three quests a day and one for the week, chosen from the date alone, so a day's quests are the same on every launch
// and nothing needs a server. Everything takes the time (epoch milliseconds) and the calendar as parameters.
// A port of QuestBoard.swift (the store is in LearnStores.kt).

/** What a quest asks for. */
enum class QuestKind(val raw: String) {
    /** Earn XP. */
    XP("xp"),

    /** Finish lessons, practice rounds or checkpoints. */
    LESSONS("lessons"),

    /** Finish rounds in which every exercise was right on the first try. */
    PERFECT("perfect"),

    /** Answer exercises right on the first try, in any rounds. */
    FIRST_TRY("firstTry"),

    /** Learn in different courses on one day. */
    COURSES("courses"),

    /** Finish practice rounds or checkpoints. */
    PRACTICE("practice"),

    /** Learn on different days of the week (weekly only). */
    DAYS("days"),
}

data class Quest(
    val id: String,
    val kind: QuestKind,
    val target: Int,
    var progress: Int = 0,
    /** Gems for claiming it. */
    val reward: Int,
    var claimed: Boolean = false,
) {
    val isDone: Boolean get() = progress >= target
    val fraction: Double get() = if (target == 0) 1.0 else minOf(1.0, progress.toDouble() / target)

    /** What the student reads. */
    val title: String
        get() = when (kind) {
            QuestKind.XP -> "Sammle $target XP"
            QuestKind.LESSONS -> if (target == 1) "Schließe eine Lektion ab" else "Schließe $target Lektionen ab"
            QuestKind.PERFECT -> if (target == 1) "Eine Lektion ohne Fehler" else "$target Lektionen ohne Fehler"
            QuestKind.FIRST_TRY -> "Beantworte $target Aufgaben auf Anhieb richtig"
            QuestKind.COURSES -> "Lerne in $target verschiedenen Kursen"
            QuestKind.PRACTICE -> if (target == 1) "Schließe eine Übungsrunde ab" else "Schließe $target Übungsrunden ab"
            QuestKind.DAYS -> "Lerne an $target Tagen"
        }

    fun toJson(): JsonObject = buildJsonObject {
        put("id", id)
        put("kind", kind.raw)
        put("target", target)
        put("progress", progress)
        put("reward", reward)
        put("claimed", claimed)
    }
}

/** A finished round, as the quests see it. */
data class QuestEvent(
    val xp: Int,
    val courseID: String? = null,
    val nodeKind: NodeKind? = null,
    val rightFirstTry: Int,
    val exerciseCount: Int,
) {
    val isPerfect: Boolean get() = exerciseCount > 0 && rightFirstTry == exerciseCount
    val isPractice: Boolean get() = nodeKind == NodeKind.PRACTICE || nodeKind == NodeKind.CHECKPOINT
}

private val dQuest: Decoder<Quest> = { v ->
    val o = v as? JsonObject
    val id = o?.required("id", dString)
    val kind = o?.required("kind", dEnum(QuestKind.values()) { it.raw })
    val target = o?.required("target", dInt)
    val progress = o?.required("progress", dInt)
    val reward = o?.required("reward", dInt)
    val claimed = o?.required("claimed", dBool)
    if (id == null || kind == null || target == null || progress == null || reward == null || claimed == null) null
    else Quest(id, kind, target, progress, reward, claimed)
}

/** The id the store accepts to claim the day's bonus. */
const val BONUS_ID = "bonus"

class QuestBoard {
    var day: LearnDay? = null
    var daily: MutableList<Quest> = mutableListOf()
    var bonusClaimed = false
    var coursesToday: MutableSet<String> = LinkedHashSet()
    var weekStart: LearnDay? = null
    var weekly: Quest? = null

    /** The days of the week that had a round, sorted. */
    var weekDays: MutableList<LearnDay> = mutableListOf()
    var weekXP = 0
    var weekLessons = 0

    // Time

    /**
     * Starts a new day's quests and a new week's, when the day or the week has changed. A date that goes back (a
     * changed time zone) keeps the quests of the later day.
     */
    fun refresh(now: Long, calendar: LearnCalendar) {
        var today = dayOf(now, calendar)
        val current = day
        if (current != null && daysTo(current, today) < 0) today = current
        if (day != today) {
            day = today
            daily = dailyQuests(today).toMutableList()
            bonusClaimed = false
            coursesToday = LinkedHashSet()
        }
        var start = weekStart(now, calendar)
        val currentStart = weekStart
        if (currentStart != null && daysTo(currentStart, start) < 0) start = currentStart
        if (weekStart != start) {
            weekStart = start
            weekly = weeklyQuest(start)
            weekDays = mutableListOf()
            weekXP = 0
            weekLessons = 0
        }
    }

    // Progress

    /** Counts a finished round; the quests that became done with it. */
    fun apply(event: QuestEvent, now: Long, calendar: LearnCalendar): List<Quest> {
        refresh(now, calendar)
        if (event.exerciseCount <= 0) return emptyList()
        val finished = mutableListOf<Quest>()
        if (event.courseID != null) coursesToday.add(event.courseID)
        for (q in daily) {
            val before = q.isDone
            q.progress += gain(q.kind, event, coursesToday.size, q.progress)
            if (!before && q.isDone) finished.add(q.copy())
        }
        val current = weekly
        if (current != null) {
            val quest = current.copy()
            val before = quest.isDone
            day?.let { insertDay(weekDays, it) }
            weekXP += event.xp
            weekLessons += 1
            quest.progress = when (quest.kind) {
                QuestKind.DAYS -> weekDays.size
                QuestKind.XP -> weekXP
                else -> weekLessons
            }
            weekly = quest
            if (!before && quest.isDone) finished.add(quest.copy())
        }
        return finished
    }

    // Rewards

    val dailyDone: Int get() = daily.count { it.isDone }
    val allDailyClaimed: Boolean get() = daily.isNotEmpty() && daily.all { it.claimed }
    val bonusAvailable: Boolean get() = allDailyClaimed && !bonusClaimed
    val hasUnclaimed: Boolean
        get() = daily.any { it.isDone && !it.claimed } || (weekly?.let { it.isDone && !it.claimed } ?: false) || bonusAvailable

    /** Claims a finished quest; its gems, or 0 when it is not done or claimed already. */
    fun claim(id: String): Int {
        val q = daily.firstOrNull { it.id == id }
        if (q != null && q.isDone && !q.claimed) {
            q.claimed = true
            return q.reward
        }
        val w = weekly
        if (w != null && w.id == id && w.isDone && !w.claimed) {
            w.claimed = true
            return w.reward
        }
        return 0
    }

    /** The gems for claiming all of the day's quests, once. */
    fun claimBonus(): Int {
        if (!bonusAvailable) return 0
        bonusClaimed = true
        return bonusGems
    }

    fun copy(): QuestBoard = fromJson(toJson())

    /** Persistence: the field names of the Swift Codable. */
    fun toJson(): JsonObject = buildJsonObject {
        put("daily", JsonArray(daily.map { it.toJson() }))
        put("bonusClaimed", bonusClaimed)
        put("coursesToday", JsonArray(coursesToday.sorted().map { JsonPrimitive(it) }))
        put("weekDays", JsonArray(weekDays.map { it.toJson() }))
        put("weekXP", weekXP)
        put("weekLessons", weekLessons)
        day?.let { put("day", it.toJson()) }
        weekStart?.let { put("weekStart", it.toJson()) }
        weekly?.let { put("weekly", it.toJson()) }
    }

    override fun equals(other: Any?): Boolean = other is QuestBoard && toJson() == other.toJson()
    override fun hashCode(): Int = toJson().hashCode()
    override fun toString(): String = toJson().toString()

    companion object {
        const val dailyCount = 3

        /** Gems for claiming all three of a day's quests. */
        const val bonusGems = 20

        private class Variant(val target: Int, val reward: Int)

        private fun t(target: Int, reward: Int) = Variant(target, reward)

        /** Variants of each kind: target and reward. */
        private fun variants(kind: QuestKind): List<Variant> = when (kind) {
            QuestKind.XP -> listOf(t(30, 10), t(50, 15), t(80, 20))
            QuestKind.LESSONS -> listOf(t(2, 10), t(3, 15), t(4, 20))
            QuestKind.PERFECT -> listOf(t(1, 15))
            QuestKind.FIRST_TRY -> listOf(t(15, 10), t(25, 15))
            QuestKind.COURSES -> listOf(t(2, 15))
            QuestKind.PRACTICE -> listOf(t(1, 10))
            QuestKind.DAYS -> listOf(t(4, 40), t(5, 50))
        }

        private val dailyKinds = listOf(
            QuestKind.XP, QuestKind.LESSONS, QuestKind.PERFECT, QuestKind.FIRST_TRY, QuestKind.COURSES, QuestKind.PRACTICE,
        )

        private fun seed(day: LearnDay): ULong = (day.year * 10_000 + day.month * 100 + day.day).toLong().toULong()

        fun dailyQuests(day: LearnDay): List<Quest> {
            val mix = SplitMix(seed(day))
            val pool = dailyKinds.toMutableList()
            val chosen = mutableListOf<Quest>()
            // The first quest is always about XP or lessons, so every day has one that anything done counts for.
            val anchors = listOf(QuestKind.XP, QuestKind.LESSONS)
            val anchor = anchors[(mix.next() % anchors.size.toULong()).toInt()]
            pool.removeAll { it == anchor }
            val kinds = mutableListOf(anchor)
            while (kinds.size < dailyCount && pool.isNotEmpty()) {
                val index = (mix.next() % pool.size.toULong()).toInt()
                kinds.add(pool.removeAt(index))
            }
            for (kind in kinds) {
                val options = variants(kind)
                val option = options[(mix.next() % options.size.toULong()).toInt()]
                chosen.add(Quest("d.${day.year}-${day.month}-${day.day}.${kind.raw}", kind, option.target, 0, option.reward, false))
            }
            return chosen
        }

        fun weeklyQuest(start: LearnDay): Quest {
            val mix = SplitMix(seed(start) + 7uL)
            val kinds = listOf(QuestKind.DAYS, QuestKind.XP, QuestKind.LESSONS)
            val kind = kinds[(mix.next() % kinds.size.toULong()).toInt()]
            val option = when (kind) {
                QuestKind.XP -> t(300, 50)
                QuestKind.LESSONS -> t(12, 50)
                else -> variants(QuestKind.DAYS)[(mix.next() % 2uL).toInt()]
            }
            return Quest("w.${start.year}-${start.month}-${start.day}.${kind.raw}", kind, option.target, 0, option.reward, false)
        }

        /** The first day of the week of an instant, honoring the calendar's first weekday. */
        fun weekStart(now: Long, calendar: LearnCalendar): LearnDay = de.maxifrz.lernwerk.learn.weekStart(now, calendar)

        /** Seconds until midnight, for the timer on the quest tile. */
        fun secondsUntilNextDay(now: Long, calendar: LearnCalendar): Double = de.maxifrz.lernwerk.learn.secondsUntilNextDay(now, calendar)

        /** How much a round moves a quest of this kind. `courses` is a count that is set, not added to. */
        private fun gain(kind: QuestKind, event: QuestEvent, courses: Int, current: Int): Int = when (kind) {
            QuestKind.XP -> event.xp
            QuestKind.LESSONS -> 1
            QuestKind.PERFECT -> if (event.isPerfect) 1 else 0
            QuestKind.FIRST_TRY -> event.rightFirstTry
            QuestKind.COURSES -> maxOf(0, courses - current)
            QuestKind.PRACTICE -> if (event.isPractice) 1 else 0
            QuestKind.DAYS -> 0
        }

        private fun insertDay(days: MutableList<LearnDay>, day: LearnDay) {
            if (day in days) return
            days.add(day)
            days.sort()
        }

        fun fromJson(json: JsonElement?): QuestBoard {
            val board = QuestBoard()
            val o = json as? JsonObject ?: return board
            board.day = o.field("day", dLearnDay, null)
            board.daily = o.field("daily", dArray(dQuest), emptyList()).toMutableList()
            board.bonusClaimed = o.field("bonusClaimed", dBool, false)
            board.coursesToday = LinkedHashSet(o.field("coursesToday", dSet(dString), emptySet()))
            board.weekStart = o.field("weekStart", dLearnDay, null)
            board.weekly = o.field("weekly", dQuest, null)
            val days = o.field("weekDays", dSet(dLearnDay) { it.key }, emptySet())
            board.weekDays = days.sorted().toMutableList()
            board.weekXP = o.field("weekXP", dInt, 0)
            board.weekLessons = o.field("weekLessons", dInt, 0)
            return board
        }
    }
}
