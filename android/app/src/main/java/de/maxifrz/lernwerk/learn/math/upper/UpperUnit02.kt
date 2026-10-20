package de.maxifrz.lernwerk.learn.math.upper

/**
 * Unit 2: curve sketching (roots, extrema, inflection points, monotonicity, kind of extremum, symmetry).
 * Functions are built backwards from chosen roots and extrema, so every answer is a whole number or a half.
 */
object MathUpperUnit02 {
    val templates: List<UTemplate> by lazy {
        listOf(yIntercept, root, rootTest, symmetry, extremumX, extremumY, kind, inflection, monotone, slopeMeaning)
    }

    class Cubic(val f: UPoly, val x1: Int, val x2: Int, val k: Int) {
        /** The x-value of the maximum and of the minimum. */
        val maxX: Int get() = if (k > 0) x1 else x2
        val minX: Int get() = if (k > 0) x2 else x1
    }

    /** f' = k (x - x1)(x - x2) with x1 < x2; k = ±3 or ±6, so f has whole-number coefficients. */
    fun cubic(g: UGen, simple: Boolean = false): Cubic {
        for (attempt in 0 until 300) {
            val k = g.pick(if (simple) listOf(6, 3) else listOf(3, 6, -3, -6))
            val x1 = g.int(-3..2)
            val x2 = x1 + g.int(1..4)
            if (Math.abs(k) == 3 && (x1 + x2) % 2 != 0) continue
            val derivative = UPoly.fromRoots(UQ(k), listOf(UQ(x1), UQ(x2)))
            val f = derivative.integral + UPoly(listOf(UQ(g.int(-6..6))))
            if (f.c.all { it.isInt }) return Cubic(f, x1, x2, k)
        }
        val f = UPoly.ints(listOf(0, 0, -3, 2))
        return Cubic(f, 0, 1, 6)
    }

    val yIntercept: UTemplate by lazy {
        UTemplate("k.yaxis") { lv, g ->
            val f = if (lv == 1) g.poly(degree = 2, terms = 3, coefficients = 1..6) else g.poly(degree = 3, terms = 4, coefficients = 1..7)
            val c = f.coefficient(0)
            val b = f.coefficient(1)
            if (c.isZero) return@UTemplate null
            UProblem.numeric(
                key = "k.yaxis|${f.text}", prompt = "Bei welchem y-Wert schneidet der Graph von ${UCalc.fx(f)} die y-Achse?",
                answer = c, wrongs = UCalc.differing(listOf(b, f.eval(UQ.one), f.eval(UQ(-1)), f.derivative.eval(UQ.zero)), c),
                solution = "Der Schnittpunkt mit der y-Achse liegt bei x = 0: f(0) = ${c.text}.",
                explanation = "Auf der y-Achse ist x = 0; nur das absolute Glied bleibt übrig.", fact = UFact.ValueAt(f, UQ.zero),
            )
        }
    }

    val root: UTemplate by lazy {
        UTemplate("k.root") { lv, g ->
            val roots: List<Int>
            var lead = 1
            when (lv) {
                1 -> {
                    val r1 = g.int(-5..3)
                    roots = listOf(r1, r1 + g.int(1..5))
                }
                2 -> {
                    val r1 = g.int(-5..3)
                    roots = listOf(r1, r1 + g.int(1..5))
                    lead = g.pick(listOf(2, 3, -1, -2))
                }
                else -> {
                    val set = hashSetOf(0)
                    while (set.size < 3) set.add(g.int(-4..4))
                    roots = set.sorted()
                    lead = g.pick(listOf(1, 1, 2, -1))
                }
            }
            val f = UPoly.fromRoots(UQ(lead), roots.map { UQ(it) })
            val largest = g.chance(0.5)
            val answer = UQ(if (largest) roots.last() else roots.first())
            val sum = UQ(roots.fold(0) { a, b -> a + b })
            val product = UQ(roots.fold(1) { a, b -> a * b })
            val others = roots.filter { UQ(it) != answer }.map { UQ(it) }
            val wrongs = UCalc.differing(others + listOf(sum, product, f.coefficient(0)), answer)
            val how = if (lv == 3) "Klammere x aus und löse den Rest. " else "Löse f(x) = 0. "
            UProblem.numeric(
                key = "k.root|${f.text}|$largest",
                prompt = "Bestimme die ${if (largest) "größte" else "kleinste"} Nullstelle von ${UCalc.fx(f)}.", answer = answer, wrongs = wrongs,
                solution = "${how}Die Nullstellen sind ${roots.joinToString(", ")}; die ${if (largest) "größte" else "kleinste"} ist ${answer.text}.",
                explanation = "Eine Nullstelle ist ein x mit f(x) = 0; bei einem Produkt reicht es, wenn ein Faktor null ist.",
                fact = UFact.Root(f, largest),
            )
        }
    }

