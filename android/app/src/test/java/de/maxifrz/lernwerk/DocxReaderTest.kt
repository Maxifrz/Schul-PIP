package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.present.DocxBlock
import de.maxifrz.lernwerk.present.DocxReader
import de.maxifrz.lernwerk.present.DocxRun
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.nio.charset.StandardCharsets

/** Faithful to what python-docx and real Word actually write: headings via `outlineLvl` in the style, bold and
 * italic as direct formatting, a bullet list with `numPr` on the paragraph itself, a numbered list whose numbering
 * only the "List Number" style carries, a table with column widths in dxa, and an inline picture. */
class DocxReaderTest {
    private val documentXml = """
        <?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <w:body>
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Überschrift Eins</w:t></w:r></w:p>
        <w:p><w:r><w:t xml:space="preserve">Normaler Text mit </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>fett</w:t></w:r><w:r><w:t xml:space="preserve"> und </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>kursiv</w:t></w:r><w:r><w:t xml:space="preserve">. Ä Ö Ü ä ö ü ß.</w:t></w:r></w:p>
        <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Erstens</w:t></w:r></w:p>
        <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Zweitens</w:t></w:r></w:p>
        <w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r><w:t>Schritt eins</w:t></w:r></w:p>
        <w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r><w:t>Schritt zwei</w:t></w:r></w:p>
        <w:p/>
        <w:tbl><w:tblGrid><w:gridCol w:w="4320"/><w:gridCol w:w="4320"/></w:tblGrid>
        <w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p><w:r><w:t>C</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>D</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>
        <w:p><w:r><w:t xml:space="preserve">Vor dem Bild. </w:t></w:r><w:r><w:drawing><wp:inline><wp:extent cx="1828800" cy="1219200"/><a:graphic><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId9"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
        </w:body>
        </w:document>
    """.trimIndent()

    private val stylesXml = """
        <?xml version="1.0"?>
        <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
        <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
        <w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:pPr><w:numPr><w:numId w:val="5"/></w:numPr></w:pPr></w:style>
        </w:styles>
    """.trimIndent()

    private val numberingXml = """
        <?xml version="1.0"?>
        <w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:abstractNum w:abstractNumId="8"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
        <w:abstractNum w:abstractNumId="7"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
        <w:num w:numId="1"><w:abstractNumId w:val="8"/></w:num>
        <w:num w:numId="5"><w:abstractNumId w:val="7"/></w:num>
        </w:numbering>
    """.trimIndent()

    private val relsXml = """
        <?xml version="1.0"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
        </Relationships>
    """.trimIndent()

    private fun files(withImage: Boolean = true): Map<String, ByteArray> {
        val files = mutableMapOf(
            "word/document.xml" to documentXml.toByteArray(StandardCharsets.UTF_8),
            "word/styles.xml" to stylesXml.toByteArray(StandardCharsets.UTF_8),
            "word/numbering.xml" to numberingXml.toByteArray(StandardCharsets.UTF_8),
            "word/_rels/document.xml.rels" to relsXml.toByteArray(StandardCharsets.UTF_8),
        )
        if (withImage) files["word/media/image1.png"] = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47)
        return files
    }

    @Test
    fun headingsComeFromTheStylesOutlineLevel() {
        val document = DocxReader.parse(files())
        val heading = document.blocks[0] as? DocxBlock.Heading ?: return fail("expected a heading")
        assertEquals(1, heading.level)
        assertEquals(listOf(DocxRun("Überschrift Eins")), heading.runs)
    }

    @Test
    fun boldAndItalicAreKeptPerRunWithGermanCharacters() {
        val document = DocxReader.parse(files())
        val paragraph = document.blocks[1] as? DocxBlock.Paragraph ?: return fail("expected a paragraph")
        assertEquals(
            listOf(
                DocxRun("Normaler Text mit "),
                DocxRun("fett", bold = true),
                DocxRun(" und "),
                DocxRun("kursiv", italic = true),
                DocxRun(". Ä Ö Ü ä ö ü ß."),
            ),
            paragraph.runs,
        )
    }

    @Test
    fun bulletListsComeFromDirectNumPrAndNumberEachItem() {
        val document = DocxReader.parse(files())
        val item1 = document.blocks[2] as? DocxBlock.ListItem ?: return fail("expected a list item")
        val item2 = document.blocks[3] as? DocxBlock.ListItem ?: return fail("expected a list item")
        assertEquals(0, item1.level)
        assertFalse(item1.ordered)
        assertEquals(1, item1.index)
        assertEquals("Erstens", item1.runs.first().text)
        assertEquals(2, item2.index)
        assertEquals("Zweitens", item2.runs.first().text)
    }

    @Test
    fun numberedListsFallBackToTheParagraphStylesNumbering() {
        val document = DocxReader.parse(files())
        val item1 = document.blocks[4] as? DocxBlock.ListItem ?: return fail("expected a numbered item")
        val item2 = document.blocks[5] as? DocxBlock.ListItem ?: return fail("expected a numbered item")
        assertTrue(item1.ordered)
        assertEquals(1, item1.index)
        assertTrue(item2.ordered)
        assertEquals(2, item2.index)
    }

    @Test
    fun anEmptyParagraphStaysAsABlankLine() {
        val document = DocxReader.parse(files())
        val paragraph = document.blocks[6] as? DocxBlock.Paragraph ?: return fail("expected an empty paragraph")
        assertTrue(paragraph.runs.isEmpty())
    }

    @Test
    fun tableRowsKeepTheirCellsAndColumnWidthsInPoints() {
        val document = DocxReader.parse(files())
        val table = document.blocks[7] as? DocxBlock.Table ?: return fail("expected a table")
        assertEquals(listOf(216.0, 216.0), table.columnWidths)
        assertEquals(2, table.rows.size)
        assertEquals(listOf(listOf(DocxRun("A"))), table.rows[0][0])
        assertEquals(listOf(listOf(DocxRun("B"))), table.rows[0][1])
        assertEquals(listOf(listOf(DocxRun("D"))), table.rows[1][1])
    }

    @Test
    fun anInlinePictureIsResolvedThroughTheRelationshipsAndItsTextKeptSeparately() {
        val document = DocxReader.parse(files())
        val paragraph = document.blocks[8] as? DocxBlock.Paragraph ?: return fail("expected a paragraph")
        val picture = document.blocks[9] as? DocxBlock.Picture ?: return fail("expected a picture")
        assertEquals("Vor dem Bild. ", paragraph.runs.first().text)
        assertTrue(picture.data.contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47)))
        assertEquals(1828800.0 / 1219200.0, picture.aspect, 0.001)
    }

    @Test
    fun aMissingImageFileIsSkippedWithoutFailing() {
        val document = DocxReader.parse(files(withImage = false))
        assertNull(document.blocks.firstOrNull { it is DocxBlock.Picture })
    }

    @Test(expected = Exception::class)
    fun openingSomethingThatIsNotADocxThrows() {
        DocxReader.open("not a zip".toByteArray())
    }

    @Test(expected = Exception::class)
    fun parsingFilesWithoutADocumentPartThrows() {
        DocxReader.parse(mapOf("readme.txt" to "hi".toByteArray()))
    }
}
