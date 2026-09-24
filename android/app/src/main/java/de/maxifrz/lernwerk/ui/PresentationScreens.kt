package de.maxifrz.lernwerk.ui

import android.graphics.Bitmap
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.data.ImageCompressor
import de.maxifrz.lernwerk.data.PresentationStore
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.pdf.AndroidMaterialDocument
import de.maxifrz.lernwerk.pdf.PdfPages
import de.maxifrz.lernwerk.present.PlacedImage
import de.maxifrz.lernwerk.present.Presentation
import de.maxifrz.lernwerk.present.PresentationAssistant
import de.maxifrz.lernwerk.present.Slide
import de.maxifrz.lernwerk.present.SlideLayout
import de.maxifrz.lernwerk.present.SlideLayouts
import de.maxifrz.lernwerk.present.SlidePainter
import de.maxifrz.lernwerk.present.SlideTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.Closeable
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

val LocalSlidePainter = staticCompositionLocalOf<SlidePainter> { error("No SlidePainter provided") }

/** Loads the pictures a set of slides uses; keeps already loaded ones while new ones arrive. */
@Composable
fun rememberSlideImages(store: PresentationStore, slides: List<Slide>, maxSize: Int = 1600): Map<String, Bitmap> {
    val names = slides.flatMap { slide -> slide.elements.mapNotNull { it.image } }.distinct()
    var images by remember { mutableStateOf(emptyMap<String, Bitmap>()) }
    LaunchedEffect(names, maxSize) {
        val loaded = names.mapNotNull { name -> (images[name] ?: store.bitmap(name, maxSize))?.let { name to it } }.toMap()
        images = loaded
    }
    return images
}

/** One slide drawn by the shared painter, always 16:9. */
@Composable
fun SlideView(slide: Slide, theme: SlideTheme, images: Map<String, Bitmap>, modifier: Modifier = Modifier, skipElementId: String? = null) {
    val painter = LocalSlidePainter.current
    Canvas(modifier.aspectRatio(16f / 9f).clipToBounds()) {
        drawIntoCanvas { painter.draw(it.nativeCanvas, slide, theme, size.width / 960f, images, skipElementId) }
    }
}

private val shortDate = DateTimeFormatter.ofPattern("d. MMM", Locale.GERMAN)

@Composable
fun PresentationListScreen(app: AppState) {
    val store = app.presentations
    val colors = Quill.colors
    val presentations = store.presentations.sortedByDescending { it.updatedAt }

    fun createBlank() {
        val presentation = Presentation(title = "Neue Präsentation", slides = listOf(SlideLayouts.preset(SlideLayout.TITLE)))
        store.add(presentation)
        app.push(Route.PresentationEditor(presentation.id))
    }

    if (presentations.isEmpty()) {
        ContentColumn {
            Column(Modifier.widthIn(max = 520.dp).padding(top = 70.dp)) {
                PixelCaption("Präsentation")
                QText("Noch keine Präsentation", work(34f, FontWeight.Light, tracking = -0.85f), colors.ink, Modifier.padding(top = 16.dp))
                QText(
                    "Die KI baut aus deinem Material eine Präsentation mit Sprechernotizen – oder du gestaltest die Folien frei selbst. Exportieren kannst du als PowerPoint oder PDF.",
                    work(15.5f, lineHeight = 23f),
                    colors.muted,
                    Modifier.padding(top = 14.dp, bottom = 30.dp),
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    PrimaryButton("Mit KI erstellen", { app.push(Route.CreatePresentation) }, height = 48.dp, fontSize = 15.5f)
                    OutlineButton("Leere Präsentation", ::createBlank, height = 48.dp, fontSize = 15.5f, weight = FontWeight.Medium)
                }
            }
        }
        return
    }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(240.dp),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 40.dp, end = 40.dp, top = 44.dp, bottom = 60.dp),
        horizontalArrangement = Arrangement.spacedBy(28.dp),
        verticalArrangement = Arrangement.spacedBy(30.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            PageHeader(if (presentations.size == 1) "1 Präsentation" else "${presentations.size} Präsentationen", "Präsentation") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlineButton("Leer", ::createBlank, height = 44.dp, fontSize = 15f, weight = FontWeight.Medium)
                    PrimaryButton("Mit KI erstellen", { app.push(Route.CreatePresentation) })
                }
            }
        }
        items(presentations, key = { it.id }) { presentation ->
            PresentationTile(app, presentation)
        }
    }
}

