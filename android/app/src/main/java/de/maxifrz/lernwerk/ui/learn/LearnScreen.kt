package de.maxifrz.lernwerk.ui.learn

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import de.maxifrz.lernwerk.learn.Course
import de.maxifrz.lernwerk.learn.CourseCatalog
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.CoursePath
import de.maxifrz.lernwerk.learn.LearnProgress
import de.maxifrz.lernwerk.learn.PathUnit
import de.maxifrz.lernwerk.learn.QuestBoard
import de.maxifrz.lernwerk.learn.SkillMaps
import de.maxifrz.lernwerk.learn.skills.RecommendationKind
import de.maxifrz.lernwerk.learn.skills.SkillAdvisor
import de.maxifrz.lernwerk.ui.AppState
import de.maxifrz.lernwerk.ui.DialogCard
import de.maxifrz.lernwerk.ui.OutlineButton
import de.maxifrz.lernwerk.ui.PixelCaption
import de.maxifrz.lernwerk.ui.PrimaryButton
import de.maxifrz.lernwerk.ui.QText
import de.maxifrz.lernwerk.ui.Quill
import de.maxifrz.lernwerk.ui.work
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

// The Lernen tab: the numbers on top (course, streak, gems, daily goal), then the path of the chosen course, the quests
// or the skills. A port of desktop/src/views/learn/Learn.tsx; the round itself is in LessonPlayer.kt.

/** The tab: opens the stores off the main thread, then shows the area (or the round that is open). */
@Composable
fun LearnScreen(@Suppress("UNUSED_PARAMETER") app: AppState) {
    val context = LocalContext.current
    var ui by remember { mutableStateOf(LearnHost.current()) }
    LaunchedEffect(Unit) {
        if (ui == null) ui = withContext(Dispatchers.Default) { LearnHost.start(context) }
    }
    val state = ui
    if (state == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { QText("Lade …", work(15f), Quill.colors.muted) }
    } else {
        LearnContent(state)
    }
}

@Composable
fun LearnContent(ui: LearnUi) {
    // A day can pass while the app waits: read the clock again every half minute.
    LaunchedEffect(ui) {
        while (true) {
            delay(30_000)
            ui.refreshTime()
        }
    }
    if (ui.active != null) LessonPlayerHost(ui) else LearnHome(ui)
}

@Composable
private fun CourseTile(course: Course?, size: androidx.compose.ui.unit.Dp = 36.dp) {
    val colors = Quill.colors
    val fill = if (course != null) courseColor(course) else colors.hover
    val on = if (course != null) onCourseColor(course) else colors.muted
    Box(Modifier.size(size).background(fill, RoundedCornerShape(size * 0.3f)), contentAlignment = Alignment.Center) {
        LIcon(if (course != null) courseIcon(course.kind) else LIconName.STACK, on, size * 0.55f, 2.2f)
    }
}

@Composable
private fun StatsBar(ui: LearnUi, course: Course?, onCourse: () -> Unit, onShop: () -> Unit) {
    val colors = Quill.colors
    ui.tick
    val state = ui.progress.progress
    val now = ui.now()
    val calendar = ui.calendar()
    val streak = state.currentStreak(now, calendar)
    val xpToday = state.xpToday(now, calendar)
    val goal = state.dailyGoal
    var menu by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            Modifier
                .weight(1f, fill = false)
                .clip(RoundedCornerShape(14.dp))
                .semantics { contentDescription = if (course != null) "Kurs ${course.title}, ${state.xpInCourse(course.id)} XP. Kurs wechseln" else "Kurs wählen" }
                .clickable(role = Role.Button, onClick = onCourse)
                .padding(end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            CourseTile(course)
            QText("${if (course != null) state.xpInCourse(course.id) else 0}", work(16f, FontWeight.SemiBold), colors.ink)
            QText(course?.title ?: "Kurs wählen", work(13.5f), colors.muted, maxLines = 1, modifier = Modifier.weight(1f, fill = false))
        }
        Spacer(Modifier.weight(1f))
        StatChip(LIconName.FLAME, "$streak", if (streak > 0) colors.warn else colors.hint, "Serie: $streak ${if (streak == 1) "Tag" else "Tage"}") { ui.showMode(LearnMode.QUESTS) }
        StatChip(LIconName.DIAMOND, "${state.gems}", colors.link, "${state.gems} Gems. Zum Streak-Schutz", onClick = onShop)
        Box {
            Row(
                Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .semantics { contentDescription = "Tagesziel: $xpToday von $goal XP. Ändern" }
                    .clickable(role = Role.Button) { menu = true }
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                GoalRing(minOf(1f, xpToday.toFloat() / maxOf(1, goal)), xpToday >= goal)
                QText("${minOf(xpToday, 999)}/$goal", work(15f, FontWeight.SemiBold), colors.ink, maxLines = 1)
            }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                for (option in LearnProgress.dailyGoals) {
                    DropdownMenuItem(
                        text = { QText("$option XP am Tag", work(15f, if (option == goal) FontWeight.SemiBold else FontWeight.Normal), colors.ink) },
                        onClick = { ui.setDailyGoal(option); menu = false },
                        trailingIcon = { if (option == goal) LIcon(LIconName.CHECK, colors.link, 18.dp, 2.4f) },
                    )
                }
            }
        }
    }
}

