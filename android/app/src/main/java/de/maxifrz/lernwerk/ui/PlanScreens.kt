package de.maxifrz.lernwerk.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.data.PlanTopic
import de.maxifrz.lernwerk.data.StudyPlan
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.pdf.AndroidMaterialDocument
import de.maxifrz.lernwerk.plan.PlanGenerator
import de.maxifrz.lernwerk.plan.PlanScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.Closeable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

private val longDate = DateTimeFormatter.ofPattern("d. MMMM yyyy", Locale.GERMAN)
private val dayTitle = DateTimeFormatter.ofPattern("EEEE, d. MMMM", Locale.GERMAN)

@Composable
fun PlanListScreen(app: AppState) {
    val plans = app.repository.plans
    val context = androidx.compose.ui.platform.LocalContext.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        ContentColumn {
            if (plans.isEmpty()) {
                Column(Modifier.widthIn(max = 460.dp).padding(top = 70.dp)) {
                    PixelCaption("Lernplan")
                    QText("Noch kein Lernplan", work(34f, FontWeight.Light, tracking = -0.85f), Quill.colors.ink, Modifier.padding(top = 16.dp))
                    QText(
                        "Wähl dein Material und den Prüfungstermin. Die KI zerlegt den Stoff in Lerneinheiten und verteilt sie bis zur Prüfung.",
                        work(15.5f, lineHeight = 23f),
                        Quill.colors.muted,
                        Modifier.padding(top = 14.dp, bottom = 30.dp),
                    )
                    PrimaryButton("Lernplan erstellen", { app.push(Route.CreatePlan) }, height = 48.dp, fontSize = 15.5f)
                }
            } else {
                PageHeader(if (plans.size == 1) "1 Lernplan" else "${plans.size} Lernpläne", "Lernplan") {
                    PrimaryButton("Neuer Lernplan", { app.push(Route.CreatePlan) })
                }
                Box(Modifier.padding(top = 30.dp)) { QuillDivider() }
                plans.forEach { plan -> PlanRow(plan, { app.push(Route.Plan(plan.id)) }, {
                    app.repository.deletePlan(plan)
                    de.maxifrz.lernwerk.notify.Reminders.cancel(context, plan.id)
                }) }
            }
        }
    }
}

