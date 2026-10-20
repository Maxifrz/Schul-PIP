package de.maxifrz.lernwerk.learn.math.upper

import de.maxifrz.lernwerk.learn.LearnExercise

/**
 * Unit 3: integral calculus (antiderivative, definite integral, area between graph and x-axis, mean value).
 * Integrands are built as derivatives of polynomials with whole coefficients, so the results are whole numbers.
 */
object MathUpperUnit03 {
    val templates: List<UTemplate> by lazy { listOf(antiderivative, noConstant, definite, signed, area, rules, mean, upper) }

    fun wrapped(f: UPoly): String {
        val terms = f.c.count { !it.isZero }
        val negativeSingle = terms == 1 && (f.c.lastOrNull()?.n ?: 0L) < 0
        return if (terms > 1 || negativeSingle) "(" + f.text + ")" else f.text
    }

    fun bracketed(q: UQ): String = if (q.n < 0) "(${q.text})" else q.text

    fun integralSign(a: Int, b: Int): String = "∫" + UText.subscripted(a) + UText.superscript(b)

    fun integralText(a: Int, b: Int, f: UPoly): String = integralSign(a, b) + " " + wrapped(f) + " dx"

    /** A polynomial F with whole coefficients and no constant term, and its derivative f. */
    fun pair(g: UGen, level: Int): Pair<UPoly, UPoly> {
        for (attempt in 0 until 40) {
            val bigF = when (level) {
                1 -> g.poly(degree = 2, terms = g.int(1..2), coefficients = 1..3, negatives = false)
                2 -> g.poly(degree = g.int(2..3), terms = 2, coefficients = 1..3)
                else -> g.poly(degree = 3, terms = g.int(2..3), coefficients = 1..3)
            }
            val noConstant = UPoly(bigF.c.mapIndexed { i, q -> if (i == 0) UQ.zero else q })
            val f = noConstant.derivative
            if (!f.isZero && f.degree >= 1) return noConstant to f
        }
        val bigF = UPoly.ints(listOf(0, 0, 1))
        return bigF to bigF.derivative
    }

    val antiderivative: UTemplate by lazy {
        UTemplate("i.anti", pairs = { _, g ->
            val items = mutableListOf<UPairItem>()
            val fronts = hashSetOf<String>()
            val backs = hashSetOf<String>()
            var i = 0
            while (i < 80 && items.size < 4) {
                i += 1
                val (bigF, f) = pair(g, 1)
                val front = "∫ " + wrapped(f) + " dx"
                val back = bigF.text + " + C"
                if (fronts.add(LearnExercise.folded(front)) && backs.add(LearnExercise.folded(back))) items.add(UPairItem(front, back))
            }
            if (items.size == 4) items else null
        }) { lv, g ->
            val bigF: UPoly
            val f: UPoly
            if (lv == 3) {
                f = g.poly(degree = g.int(2..3), terms = g.int(2..3), coefficients = 1..5)
                bigF = f.integral
            } else {
                val p = pair(g, lv)
                bigF = p.first
                f = p.second
            }
            val correct = bigF.text + " + C"
            val nz = f.c.withIndex().filter { !it.value.isZero }
            val forgotDivide = UPoly.terms(nz.map { (it.index + 1) to it.value })
            val divideOld = UPoly.terms(nz.map { (it.index + 1) to (if (it.index == 0) it.value else it.value / UQ(it.index)) })
            val wrongPolys = listOf(forgotDivide, f.derivative, divideOld).filter { it != bigF && !it.isZero }
            val wrong = wrongPolys.map { it.text + " + C" }
            UProblem.choice(
                key = "i.anti|${f.text}", prompt = "Welche Funktion ist eine Stammfunktion von ${UCalc.fx(f)}?", correct = correct, wrong = wrong,
                solution = "Jeden Summanden aufleiten: Exponent um 1 erhöhen, durch den neuen Exponenten teilen. Dazu kommt + C. Ergebnis: F(x) = $correct.",
                explanation = "Aufleiten ist die Umkehrung des Ableitens: Leite zur Probe F ab, es muss f herauskommen.",
                fact = UFact.Antiderivative(f, bigF, wrongPolys),
            )
        }
    }

