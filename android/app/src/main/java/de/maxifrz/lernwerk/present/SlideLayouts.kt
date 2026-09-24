package de.maxifrz.lernwerk.present

import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.roundToLong

@Serializable
enum class SlideLayout(val label: String) {
    TITLE("Titel"),
    SECTION("Abschnitt"),
    STATEMENT("Aussage"),
    BULLETS("Stichpunkte"),
    IMAGE_TEXT("Bild und Text"),
    IMAGE_FULL("Großes Bild"),
    TWO_COLUMNS("Zwei Spalten"),
    CARDS("Karten"),
    PROCESS("Ablauf"),
    TIMELINE("Zeitstrahl"),
    BIG_NUMBER("Große Zahl"),
    CHART("Diagramm"),
    TABLE("Tabelle"),
    QUOTE("Zitat"),
    BLANK("Leer"),
}

/** One entry of a card grid, process or timeline: a short title (a date on timelines), a line of text, an emoji. */
data class DraftItem(val title: String = "", val text: String = "", val icon: String = "")

enum class ChartKind { BAR, LINE }

/** Numbers for a chart, taken from the material; the app draws it. */
data class ChartDraft(
    val kind: ChartKind = ChartKind.BAR,
    val labels: List<String> = emptyList(),
    val values: List<Double> = emptyList(),
    val unit: String = "",
)

/** The content of a slide before it becomes free elements; what the AI writes and what "new slide" presets use. */
data class SlideDraft(
    val layout: SlideLayout,
    val title: String = "",
    val subtitle: String = "",
    val bullets: List<String> = emptyList(),
    val leftTitle: String = "",
    val left: List<String> = emptyList(),
    val rightTitle: String = "",
    val right: List<String> = emptyList(),
    val quote: String = "",
    val attribution: String = "",
    val items: List<DraftItem> = emptyList(),
    /** The number on a BIG_NUMBER slide, e.g. "70 %". */
    val value: String = "",
    val chart: ChartDraft? = null,
    /** Table rows; the first row is the header. */
    val table: List<List<String>> = emptyList(),
    /** 0-based index into the chosen materials and 1-based page for a picture of that page, if any. */
    val imageMaterial: Int? = null,
    val imagePage: Int? = null,
    val notes: String = "",
    val sourceMaterial: Int? = null,
    val sourcePages: List<Int> = emptyList(),
    /** Ids of the Wikipedia articles (W1, W2 …) the slide's facts come from. */
    val webSources: List<String> = emptyList(),
)

/** A picture for a layout: its media file name and width / height. */
data class PlacedImage(val name: String, val aspect: Float)

/**
 * Turns layouts into freely editable elements; after this a slide is just a list of objects. The design rules live
 * here, not in the prompt: a fixed grid, one heading style, text sized to fit its box, and visual layouts drawn from
 * shapes so they stay editable and export to PowerPoint as native objects. Mirrors the iOS app.
 */
object SlideLayouts {
    private const val MARGIN = 64f
    private const val CONTENT_WIDTH = SlideSize.WIDTH - 2 * MARGIN
    private const val CONTENT_TOP = 150f
    private const val CONTENT_BOTTOM = 490f

