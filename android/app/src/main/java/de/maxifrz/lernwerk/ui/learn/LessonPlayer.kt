package de.maxifrz.lernwerk.ui.learn

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnProgress
import de.maxifrz.lernwerk.learn.LearnVerdict
import de.maxifrz.lernwerk.learn.LessonModel
import de.maxifrz.lernwerk.learn.LessonResult
import de.maxifrz.lernwerk.learn.LessonRewards
import de.maxifrz.lernwerk.ui.DialogCard
import de.maxifrz.lernwerk.ui.LinkButton
import de.maxifrz.lernwerk.ui.OutlineButton
import de.maxifrz.lernwerk.ui.PixelCaption
import de.maxifrz.lernwerk.ui.PrimaryButton
import de.maxifrz.lernwerk.ui.QText
import de.maxifrz.lernwerk.ui.Quill
import de.maxifrz.lernwerk.ui.work

// One round of the Lernpfad, in the whole screen: progress at the top, the exercise in the middle and, after each
// answer, a bar with the verdict. The finished round is recorded once by the state; the end screen shows what it
// brought. A port of desktop/src/views/learn/LessonPlayer.tsx.

/** What a kind of exercise asks the student to do, shown above the question. */
fun exerciseCaption(kind: ExerciseKind): String = when (kind) {
    ExerciseKind.MULTIPLE_CHOICE -> "Wähle die richtige Antwort"
    ExerciseKind.MATCH_PAIRS -> "Finde die Paare"
    ExerciseKind.WORD_BANK -> "Bilde die Antwort"
    ExerciseKind.TYPE_ANSWER -> "Schreib die Antwort"
    ExerciseKind.CHESS_MOVE -> "Finde den Zug"
    ExerciseKind.PIANO_KEY -> "Tippe die Taste"
}

/** The round of the state, or nothing while none is open. */
@Composable
fun LessonPlayerHost(ui: LearnUi) {
    val active = ui.active ?: return
    androidx.compose.runtime.key(active.id) {
        val speech = rememberSpeechEngine()
        LessonPlayer(ui, active, speech)
    }
}

@Composable
fun LessonPlayer(ui: LearnUi, active: ActiveRun, speech: SpeechEngine) {
    val model = active.model
    var version by remember { mutableIntStateOf(0) }
    var confirming by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf<Pair<LessonResult, LessonRewards>?>(null) }

    fun reportIfFinished() {
        val result = model.takeResult()
        if (result != null) done = result to ui.finishRun(result)
    }
    fun check() {
        if (model.check() != null) version += 1
    }
    fun next() {
        model.advance()
        version += 1
        reportIfFinished()
    }
    LaunchedEffect(Unit) { reportIfFinished() }
    BackHandler(enabled = done == null && !confirming) { confirming = true }

    val finished = done
    // Reading the version here makes the whole round read the model again after each change.
    val shown = version
    Column(Modifier.fillMaxSize().background(Quill.colors.bg)) {
        LessonTop(if (finished != null) 1f else model.session.progress.toFloat(), onClose = { if (finished != null) ui.closeRun() else confirming = true })
        if (finished != null) {
            LessonCompleteView(ui, finished.first, finished.second, onClose = ui::closeRun)
        } else {
            val exercise = model.current
            if (exercise != null) {
                ExerciseScreen(exercise, model, speech, shown, onChange = { version += 1 }, onCheck = ::check, onNext = ::next)
            } else {
                Spacer(Modifier.weight(1f))
            }
        }
    }
    if (confirming) {
        Dialog(onDismissRequest = { confirming = false }) {
            DialogCard("Lernen") {
                QText("Lektion abbrechen?", work(20f, FontWeight.SemiBold), Quill.colors.ink)
                QText(
                    "Was du in dieser Lektion beantwortet hast, wird nicht gezählt.",
                    work(15f, lineHeight = 21f), Quill.colors.ink2, Modifier.padding(top = 8.dp),
                )
                Column(Modifier.fillMaxWidth().padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PrimaryButton("Lektion abbrechen", { confirming = false; ui.closeRun() }, Modifier.fillMaxWidth())
                    OutlineButton("Weiterlernen", { confirming = false }, Modifier.fillMaxWidth(), height = 44.dp, fontSize = 15f)
                }
            }
        }
    }
}

