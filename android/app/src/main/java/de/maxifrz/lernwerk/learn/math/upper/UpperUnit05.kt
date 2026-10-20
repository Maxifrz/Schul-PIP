package de.maxifrz.lernwerk.learn.math.upper

/** Unit 5: trigonometry (radians, exact values, derivative of sin and cos, period and amplitude). */
object MathUpperUnit05 {
    val templates: List<UTemplate> by lazy {
        listOf(
            degreesToRadians, radiansToDegrees, exactValue, quadrantSign, pythagoras, derivative, derivativeAt, solveInQuadrant,
            period, amplitude, zeros, integral,
        )
    }

    // Exact values

    enum class Magnitude(val text: String) {
        ZERO("0"), HALF("1/2"), ROOT2_OVER2("√2/2"), ROOT3_OVER2("√3/2"), ONE("1"), ROOT3("√3"), ROOT3_OVER3("√3/3");

        val rational: UQ?
            get() = when (this) {
                ZERO -> UQ.zero
                HALF -> UQ(1, 2)
                ONE -> UQ.one
                else -> null
            }
    }

    class Exact(val negative: Boolean, val magnitude: Magnitude) {
        val text: String get() = (if (negative && magnitude != Magnitude.ZERO) "−" else "") + magnitude.text
        val rational: UQ?
            get() {
                val q = magnitude.rational ?: return null
                return if (negative) -q else q
            }
    }

    /** The exact value for angles whose reference angle is 0, 30, 45, 60 or 90 degrees; null where it is undefined. */
    fun exact(fn: String, degrees: Int): Exact? {
        val d = ((degrees % 360) + 360) % 360
        val reference: Int
        val quadrant: Int
        if (d <= 90) { reference = d; quadrant = 1 }
        else if (d <= 180) { reference = 180 - d; quadrant = 2 }
        else if (d <= 270) { reference = d - 180; quadrant = 3 }
        else { reference = 360 - d; quadrant = 4 }
        val sinMag = mapOf(0 to Magnitude.ZERO, 30 to Magnitude.HALF, 45 to Magnitude.ROOT2_OVER2, 60 to Magnitude.ROOT3_OVER2, 90 to Magnitude.ONE)
        val cosMag = mapOf(0 to Magnitude.ONE, 30 to Magnitude.ROOT3_OVER2, 45 to Magnitude.ROOT2_OVER2, 60 to Magnitude.HALF, 90 to Magnitude.ZERO)
        val tanMag = mapOf(0 to Magnitude.ZERO, 30 to Magnitude.ROOT3_OVER3, 45 to Magnitude.ONE, 60 to Magnitude.ROOT3)
        val sinNegative = quadrant >= 3
        val cosNegative = quadrant == 2 || quadrant == 3
        return when (fn) {
            "sin" -> sinMag[reference]?.let { Exact(sinNegative, it) }
            "cos" -> cosMag[reference]?.let { Exact(cosNegative, it) }
            else -> tanMag[reference]?.let { Exact(sinNegative != cosNegative, it) }
        }
    }

    fun angleText(degrees: Int, radians: Boolean): String =
        if (radians) UText.piMultiple(UQ(degrees, 180)) else "${UText.signed(degrees)}°"

    /** A question whose right answer is a multiple of pi: typed as the factor, chosen as "π/3". */
    fun piProblem(key: String, prompt: String, answer: UQ, wrongs: List<UQ>, solution: String, explanation: String, fact: UFact): UProblem? {
        val correct = UText.piMultiple(answer)
        val texts = wrongs.filter { it != answer }.map { UText.piMultiple(it) }
        return UProblem(
            key = key, prompt = prompt, hint = "(Antworte mit dem Faktor vor π, zum Beispiel π/2 als 0,5.)", number = answer, correct = correct,
            wrong = UProblem.cleaned(texts, correct), solution = solution, explanation = explanation, fact = fact,
        )
    }

    // Templates

