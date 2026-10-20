package de.maxifrz.lernwerk.learn.math.upper

import de.maxifrz.lernwerk.learn.NumberCheck
import de.maxifrz.lernwerk.learn.Rational
import de.maxifrz.lernwerk.learn.folded

// Independent checks for the upper-school maths course (a port of LernwerkTests/MathCourseUpperKit.swift). The kit
// re-computes every answer another way: numeric differentiation, Simpson integration, direct enumeration, plain
// number arithmetic and plugging solutions back in, so a mistake in a template cannot hide behind the code that
// produced it.

class Draw(val level: Int, val seed: ULong, val problem: UProblem)

object MathUpperKit {
    private val cache = HashMap<String, List<Draw>>()

    /** Draws of one template: levels 1 to 3, seeds 1...`seeds` (Swift uses 300). */
    fun draws(id: String, seeds: Int): List<Draw> = cache.getOrPut("$id|$seeds") {
        val template = MathUpperCatalog.template(id) ?: error("No template $id")
        val result = mutableListOf<Draw>()
        for (level in 1..3) {
            for (seed in 1..seeds) {
                val s = seed.toULong() * 7919uL + level.toULong()
                val problem = template.make(level, UGen(s))
                if (problem != null) result.add(Draw(level, s, problem))
            }
        }
        result
    }

    val allIDs: List<String> by lazy { MathUpperCatalog.units.flatMap { u -> u.map { it.id } } }

    // Numeric tools

    fun derivative(f: (Double) -> Double, x: Double): Double {
        val h = 1e-5
        return (f(x + h) - f(x - h)) / (2 * h)
    }

    fun simpson(f: (Double) -> Double, a: Double, b: Double, n: Int = 4000): Double {
        val h = (b - a) / n
        var sum = f(a) + f(b)
        for (i in 1 until n) sum += f(a + i * h) * (if (i % 2 == 0) 2.0 else 4.0)
        return sum * h / 3
    }

    fun close(a: Double, b: Double, tolerance: Double = 1e-4): Boolean =
        Math.abs(a - b) <= tolerance * (1 + maxOf(Math.abs(a), Math.abs(b)))

    fun minus(n: Int): String = if (n < 0) "−${-n}" else "$n"

    /** "3π/4", "π/2", "−π", "0", "4π" as a multiple of pi. */
    fun parsePi(text: String): Double? {
        var t = text
        var sign = 1.0
        if (t.startsWith("−")) {
            sign = -1.0
            t = t.substring(1)
        }
        if (t == "0") return 0.0
        val parts = t.split("π")
        if (parts.size != 2) return null
        val coefficient = if (parts[0].isEmpty()) 1.0 else (parts[0].toDoubleOrNull() ?: return null)
        var denominator = 1.0
        if (parts[1].isNotEmpty()) {
            if (!parts[1].startsWith("/")) return null
            denominator = parts[1].substring(1).toDoubleOrNull() ?: return null
        }
        return sign * coefficient / denominator
    }

    private val magnitudes = mapOf(
        "0" to 0.0, "1/2" to 0.5, "√2/2" to Math.sqrt(2.0) / 2, "√3/2" to Math.sqrt(3.0) / 2, "1" to 1.0, "√3" to Math.sqrt(3.0), "√3/3" to Math.sqrt(3.0) / 3,
    )

    fun parseExact(text: String): Double? {
        var t = text
        var sign = 1.0
        if (t.startsWith("−")) {
            sign = -1.0
            t = t.substring(1)
        }
        val m = magnitudes[t] ?: return null
        return sign * m
    }

    fun trig(fn: String, radians: Double): Double = when (fn) {
        "sin" -> Math.sin(radians)
        "cos" -> Math.cos(radians)
        else -> Math.tan(radians)
    }

    /** Reads "P(A) = 0,4" style numbers from a prompt. */
    fun promptNumber(prompt: String, label: String): Double? {
        val match = Regex(Regex.escape(label) + " = ([0-9]+(?:,[0-9]+)?)").find(prompt) ?: return null
        return match.groupValues[1].replace(',', '.').toDouble()
    }

    fun vectorText(v: List<Int>): String = "(" + v.joinToString(" | ") { minus(it) } + ")"

    fun lineContains(a: List<Int>, u: List<Int>, p: List<Int>): Boolean {
        var t: Double? = null
        for (i in 0 until 3) {
            if (u[i] == 0) {
                if (p[i] != a[i]) return false
                continue
            }
            val value = (p[i] - a[i]).toDouble() / u[i].toDouble()
            val known = t
            if (known != null) {
                if (Math.abs(known - value) > 1e-12) return false
            } else {
                t = value
            }
        }
        return true
    }