    /**
     * Falls back to a layout the content can fill: picture layouts need a picture, charts need numbers, grids need
     * at least two entries. Models get this wrong often enough that every path goes through here. Editor presets
     * keep an empty picture frame as a [placeholder] for the student's own picture.
     */
    fun resolve(draft: SlideDraft, image: PlacedImage?, placeholder: Boolean = false): SlideDraft {
        fun asBullets(lines: List<String>) = if (lines.isEmpty()) {
            draft.copy(layout = if (draft.title.isNotBlank()) SlideLayout.STATEMENT else SlideLayout.BLANK)
        } else {
            draft.copy(layout = SlideLayout.BULLETS, bullets = lines)
        }
        return when (draft.layout) {
            SlideLayout.IMAGE_TEXT, SlideLayout.IMAGE_FULL -> if (image == null && !placeholder) asBullets(draft.bullets) else draft
            SlideLayout.CHART -> {
                val chart = draft.chart
                val count = minOf(chart?.labels?.size ?: 0, chart?.values?.size ?: 0)
                if (chart == null || count < 2) {
                    asBullets(draft.bullets.ifEmpty { chart?.labels.orEmpty().zip(chart?.values.orEmpty()) { l, v -> "$l: ${formatNumber(v)} ${chart?.unit.orEmpty()}".trim() } })
                } else {
                    draft
                }
            }
            SlideLayout.CARDS, SlideLayout.PROCESS, SlideLayout.TIMELINE -> if (draft.items.size < 2) {
                asBullets(draft.bullets.ifEmpty { draft.items.map { listOf(it.title, it.text).filter(String::isNotBlank).joinToString(": ") } })
            } else {
                draft
            }
            SlideLayout.TABLE -> if (draft.table.size < 2 || draft.table.first().isEmpty()) {
                asBullets(draft.bullets.ifEmpty { draft.table.map { it.joinToString(" | ") } })
            } else {
                draft
            }
            SlideLayout.BIG_NUMBER -> if (draft.value.isBlank()) asBullets(draft.bullets) else draft
            else -> draft
        }
    }

