package de.maxifrz.lernwerk.learn.math.upper

/** Unit 4: exponential function and logarithm (derivative, antiderivative, logarithm laws, equations). */
object MathUpperUnit04 {
    val templates: List<UTemplate> by lazy {
        listOf(derivative, antiderivative, valueAtZero, inverse, lnDerivative, logValue, lawChoice, lawCalculation, solveEquation, lnSolve)
    }

    /** "3e^(2x)", "e^x", "−e^(−x)", "2e^(3x)/5". */
    fun expText(coefficient: UQ, k: Int): String {
        val exponent = if (k == 1) "x" else (if (k == -1) "(−x)" else "(${UText.signed(k)}x)")
        val magnitude = coefficient.magnitude
        val head = if (magnitude.n == 1L) "" else "${magnitude.n}"
        val tail = if (magnitude.d == 1L) "" else "/${magnitude.d}"
        return (if (coefficient.n < 0) "−" else "") + head + "e^" + exponent + tail
    }

    fun exponentName(k: Int): String = if (k == 1) "x" else (if (k == -1) "−x" else "${UText.signed(k)}x")

    fun function(a: Int, k: Int, b: Int): String {
        var text = expText(UQ(a), k)
        if (b != 0) text += (if (b < 0) " − " else " + ") + (if (Math.abs(b) == 1) "" else "${Math.abs(b)}") + "x²"
        return text
    }

    val derivative: UTemplate by lazy {
        UTemplate("e.deriv", pairs = { _, g ->
            val items = mutableListOf<UPairItem>()
            val ks = hashSetOf<Int>()
            var i = 0
            while (i < 60 && items.size < 4) {
                i += 1
                val k = g.int(2..6)
                val a = g.int(1..4)
                if (ks.add(k)) items.add(UPairItem("f(x) = " + expText(UQ(a), k), "f′(x) = " + expText(UQ(a * k), k)))
            }
            if (items.size == 4) items else null
        }) { lv, g ->
            val k = if (lv == 1) g.pick(listOf(1, 2, 3, 4, 5)) else g.nonzero(-4..5)
            val a = if (lv == 1) 1 else g.nonzero(-4..4)
            val b = if (lv == 3) g.nonzero(-3..4) else 0
            val secondPart: (UQ) -> String = { c ->
                if (b == 0) "" else (if (c.n < 0) " − " else " + ") + (if (c.magnitude.n == 1L) "" else "${c.magnitude.n}") + "x"
            }
            val secondCorrect = secondPart(UQ(2 * b))
            val secondWrong = secondPart(UQ(b))
            val correct = expText(UQ(a * k), k) + secondCorrect
            val noChain = expText(UQ(a), k) + secondCorrect
            val integrated = expText(UQ(a, k), k) + secondCorrect
            val power = (if (a * k == 1) "" else (if (a * k == -1) "−" else UText.signed(a * k))) + "x·e^(${exponentName(k)} − 1)" + secondCorrect
            val wrong = mutableListOf(noChain, integrated, power)
            if (b != 0) wrong.add(correct.replace(secondCorrect, secondWrong))
            if (a != 1) wrong.add(expText(UQ(k), k) + secondCorrect)
            UProblem.choice(
                key = "e.deriv|$a|$k|$b", prompt = "Bilde die Ableitung von f(x) = ${function(a, k, b)}.", correct = correct, wrong = wrong,
                solution = "Kettenregel: (e^(kx))′ = k·e^(kx). Hier k = $k: $correct.",
                explanation = "Beim Ableiten von e^(kx) kommt die innere Ableitung k als Faktor dazu; der Exponent bleibt unverändert.",
                fact = UFact.ExpDeriv(a, k, b),
            )
        }
    }

