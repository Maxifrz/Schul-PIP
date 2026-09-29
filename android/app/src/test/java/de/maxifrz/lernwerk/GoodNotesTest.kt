package de.maxifrz.lernwerk

import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font
import com.tom_roush.pdfbox.text.PDFTextStripper
import de.maxifrz.lernwerk.data.AppleLz4
import de.maxifrz.lernwerk.data.GoodNotes
import de.maxifrz.lernwerk.data.GoodNotesPdf
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Writes protocol buffers the way GoodNotes does, to build notebooks for the tests. */
private class Pb {
    val out = ByteArrayOutputStream()
    private fun varint(value: Long) {
        var v = value
        while (v and 0x7fL.inv() != 0L) {
            out.write(((v and 0x7f) or 0x80).toInt())
            v = v ushr 7
        }
        out.write(v.toInt())
    }
    fun int(field: Int, value: Long) = apply { varint((field shl 3).toLong()); varint(value) }
    fun bytes(field: Int, value: ByteArray) = apply { varint(((field shl 3) or 2).toLong()); varint(value.size.toLong()); out.write(value) }
    fun string(field: Int, value: String) = bytes(field, value.toByteArray())
    fun message(field: Int, build: Pb.() -> Unit) = bytes(field, Pb().apply(build).out.toByteArray())
    fun float(field: Int, value: Float) = apply {
        varint(((field shl 3) or 5).toLong())
        val bits = java.lang.Float.floatToIntBits(value)
        for (k in 0 until 4) out.write((bits ushr (8 * k)) and 0xff)
    }
    fun toByteArray(): ByteArray = out.toByteArray()
}

private fun delimited(vararg records: ByteArray): ByteArray {
    val out = ByteArrayOutputStream()
    for (r in records) {
        var n = r.size.toLong()
        while (n >= 0x80) {
            out.write(((n and 0x7f) or 0x80).toInt())
            n = n ushr 7
        }
        out.write(n.toInt())
        out.write(r)
    }
    return out.toByteArray()
}

/** A stroke's typed record, stored in an uncompressed Apple LZ4 frame: start point and quadratic segments. */
private fun strokeBlob(width: Float, start: Pair<Float, Float>, segments: List<FloatArray>): ByteArray {
    val body = ByteArrayOutputStream()
    fun u16(v: Int) { body.write(v and 0xff); body.write((v ushr 8) and 0xff) }
    fun u32(v: Int) { for (k in 0 until 4) body.write((v ushr (8 * k)) and 0xff) }
    fun f(v: Float) = u32(java.lang.Float.floatToIntBits(v))
    u16(2)
    f(width)
    u32(segments.size + 1)
    repeat(segments.size + 1) { u16(if (it == 0) 0 else 1) }
    u32(1)
    f(start.first); f(start.second)
    u32(segments.size)
    for (s in segments) s.forEach(::f)
    u16(1)
    u32(0)
    val types = "vuA(v)A(S(uu))A(S(uuuu))vA(f)".toByteArray()
    val record = ByteArrayOutputStream()
    record.write("tpl".toByteArray()); record.write(0)
    val total = 8 + types.size + 1 + body.size()
    for (k in 0 until 4) record.write((total ushr (8 * k)) and 0xff)
    record.write(types); record.write(0); record.write(body.toByteArray())
    val data = record.toByteArray()
    val frame = ByteArrayOutputStream()
    frame.write("bv4-".toByteArray())
    for (k in 0 until 4) frame.write((data.size ushr (8 * k)) and 0xff)
    frame.write(data)
    frame.write("bv4$".toByteArray())
    return frame.toByteArray()
}

private fun onePagePdf(text: String): ByteArray {
    val document = PDDocument()
    val page = PDPage(PDRectangle.A4)
    document.addPage(page)
    PDPageContentStream(document, page).use { stream ->
        stream.beginText()
        stream.setFont(PDType1Font.HELVETICA, 18f)
        stream.newLineAtOffset(50f, 750f)
        stream.showText(text)
        stream.endText()
    }
    return ByteArrayOutputStream().also { document.save(it); document.close() }.toByteArray()
}

private fun zip(files: Map<String, ByteArray>): ByteArray {
    val out = ByteArrayOutputStream()
    ZipOutputStream(out).use { z ->
        for ((name, bytes) in files) {
            z.putNextEntry(ZipEntry(name))
            z.write(bytes)
            z.closeEntry()
        }
    }
    return out.toByteArray()
}

private const val PAGE = "D0A2D550-1027-44BB-BF78-41B44663AFF9"
private const val FIRST = "F4A25C80-C62E-4EBC-B4F3-CA9F0A38B6FF"
private const val SECOND = "93630DBB-187C-4365-B162-8A932C658A3B"
private const val GONE = "507B777A-E97F-42A8-93EB-7EE6153C3FE2"

