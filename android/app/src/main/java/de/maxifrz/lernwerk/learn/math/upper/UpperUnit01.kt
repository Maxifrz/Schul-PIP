package de.maxifrz.lernwerk.learn.math.upper

import de.maxifrz.lernwerk.learn.LearnExercise

/** Unit 1: derivative (power, sum and factor rule, f'(a), slope of the tangent, tangent line as a number). */
object MathUpperUnit01 {
    val templates: List<UTemplate> by lazy { listOf(power, value, linear, slope, whereSlope, tangentT, tangentY, horizontal, negativeExponent) }

    val power: UTemplate by lazy {
        UTemplate("d1.power", pairs = { _, g ->
            val items = mutableListOf<UPairItem>()
            val fronts = hashSetOf<String>()
            val backs = hashSetOf<String>()
            var i = 0
            while (i < 60 && items.size < 4) {
                i += 1
                val n = g.int(2..5)
                val a = g.int(1..6)
                val f = UPoly.terms(listOf(n to UQ(a)))
                val front = UCalc.fx(f)
                val back = "f′(x) = " + f.derivative.text
                if (fronts.add(LearnExercise.folded(front)) && backs.add(LearnExercise.folded(back))) items.add(UPairItem(front, back))
            }
            if (items.size == 4) items else null
        }) { lv, g ->
            val f: UPoly = when (lv) {
                1 -> UPoly.terms(listOf(g.int(2..5) to UQ(g.int(2..6))))
                2 -> g.poly(degree = g.int(2..4), terms = 2, coefficients = 1..6)
                else -> g.poly(degree = g.int(3..4), terms = g.int(3..4), coefficients = 1..6)
            }
            val d = f.derivative
            val wrong = mutableListOf(
                UCalc.mistaken(f, UMistake.NO_MULTIPLY), UCalc.mistaken(f, UMistake.NO_LOWER),
                UCalc.mistaken(f, UMistake.KEEP_CONSTANT), UCalc.mistaken(f, UMistake.INTEGRATE),
            )
            if (f.c.count { !it.isZero } == 1 && f.c.isNotEmpty()) {
                val top = f.c.size - 1
                wrong.add(UPoly.terms(listOf((top - 1) to UQ(top))))
            }
            UProblem.choice(
                key = "d1.power|${f.text}", prompt = "Bilde die Ableitung von ${UCalc.fx(f)}.", correct = d.text,
                wrong = wrong.filter { it != d }.map { it.text },
                solution = "Summand für Summand: Exponent als Faktor nach vorn, Exponent um 1 senken, Konstanten fallen weg. Ergebnis: f′(x) = ${d.text}.",
                explanation = "Potenzregel: (a·xⁿ)′ = a·n·xⁿ⁻¹; eine Konstante hat die Ableitung 0.",
                fact = UFact.DerivPoly(f, d, wrong.filter { it != d }),
            )
        }
    }

    val value: UTemplate by lazy {
        UTemplate("d1.value") { lv, g ->
            val f = UCalc.poly(g, lv)
            val a = if (lv == 1) g.int(1..3) else g.int(-3..3)
            val x = UQ(a)
            val answer = f.derivative.eval(x)
            val wrongs = UCalc.differing(
                listOf(
                    f.eval(x), UCalc.mistaken(f, UMistake.NO_MULTIPLY).eval(x), UCalc.mistaken(f, UMistake.NO_LOWER).eval(x),
                    UCalc.mistaken(f, UMistake.KEEP_CONSTANT).eval(x), f.derivative.eval(UQ(a + 1)),
                ),
                answer,
            )
            UProblem.numeric(
                key = "d1.value|${f.text}|$a", prompt = "Berechne f′(${UText.signed(a)}) für ${UCalc.fx(f)}.", answer = answer, wrongs = wrongs,
                solution = "f′(x) = ${f.derivative.text}; f′(${UText.signed(a)}) = ${answer.text}.",
                explanation = "Erst ableiten, dann die Stelle einsetzen; setzt du in f ein, bekommst du den Funktionswert, nicht die Steigung.",
                fact = UFact.DerivAt(f, x),
            )
        }
    }

