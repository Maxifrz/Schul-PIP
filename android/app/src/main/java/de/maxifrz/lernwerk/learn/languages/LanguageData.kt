package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.ExerciseBuilder
import de.maxifrz.lernwerk.learn.folded

// The content of a language or school-subject course as plain values. It is written as text (see LanguageDSL.kt) and
// turned into exercises by the course provider. A port of LanguageData.swift.

/** A word or phrase in the language being learned with its meanings in the language the student knows. */
data class LanguageWord(
    val target: String,
    /** The first is shown as the right answer; every one is accepted when typed. */
    val meanings: List<String>,
    /** Gender, case, a hint; may be empty. */
    val note: String,
    val why: String,
)

data class LanguageSentence(val target: String, val meanings: List<String>, val why: String)

/** One form to produce: "ser, yo" gives "soy". Forms with the same text before the first comma belong to one group. */
data class LanguageForm(val prompt: String, val answers: List<String>, val why: String)

/** A sentence with a blank, written "Yo ___ Ana."; `options[0]` is right, the others are the wrong choices. */
data class LanguageFill(val sentence: String, val options: List<String>, val why: String)

/** A question with its answer and wrong answers. */
data class LanguageFact(val question: String, val answer: String, val wrong: List<String>, val why: String)

data class LanguageUnitData(
    val sectionTitle: String,
    val title: String,
    val summary: String,
    /** Paragraphs separated by a blank line. */
    val tip: String,
    val words: List<LanguageWord>,
    val sentences: List<LanguageSentence>,
    val forms: List<LanguageForm>,
    val fills: List<LanguageFill>,
    val facts: List<LanguageFact>,
    /** Words that sentences may use without a `word:` line. */
    val known: List<String>,
) {
    val itemCount: Int get() = words.size + sentences.size + forms.size + fills.size + facts.size
}

/** The language the prompts are written in. */
enum class LanguageInstruction { DE, EN }

data class LanguageCourseData(
    val id: String,
    val title: String,
    val subtitle: String,
    val kind: CourseKind,
    val color: Int,
    val symbol: String,
    /** A BCP 47 tag for the speaker button; null for a language without a voice or a subject. */
    val speech: String?,
    val instruction: LanguageInstruction,
    val targetName: String,
    val intoName: String,
    val knownName: String,
    /** False for a course that only reads the language (Latin). */
    val produces: Boolean,
    val units: List<LanguageUnitData>,
) {
    /** Mistakes in the content that would make an exercise unfair. */
    fun problems(): List<String> {
        val result = mutableListOf<String>()
        val meaningOwner = HashMap<String, String>()
        val targets = HashSet<String>()
        units.forEachIndexed { index, unit ->
            val place = "unit ${index + 1}"
            if (unit.tip.isEmpty()) result.add("$place: no tip")
            if (unit.itemCount < 8) result.add("$place: only ${unit.itemCount} items")
            for (word in unit.words) {
                val key = folded(word.target)
                if (!targets.add(key)) result.add("$place: ${word.target} twice")
                for (meaning in word.meanings) {
                    val f = folded(meaning)
                    val owner = meaningOwner[f]
                    if (owner != null && owner != word.target) result.add("$place: \"$meaning\" means both $owner and ${word.target}")
                    meaningOwner[f] = word.target
                }
            }
            val sentenceTargets = HashSet<String>()
            for (sentence in unit.sentences) {
                if (!sentenceTargets.add(folded(sentence.target))) result.add("$place: sentence twice: ${sentence.target}")
            }
            for (fill in unit.fills) {
                if (!fill.sentence.contains("___")) result.add("$place: no blank in ${fill.sentence}")
                if (fill.options.size < 2) result.add("$place: no wrong choice for ${fill.sentence}")
            }
            for (fact in unit.facts) {
                if (fact.wrong.isEmpty()) result.add("$place: no wrong answer for ${fact.question}")
            }
        }
        return result
    }
}

/** Forms with the same text before the first comma belong to one group (the verb). */
fun formGroup(form: LanguageForm): String {
    val prompt = form.prompt
    var start = 0
    while (start < prompt.length && prompt[start] == ',') start++
    if (start >= prompt.length) return prompt
    val end = prompt.indexOf(',', start)
    return trimWhitespace(prompt.substring(start, if (end < 0) prompt.length else end))
}

private val whitespaceEdges = Regex("^[\\t\\p{Zs}]+|[\\t\\p{Zs}]+$")

/** Swift `trimmingCharacters(in: .whitespaces)`: tab and the space separators, not newlines. */
fun trimWhitespace(text: String): String = text.replace(whitespaceEdges, "")

/** The wording of the prompts in one instruction language. `{x}` is replaced by the word or sentence. */
data class LanguageTexts(
    val meaning: String,
    val askTarget: String,
    val listen: String,
    val listenType: String,
    val translateInto: String,
    val translateFrom: String,
    val form: String,
    val fill: String,
    val pairs: String,
) {
    companion object {
        fun make(data: LanguageCourseData): LanguageTexts {
            if (data.kind == CourseKind.SCHOOL) {
                return LanguageTexts(
                    meaning = "Was bedeutet „{x}“?", askTarget = "Welcher Begriff ist gemeint?\n{x}", listen = "", listenType = "",
                    translateInto = "{x}", translateFrom = "{x}", form = "Bilde die Form:\n{x}", fill = "Welches Wort fehlt?\n{x}",
                    pairs = ExerciseBuilder.pairsPrompt,
                )
            }
            if (data.instruction == LanguageInstruction.DE) {
                return LanguageTexts(
                    meaning = "Was bedeutet „{x}“?", askTarget = "Wie sagt man „{x}“ auf ${data.targetName}?",
                    listen = "Tippe auf den Lautsprecher. Was hörst du?",
                    listenType = "Tippe auf den Lautsprecher und schreib auf, was du hörst.",
                    translateInto = "Übersetze ins ${data.intoName}:\n{x}", translateFrom = "Übersetze ins ${data.knownName}:\n{x}",
                    form = "Bilde die Form:\n{x}", fill = "Welches Wort fehlt?\n{x}", pairs = ExerciseBuilder.pairsPrompt,
                )
            }
            return LanguageTexts(
                meaning = "What does “{x}” mean?", askTarget = "How do you say “{x}” in ${data.targetName}?",
                listen = "Tap the speaker. What do you hear?", listenType = "Tap the speaker and type what you hear.",
                translateInto = "Translate into ${data.intoName}:\n{x}", translateFrom = "Translate into ${data.knownName}:\n{x}",
                form = "Write the form:\n{x}", fill = "Which word is missing?\n{x}", pairs = "Match the pairs",
            )
        }
    }
}

/** Replaces every `{x}` of a template. */
fun fillTemplate(template: String, text: String): String = template.replace("{x}", text)
