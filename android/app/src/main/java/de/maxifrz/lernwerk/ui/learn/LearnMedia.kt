package de.maxifrz.lernwerk.ui.learn

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.speech.tts.TextToSpeech
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.learn.BoardSpec
import de.maxifrz.lernwerk.learn.StaffSpec
import de.maxifrz.lernwerk.learn.ToneSpec
import de.maxifrz.lernwerk.ui.QText
import de.maxifrz.lernwerk.ui.Quill
import de.maxifrz.lernwerk.ui.WorkSans
import de.maxifrz.lernwerk.ui.pixel
import de.maxifrz.lernwerk.ui.work
import java.util.Locale

// What an exercise shows or plays above its question: a position, a staff, notes to hear, a word to hear, and the
// keyboard to tap a key on. The arithmetic is in LearnGeometry.kt; this file draws it on Compose canvases.

/** The colors of right and wrong, from the app's tokens (the app has no red token, the exam bar's red is used). */
object LearnTone {
    val wrongLight = Color(0xFFB3261E)
    val wrongDark = Color(0xFFE5877F)

    val wrong: Color @Composable get() = if (Quill.colors.isDark) wrongDark else wrongLight
    val right: Color @Composable get() = Quill.colors.link
}

// Chess

private sealed interface PieceShape {
    data class Circle(val cx: Float, val cy: Float, val r: Float) : PieceShape
    data class RRect(val x: Float, val y: Float, val w: Float, val h: Float, val rx: Float) : PieceShape
    data class Outline(val d: String) : PieceShape
}

/** The silhouettes of the pieces in a 100 by 100 box, by FEN letter in lowercase (the desktop's drawings). */
private val pieceShapes: Map<Char, List<PieceShape>> = mapOf(
    'p' to listOf(
        PieceShape.Circle(50f, 29f, 11f), PieceShape.RRect(38f, 42f, 24f, 6f, 3f),
        PieceShape.Outline("M41 48Q43 62 34 78H66Q57 62 59 48Z"), PieceShape.RRect(28f, 78f, 44f, 9f, 3f),
    ),
    'r' to listOf(
        PieceShape.Outline("M30 20H38V27H44V20H56V27H62V20H70V40H30Z"), PieceShape.Outline("M34 40H66L63 72H37Z"),
        PieceShape.RRect(27f, 72f, 46f, 13f, 3f),
    ),
    'n' to listOf(
        PieceShape.Outline("M31 84C31 62 38 52 47 45C40 44 34 46 29 51L24 45C29 33 38 23 50 21L53 13L59 21C71 25 73 44 71 57C70 67 69 76 70 84Z"),
    ),
    'b' to listOf(
        PieceShape.Circle(50f, 13f, 5f), PieceShape.Outline("M50 19C63 29 65 40 57 49H43C35 40 37 29 50 19Z"),
        PieceShape.Outline("M40 49H60L63 72H37Z"), PieceShape.RRect(27f, 72f, 46f, 13f, 3f),
    ),
    'q' to listOf(
        PieceShape.Circle(20f, 27f, 5f), PieceShape.Circle(36f, 19f, 5f), PieceShape.Circle(50f, 15f, 5f),
        PieceShape.Circle(64f, 19f, 5f), PieceShape.Circle(80f, 27f, 5f),
        PieceShape.Outline("M26 72L18 32L36 52L40 26L50 50L60 26L64 52L82 32L74 72Z"), PieceShape.RRect(24f, 72f, 52f, 13f, 3f),
    ),
    'k' to listOf(
        PieceShape.RRect(46.5f, 8f, 7f, 24f, 1.5f), PieceShape.RRect(39f, 15f, 22f, 7f, 1.5f),
        PieceShape.Outline("M33 72Q26 52 36 42Q50 33 64 42Q74 52 67 72Z"), PieceShape.RRect(24f, 72f, 52f, 13f, 3f),
    ),
)

private val piecePaths = java.util.concurrent.ConcurrentHashMap<String, Path>()
private fun piecePath(d: String): Path = piecePaths.getOrPut(d) { PathParser().parsePathString(d).toPath() }

