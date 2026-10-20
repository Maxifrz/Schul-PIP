package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.bruteGCD
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.check
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.close
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.lastLine
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.match
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.matches
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.number
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.typedAnswer
import org.junit.Test

/** Ports of LernwerkTests/MathCourseMiddleUnit05Tests.swift to Unit07Tests.swift. */
class MathMiddleUnit05to07Test {
    private val NUM = "(\\d+(?:,\\d+)?)"
    private val THIN = " "
    private fun jsRound(x: Double): Double = Math.floor(x + 0.5)
    private fun span(a: Int, b: Int): List<Int> = (a..b).toList()
    private fun options(p: MathMiddleProblem): List<String> = p.options

    // Unit 5

    private fun plain(text: String): String = text.replace(THIN, "").replace("\n", " ")

    /**
     * The right option, the typed answer and the wrong options of a number problem; the wrong ones must come from the
     * list of mistakes and never equal the answer.
     */
    private fun numbersCheck(p: MathMiddleProblem, expected: Double, mistakes: List<Double>): String? {
        val right = number(p.correct)
        if (right == null || !close(right, expected)) return "correct option ${p.correct} expected $expected"
        val typed = typedAnswer(p)
        if (typed == null || !close(typed, expected)) return "typed answer"
        for (option in options(p)) {
            val value = number(option) ?: return "wrong option $option"
            if (close(value, expected)) return "wrong option $option is right"
            if (!mistakes.any { close(it, value) }) return "wrong option $option is no known mistake"
        }
        return null
    }

    private class Table(val xs: List<Double>, val ys: List<Double>)

    private fun table(text: String): Table? {
        val m = match("x: ([\\d, ]+)\\ny: ([\\d, ?]+)", text) ?: return null
        fun numeric(s: String): List<Double> = s.split(", ").filter { Regex("^\\d+(\\.\\d+)?$").matches(it) }.map { it.toDouble() }
        return Table(numeric(m[1]), numeric(m[2]))
    }

    /** Each situation as a function of x: the kind follows from the numbers, not from a label. */
    private val models: Map<String, (Double) -> Double> = mapOf(
        "Anzahl der Brötchen → Gesamtpreis (jedes kostet gleich viel)" to { x -> 0.4 * x },
        "Fahrzeit → zurückgelegte Strecke (gleichbleibende Geschwindigkeit)" to { x -> 80 * x },
        "Seitenlänge eines Quadrats → Umfang des Quadrats" to { x -> 4 * x },
        "getankte Liter → Preis (fester Preis je Liter)" to { x -> 1.8 * x },
        "Anzahl der Kopien → Kosten (fester Preis je Kopie)" to { x -> 0.1 * x },
        "Anzahl gleicher Hefte → Gewicht aller Hefte" to { x -> 60 * x },
        "Anzahl der Arbeiter → Zeit für dieselbe Arbeit (alle gleich schnell)" to { x -> 120 / x },
        "Geschwindigkeit → Fahrzeit für dieselbe Strecke" to { x -> 240 / x },
        "Anzahl der Personen → Anteil jeder Person an einem festen Betrag" to { x -> 60 / x },
        "Anzahl der Pumpen → Zeit, um dasselbe Becken zu füllen" to { x -> 12 / x },
        "Anzahl der Fahrgäste → Fahrpreis je Person bei festen Busmiete" to { x -> 300 / x },
        "Anzahl der Tage → Tagesration eines festen Vorrats" to { x -> 90 / x },
        "Alter eines Kindes → Körpergröße" to { x -> 50 + 6 * x },
        "Seitenlänge eines Quadrats → Flächeninhalt" to { x -> x * x },
        "gefahrene Kilometer → Taxipreis mit Grundgebühr" to { x -> 4 + 2 * x },
        "Uhrzeit → Außentemperatur" to { x -> 10 + 8 * Math.sin(x / 4) },
        "Anzahl gelesener Seiten → noch ungelesene Seiten eines Buches" to { x -> 300 - x },
        "Radius eines Kreises → Flächeninhalt des Kreises" to { x -> Math.PI * x * x },
    )

    private fun kind(situation: String): String? {
        val f = models[situation] ?: return null
        val xs = listOf(1.0, 2.0, 3.0, 5.0, 8.0)
        if (xs.all { close(f(it) / it, f(1.0)) }) return "proportional"
        if (xs.all { close(f(it) * it, f(1.0)) }) return "antiproportional"
        return "weder"
    }

    @Test fun u05_proportional() {
        check("u05.proportional") { level, p ->
            val text = plain(p.prompt)
            val given: List<Double>
            val m1 = match(NUM + " Hefte kosten " + NUM + " €\\. Wie viel kosten " + NUM + " Hefte", text)
            val m2 = match("Für $NUM Stunden Arbeit bekommt Jonas $NUM €\\. Wie viel bekommt er für $NUM Stunden", text)
            val m3 = match("$NUM kg Äpfel kosten $NUM €\\. Wie viel kosten $NUM kg", text)
            val m4 = match("in $NUM Minuten $NUM Flaschen\\. Wie viele Flaschen füllt sie in $NUM Minuten", text)
            val m5 = match("fährt gleichmäßig $NUM km in $NUM Stunden\\. Wie weit fährt er in $NUM Stunden", text)
            if (m1 != null) given = listOf(number(m1[1])!!, number(m1[2])!!, number(m1[3])!!)
            else if (m2 != null) given = listOf(number(m2[1])!!, number(m2[2])!!, number(m2[3])!!)
            else if (m3 != null) given = listOf(number(m3[1])!!, number(m3[2])!!, number(m3[3])!!)
            else if (m4 != null) given = listOf(number(m4[1])!!, number(m4[2])!!, number(m4[3])!!)
            else if (m5 != null) given = listOf(number(m5[2])!!, number(m5[1])!!, number(m5[3])!!)
            else return@check "prompt"
            val n1 = given[0]; val p1 = given[1]; val n2 = given[2]
            if (n1 == n2) return@check "same number"
            // The cross product decides: p1 / n1 = answer / n2.
            val expected = p1 * n2 / n1
            if (!close(p1 * n2, expected * n1)) return@check "cross product"
            if (level == 3 && p.correct.contains(" km")) return@check "level 3 is about money"
            if (level == 1 && (n1 > 10 || expected >= 1000)) return@check "level 1 is small"
            if (p.pairFront == null) return@check "pair front"
            numbersCheck(p, expected, listOf(p1 + n2 - n1, p1 * n1 / n2, p1 * n2, p1 / n1))
        }
    }