@Composable
private fun LessonTop(progress: Float, onClose: () -> Unit) {
    val colors = Quill.colors
    val animated by animateFloatAsState(progress.coerceIn(0f, 1f), tween(350), label = "lesson")
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            Modifier.size(44.dp).clip(CircleShape).semantics { contentDescription = "Lektion abbrechen" }.clickable(role = Role.Button, onClick = onClose),
            contentAlignment = Alignment.Center,
        ) { LIcon(LIconName.CLOSE, colors.muted, 22.dp, 2.2f) }
        Canvas(
            Modifier.weight(1f).height(12.dp).padding(end = 12.dp)
                .semantics { contentDescription = "Fortschritt ${(animated * 100).toInt()} Prozent" },
        ) {
            val radius = CornerRadius(size.height / 2)
            drawRoundRect(colors.line, cornerRadius = radius)
            if (animated > 0f) drawRoundRect(colors.accent, size = Size(maxOf(size.height, size.width * animated), size.height), cornerRadius = radius)
        }
    }
}

/** The media above a question: a word to hear, a staff, notes to hear, a position. */
@Composable
fun ExerciseMediaView(exercise: LearnExercise, speech: SpeechEngine) {
    when (val media = exercise.media) {
        null -> Unit
        is ExerciseMedia.Speech ->
            // When the question does not show the words, they are said once on their own.
            SpeakButtons(speech, media.text, media.language, autoplay = !exercise.prompt.contains(media.text))
        is ExerciseMedia.Staff -> StaffView(media.staff)
        is ExerciseMedia.Tones -> TonePlayButton(media.tones)
        is ExerciseMedia.Board -> if (exercise.kind != ExerciseKind.CHESS_MOVE) ChessBoardView(media.board, Modifier.widthIn(max = 360.dp).fillMaxWidth())
    }
}

@Composable
private fun androidx.compose.foundation.layout.ColumnScope.ExerciseScreen(
    exercise: LearnExercise,
    model: LessonModel,
    speech: SpeechEngine,
    version: Int,
    onChange: () -> Unit,
    onCheck: () -> Unit,
    onNext: () -> Unit,
) {
    val colors = Quill.colors
    val verdict = model.verdict
    val verdictBool: Boolean? = verdict?.let { it == LearnVerdict.RIGHT }
    val scroll = rememberScrollState()
    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier
                .widthIn(max = 640.dp)
                .fillMaxWidth()
                .verticalScroll(scroll)
                .padding(horizontal = 20.dp)
                .padding(top = 12.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PixelCaption(exerciseCaption(exercise.kind), color = colors.link)
                if (model.session.isRetry) PixelCaption("Nochmal", color = colors.warn)
            }
            if (exercise.kind != ExerciseKind.MATCH_PAIRS) {
                QText(exercise.prompt, work(24f, FontWeight.SemiBold, tracking = -0.5f, lineHeight = 31f), colors.ink)
            }
            ExerciseMediaView(exercise, speech)
            ExerciseArea(exercise, model, version, verdictBool, onChange, onCheck)
            val hints = model.hintsShown.toList()
            if (hints.isNotEmpty()) HintBox(hints)
        }
    }
    if (verdict != null) {
        FeedbackBar(exercise, model, onNext, onOverrule = { model.overrule(); onChange() })
    } else {
        Row(
            Modifier.fillMaxWidth().background(colors.bg).padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (model.hasMoreHints) {
                OutlineButton(
                    "Hinweis ${model.hintsShown.size + 1}/${model.hintTotal}", { model.showHint(); onChange() },
                    height = 48.dp, fontSize = 15f, weight = FontWeight.Medium,
                )
            }
            if (exercise.kind != ExerciseKind.MATCH_PAIRS) {
                PrimaryButton("Prüfen", onCheck, Modifier.widthIn(max = 420.dp).weight(1f), height = 48.dp, fontSize = 16f, enabled = model.canCheck)
            }
        }
    }
}

