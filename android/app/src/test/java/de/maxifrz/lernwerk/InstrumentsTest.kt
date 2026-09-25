package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.ink.InstrumentKind
import de.maxifrz.lernwerk.ink.InstrumentPose
import de.maxifrz.lernwerk.ink.Instruments
import de.maxifrz.lernwerk.ink.Pt
import de.maxifrz.lernwerk.ink.Segment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

class InstrumentsTest {
    private val cm = Instruments.POINTS_PER_CM
    private val a4 = InstrumentPose(center = Pt(300.0, 400.0))

    @Test
    fun trueScaleMakesACentimetreACentimetre() {
        // 420 pixels per inch: a page point must be 5.83 pixels, so a centimetre of the page is 165 pixels.
        val pixelsPerPoint = Instruments.trueScalePixelsPerPoint(420.0)
        assertEquals(420.0 / 2.54, cm * pixelsPerPoint, 0.001)
    }

    @Test
    fun pageAndLocalCoordinatesRoundTrip() {
        val pose = a4.copy(angle = 0.7)
        val local = Pt(3.2, -1.1)
        val back = Instruments.toLocal(Instruments.toPage(local, pose), pose)
        assertEquals(local.x, back.x, 0.0001)
        assertEquals(local.y, back.y, 0.0001)
    }

    @Test
    fun rotationTurnsClockwiseOnScreen() {
        val point = Instruments.toPage(Pt(1.0, 0.0), a4.copy(angle = PI / 2))
        assertEquals(300.0, point.x, 0.001)
        assertEquals(400.0 + cm, point.y, 0.001)
    }

    @Test
    fun containsFollowsTheShape() {
        assertTrue(Instruments.contains(Pt(300.0, 400.0), InstrumentKind.RULER, a4))
        assertFalse(Instruments.contains(Pt(300.0, 400.0 + 2 * cm), InstrumentKind.RULER, a4))
        assertTrue(Instruments.contains(Pt(300.0, 400.0 + 3 * cm), InstrumentKind.SET_SQUARE, a4))
        assertFalse(Instruments.contains(Pt(300.0, 400.0 - cm), InstrumentKind.SET_SQUARE, a4))
        assertFalse(Instruments.contains(Pt(300.0 + 7 * cm, 400.0 + 3 * cm), InstrumentKind.SET_SQUARE, a4))
        assertTrue(Instruments.contains(Pt(300.0, 400.0 - 3 * cm), InstrumentKind.PROTRACTOR, a4))
        assertFalse(Instruments.contains(Pt(300.0, 400.0 + cm), InstrumentKind.PROTRACTOR, a4))
        assertFalse(Instruments.contains(Pt(300.0, 400.0), InstrumentKind.COMPASS, a4))
    }

    @Test
    fun nearestEdgeWithinBand() {
        assertEquals(0, Instruments.nearestEdge(Pt(320.0, 400 - 1.6 * cm - 10), InstrumentKind.RULER, a4, 20.0))
        assertEquals(1, Instruments.nearestEdge(Pt(320.0, 400 + 1.6 * cm + 10), InstrumentKind.RULER, a4, 20.0))
        assertNull(Instruments.nearestEdge(Pt(320.0, 400 - 1.6 * cm - 40), InstrumentKind.RULER, a4, 20.0))
        assertNull(Instruments.nearestEdge(Pt(0.0, 0.0), InstrumentKind.COMPASS, a4, 1000.0))
    }

    @Test
    fun snappedLineRunsAlongTheEdgeOutsideAndIsClamped() {
        val line = Instruments.snappedLine(Pt(250.0, 400 - 1.6 * cm - 8), Pt(350.0, 400 - 1.6 * cm - 15), 0, InstrumentKind.RULER, a4, 2.0)
        assertEquals(400 - 1.6 * cm - 2, line.start.y, 0.001)
        assertEquals(line.start.y, line.end.y, 0.001)
        assertEquals(250.0, line.start.x, 0.001)
        assertEquals(350.0, line.end.x, 0.001)
        val long = Instruments.snappedLine(Pt(300.0, 350.0), Pt(2000.0, 350.0), 0, InstrumentKind.RULER, a4, 0.0)
        assertEquals(300 + 8.5 * cm, long.end.x, 0.001)
    }

    @Test
    fun setSquareLegsAreAt45DegreesAndNormalsPointOut() {
        val edges = Instruments.edges(InstrumentKind.SET_SQUARE, a4)
        assertEquals(0.0, Instruments.lineDegrees(edges[0].start, edges[0].end), 0.001)
        assertEquals(135.0, Instruments.lineDegrees(edges[1].start, edges[1].end), 0.001)
        assertEquals(45.0, Instruments.lineDegrees(edges[2].start, edges[2].end), 0.001)
        assertEquals(-1.0, Instruments.outwardNormal(0, InstrumentKind.RULER, a4).y, 0.001)
        assertEquals(1.0, Instruments.outwardNormal(1, InstrumentKind.RULER, a4).y, 0.001)
        assertEquals(-1.0, Instruments.outwardNormal(0, InstrumentKind.SET_SQUARE, a4).y, 0.001)
    }