    val linear: UTemplate by lazy {
        UTemplate("d1.linear") { lv, g ->
            val m = g.nonzero(-6..6)
            val t = g.nonzero(-9..9)
            val kind = if (lv == 1) 0 else g.int(0..2)
            val f: UPoly
            val answer: UQ
            when (kind) {
                0 -> { f = UPoly.ints(listOf(t, m)); answer = UQ(m) }
                1 -> { f = UPoly.ints(listOf(t)); answer = UQ.zero }
                else -> { f = UPoly.ints(listOf(0, 1)); answer = UQ.one }
            }
            val candidates: List<UQ> = when (kind) {
                0 -> listOf(UQ(t), UQ(m * t), UQ(m + t), UQ.zero)
                1 -> listOf(UQ(t), UQ.one, UQ(t + 1), UQ(2))
                else -> listOf(UQ.zero, UQ(2), UQ.one + UQ.one + UQ.one)
            }
            val wrongs = UCalc.differing(candidates, answer)
            UProblem.numeric(
                key = "d1.linear|${f.text}", prompt = "Welche Steigung hat der Graph von ${UCalc.fx(f)} an jeder Stelle?", answer = answer, wrongs = wrongs,
                solution = "f′(x) = ${if (f.derivative.text.isEmpty()) "0" else f.derivative.text}, also überall ${answer.text}.",
                explanation = "Eine Gerade hat überall dieselbe Steigung; eine Konstante hat die Steigung 0.",
                fact = UFact.DerivAt(f, UQ.zero),
            )
        }
    }

    val slope: UTemplate by lazy {
        UTemplate("d1.slope") { lv, g ->
            val f = UCalc.poly(g, lv)
            val a = if (lv == 1) g.int(1..3) else g.nonzero(-3..3)
            val x = UQ(a)
            val y = f.eval(x)
            val answer = f.derivative.eval(x)
            val wrongs = UCalc.differing(
                listOf(y, y / x, UCalc.mistaken(f, UMistake.NO_MULTIPLY).eval(x), UCalc.mistaken(f, UMistake.NO_LOWER).eval(x), f.derivative.eval(UQ.zero)),
                answer,
            )
            UProblem.numeric(
                key = "d1.slope|${f.text}|$a",
                prompt = "Der Graph von ${UCalc.fx(f)} geht durch P(${UText.signed(a)} | ${y.text}). Wie groß ist die Steigung der Tangente in P?",
                answer = answer, wrongs = wrongs,
                solution = "Die Tangentensteigung ist f′(${UText.signed(a)}): f′(x) = ${f.derivative.text}, also ${answer.text}.",
                explanation = "Die Steigung der Tangente in einem Punkt ist die Ableitung an dieser Stelle, nicht der y-Wert des Punktes.",
                fact = UFact.DerivAt(f, x),
            )
        }
    }

    val whereSlope: UTemplate by lazy {
        UTemplate("d1.where") { lv, g ->
            val a = if (lv == 3) g.nonzero(-3..3) else g.int(1..3)
            val x0 = g.int(-3..3)
            val b = g.int(-5..5)
            val c = g.int(-6..6)
            val f = UPoly.ints(listOf(c, b, a))
            val m = 2 * a * x0 + b
            val answer = UQ(x0)
            val wrongs = UCalc.differing(listOf(UQ(m - b, a), UQ(m, 2 * a), UQ(m + b, 2 * a), UQ(m - b), UQ(b, 2 * a)), answer)
            UProblem.numeric(
                key = "d1.where|${f.text}|$m", prompt = "An welcher Stelle hat der Graph von ${UCalc.fx(f)} die Steigung ${UText.signed(m)}?",
                answer = answer, wrongs = wrongs,
                solution = "f′(x) = ${f.derivative.text} = ${UText.signed(m)} ergibt x = $x0.",
                explanation = "Setze die Ableitung gleich der gesuchten Steigung und löse nach x auf.",
                fact = UFact.SlopeX(f, UQ(m)),
            )
        }
    }

    val tangentT: UTemplate by lazy {
        UTemplate("d1.tangentT") { lv, g ->
            val f = UCalc.poly(g, lv)
            val a = g.int(if (lv == 1) 1..2 else -2..3)
            val x = UQ(a)
            val m = f.derivative.eval(x)
            val y = f.eval(x)
            val t = y - m * x
            val wrongs = UCalc.differing(listOf(y, y + m * x, m * x, m, UCalc.mistaken(f, UMistake.NO_MULTIPLY).eval(x)), t)
            UProblem.numeric(
                key = "d1.tangentT|${f.text}|$a",
                prompt = "Die Tangente an ${UCalc.fx(f)} bei x = ${UText.signed(a)} hat die Gleichung y = m·x + t. Wie groß ist t?",
                answer = t, wrongs = wrongs,
                solution = "m = f′(${UText.signed(a)}) = ${m.text}, Punkt (${UText.signed(a)} | ${y.text}). Aus ${y.text} = ${m.text}·${UText.signed(a)} + t folgt t = ${t.text}.",
                explanation = "Setze Steigung und Punkt in y = m·x + t ein und löse nach t auf.",
                fact = UFact.TangentT(f, x),
            )
        }
    }

