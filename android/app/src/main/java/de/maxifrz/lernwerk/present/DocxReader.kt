package de.maxifrz.lernwerk.present

import de.maxifrz.lernwerk.present.OfficeXml.all
import de.maxifrz.lernwerk.present.OfficeXml.attr
import de.maxifrz.lernwerk.present.OfficeXml.attrNs
import de.maxifrz.lernwerk.present.OfficeXml.child
import de.maxifrz.lernwerk.present.OfficeXml.children
import de.maxifrz.lernwerk.present.OfficeXml.first
import de.maxifrz.lernwerk.present.OfficeXml.parse
import de.maxifrz.lernwerk.present.OfficeXml.relationships
import de.maxifrz.lernwerk.present.OfficeXml.unzip
import org.w3c.dom.Element

/** A run of text with its formatting, as it appears inside a paragraph, heading, list item or table cell. */
data class DocxRun(val text: String, val bold: Boolean = false, val italic: Boolean = false)

/** A table cell: its own paragraphs, each a run list. */
typealias DocxCell = List<List<DocxRun>>

/** One block of a Word document, in reading order, for `DocxRenderer` to lay out onto PDF pages. Character
 * formatting besides bold and italic (color, underline, font) is not read; headers, footers and footnotes are
 * left out. */
sealed interface DocxBlock {
    data class Heading(val level: Int, val runs: List<DocxRun>) : DocxBlock
    data class Paragraph(val runs: List<DocxRun>) : DocxBlock

    /** [ordered] numbers list items themselves; [index] is the 1-based number within its level when it does. */
    data class ListItem(val level: Int, val ordered: Boolean, val index: Int, val runs: List<DocxRun>) : DocxBlock

    /** [columnWidths] are in points, empty if the document does not give them. */
    data class Table(val rows: List<List<DocxCell>>, val columnWidths: List<Double>) : DocxBlock
    class Picture(val data: ByteArray, val aspect: Double) : DocxBlock {
        override fun equals(other: Any?): Boolean =
            other is Picture && data.contentEquals(other.data) && aspect == other.aspect

        override fun hashCode(): Int = data.contentHashCode() * 31 + aspect.hashCode()
    }
}

data class DocxDocument(val blocks: List<DocxBlock>)

/** Reads a .docx file's body into free blocks. Reuses the ZIP and XML helpers written for PowerPoint import.
 * Mirrors the iOS app. */
object DocxReader {
    fun open(bytes: ByteArray): DocxDocument = parse(unzip(bytes))

    /** The pure parse, given the archive's files by path; separated from [open] so it can be tested without a
     * real ZIP file. */
    fun parse(files: Map<String, ByteArray>): DocxDocument {
        val document = files["word/document.xml"]?.let(::parse) ?: error("Kein Word-Dokument")
        val body = document.child("body") ?: return DocxDocument(emptyList())

        val styles = parseStyles(files["word/styles.xml"])
        val numbering = NumberingFormats(files["word/numbering.xml"])
        val rels = relationships(files, "word/document.xml")

        val blocks = mutableListOf<DocxBlock>()
        val counters = ListCounters()
        for (child in body.children()) {
            when (child.localName) {
                "p" -> blocks += paragraphBlocks(child, styles, numbering, counters, files, rels)
                "tbl" -> blocks += tableBlock(child)
            }
        }
        return DocxDocument(blocks)
    }

    // Paragraphs

    private fun paragraphBlocks(
        p: Element,
        styles: StyleInfo,
        numbering: NumberingFormats,
        counters: ListCounters,
        files: Map<String, ByteArray>,
        relationships: Map<String, String>,
    ): List<DocxBlock> {
        val images = p.all("drawing").mapNotNull { drawingImage(it, files, relationships) }
        val runs = textRuns(p)

        if (images.isNotEmpty()) {
            val blocks = mutableListOf<DocxBlock>()
            if (runs.isNotEmpty()) blocks += DocxBlock.Paragraph(runs)
            blocks += images.map { DocxBlock.Picture(it.first, it.second) }
            return blocks
        }

        val pPr = p.child("pPr")
        val styleId = pPr?.child("pStyle")?.attr("w:val")

        // A direct override on the paragraph wins over the style; both are 0-based like the file format.
        val rawHeadingLevel = pPr?.child("outlineLvl")?.attr("w:val")?.toIntOrNull()
            ?: styleId?.let { styles.headingLevels[it] }
        if (rawHeadingLevel != null) {
            return listOf(DocxBlock.Heading((rawHeadingLevel + 1).coerceIn(1, 9), runs))
        }

        var listNumId: String? = null
        var listLevel = 0
        val numPr = pPr?.child("numPr")
        if (numPr != null) {
            listNumId = numPr.child("numId")?.attr("w:val")
            listLevel = numPr.child("ilvl")?.attr("w:val")?.toIntOrNull() ?: 0
        } else if (styleId != null) {
            styles.listNumbering[styleId]?.let { (numId, level) ->
                listNumId = numId
                listLevel = level
            }
        }
        if (!listNumId.isNullOrEmpty()) {
            val ordered = numbering.isOrdered(listNumId, listLevel)
            val index = counters.next(listNumId, listLevel)
            return listOf(DocxBlock.ListItem(listLevel, ordered, index, runs))
        }

        return listOf(DocxBlock.Paragraph(runs))
    }

