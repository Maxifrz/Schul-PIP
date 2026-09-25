package de.maxifrz.lernwerk.ui

import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.graphics.RectF
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.ink.InstrumentKind
import de.maxifrz.lernwerk.ink.MathNotes
import de.maxifrz.lernwerk.calc.CasEngine
import de.maxifrz.lernwerk.ink.Instruments
import de.maxifrz.lernwerk.data.ImageCompressor
import de.maxifrz.lernwerk.data.InkStroke
import de.maxifrz.lernwerk.data.InkTool
import de.maxifrz.lernwerk.data.ReviewCard
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.pdf.PdfPages
import de.maxifrz.lernwerk.pdf.PdfText
import de.maxifrz.lernwerk.pdf.TextRecognizer
import de.maxifrz.lernwerk.tutor.TutorContext
import de.maxifrz.lernwerk.tutor.TutorSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

sealed interface InteractionMode {
    data object Read : InteractionMode
    data class Draw(val tool: DrawingTool) : InteractionMode
    data object Mark : InteractionMode
    /** Frame handwritten maths to calculate it, draw it or chart it. */
    data object Math : InteractionMode
}

enum class DrawingTool { PEN, HIGHLIGHTER, ERASER }

/** Stroke widths as fractions of the page width: 3 pt and 18 pt on an A4 page. */
private fun strokeWidth(tool: InkTool) = if (tool == InkTool.PEN) 3f / 595f else 18f / 595f
private val PenColor = Color(0xFF16150F)
private val HighlighterColor = Color(0x99FFCC00)

/** The ink of one document, per page, with a version counter that drives saving. */
private class InkState {
    val pages = mutableStateMapOf<Int, List<InkStroke>>()
    var version by mutableIntStateOf(0)

    fun add(page: Int, stroke: InkStroke) {
        pages[page] = (pages[page] ?: emptyList()) + stroke
        version++
    }

    fun erase(page: Int, x: Float, y: Float, radius: Float, aspect: Float) {
        val strokes = pages[page] ?: return
        val kept = strokes.filterNot { stroke ->
            stroke.points.chunked(2).any { (px, py) -> abs(px - x) < radius && abs(py - y) * aspect < radius }
        }
        if (kept.size != strokes.size) {
            pages[page] = kept
            version++
        }
    }
}

