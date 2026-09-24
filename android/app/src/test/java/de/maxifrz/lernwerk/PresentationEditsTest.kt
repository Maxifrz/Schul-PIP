package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.OpenAiCompatibleClient
import de.maxifrz.lernwerk.present.ElementKind
import de.maxifrz.lernwerk.present.Finding
import de.maxifrz.lernwerk.present.PptxReader
import de.maxifrz.lernwerk.present.PptxWriter
import de.maxifrz.lernwerk.present.Presentation
import de.maxifrz.lernwerk.present.PresentationChat
import de.maxifrz.lernwerk.present.PresentationCritic
import de.maxifrz.lernwerk.present.PresentationEdits
import de.maxifrz.lernwerk.present.ShapeType
import de.maxifrz.lernwerk.present.Slide
import de.maxifrz.lernwerk.present.SlideChange
import de.maxifrz.lernwerk.present.SlideDraft
import de.maxifrz.lernwerk.present.SlideElement
import de.maxifrz.lernwerk.present.SlideLayout
import de.maxifrz.lernwerk.present.SlideLayouts
import de.maxifrz.lernwerk.present.TextAlign
import de.maxifrz.lernwerk.tutor.DemoLlmClient
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PresentationEditsTest {
    private fun deck(): Presentation {
        val picture = Slide(
            elements = SlideLayouts.build(SlideDraft(SlideLayout.BULLETS, title = "Bild", bullets = listOf("a"))) +
                SlideElement(kind = ElementKind.IMAGE, x = 10f, y = 10f, width = 200f, height = 100f, image = "pic.png"),
        )
        return Presentation(
            title = "Deck",
            slides = listOf(SlideLayouts.preset(SlideLayout.TITLE), SlideLayouts.preset(SlideLayout.BULLETS), picture),
        )
    }

    @Test
    fun stateShowsIdsForSlidesAndTexts() {
        val deck = deck()
        val state = PresentationEdits.state(deck)
        assertTrue(state.contains("<slide number=\"2\" id=\"${deck.slides[1].id}\">"))
        val body = deck.slides[1].elements.first { it.bullets }
        assertTrue(state.contains("<text id=\"${body.id}\" role=\"bullets\">"))
        assertTrue(state.contains("<pictures count=\"1\"/>"))
    }

    @Test
    fun changesApplyByIdInOrder() {
        val deck = deck()
        val (first, second, third) = deck.slides
        val body = second.elements.first { it.bullets }
        val result = PresentationEdits.apply(
            deck,
            listOf(
                SlideChange(SlideChange.Action.UPDATE_TEXTS, slideId = second.id, texts = mapOf(body.id to "Neu\nZwei")),
                SlideChange(SlideChange.Action.INSERT_SLIDE, afterSlideId = first.id, draft = SlideDraft(SlideLayout.SECTION, title = "Teil 1")),
                SlideChange(SlideChange.Action.INSERT_SLIDE, afterSlideId = "", draft = SlideDraft(SlideLayout.IMAGE_TEXT, title = "Vorne", bullets = listOf("x"))),
                SlideChange(SlideChange.Action.REPLACE_SLIDE, slideId = third.id, draft = SlideDraft(SlideLayout.IMAGE_TEXT, title = "Mit Bild", bullets = listOf("b"), notes = "N")),
                SlideChange(SlideChange.Action.MOVE_SLIDE, slideId = third.id, position = 1),
                SlideChange(SlideChange.Action.SET_NOTES, slideId = first.id, notes = " Hallo "),
                SlideChange(SlideChange.Action.SET_THEME, theme = "Kreide"),
                SlideChange(SlideChange.Action.RENAME, title = "Neuer Titel"),
                SlideChange(SlideChange.Action.DELETE_SLIDE, slideId = "gibt-es-nicht"),
                SlideChange(SlideChange.Action.UPDATE_TEXTS, slideId = second.id, texts = mapOf("unbekannt" to "x")),
            ),
        )
        val slides = result.presentation.slides
        assertEquals(8, result.applied.size)
        assertEquals(2, result.skipped.size)
        assertEquals(5, slides.size)
        assertEquals(third.id, slides[0].id)
        assertEquals("pic.png", slides[0].elements.single { it.kind == ElementKind.IMAGE }.image)
        assertEquals("N", slides[0].notes)
        // The inserted image layout has no picture, so it became bullets.
        assertTrue(slides[1].elements.none { it.kind == ElementKind.IMAGE || it.shape == ShapeType.ROUNDED && it.kind == ElementKind.SHAPE })
        assertEquals(first.id, slides[2].id)
        assertEquals("Hallo", slides[2].notes)
        assertEquals("Teil 1", slides[3].elements.first { it.kind == ElementKind.TEXT }.text)
        assertEquals("Neu\nZwei", slides[4].elements.first { it.id == body.id }.text)
        assertEquals("kreide", result.presentation.themeId)
        assertEquals("Neuer Titel", result.presentation.title)
    }

    @Test
    fun theLastSlideIsNeverDeleted() {
        val one = Presentation(title = "T", slides = listOf(Slide()))
        val result = PresentationEdits.apply(one, listOf(SlideChange(SlideChange.Action.DELETE_SLIDE, slideId = one.slides[0].id)))
        assertEquals(1, result.presentation.slides.size)
        assertEquals(1, result.skipped.size)
    }

    @Test
    fun parsingIsLenient() {
        val reply = PresentationEdits.parseChat(
            """{"message":" Erledigt ","changes":[{"action":"SET_THEME","theme":"nacht","summary":"Dunkel"},{"action":"fly"},{"action":"insert_slide","afterSlideId":"a","slide":{"layout":"bullets","title":"X","bullets":["1"]}},{"action":"move_slide","slideId":"s","position":"2"}]}""",
        )
        assertEquals("Erledigt", reply.message)
        assertEquals(3, reply.changes.size)
        assertEquals(SlideLayout.BULLETS, reply.changes[1].draft?.layout)
        assertEquals(2, reply.changes[2].position)

        val critique = PresentationEdits.parseCritique(
            """{"verdict":"Zu viel Text.","findings":[{"severity":"HIGH","slideId":"s1","problem":"P","suggestion":"S","changes":[{"action":"set_notes","slideId":"s1","notes":"n"}]},{"severity":"x","problem":"Q","suggestion":""},{"problem":""}]}""",
        )
        assertEquals(2, critique.findings.size)
        assertEquals(Finding.Severity.HIGH, critique.findings[0].severity)
        assertEquals(Finding.Severity.MEDIUM, critique.findings[1].severity)
        assertEquals(1, critique.findings[0].changes.size)
    }

    @Test
    fun chatSendsMaterialOnceAndStateEveryTime() = runTest {
        val client = ScriptedClient(mutableListOf("""{"message":"Ok","changes":[]}""", """{"message":"Auch","changes":[]}"""))
        val chat = PresentationChat(client)
        val deck = deck()
        chat.send(deck, "Mach Folie 2 kürzer", listOf(LlmContent.Text("MATERIAL")))
        chat.send(deck, "Und jetzt dunkler")
        val first = client.requests[0]
        val second = client.requests[1]
        assertEquals(LlmPurpose.PresentationChat, first.purpose)
        assertTrue(OpenAiCompatibleClient.wantsFastAnswer(first))
        val lastTurn = second.messages.last().content.filterIsInstance<LlmContent.Text>().joinToString { it.text }
        assertTrue(lastTurn.contains("<presentation") && lastTurn.contains("Und jetzt dunkler"))
        assertFalse(lastTurn.contains("MATERIAL"))
        // Earlier turns stay short: the old state is not repeated.
        val history = second.messages.dropLast(1).flatMap { it.content }.filterIsInstance<LlmContent.Text>().joinToString { it.text }
        assertFalse(history.contains("<presentation"))
        assertTrue(history.contains("MATERIAL") && history.contains("Mach Folie 2 kürzer"))
    }

    @Test
    fun critiqueThinksLongerAndDemoChangesApply() = runTest {
        val client = ScriptedClient(mutableListOf("""{"verdict":"V","findings":[]}"""))
        PresentationCritic(client).critique(deck())
        assertEquals(LlmPurpose.PresentationCritique, client.requests[0].purpose)
        assertFalse(OpenAiCompatibleClient.wantsFastAnswer(client.requests[0]))

        val deck = deck()
        val demo = PresentationCritic(DemoLlmClient(0)).critique(deck)
        val all = demo.findings.flatMap { it.changes }
        val result = PresentationEdits.apply(deck, all)
        assertTrue(result.skipped.isEmpty())
        assertEquals(4, result.presentation.slides.size)
        val reply = PresentationChat(DemoLlmClient(0)).send(deck, "egal")
        assertEquals(deck.slides.last().id, reply.changes.single().slideId)
    }
}