    /** The paragraph's text runs, in order; a run that only carries a picture is left out. */
    private fun textRuns(p: Element): List<DocxRun> = p.all("r").mapNotNull { run ->
        if (run.all("drawing").isNotEmpty()) return@mapNotNull null
        val text = runText(run)
        if (text.isEmpty()) return@mapNotNull null
        val rPr = run.child("rPr")
        DocxRun(text, isSet(rPr?.child("b")), isSet(rPr?.child("i")))
    }

    /** A run's visible text: `w:t` verbatim, a tab for `w:tab`, a line break for `w:br`/`w:cr`. */
    private fun runText(run: Element): String {
        val text = StringBuilder()
        for (child in run.children()) {
            when (child.localName) {
                "t" -> text.append(child.textContent)
                "tab" -> text.append('\t')
                "br", "cr" -> text.append('\n')
            }
        }
        return text.toString()
    }

    /** A toggle property like `w:b` or `w:i` is on unless it explicitly says otherwise. */
    private fun isSet(element: Element?): Boolean {
        element ?: return false
        val value = element.attr("w:val") ?: return true
        return value.lowercase() !in setOf("0", "false", "off")
    }

    private fun drawingImage(drawing: Element, files: Map<String, ByteArray>, relationships: Map<String, String>): Pair<ByteArray, Double>? {
        val blip = drawing.first("blip") ?: return null
        val relId = blip.attrNs("embed") ?: return null
        val path = relationships[relId] ?: return null
        val data = files[path] ?: return null
        val extent = drawing.first("extent")
        val width = extent?.attr("cx")?.toDoubleOrNull() ?: 0.0
        val height = extent?.attr("cy")?.toDoubleOrNull() ?: 0.0
        return data to if (height > 0) width / height else 1.0
    }

    // Tables

    private fun tableBlock(tbl: Element): DocxBlock {
        // Widths are in twentieths of a point (dxa).
        val widths = (tbl.first("tblGrid")?.children("gridCol") ?: emptyList())
            .map { (it.attr("w:w")?.toDoubleOrNull() ?: 0.0) / 20 }
        val rows = tbl.children("tr").map { row ->
            row.children("tc").map { cell -> cell.children("p").map(::textRuns) }
        }
        return DocxBlock.Table(rows, widths)
    }

    // Styles and numbering

    /** What a paragraph style itself sets: a heading's outline level, or the numbering it puts every paragraph
     * using it into (both are usually set on the built-in "Heading n" and "List Bullet"/"List Number" styles
     * rather than repeated on each paragraph). */
    private class StyleInfo {
        val headingLevels = mutableMapOf<String, Int>()
        val listNumbering = mutableMapOf<String, Pair<String, Int>>()
    }

    private fun parseStyles(data: ByteArray?): StyleInfo {
        val info = StyleInfo()
        val root = data?.let(::parse) ?: return info
        for (style in root.all("style")) {
            if (style.attr("w:type") != "paragraph") continue
            val id = style.attr("w:styleId") ?: continue
            val pPr = style.child("pPr")
            pPr?.child("outlineLvl")?.attr("w:val")?.toIntOrNull()?.let { info.headingLevels[id] = it }
            val numPr = pPr?.child("numPr")
            val numId = numPr?.child("numId")?.attr("w:val")
            if (!numId.isNullOrEmpty()) {
                info.listNumbering[id] = numId to (numPr.child("ilvl")?.attr("w:val")?.toIntOrNull() ?: 0)
            }
        }
        return info
    }

    /** Whether a list numbers its items or only bullets them, from `word/numbering.xml`'s abstract formats. */
    private class NumberingFormats(data: ByteArray?) {
        private val byNumId: Map<String, Map<Int, Boolean>>

        init {
            val root = data?.let(::parse)
            val byAbstractId = mutableMapOf<String, Map<Int, Boolean>>()
            if (root != null) {
                for (abstractNum in root.all("abstractNum")) {
                    val id = abstractNum.attr("w:abstractNumId") ?: continue
                    val levels = mutableMapOf<Int, Boolean>()
                    for (lvl in abstractNum.children("lvl")) {
                        val level = lvl.attr("w:ilvl")?.toIntOrNull() ?: continue
                        val format = lvl.child("numFmt")?.attr("w:val") ?: "bullet"
                        levels[level] = format != "bullet" && format != "none"
                    }
                    byAbstractId[id] = levels
                }
            }
            byNumId = if (root == null) {
                emptyMap()
            } else {
                root.all("num").mapNotNull { num ->
                    val numId = num.attr("w:numId") ?: return@mapNotNull null
                    val abstractId = num.child("abstractNumId")?.attr("w:val") ?: return@mapNotNull null
                    val levels = byAbstractId[abstractId] ?: return@mapNotNull null
                    numId to levels
                }.toMap()
            }
        }

        fun isOrdered(numId: String, level: Int): Boolean = byNumId[numId]?.get(level) ?: byNumId[numId]?.get(0) ?: false
    }

    /** The running number of each numbered list; a level starting again resets the levels below it, like Word's
     * own nested lists. */
    private class ListCounters {
        private val counts = mutableMapOf<String, MutableMap<Int, Int>>()

        fun next(numId: String, level: Int): Int {
            val levels = counts.getOrPut(numId) { mutableMapOf() }
            val value = (levels[level] ?: 0) + 1
            levels[level] = value
            levels.keys.filter { it > level }.forEach { levels[it] = 0 }
            return value
        }
    }
}
