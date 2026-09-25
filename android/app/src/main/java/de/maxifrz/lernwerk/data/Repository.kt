package de.maxifrz.lernwerk.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.runtime.mutableStateListOf
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import de.maxifrz.lernwerk.pdf.DocxRenderer
import de.maxifrz.lernwerk.present.DocxReader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlin.math.roundToInt
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException

const val DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/**
 * All app data in one JSON file plus the PDFs and their ink next to it. For a single student's library this is
 * simpler than a database and survives schema changes through lenient decoding.
 */
class Repository(context: Context) {
    private val root = context.filesDir
    private val dataFile = File(root, "lernwerk.json")
    val materialsDir = File(root, "materials").apply { mkdirs() }

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val writeLock = Mutex()
    private val resolver = context.contentResolver

    /** Page texts of the materials, read once for the search. */
    private val texts = java.util.concurrent.ConcurrentHashMap<String, List<String>>()

    /** Every material, including those in the trash; screens use [library] and [trash]. */
    val materials = mutableStateListOf<StudyMaterial>()
    val folders = mutableStateListOf<Folder>()
    val plans = mutableStateListOf<StudyPlan>()
    val cards = mutableStateListOf<ReviewCard>()

    init {
        val data = runCatching { json.decodeFromString(AppData.serializer(), dataFile.readText()) }.getOrNull() ?: AppData()
        val now = System.currentTimeMillis()
        val (expired, kept) = data.materials.partition { Library.isExpired(it, now) }
        materials += kept
        folders += data.folders
        plans += data.plans
        cards += data.cards
        expired.forEach(::deleteFiles)
        if (expired.isNotEmpty()) save()
    }

    /** Materials outside the trash. */
    val library: List<StudyMaterial> get() = materials.filter { !it.isTrashed }

    val trash: List<StudyMaterial> get() = materials.filter { it.isTrashed }.sortedByDescending { it.deletedAt }

    fun pdfFile(material: StudyMaterial) = File(materialsDir, "${material.id}.pdf")

    private fun inkFile(materialId: String) = File(materialsDir, "$materialId.ink.json")

    // Materials

