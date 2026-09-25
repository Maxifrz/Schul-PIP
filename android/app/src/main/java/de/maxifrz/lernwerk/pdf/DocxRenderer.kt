package de.maxifrz.lernwerk.pdf

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.SpannableStringBuilder
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.StyleSpan
import de.maxifrz.lernwerk.present.DocxBlock
import de.maxifrz.lernwerk.present.DocxCell
import de.maxifrz.lernwerk.present.DocxDocument
import de.maxifrz.lernwerk.present.DocxRun
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min

/** Draws a parsed Word document onto A4 PDF pages: headings, paragraphs, lists, tables and pictures, paginated to
 * fit. Bold and italic are kept via Android's own text layout, so wrapping is automatic; other run formatting
 * (color, underline, font, exact spacing) is not read, and headers, footers and footnotes are left out. Mirrors
 * the iOS app. */
object DocxRenderer {
    private const val PAGE_WIDTH = 595
    private const val PAGE_HEIGHT = 842
    private const val MARGIN = 48f
    private val CONTENT_WIDTH = (PAGE_WIDTH - MARGIN * 2).toInt()

    fun pdfData(document: DocxDocument): ByteArray {
        val pdf = PdfDocument()
        val state = PageState(pdf)
        state.newPage()
        for (block in document.blocks) draw(block, state)
        state.finish()
        return ByteArrayOutputStream().also { pdf.writeTo(it); pdf.close() }.toByteArray()
    }

    /** The current PDF page and where drawing has reached on it; pages are started lazily as content needs them. */
    private class PageState(private val pdf: PdfDocument) {
        private var page: PdfDocument.Page? = null
        private var pageNumber = 0
        var canvas: Canvas? = null
            private set
        var y = MARGIN

        fun newPage() {
            page?.let(pdf::finishPage)
            pageNumber += 1
            val next = pdf.startPage(PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create())
            page = next
            canvas = next.canvas
            y = MARGIN
        }

        /** Starts a new page when `height` no longer fits, unless the page is still empty (an oversized block is
         * drawn as well as it can be rather than looping forever). */
        fun ensureSpace(height: Float) {
            if (y > MARGIN && y + height > PAGE_HEIGHT - MARGIN) newPage()
        }

        fun finish() {
            page?.let(pdf::finishPage)
        }
    }

    private fun draw(block: DocxBlock, state: PageState) {
        when (block) {
            is DocxBlock.Heading -> drawText(runsLayout(block.runs, style(block.level)), spacingBefore = if (block.level <= 1) 20f else 14f, state = state)
            is DocxBlock.Paragraph -> {
                if (block.runs.isEmpty()) {
                    state.ensureSpace(12f)
                    state.y += 12f
                    return
                }
                drawText(runsLayout(block.runs, bodyStyle), spacingBefore = 4f, state = state)
            }
            is DocxBlock.ListItem -> {
                val prefix = if (block.ordered) "${block.index}.  " else "•  "
                val inset = 14f + min(block.level, 4) * 16f
                drawText(runsLayout(block.runs, bodyStyle, prefix = prefix, maxWidth = CONTENT_WIDTH - inset.toInt()), spacingBefore = 3f, leftInset = inset, state = state)
            }
            is DocxBlock.Table -> drawTable(block.rows, block.columnWidths, state)
            is DocxBlock.Picture -> drawImage(block.data, block.aspect, state)
        }
    }

    private fun drawText(layout: StaticLayout, spacingBefore: Float, leftInset: Float = 0f, state: PageState) {
        state.ensureSpace(layout.height.toFloat())
        state.y += spacingBefore
        val canvas = state.canvas ?: return
        canvas.save()
        canvas.translate(MARGIN + leftInset, state.y)
        layout.draw(canvas)
        canvas.restore()
        state.y += layout.height + 3f
    }

