package de.maxifrz.lernwerk.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.calc.CasAnswer
import de.maxifrz.lernwerk.calc.CasEngine
import de.maxifrz.lernwerk.calc.CasFormat
import de.maxifrz.lernwerk.calc.CasPlot
import de.maxifrz.lernwerk.data.ImageCompressor
import de.maxifrz.lernwerk.data.InkStroke
import de.maxifrz.lernwerk.data.InkTool
import de.maxifrz.lernwerk.ink.Box
import de.maxifrz.lernwerk.ink.MathNotes
import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.StructuredOutput
import de.maxifrz.lernwerk.pdf.PageSize
import de.maxifrz.lernwerk.pdf.TextRecognizer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** A result offered after a written "=": the page, the text and where it goes, in PDF points. */
data class MathPreview(val page: Int, val text: String, val x: Double, val baseline: Double, val size: Double)

/** A line that ends in a written "=": its page, where the "=" and the line are, and the ink as a picture. */
class MathLineRequest(val page: Int, val equals: Box, val line: Box, val imageJpeg: ByteArray)

/** Watches the pen for a written "=" and holds the result it offers. */
class MathNotesState(private val scope: CoroutineScope) {
    var enabled by mutableStateOf(true)
    var preview by mutableStateOf<MathPreview?>(null)
    var onLine: (MathLineRequest) -> Unit = {}
    private var watching: Job? = null

    /** After every pen stroke: when the newest two form an "=", the line before it is read once the pen rests. */
    fun strokeAdded(page: Int, strokes: List<InkStroke>, pageSize: PageSize, current: () -> List<InkStroke>) {
        preview = null
        watching?.cancel()
        if (!enabled) return
        val drawn = strokes.filter { it.text == null && it.tool == InkTool.PEN }
        if (drawn.size < 3) return
        fun box(stroke: InkStroke) = Box.around(stroke.points.mapIndexed { i, v -> v.toDouble() * if (i % 2 == 0) pageSize.width else pageSize.height })
        val last = box(drawn[drawn.size - 1]) ?: return
        val before = box(drawn[drawn.size - 2]) ?: return
        if (!MathNotes.isEqualsSign(before, last)) return
        val equals = before.union(last)
        val count = strokes.size
        watching = scope.launch {
            delay(900)
            // Written on since: the "=" was part of something else.
            if (current().size != count) return@launch
            val line = MathNotes.lineRegion(equals, drawn.dropLast(2).mapNotNull(::box)) ?: return@launch
            // The line with the "=" and what is written above it, where values may be defined.
            val context = Box(0.0, max(0.0, line.top - 500), max(pageSize.width.toDouble(), equals.right + 20), max(line.bottom, equals.bottom) + 8)
            val image = inkImage(strokes, pageSize, context) ?: return@launch
            onLine(MathLineRequest(page, equals, line, image))
        }
    }

    /** The result as a stroke of text, ready to add to the page's ink. */
    fun stroke(preview: MathPreview, pageSize: PageSize): InkStroke {
        val paint = handwritingPaint(preview.size.toFloat())
        val width = paint.measureText(preview.text)
        return InkStroke(
            tool = InkTool.PEN,
            points = listOf(
                (preview.x / pageSize.width).toFloat(),
                (preview.baseline / pageSize.height).toFloat(),
                ((preview.x + width) / pageSize.width).toFloat(),
                ((preview.baseline - preview.size) / pageSize.height).toFloat(),
            ),
            text = preview.text,
            size = (preview.size / pageSize.width).toFloat(),
        )
    }
}

/** Android's casual font looks written by hand; calculated results use it. */
fun handwritingPaint(size: Float, color: Int = 0xFF16150F.toInt()) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    typeface = Typeface.create("casual", Typeface.NORMAL)
    textSize = size
    this.color = color
}

