package de.maxifrz.lernwerk.learn.math.upper

/** Unit 7: stochastics (Laplace, binomial coefficient, binomial distribution, expectation, conditional probability). */
object MathUpperUnit07 {
    val templates: List<UTemplate> by lazy {
        listOf(dice, urn, choose, binomialEqual, binomialCumulative, expectation, table, conditional, independence, bayes)
    }

    const val germanTwoDecimals = "(Antworte als Bruch oder Dezimalzahl.)"

    /** A probability question: typed as a fraction or decimal, chosen from the same forms. */
    fun probability(key: String, prompt: String, answer: UQ, wrongs: List<UQ>, solution: String, explanation: String, fact: UFact): UProblem? =
        UProblem.numeric(
            key = key, prompt = prompt, hint = germanTwoDecimals, answer = answer, wrongs = wrongs.filter { it >= UQ.zero && it <= UQ.one },
            solution = solution + " Ergebnis: ${answer.fraction}${if (answer.isInt || answer.fraction == answer.typed) "" else " = ${answer.text}"}.",
            explanation = explanation, fact = fact,
        )

    fun binomial(n: Int, k: Int): Int {
        if (!(k >= 0 && k <= n)) return 0
        var result = 1
        if (k > 0) for (i in 1..maxOf(k, 1)) result = result * (n - k + i) / i
        return result
    }

    fun pmf(n: Int, p: UQ, k: Int): UQ = UQ(binomial(n, k)) * p.power(k) * (UQ.one - p).power(n - k)

    // Laplace

    private sealed class DiceKind {
        class Single(val s: Int) : DiceKind()
        class AtLeast(val s: Int) : DiceKind()
        class AtMost(val s: Int) : DiceKind()
        object Even : DiceKind()
        class DoubleOrSum(val s: Int) : DiceKind()
    }

    val dice: UTemplate by lazy {
        UTemplate("s.dice") { lv, g ->
            val kind: DiceKind = when (lv) {
                1 -> DiceKind.Single(g.pick(listOf(2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)))
                2 -> {
                    val options = listOf<DiceKind>(DiceKind.AtLeast(g.int(9..11)), DiceKind.AtMost(g.int(3..5)), DiceKind.Single(7))
                    g.pick(options)
                }
                else -> {
                    val options = listOf<DiceKind>(DiceKind.Even, DiceKind.DoubleOrSum(g.int(2..3)), DiceKind.AtLeast(g.int(7..8)))
                    g.pick(options)
                }
            }
            val sums: List<Int>
            val text: String
            when (kind) {
                is DiceKind.Single -> { sums = listOf(kind.s); text = "die Augensumme ${kind.s} ist" }
                is DiceKind.AtLeast -> { sums = (kind.s..12).toList(); text = "die Augensumme mindestens ${kind.s} ist" }
                is DiceKind.AtMost -> { sums = (2..kind.s).toList(); text = "die Augensumme höchstens ${kind.s} ist" }
                DiceKind.Even -> { sums = listOf(2, 4, 6, 8, 10, 12); text = "die Augensumme gerade ist" }
                is DiceKind.DoubleOrSum -> { sums = listOf(kind.s, 14 - kind.s); text = "die Augensumme ${kind.s} oder ${14 - kind.s} ist" }
            }
            var count = 0
            for (x in 1..6) for (y in 1..6) if (sums.contains(x + y)) count += 1
            val answer = UQ(count, 36)
            val wrongs = listOf(UQ(sums.size, 11), UQ(count, 12), UQ(count + 1, 36), UQ(count - 1, 36), UQ(sums.size, 36), UQ(count, 6))
            probability(
                key = "s.dice|$sums", prompt = "Zwei faire Würfel werden geworfen. Wie groß ist die Wahrscheinlichkeit, dass $text?", answer = answer, wrongs = wrongs,
                solution = "Laplace: günstige Fälle durch mögliche Fälle. Es gibt 6·6 = 36 gleich wahrscheinliche Paare, davon $count günstige: $count/36.",
                explanation = "Die Augensummen sind nicht gleich wahrscheinlich; zähle die Würfelpaare, nicht die Summen.", fact = UFact.LaplaceDice(sums),
            )
        }
    }