@Composable
fun DocumentScreen(app: AppState, route: Route.Document) {
    val repository = app.repository
    val material = repository.material(route.materialId)
    if (material == null) {
        LaunchedEffect(Unit) { app.pop() }
        return
    }
    LaunchedEffect(material.id) { repository.markOpened(material.id) }
    val file = remember(material.id) { repository.pdfFile(material) }
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Bumped after a page is spliced in, so the PDF and its ink are read again from the changed file.
    var reloadKey by remember(material.id) { mutableIntStateOf(0) }

    val pdf by produceState<Result<PdfPages>?>(null, file, reloadKey) {
        value = withContext(Dispatchers.IO) { PdfPages.open(file)?.let { Result.success(it) } ?: Result.failure(IllegalStateException()) }
    }
    // Captured, not read through the delegate: onDispose must close the renderer this effect was keyed on,
    // not the one that just replaced it.
    val openedPdf = pdf?.getOrNull()
    DisposableEffect(openedPdf) { onDispose { openedPdf?.close() } }

    val ink = remember(material.id) { InkState() }
    LaunchedEffect(material.id, reloadKey) {
        ink.pages.clear()
        ink.pages.putAll(repository.loadInk(material.id))
    }

    fun openBitmap(uri: android.net.Uri): Bitmap? = runCatching {
        ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, _, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
    }.getOrNull()

    val insertPdfLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val bytes = runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()
            // The ink drawn last must be in before the later pages' ink moves along.
            repository.saveInk(material.id, ink.pages.toMap())
            if (bytes != null && repository.insertPdfPages(material, bytes, material.lastOpenedPage)) reloadKey++
        }
    }
    val insertPhotoLauncher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val bitmap = openBitmap(uri)
            repository.saveInk(material.id, ink.pages.toMap())
            if (bitmap != null && repository.insertImagePage(material, bitmap, material.lastOpenedPage)) reloadKey++
        }
    }
    val insertImageFileLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val bitmap = openBitmap(uri)
            repository.saveInk(material.id, ink.pages.toMap())
            if (bitmap != null && repository.insertImagePage(material, bitmap, material.lastOpenedPage)) reloadKey++
        }
    }
    var addPageMenuOpen by remember { mutableStateOf(false) }
    var addImageMenuOpen by remember { mutableStateOf(false) }
    LaunchedEffect(ink.version) {
        if (ink.version == 0) return@LaunchedEffect
        delay(1000)
        repository.saveInk(material.id, ink.pages.toMap())
    }
    DisposableEffect(material.id) {
        onDispose { if (ink.version > 0) repository.saveInk(material.id, ink.pages.toMap()) }
    }

    var mode by remember { mutableStateOf<InteractionMode>(InteractionMode.Read) }
    val instruments = remember(material.id) { InstrumentState() }
    val math = remember(material.id) { MathNotesState(scope) }
    val engine = remember { CasEngine.get(context) }
    var mathRegion by remember { mutableStateOf<MarkedRegion?>(null) }
    // A written "=": read the line and what is defined above it, calculate on the device, offer the result.
    math.onLine = { request ->
        scope.launch {
            val recognition = readMath(request.imageJpeg, MathNotes.LINE_HINT, app.settings.makeClient(LlmTask.TUTOR)) ?: return@launch
            val (expression, answer) = calculateMath(recognition, engine) ?: return@launch
            val text = MathNotes.resultText(answer.pretty, answer.prettyApprox)
            if (!answer.ok || text == null || !MathNotes.isWorthShowing(expression, text)) return@launch
            val (x, baseline) = MathNotes.resultBaseline(request.equals, request.line)
            math.preview = MathPreview(request.page, text, x, baseline, MathNotes.fontSize(request.line))
        }
    }

    /** A calculated result in handwriting below a framed region, one line further down for each. */
    fun writeBelow(region: MarkedRegion, text: String, index: Int) {
        val size = pdf?.getOrNull()?.sizes?.getOrNull(region.pageIndex) ?: return
        val area = region.area ?: return
        val letter = 20.0
        val baseline = area.bottom * size.height + letter * 1.4 * (index + 1)
        ink.add(region.pageIndex, math.stroke(MathPreview(region.pageIndex, text, (area.left * size.width).toDouble(), baseline, letter), size))
    }
    var tutor by remember { mutableStateOf<TutorSession?>(null) }
    // Keeps the panel's content while it animates out.
    var shownTutor by remember { mutableStateOf<TutorSession?>(null) }

    fun closeTutor() {
        val session = tutor ?: return
        tutor = null
        if (!session.hasHelped) return
        // Every region the student needed help with becomes a flashcard for spaced repetition.
        app.scope.launch {
            runCatching { session.makeFlashcard() }.onSuccess { card ->
                repository.addCard(ReviewCard(front = card.front, back = card.back, materialId = material.id, page = session.context.pageNumber))
            }
        }
    }

    fun openTutor(region: MarkedRegion) {
        closeTutor()
        val pageNumber = region.pageIndex + 1
        val topic = repository.plans.flatMap { it.topics }
            .firstOrNull { it.materialId == material.id && pageNumber in it.sourcePages }
        val weakSpots = repository.cards
            .filter { it.materialId == material.id }
            .sortedWith(compareByDescending<ReviewCard> { it.scheduling.lapses }.thenByDescending { it.createdAt })
            .take(5)
            .map { it.front }
        val session = TutorSession(
            TutorContext(
                materialTitle = material.title,
                pageNumber = pageNumber,
                selectedText = region.selectedText,
                pageText = region.pageText,
                topicTitle = topic?.title,
                topicSummary = topic?.summary,
                weakSpots = weakSpots,
            ),
            regionImage = region.imageJpeg,
            client = app.settings.makeClient(LlmTask.TUTOR),
            modelLabel = app.settings.modelLabel(LlmTask.TUTOR),
            recognizeText = TextRecognizer::text,
        )
        tutor = session
        shownTutor = session
        scope.launch { session.start() }
    }

    fun leave() {
        closeTutor()
        app.pop()
    }
    androidx.activity.compose.BackHandler { leave() }

    Column(Modifier.fillMaxSize().background(colors.bg)) {
        DetailHeader(route.backTitle, material.title, onBack = ::leave) {
            pdf?.getOrNull()?.let { pages ->
                PixelCaption(if (pages.pageCount == 1) "1 Seite" else "${pages.pageCount} Seiten", Modifier.padding(end = 8.dp))
            }
            Box {
                OutlineButton("+ Seite", { addPageMenuOpen = true })
                DropdownMenu(addPageMenuOpen, { addPageMenuOpen = false }, containerColor = colors.surface) {
                    DropdownMenuItem(text = { QText("PDF", work(15f), colors.ink) }, onClick = {
                        addPageMenuOpen = false
                        insertPdfLauncher.launch(arrayOf("application/pdf"))
                    })
                    Box {
                        DropdownMenuItem(text = { QText("Bild ▸", work(15f), colors.ink) }, onClick = { addImageMenuOpen = true })
                        DropdownMenu(addImageMenuOpen, { addImageMenuOpen = false }, containerColor = colors.surface) {
                            DropdownMenuItem(text = { QText("Aus Fotos", work(15f), colors.ink) }, onClick = {
                                addImageMenuOpen = false
                                addPageMenuOpen = false
                                insertPhotoLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                            })
                            DropdownMenuItem(text = { QText("Aus Dateien", work(15f), colors.ink) }, onClick = {
                                addImageMenuOpen = false
                                addPageMenuOpen = false
                                insertImageFileLauncher.launch(arrayOf("image/*"))
                            })
                        }
                    }
                }
            }
        }
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val wide = maxWidth >= 900.dp
            Row(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f).fillMaxHeight().background(colors.canvas)) {
                    when (val result = pdf) {
                        null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { PulsingDots(6.dp) }
                        else -> result.getOrNull()?.let { pages ->
                            PdfCanvas(
                                pages = pages,
                                file = file,
                                ink = ink,
                                mode = mode,
                                instruments = instruments,
                                math = math,
                                startPage = route.startPage ?: material.lastOpenedPage,
                                onPageChange = { repository.setLastOpenedPage(material.id, it) },
                                onMark = ::openTutor,
                                onMath = { mathRegion = it },
                            )
                        } ?: Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                            QText("PDF nicht lesbar", work(24f, FontWeight.Light), colors.ink)
                            QText("Die Datei fehlt oder ist beschädigt.", work(15f), colors.muted, Modifier.padding(top = 10.dp))
                        }
                    }
                    DocumentToolbar(
                        mode = mode,
                        onMode = { mode = it },
                        instruments = instruments,
                        math = math,
                        onInstrument = { kind ->
                            val pages = pdf?.getOrNull()
                            val page = material.lastOpenedPage.coerceIn(0, max(0, (pages?.pageCount ?: 1) - 1))
                            pages?.sizes?.getOrNull(page)?.let { instruments.place(kind, page, it) }
                            // The pen comes along, so the instrument can be used right away.
                            if (mode !is InteractionMode.Draw || (mode as InteractionMode.Draw).tool == DrawingTool.ERASER) {
                                mode = InteractionMode.Draw(DrawingTool.PEN)
                            }
                        },
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 18.dp),
                    )
                }
                AnimatedVisibility(
                    visible = wide && tutor != null,
                    enter = slideInHorizontally { it } + fadeIn(),
                    exit = slideOutHorizontally { it } + fadeOut(),
                ) {
                    Row {
                        Box(Modifier.width(1.dp).fillMaxHeight().background(colors.line))
                        shownTutor?.let { TutorPanel(it, ::closeTutor, Modifier.width(390.dp).fillMaxHeight()) }
                    }
                }
            }
            if (!wide) CompactTutor(tutor != null, shownTutor, ::closeTutor)
            mathRegion?.let { region ->
                val jpeg = region.imageJpeg
                if (jpeg == null) {
                    mathRegion = null
                } else {
                    MathRegionDialog(
                        imageJpeg = jpeg,
                        client = app.settings.makeClient(LlmTask.TUTOR),
                        engine = engine,
                        onWrite = { text, index -> writeBelow(region, text, index) },
                        onPage = { bitmap ->
                            scope.launch {
                                repository.saveInk(material.id, ink.pages.toMap())
                                if (repository.insertImagePage(material, bitmap, region.pageIndex)) reloadKey++
                            }
                        },
                        onDismiss = { mathRegion = null },
                    )
                }
            }
        }
    }
}