    fun build(original: SlideDraft, image: PlacedImage? = null, placeholder: Boolean = false): List<SlideElement> {
        val draft = resolve(original, image, placeholder)
        return when (draft.layout) {
            SlideLayout.TITLE -> listOfNotNull(
                decoration(700f, 290f, 240f),
                decoration(40f, 36f, 90f),
                text(draft.title, 100f, 140f, 760f, 170f, fitSize(draft.title, 760f, 170f, 54f, 34f, bold = true), bold = true, align = TextAlign.CENTER, anchor = TextAnchor.BOTTOM),
                SlideElement(kind = ElementKind.SHAPE, x = 450f, y = 326f, width = 60f, height = 6f, shape = ShapeType.RECT, fill = "accent"),
                draft.subtitle.takeIf { it.isNotBlank() }?.let {
                    text(it, 100f, 350f, 760f, 80f, fitSize(it, 760f, 80f, 24f, 16f), align = TextAlign.CENTER, color = "muted")
                },
            )
            SlideLayout.SECTION -> listOfNotNull(
                decoration(620f, 190f, 320f),
                SlideElement(kind = ElementKind.SHAPE, x = 0f, y = 0f, width = 24f, height = SlideSize.HEIGHT, shape = ShapeType.RECT, fill = "accent"),
                text(draft.title, 96f, 150f, 720f, 150f, fitSize(draft.title, 720f, 150f, 48f, 30f, bold = true), bold = true, anchor = TextAnchor.BOTTOM),
                draft.subtitle.takeIf { it.isNotBlank() }?.let { text(it, 96f, 312f, 720f, 80f, fitSize(it, 720f, 80f, 24f, 16f), color = "muted") },
            )
            SlideLayout.STATEMENT -> listOfNotNull(
                SlideElement(kind = ElementKind.SHAPE, x = MARGIN, y = 150f, width = 8f, height = 200f, shape = ShapeType.RECT, fill = "accent"),
                text(draft.title, 104f, 110f, 760f, 280f, fitSize(draft.title, 760f, 280f, 46f, 28f, bold = true), bold = true, anchor = TextAnchor.MIDDLE),
                draft.subtitle.takeIf { it.isNotBlank() }?.let {
                    text(it, 104f, 400f, 760f, 80f, fitSize(it, 760f, 80f, 22f, 15f), color = "muted")
                },
            )
            SlideLayout.BULLETS -> heading(draft.title) + bulletBox(draft.bullets, MARGIN, CONTENT_TOP, CONTENT_WIDTH, CONTENT_BOTTOM - CONTENT_TOP, 28f)
            SlideLayout.IMAGE_TEXT -> heading(draft.title) + listOfNotNull(
                picture(image, MARGIN, CONTENT_TOP, 420f, CONTENT_BOTTOM - CONTENT_TOP),
                draft.bullets.takeIf { it.isNotEmpty() }?.let { bulletBox(it, 516f, CONTENT_TOP, 380f, CONTENT_BOTTOM - CONTENT_TOP, 24f) },
            )
            SlideLayout.IMAGE_FULL -> heading(draft.title) + listOfNotNull(
                picture(image, MARGIN, 144f, CONTENT_WIDTH, if (draft.subtitle.isBlank()) 360f else 316f),
                draft.subtitle.takeIf { it.isNotBlank() }?.let {
                    text(it, MARGIN, 470f, CONTENT_WIDTH, 44f, fitSize(it, CONTENT_WIDTH, 44f, 18f, 12f), align = TextAlign.CENTER, color = "muted")
                },
            )
            SlideLayout.TWO_COLUMNS -> heading(draft.title) + listOfNotNull(
                SlideElement(kind = ElementKind.SHAPE, x = 479f, y = CONTENT_TOP, width = 2f, height = CONTENT_BOTTOM - CONTENT_TOP, shape = ShapeType.RECT, fill = "surface"),
                draft.leftTitle.takeIf { it.isNotBlank() }?.let { text(it, MARGIN, CONTENT_TOP, 390f, 40f, fitSize(it, 390f, 40f, 24f, 16f, bold = true), bold = true, color = "accent") },
                bulletBox(draft.left, MARGIN, 200f, 390f, 290f, 22f),
                draft.rightTitle.takeIf { it.isNotBlank() }?.let { text(it, 506f, CONTENT_TOP, 390f, 40f, fitSize(it, 390f, 40f, 24f, 16f, bold = true), bold = true, color = "accent") },
                bulletBox(draft.right, 506f, 200f, 390f, 290f, 22f),
            )
            SlideLayout.CARDS -> heading(draft.title) + cards(draft.items.take(4))
            SlideLayout.PROCESS -> heading(draft.title) + process(draft.items.take(5))
            SlideLayout.TIMELINE -> heading(draft.title) + timeline(draft.items.take(6))
            SlideLayout.BIG_NUMBER -> heading(draft.title) + listOfNotNull(
                text(draft.value, MARGIN, 170f, 440f, 240f, fitSize(draft.value, 440f, 240f, 120f, 48f, bold = true), bold = true, anchor = TextAnchor.MIDDLE, color = "accent"),
                SlideElement(kind = ElementKind.SHAPE, x = 528f, y = 200f, width = 4f, height = 180f, shape = ShapeType.RECT, fill = "surface"),
                (draft.subtitle.ifBlank { draft.bullets.joinToString("\n") }).takeIf { it.isNotBlank() }?.let {
                    text(it, 560f, 170f, 336f, 240f, fitSize(it, 336f, 240f, 28f, 16f), anchor = TextAnchor.MIDDLE)
                },
            )
            SlideLayout.CHART -> heading(draft.title) + chart(draft.chart!!, draft.subtitle)
            SlideLayout.TABLE -> heading(draft.title) + table(draft.table)
            SlideLayout.QUOTE -> listOfNotNull(
                text("„", 80f, 40f, 120f, 150f, 130f, bold = true, color = "accent"),
                (draft.quote.ifBlank { draft.title }).let {
                    text(it, 150f, 140f, 680f, 240f, fitSize(it, 680f, 240f, 36f, 22f, italic = true), italic = true, anchor = TextAnchor.MIDDLE)
                },
                draft.attribution.takeIf { it.isNotBlank() }?.let {
                    text("– $it", 150f, 390f, 680f, 40f, 20f, align = TextAlign.RIGHT, color = "muted")
                },
            )
            SlideLayout.BLANK -> emptyList()
        }
    }

    private fun decoration(x: Float, y: Float, size: Float) =
        SlideElement(kind = ElementKind.SHAPE, x = x, y = y, width = size, height = size, shape = ShapeType.ELLIPSE, fill = "surface")

