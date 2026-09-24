package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.llm.DocumentHandling
import de.maxifrz.lernwerk.llm.LlmCapabilities
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.OpenAiCompatibleClient
import de.maxifrz.lernwerk.plan.MaterialDocument
import de.maxifrz.lernwerk.present.ElementKind
import de.maxifrz.lernwerk.present.PlacedImage
import de.maxifrz.lernwerk.present.PptxWriter
import de.maxifrz.lernwerk.present.Presentation
import de.maxifrz.lernwerk.present.PresentationAssistant
import de.maxifrz.lernwerk.present.PresentationPrompt
import de.maxifrz.lernwerk.present.ShapeType
import de.maxifrz.lernwerk.present.Slide
import de.maxifrz.lernwerk.present.SlideElement
import de.maxifrz.lernwerk.present.SlideGeometry
import de.maxifrz.lernwerk.present.SlideLayout
import de.maxifrz.lernwerk.present.SlideLayouts
import de.maxifrz.lernwerk.present.SlideTheme
import de.maxifrz.lernwerk.tutor.DemoLlmClient
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File
import java.util.zip.ZipInputStream

class PresentationTest {
    private val text = "Die Kettenregel: äußere mal innere Ableitung, mit Beispielen."

    private class FakeDocument(override val pageTexts: List<String>) : MaterialDocument {
        override suspend fun recognizeText(pageNumber: Int) = ""
        override suspend fun pageImage(pageNumber: Int) = byteArrayOf(1)
    }

    @Test
    fun layoutsProduceEditableElements() {
        val bullets = SlideLayouts.preset(SlideLayout.BULLETS)
        val body = bullets.elements.single { it.kind == ElementKind.TEXT && it.bullets }
        assertEquals("Erster Punkt\nZweiter Punkt\nDritter Punkt", body.text)
        assertTrue(bullets.elements.all { it.x >= 0 && it.x + it.width <= 960 && it.y >= 0 && it.y + it.height <= 540 })
        assertTrue(SlideLayouts.preset(SlideLayout.BLANK).elements.isEmpty())
        val withoutImage = SlideLayouts.preset(SlideLayout.IMAGE_TEXT)
        assertTrue(withoutImage.elements.any { it.kind == ElementKind.SHAPE && it.shape == ShapeType.ROUNDED })
    }

    @Test
    fun rotatedHitTesting() {
        val element = SlideElement(kind = ElementKind.SHAPE, x = 100f, y = 100f, width = 200f, height = 20f, rotation = 90f)
        // Rotated by 90° around its center (200, 110) the bar now stands upright.
        assertTrue(element.contains(200f, 190f))
        assertFalse(element.contains(290f, 110f))
        val (lx, ly) = element.toLocal(200f, 190f)
        val (sx, sy) = element.toSlide(lx, ly)
        assertEquals(200f, sx, 0.01f)
        assertEquals(190f, sy, 0.01f)
    }

    @Test
    fun resizeKeepsTheOppositeCorner() {
        val base = SlideElement(kind = ElementKind.SHAPE, x = 100f, y = 100f, width = 200f, height = 100f, rotation = 30f)
        val anchor = SlideGeometry.corner(base, SlideGeometry.Corner.TOP_LEFT)
        val (tx, ty) = base.toSlide(260f, 150f)
        val resized = SlideGeometry.resize(base, SlideGeometry.Corner.BOTTOM_RIGHT, tx, ty, keepAspect = false)
        assertEquals(260f, resized.width, 0.01f)
        assertEquals(150f, resized.height, 0.01f)
        val after = SlideGeometry.corner(resized, SlideGeometry.Corner.TOP_LEFT)
        assertEquals(anchor.first, after.first, 0.01f)
        assertEquals(anchor.second, after.second, 0.01f)

        val image = base.copy(kind = ElementKind.IMAGE, rotation = 0f)
        val scaled = SlideGeometry.resize(image, SlideGeometry.Corner.BOTTOM_RIGHT, 500f, 150f, keepAspect = true)
        assertEquals(2f, scaled.width / scaled.height, 0.001f)
        // Never collapses to nothing.
        assertEquals(SlideGeometry.MIN_SIZE, SlideGeometry.resize(base.copy(rotation = 0f), SlideGeometry.Corner.BOTTOM_RIGHT, 0f, 0f, false).width, 0.01f)
    }

    @Test
    fun linesRotateAndSnap() {
        val line = SlideElement(kind = ElementKind.SHAPE, x = 100f, y = 90f, width = 200f, height = 20f, shape = ShapeType.ARROW)
        val moved = SlideGeometry.moveLineEnd(line, start = false, px = 100f, py = 300f)
        assertEquals(90f, moved.rotation, 0.01f)
        assertEquals(200f, moved.width, 0.01f)
        val (sx, sy) = moved.toSlide(0f, moved.height / 2)
        assertEquals(100f, sx, 0.01f)
        assertEquals(100f, sy, 0.01f)

        val box = SlideElement(kind = ElementKind.SHAPE, x = 380f, y = 200f, width = 200f, height = 100f)
        assertEquals(0f, SlideGeometry.rotation(box, 482f, 0f), 0.01f)
        assertEquals(90f, SlideGeometry.rotation(box, 800f, 252f), 0.01f)

        val snap = SlideGeometry.snap(box.copy(x = 377f), emptyList(), 6f)
        assertEquals(3f, snap.dx, 0.01f)
        assertEquals(listOf(480f), snap.verticalGuides)
    }