    val urn: UTemplate by lazy {
        UTemplate("s.urn") { lv, g ->
            val red = g.int(2..6)
            val blue = g.int(2..6)
            val n = red + blue
            val mode: UUrn = if (lv == 1) UUrn.ONE_RED else (if (lv == 2) UUrn.TWO_RED_WITH else g.pick(listOf(UUrn.TWO_RED_WITHOUT, UUrn.DIFFERENT_WITHOUT)))
            val answer: UQ
            val wrongs: List<UQ>
            val prompt: String
            val solution: String
            val r = UQ(red, n)
            when (mode) {
                UUrn.ONE_RED -> {
                    answer = r
                    wrongs = listOf(UQ(red, blue), UQ(blue, n), UQ(1, n), UQ(red, 2 * n))
                    prompt = "In einer Urne liegen $red rote und $blue blaue Kugeln. Wie groß ist die Wahrscheinlichkeit, eine rote Kugel zu ziehen?"
                    solution = "$red günstige von $n möglichen Kugeln."
                }
                UUrn.TWO_RED_WITH -> {
                    answer = r * r
                    wrongs = listOf(r + r, UQ(red, n) * UQ(red - 1, n - 1), UQ(2 * red, n), UQ(red * red, n))
                    prompt = "In einer Urne liegen $red rote und $blue blaue Kugeln. Du ziehst zwei Kugeln mit Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zweimal rot?"
                    solution = "Mit Zurücklegen bleibt die Urne gleich: $red/$n · $red/$n."
                }
                UUrn.TWO_RED_WITHOUT -> {
                    answer = r * UQ(red - 1, n - 1)
                    wrongs = listOf(r * r, UQ(red - 1, n - 1), r + UQ(red - 1, n - 1), UQ(red * (red - 1), n * n))
                    prompt = "In einer Urne liegen $red rote und $blue blaue Kugeln. Du ziehst zwei Kugeln ohne Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zweimal rot?"
                    solution = "Beim zweiten Zug sind nur noch ${red - 1} rote unter ${n - 1} Kugeln: $red/$n · ${red - 1}/${n - 1}."
                }
                UUrn.DIFFERENT_WITHOUT -> {
                    answer = UQ(2 * red * blue, n * (n - 1))
                    wrongs = listOf(r * UQ(blue, n - 1), UQ(red * blue, n * n), UQ(2 * red * blue, n * n), UQ(blue, n - 1))
                    prompt = "In einer Urne liegen $red rote und $blue blaue Kugeln. Du ziehst zwei Kugeln ohne Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zwei verschiedene Farben?"
                    solution = "Rot dann blau oder blau dann rot: 2 · $red/$n · $blue/${n - 1}."
                }
            }
            probability(
                key = "s.urn|$red|$blue|${mode.swiftName}", prompt = prompt, answer = answer, wrongs = wrongs, solution = solution,
                explanation = "Ohne Zurücklegen ändern sich Zähler und Nenner nach dem ersten Zug; mit Zurücklegen nicht.", fact = UFact.Urn(red, blue, mode),
            )
        }
    }

    val choose: UTemplate by lazy {
        UTemplate("s.choose", pairs = { _, g ->
            val items = mutableListOf<UPairItem>()
            val fronts = hashSetOf<String>()
            val backs = hashSetOf<Int>()
            var i = 0
            while (i < 80 && items.size < 4) {
                i += 1
                val n = g.int(4..9)
                val k = g.int(1..(n - 1))
                val value = binomial(n, k)
                if (fronts.add("${minOf(k, n - k)}|$n") && backs.add(value)) items.add(UPairItem("$n über $k", "$value"))
            }
            if (items.size == 4) items else null
        }) { lv, g ->
            val n = g.int(if (lv == 1) 3..6 else (if (lv == 2) 5..9 else 8..12))
            val k = if (lv == 1) g.int(1..2) else g.int(0..n)
            val value = binomial(n, k)
            var falling = 1
            for (i in 0 until k) falling *= n - i
            val wrongs = UCalc.differing(
                listOf(UQ(n * k), UQ(binomial(n, k + 1)), UQ(binomial(n + 1, k)), UQ(falling), UQ(binomial(n, k - 1)), UQ(n - k)), UQ(value),
            )
            UProblem.numeric(
                key = "s.choose|$n|$k", prompt = "Berechne $n über $k.", answer = UQ(value), wrongs = wrongs,
                solution = "$n über $k = $n!/($k!·${n - k}!) = $value. Probe mit der Symmetrie: $n über ${n - k} ist ebenfalls $value.",
                explanation = "n über k zählt, auf wie viele Arten man k aus n auswählt, ohne auf die Reihenfolge zu achten: Es gilt (n über k) = (n über n−k).",
                fact = UFact.Choose(n, k),
            )
        }
    }

