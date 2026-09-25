package de.maxifrz.lernwerk.ink

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * The drawing instruments of the notes: they lie on a page, move and rotate with two fingers, and pen strokes along
 * their edges come out straight.
 */
enum class InstrumentKind(val label: String) {
    RULER("Lineal"), SET_SQUARE("Geodreieck"), PROTRACTOR("Winkelmesser"), COMPASS("Zirkel"),
}

data class Pt(val x: Double, val y: Double) {
    operator fun plus(other: Pt) = Pt(x + other.x, y + other.y)
    operator fun minus(other: Pt) = Pt(x - other.x, y - other.y)
}

/**
 * Where an instrument lies on a page. Positions are in page coordinates; [angle] turns it clockwise on screen, in
 * radians; [unitsPerCm] is how many page units one centimetre of the printed page has.
 */
data class InstrumentPose(
    val center: Pt,
    val angle: Double = 0.0,
    val unitsPerCm: Double = Instruments.POINTS_PER_CM,
    /** The compass opening. */
    val radiusCm: Double = 4.0,
)

data class Segment(val start: Pt, val end: Pt) {
    val length: Double get() = Instruments.distance(start, end)
}

data class Ray(val end: Pt, val degrees: Int)

object Instruments {
    /** PDF points in a centimetre: A4 is 595 points or 21 cm wide. */
    const val POINTS_PER_CM = 72.0 / 2.54

    /** Screen pixels per page point at which a centimetre of the page is a centimetre on the glass. */
    fun trueScalePixelsPerPoint(pixelsPerInch: Double): Double = pixelsPerInch / 72.0

    // Shapes, in centimetres, with the instrument's own origin and axes

    /** A 17 cm ruler with a 16 cm scale. */
    const val RULER_HALF_LENGTH = 8.5
    const val RULER_HALF_HEIGHT = 1.6
    /** A set square (Geodreieck): the long edge carries a millimetre scale from -7 to 7 cm with its zero at the origin. */
    const val SET_SQUARE_HALF_LENGTH = 8.4
    /** A half-circle protractor whose centre lies on its straight edge. */
    const val PROTRACTOR_RADIUS = 6.2

    fun localOutline(kind: InstrumentKind): List<Pt> = when (kind) {
        InstrumentKind.RULER -> {
            val w = RULER_HALF_LENGTH
            val h = RULER_HALF_HEIGHT
            listOf(Pt(-w, -h), Pt(w, -h), Pt(w, h), Pt(-w, h))
        }
        InstrumentKind.SET_SQUARE -> {
            val w = SET_SQUARE_HALF_LENGTH
            listOf(Pt(-w, 0.0), Pt(w, 0.0), Pt(0.0, w))
        }
        InstrumentKind.PROTRACTOR -> (0..36).map { step ->
            val angle = PI * step / 36
            Pt(PROTRACTOR_RADIUS * cos(angle), -PROTRACTOR_RADIUS * sin(angle))
        }
        InstrumentKind.COMPASS -> emptyList()
    }

    fun localEdges(kind: InstrumentKind): List<Segment> = when (kind) {
        InstrumentKind.RULER -> {
            val w = RULER_HALF_LENGTH
            val h = RULER_HALF_HEIGHT
            listOf(Segment(Pt(-w, -h), Pt(w, -h)), Segment(Pt(-w, h), Pt(w, h)))
        }
        InstrumentKind.SET_SQUARE -> {
            val w = SET_SQUARE_HALF_LENGTH
            listOf(Segment(Pt(-w, 0.0), Pt(w, 0.0)), Segment(Pt(-w, 0.0), Pt(0.0, w)), Segment(Pt(w, 0.0), Pt(0.0, w)))
        }
        InstrumentKind.PROTRACTOR -> listOf(Segment(Pt(-PROTRACTOR_RADIUS, 0.0), Pt(PROTRACTOR_RADIUS, 0.0)))
        InstrumentKind.COMPASS -> emptyList()
    }

    // Page and instrument coordinates

    fun toPage(local: Pt, pose: InstrumentPose): Pt {
        val x = local.x * pose.unitsPerCm
        val y = local.y * pose.unitsPerCm
        val c = cos(pose.angle)
        val s = sin(pose.angle)
        return Pt(pose.center.x + x * c - y * s, pose.center.y + x * s + y * c)
    }

    fun toLocal(page: Pt, pose: InstrumentPose): Pt {
        val dx = page.x - pose.center.x
        val dy = page.y - pose.center.y
        val c = cos(pose.angle)
        val s = sin(pose.angle)
        val scale = max(pose.unitsPerCm, 0.0001)
        return Pt((dx * c + dy * s) / scale, (-dx * s + dy * c) / scale)
    }

