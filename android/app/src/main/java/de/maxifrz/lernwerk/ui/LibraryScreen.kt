package de.maxifrz.lernwerk.ui

import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
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
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import de.maxifrz.lernwerk.data.DOCX_MIME
import de.maxifrz.lernwerk.data.Folder
import de.maxifrz.lernwerk.data.Library
import de.maxifrz.lernwerk.data.LibrarySort
import de.maxifrz.lernwerk.data.SearchHit
import de.maxifrz.lernwerk.data.StudyMaterial
import de.maxifrz.lernwerk.data.Subjects
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

/** A dialog the library shows over its grid. */
private sealed interface LibraryDialog {
    data class NewFolder(val parentId: String?) : LibraryDialog
    data class RenameMaterial(val material: StudyMaterial) : LibraryDialog
    data class RenameFolder(val folder: Folder) : LibraryDialog
    data class MoveMaterials(val ids: Set<String>) : LibraryDialog
    data class MoveFolder(val folder: Folder) : LibraryDialog
    data class SetSubject(val ids: Set<String>) : LibraryDialog
    data class DeleteFolder(val folder: Folder) : LibraryDialog
}

/**
 * The library: folders like a files app, search over titles and the text of every PDF, sorting, subjects with
 * colors, favorites, a row to continue reading, selecting several documents at once and a trash that empties
 * itself after 30 days.
 */