    val degreesToRadians: UTemplate by lazy {
        UTemplate("t.rad", pairs = { _, g ->
            val items = mutableListOf<UPairItem>()
            val used = hashSetOf<Int>()
            var i = 0
            while (i < 60 && items.size < 4) {
                i += 1
                val d = g.pick(listOf(30, 45, 60, 90, 120, 135, 150, 180, 270, 360))
                if (used.add(d)) items.add(UPairItem("$d°", UText.piMultiple(UQ(d, 180))))
            }
            if (items.size == 4) items else null
        }) { lv, g ->
            val options: List<Int> = if (lv == 1) listOf(180, 90, 60, 30, 45, 360, 270)
            else (if (lv == 2) listOf(120, 135, 150, 210, 225, 240, 300, 315) else listOf(330, 75, 15, 105, 165, 20, 40, 72))
            val d = g.pick(options)
            val answer = UQ(d, 180)
            val wrongs = listOf(UQ(d, 360), UQ(180, d), UQ(d), UQ(d, 90), UQ(d, 270))
            piProblem(
                key = "t.rad|$d", prompt = "Rechne $d° ins Bogenmaß um.", answer = answer, wrongs = wrongs,
                solution = "Bogenmaß = Gradmaß · π/180: $d·π/180 = ${UText.piMultiple(answer)}.",
                explanation = "180° entsprechen π; also multiplizierst du das Gradmaß mit π/180.", fact = UFact.DegreesToPi(d),
            )
        }
    }

    val radiansToDegrees: UTemplate by lazy {
        UTemplate("t.deg") { lv, g ->
            val d = g.pick(if (lv == 1) listOf(180, 90, 60, 45, 30, 360) else (if (lv == 2) listOf(120, 135, 150, 270, 225, 300) else listOf(210, 240, 330, 315, 75, 15)))
            val q = UQ(d, 180)
            val wrongs = listOf(UQ(d) / UQ(2), UQ(2 * d), UQ(d, 360) * UQ(180), UQ(360 - d))
            UProblem.numeric(
                key = "t.deg|$d", prompt = "Wie viel Grad sind ${UText.piMultiple(q)}?", answer = UQ(d), wrongs = UCalc.differing(wrongs, UQ(d)),
                solution = "Gradmaß = Bogenmaß · 180°/π: ${UText.piMultiple(q)} entspricht $d°.",
                explanation = "π entspricht 180°; setze für π also 180° ein.", fact = UFact.Approx(q.double * 180),
            )
        }
    }

    val exactValue: UTemplate by lazy {
        UTemplate("t.exact") { lv, g ->
            val fn = g.pick(if (lv == 1) listOf("sin", "cos") else listOf("sin", "cos", "tan"))
            val angles: List<Int> = if (lv == 1) listOf(0, 30, 45, 60, 90)
            else (if (lv == 2) listOf(0, 30, 45, 60, 90) else listOf(120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360))
            val degrees = g.pick(angles)
            val value = exact(fn, degrees) ?: return@UTemplate null
            val radians = lv >= 2 && g.chance(0.5)
            val angle = angleText(degrees, radians)
            val candidates = mutableListOf<Exact?>()
            for (other in listOf("sin", "cos", "tan")) if (other != fn) candidates.add(exact(other, degrees))
            candidates.add(exact(fn, 90 - degrees))
            candidates.add(exact(fn, 180 - degrees))
            candidates.add(exact(if (fn == "sin") "cos" else "sin", 90 - degrees))
            val wrongTexts = candidates.filterNotNull().map { it.text }
            val sol = "$fn($angle) = ${value.text}. Merke die Werte für 0°, 30°, 45°, 60°, 90° und beachte das Vorzeichen im Quadranten."
            val expl = "Die Tabelle der Winkel 0°, 30°, 45°, 60°, 90° gilt für sin, cos und tan; andere Winkel führst du mit dem Bezugswinkel und dem Vorzeichen des Quadranten darauf zurück."
            val prompt = "Gib den exakten Wert von $fn($angle) an."
            val q = value.rational
            if (q != null) {
                val correct = q.fractionDisplay
                return@UTemplate UProblem(
                    key = "t.exact|$fn|$degrees|$radians", prompt = prompt, hint = "(Antworte als Zahl.)", number = q, correct = correct,
                    wrong = UProblem.cleaned(wrongTexts, correct), solution = sol, explanation = expl, fact = UFact.TrigValue(fn, degrees),
                )
            }
            UProblem.choice(
                key = "t.exact|$fn|$degrees|$radians", prompt = prompt, correct = value.text, wrong = wrongTexts, solution = sol,
                explanation = expl, fact = UFact.TrigValue(fn, degrees),
            )
        }
    }

