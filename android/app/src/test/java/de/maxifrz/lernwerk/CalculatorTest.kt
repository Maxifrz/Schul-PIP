package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.calc.CalculatorHistory
import de.maxifrz.lernwerk.calc.CalculatorInput
import de.maxifrz.lernwerk.calc.CasAnswer
import de.maxifrz.lernwerk.calc.CasFormat
import de.maxifrz.lernwerk.calc.CasPlot
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CalculatorTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun answerDecodesFromTheCoreJson() {
        val answer = json.decodeFromString<CasAnswer>(
            """{"ok":true,"input":"löse(x^2=2)","giac":"solve(x^2=2)","assigns":null,"kind":null,"exact":"list[-sqrt(2),sqrt(2)]","approx":"list[-1.41421356237,1.41421356237]","pretty":"L = {-√2; √2}","prettyApprox":"L ≈ {-1,414213562; 1,414213562}","matrix":null}""",
        )
        assertTrue(answer.ok)
        assertEquals("L = {-√2; √2}", answer.pretty)
        assertNull(answer.matrix)
        val failed = json.decodeFromString<CasAnswer>("""{"ok":false,"error":"Syntaxfehler"}""")
        assertFalse(failed.ok)
        assertEquals("Syntaxfehler", failed.error)
    }

    @Test
    fun plotDecodesNullValuesAndPoints() {
        val plot = json.decodeFromString<CasPlot>(
            """{"ok":true,"xmin":-2,"xmax":2,"ymin":-5,"ymax":5,"curves":[{"index":0,"giac":"1/x","label":"f1(x)","pretty":"1/x","values":[-0.5,null,0.5]}],"roots":[],"extrema":[{"curve":0,"x":1,"y":-2,"kind":"min"}],"intersections":[{"curves":[0,1],"x":2,"y":4}],"intercepts":[]}""",
        )
        assertEquals(listOf(-0.5, null, 0.5), plot.curves?.first()?.values)
        assertEquals("min", plot.extrema?.first()?.kind)
        assertEquals(listOf(0, 1), plot.intersections?.first()?.curves)
        assertEquals(0.0, plot.x(1, 3), 0.0)
        assertEquals(2.0, plot.x(2, 3), 0.0)
    }

    @Test
    fun historyRecordsAnswersDefinitionsAndErrors() {
        var history = CalculatorHistory()
        history = history.recording("a = 5", CasAnswer(ok = true, assigns = "a", kind = "variable", exact = "5", pretty = "a = 5"))
        history = history.recording("f(x) = x^2", CasAnswer(ok = true, assigns = "f", kind = "function", exact = "f(x)=x^2", pretty = "f(x) = x²"))
        history = history.recording("1+", CasAnswer(ok = false, error = "Syntaxfehler"))
        history = history.recording("a = 7", CasAnswer(ok = true, assigns = "a", kind = "variable", exact = "7", pretty = "a = 7"))
        assertEquals(4, history.entries.size)
        assertEquals("Syntaxfehler", history.entries[2].error)
        assertNull(history.entries[1].exact)
        assertEquals(listOf("f", "a"), history.definitions.map { it.name })
        assertEquals("a = 7", history.definitions.last().input)
        assertEquals(listOf("a"), history.forgetting("f").definitions.map { it.name })
    }

    @Test
    fun ansIsTheNewestAnswer() {
        var history = CalculatorHistory()
        assertEquals("ans*2", history.resolvingAns("ans*2"))
        history = history.recording("löse(x^2=4)", CasAnswer(ok = true, exact = "list[-2,2]", pretty = "L = {-2; 2}"))
        history = history.recording("3+4", CasAnswer(ok = true, exact = "7", pretty = "7"))
        history = history.recording("b = 2", CasAnswer(ok = true, assigns = "b", kind = "variable", exact = "2", pretty = "b = 2"))
        assertEquals("(7)*2 + answer + (7)", history.resolvingAns("ans*2 + answer + ans"))
        assertEquals("plans(1)", CalculatorHistory.replaceWord("ans", "plans(ans)", "1"))
    }

    @Test
    fun historyKeepsTheNewest200AndRoundTrips() {
        var history = CalculatorHistory(degrees = true)
        for (index in 0 until 205) history = history.recording("$index", CasAnswer(ok = true, exact = "$index", pretty = "$index"))
        assertEquals(200, history.entries.size)
        assertEquals("5", history.entries.first().input)
        val text = json.encodeToString(CalculatorHistory.serializer(), history)
        assertEquals(history, json.decodeFromString(CalculatorHistory.serializer(), text))
    }

    @Test
    fun inputInsertsTemplatesAtTheCursor() {
        var input = CalculatorInput().inserting("löse(|, x)")
        assertEquals("löse(, x)", input.text)
        assertEquals("löse(", input.beforeCursor)
        input = input.inserting("x^2").inserting("=4")
        assertEquals("löse(x^2=4, x)", input.text)
        input = input.left().backspace()
        assertEquals("löse(x^24, x)", input.text)
        repeat(10) { input = input.right() }
        assertEquals(input.text.length, input.cursor)
        assertEquals(0, CalculatorInput().backspace().cursor)
        assertEquals(2, CalculatorInput("√2").cursor)
    }

    @Test
    fun numbersPointsAndTicks() {
        assertEquals("1,7321", CasFormat.number(1.73205))
        assertEquals("2", CasFormat.number(2.0))
        assertEquals("0", CasFormat.number(-0.00001))
        assertEquals("-2,5", CasFormat.number(-2.5))
        assertEquals("H(-1 | 2)", CasFormat.point("H", -1.0, 2.0))
        assertEquals(listOf(-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0), CasFormat.ticks(-3.0, 3.0, 6))
        assertEquals(listOf(0.0, 20.0, 40.0, 60.0, 80.0, 100.0), CasFormat.ticks(0.0, 100.0, 5))
        assertEquals(listOf(-0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3), CasFormat.ticks(-0.3, 0.3, 6))
        assertTrue(CasFormat.ticks(1.0, 1.0).isEmpty())
    }
}
