package de.maxifrz.lernwerk.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.data.PlanTopic
import de.maxifrz.lernwerk.data.ReviewCard
import de.maxifrz.lernwerk.data.StudyPlan
import de.maxifrz.lernwerk.data.WikiSummary
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.notify.Reminders
import de.maxifrz.lernwerk.pdf.AndroidMaterialDocument
import de.maxifrz.lernwerk.plan.PlanCalendar
import de.maxifrz.lernwerk.plan.StudyAids
import de.maxifrz.lernwerk.plan.TopicAssistant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** Changes one topic of the plan as it is now, so answers that arrive late do not undo other changes. */
private fun AppState.updateTopic(planId: String, topicId: String, change: (PlanTopic) -> PlanTopic) {
    val plan = repository.plan(planId) ?: return
    repository.updatePlan(plan.copy(topics = plan.topics.map { if (it.id == topicId) change(it) else it }))
}

private fun openUrl(context: Context, url: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

private fun timeLabel(minute: Int) = "%02d:%02d".format(minute / 60, minute % 60)

/** Calendar export and the daily reminder of a plan. */
@Composable
fun PlanTools(app: AppState, plan: StudyPlan) {
    val context = LocalContext.current
    var permissionDenied by remember { mutableStateOf(false) }

    fun setReminder(minute: Int?) {
        val updated = plan.copy(reminderMinute = minute)
        app.repository.updatePlan(updated)
        Reminders.schedule(context, updated)
    }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permissionDenied = !granted
        if (granted) setReminder(plan.reminderMinute ?: DEFAULT_REMINDER)
    }

    QuillRow("Tägliche Erinnerung", verticalPadding = 10.dp) {
        QuillSwitch(plan.reminderMinute != null) { on ->
            when {
                !on -> setReminder(null)
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !Reminders.canNotify(context) ->
                    permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                else -> setReminder(DEFAULT_REMINDER)
            }
        }
    }
    plan.reminderMinute?.let { minute ->
        QuillRow("Um ${timeLabel(minute)} Uhr", verticalPadding = 10.dp) {
            Stepper(
                onMinus = { setReminder((minute - 15 + 24 * 60) % (24 * 60)) },
                onPlus = { setReminder((minute + 15) % (24 * 60)) },
            )
        }
    }
    if (permissionDenied) {
        Notice(
            "Ohne die Erlaubnis für Benachrichtigungen kann Schul-PIP nicht erinnern. Du kannst sie in den Android-Einstellungen der App erteilen.",
            modifier = Modifier.padding(vertical = 12.dp, horizontal = 2.dp),
        )
    }
    QuillRow("Termine im Kalender", verticalPadding = 10.dp) {
        OutlineButton("Als .ics teilen", {
            val directory = File(context.cacheDir, "exports").apply { mkdirs() }
            val name = plan.title.replace(Regex("[\\\\/:*?\"<>|]"), "").trim().ifEmpty { "Lernplan" }
            val file = File(directory, "$name.ics").apply { writeText(PlanCalendar.ics(plan)) }
            shareFile(context, file, "text/calendar")
        })
    }
    Footnote("Die Kalenderdatei enthält jedes Thema an seinem Lerntag und den Prüfungstermin – Google Kalender, Outlook und andere Apps können sie importieren. Nach „Ab heute neu verteilen“ einfach neu teilen.")
}

private const val DEFAULT_REMINDER = 17 * 60