    /** PDFs are copied as they are; images (photos of worksheets, screenshots) become a one-page PDF. */
    suspend fun importFile(uri: Uri, folderId: String? = null): StudyMaterial = withContext(Dispatchers.IO) {
        val name = displayName(uri)
        val title = name?.substringBeforeLast('.')?.ifBlank { null } ?: "Dokument"
        val type = resolver.getType(uri) ?: ""
        val extension = name?.substringAfterLast('.', "")?.lowercase()
        val isImage = type.startsWith("image/") || extension in setOf("jpg", "jpeg", "png", "heic", "heif", "webp")
        val isDocx = type == DOCX_MIME || extension == "docx"
        if (isDocx) {
            val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: throw IOException("Die Datei lässt sich nicht öffnen.")
            val pdf = runCatching { DocxRenderer.pdfData(DocxReader.open(bytes)) }
                .getOrElse { throw IOException("Das Word-Dokument lässt sich nicht lesen.") }
            return@withContext savePdf(pdf, title, folderId)
        }
        if (isImage) {
            val bitmap = runCatching {
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(resolver, uri)) { decoder, info, _ ->
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                    // Plenty for reading and OCR, and keeps a 50-megapixel photo from filling the memory.
                    val longest = maxOf(info.size.width, info.size.height)
                    if (longest > 3000) decoder.setTargetSampleSize((longest + 2999) / 3000)
                }
            }.getOrElse { throw IOException("Das Bild lässt sich nicht öffnen.") }
            return@withContext savePdf(imagePdf(bitmap), title, folderId)
        }
        val material = StudyMaterial(title = title, folderId = folderId)
        val input = resolver.openInputStream(uri) ?: throw IOException("Die Datei lässt sich nicht öffnen.")
        input.use { source -> pdfFile(material).outputStream().use { source.copyTo(it) } }
        withContext(Dispatchers.Main) { materials += material }
        save()
        material
    }

    /** One page as wide as A4, as tall as the image needs; the image keeps its full resolution inside. */
    private fun imagePdf(bitmap: Bitmap): ByteArray {
        val width = 595
        val height = maxOf(1, (width.toFloat() * bitmap.height / bitmap.width).roundToInt())
        val document = PdfDocument()
        val page = document.startPage(PdfDocument.PageInfo.Builder(width, height, 1).create())
        page.canvas.drawBitmap(bitmap, null, Rect(0, 0, width, height), Paint(Paint.FILTER_BITMAP_FLAG))
        document.finishPage(page)
        return ByteArrayOutputStream().also { document.writeTo(it); document.close() }.toByteArray()
    }

    suspend fun savePdf(data: ByteArray, title: String, folderId: String? = null): StudyMaterial = withContext(Dispatchers.IO) {
        val material = StudyMaterial(title = title, folderId = folderId)
        pdfFile(material).writeBytes(data)
        withContext(Dispatchers.Main) { materials += material }
        save()
        material
    }

    // Inserting pages into an existing document

    /** Inserts every page of [source] after 0-based [afterIndex], moving the ink of later pages along. */
    suspend fun insertPdfPages(material: StudyMaterial, source: ByteArray, afterIndex: Int): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            PDDocument.load(pdfFile(material)).use { target ->
                PDDocument.load(source).use { insertPages(target, material, it, afterIndex) }
            }
        }.getOrDefault(false)
    }

    /** Inserts a picture as a new page after 0-based [afterIndex], fit to the size of the document's other pages. */
    suspend fun insertImagePage(material: StudyMaterial, bitmap: Bitmap, afterIndex: Int): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            PDDocument.load(pdfFile(material)).use { target ->
                val size = target.getPage(afterIndex.coerceIn(0, target.numberOfPages - 1)).mediaBox
                PDDocument().use { source ->
                    val page = PDPage(PDRectangle(size.width, size.height))
                    source.addPage(page)
                    val scale = minOf(size.width / bitmap.width, size.height / bitmap.height)
                    val width = bitmap.width * scale
                    val height = bitmap.height * scale
                    PDPageContentStream(source, page).use { stream ->
                        stream.drawImage(JPEGFactory.createFromImage(source, bitmap), (size.width - width) / 2, (size.height - height) / 2, width, height)
                    }
                    insertPages(target, material, source, afterIndex)
                }
            }
        }.getOrDefault(false)
    }

    /** Splices every page of [source] into [target], [material]'s own open document, right after 0-based
     * [afterIndex]; saves the file and moves the ink of later pages along. */
    private fun insertPages(target: PDDocument, material: StudyMaterial, source: PDDocument, afterIndex: Int): Boolean {
        val count = source.numberOfPages
        if (count == 0) return false
        val position = (afterIndex + 1).coerceIn(0, target.numberOfPages)
        val anchor = if (position < target.numberOfPages) target.getPage(position) else null
        for (i in 0 until count) {
            val imported = target.importPage(source.getPage(i))
            if (anchor != null) {
                target.pages.remove(imported)
                target.pages.insertBefore(imported, anchor)
            }
        }
        target.save(pdfFile(material))
        val ink = runCatching { json.decodeFromString(inkSerializer, inkFile(material.id).readText()) }.getOrDefault(emptyMap())
        saveInk(material.id, shiftedInk(ink, at = position, count = count))
        texts.remove(material.id)
        textFile(material.id).delete()
        return true
    }

    /** Pages from [at] on move [count] forward: that many pages were inserted at [at]. */
    private fun shiftedInk(ink: Map<Int, List<InkStroke>>, at: Int, count: Int): Map<Int, List<InkStroke>> =
        ink.mapKeys { (page, _) -> if (page >= at) page + count else page }

    /** Deletes for good, with the PDF and its ink; the trash uses this. */
    fun deleteMaterial(material: StudyMaterial) {
        materials.removeAll { it.id == material.id }
        deleteFiles(material)
        save()
    }

    private fun deleteFiles(material: StudyMaterial) {
        texts.remove(material.id)
        scope.launch {
            pdfFile(material).delete()
            inkFile(material.id).delete()
            textFile(material.id).delete()
        }
    }

    private fun updateMaterials(ids: Collection<String>, change: (StudyMaterial) -> StudyMaterial) {
        var changed = false
        for (index in materials.indices) {
            if (materials[index].id in ids) {
                materials[index] = change(materials[index])
                changed = true
            }
        }
        if (changed) save()
    }

    fun moveToTrash(ids: Collection<String>) {
        val now = System.currentTimeMillis()
        updateMaterials(ids) { it.copy(deletedAt = now) }
    }

    /** Back where it was, or to the top level if its folder is gone. */
    fun restore(material: StudyMaterial) {
        val folderExists = folders.any { it.id == material.folderId }
        updateMaterials(listOf(material.id)) { it.copy(deletedAt = null, folderId = if (folderExists) it.folderId else null) }
    }

    fun emptyTrash() {
        trash.forEach(::deleteFiles)
        materials.removeAll { it.isTrashed }
        save()
    }

    fun rename(material: StudyMaterial, title: String) {
        val trimmed = title.trim().ifEmpty { return }
        updateMaterials(listOf(material.id)) { it.copy(title = trimmed) }
    }

    fun move(ids: Collection<String>, folderId: String?) = updateMaterials(ids) { it.copy(folderId = folderId) }

    fun setSubject(ids: Collection<String>, subject: String) = updateMaterials(ids) { it.copy(subject = subject) }

    fun setFavorite(ids: Collection<String>, favorite: Boolean) = updateMaterials(ids) { it.copy(isFavorite = favorite) }

    fun markOpened(materialId: String) = updateMaterials(listOf(materialId)) { it.copy(lastOpenedAt = System.currentTimeMillis()) }

    // Folders

    fun createFolder(name: String, parentId: String?): Folder? {
        val trimmed = name.trim().ifEmpty { return null }
        val folder = Folder(name = trimmed, parentId = parentId)
        folders += folder
        save()
        return folder
    }

    fun renameFolder(folder: Folder, name: String) {
        val trimmed = name.trim().ifEmpty { return }
        val index = folders.indexOfFirst { it.id == folder.id }
        if (index < 0) return
        folders[index] = folders[index].copy(name = trimmed)
        save()
    }

    fun moveFolder(folder: Folder, parentId: String?) {
        if (parentId != null && parentId in Library.descendants(folders, folder.id)) return
        val index = folders.indexOfFirst { it.id == folder.id }
        if (index < 0) return
        folders[index] = folders[index].copy(parentId = parentId)
        save()
    }

    /** Removes the folder and its subfolders; the materials inside go to the trash and come back to the top level. */
    fun deleteFolder(folder: Folder) {
        val removed = Library.descendants(folders, folder.id)
        val now = System.currentTimeMillis()
        for (index in materials.indices) {
            val material = materials[index]
            if (material.folderId in removed) {
                materials[index] = material.copy(folderId = null, deletedAt = material.deletedAt ?: now)
            }
        }
        folders.removeAll { it.id in removed }
        save()
    }

    // Text for the search

    private fun textFile(materialId: String) = File(materialsDir, "$materialId.text.json")

    private val textSerializer = ListSerializer(String.serializer())

    /** Page texts already read, for searching without waiting. */
    fun cachedPageTexts(material: StudyMaterial): List<String>? = texts[material.id]

    /** Reads the text of every material not read yet, from the disk cache or the PDF; call off the main thread. */
    fun indexTexts(materials: List<StudyMaterial>) {
        for (material in materials) {
            if (texts.containsKey(material.id)) continue
            val cached = runCatching { json.decodeFromString(textSerializer, textFile(material.id).readText()) }.getOrNull()
            val pages = cached ?: de.maxifrz.lernwerk.pdf.PdfText.pageTexts(pdfFile(material))?.also { pages ->
                runCatching { writeAtomically(textFile(material.id), json.encodeToString(textSerializer, pages)) }
            } ?: emptyList()
            texts[material.id] = pages
        }
    }

    fun setLastOpenedPage(materialId: String, page: Int) {
        val index = materials.indexOfFirst { it.id == materialId }
        if (index < 0 || materials[index].lastOpenedPage == page) return
        materials[index] = materials[index].copy(lastOpenedPage = page)
        save()
    }

    fun material(id: String?) = materials.firstOrNull { it.id == id }

    // Ink

    private val inkSerializer = MapSerializer(Int.serializer(), ListSerializer(InkStroke.serializer()))

    suspend fun loadInk(materialId: String): Map<Int, List<InkStroke>> = withContext(Dispatchers.IO) {
        runCatching { json.decodeFromString(inkSerializer, inkFile(materialId).readText()) }.getOrDefault(emptyMap())
    }

    fun saveInk(materialId: String, ink: Map<Int, List<InkStroke>>) {
        val snapshot = ink.filterValues { it.isNotEmpty() }
        scope.launch {
            writeLock.withLock { writeAtomically(inkFile(materialId), json.encodeToString(inkSerializer, snapshot)) }
        }
    }

    // Plans

    fun addPlan(plan: StudyPlan) {
        plans.add(0, plan)
        save()
    }

    fun updatePlan(plan: StudyPlan) {
        val index = plans.indexOfFirst { it.id == plan.id }
        if (index < 0) return
        plans[index] = plan
        save()
    }

    fun deletePlan(plan: StudyPlan) {
        plans.removeAll { it.id == plan.id }
        save()
    }

    fun plan(id: String) = plans.firstOrNull { it.id == id }

    // Cards

    fun addCard(card: ReviewCard) {
        cards += card
        save()
    }

    fun updateCard(card: ReviewCard) {
        val index = cards.indexOfFirst { it.id == card.id }
        if (index < 0) return
        cards[index] = card
        save()
    }

    // Persistence

    /** Snapshots on the calling (main) thread, writes in the background. */
    fun save() {
        val data = AppData(materials.toList(), folders.toList(), plans.toList(), cards.toList())
        scope.launch {
            writeLock.withLock { writeAtomically(dataFile, json.encodeToString(AppData.serializer(), data)) }
        }
    }

    private fun writeAtomically(file: File, text: String) {
        val temp = File(file.parentFile, file.name + ".tmp")
        temp.writeText(text)
        if (!temp.renameTo(file)) {
            file.writeText(text)
            temp.delete()
        }
    }

    private fun displayName(uri: Uri): String? = runCatching {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }.getOrNull() ?: uri.lastPathSegment?.substringAfterLast('/')
}
