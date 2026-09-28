package de.maxifrz.lernwerk.present

import kotlin.math.roundToInt

/**
 * A typeface for slides, bundled with the app and named the same in the PowerPoint export. Fonts meant only for
 * headings have a single bold cut that stands in for every style. [scale] keeps text as wide and as tall as Work
 * Sans, for which the layouts size text to fit its box: measured from each font's average glyph width on German
 * text and its line height, never above 1. Mirrors SlideDesign.swift.
 */
enum class SlideFont(
    val pptxName: String,
    val regular: String,
    val bold: String,
    val italic: String,
    val scale: Float,
) {
    WORK_SANS("Work Sans", "worksans_regular", "worksans_semibold", "worksans_italic", 1f),
    DM_SANS("DM Sans", "dmsans_regular", "dmsans_bold", "dmsans_italic", 0.95f),
    MONTSERRAT("Montserrat", "montserrat_regular", "montserrat_bold", "montserrat_italic", 1f),
    PLAYFAIR("Playfair Display", "playfairdisplay_bold", "playfairdisplay_bold", "playfairdisplay_bold", 0.93f),
    LORA("Lora", "lora_bold", "lora_bold", "lora_bold", 0.96f),
    ARCHIVO_BLACK("Archivo Black", "archivoblack_regular", "archivoblack_regular", "archivoblack_regular", 1f);

    /** Whether the font has real bold and italic cuts; heading fonts are bold throughout. */
    val hasStyles: Boolean get() = bold != regular
}

/** Shapes a design draws behind every slide: frames, corner circles, glows, bands, rails, color blocks. */
enum class DecorStyle { NONE, FRAME, CORNERS, GLOW, BAND, RAIL_LEFT, RAIL_RIGHT, BLOCKS, CIRCLES }

/**
 * The parts of a design that are not colors: which font a text uses and the decorations. Both are worked out when
 * drawing, so switching the design restyles every slide, and editing a slide never touches them. The PowerPoint
 * export writes the decorations as ordinary shapes.
 */
object SlideDesign {
    /** The theme id for "let the AI choose" while creating a deck. */
    const val AUTO = "auto"

    /** Every design with the subjects it suits, for the AI to choose from. */
    val catalog: String get() = SlideTheme.all.joinToString("\n") { "- ${it.id}: ${it.name} – ${it.mood}" }

    /**
     * The design for a topic without the AI's choice: the one whose subjects the text mentions most often, the first
     * on a tie, Quill if none fits.
     */
    fun suggest(text: String): String {
        val haystack = text.lowercase()
        var best = SlideTheme.QUILL.id
        var bestScore = 0
        for (theme in SlideTheme.all) {
            val keywords = theme.mood.lowercase().split(",").map { it.trim() }
            val score = keywords.count { it.isNotEmpty() && haystack.contains(it) }
            if (score > bestScore) {
                best = theme.id
                bestScore = score
            }
        }
        return best
    }

    /** The AI's choice if it named a design, otherwise [suggest] on the topic. */
    fun resolve(chosen: String, fallback: String): String {
        val id = chosen.trim().lowercase()
        return if (SlideTheme.all.any { it.id == id }) id else suggest(fallback)
    }

    /**
     * Titles are marked as headings by the layouts; in decks from before designs had fonts, bold text of 28 pt and
     * more counts as one.
     */
    fun isHeading(element: SlideElement): Boolean = when (element.font) {
        "heading" -> true
        "body" -> false
        else -> element.bold && element.fontSize >= 28f
    }

    fun font(element: SlideElement, theme: SlideTheme): SlideFont = if (isHeading(element)) theme.heading else theme.body

    /** The resource name of the cut to draw with. */
    fun fontFile(element: SlideElement, theme: SlideTheme): String {
        val font = font(element, theme)
        return when {
            element.italic -> font.italic
            element.bold -> font.bold
            else -> font.regular
        }
    }

    /** The size to draw at: the element's size, scaled so the design's font takes as much room as Work Sans. */
    fun fontSize(element: SlideElement, theme: SlideTheme): Float =
        (element.fontSize.toDouble() * font(element, theme).scale.toDouble() * 100).roundToInt() / 100f

    /** [percent] of the way from [a] to [b], per channel and rounded half up, so both apps get the same colors. */
    fun mix(a: Long, b: Long, percent: Int): Long {
        fun channel(shift: Int): Long {
            val from = ((a shr shift) and 0xFF).toInt()
            val to = ((b shr shift) and 0xFF).toInt()
            return ((from * (100 - percent) + to * percent + 50) / 100).toLong() shl shift
        }
        return channel(16) or channel(8) or channel(0)
    }

    fun hex(rgb: Long): String = "#%06X".format(rgb and 0xFFFFFF)

