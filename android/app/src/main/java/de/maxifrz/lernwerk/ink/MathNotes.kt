package de.maxifrz.lernwerk.ink

import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmMessage
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.ModelText
import de.maxifrz.lernwerk.llm.StructuredOutput
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** A rectangle in page points. */
data class Box(val left: Double, val top: Double, val right: Double, val bottom: Double) {
    val width: Double get() = right - left
    val height: Double get() = bottom - top
    val midX: Double get() = (left + right) / 2
    val midY: Double get() = (top + bottom) / 2

    fun union(other: Box) = Box(min(left, other.left), min(top, other.top), max(right, other.right), max(bottom, other.bottom))

    fun contains(other: Box) = other.left >= left && other.right <= right && other.top >= top && other.bottom <= bottom

    companion object {
        /** The box around a stroke's points, given as x, y pairs. */
        fun around(points: List<Double>): Box? {
            if (points.size < 2) return null
            var left = Double.MAX_VALUE
            var top = Double.MAX_VALUE
            var right = -Double.MAX_VALUE
            var bottom = -Double.MAX_VALUE
            for (i in points.indices step 2) {
                left = min(left, points[i])
                right = max(right, points[i])
                top = min(top, points[i + 1])
                bottom = max(bottom, points[i + 1])
            }
            return Box(left, top, right, bottom)
        }
    }
}

/**
 * Calculating in handwritten notes: finding a written "=", the line it ends, and reading what a vision model
 * recognized there. The calculation itself always runs on the device, in the computer algebra core.
 */
object MathNotes {
    // Finding the equals sign

    /** Two short, flat strokes above each other, about as long as each other: an equals sign. */
    fun isEqualsSign(a: Box, b: Box): Boolean {
        val flatA = a.height <= max(a.width * 0.35, 4.0)
        val flatB = b.height <= max(b.width * 0.35, 4.0)
        if (!flatA || !flatB || a.width < 6 || b.width < 6) return false
        val ratio = a.width / b.width
        if (ratio < 0.5 || ratio > 2) return false
        val overlap = min(a.right, b.right) - max(a.left, b.left)
        if (overlap < min(a.width, b.width) * 0.6) return false
        val gap = abs(a.midY - b.midY)
        val width = (a.width + b.width) / 2
        return gap >= max(3.0, width * 0.12) && gap <= width
    }

    /** The strokes left of the equals sign on its line, as one region; null when nothing is written there. */
    fun lineRegion(equals: Box, boxes: List<Box>): Box? {
        val band = max(equals.width * 1.1, 28.0)
        val candidates = boxes
            .filter { it != equals && !equals.contains(it) && abs(it.midY - equals.midY) <= band && it.right <= equals.left + 4 }
            .sortedByDescending { it.right }
        val reach = max(equals.width * 3, 60.0)
        var region: Box? = null
        var left = equals.left
        for (box in candidates) {
            if (left - box.right > reach) break
            region = region?.union(box) ?: box
            left = min(left, box.left)
        }
        return region
    }

    /** A handwriting size that matches the line: about as tall as the written characters. */
    fun fontSize(line: Box): Double = min(max(line.height * 0.95, 14.0), 56.0)

    /** Where the result's baseline starts: right after the equals sign, in the middle of the line. */
    fun resultBaseline(equals: Box, line: Box): Pair<Double, Double> =
        (equals.right + max(6.0, equals.width * 0.4)) to (equals.midY + fontSize(line) * 0.35)

    // What the model reads

    @Serializable
    data class Recognition(val kind: String? = null, val lines: List<String> = emptyList(), val table: Table? = null) {
        @Serializable
        data class Table(val headers: List<String> = emptyList(), val rows: List<List<String>> = emptyList())
    }

    val SYSTEM_PROMPT = """
        You read handwritten school maths from a photo of a student's notes and write it down for a computer algebra system. Do not calculate or correct anything; transcribe exactly what is written.

        Write each line of maths as one string in "lines", top to bottom, in calculator syntax: * for multiplication (also where the student left it out, like 2*x), / for fractions and division, ^ for powers, sqrt(...) for roots, pi, e, sin, cos, tan, ln, log. Use a dot as the decimal separator, even when the student wrote a comma. Keep variable names as written (a, b, x, f(x)). Keep "=" where it is written, including an "=" at the very end of the last line. Leave out words, dates, and anything that is not maths.

        Set "kind": "table" when the photo shows a table of values; then put its column headings into table.headers and each row's cells into table.rows. "function" when it is a function like f(x) = ... or y = ...; "equations" for equations to solve; otherwise "expression".

        Answer with only a JSON object: {"kind": "...", "lines": ["..."], "table": {"headers": [], "rows": []}}.
    """.trimIndent()

    const val LINE_HINT = "The last line ends with \"=\": the student wants it calculated. Earlier lines may define values they use."
    const val REGION_HINT = "Transcribe the maths in this part of the page."