    private fun heading(title: String) = listOf(
        text(title, MARGIN, 30f, CONTENT_WIDTH, 90f, fitSize(title, CONTENT_WIDTH, 90f, 36f, 24f, bold = true), bold = true, anchor = TextAnchor.BOTTOM),
        SlideElement(kind = ElementKind.SHAPE, x = MARGIN, y = 128f, width = 56f, height = 5f, shape = ShapeType.RECT, fill = "accent"),
    )

    private fun bulletBox(lines: List<String>, x: Float, y: Float, w: Float, h: Float, max: Float): SlideElement {
        val value = lines.joinToString("\n")
        return text(value, x, y, w, h, fitSize(value, w, h, max, 14f, bullets = true), bullets = true)
    }

    private fun picture(image: PlacedImage?, x: Float, y: Float, w: Float, h: Float) = if (image != null) {
        // Pictures keep their aspect ratio: fitted into the box and centered.
        val scale = minOf(w, h * image.aspect)
        val fw = scale
        val fh = scale / image.aspect
        SlideElement(kind = ElementKind.IMAGE, x = x + (w - fw) / 2, y = y + (h - fh) / 2, width = fw, height = fh, image = image.name)
    } else {
        SlideElement(kind = ElementKind.SHAPE, x = x, y = y, width = w, height = h, shape = ShapeType.ROUNDED, fill = "surface")
    }

    /** Columns of equal width across the content area. */
    private fun columns(count: Int, gap: Float): List<Pair<Float, Float>> {
        val width = (CONTENT_WIDTH - gap * (count - 1)) / count
        return (0 until count).map { MARGIN + it * (width + gap) to width }
    }

    private fun cards(items: List<DraftItem>): List<SlideElement> = columns(items.size, 24f).zip(items).flatMapIndexed { index, (column, item) ->
        val (x, w) = column
        val icon = icon(item.icon)
        val inner = w - 40f
        listOf(SlideElement(kind = ElementKind.SHAPE, x = x, y = 160f, width = w, height = 320f, shape = ShapeType.ROUNDED, fill = "surface")) +
            (if (icon != null) listOf(text(icon, x + 20f, 180f, inner, 60f, 40f)) else badge("${index + 1}", x + 20f, 186f)) +
            listOfNotNull(
            text(item.title, x + 20f, 252f, inner, 64f, fitSize(item.title, inner, 64f, 24f, 15f, bold = true), bold = true),
            item.text.takeIf { it.isNotBlank() }?.let { text(it, x + 20f, 322f, inner, 144f, fitSize(it, inner, 144f, 21f, 12f), color = "muted") },
        )
    }

    private fun badge(label: String, x: Float, y: Float) = listOf(
        SlideElement(kind = ElementKind.SHAPE, x = x, y = y, width = 44f, height = 44f, shape = ShapeType.ELLIPSE, fill = "accent"),
        text(label, x, y, 44f, 44f, 20f, bold = true, align = TextAlign.CENTER, anchor = TextAnchor.MIDDLE, color = "background"),
    )

    private fun process(items: List<DraftItem>): List<SlideElement> {
        val cols = columns(items.size, 40f)
        return cols.zip(items).flatMapIndexed { index, (column, item) ->
            val (x, w) = column
            val inner = w - 32f
            val arrow = if (index < items.lastIndex) {
                SlideElement(kind = ElementKind.SHAPE, x = x + w + 6f, y = 290f, width = 28f, height = 20f, shape = ShapeType.ARROW, fill = "accent", strokeWidth = 3f)
            } else {
                null
            }
            listOfNotNull(
                SlideElement(kind = ElementKind.SHAPE, x = x, y = 170f, width = w, height = 260f, shape = ShapeType.ROUNDED, fill = "surface"),
            ) + badge("${index + 1}", x + 16f, 186f) + listOfNotNull(
                text(item.title, x + 16f, 244f, inner, 60f, fitSize(item.title, inner, 60f, 21f, 14f, bold = true), bold = true),
                item.text.takeIf { it.isNotBlank() }?.let { text(it, x + 16f, 308f, inner, 110f, fitSize(it, inner, 110f, 19f, 11f), color = "muted") },
                arrow,
            )
        }
    }

