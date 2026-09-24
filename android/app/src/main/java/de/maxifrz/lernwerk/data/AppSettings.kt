package de.maxifrz.lernwerk.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import de.maxifrz.lernwerk.llm.ClaudeClient
import de.maxifrz.lernwerk.llm.FailingClient
import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmError
import de.maxifrz.lernwerk.llm.LlmProvider
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.llm.ModelSelection
import de.maxifrz.lernwerk.llm.OpenAiCompatibleClient
import de.maxifrz.lernwerk.research.WikipediaClient
import de.maxifrz.lernwerk.tutor.DemoLlmClient
import kotlinx.serialization.json.Json

class AppSettings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    private val keys = ApiKeyStore(context)
    private val transport = OkHttpTransport()

    /** Wikipedia for research in presentations and the study plan; free and without a key. */
    val wikipedia = WikipediaClient(transport)

    /** Model for the help panel and the flashcards created from it. */
    var tutor by mutableStateOf(load(KEY_TUTOR) ?: ModelSelection.default(LlmTask.TUTOR, LlmProvider.NVIDIA))
        private set

    /** Model that reads the material and builds the study plan. */
    var plan by mutableStateOf(load(KEY_PLAN) ?: ModelSelection.default(LlmTask.PLAN, LlmProvider.OPEN_ROUTER))
        private set

    var demoMode by mutableStateOf(prefs.getBoolean(KEY_DEMO, false))
        private set

    var providersWithKey by mutableStateOf(LlmProvider.entries.filter { keys.load(account(it)) != null }.toSet())
        private set

    val hasAnyKey get() = providersWithKey.isNotEmpty()

    fun hasKey(provider: LlmProvider) = provider in providersWithKey

    fun selection(task: LlmTask) = if (task == LlmTask.TUTOR) tutor else plan

    fun setSelection(task: LlmTask, selection: ModelSelection) {
        if (task == LlmTask.TUTOR) tutor = selection else plan = selection
        prefs.edit().putString(if (task == LlmTask.TUTOR) KEY_TUTOR else KEY_PLAN, Json.encodeToString(ModelSelection.serializer(), selection)).apply()
    }

    fun updateDemoMode(enabled: Boolean) {
        demoMode = enabled
        prefs.edit().putBoolean(KEY_DEMO, enabled).apply()
    }

    fun saveKey(key: String, provider: LlmProvider): Boolean {
        val trimmed = key.trim()
        if (trimmed.isEmpty() || !keys.save(account(provider), trimmed)) return false
        providersWithKey = providersWithKey + provider
        // Saving a key means the student wants real answers; a demo mode left on from the sample material would hide them.
        updateDemoMode(false)
        return true
    }

    fun deleteKey(provider: LlmProvider) {
        keys.delete(account(provider))
        providersWithKey = providersWithKey - provider
    }

    fun modelLabel(task: LlmTask): String {
        if (demoMode) return "Demo"
        val chosen = selection(task)
        return chosen.provider.option(chosen.model)?.name ?: chosen.model
    }

    fun makeClient(task: LlmTask): LlmClient {
        if (demoMode) return DemoLlmClient()
        val chosen = selection(task)
        val model = chosen.model.trim()
        if (model.isEmpty()) return FailingClient(LlmError.MissingModel)
        val key = keys.load(account(chosen.provider))
            ?: return FailingClient(LlmError.MissingApiKey(chosen.provider.displayName))
        return when (chosen.provider) {
            LlmProvider.ANTHROPIC -> ClaudeClient(key, model, transport)
            LlmProvider.NVIDIA, LlmProvider.OPEN_ROUTER, LlmProvider.GOOGLE -> OpenAiCompatibleClient(
                provider = chosen.provider,
                apiKey = key,
                model = model,
                sendsImages = chosen.sendsImages,
                transport = transport,
                fallbackModels = listOfNotNull(chosen.provider.fallbackModelIds.firstOrNull { it != model }),
                compressImage = ImageCompressor::jpeg,
            )
        }
    }

    private fun account(provider: LlmProvider) = "llm.${provider.name.lowercase()}"

    private fun load(key: String): ModelSelection? =
        prefs.getString(key, null)?.let { runCatching { Json.decodeFromString(ModelSelection.serializer(), it) }.getOrNull() }

    private companion object {
        const val KEY_TUTOR = "llm.tutor"
        const val KEY_PLAN = "llm.plan"
        const val KEY_DEMO = "demoMode"
    }
}
