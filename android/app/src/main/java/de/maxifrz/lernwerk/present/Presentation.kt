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
    /** "heading" for titles, "body" for other text, empty to decide by size (older decks); see [SlideDesign]. */
    val font: String = "",
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

/**
 * A slide design: colors for the tokens elements refer to, a heading and a body font, and decorations drawn behind
 * every slide (see [SlideDesign]). The first four are the original designs and look as they always did.
 */
data class SlideTheme(
    val id: String,
    val name: String,
    val background: Long,
    val text: Long,
    val muted: Long,
    val accent: Long,
    val surface: Long,
    /** A second color for decorations. */
    val accent2: Long? = null,
    val heading: SlideFont = SlideFont.WORK_SANS,
    val body: SlideFont = SlideFont.WORK_SANS,
    val decor: DecorStyle = DecorStyle.NONE,
    /** Subjects and moods the design suits, for the AI's suggestion. */
    val mood: String = "",
) {
    val secondAccent: Long get() = accent2 ?: accent

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
        val QUILL = SlideTheme("quill", "Quill", 0xFAF9F6, 0x16150F, 0x6E6B62, 0x7FA98C, 0xEEEDE9, mood = "ruhig, neutral, passt zu allem")
        val NIGHT = SlideTheme("nacht", "Nacht", 0x171714, 0xF1EFE7, 0x9B978D, 0x8FBE9C, 0x2A2923, mood = "dunkel, für abgedunkelte Räume, neutral")
        val CHALK = SlideTheme("kreide", "Kreide", 0x2F4A3A, 0xF4F1E8, 0xC9D3C4, 0xE8C872, 0x3B5A48, mood = "Tafel, Mathematik, Unterricht, Erklären")
        val PAPER = SlideTheme("papier", "Papier", 0xFFFFFF, 0x1F2A44, 0x5B6478, 0x3D6FB6, 0xEEF2F8, mood = "klassisch, schlicht, druckfreundlich")
        val EDITORIAL = SlideTheme(
            "editorial", "Editorial", 0xF7F5F0, 0x1B2530, 0x5E6773, 0x155F99, 0xE4ECF3,
            accent2 = 0x9DCAEA, heading = SlideFont.PLAYFAIR, body = SlideFont.DM_SANS, decor = DecorStyle.FRAME,
            mood = "Deutsch, Literatur, Geschichte, Philosophie, Kunst, Referate mit Zitaten",
        )
        val VERDANT = SlideTheme(
            "verdant", "Verdant", 0xFBFCF8, 0x03362D, 0x4F6B60, 0x285F20, 0xE1EADA,
            accent2 = 0xB4CFA2, heading = SlideFont.LORA, body = SlideFont.DM_SANS, decor = DecorStyle.CORNERS,
            mood = "Biologie, Umwelt, Erdkunde, Ernährung, Nachhaltigkeit",
        )
        val NOVA = SlideTheme(
            "nova", "Nova", 0x0B1A2E, 0xF2F6FB, 0x9FB2C8, 0x5B9BE6, 0x16294A,
            accent2 = 0x8A63E0, heading = SlideFont.MONTSERRAT, body = SlideFont.DM_SANS, decor = DecorStyle.GLOW,
            mood = "Physik, Astronomie, Informatik, Technik, Zukunftsthemen",
        )
        val MOMENTUM = SlideTheme(
            "momentum", "Momentum", 0xF6F7FC, 0x111633, 0x5A6280, 0x213EBB, 0xDDE3F5,
            accent2 = 0x7D92D8, heading = SlideFont.ARCHIVO_BLACK, body = SlideFont.DM_SANS, decor = DecorStyle.BAND,
            mood = "Wirtschaft, Politik, Sozialkunde, Statistik, Umfragen",
        )
        val MOSAIK = SlideTheme(
            "mosaik", "Mosaik", 0xFFFFFF, 0x1A1919, 0x5B5B66, 0x6A57E8, 0xEFEDFD,
            accent2 = 0xBDE5A8, heading = SlideFont.MONTSERRAT, body = SlideFont.MONTSERRAT, decor = DecorStyle.BLOCKS,
            mood = "Kunst, Musik, Medien, Projekte, jüngere Klassen",
        )
        val SIGNAL = SlideTheme(
            "signal", "Signal", 0xFFFBF7, 0x1D1311, 0x6D5955, 0xA9531A, 0xFBE9E1,
            accent2 = 0xF4C9D6, heading = SlideFont.ARCHIVO_BLACK, body = SlideFont.WORK_SANS, decor = DecorStyle.BAND,
            mood = "Werbung, Debatte, Religion, Ethik, Meinungsthemen",
        )
        val ZIVIL = SlideTheme(
            "zivil", "Zivil", 0xECECEC, 0x111111, 0x555555, 0x111111, 0xDADADA,
            accent2 = 0x8E8E8E, heading = SlideFont.MONTSERRAT, body = SlideFont.WORK_SANS, decor = DecorStyle.RAIL_LEFT,
            mood = "Politik, Recht, Gesellschaft, Geschichte des 20. Jahrhunderts, sachlich",
        )
        val HORIZONT = SlideTheme(
            "horizont", "Horizont", 0xFAF6F0, 0x321A00, 0x7A5C3E, 0xA65300, 0xF0DFCC,
            accent2 = 0xC49A6C, heading = SlideFont.LORA, body = SlideFont.MONTSERRAT, decor = DecorStyle.CIRCLES,
            mood = "Geschichte, Antike, Reisen, Architektur, Länderporträts",
        )
        val PULS = SlideTheme(
            "puls", "Puls", 0xFFFFFF, 0x18324A, 0x4B6175, 0x2F6FD0, 0xE6F0FF,
            accent2 = 0xC6DDFF, heading = SlideFont.DM_SANS, body = SlideFont.DM_SANS, decor = DecorStyle.RAIL_RIGHT,
            mood = "Chemie, Medizin, Gesundheit, Sport, Psychologie",
        )
        val VIOLETT = SlideTheme(
            "violett", "Violett", 0xF8F7FB, 0x1B1530, 0x5F587A, 0x7A48E0, 0xEEEAF9,
            accent2 = 0xC9B8F5, heading = SlideFont.MONTSERRAT, body = SlideFont.DM_SANS, decor = DecorStyle.CIRCLES,
            mood = "Mathematik, Informatik, Logik, Ethik",
        )
        val GLUT = SlideTheme(
            "glut", "Glut", 0x171717, 0xF5F5F5, 0xA3A3A3, 0xE26C2C, 0x262626,
            accent2 = 0x983608, heading = SlideFont.ARCHIVO_BLACK, body = SlideFont.MONTSERRAT, decor = DecorStyle.BAND,
            mood = "Sport, Revolutionen, Kriege, Dramatisches, starke Thesen",
        )
        val FRISCHE = SlideTheme(
            "frische", "Frische", 0xF2FCFF, 0x111827, 0x4B5563, 0x0E7C90, 0xD6F5FB,
            accent2 = 0x9A9CF4, heading = SlideFont.MONTSERRAT, body = SlideFont.DM_SANS, decor = DecorStyle.BLOCKS,
            mood = "Englisch, Französisch, Spanisch, Sprachen, locker",
        )
        val WAHRZEICHEN = SlideTheme(
            "wahrzeichen", "Wahrzeichen", 0xF7F5F3, 0x111111, 0x5E5E5E, 0xC8102E, 0xECE7E3,
            accent2 = 0xE86666, heading = SlideFont.PLAYFAIR, body = SlideFont.WORK_SANS, decor = DecorStyle.RAIL_LEFT,
            mood = "Geschichte, Architektur, Städte, Kultur, Denkmäler",
        )

        val all = listOf(QUILL, NIGHT, CHALK, PAPER, EDITORIAL, VERDANT, NOVA, MOMENTUM, MOSAIK, SIGNAL, ZIVIL, HORIZONT, PULS, VIOLETT, GLUT, FRISCHE, WAHRZEICHEN)

        fun byId(id: String) = all.firstOrNull { it.id == id } ?: QUILL
    }
}

/** Fixed colors offered in the editor besides the theme tokens. */
val SwatchColors = listOf("text", "muted", "accent", "surface", "background", "#C46A55", "#C9974F", "#3D6FB6", "#FFFFFF", "#000000")
