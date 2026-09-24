package de.maxifrz.lernwerk.llm

import de.maxifrz.lernwerk.plan.PlanGenerator
import de.maxifrz.lernwerk.tutor.HintLevel
import kotlinx.serialization.json.JsonObject

enum class LlmRole(val wire: String) { USER("user"), ASSISTANT("assistant") }

sealed interface LlmContent {
    data class Text(val text: String) : LlmContent
    class Image(val jpeg: ByteArray) : LlmContent
    class Pdf(val data: ByteArray) : LlmContent
}

data class LlmMessage(val role: LlmRole, val content: List<LlmContent>)

sealed interface LlmPurpose {
    data class Tutor(val level: HintLevel) : LlmPurpose
    data object Flashcard : LlmPurpose
    data object StudyPlan : LlmPurpose
    data object PresentationOutline : LlmPurpose
    data object Presentation : LlmPurpose
    data object SlideRewrite : LlmPurpose
    data object SpeakerNotes : LlmPurpose
    data object PresentationFeedback : LlmPurpose
    data object PresentationChat : LlmPurpose
    data object PresentationCritique : LlmPurpose

    /** Free tiers queue requests; a student waiting in the help panel needs an answer or an error, not silence. */
    val timeoutSeconds: Long
        get() = when (this) {
            is Tutor -> 75
            Flashcard -> 90
            StudyPlan, PresentationOutline, Presentation -> 600
            SlideRewrite -> 90
            SpeakerNotes -> 180
            PresentationFeedback, PresentationChat -> 120
            PresentationCritique -> 600
        }

    /** Reading whole materials and critical review benefit from reasoning; the rest is answered while the student waits. */
    val needsDepth: Boolean get() = this == StudyPlan || this == PresentationOutline || this == Presentation || this == PresentationCritique
}

enum class LlmEffort(val wire: String) { LOW("low"), MEDIUM("medium"), HIGH("high") }

data class LlmRequest(
    val purpose: LlmPurpose,
    val system: String,
    val messages: List<LlmMessage>,
    val maxTokens: Int,
    val effort: LlmEffort? = null,
    val jsonSchema: JsonObject? = null,
)

data class LlmResponse(val text: String, val stopReason: String?, val model: String?)

/** How a provider can take in a PDF. */
enum class DocumentHandling {
    /** The model reads the PDF itself (Claude). */
    NATIVE_PDF,

    /** The provider converts scanned PDFs with OCR (OpenRouter's file parser). */
    PROVIDER_OCR,

    /** Only text and images; the app has to extract the PDF itself (NVIDIA NIM). */
    TEXT_ONLY,
}

data class LlmCapabilities(val acceptsImages: Boolean, val documentHandling: DocumentHandling)

interface LlmClient {
    val capabilities: LlmCapabilities
    suspend fun complete(request: LlmRequest): LlmResponse
}

sealed class LlmError(message: String) : Exception(message) {
    data class MissingApiKey(val provider: String) :
        LlmError("Für $provider ist noch kein API-Key hinterlegt. Trag ihn in den Einstellungen ein, wähl dort einen anderen Anbieter oder aktiviere den Demo-Modus.")

    data object MissingModel : LlmError("Es ist kein Modell eingetragen. Wähl in den Einstellungen ein Modell aus.")

    data object InvalidApiKey : LlmError("Der API-Key wurde abgelehnt. Prüf ihn in den Einstellungen.")

    data class RateLimited(val detail: String) :
        LlmError("Limit des Anbieters erreicht – warte kurz oder versuch es morgen wieder. ($detail)")

    data class PaymentRequired(val detail: String) :
        LlmError("Der Anbieter verlangt Guthaben für diese Anfrage. ($detail)")

    data class Http(val status: Int, val detail: String) :
        LlmError("Die KI-Anfrage ist fehlgeschlagen ($status): $detail")

    data class Overloaded(val status: Int) :
        LlmError("Der Server des Anbieters war überlastet ($status), auch ein Ausweich-Modell hat nicht geantwortet. Versuch es in ein paar Minuten nochmal oder wähl in den Einstellungen ein anderes Modell.")

    data class Timeout(val seconds: Long) :
        LlmError("Keine Antwort nach $seconds Sekunden. Das kostenlose Modell ist vermutlich gerade überlastet. Versuch es nochmal oder wähl in den Einstellungen ein anderes Modell.")

    data class Network(val detail: String) :
        LlmError("Keine Verbindung zum Anbieter. Prüf das Internet und versuch es nochmal. ($detail)")

    data object Refusal :
        LlmError("Das Modell hat die Anfrage abgelehnt. Formuliere sie anders oder markiere einen anderen Bereich.")

    data object Truncated :
        LlmError("Die Antwort war zu lang und wurde abgeschnitten. Versuch es mit weniger Material.")

    data object InvalidResponse :
        LlmError("Die Antwort der KI konnte nicht gelesen werden. Versuch es noch einmal oder wähl ein anderes Modell.")

    data object RequestTooLarge :
        LlmError("Das Material ist zu umfangreich für eine Anfrage. Wähl weniger Dateien aus.")

    data class UnreadablePdf(val title: String) : LlmError("„$title“ lässt sich nicht als PDF öffnen.")

    data class ScannedPdf(val title: String, val pages: Int) :
        LlmError("„$title“ hat $pages eingescannte Seiten, die auch die Texterkennung auf dem Gerät nicht lesen konnte. Mit diesem Modell kann die App höchstens ${PlanGenerator.MAX_SCANNED_PAGE_IMAGES} solcher Seiten als Bild schicken. Stell den Lernplan in den Einstellungen auf OpenRouter oder die Claude API um.")

    /** Errors caused by the hosted model rather than the request; another model may still answer. */
    val isModelUnavailable: Boolean
        get() = this is Timeout || this is Overloaded || (this is Http && status == 404)
}

/** Stands in for a client that cannot be built, so the error surfaces where the request is made. */
class FailingClient(private val error: LlmError) : LlmClient {
    override val capabilities = LlmCapabilities(acceptsImages = true, documentHandling = DocumentHandling.NATIVE_PDF)
    override suspend fun complete(request: LlmRequest): LlmResponse = throw error
}

/** One HTTP request, so the clients can be tested without a network. */
interface HttpTransport {
    suspend fun post(url: String, headers: Map<String, String>, body: String, timeoutSeconds: Long): HttpResult

    /** A GET for public APIs such as Wikipedia. */
    suspend fun get(url: String, headers: Map<String, String>, timeoutSeconds: Long): HttpResult =
        throw LlmError.Network("GET is not supported by this transport")
}

data class HttpResult(val status: Int, val body: String)
