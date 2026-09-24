# Lernwerk

An iPad and Android-tablet study app that teaches instead of answering. Import your own PDFs, annotate them with Apple Pencil, and mark any passage you are stuck on: a Socratic AI tutor answers with a guiding question first and only reveals more when you ask for it. Everything you needed help with becomes a spaced-repetition flashcard, and the AI turns your material into a day-by-day study plan up to your exam.

Built as a personal study tool for Abitur preparation and as a portfolio project.

## Features

| | |
|---|---|
| **PDF + Pencil** | PDFKit renders the material, a PencilKit canvas per page stores pen, highlighter and eraser strokes. |
| **Context help** | Drag a rectangle around a passage. The app runs on-device OCR (Apple Vision) on it, which also reads your handwriting, and sends the recognized text, the region as an image, the text layer under it, the surrounding page, the matching study-plan topic and your weakest flashcards. |
| **Hint ladder** | Question → hint → full explanation. The student decides when to escalate; "Sag's mir einfach" is the escape hatch. |
| **Study plan** | The AI reads the PDFs, splits them into topics with prerequisites and page references; a local scheduler orders and spreads them until the exam date and can reschedule after missed days. |
| **Spaced repetition** | Every finished help session is turned into a flashcard and scheduled with SM-2. |
| **Demo mode** | Bundled sample material and canned answers, so the app can be tried without an API key. |
| **Share to Lernwerk** | PDFs and images shared from Files or other apps (on Android also from the gallery) land in the library and open right away; photos become one-page PDFs. |

## Design

The interface follows **Quill**, a small design system: warm neutrals, a single sage accent, Work Sans for text and the Silkscreen pixel font for labels, in light and dark. The tabs sit in a capsule at the top, the library shows documents as covers like the Files and Books apps, and **Pip**, a pixel cat, walks along the tutor's input bar — it thinks while the model is answering and can be poked or picked up. Tokens and shared components live in `Lernwerk/Theme/`; the fonts are bundled under the SIL Open Font License.

## Why these teaching methods

The design follows techniques with strong evidence in learning research, not "learning styles":

- **Retrieval practice and spacing**: flashcards from your own sticking points, reviewed on an SM-2 schedule.
- **Socratic questioning**: the tutor asks before it explains. Pure questioning frustrates when a fact is simply missing, so the ladder always lets the student escalate.
- **Dual coding**: the tutor is prompted to pair explanations with a small sketch the student can draw in the margin.
- **Elaboration**: when the student answers, the tutor says whether it is right and why, then goes one step deeper.

## Architecture

```
Lernwerk/
├── App/            entry point, tab navigation, settings (model, demo mode, API key)
├── Models/         SwiftData: StudyMaterial, StudyPlan, PlanTopic, ReviewCard
├── Services/
│   ├── LLM/        LLMClient protocol, providers, ClaudeClient, OpenAICompatibleClient, StructuredOutput
│   ├── Tutor/      HintLevel, TutorPrompt, TutorSession, Flashcard
│   ├── Plan/       PlanGenerator (PDF → topics), PlanScheduler (topological order + day packing)
│   ├── Review/     SpacedRepetition (SM-2)
│   ├── Storage/    MaterialStore (PDFs + drawings), KeychainStore, TextRecognizer (Apple Vision OCR)
│   └── Demo/       sample PDF and DemoLLMClient
├── Theme/          Quill tokens (colors, fonts) and shared components
├── Resources/      bundled fonts (Work Sans, Silkscreen) with their licenses
└── Views/          Library, Document (PDF canvas, marking overlay), Tutor with Pip, Plan, Review, Settings

android/app/src/main/java/de/maxifrz/lernwerk/
├── llm/            the same clients, providers and StructuredOutput in Kotlin, behind an HttpTransport
├── tutor/          HintLevel, TutorPrompt, TutorSession, demo content
├── plan/           PlanGenerator, PlanScheduler
├── review/         SpacedRepetition (SM-2)
├── data/           JSON repository, Keystore-encrypted API keys, OkHttp transport, settings
├── pdf/            PdfRenderer pages, PdfBox text layer, ML Kit OCR, demo PDF
└── ui/             Jetpack Compose screens in the Quill design, Pip
```

The Android app is a native port, not a shared codebase: the logic is translated one to one and covered by the same test cases on the JVM, the interface is rebuilt in Jetpack Compose.

Design decisions:

- **No backend.** API keys live in the iOS Keychain and requests go straight to the provider. For a single-user tool this removes a server, accounts and hosting costs.
- **Three providers, one protocol.** `LLMClient` hides whether a request goes to NVIDIA NIM, OpenRouter or the Claude API. Help panel and study plan can use different providers, and every client declares its `LLMCapabilities` (images yes/no, how PDFs get in).
- **Raw HTTP instead of SDKs.** `ClaudeClient` speaks the Messages API, `OpenAICompatibleClient` the Chat Completions format that OpenRouter and NIM share. Request encoding and response parsing are unit-tested.
- **JSON from any model.** Claude gets an enforced schema (`output_config.format`). OpenRouter rejects schema requests for models that lack support, so the OpenAI-compatible path puts the schema into the system prompt, parses tolerantly (code fences, reasoning tags, numbers as strings) and retries once with the invalid answer in context.
- **The cheapest way into a PDF.** Claude reads PDFs natively. For the other providers the app extracts the text itself with PDFKit, labelled with page markers so topics keep exact page numbers. Scanned pages are read on the device with Apple Vision first; only pages that stay unreadable go to OpenRouter's OCR or, on NIM, are sent as page images to vision models.
- **On-device OCR before the cloud.** Apple Vision is free, offline and reads handwriting, so text-only models can help with handwritten notes too. OCR mangles formulas, so vision models still get the image and are told to trust it over the recognized text.
- **The model decides content, the app decides time.** The model extracts topics and prerequisites; ordering and scheduling are deterministic Swift code with tests.