    // Binomial distribution

    fun parameters(g: UGen, level: Int): Pair<Int, UQ> = when (level) {
        1 -> Pair(g.int(3..4), UQ(1, 2))
        2 -> {
            val n = g.int(3..5)
            Pair(n, g.pick(listOf(UQ(1, 2), UQ(1, 10), UQ(1, 5), UQ(1, 4))))
        }
        else -> {
            val n = g.int(4..6)
            Pair(n, g.pick(listOf(UQ(3, 10), UQ(1, 5), UQ(1, 4), UQ(7, 10), UQ(3, 4), UQ(2, 5))))
        }
    }

    fun percentText(p: UQ): String = p.text

    val binomialEqual: UTemplate by lazy {
        UTemplate("s.pmf") { lv, g ->
            val (n, p) = parameters(g, lv)
            val k = if (lv == 1) g.pick(listOf(0, n)) else g.int(0..n)
            val q = UQ.one - p
            val answer = pmf(n, p, k)
            val wrongs = listOf(
                p.power(k) * q.power(n - k), p.power(k), UQ(binomial(n, k)) * p.power(k), UQ(binomial(n, k)) * q.power(k) * p.power(n - k),
                UQ(binomial(n, k)) * p.power(k) * q.power(n - k + 1), UQ(binomial(n, k), 2) * p.power(k),
            )
            probability(
                key = "s.pmf|$n|${p.fraction}|$k", prompt = "X ist binomialverteilt mit n = $n und p = ${p.text}. Berechne P(X = $k).", answer = answer, wrongs = wrongs,
                solution = "P(X = $k) = ($n über $k) · ${p.fraction}^$k · ${q.fraction}^${n - k} = ${binomial(n, k)} · ${p.power(k).fraction} · ${q.power(n - k).fraction}.",
                explanation = "Bernoulli-Formel: P(X = k) = (n über k) · pᵏ · (1−p)ⁿ⁻ᵏ; der Binomialkoeffizient zählt die Anordnungen der Treffer.",
                fact = UFact.Binomial(n, p, UBinom.Equal(k)),
            )
        }
    }