    val noConstant: UTemplate by lazy {
        UTemplate("i.noC") { _, g ->
            val (bigF, f) = pair(g, 1)
            val a = g.int(0..1)
            val b = a + g.int(1..3)
            val value = bigF.eval(UQ(b)) - bigF.eval(UQ(a))
            val c = "C"
            fun text(v: UQ, extra: String): String = if (extra.isEmpty()) v.text else "${v.text} + $extra"
            val correct = value.text
            val wrong = listOf(text(value, c), text(value, "2C"), text(bigF.eval(UQ(b)), c))
            UProblem.choice(
                key = "i.noC|${f.text}|$a|$b",
                prompt = "Du berechnest ${integralText(a, b, f)} mit der Stammfunktion F(x) = ${bigF.text} + C. Was kommt heraus?", correct = correct, wrong = wrong,
                solution = "F($b) − F($a) = (${bigF.eval(UQ(b)).text} + C) − (${bigF.eval(UQ(a)).text} + C) = ${value.text}. Das C hebt sich auf.",
                explanation = "Beim bestimmten Integral wird die Stammfunktion zweimal eingesetzt und subtrahiert; die Konstante C fällt dabei weg.",
                fact = UFact.Definite(f, UQ(a), UQ(b)),
            )
        }
    }

    val definite: UTemplate by lazy {
        UTemplate("i.definite") { lv, g ->
            val (bigF, f) = pair(g, lv)
            val a = if (lv == 1) g.int(0..1) else g.int(-2..1)
            val b = maxOf(a + g.int(1..(if (lv == 3) 3 else 2)), 0)
            val answer = bigF.eval(UQ(b)) - bigF.eval(UQ(a))
            val wrongs = UCalc.differing(
                listOf(bigF.eval(UQ(b)), bigF.eval(UQ(b)) + bigF.eval(UQ(a)), f.eval(UQ(b)) - f.eval(UQ(a)), f.eval(UQ(b)) * UQ(b - a)),
                answer,
            )
            UProblem.numeric(
                key = "i.definite|${f.text}|$a|$b", prompt = "Berechne ${integralText(a, b, f)}.", answer = answer, wrongs = wrongs,
                solution = "F(x) = ${bigF.text}; F($b) − F($a) = ${bigF.eval(UQ(b)).text} − ${bracketed(bigF.eval(UQ(a)))} = ${answer.text}.",
                explanation = "Bestimmtes Integral: obere Grenze in F einsetzen minus untere Grenze in F einsetzen; ein C wird nicht gebraucht.",
                fact = UFact.Definite(f, UQ(a), UQ(b)),
            )
        }
    }

    class Parabola(val f: UPoly, val r1: Int, val r2: Int, val integral: UQ)

    /** f = lead (x - r1)(x - r2) with a whole-number integral between the roots. */
    fun parabola(g: UGen, signedLead: Boolean): Parabola? {
        for (attempt in 0 until 200) {
            val r1 = g.int(-3..2)
            val r2 = r1 + g.int(2..6)
            if (r2 < 0) continue
            val lead = if (signedLead) g.nonzero(-3..3) else g.int(1..3)
            val f = UPoly.fromRoots(UQ(lead), listOf(UQ(r1), UQ(r2)))
            val bigF = f.integral
            val value = bigF.eval(UQ(r2)) - bigF.eval(UQ(r1))
            if (value.isInt && value.magnitude.n <= 60) return Parabola(f, r1, r2, value)
        }
        return null
    }

    val signed: UTemplate by lazy {
        UTemplate("i.signed") { _, g ->
            val p = parabola(g, true) ?: return@UTemplate null
            val bigF = p.f.integral
            val wrongs = UCalc.differing(
                listOf(p.integral.magnitude, bigF.eval(UQ(p.r2)), bigF.eval(UQ(p.r2)) - bigF.eval(UQ.zero), p.f.eval(UQ(p.r2)) - p.f.eval(UQ(p.r1))),
                p.integral,
            )
            UProblem.numeric(
                key = "i.signed|${p.f.text}", prompt = "Berechne ${integralText(p.r1, p.r2, p.f)}. Die Grenzen sind die Nullstellen.",
                answer = p.integral, wrongs = wrongs,
                solution = "F(x) = ${bigF.text}; F(${p.r2}) − F(${p.r1}) = ${p.integral.text}. Das Vorzeichen bleibt stehen: Liegt der Graph unter der x-Achse, ist das Integral negativ.",
                explanation = "Das Integral zählt Flächen unter der x-Achse negativ; erst der Flächeninhalt nimmt den Betrag.",
                fact = UFact.Definite(p.f, UQ(p.r1), UQ(p.r2)),
            )
        }
    }

