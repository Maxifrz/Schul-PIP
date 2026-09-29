package de.maxifrz.lernwerk.holidays

/** Monday through Sunday, numbered like [CalendarDay.weekday] so the two line up without conversion. */
enum class Weekday(val number: Int) {
    MONDAY(1), TUESDAY(2), WEDNESDAY(3), THURSDAY(4), FRIDAY(5), SATURDAY(6), SUNDAY(7),
    ;

    val shortLabel: String get() = arrayOf("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")[number - 1]
    val label: String get() = arrayOf("Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag")[number - 1]

    companion object {
        fun fromNumber(number: Int): Weekday = entries.first { it.number == number }
    }
}

/** "07:45", minutes since midnight either way. */
object ClockTime {
    fun minutes(hour: Int, minute: Int): Int = hour * 60 + minute

    fun label(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)
}

/**
 * Positions overlapping lessons side by side, the way a calendar app lays out a day view, without needing a full
 * calendar UI library: entries that never overlap in time each get the full width; entries that do share a column
 * count and get their own column within it.
 */
object TimetableLayout {
    data class Entry(val weekday: Int, val start: Int, val end: Int)
    data class Placement(val index: Int, val column: Int, val columns: Int)

    /** One placement per entry, in the same order they were passed in. */
    fun placements(entries: List<Entry>): List<Placement> {
        val result = entries.indices.map { Placement(it, 0, 1) }.toMutableList()
        val weekdays = entries.map { it.weekday }.toSet()
        for (weekday in weekdays) {
            val dayIndices = entries.indices
                .filter { entries[it].weekday == weekday }
                .sortedWith(compareBy({ entries[it].start }, { entries[it].end }))
            for (cluster in overlapClusters(dayIndices, entries)) {
                assignColumns(cluster, entries, result)
            }
        }
        return result
    }

    /**
     * Splits time-sorted indices into runs where each entry starts before the cluster's running latest end — the
     * connected components of the overlap graph, even when not every pair in the group directly overlaps.
     */
    private fun overlapClusters(sorted: List<Int>, entries: List<Entry>): List<List<Int>> {
        val clusters = mutableListOf<List<Int>>()
        var current = mutableListOf<Int>()
        var runningEnd = Int.MIN_VALUE
        for (index in sorted) {
            val entry = entries[index]
            if (current.isEmpty() || entry.start < runningEnd) {
                current.add(index)
                runningEnd = maxOf(runningEnd, entry.end)
            } else {
                clusters.add(current)
                current = mutableListOf(index)
                runningEnd = entry.end
            }
        }
        if (current.isNotEmpty()) clusters.add(current)
        return clusters
    }

    /** Greedy column reuse: an entry takes the first column whose last entry has already ended. */
    private fun assignColumns(cluster: List<Int>, entries: List<Entry>, result: MutableList<Placement>) {
        val columnEnds = mutableListOf<Int>()
        val assigned = mutableMapOf<Int, Int>()
        for (index in cluster) {
            val entry = entries[index]
            val free = columnEnds.indexOfFirst { it <= entry.start }
            if (free >= 0) {
                columnEnds[free] = entry.end
                assigned[index] = free
            } else {
                columnEnds.add(entry.end)
                assigned[index] = columnEnds.size - 1
            }
        }
        val columns = columnEnds.size
        for (index in cluster) {
            result[index] = Placement(index, assigned[index] ?: 0, columns)
        }
    }

    /** The time span the grid should show, rounded to full hours, with a sensible default for an empty timetable. */
    fun dayRange(entries: List<Entry>): Pair<Int, Int> {
        if (entries.isEmpty()) return ClockTime.minutes(8, 0) to ClockTime.minutes(16, 0)
        val start = (entries.minOf { it.start } / 60) * 60
        val latestEnd = entries.maxOf { it.end }
        val end = if (latestEnd % 60 == 0) latestEnd else (latestEnd / 60 + 1) * 60
        return start to maxOf(end, start + 60)
    }
}
