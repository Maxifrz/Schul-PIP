package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.CHOICE
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.PAIRS
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleForm.TYPED

private val T = MathMiddleText

/**
 * Unit 8, Geometrie: Umfang und Fläche ebener Figuren und des Kreises (lesson 1), Quader, Zylinder, Prisma und
 * Einheiten (2), Winkelsumme und Satz des Pythagoras (3).
 */
object MathMiddleUnit08 {
    val templates: List<MathMiddleTemplate> by lazy {
        listOf(
            MathMiddleTemplate("u08.rectangle", 1, forms(CHOICE, TYPED, PAIRS), ::rectangle),
            MathMiddleTemplate("u08.area", 1, forms(CHOICE, TYPED, PAIRS), ::area),
            MathMiddleTemplate("u08.circle", 1, forms(CHOICE, TYPED, PAIRS), ::circle),
            MathMiddleTemplate("u08.cuboid", 2, forms(CHOICE, TYPED, PAIRS), ::cuboid),
            MathMiddleTemplate("u08.solid", 2, forms(CHOICE, TYPED, PAIRS), ::solid),
            MathMiddleTemplate("u08.units", 2, forms(CHOICE, TYPED, PAIRS), ::units),
            MathMiddleTemplate("u08.volumeWord", 2, forms(CHOICE, TYPED), ::volumeWord),
            MathMiddleTemplate("u08.angles", 3, forms(CHOICE, TYPED, PAIRS), ::angles),
            MathMiddleTemplate("u08.pythagoras", 3, forms(CHOICE, TYPED, PAIRS), ::pythagoras),
            MathMiddleTemplate("u08.pythagorasWord", 3, forms(CHOICE, TYPED), ::pythagorasWord),
            MathMiddleTemplate("u08.rightAngleTest", 3, forms(CHOICE, TYPED), ::rightAngleTest),
        )
    }

    private const val valueHint = "Gib nur die Zahl an."
    private const val piHint = "Gib nur die Zahl vor π an."

    private fun num(q: Q): String = T.number(q)

    // Lesson 1

    /** "Ein Rechteck ist 8 cm lang und 5 cm breit. Berechne den Umfang." Perimeter, area, and the missing side. */
    private fun rectangle(level: Int, gen: Gen): P? = gen.attempt { rectangleAttempt(level, gen) }

    private fun rectangleAttempt(level: Int, gen: Gen): P? {
        val unit = gen.pick(listOf("cm", "m"))
        val square = level == 1 && gen.chance(30)
        val a: Q
        val b: Q
        when (level) {
            1 -> {
                a = Q(gen.int(2..12))
                b = if (square) a else Q(gen.int(2..12))
            }
            2 -> {
                a = Q(gen.int(3..19), 2)
                b = Q(gen.int(2..12))
            }
            else -> {
                a = Q(gen.int(3..16))
                b = Q(gen.int(2..12))
            }
        }
        if (!(square || a != b)) return null
        val perimeter = (a + b) * 2
        val area = a * b
        if (!perimeter.ok || !area.ok || listOf(area, perimeter).decimals(1).size != 2) return null
        val shape = if (square) "Ein Quadrat hat die Seitenlänge ${num(a)} $unit." else "Ein Rechteck ist ${num(a)} $unit lang und ${num(b)} $unit breit."
        if (level == 3) {
            // Backwards: the missing side from the perimeter or the area.
            if (gen.chance(50)) {
                val wrong = listOf(perimeter - a, perimeter / 2 + a, perimeter - a * 2, perimeter).decimals(1).positives
                return P.number(
                    prompt = "Ein Rechteck hat den Umfang ${num(perimeter)} $unit und ist ${num(a)} $unit lang.\nWie breit ist es?",
                    answer = b,
                    style = S.Unit(unit),
                    hint = valueHint,
                    wrong = wrong,
                    pair = "U = ${num(perimeter)} $unit, a = ${num(a)} $unit",
                    solution = "${num(perimeter)} : 2 = ${num(perimeter / 2)}; ${num(perimeter / 2)} ${T.minus} ${num(a)} = ${num(b)} $unit",
                    explanation = "Der Umfang ist 2 · (a + b). Teile ihn durch 2, dann ziehst du die bekannte Seite ab.",
                )
            }
            val wrong = listOf(area - a, area * a, perimeter / 2 - a, area / 2).decimals(1).positives
            return P.number(
                prompt = "Ein Rechteck hat die Fläche ${num(area)} $unit² und ist ${num(a)} $unit lang.\nWie breit ist es?",
                answer = b,
                style = S.Unit(unit),
                hint = valueHint,
                wrong = wrong,
                pair = "A = ${num(area)} $unit², a = ${num(a)} $unit",
                solution = "A = a · b, also b = ${num(area)} : ${num(a)} = ${num(b)} $unit",
                explanation = "Die Fläche ist Länge mal Breite. Die fehlende Seite findest du durch Teilen der Fläche durch die bekannte Seite.",
            )
        }
        val asksPerimeter = gen.chance(50)
        val value = if (asksPerimeter) perimeter else area
        val wrong = (if (asksPerimeter) listOf(area, a + b, a * 2 + b, area * 2) else listOf(perimeter, a + b, a * 2 * b, perimeter / 2)).decimals(1).positives
        return P.number(
            prompt = "$shape\n" + (if (asksPerimeter) "Berechne den Umfang." else "Berechne den Flächeninhalt."),
            answer = value,
            style = S.Unit(if (asksPerimeter) unit else "$unit²"),
            hint = valueHint,
            wrong = wrong,
            pair = (if (asksPerimeter) "Umfang: " else "Fläche: ") + (if (square) "a = ${num(a)} $unit" else "${num(a)} $unit · ${num(b)} $unit"),
            solution = if (asksPerimeter) "U = 2 · (${num(a)} + ${num(b)}) = ${num(perimeter)} $unit"
            else "A = ${num(a)} · ${num(b)} = ${num(area)} $unit²",
            explanation = if (asksPerimeter) "Der Umfang ist die Länge des Randes: Alle vier Seiten zusammen, also 2 · (a + b)."
            else "Der Flächeninhalt ist Länge mal Breite. Er hat die Einheit mit Quadrat, zum Beispiel cm².",
        )
    }

