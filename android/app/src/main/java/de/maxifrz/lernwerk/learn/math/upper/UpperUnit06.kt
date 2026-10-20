package de.maxifrz.lernwerk.learn.math.upper

/** Unit 6: vectors (length, dot product, orthogonality, lines, point test, distance between two points). */
object MathUpperUnit06 {
    val templates: List<UTemplate> by lazy {
        listOf(norm, connecting, distance, midpoint, dot, orthogonalChoice, orthogonalParameter, angle, linePoint, lineParameter, pointOnLine, direction)
    }

    class Quad(val a: Int, val b: Int, val c: Int, val length: Int)

    /** Whole-number vectors with a whole-number length: (a, b, c, length). */
    val triples: List<Quad> = listOf(
        Quad(3, 4, 0, 5), Quad(5, 12, 0, 13), Quad(6, 8, 0, 10), Quad(1, 2, 2, 3), Quad(2, 3, 6, 7), Quad(2, 6, 9, 11), Quad(4, 4, 7, 9), Quad(1, 4, 8, 9),
        Quad(2, 10, 11, 15), Quad(6, 6, 7, 11), Quad(3, 4, 12, 13), Quad(4, 8, 8, 12), Quad(8, 9, 12, 17), Quad(2, 2, 1, 3),
    )

    fun vector(g: UGen, level: Int): Pair<List<Int>, Int> {
        val pool = if (level == 1) triples.subList(0, 3) else (if (level == 2) triples.subList(3, 10) else triples.subList(3, triples.size))
        val t = g.pick(pool)
        val parts = g.shuffled(listOf(t.a, t.b, t.c)).map { it * g.sign() }
        return parts to t.length
    }

    fun dotOf(a: List<Int>, b: List<Int>): Int = a.indices.fold(0) { s, i -> s + a[i] * b[i] }
    fun random(g: UGen, range: IntRange): List<Int> = (0 until 3).map { g.int(range) }
    val axes = listOf("x", "y", "z")

    val norm: UTemplate by lazy {
        UTemplate("v.norm", pairs = { _, g ->
            val items = mutableListOf<UPairItem>()
            val used = hashSetOf<Int>()
            var i = 0
            while (i < 60 && items.size < 4) {
                i += 1
                val (v, length) = vector(g, 2)
                if (used.add(length)) items.add(UPairItem("|a| mit a = " + UText.vector(v), "$length"))
            }
            if (items.size == 4) items else null
        }) { lv, g ->
            val (v, length) = vector(g, lv)
            val squares = v.map { it * it }.fold(0) { s, x -> s + x }
            val wrongs = UCalc.differing(
                listOf(UQ(squares), UQ(v.map { Math.abs(it) }.fold(0) { s, x -> s + x }), UQ(v.map { Math.abs(it) }.maxOrNull() ?: 0), UQ(squares, 2), UQ(length + 1)),
                UQ(length),
            )
            UProblem.numeric(
                key = "v.norm|$v", prompt = "Berechne den Betrag des Vektors a = ${UText.vector(v)}.", answer = UQ(length), wrongs = wrongs,
                solution = "|a| = √(${v.joinToString(" + ") { "${UText.signed(it)}²" }}) = √$squares = $length.",
                explanation = "Der Betrag ist die Wurzel aus der Summe der Koordinatenquadrate; ohne die Wurzel hättest du den quadrierten Betrag.",
                fact = UFact.VecNorm(v),
            )
        }
    }

    class Points(val a: List<Int>, val b: List<Int>, val length: Int)

    fun points(g: UGen, level: Int): Points {
        val (v, length) = vector(g, level)
        val a = random(g, -3..3)
        return Points(a, a.indices.map { a[it] + v[it] }, length)
    }

