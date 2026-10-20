package de.maxifrz.lernwerk.learn.math.upper

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.Rational
import de.maxifrz.lernwerk.learn.randomDouble
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.randomIntClosed
import de.maxifrz.lernwerk.learn.shuffled

// Building blocks of the upper-school maths course: exact fractions, polynomials, the seeded generator, the problem
// type and the template type. A port of MathUpperCore.swift. Swift's Int is 64-bit: fractions use Long.

/** An exact fraction with non-optional arithmetic (a zero denominator gives 0). */
class UQ private constructor(val n: Long, val d: Long, @Suppress("UNUSED_PARAMETER") raw: Boolean) : Comparable<UQ> {
    operator fun plus(o: UQ): UQ = make(n * o.d + o.n * d, d * o.d)
    operator fun minus(o: UQ): UQ = make(n * o.d - o.n * d, d * o.d)
    operator fun times(o: UQ): UQ = make(n * o.n, d * o.d)
    operator fun div(o: UQ): UQ = make(n * o.d, d * o.n)
    operator fun unaryMinus(): UQ = make(-n, d)
    override fun compareTo(other: UQ): Int = (n * other.d).compareTo(other.n * d)

    val isInt: Boolean get() = d == 1L
    val isZero: Boolean get() = n == 0L
    val double: Double get() = n.toDouble() / d.toDouble()
    val magnitude: UQ get() = make(Math.abs(n), d)

    fun power(e: Int): UQ {
        var result = one
        for (i in 0 until maxOf(e, 0)) result = result * this
        return result
    }

    /** True when the decimal expansion ends after at most six digits. */
    val terminates: Boolean
        get() {
            var rest = d
            var twos = 0
            var fives = 0
            while (rest % 2 == 0L) { rest /= 2; twos += 1 }
            while (rest % 5 == 0L) { rest /= 5; fives += 1 }
            return rest == 1L && maxOf(twos, fives) <= 6
        }

    /** A result a student can type without a calculator: a short decimal or a fraction with a small denominator. */
    val isNice: Boolean
        get() {
            if (isInt || d <= 36) return true
            var rest = d
            while (rest % 2 == 0L) rest /= 2
            while (rest % 5 == 0L) rest /= 5
            return rest == 1L && d <= 100_000
        }

    /** The same with an ASCII hyphen, as it is stored as a typed answer. */
    val typed: String get() = Rational.make(n, d)?.germanText ?: "$n/$d"

    /** "0,375" or "3/8"; whole numbers plain; with the true minus sign for display. */
    val text: String get() = typed.replace("-", "−")

    val fraction: String get() = if (isInt) "$n" else "$n/$d"
    val fractionDisplay: String get() = fraction.replace("-", "−")

    override fun equals(other: Any?): Boolean = other is UQ && n == other.n && d == other.d
    override fun hashCode(): Int = 31 * n.hashCode() + d.hashCode()
    override fun toString(): String = "$n/$d"

    companion object {
        val zero: UQ = UQ(0L, 1L, true)
        val one: UQ = UQ(1L, 1L, true)

        internal fun make(n: Long, d: Long): UQ {
            if (d == 0L) return UQ(0L, 1L, true)
            var a = Math.abs(n)
            var b = Math.abs(d)
            while (b != 0L) { val t = a % b; a = b; b = t }
            val g = maxOf(a, 1L)
            val sign = if (d < 0) -1L else 1L
            return UQ(sign * n / g, Math.abs(d) / g, true)
        }
    }
}

fun UQ(n: Int, d: Int = 1): UQ = UQ.make(n.toLong(), d.toLong())
fun UQ(n: Long, d: Long = 1L): UQ = UQ.make(n, d)

object UText {
    private val asciiMinus = Regex("(?<![0-9A-Za-z])-(?=[0-9A-Za-z(])")

    /** Replaces a hyphen that is used as a sign by the real minus sign. */
    fun signs(text: String): String = asciiMinus.replace(text, "−")

    /** "", "−" or the number: the coefficient in front of a term. */
    fun coefficient(n: Int): String = if (n == 1) "" else if (n == -1) "−" else signed(n)

