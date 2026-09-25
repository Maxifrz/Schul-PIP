package de.maxifrz.lernwerk.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.maxifrz.lernwerk.calc.CalculatorEntry
import de.maxifrz.lernwerk.calc.CalculatorHistory
import de.maxifrz.lernwerk.calc.CalculatorInput
import de.maxifrz.lernwerk.calc.CasAnswer
import de.maxifrz.lernwerk.calc.CasEngine
import de.maxifrz.lernwerk.calc.CasPlot
import de.maxifrz.lernwerk.data.StudyMaterial
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File

/** What the calculator tab holds: the line being typed, the history, the angle unit and the graphs. */
private class CalculatorState(val engine: CasEngine, private val file: File, private val scope: CoroutineScope) {
    private val json = Json { ignoreUnknownKeys = true }
    var history by mutableStateOf(
        runCatching { json.decodeFromString(CalculatorHistory.serializer(), file.readText()) }.getOrDefault(CalculatorHistory()),
    )
    var input by mutableStateOf(CalculatorInput())
    var busy by mutableStateOf(false)
    val functions = mutableStateListOf("", "", "")
    var xmin by mutableStateOf("-5")
    var xmax by mutableStateOf("5")
    var plot by mutableStateOf<CasPlot?>(null)
    var plotError by mutableStateOf<String?>(null)
    var plotting by mutableStateOf(false)

    init {
        engine.restore(history.definitions, history.degrees)
        engine.warmUp()
    }

    fun submit() {
        val text = input.text.trim()
        if (text.isEmpty() || busy) return
        busy = true
        scope.launch {
            val answer = runCatching { engine.evaluate(history.resolvingAns(text)) }
                .getOrElse { CasAnswer(ok = false, error = it.message ?: "Das konnte nicht berechnet werden.") }
            history = history.recording(text, answer)
            if (answer.ok) input = CalculatorInput()
            busy = false
            save()
        }
    }

    fun setDegrees(value: Boolean) {
        history = history.copy(degrees = value)
        save()
        scope.launch { engine.setDegrees(value) }
    }

    fun forget(name: String) {
        history = history.forgetting(name)
        save()
        scope.launch { engine.forget(listOf(name)) }
    }

    fun clearHistory() {
        history = history.copy(entries = emptyList())
        save()
    }

    fun insertResult(entry: CalculatorEntry) {
        val exact = entry.exact ?: return
        input = input.inserting("(" + exact.replace("list[", "[").replace("matrix[", "[") + ")")
    }

    private fun save() {
        val snapshot = history
        scope.launch(Dispatchers.IO) { runCatching { file.writeText(json.encodeToString(CalculatorHistory.serializer(), snapshot)) } }
    }

    fun drawGraphs() {
        val expressions = functions.map { it.trim() }
        if (expressions.all { it.isEmpty() }) {
            plotError = "Gib mindestens eine Funktion ein, zum Beispiel x^2 - 2."
            return
        }
        val low = xmin.replace(',', '.').trim().toDoubleOrNull()
        val high = xmax.replace(',', '.').trim().toDoubleOrNull()
        if (low == null || high == null || high <= low) {
            plotError = "Der x-Bereich braucht einen Anfang, der kleiner ist als das Ende."
            return
        }
        plotting = true
        plotError = null
        scope.launch {
            runCatching { engine.plot(expressions, low, high) }
                .onSuccess { if (it.ok) plot = it else plotError = it.error ?: "Das ließ sich nicht zeichnen." }
                .onFailure { plotError = it.message ?: "Das ließ sich nicht zeichnen." }
            plotting = false
        }
    }
}

/** A key: what it shows and what it types, "|" marking where the cursor goes. */
private data class Key(val label: String, val template: String? = null, val action: KeyAction = KeyAction.TYPE)

private enum class KeyAction { TYPE, LEFT, RIGHT, DELETE, CLEAR, SUBMIT }

