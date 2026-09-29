package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.holidays.Bundesland
import de.maxifrz.lernwerk.holidays.CalendarDay
import de.maxifrz.lernwerk.holidays.HolidayCalendar
import de.maxifrz.lernwerk.holidays.HolidayData
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * The states the bundled JSON actually ships, decoded independently of [HolidayCalendar] so a mismatch in
 * [Bundesland]'s entries (one added, renamed or removed on either side) fails loudly instead of just reading as
 * "no data for that state".
 */
@Serializable
private data class RawState(val code: String)

@Serializable
private data class RawBundle(val states: List<RawState>)

class HolidayCalendarTest {
    @Test
    fun bundeslandEntriesMatchTheBundledStates() {
        val raw = Json { ignoreUnknownKeys = true }.decodeFromString(RawBundle.serializer(), HolidayData.JSON)
        val bundled = raw.states.map { it.code }.toSet()
        val entries = Bundesland.entries.map { it.code }.toSet()
        assertEquals(bundled, entries)
        assertEquals(16, bundled.size)
    }

    @Test
    fun everyStateHasHolidaysCoveringSeveralYears() {
        for (state in Bundesland.entries) {
            val school = HolidayCalendar.schoolHolidays(state)
            assertTrue("${state.code} has too few school holidays bundled", school.size > 20)
            assertEquals(school, school.sortedBy { it.start })
            for (holiday in school) {
                assertTrue("${holiday.name} in ${state.code} ends before it starts", holiday.start <= holiday.end)
            }
            val years = school.map { it.start.year }.toSet()
            assertTrue("${state.code} should cover several years", years.size >= 4)
        }
    }

    @Test
    fun publicHolidaysIncludeNationwideOnesEverywhere() {
        val nationwide = HolidayCalendar.publicHolidays(Bundesland.BW).filter { it.name == "Neujahr" }
        assertTrue(nationwide.isNotEmpty())
        for (state in Bundesland.entries) {
            val names = HolidayCalendar.publicHolidays(state).map { it.name }.toSet()
            assertTrue("${state.code} is missing Neujahr", names.contains("Neujahr"))
            assertTrue("${state.code} is missing Tag der Arbeit", names.contains("Tag der Arbeit"))
        }
        val bw = HolidayCalendar.publicHolidays(Bundesland.BW)
        assertEquals(bw, bw.sortedBy { it.date })
    }

    @Test
    fun isSchoolDayComposesWeekendsHolidaysAndFerien() {
        val state = Bundesland.BY
        val holiday = HolidayCalendar.schoolHolidays(state).firstOrNull { it.end.days(since = it.start) >= 2 }
            ?: return fail("expected at least one multi-day school holiday")
        var day = holiday.start
        while (day <= holiday.end) {
            assertFalse("$day is inside ${holiday.name}, should not be a school day", HolidayCalendar.isSchoolDay(day, state))
            day = day.adding(1)
        }
        val feiertag = HolidayCalendar.publicHolidays(state)
            .firstOrNull { !it.date.isWeekend && !HolidayCalendar.isSchoolHoliday(it.date, state) }
            ?: return fail("expected a public holiday outside the school holidays")
        assertFalse(HolidayCalendar.isSchoolDay(feiertag.date, state))
        // A Saturday is never a school day, holiday or not.
        var saturday = CalendarDay.today()
        while (saturday.weekday != 6) saturday = saturday.adding(1)
        assertFalse(HolidayCalendar.isSchoolDay(saturday, state))
    }

    @Test
    fun currentAndNextSchoolHoliday() {
        val state = Bundesland.BY
        val holiday = HolidayCalendar.schoolHolidays(state).firstOrNull { it.end.days(since = it.start) >= 1 }
            ?: return fail("need a multi-day holiday")
        assertEquals(holiday, HolidayCalendar.currentSchoolHoliday(holiday.start, state))
        assertEquals(holiday, HolidayCalendar.currentSchoolHoliday(holiday.end, state))
        assertEquals(holiday, HolidayCalendar.nextSchoolHoliday(holiday.start, state))

        val dayBefore = holiday.start.adding(-1)
        if (HolidayCalendar.currentSchoolHoliday(dayBefore, state) == null) {
            assertEquals(holiday, HolidayCalendar.nextSchoolHoliday(dayBefore, state))
        }
        // Long after the bundled data ends, there is nothing more to find.
        assertNull(HolidayCalendar.nextSchoolHoliday(CalendarDay(2099, 1, 1), state))
    }

    @Test
    fun nextPublicHoliday() {
        val state = Bundesland.BY
        val holiday = HolidayCalendar.publicHolidays(state).firstOrNull { it.date > CalendarDay(2020, 1, 1) }
            ?: return fail("expected public holidays after 2020")
        assertEquals(holiday, HolidayCalendar.nextPublicHoliday(holiday.date, state))
        val dayBefore = holiday.date.adding(-1)
        if (!HolidayCalendar.isPublicHoliday(dayBefore, state)) {
            assertEquals(holiday.date, HolidayCalendar.nextPublicHoliday(dayBefore, state)?.date)
        }
    }

    @Test
    fun schoolDaysCountsOnlyRealSchoolDays() {
        val state = Bundesland.BY
        val holiday = HolidayCalendar.schoolHolidays(state).firstOrNull { it.end.days(since = it.start) >= 6 }
            ?: return fail("need a holiday spanning at least a week")
        assertEquals(0, HolidayCalendar.schoolDays(holiday.start, holiday.end, state))
        // A reversed range counts nothing rather than crashing or going negative.
        assertEquals(0, HolidayCalendar.schoolDays(holiday.end, holiday.start, state))
        var probe = holiday.end.adding(1)
        while (!HolidayCalendar.isSchoolDay(probe, state)) probe = probe.adding(1)
        assertEquals(1, HolidayCalendar.schoolDays(probe, probe, state))
    }

    @Test
    fun schoolDaysIsAdditiveAcrossASplitRange() {
        val state = Bundesland.TH
        val start = CalendarDay(2026, 3, 1)
        val end = CalendarDay(2026, 7, 1)
        val split = CalendarDay(2026, 5, 1)
        val whole = HolidayCalendar.schoolDays(start, end, state)
        val firstHalf = HolidayCalendar.schoolDays(start, split, state)
        val secondHalf = HolidayCalendar.schoolDays(split.adding(1), end, state)
        assertEquals(whole, firstHalf + secondHalf)
    }

    @Test
    fun schoolDaysOverAnUndisturbedFullWeekIsFive() {
        val state = Bundesland.NW
        var monday = CalendarDay(2027, 3, 1)
        while (monday.weekday != 1) monday = monday.adding(1)
        repeat(200) {
            val sunday = monday.adding(6)
            val clean = HolidayCalendar.schoolHolidays(state).none { it.start <= sunday && it.end >= monday } &&
                HolidayCalendar.publicHolidays(state).none { it.date >= monday && it.date <= sunday }
            if (clean) {
                assertEquals(5, HolidayCalendar.schoolDays(monday, sunday, state))
                return
            }
            monday = monday.adding(7)
        }
        fail("could not find a clean week in the bundled range to test with")
    }
}
