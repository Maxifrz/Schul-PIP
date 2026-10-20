package de.maxifrz.lernwerk.ui.learn

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LessonModel
import de.maxifrz.lernwerk.learn.PairOutcome
import de.maxifrz.lernwerk.ui.QText
import de.maxifrz.lernwerk.ui.Quill
import de.maxifrz.lernwerk.ui.pixel
import de.maxifrz.lernwerk.ui.work

// The answer areas of the exercise kinds: choosing, pairing, putting words together and typing.

/** How a tile or option looks. */
enum class TileState { NONE, PICKED, RIGHT, WRONG, MISSED, MATCHED, GONE }

/** The border and fill of a state, from the app's tokens. */
@Composable
private fun tileColors(state: TileState): Pair<Color, Color> {
    val colors = Quill.colors
    return when (state) {
        TileState.NONE -> colors.line2 to colors.surface
        TileState.PICKED -> colors.accent to colors.accent.copy(alpha = 0.16f)
        TileState.RIGHT -> LearnTone.right to LearnTone.right.copy(alpha = 0.14f)
        TileState.WRONG, TileState.MISSED -> LearnTone.wrong to LearnTone.wrong.copy(alpha = 0.12f)
        TileState.MATCHED -> colors.line to colors.hoverSoft
        TileState.GONE -> colors.line to colors.hoverSoft
    }
}

@Composable
private fun OptionCard(
    text: String,
    state: TileState,
    description: String,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    leading: String? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: () -> Unit,
) {
    val colors = Quill.colors
    val (border, fill) = tileColors(state)
    val faded = state == TileState.MATCHED || state == TileState.GONE
    Row(
        modifier
            .heightIn(min = 54.dp)
            .background(fill, RoundedCornerShape(16.dp))
            .border(if (state == TileState.PICKED || state == TileState.RIGHT || state == TileState.WRONG) 2.dp else 1.dp, border, RoundedCornerShape(16.dp))
            .semantics { contentDescription = description }
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (leading != null) QText(leading, pixel(10f), colors.hint)
        QText(
            text, work(16f, FontWeight.Medium, lineHeight = 21f), if (faded) colors.hint else colors.ink,
            Modifier.weight(1f),
        )
        trailing?.invoke()
    }
}

@Composable
fun MultipleChoiceView(options: List<String>, correct: String, choice: String?, verdict: Boolean?, onPick: (String) -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        options.forEachIndexed { index, option ->
            val state = when {
                verdict == null -> if (choice == option) TileState.PICKED else TileState.NONE
                option == correct -> TileState.RIGHT
                option == choice -> TileState.WRONG
                else -> TileState.NONE
            }
            OptionCard(
                text = option, state = state, description = "Antwort ${index + 1} von ${options.size}: $option", enabled = verdict == null,
                leading = "${index + 1}", modifier = Modifier.fillMaxWidth(),
                trailing = {
                    if (verdict != null && option == correct) LIcon(LIconName.CHECK, LearnTone.right, 20.dp, 2.4f)
                    if (verdict != null && option != correct && option == choice) LIcon(LIconName.CLOSE, LearnTone.wrong, 20.dp, 2.4f)
                },
            ) { onPick(option) }
        }
    }
}