    fun edges(kind: InstrumentKind, pose: InstrumentPose): List<Segment> =
        localEdges(kind).map { Segment(toPage(it.start, pose), toPage(it.end, pose)) }

    fun contains(point: Pt, kind: InstrumentKind, pose: InstrumentPose): Boolean {
        val polygon = localOutline(kind)
        if (polygon.size < 3) return false
        val p = toLocal(point, pose)
        var inside = false
        var j = polygon.size - 1
        for (i in polygon.indices) {
            val a = polygon[i]
            val b = polygon[j]
            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
            j = i
        }
        return inside
    }

    // Snapping

    /** The edge closest to [point] when it is no further than [band] page units away from it. */
    fun nearestEdge(point: Pt, kind: InstrumentKind, pose: InstrumentPose, band: Double): Int? {
        var best: Int? = null
        var bestDistance = Double.MAX_VALUE
        edges(kind, pose).forEachIndexed { index, edge ->
            val distance = distance(point, project(point, edge))
            if (distance <= band && distance < bestDistance) {
                best = index
                bestDistance = distance
            }
        }
        return best
    }

    /** The point of the edge closest to [point]. */
    fun project(point: Pt, edge: Segment): Pt {
        val dx = edge.end.x - edge.start.x
        val dy = edge.end.y - edge.start.y
        val lengthSquared = dx * dx + dy * dy
        if (lengthSquared <= 0) return edge.start
        val t = ((point.x - edge.start.x) * dx + (point.y - edge.start.y) * dy) / lengthSquared
        val clamped = min(max(t, 0.0), 1.0)
        return Pt(edge.start.x + clamped * dx, edge.start.y + clamped * dy)
    }

    /** The unit vector from an edge away from the instrument, so a line drawn along it lies beside it. */
    fun outwardNormal(index: Int, kind: InstrumentKind, pose: InstrumentPose): Pt {
        val edge = edges(kind, pose)[index]
        val dx = edge.end.x - edge.start.x
        val dy = edge.end.y - edge.start.y
        val length = max(sqrt(dx * dx + dy * dy), 0.0001)
        val normal = Pt(-dy / length, dx / length)
        val middle = Pt((edge.start.x + edge.end.x) / 2, (edge.start.y + edge.end.y) / 2)
        val body = toPage(centroid(kind), pose)
        return if (normal.x * (body.x - middle.x) + normal.y * (body.y - middle.y) > 0) Pt(-normal.x, -normal.y) else normal
    }

    /**
     * The straight line a pen draws along an edge: from where it started to where it is now, both moved onto the edge
     * and [offset] units outwards.
     */
    fun snappedLine(start: Pt, current: Pt, edge: Int, kind: InstrumentKind, pose: InstrumentPose, offset: Double): Segment {
        val segment = edges(kind, pose)[edge]
        val normal = outwardNormal(edge, kind, pose)
        fun place(point: Pt): Pt {
            val onEdge = project(point, segment)
            return Pt(onEdge.x + normal.x * offset, onEdge.y + normal.y * offset)
        }
        return Segment(place(start), place(current))
    }

    // Angles

    /** The angle of a line against the page's horizontal, counterclockwise like in maths, from 0 up to 180 degrees. */
    fun lineDegrees(a: Pt, b: Pt): Double = normalized(atan2(-(b.y - a.y), b.x - a.x) * 180 / PI, 180.0)

    /** How far the instrument's main edge is turned against the page's horizontal, like [lineDegrees]. */
    fun rotationDegrees(pose: InstrumentPose): Double = normalized(-pose.angle * 180 / PI, 180.0)

    /** Rotation lands on whole degrees, and on multiples of 45 degrees when it is within 2 degrees of one. */
    fun snapRotation(angle: Double): Double {
        val degrees = angle * 180 / PI
        val nearest45 = Math.round(degrees / 45).toDouble() * 45
        val snapped = if (abs(degrees - nearest45) <= 2) nearest45 else Math.round(degrees).toDouble()
        return snapped * PI / 180
    }

