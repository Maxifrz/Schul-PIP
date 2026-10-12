package de.maxifrz.lernwerk.learn

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NumberCheckTest {
    private fun same(a: String, b: String) = NumberCheck.matches(a, b)
    private fun r(n: Long, d: Long) = Rational.make(n, d)!!

    @Test fun theSameNumberInEveryWriting() {
        assertTrue(same("0,75", "3/4"))
        assertTrue(same("0.75", "3/4"))
        assertTrue(same("6/8", "3/4"))
        assertFalse(same("75 %", "0,75")) // a percent sign is dropped, not turned into a fraction
        assertTrue(same("75%", "75"))
        assertTrue(same("90°", "90"))
        assertTrue(same("1 1/2", "3/2"))
        assertTrue(same("1,5", "1 1/2"))
        assertTrue(same("-2", "−2"))
        assertTrue(same("-3/4", "-0,75"))
        assertTrue(same("  12 ", "12"))
        assertTrue(same("+4", "4"))
        assertTrue(same("0,50", "1/2"))
        assertTrue(same(",5", "1/2"))
    }

    @Test fun differentNumbersAndNonsense() {
        assertFalse(same("34", "3/4")) // AnswerCheck would accept this; the number check must not
        assertFalse(same("12", "1/2"))
        assertFalse(same("0,7", "3/4"))
        assertFalse(same("3/4", "4/3"))
        assertFalse(same("2x", "2"))
        assertFalse(same("x", "2"))
        assertFalse(same("", "0"))
        assertFalse(same("1/0", "0"))
        assertFalse(same("1,2,3", "1"))
        assertFalse(same("1 2", "12"))
        assertFalse(same("1 3/2", "5/2")) // the fraction of a mixed number is proper
        assertFalse(same("--2", "2"))
        assertFalse(same("2.", "2"))
        assertFalse(same("99999999999999999999", "1"))
        assertNull(NumberCheck.parse("abc"))
    }

    @Test fun rationalArithmeticAndText() {
        val half = r(1, 2)
        val third = r(1, 3)
        assertEquals(r(5, 6), half + third)
        assertEquals(r(1, 6), half - third)
        assertEquals(r(1, 6), half * third)
        assertEquals(r(3, 2), half / third)
        assertNull(half / Rational.whole(0))
        assertEquals(r(-1, 2), r(2, -4))
        assertNull(Rational.make(1, 0))
        assertTrue(third.lessThan(half))
        assertEquals("0,75", r(3, 4).germanText)
        assertEquals("-0,375", r(-3, 8).germanText)
        assertEquals("0,05", r(1, 20).germanText)
        assertEquals("1/3", third.germanText)
        assertEquals("7", Rational.whole(7).germanText)
        assertEquals("5/2", r(5, 2).fractionText)
        assertEquals(r(1, 8), NumberCheck.parse("0,125"))
    }

    @Test fun typedNumbersInAnExercise() {
        val exercise = Exercises.typed(id = "n", prompt = "3/8 + 3/8", answer = "3/4", mode = AnswerMode.NUMBER)!!
        assertEquals(emptySet<String>(), exercise.missedKeys(LearnAnswer.Typed("0,75")))
        assertEquals(emptySet<String>(), exercise.missedKeys(LearnAnswer.Typed("6/8")))
        assertEquals(setOf("n"), exercise.missedKeys(LearnAnswer.Typed("34"))) // an exercise without cards stands for itself
        assertNull(Exercises.typed(id = "bad", prompt = "?", answer = "drei", mode = AnswerMode.NUMBER))
    }

    // Extra cases: the int64 overflow rules of the Swift code.
    @Test fun returnsNullWhereSwiftReportsOverflow() {
        val big = Rational.make(9_000_000_000_000_000_000L, 1)!!
        assertNull(big + big)
        assertNull(big * Rational.whole(2))
        assertNull(Rational.make(Long.MIN_VALUE, 1))
        assertNull(Rational.make(1, Long.MIN_VALUE))
        // Comparing falls back on doubles instead of overflowing.
        assertTrue(r(1, 3).lessThan(big))
        // 15 digits parse, 16 do not; a 9-digit fraction on a 15-digit whole number overflows the scale.
        assertEquals(Rational.whole(999999999999999L), NumberCheck.parse("999999999999999"))
        assertNull(NumberCheck.parse("9999999999999999"))
        assertNull(NumberCheck.parse("999999999999999,123456789"))
        assertNull(NumberCheck.parse("0,1234567890"))
        assertNull(NumberCheck.parse("٣"))
    }

    @Test fun germanTextBeyondSixDigitsAndSmallSigns() {
        assertEquals("1/2000000", r(1, 2_000_000).germanText)
        assertEquals("0,000001", r(1, 1_000_000).germanText)
        assertEquals("-0,125", r(-1, 8).germanText)
        assertTrue(r(3, 1).isWhole)
        assertEquals(0.25, r(1, 4).doubleValue, 0.0)
        assertNotNull(NumberCheck.parse("1 1/2"))
    }
}
