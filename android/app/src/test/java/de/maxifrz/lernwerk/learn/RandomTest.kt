package de.maxifrz.lernwerk.learn

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RandomTest {
    private val fixture = readJson(TestPaths.content("fixtures/random.json")).jsonObject
    private val streams = fixture["streams"]!!.jsonArray.map { it.jsonObject }

    private fun strings(o: JsonObject, key: String) = o[key]!!.jsonArray.map { it.jsonPrimitive.content }
    private fun ints(o: JsonObject, key: String) = o[key]!!.jsonArray.map { it.jsonPrimitive.int }

    @Test fun hasStreamsForSeveralSeeds() = assertTrue(streams.size >= 5)

    @Test fun rawWords() {
        for (s in streams) {
            val rng = LearnRandom(s["seed"]!!.jsonPrimitive.content.toULong())
            assertEquals("seed ${s["seed"]}", strings(s, "words"), strings(s, "words").map { rng.next().toString() })
        }
    }

    @Test fun boundedAndClosedIntegers() {
        for (s in streams) {
            val seed = s["seed"]!!.jsonPrimitive.content.toULong()
            val bounded = LearnRandom(seed)
            assertEquals(ints(s, "bounded"), ints(s, "bounded").indices.map { randomInt(bounded, 0, ((it + 3) * 7) % 23 + 2) })
            val closed = LearnRandom(seed)
            assertEquals(ints(s, "closed"), ints(s, "closed").map { randomIntClosed(closed, -5, 12) })
        }
    }

    @Test fun doubles() {
        for (s in streams) {
            val rng = LearnRandom(s["seed"]!!.jsonPrimitive.content.toULong())
            val bits = strings(s, "doubleBits").map { java.lang.Double.doubleToRawLongBits(randomDouble(rng, 0.0, 7.5)).toULong().toString() }
            assertEquals(strings(s, "doubleBits"), bits)
        }
    }

    @Test fun shufflesAndPicks() {
        for (s in streams) {
            val seed = s["seed"]!!.jsonPrimitive.content.toULong()
            val rng = LearnRandom(seed)
            val expected = s["shuffles"]!!.jsonArray.map { (it as JsonArray).map { x -> x.jsonPrimitive.int } }
            val ours = expected.map { e -> MutableList(e.size) { it }.also { shuffle(it, rng) } }
            assertEquals(expected, ours)
            val picks = LearnRandom(seed)
            assertEquals(ints(s, "picks"), ints(s, "picks").map { randomElement(listOf(10, 20, 30, 40, 50), picks) })
        }
    }

    @Test fun exercisesSeedMatchesSwift() {
        val seeds = fixture["nodeSeeds"]!!.jsonArray.map { it.jsonObject }
        assertTrue(seeds.size > 10)
        for (e in seeds) {
            assertEquals(e["seed"]!!.jsonPrimitive.content, Exercises.seed(e["node"]!!.jsonPrimitive.content, e["base"]!!.jsonPrimitive.content.toULong()).toString())
        }
    }

    @Test fun multiplyHighIsExact() {
        // Compare with BigInteger on awkward values.
        val values = listOf(0uL, 1uL, 0xFFFFFFFFuL, 0x100000000uL, ULong.MAX_VALUE, 0x9E3779B97F4A7C15uL, 12345678901234567uL)
        for (a in values) for (b in values) {
            val expected = (java.math.BigInteger(a.toString()) * java.math.BigInteger(b.toString())).shiftRight(64).toString()
            assertEquals(expected, multiplyHigh(a, b).toString())
        }
    }

    @Test fun helpers() {
        val a = SplitMix(42uL)
        val b = SplitMix(42uL)
        assertEquals((b.next() shr 11).toDouble() / Math.pow(2.0, 53.0), a.nextDouble(), 0.0)
        assertNull(randomElement(emptyList<Int>(), LearnRandom(1uL)))
        assertTrue(runCatching { randomInt(LearnRandom(1uL), 3, 3) }.isFailure)
        assertTrue(runCatching { nextBelow(LearnRandom(1uL), 0uL) }.isFailure)
        val list = mutableListOf(1, 2, 3, 4, 5, 6)
        shuffle(list, LearnRandom(9uL))
        assertEquals(listOf(1, 2, 3, 4, 5, 6), list.sorted())
        val one = mutableListOf(7)
        shuffle(one, LearnRandom(9uL))
        assertEquals(listOf(7), one)
    }

    @Test fun seedsOfTheSameNodeRepeatOthersDiffer() {
        val unit = CourseUnit.standard("x", 1, "T", "", "t")
        assertEquals(Exercises.seed(unit.nodes[0], 5uL), Exercises.seed(unit.nodes[0], 5uL))
        assertNotEquals(Exercises.seed(unit.nodes[0], 5uL), Exercises.seed(unit.nodes[1], 5uL))
    }
}
