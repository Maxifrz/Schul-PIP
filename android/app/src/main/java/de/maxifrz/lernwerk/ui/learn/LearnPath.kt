package de.maxifrz.lernwerk.ui.learn

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.learn.Course
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.LessonState
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.PathStep
import de.maxifrz.lernwerk.learn.PathUnit
import de.maxifrz.lernwerk.learn.skills.Recommendation
import de.maxifrz.lernwerk.learn.skills.RecommendationKind
import de.maxifrz.lernwerk.ui.OutlineButton
import de.maxifrz.lernwerk.ui.PixelCaption
import de.maxifrz.lernwerk.ui.PrimaryButton
import de.maxifrz.lernwerk.ui.QText
import de.maxifrz.lernwerk.ui.Quill
import de.maxifrz.lernwerk.ui.pixel
import de.maxifrz.lernwerk.ui.work

// The path of a course: a banner per unit that stays at the top while its steps scroll by, the steps in a gentle zigzag
// (strictly one after the other: done, the one open, the rest locked), and Pip beside the one to do next.
// A port of desktop/src/views/learn/Path.tsx and CoursePathView.swift.

/** The course's color (0xRRGGBB) as an opaque Compose color. */
fun courseColor(course: Course): Color = Color(0xFF000000.toInt() or course.color)

/** Text and symbols on the course's color: dark only on light colors. */
@Composable
fun onCourseColor(course: Course): Color = if (course.prefersDarkText) Quill.colors.onAccent else Color.White

fun stepLabel(node: CourseNode): String = when (node.kind) {
    NodeKind.LESSON -> "Lektion ${node.index}"
    NodeKind.PRACTICE -> "Übungsrunde"
    NodeKind.CHECKPOINT -> "Einheitentest"
    NodeKind.CHEST -> "Truhe"
}

fun stateText(step: PathStep): String = when (step.state) {
    LessonState.DONE -> if (step.node.kind == NodeKind.CHEST) "geöffnet" else "geschafft"
    LessonState.OPEN -> if (step.node.kind == NodeKind.CHEST) "bereit zum Öffnen" else "offen"
    LessonState.LOCKED -> "gesperrt"
}

private fun nodeIcon(step: PathStep): LIconName = when (step.node.kind) {
    NodeKind.LESSON -> if (step.state == LessonState.DONE) LIconName.CHECK else LIconName.STAR
    NodeKind.PRACTICE -> LIconName.DUMBBELL
    NodeKind.CHECKPOINT -> if (step.state == LessonState.DONE) LIconName.SEAL else LIconName.FLAG
    NodeKind.CHEST -> LIconName.CHEST
}

private val coinSize = 76.dp
private val coinEdge = 7.dp
private val waveWidth = 84.dp

