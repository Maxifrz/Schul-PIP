package de.maxifrz.lernwerk.learn

import org.junit.Assert.assertEquals
import org.junit.Test

class DayTest {
    private val berlin = calendar("Europe/Berlin")
    private val utc = calendar("UTC")
    private val auckland = calendar("Pacific/Auckland")
    private fun d(y: Int, m: Int, day: Int) = LearnDay(y, m, day)

    @Test fun dayOfFollowsTheZoneNotUtc() {
        val late = at(utc, 2026, 10, 9, 10)
        val early = at(utc, 2026, 10, 9, 12)
        assertEquals(d(2026, 10, 9), dayOf(late, auckland))
        assertEquals(d(2026, 10, 10), dayOf(early, auckland))
        assertEquals(d(2026, 10, 9), dayOf(late, utc))
    }

    @Test fun countsDaysAcrossDstAndYearEnds() {
        assertEquals(1, daysTo(d(2026, 12, 31), d(2027, 1, 1)))
        assertEquals(2, daysTo(d(2026, 3, 28), d(2026, 3, 30)))
        assertEquals(2, daysTo(d(2026, 10, 24), d(2026, 10, 26)))
        assertEquals(-1, daysTo(d(2026, 10, 9), d(2026, 10, 8)))
        assertEquals(2, daysTo(d(2024, 2, 28), d(2024, 3, 1)))
    }

    @Test fun addsDaysWithRollover() {
        assertEquals(d(2027, 1, 2), adding(d(2026, 12, 30), 3))
        assertEquals(d(2026, 2, 28), adding(d(2026, 3, 1), -1))
        assertEquals(d(2028, 2, 29), adding(d(2028, 2, 28), 1))
    }

    @Test fun civilArithmeticRoundTrips() {
        var n = -800000L
        while (n < 800000L) {
            val c = civilFromDays(n)
            assertEquals(n, civilDays(c.year, c.month, c.day))
            n += 997
        }
        assertEquals(0L, civilDays(1970, 1, 1))
    }

    @Test fun weekdayAsFoundationNumbersIt() {
        assertEquals(2, weekdayOf(d(2026, 10, 12)))
        assertEquals(1, weekdayOf(d(2026, 10, 11)))
        assertEquals(5, weekdayOf(d(1970, 1, 1)))
    }

    @Test fun weekStartHonorsFirstWeekday() {
        val monday = calendar("Europe/Berlin", 2)
        val sunday = calendar("Europe/Berlin", 1)
        assertEquals(d(2026, 10, 5), weekStart(at(berlin, 2026, 10, 7), monday))
        assertEquals(d(2026, 10, 4), weekStart(at(berlin, 2026, 10, 7), sunday))
        assertEquals(d(2026, 10, 5), weekStart(at(berlin, 2026, 10, 11), monday))
        assertEquals(d(2026, 10, 11), weekStart(at(berlin, 2026, 10, 11), sunday))
        assertEquals(d(2026, 10, 12), weekStart(at(berlin, 2026, 10, 12, 0, 1), monday))
        assertEquals(d(2026, 12, 28), weekStart(at(berlin, 2027, 1, 1), monday))
    }

    @Test fun localToMsAndOffsets() {
        assertEquals(2 * 3600_000L, utcOffsetMs(at(berlin, 2026, 7, 1), "Europe/Berlin"))
        assertEquals(3600_000L, utcOffsetMs(at(berlin, 2026, 1, 1), "Europe/Berlin"))
        assertEquals(86_400_000L, at(utc, 1970, 1, 2, 0, 0))
        // 02:30 on 29 March 2026 does not exist in Berlin; it moves ahead to 03:30.
        assertEquals(localToMs(berlin, 2026, 3, 29, 3, 30), localToMs(berlin, 2026, 3, 29, 2, 30))
        // 02:30 on 25 October 2026 happens twice; the first one is meant.
        assertEquals(java.time.Instant.parse("2026-10-25T00:30:00Z").toEpochMilli(), localToMs(berlin, 2026, 10, 25, 2, 30))
    }

    @Test fun secondsUntilMidnightAcrossDst() {
        assertEquals(3600.0, secondsUntilNextDay(at(berlin, 2026, 10, 10, 23), berlin), 0.5)
        assertEquals(25 * 3600.0, secondsUntilNextDay(at(berlin, 2026, 10, 25, 0), berlin), 0.5)
        assertEquals(23 * 3600.0, secondsUntilNextDay(at(berlin, 2026, 3, 29, 0), berlin), 0.5)
        assertEquals(0.5, secondsUntilNextDay(at(berlin, 2026, 10, 10, 23, 59) + 59_500, berlin), 0.005)
    }

    @Test fun zoneWhoseMidnightIsSkipped() {
        val sp = LearnCalendar("America/Sao_Paulo", 1)
        val start = localToMs(sp, 2018, 11, 4, 0, 0)
        assertEquals(d(2018, 11, 4), dayOf(start, sp))
        assertEquals(d(2018, 11, 3), dayOf(start - 1000, sp))
        assertEquals(24 * 3600.0, secondsUntilNextDay(start, sp), 0.5)
    }
}
