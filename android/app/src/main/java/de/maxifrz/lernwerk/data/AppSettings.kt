package de.maxifrz.lernwerk.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import de.maxifrz.lernwerk.holidays.Bundesland
import de.maxifrz.lernwerk.llm.ClaudeClient
import de.maxifrz.lernwerk.llm.CustomEndpoint
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

    /** For Ferien and Feiertage; null until the student picks one, so the app never guesses wrong. */
    var bundesland by mutableStateOf(prefs.getString(KEY_BUNDESLAND, null)?.let { Bundesland.fromCode(it) })
        private set

    var providersWithKey by mutableStateOf(LlmProvider.entries.filter { keys.load(account(it)) != null }.toSet())
        private set

    /** The address of the custom API as typed; [CustomEndpoint.check] turns it into the endpoint. */
    var customUrl by mutableStateOf(prefs.getString(KEY_CUSTOM_URL, "") ?: "")
        private set

    /** The custom API's chat completions address, null while none (or no valid one) is entered. */
    val customEndpoint: String? get() = (CustomEndpoint.check(customUrl) as? CustomEndpoint.Check.Valid)?.url

    val hasAnyKey get() = providersWithKey.isNotEmpty() || customEndpoint != null

    /** For the custom API an address is all it takes; its key is optional. */
    fun hasKey(provider: LlmProvider) = if (provider == LlmProvider.CUSTOM) customEndpoint != null else provider in providersWithKey

    fun updateCustomUrl(url: String) {
        customUrl = url.trim()
        prefs.edit().putString(KEY_CUSTOM_URL, customUrl).apply()
        // An address means the student wants real answers.
        if (customEndpoint != null) updateDemoMode(false)
    }

    /** Forgets the custom API: its address and its key. */
    fun removeCustomApi() {
        updateCustomUrl("")
        deleteKey(LlmProvider.CUSTOM)
    }

    fun selection(task: LlmTask) = if (task == LlmTask.TUTOR) tutor else plan

    fun setSelection(task: LlmTask, selection: ModelSelection) {
        if (task == LlmTask.TUTOR) tutor = selection else plan = selection
        prefs.edit().putString(if (task == LlmTask.TUTOR) KEY_TUTOR else KEY_PLAN, Json.encodeToString(ModelSelection.serializer(), selection)).apply()
    }

    fun updateDemoMode(enabled: Boolean) {
        demoMode = enabled
        prefs.edit().putBoolean(KEY_DEMO, enabled).apply()
    }

    fun updateBundesland(state: Bundesland?) {
        bundesland = state
        prefs.edit().putString(KEY_BUNDESLAND, state?.code).apply()
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
        if (chosen.provider == LlmProvider.CUSTOM) {
            val endpoint = customEndpoint ?: return FailingClient(LlmError.MissingEndpoint)
            return OpenAiCompatibleClient(
                provider = LlmProvider.CUSTOM,
                apiKey = keys.load(account(LlmProvider.CUSTOM)).orEmpty(),
                model = model,
                sendsImages = chosen.sendsImages,
                transport = transport,
                compressImage = ImageCompressor::jpeg,
                endpoint = endpoint,
            )
        }
        val key = keys.load(account(chosen.provider))
            ?: return FailingClient(LlmError.MissingApiKey(chosen.provider.displayName))
        return when (chosen.provider) {
            LlmProvider.ANTHROPIC -> ClaudeClient(key, model, transport)
            LlmProvider.CUSTOM -> FailingClient(LlmError.MissingEndpoint)
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
        const val KEY_BUNDESLAND = "bundesland"
        const val KEY_CUSTOM_URL = "llm.customUrl"
    }
}