    private fun drawImage(data: ByteArray, aspect: Double, state: PageState) {
        val bitmap = runCatching { BitmapFactory.decodeByteArray(data, 0, data.size) }.getOrNull() ?: return
        val ratio = if (aspect > 0) aspect.toFloat() else bitmap.width.toFloat() / max(bitmap.height, 1)
        var width = min(CONTENT_WIDTH.toFloat(), if (bitmap.width > 0) bitmap.width.toFloat() else CONTENT_WIDTH.toFloat())
        var height = width / max(ratio, 0.01f)
        val maxHeight = PAGE_HEIGHT - MARGIN * 2
        if (height > maxHeight) {
            height = maxHeight
            width = height * ratio
        }
        state.ensureSpace(height)
        state.y += 6f
        state.canvas?.drawBitmap(bitmap, null, RectF(MARGIN, state.y, MARGIN + width, state.y + height), Paint(Paint.FILTER_BITMAP_FLAG))
        state.y += height + 6f
    }

    private fun drawTable(rows: List<List<DocxCell>>, columnWidths: List<Double>, state: PageState) {
        val columnCount = rows.maxOfOrNull { it.size } ?: return
        if (columnCount == 0) return
        var widths = columnWidths.map { it.toFloat() }
        val total = widths.sum()
        widths = if (widths.size != columnCount || total <= 0) {
            List(columnCount) { CONTENT_WIDTH.toFloat() / columnCount }
        } else if (total != CONTENT_WIDTH.toFloat()) {
            val scale = CONTENT_WIDTH / total
            widths.map { it * scale }
        } else {
            widths
        }
        val padding = 5f
        val border = Paint().apply { color = Color.rgb(166, 166, 166); style = Paint.Style.STROKE; strokeWidth = 0.75f }
        state.y += 6f
        for (row in rows) {
            var rowHeight = 20f
            val cellLayouts = row.mapIndexed { index, cell ->
                val width = (widths.getOrNull(index) ?: widths.lastOrNull() ?: CONTENT_WIDTH.toFloat() / columnCount)
                val layout = cellLayout(cell, max(1, (width - padding * 2).toInt()))
                rowHeight = max(rowHeight, layout.height + padding * 2)
                layout to width
            }
            state.ensureSpace(rowHeight)
            var x = MARGIN
            val canvas = state.canvas
            for ((layout, width) in cellLayouts) {
                if (canvas != null) {
                    canvas.drawRect(x, state.y, x + width, state.y + rowHeight, border)
                    canvas.save()
                    canvas.translate(x + padding, state.y + padding)
                    layout.draw(canvas)
                    canvas.restore()
                }
                x += width
            }
            state.y += rowHeight
        }
        state.y += 8f
    }

    private fun cellLayout(paragraphs: DocxCell, width: Int): StaticLayout {
        val text = SpannableStringBuilder()
        paragraphs.forEachIndexed { index, runs ->
            if (index > 0) text.append('\n')
            appendRuns(text, runs)
        }
        if (text.isEmpty()) text.append(' ')
        return buildLayout(text, bodyStyle, width)
    }

    // Text layout

    private data class Style(val size: Float, val bold: Boolean)

    private val bodyStyle = Style(11f, bold = false)
    private fun style(level: Int) = Style(if (level <= 1) 22f else if (level == 2) 18f else 15f, bold = true)

    private fun runsLayout(runs: List<DocxRun>, style: Style, prefix: String = "", maxWidth: Int = CONTENT_WIDTH): StaticLayout {
        val text = SpannableStringBuilder()
        if (prefix.isNotEmpty()) {
            val start = text.length
            text.append(prefix)
            text.setSpan(StyleSpan(Typeface.BOLD), start, text.length, 0)
        }
        if (runs.isEmpty() && prefix.isEmpty()) text.append(' ')
        appendRuns(text, runs)
        return buildLayout(text, style, maxWidth)
    }

    private fun appendRuns(text: SpannableStringBuilder, runs: List<DocxRun>) {
        for (run in runs) {
            val start = text.length
            text.append(run.text)
            val face = when {
                run.bold && run.italic -> Typeface.BOLD_ITALIC
                run.bold -> Typeface.BOLD
                run.italic -> Typeface.ITALIC
                else -> null
            }
            if (face != null) text.setSpan(StyleSpan(face), start, text.length, 0)
        }
    }

    private fun buildLayout(text: CharSequence, style: Style, width: Int): StaticLayout {
        val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = style.size
            typeface = if (style.bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        }
        return StaticLayout.Builder.obtain(text, 0, text.length, paint, max(1, width))
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setLineSpacing(3f, 1f)
            .build()
    }
}
