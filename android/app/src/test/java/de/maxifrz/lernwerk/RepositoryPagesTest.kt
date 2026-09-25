package de.maxifrz.lernwerk

import android.graphics.Bitmap
import androidx.test.core.app.ApplicationProvider
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font
import com.tom_roush.pdfbox.text.PDFTextStripper
import de.maxifrz.lernwerk.data.InkStroke
import de.maxifrz.lernwerk.data.InkTool
import de.maxifrz.lernwerk.data.Repository
import de.maxifrz.lernwerk.data.StudyMaterial
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream

/** A real, in-memory PDF with one page of text per label, built with PDFBox exactly like the app itself would
 * read or write one. */
private fun pdf(vararg labels: String): ByteArray {
    val document = PDDocument()
    for (label in labels) {
        val page = PDPage(PDRectangle.A4)
        document.addPage(page)
        PDPageContentStream(document, page).use { stream ->
            stream.beginText()
            stream.setFont(PDType1Font.HELVETICA, 18f)
            stream.newLineAtOffset(50f, 750f)
            stream.showText(label)
            stream.endText()
        }
    }
    return ByteArrayOutputStream().also { document.save(it); document.close() }.toByteArray()
}

private fun pageTexts(bytes: ByteArray): List<String> = PDDocument.load(bytes).use { document ->
    (1..document.numberOfPages).map { page ->
        val stripper = PDFTextStripper()
        stripper.startPage = page
        stripper.endPage = page
        stripper.getText(document).trim()
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RepositoryPagesTest {
    private val context get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    private fun Repository.add(pages: Int): StudyMaterial {
        val material = StudyMaterial(title = "M")
        pdfFile(material).writeBytes(pdf(*(1..pages).map { "Seite $it" }.toTypedArray()))
        materials += material
        save()
        return material
    }

    @Test
    fun insertingPdfPagesSplicesThemInAndShiftsInk() = runTest {
        val repository = Repository(context)
        val material = repository.add(3)
        repository.saveInk(
            material.id,
            mapOf(
                0 to listOf(InkStroke(InkTool.PEN, listOf(0f, 0f))),
                2 to listOf(InkStroke(InkTool.PEN, listOf(1f, 1f))),
            ),
        )

        val inserted = repository.insertPdfPages(material, pdf("Neu A", "Neu B"), afterIndex = 0)
        assertTrue(inserted)

        val texts = pageTexts(repository.pdfFile(material).readBytes())
        assertEquals(listOf("Seite 1", "Neu A", "Neu B", "Seite 2", "Seite 3"), texts)

        val ink = repository.loadInk(material.id)
        assertEquals(setOf(0, 4), ink.keys)
        assertEquals(0f, ink.getValue(0).single().points[0])
        assertEquals(1f, ink.getValue(4).single().points[0])
    }

    @Test
    fun insertingAtTheEndAppends() = runTest {
        val repository = Repository(context)
        val material = repository.add(2)
        assertTrue(repository.insertPdfPages(material, pdf("Neu"), afterIndex = 1))
        assertEquals(listOf("Seite 1", "Seite 2", "Neu"), pageTexts(repository.pdfFile(material).readBytes()))
    }

    @Test
    fun insertingAnImagePageAddsOnePageFitToTheDocument() = runTest {
        val repository = Repository(context)
        val material = repository.add(1)
        val bitmap = Bitmap.createBitmap(400, 200, Bitmap.Config.ARGB_8888)
        assertTrue(repository.insertImagePage(material, bitmap, afterIndex = 0))

        PDDocument.load(repository.pdfFile(material)).use { document ->
            assertEquals(2, document.numberOfPages)
            val box = document.getPage(0).mediaBox
            val imagePage = document.getPage(1).mediaBox
            assertEquals(box.width, imagePage.width, 0.01f)
            assertEquals(box.height, imagePage.height, 0.01f)
        }
    }

    @Test
    fun aMissingSourceFailsWithoutCrashing() = runTest {
        val repository = Repository(context)
        val material = repository.add(1)
        assertEquals(false, repository.insertPdfPages(material, byteArrayOf(1, 2, 3), afterIndex = 0))
        assertEquals(1, pageTexts(repository.pdfFile(material).readBytes()).size)
    }
}