    val connecting: UTemplate by lazy {
        UTemplate("v.vecAB") { _, g ->
            val a = random(g, -4..4)
            val b = random(g, -4..4)
            val i = g.int(0..2)
            val answer = b[i] - a[i]
            val wrongs = UCalc.differing(listOf(UQ(a[i] - b[i]), UQ(a[i] + b[i]), UQ(b[i]), UQ(a[i])), UQ(answer))
            UProblem.numeric(
                key = "v.vecAB|$a|$b|$i", prompt = "Gegeben sind ${UText.point("A", a)} und ${UText.point("B", b)}. Welche ${axes[i]}-Komponente hat der Vektor AB?",
                answer = UQ(answer), wrongs = wrongs, solution = "AB = B − A; ${axes[i]}-Komponente: ${UText.signed(b[i])} − ${UCalc3.bracket(a[i])} = $answer.",
                explanation = "Verbindungsvektor: Spitze minus Fuß, also B − A, nicht A − B.", fact = UFact.VectorComponent(a, b, i),
            )
        }
    }

    val distance: UTemplate by lazy {
        UTemplate("v.dist") { lv, g ->
            val p = points(g, lv)
            val diff = p.a.indices.map { p.b[it] - p.a[it] }
            val squares = diff.map { it * it }.fold(0) { s, x -> s + x }
            val wrongs = UCalc.differing(
                listOf(UQ(squares), UQ(diff.map { Math.abs(it) }.fold(0) { s, x -> s + x }), UQ(p.length + 1), UQ(p.length - 1)), UQ(p.length),
            )
            UProblem.numeric(
                key = "v.dist|${p.a}|${p.b}", prompt = "Welchen Abstand haben ${UText.point("A", p.a)} und ${UText.point("B", p.b)}?", answer = UQ(p.length), wrongs = wrongs,
                solution = "AB = ${UText.vector(diff)}; |AB| = √$squares = ${p.length}.",
                explanation = "Der Abstand zweier Punkte ist der Betrag ihres Verbindungsvektors.", fact = UFact.Distance(p.a, p.b),
            )
        }
    }

    val midpoint: UTemplate by lazy {
        UTemplate("v.mid") { _, g ->
            val a = random(g, -4..4)
            val b = a.map { it + 2 * g.int(-3..3) }
            val i = g.int(0..2)
            val answer = (a[i] + b[i]) / 2
            val wrongs = UCalc.differing(listOf(UQ(a[i] + b[i]), UQ(b[i] - a[i]), UQ(b[i] - a[i], 2), UQ(b[i])), UQ(answer))
            UProblem.numeric(
                key = "v.mid|$a|$b|$i", prompt = "Welche ${axes[i]}-Koordinate hat der Mittelpunkt M der Strecke zwischen ${UText.point("A", a)} und ${UText.point("B", b)}?",
                answer = UQ(answer), wrongs = wrongs,
                solution = "M = (A + B)/2; ${axes[i]}-Koordinate: (${UText.signed(a[i])} + ${if (b[i] < 0) "(${b[i]})" else "${b[i]}"})/2 = $answer.",
                explanation = "Den Mittelpunkt erhältst du, indem du die Koordinaten von A und B addierst und halbierst.", fact = UFact.Midpoint(a, b, i),
            )
        }
    }

    val dot: UTemplate by lazy {
        UTemplate("v.dot") { lv, g ->
            val range = if (lv == 1) 1..4 else -4..4
            val a = random(g, range)
            val b = random(g, range)
            val value = dotOf(a, b)
            val wrongs = UCalc.differing(
                listOf(
                    UQ(a[0] * b[0] + a[1] * b[1]), UQ(a.indices.fold(0) { s, i -> s + (a[i] + b[i]) }), UQ(a.fold(0) { s, x -> s + x } * b.fold(0) { s, x -> s + x }),
                    UQ(value - 2 * a[2] * b[2]), UQ(a[0] * b[1] + a[1] * b[2] + a[2] * b[0]),
                ),
                UQ(value),
            )
            UProblem.numeric(
                key = "v.dot|$a|$b", prompt = "Berechne das Skalarprodukt von a = ${UText.vector(a)} und b = ${UText.vector(b)}.", answer = UQ(value), wrongs = wrongs,
                solution = "a·b = ${a.indices.joinToString(" + ") { "${UText.signed(a[it])}·${UCalc3.bracket(b[it])}" }} = $value.",
                explanation = "Das Skalarprodukt multipliziert gleiche Komponenten und addiert; das Ergebnis ist eine Zahl, kein Vektor.", fact = UFact.Dot(a, b),
            )
        }
    }

