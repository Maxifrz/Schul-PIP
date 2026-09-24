package de.maxifrz.lernwerk.ui

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.core.content.FileProvider
import de.maxifrz.lernwerk.data.ImageCompressor
import de.maxifrz.lernwerk.data.StudyMaterial
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.pdf.PdfPages
import de.maxifrz.lernwerk.present.ElementKind
import de.maxifrz.lernwerk.present.PptxWriter
import de.maxifrz.lernwerk.present.Presentation
import de.maxifrz.lernwerk.present.PresentationAssistant
import de.maxifrz.lernwerk.present.PresentationPrompt
import de.maxifrz.lernwerk.present.ShapeType
import de.maxifrz.lernwerk.present.SlideElement
import de.maxifrz.lernwerk.present.SlideGeometry
import de.maxifrz.lernwerk.present.SlideLayout
import de.maxifrz.lernwerk.present.SlideLayouts
import de.maxifrz.lernwerk.present.SlideSize
import de.maxifrz.lernwerk.present.SlideTheme
import de.maxifrz.lernwerk.present.SwatchColors
import de.maxifrz.lernwerk.present.TextAlign
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.hypot
import kotlin.math.roundToInt

private sealed interface Drag {
    data class Move(val base: SlideElement) : Drag
    data class Resize(val base: SlideElement, val corner: SlideGeometry.Corner) : Drag
    data class LineEnd(val base: SlideElement, val start: Boolean) : Drag
    data class Rotate(val base: SlideElement) : Drag
}

