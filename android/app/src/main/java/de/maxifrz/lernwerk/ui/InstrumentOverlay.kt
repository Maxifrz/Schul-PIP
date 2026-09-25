package de.maxifrz.lernwerk.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.AwaitPointerEventScope
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.ink.InstrumentKind
import de.maxifrz.lernwerk.ink.InstrumentPose
import de.maxifrz.lernwerk.ink.Instruments
import de.maxifrz.lernwerk.ink.Pt
import de.maxifrz.lernwerk.ink.Segment
import de.maxifrz.lernwerk.pdf.PageSize
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

/** The instrument on the pages: which one, on which page and where. Positions are in PDF points of that page. */
class InstrumentState {
    var kind by mutableStateOf<InstrumentKind?>(null)
    var page by mutableIntStateOf(0)
    var pose by mutableStateOf(InstrumentPose(Pt(297.6, 421.0)))
    /** Pages are shown so a centimetre of the page is a centimetre on the screen. */
    var trueScale by mutableStateOf(false)
    /** What is being measured right now, and where, in PDF points. */
    var measure by mutableStateOf<Pair<String, Pt>?>(null)

    /** Lays the instrument in the middle of a page. */
    fun place(kind: InstrumentKind, page: Int, size: PageSize) {
        this.kind = kind
        this.page = page
        pose = pose.copy(
            center = Pt(size.width / 2.0, size.height / 2.0),
            angle = if (kind == InstrumentKind.COMPASS) 0.0 else pose.angle,
        )
    }
}

private enum class Grab { BODY, PIN, TIP }

private sealed interface Drawn {
    data class Edge(val index: Int) : Drawn
    data object Ray : Drawn
    data object Arc : Drawn
}

/**
 * Handles a gesture that starts on the instrument's page: fingers on the instrument move and turn it, the pen along an
 * edge draws a straight line, from the protractor's centre a ray, near the compass circle an arc. Returns false when
 * the gesture is not for the instrument, so the page handles it as usual. [pointsPerPixel] converts from the page on
 * screen to PDF points; [penWidth] is the stroke width in points, or null when no pen is chosen.
 */
suspend fun AwaitPointerEventScope.instrumentGesture(
    down: PointerInputChange,
    state: InstrumentState,
    pointsPerPixel: Double,
    pageSize: PageSize,
    penWidth: Double?,
    preview: MutableList<Float>,
    onStroke: (List<Float>) -> Unit,
): Boolean {
    val kind = state.kind ?: return false
    fun pt(offset: Offset) = Pt(offset.x * pointsPerPixel, offset.y * pointsPerPixel)
    val start = pt(down.position)
    val grab = 30.dp.toPx() * pointsPerPixel
    val band = 26.dp.toPx() * pointsPerPixel
    val pose = state.pose

    val grabbed = when {
        kind == InstrumentKind.COMPASS && Instruments.distance(start, Instruments.compassTip(pose)) <= grab -> Grab.TIP
        kind == InstrumentKind.COMPASS && Instruments.distance(start, pose.center) <= grab -> Grab.PIN
        kind != InstrumentKind.COMPASS && Instruments.contains(start, kind, pose) -> Grab.BODY
        else -> null
    }
    if (grabbed != null) {
        manipulate(down, state, grabbed, ::pt)
        return true
    }
    if (penWidth == null) return false
    val drawn: Drawn = when {
        kind == InstrumentKind.COMPASS ->
            if (abs(Instruments.distance(start, pose.center) - pose.radiusCm * pose.unitsPerCm) <= band * 1.6) Drawn.Arc else null
        kind == InstrumentKind.PROTRACTOR && Instruments.distance(start, pose.center) <= max(band, 0.8 * pose.unitsPerCm) -> Drawn.Ray
        else -> Instruments.nearestEdge(start, kind, pose, band)?.let { Drawn.Edge(it) }
    } ?: return false
    down.consume()

    val offset = penWidth / 2 + 1
    val startDirection = Instruments.direction(pose.center, start)
    var previous = startDirection
    var sweep = 0.0
    var points = emptyList<Pt>()
    fun update(point: Pt) {
        when (drawn) {
            is Drawn.Edge -> {
                val line = Instruments.snappedLine(start, point, drawn.index, kind, pose, offset)
                points = Instruments.sampled(line, 2.0)
                val text = "${Instruments.formatCm(Instruments.centimetres(line.length, pose))} · ${Instruments.formatDegrees(Instruments.lineDegrees(line.start, line.end))}"
                state.measure = text to point
            }
            Drawn.Ray -> {
                val ray = Instruments.protractorRay(point, pose) ?: return
                points = Instruments.sampled(Segment(pose.center, ray.end), 2.0)
                val length = Instruments.centimetres(Instruments.distance(pose.center, ray.end), pose)
                state.measure = "${ray.degrees}° · ${Instruments.formatCm(length)}" to point
            }
            Drawn.Arc -> {
                val direction = Instruments.direction(pose.center, point)
                sweep = (sweep + Instruments.angleStep(previous, direction)).coerceIn(-2 * PI, 2 * PI)
                previous = direction
                points = Instruments.arc(pose.center, pose.radiusCm * pose.unitsPerCm, startDirection, sweep)
                state.measure = "r = ${Instruments.formatCm(pose.radiusCm)} · ${(abs(sweep) * 180 / PI).roundToInt()}°" to point
            }
        }
        preview.clear()
        points.forEach {
            preview += (it.x / pageSize.width).toFloat()
            preview += (it.y / pageSize.height).toFloat()
        }
    }
    update(start)
    while (true) {
        val event = awaitPointerEvent()
        val change = event.changes.firstOrNull { it.id == down.id } ?: break
        if (!change.pressed) break
        update(pt(change.position))
        change.consume()
    }
    val long = when (drawn) {
        Drawn.Arc -> abs(sweep) > 0.02
        else -> points.size > 1 && Instruments.distance(points.first(), points.last()) > 1
    }
    if (long) onStroke(preview.toList())
    preview.clear()
    state.measure = null
    return true
}

