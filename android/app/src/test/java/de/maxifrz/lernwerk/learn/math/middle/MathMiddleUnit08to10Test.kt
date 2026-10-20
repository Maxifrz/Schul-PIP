package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.NumberCheck
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.accepts
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.check
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.close
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.integers
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.match
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.matches
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.number
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.typedAnswer
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

/** Ports of LernwerkTests/MathCourseMiddleUnit08Tests.swift to Unit10Tests.swift. */
class MathMiddleUnit08to10Test {
    private val NUM = "(\\d+(?:,\\d+)?)"
    private val THIN = " "
    private fun plain(text: String): String = text.replace(THIN, "").replace("\n", " ")
    private fun options(p: MathMiddleProblem): List<String> = p.options

    // Unit 8

    /** The right option, the typed answer, and the wrong options which must differ in value. */
    private fun checkAnswer(p: MathMiddleProblem, expected: Double): String? {
        val right = number(p.correct)
        if (right == null || !close(right, expected)) return "correct option ${p.correct} expected $expected"
        val typed = typedAnswer(p)
        if (typed == null || !close(typed, expected)) return "typed answer $typed"
        for (option in options(p)) {
            val value = number(option) ?: return "wrong option $option"
            if (close(value, expected)) return "wrong option $option is right"
        }
        return null
    }

    /** A unit in metres, so a conversion can be checked by going through the same base unit. */
    private fun unitScale(unit: String): Double? = when (unit) {
        "mm²" -> 1e-6
        "cm²" -> 1e-4
        "dm²" -> 1e-2
        "m²" -> 1.0
        "mm³" -> 1e-9
        "cm³", "ml" -> 1e-6
        "dm³", "l" -> 1e-3
        "m³" -> 1.0
        else -> null
    }

    @Test fun u08_rectangle() {
        check("u08.rectangle") { level, p ->
            val text = plain(p.prompt)
            var m = match("Ein Rechteck ist $NUM (cm|m) lang und $NUM (?:cm|m) breit\\. Berechne den (Umfang|Flächeninhalt)\\.", text)
            if (m != null) {
                if (level >= 3) return@check "forward below level 3"
                val a = number(m[1])!!; val b = number(m[3])!!
                val expected = if (m[4] == "Umfang") 2 * (a + b) else a * b
                if (!p.correct.endsWith(if (m[4] == "Umfang") " ${m[2]}" else " ${m[2]}²")) return@check "unit of ${p.correct}"
                return@check checkAnswer(p, expected)
            }
            m = match("Ein Quadrat hat die Seitenlänge $NUM (cm|m)\\. Berechne den (Umfang|Flächeninhalt)\\.", text)
            if (m != null) {
                if (level != 1) return@check "squares at level 1"
                val a = number(m[1])!!
                return@check checkAnswer(p, if (m[3] == "Umfang") 4 * a else a * a)
            }
            m = match("Ein Rechteck hat den Umfang $NUM (cm|m) und ist $NUM (?:cm|m) lang\\. Wie breit ist es\\?", text)
            if (m != null) {
                if (level != 3) return@check "backwards at level 3"
                val u = number(m[1])!!; val a = number(m[3])!!
                val right = number(p.correct)
                if (right == null || !close(2 * (a + right), u)) return@check "perimeter does not fit back"
                return@check checkAnswer(p, right)
            }
            m = match("Ein Rechteck hat die Fläche $NUM (cm|m)² und ist $NUM (?:cm|m) lang\\. Wie breit ist es\\?", text)
            if (m != null) {
                if (level != 3) return@check "backwards at level 3"
                val area = number(m[1])!!; val a = number(m[3])!!
                val right = number(p.correct)
                if (right == null || !close(a * right, area)) return@check "area does not fit back"
                return@check checkAnswer(p, right)
            }
            "prompt"
        }
    }

    @Test fun u08_area() {
        check("u08.area") { level, p ->
            val text = plain(p.prompt)
            var m = match("""Dreieck hat die Grundseite (\d+) (cm|m) und die Höhe (\d+) (?:cm|m)\. Wie groß ist die Fläche\?""", text)
            if (m != null) return@check checkAnswer(p, m[1].toDouble() * m[3].toDouble() / 2)
            m = match("Dreieck hat die Grundseite (\\d+) (cm|m) und die Fläche $NUM (?:cm|m)²\\. Wie hoch ist das Dreieck\\?", text)
            if (m != null) {
                if (level != 3) return@check "backwards at level 3"
                val g = m[1].toDouble(); val area = number(m[3])!!
                val right = number(p.correct)
                if (right == null || !close(g * right / 2, area)) return@check "area does not fit back"
                return@check checkAnswer(p, right)
            }
            m = match("""Parallelogramm hat die Grundseite (\d+) (cm|m), die Höhe (\d+) (?:cm|m) und die schräge Seite (\d+) (?:cm|m)\.""", text)
            if (m != null) {
                if (!(m[4].toDouble() > m[3].toDouble())) return@check "slanted side must be longer than the height"
                return@check checkAnswer(p, m[1].toDouble() * m[3].toDouble())
            }
            m = match("""Trapez hat die parallelen Seiten (\d+) (cm|m) und (\d+) (?:cm|m) und die Höhe (\d+) (?:cm|m)\.""", text)
            if (m != null) {
                if (level < 2) return@check "trapezoid from level 2"
                return@check checkAnswer(p, (m[1].toDouble() + m[3].toDouble()) / 2 * m[4].toDouble())
            }
            "prompt"
        }
    }

