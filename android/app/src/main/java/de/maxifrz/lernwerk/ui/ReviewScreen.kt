package de.maxifrz.lernwerk.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.data.ReviewCard
import de.maxifrz.lernwerk.review.ReviewGrade
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

@Composable
fun ReviewScreen(app: AppState) {
    val colors = Quill.colors
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(30_000)
            now = System.currentTimeMillis()
        }
    }
    var showAnswer by remember { mutableStateOf(false) }
    var reviewed by remember { mutableIntStateOf(0) }
    val cards = app.repository.cards.sortedBy { it.dueAt }
    val due = cards.filter { it.dueAt <= now }

    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.widthIn(max = 840.dp).fillMaxWidth().padding(start = 40.dp, end = 40.dp, top = 44.dp)) {
            PageHeader("Karteikarten", "Wiederholen") {
                QText(if (due.size == 1) "1 fällig" else "${due.size} fällig", work(14f), colors.muted, Modifier.padding(bottom = 6.dp))
            }
        }
        AnimatedContent(due.firstOrNull(), transitionSpec = { fadeIn(tween(300)) togetherWith fadeOut(tween(300)) }, contentKey = { it?.id }, label = "card") { card ->
            if (card != null) {
                CardView(card, showAnswer, reviewed, onShow = { showAnswer = true }) { grade ->
                    app.repository.updateCard(card.applying(grade))
                    showAnswer = false
                    reviewed++
                    now = System.currentTimeMillis()
                }
            } else {
                DoneView(reviewed, cards.firstOrNull(), now)
            }
        }
    }
}

@Composable
private fun CardView(card: ReviewCard, showAnswer: Boolean, reviewed: Int, onShow: () -> Unit, onRate: (ReviewGrade) -> Unit) {
    val colors = Quill.colors
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.widthIn(max = 704.dp).fillMaxSize().padding(start = 32.dp, end = 32.dp, top = 28.dp, bottom = 44.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Box(Modifier.height(14.dp)) {
                if (reviewed > 0) PixelCaption("$reviewed geschafft", color = colors.accent)
            }
            Spacer(Modifier.weight(1f))
            QText(card.front, work(30f, FontWeight.Light, tracking = -0.66f, lineHeight = 40f), colors.ink, textAlign = TextAlign.Center)
            AnimatedVisibility(showAnswer, enter = fadeIn(tween(300)) + slideInVertically { it / 8 }, exit = fadeOut(tween(200))) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    QuillDivider()
                    QText(card.back, work(18f, lineHeight = 28f), colors.ink2, textAlign = TextAlign.Center)
                    card.page?.let { QText("Aus deinem Material, Seite $it", work(12.5f), colors.faint) }
                }
            }
            Spacer(Modifier.weight(1f))
            if (showAnswer) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ReviewGrade.entries.forEach { grade ->
                        OutlineButton(grade.label, { onRate(grade) }, height = 44.dp, fontSize = 14.5f, weight = FontWeight.Medium) {
                            StatusDot(gradeColor(grade), 7.dp)
                        }
                    }
                }
            } else {
                PrimaryButton("Antwort zeigen", onShow, height = 52.dp, fontSize = 16f)
            }
        }
    }
}

@Composable
private fun gradeColor(grade: ReviewGrade): Color = when (grade) {
    ReviewGrade.AGAIN -> hex(0xC46A55)
    ReviewGrade.HARD -> Quill.colors.warn
    ReviewGrade.GOOD -> Quill.colors.accent
    ReviewGrade.EASY -> hex(0x6F8FB0)
}

@Composable
private fun DoneView(reviewed: Int, next: ReviewCard?, now: Long) {
    val colors = Quill.colors
    val text = when {
        reviewed > 0 -> "Stark – $reviewed Karten in dieser Runde geschafft."
        next == null -> "Karten entstehen automatisch, wenn du dir mit dem Hilfe-Werkzeug etwas erklären lässt."
        else -> "Die nächste Karte ist ${relative(next.dueAt, now)} fällig."
    }
    Column(
        Modifier.fillMaxSize().padding(start = 40.dp, end = 40.dp, bottom = 80.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { repeat(3) { StatusDot() } }
        QText("Alles wiederholt", work(30f, FontWeight.Light, tracking = -0.75f), colors.ink, Modifier.padding(top = 20.dp))
        QText(text, work(15.5f, lineHeight = 23f), colors.muted, Modifier.widthIn(max = 400.dp).padding(top = 14.dp), textAlign = TextAlign.Center)
    }
}

private fun relative(dueAt: Long, now: Long): String {
    val minutes = Duration.ofMillis(dueAt - now).toMinutes()
    if (minutes < 60) return "in ${maxOf(1, minutes)} Minuten"
    val zone = ZoneId.systemDefault()
    val days = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(zone), Instant.ofEpochMilli(dueAt).atZone(zone).toLocalDate())
    return when (days) {
        0L -> "in ${minutes / 60} Stunden"
        1L -> "morgen"
        2L -> "übermorgen"
        else -> "in $days Tagen"
    }
}