    private val sup = mapOf('0' to '⁰', '1' to '¹', '2' to '²', '3' to '³', '4' to '⁴', '5' to '⁵', '6' to '⁶', '7' to '⁷', '8' to '⁸', '9' to '⁹', '-' to '⁻')
    private val sub = mapOf('0' to '₀', '1' to '₁', '2' to '₂', '3' to '₃', '4' to '₄', '5' to '₅', '6' to '₆', '7' to '₇', '8' to '₈', '9' to '₉', '-' to '₋')

    fun superscript(n: Int): String = n.toString().map { sup[it] ?: it }.joinToString("")
    fun subscripted(n: Int): String = n.toString().map { sub[it] ?: it }.joinToString("")
    fun signed(n: Int): String = if (n < 0) "−${-n}" else "$n"

    /** A decimal or fraction in the form a student types it. */
    fun number(q: UQ): String = q.text

    /** A coefficient times pi: "π/3", "2π/3", "π", "0". */
    fun piMultiple(q: UQ): String {
        if (q.isZero) return "0"
        val sign = if (q.n < 0) "−" else ""
        val top = Math.abs(q.n)
        val head = if (top == 1L) "π" else "${top}π"
        return sign + (if (q.d == 1L) head else "$head/${q.d}")
    }

    /** A vector as row "(1 | 2 | 3)". */
    fun vector(v: List<Int>): String = "(" + v.joinToString(" | ") { signed(it) } + ")"
    fun point(name: String, v: List<Int>): String = name + "(" + v.joinToString(" | ") { signed(it) } + ")"
}

/** A polynomial with exact coefficients, lowest degree first. */
class UPoly(coefficients: List<UQ>) {
    val c: List<UQ>

    init {
        var end = coefficients.size
        while (end > 0 && coefficients[end - 1].isZero) end -= 1
        c = coefficients.subList(0, end).toList()
    }

    val degree: Int get() = c.size - 1
    val isZero: Boolean get() = c.isEmpty()
    fun coefficient(i: Int): UQ = if (i < c.size && i >= 0) c[i] else UQ.zero

    fun eval(x: UQ): UQ {
        var result = UQ.zero
        for (q in c.reversed()) result = result * x + q
        return result
    }

    fun evalDouble(x: Double): Double {
        var result = 0.0
        for (q in c.reversed()) result = result * x + q.double
        return result
    }

    val derivative: UPoly
        get() {
            if (c.size <= 1) return UPoly(emptyList())
            return UPoly((1 until c.size).map { c[it] * UQ(it) })
        }

    val integral: UPoly
        get() = UPoly(listOf(UQ.zero) + c.mapIndexed { i, q -> q / UQ(i + 1) })

    operator fun plus(o: UPoly): UPoly = UPoly((0 until maxOf(c.size, o.c.size)).map { coefficient(it) + o.coefficient(it) })

    operator fun times(o: UPoly): UPoly {
        if (isZero || o.isZero) return UPoly(emptyList())
        val out = MutableList(c.size + o.c.size - 1) { UQ.zero }
        for ((i, x) in c.withIndex()) for ((j, y) in o.c.withIndex()) out[i + j] = out[i + j] + x * y
        return UPoly(out)
    }

    fun scaled(q: UQ): UPoly = UPoly(c.map { it * q })

    /** "3x² − 4x + 1"; fractions as "x³/3" and "2x³/3". */
    val text: String
        get() {
            if (c.isEmpty()) return "0"
            var out = ""
            for (i in c.size - 1 downTo 0) {
                val q = c[i]
                if (q.isZero) continue
                val magnitude = q.magnitude
                val body: String
                if (i == 0) {
                    body = magnitude.fraction
                } else {
                    val coefficient = if (magnitude.n == 1L) "" else "${magnitude.n}"
                    body = coefficient + "x" + (if (i == 1) "" else UText.superscript(i)) + (if (magnitude.isInt) "" else "/${magnitude.d}")
                }
                out = if (out.isEmpty()) (if (q.n < 0) "−" else "") + body else out + (if (q.n < 0) " − " else " + ") + body
            }
            return out
        }

    override fun equals(other: Any?): Boolean = other is UPoly && c == other.c
    override fun hashCode(): Int = c.hashCode()
    override fun toString(): String = text