private suspend fun AwaitPointerEventScope.manipulate(down: PointerInputChange, state: InstrumentState, grab: Grab, pt: (Offset) -> Pt) {
    down.consume()
    val pointers = LinkedHashMap<PointerId, Offset>()
    pointers[down.id] = down.position
    var ids = listOf(down.id)
    var startPose = state.pose
    var startPoints = listOf(pt(down.position))
    while (true) {
        val event = awaitPointerEvent()
        event.changes.forEach {
            if (it.pressed) pointers[it.id] = it.position else pointers.remove(it.id)
            it.consume()
        }
        if (pointers.isEmpty()) break
        val currentIds = pointers.keys.take(2)
        val points = currentIds.map { pt(pointers.getValue(it)) }
        if (currentIds != ids) {
            // A finger came or went: carry on from where the instrument is now.
            ids = currentIds
            startPose = state.pose
            startPoints = points
            continue
        }
        state.pose = when (grab) {
            Grab.BODY -> Instruments.moved(startPose, startPoints, points)
            Grab.PIN -> Instruments.moved(startPose, startPoints.take(1), points.take(1))
            Grab.TIP -> startPose.copy(
                radiusCm = Instruments.compassRadius(points[0], startPose),
                angle = Instruments.direction(startPose.center, points[0]),
            )
        }
    }
}

private val Tick = Color(0xFF1F3B4D)
private val Border = Color(0xFF5E8FA8)
private val Fill = Color(0xB8E4F1F7)

