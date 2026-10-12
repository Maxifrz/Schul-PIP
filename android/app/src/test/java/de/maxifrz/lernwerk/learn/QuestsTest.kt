package de.maxifrz.lernwerk.learn

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QuestsTest {
    private fun berlin() = calendar("Europe/Berlin", 2)
    private fun date(day: Int, hour: Int = 12, month: Int = 10, zone: String = "Europe/Berlin") = at(calendar(zone, 2), 2026, month, day, hour)

    private fun event(xp: Int = 40, courseID: String? = "es", nodeKind: NodeKind? = NodeKind.LESSON, rightFirstTry: Int = 8, exerciseCount: Int = 10) =
        QuestEvent(xp, courseID, nodeKind, rightFirstTry, exerciseCount)

    private val fixture = readJson(TestPaths.content("fixtures/quests.json")).jsonObject
    private fun parseDay(text: String): LearnDay {
        val (y, m, d) = text.split('-').map { it.toInt() }
        return LearnDay(y, m, d)
    }

    private fun check(q: Quest, expected: JsonObject) {
        assertEquals(expected["id"]!!.jsonPrimitive.content, q.id)
        assertEquals(expected["kind"]!!.jsonPrimitive.content, q.kind.raw)
        assertEquals(expected["reward"]!!.jsonPrimitive.int, q.reward)
        assertEquals(expected["target"]!!.jsonPrimitive.int, q.target)
        assertEquals(expected["title"]!!.jsonPrimitive.content, q.title)
    }

    // Against the Swift fixture

    @Test fun hasTheDaysAndWeeksThatWereExported() {
        assertEquals(120, fixture["daily"]!!.jsonArray.size)
        assertEquals(30, fixture["weekly"]!!.jsonArray.size)
    }

    @Test fun dailyQuestsMatchFor120Days() {
        for (entry in fixture["daily"]!!.jsonArray.map { it.jsonObject }) {
            val quests = QuestBoard.dailyQuests(parseDay(entry["day"]!!.jsonPrimitive.content))
            val expected = entry["quests"]!!.jsonArray.map { it.jsonObject }
            assertEquals(expected.size, quests.size)
            quests.zip(expected).forEach { (q, e) -> check(q, e) }
        }
    }

    @Test fun weeklyQuestMatchesForEveryExportedWeek() {
        for (entry in fixture["weekly"]!!.jsonArray.map { it.jsonObject }) {
            val start = parseDay(entry["start"]!!.jsonPrimitive.content)
            check(QuestBoard.weeklyQuest(start), entry["quest"]!!.jsonObject)
            assertEquals(2, weekdayOf(start))
        }
    }

    // QuestBoard

    @Test fun aDaysQuestsComeFromTheDateAlone() {
        val day = LearnDay(2026, 10, 10)
        val first = QuestBoard.dailyQuests(day)
        assertEquals(first, QuestBoard.dailyQuests(day))
        assertEquals(3, first.size)
        assertEquals(3, first.map { it.kind }.toSet().size)
        assertTrue(first[0].kind in listOf(QuestKind.XP, QuestKind.LESSONS))
        val kinds = mutableSetOf<QuestKind>()
        val firsts = mutableSetOf<QuestKind>()
        for (offset in 1..28) {
            val quests = QuestBoard.dailyQuests(LearnDay(2026, 11, offset))
            assertEquals(3, quests.map { it.kind }.toSet().size)
            assertTrue(quests.all { it.target > 0 && it.reward > 0 && it.title != "" })
            assertFalse(quests.any { it.kind == QuestKind.DAYS })
            kinds.addAll(quests.map { it.kind })
            firsts.add(quests[0].kind)
        }
        assertTrue(kinds.size >= 5) // a month shows most kinds
        assertEquals(setOf(QuestKind.XP, QuestKind.LESSONS), firsts)
        assertEquals(3, QuestBoard.dailyQuests(day).map { it.id }.toSet().size)
    }

    private fun q(kind: QuestKind, target: Int) = Quest("a", kind, target, 0, 10, false)

    @Test fun titles() {
        assertEquals("Sammle 50 XP", q(QuestKind.XP, 50).title)
        assertEquals("Schließe eine Lektion ab", q(QuestKind.LESSONS, 1).title)
        assertEquals("Schließe 3 Lektionen ab", q(QuestKind.LESSONS, 3).title)
        assertEquals("Eine Lektion ohne Fehler", q(QuestKind.PERFECT, 1).title)
        assertEquals("Lerne in 2 verschiedenen Kursen", q(QuestKind.COURSES, 2).title)
        assertEquals("Lerne an 5 Tagen", q(QuestKind.DAYS, 5).title)
        assertEquals("3 Lektionen ohne Fehler", q(QuestKind.PERFECT, 3).title)
        assertEquals("Beantworte 15 Aufgaben auf Anhieb richtig", q(QuestKind.FIRST_TRY, 15).title)
        assertEquals("Schließe eine Übungsrunde ab", q(QuestKind.PRACTICE, 1).title)
        assertEquals("Schließe 2 Übungsrunden ab", q(QuestKind.PRACTICE, 2).title)
    }

    @Test fun roundsMoveTheQuestsAndFinishThemOnce() {
        val board = QuestBoard()
        board.refresh(date(10), berlin())
        assertEquals(3, board.daily.size)
        assertNotNull(board.weekly)
        assertEquals(0, board.dailyDone)

        var done = 0
        var rounds = 0
        while (board.dailyDone < 3 && rounds < 60) {
            val finished = board.apply(
                event(xp = 100, courseID = if (rounds % 3 == 0) "fr" else "es", nodeKind = if (rounds % 2 == 0) NodeKind.PRACTICE else NodeKind.LESSON, rightFirstTry = 10, exerciseCount = 10),
                date(10), berlin(),
            )
            done += finished.count { it.id.startsWith("d.") }
            rounds += 1
        }
        assertEquals(3, board.dailyDone) // rounds in two courses, practice and lessons finish every kind
        assertEquals(3, done) // each quest is reported as finished exactly once
        assertEquals(emptyList<Quest>(), board.apply(event(xp = 100), date(10), berlin()).filter { it.id.startsWith("d.") })
    }

    @Test fun nothingCountsForARoundWithoutExercises() {
        val board = QuestBoard()
        assertEquals(emptyList<Quest>(), board.apply(event(xp = 20, rightFirstTry = 0, exerciseCount = 0), date(10), berlin()))
        assertEquals(listOf(0, 0, 0), board.daily.map { it.progress })
        assertEquals(0, board.weekly?.progress)
    }

    @Test fun eachKindCountsWhatItSays() {
        fun progress(kind: QuestKind, events: List<QuestEvent>): Int {
            val board = QuestBoard()
            board.refresh(date(10), berlin())
            // Put a quest of this kind in place of the first one, through the persisted form like the Swift test.
            board.daily[0] = Quest("t", kind, 99, 0, 1, false)
            val live = board.copy()
            for (e in events) live.apply(e, date(10), berlin())
            return live.daily[0].progress
        }
        val perfect = event(xp = 30, nodeKind = NodeKind.LESSON, rightFirstTry = 10, exerciseCount = 10)
        val flawed = event(xp = 20, nodeKind = NodeKind.PRACTICE, rightFirstTry = 7, exerciseCount = 10)
        assertEquals(50, progress(QuestKind.XP, listOf(perfect, flawed)))
        assertEquals(2, progress(QuestKind.LESSONS, listOf(perfect, flawed)))
        assertEquals(2, progress(QuestKind.PERFECT, listOf(perfect, flawed, perfect)))
        assertEquals(17, progress(QuestKind.FIRST_TRY, listOf(perfect, flawed)))
        assertEquals(2, progress(QuestKind.PRACTICE, listOf(perfect, flawed, flawed)))
        assertEquals(2, progress(QuestKind.COURSES, listOf(event(courseID = "es"), event(courseID = "es"), event(courseID = "fr"), event(courseID = null))))
        assertEquals(0, progress(QuestKind.DAYS, listOf(perfect)))
    }

    @Test fun claimingPaysOnceAndTheBonusNeedsAllThree() {
        val board = QuestBoard()
        board.refresh(date(10), berlin())
        assertEquals(0, board.claim(board.daily[0].id)) // not done yet
        repeat(40) { board.apply(event(xp = 100, nodeKind = NodeKind.PRACTICE, rightFirstTry = 10, exerciseCount = 10), date(10), berlin()) }
        val ready = board.daily.filter { it.progress >= it.target }
        assertTrue(ready.size >= 2)
        assertTrue(board.hasUnclaimed)
        var paid = 0
        for (quest in board.daily) {
            if (quest.progress < quest.target) continue
            val gems = board.claim(quest.id)
            assertEquals(quest.reward, gems)
            assertEquals(0, board.claim(quest.id)) // only once
            paid += gems
        }
        assertTrue(paid > 0)
        assertEquals(if (board.allDailyClaimed) QuestBoard.bonusGems else 0, board.claimBonus())
        assertEquals(0, board.claimBonus()) // the bonus is paid once
        assertEquals(0, board.claim("nonsense"))
    }

    @Test fun aNewDayStartsNewQuestsAndTheOldProgressGoes() {
        val board = QuestBoard()
        board.apply(event(xp = 60), date(10, 22), berlin())
        val before = board.daily.toList()
        assertTrue(board.daily[0].progress > 0)
        board.refresh(date(11, 1), berlin())
        assertNotEquals(before.map { it.id }, board.daily.map { it.id })
        assertEquals(listOf(0, 0, 0), board.daily.map { it.progress })
        assertFalse(board.bonusClaimed)
        // The same day again changes nothing.
        val same = board.copy()
        board.refresh(date(11, 23), berlin())
        assertEquals(same, board)
    }

    @Test fun theWeeklyQuestCountsFromMondayToSunday() {
        val board = QuestBoard()
        board.refresh(date(7), berlin())
        val lastWeek = board.weekly
        assertEquals(LearnDay(2026, 10, 5), board.weekStart)
        board.apply(event(xp = 50), date(7), berlin())
        board.apply(event(xp = 50), date(11), berlin())
        assertTrue((board.weekly?.progress ?: 0) > 0)
        board.refresh(date(12, 8), berlin())
        assertEquals(LearnDay(2026, 10, 12), board.weekStart)
        assertNotEquals(lastWeek?.id, board.weekly?.id)
        assertEquals(0, board.weekly?.progress)

        // The days kind counts days, not rounds.
        var days = QuestBoard()
        var found = false
        var week = 5
        while (week <= 26) {
            val attempt = QuestBoard()
            attempt.refresh(date(week), berlin())
            if (attempt.weekly?.kind == QuestKind.DAYS) { days = attempt; found = true; break }
            week += 7
        }
        assertTrue(found) // one of the first weeks asks for days
        val start = days.weekStart!!
        for (offset in 0 until 3) {
            val now = at(berlin(), start.year, start.month, start.day + offset, 10)
            days.apply(event(), now, berlin())
            days.apply(event(), now + 3600_000, berlin())
        }
        assertEquals(3, days.weekly?.progress)
    }

    @Test fun theFirstWeekdayOfTheCalendarDecidesWhereTheWeekStarts() {
        val sunday = LearnCalendar("Europe/Berlin", 1)
        val board = QuestBoard()
        board.refresh(date(7), sunday)
        assertEquals(LearnDay(2026, 10, 4), board.weekStart)
    }

    @Test fun theClockGoingBackKeepsTheLaterDay() {
        val board = QuestBoard()
        board.refresh(date(10, 23), berlin())
        val ids = board.daily.map { it.id }
        board.refresh(date(10, 23) + 3 * 3600_000, calendar("America/Los_Angeles", 2))
        assertEquals(ids, board.daily.map { it.id })
        val later = QuestBoard()
        later.refresh(date(12, 9), berlin())
        val kept = later.daily.map { it.id }
        later.refresh(date(10, 9), berlin())
        assertEquals(kept, later.daily.map { it.id }) // a date before the board's day does not bring old quests back
    }

    @Test fun timeUntilMidnightAcrossDaylightSavingTime() {
        assertEquals(3600.0, QuestBoard.secondsUntilNextDay(date(10, 23), berlin()), 0.5)
        assertEquals(25 * 3600.0, QuestBoard.secondsUntilNextDay(date(25, 0), berlin()), 0.5)
    }

    @Test fun savedBoardsRoundTripAndOlderOnesLoad() {
        val board = QuestBoard()
        board.apply(event(xp = 70), date(10), berlin())
        assertEquals(board, QuestBoard.fromJson(parseJsonOrNull(board.toJson().toString())))
        val older = QuestBoard.fromJson(JsonObject(emptyMap()))
        assertEquals(QuestBoard(), older)
        assertEquals(emptyList<Quest>(), older.daily)
        assertFalse(older.hasUnclaimed)
    }

    @Test fun decodingIsAsStrictAsTheSwiftCodableWhereItIsSynthesized() {
        // A quest without "claimed" makes the whole list fall back; a broken weekly quest is dropped alone.
        val board = QuestBoard.fromJson(
            parseJsonOrNull(
                """{"daily":[{"id":"x","kind":"xp","target":3,"progress":0,"reward":1}],
                    "weekly":{"id":"w","kind":"weird","target":3,"progress":0,"reward":1,"claimed":false},
                    "bonusClaimed":"yes","weekXP":12,
                    "weekDays":[{"year":2026,"month":10,"day":5},{"year":2026,"month":10,"day":5}]}""",
            ),
        )
        assertEquals(emptyList<Quest>(), board.daily)
        assertNull(board.weekly)
        assertFalse(board.bonusClaimed)
        assertEquals(12, board.weekXP)
        assertEquals(listOf(LearnDay(2026, 10, 5)), board.weekDays)
        assertEquals(7, QuestKind.values().size)
        assertEquals(JsonPrimitive(1), JsonPrimitive(1))
    }

    // QuestStore

    @Test fun storeKeepsTheBoardAndPaysOnce() {
        val storage = MemoryStore()
        val cal = berlin()
        val store = QuestStore(storage)
        store.refresh(date(10), cal)
        assertEquals(3, store.board.daily.size)
        repeat(40) { store.record(event(xp = 100, nodeKind = NodeKind.PRACTICE, rightFirstTry = 10, exerciseCount = 10), date(10), cal) }
        val quest = store.board.daily.first { it.progress >= it.target }
        assertEquals(quest.reward, store.claim(quest.id))
        assertEquals(0, store.claim(quest.id))
        val reopened = QuestStore(storage)
        assertEquals(store.board, reopened.board)
        assertEquals(0, reopened.claim(quest.id)) // a claimed quest stays claimed
        for (other in reopened.board.daily.toList()) if (other.progress >= other.target) reopened.claim(other.id)
        if (reopened.board.bonusAvailable) {
            assertEquals(QuestBoard.bonusGems, reopened.claim(QuestStore.bonusID))
            assertEquals(0, reopened.claim(QuestStore.bonusID))
        }
        assertEquals("learn.quests", QuestStore.key)
    }

    @Test fun brokenDataStartsAnEmptyBoard() {
        val storage = MemoryStore()
        storage.set(QuestStore.key, "{nope")
        assertEquals(QuestBoard(), QuestStore(storage).board)
        storage.set(QuestStore.key, "[]")
        assertEquals(QuestBoard(), QuestStore(storage).board)
    }
}