    @Test
    fun deckParsingIsLenient() {
        val deck = PresentationPrompt.parseDeck(
            """{"title":"T","slides":[{"layout":"bullets","title":"A","bullets":["x",""," y "],"imagePage":"0","sourcePages":["2",3]},{"layout":"UNKNOWN","title":""},{"layout":"QUOTE","quote":"Q"}]}""",
        )
        assertEquals(2, deck.slides.size)
        assertEquals(SlideLayout.BULLETS, deck.slides[0].layout)
        assertEquals(listOf("x", "y"), deck.slides[0].bullets)
        assertNull(deck.slides[0].imagePage)
        assertEquals(listOf(2, 3), deck.slides[0].sourcePages)
        assertEquals(SlideLayout.QUOTE, deck.slides[1].layout)
    }

    @Test
    fun generationReadsMaterialAndAddsPageImages() = runTest {
        val reply = """{"title":"Ableiten","slides":[
            {"layout":"TITLE","title":"Ableiten","subtitle":"Mathe","notes":"Hallo","sourceMaterial":0,"sourcePages":[1]},
            {"layout":"IMAGE_TEXT","title":"Graph","bullets":["Steigung"],"imageMaterial":0,"imagePage":2,"notes":"Seht her","sourceMaterial":0,"sourcePages":[2]},
            {"layout":"IMAGE_TEXT","title":"Ohne Bild","bullets":["a"],"notes":"n"}]}"""
        val client = ScriptedClient(mutableListOf(reply), LlmCapabilities(true, DocumentHandling.TEXT_ONLY))
        val requested = mutableListOf<Pair<Int, Int>>()
        val presentation = PresentationAssistant(client).generate(
            materials = listOf(PresentationAssistant.Material("m1", "Skript", byteArrayOf(1))),
            topic = "Ableitungen",
            slideCount = 8,
            minutes = 10,
            themeId = SlideTheme.CHALK.id,
            openDocument = { FakeDocument(listOf(text, text)) },
            pageImage = { material, page -> requested += material to page; PlacedImage("page-$page.png", 0.75f) },
        )
        val request = client.requests.single()
        assertEquals(LlmPurpose.Presentation, request.purpose)
        val prompt = request.messages[0].content.filterIsInstance<LlmContent.Text>().joinToString("\n") { it.text }
        assertTrue(prompt.contains("--- Page 2 ---"))
        assertTrue(prompt.contains("Topic or focus: Ableitungen"))
        assertTrue(prompt.contains("about 8"))

        assertEquals("Ableiten", presentation.title)
        assertEquals("kreide", presentation.themeId)
        assertEquals(listOf(0 to 2), requested)
        val picture = presentation.slides[1].elements.single { it.kind == ElementKind.IMAGE }
        assertEquals("page-2.png", picture.image)
        // Fitted into the 400 × 340 box with the page's aspect ratio.
        assertEquals(0.75f, picture.width / picture.height, 0.001f)
        assertEquals(340f, picture.height, 0.01f)
        // An image layout without a page falls back to bullets.
        assertTrue(presentation.slides[2].elements.none { it.kind == ElementKind.IMAGE || it.shape == ShapeType.ROUNDED && it.kind == ElementKind.SHAPE })
        assertEquals("m1", presentation.slides[1].sources.single().materialId)
        assertEquals("Seht her", presentation.slides[1].notes)
    }

    @Test
    fun rewriteKeepsLayoutAndUnknownIds() = runTest {
        val slide = SlideLayouts.preset(SlideLayout.BULLETS)
        val title = slide.elements.first { it.kind == ElementKind.TEXT }
        val client = ScriptedClient(mutableListOf("""{"texts":[{"id":"${title.id}","text":"Kurz"},{"id":"unbekannt","text":"x"}]}"""))
        val result = PresentationAssistant(client).rewrite(slide, PresentationPrompt.Rewrite.SHORTER)
        assertEquals("Kurz", result.elements.first { it.id == title.id }.text)
        assertEquals(slide.elements.map { it.id }, result.elements.map { it.id })
        assertEquals(slide.elements[2].text, result.elements[2].text)
        val prompt = (client.requests[0].messages[0].content[0] as LlmContent.Text).text
        assertTrue(prompt.contains("<text id=\"${title.id}\" role=\"heading\">"))
        // Rewrites are answered while the student waits.
        assertTrue(OpenAiCompatibleClient.wantsFastAnswer(client.requests[0]))
    }

