package de.maxifrz.lernwerk.calc

import kotlinx.serialization.Serializable
import java.util.Locale
import java.util.UUID
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.roundToLong

/** One answer of the computer algebra core (`cas/web/cas.js`), as it comes back from the web view. */
@Serializable
data class CasAnswer(
    val ok: Boolean,
    val input: String? = null,
    val giac: String? = null,
    /** The name a definition gave a value or function, like `a` for "a = 5". */
    val assigns: String? = null,
    /** "variable" or "function" for definitions. */
    val kind: String? = null,
    val exact: String? = null,
    val approx: String? = null,
    val pretty: String? = null,
    val prettyApprox: String? = null,
    val matrix: List<List<String>>? = null,
    val error: String? = null,
)

/** Sampled graphs with their special points, from `CAS.plot`. */
@Serializable
data class CasPlot(
    val ok: Boolean,
    val error: String? = null,
    val xmin: Double? = null,
    val xmax: Double? = null,
    val ymin: Double? = null,
    val ymax: Double? = null,
    val curves: List<Curve>? = null,
    val roots: List<Point>? = null,
    val extrema: List<Point>? = null,
    val intersections: List<Point>? = null,
    val intercepts: List<Point>? = null,
) {
    @Serializable
    data class Curve(val index: Int, val giac: String, val label: String, val pretty: String, val values: List<Double?>)

    @Serializable
    data class Point(
        val curve: Int? = null,
        val curves: List<Int>? = null,
        val x: Double,
        val y: Double,
        /** "max" or "min" for extreme points. */
        val kind: String? = null,
    )

    /** The x value of sample [index] of a curve with [count] samples. */
    fun x(index: Int, count: Int): Double {
        val low = xmin ?: 0.0
        val high = xmax ?: 1.0
        return if (count > 1) low + (high - low) * index / (count - 1) else low
    }
}

/** A line of the calculator's history. */
@Serializable
data class CalculatorEntry(
    val id: String = UUID.randomUUID().toString(),
    val input: String,
    val pretty: String? = null,
    val prettyApprox: String? = null,
    val matrix: List<List<String>>? = null,
    val exact: String? = null,
    val error: String? = null,
    val assigns: String? = null,
    val date: Long = System.currentTimeMillis(),
)

/** The calculator's history, the definitions made in it and the angle unit; saved between launches. */
@Serializable
data class CalculatorHistory(
    val entries: List<CalculatorEntry> = emptyList(),
    /** In the order they were made, so they can be made again after a restart. */
    val definitions: List<Definition> = emptyList(),
    val degrees: Boolean = false,
) {
    @Serializable
    data class Definition(val name: String, val input: String, val pretty: String)

    /** The exact value of the newest answer, for "ans". */
    val lastExact: String?
        get() = entries.lastOrNull { it.error == null && it.exact != null && it.assigns == null }?.exact
            ?: entries.lastOrNull { it.error == null && it.exact != null }?.exact

    /** Replaces "ans" with the newest answer in parentheses. */
    fun resolvingAns(input: String): String {
        val last = lastExact?.replace("list[", "[") ?: return input
        return replaceWord("ans", input, "($last)")
    }

    fun recording(input: String, answer: CasAnswer): CalculatorHistory {
        var definitions = definitions
        val entry = if (answer.ok) {
            answer.assigns?.let { name ->
                definitions = definitions.filterNot { it.name == name } + Definition(name, input, answer.pretty ?: input)
            }
            CalculatorEntry(
                input = input,
                pretty = answer.pretty,
                prettyApprox = answer.prettyApprox,
                matrix = answer.matrix,
                exact = if (answer.kind == "function") null else answer.exact,
                assigns = answer.assigns,
            )
        } else {
            CalculatorEntry(input = input, error = answer.error ?: "Das konnte nicht berechnet werden.")
        }
        return copy(entries = (entries + entry).takeLast(LIMIT), definitions = definitions)
    }

    fun forgetting(name: String) = copy(definitions = definitions.filterNot { it.name == name })

    companion object {
        const val LIMIT = 200

        fun replaceWord(word: String, text: String, replacement: String): String {
            fun isWordCharacter(c: Char?) = c != null && (c.isLetterOrDigit() || c == '_')
            val result = StringBuilder()
            var index = 0
            while (index < text.length) {
                if (text.startsWith(word, index)) {
                    val end = index + word.length
                    if (!isWordCharacter(text.getOrNull(index - 1)) && !isWordCharacter(text.getOrNull(end))) {
                        result.append(replacement)
                        index = end
                        continue
                    }
                }
                result.append(text[index])
                index++
            }
            return result.toString()
        }
    }
}

/** What is typed on the calculator's keyboard, with a cursor. Templates mark where the cursor goes with "|". */
data class CalculatorInput(val text: String = "", val cursor: Int = text.length) {
    fun inserting(template: String): CalculatorInput {
        val parts = template.split("|")
        val before = parts[0]
        val after = parts.drop(1).joinToString("")
        return CalculatorInput(text.substring(0, cursor) + before + after + text.substring(cursor), cursor + before.length)
    }

    fun backspace(): CalculatorInput =
        if (cursor == 0) this else CalculatorInput(text.removeRange(cursor - 1, cursor), cursor - 1)

    fun left() = copy(cursor = max(0, cursor - 1))

    fun right() = copy(cursor = minOf(text.length, cursor + 1))

    val beforeCursor: String get() = text.substring(0, cursor)
    val afterCursor: String get() = text.substring(cursor)
}

object CasFormat {
    /** A number the German way: decimal comma, at most [decimals] decimals, no trailing zeros. */
    fun number(value: Double, decimals: Int = 4): String {
        if (!value.isFinite()) return if (value > 0) "∞" else "-∞"
        val factor = 10.0.pow(decimals)
        var rounded = (value * factor).roundToLong() / factor
        if (rounded == 0.0) rounded = 0.0
        var text = String.format(Locale.ROOT, "%.${decimals}f", rounded)
        if (text.contains('.')) text = text.trimEnd('0').trimEnd('.')
        if (text == "-0") text = "0"
        return text.replace('.', ',')
    }

    /** "P(1,5 | -2)", the way points are written at school. */
    fun point(name: String, x: Double, y: Double) = "$name(${number(x)} | ${number(y)})"

    /** Axis ticks at 1, 2 or 5 times a power of ten, about [count] of them between [low] and [high]. */
    fun ticks(low: Double, high: Double, count: Int = 8): List<Double> {
        if (high <= low || count <= 0) return emptyList()
        val raw = (high - low) / count
        val magnitude = 10.0.pow(floor(log10(raw)))
        val step = listOf(1.0, 2.0, 5.0, 10.0).map { it * magnitude }.firstOrNull { it >= raw } ?: (10 * magnitude)
        // Whole multiples of the step, rounded to its decimals, so 0.1 steps give 0.3 and not 0.30000000000000004.
        val decimals = 10.0.pow(max(0.0, -floor(log10(step))) + 1)
        val first = ceil(low / step - 1e-9).toLong()
        val last = floor(high / step + 1e-9).toLong()
        if (last < first || last - first >= 100) return emptyList()
        return (first..last).map { index ->
            val value = Math.round(index * step * decimals) / decimals
            if (abs(value) == 0.0) 0.0 else value
        }
    }
}