    val quadrantSign: UTemplate by lazy {
        UTemplate("t.sign") { _, g ->
            val fn = g.pick(listOf("sin", "cos", "tan"))
            val degrees = g.pick(listOf(120, 135, 150, 210, 225, 240, 300, 315, 330, 180, 270, 90))
            val value = exact(fn, degrees) ?: return@UTemplate null
            val correct = if (value.magnitude == Magnitude.ZERO) "null" else (if (value.negative) "negativ" else "positiv")
            val angle = angleText(degrees, g.chance(0.5))
            UProblem.choice(
                key = "t.sign|$fn|$degrees", prompt = "Welches Vorzeichen hat $fn($angle)?", correct = correct,
                wrong = listOf("positiv", "negativ", "null").filter { it != correct },
                solution = "$fn($angle) = ${value.text}, also $correct.",
                explanation = "sin ist im 1. und 2. Quadranten positiv, cos im 1. und 4., tan im 1. und 3.; an den Achsen kann der Wert 0 sein.",
                fact = UFact.TrigValue(fn, degrees),
            )
        }
    }

    val pythagoras: UTemplate by lazy {
        UTemplate("t.pyth") { lv, g ->
            val triples = listOf(Triple(3, 4, 5), Triple(5, 12, 13), Triple(8, 15, 17), Triple(7, 24, 25), Triple(20, 21, 29))
            val (a, b, c) = g.pick(if (lv == 1) triples.subList(0, 2) else triples)
            val askTan = lv == 3 && g.chance(0.5)
            val s = UQ(a, c)
            val answer = if (askTan) UQ(a, b) else UQ(b, c)
            val wrongs = if (askTan) listOf(UQ(b, a), UQ(a, c), UQ(b, c), UQ(c - a, c))
            else listOf(UQ(1) - s, s * s, UQ(c, b), UQ(a, b), UQ(1) - s * s)
            UProblem.numeric(
                key = "t.pyth|$a|$c|$askTan", prompt = "Es gilt sin(x) = $a/$c mit 0° < x < 90°. Wie groß ist ${if (askTan) "tan(x)" else "cos(x)"}?",
                answer = answer, wrongs = UCalc.differing(wrongs, answer),
                solution = "sin²x + cos²x = 1, also cos²x = 1 − ${a * a}/${c * c} = ${b * b}/${c * c} und cos x = $b/$c" + (if (askTan) "; tan x = sin x / cos x = $a/$b." else "."),
                explanation = "Aus sin²x + cos²x = 1 folgt cos x = √(1 − sin²x); im 1. Quadranten ist cos x positiv.",
                fact = UFact.CosFromSin(s, askTan),
            )
        }
    }

    fun trigText(coefficient: Int, fn: String, k: UQ): String {
        val argument = if (k == UQ.one) "x" else (if (k.isInt) "${k.n}x" else "x/${k.d}")
        val head = if (coefficient == 1) "" else (if (coefficient == -1) "−" else (if (coefficient < 0) "−${-coefficient}" else "$coefficient"))
        return "$head$fn($argument)"
    }

    val derivative: UTemplate by lazy {
        UTemplate("t.deriv") { lv, g ->
            val fn = g.pick(listOf("sin", "cos"))
            val k = if (lv == 1) 1 else g.int(2..5)
            val a = if (lv == 1) g.int(2..4) else g.nonzero(-4..4)
            val factor = if (fn == "sin") a * k else -a * k
            val derivFn = if (fn == "sin") "cos" else "sin"
            val correct = trigText(factor, derivFn, UQ(k))
            val sign = if (fn == "sin") 1 else -1
            val wrong = listOf(
                trigText(sign * a, derivFn, UQ(k)),
                trigText(factor, fn, UQ(k)),
                trigText(factor, derivFn, UQ(1)),
                trigText(sign * k, derivFn, UQ(k)),
            )
            UProblem.choice(
                key = "t.deriv|$fn|$a|$k", prompt = "Bilde die Ableitung von f(x) = ${trigText(a, fn, UQ(k))}.", correct = correct, wrong = wrong,
                solution = "(sin x)′ = cos x und (cos x)′ = −sin x; die innere Ableitung $k kommt als Faktor dazu. Ergebnis: $correct.",
                explanation = "Bei sin(kx) und cos(kx) kommt k als Faktor vor die Ableitung; die Ableitung von cos hat ein Minuszeichen.",
                fact = UFact.TrigDeriv(fn, a, k),
            )
        }
    }