@Composable
fun PresentationEditorScreen(app: AppState, presentationId: String, openAssistant: AssistantTab? = null) {
    val store = app.presentations
    val initial = store.presentation(presentationId)
    if (initial == null) {
        LaunchedEffect(Unit) { app.pop() }
        return
    }
    val state = remember(presentationId) { EditorState(initial) { store.update(it) } }
    val colors = Quill.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val presentation = state.presentation
    val theme = presentation.theme
    val images = rememberSlideImages(store, presentation.slides)

    var busy by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var assistant by remember { mutableStateOf(openAssistant) }
    val assistantModels = rememberAssistantModels(app, state)
    // Keeps the panel's content while it slides out.
    var lastTab by remember { mutableStateOf(openAssistant ?: AssistantTab.CHAT) }
    LaunchedEffect(assistant) { assistant?.let { lastTab = it } }
    var renaming by remember { mutableStateOf(false) }
    var pickingMaterial by remember { mutableStateOf(false) }

    fun runAi(label: String, task: suspend (PresentationAssistant) -> Unit) {
        if (busy != null) return
        state.finishEditing()
        busy = label
        errorMessage = null
        scope.launch {
            try {
                task(PresentationAssistant(app.settings.makeClient(LlmTask.TUTOR)))
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                errorMessage = error.message ?: "Die KI-Anfrage ist fehlgeschlagen."
            } finally {
                busy = null
            }
        }
    }

    fun export(pptx: Boolean) {
        state.finishEditing()
        busy = if (pptx) "PowerPoint wird erstellt" else "PDF wird erstellt"
        scope.launch {
            try {
                val snapshot = state.presentation
                val file = withContext(Dispatchers.IO) {
                    val dir = File(context.cacheDir, "exports").apply { mkdirs() }
                    val name = snapshot.title.replace(Regex("[^\\p{L}\\p{N} ._-]"), "").trim().ifEmpty { "Präsentation" }
                    val target = File(dir, "$name.${if (pptx) "pptx" else "pdf"}")
                    val bytes = if (pptx) {
                        PptxWriter.write(snapshot) { store.mediaBytes(it) }
                    } else {
                        val all = snapshot.slides.flatMap { s -> s.elements.mapNotNull { it.image } }.distinct()
                            .mapNotNull { n -> store.bitmap(n, 2400)?.let { n to it } }.toMap()
                        LocalPainterHolder.painter(context).pdf(snapshot, all)
                    }
                    target.writeBytes(bytes)
                    target
                }
                share(context, file, if (pptx) "application/vnd.openxmlformats-officedocument.presentationml.presentation" else "application/pdf")
            } catch (error: Exception) {
                errorMessage = "Export fehlgeschlagen: ${error.message}"
            } finally {
                busy = null
            }
        }
    }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            runCatching { insertPicture(app, state, loadPicture(context, uri)) }
                .onFailure { errorMessage = "Das Bild lässt sich nicht öffnen." }
        }
    }

    BackHandler {
        state.finishEditing()
        app.pop()
    }

    Column(Modifier.fillMaxSize().background(colors.bg)) {
        DetailHeader("Präsentation", presentation.title, onBack = {
            state.finishEditing()
            app.pop()
        }) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                busy?.let {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PulsingDots()
                        QText(it, work(13f), colors.faint)
                    }
                }
                OutlineButton(
                    if (assistant == null) "Assistent" else "Assistent ✓",
                    { assistant = if (assistant == null) AssistantTab.CHAT else null },
                    weight = FontWeight.Medium,
                )
                MenuButton("KI", enabled = busy == null) { close ->
                    MenuItem("Sprechernotizen schreiben") {
                        close()
                        runAi("Sprechernotizen") { state.replacePresentation(it.speakerNotes(state.presentation)) }
                    }
                    MenuItem("Kritiker") { close(); assistant = AssistantTab.CRITIC }
                    MenuItem("Feedback") { close(); assistant = AssistantTab.FEEDBACK }
                }
                MenuButton("Export", enabled = busy == null) { close ->
                    MenuItem("PowerPoint (.pptx)") { close(); export(pptx = true) }
                    MenuItem("PDF") { close(); export(pptx = false) }
                }
                MenuButton("Mehr") { close ->
                    MenuItem("Umbenennen") { close(); renaming = true }
                    MenuItem("Redezeit: ${presentation.minutes} min") {}
                    Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                        Stepper({ state.setMinutes(maxOf(1, state.presentation.minutes - 1)) }, { state.setMinutes(minOf(60, state.presentation.minutes + 1)) })
                    }
                }
                PrimaryButton("Präsentieren", {
                    state.finishEditing()
                    app.push(Route.Present(presentation.id, state.slideIndex))
                }, height = 34.dp, fontSize = 14f)
            }
        }
        errorMessage?.let {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Notice(it, modifier = Modifier.weight(1f))
                LinkButton("Schließen", { errorMessage = null }, colors.muted, work(13f))
            }
        }

        Row(Modifier.fillMaxSize()) {
            SlideList(state, images, Modifier.width(172.dp).fillMaxHeight())
            Box(Modifier.width(1.dp).fillMaxHeight().background(colors.line))
            Column(Modifier.weight(1f).fillMaxHeight().background(colors.canvas)) {
                InsertBar(
                    state = state,
                    onPickImage = { imagePicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    onPickMaterial = { pickingMaterial = true },
                )
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    EditorCanvas(state, images)
                }
                Inspector(state)
                NotesBar(state, aiEnabled = busy == null) { rewrite ->
                    val slide = state.slide
                    runAi(rewrite?.label ?: "Neu gestalten") { assistant ->
                        state.replaceSlide(if (rewrite == null) assistant.redesign(slide) else assistant.rewrite(slide, rewrite))
                    }
                }
            }
            AnimatedVisibility(assistant != null, enter = slideInHorizontally { it }, exit = slideOutHorizontally { it }) {
                Row {
                    Box(Modifier.width(1.dp).fillMaxHeight().background(colors.line))
                    AssistantPanel(
                        app, state, assistantModels, assistant ?: lastTab,
                        onTab = { assistant = it },
                        onClose = { assistant = null },
                        modifier = Modifier.width(380.dp).fillMaxHeight(),
                    )
                }
            }
        }
    }

    if (renaming) {
        RenameDialog(presentation.title, onDismiss = { renaming = false }) {
            state.rename(it)
            renaming = false
        }
    }
    if (pickingMaterial) {
        MaterialPageDialog(app, onDismiss = { pickingMaterial = false }) { material, page ->
            pickingMaterial = false
            scope.launch {
                val bitmap = withContext(Dispatchers.IO) { PdfPages.open(app.repository.pdfFile(material))?.use { it.render(page - 1, 1600) } }
                if (bitmap == null) {
                    errorMessage = "Die Seite lässt sich nicht darstellen."
                } else {
                    insertPicture(app, state, Picture(ImageCompressor.encode(bitmap, 85), "jpg", bitmap.width, bitmap.height))
                }
            }
        }
    }
}