@Composable
private fun PlanRow(plan: StudyPlan, onOpen: () -> Unit, onDelete: () -> Unit) {
    val colors = Quill.colors
    var menuOpen by remember { mutableStateOf(false) }
    val done = plan.topics.count { it.isDone }
    val total = plan.topics.size
    Box {
        Column(
            Modifier
                .fillMaxWidth()
                .combinedClickable(remember { MutableInteractionSource() }, null, onLongClick = { menuOpen = true }, onClick = onOpen)
                .padding(vertical = 20.dp, horizontal = 2.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            QText(plan.title, work(17f, FontWeight.Medium, tracking = -0.25f), colors.ink)
            QText("Prüfung am ${plan.examDate.format(longDate)}", work(14f), colors.muted)
            QuillProgressBar(if (total == 0) 0f else done.toFloat() / total, Modifier.padding(top = 6.dp, bottom = 2.dp))
            QText("$done von $total Themen erledigt", work(12.5f), colors.faint)
        }
        DropdownMenu(menuOpen, { menuOpen = false }, containerColor = colors.surface) {
            DropdownMenuItem(text = { QText("Löschen", work(15f), colors.warn) }, onClick = { menuOpen = false; onDelete() })
        }
    }
    QuillDivider()
}

@Composable
fun PlanDetailScreen(app: AppState, planId: String) {
    val plan = app.repository.plan(planId)
    if (plan == null) {
        androidx.compose.runtime.LaunchedEffect(Unit) { app.pop() }
        return
    }
    val colors = Quill.colors
    val today = LocalDate.now()
    var expanded by remember { mutableStateOf<String?>(null) }

    fun reschedule() {
        // Missed days happen; this moves every open topic forward from today without losing the order.
        val open = plan.topics.filter { !it.isDone }.sortedBy { it.order }
        val dates = PlanScheduler.assignDates(open.map { it.estimatedMinutes }, today, plan.minutesPerDay)
        val newDates = open.map { it.id }.zip(dates).toMap()
        app.repository.updatePlan(
            plan.copy(
                topics = plan.topics.map { topic -> newDates[topic.id]?.let { topic.copy(scheduledDay = it.toEpochDay()) } ?: topic },
                isOverbooked = PlanScheduler.isOverbooked(dates, plan.examDate),
            ),
        )
    }

    Column(Modifier.fillMaxSize().background(colors.bg)) {
        DetailHeader("Lernplan", plan.title, onBack = app::pop) {
            OutlineButton("Ab heute neu verteilen", ::reschedule, weight = FontWeight.Medium)
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            ContentColumn(top = 36.dp) {
                val done = plan.topics.count { it.isDone }
                val total = plan.topics.size
                val daysLeft = ChronoUnit.DAYS.between(today, plan.examDate).coerceAtLeast(0)
                Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(bottom = 26.dp)) {
                    QText("$done von $total Themen erledigt", work(30f, FontWeight.Light, tracking = -0.75f), colors.ink)
                    QuillProgressBar(if (total == 0) 0f else done.toFloat() / total, Modifier.padding(top = 6.dp))
                    QText("Prüfung am ${plan.examDate.format(longDate)} · noch $daysLeft Tage", work(13f), colors.faint)
                }
                QuillDivider()
                PlanTools(app, plan)
                QuillDivider()
                if (plan.isOverbooked) {
                    Notice(
                        "Bei ${plan.minutesPerDay} Minuten pro Tag passt der Stoff nicht bis zur Prüfung. Erhöh die tägliche Lernzeit oder streich Themen.",
                        textColor = colors.muted,
                        modifier = Modifier.padding(vertical = 16.dp, horizontal = 2.dp),
                    )
                    QuillDivider()
                }
                plan.topics.groupBy { it.scheduledDay }.toSortedMap().forEach { (day, topics) ->
                    Column(Modifier.padding(top = 28.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        PixelCaption(dayLabel(LocalDate.ofEpochDay(day), today))
                        topics.sortedBy { it.order }.forEach { topic ->
                            TopicRow(
                                topic = topic,
                                hasMaterial = app.repository.material(topic.materialId) != null,
                                expanded = expanded == topic.id,
                                onExpand = { expanded = if (expanded == topic.id) null else topic.id },
                                extras = { TopicExtras(app, plan.id, topic) },
                                onToggle = {
                                    app.repository.updatePlan(
                                        plan.copy(topics = plan.topics.map { if (it.id == topic.id) it.copy(isDone = !it.isDone) else it }),
                                    )
                                },
                                onOpen = {
                                    val material = app.repository.material(topic.materialId) ?: return@TopicRow
                                    app.push(Route.Document(material.id, maxOf(0, (topic.sourcePages.minOrNull() ?: 1) - 1), "Lernplan"))
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun dayLabel(day: LocalDate, today: LocalDate): String = when {
    day == today -> "Heute"
    day == today.plusDays(1) -> "Morgen"
    day.isBefore(today) -> "Offen seit ${day.format(dayTitle)}"
    else -> day.format(dayTitle)
}

@Composable
private fun TopicRow(
    topic: PlanTopic,
    hasMaterial: Boolean,
    expanded: Boolean,
    onExpand: () -> Unit,
    extras: @Composable () -> Unit,
    onToggle: () -> Unit,
    onOpen: () -> Unit,
) {
    val colors = Quill.colors
    Row(Modifier.fillMaxWidth().padding(vertical = 15.dp, horizontal = 2.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Box(Modifier.padding(top = 1.dp).pressable(androidx.compose.foundation.shape.CircleShape, onClick = onToggle)) {
            CheckCircle(topic.isDone)
        }
        Column(
            Modifier.weight(1f).pressable(enabled = hasMaterial, onClick = onOpen),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            QText(
                topic.title,
                work(16f, tracking = -0.16f).copy(textDecoration = if (topic.isDone) TextDecoration.LineThrough else null),
                if (topic.isDone) colors.faint else colors.ink,
            )
            QText(topic.summary, work(14f, lineHeight = 20f), colors.muted)
            Row(Modifier.padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                QText("${topic.estimatedMinutes} min", work(12.5f), colors.faint)
                if (topic.pagesLabel.isNotEmpty()) QText(topic.pagesLabel, work(12.5f), colors.faint)
                Box(Modifier.weight(1f))
                LinkButton(if (expanded) "Lernhilfen ▴" else "Lernhilfen ▾", onExpand, style = work(13f, FontWeight.Medium))
            }
        }
    }
    if (expanded) {
        Box(Modifier.padding(start = 38.dp, end = 2.dp, bottom = 16.dp)) { extras() }
    }
    QuillDivider()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanCreateScreen(app: AppState) {
    val colors = Quill.colors
    val repository = app.repository
    val materials = repository.library.sortedBy { it.createdAt }
    var selection by remember { mutableStateOf(setOf<String>()) }
    var title by remember { mutableStateOf("Prüfungsvorbereitung") }
    var examDate by remember { mutableStateOf(LocalDate.now().plusDays(28)) }
    var minutesPerDay by remember { mutableStateOf(45) }
    var isGenerating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var pickingDate by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    fun generate() {
        val chosen = materials.filter { it.id in selection }
        val client = app.settings.makeClient(LlmTask.PLAN)
        val planTitle = title.trim().ifEmpty { "Lernplan" }
        isGenerating = true
        errorMessage = null
        scope.launch {
            val opened = mutableListOf<Closeable>()
            try {
                val inputs = withContext(Dispatchers.IO) {
                    chosen.map { PlanGenerator.Input(it.title, repository.pdfFile(it).readBytes()) }
                }
                val drafts = PlanGenerator(client) { data ->
                    AndroidMaterialDocument.open(data, context.cacheDir)?.also { opened += it }
                }.generate(inputs)
                val schedule = PlanScheduler.schedule(drafts, LocalDate.now(), examDate, minutesPerDay)
                repository.addPlan(
                    StudyPlan(
                        title = planTitle,
                        examDay = examDate.toEpochDay(),
                        minutesPerDay = minutesPerDay,
                        isOverbooked = schedule.isOverbooked,
                        topics = schedule.topics.map { item ->
                            PlanTopic(
                                title = item.draft.title,
                                summary = item.draft.summary,
                                materialId = chosen.getOrNull(item.draft.materialIndex)?.id,
                                sourcePages = item.draft.sourcePages,
                                estimatedMinutes = item.draft.estimatedMinutes,
                                order = item.order,
                                scheduledDay = item.date.toEpochDay(),
                                videoQuery = item.draft.videoQuery,
                            )
                        },
                    ),
                )
                app.pop()
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                errorMessage = error.message ?: "Der Lernplan konnte nicht erstellt werden."
            } finally {
                opened.forEach { runCatching { it.close() } }
                isGenerating = false
            }
        }
    }

    androidx.activity.compose.BackHandler(enabled = isGenerating) {}

    Box(Modifier.fillMaxSize().background(colors.bg)) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp)) {
                QText("Neuer Lernplan", work(16f, FontWeight.Medium, tracking = -0.24f), colors.ink, Modifier.align(Alignment.Center))
                Row(Modifier.fillMaxWidth().align(Alignment.Center), verticalAlignment = Alignment.CenterVertically) {
                    LinkButton("Abbrechen", { if (!isGenerating) app.pop() }, colors.muted, work(15f))
                    Box(Modifier.weight(1f))
                    PrimaryButton("Erstellen", ::generate, height = 34.dp, fontSize = 14f, enabled = selection.isNotEmpty() && !isGenerating)
                }
            }
            QuillDivider(colors.lineSoft)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                ContentColumn(maxWidth = 680.dp, top = 22.dp) {
                    PixelCaption("Material", Modifier.padding(bottom = 6.dp))
                    if (materials.isEmpty()) {
                        QText("Importiere zuerst ein PDF in der Bibliothek.", work(15f), colors.faint, Modifier.padding(vertical = 14.dp, horizontal = 2.dp))
                        QuillDivider()
                    }
                    materials.forEach { material ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .pressable { selection = if (material.id in selection) selection - material.id else selection + material.id }
                                .padding(vertical = 15.dp, horizontal = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            QText(material.title, work(15.5f), colors.ink, Modifier.weight(1f))
                            CheckCircle(material.id in selection)
                        }
                        QuillDivider()
                    }

                    PixelCaption("Prüfung", Modifier.padding(top = 28.dp, bottom = 6.dp))
                    QuillRow("Titel", verticalPadding = 8.dp) {
                        BasicTextField(
                            value = title,
                            onValueChange = { title = it },
                            singleLine = true,
                            textStyle = work(15.5f).copy(color = colors.ink, textAlign = TextAlign.End),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.width(260.dp),
                        )
                    }
                    QuillRow("Termin", verticalPadding = 8.dp) {
                        OutlineButton(examDate.format(longDate), { pickingDate = true }, height = 34.dp, fontSize = 14.5f)
                    }
                    QuillRow("$minutesPerDay Minuten pro Tag", verticalPadding = 10.dp) {
                        Row(
                            Modifier.border(1.dp, colors.line2, RoundedCornerShape(16.dp)),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            StepperButton("−") { minutesPerDay = maxOf(15, minutesPerDay - 15) }
                            Box(Modifier.width(1.dp).height(32.dp).background(colors.line2))
                            StepperButton("+") { minutesPerDay = minOf(240, minutesPerDay + 15) }
                        }
                    }
                    errorMessage?.let { Notice(it, modifier = Modifier.padding(top = 20.dp)) }
                }
            }
        }

        AnimatedVisibility(isGenerating, enter = fadeIn(), exit = fadeOut()) {
            Box(
                Modifier.fillMaxSize().background(colors.scrim)
                    .combinedClickable(remember { MutableInteractionSource() }, null, onClick = {}),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    Modifier.background(colors.surface, RoundedCornerShape(20.dp)).padding(horizontal = 32.dp, vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    PulsingDots(6.dp)
                    QText("Die KI liest dein Material …", work(16f, FontWeight.Medium, tracking = -0.16f), colors.ink)
                    QText("Je nach Umfang dauert das bis zu zwei Minuten.", work(12.5f), colors.faint)
                }
            }
        }
    }

    if (pickingDate) {
        val todayMillis = LocalDate.now().atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
        val state = rememberDatePickerState(
            initialSelectedDateMillis = examDate.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis >= todayMillis
            },
        )
        val pickerColors = DatePickerDefaults.colors(
            containerColor = colors.surface,
            selectedDayContainerColor = colors.accent,
            selectedDayContentColor = colors.onAccent,
            todayDateBorderColor = colors.accent,
            todayContentColor = colors.ink,
        )
        DatePickerDialog(
            onDismissRequest = { pickingDate = false },
            confirmButton = {
                LinkButton("Übernehmen", {
                    state.selectedDateMillis?.let { examDate = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }
                    pickingDate = false
                })
            },
            dismissButton = { LinkButton("Abbrechen", { pickingDate = false }, colors.muted) },
            colors = pickerColors,
        ) {
            DatePicker(state, colors = pickerColors)
        }
    }
}

@Composable
private fun StepperButton(label: String, onClick: () -> Unit) {
    Box(
        Modifier.width(44.dp).height(32.dp).pressable(RoundedCornerShape(16.dp), onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        QText(label, work(16f), Quill.colors.ink)
    }
}
