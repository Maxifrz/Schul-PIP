package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.review.AnswerCheck
import de.maxifrz.lernwerk.review.AnswerCheck.Verdict.CORRECT
import de.maxifrz.lernwerk.review.AnswerCheck.Verdict.WRONG
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AnswerCheckTest {
    private fun verdict(answer: String, expected: String) = AnswerCheck.evaluate(answer, expected)

    @Test
    fun `word order, filler words and spelling do not matter`() {
        val expected = "Äußere Ableitung mal innere Ableitung"
        assertEquals(CORRECT, verdict("Äußere mal innere Ableitung", expected))
        assertEquals(CORRECT, verdict("aeussere mal innere ableitung", expected))
        assertEquals(CORRECT, verdict("Quotientenregel", "Die Quotientenregel"))
        assertEquals(CORRECT, verdict("kettenregl", "Kettenregel"))
        assertEquals(CORRECT, verdict("Ableitungen", "Ableitung"))
    }

    @Test
    fun `wrong or missing answers`() {
        assertEquals(WRONG, verdict("Produktregel", "Quotientenregel"))
        assertEquals(WRONG, verdict("Hauptstadt", "Berlin"))
        assertEquals(WRONG, verdict("   ", "Ableitung"))
        assertEquals(WRONG, verdict("Aeussere Ableitung", "Äußere Ableitung mal innere Ableitung"))
        assertEquals(WRONG, verdict("Photosynthese", "Die Photosynthese wandelt Licht in chemische Energie um"))
    }

    @Test
    fun `long answers need most key words`() {
        assertEquals(CORRECT, verdict("Photosynthese wandelt Licht in chemische Energie", "Die Photosynthese wandelt Licht in chemische Energie um"))
    }

    @Test
    fun `numbers and formulas must be exact`() {
        assertEquals(CORRECT, verdict("0,5", "0.5"))
        assertEquals(CORRECT, verdict("x^2", "x²"))
        assertEquals(CORRECT, verdict("2x", "2 x"))
        assertEquals(CORRECT, verdict("12", "12"))
        assertEquals(WRONG, verdict("3", "4"))
        assertEquals(WRONG, verdict("y", "x"))
        assertEquals(WRONG, verdict("Ableitung von x^3 ist 3x^3", "Die Ableitung von x^3 ist 3x^2"))
        assertEquals(CORRECT, verdict("Ableitung von x^3 ist 3x^2", "Die Ableitung von x^3 ist 3x^2"))
    }

    @Test
    fun `alternatives accept either part`() {
        assertEquals(CORRECT, verdict("Berlin", "Berlin / Bundeshauptstadt"))
        assertEquals(CORRECT, verdict("Bundeshauptstadt", "Berlin oder Bundeshauptstadt"))
        assertEquals(CORRECT, verdict("a/b", "a/b"))
        assertEquals(WRONG, verdict("a", "a/b"))
    }

    @Test
    fun `helpers`() {
        assertEquals(3, AnswerCheck.distance("kitten", "sitting"))
        assertEquals("aussere", AnswerCheck.normalize("Äußere"))
        assertEquals(listOf("pi", "3.14"), AnswerCheck.tokens("pi = 3.14."))
        assertTrue("ableitung" in AnswerCheck.keyTokens("die ableitung von f"))
        assertFalse("die" in AnswerCheck.keyTokens("die ableitung von f"))
    }
}