@Composable
private fun StatChip(icon: LIconName, text: String, tint: androidx.compose.ui.graphics.Color, description: String, onClick: () -> Unit) {
    Row(
        Modifier
            .clip(RoundedCornerShape(14.dp))
            .semantics { contentDescription = description }
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        LIcon(icon, tint, 20.dp, filled = true)
        QText(text, work(15f, FontWeight.SemiBold), tint, maxLines = 1)
    }
}

@Composable
private fun ModePills(ui: LearnUi, hasUnclaimed: Boolean) {
    val colors = Quill.colors
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (mode in LearnMode.entries) {
            val on = ui.mode == mode
            Row(
                Modifier
                    .height(38.dp)
                    .background(if (on) colors.ink else androidx.compose.ui.graphics.Color.Transparent, CircleShape)
                    .border(1.dp, if (on) colors.ink else colors.line2, CircleShape)
                    .semantics { contentDescription = mode.title }
                    .clickable(role = Role.Tab) { ui.showMode(mode) }
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                QText(mode.title, work(14f, FontWeight.Medium), if (on) colors.bg else colors.ink, maxLines = 1)
                if (mode == LearnMode.QUESTS && hasUnclaimed) {
                    Box(Modifier.size(7.dp).background(colors.warn, CircleShape).semantics { contentDescription = "Es wartet eine Belohnung" })
                }
            }
        }
    }
}

