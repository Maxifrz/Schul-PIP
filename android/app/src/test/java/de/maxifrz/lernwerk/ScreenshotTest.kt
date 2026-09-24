package de.maxifrz.lernwerk

import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performTextInput
import de.maxifrz.lernwerk.ui.AssistantTab
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureRoboImage
import de.maxifrz.lernwerk.data.ReviewCard
import de.maxifrz.lernwerk.data.PlanTopic
import de.maxifrz.lernwerk.data.StudyPlan
import de.maxifrz.lernwerk.tutor.DemoLlmClient
import de.maxifrz.lernwerk.tutor.TutorContext
import de.maxifrz.lernwerk.tutor.TutorSession
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import de.maxifrz.lernwerk.present.PresentationAssistant
import de.maxifrz.lernwerk.present.SlidePainter
import de.maxifrz.lernwerk.present.SlideTheme
import de.maxifrz.lernwerk.present.SlideLayout
import de.maxifrz.lernwerk.present.SlideLayouts
import de.maxifrz.lernwerk.ui.AppState
import de.maxifrz.lernwerk.ui.LocalSlidePainter
import de.maxifrz.lernwerk.ui.PresentScreen
import de.maxifrz.lernwerk.ui.PresentationCreateScreen
import de.maxifrz.lernwerk.ui.PresentationEditorScreen
import androidx.compose.foundation.background
import de.maxifrz.lernwerk.ui.QuillTheme
import de.maxifrz.lernwerk.ui.RootScreen
import de.maxifrz.lernwerk.ui.TutorPanel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.LocalDate