    @Test
    fun notesAreMatchedBySlideNumber() = runTest {
        val presentation = Presentation(title = "T", slides = List(3) { SlideLayouts.preset(SlideLayout.BULLETS) }, minutes = 6)
        val client = ScriptedClient(mutableListOf("""{"notes":[{"slide":1,"notes":"Eins"},{"slide":3,"notes":"Drei"}]}"""))
        val result = PresentationAssistant(client).speakerNotes(presentation)
        assertEquals(listOf("Eins", "", "Drei"), result.slides.map { it.notes })
        val prompt = (client.requests[0].messages[0].content[0] as LlmContent.Text).text
        assertTrue(prompt.contains("about 120 seconds per slide"))
    }

    @Test
    fun demoCoversEveryFeature() = runTest {
        val assistant = PresentationAssistant(DemoLlmClient(0))
        val deck = assistant.generate(
            listOf(PresentationAssistant.Material("m", "Demo", byteArrayOf(1))), "", 6, 5, "quill", { null }, { _, _ -> null },
        )
        assertEquals(6, deck.slides.size)
        val shorter = assistant.rewrite(deck.slides[1], PresentationPrompt.Rewrite.SHORTER)
        assertTrue(shorter.elements.filter { it.kind == ElementKind.TEXT }.all { it.text.lines().size <= 3 })
        assertEquals("Neu gestaltet", assistant.redesign(deck.slides[1]).elements.first { it.kind == ElementKind.TEXT }.text)
        assertTrue(assistant.speakerNotes(deck).slides.all { it.notes.startsWith("Demo-Notiz") })
        assertTrue(assistant.feedback(deck).contains("Fragen"))
    }

    @Test
    fun pptxContainsEveryPart() {
        val bytes = PptxWriter.write(samplePresentation()) { if (it == "bild.png") png() else null }
        val entries = unzip(bytes)
        listOf(
            "[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml", "ppt/slides/slide1.xml", "ppt/slides/slide3.xml",
            "ppt/notesSlides/notesSlide2.xml", "ppt/media/image1.png", "ppt/theme/theme1.xml", "ppt/notesMasters/notesMaster1.xml",
        ).forEach { assertTrue(it, it in entries) }
        val slide2 = entries.getValue("ppt/slides/slide2.xml")
        assertTrue(slide2.contains("""<a:buChar char="•"/>"""))
        assertTrue(slide2.contains("Äußere &amp; innere"))
        assertTrue(slide2.contains("""rot="1800000""""))
        assertTrue(entries.getValue("ppt/notesSlides/notesSlide2.xml").contains("Sprich langsam"))
        assertTrue(entries.getValue("ppt/slides/slide3.xml").contains("""<a:tailEnd type="triangle""""))
        assertTrue(entries.getValue("ppt/theme/theme1.xml").contains("2F4A3A"))

        // Written for the external check with python-pptx and LibreOffice.
        File("build/pptx").mkdirs()
        File("build/pptx/sample.pptx").writeBytes(bytes)
    }

    private fun samplePresentation(): Presentation {
        val bullets = SlideLayouts.preset(SlideLayout.BULLETS).let { slide ->
            slide.copy(
                elements = slide.elements.map {
                    if (it.bullets) it.copy(text = "Äußere & innere Ableitung\nx² → 2x\n\nNach Leerzeile") else it
                } + SlideElement(kind = ElementKind.SHAPE, x = 700f, y = 300f, width = 120f, height = 80f, rotation = 30f, shape = ShapeType.ELLIPSE, fill = "accent", stroke = "text", strokeWidth = 2f),
                notes = "Sprich langsam.\nZweite Zeile.",
            )
        }
        val picture = Slide(
            elements = listOf(
                SlideElement(kind = ElementKind.IMAGE, x = 80f, y = 60f, width = 300f, height = 200f, image = "bild.png"),
                SlideElement(kind = ElementKind.IMAGE, x = 400f, y = 60f, width = 300f, height = 200f, image = "fehlt.png"),
                SlideElement(kind = ElementKind.SHAPE, x = 100f, y = 400f, width = 300f, height = 20f, rotation = -15f, shape = ShapeType.ARROW, fill = "#C46A55"),
                SlideLayouts.text("Pfeil", 420f, 390f, 200f, 40f, 20f, color = "muted"),
            ),
        )
        return Presentation(
            title = "Test <&>",
            themeId = SlideTheme.CHALK.id,
            slides = listOf(SlideLayouts.preset(SlideLayout.TITLE), bullets, picture),
        )
    }

    /** A 60 × 40 checkerboard PNG. */
    private fun png(): ByteArray = java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAIAAAAt2Q6oAAAATUlEQVR42u3XsQ0AIAwDsH7OAzzClbAwZ6oEg6uskTymNdYM2fFedQsaGhoaGrod/Scrd6GhoaGhofvRtgc0NDQ0NLQfERoaGhoa+uYAZZ/+7NBoFAsAAAAASUVORK5CYII=")

    private fun unzip(bytes: ByteArray): Map<String, String> {
        val entries = mutableMapOf<String, String>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                entries[entry.name] = zip.readBytes().toString(Charsets.ISO_8859_1).let {
                    if (entry.name.endsWith(".png")) it else String(it.toByteArray(Charsets.ISO_8859_1), Charsets.UTF_8)
                }
            }
        }
        return entries
    }
}
