package de.maxifrz.lernwerk.holidays

/**
 * How far away an exam is, in the two ways a student thinks about it: calendar days, and actual school days left to
 * prepare (weekends, Feiertage and Ferien do not count).
 */
object ExamCountdown {
    /** "heute", "morgen", "in 3 Tagen", "gestern", "vor 2 Tagen". */
    fun daysLabel(today: CalendarDay, day: CalendarDay): String {
        val diff = day.days(since = today)
        return when {
            diff == 0 -> "heute"
            diff == 1 -> "morgen"
            diff == -1 -> "gestern"
            diff > 0 -> "in $diff Tagen"
            else -> "vor ${-diff} Tagen"
        }
    }

    /** School days strictly between today and [day], [day] itself included when it is one; null once it is past. */
    fun schoolDaysLeft(today: CalendarDay, day: CalendarDay, state: Bundesland): Int? {
        if (day < today) return null
        if (day == today) return 0
        return HolidayCalendar.schoolDays(today.adding(1), day, state)
    }

    /** "heute", "noch 1 Schultag", "noch 12 Schultage", or null once the exam is in the past. */
    fun schoolDaysLabel(today: CalendarDay, day: CalendarDay, state: Bundesland): String? {
        val count = schoolDaysLeft(today, day, state) ?: return null
        if (day == today) return "heute"
        return if (count == 1) "noch 1 Schultag" else "noch $count Schultage"
    }
}
