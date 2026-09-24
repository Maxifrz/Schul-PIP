package de.maxifrz.lernwerk.ui

import android.graphics.BitmapFactory
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.tutor.HintLevel
import de.maxifrz.lernwerk.tutor.TutorSession
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun TutorPanel(session: TutorSession, onClose: () -> Unit, modifier: Modifier = Modifier) {
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var draft by remember { mutableStateOf("") }

    LaunchedEffect(session.turns.size, session.isLoading, session.errorMessage) {
        val count = listState.layoutInfo.totalItemsCount
        if (count > 0) listState.animateScrollToItem(count - 1)
    }

    val canSend = draft.isNotBlank() && !session.isLoading
    val send = {
        if (canSend) {
            val text = draft
            draft = ""
            scope.launch { session.answer(text) }
        }
    }

    Column(modifier.background(colors.bg).imePadding()) {
        // Header
        Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                QText("Lernhilfe", work(17f, FontWeight.Medium, tracking = -0.25f), colors.ink, Modifier.weight(1f))
                OutlineButton("Fertig", onClose, height = 32.dp, weight = FontWeight.Medium)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                HintLevel.entries.forEach { LadderStep(it, session.level) }
            }
            if (session.isDemo) {
                Notice(
                    "Demo-Modus: vorbereitete Beispielantworten, keine echte KI. Ausschalten unter Einstellungen.",
                    textColor = colors.muted,
                )
            }
            session.context.topicTitle?.let { QText("Thema im Lernplan: $it", work(12.5f), colors.faint) }
        }
        QuillDivider(colors.lineSoft)

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 6.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp),
        ) {
            item { MarkedRegionSnippet(session) }
            items(session.turns, key = { it.id }) { TurnView(it) }
            if (session.isLoading) item { WaitingIndicator(session.waitingFor, session.waitingSince) }
            session.errorMessage?.let { message ->
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Notice(message)
                        if (session.turns.isEmpty()) OutlineButton("Erneut versuchen", { scope.launch { session.start() } })
                    }
                }
            }
        }

        // Composer
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 20.dp)) {
            PipView(session.isLoading, Modifier.padding(horizontal = 6.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(colors.surface, RoundedCornerShape(26.dp))
                    .border(1.dp, colors.line2, RoundedCornerShape(26.dp))
                    .padding(start = 18.dp, top = 6.dp, end = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Box(Modifier.weight(1f).padding(vertical = 10.dp)) {
                    if (draft.isEmpty()) QText("Deine Antwort …", work(15.5f, tracking = -0.15f), colors.hint)
                    BasicTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        textStyle = work(15.5f, tracking = -0.15f).copy(color = colors.ink),
                        cursorBrush = SolidColor(colors.accent),
                        maxLines = 4,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = { send() }),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                SendButton(canSend) { send() }
            }
            Row(Modifier.fillMaxWidth().padding(top = 10.dp)) {
                val enabled = session.level != HintLevel.EXPLANATION && !session.isLoading
                OutlineButton("Mehr Hilfe", { scope.launch { session.requestMoreHelp() } }, enabled = enabled)
                Spacer(Modifier.weight(1f))
                OutlineButton("Sag's mir einfach", { scope.launch { session.revealExplanation() } }, enabled = enabled)
            }
        }
    }
}

@Composable
private fun LadderStep(level: HintLevel, current: HintLevel) {
    val colors = Quill.colors
    val isCurrent = level == current
    val isReached = level.number < current.number
    Box(
        Modifier
            .height(26.dp)
            .background(if (isCurrent) colors.ink else if (isReached) colors.hover else Color.Transparent, CircleShape)
            .border(1.dp, if (isCurrent) Color.Transparent else colors.line2, CircleShape)
            .padding(horizontal = 11.dp),
        contentAlignment = Alignment.Center,
    ) {
        QText(
            level.title,
            work(12.5f, if (isCurrent) FontWeight.Medium else FontWeight.Normal),
            if (isCurrent) colors.bg else if (isReached) colors.ink else colors.faint,
        )
    }
}

