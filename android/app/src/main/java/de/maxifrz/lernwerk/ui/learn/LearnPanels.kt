package de.maxifrz.lernwerk.ui.learn

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.learn.LearnProgress
import de.maxifrz.lernwerk.learn.Quest
import de.maxifrz.lernwerk.learn.QuestBoard
import de.maxifrz.lernwerk.learn.QuestKind
import de.maxifrz.lernwerk.learn.SkillRow
import de.maxifrz.lernwerk.learn.skills.SkillStatus
import de.maxifrz.lernwerk.ui.OutlineButton
import de.maxifrz.lernwerk.ui.PixelCaption
import de.maxifrz.lernwerk.ui.QText
import de.maxifrz.lernwerk.ui.Quill
import de.maxifrz.lernwerk.ui.work

// The quests page, the streak freeze, the skills page and the small pieces the Lernen screens share.

/** A white card with a hairline, the container of every tile of the area. */
@Composable
fun CardBox(modifier: Modifier = Modifier, highlight: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val colors = Quill.colors
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier
            .fillMaxWidth()
            .background(colors.surface, shape)
            .border(if (highlight) 1.5.dp else 1.dp, if (highlight) colors.accent else colors.line, shape)
            .padding(16.dp),
        content = content,
    )
}

/** A thin progress bar in the accent color (or [color]). */
@Composable
fun LearnBar(fraction: Float, modifier: Modifier = Modifier, color: Color = Quill.colors.accent, height: Dp = 8.dp) {
    val colors = Quill.colors
    val animated by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(300), label = "bar")
    Canvas(modifier.fillMaxWidth().height(height)) {
        val radius = CornerRadius(size.height / 2)
        drawRoundRect(colors.line, cornerRadius = radius)
        if (animated > 0f) drawRoundRect(color, size = Size(maxOf(size.height, size.width * animated), size.height), cornerRadius = radius)
    }
}

/** The daily goal as a ring that fills up. */
@Composable
fun GoalRing(fraction: Float, reached: Boolean, size: Dp = 26.dp) {
    val colors = Quill.colors
    val tone = if (reached) colors.link else colors.accent
    Canvas(Modifier.size(size)) {
        val width = this.size.width * 0.125f
        val inset = width / 2
        val arc = Size(this.size.width - width, this.size.height - width)
        drawArc(colors.line2, 0f, 360f, false, Offset(inset, inset), arc, style = Stroke(width))
        if (fraction > 0f) drawArc(tone, -90f, 360f * fraction.coerceIn(0f, 1f), false, Offset(inset, inset), arc, style = Stroke(width, cap = StrokeCap.Round))
    }
}

/** A filled capsule in the accent color: "Abholen", "Kaufen". */
@Composable
fun AccentButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, description: String? = null) {
    val colors = Quill.colors
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    Box(
        modifier
            .height(40.dp)
            .alpha(if (enabled) (if (pressed) 0.85f else 1f) else 0.4f)
            .background(colors.accent, CircleShape)
            .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier)
            .clickable(interaction, null, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 18.dp),
        contentAlignment = Alignment.Center,
    ) { QText(text, work(14.5f, FontWeight.SemiBold), colors.onAccent, maxLines = 1) }
}

private fun questIcon(kind: QuestKind): LIconName = when (kind) {
    QuestKind.XP -> LIconName.BOLT
    QuestKind.LESSONS -> LIconName.BOOK
    QuestKind.PERFECT -> LIconName.TARGET
    QuestKind.FIRST_TRY -> LIconName.CHECK_CIRCLE
    QuestKind.COURSES -> LIconName.STACK
    QuestKind.PRACTICE -> LIconName.DUMBBELL
    QuestKind.DAYS -> LIconName.CALENDAR
}

@Composable
private fun IconBadge(icon: LIconName, tint: Color, active: Boolean) {
    val colors = Quill.colors
    Box(
        Modifier.size(44.dp).background(if (active) tint.copy(alpha = 0.22f) else colors.hover, CircleShape),
        contentAlignment = Alignment.Center,
    ) { LIcon(icon, if (active) colors.link else colors.muted, 22.dp, 2f) }
}

@Composable
fun QuestCard(quest: Quest, onClaim: () -> Unit) {
    val colors = Quill.colors
    val done = quest.isDone
    CardBox(highlight = done && !quest.claimed) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            IconBadge(questIcon(quest.kind), colors.accent, done)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                QText(quest.title, work(15.5f, FontWeight.SemiBold, lineHeight = 20f), colors.ink)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LearnBar(quest.fraction.toFloat(), Modifier.weight(1f))
                    QText("${minOf(quest.progress, quest.target)}/${quest.target}", work(13f), colors.muted)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LIcon(LIconName.DIAMOND, colors.link, 14.dp, filled = true)
                    QText("${quest.reward} Gems", work(13f, FontWeight.Medium), colors.ink2)
                }
            }
            if (quest.claimed) {
                Box(Modifier.semantics { contentDescription = "Abgeholt" }) { LIcon(LIconName.CHECK_CIRCLE, colors.link, 28.dp, 2f) }
            } else if (done) {
                AccentButton("Abholen", onClaim)
            }
        }
    }
}