    @Test fun u08_circle() {
        check("u08.circle") { level, p ->
            val text = plain(p.prompt)
            var m = match("""Ein Kreis hat (den Radius|den Durchmesser) (\d+) (cm|m)\. Berechne (die Fläche|den Umfang) in (?:cm|m)²?\. Gib das Ergebnis als Vielfaches von π an\.""", text)
            if (m != null) {
                val given = m[2].toDouble()
                val r = if (m[1] == "den Radius") given else given / 2
                if (level == 1 && m[1] != "den Radius") return@check "level 1 gives the radius"
                // The factor in front of π, by the formula, as Double.
                val expected = if (m[4] == "die Fläche") r * r else 2 * r
                if (!p.correct.endsWith("π")) return@check "pi"
                return@check checkAnswer(p, expected)
            }
            m = match("""Der Umfang eines Kreises ist (\d+)π (cm|m)\. Wie groß ist der Radius\?""", text)
            if (m != null) {
                if (level != 3) return@check "backwards at level 3"
                val right = number(p.correct)
                if (right == null || !close(2 * right, m[1].toDouble())) return@check "circumference does not fit back"
                return@check checkAnswer(p, right)
            }
            m = match("""Die Fläche eines Kreises ist (\d+)π (cm|m)²\. Wie groß ist der Radius\?""", text)
            if (m != null) {
                if (level != 3) return@check "backwards at level 3"
                val right = number(p.correct)
                if (right == null || !close(right * right, m[1].toDouble())) return@check "area does not fit back"
                return@check checkAnswer(p, right)
            }
            "prompt"
        }
    }

    @Test fun u08_cuboid() {
        check("u08.cuboid") { level, p ->
            val text = plain(p.prompt)
            var m = match("""Ein Quader ist (\d+) cm lang, (\d+) cm breit und (\d+) cm hoch\. Berechne (das Volumen|die Oberfläche)\.""", text)
            if (m != null) {
                val a = m[1].toDouble(); val b = m[2].toDouble(); val c = m[3].toDouble()
                val expected = if (m[4] == "das Volumen") a * b * c else 2 * (a * b + a * c + b * c)
                if (!p.correct.endsWith(if (m[4] == "das Volumen") "cm³" else "cm²")) return@check "unit"
                if (level == 1 && m[4] != "das Volumen") return@check "level 1 volume"
                return@check checkAnswer(p, expected)
            }
            m = match("""Ein Quader mit der Grundfläche (\d+) cm² hat das Volumen (\d+) cm³\. Wie hoch ist er\?""", text)
            if (m != null) {
                if (level != 3) return@check "backwards at level 3"
                val right = number(p.correct)
                if (right == null || !close(m[1].toDouble() * right, m[2].toDouble())) return@check "volume does not fit back"
                return@check checkAnswer(p, right)
            }
            "prompt"
        }
    }

    @Test fun u08_solid() {
        check("u08.solid") { level, p ->
            val text = plain(p.prompt)
            var m = match("""Ein Prisma hat die Grundfläche (\d+) cm² und die Höhe (\d+) cm\. Wie groß ist das Volumen\?""", text)
            if (m != null) {
                if (level != 1) return@check "prism at level 1"
                return@check checkAnswer(p, m[1].toDouble() * m[2].toDouble())
            }
            m = match("""Ein Zylinder hat (den Radius|den Durchmesser) (\d+) cm und die Höhe (\d+) cm\. Berechne das Volumen in cm³\. Gib das Ergebnis als Vielfaches von π an\.""", text)
            if (m != null) {
                if (level < 2) return@check "cylinder from level 2"
                val given = m[2].toDouble()
                val r = if (m[1] == "den Radius") given else given / 2
                if (level == 2 && m[1] != "den Radius") return@check "diameter at level 3"
                return@check checkAnswer(p, r * r * m[3].toDouble())
            }
            "prompt"
        }
    }

    @Test fun u08_units() {
        check("u08.units") { level, p ->
            val text = plain(p.prompt)
            val m = match("""^Wandle um: (\d+(?:,\d+)?) (\S+) = \? (\S+)$""", text) ?: return@check "prompt"
            val value = number(m[1]) ?: return@check "prompt"
            val from = unitScale(m[2])
            val to = unitScale(m[3])
            if (from == null || to == null) return@check "units ${m[2]} ${m[3]}"
            // Area and volume units are not mixed.
            if (m[2].contains("²") != m[3].contains("²")) return@check "mixed units"
            val expected = value * from / to
            if (!(expected < 1000)) return@check "typed answer too big"
            if (level == 1 && (m[2].contains("³") || m[3].contains("³") || m[2] == "l" || m[3] == "l")) return@check "level 1 has areas"
            checkAnswer(p, expected)
        }
    }