private val commandKeys = listOf(
    Key("löse", "löse(|, x)"), Key("ableiten", "ableiten(|)"), Key("integriere", "integriere(|, x)"),
    Key("grenzwert", "grenzwert(|, x, unendlich)"), Key("nullstellen", "nullstellen(|)"), Key("faktorisiere", "faktorisiere(|)"),
    Key("vereinfache", "vereinfache(|)"), Key("ausmultiplizieren", "ausmultiplizieren(|)"), Key("tangente", "tangente(|, 1)"),
    Key("Matrix", "[[|, ], [, ]]"), Key("det", "det(|)"), Key("inverse", "inverse(|)"),
    Key("mittelwert", "mittelwert([|])"), Key("median", "median([|])"), Key("standardabweichung", "standardabweichung([|])"),
)

private val keyRows = listOf(
    listOf(Key("x"), Key("y"), Key("("), Key(")"), Key("xⁿ", "^"), Key("√", "√(|)")),
    listOf(Key("7"), Key("8"), Key("9"), Key("÷", "/"), Key("π"), Key("e")),
    listOf(Key("4"), Key("5"), Key("6"), Key("×", "*"), Key("sin", "sin(|)"), Key("cos", "cos(|)")),
    listOf(Key("1"), Key("2"), Key("3"), Key("−", "-"), Key("tan", "tan(|)"), Key("ln", "ln(|)")),
    listOf(Key("0"), Key("."), Key(",", ", "), Key("+"), Key("="), Key("ans")),
    listOf(
        Key("←", action = KeyAction.LEFT), Key("→", action = KeyAction.RIGHT), Key("⌫", action = KeyAction.DELETE),
        Key("AC", action = KeyAction.CLEAR), Key("x²", "^2"), Key("Rechnen", action = KeyAction.SUBMIT),
    ),
)

@Composable
fun CalculatorScreen(app: AppState) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val state = remember { CalculatorState(CasEngine.get(context), File(context.filesDir, "calculator.json"), scope) }
    val engineState by state.engine.state.collectAsState()
    val colors = Quill.colors
    var graphMode by remember { mutableStateOf(false) }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val regular = maxWidth >= 700.dp
        Column(Modifier.fillMaxSize().padding(horizontal = if (regular) 40.dp else 12.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = if (regular) 32.dp else 16.dp, bottom = 12.dp), verticalAlignment = Alignment.Bottom) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    val caption = when (engineState) {
                        CasEngine.State.Ready -> "Giac · exakt und gerundet"
                        is CasEngine.State.Failed -> "Rechenkern nicht verfügbar"
                        else -> "Rechenkern lädt"
                    }
                    PixelCaption(caption, color = if (engineState is CasEngine.State.Failed) colors.warn else colors.hint)
                    QText("Rechner", work(if (regular) 40f else 30f, FontWeight.Light, tracking = -1.1f), colors.ink)
                }
                Segmented(listOf("Rechnen", "Graph"), if (graphMode) 1 else 0) { graphMode = it == 1 }
            }
            if (graphMode) GraphPane(app, state, regular) else CalculatorPane(state, regular)
        }
    }
}

@Composable
private fun Segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    val colors = Quill.colors
    Row(
        Modifier.background(colors.hover, CircleShape).padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        options.forEachIndexed { index, option ->
            Box(
                Modifier
                    .height(30.dp)
                    .background(if (index == selected) colors.surface else Color.Transparent, CircleShape)
                    .clickable { onSelect(index) }
                    .padding(horizontal = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                QText(option, work(13.5f, FontWeight.Medium), colors.ink)
            }
        }
    }
}

// Calculating