@Composable
fun LibraryScreen(app: AppState) {
    val repository = app.repository
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var folderId by rememberSaveable { mutableStateOf<String?>(null) }
    var query by rememberSaveable { mutableStateOf("") }
    var sortName by rememberSaveable { mutableStateOf(LibrarySort.RECENT.name) }
    val sort = LibrarySort.valueOf(sortName)
    var subjectFilter by rememberSaveable { mutableStateOf<String?>(null) }
    var favoritesOnly by rememberSaveable { mutableStateOf(false) }
    var showTrash by rememberSaveable { mutableStateOf(false) }
    var selecting by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf(setOf<String>()) }
    var dialog by remember { mutableStateOf<LibraryDialog?>(null) }
    var indexVersion by remember { mutableIntStateOf(0) }

    val library = repository.library
    val folders = repository.folders.toList()
    // A folder deleted elsewhere (or on another screen) sends the view back to the top level.
    if (folderId != null && folders.none { it.id == folderId }) folderId = null

    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        scope.launch {
            for (uri in uris) {
                runCatching { repository.importFile(uri, folderId) }.onFailure { errorMessage = it.message ?: "Import fehlgeschlagen." }
            }
        }
    }
    val import = { importer.launch(arrayOf("application/pdf", "image/*", DOCX_MIME)) }
    val loadDemo: () -> Unit = {
        scope.launch {
            runCatching {
                repository.savePdf(withContext(Dispatchers.Default) { DemoPdf.make() }, DemoContent.MATERIAL_TITLE)
                if (!app.settings.hasAnyKey) app.settings.updateDemoMode(true)
            }.onFailure { errorMessage = it.message }
        }
    }

    fun open(material: StudyMaterial, page: Int? = null) {
        app.push(Route.Document(material.id, page?.let { it - 1 }, "Bibliothek"))
    }

    fun toggle(id: String) {
        selected = if (id in selected) selected - id else selected + id
    }

    fun endSelection() {
        selecting = false
        selected = emptySet()
    }

    BackHandler(enabled = selecting || showTrash || query.isNotEmpty() || folderId != null) {
        when {
            selecting -> endSelection()
            showTrash -> showTrash = false
            query.isNotEmpty() -> query = ""
            else -> folderId = folders.firstOrNull { it.id == folderId }?.parentId
        }
    }

    // The text of every PDF is read once in the background when the student starts searching.
    val searching = query.isNotBlank()
    LaunchedEffect(searching, library.size) {
        if (searching) {
            withContext(Dispatchers.IO) { repository.indexTexts(library) }
            indexVersion++
        }
    }
    val hits by produceState(emptyList<SearchHit>(), query, indexVersion, library, folders) {
        value = if (!searching) {
            emptyList()
        } else {
            withContext(Dispatchers.Default) { Library.search(library, folders, query, repository::cachedPageTexts) }
        }
    }

    if (library.isEmpty() && folders.isEmpty() && !showTrash) {
        ContentColumn {
            Column(Modifier.widthIn(max = 440.dp).padding(top = 70.dp)) {
                PixelCaption("Bibliothek")
                QText("Noch kein Material", work(34f, FontWeight.Light, tracking = -0.85f), colors.ink, Modifier.padding(top = 16.dp))
                QText(
                    "Importiere Skripte, Arbeitsblätter oder Mitschriften als PDF oder Foto. Du kannst sie auch aus der Galerie oder einer Dateien-App an Schul-PIP teilen.",
                    work(15.5f, lineHeight = 23f),
                    colors.muted,
                    Modifier.padding(top = 14.dp, bottom = 30.dp),
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    PrimaryButton("PDF importieren", import, height = 48.dp, fontSize = 15.5f)
                    LinkButton("Demo-Material laden", loadDemo)
                }
                if (repository.trash.isNotEmpty()) {
                    Box(Modifier.padding(top = 24.dp)) { LinkButton("Papierkorb (${repository.trash.size})", { showTrash = true }, colors.muted, work(14f)) }
                }
                errorMessage?.let { Notice(it, modifier = Modifier.padding(top = 20.dp)) }
            }
        }
        return
    }

    if (showTrash) {
        TrashView(app, onClose = { showTrash = false })
        return
    }

    val path = Library.path(folders, folderId)
    val filtered = subjectFilter != null || favoritesOnly
    fun matchesFilter(material: StudyMaterial) =
        (subjectFilter == null || material.subject == subjectFilter) && (!favoritesOnly || material.isFavorite)

    val shownFolders = if (searching || filtered) emptyList() else folders.filter { it.parentId == folderId }.sortedBy { it.name.lowercase() }
    val shownMaterials = when {
        searching -> emptyList()
        filtered -> Library.sort(library.filter(::matchesFilter), sort)
        else -> Library.sort(library.filter { it.folderId == folderId }, sort)
    }
    val recent = if (folderId == null && !searching && !filtered) {
        library.filter { it.lastOpenedAt != null }.sortedByDescending { it.lastOpenedAt }.take(3)
    } else {
        emptyList()
    }

    Box(Modifier.fillMaxSize()) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(150.dp),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 40.dp, end = 40.dp, top = 44.dp, bottom = if (selecting) 120.dp else 60.dp),
            horizontalArrangement = Arrangement.spacedBy(28.dp),
            verticalArrangement = Arrangement.spacedBy(30.dp),
        ) {
            fullWidth {
                Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    val count = library.size
                    val caption = if (path.isEmpty()) {
                        if (count == 1) "1 Dokument" else "$count Dokumente"
                    } else {
                        (listOf("Bibliothek") + path.dropLast(1).map { it.name }).joinToString("  ›  ")
                    }
                    PageHeader(caption, path.lastOrNull()?.name ?: "Bibliothek") {
                        if (selecting) {
                            OutlineButton("Fertig", ::endSelection, height = 44.dp, fontSize = 15f, weight = FontWeight.Medium)
                        } else {
                            if (path.isNotEmpty()) {
                                OutlineButton("Zurück", { folderId = path.last().parentId }, height = 44.dp, fontSize = 15f, weight = FontWeight.Medium)
                            }
                            OutlineButton("Auswählen", { selecting = true }, height = 44.dp, fontSize = 15f, weight = FontWeight.Medium)
                            OutlineButton("Neuer Ordner", { dialog = LibraryDialog.NewFolder(folderId) }, height = 44.dp, fontSize = 15f, weight = FontWeight.Medium)
                            PrimaryButton("Importieren", import)
                        }
                    }
                    Toolbar(
                        query = query,
                        onQuery = { query = it },
                        sort = sort,
                        onSort = { sortName = it.name },
                        subjects = Subjects.all.map { it.name }.filter { name -> library.any { it.subject == name } },
                        subjectFilter = subjectFilter,
                        onSubject = { subjectFilter = if (subjectFilter == it) null else it },
                        favoritesOnly = favoritesOnly,
                        onFavorites = { favoritesOnly = !favoritesOnly },
                    )
                    errorMessage?.let { Notice(it) }
                }
            }

            if (recent.isNotEmpty()) {
                fullWidth {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        PixelCaption("Weiterlesen", size = 9f)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            recent.forEach { material -> ContinueChip(material) { open(material, material.lastOpenedPage + 1) } }
                        }
                    }
                }
            }

            if (searching) {
                fullWidth {
                    PixelCaption(
                        when (hits.size) {
                            0 -> if (indexVersion == 0) "Durchsuche Texte …" else "Keine Treffer"
                            1 -> "1 Treffer"
                            else -> "${hits.size} Treffer"
                        },
                        size = 9f,
                    )
                }
                items(hits, key = { "hit-" + it.material.id }) { hit ->
                    DocumentTile(
                        app, hit.material, selecting, hit.material.id in selected,
                        snippet = hit.snippet?.let { "S. ${hit.page}: $it" },
                        onOpen = { if (selecting) toggle(hit.material.id) else open(hit.material, hit.page) },
                        onDialog = { dialog = it },
                    )
                }
            }

            if (shownFolders.isNotEmpty()) {
                fullWidth { PixelCaption("Ordner", size = 9f) }
                items(shownFolders, key = { "folder-" + it.id }) { folder ->
                    val inside = Library.descendants(folders, folder.id)
                    FolderTile(
                        folder = folder,
                        count = library.count { it.folderId in inside },
                        onOpen = { if (!selecting) folderId = folder.id },
                        onDialog = { dialog = it },
                    )
                }
            }

            if (shownMaterials.isNotEmpty() && (shownFolders.isNotEmpty() || recent.isNotEmpty())) {
                fullWidth { PixelCaption(if (filtered) "Gefiltert" else "Dokumente", size = 9f) }
            }
            items(shownMaterials, key = { it.id }) { material ->
                DocumentTile(
                    app, material, selecting, material.id in selected,
                    onOpen = { if (selecting) toggle(material.id) else open(material) },
                    onDialog = { dialog = it },
                )
            }

            if (!searching && shownFolders.isEmpty() && shownMaterials.isEmpty()) {
                fullWidth {
                    QText(
                        if (filtered) "Keine Dokumente mit diesem Filter." else "Dieser Ordner ist leer. Importiere hierher oder verschiebe Dokumente über das Menü – Dokument lange drücken.",
                        work(15f, lineHeight = 22f),
                        colors.faint,
                    )
                }
            }

            if (folderId == null && !searching && repository.trash.isNotEmpty()) {
                fullWidth {
                    Box { LinkButton("Papierkorb (${repository.trash.size})", { showTrash = true }, colors.muted, work(14f)) }
                }
            }
        }

        if (selecting) {
            SelectionBar(
                count = selected.size,
                allFavorite = selected.isNotEmpty() && library.filter { it.id in selected }.all { it.isFavorite },
                onMove = { if (selected.isNotEmpty()) dialog = LibraryDialog.MoveMaterials(selected) },
                onSubject = { if (selected.isNotEmpty()) dialog = LibraryDialog.SetSubject(selected) },
                onFavorite = { favorite -> repository.setFavorite(selected, favorite) },
                onTrash = {
                    repository.moveToTrash(selected)
                    endSelection()
                },
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }

    when (val current = dialog) {
        null -> Unit
        is LibraryDialog.NewFolder -> NameDialog("Neuer Ordner", "", "Anlegen", onDismiss = { dialog = null }) {
            repository.createFolder(it, current.parentId)
            dialog = null
        }
        is LibraryDialog.RenameMaterial -> NameDialog("Umbenennen", current.material.title, "Speichern", onDismiss = { dialog = null }) {
            repository.rename(current.material, it)
            dialog = null
        }
        is LibraryDialog.RenameFolder -> NameDialog("Ordner umbenennen", current.folder.name, "Speichern", onDismiss = { dialog = null }) {
            repository.renameFolder(current.folder, it)
            dialog = null
        }
        is LibraryDialog.MoveMaterials -> MoveDialog(folders, null, onDismiss = { dialog = null }) { target ->
            repository.move(current.ids, target)
            dialog = null
            endSelection()
        }
        is LibraryDialog.MoveFolder -> MoveDialog(Library.moveTargets(folders, current.folder.id), current.folder, onDismiss = { dialog = null }) { target ->
            repository.moveFolder(current.folder, target)
            dialog = null
        }
        is LibraryDialog.SetSubject -> SubjectDialog(onDismiss = { dialog = null }) { subject ->
            repository.setSubject(current.ids, subject)
            dialog = null
            endSelection()
        }
        is LibraryDialog.DeleteFolder -> ConfirmDialog(
            "Ordner löschen?",
            "„${current.folder.name}“ und alle Unterordner werden gelöscht. Die Dokumente darin kommen in den Papierkorb und lassen sich 30 Tage lang wiederherstellen.",
            "Löschen",
            onDismiss = { dialog = null },
        ) {
            repository.deleteFolder(current.folder)
            dialog = null
        }
    }
}