/** A coin with an edge below it: the course's color when it can be played, gray when it is locked; it sinks when pressed. */
@Composable
private fun PathNode(step: PathStep, course: Course, current: Boolean, onStep: (PathStep) -> Unit) {
    val colors = Quill.colors
    val locked = step.state == LessonState.LOCKED
    val base = if (locked) colors.line3.copy(alpha = if (colors.isDark) 0.35f else 0.28f) else courseColor(course)
    val face = if (locked) lerp(colors.bg, colors.ink, if (colors.isDark) 0.16f else 0.12f) else base
    val edge = if (locked) lerp(colors.bg, colors.ink, if (colors.isDark) 0.28f else 0.24f) else lerp(base, Color.Black, 0.28f)
    val glyph = if (locked) colors.hint else onCourseColor(course)
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val sink = if (pressed && !locked) coinEdge else 0.dp
    val label = stepLabel(step.node) + ", " + stateText(step)
    Box(
        Modifier
            .size(coinSize + 16.dp, coinSize + coinEdge + 16.dp)
            .semantics { contentDescription = label }
            .clickable(interaction, null, enabled = !locked, role = Role.Button) { onStep(step) },
        contentAlignment = Alignment.TopCenter,
    ) {
        if (current) {
            Canvas(Modifier.size(coinSize + 16.dp, coinSize + coinEdge + 16.dp)) {
                drawRoundRect(
                    base.copy(alpha = 0.55f), Offset(2.dp.toPx(), 2.dp.toPx()),
                    Size(size.width - 4.dp.toPx(), size.height - 4.dp.toPx()), CornerRadius(size.width), style = Stroke(3.dp.toPx()),
                )
            }
        }
        Box(Modifier.padding(top = 8.dp).size(coinSize, coinSize + coinEdge)) {
            Box(Modifier.offset(y = coinEdge).size(coinSize, coinSize).background(edge, CircleShape))
            Box(
                Modifier.offset(y = sink).size(coinSize, coinSize).background(face, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                val filled = step.node.kind == NodeKind.CHEST || (step.node.kind == NodeKind.LESSON && step.state != LessonState.DONE)
                LIcon(nodeIcon(step), glyph, 32.dp, 2.4f, filled)
            }
        }
    }
}

/** The "START" / "ÖFFNEN" tag above the coin to do next. */
@Composable
private fun StartTag(text: String) {
    val colors = Quill.colors
    Box(
        Modifier.background(colors.surface, RoundedCornerShape(10.dp)).border(1.dp, colors.line2, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 5.dp),
    ) { QText(text, pixel(10.5f), colors.ink) }
}

/** The banner of a unit: "Abschnitt 1, Einheit 1" and its title; tapping it opens the guide. */
@Composable
private fun UnitBanner(unit: PathUnit, course: Course, onTip: (PathUnit) -> Unit) {
    val color = courseColor(course)
    val on = onCourseColor(course)
    val shape = RoundedCornerShape(18.dp)
    Box(Modifier.fillMaxWidth().background(Quill.colors.bg).padding(vertical = 6.dp)) {
        Box(Modifier.fillMaxWidth().padding(top = 4.dp).height(74.dp).background(lerp(color, Color.Black, 0.28f), shape))
        Row(
            Modifier
                .fillMaxWidth()
                .height(70.dp)
                .background(color, shape)
                .semantics { contentDescription = "Abschnitt ${unit.sectionNumber}, Einheit ${unit.unit.number}: ${unit.unit.title}. Tipps lesen" }
                .clickable(role = Role.Button) { onTip(unit) }
                .padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                QText("ABSCHNITT ${unit.sectionNumber}, EINHEIT ${unit.unit.number}", pixel(9.5f), on.copy(alpha = 0.78f), maxLines = 1)
                QText(unit.unit.title, work(18f, FontWeight.SemiBold, tracking = -0.3f, lineHeight = 22f), on, maxLines = 2)
            }
            Box(
                Modifier.size(42.dp).border(1.5.dp, on.copy(alpha = 0.5f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) { LIcon(LIconName.BOOK, on, 22.dp, 2f) }
        }
    }
}

/** The index (in the list [pathItems] adds) of the step to do next, to scroll to it. */
fun pathScrollIndex(units: List<PathUnit>): Int {
    var index = 0
    var found = -1
    units.forEachIndexed { unitIndex, unit ->
        val startsSection = unitIndex == 0 || units[unitIndex - 1].section.id != unit.section.id
        if (startsSection) index += 1
        index += 1 // the banner
        for (step in unit.steps) {
            if (found < 0 && step.state == LessonState.OPEN) found = index
            index += 1
        }
    }
    return maxOf(0, if (found < 0) 0 else found - 2)
}

/** Adds the path to a lazy list: per unit a heading (when its section starts), the sticky banner and the steps. */
@OptIn(ExperimentalFoundationApi::class)
fun LazyListScope.pathItems(
    course: Course,
    units: List<PathUnit>,
    onStep: (PathStep) -> Unit,
    onTip: (PathUnit) -> Unit,
    onFooter: () -> Unit,
) {
    val current = units.flatMap { it.steps }.firstOrNull { it.state == LessonState.OPEN }
    var position = 0
    units.forEachIndexed { unitIndex, unit ->
        val startsSection = unitIndex == 0 || units[unitIndex - 1].section.id != unit.section.id
        if (startsSection) {
            item(key = "section-${unit.section.id}") {
                PixelCaption(unit.section.title, Modifier.fillMaxWidth().padding(top = if (unitIndex == 0) 4.dp else 28.dp, bottom = 6.dp))
            }
        }
        stickyHeader(key = "unit-${unit.id}") { UnitBanner(unit, course, onTip) }
        for (step in unit.steps) {
            val shift = pathShift(position++)
            val isCurrent = current?.id == step.id
            item(key = step.id) {
                Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.TopCenter) {
                    Box(Modifier.offset(x = waveWidth * shift.toFloat())) {
                        if (isCurrent) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                StartTag(if (step.node.kind == NodeKind.CHEST) "ÖFFNEN" else "START")
                                PathNode(step, course, true, onStep)
                            }
                            Box(Modifier.offset(x = if (shift >= 0) (-(coinSize + 56.dp)) else (coinSize + 22.dp), y = 52.dp)) { PipMark(4.dp) }
                        } else {
                            Box(Modifier.padding(top = 0.dp)) { PathNode(step, course, false, onStep) }
                        }
                    }
                }
            }
        }
    }
    item(key = "footer") {
        Column(Modifier.fillMaxWidth().padding(top = 28.dp, bottom = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            if (units.isNotEmpty() && units.all { it.isDone }) {
                CardBox {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        PipMark(5.dp)
                        QText("Kurs geschafft", work(22f, FontWeight.SemiBold), Quill.colors.ink)
                        QText(
                            "Du hast alle Einheiten von „${course.title}“ abgeschlossen. Tipp auf eine Lektion, um sie noch einmal zu üben.",
                            work(14.5f, lineHeight = 20f), Quill.colors.muted, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        )
                    }
                }
            }
            OutlineButton("Anderen Kurs wählen", onFooter, height = 44.dp, fontSize = 15f, weight = FontWeight.Medium)
        }
    }
}

