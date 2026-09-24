package de.maxifrz.lernwerk.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.pdf.AndroidMaterialDocument
import de.maxifrz.lernwerk.plan.PlanGenerator
import de.maxifrz.lernwerk.present.Critique
import de.maxifrz.lernwerk.present.Finding
import de.maxifrz.lernwerk.present.PresentationAssistant
import de.maxifrz.lernwerk.present.PresentationChat
import de.maxifrz.lernwerk.present.PresentationCritic
import de.maxifrz.lernwerk.present.PresentationEdits
import de.maxifrz.lernwerk.present.SlideChange
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.Closeable

enum class AssistantTab(val title: String) { CHAT("Chat"), CRITIC("Kritiker"), FEEDBACK("Feedback") }

/** One chat entry; for the assistant also the changes it made. */
internal data class ChatEntry(val fromStudent: Boolean, val text: String, val changes: List<String> = emptyList(), val skipped: Int = 0)

internal enum class FindingState { APPLIED, DISMISSED, FAILED }

/**
 * The side panel of the presentation editor: a chat that carries out instructions right away (one undo step each),
 * a sceptical critic whose proposals the student approves one by one, and the Socratic feedback.
 */
/** Chat, critic and feedback state; created by the editor so it survives closing the panel and switching tabs. */
class AssistantModels internal constructor(
    internal val chat: ChatModel,
    internal val critic: CriticModel,
    internal val feedback: androidx.compose.runtime.MutableState<String?>,
)

@Composable
fun rememberAssistantModels(app: AppState, state: EditorState): AssistantModels = remember(state) {
    AssistantModels(
        ChatModel(app.settings.makeClient(LlmTask.TUTOR)),
        CriticModel(app.settings.makeClient(LlmTask.PLAN), state.presentation.materialIds),
        mutableStateOf(null),
    )
}

@Composable
fun AssistantPanel(
    app: AppState,
    state: EditorState,
    models: AssistantModels,
    tab: AssistantTab,
    onTab: (AssistantTab) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Quill.colors
    Column(modifier.background(colors.bg)) {
        Row(Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            QText("Assistent", work(17f, FontWeight.Medium, tracking = -0.25f), colors.ink, Modifier.weight(1f))
            OutlineButton("Schließen", onClose, height = 32.dp, weight = FontWeight.Medium)
        }
        Row(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AssistantTab.entries.forEach { entry ->
                val selected = entry == tab
                Box(
                    Modifier
                        .height(30.dp)
                        .background(if (selected) colors.ink else Color.Transparent, CircleShape)
                        .border(1.dp, if (selected) Color.Transparent else colors.line2, CircleShape)
                        .pressable(CircleShape) { onTab(entry) }
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    QText(entry.title, work(13f, FontWeight.Medium), if (selected) colors.bg else colors.ink)
                }
            }
        }
        QuillDivider(colors.lineSoft)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (tab) {
                AssistantTab.CHAT -> ChatTab(app, state, models.chat)
                AssistantTab.CRITIC -> CriticTab(app, state, models.critic)
                AssistantTab.FEEDBACK -> FeedbackTab(app, state, models.feedback)
            }
        }
    }
}

/** Reads the linked materials once for a panel session, in the form the chosen provider accepts. */
private suspend fun materialContent(app: AppState, client: LlmClient, materialIds: Collection<String>, context: android.content.Context): List<LlmContent> {
    val materials = app.repository.materials.filter { it.id in materialIds }
    if (materials.isEmpty()) return emptyList()
    val opened = mutableListOf<Closeable>()
    return try {
        val inputs = withContext(Dispatchers.IO) { materials.map { PlanGenerator.Input(it.title, app.repository.pdfFile(it).readBytes()) } }
        PlanGenerator.content(inputs, client.capabilities, "The material above is the source the presentation is based on.") { data ->
            AndroidMaterialDocument.open(data, context.cacheDir)?.also { opened += it }
        }
    } finally {
        opened.forEach { runCatching { it.close() } }
    }
}

