import Foundation

/// Unit 7: major and minor triads, built, read and heard.
enum MusicUnit7 {
    static let tag = "music.u07"
    private static func n(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch { MusicKit.note(letter, octave, alteration) }

    /// The triads of each lesson: major on C, G, F, D; minor on A, E, D; then flats and a few more.
    static let fresh: [[MusicTriad]] = [
        [MusicTriad(root: n(0, 4), quality: .major), MusicTriad(root: n(4, 4), quality: .major),
         MusicTriad(root: n(3, 4), quality: .major), MusicTriad(root: n(1, 4), quality: .major)],
        [MusicTriad(root: n(5, 4), quality: .minor), MusicTriad(root: n(2, 4), quality: .minor), MusicTriad(root: n(1, 4), quality: .minor)],
        [MusicTriad(root: n(2, 4, -1), quality: .major), MusicTriad(root: n(6, 4, -1), quality: .major), MusicTriad(root: n(5, 4, -1), quality: .major),
         MusicTriad(root: n(4, 4), quality: .minor), MusicTriad(root: n(0, 4), quality: .minor), MusicTriad(root: n(3, 4), quality: .minor)],
    ]
    static var all: [MusicTriad] { fresh.flatMap { $0 } }
    static func upTo(_ level: Int) -> [MusicTriad] { level >= 4 ? all : Array(fresh.prefix(level).flatMap { $0 }) }
    static func triad(_ level: Int, _ random: inout LearnRandom) -> MusicTriad? {
        MusicKit.draw(fresh: level >= 4 ? all : fresh[level - 1], all: upTo(level), level: level, &random)
    }

    private static func tones(_ t: MusicTriad) -> String { t.notes.map(\.germanName).joined(separator: " – ") }

    private static func kindWord(_ t: MusicTriad) -> String { t.quality == .major ? "Dur" : "Moll" }

    static func staffName(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let t = triad(level, &random) else { return nil }
        var wrong: [String] = []
        if level >= 2 { wrong.append(MusicTriad(root: t.root, quality: t.quality == .major ? .minor : .major).name) }
        let pool = (level >= 2 ? all : fresh[0]).filter { $0.name != t.name }.shuffled(using: &random)
        wrong += pool.map(\.name)
        return Exercises.choice(
            id: "\(tag).staff.\(t.name)", key: "music.triad.\(t.name)", prompt: "Welcher Dreiklang ist das?", correct: t.name, wrong: wrong,
            explanation: "Die Töne sind \(tones(t)).", media: MusicKit.staff(.treble, t.notes, chord: true), using: &random
        )
    }

    static func staffKind(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let t = triad(level, &random) else { return nil }
        let third = t.notes[1].midi - t.notes[0].midi
        return Exercises.choice(
            id: "\(tag).kind.\(t.name)", key: "music.triad.\(t.name)", prompt: "Ist das ein Dur- oder ein Moll-Dreiklang?", correct: kindWord(t),
            wrong: [t.quality == .major ? "Moll" : "Dur"],
            explanation: "Die Terz liegt \(third) Halbtöne über dem Grundton: " + (t.quality == .major ? "große Terz, Dur." : "kleine Terz, Moll."),
            media: MusicKit.staff(.treble, t.notes, chord: true), using: &random
        )
    }

    static func hearKind(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let t = triad(max(level, 2), &random), let octave = [3, 4].randomElement(using: &random) else { return nil }
        let root = n(t.root.letter, octave, t.root.alteration)
        let notes = MusicTriad(root: root, quality: t.quality).notes
        return Exercises.choice(
            id: "\(tag).hear.\(t.name).\(octave)", key: "music.triad.\(t.name)", prompt: "Hör hin: Dur oder Moll?", correct: kindWord(t),
            wrong: [t.quality == .major ? "Moll" : "Dur"],
            explanation: t.quality == .major ? "Dur klingt hell: Die Terz ist groß." : "Moll klingt dunkler: Die Terz ist klein.",
            media: .tones(ToneSpec(midi: notes.map(\.midi), together: true)), using: &random
        )
    }

    static func missing(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let t = triad(level, &random), let hidden = Array(0..<3).randomElement(using: &random) else { return nil }
        let notes = t.notes
        let shown = notes.enumerated().map { $0.offset == hidden ? "?" : $0.element.germanName }.joined(separator: " – ")
        let wrong = MusicKit.wrongNames(for: notes[hidden], &random)
        return Exercises.choice(
            id: "\(tag).missing.\(t.name).\(hidden)", key: "music.triad.\(t.name)", prompt: "\(t.name): \(shown). Welcher Ton fehlt?", correct: notes[hidden].germanName,
            wrong: wrong, explanation: "\(t.name) besteht aus \(tones(t)).", using: &random
        )
    }

    static func typedPart(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let t = triad(level, &random), let part = [1, 2].randomElement(using: &random) else { return nil }
        let word = part == 1 ? "Terz" : "Quinte"
        return MusicKit.typedNote(
            id: "\(tag).part.\(t.name).\(part)", key: "music.triad.\(t.name)", prompt: "Wie heißt die \(word) des \(t.name)-Dreiklangs?", answer: t.notes[part],
            explanation: "\(t.name) besteht aus \(tones(t))."
        )
    }

    static func buildBank(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let t = triad(level, &random) else { return nil }
        let notes = t.notes
        let otherThird = MusicTriad(root: t.root, quality: t.quality == .major ? .minor : .major).notes[1]
        let extra = [otherThird.germanName] + MusicKit.wrongNames(for: notes[2], &random).prefix(1)
        return Exercises.bank(
            id: "\(tag).bank.\(t.name)", key: "music.triad.\(t.name)", prompt: "Baue den \(t.name)-Dreiklang. Lege Grundton, Terz und Quinte der Reihe nach.",
            words: notes.map(\.germanName), extra: extra, explanation: "Dur: große Terz und kleine Terz. Moll: kleine Terz und große Terz.", using: &random
        )
    }

    static func pairs(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let pool = upTo(level == 3 ? 3 : level)
        let chosen = Array(pool.shuffled(using: &random).prefix(4))
        guard chosen.count == 4 else { return nil }
        return Exercises.pairs(
            id: "\(tag).pairs." + chosen.map(\.name).sorted().joined(separator: "-"), prompt: "Welche Töne gehören zum Dreiklang?",
            items: chosen.map { (key: "music.triad.\($0.name)", front: $0.name, back: tones($0)) }, using: &random
        )
    }

    static func key(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let t = triad(level, &random), let part = Array(0..<3).randomElement(using: &random) else { return nil }
        let word = ["den Grundton", "die Terz", "die Quinte"][part]
        return Exercises.key(
            id: "\(tag).key.\(t.name).\(part)", key: "music.triad.\(t.name)", prompt: "Tippe \(word) des \(t.name)-Dreiklangs.", midi: MusicKit.keys(t.notes[part]),
            solution: t.notes[part].germanName, explanation: "\(t.name) besteht aus \(tones(t))."
        )
    }

    static func fact(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        MusicKit.fact(facts, level: level, tag: tag, &random)
    }

    static let facts: [MusicFact] = [
        MusicFact("names", level: 1, "Wie heißen die drei Töne eines Dreiklangs?", correct: "Grundton, Terz, Quinte",
                  wrong: ["Prim, Sekunde, Terz", "Grundton, Quarte, Sexte", "Terz, Quinte, Septime"], explanation: "Die Töne stehen im Abstand von Terzen übereinander."),
        MusicFact("major", level: 1, "Wie ist ein Dur-Dreiklang aufgebaut?", correct: "große Terz und darüber kleine Terz",
                  wrong: ["kleine Terz und darüber große Terz", "zwei große Terzen", "zwei kleine Terzen"], explanation: "C–E ist eine große Terz, E–G eine kleine."),
        MusicFact("cmajor", level: 1, "Welche Töne hat der C-Dur-Dreiklang?", correct: "C, E, G", wrong: ["C, Es, G", "C, F, G", "C, E, A"], explanation: "Jeder zweite Buchstabe: C E G."),
        MusicFact("minor", level: 2, "Wie ist ein Moll-Dreiklang aufgebaut?", correct: "kleine Terz und darüber große Terz",
                  wrong: ["große Terz und darüber kleine Terz", "zwei große Terzen", "zwei kleine Terzen"], explanation: "A–C ist eine kleine Terz, C–E eine große."),
        MusicFact("change", level: 2, "Wie wird aus einem Dur-Dreiklang ein Moll-Dreiklang?", correct: "Die Terz wird einen Halbton tiefer.",
                  wrong: ["Die Quinte wird einen Halbton tiefer.", "Der Grundton wird einen Halbton höher.", "Die Terz wird einen Halbton höher."], explanation: "C E G wird zu C Es G."),
        MusicFact("fifth", level: 2, "Wie viele Halbtöne liegen in einem Dur- oder Moll-Dreiklang zwischen Grundton und Quinte?", correct: "7", wrong: ["5", "6", "8"],
                  explanation: "Die Quinte ist rein und hat sieben Halbtöne."),
        MusicFact("esdur", level: 3, "Welche Töne hat der Es-Dur-Dreiklang?", correct: "Es, G, B", wrong: ["Es, G, H", "Es, Ges, B", "E, G, B"], explanation: "Es–G ist eine große Terz, G–B eine kleine."),
        MusicFact("fminor", level: 3, "Welche Töne hat der F-Moll-Dreiklang?", correct: "F, As, C", wrong: ["F, A, C", "F, As, Ces", "F, G, C"], explanation: "F–As ist eine kleine Terz, As–C eine große."),
        MusicFact("gminor", level: 3, "Welche Töne hat der G-Moll-Dreiklang?", correct: "G, B, D", wrong: ["G, H, D", "G, B, Des", "G, A, D"], explanation: "G–B ist eine kleine Terz, B–D eine große."),
    ]

    static let def = MusicUnitDef(
        makers: [
            "fact": fact, "staffName": staffName, "staffKind": staffKind, "hearKind": hearKind, "missing": missing, "typed": typedPart,
            "buildBank": buildBank, "pairs": pairs, "key": key,
        ],
        lessons: [
            ["fact", "fact", "staffName", "staffName", "missing", "missing", "buildBank", "buildBank", "typed", "typed", "pairs"],
            ["fact", "fact", "staffKind", "staffKind", "hearKind", "hearKind", "hearKind", "staffName", "missing", "buildBank", "typed", "key"],
            ["fact", "staffName", "staffName", "staffKind", "hearKind", "hearKind", "missing", "missing", "buildBank", "buildBank", "typed", "typed"],
        ],
        practice: ["fact", "staffName", "staffKind", "hearKind", "hearKind", "missing", "buildBank", "typed", "pairs", "key", "~", "~"],
        checkpoint: ["fact", "fact", "staffName", "staffName", "staffKind", "hearKind", "hearKind", "hearKind", "missing", "buildBank", "typed", "typed", "pairs", "key"],
        review: ["staffName", "hearKind", "missing", "typed"]
    )
}
