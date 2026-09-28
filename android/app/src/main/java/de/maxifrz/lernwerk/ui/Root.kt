package de.maxifrz.lernwerk.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import kotlinx.coroutines.launch
import kotlin.math.roundToInt
import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.data.AppSettings
import de.maxifrz.lernwerk.data.PresentationStore
import de.maxifrz.lernwerk.data.Repository
import de.maxifrz.lernwerk.present.SlidePainter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow

enum class AppTab(val title: String) {
    LIBRARY("Bibliothek"),
    PLANS("Lernplan"),
    PRESENT("Präsentation"),
    CALC("Rechner"),
    CALENDAR("Kalender"),
    REVIEW("Wiederholen"),
    SETTINGS("Einstellungen"),
}

sealed interface Route {
    data class Document(val materialId: String, val startPage: Int?, val backTitle: String) : Route
    data class Plan(val planId: String) : Route
    data object CreatePlan : Route
    data class PresentationEditor(val presentationId: String, val openAssistant: AssistantTab? = null) : Route
    data object CreatePresentation : Route
    data class Present(val presentationId: String, val startSlide: Int) : Route
}

/** What screens need to reach the app: data, settings and navigation. */
class AppState(val repository: Repository, val settings: AppSettings, val presentations: PresentationStore) {
    val stack = mutableStateListOf<Route>()

    /** For work that has to outlive the screen that started it, like turning a finished help session into a card. */
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Shared files the open document should take in as pages. */
    val insertRequests = MutableStateFlow<List<Uri>?>(null)

    fun push(route: Route) {
        stack += route
    }

    fun pop() {
        if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex)
    }

    /** Swaps the current screen, e.g. from the creation form to the new presentation. */
    fun replace(route: Route) {
        pop()
        push(route)
    }
}