/** On narrow screens the tutor slides up from the bottom over a scrim. */
@Composable
private fun BoxScope.CompactTutor(visible: Boolean, session: TutorSession?, onClose: () -> Unit) {
    val colors = Quill.colors
    AnimatedVisibility(visible, Modifier.matchParentSize(), enter = fadeIn(), exit = fadeOut()) {
        Box(
            Modifier.fillMaxSize().background(colors.scrim)
                .clickable(remember { MutableInteractionSource() }, null, onClick = onClose),
        )
    }
    AnimatedVisibility(
        visible,
        modifier = Modifier.align(Alignment.BottomCenter),
        enter = slideInVertically { it },
        exit = slideOutVertically { it },
    ) {
        session?.let {
            TutorPanel(
                it,
                onClose,
                Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.8f)
                    .background(colors.bg, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                    .clickable(remember { MutableInteractionSource() }, null) {},
            )
        }
    }
}

class MarkedRegion(
    val pageIndex: Int,
    val selectedText: String,
    val pageText: String,
    val imageJpeg: ByteArray?,
    /** Where it is on the page, as fractions of the page's width and height. */
    val area: RectF? = null,
)

/** Pages stacked vertically, each with its ink on top; a marking layer covers everything in help mode. */
@Composable
private fun PdfCanvas(
    pages: PdfPages,
    file: File,
    ink: InkState,
    mode: InteractionMode,
    instruments: InstrumentState,
    math: MathNotesState,
    startPage: Int,
    onPageChange: (Int) -> Unit,
    onMark: (MarkedRegion) -> Unit,
    onMath: (MarkedRegion) -> Unit,
) {
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = startPage.coerceIn(0, max(0, pages.pageCount - 1)))
    val pageBounds = remember { mutableMapOf<Int, Rect>() }
    val scope = rememberCoroutineScope()
    var overlayOrigin by remember { mutableStateOf(Offset.Zero) }
    val pageTexts by produceState<List<String>?>(null, file) { value = withContext(Dispatchers.IO) { PdfText.pageTexts(file) } }

    LaunchedEffect(listState) {
        @OptIn(kotlinx.coroutines.FlowPreview::class)
        snapshotFlow { listState.firstVisibleItemIndex }.debounce(400).collect(onPageChange)
    }

    // True to scale, pages can be wider than the screen and scroll sideways.
    val context = LocalContext.current
    val density = LocalDensity.current
    val trueWidths = if (instruments.trueScale) {
        val metrics = context.resources.displayMetrics
        pages.sizes.map { with(density) { (it.width * Instruments.trueScalePixelsPerPoint(metrics.xdpi.toDouble())).toFloat().toDp() } }
    } else {
        null
    }
    val sideways = if (trueWidths != null) Modifier.horizontalScroll(rememberScrollState(), enabled = mode == InteractionMode.Read) else Modifier

    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().then(sideways)) {
            LazyColumn(
                state = listState,
                userScrollEnabled = mode == InteractionMode.Read,
                modifier = if (trueWidths != null) Modifier.fillMaxHeight().width((trueWidths.maxOrNull() ?: 0.dp) + 40.dp) else Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 110.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                items(pages.pageCount) { index ->
                    PdfPage(
                        pages = pages,
                        index = index,
                        ink = ink,
                        mode = mode,
                        instruments = instruments,
                        math = math,
                        trueWidth = trueWidths?.getOrNull(index),
                        modifier = Modifier.onGloballyPositioned { pageBounds[index] = it.boundsInWindow() },
                    )
                }
            }
        }

        if (mode == InteractionMode.Mark || mode == InteractionMode.Math) {
            MarkingOverlay(
                modifier = Modifier.fillMaxSize().onGloballyPositioned { overlayOrigin = it.boundsInWindow().topLeft },
                onMark = { rect ->
                    val windowRect = rect.translate(overlayOrigin)
                    val center = windowRect.center
                    val visible = listState.layoutInfo.visibleItemsInfo.map { it.index }
                    val index = visible.firstOrNull { pageBounds[it]?.contains(center) == true }
                        ?: visible.minByOrNull { i -> pageBounds[i]?.let { abs(it.center.y - center.y) } ?: Float.MAX_VALUE }
                        ?: return@MarkingOverlay
                    val bounds = pageBounds[index] ?: return@MarkingOverlay
                    val clipped = windowRect.intersect(bounds)
                    if (clipped.isEmpty) return@MarkingOverlay
                    val normalized = RectF(
                        (clipped.left - bounds.left) / bounds.width,
                        (clipped.top - bounds.top) / bounds.height,
                        (clipped.right - bounds.left) / bounds.width,
                        (clipped.bottom - bounds.top) / bounds.height,
                    )
                    scope.launch {
                        val region = withContext(Dispatchers.IO) {
                            MarkedRegion(
                                pageIndex = index,
                                selectedText = PdfText.textIn(file, index, normalized),
                                pageText = pageTexts?.getOrNull(index) ?: "",
                                imageJpeg = snapshot(pages, index, ink.pages[index].orEmpty(), normalized, bounds.width),
                                area = normalized,
                            )
                        }
                        if (mode == InteractionMode.Math) onMath(region) else onMark(region)
                    }
                },
            )
        }
    }
}