@Composable
private fun PresentationTile(app: AppState, presentation: Presentation) {
    val colors = Quill.colors
    var menuOpen by remember { mutableStateOf(false) }
    val first = presentation.slides.firstOrNull() ?: Slide()
    val images = rememberSlideImages(app.presentations, listOf(first), 600)
    Column(
        Modifier.combinedClickable(
            remember { MutableInteractionSource() },
            null,
            onLongClick = { menuOpen = true },
            onClick = { app.push(Route.PresentationEditor(presentation.id)) },
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box {
            val shape = RoundedCornerShape(6.dp)
            SlideView(
                first,
                presentation.theme,
                images,
                Modifier.fillMaxWidth().shadow(8.dp, shape, ambientColor = colors.ink, spotColor = colors.ink).clip(shape).border(1.dp, colors.line, shape),
            )
            DropdownMenu(menuOpen, { menuOpen = false }, containerColor = colors.surface) {
                DropdownMenuItem(text = { QText("Präsentieren", work(15f), colors.ink) }, onClick = {
                    menuOpen = false
                    app.push(Route.Present(presentation.id, 0))
                })
                DropdownMenuItem(text = { QText("Duplizieren", work(15f), colors.ink) }, onClick = {
                    menuOpen = false
                    app.presentations.add(
                        presentation.copy(
                            id = de.maxifrz.lernwerk.present.SlideElement.newId(),
                            title = "${presentation.title} (Kopie)",
                            createdAt = System.currentTimeMillis(),
                            updatedAt = System.currentTimeMillis(),
                        ),
                    )
                })
                DropdownMenuItem(text = { QText("Löschen", work(15f), colors.warn) }, onClick = {
                    menuOpen = false
                    app.presentations.delete(presentation)
                })
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            QText(presentation.title, work(14.5f, FontWeight.Medium, tracking = -0.15f), colors.ink, maxLines = 2)
            val date = Instant.ofEpochMilli(presentation.updatedAt).atZone(ZoneId.systemDefault()).format(shortDate)
            val count = presentation.slides.size
            QText("${if (count == 1) "1 Folie" else "$count Folien"} · $date", work(12.5f), colors.faint, maxLines = 1)
        }
    }
}

@Composable
fun PresentationCreateScreen(app: AppState) {
    val colors = Quill.colors
    val repository = app.repository
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val materials = repository.materials.sortedBy { it.createdAt }
    var selection by remember { mutableStateOf(setOf<String>()) }
    var topic by remember { mutableStateOf("") }
    var slideCount by remember { mutableIntStateOf(10) }
    var minutes by remember { mutableIntStateOf(10) }
    var themeId by remember { mutableStateOf(SlideTheme.QUILL.id) }
    var isGenerating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun generate() {
        val chosen = materials.filter { it.id in selection }
        val client = app.settings.makeClient(LlmTask.PLAN)
        isGenerating = true
        errorMessage = null
        scope.launch {
            val opened = mutableListOf<Closeable>()
            try {
                val inputs = withContext(Dispatchers.IO) {
                    chosen.map { PresentationAssistant.Material(it.id, it.title, repository.pdfFile(it).readBytes()) }
                }
                val presentation = PresentationAssistant(client).generate(
                    materials = inputs,
                    topic = topic.trim(),
                    slideCount = slideCount,
                    minutes = minutes,
                    themeId = themeId,
                    openDocument = { data -> AndroidMaterialDocument.open(data, context.cacheDir)?.also { opened += it } },
                    pageImage = pageImage@{ index, page ->
                        val material = chosen.getOrNull(index) ?: return@pageImage null
                        val bitmap = withContext(Dispatchers.IO) {
                            PdfPages.open(repository.pdfFile(material))?.use { it.render(page - 1, 1600) }
                        } ?: return@pageImage null
                        val name = app.presentations.saveMedia(ImageCompressor.encode(bitmap, 85), "jpg")
                        PlacedImage(name, bitmap.width.toFloat() / bitmap.height)
                    },
                )
                app.presentations.add(presentation)
                app.replace(Route.PresentationEditor(presentation.id))
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                errorMessage = error.message ?: "Die Präsentation konnte nicht erstellt werden."
            } finally {
                opened.forEach { runCatching { it.close() } }
                isGenerating = false
            }
        }
    }

    androidx.activity.compose.BackHandler(enabled = isGenerating) {}

    Box(Modifier.fillMaxSize().background(colors.bg)) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp)) {
                QText("Präsentation mit KI", work(16f, FontWeight.Medium, tracking = -0.24f), colors.ink, Modifier.align(Alignment.Center))
                Row(Modifier.fillMaxWidth().align(Alignment.Center), verticalAlignment = Alignment.CenterVertically) {
                    LinkButton("Abbrechen", { if (!isGenerating) app.pop() }, colors.muted, work(15f))
                    Box(Modifier.weight(1f))
                    PrimaryButton("Erstellen", ::generate, height = 34.dp, fontSize = 14f, enabled = selection.isNotEmpty() && !isGenerating)
                }
            }
            QuillDivider(colors.lineSoft)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                ContentColumn(maxWidth = 680.dp, top = 22.dp) {
                    PixelCaption("Material", Modifier.padding(bottom = 6.dp))
                    if (materials.isEmpty()) {
                        QText("Importiere zuerst ein PDF in der Bibliothek.", work(15f), colors.faint, Modifier.padding(vertical = 14.dp, horizontal = 2.dp))
                        QuillDivider()
                    }
                    materials.forEach { material ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .pressable { selection = if (material.id in selection) selection - material.id else selection + material.id }
                                .padding(vertical = 15.dp, horizontal = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            QText(material.title, work(15.5f), colors.ink, Modifier.weight(1f))
                            CheckCircle(material.id in selection)
                        }
                        QuillDivider()
                    }

                    PixelCaption("Präsentation", Modifier.padding(top = 28.dp, bottom = 6.dp))
                    Column(Modifier.padding(vertical = 12.dp, horizontal = 2.dp)) {
                        QText("Thema oder Schwerpunkt", work(15.5f), colors.ink)
                        Box(
                            Modifier
                                .padding(top = 10.dp)
                                .fillMaxWidth()
                                .background(colors.surface, RoundedCornerShape(14.dp))
                                .border(1.dp, colors.line2, RoundedCornerShape(14.dp))
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                        ) {
                            if (topic.isEmpty()) QText("z. B. „Die Kettenregel mit Beispielen“ – leer lassen für das ganze Material", work(15f), colors.hint)
                            BasicTextField(
                                topic,
                                { topic = it },
                                textStyle = work(15f).copy(color = colors.ink),
                                cursorBrush = SolidColor(colors.accent),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                    QuillDivider()
                    QuillRow("$slideCount Folien", verticalPadding = 10.dp) {
                        Stepper({ slideCount = maxOf(4, slideCount - 1) }, { slideCount = minOf(25, slideCount + 1) })
                    }
                    QuillRow("$minutes Minuten Redezeit", verticalPadding = 10.dp) {
                        Stepper({ minutes = maxOf(3, minutes - 1) }, { minutes = minOf(45, minutes + 1) })
                    }
                    QuillRow("Design", verticalPadding = 10.dp) {
                        ThemePicker(themeId) { themeId = it }
                    }
                    Footnote("Nutzt das Lernplan-Modell aus den Einstellungen. Die KI verwendet nur Inhalte aus deinem Material und nennt die Seiten als Quellen. Danach kannst du jede Folie frei bearbeiten.")
                    errorMessage?.let { Notice(it, modifier = Modifier.padding(top = 20.dp)) }
                }
            }
        }

        AnimatedVisibility(isGenerating, enter = fadeIn(), exit = fadeOut()) {
            Box(
                Modifier.fillMaxSize().background(colors.scrim)
                    .combinedClickable(remember { MutableInteractionSource() }, null, onClick = {}),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    Modifier.background(colors.surface, RoundedCornerShape(20.dp)).padding(horizontal = 32.dp, vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    PulsingDots(6.dp)
                    QText("Die KI baut deine Folien …", work(16f, FontWeight.Medium, tracking = -0.16f), colors.ink)
                    QText("Je nach Umfang dauert das bis zu zwei Minuten.", work(12.5f), colors.faint)
                }
            }
        }
    }
}

