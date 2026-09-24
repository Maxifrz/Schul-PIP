package de.maxifrz.lernwerk.present

import org.w3c.dom.Element
import java.io.ByteArrayInputStream
import java.util.UUID
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * Reads an existing PowerPoint file into free slide elements: text boxes and placeholders (positions and sizes
 * inherited from layout and master), shapes, lines and arrows, pictures, groups, tables as text, backgrounds and
 * speaker notes. Charts, SmartArt, animations and vector pictures are left out. Slides of any size are fitted into
 * 960 × 540 pt.
 */
object PptxReader {
    class Imported(val presentation: Presentation, val media: Map<String, ByteArray>, val skipped: Int)

    private const val EMU_PER_POINT = 12700f

    fun read(bytes: ByteArray, title: String): Imported {
        val files = unzip(bytes)
        val presentationXml = files["ppt/presentation.xml"]?.let(::parse) ?: error("Keine PowerPoint-Datei")
        val size = presentationXml.first("sldSz")
        val widthPt = (size?.attr("cx")?.toFloatOrNull() ?: 9144000f) / EMU_PER_POINT
        val heightPt = (size?.attr("cy")?.toFloatOrNull() ?: 6858000f) / EMU_PER_POINT
        val scale = min(SlideSize.WIDTH / widthPt, SlideSize.HEIGHT / heightPt)
        val context = Context(
            files = files,
            scale = scale,
            offsetX = (SlideSize.WIDTH - widthPt * scale) / 2,
            offsetY = (SlideSize.HEIGHT - heightPt * scale) / 2,
        )
        val presentationRels = relationships(files, "ppt/presentation.xml")
        val slidePaths = presentationXml.all("sldId").mapNotNull { presentationRels[it.attrNs("id")] }

        val slides = slidePaths.mapNotNull { path -> files[path]?.let { context.readSlide(path) } }
        val dark = slides.firstOrNull()?.background?.let { luminance(it) < 0.4 } ?: false
        return Imported(
            Presentation(
                title = title,
                themeId = if (dark) SlideTheme.NIGHT.id else SlideTheme.PAPER.id,
                slides = slides.ifEmpty { listOf(Slide()) },
            ),
            context.media,
            context.skipped,
        )
    }

    // Package helpers