/** Renders the main screens on a landscape tablet so layout and theme can be checked without a device. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w1180dp-h820dp-land-mdpi")
class ScreenshotTest {
    @get:Rule
    val compose = createComposeRule()

    private val app get() = ApplicationProvider.getApplicationContext<LernwerkApp>()

    private fun root() {
        compose.setContent { QuillTheme { RootScreen(app.repository, app.settings, app.presentations, MutableStateFlow(null)) } }
    }

    @Test
    fun libraryEmpty() {
        root()
        compose.onRoot().captureRoboImage("build/screenshots/library-empty.png")
    }

    @Test
    fun settings() {
        root()
        compose.onNodeWithText("Einstellungen").performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/settings.png")
    }

    @Test
    @Config(qualifiers = "+night")
    fun settingsDark() {
        root()
        compose.onNodeWithText("Einstellungen").performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/settings-dark.png")
    }

    @Test
    fun planAndReview() {
        val today = LocalDate.now().toEpochDay()
        app.repository.addPlan(
            StudyPlan(
                title = "Analysis Abi",
                examDay = today + 20,
                minutesPerDay = 45,
                isOverbooked = false,
                topics = listOf(
                    PlanTopic(title = "Verkettete Funktionen erkennen", summary = "Du kannst innere und äußere Funktion benennen.", materialId = null, sourcePages = listOf(1), estimatedMinutes = 20, order = 0, scheduledDay = today, isDone = true),
                    PlanTopic(title = "Kettenregel anwenden", summary = "Du leitest verkettete Funktionen ab.", materialId = null, sourcePages = listOf(1, 2), estimatedMinutes = 30, order = 1, scheduledDay = today + 1),
                ),
            ),
        )
        app.repository.addCard(ReviewCard(front = "Wie leitest du (2x − 7)³ ab?", back = "Äußere mal innere Ableitung: 6(2x − 7)².", materialId = null, page = 2))
        root()
        compose.onNodeWithText("Lernplan").performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/plans.png")
        compose.onNodeWithText("Analysis Abi").performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/plan-detail.png")
        compose.onNodeWithText("Lernplan", substring = false).performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Wiederholen").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Antwort zeigen").performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/review.png")
    }

    private fun demoDeck() = runBlocking {
        PresentationAssistant(DemoLlmClient(0)).generate(
            listOf(PresentationAssistant.Material("m", "Demo", byteArrayOf(1))), "", 6, 5, SlideTheme.QUILL.id, { null }, { _, _ -> null },
        )
    }

    private fun withApp(content: @Composable (AppState) -> Unit) {
        compose.setContent {
            QuillTheme {
                val context = LocalContext.current
                val state = remember { AppState(app.repository, app.settings, app.presentations) }
                CompositionLocalProvider(LocalSlidePainter provides remember { SlidePainter(context) }) { content(state) }
            }
        }
    }

    @Test
    fun presentations() {
        val deck = demoDeck()
        app.presentations.add(deck)
        app.presentations.add(deck.copy(id = "zwei", title = "Kreide-Design", themeId = SlideTheme.CHALK.id))
        root()
        compose.onNodeWithText("Präsentation").performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/presentations.png")
    }

    @Test
    fun presentationEditor() {
        val deck = demoDeck()
        app.presentations.add(deck)
        withApp { PresentationEditorScreen(it, deck.id) }
        compose.onNodeWithText("4").performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/editor.png")
    }

    @Test
    @Config(qualifiers = "+night")
    fun presentationEditorDarkWithChalk() {
        val deck = demoDeck().copy(themeId = SlideTheme.CHALK.id)
        app.presentations.add(deck)
        withApp { PresentationEditorScreen(it, deck.id) }
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/editor-dark.png")
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty() }
        compose.waitForIdle()
    }

    @Test
    fun presentationChat() {
        app.settings.updateDemoMode(true)
        val deck = demoDeck()
        app.presentations.add(deck)
        // Pip animates forever, so the clock is stepped by hand.
        compose.mainClock.autoAdvance = false
        withApp { PresentationEditorScreen(it, deck.id, AssistantTab.CHAT) }
        compose.mainClock.advanceTimeBy(500)
        compose.onAllNodes(hasSetTextAction()).onLast().performTextInput("Schreib mir eine Abschlussnotiz")
        compose.mainClock.advanceTimeBy(100)
        compose.onNodeWithText("Senden").performClick()
        repeat(100) {
            if (compose.onAllNodesWithText("Notizen der letzten Folie", substring = true).fetchSemanticsNodes().isEmpty()) {
                compose.mainClock.advanceTimeBy(100)
                Thread.sleep(20)
            }
        }
        compose.mainClock.advanceTimeBy(1000)
        compose.onRoot().captureRoboImage("build/screenshots/assistant-chat.png")
    }

    @Test
    fun presentationCritic() {
        app.settings.updateDemoMode(true)
        val deck = demoDeck()
        app.presentations.add(deck)
        withApp { PresentationEditorScreen(it, deck.id, AssistantTab.CRITIC) }
        compose.onNodeWithText("Kritik starten").performClick()
        waitForText("Vorschläge übernehmen")
        compose.onRoot().captureRoboImage("build/screenshots/assistant-critic.png")
        compose.onAllNodesWithText("Übernehmen")[0].performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/assistant-critic-applied.png")
    }

    @Test
    fun presenting() {
        val deck = demoDeck()
        app.presentations.add(deck)
        compose.mainClock.autoAdvance = false
        withApp { PresentScreen(it, deck.id, 3) }
        compose.mainClock.advanceTimeBy(500)
        compose.onNodeWithText("Notizen").performClick()
        compose.mainClock.advanceTimeBy(500)
        compose.onRoot().captureRoboImage("build/screenshots/present.png")
    }

    /** Every demo slide and every editor preset on one sheet, light and in the Kreide design, for a visual check. */
    @Test
    fun slideTypes() {
        val deck = demoDeck()
        val painter = SlidePainter(app)
        val slides = deck.slides + SlideLayout.entries.filter { it != SlideLayout.BLANK }.map { SlideLayouts.preset(it) }
        val width = 480
        val height = 270
        val columns = 4
        val rows = (slides.size + columns - 1) / columns
        for ((theme, file) in listOf(SlideTheme.QUILL to "slide-types.png", SlideTheme.CHALK to "slide-types-chalk.png")) {
            val sheet = android.graphics.Bitmap.createBitmap(columns * (width + 12), rows * (height + 12), android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(sheet)
            canvas.drawColor(android.graphics.Color.rgb(200, 200, 200))
            slides.forEachIndexed { index, slide ->
                canvas.drawBitmap(painter.bitmap(slide, theme, width, emptyMap()), (index % columns) * (width + 12f), (index / columns) * (height + 12f), null)
            }
            java.io.File("build/screenshots").mkdirs()
            java.io.FileOutputStream("build/screenshots/$file").use { sheet.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
        }
        java.io.File("build/pptx").mkdirs()
        java.io.File("build/pptx/demo.pptx").writeBytes(de.maxifrz.lernwerk.present.PptxWriter.write(deck.copy(slides = slides)) { null })
        // Compared with the iOS layouts, which must produce the same slides.
        val parity = de.maxifrz.lernwerk.present.Presentation(id = "p", title = "P", slides = slides.map { it.copy(notes = "") })
        java.io.File("build/pptx/parity.pptx").writeBytes(de.maxifrz.lernwerk.present.PptxWriter.write(parity) { null })
    }

    private fun libraryFixture() {
        val repository = app.repository
        // PdfDocument does not work under Robolectric; the tiles show their placeholder cover.
        val pdf = byteArrayOf(1)
        val bio = repository.createFolder("Biologie", null)!!
        repository.createFolder("Klausur Q2", bio.id)
        repository.createFolder("Mathe", null)
        repository.createFolder("Deutsch", null)
        val now = System.currentTimeMillis()
        listOf(
            de.maxifrz.lernwerk.data.StudyMaterial(title = "Kettenregel Übungen", subject = "Mathe", isFavorite = true, lastOpenedAt = now, lastOpenedPage = 3),
            de.maxifrz.lernwerk.data.StudyMaterial(title = "Faust I – Szenenanalyse", subject = "Deutsch", lastOpenedAt = now - 1000),
            de.maxifrz.lernwerk.data.StudyMaterial(title = "Photosynthese Skript", subject = "Biologie", folderId = bio.id, isFavorite = true),
            de.maxifrz.lernwerk.data.StudyMaterial(title = "Arbeitsblatt Weimarer Republik", subject = "Geschichte"),
            de.maxifrz.lernwerk.data.StudyMaterial(title = "Alte Mitschrift", deletedAt = now - 3L * 24 * 60 * 60 * 1000),
        ).forEach { material ->
            repository.pdfFile(material).writeBytes(pdf)
            repository.materials += material
        }
    }

    @Test
    fun library() {
        libraryFixture()
        root()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/library.png")
        compose.onNodeWithText("Auswählen").performClick()
        compose.onAllNodesWithText("Kettenregel Übungen").onLast().performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/library-select.png")
        compose.onNodeWithText("Fertig").performClick()
        compose.onAllNodesWithText("Biologie", substring = false).onLast().performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/library-folder.png")
    }

    @Test
    fun libraryTrash() {
        libraryFixture()
        root()
        compose.onAllNodes(androidx.compose.ui.test.hasScrollAction()).onFirst().performScrollToNode(androidx.compose.ui.test.hasText("Papierkorb (1)"))
        compose.onNodeWithText("Papierkorb (1)").performClick()
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/screenshots/library-trash.png")
    }

    @Test
    fun presentationCreate() {
        withApp { PresentationCreateScreen(it) }
        compose.onRoot().captureRoboImage("build/screenshots/presentation-create.png")
    }

    @Test
    fun appIcon() {
        val context = ApplicationProvider.getApplicationContext<LernwerkApp>()
        compose.setContent {
            androidx.compose.foundation.Image(
                painter = androidx.compose.ui.res.painterResource(R.drawable.ic_launcher_foreground),
                contentDescription = null,
                modifier = Modifier.width(216.dp).background(androidx.compose.ui.graphics.Color(0xFFFAF9F6)),
            )
        }
        compose.onRoot().captureRoboImage("build/screenshots/app-icon.png")
        check(context.packageName.isNotEmpty())
    }

    @Test
    fun tutorPanel() {
        val session = TutorSession(
            TutorContext("Demo: Kettenregel", 2, "a) f(x) = (2x − 7)³", "", topicTitle = "Kettenregel anwenden"),
            regionImage = null,
            client = DemoLlmClient(0),
        )
        runBlocking {
            session.start()
            session.answer("Zuerst wird 2x − 7 berechnet.")
            session.requestMoreHelp()
        }
        // Pip and the loading dots animate forever, so the clock is stepped by hand.
        compose.mainClock.autoAdvance = false
        compose.setContent { QuillTheme { TutorPanel(session, {}, Modifier.width(390.dp).fillMaxHeight()) } }
        compose.mainClock.advanceTimeBy(1500)
        compose.onRoot().captureRoboImage("build/screenshots/tutor.png")
    }
}