@Composable
fun RootScreen(
    repository: Repository,
    settings: AppSettings,
    presentations: PresentationStore,
    shareRequests: MutableStateFlow<List<Uri>?>,
) {
    val app = remember { AppState(repository, settings, presentations) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val painter = remember { SlidePainter(context) }
    var tab by rememberSaveable { mutableStateOf(AppTab.LIBRARY) }
    val colors = Quill.colors

    // Files shared from another app: with a document open, ask whether they go into it or become new documents.
    var shareChoice by remember { mutableStateOf<Pair<List<Uri>, Route.Document>?>(null) }
    fun importIntoLibrary(uris: List<Uri>) {
        app.scope.launch {
            val imported = uris.mapNotNull { uri ->
                runCatching { repository.importFile(uri) }
                    .onFailure { Toast.makeText(context, it.message ?: "Import fehlgeschlagen.", Toast.LENGTH_LONG).show() }
                    .getOrNull()
            }
            when {
                imported.size == 1 -> {
                    tab = AppTab.LIBRARY
                    app.stack.clear()
                    app.push(Route.Document(imported.single().id, null, "Bibliothek"))
                }
                imported.size > 1 -> Toast.makeText(context, "${imported.size} Dateien in der Bibliothek", Toast.LENGTH_SHORT).show()
            }
        }
    }
    val shared by shareRequests.collectAsState()
    LaunchedEffect(shared) {
        val uris = shared ?: return@LaunchedEffect
        shareRequests.value = null
        val open = app.stack.lastOrNull() as? Route.Document
        if (open != null && repository.material(open.materialId) != null) shareChoice = uris to open else importIntoLibrary(uris)
    }
    shareChoice?.let { (uris, open) ->
        val title = repository.material(open.materialId)?.title ?: "Dokument"
        ShareChoiceDialog(
            count = uris.size,
            documentTitle = title,
            onInsert = {
                shareChoice = null
                app.insertRequests.value = uris
            },
            onNew = {
                shareChoice = null
                importIntoLibrary(uris)
            },
            onDismiss = { shareChoice = null },
        )
    }

    BackHandler(enabled = app.stack.isNotEmpty()) { app.pop() }

    androidx.compose.runtime.CompositionLocalProvider(LocalSlidePainter provides painter) {

    Box(
        Modifier
            .fillMaxSize()
            .background(colors.bg)
            .windowInsetsPadding(WindowInsets.safeDrawing),
    ) {
        AnimatedContent(
            targetState = app.stack.lastOrNull(),
            transitionSpec = {
                // A popped route is gone from the stack; a pushed one sits on top of the route it covers.
                val forward = targetState != null && (initialState == null || initialState in app.stack)
                if (forward) {
                    (slideInHorizontally(tween(280)) { it / 5 } + fadeIn(tween(280))) togetherWith fadeOut(tween(180))
                } else {
                    fadeIn(tween(220)) togetherWith (slideOutHorizontally(tween(280)) { it / 5 } + fadeOut(tween(200)))
                }
            },
            label = "route",
        ) { route ->
            when (route) {
                null -> Column(Modifier.fillMaxSize()) {
                    val now = System.currentTimeMillis()
                    TopTabBar(tab, repository.cards.count { it.dueAt <= now }) { tab = it }
                    AnimatedContent(tab, transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) }, label = "tab") {
                        Box(Modifier.fillMaxSize()) {
                            when (it) {
                                AppTab.LIBRARY -> LibraryScreen(app)
                                AppTab.PLANS -> PlanListScreen(app)
                                AppTab.PRESENT -> PresentationListScreen(app)
                                AppTab.CALC -> CalculatorScreen(app)
                                AppTab.CALENDAR -> CalendarScreen(app)
                                AppTab.REVIEW -> ReviewScreen(app)
                                AppTab.SETTINGS -> SettingsScreen(app)
                            }
                        }
                    }
                }
                is Route.Document -> DocumentScreen(app, route)
                is Route.Plan -> PlanDetailScreen(app, route.planId)
                Route.CreatePlan -> PlanCreateScreen(app)
                is Route.PresentationEditor -> PresentationEditorScreen(app, route.presentationId, route.openAssistant)
                Route.CreatePresentation -> PresentationCreateScreen(app)
                is Route.Present -> PresentScreen(app, route.presentationId, route.startSlide)
            }
        }
    }
    }
}

/** Where shared files go while a document is open: into it after the current page, or into the library. */
@Composable
private fun ShareChoiceDialog(count: Int, documentTitle: String, onInsert: () -> Unit, onNew: () -> Unit, onDismiss: () -> Unit) {
    val colors = Quill.colors
    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        DialogCard(if (count == 1) "Datei öffnen" else "$count Dateien öffnen") {
            QText(
                "In „$documentTitle“ nach der aktuellen Seite einfügen oder als neues Dokument in die Bibliothek?",
                work(15f, lineHeight = 21f),
                colors.ink2,
            )
            Column(Modifier.fillMaxWidth().padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                PrimaryButton("In „$documentTitle“ einfügen", onInsert, Modifier.fillMaxWidth())
                OutlineButton(if (count == 1) "Als neues Dokument" else "Als neue Dokumente", onNew, Modifier.fillMaxWidth())
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                    LinkButton("Abbrechen", onDismiss, colors.muted, work(15f))
                }
            }
        }
    }
}