/** One piece drawn into the square whose top left is [origin]: light pieces with a dark edge, dark pieces dark. */
private fun DrawScope.drawPiece(piece: Char, origin: Offset, cell: Float, light: Color, dark: Color) {
    val white = piece.isUpperCase()
    val fill = if (white) light else dark
    val edge = if (white) dark else light.copy(alpha = 0.55f)
    val unit = cell / 100f
    val shapes = pieceShapes[piece.lowercaseChar()] ?: return
    withTransform({
        translate(origin.x, origin.y)
        scale(unit, unit, pivot = Offset.Zero)
    }) {
        for (shape in shapes) {
            when (shape) {
                is PieceShape.Circle -> {
                    drawCircle(fill, shape.r, Offset(shape.cx, shape.cy))
                    drawCircle(edge, shape.r, Offset(shape.cx, shape.cy), style = Stroke(3f))
                }
                is PieceShape.RRect -> {
                    drawRoundRect(fill, Offset(shape.x, shape.y), Size(shape.w, shape.h), CornerRadius(shape.rx), style = Fill)
                    drawRoundRect(edge, Offset(shape.x, shape.y), Size(shape.w, shape.h), CornerRadius(shape.rx), style = Stroke(3f))
                }
                is PieceShape.Outline -> {
                    drawPath(piecePath(shape.d), fill, style = Fill)
                    drawPath(piecePath(shape.d), edge, style = Stroke(3f, join = androidx.compose.ui.graphics.StrokeJoin.Round))
                }
            }
        }
        if (piece.lowercaseChar() == 'n') drawCircle(if (white) dark else light, 2.6f, Offset(55f, 31f))
    }
}

/**
 * A chess board with the pieces of a position. With [onTap] its squares can be used (to find a move); without it the
 * board only shows the position, with the squares in `spec.marked` ringed.
 */
@Composable
fun ChessBoardView(
    spec: BoardSpec,
    modifier: Modifier = Modifier,
    from: String? = null,
    to: String? = null,
    correctMoves: List<String> = emptyList(),
    verdict: Boolean? = null,
    onTap: ((String) -> Unit)? = null,
) {
    val colors = Quill.colors
    val board = remember(spec.fen) { boardPlacement(spec.fen) }
    val measurer = rememberTextMeasurer()
    val lightSquare = if (colors.isDark) lerp(colors.surface, colors.ink, 0.10f) else Color(0xFFEFEDE9)
    val darkSquare = lerp(lightSquare, colors.accent, if (colors.isDark) 0.45f else 0.55f)
    val pieceLight = Color(0xFFFBFAF6)
    val pieceDark = Color(0xFF2A2923)
    val right = LearnTone.right
    val wrong = LearnTone.wrong
    val edge = colors.line2
    val ringColor = colors.warn
    val labelColor = colors.ink.copy(alpha = 0.5f)
    val tapModifier = if (onTap == null) Modifier else Modifier.pointerInput(spec.flipped, onTap) {
        detectTapGestures { offset -> squareAtOffset(offset.x, offset.y, size.width.toFloat(), spec.flipped)?.let(onTap) }
    }
    Canvas(
        modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, edge, RoundedCornerShape(8.dp))
            .semantics { contentDescription = "Schachbrett" }
            .then(tapModifier),
    ) {
        val cell = size.width / 8f
        val label = androidx.compose.ui.text.TextStyle(fontFamily = WorkSans, fontSize = (cell * 0.2f).toSp(), color = labelColor)
        for (row in 0 until 8) for (column in 0 until 8) {
            val square = squareAt(row, column, spec.flipped)
            val origin = Offset(column * cell, row * cell)
            drawRect(if (isDarkSquare(row, column)) darkSquare else lightSquare, origin, Size(cell, cell))
            val mark = squareMark(square, from, to, correctMoves, verdict)
            val tint = when (mark) {
                SquareMark.VERDICT_RIGHT -> right.copy(alpha = 0.55f)
                SquareMark.VERDICT_WRONG -> wrong.copy(alpha = 0.5f)
                SquareMark.SOLUTION -> right.copy(alpha = 0.38f)
                SquareMark.PICK -> ringColor.copy(alpha = 0.45f)
                null -> null
            }
            if (tint != null) drawRect(tint, origin, Size(cell, cell))
            pieceOn(board, square)?.let { drawPiece(it, origin, cell, pieceLight, pieceDark) }
            if (square in spec.marked) {
                drawCircle(ringColor, cell * 0.36f, origin + Offset(cell / 2, cell / 2), style = Stroke(cell * 0.06f))
            }
            if (column == 0) drawText(measurer, square.substring(1), origin + Offset(cell * 0.06f, cell * 0.02f), label)
            if (row == 7) {
                val layout = measurer.measure(square.substring(0, 1), label)
                drawText(layout, topLeft = origin + Offset(cell - layout.size.width - cell * 0.06f, cell - layout.size.height - cell * 0.02f))
            }
        }
    }
}

