package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/**
 * Unit 10, Wahrscheinlichkeit: Laplace-Wahrscheinlichkeit, relative Häufigkeit and what a probability can be (lesson 1),
 * Gegenereignis, two dice, expected counts and the product rule with replacement (2), drawing without replacement, the
 * sum rule over two paths and "mindestens einmal" (3).
 *
 * Every answer is a probability in lowest terms; a typed answer accepts a fraction or a decimal by value.
 */
object MathMiddleUnit10 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u10.dieEvent", 1, forms(CHOICE, TYPED, PAIRS), ::dieEvent),
            MathMiddleTemplate("u10.urn", 1, forms(CHOICE, TYPED, PAIRS), ::urn),
            MathMiddleTemplate("u10.frequency", 1, forms(CHOICE, TYPED), ::frequency),
            MathMiddleTemplate("u10.range", 1, forms(CHOICE), ::range),
            MathMiddleTemplate("u10.complement", 2, forms(CHOICE, TYPED, PAIRS), ::complement),
            MathMiddleTemplate("u10.twoDice", 2, forms(CHOICE, TYPED, PAIRS), ::twoDice),
            MathMiddleTemplate("u10.expected", 2, forms(CHOICE, TYPED), ::expected),
            MathMiddleTemplate("u10.withReplacement", 2, forms(CHOICE, TYPED, PAIRS), ::withReplacement),
            MathMiddleTemplate("u10.withoutReplacement", 3, forms(CHOICE, TYPED, PAIRS), ::withoutReplacement),
            MathMiddleTemplate("u10.twoPaths", 3, forms(CHOICE, TYPED), ::twoPaths),
            MathMiddleTemplate("u10.atLeastOne", 3, forms(CHOICE, TYPED), ::atLeastOne),
        )
    }

    private const val hint = "Gib das Ergebnis als Bruch oder Dezimalzahl an."

    private fun f(q: Q): String = T.fraction(q)

    /** The candidates that can be a probability that is neither impossible nor certain. */
    private fun probs(candidates: List<Q>): List<Q> = candidates.filter { it.ok && it > Q(0) && it < Q(1) }

    private fun prob(prompt: String, answer: Q, wrong: List<Q>, pair: String? = null, solution: String, explanation: String): P? {
        if (!answer.ok || !(answer > Q(0)) || !(answer < Q(1))) return null
        val problem = P.number(
            prompt = prompt, answer = answer, style = S.Fraction, hint = hint, wrong = probs(wrong), pair = pair,
            solution = solution, explanation = explanation,
        )
        problem?.pairPrompt = "Berechne die Wahrscheinlichkeit und ordne zu."
        return problem
    }

    private fun isPrime(n: Int): Boolean = n >= 2 && !(2 until n).any { n % it == 0 }

    private val colors = listOf("rote", "blaue", "grüne", "gelbe")

    // Lesson 1

    private class DieEvent(val phrase: String, val test: (Int) -> Boolean)

    /** One throw of a die: favourable numbers over all numbers. */
    private fun dieEvent(level: Int, gen: Gen): P? = gen.attempt { dieEventAttempt(level, gen) }

    private fun dieEventAttempt(level: Int, gen: Gen): P? {
        val sides = if (level == 1) 6 else if (level == 2) gen.pick(listOf(6, 8)) else gen.pick(listOf(8, 12, 20))
        val k = gen.int(2..(sides - 2))
        val m = gen.pick(listOf(2, 3, 4, 5))
        val events = mutableListOf(
            DieEvent("größer als $k") { it > k },
            DieEvent("kleiner als $k") { it < k },
            DieEvent("gerade") { it % 2 == 0 },
            DieEvent("ungerade") { it % 2 == 1 },
        )
        if (level >= 2) {
            events.add(DieEvent("eine Primzahl") { isPrime(it) })
            events.add(DieEvent("durch $m teilbar") { it % m == 0 })
        }
        val event = gen.pick(events)
        val favourable = (1..sides).filter(event.test)
        val fav = favourable.size
        if (fav < 1 || fav >= sides) return null
        val answer = Q(fav, sides)
        val die = if (sides == 6) "Ein Würfel" else "Ein Würfel mit den Zahlen 1 bis $sides"
        val listed = if (fav <= 8) favourable.joinToString(", ") else "$fav Zahlen"
        return prob(
            prompt = "$die wird einmal geworfen.\nWie groß ist die Wahrscheinlichkeit, dass die Zahl ${event.phrase} ist?",
            answer = answer,
            wrong = listOf(Q(fav, sides - fav), Q(fav + 1, sides), Q(fav - 1, sides), Q(sides - fav, sides)),
            pair = "Zahl ${event.phrase}, 1 bis $sides",
            solution = "Günstig: $listed. Das sind $fav von $sides Zahlen: P = $fav/$sides = ${f(answer)}",
            explanation = "Bei gleich wahrscheinlichen Ergebnissen gilt P = günstige Ergebnisse : alle Ergebnisse. Zähle die günstigen Zahlen einzeln ab.",
        )
    }

    /** Drawing one ball from a bag. */
    private fun urn(level: Int, gen: Gen): P? = gen.attempt { urnAttempt(level, gen) }

    private fun urnAttempt(level: Int, gen: Gen): P? {
        val kinds = if (level == 1) 2 else if (level == 2) 3 else gen.pick(listOf(3, 4))
        val counts = (0 until kinds).map { gen.int(level, 1..5, 1..6, 2..8) }
        val total = counts.sum()
        if (total > 24) return null
        val names = colors.take(kinds)
        val combined = level == 3 && gen.chance(50)
        val first = gen.int(0..(kinds - 1))
        var second = (first + gen.int(1..(kinds - 1))) % kinds
        if (second == first) second = (first + 1) % kinds
        val chosen = if (combined) listOf(first, second).sorted() else listOf(first)
        val fav = chosen.map { counts[it] }.sum()
        if (fav >= total) return null
        val contents = T.listed(counts.zip(names).map { "${it.first} ${it.second}" })
        val askedColor = chosen.joinToString(" oder ") { names[it] }
        val askedNoun = if (combined) "eine ${chosen.joinToString(" oder eine ") { names[it].dropLast(1) + "e" }}" else "eine ${names[first]}"
        val wrong = listOf(
            Q(fav, total - fav), Q(total - fav, total), Q(1, kinds), Q(counts[chosen[0]], total),
            Q(counts[first], counts[second]),
        )
        return prob(
            prompt = "In einem Beutel liegen $contents Kugeln. Du ziehst eine Kugel, ohne hinzusehen.\nWie groß ist die Wahrscheinlichkeit für $askedNoun Kugel?",
            answer = Q(fav, total),
            wrong = wrong,
            pair = "${counts.joinToString("/")} Kugeln: $askedColor",
            solution = "Insgesamt $total Kugeln, davon $fav günstig: P = $fav/$total = ${f(Q(fav, total))}",
            explanation = "Die Wahrscheinlichkeit ist die Zahl der günstigen Kugeln geteilt durch die Zahl aller Kugeln im Beutel, nicht geteilt durch die Zahl der übrigen Kugeln.",
        )
    }

    /** Relative frequency: hits over trials, as a decimal. */
    private fun frequency(level: Int, gen: Gen): P? = gen.attempt { frequencyAttempt(level, gen) }

    private fun frequencyAttempt(level: Int, gen: Gen): P? {
        val n = if (level == 1) gen.pick(listOf(10, 20, 50, 100)) else if (level == 2) gen.pick(listOf(20, 25, 40, 50, 200)) else gen.pick(listOf(8, 16, 40, 125, 250))
        val k = gen.int(1..(n - 1))
        val value = Q(k, n)
        val contexts = listOf(
            "Eine Reißzwecke wird $n-mal geworfen und landet $k-mal auf dem Rücken.",
            "Ein Basketballspieler wirft $n-mal auf den Korb und trifft $k-mal.",
            "Bei $n Würfen einer Münze fällt $k-mal Kopf.",
            "Von $n geprüften Bauteilen sind $k defekt.",
        )
        val wrong = listOf(Q(k, n - k), Q(n - k, n), Q(k, 100), Q(k + 1, n), Q(k - 1, n)).decimals(3).filter { it < Q(1) && it > Q(0) }
        val problem = P.number(
            prompt = "${gen.pick(contexts)}\nWie groß ist die relative Häufigkeit des Ereignisses?",
            answer = value,
            hint = "Gib das Ergebnis als Dezimalzahl oder Bruch an.",
            wrong = wrong,
            solution = "Relative Häufigkeit = Treffer : Versuche = $k : $n = ${T.number(value)}",
            explanation = "Die relative Häufigkeit ist die Zahl der Treffer geteilt durch die Zahl aller Versuche.",
        )
        problem?.typed?.text = T.number(value)
        return problem
    }

    /** Which number can not be a probability. */
    private fun range(level: Int, gen: Gen): P? {
        val invalidPool: List<String> = when (level) {
            1 -> listOf("1,5", "−0,2", "2", "−3", "1,2", "−0,4")
            2 -> listOf("7/6", "120 %", "−1/4", "3/2", "5/4", "150 %")
            else -> listOf("101 %", "1,01", "9/8", "−3/100", "11/10", "−0,01")
        }
        val valid = gen.shuffled(listOf("0", "1", "0,35", "3/5", "7/8", "25 %", "100 %", "9/10", "1/100", "1/3", "0,5", "2/7"))
        val wrong = valid.take(3)
        val correct = gen.pick(invalidPool)
        return P.text(
            prompt = "Welche dieser Zahlen kann keine Wahrscheinlichkeit sein?",
            correct = correct,
            wrong = wrong,
            solution = "$correct liegt nicht zwischen 0 und 1 (0 % und 100 %).",
            explanation = "Eine Wahrscheinlichkeit liegt immer zwischen 0 und 1, also zwischen 0 % und 100 %. Negative Zahlen und Zahlen über 1 sind nie möglich.",
        )
    }

    // Lesson 2

    /** P(not E) = 1 - P(E), as a fraction, as a percentage or for a neither-nor. */
    private fun complement(level: Int, gen: Gen): P? = gen.attempt { complementAttempt(level, gen) }

    private fun complementAttempt(level: Int, gen: Gen): P? {
        val events = listOf(
            Pair("Der Bus ist pünktlich", "Der Bus ist nicht pünktlich"),
            Pair("Das Los gewinnt", "Das Los gewinnt nicht"),
            Pair("Es regnet morgen", "Es regnet morgen nicht"),
            Pair("Ein Bauteil ist fehlerfrei", "Ein Bauteil ist fehlerhaft"),
        )
        val event = gen.pick(events)
        if (level == 3 && gen.chance(60)) {
            val a = Q(1, gen.pick(listOf(4, 5, 6)))
            val b = Q(1, gen.pick(listOf(3, 4, 10)))
            val answer = 1 - a - b
            return prob(
                prompt = "Auf einem Glücksrad ist die Wahrscheinlichkeit für Rot ${f(a)} und für Blau ${f(b)}.\nWie groß ist die Wahrscheinlichkeit, dass weder Rot noch Blau kommt?",
                answer = answer,
                wrong = listOf(1 - a, 1 - b, a + b, a * b),
                pair = "weder Rot (${f(a)}) noch Blau (${f(b)})",
                solution = "Rot oder Blau: ${f(a)} + ${f(b)} = ${f(a + b)}; Gegenereignis: 1 ${T.minus} ${f(a + b)} = ${f(answer)}",
                explanation = "Erst die Wahrscheinlichkeit für „Rot oder Blau“ addieren, dann das Gegenereignis mit 1 minus diesem Wert bilden.",
            )
        }
        if (level >= 2 && gen.chance(40)) {
            val p = if (level == 2) 5 * gen.int(1..19) else gen.int(1..99)
            if (p == 50) return null
            val problem = P.number(
                prompt = "${event.first} mit einer Wahrscheinlichkeit von $p %.\nWie groß ist die Wahrscheinlichkeit des Gegenereignisses („${event.second}“) in Prozent?",
                answer = Q(100 - p),
                style = S.Percent,
                hint = "Gib nur die Prozentzahl an.",
                wrong = listOf(Q(p), Q(100 + p), Q(p, 100)),
                solution = "100 % ${T.minus} $p % = ${100 - p} %",
                explanation = "Ein Ereignis und sein Gegenereignis ergeben zusammen 100 %, also P(nicht E) = 100 % − P(E).",
            )
            problem?.pairFront = "Gegenereignis zu $p %"
            return problem
        }
        val b = gen.pick(if (level == 1) listOf(5, 8, 10) else listOf(6, 12, 20, 25))
        val a = gen.int(1..(b - 1))
        val value = Q(a, b)
        if (!(MathMiddleText.gcd(a, b) == 1 || level == 1)) return null
        val answer = 1 - value
        return prob(
            prompt = "${event.first} mit der Wahrscheinlichkeit ${f(value)}.\nWie groß ist die Wahrscheinlichkeit, dass das nicht der Fall ist?",
            answer = answer,
            wrong = listOf(value, Q(b - a, a), Q(b, b - a), value * value),
            pair = "P(E) = ${f(value)}, P(nicht E)",
            solution = "P(nicht E) = 1 ${T.minus} ${f(value)} = ${f(answer)}",
            explanation = "Das Gegenereignis ergänzt E zu 1: P(nicht E) = 1 − P(E).",
        )
    }

    private class DiceEvent(val name: String, var test: (Int, Int) -> Boolean, val isSum: Boolean)

    /** Two dice thrown together: 36 equally likely pairs, counted one by one. */
    private fun twoDice(level: Int, gen: Gen): P? = gen.attempt { twoDiceAttempt(level, gen) }

    private fun twoDiceAttempt(level: Int, gen: Gen): P? {
        val s = gen.int(3..11)
        val events: List<DiceEvent>
        when (level) {
            1 -> events = listOf(
                DiceEvent("Die Augensumme ist $s", { x, y -> x + y == s }, true),
                DiceEvent("Beide Würfel zeigen dieselbe Zahl", { x, y -> x == y }, false),
            )
            2 -> {
                val t = gen.int(5..9)
                events = listOf(
                    DiceEvent("Die Augensumme ist mindestens $t", { x, y -> x + y >= t }, false),
                    DiceEvent("Die Augensumme ist höchstens $t", { x, y -> x + y <= t }, false),
                    DiceEvent("Beide Zahlen sind gerade", { x, y -> x % 2 == 0 && y % 2 == 0 }, false),
                    DiceEvent("Mindestens ein Würfel zeigt eine 6", { x, y -> x == 6 || y == 6 }, false),
                    DiceEvent("Die Augensumme ist $s", { x, y -> x + y == s }, true),
                )
            }
            else -> {
                events = listOf(
                    DiceEvent("Das Produkt der Zahlen ist ${gen.pick(listOf(6, 8, 12, 4, 10))}", { _, _ -> false }, false),
                    DiceEvent("Das Produkt der Zahlen ist gerade", { x, y -> (x * y) % 2 == 0 }, false),
                    DiceEvent("Die Zahlen unterscheiden sich um genau 2", { x, y -> Math.abs(x - y) == 2 }, false),
                    DiceEvent("Die Zahlen sind verschieden", { x, y -> x != y }, false),
                    DiceEvent("Die Augensumme ist eine Primzahl", { x, y -> isPrime(x + y) }, false),
                )
                // The product event needs its number inside the closure.
                val target = events[0].name.split(" ").filter { it.isNotEmpty() }.lastOrNull()?.toIntOrNull() ?: 6
                events[0].test = { x, y -> x * y == target }
            }
        }
        val event = gen.pick(events)
        var count = 0
        for (a in 1..6) for (b in 1..6) if (event.test(a, b)) count += 1
        if (count < 1 || count >= 36) return null
        val answer = Q(count, 36)
        val wrong = mutableListOf(Q(count, 12), Q(count, 6), Q(count + 1, 36), Q(count - 1, 36), Q(count, 36 - count))
        if (event.isSum) wrong.add(0, Q(1, 11))
        return prob(
            prompt = "Zwei Würfel werden geworfen.\nWie groß ist die Wahrscheinlichkeit? ${event.name}.",
            answer = answer,
            wrong = wrong,
            pair = event.name,
            solution = "Von den 36 gleich wahrscheinlichen Paaren sind $count günstig: P = $count/36 = ${f(answer)}",
            explanation = "Zwei Würfel haben 6 · 6 = 36 gleich wahrscheinliche Paare. Die Summen 2 bis 12 sind nicht gleich wahrscheinlich, weil unterschiedlich viele Paare zu ihnen gehören.",
        )
    }

    /** Expected number of successes: probability times number of trials. */
    private fun expected(level: Int, gen: Gen): P? = gen.attempt { expectedAttempt(level, gen) }

    private fun expectedAttempt(level: Int, gen: Gen): P? {
        val p: Q
        val shown: String
        val n: Int
        if (level == 3) {
            val percent = gen.pick(listOf(5, 10, 12, 15, 20, 35, 40, 45, 60))
            p = Q(percent, 100)
            shown = "$percent %"
            n = gen.pick(listOf(100, 200, 400, 500))
        } else {
            val den = if (level == 1) gen.pick(listOf(2, 4, 5, 10)) else gen.pick(listOf(3, 6, 8, 10, 12))
            val num = if (level == 1) 1 else gen.int(1..(den - 1))
            p = Q(num, den)
            shown = f(p)
            n = den * gen.int(if (level == 1) 3..20 else 2..12)
        }
        val answer = p * n
        if (!answer.ok || !answer.isWhole || answer.numerator < 1 || n < 8) return null
        val wrong = listOf(Q(n) - answer, answer * 10, Q(n, p.denominator), Q(n * p.denominator))
        val contexts = listOf(
            "Ein Glücksrad gewinnt mit der Wahrscheinlichkeit $shown. Es wird $n-mal gedreht.",
            "Ein Spieler trifft mit der Wahrscheinlichkeit $shown. Er wirft $n-mal.",
            "Eine Maschine fertigt mit der Wahrscheinlichkeit $shown ein fehlerhaftes Teil. Es werden $n Teile gefertigt.",
        )
        return P.number(
            prompt = "${gen.pick(contexts)}\nWie oft ist das Ereignis ungefähr zu erwarten?",
            answer = answer,
            hint = "Gib die Anzahl an.",
            wrong = wrong.decimals(2),
            solution = "Erwartet: $shown von $n = $n · $shown = ${T.number(answer)}",
            explanation = "Die erwartete Anzahl ist die Wahrscheinlichkeit mal die Zahl der Versuche; tatsächlich weicht das Ergebnis meist etwas davon ab.",
        )
    }

    /** Two draws with replacement: the first path rule. */
    private fun withReplacement(level: Int, gen: Gen): P? = gen.attempt { withReplacementAttempt(level, gen) }

    private fun withReplacementAttempt(level: Int, gen: Gen): P? {
        val n = if (level == 1) gen.pick(listOf(4, 5, 6)) else if (level == 2) gen.pick(listOf(5, 6, 8, 10)) else gen.pick(listOf(8, 9, 10, 12))
        val r = gen.int(1..(n - 1))
        val b = n - r
        val p = Q(r, n)
        val q = Q(b, n)
        val kinds = mutableListOf("rr", "bb", "rb")
        if (level == 3) kinds.add("same")
        val kind = gen.pick(kinds)
        val name: String
        val answer: Q
        val wrong: List<Q>
        when (kind) {
            "rr" -> {
                name = "beide Kugeln sind rot"
                answer = p * p
                wrong = listOf(p + p, Q(r * (r - 1), n * (n - 1)), p * q, Q(r, 2 * n))
            }
            "bb" -> {
                name = "beide Kugeln sind blau"
                answer = q * q
                wrong = listOf(q + q, Q(b * (b - 1), n * (n - 1)), p * q, Q(b, 2 * n))
            }
            "rb" -> {
                name = "die erste Kugel ist rot und die zweite blau"
                answer = p * q
                wrong = listOf(p + q, Q(r * b, n * (n - 1)), p * p, q * q)
            }
            else -> {
                name = "beide Kugeln haben dieselbe Farbe"
                answer = p * p + q * q
                wrong = listOf(p * p, q * q, 2 * p * q, p + q)
            }
        }
        if (!(r >= 1 && b >= 1 && (r != b || kind == "rb" || kind == "same" || level == 1))) return null
        val steps = if (kind == "same") "${f(p)} · ${f(p)} + ${f(q)} · ${f(q)} = ${f(p * p)} + ${f(q * q)} = ${f(answer)}"
        else "${f(if (kind == "bb") q else p)} · ${f(if (kind == "rb") q else (if (kind == "bb") q else p))} = ${f(answer)}"
        return prob(
            prompt = "Im Beutel liegen $r rote und $b blaue Kugeln. Du ziehst zweimal und legst die Kugel nach jedem Zug zurück.\nWie groß ist die Wahrscheinlichkeit, dass $name?",
            answer = answer,
            wrong = wrong,
            pair = "$r rot, $b blau, mit Zurücklegen: $name",
            solution = "Beide Züge haben dieselben Wahrscheinlichkeiten. Pfadregel: $steps",
            explanation = "Beim Ziehen mit Zurücklegen ändert sich der Beutel nicht. Entlang eines Pfades multiplizierst du die Wahrscheinlichkeiten der Züge.",
        )
    }

    // Lesson 3

    /** Two draws without replacement: the second factor has one ball less. */
    private fun withoutReplacement(level: Int, gen: Gen): P? = gen.attempt { withoutReplacementAttempt(level, gen) }

    private fun withoutReplacementAttempt(level: Int, gen: Gen): P? {
        val n = if (level == 1) gen.pick(listOf(5, 6, 7)) else if (level == 2) gen.pick(listOf(6, 8, 9, 10)) else gen.pick(listOf(8, 9, 10, 12))
        val r = gen.int(2..(n - 2))
        val b = n - r
        val kinds = mutableListOf("rr", "rb")
        if (level >= 2) kinds.add("bb")
        if (level == 3) kinds.add("atLeastRed")
        val kind = gen.pick(kinds)
        val m = Q(n * (n - 1))
        val name: String
        val answer: Q
        val wrong: List<Q>
        val steps: String
        when (kind) {
            "rr" -> {
                name = "beide Kugeln sind rot"
                answer = Q(r * (r - 1)) / m
                wrong = listOf(Q(r * r, n * n), Q(r * r, n * (n - 1)), Q(r * (r - 1), n * n), Q(r, n) + Q(r - 1, n - 1))
                steps = "$r/$n · ${r - 1}/${n - 1} = ${f(answer)}"
            }
            "bb" -> {
                name = "beide Kugeln sind blau"
                answer = Q(b * (b - 1)) / m
                wrong = listOf(Q(b * b, n * n), Q(b * b, n * (n - 1)), Q(b * (b - 1), n * n), Q(b, n) + Q(b - 1, n - 1))
                steps = "$b/$n · ${b - 1}/${n - 1} = ${f(answer)}"
            }
            "rb" -> {
                name = "die erste Kugel ist rot und die zweite blau"
                answer = Q(r * b) / m
                wrong = listOf(Q(r * b, n * n), Q(r * (b - 1), n * (n - 1)), Q(r, n) + Q(b, n - 1), Q(r * b, (n - 1) * (n - 1)))
                steps = "$r/$n · $b/${n - 1} = ${f(answer)}"
            }
            else -> {
                name = "mindestens eine Kugel ist rot"
                val none = Q(b * (b - 1)) / m
                answer = 1 - none
                wrong = listOf(none, 1 - Q(b * b, n * n), Q(r * (r - 1)) / m, Q(r, n) * 2)
                steps = "keine rote: $b/$n · ${b - 1}/${n - 1} = ${f(none)}; 1 ${T.minus} ${f(none)} = ${f(answer)}"
            }
        }
        if (!(answer > Q(0)) || !(answer < Q(1))) return null
        return prob(
            prompt = "Im Beutel liegen $r rote und $b blaue Kugeln. Du ziehst zwei Kugeln nacheinander, ohne zurückzulegen.\nWie groß ist die Wahrscheinlichkeit, dass $name?",
            answer = answer,
            wrong = wrong,
            pair = "$r rot, $b blau, ohne Zurücklegen: $name",
            solution = "Im zweiten Zug sind nur noch ${n - 1} Kugeln im Beutel: $steps",
            explanation = "Ohne Zurücklegen sinkt die Zahl der Kugeln im zweiten Zug um eins, und bei gleicher Farbe auch die Zahl der günstigen Kugeln.",
        )
    }

    /** Two different colours: two paths whose probabilities are added. */
    private fun twoPaths(level: Int, gen: Gen): P? = gen.attempt { twoPathsAttempt(level, gen) }

    private fun twoPathsAttempt(level: Int, gen: Gen): P? {
        val n = if (level == 1) gen.pick(listOf(4, 5, 6)) else if (level == 2) gen.pick(listOf(5, 6, 8)) else gen.pick(listOf(7, 8, 9, 10))
        val r = gen.int(1..(n - 1))
        val b = n - r
        val replacing = if (level == 1) true else gen.chance(50)
        val denominator = if (replacing) n * n else n * (n - 1)
        val other = if (replacing) n * (n - 1) else n * n
        val one = Q(r * b, denominator)
        val answer = 2 * one
        val wrong = listOf(one, Q(2 * r * b, other), Q(r * r + b * b, denominator), Q(r + b, n) * one)
        return prob(
            prompt = "Im Beutel liegen $r rote und $b blaue Kugeln. Du ziehst zweimal ${if (replacing) "und legst die Kugel nach jedem Zug zurück" else "ohne zurückzulegen"}.\nWie groß ist die Wahrscheinlichkeit für zwei verschiedene Farben?",
            answer = answer,
            wrong = wrong,
            pair = null,
            solution = "Zwei Pfade: rot-blau und blau-rot, beide mit ${f(one)}. Zweite Pfadregel: ${f(one)} + ${f(one)} = ${f(answer)}",
            explanation = "Zwei verschiedene Farben können auf zwei Pfaden entstehen (erst rot oder erst blau). Die Wahrscheinlichkeiten der Pfade werden addiert.",
        )
    }

    /** "At least once" through the complementary event. */
    private fun atLeastOne(level: Int, gen: Gen): P? = gen.attempt { atLeastOneAttempt(level, gen) }

    private fun atLeastOneAttempt(level: Int, gen: Gen): P? {
        val kind = gen.int(0..2)
        val p: Q
        val n: Int
        val event: String
        when (kind) {
            0 -> {
                p = Q(1, 2)
                n = if (level == 1) gen.int(2..3) else gen.int(3..5)
                event = "Du wirfst eine Münze $n-mal. Wie groß ist die Wahrscheinlichkeit, dass mindestens einmal Kopf fällt?"
            }
            1 -> {
                p = Q(1, 6)
                n = if (level == 1) 2 else gen.int(2..3)
                event = "Du würfelst $n-mal. Wie groß ist die Wahrscheinlichkeit, dass mindestens eine Sechs dabei ist?"
            }
            else -> {
                p = Q(1, gen.pick(listOf(3, 4, 5)))
                n = if (level == 1) 2 else gen.int(2..3)
                event = "Ein Glücksrad gewinnt mit der Wahrscheinlichkeit ${f(p)}. Du drehst $n-mal. Wie groß ist die Wahrscheinlichkeit für mindestens einen Gewinn?"
            }
        }
        val miss = 1 - p
        val none = miss.power(n)
        val answer = 1 - none
        val wrong = listOf(Q(n) * p, none, 1 - p.power(n), p.power(n), 1 - miss * n, p)
        return prob(
            prompt = event,
            answer = answer,
            wrong = wrong,
            pair = null,
            solution = "Gegenereignis „nie“: ${f(miss)}${T.sup(n)} = ${f(none)}; mindestens einmal: 1 ${T.minus} ${f(none)} = ${f(answer)}",
            explanation = "Bei „mindestens einmal“ rechnest du über das Gegenereignis „kein einziges Mal“ und ziehst von 1 ab. Die Wahrscheinlichkeiten der einzelnen Versuche darfst du nicht einfach addieren.",
        )
    }
}
