package de.maxifrz.lernwerk.tutor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmEffort
import de.maxifrz.lernwerk.llm.LlmMessage
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.StructuredOutput
import kotlinx.coroutines.CancellationException

class TutorSession(
    initialContext: TutorContext,
    val regionImage: ByteArray?,
    private val client: LlmClient,
    val modelLabel: String = "KI",
    private val recognizeText: suspend (ByteArray) -> String = { "" },
    private val now: () -> Long = System::currentTimeMillis,
) {
    enum class Speaker { TUTOR, STUDENT }

    /** [level] is the ladder step the tutor answered on, shown above its reply. */
    data class Turn(val id: Long, val speaker: Speaker, val text: String, val level: HintLevel = HintLevel.QUESTION)

    val turns = mutableStateListOf<Turn>()
    var level by mutableStateOf(HintLevel.QUESTION)
        private set
    var isLoading by mutableStateOf(false)
        private set

    /** What the panel shows while waiting, so a slow free model is visibly working rather than frozen. */
    var waitingFor by mutableStateOf<String?>(null)
        private set
    var waitingSince by mutableStateOf<Long?>(null)
        private set
    var errorMessage by mutableStateOf<String?>(null)

    var context = initialContext
        private set

    private val history = mutableListOf<LlmMessage>()
    private var nextId = 0L

    val isDemo: Boolean get() = client is DemoLlmClient
    val hasHelped: Boolean get() = turns.any { it.speaker == Speaker.TUTOR }

    suspend fun start() {
        if (history.isNotEmpty() || isLoading) return
        val image = regionImage
        if (context.recognizedText.isEmpty() && image != null) {
            beginWaiting("Lese den markierten Bereich")
            context = context.copy(recognizedText = runCatching { recognizeText(image) }.getOrDefault(""))
            endWaiting()
        }
        send("Ich brauche Hilfe bei dem markierten Bereich.", showAsStudentTurn = false)
    }

    suspend fun answer(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        send(trimmed, showAsStudentTurn = true)
    }

    suspend fun requestMoreHelp() {
        val next = level.next ?: return
        level = next
        send("Ich komme nicht weiter. Bitte hilf mir etwas mehr.", showAsStudentTurn = true)
    }

    suspend fun revealExplanation() {
        if (level == HintLevel.EXPLANATION) return
        level = HintLevel.EXPLANATION
        send("Erklär es mir bitte direkt.", showAsStudentTurn = true)
    }

    suspend fun makeFlashcard(): Flashcard {
        val transcript = turns.joinToString("\n\n") {
            (if (it.speaker == Speaker.TUTOR) "Tutor: " else "Student: ") + it.text
        }
        val request = LlmRequest(
            purpose = LlmPurpose.Flashcard,
            system = TutorPrompt.flashcardSystem,
            messages = listOf(
                LlmMessage(LlmRole.USER, listOf(LlmContent.Text(TutorPrompt.flashcardRequest(context, transcript)))),
            ),
            maxTokens = 4000,
            effort = LlmEffort.LOW,
            jsonSchema = Flashcard.schema,
        )
        return StructuredOutput.complete(
            request,
            client,
            parse = { StructuredOutput.json.decodeFromString(Flashcard.serializer(), it) },
            isValid = { it.front.isNotEmpty() && it.back.isNotEmpty() },
        )
    }

    private suspend fun send(text: String, showAsStudentTurn: Boolean) {
        if (isLoading) return

        val content = mutableListOf<LlmContent>()
        if (history.isEmpty()) {
            val imageToSend = if (client.capabilities.acceptsImages) regionImage else null
            if (imageToSend != null) content += LlmContent.Image(imageToSend)
            content += LlmContent.Text(TutorPrompt.contextBlock(context, hasImage = imageToSend != null))
        }
        content += LlmContent.Text(TutorPrompt.studentTurn(text, level))
        history += LlmMessage(LlmRole.USER, content)
        if (showAsStudentTurn) turns += Turn(nextId++, Speaker.STUDENT, text)

        errorMessage = null
        beginWaiting("Warte auf $modelLabel")
        try {
            val response = client.complete(
                LlmRequest(
                    purpose = LlmPurpose.Tutor(level),
                    system = TutorPrompt.system,
                    messages = history.toList(),
                    maxTokens = 8000,
                    effort = LlmEffort.MEDIUM,
                ),
            )
            history += LlmMessage(LlmRole.ASSISTANT, listOf(LlmContent.Text(response.text)))
            turns += Turn(nextId++, Speaker.TUTOR, response.text, level)
        } catch (error: Exception) {
            history.removeAt(history.lastIndex)
            if (showAsStudentTurn) turns.removeAt(turns.lastIndex)
            if (error is CancellationException) throw error
            errorMessage = error.message ?: "Unbekannter Fehler"
        } finally {
            endWaiting()
        }
    }

    private fun beginWaiting(label: String) {
        isLoading = true
        waitingFor = label
        waitingSince = now()
    }

    private fun endWaiting() {
        isLoading = false
        waitingFor = null
        waitingSince = null
    }
}
