package de.maxifrz.lernwerk.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import de.maxifrz.lernwerk.BuildConfig
import de.maxifrz.lernwerk.data.AppSettings
import de.maxifrz.lernwerk.llm.LlmProvider
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.llm.ModelSelection
import de.maxifrz.lernwerk.plan.PlanGenerator

@Composable
fun SettingsScreen(app: AppState) {
    val settings = app.settings
    var pickerTask by remember { mutableStateOf<LlmTask?>(null) }

    Column(Modifier.verticalScroll(rememberScrollState())) {
        ContentColumn(maxWidth = 680.dp) {
            PageHeader("Version ${BuildConfig.VERSION_NAME}", "Einstellungen", Modifier.padding(bottom = 34.dp))

            ModelSection(
                header = "Lernhilfe & Karteikarten",
                settings = settings,
                task = LlmTask.TUTOR,
                footer = "Empfohlen: NVIDIA NIM, gratis. Text im markierten Bereich erkennt das Tablet selbst. Formeln und Handschrift liest die Texterkennung oft falsch – dafür hilft ein Modell, das Bilder versteht.",
                onPickModel = { pickerTask = LlmTask.TUTOR },
            )
            ModelSection(
                header = "Lernplan",
                settings = settings,
                task = LlmTask.PLAN,
                footer = "Empfohlen: OpenRouter. Die App liest PDFs selbst aus, eingescannte Seiten per Texterkennung auf dem Tablet (offline). Nur was dabei unlesbar bleibt, geht an die Texterkennung von OpenRouter (braucht Guthaben, ca. 2 $ pro 1.000 Seiten) oder bei NVIDIA als Bild (höchstens ${PlanGenerator.MAX_SCANNED_PAGE_IMAGES} Seiten).",
                onPickModel = { pickerTask = LlmTask.PLAN },
            )

            Column(Modifier.padding(bottom = 34.dp)) {
                PixelCaption("API-Keys", Modifier.padding(bottom = 6.dp))
                LlmProvider.entries.forEach { ApiKeyRow(it, settings) }
                Footnote("Keys liegen verschlüsselt im Android-Keystore dieses Geräts. Ein Claude-Pro-Abo enthält keinen API-Zugang.")
            }

            Column(Modifier.padding(bottom = 34.dp)) {
                QuillDivider()
                QuillRow("Demo-Modus") { QuillSwitch(settings.demoMode, settings::updateDemoMode) }
                Footnote("Antwortet mit vorbereiteten Beispielen statt einer echten KI – zum Ausprobieren ohne Key.")
            }

            PixelCaption("Über", Modifier.padding(bottom = 6.dp))
            QuillRow("Version", verticalPadding = 15.dp) { QText(BuildConfig.VERSION_NAME, work(14f), Quill.colors.faint) }
            Footnote("Schriften: Work Sans und Silkscreen, SIL Open Font License.")
        }
    }

    pickerTask?.let { task ->
        ModelPickerDialog(settings.selection(task), onSelect = { settings.setSelection(task, it) }, onDismiss = { pickerTask = null })
    }
}

