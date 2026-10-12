package de.maxifrz.lernwerk.learn

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import java.io.File

// Helpers shared by the learn tests: calendars and dates the way the Swift tests build them, and the sample course.

fun calendar(zone: String = "Europe/Berlin", firstWeekday: Int = 1): LearnCalendar = LearnCalendar(zone, firstWeekday)

/** Epoch milliseconds of a wall-clock time in a zone (Swift: `calendar.date(from: DateComponents(...))`). */
fun at(cal: LearnCalendar, year: Int, month: Int, day: Int, hour: Int = 12, minute: Int = 0): Long =
    localToMs(cal, year, month, day, hour, minute, 0)

fun readJson(file: File): JsonElement = Json.parseToJsonElement(file.readText())

/** A course made of plain data, for the path's rules. A port of CourseSample.swift. */
fun sampleCourse(): Course {
    val units = (1..3).map { CourseUnit.standard("sample", it, "Einheit $it", "s", "Tipp") }
    return Course(
        id = "sample", title = "Beispiel", subtitle = "Test", kind = CourseKind.LANGUAGE, color = 0x336699, symbol = "globe",
        sections = listOf(CourseSection("sample.a", "A", units.take(2)), CourseSection("sample.b", "B", listOf(units[2]))),
    )
}

open class SampleCourse : CourseProvider {
    override val course: Course = sampleCourse()
    override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> = emptyList()
}