    val antiderivative: UTemplate by lazy {
        UTemplate("e.anti") { lv, g ->
            val k = if (lv == 1) g.pick(listOf(1, 2, 3, 4)) else g.nonzero(-4..5)
            val a = if (lv == 1) 1 else g.nonzero(-4..4)
            val correct = expText(UQ(a, k), k) + " + C"
            val wrong = listOf(
                expText(UQ(a * k), k) + " + C", expText(UQ(a), k) + " + C",
                "${UText.coefficient(a)}e^(${exponentName(k)} + 1)/(${exponentName(k)} + 1) + C",
            )
            UProblem.choice(
                key = "e.anti|$a|$k", prompt = "Welche Funktion ist eine Stammfunktion von f(x) = ${expText(UQ(a), k)}?", correct = correct, wrong = wrong,
                solution = "∫ e^(kx) dx = (1/k)·e^(kx) + C, hier mit k = $k und dem Faktor $a: $correct.",
                explanation = "Beim Aufleiten von e^(kx) musst du durch k teilen; zur Probe leitest du das Ergebnis ab.",
                fact = UFact.ExpAnti(a, k),
            )
        }
    }

    val valueAtZero: UTemplate by lazy {
        UTemplate("e.zero") { lv, g ->
            val a = g.nonzero(-4..4)
            val k = g.nonzero(if (lv == 1) 1..4 else -4..4)
            val b = g.nonzero(-5..5)
            val c = g.int(-5..5)
            val askDerivative = g.chance(0.6)
            val f: (Double) -> Double = { a.toDouble() * Math.exp(k.toDouble() * it) + b.toDouble() * it + c.toDouble() }
            val name = expText(UQ(a), k) + (if (b < 0) " − " else " + ") + (if (Math.abs(b) == 1) "" else "${Math.abs(b)}") + "x" +
                (if (c == 0) "" else (if (c < 0) " − " else " + ") + "${Math.abs(c)}")
            val answer = UQ(if (askDerivative) a * k + b else a + c)
            val wrongs = if (askDerivative) listOf(UQ(a + c), UQ(a * k), UQ(a + b), UQ(k + b), UQ(a))
            else listOf(UQ(a * k + b), UQ(a + b + c), UQ(c), UQ(a * k + c), UQ(a))
            UProblem.numeric(
                key = "e.zero|$name|$askDerivative", prompt = "Berechne ${if (askDerivative) "f′(0)" else "f(0)"} für f(x) = $name.",
                answer = answer, wrongs = UCalc.differing(wrongs, answer),
                solution = if (askDerivative) "f′(x) = ${UQ(a * k).text}·e^(${exponentName(k)}) + $b; wegen e⁰ = 1 ist f′(0) = ${a * k} + $b = ${answer.text}."
                else "Wegen e⁰ = 1 ist f(0) = $a + 0 + $c = ${answer.text}.",
                explanation = "Setzt du x = 0 ein, wird jeder Exponent 0, und e⁰ = 1.",
                fact = if (askDerivative) UFact.DerivOfFunction(f, 0.0) else UFact.ValueOfFunction(f, 0.0),
            )
        }
    }

    private class InverseItem(val name: String, val result: Int, val how: String, val approx: Double, val wrongs: List<UQ>)

    val inverse: UTemplate by lazy {
        UTemplate("e.inverse") { lv, g ->
            val n = g.nonzero(-5..6)
            val m = g.int(2..9)
            val items = listOf(
                InverseItem("ln(e${UText.superscript(n)})", n, "ln und e heben sich auf: ln(e^n) = n.", n.toDouble(), listOf(UQ.one, UQ.zero, UQ(n * n), UQ(n + 1))),
                InverseItem("e^(ln $m)", m, "e^(ln m) = m, denn e und ln sind Umkehrfunktionen.", m.toDouble(), listOf(UQ.one, UQ.zero, UQ(m * m), UQ(m + 1))),
                InverseItem("ln(1)", 0, "e⁰ = 1, also ln(1) = 0.", 0.0, listOf(UQ.one, UQ(-1), UQ(2))),
                InverseItem("ln(e)", 1, "e¹ = e, also ln(e) = 1.", 1.0, listOf(UQ.zero, UQ(2), UQ(-1))),
            )
            val pick = if (lv == 1) g.pick(listOf(items[2], items[3], items[1])) else g.pick(items)
            val answer = UQ(pick.result)
            val wrongs = UCalc.differing(pick.wrongs, answer)
            UProblem.numeric(
                key = "e.inverse|${pick.name}", prompt = "Berechne ${pick.name}.", answer = answer, wrongs = wrongs, solution = pick.how + " Ergebnis: ${answer.text}.",
                explanation = "Exponentialfunktion und natürlicher Logarithmus sind Umkehrfunktionen voneinander.", fact = UFact.Approx(pick.approx),
            )
        }
    }

