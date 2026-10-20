package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/**
 * Unit 6, Lineare Funktionen: Gleichung lesen, Funktionswerte und Steigungsdreieck (lesson 1), Nullstelle, Steigung aus
 * zwei Punkten und Gerade durch zwei Punkte (2), Punktprobe, Parallele und Sachaufgaben (3).
 */
object MathMiddleUnit06 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u06.readEquation", 1, forms(CHOICE, TYPED, PAIRS), ::readEquation),
            MathMiddleTemplate("u06.functionValue", 1, forms(CHOICE, TYPED, PAIRS), ::functionValue),
            MathMiddleTemplate("u06.slopeTriangle", 1, forms(CHOICE, TYPED, PAIRS), ::slopeTriangle),
            MathMiddleTemplate("u06.zeroPoint", 2, forms(CHOICE, TYPED, PAIRS), ::zeroPoint),
            MathMiddleTemplate("u06.slopeTwoPoints", 2, forms(CHOICE, TYPED, PAIRS), ::slopeTwoPoints),
            MathMiddleTemplate("u06.yIntercept", 2, forms(CHOICE, TYPED, PAIRS), ::yIntercept),
            MathMiddleTemplate("u06.lineThroughTwo", 2, forms(CHOICE, TYPED, PAIRS), ::lineThroughTwo),
            MathMiddleTemplate("u06.pointTest", 3, forms(CHOICE, TYPED), ::pointTest),
            MathMiddleTemplate("u06.parallel", 3, forms(CHOICE, TYPED), ::parallel),
            MathMiddleTemplate("u06.application", 3, forms(CHOICE, TYPED), ::application),
        )
    }

    // Writing a line

    /** The x-term of a line: "2x", "x", "-x", "0,5x". */
    private fun xTerm(m: Q): String {
        if (m == Q(1)) return "x"
        if (m == Q(-1)) return T.minus + "x"
        return T.number(m) + "x"
    }

    /** "y = 2x - 3"; swapped puts the number first: "y = 5 - 2x". */
    private fun line(m: Q, b: Q, swapped: Boolean = false): String {
        if (swapped && !b.isZero) {
            return "y = " + T.number(b) + (if (m.isNegative) " ${T.minus} " else " + ") + xTerm(m.magnitude)
        }
        val tail = if (b.isZero) "" else if (b.isNegative) " ${T.minus} " + T.number(b.magnitude) else " + " + T.number(b)
        return "y = " + xTerm(m) + tail
    }

    /** "P(1|2)". */
    private fun point(name: String, x: Q, y: Q): String = "$name(${T.number(x)}|${T.number(y)})"

    /** A slope for the level: whole at 1, whole with either sign at 2, with halves at 3. */
    private fun slope(level: Int, gen: Gen): Q = when (level) {
        1 -> Q(gen.int(1..6))
        2 -> Q(gen.nonZero(-6..6))
        else -> if (gen.chance(50)) Q(gen.nonZero(-9..9), 2) else Q(gen.nonZero(-5..5))
    }

    private const val valueHint = "Gib die Zahl an."

    // Lesson 1

    /** "Welche Steigung hat y = 2x - 3?" and "Wie groß ist der y-Achsenabschnitt?" */
    private fun readEquation(level: Int, gen: Gen): P? {
        val m = slope(level, gen)
        val b = Q(gen.nonZero(-9..9))
        val swapped = level == 3 && gen.chance(50)
        val equation = line(m, b, swapped)
        val asksSlope = gen.chance(50)
        // The two numbers swapped, the run mixed up with the rise, the zero point taken for the intercept.
        val zero = (b / m).negated
        val wrong = if (asksSlope) listOf(b, m.reciprocal, m + b, m * b).decimals(2)
        else listOf(m, zero, b + m, m * b).decimals(2)
        val name = if (asksSlope) "Steigung" else "y-Achsenabschnitt"
        val answer = if (asksSlope) m else b
        val problem = P.number(
            prompt = if (asksSlope) "Welche Steigung hat die Gerade?\n$equation" else "Wie groß ist der y-Achsenabschnitt der Geraden?\n$equation",
            answer = answer,
            hint = valueHint,
            wrong = wrong,
            pair = "$name von $equation",
            solution = "$equation hat die Form y = mx + b: m = ${T.number(m)} ist die Steigung, b = ${T.number(b)} der y-Achsenabschnitt.",
            explanation = "In y = mx + b ist m die Zahl vor dem x (mit ihrem Vorzeichen) und b die Zahl ohne x. Die Reihenfolge der Summanden ändert daran nichts.",
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe die gesuchte Zahl zu."
        return problem
    }

    /** "f(x) = 2x - 3, berechne f(4)" and, at level 3, "für welches x ist f(x) = 7". */
    private fun functionValue(level: Int, gen: Gen): P? = gen.attempt { functionValueAttempt(level, gen) }

    private fun functionValueAttempt(level: Int, gen: Gen): P? {
        val m = if (level == 1) Q(gen.int(2..6)) else Q(gen.nonZero(-6..6))
        val b = Q(gen.nonZero(-9..9))
        val x = if (level == 1) gen.int(1..6) else gen.nonZero(-5..6)
        val y = m * x + b
        val function = "f(x) = " + line(m, b).substring(4)
        if (level == 3 && gen.chance(50)) {
            // The other way round: for which x does f take this value?
            val mInt = m.int
            val bInt = b.int
            val yInt = y.int
            if (mInt == null || bInt == null || yInt == null || Math.abs(mInt) < 2) return null
            // The sign of b turned, the dividing forgotten, the number taken for the answer, multiplied instead of divided.
            val wrong = mutableListOf(Q(yInt - bInt), Q(yInt), Q(mInt * yInt + bInt))
            if ((yInt + bInt) % mInt == 0) wrong.add(Q((yInt + bInt) / mInt))
            if (wrong.wholes.size < 3) return null
            return P.number(
                prompt = "Gegeben: $function\nFür welches x gilt f(x) = ${T.int(yInt)}?",
                answer = Q(x),
                hint = valueHint,
                wrong = wrong.wholes,
                pair = "$function, f(x) = ${T.int(yInt)}",
                solution = "${T.linear(mInt, bInt)} = ${T.int(yInt)}; ${T.int(mInt)}x = ${T.int(yInt - bInt)}; x = ${T.int(x)}",
                explanation = "Setze den Funktionswert für f(x) ein und löse die Gleichung nach x auf.",
            )
        }
        val mInt = m.int
        val bInt = b.int
        val yInt = y.int
        if (mInt == null || bInt == null || yInt == null) return null
        // The product read as a sum, the sign of b turned, the bracket forgotten, the x lost.
        val wrong = mutableListOf(mInt + x + bInt, mInt * x - bInt, mInt * (x + bInt))
        if (x < 0) wrong.add(mInt * Math.abs(x) + bInt)
        return P.number(
            prompt = "Gegeben: $function\nBerechne f(${T.int(x)}).",
            answer = Q(yInt),
            hint = valueHint,
            wrong = wrong.map { Q(it) },
            pair = "$function, f(${T.int(x)})",
            solution = "f(${T.int(x)}) = ${T.int(mInt)} · ${T.bracketed(x)} ${T.plusMinus(bInt)} = ${T.int(mInt * x)} ${T.plusMinus(bInt)} = ${T.int(yInt)}",
            explanation = "Setze die Zahl für x in den Funktionsterm ein und rechne: erst malnehmen, dann addieren.",
        )
    }

    /** "4 nach rechts, 6 nach oben: welche Steigung?" Rise over run, never run over rise. */
    private fun slopeTriangle(level: Int, gen: Gen): P? {
        val dx: Int
        val dy: Int
        when (level) {
            1 -> {
                dx = gen.int(1..4)
                dy = dx * gen.int(2..4)
            }
            2 -> {
                dx = gen.int(2..6)
                dy = if (gen.chance(50)) -dx * gen.int(2..3) else gen.int(1..9)
            }
            else -> {
                dx = gen.int(2..7)
                dy = if (gen.chance(70)) -gen.int(1..9) else gen.int(1..9)
            }
        }
        if (dy == 0 || Math.abs(dy) == dx) return null
        val m = Q(dy, dx)
        val rising = dy > 0
        val up = Math.abs(dy)
        val story = "Von einem Punkt der Geraden gehst du $dx Einheiten nach rechts und $up Einheiten nach ${if (rising) "oben" else "unten"}, und du bist wieder auf der Geraden.\nWelche Steigung hat sie?"
        // Run over rise, the two numbers added or subtracted, the rise alone.
        val wrong = listOf(Q(dx, up) * (if (rising) 1 else -1), Q(dx + up), Q(up - dx) * (if (rising) 1 else -1), Q(dy))
        return P.number(
            prompt = story,
            answer = m,
            style = S.Fraction,
            hint = "Gib die Steigung als ganze Zahl oder Bruch an, zum Beispiel 3/2.",
            wrong = wrong,
            pair = "$dx nach rechts, $up nach ${if (rising) "oben" else "unten"}",
            solution = "m = Höhe : Breite = ${T.int(dy)} : $dx = ${T.fraction(m)}. Die Gerade ${if (rising) "steigt" else "fällt"}.",
            explanation = "Steigung ist Höhenunterschied durch Breitenunterschied. Nach oben ist der Höhenunterschied positiv, nach unten negativ.",
        )
    }

    // Lesson 2

    /** "Berechne die Nullstelle von y = 2x - 6": set y = 0 and solve. */
    private fun zeroPoint(level: Int, gen: Gen): P? = gen.attempt { zeroPointAttempt(level, gen) }

    private fun zeroPointAttempt(level: Int, gen: Gen): P? {
        val m: Int
        val b: Int
        when (level) {
            1 -> {
                m = gen.int(2..6)
                b = -m * gen.int(1..6)
            }
            2 -> {
                m = gen.nonZero(-6..6)
                b = -m * gen.nonZero(-6..6)
            }
            else -> {
                m = gen.nonZero(-8..8)
                b = gen.nonZero(-12..12)
            }
        }
        if (Math.abs(m) < 2) return null
        val zero = Q(-b, m)
        if (!zero.ok || listOf(zero).decimals(2).size != 1 || zero.isZero) return null
        if (level == 3 && zero.isWhole) return null
        // The sign of b kept, m and b swapped, the intercept itself, the sum.
        val wrong = listOf(Q(b, m), Q(m, b), Q(b), Q(m + b)).decimals(2)
        val equation = T.line(m, b)
        return P.number(
            prompt = "Berechne die Nullstelle der Funktion.\n$equation",
            answer = zero,
            hint = "Gib x als Zahl an.",
            wrong = wrong,
            pair = equation,
            solution = "0 = ${T.linear(m, b)}; ${T.int(m)}x = ${T.int(-b)}; x = ${T.int(-b)} : ${T.bracketed(m)} = ${T.number(zero)}",
            explanation = "An der Nullstelle ist y = 0. Setze 0 für y ein und löse die Gleichung nach x auf.",
        )
    }

    /** "P(1|2) und Q(3|8): welche Steigung?" Rise over run again, now from two points. */
    private fun slopeTwoPoints(level: Int, gen: Gen): P? = gen.attempt { slopeTwoPointsAttempt(level, gen) }

    private fun slopeTwoPointsAttempt(level: Int, gen: Gen): P? {
        val x1: Int
        val x2: Int
        val y1: Int
        val y2: Int
        when (level) {
            1 -> {
                x1 = gen.int(0..4)
                x2 = x1 + gen.int(1..4)
                y1 = gen.int(0..6)
                y2 = y1 + (x2 - x1) * gen.int(1..4)
            }
            2 -> {
                x1 = gen.int(-4..3)
                x2 = x1 + gen.int(1..5)
                y1 = gen.int(-6..6)
                y2 = y1 + (x2 - x1) * gen.nonZero(-4..4)
            }
            else -> {
                x1 = gen.int(-5..3)
                x2 = x1 + gen.int(2..7)
                y1 = gen.int(-6..6)
                y2 = gen.int(-8..8)
            }
        }
        if (x1 == x2 || y1 == y2 || Math.abs(y2 - y1) == Math.abs(x2 - x1)) return null
        val dy = y2 - y1
        val dx = x2 - x1
        val m = Q(dy, dx)
        if (!(listOf(m).decimals(2).size == 1 || level == 3)) return null
        // x over y, the sums, the rise alone, the run alone.
        val wrong = listOf(Q(dx, dy), Q(y2 + y1, x2 + x1), Q(dy), Q(dx)).filter { it.ok }
        val p = point("P", Q(x1), Q(y1))
        val q = point("Q", Q(x2), Q(y2))
        return P.number(
            prompt = "Eine Gerade geht durch $p und $q.\nWie groß ist ihre Steigung?",
            answer = m,
            hint = "Gib die Steigung als ganze Zahl, Dezimalzahl oder Bruch an.",
            wrong = wrong,
            pair = "$p, $q",
            solution = "m = (y₂ − y₁) : (x₂ − x₁) = (${T.int(y2)} ${T.minus} ${T.bracketed(y1)}) : (${T.int(x2)} ${T.minus} ${T.bracketed(x1)}) = ${T.int(dy)} : ${T.int(dx)} = ${T.number(m)}",
            explanation = "Die Steigung ist der Höhenunterschied durch den Breitenunterschied: m = (y₂ − y₁) : (x₂ − x₁). Beide Differenzen in derselben Reihenfolge bilden.",
        )
    }

    /** "Steigung 2, durch P(3|5): welches b?" Put the point in y = mx + b and solve for b. */
    private fun yIntercept(level: Int, gen: Gen): P? {
        val m = slope(level, gen)
        val x = if (level == 3 && m.denominator == 2) 2 * gen.nonZero(-4..4) else gen.nonZero(-5..6)
        val b = Q(gen.nonZero(-9..9))
        val y = m * x + b
        if (!y.ok || !y.isWhole || Math.abs(y.numerator) > 20) return null
        val p = point("P", Q(x), y)
        val mx = m * x
        // The point's y taken for b, the product added, the factor x forgotten, x subtracted.
        val wrong = listOf(y, y + mx, y - m, y - Q(x)).decimals(2)
        return P.number(
            prompt = "Eine Gerade hat die Steigung ${T.number(m)} und geht durch $p.\nWie groß ist der y-Achsenabschnitt?",
            answer = b,
            hint = valueHint,
            wrong = wrong,
            pair = "m = ${T.number(m)}, $p",
            solution = "${T.int(y.numerator)} = ${T.number(m)} · ${T.bracketed(x)} + b; ${T.int(y.numerator)} = ${T.number(mx)} + b; b = ${T.number(b)}",
            explanation = "Setze die Steigung und die Koordinaten des Punktes in y = mx + b ein. Dann bleibt eine Gleichung, in der nur b fehlt.",
        )
    }

    /** "Gerade durch P(1|2) und Q(3|8): wie lautet die Gleichung?" The slope first, then b. */
    private fun lineThroughTwo(level: Int, gen: Gen): P? = gen.attempt { lineThroughTwoAttempt(level, gen) }

    private fun lineThroughTwoAttempt(level: Int, gen: Gen): P? {
        val m = slope(level, gen)
        val b = Q(gen.nonZero(-8..8))
        val x1 = if (level == 3 && m.denominator == 2) 2 * gen.int(-2..2) else gen.int(-2..3)
        val step = if (level == 3 && m.denominator == 2) 2 * gen.int(1..3) else gen.int(1..3)
        val x2 = x1 + step
        val y1 = m * x1 + b
        val y2 = m * x2 + b
        if (!y1.ok || !y2.ok || !y1.isWhole || !y2.isWhole || Math.abs(y1.numerator) > 20 || Math.abs(y2.numerator) > 20 || y1 == y2) return null
        val p = point("P", Q(x1), y1)
        val q = point("Q", Q(x2), y2)
        val correct = line(m, b)
        // b taken from P or Q, b from the wrong sign, the rise taken for the slope.
        val wrongLines = mutableListOf(line(m, y1), line(m, y2), line(m, y1 + m * x1))
        val dy = y2 - y1
        if (step != 1) wrongLines.add(line(dy, y1 - dy * x1))
        val problem = P.text(
            prompt = "Eine Gerade geht durch $p und $q.\nWie lautet ihre Gleichung?",
            correct = correct,
            wrong = wrongLines,
            typed = Ty(
                "Eine Gerade geht durch $p und $q.\nWie groß ist ihr y-Achsenabschnitt b?",
                b.value,
                T.number(b),
            ),
            pair = "$p, $q",
            solution = "m = (${T.number(y2)} ${T.minus} ${T.bracketed(y1.numerator)}) : ($x2 ${T.minus} ${T.bracketed(x1)}) = ${T.number(m)}; ${T.number(y1)} = ${T.number(m)} · ${T.bracketed(x1)} + b gibt b = ${T.number(b)}. Also $correct",
            explanation = "Erst die Steigung aus beiden Punkten bestimmen, dann einen Punkt in y = mx + b einsetzen und b ausrechnen.",
        )
        problem.pairPrompt = "Ordne jedem Punktepaar seine Gerade zu."
        return problem
    }

    // Lesson 3

    /** "Welcher Punkt liegt auf der Geraden?" Plug the coordinates in. */
    private fun pointTest(level: Int, gen: Gen): P? = gen.attempt { pointTestAttempt(level, gen) }

    private fun pointTestAttempt(level: Int, gen: Gen): P? {
        val m = slope(level, gen)
        val b = Q(gen.nonZero(-9..9))
        val x = if (level == 3 && m.denominator == 2) 2 * gen.nonZero(-3..3) else (if (level == 1) gen.int(1..6) else gen.nonZero(-5..6))
        val y = m * x + b
        if (!y.ok || !y.isWhole || Math.abs(y.numerator) > 25) return null
        val swapped = level == 3 && gen.chance(50)
        val equation = line(m, b, swapped)
        val xq = Q(x)
        // b with the wrong sign, the x forgotten, the coordinates swapped, the product forgotten.
        var candidates = listOf(Pair(xq, m * xq - b), Pair(xq, m + b), Pair(y, xq), Pair(xq, xq + b), Pair(xq, y + m))
        candidates = candidates.filter { it.first.isWhole && it.second.isWhole && it.second != m * it.first + b }
        val wrong = candidates.map { point("P", it.first, it.second) }
        val a = y
        return P.text(
            prompt = "Welcher Punkt liegt auf der Geraden?\n$equation",
            correct = point("P", xq, y),
            wrong = wrong,
            typed = Ty(
                "Der Punkt P(${T.int(x)}|a) liegt auf der Geraden.\n$equation\nWie groß ist a?",
                a.value,
                T.number(a),
            ),
            solution = "x = ${T.int(x)} einsetzen: y = ${T.number(m)} · ${T.bracketed(x)} ${if (b.isNegative) T.minus else "+"} ${T.number(b.magnitude)} = ${T.number(y)}",
            explanation = "Ein Punkt liegt auf der Geraden, wenn seine Koordinaten die Gleichung erfüllen. Setze x ein und vergleiche das Ergebnis mit dem y-Wert.",
        )
    }

    /** "Welche Gerade verläuft parallel zu y = 2x + 3?" Same slope, other b. */
    private fun parallel(level: Int, gen: Gen): P? = gen.attempt { parallelAttempt(level, gen) }

    private fun parallelAttempt(level: Int, gen: Gen): P? {
        val m = slope(level, gen)
        val b1 = Q(gen.nonZero(-9..9))
        val b2 = Q(gen.nonZero(-9..9))
        if (b1 == b2) return null
        val given = line(m, b1)
        val correct = line(m, b2)
        // The slope with the other sign, the slope off by one, the two numbers swapped.
        val wrongLines = listOf(m.negated, m + 1, m - 1).filter { !it.isZero }.map { line(it, b1) }.toMutableList()
        if (b1 != m) wrongLines.add(line(b1, m))
        // Through a point: the intercept of the parallel.
        val x = if (level == 3 && m.denominator == 2) 2 * gen.nonZero(-3..3) else gen.nonZero(-4..5)
        val y = m * x + b2
        if (!y.isWhole || Math.abs(y.numerator) > 25) return null
        val p = point("P", Q(x), y)
        return P.text(
            prompt = "Welche Gerade verläuft parallel zu\n$given?",
            correct = correct,
            wrong = wrongLines,
            typed = Ty(
                "Eine Gerade ist parallel zu $given und geht durch $p.\nWie groß ist ihr y-Achsenabschnitt?",
                b2.value,
                T.number(b2),
            ),
            solution = "Parallele Geraden haben dieselbe Steigung m = ${T.number(m)}; nur b ist anders. Also $correct",
            explanation = "Zwei Geraden sind parallel, wenn ihre Steigungen gleich sind. Der y-Achsenabschnitt darf anders sein. Mit einem Punkt findest du dann b.",
        )
    }

    /** Short stories with a fixed part and a part that grows or shrinks evenly. */
    private fun application(level: Int, gen: Gen): P? = gen.attempt { applicationAttempt(level, gen) }

    private fun applicationAttempt(level: Int, gen: Gen): P? {
        // 0 phone (grows), 1 candle (shrinks), 2 pool (grows).
        val story = if (level == 1) gen.pick(listOf(0, 2)) else gen.int(0..2)
        val m: Q
        val b: Q
        val x: Int
        val unit: String
        val function: String
        when (story) {
            0 -> {
                m = Q(gen.pick(listOf(5, 10, 15, 20, 25)), 100)
                b = Q(gen.int(3..9))
                x = gen.pick(listOf(20, 40, 60, 80, 100, 120, 150, 200))
                unit = "€"
                function = "Ein Handytarif kostet ${T.euroAmount(b)} Grundgebühr im Monat und ${T.euro(m)} je Gesprächsminute."
            }
            1 -> {
                m = Q(-gen.int(2..5))
                b = Q(gen.int(5..12) * 5)
                x = gen.int(2..9)
                unit = "cm"
                function = "Eine Kerze ist ${T.number(b)} cm hoch und brennt ${T.number(m.magnitude)} cm in jeder Stunde ab."
            }
            else -> {
                m = Q(gen.int(3..15))
                b = Q(gen.int(4..20) * 10)
                x = gen.int(2..12)
                unit = "l"
                function = "In einem Becken sind ${T.number(b)} l Wasser. Es kommen ${T.number(m)} l je Minute dazu."
            }
        }
        val y = b + m * x
        if (!y.ok || !(y.double > 0) || listOf(y).decimals(2).size != 1) return null
        val style: MathMiddleStyle = if (unit == "€") S.Euro else S.Unit(unit)
        if (level == 3) {
            // Backwards: after how long is the value reached?
            val verb: String
            val valueText: String
            when (story) {
                0 -> { verb = "Die Rechnung beträgt"; valueText = T.euroAmount(y) }
                1 -> { verb = "Die Kerze ist nur noch"; valueText = T.number(y) + " cm hoch" }
                else -> { verb = "Im Becken sind jetzt"; valueText = T.number(y) + " l" }
            }
            val question = if (story == 0) "Wie viele Minuten wurde telefoniert?" else if (story == 1) "Wie lange brennt sie schon?" else "Wie viele Minuten läuft das Wasser schon?"
            // The rate not divided, the fixed part added instead of taken off, the fixed part not taken off.
            val rate = m.magnitude
            val wrong = listOf((y - b).magnitude, (y + b) / rate, y / rate).decimals(2).positives
            if (wrong.size < 3) return null
            return P.number(
                prompt = "$function\n$verb $valueText. $question",
                answer = Q(x),
                style = S.Unit(if (story == 1) "Stunden" else "Minuten"),
                hint = "Gib nur die Zahl an.",
                wrong = wrong,
                solution = "${T.number(y)} = ${T.number(b)} ${if (m.isNegative) T.minus else "+"} ${T.number(rate)} · x; ${T.number(rate)} · x = ${T.number((y - b).magnitude)}; x = $x",
                explanation = "Der Wert besteht aus dem festen Anfangswert und dem Anteil, der mit x wächst oder schrumpft. Ziehe zuerst den Anfangswert ab, dann teilst du durch die Änderung je Einheit.",
            )
        }
        val rate = m.magnitude
        // The fixed part forgotten, rate and fixed part added, the wrong direction, the fixed part multiplied too.
        val wrong = listOf(rate * x, rate + b, b - m * x, b * x)
        val target = if (story == 1) "Wie hoch ist sie nach $x Stunden?" else if (story == 0) "Wie viel kostet es bei $x Minuten?" else "Wie viel Wasser ist nach $x Minuten im Becken?"
        return P.number(
            prompt = "$function\n$target",
            answer = y,
            style = style,
            hint = "Gib nur die Zahl an.",
            wrong = wrong.decimals(2).positives,
            solution = "y = ${T.number(b)} ${if (m.isNegative) T.minus else "+"} ${T.number(rate)} · $x = ${T.number(y)} $unit",
            explanation = "Rechne den veränderlichen Teil (Änderung je Einheit mal Anzahl) aus und addiere ihn zum festen Anfangswert, oder ziehe ihn ab, wenn der Wert sinkt.",
        )
    }
}