/** Draws the instrument with its scales, and the rotation or what is being measured, on a page [pixelsPerPoint] big. */
fun DrawScope.drawInstrument(state: InstrumentState, pixelsPerPoint: Double) {
    val kind = state.kind ?: return
    val pose = state.pose
    fun px(p: Pt) = Offset((p.x * pixelsPerPoint).toFloat(), (p.y * pixelsPerPoint).toFloat())
    fun at(x: Double, y: Double) = px(Instruments.toPage(Pt(x, y), pose))
    val cmPixels = (pose.unitsPerCm * pixelsPerPoint).toFloat()
    val degrees = (pose.angle * 180 / PI).toFloat()
    val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = android.graphics.Paint.Align.CENTER
        typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
    }
    fun text(value: String, x: Double, y: Double, size: Double, color: Color = Tick) {
        val center = at(x, y)
        paint.textSize = (size * cmPixels).toFloat()
        paint.color = color.toArgb()
        drawContext.canvas.nativeCanvas.apply {
            save()
            translate(center.x, center.y)
            rotate(degrees)
            drawText(value, 0f, paint.textSize * 0.35f, paint)
            restore()
        }
    }
    val thin = 0.7.dp.toPx()
    fun line(x1: Double, y1: Double, x2: Double, y2: Double, width: Float = thin) = drawLine(Tick, at(x1, y1), at(x2, y2), width)
    fun tickLength(mm: Int) = if (mm % 10 == 0) 0.55 else if (mm % 5 == 0) 0.38 else 0.22

    if (kind == InstrumentKind.COMPASS) {
        val center = px(pose.center)
        val tip = px(Instruments.compassTip(pose))
        val radius = (pose.radiusCm * pose.unitsPerCm * pixelsPerPoint).toFloat()
        drawCircle(Border.copy(alpha = 0.7f), radius, center, style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f))))
        drawLine(Tick, center, tip, 1.5.dp.toPx())
        drawCircle(Border.copy(alpha = 0.25f), 6.dp.toPx(), center)
        drawCircle(Tick, 6.dp.toPx(), center, style = Stroke(1.5.dp.toPx()))
        drawCircle(Border.copy(alpha = 0.25f), 9.dp.toPx(), tip)
        drawCircle(Tick, 9.dp.toPx(), tip, style = Stroke(1.5.dp.toPx()))
    } else {
        val outline = Path()
        Instruments.localOutline(kind).forEachIndexed { index, p ->
            val o = at(p.x, p.y)
            if (index == 0) outline.moveTo(o.x, o.y) else outline.lineTo(o.x, o.y)
        }
        outline.close()
        drawPath(outline, Fill)
        drawPath(outline, Border, style = Stroke(1.2.dp.toPx()))
        when (kind) {
            InstrumentKind.RULER -> {
                val h = Instruments.RULER_HALF_HEIGHT
                for (mm in 0..160) {
                    val x = -8 + mm / 10.0
                    line(x, -h, x, -h + tickLength(mm))
                    line(x, h, x, h - tickLength(mm))
                    if (mm % 10 == 0) text("${mm / 10}", x, -h + 0.85, 0.3)
                }
            }
            InstrumentKind.SET_SQUARE -> {
                for (mm in -70..70) {
                    val x = mm / 10.0
                    line(x, 0.0, x, tickLength(abs(mm)))
                    if (mm % 10 == 0) text("${abs(mm) / 10}", x, 0.85, 0.3)
                }
                val radius = 5.4
                for (degree in 0..180) {
                    val angle = degree * PI / 180
                    val length = if (degree % 10 == 0) 0.45 else if (degree % 5 == 0) 0.3 else 0.16
                    line(radius * cos(angle), radius * sin(angle), (radius - length) * cos(angle), (radius - length) * sin(angle), thin * 0.8f)
                    if (degree % 10 == 0 && degree in 1..179) text("$degree", (radius - 0.75) * cos(angle), (radius - 0.75) * sin(angle), 0.22)
                }
                drawLine(Tick, at(0.0, 1.1), at(0.0, Instruments.SET_SQUARE_HALF_LENGTH - 0.6), thin, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f)))
                drawCircle(Tick, 2.dp.toPx(), at(0.0, 0.0))
            }
            InstrumentKind.PROTRACTOR -> {
                val radius = Instruments.PROTRACTOR_RADIUS
                for (degree in 0..180) {
                    val angle = degree * PI / 180
                    val length = if (degree % 10 == 0) 0.55 else if (degree % 5 == 0) 0.36 else 0.2
                    line(radius * cos(angle), -radius * sin(angle), (radius - length) * cos(angle), -(radius - length) * sin(angle), thin * 0.8f)
                    if (degree % 10 == 0) {
                        text("$degree", (radius - 0.95) * cos(angle), -(radius - 0.95) * sin(angle), 0.26)
                        text("${180 - degree}", (radius - 1.55) * cos(angle), -(radius - 1.55) * sin(angle), 0.19, Border)
                    }
                }
                line(-0.5, 0.0, 0.5, 0.0, thin * 1.4f)
                line(0.0, 0.0, 0.0, -0.5, thin * 1.4f)
            }
            InstrumentKind.COMPASS -> Unit
        }
    }

    val (label, position) = state.measure?.let { (text, point) -> text to px(point).let { Offset(it.x, it.y - 44.dp.toPx()) } }
        ?: when (kind) {
            InstrumentKind.COMPASS -> {
                val tip = px(Instruments.compassTip(pose))
                val center = px(pose.center)
                "r = ${Instruments.formatCm(pose.radiusCm)}" to Offset((center.x + tip.x) / 2, (center.y + tip.y) / 2 - 18.dp.toPx())
            }
            InstrumentKind.RULER -> Instruments.formatDegrees(Instruments.rotationDegrees(pose)) to at(0.0, 0.0)
            InstrumentKind.SET_SQUARE -> Instruments.formatDegrees(Instruments.rotationDegrees(pose)) to at(0.0, 2.3)
            InstrumentKind.PROTRACTOR -> Instruments.formatDegrees(Instruments.rotationDegrees(pose)) to at(0.0, -2.2)
        }
    paint.textSize = 13.dp.toPx()
    paint.color = android.graphics.Color.WHITE
    val width = paint.measureText(label) + 16.dp.toPx()
    val height = 13.dp.toPx() + 8.dp.toPx()
    drawRoundRect(
        Tick.copy(alpha = 0.85f),
        Offset(position.x - width / 2, position.y - height / 2),
        Size(width, height),
        CornerRadius(height / 2),
    )
    drawContext.canvas.nativeCanvas.drawText(label, position.x, position.y + paint.textSize * 0.35f, paint)
}
