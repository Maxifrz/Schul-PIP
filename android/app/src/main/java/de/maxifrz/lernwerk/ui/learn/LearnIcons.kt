package de.maxifrz.lernwerk.ui.learn

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.skills.SkillStatus

// The small drawn symbols of the Lernen area: stroke icons on a 24 by 24 grid (the same outlines as the desktop app).

enum class LIconName(val d: String) {
    STAR("M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"),
    CHECK("M5 12.5l4.5 4.5L19 7.5"),
    DUMBBELL("M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11"),
    SEAL("M12 3l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.9-2.6L4 15.3l.8-2.6-.8-2.6L6.2 8.5l.9-2.6 2.7.1z M8.8 12.2l2.2 2.2 4.2-4.4"),
    FLAG("M6 21V4M6 5h11l-2.5 3.5L17 12H6"),
    CHEST("M4 10h16v9H4zM4 10a8 5 0 0 1 16 0M4 14h16M12 12.5v3"),
    BOOK("M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"),
    FLAME("M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2.5 1.5 2.5C11 9.5 10.5 6 12 3z"),
    DIAMOND("M7 4h10l4 5-9 11L3 9z M3 9h18 M9.5 4L8 9l4 11 4-11-1.5-5"),
    SNOWFLAKE("M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"),
    BOLT("M13 3L5 13.5h6L10 21l8-10.5h-6z"),
    TARGET("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01"),
    CALENDAR("M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4"),
    STACK("M12 4l9 4.5-9 4.5-9-4.5zM3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5"),
    CIRCLE("M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z"),
    PLAY("M9 6.5l9 5.5-9 5.5z"),
    DOTS("M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z"),
    HALF("M12 20.5a8.5 8.5 0 1 0 0-17v17z"),
    CHECK_CIRCLE("M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM8 12.2l2.8 2.8 5.4-5.5"),
    REDO("M19 12a7 7 0 1 1-2.1-5M19 4v4.5h-4.5"),
    SPEAKER("M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"),
    SLOW("M4 15c0-3.5 3.5-6 8-6s8 2.5 8 6zM8 9c0-2 1.5-3.5 4-3.5M5 15l-1.5 3M19 15l1.5 3M9 18l-1 2M15 18l1 2"),
    BULB("M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3.5z"),
    CLOSE("M6 6l12 12M18 6L6 18"),
    INFO("M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5.5M12 7.7h.01"),
    CHAT("M4 5.5h16v11H9.5L5 20v-3.5H4z"),
    GLOBE("M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"),
    SIGMA("M18 5H7l5.5 7L7 19h11"),
    PAWN("M12 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM10 10.5h4M10.5 11c0 3-1.5 5-3 7.5h9c-1.5-2.5-3-4.5-3-7.5zM7 20h10"),
    NOTE("M9 18V5.5l10-2V16M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"),
    CHEVRON("M9 6l6 6-6 6"),
    PLUS("M12 5v14M5 12h14"),
}

private val parsed = java.util.concurrent.ConcurrentHashMap<LIconName, Path>()

private fun pathOf(name: LIconName): Path = parsed.getOrPut(name) { PathParser().parsePathString(name.d).toPath() }

/** An icon in the given color: outlined, or filled with its own color when [filled] is set. */
@Composable
fun LIcon(name: LIconName, color: Color, size: Dp = 20.dp, stroke: Float = 1.8f, filled: Boolean = false, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size)) {
        val path = pathOf(name)
        withTransform({ scale(this@Canvas.size.width / 24f, this@Canvas.size.width / 24f, pivot = androidx.compose.ui.geometry.Offset.Zero) }) {
            if (filled) drawPath(path, color, style = Fill)
            drawPath(path, color, style = Stroke(width = if (filled) 1.2f else stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

/** The symbol of a course by its kind. */
fun courseIcon(kind: CourseKind): LIconName = when (kind) {
    CourseKind.LANGUAGE -> LIconName.CHAT
    CourseKind.SCHOOL -> LIconName.BOOK
    CourseKind.MATH -> LIconName.SIGMA
    CourseKind.CHESS -> LIconName.PAWN
    CourseKind.MUSIC -> LIconName.NOTE
}

fun skillStatusIcon(status: SkillStatus): LIconName = when (status) {
    SkillStatus.NOT_STARTED -> LIconName.CIRCLE
    SkillStatus.STARTED -> LIconName.PLAY
    SkillStatus.WORKED -> LIconName.DOTS
    SkillStatus.PRACTICING -> LIconName.HALF
    SkillStatus.PROVISIONAL -> LIconName.CHECK_CIRCLE
    SkillStatus.MASTERED -> LIconName.SEAL
    SkillStatus.DUE -> LIconName.REDO
}