    val derivativeAt: UTemplate by lazy {
        UTemplate("t.derivAt") { lv, g ->
            val fn = g.pick(listOf("sin", "cos"))
            val k = if (lv == 1) 1 else g.int(2..4)
            val a = if (lv == 1) g.int(1..3) else g.nonzero(-4..4)
            val phase = g.pick(listOf(0, 1, 2, 3, 4)) // k x0 = phase * pi / 2
            val x0 = UQ(phase, 2 * k)
            val f: (Double) -> Double = { if (fn == "sin") a.toDouble() * Math.sin(k.toDouble() * it) else a.toDouble() * Math.cos(k.toDouble() * it) }
            val cosPhase = listOf(1, 0, -1, 0, 1)[phase]
            val sinPhase = listOf(0, 1, 0, -1, 0)[phase]
            val answer = UQ(if (fn == "sin") a * k * cosPhase else -a * k * sinPhase)
            val atFunction = UQ(if (fn == "sin") a * sinPhase else a * cosPhase)
            val wrongs = listOf(
                UQ(if (fn == "sin") a * cosPhase else -a * sinPhase), atFunction,
                UQ(if (fn == "sin") a * k * sinPhase else a * k * cosPhase), UQ(if (fn == "sin") -a * k * sinPhase else -a * k * cosPhase),
            )
            val xText = if (x0.isZero) "0" else UText.piMultiple(x0)
            UProblem.numeric(
                key = "t.derivAt|$fn|$a|$k|$phase", prompt = "Berechne f′($xText) für f(x) = ${trigText(a, fn, UQ(k))}.",
                answer = answer, wrongs = UCalc.differing(wrongs, answer),
                solution = "f′(x) = ${trigText(if (fn == "sin") a * k else -a * k, if (fn == "sin") "cos" else "sin", UQ(k))}. Bei x = $xText ist $k·x = ${UText.piMultiple(UQ(phase, 2))}; damit f′ = ${answer.text}.",
                explanation = "Erst mit Kettenregel ableiten, dann einsetzen; sin und cos haben bei Vielfachen von π/2 die Werte 0, 1 oder −1.",
                fact = UFact.DerivOfFunction(f, x0.double * Math.PI),
            )
        }
    }

    val solveInQuadrant: UTemplate by lazy {
        UTemplate("t.solve") { _, g ->
            val table = listOf(
                Triple("sin", UQ.zero, UQ.zero), Triple("sin", UQ(1, 2), UQ(1, 6)), Triple("sin", UQ.one, UQ(1, 2)),
                Triple("cos", UQ.one, UQ.zero), Triple("cos", UQ(1, 2), UQ(1, 3)), Triple("cos", UQ.zero, UQ(1, 2)),
            )
            val (fn, value, x) = g.pick(table)
            val standard = listOf(UQ.zero, UQ(1, 6), UQ(1, 4), UQ(1, 3), UQ(1, 2))
            val wrongs = standard + listOf(UQ(1, 2) - x, UQ(2, 3))
            piProblem(
                key = "t.solve|$fn|${value.fraction}", prompt = "Löse $fn(x) = ${value.fraction} für 0 ≤ x ≤ π/2.", answer = x, wrongs = wrongs,
                solution = "$fn(${UText.piMultiple(x)}) = ${value.fraction} laut Wertetabelle; im Intervall [0; π/2] gibt es genau eine Lösung: x = ${UText.piMultiple(x)}.",
                explanation = "Lies die Wertetabelle von sin und cos rückwärts; im ersten Quadranten ist die Lösung eindeutig.",
                fact = UFact.TrigSolve(fn, value),
            )
        }
    }

