package de.maxifrz.lernwerk.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * Pip, the pixel cat from Quill, walking on the tutor's input bar. Thinks while the tutor waits,
 * meows when poked and can be picked up and dropped.
 */
@Composable
fun PipView(isThinking: Boolean, modifier: Modifier = Modifier) {
    val pip = remember { PipSimulation() }
    val thinking by rememberUpdatedState(isThinking)
    var frameTick by remember { mutableLongStateOf(0L) }
    val density = LocalDensity.current
    val dark = Quill.colors.isDark
    var laneDp by remember { androidx.compose.runtime.mutableFloatStateOf(0f) }

    LaunchedEffect(Unit) {
        var last = 0L
        while (true) {
            withFrameNanos { now ->
                if (last != 0L) pip.advance((now - last) / 1_000_000_000.0, laneDp, thinking)
                last = now
                frameTick = now
            }
        }
    }

    Box(
        modifier
            .fillMaxWidth()
            .height(56.dp)
            .onSizeChanged { laneDp = maxOf(0f, it.width / density.density - PipSimulation.WIDTH) },
        contentAlignment = Alignment.BottomStart,
    ) {
        Canvas(
            Modifier
                .offset { IntOffset((pip.x * density.density).roundToInt(), (pip.y * density.density).roundToInt()) }
                .size(PipSimulation.WIDTH.dp, PipSimulation.HEIGHT.dp)
                .pointerInput(Unit) {
                    awaitEachGesture {
                        val down = awaitFirstDown()
                        pip.grab()
                        down.consume()
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            if (!change.pressed) break
                            val delta = change.positionChange() / density.density
                            pip.drag(delta.x, delta.y, laneDp)
                            change.consume()
                        }
                        pip.release()
                    }
                },
        ) {
            frameTick.let { pip.draw(this, dark, isThinking) }
        }
        pip.saying?.let { saying ->
            QText(
                saying,
                pixel(9f).copy(letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified),
                Quill.colors.bg,
                Modifier
                    .offset { IntOffset((pip.x * density.density).roundToInt(), ((pip.y - PipSimulation.HEIGHT - 6) * density.density).roundToInt()) }
                    .background(Quill.colors.ink, RoundedCornerShape(9.dp))
                    .padding(horizontal = 9.dp, vertical = 5.dp),
            )
        }
    }
}

private operator fun Offset.div(value: Float) = Offset(x / value, y / value)

/** Frame-based port of the prototype's canvas animation, stepped at 60 Hz. Units are dp. */
class PipSimulation {
    companion object {
        const val PIXEL = 3f
        const val GRID_WIDTH = 16
        const val GRID_HEIGHT = 18
        const val WIDTH = GRID_WIDTH * PIXEL
        const val HEIGHT = GRID_HEIGHT * PIXEL

        private const val BODY_Y = 5
        private val cat = listOf(
            ".............",
            ".oo.......oo.",
            ".opo.....opo.",
            ".offo...offo.",
            ".offfffffffo.",
            "offfffffffffo",
            "offeefffeeffo",
            "offeefffeeffo",
            "offfffpfffffo",
            "offfffffffffo",
            ".offfffffffo.",
            ".offwwfffwwo.",
            "..ooooooooo..",
        ).map { it.toCharArray() }
        private val tails = listOf(
            listOf(12 to 10, 13 to 10, 14 to 9, 14 to 8),
            listOf(12 to 10, 13 to 9, 14 to 8, 14 to 7),
            listOf(12 to 11, 13 to 10, 14 to 10, 15 to 9),
        )
        private val draggedTail = listOf(12 to 9, 13 to 8, 13 to 7, 13 to 6)
        private val sayings = listOf("mrrp!", "nyah~", "hey!", "*stretch*", "hm?", "prrr")
    }

    var x by androidx.compose.runtime.mutableFloatStateOf(10f)
        private set
    var y by androidx.compose.runtime.mutableFloatStateOf(0f)
        private set
    var saying: String? by androidx.compose.runtime.mutableStateOf(null)
        private set

    private var direction = 1f
    private var frame = 0
    private var blink = 0
    private var squash = 0
    private var velocity = 0f
    private var pause = 40.0
    private var sayFrames = 0
    private var thinking = false
    private var isDragging = false
    private var dragDistance = 0f
    private var pendingFrames = 0.0

    fun advance(seconds: Double, lane: Float, thinking: Boolean) {
        this.thinking = thinking
        pendingFrames += minOf(seconds, 0.25) * 60
        while (pendingFrames >= 1) {
            tick(lane)
            pendingFrames -= 1
        }
    }

    fun grab() {
        isDragging = true
        dragDistance = 0f
        velocity = 0f
    }

    fun drag(dx: Float, dy: Float, lane: Float) {
        dragDistance += abs(dx) + abs(dy)
        x = (x + dx).coerceIn(-8f, lane + 8f)
        y = (y + dy).coerceIn(-420f, 0f)
    }

