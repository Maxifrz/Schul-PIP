package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.holidays.CalendarDay
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.TimeZone

class CalendarDayTest {
    @Test
    fun isoParsingRoundTrips() {
        val day = CalendarDay.parseIso("2026-05-14")
        assertEquals(CalendarDay(2026, 5, 14), day)
        assertEquals("2026-05-14", day?.iso)
        assertNull(CalendarDay.parseIso("2026/05/14"))
        assertNull(CalendarDay.parseIso("not-a-date"))
        assertNull(CalendarDay.parseIso("2026-05"))
    }

    @Test
    fun julianDayNumberRoundTripsAcrossAWideRange() {
        var day = CalendarDay(1970, 1, 1)
        repeat(5000) {
            val restored = CalendarDay.fromJulianDayNumber(day.julianDayNumber)
            assertEquals("round trip failed for $day", day, restored)
            day = day.adding(37)
        }
    }

    @Test
    fun knownWeekdays() {
        // 2024-01-01 was a Monday; well documented and independently checkable.
        assertEquals(1, CalendarDay(2024, 1, 1).weekday)
        assertEquals(7, CalendarDay(2024, 1, 7).weekday)
        // Christi Himmelfahrt is mathematically always 39 days after Easter Sunday, always a Thursday.
        assertEquals(4, CalendarDay.parseIso("2026-05-14")!!.weekday)
        assertTrue(CalendarDay(2024, 1, 6).isWeekend)
        assertTrue(CalendarDay(2024, 1, 7).isWeekend)
        assertFalse(CalendarDay(2024, 1, 5).isWeekend)
    }

    @Test
    fun addingDaysCrossesMonthsYearsAndLeapDays() {
        assertEquals(CalendarDay(2024, 2, 29), CalendarDay(2024, 2, 28).adding(1))
        assertEquals(CalendarDay(2025, 3, 1), CalendarDay(2025, 2, 28).adding(1))
        assertEquals(CalendarDay(2026, 1, 1), CalendarDay(2025, 12, 31).adding(1))
        assertEquals(CalendarDay(2025, 12, 31), CalendarDay(2026, 1, 1).adding(-1))
    }

    @Test
    fun daysSinceAndOrdering() {
        val a = CalendarDay(2026, 1, 1)
        val b = CalendarDay(2026, 3, 1)
        assertEquals(59, b.days(since = a)) // 2026 is not a leap year: 31 (Jan) + 28 (Feb)
        assertEquals(-59, a.days(since = b))
        assertTrue(a < b)
        assertEquals(listOf(a, b), listOf(b, a).sorted())
    }

    @Test
    fun serializationUsesIsoStrings() {
        val json = Json
        val text = json.encodeToString(CalendarDay.serializer(), CalendarDay(2026, 5, 14))
        assertEquals("\"2026-05-14\"", text)
        assertEquals(CalendarDay(2026, 5, 14), json.decodeFromString(CalendarDay.serializer(), text))
        val threw = runCatching { json.decodeFromString(CalendarDay.serializer(), "\"14.05.2026\"") }
        assertTrue(threw.isFailure)
    }

    @Test
    fun labels() {
        val day = CalendarDay(2026, 5, 14)
        assertEquals("Do. 14. Mai", day.germanLabel)
        assertEquals("14.05.2026", day.shortLabel)
        assertEquals("Di. 6. Januar", CalendarDay(2026, 1, 6).germanLabel)
    }

    @Test
    fun todayUsesTheGivenTimeZone() {
        val zone = TimeZone.getTimeZone("Europe/Berlin")
        val today = CalendarDay.today(zone)
        val calendar = java.util.Calendar.getInstance(zone)
        val expected = CalendarDay(calendar.get(java.util.Calendar.YEAR), calendar.get(java.util.Calendar.MONTH) + 1, calendar.get(java.util.Calendar.DAY_OF_MONTH))
        assertEquals(expected, today)
    }
}