    @Test fun u05_unitRate() {
        check("u05.unitRate") { _, p ->
            val text = plain(p.prompt)
            val n: Double
            val total: Double
            val m1 = match("$NUM kg Kirschen kosten $NUM €", text)
            val m2 = match("fährt $NUM km in $NUM Stunden", text)
            val m3 = match("laufen $NUM l in $NUM Minuten", text)
            if (m1 != null) { n = number(m1[1])!!; total = number(m1[2])!! }
            else if (m2 != null) { n = number(m2[2])!!; total = number(m2[1])!! }
            else if (m3 != null) { n = number(m3[2])!!; total = number(m3[1])!! }
            else return@check "prompt"
            // Plugged back in: n units of the rate make the total.
            val expected = total / n
            if (!close(expected * n, total)) return@check "does not fit back"
            numbersCheck(p, expected, listOf(n / total, total * n, total - n, total))
        }
    }

    @Test fun u05_factor() {
        check("u05.factor") { level, p ->
            val m = match("""Zu x = (\d+) gehört y = (\d+)\.""", p.prompt) ?: return@check "prompt"
            val x = m[1].toDouble(); val y = m[2].toDouble()
            if (p.pairFront != "x = ${m[1]}, y = ${m[2]}") return@check "pair front"
            if (level >= 2 && y % x == 0.0) return@check "levels 2 and 3 have a fraction as the factor"
            numbersCheck(p, y / x, listOf(x / y, y - x, x * y, y))
        }
    }

    @Test fun u05_antiproportional() {
        check("u05.antiproportional") { level, p ->
            val text = plain(p.prompt)
            val n1: Double
            val t1: Double
            val n2: Double
            val m1 = match("""(\d+) Arbeiter brauchen für ein Dach (\d+) Tage\. Wie viele Tage brauchen (\d+) Arbeiter""", text)
            val m2 = match("""(\d+) gleiche Pumpen füllen ein Becken in (\d+) Stunden\. Wie lange brauchen (\d+) Pumpen""", text)
            val m3 = match("""reicht für (\d+) Pferde (\d+) Tage\. Wie lange reicht er für (\d+) Pferde""", text)
            val m4 = match("""(\d+) Freunde teilen sich die Kosten für ein Boot, jeder zahlt (\d+(?:,\d+)?) €\. Wie viel zahlt jeder bei (\d+) Freunden""", text)
            if (m1 != null) { n1 = m1[1].toDouble(); t1 = m1[2].toDouble(); n2 = m1[3].toDouble() }
            else if (m2 != null) { n1 = m2[1].toDouble(); t1 = m2[2].toDouble(); n2 = m2[3].toDouble() }
            else if (m3 != null) { n1 = m3[1].toDouble(); t1 = m3[2].toDouble(); n2 = m3[3].toDouble() }
            else if (m4 != null) { n1 = m4[1].toDouble(); t1 = number(m4[2])!!; n2 = m4[3].toDouble() }
            else return@check "prompt"
            if (n1 == n2) return@check "same number"
            // The product stays the same: plugged back in.
            val expected = n1 * t1 / n2
            val right = number(p.correct)
            if (right == null || !close(n2 * right, n1 * t1)) return@check "product"
            if (level < 3 && expected != jsRound(expected)) return@check "levels 1 and 2 have whole answers"
            numbersCheck(p, expected, listOf(t1 * n2 / n1, t1 - (n2 - n1), t1 + (n2 - n1), n1 * t1))
        }
    }

    @Test fun u05_tableType() {
        check("u05.tableType") { _, p ->
            val t = table(p.prompt)
            if (t == null || t.xs.size != 3 || t.ys.size != 3) return@check "table"
            val xs = t.xs; val ys = t.ys
            val proportional = listOf(1, 2).all { close(ys[it] / xs[it], ys[0] / xs[0]) }
            val anti = listOf(1, 2).all { close(ys[it] * xs[it], ys[0] * xs[0]) }
            if (proportional && anti) return@check "both"
            val expected = if (proportional) "proportional" else if (anti) "antiproportional" else "weder noch"
            if (p.correct != expected) return@check "correct ${p.correct} expected $expected"
            val all = (options(p) + p.correct).toSet().sorted()
            if (all != listOf("antiproportional", "proportional", "weder noch")) return@check "options ${options(p)}"
            if (xs != xs.sorted() || xs.toSet().size != 3) return@check "x values"
            null
        }
    }

