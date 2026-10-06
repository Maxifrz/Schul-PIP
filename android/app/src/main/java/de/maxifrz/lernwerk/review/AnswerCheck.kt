package de.maxifrz.lernwerk.review

import java.text.Normalizer
import kotlin.math.ceil
import kotlin.math.min

/**
 * Checks a typed answer against a flashcard's back without any AI: the words that carry the meaning have to be in
 * the answer, give or take a typo, an ending or a spelling with "ae" for "ä". It is strict about numbers, forgiving
 * about filler words and word order, and it cannot judge a long explanation as a teacher would; the review screen
 * lets the student overrule it.
 */
object AnswerCheck {
    enum class Verdict { CORRECT, WRONG }

    fun evaluate(answer: String, expected: String): Verdict {
        val given = normalize(answer)
        if (compact(given).isEmpty()) return Verdict.WRONG
        if (alternatives(expected).any { matches(given, it) }) return Verdict.CORRECT
        return if (matches(given, expected)) Verdict.CORRECT else Verdict.WRONG
    }

    /** "Berlin / Bundeshauptstadt", "A; B" or "A oder B" accept either part. A slash inside a fraction does not split. */
    fun alternatives(expected: String): List<String> {
        var parts = listOf(expected)
        for (separator in listOf(" / ", ";", "\n", " oder ")) {
            parts = parts.flatMap { it.split(separator) }
        }
        val trimmed = parts.map { it.trim() }.filter { it.isNotEmpty() }
        return if (trimmed.size > 1) trimmed else emptyList()
    }

    private val decimalComma = Regex("""(\d),(\d)""")
    private val marks = Regex("""\p{Mn}+""")

    /**
     * Lower case without umlauts and ß, "ae/oe/ue" folded to the same letters, decimal comma as a point and the usual
     * maths symbols as plain characters, so "x²" and "x^2" or "0,5" and "0.5" read the same.
     */
    fun normalize(text: String): String {
        var result = text.lowercase()
        for ((from, to) in listOf("ß" to "ss", "²" to "^2", "³" to "^3", "×" to "*", "·" to "*", "−" to "-", "–" to "-", "√" to "sqrt", "π" to "pi")) {
            result = result.replace(from, to)
        }
        result = decimalComma.replace(result, "$1.$2")
        result = marks.replace(Normalizer.normalize(result, Normalizer.Form.NFD), "")
        for ((from, to) in listOf("ae" to "a", "oe" to "o", "ue" to "u")) {
            result = result.replace(from, to)
        }
        return result
    }

    /** Letters and digits only: "2 x" and "2x", "x^2" and "x2" are the same formula. */
    fun compact(normalized: String): String = normalized.filter { it.isLetterOrDigit() }

    fun tokens(normalized: String): List<String> {
        val result = mutableListOf<String>()
        val current = StringBuilder()
        fun flush() {
            while (current.endsWith(".")) current.setLength(current.length - 1)
            if (current.isNotEmpty()) result += current.toString()
            current.setLength(0)
        }
        for (character in normalized) {
            if (character.isLetterOrDigit() || (character == '.' && current.isNotEmpty() && current.last().isDigit())) {
                current.append(character)
            } else {
                flush()
            }
        }
        flush()
        return result
    }

    private val stopwords: Set<String> by lazy {
        (
            "der die das den dem des ein eine einer einem einen eines und oder ist sind war waren wird werden wurde wurden " +
                "hat haben hatte kann können nicht mit von zu zum zur im in an auf aus bei für nach als auch wenn dann dass da " +
                "so wie man es sie er wir ihr ihre sein seine seiner durch über unter vor zwischen nur noch sich dies diese " +
                "dieser dieses was wer wo wann um am vom beim ins sowie also bzw ca etwa"
            ).split(" ").map { normalize(it) }.toSet()
    }

    /** The words that carry the meaning: no filler words, nothing shorter than three letters unless it has a digit. */
    fun keyTokens(normalized: String): List<String> {
        val seen = mutableListOf<String>()
        for (token in tokens(normalized)) {
            if (token in stopwords) continue
            if (token.length < 3 && token.none { it.isDigit() }) continue
            if (token !in seen) seen += token
        }
        return seen
    }

    private fun matches(given: String, expectedRaw: String): Boolean {
        val wanted = normalize(expectedRaw)
        val givenCompact = compact(given)
        val wantedCompact = compact(wanted)
        if (givenCompact == wantedCompact) return true
        val keys = keyTokens(wanted)
        if (keys.isEmpty()) return distance(givenCompact, wantedCompact) <= (if (wantedCompact.length >= 8) 1 else 0)
        val answerTokens = tokens(given)
        // Numbers have to be exactly right.
        if (keys.any { key -> key.any { it.isDigit() } && key !in answerTokens }) return false
        val found = keys.count { key -> answerTokens.any { tokenMatch(it, key) } }
        // Up to three key words must all be there; for longer answers three in five are enough.
        val needed = if (keys.size <= 3) keys.size else ceil(keys.size * 0.6).toInt()
        return found >= needed
    }

    /** Equal, one the beginning of the other ("Ableitung" and "Ableitungen"), or a typo away for words of five letters or more. */
    fun tokenMatch(a: String, b: String): Boolean {
        if (a == b) return true
        if (a.any { it.isDigit() } || b.any { it.isDigit() }) return false
        val (shorter, longer) = if (a.length <= b.length) a to b else b to a
        if (shorter.length < 5) return false
        if (longer.startsWith(shorter) && longer.length - shorter.length <= 4) return true
        return distance(a, b) <= (if (longer.length >= 9) 2 else 1)
    }

    /** Levenshtein distance. */
    fun distance(a: String, b: String): Int {
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length
        var previous = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            val row = IntArray(b.length + 1)
            row[0] = i
            for (j in 1..b.length) {
                row[j] = min(min(previous[j] + 1, row[j - 1] + 1), previous[j - 1] + if (a[i - 1] == b[j - 1]) 0 else 1)
            }
            previous = row
        }
        return previous[b.length]
    }
}
