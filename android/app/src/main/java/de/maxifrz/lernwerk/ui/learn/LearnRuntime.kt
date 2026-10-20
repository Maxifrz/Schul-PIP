package de.maxifrz.lernwerk.ui.learn

import android.content.Context
import android.content.SharedPreferences
import android.content.res.AssetManager
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import de.maxifrz.lernwerk.learn.CourseCatalog
import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.CourseUnit
import de.maxifrz.lernwerk.learn.KeyValueStore
import de.maxifrz.lernwerk.learn.LearnCalendar
import de.maxifrz.lernwerk.learn.LearnController
import de.maxifrz.lernwerk.learn.LearnControllerDeps
import de.maxifrz.lernwerk.learn.LearnProgressStore
import de.maxifrz.lernwerk.learn.LessonModel
import de.maxifrz.lernwerk.learn.LessonResult
import de.maxifrz.lernwerk.learn.LessonRewards
import de.maxifrz.lernwerk.learn.LessonRun
import de.maxifrz.lernwerk.learn.PathStep
import de.maxifrz.lernwerk.learn.QuestStore
import de.maxifrz.lernwerk.learn.SkillStore
import de.maxifrz.lernwerk.learn.StartResult
import de.maxifrz.lernwerk.learn.chess.course.chessProvider
import de.maxifrz.lernwerk.learn.languages.CourseTextSource
import de.maxifrz.lernwerk.learn.languages.LanguageCourses
import de.maxifrz.lernwerk.learn.math.middle.mathMiddleProvider
import de.maxifrz.lernwerk.learn.math.upper.mathUpperProvider
import de.maxifrz.lernwerk.learn.musiccourse.musicProvider
import java.security.SecureRandom
import java.time.ZoneId
import java.util.UUID

// The Lernen area's wiring: where the learning state is kept (SharedPreferences), where the course texts come from
// (the app's assets), when the clock is read, and the state the screens show. The logic core knows none of this: time,
// zone and seeds enter here, in the UI layer, and are handed to it.

/** The core's key-value store on SharedPreferences, under the keys learn.progress, learn.quests and learn.skills. */
class PrefsKeyValueStore(private val prefs: SharedPreferences) : KeyValueStore {
    override fun get(key: String): String? = prefs.getString(key, null)
    override fun set(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }
}

/** The language courses' texts from assets/courses/<id>.txt (copied there from content/courses by `copyCourseTexts`). */
class AssetCourseTextSource(private val assets: AssetManager) : CourseTextSource {
    override fun text(courseID: String): String = assets.open("courses/$courseID.txt").bufferedReader().use { it.readText() }
}

/** The student's calendar: the system's time zone, weeks start on Monday. */
fun systemLearnCalendar(): LearnCalendar = LearnCalendar(ZoneId.systemDefault().id, 2)

/** A fresh seed per round: 1 to 2^64-1. */
fun randomSeed(random: SecureRandom = SecureRandom()): ULong {
    val seed = random.nextLong().toULong()
    return if (seed == 0uL) 1uL else seed
}

enum class LearnMode(val title: String) { PATH("Pfad"), QUESTS("Quests"), SKILLS("Fähigkeiten") }

/** A round on screen: what was started and what the student has put together so far. */
class ActiveRun(val id: String, val run: LessonRun, val model: LessonModel)

/** What a new course needs to be known to the catalog; the order is that of the picker (it groups by kind). */
fun courseProviders(source: CourseTextSource): List<CourseProvider> =
    LanguageCourses.providers(source) + listOf(mathMiddleProvider, mathUpperProvider, chessProvider, musicProvider)

/** Registers every provider with the catalog (a provider of the same course id is replaced, so this may run twice). */
fun registerLearnCourses(source: CourseTextSource) {
    for (provider in courseProviders(source)) CourseCatalog.registerProvider(provider)
}

/**
 * The state of the Lernen area: the three stores of the core, the controller, and what the screens show (course, view,
 * round). Compose reads [tick], which every change of a store and every minute bumps.
 */
