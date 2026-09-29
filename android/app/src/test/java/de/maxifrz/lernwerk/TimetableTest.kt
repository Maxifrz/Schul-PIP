package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.holidays.Bundesland
import de.maxifrz.lernwerk.holidays.CalendarDay
import de.maxifrz.lernwerk.holidays.ClockTime
import de.maxifrz.lernwerk.holidays.ExamCountdown
import de.maxifrz.lernwerk.holidays.HolidayCalendar
import de.maxifrz.lernwerk.holidays.TimetableLayout
import de.maxifrz.lernwerk.holidays.Weekday
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

private typealias Entry = TimetableLayout.Entry

class TimetableTest {
    @Test
    fun nonOverlappingEntriesEachTakeTheFullWidth() {
        val entries = listOf(
            Entry(1, 480, 525),
            Entry(1, 525, 570),
            Entry(2, 480, 525),
        )
        val placements = TimetableLayout.placements(entries)
        assertEquals(
            listOf(
                TimetableLayout.Placement(0, 0, 1),
                TimetableLayout.Placement(1, 0, 1),
                TimetableLayout.Placement(2, 0, 1),
            ),
            placements,
        )
    }

    @Test
    fun twoOverlappingEntriesGetTwoColumns() {
        val entries = listOf(Entry(1, 480, 570), Entry(1, 500, 545))
        val placements = TimetableLayout.placements(entries).sortedBy { it.index }
        assertEquals(TimetableLayout.Placement(0, 0, 2), placements[0])
        assertEquals(TimetableLayout.Placement(1, 1, 2), placements[1])
    }

    @Test
    fun chainOfOverlapsNeverExceedsTheRealConcurrency() {
        val entries = listOf(Entry(1, 0, 10), Entry(1, 5, 15), Entry(1, 12, 20))
        val placements = TimetableLayout.placements(entries).sortedBy { it.index }
        assertEquals(setOf(2), placements.map { it.columns }.toSet())
        assertEquals(0, placements[0].column)
        assertEquals(1, placements[1].column)
        assertEquals(0, placements[2].column)
    }

    @Test
    fun threeAtOnceNeedThreeColumns() {
        val entries = listOf(Entry(3, 480, 570), Entry(3, 480, 570), Entry(3, 480, 570))
        val placements = TimetableLayout.placements(entries)
        assertEquals(setOf(0, 1, 2), placements.map { it.column }.toSet())
        assertTrue(placements.all { it.columns == 3 })
    }

    @Test
    fun differentWeekdaysDoNotInteract() {
        val entries = (1..5).map { Entry(it, 480, 1000) }
        val placements = TimetableLayout.placements(entries)
        assertTrue(placements.all { it.column == 0 && it.columns == 1 })
    }

    @Test
    fun dayRangeRoundsToFullHoursAndHasAFallback() {
        val empty = TimetableLayout.dayRange(emptyList())
        assertEquals(ClockTime.minutes(8, 0), empty.first)
        assertEquals(ClockTime.minutes(16, 0), empty.second)
        val range = TimetableLayout.dayRange(listOf(Entry(1, 465, 530), Entry(2, 800, 845)))
        assertEquals(ClockTime.minutes(7, 0), range.first)
        // The latest end, 14:05, is not a full hour, so it rounds up to 15:00.
        assertEquals(ClockTime.minutes(15, 0), range.second)
    }

    @Test
    fun clockTimeFormatting() {
        assertEquals("07:45", ClockTime.label(ClockTime.minutes(7, 45)))
        assertEquals("00:05", ClockTime.label(ClockTime.minutes(0, 5)))
        assertEquals(810, ClockTime.minutes(13, 30))
    }

    @Test
    fun weekdayLabels() {
        assertEquals("Mo", Weekday.MONDAY.shortLabel)
        assertEquals("Sonntag", Weekday.SUNDAY.label)
        assertEquals(7, Weekday.entries.size)
        assertEquals(Weekday.MONDAY, Weekday.fromNumber(1))
    }
}

class ExamCountdownTest {
    @Test
    fun daysLabel() {
        val today = CalendarDay(2026, 5, 1)
        assertEquals("heute", ExamCountdown.daysLabel(today, today))
        assertEquals("morgen", ExamCountdown.daysLabel(today, today.adding(1)))
        assertEquals("gestern", ExamCountdown.daysLabel(today, today.adding(-1)))
        assertEquals("in 5 Tagen", ExamCountdown.daysLabel(today, today.adding(5)))
        assertEquals("vor 5 Tagen", ExamCountdown.daysLabel(today, today.adding(-5)))
    }

    @Test
    fun schoolDaysLeftIsNullInThePast() {
        val today = CalendarDay(2026, 5, 1)
        assertNull(ExamCountdown.schoolDaysLeft(today, today.adding(-1), Bundesland.BY))
        assertNull(ExamCountdown.schoolDaysLabel(today, today.adding(-1), Bundesland.BY))
    }

    @Test
    fun schoolDaysLeftForTodayIsZeroButLabelReadsHeute() {
        val today = CalendarDay(2026, 5, 1)
        assertEquals(0, ExamCountdown.schoolDaysLeft(today, today, Bundesland.BY))
        assertEquals("heute", ExamCountdown.schoolDaysLabel(today, today, Bundesland.BY))
    }

    @Test
    fun schoolDaysLeftExcludesTodayButIncludesTheExamDay() {
        val state = Bundesland.NW
        var monday = CalendarDay(2027, 3, 1)
        while (monday.weekday != 1) monday = monday.adding(1)
        repeat(200) {
            val friday = monday.adding(4)
            val clean = HolidayCalendar.schoolHolidays(state).none { it.start <= friday && it.end >= monday } &&
                HolidayCalendar.publicHolidays(state).none { it.date >= monday && it.date <= friday }
            if (clean) {
                assertEquals(4, ExamCountdown.schoolDaysLeft(monday, friday, state))
                assertEquals("noch 4 Schultage", ExamCountdown.schoolDaysLabel(monday, friday, state))
                assertEquals("noch 1 Schultag", ExamCountdown.schoolDaysLabel(monday, monday.adding(1), state))
                return
            }
            monday = monday.adding(7)
        }
        fail("could not find a clean week in the bundled range")
    }
}
