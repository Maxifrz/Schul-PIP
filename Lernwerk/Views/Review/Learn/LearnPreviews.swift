import SwiftUI

/// Sample cards for the previews of the Lernpfad's screens.
enum LearnSamples {
    private static let texts: [(front: String, back: String)] = [
        ("Wo findet die Photosynthese statt?", "In den Chloroplasten der Pflanzenzelle"),
        ("Was ist das Kraftwerk der Zelle?", "Das Mitochondrium"),
        ("Was steuert die Zelle?", "Der Zellkern"),
        ("Was umgibt die Pflanzenzelle?", "Die Zellwand aus Zellulose"),
        (
            "Was macht die Photosynthese?",
            "Sie wandelt Lichtenergie in chemische Energie um und speichert sie in Traubenzucker. Dabei entsteht Sauerstoff."
        ),
        ("Was ist die Ableitung von x²?", "2x"),
        ("Was transportiert das Erbgut aus dem Zellkern?", "Die messenger-RNA trägt eine Abschrift der DNA zu den Ribosomen."),
        ("Wo werden Proteine gebaut?", "An den Ribosomen"),
    ]

    static let cards: [CardSnapshot] = texts.indices.map { index -> CardSnapshot in
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        return CardSnapshot(
            front: texts[index].front, back: texts[index].back, materialID: nil,
            createdAt: start.addingTimeInterval(Double(index) * 60), dueDate: start
        )
    }

    static var lesson: [CardSnapshot] { Array(cards.prefix(6)) }

    /// The lesson's exercises of one kind.
    static func exercises(_ kind: ExerciseKind) -> [LearnExercise] {
        ExerciseBuilder(lesson: lesson, deck: cards).build(seed: 4).filter { $0.kind == kind }
    }

    static var store: LearnProgressStore {
        LearnProgressStore(defaults: UserDefaults(suiteName: "lernpfad.preview") ?? .standard)
    }

    static var result: LessonResult {
        LessonResult(
            lessonID: "L-preview", sessionID: "preview", exerciseCount: 11, rightFirstTry: 10, rightOnRetry: 1,
            cardKeys: lesson.map(\.key), cardsRightFirstTry: Set(lesson.map(\.key))
        )
    }
}

#Preview("Multiple Choice") {
    LessonView(cards: LearnSamples.lesson, exercises: LearnSamples.exercises(.multipleChoice))
        .environmentObject(LearnSamples.store)
}

#Preview("Paare") {
    LessonView(cards: LearnSamples.lesson, exercises: LearnSamples.exercises(.matchPairs))
        .environmentObject(LearnSamples.store)
}

#Preview("Wortbank") {
    LessonView(cards: LearnSamples.lesson, exercises: LearnSamples.exercises(.wordBank))
        .environmentObject(LearnSamples.store)
}

#Preview("Tippen") {
    LessonView(cards: LearnSamples.lesson, exercises: LearnSamples.exercises(.typeAnswer))
        .environmentObject(LearnSamples.store)
}

#Preview("Ganze Lektion") {
    LessonView(cards: LearnSamples.lesson, dueKeys: Set(LearnSamples.lesson.map(\.key)), deck: LearnSamples.cards) { _ in }
        .environmentObject(LearnSamples.store)
}

#Preview("Geschafft") {
    LessonCompleteView(result: LearnSamples.result, xp: 135, streak: 4, xpToday: 135, dailyGoal: 50, onDone: {})
        .background(Quill.bg)
}
