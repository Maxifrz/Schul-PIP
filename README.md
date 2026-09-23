# Lernwerk

An iPad study app that teaches instead of answering. Import your own PDFs, annotate them with Apple Pencil, and mark any passage you are stuck on: a Socratic AI tutor answers with a guiding question first and only reveals more when you ask for it. Everything you needed help with becomes a spaced-repetition flashcard, and the AI turns your material into a day-by-day study plan up to your exam.

Built as a personal study tool for Abitur preparation and as a portfolio project.

## Features

| | |
|---|---|
| **PDF + Pencil** | PDFKit renders the material, a PencilKit canvas per page stores pen, highlighter and eraser strokes. |
| **Context help** | Drag a rectangle around a passage. The app sends the region as an image (including your handwriting), the text under it, the surrounding page, the matching study-plan topic and your weakest flashcards. |
| **Hint ladder** | Question → hint → full explanation. The student decides when to escalate; "Sag's mir einfach" is the escape hatch. |
| **Study plan** | The AI reads the PDFs, splits them into topics with prerequisites and page references; a local scheduler orders and spreads them until the exam date and can reschedule after missed days. |
| **Spaced repetition** | Every finished help session is turned into a flashcard and scheduled with SM-2. |
| **Demo mode** | Bundled sample material and canned answers, so the app can be tried without an API key. |

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
│   ├── Storage/    MaterialStore (PDFs + drawings), KeychainStore
│   └── Demo/       sample PDF and DemoLLMClient
└── Views/          Library, Document (PDF canvas, marking overlay), Tutor, Plan, Review, Settings
```

Design decisions:

- **No backend.** API keys live in the iOS Keychain and requests go straight to the provider. For a single-user tool this removes a server, accounts and hosting costs.
- **Three providers, one protocol.** `LLMClient` hides whether a request goes to NVIDIA NIM, OpenRouter or the Claude API. Help panel and study plan can use different providers, and every client declares its `LLMCapabilities` (images yes/no, how PDFs get in).
- **Raw HTTP instead of SDKs.** `ClaudeClient` speaks the Messages API, `OpenAICompatibleClient` the Chat Completions format that OpenRouter and NIM share. Request encoding and response parsing are unit-tested.
- **JSON from any model.** Claude gets an enforced schema (`output_config.format`). OpenRouter rejects schema requests for models that lack support, so the OpenAI-compatible path puts the schema into the system prompt, parses tolerantly (code fences, reasoning tags, numbers as strings) and retries once with the invalid answer in context.
- **The cheapest way into a PDF.** Claude reads PDFs natively. For the other providers the app extracts the text itself with PDFKit, labelled with page markers so topics keep exact page numbers. Scanned pages go to OpenRouter's OCR, or, on NIM, are sent as page images to vision models.
- **The model decides content, the app decides time.** The model extracts topics and prerequisites; ordering and scheduling are deterministic Swift code with tests.

## Building without a Mac

iOS apps need Xcode, which only runs on macOS. This repository builds entirely on GitHub Actions:

1. Every push runs `.github/workflows/ios.yml` on a macOS runner: XcodeGen generates the project from `project.yml`, the unit tests run on an iPhone simulator, and a Release build is packaged as an unsigned IPA.
2. Download the artifact `Lernwerk-unsigned-ipa` from the workflow run.
3. Install it with [Sideloadly](https://sideloadly.io) (Windows/macOS) or AltStore using a free Apple ID. Apps signed with a free Apple ID expire after 7 days and have to be re-signed; a paid Apple Developer account (99 €/year) removes that limit and enables TestFlight.

On a private repository, macOS runner minutes count ten times against the free Actions quota.

## AI providers

| | NVIDIA NIM | OpenRouter | Claude API |
|---|---|---|---|
| Default for | Help panel and flashcards | Study plan | – |
| Cost | Free developer account | 24 free models; paid models need credits | Pay per use |
| Limits | about 40 requests/minute | free models: 20/minute, 50/day, 1,000/day after a one-time 10 $ top-up | account tier |
| Images | vision models (Kimi K3, Gemma 4, GLM 5.3 Flash) | vision models | yes |
| PDFs | text extracted by the app, scanned pages as images (max. 12) | text extracted by the app, scanned PDFs via OCR (needs credits) | native |

Any model ID from the provider's catalogue can be entered in the settings; the suggestions are only a starting point, because free models come and go. If a model cannot read images, switch off "Bilder mitschicken". A Claude Pro subscription does not include API access; with OpenRouter credits, Claude models are available there as well.

Free tiers may log prompts. That is fine for school material, less so for private notes.

## Using it

1. **Einstellungen**: create a key at [build.nvidia.com](https://build.nvidia.com) and/or [openrouter.ai](https://openrouter.ai), paste it in, or enable the demo mode.
2. **Bibliothek**: import PDFs (or load the demo material) and open one.
3. Use the toolbar at the bottom: read, pen, highlighter, eraser, and the wand for help.
4. **Lernplan**: pick materials, exam date and daily study time.
5. **Wiederholen**: review the cards created from your help sessions.

## Tests

```
xcodegen generate
xcodebuild test -project Lernwerk.xcodeproj -scheme Lernwerk -destination 'platform=iOS Simulator,name=iPhone 16'
```

Covered: SM-2 scheduling, prerequisite ordering and day packing, request encoding and response parsing for both API formats (refusals, truncation, rate limits, missing credits, reasoning tags), tolerant JSON extraction with retry, local PDF extraction and scanned-page detection, image compression for NIM, prompt construction, demo content.

## Known limitations

- In pen mode a finger draws instead of scrolling; switch back to reading mode to scroll.
- No iCloud sync; data stays on the device.
- Math is rendered as Unicode text, not LaTeX.
- Study-plan generation is capped at about 22 MB of PDF or 400,000 characters of extracted text per request.
- The quality of the Socratic tutor depends on the model; small free models give the answer away more often.

## Roadmap

- Show the tutor's sketch suggestions as an editable drawing next to the marked region
- Voice answers with on-device speech recognition
- Study statistics: streaks and topics that keep coming back
