package de.maxifrz.lernwerk.data

import java.text.Collator
import java.text.Normalizer
import java.util.Locale

/** A school subject with its color in the library. */
data class Subject(val name: String, val color: Long)

object Subjects {
    val all = listOf(
        Subject("Mathe", 0x3D6FB6),
        Subject("Deutsch", 0xC46A55),
        Subject("Englisch", 0x8E6BB8),
        Subject("Französisch", 0x5A7FC4),
        Subject("Latein", 0x9A7B5B),
        Subject("Biologie", 0x5E9E6E),
        Subject("Chemie", 0x2E9C9C),
        Subject("Physik", 0x4F6D8F),
        Subject("Geschichte", 0xA67C52),
        Subject("Politik", 0xB8A04A),
        Subject("Erdkunde", 0x6E8B3D),
        Subject("Informatik", 0x5A5AA8),
        Subject("Kunst", 0xD17A9E),
        Subject("Musik", 0x9E6B8E),
        Subject("Religion/Ethik", 0x8C8C6E),
        Subject("Sport", 0xD9903A),
        Subject("Sonstiges", 0x8A8680),
    )

    fun color(name: String): Long? = all.firstOrNull { it.name == name }?.color
}

enum class LibrarySort(val label: String) {
    RECENT("Zuletzt geöffnet"),
    NAME("Name"),
    ADDED("Hinzugefügt"),
    SUBJECT("Fach"),
}

/** A search result: the material and, for a match in its text, the page and the passage around it. */
data class SearchHit(val material: StudyMaterial, val page: Int? = null, val snippet: String? = null)

/** Sorting, searching and folder structure of the library, free of Android so it can be unit-tested. Mirrors iOS. */
object Library {
    const val TRASH_DAYS = 30
    private const val DAY_MILLIS = 24L * 60 * 60 * 1000

    private val collator: Collator = Collator.getInstance(Locale.GERMAN).apply { strength = Collator.PRIMARY }

    fun sort(materials: List<StudyMaterial>, sort: LibrarySort): List<StudyMaterial> = when (sort) {
        LibrarySort.RECENT -> materials.sortedByDescending { it.lastOpenedAt ?: it.createdAt }
        LibrarySort.NAME -> materials.sortedWith { a, b -> collator.compare(a.title, b.title) }
        LibrarySort.ADDED -> materials.sortedByDescending { it.createdAt }
        LibrarySort.SUBJECT -> materials.sortedWith(
            compareBy<StudyMaterial> { it.subject.isEmpty() }
                .thenComparator { a, b -> collator.compare(a.subject, b.subject) }
                .thenComparator { a, b -> collator.compare(a.title, b.title) },
        )
    }

    /** Lower case without accents and ß as ss, so "aussere" finds "Äußere". */
    fun normalize(text: String): String = normalizeMapped(text).first

    /** The normalized text and, for each of its characters, the index of the original character it came from. */
    private fun normalizeMapped(text: String): Pair<String, IntArray> {
        val out = StringBuilder()
        val origin = ArrayList<Int>(text.length)
        text.forEachIndexed { index, char ->
            val piece = if (char == 'ß' || char == 'ẞ') {
                "ss"
            } else {
                Normalizer.normalize(char.lowercase(Locale.GERMAN), Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "")
            }
            out.append(piece)
            repeat(piece.length) { origin += index }
        }
        return out.toString() to origin.toIntArray()
    }

    private fun terms(query: String) = normalize(query).split(Regex("\\s+")).filter { it.isNotEmpty() }

    /**
     * Materials whose title, subject or folder name contain every word of the query come first; then those whose
     * text does, with the first matching page and the passage around the first word.
     */
    fun search(
        materials: List<StudyMaterial>,
        folders: List<Folder>,
        query: String,
        pageTexts: (StudyMaterial) -> List<String>?,
    ): List<SearchHit> {
        val words = terms(query)
        if (words.isEmpty()) return emptyList()
        val folderNames = folders.associate { it.id to it.name }
        val byTitle = mutableListOf<SearchHit>()
        val byText = mutableListOf<SearchHit>()
        for (material in materials) {
            val label = normalize("${material.title} ${material.subject} ${folderNames[material.folderId].orEmpty()}")
            if (words.all { it in label }) {
                byTitle += SearchHit(material)
                continue
            }
            val pages = pageTexts(material) ?: continue
            for ((index, text) in pages.withIndex()) {
                val normalized = normalize(text)
                if (words.all { it in normalized }) {
                    byText += SearchHit(material, index + 1, snippet(text, words.first()))
                    break
                }
            }
        }
        return byTitle + byText
    }

    /** About 90 characters around the first match of [word] (normalized), cut at word boundaries. */
    fun snippet(text: String, word: String): String {
        val flat = text.replace(Regex("\\s+"), " ").trim()
        val (normalized, origin) = normalizeMapped(flat)
        val found = normalized.indexOf(word)
        val at = if (found >= 0) origin[found] else 0
        val matchEnd = if (found >= 0) origin[found + word.length - 1] + 1 else 0
        var start = maxOf(0, at - 40)
        var end = minOf(flat.length, matchEnd + 50)
        if (start > 0) start = flat.indexOf(' ', start).takeIf { it in 0 until at }?.plus(1) ?: start
        if (end < flat.length) end = flat.lastIndexOf(' ', end).takeIf { it >= matchEnd } ?: end
        return (if (start > 0) "…" else "") + flat.substring(start, end).trim() + if (end < flat.length) "…" else ""
    }

    /** The folder and everything inside it, at any depth. */
    fun descendants(folders: List<Folder>, id: String): Set<String> {
        val result = mutableSetOf(id)
        var added = true
        while (added) {
            added = false
            for (folder in folders) {
                if (folder.parentId in result && result.add(folder.id)) added = true
            }
        }
        return result
    }

    /** From the top level down to the folder, for the breadcrumb. */
    fun path(folders: List<Folder>, id: String?): List<Folder> {
        val byId = folders.associateBy { it.id }
        val result = mutableListOf<Folder>()
        var current = id?.let(byId::get)
        while (current != null && current !in result) {
            result.add(0, current)
            current = current.parentId?.let(byId::get)
        }
        return result
    }

    /** Folders a folder may move into: not itself and nothing inside it. */
    fun moveTargets(folders: List<Folder>, moving: String?): List<Folder> {
        val excluded = moving?.let { descendants(folders, it) }.orEmpty()
        return folders.filter { it.id !in excluded }
    }

    fun isExpired(material: StudyMaterial, now: Long): Boolean =
        material.deletedAt?.let { now - it > TRASH_DAYS * DAY_MILLIS } ?: false

    /** Days until a trashed material is deleted for good. */
    fun daysLeft(material: StudyMaterial, now: Long): Int =
        material.deletedAt?.let { maxOf(0, TRASH_DAYS - ((now - it) / DAY_MILLIS).toInt()) } ?: TRASH_DAYS
}