    val tangentY: UTemplate by lazy {
        UTemplate("d1.tangentY") { lv, g ->
            val f = UCalc.poly(g, lv)
            val a = g.int(1..2)
            var b = g.int(-3..3)
            if (b == a) b += 1
            val x = UQ(a)
            val xb = UQ(b)
            val m = f.derivative.eval(x)
            val y = f.eval(x)
            val answer = y + m * (xb - x)
            val wrongs = UCalc.differing(listOf(f.eval(xb), y + m * xb, m * (xb - x), y + m, y * m), answer)
            UProblem.numeric(
                key = "d1.tangentY|${f.text}|$a|$b",
                prompt = "Die Tangente an ${UCalc.fx(f)} bei x = $a wird nach x = ${UText.signed(b)} verlängert. Welchen y-Wert hat sie dort?",
                answer = answer, wrongs = wrongs,
                solution = "Tangente: y = ${y.text} + ${m.text}·(x − $a). Bei x = ${UText.signed(b)}: y = ${answer.text}.",
                explanation = "Die Tangente ist y = f(a) + f′(a)·(x − a); der Funktionswert f(b) gehört zur Kurve, nicht zur Tangente.",
                fact = UFact.TangentY(f, x, xb),
            )
        }
    }

    val horizontal: UTemplate by lazy {
        UTemplate("d1.flat") { lv, g ->
            val a = if (lv == 3) g.nonzero(-3..3) else g.int(1..3)
            val h = g.int(-4..4)
            val k = g.int(-5..5)
            val f = UPoly.ints(listOf(a * h * h + k, -2 * a * h, a))
            val askY = lv >= 2
            val answer = UQ(if (askY) k else h)
            val wrongs: List<UQ> = if (askY) listOf(UQ(a * h * h + k), UQ(h), UQ(a * k), UQ(-2 * a * h))
            else listOf(UQ(2 * h), UQ(k), UQ(a * h * h + k), UQ(-2 * a * h))
            UProblem.numeric(
                key = "d1.flat|${f.text}|$askY",
                prompt = if (askY) "Der Graph von ${UCalc.fx(f)} hat eine waagerechte Tangente. Welchen y-Wert hat der Berührpunkt?"
                else "An welcher Stelle hat der Graph von ${UCalc.fx(f)} eine waagerechte Tangente?",
                answer = answer, wrongs = UCalc.differing(wrongs, answer),
                solution = "f′(x) = ${f.derivative.text} = 0 ergibt x = $h; f($h) = $k.",
                explanation = "Eine waagerechte Tangente hat die Steigung 0, also f′(x) = 0.",
                fact = if (askY) UFact.FlatY(f) else UFact.FlatX(f),
            )
        }
    }

    val negativeExponent: UTemplate by lazy {
        UTemplate("d1.negexp") { lv, g ->
            val useRoot = lv >= 2 && g.chance(0.4)
            if (useRoot) {
                val c = g.int(1..6) * 2
                val r = g.int(1..5)
                val x = r * r
                val answer = UQ(c, 2 * r)
                val name = if (c == 1) "√x" else "${c}√x"
                val wrongs = UCalc.differing(listOf(UQ(c, r), UQ(c * r, 2), UQ(1, 2 * r), UQ(c, 2 * x)), answer)
                return@UTemplate UProblem.numeric(
                    key = "d1.negexp|root|$c|$x", prompt = "Berechne f′($x) für f(x) = $name.", answer = answer, wrongs = wrongs,
                    solution = "√x = x^(1/2), also f′(x) = $c·1/2·x^(−1/2) = $c/(2√x). Bei x = $x: ${answer.text}.",
                    explanation = "Wurzeln schreibst du als Potenz: √x = x^(1/2); dann gilt die Potenzregel.",
                    fact = UFact.DerivOfFunction({ c.toDouble() * Math.sqrt(it) }, x.toDouble()),
                )
            }
            val n = if (lv == 1) g.int(1..2) else g.int(2..3)
            val c = g.int(1..5)
            val a = if (lv == 1) 1 else g.int(1..2)
            val answer = UQ(-n * c) / UQ(a).power(n + 1)
            val wrongs = UCalc.differing(
                listOf(
                    UQ(n * c) / UQ(a).power(n), UQ(c) / UQ(a).power(n + 1), UQ(-(n - 1) * c) / UQ(a).power(n), UQ(-n * c) / UQ(a).power(n),
                ),
                answer,
            )
            val name = (if (c == 1) "1" else "$c") + "/x" + (if (n == 1) "" else UText.superscript(n))
            UProblem.numeric(
                key = "d1.negexp|$c|$n|$a", prompt = "Berechne f′($a) für f(x) = $name.", answer = answer, wrongs = wrongs,
                solution = "f(x) = $c·x^(−$n), also f′(x) = −${n * c}·x^(−${n + 1}) = −${n * c}/x^${n + 1}. Bei x = $a: ${answer.text}.",
                explanation = "Schreibe 1/xⁿ als x⁻ⁿ; die Potenzregel gilt auch für negative Exponenten.",
                fact = UFact.DerivOfFunction({ c.toDouble() / Math.pow(it, n.toDouble()) }, a.toDouble()),
            )
        }
    }
}
