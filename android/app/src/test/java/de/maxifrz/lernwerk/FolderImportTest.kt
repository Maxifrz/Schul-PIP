package de.maxifrz.lernwerk

import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import de.maxifrz.lernwerk.data.FolderImport
import de.maxifrz.lernwerk.data.FolderImportEntry
import de.maxifrz.lernwerk.data.Repository
import de.maxifrz.lernwerk.data.StudyMaterial
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class FolderImportRulesTest {
    @Test
    fun archiveWithOneFolderImportsThatFolder() {
        val scan = FolderImport.scanArchive(
            listOf("Deutsch/", "Deutsch/Faust.pdf", "Deutsch/Lyrik/Rilke.pdf", "__MACOSX/Deutsch/._Faust.pdf"),
            archiveName = "Export",
        )
        assertEquals(
            listOf(
                FolderImportEntry("Deutsch/Faust.pdf", listOf("Deutsch")),
                FolderImportEntry("Deutsch/Lyrik/Rilke.pdf", listOf("Deutsch", "Lyrik")),
            ),
            scan.files,
        )
        assertEquals(emptyList<String>(), scan.skipped)
    }

    @Test
    fun archiveWithLooseFilesBecomesAFolderNamedAfterIt() {
        val scan = FolderImport.scanArchive(listOf("a.pdf", "Englisch/b.pdf", "c.goodnotes"), archiveName = "Notizen")
        // GoodNotes notebooks are ZIP files of their own and come in as documents
        assertEquals(listOf(listOf("Notizen"), listOf("Notizen"), listOf("Notizen", "Englisch")), scan.files.map { it.folders })
        assertEquals(emptyList<String>(), scan.skipped)
    }

    @Test
    fun namesSortWithNumbersInOrder() {
        val sorted = listOf("Blatt 10.pdf", "blatt 2.pdf", "Anhang.pdf").sortedWith(FolderImport.nameOrder)
        assertEquals(listOf("Anhang.pdf", "blatt 2.pdf", "Blatt 10.pdf"), sorted)
    }

    @Test
    fun foldersAndPackagesAreToldApart() {
        assertTrue(FolderImport.isPackage("Chemie.goodnotes"))
        assertTrue(!FolderImport.isPackage("Bio 11.2"))
        assertTrue(FolderImport.isImportable("Zelle.PDF"))
        assertTrue(!FolderImport.isImportable(".Zelle.pdf"))
    }

    @Test
    fun folderPathsListParentsFirstAndOnce() {
        val paths = FolderImport.folderPaths(listOf(listOf("A", "B", "C"), listOf("A"), listOf("A", "D"), listOf("A", "B")))
        assertEquals(listOf(listOf("A"), listOf("A", "B"), listOf("A", "B", "C"), listOf("A", "D")), paths)
    }

    @Test
    fun summaryExplainsGoodNotesFiles() {
        assertNull(FolderImport.summary(3, emptyList(), emptyList()))
        val text = FolderImport.summary(1, listOf("Bio.goodnotes"), emptyList())!!
        assertTrue(text.contains("1 Dokument importiert"))
        assertTrue(text.contains(".goodnotes"))
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@OptIn(ExperimentalCoroutinesApi::class)
class FolderImportRepositoryTest {
    private val context get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    // The repository hops to the main thread to publish new documents; under Robolectric the test itself blocks
    // that thread, so the hop runs in place instead.
    @Before
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun archiveImportRecreatesTheFolders() = runTest {
        val repository = Repository(context)
        val fakePdf = "%PDF-1.4\n%%EOF\n".toByteArray()
        val archive = File(context.cacheDir, "Export.zip")
        ZipOutputStream(archive.outputStream()).use { zip ->
            for (name in listOf("Mathe/Analysis.pdf", "Mathe/Stochastik/Baum.pdf", "Mathe/liesmich.txt")) {
                zip.putNextEntry(ZipEntry(name))
                zip.write(fakePdf)
                zip.closeEntry()
            }
        }

        val result = repository.importArchive(Uri.fromFile(archive), parentId = null)

        assertEquals(2, result.imported)
        assertEquals(listOf("liesmich.txt"), result.skipped)
        val mathe = repository.folders.single { it.name == "Mathe" }
        val stochastik = repository.folders.single { it.name == "Stochastik" }
        assertNull(mathe.parentId)
        assertEquals(mathe.id, stochastik.parentId)
        assertEquals(mathe.id, repository.materials.single { it.title == "Analysis" }.folderId)
        assertEquals(stochastik.id, repository.materials.single { it.title == "Baum" }.folderId)
    }

    @Test
    fun groupingPutsDocumentsIntoANewFolder() {
        val repository = Repository(context)
        val a = StudyMaterial(title = "A")
        val b = StudyMaterial(title = "B")
        val c = StudyMaterial(title = "C")
        repository.materials += listOf(a, b, c)

        val folder = repository.groupIntoNewFolder(listOf(a.id, b.id), parentId = null)!!

        assertEquals("Neuer Ordner", folder.name)
        assertEquals(listOf(folder.id, folder.id, null), repository.materials.map { it.folderId })
    }
}