private fun LazyGridScope.fullWidth(content: @Composable () -> Unit) {
    item(span = { GridItemSpan(maxLineSpan) }) { content() }
}

@Composable
private fun Toolbar(
    query: String,
    onQuery: (String) -> Unit,
    sort: LibrarySort,
    onSort: (LibrarySort) -> Unit,
    subjects: List<String>,
    subjectFilter: String?,
    onSubject: (String) -> Unit,
    favoritesOnly: Boolean,
    onFavorites: () -> Unit,
) {
    val colors = Quill.colors
    var sortOpen by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                Modifier
                    .weight(1f)
                    .height(44.dp)
                    .background(colors.surface, CircleShape)
                    .border(1.dp, colors.line2, CircleShape)
                    .padding(start = 18.dp, end = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.weight(1f)) {
                    if (query.isEmpty()) QText("Suchen in Titeln und Texten …", work(15f), colors.hint)
                    BasicTextField(
                        query,
                        onQuery,
                        singleLine = true,
                        textStyle = work(15f).copy(color = colors.ink),
                        cursorBrush = SolidColor(colors.accent),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (query.isNotEmpty()) LinkButton("Löschen", { onQuery("") }, colors.muted, work(13.5f))
            }
            Box {
                OutlineButton("${sort.label} ▾", { sortOpen = true }, height = 44.dp, fontSize = 14.5f, weight = FontWeight.Medium)
                DropdownMenu(sortOpen, onDismissRequest = { sortOpen = false }, containerColor = colors.surface) {
                    LibrarySort.entries.forEach { option ->
                        DropdownMenuItem(
                            text = { QText(option.label + if (option == sort) "  ✓" else "", work(15f), colors.ink) },
                            onClick = {
                                sortOpen = false
                                onSort(option)
                            },
                        )
                    }
                }
            }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip("★ Favoriten", favoritesOnly, null, onFavorites)
            subjects.forEach { subject -> FilterChip(subject, subject == subjectFilter, Subjects.color(subject)) { onSubject(subject) } }
        }
    }
}