    @Test fun u08_volumeWord() {
        check("u08.volumeWord") { level, p ->
            val text = plain(p.prompt)
            var m = match("""(?:Ein Aquarium|Ein Wassertank|Eine Kiste) ist (\d+) (dm|cm) lang, (\d+) (?:dm|cm) breit und (\d+) (?:dm|cm) hoch\. Wie viele Liter passen hinein\?""", text)
            if (m != null) {
                // Through cm³: 1000 cm³ are one liter.
                val factor = if (m[2] == "dm") 10.0 else 1.0
                val cm3 = m[1].toDouble() * factor * m[3].toDouble() * factor * m[4].toDouble() * factor
                if (level == 1 && m[2] != "dm") return@check "level 1 in dm"
                if (level == 2 && m[2] != "cm") return@check "level 2 in cm"
                return@check checkAnswer(p, cm3 / 1000)
            }
            m = match("""In ein Becken \((\d+) cm lang, (\d+) cm breit\) werden (\d+) l Wasser gefüllt\. Wie hoch steht das Wasser\?""", text)
            if (m != null) {
                if (level != 3) return@check "water level at level 3"
                val right = number(p.correct)
                if (right == null || !close(m[1].toDouble() * m[2].toDouble() * right, m[3].toDouble() * 1000)) return@check "volume does not fit back"
                return@check checkAnswer(p, right)
            }
            "prompt"
        }
    }

    @Test fun u08_angles() {
        check("u08.angles") { level, p ->
            val text = plain(p.prompt)
            val expected: Double
            val kind: Int
            val m1 = match("""In einem Dreieck sind α = (\d+)° und β = (\d+)°\. Wie groß ist γ\?""", text)
            val m2 = if (text.startsWith("Zwei Winkel liegen nebeneinander auf einer Geraden")) match("""Einer ist (\d+)° groß\. Wie groß ist der andere\?""", text) else null
            val m3 = match("""In einem Viereck sind drei Winkel (\d+)°, (\d+)° und (\d+)° groß\. Wie groß ist der vierte Winkel\?""", text)
            val m4 = match("""gleichschenkliges Dreieck hat (\d+)° an der Basis\. Wie groß ist der Winkel an der Spitze\?""", text)
            val m5 = match("""gleichschenkliges Dreieck hat (\d+)° an der Spitze\. Wie groß ist ein Basiswinkel\?""", text)
            val m6 = match("""In einem Dreieck ist α = (\d+)° und β ist (doppelt|dreimal) so groß wie α\. Wie groß ist γ\?""", text)
            if (m1 != null) { expected = 180.0 - m1[1].toDouble() - m1[2].toDouble(); kind = 0 }
            else if (m2 != null) { expected = 180.0 - m2[1].toDouble(); kind = 1 }
            else if (m3 != null) { expected = 360.0 - m3[1].toDouble() - m3[2].toDouble() - m3[3].toDouble(); kind = 2 }
            else if (m4 != null) { expected = 180.0 - 2 * m4[1].toDouble(); kind = 3 }
            else if (m5 != null) { expected = (180.0 - m5[1].toDouble()) / 2; kind = 3 }
            else if (m6 != null) {
                val a = m6[1].toDouble()
                expected = 180.0 - a - a * (if (m6[2] == "doppelt") 2 else 3); kind = 4
            } else return@check "prompt"
            if (!(expected > 0 && expected < 180)) return@check "angle $expected"
            if (level == 1 && kind > 1) return@check "level 1 kinds"
            if (level == 3 && kind < 2) return@check "level 3 kinds"
            if (!p.correct.endsWith("°")) return@check "unit"
            checkAnswer(p, expected)
        }
    }

    @Test fun u08_pythagoras() {
        check("u08.pythagoras") { level, p ->
            val text = plain(p.prompt)
            var m = match("die Katheten $NUM cm und $NUM cm lang\\. Wie lang ist die Hypotenuse\\?", text)
            if (m != null) {
                val a = number(m[1])!!; val b = number(m[2])!!
                val c = number(p.correct)
                if (c == null || !close(a * a + b * b, c * c) || !(c > maxOf(a, b))) return@check "a² + b² is not c²"
                if (level == 1 && (a > 12 || b > 12)) return@check "level 1 small triples"
                return@check checkAnswer(p, Math.sqrt(a * a + b * b))
            }
            m = match("die Hypotenuse $NUM cm und eine Kathete $NUM cm lang\\. Wie lang ist die andere Kathete\\?", text)
            if (m != null) {
                if (level < 2) return@check "legs from level 2"
                val c = number(m[1])!!; val a = number(m[2])!!
                val b = number(p.correct)
                if (b == null || !close(a * a + b * b, c * c) || !(c > a)) return@check "a² + b² is not c²"
                return@check checkAnswer(p, Math.sqrt(c * c - a * a))
            }
            "prompt"
        }
    }

    @Test fun u08_pythagorasWord() {
        check("u08.pythagorasWord") { _, p ->
            val text = plain(p.prompt)
            var m = match("Eine $NUM m lange Leiter lehnt an einer Wand\\. Ihr Fuß steht $NUM m von der Wand entfernt\\. Wie hoch reicht die Leiter\\?", text)
            if (m != null) {
                val c = number(m[1])!!; val a = number(m[2])!!
                val h = number(p.correct)
                if (h == null || !close(a * a + h * h, c * c) || !(c > a)) return@check "ladder"
                return@check checkAnswer(p, Math.sqrt(c * c - a * a))
            }
            m = match("Ein Rechteck ist $NUM cm lang und $NUM cm breit\\. Wie lang ist die Diagonale\\?", text)
                ?: match("Ein Sportplatz ist $NUM m lang und $NUM m breit\\. Anna läuft quer über die Diagonale\\. Wie lang ist ihr Weg\\?", text)
            if (m != null) {
                val a = number(m[1])!!; val b = number(m[2])!!
                val d = number(p.correct)
                if (d == null || !close(a * a + b * b, d * d)) return@check "diagonal"
                return@check checkAnswer(p, Math.sqrt(a * a + b * b))
            }
            "prompt"
        }
    }