/** Captures what the student sees in the region, including their own handwriting. */
private suspend fun snapshot(pages: PdfPages, index: Int, strokes: List<InkStroke>, region: RectF, displayedWidth: Float): ByteArray? {
    val width = min(2400, (displayedWidth * 2).roundToInt())
    val page = pages.render(index, width) ?: return null
    val canvas = android.graphics.Canvas(page)
    strokes.forEach { drawStroke(canvas, it, page.width.toFloat(), page.height.toFloat()) }
    val left = (region.left * page.width).roundToInt().coerceIn(0, page.width - 1)
    val top = (region.top * page.height).roundToInt().coerceIn(0, page.height - 1)
    val right = (region.right * page.width).roundToInt().coerceIn(left + 1, page.width)
    val bottom = (region.bottom * page.height).roundToInt().coerceIn(top + 1, page.height)
    val crop = Bitmap.createBitmap(page, left, top, right - left, bottom - top)
    return ImageCompressor.encode(crop, 80)
}

fun drawStroke(canvas: android.graphics.Canvas, stroke: InkStroke, width: Float, height: Float) {
    stroke.text?.let { text ->
        if (stroke.points.size >= 2) canvas.drawText(text, stroke.points[0] * width, stroke.points[1] * height, handwritingPaint(stroke.size * width))
        return
    }
    val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        style = android.graphics.Paint.Style.STROKE
        strokeCap = android.graphics.Paint.Cap.ROUND
        strokeJoin = android.graphics.Paint.Join.ROUND
        strokeWidth = strokeWidth(stroke.tool) * width
        color = (if (stroke.tool == InkTool.PEN) PenColor else HighlighterColor).let {
            android.graphics.Color.argb(it.alpha, it.red, it.green, it.blue)
        }
    }
    val path = android.graphics.Path()
    stroke.points.chunked(2).forEachIndexed { i, (x, y) ->
        if (i == 0) path.moveTo(x * width, y * height) else path.lineTo(x * width, y * height)
    }
    if (stroke.points.size == 2) path.lineTo(stroke.points[0] * width + 0.1f, stroke.points[1] * height)
    canvas.drawPath(path, paint)
}