/** The board of a "find the move" exercise: tap the piece, then the square to move it to. */
@Composable
fun ChessMoveView(
    spec: BoardSpec,
    from: String?,
    to: String?,
    correctMoves: List<String>,
    verdict: Boolean?,
    onTap: (String) -> Unit,
) {
    val colors = Quill.colors
    val side = sideToMove(spec.fen)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (side != null) QText("$side ist am Zug", work(13.5f, FontWeight.Medium), colors.muted)
        ChessBoardView(
            spec, Modifier.widthIn(max = 460.dp).fillMaxWidth(), from, to, correctMoves, verdict,
            onTap = if (verdict == null) onTap else null,
        )
        val hint = moveHint(from, to, verdict)
        if (hint.isNotEmpty()) QText(hint, work(13.5f), colors.muted)
    }
}

// Staff

/** The staff of an ear or reading exercise: clef, key signature, time, notes, rests and chords drawn on a canvas. */
@Composable
fun StaffView(spec: StaffSpec, modifier: Modifier = Modifier) {
    val colors = Quill.colors
    val ink = colors.ink
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current.density
    val description = remember(spec) { staffDescription(spec) }
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val width = minOf(maxWidth.value, 520f)
        val layout = remember(spec, width) { layoutStaff(spec, width) }
        Canvas(
            Modifier
                .size(width.dp, (layout.height).dp)
                .semantics { contentDescription = description },
        ) {
            drawStaff(layout, ink, measurer, density)
        }
    }
}

private fun List<PathSeg>.toPath(scale: Float): Path {
    val path = Path()
    for (segment in this) when (segment) {
        is PathSeg.Move -> path.moveTo(segment.x * scale, segment.y * scale)
        is PathSeg.Line -> path.lineTo(segment.x * scale, segment.y * scale)
        is PathSeg.Quad -> path.quadraticTo(segment.cx * scale, segment.cy * scale, segment.x * scale, segment.y * scale)
        is PathSeg.Cubic -> path.cubicTo(
            segment.c1x * scale, segment.c1y * scale, segment.c2x * scale, segment.c2y * scale, segment.x * scale, segment.y * scale,
        )
        PathSeg.Close -> path.close()
    }
    return path
}

/** Draws a laid-out staff; the layout is in dp, `d` is the density. Public so the tests can render it. */
fun DrawScope.drawStaff(layout: StaffLayout, ink: Color, measurer: TextMeasurer, d: Float) {
    for (primitive in layout.primitives) {
        when (primitive) {
            is StaffPrimitive.Line -> drawLine(
                ink, Offset(primitive.x1 * d, primitive.y1 * d), Offset(primitive.x2 * d, primitive.y2 * d), primitive.width * d,
            )
            is StaffPrimitive.Fill -> drawPath(primitive.path.toPath(d), ink, style = Fill)
            is StaffPrimitive.Stroke -> drawPath(primitive.path.toPath(d), ink, style = Stroke(primitive.width * d, cap = StrokeCap.Round))
            is StaffPrimitive.Ellipse -> rotate(primitive.rotate, Offset(primitive.cx * d, primitive.cy * d)) {
                val topLeft = Offset((primitive.cx - primitive.rx) * d, (primitive.cy - primitive.ry) * d)
                val size = Size(primitive.rx * 2 * d, primitive.ry * 2 * d)
                if (primitive.fill) drawOval(ink, topLeft, size) else drawOval(ink, topLeft, size, style = Stroke(primitive.width * d))
            }
            is StaffPrimitive.Rect -> drawRect(ink, Offset(primitive.x * d, primitive.y * d), Size(primitive.width * d, primitive.height * d))
            is StaffPrimitive.Text -> {
                val style = androidx.compose.ui.text.TextStyle(
                    fontFamily = WorkSans, fontWeight = FontWeight.Bold, fontSize = (primitive.size * d).toSp(), color = ink,
                )
                val text = measurer.measure(primitive.text, style)
                drawText(text, topLeft = Offset(primitive.x * d - text.size.width / 2f, primitive.y * d - text.size.height / 2f))
            }
        }
    }
}

