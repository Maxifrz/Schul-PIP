# Lernwerk

An iPad study app that teaches instead of answering. Import your own PDFs, annotate them with Apple Pencil, and mark any passage you are stuck on: a Socratic AI tutor answers with a guiding question first and only reveals more when you ask for it. Everything you needed help with becomes a spaced-repetition flashcard, and the AI turns your material into a day-by-day study plan up to your exam.

Built as a personal study tool for Abitur preparation and as a portfolio project.

## Features

| | |
|---|---|
| **PDF + Pencil** | PDFKit renders the material, a PencilKit canvas per page stores pen, highlighter and eraser strokes. |
| **Context help** | Drag a rectangle around a passage. The app sends the region as an image (including your handwriting), the text under it, the surrounding page, the matching study-plan topic and your weakest flashcards. |
| **Hint ladder** | Question → hint → full explanation. The student decides when to escalate; "Sag's mir einfach" is the escape hatch. |
| **Study plan** | Claude reads the PDFs, splits them into topics with prerequisites and page references; a local scheduler orders and spreads them until the exam date and can reschedule after missed days. |
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
│   ├── LLM/        LLMClient protocol, ClaudeClient (Messages API over URLSession)
│   ├── Tutor/      HintLevel, TutorPrompt, TutorSession, Flashcard
│   ├── Plan/       PlanGenerator (PDF → topics), PlanScheduler (topological order + day packing)
│   ├── Review/     SpacedRepetition (SM-2)
│   ├── Storage/    MaterialStore (PDFs + drawings), KeychainStore
│   └── Demo/       sample PDF and DemoLLMClient
└── Views/          Library, Document (PDF canvas, marking overlay), Tutor, Plan, Review, Settings
```

Design decisions:

- **No backend.** The API key lives in the iOS Keychain and requests go straight to the Claude API. For a single-user tool this removes a server, accounts and hosting costs.
- **Raw HTTP instead of an SDK.** There is no official Swift SDK for Claude. `ClaudeClient` is small, and its request encoding and response parsing are unit-tested.
- **Structured outputs** (`output_config.format` with a JSON schema) for the study plan and flashcards, so the app never parses free text.
- **The model decides content, the app decides time.** Claude extracts topics and prerequisites; ordering and scheduling are deterministic Swift code with tests.
- **`LLMClient` protocol.** The tutor, planner and flashcard generator run unchanged against the real API, the demo client or a test double.

## Building without a Mac

iOS apps need Xcode, which only runs on macOS. This repository builds entirely on GitHub Actions:

1. Every push runs `.github/workflows/ios.yml` on a macOS runner: XcodeGen generates the project from `project.yml`, the unit tests run on an iPhone simulator, and a Release build is packaged as an unsigned IPA.
2. Download the artifact `Lernwerk-unsigned-ipa` from the workflow run.
3. Install it with [Sideloadly](https://sideloadly.io) (Windows/macOS) or AltStore using a free Apple ID. Apps signed with a free Apple ID expire after 7 days and have to be re-signed; a paid Apple Developer account (99 €/year) removes that limit and enables TestFlight.

On a private repository, macOS runner minutes count ten times against the free Actions quota.

## Using it

1. **Einstellungen**: paste an Anthropic API key or enable the demo mode. The default model is Claude Opus 5; Sonnet 5 and Haiku 4.5 are cheaper alternatives.
2. **Bibliothek**: import PDFs (or load the demo material) and open one.
3. Use the toolbar at the bottom: read, pen, highlighter, eraser, and the wand for help.
4. **Lernplan**: pick materials, exam date and daily study time.
5. **Wiederholen**: review the cards created from your help sessions.

## Tests

```
xcodegen generate
xcodebuild test -project Lernwerk.xcodeproj -scheme Lernwerk -destination 'platform=iOS Simulator,name=iPhone 16'
```

Covered: SM-2 scheduling, prerequisite ordering and day packing, API request encoding and response parsing (refusals, truncation, API errors), prompt construction, plan decoding, demo content.

## Known limitations

- In pen mode a finger draws instead of scrolling; switch back to reading mode to scroll.
- No iCloud sync; data stays on the device.
- Math is rendered as Unicode text, not LaTeX.
- Study-plan generation sends whole PDFs, capped at about 22 MB per request.

## Roadmap

- Show the tutor's sketch suggestions as an editable drawing next to the marked region
- Voice answers with on-device speech recognition
- Study statistics: streaks and topics that keep coming back