/** Wordmark on the left, the tabs as a glass capsule in the middle; the dark pill slides to the chosen tab. */
@Composable
private fun TopTabBar(selection: AppTab, reviewBadge: Int, onSelect: (AppTab) -> Unit) {
    val colors = Quill.colors
    val density = LocalDensity.current
    // Where each tab sits inside the capsule, in pixels: the pill slides between these.
    val bounds = remember { mutableStateMapOf<AppTab, Pair<Float, Float>>() }
    val pillX = remember { Animatable(0f) }
    val pillWidth = remember { Animatable(0f) }
    val scroll = rememberScrollState()
    val target = bounds[selection]
    LaunchedEffect(selection, target) {
        val (x, width) = target ?: return@LaunchedEffect
        if (pillWidth.value == 0f) {
            // First layout: the pill starts where it belongs instead of flying in.
            pillX.snapTo(x)
            pillWidth.snapTo(width)
        } else {
            // A little overshoot, like a drop of liquid settling.
            val spring = spring<Float>(dampingRatio = 0.72f, stiffness = 420f)
            launch { pillX.animateTo(x, spring) }
            launch { pillWidth.animateTo(width, spring) }
            // On a phone the capsule scrolls; the chosen tab stays in view.
            launch { scroll.animateScrollTo((x + width / 2 - scroll.viewportSize / 2f).roundToInt().coerceAtLeast(0)) }
        }
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val regular = maxWidth >= 700.dp
        Row(
            Modifier.fillMaxWidth().padding(horizontal = if (regular) 26.dp else 10.dp).padding(top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (regular) {
                Box(Modifier.weight(1f)) {
                    QText("SCHUL-PIP", pixel(13f).copy(letterSpacing = androidx.compose.ui.unit.TextUnit(0.14f, androidx.compose.ui.unit.TextUnitType.Em)), colors.accent)
                }
            }
            Box(
                Modifier
                    .then(if (regular) Modifier else Modifier.weight(1f, fill = false).horizontalScroll(scroll))
                    .padding(vertical = 6.dp)
                    .glassCapsule(),
            ) {
                if (pillWidth.value > 0f) {
                    Box(
                        Modifier
                            .padding(4.dp)
                            .offset { IntOffset(pillX.value.roundToInt(), 0) }
                            .width(with(density) { pillWidth.value.toDp() })
                            .height(36.dp)
                            .shadow(6.dp, CircleShape)
                            .background(colors.ink, CircleShape)
                            .border(1.dp, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.3f), Color.Transparent)), CircleShape),
                    )
                }
                Row(Modifier.padding(4.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    AppTab.entries.forEach { tab ->
                        val selected = tab == selection
                        val interaction = remember { MutableInteractionSource() }
                        val pressed by interaction.collectIsPressedAsState()
                        val scale by animateFloatAsState(if (pressed) 0.94f else 1f, spring(dampingRatio = 0.6f), label = "press")
                        val textColor by animateColorAsState(if (selected) colors.bg else colors.ink, tween(220), label = "tabText")
                        Row(
                            Modifier
                                .onPlaced { bounds[tab] = it.positionInParent().x to it.size.width.toFloat() }
                                .height(36.dp)
                                .scale(scale)
                                .clickable(interaction, null, role = Role.Tab) { onSelect(tab) }
                                .padding(horizontal = if (regular) 17.dp else 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(7.dp),
                        ) {
                            QText(
                                tab.title,
                                work(if (regular) 14f else 12.5f, FontWeight.Medium, tracking = -0.14f),
                                textColor,
                                maxLines = 1,
                            )
                            if (tab == AppTab.REVIEW && reviewBadge > 0) {
                                Box(
                                    Modifier
                                        .widthIn(min = 19.dp)
                                        .background(colors.accent, CircleShape)
                                        .padding(horizontal = 5.dp, vertical = 3.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    QText("$reviewBadge", pixel(9f), colors.onAccent)
                                }
                            }
                        }
                    }
                }
            }
            if (regular) Spacer(Modifier.weight(1f))
        }
    }
}

/** Frosted glass: a translucent surface with a light rim on top and a soft shadow, the look of iOS' Liquid Glass. */
@Composable
private fun Modifier.glassCapsule(): Modifier {
    val colors = Quill.colors
    return this
        .shadow(14.dp, CircleShape, ambientColor = Color.Black.copy(alpha = 0.12f), spotColor = Color.Black.copy(alpha = 0.12f))
        .background(Brush.verticalGradient(listOf(colors.surface.copy(alpha = 0.96f), colors.surface.copy(alpha = 0.82f))), CircleShape)
        .border(1.dp, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.75f), colors.line2)), CircleShape)
}