/** Pairing: the fronts left, the backs right; the state of the pairing lives in the [model]. */
@Composable
@Suppress("UNUSED_PARAMETER")
fun MatchPairsView(exercise: LearnExercise, model: LessonModel, version: Int, onChange: (PairOutcome?) -> Unit) {
    val matched = model.matched.toSet()
    val matchedBacks = model.matchedBacks.toSet()
    val miss = model.lastMiss
    val pickedFront = model.pickedFront
    val pickedBack = model.pickedBack
    val locked = !model.isAnswering
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for (pair in exercise.pairs) {
                val state = when {
                    pair.key in matched -> TileState.MATCHED
                    miss?.key == pair.key -> TileState.MISSED
                    pickedFront == pair.key -> TileState.PICKED
                    else -> TileState.NONE
                }
                OptionCard(
                    pair.front, state, "Frage: ${pair.front}", enabled = !locked && pair.key !in matched, modifier = Modifier.fillMaxWidth(),
                ) { onChange(model.pickFront(pair.key)) }
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            exercise.options.forEachIndexed { index, text ->
                val state = when {
                    index in matchedBacks -> TileState.MATCHED
                    miss?.back == index -> TileState.MISSED
                    pickedBack == index -> TileState.PICKED
                    else -> TileState.NONE
                }
                OptionCard(
                    text, state, "Antwort: $text", enabled = !locked && index !in matchedBacks, modifier = Modifier.fillMaxWidth(),
                ) { onChange(model.pickBack(index)) }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WordBankView(options: List<String>, chosen: List<Int>, verdict: Boolean?, onAdd: (Int) -> Unit, onRemove: (Int) -> Unit) {
    val colors = Quill.colors
    val lineColor = when (verdict) {
        true -> LearnTone.right
        false -> LearnTone.wrong
        null -> colors.line2
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        // The answer line: the words so far, on a ruled line.
        Box(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 64.dp)
                .background(colors.surface, RoundedCornerShape(16.dp))
                .border(if (verdict == null) 1.dp else 2.dp, lineColor, RoundedCornerShape(16.dp))
                .padding(12.dp)
                .semantics { contentDescription = if (chosen.isEmpty()) "Deine Antwort, noch leer" else "Deine Antwort" },
        ) {
            if (chosen.isEmpty()) QText("Tippe die Wörter in der richtigen Reihenfolge", work(14f), colors.hint)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (index in chosen) {
                    WordTile(options.getOrElse(index) { "" }, TileState.NONE, "In deiner Antwort: ${options.getOrElse(index) { "" }}. Nimmt das Wort wieder heraus", verdict == null) { onRemove(index) }
                }
            }
        }
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEachIndexed { index, word ->
                if (index in chosen) WordTile(word, TileState.GONE, "", false, hidden = true) {}
                else WordTile(word, TileState.NONE, "Wort: $word. Fügt das Wort deiner Antwort hinzu", verdict == null) { onAdd(index) }
            }
        }
    }
}

@Composable
private fun WordTile(text: String, state: TileState, description: String, enabled: Boolean, hidden: Boolean = false, onClick: () -> Unit) {
    val colors = Quill.colors
    val (border, fill) = tileColors(state)
    Box(
        Modifier
            .heightIn(min = 44.dp)
            .background(if (hidden) colors.hoverSoft else fill, RoundedCornerShape(12.dp))
            .border(1.dp, if (hidden) colors.lineSoft else border, RoundedCornerShape(12.dp))
            .then(if (hidden) Modifier else Modifier.semantics { contentDescription = description }.clickable(enabled = enabled, role = Role.Button, onClick = onClick))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        QText(text, work(16f, FontWeight.Medium), if (hidden) Color.Transparent else colors.ink)
    }
}

@Composable
fun TypeAnswerView(value: String, verdict: Boolean?, mode: AnswerMode, onChange: (String) -> Unit, onDone: () -> Unit) {
    val colors = Quill.colors
    val focus = remember { FocusRequester() }
    LaunchedEffect(verdict == null) {
        if (verdict == null) try { focus.requestFocus() } catch (e: Exception) { /* not attached yet */ }
    }
    val border = when (verdict) {
        true -> LearnTone.right
        false -> LearnTone.wrong
        null -> colors.line2
    }
    BasicTextField(
        value = value,
        onValueChange = onChange,
        enabled = verdict == null,
        singleLine = true,
        textStyle = work(18f, FontWeight.Medium).copy(color = colors.ink),
        cursorBrush = SolidColor(colors.accent),
        keyboardOptions = KeyboardOptions(
            capitalization = if (mode == AnswerMode.TEXT) KeyboardCapitalization.Sentences else KeyboardCapitalization.None,
            keyboardType = if (mode == AnswerMode.NUMBER) KeyboardType.Decimal else KeyboardType.Text,
            autoCorrectEnabled = mode == AnswerMode.TEXT,
            imeAction = androidx.compose.ui.text.input.ImeAction.Done,
        ),
        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { onDone() }),
        modifier = Modifier
            .fillMaxWidth()
            .focusRequester(focus)
            .semantics { contentDescription = "Deine Antwort" },
        decorationBox = { inner ->
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .background(colors.surface, RoundedCornerShape(16.dp))
                    .border(if (verdict == null) 1.dp else 2.dp, border, RoundedCornerShape(16.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                if (value.isEmpty()) QText("Deine Antwort", work(18f), colors.hint)
                inner()
            }
        },
    )
}

/** A small round marker used in the end screen and the cards. */
@Composable
fun Dot(color: Color, size: androidx.compose.ui.unit.Dp = 8.dp) {
    Box(Modifier.size(size).background(color, CircleShape))
}