internal class ChatModel(val client: LlmClient) {
    val chat = PresentationChat(client)
    val entries = mutableStateListOf<ChatEntry>()
    var busy by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var material: List<LlmContent>? = null
}


@Composable
private fun ChatTab(app: AppState, state: EditorState, model: ChatModel) {
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val listState = rememberLazyListState()
    var draft by remember { mutableStateOf("") }

    LaunchedEffect(model.entries.size, model.busy) {
        val count = listState.layoutInfo.totalItemsCount
        if (count > 0) listState.animateScrollToItem(count - 1)
    }

    fun send() {
        val text = draft.trim()
        if (text.isEmpty() || model.busy) return
        draft = ""
        state.finishEditing()
        model.entries += ChatEntry(true, text)
        model.busy = true
        model.error = null
        scope.launch {
            try {
                val material = model.material ?: runCatching {
                    materialContent(app, model.client, state.presentation.materialIds, context)
                }.getOrDefault(emptyList()).also { model.material = it }
                val reply = model.chat.send(state.presentation, text, material)
                val result = PresentationEdits.apply(state.presentation, reply.changes)
                if (result.applied.isNotEmpty()) state.replacePresentation(result.presentation)
                model.entries += ChatEntry(false, reply.message, result.applied.map { it.summary.ifBlank { describe(it) } }, result.skipped.size)
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                model.error = error.message ?: "Die KI-Anfrage ist fehlgeschlagen."
            } finally {
                model.busy = false
            }
        }
    }

    Column(Modifier.fillMaxHeight().imePadding()) {
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (model.entries.isEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        PixelCaption("Sag, was sich ändern soll", size = 9f)
                        listOf(
                            "Mach Folie 3 kürzer",
                            "Füge nach Folie 2 eine Folie mit einem Beispiel ein",
                            "Stell auf das Kreide-Design um",
                            "Schreib die Notizen für einen lockeren Vortrag",
                        ).forEach { example ->
                            QText(
                                example,
                                work(14f),
                                colors.ink2,
                                Modifier
                                    .border(1.dp, colors.line2, RoundedCornerShape(14.dp))
                                    .pressable(RoundedCornerShape(14.dp)) { draft = example }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                            )
                        }
                    }
                }
            }
            itemsIndexed(model.entries) { _, entry ->
                if (entry.fromStudent) {
                    Row(Modifier.fillMaxWidth().padding(start = 40.dp), horizontalArrangement = Arrangement.End) {
                        QText(
                            entry.text,
                            work(14.5f, lineHeight = 20f),
                            colors.bg,
                            Modifier
                                .background(colors.ink, RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 6.dp))
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                        )
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        PixelCaption("Assistent", size = 9f)
                        BasicText(markdown(entry.text, colors.ink), style = work(14.5f, lineHeight = 22f).copy(color = colors.ink2))
                        entry.changes.forEach { change ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                StatusDot()
                                QText(change, work(13f), colors.muted)
                            }
                        }
                        if (entry.skipped > 0) {
                            QText("${entry.skipped} Änderung(en) passten nicht mehr und wurden übersprungen.", work(12.5f), colors.warn)
                        }
                        if (entry.changes.isNotEmpty()) QText("Rückgängig machen geht oben mit „Rückgängig“.", work(12f), colors.faint)
                    }
                }
            }
            if (model.busy) item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) { PulsingDots(); QText("Arbeite an deiner Präsentation …", work(13f), colors.faint) } }
            model.error?.let { item { Notice(it) } }
        }
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
            PipView(model.busy, Modifier.padding(horizontal = 6.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(colors.surface, RoundedCornerShape(24.dp))
                    .border(1.dp, colors.line2, RoundedCornerShape(24.dp))
                    .padding(start = 16.dp, top = 5.dp, end = 5.dp, bottom = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.weight(1f).padding(vertical = 9.dp)) {
                    if (draft.isEmpty()) QText("Anweisung …", work(15f), colors.hint)
                    BasicTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        textStyle = work(15f).copy(color = colors.ink),
                        cursorBrush = SolidColor(colors.accent),
                        maxLines = 4,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = { send() }),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                PrimaryButton("Senden", ::send, height = 34.dp, fontSize = 13.5f, enabled = draft.isNotBlank() && !model.busy)
            }
        }
    }
}