@Composable
private fun PdfPage(
    pages: PdfPages,
    index: Int,
    ink: InkState,
    mode: InteractionMode,
    instruments: InstrumentState,
    math: MathNotesState,
    trueWidth: androidx.compose.ui.unit.Dp?,
    modifier: Modifier = Modifier,
) {
    val pageSize = pages.sizes[index]
    var widthPx by remember { mutableIntStateOf(0) }
    var renderFailed by remember { mutableStateOf(false) }
    val bitmap by produceState<Bitmap?>(null, index, widthPx) {
        if (widthPx > 0) {
            value = pages.render(index, min(widthPx, 2000))
            renderFailed = value == null
        }
    }
    val current = remember { mutableStateListOf<Float>() }
    val tool = (mode as? InteractionMode.Draw)?.tool
    val density = LocalDensity.current

    Box(
        modifier
            .then(if (trueWidth != null) Modifier.width(trueWidth) else Modifier.widthIn(max = 980.dp).fillMaxWidth())
            .aspectRatio(1f / pageSize.aspect)
            .shadow(4.dp, RoundedCornerShape(2.dp))
            .background(Color.White)
            .onSizeChanged { widthPx = it.width },
    ) {
        bitmap?.let { Image(it.asImageBitmap(), contentDescription = "Seite ${index + 1}", modifier = Modifier.fillMaxSize()) }
        if (renderFailed) {
            QText(
                "Seite ${index + 1} konnte nicht angezeigt werden.",
                work(14f),
                hex(0x6E6B62),
                Modifier.align(Alignment.Center),
            )
        }
        Canvas(
            Modifier
                .fillMaxSize()
                .pointerInput(tool) {
                    awaitEachGesture {
                        val down = awaitFirstDown()
                        val w = size.width.toFloat()
                        val h = size.height.toFloat()
                        val inkTool = when (tool) {
                            DrawingTool.PEN -> InkTool.PEN
                            DrawingTool.HIGHLIGHTER -> InkTool.HIGHLIGHTER
                            else -> null
                        }
                        if (instruments.kind != null && instruments.page == index) {
                            val handled = instrumentGesture(
                                down = down,
                                state = instruments,
                                pointsPerPixel = pageSize.width / w.toDouble(),
                                pageSize = pageSize,
                                penWidth = inkTool?.let { strokeWidth(it) * pageSize.width.toDouble() },
                                preview = current,
                                onStroke = { points -> inkTool?.let { ink.add(index, InkStroke(it, points)) } },
                            )
                            if (handled) return@awaitEachGesture
                        }
                        if (tool == null) return@awaitEachGesture
                        fun handle(position: Offset) {
                            val x = position.x / w
                            val y = position.y / h
                            if (tool == DrawingTool.ERASER) {
                                ink.erase(index, x, y, with(density) { 14.dp.toPx() } / w, h / w)
                            } else {
                                current += x
                                current += y
                            }
                        }
                        handle(down.position)
                        down.consume()
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            if (!change.pressed) break
                            if (change.positionChange() != Offset.Zero) handle(change.position)
                            change.consume()
                        }
                        if (tool != DrawingTool.ERASER && current.isNotEmpty()) {
                            ink.add(index, InkStroke(if (tool == DrawingTool.PEN) InkTool.PEN else InkTool.HIGHLIGHTER, current.toList()))
                            if (tool == DrawingTool.PEN) {
                                math.strokeAdded(index, ink.pages[index].orEmpty(), pageSize) { ink.pages[index].orEmpty() }
                            }
                        }
                        current.clear()
                    }
                },
        ) {
            ink.pages[index]?.forEach { stroke ->
                val text = stroke.text
                if (text != null && stroke.points.size >= 2) {
                    drawContext.canvas.nativeCanvas.drawText(text, stroke.points[0] * size.width, stroke.points[1] * size.height, handwritingPaint(stroke.size * size.width))
                } else {
                    drawInk(stroke.tool, stroke.points)
                }
            }
            if (current.isNotEmpty() && tool != null && tool != DrawingTool.ERASER) {
                drawInk(if (tool == DrawingTool.PEN) InkTool.PEN else InkTool.HIGHLIGHTER, current)
            }
            if (instruments.kind != null && instruments.page == index) {
                drawInstrument(instruments, size.width / pageSize.width.toDouble())
            }
        }
        // The result offered after a written "=": a tap writes it onto the page.
        math.preview?.takeIf { it.page == index && widthPx > 0 }?.let { preview ->
            val scale = widthPx / pageSize.width.toDouble()
            val colors = Quill.colors
            Box(
                Modifier
                    .offset { IntOffset((preview.x * scale).roundToInt(), ((preview.baseline - preview.size) * scale).roundToInt()) }
                    .background(colors.accent, CircleShape)
                    .clickable {
                        ink.add(index, math.stroke(preview, pageSize))
                        math.preview = null
                    }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                QText("= ${preview.text}   Einfügen", work(15f, FontWeight.SemiBold), colors.onAccent)
            }
        }
    }
}