## Building without a Mac

iOS apps need Xcode, which only runs on macOS. This repository builds entirely on GitHub Actions:

1. Every push runs `.github/workflows/ios.yml` on a macOS runner: XcodeGen generates the project from `project.yml`, the unit tests run on an iPhone simulator, and a Release build is packaged as an unsigned IPA.
2. Download the artifact `Lernwerk-unsigned-ipa` from the workflow run.
3. Install it with [Sideloadly](https://sideloadly.io) (Windows/macOS) or AltStore using a free Apple ID. Apps signed with a free Apple ID expire after 7 days and have to be re-signed; a paid Apple Developer account (99 €/year) removes that limit and enables TestFlight.

On a private repository, macOS runner minutes count ten times against the free Actions quota.

## AI providers

| | NVIDIA NIM | OpenRouter | Google Gemini | Claude API |
|---|---|---|---|---|
| Default for | Help panel and flashcards | Study plan | – | – |
| Cost | Free developer account | 24 free models; paid models need credits | Free tier in Google AI Studio | Pay per use |
| Limits | about 40 requests/minute | free models: 20/minute, 50/day, 1,000/day after a one-time 10 $ top-up | per model, shown in AI Studio | account tier |
| Images | vision models (Kimi K3, Gemma 4, GLM 5.3 Flash) | vision models | all suggested models | yes |
| PDFs | text layer and on-device OCR; unreadable scanned pages as images (max. 12) | text layer and on-device OCR; unreadable scans via OpenRouter OCR (needs credits) | like NIM | native |

Gemini is reached through Google's OpenAI-compatible endpoint, so it shares the client with NIM and OpenRouter. Gemini 3 models always think a little; the help panel asks for `reasoning_effort: low`.

Any model ID from the provider's catalogue can be entered in the settings; the suggestions are only a starting point, because free models come and go. If a model cannot read images, switch off "Bilder mitschicken". A Claude Pro subscription does not include API access; with OpenRouter credits, Claude models are available there as well.

Free tiers may log prompts. That is fine for school material, less so for private notes.

## Using it

1. **Einstellungen**: create a key at [build.nvidia.com](https://build.nvidia.com), [openrouter.ai](https://openrouter.ai) and/or [aistudio.google.com](https://aistudio.google.com/apikey), paste it in, or enable the demo mode.
2. **Bibliothek**: import PDFs or photos (or load the demo material) and open one. Sharing a PDF or image to Lernwerk from another app works too.
3. Use the toolbar at the bottom: Lesen, Stift, Marker, Radierer, and Hilfe to mark a passage.
4. **Lernplan**: pick materials, exam date and daily study time.
5. **Wiederholen**: review the cards created from your help sessions.

## Android

The Android version targets tablets (Android 10 or newer) and builds on GitHub Actions with `.github/workflows/android.yml`:

1. Every push that touches `android/` runs the unit tests and screenshot tests and builds a release APK.
2. Download the artifact `Lernwerk-android-apk` from the workflow run, copy it to the tablet and open it; Android asks once to allow installs from that app.
3. Updates install over the previous version and keep the library: all builds are signed with the same key (`android/app/lernwerk-debug.keystore`, a public debug key meant only for sideloading, not for a store release).

The artifact `Lernwerk-android-screenshots` contains the main screens rendered on the JVM with Robolectric and Roborazzi, in light and dark.

On Android, Lernwerk shows up under "Teilen" and "Öffnen mit" for PDFs and images from any files app or the gallery. On iOS it appears in the share sheet of Files and other apps; the Photos app only offers apps with a share extension, so the library has an "Aus Fotos" button instead.

```
cd android
./gradlew testDebugUnitTest assembleRelease
```

## Tests

```
xcodegen generate
xcodebuild test -project Lernwerk.xcodeproj -scheme Lernwerk -destination 'platform=iOS Simulator,name=iPhone 16'
```

Android: `./gradlew testDebugUnitTest` runs the same logic tests on the JVM plus the screenshot tests.

Covered: SM-2 scheduling, prerequisite ordering and day packing, request encoding and response parsing for both API formats (refusals, truncation, rate limits, missing credits, reasoning tags), tolerant JSON extraction with retry, local PDF extraction and scanned-page detection, on-device OCR (real Vision run plus the fallback order), image compression for NIM, prompt construction, demo content.

## Known limitations

- In pen mode a finger draws instead of scrolling; switch back to reading mode to scroll.
- Android: no pinch-to-zoom on pages yet, and ML Kit reads handwriting far worse than Apple Vision; a vision model makes up for it.
- No iCloud sync; data stays on the device.
- Math is rendered as Unicode text, not LaTeX, and on-device OCR often misreads formulas.
- Study-plan generation is capped at about 22 MB of PDF or 400,000 characters of extracted text per request.
- The quality of the Socratic tutor depends on the model; small free models give the answer away more often.

## Roadmap

- Show the tutor's sketch suggestions as an editable drawing next to the marked region
- Voice answers with on-device speech recognition
- Study statistics: streaks and topics that keep coming back