    fun request(imageJpeg: ByteArray, hint: String) = LlmRequest(
        purpose = LlmPurpose.MathRecognition,
        system = SYSTEM_PROMPT,
        messages = listOf(LlmMessage(LlmRole.USER, listOf(LlmContent.Image(imageJpeg), LlmContent.Text(hint)))),
        maxTokens = 800,
    )

    private val json = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true }

    /** Reads the model's answer leniently: a JSON object, or failing that one line of maths per text line. */
    fun parse(text: String): Recognition? {
        runCatching { json.decodeFromString(Recognition.serializer(), StructuredOutput.extractJson(text)) }.getOrNull()?.let { recognition ->
            return recognition.copy(lines = recognition.lines.map(::clean).filter { it.isNotEmpty() })
        }
        val lines = ModelText.removingReasoning(text).lines()
            .map(::clean)
            .filter { it.isNotEmpty() && !it.startsWith("{") && !it.startsWith("```") }
        return if (lines.isEmpty()) null else Recognition(lines = lines)
    }

    /** Handwriting as OCR or a model may spell it, in the calculator's syntax. */
    fun clean(line: String): String {
        var text = line.trim()
        if (text.length >= 2 && text.startsWith("$") && text.endsWith("$")) text = text.substring(1, text.length - 1)
        val replacements = listOf(
            "×" to "*", "·" to "*", "⋅" to "*", "÷" to "/", ":" to "/", "−" to "-", "–" to "-", "²" to "^2", "³" to "^3",
            "√" to "sqrt", "π" to "pi", "\\cdot" to "*", "\\times" to "*", "\\pi" to "pi", "\\sqrt" to "sqrt",
        )
        for ((from, to) in replacements) text = text.replace(from, to)
        // ":=" stays a definition.
        text = text.replace("/=", ":=")
        // A decimal comma between digits becomes a dot.
        text = text.replace(Regex("""(\d),(\d)"""), "$1.$2")
        return text
    }

    /** The lines before the last that define something, and the expression the last line asks for. */
    fun split(lines: List<String>): Pair<List<String>, String?> {
        val last = lines.lastOrNull() ?: return emptyList<String>() to null
        val definitions = lines.dropLast(1).filter(::isDefinition)
        var expression = last.trim()
        while (expression.endsWith("=") || expression.endsWith("?")) expression = expression.dropLast(1).trim()
        return definitions to expression.ifEmpty { null }
    }

    private val definition = Regex("""^\s*[A-Za-z][A-Za-z0-9_]*\s*(\(\s*[A-Za-z]\s*\))?\s*:?=\s*[^=\s][^=]*$""")

    /** "a = 5", "f(x) = x^2 + 1", "b := 2": lines that give a name a value. */
    fun isDefinition(line: String): Boolean {
        if (!definition.matches(line)) return false
        // "x = 3" is an equation, not a value for later.
        val name = line.trim().takeWhile { it.isLetterOrDigit() || it == '_' }
        return name !in setOf("x", "y", "z", "t") || line.contains("(")
    }

    /** Whether a result is worth offering: something was calculated, not just a number copied. */
    fun isWorthShowing(expression: String, result: String): Boolean {
        val plain = expression.replace(" ", "")
        if (plain.toDoubleOrNull() != null) return false
        return result.isNotEmpty() && result != plain
    }

    /** The text written after the "=": the exact result when it is short, otherwise the rounded one. */
    fun resultText(pretty: String?, approx: String?): String? {
        if (pretty.isNullOrEmpty()) return approx
        if (pretty.length > 14 && approx != null) return approx
        return pretty
    }

    // Tables to charts

    data class ChartData(
        val labels: List<String>,
        val columns: List<Column>,
        /** The first column holds numbers that grow: a line chart over x; otherwise bars per label. */
        val numericX: Boolean,
        val xValues: List<Double>,
    ) {
        data class Column(val name: String, val values: List<Double?>)
    }

    /** A number the way it is written at school: "2,5", "-3". */
    fun number(text: String): Double? = text.trim().replace("−", "-").replace(",", ".").replace(" ", "").toDoubleOrNull()

    /** Columns with numbers become series; the first column labels them. */
    fun chartData(table: Recognition.Table): ChartData? {
        val width = max(table.headers.size, table.rows.maxOfOrNull { it.size } ?: 0)
        if (width < 2 || table.rows.isEmpty()) return null
        fun cell(row: List<String>, index: Int) = row.getOrElse(index) { "" }
        val labels = table.rows.map { cell(it, 0) }
        val columns = (1 until width).mapNotNull { index ->
            val values = table.rows.map { number(cell(it, index)) }
            if (values.all { it == null }) return@mapNotNull null
            val name = table.headers.getOrNull(index)?.takeIf { it.isNotEmpty() } ?: "Reihe $index"
            ChartData.Column(name, values)
        }
        if (columns.isEmpty()) return null
        val xs = labels.map(::number)
        val numericX = xs.all { it != null } && xs.zipWithNext().all { (a, b) -> a!! < b!! }
        return ChartData(labels, columns, numericX, if (numericX) xs.map { it!! } else emptyList())
    }
}