    val binomialCumulative: UTemplate by lazy {
        UTemplate("s.cum") { lv, g ->
            val (n, p) = parameters(g, maxOf(lv, 2))
            val q = UQ.one - p
            val k = g.int(1..(n - 1))
            val variants = if (lv == 1) 1 else 3
            val variant = g.int(0..variants)
            val answer: UQ
            val text: String
            val wrongs: List<UQ>
            val kind: UBinom
            fun sum(range: IntRange): UQ = range.fold(UQ.zero) { acc, i -> acc + pmf(n, p, i) }
            when (variant) {
                0 -> {
                    answer = sum(0..k); text = "P(X ≤ $k)"; kind = UBinom.AtMost(k)
                    wrongs = listOf(pmf(n, p, k), sum(0..(k - 1)), UQ.one - sum(0..k), sum(0..(k + 1)))
                }
                1 -> {
                    answer = UQ.one - q.power(n); text = "die Wahrscheinlichkeit für mindestens einen Treffer"; kind = UBinom.AtLeastOne
                    wrongs = listOf(p.power(n), q.power(n), UQ(n) * p, UQ.one - p.power(n))
                }
                2 -> {
                    answer = sum(k..n); text = "P(X ≥ $k)"; kind = UBinom.AtLeast(k)
                    wrongs = listOf(UQ.one - sum(0..k), sum(0..k), pmf(n, p, k), sum((k + 1)..n))
                }
                else -> {
                    answer = sum(0..(k - 1)); text = "P(X < $k)"; kind = UBinom.AtMost(k - 1)
                    wrongs = listOf(sum(0..k), pmf(n, p, k), UQ.one - sum(0..(k - 1)), pmf(n, p, k - 1))
                }
            }
            val sol = when (variant) {
                1 -> "Gegenereignis: 1 − P(kein Treffer) = 1 − ${q.fraction}^$n."
                2 -> "P(X ≥ $k) = 1 − P(X ≤ ${k - 1}) oder die Summe von P(X = $k) bis P(X = $n)."
                3 -> "P(X < $k) = P(X ≤ ${k - 1}): addiere P(X = 0) bis P(X = ${k - 1})."
                else -> "Addiere P(X = 0) bis P(X = $k)."
            }
            probability(
                key = "s.cum|$n|${p.fraction}|$k|$variant",
                prompt = if (variant == 1) "Bei einem Zufallsversuch mit p = ${p.text} wird $n-mal unabhängig wiederholt. Wie groß ist $text?"
                else "X ist binomialverteilt mit n = $n und p = ${p.text}. Berechne $text.",
                answer = answer, wrongs = wrongs, solution = sol,
                explanation = "Bei „höchstens“ addierst du die Einzelwahrscheinlichkeiten; bei „mindestens“ ist oft das Gegenereignis kürzer.",
                fact = UFact.Binomial(n, p, kind),
            )
        }
    }

    val expectation: UTemplate by lazy {
        UTemplate("s.expect") { lv, g ->
            if (lv == 1) {
                val p = g.pick(listOf(UQ(1, 2), UQ(1, 4), UQ(1, 5), UQ(1, 10), UQ(3, 10)))
                val n = p.d.toInt() * g.int(1..6)
                val answer = UQ(n) * p
                return@UTemplate UProblem.numeric(
                    key = "s.expect|np|$n|${p.fraction}", prompt = "X ist binomialverteilt mit n = $n und p = ${p.text}. Wie groß ist der Erwartungswert E(X)?", answer = answer,
                    wrongs = UCalc.differing(listOf(UQ(n) / p, UQ(n) + p, UQ(n) * (UQ.one - p), p), answer),
                    solution = "E(X) = n·p = $n·${p.fraction} = ${answer.fraction}.", explanation = "Bei einer Binomialverteilung ist der Erwartungswert n·p.",
                    fact = UFact.Expectation(n, p),
                )
            }
            if (lv == 2) {
                val values = listOf(g.int(-3..0), g.int(1..4), g.int(5..10))
                val tenths = listOf(g.int(1..5), g.int(1..4))
                val last = 10 - tenths[0] - tenths[1]
                if (!(last >= 1)) return@UTemplate null
                val probabilities = listOf(UQ(tenths[0], 10), UQ(tenths[1], 10), UQ(last, 10))
                val answer = values.indices.fold(UQ.zero) { acc, i -> acc + UQ(values[i]) * probabilities[i] }
                val table = values.indices.joinToString("; ") { "P(X = ${UText.signed(values[it])}) = ${probabilities[it].text}" }
                val wrongs = listOf(UQ(values.fold(0) { s, x -> s + x }, 3), UQ(values.maxOrNull() ?: 0), UQ(values[0]) * probabilities[0] + UQ(values[1]) * probabilities[1])
                return@UTemplate UProblem.numeric(
                    key = "s.expect|table|$values|$tenths", prompt = "Eine Zufallsgröße X hat die Verteilung $table. Berechne E(X).", answer = answer,
                    wrongs = UCalc.differing(wrongs, answer),
                    solution = "E(X) = Σ x · P(X = x) = ${values.indices.joinToString(" + ") { "${UCalc3.bracket(values[it])}·${probabilities[it].text}" }} = ${answer.text}.",
                    explanation = "Der Erwartungswert ist die mit den Wahrscheinlichkeiten gewichtete Summe aller Werte.",
                    fact = UFact.ExpectationTable(values.map { UQ(it) }, probabilities),
                )
            }
            for (attempt in 0 until 200) {
                val p = g.pick(listOf(UQ(1, 2), UQ(1, 5), UQ(1, 4), UQ(3, 10), UQ(1, 10), UQ(3, 4), UQ(4, 5)))
                val n = g.int(4..200)
                val variance = UQ(n) * p * (UQ.one - p)
                val root = squareRoot(variance) ?: continue
                return@UTemplate UProblem.numeric(
                    key = "s.expect|sigma|$n|${p.fraction}", prompt = "X ist binomialverteilt mit n = $n und p = ${p.text}. Berechne die Standardabweichung σ.", answer = root,
                    wrongs = UCalc.differing(listOf(variance, UQ(n) * p, UQ(n) * (UQ.one - p), root * UQ(2)), root),
                    solution = "σ = √(n·p·(1−p)) = √(${variance.fraction}) = ${root.fraction}.",
                    explanation = "Die Standardabweichung der Binomialverteilung ist √(n·p·(1−p)); ohne die Wurzel hättest du die Varianz.",
                    fact = UFact.Sigma(n, p),
                )
            }
            null
        }
    }

