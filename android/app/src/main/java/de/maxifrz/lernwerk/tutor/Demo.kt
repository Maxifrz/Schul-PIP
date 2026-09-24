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
import kotlinx.serialization.json.jsonObject
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
        {"layout":"STATEMENT","title":"Wie leitet man (3x² + 1)⁵ ab, ohne auszumultiplizieren?","subtitle":"Genau dafür gibt es die Kettenregel.","notes":"Ausmultiplizieren wäre hier eine Qual. Am Ende des Vortrags könnt ihr diese Aufgabe in einer Zeile lösen.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"CARDS","title":"Verkettete Funktionen haben zwei Teile","items":[{"title":"Innere Funktion","text":"v(x) = 3x² + 1 wird zuerst berechnet","icon":"🎯"},{"title":"Äußere Funktion","text":"u(v) = v⁵ verarbeitet das Ergebnis","icon":"📦"},{"title":"Verkettung","text":"f(x) = u(v(x))","icon":"🔗"}],"notes":"Erst wird innen gerechnet, dann wird das Ergebnis außen weiterverarbeitet. Diese Aufteilung ist der Schlüssel.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"QUOTE","title":"Merksatz","quote":"Äußere Ableitung mal innere Ableitung.","attribution":"Demo: Kettenregel, S. 1","notes":"Diesen Satz solltet ihr euch merken – er ist die ganze Regel in einem Satz.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"PROCESS","title":"In drei Schritten zur Ableitung","items":[{"title":"Zerlegen","text":"Innere und äußere Funktion benennen"},{"title":"Ableiten","text":"u'(v) = 5v⁴ und v'(x) = 6x"},{"title":"Multiplizieren","text":"f'(x) = 5(3x² + 1)⁴ · 6x"}],"notes":"So geht ihr bei jeder Aufgabe vor: zerlegen, beide Teile ableiten, multiplizieren.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"TWO_COLUMNS","title":"Die innere Ableitung wird oft vergessen","leftTitle":"Richtig","left":["5(3x² + 1)⁴ · 6x","= 30x(3x² + 1)⁴"],"rightTitle":"Typischer Fehler","right":["Nur 5(3x² + 1)⁴","Innere Ableitung fehlt"],"notes":"Der häufigste Fehler ist, die innere Ableitung zu vergessen. Links seht ihr die richtige Lösung.","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"CHART","title":"Die innere Funktion wächst schnell","chart":{"kind":"LINE","labels":["x = 0","x = 1","x = 2","x = 3"],"values":[1,4,13,28],"unit":""},"subtitle":"Werte von v(x) = 3x² + 1 aus dem Beispiel","notes":"Weil die innere Funktion schnell wächst, wird auch ihre Steigung wichtig – deshalb multiplizieren wir mit v'(x).","sourceMaterial":0,"sourcePages":[1]},
        {"layout":"TABLE","title":"Die Regel gilt für viele Funktionstypen","table":[["Funktion","Innen","Außen"],["sin(2x)","2x","sin v"],["e^(3x)","3x","eᵛ"],["√(x² + 1)","x² + 1","√v"]],"notes":"Auf Seite 2 findet ihr Übungen mit Sinus-, e- und Wurzelfunktionen. Das Vorgehen ist immer gleich.","sourceMaterial":0,"sourcePages":[2]},
        {"layout":"BULLETS","title":"Fazit: erkennen, ableiten, multiplizieren","bullets":["Verkettung erkennen","Außen ableiten, innen stehen lassen","Mit innerer Ableitung multiplizieren"],"notes":"Und damit ist auch unsere Frage vom Anfang beantwortet: 30x(3x² + 1)⁴.","sourceMaterial":0,"sourcePages":[1,2]},
        {"layout":"BULLETS","title":"Quellen","bullets":["Demo: Kettenregel, S. 1–2"],"notes":"Alle Inhalte stammen aus dem Demo-Material.","sourceMaterial":0,"sourcePages":[1,2]}
        ]}
    """.trimIndent()

    val outlineJson = """
        {"title":"Die Kettenregel","thesis":"Verkettete Funktionen leitet man ab, indem man äußere und innere Ableitung multipliziert.","slides":[{"role":"title","message":"Die Kettenregel","layout":"TITLE","content":"Name · Mathematik","sourceMaterial":0,"sourcePages":[1]},{"role":"hook","message":"Wie leitet man (3x² + 1)⁵ ab, ohne auszumultiplizieren?","layout":"STATEMENT","content":"Genau dafür gibt es die Kettenregel.","sourceMaterial":0,"sourcePages":[1]},{"role":"context","message":"Verkettete Funktionen haben zwei Teile","layout":"CARDS","content":"Erst wird innen gerechnet, dann wird das Ergebnis außen weit","sourceMaterial":0,"sourcePages":[1]},{"role":"core","message":"Merksatz","layout":"QUOTE","content":"Diesen Satz solltet ihr euch merken – er ist die ganze Regel","sourceMaterial":0,"sourcePages":[1]},{"role":"core","message":"In drei Schritten zur Ableitung","layout":"PROCESS","content":"So geht ihr bei jeder Aufgabe vor: zerlegen, beide Teile abl","sourceMaterial":0,"sourcePages":[1]},{"role":"example","message":"Die innere Ableitung wird oft vergessen","layout":"TWO_COLUMNS","content":"Der häufigste Fehler ist, die innere Ableitung zu vergessen.","sourceMaterial":0,"sourcePages":[1]},{"role":"data","message":"Die innere Funktion wächst schnell","layout":"CHART","content":"Werte von v(x) = 3x² + 1 aus dem Beispiel","sourceMaterial":0,"sourcePages":[1]},{"role":"transfer","message":"Die Regel gilt für viele Funktionstypen","layout":"TABLE","content":"Auf Seite 2 findet ihr Übungen mit Sinus-, e- und Wurzelfunk","sourceMaterial":0,"sourcePages":[2]},{"role":"summary","message":"Fazit: erkennen, ableiten, multiplizieren","layout":"BULLETS","content":"Und damit ist auch unsere Frage vom Anfang beantwortet: 30x(","sourceMaterial":0,"sourcePages":[1,2]},{"role":"sources","message":"Quellen","layout":"BULLETS","content":"Alle Inhalte stammen aus dem Demo-Material.","sourceMaterial":0,"sourcePages":[1,2]}]}
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

    /** Exercises or flashcards for a topic, whichever the request's schema asks for. */
    fun studyAid(request: LlmRequest): String =
        if (request.jsonSchema?.get("properties")?.jsonObject?.containsKey("exercises") == true) EXERCISES else CARDS

    private val EXERCISES = """
        {"exercises":[
        {"question":"Nenne innere und äußere Funktion von f(x) = (3x + 1)⁵.","hint":"Was wird zuerst berechnet, wenn du eine Zahl einsetzt?","solution":"Innere Funktion: g(x) = 3x + 1. Äußere Funktion: h(u) = u⁵."},
        {"question":"Leite f(x) = (3x + 1)⁵ ab.","hint":"Äußere Ableitung mal innere Ableitung.","solution":"f′(x) = 5 · (3x + 1)⁴ · 3 = 15 · (3x + 1)⁴"},
        {"question":"Leite f(x) = sin(x²) ab.","hint":"Die innere Funktion ist x².","solution":"f′(x) = cos(x²) · 2x"},
        {"question":"Leite f(x) = e^(sin x) ab und erkläre, warum die Kettenregel hier zweimal gedacht werden muss.","hint":"Die äußere Funktion ist die e-Funktion, die innere sin x.","solution":"f′(x) = e^(sin x) · cos x. Die e-Funktion bleibt beim Ableiten gleich, dann kommt die innere Ableitung cos x dazu."}
        ]}
    """.trimIndent()

    private val CARDS = """
        {"cards":[
        {"front":"Wie lautet die Kettenregel?","back":"f(x) = h(g(x)) ⇒ f′(x) = h′(g(x)) · g′(x): äußere mal innere Ableitung."},
        {"front":"Was ist die innere Funktion von (2x − 7)³?","back":"g(x) = 2x − 7"},
        {"front":"Ableitung von e^(3x)?","back":"3 · e^(3x)"},
        {"front":"Ableitung von √(x² + 1)?","back":"x / √(x² + 1)"},
        {"front":"Woran erkennst du eine Verkettung?","back":"Eine Funktion wird auf das Ergebnis einer anderen angewendet, z. B. sin(x²)."},
        {"front":"Ableitung von sin(4x)?","back":"4 · cos(4x)"}
        ]}
    """.trimIndent()

    val planJson = """
        {"topics":[
        {"title":"Verkettete Funktionen erkennen","summary":"Du kannst bei einer Funktion innere und äußere Funktion benennen.","prerequisites":[],"materialIndex":0,"sourcePages":[1],"estimatedMinutes":20,"videoQuery":"Verkettete Funktionen innere äußere Funktion erklärt"},
        {"title":"Kettenregel anwenden","summary":"Du leitest verkettete Funktionen mit äußerer mal innerer Ableitung ab.","prerequisites":["Verkettete Funktionen erkennen"],"materialIndex":0,"sourcePages":[1],"estimatedMinutes":30,"videoQuery":"Kettenregel Ableitung einfach erklärt"},
        {"title":"Übungsaufgaben zur Kettenregel","summary":"Du löst gemischte Aufgaben mit Potenz-, Sinus-, e- und Wurzelfunktionen.","prerequisites":["Kettenregel anwenden"],"materialIndex":0,"sourcePages":[2],"estimatedMinutes":45,"videoQuery":"Kettenregel Übungsaufgaben mit Lösungen"}
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
            LlmPurpose.PresentationOutline -> DemoContent.outlineJson
            LlmPurpose.Presentation -> DemoContent.deckJson
            LlmPurpose.SlideRewrite -> DemoContent.slideEdit(request)
            LlmPurpose.SpeakerNotes -> DemoContent.speakerNotes(request)
            LlmPurpose.PresentationFeedback -> DemoContent.FEEDBACK
            LlmPurpose.PresentationChat -> DemoContent.chat(request)
            LlmPurpose.PresentationCritique -> DemoContent.critique(request)
            LlmPurpose.StudyAid -> DemoContent.studyAid(request)
        }
        return LlmResponse(text, "end_turn", "demo")
    }
}
