package de.maxifrz.lernwerk.holidays

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import java.util.Calendar
import java.util.TimeZone

/**
 * A calendar date with no time or time zone: "2026-05-14" and nothing else. Arithmetic goes through the Julian day
 * number, so it is exact and gives the same answer everywhere, unlike subtracting timestamps across time zones or
 * daylight-saving changes.
 */
@Serializable(with = CalendarDay.Serializer::class)
data class CalendarDay(val year: Int, val month: Int, val day: Int) : Comparable<CalendarDay> {
    /** Fliegel & Van Flandern's Gregorian-to-Julian-day conversion; proleptic, so it also works before 1582. */
    val julianDayNumber: Int
        get() {
            val a = (14 - month) / 12
            val y = year + 4800 - a
            val m = month + 12 * a - 3
            return day + (153 * m + 2) / 5 + 365 * y + y / 4 - y / 100 + y / 400 - 32045
        }

    /** Monday = 1 ... Sunday = 7. */
    val weekday: Int
        get() = ((julianDayNumber % 7) + 7) % 7 + 1

    val isWeekend: Boolean get() = weekday >= 6

    fun adding(days: Int): CalendarDay = fromJulianDayNumber(julianDayNumber + days)

    /** Days from [other] to this day: positive when this day is later. */
    fun days(since: CalendarDay): Int = julianDayNumber - since.julianDayNumber

    override fun compareTo(other: CalendarDay): Int =
        compareValuesBy(this, other, { it.year }, { it.month }, { it.day })

    val iso: String get() = "%04d-%02d-%02d".format(year, month, day)

    override fun toString(): String = iso

    /** "Do. 14. Mai" — the weekday and day a student reads, month names always German. */
    val germanLabel: String
        get() {
            val weekdayNames = arrayOf("Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So.")
            val monthNames = arrayOf(
                "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember",
            )
            return "${weekdayNames[weekday - 1]} $day. ${monthNames[month - 1]}"
        }

    /** "14.05.2026", for compact rows. */
    val shortLabel: String get() = "%02d.%02d.%04d".format(day, month, year)

    object Serializer : KSerializer<CalendarDay> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("CalendarDay", PrimitiveKind.STRING)

        override fun serialize(encoder: Encoder, value: CalendarDay) = encoder.encodeString(value.iso)

        override fun deserialize(decoder: Decoder): CalendarDay {
            val text = decoder.decodeString()
            return parseIso(text) ?: throw IllegalArgumentException("Not a yyyy-MM-dd date: $text")
        }
    }

    companion object {
        fun fromJulianDayNumber(jdn: Int): CalendarDay {
            val a = jdn + 32044
            val b = (4 * a + 3) / 146097
            val c = a - (146097 * b) / 4
            val d = (4 * c + 3) / 1461
            val e = c - (1461 * d) / 4
            val m = (5 * e + 2) / 153
            val day = e - (153 * m + 2) / 5 + 1
            val month = m + 3 - 12 * (m / 10)
            val year = 100 * b + d - 4800 + m / 10
            return CalendarDay(year, month, day)
        }

        /** "2026-05-14", the format the bundled holiday data uses; null for anything else. */
        fun parseIso(iso: String): CalendarDay? {
            val parts = iso.split("-")
            if (parts.size != 3) return null
            val y = parts[0].toIntOrNull() ?: return null
            val m = parts[1].toIntOrNull() ?: return null
            val d = parts[2].toIntOrNull() ?: return null
            return CalendarDay(y, m, d)
        }

        /** Today, in the given time zone (the device's, by default) — the day the student is looking at. */
        fun today(zone: TimeZone = TimeZone.getDefault()): CalendarDay {
            val calendar = Calendar.getInstance(zone)
            return CalendarDay(calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1, calendar.get(Calendar.DAY_OF_MONTH))
        }
    }
}