    private fun timeline(items: List<DraftItem>): List<SlideElement> {
        val slot = CONTENT_WIDTH / items.size
        val line = SlideElement(kind = ElementKind.SHAPE, x = MARGIN, y = 280f, width = CONTENT_WIDTH, height = 20f, shape = ShapeType.LINE, fill = "muted", strokeWidth = 3f)
        return listOf(line) + items.flatMapIndexed { index, item ->
            val x = MARGIN + index * slot
            val center = x + slot / 2
            val inner = slot - 16f
            listOfNotNull(
                SlideElement(kind = ElementKind.SHAPE, x = center - 11f, y = 279f, width = 22f, height = 22f, shape = ShapeType.ELLIPSE, fill = "accent"),
                text(item.title, x + 8f, 196f, inner, 72f, fitSize(item.title, inner, 72f, 24f, 14f, bold = true), bold = true, align = TextAlign.CENTER, anchor = TextAnchor.BOTTOM, color = "accent"),
                item.text.takeIf { it.isNotBlank() }?.let {
                    text(it, x + 8f, 316f, inner, 170f, fitSize(it, inner, 170f, 18f, 11f), align = TextAlign.CENTER)
                },
            )
        }
    }

    /** A bar or line chart built from shapes, with value and category labels; negative values hang below zero. */
    fun chart(chart: ChartDraft, caption: String = ""): List<SlideElement> {
        val count = minOf(chart.labels.size, chart.values.size, 12)
        val values = chart.values.take(count)
        val labels = chart.labels.take(count)
        val left = MARGIN + 16f
        val right = SlideSize.WIDTH - MARGIN - 16f
        val top = 190f
        val bottom = if (caption.isBlank()) 430f else 410f
        val max = maxOf(0.0, values.max())
        val min = minOf(0.0, values.min())
        val range = (max - min).takeIf { it > 0 } ?: 1.0
        fun y(value: Double) = (bottom - (value - min) / range * (bottom - top)).toFloat()
        val zero = y(0.0)
        val slot = (right - left) / count
        val out = mutableListOf<SlideElement>()
        out += SlideElement(kind = ElementKind.SHAPE, x = left, y = zero - 10f, width = right - left, height = 20f, shape = ShapeType.LINE, fill = "muted", strokeWidth = 2f)
        val points = values.mapIndexed { index, value -> left + slot * index + slot / 2 to y(value) }
        if (chart.kind == ChartKind.BAR) {
            val barWidth = minOf(slot * 0.62f, 110f)
            values.forEachIndexed { index, value ->
                val (center, end) = points[index]
                val height = maxOf(abs(zero - end), 2f)
                out += SlideElement(
                    kind = ElementKind.SHAPE, x = center - barWidth / 2, y = minOf(zero, end), width = barWidth, height = height,
                    shape = ShapeType.RECT, fill = "accent",
                )
            }
        } else {
            points.zipWithNext().forEach { (a, b) ->
                val length = hypot(b.first - a.first, b.second - a.second)
                val angle = Math.toDegrees(atan2((b.second - a.second).toDouble(), (b.first - a.first).toDouble())).toFloat()
                out += SlideElement(
                    kind = ElementKind.SHAPE, x = (a.first + b.first) / 2 - length / 2, y = (a.second + b.second) / 2 - 10f, width = length, height = 20f,
                    rotation = angle, shape = ShapeType.LINE, fill = "accent", strokeWidth = 4f,
                )
            }
            points.forEach { (x, y) ->
                out += SlideElement(kind = ElementKind.SHAPE, x = x - 7f, y = y - 7f, width = 14f, height = 14f, shape = ShapeType.ELLIPSE, fill = "accent")
            }
        }
        val labelSize = fitSize(labels.maxByOrNull { it.length }.orEmpty(), slot - 8f, 40f, 16f, 10f)
        values.forEachIndexed { index, value ->
            val (center, end) = points[index]
            val label = "${formatNumber(value)} ${chart.unit}".trim()
            val above = value >= 0
            out += text(label, center - slot / 2, if (above) end - 32f else end + 6f, slot, 26f, fitSize(label, slot - 4f, 26f, 16f, 10f, bold = true), bold = true, align = TextAlign.CENTER)
            out += text(labels[index], center - slot / 2 + 4f, maxOf(zero, bottom) + 10f, slot - 8f, 40f, labelSize, align = TextAlign.CENTER, color = "muted")
        }
        if (caption.isNotBlank()) {
            out += text(caption, MARGIN, 490f, CONTENT_WIDTH, 30f, fitSize(caption, CONTENT_WIDTH, 30f, 14f, 10f), color = "muted")
        }
        return out
    }