    val rootTest: UTemplate by lazy {
        UTemplate("k.rootTest") { lv, g ->
            val r1 = g.int(-5..3)
            val roots = if (lv == 1) listOf(r1, r1 + g.int(1..4)) else listOf(r1, r1 + g.int(1..4), g.int(-5..5))
            val f = UPoly.fromRoots(UQ.one, roots.map { UQ(it) })
            val r = UQ(roots[0])
            val candidates = listOf(-r, r + UQ.one, r - UQ.one, UQ(roots[0] + roots[1]), f.coefficient(0), r * UQ(2))
            val wrongs = candidates.filter { f.eval(it) != UQ.zero }
            UProblem.numeric(
                key = "k.rootTest|${f.text}", prompt = "Welche Zahl ist eine Nullstelle von ${UCalc.fx(f)}?", answer = r, wrongs = wrongs,
                solution = "Setze ein: f(${r.text}) = 0. Bei den anderen Zahlen kommt nicht 0 heraus.",
                explanation = "Eine Zahl ist genau dann Nullstelle, wenn beim Einsetzen 0 herauskommt.", fact = UFact.Root(f, false), typed = false,
            )
        }
    }

    val symmetry: UTemplate by lazy {
        UTemplate("k.sym") { lv, g ->
            val want = g.pick(listOf(USymmetry.Y_AXIS, USymmetry.ORIGIN, USymmetry.NEITHER))
            var exponents: List<Int>
            when (want) {
                USymmetry.Y_AXIS -> {
                    exponents = if (lv == 1) listOf(2, 0) else listOf(4, 2, 0)
                    if (lv == 3) exponents = listOf(4, 2)
                }
                USymmetry.ORIGIN -> {
                    exponents = if (lv == 1) listOf(3, 1) else listOf(5, 3, 1)
                    if (lv == 3) exponents = listOf(3, 1)
                }
                USymmetry.NEITHER -> {
                    exponents = if (lv == 1) listOf(2, 1) else listOf(3, 2, 0)
                    if (lv == 3) exponents = listOf(4, 1)
                }
            }
            val f = UPoly.terms(exponents.map { it to UQ(g.nonzero(-5..5)) })
            val correct = when (want) {
                USymmetry.Y_AXIS -> "achsensymmetrisch zur y-Achse"
                USymmetry.ORIGIN -> "punktsymmetrisch zum Ursprung"
                USymmetry.NEITHER -> "weder noch"
            }
            val all = listOf("achsensymmetrisch zur y-Achse", "punktsymmetrisch zum Ursprung", "weder noch")
            UProblem.choice(
                key = "k.sym|${f.text}", prompt = "Wie verhält sich der Graph von ${UCalc.fx(f)}?", correct = correct, wrong = all.filter { it != correct },
                solution = "Prüfe f(−x): Nur gerade Exponenten (auch das absolute Glied) geben f(−x) = f(x); nur ungerade Exponenten geben f(−x) = −f(x). Hier: $correct.",
                explanation = "Gerade Exponenten ergeben die Symmetrie zur y-Achse, ungerade die zum Ursprung; bei einer Mischung gibt es keine.",
                fact = UFact.Symmetry(f, want),
            )
        }
    }