    val lnDerivative: UTemplate by lazy {
        UTemplate("e.lnDeriv") { lv, g ->
            val c = g.nonzero(if (lv == 1) 1..5 else -5..6)
            val p = g.pick(listOf(1, 2, 4, 5))
            val b = if (lv == 3) g.nonzero(-3..3) else 0
            val answer = UQ(c, p) + UQ(2 * b * p)
            val wrongs = listOf(UQ(c * p), UQ(1, p), UQ(c, p * p), UQ(c), UQ(c, p) + UQ(b * p))
            val tail = if (b == 0) "" else (if (b < 0) " − " else " + ") + (if (Math.abs(b) == 1) "" else "${Math.abs(b)}") + "x²"
            val head = if (c == 1) "ln(x)" else (if (c == -1) "−ln(x)" else "${UText.signed(c)}·ln(x)")
            val f: (Double) -> Double = { c.toDouble() * Math.log(it) + b.toDouble() * it * it }
            UProblem.numeric(
                key = "e.lnDeriv|$c|$p|$b", prompt = "Berechne f′($p) für f(x) = $head$tail.", answer = answer, wrongs = UCalc.differing(wrongs, answer),
                solution = "(ln x)′ = 1/x, also f′(x) = $c/x${if (b == 0) "" else " + ${2 * b}x"}. Bei x = $p: ${answer.text}.",
                explanation = "Die Ableitung von ln(x) ist 1/x; ein Faktor davor bleibt erhalten.", fact = UFact.DerivOfFunction(f, p.toDouble()),
            )
        }
    }

    fun logName(base: Int, argument: String): String = "log${UText.subscripted(base)}($argument)"

    val logValue: UTemplate by lazy {
        UTemplate("e.log") { lv, g ->
            val base = g.pick(if (lv == 1) listOf(2, 3, 10) else listOf(2, 3, 5, 10))
            val n = g.int(if (lv == 1) 1..4 else 2..5)
            var argument = 1
            for (i in 0 until n) argument *= base
            if (argument > 100_000) return@UTemplate null
            val answer = UQ(n)
            val wrongs = UCalc.differing(listOf(UQ(argument / base), UQ(argument), UQ(argument, base), UQ(n + 1), UQ(n - 1)), answer)
            UProblem.numeric(
                key = "e.log|$base|$n", prompt = "Berechne ${logName(base, "$argument")}.", answer = answer, wrongs = wrongs,
                solution = "$base^$n = $argument, also ${logName(base, "$argument")} = $n.",
                explanation = "log_b(x) ist der Exponent, mit dem du b potenzieren musst, um x zu erhalten.",
                fact = UFact.Approx(Math.log(argument.toDouble()) / Math.log(base.toDouble())),
            )
        }
    }