    /** A vector orthogonal to a: (a2, -a1, 0) in some arrangement. */
    fun orthogonalPartner(a: List<Int>, g: UGen): List<Int> {
        val order = g.pick(listOf(listOf(0, 1, 2), listOf(1, 2, 0), listOf(2, 0, 1)))
        val i = order[0]
        val j = order[1]
        val k = order[2]
        val b = mutableListOf(0, 0, 0)
        b[i] = a[j]
        b[j] = -a[i]
        b[k] = 0
        return b
    }

    val orthogonalChoice: UTemplate by lazy {
        UTemplate("v.orthoChoice") { _, g ->
            for (attempt in 0 until 100) {
                val a = random(g, -3..3)
                val b = orthogonalPartner(a, g)
                if (b == listOf(0, 0, 0) || a == listOf(0, 0, 0)) continue
                var wrongPairs = mutableListOf<Pair<List<Int>, List<Int>>>()
                for (j in 0 until 3) {
                    for (delta in listOf(1, -1, 2)) {
                        val c = b.toMutableList()
                        c[j] += delta
                        if (dotOf(a, c) != 0 && c != listOf(0, 0, 0) && Math.abs(c[j]) != Math.abs(b[j])) wrongPairs.add(a to c.toList())
                    }
                }
                wrongPairs = g.shuffled(wrongPairs).take(3).toMutableList()
                if (wrongPairs.size != 3) continue
                fun text(pair: Pair<List<Int>, List<Int>>): String = "a = ${UText.vector(pair.first)}, b = ${UText.vector(pair.second)}"
                return@UTemplate UProblem.choice(
                    key = "v.orthoChoice|$a|$b", prompt = "Bei welchem Paar stehen die Vektoren senkrecht aufeinander?", correct = text(a to b), wrong = wrongPairs.map { text(it) },
                    solution = "Senkrecht heißt a·b = 0. Hier: ${a.indices.joinToString(" + ") { "${UText.signed(a[it])}·${UCalc3.bracket(b[it])}" }} = 0. Bei den anderen Paaren ist das Skalarprodukt nicht 0.",
                    explanation = "Zwei Vektoren (ungleich dem Nullvektor) sind genau dann orthogonal, wenn ihr Skalarprodukt 0 ist.",
                    fact = UFact.OrthogonalPair(a to b, wrongPairs.toList()),
                )
            }
            null
        }
    }

    val orthogonalParameter: UTemplate by lazy {
        UTemplate("v.orthoT") { _, g ->
            for (attempt in 0 until 300) {
                val b = random(g, -4..4)
                val a = random(g, -4..4)
                val i = g.int(0..2)
                if (b[i] == 0) continue
                val others = (0 until 3).filter { it != i }.map { a[it] * b[it] }.fold(0) { s, x -> s + x }
                if (others % b[i] != 0) continue
                val t = -others / b[i]
                val shown = a.toMutableList()
                shown[i] = t
                val text = (0 until 3).joinToString(" | ") { if (it == i) "t" else UText.signed(a[it]) }
                val wrongs = UCalc.differing(
                    listOf(UQ(others, b[i]), UQ(-others + b[i], b[i]), UQ(-a[(i + 1) % 3] * b[(i + 1) % 3], b[i]), UQ(t + 1)), UQ(t),
                )
                return@UTemplate UProblem.numeric(
                    key = "v.orthoT|$a|$b|$i", prompt = "Für welches t sind a = ($text) und b = ${UText.vector(b)} orthogonal?", answer = UQ(t), wrongs = wrongs,
                    solution = "a·b = 0: $others + ${UCalc3.bracket(b[i])}·t = 0, also t = $t.",
                    explanation = "Orthogonal bedeutet Skalarprodukt 0; die entstehende Gleichung löst du nach t.", fact = UFact.OrthoParam(shown.toList(), b, i),
                )
            }
            null
        }
    }

    private class AngleBase(val a: List<Int>, val b: List<Int>, val degrees: Int)

