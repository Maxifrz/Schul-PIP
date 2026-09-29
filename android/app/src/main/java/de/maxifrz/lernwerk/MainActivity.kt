package de.maxifrz.lernwerk

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.content.IntentCompat
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import de.maxifrz.lernwerk.data.AppSettings
import de.maxifrz.lernwerk.data.PresentationStore
import de.maxifrz.lernwerk.data.Repository
import de.maxifrz.lernwerk.ui.QuillTheme
import de.maxifrz.lernwerk.ui.RootScreen
import kotlinx.coroutines.flow.MutableStateFlow

class LernwerkApp : Application() {
    lateinit var repository: Repository
        private set
    lateinit var settings: AppSettings
        private set
    lateinit var presentations: PresentationStore
        private set

    /** Files just shared to the app, until the app screen has placed them. */
    val shareRequests = MutableStateFlow<List<Uri>?>(null)

    override fun onCreate() {
        super.onCreate()
        PDFBoxResourceLoader.init(this)
        repository = Repository(this)
        settings = AppSettings(this)
        presentations = PresentationStore(this)
        de.maxifrz.lernwerk.calc.ExamLock.load(this)
        // Alarms do not survive every update or a force stop; setting them again is harmless.
        de.maxifrz.lernwerk.notify.Reminders.scheduleAll(this, repository.plans)
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as LernwerkApp
        setContent {
            QuillTheme {
                RootScreen(app.repository, app.settings, app.presentations, app.shareRequests)
            }
        }
        if (savedInstanceState == null) importShared(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        importShared(intent)
    }

    /**
     * PDFs, pictures and Word files opened with or shared to Lernwerk. The app screen decides what happens: with a
     * document open it asks whether they go into it or into the library.
     */
    private fun importShared(intent: Intent?) {
        val uris: List<Uri> = when (intent?.action) {
            Intent.ACTION_VIEW -> listOfNotNull(intent.data)
            Intent.ACTION_SEND -> listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
            Intent.ACTION_SEND_MULTIPLE ->
                IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
            else -> emptyList()
        }
        if (uris.isNotEmpty()) (application as LernwerkApp).shareRequests.value = uris
    }
}