    fun kText(k: UQ): String {
        if (k == UQ.one) return "x"
        return if (k.isInt) "${k.n}x" else "x/${k.d}"
    }

    val period: UTemplate by lazy {
        UTemplate("t.period") { lv, g ->
            val fn = g.pick(listOf("sin", "cos"))
            val k = g.pick(if (lv == 1) listOf(UQ(1), UQ(2)) else listOf(UQ(2), UQ(3), UQ(4), UQ(1, 2), UQ(1, 3), UQ(6)))
            val d = if (lv == 3) g.nonzero(-3..3) else 0
            val a = if (lv == 1) 1 else g.nonzero(-3..3)
            val answer = UQ(2) / k
            val wrongs = listOf(UQ(2) * k, UQ(1) / k, k, UQ(2), UQ(1) * k)
            val text = (if (a == 1) "" else (if (a == -1) "−" else "${UText.signed(a)}·")) + "$fn(${kText(k)})" +
                (if (d == 0) "" else (if (d < 0) " − " else " + ") + "${Math.abs(d)}")
            piProblem(
                key = "t.period|$fn|$a|${k.fraction}|$d", prompt = "Welche Periode hat f(x) = $text?", answer = answer, wrongs = wrongs,
                solution = "Die Periode von $fn(kx) ist 2π/k. Hier k = ${k.fraction}: ${UText.piMultiple(answer)}. Faktor und Verschiebung ändern die Periode nicht.",
                explanation = "Der Faktor k vor x staucht den Graphen: die Periode ist 2π geteilt durch k.", fact = UFact.Period(fn, k),
            )
        }
    }

    val amplitude: UTemplate by lazy {
        UTemplate("t.amp") { lv, g ->
            val fn = g.pick(listOf("sin", "cos"))
            val a = g.nonzero(if (lv == 1) 1..4 else -5..5)
            val k = if (lv == 1) 1 else g.int(1..4)
            val d = if (lv == 1) 0 else g.int(-3..4)
            val kinds: List<UAmpKind> = if (lv == 1) listOf(UAmpKind.AMPLITUDE, UAmpKind.MAXIMUM)
            else (if (lv == 2) listOf(UAmpKind.AMPLITUDE, UAmpKind.MAXIMUM, UAmpKind.MINIMUM) else listOf(UAmpKind.MAXIMUM, UAmpKind.MINIMUM, UAmpKind.MIDLINE))
            val kind = g.pick(kinds)
            val amp = Math.abs(a)
            val answer: Int
            val question: String
            val wrongs: List<Int>
            when (kind) {
                UAmpKind.AMPLITUDE -> { answer = amp; question = "Wie groß ist die Amplitude von"; wrongs = listOf(a * k, amp + d, d, amp * 2) }
                UAmpKind.MAXIMUM -> { answer = amp + d; question = "Welchen größten Funktionswert hat"; wrongs = listOf(amp, a + d, d - amp, amp * k + d) }
                UAmpKind.MINIMUM -> { answer = d - amp; question = "Welchen kleinsten Funktionswert hat"; wrongs = listOf(-amp, d + amp, d, a + d) }
                UAmpKind.MIDLINE -> { answer = d; question = "Bei welchem y-Wert liegt die Mittellinie von"; wrongs = listOf(amp, amp + d, d - amp, a) }
            }
            val text = (if (a == 1) "" else (if (a == -1) "−" else "${UText.signed(a)}·")) + "$fn(${if (k == 1) "x" else "${k}x"})" +
                (if (d == 0) "" else (if (d < 0) " − " else " + ") + "${Math.abs(d)}")
            UProblem.numeric(
                key = "t.amp|$fn|$a|$k|$d|${kind.swiftName}", prompt = "$question f(x) = $text?", answer = UQ(answer),
                wrongs = UCalc.differing(wrongs.map { UQ(it) }, UQ(answer)),
                solution = "Bei f(x) = a·$fn(kx) + d ist die Amplitude |a| = $amp, die Mittellinie y = $d, das Maximum ${amp + d}, das Minimum ${d - amp}. Gesucht: $answer.",
                explanation = "Der Faktor a streckt die Schwingung (Amplitude |a|), die Zahl d verschiebt sie nach oben oder unten.",
                fact = UFact.Amplitude(UQ(a), UQ(k), UQ(d), kind),
            )
        }
    }