    /** Triangle, parallelogram and trapezoid: the base times the height, halved where it has to be. */
    private fun area(level: Int, gen: Gen): P? = gen.attempt { areaAttempt(level, gen) }

    private fun areaAttempt(level: Int, gen: Gen): P? {
        val unit = gen.pick(listOf("cm", "m"))
        val kind = if (level == 1) gen.int(0..1) else if (level == 2) gen.int(0..2) else gen.int(0..2)
        when (kind) {
            0 -> {
                // Triangle.
                val g = gen.int(if (level == 1) 3..14 else 5..20)
                val h = gen.int(if (level == 1) 2..12 else 4..16)
                if (g * h % 2 != 0 || g == h) return null
                val value = Q(g * h, 2)
                if (level == 3 && gen.chance(60)) {
                    // The doubling forgotten, the area itself, the area doubled and not divided by the base, the height doubled.
                    val wrong = listOf(value / g, value, Q(g * h), Q(h * 2)).decimals(1).positives
                    return P.number(
                        prompt = "Ein Dreieck hat die Grundseite $g $unit und die Fläche ${num(value)} $unit².\nWie hoch ist das Dreieck?",
                        answer = Q(h),
                        style = S.Unit(unit),
                        hint = valueHint,
                        wrong = wrong,
                        pair = "Dreieck: g = $g $unit, A = ${num(value)} $unit²",
                        solution = "A = g · h : 2, also h = 2 · ${num(value)} : $g = $h $unit",
                        explanation = "Stelle die Formel A = g · h : 2 nach h um: Verdopple die Fläche und teile durch die Grundseite.",
                    )
                }
                return P.number(
                    prompt = "Ein Dreieck hat die Grundseite $g $unit und die Höhe $h $unit.\nWie groß ist die Fläche?",
                    answer = value,
                    style = S.Unit("$unit²"),
                    hint = valueHint,
                    wrong = listOf(Q(g * h), Q(g + h), Q(g * h, 4), Q(g * h * 2)).decimals(1).positives,
                    pair = "Dreieck: g = $g $unit, h = $h $unit",
                    solution = "A = g · h : 2 = $g · $h : 2 = ${num(value)} $unit²",
                    explanation = "Ein Dreieck ist halb so groß wie das Rechteck mit derselben Grundseite und Höhe: A = g · h : 2.",
                )
            }
            1 -> {
                // Parallelogram: the height, not the slanted side.
                val g = gen.int(3..16)
                val h = gen.int(2..12)
                val slanted = h + gen.int(1..4)
                if (g == h) return null
                return P.number(
                    prompt = "Ein Parallelogramm hat die Grundseite $g $unit, die Höhe $h $unit und die schräge Seite $slanted $unit.\nWie groß ist die Fläche?",
                    answer = Q(g * h),
                    style = S.Unit("$unit²"),
                    hint = valueHint,
                    wrong = listOf(Q(g * slanted), Q(g * h, 2), Q(g + h), Q(2 * (g + slanted))).decimals(1).positives,
                    pair = "Parallelogramm: g = $g $unit, h = $h $unit",
                    solution = "A = g · h = $g · $h = ${g * h} $unit². Die schräge Seite wird nicht gebraucht.",
                    explanation = "Beim Parallelogramm gilt A = g · h. Wichtig ist die Höhe (senkrecht zur Grundseite), nicht die schräge Seite.",
                )
            }
            else -> {
                // Trapezoid: the mean of the parallel sides times the height.
                val a = gen.int(if (level == 2) 4..14 else 6..20)
                val c = gen.int(2..(a - 1))
                val h = gen.int(2..12)
                if ((a + c) * h % 2 != 0) return null
                val value = Q((a + c) * h, 2)
                return P.number(
                    prompt = "Ein Trapez hat die parallelen Seiten $a $unit und $c $unit und die Höhe $h $unit.\nWie groß ist die Fläche?",
                    answer = value,
                    style = S.Unit("$unit²"),
                    hint = valueHint,
                    wrong = listOf(Q((a + c) * h), Q(a * h, 2), Q(a * c * h, 2), Q(a + c + h)).decimals(1).positives,
                    pair = "Trapez: a = $a $unit, c = $c $unit, h = $h $unit",
                    solution = "A = (a + c) : 2 · h = ($a + $c) : 2 · $h = ${num(value)} $unit²",
                    explanation = "Beim Trapez nimmst du den Mittelwert der beiden parallelen Seiten mal die Höhe: A = (a + c) : 2 · h.",
                )
            }
        }
    }

