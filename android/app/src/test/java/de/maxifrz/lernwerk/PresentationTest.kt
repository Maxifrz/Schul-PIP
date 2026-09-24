package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.llm.DocumentHandling
import de.maxifrz.lernwerk.llm.LlmCapabilities
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.OpenAiCompatibleClient
import de.maxifrz.lernwerk.plan.MaterialDocument
import de.maxifrz.lernwerk.present.ChartDraft
import de.maxifrz.lernwerk.present.ChartKind
import de.maxifrz.lernwerk.present.DraftItem
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
import de.maxifrz.lernwerk.present.SlideDraft
import de.maxifrz.lernwerk.present.SlideSize
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
    fun generationPlansWritesAndReviews() = runTest {
        val outline = """{"title":"Ableiten","thesis":"Ableiten misst Steigung.","slides":[
            {"role":"title","message":"Ableiten","layout":"TITLE","content":""},
            {"role":"core","message":"Der Graph zeigt die Steigung","layout":"IMAGE_TEXT","content":"Seite 2"},
            {"role":"core","message":"Ohne Bild","layout":"IMAGE_FULL","content":"x"}]}"""
        val reply = """{"title":"Ableiten","slides":[
            {"layout":"TITLE","title":"Ableiten","subtitle":"Mathe","notes":"Hallo","sourceMaterial":0,"sourcePages":[1]},
            {"layout":"IMAGE_TEXT","title":"Graph","bullets":["Steigung"],"imageMaterial":0,"imagePage":2,"notes":"Seht her","sourceMaterial":0,"sourcePages":[2]},
            {"layout":"IMAGE_FULL","title":"Ohne Bild","bullets":["a"],"notes":"n"}]}"""
        val critique = """{"verdict":"V","findings":[
            {"severity":"high","problem":"P","suggestion":"S","changes":[{"action":"rename","title":"Ableiten verstehen","summary":"s"}]},
            {"severity":"low","problem":"Q","suggestion":"S","changes":[{"action":"set_theme","theme":"nacht","summary":"s"}]}]}"""
        val client = ScriptedClient(mutableListOf(outline, reply, critique), LlmCapabilities(true, DocumentHandling.TEXT_ONLY))
        val requested = mutableListOf<Pair<Int, Int>>()
        val stages = mutableListOf<PresentationAssistant.Stage>()
        val presentation = PresentationAssistant(client).generate(
            materials = listOf(PresentationAssistant.Material("m1", "Skript", byteArrayOf(1))),
            topic = "Ableitungen",
            slideCount = 8,
            minutes = 10,
            themeId = SlideTheme.CHALK.id,
            openDocument = { FakeDocument(listOf(text, text)) },
            pageImage = { material, page -> requested += material to page; PlacedImage("page-$page.png", 0.75f) },
            onStage = { stages += it },
        )
        assertEquals(PresentationAssistant.Stage.entries, stages)
        assertEquals(listOf(LlmPurpose.PresentationOutline, LlmPurpose.Presentation, LlmPurpose.PresentationCritique), client.requests.map { it.purpose })
        val prompt = client.requests[0].messages[0].content.filterIsInstance<LlmContent.Text>().joinToString("\n") { it.text }
        assertTrue(prompt.contains("--- Page 2 ---"))
        assertTrue(prompt.contains("Topic or focus: Ableitungen"))
        assertTrue(prompt.contains("about 8"))
        // The slides are written in the same conversation, after the model's own outline.
        val second = client.requests[1].messages
        assertEquals(listOf(LlmRole.USER, LlmRole.ASSISTANT, LlmRole.USER), second.map { it.role })
        assertTrue((second[1].content.single() as LlmContent.Text).text.contains("2. [IMAGE_TEXT] (core) Der Graph zeigt die Steigung"))
        // The critic checks against the material, without the planning instructions.
        val critic = client.requests[2].messages.single().content.filterIsInstance<LlmContent.Text>().joinToString("\n") { it.text }
        assertTrue(critic.contains("--- Page 2 ---") && !critic.contains("Topic or focus"))

        // High findings are applied, low ones are left to the student.
        assertEquals("Ableiten verstehen", presentation.title)
        assertEquals("kreide", presentation.themeId)
        assertEquals(listOf(0 to 2), requested)
        val picture = presentation.slides[1].elements.single { it.kind == ElementKind.IMAGE }
        assertEquals("page-2.png", picture.image)
        // Fitted into the 420 × 340 box with the page's aspect ratio.
        assertEquals(0.75f, picture.width / picture.height, 0.001f)
        assertEquals(340f, picture.height, 0.01f)
        // A picture layout without a page falls back to bullets.
        assertTrue(presentation.slides[2].elements.none { it.kind == ElementKind.IMAGE || it.shape == ShapeType.ROUNDED && it.kind == ElementKind.SHAPE })
        assertTrue(presentation.slides[2].elements.any { it.bullets && it.text == "a" })
        assertEquals("m1", presentation.slides[1].sources.single().materialId)
        assertEquals("Seht her", presentation.slides[1].notes)
    }

    @Test
    fun aFailedReviewKeepsTheDraft() = runTest {
        val outline = """{"title":"T","thesis":"t","slides":[{"role":"core","message":"M","layout":"BULLETS","content":""}]}"""
        val reply = """{"title":"T","slides":[{"layout":"BULLETS","title":"M","bullets":["a"],"notes":"n"}]}"""
        val client = ScriptedClient(mutableListOf(outline, reply, "kaputt", "immer noch kaputt"))
        val presentation = PresentationAssistant(client).generate(
            listOf(PresentationAssistant.Material("m", "Demo", byteArrayOf(1))), "", 6, 5, "quill", { FakeDocument(listOf(text)) }, { _, _ -> null },
        )
        assertEquals(1, presentation.slides.size)
        assertEquals(4, client.requests.size)
    }

    @Test
    fun visualLayoutsStayOnTheSlide() {
        for (layout in SlideLayout.entries) {
            for (element in SlideLayouts.preset(layout).elements) {
                assertTrue("$layout ${element.text}", element.x >= 0f && element.y >= 0f)
                assertTrue("$layout ${element.text}", element.x + element.width <= SlideSize.WIDTH + 0.01f)
                assertTrue("$layout ${element.text}", element.y + element.height <= SlideSize.HEIGHT + 0.01f)
            }
        }
    }

    @Test
    fun textShrinksToFitItsBox() {
        assertEquals(36f, SlideLayouts.fitSize("Kurz", 800f, 90f, 36f, 24f), 0.01f)
        val long = "Die Lichtreaktion wandelt Lichtenergie in chemische Energie um und findet in den Thylakoiden statt"
        val size = SlideLayouts.fitSize(long, 832f, 90f, 36f, 20f, bold = true)
        assertTrue(size < 36f && size >= 20f)
        assertTrue(SlideLayouts.fits(long, 832f, 90f, size, bold = true, bullets = false))
        assertEquals(3, SlideLayouts.lineCount("a\nb\nc", 500f, 20f, false))
        // One very long word wraps over several lines.
        assertEquals(2, SlideLayouts.lineCount("x".repeat(30), 20f * 0.54f * 20, 20f, false))
    }

    @Test
    fun chartsAreDrawnFromTheNumbers() {
        val bars = SlideLayouts.chart(ChartDraft(ChartKind.BAR, listOf("A", "B", "C"), listOf(10.0, 20.0, -5.0), "%"))
        val rects = bars.filter { it.kind == ElementKind.SHAPE && it.shape == ShapeType.RECT }
        assertEquals(3, rects.size)
        assertEquals(2f, rects[1].height / rects[0].height, 0.01f)
        val zero = bars.first { it.shape == ShapeType.LINE }.centerY
        assertEquals(zero, rects[0].y + rects[0].height, 0.01f)
        assertEquals(zero, rects[2].y, 0.01f)
        assertTrue(bars.any { it.text == "20 %" } && bars.any { it.text == "−5 %" })

        val line = SlideLayouts.chart(ChartDraft(ChartKind.LINE, listOf("1", "2", "3"), listOf(1.0, 4.0, 13.0)))
        val segments = line.filter { it.shape == ShapeType.LINE }.drop(1)
        val dots = line.filter { it.shape == ShapeType.ELLIPSE }
        assertEquals(2, segments.size)
        assertEquals(3, dots.size)
        // Each segment runs from one dot to the next.
        val (sx, sy) = segments[0].toSlide(0f, segments[0].height / 2)
        val (ex, ey) = segments[0].toSlide(segments[0].width, segments[0].height / 2)
        assertEquals(dots[0].centerX, sx, 0.1f)
        assertEquals(dots[0].centerY, sy, 0.1f)
        assertEquals(dots[1].centerX, ex, 0.1f)
        assertEquals(dots[1].centerY, ey, 0.1f)
    }

    @Test
    fun layoutsFallBackWhenContentIsMissing() {
        fun kinds(draft: SlideDraft, image: PlacedImage? = null) = SlideLayouts.resolve(draft, image).layout
        assertEquals(SlideLayout.BULLETS, kinds(SlideDraft(SlideLayout.CHART, title = "T", chart = ChartDraft(labels = listOf("A"), values = listOf(1.0)))))
        assertEquals(SlideLayout.BULLETS, kinds(SlideDraft(SlideLayout.CARDS, title = "T", items = listOf(DraftItem("Nur", "eins")))))
        assertEquals(SlideLayout.STATEMENT, kinds(SlideDraft(SlideLayout.IMAGE_FULL, title = "T")))
        assertEquals(SlideLayout.IMAGE_FULL, kinds(SlideDraft(SlideLayout.IMAGE_FULL, title = "T"), PlacedImage("p.png", 1.5f)))
        assertEquals(SlideLayout.STATEMENT, kinds(SlideDraft(SlideLayout.BIG_NUMBER, title = "T")))
        assertEquals(SlideLayout.BULLETS, kinds(SlideDraft(SlideLayout.TABLE, title = "T", table = listOf(listOf("a", "b")))))
        val chart = SlideLayouts.resolve(SlideDraft(SlideLayout.CHART, title = "T", chart = ChartDraft(labels = listOf("A"), values = listOf(1.5), unit = "%")), null)
        assertEquals(listOf("A: 1,5 %"), chart.bullets)
    }

    @Test
    fun numbersAndIconsAreFormatted() {
        assertEquals("1.500", SlideLayouts.formatNumber(1500.0))
        assertEquals("2,5", SlideLayouts.formatNumber(2.5))
        assertEquals("−3", SlideLayouts.formatNumber(-3.0))
        assertEquals("0,13", SlideLayouts.formatNumber(0.125))
        assertEquals("1.234.567,89", SlideLayouts.formatNumber(1234567.891))
        assertEquals("🧪", SlideLayouts.icon(" 🧪 "))
        assertEquals("⚡️", SlideLayouts.icon("⚡️"))
        assertNull(SlideLayouts.icon("Labor"))
        assertNull(SlideLayouts.icon(""))
    }

    @Test
    fun newSlideTypesAreParsed() {
        val deck = PresentationPrompt.parseDeck(
            """{"title":"T","slides":[
            {"layout":"chart","title":"C","chart":{"kind":"line","labels":["2020","2021"],"values":[1.5,"2,5 %"],"unit":"%"}},
            {"layout":"CARDS","title":"K","items":[{"title":"A","text":"a","icon":"🌱"},{"title":"","text":""},{"title":"B"}]},
            {"layout":"TABLE","title":"T","table":[["a","b"],[" c ","d"],["",""]]},
            {"layout":"BIG_NUMBER","title":"N","value":" 70 % ","subtitle":"s"}]}""",
        )
        val chart = deck.slides[0].chart!!
        assertEquals(ChartKind.LINE, chart.kind)
        assertEquals(listOf(1.5, 2.5), chart.values)
        assertEquals(listOf(DraftItem("A", "a", "🌱"), DraftItem("B", "", "")), deck.slides[1].items)
        assertEquals(listOf(listOf("a", "b"), listOf("c", "d")), deck.slides[2].table)
        assertEquals("70 %", deck.slides[3].value)
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
        // The demo critic inserts an exercise slide before the summary.
        assertEquals(11, deck.slides.size)
        assertTrue(deck.slides.any { slide -> slide.elements.any { it.text == "Probier es selbst" } })
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