@Composable
fun Stepper(onMinus: () -> Unit, onPlus: () -> Unit) {
    val colors = Quill.colors
    Row(Modifier.border(1.dp, colors.line2, RoundedCornerShape(16.dp)), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(44.dp).height(32.dp).pressable(RoundedCornerShape(16.dp), onClick = onMinus), contentAlignment = Alignment.Center) {
            QText("−", work(16f), colors.ink)
        }
        Box(Modifier.width(1.dp).height(32.dp).background(colors.line2))
        Box(Modifier.width(44.dp).height(32.dp).pressable(RoundedCornerShape(16.dp), onClick = onPlus), contentAlignment = Alignment.Center) {
            QText("+", work(16f), colors.ink)
        }
    }
}

/** The four slide designs as small previews. */
@Composable
fun ThemePicker(selected: String, onSelect: (String) -> Unit) {
    val colors = Quill.colors
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        SlideTheme.all.forEach { theme ->
            val isSelected = theme.id == selected
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(
                    Modifier
                        .size(width = 56.dp, height = 32.dp)
                        .border(if (isSelected) 2.dp else 1.dp, if (isSelected) colors.accent else colors.line2, RoundedCornerShape(6.dp))
                        .padding(3.dp)
                        .background(hex(theme.background), RoundedCornerShape(4.dp))
                        .pressable(RoundedCornerShape(4.dp)) { onSelect(theme.id) },
                    contentAlignment = Alignment.Center,
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(width = 16.dp, height = 4.dp).background(hex(theme.text), CircleShape))
                        Box(Modifier.size(6.dp).background(hex(theme.accent), CircleShape))
                    }
                }
                QText(theme.name, work(11.5f), if (isSelected) colors.ink else colors.faint)
            }
        }
    }
}