    /** Circle: the area and the circumference as a multiple of π. */
    private fun circle(level: Int, gen: Gen): P? = gen.attempt { circleAttempt(level, gen) }

    private fun circleAttempt(level: Int, gen: Gen): P? {
        val r = gen.int(if (level == 1) 2..9 else 3..15)
        val unit = gen.pick(listOf("cm", "m"))
        if (level == 3 && gen.chance(60)) {
            // Backwards from the circumference or the area.
            if (gen.chance(50)) {
                val wrong = listOf(Q(r * 2), Q(r * r), Q(r, 2), Q(r * 4)).positives
                return P.number(
                    prompt = "Der Umfang eines Kreises ist ${2 * r}π $unit.\nWie groß ist der Radius?",
                    answer = Q(r),
                    style = S.Unit(unit),
                    hint = valueHint,
                    wrong = wrong,
                    pair = "U = ${2 * r}π $unit",
                    solution = "U = 2πr, also ${2 * r}π = 2πr und r = $r $unit",
                    explanation = "Der Umfang ist U = 2πr. Teilst du den Umfang durch 2π, bleibt der Radius.",
                )
            }
            val wrong = listOf(Q(r * r), Q(r, 2), Q(r * r, 2), Q(2 * r)).positives
            return P.number(
                prompt = "Die Fläche eines Kreises ist ${r * r}π $unit².\nWie groß ist der Radius?",
                answer = Q(r),
                style = S.Unit(unit),
                hint = valueHint,
                wrong = wrong,
                pair = "A = ${r * r}π $unit²",
                solution = "A = πr², also r² = ${r * r} und r = $r $unit",
                explanation = "Die Fläche ist A = πr². Nach dem Teilen durch π bleibt r², und die Wurzel daraus ist der Radius.",
            )
        }
        val withDiameter = level >= 2 && gen.chance(50)
        val givenText = if (withDiameter) "den Durchmesser ${2 * r} $unit" else "den Radius $r $unit"
        val asksArea = gen.chance(50)
        val answer = if (asksArea) r * r else 2 * r
        // Area and circumference mixed up, the diameter used as the radius, the radius not squared.
        val wrong = if (asksArea) listOf(2 * r, r, 4 * r * r, r * r * 2, r * 2 * r * 2).map { Q(it) }
        else listOf(r * r, r, 4 * r * r, 4 * r, 2 * r * r).map { Q(it) }
        return P.number(
            prompt = "Ein Kreis hat $givenText.\nBerechne " + (if (asksArea) "die Fläche" else "den Umfang") + " in $unit" + (if (asksArea) "²" else "") + ". Gib das Ergebnis als Vielfaches von π an.",
            answer = Q(answer),
            style = S.Pi,
            hint = piHint,
            wrong = wrong,
            pair = (if (asksArea) "Fläche: " else "Umfang: ") + (if (withDiameter) "d = ${2 * r} $unit" else "r = $r $unit"),
            solution = if (asksArea) "r = $r $unit; A = π · ${r}² = ${r * r}π $unit²"
            else "r = $r $unit; U = 2 · π · $r = ${2 * r}π $unit",
            explanation = if (asksArea) "Die Fläche ist A = π · r². Der Radius ist der halbe Durchmesser, und nur der Radius wird quadriert."
            else "Der Umfang ist U = 2 · π · r. Der Radius ist der halbe Durchmesser.",
        )
    }

    // Lesson 2

    /** Volume and surface of a cuboid, and a missing edge. */
    private fun cuboid(level: Int, gen: Gen): P? = gen.attempt { cuboidAttempt(level, gen) }