    @Test
    fun anglesAndRotationSnapping() {
        assertEquals(45.0, Instruments.lineDegrees(Pt(0.0, 0.0), Pt(10.0, -10.0)), 0.001)
        assertEquals(135.0, Instruments.lineDegrees(Pt(0.0, 0.0), Pt(10.0, 10.0)), 0.001)
        assertEquals(0.0, Instruments.lineDegrees(Pt(0.0, 0.0), Pt(-10.0, 0.0)), 0.001)
        assertEquals(30.0, Instruments.rotationDegrees(a4.copy(angle = -30 * PI / 180)), 0.001)
        assertEquals(31.0, Instruments.snapRotation(31.4 * PI / 180) * 180 / PI, 0.0001)
        assertEquals(45.0, Instruments.snapRotation(43.5 * PI / 180) * 180 / PI, 0.0001)
        assertEquals(-90.0, Instruments.snapRotation(-88.6 * PI / 180) * 180 / PI, 0.0001)
    }

    @Test
    fun protractorRayUsesWholeDegrees() {
        val ray = Instruments.protractorRay(Pt(300 + 4 * cm * cos(0.52), 400 - 4 * cm * sin(0.52)), a4)
        assertNotNull(ray)
        assertEquals(30, ray!!.degrees)
        assertEquals(4 * cm, Instruments.distance(ray.end, a4.center), 0.01)
        assertEquals(0, Instruments.protractorRay(Pt(300 + 4 * cm, 400 + 0.2 * cm), a4)?.degrees)
        assertEquals(180, Instruments.protractorRay(Pt(300 - 4 * cm, 400 + 0.2 * cm), a4)?.degrees)
        assertNull(Instruments.protractorRay(Pt(300.0, 400 + 3 * cm), a4))
    }

    @Test
    fun compassRadiusTipAndSweeps() {
        assertEquals(3.0, Instruments.compassRadius(Pt(300 + 3.04 * cm, 400.0), a4), 0.0001)
        assertEquals(5.3, Instruments.compassRadius(Pt(300.0, 400 + 5.26 * cm), a4), 0.0001)
        assertEquals(0.2, Instruments.compassRadius(Pt(300.0, 400.0), a4), 0.0001)
        val tip = Instruments.compassTip(a4.copy(radiusCm = 2.0, angle = PI))
        assertEquals(300 - 2 * cm, tip.x, 0.001)
        var sweep = 0.0
        var previous = 0.0
        for (step in 1..40) {
            val next = Instruments.direction(Pt(0.0, 0.0), Pt(cos(step * 0.2), sin(step * 0.2)))
            sweep += Instruments.angleStep(previous, next)
            previous = next
        }
        assertEquals(8.0, sweep, 0.0001)
        val points = Instruments.arc(Pt(10.0, 10.0), 50.0, 0.0, 10.0)
        assertEquals(361, points.size)
        points.forEach { assertEquals(50.0, Instruments.distance(it, Pt(10.0, 10.0)), 0.0001) }
    }

    @Test
    fun oneFingerMovesTwoFingersTurn() {
        val moved = Instruments.moved(a4, listOf(Pt(310.0, 400.0)), listOf(Pt(330.0, 390.0)))
        assertEquals(320.0, moved.center.x, 0.0001)
        assertEquals(390.0, moved.center.y, 0.0001)
        assertEquals(0.0, moved.angle, 0.0001)
        // Two fingers on either side of the centre, turned by a quarter: the ruler turns about them.
        val turned = Instruments.moved(a4, listOf(Pt(250.0, 400.0), Pt(350.0, 400.0)), listOf(Pt(300.0, 350.0), Pt(300.0, 450.0)))
        assertEquals(PI / 2, turned.angle, 0.0001)
        assertEquals(300.0, turned.center.x, 0.0001)
        assertEquals(400.0, turned.center.y, 0.0001)
        // A turn of 43.6 degrees lands on 45.
        val a = 43.6 * PI / 180
        val nearly = Instruments.moved(a4, listOf(Pt(250.0, 400.0), Pt(350.0, 400.0)), listOf(Pt(300 - 50 * cos(a), 400 - 50 * sin(a)), Pt(300 + 50 * cos(a), 400 + 50 * sin(a))))
        assertEquals(45.0, nearly.angle * 180 / PI, 0.0001)
    }

    @Test
    fun sampledLineAndFormatting() {
        val points = Instruments.sampled(Segment(Pt(0.0, 0.0), Pt(10.0, 0.0)), 3.0)
        assertEquals(5, points.size)
        assertEquals(10.0, points.last().x, 0.0001)
        assertEquals("5,3 cm", Instruments.formatCm(5.26))
        assertEquals("45°", Instruments.formatDegrees(44.6))
    }
}