    private fun table(rows: List<List<String>>): List<SlideElement> {
        val shown = rows.take(8)
        val columns = shown.maxOf { it.size }.coerceAtMost(5)
        val rowHeight = minOf(52f, (CONTENT_BOTTOM - CONTENT_TOP) / shown.size)
        val width = CONTENT_WIDTH / columns
        val out = mutableListOf<SlideElement>()
        shown.forEachIndexed { r, row ->
            val y = CONTENT_TOP + r * rowHeight
            val header = r == 0
            if (header || r % 2 == 0) {
                out += SlideElement(kind = ElementKind.SHAPE, x = MARGIN, y = y, width = CONTENT_WIDTH, height = rowHeight, shape = ShapeType.RECT, fill = if (header) "accent" else "surface")
            }
            for (c in 0 until columns) {
                val cell = row.getOrNull(c).orEmpty()
                if (cell.isBlank()) continue
                out += text(
                    cell, MARGIN + c * width + 12f, y, width - 24f, rowHeight,
                    fitSize(cell, width - 24f, rowHeight - 6f, 18f, 10f, bold = header), bold = header, anchor = TextAnchor.MIDDLE,
                    color = if (header) "background" else "text",
                )
            }
        }
        return out
    }

    fun text(
        value: String,
        x: Float,
        y: Float,
        width: Float,
        height: Float,
        size: Float,
        bold: Boolean = false,
        italic: Boolean = false,
        align: TextAlign = TextAlign.LEFT,
        anchor: TextAnchor = TextAnchor.TOP,
        bullets: Boolean = false,
        color: String = "text",
    ) = SlideElement(
        kind = ElementKind.TEXT, x = x, y = y, width = width, height = height, text = value, fontSize = size,
        bold = bold, italic = italic, align = align, anchor = anchor, bullets = bullets, textColor = color,
    )

    /**
     * The largest font size from [max] down to [min] at which the text fits the box, estimated from average glyph
     * widths of Work Sans. Deterministic, so both apps and the export agree without measuring real fonts.
     */
    fun fitSize(value: String, width: Float, height: Float, max: Float, min: Float, bold: Boolean = false, bullets: Boolean = false, italic: Boolean = false): Float {
        var size = max
        while (size > min && !fits(value, width, height, size, bold || italic, bullets)) size -= 1f
        return size
    }

    fun fits(value: String, width: Float, height: Float, size: Float, bold: Boolean, bullets: Boolean): Boolean =
        lineCount(value, width - if (bullets) size * 1.1f else 0f, size, bold) * size * 1.24f <= height

    fun lineCount(value: String, width: Float, size: Float, bold: Boolean): Int {
        val charWidth = size * if (bold) 0.58f else 0.54f
        val perLine = maxOf(1, (width / charWidth).toInt())
        return value.split("\n").sumOf { paragraph ->
            var lines = 1
            var used = 0
            for (word in paragraph.split(" ").filter { it.isNotEmpty() }) {
                val length = word.length
                when {
                    used == 0 -> {
                        lines += (length - 1) / perLine
                        used = (length - 1) % perLine + 1
                    }
                    used + 1 + length <= perLine -> used += 1 + length
                    else -> {
                        lines += 1 + (length - 1) / perLine
                        used = (length - 1) % perLine + 1
                    }
                }
            }
            lines
        }
    }