/** Keeps one painter for exports outside composition. */
private object LocalPainterHolder {
    private var painter: de.maxifrz.lernwerk.present.SlidePainter? = null
    fun painter(context: Context) = painter ?: de.maxifrz.lernwerk.present.SlidePainter(context.applicationContext).also { painter = it }
}

private fun share(context: Context, file: File, mime: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, file.name))
}

private class Picture(val bytes: ByteArray, val extension: String, val width: Int, val height: Int)

private suspend fun loadPicture(context: Context, uri: Uri): Picture = withContext(Dispatchers.IO) {
    val bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, info, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        val longest = maxOf(info.size.width, info.size.height)
        if (longest > 2400) decoder.setTargetSampleSize(longest / 2400 + 1)
    }
    val png = context.contentResolver.getType(uri) == "image/png"
    val bytes = if (png) {
        java.io.ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
    } else {
        ImageCompressor.encode(bitmap, 88)
    }
    Picture(bytes, if (png) "png" else "jpg", bitmap.width, bitmap.height)
}

private suspend fun insertPicture(app: AppState, state: EditorState, picture: Picture) {
    val name = app.presentations.saveMedia(picture.bytes, picture.extension)
    val frame = SlideGeometry.fit(picture.width, picture.height, SlideGeometry.RectBox(240f, 110f, 480f, 320f))
    state.addElement(SlideElement(kind = ElementKind.IMAGE, x = frame.x, y = frame.y, width = frame.width, height = frame.height, image = name))
}

// Slide list

@Composable
private fun SlideList(state: EditorState, images: Map<String, Bitmap>, modifier: Modifier) {
    val colors = Quill.colors
    val presentation = state.presentation
    Column(modifier.background(colors.bg)) {
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            itemsIndexed(presentation.slides, key = { _, slide -> slide.id }) { index, slide ->
                var menuOpen by remember { mutableStateOf(false) }
                val selected = index == state.slideIndex
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    QText("${index + 1}", work(11f), if (selected) colors.ink else colors.faint, Modifier.width(16.dp))
                    Box {
                        val shape = RoundedCornerShape(4.dp)
                        SlideView(
                            slide,
                            presentation.theme,
                            images,
                            Modifier
                                .fillMaxWidth()
                                .clip(shape)
                                .border(if (selected) 2.dp else 1.dp, if (selected) colors.accent else colors.line2, shape)
                                .combinedClickable(
                                    remember { MutableInteractionSource() },
                                    null,
                                    onLongClick = { menuOpen = true },
                                    onClick = { state.selectSlide(index) },
                                ),
                        )
                        DropdownMenu(menuOpen, { menuOpen = false }, containerColor = colors.surface) {
                            MenuItem("Duplizieren") { menuOpen = false; state.duplicateSlide(index) }
                            MenuItem("Nach oben") { menuOpen = false; state.moveSlide(index, -1) }
                            MenuItem("Nach unten") { menuOpen = false; state.moveSlide(index, 1) }
                            MenuItem("Löschen", color = colors.warn) { menuOpen = false; state.deleteSlide(index) }
                        }
                    }
                }
            }
        }
        Box(Modifier.padding(14.dp)) {
            MenuButton("+ Folie", modifier = Modifier.fillMaxWidth()) { close ->
                SlideLayout.entries.forEach { layout -> MenuItem(layout.label) { close(); state.addSlide(layout) } }
            }
        }
    }
}

// Toolbars

