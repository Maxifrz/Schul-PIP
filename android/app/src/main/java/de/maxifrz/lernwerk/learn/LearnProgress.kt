package de.maxifrz.lernwerk.learn

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// XP, daily goal, streak and finished lessons of the Lernpfad. Plain values: the time (epoch milliseconds) and the
// calendar come in as parameters, so midnight, daylight saving time and other time zones can be tested.
// A port of LearnProgress.swift (LearnProgress; the store is in LearnStores.kt).

/** What a finished lesson brought. */
data class Reward(
    val xp: Int,
    val xpToday: Int,
    /** The daily goal was reached with this lesson; true once a day at most. */
    val goalReached: Boolean,
    val streak: Int,
    /** The first lesson of the day, which counts for the streak. */
    val streakExtended: Boolean,
    /** Gems for the lesson, with the daily goal's if this lesson reached it. */
    val gems: Int,
    /** Days of the streak a streak freeze covered with this lesson. */
    val freezesUsed: Int,
)

class LearnProgress {
    var dailyGoal = defaultGoal
    var totalXP = 0

    /** The XP of `xpDay`; read through `xpToday(now, calendar)`, which knows when the day is over. */
    var xpOfDay = 0
    var xpDay: LearnDay? = null
    var goalReachedDay: LearnDay? = null

    /** As of `lastLessonDay`; read through `currentStreak(now, calendar)`, which knows when a day was skipped. */
    var streak = 0
    var longestStreak = 0
    var lastLessonDay: LearnDay? = null

    /** Lesson ids come from their cards, so a lesson whose cards changed is not in here. */
    var completedLessons: MutableSet<String> = LinkedHashSet()
    var recentRuns: MutableList<String> = mutableListOf()
    var gems = 0

    /** Streak freezes in stock: each covers one skipped day. */
    var freezes = 0

    /** XP per course id, for the number next to the course's icon. */
    var courseXP: MutableMap<String, Int> = LinkedHashMap()

    fun xpInCourse(courseID: String): Int = courseXP[courseID] ?: 0

    fun xpToday(now: Long, calendar: LearnCalendar): Int = if (xpDay == day(now, calendar)) xpOfDay else 0

    fun goalFraction(now: Long, calendar: LearnCalendar): Double =
        minOf(1.0, xpToday(now, calendar).toDouble() / maxOf(1, dailyGoal))

    /** The streak as it stands: it holds through today if the last lesson was today or yesterday, or if freezes cover the days since. */
    fun currentStreak(now: Long, calendar: LearnCalendar): Int {
        val last = lastLessonDay ?: return 0
        val gap = daysTo(last, dayOf(now, calendar))
        return if (gap - 1 <= freezes) streak else 0
    }

    fun isCompleted(lessonID: String): Boolean = lessonID in completedLessons

    /**
     * Today in the calendar, but never before the last lesson's day: after a change of time zone or clock, or a
     * flight across the date line, the local date can go back, and a lesson then belongs to the last lesson day
     * instead of starting the day's XP, goal and streak over.
     */
    private fun day(now: Long, calendar: LearnCalendar): LearnDay {
        val today = dayOf(now, calendar)
        val last = lastLessonDay ?: return today
        return if (daysTo(last, today) < 0) last else today
    }

    @JvmName("changeDailyGoal")
    fun setDailyGoal(goal: Int) {
        if (goal !in dailyGoals) return
        dailyGoal = goal
    }

    fun addGems(amount: Int) {
        gems += maxOf(0, amount)
    }

    /** Buys a streak freeze; false if there are not enough gems or two are in stock already. */
    fun buyFreeze(): Boolean {
        if (gems < freezePrice || freezes >= maxFreezes) return false
        gems -= freezePrice
        freezes += 1
        return true
    }

    /** Marks steps as done without a round of their own: the steps of a unit whose test was passed. */
    fun complete(nodeIDs: Collection<String>) {
        completedLessons.addAll(nodeIDs)
    }

    /** Opens a chest once: false if it was open already. */
    fun openChest(nodeID: String, gems: Int): Boolean {
        if (nodeID in completedLessons) return false
        completedLessons.add(nodeID)
        addGems(gems)
        return true
    }

