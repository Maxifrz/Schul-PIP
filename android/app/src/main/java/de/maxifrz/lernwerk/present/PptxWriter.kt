package de.maxifrz.lernwerk.present

import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.math.roundToLong

/**
 * Writes a presentation as a PowerPoint file (Office Open XML). Every element becomes a native shape, text box or
 * picture, so the file stays editable in PowerPoint, Keynote and Google Slides; speaker notes become notes pages.
 */
object PptxWriter {
    private const val EMU_PER_POINT = 12700
    private const val NS =
        """xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" """ +
            """xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" """ +
            """xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main""""
    private const val REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    private const val XML_HEAD = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"""
    const val FONT = "Work Sans"

    /** [media] returns the bytes of an image file referenced by an element, or null if it is missing. */
    fun write(presentation: Presentation, media: (String) -> ByteArray?): ByteArray {
        val theme = presentation.theme
        val files = linkedMapOf<String, ByteArray>()
        fun add(path: String, xml: String) {
            files[path] = xml.toByteArray(Charsets.UTF_8)
        }

        val mediaNames = linkedMapOf<String, String>() // element image name -> part name
        val slideXml = presentation.slides.mapIndexed { index, slide ->
            val number = index + 1
            val relations = mutableListOf(
                Relation("rId1", "$REL/slideLayout", "../slideLayouts/slideLayout1.xml"),
                Relation("rId2", "$REL/notesSlide", "../notesSlides/notesSlide$number.xml"),
            )
            val imageRelations = mutableMapOf<String, String>()
            slide.elements.filter { it.kind == ElementKind.IMAGE && it.image != null }.forEach { element ->
                val name = element.image!!
                if (name in imageRelations) return@forEach
                val bytes = media(name) ?: return@forEach
                val part = mediaNames.getOrPut(name) {
                    val extension = if (isPng(bytes)) "png" else "jpeg"
                    "image${mediaNames.size + 1}.$extension".also { files["ppt/media/$it"] = bytes }
                }
                val id = "rId${relations.size + 1}"
                relations += Relation(id, "$REL/image", "../media/$part")
                imageRelations[name] = id
            }
            add("ppt/slides/_rels/slide$number.xml.rels", relationships(relations))
            add(
                "ppt/notesSlides/notesSlide$number.xml",
                notesSlide(slide.notes),
            )
            add(
                "ppt/notesSlides/_rels/notesSlide$number.xml.rels",
                relationships(
                    listOf(
                        Relation("rId1", "$REL/notesMaster", "../notesMasters/notesMaster1.xml"),
                        Relation("rId2", "$REL/slide", "../slides/slide$number.xml"),
                    ),
                ),
            )
            slide(slide, theme, imageRelations)
        }
        slideXml.forEachIndexed { index, xml -> add("ppt/slides/slide${index + 1}.xml", xml) }

        val count = presentation.slides.size
        add("[Content_Types].xml", contentTypes(count))
        add(
            "_rels/.rels",
            relationships(
                listOf(
                    Relation("rId1", "$REL/officeDocument", "ppt/presentation.xml"),
                    Relation("rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"),
                    Relation("rId3", "$REL/extended-properties", "docProps/app.xml"),
                ),
            ),
        )
        add("docProps/core.xml", core(presentation.title))
        add("docProps/app.xml", app(count))
        add("ppt/presentation.xml", presentationXml(count))
        add(
            "ppt/_rels/presentation.xml.rels",
            relationships(
                listOf(
                    Relation("rId1", "$REL/slideMaster", "slideMasters/slideMaster1.xml"),
                    Relation("rId2", "$REL/notesMaster", "notesMasters/notesMaster1.xml"),
                    Relation("rId3", "$REL/theme", "theme/theme1.xml"),
                    Relation("rId4", "$REL/presProps", "presProps.xml"),
                    Relation("rId5", "$REL/viewProps", "viewProps.xml"),
                    Relation("rId6", "$REL/tableStyles", "tableStyles.xml"),
                ) + (1..count).map { Relation("rId${it + 9}", "$REL/slide", "slides/slide$it.xml") },
            ),
        )
        add("ppt/presProps.xml", "$XML_HEAD<p:presentationPr $NS/>")
        add("ppt/viewProps.xml", "$XML_HEAD<p:viewPr $NS><p:gridSpacing cx=\"76200\" cy=\"76200\"/></p:viewPr>")
        add(
            "ppt/tableStyles.xml",
            "$XML_HEAD<a:tblStyleLst xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" def=\"{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}\"/>",
        )
        add("ppt/slideMasters/slideMaster1.xml", slideMaster(theme))
        add(
            "ppt/slideMasters/_rels/slideMaster1.xml.rels",
            relationships(
                listOf(
                    Relation("rId1", "$REL/slideLayout", "../slideLayouts/slideLayout1.xml"),
                    Relation("rId2", "$REL/theme", "../theme/theme1.xml"),
                ),
            ),
        )
        add("ppt/slideLayouts/slideLayout1.xml", slideLayout())
        add(
            "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
            relationships(listOf(Relation("rId1", "$REL/slideMaster", "../slideMasters/slideMaster1.xml"))),
        )
        add("ppt/theme/theme1.xml", themeXml(theme, "Schul-PIP ${theme.name}"))
        add("ppt/theme/theme2.xml", themeXml(SlideTheme.PAPER, "Schul-PIP Notizen"))
        add("ppt/notesMasters/notesMaster1.xml", notesMaster())
        add(
            "ppt/notesMasters/_rels/notesMaster1.xml.rels",
            relationships(listOf(Relation("rId1", "$REL/theme", "../theme/theme2.xml"))),
        )

        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            // The content types part has to come first for some readers.
            val ordered = listOf("[Content_Types].xml") + files.keys.filter { it != "[Content_Types].xml" }
            for (path in ordered) {
                zip.putNextEntry(ZipEntry(path))
                zip.write(files.getValue(path))
                zip.closeEntry()
            }
        }
        return out.toByteArray()
    }

    private data class Relation(val id: String, val type: String, val target: String)

    private fun relationships(relations: List<Relation>) = buildString {
        append(XML_HEAD)
        append("""<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""")
        relations.forEach { append("""<Relationship Id="${it.id}" Type="${it.type}" Target="${it.target}"/>""") }
        append("</Relationships>")
    }

    private fun contentTypes(slides: Int) = buildString {
        val ml = "application/vnd.openxmlformats-officedocument.presentationml"
        append(XML_HEAD)
        append("""<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">""")
        append("""<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>""")
        append("""<Default Extension="xml" ContentType="application/xml"/>""")
        append("""<Default Extension="png" ContentType="image/png"/>""")
        append("""<Default Extension="jpeg" ContentType="image/jpeg"/>""")
        append("""<Override PartName="/ppt/presentation.xml" ContentType="$ml.presentation.main+xml"/>""")
        append("""<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="$ml.slideMaster+xml"/>""")
        append("""<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="$ml.slideLayout+xml"/>""")
        append("""<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="$ml.notesMaster+xml"/>""")
        append("""<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>""")
        append("""<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>""")
        append("""<Override PartName="/ppt/presProps.xml" ContentType="$ml.presProps+xml"/>""")
        append("""<Override PartName="/ppt/viewProps.xml" ContentType="$ml.viewProps+xml"/>""")
        append("""<Override PartName="/ppt/tableStyles.xml" ContentType="$ml.tableStyles+xml"/>""")
        append("""<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>""")
        append("""<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>""")
        for (i in 1..slides) {
            append("""<Override PartName="/ppt/slides/slide$i.xml" ContentType="$ml.slide+xml"/>""")
            append("""<Override PartName="/ppt/notesSlides/notesSlide$i.xml" ContentType="$ml.notesSlide+xml"/>""")
        }
        append("</Types>")
    }

    private fun core(title: String) = XML_HEAD +
        """<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" """ +
        """xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" """ +
        """xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">""" +
        "<dc:title>${escape(title)}</dc:title><dc:creator>Schul-PIP</dc:creator></cp:coreProperties>"

    private fun app(slides: Int) = XML_HEAD +
        """<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">""" +
        "<Application>Schul-PIP</Application><Slides>$slides</Slides></Properties>"

    private fun presentationXml(slides: Int) = buildString {
        append(XML_HEAD)
        append("""<p:presentation $NS saveSubsetFonts="1">""")
        append("""<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>""")
        append("""<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>""")
        if (slides > 0) {
            append("<p:sldIdLst>")
            for (i in 1..slides) append("""<p:sldId id="${255 + i}" r:id="rId${i + 9}"/>""")
            append("</p:sldIdLst>")
        }
        append("""<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>""")
        append("</p:presentation>")
    }

    private const val EMPTY_TREE =
        """<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>""" +
            """<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>"""
    private const val CLR_MAP =
        """<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" """ +
            """accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>"""

    private fun slideMaster(theme: SlideTheme) = XML_HEAD +
        "<p:sldMaster $NS><p:cSld><p:bg><p:bgPr>${solid(theme.background)}<a:effectLst/></p:bgPr></p:bg>" +
        "<p:spTree>$EMPTY_TREE</p:spTree></p:cSld>$CLR_MAP" +
        """<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>""" +
        "<p:txStyles>" +
        """<p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"><a:latin typeface="$FONT"/></a:defRPr></a:lvl1pPr></p:titleStyle>""" +
        """<p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"><a:latin typeface="$FONT"/></a:defRPr></a:lvl1pPr></p:bodyStyle>""" +
        """<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:latin typeface="$FONT"/></a:defRPr></a:lvl1pPr></p:otherStyle>""" +
        "</p:txStyles></p:sldMaster>"

    private fun slideLayout() = XML_HEAD +
        """<p:sldLayout $NS type="blank" preserve="1"><p:cSld name="Leer"><p:spTree>$EMPTY_TREE</p:spTree></p:cSld>""" +
        "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>"

    private fun notesMaster() = XML_HEAD +
        "<p:notesMaster $NS><p:cSld><p:spTree>$EMPTY_TREE</p:spTree></p:cSld>$CLR_MAP</p:notesMaster>"

    private fun notesSlide(notes: String) = buildString {
        append(XML_HEAD)
        append("<p:notes $NS><p:cSld><p:spTree>$EMPTY_TREE")
        append("""<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notizen"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>""")
        append("""<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>""")
        append("""<p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm></p:spPr>""")
        append("<p:txBody><a:bodyPr/><a:lstStyle/>")
        val lines = notes.trim().lines().ifEmpty { listOf("") }
        lines.forEach { line ->
            if (line.isBlank()) {
                append("""<a:p><a:endParaRPr lang="de-DE"/></a:p>""")
            } else {
                append("""<a:p><a:r><a:rPr lang="de-DE" dirty="0"/><a:t>${escape(line)}</a:t></a:r></a:p>""")
            }
        }
        append("</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>")
    }

    private fun slide(slide: Slide, theme: SlideTheme, images: Map<String, String>) = buildString {
        append(XML_HEAD)
        val background = theme.color(slide.background) ?: theme.background
        append("<p:sld $NS><p:cSld><p:bg><p:bgPr>${solid(background)}<a:effectLst/></p:bgPr></p:bg><p:spTree>$EMPTY_TREE")
        slide.elements.forEachIndexed { index, element ->
            val id = index + 2
            when (element.kind) {
                ElementKind.TEXT -> append(textBox(element, id, theme))
                ElementKind.SHAPE -> append(shape(element, id, theme))
                ElementKind.IMAGE -> images[element.image]?.let { append(picture(element, id, it)) }
            }
        }
        append("</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>")
    }

    private fun emu(points: Float) = (points * EMU_PER_POINT).roundToLong()

    private fun rotation(degrees: Float): String {
        val normalized = ((degrees % 360) + 360) % 360
        val value = (normalized * 60000).roundToLong()
        return if (value == 0L) "" else """ rot="$value""""
    }

    private fun xfrm(x: Float, y: Float, width: Float, height: Float, rotation: Float) =
        """<a:xfrm${rotation(rotation)}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm>"""

    private fun solid(rgb: Long) = """<a:solidFill><a:srgbClr val="${hexColor(rgb)}"/></a:solidFill>"""

    private fun hexColor(rgb: Long) = String.format("%06X", rgb and 0xFFFFFF)

    private fun textBox(element: SlideElement, id: Int, theme: SlideTheme) = buildString {
        val color = theme.color(element.textColor) ?: theme.text
        val anchor = when (element.anchor) {
            TextAnchor.TOP -> "t"
            TextAnchor.MIDDLE -> "ctr"
            TextAnchor.BOTTOM -> "b"
        }
        val align = when (element.align) {
            TextAlign.LEFT -> "l"
            TextAlign.CENTER -> "ctr"
            TextAlign.RIGHT -> "r"
        }
        val size = (element.fontSize * 100).roundToLong()
        val indent = emu(element.fontSize * 1.1f)
        append("""<p:sp><p:nvSpPr><p:cNvPr id="$id" name="Text $id"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>""")
        append("<p:spPr>${xfrm(element.x, element.y, element.width, element.height, element.rotation)}")
        append("""<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>""")
        append("""<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="$anchor"><a:noAutofit/></a:bodyPr><a:lstStyle/>""")
        val runProps = buildString {
            append("""<a:rPr lang="de-DE" sz="$size"""")
            if (element.bold) append(""" b="1"""")
            if (element.italic) append(""" i="1"""")
            append(""" dirty="0">${solid(color)}<a:latin typeface="$FONT"/></a:rPr>""")
        }
        element.text.lines().forEach { line ->
            val bullet = element.bullets && line.isNotBlank()
            append("<a:p>")
            if (bullet) {
                append("""<a:pPr marL="$indent" indent="-$indent" algn="$align"><a:buClr><a:srgbClr val="${hexColor(theme.accent)}"/></a:buClr>""")
                append("""<a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>""")
            } else {
                append("""<a:pPr algn="$align"><a:buNone/></a:pPr>""")
            }
            if (line.isEmpty()) {
                append("""<a:endParaRPr lang="de-DE" sz="$size"/>""")
            } else {
                append("<a:r>$runProps<a:t>${escape(line)}</a:t></a:r>")
            }
            append("</a:p>")
        }
        append("</p:txBody></p:sp>")
    }

    private fun shape(element: SlideElement, id: Int, theme: SlideTheme): String {
        if (element.shape == ShapeType.LINE || element.shape == ShapeType.ARROW) {
            val color = theme.color(element.fill) ?: theme.text
            val width = emu(maxOf(element.strokeWidth, 3f))
            val tail = if (element.shape == ShapeType.ARROW) """<a:tailEnd type="triangle" w="med" len="med"/>""" else ""
            return """<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="$id" name="Linie $id"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>""" +
                "<p:spPr>${xfrm(element.x, element.centerY, element.width, 0f, element.rotation)}" +
                """<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="$width">${solid(color)}$tail</a:ln></p:spPr></p:cxnSp>"""
        }
        val geometry = when (element.shape) {
            ShapeType.ROUNDED -> "roundRect"
            ShapeType.ELLIPSE -> "ellipse"
            else -> "rect"
        }
        val fill = theme.color(element.fill)?.let(::solid) ?: "<a:noFill/>"
        val stroke = theme.color(element.stroke)
        val line = if (stroke == null || element.strokeWidth <= 0f) {
            "<a:ln><a:noFill/></a:ln>"
        } else {
            """<a:ln w="${emu(element.strokeWidth)}">${solid(stroke)}</a:ln>"""
        }
        return """<p:sp><p:nvSpPr><p:cNvPr id="$id" name="Form $id"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>""" +
            "<p:spPr>${xfrm(element.x, element.y, element.width, element.height, element.rotation)}" +
            """<a:prstGeom prst="$geometry"><a:avLst/></a:prstGeom>$fill$line</p:spPr></p:sp>"""
    }

    private fun picture(element: SlideElement, id: Int, relation: String) =
        """<p:pic><p:nvPicPr><p:cNvPr id="$id" name="Bild $id"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>""" +
            """<p:blipFill><a:blip r:embed="$relation"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>""" +
            "<p:spPr>${xfrm(element.x, element.y, element.width, element.height, element.rotation)}" +
            """<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>"""

    private fun themeXml(theme: SlideTheme, name: String): String {
        fun srgb(tag: String, rgb: Long) = "<a:$tag><a:srgbClr val=\"${hexColor(rgb)}\"/></a:$tag>"
        val fillStyle = """<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>"""
        val lineStyle = """<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>"""
        return XML_HEAD +
            """<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${escape(name)}"><a:themeElements>""" +
            """<a:clrScheme name="${escape(name)}">""" +
            srgb("dk1", theme.text) + srgb("lt1", theme.background) + srgb("dk2", theme.muted) + srgb("lt2", theme.surface) +
            srgb("accent1", theme.accent) + srgb("accent2", 0xC9974F) + srgb("accent3", 0x3D6FB6) + srgb("accent4", 0xC46A55) +
            srgb("accent5", 0x6F8FB0) + srgb("accent6", 0x9A968B) + srgb("hlink", 0x4F7A63) + srgb("folHlink", 0x6E6B62) +
            "</a:clrScheme>" +
            """<a:fontScheme name="Schul-PIP"><a:majorFont><a:latin typeface="$FONT"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>""" +
            """<a:minorFont><a:latin typeface="$FONT"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>""" +
            """<a:fmtScheme name="Schul-PIP">""" +
            "<a:fillStyleLst>$fillStyle$fillStyle$fillStyle</a:fillStyleLst>" +
            "<a:lnStyleLst>$lineStyle$lineStyle$lineStyle</a:lnStyleLst>" +
            "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>" +
            "<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>" +
            "<a:bgFillStyleLst>$fillStyle$fillStyle$fillStyle</a:bgFillStyleLst>" +
            "</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>"
    }

    private fun isPng(bytes: ByteArray) = bytes.size > 4 && bytes[0] == 0x89.toByte() && bytes[1] == 'P'.code.toByte()

    /** XML text escaping; control characters other than tab are not allowed in XML 1.0. */
    fun escape(text: String): String = buildString {
        for (c in text) {
            when {
                c == '&' -> append("&amp;")
                c == '<' -> append("&lt;")
                c == '>' -> append("&gt;")
                c == '"' -> append("&quot;")
                c < ' ' && c != '\t' -> Unit
                else -> append(c)
            }
        }
    }
}