@Composable
private fun CalculatorPane(state: CalculatorState, regular: Boolean) {
    if (regular) {
        Row(Modifier.fillMaxSize().padding(bottom = 24.dp), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                HistoryList(state, Modifier.weight(1f))
                Definitions(state)
                InputLine(state)
            }
            Column(Modifier.width(430.dp)) { Keyboard(state, regular) }
        }
    } else {
        Column(Modifier.fillMaxSize().padding(bottom = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HistoryList(state, Modifier.weight(1f))
            Definitions(state)
            InputLine(state)
            Keyboard(state, regular)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HistoryList(state: CalculatorState, modifier: Modifier) {
    val colors = Quill.colors
    val listState = rememberLazyListState()
    val clipboard = LocalClipboardManager.current
    var menuFor by remember { mutableStateOf<String?>(null) }
    var moreOpen by remember { mutableStateOf(false) }
    val entries = state.history.entries
    LaunchedEffect(entries.size) { if (entries.isNotEmpty()) listState.animateScrollToItem(entries.size - 1) }

    Box(
        modifier
            .fillMaxWidth()
            .background(colors.surface, RoundedCornerShape(14.dp))
            .border(1.dp, colors.line, RoundedCornerShape(14.dp)),
    ) {
        if (entries.isEmpty()) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                QText("Tippe eine Rechnung oder einen Befehl, zum Beispiel:", work(14f), colors.muted)
                listOf("löse(x^2 - 5x + 6 = 0, x)", "ableiten(x^3 · sin(x))", "integriere(x^2, x, 0, 3)", "a = 5  ·  f(x) = a·x^2").forEach {
                    QText(it, work(14f).copy(fontFamily = FontFamily.Monospace), colors.ink2)
                }
                QText("Tippe auf ein Ergebnis, um es weiterzuverwenden; gedrückt halten für mehr.", work(12.5f), colors.faint)
            }
        }
        LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
            items(entries, key = { it.id }) { entry ->
                Box {
                    HistoryRow(
                        entry,
                        Modifier.combinedClickable(onClick = { state.insertResult(entry) }, onLongClick = { menuFor = entry.id }),
                    )
                    DropdownMenu(menuFor == entry.id, { menuFor = null }, containerColor = colors.surface) {
                        DropdownMenuItem(text = { QText("Eingabe übernehmen", work(15f), colors.ink) }, onClick = {
                            menuFor = null
                            state.input = CalculatorInput(entry.input)
                        })
                        if (entry.exact != null) {
                            DropdownMenuItem(text = { QText("Ergebnis einfügen", work(15f), colors.ink) }, onClick = {
                                menuFor = null
                                state.insertResult(entry)
                            })
                        }
                        DropdownMenuItem(text = { QText("Kopieren", work(15f), colors.ink) }, onClick = {
                            menuFor = null
                            clipboard.setText(AnnotatedString(entry.pretty ?: entry.input))
                        })
                    }
                }
                QuillDivider(colors.lineSoft)
            }
        }
        if (entries.isNotEmpty()) {
            Box(Modifier.align(Alignment.TopEnd)) {
                QText("···", work(18f, FontWeight.Medium), colors.muted, Modifier.clickable { moreOpen = true }.padding(12.dp))
                DropdownMenu(moreOpen, { moreOpen = false }, containerColor = colors.surface) {
                    DropdownMenuItem(text = { QText("Verlauf leeren", work(15f), colors.ink) }, onClick = {
                        moreOpen = false
                        state.clearHistory()
                    })
                }
            }
        }
    }
}

@Composable
private fun HistoryRow(entry: CalculatorEntry, modifier: Modifier) {
    val colors = Quill.colors
    Column(modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp), horizontalAlignment = Alignment.End) {
        QText(entry.input, work(14f).copy(fontFamily = FontFamily.Monospace), colors.muted, Modifier.fillMaxWidth())
        val matrix = entry.matrix
        when {
            entry.error != null -> QText(entry.error, work(15f), colors.warn)
            matrix != null -> MatrixText(matrix)
            else -> QText(entry.pretty.orEmpty(), work(22f), colors.ink, textAlign = TextAlign.End)
        }
        entry.prettyApprox?.let { QText(if (it.startsWith("L ≈")) it else "≈ $it", work(15f), colors.link) }
    }
}

