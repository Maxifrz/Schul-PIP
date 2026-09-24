# Plan: on-device language model

Status: planned, not started. Written September 2026 for a later implementation once suitable hardware is available. Versions, device lists and APIs below move fast; re-check every item marked **verify** before starting.

## Goal

Let the help panel (tutor + flashcards) answer without a network connection, rate limits or a provider account, on both iOS and Android. The cloud providers stay; the local model is one more provider.

Non-goals:

- Study-plan generation stays in the cloud. A 30-page PDF does not fit a ~4K-token context, and small models split material into topics poorly.
- No bundled model inside the app binary. Models come from the OS or are downloaded on demand.

## Why not now

- The current iPad (10th generation, A14, 4 GB RAM) supports neither Apple Intelligence nor a useful third-party model.
- The Samsung tablet belongs to a friend; its chip and RAM are unknown.
- Local 3–4B models are clearly weaker than Gemini Flash or Kimi at math, and worse at following the hint ladder. Cloud stays the default.

## Hardware requirements

| | Minimum | Recommended |
|---|---|---|
| iPad (Apple Intelligence) | M1 iPad Air/Pro, or iPad mini with A17 Pro; iPadOS 26 (**verify** current list) | M2 or newer |
| iPad (own model via MLX) | 8 GB RAM (M1 or newer) | M2+, 16 GB |
| Android (Gemini Nano via AICore) | a device on Google's AICore list, locked bootloader (**verify** list) | current Pixel or Galaxy flagship |
| Android (own model via LiteRT-LM) | 8 GB RAM, Snapdragon 8 Gen 2 / Dimensity 9200 class | 12 GB RAM, Snapdragon 8 Elite class |
| Free storage | 3 GB for a downloaded model | 5 GB |

Below 6 GB RAM or on mid-range chips a local model is too slow (under ~5 tokens/s) to be useful.

## Engines

Two tiers per platform: the OS model when the device has one (free, no download, maintained by the vendor), otherwise a downloaded open model.

| | Tier 1: OS model | Tier 2: downloaded model |
|---|---|---|
| iOS | Apple **Foundation Models** framework (`SystemLanguageModel`), ~3B model, guided generation with `@Generable` | **MLX Swift** with a Gemma model (e.g. Gemma 3n E4B, 4-bit), only on M-series iPads |
| Android | **ML Kit GenAI Prompt API** (`com.google.mlkit:genai-prompt`, beta), Gemini Nano through AICore, text + image input, input under 4000 tokens | **LiteRT-LM** (successor of the MediaPipe LLM Inference API) with Gemma 3n E2B/E4B |

Tier 1 first: it covers the target devices with the least code. Tier 2 only if the device you end up with lacks tier 1.

## Architecture

The provider layer already fits: every engine becomes one more `LLMClient` / `LlmClient`.

1. **Provider**
   - Add `LLMProvider.onDevice` / `LlmProvider.ON_DEVICE`, named "Auf dem Gerät".
   - No API key, no endpoint, no fallback models.
   - Capabilities: `acceptsImages` per engine (Gemini Nano yes; Foundation Models **verify**), `documentHandling = .textOnly`.
2. **Clients**
   - iOS: `FoundationModelsClient` wraps a `LanguageModelSession`, and `MLXClient` covers tier 2.
   - Android: `GeminiNanoClient` wraps the Prompt API, and `LiteRtClient` covers tier 2.
   - Each client maps `LLMRequest` to the engine and throws the existing `LLMError` cases, plus a new `modelUnavailable(reason)` with a German message: "Dieses Gerät unterstützt kein lokales Modell" or "Modell wird noch geladen (42 %)".
3. **Context budget**, the main code change. On-device models have about 4K tokens, while cloud requests today can carry about 10K.
   - Add `contextTokens` to `LLMCapabilities`.
   - `TutorPrompt.contextBlock` clips `page_text` to what fits the budget, estimating about 4 characters per token for German.
   - A compact system prompt variant of about 250 tokens instead of about 600 keeps the ladder rules but drops the elaboration.
   - History trimming keeps the first user message (context block) plus the last 4 turns, and drops the oldest turns first.
4. **Structured output**
   - Flashcards on iOS use guided generation (`@Generable struct Flashcard`), which returns a typed value with no JSON parsing.
   - Android and MLX use the existing `StructuredOutput` path (schema in prompt, tolerant parse, one retry).
5. **Selection mode.** A new setting "Lokales Modell verwenden" with three choices:
   - **Nie** (default).
   - **Automatisch**: use the cloud, and switch to local when offline or when the cloud request fails with timeout, overload or rate limit. Implemented as an `LLMClient` wrapper with the same idea as the existing model fallback.
   - **Immer**.
6. **Model management** (tier 2 only)
   - Download on first use over Wi-Fi, with progress shown in settings. A "Modell löschen" option frees the space.
   - Storage: iOS Application Support, Android `filesDir/models`.
   - Checksums are verified after download.

## UI changes

- Settings get the provider pill "Gerät". It shows the availability state (available / downloading x % / not supported with reason) and the selection mode.
- The tutor panel header labels local answers "Lokal · <Modellname>", so the student knows why an answer might be weaker.
- Pip has a small "offline" variant while the local model answers (optional, fun).

## Phases and estimates

| Phase | Content | Estimate |
|---|---|---|
| 1 | Context budget, compact prompt, history trimming (useful for small cloud models too) + tests | 1 session |
| 2 | Tier 1 iOS: `FoundationModelsClient`, availability check, `@Generable` flashcards | 1 session |
| 3 | Tier 1 Android: `GeminiNanoClient`, `checkStatus()`/`download()` flow | 1 session |
| 4 | "Automatisch" fallback wrapper + settings UI on both platforms | 1 session |
| 5 | Evaluation on the real device (see below), tune the compact prompt | 1–2 sessions, needs the device |
| 6 | Tier 2 (MLX / LiteRT-LM), only if tier 1 is missing on the device | 2 sessions |

Phases 1–4 can be built and unit-tested without the target device; phase 5 cannot.

## Evaluation

A fixed set of about 20 marked regions from real material (math, physics, German, English), each run through all three ladder levels on the local model and on Gemini Flash for comparison. Criteria per answer:

1. Level 1 does not reveal the solution.
2. Math is correct.
3. The answer is in German, uses "du" and is short.
4. Time to first token and total time.
5. Flashcard JSON valid on the first try.

The local model becomes selectable as **Immer** only if it passes criteria 1 and 3 in at least 90 % of cases; otherwise it is offered only as the offline fallback.

## Risks

- Apple's and Google's on-device APIs are young. Signatures, device lists and limits change between OS versions (**verify** at start).
- Gemini Nano is unavailable on devices with an unlocked bootloader and on unsupported models, so the fallback has to handle "unavailable" gracefully.
- Small models give away answers more often. The ladder may need stricter prompting or a post-check at level 1 that rejects replies containing the final result.
- Thermal throttling on tablets during long sessions. Measure in phase 5.
- Tier 2 downloads of 2–4 GB are unsuitable over mobile data; download over Wi-Fi only.