    fun squareRoot(q: UQ): UQ? {
        fun isqrt(n: Long): Long? {
            if (n < 0) return null
            val r = Math.round(Math.sqrt(n.toDouble()))
            return if (r * r == n) r else null
        }
        val top = isqrt(q.n) ?: return null
        val bottom = isqrt(q.d) ?: return null
        return UQ(top, bottom)
    }

    // Conditional probability

    fun randomTable(g: UGen): UTable? {
        val total = g.pick(listOf(100, 100, 200, 1000))
        for (attempt in 0 until 100) {
            val step = total / 20
            val cells = (0 until 3).map { g.int(1..6) * step }
            val rest = total - cells.fold(0) { s, x -> s + x }
            if (rest >= step) return UTable(cells[0], cells[1], cells[2], rest)
        }
        return null
    }

    fun value(t: UTable, ask: UAsk): UQ {
        val n = t.total
        return when (ask) {
            UAsk.P_A -> UQ(t.a + t.b, n)
            UAsk.P_B -> UQ(t.a + t.c, n)
            UAsk.P_A_AND_B -> UQ(t.a, n)
            UAsk.P_A_OR_B -> UQ(t.a + t.b + t.c, n)
            UAsk.P_NOT_A_AND_B -> UQ(t.c, n)
            UAsk.P_NOT_A_AND_NOT_B -> UQ(t.d, n)
            UAsk.P_A_GIVEN_B -> UQ(t.a, t.a + t.c)
            UAsk.P_B_GIVEN_A -> UQ(t.a, t.a + t.b)
            UAsk.P_NOT_B_GIVEN_A -> UQ(t.b, t.a + t.b)
        }
    }

    fun given(t: UTable): String =
        "P(A) = ${value(t, UAsk.P_A).text}, P(B) = ${value(t, UAsk.P_B).text}, P(A∩B) = ${value(t, UAsk.P_A_AND_B).text}"

    val table: UTemplate by lazy {
        UTemplate("s.table") { _, g ->
            val t = randomTable(g) ?: return@UTemplate null
            val ask = g.pick(listOf(UAsk.P_A_OR_B, UAsk.P_NOT_A_AND_B, UAsk.P_NOT_A_AND_NOT_B))
            val answer = value(t, ask)
            val name: String
            val wrong: List<UQ>
            val how: String
            val pA = value(t, UAsk.P_A)
            val pB = value(t, UAsk.P_B)
            val pAB = value(t, UAsk.P_A_AND_B)
            when (ask) {
                UAsk.P_A_OR_B -> {
                    name = "P(A∪B)"; wrong = listOf(pA + pB, pAB, pA * pB, UQ.one - pAB)
                    how = "P(A∪B) = P(A) + P(B) − P(A∩B)."
                }
                UAsk.P_NOT_A_AND_B -> {
                    name = "P(¬A∩B)"; wrong = listOf(UQ.one - pA, pB, pAB, pB + pAB)
                    how = "P(¬A∩B) = P(B) − P(A∩B)."
                }
                else -> {
                    name = "P(¬A∩¬B)"; wrong = listOf(UQ.one - pA - pB, value(t, UAsk.P_A_OR_B), (UQ.one - pA) * (UQ.one - pB), UQ.one - pAB)
                    how = "P(¬A∩¬B) = 1 − P(A∪B)."
                }
            }
            probability(
                key = "s.table|${t.a}|${t.b}|${t.c}|${ask.swiftName}", prompt = "Für zwei Ereignisse gilt ${given(t)}. Wie groß ist $name?", answer = answer, wrongs = wrong,
                solution = "$how Mit der Vierfeldertafel: ${answer.text}.",
                explanation = "Eine Vierfeldertafel ordnet alle vier Zellen A∩B, A∩¬B, ¬A∩B, ¬A∩¬B; Zeilen- und Spaltensummen liefern die fehlenden Werte.",
                fact = UFact.Table(t, ask),
            )
        }
    }