    companion object {
        fun ints(ints: List<Int>): UPoly = UPoly(ints.map { UQ(it) })

        /** Coefficients by exponent: [(exponent, coefficient)]. */
        fun terms(terms: List<Pair<Int, UQ>>): UPoly {
            val top = terms.maxOfOrNull { it.first } ?: 0
            val a = MutableList(top + 1) { UQ.zero }
            for ((e, q) in terms) a[e] = a[e] + q
            return UPoly(a)
        }

        /** lead * (x - r1) * (x - r2) ... */
        fun fromRoots(lead: UQ, roots: List<UQ>): UPoly {
            var p = UPoly(listOf(lead))
            for (r in roots) p = p * UPoly(listOf(-r, UQ.one))
            return p
        }
    }
}

/** The seeded source of randomness of one node. */
class UGen(seed: ULong) {
    private val rng = LearnRandom(seed)

    fun int(range: IntRange): Int = randomIntClosed(rng, range.first, range.last)

    fun nonzero(range: IntRange): Int {
        for (i in 0 until 50) {
            val v = int(range)
            if (v != 0) return v
        }
        return if (range.last == 0) range.first else range.last
    }

    fun sign(): Int = if (int(0..1) == 0) -1 else 1
    fun chance(p: Double): Boolean = randomDouble(rng, 0.0, 1.0) < p
    fun <T> pick(items: List<T>): T = items[de.maxifrz.lernwerk.learn.randomInt(rng, 0, items.size)]
    fun <T> shuffled(items: List<T>): List<T> = shuffled(items, rng)
    fun <T> withRandom(body: (LearnRandom) -> T): T = body(rng)

    /** A random polynomial of the given degree with `terms` non-zero terms (the leading one included). */
    fun poly(degree: Int, terms: Int, coefficients: IntRange = 1..5, negatives: Boolean = true): UPoly {
        val exponents = hashSetOf(degree)
        val candidates = shuffled((0 until degree).toList())
        for (e in candidates) if (exponents.size < minOf(terms, degree + 1)) exponents.add(e)
        val list = exponents.sorted().map { e ->
            val base = int(coefficients)
            val v = base * (if (negatives && e != degree) sign() else 1)
            e to UQ(v)
        }
        return UPoly.terms(list)
    }
}

// What a test needs to re-check an answer by another route. The fields are the raw inputs.
enum class UUrn { ONE_RED, TWO_RED_WITH, TWO_RED_WITHOUT, DIFFERENT_WITHOUT }
sealed class UBinom {
    data class Equal(val k: Int) : UBinom()
    data class AtMost(val k: Int) : UBinom()
    data class AtLeast(val k: Int) : UBinom()
    object AtLeastOne : UBinom()
}
enum class UExtremum { MAXIMUM, MINIMUM, SADDLE }
enum class USymmetry { Y_AXIS, ORIGIN, NEITHER }
enum class UAmpKind { AMPLITUDE, MAXIMUM, MINIMUM, MIDLINE }
enum class UAsk { P_A, P_B, P_A_AND_B, P_A_OR_B, P_NOT_A_AND_B, P_NOT_A_AND_NOT_B, P_A_GIVEN_B, P_B_GIVEN_A, P_NOT_B_GIVEN_A }

/** A Vierfeldertafel in counts: a = A and B, b = A and not B, c = not A and B, d = neither. */
data class UTable(val a: Int, val b: Int, val c: Int, val d: Int) {
    val total: Int get() = a + b + c + d
}

typealias RealFn = (Double) -> Double
typealias Vec = List<Int>

