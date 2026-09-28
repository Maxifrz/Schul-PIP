package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.present.ElementKind
import de.maxifrz.lernwerk.present.Presentation
import de.maxifrz.lernwerk.present.PresentationPrompt
import de.maxifrz.lernwerk.present.PptxWriter
import de.maxifrz.lernwerk.present.SlideDesign
import de.maxifrz.lernwerk.present.SlideDraft
import de.maxifrz.lernwerk.present.SlideElement
import de.maxifrz.lernwerk.present.SlideFont
import de.maxifrz.lernwerk.present.SlideLayout
import de.maxifrz.lernwerk.present.SlideLayouts
import de.maxifrz.lernwerk.present.SlideTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/** Mirrors SlideDesignTests.swift: both apps must pick the same fonts, sizes, colors and decorations. */
class SlideDesignTest {
    private fun contrast(a: Long, b: Long): Double {
        fun luminance(rgb: Long): Double {
            val channels = listOf(16, 8, 0).map { ((rgb shr it) and 0xFF) / 255.0 }
            val linear = channels.map { if (it <= 0.03928) it / 12.92 else ((it + 0.055) / 1.055).pow(2.4) }
            return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
        }
        val x = luminance(a)
        val y = luminance(b)
        return (max(x, y) + 0.05) / (min(x, y) + 0.05)
    }

    private fun SlideElement.intersects(x: Float, y: Float, width: Float, height: Float) =
        this.x < x + width && this.x + this.width > x && this.y < y + height && this.y + this.height > y

    @Test
    fun mixMatchesTheIosApp() {
        assertEquals(0x808080L, SlideDesign.mix(0xFFFFFF, 0x000000, 50))
        assertEquals(0xD7E0E4L, SlideDesign.mix(0xF7F5F0, 0x155F99, 14))
        assertEquals(0x11243DL, SlideDesign.mix(0x0B1A2E, 0x5B9BE6, 8))
        assertEquals("#0A0B0C", SlideDesign.hex(0x0A0B0C))
    }

    @Test
    fun designsAreUniqueAndReadable() {
        val ids = SlideTheme.all.map { it.id }
        assertEquals(ids.size, ids.toSet().size)
        assertEquals(17, SlideTheme.all.size)
        for (theme in SlideTheme.all) {
            assertTrue(theme.id, contrast(theme.text, theme.background) >= 7)
            assertTrue(theme.id, contrast(theme.text, theme.surface) >= 6.5)
            assertTrue(theme.id, theme.mood.isNotEmpty())
        }
        // The new designs also use their accent for text and numbers; Quill's soft green predates that rule.
        for (theme in SlideTheme.all.drop(4)) assertTrue(theme.id, contrast(theme.accent, theme.background) >= 4.5)
    }

    @Test
    fun originalDesignsKeepTheirLook() {
        for (theme in listOf(SlideTheme.QUILL, SlideTheme.NIGHT, SlideTheme.CHALK, SlideTheme.PAPER)) {
            assertEquals(SlideFont.WORK_SANS, theme.heading)
            assertEquals(SlideFont.WORK_SANS, theme.body)
            assertTrue(SlideDesign.decor(theme, 0).isEmpty())
        }
    }

    @Test
    fun decorationsStayClearOfTheContent() {
        for (theme in SlideTheme.all) {
            for (element in SlideDesign.decor(theme, 0).filter { it.fill == "accent" }) {
                assertFalse("${theme.id} title ${element.id}", element.intersects(100f, 140f, 760f, 290f))
            }
            for (element in SlideDesign.decor(theme, 3)) {
                // Solid shapes keep to the edges; tinted ones may reach behind text but never cover the middle.
                if (element.fill == "accent") assertFalse("${theme.id} ${element.id}", element.intersects(64f, 30f, 832f, 460f))
                if (element.fill != "none") assertFalse("${theme.id} ${element.id}", element.contains(480f, 300f))
            }
        }
        assertEquals(3, SlideDesign.decor(SlideTheme.EDITORIAL, 0).size)
        assertEquals(1, SlideDesign.decor(SlideTheme.EDITORIAL, 5).size)
        assertEquals(SlideDesign.hex(SlideDesign.mix(0xF7F5F0, 0x155F99, 40)), SlideDesign.decor(SlideTheme.EDITORIAL, 5)[0].stroke)
    }

