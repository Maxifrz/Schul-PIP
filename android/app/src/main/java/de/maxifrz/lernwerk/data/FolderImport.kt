package de.maxifrz.lernwerk.data

/** A file found in an imported folder or ZIP archive: where it lies, and its folders from the import root down. */
data class FolderImportEntry(val location: String, val folders: List<String>)

/** What a folder or archive holds: the files the library can take, and the names of those it cannot. */
data class FolderScan(val files: List<FolderImportEntry> = emptyList(), val skipped: List<String> = emptyList())

/** What a folder or archive import brought in; `files` are the new documents, the folders are already created. */
data class FolderImportResult(val imported: Int = 0, val skipped: List<String> = emptyList(), val failed: List<String> = emptyList())

/**
 * Importing a whole folder, like a GoodNotes export: every PDF, picture and Word file below it, with the subfolders
 * recreated as library folders. The walking itself needs Android; the rules here are plain Kotlin. Mirrors
 * `FolderImport.swift`.
 */
object FolderImport {
    val extensions = setOf("pdf", "docx", "goodnotes", "png", "jpg", "jpeg", "heic", "heif", "webp", "gif", "tif", "tiff", "bmp")

    /** Documents stored as folders; a folder named „Bio 11.2“ still has to count as a folder. */
    val packageExtensions = setOf("goodnotes", "note", "nbn", "pages", "key", "numbers", "app", "bundle", "rtfd")

    /** Symbolic links can loop; no school folder is deeper than this. */
    const val MAX_DEPTH = 24

    fun extension(name: String) = name.substringAfterLast('.', "").lowercase()

    fun isImportable(name: String) = !name.startsWith(".") && extension(name) in extensions

    /** Finder's `._` copies, `.DS_Store` and the like; never listed as skipped. */
    fun isHidden(name: String) = name.startsWith(".") || name == "__MACOSX" || name == "Thumbs.db" || name == "desktop.ini"

    fun isPackage(name: String) = extension(name) in packageExtensions

    /** Case-insensitive, with numbers in order: „Blatt 2“ before „Blatt 10“. */
    val nameOrder: Comparator<String> = Comparator { a, b -> compareNatural(a.lowercase(), b.lowercase()) }

    private fun compareNatural(a: String, b: String): Int {
        var i = 0
        var j = 0
        while (i < a.length && j < b.length) {
            if (a[i].isDigit() && b[j].isDigit()) {
                val startA = i
                val startB = j
                while (i < a.length && a[i].isDigit()) i++
                while (j < b.length && b[j].isDigit()) j++
                val numberA = a.substring(startA, i).trimStart('0')
                val numberB = b.substring(startB, j).trimStart('0')
                if (numberA.length != numberB.length) return numberA.length - numberB.length
                val compared = numberA.compareTo(numberB)
                if (compared != 0) return compared
            } else {
                if (a[i] != b[j]) return a[i] - b[j]
                i++
                j++
            }
        }
        return (a.length - i) - (b.length - j)
    }

    /**
     * The entries of a ZIP archive. An archive that holds a single folder is imported as that folder; any other
     * becomes a folder named after the archive.
     */
    fun scanArchive(paths: List<String>, archiveName: String): FolderScan {
        val parts = paths
            .map { path -> path.replace('\\', '/').split('/').filter { it.isNotEmpty() } }
            .filter { it.isNotEmpty() && it.none(::isHidden) }
        // Directories come with a trailing slash, which the split drops; a path that starts another is a directory.
        val fileParts = parts.filter { part -> parts.none { it.size > part.size && it.subList(0, part.size) == part } }
        val singleFolder = fileParts.map { it.first() }.toSet().size == 1 && fileParts.all { it.size > 1 }
        val files = mutableListOf<FolderImportEntry>()
        val skipped = mutableListOf<String>()
        for (part in fileParts.sortedWith(compareBy(nameOrder) { it.joinToString("/") })) {
            val name = part.last()
            if (!isImportable(name)) {
                skipped += name
                continue
            }
            val folders = if (singleFolder) part.dropLast(1) else listOf(archiveName) + part.dropLast(1)
            files += FolderImportEntry(part.joinToString("/"), folders)
        }
        return FolderScan(files, skipped)
    }

    /** The folders the files need, each parent before its children. */
    fun folderPaths(entries: List<List<String>>): List<List<String>> {
        val seen = mutableSetOf<List<String>>()
        val result = mutableListOf<List<String>>()
        for (path in entries) {
            for (depth in 1..path.size) {
                val prefix = path.subList(0, depth).toList()
                if (seen.add(prefix)) result += prefix
            }
        }
        return result
    }

    /** The note after an import, when something was left out; null when everything came in. */
    fun summary(imported: Int, skipped: List<String>, failed: List<String>): String? {
        if (skipped.isEmpty() && failed.isEmpty()) return null
        val lines = mutableListOf(if (imported == 1) "1 Dokument importiert." else "$imported Dokumente importiert.")
        if (failed.isNotEmpty()) lines += "Nicht lesbar: " + list(failed)
        if (skipped.isNotEmpty()) lines += "Übersprungen: " + list(skipped)
        if (skipped.any { extension(it) == "goodnotes" }) {
            lines += "GoodNotes-Ordner lassen sich hier nicht lesen. Teile das Notizbuch in GoodNotes als GoodNotes-Datei (.goodnotes) und importiere diese."
        }
        return lines.joinToString("\n\n")
    }

    private fun list(names: List<String>): String {
        val shown = names.take(5).joinToString(", ")
        return if (names.size > 5) "$shown und ${names.size - 5} weitere" else shown
    }
}