class LearnUi(
    val progress: LearnProgressStore,
    val quests: QuestStore,
    val skills: SkillStore,
    private val prefs: SharedPreferences?,
    private val clock: () -> Long = System::currentTimeMillis,
    private val calendarOf: () -> LearnCalendar = ::systemLearnCalendar,
    private val seed: () -> ULong = { randomSeed() },
) {
    val controller = LearnController(
        LearnControllerDeps(progress = progress, quests = quests, skills = skills, clock = clock, calendar = calendarOf, newSeed = seed),
    )

    /** Bumped whenever a store changes or the clock is read again, so screens read the numbers again. */
    var tick by mutableIntStateOf(0)
        private set
    var courseID by mutableStateOf("")
        private set
    var mode by mutableStateOf(LearnMode.PATH)
        private set
    var active by mutableStateOf<ActiveRun?>(null)
        private set

    /** A sentence for the screen to show once (a chest found, nothing to practise); cleared by [takeNotice]. */
    var notice by mutableStateOf<String?>(null)
        private set

    init {
        val bump = { tick += 1 }
        progress.subscribe(bump)
        quests.subscribe(bump)
        skills.subscribe(bump)
        quests.refresh(clock(), calendarOf())
        val saved = prefs?.getString(KEY_COURSE, null)
        if (saved != null && CourseCatalog.provider(saved) != null) courseID = saved
        mode = LearnMode.entries.firstOrNull { it.name == prefs?.getString(KEY_MODE, null) } ?: LearnMode.PATH
    }

    fun now(): Long = clock()
    fun calendar(): LearnCalendar = calendarOf()
    fun provider(): CourseProvider? = if (courseID.isEmpty()) null else CourseCatalog.provider(courseID)

    /** Starts today's quests if the day has changed, and has the screens read the clock again. */
    fun refreshTime() {
        quests.refresh(clock(), calendarOf())
        tick += 1
    }

    fun selectCourse(id: String) {
        courseID = id
        mode = LearnMode.PATH
        save()
    }

    fun setMode(next: LearnMode) {
        mode = next
        save()
    }

    private fun save() {
        prefs?.edit()?.putString(KEY_COURSE, courseID)?.putString(KEY_MODE, mode.name)?.apply()
    }

    fun takeNotice(): String? = notice.also { notice = null }

    private fun begin(run: LessonRun) {
        val id = UUID.randomUUID().toString()
        active = ActiveRun(id, run, controller.newModel(run, id))
        LearnHost.lessonOpen = true
    }

    private fun handle(result: StartResult) {
        when (result) {
            is StartResult.Run -> begin(result.run)
            is StartResult.Chest -> notice = result.notice
            is StartResult.None -> result.notice?.let { notice = it }
        }
    }

    /** Tapping a step of the path: a chest opens, anything else becomes a round. */
    fun startStep(step: PathStep) {
        if (active != null || courseID.isEmpty()) return
        handle(controller.startStep(step, courseID))
    }

    /** A round on the chosen goals (a recommendation, or the button of a skill). */
    fun startPractice(targets: List<String>) {
        if (active != null || courseID.isEmpty()) return
        handle(controller.startPractice(targets, courseID))
    }

    /** The test of the first unit, for a student who knows it. */
    fun startTestOut(unit: CourseUnit) {
        if (active != null || courseID.isEmpty()) return
        controller.startTestOut(unit, courseID)?.let { begin(it) }
    }

    fun canTestOut(unit: CourseUnit): Boolean = courseID.isNotEmpty() && controller.canTestOut(unit, courseID)

    /** Records a finished round once; what it brought, for the end screen. */
    fun finishRun(result: LessonResult): LessonRewards {
        val current = active ?: return LessonRewards()
        return controller.finish(result, current.run)
    }

    fun closeRun() {
        active = null
        LearnHost.lessonOpen = false
    }

    fun claimQuest(id: String) {
        val gems = quests.claim(id)
        if (gems > 0) progress.addGems(gems)
    }

    fun buyFreeze(): Boolean = progress.buyFreeze()

    fun setDailyGoal(goal: Int) = progress.setDailyGoal(goal)

    companion object {
        const val KEY_COURSE = "ui.course"
        const val KEY_MODE = "ui.mode"

        /** A state on the stores of the app (SharedPreferences "learn"). The courses must be registered. */
        fun create(context: Context): LearnUi {
            val prefs = context.applicationContext.getSharedPreferences("learn", Context.MODE_PRIVATE)
            val store = PrefsKeyValueStore(prefs)
            return LearnUi(LearnProgressStore(store), QuestStore(store), SkillStore(store), prefs)
        }
    }
}

/** The one Lernen state of the process; it is made off the main thread because building the courses takes a moment. */
object LearnHost {
    @Volatile
    private var ui: LearnUi? = null

    /** A round is open: the app hides its tab bar then. */
    var lessonOpen by mutableStateOf(false)

    fun current(): LearnUi? = ui

    /** Registers the courses and opens the stores, once. Call it from a background thread. */
    @Synchronized
    fun start(context: Context): LearnUi {
        ui?.let { return it }
        registerLearnCourses(AssetCourseTextSource(context.applicationContext.assets))
        return LearnUi.create(context).also { ui = it }
    }

    /** For tests: use this state instead of the app's. */
    fun install(state: LearnUi?) {
        ui = state
        lessonOpen = state?.active != null
    }
}
