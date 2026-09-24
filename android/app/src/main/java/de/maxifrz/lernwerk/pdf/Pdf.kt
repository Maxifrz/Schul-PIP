package de.maxifrz.lernwerk.pdf

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.text.PDFTextStripperByArea
import de.maxifrz.lernwerk.data.ImageCompressor
import de.maxifrz.lernwerk.plan.MaterialDocument
import de.maxifrz.lernwerk.tutor.DemoContent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.File
import kotlin.math.roundToInt

/** Size of a PDF page in points. */
data class PageSize(val width: Float, val height: Float) {
    val aspect: Float get() = if (width > 0) height / width else 1.414f
}

/** Renders pages with the platform's PdfRenderer, which allows only one open page at a time. */
class PdfPages private constructor(private val descriptor: ParcelFileDescriptor, private val renderer: PdfRenderer) : Closeable {
    private val lock = Mutex()
    val pageCount = renderer.pageCount
    val sizes: List<PageSize> = (0 until pageCount).map { index ->
        renderer.openPage(index).use { PageSize(it.width.toFloat(), it.height.toFloat()) }
    }

    suspend fun render(index: Int, widthPx: Int): Bitmap? = withContext(Dispatchers.IO) {
        lock.withLock {
            if (index !in 0 until pageCount || widthPx <= 0) return@withLock null
            runCatching {
                renderer.openPage(index).use { page ->
                    val height = (widthPx * page.height.toFloat() / page.width).roundToInt().coerceAtLeast(1)
                    val bitmap = Bitmap.createBitmap(widthPx, height, Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    bitmap
                }
            }.getOrNull()
        }
    }

    override fun close() {
        runCatching { renderer.close() }
        runCatching { descriptor.close() }
    }

    companion object {
        fun open(file: File): PdfPages? = runCatching {
            val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            try {
                PdfPages(descriptor, PdfRenderer(descriptor))
            } catch (error: Exception) {
                descriptor.close()
                throw error
            }
        }.getOrNull()
    }
}

/** Text layer access with PdfBox, which PdfRenderer does not offer. */
object PdfText {
    /** Trimmed text of every page, or null when the file is not a readable PDF. */
    fun pageTexts(file: File): List<String>? = runCatching {
        PDDocument.load(file).use { document ->
            val stripper = PDFTextStripper()
            (1..document.numberOfPages).map { page ->
                stripper.startPage = page
                stripper.endPage = page
                stripper.getText(document).trim()
            }
        }
    }.getOrNull()

    /** Text inside a region given as fractions of the page, with the origin at the top left. */
    fun textIn(file: File, pageIndex: Int, region: RectF): String = runCatching {
        PDDocument.load(file).use { document ->
            val page = document.getPage(pageIndex)
            val box = page.cropBox
            val swapped = page.rotation % 180 != 0
            val width = if (swapped) box.height else box.width
            val height = if (swapped) box.width else box.height
            val stripper = PDFTextStripperByArea()
            stripper.sortByPosition = true
            stripper.addRegion(
                "marked",
                RectF(region.left * width, region.top * height, region.right * width, region.bottom * height),
            )
            stripper.extractRegions(page)
            stripper.getTextForRegion("marked").trim()
        }
    }.getOrDefault("")
}

/** On-device OCR with ML Kit: free and offline. Handles print well, handwriting only roughly. */
object TextRecognizer {
    private val client by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

    suspend fun text(bitmap: Bitmap): String = runCatching {
        val result = client.process(InputImage.fromBitmap(bitmap, 0)).await()
        result.textBlocks
            .flatMap { it.lines }
            .sortedWith(compareBy({ it.boundingBox?.top ?: 0 }, { it.boundingBox?.left ?: 0 }))
            .joinToString("\n") { it.text }
    }.getOrDefault("")

    suspend fun text(jpeg: ByteArray): String {
        val bitmap = android.graphics.BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size) ?: return ""
        return text(bitmap)
    }
}

/** A material opened for the study plan: PdfBox for text, PdfRenderer for OCR and page images. */
class AndroidMaterialDocument private constructor(
    private val pages: PdfPages,
    private val file: File,
    override val pageTexts: List<String>,
) : MaterialDocument, Closeable {
    override suspend fun recognizeText(pageNumber: Int): String {
        val bitmap = pages.render(pageNumber - 1, 2000) ?: return ""
        return TextRecognizer.text(bitmap)
    }

    override suspend fun pageImage(pageNumber: Int): ByteArray? {
        val bitmap = pages.render(pageNumber - 1, 1400) ?: return null
        return ImageCompressor.encode(bitmap, 60)
    }

    override fun close() {
        pages.close()
        file.delete()
    }

    companion object {
        suspend fun open(data: ByteArray, cacheDir: File): AndroidMaterialDocument? = withContext(Dispatchers.IO) {
            val file = File.createTempFile("material", ".pdf", cacheDir)
            file.writeBytes(data)
            val texts = PdfText.pageTexts(file)
            val pages = texts?.let { PdfPages.open(file) }
            if (texts == null || pages == null) {
                file.delete()
                return@withContext null
            }
            AndroidMaterialDocument(pages, file, texts)
        }
    }
}

object DemoPdf {
    /** The bundled sample material as an A4 PDF with a real text layer. */
    fun make(): ByteArray {
        val document = PdfDocument()
        val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = 26f
            isFakeBoldText = true
        }
        val bodyPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = 15f
        }
        DemoContent.pages.forEachIndexed { index, (title, body) ->
            val page = document.startPage(PdfDocument.PageInfo.Builder(595, 842, index + 1).create())
            val canvas: Canvas = page.canvas
            canvas.drawText(title, 56f, 86f, titlePaint)
            val layout = StaticLayout.Builder.obtain(body, 0, body.length, bodyPaint, 595 - 112)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(6f, 1f)
                .build()
            canvas.save()
            canvas.translate(56f, 116f)
            layout.draw(canvas)
            canvas.restore()
            document.finishPage(page)
        }
        return ByteArrayOutputStream().also { document.writeTo(it); document.close() }.toByteArray()
    }
}