    val area: UTemplate by lazy {
        UTemplate("i.area") { lv, g ->
            if (lv == 3) {
                for (attempt in 0 until 300) {
                    val roots = hashSetOf<Int>()
                    while (roots.size < 3) roots.add(g.int(-3..3))
                    val r = roots.sorted()
                    val f = UPoly.fromRoots(UQ(g.pick(listOf(1, 1, -1, 2))), r.map { UQ(it) })
                    val bigF = f.integral
                    val first = bigF.eval(UQ(r[1])) - bigF.eval(UQ(r[0]))
                    val second = bigF.eval(UQ(r[2])) - bigF.eval(UQ(r[1]))
                    val total = first.magnitude + second.magnitude
                    if (!(total.d <= 2 && total.n > 0)) continue
                    val wrongs = UCalc.differing(listOf(first + second, (first + second).magnitude, first.magnitude, second.magnitude), total)
                    return@UTemplate UProblem.numeric(
                        key = "i.area3|${f.text}", prompt = "Wie groß ist der Flächeninhalt zwischen dem Graphen von ${UCalc.fx(f)} und der x-Achse zwischen der kleinsten und der größten Nullstelle?",
                        answer = total, wrongs = wrongs,
                        solution = "Nullstellen ${r.joinToString(", ")}. Teilflächen einzeln: |${first.text}| + |${second.text}| = ${total.text}. Würdest du in einem Stück integrieren, höben sich die Teile teilweise auf.",
                        explanation = "Bei einem Vorzeichenwechsel zwischen den Grenzen rechnest du an jeder Nullstelle getrennt und addierst die Beträge.",
                        fact = UFact.Area(f, UQ(r[0]), UQ(r[2])),
                    )
                }
                return@UTemplate null
            }
            val p = parabola(g, lv == 2) ?: return@UTemplate null
            val bigF = p.f.integral
            val answer = p.integral.magnitude
            val wrongs = UCalc.differing(
                listOf(
                    bigF.eval(UQ(p.r2)).magnitude, (bigF.eval(UQ(p.r2)) - bigF.eval(UQ.zero)).magnitude, answer + answer,
                    UQ(p.r2 - p.r1) * p.f.eval(UQ(p.r1 + p.r2, 2)).magnitude,
                ),
                answer,
            )
            UProblem.numeric(
                key = "i.area|${p.f.text}", prompt = "Wie groß ist der Flächeninhalt zwischen dem Graphen von ${UCalc.fx(p.f)} und der x-Achse?",
                answer = answer, wrongs = wrongs,
                solution = "Nullstellen ${p.r1} und ${p.r2}. Integral von ${p.r1} bis ${p.r2}: ${p.integral.text}; der Flächeninhalt ist der Betrag: ${answer.text}.",
                explanation = "Zwischen zwei benachbarten Nullstellen liegt der Graph auf einer Seite; der Flächeninhalt ist der Betrag des Integrals.",
                fact = UFact.Area(p.f, UQ(p.r1), UQ(p.r2)),
            )
        }
    }

    val rules: UTemplate by lazy {
        UTemplate("i.rules") { _, g ->
            val a = g.int(0..2)
            val b = a + g.int(1..3)
            val c = b + g.int(1..3)
            val p = g.int(2..9)
            val q = g.int(1..8)
            when (g.int(0..4)) {
                0 -> {
                    val answer = UQ(p + q)
                    UProblem.numeric(
                        key = "i.rules|add|$p|$q|$a|$b|$c",
                        prompt = "Es gilt ${integralSign(a, b)} f(x) dx = $p und ${integralSign(b, c)} f(x) dx = $q. Wie groß ist ${integralSign(a, c)} f(x) dx?",
                        answer = answer, wrongs = UCalc.differing(listOf(UQ(p * q), UQ(p - q), UQ(p)), answer),
                        solution = "Aneinandergrenzende Intervalle addierst du: $p + $q = ${p + q}.",
                        explanation = "Integrale über aneinandergrenzende Intervalle darfst du addieren.", fact = UFact.Combination(listOf(UQ.one, UQ.one), listOf(UQ(p), UQ(q))),
                    )
                }
                1 -> {
                    val k = g.int(2..5)
                    UProblem.numeric(
                        key = "i.rules|factor|$p|$k|$a|$b",
                        prompt = "Es gilt ${integralSign(a, b)} f(x) dx = $p. Wie groß ist ${integralSign(a, b)} $k·f(x) dx?",
                        answer = UQ(k * p), wrongs = UCalc.differing(listOf(UQ(k + p), UQ(p), UQ(k * p * (b - a))), UQ(k * p)),
                        solution = "Ein Faktor kommt vor das Integral: $k·$p = ${k * p}.",
                        explanation = "Konstante Faktoren darfst du vor das Integral ziehen.", fact = UFact.Combination(listOf(UQ(k)), listOf(UQ(p))),
                    )
                }
                2 -> UProblem.numeric(
                    key = "i.rules|swap|$p|$a|$b",
                    prompt = "Es gilt ${integralSign(a, b)} f(x) dx = $p. Wie groß ist ${integralSign(b, a)} f(x) dx?",
                    answer = UQ(-p), wrongs = UCalc.differing(listOf(UQ(p), UQ.zero, UQ(2 * p), UQ(p + 1)), UQ(-p)),
                    solution = "Vertauschst du die Grenzen, wechselt das Vorzeichen: −$p.",
                    explanation = "Vertauschte Grenzen drehen das Vorzeichen des Integrals um.", fact = UFact.Combination(listOf(UQ(-1)), listOf(UQ(p))),
                )
                3 -> {
                    val k = g.int(2..4)
                    val answer = UQ(p - k * q)
                    UProblem.numeric(
                        key = "i.rules|lin|$p|$q|$k|$a|$b",
                        prompt = "Es gilt ${integralSign(a, b)} f(x) dx = $p und ${integralSign(a, b)} g(x) dx = $q. Wie groß ist ${integralSign(a, b)} (f(x) − $k·g(x)) dx?",
                        answer = answer, wrongs = UCalc.differing(listOf(UQ(p - q), UQ(p + k * q), UQ(p - k + q), UQ(p * q)), answer),
                        solution = "Summen und Faktoren darfst du aufteilen: $p − $k·$q = ${answer.text}.",
                        explanation = "Das Integral ist linear: Differenzen und konstante Faktoren darfst du einzeln integrieren.",
                        fact = UFact.Combination(listOf(UQ.one, UQ(-k)), listOf(UQ(p), UQ(q))),
                    )
                }
                else -> UProblem.numeric(
                    key = "i.rules|zero|$a|$p",
                    prompt = "Es gilt ${integralSign(a, b)} f(x) dx = $p. Wie groß ist ${integralSign(a, a)} f(x) dx?",
                    answer = UQ.zero, wrongs = UCalc.differing(listOf(UQ(p), UQ(-p), UQ(a), UQ(1)), UQ.zero),
                    solution = "Sind obere und untere Grenze gleich, gibt es keine Breite: 0.",
                    explanation = "Ein Integral mit gleichen Grenzen ist immer 0.", fact = UFact.Combination(listOf(UQ.zero), listOf(UQ(p))),
                )
            }
        }
    }