    val angle: UTemplate by lazy {
        UTemplate("v.angle") { lv, g ->
            val bases = listOf(
                AngleBase(listOf(1, 0, 0), listOf(0, 1, 0), 90), AngleBase(listOf(1, 0, 0), listOf(1, 0, 0), 0),
                AngleBase(listOf(1, 1, 0), listOf(0, 1, 0), 45), AngleBase(listOf(1, 1, 0), listOf(1, 0, 1), 60),
                AngleBase(listOf(1, 1, 0), listOf(-1, 1, 0), 90), AngleBase(listOf(1, 0, 0), listOf(-1, 0, 0), 180),
                AngleBase(listOf(1, 1, 0), listOf(-1, 0, 1), 120),
            )
            val pool = if (lv == 1) bases.subList(0, 3) else bases
            val base = g.pick(pool)
            val a0 = base.a
            val b0 = base.b
            val degrees = base.degrees
            val order = g.shuffled(listOf(0, 1, 2))
            val signs = listOf(g.sign(), g.sign(), g.sign())
            val ka = g.int(1..3)
            val kb = g.int(1..3)
            val a = (0 until 3).map { a0[order[it]] * signs[it] * ka }
            val b = (0 until 3).map { b0[order[it]] * signs[it] * kb }
            val wrongs = UCalc.differing(listOf(UQ(180 - degrees), UQ(90 - degrees), UQ(2 * degrees), UQ(degrees / 2), UQ(90), UQ(45)), UQ(degrees))
            val n = dotOf(a, b)
            UProblem.numeric(
                key = "v.angle|$a|$b", prompt = "Wie groß ist der Winkel zwischen a = ${UText.vector(a)} und b = ${UText.vector(b)} in Grad?", answer = UQ(degrees), wrongs = wrongs,
                solution = "cos φ = a·b / (|a|·|b|) mit a·b = $n. Das ergibt $degrees°.",
                explanation = "Der Winkel folgt aus cos φ = a·b / (|a|·|b|); ein Skalarprodukt von 0 bedeutet 90°.", fact = UFact.Angle(a, b),
            )
        }
    }

    fun lineText(a: List<Int>, u: List<Int>): String = "g: x = ${UText.vector(a)} + t·${UText.vector(u)}"

    val linePoint: UTemplate by lazy {
        UTemplate("v.linePoint") { lv, g ->
            val a = random(g, -4..4)
            var u = random(g, -3..3)
            if (u == listOf(0, 0, 0)) u = listOf(1, 2, -1)
            val t = if (lv == 1) g.int(1..3) else g.nonzero(-3..3)
            val i = g.int(0..2)
            val answer = a[i] + t * u[i]
            val wrongs = UCalc.differing(listOf(UQ(t * u[i]), UQ(a[i] + u[i]), UQ(a[i] - t * u[i]), UQ((a[i] + t) * u[i]), UQ(a[i] * u[i])), UQ(answer))
            UProblem.numeric(
                key = "v.linePoint|$a|$u|$t|$i", prompt = "${lineText(a, u)}. Welche ${axes[i]}-Koordinate hat der Punkt für t = ${UText.signed(t)}?", answer = UQ(answer), wrongs = wrongs,
                solution = "Setze t ein: ${axes[i]} = ${UText.signed(a[i])} + ${UCalc3.bracket(t)}·${UCalc3.bracket(u[i])} = $answer.",
                explanation = "Der Ortsvektor des Aufpunkts bleibt, dazu kommt t mal der Richtungsvektor.", fact = UFact.LinePoint(a, u, t, i),
            )
        }
    }

