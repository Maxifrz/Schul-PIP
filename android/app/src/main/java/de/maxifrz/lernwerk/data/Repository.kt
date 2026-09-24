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

    val materials = mutableStateListOf<StudyMaterial>()
    val plans = mutableStateListOf<StudyPlan>()
    val cards = mutableStateListOf<ReviewCard>()

    init {
        val data = runCatching { json.decodeFromString(AppData.serializer(), dataFile.readText()) }.getOrNull() ?: AppData()
        materials += data.materials
        plans += data.plans
        cards += data.cards
    }

    fun pdfFile(material: StudyMaterial) = File(materialsDir, "${material.id}.pdf")

    private fun inkFile(materialId: String) = File(materialsDir, "$materialId.ink.json")

    // Materials

    /** PDFs are copied as they are; images (photos of worksheets, screenshots) become a one-page PDF. */
    suspend fun importFile(uri: Uri): StudyMaterial = withContext(Dispatchers.IO) {
        val name = displayName(uri)
        val title = name?.substringBeforeLast('.')?.ifBlank { null } ?: "Dokument"
        val type = resolver.getType(uri) ?: ""
        val isImage = type.startsWith("image/") ||
            name?.substringAfterLast('.', "")?.lowercase() in setOf("jpg", "jpeg", "png", "heic", "heif", "webp")
        if (isImage) {
            val bitmap = runCatching {
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(resolver, uri)) { decoder, info, _ ->
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                    // Plenty for reading and OCR, and keeps a 50-megapixel photo from filling the memory.
                    val longest = maxOf(info.size.width, info.size.height)
                    if (longest > 3000) decoder.setTargetSampleSize((longest + 2999) / 3000)
                }
            }.getOrElse { throw IOException("Das Bild lässt sich nicht öffnen.") }
            return@withContext savePdf(imagePdf(bitmap), title)
        }
        val material = StudyMaterial(title = title)
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

    suspend fun savePdf(data: ByteArray, title: String): StudyMaterial = withContext(Dispatchers.IO) {
        val material = StudyMaterial(title = title)
        pdfFile(material).writeBytes(data)
        withContext(Dispatchers.Main) { materials += material }
        save()
        material
    }

    fun deleteMaterial(material: StudyMaterial) {
        materials.removeAll { it.id == material.id }
        scope.launch {
            pdfFile(material).delete()
            inkFile(material.id).delete()
        }
        save()
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
        val data = AppData(materials.toList(), plans.toList(), cards.toList())
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