/** The marked passage as a paper snippet, so the conversation keeps its reference. */
@Composable
private fun MarkedRegionSnippet(session: TutorSession) {
    val colors = Quill.colors
    val text = session.context.selectedText.trim()
    val image = remember(session) { session.regionImage?.let { BitmapFactory.decodeByteArray(it, 0, it.size) } }
    Column(
        Modifier
            .fillMaxWidth()
            .background(colors.paper, RoundedCornerShape(8.dp))
            .border(1.dp, colors.line2, RoundedCornerShape(8.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PixelCaption("Seite ${session.context.pageNumber} · markiert", color = hex(0x9A968B), size = 9f)
        if (text.isNotEmpty()) {
            QText(text, work(13f, lineHeight = 19f), colors.paperInk, Modifier.heightIn(max = 110.dp), maxLines = 6)
        } else if (image != null) {
            Image(
                image.asImageBitmap(),
                contentDescription = "Markierter Bereich",
                contentScale = ContentScale.Fit,
                alignment = Alignment.CenterStart,
                modifier = Modifier.fillMaxWidth().heightIn(max = 130.dp),
            )
        }
    }
}

@Composable
private fun TurnView(turn: TutorSession.Turn) {
    val colors = Quill.colors
    when (turn.speaker) {
        TutorSession.Speaker.STUDENT -> Row(Modifier.fillMaxWidth().padding(start = 48.dp), horizontalArrangement = Arrangement.End) {
            SelectionContainer {
                QText(
                    turn.text,
                    work(15f, tracking = -0.15f, lineHeight = 21f),
                    colors.bg,
                    Modifier
                        .background(colors.ink, RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomStart = 20.dp, bottomEnd = 6.dp))
                        .padding(horizontal = 15.dp, vertical = 11.dp),
                )
            }
        }
        TutorSession.Speaker.TUTOR -> Column(Modifier.animateContentSize(), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            PixelCaption("Lernhilfe · ${turn.level.title}", size = 9f)
            SelectionContainer {
                BasicText(markdown(turn.text, colors.ink), style = work(15f, lineHeight = 23f).copy(color = colors.ink2))
            }
        }
    }
}

/** Markdown bold and italics in the Work Sans cuts; bold is also drawn in full ink. */
fun markdown(text: String, boldColor: Color): AnnotatedString = buildAnnotatedString {
    var i = 0
    while (i < text.length) {
        when {
            text.startsWith("**", i) -> {
                val end = text.indexOf("**", i + 2)
                if (end > i + 2) {
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = boldColor)) { append(text.substring(i + 2, end)) }
                    i = end + 2
                } else {
                    append("**"); i += 2
                }
            }
            text[i] == '*' && i + 1 < text.length && text[i + 1] != ' ' -> {
                val end = text.indexOf('*', i + 1)
                if (end > i + 1 && text[end - 1] != ' ') {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(text.substring(i + 1, end)) }
                    i = end + 1
                } else {
                    append('*'); i++
                }
            }
            else -> {
                append(text[i]); i++
            }
        }
    }
}

@Composable
private fun SendButton(enabled: Boolean, onClick: () -> Unit) {
    val colors = Quill.colors
    Canvas(
        Modifier
            .size(38.dp)
            .alpha(if (enabled) 1f else 0.4f)
            .clickable(remember { MutableInteractionSource() }, null, enabled = enabled, role = Role.Button, onClick = onClick),
    ) {
        drawCircle(colors.ink)
        val c = size.width / 2
        val arm = size.width * 0.18f
        val stroke = Stroke(size.width * 0.055f, cap = StrokeCap.Round)
        drawLine(colors.bg, Offset(c, c + arm * 1.1f), Offset(c, c - arm * 1.1f), stroke.width, StrokeCap.Round)
        drawLine(colors.bg, Offset(c - arm, c - arm * 0.1f), Offset(c, c - arm * 1.1f), stroke.width, StrokeCap.Round)
        drawLine(colors.bg, Offset(c + arm, c - arm * 0.1f), Offset(c, c - arm * 1.1f), stroke.width, StrokeCap.Round)
    }
}

@Composable
private fun WaitingIndicator(label: String?, since: Long?) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(since) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }
    val seconds = since?.let { maxOf(0L, (now - it) / 1000) } ?: 0L
    val base = "${label ?: "Warte"} … $seconds s"
    val text = if (seconds >= 30) "$base – kostenlose Modelle brauchen manchmal etwas länger" else base
    Row(Modifier.padding(top = 2.dp, bottom = 20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        PulsingDots()
        QText(text, work(13f).copy(fontFeatureSettings = "tnum"), Quill.colors.faint)
    }
}