@Composable
private fun HintBox(hints: List<String>) {
    val colors = Quill.colors
    Column(
        Modifier.fillMaxWidth().background(colors.warn.copy(alpha = 0.12f), RoundedCornerShape(14.dp)).border(1.dp, colors.warn.copy(alpha = 0.5f), RoundedCornerShape(14.dp)).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        for (text in hints) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LIcon(LIconName.BULB, colors.warn, 18.dp, 2f)
                QText(text, work(15f, lineHeight = 21f), colors.ink2, Modifier.weight(1f))
            }
        }
        QText("Mit Hinweis zählt die Antwort nur halb für deinen Kompetenzstand.", work(12.5f), colors.muted)
    }
}

/** The answer area of the exercise's kind. [verdict] is true for right, false for wrong, null while answering. */
@Composable
fun ExerciseArea(exercise: LearnExercise, model: LessonModel, version: Int, verdict: Boolean?, onChange: () -> Unit, onCheck: () -> Unit) {
    when (exercise.kind) {
        ExerciseKind.MULTIPLE_CHOICE -> MultipleChoiceView(
            exercise.options, exercise.correctAnswers.firstOrNull() ?: "", model.choice, verdict,
        ) { if (model.isAnswering) { model.choice = it; onChange() } }
        ExerciseKind.MATCH_PAIRS -> MatchPairsView(exercise, model, version) { onChange() }
        ExerciseKind.WORD_BANK -> WordBankView(
            exercise.options, model.tiles.toList(), verdict, onAdd = { model.addTile(it); onChange() }, onRemove = { model.removeTile(it); onChange() },
        )
        ExerciseKind.TYPE_ANSWER -> TypeAnswerView(
            model.typed, verdict, exercise.mode, onChange = { model.typed = it; onChange() }, onDone = { if (model.canCheck) onCheck() },
        )
        ExerciseKind.CHESS_MOVE -> {
            val media = exercise.media
            if (media is ExerciseMedia.Board) {
                ChessMoveView(media.board, model.moveFrom, model.moveTo, exercise.correctAnswers, verdict) { model.tapSquare(it); onChange() }
            }
        }
        ExerciseKind.PIANO_KEY -> PianoKeysView(
            exercise.correctAnswers.mapNotNull { it.toIntOrNull() }, model.choice, verdict,
            onPick = { if (model.isAnswering) { model.choice = it; onChange() } },
        )
    }
}

/** The verdict after an answer: green or red, the right answer after a wrong one and "Weiter". */
@Composable
fun FeedbackBar(exercise: LearnExercise, model: LessonModel, onNext: () -> Unit, onOverrule: () -> Unit) {
    val colors = Quill.colors
    val wrongAnswer = model.verdict == LearnVerdict.WRONG
    val tone = if (wrongAnswer) LearnTone.wrong else LearnTone.right
    val shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
    Box(Modifier.fillMaxWidth().background(androidx.compose.ui.graphics.lerp(colors.bg, tone, 0.14f), shape).border(1.dp, tone.copy(alpha = 0.35f), shape), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 640.dp).fillMaxWidth().padding(horizontal = 20.dp).padding(top = 18.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(
                Modifier.heightIn(max = 300.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LIcon(if (wrongAnswer) LIconName.CLOSE else LIconName.CHECK_CIRCLE, tone, 28.dp, 2.2f)
                    QText(if (wrongAnswer) "Falsch" else "Richtig", work(22f, FontWeight.SemiBold), tone)
                }
                if (wrongAnswer) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        PixelCaption("Richtige Antwort", color = tone)
                        QText(exercise.solution, work(17f, FontWeight.Medium, lineHeight = 23f), colors.ink)
                    }
                }
                if (model.coachNote.isNotEmpty()) QText(model.coachNote, work(15f, FontWeight.Medium, lineHeight = 21f), colors.ink2)
                if (exercise.explanation.isNotEmpty()) QText(exercise.explanation, work(15f, lineHeight = 21f), colors.muted)
                if (wrongAnswer && !model.session.isRetry) QText("Diese Aufgabe kommt am Ende noch einmal.", work(13f), colors.muted)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                if (wrongAnswer && exercise.kind == ExerciseKind.TYPE_ANSWER) LinkButton("War doch richtig", onOverrule, colors.muted, work(15f))
                Spacer(Modifier.weight(1f))
                PrimaryButton("Weiter", onNext, Modifier.widthIn(min = 160.dp), height = 48.dp, fontSize = 16f)
            }
        }
    }
}

