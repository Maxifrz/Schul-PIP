package de.maxifrz.lernwerk.tutor

import de.maxifrz.lernwerk.llm.DocumentHandling
import de.maxifrz.lernwerk.llm.LlmCapabilities
import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmResponse
import de.maxifrz.lernwerk.llm.LlmRole
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Bundled sample material and canned answers so the app can be tried without an API key. */
object DemoContent {
    const val MATERIAL_TITLE = "Demo: Kettenregel"

    val pages: List<Pair<String, String>> = listOf(
        "Die Kettenregel" to """
            Viele Funktionen sind verkettet: Eine äußere Funktion wird auf eine innere Funktion angewendet, zum Beispiel f(x) = (3x² + 1)⁵. Die innere Funktion ist v(x) = 3x² + 1, die äußere u(v) = v⁵.

            Kettenregel: f(x) = u(v(x))  ⇒  f'(x) = u'(v(x)) · v'(x)

            Merksatz: äußere Ableitung mal innere Ableitung.

            Beispiel: f(x) = (3x² + 1)⁵
            u'(v) = 5v⁴ und v'(x) = 6x
            f'(x) = 5(3x² + 1)⁴ · 6x = 30x(3x² + 1)⁴

            Typischer Fehler: Die innere Ableitung wird vergessen. Dann steht dort nur 5(3x² + 1)⁴ – das ist falsch, weil die Änderung der inneren Funktion fehlt.
        """.trimIndent(),
        "Übungsaufgaben" to """
            Bestimme jeweils die erste Ableitung.

            a) f(x) = (2x − 7)³
            b) g(x) = sin(4x)
            c) h(x) = e^(x²)
            d) k(x) = √(5x + 2)

            Tipp: Wenn du feststeckst, wähle unten das Hilfe-Werkzeug und ziehe einen Rahmen um die Aufgabe.
        """.trimIndent(),
    )

    fun tutorReply(level: HintLevel, studentTurns: Int): String = when {
        level == HintLevel.QUESTION && studentTurns <= 1 ->
            "Schau dir die Funktion genau an: Welcher Teil wird *zuerst* berechnet, wenn du eine Zahl für x einsetzt – und was passiert danach mit diesem Ergebnis?"
        level == HintLevel.QUESTION ->
            "Guter Gedanke! Du erkennst, dass hier zwei Funktionen ineinanderstecken. Wie würdest du die **äußere** Funktion ableiten, wenn du den inneren Teil erst einmal wie eine einzelne Variable behandelst?"
        level == HintLevel.HINT ->
            "Hinweis: Das ist ein Fall für die **Kettenregel** – äußere Ableitung mal innere Ableitung. Nenne den Teil in der Klammer v. Was ist die Ableitung von v³ nach v, und was ist v'(x)?"
        else -> """
            So geht's Schritt für Schritt:
            1. Innere Funktion: v(x) = 2x − 7, also v'(x) = 2
            2. Äußere Funktion: u(v) = v³, also u'(v) = 3v²
            3. Kettenregel: f'(x) = 3(2x − 7)² · 2 = **6(2x − 7)²**

            Skizzen-Tipp: Zeichne zwei Kästen – innen „2x − 7“, außen „( )³“ – und schreib an jeden Kasten seine Ableitung.

            Kurzer Check: Wie lautet die Ableitung von (5x + 1)²?
        """.trimIndent()
    }

    val flashcardJson: String = Json.encodeToString(
        Flashcard.serializer(),
        Flashcard(
            front = "Wie leitest du eine verkettete Funktion wie (2x − 7)³ ab?",
            back = "Mit der Kettenregel: äußere Ableitung mal innere Ableitung. Hier 3(2x − 7)² · 2 = 6(2x − 7)².",
        ),
    )

