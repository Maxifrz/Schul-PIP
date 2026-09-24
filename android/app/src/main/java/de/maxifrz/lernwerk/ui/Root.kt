package de.maxifrz.lernwerk.ui

import androidx.activity.compose.BackHandler
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
    openRequests: MutableStateFlow<String?>,
) {
    val app = remember { AppState(repository, settings, presentations) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val painter = remember { SlidePainter(context) }
    var tab by rememberSaveable { mutableStateOf(AppTab.LIBRARY) }
    val colors = Quill.colors

    val openRequest by openRequests.collectAsState()
    LaunchedEffect(openRequest) {
        val id = openRequest ?: return@LaunchedEffect
        openRequests.value = null
        tab = AppTab.LIBRARY
        app.stack.clear()
        app.push(Route.Document(id, null, "Bibliothek"))
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

/** Wordmark on the left, the tabs as a capsule in the middle. */
@Composable
private fun TopTabBar(selection: AppTab, reviewBadge: Int, onSelect: (AppTab) -> Unit) {
    val colors = Quill.colors
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
            Row(
                Modifier
                    .background(colors.surface, CircleShape)
                    .border(1.dp, colors.line2, CircleShape)
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                AppTab.entries.forEach { tab ->
                    val selected = tab == selection
                    Row(
                        Modifier
                            .height(36.dp)
                            .background(if (selected) colors.ink else Color.Transparent, CircleShape)
                            .clickable(remember { MutableInteractionSource() }, null, role = Role.Tab) { onSelect(tab) }
                            .padding(horizontal = if (regular) 17.dp else 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                    ) {
                        QText(
                            tab.title,
                            work(if (regular) 14f else 12.5f, FontWeight.Medium, tracking = -0.14f),
                            if (selected) colors.bg else colors.ink,
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
            if (regular) Spacer(Modifier.weight(1f))
        }
    }
}