/** Ink only, dark on white, as a model reads it best; [region] is in PDF points. */
fun inkImage(strokes: List<InkStroke>, pageSize: PageSize, region: Box): ByteArray? {
    if (region.width < 1 || region.height < 1) return null
    val scale = min(2.0, 1600 / max(region.width, region.height))
    val bitmap = Bitmap.createBitmap((region.width * scale).roundToInt().coerceAtLeast(1), (region.height * scale).roundToInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(0xFFFFFFFF.toInt())
    canvas.scale(scale.toFloat(), scale.toFloat())
    canvas.translate(-region.left.toFloat(), -region.top.toFloat())
    strokes.forEach { drawStroke(canvas, it, pageSize.width, pageSize.height) }
    return ImageCompressor.encode(bitmap, 85)
}

/** Reads handwritten maths with the configured vision model, or with ML Kit on the device when there is none. */
suspend fun readMath(jpeg: ByteArray, hint: String, client: LlmClient): MathNotes.Recognition? {
    if (client.capabilities.acceptsImages) {
        val recognition = runCatching {
            StructuredOutput.complete(MathNotes.request(jpeg, hint), client, parse = { MathNotes.parse(it) }, isValid = { it != null && (it.lines.isNotEmpty() || it.table != null) })
        }.getOrNull()
        if (recognition != null) return recognition
    }
    val lines = TextRecognizer.text(jpeg).lines().map(MathNotes::clean).filter { it.isNotEmpty() }
    return if (lines.isEmpty()) null else MathNotes.Recognition(lines = lines)
}

/** What the last line asks, calculated on the device after the definitions above it. */
suspend fun calculateMath(recognition: MathNotes.Recognition, engine: CasEngine): Pair<String, CasAnswer>? {
    val (definitions, expression) = MathNotes.split(recognition.lines)
    if (expression == null) return null
    definitions.forEach { runCatching { engine.evaluate(it) } }
    val answer = runCatching { engine.evaluate(expression) }.getOrNull() ?: return null
    return expression to answer
}

/**
 * What the calculate tool found in a framed region: the recognized lines to check and correct, results to write
 * below it, and a graph or chart to add as the next page.
 */
@Composable
fun MathRegionDialog(
    imageJpeg: ByteArray,
    client: LlmClient,
    engine: CasEngine,
    onWrite: (String, Int) -> Unit,
    onPage: (Bitmap) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    var reading by remember { mutableStateOf(true) }
    var text by remember { mutableStateOf("") }
    var table by remember { mutableStateOf<MathNotes.Recognition.Table?>(null) }
    var results by remember { mutableStateOf(listOf<Pair<String, CasAnswer>>()) }
    var written by remember { mutableIntStateOf(0) }
    var plot by remember { mutableStateOf<CasPlot?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }

    LaunchedEffect(imageJpeg) {
        val recognition = readMath(imageJpeg, MathNotes.REGION_HINT, client)
        text = recognition?.lines?.joinToString("\n").orEmpty()
        table = recognition?.table
        reading = false
        if (recognition == null) message = "Hier war keine Rechnung zu erkennen. Du kannst sie unten eintippen."
    }
    val lines = text.lines().map(MathNotes::clean).filter { it.isNotEmpty() }
    val chart = table?.let(MathNotes::chartData)
    val functions = lines.filter { line ->
        Regex("""^\s*([A-Za-z]\w*\(x\)|y)\s*=""").containsMatchIn(line) ||
            (Regex("""(^|[^A-Za-z])x([^A-Za-z]|$)""").containsMatchIn(line) && !line.contains("="))
    }.take(3)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = colors.surface,
        title = { QText("Rechnen", work(18f, FontWeight.Medium), colors.ink) },
        text = {
            Column(Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (reading) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PulsingDots(5.dp)
                        QText("Die Handschrift wird gelesen …", work(15f), colors.muted)
                    }
                } else {
                    PixelCaption("Erkannt – bei Bedarf korrigieren")
                    BasicTextField(
                        value = text,
                        onValueChange = { text = it },
                        textStyle = work(15f).copy(fontFamily = FontFamily.Monospace, color = colors.ink),
                        cursorBrush = SolidColor(colors.accent),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 80.dp)
                            .background(colors.bg, RoundedCornerShape(10.dp))
                            .border(1.dp, colors.line2, RoundedCornerShape(10.dp))
                            .padding(10.dp),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PrimaryButton("Ausrechnen", {
                            working = true
                            message = null
                            scope.launch {
                                results = lines.mapNotNull { line ->
                                    var input = line
                                    while (input.endsWith("=") || input.endsWith("?")) input = input.dropLast(1).trim()
                                    if (input.isEmpty()) return@mapNotNull null
                                    input to (runCatching { engine.evaluate(input) }.getOrElse { CasAnswer(ok = false, error = it.message) })
                                }
                                working = false
                            }
                        }, height = 38.dp, enabled = !working && lines.isNotEmpty())
                        OutlineButton("Graph", {
                            if (functions.isEmpty()) {
                                message = "Für einen Graphen braucht es eine Funktion wie f(x) = x^2 oder y = 2x + 1."
                            } else {
                                working = true
                                scope.launch {
                                    runCatching { engine.plot(functions, -5.0, 5.0) }
                                        .onSuccess { if (it.ok) plot = it else message = it.error }
                                        .onFailure { message = it.message }
                                    working = false
                                }
                            }
                        }, height = 38.dp, enabled = !working && lines.isNotEmpty())
                    }
                    if (chart != null) {
                        OutlineButton("Diagramm als neue Seite", {
                            onPage(ChartPainter.pageBitmap(chart))
                            onDismiss()
                        }, height = 38.dp)
                    }
                    results.forEach { (input, answer) ->
                        Column(
                            Modifier.fillMaxWidth().background(colors.bg, RoundedCornerShape(10.dp)).padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            QText(input, work(13f).copy(fontFamily = FontFamily.Monospace), colors.muted)
                            if (answer.ok) {
                                QText(answer.pretty.orEmpty(), work(19f), colors.ink)
                                answer.prettyApprox?.let { QText(if (it.startsWith("L ≈")) it else "≈ $it", work(14f), colors.link) }
                                MathNotes.resultText(answer.pretty, answer.prettyApprox)?.let { shown ->
                                    OutlineButton("Aufschreiben", {
                                        onWrite(if (answer.assigns == null) "$input = $shown" else shown, written)
                                        written++
                                    }, height = 32.dp)
                                }
                            } else {
                                QText(answer.error ?: "Das konnte nicht berechnet werden.", work(14f), colors.warn)
                            }
                        }
                    }
                    plot?.let { current ->
                        GraphPainter.pointLines(current).forEach { (title, value) ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                QText(title, work(12.5f), colors.muted, Modifier.width(96.dp))
                                QText(value, work(13.5f), colors.ink)
                            }
                        }
                        PrimaryButton("Graph als neue Seite", {
                            onPage(GraphPainter.pageBitmap(current))
                            onDismiss()
                        }, height = 38.dp)
                    }
                }
                message?.let { QText(it, work(13.5f), colors.warn) }
            }
        },
        confirmButton = { LinkButton("Fertig", onDismiss) },
    )
}