    private fun unzip(bytes: ByteArray): Map<String, ByteArray> {
        val files = mutableMapOf<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                if (!entry.isDirectory) files[entry.name.trimStart('/')] = zip.readBytes()
            }
        }
        return files
    }

    private fun parse(bytes: ByteArray): Element? = runCatching {
        val factory = DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = true
            // Office files never need external entities; refusing them keeps the parser safe.
            setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        }
        factory.newDocumentBuilder().parse(ByteArrayInputStream(bytes)).documentElement
    }.getOrNull()

    /** Relationship ids of a part mapped to resolved package paths. */
    private fun relationships(files: Map<String, ByteArray>, part: String): Map<String, String> {
        val folder = part.substringBeforeLast('/', "")
        val relsPath = "$folder/_rels/${part.substringAfterLast('/')}.rels".trimStart('/')
        val root = files[relsPath]?.let(::parse) ?: return emptyMap()
        return root.all("Relationship").associate { rel ->
            val target = rel.attr("Target").orEmpty()
            rel.attr("Id").orEmpty() to if (rel.attr("TargetMode") == "External") "" else resolve(folder, target)
        }
    }

    private fun resolve(folder: String, target: String): String {
        if (target.startsWith("/")) return target.trimStart('/')
        val parts = if (folder.isEmpty()) mutableListOf() else folder.split('/').toMutableList()
        for (piece in target.split('/')) {
            when (piece) {
                ".." -> if (parts.isNotEmpty()) parts.removeAt(parts.lastIndex)
                ".", "" -> Unit
                else -> parts += piece
            }
        }
        return parts.joinToString("/")
    }

    // XML helpers (namespace-agnostic by local name)

    private fun Element.children(name: String? = null): List<Element> {
        val result = mutableListOf<Element>()
        var node = firstChild
        while (node != null) {
            if (node is Element && (name == null || node.localName == name)) result += node
            node = node.nextSibling
        }
        return result
    }

    private fun Element.child(name: String): Element? = children(name).firstOrNull()

    private fun Element.path(vararg names: String): Element? {
        var current: Element? = this
        for (name in names) current = current?.child(name)
        return current
    }

    private fun Element.first(name: String): Element? {
        if (localName == name) return this
        val list = getElementsByTagNameNS("*", name)
        return if (list.length > 0) list.item(0) as Element else null
    }

    private fun Element.all(name: String): List<Element> {
        val list = getElementsByTagNameNS("*", name)
        return (0 until list.length).map { list.item(it) as Element }
    }

    private fun Element.attr(name: String): String? = if (hasAttribute(name)) getAttribute(name) else null

    /** An attribute in the relationships namespace, like r:id or r:embed. */
    private fun Element.attrNs(name: String): String? {
        val attributes = attributes
        for (i in 0 until attributes.length) {
            val attribute = attributes.item(i)
            if (attribute.localName == name && attribute.namespaceURI?.contains("relationships") == true) return attribute.nodeValue
        }
        return attr(name)
    }

    // Colors

    private fun luminance(hex: String): Double {
        val value = hex.removePrefix("#").toLongOrNull(16) ?: return 1.0
        val r = ((value shr 16) and 0xFF) / 255.0
        val g = ((value shr 8) and 0xFF) / 255.0
        val b = (value and 0xFF) / 255.0
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    private class Transform(val a: Float = 1f, val d: Float = 1f, val tx: Float = 0f, val ty: Float = 0f) {
        fun x(value: Float) = value * a + tx
        fun y(value: Float) = value * d + ty

        /** Maps a group's child coordinate space into this one. */
        fun group(off: Pair<Float, Float>, ext: Pair<Float, Float>, chOff: Pair<Float, Float>, chExt: Pair<Float, Float>): Transform {
            val sx = if (chExt.first != 0f) ext.first / chExt.first else 1f
            val sy = if (chExt.second != 0f) ext.second / chExt.second else 1f
            return Transform(a * sx, d * sy, x(off.first - chOff.first * sx), y(off.second - chOff.second * sy))
        }
    }

    private class Placeholder(val type: String, val idx: String?)

    private class Context(val files: Map<String, ByteArray>, val scale: Float, val offsetX: Float, val offsetY: Float) {
        /** New media file name -> bytes, for the caller to store. */
        val media = mutableMapOf<String, ByteArray>()
        private val mediaNames = mutableMapOf<String, String>()
        var skipped = 0

        private var colors: Map<String, String> = emptyMap()
        private var layout: Element? = null
        private var master: Element? = null
        private var rels: Map<String, String> = emptyMap()
        private var background: String = "#FFFFFF"

        fun readSlide(path: String): Slide? {
            val root = files[path]?.let(::parse) ?: return null
            rels = relationships(files, path)
            val layoutPath = rels.values.firstOrNull { it.contains("slideLayouts/") }
            layout = layoutPath?.let { files[it] }?.let(::parse)
            val layoutRels = layoutPath?.let { relationships(files, it) }.orEmpty()
            val masterPath = layoutRels.values.firstOrNull { p -> p.contains("slideMasters/") }
            master = masterPath?.let { files[it] }?.let(::parse)
            val masterRels = masterPath?.let { relationships(files, it) }.orEmpty()
            colors = masterPath?.let { relationships(files, it).values.firstOrNull { p -> p.contains("theme/") } }
                ?.let { files[it] }?.let(::parse)?.let(::themeColors).orEmpty()

            background = listOfNotNull(root, layout, master).firstNotNullOfOrNull { backgroundColor(it) } ?: "#FFFFFF"
            val elements = mutableListOf<SlideElement>()
            // A picture background becomes the lowest element.
            listOf(root to rels, layout to layoutRels, master to masterRels)
                .firstOrNull { (part, _) -> part?.path("cSld", "bg") != null }
                ?.let { (part, partRels) -> part?.path("cSld", "bg", "bgPr", "blipFill", "blip")?.attrNs("embed")?.let { partRels[it] } }
                ?.let { picture(it) }
                ?.let { name -> elements += SlideElement(kind = ElementKind.IMAGE, x = 0f, y = 0f, width = SlideSize.WIDTH, height = SlideSize.HEIGHT, image = name) }
            root.path("cSld", "spTree")?.let { tree -> readTree(tree, Transform(), elements) }

            val notes = rels.values.firstOrNull { it.contains("notesSlides/") }?.let { files[it] }?.let(::parse)?.let(::notesText).orEmpty()
            return Slide(elements = elements, notes = notes, background = background)
        }

        private fun themeColors(theme: Element): Map<String, String> {
            val scheme = theme.first("clrScheme") ?: return emptyMap()
            return scheme.children().associate { entry ->
                val color = entry.child("srgbClr")?.attr("val") ?: entry.child("sysClr")?.attr("lastClr") ?: "000000"
                entry.localName to "#${color.uppercase()}"
            }
        }

        private fun backgroundColor(root: Element): String? {
            val bg = root.path("cSld", "bg") ?: return null
            bg.path("bgPr", "solidFill")?.let { color(it) }?.let { return it }
            bg.child("bgRef")?.let { color(it) }?.let { return it }
            bg.path("bgPr", "gradFill", "gsLst")?.children("gs")?.firstOrNull()?.let { color(it) }?.let { return it }
            return null
        }

        /** Resolves the color child of a fill-like element, including theme colors and lumMod/lumOff. */
        fun color(parent: Element): String? {
            val node = parent.children().firstOrNull { it.localName in setOf("srgbClr", "schemeClr", "sysClr", "prstClr") } ?: return null
            var hex = when (node.localName) {
                "srgbClr" -> node.attr("val")?.let { "#${it.uppercase()}" }
                "sysClr" -> node.attr("lastClr")?.let { "#${it.uppercase()}" }
                "prstClr" -> if (node.attr("val") == "white") "#FFFFFF" else "#000000"
                else -> {
                    val key = when (val value = node.attr("val")) {
                        "tx1" -> "dk1"
                        "bg1" -> "lt1"
                        "tx2" -> "dk2"
                        "bg2" -> "lt2"
                        else -> value
                    }
                    colors[key]
                }
            } ?: return null
            val lumMod = node.child("lumMod")?.attr("val")?.toFloatOrNull()?.div(100000f)
            val lumOff = node.child("lumOff")?.attr("val")?.toFloatOrNull()?.div(100000f)
            if (lumMod != null || lumOff != null) hex = adjustLuminance(hex, lumMod ?: 1f, lumOff ?: 0f)
            return hex
        }

        private fun adjustLuminance(hex: String, mod: Float, off: Float): String {
            val value = hex.removePrefix("#").toLongOrNull(16) ?: return hex
            val hsl = FloatArray(3)
            val r = ((value shr 16) and 0xFF) / 255f
            val g = ((value shr 8) and 0xFF) / 255f
            val b = (value and 0xFF) / 255f
            val maxC = max(r, max(g, b))
            val minC = min(r, min(g, b))
            var l = (maxC + minC) / 2
            val delta = maxC - minC
            val s = if (delta == 0f) 0f else delta / (1 - abs(2 * l - 1))
            var h = when {
                delta == 0f -> 0f
                maxC == r -> 60 * (((g - b) / delta) % 6)
                maxC == g -> 60 * ((b - r) / delta + 2)
                else -> 60 * ((r - g) / delta + 4)
            }
            if (h < 0) h += 360
            hsl[0] = h
            l = (l * mod + off).coerceIn(0f, 1f)
            val c = (1 - abs(2 * l - 1)) * s
            val x = c * (1 - abs((h / 60) % 2 - 1))
            val m = l - c / 2
            val (r1, g1, b1) = when {
                h < 60 -> Triple(c, x, 0f)
                h < 120 -> Triple(x, c, 0f)
                h < 180 -> Triple(0f, c, x)
                h < 240 -> Triple(0f, x, c)
                h < 300 -> Triple(x, 0f, c)
                else -> Triple(c, 0f, x)
            }
            fun channel(v: Float) = ((v + m) * 255).toInt().coerceIn(0, 255)
            return String.format("#%02X%02X%02X", channel(r1), channel(g1), channel(b1))
        }

        private fun notesText(root: Element): String {
            val body = root.all("sp").firstOrNull { sp -> sp.first("ph")?.attr("type") == "body" } ?: return ""
            return paragraphs(body.child("txBody") ?: return "").joinToString("\n") { it.text }.trim()
        }

        // Shapes

        private fun readTree(tree: Element, transform: Transform, out: MutableList<SlideElement>) {
            for (node in tree.children()) {
                when (node.localName) {
                    "sp" -> readShape(node, transform, out)
                    "pic" -> readPicture(node, transform, out)
                    "cxnSp" -> readLine(node, transform, out)
                    "grpSp" -> {
                        val xfrm = node.path("grpSpPr", "xfrm")
                        val child = if (xfrm == null) transform else transform.group(
                            point(xfrm.child("off")), extent(xfrm.child("ext")), point(xfrm.child("chOff")), extent(xfrm.child("chExt")),
                        )
                        readTree(node, child, out)
                    }
                    "graphicFrame" -> readFrame(node, transform, out)
                    "AlternateContent" -> node.child("Fallback")?.let { readTree(it, transform, out) }
                }
            }
        }

        private fun point(node: Element?) = (node?.attr("x")?.toFloatOrNull() ?: 0f) to (node?.attr("y")?.toFloatOrNull() ?: 0f)

        private fun extent(node: Element?) = (node?.attr("cx")?.toFloatOrNull() ?: 0f) to (node?.attr("cy")?.toFloatOrNull() ?: 0f)

        private class Frame(val x: Float, val y: Float, val width: Float, val height: Float, val rotation: Float, val flipH: Boolean, val flipV: Boolean)

        /** A frame in slide points from an a:xfrm (or p:xfrm) in EMU. */
        private fun frame(xfrm: Element?, transform: Transform): Frame? {
            xfrm ?: return null
            val (ox, oy) = point(xfrm.child("off"))
            val (cx, cy) = extent(xfrm.child("ext"))
            val left = transform.x(ox)
            val top = transform.y(oy)
            val right = transform.x(ox + cx)
            val bottom = transform.y(oy + cy)
            return Frame(
                x = offsetX + left / EMU_PER_POINT * scale,
                y = offsetY + top / EMU_PER_POINT * scale,
                width = (right - left) / EMU_PER_POINT * scale,
                height = (bottom - top) / EMU_PER_POINT * scale,
                rotation = (xfrm.attr("rot")?.toFloatOrNull() ?: 0f) / 60000f,
                flipH = xfrm.attr("flipH") == "1",
                flipV = xfrm.attr("flipV") == "1",
            )
        }

        private fun placeholder(sp: Element): Placeholder? {
            val ph = sp.path("nvSpPr", "nvPr", "ph") ?: return null
            return Placeholder(ph.attr("type") ?: "body", ph.attr("idx"))
        }

        /** The matching placeholder shape in the layout, then in the master. */
        private fun inherited(ph: Placeholder): List<Element> {
            fun matches(candidate: Element, byIndex: Boolean): Boolean {
                val other = candidate.path("nvSpPr", "nvPr", "ph") ?: return false
                val type = other.attr("type") ?: "body"
                return if (byIndex) ph.idx != null && other.attr("idx") == ph.idx else family(type) == family(ph.type)
            }
            val result = mutableListOf<Element>()
            layout?.path("cSld", "spTree")?.children("sp")?.let { shapes ->
                (shapes.firstOrNull { matches(it, true) } ?: shapes.firstOrNull { matches(it, false) })?.let(result::add)
            }
            master?.path("cSld", "spTree")?.children("sp")?.firstOrNull { matches(it, false) }?.let(result::add)
            return result
        }

        private fun family(type: String) = when (type) {
            "title", "ctrTitle" -> "title"
            "body", "subTitle", "obj" -> "body"
            else -> type
        }

        private fun readShape(sp: Element, transform: Transform, out: MutableList<SlideElement>) {
            val ph = placeholder(sp)
            val parents = ph?.let(::inherited).orEmpty()
            val xfrm = sp.path("spPr", "xfrm") ?: parents.firstNotNullOfOrNull { it.path("spPr", "xfrm") }
            val frame = frame(xfrm, if (sp.path("spPr", "xfrm") != null) transform else Transform()) ?: return
            val geometry = sp.path("spPr", "prstGeom")?.attr("prst")
            if (geometry == "line" || geometry?.contains("Connector") == true) {
                lineElement(sp.child("spPr"), sp.child("style"), frame)?.let(out::add)
                return
            }

            val spPr = sp.child("spPr")
            val fill = when {
                spPr?.child("noFill") != null -> null
                spPr?.child("solidFill") != null -> color(spPr.child("solidFill")!!)
                spPr?.child("gradFill") != null -> spPr.path("gradFill", "gsLst")?.children("gs")?.firstOrNull()?.let { color(it) }
                else -> sp.path("style", "fillRef")?.takeIf { (it.attr("idx")?.toIntOrNull() ?: 0) > 0 }?.let { color(it) }
            }
            val ln = spPr?.child("ln")
            val stroke = when {
                ln?.child("noFill") != null -> null
                ln?.child("solidFill") != null -> color(ln.child("solidFill")!!)
                ln == null && sp.child("style") != null && fill != null -> sp.path("style", "lnRef")?.takeIf { (it.attr("idx")?.toIntOrNull() ?: 0) > 0 }?.let { color(it) }
                else -> null
            }
            val strokeWidth = (ln?.attr("w")?.toFloatOrNull()?.div(EMU_PER_POINT) ?: 1f) * scale
            if (fill != null || stroke != null) {
                val custom = sp.path("spPr", "custGeom") != null
                if (custom) skipped++
                out += SlideElement(
                    kind = ElementKind.SHAPE, x = frame.x, y = frame.y, width = frame.width, height = frame.height, rotation = frame.rotation,
                    shape = when (geometry) {
                        "ellipse" -> ShapeType.ELLIPSE
                        "roundRect", "round2SameRect", "snipRoundRect" -> ShapeType.ROUNDED
                        else -> ShapeType.RECT
                    },
                    fill = fill ?: "none", stroke = stroke ?: "none", strokeWidth = if (stroke != null) strokeWidth else 0f,
                )
            }
            val body = sp.child("txBody") ?: return
            val lines = paragraphs(body)
            if (lines.all { it.text.isBlank() }) return
            val textColorFallback = sp.path("style", "fontRef")?.let { color(it) }
            out += textElement(body, lines, frame, ph, parents, textColorFallback, fill)
        }

        private class Line(val text: String, val level: Int, val bullet: Boolean?, val size: Float?, val bold: Boolean, val italic: Boolean, val color: String?, val align: String?)

        private fun paragraphs(body: Element): List<Line> = body.children("p").map { p ->
            val pPr = p.child("pPr")
            val text = buildString {
                for (node in p.children()) {
                    when (node.localName) {
                        "r", "fld" -> append(node.child("t")?.textContent.orEmpty())
                        "br" -> append(" ")
                    }
                }
            }
            val runProps = p.children("r").firstOrNull { !it.child("t")?.textContent.isNullOrBlank() }?.child("rPr")
                ?: p.child("endParaRPr")
            val bullet = when {
                pPr?.child("buNone") != null -> false
                pPr?.child("buChar") != null || pPr?.child("buAutoNum") != null -> true
                else -> null
            }
            Line(
                text = text,
                level = pPr?.attr("lvl")?.toIntOrNull() ?: 0,
                bullet = bullet,
                size = runProps?.attr("sz")?.toFloatOrNull()?.div(100f),
                bold = runProps?.attr("b") == "1",
                italic = runProps?.attr("i") == "1",
                color = runProps?.child("solidFill")?.let { color(it) },
                align = pPr?.attr("algn"),
            )
        }

        private fun textElement(
            body: Element,
            lines: List<Line>,
            frame: Frame,
            ph: Placeholder?,
            parents: List<Element>,
            fallbackColor: String?,
            fill: String?,
        ): SlideElement {
            val titleLike = ph != null && family(ph.type) == "title"
            val bodyLike = ph != null && family(ph.type) == "body"
            val parentBodies = parents.mapNotNull { it.child("txBody") }
            // Size: the run, the placeholder's list style, the master's text styles, then a sensible default.
            val inheritedSize = parentBodies.firstNotNullOfOrNull { it.path("lstStyle", "lvl1pPr", "defRPr")?.attr("sz")?.toFloatOrNull()?.div(100f) }
                ?: master?.path("txStyles", if (titleLike) "titleStyle" else if (bodyLike) "bodyStyle" else "otherStyle", "lvl1pPr", "defRPr")
                    ?.attr("sz")?.toFloatOrNull()?.div(100f)
                ?: if (titleLike) 44f else 18f
            val fontScale = body.path("bodyPr", "normAutofit")?.attr("fontScale")?.toFloatOrNull()?.div(100000f) ?: 1f
            val first = lines.firstOrNull { it.text.isNotBlank() }
            val size = (first?.size ?: inheritedSize) * fontScale * scale
            val styleName = if (titleLike) "titleStyle" else if (bodyLike) "bodyStyle" else "otherStyle"
            val masterLevel = master?.path("txStyles", styleName, "lvl1pPr")
            val placeholderLevel = parentBodies.firstNotNullOfOrNull { it.path("lstStyle", "lvl1pPr") }
            val inheritedBullets = bodyLike && ph?.type != "subTitle" && placeholderLevel?.child("buNone") == null &&
                (placeholderLevel?.child("buChar") != null || masterLevel?.child("buChar") != null)
            val bullets = lines.any { it.bullet == true } || (inheritedBullets && lines.none { it.bullet == false })
            val text = lines.joinToString("\n") { line -> (if (line.level > 0) "– " else "") + line.text }.trim('\n')

            val anchor = body.child("bodyPr")?.attr("anchor")
                ?: parentBodies.firstNotNullOfOrNull { it.child("bodyPr")?.attr("anchor") }
            val align = first?.align ?: parentBodies.firstNotNullOfOrNull { it.path("lstStyle", "lvl1pPr")?.attr("algn") }
                ?: masterLevel?.attr("algn")
            // Text color: the run, the shape style, then whatever reads on the fill or the slide.
            val backdrop = fill ?: background
            val color = first?.color ?: fallbackColor ?: if (luminance(backdrop) < 0.45) colors["lt1"] ?: "#FFFFFF" else colors["dk1"] ?: "#000000"

            val bodyPr = body.child("bodyPr")
            val left = (bodyPr?.attr("lIns")?.toFloatOrNull() ?: 91440f) / EMU_PER_POINT * scale
            val top = (bodyPr?.attr("tIns")?.toFloatOrNull() ?: 45720f) / EMU_PER_POINT * scale
            val right = (bodyPr?.attr("rIns")?.toFloatOrNull() ?: 91440f) / EMU_PER_POINT * scale
            val bottom = (bodyPr?.attr("bIns")?.toFloatOrNull() ?: 45720f) / EMU_PER_POINT * scale
            val noWrap = bodyPr?.attr("wrap") == "none"
            return SlideElement(
                kind = ElementKind.TEXT,
                x = frame.x + left,
                y = frame.y + top,
                width = max(20f, frame.width - left - right + if (noWrap) frame.width else 0f),
                height = max(10f, frame.height - top - bottom),
                rotation = frame.rotation,
                text = text,
                fontSize = size.coerceIn(6f, 160f),
                bold = first?.bold ?: false,
                italic = first?.italic ?: false,
                align = when (align) {
                    "ctr" -> TextAlign.CENTER
                    "r" -> TextAlign.RIGHT
                    else -> TextAlign.LEFT
                },
                anchor = when (anchor) {
                    "ctr" -> TextAnchor.MIDDLE
                    "b" -> TextAnchor.BOTTOM
                    else -> TextAnchor.TOP
                },
                bullets = bullets,
                textColor = color,
            ).let { element ->
                // Unwrapped text boxes grow around their anchor; keep them where PowerPoint shows them.
                if (noWrap && element.align == TextAlign.CENTER) element.copy(x = element.x - frame.width / 2) else element
            }
        }

        private fun lineElement(spPr: Element?, style: Element?, frame: Frame): SlideElement? {
            val ln = spPr?.child("ln")
            if (ln?.child("noFill") != null) return null
            val color = ln?.child("solidFill")?.let { color(it) } ?: style?.child("lnRef")?.let { color(it) } ?: colors["dk1"] ?: "#000000"
            val width = (ln?.attr("w")?.toFloatOrNull()?.div(EMU_PER_POINT) ?: 1f) * scale
            val head = ln?.child("headEnd")?.attr("type")?.takeIf { it != "none" }
            val tail = ln?.child("tailEnd")?.attr("type")?.takeIf { it != "none" }
            // Unrotated endpoints with flips, then the frame's rotation around its center.
            var sx = if (frame.flipH) frame.x + frame.width else frame.x
            var sy = if (frame.flipV) frame.y + frame.height else frame.y
            var ex = if (frame.flipH) frame.x else frame.x + frame.width
            var ey = if (frame.flipV) frame.y else frame.y + frame.height
            if (frame.rotation != 0f) {
                val cx = frame.x + frame.width / 2
                val cy = frame.y + frame.height / 2
                val r = Math.toRadians(frame.rotation.toDouble())
                fun rotate(px: Float, py: Float): Pair<Float, Float> {
                    val dx = px - cx
                    val dy = py - cy
                    return (cx + dx * kotlin.math.cos(r) - dy * kotlin.math.sin(r)).toFloat() to (cy + dx * kotlin.math.sin(r) + dy * kotlin.math.cos(r)).toFloat()
                }
                rotate(sx, sy).let { sx = it.first; sy = it.second }
                rotate(ex, ey).let { ex = it.first; ey = it.second }
            }
            // Our arrows point at the end; an arrow head at the start swaps the ends.
            if (head != null && tail == null) {
                sx = ex.also { ex = sx }
                sy = ey.also { ey = sy }
            }
            val length = max(SlideGeometry.MIN_SIZE, hypot(ex - sx, ey - sy))
            val angle = Math.toDegrees(atan2((ey - sy).toDouble(), (ex - sx).toDouble())).toFloat()
            val thickness = max(width, 1f)
            return SlideElement(
                kind = ElementKind.SHAPE,
                x = (sx + ex) / 2 - length / 2,
                y = (sy + ey) / 2 - 10f,
                width = length,
                height = 20f,
                rotation = angle,
                shape = if (head != null || tail != null) ShapeType.ARROW else ShapeType.LINE,
                fill = color,
                strokeWidth = thickness,
            )
        }

        private fun readLine(node: Element, transform: Transform, out: MutableList<SlideElement>) {
            val frame = frame(node.path("spPr", "xfrm"), transform) ?: return
            lineElement(node.child("spPr"), node.child("style"), frame)?.let(out::add)
        }

        private fun readPicture(node: Element, transform: Transform, out: MutableList<SlideElement>) {
            val frame = frame(node.path("spPr", "xfrm"), transform) ?: return
            val id = node.path("blipFill", "blip")?.attrNs("embed") ?: return
            val name = rels[id]?.let { picture(it) }
            if (name == null) {
                skipped++
                return
            }
            out += SlideElement(kind = ElementKind.IMAGE, x = frame.x, y = frame.y, width = frame.width, height = frame.height, rotation = frame.rotation, image = name)
        }

        /** Copies a picture out of the package once; formats the apps cannot draw (EMF, SVG) are left out. */
        fun picture(path: String): String? {
            mediaNames[path]?.let { return it }
            val extension = path.substringAfterLast('.', "").lowercase()
            if (extension !in setOf("png", "jpg", "jpeg", "gif", "bmp", "webp")) return null
            val bytes = files[path] ?: return null
            val name = "${UUID.randomUUID()}.${if (extension == "jpeg") "jpg" else extension}"
            media[name] = bytes
            mediaNames[path] = name
            return name
        }

        private fun readFrame(node: Element, transform: Transform, out: MutableList<SlideElement>) {
            val frame = frame(node.child("xfrm"), transform) ?: return
            val table = node.first("tbl")
            if (table == null) {
                skipped++ // charts, SmartArt, embedded objects
                return
            }
            val rows = table.children("tr").map { row ->
                row.children("tc").joinToString(" | ") { cell -> cell.child("txBody")?.let { paragraphs(it) }?.joinToString(" ") { it.text }.orEmpty().trim() }
            }
            val size = (table.first("tc")?.let { it.child("txBody") }?.let { paragraphs(it) }?.firstOrNull()?.size ?: 18f) * scale
            val backdrop = background
            out += SlideElement(
                kind = ElementKind.TEXT, x = frame.x, y = frame.y, width = frame.width, height = frame.height,
                text = rows.joinToString("\n"), fontSize = size.coerceIn(6f, 60f),
                textColor = if (luminance(backdrop) < 0.45) "#FFFFFF" else colors["dk1"] ?: "#000000",
            )
        }
    }
}
