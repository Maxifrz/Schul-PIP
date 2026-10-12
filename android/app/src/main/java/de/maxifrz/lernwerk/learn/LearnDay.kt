package de.maxifrz.lernwerk.learn

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.Instant

// Days in the student's calendar. A port of LearnDay (LearnProgress.swift) and of the Foundation `Calendar` calls the
// learning logic makes, with a zone id and a first weekday instead of a Calendar object. Time is always an epoch in
// milliseconds that the caller passes in; nothing here reads the clock.

/** A calendar for the learning logic: an IANA zone id and Foundation's `firstWeekday` (1 = Sunday, 2 = Monday). */
data class LearnCalendar(val zoneId: String, val firstWeekday: Int = 2) {
    internal val zone: ZoneId get() = zoneOf(zoneId)
}

private val zones = java.util.concurrent.ConcurrentHashMap<String, ZoneId>()
private fun zoneOf(id: String): ZoneId = zones.getOrPut(id) { ZoneId.of(id) }

/** A day as year, month and day in the student's calendar, so a saved day keeps its meaning across DST and zones. */
data class LearnDay(val year: Int, val month: Int, val day: Int) : Comparable<LearnDay> {
    /** Stable text for sets and sorting: "2026-10-9". */
    val key: String get() = "$year-$month-$day"

    override fun compareTo(other: LearnDay): Int =
        if (year != other.year) year.compareTo(other.year) else if (month != other.month) month.compareTo(other.month) else day.compareTo(other.day)
}

/** Days since 1970-01-01 of a civil date; months outside 1...12 roll over like Foundation's lenient date(from:). */
fun civilDays(year: Int, month: Int, day: Int): Long {
    val m0 = month - 1
    val y = year.toLong() + Math.floorDiv(m0, 12)
    val m = Math.floorMod(m0, 12) + 1
    val yy = if (m <= 2) y - 1 else y
    val era = Math.floorDiv(yy, 400L)
    val yoe = yy - era * 400
    val doy = (153 * (m + (if (m > 2) -3 else 9)) + 2) / 5
    val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146097 + doe - 719468 + (day - 1)
}

/** The civil date of a day count since 1970-01-01. */
fun civilFromDays(days: Long): LearnDay {
    val z = days + 719468
    val era = Math.floorDiv(z, 146097L)
    val doe = z - era * 146097
    val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
    val y = yoe + era * 400
    val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    val mp = (5 * doy + 2) / 153
    val day = (doy - (153 * mp + 2) / 5 + 1).toInt()
    val month = (if (mp < 10) mp + 3 else mp - 9).toInt()
    return LearnDay((if (month <= 2) y + 1 else y).toInt(), month, day)
}

private fun fieldsAt(ms: Long, calendar: LearnCalendar): LocalDateTime =
    Instant.ofEpochMilli(ms).atZone(calendar.zone).toLocalDateTime()

/** Offset of the zone from UTC at an instant, in milliseconds. */
fun utcOffsetMs(ms: Long, zoneId: String): Long =
    zoneOf(zoneId).rules.getOffset(Instant.ofEpochMilli(ms)).totalSeconds * 1000L

/**
 * The instant of a wall-clock time in the zone. A time that does not exist (the hour skipped when the clocks go
 * forward) moves ahead by the gap; a time that happens twice takes the first.
 */
fun localToMs(calendar: LearnCalendar, year: Int, month: Int, day: Int, hour: Int = 0, minute: Int = 0, second: Int = 0): Long {
    val local = LocalDate.ofEpochDay(civilDays(year, month, day)).atStartOfDay()
        .plusHours(hour.toLong()).plusMinutes(minute.toLong()).plusSeconds(second.toLong())
    return ZonedDateTime.ofLocal(local, calendar.zone, null).toInstant().toEpochMilli()
}

/** The day an instant falls on in the calendar. */
fun dayOf(nowMs: Long, calendar: LearnCalendar): LearnDay {
    val f = fieldsAt(nowMs, calendar)
    return LearnDay(f.year, f.monthValue, f.dayOfMonth)
}

/** Whole days from one day to another (civil dates, so a day of 23 or 25 hours is one day). */
fun daysTo(from: LearnDay, to: LearnDay): Int =
    (civilDays(to.year, to.month, to.day) - civilDays(from.year, from.month, from.day)).toInt()

/** The day `count` days after (or before) a day. */
fun adding(day: LearnDay, count: Int): LearnDay = civilFromDays(civilDays(day.year, day.month, day.day) + count)

/** Weekday of a day, as Foundation numbers them: 1 = Sunday ... 7 = Saturday. */
fun weekdayOf(day: LearnDay): Int = Math.floorMod(civilDays(day.year, day.month, day.day) + 4, 7L).toInt() + 1

/** The first day of the week an instant falls in (honoring `firstWeekday`). */
fun weekStart(nowMs: Long, calendar: LearnCalendar): LearnDay {
    val today = dayOf(nowMs, calendar)
    val offset = Math.floorMod(weekdayOf(today) - calendar.firstWeekday, 7)
    return adding(today, -offset)
}

/** The first instant of a day (midnight, or the first moment after it if midnight is skipped). */
fun startOfDayMs(day: LearnDay, calendar: LearnCalendar): Long = localToMs(calendar, day.year, day.month, day.day, 0, 0, 0)

/**
 * Seconds until the next local midnight, for the timer on the quest tile. Like Foundation, the next day is the start
 * of this day plus one calendar day at the same wall-clock time.
 */
fun secondsUntilNextDay(nowMs: Long, calendar: LearnCalendar): Double {
    val today = dayOf(nowMs, calendar)
    val start = startOfDayMs(today, calendar)
    val wall = fieldsAt(start, calendar)
    val tomorrow = adding(today, 1)
    val next = localToMs(calendar, tomorrow.year, tomorrow.month, tomorrow.day, wall.hour, wall.minute, wall.second)
    return maxOf(0.0, (next - nowMs) / 1000.0)
}
