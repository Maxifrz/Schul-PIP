package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseKind

// Reads a course written as text. One line, one thing: `key: value`. Blank lines and lines starting with `#` are
// ignored. A value may end with ` ## why`. See content/courses (the .txt files). A port of LanguageDSL.swift.

data class ParsedCourse(val data: LanguageCourseData, val errors: List<String>)

private class UnitBuilder(val sectionTitle: String, val title: String, val summary: String) {
    val tips = mutableListOf<String>()
    val words = mutableListOf<LanguageWord>()
    val sentences = mutableListOf<LanguageSentence>()
    val forms = mutableListOf<LanguageForm>()
    val fills = mutableListOf<LanguageFill>()
    val facts = mutableListOf<LanguageFact>()
    val known = mutableListOf<String>()

    fun build() = LanguageUnitData(
        sectionTitle, title, summary, tips.joinToString("\n\n"), words.toList(), sentences.toList(), forms.toList(),
        fills.toList(), facts.toList(), known.toList(),
    )
}

object LanguageDSL {
    private val fieldKeys = setOf(
        "course", "title", "subtitle", "kind", "color", "symbol", "speech", "instruction", "target-name", "into-name",
        "known-name", "produce",
    )
    private val itemKeys = setOf("tip", "word", "sentence", "form", "fill", "fact", "known")
    private val newlines = Regex("[\\n\\r\\u000B\\u000C\\u0085\\u2028\\u2029]")
    private val hex = Regex("^[+]?[0-9a-fA-F]+$")

    /** Splits at the first occurrence of `separator`; the second part is empty when it does not occur. */
    private fun splitAt(text: String, separator: String): Pair<String, String> {
        val index = text.indexOf(separator)
        if (index < 0) return text to ""
        return trimWhitespace(text.substring(0, index)) to trimWhitespace(text.substring(index + separator.length))
    }

    private fun list(text: String, separator: String): List<String> =
        text.split(separator).map { trimWhitespace(it) }.filter { it.isNotEmpty() }

    private fun parseHex32(text: String): Long? {
        if (!hex.matches(text)) return null
        val value = text.removePrefix("+").toBigInteger(16)
        return if (value.bitLength() <= 32) value.toLong() else null
    }

    private class Parser {
        val fields = HashMap<String, String>()
        var section = ""
        var current: UnitBuilder? = null
        val units = mutableListOf<UnitBuilder>()
        val errors = mutableListOf<String>()

        fun read(raw: String, number: Int) {
            val line = trimWhitespace(raw)
            if (line.isEmpty() || line.startsWith("#")) return
            val colon = line.indexOf(':')
            if (colon < 0) {
                errors.add("line $number: no \"key: value\"")
                return
            }
            val key = trimWhitespace(line.substring(0, colon)).lowercase()
            val value = trimWhitespace(line.substring(colon + 1))
            when {
                key in fieldKeys -> fields[key] = value
                key == "section" -> { flush(); section = value }
                key == "unit" -> {
                    flush()
                    val parts = value.split(" | ")
                    val title = trimWhitespace(parts[0])
                    if (title.isEmpty()) errors.add("line $number: unit without a title")
                    current = UnitBuilder(section, title, if (parts.size > 1) trimWhitespace(parts[1]) else "")
                }
                key in itemKeys -> {
                    val unit = current
                    if (unit == null) errors.add("line $number: $key before the first unit") else item(unit, key, value, number)
                }
                else -> errors.add("line $number: unknown key \"$key\"")
            }
        }

        fun item(unit: UnitBuilder, key: String, value: String, number: Int) {
            if (key == "tip") {
                if (value.isEmpty()) errors.add("line $number: empty tip") else unit.tips.add(value)
                return
            }
            if (key == "known") {
                val tokens = list(value, ",")
                if (tokens.isEmpty()) errors.add("line $number: empty known") else unit.known.addAll(tokens)
                return
            }
            val (body, why) = splitAt(value, " ## ")
            val equals = body.indexOf(" = ")
            if (equals < 0) {
                errors.add("line $number: $key needs \" = \"")
                return
            }
            val left = trimWhitespace(body.substring(0, equals))
            val right = trimWhitespace(body.substring(equals + 3))
            if (left.isEmpty() || right.isEmpty()) {
                errors.add("line $number: $key with an empty side")
                return
            }
            when (key) {
                "word" -> {
                    val (meaningText, note) = splitAt(right, " | ")
                    val meanings = list(meaningText, ";")
                    if (meanings.isEmpty()) errors.add("line $number: word without a meaning")
                    unit.words.add(LanguageWord(left, meanings, note, why))
                }
                "sentence" -> unit.sentences.add(LanguageSentence(left, list(right, ";"), why))
                "form" -> unit.forms.add(LanguageForm(left, list(right, ";"), why))
                "fill" -> {
                    val options = list(right, "|")
                    if (!left.contains("___")) errors.add("line $number: fill without ___")
                    if (options.size < 2) errors.add("line $number: fill needs a right and a wrong choice")
                    unit.fills.add(LanguageFill(left, options, why))
                }
                else -> {
                    val answers = list(right, "|")
                    if (answers.size < 2) errors.add("line $number: fact needs an answer and a wrong answer")
                    unit.facts.add(LanguageFact(left, answers.firstOrNull() ?: "", answers.drop(1), why))
                }
            }
        }

        fun flush() {
            current?.let { units.add(it) }
            current = null
        }

        fun finish(): ParsedCourse {
            flush()
            fun field(key: String): String {
                if (!fields.containsKey(key)) errors.add("missing \"$key:\"")
                return fields[key] ?: ""
            }
            val id = field("course")
            val kindText = fields["kind"] ?: "language"
            val kind = if (kindText == "school") CourseKind.SCHOOL else CourseKind.LANGUAGE
            if (kindText != "language" && kindText != "school") errors.add("kind must be language or school")
            val produceText = fields["produce"]
            if (produceText != null && produceText != "yes" && produceText != "no") errors.add("produce must be yes or no")
            val instructionText = fields["instruction"]
            val instruction = if (instructionText == "en") LanguageInstruction.EN else LanguageInstruction.DE
            if (instructionText != null && instructionText != "de" && instructionText != "en") errors.add("instruction must be de or en")
            val colorText = field("color")
            val color = parseHex32(colorText)
            if (color == null || colorText.codePointCount(0, colorText.length) != 6) errors.add("color must be six hex digits")
            if (units.isEmpty()) errors.add("no units")
            val title = field("title")
            val subtitle = field("subtitle")
            val symbol = field("symbol")
            val speech = fields["speech"]
            val data = LanguageCourseData(
                id = id, title = title, subtitle = subtitle, kind = kind, color = (color ?: 0x888888L).toInt(), symbol = symbol,
                speech = if (speech == null || speech.isEmpty()) null else speech,
                instruction = instruction,
                targetName = fields["target-name"] ?: fields["title"] ?: "",
                intoName = fields["into-name"] ?: fields["title"] ?: "",
                knownName = fields["known-name"] ?: (if (instruction == LanguageInstruction.DE) "Deutsche" else "English"),
                produces = fields["produce"] != "no",
                units = units.map { it.build() },
            )
            return ParsedCourse(data, errors.toList())
        }
    }

    /** Parses a course text. `errors` are the format errors, each with its line number. */
    fun parse(source: String): ParsedCourse {
        val parser = Parser()
        source.split(newlines).forEachIndexed { offset, raw -> parser.read(raw, offset + 1) }
        return parser.finish()
    }
}