    val lineParameter: UTemplate by lazy {
        UTemplate("v.lineT") { _, g ->
            val a = random(g, -4..4)
            val u = random(g, -3..3).toMutableList()
            if (u[0] == 0) u[0] = g.nonzero(-3..3)
            val t = g.nonzero(-3..3)
            val p = (0 until 3).map { a[it] + t * u[it] }
            val wrongs = UCalc.differing(listOf(UQ(-t), UQ(p[0] - a[0]), UQ(p[0], u[0]), UQ(t + 1), UQ(p[0] + a[0], u[0])), UQ(t))
            UProblem.numeric(
                key = "v.lineT|$a|$u|$t", prompt = "${lineText(a, u)}. Der Punkt ${UText.point("P", p)} liegt auf g. Für welches t?", answer = UQ(t), wrongs = wrongs,
                solution = "x-Koordinate: ${p[0]} = ${a[0]} + t·${UCalc3.bracket(u[0])}, also t = $t. Die anderen Koordinaten passen mit demselben t.",
                explanation = "Ein Punkt liegt auf der Geraden, wenn alle Koordinatengleichungen dasselbe t liefern.", fact = UFact.LineParam(a, u.toList(), p),
            )
        }
    }

    val pointOnLine: UTemplate by lazy {
        UTemplate("v.onLine") { _, g ->
            for (attempt in 0 until 100) {
                val a = random(g, -3..3)
                var u = random(g, -3..3)
                if (u.count { it != 0 } < 2) u = listOf(1, -2, 2)
                val t = g.nonzero(-3..3)
                val p = (0 until 3).map { a[it] + t * u[it] }
                var wrongs = mutableListOf<List<Int>>()
                for (j in 0 until 3) {
                    for (delta in listOf(1, -1, 2)) {
                        val c = p.toMutableList()
                        c[j] += delta
                        if (Math.abs(c[j]) != Math.abs(p[j])) wrongs.add(c.toList())
                    }
                }
                wrongs = wrongs.filter { !isOnLine(a, u, it) }.toMutableList()
                val chosen = g.shuffled(wrongs).take(3)
                if (chosen.size != 3) continue
                fun text(q: List<Int>): String = UText.point("P", q)
                return@UTemplate UProblem.choice(
                    key = "v.onLine|$a|$u|$t", prompt = "${lineText(a, u)}. Welcher Punkt liegt auf g?", correct = text(p), wrong = chosen.map { text(it) },
                    solution = "Für t = $t ergibt sich ${text(p)}. Bei den anderen Punkten liefern die Koordinaten verschiedene t-Werte.",
                    explanation = "Punktprobe: Setze den Punkt gleich a + t·u; er liegt nur dann auf der Geraden, wenn für jede Koordinate dasselbe t herauskommt.",
                    fact = UFact.OnLine(a, u, p, chosen),
                )
            }
            null
        }
    }

    fun isOnLine(a: List<Int>, u: List<Int>, p: List<Int>): Boolean {
        var t: UQ? = null
        for (i in 0 until 3) {
            if (u[i] == 0) {
                if (p[i] != a[i]) return false
                continue
            }
            val value = UQ(p[i] - a[i], u[i])
            val known = t
            if (known != null) {
                if (known != value) return false
            } else {
                t = value
            }
        }
        return true
    }

    val direction: UTemplate by lazy {
        UTemplate("v.dir") { _, g ->
            for (attempt in 0 until 100) {
                val a = random(g, -3..3)
                val b = random(g, -3..3)
                val d = a.indices.map { b[it] - a[it] }
                if (!(a != b && d.map { Math.abs(it) }.toSet().size == 3)) continue
                val wrong = listOf(a.indices.map { a[it] + b[it] }, b, listOf(d[1], d[2], d[0]), listOf(d[2], d[0], d[1]))
                return@UTemplate UProblem.choice(
                    key = "v.dir|$a|$b", prompt = "Welcher Richtungsvektor gehört zur Geraden durch ${UText.point("A", a)} und ${UText.point("B", b)}?",
                    correct = UText.vector(d), wrong = wrong.map { UText.vector(it) },
                    solution = "Richtungsvektor: AB = B − A = ${UText.vector(d)}. Jedes Vielfache davon geht auch.",
                    explanation = "Die Richtung der Geraden ist der Verbindungsvektor B − A; die Summe A + B oder der Ortsvektor von B zeigt in eine andere Richtung.",
                    fact = UFact.Direction(a, b),
                )
            }
            null
        }
    }
}

object UCalc3 {
    /** A whole number in brackets when it is negative. */
    fun bracket(n: Int): String = if (n < 0) "(${UText.signed(n)})" else "$n"
}