    val mean: UTemplate by lazy {
        UTemplate("i.mean") { lv, g ->
            for (attempt in 0 until 200) {
                val f = g.poly(degree = if (lv == 3) 3 else 2, terms = if (lv == 1) 2 else 3, coefficients = 1..5, negatives = lv != 1)
                val a = if (lv == 1) 0 else g.int(-1..1)
                val b = a + g.int(1..4)
                val bigF = f.integral
                val integral = bigF.eval(UQ(b)) - bigF.eval(UQ(a))
                val answer = integral / UQ(b - a)
                if (!(answer.d <= 2 && Math.abs(answer.double) < 500)) continue
                val midpoint = f.eval(UQ(a + b, 2))
                val wrongs = UCalc.differing(listOf(integral, (f.eval(UQ(a)) + f.eval(UQ(b))) / UQ(2), midpoint, integral / UQ(b)), answer)
                return@UTemplate UProblem.numeric(
                    key = "i.mean|${f.text}|$a|$b",
                    prompt = "Bestimme den Mittelwert von ${UCalc.fx(f)} auf dem Intervall [${UText.signed(a)}; $b].", answer = answer, wrongs = wrongs,
                    solution = "Mittelwert = 1/(b − a) · Integral = 1/${b - a} · ${integral.text} = ${answer.text}.",
                    explanation = "Der Mittelwert ist das Integral geteilt durch die Länge des Intervalls.", fact = UFact.Mean(f, UQ(a), UQ(b)),
                )
            }
            null
        }
    }

    val upper: UTemplate by lazy {
        UTemplate("i.upper") { lv, g ->
            val b = g.int(1..5)
            val f: UPoly
            val value: Int
            if (lv == 3) {
                val m = 3 * g.int(1..3)
                f = UPoly.terms(listOf(2 to UQ(m)))
                value = m * b * b * b / 3
            } else {
                val m = 2 * g.int(1..3)
                f = UPoly.terms(listOf(1 to UQ(m)))
                value = m * b * b / 2
            }
            val answer = UQ(b)
            val m = f.c.last().n.toInt()
            val wrongs = UCalc.differing(listOf(UQ(value, m), UQ(value, 2), UQ(value - m), UQ(2 * value, m)), answer)
            UProblem.numeric(
                key = "i.upper|${f.text}|$b", prompt = "Für welches b > 0 gilt ∫₀ᵇ ${f.text} dx = $value?",
                answer = answer, wrongs = wrongs,
                solution = "Stammfunktion ${f.integral.text}; an der Grenze b: ${f.integral.eval(UQ(b)).text} mit b = $b gibt $value. Also b = $b.",
                explanation = "Rechne das Integral mit der Grenze b aus und löse die entstehende Gleichung nach b.", fact = UFact.UpperLimit(f, UQ(value)),
            )
        }
    }
}
