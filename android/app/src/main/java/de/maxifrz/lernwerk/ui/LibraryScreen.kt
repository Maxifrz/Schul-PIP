package de.maxifrz.lernwerk.ui

import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.data.StudyMaterial
import de.maxifrz.lernwerk.pdf.DemoPdf
import de.maxifrz.lernwerk.pdf.PdfPages
import de.maxifrz.lernwerk.tutor.DemoContent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun LibraryScreen(app: AppState) {
    val repository = app.repository
    val scope = rememberCoroutineScope()
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val materials = repository.materials.sortedByDescending { it.createdAt }

    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        scope.launch {
            for (uri in uris) {
                runCatching { repository.importFile(uri) }.onFailure { errorMessage = it.message ?: "Import fehlgeschlagen." }
            }
        }
    }
    val import = { importer.launch(arrayOf("application/pdf", "image/*")) }
    val loadDemo: () -> Unit = {
        scope.launch {
            runCatching {
                repository.savePdf(withContext(Dispatchers.Default) { DemoPdf.make() }, DemoContent.MATERIAL_TITLE)
                if (!app.settings.hasAnyKey) app.settings.updateDemoMode(true)
            }.onFailure { errorMessage = it.message }
        }
    }

    if (materials.isEmpty()) {
        ContentColumn {
            Column(Modifier.widthIn(max = 440.dp).padding(top = 70.dp)) {
                PixelCaption("Bibliothek")
                QText("Noch kein Material", work(34f, FontWeight.Light, tracking = -0.85f), Quill.colors.ink, Modifier.padding(top = 16.dp))
                QText(
                    "Importiere Skripte, Arbeitsblätter oder Mitschriften als PDF oder Foto. Du kannst sie auch aus der Galerie oder einer Dateien-App an Schul-PIP teilen.",
                    work(15.5f, lineHeight = 23f),
                    Quill.colors.muted,
                    Modifier.padding(top = 14.dp, bottom = 30.dp),
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    PrimaryButton("PDF importieren", import, height = 48.dp, fontSize = 15.5f)
                    LinkButton("Demo-Material laden", loadDemo)
                }
                errorMessage?.let { Notice(it, modifier = Modifier.padding(top = 20.dp)) }
            }
        }
        return
    }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(150.dp),
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 40.dp, end = 40.dp, top = 44.dp, bottom = 60.dp),
        horizontalArrangement = Arrangement.spacedBy(28.dp),
        verticalArrangement = Arrangement.spacedBy(34.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column {
                PageHeader(if (materials.size == 1) "1 Dokument" else "${materials.size} Dokumente", "Bibliothek") {
                    PrimaryButton("PDF importieren", import)
                }
                errorMessage?.let { Notice(it, modifier = Modifier.padding(top = 16.dp)) }
            }
        }
        items(materials, key = { it.id }) { material ->
            DocumentTile(
                app = app,
                material = material,
                onOpen = { app.push(Route.Document(material.id, null, "Bibliothek")) },
                onDelete = { repository.deleteMaterial(material) },
            )
        }
    }
}

/** A document as in a files app: the first page as cover, title and details below. */
@Composable
private fun DocumentTile(app: AppState, material: StudyMaterial, onOpen: () -> Unit, onDelete: () -> Unit) {
    val colors = Quill.colors
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, tween(150), label = "tile")
    var menuOpen by remember { mutableStateOf(false) }
    val cover by produceState<Bitmap?>(null, material.id) {
        value = withContext(Dispatchers.IO) {
            PdfPages.open(app.repository.pdfFile(material))?.use { it.render(0, 400) }
        }
    }

    Column(
        Modifier
            .scale(scale)
            .combinedClickable(interaction, null, onLongClick = { menuOpen = true }, onClick = onOpen),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.fillMaxWidth().height(210.dp), contentAlignment = Alignment.BottomCenter) {
            val shape = RoundedCornerShape(5.dp)
            val image = cover
            if (image != null) {
                Image(
                    image.asImageBitmap(),
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .aspectRatio(image.width.toFloat() / image.height, matchHeightConstraintsFirst = image.height > image.width * 1.2f)
                        .shadow(8.dp, shape, ambientColor = colors.ink, spotColor = colors.ink)
                        .clip(shape)
                        .border(1.dp, colors.line, shape),
                )
            } else {
                Box(Modifier.fillMaxWidth().aspectRatio(0.707f).background(colors.surface, shape).border(1.dp, colors.line, shape))
            }
            DropdownMenu(menuOpen, onDismissRequest = { menuOpen = false }, containerColor = colors.surface) {
                DropdownMenuItem(
                    text = { QText("Löschen", work(15f), colors.warn) },
                    onClick = {
                        menuOpen = false
                        onDelete()
                    },
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            QText(material.title, work(14.5f, FontWeight.Medium, tracking = -0.15f), colors.ink, maxLines = 2)
            QText(detail(material), work(12.5f), colors.faint, maxLines = 1)
        }
    }
}

private val dayMonth = DateTimeFormatter.ofPattern("d. MMM", Locale.GERMAN)

private fun detail(material: StudyMaterial): String {
    val added = Instant.ofEpochMilli(material.createdAt).atZone(ZoneId.systemDefault()).format(dayMonth)
    return if (material.lastOpenedPage > 0) "$added · S. ${material.lastOpenedPage + 1}" else added
}