/** A notebook of two pages on the same book page; a third page was deleted; the first has ink. */
private fun notebook(): ByteArray {
    val events = delimited(
        Pb().string(1, PAGE).message(2) {
            string(2, PAGE); string(4, "BOOK"); int(5, 1)
            message(8) { float(1, 1091.64f); float(2, 1543.08f) }
        }.toByteArray(),
        Pb().string(1, "BOOK").message(6) { string(1, "BOOK"); string(2, "BOOK-FILE") }.toByteArray(),
        Pb().string(1, FIRST).message(54) { string(2, FIRST); message(3) { string(1, PAGE) }; message(4) { string(1, "b") } }.toByteArray(),
        Pb().string(1, SECOND).message(54) { string(2, SECOND); message(3) { string(1, PAGE) }; message(4) { string(1, "a") } }.toByteArray(),
        Pb().string(1, GONE).message(54) { string(2, GONE); message(3) { string(1, PAGE) }; message(4) { string(1, "c") } }.toByteArray(),
        Pb().string(1, GONE).message(56) { string(2, GONE); message(3) { int(1, 1) } }.toByteArray(),
    )
    val ink = delimited(
        // A red stroke, moved by (11, 0)
        Pb().message(7) {
            string(1, "S1")
            bytes(2, strokeBlob(0.55f, 110f to 220f, listOf(floatArrayOf(165f, 220f, 220f, 330f))))
            message(4) { float(1, 0.82f); float(4, 1f) }
            message(6) { float(1, 11f) }
        }.toByteArray(),
        // An erased stroke
        Pb().message(7) { string(1, "S2"); bytes(2, strokeBlob(0.55f, 0f to 0f, emptyList())); int(14, 1) }.toByteArray(),
        // A straight line
        Pb().message(7) {
            string(1, "S3")
            message(9) {
                message(1) { message(1) { float(1, 0f); float(2, 110f) }; message(1) { float(1, 550f); float(2, 110f) } }
                float(15, 0.52f)
            }
        }.toByteArray(),
    )
    return zip(
        mapOf(
            "index.events.pb" to events,
            "attachments/BOOK-FILE" to onePagePdf("Buchseite"),
            "notes/" + GoodNotes.nextUuid(FIRST) to ink,
        ),
    )
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class GoodNotesTest {
    @Test
    fun readsPagesInOrderWithoutDeletedOnes() {
        val book = GoodNotes.read(notebook())
        assertEquals(2, book.pages.size)
        // "a" before "b": the second entry comes first and has no ink
        assertTrue(book.pages[0].strokes.isEmpty())
        val page = book.pages[1]
        assertEquals(595.44f, page.width, 0.01f)
        assertTrue(page.background is GoodNotes.Background.Pdf)
        assertEquals(2, page.strokes.size)
        val stroke = page.strokes[0]
        assertEquals(0.82f, stroke.red, 1e-4f)
        assertEquals(0.3f, stroke.width, 1e-3f)
        // (110 + 11) / (11/6) = 66
        assertEquals(66f, stroke.start[0], 1e-3f)
        assertEquals(120f, stroke.start[1], 1e-3f)
        assertArrayEquals(floatArrayOf(96f, 120f, 126f, 180f), stroke.segments, 1e-3f)
        val line = page.strokes[1].polyline!!
        assertArrayEquals(floatArrayOf(0f, 60f, 300f, 60f), line, 1e-3f)
    }

    @Test
    fun rendersBackgroundAndInkIntoAPdf() {
        val pdf = GoodNotesPdf.render(GoodNotes.read(notebook()))
        PDDocument.load(pdf).use { document ->
            assertEquals(2, document.numberOfPages)
            assertTrue(PDFTextStripper().getText(document).contains("Buchseite"))
            val content = document.getPage(1).contentStreams.asSequence().joinToString("") { String(it.toByteArray(), Charsets.ISO_8859_1) }
            assertTrue("curve in the page: $content", content.contains(" c"))
        }
    }

    @Test
    fun uuidsCountUpAcrossDigits() {
        assertEquals("224F16A8-7FC5-4FDE-9D50-CEA29C0A36D0", GoodNotes.nextUuid("224F16A8-7FC5-4FDE-9D50-CEA29C0A36CF"))
        assertEquals("00000000-0000-0001-0000-000000000000", GoodNotes.nextUuid("00000000-0000-0000-FFFF-FFFFFFFFFFFF"))
    }

    @Test
    fun decodesLz4Blocks() {
        // "abc", then 6 bytes copied from 3 back: abcabcabc
        val block = byteArrayOf(0x32, 'a'.code.toByte(), 'b'.code.toByte(), 'c'.code.toByte(), 3, 0)
        val frame = "bv41".toByteArray() + byteArrayOf(9, 0, 0, 0, block.size.toByte(), 0, 0, 0) + block + "bv4$".toByteArray()
        assertEquals("abcabcabc", String(AppleLz4.decode(frame)))
    }

    /** A real notebook, when there is one on this machine (GOODNOTES_SAMPLE=path). */
    @Test
    fun readsARealNotebook() {
        val path = System.getenv("GOODNOTES_SAMPLE") ?: return
        val book = GoodNotes.read(File(path).readBytes())
        assertTrue(book.pages.size > 1)
        val pdf = GoodNotesPdf.render(book)
        File(path + ".android.pdf").writeBytes(pdf)
        assertTrue(book.pages.sumOf { it.strokes.size } > 100)
    }
}