@Composable
private fun InsertBar(state: EditorState, onPickImage: () -> Unit, onPickMaterial: () -> Unit) {
    val colors = Quill.colors
    Row(
        Modifier.fillMaxWidth().background(colors.bg).horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlineButton("Text", {
            state.addElement(SlideLayouts.text("Text", 330f, 230f, 300f, 60f, 28f), edit = true)
        }, weight = FontWeight.Medium)
        MenuButton("Form") { close ->
            listOf(
                ShapeType.RECT to "Rechteck", ShapeType.ROUNDED to "Abgerundet", ShapeType.ELLIPSE to "Oval",
                ShapeType.LINE to "Linie", ShapeType.ARROW to "Pfeil",
            ).forEach { (type, label) ->
                MenuItem(label) {
                    close()
                    val line = type == ShapeType.LINE || type == ShapeType.ARROW
                    state.addElement(
                        SlideElement(
                            kind = ElementKind.SHAPE,
                            x = 380f, y = if (line) 260f else 200f, width = 200f, height = if (line) 20f else 140f,
                            shape = type, fill = if (line) "text" else "accent", strokeWidth = if (line) 4f else 0f,
                        ),
                    )
                }
            }
        }
        MenuButton("Bild") { close ->
            MenuItem("Aus der Galerie") { close(); onPickImage() }
            MenuItem("Seite aus Material") { close(); onPickMaterial() }
        }
        Box(Modifier.width(1.dp).height(24.dp).background(colors.line2))
        MenuButton("Design") { close ->
            SlideTheme.all.forEach { theme ->
                MenuItem(theme.name + if (theme.id == state.presentation.themeId) "  ✓" else "") { close(); state.setTheme(theme.id) }
            }
        }
        Box(Modifier.width(1.dp).height(24.dp).background(colors.line2))
        OutlineButton("Rückgängig", state::undo, enabled = state.canUndo)
        OutlineButton("Wiederholen", state::redo, enabled = state.canRedo)
    }
    QuillDivider(colors.lineSoft)
}

@Composable
private fun Inspector(state: EditorState) {
    val colors = Quill.colors
    val element = state.selected ?: return
    val theme = state.presentation.theme
    QuillDivider(colors.lineSoft)
    Row(
        Modifier.fillMaxWidth().background(colors.bg).horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        when (element.kind) {
            ElementKind.TEXT -> {
                ToolChip("A−") { state.updateElement(element.id) { it.copy(fontSize = maxOf(8f, it.fontSize - 2f)) } }
                QText("${element.fontSize.roundToInt()} pt", work(13f), colors.muted, Modifier.width(44.dp))
                ToolChip("A+") { state.updateElement(element.id) { it.copy(fontSize = minOf(160f, it.fontSize + 2f)) } }
                ToolChip("B", selected = element.bold) { state.updateElement(element.id) { it.copy(bold = !it.bold) } }
                ToolChip("I", selected = element.italic) { state.updateElement(element.id) { it.copy(italic = !it.italic) } }
                ToolChip("•  Liste", selected = element.bullets) { state.updateElement(element.id) { it.copy(bullets = !it.bullets) } }
                ToolChip(
                    when (element.align) {
                        TextAlign.LEFT -> "Links"
                        TextAlign.CENTER -> "Mitte"
                        TextAlign.RIGHT -> "Rechts"
                    },
                ) {
                    state.updateElement(element.id) { it.copy(align = TextAlign.entries[(it.align.ordinal + 1) % 3]) }
                }
                ColorMenu("Farbe", element.textColor, theme, allowNone = false) { color -> state.updateElement(element.id) { it.copy(textColor = color) } }
                ToolChip("Bearbeiten") { state.startEditing(element.id) }
            }
            ElementKind.SHAPE -> {
                val line = SlideGeometry.isLine(element)
                ColorMenu(if (line) "Farbe" else "Füllung", element.fill, theme, allowNone = !line) { color ->
                    state.updateElement(element.id) { it.copy(fill = color) }
                }
                if (line) {
                    ToolChip("Dünner") { state.updateElement(element.id) { it.copy(strokeWidth = maxOf(1f, maxOf(3f, it.strokeWidth) - 1f)) } }
                    ToolChip("Dicker") { state.updateElement(element.id) { it.copy(strokeWidth = minOf(24f, maxOf(3f, it.strokeWidth) + 1f)) } }
                } else {
                    ColorMenu("Rand", element.stroke, theme, allowNone = true) { color ->
                        state.updateElement(element.id) { it.copy(stroke = color, strokeWidth = if (color == "none") 0f else maxOf(2f, it.strokeWidth)) }
                    }
                }
            }
            ElementKind.IMAGE -> QText("Bild", work(13f), colors.muted)
        }
        Box(Modifier.width(1.dp).height(24.dp).background(colors.line2))
        ToolChip("Nach vorn") { state.reorderSelected(forward = true) }
        ToolChip("Nach hinten") { state.reorderSelected(forward = false) }
        ToolChip("Drehung 0°") { state.updateElement(element.id) { it.copy(rotation = 0f) } }
        ToolChip("Duplizieren", onClick = state::duplicateSelected)
        ToolChip("Löschen", color = colors.warn, onClick = state::deleteSelected)
    }
}

