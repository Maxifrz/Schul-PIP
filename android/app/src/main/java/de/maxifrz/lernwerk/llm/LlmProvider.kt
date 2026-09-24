package de.maxifrz.lernwerk.llm

import kotlinx.serialization.Serializable

enum class LlmTask { TUTOR, PLAN }

data class ModelOption(val id: String, val name: String, val note: String, val vision: Boolean)

@Serializable
enum class LlmProvider(
    val displayName: String,
    val keyPlaceholder: String,
    val keyPortal: String,
    /** Endpoint for OpenAI-compatible providers; Claude uses its own Messages API. */
    val chatCompletionsUrl: String?,
    /** NVIDIA's hosted endpoints reject large inline images, so they get recompressed below this size. */
    val maxImageBytes: Int?,
) {
    NVIDIA("NVIDIA NIM", "nvapi-…", "https://build.nvidia.com", "https://integrate.api.nvidia.com/v1/chat/completions", 180_000),
    OPEN_ROUTER("OpenRouter", "sk-or-…", "https://openrouter.ai", "https://openrouter.ai/api/v1/chat/completions", null),
    GOOGLE("Gemini", "AIza…", "https://aistudio.google.com/apikey", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", null),
    ANTHROPIC("Claude API", "sk-ant-…", "https://console.anthropic.com", null, null);

    val models: List<ModelOption>
        get() = when (this) {
            NVIDIA -> listOf(
                ModelOption("moonshotai/kimi-k3", "Kimi K3", "Stark, versteht Bilder", true),
                ModelOption("google/gemma-4-31b-it", "Gemma 4 31B", "Schnell, versteht Bilder", true),
                ModelOption("z-ai/glm-5.3-flash", "GLM 5.3 Flash", "Schnell, versteht Bilder", true),
                ModelOption("nvidia/nemotron-3-super-120b-a12b", "Nemotron 3 Super", "Nur Text", false),
            )
            OPEN_ROUTER -> listOf(
                ModelOption("google/gemma-4-31b-it:free", "Gemma 4 31B", "Gratis, versteht Bilder", true),
                ModelOption("qwen/qwen3.8-27b:free", "Qwen 3.8 27B", "Gratis, versteht Bilder", true),
                ModelOption("nvidia/nemotron-3-super-120b-a12b:free", "Nemotron 3 Super", "Gratis, nur Text, großer Kontext", false),
                ModelOption("openrouter/free", "Automatisch", "Gratis, wechselndes Modell", true),
                ModelOption("anthropic/claude-sonnet-5", "Claude Sonnet 5", "Kostenpflichtig, braucht Guthaben", true),
            )
            GOOGLE -> listOf(
                ModelOption("gemini-3.8-flash", "Gemini 3.8 Flash", "Stark, versteht Bilder, Gratis-Kontingent", true),
                ModelOption("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite", "Am schnellsten, versteht Bilder", true),
                ModelOption("gemini-3.1-pro-preview", "Gemini 3.1 Pro", "Beste Qualität, Vorschau, oft kostenpflichtig", true),
            )
            ANTHROPIC -> listOf(
                ModelOption("claude-opus-5", "Claude Opus 5", "Beste Erklärungen", true),
                ModelOption("claude-sonnet-5", "Claude Sonnet 5", "Schneller, günstiger", true),
                ModelOption("claude-haiku-4-5", "Claude Haiku 4.5", "Am günstigsten", true),
            )
        }

    /** Fast, widely available models to fall back on when the chosen one is overloaded. */
    val fallbackModelIds: List<String>
        get() = when (this) {
            NVIDIA -> listOf("google/gemma-4-31b-it", "z-ai/glm-5.3-flash")
            OPEN_ROUTER -> listOf("google/gemma-4-31b-it:free", "openrouter/free")
            GOOGLE -> listOf("gemini-3.5-flash-lite", "gemini-3.8-flash")
            ANTHROPIC -> emptyList()
        }

    fun defaultModel(task: LlmTask): ModelOption = when {
        this == OPEN_ROUTER && task == LlmTask.PLAN -> models[2]
        this == NVIDIA && task == LlmTask.TUTOR -> models[1]
        else -> models[0]
    }

    fun option(modelId: String): ModelOption? = models.firstOrNull { it.id == modelId }
}

@Serializable
data class ModelSelection(val provider: LlmProvider, val model: String, val sendsImages: Boolean) {
    companion object {
        fun default(task: LlmTask, provider: LlmProvider): ModelSelection {
            val option = provider.defaultModel(task)
            return ModelSelection(provider, option.id, option.vision)
        }
    }
}