@Composable
private fun ModelSection(header: String, settings: AppSettings, task: LlmTask, footer: String, onPickModel: () -> Unit) {
    val colors = Quill.colors
    val selection = settings.selection(task)
    val option = selection.provider.option(selection.model)
    val hasKey = settings.demoMode || settings.hasKey(selection.provider)

    Column(Modifier.padding(bottom = 34.dp)) {
        PixelCaption(header, Modifier.padding(bottom = 6.dp))
        QuillRow("Anbieter") {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LlmProvider.entries.forEach { provider ->
                    val selected = provider == selection.provider
                    Box(
                        Modifier
                            .height(34.dp)
                            .background(if (selected) colors.ink else Color.Transparent, CircleShape)
                            .border(1.dp, if (selected) Color.Transparent else colors.line2, CircleShape)
                            .pressable(CircleShape) { if (!selected) settings.setSelection(task, ModelSelection.default(task, provider)) }
                            .padding(horizontal = 14.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        QText(provider.displayName, work(13.5f), if (selected) colors.bg else colors.ink, maxLines = 1)
                    }
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().pressable(onClick = onPickModel).padding(vertical = 15.dp, horizontal = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            QText("Modell", work(15.5f), colors.ink)
            Box(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                QText(option?.name ?: selection.model.ifEmpty { "Eigene Modell-ID" }, work(14.5f), colors.ink, maxLines = 1)
                QText(option?.note ?: "Eigenes Modell", work(12.5f), colors.faint)
            }
            Chevron()
        }
        QuillDivider()

        if (option == null) {
            Box(Modifier.padding(vertical = 12.dp, horizontal = 2.dp)) {
                InputCapsule(
                    value = selection.model,
                    onValueChange = { settings.setSelection(task, selection.copy(model = it)) },
                    placeholder = "Modell-ID, z. B. meta/llama-3.2-90b-vision-instruct",
                    monospace = true,
                )
            }
            QuillDivider()
        }

        if (selection.provider != LlmProvider.ANTHROPIC) {
            QuillRow("Bilder mitschicken") {
                QuillSwitch(selection.sendsImages) { settings.setSelection(task, selection.copy(sendsImages = it)) }
            }
        }

        if (!hasKey) {
            Row(Modifier.fillMaxWidth().padding(vertical = 13.dp, horizontal = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                StatusDot(colors.warn)
                QText("Für ${selection.provider.displayName} ist noch kein API-Key hinterlegt.", work(14f), colors.muted)
            }
            QuillDivider()
        }
        Footnote(footer)
    }
}

@Composable
private fun InputCapsule(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    monospace: Boolean = false,
    secret: Boolean = false,
    trailing: @Composable () -> Unit = {},
) {
    val colors = Quill.colors
    val style = if (monospace) work(13f).copy(fontFamily = FontFamily.Monospace, letterSpacing = 0.sp) else work(14.5f)
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = 40.dp)
            .background(colors.surface, CircleShape)
            .border(1.dp, colors.line2, CircleShape)
            .padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.weight(1f).padding(vertical = 8.dp)) {
            if (value.isEmpty()) QText(placeholder, style, colors.hint, maxLines = 1)
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = style.copy(color = colors.ink),
                cursorBrush = SolidColor(colors.accent),
                visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
                keyboardOptions = KeyboardOptions(keyboardType = if (secret) KeyboardType.Password else KeyboardType.Uri, autoCorrectEnabled = false),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        trailing()
    }
}

@Composable
private fun ApiKeyRow(provider: LlmProvider, settings: AppSettings) {
    val colors = Quill.colors
    val context = LocalContext.current
    var input by remember { mutableStateOf("") }
    var saveFailed by remember { mutableStateOf(false) }

    Column(Modifier.padding(vertical = 14.dp, horizontal = 2.dp)) {
        if (settings.hasKey(provider)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusDot()
                QText(provider.displayName, work(15.5f), colors.ink, Modifier.padding(start = 9.dp).weight(1f))
                LinkButton("Entfernen", { settings.deleteKey(provider) }, colors.muted, work(14f, FontWeight.Medium))
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    QText(provider.displayName, work(15.5f, FontWeight.Medium, tracking = -0.15f), colors.ink, Modifier.weight(1f))
                    LinkButton("Key holen", {
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(provider.keyPortal))) }
                    }, style = work(14f))
                }
                InputCapsule(input, { input = it }, provider.keyPlaceholder, secret = true) {
                    PrimaryButton(
                        "Speichern",
                        {
                            saveFailed = !settings.saveKey(input, provider)
                            if (!saveFailed) input = ""
                        },
                        height = 32.dp,
                        fontSize = 13.5f,
                        enabled = input.isNotBlank(),
                    )
                }
                if (saveFailed) QText("Der Key konnte nicht gespeichert werden.", work(12.5f), colors.warn)
            }
        }
    }
    QuillDivider()
}

@Composable
private fun ModelPickerDialog(selection: ModelSelection, onSelect: (ModelSelection) -> Unit, onDismiss: () -> Unit) {
    val colors = Quill.colors
    val isCustom = selection.provider.option(selection.model) == null

    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .widthIn(max = 520.dp)
                .background(colors.bg, RoundedCornerShape(24.dp))
                .padding(start = 24.dp, end = 24.dp, top = 22.dp, bottom = 26.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            PixelCaption("Modell · ${selection.provider.displayName}", Modifier.padding(bottom = 10.dp))
            selection.provider.models.forEach { option ->
                PickerRow(option.name, option.note, option.id == selection.model) {
                    onSelect(selection.copy(model = option.id, sendsImages = option.vision))
                    onDismiss()
                }
            }
            PickerRow("Eigene Modell-ID", "Jedes Modell aus dem Katalog des Anbieters", isCustom) {
                if (!isCustom) onSelect(selection.copy(model = ""))
                onDismiss()
            }
        }
    }
}

@Composable
private fun PickerRow(name: String, note: String, selected: Boolean, onClick: () -> Unit) {
    val colors = Quill.colors
    Row(
        Modifier.fillMaxWidth().pressable(onClick = onClick).padding(vertical = 14.dp, horizontal = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        Box(
            Modifier.padding(top = 1.dp).size(18.dp).border(1.5.dp, if (selected) colors.accent else colors.line3, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) Box(Modifier.size(9.dp).background(colors.accent, CircleShape))
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            QText(name, work(15.5f, FontWeight.Medium, tracking = -0.15f), colors.ink)
            QText(note, work(13.5f), colors.faint)
        }
    }
    QuillDivider()
}