    /**
     * Where fingers take an instrument: one finger moves it, two move and turn it about their middle, with the turn
     * snapped like [snapRotation]. [from] are the fingers when the gesture started at [start], [to] where they are now.
     */
    fun moved(start: InstrumentPose, from: List<Pt>, to: List<Pt>): InstrumentPose {
        if (from.isEmpty() || to.isEmpty()) return start
        if (from.size < 2 || to.size < 2) return start.copy(center = start.center + (to[0] - from[0]))
        val turn = direction(to[0], to[1]) - direction(from[0], from[1])
        val angle = snapRotation(start.angle + turn)
        val delta = angle - start.angle
        val startMid = Pt((from[0].x + from[1].x) / 2, (from[0].y + from[1].y) / 2)
        val mid = Pt((to[0].x + to[1].x) / 2, (to[0].y + to[1].y) / 2)
        val dx = start.center.x - startMid.x
        val dy = start.center.y - startMid.y
        return start.copy(
            center = Pt(mid.x + dx * cos(delta) - dy * sin(delta), mid.y + dx * sin(delta) + dy * cos(delta)),
            angle = angle,
        )
    }

    /**
     * A ray from the protractor's centre towards [point], at whole degrees measured from its straight edge, and the
     * degrees; null when the point is below the straight edge.
     */
    fun protractorRay(point: Pt, pose: InstrumentPose): Ray? {
        val local = toLocal(point, pose)
        val length = sqrt(local.x * local.x + local.y * local.y)
        if (length <= 0.05) return null
        var degrees = Math.round(atan2(-local.y, local.x) * 180 / PI).toInt()
        if (degrees < 0) {
            // Just below the edge counts as the edge itself.
            if (degrees < -10 && degrees > -170) return null
            degrees = if (degrees >= -10) 0 else 180
        }
        val radians = degrees * PI / 180
        return Ray(toPage(Pt(length * cos(radians), -length * sin(radians)), pose), degrees)
    }

    // Compass

    /** Where the compass pencil is: the pin at the pose's centre, opened [InstrumentPose.radiusCm] towards its angle. */
    fun compassTip(pose: InstrumentPose): Pt {
        val radius = pose.radiusCm * pose.unitsPerCm
        return Pt(pose.center.x + radius * cos(pose.angle), pose.center.y + radius * sin(pose.angle))
    }

    /** The compass opening for a pencil at [point], in whole millimetres, at least 2 mm. */
    fun compassRadius(point: Pt, pose: InstrumentPose): Double {
        val cm = distance(point, pose.center) / max(pose.unitsPerCm, 0.0001)
        return max(0.2, Math.round(cm * 10) / 10.0)
    }

    fun direction(from: Pt, to: Pt): Double = atan2(to.y - from.y, to.x - from.x)

    /** The change from one direction to the next, taking the short way round, so sweeps add up past a full turn. */
    fun angleStep(previous: Double, next: Double): Double {
        var step = next - previous
        while (step > PI) step -= 2 * PI
        while (step <= -PI) step += 2 * PI
        return step
    }

    /** Points along an arc around [center], from [start] turning by [sweep] radians (at most a full circle). */
    fun arc(center: Pt, radius: Double, start: Double, sweep: Double): List<Pt> {
        val clamped = min(max(sweep, -2 * PI), 2 * PI)
        val steps = max(1, ceil(abs(clamped) * 180 / PI).toInt())
        return (0..steps).map { step ->
            val angle = start + clamped * step / steps
            Pt(center.x + radius * cos(angle), center.y + radius * sin(angle))
        }
    }

    // Lines

    /** Points along a segment about [spacing] apart, so the ink looks the same as a drawn stroke. */
    fun sampled(segment: Segment, spacing: Double): List<Pt> {
        val steps = max(1, ceil(segment.length / max(spacing, 0.1)).toInt())
        return (0..steps).map { step ->
            val t = step.toDouble() / steps
            Pt(segment.start.x + (segment.end.x - segment.start.x) * t, segment.start.y + (segment.end.y - segment.start.y) * t)
        }
    }

    fun centimetres(length: Double, pose: InstrumentPose): Double = length / max(pose.unitsPerCm, 0.0001)

    /** "5,3 cm": one decimal with a comma, as written in German. */
    fun formatCm(value: Double): String = String.format(java.util.Locale.GERMANY, "%.1f cm", value)

    fun formatDegrees(value: Double): String = "${value.roundToInt() % 360}°"

    fun distance(a: Pt, b: Pt): Double {
        val dx = a.x - b.x
        val dy = a.y - b.y
        return sqrt(dx * dx + dy * dy)
    }

    private fun centroid(kind: InstrumentKind): Pt {
        val outline = localOutline(kind)
        if (outline.isEmpty()) return Pt(0.0, 0.0)
        return Pt(outline.sumOf { it.x } / outline.size, outline.sumOf { it.y } / outline.size)
    }

    private fun normalized(degrees: Double, period: Double): Double {
        var value = degrees % period
        if (value < 0) value += period
        if (value >= period - 0.0001) value = 0.0
        return value
    }
}
