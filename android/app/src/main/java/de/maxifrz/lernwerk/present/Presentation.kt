package de.maxifrz.lernwerk.present

import kotlinx.serialization.Serializable
import java.util.UUID
import kotlin.math.cos
import kotlin.math.sin

/** Slides are 960 × 540 points: 16:9 and exactly PowerPoint's widescreen size (13.333 × 7.5 in). */
object SlideSize {
    const val WIDTH = 960f
    const val HEIGHT = 540f
}

@Serializable
enum class ElementKind { TEXT, SHAPE, IMAGE }

@Serializable
enum class ShapeType { RECT, ROUNDED, ELLIPSE, LINE, ARROW }

@Serializable
enum class TextAlign { LEFT, CENTER, RIGHT }

@Serializable
enum class TextAnchor { TOP, MIDDLE, BOTTOM }

/**
 * One freely placed object on a slide. Frames are in slide points, rotation in degrees clockwise around the
 * frame's center. Colors are theme tokens ("text", "muted", "accent", "surface", "background") so switching the
 * theme recolors everything, or "#RRGGBB" for a fixed color, or "none".
 */
@Serializable
data class SlideElement(
    val id: String = newId(),
    val kind: ElementKind,
    val x: Float,
    val y: Float,
    val width: Float,
    val height: Float,
    val rotation: Float = 0f,
    // Text
    val text: String = "",
    val fontSize: Float = 24f,
    val bold: Boolean = false,
    val italic: Boolean = false,
    val align: TextAlign = TextAlign.LEFT,
    val anchor: TextAnchor = TextAnchor.TOP,
    val bullets: Boolean = false,
    val textColor: String = "text",
    // Shape
    val shape: ShapeType = ShapeType.RECT,
    val fill: String = "accent",
    val stroke: String = "none",
    val strokeWidth: Float = 0f,
    // Image: file name in the presentation media folder
    val image: String? = null,
) {
    val centerX get() = x + width / 2
    val centerY get() = y + height / 2

    /** Whether a slide point lies inside the frame, taking rotation into account. */
    fun contains(px: Float, py: Float, slop: Float = 0f): Boolean {
        val (lx, ly) = toLocal(px, py)
        val isLine = kind == ElementKind.SHAPE && (shape == ShapeType.LINE || shape == ShapeType.ARROW)
        val extra = if (isLine) maxOf(slop, 10f) else slop
        return lx >= -extra && lx <= width + extra && ly >= -extra && ly <= height + extra
    }

    /** Converts a slide point into the element's unrotated coordinates, origin at its top left. */
    fun toLocal(px: Float, py: Float): Pair<Float, Float> {
        val radians = Math.toRadians(-rotation.toDouble())
        val dx = px - centerX
        val dy = py - centerY
        val rx = (dx * cos(radians) - dy * sin(radians)).toFloat()
        val ry = (dx * sin(radians) + dy * cos(radians)).toFloat()
        return (rx + width / 2) to (ry + height / 2)
    }

    /** Converts a point in the element's unrotated coordinates back to slide coordinates. */
    fun toSlide(lx: Float, ly: Float): Pair<Float, Float> {
        val radians = Math.toRadians(rotation.toDouble())
        val dx = lx - width / 2
        val dy = ly - height / 2
        val rx = (dx * cos(radians) - dy * sin(radians)).toFloat()
        val ry = (dx * sin(radians) + dy * cos(radians)).toFloat()
        return (rx + centerX) to (ry + centerY)
    }

    companion object {
        fun newId() = UUID.randomUUID().toString()
    }
}

@Serializable
data class Slide(
    val id: String = SlideElement.newId(),
    val elements: List<SlideElement> = emptyList(),
    val notes: String = "",
    /** Pages of the source material this slide is based on, as "material:page" references for the source slide. */
    val sources: List<SourceRef> = emptyList(),
    /** Text found on an imported slide picture (PDF import); not drawn, only given to the AI. */
    val extractedText: String = "",
    /** "#RRGGBB" for a slide with its own background (imported decks); empty means the theme's. */
    val background: String = "",
)

@Serializable
data class SourceRef(val materialId: String?, val page: Int)

@Serializable
data class Presentation(
    val id: String = SlideElement.newId(),
    val title: String,
    val themeId: String = SlideTheme.QUILL.id,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = createdAt,
    val slides: List<Slide> = emptyList(),
    val materialIds: List<String> = emptyList(),
    /** Planned talk length, used for speaker notes. */
    val minutes: Int = 10,
) {
    val theme: SlideTheme get() = SlideTheme.byId(themeId)
}

/** A slide design: colors for the tokens elements refer to. */
data class SlideTheme(
    val id: String,
    val name: String,
    val background: Long,
    val text: Long,
    val muted: Long,
    val accent: Long,
    val surface: Long,
) {
    /** Resolves a token or "#RRGGBB" to 0xRRGGBB, or null for "none". */
    fun color(value: String): Long? = when (value) {
        "none", "" -> null
        "text" -> text
        "muted" -> muted
        "accent" -> accent
        "surface" -> surface
        "background" -> background
        else -> value.removePrefix("#").toLongOrNull(16)
    }

    companion object {
        val QUILL = SlideTheme("quill", "Quill", 0xFAF9F6, 0x16150F, 0x6E6B62, 0x7FA98C, 0xEEEDE9)
        val NIGHT = SlideTheme("nacht", "Nacht", 0x171714, 0xF1EFE7, 0x9B978D, 0x8FBE9C, 0x2A2923)
        val CHALK = SlideTheme("kreide", "Kreide", 0x2F4A3A, 0xF4F1E8, 0xC9D3C4, 0xE8C872, 0x3B5A48)
        val PAPER = SlideTheme("papier", "Papier", 0xFFFFFF, 0x1F2A44, 0x5B6478, 0x3D6FB6, 0xEEF2F8)
        val all = listOf(QUILL, NIGHT, CHALK, PAPER)

        fun byId(id: String) = all.firstOrNull { it.id == id } ?: QUILL
    }
}

/** Fixed colors offered in the editor besides the theme tokens. */
val SwatchColors = listOf("text", "muted", "accent", "surface", "background", "#C46A55", "#C9974F", "#3D6FB6", "#FFFFFF", "#000000")