    @Test
    fun headingsUseTheHeadingFontAtAMatchingSize() {
        fun text(size: Float, bold: Boolean = false, italic: Boolean = false, font: String = "") =
            SlideElement(kind = ElementKind.TEXT, x = 0f, y = 0f, width = 100f, height = 50f, text = "T", fontSize = size, bold = bold, italic = italic, font = font)
        val title = text(36f, bold = true, font = "heading")
        val body = text(24f)
        assertEquals("playfairdisplay_bold", SlideDesign.fontFile(title, SlideTheme.EDITORIAL))
        assertEquals(33.48f, SlideDesign.fontSize(title, SlideTheme.EDITORIAL))
        assertEquals("dmsans_regular", SlideDesign.fontFile(body, SlideTheme.EDITORIAL))
        assertEquals(22.8f, SlideDesign.fontSize(body, SlideTheme.EDITORIAL))
        assertEquals("dmsans_italic", SlideDesign.fontFile(text(24f, italic = true), SlideTheme.EDITORIAL))
        assertEquals("montserrat_bold", SlideDesign.fontFile(text(40f, bold = true), SlideTheme.NOVA))
        assertEquals("worksans_semibold", SlideDesign.fontFile(title, SlideTheme.QUILL))
        assertEquals(24f, SlideDesign.fontSize(body, SlideTheme.QUILL))
    }

    @Test
    fun layoutsMarkTitlesAsHeadings() {
        val slide = SlideLayouts.build(SlideDraft(SlideLayout.BULLETS, title = "Titel", bullets = listOf("a", "b")))
        assertEquals("heading", slide.first { it.kind == ElementKind.TEXT }.font)
        assertEquals("", slide.last { it.kind == ElementKind.TEXT }.font)
    }

    @Test
    fun automaticDesignFollowsTheSubject() {
        assertEquals("verdant", SlideDesign.suggest("Photosynthese in der Biologie"))
        assertEquals("nova", SlideDesign.suggest("Schwarze Löcher – Astronomie und Physik"))
        assertEquals("quill", SlideDesign.suggest("Irgendwas"))
        assertEquals("nova", SlideDesign.resolve(" NOVA ", "Biologie"))
        assertEquals("verdant", SlideDesign.resolve("unbekannt", "Biologie"))
        assertTrue(PresentationPrompt.designInstructions.contains("- verdant: Verdant – Biologie"))
        val outline = PresentationPrompt.parseOutline("""{"title":"T","thesis":"X","design":"glut","slides":[{"role":"r","message":"m","layout":"TITLE","content":""}]}""")
        assertEquals("glut", outline.design)
    }

    private fun slideXml(presentation: Presentation): String {
        ZipInputStream(ByteArrayInputStream(PptxWriter.write(presentation) { null })).use { zip ->
            val out = StringBuilder()
            while (true) {
                val entry = zip.nextEntry ?: break
                if (entry.name.startsWith("ppt/slides/slide")) out.append(String(zip.readBytes(), Charsets.UTF_8))
            }
            return out.toString()
        }
    }

    @Test
    fun pptxUsesTheDesignFontsAndDecorations() {
        val slides = listOf(SlideLayouts.preset(SlideLayout.TITLE), SlideLayouts.preset(SlideLayout.BULLETS))
        val xml = slideXml(Presentation(title = "T", themeId = SlideTheme.EDITORIAL.id, slides = slides))
        assertTrue(xml.contains("""typeface="Playfair Display""""))
        assertTrue(xml.contains("""typeface="DM Sans""""))
        assertTrue(xml.contains("<a:lnSpc><a:spcPts"))
        assertFalse(xml.contains("""typeface="Work Sans""""))
        val plain = slideXml(Presentation(title = "T", slides = slides))
        assertFalse(plain.contains("<a:lnSpc>"))
        assertTrue(plain.contains("""typeface="Work Sans""""))
    }
}
