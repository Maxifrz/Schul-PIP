package de.maxifrz.lernwerk.learn.math.upper

// Typical mistakes when differentiating or integrating a polynomial term by term; the wrong options of the calculus
// questions are computed from these. A port of MathUpperSupport.swift.

enum class UMistake {
    /** The exponent is lowered but the factor is forgotten: 4x³ becomes 4x². */
    NO_MULTIPLY,

    /** The factor is taken but the exponent stays: 4x³ becomes 12x³. */
    NO_LOWER,

    /** A constant stays instead of vanishing. */
    KEEP_CONSTANT,

    /** The antiderivative is formed instead. */
    INTEGRATE,
}

object UCalc {
    fun mistaken(f: UPoly, mistake: UMistake): UPoly {
        val terms = mutableListOf<Pair<Int, UQ>>()
        for ((k, q) in f.c.withIndex()) {
            if (q.isZero) continue
            when (mistake) {
                UMistake.NO_MULTIPLY -> if (k >= 1) terms.add((k - 1) to q)
                UMistake.NO_LOWER -> if (k >= 1) terms.add(k to q * UQ(k))
                UMistake.KEEP_CONSTANT -> if (k == 0) terms.add(0 to q) else terms.add((k - 1) to q * UQ(k))
                UMistake.INTEGRATE -> terms.add((k + 1) to q / UQ(k + 1))
            }
        }
        return UPoly.terms(terms)
    }

    fun fx(f: UPoly, name: String = "f"): String = "$name(x) = " + f.text

    /** A polynomial that grows in size with the level. */
    fun poly(g: UGen, level: Int): UPoly {
        for (i in 0 until 30) {
            val p = when (level) {
                1 -> g.poly(degree = 2, terms = g.int(1..2), coefficients = 1..4)
                2 -> g.poly(degree = g.int(2..3), terms = g.int(2..3), coefficients = 1..5)
                else -> g.poly(degree = g.int(3..4), terms = g.int(3..4), coefficients = 1..5)
            }
            if (p.derivative.degree >= 1) return p
        }
        return UPoly.ints(listOf(1, 2, 3))
    }

    /** Rounds a list of wrong numbers: only those that differ from the answer (and each other). */
    fun differing(list: List<UQ>, from: UQ): List<UQ> {
        val seen = hashSetOf(from)
        return list.filter { seen.add(it) }
    }
}
