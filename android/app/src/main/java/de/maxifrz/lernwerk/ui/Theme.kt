package de.maxifrz.lernwerk.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import de.maxifrz.lernwerk.R

/** Design tokens of the Quill design system: warm neutrals, one sage accent, light and dark. */
@Immutable
data class QuillColors(
    val bg: Color,
    val surface: Color,
    val ink: Color,
    val ink2: Color,
    val muted: Color,
    val faint: Color,
    val hint: Color,
    val line: Color,
    val lineSoft: Color,
    val line2: Color,
    val line3: Color,
    val hover: Color,
    val hoverSoft: Color,
    val scrim: Color,
    val accent: Color,
    val warn: Color,
    val link: Color,
    /** The page backdrop behind PDFs. */
    val canvas: Color,
    val isDark: Boolean,
) {
    /** Printed material stays black on white in both themes. */
    val paper = Color.White
    val paperInk = hex(0x16150F)

    /** Dark text on the sage accent, independent of the theme. */
    val onAccent = hex(0x16150F)
}

fun hex(value: Long, alpha: Float = 1f) = Color(
    red = ((value shr 16) and 0xFF) / 255f,
    green = ((value shr 8) and 0xFF) / 255f,
    blue = (value and 0xFF) / 255f,
    alpha = alpha,
)

private val LightColors = QuillColors(
    bg = hex(0xFAF9F6), surface = hex(0xFFFFFF), ink = hex(0x16150F), ink2 = hex(0x24231C),
    muted = hex(0x6E6B62), faint = hex(0x9A968B), hint = hex(0xB0ABA0),
    line = hex(0x16150F, 0.10f), lineSoft = hex(0x16150F, 0.08f), line2 = hex(0x16150F, 0.16f), line3 = hex(0x16150F, 0.20f),
    hover = hex(0x16150F, 0.05f), hoverSoft = hex(0x16150F, 0.03f), scrim = hex(0x16150F, 0.32f),
    accent = hex(0x7FA98C), warn = hex(0xC9974F), link = hex(0x4F7A63), canvas = hex(0xEEEDE9), isDark = false,
)

private val DarkColors = QuillColors(
    bg = hex(0x171714), surface = hex(0x212019), ink = hex(0xF1EFE7), ink2 = hex(0xDFDCD3),
    muted = hex(0x9B978D), faint = hex(0x807C73), hint = hex(0x6C6961),
    line = hex(0xF1EFE7, 0.12f), lineSoft = hex(0xF1EFE7, 0.09f), line2 = hex(0xF1EFE7, 0.20f), line3 = hex(0xF1EFE7, 0.26f),
    hover = hex(0xF1EFE7, 0.07f), hoverSoft = hex(0xF1EFE7, 0.05f), scrim = hex(0x000000, 0.55f),
    accent = hex(0x8FBE9C), warn = hex(0xD6A762), link = hex(0x8FBE9C), canvas = hex(0x25241F), isDark = true,
)

private val LocalQuillColors = staticCompositionLocalOf { LightColors }

object Quill {
    val colors: QuillColors
        @Composable @ReadOnlyComposable
        get() = LocalQuillColors.current
}

val WorkSans = FontFamily(
    Font(R.font.worksans_light, FontWeight.Light),
    Font(R.font.worksans_regular, FontWeight.Normal),
    Font(R.font.worksans_italic, FontWeight.Normal, FontStyle.Italic),
    Font(R.font.worksans_medium, FontWeight.Medium),
    Font(R.font.worksans_semibold, FontWeight.SemiBold),
)

val Silkscreen = FontFamily(Font(R.font.silkscreen_regular))

/** Work Sans at the given size; [tracking] is in points like the iOS version and converted to em. */
fun work(size: Float, weight: FontWeight = FontWeight.Normal, tracking: Float = 0f, lineHeight: Float? = null) = TextStyle(
    fontFamily = WorkSans,
    fontWeight = weight,
    fontSize = size.sp,
    letterSpacing = (tracking / size).em,
    lineHeight = lineHeight?.sp ?: androidx.compose.ui.unit.TextUnit.Unspecified,
)

fun workItalic(size: Float) = TextStyle(fontFamily = WorkSans, fontStyle = FontStyle.Italic, fontSize = size.sp)

fun pixel(size: Float) = TextStyle(fontFamily = Silkscreen, fontSize = size.sp, letterSpacing = 0.1.em)

@Composable
fun QuillTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val colors = if (dark) DarkColors else LightColors
    val material = if (dark) {
        darkColorScheme(
            primary = colors.accent, onPrimary = colors.onAccent, background = colors.bg, surface = colors.surface,
            onSurface = colors.ink, onBackground = colors.ink, surfaceContainerHigh = colors.surface,
            surfaceContainerHighest = colors.surface, outline = colors.line2, onSurfaceVariant = colors.muted,
        )
    } else {
        lightColorScheme(
            primary = colors.accent, onPrimary = colors.onAccent, background = colors.bg, surface = colors.surface,
            onSurface = colors.ink, onBackground = colors.ink, surfaceContainerHigh = colors.surface,
            surfaceContainerHighest = colors.surface, outline = colors.line2, onSurfaceVariant = colors.muted,
        )
    }
    CompositionLocalProvider(LocalQuillColors provides colors) {
        MaterialTheme(colorScheme = material, content = content)
    }
}
