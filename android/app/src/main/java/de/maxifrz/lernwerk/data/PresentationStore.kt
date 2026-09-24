package de.maxifrz.lernwerk.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.runtime.mutableStateListOf
import de.maxifrz.lernwerk.present.Presentation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID

/** Presentations as one JSON file each, their pictures in a shared media folder. */
class PresentationStore(context: Context) {
    private val root = File(context.filesDir, "presentations").apply { mkdirs() }
    private val mediaDir = File(root, "media").apply { mkdirs() }
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val writeLock = Mutex()
    private val pendingWrites = mutableMapOf<String, Job>()
    private val bitmaps = object : LruCache<String, Bitmap>(64 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    val presentations = mutableStateListOf<Presentation>()

    init {
        root.listFiles { file -> file.extension == "json" }
            ?.mapNotNull { file -> runCatching { json.decodeFromString(Presentation.serializer(), file.readText()) }.getOrNull() }
            ?.sortedByDescending { it.updatedAt }
            ?.let { presentations += it }
    }

    fun presentation(id: String) = presentations.firstOrNull { it.id == id }

    fun add(presentation: Presentation) {
        presentations.add(0, presentation)
        write(presentation, immediately = true)
    }

    /** Keeps the list current right away and writes the file shortly after, so dragging does not hit the disk. */
    fun update(presentation: Presentation) {
        val updated = presentation.copy(updatedAt = System.currentTimeMillis())
        val index = presentations.indexOfFirst { it.id == updated.id }
        if (index < 0) return
        presentations[index] = updated
        write(updated, immediately = false)
    }

    fun delete(presentation: Presentation) {
        presentations.removeAll { it.id == presentation.id }
        pendingWrites.remove(presentation.id)?.cancel()
        scope.launch { writeLock.withLock { file(presentation.id).delete() } }
    }

    private fun file(id: String) = File(root, "$id.json")

    private fun write(presentation: Presentation, immediately: Boolean) {
        pendingWrites.remove(presentation.id)?.cancel()
        pendingWrites[presentation.id] = scope.launch {
            if (!immediately) delay(600)
            val text = json.encodeToString(Presentation.serializer(), presentation)
            writeLock.withLock {
                val target = file(presentation.id)
                val temp = File(root, "${presentation.id}.json.tmp")
                temp.writeText(text)
                if (!temp.renameTo(target)) {
                    target.writeText(text)
                    temp.delete()
                }
            }
        }
    }

    // Media

    fun mediaFile(name: String) = File(mediaDir, name)

    /** Stores a picture and returns its file name for an image element. */
    suspend fun saveMedia(bytes: ByteArray, extension: String): String = withContext(Dispatchers.IO) {
        val name = "${UUID.randomUUID()}.$extension"
        mediaFile(name).writeBytes(bytes)
        name
    }

    fun mediaBytes(name: String): ByteArray? = mediaFile(name).takeIf { it.exists() }?.readBytes()

    /** A picture for drawing, scaled down to at most [maxSize] pixels on its longer side and cached. */
    suspend fun bitmap(name: String, maxSize: Int = 1600): Bitmap? {
        bitmaps.get("$name@$maxSize")?.let { return it }
        return withContext(Dispatchers.IO) {
            val file = mediaFile(name)
            if (!file.exists()) return@withContext null
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.path, bounds)
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSize) sample *= 2
            BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
                ?.also { bitmaps.put("$name@$maxSize", it) }
        }
    }

    /** Size of a stored picture in pixels, for giving new image elements the right aspect ratio. */
    suspend fun imageSize(name: String): Pair<Int, Int>? = withContext(Dispatchers.IO) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(mediaFile(name).path, bounds)
        if (bounds.outWidth > 0) bounds.outWidth to bounds.outHeight else null
    }
}