    fun release() {
        if (!isDragging) return
        isDragging = false
        velocity = 0f
        if (dragDistance < 6) {
            squash = 14
            say(sayings.random())
        } else {
            say(if (y < -40) "wheee" else "mrrp!")
        }
    }

    private fun say(text: String) {
        saying = text
        sayFrames = 90
    }

    private fun tick(lane: Float) {
        frame++
        if (blink > 0) blink-- else if (Random.nextDouble() < 0.006) blink = 9
        if (squash > 0) squash--

        if (!isDragging) {
            if (y < 0 || velocity != 0f) {
                velocity += 1.6f
                y += velocity
                if (y >= 0) {
                    y = 0f
                    velocity = 0f
                    squash = 8
                }
            } else if (!thinking) {
                if (pause > 0) {
                    pause--
                } else {
                    x += direction * 0.7f
                    if (x < 0) {
                        x = 0f; direction = 1f; pause = Random.nextDouble(30.0, 120.0)
                    }
                    if (x > lane) {
                        x = lane; direction = -1f; pause = Random.nextDouble(30.0, 120.0)
                    }
                    if (Random.nextDouble() < 0.004) {
                        direction *= -1; pause = Random.nextDouble(20.0, 90.0)
                    }
                }
            }
        }

        if (sayFrames > 0) {
            sayFrames--
            if (sayFrames == 0) saying = null
        }
    }

    fun draw(scope: DrawScope, dark: Boolean, showsThinkingDots: Boolean) = with(scope) {
        val outline = hex(if (dark) 0x0A0A08 else 0x23231F)
        val fur = hex(0x7FA98C)
        val palette = mapOf('o' to outline, 'e' to outline, 'f' to fur, 'p' to hex(0xE5A8A2), 'w' to hex(0xFFFDF6))

        val grid = cat.map { it.copyOf() }
        fun set(gx: Int, gy: Int, value: Char) {
            if (gy in grid.indices && gx in grid[gy].indices) grid[gy][gx] = value
        }
        val eyes = listOf(3 to 6, 4 to 6, 9 to 6, 10 to 6, 3 to 7, 4 to 7, 9 to 7, 10 to 7)
        when {
            blink > 4 -> {
                eyes.forEach { set(it.first, it.second, 'f') }
                listOf(3 to 7, 4 to 7, 9 to 7, 10 to 7).forEach { set(it.first, it.second, 'o') }
            }
            isDragging -> {
                listOf(3 to 5, 4 to 5, 9 to 5, 10 to 5).forEach { set(it.first, it.second, 'e') }
                set(3, 6, 'w'); set(9, 6, 'w'); set(6, 9, 'o'); set(7, 9, 'o')
            }
            thinking -> {
                eyes.forEach { set(it.first, it.second, 'f') }
                listOf(3 to 6, 4 to 6, 9 to 6, 10 to 6).forEach { set(it.first, it.second, 'e') }
            }
        }

        val tail = if (isDragging) draggedTail else tails[(frame / (if (thinking) 7 else 16)) % 3]
        val step = if (!thinking && pause <= 0 && !isDragging) (frame / 9) % 2 else 0
        val bob = if (isDragging) 0 else if (thinking) (frame / 14) % 2 else step
        val squashScale = if (squash > 0) 1 - squash / 34f else 1f
        val s = PIXEL.dp.toPx()
        val height = size.height

        fun fill(gx: Int, gy: Int, color: Color, offsetY: Int = BODY_Y) {
            val top = (gy + offsetY + bob) * s
            val squashedTop = height - (height - top) * squashScale
            drawRect(color, Offset(gx * s, squashedTop), Size(s, s * squashScale))
        }

        val occupied = mutableSetOf<Int>()
        grid.forEachIndexed { gy, row -> row.forEachIndexed { gx, value -> if (value != '.') occupied += gy * 100 + gx } }
        tail.forEach { occupied += it.second * 100 + it.first }
        for ((tx, ty) in tail) {
            for ((dx, dy) in listOf(1 to 0, -1 to 0, 0 to 1, 0 to -1)) {
                if ((ty + dy) * 100 + tx + dx !in occupied) fill(tx + dx, ty + dy, outline)
            }
        }
        tail.forEach { fill(it.first, it.second, fur) }
        grid.forEachIndexed { gy, row ->
            row.forEachIndexed { gx, value -> if (value != '.') fill(gx, gy, palette[value] ?: outline) }
        }

        if (showsThinkingDots) {
            val active = (frame / 12) % 3
            val on = hex(if (dark) 0xF1EFE7 else 0x23231F)
            val off = if (dark) hex(0xF1EFE7, 0.2f) else hex(0x23231F, 0.15f)
            for (index in 0 until 3) {
                drawRect(
                    if (index <= active) on else off,
                    Offset((5 + index * 2) * s, (if (index == active) 0 else 1) * s),
                    Size(s, s),
                )
            }
        }
    }
}