class PptxReaderTest {
    private fun fixture(name: String) = javaClass.classLoader!!.getResourceAsStream("fixtures/$name")!!.readBytes()

    @Test
    fun readsPlaceholdersBulletsShapesAndNotes() {
        val imported = PptxReader.read(fixture("school.pptx"), "Referat")
        val slides = imported.presentation.slides
        assertEquals(3, slides.size)

        // 4:3 slides (720 × 540 pt) are centered in 960 × 540.
        val title = slides[0].elements.first { it.text == "Photosynthese" }
        assertEquals(TextAlign.CENTER, title.align)
        assertTrue(title.fontSize >= 40f)
        assertTrue(title.x > 120f && title.x + title.width < 840f)
        assertTrue(slides[0].elements.any { it.text == "Biologie · Referat" && !it.bullets })
        assertEquals("Begrüßung und Thema nennen.", slides[0].notes)

        val body = slides[1].elements.first { it.bullets }
        assertEquals("Lichtreaktion\n– in den Thylakoiden\nCalvin-Zyklus", body.text)
        assertEquals("Zwei Phasen erklären.\nDann Beispiel.", slides[1].notes)

        val third = slides[2]
        assertEquals("#203040", third.background)
        val picture = third.elements.single { it.kind == ElementKind.IMAGE }
        assertNotNull(imported.media[picture.image])
        assertEquals(120f + 36f, picture.x, 0.5f)
        assertEquals(216f, picture.width, 0.5f)
        val important = third.elements.first { it.text == "Wichtig!" }
        assertTrue(important.bold)
        assertEquals("#FFCC00", important.textColor)
        assertEquals(40f, important.fontSize, 0.1f)
        assertTrue(third.elements.any { it.text == "Edukt | Produkt\nCO₂ | Glucose" })
        val oval = third.elements.first { it.kind == ElementKind.SHAPE && it.shape == ShapeType.ELLIPSE }
        assertEquals("#3D6FB6", oval.fill)
        assertEquals("#FFFFFF", third.elements.first { it.text == "Chloroplast" }.textColor)
        val arrow = third.elements.single { it.shape == ShapeType.ARROW }
        assertEquals("#C46A55", arrow.fill)
        assertTrue(arrow.rotation < 0f) // it points up and to the right

        // Written back out for a visual check with LibreOffice.
        File("build/pptx").mkdirs()
        File("build/pptx/imported.pptx").writeBytes(PptxWriter.write(imported.presentation) { imported.media[it] })
    }