    val extremumX: UTemplate by lazy {
        UTemplate("k.extX") { lv, g ->
            if (lv == 1) {
                val a = g.pick(listOf(1, 2, -1, -2))
                val h = g.int(-4..4)
                val top = g.int(-5..5)
                val f = UPoly.ints(listOf(a * h * h + top, -2 * a * h, a))
                val isMax = a < 0
                val answer = UQ(h)
                val wrongs = UCalc.differing(listOf(UQ(2 * h), UQ(top), f.coefficient(0), f.coefficient(1)), answer)
                return@UTemplate UProblem.numeric(
                    key = "k.extX|${f.text}", prompt = "Bei welchem x liegt der ${if (isMax) "Hochpunkt" else "Tiefpunkt"} von ${UCalc.fx(f)}?",
                    answer = answer, wrongs = wrongs,
                    solution = "f′(x) = ${f.derivative.text} = 0 ergibt x = $h. f″ = ${2 * a} ${if (isMax) "< 0: Hochpunkt" else "> 0: Tiefpunkt"}.",
                    explanation = "Notwendig ist f′(x) = 0; das Vorzeichen von f″ zeigt, ob es ein Hoch- oder Tiefpunkt ist.",
                    fact = UFact.ExtremumX(f, isMax),
                )
            }
            val c = cubic(g)
            val isMax = g.chance(0.5)
            val answer = UQ(if (isMax) c.maxX else c.minX)
            val other = UQ(if (isMax) c.minX else c.maxX)
            val wrongs = UCalc.differing(listOf(other, UQ(c.x1 + c.x2, 2), c.f.eval(answer), c.f.coefficient(0)), answer)
            UProblem.numeric(
                key = "k.extX|${c.f.text}|$isMax", prompt = "Bei welchem x liegt der ${if (isMax) "Hochpunkt" else "Tiefpunkt"} von ${UCalc.fx(c.f)}?",
                answer = answer, wrongs = wrongs,
                solution = "f′(x) = ${c.f.derivative.text} = 0 ergibt x = ${c.x1} oder x = ${c.x2}. Mit f″(x) = ${c.f.derivative.derivative.text} prüfst du: Der ${if (isMax) "Hochpunkt" else "Tiefpunkt"} liegt bei x = ${answer.text}.",
                explanation = "Bei f″(x) < 0 liegt ein Hochpunkt vor, bei f″(x) > 0 ein Tiefpunkt.", fact = UFact.ExtremumX(c.f, isMax),
            )
        }
    }

    val extremumY: UTemplate by lazy {
        UTemplate("k.extY") { lv, g ->
            val c = cubic(g, simple = lv == 1)
            val isMax = g.chance(0.5)
            val x = UQ(if (isMax) c.maxX else c.minX)
            val answer = c.f.eval(x)
            val otherValue = c.f.eval(UQ(if (isMax) c.minX else c.maxX))
            val wrongs = UCalc.differing(listOf(x, otherValue, c.f.coefficient(0), c.f.derivative.eval(x), c.f.eval(UQ(c.x1 + c.x2, 2))), answer)
            UProblem.numeric(
                key = "k.extY|${c.f.text}|$isMax", prompt = "Welchen y-Wert hat der ${if (isMax) "Hochpunkt" else "Tiefpunkt"} von ${UCalc.fx(c.f)}?",
                answer = answer, wrongs = wrongs,
                solution = "Die Extremstelle ist x = ${x.text} (aus f′(x) = 0 und dem Vorzeichen von f″). Einsetzen in f: f(${x.text}) = ${answer.text}.",
                explanation = "Die Extremstelle setzt du in f ein, nicht in f′: f′ ist dort null.", fact = UFact.ExtremumY(c.f, isMax),
            )
        }
    }

    val kind: UTemplate by lazy {
        UTemplate("k.kind") { lv, g ->
            val names = listOf(UExtremum.MAXIMUM to "Hochpunkt", UExtremum.MINIMUM to "Tiefpunkt", UExtremum.SADDLE to "Sattelpunkt")
            val f: UPoly
            val x: Int
            val want: UExtremum
            if (lv == 3 && g.chance(0.5)) {
                val s = g.int(-2..3)
                f = UPoly.fromRoots(UQ.one, listOf(UQ(s), UQ(s), UQ(s))) + UPoly(listOf(UQ(g.int(-4..4))))
                x = s
                want = UExtremum.SADDLE
            } else {
                val c = cubic(g)
                val atMax = g.chance(0.5)
                f = c.f
                x = if (atMax) c.maxX else c.minX
                want = if (atMax) UExtremum.MAXIMUM else UExtremum.MINIMUM
            }
            val second = f.derivative.derivative.eval(UQ(x))
            val sol = when (want) {
                UExtremum.SADDLE -> "f′(x) = ${f.derivative.text} hat bei x = $x eine doppelte Nullstelle, f′ wechselt dort das Vorzeichen nicht (f″($x) = 0). Es ist ein Sattelpunkt."
                UExtremum.MAXIMUM -> "f′($x) = 0 und f″($x) = ${second.text} < 0: Hochpunkt."
                else -> "f′($x) = 0 und f″($x) = ${second.text} > 0: Tiefpunkt."
            }
            UProblem.choice(
                key = "k.kind|${f.text}|$x", prompt = "Der Graph von ${UCalc.fx(f)} hat bei x = ${UText.signed(x)} eine waagerechte Tangente. Welcher Punkt liegt dort vor?",
                correct = names.first { it.first == want }.second, wrong = names.filter { it.first != want }.map { it.second }.sorted(), solution = sol,
                explanation = "f″ < 0 gibt einen Hochpunkt, f″ > 0 einen Tiefpunkt; bei f″ = 0 und ohne Vorzeichenwechsel von f′ ist es ein Sattelpunkt.",
                fact = UFact.KindAt(f, UQ(x), want),
            )
        }
    }