/** Videos, Wikipedia, exercises and flashcards for one topic. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TopicExtras(app: AppState, planId: String, topic: PlanTopic) {
    val colors = Quill.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf<String?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }
    val revealed = remember { mutableStateMapOf<String, Boolean>() }

    suspend fun pages(): String {
        val material = app.repository.material(topic.materialId) ?: return ""
        val texts = app.repository.cachedPageTexts(material) ?: withContext(Dispatchers.IO) {
            AndroidMaterialDocument.open(app.repository.pdfFile(material).readBytes(), context.cacheDir)?.use { it.pageTexts }
        }
        return StudyAids.pagesText(topic, texts)
    }

    fun run(label: String, work: suspend () -> Unit) {
        if (busy != null) return
        busy = label
        problem = null
        scope.launch {
            try {
                work()
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                problem = failure.message ?: "Das hat nicht geklappt. Versuch es noch einmal."
            } finally {
                busy = null
            }
        }
    }

    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 10.dp)
            .background(colors.hoverSoft, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlineButton("▶ Videos", { openUrl(context, StudyAids.videoUrl(topic)) })
            OutlineButton("Wikipedia", {
                run("Wikipedia") {
                    val article = app.settings.wikipedia.summary(topic.title)
                        ?: error("Wikipedia hat keinen passenden Artikel gefunden.")
                    app.updateTopic(planId, topic.id) { it.copy(wiki = WikiSummary(article.title, article.url, article.text)) }
                }
            }, enabled = busy == null)
            OutlineButton(if (topic.exercises.isEmpty()) "Übungsaufgaben" else "Neue Aufgaben", {
                run("Übungsaufgaben") {
                    val exercises = TopicAssistant(app.settings.makeClient(LlmTask.PLAN)).exercises(topic, pages())
                    revealed.clear()
                    app.updateTopic(planId, topic.id) { it.copy(exercises = exercises) }
                }
            }, enabled = busy == null)
            OutlineButton("Karteikarten", {
                run("Karteikarten") {
                    val cards = TopicAssistant(app.settings.makeClient(LlmTask.PLAN)).flashcards(topic, pages())
                    val page = topic.sourcePages.minOrNull()
                    cards.forEach { app.repository.addCard(ReviewCard(front = it.front, back = it.back, materialId = topic.materialId, page = page)) }
                    app.updateTopic(planId, topic.id) { it.copy(cardCount = it.cardCount + cards.size) }
                }
            }, enabled = busy == null)
        }
        busy?.let { label ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PulsingDots()
                QText(if (label == "Wikipedia") "Suche auf Wikipedia …" else "Die KI schreibt $label …", work(13f), colors.muted)
            }
        }
        problem?.let { Notice(it) }
        if (topic.cardCount > 0) {
            QText(
                if (topic.cardCount == 1) "1 Karteikarte liegt im Wiederholen-Stapel." else "${topic.cardCount} Karteikarten liegen im Wiederholen-Stapel.",
                work(13f),
                colors.muted,
            )
        }
        topic.wiki?.let { wiki ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PixelCaption("Wikipedia · ${wiki.title}")
                QText(wiki.text, work(14f, lineHeight = 20f), colors.ink2)
                LinkButton("Ganzen Artikel lesen", { openUrl(context, wiki.url) }, style = work(13.5f, FontWeight.Medium))
            }
        }
        if (topic.exercises.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                PixelCaption("Übungsaufgaben")
                topic.exercises.forEachIndexed { index, exercise ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        QText("${index + 1}. ${exercise.question}", work(14.5f, lineHeight = 21f), colors.ink)
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            if (exercise.hint.isNotBlank()) {
                                val key = "hint$index"
                                LinkButton(if (revealed[key] == true) "Tipp ausblenden" else "Tipp", { revealed[key] = revealed[key] != true }, style = work(13f, FontWeight.Medium))
                            }
                            val key = "solution$index"
                            LinkButton(if (revealed[key] == true) "Lösung ausblenden" else "Lösung zeigen", { revealed[key] = revealed[key] != true }, style = work(13f, FontWeight.Medium))
                        }
                        if (revealed["hint$index"] == true) QText("Tipp: ${exercise.hint}", work(13.5f, lineHeight = 19f), colors.muted)
                        if (revealed["solution$index"] == true) QText(exercise.solution, work(13.5f, lineHeight = 19f), colors.ink2)
                    }
                }
            }
        }
    }
}
