# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Oberstufe students preparing for the Abitur, mainly on iPad with Apple Pencil, also on iPhone. They study from their own PDFs, plan around Klausuren and school holidays, and need to get unstuck without being handed the answer. The developer is also a daily user (personal study tool and portfolio project).

## Product Purpose

An iPad and iPhone study app that teaches instead of answering. Students import PDFs, annotate them, and mark passages they are stuck on; a Socratic tutor answers with a guiding question first. Everything they needed help with becomes a spaced-repetition card. A study plan runs to the exam date, and the "Lernpfad" turns courses and the student's own material into short lessons. Success: the student can do it unaided later, not just finish lessons.

## Positioning

Four things a neighboring app would not truthfully copy together:

- A Socratic hint ladder (question, hint, explanation) whose help sessions become SM-2 flashcards.
- Your own material and a fully offline core: the Lernpfad, calculator (CAS), answer checks and review all work without any LLM; the LLM only enriches them, with a demo-mode answer for every call.
- Mastery tracked by skills with prerequisites, separate from finished lessons and XP.
- One school toolkit in a single app: library with notes, CAS and chemistry, timetable and exams, presentations, courses.

## Operating Context

School days and exam season: the app is opened between lessons, at home for homework, and on the iPad for long annotated reading. Material is the student's own PDFs and Word files. Timetable, Ferien and Feiertage are bundled offline for all 16 Bundesländer. Exam mode locks the calculator for supervised tests. An optional Supabase backend powers Kurse (chat, shared files, Tafelbild); everything else lives on the device.

## Capabilities and Constraints

- UI language is German, informal "du". Code, comments and docs are English.
- SwiftUI + SwiftData, iOS 17+, iPad and iPhone (horizontalSizeClass .compact), light and dark. XcodeGen project; never edit an .xcodeproj.
- Logic lives in plain Foundation structs/enums with injected date, calendar and seeded RNG; views stay thin.
- Fixed: SwiftData schema, SM-2 (SpacedRepetition.swift) and AnswerCheck.swift.
- LLM calls go through LLMClient and StructuredOutput.complete and need a demo-mode answer; features must work fully offline.
- Terms: Lernpfad (feature), Pip (mascot, a pixel cat), Fähigkeiten (skills), Heute, Bibliothek, Lernplan, Kalender, Rechner, Kurse.
- Android (android/), desktop (desktop/) and supabase/ exist as separate codebases and are out of scope for iOS design work.

## Brand Commitments

Pip the pixel cat is the identity; the app icon is generated from the same pixel grid the app draws. The design system is "Quill" (Lernwerk/Theme/): warm neutrals, one sage accent, Hanken Grotesk, IBM Plex Mono, pixel faces Jersey 10 and Silkscreen. Use Quill tokens and components only (no hard-coded colors, no emojis). Never use the name or assets of Duolingo. Working title "Lernwerk" remains in code and bundle ids.

## Evidence on Hand

README.md (feature inventory), docs/learn/ (language engine, skills model), Lernwerk/Theme/ (tokens and components), bundled demo material and DemoContent. No user research, testimonials or usage data exist; do not invent any. A league between students is deliberately not built.

## Product Principles

- Teach, don't answer: the student decides when to escalate help; escape hatches stay available.
- Mastery over streaks: XP and streaks reward effort, skills show what is actually known.
- Offline first: no feature may depend on an LLM or network to be usable.
- Calm study tool: motivating but never noisy; gamification serves learning, not the reverse.
- One system: every screen reads as Quill, on iPad Dock layout and on iPhone alike.

## Accessibility & Inclusion

Light and dark mode and Dynamic Type must hold; layouts work in compact and regular size classes. Pencil and touch both supported. No further product-specific standard established.