    val deckJson = """
        {"title":"Die Kettenregel","slides":[
        {"layout":"TITLE","title":"Die Kettenregel","subtitle":"Name · Mathematik","notes":"Hallo zusammen, heute geht es um die Kettenregel – eine der wichtigsten Ableitungsregeln fürs Abi.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"BULLETS","title":"Verkettete Funktionen","bullets":["Äußere Funktion wirkt auf innere","Beispiel: (3x² + 1)⁵","Innen: 3x² + 1, außen: v⁵"],"notes":"Viele Funktionen bestehen aus zwei Teilen: Erst wird innen gerechnet, dann wird das Ergebnis außen weiterverarbeitet.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"QUOTE","title":"Merksatz","quote":"Äußere Ableitung mal innere Ableitung.","attribution":"Demo: Kettenregel, S. 1","notes":"Diesen Satz solltet ihr euch merken – er ist die ganze Regel in einem Satz.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"TWO_COLUMNS","title":"Richtig und falsch","leftTitle":"Richtig","left":["5(3x² + 1)⁴ · 6x","= 30x(3x² + 1)⁴"],"rightTitle":"Typischer Fehler","right":["Nur 5(3x² + 1)⁴","Innere Ableitung vergessen"],"notes":"Der häufigste Fehler ist, die innere Ableitung zu vergessen. Links seht ihr die richtige Lösung.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"BULLETS","title":"Fazit","bullets":["Verkettung erkennen","Außen ableiten, innen stehen lassen","Mit innerer Ableitung multiplizieren"],"notes":"Zusammengefasst: erkennen, außen ableiten, mit der inneren Ableitung multiplizieren.","sourceMaterial":0,"sourcePages":[1,2]},
        {"layout":"BULLETS","title":"Quellen","bullets":["Demo: Kettenregel, S. 1–2"],"notes":"Alle Inhalte stammen aus dem Demo-Material.","sourceMaterial":0,"sourcePages":[1,2]}
        ]}
    """.trimIndent()

    const val FEEDBACK = """**Das gelingt dir schon:**
- Klarer Aufbau von der Definition über das Beispiel zum Fazit
- Der Merksatz bekommt eine eigene Folie

**Fragen zum Weiterdenken:**
1. Folie 2: Woran erkennt deine Klasse ohne Vorwissen, welcher Teil die *innere* Funktion ist?
2. Folie 4: Würde ein eigenes Rechenbeispiel Schritt für Schritt helfen, bevor du den Fehler zeigst?
3. Passen sechs Folien zu deiner geplanten Redezeit, oder bleibt Zeit für eine Übungsaufgabe mit der Klasse?"""

    fun slideEdit(request: de.maxifrz.lernwerk.llm.LlmRequest): String {
        val prompt = request.messages.flatMap { it.content }.filterIsInstance<de.maxifrz.lernwerk.llm.LlmContent.Text>().joinToString("\n") { it.text }
        if (prompt.startsWith("Redesign")) {
            return """{"layout":"BULLETS","title":"Neu gestaltet","bullets":["Kernaussage zuerst","Höchstens drei Punkte"],"notes":"Diese Folie wurde im Demo-Modus neu gestaltet."}"""
        }
        val texts = Regex("<text id=\"([^\"]+)\"[^>]*>\n([\\s\\S]*?)\n</text>").findAll(prompt).map { match ->
            val shortened = match.groupValues[2].lines().take(3).joinToString("\n") { line -> line.split(" ").take(5).joinToString(" ") }
            buildJsonObject {
                put("id", match.groupValues[1])
                put("text", shortened)
            }
        }.toList()
        return buildJsonObject { put("texts", JsonArray(texts)) }.toString()
    }

    private fun slideIds(request: de.maxifrz.lernwerk.llm.LlmRequest): List<String> {
        val prompt = request.messages.flatMap { it.content }.filterIsInstance<de.maxifrz.lernwerk.llm.LlmContent.Text>().joinToString("\n") { it.text }
        return Regex("<slide number=\"\\d+\" id=\"([^\"]+)\"").findAll(prompt).map { it.groupValues[1] }.toList()
    }

    fun chat(request: de.maxifrz.lernwerk.llm.LlmRequest): String {
        val first = slideIds(request).lastOrNull()
        val changes = if (first == null) JsonArray(emptyList()) else JsonArray(
            listOf(
                buildJsonObject {
                    put("action", "set_notes")
                    put("summary", "Notizen der letzten Folie ergänzt")
                    put("slideId", first)
                    put("notes", "Demo: Hier würde die KI deine Anweisung umsetzen. Mit einem echten Modell ändert sie Texte, Folien, Reihenfolge oder Design.")
                },
            ),
        )
        return buildJsonObject {
            put("message", "Im Demo-Modus verstehe ich deine Anweisung nicht wirklich – als Beispiel habe ich die Notizen der letzten Folie ergänzt. Rückgängig geht oben links.")
            put("changes", changes)
        }.toString()
    }

