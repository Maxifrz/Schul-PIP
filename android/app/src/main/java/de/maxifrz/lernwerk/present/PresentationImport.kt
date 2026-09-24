package de.maxifrz.lernwerk.present

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import de.maxifrz.lernwerk.data.ImageCompressor
import de.maxifrz.lernwerk.data.PresentationStore
import de.maxifrz.lernwerk.pdf.PdfPages
import de.maxifrz.lernwerk.pdf.PdfText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

/** Turns a PowerPoint or PDF file into an editable presentation in the store. */
object PresentationImport {
    class Result(val presentation: Presentation, val skipped: Int)

    suspend fun import(context: Context, store: PresentationStore, uri: Uri): Result = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val name = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: uri.lastPathSegment?.substringAfterLast('/') ?: "Präsentation"
        val title = name.substringBeforeLast('.').ifBlank { "Präsentation" }
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: throw IOException("Die Datei lässt sich nicht öffnen.")
        val type = resolver.getType(uri).orEmpty()
        val isPdf = type == "application/pdf" || name.endsWith(".pdf", ignoreCase = true) ||
            (bytes.size > 4 && String(bytes, 0, 4, Charsets.ISO_8859_1) == "%PDF")
        val result = if (isPdf) pdf(context, store, bytes, title) else pptx(store, bytes, title)
        withContext(Dispatchers.Main) { store.add(result.presentation) }
        result
    }

    private suspend fun pptx(store: PresentationStore, bytes: ByteArray, title: String): Result {
        val imported = runCatching { PptxReader.read(bytes, title) }
            .getOrElse { throw IOException("Das ist keine lesbare PowerPoint-Datei (.pptx). Ältere .ppt-Dateien vorher in PowerPoint als .pptx speichern.") }
        imported.media.forEach { (mediaName, data) -> store.saveMedia(mediaName, data) }
        return Result(imported.presentation, imported.skipped)
    }

    /** Every page becomes a picture slide; its text layer goes along for the AI. */
    private suspend fun pdf(context: Context, store: PresentationStore, bytes: ByteArray, title: String): Result {
        val file = File.createTempFile("import", ".pdf", context.cacheDir)
        try {
            file.writeBytes(bytes)
            val texts = PdfText.pageTexts(file).orEmpty()
            val pages = PdfPages.open(file) ?: throw IOException("Das PDF lässt sich nicht öffnen.")
            val slides = pages.use { document ->
                (0 until document.pageCount).mapNotNull { index ->
                    val bitmap = document.render(index, 1920) ?: return@mapNotNull null
                    val media = store.saveMedia(ImageCompressor.encode(bitmap, 85), "jpg")
                    val frame = SlideGeometry.fit(bitmap.width, bitmap.height, SlideGeometry.RectBox(0f, 0f, SlideSize.WIDTH, SlideSize.HEIGHT))
                    Slide(
                        elements = listOf(SlideElement(kind = ElementKind.IMAGE, x = frame.x, y = frame.y, width = frame.width, height = frame.height, image = media)),
                        extractedText = texts.getOrNull(index).orEmpty(),
                        background = "#FFFFFF",
                    )
                }
            }
            if (slides.isEmpty()) throw IOException("Das PDF hat keine lesbaren Seiten.")
            return Result(Presentation(title = title, themeId = SlideTheme.PAPER.id, slides = slides), 0)
        } finally {
            file.delete()
        }
    }
}
