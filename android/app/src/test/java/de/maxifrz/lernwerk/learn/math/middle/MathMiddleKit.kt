package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.NumberCheck
import org.junit.Assert.assertTrue
import org.junit.Assert.fail

// Independent checks for the middle-school maths course (port of MathMiddleTestKit and MathMiddleTestExpression in
// LernwerkTests/MathCourseMiddleTests.swift). The kit re-reads the prompts the student sees and recomputes the answers
// with Double arithmetic, brute force and by plugging solutions back in.

object MathMiddleKit {
    val provider = mathMiddleProvider

    /** Seeds per template and level. The Swift tests use 1...300; 150 keeps the run fast and still makes 30+ draws. */
    const val SEEDS = 150

    class Draw(val level: Int, val seed: Int, val problem: MathMiddleProblem)

    fun template(id: String): MathMiddleTemplate {
        for (unit in MathMiddleCatalog.units) unit.firstOrNull { it.id == id }?.let { return it }
        throw IllegalStateException("No template $id")
    }

    private val cache = HashMap<String, List<Draw>>()

    /** A template drawn at the three levels for every seed; draws that came out null are left out. Cached. */
    @Synchronized
    fun draws(id: String): List<Draw> {
        cache[id]?.let { return it }
        val template = template(id)
        val result = mutableListOf<Draw>()
        for (level in 1..3) {
            for (seed in 1..SEEDS) {
                val gen = MathMiddleGen(seed.toULong() * 7919uL + level.toULong())
                template.make(level, gen)?.let { result.add(Draw(level, seed, it)) }
            }
        }
        cache[id] = result
        return result
    }

    /** Runs a check on every draw of a template. The body returns a message for a wrong problem, null for a good one. */
    fun check(id: String, minimumDraws: Int = 30, body: (level: Int, p: MathMiddleProblem) -> String?) {
        val all = draws(id)
        assertTrue("$id made too few problems", all.size >= minimumDraws)
        val messages = mutableListOf<String>()
        for (draw in all) {
            val message = body(draw.level, draw.problem)
            if (message != null) {
                messages.add("$id level ${draw.level} seed ${draw.seed}: $message\n  ${draw.problem.prompt.replace("\n", " | ")}")
            }
        }
        if (messages.isNotEmpty()) fail("${messages.size} wrong problems in $id:\n" + messages.take(6).joinToString("\n"))
    }

    // Text

    private val compiled = HashMap<String, Regex>()

    private fun regex(pattern: String): Regex = compiled.getOrPut(pattern) { Regex(pattern) }

    private fun groups(found: MatchResult): List<String> = found.groups.map { it?.value ?: "" }

    /** The capture groups of the first match, the whole match first; null without a match. */
    fun match(pattern: String, text: String): List<String>? = regex(pattern).find(text)?.let { groups(it) }

    /** The capture groups of every match. */
    fun matches(pattern: String, text: String): List<List<String>> = regex(pattern).findAll(text).map { groups(it) }.toList()

    /**
     * "12", "0,75" or "3/4" at the start of the text as a Double; a unit, a percent sign or a degree sign after it is
     * ignored, a mixed number "2 3/5" is read as 2.6. The minus sign is U+2212 or "-".
     */
    fun number(text: String): Double? {
        val cleaned = text.replace("−", "-").replace(",", ".").trim { it == ' ' || it == '\t' }
        match("^(-?)(\\d+) (\\d+)/(\\d+)", cleaned)?.let { m ->
            val value = m[2].toDouble() + m[3].toDouble() / m[4].toDouble()
            return if (m[1].isEmpty()) value else -value
        }
        match("^(-?)(\\d+(?:\\.\\d+)?)/(\\d+(?:\\.\\d+)?)", cleaned)?.let { m ->
            val denominator = m[3].toDouble()
            if (denominator == 0.0) return null
            val value = m[2].toDouble() / denominator
            return if (m[1].isEmpty()) value else -value
        }
        match("^(-?)(\\d+(?:\\.\\d+)?)", cleaned)?.let { m ->
            val value = m[2].toDouble()
            return if (m[1].isEmpty()) value else -value
        }
        return null
    }

    /** Every unsigned number or fraction "a/b" in the text, in order. */
    fun numbers(text: String): List<Double> =
        matches("\\d+(?:,\\d+)?(?:/\\d+(?:,\\d+)?)?", text).mapNotNull { number(it[0]) }

    /** The whole numbers in the text, in order. */
    fun integers(text: String): List<Int> = matches("\\d+", text).mapNotNull { it[0].toIntOrNull() }

    fun close(a: Double, b: Double, tolerance: Double = 1e-9): Boolean =
        Math.abs(a - b) <= tolerance * maxOf(1.0, Math.abs(a), Math.abs(b))

    /** The greatest common divisor found by trying every divisor, not by Euclid's algorithm. */
    fun bruteGCD(a: Int, b: Int): Int {
        if (!(a > 0 && b > 0)) return maxOf(a, b)
        for (divisor in minOf(a, b) downTo 1) if (a % divisor == 0 && b % divisor == 0) return divisor
        return 1
    }

    /** The least common multiple found by counting up. */
    fun bruteLCM(a: Int, b: Int): Int {
        var multiple = maxOf(a, b)
        while (multiple % a != 0 || multiple % b != 0) multiple += maxOf(a, b)
        return multiple
    }

    /** The typed answer of a problem as a Double. */
    fun typedAnswer(p: MathMiddleProblem): Double? = p.typed?.answer?.doubleValue

    /** The text of the last line of a prompt. */
    fun lastLine(prompt: String): String = prompt.split("\n").last()

    /** The first line of a prompt. */
    fun firstLine(prompt: String): String = prompt.split("\n").first()