    private fun cuboidAttempt(level: Int, gen: Gen): P? {
        val a = gen.int(if (level == 1) 2..8 else 3..12)
        val b = gen.int(if (level == 1) 2..8 else 3..10)
        val c = gen.int(if (level == 1) 2..6 else 2..9)
        if (setOf(a, b, c).size < 2) return null
        val volume = a * b * c
        val surface = 2 * (a * b + a * c + b * c)
        val sides = "Ein Quader ist $a cm lang, $b cm breit und $c cm hoch."
        if (level == 3 && gen.chance(45)) {
            // The missing edge from the volume.
            // Divided by another edge, the base area taken off, the base area alone.
            val wrong = listOf(volume / a, volume - a * b, a * b, volume / b).filter { it > 0 }
            return P.number(
                prompt = "Ein Quader mit der Grundfläche ${a * b} cm² hat das Volumen $volume cm³.\nWie hoch ist er?",
                answer = Q(c),
                style = S.Unit("cm"),
                hint = valueHint,
                wrong = wrong.map { Q(it) },
                pair = "G = ${a * b} cm², V = $volume cm³",
                solution = "V = G · h, also h = $volume : ${a * b} = $c cm",
                explanation = "Das Volumen ist Grundfläche mal Höhe. Die Höhe findest du, indem du das Volumen durch die Grundfläche teilst.",
            )
        }
        val asksVolume = level == 1 || gen.chance(45)
        if (asksVolume) {
            // The sum, the surface, the base area alone, a doubled volume.
            val wrong = listOf(a + b + c, surface, a * b, 2 * volume, a * b + c)
            return P.number(
                prompt = "$sides\nBerechne das Volumen.",
                answer = Q(volume),
                style = S.Unit("cm³"),
                hint = valueHint,
                wrong = wrong.map { Q(it) },
                pair = "Volumen: $a cm · $b cm · $c cm",
                solution = "V = a · b · c = $a · $b · $c = $volume cm³",
                explanation = "Das Volumen eines Quaders ist Länge mal Breite mal Höhe. Die Einheit hat die Hochzahl 3.",
            )
        }
        // The volume, one pair of faces missing, the sum of the three faces without doubling.
        val wrong = listOf(volume, a * b + a * c + b * c, 2 * (a * b + a * c), a * b * 2 + c)
        return P.number(
            prompt = "$sides\nBerechne die Oberfläche.",
            answer = Q(surface),
            style = S.Unit("cm²"),
            hint = valueHint,
            wrong = wrong.map { Q(it) },
            pair = "Oberfläche: $a cm · $b cm · $c cm",
            solution = "O = 2 · (a·b + a·c + b·c) = 2 · (${a * b} + ${a * c} + ${b * c}) = $surface cm²",
            explanation = "Ein Quader hat sechs Rechtecke, je zwei gleiche: O = 2 · (a·b + a·c + b·c).",
        )
    }

    /** Prism and cylinder: the volume is the base area times the height. */
    private fun solid(level: Int, gen: Gen): P? = gen.attempt { solidAttempt(level, gen) }

    private fun solidAttempt(level: Int, gen: Gen): P? {
        if (level == 1) {
            val g = gen.int(4..30)
            val h = gen.int(2..12)
            if (g == h) return null
            // Base plus height, half of the volume, the volume doubled.
            return P.number(
                prompt = "Ein Prisma hat die Grundfläche $g cm² und die Höhe $h cm.\nWie groß ist das Volumen?",
                answer = Q(g * h),
                style = S.Unit("cm³"),
                hint = valueHint,
                wrong = listOf(Q(g + h), Q(g * h, 2), Q(g * h * 2), Q(g * h * h)).decimals(1).positives,
                pair = "Prisma: G = $g cm², h = $h cm",
                solution = "V = G · h = $g · $h = ${g * h} cm³",
                explanation = "Für jedes Prisma und jeden Zylinder gilt V = G · h: Grundfläche mal Höhe.",
            )
        }
        val r = gen.int(2..9)
        val h = gen.int(2..12)
        val withDiameter = level == 3 && gen.chance(50)
        if (r == h) return null
        val value = r * r * h
        val given = if (withDiameter) "den Durchmesser ${2 * r} cm" else "den Radius $r cm"
        // The radius not squared, the diameter used as the radius, the lateral surface, the base area alone.
        val wrong = listOf(r * h, 4 * r * r * h, 2 * r * h, r * r, r * r * h * 2)
        return P.number(
            prompt = "Ein Zylinder hat $given und die Höhe $h cm.\nBerechne das Volumen in cm³. Gib das Ergebnis als Vielfaches von π an.",
            answer = Q(value),
            style = S.Pi,
            hint = piHint,
            wrong = wrong.map { Q(it) },
            pair = "Zylinder: " + (if (withDiameter) "d = ${2 * r} cm" else "r = $r cm") + ", h = $h cm",
            solution = "r = $r cm; V = π · r² · h = π · ${r}² · $h = ${value}π cm³",
            explanation = "Beim Zylinder ist die Grundfläche ein Kreis: V = π · r² · h. Der Radius ist der halbe Durchmesser, und nur er wird quadriert.",
        )
    }

    private val areaUnits = listOf("mm²", "cm²", "dm²", "m²")
    private val volumeUnits = listOf("cm³", "dm³", "m³")

    /** A value of a conversion: whole numbers from a thousand on get the thin space. */
    private fun valueText(q: Q): String {
        val whole = q.long
        if (whole != null && whole >= 1000) return T.grouped(whole)
        return num(q)
    }

    /** "3 dm² = ? cm²": each step is 100 for areas and 1000 for volumes. */
    private fun units(level: Int, gen: Gen): P? = gen.attempt { unitsAttempt(level, gen) }

