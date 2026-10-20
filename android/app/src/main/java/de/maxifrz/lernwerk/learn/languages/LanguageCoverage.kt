package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.folded

// Checks that a course's sentences only use words it has taught. A port of LanguageCoverage.swift.

data class CoverageGap(val unit: Int, val sentence: String, val words: List<String>) {
    val description: String get() = "unit $unit: \"$sentence\" uses ${words.joinToString(", ")}"
}

object LanguageCoverage {
    private val spaces = Regex("[\\s\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]+")
    private val digitsOnly = Regex("^\\p{N}+$")

    /** The tokens of a text as they are compared: lower case, no accents, no punctuation, no digits-only tokens. */
    fun tokens(text: String): List<String> {
        val result = mutableListOf<String>()
        for (piece in text.split(spaces)) {
            if (piece.isEmpty()) continue
            val f = folded(piece)
            if (f.isEmpty() || digitsOnly.matches(f)) continue
            result.add(f)
        }
        return result
    }

    fun gaps(data: LanguageCourseData): List<CoverageGap> {
        val known = HashSet<String>()
        val gaps = mutableListOf<CoverageGap>()
        data.units.forEachIndexed { index, unit ->
            for (word in unit.words) known.addAll(tokens(word.target))
            for (form in unit.forms) for (a in form.answers) known.addAll(tokens(a))
            for (fill in unit.fills) if (fill.options.isNotEmpty()) known.addAll(tokens(fill.options[0]))
            for (token in unit.known) known.addAll(tokens(token))
            for (sentence in unit.sentences) {
                val missing = tokens(sentence.target).filter { it !in known }
                if (missing.isNotEmpty()) gaps.add(CoverageGap(index + 1, sentence.target, missing))
            }
        }
        return gaps
    }

    fun describe(gap: CoverageGap): String = gap.description
}