@Composable
private fun NotesBar(state: EditorState, aiEnabled: Boolean, onAi: (PresentationPrompt.Rewrite?) -> Unit) {
    val colors = Quill.colors
    QuillDivider(colors.lineSoft)
    Row(
        Modifier.fillMaxWidth().background(colors.bg).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            PixelCaption("Sprechernotizen", size = 9f)
            Box(Modifier.padding(top = 6.dp).fillMaxWidth().heightIn(min = 44.dp, max = 110.dp)) {
                val notes = state.slide.notes
                if (notes.isEmpty()) QText("Was du zu dieser Folie sagst …", work(14f), colors.hint)
                BasicTextField(
                    value = notes,
                    onValueChange = state::setNotes,
                    textStyle = work(14f, lineHeight = 20f).copy(color = colors.ink2),
                    cursorBrush = SolidColor(colors.accent),
                    modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                )
            }
        }
        MenuButton("Folie mit KI", enabled = aiEnabled) { close ->
            PresentationPrompt.Rewrite.entries.forEach { rewrite -> MenuItem(rewrite.label) { close(); onAi(rewrite) } }
            MenuItem("Neu gestalten") { close(); onAi(null) }
        }
    }
}

// Canvas

@Composable
private fun EditorCanvas(state: EditorState, images: Map<String, Bitmap>) {
    val colors = Quill.colors
    val density = LocalDensity.current
    val painter = LocalSlidePainter.current
    val touchSlop = LocalViewConfiguration.current.touchSlop
    val presentation = state.presentation
    val theme = presentation.theme

    BoxWithConstraints(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        val width = minOf(maxWidth, maxHeight * 16f / 9f)
        val height = width * 9f / 16f
        val scale = with(density) { width.toPx() } / SlideSize.WIDTH
        Box(Modifier.size(width, height).shadow(10.dp, RoundedCornerShape(2.dp))) {
            Canvas(
                Modifier
                    .fillMaxSize()
                    .pointerInput(state, scale) {
                        val handleRadius = 22.dp.toPx() / scale
                        val rotateOffset = 30.dp.toPx() / scale
                        val snapThreshold = 7.dp.toPx() / scale
                        awaitEachGesture {
                            val down = awaitFirstDown()
                            state.finishEditing()
                            val px = down.position.x / scale
                            val py = down.position.y / scale
                            val slide = state.slide
                            val selected = state.selected
                            var drag: Drag? = null

                            if (selected != null) {
                                if (SlideGeometry.isLine(selected)) {
                                    val (sx, sy) = selected.toSlide(0f, selected.height / 2)
                                    val (ex, ey) = selected.toSlide(selected.width, selected.height / 2)
                                    drag = when {
                                        hypot(px - sx, py - sy) < handleRadius -> Drag.LineEnd(selected, true)
                                        hypot(px - ex, py - ey) < handleRadius -> Drag.LineEnd(selected, false)
                                        else -> null
                                    }
                                } else {
                                    val (rx, ry) = selected.toSlide(selected.width / 2, -rotateOffset)
                                    drag = if (hypot(px - rx, py - ry) < handleRadius) Drag.Rotate(selected) else null
                                    if (drag == null) {
                                        drag = SlideGeometry.Corner.entries.firstOrNull { corner ->
                                            val (cx, cy) = SlideGeometry.corner(selected, corner)
                                            hypot(px - cx, py - cy) < handleRadius
                                        }?.let { Drag.Resize(selected, it) }
                                    }
                                }
                            }
                            var tappedSelected = false
                            if (drag == null) {
                                val hit = slide.elements.lastOrNull { it.contains(px, py, 4f / scale) }
                                if (hit != null) {
                                    tappedSelected = hit.id == state.selectedId
                                    state.selectedId = hit.id
                                    drag = Drag.Move(hit)
                                } else {
                                    state.selectedId = null
                                }
                            }
                            val active = drag ?: return@awaitEachGesture
                            down.consume()
                            state.beginGesture()
                            var moved = false
                            while (true) {
                                val event = awaitPointerEvent()
                                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                                if (!change.pressed) break
                                if (!moved && (change.position - down.position).getDistance() < touchSlop) continue
                                moved = true
                                val x = change.position.x / scale
                                val y = change.position.y / scale
                                when (active) {
                                    is Drag.Move -> {
                                        val base = active.base
                                        val candidate = base.copy(x = base.x + x - px, y = base.y + y - py)
                                        val others = slide.elements.filter { it.id != base.id && it.rotation == 0f }
                                        val snap = SlideGeometry.snap(candidate, others, snapThreshold)
                                        state.verticalGuides = snap.verticalGuides
                                        state.horizontalGuides = snap.horizontalGuides
                                        state.updateElement(base.id, record = false) { candidate.copy(x = candidate.x + snap.dx, y = candidate.y + snap.dy) }
                                    }
                                    is Drag.Resize -> state.updateElement(active.base.id, record = false) {
                                        SlideGeometry.resize(active.base, active.corner, x, y, keepAspect = active.base.kind == ElementKind.IMAGE)
                                    }
                                    is Drag.LineEnd -> state.updateElement(active.base.id, record = false) {
                                        SlideGeometry.moveLineEnd(active.base, active.start, x, y)
                                    }
                                    is Drag.Rotate -> state.updateElement(active.base.id, record = false) {
                                        it.copy(rotation = SlideGeometry.rotation(active.base, x, y))
                                    }
                                }
                                change.consume()
                            }
                            state.verticalGuides = emptyList()
                            state.horizontalGuides = emptyList()
                            state.endGesture()
                            if (!moved && tappedSelected && active is Drag.Move && active.base.kind == ElementKind.TEXT) {
                                state.startEditing(active.base.id)
                            }
                        }
                    },
            ) {
                drawIntoCanvas { painter.draw(it.nativeCanvas, state.slide, theme, scale, images, state.editingId) }
                val selected = state.selected
                if (selected != null && state.editingId == null) drawSelection(selected, scale, colors.accent)
                state.verticalGuides.forEach { gx ->
                    drawLine(colors.accent, Offset(gx * scale, 0f), Offset(gx * scale, size.height), 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f)))
                }
                state.horizontalGuides.forEach { gy ->
                    drawLine(colors.accent, Offset(0f, gy * scale), Offset(size.width, gy * scale), 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f)))
                }
            }
            state.editing?.let { TextEditOverlay(state, it, scale, theme) }
        }
    }
}

