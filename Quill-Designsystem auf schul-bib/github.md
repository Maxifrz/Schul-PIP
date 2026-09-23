repo: Maxifrz/schul-bib
branch: main

## Last sync
date: 2026-09-23T16:23:10Z

### Updated in this project
- Rebuilt the Lernwerk iPad app in the Quill design system (Work Sans + Silkscreen, warm neutrals, sage accent).
- Interactive demo: mark a passage → Socratic tutor with hint ladder, flashcards, study plan, settings.
- Pip, the pixel cat from Quill, walks on the tutor input bar.

## Screen map
| Screen | Repo files |
| --- | --- |
| Lernwerk.dc.html · Tab bar | Lernwerk/App/RootView.swift |
| Bibliothek | Lernwerk/Views/Library/LibraryView.swift |
| Dokument + Werkzeugleiste | Lernwerk/Views/Document/DocumentScreen.swift, DocumentToolbar.swift, MarkingOverlayView.swift |
| Lernhilfe-Panel | Lernwerk/Views/Tutor/TutorPanel.swift, Lernwerk/Services/Tutor/HintLevel.swift, Lernwerk/Services/Demo/DemoContent.swift |
| Lernplan / Detail / Neu | Lernwerk/Views/Plan/PlanListView.swift, PlanDetailView.swift, PlanCreateView.swift, Lernwerk/Models/StudyPlan.swift |
| Wiederholen | Lernwerk/Views/Review/ReviewView.swift, Lernwerk/Services/Review/SpacedRepetition.swift |
| Einstellungen | Lernwerk/Views/Settings/SettingsView.swift, Lernwerk/Services/LLM/LLMProvider.swift |