    private fun unitsAttempt(level: Int, gen: Gen): P? {
        val isArea = level == 1 || gen.chance(40)
        val list = if (isArea) areaUnits else volumeUnits
        val step = if (isArea) 100 else 1000
        val wrongStep = if (isArea) 10 else 100
        val from = gen.int(0..(list.size - 1))
        val delta = if (level == 1) gen.pick(listOf(-1, 1)) else if (level == 2) gen.pick(listOf(-1, 1, -2, 2)) else gen.pick(listOf(-2, 2, -1, 1))
        val to = from + delta
        if (to !in 0..(list.size - 1)) return null
        // Liters are dm³ and millilitres are cm³.
        var fromName = list[from]
        var toName = list[to]
        if (!isArea) {
            if (from == 1 && gen.chance(50)) fromName = "l"
            if (to == 1 && gen.chance(50)) toName = "l"
            if (from == 0 && gen.chance(30)) fromName = "ml"
            if (to == 0 && gen.chance(30)) toName = "ml"
        }
        val steps = Math.abs(delta)
        val factor = ipow(step, steps)
        val wrongFactor = ipow(wrongStep, steps)
        val bigToSmall = delta < 0
        // Answers stay below 1000: a big unit into a small one only with small values.
        val bigValues: List<Q> = listOf(Q(2), Q(3), Q(4), Q(5), Q(6), Q(7), Q(8), Q(9), Q(1, 5), Q(1, 4), Q(2, 5), Q(1, 2), Q(3, 5), Q(3, 4), Q(4, 5), Q(1, 20), Q(1, 50), Q(3, 100), Q(2, 25))
        val smallValues: List<Q> = listOf(2, 3, 5, 6, 8, 10, 20, 25, 40, 50, 60, 75, 80, 120, 150, 200, 250, 400, 500, 600, 750, 800, 1500, 2500, 3000, 4500, 5000, 7500).map { Q(it) }
        val candidates = (if (bigToSmall) bigValues else smallValues).filter { value ->
            val result = if (bigToSmall) value * factor else value / factor
            result.ok && result.double < 1000 && result.double >= 0.01 && (if (bigToSmall) result.isWhole else listOf(result).decimals(3).size == 1)
        }
        if (candidates.isEmpty()) return null
        val value = gen.pick(candidates)
        val answer = if (bigToSmall) value * factor else value / factor
        // Counting with the length factor, off by a power of ten, the wrong way round.
        val withWrongFactor = if (bigToSmall) value * wrongFactor else value / wrongFactor
        val wrong = listOf(withWrongFactor, answer * 10, answer / 10, if (bigToSmall) value / factor else value * factor).decimals(3).positives
        return P.number(
            prompt = "Wandle um:\n${valueText(value)} $fromName = ? $toName",
            answer = answer,
            hint = "Gib die Zahl an.",
            wrong = wrong,
            pair = "${valueText(value)} $fromName in $toName",
            solution = "Jede Stufe ist der Faktor ${T.grouped(step)}: $steps ${if (steps == 1) "Stufe" else "Stufen"}, ${valueText(value)} ${if (bigToSmall) "·" else ":"} ${T.grouped(factor)} = ${valueText(answer)} $toName",
            explanation = if (isArea) "Bei Flächen ist jede Stufe der Faktor 100 (1 m² = 100 dm²). Zur kleineren Einheit malnehmen, zur größeren teilen."
            else "Bei Volumen ist jede Stufe der Faktor 1000 (1 dm³ = 1000 cm³), und 1 l ist 1 dm³. Zur kleineren Einheit malnehmen, zur größeren teilen.",
        )
    }

    private fun ipow(base: Int, exponent: Int): Int {
        var result = 1
        repeat(maxOf(0, exponent)) { result *= base }
        return result
    }

    /** "Wie viele Liter passen in das Aquarium?" cm³ to liters, and the water level the other way. */
    private fun volumeWord(level: Int, gen: Gen): P? = gen.attempt { volumeWordAttempt(level, gen) }