    @Test fun u08_rightAngleTest() {
        check("u08.rightAngleTest") { _, p ->
            if (p.prompt != "Welche Seitenlängen gehören zu einem rechtwinkligen Dreieck?") return@check "prompt"
            fun sides(text: String): List<Int>? {
                val found = matches("""(\d+) cm""", text).map { it[1].toInt() }
                return if (found.size == 3) found.sorted() else null
            }
            val right = sides(p.correct)
            if (right == null || right[0] * right[0] + right[1] * right[1] != right[2] * right[2]) return@check "correct option ${p.correct}"
            val options = options(p)
            if (options.size != 3) return@check "three wrong options"
            for (option in options) {
                val s = sides(option) ?: return@check "wrong option $option"
                if (s[0] * s[0] + s[1] * s[1] == s[2] * s[2]) return@check "wrong option $option is right-angled"
                if (s[0] + s[1] <= s[2]) return@check "wrong option $option is no triangle"
            }
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, (right[0] * right[0] + right[1] * right[1]).toDouble())) return@check "typed answer"
            null
        }
    }

    // Unit 9

    private fun valueAt(text: String, x: Double): Double? = MathMiddleExpr.evaluate(text, mapOf('x' to x))

    private class Coeffs(val a: Double, val b: Double, val c: Double)

    /** a, b, c of the quadratic function given by the expression, from f(-1), f(0) and f(1). */
    private fun coefficients(expression: String): Coeffs? {
        val left = valueAt(expression, -1.0)
        val middle = valueAt(expression, 0.0)
        val right = valueAt(expression, 1.0)
        if (left == null || middle == null || right == null) return null
        return Coeffs((left + right) / 2 - middle, (right - left) / 2, middle)
    }

    /** The expression of "left = right" as left - right. */
    private fun difference(equation: String): String? {
        val sides = equation.split(" = ")
        if (sides.size != 2) return null
        return "(${sides[0]}) − (${sides[1]})"
    }

    private fun rootsOf(equation: String): List<Double>? {
        val expression = difference(equation)
        val k = if (expression != null) coefficients(expression) else null
        if (k == null || !(Math.abs(k.a) > 1e-9)) return null
        val d = k.b * k.b - 4 * k.a * k.c
        if (d < -1e-9) return emptyList()
        if (Math.abs(d) <= 1e-9) return listOf(-k.b / (2 * k.a))
        return listOf((-k.b + Math.sqrt(d)) / (2 * k.a), (-k.b - Math.sqrt(d)) / (2 * k.a)).sorted()
    }

    /** "3 und -1" or "5" as numbers, sorted. */
    private fun solutionSet(text: String): List<Double>? {
        val parts = text.split(" und ").map { number(it) }
        if (parts.any { it == null }) return null
        return parts.map { it!! }.sorted()
    }

    private fun same(a: List<Double>, b: List<Double>): Boolean = a.size == b.size && a.withIndex().all { (i, x) -> close(x, b[i]) }

    /** After the first line of the prompt. */
    private fun body(p: MathMiddleProblem): String = p.prompt.split("\n").drop(1).joinToString("\n")

    private class Vertex(val x: Double, val y: Double)

    private fun vertexOf(equation: String): Vertex? {
        if (!equation.startsWith("y = ")) return null
        val k = coefficients(equation.substring(4))
        if (k == null || !(Math.abs(k.a) > 1e-9)) return null
        val x = -k.b / (2 * k.a)
        val y = valueAt(equation.substring(4), x) ?: return null
        return Vertex(x, y)
    }

    private fun typedMatches(p: MathMiddleProblem, expected: Double): String? {
        val typed = typedAnswer(p)
        if (typed == null || !close(typed, expected)) return "typed answer $typed expected $expected"
        return null
    }

    /** The correct option and the typed answer are the roots of the equation; no wrong option is the same set. */
    private fun checkSolutions(p: MathMiddleProblem, equation: String, typedIsLarger: Boolean?): String? {
        val truth = rootsOf(equation)
        if (truth == null || truth.size != 2) return "roots of $equation"
        val given = solutionSet(p.correct)
        if (given == null || !same(given, truth)) return "correct option ${p.correct} roots $truth"
        // The solutions plugged back in.
        for (x in given) {
            val expression = difference(equation)
            val residual = if (expression != null) valueAt(expression, x) else null
            if (residual == null || !(Math.abs(residual) < 1e-9)) return "$x does not solve $equation"
        }
        for (option in options(p)) {
            val set = solutionSet(option) ?: return "wrong option $option"
            if (same(set, truth)) return "wrong option $option is right"
        }
        if (typedIsLarger != null) return typedMatches(p, if (typedIsLarger) truth[1] else truth[0])
        return null
    }

    @Test fun u09_vertexForm() {
        check("u09.vertexForm") { _, p ->
            val m = match("""^Lies den Scheitelpunkt ab\.\n(y = .+)$""", p.prompt)
            val v = if (m != null) vertexOf(m[1]) else null
            if (m == null || v == null) return@check "prompt"
            val s = match("""^S\((.+)\|(.+)\)$""", p.correct)
            if (s == null || !close(number(s[1])!!, v.x) || !close(number(s[2])!!, v.y)) return@check "correct ${p.correct} vertex ${v.x},${v.y}"
            if (p.pairFront != m[1]) return@check "pair front"
            val asksX = p.typed?.prompt?.contains("x-Koordinate") == true
            typedMatches(p, if (asksX) v.x else v.y)
        }
    }

    @Test fun u09_shift() {
        check("u09.shift") { _, p ->
            val v = vertexOf(body(p)) ?: return@check "prompt"
            val m = match("""^(\d+) nach (rechts|links) und (\d+) nach (oben|unten)$""", p.correct) ?: return@check "correct text"
            val x = (if (m[2] == "rechts") 1 else -1) * m[1].toDouble()
            val y = (if (m[4] == "oben") 1 else -1) * m[3].toDouble()
            if (!close(x, v.x) || !close(y, v.y)) return@check "${p.correct} vertex ${v.x},${v.y}"
            if (options(p).contains(p.correct)) "right option among the wrong" else null
        }
    }

    @Test fun u09_functionValue() {
        check("u09.functionValue") { _, p ->
            val m = match("""^Gegeben: f\(x\) = (.+)\nBerechne f\((.+)\)\.$""", p.prompt)
            val x = if (m != null) number(m[2]) else null
            val y = if (m != null && x != null) valueAt(m[1], x) else null
            if (m == null || x == null || y == null) return@check "prompt"
            val right = number(p.correct)
            if (right == null || !close(right, y)) return@check "correct ${p.correct} expected $y"
            for (option in options(p)) {
                val v = number(option) ?: return@check "wrong option $option"
                if (close(v, y)) return@check "wrong option $option is right"
            }
            typedMatches(p, y)
        }
    }

    @Test fun u09_extremum() {
        check("u09.extremum") { _, p ->
            val equation = body(p)
            val v = vertexOf(equation)
            val k = coefficients(equation.substring(4))
            if (v == null || k == null) return@check "prompt"
            val lowest = k.a > 0
            if (p.prompt.startsWith("Welchen")) {
                if (!p.prompt.contains(if (lowest) "kleinsten" else "größten")) return@check "wrong extreme"
                val right = number(p.correct)
                if (right == null || !close(right, v.y)) return@check "correct ${p.correct} vertex ${v.x},${v.y}"
                // The value really is the extreme: compare with nearby points.
                for (dx in listOf(-1.0, -0.5, 0.5, 1.0)) {
                    val near = valueAt(equation.substring(4), v.x + dx) ?: return@check "evaluation"
                    if (if (lowest) near < v.y - 1e-9 else near > v.y + 1e-9) return@check "not the extreme"
                }
                return@check typedMatches(p, v.y)
            }
            if (!p.prompt.contains(if (lowest) "am kleinsten" else "am größten")) return@check "wrong extreme"
            val right = number(p.correct)
            if (right == null || !close(right, v.x)) return@check "correct ${p.correct} vertex ${v.x},${v.y}"
            typedMatches(p, v.x)
        }
    }

    @Test fun u09_pureQuadratic() {
        check("u09.pureQuadratic") { _, p ->
            val equation = body(p)
            val message = checkSolutions(p, equation, null)
            if (message != null) return@check message
            val truth = rootsOf(equation) ?: return@check "roots"
            typedMatches(p, truth[1])
        }
    }

    @Test fun u09_factorForm() {
        check("u09.factorForm") { _, p ->
            val equation = body(p)
            if (!equation.endsWith(" = 0")) return@check "prompt"
            checkSolutions(p, equation, p.typed?.prompt?.contains("größere") == true)
        }
    }

    @Test fun u09_vertexZeros() {
        check("u09.vertexZeros") { level, p ->
            val equation = body(p)
            if (!equation.startsWith("y = ")) return@check "prompt"
            val asEquation = equation.substring(4) + " = 0"
            if (level == 1 && p.typed == null) return@check "typed"
            checkSolutions(p, asEquation, p.typed?.prompt?.contains("größere") == true)
        }
    }

    @Test fun u09_pqSolve() {
        check("u09.pqSolve") { _, p ->
            val equation = body(p)
            val k = if (equation.endsWith(" = 0")) coefficients(equation.dropLast(4)) else null
            if (k == null || !close(k.a, 1.0)) return@check "normal form"
            if (p.pairFront != equation) return@check "pair front"
            checkSolutions(p, equation, p.typed?.prompt?.contains("größere") == true)
        }
    }

    @Test fun u09_discriminant() {
        check("u09.discriminant") { _, p ->
            val equation = body(p)
            val k = coefficients(equation.dropLast(4))
            if (k == null || !close(k.a, 1.0)) return@check "normal form"
            // D = (p/2)² - q, once by that formula and once as the discriminant b² - 4ac divided by 4.
            val d = (k.b / 2) * (k.b / 2) - k.c
            if (!close(d, (k.b * k.b - 4 * k.a * k.c) / 4)) return@check "discriminant formulas"
            val expected = if (d < -1e-9) "keine Lösung" else if (Math.abs(d) <= 1e-9) "genau eine Lösung" else "zwei Lösungen"
            if (p.correct != expected) return@check "correct ${p.correct} expected $expected"
            val truth = rootsOf(equation)
            if (truth == null || truth.size != (if (d < -1e-9) 0 else if (Math.abs(d) <= 1e-9) 1 else 2)) return@check "root count"
            val typedEquation = p.typed?.let { match("""\n(.+ = 0)$""", it.prompt) }
            if (typedEquation == null || typedEquation[1] != equation) return@check "typed prompt"
            typedMatches(p, d)
        }
    }

    @Test fun u09_divideFirst() {
        check("u09.divideFirst") { _, p ->
            val given = body(p)
            val kGiven = coefficients(given.dropLast(4))
            if (kGiven == null || !(kGiven.a > 1)) return@check "prompt"
            // The correct equation is the given one with every coefficient divided by a, so x² stands alone.
            val c = if (p.correct.endsWith(" = 0")) coefficients(p.correct.dropLast(4)) else null
            if (c == null || !(close(c.a, 1.0) && close(c.b, kGiven.b / kGiven.a) && close(c.c, kGiven.c / kGiven.a))) return@check "correct ${p.correct}"
            for (option in options(p)) {
                val truth = rootsOf(option)
                val original = rootsOf(given)
                if (truth != null && original != null && same(truth, original)) return@check "wrong option $option keeps the roots"
            }
            val typed = p.typed ?: return@check "typed"
            if (typed.prompt.startsWith("Löse")) {
                val original = rootsOf(given) ?: return@check "roots"
                return@check typedMatches(p, original.last())
            }
            typedMatches(p, if (typed.prompt.contains("vor dem x")) c.b else c.c)
        }
    }

    @Test fun u09_vertexFromNormal() {
        check("u09.vertexFromNormal") { _, p ->
            val equation = body(p)
            val v = vertexOf(equation) ?: return@check "prompt"
            val s = match("""^S\((.+)\|(.+)\)$""", p.correct)
            if (s == null || !close(number(s[1])!!, v.x) || !close(number(s[2])!!, v.y)) return@check "correct ${p.correct} vertex ${v.x},${v.y}"
            for (option in options(p)) {
                val w = match("""^S\((.+)\|(.+)\)$""", option) ?: return@check "wrong option $option"
                if (close(number(w[1])!!, v.x) && close(number(w[2])!!, v.y)) return@check "wrong option $option is right"
            }
            typedMatches(p, if (p.typed?.prompt?.contains("x-Koordinate") == true) v.x else v.y)
        }
    }

    // Unit 10

    /** JS `String(parseFloat(x.toPrecision(9)))` with a decimal comma. */
    private fun decimalText(x: Double): String =
        BigDecimal(x).round(MathContext(9, RoundingMode.HALF_UP)).stripTrailingZeros().toPlainString().replace('.', ',')

    /**
     * The right option and the typed answer equal `expected`; the wrong options are other numbers, and a probability
     * strictly between 0 and 1 unless `percent`. The typed answer accepts an unreduced fraction and a decimal.
     */
    private fun checkProbability(p: MathMiddleProblem, expected: Double, percent: Boolean = false): String? {
        val right = number(p.correct)
        if (right == null || !close(right, expected)) return "correct option ${p.correct} expected $expected"
        val typed = typedAnswer(p)
        if (typed == null || !close(typed, expected)) return "typed answer $typed"
        for (option in options(p)) {
            val value = number(option) ?: return "wrong option $option"
            if (close(value, expected)) return "wrong option $option is right"
            if (!percent && (value <= 0 || value >= 1)) return "wrong option $option is not a probability"
        }
        val answer = p.typed?.answer ?: return "no typed answer"
        if (!percent) {
            val hint = p.typed?.prompt
            if (hint == null || !(hint.contains("Bruch oder Dezimalzahl") || hint.contains("Dezimalzahl oder Bruch"))) return "the typed prompt names the forms"
            val unreduced = "${answer.numerator * 3}/${answer.denominator * 3}"
            if (!accepts(p, unreduced)) return "unreduced $unreduced not accepted"
            var rest = answer.denominator
            for (prime in listOf(2L, 5L)) while (rest % prime == 0L) rest /= prime
            if (rest == 1L) {
                val decimal = decimalText(expected)
                if (!accepts(p, decimal)) return "decimal $decimal not accepted"
            }
            if (!accepts(p, p.correct)) return "${p.correct} not accepted"
            if (accepts(p, "${answer.numerator + 1}/${answer.denominator}")) return "a wrong fraction is accepted"
        }
        return null
    }

    /** The balls of the bag in the prompt: "R rote und B blaue Kugeln". */
    private fun bag(text: String): List<Char>? {
        val m = match("""(\d+) rote und (\d+) blaue Kugeln""", text) ?: return null
        return List(m[1].toInt()) { 'r' } + List(m[2].toInt()) { 'b' }
    }

    /** The share of the ordered draws of two balls, each ball one index, for which the test holds. */
    private fun share(balls: List<Char>, replacing: Boolean, test: (Char, Char) -> Boolean): Double {
        var total = 0
        var hits = 0
        for (i in balls.indices) {
            for (j in balls.indices) {
                if (!(replacing || i != j)) continue
                total += 1
                if (test(balls[i], balls[j])) hits += 1
            }
        }
        return hits.toDouble() / total
    }

    @Test fun u10_dieEvent() {
        check("u10.dieEvent") { level, p ->
            val text = plain(p.prompt)
            val m = match("""dass die Zahl (.+) ist\?$""", text) ?: return@check "prompt"
            val sidesMatch = match("""Zahlen 1 bis (\d+)""", text)
            val sides = if (sidesMatch != null) sidesMatch[1].toInt() else 6
            if (level == 1 && sides != 6) return@check "level 1 is the ordinary die"
            var count = 0
            for (face in 1..sides) {
                val phrase = m[1]
                var hit: Boolean
                val g1 = match("""^größer als (\d+)$""", phrase)
                val g2 = match("""^kleiner als (\d+)$""", phrase)
                val g3 = match("""^durch (\d+) teilbar$""", phrase)
                if (g1 != null) hit = face > g1[1].toInt()
                else if (g2 != null) hit = face < g2[1].toInt()
                else if (phrase == "gerade") hit = face % 2 == 0
                else if (phrase == "ungerade") hit = face % 2 == 1
                else if (phrase == "eine Primzahl") {
                    hit = face > 1
                    for (d in 2 until face) if (face % d == 0) hit = false
                } else if (g3 != null) hit = face % g3[1].toInt() == 0
                else return@check "event $phrase"
                if (hit) count += 1
            }
            checkProbability(p, count.toDouble() / sides)
        }
    }

    @Test fun u10_urn() {
        check("u10.urn") { level, p ->
            val text = plain(p.prompt)
            val contents = matches("""(\d+) (rote|blaue|grüne|gelbe)""", text.split(" Du ziehst")[0])
            val ask = match("""für eine (\S+)(?: oder eine (\S+))? Kugel\?""", text)
            if (contents.size < 2 || ask == null) return@check "prompt"
            if (level == 1 && contents.size != 2) return@check "two colours at level 1"
            var balls = listOf<String>()
            for (entry in contents) balls = balls + List(entry[1].toInt()) { entry[2] }
            val asked = listOf(ask[1], ask[2]).filter { it != "" }
            if (!asked.all { name -> contents.any { it[2] == name } }) return@check "asked colour is not in the bag"
            val hits = balls.count { it in asked }
            if (!(hits > 0 && hits < balls.size)) return@check "impossible or certain"
            checkProbability(p, hits.toDouble() / balls.size)
        }
    }

    @Test fun u10_frequency() {
        check("u10.frequency") { _, p ->
            val first = plain(p.prompt).split(" Wie groß")[0]
            val numbers = integers(first)
            if (numbers.size != 2 || !(numbers[1] < numbers[0])) return@check "prompt"
            checkProbability(p, numbers[1].toDouble() / numbers[0])
        }
    }

    @Test fun u10_range() {
        check("u10.range") { _, p ->
            fun isProbability(text: String): Boolean {
                val value = number(text) ?: return false
                val scaled = if (text.contains("%")) value / 100 else value
                val negative = text.startsWith("−") || text.startsWith("-")
                return !negative && scaled >= 0 && scaled <= 1
            }
            if (isProbability(p.correct)) return@check "the right option ${p.correct} is a probability"
            val options = options(p)
            for (option in options) if (!isProbability(option)) return@check "wrong option $option is no probability"
            if (options.size >= 3) null else "only ${options.size} probabilities"
        }
    }

    @Test fun u10_complement() {
        check("u10.complement") { level, p ->
            val text = plain(p.prompt)
            if (text.contains("weder Rot noch Blau")) {
                val m = match("""Rot (\d+)/(\d+) und für Blau (\d+)/(\d+)\.""", text)
                if (level != 3 || m == null) return@check "prompt"
                val a = m[1].toDouble() / m[2].toDouble()
                val b = m[3].toDouble() / m[4].toDouble()
                if (!(a + b < 1)) return@check "the two colours leave nothing"
                return@check checkProbability(p, 1 - a - b)
            }
            var m = match("""von (\d+) %\.""", text)
            if (m != null) {
                if (level < 2) return@check "percent from level 2"
                if (!p.correct.endsWith(" %")) return@check "percent sign"
                return@check checkProbability(p, 100 - m[1].toDouble(), true)
            }
            m = match("""mit der Wahrscheinlichkeit (\d+)/(\d+)\.""", text)
            if (m != null) {
                val value = m[1].toDouble() / m[2].toDouble()
                if (!(value > 0 && value < 1)) return@check "not a proper probability"
                return@check checkProbability(p, 1 - value)
            }
            "prompt"
        }
    }

    @Test fun u10_twoDice() {
        check("u10.twoDice") { level, p ->
            val text = plain(p.prompt)
            val m = match("""Wahrscheinlichkeit\? (.+)\.$""", text) ?: return@check "prompt"
            val event = m[1]
            var count = 0
            for (a in 1..6) {
                for (b in 1..6) {
                    val hit: Boolean
                    val g1 = match("""^Die Augensumme ist (\d+)$""", event)
                    val g2 = match("""^Die Augensumme ist mindestens (\d+)$""", event)
                    val g3 = match("""^Die Augensumme ist höchstens (\d+)$""", event)
                    val g4 = match("""^Das Produkt der Zahlen ist (\d+)$""", event)
                    if (g1 != null) hit = a + b == g1[1].toInt()
                    else if (g2 != null) hit = a + b >= g2[1].toInt()
                    else if (g3 != null) hit = a + b <= g3[1].toInt()
                    else if (g4 != null) hit = a * b == g4[1].toInt()
                    else if (event == "Beide Würfel zeigen dieselbe Zahl") hit = a == b
                    else if (event == "Beide Zahlen sind gerade") hit = a % 2 == 0 && b % 2 == 0
                    else if (event == "Mindestens ein Würfel zeigt eine 6") hit = a == 6 || b == 6
                    else if (event == "Das Produkt der Zahlen ist gerade") hit = (a * b) % 2 == 0
                    else if (event == "Die Zahlen unterscheiden sich um genau 2") hit = Math.abs(a - b) == 2
                    else if (event == "Die Zahlen sind verschieden") hit = a != b
                    else if (event == "Die Augensumme ist eine Primzahl") hit = listOf(2, 3, 5, 7, 11).contains(a + b)
                    else return@check "event $event"
                    if (hit) count += 1
                }
            }
            if (level == 1 && !(event.startsWith("Die Augensumme ist ") || event.startsWith("Beide Würfel"))) return@check "level 1 events"
            checkProbability(p, count / 36.0)
        }
    }

    @Test fun u10_expected() {
        check("u10.expected") { _, p ->
            val text = plain(p.prompt)
            val shown = match("""Wahrscheinlichkeit (\d+/\d+|\d+ %)[ .]""", text)
            val trials = match("""(?:(\d+)-mal|werden (\d+) Teile)""", text)
            if (shown == null || trials == null) return@check "prompt"
            val probability = if (shown[1].endsWith("%")) number(shown[1])!! / 100 else number(shown[1])!!
            val n = (if (trials[1] == "") trials[2] else trials[1]).toDouble()
            val expected = probability * n
            if (!close(expected, Math.floor(expected + 0.5)) || !(expected >= 1)) return@check "expected count is not a whole number"
            checkProbability(p, expected, true)
        }
    }

    @Test fun u10_withReplacement() {
        check("u10.withReplacement") { level, p ->
            val text = plain(p.prompt)
            val balls = bag(text)
            val m = match("""dass (.+)\?$""", text)
            if (balls == null || !text.contains("legst die Kugel nach jedem Zug zurück") || m == null) return@check "prompt"
            val test: (Char, Char) -> Boolean = when (m[1]) {
                "beide Kugeln sind rot" -> { a, b -> a == 'r' && b == 'r' }
                "beide Kugeln sind blau" -> { a, b -> a == 'b' && b == 'b' }
                "die erste Kugel ist rot und die zweite blau" -> { a, b -> a == 'r' && b == 'b' }
                "beide Kugeln haben dieselbe Farbe" -> {
                    if (level != 3) return@check "same colour at level 3"
                    { a, b -> a == b }
                }
                else -> return@check "event ${m[1]}"
            }
            checkProbability(p, share(balls, true, test))
        }
    }

    @Test fun u10_withoutReplacement() {
        check("u10.withoutReplacement") { level, p ->
            val text = plain(p.prompt)
            val balls = bag(text)
            val m = match("""dass (.+)\?$""", text)
            if (balls == null || !text.contains("ohne zurückzulegen") || m == null) return@check "prompt"
            val test: (Char, Char) -> Boolean = when (m[1]) {
                "beide Kugeln sind rot" -> { a, b -> a == 'r' && b == 'r' }
                "beide Kugeln sind blau" -> { a, b -> a == 'b' && b == 'b' }
                "die erste Kugel ist rot und die zweite blau" -> { a, b -> a == 'r' && b == 'b' }
                "mindestens eine Kugel ist rot" -> {
                    if (level != 3) return@check "at least one at level 3"
                    { a, b -> a == 'r' || b == 'r' }
                }
                else -> return@check "event ${m[1]}"
            }
            checkProbability(p, share(balls, false, test))
        }
    }

    @Test fun u10_twoPaths() {
        check("u10.twoPaths") { _, p ->
            val text = plain(p.prompt)
            val balls = bag(text)
            if (balls == null || !text.contains("zwei verschiedene Farben")) return@check "prompt"
            val replacing = text.contains("legst die Kugel nach jedem Zug zurück")
            if (!(replacing || text.contains("ohne zurückzulegen"))) return@check "kind of draw"
            checkProbability(p, share(balls, replacing) { a, b -> a != b })
        }
    }

    @Test fun u10_atLeastOne() {
        check("u10.atLeastOne") { level, p ->
            val text = plain(p.prompt)
            val success: Double
            val trials: Int
            val m1 = match("""Du wirfst eine Münze (\d+)-mal""", text)
            val m2 = match("""Du würfelst (\d+)-mal""", text)
            val m3 = match("""Wahrscheinlichkeit 1/(\d+)\. Du drehst (\d+)-mal""", text)
            if (m1 != null) { success = 0.5; trials = m1[1].toInt() }
            else if (m2 != null) { success = 1.0 / 6; trials = m2[1].toInt() }
            else if (m3 != null) { success = 1.0 / m3[1].toInt(); trials = m3[2].toInt() }
            else return@check "prompt"
            if (level == 1 && trials > 3) return@check "few trials at level 1"
            // Every sequence of hits and misses, the probabilities multiplied along it.
            var total = 0.0
            for (mask in 1 until (1 shl trials)) {
                var chance = 1.0
                for (bit in 0 until trials) chance *= if (((mask shr bit) and 1) != 0) success else 1 - success
                total += chance
            }
            checkProbability(p, total)
        }
    }

    @Test fun theTypedFormsAreAccepted() {
        for (text in listOf("3/4", "0,75", "6/8", "0.75")) assertEquals(text, true, NumberCheck.matches(text, "3/4"))
        assertEquals(false, NumberCheck.matches("3/5", "3/4"))
    }
}
