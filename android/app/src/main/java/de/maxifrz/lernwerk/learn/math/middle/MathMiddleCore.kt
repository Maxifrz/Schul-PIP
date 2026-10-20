package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.Rational
import de.maxifrz.lernwerk.learn.trimWs

// Exact arithmetic without optionals, seeded numbers and the problem/template types of the middle-school maths
// course. A port of MathMiddleCore.swift and MathMiddleSupport.swift.

typealias Q = MathMiddleQ
typealias P = MathMiddleProblem
typealias W = MathMiddleProblem.Wrong
typealias Ty = MathMiddleProblem.Typed
typealias Gen = MathMiddleGen

/**
 * A value that is only trusted while `ok` is true: dividing by zero or overflowing clears it, and a problem built
 * from such a value is dropped. `Q(numerator, denominator)` is Swift's `MathMiddleQ(n, d)`.
 */
class MathMiddleQ(rational: Rational?) : Comparable<MathMiddleQ> {
    val value: Rational = rational ?: Rational.whole(0)
    val ok: Boolean = rational != null

    constructor(numerator: Int, denominator: Int = 1) : this(Rational.make(numerator.toLong(), denominator.toLong()))

    val numerator: Int get() = value.numerator.toInt()
    val denominator: Int get() = value.denominator.toInt()
    val isWhole: Boolean get() = value.isWhole
    val double: Double get() = value.doubleValue
    val isZero: Boolean get() = value.numerator == 0L
    val isNegative: Boolean get() = value.numerator < 0L

    /** The value as a whole number, null for a fraction. */
    val int: Int? get() = if (value.isWhole) value.numerator.toInt() else null

    val reciprocal: MathMiddleQ get() = MathMiddleQ(1) / this
    val negated: MathMiddleQ get() = MathMiddleQ(-numerator, denominator)
    val magnitude: MathMiddleQ get() = if (isNegative) negated else this

    private fun combine(other: MathMiddleQ, result: Rational?): MathMiddleQ {
        val r = MathMiddleQ(result)
        return if (ok && other.ok && r.ok) r else MathMiddleQ(1, 0)
    }

    operator fun plus(b: MathMiddleQ): MathMiddleQ = combine(b, value + b.value)
    operator fun minus(b: MathMiddleQ): MathMiddleQ = combine(b, value - b.value)
    operator fun times(b: MathMiddleQ): MathMiddleQ = combine(b, value * b.value)
    operator fun div(b: MathMiddleQ): MathMiddleQ = combine(b, value / b.value)
    operator fun plus(b: Int): MathMiddleQ = this + MathMiddleQ(b)
    operator fun minus(b: Int): MathMiddleQ = this - MathMiddleQ(b)
    operator fun times(b: Int): MathMiddleQ = this * MathMiddleQ(b)
    operator fun div(b: Int): MathMiddleQ = this / MathMiddleQ(b)

    override fun compareTo(other: MathMiddleQ): Int =
        if (value.lessThan(other.value)) -1 else if (other.value.lessThan(value)) 1 else 0

    /** Swift's synthesized `==`: the same value and the same validity. */
    override fun equals(other: Any?): Boolean = other is MathMiddleQ && ok == other.ok && value == other.value
    override fun hashCode(): Int = value.hashCode() * 31 + (if (ok) 1 else 0)
    override fun toString(): String = "Q($value, ok=$ok)"

    /** This value to a whole-number power; a negative power takes the reciprocal. */
    fun power(exponent: Int): MathMiddleQ {
        var result = MathMiddleQ(1)
        repeat(Math.abs(exponent)) { result = result * this }
        return if (exponent < 0) result.reciprocal else result
    }
}

operator fun Int.plus(b: MathMiddleQ): MathMiddleQ = MathMiddleQ(this) + b
operator fun Int.minus(b: MathMiddleQ): MathMiddleQ = MathMiddleQ(this) - b
operator fun Int.times(b: MathMiddleQ): MathMiddleQ = MathMiddleQ(this) * b
operator fun Int.div(b: MathMiddleQ): MathMiddleQ = MathMiddleQ(this) / b

/** Swift `Rational(Int)`. */
fun rat(n: Int): Rational = Rational.whole(n.toLong())

/** Seeded numbers for the problem templates (SplitMix64 through `LearnRandom`). */
class MathMiddleGen(seed: ULong) {
    val random = LearnRandom(seed)

    /** A number from the range, every value about equally likely (`next() % span`, not Lemire). */
    fun int(range: IntRange): Int {
        val span = (range.last.toLong() - range.first.toLong() + 1L).toULong()
        val r = range.first + (random.next() % span).toInt()
        if (System.getProperty("mmdebug") != null) System.err.println("DBG ${range.first}..${range.last}=$r")
        return r
    }

