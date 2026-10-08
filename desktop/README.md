# Schul-PIP for Windows

The desktop app: Electron around a React page. It shares the Supabase server of the Kurse tab and the calculator page with
the iPad, iPhone and Android apps, and it judges flashcard answers with the same algorithm (a port of `AnswerCheck`, `SM-2`,
the Tafelbild logic and the Pip game, with the same test cases as the Swift tests).

## What is in it

| Area | |
|---|---|
| **Heute** | Date, the cards due, Pip. **Right arrow** starts the dinosaur-style game with Pip (up or space jumps, down ducks, Esc leaves); a click on Pip does the same. |
| **Bibliothek** | PDFs on this PC: import (several at once), search, rename, delete, read with zoom, the last page is remembered. |
| **Karten** | Flashcards with a typed answer ("Richtig" / "Falsch", no AI), SM-2 scheduling, optional "repeat when wrong", "War doch richtig". |
| **Kurse** | Courses and work groups by join code, chat (files by drag and drop), files of a group, members and moderators, and the **Tafelbild**: proposals, accept / edit / reject, corrections, polls, versions, closing; from the closed result a PDF, flashcards, or an AI check. |
| **Rechner** | The same calculator page as the mobile apps (CAS, graphics, geometry, 3D, tables, statistics, chemistry), shown in its own view. |
| **Einstellungen** | AI provider and model (with a search over the provider's current model list), own API address, keys sealed with the Windows account. |

Shortcuts: Ctrl+1 to Ctrl+6 switch the area.

## What is not in it (yet)

The mobile apps lean on iOS and Android frameworks that have no counterpart here, so these are not ported: handwriting on
PDFs (PencilKit), the geometry tools on a page, on-device text recognition and with it the help panel on a marked region,
the study plan, presentations, the calendar (timetable, exams, holidays), notebooks, folders in the library, and importing
Word or GoodNotes files. The library and the cards live on this PC only; there is no sync with the iPad.

## Build and run

```
cd desktop
npm ci
npm run dev          # the page in a browser at http://localhost:5173 (the Windows-only calls fall back to the browser)
npm start            # build and start the Electron app
npm test             # unit tests (answer check, SM-2, Tafelbild, Supabase client, model list, game)
npm run typecheck
node test/ui/smoke.mjs                    # every screen in headless Chromium against a fake server
xvfb-run -a node test/ui/electron.mjs     # the real Electron app (Linux; on Windows run it without xvfb-run)
npm run dist         # the Windows installer in release/ (build it on Windows)
```

CI (`.github/workflows/desktop.yml`) runs the tests on Linux and builds the installer on Windows; the installer is the
artifact `Schul-PIP-Windows` of the run. It is not code-signed, so Windows SmartScreen asks once ("More info", "Run anyway").

## How it is put together

- `electron/main.ts`: the window, the `schulpip://` protocol (serves the page and the calculator, so the calculator's WebAssembly
  and fetch work as on a web server), storage in the user data folder, secrets sealed with `safeStorage` (DPAPI), the
  network calls of the page (https only, http only for the local network), the PDF printer and the calculator view.
- `electron/preload.ts`: the only bridge from the page to the main process; every call is checked on the other side.
- `src/lib/`: the logic, plain TypeScript, tested without a screen.
- `src/store/`, `src/views/`: state and screens.

The page has a strict content security policy and no network access of its own: calls to Supabase and to AI providers go
through the main process, so no server has to allow the app's origin.
