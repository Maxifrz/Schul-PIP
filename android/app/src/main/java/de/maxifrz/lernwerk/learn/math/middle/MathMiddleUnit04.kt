package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/**
 * Unit 4, Terme und lineare Gleichungen: Terme berechnen, zusammenfassen und Klammern auflösen (lesson 1), Gleichungen
 * mit einer Unbekannten lösen (2), x auf beiden Seiten, Probe und Textaufgaben (3).
 */
object MathMiddleUnit04 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u04.evalTerm", 1, forms(CHOICE, TYPED, PAIRS), ::evalTerm),
            MathMiddleTemplate("u04.simplify", 1, forms(CHOICE, TYPED, PAIRS), ::simplify),
            MathMiddleTemplate("u04.expand", 1, forms(CHOICE, TYPED, PAIRS), ::expand),
            MathMiddleTemplate("u04.oneStep", 2, forms(CHOICE, TYPED, PAIRS), ::oneStep),
            MathMiddleTemplate("u04.twoStep", 2, forms(CHOICE, TYPED, PAIRS), ::twoStep),
            MathMiddleTemplate("u04.brackets", 2, forms(CHOICE, TYPED, PAIRS), ::brackets),
            MathMiddleTemplate("u04.bothSides", 3, forms(CHOICE, TYPED, PAIRS), ::bothSides),
            MathMiddleTemplate("u04.plugIn", 3, forms(CHOICE, TYPED), ::plugIn),
            MathMiddleTemplate("u04.word", 3, forms(CHOICE, TYPED), ::word),
        )
    }

    private const val valueHint = "Gib nur die Zahl an."

    private fun whole(values: List<Int>): List<Q> = values.map { Q(it) }

    // Lesson 1

    /** "Berechne den Wert von 3x + 5 für x = 4." Level 3 has a square, so the sign of a negative x matters. */
    private fun evalTerm(level: Int, gen: Gen): P? {
        val term: String
        val x: Int
        val value: Int
        val working: String
        val wrong: MutableList<Int>
        if (level <= 2) {
            val a = if (level == 1) gen.int(2..9) else gen.nonZero(-9..9)
            x = if (level == 1) gen.int(1..6) else gen.nonZero(-5..5)
            var b = if (level == 1) gen.int(1..9) else gen.nonZero(-9..9)
            if (level == 1 && gen.chance(40) && a * x > b) b = -b
            term = T.linear(a, b)
            value = a * x + b
            working = "${T.int(a)} · ${T.bracketed(x)} ${T.plusMinus(b)} = ${T.int(a * x)} ${T.plusMinus(b)} = ${T.int(value)}"
            // "ax" read as a + x, the sign of b turned, the bracket forgotten, the digits written side by side.
            wrong = mutableListOf(a + x + b, a * x - b, a * (x + b))
            if (a > 0 && x > 0) {
                val digits = "$a$x".toIntOrNull()
                if (digits != null) wrong.add(digits + b)
            }
            if (x < 0) wrong.add(a * Math.abs(x) + b)
        } else {
            val a = gen.pick(listOf(1, 2, 3))
            val b = gen.nonZero(-5..5)
            val c = gen.nonZero(-6..6)
            x = gen.pick(listOf(-4, -3, -2, -1, 2, 3, 4))
            term = T.polynomial(listOf(a, b, c))
            value = a * x * x + b * x + c
            working = "$a · ${T.bracketed(x)}² ${T.plusMinus(b)} · ${T.bracketed(x)} ${T.plusMinus(c)} = ${a * x * x} ${T.plusMinus(b * x)} ${T.plusMinus(c)} = ${T.int(value)}"
            // x² read as 2x, a·x squared as a whole, a negative square taken as negative, the factor x forgotten at b.
            wrong = mutableListOf(2 * a * x + b * x + c, (a * x) * (a * x) + b * x + c, -a * x * x + b * x + c, a * x * x + b + c)
        }
        val xText = T.int(x)
        return P.number(
            prompt = "Berechne den Wert von $term für x = $xText.",
            answer = Q(value),
            hint = valueHint,
            wrong = whole(wrong),
            pair = "$term für x = $xText",
            solution = working,
            explanation = "Setze die Zahl für x ein und rechne Schritt für Schritt: erst Potenzen, dann Punkt vor Strich. Eine negative Zahl kommt in Klammern.",
        )
    }

    /** One term of a sum written out: "3x", "x", "5", with its sign in front unless it is the first. */
    private fun render(terms: List<Pair<Int, Boolean>>): String {
        var text = ""
        terms.forEachIndexed { index, term ->
            val magnitude = Math.abs(term.first)
            val piece = if (term.second) (if (magnitude == 1) "x" else "${magnitude}x") else "$magnitude"
            text = if (index == 0) (if (term.first < 0) T.minus else "") + piece
            else text + (if (term.first < 0) " ${T.minus} " else " + ") + piece
        }
        return text
    }

    /** "Fasse zusammen: 3x + 5 − x + 2": like terms together, x with x and numbers with numbers. */
    private fun simplify(level: Int, gen: Gen): P? {
        val xs: List<Int>
        val ks: List<Int>
        when (level) {
            1 -> {
                xs = listOf(gen.int(1..6), gen.int(1..6))
                ks = if (gen.chance(50)) listOf(gen.int(1..9), gen.int(1..9)) else listOf(gen.int(1..9))
            }
            2 -> {
                xs = listOf(gen.int(3..9), -gen.int(1..6))
                ks = listOf(gen.int(1..9), -gen.int(1..9))
            }
            else -> {
                xs = listOf(gen.nonZero(-7..7), gen.nonZero(-7..7), gen.nonZero(-7..7))
                ks = listOf(gen.nonZero(-9..9), gen.nonZero(-9..9))
            }
        }
        val sumX = xs.sum()
        val sumK = ks.sum()
        if (sumX == 0 || sumK == 0 || Math.abs(sumX) > 14 || Math.abs(sumK) > 18) return null
        // Levels 2 and 3 subtract: at least one summand is negative.
        if (!(level == 1 || (xs + ks).any { it < 0 })) return null
        val terms = gen.shuffled(xs.map { Pair(it, true) } + ks.map { Pair(it, false) })
        val expression = render(terms)
        val correct = T.linear(sumX, sumK)
        // Unlike terms put together, x·x written as x², a term left out, a sign turned.
        val negativeX = xs.firstOrNull { it < 0 }
        val negativeK = ks.firstOrNull { it < 0 }
        val wrong = listOf(
            T.linear(sumX + sumK, 0),
            T.polynomial(listOf(sumX, 0, sumK)),
            if (negativeX != null) T.linear(sumX - 2 * negativeX, sumK) else T.linear(sumX - xs[0], sumK),
            if (negativeK != null) T.linear(sumX, sumK - 2 * negativeK) else T.linear(sumX, sumK - ks[ks.size - 1]),
        )
        val asksCoefficient = Math.abs(sumX) != 1 && gen.chance(50)
        val typed = Ty(
            "Fasse zusammen: $expression\n" + (if (asksCoefficient) "Welche Zahl steht danach vor dem x?" else "Welche Zahl steht danach ohne x?"),
            rat(if (asksCoefficient) sumX else sumK),
        )
        val problem = P.text(
            prompt = "Fasse zusammen:\n$expression",
            correct = correct,
            wrong = wrong,
            typed = typed,
            pair = expression,
            solution = "x-Terme: ${T.int(sumX)}x, Zahlen: ${T.int(sumK)}; zusammen $correct",
            explanation = "Nur gleichartige Summanden darfst du zusammenfassen: x mit x und Zahlen mit Zahlen. Das Vorzeichen gehört zum Summanden dahinter.",
        )
        problem.pairPrompt = "Fasse zusammen und ordne zu."
        return problem
    }

    /** "Löse die Klammer auf: 3(x − 4)": every summand inside is multiplied by the factor in front. */
    private fun expand(level: Int, gen: Gen): P? {
        val expression: String
        val coefficient: Int
        val constant: Int
        val wrong: List<String>
        val working: String
        when (level) {
            1 -> {
                val a = gen.int(2..9)
                val b = gen.int(1..9)
                expression = "$a(x + $b)"
                coefficient = a; constant = a * b
                wrong = listOf(T.linear(a, b), T.linear(1, a * b), T.linear(a, a + b))
                working = "$a · x + $a · $b = ${T.linear(coefficient, constant)}"
            }
            2 -> {
                val a = gen.int(2..9)
                val b = gen.int(1..9)
                expression = "$a(x ${T.minus} $b)"
                coefficient = a; constant = -a * b
                wrong = listOf(T.linear(a, -b), T.linear(1, a - b), T.linear(1, -a * b), T.linear(a, a * b))
                working = "$a · x ${T.minus} $a · $b = ${T.linear(coefficient, constant)}"
            }
            else -> {
                if (gen.chance(50)) {
                    // c − a(x + b): the minus in front turns both signs inside.
                    val a = gen.int(2..5)
                    val b = gen.int(1..6)
                    val c = gen.int(1..9)
                    // A number of 0 outside x would make "the number without x" a trick question.
                    if (c == a * b) return null
                    expression = "$c ${T.minus} $a(x + $b)"
                    coefficient = -a; constant = c - a * b
                    wrong = listOf(T.linear(-a, c - b), T.linear(-a, c + a * b), T.linear(c - a, (c - a) * b))
                    working = "$c ${T.minus} ${a}x ${T.minus} ${a * b} = ${T.linear(coefficient, constant)}"
                } else {
                    // a(bx − c): both summands inside are multiplied.
                    val a = gen.int(2..5)
                    val b = gen.int(2..5)
                    val c = gen.int(1..6)
                    expression = "$a(${b}x ${T.minus} $c)"
                    coefficient = a * b; constant = -a * c
                    wrong = listOf(T.linear(a * b, -c), T.linear(b, -a * c), T.linear(a + b, -c * a), T.linear(a * b, a * c))
                    working = "$a · ${b}x ${T.minus} $a · $c = ${T.linear(coefficient, constant)}"
                }
            }
        }
        val asksCoefficient = gen.chance(50)
        val problem = P.text(
            prompt = "Löse die Klammer auf:\n$expression",
            correct = T.linear(coefficient, constant),
            wrong = wrong,
            typed = Ty(
                "Löse die Klammer auf: $expression\n" + (if (asksCoefficient) "Welche Zahl steht danach vor dem x?" else "Welche Zahl steht danach ohne x?"),
                rat(if (asksCoefficient) coefficient else constant),
            ),
            pair = expression,
            solution = working,
            explanation = "Multipliziere jeden Summanden in der Klammer mit dem Faktor davor. Steht ein Minus vor der Klammer, drehen sich die Vorzeichen um.",
        )
        problem.pairPrompt = "Löse die Klammer auf und ordne zu."
        return problem
    }

    // Lesson 2

    /** "x + 7 = 15", "3x = 21", "x : 4 = 5": one step undoes the operation. */
    private fun oneStep(level: Int, gen: Gen): P? {
        val kind = if (level == 1) gen.int(0..1) else gen.int(0..3)
        val equation: String
        val x: Int
        val wrong: List<Int>
        val step: String
        val probe: String
        when (kind) {
            0 -> {
                val b = gen.int(if (level == 3) 4..15 else 2..12)
                x = if (level == 3) gen.int(-12..-1) else gen.int(1..15)
                val c = x + b
                equation = "x + $b = ${T.int(c)}"
                wrong = listOf(c + b, b - c, c * b, c)
                step = "x = ${T.int(c)} ${T.minus} $b = ${T.int(x)}"
                probe = "${T.bracketed(x)} + $b = ${T.int(c)}"
            }
            1 -> {
                val b = gen.int(if (level == 3) 4..15 else 2..12)
                x = if (level == 3) gen.int(-12..-1) else gen.int(2..20)
                val c = x - b
                equation = "x ${T.minus} $b = ${T.int(c)}"
                wrong = listOf(c - b, b - c, c * b, c)
                step = "x = ${T.int(c)} + $b = ${T.int(x)}"
                probe = "${T.bracketed(x)} ${T.minus} $b = ${T.int(c)}"
            }
            2 -> {
                val a = if (level == 3) -gen.int(2..9) else gen.int(2..9)
                x = if (level == 3) gen.nonZero(-9..9) else gen.int(2..12)
                val c = a * x
                equation = "${T.int(a)}x = ${T.int(c)}"
                wrong = listOf(c - a, c * a, c + a, a - c)
                step = "x = ${T.int(c)} : ${T.bracketed(a)} = ${T.int(x)}"
                probe = "${T.int(a)} · ${T.bracketed(x)} = ${T.int(c)}"
            }
            else -> {
                val a = gen.int(2..9)
                val c = if (level == 3) gen.nonZero(-9..9) else gen.int(2..9)
                x = c * a
                equation = "x : $a = ${T.int(c)}"
                wrong = if (c % a == 0) listOf(c - a, c + a, a - c, c / a) else listOf(c - a, c + a, a - c)
                step = "x = ${T.int(c)} · $a = ${T.int(x)}"
                probe = "${T.bracketed(x)} : $a = ${T.int(c)}"
            }
        }
        return P.number(
            prompt = "Löse die Gleichung. Welchen Wert hat x?\n$equation",
            answer = Q(x),
            hint = "Gib die Zahl an.",
            wrong = whole(wrong),
            pair = equation,
            solution = "$step. Probe: $probe stimmt.",
            explanation = "Mache die Rechnung auf beiden Seiten rückgängig: Plus mit Minus, Mal mit Geteilt.",
        )
    }

    /** "3x + 5 = 20": undo the addition first, then the multiplication. */
    private fun twoStep(level: Int, gen: Gen): P? {
        val a: Int
        val b: Int
        val x: Int
        when (level) {
            1 -> {
                a = gen.int(2..5)
                x = gen.int(1..9)
                b = gen.int(1..9)
            }
            2 -> {
                a = gen.int(2..9)
                x = gen.int(2..12)
                b = gen.nonZero(-12..12)
            }
            else -> {
                a = gen.nonZero(-9..9)
                x = gen.nonZero(-9..9)
                b = gen.nonZero(-12..12)
            }
        }
        if (Math.abs(a) < 2) return null
        val c = a * x + b
        val equation = "${T.linear(a, b)} = ${T.int(c)}"
        // Dividing forgotten, multiplied instead of divided, the sign of b turned, only c divided.
        val wrong = mutableListOf(c - b, (c - b) * a, c + b)
        if ((c + b) % a == 0) wrong.add((c + b) / a)
        if (c % a == 0) wrong.add(c / a - b)
        val step = "${T.int(a)}x = ${T.int(c)} ${if (b < 0) "+" else T.minus} ${Math.abs(b)} = ${T.int(c - b)}; x = ${T.int(c - b)} : ${T.bracketed(a)} = ${T.int(x)}"
        return P.number(
            prompt = "Löse die Gleichung. Welchen Wert hat x?\n$equation",
            answer = Q(x),
            hint = "Gib die Zahl an.",
            wrong = whole(wrong),
            pair = equation,
            solution = step + ". Probe: ${T.int(a)} · ${T.bracketed(x)} ${T.plusMinus(b)} = ${T.int(c)} stimmt.",
            explanation = "Mache die Rechenschritte in umgekehrter Reihenfolge rückgängig: erst die Zahl ohne x auf die andere Seite, dann durch die Zahl vor x teilen.",
        )
    }

    /** "2(x + 3) = 14": a bracket times a factor equals a number; level 3 has a number added outside. */
    private fun brackets(level: Int, gen: Gen): P? {
        val a = gen.int(2..5)
        val b = gen.int(1..6)
        val minus = level >= 2 && gen.chance(50)
        val x = if (level == 1) gen.int(1..8) else gen.int(-3..10)
        // What the bracket adds to x: +b for (x + b), -b for (x - b).
        val shift = if (minus) -b else b
        val d = if (level == 3) gen.nonZero(-9..9) else 0
        val e = a * (x + shift) + d
        val inside = if (minus) "x ${T.minus} $b" else "x + $b"
        val left = if (d == 0) "$a($inside)" else "$a($inside) ${T.plusMinus(d)}"
        val equation = "$left = ${T.int(e)}"
        // After the number outside the bracket is taken off, a times the bracket is left.
        val product = e - d
        val quotient = product / a
        // The shift forgotten, the shift added instead of taken off, the factor ignored, b not multiplied by the factor.
        val wrong = mutableListOf(quotient, quotient + shift, product - shift)
        if ((product - shift) % a == 0) wrong.add((product - shift) / a)
        val firstStep = if (d == 0) "" else "${T.int(e)} ${if (d < 0) "+" else T.minus} ${Math.abs(d)} = ${T.int(product)}; "
        return P.number(
            prompt = "Löse die Gleichung. Welchen Wert hat x?\n$equation",
            answer = Q(x),
            hint = "Gib die Zahl an.",
            wrong = whole(wrong),
            pair = equation,
            solution = "$firstStep${T.int(product)} : $a = ${T.int(quotient)}, also x ${if (minus) "${T.minus} $b" else "+ $b"} = ${T.int(quotient)} und x = ${T.int(x)}. Probe: ${probeBrackets(a, inside, d, x, e)}",
            explanation = "Rechne zuerst das Äußere rückgängig: die Zahl neben der Klammer, dann den Faktor vor der Klammer. Danach bleibt eine einfache Gleichung.",
        )
    }

    private fun probeBrackets(a: Int, inside: String, d: Int, x: Int, result: Int): String {
        val value = inside.replace("x", T.bracketed(x))
        val tail = if (d == 0) "" else " ${T.plusMinus(d)}"
        return "$a($value)$tail = ${T.int(result)} stimmt."
    }

    // Lesson 3

    /** "5x − 3 = 2x + 9": collect the x on one side first. */
    private fun bothSides(level: Int, gen: Gen): P? = gen.attempt { bothSidesAttempt(level, gen) }

    private fun bothSidesAttempt(level: Int, gen: Gen): P? {
        val a: Int
        val c: Int
        val x: Int
        when (level) {
            1 -> {
                c = gen.int(1..4)
                a = c + gen.int(1..5)
                x = gen.int(1..9)
            }
            2 -> {
                c = gen.nonZero(-5..6)
                a = gen.nonZero(-5..9)
                x = gen.nonZero(-8..9)
            }
            else -> {
                c = gen.nonZero(-4..6)
                a = gen.int(2..6)
                x = gen.nonZero(-8..9)
            }
        }
        if (a == c) return null
        // a x + p = c x + q, where level 3 writes the left side as a(x + e) with p = a e.
        val slope = a - c
        val equation: String
        val p: Int
        val q: Int
        if (level == 3) {
            val e = gen.nonZero(-9..9)
            p = a * e
            q = a * (x + e) - c * x
            equation = "$a(x ${T.plusMinus(e)}) = ${T.linear(c, q)}"
        } else {
            p = gen.nonZero(-9..9)
            q = slope * x + p
            equation = "${T.linear(a, p)} = ${T.linear(c, q)}"
        }
        val moved = q - p
        // Forgotten to divide, the sign of the number turned, the x-terms added instead of taken off.
        var wrong = mutableListOf(moved, q + p)
        if ((q + p) % slope == 0) wrong.add((q + p) / slope)
        if (a + c != 0 && moved % (a + c) == 0) wrong.add(moved / (a + c))
        wrong = wrong.filter { it != x }.toMutableList()
        if (wrong.toSet().size < 3) return null
        val opening = if (level == 3) "Klammer auflösen: ${T.linear(a, p)} = ${T.linear(c, q)}; " else ""
        return P.number(
            prompt = "Löse die Gleichung. Welchen Wert hat x?\n$equation",
            answer = Q(x),
            hint = "Gib die Zahl an.",
            wrong = whole(wrong),
            pair = equation,
            solution = "$opening${T.int(slope)}x = ${T.int(moved)}; x = ${T.int(moved)} : ${T.bracketed(slope)} = ${T.int(x)}",
            explanation = "Bringe alle x auf eine Seite und alle Zahlen auf die andere, jeweils mit der Gegenoperation. Dann teilst du durch die Zahl vor x.",
        )
    }

    /** "Welche Zahl ist die Lösung?" by trying the numbers; typed: the value both sides take when the solution is put in. */
    private fun plugIn(level: Int, gen: Gen): P? {
        val a: Int
        val c: Int
        val b: Int
        val x: Int
        when (level) {
            1 -> {
                c = gen.int(1..4)
                a = c + gen.int(1..4)
                x = gen.int(1..9)
                b = gen.int(1..9)
            }
            2 -> {
                c = gen.nonZero(-4..5)
                a = gen.nonZero(-4..8)
                x = gen.nonZero(-6..9)
                b = gen.nonZero(-9..9)
            }
            else -> {
                c = gen.nonZero(-4..5)
                a = gen.int(2..6)
                x = gen.nonZero(-6..9)
                b = gen.nonZero(-6..6)
            }
        }
        if (a == c) return null
        val left: String
        val right: String
        val value: Int
        if (level == 3) {
            // a(x + b) = c x + d
            val d = a * (x + b) - c * x
            left = "$a(x ${T.plusMinus(b)})"
            right = T.linear(c, d)
            value = a * (x + b)
        } else {
            val d = (a - c) * x + b
            left = T.linear(a, b)
            right = T.linear(c, d)
            value = a * x + b
        }
        val equation = "$left = $right"
        // Numbers next to the solution: the usual slips of one or two.
        val wrong = listOf(x + 1, x - 1, x + 2, x - 2)
        val both = T.int(value)
        return P.number(
            prompt = "Welche Zahl ist die Lösung der Gleichung? Setze zur Probe ein.\n$equation",
            answer = Q(x),
            hint = "",
            wrong = whole(wrong),
            typedPrompt = "Die Lösung der Gleichung $equation ist x = ${T.int(x)}.\nWelchen Wert haben beide Seiten, wenn du ${T.int(x)} einsetzt?",
            typedAnswer = Q(value),
            solution = "Probe mit x = ${T.int(x)}: links $both und rechts $both. Beide Seiten sind gleich, also stimmt die Lösung.",
            explanation = "Eine Zahl ist die Lösung, wenn beide Seiten der Gleichung nach dem Einsetzen denselben Wert haben.",
        )
    }

    /** Short stories that lead to one equation. */
    private fun word(level: Int, gen: Gen): P? = gen.attempt { wordAttempt(level, gen) }

    private fun wordAttempt(level: Int, gen: Gen): P? {
        when (level) {
            1 -> {
                val a = gen.int(2..9)
                val x = gen.int(2..12)
                val b = gen.int(1..12)
                val adds = gen.chance(50)
                val c = if (adds) a * x + b else a * x - b
                if (c <= 0) return null
                val factor = if (a == 2) "Ich verdopple sie" else "Ich multipliziere sie mit $a"
                val signed = if (adds) b else -b
                // Dividing forgotten, the sign of the number turned, the number ignored, the sign turned and then divided.
                val options = mutableListOf(c - signed, c + signed)
                if (c % a == 0) options.add(c / a)
                if ((c + signed) % a == 0) options.add((c + signed) / a)
                return P.number(
                    prompt = "Ich denke mir eine Zahl. $factor und ${if (adds) "addiere" else "subtrahiere"} $b. Das Ergebnis ist $c.\nWelche Zahl habe ich mir gedacht?",
                    answer = Q(x),
                    hint = "Gib die Zahl an.",
                    wrong = whole(options.filter { it != x }),
                    solution = "${T.linear(a, signed)} = $c; ${a}x = ${c - signed}; x = $x",
                    explanation = "Schreibe die Geschichte als Gleichung (die gedachte Zahl ist x) und löse sie wie gewohnt.",
                )
            }
            2 -> {
                val a = gen.int(2..5)
                val x = gen.int(3..15)
                val b = gen.int(3..12)
                val c = a * x + b
                val (story, unit) = gen.pick(
                    listOf(
                        Pair("Ein Taxi berechnet $b € Grundgebühr und $a € je Kilometer. Die Fahrt kostet $c €.\nWie viele Kilometer ist sie lang?", "km"),
                        Pair("Ein Fahrradverleih nimmt $b € Pauschale und $a € je Stunde. Tim zahlt $c €.\nWie viele Stunden hat er das Rad geliehen?", "Stunden"),
                        Pair("Ein Handwerker berechnet $b € für die Anfahrt und $a € je Arbeitsstunde. Die Rechnung beträgt $c €.\nWie viele Stunden hat er gearbeitet?", "Stunden"),
                    ),
                )
                val options = mutableListOf(c - b, c / a, x + b, (c - b) * a)
                if (c % a != 0) options.removeAt(1)
                return P.number(
                    prompt = story,
                    answer = Q(x),
                    style = S.Unit(unit),
                    hint = "Gib nur die Zahl an.",
                    wrong = whole(options.filter { it != x }),
                    solution = "${T.linear(a, b)} = $c mit x als Anzahl der $unit; ${a}x = ${c - b}; x = $x",
                    explanation = "Die Grundgebühr wird nur einmal bezahlt. Ziehe sie zuerst vom Gesamtpreis ab und teile dann durch den Preis je Einheit.",
                )
            }
            else -> {
                val r2 = gen.int(2..6)
                val difference = gen.int(2..5)
                val r1 = r2 + difference
                val x = gen.int(3..12)
                val p1 = gen.int(2..12) * 5
                val p2 = p1 + difference * x
                val names = gen.pick(listOf(Pair("Tom", "Lena"), Pair("Mia", "Jan"), Pair("Ali", "Eva")))
                val gap = p2 - p1
                val all = listOf(gap, gap / r1, gap / r2, gap / (r1 + r2), (p1 + p2) / difference)
                val options = all.withIndex().filter { (index, _) ->
                    when (index) {
                        1 -> gap % r1 == 0
                        2 -> gap % r2 == 0
                        3 -> gap % (r1 + r2) == 0
                        4 -> (p1 + p2) % difference == 0
                        else -> true
                    }
                }.map { it.value }.filter { it != x }
                if (options.toSet().size < 3) return null
                return P.number(
                    prompt = "${names.first} hat $p1 € und spart $r1 € pro Woche. ${names.second} hat $p2 € und spart $r2 € pro Woche.\nNach wie vielen Wochen haben beide gleich viel?",
                    answer = Q(x),
                    style = S.Unit("Wochen"),
                    hint = "Gib nur die Zahl an.",
                    wrong = whole(options),
                    solution = "$p1 + ${r1}x = $p2 + ${r2}x; ${difference}x = $gap; x = $x",
                    explanation = "Beide Beträge nach x Wochen setzt du gleich. Dann sammelst du die x auf einer Seite und löst die Gleichung.",
                )
            }
        }
    }
}
