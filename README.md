# Schul-PIP

Named after Pip, the pixel cat that lives in the app. The code, bundle ids and build artifacts still use the working title *Lernwerk*, so updates install over earlier builds and keep their data.

An iPad and Android-tablet study app that teaches instead of answering. Import your own PDFs, annotate them with Apple Pencil, and mark any passage you are stuck on: a Socratic AI tutor answers with a guiding question first and only reveals more when you ask for it. Everything you needed help with becomes a spaced-repetition flashcard, and the AI turns your material into a day-by-day study plan up to your exam.

Built as a personal study tool for Abitur preparation and as a portfolio project.

## Features

| | |
|---|---|
| **Library** | Folders that nest like in a files app, search over titles, subjects, folder names and the text of every PDF (a text match opens on its page), sorting by last opened, name, date or subject, subject colors, favorites, a row to continue reading, renaming, moving (on iOS also by dragging onto a folder), selecting several documents at once, and a trash that keeps deleted documents for 30 days. |
| **Notes (iOS)** | A GoodNotes-style toolbar on every PDF: page overview with bookmarks, search in the PDF and in typed notes, share with or without notes, rename, undo/redo, bookmarks, inserting and deleting pages, and a read-only mode. Tools: zoom window for small handwriting, four pen types, pixel or stroke eraser, highlighter, shapes that snap to clean lines, rectangles, polygons and ellipses, lasso, stickers, pictures (from Photos or Files), typed text and text boxes with styles, alignment and colors, and a laser pointer. Notebooks start with blank, lined, squared or dotted paper; PDFs and pictures can be inserted as new pages anywhere in a document. On Android, pages get pen, highlighter and eraser strokes, and PDFs and pictures insert as new pages too. |
| **Geometry** | Ruler, set square (Geodreieck) with millimetre and degree scales, protractor and compass lie on the page. One finger moves them, two fingers turn them, snapping to whole degrees and to multiples of 45°; the angle is always shown. The pen drawn along an edge makes a straight line beside it with its length and angle, from the protractor's centre a ray at whole degrees, and around the compass an arc or circle; the compass opens in millimetre steps and shows its radius in cm. Scales are true to the printed page, and "Echtgröße" zooms so a centimetre of the page is a centimetre on the screen. On iOS and Android. |
| **Calculator (CAS)** | A "Rechner" tab with a full computer algebra system (Giac, the engine behind Xcas) on the device, offline: exact results with the rounded value next to them, German commands (`löse`, `ableiten`, `integriere`, `grenzwert`, `faktorisiere`, `vereinfache`, `ausmultiplizieren`, `nullstellen`, `tangente`), matrices (`det`, `inverse`, `transponiere`), statistics (`mittelwert`, `median`, `varianz`, `standardabweichung`), degrees or radians, variables and functions that carry across lines (`a = 5`, `f(x) = x^2`), `ans`, a history, and a keyboard with the school symbols. Results are written the school way: `L = {2; 3}`, `2√2`, `3x²`, decimal comma. The graph view draws up to three functions and marks zeros, extreme points (H, T), intersections and where they cross the y axis; a graph goes into any document as a new page. |
| **Context help** | Drag a rectangle around a passage. The app runs on-device OCR (Apple Vision) on it, which also reads your handwriting, and sends the recognized text, the region as an image, the text layer under it, the surrounding page, the matching study-plan topic and your weakest flashcards. |
| **Hint ladder** | Question → hint → full explanation. The student decides when to escalate; "Sag's mir einfach" is the escape hatch. |
| **Study plan** | The AI reads the PDFs, splits them into topics with prerequisites and page references; a local scheduler orders and spreads them until the exam date and can reschedule after missed days. Every topic has study aids: a YouTube search for explainer videos, the Wikipedia introduction, four practice exercises with hints and worked solutions, and flashcards for the review deck. Plans export as an iCalendar file and remind daily at a chosen time with what is open. |
| **Presentations** | The AI turns selected materials into a school presentation in three steps: it plans the red thread (one message per slide), writes the slides for that plan, and lets the critic fix the important weaknesses before the student sees the deck. With Wikipedia research switched on, the outline names what is missing, the app reads the matching German Wikipedia articles, and every slide that uses them cites the article; a talk can also be built from a topic alone, without material. Besides title, bullets, picture and quote slides it uses statements, big numbers, timelines, process steps, cards with icons, bar and line charts from numbers in the material, tables and full-size pictures, with speaker notes and sources with page numbers; a free canvas editor like Keynote (move, resize, rotate, snap guides, undo) with four designs, pictures from photos or material pages, per-slide AI (shorter, simpler, more detail, redesign) and Socratic feedback on the whole talk. Present full screen with notes, timer and laser pointer, or export as PowerPoint (.pptx, fully editable) or PDF. |
| **Presentation assistant** | A chat that carries out instructions on the open deck ("Mach Folie 3 kürzer", "Füge nach Folie 2 ein Beispiel ein", "Stell auf Kreide um"); every instruction is one undo step. A sceptical critic reviews the talk like a strict teacher, optionally against the source material, and lists findings with severity and concrete changes that are applied only after approval, one by one or all at once. |
| **Import** | Existing PowerPoint files (.pptx) become editable slides: text boxes and placeholders, shapes, lines and arrows, pictures, groups, tables as text, backgrounds and speaker notes. PDFs (e.g. exported from Keynote or Google Slides) become one picture slide per page, with the page text kept for the AI. After an import the critic opens right away. Word documents (.docx) join the library as a PDF: headings, paragraphs, bold and italic, bullet and numbered lists, tables and pictures, paginated to fit. |
| **Spaced repetition** | Every finished help session is turned into a flashcard and scheduled with SM-2. |
| **Demo mode** | Bundled sample material and canned answers, so the app can be tried without an API key. |
| **Share to Schul-PIP** | PDFs and images shared from Files or other apps (on Android also from the gallery) land in the library and open right away; photos become one-page PDFs. |