/** The streak freeze: what it does, how many you have and a button to buy one with gems. */
@Composable
fun FreezeRow(gems: Int, freezes: Int, onBuy: () -> Unit) {
    val colors = Quill.colors
    val canBuy = gems >= LearnProgress.freezePrice && freezes < LearnProgress.maxFreezes
    CardBox {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            IconBadge(LIconName.SNOWFLAKE, colors.accent, freezes > 0)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                QText("Streak-Schutz", work(15.5f, FontWeight.SemiBold), colors.ink)
                QText(
                    "Rettet deine Serie, wenn du einen Tag auslässt. Du hast $freezes von ${LearnProgress.maxFreezes}.",
                    work(13.5f, lineHeight = 18f), colors.muted,
                )
            }
            AccentButton(
                "Kaufen · ${LearnProgress.freezePrice}", onBuy, enabled = canBuy,
                description = "Streak-Schutz kaufen für ${LearnProgress.freezePrice} Gems",
            )
        }
    }
}

@Composable
private fun SectionHeader(title: String, detail: String) {
    Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.Bottom) {
        QText(title, work(22f, FontWeight.SemiBold, tracking = -0.4f), Quill.colors.ink, Modifier.weight(1f))
        QText(detail, work(13.5f), Quill.colors.muted)
    }
}

/** The day's three quests and the week's challenge, with what claiming them pays, and the streak freeze to buy. */
@Composable
fun QuestsView(board: QuestBoard, gems: Int, freezes: Int, secondsLeft: Double, onClaim: (String) -> Unit, onBuyFreeze: () -> Unit) {
    val colors = Quill.colors
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("Heute", timeLeftLong(secondsLeft))
        for (quest in board.daily) QuestCard(quest) { onClaim(quest.id) }
        if (board.allDailyClaimed || board.bonusAvailable || board.bonusClaimed) {
            CardBox(highlight = board.bonusAvailable) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    IconBadge(LIconName.CHEST, colors.warn, board.bonusAvailable || board.bonusClaimed)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        QText("Alle drei geschafft", work(15.5f, FontWeight.SemiBold), colors.ink)
                        QText(if (board.bonusClaimed) "Bonus abgeholt" else "Dafür gibt es ${QuestBoard.bonusGems} Gems extra", work(13.5f), colors.muted)
                    }
                    if (board.bonusAvailable) AccentButton("Abholen", { onClaim("bonus") })
                    else if (board.bonusClaimed) Box(Modifier.semantics { contentDescription = "Abgeholt" }) { LIcon(LIconName.CHECK_CIRCLE, colors.link, 28.dp, 2f) }
                }
            }
        }
        board.weekly?.let { weekly ->
            SectionHeader("Diese Woche", "Wochenziel")
            QuestCard(weekly) { onClaim(weekly.id) }
        }
        SectionHeader("Streak-Schutz", "$freezes von ${LearnProgress.maxFreezes}")
        FreezeRow(gems, freezes, onBuyFreeze)
    }
}

@Composable
private fun statusColor(status: SkillStatus): Color {
    val colors = Quill.colors
    return when (status) {
        SkillStatus.MASTERED, SkillStatus.PROVISIONAL -> colors.link
        SkillStatus.DUE -> colors.warn
        SkillStatus.PRACTICING -> colors.ink2
        else -> colors.muted
    }
}

/** The goals of the course by unit: where each stands, what is missing, and a button to practise it. */
@Composable
fun SkillsView(courseTitle: String, rows: List<SkillRow>, onPractice: (SkillRow) -> Unit) {
    val colors = Quill.colors
    val units = rows.groupBy { it.skill.unitID }.values.toList()
    val reached = rows.count { it.status.isReached }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            QText("Fähigkeiten", work(26f, FontWeight.SemiBold, tracking = -0.6f), colors.ink)
            QText("$courseTitle · $reached von ${rows.size} erreicht", work(14.5f), colors.muted)
        }
        QText(
            "Eine Lektion zu bearbeiten reicht nicht: Ein Ziel gilt erst als erreicht, wenn du es ohne Hilfe richtig gemacht hast, auf jeder Stufe, " +
                "die es verlangt. Beherrscht ist es nach einer guten Runde an einem anderen Tag.",
            work(13.5f, lineHeight = 19f), colors.muted,
        )
        for (group in units) {
            val first = group.first().skill
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                QText("Einheit ${first.unitNumber} · ${first.unitTitle}", work(17f, FontWeight.SemiBold), colors.ink)
                for (row in group) SkillCard(row, onPractice)
            }
        }
    }
}

@Composable
private fun SkillCard(row: SkillRow, onPractice: (SkillRow) -> Unit) {
    val colors = Quill.colors
    val tone = statusColor(row.status)
    CardBox {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QText(row.skill.title, work(16f, FontWeight.SemiBold), colors.ink, Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    LIcon(skillStatusIcon(row.status), tone, 15.dp, 2.2f)
                    QText(row.status.title, work(12.5f, FontWeight.Medium), tone)
                }
            }
            QText(row.skill.goal, work(14f, lineHeight = 19f), colors.muted)
            if (row.waitingFor.isNotEmpty()) QText("Baut auf: " + row.waitingFor.joinToString(", "), work(13f, lineHeight = 18f), colors.warn)
            if (row.status != SkillStatus.MASTERED && row.status != SkillStatus.NOT_STARTED) {
                for (reason in row.reasons) QText(reason, work(13.5f, lineHeight = 18f), colors.ink2)
                Box(Modifier.padding(top = 2.dp)) {
                    OutlineButton(
                        if (row.status == SkillStatus.DUE) "Jetzt wiederholen" else "Gezielt üben", { onPractice(row) },
                        height = 38.dp, fontSize = 14f, weight = FontWeight.Medium,
                    )
                }
            }
        }
    }
}

/** The caption row of a section; kept here so the path and the pages use one look. */
@Composable
fun SectionCaption(text: String, modifier: Modifier = Modifier) = PixelCaption(text, modifier)
