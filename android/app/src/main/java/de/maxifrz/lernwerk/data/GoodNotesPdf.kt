package de.maxifrz.lernwerk.data

import android.graphics.BitmapFactory
import com.tom_roush.pdfbox.multipdf.LayerUtility
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.LosslessFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import com.tom_roush.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState
import com.tom_roush.pdfbox.util.Matrix
import java.io.ByteArrayOutputStream

/**
 * A GoodNotes notebook as a PDF: each page with its background (a page of an imported PDF, or a photo), the pictures
 * placed on it and the handwriting as vector paths in its colours.
 */
object GoodNotesPdf {
    fun render(notebook: GoodNotes.Notebook): ByteArray {
        require(notebook.pages.isNotEmpty()) { "Die GoodNotes-Datei enthält keine Seiten." }
        val sources = mutableListOf<PDDocument>()
        try {
            PDDocument().use { document ->
                val layers = LayerUtility(document)
                // The same paper under many pages is embedded once.
                val forms = HashMap<Pair<ByteArray, Int>, Pair<com.tom_roush.pdfbox.pdmodel.graphics.form.PDFormXObject, PDRectangle>>()
                for (page in notebook.pages) {
                    val pdfPage = PDPage(PDRectangle(page.width, page.height))
                    document.addPage(pdfPage)
                    PDPageContentStream(document, pdfPage).use { stream ->
                        background(document, layers, sources, forms, stream, page)
                        for (image in page.images) {
                            val x = image(document, image.bytes) ?: continue
                            stream.drawImage(x, image.x, page.height - image.y - image.height, image.width, image.height)
                        }
                        ink(document, stream, page)
                    }
                }
                return ByteArrayOutputStream().also { document.save(it) }.toByteArray()
            }
        } finally {
            sources.forEach { runCatching { it.close() } }
        }
    }

    private fun background(
        document: PDDocument,
        layers: LayerUtility,
        sources: MutableList<PDDocument>,
        forms: HashMap<Pair<ByteArray, Int>, Pair<com.tom_roush.pdfbox.pdmodel.graphics.form.PDFormXObject, PDRectangle>>,
        stream: PDPageContentStream,
        page: GoodNotes.Page,
    ) {
        when (val background = page.background) {
            is GoodNotes.Background.Pdf -> runCatching {
                val (form, box) = forms.getOrPut(background.bytes to background.pageIndex) {
                    val source = PDDocument.load(background.bytes).also { sources += it }
                    val index = background.pageIndex.coerceIn(0, source.numberOfPages - 1)
                    layers.importPageAsForm(source, index) to source.getPage(index).mediaBox
                }
                stream.saveGraphicsState()
                stream.transform(Matrix.getScaleInstance(page.width / box.width, page.height / box.height))
                stream.transform(Matrix.getTranslateInstance(-box.lowerLeftX, -box.lowerLeftY))
                stream.drawForm(form)
                stream.restoreGraphicsState()
            }
            is GoodNotes.Background.Image -> image(document, background.bytes)?.let { stream.drawImage(it, 0f, 0f, page.width, page.height) }
            null -> Unit
        }
    }

    private fun image(document: PDDocument, bytes: ByteArray): PDImageXObject? = runCatching {
        val jpeg = bytes.size > 2 && (bytes[0].toInt() and 0xff) == 0xFF && (bytes[1].toInt() and 0xff) == 0xD8
        if (jpeg) JPEGFactory.createFromByteArray(document, bytes)
        else LosslessFactory.createFromImage(document, BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null)
    }.getOrNull()

    private fun ink(document: PDDocument, stream: PDPageContentStream, page: GoodNotes.Page) {
        if (page.strokes.isEmpty()) return
        val h = page.height
        stream.setLineCapStyle(1)
        stream.setLineJoinStyle(1)
        for (stroke in page.strokes) {
            stream.saveGraphicsState()
            if (stroke.alpha < 1f) {
                val state = PDExtendedGraphicsState()
                state.strokingAlphaConstant = stroke.alpha
                stream.setGraphicsStateParameters(state)
            }
            stream.setStrokingColor(stroke.red, stroke.green, stroke.blue)
            stream.setLineWidth(stroke.width)
            val line = stroke.polyline
            if (line != null) {
                stream.moveTo(line[0], h - line[1])
                var i = 2
                while (i + 1 < line.size) {
                    stream.lineTo(line[i], h - line[i + 1])
                    i += 2
                }
            } else {
                var x = stroke.start[0]
                var y = stroke.start[1]
                stream.moveTo(x, h - y)
                val s = stroke.segments
                if (s.isEmpty()) stream.lineTo(x + 0.01f, h - y)
                var i = 0
                while (i + 3 < s.size) {
                    // A quadratic piece as the cubic the PDF knows
                    val cx = s[i]
                    val cy = s[i + 1]
                    val ex = s[i + 2]
                    val ey = s[i + 3]
                    stream.curveTo(x + (cx - x) * 2 / 3, h - (y + (cy - y) * 2 / 3), ex + (cx - ex) * 2 / 3, h - (ey + (cy - ey) * 2 / 3), ex, h - ey)
                    x = ex
                    y = ey
                    i += 4
                }
            }
            stream.stroke()
            stream.restoreGraphicsState()
        }
    }
}
