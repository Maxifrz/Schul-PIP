package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.bruteGCD
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.bruteLCM
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.check
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.close
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.firstLine
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.integers
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.lastLine
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.match
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.matches
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.number
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.typedAnswer
import org.junit.Test

/**
 * Ports of LernwerkTests/MathCourseMiddleUnit01Tests.swift to Unit04Tests.swift: every problem is read back from its
 * prompt and recomputed another way.
 */
class MathMiddleUnit01to04Test {
    private val MINUS = "−"
    private fun dash(s: String): String = s.replace(MINUS, "-")
    private fun jsRound(x: Double): Double = Math.floor(x + 0.5)
    private fun span(a: Int, b: Int): List<Int> = (a..b).toList()
    private fun options(p: MathMiddleProblem): List<String> = p.options

    // Unit 1

    private fun fraction(text: String): Pair<Int, Int>? {
        val m = match("""^(\d+)/(\d+)$""", text.trim()) ?: return null
        return Pair(m[1].toInt(), m[2].toInt())
    }

    /** All wrong options are numbers that differ from the expected value. */
    private fun wrongDiffer(p: MathMiddleProblem, expected: Double): String? {
        for (option in options(p)) {
            val value = number(option) ?: continue
            if (close(value, expected)) return "wrong option $option equals the answer"
        }
        return null
    }