    val zeros: UTemplate by lazy {
        UTemplate("t.zeros") { lv, g ->
            val fn = g.pick(listOf("sin", "cos"))
            val k = if (lv <= 2) g.int(1..3) else g.int(2..4)
            val answer = if (fn == "sin") 2 * k + 1 else 2 * k
            val wrongs = listOf(2 * k, 2 * k + 2, k, 4 * k, 2 * k - 1, k + 1)
            UProblem.numeric(
                key = "t.zeros|$fn|$k", prompt = "Wie viele Nullstellen hat f(x) = $fn(${if (k == 1) "x" else "${k}x"}) im Intervall [0; 2π]? Die Randpunkte zählen mit.",
                answer = UQ(answer), wrongs = UCalc.differing(wrongs.map { UQ(it) }, UQ(answer)),
                solution = if (fn == "sin") "sin(kx) = 0 für kx = 0, π, 2π, …; bis 2π sind das ${2 * k + 1} Nullstellen (x = j·π/$k für j = 0 bis ${2 * k})."
                else "cos(kx) = 0 für kx = π/2, 3π/2, …; bis 2π sind das ${2 * k} Nullstellen.",
                explanation = "Skizziere die Schwingung: Im Intervall [0; 2π] hat sin(kx) genau k Perioden.",
                fact = UFact.ZerosIn(fn, k),
            )
        }
    }

    private enum class Variant(val swiftName: String) { SIN_HALF("sinHalf"), COS_QUARTER("cosQuarter"), SIN_FULL("sinFull") }

    val integral: UTemplate by lazy {
        UTemplate("t.int") { _, g ->
            val a = g.int(1..4)
            val variant = g.pick(Variant.values().toList())
            val k = g.int(1..3)
            val f: (Double) -> Double
            val from = 0.0
            val to: Double
            val text: String
            val answer: UQ
            val bound: String
            when (variant) {
                Variant.SIN_HALF -> {
                    f = { a.toDouble() * Math.sin(k.toDouble() * it) }
                    to = Math.PI / k.toDouble()
                    answer = UQ(2 * a, k)
                    bound = UText.piMultiple(UQ(1, k))
                    text = trigText(a, "sin", UQ(k))
                }
                Variant.COS_QUARTER -> {
                    f = { a.toDouble() * Math.cos(k.toDouble() * it) }
                    to = Math.PI / (2 * k).toDouble()
                    answer = UQ(a, k)
                    bound = UText.piMultiple(UQ(1, 2 * k))
                    text = trigText(a, "cos", UQ(k))
                }
                Variant.SIN_FULL -> {
                    f = { a.toDouble() * Math.cos(k.toDouble() * it) }
                    to = Math.PI
                    answer = UQ.zero
                    bound = "π"
                    text = trigText(a, "cos", UQ(k))
                }
            }
            val wrongs = listOf(UQ(a * k), UQ(2 * a), UQ(a), UQ(a, k * k), UQ(2 * a * k), UQ(a, 2 * k))
            UProblem.numeric(
                key = "t.int|${variant.swiftName}|$a|$k", prompt = "Berechne das Integral von $text dx von x = 0 bis x = $bound.",
                answer = answer, wrongs = UCalc.differing(wrongs, answer),
                solution = "Stammfunktion von $text ist ${if (variant == Variant.SIN_HALF) "−$a/$k·cos" else "$a/$k·sin"}(${if (k == 1) "x" else "${k}x"}). Obere Grenze minus untere Grenze ergibt ${answer.text}.",
                explanation = "Beim Aufleiten von sin(kx) und cos(kx) teilst du durch k; ∫ sin x dx = −cos x + C und ∫ cos x dx = sin x + C.",
                fact = UFact.IntegralOfFunction(f, from, to),
            )
        }
    }
}