private fun DrawScope.drawInk(tool: InkTool, points: List<Float>) {
    if (points.size < 2) return
    val path = Path()
    for (i in points.indices step 2) {
        val x = points[i] * size.width
        val y = points[i + 1] * size.height
        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    if (points.size == 2) path.lineTo(points[0] * size.width + 0.1f, points[1] * size.height)
    drawPath(
        path,
        if (tool == InkTool.PEN) PenColor else HighlighterColor,
        style = Stroke(strokeWidth(tool) * size.width, cap = StrokeCap.Round, join = StrokeJoin.Round),
    )
}

/** Lets the student drag a rectangle around the part of the page they need help with. */
@Composable
private fun MarkingOverlay(modifier: Modifier, onMark: (Rect) -> Unit) {
    val colors = Quill.colors
    var anchor by remember { mutableStateOf<Offset?>(null) }
    var end by remember { mutableStateOf<Offset?>(null) }
    val density = LocalDensity.current

    Canvas(
        modifier
            .background(colors.accent.copy(alpha = 0.06f))
            .pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown()
                    anchor = down.position
                    end = down.position
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        end = change.position
                        change.consume()
                    }
                    val a = anchor
                    val b = end
                    if (a != null && b != null) {
                        val rect = Rect(min(a.x, b.x), min(a.y, b.y), max(a.x, b.x), max(a.y, b.y))
                        val big = with(density) { rect.width >= 24.dp.toPx() && rect.height >= 16.dp.toPx() }
                        if (big) onMark(rect) else {
                            anchor = null
                            end = null
                        }
                    }
                }
            },
    ) {
        val a = anchor ?: return@Canvas
        val b = end ?: return@Canvas
        val topLeft = Offset(min(a.x, b.x), min(a.y, b.y))
        val rectSize = androidx.compose.ui.geometry.Size(abs(b.x - a.x), abs(b.y - a.y))
        val radius = androidx.compose.ui.geometry.CornerRadius(6.dp.toPx())
        drawRoundRect(colors.accent.copy(alpha = 0.14f), topLeft, rectSize, radius)
        drawRoundRect(
            colors.accent, topLeft, rectSize, radius,
            style = Stroke(1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx()))),
        )
    }
}