sealed class UFact {
    data class DerivAt(val f: UPoly, val x: UQ) : UFact()
    data class ValueAt(val f: UPoly, val x: UQ) : UFact()
    data class SlopeX(val f: UPoly, val m: UQ) : UFact()
    data class TangentT(val f: UPoly, val a: UQ) : UFact()
    data class TangentY(val f: UPoly, val a: UQ, val b: UQ) : UFact()
    data class FlatX(val f: UPoly) : UFact()
    data class FlatY(val f: UPoly) : UFact()
    data class DerivPoly(val f: UPoly, val correct: UPoly, val wrong: List<UPoly>) : UFact()
    class DerivOfFunction(val f: RealFn, val at: Double) : UFact()
    class ValueOfFunction(val f: RealFn, val at: Double) : UFact()
    data class Root(val f: UPoly, val largest: Boolean) : UFact()
    data class ExtremumX(val f: UPoly, val max: Boolean) : UFact()
    data class ExtremumY(val f: UPoly, val max: Boolean) : UFact()
    data class InflectionX(val f: UPoly) : UFact()
    data class KindAt(val f: UPoly, val x: UQ, val kind: UExtremum) : UFact()
    data class Symmetry(val f: UPoly, val kind: USymmetry) : UFact()
    data class Monotone(val f: UPoly, val lo: UQ, val hi: UQ, val askRising: Boolean, val answerBetween: Boolean) : UFact()
    data class Antiderivative(val f: UPoly, val correct: UPoly, val wrong: List<UPoly>) : UFact()
    data class Definite(val f: UPoly, val a: UQ, val b: UQ) : UFact()
    data class Area(val f: UPoly, val a: UQ, val b: UQ) : UFact()
    data class Mean(val f: UPoly, val a: UQ, val b: UQ) : UFact()
    data class UpperLimit(val f: UPoly, val value: UQ) : UFact()
    data class Combination(val coefficients: List<UQ>, val parts: List<UQ>) : UFact()
    class IntegralOfFunction(val f: RealFn, val from: Double, val to: Double) : UFact()
    data class Approx(val value: Double) : UFact()
    data class PowerEquation(val base: Double, val k: UQ, val c: UQ, val rhs: Double) : UFact()
    data class ExpDeriv(val a: Int, val k: Int, val b: Int) : UFact()
    data class ExpAnti(val a: Int, val k: Int) : UFact()
    data class LnSolve(val a: Int, val k: Int) : UFact()
    class Law(val correct: (Double, Double) -> Pair<Double, Double>, val wrong: List<(Double, Double) -> Pair<Double, Double>>) : UFact()
    data class TrigValue(val fn: String, val degrees: Int) : UFact()
    data class DegreesToPi(val degrees: Int) : UFact()
    data class Period(val fn: String, val k: UQ) : UFact()
    data class Amplitude(val a: UQ, val k: UQ, val d: UQ, val what: UAmpKind) : UFact()
    data class ZerosIn(val fn: String, val k: Int) : UFact()
    data class TrigSolve(val fn: String, val value: UQ) : UFact()
    data class CosFromSin(val sin: UQ, val askTan: Boolean) : UFact()
    data class TrigDeriv(val fn: String, val a: Int, val k: Int) : UFact()
    data class VecNorm(val v: Vec) : UFact()
    data class Dot(val a: Vec, val b: Vec) : UFact()
    data class OrthoParam(val a: Vec, val b: Vec, val index: Int) : UFact()
    data class Distance(val a: Vec, val b: Vec) : UFact()
    data class VectorComponent(val from: Vec, val to: Vec, val index: Int) : UFact()
    data class LineParam(val a: Vec, val u: Vec, val p: Vec) : UFact()
    data class LinePoint(val a: Vec, val u: Vec, val t: Int, val index: Int) : UFact()
    data class Midpoint(val a: Vec, val b: Vec, val index: Int) : UFact()
    data class Angle(val a: Vec, val b: Vec) : UFact()
    data class OnLine(val a: Vec, val u: Vec, val right: Vec, val wrong: List<Vec>) : UFact()
    data class OrthogonalPair(val right: Pair<Vec, Vec>, val wrong: List<Pair<Vec, Vec>>) : UFact()
    data class Direction(val a: Vec, val b: Vec) : UFact()
    data class LaplaceDice(val sums: List<Int>) : UFact()
    data class Urn(val red: Int, val blue: Int, val mode: UUrn) : UFact()
    data class Choose(val n: Int, val k: Int) : UFact()
    data class Binomial(val n: Int, val p: UQ, val kind: UBinom) : UFact()
    data class Expectation(val n: Int, val p: UQ) : UFact()
    data class ExpectationTable(val values: List<UQ>, val probabilities: List<UQ>) : UFact()
    data class Sigma(val n: Int, val p: UQ) : UFact()
    data class Table(val table: UTable, val ask: UAsk) : UFact()
    data class Independence(val table: UTable) : UFact()
    object Pairs : UFact()
    object Concept : UFact()
}

