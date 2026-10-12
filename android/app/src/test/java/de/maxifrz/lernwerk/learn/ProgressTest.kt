package de.maxifrz.lernwerk.learn

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProgressTest {
    private val berlin = calendar("Europe/Berlin")
    private fun date(day: Int, hour: Int = 12, minute: Int = 0, month: Int = 10, cal: LearnCalendar = berlin) = at(cal, 2026, month, day, hour, minute)
    private var runs = 0

    private fun result(right: Int, of: Int, retry: Int = 0, lesson: String = "L1"): LessonResult {
        runs += 1
        return LessonResult(lesson, "run-$runs", of, right, retry, cardKeys = listOf("a"), cardsRightFirstTry = emptySet())
    }

    @Test fun xpTable() {
        // 10 per first try, 5 per right retry, 20 for the lesson, 10 more from 90 % right on the first try.
        assertEquals(80 + 10 + 20, LearnProgress.xp(result(8, 10, 2)))
        assertEquals(90 + 5 + 20 + 10, LearnProgress.xp(result(9, 10, 1)))
        assertEquals(100 + 20 + 10, LearnProgress.xp(result(10, 10)))
        assertEquals(270 + 20 + 10, LearnProgress.xp(result(27, 30)))
        assertEquals(260 + 20, LearnProgress.xp(result(26, 30)))
        assertEquals(15 + 20, LearnProgress.xp(result(0, 3, 3)))
        assertEquals(20, LearnProgress.xp(result(0, 0)))
    }

    @Test fun theDailyGoalIsReachedOncePerDay() {
        val progress = LearnProgress()
        assertEquals(20, progress.dailyGoal)
        progress.setDailyGoal(100)
        progress.setDailyGoal(30)
        assertEquals(100, progress.dailyGoal)

        fun lesson() = result(2, 4) // 40 XP
        assertEquals(false, progress.record(lesson(), date(9, 9), berlin)?.goalReached)
        assertEquals(false, progress.record(lesson(), date(9, 10), berlin)?.goalReached)
        val third = progress.record(lesson(), date(9, 11), berlin)
        assertEquals(true, third?.goalReached)
        assertEquals(120, third?.xpToday)
        assertEquals(false, progress.record(lesson(), date(9, 12), berlin)?.goalReached)
        assertEquals(1.0, progress.goalFraction(date(9, 13), berlin), 0.0)

        // A higher goal later that day is not celebrated again.
        progress.setDailyGoal(50)
        progress.setDailyGoal(100)
        assertEquals(false, progress.record(lesson(), date(9, 14), berlin)?.goalReached)

        assertEquals(false, progress.record(lesson(), date(10, 9), berlin)?.goalReached)
        assertEquals(0.4, progress.goalFraction(date(10, 9), berlin), 1e-4)
        assertEquals(6 * 40, progress.totalXP)
    }

    @Test fun xpTodayStartsAgainAtMidnight() {
        val progress = LearnProgress()
        progress.record(result(3, 4), date(9, 23, 50), berlin)
        assertEquals(50, progress.xpToday(date(9, 23, 59), berlin))
        assertEquals(0, progress.xpToday(date(10, 0, 1), berlin))
        progress.record(result(1, 4), date(10, 0, 5), berlin)
        assertEquals(30, progress.xpToday(date(10, 0, 6), berlin))
        assertEquals(80, progress.totalXP)
    }

    @Test fun theStreakContinuesBreaksAndCountsADayOnce() {
        val progress = LearnProgress()
        assertEquals(0, progress.currentStreak(date(1), berlin))
        assertEquals(1, progress.record(result(1, 1), date(1, 8), berlin)?.streak)
        val second = progress.record(result(1, 1), date(1, 20), berlin)
        assertEquals(1, second?.streak)
        assertEquals(false, second?.streakExtended)
        val nextDay = progress.record(result(1, 1), date(2, 7), berlin)
        assertEquals(2, nextDay?.streak)
        assertEquals(true, nextDay?.streakExtended)
        progress.record(result(1, 1), date(3, 22), berlin)
        assertEquals(3, progress.currentStreak(date(3, 23), berlin))
        // The day after, the streak still stands until midnight; a skipped day ends it.
        assertEquals(3, progress.currentStreak(date(4, 23, 59), berlin))
        assertEquals(0, progress.currentStreak(date(5, 0, 1), berlin))
        assertEquals(1, progress.record(result(1, 1), date(5, 9), berlin)?.streak)
        assertEquals(3, progress.longestStreak)
    }

    @Test fun theStreakAcrossDaylightSavingTime() {
        // Berlin switches to summer time on 29 March 2026 (23 hours) and back on 25 October (25 hours).
        val spring = LearnProgress()
        spring.record(result(1, 1), date(28, 23, 30, 3), berlin)
        assertEquals(2, spring.record(result(1, 1), date(29, 23, 30, 3), berlin)?.streak)
        assertEquals(3, spring.record(result(1, 1), date(30, 0, 10, 3), berlin)?.streak)

        val autumn = LearnProgress()
        autumn.record(result(1, 1), date(24, 0, 10), berlin)
        assertEquals(2, autumn.record(result(1, 1), date(25, 23, 50), berlin)?.streak)
        assertEquals(2, autumn.currentStreak(date(26, 23, 59), berlin))
        assertEquals(0, autumn.currentStreak(date(27, 0, 0), berlin))
    }

    @Test fun daysFollowTheCalendarsTimeZoneNotUtc() {
        val utc = calendar("UTC")
        val auckland = calendar("Pacific/Auckland")
        // 10:00 and 12:00 UTC on 9 October are 23:00 on the 9th and 01:00 on the 10th in Auckland.
        val late = date(9, 10, 0, 10, utc)
        val early = date(9, 12, 0, 10, utc)
        val there = LearnProgress()
        there.record(result(1, 1), late, auckland)
        assertEquals(2, there.record(result(1, 1), early, auckland)?.streak)
        assertEquals(40, there.xpToday(early, auckland))

        val inUTC = LearnProgress()
        inUTC.record(result(1, 1), late, utc)
        assertEquals(1, inUTC.record(result(1, 1), early, utc)?.streak)
        assertEquals(80, inUTC.xpToday(early, utc))

        assertEquals(1, daysTo(LearnDay(2026, 12, 31), LearnDay(2027, 1, 1)))
        assertEquals(LearnDay(2026, 10, 9), dayOf(late, auckland))
        assertEquals(LearnDay(2026, 10, 10), dayOf(early, auckland))
    }

    @Test fun aLocalDateThatGoesBackKeepsTheDay() {
        // Two lessons in Berlin on consecutive days, then one an hour later in New York, where it is the day before.
        val ny = calendar("America/New_York")
        val progress = LearnProgress()
        progress.setDailyGoal(50)
        progress.record(result(1, 1), date(9, 18), berlin)
        val second = progress.record(result(1, 1), date(10, 0, 30), berlin)
        assertEquals(2, second?.streak)
        assertEquals(false, second?.goalReached)
        val third = progress.record(result(1, 1), date(10, 0, 30) + 3600_000, ny)
        assertEquals(2, third?.streak)
        assertEquals(false, third?.streakExtended)
        assertEquals(80, third?.xpToday)
        assertEquals(true, third?.goalReached)
        assertEquals(80, progress.xpToday(date(10, 2), ny))
        assertEquals(2, progress.currentStreak(date(10, 2), ny))
        val fourth = progress.record(result(1, 1), date(10, 3), ny)
        assertEquals(false, fourth?.goalReached) // the goal is reached once on that day
        assertEquals(2, progress.longestStreak)
    }

    @Test fun finishedLessonsAreRememberedAndARunCountsOnce() {
        val progress = LearnProgress()
        val run = result(4, 4, lesson = "L7")
        assertNotNull(progress.record(run, date(9), berlin))
        assertNull(progress.record(run, date(9, 13), berlin))
        assertEquals(70, progress.totalXP)
        assertTrue(progress.isCompleted("L7"))
        assertEquals(setOf("L7"), progress.completedLessons)
        repeat(LearnProgress.rememberedRuns + 5) { progress.record(result(1, 1), date(9), berlin) }
        assertEquals(LearnProgress.rememberedRuns, progress.recentRuns.size)
    }

    @Test fun gemsFreezesAndCourseXp() {
        val progress = LearnProgress()
        assertEquals(0, progress.gems)
        val perfect = progress.record(result(4, 4), date(1, 9), berlin, courseID = "es")
        // 2 for the lesson, 3 for no mistake, 5 more for reaching the daily goal of 20 XP.
        assertEquals(10, perfect?.gems)
        assertEquals(10, progress.gems)
        assertEquals(70, progress.xpInCourse("es"))
        assertEquals(0, progress.xpInCourse("fr"))
        val flawed = progress.record(result(3, 4, 1), date(1, 10), berlin, courseID = "fr")
        assertEquals(2, flawed?.gems)
        assertEquals(55, progress.xpInCourse("fr"))
        assertEquals(125, progress.totalXP)

        assertFalse(progress.buyFreeze()) // not enough gems
        progress.addGems(100)
        assertTrue(progress.buyFreeze())
        assertTrue(progress.buyFreeze())
        assertFalse(progress.buyFreeze()) // two at most
        assertEquals(2, progress.freezes)
        assertEquals(12 + 100 - 60, progress.gems)

        // A freeze covers a skipped day: lessons on the 1st and the 3rd keep the streak.
        val covered = progress.record(result(1, 1), date(3, 9), berlin)
        assertEquals(2, covered?.streak)
        assertEquals(1, covered?.freezesUsed)
        assertEquals(1, progress.freezes)
        // Two skipped days with one freeze left break it.
        assertEquals(0, progress.currentStreak(date(6, 9), berlin))
        assertEquals(2, progress.currentStreak(date(5, 9), berlin)) // one skipped day, one freeze
        val broken = progress.record(result(1, 1), date(6, 9), berlin)
        assertEquals(1, broken?.streak)
        assertEquals(0, broken?.freezesUsed)
        assertEquals(1, progress.freezes) // a freeze that cannot save the streak stays
    }

    @Test fun chestsOpenOnce() {
        val progress = LearnProgress()
        assertTrue(progress.openChest("es.u01.k", 15))
        assertFalse(progress.openChest("es.u01.k", 15))
        assertEquals(15, progress.gems)
        assertTrue(progress.isCompleted("es.u01.k"))
        progress.addGems(-5)
        assertEquals(15, progress.gems)
    }

    private fun obj(build: kotlinx.serialization.json.JsonObjectBuilder.() -> Unit): JsonObject = buildJsonObject(build)

    @Test fun olderSavesWithoutGemsLoad() {
        val progress = LearnProgress.fromJson(obj { put("totalXP", 10); put("gems", -4); put("freezes", 9) })
        assertEquals(0, progress.gems)
        assertEquals(LearnProgress.maxFreezes, progress.freezes)
        assertEquals(0, progress.courseXP.size)
        val saved = LearnProgress()
        saved.addGems(7)
        saved.record(result(1, 1), date(1), berlin, courseID = "chess")
        assertEquals(saved, LearnProgress.fromJson(parseJsonOrNull(saved.toJson().toString())))
    }

    @Test fun aRunWithoutExercisesCountsNothing() {
        val progress = LearnProgress()
        assertNull(progress.record(result(0, 0), date(9), berlin))
        assertEquals(0, progress.totalXP)
        assertEquals(0, progress.currentStreak(date(9), berlin))
        assertEquals(0, progress.completedLessons.size)
    }

    @Test fun jsonRoundTrip() {
        val progress = LearnProgress()
        progress.setDailyGoal(50)
        progress.record(result(5, 6, lesson = "A"), date(8), berlin)
        progress.record(result(6, 6, lesson = "B"), date(9), berlin)
        val text = progress.toJson().toString()
        assertEquals(progress, LearnProgress.fromJson(parseJsonOrNull(text)))
    }

    @Test fun olderSavesLoadWithDefaults() {
        val older = obj {
            put("totalXP", 340); put("streak", 4)
            putJsonArray("completedLessons") { add(JsonPrimitive("L1")); add(JsonPrimitive("L2")) }
            put("dailyGoal", 35)
            putJsonObject("lastLessonDay") { put("year", 2026); put("month", 10); put("day", 8) }
        }
        val progress = LearnProgress.fromJson(older)
        assertEquals(340, progress.totalXP)
        assertEquals(LearnProgress.defaultGoal, progress.dailyGoal)
        assertEquals(4, progress.longestStreak)
        assertEquals(4, progress.currentStreak(date(9), berlin))
        assertEquals(setOf("L1", "L2"), progress.completedLessons)
        assertEquals(0, progress.xpToday(date(9), berlin))
        assertEquals(emptyList<String>(), progress.recentRuns)
        assertEquals(LearnProgress(), LearnProgress.fromJson(JsonObject(emptyMap())))
        assertEquals(0, LearnProgress.fromJson(obj { put("totalXP", "viel") }).totalXP)
    }

    @Test fun toleratesWrongTypesFieldByFieldAndADayWithoutAllParts() {
        val p = LearnProgress.fromJson(
            obj {
                put("totalXP", 12); put("streak", 2.5)
                putJsonArray("completedLessons") { add(JsonPrimitive("a")); add(JsonPrimitive(3)) }
                put("recentRuns", "x")
                putJsonObject("xpDay") { put("year", 2026); put("month", 10) }
                putJsonObject("lastLessonDay") { put("year", 2026); put("month", 10); put("day", 8) }
                putJsonObject("courseXP") { put("es", 5); put("fr", "x") }
                put("gems", kotlinx.serialization.json.JsonNull)
            },
        )
        assertEquals(12, p.totalXP)
        assertEquals(0, p.streak)
        assertEquals(0, p.completedLessons.size)
        assertEquals(emptyList<String>(), p.recentRuns)
        assertNull(p.xpDay)
        assertEquals(LearnDay(2026, 10, 8), p.lastLessonDay)
        assertEquals(emptyMap<String, Int>(), p.courseXP)
        assertEquals(LearnProgress(), LearnProgress.fromJson(null))
        assertEquals(LearnProgress(), LearnProgress.fromJson(JsonArray(listOf(JsonPrimitive(1), JsonPrimitive(2)))))
    }

    @Test fun theSwiftFieldNamesAreKept() {
        val progress = LearnProgress()
        progress.record(result(4, 4, lesson = "X"), date(1), berlin, courseID = "es")
        val json = progress.toJson()
        assertEquals(
            listOf("completedLessons", "courseXP", "dailyGoal", "freezes", "gems", "goalReachedDay", "lastLessonDay", "longestStreak", "recentRuns", "streak", "totalXP", "xpDay", "xpOfDay"),
            json.keys.sorted(),
        )
        assertEquals(LearnDay(2026, 10, 1).toJson(), json["lastLessonDay"])
    }

    @Test fun storeLoadsWhatAnOlderStoreSaved() {
        val storage = MemoryStore()
        storage.set(LearnProgressStore.key, """{"totalXP":120,"streak":2,"completedLessons":["L9"]}""")
        val store = LearnProgressStore(storage)
        assertEquals(120, store.progress.totalXP)
        assertTrue(store.progress.isCompleted("L9"))

        store.setDailyGoal(100)
        val run = result(4, 4, lesson = "L10")
        assertNotNull(store.record(run, date(9), berlin))
        assertNull(store.record(run, date(9), berlin))

        val reopened = LearnProgressStore(storage)
        assertEquals(store.progress, reopened.progress)
        assertEquals(100, reopened.progress.dailyGoal)
        assertEquals(190, reopened.progress.totalXP)
        assertEquals(setOf("L9", "L10"), reopened.progress.completedLessons)

        storage.set(LearnProgressStore.key, "kaputt")
        assertEquals(LearnProgress(), LearnProgressStore(storage).progress)
        assertEquals("learn.progress", LearnProgressStore.key)
    }

    @Test fun chestsGemsAndFreezesPersistListenersHearAboutChanges() {
        val storage = MemoryStore()
        val store = LearnProgressStore(storage)
        var changes = 0
        val stop = store.subscribe { changes += 1 }
        assertTrue(store.openChest("c.u01.k", 20))
        assertFalse(store.openChest("c.u01.k", 20))
        store.addGems(0)
        store.addGems(50)
        assertTrue(store.buyFreeze())
        assertEquals(3, changes)
        stop()
        store.addGems(1)
        assertEquals(3, changes)
        val reopened = LearnProgressStore(storage)
        assertEquals(20 + 50 - 30 + 1, reopened.progress.gems)
        assertEquals(1, reopened.progress.freezes)
    }

    // LearnProgressSkillsTests
    @Test fun aRoundOnChosenGoalsEarnsXpAndMarksNothingAsDone() {
        val utc = calendar("UTC")
        val now = 1_780_000_000_000L
        fun make(id: String, session: String = "s1") = LessonResult(id, session, 10, 9, 1)
        val progress = LearnProgress()
        val reward = progress.record(make("practice.es"), now, utc, courseID = "es", completes = false)
        assertNotNull(reward)
        assertTrue(progress.totalXP > 0)
        assertEquals(progress.totalXP, progress.xpInCourse("es"))
        assertEquals(0, progress.completedLessons.size)
        assertEquals(1, progress.currentStreak(now, utc))

        val other = LearnProgress()
        assertNotNull(other.record(make("es.u01.l1"), now, utc, courseID = "es"))
        assertTrue(other.completedLessons.contains("es.u01.l1"))
        val xp = other.totalXP
        assertNull(other.record(make("es.u01.l1"), now, utc, courseID = "es")) // the same run is not counted twice
        assertEquals(xp, other.totalXP)
        assertEquals(make("x"), make("x"))
        assertEquals(emptyList<Any>(), make("x").outcomes)
    }

    @Test fun passingAUnitTestMarksItsStepsDoneAndStoresThem() {
        val storage = MemoryStore()
        val store = LearnProgressStore(storage)
        store.complete(listOf("a", "b"))
        assertEquals(setOf("a", "b"), LearnProgressStore(storage).progress.completedLessons)
    }
}
