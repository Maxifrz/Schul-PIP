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
        }
        return LlmResponse(text, "end_turn", "demo")
    }
}
