package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.ink.Box
import de.maxifrz.lernwerk.ink.MathNotes
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmPurpose
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private fun rect(x: Double, y: Double, w: Double, h: Double) = Box(x, y, x + w, y + h)

class MathNotesTest {
    @Test
    fun equalsSignIsTwoFlatStrokesAboveEachOther() {
        val top = rect(100.0, 50.0, 24.0, 3.0)
        val bottom = rect(101.0, 60.0, 22.0, 4.0)
        assertTrue(MathNotes.isEqualsSign(top, bottom))
        assertTrue(MathNotes.isEqualsSign(bottom, top))
        assertFalse(MathNotes.isEqualsSign(top, rect(140.0, 50.0, 22.0, 3.0)))
        assertFalse(MathNotes.isEqualsSign(top, rect(100.0, 55.0, 22.0, 20.0)))
        assertFalse(MathNotes.isEqualsSign(top, rect(100.0, 110.0, 24.0, 3.0)))
        assertFalse(MathNotes.isEqualsSign(rect(80.0, 50.0, 80.0, 3.0), bottom))
        assertFalse(MathNotes.isEqualsSign(top, rect(100.0, 51.0, 24.0, 3.0)))
    }

    @Test
    fun lineRegionTakesTheStrokesLeftOnTheSameLine() {
        val equals = rect(200.0, 105.0, 20.0, 12.0)
        val boxes = listOf(
            rect(170.0, 95.0, 20.0, 28.0),
            rect(140.0, 100.0, 20.0, 20.0),
            rect(110.0, 96.0, 20.0, 28.0),
            rect(110.0, 40.0, 60.0, 28.0),
            rect(250.0, 98.0, 20.0, 28.0),
            rect(10.0, 96.0, 20.0, 28.0),
            equals,
        )
        assertEquals(Box(110.0, 95.0, 190.0, 124.0), MathNotes.lineRegion(equals, boxes))
        assertNull(MathNotes.lineRegion(equals, listOf(equals, rect(250.0, 98.0, 20.0, 28.0))))
        assertEquals(Box(1.0, 2.0, 5.0, 8.0), Box.around(listOf(1.0, 8.0, 5.0, 2.0, 3.0, 4.0)))
    }

    @Test
    fun resultSizeAndPlace() {
        val line = rect(110.0, 95.0, 80.0, 29.0)
        assertEquals(27.55, MathNotes.fontSize(line), 0.01)
        assertEquals(14.0, MathNotes.fontSize(rect(0.0, 0.0, 10.0, 5.0)), 0.0)
        assertEquals(56.0, MathNotes.fontSize(rect(0.0, 0.0, 10.0, 200.0)), 0.0)
        val (x, y) = MathNotes.resultBaseline(rect(200.0, 105.0, 20.0, 12.0), line)
        assertEquals(228.0, x, 0.01)
        assertEquals(111 + 27.55 * 0.35, y, 0.01)
    }

    @Test
    fun parsingTheModelsAnswer() {
        val recognition = MathNotes.parse("""Hier: {"kind": "expression", "lines": ["a = 5", "2 × a + 3 ="], "table": null}""")
        assertEquals("expression", recognition?.kind)
        assertEquals(listOf("a = 5", "2 * a + 3 ="), recognition?.lines)
        val table = MathNotes.parse("""{"kind":"table","lines":[],"table":{"headers":["x","y"],"rows":[["1","2,5"],["2","4"]]}}""")
        assertEquals(2, table?.table?.rows?.size)
        assertEquals(listOf("x^2 + 1 ="), MathNotes.parse("<think>hm</think>\nx² + 1 =")?.lines)
        assertNull(MathNotes.parse("   "))
    }

    @Test
    fun cleaningSchoolSpellings() {
        assertEquals("3.5 * 2 - sqrt4", MathNotes.clean("3,5 · 2 − √4"))
        assertEquals("pi * r^2", MathNotes.clean("\$\\pi \\cdot r^2\$"))
        assertEquals("12 / 4 =", MathNotes.clean("12 : 4 ="))
        assertEquals("b := 2", MathNotes.clean("b := 2"))
        assertEquals("f(1, 2)", MathNotes.clean("f(1, 2)"))
    }

    @Test
    fun splittingDefinitionsFromTheQuestion() {
        val (definitions, expression) = MathNotes.split(listOf("a = 5", "f(x) = x^2 + 1", "x = 3", "2a + 3", "f(a) + 1 ="))
        assertEquals(listOf("a = 5", "f(x) = x^2 + 1"), definitions)
        assertEquals("f(a) + 1", expression)
        assertEquals("7 * 6", MathNotes.split(listOf("7 * 6 = ?")).second)
        assertNull(MathNotes.split(listOf("=")).second)
        assertNull(MathNotes.split(emptyList()).second)
        assertTrue(MathNotes.isDefinition("Preis := 2.5"))
        assertFalse(MathNotes.isDefinition("x = 3"))
        assertFalse(MathNotes.isDefinition("a = "))
        assertFalse(MathNotes.isDefinition("2a = 6"))
        assertFalse(MathNotes.isDefinition("a = 5 ="))
    }

    @Test
    fun whatIsWorthShowing() {
        assertFalse(MathNotes.isWorthShowing("5", "5"))
        assertFalse(MathNotes.isWorthShowing("x", "x"))
        assertTrue(MathNotes.isWorthShowing("2+3", "5"))
        assertEquals("1/2", MathNotes.resultText("1/2", "0,5"))
        assertEquals("1,2676506·10³⁰", MathNotes.resultText("1267650600228229401496703205376", "1,2676506·10³⁰"))
        assertEquals("3,14", MathNotes.resultText(null, "3,14"))
    }

    @Test
    fun tablesBecomeChartData() {
        val chart = MathNotes.chartData(MathNotes.Recognition.Table(listOf("x", "f(x)", "Notiz"), listOf(listOf("1", "2,5", "a"), listOf("2", "4", "b"), listOf("3", "", "c"))))
        assertEquals(listOf("f(x)"), chart?.columns?.map { it.name })
        assertEquals(listOf(2.5, 4.0, null), chart?.columns?.first()?.values)
        assertEquals(true, chart?.numericX)
        assertEquals(listOf(1.0, 2.0, 3.0), chart?.xValues)
        val bars = MathNotes.chartData(MathNotes.Recognition.Table(listOf("Fach", "Note", "Stunden"), listOf(listOf("Mathe", "2", "4"), listOf("Deutsch", "1,7", "3"))))
        assertEquals(false, bars?.numericX)
        assertEquals(2, bars?.columns?.size)
        assertNull(MathNotes.chartData(MathNotes.Recognition.Table(listOf("a"), listOf(listOf("1")))))
        assertEquals(-2.5, MathNotes.number("−2,5")!!, 0.0)
    }

    @Test
    fun recognitionRequestCarriesTheImage() {
        val request = MathNotes.request(byteArrayOf(1, 2, 3), MathNotes.LINE_HINT)
        assertEquals(LlmPurpose.MathRecognition, request.purpose)
        assertTrue(request.messages.first().content.first() is LlmContent.Image)
        assertTrue(request.system.contains("calculator syntax"))
    }
}