    val conditional: UTemplate by lazy {
        UTemplate("s.cond") { lv, g ->
            for (attempt in 0 until 100) {
                val t = randomTable(g) ?: continue
                val ask = g.pick(if (lv == 3) listOf(UAsk.P_A_GIVEN_B, UAsk.P_B_GIVEN_A, UAsk.P_NOT_B_GIVEN_A) else listOf(UAsk.P_A_GIVEN_B, UAsk.P_B_GIVEN_A))
                val answer = value(t, ask)
                if (!(answer.isNice && !(ask == UAsk.P_A_GIVEN_B && answer == value(t, UAsk.P_B_GIVEN_A)))) continue
                val name: String
                val wrong: List<UQ>
                val how: String
                val pA = value(t, UAsk.P_A)
                val pB = value(t, UAsk.P_B)
                val pAB = value(t, UAsk.P_A_AND_B)
                when (ask) {
                    UAsk.P_A_GIVEN_B -> {
                        name = "P(A|B)"; how = "P(A|B) = P(A∩B) / P(B) = ${pAB.text} / ${pB.text}."
                        wrong = listOf(pAB, value(t, UAsk.P_B_GIVEN_A), pA, pA * pB)
                    }
                    UAsk.P_B_GIVEN_A -> {
                        name = "P(B|A)"; how = "P(B|A) = P(A∩B) / P(A) = ${pAB.text} / ${pA.text}."
                        wrong = listOf(pAB, value(t, UAsk.P_A_GIVEN_B), pB, pA * pB)
                    }
                    else -> {
                        name = "P(¬B|A)"; how = "P(¬B|A) = 1 − P(B|A) = 1 − ${value(t, UAsk.P_B_GIVEN_A).text}."
                        wrong = listOf(value(t, UAsk.P_B_GIVEN_A), pAB, pA - pAB, UQ.one - value(t, UAsk.P_A_GIVEN_B))
                    }
                }
                return@UTemplate probability(
                    key = "s.cond|${t.a}|${t.b}|${t.c}|${ask.swiftName}", prompt = "Für zwei Ereignisse gilt ${given(t)}. Wie groß ist $name?", answer = answer, wrongs = wrong,
                    solution = how, explanation = "Die bedingte Wahrscheinlichkeit teilt P(A∩B) durch die Wahrscheinlichkeit der Bedingung; P(A∩B) und P(A|B) sind verschiedene Größen.",
                    fact = UFact.Table(t, ask),
                )
            }
            null
        }
    }

    const val independent = "Ja, denn P(A∩B) = P(A)·P(B)."
    const val greater = "Nein, denn P(A∩B) ist größer als P(A)·P(B)."
    const val smaller = "Nein, denn P(A∩B) ist kleiner als P(A)·P(B)."

    /** A table in which A and B are independent: percentages of A and B whose product is a whole percentage. */
    fun independentTable(g: UGen): UTable? {
        val shares = listOf(20, 25, 40, 50, 60, 80)
        for (attempt in 0 until 100) {
            val pa = g.pick(shares)
            val pb = g.pick(shares)
            if ((pa * pb) % 100 != 0) continue
            val both = pa * pb / 100
            val t = UTable(both, pa - both, pb - both, 100 - pa - pb + both)
            if (t.a > 0 && t.b > 0 && t.c > 0 && t.d > 0) return t
        }
        return null
    }