// Piano

/** The keyboard of a "tap the key" exercise: the answer is the key's MIDI number as text. */
@Composable
fun PianoKeysView(
    correct: List<Int>,
    choice: String?,
    verdict: Boolean?,
    onPick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Quill.colors
    val (low, high) = remember(correct) { PianoLayout.range(correct) }
    val whites = remember(low, high) { PianoLayout.whiteKeys(low, high) }
    val blacks = remember(low, high) { (low..high).filter { PianoLayout.isBlack(it) } }
    val right = LearnTone.right
    val wrong = LearnTone.wrong
    fun tint(midi: Int, base: Color): Color {
        val text = midi.toString()
        if (verdict != null) {
            if (midi in correct) return right.copy(alpha = if (verdict == true || choice == text) 0.85f else 0.45f)
            if (choice == text) return wrong.copy(alpha = 0.85f)
        } else if (choice == text) return colors.accent
        return base
    }
    BoxWithConstraints(modifier.fillMaxWidth().height(150.dp).semantics { contentDescription = "Klaviatur" }) {
        val whiteWidth = maxWidth / whites.size
        Row(Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))) {
            for (midi in whites) {
                Box(
                    Modifier
                        .weight(1f)
                        .height(150.dp)
                        .background(tint(midi, Color(0xFFFBFAF6)))
                        .border(0.5.dp, Color(0xFF16150F).copy(alpha = 0.35f))
                        .semantics { contentDescription = PianoLayout.name(midi) }
                        .clickable(enabled = verdict == null) { onPick(midi.toString()) },
                )
            }
        }
        for (midi in blacks) {
            val keyWidth = whiteWidth * 0.62f
            Box(
                Modifier
                    .offset(x = whiteWidth * PianoLayout.blackKeyCenter(midi, low).toFloat() - keyWidth / 2)
                    .size(keyWidth, 92.dp)
                    .clip(RoundedCornerShape(bottomStart = 4.dp, bottomEnd = 4.dp))
                    .background(tint(midi, Color(0xFF211F19)))
                    .semantics { contentDescription = PianoLayout.name(midi) }
                    .clickable(enabled = verdict == null) { onPick(midi.toString()) },
            )
        }
    }
}

// Speech

/**
 * Android's TextToSpeech for the words of a course. A language has a voice when the engine reports it as available;
 * with no voice the screen has no button (and nothing is spoken).
 */
class SpeechEngine(context: Context) {
    private var engine: TextToSpeech? = null
    private var ready by mutableStateOf(false)

    init {
        engine = try {
            TextToSpeech(context.applicationContext) { status ->
                ready = status == TextToSpeech.SUCCESS
            }
        } catch (e: Exception) {
            null
        }
    }

    /** Whether the engine has a voice for a BCP 47 tag like "es-ES". */
    fun hasVoice(language: String): Boolean {
        val tts = engine
        if (!ready || tts == null || language.isBlank()) return false
        return try {
            tts.isLanguageAvailable(Locale.forLanguageTag(language.replace('_', '-'))) >= TextToSpeech.LANG_AVAILABLE
        } catch (e: Exception) {
            false
        }
    }

    fun speak(text: String, language: String, slow: Boolean) {
        val tts = engine ?: return
        if (text.isBlank() || !hasVoice(language)) return
        try {
            tts.language = Locale.forLanguageTag(language.replace('_', '-'))
            tts.setSpeechRate(if (slow) 0.6f else 0.9f)
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "learn")
        } catch (e: Exception) {
            // no sound, no crash
        }
    }

    fun stop() {
        try { engine?.stop() } catch (e: Exception) { /* nothing is speaking */ }
    }

    fun shutdown() {
        try { engine?.shutdown() } catch (e: Exception) { /* already gone */ }
        engine = null
        ready = false
    }
}