/** What the Lernen area suggests next and why, with one button to do it. */
@Composable
fun AdviceCard(advice: Recommendation, onGo: () -> Unit, onSkills: () -> Unit, modifier: Modifier = Modifier) {
    val colors = Quill.colors
    val caption = when (advice.kind) {
        RecommendationKind.REVIEW -> "Wiederholung fällig"
        RecommendationKind.PRACTICE -> "Gezielt üben"
        RecommendationKind.STEP -> "Als Nächstes"
        RecommendationKind.FINISHED -> "Kurs geschafft"
    }
    val tone = if (advice.kind == RecommendationKind.REVIEW) colors.warn else colors.link
    CardBox(modifier, highlight = advice.kind == RecommendationKind.REVIEW) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PixelCaption(caption, color = tone)
            QText(advice.title, work(18f, FontWeight.SemiBold, tracking = -0.2f, lineHeight = 23f), colors.ink)
            QText(advice.reason, work(14f, lineHeight = 19f), colors.muted)
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (advice.kind != RecommendationKind.FINISHED) {
                    PrimaryButton(if (advice.kind == RecommendationKind.STEP) "Starten" else "Los geht’s", onGo, height = 42.dp, fontSize = 14.5f)
                }
                OutlineButton("Fähigkeiten", onSkills, height = 42.dp, fontSize = 14.5f, weight = FontWeight.Medium)
            }
        }
    }
}

/** A small tile with a caption, a value and a bar: the day's quests and the week's goal. */
@Composable
fun StatTile(caption: String, value: String, fraction: Float, footnote: String, highlight: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val colors = Quill.colors
    CardBox(modifier.clickable(role = Role.Button, onClick = onClick), highlight = highlight) {
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            PixelCaption(caption, color = colors.muted)
            QText(value, work(20f, FontWeight.SemiBold, tracking = -0.3f), colors.ink, maxLines = 1)
            LearnBar(fraction)
            QText(footnote, work(12.5f), colors.hint, maxLines = 1)
        }
    }
}

@Suppress("unused")
private val pathWidth: Dp = 520.dp