@Composable
fun LearnHome(ui: LearnUi) {
    val colors = Quill.colors
    ui.tick
    val provider = ui.provider()
    val course = provider?.course
    val progress = ui.progress.progress
    val completed = progress.completedLessons
    val units = if (course != null) CoursePath.units(course, completed) else emptyList()
    val now = ui.now()
    val calendar = ui.calendar()
    val board = ui.quests.board
    val secondsLeft = QuestBoard.secondsUntilNextDay(now, calendar)
    val mode = if (course != null) ui.mode else LearnMode.PATH
    var picker by remember { mutableStateOf(false) }
    var shop by remember { mutableStateOf(false) }
    var tip by remember { mutableStateOf<PathUnit?>(null) }
    val advice = if (provider != null) SkillAdvisor.recommend(SkillMaps.map(provider), ui.skills.records, units, completed, now, calendar) else null
    val follow = {
        val a = advice
        if (a != null) {
            if (a.kind == RecommendationKind.STEP && a.step != null) ui.startStep(a.step!!)
            else if (a.kind == RecommendationKind.REVIEW || a.kind == RecommendationKind.PRACTICE) ui.startPractice(a.skillIDs)
        }
    }
    val notice = ui.notice
    LaunchedEffect(notice) {
        if (notice != null) {
            delay(3500)
            ui.takeNotice()
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            Column(
                Modifier.fillMaxWidth().background(colors.bg).padding(horizontal = 16.dp).padding(top = 6.dp, bottom = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(Modifier.widthIn(max = 960.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatsBar(ui, course, onCourse = { picker = true }, onShop = { shop = true })
                    if (course != null) ModePills(ui, board.hasUnclaimed)
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(colors.lineSoft))
            if (course == null || provider == null) {
                EmptyState(onPick = { picker = true })
            } else when (mode) {
                LearnMode.PATH -> PathPage(ui, course, units, advice, follow, onTip = { tip = it }, onPicker = { picker = true }, secondsLeft = secondsLeft)
                LearnMode.QUESTS -> ScrollPage {
                    QuestsView(board, progress.gems, progress.freezes, secondsLeft, ui::claimQuest) { ui.buyFreeze() }
                }
                LearnMode.SKILLS -> ScrollPage {
                    SkillsView(course.title, ui.controller.skillRows(provider)) { ui.startPractice(listOf(it.skill.id)) }
                }
            }
        }
        if (notice != null) {
            Box(Modifier.align(Alignment.BottomCenter).padding(24.dp)) {
                QText(
                    notice, work(14.5f, FontWeight.Medium), colors.bg,
                    Modifier.background(colors.ink, RoundedCornerShape(20.dp)).padding(horizontal = 18.dp, vertical = 12.dp),
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
    if (picker) CoursePicker(ui, course?.id ?: "") { picker = false }
    if (shop) ShopDialog(ui) { shop = false }
    val unit = tip
    if (unit != null && course != null) TipDialog(ui, unit, course) { tip = null }
}

@Composable
private fun ScrollPage(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 600.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 16.dp, bottom = 40.dp)) {
            content()
        }
    }
}

@Composable
private fun EmptyState(onPick: () -> Unit) {
    val colors = Quill.colors
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically),
    ) {
        PipMark(6.dp)
        QText("Such dir einen Kurs aus", work(26f, FontWeight.SemiBold, tracking = -0.6f), colors.ink, textAlign = TextAlign.Center)
        QText(
            "Sprachen, Mathe, Schach oder Musik: Pip macht daraus kurze Lektionen mit XP, Serie und Quests.",
            work(15f, lineHeight = 21f), colors.muted, Modifier.widthIn(max = 440.dp), textAlign = TextAlign.Center,
        )
        PrimaryButton("Kurs wählen", onPick)
    }
}

@Composable
private fun PathPage(
    ui: LearnUi,
    course: Course,
    units: List<PathUnit>,
    advice: de.maxifrz.lernwerk.learn.skills.Recommendation?,
    follow: () -> Unit,
    onTip: (PathUnit) -> Unit,
    onPicker: () -> Unit,
    secondsLeft: Double,
) {
    val board = ui.quests.board
    val weekly = board.weekly
    val aside: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (advice != null) AdviceCard(advice, follow, onSkills = { ui.showMode(LearnMode.SKILLS) })
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile(
                    "Quests", "${board.dailyDone}/${board.daily.size}",
                    if (board.daily.isEmpty()) 0f else board.dailyDone.toFloat() / board.daily.size,
                    timeLeftShort(secondsLeft), board.hasUnclaimed, { ui.showMode(LearnMode.QUESTS) }, Modifier.weight(1f),
                )
                StatTile(
                    "Woche", if (weekly != null) "${minOf(weekly.progress, weekly.target)} von ${weekly.target}" else " ",
                    if (weekly != null && weekly.target > 0) minOf(1f, weekly.progress.toFloat() / weekly.target) else 0f,
                    "Wochenziel", false, { ui.showMode(LearnMode.QUESTS) }, Modifier.weight(1f),
                )
            }
        }
    }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 840.dp
        val state = rememberLazyListState(initialFirstVisibleItemIndex = pathScrollIndex(units) + if (wide) 0 else 1)
        if (wide) {
            Row(Modifier.fillMaxSize().padding(horizontal = 24.dp), horizontalArrangement = Arrangement.spacedBy(28.dp, Alignment.CenterHorizontally)) {
                Column(Modifier.widthIn(max = 340.dp).weight(0.8f, fill = false).fillMaxWidth(0.4f).verticalScroll(rememberScrollState()).padding(top = 16.dp)) { aside() }
                LazyColumn(Modifier.widthIn(max = 560.dp).weight(1f), state = state, contentPadding = androidx.compose.foundation.layout.PaddingValues(top = 12.dp)) {
                    pathItems(course, units, ui::startStep, onTip, onPicker)
                }
            }
        } else {
            LazyColumn(Modifier.fillMaxSize(), state = state, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 12.dp)) {
                item(key = "aside") { Box(Modifier.padding(bottom = 14.dp)) { aside() } }
                pathItems(course, units, ui::startStep, onTip, onPicker)
            }
        }
    }
}