    /** A single emoji for a card, or null for anything else (the card then shows its number). */
    fun icon(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty() || trimmed.codePointCount(0, trimmed.length) > 4) return null
        val first = trimmed.codePointAt(0)
        return trimmed.takeIf { first >= 0x2190 && !Character.isLetterOrDigit(first) }
    }

    /** German number format: comma decimals, at most two, dots between thousands. */
    fun formatNumber(value: Double): String {
        val rounded = (value * 100).roundToLong()
        val negative = rounded < 0
        val absolute = abs(rounded)
        val whole = (absolute / 100).toString().reversed().chunked(3).joinToString(".").reversed()
        val fraction = (absolute % 100).toString().padStart(2, '0').trimEnd('0')
        return (if (negative) "−" else "") + whole + if (fraction.isEmpty()) "" else ",$fraction"
    }

    /** A slide as the editor's "new slide" menu offers it, with placeholder text to overwrite. */
    fun preset(layout: SlideLayout): Slide = Slide(
        elements = build(
            when (layout) {
                SlideLayout.TITLE -> SlideDraft(layout, title = "Titel der Präsentation", subtitle = "Name · Fach · Datum")
                SlideLayout.SECTION -> SlideDraft(layout, title = "Neuer Abschnitt")
                SlideLayout.STATEMENT -> SlideDraft(layout, title = "Eine Aussage oder Frage, die hängen bleibt.")
                SlideLayout.BULLETS -> SlideDraft(layout, title = "Überschrift", bullets = listOf("Erster Punkt", "Zweiter Punkt", "Dritter Punkt"))
                SlideLayout.IMAGE_TEXT -> SlideDraft(layout, title = "Überschrift", bullets = listOf("Was das Bild zeigt", "Warum es wichtig ist"))
                SlideLayout.IMAGE_FULL -> SlideDraft(layout, title = "Was das Bild zeigt", subtitle = "Bildunterschrift")
                SlideLayout.TWO_COLUMNS -> SlideDraft(
                    layout, title = "Vergleich", leftTitle = "Links", left = listOf("Punkt"), rightTitle = "Rechts", right = listOf("Punkt"),
                )
                SlideLayout.CARDS -> SlideDraft(
                    layout, title = "Drei Aspekte",
                    items = listOf(DraftItem("Erster", "Kurz erklärt"), DraftItem("Zweiter", "Kurz erklärt"), DraftItem("Dritter", "Kurz erklärt")),
                )
                SlideLayout.PROCESS -> SlideDraft(
                    layout, title = "So läuft es ab",
                    items = listOf(DraftItem("Schritt eins", "Was passiert"), DraftItem("Schritt zwei", "Was passiert"), DraftItem("Schritt drei", "Was passiert")),
                )
                SlideLayout.TIMELINE -> SlideDraft(
                    layout, title = "Zeitstrahl",
                    items = listOf(DraftItem("1900", "Ereignis"), DraftItem("1950", "Ereignis"), DraftItem("2000", "Ereignis")),
                )
                SlideLayout.BIG_NUMBER -> SlideDraft(layout, title = "Eine Zahl, die überrascht", value = "42 %", subtitle = "Was die Zahl bedeutet")
                SlideLayout.CHART -> SlideDraft(
                    layout, title = "Diagramm",
                    chart = ChartDraft(ChartKind.BAR, listOf("A", "B", "C"), listOf(3.0, 5.0, 2.0)),
                )
                SlideLayout.TABLE -> SlideDraft(layout, title = "Tabelle", table = listOf(listOf("Merkmal", "A", "B"), listOf("Zeile", "…", "…")))
                SlideLayout.QUOTE -> SlideDraft(layout, quote = "Ein Zitat, das den Kern trifft.", attribution = "Quelle")
                SlideLayout.BLANK -> SlideDraft(layout)
            },
            placeholder = true,
        ),
    )
}