    fun binomialDoubles(n: Int): List<Double> {
        var row = listOf(1.0)
        for (j in 0 until n) {
            val next = mutableListOf(1.0)
            for (i in 1 until row.size) next.add(row[i - 1] + row[i])
            next.add(1.0)
            row = next
        }
        return row
    }

    fun pmfDoubles(n: Int, p: Double): List<Double> =
        binomialDoubles(n).mapIndexed { k, c -> c * Math.pow(p, k.toDouble()) * Math.pow(1 - p, (n - k).toDouble()) }

    private fun sumOf(xs: List<Double>): Double = xs.fold(0.0) { a, b -> a + b }
    private fun dotOf(a: List<Int>, b: List<Int>): Int = a.indices.fold(0) { s, i -> s + a[i] * b[i] }
    private fun zero3(v: List<Int>): Boolean = v.all { it == 0 }

    private val hyphen = Regex("(^|[ (])-[0-9a-zA-Z(]")

    /** Everything wrong with a drawn problem, as readable lines (empty when sound). */
    fun problems(d: Draw): List<String> {
        val out = mutableListOf<String>()
        val p = d.problem
        fun fail(text: String) { out.add("${p.key}: $text") }
        if (p.prompt.isEmpty() || p.solution.isEmpty() || p.explanation.isEmpty() || p.correct.isEmpty()) fail("empty text")
        if (p.number == null && p.typedAllowed) fail("typed allowed without a number")
        val n = p.number
        if (n != null) {
            if (!n.isNice) fail("answer not nice ${n.fraction}")
            if (Math.abs(n.double) >= 100_000) fail("answer too large")
            val parsed = NumberCheck.parse(n.typed)
            val own = Rational.make(n.n, n.d)
            if (parsed != null && own != null && parsed != own) fail("typed text differs from the number")
            if (parsed == null) fail("typed text does not parse")
        }
        val foldedAll = (listOf(p.correct) + p.wrong).map { folded(it) }
        if (foldedAll.toSet().size != foldedAll.size) fail("options read the same")
        if (p.wrong.contains(p.correct)) fail("a wrong option equals the right one")
        if (p.number == null && p.wrong.size < 2) fail("a choice problem without two wrong options")
        val right = NumberCheck.parse(p.correct)
        if (n != null && right != null) {
            val own = Rational.make(n.n, n.d)
            if (own != null && right != own) fail("correct text is not the number")
            for (w in p.wrong) {
                val pw = NumberCheck.parse(w)
                if (pw != null && pw == right) fail("wrong option $w has the right value")
            }
        }
        for (text in listOf(p.prompt, p.correct, p.solution) + p.wrong) {
            if (hyphen.containsMatchIn(text)) fail("ASCII minus used as a sign in $text")
        }
        return out + checkFact(d)
    }

    private val symmetryText = mapOf(
        USymmetry.Y_AXIS to "achsensymmetrisch zur y-Achse", USymmetry.ORIGIN to "punktsymmetrisch zum Ursprung", USymmetry.NEITHER to "weder noch",
    )
    private val kindNames = mapOf(UExtremum.MAXIMUM to "Hochpunkt", UExtremum.MINIMUM to "Tiefpunkt", UExtremum.SADDLE to "Sattelpunkt")