    val lawChoice: UTemplate by lazy {
        UTemplate("e.lawChoice") { _, g ->
            val which = g.int(0..2)
            val base = g.pick(listOf(0, 2, 3, 5, 10))
            val name = if (base == 0) "ln" else "log${UText.subscripted(base)}"
            val bigL: (Double) -> Double = { if (base == 0) Math.log(it) else Math.log(it) / Math.log(base.toDouble()) }
            val correct: String
            val wrong: List<String>
            val c: (Double, Double) -> Pair<Double, Double>
            val w: List<(Double, Double) -> Pair<Double, Double>>
            val rule: String
            val subject: String
            when (which) {
                0 -> {
                    subject = "$name(a·b)"
                    correct = "Summe: $name(a) + $name(b)"
                    wrong = listOf("Produkt: $name(a) · $name(b)", "Logarithmus der Summe: $name(a + b)", "Summe: $name(a) + b")
                    c = { a, b -> bigL(a * b) to (bigL(a) + bigL(b)) }
                    w = listOf<(Double, Double) -> Pair<Double, Double>>(
                        { a, b -> bigL(a * b) to (bigL(a) * bigL(b)) }, { a, b -> bigL(a * b) to bigL(a + b) }, { a, b -> bigL(a * b) to (bigL(a) + b) },
                    )
                    rule = "Ein Produkt im Logarithmus wird zur Summe der Logarithmen."
                }
                1 -> {
                    subject = "$name(a/b)"
                    correct = "Differenz: $name(a) − $name(b)"
                    wrong = listOf("Quotient: $name(a) / $name(b)", "Logarithmus der Differenz: $name(a − b)", "Summe: $name(a) + $name(b)")
                    c = { a, b -> bigL(a / b) to (bigL(a) - bigL(b)) }
                    w = listOf<(Double, Double) -> Pair<Double, Double>>(
                        { a, b -> bigL(a / b) to (bigL(a) / bigL(b)) }, { a, b -> bigL(a / b) to bigL(a - b) }, { a, b -> bigL(a / b) to (bigL(a) + bigL(b)) },
                    )
                    rule = "Ein Quotient im Logarithmus wird zur Differenz der Logarithmen."
                }
                else -> {
                    subject = "$name(aⁿ)"
                    correct = "Faktor vor dem Logarithmus: n·$name(a)"
                    wrong = listOf("Potenz des Logarithmus: ($name a)ⁿ", "Summe: $name(a) + n", "Faktor im Argument: $name(n·a)")
                    c = { a, _ -> bigL(Math.pow(a, 3.0)) to (3 * bigL(a)) }
                    w = listOf<(Double, Double) -> Pair<Double, Double>>(
                        { a, _ -> bigL(Math.pow(a, 3.0)) to Math.pow(bigL(a), 3.0) }, { a, _ -> bigL(Math.pow(a, 3.0)) to (bigL(a) + 3) },
                        { a, _ -> bigL(Math.pow(a, 3.0)) to bigL(3 * a) },
                    )
                    rule = "Ein Exponent im Argument wird zum Faktor vor dem Logarithmus."
                }
            }
            UProblem.choice(
                key = "e.lawChoice|$which|$base", prompt = "Wie lässt sich $subject umformen? Es gilt a, b > 0 und n ≥ 1.", correct = correct, wrong = wrong,
                solution = "$rule Richtig ist: $correct",
                explanation = "Die Logarithmusgesetze verwandeln Rechenarten eine Stufe niedriger: Produkt zu Summe, Quotient zu Differenz, Potenz zu Produkt.",
                fact = UFact.Law(c, w),
            )
        }
    }

    val lawCalculation: UTemplate by lazy {
        UTemplate("e.laws") { lv, g ->
            val base = g.pick(listOf(2, 3, 5))
            val m = g.int(1..4)
            val n = g.int(1..3)
            fun power(e: Int): Int { var x = 1; for (i in 0 until e) x *= base; return x }
            val variant = if (lv == 2) g.int(0..1) else g.int(0..3)
            val text: String
            val answer: Int
            val wrongs: List<Int>
            val how: String
            when (variant) {
                0 -> {
                    text = "${logName(base, "${power(m)}")} + ${logName(base, "${power(n)}")}"
                    answer = m + n
                    wrongs = listOf(m * n, m - n, power(m) + power(n))
                    how = "$m + $n = ${m + n}; oder zusammen: ${logName(base, "${power(m + n)}")}."
                }
                1 -> {
                    text = "${logName(base, "${power(m + n)}")} − ${logName(base, "${power(n)}")}"
                    answer = m
                    wrongs = listOf(m + 2 * n, m * n, power(m))
                    how = "${m + n} − $n = $m."
                }
                2 -> {
                    text = "${n + 1}·${logName(base, "${power(m)}")}"
                    answer = (n + 1) * m
                    wrongs = listOf(m + n + 1, power(m * (n + 1)), m)
                    how = "${n + 1}·$m = ${(n + 1) * m}."
                }
                else -> {
                    text = logName(base, "${power(m)}·${power(n)}")
                    answer = m + n
                    wrongs = listOf(m * n, power(m + n), power(m) * power(n))
                    how = "Produkt im Argument: $m + $n = ${m + n}."
                }
            }
            val value = answer.toDouble()
            UProblem.numeric(
                key = "e.laws|$text", prompt = "Berechne $text.", answer = UQ(answer), wrongs = UCalc.differing(wrongs.map { UQ(it) }, UQ(answer)),
                solution = how, explanation = "Wende die Logarithmusgesetze an oder berechne jeden Logarithmus einzeln als Exponent.", fact = UFact.Approx(value),
            )
        }
    }

