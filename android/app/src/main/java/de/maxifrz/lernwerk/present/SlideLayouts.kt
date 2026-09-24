package de.maxifrz.lernwerk.present

import kotlinx.serialization.Serializable

@Serializable
enum class SlideLayout(val label: String) {
    TITLE("Titel"),
    SECTION("Abschnitt"),
    BULLETS("Stichpunkte"),
    IMAGE_TEXT("Bild und Text"),
    TWO_COLUMNS("Zwei Spalten"),
    QUOTE("Zitat"),
    BLANK("Leer"),
}

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
    /** 0-based index into the chosen materials and 1-based page for a picture of that page, if any. */
    val imageMaterial: Int? = null,
    val imagePage: Int? = null,
    val notes: String = "",
    val sourceMaterial: Int? = null,
    val sourcePages: List<Int> = emptyList(),
)

/** A picture for a layout: its media file name and width / height. */
data class PlacedImage(val name: String, val aspect: Float)

/** Turns layouts into freely editable elements; after this a slide is just a list of objects. */
object SlideLayouts {
    private const val MARGIN = 64f
    private const val CONTENT_WIDTH = SlideSize.WIDTH - 2 * MARGIN

    fun build(draft: SlideDraft, image: PlacedImage? = null): List<SlideElement> = when (draft.layout) {
        SlideLayout.TITLE -> listOfNotNull(
            text(draft.title, 80f, 150f, 800f, 150f, 52f, bold = true, align = TextAlign.CENTER, anchor = TextAnchor.BOTTOM),
            SlideElement(kind = ElementKind.SHAPE, x = 450f, y = 322f, width = 60f, height = 6f, shape = ShapeType.RECT, fill = "accent"),
            draft.subtitle.takeIf { it.isNotBlank() }?.let {
                text(it, 80f, 348f, 800f, 80f, 24f, align = TextAlign.CENTER, color = "muted")
            },
        )
        SlideLayout.SECTION -> listOfNotNull(
            SlideElement(kind = ElementKind.SHAPE, x = 0f, y = 0f, width = 24f, height = SlideSize.HEIGHT, shape = ShapeType.RECT, fill = "accent"),
            text(draft.title, 96f, 170f, 800f, 130f, 46f, bold = true, anchor = TextAnchor.BOTTOM),
            draft.subtitle.takeIf { it.isNotBlank() }?.let { text(it, 96f, 310f, 800f, 80f, 24f, color = "muted") },
        )
        SlideLayout.BULLETS -> heading(draft.title) + text(
            draft.bullets.joinToString("\n"), MARGIN, 150f, CONTENT_WIDTH, 340f, 26f, bullets = true,
        )
        SlideLayout.IMAGE_TEXT -> heading(draft.title) + listOf(
            imageOrPlaceholder(image, MARGIN, 150f, 400f, 340f),
            text(draft.bullets.joinToString("\n"), 496f, 150f, 400f, 340f, 22f, bullets = true),
        )
        SlideLayout.TWO_COLUMNS -> heading(draft.title) + listOfNotNull(
            draft.leftTitle.takeIf { it.isNotBlank() }?.let { text(it, MARGIN, 150f, 400f, 40f, 22f, bold = true, color = "accent") },
            text(draft.left.joinToString("\n"), MARGIN, 198f, 400f, 300f, 20f, bullets = true),
            draft.rightTitle.takeIf { it.isNotBlank() }?.let { text(it, 496f, 150f, 400f, 40f, 22f, bold = true, color = "accent") },
            text(draft.right.joinToString("\n"), 496f, 198f, 400f, 300f, 20f, bullets = true),
        )
        SlideLayout.QUOTE -> listOfNotNull(
            text("„", 80f, 40f, 120f, 150f, 130f, bold = true, color = "accent"),
            text(draft.quote.ifBlank { draft.title }, 150f, 150f, 680f, 220f, 34f, italic = true, anchor = TextAnchor.MIDDLE),
            draft.attribution.takeIf { it.isNotBlank() }?.let {
                text("– $it", 150f, 390f, 680f, 40f, 20f, align = TextAlign.RIGHT, color = "muted")
            },
        )
        SlideLayout.BLANK -> emptyList()
    }

    private fun heading(title: String) = listOf(
        text(title, MARGIN, 36f, CONTENT_WIDTH, 84f, 36f, bold = true, anchor = TextAnchor.BOTTOM),
        SlideElement(kind = ElementKind.SHAPE, x = MARGIN, y = 128f, width = 56f, height = 5f, shape = ShapeType.RECT, fill = "accent"),
    )

    private fun imageOrPlaceholder(image: PlacedImage?, x: Float, y: Float, w: Float, h: Float) = if (image != null) {
        // Pictures keep their aspect ratio: fitted into the box and centered.
        val scale = minOf(w, h * image.aspect)
        val fw = scale
        val fh = scale / image.aspect
        SlideElement(kind = ElementKind.IMAGE, x = x + (w - fw) / 2, y = y + (h - fh) / 2, width = fw, height = fh, image = image.name)
    } else {
        SlideElement(kind = ElementKind.SHAPE, x = x, y = y, width = w, height = h, shape = ShapeType.ROUNDED, fill = "surface")
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

    /** A slide as the editor's "new slide" menu offers it, with placeholder text to overwrite. */
    fun preset(layout: SlideLayout): Slide = Slide(
        elements = build(
            when (layout) {
                SlideLayout.TITLE -> SlideDraft(layout, title = "Titel der Präsentation", subtitle = "Name · Fach · Datum")
                SlideLayout.SECTION -> SlideDraft(layout, title = "Neuer Abschnitt")
                SlideLayout.BULLETS -> SlideDraft(layout, title = "Überschrift", bullets = listOf("Erster Punkt", "Zweiter Punkt", "Dritter Punkt"))
                SlideLayout.IMAGE_TEXT -> SlideDraft(layout, title = "Überschrift", bullets = listOf("Was das Bild zeigt", "Warum es wichtig ist"))
                SlideLayout.TWO_COLUMNS -> SlideDraft(
                    layout, title = "Vergleich", leftTitle = "Links", left = listOf("Punkt"), rightTitle = "Rechts", right = listOf("Punkt"),
                )
                SlideLayout.QUOTE -> SlideDraft(layout, quote = "Ein Zitat, das den Kern trifft.", attribution = "Quelle")
                SlideLayout.BLANK -> SlideDraft(layout)
            },
        ),
    )
}
