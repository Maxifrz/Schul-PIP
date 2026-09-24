package de.maxifrz.lernwerk

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.content.IntentCompat
import androidx.lifecycle.lifecycleScope
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import de.maxifrz.lernwerk.data.AppSettings
import de.maxifrz.lernwerk.data.PresentationStore
import de.maxifrz.lernwerk.data.Repository
import de.maxifrz.lernwerk.ui.QuillTheme
import de.maxifrz.lernwerk.ui.RootScreen
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class LernwerkApp : Application() {
    lateinit var repository: Repository
        private set
    lateinit var settings: AppSettings
        private set
    lateinit var presentations: PresentationStore
        private set

    /** Material that was just shared to the app and should open right away. */
    val openRequests = MutableStateFlow<String?>(null)

    override fun onCreate() {
        super.onCreate()
        PDFBoxResourceLoader.init(this)
        repository = Repository(this)
        settings = AppSettings(this)
        presentations = PresentationStore(this)
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as LernwerkApp
        setContent {
            QuillTheme {
                RootScreen(app.repository, app.settings, app.presentations, app.openRequests)
            }
        }
        if (savedInstanceState == null) importShared(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        importShared(intent)
    }

    /** PDFs and images opened with or shared to Lernwerk land in the library; a single one opens. */
    private fun importShared(intent: Intent?) {
        val uris: List<Uri> = when (intent?.action) {
            Intent.ACTION_VIEW -> listOfNotNull(intent.data)
            Intent.ACTION_SEND -> listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
            Intent.ACTION_SEND_MULTIPLE ->
                IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
            else -> emptyList()
        }
        if (uris.isEmpty()) return
        val app = application as LernwerkApp
        lifecycleScope.launch {
            val imported = uris.mapNotNull { uri ->
                runCatching { app.repository.importFile(uri) }
                    .onFailure { Toast.makeText(this@MainActivity, it.message ?: "Import fehlgeschlagen.", Toast.LENGTH_LONG).show() }
                    .getOrNull()
            }
            when {
                imported.size == 1 -> app.openRequests.value = imported.single().id
                imported.size > 1 -> Toast.makeText(this@MainActivity, "${imported.size} Dateien in der Bibliothek", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