@Composable
private fun FilterChip(label: String, selected: Boolean, color: Long?, onClick: () -> Unit) {
    val colors = Quill.colors
    Row(
        Modifier
            .height(32.dp)
            .background(if (selected) colors.ink else Color.Transparent, CircleShape)
            .border(1.dp, if (selected) Color.Transparent else colors.line2, CircleShape)
            .pressable(CircleShape, onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        color?.let { StatusDot(hex(it), 8.dp) }
        QText(label, work(13f, FontWeight.Medium), if (selected) colors.bg else colors.ink)
    }
}

@Composable
private fun ContinueChip(material: StudyMaterial, onClick: () -> Unit) {
    val colors = Quill.colors
    Row(
        Modifier
            .widthIn(max = 320.dp)
            .background(colors.surface, RoundedCornerShape(14.dp))
            .border(1.dp, colors.line2, RoundedCornerShape(14.dp))
            .pressable(RoundedCornerShape(14.dp), onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        StatusDot(Subjects.color(material.subject)?.let(::hex) ?: colors.accent, 8.dp)
        Column {
            QText(material.title, work(14f, FontWeight.Medium), colors.ink, maxLines = 1)
            QText("Weiter bei S. ${material.lastOpenedPage + 1}", work(12f), colors.faint, maxLines = 1)
        }
    }
}

@Composable
private fun FolderTile(folder: Folder, count: Int, onOpen: () -> Unit, onDialog: (LibraryDialog) -> Unit) {
    val colors = Quill.colors
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, tween(150), label = "folder")
    var menuOpen by remember { mutableStateOf(false) }
    Column(
        Modifier.scale(scale).combinedClickable(interaction, null, onLongClick = { menuOpen = true }, onClick = onOpen),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.BottomStart) {
            // A folder drawn from two shapes: the tab and the body.
            Box(Modifier.padding(bottom = 88.dp).width(64.dp).height(20.dp).background(colors.line2, RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)))
            Box(Modifier.fillMaxWidth().height(96.dp).background(colors.surface, RoundedCornerShape(10.dp)).border(1.dp, colors.line2, RoundedCornerShape(10.dp)))
            DropdownMenu(menuOpen, onDismissRequest = { menuOpen = false }, containerColor = colors.surface) {
                LibraryMenuItem("Umbenennen") { menuOpen = false; onDialog(LibraryDialog.RenameFolder(folder)) }
                LibraryMenuItem("Verschieben …") { menuOpen = false; onDialog(LibraryDialog.MoveFolder(folder)) }
                LibraryMenuItem("Löschen", colors.warn) { menuOpen = false; onDialog(LibraryDialog.DeleteFolder(folder)) }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            QText(folder.name, work(14.5f, FontWeight.Medium, tracking = -0.15f), colors.ink, maxLines = 2)
            QText(if (count == 1) "1 Dokument" else "$count Dokumente", work(12.5f), colors.faint, maxLines = 1)
        }
    }
}

