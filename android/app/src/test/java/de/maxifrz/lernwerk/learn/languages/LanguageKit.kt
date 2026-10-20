package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.TestPaths
import java.io.File

// Helpers shared by the language course tests (the Swift tests lean on String/Character/CharacterSet), and the five
// providers built from content/courses/*.txt.

object LanguageTexts5 : CourseTextSource {
    override fun text(courseID: String): String = TestPaths.content("courses/$courseID.txt").readText()
}

object Languages {
    val all: LanguageProviders by lazy { LanguageProviders(LanguageTexts5) }
    val es get() = all.spanish
    val fr get() = all.french
    val la get() = all.latin
    val daf get() = all.germanForeign
    val de get() = all.germanSchool
    val byId: Map<String, LanguageCourseProvider> get() = mapOf("es" to es, "fr" to fr, "la" to la, "daf" to daf, "de" to de)
}

/** Characters (code points) of a text. */
fun chars(text: String): List<String> = text.codePoints().toArray().map { String(Character.toChars(it)) }
fun isLetter(c: String): Boolean = c.isNotEmpty() && Character.isLetter(c.codePointAt(0))
fun isUpper(c: String?): Boolean = c != null && c.isNotEmpty() && Character.isUpperCase(c.codePointAt(0))
fun isPunct(c: String): Boolean = Regex("^\\p{P}$").matches(c)
fun isSpace(c: String): Boolean = Regex("^\\p{IsWhite_Space}$").matches(c)
fun lastChar(s: String): String? = chars(s).lastOrNull()
fun firstChar(s: String): String? = chars(s).firstOrNull()
fun dropFirst(s: String, n: Int = 1): String = chars(s).drop(n).joinToString("")
fun dropLast(s: String, n: Int = 1): String = chars(s).dropLast(n).joinToString("")
fun suffix(s: String, n: Int): String = chars(s).takeLast(n).joinToString("")
fun prefix(s: String, n: Int): String = chars(s).take(n).joinToString("")
fun count(s: String): Int = chars(s).size

/** Swift `trimmingCharacters(in:)` with a predicate. */
fun trimWith(text: String, drop: (String) -> Boolean): String {
    val c = chars(text)
    var a = 0
    var b = c.size
    while (a < b && drop(c[a])) a++
    while (b > a && drop(c[b - 1])) b--
    return c.subList(a, b).joinToString("")
}

/** Swift `split(whereSeparator: \.isWhitespace)`. */
fun words(text: String): List<String> = text.split(Regex("\\p{IsWhite_Space}+")).filter { it.isNotEmpty() }

/** Swift `text.lowercased().split(whereSeparator: { !$0.isLetter })`. */
fun lettersOnly(text: String): List<String> = text.lowercase().split(Regex("[^\\p{L}]+")).filter { it.isNotEmpty() }

fun unitNode(course: String, unit: Int, suffix: String): String = "$course.u${unit.toString().padStart(2, '0')}.$suffix"

/** Every exercise of the lessons/practice/checkpoint of a unit (not the chest) for seeds. */
fun unitExercises(provider: CourseProvider, unit: Int, seeds: List<Int>): List<LearnExercise> {
    val out = mutableListOf<LearnExercise>()
    for (node in provider.course.units[unit].nodes) {
        if (node.kind == NodeKind.CHEST) continue
        for (s in seeds) out.addAll(provider.exercises(node, s.toULong()))
    }
    return out
}

/** card key -> the last characters of the ids of its exercises (Swift `exercisesByCard`). */
fun formsByCard(provider: CourseProvider, unit: Int, seeds: List<Int>): Map<String, Set<String>> {
    val seen = LinkedHashMap<String, MutableSet<String>>()
    for (exercise in unitExercises(provider, unit, seeds)) {
        for (key in exercise.cardKeys) seen.getOrPut(key) { mutableSetOf() }.add(lastChar(exercise.id) ?: "?")
    }
    return seen
}

fun courseFile(id: String): File = TestPaths.content("courses/$id.txt")