    fun checkFact(d: Draw): List<String> {
        val out = mutableListOf<String>()
        val p = d.problem
        fun fail(text: String) { out.add("${p.key}: $text") }
        val number: Double? = p.number?.double
        fun expectNumber(value: Double, label: String) {
            if (number == null) {
                fail("$label: no number")
                return
            }
            if (!close(number, value)) fail("$label: answer $number but recomputed $value")
        }
        when (val fact = p.fact) {
            is UFact.DerivAt -> expectNumber(derivative({ fact.f.evalDouble(it) }, fact.x.double), "f'(a)")
            is UFact.ValueAt -> expectNumber(fact.f.evalDouble(fact.x.double), "f(a)")
            is UFact.SlopeX ->
                if (number != null && !close(derivative({ fact.f.evalDouble(it) }, number), fact.m.double)) fail("slope at the answer is not ${fact.m.double}")
            is UFact.TangentT -> {
                val m = derivative({ fact.f.evalDouble(it) }, fact.a.double)
                expectNumber(fact.f.evalDouble(fact.a.double) - m * fact.a.double, "tangent t")
            }
            is UFact.TangentY -> {
                val m = derivative({ fact.f.evalDouble(it) }, fact.a.double)
                expectNumber(fact.f.evalDouble(fact.a.double) + m * (fact.b.double - fact.a.double), "tangent value")
            }
            is UFact.FlatX ->
                if (number != null && !close(derivative({ fact.f.evalDouble(it) }, number), 0.0, 1e-6)) fail("slope at the answer is not 0")
            is UFact.FlatY -> {
                val candidates = mutableListOf<Double>()
                var x = -40.0
                while (x <= 40.0) {
                    if (Math.abs(fact.f.derivative.evalDouble(x)) < 1e-9) candidates.add(x)
                    x += 0.5
                }
                if (candidates.size != 1) fail("flat tangent not unique") else expectNumber(fact.f.evalDouble(candidates[0]), "flat y")
            }
            is UFact.DerivPoly -> {
                for (x in listOf(-1.7, -0.4, 0.9, 2.3)) {
                    if (!close(derivative({ fact.f.evalDouble(it) }, x), fact.correct.evalDouble(x), 1e-3)) fail("the correct option is not the derivative")
                }
                if (fact.f.derivative != fact.correct) fail("exact derivative differs")
                if (fact.correct.text != p.correct) fail("correct text differs from the polynomial")
                val wrongTexts = fact.wrong.map { it.text }.toSet()
                for (w in p.wrong) if (w !in wrongTexts) fail("wrong option $w not computed from a mistake")
                for (w in fact.wrong) if (w == fact.f.derivative) fail("a mistake equals the derivative")
            }
            is UFact.DerivOfFunction -> expectNumber(derivative(fact.f, fact.at), "derivative of function")
            is UFact.ValueOfFunction -> expectNumber(fact.f(fact.at), "value of function")
            is UFact.Root -> if (number != null) {
                if (!fact.f.eval(UQ(number.toLong())).isZero) fail("not a root")
                val roots = mutableListOf<Int>()
                for (x in -40..40) if (fact.f.eval(UQ(x)).isZero) roots.add(x)
                if (p.typedAllowed && roots.isNotEmpty()) {
                    val expected = if (fact.largest) roots.max() else roots.min()
                    if (expected.toDouble() != number) fail("not the ${if (fact.largest) "largest" else "smallest"} root")
                }
                for (w in p.wrong) {
                    val parsed = NumberCheck.parse(w)
                    if (parsed != null && !p.typedAllowed && fact.f.eval(UQ(parsed.doubleValue.toLong())).isZero) fail("wrong option $w is a root")
                }
            }
            is UFact.ExtremumX -> if (number != null) {
                if (!close(fact.f.derivative.evalDouble(number), 0.0, 1e-9)) fail("f' not 0 at the answer")
                val second = fact.f.derivative.derivative.evalDouble(number)
                if (if (fact.max) second >= 0 else second <= 0) fail("wrong sign of f'' for ${if (fact.max) "max" else "min"}")
            }
            is UFact.ExtremumY -> {
                val xs = mutableListOf<Double>()
                for (i in -80..80) {
                    val x = i / 2.0
                    val second = fact.f.derivative.derivative.evalDouble(x)
                    if (Math.abs(fact.f.derivative.evalDouble(x)) < 1e-9 && (if (fact.max) second < 0 else second > 0)) xs.add(x)
                }
                if (xs.size != 1) fail("extremum not unique") else expectNumber(fact.f.evalDouble(xs[0]), "extremum y")
            }
            is UFact.InflectionX -> if (number != null) {
                if (!close(fact.f.derivative.derivative.evalDouble(number), 0.0, 1e-9)) fail("f'' not 0 at the answer")
                if (close(fact.f.derivative.derivative.derivative.evalDouble(number), 0.0, 1e-9)) fail("f''' is 0")
            }
            is UFact.KindAt -> {
                val x0 = fact.x.double
                if (kindNames[fact.kind] != p.correct) fail("correct text differs")
                val all = (p.wrong + p.correct).toSet()
                val names = kindNames.values.toSet()
                if (all.size != names.size || all.any { it !in names }) fail("options are not the three kinds")
                if (Math.abs(fact.f.derivative.evalDouble(x0)) > 1e-9) fail("f' not 0")
                val second = fact.f.derivative.derivative.evalDouble(x0)
                val before = fact.f.derivative.evalDouble(x0 - 0.1)
                val after = fact.f.derivative.evalDouble(x0 + 0.1)
                when (fact.kind) {
                    UExtremum.MAXIMUM -> if (!(second < 0 && before > 0 && after < 0)) fail("not a maximum")
                    UExtremum.MINIMUM -> if (!(second > 0 && before < 0 && after > 0)) fail("not a minimum")
                    UExtremum.SADDLE -> if (!(Math.abs(second) < 1e-9 && before * after > 0)) fail("not a saddle point")
                }
            }
            is UFact.Symmetry -> {
                if (symmetryText[fact.kind] != p.correct) fail("correct text differs")
                val xs = listOf(0.7, 1.3, 2.1)
                val even = xs.all { close(fact.f.evalDouble(-it), fact.f.evalDouble(it)) }
                val odd = xs.all { close(fact.f.evalDouble(-it), -fact.f.evalDouble(it)) }
                val actual = if (even) USymmetry.Y_AXIS else if (odd) USymmetry.ORIGIN else USymmetry.NEITHER
                if (actual != fact.kind) fail("symmetry is $actual")
            }
            is UFact.Monotone -> {
                val mid = (fact.lo.double + fact.hi.double) / 2
                val risingInside = fact.f.derivative.evalDouble(mid) > 0
                if (fact.f.derivative.evalDouble(fact.lo.double) != 0.0 || fact.f.derivative.evalDouble(fact.hi.double) != 0.0) fail("bounds are not stationary points")
                val outsideRising = fact.f.derivative.evalDouble(fact.hi.double + 1) > 0
                if (risingInside == outsideRising) fail("no sign change")
                if (fact.answerBetween != (fact.askRising == risingInside)) fail("answer side is wrong")
                if (p.correct.contains("oder") == fact.answerBetween) fail("correct text does not fit the side")
                if (p.prompt.contains("steigend") != fact.askRising) fail("prompt direction differs")
                val lowText = minus(fact.lo.double.toInt())
                val highText = minus(fact.hi.double.toInt())
                val expected = if (fact.answerBetween) "$lowText < x < $highText" else "x < $lowText oder x > $highText"
                if (expected != p.correct) fail("correct interval text differs")
            }
            is UFact.Antiderivative -> {
                if (fact.correct.derivative != fact.f) fail("F' is not f")
                for (x in listOf(-1.3, 0.6, 2.2)) {
                    if (!close(derivative({ fact.correct.evalDouble(it) }, x), fact.f.evalDouble(x), 1e-3)) fail("numeric F' differs")
                }
                if (fact.correct.text + " + C" != p.correct) fail("correct text differs")
                val wrongTexts = fact.wrong.map { it.text + " + C" }.toSet()
                for (w in p.wrong) if (w !in wrongTexts) fail("wrong option $w not computed from a mistake")
                for (w in fact.wrong) if (w.derivative == fact.f) fail("a mistake is an antiderivative")
                if (p.wrong.any { !it.endsWith("+ C") }) fail("an option without + C")
            }
            is UFact.Definite -> {
                val expected = simpson({ fact.f.evalDouble(it) }, fact.a.double, fact.b.double)
                if (number != null) {
                    if (!close(number, expected, 1e-6)) fail("definite integral $number vs $expected")
                } else {
                    val parsed = NumberCheck.parse(p.correct)
                    if (parsed != null && !close(parsed.doubleValue, expected, 1e-6)) fail("definite integral text ${p.correct} vs $expected")
                }
            }
            is UFact.Area -> expectNumber(simpson({ Math.abs(fact.f.evalDouble(it)) }, fact.a.double, fact.b.double, 60000), "area")
            is UFact.Mean -> expectNumber(simpson({ fact.f.evalDouble(it) }, fact.a.double, fact.b.double) / (fact.b.double - fact.a.double), "mean value")
            is UFact.UpperLimit -> if (number != null) {
                if (!close(simpson({ fact.f.evalDouble(it) }, 0.0, number), fact.value.double, 1e-6)) fail("integral up to the answer is not ${fact.value.double}")
                if (number <= 0) fail("limit not positive")
            }
            is UFact.Combination -> expectNumber(sumOf(fact.coefficients.mapIndexed { i, c -> c.double * fact.parts[i].double }), "linear combination")
            is UFact.IntegralOfFunction -> expectNumber(simpson(fact.f, fact.from, fact.to), "integral of function")
            is UFact.Approx -> expectNumber(fact.value, "approx")
            is UFact.PowerEquation ->
                if (number != null && !close(Math.pow(fact.base, fact.k.double * number + fact.c.double), fact.rhs, 1e-9)) fail("equation not satisfied by the answer")
            is UFact.ExpDeriv -> {
                val a = fact.a
                val k = fact.k
                val b = fact.b
                val g = { x: Double -> a * Math.exp(k * x) + b * x * x }
                val formula = { x: Double -> a * k * Math.exp(k * x) + 2 * b * x }
                for (x in listOf(-0.4, 0.37, 1.1)) if (!close(derivative(g, x), formula(x), 1e-3)) fail("formula is not the derivative")
                val c = a * k
                val head = if (c == 1) "" else if (c == -1) "−" else minus(c)
                val exponent = if (k == 1) "x" else if (k == -1) "(−x)" else "(${minus(k)}x)"
                var expected = head + "e^" + exponent
                if (b != 0) expected += (if (b < 0) " − " else " + ") + (if (Math.abs(2 * b) == 1) "" else "${Math.abs(2 * b)}") + "x"
                if (expected != p.correct) fail("correct text ${p.correct} vs $expected")
            }
            is UFact.ExpAnti -> {
                val a = fact.a
                val k = fact.k
                val bigF = { x: Double -> (a.toDouble() / k) * Math.exp(k * x) }
                for (x in listOf(-0.4, 0.37, 1.1)) if (!close(derivative(bigF, x), a * Math.exp(k * x), 1e-3)) fail("not an antiderivative")
                fun gcd(x: Int, y: Int): Int = if (y == 0) Math.abs(x) else gcd(y, x % y)
                val g = gcd(a, k)
                var top = a / g
                var bottom = k / g
                if (bottom < 0) {
                    top = -top
                    bottom = -bottom
                }
                val exponent = if (k == 1) "x" else if (k == -1) "(−x)" else "(${minus(k)}x)"
                val expected = (if (top < 0) "−" else "") + (if (Math.abs(top) == 1) "" else "${Math.abs(top)}") + "e^" + exponent + (if (bottom == 1) "" else "/$bottom") + " + C"
                if (expected != p.correct) fail("correct text ${p.correct} vs $expected")
            }
            is UFact.LnSolve -> {
                val a = fact.a
                val k = fact.k
                val x = Math.log(a.toDouble()) / k
                if (!close(Math.exp(k * x), a.toDouble(), 1e-9)) fail("check failed")
                val expected = if (k == 1) "x = ln($a)" else "x = ln($a)/$k"
                if (expected != p.correct) fail("correct text differs")
                val known: Map<String, Double> = if (k == 1) {
                    mapOf("x = e^$a" to Math.exp(a.toDouble()), "x = $a/e" to a / Math.E, "x = log₁₀($a)" to Math.log10(a.toDouble()), "x = $a − 1" to (a - 1).toDouble())
                } else {
                    mapOf(
                        "x = $k·ln($a)" to k * Math.log(a.toDouble()), "x = ln($a/$k)" to Math.log(a.toDouble() / k), "x = ln($a) − $k" to Math.log(a.toDouble()) - k,
                        "x = e^($a/$k)" to Math.exp(a.toDouble() / k),
                    )
                }
                for (w in p.wrong) {
                    val value = known[w]
                    if (value == null) {
                        fail("unknown wrong option $w")
                        continue
                    }
                    if (close(value, x, 1e-9)) fail("wrong option $w is right")
                }
            }
            is UFact.Law -> {
                for ((a, b) in listOf(2.3 to 1.7, 5.1 to 0.6, 9.0 to 4.0)) {
                    val (l, r) = fact.correct(a, b)
                    if (!close(l, r, 1e-9)) fail("the law does not hold")
                    for (w in fact.wrong) {
                        val (wl, wr) = w(a, b)
                        if (close(wl, wr, 1e-9)) fail("a wrong law holds at $a, $b")
                    }
                }
                if (p.wrong.size > fact.wrong.size) fail("every wrong option needs a counter-check")
            }
            is UFact.TrigValue -> {
                val value = trig(fact.fn, fact.degrees * Math.PI / 180)
                val signs = mapOf("positiv" to 1, "negativ" to -1, "null" to 0)
                if (number != null) {
                    if (!close(number, value, 1e-9)) fail("${fact.fn}(${fact.degrees}°) is $value, answer $number")
                } else if (signs[p.correct] != null) {
                    val sign = signs[p.correct]!!
                    if (if (Math.abs(value) < 1e-9) sign != 0 else if (value > 0) sign != 1 else sign != -1) fail("sign of ${fact.fn}(${fact.degrees}°) is wrong")
                } else {
                    val parsed = parseExact(p.correct)
                    if (parsed != null) {
                        if (!close(parsed, value, 1e-9)) fail("exact text ${p.correct} vs $value")
                        for (w in p.wrong) {
                            val pw = parseExact(w)
                            if (pw != null && close(pw, value, 1e-9)) fail("wrong option $w has the same value")
                        }
                    } else fail("cannot read the correct text")
                }
                if (p.number != null) {
                    val r = parseExact(p.correct)
                    if (r != null && !close(r, value, 1e-9)) fail("fraction text differs")
                    for (w in p.wrong) {
                        val pw = parseExact(w)
                        if (pw != null && close(pw, value, 1e-9)) fail("wrong option $w has the same value")
                    }
                }
            }
            is UFact.DegreesToPi -> {
                val target = fact.degrees / 180.0
                expectNumber(target, "degrees to pi")
                val parsed = parsePi(p.correct)
                if (parsed != null && !close(parsed, target, 1e-9)) fail("correct text ${p.correct} differs")
                for (w in p.wrong) {
                    val pw = parsePi(w)
                    if (pw != null && close(pw, target, 1e-9)) fail("wrong option $w equals the answer")
                }
            }
            is UFact.Period -> if (number != null) {
                val f = { x: Double -> trig(fact.fn, fact.k.double * x) }
                val period = number * Math.PI
                for (x in listOf(0.3, 1.1, 2.9)) if (!close(f(x + period), f(x), 1e-9)) fail("not a period")
                for (m in 2..6) {
                    if (close(f(0.3 + period / m), f(0.3), 1e-9) && close(f(1.1 + period / m), f(1.1), 1e-9)) fail("period $period is not the smallest")
                }
                val parsed = parsePi(p.correct)
                if (parsed != null && !close(parsed, number, 1e-9)) fail("correct text differs")
            }
            is UFact.Amplitude -> if (number != null) {
                val isSin = p.prompt.contains("sin")
                val f = { x: Double -> fact.a.double * (if (isSin) Math.sin(fact.k.double * x) else Math.cos(fact.k.double * x)) + fact.d.double }
                var high = Double.NEGATIVE_INFINITY
                var low = Double.POSITIVE_INFINITY
                for (i in 0..20000) {
                    val v = f(i / 20000.0 * 2 * Math.PI)
                    if (v > high) high = v
                    if (v < low) low = v
                }
                when (fact.what) {
                    UAmpKind.AMPLITUDE -> if (!close(number, (high - low) / 2, 1e-5)) fail("amplitude")
                    UAmpKind.MAXIMUM -> if (!close(number, high, 1e-5)) fail("maximum")
                    UAmpKind.MINIMUM -> if (!close(number, low, 1e-5)) fail("minimum")
                    UAmpKind.MIDLINE -> if (!close(number, (high + low) / 2, 1e-5)) fail("midline")
                }
            }
            is UFact.ZerosIn -> {
                val n = 4000 * fact.k
                var count = 0
                for (i in 0..n) if (Math.abs(trig(fact.fn, (fact.k * i).toDouble() / n * 2 * Math.PI)) < 1e-9) count += 1
                expectNumber(count.toDouble(), "zeros")
            }
            is UFact.TrigSolve -> if (number != null) {
                if (!close(trig(fact.fn, number * Math.PI), fact.value.double, 1e-9)) fail("answer does not solve the equation")
                if (number < 0 || number > 0.5 + 1e-12) fail("outside [0; pi/2]")
                val parsed = parsePi(p.correct)
                if (parsed != null && !close(parsed, number, 1e-9)) fail("text differs")
            }
            is UFact.CosFromSin -> {
                val cosine = Math.sqrt(1 - fact.sin.double * fact.sin.double)
                expectNumber(if (fact.askTan) fact.sin.double / cosine else cosine, if (fact.askTan) "tan" else "cos")
            }
            is UFact.TrigDeriv -> {
                val fn = fact.fn
                val a = fact.a
                val k = fact.k
                val g = { x: Double -> a * trig(fn, k * x) }
                val formula = { x: Double -> if (fn == "sin") a * k * Math.cos(k * x) else -(a * k) * Math.sin(k * x) }
                for (x in listOf(-0.4, 0.37, 1.1)) if (!close(derivative(g, x), formula(x), 1e-3)) fail("formula is not the derivative")
                val c = if (fn == "sin") a * k else -a * k
                val head = if (c == 1) "" else if (c == -1) "−" else minus(c)
                val expected = head + (if (fn == "sin") "cos" else "sin") + "(" + (if (k == 1) "x" else "${k}x") + ")"
                if (expected != p.correct) fail("correct text ${p.correct} vs $expected")
            }
            is UFact.VecNorm -> expectNumber(Math.sqrt(fact.v.fold(0) { s, x -> s + x * x }.toDouble()), "norm")
            is UFact.Dot -> expectNumber(dotOf(fact.a, fact.b).toDouble(), "dot product")
            is UFact.OrthoParam -> {
                if (dotOf(fact.a, fact.b) != 0) fail("not orthogonal")
                if (number != null && fact.a[fact.index].toDouble() != number) fail("answer is not the entry")
            }
            is UFact.Distance -> {
                var squares = 0
                for (i in 0 until 3) {
                    val delta = fact.b[i] - fact.a[i]
                    squares += delta * delta
                }
                expectNumber(Math.sqrt(squares.toDouble()), "distance")
            }
            is UFact.VectorComponent -> expectNumber((fact.to[fact.index] - fact.from[fact.index]).toDouble(), "component")
            is UFact.LineParam -> if (number != null) for (i in 0 until 3) if (fact.a[i] + number * fact.u[i] != fact.p[i].toDouble()) fail("point is not a + t u")
            is UFact.LinePoint -> expectNumber((fact.a[fact.index] + fact.t * fact.u[fact.index]).toDouble(), "line point")
            is UFact.Midpoint -> expectNumber((fact.a[fact.index] + fact.b[fact.index]) / 2.0, "midpoint")
            is UFact.Angle -> {
                val dot = dotOf(fact.a, fact.b)
                val na = Math.sqrt(fact.a.fold(0) { s, x -> s + x * x }.toDouble())
                val nb = Math.sqrt(fact.b.fold(0) { s, x -> s + x * x }.toDouble())
                expectNumber(Math.acos(maxOf(-1.0, minOf(1.0, dot / (na * nb)))) * 180 / Math.PI, "angle")
            }
            is UFact.OnLine -> {
                if (!lineContains(fact.a, fact.u, fact.right)) fail("right point is not on the line")
                if (p.correct != "P" + vectorText(fact.right)) fail("correct text differs")
                for (w in fact.wrong) if (lineContains(fact.a, fact.u, w)) fail("wrong point is on the line")
                val allowed = fact.wrong.map { "P" + vectorText(it) }.toSet()
                if (!p.wrong.all { it in allowed }) fail("wrong options differ from the facts")
            }
            is UFact.OrthogonalPair -> {
                if (dotOf(fact.right.first, fact.right.second) != 0) fail("right pair is not orthogonal")
                if (zero3(fact.right.first) || zero3(fact.right.second)) fail("zero vector")
                for (w in fact.wrong) if (dotOf(w.first, w.second) == 0) fail("wrong pair is orthogonal")
            }
            is UFact.Direction -> {
                val dd = fact.a.indices.map { fact.b[it] - fact.a[it] }
                if (p.correct != vectorText(dd)) fail("correct vector differs")
                for (w in p.wrong) if (w == p.correct) fail("equal option")
                if (fact.a == fact.b) fail("degenerate")
            }
            is UFact.LaplaceDice -> {
                var favourable = 0
                for (x in 1..6) for (y in 1..6) if (fact.sums.contains(x + y)) favourable += 1
                expectNumber(favourable / 36.0, "dice probability")
            }
            is UFact.Urn -> {
                val balls = List(fact.red) { 1 } + List(fact.blue) { 0 }
                var good = 0
                var all = 0
                when (fact.mode) {
                    UUrn.ONE_RED -> {
                        good = balls.count { it == 1 }
                        all = balls.size
                    }
                    UUrn.TWO_RED_WITH -> for (x in balls) for (y in balls) {
                        all += 1
                        if (x == 1 && y == 1) good += 1
                    }
                    else -> for (i in balls.indices) for (j in balls.indices) {
                        if (i == j) continue
                        all += 1
                        if (if (fact.mode == UUrn.TWO_RED_WITHOUT) balls[i] == 1 && balls[j] == 1 else balls[i] != balls[j]) good += 1
                    }
                }
                expectNumber(good.toDouble() / all, "urn")
            }
            is UFact.Choose ->
                if (!(fact.n >= fact.k && fact.k >= 0 && fact.n > 0)) fail("degenerate n, k") else expectNumber(binomialDoubles(fact.n)[fact.k], "n over k")
            is UFact.Binomial -> {
                val probs = pmfDoubles(fact.n, fact.p.double)
                if (!close(sumOf(probs), 1.0, 1e-12)) fail("pmf does not sum to 1")
                when (val kind = fact.kind) {
                    is UBinom.Equal -> expectNumber(probs[kind.k], "P(X=k)")
                    is UBinom.AtMost -> expectNumber(sumOf(probs.subList(0, kind.k + 1)), "P(X<=k)")
                    is UBinom.AtLeast -> expectNumber(sumOf(probs.subList(kind.k, fact.n + 1)), "P(X>=k)")
                    UBinom.AtLeastOne -> expectNumber(1 - Math.pow(1 - fact.p.double, fact.n.toDouble()), "at least one")
                }
            }
            is UFact.Expectation -> expectNumber(fact.n * fact.p.double, "E(X)")
            is UFact.ExpectationTable -> {
                if (!close(sumOf(fact.probabilities.map { it.double }), 1.0, 1e-12)) fail("probabilities do not sum to 1")
                expectNumber(sumOf(fact.values.mapIndexed { i, v -> v.double * fact.probabilities[i].double }), "E(X) of a table")
            }
            is UFact.Sigma -> expectNumber(Math.sqrt(fact.n * fact.p.double * (1 - fact.p.double)), "sigma")
            is UFact.Table -> {
                val t = fact.table
                val n = t.total.toDouble()
                val a = t.a.toDouble()
                val b = t.b.toDouble()
                val c = t.c.toDouble()
                val dd = t.d.toDouble()
                if (t.a <= 0 || t.b <= 0 || t.c <= 0 || t.d <= 0) fail("empty cell")
                val value = when (fact.ask) {
                    UAsk.P_A -> (a + b) / n
                    UAsk.P_B -> (a + c) / n
                    UAsk.P_A_AND_B -> a / n
                    UAsk.P_A_OR_B -> (a + b + c) / n
                    UAsk.P_NOT_A_AND_B -> c / n
                    UAsk.P_NOT_A_AND_NOT_B -> dd / n
                    UAsk.P_A_GIVEN_B -> a / (a + c)
                    UAsk.P_B_GIVEN_A -> a / (a + b)
                    UAsk.P_NOT_B_GIVEN_A -> b / (a + b)
                }
                expectNumber(value, "table probability")
                if (p.prompt.startsWith("Für zwei Ereignisse")) {
                    val pa = promptNumber(p.prompt, "P(A)")
                    if (pa != null && !close(pa, (a + b) / n, 1e-12)) fail("P(A) in the prompt")
                    val pb = promptNumber(p.prompt, "P(B)")
                    if (pb != null && !close(pb, (a + c) / n, 1e-12)) fail("P(B) in the prompt")
                    val pab = promptNumber(p.prompt, "P(A∩B)")
                    if (pab != null && !close(pab, a / n, 1e-12)) fail("P(A∩B) in the prompt")
                }
                if (p.prompt.startsWith("Im Baumdiagramm")) {
                    val pa = promptNumber(p.prompt, "P(A)")
                    if (pa != null && !close(pa, (a + b) / n, 1e-12)) fail("tree P(A)")
                    val q1 = promptNumber(p.prompt, "P(B|A)")
                    if (q1 != null && !close(q1, a / (a + b), 1e-12)) fail("tree P(B|A)")
                    val q2 = promptNumber(p.prompt, "P(B|¬A)")
                    if (q2 != null && !close(q2, c / (c + dd), 1e-12)) fail("tree P(B|not A)")
                }
            }
            is UFact.Independence -> {
                val t = fact.table
                val n = t.total
                val left = t.a * n
                val right = (t.a + t.b) * (t.a + t.c)
                val expected = if (left == right) "Ja, denn P(A∩B) = P(A)·P(B)."
                else if (left > right) "Nein, denn P(A∩B) ist größer als P(A)·P(B)." else "Nein, denn P(A∩B) ist kleiner als P(A)·P(B)."
                if (expected != p.correct) fail("independence verdict differs")
            }
            UFact.Pairs, UFact.Concept -> {}
        }
        return out
    }
}
