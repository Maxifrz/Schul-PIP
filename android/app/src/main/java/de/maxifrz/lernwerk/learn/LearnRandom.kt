package de.maxifrz.lernwerk.learn

// Seeded random numbers for the learning path: SplitMix64 and the pieces of the Swift standard library that sit on top
// of a `next() -> UInt64` generator, reproduced step by step so the same seed gives the same lesson as on iOS.
// A port of SplitMix (PipRun.swift) and LearnRandom (ExerciseBuilder.swift).

/** Anything that produces 64 random bits per call, like Swift's RandomNumberGenerator. */
interface RandomNumberGenerator {
    fun next(): ULong
}

/** A small seeded generator (SplitMix64), so a run can be replayed. */
class SplitMix(seed: ULong) : RandomNumberGenerator {
    private var state: ULong = seed

    override fun next(): ULong {
        state += 0x9E3779B97F4A7C15uL
        var z = state
        z = (z xor (z shr 30)) * 0xBF58476D1CE4E5B9uL
        z = (z xor (z shr 27)) * 0x94D049BB133111EBuL
        return z xor (z shr 31)
    }

    /** A Double in 0..<1 from the top 53 bits. */
    fun nextDouble(): Double = (next() shr 11).toDouble() / 9007199254740992.0
}

/** Seeded random numbers for the Lernpfad (SplitMix64), so the same seed builds the same lesson. */
class LearnRandom(seed: ULong) : RandomNumberGenerator {
    private val mix = SplitMix(seed)

    override fun next(): ULong = mix.next()

    fun nextBelow(upperBound: ULong): ULong = nextBelow(this, upperBound)
    fun int(lower: Int, upper: Int): Int = randomInt(this, lower, upper)
    fun intClosed(lower: Int, upper: Int): Int = randomIntClosed(this, lower, upper)
    fun <T> shuffle(list: MutableList<T>) = shuffle(list, this)
    fun <T> shuffled(list: List<T>): List<T> = shuffled(list, this)
    fun <T> randomElement(list: List<T>): T? = randomElement(list, this)
    fun double(lower: Double, upper: Double): Double = randomDouble(this, lower, upper)
}

/** High 64 bits of the 128-bit product (Math.multiplyHigh is not safe on old Android). */
internal fun multiplyHigh(a: ULong, b: ULong): ULong {
    val mask = 0xFFFFFFFFuL
    val aLo = a and mask
    val aHi = a shr 32
    val bLo = b and mask
    val bHi = b shr 32
    val ll = aLo * bLo
    val lh = aLo * bHi
    val hl = aHi * bLo
    val hh = aHi * bHi
    val mid = (ll shr 32) + (lh and mask) + (hl and mask)
    return hh + (lh shr 32) + (hl shr 32) + (mid shr 32)
}

/** Swift's `next(upperBound:)` for UInt64 (Lemire's multiply-and-reject): uniform in 0..<upperBound. */
fun nextBelow(rng: RandomNumberGenerator, upperBound: ULong): ULong {
    require(upperBound > 0uL) { "upperBound must be positive" }
    var random = rng.next()
    var low = random * upperBound
    var high = multiplyHigh(random, upperBound)
    if (low < upperBound) {
        val t = (0uL - upperBound) % upperBound
        while (low < t) {
            random = rng.next()
            low = random * upperBound
            high = multiplyHigh(random, upperBound)
        }
    }
    return high
}

/** `Int.random(in: lower..<upper, using:)`. */
fun randomInt(rng: RandomNumberGenerator, lower: Int, upper: Int): Int {
    require(lower < upper) { "Range requires lowerBound < upperBound" }
    return lower + nextBelow(rng, (upper.toLong() - lower.toLong()).toULong()).toInt()
}

/** `Int.random(in: lower...upper, using:)`. */
fun randomIntClosed(rng: RandomNumberGenerator, lower: Int, upper: Int): Int {
    require(lower <= upper) { "Range requires lowerBound <= upperBound" }
    return lower + nextBelow(rng, (upper.toLong() - lower.toLong() + 1L).toULong()).toInt()
}

/** `Array.shuffle(using:)`, in place: the same sequence of swaps as the Swift standard library. */
fun <T> shuffle(list: MutableList<T>, rng: RandomNumberGenerator) {
    var amount = list.size
    var i = 0
    while (amount > 1) {
        val k = randomInt(rng, 0, amount)
        amount -= 1
        val a = list[i]
        list[i] = list[i + k]
        list[i + k] = a
        i += 1
    }
}

/** `Array.shuffled(using:)`. */
fun <T> shuffled(list: List<T>, rng: RandomNumberGenerator): List<T> {
    val copy = list.toMutableList()
    shuffle(copy, rng)
    return copy
}

/** `randomElement(using:)`: null for an empty list. */
fun <T> randomElement(list: List<T>, rng: RandomNumberGenerator): T? {
    if (list.isEmpty()) return null
    return list[randomInt(rng, 0, list.size)]
}

/** `Double.random(in: lower..<upper, using:)`: the low 53 bits of one word, retried when the result is the bound. */
fun randomDouble(rng: RandomNumberGenerator, lower: Double, upper: Double): Double {
    require(lower < upper) { "Range requires lowerBound < upperBound" }
    val delta = upper - lower
    while (true) {
        val rand = rng.next() and ((1uL shl 53) - 1uL)
        val unit = rand.toDouble() * Math.pow(2.0, -53.0)
        val x = delta * unit + lower
        if (x != upper) return x
    }
}