## Design

The app icon is Pip, generated from the same pixel grid the app draws (`scripts/make-icons.py`): light and dark on iOS, adaptive and themed on Android.

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
│   ├── Plan/       PlanGenerator (PDF → topics), PlanScheduler (topological order + day packing),
│   │               StudyAids (exercises, flashcards, videos, iCalendar, reminder texts), PlanNotifications
│   ├── Research/   Wikipedia client and research for presentations
│   ├── Notes/      note model (texts, pictures, stickers, bookmarks), shape recognition, paper, PDF export,
│   │               Instruments (ruler, set square, protractor, compass: edges, snapping, angles, arcs)
│   ├── Present/    slide model and geometry, layouts, PresentationAssistant, chat and critic (PresentationEdits),
│   │               PptxWriter (own ZIP + CRC32), PptxReader and DocxReader (own ZIP + DEFLATE reader, small XML
│   │               tree), DocxRenderer (headings, lists, tables, pictures onto PDF pages)
│   ├── Review/     SpacedRepetition (SM-2)
│   ├── Calculator/ CASEngine (Giac in a hidden WKWebView), answers, history, input with cursor, number formats
│   ├── Library/    sorting, search, folder tree and trash rules; the PDF text index for the search
│   ├── Storage/    MaterialStore (PDFs + drawings), KeychainStore, TextRecognizer (Apple Vision OCR)
│   └── Demo/       sample PDF and DemoLLMClient
├── Theme/          Quill tokens (colors, fonts) and shared components
├── Resources/      bundled fonts (Work Sans, Silkscreen) with their licenses
└── Views/          Library, Document (notes toolbar and canvas, page overview, search), Tutor with Pip, Plan, Presentation,
                    Calculator (keyboard, history, graphs), Review, Settings