    private fun volumeWordAttempt(level: Int, gen: Gen): P? {
        if (level == 3 && gen.chance(50)) {
            // The water level: liters to cm³, divided by the base area.
            val length = gen.pick(listOf(40, 50, 60, 80))
            val width = gen.pick(listOf(20, 25, 30, 40, 50))
            val height = gen.int(5..40)
            val liters = length * width * height
            if (liters % 1000 != 0) return null
            val l = liters / 1000
            if (l < 2 || l > 99) return null
            // The liters taken for cm³, not converted: the height too small by a thousandth; or times 10.
            val wrong = listOf(Q(l, length * width), Q(l * 10, length * width), Q(l * 1000, length), Q(height * 10), Q(height, 10)).decimals(2).positives
            return P.number(
                prompt = "In ein Becken ($length cm lang, $width cm breit) werden $l l Wasser gefüllt.\nWie hoch steht das Wasser?",
                answer = Q(height),
                style = S.Unit("cm"),
                hint = valueHint,
                wrong = wrong,
                solution = "$l l = ${T.grouped(l * 1000)} cm³; Grundfläche ${length * width} cm²; ${T.grouped(l * 1000)} : ${length * width} = $height cm",
                explanation = "Rechne die Liter in cm³ um (1 l = 1000 cm³). Das Volumen geteilt durch die Grundfläche ist die Höhe.",
            )
        }
        val inDm = level == 1
        val a = if (inDm) gen.int(2..9) else gen.pick(listOf(20, 30, 40, 50, 60, 80, 100))
        val b = if (inDm) gen.int(2..8) else gen.pick(listOf(20, 25, 30, 40, 50))
        val c = if (inDm) gen.int(2..6) else gen.pick(listOf(20, 25, 30, 40, 50, 60))
        val volume = a * b * c
        val liters = Q(volume, if (inDm) 1 else 1000)
        if (!liters.ok || listOf(liters).decimals(1).size != 1 || !(liters.double >= 2) || !(liters.double < 1000) || a == b) return null
        val unit = if (inDm) "dm" else "cm"
        val thing = gen.pick(listOf("Ein Aquarium", "Ein Wassertank", "Eine Kiste"))
        // Not converted, converted by 100 or 10 000, the edges added.
        val wrong = if (inDm) listOf(Q(a + b + c), Q(2 * (a * b + a * c + b * c)), liters * 10, liters / 10, Q(volume * 1000))
        else listOf(Q(volume), liters / 10, liters * 10, Q(volume, 100), Q(a + b + c))
        return P.number(
            prompt = "$thing ist $a $unit lang, $b $unit breit und $c $unit hoch.\nWie viele Liter passen hinein?",
            answer = liters,
            style = S.Unit("l"),
            hint = valueHint,
            wrong = wrong.decimals(2).positives,
            solution = if (inDm) "V = $a · $b · $c = $volume dm³ = $volume l"
            else "V = $a · $b · $c = ${T.grouped(volume)} cm³; ${T.grouped(volume)} : 1000 = ${num(liters)} l",
            explanation = if (inDm) "1 dm³ ist 1 Liter. Das Volumen in dm³ ist also gleich der Anzahl der Liter."
            else "Zuerst das Volumen in cm³ berechnen. Dann gilt 1000 cm³ = 1 l, du teilst also durch 1000.",
        )
    }

    // Lesson 3

    /** Angles in triangles and quadrilaterals, adjacent angles, and the isosceles triangle. */
    private fun angles(level: Int, gen: Gen): P? = gen.attempt { anglesAttempt(level, gen) }

    private fun anglesAttempt(level: Int, gen: Gen): P? {
        val kind = if (level == 1) gen.int(0..1) else if (level == 2) gen.int(1..3) else gen.int(2..4)
        when (kind) {
            0 -> {
                // Triangle: 180° minus the two known angles.
                val a = gen.int(20..80)
                val b = gen.int(20..80)
                val c = 180 - a - b
                if (c < 15) return null
                return degrees(
                    "In einem Dreieck sind α = $a° und β = $b°.\nWie groß ist γ?", c,
                    wrong = listOf(180 - a, 180 - b, a + b, 360 - a - b),
                    front = "Dreieck: α = $a°, β = $b°",
                    working = "γ = 180° ${T.minus} $a° ${T.minus} $b° = $c°",
                    why = "Die Winkelsumme im Dreieck ist 180°. Ziehe die beiden bekannten Winkel davon ab.",
                )
            }
            1 -> {
                // Adjacent angles add up to 180°.
                val a = gen.int(25..155)
                if (a == 90) return null
                return degrees(
                    "Zwei Winkel liegen nebeneinander auf einer Geraden. Einer ist $a° groß.\nWie groß ist der andere?", 180 - a,
                    wrong = listOf(90 - a, 360 - a, a, 180 + a).filter { it > 0 },
                    front = "Nebenwinkel von $a°",
                    working = "180° ${T.minus} $a° = ${180 - a}°",
                    why = "Nebenwinkel ergeben zusammen 180°, weil sie auf einer Geraden liegen.",
                )
            }
            2 -> {
                // Quadrilateral: 360° minus the three known angles.
                val a = gen.int(60..120)
                val b = gen.int(60..120)
                val c = gen.int(60..120)
                val d = 360 - a - b - c
                if (d < 30 || d > 150) return null
                return degrees(
                    "In einem Viereck sind drei Winkel $a°, $b° und $c° groß.\nWie groß ist der vierte Winkel?", d,
                    wrong = listOf(360 - a - b, 360 - a - c, a + b + c - 180, 360 - b - c).filter { it > 0 },
                    front = "Viereck: $a°, $b°, $c°",
                    working = "δ = 360° ${T.minus} $a° ${T.minus} $b° ${T.minus} $c° = $d°",
                    why = "Die Winkelsumme im Viereck ist 360°. Ziehe die drei bekannten Winkel davon ab.",
                )
            }
            3 -> {
                // Isosceles triangle: apex or base angle.
                if (gen.chance(50)) {
                    val base = gen.int(30..80)
                    val apex = 180 - 2 * base
                    if (apex < 20 || base == 60) return null
                    return degrees(
                        "Ein gleichschenkliges Dreieck hat $base° an der Basis.\nWie groß ist der Winkel an der Spitze?", apex,
                        wrong = listOf(180 - base, base * 2, 90 - base, base).filter { it > 0 },
                        front = "Basiswinkel $base°, Spitze?",
                        working = "180° ${T.minus} 2 · $base° = $apex°",
                        why = "Im gleichschenkligen Dreieck sind die beiden Basiswinkel gleich groß. Von 180° gehen beide ab.",
                    )
                }
                val apex = gen.pick(listOf(20, 30, 40, 50, 80, 100, 110, 120, 140))
                val base = (180 - apex) / 2
                return degrees(
                    "Ein gleichschenkliges Dreieck hat $apex° an der Spitze.\nWie groß ist ein Basiswinkel?", base,
                    wrong = listOf(180 - apex, apex / 2, 90 - apex, (360 - apex) / 2).filter { it > 0 },
                    front = "Spitze $apex°, Basiswinkel?",
                    working = "(180° ${T.minus} $apex°) : 2 = $base°",
                    why = "Die beiden Basiswinkel sind gleich groß. Ziehe den Winkel an der Spitze von 180° ab und teile durch 2.",
                )
            }
            else -> {
                // A triangle with an angle given as a multiple of another.
                val a = gen.int(15..40)
                val times = gen.int(2..3)
                val b = a * times
                val c = 180 - a - b
                if (c < 20) return null
                return degrees(
                    "In einem Dreieck ist α = $a° und β ist ${if (times == 2) "doppelt" else "dreimal"} so groß wie α.\nWie groß ist γ?", c,
                    wrong = listOf(180 - a - a, 180 - b, b - a, a + b).filter { it > 0 },
                    front = "α = $a°, β = ${times}α",
                    working = "β = $times · $a° = $b°; γ = 180° ${T.minus} $a° ${T.minus} $b° = $c°",
                    why = "Berechne zuerst den zweiten Winkel, dann ziehst du beide von 180° ab.",
                )
            }
        }
    }