    val inflection: UTemplate by lazy {
        UTemplate("k.inflect") { lv, g ->
            val c = cubic(g, simple = lv == 1)
            val answer = UQ(c.x1 + c.x2, 2)
            val a = c.f.coefficient(3)
            val b = c.f.coefficient(2)
            val wrongs = UCalc.differing(listOf(UQ(c.x1), UQ(c.x2), c.f.eval(answer), -b / a, -b / (a * UQ(6))), answer)
            UProblem.numeric(
                key = "k.inflect|${c.f.text}", prompt = "An welcher Stelle hat der Graph von ${UCalc.fx(c.f)} seinen Wendepunkt?",
                answer = answer, wrongs = wrongs,
                solution = "f″(x) = ${c.f.derivative.derivative.text} = 0 ergibt x = ${answer.text}; f‴ ≠ 0, also liegt dort ein Wendepunkt.",
                explanation = "Eine Wendestelle erfüllt f″(x) = 0 und f‴(x) ≠ 0.", fact = UFact.InflectionX(c.f),
            )
        }
    }

    val monotone: UTemplate by lazy {
        UTemplate("k.mono") { _, g ->
            val c = cubic(g)
            val betweenRising = c.k < 0
            val askRising = g.chance(0.5)
            val between = "${UText.signed(c.x1)} < x < ${UText.signed(c.x2)}"
            val outside = "x < ${UText.signed(c.x1)} oder x > ${UText.signed(c.x2)}"
            val betweenIsAnswer = askRising == betweenRising
            val correct = if (betweenIsAnswer) between else outside
            val wrong = listOf(if (betweenIsAnswer) outside else between, "x < ${UText.signed(c.x2)}", "x > ${UText.signed(c.x1)}", "x < ${UText.signed(c.x1)}")
            UProblem.choice(
                key = "k.mono|${c.f.text}|$askRising",
                prompt = "In welchem Bereich ist ${UCalc.fx(c.f)} streng monoton ${if (askRising) "steigend" else "fallend"}?", correct = correct,
                wrong = wrong.filter { it != correct },
                solution = "f′(x) = ${c.f.derivative.text} hat die Nullstellen ${c.x1} und ${c.x2}. Zwischen ihnen ist f′ ${if (c.k > 0) "negativ" else "positiv"}, außerhalb ${if (c.k > 0) "positiv" else "negativ"}. Gesucht: $correct.",
                explanation = "Wo f′ > 0 ist, steigt der Graph, wo f′ < 0 ist, fällt er.",
                fact = UFact.Monotone(c.f, UQ(c.x1), UQ(c.x2), askRising, betweenIsAnswer),
            )
        }
    }

    val slopeMeaning: UTemplate by lazy {
        UTemplate("k.slope") { _, g ->
            val a = g.int(1..5)
            val sign = g.int(-1..1)
            val value = sign * g.int(1..4)
            val shown = UText.signed(value)
            val fall = "Der Graph fällt an der Stelle x = $a."
            val rise = "Der Graph steigt an der Stelle x = $a."
            val flat = "Der Graph hat an der Stelle x = $a eine waagerechte Tangente."
            val zero = "Der Graph hat bei x = $a eine Nullstelle."
            val valueWrong = "Der Funktionswert ist f($a) = $shown."
            val correct: String
            val wrong: List<String>
            if (sign < 0) { correct = fall; wrong = listOf(rise, zero, valueWrong) }
            else if (sign > 0) { correct = rise; wrong = listOf(fall, zero, valueWrong) }
            else { correct = flat; wrong = listOf(rise, fall, zero) }
            val statement = if (sign == 0) "f′($a) = 0" else "f′($a) = $shown"
            UProblem.choice(
                key = "k.slope|$a|$sign|$value", prompt = "Für eine Funktion f gilt $statement. Was folgt daraus?", correct = correct, wrong = wrong,
                solution = "f′ gibt die Steigung an: $statement bedeutet: $correct",
                explanation = "Das Vorzeichen von f′ sagt, ob der Graph steigt (+) oder fällt (−); f′ = 0 heißt waagerechte Tangente.", fact = UFact.Concept,
            )
        }
    }
}