@Composable
private fun LibraryMenuItem(label: String, color: Color = Quill.colors.ink, onClick: () -> Unit) {
    DropdownMenuItem(text = { QText(label, work(15f), color) }, onClick = onClick)
}

/** A document as in a files app: the first page as cover, title and details below. */
@Composable
private fun DocumentTile(
    app: AppState,
    material: StudyMaterial,
    selecting: Boolean,
    isSelected: Boolean,
    snippet: String? = null,
    onOpen: () -> Unit,
    onDialog: (LibraryDialog) -> Unit,
) {
    val colors = Quill.colors
    val repository = app.repository
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, tween(150), label = "tile")
    var menuOpen by remember { mutableStateOf(false) }
    val cover by produceState<Bitmap?>(null, material.id) {
        value = withContext(Dispatchers.IO) {
            PdfPages.open(repository.pdfFile(material))?.use { it.render(0, 400) }
        }
    }

    Column(
        Modifier
            .scale(scale)
            .combinedClickable(interaction, null, onLongClick = { if (!selecting) menuOpen = true }, onClick = onOpen),
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
                        .border(if (isSelected) 3.dp else 1.dp, if (isSelected) colors.accent else colors.line, shape),
                )
            } else {
                Box(
                    Modifier.fillMaxWidth().aspectRatio(0.707f).background(colors.surface, shape)
                        .border(if (isSelected) 3.dp else 1.dp, if (isSelected) colors.accent else colors.line, shape),
                )
            }
            if (material.isFavorite) {
                QText("★", work(18f), hex(0xE0A93B), Modifier.align(Alignment.TopEnd).padding(6.dp))
            }
            if (selecting) {
                Box(Modifier.align(Alignment.TopStart).padding(8.dp).background(colors.bg, CircleShape)) { CheckCircle(isSelected, 24.dp) }
            }
            DropdownMenu(menuOpen, onDismissRequest = { menuOpen = false }, containerColor = colors.surface) {
                LibraryMenuItem("Umbenennen") { menuOpen = false; onDialog(LibraryDialog.RenameMaterial(material)) }
                LibraryMenuItem("Verschieben …") { menuOpen = false; onDialog(LibraryDialog.MoveMaterials(setOf(material.id))) }
                LibraryMenuItem("Fach …") { menuOpen = false; onDialog(LibraryDialog.SetSubject(setOf(material.id))) }
                LibraryMenuItem(if (material.isFavorite) "Aus Favoriten entfernen" else "Zu Favoriten") {
                    menuOpen = false
                    repository.setFavorite(listOf(material.id), !material.isFavorite)
                }
                LibraryMenuItem("In den Papierkorb", colors.warn) {
                    menuOpen = false
                    repository.moveToTrash(listOf(material.id))
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            QText(material.title, work(14.5f, FontWeight.Medium, tracking = -0.15f), colors.ink, maxLines = 2)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Subjects.color(material.subject)?.let { StatusDot(hex(it), 7.dp) }
                QText(detail(material), work(12.5f), colors.faint, maxLines = 1)
            }
            snippet?.let { QText(it, work(12.5f, lineHeight = 17f), colors.muted, maxLines = 3) }
        }
    }
}