    fun critique(request: de.maxifrz.lernwerk.llm.LlmRequest): String {
        val ids = slideIds(request)
        val findings = buildList {
            ids.getOrNull(1)?.let { id ->
                add(
                    buildJsonObject {
                        put("severity", "high")
                        put("slideId", id)
                        put("problem", "Die Folie behauptet etwas, ohne es zu begründen oder ein Beispiel zu zeigen.")
                        put("suggestion", "Ergänze in den Notizen ein kurzes Rechenbeispiel, das du beim Vortrag erklärst.")
                        put("changes", JsonArray(listOf(buildJsonObject {
                            put("action", "set_notes")
                            put("summary", "Rechenbeispiel in die Notizen")
                            put("slideId", id)
                            put("notes", "Beispiel: f(x) = (2x + 1)³ → f'(x) = 3(2x + 1)² · 2 = 6(2x + 1)². Innen ableiten nicht vergessen!")
                        })))
                    },
                )
            }
            add(
                buildJsonObject {
                    put("severity", "medium")
                    put("problem", "Es fehlt eine Übungsfolie, auf der die Klasse selbst etwas ausprobiert.")
                    put("suggestion", "Füge vor dem Fazit eine Folie mit einer kurzen Aufgabe ein.")
                    put("changes", JsonArray(listOf(buildJsonObject {
                        put("action", "insert_slide")
                        put("summary", "Übungsfolie vor dem Fazit einfügen")
                        put("afterSlideId", ids.getOrNull(maxOf(0, ids.size - 3)) ?: "")
                        put("slide", buildJsonObject {
                            put("layout", "BULLETS")
                            put("title", "Probier es selbst")
                            put("bullets", JsonArray(listOf(kotlinx.serialization.json.JsonPrimitive("Leite ab: (5x − 1)⁴"), kotlinx.serialization.json.JsonPrimitive("Zeit: 1 Minute"))))
                            put("notes", "Gib der Klasse eine Minute und löse dann gemeinsam.")
                        })
                    })))
                },
            )
            add(
                buildJsonObject {
                    put("severity", "low")
                    put("problem", "Im Demo-Modus prüft kein echtes Modell deine Folien.")
                    put("suggestion", "Hinterlege in den Einstellungen einen API-Key für eine echte Kritik.")
                    put("changes", JsonArray(emptyList()))
                },
            )
        }
        return buildJsonObject {
            put("verdict", "Demo-Kritik: Der Aufbau ist nachvollziehbar, aber Belege und Beteiligung der Klasse fehlen. Mit einem echten Modell wird die Kritik deutlich genauer.")
            put("findings", JsonArray(findings))
        }.toString()
    }

    fun speakerNotes(request: de.maxifrz.lernwerk.llm.LlmRequest): String {
        val prompt = request.messages.flatMap { it.content }.filterIsInstance<de.maxifrz.lernwerk.llm.LlmContent.Text>().joinToString("\n") { it.text }
        val count = Regex("<slide number=").findAll(prompt).count()
        val notes = (1..count).map { number ->
            buildJsonObject {
                put("slide", number)
                put("notes", "Demo-Notiz für Folie $number: Erkläre in zwei, drei Sätzen, was die Folie zeigt, und schau dabei in die Klasse.")
            }
        }
        return buildJsonObject { put("notes", JsonArray(notes)) }.toString()
    }

    val planJson = """
        {"topics":[
        {"title":"Verkettete Funktionen erkennen","summary":"Du kannst bei einer Funktion innere und äußere Funktion benennen.","prerequisites":[],"materialIndex":0,"sourcePages":[1],"estimatedMinutes":20},
        {"title":"Kettenregel anwenden","summary":"Du leitest verkettete Funktionen mit äußerer mal innerer Ableitung ab.","prerequisites":["Verkettete Funktionen erkennen"],"materialIndex":0,"sourcePages":[1],"estimatedMinutes":30},
        {"title":"Übungsaufgaben zur Kettenregel","summary":"Du löst gemischte Aufgaben mit Potenz-, Sinus-, e- und Wurzelfunktionen.","prerequisites":["Kettenregel anwenden"],"materialIndex":0,"sourcePages":[2],"estimatedMinutes":45}
        ]}
    """.trimIndent()
}

class DemoLlmClient(private val latencyMillis: Long = 700) : LlmClient {
    override val capabilities = LlmCapabilities(acceptsImages = true, documentHandling = DocumentHandling.NATIVE_PDF)

    override suspend fun complete(request: LlmRequest): LlmResponse {
        delay(latencyMillis)
        val text = when (val purpose = request.purpose) {
            is LlmPurpose.Tutor -> DemoContent.tutorReply(
                purpose.level,
                request.messages.count { it.role == LlmRole.USER },
            )
            LlmPurpose.Flashcard -> DemoContent.flashcardJson
            LlmPurpose.StudyPlan -> DemoContent.planJson
            LlmPurpose.Presentation -> DemoContent.deckJson
            LlmPurpose.SlideRewrite -> DemoContent.slideEdit(request)
            LlmPurpose.SpeakerNotes -> DemoContent.speakerNotes(request)
            LlmPurpose.PresentationFeedback -> DemoContent.FEEDBACK
            LlmPurpose.PresentationChat -> DemoContent.chat(request)
            LlmPurpose.PresentationCritique -> DemoContent.critique(request)
        }
        return LlmResponse(text, "end_turn", "demo")
    }
}