private fun DrawScope.drawSelection(element: SlideElement, scale: Float, accent: Color) {
    val handle = 6.dp.toPx()
    val stroke = 1.5.dp.toPx()
    fun point(lx: Float, ly: Float): Offset = element.toSlide(lx, ly).let { (x, y) -> Offset(x * scale, y * scale) }
    fun knob(center: Offset) {
        drawCircle(Color.White, handle, center)
        drawCircle(accent, handle, center, style = Stroke(stroke))
    }
    if (SlideGeometry.isLine(element)) {
        knob(point(0f, element.height / 2))
        knob(point(element.width, element.height / 2))
        return
    }
    val corners = SlideGeometry.Corner.entries.map { point(it.fx * element.width, it.fy * element.height) }
    val outline = Path().apply {
        moveTo(corners[0].x, corners[0].y)
        corners.drop(1).forEach { lineTo(it.x, it.y) }
        close()
    }
    drawPath(outline, accent, style = Stroke(stroke))
    val top = point(element.width / 2, 0f)
    val knobCenter = point(element.width / 2, -30.dp.toPx() / scale)
    drawLine(accent, top, knobCenter, stroke)
    drawCircle(accent, handle, knobCenter)
    corners.forEach(::knob)
}

@Composable
private fun TextEditOverlay(state: EditorState, element: SlideElement, scale: Float, theme: SlideTheme) {
    val density = LocalDensity.current
    val focus = remember(element.id) { FocusRequester() }
    var value by remember(element.id) { mutableStateOf(TextFieldValue(element.text, TextRange(element.text.length))) }
    val color = theme.color(element.textColor) ?: theme.text
    val fontSize = with(density) { (element.fontSize * scale).toSp() }
    val style = work(1f).copy(
        fontSize = fontSize,
        lineHeight = fontSize * 1.17f,
        fontWeight = if (element.bold) FontWeight.SemiBold else FontWeight.Normal,
        fontStyle = if (element.italic) FontStyle.Italic else FontStyle.Normal,
        letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified,
        color = hex(color),
        textAlign = when (element.align) {
            TextAlign.LEFT -> androidx.compose.ui.text.style.TextAlign.Start
            TextAlign.CENTER -> androidx.compose.ui.text.style.TextAlign.Center
            TextAlign.RIGHT -> androidx.compose.ui.text.style.TextAlign.End
        },
    )
    LaunchedEffect(element.id) { focus.requestFocus() }
    BasicTextField(
        value = value,
        onValueChange = {
            value = it
            state.updateElement(element.id, record = false) { current -> current.copy(text = it.text) }
        },
        textStyle = style,
        cursorBrush = SolidColor(hex(theme.accent)),
        modifier = Modifier
            .offset { IntOffset((element.x * scale).roundToInt(), (element.y * scale).roundToInt()) }
            .size(with(density) { (element.width * scale).toDp() }, with(density) { maxOf(element.height, 40f).times(scale).toDp() })
            .graphicsLayer { rotationZ = element.rotation }
            .background(hex(theme.accent).copy(alpha = 0.08f))
            .focusRequester(focus),
    )
}