cas/
├── web/            giacwasm.js (Giac 1.9 as WebAssembly), cas.js (German commands, school notation, plot analysis),
│                   cas.html (loads both in the app's hidden web view); shared by the iOS and the Android app
└── test/           cas.js against the real Giac, in Node

android/app/src/main/java/de/maxifrz/lernwerk/
├── llm/            the same clients, providers and StructuredOutput in Kotlin, behind an HttpTransport
├── tutor/          HintLevel, TutorPrompt, TutorSession, demo content
├── plan/           PlanGenerator, PlanScheduler, StudyAids (exercises, flashcards, iCalendar, reminder texts)
├── research/       Wikipedia client and research for presentations
├── notify/         daily study plan reminder (AlarmManager, notifications)
├── ink/            Instruments, the same geometry as on iOS
├── calc/           CasEngine (Giac in a hidden WebView), the same answers, history and number formats as on iOS
├── review/         SpacedRepetition (SM-2)
├── present/        the same slide model, AI assistant, chat and critic, PptxWriter and PptxReader, DocxReader
│                   (shared OfficeXml ZIP + XML helpers), import, SlidePainter for editor, presenting and PDF
├── data/           JSON repository with folders and trash, library logic, Keystore-encrypted API keys, OkHttp transport, settings
├── pdf/            PdfRenderer pages, PdfBox text layer and page insertion, ML Kit OCR, demo PDF, DocxRenderer
│                   (StaticLayout onto PDF pages)
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
- **Slides as free elements, layouts only as a starting point.** The AI answers with small layout descriptions (title, statement, bullets, picture, two columns, cards, process, timeline, big number, chart, table, quote); the app turns them into freely placed elements, so AI output stays robust and every slide stays editable. Slides are 960 × 540 pt, exactly PowerPoint's widescreen size, so the export needs no conversion.
- **The model decides content, the app decides design.** Small models are poor at geometry and at keeping many rules at once, so the prompt only teaches what makes a good talk (a hook, one message per slide stated as the title, show instead of list) and asks for the slide type; grid, typography, text sizes fitted to their boxes, charts drawn from shapes and fallbacks for missing content are deterministic code, identical on both platforms. Planning the outline first and writing the slides second gives even free models a red thread.
- **PowerPoint written by hand.** `PptxWriter` produces Office Open XML directly: native text boxes, shapes, lines and pictures with rotation, bullets and notes pages. The Swift and Kotlin writers produce byte-identical XML; the output is checked with python-pptx and a LibreOffice render.
- **Edits as data, applied by the app.** Chat and critic do not return a new deck; they return a short list of changes (update texts, replace, insert, move or delete a slide, notes, design, title) that address slides and text boxes by id. The app applies them, skips any whose slide no longer exists instead of guessing, and records one undo step. The model sees the current state with ids before every answer, earlier chat turns only as short summaries.
- **PowerPoint read by hand, too.** `PptxReader` resolves placeholders through layout and master, theme colors with luminance modifiers, groups, flips and rotation, then fits any slide size into 960 × 540. iOS has no public ZIP API, so the Swift version brings its own ZIP reader and DEFLATE decoder (Apple's Compression framework when available); both readers are tested against the same python-pptx and LibreOffice files.
- **The model decides content, the app decides time.** The model extracts topics and prerequisites; ordering and scheduling are deterministic Swift code with tests.
- **Research with sources, not from memory.** Wikipedia's API needs no key and works with every provider, including NIM. The model only asks for search terms; the app fetches the articles and passes excerpts with ids, the model may only use facts that are in them and names the ids, and the app writes the citations (title, link, access date) on the sources slide itself, so they cannot be invented.
- **Notes next to the ink, not in it.** Texts, pictures and stickers are stored per page in canvas coordinates beside the PencilKit drawing, share one undo history with it, and are drawn into the PDF only on export. Inserting or deleting a page moves ink, notes and bookmarks of all later pages along.
- **Instruments in page units.** An instrument's pose lives in the page's own coordinates (on iOS the canvas, on Android PDF points), with centimetres taken from the PDF page size, so it zooms and scrolls with the page and its scale matches the printed sheet. Edges, snapping, degrees and arcs are plain geometry (`Instruments`), identical in Swift and Kotlin and tested the same way; lines and arcs become ordinary strokes, so undo, the eraser and the export treat them like handwriting. The screen's pixel density for "Echtgröße" comes from Android's display metrics; iOS does not report it, so the app uses 264 ppi for iPads and 326 for the iPad mini.
- **Giac as WebAssembly, not as a native library.** Building Giac natively means cross-compiling GMP and about a hundred thousand lines of C++ for two iOS and two Android architectures, in CI, on every change. Its authors publish the same engine compiled to WebAssembly (the one Xcas for Firefox runs); the apps load it in an invisible web view, offline, from their own bundle. One file (`cas/web/cas.js`) turns German input into Giac and Giac's answer into school notation, analyses graphs, and runs unchanged on both platforms and in Node, where it is tested against the real engine. The cost: about 19 MB more per app and roughly a second until the engine is ready the first time. The native side only passes JSON back and forth.
- **Reminders without a server.** Android sets one alarm per plan that renews itself and reads the plan when it fires. iOS runs no app code for a notification, so the app schedules the next two weeks ahead with the topics open on each day and replaces them whenever the plan changes or the app opens.
- **One Word reader, two renderers.** `DocxReader` (Swift and Kotlin) turns `word/document.xml` into free blocks — headings from the style's own outline level, not the (often English) style name; a paragraph's list numbering resolved from its own `numPr` or, failing that, its style's, so both the common ways Word represents a list are read the same way. Drawing them onto PDF pages is native on each platform: `NSAttributedString` on iOS, `StaticLayout` on Android, so both wrap German text correctly without a hand-written line breaker.
- **Splicing pages instead of rebuilding a document.** Inserting a PDF's or a picture's pages moves the pages already after that point rather than recreating the file: iOS asks PDFKit to insert copied `PDFPage`s, Android imports pages into the existing `PDDocument` with PDFBox and reorders them, and both shift the ink (and, on iOS, the notes) of every later page by the number of pages inserted.

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
2. **Bibliothek**: import PDFs, photos or Word documents (or load the demo material) and open one. Sharing a PDF, image or .docx to Schul-PIP from another app works too. Create folders, long-press a document to rename, move, give it a subject or mark it as a favorite, or tap "Auswählen" for several at once.
3. In a document, the top row has the page overview, search, sharing, undo, bookmarks, new pages and the read-only switch; the row below holds the tools and their colors and sizes. The ruler button (Android: "Geometrie") lays a ruler, set square, protractor or compass on the page in view and switches to true scale. Inserting a page (iOS: in the page menu, Android: "+ Seite" in the header) adds another PDF's or a picture's pages anywhere in the document, from Fotos or Dateien. "Pip fragen" marks a passage for the tutor. "Neu" → "Notizbuch" in the library starts an empty notebook.
4. **Rechner**: type on the keyboard or tap the keyboard symbol for the system keyboard. The green chips insert commands with their brackets; a tap on a result uses it again, a long press offers the input or copying. "Graph" draws up to three functions, "In Dokument einfügen" adds the graph as a page to a document of your choice.
5. **Lernplan**: pick materials, exam date and daily study time. "Lernhilfen" under a topic opens videos, Wikipedia, exercises and flashcards; above the topics you can switch on the daily reminder and share the plan as a calendar file.
6. **Präsentation**: pick materials (optional with Wikipedia research), topic, slide count and talk length, or import a .pptx or PDF; edit the slides, open "Assistent" to give the chat instructions or let the critic review the talk, present or export.
7. **Wiederholen**: review the cards created from your help sessions.

## Android

The Android version targets tablets (Android 10 or newer) and builds on GitHub Actions with `.github/workflows/android.yml`:

1. Every push that touches `android/` runs the unit tests and screenshot tests and builds a release APK.
2. Download the artifact `Lernwerk-android-apk` from the workflow run, copy it to the tablet and open it; Android asks once to allow installs from that app.
3. Updates install over the previous version and keep the library: all builds are signed with the same key (`android/app/lernwerk-debug.keystore`, a public debug key meant only for sideloading, not for a store release).

The artifact `Lernwerk-android-screenshots` contains the main screens rendered on the JVM with Robolectric and Roborazzi, in light and dark.

On Android, Schul-PIP shows up under "Teilen" and "Öffnen mit" for PDFs and images from any files app or the gallery. On iOS it appears in the share sheet of Files and other apps; the Photos app only offers apps with a share extension, so the library has an "Aus Fotos" button instead.

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

Calculator core: `node cas/test/cas.test.js` runs `cas.js` against the bundled Giac build (German commands, school notation, solution sets, calculus, matrices, statistics, degrees, errors, variables across lines, zeros, extreme points, touching zeros, intersections and poles in the plotter); the CAS workflow runs it on every change.

Without a Mac, the Foundation-only Swift code (LLM types, presentation model, AI assistant, chat and critic, PPTX writer and reader with the ZIP/DEFLATE code, editor model) was additionally compiled and exercised with the Swift toolchain on Linux before pushing.

Covered: SM-2 scheduling, prerequisite ordering and day packing, request encoding and response parsing for both API formats (refusals, truncation, rate limits, missing credits, reasoning tags), tolerant JSON extraction with retry, local PDF extraction and scanned-page detection, on-device OCR (real Vision run plus the fallback order), image compression for NIM, prompt construction, the three-step deck generation and every slide type (fitting, charts, fallbacks, identical layouts on both platforms), library sorting, search, folders and trash, applying chat and critic changes, Wikipedia search and research with citations, exercises and flashcards per topic, iCalendar export (escaping, line folding), reminder texts and schedules, note pages (inserting and deleting pages, shape recognition), PPTX import against python-pptx and LibreOffice files and a round trip through the own writer, .docx reading (headings from styles, bold and italic, bullet and numbered lists, tables, pictures) against real python-docx files, demo content, the instruments' geometry (edges and snapping, degrees, protractor rays, compass radius and arcs, turning with two fingers, true scale). On Android, inserting PDF and picture pages was also checked against real PDFs built with PDFBox, splicing the pages in the right place and moving the ink of later pages along.

## Known limitations

- On iOS a finger draws in the pen tools unless "Nur mit Apple Pencil zeichnen" is on in the system settings; then a finger scrolls, and along an instrument only the pencil draws. On Android a finger always draws in pen mode.
- The GoodNotes-style notes tools (typed text, pictures and stickers placed and moved on a page) are iOS only; Android has pen, highlighter, eraser, and inserting PDF or picture pages.
- The calculator's engine starts in about a second the first time and then stays loaded; if the system reclaims its memory, the next calculation starts it again, with all variables and functions. Giac makes both apps about 19 MB larger. Input uses a decimal point (a comma separates arguments); results use the decimal comma.
- Instruments lie on one page at a time; choosing one again brings it to the page in view. On iOS, "Echtgröße" assumes 264 ppi (iPad mini 326, iPhone 326 or 460); on Android the display's own density is used, and wide true-to-scale pages scroll sideways in the read mode.
- .docx import keeps text, bold, italic, lists, tables and pictures, but not colors, fonts, headers, footers, footnotes or exact spacing; a paragraph's own list numbering resets per list.
- The Wikipedia research only reads the German Wikipedia, and the study plan's YouTube button opens a search, not a hand-picked video.
- iOS reminders are scheduled two weeks ahead; if the app is not opened for longer, they pause until the next start.
- Android: no pinch-to-zoom on pages yet, and ML Kit reads handwriting far worse than Apple Vision; a vision model makes up for it.
- No iCloud sync; data stays on the device.
- Exported PowerPoint files use the Work Sans font; on a computer without it, PowerPoint substitutes a similar font. The PDF export embeds it.
- Generated slides are sized to fit, but text typed in the editor does not shrink automatically; long texts can overflow until shortened (the "Kürzen" action helps).
- Charts are bar and line charts only; the model has to find the numbers in the material and may miss some.
- On Android, documents move through the menu or the selection, not by dragging.
- PowerPoint import leaves out charts, SmartArt, animations and vector pictures (EMF, SVG); text keeps the style of its first line only. Old .ppt files have to be saved as .pptx first. PDF slides stay pictures; the AI reads their text but can only change them by replacing the slide.
- Math is rendered as Unicode text, not LaTeX, and on-device OCR often misreads formulas.
- Study-plan generation is capped at about 22 MB of PDF or 400,000 characters of extracted text per request.
- The quality of the Socratic tutor depends on the model; small free models give the answer away more often.

## Roadmap

- Show the tutor's sketch suggestions as an editable drawing next to the marked region
- Voice answers with on-device speech recognition
- Study statistics: streaks and topics that keep coming back

## License

Schul-PIP is free software under the GNU General Public License, version 3 (see `LICENSE`), because it ships Giac, which is GPL 3 too. Giac is by Bernard Parisse and Renée De Graeve, Institut Fourier, Université Grenoble Alpes; `cas/README.md` names the exact build and where its source code is. The bundled fonts keep their own licenses (`Lernwerk/Resources`).