    @Test fun u01_fractionOf() {
        check("u01.fractionOf") { level, p ->
            val m = match("""Berechne (\d+)/(\d+) von (\d+)""", p.prompt) ?: return@check "prompt"
            val n = m[1].toInt(); val d = m[2].toInt(); val whole = m[3].toInt()
            val expected = (n * whole).toDouble() / d
            if (expected != jsRound(expected)) return@check "not a whole number"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed answer"
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct}"
            if (bruteGCD(n, d) != 1) return@check "fraction not reduced"
            if (p.pairFront?.startsWith("${m[1]}/${m[2]} von ${m[3]}") != true) return@check "pair front"
            if (level == 1 && whole > 60) return@check "level 1 too big"
            wrongDiffer(p, expected)
        }
    }

    @Test fun u01_share() {
        check("u01.share") { level, p ->
            val head = firstLine(p.prompt)
            val numbers = integers(head)
            if (numbers.size != 2) return@check "numbers"
            val total = numbers.max()
            val part = numbers.min()
            if (!(part < total)) return@check "numbers"
            val expected = part.toDouble() / total
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed answer"
            val shown = fraction(p.correct)
            if (shown == null || !close(shown.first.toDouble() / shown.second, expected)) return@check "correct option ${p.correct}"
            if (bruteGCD(shown.first, shown.second) != 1) return@check "answer not reduced"
            val divisor = bruteGCD(part, total)
            if (level < 3 && divisor != 1) return@check "levels 1 and 2 need no reducing"
            if (level == 3 && divisor == 1) return@check "level 3 reduces"
            if (part * 2 == total) return@check "one half"
            if (p.pairFront != "$part von $total") return@check "pair front"
            wrongDiffer(p, expected)
        }
    }

    @Test fun u01_mixedToImproper() {
        check("u01.mixedToImproper") { _, p ->
            val m = match("""Schreibe (\d+) (\d+)/(\d+) als unechten Bruch""", p.prompt) ?: return@check "prompt"
            val whole = m[1].toInt(); val n = m[2].toInt(); val d = m[3].toInt()
            val value = whole + n.toDouble() / d
            val shown = fraction(p.correct)
            if (shown == null || !close(shown.first.toDouble() / shown.second, value) || shown.second != d || !(shown.first > shown.second)) {
                return@check "correct option ${p.correct}"
            }
            val typedPrompt = p.typed?.prompt
            val t = if (typedPrompt != null) match("""mit dem Nenner (\d+)""", typedPrompt) else null
            if (t == null || !close(t[1].toDouble(), d.toDouble())) return@check "typed prompt"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, value * d)) return@check "typed answer"
            if (p.pairFront != "${m[1]} ${m[2]}/${m[3]}") return@check "pair front"
            wrongDiffer(p, value)
        }
    }

    @Test fun u01_improperToMixed() {
        check("u01.improperToMixed") { _, p ->
            val m = match("""Schreibe (\d+)/(\d+) als gemischte Zahl""", p.prompt) ?: return@check "prompt"
            val top = m[1].toInt(); val bottom = m[2].toInt()
            val value = top.toDouble() / bottom
            val parts = match("""^(\d+) (\d+)/(\d+)$""", p.correct) ?: return@check "correct option ${p.correct}"
            val whole = parts[1].toInt(); val rest = parts[2].toInt(); val denominator = parts[3].toInt()
            if (!(denominator == bottom && rest < denominator && whole >= 1 && close(whole + rest.toDouble() / denominator, value))) return@check "mixed number wrong"
            val typed = typedAnswer(p)
            val typedPrompt = p.typed?.prompt
            if (typed == null || typedPrompt == null) return@check "typed"
            // The count of wholes by counting down, the rest by subtraction.
            var left = top
            var wholes = 0
            while (left >= bottom) {
                left -= bottom
                wholes += 1
            }
            val expected = if (typedPrompt.contains("ganze Einheiten")) wholes else left
            if (!close(typed, expected.toDouble())) return@check "typed answer $typed expected $expected"
            if (p.pairFront != "$top/$bottom") return@check "pair front"
            wrongDiffer(p, value)
        }
    }

    @Test fun u01_equivalent() {
        check("u01.equivalent") { _, p ->
            val m = match("""(\d+)/(\d+) = (\d+|\?)/(\d+|\?)""", p.prompt) ?: return@check "prompt"
            val a = m[1].toInt(); val b = m[2].toInt()
            val missingNumerator = m[3] == "?"
            val known = (if (missingNumerator) m[4] else m[3]).toInt()
            val expected = if (missingNumerator) (a * known).toDouble() / b else (b * known).toDouble() / a
            if (expected != jsRound(expected) || !(expected > 0)) return@check "no whole answer"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed answer"
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option"
            // Plug the answer in: both fractions are the same number.
            val c = if (missingNumerator) expected else known.toDouble()
            val d = if (missingNumerator) known.toDouble() else expected
            if (!close(a.toDouble() / b, c / d)) return@check "fractions differ"
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option text"
                val wc = if (missingNumerator) value else known.toDouble()
                val wd = if (missingNumerator) known.toDouble() else value
                if (close(a.toDouble() / b, wc / wd)) return@check "wrong option $option is right"
            }
            if (p.pairFront != "${m[1]}/${m[2]} = ${m[3]}/${m[4]}") return@check "pair front"
            null
        }
    }

    @Test fun u01_reduce() {
        check("u01.reduce") { level, p ->
            val m = match("""Kürze vollständig:\n(\d+)/(\d+)""", p.prompt) ?: return@check "prompt"
            val a = m[1].toInt(); val b = m[2].toInt()
            val g = bruteGCD(a, b)
            if (!(g > 1 && (if (level == 1) g <= 5 else true))) return@check "gcd $g"
            val right = fraction(p.correct)
            if (right == null || right.first != a / g || right.second != b / g || bruteGCD(right.first, right.second) != 1) return@check "correct option ${p.correct}"
            for (option in options(p)) {
                val w = fraction(option) ?: return@check "wrong option $option"
                if (w.first * right.second == w.second * right.first && bruteGCD(w.first, w.second) == 1) return@check "wrong option $option is the reduced fraction"
                if (w.first == right.first && w.second == right.second) return@check "wrong option equals the answer"
            }
            if (!p.allowsEquivalentWrong) return@check "flag"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, g.toDouble()) || p.typed?.prompt?.contains("$a/$b") != true) return@check "typed answer"
            if (p.pairFront != "$a/$b") return@check "pair front"
            null
        }
    }

    @Test fun u01_isReduced() {
        check("u01.isReduced") { _, p ->
            val asksReducible = p.prompt.contains("noch kürzen")
            if (!(asksReducible || p.prompt.contains("nicht mehr kürzen"))) return@check "prompt"
            val right = fraction(p.correct) ?: return@check "correct option"
            val rightReducible = bruteGCD(right.first, right.second) > 1
            if (rightReducible != asksReducible) return@check "the right option is not the odd one"
            val options = options(p)
            if (options.size != 3) return@check "needs three wrong options"
            for (option in options) {
                val w = fraction(option) ?: return@check "wrong option"
                if ((bruteGCD(w.first, w.second) > 1) == asksReducible) return@check "wrong option $option fits the question"
                if (w.first >= w.second) return@check "improper fraction"
            }
            null
        }
    }

    @Test fun u01_compare() {
        check("u01.compare") { _, p ->
            val m = match("""(\d+)/(\d+) oder (\d+)/(\d+)""", p.prompt) ?: return@check "prompt"
            val a = m[1].toInt(); val b = m[2].toInt(); val c = m[3].toInt(); val d = m[4].toInt()
            // Cross products decide, not division.
            val leftLarger = a * d > c * b
            if (a * d == c * b) return@check "equal fractions"
            val larger = if (leftLarger) "$a/$b" else "$c/$d"
            val smaller = if (leftLarger) "$c/$d" else "$a/$b"
            val options = options(p)
            if (p.correct != larger || options.size != 2 || options[0] != smaller || options[1] != "Beide sind gleich groß.") return@check "options"
            val t = p.typed?.let { match("""auf den Nenner (\d+)""", it.prompt) } ?: return@check "typed prompt"
            val common = t[1].toInt()
            if (common != bruteLCM(b, d)) return@check "not the common denominator"
            val expected = maxOf(a * (common / b), c * (common / d))
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected.toDouble())) return@check "typed answer"
            if (p.pairFront != "$a/$b oder $c/$d") return@check "pair front"
            null
        }
    }

    @Test fun u01_order() {
        check("u01.order") { _, p ->
            val listing = lastLine(p.prompt)
            val given = matches("""(\d+)/(\d+)""", listing).map { Pair(it[1].toInt(), it[2].toInt()) }
            if (given.size != 3) return@check "three fractions"
            val sorted = given.sortedWith { x, y -> if (x.first * y.second < y.first * x.second) -1 else if (y.first * x.second < x.first * y.second) 1 else 0 }
            if (sorted[0].first * sorted[1].second == sorted[1].first * sorted[0].second || sorted[1].first * sorted[2].second == sorted[2].first * sorted[1].second) return@check "equal fractions"
            fun chain(text: String): List<Pair<Int, Int>> = matches("""(\d+)/(\d+)""", text).map { Pair(it[1].toInt(), it[2].toInt()) }
            val right = chain(p.correct)
            if (right.size != 3 || !right.withIndex().all { (i, r) -> r.first == sorted[i].first && r.second == sorted[i].second }) return@check "correct chain ${p.correct}"
            if (p.correct.split(" < ").size != 3) return@check "chain format"
            for (option in options(p)) {
                val w = chain(option)
                if (w.size != 3 || w.map { "${it.first}/${it.second}" }.toSet().sorted() != given.map { "${it.first}/${it.second}" }.toSet().sorted()) return@check "wrong chain is no permutation"
                val ascending = w.dropLast(1).withIndex().all { (i, x) -> x.first * w[i + 1].second < w[i + 1].first * x.second }
                if (ascending) return@check "wrong chain $option is ascending"
            }
            val t = p.typed?.let { match("""auf den Nenner (\d+)""", it.prompt) } ?: return@check "typed prompt"
            val common = t[1].toInt()
            if (!given.all { common % it.second == 0 }) return@check "not a common denominator"
            val middle = sorted[1]
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, (middle.first * (common / middle.second)).toDouble())) return@check "typed answer"
            null
        }
    }

    @Test fun u01_between() {
        check("u01.between") { _, p ->
            val m = match("""zwischen (\d+)/(\d+) und (\d+)/(\d+)""", p.prompt) ?: return@check "prompt"
            val lower = m[1].toDouble() / m[2].toDouble()
            val upper = m[3].toDouble() / m[4].toDouble()
            val right = number(p.correct)
            if (!(lower < upper) || right == null || !(right > lower) || !(right < upper)) return@check "correct option ${p.correct}"
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option"
                if (value > lower && value < upper) return@check "wrong option $option lies between"
            }
            null
        }
    }

    // Unit 2

    /** The line after "Berechne:" evaluated, or null. */
    private fun valueOf(prompt: String): Double? {
        val lines = prompt.split("\n")
        if (lines.size < 2 || lines[0] != "Berechne:") return null
        return MathMiddleExpr.evaluate(lines[1])
    }

    private fun expressionOf(prompt: String): String = prompt.split("\n").getOrElse(1) { "" }

    /** Checks an arithmetic template: the expression, the typed answer, the right option, the wrong ones, the pair. */
    private fun checkArithmetic(id: String, more: ((Int, MathMiddleProblem, Double) -> String?)? = null) {
        check(id) { level, p ->
            val expected = valueOf(p.prompt) ?: return@check "cannot read the expression"
            if (expected <= 0) return@check "result not positive"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed answer $typed expected $expected"
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct}"
            for (option in options(p)) {
                val wrong = number(option) ?: return@check "wrong option $option"
                if (close(wrong, expected)) return@check "wrong option $option is right"
            }
            if (p.pairFront != expressionOf(p.prompt)) return@check "pair front ${p.pairFront ?: ""}"
            if (more != null) more(level, p, expected) else null
        }
    }

    /** The typed answer, the right option and the wrong options against a value computed from the prompt. */
    private fun commonAnswer(p: MathMiddleProblem, expected: Double): String? {
        val typed = typedAnswer(p)
        if (typed == null || !close(typed, expected)) return "typed answer $typed expected $expected"
        val right = number(p.correct)
        if (right == null || !close(right, expected)) return "correct option ${p.correct} expected $expected"
        for (option in options(p)) {
            val wrong = number(option) ?: return "wrong option $option"
            if (close(wrong, expected)) return "wrong option $option is right"
        }
        return null
    }

    @Test fun u02_add() {
        checkArithmetic("u02.add") { level, p, expected ->
            // Two proper fractions, and the denominators fit the level.
            val fractions = matches("""(\d+)/(\d+)""", expressionOf(p.prompt)).map { listOf(it[1].toInt(), it[2].toInt()) }
            if (fractions.size != 2 || !fractions.all { it[0] < it[1] && bruteGCD(it[0], it[1]) == 1 }) return@checkArithmetic "operands"
            if (level == 1 && fractions[0][1] != fractions[1][1] && fractions[1][1] % fractions[0][1] != 0) return@checkArithmetic "level 1 denominators"
            if (expected > 2) "sum too big" else null
        }
    }

    @Test fun u02_subtract() {
        checkArithmetic("u02.subtract") { _, _, expected -> if (expected < 1) null else "difference too big" }
    }

    @Test fun u02_mixedAddSub() {
        checkArithmetic("u02.mixedAddSub") { level, p, _ ->
            val line = expressionOf(p.prompt)
            if (level == 3 && !line.contains("−")) return@checkArithmetic "level 3 subtracts"
            if (level < 3 && !line.contains("+")) return@checkArithmetic "levels 1 and 2 add"
            val parts = match("""^(\d+) (\d+)/(\d+) [+−] (\d+) (\d+)/(\d+)$""", line) ?: return@checkArithmetic "operands are two mixed numbers"
            if (!(parts[2].toInt() < parts[3].toInt() && parts[5].toInt() < parts[6].toInt())) "improper fraction part" else null
        }
    }

    @Test fun u02_multiply() = checkArithmetic("u02.multiply")

    @Test fun u02_divide() = checkArithmetic("u02.divide")

    @Test fun u02_orderOfOperations() {
        checkArithmetic("u02.order") { _, p, _ -> if (expressionOf(p.prompt) == "") "no expression" else null }
    }

    @Test fun u02_mixedMulDiv() = checkArithmetic("u02.mixedMulDiv")

    @Test fun u02_fitsIn() {
        check("u02.fitsIn") { _, p ->
            val patterns = listOf(
                """Aus (.+?) l Saft werden Gläser zu (\d+/\d+) l""",
                """Ein Band ist (.+?) m lang\. Daraus werden Stücke zu (\d+/\d+) m""",
                """Ein Sack enthält (.+?) kg Mehl\. Jede Tüte fasst (\d+/\d+) kg""",
            )
            val m = patterns.firstNotNullOfOrNull { match(it, p.prompt) } ?: return@check "prompt"
            val total = number(m[1])
            val portion = number(m[2])
            if (total == null || portion == null) return@check "numbers"
            val expected = total / portion
            if (!close(expected, jsRound(expected)) || !close(jsRound(expected) * portion, total)) return@check "not a whole number of portions: $expected"
            commonAnswer(p, expected)
        }
    }

    @Test fun u02_partOfPart() {
        check("u02.partOfPart") { _, p ->
            val first = firstLine(p.prompt)
            val fractions = matches("""(\d+)/(\d+)""", first).map { it[1].toDouble() / it[2].toDouble() }
            if (fractions.size != 2) return@check "two fractions"
            commonAnswer(p, fractions[0] * fractions[1])
        }
    }

    @Test fun u02_word() {
        check("u02.word") { _, p ->
            val first = firstLine(p.prompt)
            val expected: Double
            val m = match("""Für (\d+) Portionen braucht man (\d+)/(\d+)""", first)
            if (m != null) {
                expected = m[2].toDouble() / m[3].toDouble() / m[1].toDouble()
            } else {
                val fractions = matches("""(\d+)/(\d+)""", first).map { it[1].toDouble() / it[2].toDouble() }
                if (fractions.size != 2 || !(fractions[0] + fractions[1] < 1)) return@check "two fractions"
                expected = 1 - fractions[0] - fractions[1]
            }
            commonAnswer(p, expected)
        }
    }

    // Unit 3

    @Test fun u03_fractionToPercent() {
        check("u03.fractionToPercent") { _, p ->
            val m = match("""Wie viel Prozent sind (.+)\?""", p.prompt) ?: return@check "prompt"
            val source = number(m[1]) ?: return@check "prompt"
            if (p.pairFront != m[1]) return@check "pair front"
            if (!p.correct.endsWith(" %")) return@check "unit"
            commonAnswer(p, source * 100)
        }
    }

    @Test fun u03_percentToDecimal() {
        check("u03.percentToDecimal") { _, p ->
            val m = match("""Schreibe (.+?) % als Dezimalzahl""", p.prompt) ?: return@check "prompt"
            val rate = number(m[1]) ?: return@check "prompt"
            if (p.pairFront != "${m[1]} %") return@check "pair front"
            commonAnswer(p, rate / 100)
        }
    }

    @Test fun u03_decimalCalc() {
        check("u03.decimalCalc") { level, p ->
            val lines = p.prompt.split("\n")
            val expected = if (lines.size == 2 && lines[0] == "Berechne:") MathMiddleExpr.evaluate(lines[1]) else null
            if (expected == null) return@check "expression"
            if (!(expected > 0)) return@check "not positive"
            if (p.pairFront != lines[1]) return@check "pair front"
            // The result has few places after the comma.
            val scaled = expected * 1000
            if (!close(scaled, jsRound(scaled), 1e-7)) return@check "too many places: $expected"
            if (level == 1 && (lines[1].contains("·") || lines[1].contains(":"))) return@check "level 1 only adds and subtracts"
            commonAnswer(p, expected)
        }
    }

    @Test fun u03_percentValue() {
        check("u03.percentValue") { _, p ->
            val m = match("""(\d+(?:,\d+)?) % von (\d+(?:,\d+)?)""", p.prompt) ?: return@check "prompt"
            val rate = number(m[1])
            val base = number(m[2])
            if (rate == null || base == null) return@check "prompt"
            commonAnswer(p, rate * base / 100)
        }
    }

    @Test fun u03_percentRate() {
        check("u03.percentRate") { _, p ->
            val patterns = listOf("""Wie viel Prozent sind (\d+) von (\d+)\?""", """Von (\d+) Schülern fehlen (\d+)\.""", """Lena erreicht (\d+) von (\d+) Punkten""")
            var index = -1
            var g: List<String>? = null
            patterns.forEachIndexed { i, re ->
                if (g == null) {
                    val found = match(re, p.prompt)
                    if (found != null) { g = found; index = i }
                }
            }
            val groups = g ?: return@check "prompt"
            val part: Double
            val base: Double
            if (index == 1) { part = groups[2].toDouble(); base = groups[1].toDouble() } else { part = groups[1].toDouble(); base = groups[2].toDouble() }
            if (!(part < base)) return@check "part is not smaller"
            commonAnswer(p, part / base * 100)
        }
    }

    @Test fun u03_baseValue() {
        check("u03.baseValue") { _, p ->
            val num = """(\d+(?:,\d+)?)"""
            val rate: Double
            val part: Double
            val m1 = match("$num % einer Menge sind $num", p.prompt)
            val m2 = match("Bei $num % Rabatt spart Tom $num", p.prompt)
            val m3 = match("^$num \\S+ sind $num % des Grundwerts", p.prompt)
            if (m1 != null) {
                rate = number(m1[1])!!; part = number(m1[2])!!
            } else if (m2 != null) {
                rate = number(m2[1])!!; part = number(m2[2])!!
            } else if (m3 != null) {
                rate = number(m3[2])!!; part = number(m3[1])!!
            } else {
                return@check "prompt"
            }
            val expected = part * 100 / rate
            // Plugged back in: the rate of the answer is the part.
            if (!close(expected * rate / 100, part)) return@check "does not fit back"
            commonAnswer(p, expected)
        }
    }

    @Test fun u03_priceChange() {
        check("u03.priceChange") { _, p ->
            val m = match("""kostet (\d+(?:,\d+)?) €\.""", p.prompt)
            val base = if (m != null) number(m[1]) else null
            if (base == null) return@check "base"
            val up = match("""steigt um (\d+(?:,\d+)?) %""", p.prompt)
            val down = match("""gibt (\d+(?:,\d+)?) % Rabatt""", p.prompt)
            val factor: Double = if (up != null && number(up[1]) != null) 1 + number(up[1])!! / 100
            else if (down != null && number(down[1]) != null) 1 - number(down[1])!! / 100
            else return@check "rate"
            commonAnswer(p, base * factor)
        }
    }

    @Test fun u03_percentChange() {
        check("u03.percentChange") { _, p ->
            val m = match("""(steigt|sinkt) von (\d+) € auf (\d+) €""", p.prompt) ?: return@check "prompt"
            val old = m[2].toDouble()
            val nu = m[3].toDouble()
            if ((m[1] == "steigt") != nu > old) return@check "direction"
            val expected = Math.abs(nu - old) / old * 100
            // Plugged back in.
            if (!close(old * (1 + (if (nu > old) 1 else -1) * expected / 100), nu)) return@check "does not fit back"
            commonAnswer(p, expected)
        }
    }

    @Test fun u03_growthFactor() {
        check("u03.growthFactor") { _, p ->
            val m = match("""Ein Wert (steigt|sinkt) um (\d+(?:,\d+)?) %""", p.prompt) ?: return@check "prompt"
            val rate = number(m[2]) ?: return@check "prompt"
            val expected = if (m[1] == "steigt") 1 + rate / 100 else 1 - rate / 100
            // 100 multiplied by the factor is 100 changed by the rate.
            if (!close(100 * expected, if (m[1] == "steigt") 100 + rate else 100 - rate)) return@check "factor"
            commonAnswer(p, expected)
        }
    }

    @Test fun u03_vat() {
        check("u03.vat") { level, p ->
            val money = """(\d+(?:,\d+)?)"""
            val forwards = match("netto $money €\\. Dazu kommen (\\d+) % Mehrwertsteuer", p.prompt)
            if (forwards != null && number(forwards[1]) != null) {
                if (level >= 3) return@check "level 3 goes backwards"
                return@check commonAnswer(p, number(forwards[1])!! * (1 + forwards[2].toDouble() / 100))
            }
            val backwards = match("brutto $money €, darin sind (\\d+) % Mehrwertsteuer", p.prompt)
            if (backwards != null && number(backwards[1]) != null) {
                if (level != 3) return@check "only level 3 goes backwards"
                val gross = number(backwards[1])!!
                val rate = backwards[2].toDouble()
                val expected = gross / (1 + rate / 100)
                if (!close(expected * (1 + rate / 100), gross)) return@check "does not fit back"
                // The classic mistake is never the right answer.
                return@check commonAnswer(p, expected)
            }
            "prompt"
        }
    }

    // Unit 4

    private val samples = listOf(-4, -3, -1, 0, 1, 2, 3, 5, 7)

    /** Whether two terms have the same value at every sample point. */
    private fun equivalent(a: String, b: String): Boolean? {
        for (x in samples) {
            val left = MathMiddleExpr.evaluate(a, mapOf('x' to x.toDouble())) ?: return null
            val right = MathMiddleExpr.evaluate(b, mapOf('x' to x.toDouble())) ?: return null
            if (!close(left, right)) return false
        }
        return true
    }

    private class LinearParts(val coefficient: Double, val constant: Double)

    /** The constant and the coefficient of a term that is linear in x, found by evaluating at 0 and 1. */
    private fun linearParts(term: String): LinearParts? {
        val atZero = MathMiddleExpr.evaluate(term, mapOf('x' to 0.0)) ?: return null
        val atOne = MathMiddleExpr.evaluate(term, mapOf('x' to 1.0)) ?: return null
        return LinearParts(atOne - atZero, atZero)
    }

    /** "Löse die Gleichung. Welchen Wert hat x?" plus the equation; the solution fits, the wrong options do not. */
    private fun checkEquation(p: MathMiddleProblem): String? {
        val equation = lastLine(p.prompt)
        val x = number(p.correct)
        if (!p.prompt.startsWith("Löse die Gleichung. Welchen Wert hat x?\n") || x == null) return "prompt"
        if (MathMiddleExpr.holds(equation, x) != true) return "the solution ${p.correct} does not fit $equation"
        // A linear equation with one solution: the sides differ at two other points.
        if (MathMiddleExpr.holds(equation, x + 1) != false || MathMiddleExpr.holds(equation, x - 2) != false) return "not a single solution"
        val typed = typedAnswer(p)
        if (typed == null || !close(typed, x)) return "typed answer"
        for (option in options(p)) {
            val value = number(option) ?: return "wrong option $option"
            if (MathMiddleExpr.holds(equation, value) != false) return "wrong option $option solves the equation"
        }
        if (p.pairFront != equation) return "pair front"
        if (!(p.solution.contains("stimmt") || p.solution.contains("=")) || !p.solution.contains(MathMiddleText.int(x.toInt()))) return "solution"
        return null
    }

    @Test fun u04_evalTerm() {
        check("u04.evalTerm") { level, p ->
            val m = match("""^Berechne den Wert von (.+) für x = (−?\d+)\.$""", p.prompt) ?: return@check "prompt"
            val x = number(m[2]) ?: return@check "prompt"
            val expected = MathMiddleExpr.evaluate(m[1], mapOf('x' to x)) ?: return@check "term ${m[1]}"
            if (level == 3 && !m[1].contains("²")) return@check "level 3 has a square"
            if (level == 1 && x <= 0) return@check "level 1 has positive x"
            val right = number(p.correct)
            if (right == null || !close(right, expected)) return@check "correct option ${p.correct} expected $expected"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, expected)) return@check "typed answer"
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option $option"
                if (close(value, expected)) return@check "wrong option $option is right"
            }
            if (p.pairFront != "${m[1]} für x = ${m[2]}") return@check "pair front"
            // The worked result ends in the answer.
            val all = matches("""= (−?\d+)$""", p.solution)
            val last = if (all.isNotEmpty()) number(all.last()[1]) else null
            if (last == null || !close(last, expected)) return@check "solution ${p.solution}"
            null
        }
    }

    @Test fun u04_simplify() {
        check("u04.simplify") { level, p ->
            val expression = lastLine(p.prompt)
            val parts = linearParts(p.correct)
            if (!p.prompt.startsWith("Fasse zusammen:\n") || parts == null) return@check "prompt"
            if (equivalent(expression, p.correct) != true) return@check "correct option ${p.correct} differs from the term"
            // Neither x-terms nor numbers are lost.
            if (parts.coefficient == 0.0 || parts.constant == 0.0) return@check "degenerate result"
            val typed = typedAnswer(p)
            val typedPrompt = p.typed?.prompt
            if (typed == null || typedPrompt == null) return@check "typed"
            val asksCoefficient = typedPrompt.contains("vor dem x")
            if (!close(typed, if (asksCoefficient) parts.coefficient else parts.constant)) return@check "typed answer $typed"
            if (asksCoefficient && Math.abs(parts.coefficient) == 1.0) return@check "asks for an invisible 1"
            for (option in options(p)) if (equivalent(expression, option) != false) return@check "wrong option $option is equivalent"
            if (p.pairFront != expression) return@check "pair front"
            // Level 1 has no minus; levels 2 and 3 have.
            if (level == 1 && expression.contains(MINUS)) return@check "level 1 without minus"
            if (level >= 2 && !expression.contains(MINUS)) return@check "levels 2 and 3 subtract"
            null
        }
    }

    @Test fun u04_expand() {
        check("u04.expand") { level, p ->
            val expression = lastLine(p.prompt)
            val parts = linearParts(p.correct)
            if (!p.prompt.startsWith("Löse die Klammer auf:\n") || parts == null) return@check "prompt"
            if (equivalent(expression, p.correct) != true) return@check "correct option ${p.correct} differs from $expression"
            if (p.correct.contains("(") || !expression.contains("(")) return@check "bracket"
            val typed = typedAnswer(p)
            val typedPrompt = p.typed?.prompt
            if (typed == null || typedPrompt == null) return@check "typed"
            val asksCoefficient = typedPrompt.contains("vor dem x")
            if (!close(typed, if (asksCoefficient) parts.coefficient else parts.constant)) return@check "typed answer"
            for (option in options(p)) if (equivalent(expression, option) != false) return@check "wrong option $option is equivalent"
            val hard = match("""^\d+ − \d+\(x \+ \d+\)$""", expression) != null || match("""^\d+\(\d+x − \d+\)$""", expression) != null
            if (level == 3 && !hard) return@check "level 3 form $expression"
            if (level < 3 && hard) return@check "hard form below level 3"
            if (p.pairFront != expression) return@check "pair front"
            null
        }
    }

    @Test fun u04_oneStep() {
        check("u04.oneStep") { level, p ->
            val message = checkEquation(p)
            if (message != null) return@check message
            val equation = lastLine(p.prompt)
            fun whole(text: String): Int = dash(text).toInt()
            // Each of the four forms solved by trying every whole number.
            val solutions: List<Int>
            val m1 = match("""^x \+ (\d+) = (−?\d+)$""", equation)
            val m2 = match("""^x − (\d+) = (−?\d+)$""", equation)
            val m3 = match("""^(−?\d+)x = (−?\d+)$""", equation)
            val m4 = match("""^x : (\d+) = (−?\d+)$""", equation)
            if (m1 != null) {
                solutions = span(-300, 300).filter { it + whole(m1[1]) == whole(m1[2]) }
            } else if (m2 != null) {
                solutions = span(-300, 300).filter { it - whole(m2[1]) == whole(m2[2]) }
            } else if (m3 != null) {
                solutions = span(-300, 300).filter { whole(m3[1]) * it == whole(m3[2]) }
            } else if (m4 != null) {
                solutions = span(-300, 300).filter { it % whole(m4[1]) == 0 && it / whole(m4[1]) == whole(m4[2]) }
            } else {
                return@check "form $equation"
            }
            val right = number(p.correct)
            if (solutions.size != 1 || right == null || right.toInt() != solutions[0]) return@check "brute force $solutions"
            if (level == 1 && !(equation.startsWith("x + ") || equation.startsWith("x − "))) return@check "level 1 adds and subtracts"
            if (level == 1 && right < 1) return@check "level 1 has positive solutions"
            null
        }
    }

    @Test fun u04_twoStep() {
        check("u04.twoStep") { level, p ->
            val message = checkEquation(p)
            if (message != null) return@check message
            val equation = lastLine(p.prompt)
            val m = match("""^(−?\d*)x (\+|−) (\d+) = (−?\d+)$""", equation) ?: return@check "form $equation"
            val a = if (m[1] == "") 1 else if (m[1] == MINUS) -1 else dash(m[1]).toInt()
            if (!(Math.abs(a) >= 2)) return@check "factor $a"
            if (level == 1 && a < 0) return@check "level 1 positive"
            // Brute force over the whole numbers, no algebra.
            val b = m[3].toInt() * (if (m[2] == "+") 1 else -1)
            val c = dash(m[4]).toInt()
            val solutions = span(-60, 60).filter { a * it + b == c }
            val right = number(p.correct)
            if (solutions.size != 1 || right == null || right.toInt() != solutions[0]) return@check "brute force $solutions"
            null
        }
    }

    @Test fun u04_brackets() {
        check("u04.brackets") { level, p ->
            val message = checkEquation(p)
            if (message != null) return@check message
            val equation = lastLine(p.prompt)
            val m = match("""^(\d)\(x (\+|−) (\d)\)(?: (\+|−) (\d+))? = (−?\d+)$""", equation) ?: return@check "form $equation"
            val a = m[1].toInt()
            val shift = m[3].toInt() * (if (m[2] == "+") 1 else -1)
            val d = if (m[4] == "") 0 else m[5].toInt() * (if (m[4] == "+") 1 else -1)
            val e = dash(m[6]).toInt()
            val solutions = span(-60, 60).filter { a * (it + shift) + d == e }
            val right = number(p.correct)
            if (solutions.size != 1 || right == null || right.toInt() != solutions[0]) return@check "brute force"
            if (level < 3 && d != 0) return@check "outside number only at level 3"
            if (level == 3 && d == 0) return@check "level 3 has a number outside"
            if (level == 1 && shift < 0) return@check "level 1 adds inside"
            null
        }
    }

    @Test fun u04_bothSides() {
        check("u04.bothSides") { level, p ->
            val message = checkEquation(p)
            if (message != null) return@check message
            val equation = lastLine(p.prompt)
            val sides = equation.split(" = ")
            if (sides.size != 2 || !sides.all { it.contains("x") }) return@check "x on both sides"
            if (level == 3 && !sides[0].contains("(")) return@check "level 3 has a bracket"
            if (level < 3 && equation.contains("(")) return@check "brackets only at level 3"
            // Different slopes: exactly one solution, and two sample points give two different differences.
            val diff0 = MathMiddleExpr.evaluate(sides[0], mapOf('x' to 0.0))!! - MathMiddleExpr.evaluate(sides[1], mapOf('x' to 0.0))!!
            val diff1 = MathMiddleExpr.evaluate(sides[0], mapOf('x' to 1.0))!! - MathMiddleExpr.evaluate(sides[1], mapOf('x' to 1.0))!!
            if (diff0 == diff1) return@check "parallel sides"
            // The solution by the intercept formula, another way than the generator's.
            if (!close(-diff0 / (diff1 - diff0), number(p.correct)!!)) return@check "intercept formula"
            null
        }
    }

    @Test fun u04_plugIn() {
        check("u04.plugIn") { level, p ->
            val equation = lastLine(p.prompt)
            val x = number(p.correct)
            if (!p.prompt.startsWith("Welche Zahl ist die Lösung der Gleichung? Setze zur Probe ein.\n") || x == null) return@check "prompt"
            val sides = equation.split(" = ")
            if (sides.size != 2 || MathMiddleExpr.holds(equation, x) != true) return@check "the solution does not fit"
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option $option"
                if (MathMiddleExpr.holds(equation, value) != false) return@check "wrong option $option fits"
            }
            val typedPrompt = p.typed?.prompt
            val m = if (typedPrompt != null) match("""Die Lösung der Gleichung (.+) ist x = (−?\d+)\.\nWelchen Wert haben beide Seiten""", typedPrompt) else null
            if (m == null) return@check "typed prompt"
            if (m[1] != equation || number(m[2]) != x) return@check "typed equation"
            val both = MathMiddleExpr.evaluate(sides[0], mapOf('x' to x))!!
            val typed = typedAnswer(p)
            if (!close(both, MathMiddleExpr.evaluate(sides[1], mapOf('x' to x))!!) || typed == null || !close(typed, both)) return@check "typed answer"
            if (level == 3 && !sides[0].contains("(")) return@check "level 3 has a bracket"
            null
        }
    }

    @Test fun u04_word() {
        check("u04.word") { level, p ->
            val right = number(p.correct) ?: return@check "correct"
            val prompt = p.prompt.split("\n").joinToString(" ")
            val truth: List<Int>
            val m1 = match("""^Ich denke mir eine Zahl\. (Ich verdopple sie|Ich multipliziere sie mit (\d+)) und (addiere|subtrahiere) (\d+)\. Das Ergebnis ist (\d+)\.""", prompt)
            val m2 = match("""(\d+) € (?:Grundgebühr|Pauschale|für die Anfahrt) und (\d+) € je .+?(\d+) €""", prompt)
            val m3 = match("""hat (\d+) € und spart (\d+) € pro Woche\. \w+ hat (\d+) € und spart (\d+) € pro Woche""", prompt)
            if (m1 != null) {
                if (level != 1) return@check "puzzle only at level 1"
                val factor = if (m1[1] == "Ich verdopple sie") 2 else m1[2].toInt()
                val b = m1[4].toInt() * (if (m1[3] == "addiere") 1 else -1)
                val result = m1[5].toInt()
                truth = span(0, 300).filter { factor * it + b == result }
            } else if (m2 != null) {
                if (level != 2) return@check "tariff only at level 2"
                val b = m2[1].toInt(); val a = m2[2].toInt(); val c = m2[3].toInt()
                truth = span(0, 300).filter { b + a * it == c }
            } else if (m3 != null) {
                if (level != 3) return@check "equal amounts only at level 3"
                val p1 = m3[1].toInt(); val r1 = m3[2].toInt(); val p2 = m3[3].toInt(); val r2 = m3[4].toInt()
                truth = span(0, 300).filter { p1 + r1 * it == p2 + r2 * it }
                if (!(r1 - r2 >= 2)) return@check "rates too close"
            } else {
                return@check "prompt"
            }
            if (truth.size != 1 || right.toInt() != truth[0]) return@check "brute force $truth vs ${p.correct}"
            val typed = typedAnswer(p)
            if (typed == null || !close(typed, right)) return@check "typed"
            for (option in options(p)) {
                val value = number(option) ?: return@check "wrong option"
                if (close(value, right)) return@check "wrong option $option is right"
            }
            if (right < 2) return@check "answer too small for a plural"
            null
        }
    }
}