@Composable
private fun SelectionBar(
    count: Int,
    allFavorite: Boolean,
    onMove: () -> Unit,
    onSubject: () -> Unit,
    onFavorite: (Boolean) -> Unit,
    onTrash: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Quill.colors
    Row(
        modifier
            .padding(bottom = 24.dp)
            .shadow(16.dp, CircleShape)
            .background(colors.surface, CircleShape)
            .border(1.dp, colors.line2, CircleShape)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        QText(if (count == 1) "1 ausgewählt" else "$count ausgewählt", work(14.5f, FontWeight.Medium), colors.ink, Modifier.padding(end = 6.dp))
        val enabled = count > 0
        OutlineButton("Verschieben", onMove, enabled = enabled)
        OutlineButton("Fach", onSubject, enabled = enabled)
        OutlineButton(if (allFavorite) "Kein Favorit" else "Favorit", { onFavorite(!allFavorite) }, enabled = enabled)
        OutlineButton("Papierkorb", onTrash, enabled = enabled)
    }
}

@Composable
private fun TrashView(app: AppState, onClose: () -> Unit) {
    val repository = app.repository
    val colors = Quill.colors
    val now = System.currentTimeMillis()
    var confirmEmpty by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
    ContentColumn(maxWidth = 820.dp) {
        PageHeader("Bibliothek", "Papierkorb") {
            OutlineButton("Zurück", onClose, height = 44.dp, fontSize = 15f, weight = FontWeight.Medium)
            if (repository.trash.isNotEmpty()) PrimaryButton("Leeren", { confirmEmpty = true })
        }
        QText(
            "Gelöschte Dokumente bleiben ${Library.TRASH_DAYS} Tage hier und werden dann endgültig entfernt, mit ihren Notizen und Markierungen.",
            work(14.5f, lineHeight = 21f),
            colors.muted,
            Modifier.padding(top = 18.dp, bottom = 12.dp),
        )
        if (repository.trash.isEmpty()) QText("Der Papierkorb ist leer.", work(15f), colors.faint, Modifier.padding(vertical = 14.dp))
        repository.trash.forEach { material ->
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f)) {
                    QText(material.title, work(15.5f), colors.ink, maxLines = 1)
                    val days = Library.daysLeft(material, now)
                    QText(if (days == 1) "Noch 1 Tag" else "Noch $days Tage", work(12.5f), colors.faint)
                }
                OutlineButton("Wiederherstellen", { repository.restore(material) })
                OutlineButton("Endgültig löschen", { repository.deleteMaterial(material) })
            }
            QuillDivider()
        }
    }
    }
    if (confirmEmpty) {
        ConfirmDialog(
            "Papierkorb leeren?",
            "${repository.trash.size} Dokumente werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.",
            "Leeren",
            onDismiss = { confirmEmpty = false },
        ) {
            repository.emptyTrash()
            confirmEmpty = false
        }
    }
}

@Composable
private fun DialogCard(caption: String, content: @Composable () -> Unit) {
    val colors = Quill.colors
    Column(Modifier.widthIn(max = 480.dp).background(colors.bg, RoundedCornerShape(24.dp)).padding(24.dp)) {
        PixelCaption(caption, Modifier.padding(bottom = 12.dp))
        content()
    }
}