    private fun degrees(prompt: String, answer: Int, wrong: List<Int>, front: String, working: String, why: String): P? {
        val problem = P.number(
            prompt = prompt,
            answer = Q(answer),
            style = S.Degrees,
            hint = "Gib die Gradzahl ohne ° an.",
            wrong = wrong.map { Q(it) },
            pair = front,
            solution = working,
            explanation = why,
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den gesuchten Winkel zu."
        return problem
    }

    private val triples: List<Triple<Int, Int, Int>> = listOf(
        Triple(3, 4, 5), Triple(6, 8, 10), Triple(5, 12, 13), Triple(9, 12, 15), Triple(8, 15, 17),
        Triple(12, 16, 20), Triple(7, 24, 25), Triple(15, 20, 25), Triple(20, 21, 29),
    )

    /** A triple at the level; level 3 scales a small one by 0,5, 1,5 or 2,5. */
    private fun pickTriple(level: Int, gen: Gen): Triple<Q, Q, Q> {
        when (level) {
            1 -> {
                val t = gen.pick(triples.take(3))
                return Triple(Q(t.first), Q(t.second), Q(t.third))
            }
            2 -> {
                val t = gen.pick(triples.take(6))
                return Triple(Q(t.first), Q(t.second), Q(t.third))
            }
            else -> {
                if (gen.chance(50)) {
                    val t = gen.pick(triples.take(2) + listOf(Triple(5, 12, 13)))
                    val k = Q(gen.pick(listOf(1, 3, 5)), 2)
                    return Triple(k * t.first, k * t.second, k * t.third)
                }
                val t = gen.pick(triples)
                return Triple(Q(t.first), Q(t.second), Q(t.third))
            }
        }
    }

    /** Hypotenuse or leg of a right triangle. */
    private fun pythagoras(level: Int, gen: Gen): P? {
        val triple = pickTriple(level, gen)
        val swap = gen.chance(50)
        val a = if (swap) triple.second else triple.first
        val b = if (swap) triple.first else triple.second
        val c = triple.third
        val findsHypotenuse = level == 1 || gen.chance(50)
        fun sq(q: Q): Q = q * q
        if (findsHypotenuse) {
            // The legs added, the squares added without a root, the difference of the legs.
            val wrong = listOf(a + b, sq(a) + sq(b), (b - a).magnitude, c + 1).decimals(2).positives
            return P.number(
                prompt = "In einem rechtwinkligen Dreieck sind die Katheten ${num(a)} cm und ${num(b)} cm lang.\nWie lang ist die Hypotenuse?",
                answer = c,
                style = S.Unit("cm"),
                hint = valueHint,
                wrong = wrong,
                pair = "Katheten ${num(a)} cm, ${num(b)} cm",
                solution = "c² = ${num(a)}² + ${num(b)}² = ${num(sq(a))} + ${num(sq(b))} = ${num(sq(c))}; c = ${num(c)} cm",
                explanation = "Im rechtwinkligen Dreieck gilt a² + b² = c². Die Hypotenuse c liegt gegenüber dem rechten Winkel.",
            )
        }
        // The other leg: the hypotenuse squared minus the known leg squared.
        val wrong = listOf(c - a, c + a, sq(c) + sq(a), sq(c) - sq(a)).decimals(2).positives
        return P.number(
            prompt = "In einem rechtwinkligen Dreieck ist die Hypotenuse ${num(c)} cm und eine Kathete ${num(a)} cm lang.\nWie lang ist die andere Kathete?",
            answer = b,
            style = S.Unit("cm"),
            hint = valueHint,
            wrong = wrong,
            pair = "c = ${num(c)} cm, a = ${num(a)} cm",
            solution = "b² = c² ${T.minus} a² = ${num(sq(c))} ${T.minus} ${num(sq(a))} = ${num(sq(b))}; b = ${num(b)} cm",
            explanation = "Stelle a² + b² = c² um: b² = c² − a². Die Hypotenuse ist die längste Seite und wird nicht abgezogen, sondern steht allein.",
        )
    }

    /** Ladder, diagonal and shortcut: Pythagoras in a story. */
    private fun pythagorasWord(level: Int, gen: Gen): P? {
        val triple = pickTriple(if (level == 1) 2 else level, gen)
        val swap = gen.chance(50)
        val a = if (swap) triple.second else triple.first
        val b = if (swap) triple.first else triple.second
        val c = triple.third
        val story = gen.int(0..2)
        val unit = if (story == 1) "cm" else "m"
        val prompt: String
        val answer: Q
        val working: String
        val wrong: List<Q>
        when (story) {
            0 -> {
                // Ladder: the length is the hypotenuse, the foot distance a leg: the height is the other leg.
                prompt = "Eine ${num(c)} m lange Leiter lehnt an einer Wand. Ihr Fuß steht ${num(a)} m von der Wand entfernt.\nWie hoch reicht die Leiter?"
                answer = b
                wrong = listOf(c - a, c + a, c * c - a * a, a + b)
                working = "h² = ${num(c)}² ${T.minus} ${num(a)}² = ${num(c * c - a * a)}; h = ${num(b)} m"
            }
            1 -> {
                prompt = "Ein Rechteck ist ${num(a)} cm lang und ${num(b)} cm breit.\nWie lang ist die Diagonale?"
                answer = c
                wrong = listOf(a + b, a * a + b * b, (b - a).magnitude, a * b)
                working = "d² = ${num(a)}² + ${num(b)}² = ${num(a * a + b * b)}; d = ${num(c)} cm"
            }
            else -> {
                prompt = "Ein Sportplatz ist ${num(a)} m lang und ${num(b)} m breit. Anna läuft quer über die Diagonale.\nWie lang ist ihr Weg?"
                answer = c
                wrong = listOf(a + b, a * a + b * b, (b - a).magnitude, a * b)
                working = "d² = ${num(a)}² + ${num(b)}² = ${num(a * a + b * b)}; d = ${num(c)} m"
            }
        }
        return P.number(
            prompt = prompt,
            answer = answer,
            style = S.Unit(unit),
            hint = valueHint,
            wrong = wrong.decimals(2).positives,
            solution = working,
            explanation = "Suche das rechtwinklige Dreieck in der Geschichte und die Hypotenuse (die Seite gegenüber dem rechten Winkel). Dann gilt a² + b² = c².",
        )
    }

    /** Which set of sides makes a right triangle? The converse of the theorem. */
    private fun rightAngleTest(level: Int, gen: Gen): P? = gen.attempt { rightAngleTestAttempt(level, gen) }

    private fun rightAngleTestAttempt(level: Int, gen: Gen): P? {
        val pool = if (level == 1) triples.take(5) else if (level == 2) triples.take(6) else triples
        val (a, b, c) = gen.pick(pool)
        fun isRight(x: Int, y: Int, z: Int): Boolean {
            val sides = listOf(x, y, z).sorted()
            return sides[0] * sides[0] + sides[1] * sides[1] == sides[2] * sides[2]
        }
        fun text(x: Int, y: Int, z: Int): String = "$x cm, $y cm, $z cm"
        // One side too long or too short by 1 or 2, two sides swapped for a shorter one.
        val candidates = listOf(Triple(a, b, c + 1), Triple(a, b, c - 1), Triple(a + 1, b, c), Triple(a, b + 1, c), Triple(a, b, c + 2), Triple(a - 1, b, c), Triple(a, b - 1, c))
            .filter { it.first > 0 && it.second > 0 && it.third > 0 && !isRight(it.first, it.second, it.third) && it.first + it.second > it.third }
        val wrong = gen.shuffled(candidates).take(3).map { text(it.first, it.second, it.third) }
        if (wrong.size != 3) return null
        val small1 = if (a < b) a else b
        val small2 = if (a < b) b else a
        return P.text(
            prompt = "Welche Seitenlängen gehören zu einem rechtwinkligen Dreieck?",
            correct = text(a, b, c),
            wrong = wrong,
            typed = Ty(
                "Ein Dreieck hat die Seiten ${text(a, b, c)}.\nBerechne a² + b² mit den beiden kürzeren Seiten.",
                rat(small1 * small1 + small2 * small2),
            ),
            solution = "$a² + $b² = ${a * a + b * b} und ${c}² = ${c * c}: Die Summe der Quadrate der kurzen Seiten gleicht dem Quadrat der längsten, also ist es rechtwinklig.",
            explanation = "Gilt a² + b² = c² für die drei Seiten (c ist die längste), ist das Dreieck rechtwinklig. Bei den anderen Dreiecken stimmt die Gleichung nicht.",
        )
    }
}