    val solveEquation: UTemplate by lazy {
        UTemplate("e.solve") { lv, g ->
            val bases: List<Pair<String, Double>> =
                if (lv == 1) listOf("2" to 2.0, "3" to 3.0, "10" to 10.0) else listOf("e" to Math.E, "2" to 2.0, "3" to 3.0, "5" to 5.0, "10" to 10.0)
            val (name, base) = g.pick(bases)
            val k = if (lv == 1) 1 else g.int(1..3)
            val c = if (lv == 1) 0 else g.int(-2..2)
            val x0 = g.int(0..4)
            val m = k * x0 + c
            if (name != "e" && m < 0) return@UTemplate null
            if (name != "e" && m > 6) return@UTemplate null
            val rhs: String = if (name == "e") (if (m == 0) "1" else "e${UText.superscript(m)}") else "${Math.pow(base, m.toDouble()).toInt()}"
            val exponent = (if (k == 1) "x" else "${k}x") + (if (c == 0) "" else (if (c < 0) " − " else " + ") + "${Math.abs(c)}")
            val answer = UQ(x0)
            val wrongs = listOf(UQ(m, k), UQ(m + c, k), UQ(m - c), UQ(m), UQ(x0 + 1))
            UProblem.numeric(
                key = "e.solve|$name|$k|$c|$x0", prompt = "Löse $name^($exponent) = $rhs.", answer = answer, wrongs = UCalc.differing(wrongs, answer),
                solution = "Beide Seiten sind Potenzen von $name: $exponent = $m. Daraus x = $x0.",
                explanation = "Schreibe beide Seiten als Potenz derselben Basis und vergleiche die Exponenten.",
                fact = UFact.PowerEquation(base, UQ(k), UQ(c), Math.pow(base, m.toDouble())),
            )
        }
    }

    val lnSolve: UTemplate by lazy {
        UTemplate("e.lnSolve") { lv, g ->
            val a = g.pick(listOf(2, 3, 5, 6, 7, 10, 12, 20))
            val k = if (lv == 1) 1 else g.int(2..5)
            val correct = if (k == 1) "x = ln($a)" else "x = ln($a)/$k"
            val wrong: List<String> = if (k == 1) listOf("x = e^$a", "x = $a/e", "x = log₁₀($a)", "x = $a − 1")
            else listOf("x = $k·ln($a)", "x = ln($a/$k)", "x = ln($a) − $k", "x = e^($a/$k)")
            val equation = if (k == 1) "e^x = $a" else "e^(${k}x) = $a"
            UProblem.choice(
                key = "e.lnSolve|$a|$k", prompt = "Welche Lösung hat $equation?", correct = correct, wrong = wrong,
                solution = "Logarithmieren mit ln: ${if (k == 1) "x" else "${k}x"} = ln($a)${if (k == 1) "" else ", dann durch $k teilen"}. Ergebnis: $correct.",
                explanation = "ln ist die Umkehrfunktion von e^x; bei e^(kx) = a wird zuerst ln(a) gebildet und dann durch k geteilt.",
                fact = UFact.LnSolve(a, k),
            )
        }
    }
}
