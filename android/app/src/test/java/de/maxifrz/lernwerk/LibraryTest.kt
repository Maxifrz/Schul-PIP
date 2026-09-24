package de.maxifrz.lernwerk

import androidx.test.core.app.ApplicationProvider
import de.maxifrz.lernwerk.data.Folder
import de.maxifrz.lernwerk.data.Library
import de.maxifrz.lernwerk.data.LibrarySort
import de.maxifrz.lernwerk.data.Repository
import de.maxifrz.lernwerk.data.StudyMaterial
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

class LibraryTest {
    private val day = 24L * 60 * 60 * 1000
    private val bio = StudyMaterial(id = "bio", title = "Zellbiologie", createdAt = 3, subject = "Biologie", lastOpenedAt = 10)
    private val math = StudyMaterial(id = "math", title = "Ableitungen", createdAt = 2, subject = "Mathe")
    private val history = StudyMaterial(id = "hist", title = "Ägypten", createdAt = 1, lastOpenedAt = 20)

    @Test
    fun sortsByEveryCriterion() {
        val all = listOf(bio, math, history)
        assertEquals(listOf("hist", "bio", "math"), Library.sort(all, LibrarySort.RECENT).map { it.id })
        // German collation: Ä sorts with A.
        assertEquals(listOf("math", "hist", "bio"), Library.sort(all, LibrarySort.NAME).map { it.id })
        assertEquals(listOf("bio", "math", "hist"), Library.sort(all, LibrarySort.ADDED).map { it.id })
        // Materials without a subject come last.
        assertEquals(listOf("bio", "math", "hist"), Library.sort(all, LibrarySort.SUBJECT).map { it.id })
    }

    @Test
    fun searchFindsTitlesFirstThenText() {
        val folders = listOf(Folder(id = "f", name = "Klausur Q2"))
        val texts = mapOf(
            "bio" to listOf("Einleitung", "Die Mitochondrien sind die Kraftwerke der Zelle und bilden ATP aus Glucose."),
            "math" to listOf("Die Kettenregel: äußere mal innere Ableitung."),
        )
        val all = listOf(bio, math.copy(folderId = "f"), history)
        val hits = Library.search(all, folders, "kraftwerke zelle", { texts[it.id] })
        assertEquals(1, hits.size)
        assertEquals("bio", hits[0].material.id)
        assertEquals(2, hits[0].page)
        assertTrue(hits[0].snippet!!.contains("Kraftwerke der Zelle"))

        // Without accents and in any case; titles and folder names count as title matches.
        assertEquals(listOf("hist"), Library.search(all, folders, "agypten", { texts[it.id] }).map { it.material.id })
        val text = Library.search(all, folders, "AUSSERE ableitung", { texts[it.id] }).single()
        assertEquals("math", text.material.id)
        assertEquals("Die Kettenregel: äußere mal innere Ableitung.", text.snippet)
        assertEquals(listOf("math"), Library.search(all, folders, "klausur", { texts[it.id] }).map { it.material.id })
        assertTrue(Library.search(all, folders, "   ", { texts[it.id] }).isEmpty())
    }

    @Test
    fun snippetsAreCutAtWords() {
        val text = "Anfang " + "wort ".repeat(30) + "Treffer hier " + "ende ".repeat(30)
        val snippet = Library.snippet(text, "treffer")
        assertTrue(snippet.startsWith("…") && snippet.endsWith("…"))
        assertTrue(snippet.contains("Treffer hier"))
        assertTrue(snippet.length < 110)
    }

    @Test
    fun folderTreeHelpers() {
        val folders = listOf(
            Folder(id = "a", name = "Bio"),
            Folder(id = "b", name = "Genetik", parentId = "a"),
            Folder(id = "c", name = "Klausur", parentId = "b"),
            Folder(id = "d", name = "Mathe"),
        )
        assertEquals(setOf("a", "b", "c"), Library.descendants(folders, "a"))
        assertEquals(listOf("Bio", "Genetik", "Klausur"), Library.path(folders, "c").map { it.name })
        assertTrue(Library.path(folders, null).isEmpty())
        // A folder cannot move into itself or anything inside it.
        assertEquals(listOf("d"), Library.moveTargets(folders, "a").map { it.id })
    }

    @Test
    fun trashExpiresAfterThirtyDays() {
        val now = 100 * day
        val fresh = bio.copy(deletedAt = now - 2 * day)
        val old = bio.copy(deletedAt = now - 31 * day)
        assertFalse(Library.isExpired(fresh, now))
        assertTrue(Library.isExpired(old, now))
        assertFalse(Library.isExpired(bio, now))
        assertEquals(28, Library.daysLeft(fresh, now))
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RepositoryLibraryTest {
    private val context get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    // Added directly: savePdf switches to the main thread, which the test itself runs on.
    private fun Repository.add(title: String, folderId: String? = null): StudyMaterial {
        val material = StudyMaterial(title = title, folderId = folderId)
        pdfFile(material).writeBytes(byteArrayOf(1))
        materials += material
        save()
        return material
    }

    @Test
    fun foldersTrashAndRestore() {
        val repository = Repository(context)
        val bio = repository.createFolder("Bio", null)!!
        val genetics = repository.createFolder("Genetik", bio.id)!!
        assertNull(repository.createFolder("   ", null))
        val a = repository.add("Mendel", genetics.id)
        val b = repository.add("Zelle", bio.id)
        val c = repository.add("Kettenregel")

        repository.setSubject(listOf(a.id, b.id), "Biologie")
        repository.setFavorite(listOf(c.id), true)
        repository.rename(c, "  Kettenregel Übung ")
        assertEquals("Kettenregel Übung", repository.material(c.id)!!.title)

        // Moving a folder into its own subfolder is refused.
        repository.moveFolder(bio, genetics.id)
        assertNull(repository.folders.first { it.id == bio.id }.parentId)

        // Deleting a folder deletes its subfolders and puts everything inside into the trash.
        repository.deleteFolder(bio)
        assertTrue(repository.folders.isEmpty())
        assertEquals(listOf(c.id), repository.library.map { it.id })
        assertEquals(setOf(a.id, b.id), repository.trash.map { it.id }.toSet())

        // Restored materials come back to the top level because their folder is gone.
        repository.restore(repository.material(a.id)!!)
        assertEquals(null, repository.material(a.id)!!.folderId)
        assertEquals("Biologie", repository.material(a.id)!!.subject)

        repository.emptyTrash()
        assertEquals(setOf(a.id, c.id), repository.materials.map { it.id }.toSet())
        assertNull(repository.material(b.id))
    }

    @Test
    fun oldTrashIsDeletedOnStart() {
        val day = 24L * 60 * 60 * 1000
        val now = System.currentTimeMillis()
        val data = de.maxifrz.lernwerk.data.AppData(
            materials = listOf(
                StudyMaterial(id = "new", title = "Neu", deletedAt = now - 2 * day),
                StudyMaterial(id = "old", title = "Alt", deletedAt = now - 40 * day),
                StudyMaterial(id = "kept", title = "Da"),
            ),
        )
        java.io.File(context.filesDir, "materials").mkdirs()
        java.io.File(context.filesDir, "materials/old.pdf").writeBytes(byteArrayOf(1))
        java.io.File(context.filesDir, "lernwerk.json").writeText(kotlinx.serialization.json.Json.encodeToString(de.maxifrz.lernwerk.data.AppData.serializer(), data))
        val repository = Repository(context)
        assertEquals(listOf("new", "kept"), repository.materials.map { it.id })
        assertEquals(listOf("kept"), repository.library.map { it.id })
    }
}
