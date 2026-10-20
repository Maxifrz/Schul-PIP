package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/** Unit 1, Brüche verstehen: Bruchteile und gemischte Zahlen (lesson 1), erweitern und kürzen (2), vergleichen und ordnen (3). */
object MathMiddleUnit01 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u01.fractionOf", 1, forms(CHOICE, TYPED, PAIRS), ::fractionOf),
            MathMiddleTemplate("u01.share", 1, forms(CHOICE, TYPED, PAIRS), ::share),
            MathMiddleTemplate("u01.mixedToImproper", 1, forms(CHOICE, TYPED, PAIRS), ::mixedToImproper),
            MathMiddleTemplate("u01.improperToMixed", 1, forms(CHOICE, TYPED, PAIRS), ::improperToMixed),
            MathMiddleTemplate("u01.equivalent", 2, forms(CHOICE, TYPED, PAIRS), ::equivalent),
            MathMiddleTemplate("u01.reduce", 2, forms(CHOICE, TYPED, PAIRS), ::reduce),
            MathMiddleTemplate("u01.isReduced", 2, forms(CHOICE), ::isReduced),
            MathMiddleTemplate("u01.compare", 3, forms(CHOICE, TYPED, PAIRS), ::compare),
            MathMiddleTemplate("u01.order", 3, forms(CHOICE, TYPED), ::order),
            MathMiddleTemplate("u01.between", 3, forms(CHOICE), ::between),
        )
    }

    // Lesson 1

    /** "Berechne 3/8 von 40 €." The unit fraction first, then as many of them as the numerator says. */
    private fun fractionOf(level: Int, gen: Gen): P? {
        val denominator = gen.pick(if (level == 1) listOf(3, 4, 5, 10) else if (level == 2) listOf(3, 4, 5, 6, 8, 10, 12) else listOf(6, 7, 8, 9, 11, 12, 15))
        val numerator = if (level == 3) gen.int(2..(denominator - 1)) else gen.int(1..minOf(denominator - 1, if (level == 1) 3 else denominator - 1))
        if (T.gcd(numerator, denominator) != 1) return null
        val step = gen.int(level, 2..5, 3..12, 4..15)
        val whole = denominator * step
        val result = numerator * step
        val unit = if (gen.chance(25)) "" else gen.pick(listOf("€", "kg", "m", "l", "cm", "min"))
        val suffix = if (unit.isEmpty()) "" else " $unit"
        val fraction = "$numerator/$denominator"
        return P.number(
            prompt = "Berechne $fraction von $whole$suffix.",
            answer = Q(result),
            style = if (unit.isEmpty()) S.Plain else S.Unit(unit),
            hint = "Gib nur die Zahl an.",
            wrong = listOf(Q(step), Q(whole * numerator), Q(whole * denominator), Q(whole - result)),
            pair = "$fraction von $whole$suffix",
            solution = "$whole : $denominator = $step und $step · $numerator = $result",
            explanation = "Teile die Größe durch den Nenner (das ist ein Teil) und multipliziere mit dem Zähler (so viele Teile).",
        )
    }

    /** "Von 12 Kugeln sind 9 rot. Welcher Bruchteil ist das?" */
    private fun share(level: Int, gen: Gen): P? {
        val total = gen.int(level, 4..10, 8..20, 12..36)
        val part = gen.int(1..(total - 1))
        val divisor = T.gcd(part, total)
        if (!(if (level == 3) divisor > 1 else divisor == 1) || part * 2 == total) return null
        val fraction = Q(part, total)
        val question = when (gen.int(0..3)) {
            0 -> "Eine Urne enthält $total Kugeln, $part davon sind rot.\nWelcher Bruchteil der Kugeln ist rot?"
            1 -> "In einer Klasse mit $total Kindern kommen $part mit dem Fahrrad.\nWelcher Bruchteil der Klasse ist das?"
            2 -> "Ein Kuchen ist in $total gleich große Stücke geschnitten, $part sind gegessen.\nWelcher Bruchteil ist gegessen?"
            else -> "Lena hat $part von $total Aufgaben richtig gelöst.\nWelcher Bruchteil ist richtig?"
        }
        return P.number(
            prompt = question + (if (level == 3) "\nGib den Bruch vollständig gekürzt an." else ""),
            answer = fraction,
            style = S.Fraction,
            hint = "Gib den Bruch an, zum Beispiel 3/8.",
            wrong = listOf(Q(total - part, total), Q(total, part), Q(part, total - part), Q(part, total + part)).filter { !it.isWhole },
            typedPrompt = question,
            pair = "$part von $total",
            solution = if (divisor > 1) "$part von $total ist $part/$total = ${T.fraction(fraction)}" else "$part von $total ist $part/$total",
            explanation = "Der Nenner zählt alle gleichen Teile, der Zähler die Teile, um die es geht.",
        )
    }

    /** "Schreibe 2 3/5 als unechten Bruch." */
    private fun mixedToImproper(level: Int, gen: Gen): P? {
        // A numerator of 1 makes most typical mistakes come out the same, so the numerator is at least 2.
        val denominator = gen.int(level, 3..5, 3..9, 5..12)
        val numerator = gen.int(2..(denominator - 1))
        if (T.gcd(numerator, denominator) != 1) return null
        val whole = gen.int(level, 1..3, 2..6, 3..9)
        val top = whole * denominator + numerator
        val mixed = "$whole $numerator/$denominator"
        return P.number(
            prompt = "Schreibe $mixed als unechten Bruch.",
            answer = Q(top, denominator),
            style = S.Fraction,
            hint = "",
            wrong = listOf(
                Q(whole * numerator + denominator, denominator),
                Q(top, numerator),
                Q(whole + numerator, denominator),
                Q(whole * denominator - numerator, denominator),
                Q(numerator * denominator + whole, denominator),
            ).filter { !it.isWhole },
            typedPrompt = "Schreibe $mixed als unechten Bruch mit dem Nenner $denominator.\nWie lautet der Zähler?",
            typedAnswer = Q(top),
            pair = mixed,
            solution = "$mixed = ($whole · $denominator + $numerator)/$denominator = $top/$denominator",
            explanation = "Ganze mal Nenner plus Zähler ergibt den neuen Zähler; der Nenner bleibt.",
        )
    }

    /** "Schreibe 13/5 als gemischte Zahl." */
    private fun improperToMixed(level: Int, gen: Gen): P? {
        val denominator = gen.int(level, 2..5, 3..9, 5..12)
        val numerator = gen.int(1..(denominator - 1))
        if (T.gcd(numerator, denominator) != 1) return null
        val whole = gen.int(level, 1..3, 2..6, 3..9)
        val top = whole * denominator + numerator
        val improper = "$top/$denominator"
        val correct = Q(top, denominator)
        val extra = mutableListOf(
            W("${whole + 1} $numerator/$denominator", (Q(whole + 1) + Q(numerator, denominator)).value),
            W("$whole $numerator/$top", (Q(whole) + Q(numerator, top)).value),
        )
        if (whole < denominator) extra.add(W("$numerator $whole/$denominator", (Q(numerator) + Q(whole, denominator)).value))
        if (whole >= 2) extra.add(W("${whole - 1} $numerator/$denominator", (Q(whole - 1) + Q(numerator, denominator)).value))
        val askWhole = gen.chance(50)
        return P.number(
            prompt = "Schreibe $improper als gemischte Zahl.",
            answer = correct,
            style = S.Mixed,
            hint = "",
            wrong = emptyList(),
            extraWrong = extra,
            typedPrompt = if (askWhole) "Wie viele ganze Einheiten stecken in $improper?"
            else "Schreibe $improper als gemischte Zahl.\nWie lautet der Zähler des Bruchteils?",
            typedAnswer = Q(if (askWhole) whole else numerator),
            pair = improper,
            solution = "$top : $denominator = $whole Rest $numerator, also $whole $numerator/$denominator",
            explanation = "Teile den Zähler durch den Nenner: Das Ergebnis sind die Ganzen, der Rest ist der neue Zähler.",
        )
    }

    // Lesson 2

    /** "3/4 = ?/20" or "18/24 = 3/?": the same number with the numerator and denominator changed by one factor. */
    private fun equivalent(level: Int, gen: Gen): P? {
        val baseDenominator = gen.int(level, 2..6, 3..9, 4..12)
        val baseNumerator = gen.int(1..(baseDenominator - 1))
        if (T.gcd(baseNumerator, baseDenominator) != 1) return null
        val factor = gen.int(level, 2..5, 2..9, 3..12)
        val reduces = level > 1 && gen.chance(40)
        val a = if (reduces) baseNumerator * factor else baseNumerator
        val b = if (reduces) baseDenominator * factor else baseDenominator
        val c = if (reduces) baseNumerator else baseNumerator * factor
        val d = if (reduces) baseDenominator else baseDenominator * factor
        val blankNumerator = gen.chance(50)
        val equation = if (blankNumerator) "$a/$b = ?/$d" else "$a/$b = $c/?"
        val answer = if (blankNumerator) c else d
        val shifted: Int
        val unchanged: Int
        val copied: Int
        val crossed: Int
        if (blankNumerator) {
            shifted = a + (d - b); unchanged = a; copied = d; crossed = a * d
        } else {
            shifted = b + (c - a); unchanged = b; copied = c; crossed = b * c
        }
        val verb = if (reduces) "gekürzt" else "erweitert"
        return P.number(
            prompt = "Welche Zahl gehört auf das Fragezeichen?\n$equation",
            answer = Q(answer),
            hint = "Gib nur die fehlende Zahl an.",
            wrong = listOf(Q(shifted), Q(unchanged), Q(copied), Q(crossed)).filter { it.numerator > 0 },
            typedPrompt = "Welche Zahl gehört auf das Fragezeichen?\n$equation",
            pair = equation,
            solution = "Der Bruch wird mit $factor $verb: $a/$b = $c/$d",
            explanation = "Zähler und Nenner müssen mit derselben Zahl multipliziert (erweitern) oder durch dieselbe Zahl geteilt (kürzen) werden.",
        )
    }

    /** "Kürze vollständig: 18/24". The typical mistakes: stopping early, subtracting, reducing only one part. */
    private fun reduce(level: Int, gen: Gen): P? {
        val denominator = gen.int(level, 3..6, 4..9, 5..12)
        val numerator = gen.int(1..(denominator - 1))
        if (T.gcd(numerator, denominator) != 1) return null
        val divisor = gen.int(level, 2..5, 3..9, 6..12)
        val a = numerator * divisor
        val b = denominator * divisor
        val reduced = Q(numerator, denominator)
        // Divisors that stop short of the greatest one: the typical "not reduced all the way".
        val stops = (2 until divisor).filter { divisor % it == 0 }
        val wrong = mutableListOf<W>()
        val stop = if (stops.isEmpty()) null else gen.pick(stops)
        if (stop != null) wrong.add(W("${a / stop}/${b / stop}", reduced.value))
        if (b - divisor > 0 && a - divisor > 0) wrong.add(W("${a - divisor}/${b - divisor}", Q(a - divisor, b - divisor).value))
        wrong.add(W("$numerator/$b", Q(numerator, b).value))
        wrong.add(W("$a/$denominator", Q(a, denominator).value))
        wrong.add(W("$denominator/$numerator", Q(denominator, numerator).value))
        val problem = P.text(
            prompt = "Kürze vollständig:\n$a/$b",
            correct = "$numerator/$denominator",
            wrong = emptyList(),
            typed = Ty(
                "Du kürzt $a/$b so weit wie möglich.\nDurch welche Zahl teilst du dafür Zähler und Nenner?\nGib die Zahl an.",
                rat(divisor),
            ),
            pair = "$a/$b",
            solution = "ggT($a, $b) = $divisor; $a : $divisor = $numerator und $b : $divisor = $denominator, also $numerator/$denominator",
            explanation = "Kürze mit dem größten gemeinsamen Teiler von Zähler und Nenner; dann geht es nicht weiter.",
        )
        problem.correctValue = reduced.value
        problem.wrong = wrong
        problem.allowsEquivalentWrong = true
        problem.pairPrompt = "Kürze vollständig und ordne zu."
        return problem
    }

    /** "Welcher Bruch lässt sich nicht mehr kürzen?" One fraction is different from the three others. */
    private fun isReduced(level: Int, gen: Gen): P? {
        val limit = if (level == 1) 12 else if (level == 2) 20 else 40
        val asksReducible = gen.chance(35)
        fun fraction(coprime: Boolean): Pair<Int, Int>? {
            repeat(40) {
                val b = gen.int(4..limit)
                val a = gen.int(2..(b - 1))
                if ((T.gcd(a, b) == 1) == coprime) return Pair(a, b)
            }
            return null
        }
        // The odd one out, then three of the other kind.
        val odd = fraction(!asksReducible) ?: return null
        val others = mutableListOf<Pair<Int, Int>>()
        val seen = hashSetOf("${odd.first}/${odd.second}")
        repeat(30) {
            if (others.size < 3) {
                val candidate = fraction(asksReducible)
                if (candidate != null && seen.add("${candidate.first}/${candidate.second}")) others.add(candidate)
            }
        }
        if (others.size != 3) return null
        val oddText = "${odd.first}/${odd.second}"
        val divisor = T.gcd(odd.first, odd.second)
        val solution = if (asksReducible) "ggT(${odd.first}, ${odd.second}) = $divisor, also $oddText = ${T.fraction(Q(odd.first, odd.second))}"
        else "ggT(${odd.first}, ${odd.second}) = 1, also lässt sich $oddText nicht weiter kürzen"
        return P.text(
            prompt = if (asksReducible) "Welcher Bruch lässt sich noch kürzen?" else "Welcher Bruch lässt sich nicht mehr kürzen?",
            correct = oddText,
            wrong = others.map { "${it.first}/${it.second}" },
            solution = solution,
            explanation = "Ein Bruch ist vollständig gekürzt, wenn Zähler und Nenner außer der 1 keinen gemeinsamen Teiler haben.",
        )
    }

    // Lesson 3

    /** "Welcher Bruch ist größer: 5/8 oder 7/12?" */
    private fun compare(level: Int, gen: Gen): P? {
        val b: Int
        val d: Int
        val a: Int
        val c: Int
        when (level) {
            1 -> {
                b = gen.int(4..12)
                d = b
                a = gen.int(1..(b - 1))
                c = gen.int(1..(b - 1))
            }
            2 -> {
                b = gen.pick(listOf(2, 3, 4, 5, 6))
                d = b * gen.int(2..4)
                a = gen.int(1..(b - 1))
                c = gen.int(1..(d - 1))
            }
            else -> {
                b = gen.int(3..12)
                d = gen.int(3..12)
                if (b == d || !(T.gcd(b, d) < minOf(b, d))) return null
                a = gen.int(1..(b - 1))
                c = gen.int(1..(d - 1))
            }
        }
        val left = Q(a, b)
        val right = Q(c, d)
        if (left == right) return null
        val common = T.lcm(b, d)
        val leftTop = a * (common / b)
        val rightTop = c * (common / d)
        val leftText = "$a/$b"
        val rightText = "$c/$d"
        val leftIsLarger = left > right
        val larger = if (leftIsLarger) leftText else rightText
        val smaller = if (leftIsLarger) rightText else leftText
        val problem = P.text(
            prompt = "Welcher Bruch ist größer?\n$leftText oder $rightText",
            correct = larger,
            wrong = listOf(smaller, "Beide sind gleich groß."),
            typed = Ty(
                "Bringe $leftText und $rightText auf den Nenner $common.\nWie lautet der größere der beiden Zähler?",
                rat(maxOf(leftTop, rightTop)),
            ),
            pair = "$leftText oder $rightText",
            solution = "Nenner $common: $leftText = $leftTop/$common und $rightText = $rightTop/$common, also ist $larger größer",
            explanation = "Bring Brüche auf denselben Nenner; dann entscheidet der Zähler, welcher Bruch größer ist.",
        )
        problem.pairPrompt = "Ordne jedem Paar den größeren Bruch zu."
        return problem
    }

    /** "Ordne der Größe nach, der kleinste zuerst: 3/4, 1/2, 5/6" */
    private fun order(level: Int, gen: Gen): P? {
        val fractions: List<Pair<Int, Int>>
        when (level) {
            1 -> {
                // The same numerator: the bigger the denominator, the smaller the fraction.
                val numerator = gen.int(1..3)
                val denominators = gen.shuffled(listOf(4, 5, 6, 8, 10)).take(3)
                fractions = denominators.map { Pair(numerator, it) }
            }
            2 -> {
                val family = gen.pick(listOf(listOf(2, 4, 8), listOf(3, 6, 12), listOf(5, 10, 20), listOf(2, 4, 6), listOf(4, 8, 16)))
                fractions = family.map { Pair(gen.int(1..(it - 1)), it) }
            }
            else -> {
                val family = gen.pick(listOf(listOf(3, 4, 6), listOf(4, 5, 10), listOf(6, 8, 12), listOf(3, 5, 15), listOf(4, 6, 12), listOf(2, 3, 5)))
                fractions = family.map { Pair(gen.int(1..(it - 1)), it) }
            }
        }
        val values = fractions.map { Q(it.first, it.second) }
        if (values.toSet().size != 3) return null
        val ascending = fractions.withIndex().sortedWith { x, y -> values[x.index].compareTo(values[y.index]) }.map { it.value }
        fun join(list: List<Pair<Int, Int>>): String = list.joinToString(" < ") { "${it.first}/${it.second}" }
        val correct = join(ascending)
        // The typical mistakes: judging by the numerator or by the denominator alone, or the order the wrong way round.
        val byNumerator = fractions.sortedWith { x, y -> if (x.first < y.first || (x.first == y.first && x.second < y.second)) -1 else if (y.first < x.first || (y.first == x.first && y.second < x.second)) 1 else 0 }
        val byDenominator = fractions.sortedWith { x, y -> if (x.second < y.second || (x.second == y.second && x.first < y.first)) -1 else if (y.second < x.second || (y.second == x.second && y.first < x.first)) 1 else 0 }
        val byDenominatorDown = fractions.sortedWith { x, y -> if (x.second > y.second || (x.second == y.second && x.first < y.first)) -1 else if (y.second > x.second || (y.second == x.second && y.first < x.first)) 1 else 0 }
        val wrong = mutableListOf<String>()
        for (candidate in listOf(join(byDenominatorDown), join(byNumerator), join(byDenominator), join(ascending.reversed()))) {
            if (candidate != correct && !wrong.contains(candidate)) wrong.add(candidate)
        }
        // With equal numerators there are fewer typical mistakes; the other orders of the same fractions fill up.
        if (wrong.size < 3) {
            val permutations = listOf(listOf(0, 1, 2), listOf(0, 2, 1), listOf(1, 0, 2), listOf(1, 2, 0), listOf(2, 0, 1), listOf(2, 1, 0))
            for (permutation in gen.shuffled(permutations)) {
                if (wrong.size >= 3) continue
                val candidate = join(permutation.map { fractions[it] })
                if (candidate != correct && !wrong.contains(candidate)) wrong.add(candidate)
            }
        }
        val shownParts = gen.shuffled(fractions).map { "${it.first}/${it.second}" }
        val shown = shownParts.joinToString(", ")
        val common = fractions.map { it.second }.fold(1) { x, y -> T.lcm(x, y) }
        val expanded = ascending.joinToString(", ") { "${it.first}/${it.second} = ${it.first * (common / it.second)}/$common" }
        val middle = ascending[1]
        return P.text(
            prompt = "Ordne der Größe nach, der kleinste zuerst:\n$shown",
            correct = correct,
            wrong = wrong,
            typed = Ty(
                "Bringe ${shownParts[0]}, ${shownParts[1]} und ${shownParts[2]} auf den Nenner $common.\nWie lautet der mittlere der drei Zähler?",
                rat(middle.first * (common / middle.second)),
            ),
            solution = "Nenner $common: $expanded. Also $correct",
            explanation = "Auf denselben Nenner gebracht, ist der Bruch mit dem größeren Zähler der größere.",
        )
    }

    /** "Welcher Bruch liegt zwischen 1/3 und 1/2?" The right one is in the middle; the wrong ones lie just outside. */
    private fun between(level: Int, gen: Gen): P? {
        val lower: Q
        val upper: Q
        when (level) {
            1 -> {
                val d = gen.int(8..12)
                val a = gen.int(3..(d - 5))
                lower = Q(a, d)
                upper = Q(a + 2, d)
            }
            2 -> {
                val pairs = listOf(listOf(1, 3, 1, 2), listOf(1, 4, 1, 3), listOf(1, 5, 1, 4), listOf(2, 5, 1, 2), listOf(1, 6, 1, 4), listOf(3, 4, 5, 6), listOf(1, 2, 3, 4), listOf(2, 3, 3, 4))
                val p = gen.pick(pairs)
                lower = Q(p[0], p[1])
                upper = Q(p[2], p[3])
            }
            else -> {
                val pairs = listOf(listOf(3, 5, 2, 3), listOf(5, 8, 2, 3), listOf(3, 7, 1, 2), listOf(4, 9, 1, 2), listOf(5, 6, 6, 7), listOf(7, 8, 8, 9), listOf(2, 5, 3, 7), listOf(3, 8, 2, 5))
                val p = gen.pick(pairs)
                lower = Q(p[0], p[1])
                upper = Q(p[2], p[3])
            }
        }
        if (!(lower < upper)) return null
        val middle = (lower + upper) / 2
        val gap = upper - lower
        val wrong = listOf(lower - gap / 2, upper + gap / 2, upper + gap, lower - gap)
        if (!middle.ok || !wrong.all { it.ok && it.value.numerator > 0 }) return null
        val common = T.lcm(lower.denominator, upper.denominator)
        val step = common * 2
        val solution = "Nenner $step: ${T.fraction(lower)} = ${lower.numerator * (step / lower.denominator)}/$step und " +
            "${T.fraction(upper)} = ${upper.numerator * (step / upper.denominator)}/$step; dazwischen liegt ${T.fraction(middle)}"
        return P.number(
            prompt = "Welcher Bruch liegt zwischen ${T.fraction(lower)} und ${T.fraction(upper)}?",
            answer = middle,
            style = S.Fraction,
            hint = "",
            wrong = wrong,
            solution = solution,
            explanation = "Bringe beide Brüche auf einen Nenner; ein Bruch dazwischen hat dort einen Zähler zwischen den beiden Zählern.",
        )
    }
}
