package de.maxifrz.lernwerk.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import de.maxifrz.lernwerk.calc.CasFormat
import de.maxifrz.lernwerk.calc.CasPlot
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Draws a plot like on graph paper: round ticks, axes, the graphs and their special points, black on white. The same
 * drawing serves the screen and the page that goes into a document.
 */
object GraphPainter {
    val colors = intArrayOf(0xFF1F4E9C.toInt(), 0xFFC23B3B.toInt(), 0xFF2E7D4F.toInt())
    private const val INK = 0xFF16150F.toInt()
    private const val MUTED = 0xFF6E6B62.toInt()

    fun color(index: Int) = colors[index % colors.size]

    /** [density] scales lines and text, like dp. */
    fun draw(canvas: Canvas, plot: CasPlot, width: Float, height: Float, density: Float) {
        val xmin = plot.xmin ?: return
        val xmax = plot.xmax ?: return
        val ymin = plot.ymin ?: return
        val ymax = plot.ymax ?: return
        if (xmax <= xmin || ymax <= ymin) return
        val inset = 8 * density
        val area = RectF(inset, inset, width - inset, height - inset)
        fun px(x: Double) = area.left + ((x - xmin) / (xmax - xmin)).toFloat() * area.width()
        fun py(y: Double) = area.bottom - ((y - ymin) / (ymax - ymin)).toFloat() * area.height()

        canvas.drawColor(0xFFFFFFFF.toInt())
        val grid = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x12000000; strokeWidth = density }
        val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = MUTED; textSize = 10.5f * density }
        val xTicks = CasFormat.ticks(xmin, xmax, max(4, (area.width() / (70 * density)).toInt()))
        val yTicks = CasFormat.ticks(ymin, ymax, max(4, (area.height() / (50 * density)).toInt()))
        xTicks.forEach { canvas.drawLine(px(it), area.top, px(it), area.bottom, grid) }
        yTicks.forEach { canvas.drawLine(area.left, py(it), area.right, py(it), grid) }

        // Axes, at zero when it is in view, otherwise at the edge.
        val axisY = py(min(max(0.0, ymin), ymax))
        val axisX = px(min(max(0.0, xmin), xmax))
        val axis = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = INK; alpha = 180; strokeWidth = 1.2f * density }
        canvas.drawLine(area.left, axisY, area.right, axisY, axis)
        canvas.drawLine(axisX, area.top, axisX, area.bottom, axis)
        text.textAlign = Paint.Align.CENTER
        xTicks.filter { abs(it) > 1e-12 }.forEach {
            canvas.drawText(CasFormat.number(it), px(it), min(axisY + 14 * density, area.bottom - 2 * density), text)
        }
        text.textAlign = Paint.Align.RIGHT
        yTicks.filter { abs(it) > 1e-12 }.forEach {
            canvas.drawText(CasFormat.number(it), max(axisX - 4 * density, area.left + 24 * density), py(it) + 4 * density, text)
        }
        text.color = INK
        text.typeface = Typeface.DEFAULT_BOLD
        text.textSize = 12 * density
        canvas.drawText("x", area.right - 4 * density, axisY - 4 * density, text)
        text.textAlign = Paint.Align.LEFT
        canvas.drawText("y", axisX + 6 * density, area.top + 12 * density, text)

        canvas.save()
        canvas.clipRect(area)
        val span = ymax - ymin
        plot.curves.orEmpty().forEachIndexed { index, curve ->
            val path = Path()
            var drawing = false
            var previous: Double? = null
            curve.values.forEachIndexed { i, value ->
                if (value == null || !value.isFinite()) {
                    drawing = false
                    previous = null
                    return@forEachIndexed
                }
                val x = px(plot.x(i, curve.values.size))
                val y = py(value.coerceIn(ymin - span * 4, ymax + span * 4))
                val last = previous
                // A jump across a pole is not drawn as a steep line.
                if (drawing && last != null && abs(value - last) < span * 1.5) path.lineTo(x, y) else path.moveTo(x, y)
                drawing = true
                previous = value
            }
            val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                color = color(index)
                strokeWidth = 2.2f * density
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }
            canvas.drawPath(path, stroke)
        }
        canvas.restore()

        fun dot(point: CasPlot.Point, filled: Boolean, color: Int) {
            val x = px(point.x)
            val y = py(point.y)
            if (x < area.left - 2 || x > area.right + 2 || y < area.top - 2 || y > area.bottom + 2) return
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = if (filled) color else 0xFFFFFFFF.toInt() }
            canvas.drawCircle(x, y, 4.5f * density, fill)
            if (!filled) {
                val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; style = Paint.Style.STROKE; strokeWidth = 2 * density }
                canvas.drawCircle(x, y, 4.5f * density, ring)
            }
        }
        plot.roots.orEmpty().forEach { dot(it, false, color(it.curve ?: 0)) }
        plot.extrema.orEmpty().forEach { dot(it, true, color(it.curve ?: 0)) }
        plot.intersections.orEmpty().forEach { dot(it, true, INK) }
    }

    /** The special points in school notation, one line per kind: N(…), H(…), T(…), S(…). */
    fun pointLines(plot: CasPlot): List<Pair<String, String>> {
        val lines = mutableListOf<Pair<String, String>>()
        plot.curves.orEmpty().forEachIndexed { index, curve ->
            lines += "${curve.label} =" to curve.pretty
            fun named(list: List<CasPlot.Point>?, name: String): String? {
                val matching = list.orEmpty().filter { it.curve == index }.sortedBy { it.x }
                if (matching.isEmpty()) return null
                return matching.mapIndexed { number, point ->
                    CasFormat.point(if (matching.size > 1) name + lowered(number + 1) else name, point.x, point.y)
                }.joinToString("   ")
            }
            named(plot.roots, "N")?.let { lines += "Nullstellen" to it }
            plot.extrema.orEmpty().filter { it.curve == index }.sortedBy { it.x }.takeIf { it.isNotEmpty() }?.let { list ->
                lines += "Extrempunkte" to list.joinToString("   ") { CasFormat.point(if (it.kind == "max") "H" else "T", it.x, it.y) }
            }
            named(plot.intercepts, "Sᵧ")?.let { lines += "y-Achse" to it }
        }
        plot.intersections.orEmpty().takeIf { it.isNotEmpty() }?.let { list ->
            lines += "Schnittpunkte" to list.mapIndexed { number, point ->
                val names = point.curves.orEmpty().joinToString(" und ") { plot.curves?.getOrNull(it)?.label ?: "f" }
                CasFormat.point("S" + lowered(number + 1), point.x, point.y) + " ($names)"
            }.joinToString("   ")
        }
        return lines
    }

    /** The graph big on white with its points below, for a new page in a document. */
    fun pageBitmap(plot: CasPlot): Bitmap {
        val scale = 2f
        val width = 1080
        val graphHeight = 760
        val lines = pointLines(plot)
        val height = graphHeight + 60 + lines.size * 34 + 40
        val bitmap = Bitmap.createBitmap((width * scale).toInt(), (height * scale).toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(0xFFFFFFFF.toInt())
        canvas.save()
        canvas.translate(40 * scale, 40 * scale)
        draw(canvas, plot, (width - 80) * scale, graphHeight * scale, scale)
        canvas.restore()
        val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = MUTED; textSize = 17 * scale }
        val value = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = INK; textSize = 17 * scale }
        var y = (graphHeight + 40 + 40) * scale
        lines.forEach { (title, text) ->
            canvas.drawText(title, 40 * scale, y, label)
            canvas.drawText(text, 220 * scale, y, value)
            y += 34 * scale
        }
        return bitmap
    }

    private fun lowered(number: Int): String {
        val digits = "₀₁₂₃₄₅₆₇₈₉"
        return number.toString().map { digits[it - '0'] }.joinToString("")
    }
}