    /**
     * The decorations of slide [index]: bolder on the title slide (index 0), quiet on the others so they stay at the
     * edges or behind text in a faint tint.
     */
    fun decor(theme: SlideTheme, index: Int): List<SlideElement> {
        val background = theme.background
        val soft = hex(mix(background, theme.accent, 14))
        val softer = hex(mix(background, theme.accent, 8))
        val soft2 = hex(mix(background, theme.secondAccent, 22))
        val mid = hex(mix(background, theme.accent, 40))
        val accent = "accent"
        var count = 0
        fun shape(
            shape: ShapeType, x: Float, y: Float, w: Float, h: Float, fill: String, stroke: String = "none", strokeWidth: Float = 0f,
        ): SlideElement {
            count += 1
            return SlideElement(
                id = "decor-$count", kind = ElementKind.SHAPE, x = x, y = y, width = w, height = h, shape = shape, fill = fill,
                stroke = stroke, strokeWidth = strokeWidth,
            )
        }
        val title = index == 0
        return when (theme.decor) {
            DecorStyle.NONE -> emptyList()
            DecorStyle.FRAME -> if (title) {
                listOf(
                    shape(ShapeType.ELLIPSE, 690f, -150f, 420f, 420f, softer),
                    shape(ShapeType.ELLIPSE, -120f, 380f, 300f, 300f, soft2),
                    shape(ShapeType.RECT, 18f, 18f, 924f, 504f, "none", stroke = mid, strokeWidth = 1.5f),
                )
            } else {
                listOf(shape(ShapeType.RECT, 18f, 18f, 924f, 504f, "none", stroke = mid, strokeWidth = 1f))
            }
            DecorStyle.CORNERS -> if (title) {
                listOf(
                    shape(ShapeType.ELLIPSE, -140f, -140f, 340f, 340f, soft),
                    shape(ShapeType.ELLIPSE, 740f, 330f, 340f, 340f, soft2),
                    shape(ShapeType.ELLIPSE, 52f, 470f, 22f, 22f, accent),
                )
            } else {
                listOf(shape(ShapeType.ELLIPSE, -80f, -80f, 150f, 150f, soft), shape(ShapeType.ELLIPSE, 870f, 450f, 160f, 160f, soft2))
            }
            DecorStyle.GLOW -> if (title) {
                listOf(shape(ShapeType.ELLIPSE, 130f, -80f, 700f, 700f, softer), shape(ShapeType.ELLIPSE, 280f, 70f, 400f, 400f, soft))
            } else {
                listOf(shape(ShapeType.ELLIPSE, 640f, -300f, 560f, 560f, softer), shape(ShapeType.ELLIPSE, 760f, -190f, 340f, 340f, soft))
            }
            DecorStyle.BAND -> if (title) {
                listOf(
                    shape(ShapeType.RECT, 0f, 0f, 960f, 16f, accent),
                    shape(ShapeType.RECT, 0f, 470f, 960f, 70f, soft),
                    shape(ShapeType.RECT, 64f, 494f, 90f, 6f, accent),
                )
            } else {
                listOf(shape(ShapeType.RECT, 0f, 0f, 960f, 8f, accent), shape(ShapeType.RECT, 0f, 532f, 960f, 8f, soft2))
            }
            DecorStyle.RAIL_LEFT -> if (title) {
                listOf(shape(ShapeType.RECT, 0f, 0f, 36f, 540f, accent), shape(ShapeType.RECT, 36f, 0f, 10f, 540f, soft))
            } else {
                listOf(shape(ShapeType.RECT, 0f, 0f, 14f, 540f, accent))
            }
            DecorStyle.RAIL_RIGHT -> if (title) {
                listOf(shape(ShapeType.RECT, 924f, 0f, 36f, 540f, accent), shape(ShapeType.RECT, 914f, 0f, 10f, 540f, soft))
            } else {
                listOf(shape(ShapeType.RECT, 946f, 0f, 14f, 540f, accent))
            }
            DecorStyle.BLOCKS -> if (title) {
                listOf(
                    shape(ShapeType.ROUNDED, 790f, -60f, 230f, 200f, soft),
                    shape(ShapeType.ROUNDED, -70f, 400f, 240f, 200f, soft2),
                    shape(ShapeType.ROUNDED, 880f, 64f, 40f, 40f, accent),
                )
            } else {
                listOf(
                    shape(ShapeType.ROUNDED, 890f, -50f, 110f, 110f, soft),
                    shape(ShapeType.ROUNDED, -50f, 480f, 110f, 110f, soft2),
                    shape(ShapeType.ROUNDED, 912f, 500f, 22f, 22f, accent),
                )
            }
            DecorStyle.CIRCLES -> if (title) {
                listOf(
                    shape(ShapeType.ELLIPSE, 620f, 160f, 460f, 460f, softer),
                    shape(ShapeType.ELLIPSE, 700f, 240f, 140f, 140f, soft),
                    shape(ShapeType.ELLIPSE, -60f, -60f, 160f, 160f, soft2),
                )
            } else {
                listOf(shape(ShapeType.ELLIPSE, 780f, 360f, 320f, 320f, softer))
            }
        }
    }
}
