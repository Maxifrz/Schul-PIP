package de.maxifrz.lernwerk.ui

import android.graphics.Bitmap
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import de.maxifrz.lernwerk.calc.MatheHost
import kotlinx.coroutines.launch

/** A graphic from the calculator waiting for the student to pick a document. */
private class PendingPicture(val picture: Bitmap, val answer: (String?) -> Unit)

/**
 * The calculator tab: the calculator app (CAS, graphics, sliders and animations) in one web view that stays loaded.
 * A graphic it exports goes into a document of the library as a new page.
 */
@Composable
fun CalculatorScreen(app: AppState) {
    val context = LocalContext.current
    val host = remember { MatheHost.get(context) }
    val dark = Quill.colors.isDark
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    var pending by remember { mutableStateOf<PendingPicture?>(null) }

    // The page's „Aus Datei öffnen“: the system file picker, answered back to the web view
    var fileAnswer by remember { mutableStateOf<((android.net.Uri?) -> Unit)?>(null) }
    val picker = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.OpenDocument()) { uri ->
        fileAnswer?.invoke(uri)
        fileAnswer = null
    }
    DisposableEffect(host) {
        host.onInsertImage = { picture, answer -> pending = PendingPicture(picture, answer) }
        host.onChooseFile = { types, answer ->
            fileAnswer = answer
            picker.launch(arrayOf("application/json", "text/csv", "text/comma-separated-values", "text/plain", "application/octet-stream") + types)
        }
        onDispose {
            host.onChooseFile = null
            host.onInsertImage = null
            host.release()
        }
    }
    AndroidView(factory = { host.webView(it) }, modifier = Modifier.fillMaxSize(), update = { host.setTheme(dark) })

    pending?.let { request ->
        val close = { message: String? ->
            pending = null
            request.answer(message)
        }
        val materials = app.repository.materials.filter { !it.isTrashed }.sortedByDescending { it.lastOpenedAt ?: it.createdAt }
        AlertDialog(
            onDismissRequest = { close(null) },
            containerColor = colors.surface,
            title = { QText("In welches Dokument?", work(18f, FontWeight.Medium), colors.ink) },
            text = {
                Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                    if (materials.isEmpty()) QText("Noch keine Dokumente in der Bibliothek.", work(15f), colors.muted)
                    materials.forEach { material ->
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clickable {
                                    pending = null
                                    scope.launch {
                                        val after = material.lastOpenedPage
                                        val done = app.repository.insertImagePage(material, request.picture, after)
                                        request.answer(if (done) "Als Seite ${after + 2} in „${material.title}“ eingefügt." else "„${material.title}“ ließ sich nicht ändern.")
                                    }
                                }
                                .padding(vertical = 10.dp),
                        ) {
                            QText(material.title, work(16f), colors.ink)
                            QText("Neue Seite nach Seite ${material.lastOpenedPage + 1}", work(12.5f), colors.muted)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { LinkButton("Abbrechen", { close(null) }) },
        )
    }
}