    val independence: UTemplate by lazy {
        UTemplate("s.indep") { _, g ->
            var made: UTable? = null
            if (g.chance(0.4)) made = independentTable(g)
            if (made == null) made = randomTable(g)
            val t = made ?: return@UTemplate null
            val pA = value(t, UAsk.P_A)
            val pB = value(t, UAsk.P_B)
            val both = value(t, UAsk.P_A_AND_B)
            val product = pA * pB
            val correct = if (both == product) independent else (if (both > product) greater else smaller)
            UProblem.choice(
                key = "s.indep|${t.a}|${t.b}|${t.c}", prompt = "Für zwei Ereignisse gilt ${given(t)}. Sind A und B stochastisch unabhängig?", correct = correct,
                wrong = listOf(independent, greater, smaller).filter { it != correct },
                solution = "P(A)·P(B) = ${pA.text}·${pB.text} = ${product.text} und P(A∩B) = ${both.text}. $correct",
                explanation = "A und B sind genau dann unabhängig, wenn P(A∩B) = P(A)·P(B) gilt.", fact = UFact.Independence(t),
            )
        }
    }

    val bayes: UTemplate by lazy {
        UTemplate("s.bayes") { lv, g ->
            for (attempt in 0 until 300) {
                val pA = g.pick(listOf(UQ(1, 10), UQ(1, 5), UQ(1, 4), UQ(2, 5), UQ(1, 2)))
                val pBA = g.pick(listOf(UQ(1, 2), UQ(4, 5), UQ(9, 10), UQ(3, 4)))
                val pBn = g.pick(listOf(UQ(1, 10), UQ(1, 5), UQ(1, 20), UQ(3, 10)))
                val total = 1000
                val counts = listOf(pA * pBA, pA * (UQ.one - pBA), (UQ.one - pA) * pBn, (UQ.one - pA) * (UQ.one - pBn)).map { it * UQ(total) }
                if (!counts.all { it.isInt }) continue
                val t = UTable(counts[0].n.toInt(), counts[1].n.toInt(), counts[2].n.toInt(), counts[3].n.toInt())
                val askPosterior = lv == 3
                val answer = value(t, if (askPosterior) UAsk.P_A_GIVEN_B else UAsk.P_B)
                if (!answer.isNice) continue
                val wrongs: List<UQ> = if (askPosterior) listOf(pBA, pA * pBA, pA, value(t, UAsk.P_B), pBA / value(t, UAsk.P_B))
                else listOf(pA * pBA, pBA + pBn, pBn, (pBA + pBn) / UQ(2))
                return@UTemplate probability(
                    key = "s.bayes|${pA.fraction}|${pBA.fraction}|${pBn.fraction}|$askPosterior",
                    prompt = "Im Baumdiagramm gilt P(A) = ${pA.text}, P(B|A) = ${pBA.text} und P(B|¬A) = ${pBn.text}. ${if (askPosterior) "Wie groß ist P(A|B)?" else "Wie groß ist P(B)?"}",
                    answer = answer, wrongs = wrongs,
                    solution = if (askPosterior) "Auf 1000 Fälle: ${t.a} mit A und B, ${t.c} mit ¬A und B. P(A|B) = ${t.a}/${t.a + t.c}."
                    else "Totale Wahrscheinlichkeit: P(B) = P(A)·P(B|A) + P(¬A)·P(B|¬A) = ${t.a + t.c}/1000.",
                    explanation = if (askPosterior) "Die gesuchte Wahrscheinlichkeit P(A|B) ist der Anteil von A unter allen Fällen, in denen B eintritt, nicht P(B|A)."
                    else "Alle Pfade, die zu B führen, addierst du; jeder Pfad ist das Produkt seiner Wahrscheinlichkeiten.",
                    fact = UFact.Table(t, if (askPosterior) UAsk.P_A_GIVEN_B else UAsk.P_B),
                )
            }
            null
        }
    }
}
