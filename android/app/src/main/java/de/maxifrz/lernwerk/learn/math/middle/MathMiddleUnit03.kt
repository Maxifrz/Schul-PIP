package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/**
 * Unit 3, Dezimalzahlen und Prozent: Brüche, Dezimalzahlen und Prozent ineinander umrechnen (lesson 1), Prozentwert,
 * Prozentsatz und Grundwert (2), Zu- und Abnahme (3).
 */
object MathMiddleUnit03 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u03.fractionToPercent", 1, forms(CHOICE, TYPED, PAIRS), ::fractionToPercent),
            MathMiddleTemplate("u03.percentToDecimal", 1, forms(CHOICE, TYPED, PAIRS), ::percentToDecimal),
            MathMiddleTemplate("u03.decimalCalc", 1, forms(CHOICE, TYPED, PAIRS), ::decimalCalc),
            MathMiddleTemplate("u03.percentValue", 2, forms(CHOICE, TYPED, PAIRS), ::percentValue),
            MathMiddleTemplate("u03.percentRate", 2, forms(CHOICE, TYPED, PAIRS), ::percentRate),
            MathMiddleTemplate("u03.baseValue", 2, forms(CHOICE, TYPED), ::baseValue),
            MathMiddleTemplate("u03.priceChange", 3, forms(CHOICE, TYPED, PAIRS), ::priceChange),
            MathMiddleTemplate("u03.percentChange", 3, forms(CHOICE, TYPED), ::percentChange),
            MathMiddleTemplate("u03.growthFactor", 3, forms(CHOICE, TYPED, PAIRS), ::growthFactor),
            MathMiddleTemplate("u03.vat", 3, forms(CHOICE, TYPED), ::vat),
        )
    }

    private fun scale(places: Int): Int {
        var result = 1
        repeat(places) { result *= 10 }
        return result
    }

    /** Whether the number has at most `places` digits after the decimal comma. */
    private fun fits(q: Q, places: Int): Boolean = q.ok && scale(places) % q.denominator == 0

    /** The digits after the comma a terminating decimal needs. */
    private fun decimalPlaces(q: Q): Int {
        var places = 0
        while (scale(places) % q.denominator != 0 && places < 9) places += 1
        return places
    }

    private fun percent(q: Q): String = T.number(q) + " %"

    /**
     * Two numbers calculated digit by digit with no carry (adding, digits mod 10) or no borrow (subtracting, the smaller
     * digit from the larger).
     */
    private fun digitwise(a: Int, b: Int, subtract: Boolean): Int {
        var x = a
        var y = b
        var factor = 1
        var result = 0
        while (x > 0 || y > 0) {
            val dx = x % 10
            val dy = y % 10
            result += (if (subtract) Math.abs(dx - dy) else (dx + dy) % 10) * factor
            x /= 10
            y /= 10
            factor *= 10
        }
        return result
    }

    /** An amount with its unit; money gets cents. */
    private fun amount(q: Q, unit: String): String = if (unit == "€") T.euroAmount(q) else T.number(q) + " " + unit

    // Lesson 1

    /** "Wie viel Prozent sind 3/4?" or "... 0,35?" */
    private fun fractionToPercent(level: Int, gen: Gen): P? {
        val source: Q
        var isFraction = true
        when (level) {
            1 -> source = gen.properFraction(listOf(2, 4, 5, 10))
            2 -> {
                if (gen.chance(50)) {
                    source = gen.properFraction(listOf(4, 5, 20, 25, 50))
                } else {
                    isFraction = false
                    source = Q(gen.int(1..19) * 5, 100)
                }
            }
            else -> {
                if (gen.chance(60)) {
                    source = gen.properFraction(listOf(8, 16, 40, 80))
                } else {
                    isFraction = false
                    source = Q(gen.int(1..79) * 5, 1000)
                }
            }
        }
        val rate = source * 100
        if (!rate.ok || !fits(rate, 2) || rate.isZero) return null
        val text = if (isFraction) T.fraction(source) else T.number(source)
        // The mistakes: no times 100, the rest to 100 %, the comma one place off, the digits of the fraction read together.
        val wrong = mutableListOf(source, Q(100) - rate, rate / 10)
        if (rate < Q(100)) wrong.add(rate * 10)
        if (isFraction && source.numerator * 10 + source.denominator < 100) wrong.add(Q(source.numerator * 10 + source.denominator))
        return P.number(
            prompt = "Wie viel Prozent sind $text?",
            answer = rate,
            style = S.Percent,
            hint = "Gib die Prozentzahl ohne %-Zeichen an.",
            wrong = wrong.filter { it.ok && fits(it, 3) },
            pair = text,
            solution = "$text · 100 % = ${percent(rate)}",
            explanation = "Prozent heißt Hundertstel: Rechne den Anteil mal 100, oder erweitere den Bruch auf den Nenner 100.",
        )
    }

    /** "Schreibe 7 % als Dezimalzahl." */
    private fun percentToDecimal(level: Int, gen: Gen): P? {
        val rate: Q = when (level) {
            1 -> Q(gen.pick(listOf(1, 5, 10, 20, 25, 30, 40, 50, 60, 75, 80, 90)))
            2 -> Q(gen.pick(listOf(2, 3, 7, 8, 12, 15, 35, 45, 65, 95, 105, 110, 125, 150, 200)))
            else -> Q(gen.pick(listOf(5, 15, 25, 35, 45, 75, 125, 375)), 10)
        }
        val value = rate / 100
        if (!value.ok || !fits(value, 4)) return null
        return P.number(
            prompt = "Schreibe ${percent(rate)} als Dezimalzahl.",
            answer = value,
            hint = "Gib die Dezimalzahl an.",
            wrong = listOf(rate / 10, rate, rate / 1000).filter { it.ok && fits(it, 5) },
            pair = percent(rate),
            solution = "${percent(rate)} = ${T.number(rate)}/100 = ${T.number(value)}",
            explanation = "Durch 100 teilen heißt, das Komma um zwei Stellen nach links zu schieben.",
        )
    }

    private enum class Operation { ADD, SUBTRACT, MULTIPLY, DIVIDE }

    /** "2,4 + 1,75", "0,6 · 0,5", "7,5 : 0,25": decimals calculated with the comma in the right place. */
    private fun decimalCalc(level: Int, gen: Gen): P? {
        val operations = if (level == 1) listOf(Operation.ADD, Operation.SUBTRACT)
        else if (level == 2) listOf(Operation.ADD, Operation.SUBTRACT, Operation.MULTIPLY, Operation.MULTIPLY)
        else listOf(Operation.MULTIPLY, Operation.DIVIDE, Operation.DIVIDE, Operation.SUBTRACT)
        val operation = gen.pick(operations)
        return when (operation) {
            Operation.ADD, Operation.SUBTRACT -> {
                // Level 1 has the same number of places; later ones mix one and two places, so the comma has to be placed.
                val digitsA = gen.int(if (level == 3) 101..999 else 11..99)
                val digitsB = gen.int(11..99)
                val placesA = if (level == 1) 1 else if (level == 3) 2 else 1
                val placesB = if (level == 1) 1 else if (level == 3) 1 else 2
                var first = Q(digitsA, scale(placesA))
                var second = Q(digitsB, scale(placesB))
                var firstDigits = digitsA
                var secondDigits = digitsB
                var firstPlaces = placesA
                var secondPlaces = placesB
                val doSwap = if (operation == Operation.SUBTRACT && first < second) true
                else operation == Operation.ADD && gen.chance(50)
                if (doSwap) {
                    first = second.also { second = first }
                    firstDigits = secondDigits.also { secondDigits = firstDigits }
                    firstPlaces = secondPlaces.also { secondPlaces = firstPlaces }
                }
                val result = if (operation == Operation.ADD) first + second else first - second
                if (!result.ok || result.isZero || result.isNegative) return null
                val places = maxOf(firstPlaces, secondPlaces)
                // Both numbers with the same number of places, as integers.
                val scaledFirst = firstDigits * scale(places - firstPlaces)
                val scaledSecond = secondDigits * scale(places - secondPlaces)
                // The digits written under each other from the right, ignoring where the comma is.
                val misaligned = if (operation == Operation.ADD) Q(firstDigits + secondDigits, scale(places)) else Q(firstDigits - secondDigits, scale(places))
                val slipped = Q(digitwise(scaledFirst, scaledSecond, operation == Operation.SUBTRACT), scale(places))
                val symbol = if (operation == Operation.ADD) "+" else "−"
                val working = "${T.fixed(first, places)} $symbol ${T.fixed(second, places)} = ${T.fixed(result, places)} (Komma unter Komma)"
                finish(first, second, symbol, result, listOf(slipped, misaligned, result + 1, result - 1, result * 10, result / 10), working)
            }
            Operation.MULTIPLY -> {
                val first: Q
                val second: Q
                if (level == 2) {
                    first = if (gen.chance(50)) Q(gen.int(2..9), 10) else Q(gen.int(12..49), 10)
                    second = if (first.denominator == 10 && first.numerator > 9) Q(gen.int(3..9)) else Q(gen.int(2..9), 10)
                } else {
                    first = Q(gen.int(11..49), 100)
                    second = Q(gen.int(2..9), 10)
                }
                val result = first * second
                if (!result.ok || !fits(result, 3) || !(result.double < 100)) return null
                val firstPlaces = decimalPlaces(first)
                val secondPlaces = decimalPlaces(second)
                val firstDigits = (first * Q(scale(firstPlaces))).numerator
                val secondDigits = (second * Q(scale(secondPlaces))).numerator
                val working = "$firstDigits · $secondDigits = ${firstDigits * secondDigits}; zusammen ${firstPlaces + secondPlaces} Stellen nach dem Komma: ${T.number(result)}"
                finish(first, second, "·", result, listOf(first + second, result * 10, result / 10, result * 100, result / 100), working)
            }
            Operation.DIVIDE -> {
                val divisor = gen.pick(listOf(Q(5, 10), Q(25, 100), Q(2, 10), Q(12, 10), Q(4, 100), Q(6, 100), Q(15, 10), Q(3, 10), Q(25, 10), Q(15, 100)))
                val quotient = Q(gen.int(2..30), gen.pick(listOf(1, 1, 2)))
                val dividend = divisor * quotient
                if (!dividend.ok || !fits(dividend, 3) || !(dividend.double <= 100)) return null
                val shift = decimalPlaces(divisor)
                val working = "${T.number(dividend)} : ${T.number(divisor)} = ${T.number(dividend * Q(scale(shift)))} : ${T.number(divisor * Q(scale(shift)))} = ${T.number(quotient)} (beide Kommas um $shift Stellen verschoben)"
                finish(dividend, divisor, ":", quotient, listOf(dividend - divisor, quotient * 10, quotient / 10, quotient / 100, quotient * 100), working)
            }
        }
    }

    private fun finish(first: Q, second: Q, symbol: String, result: Q, wrong: List<Q>, working: String): P? {
        val expression = "${T.number(first)} $symbol ${T.number(second)}"
        return P.number(
            prompt = "Berechne:\n$expression",
            answer = result,
            hint = "Gib das Ergebnis als Dezimalzahl an.",
            wrong = wrong.filter { it.ok && !it.isNegative && fits(it, 6) },
            pair = expression,
            solution = working,
            explanation = "Beim Addieren und Subtrahieren steht Komma unter Komma. Beim Multiplizieren zählst du die Nachkommastellen, beim Dividieren verschiebst du beide Kommas gleich weit.",
        )
    }

    // Lesson 2

    private val units = listOf("€", "kg", "m", "l")

    /** "Wie viel sind 15 % von 80 €?" */
    private fun percentValue(level: Int, gen: Gen): P? {
        val rate = Q(if (level == 1) gen.pick(listOf(5, 10, 20, 25, 50, 75)) else if (level == 2) gen.pick(listOf(2, 8, 12, 15, 30, 35, 40, 60, 65, 90)) else gen.int(1..99))
        val base = Q(if (level == 1) gen.pick(listOf(20, 40, 60, 80, 100, 120, 200)) else gen.pick(listOf(40, 60, 80, 120, 150, 200, 250, 300, 400, 500, 600)))
        val value = base * rate / 100
        if (!value.ok || !fits(value, if (level == 1) 0 else if (level == 2) 1 else 2) || value.isZero) return null
        val unit = gen.pick(units)
        val baseText = amount(base, unit)
        val question = if (gen.chance(50)) "Wie viel sind ${percent(rate)} von $baseText?" else "Berechne ${percent(rate)} von $baseText."
        return P.number(
            prompt = question,
            answer = value,
            style = if (unit == "€") S.Euro else S.Unit(unit),
            hint = "Gib nur die Zahl an.",
            wrong = listOf(rate * base / 10, value / 10, base - value, base / rate).filter { it.ok && fits(it, 3) },
            pair = "${percent(rate)} von $baseText",
            solution = "${T.number(base)} · ${T.number(rate / 100)} = ${amount(value, unit)}",
            explanation = "Der Prozentwert ist der Grundwert mal Prozentsatz: W = G · p/100. 10 % sind ein Zehntel, 1 % ein Hundertstel.",
        )
    }

    /** "Wie viel Prozent sind 12 von 80?" */
    private fun percentRate(level: Int, gen: Gen): P? {
        val base: Int
        val part: Int
        when (level) {
            1 -> {
                base = gen.pick(listOf(20, 40, 50, 80, 100, 200))
                part = base * gen.pick(listOf(10, 20, 25, 50, 75)) / 100
            }
            2 -> {
                base = gen.pick(listOf(40, 50, 60, 80, 120, 150, 200, 250, 400))
                part = gen.int(1..(base - 1))
            }
            else -> {
                base = gen.pick(listOf(40, 80, 120, 160, 200, 400, 800))
                part = gen.int(1..(base - 1))
            }
        }
        val rate = Q(part * 100, base)
        if (!rate.ok || !fits(rate, if (level == 3) 1 else 0) || part <= 0 || part >= base) return null
        val question = when (gen.int(0..2)) {
            0 -> "Wie viel Prozent sind $part von $base?"
            1 -> "Von $base Schülern fehlen $part.\nWie viel Prozent fehlen?"
            else -> "Lena erreicht $part von $base Punkten.\nWie viel Prozent sind das?"
        }
        return P.number(
            prompt = question,
            answer = rate,
            style = S.Percent,
            hint = "Gib die Prozentzahl ohne %-Zeichen an.",
            wrong = listOf(Q(part, base), Q(100) - rate, rate * 10, rate / 10).filter { it.ok && fits(it, 4) },
            pair = "$part von $base",
            solution = "$part : $base = ${T.number(Q(part, base))} = ${percent(rate)}",
            explanation = "Der Prozentsatz ist der Anteil Prozentwert : Grundwert, mal 100: p = W : G · 100.",
        )
    }

    /** "15 % sind 12 €. Wie groß ist der Grundwert?" */
    private fun baseValue(level: Int, gen: Gen): P? {
        val rate = Q(if (level == 1) gen.pick(listOf(10, 20, 25, 50)) else if (level == 2) gen.pick(listOf(5, 15, 30, 40, 60, 75)) else gen.pick(listOf(8, 12, 35, 45, 65, 16, 24)))
        val base = Q(if (level == 1) gen.pick(listOf(40, 60, 80, 100, 200)) else gen.pick(listOf(40, 60, 80, 120, 150, 200, 250, 400, 500)))
        val part = base * rate / 100
        if (!part.ok || !fits(part, 2) || part.isZero) return null
        val kind = gen.int(0..2)
        val unit = if (kind == 1) "€" else gen.pick(units)
        val partText = amount(part, unit)
        val question = when (kind) {
            0 -> "${percent(rate)} einer Menge sind $partText.\nWie groß ist die ganze Menge?"
            1 -> "Bei ${percent(rate)} Rabatt spart Tom $partText.\nWie teuer war der Artikel vorher?"
            else -> "$partText sind ${percent(rate)} des Grundwerts.\nWie groß ist der Grundwert?"
        }
        return P.number(
            prompt = question,
            answer = base,
            style = if (unit == "€") S.Euro else S.Unit(unit),
            hint = "Gib nur die Zahl an.",
            wrong = listOf(part * rate / 100, part + rate, part * rate, part / rate).filter { it.ok && fits(it, 4) },
            solution = "1 % sind ${T.number(part / rate)}, also 100 % = ${T.number(part / rate)} · 100 = ${amount(base, unit)}",
            explanation = "Rechne erst auf 1 % (Prozentwert : Prozentsatz), dann auf 100 %. Der Grundwert ist das Ganze.",
        )
    }

    // Lesson 3

    /** "Das Fahrrad kostet 240 €. Der Preis steigt um 15 %." */
    private fun priceChange(level: Int, gen: Gen): P? {
        val rate = Q(if (level == 1) gen.pick(listOf(10, 20, 25, 50)) else if (level == 2) gen.pick(listOf(5, 15, 30, 40, 12, 8)) else gen.pick(listOf(3, 7, 12, 18, 35, 45, 6)))
        val base = Q(if (level == 1) gen.pick(listOf(40, 60, 80, 100, 120, 200)) else gen.pick(listOf(40, 60, 80, 120, 150, 200, 250, 300, 400, 500)))
        val rises = gen.chance(50)
        val change = base * rate / 100
        val result = if (rises) base + change else base - change
        if (!result.ok || !fits(result, 2) || !fits(change, 2)) return null
        val (article, noun, pronoun) = gen.pick(
            listOf(Triple("Das", "Fahrrad", "es"), Triple("Der", "Rucksack", "er"), Triple("Der", "Mantel", "er"), Triple("Der", "Tisch", "er"), Triple("Das", "Handy", "es")),
        )
        val baseText = T.euroAmount(base)
        val question = if (rises) "$article $noun kostet $baseText. Der Preis steigt um ${percent(rate)}.\nWie viel kostet $pronoun danach?"
        else "$article $noun kostet $baseText. Es gibt ${percent(rate)} Rabatt.\nWie viel kostet $pronoun danach?"
        val absolute = if (rises) base + rate else base - rate
        val opposite = if (rises) base - change else base + change
        val sign = if (rises) "+" else "−"
        return P.number(
            prompt = question,
            answer = result,
            style = S.Euro,
            hint = "Gib den Preis in Euro an, ohne €.",
            wrong = listOf(change, absolute, opposite),
            pair = "$baseText $sign ${percent(rate)}",
            solution = "${percent(rate)} von $baseText = ${T.euroAmount(change)}; $baseText $sign ${T.euroAmount(change)} = ${T.euroAmount(result)}",
            explanation = if (rises) "Bei einer Zunahme rechnest du Grundwert plus Prozentwert, oder den Grundwert mal (1 + p/100)."
            else "Bei einer Abnahme rechnest du Grundwert minus Prozentwert, oder den Grundwert mal (1 − p/100).",
        )
    }

    /** "Der Preis steigt von 50 € auf 60 €. Um wie viel Prozent?" */
    private fun percentChange(level: Int, gen: Gen): P? {
        val rate = Q(if (level == 1) gen.pick(listOf(10, 20, 25, 50)) else if (level == 2) gen.pick(listOf(5, 15, 30, 40, 60)) else gen.pick(listOf(12, 35, 45, 8, 16, 24, 36)))
        val old = Q(if (level == 1) gen.pick(listOf(40, 50, 80, 100, 200)) else gen.pick(listOf(50, 60, 80, 100, 120, 150, 200, 250, 400)))
        val rises = gen.chance(55)
        val change = old * rate / 100
        val newer = if (rises) old + change else old - change
        if (!newer.ok || !newer.isWhole || !change.isWhole || rate.isZero) return null
        val thing = gen.pick(listOf("Preis", "Eintritt", "Monatsbeitrag"))
        val verb = if (rises) "steigt" else "sinkt"
        val word = if (rises) "Zunahme" else "Abnahme"
        // The new value taken as 100 % gives a different percentage.
        val wrongBase = change / newer * 100
        return P.number(
            prompt = "Der $thing $verb von ${T.euroAmount(old)} auf ${T.euroAmount(newer)}.\nUm wie viel Prozent $verb er?",
            answer = rate,
            style = S.Percent,
            hint = "Gib die Prozentzahl ohne %-Zeichen an.",
            wrong = listOf(change, newer / old * 100, rate / 10, wrongBase).filter { it.ok && fits(it, 2) },
            solution = "$word um ${T.euroAmount(change)}; ${T.number(change)} : ${T.number(old)} = ${T.number(change / old)} = ${percent(rate)}",
            explanation = "Vergleiche die Änderung mit dem alten Wert, nicht mit dem neuen: p = Änderung : alter Wert · 100.",
        )
    }

    /** "Ein Wert steigt um 8 %. Mit welchem Faktor multiplizierst du?" */
    private fun growthFactor(level: Int, gen: Gen): P? {
        val rate: Q = when (level) {
            1 -> Q(gen.pick(listOf(10, 20, 50, 5, 25)))
            2 -> Q(gen.pick(listOf(8, 12, 15, 30, 40, 4, 6)))
            else -> gen.pick(listOf(Q(5, 2), Q(15, 2), Q(1, 2), Q(3), Q(7), Q(18), Q(125, 10), Q(75, 10)))
        }
        val rises = gen.chance(50)
        val factor = if (rises) Q(1) + rate / 100 else Q(1) - rate / 100
        if (!factor.ok || !fits(factor, 4) || factor.isNegative || factor.isZero) return null
        val opposite = if (rises) Q(1) - rate / 100 else Q(1) + rate / 100
        val verb = if (rises) "steigt" else "sinkt"
        val word = if (rises) "Zunahme" else "Abnahme"
        val sign = if (rises) "+" else "−"
        val problem = P.number(
            prompt = "Ein Wert $verb um ${percent(rate)}.\nMit welchem Faktor multiplizierst du ihn?",
            answer = factor,
            hint = "Gib den Faktor als Dezimalzahl an.",
            wrong = listOf(rate / 100, opposite, if (rises) Q(1) + rate / 10 else Q(1) - rate / 10, rate).filter { it.ok && !it.isNegative },
            pair = "$word um ${percent(rate)}",
            solution = "1 $sign ${percent(rate)} = 1 $sign ${T.number(rate / 100)} = ${T.number(factor)}",
            explanation = "Der neue Wert ist 100 % plus oder minus die Änderung: Der Faktor ist 1 $sign p/100.",
        )
        problem?.pairPrompt = "Ordne jeder Änderung den Faktor zu."
        return problem
    }

    /** "Netto 200 €, Mehrwertsteuer 19 %": forwards at levels 1 and 2, backwards at level 3. */
    private fun vat(level: Int, gen: Gen): P? {
        val rate = Q(gen.pick(listOf(19, 19, 7)))
        val net = Q(if (level == 1) gen.pick(listOf(100, 200, 300, 400, 500)) else if (level == 2) gen.pick(listOf(50, 150, 250, 20, 40, 60, 80, 120)) else gen.pick(listOf(100, 200, 300, 400, 500, 600, 800)))
        val factor = Q(1) + rate / 100
        val gross = net * factor
        if (!gross.ok || !fits(gross, 2)) return null
        if (level == 3) {
            if (!(gross.double < 1000)) return null
            return P.number(
                prompt = "Ein Gerät kostet brutto ${T.euroAmount(gross)}, darin sind ${percent(rate)} Mehrwertsteuer.\nWie hoch ist der Nettopreis?",
                answer = net,
                style = S.Euro,
                hint = "Gib den Preis in Euro an, ohne €.",
                wrong = listOf(gross * (Q(1) - rate / 100), gross - rate, gross * rate / 100),
                solution = "Brutto sind ${T.number(Q(100) + rate)} % des Nettopreises: ${T.number(gross)} : ${T.number(factor)} = ${T.number(net)} €",
                explanation = "Der Bruttopreis ist 100 % plus Steuersatz. Teile ihn durch den Faktor, zum Beispiel 1,19. Die Steuer vom Bruttopreis abzuziehen ist falsch.",
            )
        }
        val tax = net * rate / 100
        return P.number(
            prompt = "Ein Gerät kostet netto ${T.euroAmount(net)}. Dazu kommen ${percent(rate)} Mehrwertsteuer.\nWie hoch ist der Bruttopreis?",
            answer = gross,
            style = S.Euro,
            hint = "Gib den Preis in Euro an, ohne €.",
            wrong = listOf(tax, net + rate, net * (Q(1) - rate / 100), net * rate).filter { it.ok && it.double < 10000 },
            solution = "Steuer: ${T.euroAmount(tax)}; ${T.euroAmount(net)} + ${T.euroAmount(tax)} = ${T.euroAmount(gross)}",
            explanation = "Brutto ist Netto plus Mehrwertsteuer, also Netto mal (1 + Steuersatz), zum Beispiel mal 1,19.",
        )
    }
}
