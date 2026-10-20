package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/** Unit 2, Bruchrechnung: addieren und subtrahieren (lesson 1), multiplizieren und dividieren (2), gemischte Rechnungen und Sachaufgaben (3). */
object MathMiddleUnit02 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u02.add", 1, forms(CHOICE, TYPED, PAIRS), ::add),
            MathMiddleTemplate("u02.subtract", 1, forms(CHOICE, TYPED, PAIRS), ::subtract),
            MathMiddleTemplate("u02.mixedAddSub", 1, forms(CHOICE, TYPED, PAIRS), ::mixedAddSub),
            MathMiddleTemplate("u02.multiply", 2, forms(CHOICE, TYPED, PAIRS), ::multiply),
            MathMiddleTemplate("u02.divide", 2, forms(CHOICE, TYPED, PAIRS), ::divide),
            MathMiddleTemplate("u02.fitsIn", 2, forms(CHOICE, TYPED), ::fitsIn),
            MathMiddleTemplate("u02.partOfPart", 2, forms(CHOICE, TYPED), ::partOfPart),
            MathMiddleTemplate("u02.order", 3, forms(CHOICE, TYPED, PAIRS), ::order),
            MathMiddleTemplate("u02.word", 3, forms(CHOICE, TYPED), ::word),
            MathMiddleTemplate("u02.mixedMulDiv", 3, forms(CHOICE, TYPED, PAIRS), ::mixedMulDiv),
        )
    }

    private const val fractionHint = "Gib das Ergebnis als Bruch an, zum Beispiel 5/6."

    private fun show(q: Q): String = T.fraction(q)

    // Lesson 1

    /** "3/7 + 2/7", "1/2 + 1/3": the denominators first, then the numerators. */
    private fun add(level: Int, gen: Gen): P? {
        val (b, d) = denominators(level, gen)
        val first = gen.properFraction(listOf(b))
        val second = gen.properFraction(listOf(d))
        val sum = first + second
        if (!sum.ok || sum.denominator > 36) return null
        val a = first.numerator
        val c = second.numerator
        val common = T.lcm(b, d)
        val top = a * (common / b) + c * (common / d)
        var working = if (b == d) "${show(first)} + ${show(second)} = $top/$common"
        else "${show(first)} + ${show(second)} = ${a * (common / b)}/$common + ${c * (common / d)}/$common = $top/$common"
        if (T.gcd(top, common) > 1) working += " = ${show(sum)}"
        return P.number(
            prompt = "Berechne:\n${show(first)} + ${show(second)}",
            answer = sum,
            style = S.Fraction,
            hint = fractionHint,
            wrong = listOf(
                Q(a + c, b + d),
                Q(a + c, common),
                Q(a + c, b * d),
                first * second,
                Q(a * (common / b) + c, common),
            ),
            pair = "${show(first)} + ${show(second)}",
            solution = working,
            explanation = "Gleiche Nenner: die Zähler addieren. Verschiedene Nenner: erst auf den gemeinsamen Nenner erweitern, dann die Zähler addieren.",
        )
    }

    /** Two denominators for a sum or difference: equal or one a multiple of the other (level 1), small and different (level 2), up to 12 (level 3). */
    private fun denominators(level: Int, gen: Gen): Pair<Int, Int> {
        when (level) {
            1 -> {
                if (gen.chance(50)) { val b = gen.pick(listOf(3, 4, 5, 6, 7, 8, 10)); return Pair(b, b) }
                val b = gen.pick(listOf(2, 3, 4, 5))
                return Pair(b, b * gen.pick(listOf(2, 3)))
            }
            2 -> {
                val b = gen.pick(listOf(2, 3, 4, 5, 6))
                var d = gen.pick(listOf(2, 3, 4, 5, 6))
                if (d == b) d = if (b == 6) 4 else b + 1
                return Pair(b, d)
            }
            else -> {
                val b = gen.pick(listOf(3, 4, 5, 6, 8, 9, 10, 12))
                var d = gen.pick(listOf(3, 4, 5, 6, 8, 9, 10, 12))
                if (d == b) d = if (b == 12) 9 else b + 1
                return Pair(b, d)
            }
        }
    }

    /** "5/6 − 1/4": the larger fraction first, so the difference is positive. */
    private fun subtract(level: Int, gen: Gen): P? {
        val (b, d) = denominators(level, gen)
        var first = gen.properFraction(listOf(b))
        var second = gen.properFraction(listOf(d))
        if (first < second) { val t = first; first = second; second = t }
        val difference = first - second
        if (!difference.ok || difference.isZero || difference.denominator > 36) return null
        // After the swap the denominators belong to the other fractions.
        val fb = first.denominator
        val sd = second.denominator
        val a = first.numerator
        val c = second.numerator
        val common = T.lcm(fb, sd)
        val top = a * (common / fb) - c * (common / sd)
        var working = if (fb == sd) "${show(first)} − ${show(second)} = $top/$common"
        else "${show(first)} − ${show(second)} = ${a * (common / fb)}/$common − ${c * (common / sd)}/$common = $top/$common"
        if (T.gcd(top, common) > 1) working += " = ${show(difference)}"
        return P.number(
            prompt = "Berechne:\n${show(first)} − ${show(second)}",
            answer = difference,
            style = S.Fraction,
            hint = fractionHint,
            wrong = listOf(
                Q(a - c, fb - sd),
                Q(a - c, common),
                Q(a - c, fb * sd),
                Q(a * (common / fb) - c, common),
                first + second,
            ).filter { it.ok && !it.isNegative && !it.isZero },
            pair = "${show(first)} − ${show(second)}",
            solution = working,
            explanation = "Wie beim Addieren: erst auf den gemeinsamen Nenner erweitern, dann die Zähler subtrahieren. Der Nenner bleibt.",
        )
    }

    /** "2 3/4 + 1 1/2": the wholes and the fractions apart, then together. Level 3 subtracts and has to borrow. */
    private fun mixedAddSub(level: Int, gen: Gen): P? {
        val d1: Int
        val d2: Int
        when (level) {
            1 -> {
                d1 = gen.pick(listOf(3, 4, 5, 6, 8))
                d2 = d1
            }
            2 -> {
                d1 = gen.pick(listOf(2, 3, 4))
                d2 = d1 * gen.pick(listOf(1, 2))
            }
            else -> {
                d1 = gen.pick(listOf(3, 4, 6))
                d2 = gen.pick(listOf(3, 4, 6, 8, 12))
            }
        }
        val f1 = gen.properFraction(listOf(d1))
        val f2 = gen.properFraction(listOf(d2))
        val w1 = gen.int(level, 1..4, 2..6, 3..9)
        val w2 = gen.int(level, 1..3, 1..5, 1..(if (w1 - 1 > 0) w1 - 1 else 1))
        val first = Q(w1) + f1
        val second = Q(w2) + f2
        val subtracts = level == 3
        val result: Q
        val wrong: List<Q>
        if (subtracts) {
            // The borrowing case: the fraction of the first number is smaller than that of the second.
            if (!(f1 < f2 && w1 > w2)) return null
            result = first - second
            // Smaller from larger in the fractions; borrowing a whole without taking it off; the fractions forgotten.
            wrong = listOf(Q(w1 - w2) + (f2 - f1), Q(w1 - w2) + Q(1) + (f1 - f2), Q(w1 - w2))
        } else {
            if (level == 1 && (f1 + f2) >= Q(1)) return null
            result = first + second
            wrong = listOf(
                Q(w1 + w2) + Q(f1.numerator + f2.numerator, d1 + d2),
                Q(w1 + w2),
                Q(w1 + w2) + Q(f1.numerator + f2.numerator, d1),
            )
        }
        if (!result.ok || result.denominator > 24) return null
        val sign = if (subtracts) "−" else "+"
        val expression = "${T.mixed(first)} $sign ${T.mixed(second)}"
        val working = if (subtracts) "${T.mixed(first)} − ${T.mixed(second)} = ${show(first)} − ${show(second)} = ${T.mixed(result)}"
        else "${T.mixed(first)} + ${T.mixed(second)} = ${w1 + w2} + (${show(f1)} + ${show(f2)}) = ${T.mixed(result)}"
        return P.number(
            prompt = "Berechne:\n$expression",
            answer = result,
            style = S.Mixed,
            hint = "Gib das Ergebnis als gemischte Zahl oder Bruch an, zum Beispiel 2 1/4.",
            wrong = wrong.filter { it.ok && !it.isNegative },
            pair = expression,
            solution = working,
            explanation = if (subtracts) "Reicht der Bruch der ersten Zahl nicht aus, löst du ein Ganzes in Bruchteile auf. Oder du schreibst beide Zahlen als unechte Brüche."
            else "Rechne die Ganzen und die Brüche getrennt. Ist die Summe der Brüche größer als 1, gibt das ein weiteres Ganzes.",
        )
    }

    // Lesson 2

    /** "3 · 2/5", "3/4 · 2/9": numerator times numerator, denominator times denominator. */
    private fun multiply(level: Int, gen: Gen): P? {
        val first: Q
        val second: Q
        when (level) {
            1 -> {
                if (gen.chance(50)) {
                    first = Q(gen.int(2..6))
                    second = gen.properFraction(listOf(2, 3, 4, 5, 6, 8))
                } else {
                    first = Q(1, gen.int(2..6))
                    second = Q(1, gen.int(2..6))
                }
            }
            2 -> {
                first = gen.properFraction(listOf(3, 4, 5, 6, 8, 9))
                second = gen.properFraction(listOf(3, 4, 5, 6, 8, 9))
            }
            else -> {
                first = gen.properFraction(listOf(6, 7, 8, 9, 10, 12))
                second = Q(gen.int(5..11), gen.pick(listOf(3, 4, 5, 6, 7, 8, 9)))
            }
        }
        val product = first * second
        if (!product.ok || product.numerator > 60 || product.denominator > 60) return null
        val a = first.numerator
        val b = first.denominator
        val c = second.numerator
        val d = second.denominator
        val working = "${show(first)} · ${show(second)} = ${a * c}/${b * d}" + (if (T.gcd(a * c, b * d) > 1) " = ${show(product)}" else "")
        return P.number(
            prompt = "Berechne:\n${show(first)} · ${show(second)}",
            answer = product,
            style = S.Fraction,
            hint = fractionHint,
            wrong = listOf(Q(a * c, b + d), first / second, first + second, Q(a * c, b)).filter { !it.isWhole || product.isWhole },
            pair = "${show(first)} · ${show(second)}",
            solution = working,
            explanation = "Zähler mal Zähler und Nenner mal Nenner. Kürzen kannst du schon vor dem Multiplizieren.",
        )
    }

    /** "3/4 : 3/8": multiply by the reciprocal of the second number. */
    private fun divide(level: Int, gen: Gen): P? {
        val first: Q
        val second: Q
        when (level) {
            1 -> {
                if (gen.chance(50)) {
                    first = gen.properFraction(listOf(3, 4, 5, 6, 8))
                    second = Q(gen.int(2..5))
                } else {
                    first = Q(gen.int(2..5))
                    second = Q(1, gen.pick(listOf(2, 3, 4, 5)))
                }
            }
            2 -> {
                first = gen.properFraction(listOf(3, 4, 5, 6, 8, 9, 10))
                second = gen.properFraction(listOf(3, 4, 5, 6, 8, 9, 10))
            }
            else -> {
                first = Q(gen.int(3..11), gen.pick(listOf(4, 5, 6, 8, 9, 10, 12)))
                second = gen.properFraction(listOf(4, 5, 6, 8, 9, 10, 12))
            }
        }
        val quotient = first / second
        if (!quotient.ok || first == second || quotient.numerator > 24 || quotient.denominator > 24) return null
        // The reciprocal of the second number as it is written.
        val flipped = second.reciprocal
        val working = "${show(first)} : ${show(second)} = ${show(first)} · ${show(flipped)} = ${show(quotient)}"
        return P.number(
            prompt = "Berechne:\n${show(first)} : ${show(second)}",
            answer = quotient,
            style = S.Fraction,
            hint = fractionHint,
            wrong = listOf(first * second, second / first, (first * second).reciprocal),
            pair = "${show(first)} : ${show(second)}",
            solution = working,
            explanation = "Durch einen Bruch teilst du, indem du mit seinem Kehrwert malnimmst. Nur der zweite Bruch wird umgedreht.",
        )
    }

    /** "Wie viele Gläser zu 1/4 l füllst du mit 3 l?" A division of an amount by a fraction, in words. */
    private fun fitsIn(level: Int, gen: Gen): P? {
        val portion: Q
        val count: Int
        when (level) {
            1 -> {
                portion = Q(1, gen.pick(listOf(2, 3, 4, 5, 8)))
                count = gen.int(2..5) * portion.denominator
            }
            2 -> {
                portion = gen.properFraction(listOf(3, 4, 5, 6, 8))
                count = gen.int(3..12)
            }
            else -> {
                portion = gen.properFraction(listOf(4, 5, 6, 8, 9, 10, 12))
                count = gen.int(4..15)
            }
        }
        val total = portion * count
        if (!total.ok || total.denominator > 12 || total.double > 40) return null
        val question: String
        val unit: String
        when (gen.int(0..2)) {
            0 -> {
                unit = "l"
                question = "Aus ${T.amount(total)} l Saft werden Gläser zu ${show(portion)} l gefüllt.\nWie viele Gläser werden voll?"
            }
            1 -> {
                unit = "m"
                question = "Ein Band ist ${T.amount(total)} m lang. Daraus werden Stücke zu ${show(portion)} m geschnitten.\nWie viele Stücke sind das?"
            }
            else -> {
                unit = "kg"
                question = "Ein Sack enthält ${T.amount(total)} kg Mehl. Jede Tüte fasst ${show(portion)} kg.\nWie viele Tüten werden gefüllt?"
            }
        }
        return P.number(
            prompt = question,
            answer = Q(count),
            hint = "Gib nur die Zahl an.",
            wrong = listOf(total * portion, portion / total, total * portion.denominator),
            solution = "${T.amount(total)} $unit : ${show(portion)} $unit = ${show(total)} · ${show(portion.reciprocal)} = $count",
            explanation = "Gefragt ist, wie oft der Bruchteil in die Gesamtmenge passt. Das ist eine Division durch den Bruch.",
        )
    }

    /** "Lena isst 2/3 von 3/4 einer Torte": "von" means times. */
    private fun partOfPart(level: Int, gen: Gen): P? {
        val first: Q
        val second: Q
        when (level) {
            1 -> {
                first = Q(1, gen.int(2..5))
                second = Q(1, gen.int(2..5))
            }
            2 -> {
                first = gen.properFraction(listOf(3, 4, 5, 6))
                second = gen.properFraction(listOf(3, 4, 5, 6))
            }
            else -> {
                first = gen.properFraction(listOf(6, 8, 9, 10, 12))
                second = gen.properFraction(listOf(4, 5, 6, 8, 9))
            }
        }
        val product = first * second
        if (!product.ok || product.denominator > 60) return null
        val a = first.numerator
        val b = first.denominator
        val c = second.numerator
        val d = second.denominator
        val question = when (gen.int(0..2)) {
            0 -> "Von einer Torte sind noch ${show(first)} übrig. Lena isst ${show(second)} davon.\nWelcher Bruchteil der ganzen Torte ist das?"
            1 -> "Ein Tank ist zu ${show(first)} gefüllt. Davon werden ${show(second)} verbraucht.\nWelcher Bruchteil des ganzen Tanks ist das?"
            else -> "${show(first)} der Klasse sind Mädchen, ${show(second)} davon spielen Fußball.\nWelcher Bruchteil der Klasse ist das?"
        }
        return P.number(
            prompt = question,
            answer = product,
            style = S.Fraction,
            hint = fractionHint,
            wrong = listOf(first + second, first / second, second / first, Q(a * c, b + d)).filter { it.ok && !it.isWhole },
            solution = "${show(second)} von ${show(first)} = ${show(second)} · ${show(first)} = ${a * c}/${b * d}" + (if (T.gcd(a * c, b * d) > 1) " = ${show(product)}" else ""),
            explanation = "„Davon“ und „von“ bedeuten malnehmen: Ein Bruchteil von einem Bruchteil ist das Produkt der Brüche.",
        )
    }

    // Lesson 3

    /** "1/2 + 1/3 · 3/4": multiplication and division before addition and subtraction, brackets first. */
    private fun order(level: Int, gen: Gen): P? {
        val dens = if (level == 1) listOf(2, 3, 4) else listOf(2, 3, 4, 5, 6)
        val a = gen.properFraction(dens)
        val b = gen.properFraction(dens)
        val c = gen.properFraction(dens)
        val kinds = if (level == 1) listOf(0) else if (level == 2) listOf(0, 1, 2) else listOf(1, 2, 3)
        val kind = gen.pick(kinds)
        val expression: String
        val result: Q
        var wrong: List<Q>
        when (kind) {
            0 -> {
                expression = "${show(a)} + ${show(b)} · ${show(c)}"
                result = a + b * c
                wrong = listOf((a + b) * c, a + b + c, Q(a.numerator + (b * c).numerator, a.denominator + (b * c).denominator))
            }
            1 -> {
                expression = "(${show(a)} + ${show(b)}) · ${show(c)}"
                result = (a + b) * c
                wrong = listOf(a + b * c, a + b + c, a * c + b)
            }
            2 -> {
                if (!(a > b / c)) return null
                expression = "${show(a)} − ${show(b)} : ${show(c)}"
                result = a - b / c
                wrong = listOf((a - b) / c, a - b - c, a - b * c).filter { !it.isNegative }
            }
            else -> {
                if (!(a > b)) return null
                expression = "(${show(a)} − ${show(b)}) : ${show(c)}"
                result = (a - b) / c
                wrong = listOf(a - b / c, a - b * c, (a - b) * c).filter { !it.isNegative }
            }
        }
        if (!result.ok || result.isNegative || result.isZero || result.denominator > 60 || result.numerator > 60) return null
        wrong = wrong.filter { it.ok && !it.isNegative && it.denominator <= 200 }
        val rule = when (kind) {
            0 -> "Punkt vor Strich: erst ${show(b)} · ${show(c)} = ${show(b * c)}, dann ${show(a)} + ${show(b * c)} = ${show(result)}"
            1 -> "Klammer zuerst: ${show(a)} + ${show(b)} = ${show(a + b)}, dann ${show(a + b)} · ${show(c)} = ${show(result)}"
            2 -> "Punkt vor Strich: erst ${show(b)} : ${show(c)} = ${show(b / c)}, dann ${show(a)} − ${show(b / c)} = ${show(result)}"
            else -> "Klammer zuerst: ${show(a)} − ${show(b)} = ${show(a - b)}, dann ${show(a - b)} : ${show(c)} = ${show(result)}"
        }
        return P.number(
            prompt = "Berechne:\n$expression",
            answer = result,
            style = S.Fraction,
            hint = fractionHint,
            wrong = wrong,
            pair = expression,
            solution = rule,
            explanation = "Klammern zuerst, dann Punkt vor Strich. Wer einfach von links nach rechts rechnet, kommt hier zu einem falschen Ergebnis.",
        )
    }

    /** Short stories: what is left, and the share of one portion. */
    private fun word(level: Int, gen: Gen): P? {
        if (gen.chance(55)) {
            val dens = if (level == 1) listOf(4, 5, 6, 8, 10) else listOf(3, 4, 5, 6, 8, 10, 12)
            val a = gen.properFraction(dens)
            val b = gen.properFraction(dens)
            val used = a + b
            if (!used.ok || !(used < Q(1)) || used.denominator > 60 || (Q(1) - used).denominator > 60) return null
            val rest = Q(1) - used
            val question = when (gen.int(0..2)) {
                0 -> "Max liest am Montag ${show(a)} eines Buches und am Dienstag ${show(b)}.\nWelcher Bruchteil des Buches ist noch übrig?"
                1 -> "Lena gibt ${show(a)} ihres Taschengelds fürs Kino und ${show(b)} für Süßigkeiten aus.\nWelcher Bruchteil bleibt übrig?"
                else -> "Ein Fass ist voll. Am ersten Tag werden ${show(a)} entnommen, am zweiten ${show(b)}.\nWelcher Bruchteil ist noch im Fass?"
            }
            return P.number(
                prompt = question,
                answer = rest,
                style = S.Fraction,
                hint = fractionHint,
                wrong = listOf(used, Q(1) - a, Q(1) - b, Q(1) - Q(a.numerator + b.numerator, a.denominator + b.denominator)),
                solution = "${show(a)} + ${show(b)} = ${show(used)}; 1 − ${show(used)} = ${show(rest)}",
                explanation = "Zähle zusammen, was verbraucht ist, und ziehe die Summe vom Ganzen (1) ab.",
            )
        }
        val portions = gen.int(2..6)
        val amount = gen.properFraction(if (level == 1) listOf(2, 3, 4) else listOf(3, 4, 5, 6, 8))
        val each = amount / portions
        if (!each.ok || each.denominator > 60) return null
        val unit = gen.pick(listOf("l", "kg"))
        val thing = if (unit == "l") "Milch" else "Mehl"
        return P.number(
            prompt = "Für $portions Portionen braucht man ${show(amount)} $unit $thing.\nWie viel ${if (unit == "l") "Milch" else "Mehl"} ist das für eine Portion?",
            answer = each,
            style = S.FractionUnit(unit),
            hint = "Gib das Ergebnis als Bruch an, ohne Einheit.",
            wrong = listOf(amount * portions, Q(portions) / amount, Q(1, portions), Q(amount.numerator, amount.denominator + portions)),
            solution = "${show(amount)} : $portions = ${show(each)} $unit",
            explanation = "Eine Portion ist ein Teil von mehreren gleichen: Teile die Gesamtmenge durch die Zahl der Portionen.",
        )
    }

    /** "2 1/2 · 4/5", "1 1/3 : 2/3": mixed numbers become improper fractions first. */
    private fun mixedMulDiv(level: Int, gen: Gen): P? {
        val dens = if (level == 1) listOf(2, 3, 4) else listOf(2, 3, 4, 5, 6)
        val whole = gen.int(level, 1..2, 1..3, 2..4)
        val fraction = gen.properFraction(dens)
        val mixed = Q(whole) + fraction
        val other = gen.properFraction(if (level == 1) listOf(2, 3, 4) else listOf(3, 4, 5, 6, 8))
        val divides = level >= 2 && gen.chance(45)
        val result = if (divides) mixed / other else mixed * other
        if (!result.ok || result.numerator > 40 || result.denominator > 40) return null
        val sign = if (divides) ":" else "·"
        val improper = Q(whole * fraction.denominator + fraction.numerator, fraction.denominator)
        // The typical mistakes: the whole times the fraction, whole plus numerator over the denominator, the whole left alone.
        val wholeTimes = Q(whole) * fraction
        val sum = Q(whole + fraction.numerator, fraction.denominator)
        val wrong: List<Q> = if (divides) listOf(wholeTimes / other, sum / other, mixed * other, Q(whole) + fraction / other)
        else listOf(wholeTimes * other, sum * other, Q(whole) + fraction * other, mixed + other)
        val expression = "${T.mixed(mixed)} $sign ${show(other)}"
        val step = if (divides) "${show(improper)} · ${show(other.reciprocal)}" else "${show(improper)} · ${show(other)}"
        return P.number(
            prompt = "Berechne:\n$expression",
            answer = result,
            style = S.Fraction,
            hint = fractionHint,
            wrong = wrong.filter { it.ok && it.denominator <= 200 },
            pair = expression,
            solution = "${T.mixed(mixed)} $sign ${show(other)} = ${show(improper)} $sign ${show(other)} = $step = ${show(result)}",
            explanation = "Wandle die gemischte Zahl zuerst in einen unechten Bruch um; dann multiplizierst du oder teilst wie bei gewöhnlichen Brüchen.",
        )
    }
}
