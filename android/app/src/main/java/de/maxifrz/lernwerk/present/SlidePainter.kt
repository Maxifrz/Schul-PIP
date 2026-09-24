package de.maxifrz.lernwerk.present

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.BulletSpan
import androidx.core.content.res.ResourcesCompat
import de.maxifrz.lernwerk.R
import java.io.ByteArrayOutputStream
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max

/**
 * Draws slides with android.graphics. The editor, thumbnails, presenting and the PDF export all use it, so what the
 * student edits is exactly what gets exported. Coordinates are slide points multiplied by [scale].
 */
class SlidePainter(context: Context) {
    private val regular = ResourcesCompat.getFont(context, R.font.worksans_regular) ?: Typeface.DEFAULT
    private val semibold = ResourcesCompat.getFont(context, R.font.worksans_semibold) ?: Typeface.DEFAULT_BOLD
    private val italic = ResourcesCompat.getFont(context, R.font.worksans_italic) ?: Typeface.defaultFromStyle(Typeface.ITALIC)

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val bitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG)

    fun draw(
        canvas: Canvas,
        slide: Slide,
        theme: SlideTheme,
        scale: Float,
        images: Map<String, Bitmap>,
        skipElementId: String? = null,
    ) {
        // A rectangle, not drawColor: the canvas of a Compose view is not clipped to the slide.
        fillPaint.color = argb(theme.color(slide.background) ?: theme.background)
        canvas.drawRect(0f, 0f, SlideSize.WIDTH * scale, SlideSize.HEIGHT * scale, fillPaint)
        for (element in slide.elements) {
            if (element.id == skipElementId) continue
            drawElement(canvas, element, theme, scale, images)
        }
    }

    fun drawElement(canvas: Canvas, element: SlideElement, theme: SlideTheme, scale: Float, images: Map<String, Bitmap>) {
        val save = canvas.save()
        canvas.scale(scale, scale)
        if (element.rotation != 0f) canvas.rotate(element.rotation, element.centerX, element.centerY)
        when (element.kind) {
            ElementKind.SHAPE -> drawShape(canvas, element, theme)
            ElementKind.IMAGE -> drawImage(canvas, element, theme, images)
            ElementKind.TEXT -> drawText(canvas, element, theme)
        }
        canvas.restoreToCount(save)
    }

    private fun drawShape(canvas: Canvas, element: SlideElement, theme: SlideTheme) {
        val rect = RectF(element.x, element.y, element.x + element.width, element.y + element.height)
        if (element.shape == ShapeType.LINE || element.shape == ShapeType.ARROW) {
            val color = theme.color(element.fill) ?: theme.text
            val width = max(element.strokeWidth, 3f)
            strokePaint.color = argb(color)
            strokePaint.strokeWidth = width
            strokePaint.strokeCap = Paint.Cap.BUTT
            val y = element.centerY
            val head = if (element.shape == ShapeType.ARROW) width * 3f else 0f
            canvas.drawLine(rect.left, y, rect.right - head * 0.8f, y, strokePaint)
            if (head > 0f) {
                fillPaint.color = argb(color)
                val path = Path().apply {
                    moveTo(rect.right, y)
                    lineTo(rect.right - head, y - head / 2)
                    lineTo(rect.right - head, y + head / 2)
                    close()
                }
                canvas.drawPath(path, fillPaint)
            }
            return
        }
        val radius = if (element.shape == ShapeType.ROUNDED) minOf(element.width, element.height) * 0.16667f else 0f
        theme.color(element.fill)?.let { fill ->
            fillPaint.color = argb(fill)
            shapePath(canvas, rect, element.shape, radius, fillPaint)
        }
        val stroke = theme.color(element.stroke)
        if (stroke != null && element.strokeWidth > 0f) {
            strokePaint.color = argb(stroke)
            strokePaint.strokeWidth = element.strokeWidth
            val inset = RectF(rect).apply { inset(element.strokeWidth / 2, element.strokeWidth / 2) }
            shapePath(canvas, inset, element.shape, radius, strokePaint)
        }
    }

    private fun shapePath(canvas: Canvas, rect: RectF, shape: ShapeType, radius: Float, paint: Paint) {
        when (shape) {
            ShapeType.ELLIPSE -> canvas.drawOval(rect, paint)
            ShapeType.ROUNDED -> canvas.drawRoundRect(rect, radius, radius, paint)
            else -> canvas.drawRect(rect, paint)
        }
    }

    private fun drawImage(canvas: Canvas, element: SlideElement, theme: SlideTheme, images: Map<String, Bitmap>) {
        val rect = RectF(element.x, element.y, element.x + element.width, element.y + element.height)
        val bitmap = element.image?.let { images[it] }
        if (bitmap == null) {
            fillPaint.color = argb(theme.surface)
            canvas.drawRect(rect, fillPaint)
            return
        }
        canvas.drawBitmap(bitmap, null, rect, bitmapPaint)
    }

    /** Lays out a text element at slide scale; also used by the editor to measure. */
    fun layout(element: SlideElement, theme: SlideTheme): StaticLayout {
        textPaint.typeface = when {
            element.italic -> italic
            element.bold -> semibold
            else -> regular
        }
        textPaint.isFakeBoldText = element.bold && element.italic
        textPaint.textSize = element.fontSize
        textPaint.color = argb(theme.color(element.textColor) ?: theme.text)
        val text = SpannableStringBuilder()
        val lines = element.text.split("\n")
        lines.forEachIndexed { index, line ->
            val start = text.length
            text.append(line)
            if (index < lines.lastIndex) text.append("\n")
            if (element.bullets && line.isNotBlank()) {
                // Matches the PowerPoint export: the text starts 1.1 × font size from the left edge.
                val radius = element.fontSize * 0.1f
                val gap = element.fontSize * 1.1f - 2 * radius
                text.setSpan(BulletSpan(gap.toInt(), argb(theme.accent), radius.toInt().coerceAtLeast(1)), start, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
        val alignment = when (element.align) {
            TextAlign.LEFT -> Layout.Alignment.ALIGN_NORMAL
            TextAlign.CENTER -> Layout.Alignment.ALIGN_CENTER
            TextAlign.RIGHT -> Layout.Alignment.ALIGN_OPPOSITE
        }
        return StaticLayout.Builder.obtain(text, 0, text.length, textPaint, max(1f, element.width).toInt())
            .setAlignment(alignment)
            .setIncludePad(false)
            .build()
    }

    private fun drawText(canvas: Canvas, element: SlideElement, theme: SlideTheme) {
        if (element.text.isEmpty()) return
        val layout = layout(element, theme)
        val top = when (element.anchor) {
            TextAnchor.TOP -> element.y
            TextAnchor.MIDDLE -> element.y + (element.height - layout.height) / 2
            TextAnchor.BOTTOM -> element.y + element.height - layout.height
        }
        canvas.save()
        canvas.translate(element.x, top)
        layout.draw(canvas)
        canvas.restore()
    }

    /** The whole deck as a PDF with one 960 × 540 pt page per slide. */
    fun pdf(presentation: Presentation, images: Map<String, Bitmap>): ByteArray {
        val document = PdfDocument()
        presentation.slides.forEachIndexed { index, slide ->
            val page = document.startPage(PdfDocument.PageInfo.Builder(SlideSize.WIDTH.toInt(), SlideSize.HEIGHT.toInt(), index + 1).create())
            draw(page.canvas, slide, presentation.theme, 1f, images)
            document.finishPage(page)
        }
        return ByteArrayOutputStream().also { document.writeTo(it); document.close() }.toByteArray()
    }

    /** A slide as a bitmap, for thumbnails outside Compose. */
    fun bitmap(slide: Slide, theme: SlideTheme, width: Int, images: Map<String, Bitmap>): Bitmap {
        val height = (width * SlideSize.HEIGHT / SlideSize.WIDTH).toInt()
        return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also {
            draw(Canvas(it), slide, theme, width / SlideSize.WIDTH, images)
        }
    }

    companion object {
        fun argb(rgb: Long): Int = Color.rgb(((rgb shr 16) and 0xFF).toInt(), ((rgb shr 8) and 0xFF).toInt(), (rgb and 0xFF).toInt())
    }
}

/** Geometry helpers for the editor, kept free of Android types so they can be unit-tested. */
object SlideGeometry {
    const val MIN_SIZE = 16f

    enum class Corner(val fx: Float, val fy: Float) {
        TOP_LEFT(0f, 0f), TOP_RIGHT(1f, 0f), BOTTOM_RIGHT(1f, 1f), BOTTOM_LEFT(0f, 1f);

        val opposite: Corner get() = entries[(ordinal + 2) % 4]
    }

    fun isLine(element: SlideElement) =
        element.kind == ElementKind.SHAPE && (element.shape == ShapeType.LINE || element.shape == ShapeType.ARROW)

    /** Slide position of a corner of the rotated frame. */
    fun corner(element: SlideElement, corner: Corner) = element.toSlide(corner.fx * element.width, corner.fy * element.height)

    /** Moves [corner] of [base] to the slide point (px, py) while the opposite corner stays put. */
    fun resize(base: SlideElement, corner: Corner, px: Float, py: Float, keepAspect: Boolean): SlideElement {
        val anchorX = corner.opposite.fx * base.width
        val anchorY = corner.opposite.fy * base.height
        val (lx, ly) = base.toLocal(px, py)
        var width = maxOf(MIN_SIZE, if (corner.fx > corner.opposite.fx) lx - anchorX else anchorX - lx)
        var height = maxOf(MIN_SIZE, if (corner.fy > corner.opposite.fy) ly - anchorY else anchorY - ly)
        if (keepAspect && base.height > 0f) {
            val aspect = base.width / base.height
            if (width / height > aspect) height = width / aspect else width = height * aspect
        }
        // New center in the old local frame, then back to slide coordinates.
        val centerLocalX = anchorX + (if (corner.fx > corner.opposite.fx) width else -width) / 2
        val centerLocalY = anchorY + (if (corner.fy > corner.opposite.fy) height else -height) / 2
        val (cx, cy) = base.toSlide(centerLocalX, centerLocalY)
        return base.copy(x = cx - width / 2, y = cy - height / 2, width = width, height = height)
    }

    /** Moves one end of a line; the other end stays where it is. */
    fun moveLineEnd(base: SlideElement, start: Boolean, px: Float, py: Float): SlideElement {
        val (fixedX, fixedY) = base.toSlide(if (start) base.width else 0f, base.height / 2)
        val (sx, sy) = if (start) px to py else fixedX to fixedY
        val (ex, ey) = if (start) fixedX to fixedY else px to py
        val length = maxOf(MIN_SIZE, hypot(ex - sx, ey - sy))
        val angle = Math.toDegrees(atan2((ey - sy).toDouble(), (ex - sx).toDouble())).toFloat()
        val cx = (sx + ex) / 2
        val cy = (sy + ey) / 2
        return base.copy(x = cx - length / 2, y = cy - base.height / 2, width = length, rotation = angle)
    }

    /** Rotation so that the handle above the element points at (px, py); snaps to 15° steps nearby. */
    fun rotation(base: SlideElement, px: Float, py: Float): Float {
        val angle = Math.toDegrees(atan2((py - base.centerY).toDouble(), (px - base.centerX).toDouble())).toFloat() + 90f
        val normalized = ((angle % 360) + 360) % 360
        val snapped = Math.round(normalized / 15f) * 15f
        return (if (kotlin.math.abs(snapped - normalized) < 4f) snapped else normalized) % 360
    }

    data class Snap(val dx: Float, val dy: Float, val verticalGuides: List<Float>, val horizontalGuides: List<Float>)

    /**
     * Snaps a moved element's edges and center to the slide's edges and center and to the other elements, like the
     * guides in Keynote. [threshold] is in slide points.
     */
    fun snap(moved: SlideElement, others: List<SlideElement>, threshold: Float): Snap {
        val xs = listOf(0f, SlideSize.WIDTH / 2, SlideSize.WIDTH) + others.flatMap { listOf(it.x, it.centerX, it.x + it.width) }
        val ys = listOf(0f, SlideSize.HEIGHT / 2, SlideSize.HEIGHT) + others.flatMap { listOf(it.y, it.centerY, it.y + it.height) }
        fun best(values: List<Float>, targets: List<Float>): Pair<Float, Float>? = values.flatMap { value ->
            targets.map { target -> (target - value) to target }
        }.filter { kotlin.math.abs(it.first) <= threshold }.minByOrNull { kotlin.math.abs(it.first) }

        val bx = best(listOf(moved.x, moved.centerX, moved.x + moved.width), xs)
        val by = best(listOf(moved.y, moved.centerY, moved.y + moved.height), ys)
        return Snap(bx?.first ?: 0f, by?.first ?: 0f, listOfNotNull(bx?.second), listOfNotNull(by?.second))
    }

    /** A frame for a picture of the given pixel size, fitted into the box and centered. */
    fun fit(width: Int, height: Int, box: RectBox): RectBox {
        val scale = minOf(box.width / width, box.height / height)
        val w = width * scale
        val h = height * scale
        return RectBox(box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h)
    }

    data class RectBox(val x: Float, val y: Float, val width: Float, val height: Float)

}
