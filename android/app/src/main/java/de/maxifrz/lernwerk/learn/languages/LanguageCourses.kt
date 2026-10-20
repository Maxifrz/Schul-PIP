package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseProvider

// The five shipped language courses, built from the shared texts (content/courses (the .txt files)). The texts reach the logic
// through `CourseTextSource`: the app reads them from its assets, the JVM tests from the repository.

/**
 * Where the course texts come from. In the app: `CourseTextSource { id -> assets.open("courses/$id.txt").bufferedReader().use { it.readText() } }`
 * (the Gradle task `copyCourseTexts` puts content/courses (the .txt files) into the assets); in JVM tests: the files of the repository.
 */
fun interface CourseTextSource {
    /** The text of a course (`es`, `fr`, `la`, `daf`, `de`). */
    fun text(courseID: String): String
}

object LanguageCourses {
    /** The ids in course order (Spanish, French, Latin, German as a foreign language, German as a subject). */
    val ids: List<String> = listOf("es", "fr", "la", "daf", "de")

    /** Builds the five providers in course order. */
    fun providers(source: CourseTextSource): List<LanguageCourseProvider> =
        ids.map { LanguageCourseProvider.make(source.text(it)).first }

    fun providersAsCourseProviders(source: CourseTextSource): List<CourseProvider> = providers(source)

    /** Builds the five providers and adds them to the `CourseCatalog`. */
    fun register(source: CourseTextSource): List<LanguageCourseProvider> =
        providers(source).also { list -> list.forEach { de.maxifrz.lernwerk.learn.CourseCatalog.registerProvider(it) } }
}

/** The five providers, loaded once from a text source. `languageProviders` of the Swift app. */
class LanguageProviders(source: CourseTextSource) {
    val all: List<LanguageCourseProvider> = LanguageCourses.providers(source)
    val spanish: LanguageCourseProvider get() = all[0]
    val french: LanguageCourseProvider get() = all[1]
    val latin: LanguageCourseProvider get() = all[2]
    val germanForeign: LanguageCourseProvider get() = all[3]
    val germanSchool: LanguageCourseProvider get() = all[4]
}
