package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/**
 * Unit 9, Quadratische Gleichungen und Funktionen: Scheitelpunktform, Verschiebung und Funktionswerte (lesson 1),
 * rein quadratische Gleichungen, Faktorform und Nullstellen (2), pq-Formel, Diskriminante und Normalform (3).
 *
 * Options of a choice never differ only by a sign ("S(3|2)" and "S(-3|2)"): the exercise factory reads letters and
 * digits only, so such options would count as one. Sign mistakes are asked in words ("3 nach links") or in a typed
 * answer, where the sign counts.
 */
object MathMiddleUnit09 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u09.vertexForm", 1, forms(TYPED, PAIRS), ::vertexForm),
            MathMiddleTemplate("u09.shift", 1, forms(CHOICE), ::shift),
            MathMiddleTemplate("u09.functionValue", 1, forms(CHOICE, TYPED, PAIRS), ::functionValue),
            MathMiddleTemplate("u09.extremum", 1, forms(CHOICE, TYPED, PAIRS), ::extremum),
            MathMiddleTemplate("u09.pureQuadratic", 2, forms(CHOICE, TYPED, PAIRS), ::pureQuadratic),
            MathMiddleTemplate("u09.factorForm", 2, forms(TYPED, PAIRS), ::factorForm),
            MathMiddleTemplate("u09.vertexZeros", 2, forms(CHOICE, TYPED, PAIRS), ::vertexZeros),
            MathMiddleTemplate("u09.pqSolve", 3, forms(CHOICE, TYPED, PAIRS), ::pqSolve),
            MathMiddleTemplate("u09.discriminant", 3, forms(CHOICE, TYPED), ::discriminant),
            MathMiddleTemplate("u09.divideFirst", 3, forms(CHOICE, TYPED), ::divideFirst),
            MathMiddleTemplate("u09.vertexFromNormal", 3, forms(CHOICE, TYPED, PAIRS), ::vertexFromNormal),
        )
    }

    private const val valueHint = "Gib die Zahl an."

    // Writing

    private fun num(q: Q): String = T.number(q)

    private fun coefficientText(a: Q): String {
        if (a == Q(1)) return ""
        if (a == Q(-1)) return T.minus
        return num(a)
    }

    /** "y = 2(x + 1)² - 5": the vertex form, with the bracket left out when d is 0. */
    private fun vertexText(a: Q, d: Int, e: Int): String {
        var text = "y = " + coefficientText(a)
        text += if (d == 0) "x²" else "(x ${if (d > 0) T.minus else "+"} ${Math.abs(d)})²"
        if (e != 0) text += (if (e > 0) " + " else " ${T.minus} ") + Math.abs(e).toString()
        return text
    }

    /** "x² - 5x + 6": the normal form with a, p and q possibly decimals. */
    private fun quadratic(a: Q, p: Q, q: Q): String {
        var text = coefficientText(a) + "x²"
        if (!p.isZero) text += (if (p.isNegative) " ${T.minus} " else " + ") + (if (p.magnitude == Q(1)) "" else num(p.magnitude)) + "x"
        if (!q.isZero) text += (if (q.isNegative) " ${T.minus} " else " + ") + num(q.magnitude)
        return text
    }

    private fun vertexPoint(x: Q, y: Q): String = "S(${num(x)}|${num(y)})"

    /** Two solutions, the larger first: "3 und -1". */
    private fun pair(x: Q, y: Q): String = if (x < y) "${num(y)} und ${num(x)}" else "${num(x)} und ${num(y)}"

    private fun isqrt(n: Int): Int? {
        if (n < 0) return null
        var root = Math.sqrt(n.toDouble()).toInt()
        while (root * root > n) root -= 1
        while ((root + 1) * (root + 1) <= n) root += 1
        return if (root * root == n) root else null
    }

    /** The exact square root of a fraction, null if it is not a fraction of squares. */
    private fun rationalRoot(q: Q): Q? {
        if (!q.ok || q.isNegative) return null
        val top = isqrt(q.numerator) ?: return null
        val bottom = isqrt(q.denominator) ?: return null
        return Q(top, bottom)
    }

    // Lesson 1

    /** "Lies den Scheitelpunkt ab: y = (x - 3)² + 2": the sign of d is the opposite of the sign in the bracket. */
    private fun vertexForm(level: Int, gen: Gen): P? {
        val a: Q
        var d = gen.nonZero(-6..6)
        var e = gen.nonZero(-8..8)
        when (level) {
            1 -> a = Q(1)
            2 -> {
                a = Q(1)
                if (gen.chance(30)) d = 0 else if (gen.chance(30)) e = 0
            }
            else -> a = gen.pick(listOf(Q(2), Q(3), Q(-1), Q(-2), Q(1, 2), Q(-1, 2), Q(3)))
        }
        if (d == 0 && e == 0) return null
        val equation = vertexText(a, d, e)
        val asksX = gen.chance(50)
        val typed = Ty(
            (if (asksX) "Welche x-Koordinate hat der Scheitelpunkt?" else "Welche y-Koordinate hat der Scheitelpunkt?") + "\n$equation",
            rat(if (asksX) d else e),
        )
        val problem = P.text(
            prompt = "Lies den Scheitelpunkt ab.\n$equation",
            correct = vertexPoint(Q(d), Q(e)),
            wrong = emptyList(),
            typed = typed,
            pair = equation,
            solution = "In y = a(x − d)² + e ist S(d|e) der Scheitelpunkt. Hier: ${vertexPoint(Q(d), Q(e))}${if (d == 0) "" else "; die Klammer (x ${if (d > 0) T.minus else "+"} ${Math.abs(d)}) gibt d = ${T.int(d)}"}",
            explanation = "In der Scheitelpunktform y = a(x − d)² + e liest du d mit umgekehrtem Vorzeichen aus der Klammer ab; e steht ohne Änderung hinten. Der Faktor a ändert den Scheitelpunkt nicht.",
        )
        problem.pairPrompt = "Lies den Scheitelpunkt ab und ordne zu."
        return problem
    }

    /** "Wo liegt der Scheitelpunkt?" The four ways left or right, above or below, in words. */
    private fun shift(level: Int, gen: Gen): P? {
        val d = gen.nonZero(if (level == 1) -5..5 else -8..8)
        val e = gen.nonZero(if (level == 1) -5..5 else -9..9)
        val a = if (level == 1) Q(1) else if (level == 2) gen.pick(listOf(Q(2), Q(3), Q(1, 2))) else gen.pick(listOf(Q(-1), Q(-2), Q(2), Q(-3), Q(1, 2)))
        fun words(right: Boolean, up: Boolean): String =
            "${Math.abs(d)} nach ${if (right) "rechts" else "links"} und ${Math.abs(e)} nach ${if (up) "oben" else "unten"}"
        val correct = words(d > 0, e > 0)
        val wrong = listOf(words(d < 0, e > 0), words(d > 0, e < 0), words(d < 0, e < 0))
        return P.text(
            prompt = "Wo liegt der Scheitelpunkt der Parabel, vom Ursprung aus gesehen?\n${vertexText(a, d, e)}",
            correct = correct,
            wrong = wrong,
            solution = "d = ${T.int(d)} und e = ${T.int(e)}, also S(${T.int(d)}|${T.int(e)}): $correct",
            explanation = "Die Klammer (x + 3) heißt: Verschiebung um 3 nach links, (x − 3) um 3 nach rechts. Die Zahl hinten verschiebt nach oben (plus) oder unten (minus).",
        )
    }

    /** "f(x) = x² - 4x + 3, berechne f(-2)": the square of a negative number is positive. */
    private fun functionValue(level: Int, gen: Gen): P? {
        val a: Int
        val b: Int
        val c: Int
        val x: Int
        when (level) {
            1 -> {
                a = gen.pick(listOf(1, 1, 2, 3))
                b = 0
                c = gen.int(-9..9)
                x = gen.int(1..5)
            }
            2 -> {
                a = 1
                b = gen.nonZero(-6..6)
                c = gen.nonZero(-9..9)
                x = gen.nonZero(-4..4)
            }
            else -> {
                a = gen.pick(listOf(2, 3, -1, -2, 1))
                b = gen.nonZero(-6..6)
                c = gen.nonZero(-9..9)
                x = gen.nonZero(-4..4)
            }
        }
        val value = a * x * x + b * x + c
        val term = T.polynomial(listOf(a, b, c))
        if (Math.abs(value) > 120) return null
        // x² read as 2x or as x, a·x squared as a whole, a negative square taken as negative, the factor x forgotten at b.
        val wrong = listOf(2 * a * x + b * x + c, a * x + b * x + c, (a * x) * (a * x) + b * x + c, -a * x * x + b * x + c, a * x * x + b + c, a * x * x - b * x + c)
        var expression = "$a · ${T.bracketed(x)}²"
        var evaluated = T.int(a * x * x)
        if (b != 0) {
            expression += " ${T.plusMinus(b)} · ${T.bracketed(x)}"
            evaluated += " ${T.plusMinus(b * x)}"
        }
        if (c != 0) {
            expression += " ${T.plusMinus(c)}"
            evaluated += " ${T.plusMinus(c)}"
        }
        return P.number(
            prompt = "Gegeben: f(x) = $term\nBerechne f(${T.int(x)}).",
            answer = Q(value),
            hint = valueHint,
            wrong = wrong.map { Q(it) },
            pair = "f(x) = $term, f(${T.int(x)})",
            solution = "f(${T.int(x)}) = $expression = $evaluated = ${T.int(value)}",
            explanation = "Setze x ein und rechne erst die Potenz, dann Punkt vor Strich. Das Quadrat einer negativen Zahl ist positiv: (−2)² = 4.",
        )
    }

    /** "Welchen kleinsten Wert hat y = (x - 3)² + 2?" The vertex is the lowest (a > 0) or the highest (a < 0) point. */
    private fun extremum(level: Int, gen: Gen): P? {
        val a: Q = if (level == 1) Q(1) else gen.pick(listOf(Q(1), Q(2), Q(-1), Q(-2), Q(3), Q(-3)))
        val d = gen.nonZero(-6..6)
        val e = gen.nonZero(-9..9)
        val asksValue = gen.chance(50)
        val lowest = !a.isNegative
        val equation = vertexText(a, d, e)
        val answer = if (asksValue) e else d
        val wrong = if (asksValue) listOf(d, e + d, e - d, d * e) else listOf(e, d + e, d - e, d * e)
        val prompt = if (asksValue) "Welchen ${if (lowest) "kleinsten" else "größten"} Funktionswert hat die Parabel?\n$equation"
        else "Für welches x ist der Funktionswert ${if (lowest) "am kleinsten" else "am größten"}?\n$equation"
        val problem = P.number(
            prompt = prompt,
            answer = Q(answer),
            hint = valueHint,
            wrong = wrong.map { Q(it) },
            pair = (if (asksValue) (if (lowest) "kleinster Wert: " else "größter Wert: ") else "Stelle des ${if (lowest) "Minimums" else "Maximums"}: ") + equation,
            solution = "Der Scheitelpunkt ist S(${T.int(d)}|${T.int(e)}). Die Parabel ist nach ${if (lowest) "oben" else "unten"} geöffnet, also ist S der ${if (lowest) "tiefste" else "höchste"} Punkt: " + (if (asksValue) "y = ${T.int(e)}" else "x = ${T.int(d)}"),
            explanation = "Bei a > 0 ist die Parabel nach oben geöffnet, ihr Scheitelpunkt ist der tiefste Punkt. Bei a < 0 ist sie nach unten geöffnet, und der Scheitelpunkt ist der höchste Punkt.",
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe die gesuchte Zahl zu."
        return problem
    }

    // Lesson 2

    /** "x² = 49": two solutions, the root and its opposite. */
    private fun pureQuadratic(level: Int, gen: Gen): P? {
        val r = if (level == 3) gen.int(2..10) else gen.int(2..12)
        val equation: String
        val working: String
        when (level) {
            1 -> {
                equation = "x² = ${r * r}"
                working = "x² = ${r * r}, also x = $r oder x = ${T.minus}$r"
            }
            2 -> {
                if (gen.chance(50)) {
                    equation = "x² ${T.minus} ${r * r} = 0"
                    working = "x² = ${r * r}, also x = $r oder x = ${T.minus}$r"
                } else {
                    val k = gen.int(1..20)
                    equation = "x² + $k = ${r * r + k}"
                    working = "x² = ${r * r + k} ${T.minus} $k = ${r * r}, also x = $r oder x = ${T.minus}$r"
                }
            }
            else -> {
                val a = gen.int(2..5)
                if (gen.chance(50)) {
                    equation = "${a}x² = ${a * r * r}"
                    working = "x² = ${a * r * r} : $a = ${r * r}, also x = $r oder x = ${T.minus}$r"
                } else {
                    val b = gen.int(1..12)
                    if (a * r * r - b <= 0) return null
                    equation = "${a}x² ${T.minus} $b = ${a * r * r - b}"
                    working = "${a}x² = ${a * r * r}; x² = ${r * r}, also x = $r oder x = ${T.minus}$r"
                }
            }
        }
        // Only one solution, the root forgotten, the square halved instead of rooted.
        val wrong = listOf("$r", "${r * r} und ${T.minus}${r * r}", pair(Q(r, 2), Q(-r, 2)))
        val problem = P.text(
            prompt = "Löse die Gleichung.\n$equation",
            correct = "$r und ${T.minus}$r",
            wrong = wrong,
            typed = Ty("Löse die Gleichung $equation.\nGib die positive Lösung an.", rat(r)),
            pair = equation,
            solution = working,
            explanation = "Forme erst nach x² um, dann ziehst du die Wurzel. Es gibt zwei Lösungen: die positive und die negative Wurzel, denn (−7)² ist auch 49.",
        )
        problem.pairPrompt = "Löse und ordne die Lösungen zu."
        return problem
    }

    /** "(x - 2)(x + 5) = 0": a product is zero if one factor is zero. */
    private fun factorForm(level: Int, gen: Gen): P? = gen.attempt { factorFormAttempt(level, gen) }

    private fun factorFormAttempt(level: Int, gen: Gen): P? {
        val first: String
        val second: String
        val r1: Q
        val r2: Q
        when (level) {
            1 -> {
                val m = gen.int(1..9)
                val n = gen.int(1..9)
                first = "(x ${T.minus} $m)"
                second = "(x + $n)"
                r1 = Q(m); r2 = Q(-n)
            }
            2 -> {
                when (gen.int(0..2)) {
                    0 -> {
                        val k = gen.int(2..9)
                        val subtracts = gen.chance(50)
                        first = "x"
                        second = "(x ${if (subtracts) T.minus else "+"} $k)"
                        r1 = Q(0)
                        r2 = Q(if (subtracts) k else -k)
                    }
                    1 -> {
                        val m = gen.int(1..9)
                        val n = gen.int(1..9)
                        first = "(x + $m)"
                        second = "(x + $n)"
                        r1 = Q(-m); r2 = Q(-n)
                    }
                    else -> {
                        val m = gen.int(1..9)
                        val n = gen.int(1..9)
                        first = "(x ${T.minus} $m)"
                        second = "(x ${T.minus} $n)"
                        r1 = Q(m); r2 = Q(n)
                    }
                }
            }
            else -> {
                // (ax - b)(cx + d): the roots b/a and -d/c.
                val a = gen.int(2..4)
                val b = a * gen.int(1..4)
                val c = gen.pick(listOf(1, 2, 3))
                val d = c * gen.int(1..4) + (if (gen.chance(40)) 1 else 0)
                first = "(${a}x ${T.minus} $b)"
                second = "(${if (c == 1) "" else c.toString()}x + $d)"
                r1 = Q(b, a); r2 = Q(-d, c)
            }
        }
        if (r1 == r2 || listOf(r1, r2).decimals(2).size != 2) return null
        val equation = "$first$second = 0"
        val correct = pair(r1, r2)
        val larger = if (r1 < r2) r2 else r1
        val smaller = if (r1 < r2) r1 else r2
        val asksLarger = gen.chance(50)
        val problem = P.text(
            prompt = "Löse die Gleichung.\n$equation",
            correct = correct,
            wrong = emptyList(),
            typed = Ty(
                "Löse die Gleichung $equation.\nGib die ${if (asksLarger) "größere" else "kleinere"} Lösung an.",
                (if (asksLarger) larger else smaller).value,
                num(if (asksLarger) larger else smaller),
            ),
            pair = equation,
            solution = "Ein Faktor muss 0 sein: ${first.replace("(", "").replace(")", "")} = 0 oder ${second.replace("(", "").replace(")", "")} = 0, also x = ${num(r1)} oder x = ${num(r2)}",
            explanation = "Ein Produkt ist 0, wenn mindestens ein Faktor 0 ist. Setze jeden Faktor einzeln gleich 0. Die Lösung hat das umgekehrte Vorzeichen der Zahl in der Klammer.",
        )
        problem.pairPrompt = "Löse und ordne die Lösungen zu."
        return problem
    }

    /** "Nullstellen von y = (x - 1)² - 4": solve (x - 1)² = 4. */
    private fun vertexZeros(level: Int, gen: Gen): P? = gen.attempt { vertexZerosAttempt(level, gen) }

    private fun vertexZerosAttempt(level: Int, gen: Gen): P? {
        val r = if (level == 1) gen.int(1..4) else gen.int(2..6)
        val d = gen.nonZero(-6..6)
        val a: Q = if (level == 3) gen.pick(listOf(Q(2), Q(3), Q(-1), Q(-2))) else Q(1)
        // y = a(x - d)² + e with e = -a·r²: the zeros are d ± r.
        val e = (a * -(r * r)).int ?: return null
        val upper = Q(d + r)
        val lower = Q(d - r)
        if (upper == lower || Math.abs(e) > 50) return null
        val equation = vertexText(a, d, e)
        // The sign of d turned, the shift forgotten, the number under the root left unrooted.
        var wrongSets = listOf(Pair(Q(-d + r), Q(-d - r)), Pair(Q(r), Q(-r)), Pair(Q(d + r * r), Q(d - r * r)))
        wrongSets = wrongSets.filter { setOf(it.first, it.second) != setOf(upper, lower) }
        val wrong = wrongSets.map { pair(it.first, it.second) }
        val asksLarger = gen.chance(50)
        val problem = P.text(
            prompt = "Berechne die Nullstellen.\n$equation",
            correct = pair(upper, lower),
            wrong = wrong,
            typed = Ty(
                "Berechne die Nullstellen von $equation.\nGib die ${if (asksLarger) "größere" else "kleinere"} Nullstelle an.",
                (if (asksLarger) upper else lower).value,
                num(if (asksLarger) upper else lower),
            ),
            pair = equation,
            solution = "0 = ${equation.substring(4)}; (x ${if (d > 0) T.minus else "+"} ${Math.abs(d)})² = ${r * r}; x ${if (d > 0) T.minus else "+"} ${Math.abs(d)} = $r oder ${T.minus}$r; x = ${num(upper)} oder x = ${num(lower)}",
            explanation = "Setze y = 0 und bringe die Zahl hinten auf die andere Seite. Teile durch a, ziehe die Wurzel (zwei Vorzeichen!) und verschiebe um d.",
        )
        problem.pairPrompt = "Berechne und ordne die Nullstellen zu."
        return problem
    }

    // Lesson 3

    /** "x² - 5x + 6 = 0" by the pq-formula. */
    private fun pqSolve(level: Int, gen: Gen): P? = gen.attempt { pqSolveAttempt(level, gen) }

    private fun pqSolveAttempt(level: Int, gen: Gen): P? {
        val r1: Q
        val r2: Q
        when (level) {
            1 -> {
                r1 = Q(gen.int(1..8))
                r2 = Q(gen.int(1..8))
            }
            2 -> {
                r1 = Q(gen.nonZero(-8..8))
                r2 = Q(gen.nonZero(-8..8))
            }
            else -> {
                r1 = Q(gen.nonZero(-9..9), 2)
                r2 = if (gen.chance(50)) Q(gen.nonZero(-9..9), 2) else Q(gen.nonZero(-6..6))
            }
        }
        if (r1 == r2) return null
        val p = (r1 + r2).negated
        val q = r1 * r2
        if (!p.ok || !q.ok || listOf(p, q).decimals(2).size != 2 || p.isZero) return null
        val half = p / 2
        val discriminant = half * half - q
        val root = rationalRoot(discriminant)
        if (root == null || root.isZero) return null
        val correct = pair(r1, r2)
        // p not halved, the sign of q turned, the root forgotten.
        val wrongSets = mutableListOf<Pair<Q, Q>>()
        val bigRoot = rationalRoot(p * p - q)
        if (bigRoot != null) wrongSets.add(Pair(p.negated + bigRoot, p.negated - bigRoot))
        val plusRoot = rationalRoot(half * half + q)
        if (plusRoot != null) wrongSets.add(Pair(half.negated + plusRoot, half.negated - plusRoot))
        wrongSets.add(Pair(half.negated + discriminant, half.negated - discriminant))
        // The sign of p/2 not turned, p not halved but the right root.
        wrongSets.add(Pair(half + root, half - root))
        wrongSets.add(Pair(p.negated + root, p.negated - root))
        val wrong = wrongSets.filter { setOf(it.first, it.second) != setOf(r1, r2) }.map { pair(it.first, it.second) }
        if (wrong.toSet().size < 2) return null
        val equation = quadratic(Q(1), p, q) + " = 0"
        val larger = if (r1 < r2) r2 else r1
        val smaller = if (r1 < r2) r1 else r2
        val asksLarger = gen.chance(50)
        val problem = P.text(
            prompt = "Löse mit der pq-Formel.\n$equation",
            correct = correct,
            wrong = wrong,
            typed = Ty(
                "Löse $equation mit der pq-Formel.\nGib die ${if (asksLarger) "größere" else "kleinere"} Lösung an.",
                (if (asksLarger) larger else smaller).value,
                num(if (asksLarger) larger else smaller),
            ),
            pair = equation,
            solution = "p = ${num(p)}, q = ${num(q)}; x = ${num(half.negated)} ± √(${num(half * half)} ${if (q.isNegative) "+" else T.minus} ${num(q.magnitude)}) = ${num(half.negated)} ± √${num(discriminant)} = ${num(half.negated)} ± ${num(root)}; x = ${correct.replace(" und ", " oder x = ")}",
            explanation = "Bei x² + px + q = 0 gilt x = −p/2 ± √((p/2)² − q). Rechne erst p/2, dann den Wert unter der Wurzel, dann die Wurzel; das ± gibt die zwei Lösungen.",
        )
        problem.pairPrompt = "Löse und ordne die Lösungen zu."
        return problem
    }

    /** "Wie viele Lösungen hat x² + 4x + 7 = 0?" The sign of D = (p/2)² - q decides. */
    private fun discriminant(level: Int, gen: Gen): P? = gen.attempt { discriminantAttempt(level, gen) }

    private fun discriminantAttempt(level: Int, gen: Gen): P? {
        val p: Q = when (level) {
            1 -> Q(2 * gen.nonZero(-4..4))
            2 -> Q(gen.nonZero(-9..9))
            else -> Q(gen.nonZero(-19..19), 2)
        }
        val half = p / 2
        val square = half * half
        val kind = gen.int(0..2)
        val offset = Q(gen.int(1..6), if (level == 3) 4 else 1)
        val q: Q = when (kind) {
            0 -> square + offset
            1 -> square
            else -> square - offset
        }
        if (!q.ok || q.isZero || listOf(p, q).decimals(2).size != 2) return null
        val d = square - q
        if (!d.ok) return null
        val equation = quadratic(Q(1), p, q) + " = 0"
        val options = listOf("keine Lösung", "genau eine Lösung", "zwei Lösungen")
        val right = if (d.isNegative) 0 else if (d.isZero) 1 else 2
        val reason = if (right == 0) "D < 0: keine Lösung" else if (right == 1) "D = 0: genau eine Lösung" else "D > 0: zwei Lösungen"
        val halfShown = if (half.isNegative) "(${num(half)})" else num(half)
        val qShown = if (q.isNegative) "(${num(q)})" else num(q)
        return P.text(
            prompt = "Wie viele Lösungen hat die Gleichung?\n$equation",
            correct = options[right],
            wrong = options.filterIndexed { index, _ -> index != right },
            typed = Ty("Berechne die Diskriminante D = (p/2)² − q.\n$equation", d.value, num(d)),
            solution = "D = ${halfShown}² ${T.minus} $qShown = ${num(square)} ${T.minus} $qShown = ${num(d)}; $reason",
            explanation = "Die Diskriminante D = (p/2)² − q steht unter der Wurzel der pq-Formel. Ist D positiv, gibt es zwei Lösungen, bei D = 0 genau eine, bei negativem D keine.",
        )
    }

    /** "2x² - 8x + 6 = 0": the pq-formula needs x² alone, so all terms are divided by the factor in front. */
    private fun divideFirst(level: Int, gen: Gen): P? = gen.attempt { divideFirstAttempt(level, gen) }

    private fun divideFirstAttempt(level: Int, gen: Gen): P? {
        val a = if (level == 1) 2 else gen.int(2..5)
        val r1 = if (level == 3) gen.nonZero(-9..9) else gen.int(1..8)
        val r2 = if (level == 3) gen.nonZero(-9..9) else gen.int(1..8)
        if (r1 == r2) return null
        val p = -(r1 + r2)
        val q = r1 * r2
        if (p == 0) return null
        val given = quadratic(Q(a), Q(a * p), Q(a * q)) + " = 0"
        val correct = quadratic(Q(1), Q(p), Q(q)) + " = 0"
        // Only x² divided, x² and x divided, x² and the number divided.
        val wrong = listOf(
            quadratic(Q(1), Q(a * p), Q(a * q)) + " = 0",
            quadratic(Q(1), Q(p), Q(a * q)) + " = 0",
            quadratic(Q(1), Q(a * p), Q(q)) + " = 0",
        )
        val larger = maxOf(r1, r2)
        val asksSolution = level == 3 && gen.chance(50)
        val askP = gen.chance(50)
        val typed: Ty = if (asksSolution) Ty("Löse $given.\nGib die größere Lösung an.", rat(larger))
        else Ty("Teile $given durch $a.\nWelche Zahl steht dann ${if (askP) "vor dem x" else "ohne x"}?", rat(if (askP) p else q))
        return P.text(
            prompt = "Welche Gleichung entsteht, wenn du durch den Faktor vor x² teilst?\n$given",
            correct = correct,
            wrong = wrong,
            typed = typed,
            solution = "Alle Summanden durch $a teilen: $correct" + (if (asksSolution) "; die Lösungen sind $r1 und $r2" else ""),
            explanation = "Die pq-Formel gilt nur für x² + px + q = 0. Steht vor x² eine andere Zahl, teile die ganze Gleichung durch sie, auch den Teil ohne x.",
        )
    }

    /** "y = x² - 6x + 11": the vertex from the normal form, d = -p/2 and e = q - (p/2)². */
    private fun vertexFromNormal(level: Int, gen: Gen): P? = gen.attempt { vertexFromNormalAttempt(level, gen) }

    private fun vertexFromNormalAttempt(level: Int, gen: Gen): P? {
        val p: Q
        val q: Q
        when (level) {
            1 -> {
                p = Q(2 * gen.nonZero(-5..5))
                q = Q(gen.int(1..15))
            }
            2 -> {
                p = Q(2 * gen.nonZero(-6..6))
                q = Q(gen.nonZero(-12..15))
            }
            else -> {
                p = Q(gen.nonZero(-11..11))
                q = Q(gen.nonZero(-12..15))
            }
        }
        val half = p / 2
        val d = half.negated
        val e = q - half * half
        if (listOf(d, e).decimals(2).size != 2 || e == q) return null
        val equation = "y = " + quadratic(Q(1), p, q)
        // The number q left as it is, the square added instead of taken off, p/2 not squared, p not halved.
        val candidates = listOf(vertexPoint(d, q), vertexPoint(d, q + half * half), vertexPoint(d, q - half), vertexPoint(p.negated, e))
        val correct = vertexPoint(d, e)
        val asksX = gen.chance(50)
        val problem = P.text(
            prompt = "Bestimme den Scheitelpunkt.\n$equation",
            correct = correct,
            wrong = candidates.filter { it != correct },
            typed = Ty(
                "Bestimme den Scheitelpunkt von $equation.\n" + (if (asksX) "Welche x-Koordinate hat er?" else "Welche y-Koordinate hat er?"),
                (if (asksX) d else e).value,
                num(if (asksX) d else e),
            ),
            pair = equation,
            solution = "d = ${T.minus}p/2 = ${T.minus}(${num(half)}) = ${num(d)}; e = q ${T.minus} (p/2)² = ${num(q)} ${T.minus} ${num(half * half)} = ${num(e)}; $correct",
            explanation = "Aus y = x² + px + q folgt die quadratische Ergänzung: x-Koordinate −p/2, y-Koordinate q − (p/2)². Das ist dasselbe wie die Scheitelpunktform.",
        )
        problem.pairPrompt = "Bestimme den Scheitelpunkt und ordne zu."
        return problem
    }
}