    /**
     * Counts a finished lesson; null if this run was counted before or had no exercise to count. `completes` is false
     * for a round that belongs to no step of the path (a practice round on chosen goals): it earns XP and keeps the
     * streak, and marks nothing as done.
     */
    fun record(result: LessonResult, now: Long, calendar: LearnCalendar, courseID: String? = null, completes: Boolean = true): Reward? {
        if (result.exerciseCount <= 0 || result.sessionID in recentRuns) return null
        recentRuns.add(result.sessionID)
        if (recentRuns.size > rememberedRuns) {
            recentRuns = recentRuns.subList(recentRuns.size - rememberedRuns, recentRuns.size).toMutableList()
        }

        val today = day(now, calendar)
        val earned = xp(result)
        if (xpDay != today) {
            xpDay = today
            xpOfDay = 0
        }
        xpOfDay += earned
        totalXP += earned
        if (courseID != null) courseXP[courseID] = (courseXP[courseID] ?: 0) + earned
        val goalReached = goalReachedDay != today && xpOfDay >= dailyGoal
        if (goalReached) goalReachedDay = today

        var extended = false
        var used = 0
        if (lastLessonDay != today) {
            val last = lastLessonDay
            val gap = if (last != null) daysTo(last, today) else null
            if (gap == 1) {
                streak += 1
            } else if (gap != null && gap > 1 && gap - 1 <= freezes) {
                // A freeze covers each skipped day, so the streak goes on.
                used = gap - 1
                freezes -= used
                streak += 1
            } else {
                streak = 1
            }
            lastLessonDay = today
            extended = true
        }
        longestStreak = maxOf(longestStreak, streak)
        if (completes) completedLessons.add(result.lessonID)
        val earnedGems = gemsFor(result) + (if (goalReached) gemsGoal else 0)
        addGems(earnedGems)
        return Reward(earned, xpOfDay, goalReached, streak, extended, earnedGems, used)
    }

    fun copy(): LearnProgress = fromJson(toJson())

    /** Persistence: the field names of the Swift Codable. Sets are written as sorted arrays, nil fields are left out. */
    fun toJson(): JsonObject = buildJsonObject {
        put("dailyGoal", dailyGoal)
        put("totalXP", totalXP)
        put("xpOfDay", xpOfDay)
        put("streak", streak)
        put("longestStreak", longestStreak)
        put("completedLessons", JsonArray(completedLessons.sorted().map { JsonPrimitive(it) }))
        put("recentRuns", JsonArray(recentRuns.map { JsonPrimitive(it) }))
        put("gems", gems)
        put("freezes", freezes)
        put("courseXP", JsonObject(courseXP.keys.sorted().associateWith { JsonPrimitive(courseXP.getValue(it)) }))
        xpDay?.let { put("xpDay", it.toJson()) }
        goalReachedDay?.let { put("goalReachedDay", it.toJson()) }
        lastLessonDay?.let { put("lastLessonDay", it.toJson()) }
    }

    override fun equals(other: Any?): Boolean = other is LearnProgress && toJson() == other.toJson()
    override fun hashCode(): Int = toJson().hashCode()
    override fun toString(): String = toJson().toString()

    companion object {
        val dailyGoals = listOf(20, 50, 100)
        const val defaultGoal = 20
        const val xpFirstTry = 10
        const val xpRetry = 5
        const val xpLesson = 20
        const val xpAccuracyBonus = 10

        /** Percent right on the first try for the bonus. */
        const val bonusPercent = 90

        /** Runs remembered to ignore the same result arriving twice. */
        const val rememberedRuns = 50
        const val gemsLesson = 2

        /** More for a lesson in which every exercise was right on the first try. */
        const val gemsPerfect = 3
        const val gemsGoal = 5
        const val freezePrice = 30
        const val maxFreezes = 2

        fun xp(result: LessonResult): Int {
            var xp = result.rightFirstTry * xpFirstTry + result.rightOnRetry * xpRetry + xpLesson
            if (result.exerciseCount > 0 && result.rightFirstTry * 100 >= result.exerciseCount * bonusPercent) xp += xpAccuracyBonus
            return xp
        }

        /** Gems for a lesson: a little for finishing it, more when nothing went wrong. */
        fun gemsFor(result: LessonResult): Int =
            gemsLesson + (if (result.exerciseCount > 0 && result.rightFirstTry == result.exerciseCount) gemsPerfect else 0)

        /**
         * Saved progress from an older version lacks the newer fields; each one falls back on its default. Anything
         * that is not a JSON object gives the default progress.
         */
        fun fromJson(json: JsonElement?): LearnProgress {
            val progress = LearnProgress()
            val o = json as? JsonObject ?: return progress
            val goal = o.field("dailyGoal", dInt, defaultGoal)
            progress.dailyGoal = if (goal in dailyGoals) goal else defaultGoal
            progress.totalXP = o.field("totalXP", dInt, 0)
            progress.xpOfDay = o.field("xpOfDay", dInt, 0)
            progress.xpDay = o.field("xpDay", dLearnDay, null)
            progress.goalReachedDay = o.field("goalReachedDay", dLearnDay, null)
            progress.streak = o.field("streak", dInt, 0)
            progress.longestStreak = maxOf(o.field("longestStreak", dInt, 0), progress.streak)
            progress.lastLessonDay = o.field("lastLessonDay", dLearnDay, null)
            progress.completedLessons = LinkedHashSet(o.field("completedLessons", dSet(dString), emptySet()))
            progress.recentRuns = o.field("recentRuns", dArray(dString), emptyList()).toMutableList()
            progress.gems = maxOf(0, o.field("gems", dInt, 0))
            progress.freezes = minOf(maxFreezes, maxOf(0, o.field("freezes", dInt, 0)))
            progress.courseXP = LinkedHashMap(o.field("courseXP", dRecord(dInt), emptyMap()))
            return progress
        }
    }
}
