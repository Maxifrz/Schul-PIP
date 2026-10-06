package de.maxifrz.lernwerk.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.data.ReviewCard
import de.maxifrz.lernwerk.review.AnswerCheck
import de.maxifrz.lernwerk.review.ReviewGrade
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Flashcards by typing: the student answers the question, the app says "Richtig" or "Falsch" (compared on the device,
 * no AI) and schedules the card with SM-2: right is "good", wrong is "again". After a wrong answer the same question
 * can come back at once (a switch), the solution can be looked at, and a wrong verdict can be overruled.
 */
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
    // The card being answered stays put while the verdict shows, although a graded card has already left the due list.
    var heldId by remember { mutableStateOf<String?>(null) }
    var answer by remember { mutableStateOf("") }
    var verdict by remember { mutableStateOf<AnswerCheck.Verdict?>(null) }
    var overruled by remember { mutableStateOf(false) }
    var solutionShown by remember { mutableStateOf(false) }
    var graded by remember { mutableStateOf(setOf<String>()) }
    var reviewed by remember { mutableIntStateOf(0) }
    val cards = app.repository.cards.sortedBy { it.dueAt }
    val due = cards.filter { it.dueAt <= now }
    val current = cards.firstOrNull { it.id == heldId } ?: due.firstOrNull()
    val repeatWrong = app.settings.repeatWrongAnswer
    val correct = verdict == AnswerCheck.Verdict.CORRECT || overruled

    /** The first answer to a card decides its schedule; a retry or an overruled verdict is settled when the student moves on. */
    fun settle(card: ReviewCard) {
        if (card.id in graded) return
        graded = graded + card.id
        app.repository.updateCard(card.applying(if (correct) ReviewGrade.GOOD else ReviewGrade.AGAIN))
        if (correct) reviewed++
        now = System.currentTimeMillis()
    }

    fun reset(keepCard: Boolean) {
        answer = ""
        verdict = null
        overruled = false
        solutionShown = false
        if (!keepCard) heldId = null
    }

    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.widthIn(max = 840.dp).fillMaxWidth().padding(start = 40.dp, end = 40.dp, top = 44.dp)) {
            PageHeader("Karteikarten", "Wiederholen") {
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 4.dp)) {
                    QText(if (due.size == 1) "1 fällig" else "${due.size} fällig", work(14f), colors.muted)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        QText("Bei falsch gleich nochmal", work(13f), colors.muted)
                        QuillSwitch(repeatWrong, app.settings::updateRepeatWrongAnswer)
                    }
                }
            }
        }
        AnimatedContent(current, transitionSpec = { fadeIn(tween(300)) togetherWith fadeOut(tween(300)) }, contentKey = { it?.id }, label = "card") { card ->
            if (card != null) {
                CardView(
                    card = card,
                    answer = answer,
                    onAnswer = { answer = it },
                    verdict = verdict,
                    correct = correct,
                    solutionShown = solutionShown,
                    repeatWrong = repeatWrong,
                    reviewed = reviewed,
                    onCheck = {
                        if (answer.isNotBlank()) {
                            verdict = AnswerCheck.evaluate(answer, card.back)
                            heldId = card.id
                            overruled = false
                            solutionShown = false
                        }
                    },
                    onRetry = {
                        settle(card)
                        reset(keepCard = true)
                    },
                    onNext = {
                        settle(card)
                        graded = graded - card.id
                        reset(keepCard = false)
                    },
                    onShowSolution = { solutionShown = true },
                    onOverrule = { overruled = true },
                )
            } else {
                DoneView(reviewed, cards.firstOrNull(), now)
            }
        }
    }
}

@Composable
private fun CardView(
    card: ReviewCard,
    answer: String,
    onAnswer: (String) -> Unit,
    verdict: AnswerCheck.Verdict?,
    correct: Boolean,
    solutionShown: Boolean,
    repeatWrong: Boolean,
    reviewed: Int,
    onCheck: () -> Unit,
    onRetry: () -> Unit,
    onNext: () -> Unit,
    onShowSolution: () -> Unit,
    onOverrule: () -> Unit,
) {
    val colors = Quill.colors
    val focus = remember { FocusRequester() }
    LaunchedEffect(card.id, verdict == null) {
        if (verdict == null) runCatching { focus.requestFocus() }
    }
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
            QText(card.front, work(30f, FontWeight.SemiBold, tracking = -0.66f, lineHeight = 40f), colors.ink, textAlign = TextAlign.Center)
            if (verdict == null) {
                val shape = RoundedCornerShape(18.dp)
                Box(
                    Modifier.fillMaxWidth().background(colors.surface, shape).border(1.dp, colors.line2, shape).padding(horizontal = 22.dp, vertical = 16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    if (answer.isEmpty()) QText("Deine Antwort", work(18f), colors.hint)
                    BasicTextField(
                        value = answer,
                        onValueChange = onAnswer,
                        singleLine = true,
                        textStyle = work(18f).copy(color = colors.ink, textAlign = TextAlign.Center),
                        cursorBrush = SolidColor(colors.accent),
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { onCheck() }),
                        modifier = Modifier.fillMaxWidth().focusRequester(focus),
                    )
                }
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    QText(
                        if (correct) "Richtig" else "Falsch",
                        work(52f, FontWeight.ExtraBold, tracking = -1.5f),
                        if (correct) colors.link else hex(0xC46A55),
                    )
                    AnimatedVisibility(solutionShown, enter = fadeIn(tween(300)) + slideInVertically { it / 8 }, exit = fadeOut(tween(200))) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            QuillDivider()
                            QText(card.back, work(18f, lineHeight = 28f), colors.ink2, textAlign = TextAlign.Center)
                            card.page?.let { QText("Aus deinem Material, Seite $it", work(12.5f), colors.faint) }
                        }
                    }
                }
            }
            Spacer(Modifier.weight(1f))
            if (verdict == null) {
                PrimaryButton("Prüfen", onCheck, height = 52.dp, fontSize = 16f)
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (!correct && repeatWrong) {
                            PrimaryButton("Nochmal versuchen", onRetry, height = 52.dp, fontSize = 16f)
                            OutlineButton("Weiter", onNext, height = 52.dp, fontSize = 16f, weight = FontWeight.Medium)
                        } else {
                            PrimaryButton("Weiter", onNext, height = 52.dp, fontSize = 16f)
                        }
                    }
                    if (!correct) {
                        Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
                            if (!solutionShown) LinkButton("Lösung ansehen", onShowSolution, colors.muted, work(14f, FontWeight.Medium))
                            LinkButton("War doch richtig", onOverrule, colors.muted, work(14f, FontWeight.Medium))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DoneView(reviewed: Int, next: ReviewCard?, now: Long) {
    val colors = Quill.colors
    val text = when {
        reviewed > 0 -> "Stark – $reviewed Karten in dieser Runde richtig."
        next == null -> "Karten entstehen automatisch, wenn du dir mit dem Hilfe-Werkzeug etwas erklären lässt."
        else -> "Die nächste Karte ist ${relative(next.dueAt, now)} fällig."
    }
    Column(
        Modifier.fillMaxSize().padding(start = 40.dp, end = 40.dp, bottom = 80.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { repeat(3) { StatusDot() } }
        QText("Alles wiederholt", work(30f, FontWeight.SemiBold, tracking = -0.75f), colors.ink, Modifier.padding(top = 20.dp))
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