@Composable
fun rememberSpeechEngine(): SpeechEngine {
    val context = LocalContext.current
    val engine = remember { SpeechEngine(context) }
    DisposableEffect(engine) { onDispose { engine.shutdown() } }
    return engine
}

/** A round speaker button, and a slow one beside it. [autoplay] says the text once when it appears, for exercises that ask what was heard. */
@Composable
fun SpeakButtons(engine: SpeechEngine, text: String, language: String, autoplay: Boolean) {
    val voice = engine.hasVoice(language)
    var played by remember(text) { mutableStateOf(false) }
    LaunchedEffect(voice, autoplay, text) {
        if (voice && autoplay && !played) {
            played = true
            engine.speak(text, language, false)
        }
    }
    if (!voice) return
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        RoundIconButton(LIconName.SPEAKER, "Anhören", 56.dp) { engine.speak(text, language, false) }
        RoundIconButton(LIconName.SLOW, "Langsam anhören", 40.dp) { engine.speak(text, language, true) }
    }
}

@Composable
fun RoundIconButton(icon: LIconName, description: String, size: androidx.compose.ui.unit.Dp, onClick: () -> Unit) {
    val colors = Quill.colors
    Box(
        Modifier
            .size(size)
            .background(colors.accent.copy(alpha = 0.18f), CircleShape)
            .border(1.dp, colors.accent.copy(alpha = 0.6f), CircleShape)
            .semantics { contentDescription = description }
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        LIcon(icon, colors.link, size * 0.46f, filled = true)
    }
}

// Tones

/** Plays the notes of an ear exercise with an AudioTrack: a soft piano-like tone computed on the device. */
object TonePlayer {
    private var track: AudioTrack? = null
    private var generation = 0

    @Synchronized
    fun stop() {
        generation += 1
        track?.let {
            try { it.stop() } catch (e: Exception) { /* not playing */ }
            it.release()
        }
        track = null
    }

    fun play(spec: ToneSpec) {
        if (spec.midi.isEmpty()) return
        stop()
        val mine = synchronized(this) { generation }
        Thread {
            try {
                val rate = 22050
                val samples = synthesizeTones(spec, rate)
                val audio = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build(),
                    )
                    .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(samples.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()
                audio.write(samples, 0, samples.size)
                synchronized(this) {
                    if (generation != mine) {
                        audio.release()
                        return@Thread
                    }
                    track = audio
                }
                audio.play()
            } catch (e: Exception) {
                // no audio output: the button does nothing
            }
        }.start()
    }
}

@Composable
fun TonePlayButton(spec: ToneSpec) {
    val colors = Quill.colors
    DisposableEffect(Unit) { onDispose { TonePlayer.stop() } }
    val label = toneButtonLabel(spec)
    Row(
        Modifier
            .height(44.dp)
            .background(colors.accent.copy(alpha = 0.2f), CircleShape)
            .border(1.dp, colors.accent.copy(alpha = 0.6f), CircleShape)
            .clickable { TonePlayer.play(spec) }
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LIcon(LIconName.PLAY, colors.link, 18.dp, filled = true)
        QText(label, work(15f, FontWeight.Medium), colors.ink)
    }
}

// Pip

private val pipCat = listOf(
    ".............", ".oo.......oo.", ".opo.....opo.", ".offo...offo.", ".offfffffffo.", "offfffffffffo", "offeefffeeffo",
    "offeefffeeffo", "offfffpfffffo", "offfffffffffo", ".offfffffffo.", ".offwwfffwwo.", "..ooooooooo..",
)

/** Pip, the cat of the app, drawn as 13 by 13 pixels (as on the other platforms). */
@Composable
fun PipMark(pixelSize: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    val colors = Quill.colors
    val outline = Color(0xFF16150F)
    val nose = lerp(Color(0xFFD9847F), colors.paper, 0.2f)
    Canvas(modifier.size(pixelSize * 13)) {
        val cell = size.width / 13f
        pipCat.forEachIndexed { r, row ->
            row.forEachIndexed { c, ch ->
                val color = when (ch) {
                    'o', 'e' -> outline
                    'f' -> colors.accent
                    'p' -> nose
                    'w' -> colors.paper
                    else -> null
                }
                if (color != null) drawRect(color, Offset(c * cell, r * cell), Size(cell + 0.5f, cell + 0.5f))
            }
        }
    }
}