private fun describe(change: SlideChange) = when (change.action) {
    SlideChange.Action.UPDATE_TEXTS -> "Texte geändert"
    SlideChange.Action.REPLACE_SLIDE -> "Folie neu gestaltet"
    SlideChange.Action.INSERT_SLIDE -> "Folie eingefügt"
    SlideChange.Action.DELETE_SLIDE -> "Folie gelöscht"
    SlideChange.Action.MOVE_SLIDE -> "Folie verschoben"
    SlideChange.Action.SET_NOTES -> "Notizen geändert"
    SlideChange.Action.SET_THEME -> "Design geändert"
    SlideChange.Action.RENAME -> "Titel geändert"
}

internal class CriticModel(val client: LlmClient, materialIds: List<String>) {
    var critique by mutableStateOf<Critique?>(null)
    val states = mutableStateMapOf<Int, FindingState>()
    var busy by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    val selectedMaterials = mutableStateListOf<String>().apply { addAll(materialIds) }
}


@Composable
private fun CriticTab(app: AppState, state: EditorState, model: CriticModel) {
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun run() {
        if (model.busy) return
        state.finishEditing()
        model.busy = true
        model.error = null
        scope.launch {
            try {
                val material = runCatching { materialContent(app, model.client, model.selectedMaterials, context) }.getOrDefault(emptyList())
                model.critique = PresentationCritic(model.client).critique(state.presentation, material)
                model.states.clear()
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                model.error = error.message ?: "Die Kritik ist fehlgeschlagen."
            } finally {
                model.busy = false
            }
        }
    }

    fun applyFindings(indices: List<Int>) {
        val critique = model.critique ?: return
        state.finishEditing()
        val changes = indices.flatMap { critique.findings[it].changes }
        val result = PresentationEdits.apply(state.presentation, changes)
        if (result.applied.isNotEmpty()) state.replacePresentation(result.presentation)
        indices.forEach { index ->
            val ok = critique.findings[index].changes.any { it in result.applied }
            model.states[index] = if (ok) FindingState.APPLIED else FindingState.FAILED
        }
    }

    Column(Modifier.fillMaxHeight().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        QText(
            "Der Kritiker sucht wie ein strenger Lehrer nach Schwächen: falsche oder unbelegte Aussagen, Lücken im roten Faden, zu viel Text, fehlende Quellen. Du entscheidest bei jedem Vorschlag, ob er umgesetzt wird.",
            work(13.5f, lineHeight = 20f),
            colors.muted,
        )
        val materials = app.repository.materials
        if (materials.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                PixelCaption("Gegen Material prüfen", size = 9f)
                materials.forEach { material ->
                    val selected = material.id in model.selectedMaterials
                    Row(
                        Modifier.fillMaxWidth().pressable {
                            if (selected) model.selectedMaterials.remove(material.id) else model.selectedMaterials.add(material.id)
                        }.padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        CheckCircle(selected, 18.dp)
                        QText(material.title, work(14f), colors.ink, maxLines = 1)
                    }
                }
            }
        }
        PrimaryButton(if (model.critique == null) "Kritik starten" else "Neu prüfen", ::run, height = 40.dp, fontSize = 14.5f, enabled = !model.busy)
        if (model.busy) Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) { PulsingDots(); QText("Der Kritiker liest …", work(13f), colors.faint) }
        model.error?.let { Notice(it) }
        model.critique?.let { critique ->
            if (critique.verdict.isNotBlank()) {
                Column(Modifier.fillMaxWidth().background(colors.surface, RoundedCornerShape(14.dp)).border(1.dp, colors.line2, RoundedCornerShape(14.dp)).padding(14.dp)) {
                    PixelCaption("Urteil", size = 9f)
                    QText(critique.verdict, work(14.5f, lineHeight = 21f), colors.ink2, Modifier.padding(top = 6.dp))
                }
            }
            val open = critique.findings.indices.filter { model.states[it] == null && critique.findings[it].changes.isNotEmpty() }
            if (open.size > 1) OutlineButton("Alle ${open.size} Vorschläge übernehmen", { applyFindings(open) }, weight = FontWeight.Medium)
            if (critique.findings.isEmpty()) QText("Keine Schwächen gefunden.", work(14f), colors.muted)
            critique.findings.forEachIndexed { index, finding ->
                FindingCard(state, finding, model.states[index], onApply = { applyFindings(listOf(index)) }, onDismiss = { model.states[index] = FindingState.DISMISSED })
            }
        }
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun FindingCard(state: EditorState, finding: Finding, status: FindingState?, onApply: () -> Unit, onDismiss: () -> Unit) {
    val colors = Quill.colors
    val slideNumber = finding.slideId?.let { id -> state.presentation.slides.indexOfFirst { it.id == id }.takeIf { it >= 0 }?.plus(1) }
    val dot = when (finding.severity) {
        Finding.Severity.HIGH -> hex(0xC46A55)
        Finding.Severity.MEDIUM -> colors.warn
        Finding.Severity.LOW -> colors.accent
    }
    Column(
        Modifier
            .fillMaxWidth()
            .background(colors.surface.copy(alpha = if (status == FindingState.DISMISSED) 0.5f else 1f), RoundedCornerShape(14.dp))
            .border(1.dp, colors.line2, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            StatusDot(dot, 8.dp)
            QText(finding.severity.label, work(12.5f, FontWeight.Medium), colors.ink)
            QText(slideNumber?.let { "Folie $it" } ?: "Ganze Präsentation", work(12.5f), colors.faint, Modifier.weight(1f))
            if (slideNumber != null) LinkButton("Zeigen", { state.selectSlide(slideNumber - 1) }, style = work(12.5f, FontWeight.Medium))
        }
        QText(finding.problem, work(14.5f, lineHeight = 21f), colors.ink)
        if (finding.suggestion.isNotBlank()) QText("Vorschlag: ${finding.suggestion}", work(13.5f, lineHeight = 20f), colors.muted)
        finding.changes.forEach { change -> QText("→ ${change.summary.ifBlank { describe(change) }}", work(13f), colors.ink2) }
        when (status) {
            FindingState.APPLIED -> QText("Umgesetzt", work(13f, FontWeight.Medium), colors.accent)
            FindingState.DISMISSED -> QText("Verworfen", work(13f), colors.faint)
            FindingState.FAILED -> QText("Passte nicht mehr zur Präsentation – bitte selbst anpassen.", work(13f), colors.warn)
            null -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (finding.changes.isNotEmpty()) PrimaryButton("Übernehmen", onApply, height = 32.dp, fontSize = 13.5f)
                OutlineButton(if (finding.changes.isEmpty()) "Erledigt" else "Verwerfen", onDismiss, height = 32.dp)
            }
        }
    }
}

@Composable
private fun FeedbackTab(app: AppState, state: EditorState, feedback: androidx.compose.runtime.MutableState<String?>) {
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxHeight().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        QText(
            "Feedback im Stil der Lernhilfe: Stärken kurz, dann Fragen, mit denen du die Schwachstellen selbst findest.",
            work(13.5f, lineHeight = 20f),
            colors.muted,
        )
        PrimaryButton(if (feedback.value == null) "Feedback holen" else "Neu holen", {
            busy = true
            error = null
            state.finishEditing()
            scope.launch {
                try {
                    feedback.value = PresentationAssistant(app.settings.makeClient(LlmTask.TUTOR)).feedback(state.presentation)
                } catch (e: kotlinx.coroutines.CancellationException) {
                    throw e
                } catch (e: Exception) {
                    error = e.message
                } finally {
                    busy = false
                }
            }
        }, height = 40.dp, fontSize = 14.5f, enabled = !busy)
        if (busy) PulsingDots()
        error?.let { Notice(it) }
        feedback.value?.let { BasicText(markdown(it, colors.ink), style = work(15f, lineHeight = 23f).copy(color = colors.ink2)) }
    }
}