/** One generated question of the course. */
class UProblem(
    var key: String,
    var prompt: String,
    var hint: String = "",
    var number: UQ?,
    var correct: String,
    var wrong: List<String>,
    var solution: String,
    var explanation: String,
    var fact: UFact,
    var typedAllowed: Boolean = true,
) {
    val canChoice: Boolean get() = wrong.size >= 2

    /** Every text of the problem with the real minus sign instead of a hyphen used as a sign. */
    fun sanitize() {
        prompt = UText.signs(prompt)
        correct = UText.signs(correct)
        wrong = wrong.map { UText.signs(it) }
        solution = UText.signs(solution)
        explanation = UText.signs(explanation)
    }

    companion object {
        /** Wrong answers without anything that reads like the right one or like each other. */
        fun cleaned(wrong: List<String>, against: String): List<String> {
            val seen = hashSetOf(LearnExercise.folded(against))
            val out = mutableListOf<String>()
            for (w in wrong) if (w.isNotEmpty() && seen.add(LearnExercise.folded(w))) out.add(w)
            return out
        }

        /** A question with a number as the answer; `wrongs` are the results of typical mistakes. */
        fun numeric(
            key: String, prompt: String, hint: String = "", answer: UQ, wrongs: List<UQ>, solution: String,
            explanation: String, fact: UFact, typed: Boolean = true,
        ): UProblem? {
            if (!(answer.isNice && Math.abs(answer.double) < 100_000)) return null
            val correct = answer.text
            val texts = mutableListOf<String>()
            for (w in wrongs) if (w != answer && w.isNice && Math.abs(w.double) < 1_000_000) texts.add(w.text)
            return UProblem(
                key = key, prompt = prompt, hint = hint, number = answer, correct = correct,
                wrong = cleaned(texts, correct), solution = solution, explanation = explanation, fact = fact,
                typedAllowed = typed,
            )
        }

        /** A question whose options are terms or statements. */
        fun choice(
            key: String, prompt: String, correct: String, wrong: List<String>, solution: String, explanation: String, fact: UFact,
        ): UProblem? {
            val w = cleaned(wrong, correct)
            if (w.size < 2) return null
            return UProblem(
                key = key, prompt = prompt, number = null, correct = correct, wrong = w, solution = solution,
                explanation = explanation, fact = fact, typedAllowed = false,
            )
        }
    }
}

class UPairItem(val front: String, val back: String)

/** A template draws one problem of a level from 1 (easy) to 3 (hard); null means the draw did not work out. */
class UTemplate(
    val id: String,
    val pairs: ((Int, UGen) -> List<UPairItem>?)? = null,
    make: (Int, UGen) -> UProblem?,
) {
    val make: (Int, UGen) -> UProblem? = { level, gen ->
        val problem = make(level, gen)
        problem?.sanitize()
        problem
    }
}

/** The case name as Swift prints it (used in problem keys). */
val UAmpKind.swiftName: String
    get() = when (this) {
        UAmpKind.AMPLITUDE -> "amplitude"
        UAmpKind.MAXIMUM -> "maximum"
        UAmpKind.MINIMUM -> "minimum"
        UAmpKind.MIDLINE -> "midline"
    }

val UUrn.swiftName: String
    get() = when (this) {
        UUrn.ONE_RED -> "oneRed"
        UUrn.TWO_RED_WITH -> "twoRedWith"
        UUrn.TWO_RED_WITHOUT -> "twoRedWithout"
        UUrn.DIFFERENT_WITHOUT -> "differentWithout"
    }

val UAsk.swiftName: String
    get() = when (this) {
        UAsk.P_A -> "pA"
        UAsk.P_B -> "pB"
        UAsk.P_A_AND_B -> "pAandB"
        UAsk.P_A_OR_B -> "pAorB"
        UAsk.P_NOT_A_AND_B -> "pNotAandB"
        UAsk.P_NOT_A_AND_NOT_B -> "pNotAandNotB"
        UAsk.P_A_GIVEN_B -> "pAgivenB"
        UAsk.P_B_GIVEN_A -> "pBgivenA"
        UAsk.P_NOT_B_GIVEN_A -> "pNotBgivenA"
    }
