package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/**
 * Unit 7, Potenzen und Wurzeln: Potenzen und Quadratwurzeln (lesson 1), die Potenzgesetze (2), negative Exponenten,
 * Zehnerpotenzen und Wurzelregeln (3).
 */
object MathMiddleUnit07 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u07.powerValue", 1, forms(CHOICE, TYPED, PAIRS), ::powerValue),
            MathMiddleTemplate("u07.negativeBase", 1, forms(CHOICE, TYPED, PAIRS), ::negativeBase),
            MathMiddleTemplate("u07.squareRoot", 1, forms(CHOICE, TYPED, PAIRS), ::squareRoot),
            MathMiddleTemplate("u07.estimateRoot", 1, forms(CHOICE, TYPED, PAIRS), ::estimateRoot),
            MathMiddleTemplate("u07.sameBase", 2, forms(CHOICE, TYPED, PAIRS), ::sameBase),
            MathMiddleTemplate("u07.powerOfPower", 2, forms(CHOICE, TYPED, PAIRS), ::powerOfPower),
            MathMiddleTemplate("u07.sameExponent", 2, forms(CHOICE, TYPED, PAIRS), ::sameExponent),
            MathMiddleTemplate("u07.negativeExponent", 3, forms(CHOICE, TYPED, PAIRS), ::negativeExponent),
            MathMiddleTemplate("u07.scientific", 3, forms(CHOICE, TYPED, PAIRS), ::scientific),
            MathMiddleTemplate("u07.rootOfSum", 3, forms(CHOICE, TYPED, PAIRS), ::rootOfSum),
            MathMiddleTemplate("u07.cubeRoot", 3, forms(CHOICE, TYPED, PAIRS), ::cubeRoot),
        )
    }

    private const val valueHint = "Gib die Zahl an."

    private fun ipow(base: Int, exponent: Int): Int {
        var result = 1
        repeat(maxOf(0, exponent)) { result *= base }
        return result
    }

    private fun letter(gen: Gen): String = gen.pick(listOf("x", "a", "y", "z"))

    // Lesson 1

    /** "Berechne 3⁴": the base is taken as a factor as often as the exponent says. */
    private fun powerValue(level: Int, gen: Gen): P? {
        if (level == 3) {
            return if (gen.chance(55)) fractionPower(gen) else decimalPower(gen)
        }
        val base: Int
        val exponent: Int
        if (level == 1) {
            base = gen.pick(listOf(2, 3, 4, 5, 10))
            exponent = if (base == 10) gen.int(2..4) else gen.int(2..(if (base <= 3) 4 else 3))
        } else {
            base = gen.int(2..9)
            exponent = if (base == 2) gen.int(5..9) else if (base == 3) gen.int(4..6) else 3
        }
        val value = ipow(base, exponent)
        if (value >= 1000) return null
        // Base times exponent, exponent to the power of the base, one factor too few or too many.
        val wrong = listOf(base * exponent, ipow(exponent, base), ipow(base, exponent - 1), ipow(base, exponent + 1)).filter { it < 100_000 }
        val text = T.power(base, exponent)
        val factors = List(exponent) { base.toString() }.joinToString(" · ")
        return P.number(
            prompt = "Berechne $text.",
            answer = Q(value),
            hint = valueHint,
            wrong = wrong.map { Q(it) },
            pair = text,
            solution = "$text = $factors = $value",
            explanation = "Die Hochzahl sagt, wie oft die Basis als Faktor vorkommt: ${base}${T.sup(exponent)} heißt $exponent Faktoren $base, nicht $base · $exponent.",
        )
    }

    private fun fractionPower(gen: Gen): P? {
        val b = gen.int(2..5)
        val a = gen.int(1..(b - 1))
        val n = gen.int(2..4)
        if (T.gcd(a, b) != 1 || ipow(b, n) > 1000) return null
        val base = Q(a, b)
        val value = base.power(n)
        val text = "($a/$b)${T.sup(n)}"
        // Only the numerator or only the denominator raised, base times exponent, one factor too few.
        val wrong = listOf(Q(ipow(a, n), b), Q(a, ipow(b, n)), Q(a * n, b), base.power(n - 1))
        return P.number(
            prompt = "Berechne $text.",
            answer = value,
            style = S.Fraction,
            hint = "Gib das Ergebnis als Bruch an.",
            wrong = wrong,
            pair = text,
            solution = "$text = ${a}${T.sup(n)}/${b}${T.sup(n)} = ${ipow(a, n)}/${ipow(b, n)}",
            explanation = "Bei einem Bruch in der Klammer wird Zähler und Nenner mit der Hochzahl genommen.",
        )
    }

    private fun decimalPower(gen: Gen): P? {
        val digit = gen.int(1..9)
        val n = gen.int(2..3)
        val base = Q(digit, 10)
        val value = base.power(n)
        if (listOf(value).decimals(6).size != 1) return null
        val text = "(${T.number(base)})${T.sup(n)}"
        // The comma one place off, base times exponent, one factor too few.
        val wrong = listOf(value * 10, value / 10, base * n, base.power(n - 1)).decimals(6)
        return P.number(
            prompt = "Berechne $text.",
            answer = value,
            hint = "Gib das Ergebnis als Dezimalzahl an.",
            wrong = wrong,
            pair = text,
            solution = "${T.number(base)} · ${T.number(base)}" + (if (n == 3) " · ${T.number(base)}" else "") + " = ${T.number(value)}",
            explanation = "Rechne die Faktoren mit Komma aus und zähle die Nachkommastellen: Jeder Faktor bringt eine Stelle.",
        )
    }

    /** "-3² oder (-3)²?" Brackets decide what is squared. */
    private fun negativeBase(level: Int, gen: Gen): P? {
        if (level == 3) {
            val a = gen.int(2..4)
            val b = gen.int(2..4)
            val value = -a * a + ipow(b, 3)
            if (value == 0) return null
            val text = "${T.minus}${a}² ${T.minus} (${T.minus}${b})³"
            // The first minus dropped, the cube's sign dropped, both dropped, products instead of powers.
            val wrong = listOf(a * a + ipow(b, 3), -a * a - ipow(b, 3), a * a - ipow(b, 3), -a * 2 + b * 3)
            return P.number(
                prompt = "Berechne $text.",
                answer = Q(value),
                hint = valueHint,
                wrong = wrong.map { Q(it) },
                pair = text,
                solution = "${T.minus}${a}² = ${T.minus}${a * a}; (${T.minus}${b})³ = ${T.minus}${ipow(b, 3)}; ${T.int(-a * a)} ${T.minus} (${T.minus}${ipow(b, 3)}) = ${T.int(value)}",
                explanation = "Ohne Klammer wird nur die Zahl potenziert, das Minus bleibt davor. Mit Klammer gehört das Minus zur Basis: ungerade Hochzahl gibt Minus, gerade gibt Plus.",
            )
        }
        val a = if (level == 1) gen.int(2..6) else gen.int(2..5)
        val n = if (level == 1) 2 else gen.int(2..4)
        val bracket = gen.chance(50)
        val value = if (bracket) (if (n % 2 == 0) ipow(a, n) else -ipow(a, n)) else -ipow(a, n)
        val text = if (bracket) "(${T.minus}${a})${T.sup(n)}" else "${T.minus}${a}${T.sup(n)}"
        val sign = if (value < 0) -1 else 1
        // Base times exponent, in either sign, one factor too many or too few.
        val wrong = listOf(a * n, -a * n, sign * ipow(a, n + 1), sign * ipow(a, n - 1))
        val working = if (bracket) "(${T.minus}${a})${T.sup(n)} = " + List(n) { "(${T.minus}${a})" }.joinToString(" · ") + " = ${T.int(value)}"
        else "${T.minus}${a}${T.sup(n)} = ${T.minus}(${List(n) { a.toString() }.joinToString(" · ")}) = ${T.int(value)}"
        return P.number(
            prompt = "Berechne $text.",
            answer = Q(value),
            hint = valueHint,
            wrong = wrong.map { Q(it) },
            pair = text,
            solution = working,
            explanation = if (bracket) "Mit Klammer gehört das Minus zur Basis: Bei gerader Hochzahl ist das Ergebnis positiv, bei ungerader negativ."
            else "Ohne Klammer wird nur die Zahl potenziert, das Minus bleibt davor: ${T.minus}${a}${T.sup(n)} ist das Negative von ${a}${T.sup(n)}.",
        )
    }

    /** "Berechne √144", "√0,49", "√(9/16)". */
    private fun squareRoot(level: Int, gen: Gen): P? {
        val kind: Int = when (level) {
            1 -> 0
            2 -> if (gen.chance(60)) 0 else 1
            else -> gen.int(1..2)
        }
        when (kind) {
            0 -> {
                val r = if (level == 1) gen.int(2..15) else gen.int(11..25)
                val n = r * r
                val wrong = mutableListOf(r + 1, r - 1, 2 * r)
                if (n % 2 == 0) wrong.add(n / 2)
                return P.number(
                    prompt = "Berechne √$n.",
                    answer = Q(r),
                    hint = valueHint,
                    wrong = wrong.map { Q(it) },
                    pair = "√$n",
                    solution = "${r}² = $n, also √$n = $r",
                    explanation = "Die Wurzel fragt nach der nichtnegativen Zahl, die quadriert den Wert unter der Wurzel ergibt. Lerne die Quadratzahlen bis 15² auswendig.",
                )
            }
            1 -> {
                val r = gen.pick(listOf(2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15))
                val places = if (level == 3 && gen.chance(40)) 4 else 2
                val radicand = Q(r * r, if (places == 2) 100 else 10000)
                val root = Q(r, if (places == 2) 10 else 100)
                // The comma set in the wrong place, the digits of the root alone, half of the radicand.
                val wrong = listOf(root / 10, root * 10, radicand / 2, Q(r)).decimals(5)
                return P.number(
                    prompt = "Berechne √${T.number(radicand)}.",
                    answer = root,
                    hint = "Gib das Ergebnis als Dezimalzahl an.",
                    wrong = wrong,
                    pair = "√${T.number(radicand)}",
                    solution = "${T.number(root)}² = ${T.number(radicand)}, also √${T.number(radicand)} = ${T.number(root)}",
                    explanation = "Bei Dezimalzahlen zählst du die Nachkommastellen: Das Quadrat hat doppelt so viele Stellen wie die Wurzel.",
                )
            }
            else -> {
                val q = gen.int(2..12)
                val p = gen.int(1..(q - 1))
                if (T.gcd(p, q) != 1) return null
                val root = Q(p, q)
                // The root of the numerator alone, of the denominator alone, half of the radicand.
                val wrong = listOf(Q(p, q * q), Q(p * p, q), Q(p * p, 2 * q * q), Q(p, 2 * q))
                return P.number(
                    prompt = "Berechne √(${p * p}/${q * q}).",
                    answer = root,
                    style = S.Fraction,
                    hint = "Gib das Ergebnis als Bruch an.",
                    wrong = wrong,
                    pair = "√(${p * p}/${q * q})",
                    solution = "√${p * p} = $p und √${q * q} = $q, also √(${p * p}/${q * q}) = $p/$q",
                    explanation = "Bei einem Bruch ziehst du die Wurzel aus Zähler und Nenner einzeln.",
                )
            }
        }
    }

    /** "Zwischen welchen ganzen Zahlen liegt √50?" The nearest squares decide. */
    private fun estimateRoot(level: Int, gen: Gen): P? {
        val n: Int = when (level) {
            1 -> gen.int(2..80)
            2 -> gen.int(10..150)
            else -> gen.int(30..400)
        }
        var low = 1
        while ((low + 1) * (low + 1) <= n) low += 1
        if (low * low == n || low < 1) return null
        // The square root of n is at least low and below low + 1; the nearest whole number by comparing n with low² + low.
        val nearest = if (n <= low * low + low) low else low + 1
        val correct = "$low und ${low + 1}"
        // The neighbouring pairs, and half of the number taken for the root.
        val wrong = listOf("${low - 1} und $low", "${low + 1} und ${low + 2}", "${low - 2} und ${low - 1}", "${n / 2} und ${n / 2 + 1}")
            .filter { it != correct && !it.startsWith("0 ") && !it.startsWith("-") }
        return P.text(
            prompt = "Zwischen welchen zwei aufeinanderfolgenden ganzen Zahlen liegt √$n?",
            correct = correct,
            wrong = wrong,
            typed = Ty("Welche ganze Zahl ist √$n am nächsten?", rat(nearest)),
            pair = "√$n",
            solution = "${low}² = ${low * low} und ${low + 1}² = ${(low + 1) * (low + 1)}; $n liegt dazwischen, also liegt √$n zwischen $low und ${low + 1}",
            explanation = "Suche die Quadratzahlen links und rechts vom Wert unter der Wurzel. Ihre Wurzeln sind die beiden ganzen Zahlen.",
        )
    }

    // Lesson 2

    /** One power as it is written: "2³", "x⁴", and just "x" for the exponent 1. */
    private fun powerText(base: String, exponent: Int): String = if (exponent == 1) base else T.power(base, exponent)

    /**
     * The wrong results of a law of powers: each wrong exponent written out, leaving out any that is not a sensible
     * exponent (zero, negative, huge) or that equals the right one.
     */
    private fun wrongPowers(base: String, exponents: List<Int>, right: Int): List<String> =
        exponents.filter { it >= 1 && it <= 40 && it != right }.map { powerText(base, it) }

    /** "2³ · 2⁴" and "5⁹ : 5⁶": same base, exponents added or subtracted. */
    private fun sameBase(level: Int, gen: Gen): P? {
        val useLetter = level >= 2 && gen.chance(55)
        val base = if (useLetter) letter(gen) else gen.pick(if (level == 1) listOf(2, 3, 5, 10) else listOf(2, 3, 4, 5, 6, 7, 10)).toString()
        val numeric = base.toIntOrNull()
        fun power(e: Int): String = powerText(base, e)
        val expression: String
        val exponent: Int
        val wrong: MutableList<String>
        val working: String
        val multiplies = level == 1 || (level == 2 && gen.chance(55))
        if (multiplies) {
            val e1 = gen.int(2..7)
            val e2 = gen.int(2..7)
            expression = "${power(e1)} · ${power(e2)}"
            exponent = e1 + e2
            // The exponents multiplied, subtracted, one too many; the bases multiplied.
            wrong = wrongPowers(base, listOf(e1 * e2, Math.abs(e1 - e2), e1 + e2 + 1), exponent).toMutableList()
            if (numeric != null) wrong.add(T.power(numeric * numeric, e1 + e2))
            working = "$expression = ${power(exponent)}, denn $e1 + $e2 = $exponent"
        } else if (level == 2) {
            val e2 = gen.int(2..5)
            val e1 = e2 + gen.int(2..6)
            expression = "${power(e1)} : ${power(e2)}"
            exponent = e1 - e2
            // The exponents added or multiplied, one too many; the bases divided to 1.
            wrong = wrongPowers(base, listOf(e1 + e2, e1 * e2, e1 + e2 - 1) + (if (e1 % e2 == 0) listOf(e1 / e2) else emptyList()), exponent).toMutableList()
            if (numeric != null) wrong.add(T.power(1, exponent))
            working = "$expression = ${power(exponent)}, denn $e1 ${T.minus} $e2 = $exponent"
        } else if (gen.chance(50)) {
            val e1 = gen.int(2..4)
            val e2 = gen.int(2..4)
            val e3 = gen.int(1..4)
            expression = "${power(e1)} · ${power(e2)} · ${power(e3)}"
            exponent = e1 + e2 + e3
            // All exponents multiplied, the order of operations ignored.
            wrong = wrongPowers(base, listOf(e1 * e2 * e3, e1 + e2 * e3, e1 * e2 + e3, exponent + 1), exponent).toMutableList()
            working = "$expression = ${power(exponent)}, denn $e1 + $e2 + $e3 = $exponent"
        } else {
            val e1 = gen.int(3..6)
            val e2 = gen.int(2..4)
            val e3 = gen.int(2..4)
            if (e1 + e2 <= e3) return null
            expression = "(${power(e1)} · ${power(e2)}) : ${power(e3)}"
            exponent = e1 + e2 - e3
            // Multiplied instead of added, everything added, subtracted twice.
            wrong = wrongPowers(base, listOf(e1 * e2 - e3, e1 + e2 + e3, e1 - e2 - e3, e1 + e2 * e3), exponent).toMutableList()
            working = "${power(e1)} · ${power(e2)} = ${power(e1 + e2)}; ${power(e1 + e2)} : ${power(e3)} = ${power(exponent)}"
        }
        if (exponent < 1) return null
        val problem = P.text(
            prompt = "Vereinfache zu einer Potenz:\n$expression",
            correct = power(exponent),
            wrong = wrong,
            typed = Ty("Vereinfache $expression zu einer Potenz.\nWelche Zahl steht im Exponenten?", rat(exponent)),
            pair = expression,
            solution = working,
            explanation = "Gleiche Basis: Beim Malnehmen addierst du die Exponenten, beim Teilen subtrahierst du sie. Die Basis bleibt.",
        )
        problem.pairPrompt = "Vereinfache und ordne zu."
        return problem
    }

    /** "(2³)²" and "(x⁴)³ : x⁵": a power of a power multiplies the exponents. */
    private fun powerOfPower(level: Int, gen: Gen): P? {
        val useLetter = level >= 2 || gen.chance(50)
        val base = if (useLetter) letter(gen) else gen.pick(listOf(2, 3, 5, 10)).toString()
        fun power(e: Int): String = powerText(base, e)
        val expression: String
        val exponent: Int
        val wrongExponents: List<Int>
        val working: String
        when (level) {
            1 -> {
                val e1 = gen.int(2..5)
                val e2 = gen.int(2..4)
                expression = "(${power(e1)})${T.sup(e2)}"
                exponent = e1 * e2
                // The exponents added, or one raised to the other.
                wrongExponents = listOf(e1 + e2, ipow(e1, e2), ipow(e2, e1))
                working = "$expression = ${power(exponent)}, denn $e1 · $e2 = $exponent"
            }
            2 -> {
                val e1 = gen.int(2..5)
                val e2 = gen.int(2..4)
                val e3 = gen.int(2..6)
                if (e1 * e2 <= e3) return null
                expression = "(${power(e1)})${T.sup(e2)} : ${power(e3)}"
                exponent = e1 * e2 - e3
                // Added in the bracket, everything multiplied, the quotient taken at the end.
                wrongExponents = listOf(e1 + e2 - e3, e1 * e2 * e3, e1 * e2 + e3, e1 * (e2 - e3))
                working = "(${power(e1)})${T.sup(e2)} = ${power(e1 * e2)}; ${power(e1 * e2)} : ${power(e3)} = ${power(exponent)}"
            }
            else -> {
                val e1 = gen.int(2..4)
                val e2 = gen.int(2..4)
                val e3 = gen.int(1..5)
                expression = "(${power(e1)})${T.sup(e2)} · ${power(e3)}"
                exponent = e1 * e2 + e3
                // The last factor put into the bracket, everything added, everything multiplied.
                wrongExponents = listOf(e1 * (e2 + e3), e1 + e2 + e3, e1 * e2 * e3, e1 + e2 * e3)
                working = "(${power(e1)})${T.sup(e2)} = ${power(e1 * e2)}; ${power(e1 * e2)} · ${power(e3)} = ${power(exponent)}"
            }
        }
        if (exponent < 2 || exponent > 40) return null
        val problem = P.text(
            prompt = "Vereinfache zu einer Potenz:\n$expression",
            correct = power(exponent),
            wrong = wrongPowers(base, wrongExponents, exponent),
            typed = Ty("Vereinfache $expression zu einer Potenz.\nWelche Zahl steht im Exponenten?", rat(exponent)),
            pair = expression,
            solution = working,
            explanation = "Eine Potenz von einer Potenz: Die Exponenten werden multipliziert. Gleiche Basen beim Malnehmen: addieren, beim Teilen: subtrahieren.",
        )
        problem.pairPrompt = "Vereinfache und ordne zu."
        return problem
    }

    /** "2³ · 5³ = ?³": the same exponent lets you put the bases together. */
    private fun sameExponent(level: Int, gen: Gen): P? = gen.attempt { sameExponentAttempt(level, gen) }

    private fun sameExponentAttempt(level: Int, gen: Gen): P? {
        val multiplies = level == 1 || (level == 2 && gen.chance(50)) || (level == 3 && gen.chance(30))
        val n = if (level == 1) 2 else gen.int(2..4)
        val a: Int
        val b: Int
        if (multiplies) {
            a = if (level == 1) gen.int(2..5) else gen.int(2..9)
            b = if (level == 1) gen.int(2..5) else gen.int(2..9)
        } else {
            b = if (level == 2) gen.int(2..6) else gen.int(3..9)
            a = b * (if (level == 2) gen.int(2..5) else gen.int(2..8))
        }
        if (!(a != b || !multiplies)) return null
        val result = if (multiplies) a * b else a / b
        if (result > 100 || result < 2) return null
        val expression = if (multiplies) "${T.power(a, n)} · ${T.power(b, n)}" else "${T.power(a, n)} : ${T.power(b, n)}"
        val correct = T.power(result, n)
        val wrong = if (multiplies) listOf(T.power(a + b, n), T.power(a * b, 2 * n), T.power(a * b, n + 1), T.power(a * b, n - 1))
        else listOf(T.power(a - b, n), T.power(a / b, 1), T.power(a / b, 2 * n))
        val problem = P.text(
            prompt = "Fasse zu einer Potenz zusammen:\n$expression",
            correct = correct,
            wrong = wrong.filter { it != correct && !it.endsWith("⁰") },
            typed = Ty("Fasse $expression zu einer Potenz zusammen.\nWelche Zahl steht in der Basis?", rat(result)),
            pair = expression,
            solution = if (multiplies) "$expression = ($a · $b)${T.sup(n)} = $correct" else "$expression = ($a : $b)${T.sup(n)} = $correct",
            explanation = "Haben zwei Potenzen denselben Exponenten, darfst du die Basen malnehmen oder teilen und den Exponenten behalten.",
        )
        problem.pairPrompt = "Fasse zusammen und ordne zu."
        return problem
    }

    // Lesson 3

    /** "2⁻³ als Bruch": a negative exponent takes the reciprocal. */
    private fun negativeExponent(level: Int, gen: Gen): P? = gen.attempt { negativeExponentAttempt(level, gen) }

    private fun negativeExponentAttempt(level: Int, gen: Gen): P? {
        val text: String
        val value: Q
        val wrong: List<Q>
        val working: String
        when (level) {
            1 -> {
                val base = gen.pick(listOf(2, 3, 10, 5))
                val n = if (base == 10) gen.int(1..3) else gen.int(1..3)
                value = Q(1, ipow(base, n))
                text = T.power(base, -n)
                wrong = listOf(Q(ipow(base, n)), Q(-base * n), Q(1, base * n), Q(1, ipow(base, maxOf(1, n - 1))))
                working = "$text = 1/${base}${T.sup(n)} = 1/${ipow(base, n)}"
            }
            2 -> {
                val base = gen.int(2..6)
                val n = gen.int(2..3)
                value = Q(1, ipow(base, n))
                text = T.power(base, -n)
                wrong = listOf(Q(ipow(base, n)), Q(1, base * n), Q(-base * n), Q(1, ipow(base, n - 1)), Q(1, ipow(base, n + 1)))
                working = "$text = 1/${base}${T.sup(n)} = 1/${ipow(base, n)}"
            }
            else -> {
                if (gen.chance(50)) {
                    // A fraction as base: the reciprocal of the fraction.
                    val b = gen.int(2..4)
                    val a = gen.int(1..(b + 1))
                    if (a == b || T.gcd(a, b) != 1) return null
                    val n = gen.int(2..3)
                    text = "($a/$b)${T.sup(-n)}"
                    value = Q(b, a).power(n)
                    wrong = listOf(Q(a, b).power(n), Q(-a * n, b), Q(b, a * n), Q(b * n, a))
                    working = "($a/$b)${T.sup(-n)} = ($b/$a)${T.sup(n)} = ${T.fraction(value)}"
                } else {
                    val base = gen.int(2..4)
                    val n = gen.pick(listOf(3, 5))
                    text = "(${T.minus}${base})${T.sup(-n)}"
                    value = Q(1, -ipow(base, n))
                    wrong = listOf(Q(ipow(base, n)), Q(-base * n), Q(1, base * n), Q(1, ipow(base, n - 1)))
                    working = "(${T.minus}${base})${T.sup(-n)} = 1/(${T.minus}${base})${T.sup(n)} = ${T.fraction(value)}"
                }
            }
        }
        if (!value.ok || !(Math.abs(value.double) < 1000) || wrong.filter { it.ok && it != value }.size < 2) return null
        return P.number(
            prompt = "Schreibe $text als Bruch oder ganze Zahl.",
            answer = value,
            style = S.Fraction,
            hint = "Gib das Ergebnis als Bruch oder ganze Zahl an, zum Beispiel 1/8.",
            wrong = wrong,
            pair = text,
            solution = working,
            explanation = "Ein negativer Exponent bedeutet den Kehrwert: a${T.sup(-2)} = 1/a². Das Vorzeichen des Exponenten ändert nicht das Vorzeichen der Zahl.",
        )
    }

    /** "Schreibe 45 000 in der Form a · 10ⁿ mit 1 ≤ a < 10." Big and small numbers. */
    private fun scientific(level: Int, gen: Gen): P? = gen.attempt { scientificAttempt(level, gen) }

    private fun scientificAttempt(level: Int, gen: Gen): P? {
        // The digits of the mantissa as 1 to 99: 7 stands for 7, 45 for 4,5.
        val digits = if (gen.chance(40)) gen.int(1..9) else gen.int(11..99)
        if (digits % 10 == 0) return null
        val hasDecimal = digits >= 10
        val mantissa = if (hasDecimal) Q(digits, 10) else Q(digits)
        val exponent: Int = when (level) {
            1 -> gen.int(2..5)
            2 -> gen.int(4..9)
            else -> -gen.int(2..7)
        }
        val value = mantissa * Q(10).power(exponent)
        if (!value.ok) return null
        val shown: String
        if (exponent >= 0) {
            val whole = value.int ?: return null
            shown = T.grouped(whole)
        } else {
            val places = -exponent + (if (hasDecimal) 1 else 0)
            shown = T.fixed(value, places)
        }
        fun form(m: Q, e: Int): String = "${T.number(m)} · 10${T.sup(e)}"
        val correct = form(mantissa, exponent)
        // Not normalised (the mantissa too big or too small), the exponent off by one, the wrong direction.
        val wrong = listOf(
            form(mantissa * 10, exponent - 1), form(mantissa / 10, exponent + 1), form(mantissa, exponent - 1),
            form(mantissa, exponent + 1), form(mantissa * 100, exponent - 2),
        )
        val problem = P.text(
            prompt = "Schreibe $shown in der Form a · 10ⁿ mit 1 ≤ a < 10.",
            correct = correct,
            wrong = wrong,
            typed = Ty("Schreibe $shown in der Form a · 10ⁿ mit 1 ≤ a < 10.\nWelche Zahl steht im Exponenten?", rat(exponent)),
            pair = shown,
            solution = if (exponent >= 0) "Das Komma wandert um $exponent Stellen nach rechts: $correct"
            else "Das Komma wandert um ${-exponent} Stellen nach links, der Exponent ist negativ: $correct",
            explanation = "Vor dem Komma soll genau eine Ziffer ungleich 0 stehen. Der Exponent zählt, um wie viele Stellen das Komma dafür wandert: nach links positiv, nach rechts negativ.",
        )
        problem.pairPrompt = "Schreibe mit Zehnerpotenz und ordne zu."
        return problem
    }

    /** "Berechne √(9 + 16)": the root of a sum is not the sum of the roots. */
    private fun rootOfSum(level: Int, gen: Gen): P? {
        val triples = listOf(
            Triple(3, 4, 5), Triple(6, 8, 10), Triple(5, 12, 13), Triple(9, 12, 15), Triple(8, 15, 17),
            Triple(12, 16, 20), Triple(7, 24, 25), Triple(15, 20, 25), Triple(20, 21, 29),
        )
        val (first, second, c) = gen.pick(if (level == 1) triples.take(3) else if (level == 2) triples.take(6) else triples)
        // The two legs in either order.
        val legs = if (gen.chance(50)) Pair(first, second) else Pair(second, first)
        val a = legs.first
        val b = legs.second
        val subtracts = level == 3 || (level == 2 && gen.chance(40))
        val text: String
        val value: Int
        val wrong: List<Int>
        val working: String
        if (subtracts) {
            val xy = if (gen.chance(50)) Pair(a, b) else Pair(b, a)
            val x = xy.first
            val y = xy.second
            text = "√(${c * c} ${T.minus} ${x * x})"
            value = y
            // The roots subtracted, the radicands subtracted without a root, half of that.
            wrong = listOf(c - x, c * c - x * x, (c * c - x * x) / 2, c + x)
            working = "${c * c} ${T.minus} ${x * x} = ${y * y}, also √${y * y} = $y"
        } else {
            text = "√(${a * a} + ${b * b})"
            value = c
            // The roots added, the radicands added without a root, half of that.
            wrong = listOf(a + b, a * a + b * b, (a * a + b * b) / 2, c + 1)
            working = "${a * a} + ${b * b} = ${c * c}, also √${c * c} = $c"
        }
        return P.number(
            prompt = "Berechne $text.",
            answer = Q(value),
            hint = valueHint,
            wrong = wrong.map { Q(it) },
            pair = text,
            solution = working,
            explanation = "Rechne zuerst unter der Wurzel. Die Wurzel einer Summe ist nicht die Summe der Wurzeln: √(9 + 16) = 5, aber √9 + √16 = 7.",
        )
    }

    /** "Berechne ³√125": the number that cubed gives the radicand. */
    private fun cubeRoot(level: Int, gen: Gen): P? {
        val r: Int = when (level) {
            1 -> gen.int(2..6)
            2 -> gen.int(3..10)
            else -> gen.int(2..9)
        }
        if (level == 3) {
            when (gen.int(0..2)) {
                0 -> {
                    // A negative radicand: the root is negative too.
                    val n = ipow(r, 3)
                    return cubeProblem("${T.minus}$n", Q(-r), "(${T.minus}${r})³ = ${T.minus}$n, also ³√(${T.minus}$n) = ${T.minus}$r", listOf(Q(r), Q(-r * r), Q(-3 * r), Q(r * r)), S.Plain, valueHint)
                }
                1 -> {
                    val radicand = Q(ipow(r, 3), 1000)
                    val root = Q(r, 10)
                    if (r % 10 == 0) return null
                    return cubeProblem(T.number(radicand), root, "${T.number(root)}³ = ${T.number(radicand)}, also ³√${T.number(radicand)} = ${T.number(root)}", listOf(root / 10, root * 10, root * 3, Q(r)), S.Plain, "Gib das Ergebnis als Dezimalzahl an.")
                }
                else -> {
                    val q = gen.int(2..5)
                    val p = gen.int(1..(q - 1))
                    if (T.gcd(p, q) != 1) return null
                    return cubeProblem("(${ipow(p, 3)}/${ipow(q, 3)})", Q(p, q), "³√${ipow(p, 3)} = $p und ³√${ipow(q, 3)} = $q, also $p/$q", listOf(Q(p, ipow(q, 3)), Q(ipow(p, 3), q), Q(p * 3, q), Q(p, q * 3)), S.Fraction, "Gib das Ergebnis als Bruch an.")
                }
            }
        }
        val n = ipow(r, 3)
        // The square instead of the root, three times the root, the root off by one, the number divided by 3.
        val wrong = mutableListOf(r * r, 3 * r, r + 1, r - 1)
        if (n % 3 == 0) wrong.add(n / 3)
        return cubeProblem(n.toString(), Q(r), "${r}³ = $n, also ³√$n = $r", wrong.map { Q(it) }, S.Plain, valueHint)
    }

    private fun cubeProblem(radicand: String, root: Q, working: String, wrong: List<Q>, style: MathMiddleStyle, hint: String): P? {
        val text = "³√" + (if (radicand.startsWith(T.minus)) "($radicand)" else radicand)
        val problem = P.number(
            prompt = "Berechne $text.",
            answer = root,
            style = style,
            hint = hint,
            wrong = wrong.filter { it.ok && !it.isZero },
            pair = text,
            solution = working,
            explanation = "Die dritte Wurzel fragt nach der Zahl, die hoch 3 den Wert unter der Wurzel ergibt. Aus einer negativen Zahl darf man sie ziehen.",
        )
        problem?.pairPrompt = "Berechne und ordne zu."
        return problem
    }
}