    @Test fun u05_situation() {
        check("u05.situation") { level, p ->
            val wanted = when (p.prompt) {
                "Welche Zuordnung ist proportional?" -> "proportional"
                "Welche Zuordnung ist antiproportional?" -> "antiproportional"
                "Welche Zuordnung ist weder proportional noch antiproportional?" -> "weder"
                else -> return@check "prompt"
            }
            if (level == 1 && wanted == "antiproportional") return@check "level 1 has no antiproportional question"
            if (kind(p.correct) != wanted) return@check "correct option ${p.correct} is ${kind(p.correct) ?: "unknown"}"
            val options = options(p)
            if (options.size != 3) return@check "three wrong options"
            for (option in options) if (kind(option) == null || kind(option) == wanted) return@check "wrong option $option is ${kind(option) ?: "unknown"}"
            // Both other kinds appear among the wrong options.
            if (options.mapNotNull { kind(it) }.toSet().size != 2) return@check "wrong options of one kind only"
            null
        }
    }

    @Test fun u05_tableFill() {
        check("u05.tableFill") { level, p ->
            val m = match("""^Die Zuordnung ist (proportional|antiproportional)\.""", p.prompt)
            val t = table(p.prompt)
            if (m == null || t == null || t.xs.size != 3 || t.ys.size != 2) return@check "prompt"
            val xs = t.xs; val ys = t.ys
            val anti = m[1] == "antiproportional"
            if (level == 1 && anti) return@check "level 1 is proportional"
            // The missing value from the first pair, by the rule of the kind.
            val expected = if (anti) xs[0] * ys[0] / xs[2] else ys[0] / xs[0] * xs[2]
            if (expected != jsRound(expected) || !(expected > 0)) return@check "not whole"
            // The second pair obeys the same rule.
            if (!(if (anti) close(xs[1] * ys[1], xs[0] * ys[0]) else close(ys[1] / xs[1], ys[0] / xs[0]))) return@check "second pair"
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed answer"
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option"
                if (close(value, expected)) return@check "wrong option $option is right"
            }
            null
        }
    }

    @Test fun u05_scale() {
        check("u05.scale") { level, p ->
            val text = plain(p.prompt)
            var m = match("""Maßstab 1 : (\d+)\. Eine Strecke ist auf der Karte (\d+) cm lang\. Wie lang ist sie in Wirklichkeit in (m|km)\?""", text)
            if (m != null) {
                if (level > 2) return@check "forward only below level 3"
                val n = m[1].toDouble()
                val d = m[2].toDouble()
                // Centimetres first, then the unit.
                val realCm = d * n
                val expected = if (m[3] == "m") realCm / 100 else realCm / 100000
                if (level == 1 && m[3] != "m") return@check "level 1 in metres"
                if (level == 2 && m[3] != "km") return@check "level 2 in kilometres"
                return@check numbersCheck(p, expected, listOf(expected * 10, expected / 10, expected * 100, expected / 100))
            }
            m = match("""Zwei Orte sind (\d+) km voneinander entfernt\. Wie viele cm sind das auf einer Karte im Maßstab 1 : (\d+)\?""", text)
            if (m != null) {
                if (level != 3) return@check "back only at level 3"
                val km = m[1].toDouble()
                val n = m[2].toDouble()
                val expected = km * 100000 / n
                // Plugged back in: the map length times the factor is the real length.
                val right = number(p.correct)
                if (right == null || !close(right * n, km * 100000)) return@check "back"
                return@check numbersCheck(p, expected, listOf(expected * 10, expected / 10, expected * 100, expected / 100))
            }
            "prompt"
        }
    }

    @Test fun u05_ratioSplit() {
        check("u05.ratioSplit") { _, p ->
            val text = plain(p.prompt)
            val p1: Int
            val q1: Int
            val total: Int
            val askFirst: Boolean
            val m1 = match("""Anna und Ben teilen (\d+) € im Verhältnis (\d+) : (\d+)\. Wie viel bekommt (Anna|Ben)\?""", text)
            val m2 = match("""Verhältnis Saft : Wasser = (\d+) : (\d+) und ist (\d+) l groß\. Wie viele Liter sind (Saft|Wasser)\?""", text)
            val m3 = match("""Ein Gewinn von (\d+) € wird im Verhältnis (\d+) : (\d+) auf zwei Spieler verteilt\. Wie viel bekommt (der Erste|der Zweite)\?""", text)
            if (m1 != null) { total = m1[1].toInt(); p1 = m1[2].toInt(); q1 = m1[3].toInt(); askFirst = m1[4] == "Anna" }
            else if (m2 != null) { total = m2[3].toInt(); p1 = m2[1].toInt(); q1 = m2[2].toInt(); askFirst = m2[4] == "Saft" }
            else if (m3 != null) { total = m3[1].toInt(); p1 = m3[2].toInt(); q1 = m3[3].toInt(); askFirst = m3[4] == "der Erste" }
            else return@check "prompt"
            val parts = p1 + q1
            if (total % parts != 0) return@check "parts do not divide the total"
            val expected = total.toDouble() * (if (askFirst) p1 else q1) / parts
            // The two shares add up to the total.
            val other = total.toDouble() * (if (askFirst) q1 else p1) / parts
            if (!close(expected + other, total.toDouble())) return@check "shares"
            if (bruteGCD(p1, q1) != 1) return@check "ratio not reduced"
            val k = total.toDouble() / parts
            val part = (if (askFirst) p1 else q1).toDouble()
            numbersCheck(p, expected, listOf(other, k, total - k, total / 2.0, total / part))
        }
    }

    @Test fun u05_ratioReduce() {
        check("u05.ratioReduce") { level, p ->
            val text = plain(p.prompt)
            val a: Int
            val b: Int
            val m1 = match("""^Kürze das Verhältnis vollständig: (\d+) : (\d+)$""", text)
            val m2 = match("""Ein Rezept braucht (\d+) g Mehl und (\d+) g Zucker""", text)
                ?: match("""In einer Klasse sind (\d+) Mädchen und (\d+) Jungen""", text)
                ?: match("""Ein Rechteck ist (\d+) cm lang und (\d+) cm breit""", text)
            val m3 = match("""Verhältnis (\d+) (g|cm|min) : (\d+) (kg|m|h), vollständig""", text)
            if (m1 != null) {
                if (level != 1) return@check "plain only at level 1"
                a = m1[1].toInt(); b = m1[2].toInt()
            } else if (m2 != null) {
                if (level != 2) return@check "stories at level 2"
                a = m2[1].toInt(); b = m2[2].toInt()
            } else if (m3 != null) {
                if (level != 3) return@check "units at level 3"
                val factor = mapOf("g" to 1000, "cm" to 100, "min" to 60)[m3[2]]!!
                a = m3[1].toInt(); b = m3[3].toInt() * factor
            } else {
                return@check "prompt"
            }
            val g = bruteGCD(a, b)
            val expected = "${a / g} : ${b / g}"
            if (p.correct != expected) return@check "correct ${p.correct} expected $expected"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, (b / g).toDouble())) return@check "typed answer"
            for (option in options(p)) {
                val w = match("""^(\d+) : (\d+)$""", option) ?: return@check "wrong option $option"
                val x = w[1].toInt(); val y = w[2].toInt()
                // A wrong option is never the fully reduced ratio of the same numbers.
                if (bruteGCD(x, y) == 1 && x * (b / g) == y * (a / g)) return@check "wrong option $option is right"
                if (option == expected) return@check "wrong option equals the answer"
            }
            null
        }
    }

    // Unit 6

    private val NUMBER6 = "(−?\\d+(?:,\\d+)?)"

    /** The value of the right side of "y = ..." at x. */
    private fun valueOf(line: String, x: Double): Double? {
        if (!line.startsWith("y = ")) return null
        return MathMiddleExpr.evaluate(line.substring(4), mapOf('x' to x))
    }

    private class LineParts(val m: Double, val b: Double)

    /** Slope and intercept of a line; null unless it is a straight line. */
    private fun parts(line: String): LineParts? {
        val f0 = valueOf(line, 0.0)
        val f1 = valueOf(line, 1.0)
        val f3 = valueOf(line, 3.0)
        val fm = valueOf(line, -2.0)
        if (f0 == null || f1 == null || f3 == null || fm == null) return null
        val m = f1 - f0
        if (!close(f3, f0 + 3 * m) || !close(fm, f0 - 2 * m)) return null
        return LineParts(m, f0)
    }

    private class Pt(val name: String, val x: Double, val y: Double)

    private fun points(text: String): List<Pt> =
        matches("([PQ])\\($NUMBER6\\|$NUMBER6\\)", text).map { Pt(it[1], number(it[2])!!, number(it[3])!!) }

    /** A whole number the way the course writes it. */
    private fun wholeText(value: Double): String = MathMiddleText.int(value.toInt())

    @Test fun u06_readEquation() {
        check("u06.readEquation") { level, p ->
            val equation = lastLine(p.prompt)
            val pr = parts(equation)
            if (pr == null || pr.b == 0.0 || pr.m == 0.0) return@check "equation $equation"
            val m = pr.m; val b = pr.b
            val asksSlope = p.prompt.startsWith("Welche Steigung")
            if (!(asksSlope || p.prompt.startsWith("Wie groß ist der y-Achsenabschnitt"))) return@check "prompt"
            val expected = if (asksSlope) m else b
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct} expected $expected"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed answer"
            val mistakes = if (asksSlope) listOf(b, 1 / m, m + b, m * b) else listOf(m, -b / m, b + m, m * b)
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option $option"
                if (close(value, expected)) return@check "wrong option $option is right"
                if (!mistakes.any { close(it, value) }) return@check "wrong option $option is no known mistake"
            }
            if (level == 1 && (m < 1 || m != jsRound(m))) return@check "level 1 has whole positive slopes"
            if (p.pairFront != "${if (asksSlope) "Steigung" else "y-Achsenabschnitt"} von $equation") return@check "pair front"
            null
        }
    }

    @Test fun u06_functionValue() {
        check("u06.functionValue") { level, p ->
            val lines = p.prompt.split("\n")
            val m = if (lines.size == 2) match("""^Gegeben: f\(x\) = (.+)$""", lines[0]) else null
            val pr = if (m != null) parts("y = " + m[1]) else null
            if (lines.size != 2 || m == null || pr == null) return@check "prompt"
            val rule = "y = " + m[1]
            var ask = match("^Berechne f\\($NUMBER6\\)\\.$", lines[1])
            if (ask != null) {
                val x = number(ask[1])!!
                val expected = valueOf(rule, x)!!
                val right = number(p.correct)
                if (right == null || !close(right, expected)) return@check "correct option"
                val typed = typedAnswer(p)
                if (typed == null || !close(typed, expected)) return@check "typed"
                for (option in options(p)) {
                    val value = number(option) ?: return@check "wrong option"
                    if (close(value, expected)) return@check "wrong option $option is right"
                }
                if (level == 1 && (x <= 0 || pr.m <= 0)) return@check "level 1 positive"
                if (p.pairFront != "f(x) = ${m[1]}, f(${ask[1]})") return@check "pair front"
                return@check null
            }
            ask = match("^Für welches x gilt f\\(x\\) = $NUMBER6\\?$", lines[1])
            if (ask != null) {
                if (level != 3) return@check "inverse only at level 3"
                val y = number(ask[1])!!
                val right = number(p.correct)
                val atRight = if (right == null) null else valueOf(rule, right)
                if (right == null || atRight == null || !close(atRight, y)) return@check "the solution does not fit"
                val typed = typedAnswer(p)
                if (typed == null || !close(typed, right)) return@check "typed"
                for (option in options(p)) {
                    val value = number(option) ?: return@check "wrong option"
                    val at = valueOf(rule, value)
                    if (at != null && close(at, y)) return@check "wrong option $option fits"
                }
                return@check null
            }
            "second line"
        }
    }

    @Test fun u06_slopeTriangle() {
        check("u06.slopeTriangle") { level, p ->
            val m = match("""gehst du (\d+) Einheiten nach rechts und (\d+) Einheiten nach (oben|unten)""", p.prompt) ?: return@check "prompt"
            val dx = m[1].toInt(); val up = m[2].toInt()
            val dy = if (m[3] == "oben") up else -up
            val expected = dy.toDouble() / dx
            if (Math.abs(expected) == 1.0) return@check "slope 1"
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct}"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed"
            // Rising lines have a positive slope, falling ones a negative one.
            if ((expected > 0) != (m[3] == "oben")) return@check "direction"
            val mistakes = listOf(dx.toDouble() / up * (if (dy > 0) 1 else -1), (dx + up).toDouble(), ((up - dx) * (if (dy > 0) 1 else -1)).toDouble(), dy.toDouble())
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option"
                if (close(value, expected)) return@check "wrong option $option is right"
                if (!mistakes.any { close(it, value) }) return@check "wrong option $option is no known mistake"
            }
            if (level == 1 && (dy <= 0 || dy % dx != 0)) return@check "level 1 rises evenly"
            null
        }
    }

    @Test fun u06_zeroPoint() {
        check("u06.zeroPoint") { level, p ->
            val equation = lastLine(p.prompt)
            val pr = parts(equation)
            val zero = number(p.correct)
            if (!p.prompt.startsWith("Berechne die Nullstelle") || pr == null || zero == null) return@check "prompt"
            val m = pr.m; val b = pr.b
            val atZero = valueOf(equation, zero)
            if (atZero == null || !(Math.abs(atZero) < 1e-9)) return@check "f at the zero is $atZero"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, zero)) return@check "typed"
            for (option in options(p)) {
                val value = number(option)
                val at = if (value == null) null else valueOf(equation, value)
                if (value == null || at == null) return@check "wrong option"
                if (Math.abs(at) < 1e-9) return@check "wrong option $option is a zero"
                if (!listOf(b / m, m / b, b, m + b).any { close(it, value) }) return@check "wrong option $option is no known mistake"
            }
            if (level == 3 && zero == jsRound(zero)) return@check "level 3 has fractions"
            null
        }
    }

    @Test fun u06_slopeTwoPoints() {
        check("u06.slopeTwoPoints") { _, p ->
            val pts = points(p.prompt)
            if (pts.size != 2 || pts[0].x == pts[1].x) return@check "points"
            val expected = (pts[1].y - pts[0].y) / (pts[1].x - pts[0].x)
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct}"
            // The line through P with this slope runs through Q.
            if (!close(pts[0].y + right * (pts[1].x - pts[0].x), pts[1].y)) return@check "Q is not on the line"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed"
            val dx = pts[1].x - pts[0].x
            val dy = pts[1].y - pts[0].y
            val mistakes = listOf(dx / dy, (pts[1].y + pts[0].y) / (pts[1].x + pts[0].x), dy, dx)
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option"
                if (close(value, expected)) return@check "wrong option $option is right"
                if (!mistakes.any { close(it, value) }) return@check "wrong option $option is no known mistake"
            }
            if (p.pairFront != "P(${wholeText(pts[0].x)}|${wholeText(pts[0].y)}), Q(${wholeText(pts[1].x)}|${wholeText(pts[1].y)})") return@check "pair front ${p.pairFront ?: ""}"
            null
        }
    }

    @Test fun u06_yIntercept() {
        check("u06.yIntercept") { _, p ->
            val m = match("Steigung $NUMBER6 und geht durch P\\($NUMBER6\\|$NUMBER6\\)", p.prompt) ?: return@check "prompt"
            val slope = number(m[1])!!; val x = number(m[2])!!; val y = number(m[3])!!
            val b = number(p.correct)
            if (b == null || !close(slope * x + b, y)) return@check "the point is not on the line"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, b)) return@check "typed"
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option"
                if (close(slope * x + value, y)) return@check "wrong option $option is right"
            }
            null
        }
    }

    @Test fun u06_lineThroughTwo() {
        check("u06.lineThroughTwo") { level, p ->
            val pts = points(p.prompt)
            if (pts.size != 2) return@check "points"
            fun onLine(line: String): Boolean = pts.all { pt ->
                val v = valueOf(line, pt.x)
                v != null && close(v, pt.y)
            }
            if (parts(p.correct) == null || !onLine(p.correct)) return@check "correct line ${p.correct}"
            for (option in options(p)) {
                if (parts(option) == null) return@check "wrong option $option is no line"
                if (onLine(option)) return@check "wrong option $option goes through both points"
            }
            val pr = parts(p.correct)
            val typed = typedAnswer(p)
            if (pr == null || typed == null || !close(typed, pr.b) || p.typed?.prompt?.contains("y-Achsenabschnitt") != true) return@check "typed"
            if (p.pairFront != "P(${wholeText(pts[0].x)}|${wholeText(pts[0].y)}), Q(${wholeText(pts[1].x)}|${wholeText(pts[1].y)})") return@check "pair front"
            if (level == 3 && !p.correct.contains(",") && !p.correct.contains("x")) return@check "line"
            null
        }
    }

    @Test fun u06_pointTest() {
        check("u06.pointTest") { _, p ->
            val equation = lastLine(p.prompt)
            if (!p.prompt.startsWith("Welcher Punkt liegt auf der Geraden?") || parts(equation) == null) return@check "prompt"
            val right = points(p.correct).firstOrNull()
            val y0 = if (right != null) valueOf(equation, right.x) else null
            if (right == null || y0 == null || !close(y0, right.y)) return@check "correct point ${p.correct}"
            val options = options(p)
            if (options.size < 2) return@check "options"
            for (option in options) {
                val point = points(option).firstOrNull() ?: return@check "wrong option $option"
                val y = valueOf(equation, point.x)
                if (y != null && close(y, point.y)) return@check "wrong option $option lies on the line"
            }
            val typedPrompt = p.typed?.prompt
            val m = if (typedPrompt != null) match("^Der Punkt P\\($NUMBER6\\|a\\) liegt auf der Geraden\\.\\n(.+)\\nWie groß ist a\\?$", typedPrompt) else null
            if (m == null || m[2] != equation) return@check "typed prompt"
            val typed = typedAnswer(p)
            val expected = valueOf(equation, number(m[1])!!)
            if (typed == null || expected == null || !close(typed, expected) || !close(expected, right.y)) return@check "typed answer"
            null
        }
    }

    @Test fun u06_parallel() {
        check("u06.parallel") { _, p ->
            val g = match("""zu\n(y = .+)\?$""", p.prompt)
            val given = g?.get(1)
            val pr = if (given != null) parts(given) else null
            if (!p.prompt.startsWith("Welche Gerade verläuft parallel zu\n") || given == null || pr == null) return@check "prompt"
            val right = parts(p.correct)
            if (right == null || !close(right.m, pr.m) || close(right.b, pr.b)) return@check "correct option ${p.correct}"
            for (option in options(p)) {
                val w = parts(option) ?: return@check "wrong option $option"
                if (close(w.m, pr.m)) return@check "wrong option $option is parallel"
            }
            // Through a point: b of the parallel.
            val typedPrompt = p.typed?.prompt
            val q = if (typedPrompt != null) match("geht durch P\\($NUMBER6\\|$NUMBER6\\)", typedPrompt) else null
            if (q == null) return@check "typed prompt"
            val x = number(q[1])!!; val y = number(q[2])!!
            val typed = typedAnswer(p)
            if (typed == null || !close(pr.m * x + typed, y) || !close(typed, right.b)) return@check "typed answer"
            null
        }
    }

    private class Story(val b: Double, val m: Double, val question: String)

    @Test fun u06_application() {
        check("u06.application") { level, p ->
            val text = p.prompt.split("\n").joinToString(" ")
            val story: Story
            val asksValue: Boolean
            var askedX: Double? = null
            val q1 = match("kostet $NUMBER6 € Grundgebühr im Monat und $NUMBER6 € je Gesprächsminute\\. (.+)$", text)
            val q2 = match("Eine Kerze ist $NUMBER6 cm hoch und brennt $NUMBER6 cm in jeder Stunde ab\\. (.+)$", text)
            val q3 = match("In einem Becken sind $NUMBER6 l Wasser\\. Es kommen $NUMBER6 l je Minute dazu\\. (.+)$", text)
            if (q1 != null) {
                story = Story(number(q1[1])!!, number(q1[2])!!, q1[3])
                val a = match("""Wie viel kostet es bei (\d+) Minuten\?""", story.question)
                if (a != null) { askedX = a[1].toDouble(); asksValue = true }
                else if (match("Die Rechnung beträgt $NUMBER6 €\\. Wie viele Minuten wurde telefoniert\\?", story.question) != null) asksValue = false
                else return@check "question ${story.question}"
            } else if (q2 != null) {
                story = Story(number(q2[1])!!, -number(q2[2])!!, q2[3])
                val a = match("""Wie hoch ist sie nach (\d+) Stunden\?""", story.question)
                if (a != null) { askedX = a[1].toDouble(); asksValue = true }
                else if (match("Die Kerze ist nur noch $NUMBER6 cm hoch\\. Wie lange brennt sie schon\\?", story.question) != null) asksValue = false
                else return@check "question ${story.question}"
            } else if (q3 != null) {
                story = Story(number(q3[1])!!, number(q3[2])!!, q3[3])
                val a = match("""Wie viel Wasser ist nach (\d+) Minuten im Becken\?""", story.question)
                if (a != null) { askedX = a[1].toDouble(); asksValue = true }
                else if (match("Im Becken sind jetzt $NUMBER6 l\\. Wie viele Minuten läuft das Wasser schon\\?", story.question) != null) asksValue = false
                else return@check "question ${story.question}"
            } else {
                return@check "prompt"
            }
            val b = story.b; val m = story.m
            val right = number(p.correct)
            val typed = typedAnswer(p)
            if (right == null || typed == null || !close(typed, right)) return@check "answer"
            if (asksValue) {
                if (!(level < 3) || askedX == null) return@check "forward below level 3"
                if (!close(right, b + m * askedX) || !(right > 0)) return@check "value"
            } else {
                if (level != 3) return@check "backwards only at level 3"
                // The given value: try every whole number of units.
                val target = if (text.contains("Rechnung")) number(match("beträgt $NUMBER6 €", text)!![1])!!
                else number(match("(?:noch|jetzt) $NUMBER6 (?:cm hoch|l)", text)!![1])!!
                val hits = span(0, 400).filter { close(b + m * it, target) }
                if (hits.size != 1 || !close(hits[0].toDouble(), right)) return@check "brute force $hits vs $right"
            }
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option"
                if (close(value, right)) return@check "wrong option $option is right"
            }
            null
        }
    }

    // Unit 7

    /** All the letters the course uses as a base stand for the same number, so a law of powers can be checked by value. */
    private val letters = mapOf('x' to 1.3, 'a' to 1.3, 'y' to 1.3, 'z' to 1.3)

    private fun evalText(text: String): Double? = MathMiddleExpr.evaluate(text.replace(THIN, ""), letters)

    /** "Berechne <expression>." gives the expression. */
    private fun expressionAfter(prefix: String, prompt: String): String? {
        if (!prompt.startsWith(prefix) || !prompt.endsWith(".")) return null
        return prompt.substring(prefix.length, prompt.length - 1)
    }

    private fun differ(p: MathMiddleProblem, expected: Double, parse: (String) -> Double?): String? {
        for (option in options(p)) {
            val value = parse(option) ?: return "wrong option $option"
            if (close(value, expected)) return "wrong option $option is right"
        }
        return null
    }

    private val superDigits = mapOf('⁰' to '0', '¹' to '1', '²' to '2', '³' to '3', '⁴' to '4', '⁵' to '5', '⁶' to '6', '⁷' to '7', '⁸' to '8', '⁹' to '9')

    /** The exponent of a power written with superscripts: "x⁷" gives 7. */
    private fun exponentOf(power: String): Int? {
        val text = power.map { superDigits[it]?.toString() ?: "" }.joinToString("")
        return if (text == "") (if (power.contains("⁻")) null else 1) else text.toInt()
    }

    private fun checkPower(p: MathMiddleProblem): String? {
        val lines = p.prompt.split("\n")
        val expected = if (lines.size == 2) evalText(lines[1]) else null
        if (lines.size != 2 || lines[0] != "Vereinfache zu einer Potenz:" || expected == null) return "prompt"
        val right = evalText(p.correct)
        if (right == null || !close(right, expected)) return "correct option ${p.correct} expected $expected"
        val chars = p.correct.toList()
        val first = chars.indexOfFirst { superDigits.containsKey(it) }
        val n = exponentOf(if (first < 0) "" else chars.drop(first).joinToString("")) ?: (if (chars.size <= 2) 1 else null)
        if (n == null) return "exponent of ${p.correct}"
        val typed = typedAnswer(p)
        if (typed == null || !close(typed, n.toDouble())) return "typed $typed expected $n"
        if (p.pairFront != lines[1]) return "pair front"
        return differ(p, expected) { evalText(it) }
    }

    @Test fun u07_powerValue() {
        check("u07.powerValue") { level, p ->
            val text = expressionAfter("Berechne ", p.prompt)
            val expected = if (text == null) null else evalText(text)
            if (text == null || expected == null) return@check "prompt"
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct} expected $expected"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed"
            if (p.pairFront != text) return@check "pair front"
            if (level == 3 && !text.startsWith("(")) return@check "level 3 is a fraction or decimal in brackets"
            if (level < 3 && text.contains("(")) return@check "no brackets below level 3"
            differ(p, expected) { number(it) }
        }
    }

    @Test fun u07_negativeBase() {
        check("u07.negativeBase") { level, p ->
            val text = expressionAfter("Berechne ", p.prompt)
            val expected = if (text == null) null else evalText(text)
            if (text == null || expected == null) return@check "prompt"
            // The sign by counting minus factors, another way than evaluating.
            val m = match("""^(\(−(\d)\)|−(\d))(⁰|¹|²|³|⁴)$""", text)
            if (m != null) {
                val base = (if (m[2] == "") m[3] else m[2]).toDouble()
                val n = exponentOf(m[4])!!
                val bracketed = m[2] != ""
                val magnitude = Math.pow(base, n.toDouble())
                val negative = if (bracketed) n % 2 == 1 else true
                if (!close(expected, if (negative) -magnitude else magnitude)) return@check "sign by counting $expected"
            } else if (level != 3) {
                return@check "form $text"
            }
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct} expected $expected"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed"
            if (level == 1 && !text.contains("²")) return@check "level 1 squares"
            differ(p, expected) { number(it) }
        }
    }

    @Test fun u07_squareRoot() {
        check("u07.squareRoot") { _, p ->
            val text = expressionAfter("Berechne ", p.prompt)
            val radicand = if (text != null && text.startsWith("√")) evalText(text.substring(1)) else null
            if (text == null || radicand == null) return@check "prompt"
            val right = number(p.correct) ?: return@check "correct"
            // Squared again: the answer is the number the radicand comes from.
            if (!close(right * right, radicand) || !(right > 0)) return@check "squared $right is not $radicand"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, right)) return@check "typed"
            if (p.pairFront != text) return@check "pair front"
            differ(p, right) { number(it) }
        }
    }

    @Test fun u07_estimateRoot() {
        check("u07.estimateRoot") { _, p ->
            val m = match("""liegt √(\d+)\?$""", p.prompt)
            val c = match("""^(\d+) und (\d+)$""", p.correct)
            if (m == null || c == null) return@check "prompt"
            val n = m[1].toInt()
            val low = c[1].toInt(); val high = c[2].toInt()
            val root = Math.sqrt(n.toDouble())
            if (!(high == low + 1 && low < root && root < high)) return@check "bounds $low $high for $root"
            val typed = typedAnswer(p)
            if (typed == null || typed.toInt() != jsRound(root).toInt()) return@check "nearest whole number $typed for $root"
            for (option in options(p)) {
                val w = match("""^(\d+) und (\d+)$""", option) ?: return@check "wrong option $option"
                val wl = w[1].toInt(); val wh = w[2].toInt()
                if (wl < root && root < wh) return@check "wrong option $option contains the root"
            }
            if (p.pairFront != "√$n") return@check "pair front"
            null
        }
    }

    @Test fun u07_sameBase() {
        check("u07.sameBase") { level, p ->
            val message = checkPower(p)
            if (message != null) return@check message
            val expression = p.prompt.split("\n")[1]
            if (level == 1 && (expression.contains(":") || expression.contains("("))) return@check "level 1 multiplies two powers"
            if (level == 3 && !(expression.contains("(") || expression.split(" · ").size == 3)) return@check "level 3 form"
            null
        }
    }

    @Test fun u07_powerOfPower() {
        check("u07.powerOfPower") { level, p ->
            val message = checkPower(p)
            if (message != null) return@check message
            val expression = p.prompt.split("\n")[1]
            if (!expression.startsWith("(")) return@check "bracket first"
            if (level == 1 && (expression.contains(":") || expression.contains("·"))) return@check "level 1 is a plain power of a power"
            null
        }
    }

    @Test fun u07_sameExponent() {
        check("u07.sameExponent") { _, p ->
            val lines = p.prompt.split("\n")
            val expected = if (lines.size == 2) evalText(lines[1]) else null
            if (lines.size != 2 || lines[0] != "Fasse zu einer Potenz zusammen:" || expected == null) return@check "prompt"
            val right = evalText(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct} expected $expected"
            val typed = typedAnswer(p)
            if (p.typed?.prompt?.endsWith("Welche Zahl steht in der Basis?") != true || typed == null) return@check "typed prompt"
            val base = match("^(\\d+)[⁰¹²³⁴⁵⁶⁷⁸⁹]+$", p.correct)
            if (base == null || !close(typed, base[1].toDouble())) return@check "typed answer"
            // Both factors have the same exponent.
            val exponents = matches("\\d+([⁰¹²³⁴⁵⁶⁷⁸⁹]+)", lines[1]).map { it[1] }
            if (exponents.size != 2 || exponents[0] != exponents[1]) return@check "same exponent"
            differ(p, expected) { evalText(it) }
        }
    }

    @Test fun u07_negativeExponent() {
        check("u07.negativeExponent") { level, p ->
            val m = match("""^Schreibe (.+) als Bruch oder ganze Zahl\.$""", p.prompt)
            val expected = if (m != null) evalText(m[1]) else null
            if (m == null || expected == null) return@check "prompt"
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct} expected $expected"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed"
            if (!m[1].contains("⁻")) return@check "negative exponent"
            if (level < 3 && m[1].contains("(")) return@check "brackets only at level 3"
            if (p.pairFront != m[1]) return@check "pair front"
            differ(p, expected) { number(it) }
        }
    }

    private class Sci(val mantissa: Double, val exponent: Int)

    @Test fun u07_scientific() {
        check("u07.scientific") { level, p ->
            val m = match("""^Schreibe (.+) in der Form a · 10ⁿ mit 1 ≤ a < 10\.$""", p.prompt) ?: return@check "prompt"
            val shown = m[1].replace(THIN, "")
            val target = number(shown) ?: return@check "number"
            fun partsOf(text: String): Sci? {
                val q = match("^(\\d+(?:,\\d+)?) · 10(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)$", text)
                val mantissa = if (q != null) number(q[1]) else null
                if (q == null || mantissa == null) return null
                val negative = q[2].startsWith("⁻")
                val e = exponentOf(q[2]) ?: return null
                return Sci(mantissa, if (negative) -e else e)
            }
            val right = partsOf(p.correct)
            if (right == null || !(right.mantissa >= 1) || !(right.mantissa < 10)) return@check "correct option ${p.correct}"
            if (!close(right.mantissa * Math.pow(10.0, right.exponent.toDouble()), target)) return@check "value of ${p.correct} is not $target"
            if (level == 3 && right.exponent >= 0) return@check "level 3 is small numbers"
            if (level < 3 && right.exponent < 0) return@check "levels 1 and 2 are big numbers"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, right.exponent.toDouble())) return@check "typed"
            for (option in options(p)) {
                val w = partsOf(option) ?: return@check "wrong option $option"
                val sameValue = close(w.mantissa * Math.pow(10.0, w.exponent.toDouble()), target)
                val normalised = w.mantissa >= 1 && w.mantissa < 10
                if (sameValue && normalised) return@check "wrong option $option is right"
            }
            null
        }
    }

    @Test fun u07_rootOfSum() {
        check("u07.rootOfSum") { level, p ->
            val text = expressionAfter("Berechne ", p.prompt)
            val expected = if (text != null && text.startsWith("√(")) evalText(text) else null
            if (text == null || expected == null) return@check "prompt"
            val right = number(p.correct)
            if (right == null || !close(right, expected) || expected != jsRound(expected)) return@check "correct option ${p.correct} expected $expected"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed"
            // The radicand is a perfect square: the answer squared is the radicand.
            val radicand = evalText(text.substring(1))
            if (radicand == null || !close(expected * expected, radicand)) return@check "radicand"
            if (level == 1 && text.contains("−")) return@check "level 1 adds"
            if (level == 3 && !text.contains("−")) return@check "level 3 subtracts"
            differ(p, expected) { number(it) }
        }
    }

    @Test fun u07_cubeRoot() {
        check("u07.cubeRoot") { level, p ->
            val text = expressionAfter("Berechne ³√", p.prompt)
            val radicand = if (text == null) null else evalText(text)
            if (text == null || radicand == null) return@check "prompt"
            val right = number(p.correct) ?: return@check "correct"
            // Cubed again: the answer is the number the radicand comes from.
            if (!close(right * right * right, radicand)) return@check "cubed $right is not $radicand"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, right)) return@check "typed"
            if (level < 3 && (radicand < 0 || text.contains("/") || text.contains(","))) return@check "plain cubes below level 3"
            if (p.pairFront != "³√$text") return@check "pair front ${p.pairFront ?: ""}"
            differ(p, right) { number(it) }
        }
    }
}
