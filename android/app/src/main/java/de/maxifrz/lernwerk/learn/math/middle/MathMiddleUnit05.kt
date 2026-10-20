package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/**
 * Unit 5, Dreisatz und Proportionalität: proportionale Zuordnungen und der Dreisatz (lesson 1), antiproportionale
 * Zuordnungen und das Erkennen der Art einer Zuordnung (2), Maßstab und Verhältnisse (3).
 */
object MathMiddleUnit05 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u05.proportional", 1, forms(CHOICE, TYPED, PAIRS), ::proportional),
            MathMiddleTemplate("u05.unitRate", 1, forms(CHOICE, TYPED, PAIRS), ::unitRate),
            MathMiddleTemplate("u05.factor", 1, forms(CHOICE, TYPED, PAIRS), ::factor),
            MathMiddleTemplate("u05.antiproportional", 2, forms(CHOICE, TYPED, PAIRS), ::antiproportional),
            MathMiddleTemplate("u05.tableType", 2, forms(CHOICE), ::tableType),
            MathMiddleTemplate("u05.situation", 2, forms(CHOICE), ::situation),
            MathMiddleTemplate("u05.tableFill", 2, forms(CHOICE, TYPED, PAIRS), ::tableFill),
            MathMiddleTemplate("u05.scale", 3, forms(CHOICE, TYPED, PAIRS), ::scale),
            MathMiddleTemplate("u05.ratioSplit", 3, forms(CHOICE, TYPED, PAIRS), ::ratioSplit),
            MathMiddleTemplate("u05.ratioReduce", 3, forms(CHOICE, TYPED, PAIRS), ::ratioReduce),
        )
    }

    private const val valueHint = "Gib nur die Zahl an."

    private fun eur(n: Int): String = T.euroAmount(Q(n))

    // Lesson 1

    /** "5 Hefte kosten 10 €. Wie viel kosten 8 Hefte?" Through the value of one, then multiplied. */
    private fun proportional(level: Int, gen: Gen): P? {
        // 0 to 2 are about money, 3 and 4 about counts and distances; the rates stay what they are in real life.
        val story = if (level == 3) gen.pick(listOf(0, 2)) else gen.int(0..4)
        val n1: Int
        val n2: Int
        val p1: Int
        when (story) {
            0, 2 -> {
                if (level == 3) {
                    n1 = gen.pick(listOf(2, 4, 5, 10, 20, 25))
                    n2 = gen.int(3..30)
                    p1 = gen.int(3..45)
                } else {
                    n1 = if (level == 1) gen.int(2..6) else gen.pick(listOf(3, 4, 5, 6, 8, 10, 12))
                    n2 = if (level == 1) gen.int(2..9) else gen.int(2..15)
                    p1 = n1 * (if (story == 0) (if (level == 1) gen.int(2..9) else gen.int(2..12)) else (if (level == 1) gen.int(2..6) else gen.int(2..9)))
                }
            }
            1 -> {
                n1 = if (level == 1) gen.int(2..6) else gen.pick(listOf(3, 4, 5, 6, 8))
                n2 = gen.int(2..12)
                p1 = n1 * (if (level == 1) gen.int(8..15) else gen.int(8..20))
            }
            3 -> {
                n1 = gen.pick(listOf(2, 3, 4, 5, 6, 10))
                n2 = gen.int(2..12)
                p1 = n1 * gen.int(3..25)
            }
            else -> {
                n1 = gen.int(2..4)
                n2 = gen.int(2..8)
                p1 = n1 * gen.pick(listOf(30, 40, 50, 60, 80, 90))
            }
        }
        if (n1 == n2) return null
        val rate = Q(p1, n1)
        val answer = Q(p1 * n2, n1)
        if (!answer.ok || listOf(answer, rate).decimals(2).size != 2) return null
        val prompt: String
        val front: String
        val style: MathMiddleStyle
        val unit: String
        when (story) {
            0 -> {
                prompt = "$n1 Hefte kosten ${eur(p1)}. Wie viel kosten $n2 Hefte?"
                front = "$n1 Hefte = ${eur(p1)}; $n2 Hefte?"
                style = S.Euro
                unit = "€"
            }
            1 -> {
                prompt = "Für $n1 Stunden Arbeit bekommt Jonas ${eur(p1)}. Wie viel bekommt er für $n2 Stunden?"
                front = "$n1 h = ${eur(p1)}; $n2 h?"
                style = S.Euro
                unit = "€"
            }
            2 -> {
                prompt = "$n1 kg Äpfel kosten ${eur(p1)}. Wie viel kosten $n2 kg?"
                front = "$n1 kg = ${eur(p1)}; $n2 kg?"
                style = S.Euro
                unit = "€"
            }
            3 -> {
                prompt = "Eine Maschine füllt in $n1 Minuten $p1 Flaschen. Wie viele Flaschen füllt sie in $n2 Minuten?"
                front = "$n1 min = $p1 Flaschen; $n2 min?"
                style = S.Plain
                unit = ""
            }
            else -> {
                prompt = "Ein Zug fährt gleichmäßig $p1 km in $n1 Stunden. Wie weit fährt er in $n2 Stunden?"
                front = "$p1 km in $n1 h; $n2 h?"
                style = S.Unit("km")
                unit = "km"
            }
        }
        val suffix = if (unit.isEmpty()) "" else " $unit"
        // The difference added, the rule turned around, the first value multiplied, only the value of one.
        val wrong = listOf(Q(p1 + n2 - n1), Q(p1 * n1, n2), Q(p1 * n2), rate).decimals(2).positives
        val problem = P.number(
            prompt = prompt,
            answer = answer,
            style = style,
            hint = valueHint,
            wrong = wrong,
            pair = front,
            solution = "Für 1: $p1 : $n1 = ${T.number(rate)}$suffix; für $n2: ${T.number(rate)} · $n2 = ${T.number(answer)}$suffix",
            explanation = "Beim Dreisatz rechnest du erst auf die Einheit (durch die bekannte Anzahl teilen) und dann auf die gesuchte Anzahl (malnehmen). Doppelt so viel gehört zum Doppelten.",
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den gesuchten Wert zu."
        return problem
    }

    /** "Wie viel kostet 1 kg, wenn 4 kg 10 € kosten?" The value of one. */
    private fun unitRate(level: Int, gen: Gen): P? = gen.attempt { unitRateAttempt(level, gen) }

    private fun unitRateAttempt(level: Int, gen: Gen): P? {
        val story = gen.int(0..2)
        val n: Int
        val total: Int
        if (level == 1 && story == 0) { n = gen.int(2..6); total = n * gen.int(2..9) }
        else if (level == 1 && story == 1) { n = gen.int(2..6); total = n * gen.int(8..25) }
        else if (level == 1) { n = gen.int(2..6); total = n * gen.int(2..9) }
        else if (level == 2 && story == 0) { n = gen.pick(listOf(2, 4, 5, 10)); total = gen.int(5..80) }
        else if (level == 2 && story == 1) { n = gen.pick(listOf(2, 4, 5)); total = gen.int(16..120) }
        else if (level == 2) { n = gen.pick(listOf(2, 4, 5, 10)); total = gen.int(5..80) }
        else if (story == 0) { n = gen.pick(listOf(4, 5)); total = gen.int(5..45) }
        else if (story == 1) { n = gen.pick(listOf(4, 5)); total = gen.int(32..99) }
        else { n = gen.pick(listOf(4, 5, 20, 25, 50)); total = gen.int(5..99) }
        // A cyclist rides between 8 and 35 kilometres in an hour.
        if (story == 1 && (total < 8 * n || total > 35 * n)) return null
        val rate = Q(total, n)
        if (!rate.ok || listOf(rate).decimals(2).size != 1) return null
        val prompt: String
        val front: String
        val style: MathMiddleStyle
        val unit: String
        when (story) {
            0 -> {
                prompt = "$n kg Kirschen kosten ${eur(total)}. Wie viel kostet 1 kg?"
                front = "$n kg für ${eur(total)}"
                style = S.Euro
                unit = "€"
            }
            1 -> {
                prompt = "Ein Radfahrer fährt $total km in $n Stunden. Wie viele Kilometer sind das pro Stunde?"
                front = "$total km in $n h"
                style = S.Unit("km")
                unit = "km"
            }
            else -> {
                prompt = "Aus einem Hahn laufen $total l in $n Minuten. Wie viele Liter sind das pro Minute?"
                front = "$total l in $n min"
                style = S.Unit("l")
                unit = "l"
            }
        }
        // The rule turned around, the two numbers multiplied, subtracted, or the total left as it is.
        val wrong = listOf(Q(n, total), Q(total * n), Q(total - n), Q(total)).decimals(2).positives
        val problem = P.number(
            prompt = prompt,
            answer = rate,
            style = style,
            hint = valueHint,
            wrong = wrong,
            pair = front,
            solution = "$total : $n = ${T.number(rate)} $unit",
            explanation = "Der Wert von einem Stück ist die Gesamtmenge geteilt durch die Anzahl. Teile immer durch die Zahl, die zu 1 gehört.",
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den Wert für 1 zu."
        return problem
    }

    /** "Zu x = 4 gehört y = 10, die Zuordnung ist proportional. Wie groß ist der Proportionalitätsfaktor?" */
    private fun factor(level: Int, gen: Gen): P? {
        val x: Int
        val y: Int
        when (level) {
            1 -> {
                x = gen.int(2..8)
                y = x * gen.int(2..9)
            }
            2 -> {
                x = gen.pick(listOf(2, 4, 5, 10))
                y = gen.int(3..60)
            }
            else -> {
                x = gen.pick(listOf(4, 5, 20, 25))
                y = gen.int(3..60)
            }
        }
        val k = Q(y, x)
        if (!k.ok || !(k.denominator != 1 || level == 1) || listOf(k).decimals(2).size != 1 || y == x) return null
        val wrong = listOf(Q(x, y), Q(y - x), Q(x * y), Q(y)).decimals(3).positives
        return P.number(
            prompt = "Eine Zuordnung ist proportional. Zu x = $x gehört y = $y.\nWie groß ist der Proportionalitätsfaktor?",
            answer = k,
            hint = "Gib den Faktor als Zahl an.",
            wrong = wrong,
            pair = "x = $x, y = $y",
            solution = "y : x = $y : $x = ${T.number(k)}",
            explanation = "Bei einer proportionalen Zuordnung ist der Quotient y : x immer gleich. Dieser Wert heißt Proportionalitätsfaktor.",
        )
    }

    // Lesson 2

    /** "6 Arbeiter brauchen 8 Tage. Wie lange brauchen 4 Arbeiter?" The product stays the same. */
    private fun antiproportional(level: Int, gen: Gen): P? = gen.attempt { antiproportionalAttempt(level, gen) }

    private fun antiproportionalAttempt(level: Int, gen: Gen): P? {
        val product: Int = when (level) {
            1 -> gen.pick(listOf(12, 24, 36, 48, 60))
            2 -> gen.pick(listOf(24, 36, 48, 60, 72, 90, 120))
            else -> gen.pick(listOf(30, 36, 60, 72, 90, 120, 180))
        }
        val divisors = (2..12).filter { product % it == 0 }
        if (divisors.size < 2) return null
        val n1 = gen.pick(divisors)
        val n2 = gen.pick(divisors)
        if (n1 == n2) return null
        val t1 = product / n1
        val answer = Q(product, n2)
        if (!(level == 3 || answer.isWhole) || listOf(answer).decimals(1).size != 1 || t1 < 2 || !(answer.double >= 2)) return null
        val story = gen.int(0..3)
        val prompt: String
        val front: String
        val style: MathMiddleStyle
        val unit: String
        when (story) {
            0 -> {
                prompt = "$n1 Arbeiter brauchen für ein Dach $t1 Tage. Wie viele Tage brauchen $n2 Arbeiter (gleich schnell)?"
                front = "$n1 Arbeiter: $t1 Tage; $n2 Arbeiter?"
                style = S.Unit("Tage")
                unit = "Tage"
            }
            1 -> {
                prompt = "$n1 gleiche Pumpen füllen ein Becken in $t1 Stunden. Wie lange brauchen $n2 Pumpen?"
                front = "$n1 Pumpen: $t1 h; $n2 Pumpen?"
                style = S.Unit("Stunden")
                unit = "Stunden"
            }
            2 -> {
                prompt = "Ein Futtervorrat reicht für $n1 Pferde $t1 Tage. Wie lange reicht er für $n2 Pferde?"
                front = "$n1 Pferde: $t1 Tage; $n2 Pferde?"
                style = S.Unit("Tage")
                unit = "Tage"
            }
            else -> {
                prompt = "$n1 Freunde teilen sich die Kosten für ein Boot, jeder zahlt ${eur(t1)}. Wie viel zahlt jeder bei $n2 Freunden?"
                front = "$n1 Freunde zahlen je ${eur(t1)}; $n2 Freunde?"
                style = S.Euro
                unit = "€"
            }
        }
        // The rule for proportional zuordnungen used, the difference subtracted or added, the product left as it is.
        val wrong = listOf(Q(t1 * n2, n1), Q(t1 - (n2 - n1)), Q(t1 + (n2 - n1)), Q(product)).decimals(2).positives
        val problem = P.number(
            prompt = prompt,
            answer = answer,
            style = style,
            hint = valueHint,
            wrong = wrong,
            pair = front,
            solution = "$n1 · $t1 = $product; $product : $n2 = ${T.number(answer)} $unit",
            explanation = "Hier ist das Produkt immer gleich: Doppelt so viele brauchen halb so lange. Rechne erst das Ganze aus (Anzahl mal Wert) und teile dann durch die neue Anzahl.",
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den gesuchten Wert zu."
        return problem
    }

    /** "Welche Zuordnung beschreibt die Tabelle?" proportional, antiproportional or neither. */
    private fun tableType(level: Int, gen: Gen): P? = gen.attempt { tableTypeAttempt(level, gen) }

    private fun tableTypeAttempt(level: Int, gen: Gen): P? {
        val kind = if (level == 1) gen.pick(listOf(0, 0, 1, 2)) else gen.int(0..2)
        val xs: List<Int>
        val ys: List<Int>
        when (kind) {
            0 -> {
                xs = gen.shuffled(if (level == 1) listOf(1, 2, 3, 4, 5) else listOf(1, 2, 3, 4, 5, 6, 8, 10)).take(3).sorted()
                val k = gen.int(2..9)
                ys = xs.map { it * k }
            }
            1 -> {
                val product = gen.pick(listOf(12, 24, 36, 60, 120))
                val divisors = (1..12).filter { product % it == 0 }
                if (divisors.size < 3) return null
                xs = gen.shuffled(divisors).take(3).sorted()
                ys = xs.map { product / it }
            }
            else -> {
                xs = gen.shuffled(listOf(1, 2, 3, 4, 5, 6, 8, 10)).take(3).sorted()
                when (gen.int(0..2)) {
                    0 -> {
                        // y = kx + b: grows evenly but does not start at zero.
                        val k = gen.int(1..5)
                        val b = gen.int(1..9)
                        ys = xs.map { it * k + b }
                    }
                    1 -> {
                        // y = x + b, the plain "plus" rule.
                        val b = gen.int(2..9)
                        ys = xs.map { it + b }
                    }
                    else -> {
                        // y = x²: grows faster and faster.
                        if (level < 2) return null
                        ys = xs.map { it * it }
                    }
                }
            }
        }
        // Whatever the kind, it must be that one and no other.
        val ratios = xs.zip(ys).map { Q(it.second, it.first) }.toSet()
        val products = xs.zip(ys).map { it.first * it.second }.toSet()
        val proportional = ratios.size == 1
        val anti = products.size == 1
        if ((proportional && anti) || proportional != (kind == 0) || anti != (kind == 1)) return null
        val names = listOf("proportional", "antiproportional", "weder noch")
        val quotients = xs.zip(ys).joinToString("; ") { T.number(Q(it.second, it.first)) }
        val multiples = xs.zip(ys).joinToString("; ") { (it.first * it.second).toString() }
        val reason = when (kind) {
            0 -> "Die Quotienten y : x sind alle gleich ($quotients), also proportional."
            1 -> "Die Produkte x · y sind alle gleich ($multiples), also antiproportional."
            else -> "Weder die Quotienten ($quotients) noch die Produkte ($multiples) sind gleich."
        }
        return P.text(
            prompt = "Welche Zuordnung beschreibt die Tabelle?\nx: ${xs.joinToString(", ")}\ny: ${ys.joinToString(", ")}",
            correct = names[kind],
            wrong = names.filterIndexed { index, _ -> index != kind },
            solution = reason,
            explanation = "Proportional: y : x ist immer gleich. Antiproportional: x · y ist immer gleich. Trifft keins von beiden zu, ist es weder noch.",
        )
    }

    private val proportionalSituations = listOf(
        "Anzahl der Brötchen → Gesamtpreis (jedes kostet gleich viel)",
        "Fahrzeit → zurückgelegte Strecke (gleichbleibende Geschwindigkeit)",
        "Seitenlänge eines Quadrats → Umfang des Quadrats",
        "getankte Liter → Preis (fester Preis je Liter)",
        "Anzahl der Kopien → Kosten (fester Preis je Kopie)",
        "Anzahl gleicher Hefte → Gewicht aller Hefte",
    )

    private val antiproportionalSituations = listOf(
        "Anzahl der Arbeiter → Zeit für dieselbe Arbeit (alle gleich schnell)",
        "Geschwindigkeit → Fahrzeit für dieselbe Strecke",
        "Anzahl der Personen → Anteil jeder Person an einem festen Betrag",
        "Anzahl der Pumpen → Zeit, um dasselbe Becken zu füllen",
        "Anzahl der Fahrgäste → Fahrpreis je Person bei festen Busmiete",
        "Anzahl der Tage → Tagesration eines festen Vorrats",
    )

    private val otherSituations = listOf(
        "Alter eines Kindes → Körpergröße",
        "Seitenlänge eines Quadrats → Flächeninhalt",
        "gefahrene Kilometer → Taxipreis mit Grundgebühr",
        "Uhrzeit → Außentemperatur",
        "Anzahl gelesener Seiten → noch ungelesene Seiten eines Buches",
        "Radius eines Kreises → Flächeninhalt des Kreises",
    )

    /** "Welche Zuordnung ist proportional?" One of four everyday situations. */
    private fun situation(level: Int, gen: Gen): P? {
        val target = if (level == 1) gen.pick(listOf(0, 2)) else gen.int(0..2)
        val pools = listOf(proportionalSituations, antiproportionalSituations, otherSituations)
        val correct = gen.pick(pools[target])
        // One wrong situation of each of the other two kinds, and a third that is none of these two.
        val first = gen.pick(pools[(target + 1) % 3])
        val second = gen.pick(pools[(target + 2) % 3])
        val rest = (pools[(target + 1) % 3] + pools[(target + 2) % 3]).filter { it != first && it != second }
        val third = gen.pick(rest)
        val question = listOf("Welche Zuordnung ist proportional?", "Welche Zuordnung ist antiproportional?", "Welche Zuordnung ist weder proportional noch antiproportional?")[target]
        val reason = listOf(
            "Doppelt so viel gehört zum Doppelten: y : x ist immer gleich.",
            "Doppelt so viel gehört zur Hälfte: x · y ist immer gleich.",
            "Weder der Quotient y : x noch das Produkt x · y bleibt gleich.",
        )[target]
        return P.text(
            prompt = question,
            correct = correct,
            wrong = listOf(first, second, third),
            solution = "$correct: $reason",
            explanation = "Prüfe mit einem Beispiel: Wird das Doppelte zum Doppelten (proportional), zur Hälfte (antiproportional), oder keins von beiden?",
        )
    }

    /** "Die Zuordnung ist antiproportional. x: 2, 3, 6  y: 18, 12, ?" */
    private fun tableFill(level: Int, gen: Gen): P? = gen.attempt { tableFillAttempt(level, gen) }

    private fun tableFillAttempt(level: Int, gen: Gen): P? {
        val anti = if (level == 1) false else gen.chance(55)
        val xs: List<Int>
        val ys: List<Int>
        val answer: Int
        if (anti) {
            val product = gen.pick(if (level == 2) listOf(12, 24, 36, 60) else listOf(24, 36, 48, 60, 72, 120))
            val divisors = (1..24).filter { product % it == 0 }
            if (divisors.size < 3) return null
            val picked = gen.shuffled(divisors).take(3).sorted()
            xs = picked
            ys = picked.map { product / it }
            answer = ys[2]
        } else {
            val k = if (level == 3) gen.int(3..12) else gen.int(2..9)
            val picked = if (level == 1) listOf(gen.int(1..3), gen.int(4..6), gen.int(7..10)) else gen.shuffled(listOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12)).take(3).sorted()
            xs = picked
            ys = picked.map { it * k }
            answer = ys[2]
        }
        if (xs.toSet().size != 3 || ys.toSet().size != 3) return null
        val ruleName = if (anti) "antiproportional" else "proportional"
        // The other kind of rule, the difference carried over, and the neighbour's value.
        val otherRule: Int?
        if (anti) {
            otherRule = if ((ys[0] * xs[2]) % xs[0] == 0) ys[0] * xs[2] / xs[0] else null
        } else {
            val product = xs[0] * ys[0]
            otherRule = if (product % xs[2] == 0) product / xs[2] else null
        }
        val candidates = mutableListOf(ys[1] + (xs[2] - xs[1]), ys[1] - (xs[2] - xs[1]), ys[1])
        if (otherRule != null) candidates.add(otherRule)
        val wrong = candidates.map { Q(it) }.positives
        val product = xs[0] * ys[0]
        val working = if (anti) "${xs[0]} · ${ys[0]} = $product; $product : ${xs[2]} = $answer"
        else "y : x = ${ys[0]} : ${xs[0]} = ${ys[0] / xs[0]}; ${ys[0] / xs[0]} · ${xs[2]} = $answer"
        val table = "x: ${xs.joinToString(", ")}\ny: ${ys[0]}, ${ys[1]}, ?"
        val problem = P.number(
            prompt = "Die Zuordnung ist $ruleName.\n$table\nWelche Zahl fehlt?",
            answer = Q(answer),
            hint = "",
            wrong = wrong,
            typedPrompt = "Die Zuordnung ist $ruleName.\n$table\nWelche Zahl fehlt? Gib die Zahl an.",
            pair = "$ruleName: ${xs[0]} → ${ys[0]}, ${xs[2]} → ?",
            solution = working,
            explanation = if (anti) "Bei einer antiproportionalen Zuordnung ist das Produkt x · y immer gleich. Berechne es aus einem vollständigen Paar."
            else "Bei einer proportionalen Zuordnung ist der Quotient y : x immer gleich. Berechne ihn aus einem vollständigen Paar.",
        )
        problem?.pairPrompt = "Ordne jeder Tabelle die fehlende Zahl zu."
        return problem
    }

    // Lesson 3

    /** "Maßstab 1 : 50 000. 4 cm auf der Karte, wie viel in Wirklichkeit?" and the way back. */
    private fun scale(level: Int, gen: Gen): P? = gen.attempt { scaleAttempt(level, gen) }

    private fun scaleAttempt(level: Int, gen: Gen): P? {
        val n: Int = when (level) {
            1 -> gen.pick(listOf(100, 500, 1000))
            2 -> gen.pick(listOf(10000, 25000, 50000, 100_000))
            else -> gen.pick(listOf(25000, 50000, 100_000, 200_000))
        }
        val scaleText = "1 : " + T.grouped(n)
        if (level <= 2) {
            val d = gen.int(2..12)
            val meters = level == 1
            val real = if (meters) Q(d * n, 100) else Q(d * n, 100_000)
            if (!real.ok || listOf(real).decimals(2).size != 1 || !(real.double < 1000)) return null
            val unit = if (meters) "m" else "km"
            val wrong = listOf(real * 10, real / 10, real * 100, real / 100).decimals(2).positives
            return P.number(
                prompt = "Maßstab $scaleText. Eine Strecke ist auf der Karte $d cm lang.\nWie lang ist sie in Wirklichkeit in $unit?",
                answer = real,
                style = S.Unit(unit),
                hint = "Gib nur die Zahl an.",
                wrong = wrong,
                pair = "$scaleText, $d cm",
                solution = "$d cm · ${T.grouped(n)} = ${T.grouped(d * n)} cm = ${T.number(real)} $unit",
                explanation = "Bei 1 : ${T.grouped(n)} ist 1 cm auf der Karte ${T.grouped(n)} cm in Wirklichkeit. Rechne dann um: 100 cm sind 1 m, 100 000 cm sind 1 km.",
            )
        }
        // Back from the real distance to the map.
        val km = gen.int(2..30)
        val onMap = Q(km * 100_000, n)
        if (!onMap.ok || listOf(onMap).decimals(1).size != 1 || !(onMap.double >= 2) || !(onMap.double < 100)) return null
        val wrong = listOf(onMap * 10, onMap / 10, onMap * 100, onMap / 100).decimals(1).positives
        return P.number(
            prompt = "Zwei Orte sind $km km voneinander entfernt. Wie viele cm sind das auf einer Karte im Maßstab $scaleText?",
            answer = onMap,
            style = S.Unit("cm"),
            hint = "Gib nur die Zahl an.",
            wrong = wrong,
            pair = "$km km bei $scaleText",
            solution = "$km km = ${T.grouped(km * 100_000)} cm; ${T.grouped(km * 100_000)} : ${T.grouped(n)} = ${T.number(onMap)} cm",
            explanation = "Rechne die wirkliche Länge in cm um und teile durch den Maßstabsfaktor: Bei 1 : ${T.grouped(n)} ist die Karte ${T.grouped(n)}-mal kleiner.",
        )
    }

    /** "150 € werden im Verhältnis 2 : 3 geteilt. Wie viel bekommt der Zweite?" */
    private fun ratioSplit(level: Int, gen: Gen): P? {
        val parts: List<Pair<Int, Int>>
        val k: Int
        when (level) {
            1 -> {
                parts = listOf(Pair(1, 2), Pair(1, 3), Pair(2, 3), Pair(1, 4))
                k = gen.int(2..10)
            }
            2 -> {
                parts = listOf(Pair(3, 4), Pair(2, 5), Pair(3, 5), Pair(1, 5), Pair(4, 5), Pair(1, 6))
                k = gen.int(2..15)
            }
            else -> {
                parts = listOf(Pair(3, 7), Pair(5, 7), Pair(2, 7), Pair(5, 8), Pair(3, 8), Pair(7, 9), Pair(4, 9))
                k = gen.int(3..20)
            }
        }
        val picked = gen.pick(parts)
        var p = picked.first
        var q = picked.second
        if (gen.chance(50)) { val t = p; p = q; q = t }
        val total = (p + q) * k
        val askFirst = gen.chance(50)
        val share = (if (askFirst) p else q) * k
        val swapped = (if (askFirst) q else p) * k
        val story = gen.int(0..2)
        val ordinal = if (askFirst) "der Erste" else "der Zweite"
        val prompt: String
        val style: MathMiddleStyle
        val unit: String
        when (story) {
            0 -> {
                prompt = "Anna und Ben teilen $total € im Verhältnis $p : $q. Wie viel bekommt ${if (askFirst) "Anna" else "Ben"}?"
                style = S.Euro
                unit = "€"
            }
            1 -> {
                prompt = "Eine Mischung aus Saft und Wasser hat das Verhältnis Saft : Wasser = $p : $q und ist $total l groß. Wie viele Liter sind ${if (askFirst) "Saft" else "Wasser"}?"
                style = S.Unit("l")
                unit = "l"
            }
            else -> {
                prompt = "Ein Gewinn von $total € wird im Verhältnis $p : $q auf zwei Spieler verteilt. Wie viel bekommt $ordinal?"
                style = S.Euro
                unit = "€"
            }
        }
        // The other share, one part only, half and half, the total divided by the number of this share.
        val wrong = mutableListOf(swapped, k, total - k)
        if (total % 2 == 0) wrong.add(total / 2)
        if (total % (if (askFirst) p else q) == 0) wrong.add(total / (if (askFirst) p else q))
        val ordinalPart = if (askFirst) p else q
        val problem = P.number(
            prompt = prompt,
            answer = Q(share),
            style = style,
            hint = valueHint,
            wrong = whole(wrong),
            pair = "$total im Verhältnis $p : $q, ${if (askFirst) "1. Teil" else "2. Teil"}",
            solution = "$p + $q = ${p + q} Teile; $total : ${p + q} = $k je Teil; $k · $ordinalPart = $share $unit",
            explanation = "Zähle alle Teile zusammen ($p + $q), teile das Ganze durch diese Zahl und nimm das Ergebnis mal die Teile des Gesuchten.",
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den gesuchten Anteil zu."
        return problem
    }

    private fun whole(values: List<Int>): List<Q> = values.map { Q(it) }.positives

    /** "Kürze das Verhältnis 12 : 18 vollständig." Level 3 has two units to bring to one first. */
    private fun ratioReduce(level: Int, gen: Gen): P? = gen.attempt { ratioReduceAttempt(level, gen) }

    private fun ratioReduceAttempt(level: Int, gen: Gen): P? {
        val prompt: String
        val front: String
        val working: String
        val reduced: Pair<Int, Int>
        var wrong: List<String> = emptyList()
        fun ratio(x: Int, y: Int): String = "$x : $y"
        if (level <= 2) {
            val base = gen.pick(listOf(Pair(1, 2), Pair(1, 3), Pair(2, 3), Pair(3, 4), Pair(3, 5), Pair(2, 5), Pair(4, 5), Pair(1, 4), Pair(5, 6)))
            val divisor = if (level == 1) gen.int(2..6) else gen.int(4..15)
            val a = base.first * divisor
            val b = base.second * divisor
            reduced = base
            if (level == 1) {
                prompt = "Kürze das Verhältnis vollständig:\n$a : $b"
                front = ratio(a, b)
                working = "ggT($a, $b) = $divisor; ${ratio(a, b)} = ${ratio(base.first, base.second)}"
            } else {
                when (gen.int(0..2)) {
                    0 -> {
                        prompt = "Ein Rezept braucht ${a * 10} g Mehl und ${b * 10} g Zucker.\nWie lautet das Verhältnis Mehl : Zucker, vollständig gekürzt?"
                        front = "${a * 10} g : ${b * 10} g"
                        working = "ggT(${a * 10}, ${b * 10}) = ${divisor * 10}; also ${ratio(base.first, base.second)}"
                    }
                    1 -> {
                        prompt = "In einer Klasse sind $a Mädchen und $b Jungen.\nWie lautet das Verhältnis Mädchen : Jungen, vollständig gekürzt?"
                        front = "$a Mädchen : $b Jungen"
                        working = "ggT($a, $b) = $divisor; also ${ratio(base.first, base.second)}"
                    }
                    else -> {
                        prompt = "Ein Rechteck ist $a cm lang und $b cm breit.\nWie lautet das Verhältnis Länge : Breite, vollständig gekürzt?"
                        front = "$a cm : $b cm"
                        working = "ggT($a, $b) = $divisor; also ${ratio(base.first, base.second)}"
                    }
                }
            }
            // Stopped halfway, the two sides switched, only one side shortened.
            val stops = (2 until divisor).filter { divisor % it == 0 }
            val list = mutableListOf<String>()
            val stop = stops.lastOrNull()
            if (stop != null) list.add(ratio(base.first * (divisor / stop), base.second * (divisor / stop)))
            list.addAll(listOf(ratio(base.second, base.first), ratio(a, base.second), ratio(base.first, b)))
            wrong = list
        } else {
            // The second quantity in the larger unit: 250 g : 1 kg is 250 : 1000.
            val (small, large, factor) = gen.pick(listOf(Triple("g", "kg", 1000), Triple("cm", "m", 100), Triple("min", "h", 60)))
            val big = gen.int(1..4)
            val inSmall = big * factor
            val smallValue = gen.int(1..19) * (if (factor == 60) 5 else if (factor == 100) 5 else 50)
            val divisor = T.gcd(smallValue, inSmall)
            reduced = Pair(smallValue / divisor, inSmall / divisor)
            if (!(reduced.first < reduced.second) || reduced.second > 40 || reduced.first == smallValue) return null
            prompt = "Wie lautet das Verhältnis $smallValue $small : $big $large, vollständig gekürzt?"
            front = "$smallValue $small : $big $large"
            working = "$big $large = $inSmall $small; ${ratio(smallValue, inSmall)} = ${ratio(reduced.first, reduced.second)}"
            // The units ignored, left unreduced, the sides switched.
            val ignored = T.gcd(smallValue, big)
            wrong = listOf(ratio(smallValue / ignored, big / ignored), ratio(smallValue, inSmall), ratio(reduced.second, reduced.first))
        }
        val problem = P.text(
            prompt = prompt,
            correct = ratio(reduced.first, reduced.second),
            wrong = wrong,
            typed = Ty(prompt.replace("\n", " ") + "\nWelche Zahl steht rechts?", rat(reduced.second)),
            pair = front,
            solution = working,
            explanation = "Kürze ein Verhältnis wie einen Bruch: Teile beide Zahlen durch den größten gemeinsamen Teiler. Haben sie verschiedene Einheiten, rechne zuerst um.",
        )
        problem.pairPrompt = "Kürze vollständig und ordne zu."
        return problem
    }
}
