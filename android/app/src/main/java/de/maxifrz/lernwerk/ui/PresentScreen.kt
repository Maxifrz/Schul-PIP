package de.maxifrz.lernwerk.ui

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlinx.coroutines.delay

/** Full-screen presenting: tap right/left to move, hold and drag for a laser pointer, notes on demand. */
@Composable
fun PresentScreen(app: AppState, presentationId: String, startSlide: Int) {
    val presentation = app.presentations.presentation(presentationId)
    if (presentation == null || presentation.slides.isEmpty()) {
        LaunchedEffect(Unit) { app.pop() }
        return
    }
    val slides = presentation.slides
    var index by rememberSaveable { mutableIntStateOf(startSlide.coerceIn(0, slides.lastIndex)) }
    var showNotes by rememberSaveable { mutableStateOf(false) }
    var laser by remember { mutableStateOf<Offset?>(null) }
    val started = remember { System.currentTimeMillis() }
    var now by remember { mutableLongStateOf(started) }
    val images = rememberSlideImages(app.presentations, slides, 2000)
    val focus = remember { FocusRequester() }
    val view = LocalView.current

    DisposableEffect(Unit) {
        val window = (view.context as? Activity)?.window
        val controller = window?.let { WindowCompat.getInsetsController(it, view) }
        controller?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller?.hide(WindowInsetsCompat.Type.systemBars())
        onDispose { controller?.show(WindowInsetsCompat.Type.systemBars()) }
    }
    LaunchedEffect(Unit) {
        focus.requestFocus()
        while (true) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }
    BackHandler { app.pop() }

    fun next() {
        index = minOf(slides.lastIndex, index + 1)
    }

    fun previous() {
        index = maxOf(0, index - 1)
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(focus)
            .focusable()
            // Presenter remotes and keyboards send arrow, page or space keys.
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (event.key) {
                    Key.DirectionRight, Key.DirectionDown, Key.PageDown, Key.Spacebar, Key.Enter -> { next(); true }
                    Key.DirectionLeft, Key.DirectionUp, Key.PageUp -> { previous(); true }
                    else -> false
                }
            },
    ) {
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            val width = minOf(maxWidth, maxHeight * 16f / 9f)
            Box(
                Modifier
                    .size(width, width * 9f / 16f)
                    .pointerInput(slides.size) {
                        awaitEachGesture {
                            val down = awaitFirstDown()
                            val startTime = System.currentTimeMillis()
                            var dragged = false
                            while (true) {
                                val event = awaitPointerEvent()
                                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                                if (!change.pressed) break
                                val held = System.currentTimeMillis() - startTime > 250
                                if (dragged || held || (change.position - down.position).getDistance() > viewConfiguration.touchSlop) {
                                    dragged = true
                                    laser = change.position
                                }
                                change.consume()
                            }
                            laser = null
                            if (!dragged) {
                                if (down.position.x < size.width / 3f) previous() else next()
                            }
                        }
                    },
            ) {
                Crossfade(index, Modifier.fillMaxSize(), animationSpec = tween(200), label = "slide") { shown ->
                    SlideView(slides[shown], presentation.theme, images, Modifier.fillMaxSize())
                }
                laser?.let { point ->
                    Canvas(Modifier.fillMaxSize()) {
                        drawCircle(
                            Brush.radialGradient(listOf(Color(0x99FF3B30), Color(0x00FF3B30)), center = point, radius = 26.dp.toPx()),
                            26.dp.toPx(),
                            point,
                        )
                        drawCircle(Color(0xFFFF3B30), 6.dp.toPx(), point)
                    }
                }
            }
            Row(
                Modifier.align(Alignment.TopEnd).padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                PresentChip(if (showNotes) "Notizen aus" else "Notizen") { showNotes = !showNotes }
                PresentChip("Beenden") { app.pop() }
            }
        }
        if (showNotes) {
            PresenterBar(
                notes = slides[index].notes,
                position = "${index + 1} / ${slides.size}",
                elapsed = (now - started) / 1000,
                plannedMinutes = presentation.minutes,
                next = slides.getOrNull(index + 1),
                theme = presentation.theme,
                images = images,
            )
        }
    }
}

@Composable
private fun PresentChip(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .height(32.dp)
            .background(Color(0x66000000), CircleShape)
            .pressable(CircleShape, onClick = onClick)
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        QText(label, work(13f, FontWeight.Medium), Color.White)
    }
}

@Composable
private fun PresenterBar(
    notes: String,
    position: String,
    elapsed: Long,
    plannedMinutes: Int,
    next: de.maxifrz.lernwerk.present.Slide?,
    theme: de.maxifrz.lernwerk.present.SlideTheme,
    images: Map<String, android.graphics.Bitmap>,
) {
    val over = elapsed > plannedMinutes * 60L
    Row(
        Modifier.fillMaxWidth().height(200.dp).background(Color(0xFF16150F)).padding(18.dp),
        horizontalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Column(Modifier.width(150.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            QText(position, work(28f, FontWeight.Light), Color.White)
            QText(
                "%d:%02d".format(elapsed / 60, elapsed % 60) + " / $plannedMinutes:00",
                work(15f).copy(fontFeatureSettings = "tnum"),
                if (over) hex(0xD6A762) else Color(0xFF9B978D),
            )
        }
        Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())) {
            PixelCaption("Notizen", color = Color(0xFF807C73), size = 9f)
            QText(notes.ifBlank { "Keine Notizen für diese Folie." }, work(18f, lineHeight = 27f), Color(0xFFF1EFE7), Modifier.padding(top = 8.dp))
        }
        Column(Modifier.width(220.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            PixelCaption("Als Nächstes", color = Color(0xFF807C73), size = 9f)
            if (next != null) {
                SlideView(next, theme, images, Modifier.fillMaxWidth().background(Color.Black, RoundedCornerShape(4.dp)))
            } else {
                QText("Ende der Präsentation", work(14f), Color(0xFF9B978D))
            }
        }
    }
}
