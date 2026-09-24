package de.maxifrz.lernwerk

import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureRoboImage
import de.maxifrz.lernwerk.data.ReviewCard
import de.maxifrz.lernwerk.data.PlanTopic
import de.maxifrz.lernwerk.data.StudyPlan
import de.maxifrz.lernwerk.tutor.DemoLlmClient
import de.maxifrz.lernwerk.tutor.TutorContext
import de.maxifrz.lernwerk.tutor.TutorSession
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
        compose.setContent { QuillTheme { RootScreen(app.repository, app.settings, MutableStateFlow(null)) } }
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