/** The end of a round: Pip, the XP it brought, how much was right on the first try, the streak and the daily goal. */
@Composable
fun LessonCompleteView(ui: LearnUi, result: LessonResult, rewards: LessonRewards, onClose: () -> Unit) {
    val colors = Quill.colors
    ui.tick
    val state = ui.progress.progress
    val calendar = ui.calendar()
    val now = ui.now()
    val xp = LearnProgress.xp(result)
    val streak = state.currentStreak(now, calendar)
    val xpToday = state.xpToday(now, calendar)
    val goal = state.dailyGoal
    val percent = Math.round(result.accuracy * 100).toInt()
    val headline = if (percent == 100) "Fehlerfrei!" else if (percent >= 80) "Stark gemacht!" else "Lektion geschafft"
    val reached = xpToday >= goal
    Column(Modifier.fillMaxSize().background(colors.bg), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            Column(
                Modifier.widthIn(max = 560.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(top = 12.dp, bottom = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                PipMark(7.dp)
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PixelCaption("Lernpfad")
                    QText(headline, work(34f, FontWeight.SemiBold, tracking = -0.9f), colors.ink, textAlign = TextAlign.Center)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatBox("+$xp", "XP", Modifier.weight(1f))
                    StatBox("$percent %", "Beim ersten Mal", Modifier.weight(1f))
                    StatBox("$streak", if (streak == 1) "Tag in Folge" else "Tage in Folge", Modifier.weight(1f))
                }
                CardBox {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        QText(if (reached) "Tagesziel erreicht" else "Tagesziel", work(16f, FontWeight.SemiBold), if (reached) colors.link else colors.ink, Modifier.weight(1f))
                        QText("${minOf(xpToday, 9999)} / $goal XP", work(13.5f), colors.muted)
                    }
                    LearnBar(xpToday.toFloat() / maxOf(1, goal), Modifier.padding(top = 10.dp))
                }
                if (rewards.gems > 0 || rewards.quests.isNotEmpty() || rewards.freezesUsed > 0 || rewards.notes.isNotEmpty()) {
                    CardBox {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            if (rewards.gems > 0) ExtraRow(LIconName.DIAMOND, colors.link, "+${rewards.gems} Gems", filled = true)
                            for (title in rewards.quests) ExtraRow(LIconName.SEAL, colors.accent, "Quest geschafft: $title")
                            for (note in rewards.notes) ExtraRow(LIconName.INFO, colors.muted, note)
                            if (rewards.freezesUsed > 0) {
                                ExtraRow(
                                    LIconName.SNOWFLAKE, colors.warn,
                                    if (rewards.freezesUsed == 1) "Ein Streak-Schutz hat deine Serie gerettet" else "${rewards.freezesUsed} Streak-Schütze haben deine Serie gerettet",
                                )
                            }
                        }
                    }
                }
            }
        }
        Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), contentAlignment = Alignment.Center) {
            PrimaryButton("Weiter", onClose, Modifier.widthIn(max = 420.dp).fillMaxWidth(), height = 48.dp, fontSize = 16f)
        }
    }
}

@Composable
private fun ExtraRow(icon: LIconName, color: Color, text: String, filled: Boolean = false) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
        LIcon(icon, color, 20.dp, 2f, filled)
        QText(text, work(15f, lineHeight = 21f), Quill.colors.ink, Modifier.weight(1f))
    }
}

@Composable
private fun StatBox(value: String, label: String, modifier: Modifier) {
    val colors = Quill.colors
    Column(
        modifier.background(colors.surface, RoundedCornerShape(16.dp)).border(1.dp, colors.line, RoundedCornerShape(16.dp)).padding(vertical = 14.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        QText(value, work(24f, FontWeight.SemiBold, tracking = -0.5f), colors.ink, maxLines = 1)
        QText(label, work(12.5f), colors.muted, textAlign = TextAlign.Center)
    }
}