// Small controls

@Composable
private fun ToolChip(label: String, selected: Boolean = false, color: Color = Quill.colors.ink, onClick: () -> Unit) {
    val colors = Quill.colors
    Box(
        Modifier
            .height(32.dp)
            .background(if (selected) colors.ink else Color.Transparent, CircleShape)
            .border(1.dp, if (selected) Color.Transparent else colors.line2, CircleShape)
            .pressable(CircleShape, onClick = onClick)
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        QText(label, work(13f, FontWeight.Medium), if (selected) colors.bg else color, maxLines = 1)
    }
}

@Composable
fun MenuButton(
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable (close: () -> Unit) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        OutlineButton("$label ▾", { open = true }, weight = FontWeight.Medium, enabled = enabled)
        DropdownMenu(open, { open = false }, containerColor = Quill.colors.surface) {
            content { open = false }
        }
    }
}

@Composable
fun MenuItem(label: String, color: Color = Quill.colors.ink, onClick: () -> Unit) {
    DropdownMenuItem(text = { QText(label, work(15f), color) }, onClick = onClick)
}

@Composable
private fun ColorMenu(label: String, current: String, theme: SlideTheme, allowNone: Boolean, onPick: (String) -> Unit) {
    val colors = Quill.colors
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier
                .height(32.dp)
                .border(1.dp, colors.line2, CircleShape)
                .pressable(CircleShape) { open = true }
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Swatch(theme.color(current), 14.dp)
            QText(label, work(13f, FontWeight.Medium), colors.ink)
        }
        DropdownMenu(open, { open = false }, containerColor = colors.surface) {
            Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                (if (allowNone) listOf("none") + SwatchColors else SwatchColors).forEach { token ->
                    Box(
                        Modifier
                            .size(30.dp)
                            .border(if (token == current) 2.dp else 0.dp, if (token == current) colors.accent else Color.Transparent, CircleShape)
                            .padding(3.dp)
                            .pressable(CircleShape) {
                                open = false
                                onPick(token)
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Swatch(theme.color(token), 24.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun Swatch(rgb: Long?, size: androidx.compose.ui.unit.Dp) {
    val colors = Quill.colors
    if (rgb == null) {
        Canvas(Modifier.size(size)) {
            drawCircle(colors.line3, style = Stroke(1.dp.toPx()))
            drawLine(colors.warn, Offset(this.size.width * 0.2f, this.size.height * 0.8f), Offset(this.size.width * 0.8f, this.size.height * 0.2f), 1.5.dp.toPx())
        }
    } else {
        Box(Modifier.size(size).background(hex(rgb), CircleShape).border(1.dp, colors.line2, CircleShape))
    }
}

@Composable
private fun RenameDialog(title: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    val colors = Quill.colors
    var value by remember { mutableStateOf(title) }
    Dialog(onDismissRequest = onDismiss) {
        Column(Modifier.widthIn(max = 460.dp).background(colors.bg, RoundedCornerShape(24.dp)).padding(24.dp)) {
            PixelCaption("Umbenennen", Modifier.padding(bottom = 12.dp))
            Box(
                Modifier.fillMaxWidth().background(colors.surface, RoundedCornerShape(14.dp)).border(1.dp, colors.line2, RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                BasicTextField(value, { value = it }, singleLine = true, textStyle = work(16f).copy(color = colors.ink), cursorBrush = SolidColor(colors.accent), modifier = Modifier.fillMaxWidth())
            }
            Row(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                LinkButton("Abbrechen", onDismiss, colors.muted, work(15f))
                PrimaryButton("Speichern", { onSave(value) }, height = 38.dp, fontSize = 14.5f)
            }
        }
    }
}

/** Picks a page of a material from the library to put on the slide as a picture. */
@Composable
private fun MaterialPageDialog(app: AppState, onDismiss: () -> Unit, onPick: (StudyMaterial, Int) -> Unit) {
    val colors = Quill.colors
    var material by remember { mutableStateOf<StudyMaterial?>(null) }
    var page by remember { mutableIntStateOf(1) }
    Dialog(onDismissRequest = onDismiss) {
        Column(Modifier.widthIn(max = 560.dp).background(colors.bg, RoundedCornerShape(24.dp)).padding(24.dp)) {
            val chosen = material
            if (chosen == null) {
                PixelCaption("Material wählen", Modifier.padding(bottom = 10.dp))
                if (app.repository.library.isEmpty()) QText("Die Bibliothek ist noch leer.", work(15f), colors.faint)
                Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                    app.repository.library.forEach { item ->
                        QText(item.title, work(15.5f), colors.ink, Modifier.fillMaxWidth().pressable {
                            material = item
                            page = 1
                        }.padding(vertical = 13.dp, horizontal = 2.dp))
                        QuillDivider()
                    }
                }
            } else {
                val pageCount by produceState(0, chosen.id) {
                    value = withContext(Dispatchers.IO) { PdfPages.open(app.repository.pdfFile(chosen))?.use { it.pageCount } ?: 0 }
                }
                val preview by produceState<Bitmap?>(null, chosen.id, page) {
                    value = withContext(Dispatchers.IO) { PdfPages.open(app.repository.pdfFile(chosen))?.use { it.render(page - 1, 700) } }
                }
                PixelCaption(chosen.title, Modifier.padding(bottom = 10.dp))
                Box(Modifier.fillMaxWidth().heightIn(max = 380.dp).background(colors.canvas, RoundedCornerShape(10.dp)).padding(10.dp), contentAlignment = Alignment.Center) {
                    preview?.let { Image(it.asImageBitmap(), contentDescription = "Seite $page", modifier = Modifier.aspectRatio(it.width.toFloat() / it.height)) }
                        ?: PulsingDots(6.dp)
                }
                Row(Modifier.fillMaxWidth().padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                    QText("Seite $page von $pageCount", work(15f), colors.ink, Modifier.weight(1f))
                    Stepper({ page = maxOf(1, page - 1) }, { page = minOf(maxOf(1, pageCount), page + 1) })
                }
                Row(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                    LinkButton("Zurück", { material = null }, colors.muted, work(15f))
                    PrimaryButton("Einfügen", { onPick(chosen, page) }, height = 38.dp, fontSize = 14.5f, enabled = pageCount > 0)
                }
            }
        }
    }
}