@Composable
private fun NameDialog(caption: String, initial: String, confirm: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    val colors = Quill.colors
    var value by remember { mutableStateOf(initial) }
    Dialog(onDismissRequest = onDismiss) {
        DialogCard(caption) {
            Box(
                Modifier.fillMaxWidth().background(colors.surface, RoundedCornerShape(14.dp)).border(1.dp, colors.line2, RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                if (value.isEmpty()) QText("Name", work(16f), colors.hint)
                BasicTextField(value, { value = it }, singleLine = true, textStyle = work(16f).copy(color = colors.ink), cursorBrush = SolidColor(colors.accent), modifier = Modifier.fillMaxWidth())
            }
            Row(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                LinkButton("Abbrechen", onDismiss, colors.muted, work(15f))
                PrimaryButton(confirm, { onSave(value) }, height = 38.dp, fontSize = 14.5f, enabled = value.isNotBlank())
            }
        }
    }
}

/** Picks a target folder, shown as an indented tree; null is the top level. */
@Composable
private fun MoveDialog(folders: List<Folder>, moving: Folder?, onDismiss: () -> Unit, onMove: (String?) -> Unit) {
    val colors = Quill.colors
    val tree = remember(folders) { flatten(folders) }
    Dialog(onDismissRequest = onDismiss) {
        DialogCard(if (moving != null) "„${moving.name}“ verschieben nach" else "Verschieben nach") {
            Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                QText("Bibliothek (oberste Ebene)", work(15.5f, FontWeight.Medium), colors.ink, Modifier.fillMaxWidth().pressable { onMove(null) }.padding(vertical = 13.dp, horizontal = 2.dp))
                QuillDivider()
                tree.forEach { (folder, depth) ->
                    Row(Modifier.fillMaxWidth().pressable { onMove(folder.id) }.padding(start = (2 + depth * 20).dp, top = 13.dp, bottom = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(width = 16.dp, height = 12.dp).background(colors.line2, RoundedCornerShape(3.dp)))
                        QText(folder.name, work(15.5f), colors.ink, Modifier.padding(start = 10.dp))
                    }
                    QuillDivider()
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.End) {
                LinkButton("Abbrechen", onDismiss, colors.muted, work(15f))
            }
        }
    }
}

private fun flatten(folders: List<Folder>, parentId: String? = null, depth: Int = 0): List<Pair<Folder, Int>> =
    folders.filter { it.parentId == parentId }
        .sortedBy { it.name.lowercase() }
        .flatMap { listOf(it to depth) + flatten(folders, it.id, depth + 1) }

@Composable
private fun SubjectDialog(onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val colors = Quill.colors
    Dialog(onDismissRequest = onDismiss) {
        DialogCard("Fach") {
            Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState())) {
                (Subjects.all.map { it.name } + "").forEach { name ->
                    Row(Modifier.fillMaxWidth().pressable { onPick(name) }.padding(vertical = 11.dp, horizontal = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                        StatusDot(Subjects.color(name)?.let(::hex) ?: colors.line2, 10.dp)
                        QText(name.ifEmpty { "Kein Fach" }, work(15.5f), colors.ink, Modifier.padding(start = 12.dp))
                    }
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.End) {
                LinkButton("Abbrechen", onDismiss, colors.muted, work(15f))
            }
        }
    }
}

@Composable
private fun ConfirmDialog(caption: String, text: String, confirm: String, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    val colors = Quill.colors
    Dialog(onDismissRequest = onDismiss) {
        DialogCard(caption) {
            QText(text, work(15f, lineHeight = 22f), colors.ink2)
            Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                LinkButton("Abbrechen", onDismiss, colors.muted, work(15f))
                PrimaryButton(confirm, onConfirm, height = 38.dp, fontSize = 14.5f)
            }
        }
    }
}

private val dayMonth = DateTimeFormatter.ofPattern("d. MMM", Locale.GERMAN)

private fun detail(material: StudyMaterial): String {
    val added = Instant.ofEpochMilli(material.createdAt).atZone(ZoneId.systemDefault()).format(dayMonth)
    val parts = listOfNotNull(material.subject.ifEmpty { null }, added, if (material.lastOpenedPage > 0) "S. ${material.lastOpenedPage + 1}" else null)
    return parts.joinToString(" · ")
}