@Composable
private fun DocumentToolbar(
    mode: InteractionMode,
    onMode: (InteractionMode) -> Unit,
    instruments: InstrumentState,
    math: MathNotesState,
    onInstrument: (InstrumentKind) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Quill.colors
    var instrumentMenuOpen by remember { mutableStateOf(false) }
    var mathMenuOpen by remember { mutableStateOf(false) }
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        AnimatedVisibility(mode == InteractionMode.Mark || mode == InteractionMode.Math, enter = fadeIn() + slideInVertically { it }, exit = fadeOut() + slideOutVertically { it }) {
            QText(
                if (mode == InteractionMode.Math) "Zieh einen Rahmen um Rechnungen, eine Funktion oder eine Wertetabelle." else "Zieh einen Rahmen um die Stelle, bei der du Hilfe brauchst.",
                work(13f),
                colors.ink2,
                Modifier
                    .background(colors.surface, RoundedCornerShape(16.dp))
                    .border(1.dp, colors.line2, RoundedCornerShape(16.dp))
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            )
        }
        Row(
            Modifier
                .shadow(9.dp, CircleShape, ambientColor = Color.Black, spotColor = Color.Black)
                .background(colors.surface, CircleShape)
                .border(1.dp, colors.line2, CircleShape)
                .padding(5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            ToolbarItem("Lesen", mode == InteractionMode.Read) { onMode(InteractionMode.Read) }
            ToolbarItem("Stift", mode == InteractionMode.Draw(DrawingTool.PEN)) { onMode(InteractionMode.Draw(DrawingTool.PEN)) }
            ToolbarItem("Marker", mode == InteractionMode.Draw(DrawingTool.HIGHLIGHTER)) { onMode(InteractionMode.Draw(DrawingTool.HIGHLIGHTER)) }
            ToolbarItem("Radierer", mode == InteractionMode.Draw(DrawingTool.ERASER)) { onMode(InteractionMode.Draw(DrawingTool.ERASER)) }
            Box {
                ToolbarItem("Geometrie", instruments.kind != null) { instrumentMenuOpen = true }
                DropdownMenu(instrumentMenuOpen, { instrumentMenuOpen = false }, containerColor = colors.surface) {
                    InstrumentKind.entries.forEach { kind ->
                        DropdownMenuItem(
                            text = { QText(if (instruments.kind == kind) "✓ ${kind.label}" else kind.label, work(15f), colors.ink) },
                            onClick = {
                                instrumentMenuOpen = false
                                onInstrument(kind)
                            },
                        )
                    }
                    DropdownMenuItem(
                        text = { QText(if (instruments.trueScale) "✓ Echtgröße (1 cm = 1 cm)" else "Echtgröße (1 cm = 1 cm)", work(15f), colors.ink) },
                        onClick = {
                            instrumentMenuOpen = false
                            instruments.trueScale = !instruments.trueScale
                        },
                    )
                    if (instruments.kind != null) {
                        DropdownMenuItem(
                            text = { QText("Instrument weglegen", work(15f), colors.ink) },
                            onClick = {
                                instrumentMenuOpen = false
                                instruments.kind = null
                            },
                        )
                    }
                }
            }
            Box {
                ToolbarItem("Rechnen", mode == InteractionMode.Math) { mathMenuOpen = true }
                DropdownMenu(mathMenuOpen, { mathMenuOpen = false }, containerColor = colors.surface) {
                    DropdownMenuItem(
                        text = { QText("Bereich markieren und rechnen", work(15f), colors.ink) },
                        onClick = {
                            mathMenuOpen = false
                            onMode(InteractionMode.Math)
                        },
                    )
                    DropdownMenuItem(
                        text = { QText(if (math.enabled) "✓ Geschriebenes „=“ rechnet" else "Geschriebenes „=“ rechnet", work(15f), colors.ink) },
                        onClick = {
                            mathMenuOpen = false
                            math.enabled = !math.enabled
                            if (!math.enabled) math.preview = null
                        },
                    )
                }
            }
            Box(Modifier.padding(horizontal = 4.dp).width(1.dp).height(26.dp).background(colors.line2))
            ToolbarItem("Hilfe", mode == InteractionMode.Mark, dot = true) { onMode(InteractionMode.Mark) }
        }
    }
}

@Composable
private fun ToolbarItem(label: String, selected: Boolean, dot: Boolean = false, onClick: () -> Unit) {
    val colors = Quill.colors
    Row(
        Modifier
            .height(44.dp)
            .background(if (selected) colors.ink else Color.Transparent, CircleShape)
            .clickable(remember { MutableInteractionSource() }, null, role = Role.Tab, onClick = onClick)
            .padding(horizontal = if (dot) 18.dp else 17.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (dot) StatusDot()
        QText(label, work(14f, FontWeight.Medium, tracking = -0.14f), if (selected) colors.bg else colors.ink)
    }
}