    /** A number the answer check accepts, written the way a student might: the value of the typed answer. */
    fun accepts(p: MathMiddleProblem, text: String): Boolean {
        val typed = p.typed ?: return false
        return NumberCheck.matches(text, typed.answer.fractionText)
    }
}

/**
 * A small reader for the expressions in the prompts: numbers (3, 0,75, 3/4, 2 3/4), + - · : and brackets, powers like
 * ² and ⁻³, √, letters as variables, and 3x or 2(x + 1) as products. It computes with Doubles, so it checks the
 * course's exact answers by another route.
 */
class MathMiddleExpr private constructor(text: String, private val variables: Map<Char, Double>) {
    private val chars: List<Char> = text.replace("−", "-").toList()
    private var index = 0

    companion object {
        private val superscripts = mapOf('⁰' to 0, '¹' to 1, '²' to 2, '³' to 3, '⁴' to 4, '⁵' to 5, '⁶' to 6, '⁷' to 7, '⁸' to 8, '⁹' to 9)

        fun evaluate(text: String, variables: Map<Char, Double> = emptyMap()): Double? {
            val reader = MathMiddleExpr(text, variables)
            val value = reader.expression() ?: return null
            reader.skipSpaces()
            return if (reader.index == reader.chars.size && value.isFinite()) value else null
        }

        /** Whether both sides of "left = right" have the same value for the variable x. */
        fun holds(equation: String, x: Double): Boolean? {
            val sides = equation.split(" = ")
            if (sides.size != 2) return null
            val left = evaluate(sides[0], mapOf('x' to x)) ?: return null
            val right = evaluate(sides[1], mapOf('x' to x)) ?: return null
            return Math.abs(left - right) <= 1e-9 * maxOf(1.0, Math.abs(left), Math.abs(right))
        }
    }

    private fun peek(offset: Int = 0): Char? = if (index + offset < chars.size) chars[index + offset] else null

    private fun skipSpaces() {
        while (index < chars.size && chars[index] == ' ') index += 1
    }

    private fun isDigit(c: Char?): Boolean = c != null && c in '0'..'9'

    private fun expression(): Double? {
        skipSpaces()
        var sign = 1.0
        if (peek() == '-') { index += 1; sign = -1.0 } else if (peek() == '+') index += 1
        val first = term() ?: return null
        var value = sign * first
        while (true) {
            skipSpaces()
            val c = peek()
            if (c != '+' && c != '-') return value
            index += 1
            val rhs = term() ?: return null
            value = if (c == '+') value + rhs else value - rhs
        }
    }

    private fun term(): Double? {
        skipSpaces()
        var value = product() ?: return null
        while (true) {
            skipSpaces()
            val c = peek()
            if (c != '·' && c != ':') return value
            index += 1
            skipSpaces()
            val rhs = product() ?: return null
            if (c == ':') {
                if (rhs == 0.0) return null
                value /= rhs
            } else {
                value *= rhs
            }
        }
    }

    /** Factors written right next to each other are multiplied: 3x, 2(x + 1), (x - 2)(x + 5). */
    private fun product(): Double? {
        var value = quotient() ?: return null
        while (true) {
            val c = peek() ?: break
            if (!(c == '(' || c == '√' || c == 'π' || (c.isLetter() && variables.containsKey(c)))) break
            val rhs = quotient() ?: return null
            value *= rhs
        }
        return value
    }

    private fun quotient(): Double? {
        var value = power() ?: return null
        if (peek() == '/') {
            index += 1
            val rhs = power() ?: return null
            if (rhs == 0.0) return null
            value /= rhs
        }
        return value
    }

    private fun power(): Double? {
        var base = atom() ?: return null
        while (true) {
            val c = peek() ?: break
            if (!(c == '⁻' || superscripts.containsKey(c))) break
            var negative = false
            if (c == '⁻') { negative = true; index += 1 }
            var exponent = 0
            var digits = 0
            while (true) {
                val d = peek() ?: break
                val v = superscripts[d] ?: break
                exponent = exponent * 10 + v
                digits += 1
                index += 1
            }
            if (digits == 0) return null
            base = Math.pow(base, (if (negative) -exponent else exponent).toDouble())
        }
        return base
    }

    private fun atom(): Double? {
        val c = peek() ?: return null
        if (c == '(') {
            index += 1
            val value = expression() ?: return null
            skipSpaces()
            if (peek() != ')') return null
            index += 1
            return value
        }
        if (c == '√') {
            index += 1
            val value = atom()
            if (value == null || value < 0) return null
            return Math.sqrt(value)
        }
        if (c == 'π') { index += 1; return Math.PI }
        if (isDigit(c)) return numberValue()
        if (c.isLetter()) {
            val value = variables[c] ?: return null
            index += 1
            return value
        }
        return null
    }

    private fun digits(): String {
        val text = StringBuilder()
        while (isDigit(peek())) { text.append(peek()); index += 1 }
        return text.toString()
    }

    private fun numberValue(): Double? {
        var text = digits()
        if (peek() == ',' && isDigit(peek(1))) {
            index += 1
            text += "." + digits()
        }
        val value = text.toDoubleOrNull() ?: return null
        // A mixed number: a whole number, a space, then a fraction.
        if (!text.contains('.') && peek() == ' ' && isDigit(peek(1))) {
            val start = index
            index += 1
            val numerator = digits()
            if (peek() == '/' && isDigit(peek(1))) {
                index += 1
                val denominator = digits()
                val n = numerator.toDoubleOrNull()
                val d = denominator.toDoubleOrNull()
                if (n != null && d != null && d != 0.0) return value + n / d
            }
            index = start
        }
        return value
    }
}