@Composable
private fun CoursePicker(ui: LearnUi, selectedID: String, onClose: () -> Unit) {
    val colors = Quill.colors
    val progress = ui.progress.progress
    val all = CourseCatalog.courses()
    Dialog(onDismissRequest = onClose) {
        Column(
            Modifier.widthIn(max = 520.dp).background(colors.bg, RoundedCornerShape(24.dp)).verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.Bottom) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    PixelCaption("Lernen")
                    QText("Kurse", work(26f, FontWeight.SemiBold, tracking = -0.6f), colors.ink)
                }
                OutlineButton("Fertig", onClose, height = 38.dp, fontSize = 14f, weight = FontWeight.Medium)
            }
            if (all.isEmpty()) QText("Es sind noch keine Kurse da.", work(15f), colors.muted)
            for (kind in CourseKind.entries) {
                val group = all.filter { it.kind == kind }
                if (group.isEmpty()) continue
                QText(kind.title, work(17f, FontWeight.SemiBold), colors.ink)
                for (course in group) {
                    val done = CoursePath.fraction(course, progress.completedLessons)
                    val percent = Math.round(done * 100).toInt()
                    val points = progress.xpInCourse(course.id)
                    val selected = course.id == selectedID
                    CardBox(
                        Modifier
                            .semantics { contentDescription = "${course.title}, ${course.subtitle}, $percent Prozent geschafft" }
                            .clickable(role = Role.Button) { ui.selectCourse(course.id); onClose() },
                        highlight = selected,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            CourseTile(course, 52.dp)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                QText(course.title, work(16.5f, FontWeight.SemiBold), colors.ink)
                                QText(course.subtitle, work(13.5f), colors.muted)
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 4.dp)) {
                                    LearnBar(done.toFloat(), Modifier.weight(1f), height = 6.dp)
                                    QText(if (points > 0) "$percent % · $points XP" else "$percent %", work(12.5f), colors.faint, maxLines = 1)
                                }
                            }
                            if (selected) LIcon(LIconName.CHECK_CIRCLE, colors.link, 26.dp, 2f)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShopDialog(ui: LearnUi, onClose: () -> Unit) {
    val colors = Quill.colors
    ui.tick
    val progress = ui.progress.progress
    Dialog(onDismissRequest = onClose) {
        Column(Modifier.widthIn(max = 480.dp).background(colors.bg, RoundedCornerShape(24.dp)).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    PixelCaption("Gems")
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LIcon(LIconName.DIAMOND, colors.link, 28.dp, filled = true)
                        QText("${progress.gems}", work(34f, FontWeight.SemiBold, tracking = -0.8f), colors.ink)
                    }
                }
                OutlineButton("Fertig", onClose, height = 38.dp, fontSize = 14f, weight = FontWeight.Medium)
            }
            QText("Gems bekommst du für Lektionen, Quests, Truhen und dein Tagesziel.", work(14.5f, lineHeight = 20f), colors.muted)
            FreezeRow(progress.gems, progress.freezes) { ui.buyFreeze() }
        }
    }
}

@Composable
private fun TipDialog(ui: LearnUi, unit: PathUnit, course: Course, onClose: () -> Unit) {
    val colors = Quill.colors
    val paragraphs = unit.unit.tip.split("\n\n").map { it.trim() }.filter { it.isNotEmpty() }
    val testOut = ui.canTestOut(unit.unit)
    Dialog(onDismissRequest = onClose) {
        Column(
            Modifier.widthIn(max = 520.dp).background(colors.bg, RoundedCornerShape(24.dp)).verticalScroll(rememberScrollState()).padding(22.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            PixelCaption("Einheit ${unit.unit.number} · Tipps", color = courseColor(course))
            QText(unit.unit.title, work(26f, FontWeight.SemiBold, tracking = -0.6f, lineHeight = 31f), colors.ink)
            if (unit.unit.summary.isNotEmpty()) QText(unit.unit.summary, work(15f, lineHeight = 21f), colors.muted)
            Box(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
            for (paragraph in paragraphs) QText(paragraph, work(15.5f, lineHeight = 22f), colors.ink2)
            if (testOut) {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlineButton("Einheit überspringen: Test machen", { onClose(); ui.startTestOut(unit.unit) }, height = 44.dp, fontSize = 15f, weight = FontWeight.Medium)
                    QText(
                        "Ab 85 % richtig, ohne Hilfe, zählt die Einheit als bearbeitet. Als Fähigkeit zählt nur, was der Test zeigt.",
                        work(12.5f, lineHeight = 17f), colors.muted, textAlign = TextAlign.Center,
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { PrimaryButton("Verstanden", onClose) }
        }
    }
}
