package de.maxifrz.lernwerk.holidays

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** The 16 German states, for Ferien and Feiertage; the value is the two-letter code the bundled data and
 * openholidaysapi.org use. */
enum class Bundesland(val code: String, val label: String) {
    BW("BW", "Baden-Württemberg"),
    BY("BY", "Bayern"),
    BE("BE", "Berlin"),
    BB("BB", "Brandenburg"),
    HB("HB", "Bremen"),
    HH("HH", "Hamburg"),
    HE("HE", "Hessen"),
    MV("MV", "Mecklenburg-Vorpommern"),
    NI("NI", "Niedersachsen"),
    NW("NW", "Nordrhein-Westfalen"),
    RP("RP", "Rheinland-Pfalz"),
    SL("SL", "Saarland"),
    SN("SN", "Sachsen"),
    ST("ST", "Sachsen-Anhalt"),
    SH("SH", "Schleswig-Holstein"),
    TH("TH", "Thüringen"),
    ;

    companion object {
        fun fromCode(code: String): Bundesland? = entries.firstOrNull { it.code == code }
    }
}

/** A block of school holidays, like "Herbstferien" from one day to another, both included. */
@Serializable
data class SchoolHoliday(val name: String, val start: CalendarDay, val end: CalendarDay) {
    fun contains(day: CalendarDay): Boolean = day >= start && day <= end
}

/** A single-day public holiday, like "Tag der Arbeit". */
@Serializable
data class PublicHoliday(val name: String, val date: CalendarDay)

/**
 * Bundled Ferien and Feiertage for every Bundesland, 2023–2029 (see calendar/README.md), with the lookups a
 * student's calendar needs: is today a school day, when is the next holiday, how many school days are left until an
 * exam. Pure JVM logic, no [android.content.Context] needed.
 */
object HolidayCalendar {
    @Serializable
    private data class Bundle(
        val states: List<StateInfo> = emptyList(),
        val nationalHolidays: List<PublicHoliday> = emptyList(),
        val regionalHolidays: Map<String, List<PublicHoliday>> = emptyMap(),
        val schoolHolidays: Map<String, List<SchoolHoliday>> = emptyMap(),
    )

    @Serializable
    private data class StateInfo(val code: String, val name: String)

    private val json = Json { ignoreUnknownKeys = true }

    // The bundled data is generated and checked by tests; a decode failure here would mean it is corrupted.
    private val bundle: Bundle = runCatching { json.decodeFromString(Bundle.serializer(), HolidayData.JSON) }.getOrDefault(Bundle())

    /** The school holidays of one state, earliest first. */
    fun schoolHolidays(state: Bundesland): List<SchoolHoliday> =
        (bundle.schoolHolidays[state.code] ?: emptyList()).sortedBy { it.start }

    /** The public holidays that apply in one state — nationwide ones plus its own — earliest first. */
    fun publicHolidays(state: Bundesland): List<PublicHoliday> =
        (bundle.nationalHolidays + (bundle.regionalHolidays[state.code] ?: emptyList())).sortedBy { it.date }

    fun isSchoolHoliday(day: CalendarDay, state: Bundesland): Boolean = schoolHolidays(state).any { it.contains(day) }

    fun isPublicHoliday(day: CalendarDay, state: Bundesland): Boolean = publicHolidays(state).any { it.date == day }

    /** Whether lessons happen on [day]: not a weekend, not a holiday, not a Feiertag. */
    fun isSchoolDay(day: CalendarDay, state: Bundesland): Boolean =
        !day.isWeekend && !isPublicHoliday(day, state) && !isSchoolHoliday(day, state)

    /** The holiday [day] currently falls in, if any. */
    fun currentSchoolHoliday(day: CalendarDay, state: Bundesland): SchoolHoliday? =
        schoolHolidays(state).firstOrNull { it.contains(day) }

    /** The next school holiday that has not started yet, or the one running now. */
    fun nextSchoolHoliday(from: CalendarDay, state: Bundesland): SchoolHoliday? =
        currentSchoolHoliday(from, state) ?: schoolHolidays(state).firstOrNull { it.start > from }

    /** The next public holiday from [from] on, [from] itself included. */
    fun nextPublicHoliday(from: CalendarDay, state: Bundesland): PublicHoliday? =
        publicHolidays(state).firstOrNull { it.date >= from }

    /**
     * School days from [start] through [end], both included when they are school days: how many more days of
     * school stand between now and an exam.
     */
    fun schoolDays(start: CalendarDay, end: CalendarDay, state: Bundesland): Int {
        if (end < start) return 0
        var count = 0
        var day = start
        while (day <= end) {
            if (isSchoolDay(day, state)) count++
            day = day.adding(1)
        }
        return count
    }
}