    /** A number from the range that is not zero. */
    fun nonZero(range: IntRange): Int {
        var value = 0
        while (value == 0) value = int(range)
        return value
    }

    /** A number from the range for the difficulty level 1, 2 or 3. */
    fun int(level: Int, easy: IntRange, medium: IntRange, hard: IntRange): Int =
        int(if (level <= 1) easy else if (level == 2) medium else hard)

    fun <T> pick(items: List<T>): T = items[int(0..(items.size - 1))]

    /** True in `percent` of 100 draws. */
    fun chance(percent: Int): Boolean = int(1..100) <= percent

    fun sign(): Int = if (chance(50)) 1 else -1

    fun <T> shuffled(items: List<T>): List<T> {
        val result = items.toMutableList()
        if (result.size <= 1) return result
        for (index in result.size - 1 downTo 1) {
            val j = int(0..index)
            val a = result[index]
            result[index] = result[j]
            result[j] = a
        }
        return result
    }

    /** A fraction between 0 and 1 in lowest terms, with a denominator from the list (each at least 2). */
    fun properFraction(denominators: List<Int>): MathMiddleQ {
        repeat(60) {
            val denominator = pick(denominators)
            val numerator = int(1..(denominator - 1))
            if (MathMiddleText.gcd(numerator, denominator) == 1) return MathMiddleQ(numerator, denominator)
        }
        return MathMiddleQ(1, denominators[0])
    }

    /** A whole number from the range that has no common factor with `other`. */
    fun coprime(other: Int, range: IntRange): Int? {
        repeat(60) {
            val value = int(range)
            if (MathMiddleText.gcd(value, other) == 1) return value
        }
        return null
    }

    /** The first result of up to `tries` attempts that is not null. */
    fun <R : Any> attempt(tries: Int = 40, body: () -> R?): R? {
        repeat(tries) {
            val result = body()
            if (result != null) return result
        }
        return null
    }
}

/** The values that are whole numbers. */
val List<MathMiddleQ>.wholes: List<MathMiddleQ> get() = filter { it.ok && it.isWhole }

/** The values above zero. */
val List<MathMiddleQ>.positives: List<MathMiddleQ> get() = filter { it.ok && !it.isNegative && !it.isZero }

/** The values that end after at most `places` digits after the comma. */
fun List<MathMiddleQ>.decimals(places: Int): List<MathMiddleQ> {
    var scale = 1
    repeat(places) { scale *= 10 }
    return filter { it.ok && scale % it.denominator == 0 }
}

/** How a number is shown to the student. */
sealed class MathMiddleStyle {
    object Plain : MathMiddleStyle()
    object Fraction : MathMiddleStyle()
    object Mixed : MathMiddleStyle()
    object Percent : MathMiddleStyle()
    object Degrees : MathMiddleStyle()
    data class Unit(val unit: String) : MathMiddleStyle()
    object Pi : MathMiddleStyle()
    data class FractionUnit(val unit: String) : MathMiddleStyle()
    object Euro : MathMiddleStyle()

    fun text(value: MathMiddleQ, bare: Boolean = false): String = when (this) {
        Plain -> MathMiddleText.number(value)
        Fraction -> MathMiddleText.fraction(value)
        Mixed -> MathMiddleText.mixed(value)
        Percent -> MathMiddleText.number(value) + (if (bare) "" else " %")
        Degrees -> MathMiddleText.number(value) + (if (bare) "" else "°")
        is Unit -> MathMiddleText.number(value) + (if (bare) "" else " $unit")
        Pi -> MathMiddleText.number(value) + (if (bare) "" else "π")
        is FractionUnit -> MathMiddleText.fraction(value) + (if (bare) "" else " $unit")
        Euro -> if (bare) MathMiddleText.euroAmount(value).replace(" €", "") else MathMiddleText.euroAmount(value)
    }
}