    @Test
    fun ownExportRoundTrips() {
        val original = Presentation(
            title = "Rund",
            slides = listOf(
                SlideLayouts.preset(SlideLayout.BULLETS).copy(notes = "Notiz"),
                Slide(elements = listOf(SlideElement(kind = ElementKind.SHAPE, x = 100f, y = 200f, width = 300f, height = 20f, rotation = 30f, shape = ShapeType.ARROW, fill = "#C46A55", strokeWidth = 4f))),
            ),
        )
        val back = PptxReader.read(PptxWriter.write(original) { null }, "Rund").presentation
        val body = back.slides[0].elements.first { it.bullets }
        val source = original.slides[0].elements.first { it.bullets }
        assertEquals(source.text, body.text)
        assertEquals(source.fontSize, body.fontSize, 0.1f)
        assertEquals(source.x, body.x, 0.5f)
        assertEquals("Notiz", back.slides[0].notes)
        val arrow = back.slides[1].elements.single()
        assertEquals(30f, arrow.rotation, 0.5f)
        assertEquals(300f, arrow.width, 0.5f)
        assertEquals(250f, arrow.centerX, 0.5f)
    }

    @Test
    fun readsLibreOfficeFiles() {
        val imported = PptxReader.read(fixture("libreoffice.pptx"), "LO")
        assertEquals(3, imported.presentation.slides.size)
        assertTrue(imported.presentation.slides[1].elements.any { it.text.contains("Äußere & innere Ableitung") })
        assertEquals("Sprich langsam.\nZweite Zeile.", imported.presentation.slides[1].notes)
    }
}