/** A value table as a chart on a page: lines over x when the first column counts up, otherwise bars per row. */
object ChartPainter {
    private const val INK = 0xFF16150F.toInt()
    private const val MUTED = 0xFF6E6B62.toInt()

    fun pageBitmap(data: MathNotes.ChartData): Bitmap {
        val scale = 2f
        val width = 1080f
        val height = 820f
        val bitmap = Bitmap.createBitmap((width * scale).toInt(), (height * scale).toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.scale(scale, scale)
        canvas.drawColor(0xFFFFFFFF.toInt())
        val area = RectF(90f, 50f, width - 40f, height - (if (data.columns.size > 1) 110f else 80f))
        val values = data.columns.flatMap { it.values.filterNotNull() }
        val low = min(0.0, values.minOrNull() ?: 0.0)
        val high = max(values.maxOrNull() ?: 1.0, low + 1e-9)
        val ticks = CasFormat.ticks(low, high, 6)
        val top = max(high, ticks.lastOrNull() ?: high)
        val bottom = min(low, ticks.firstOrNull() ?: low)
        fun py(v: Double) = area.bottom - ((v - bottom) / (top - bottom)).toFloat() * area.height()
        val grid = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x14000000; strokeWidth = 1f }
        val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = MUTED; textSize = 16f; textAlign = Paint.Align.RIGHT }
        ticks.forEach {
            canvas.drawLine(area.left, py(it), area.right, py(it), grid)
            canvas.drawText(CasFormat.number(it), area.left - 10, py(it) + 5, label)
        }
        val axis = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = INK; strokeWidth = 1.5f }
        canvas.drawLine(area.left, py(0.0).coerceIn(area.top, area.bottom), area.right, py(0.0).coerceIn(area.top, area.bottom), axis)
        canvas.drawLine(area.left, area.top, area.left, area.bottom, axis)

        val count = data.labels.size
        label.textAlign = Paint.Align.CENTER
        if (data.numericX) {
            val xs = data.xValues
            val xmin = xs.first()
            val xmax = max(xs.last(), xmin + 1e-9)
            fun px(x: Double) = area.left + ((x - xmin) / (xmax - xmin)).toFloat() * area.width()
            xs.forEachIndexed { i, x -> canvas.drawText(data.labels[i], px(x), area.bottom + 24, label) }
            data.columns.forEachIndexed { c, column ->
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = GraphPainter.color(c); strokeWidth = 3f; style = Paint.Style.STROKE }
                val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = GraphPainter.color(c) }
                val path = Path()
                var started = false
                column.values.forEachIndexed { i, value ->
                    if (value == null) return@forEachIndexed
                    val x = px(xs[i])
                    val y = py(value)
                    if (started) path.lineTo(x, y) else path.moveTo(x, y)
                    started = true
                    canvas.drawCircle(x, y, 5f, dot)
                }
                canvas.drawPath(path, paint)
            }
        } else {
            val slot = area.width() / max(count, 1)
            val barWidth = slot * 0.7f / data.columns.size
            data.labels.forEachIndexed { i, text -> canvas.drawText(text, area.left + slot * (i + 0.5f), area.bottom + 24, label) }
            data.columns.forEachIndexed { c, column ->
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = GraphPainter.color(c) }
                column.values.forEachIndexed { i, value ->
                    if (value == null) return@forEachIndexed
                    val left = area.left + slot * i + slot * 0.15f + barWidth * c
                    canvas.drawRect(left, min(py(value), py(0.0)), left + barWidth, max(py(value), py(0.0)), paint)
                }
            }
        }
        if (data.columns.size > 1) {
            val legend = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = INK; textSize = 17f }
            var x = area.left
            data.columns.forEachIndexed { c, column ->
                canvas.drawRect(x, height - 62f, x + 16f, height - 46f, Paint().apply { color = GraphPainter.color(c) })
                canvas.drawText(column.name, x + 24f, height - 48f, legend)
                x += 40f + legend.measureText(column.name)
            }
        }
        return bitmap
    }
}