@Composable
private fun MatrixText(rows: List<List<String>>) {
    val colors = Quill.colors
    Row(
        Modifier
            .border(1.5.dp, colors.ink, RoundedCornerShape(2.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        val columns = rows.firstOrNull()?.size ?: 0
        for (column in 0 until columns) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                rows.forEach { row -> QText(row.getOrElse(column) { "" }, work(18f), colors.ink) }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Definitions(state: CalculatorState) {
    val colors = Quill.colors
    val definitions = state.history.definitions
    if (definitions.isEmpty()) return
    var menuFor by remember { mutableStateOf<String?>(null) }
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PixelCaption("Variablen")
        definitions.forEach { definition ->
            Box {
                QText(
                    definition.pretty,
                    work(13.5f),
                    colors.ink,
                    Modifier
                        .background(colors.hover, CircleShape)
                        .combinedClickable(onClick = { state.input = state.input.inserting(definition.name) }, onLongClick = { menuFor = definition.name })
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                )
                DropdownMenu(menuFor == definition.name, { menuFor = null }, containerColor = colors.surface) {
                    DropdownMenuItem(text = { QText("${definition.name} vergessen", work(15f), colors.ink) }, onClick = {
                        menuFor = null
                        state.forget(definition.name)
                    })
                }
            }
        }
    }
}

@Composable
private fun InputLine(state: CalculatorState) {
    val colors = Quill.colors
    var typing by remember { mutableStateOf(false) }
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .background(colors.surface, RoundedCornerShape(14.dp))
            .border(1.dp, colors.line2, RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val style = work(20f).copy(fontFamily = FontFamily.Monospace, color = colors.ink)
        if (typing) {
            BasicTextField(
                value = state.input.text,
                onValueChange = { state.input = CalculatorInput(it) },
                singleLine = true,
                textStyle = style,
                cursorBrush = SolidColor(colors.accent),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Done, autoCorrectEnabled = false),
                keyboardActions = KeyboardActions(onDone = { state.submit() }),
                modifier = Modifier.weight(1f),
            )
        } else {
            val text = buildAnnotatedString {
                append(state.input.beforeCursor)
                withStyle(SpanStyle(color = colors.accent)) { append("|") }
                append(state.input.afterCursor)
            }
            androidx.compose.foundation.text.BasicText(text, Modifier.weight(1f).clickable { typing = true }, style = style, maxLines = 2)
        }
        QText(
            if (typing) "⌨ Rechner" else "⌨ Tasten",
            work(12.5f, FontWeight.Medium),
            colors.muted,
            Modifier.clickable { typing = !typing }.padding(horizontal = 8.dp, vertical = 6.dp),
        )
        if (state.busy) PulsingDots(4.dp)
    }
}

@Composable
private fun Keyboard(state: CalculatorState, regular: Boolean) {
    val colors = Quill.colors
    fun press(key: Key) {
        when (key.action) {
            KeyAction.TYPE -> state.input = state.input.inserting(key.template ?: key.label)
            KeyAction.LEFT -> state.input = state.input.left()
            KeyAction.RIGHT -> state.input = state.input.right()
            KeyAction.DELETE -> state.input = state.input.backspace()
            KeyAction.CLEAR -> state.input = CalculatorInput()
            KeyAction.SUBMIT -> state.submit()
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Segmented(listOf("Bogenmaß", "Grad"), if (state.history.degrees) 1 else 0) { state.setDegrees(it == 1) }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            commandKeys.forEach { key ->
                QText(
                    key.label,
                    work(13.5f, FontWeight.Medium),
                    colors.link,
                    Modifier
                        .background(colors.accent.copy(alpha = 0.14f), CircleShape)
                        .clickable { press(key) }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }
        keyRows.forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { key ->
                    val submit = key.action == KeyAction.SUBMIT
                    val digit = key.label.length == 1 && key.label[0].isDigit()
                    Box(
                        Modifier
                            .weight(1f)
                            .height(if (regular) 52.dp else 44.dp)
                            .background(if (submit) colors.accent else if (digit) colors.surface else colors.hover, RoundedCornerShape(10.dp))
                            .border(if (digit) 1.dp else 0.dp, colors.line, RoundedCornerShape(10.dp))
                            .clickable(enabled = !(submit && state.busy)) { press(key) },
                        contentAlignment = Alignment.Center,
                    ) {
                        QText(
                            key.label,
                            work(if (submit) 15f else 18f, if (submit) FontWeight.SemiBold else FontWeight.Normal),
                            if (submit) colors.onAccent else colors.ink,
                        )
                    }
                }
            }
        }
    }
}

// Graphs

@Composable
private fun GraphPane(app: AppState, state: CalculatorState, regular: Boolean) {
    val colors = Quill.colors
    val scope = rememberCoroutineScope()
    var choosing by remember { mutableStateOf(false) }
    var inserted by remember { mutableStateOf<String?>(null) }

    val controls: @Composable ColumnScope.() -> Unit = {
        for (index in 0 until 3) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .background(colors.surface, RoundedCornerShape(10.dp))
                    .border(1.dp, colors.line2, RoundedCornerShape(10.dp))
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(Modifier.size(10.dp).background(Color(GraphPainter.color(index)), CircleShape))
                QText("f${index + 1}(x) =", work(14f, FontWeight.Medium), colors.ink2)
                BasicTextField(
                    value = state.functions[index],
                    onValueChange = { state.functions[index] = it },
                    singleLine = true,
                    textStyle = work(16f).copy(fontFamily = FontFamily.Monospace, color = colors.ink),
                    cursorBrush = SolidColor(colors.accent),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Done, autoCorrectEnabled = false),
                    keyboardActions = KeyboardActions(onDone = { state.drawGraphs() }),
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            QText("x von", work(14f), colors.muted)
            RangeField(state.xmin) { state.xmin = it }
            QText("bis", work(14f), colors.muted)
            RangeField(state.xmax) { state.xmax = it }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            PrimaryButton(if (state.plotting) "Zeichnet …" else "Zeichnen", { state.drawGraphs() }, height = 40.dp, enabled = !state.plotting)
            OutlineButton("In Dokument einfügen", { choosing = true }, height = 40.dp, enabled = state.plot != null)
        }
        state.plotError?.let { QText(it, work(13.5f), colors.warn) }
        inserted?.let { QText(it, work(13.5f), colors.link) }
        state.plot?.let { plot ->
            GraphPainter.pointLines(plot).forEach { (title, text) ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QText(title, work(12.5f), colors.muted, Modifier.width(100.dp))
                    QText(text, work(13.5f), colors.ink)
                }
            }
        }
    }

    val graph: @Composable (Modifier) -> Unit = { modifier ->
        Box(
            modifier
                .background(Color.White, RoundedCornerShape(14.dp))
                .border(1.dp, colors.line, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            val plot = state.plot
            if (plot == null) {
                QText("Gib eine Funktion ein und tippe auf „Zeichnen“.", work(15f), hex(0x6E6B62), textAlign = TextAlign.Center)
            } else {
                Canvas(Modifier.fillMaxSize().padding(2.dp)) {
                    drawIntoCanvas { GraphPainter.draw(it.nativeCanvas, plot, size.width, size.height, density) }
                }
            }
        }
    }

    if (regular) {
        Row(Modifier.fillMaxSize().padding(bottom = 24.dp), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            Column(Modifier.width(380.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp), content = controls)
            graph(Modifier.weight(1f).fillMaxHeight())
        }
    } else {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            graph(Modifier.fillMaxWidth().height(320.dp))
            controls()
        }
    }

    if (choosing) {
        val materials = app.repository.materials.filter { !it.isTrashed }.sortedByDescending { it.lastOpenedAt ?: it.createdAt }
        AlertDialog(
            onDismissRequest = { choosing = false },
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
                                    choosing = false
                                    val plot = state.plot ?: return@clickable
                                    scope.launch { inserted = insertGraph(app, material, plot) }
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
            dismissButton = { LinkButton("Abbrechen", { choosing = false }) },
        )
    }
}

@Composable
private fun RangeField(value: String, onChange: (String) -> Unit) {
    val colors = Quill.colors
    BasicTextField(
        value = value,
        onValueChange = onChange,
        singleLine = true,
        textStyle = work(15f).copy(fontFamily = FontFamily.Monospace, color = colors.ink, textAlign = TextAlign.Center, fontSize = 15.sp),
        cursorBrush = SolidColor(colors.accent),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, autoCorrectEnabled = false),
        modifier = Modifier
            .width(70.dp)
            .background(colors.surface, RoundedCornerShape(8.dp))
            .border(1.dp, colors.line2, RoundedCornerShape(8.dp))
            .padding(vertical = 8.dp),
    )
}

/** The graph as a new page after the one last read; returns what to tell the student. */
private suspend fun insertGraph(app: AppState, material: StudyMaterial, plot: CasPlot): String {
    val bitmap = withContext(Dispatchers.Default) { GraphPainter.pageBitmap(plot) }
    val after = material.lastOpenedPage
    return if (app.repository.insertImagePage(material, bitmap, after)) {
        "Als Seite ${after + 2} in „${material.title}“ eingefügt."
    } else {
        "„${material.title}“ ließ sich nicht ändern."
    }
}