/** One generated problem before it is put to the student. A template builds it; the builder turns it into an exercise. */
class MathMiddleProblem(
    var prompt: String,
    var correct: String,
    var correctValue: Rational?,
    var wrong: List<Wrong>,
    var typed: Typed?,
    var pairFront: String?,
    var pairPrompt: String = "Ordne jeder Aufgabe ihr Ergebnis zu.",
    var pairExplanation: String? = null,
    var solution: String,
    var explanation: String,
    var allowsEquivalentWrong: Boolean = false,
) {
    /** A wrong answer: its text and, when it is a number, its value, so it can never equal the right answer. */
    class Wrong(val text: String, val value: Rational?)

    /** A typed variant of the problem: what to ask and the exact answer. */
    class Typed(var prompt: String, var answer: Rational, var text: String? = null)

    /** What makes the problem this one: asking it twice with the same numbers is a repeat. */
    val key: String get() = prompt + "\u001F" + correct

    /** The wrong options that survive: not equal to the right answer in value or in the characters that count, and no two alike. */
    val options: List<String>
        get() {
            val seen = hashSetOf(LearnExercise.folded(correct))
            val result = mutableListOf<String>()
            for (candidate in wrong) {
                val value = candidate.value
                val right = correctValue
                if (value != null && right != null && value == right && !allowsEquivalentWrong) continue
                val text = candidate.text.trimWs()
                if (text.isEmpty() || !seen.add(LearnExercise.folded(text))) continue
                result.add(text)
            }
            return result
        }

    companion object {
        /**
         * A problem with a number as the answer. `wrong` are the values of typical mistakes (values equal to the answer
         * are dropped when the options are built), `extraWrong` mistakes that need their own text.
         */
        fun number(
            prompt: String,
            answer: MathMiddleQ,
            style: MathMiddleStyle = MathMiddleStyle.Plain,
            hint: String,
            wrong: List<MathMiddleQ>,
            extraWrong: List<Wrong> = emptyList(),
            typedPrompt: String? = null,
            typedAnswer: MathMiddleQ? = null,
            pair: String? = null,
            solution: String,
            explanation: String,
        ): MathMiddleProblem? {
            val asked = typedAnswer ?: answer
            if (!answer.ok || !asked.ok) return null
            return MathMiddleProblem(
                prompt = prompt,
                correct = style.text(answer),
                correctValue = answer.value,
                wrong = wrong.filter { it.ok }.map { Wrong(style.text(it), it.value) } + extraWrong,
                typed = Typed(
                    (typedPrompt ?: prompt) + (if (hint.isEmpty()) "" else "\n" + hint), asked.value,
                    if (typedAnswer == null) style.text(asked, true) else MathMiddleText.number(asked),
                ),
                pairFront = pair,
                solution = solution,
                explanation = explanation,
            )
        }

        /** A problem whose answer is a text (a term, a statement); `wrong` are the texts of typical mistakes. */
        fun text(
            prompt: String,
            correct: String,
            wrong: List<String>,
            typed: Typed? = null,
            pair: String? = null,
            solution: String,
            explanation: String,
        ): MathMiddleProblem = MathMiddleProblem(
            prompt = prompt, correct = correct, correctValue = null, wrong = wrong.map { Wrong(it, null) },
            typed = typed, pairFront = pair, solution = solution, explanation = explanation,
        )
    }
}

enum class MathMiddleForm { CHOICE, TYPED, PAIRS }

fun forms(vararg f: MathMiddleForm): Set<MathMiddleForm> = f.toSet()

/** A kind of problem the course can draw again and again with new numbers. */
class MathMiddleTemplate(
    /** Like "u03.percentValue"; the ids of a unit start with its number. */
    val id: String,
    /** The lesson of its unit that teaches it first, 1 to 3. */
    val lesson: Int,
    /** The forms it can be put in. */
    val forms: Set<MathMiddleForm> = setOf(MathMiddleForm.CHOICE, MathMiddleForm.TYPED),
    make: (level: Int, gen: MathMiddleGen) -> MathMiddleProblem?,
) {
    val make: (Int, MathMiddleGen) -> MathMiddleProblem? = { level, gen ->
        val problem = make(level, gen)
        if (problem == null) null
        else if (forms.contains(MathMiddleForm.CHOICE) && problem.options.size < 2) null
        else {
            if (!forms.contains(MathMiddleForm.TYPED)) problem.typed = null
            if (!forms.contains(MathMiddleForm.PAIRS)) problem.pairFront = null
            problem
        }
    }
}

/** Every template of the course, by unit. */
object MathMiddleCatalog {
    val units: List<List<MathMiddleTemplate>> by lazy {
        listOf(
            MathMiddleUnit01.templates, MathMiddleUnit02.templates, MathMiddleUnit03.templates,
            MathMiddleUnit04.templates, MathMiddleUnit05.templates, MathMiddleUnit06.templates,
            MathMiddleUnit07.templates, MathMiddleUnit08.templates, MathMiddleUnit09.templates,
            MathMiddleUnit10.templates,
        )
    }
}

/** Short names for the styles: `S.Plain`, `S.Unit("cm")`. */
object S {
    val Plain: MathMiddleStyle = MathMiddleStyle.Plain
    val Fraction: MathMiddleStyle = MathMiddleStyle.Fraction
    val Mixed: MathMiddleStyle = MathMiddleStyle.Mixed
    val Percent: MathMiddleStyle = MathMiddleStyle.Percent
    val Degrees: MathMiddleStyle = MathMiddleStyle.Degrees
    val Pi: MathMiddleStyle = MathMiddleStyle.Pi
    val Euro: MathMiddleStyle = MathMiddleStyle.Euro
    fun Unit(unit: String): MathMiddleStyle = MathMiddleStyle.Unit(unit)
    fun FractionUnit(unit: String): MathMiddleStyle = MathMiddleStyle.FractionUnit(unit)
}
