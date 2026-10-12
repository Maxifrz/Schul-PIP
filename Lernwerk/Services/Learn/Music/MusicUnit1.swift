import Foundation

/// What a unit asks: topic keys per node. A topic in the practice list that is "~" stands for a topic of an earlier unit.
struct MusicUnitDef {
    let makers: [String: MusicMaker]
    let lessons: [[String]]
    let practice: [String]
    let checkpoint: [String]
    /// Topics worth meeting again in later units.
    let review: [String]
}

/// Unit 1: the staff and the treble clef.
enum MusicUnit1 {
    static let tag = "music.u01"
    private static func n(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch { MusicKit.note(letter, octave, alteration) }

    /// The new notes of each lesson: the lines, the spaces, the ledger lines and the notes just beyond the staff.
    static let freshNotes: [[Pitch]] = [
        [n(2, 4), n(4, 4), n(6, 4), n(1, 5), n(3, 5)],
        [n(3, 4), n(5, 4), n(0, 5), n(2, 5)],
        [n(0, 4), n(1, 4), n(4, 5), n(5, 5)],
    ]
    static var all: [Pitch] { freshNotes.flatMap { $0 } }
    static func fresh(_ level: Int) -> [Pitch] { level >= 4 ? all : freshNotes[level - 1] }
    static func upTo(_ level: Int) -> [Pitch] { level >= 4 ? all : Array(freshNotes.prefix(level).flatMap { $0 }) }

    static func pitch(_ level: Int, _ random: inout LearnRandom) -> Pitch? {
        MusicKit.draw(fresh: fresh(level), all: upTo(level), level: level, &random)
    }

    static func read(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = pitch(level, &random) else { return nil }
        let step = p.staffPosition(clef: .treble).step
        let wrong = MusicKit.wrongReadings(of: p, clef: .treble, otherClef: nil, naturalsOnly: true, &random)
        return Exercises.choice(
            id: "\(tag).read.\(p.scientificName)", key: "music.note.treble.\(p.scientificName)", prompt: "Wie heißt diese Note?",
            correct: p.germanName, wrong: wrong,
            explanation: "\(p.germanName) liegt im Violinschlüssel \(MusicKit.phrase(step: step)).",
            media: MusicKit.staff(.treble, [p]), using: &random
        )
    }

    static func readType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = pitch(level, &random) else { return nil }
        let step = p.staffPosition(clef: .treble).step
        return MusicKit.typedNote(
            id: "\(tag).type.\(p.scientificName)", key: "music.note.treble.\(p.scientificName)", prompt: "Schreibe den Namen dieser Note.",
            answer: p, explanation: "\(p.germanName) liegt im Violinschlüssel \(MusicKit.phrase(step: step)).",
            media: MusicKit.staff(.treble, [p])
        )
    }

    static func place(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = pitch(level, &random) else { return nil }
        let step = p.staffPosition(clef: .treble).step
        let wrong = [1, -1, 2, -2].map { Pitch.atStep(step + $0, clef: .treble).germanName }
        return Exercises.choice(
            id: "\(tag).place.\(p.scientificName)", key: "music.note.treble.\(p.scientificName)",
            prompt: "Welche Note liegt im Violinschlüssel \(MusicKit.phrase(step: step))?", correct: p.germanName, wrong: wrong,
            explanation: "\(p.germanName) liegt im Violinschlüssel \(MusicKit.phrase(step: step)).", using: &random
        )
    }

    /// Four notes of different names, taken from the pool.
    static func distinctLetters(from pool: [Pitch], count: Int, _ random: inout LearnRandom) -> [Pitch] {
        var chosen: [Pitch] = []
        for p in pool.shuffled(using: &random) where !chosen.contains(where: { $0.letter == p.letter }) {
            chosen.append(p)
            if chosen.count == count { break }
        }
        return chosen
    }

    static func pairs(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let chosen = distinctLetters(from: upTo(level), count: 4, &random)
        guard chosen.count == 4 else { return nil }
        let items = chosen.compactMap { p -> (key: String, front: String, back: String)? in
            guard let text = p.staffPosition(clef: .treble).description else { return nil }
            return (key: "music.note.treble.\(p.scientificName)", front: p.germanName, back: text)
        }
        guard items.count == 4 else { return nil }
        let id = "\(tag).pairs." + chosen.map(\.scientificName).sorted().joined()
        return Exercises.pairs(id: id, prompt: "Wo liegt die Note im Violinschlüssel?", items: items, using: &random)
    }

    static func bank(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let chosen = distinctLetters(from: upTo(level), count: 4, &random)
        guard chosen.count == 4 else { return nil }
        let others = (0..<7).filter { letter in !chosen.contains { $0.letter == letter } }.shuffled(using: &random)
        let extra = others.prefix(2).map { Pitch.letterNames[$0] }
        let words = chosen.map(\.germanName)
        return Exercises.bank(
            id: "\(tag).bank." + chosen.map(\.scientificName).joined(separator: "-"), key: "music.bank.treble",
            prompt: "Wie heißen die Noten? Lege sie der Reihe nach.", words: words, extra: Array(extra),
            media: MusicKit.staff(.treble, chosen), using: &random
        )
    }

    static func terms(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        Exercises.pairs(
            id: "\(tag).terms", prompt: "Was bedeutet das Wort?",
            items: [
                (key: "music.term.system", front: "Notensystem", back: "fünf Linien"),
                (key: "music.term.violin", front: "Violinschlüssel", back: "G-Schlüssel"),
                (key: "music.term.ledger", front: "Hilfslinie", back: "kurzer Strich außerhalb des Systems"),
                (key: "music.term.space", front: "Zwischenraum", back: "Platz zwischen zwei Linien"),
            ], using: &random
        )
    }

    static func fact(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        MusicKit.fact(facts, level: level, tag: tag, &random)
    }

    static let facts: [MusicFact] = [
        MusicFact("lines", level: 1, "Wie viele Linien hat ein Notensystem?", correct: "5", wrong: ["4", "6", "3"],
                  explanation: "Ein Notensystem hat fünf Linien und vier Zwischenräume."),
        MusicFact("spaces", level: 1, "Wie viele Zwischenräume hat ein Notensystem?", correct: "4", wrong: ["3", "5", "6"],
                  explanation: "Vier Zwischenräume liegen zwischen den fünf Linien."),
        MusicFact("count", level: 1, "Von wo aus zählt man die Linien?", correct: "von unten nach oben",
                  wrong: ["von oben nach unten", "von der mittleren Linie aus"], explanation: "Die unterste Linie ist die 1. Linie."),
        MusicFact("gclef", level: 1, "Der Violinschlüssel heißt auch G-Schlüssel. Welche Linie markiert er?", correct: "2. Linie",
                  wrong: ["1. Linie", "3. Linie", "4. Linie"], explanation: "Die Schnecke des Violinschlüssels legt sich um die 2. Linie: dort liegt das G."),
        MusicFact("high", level: 2, "Eine Note steht höher im Notensystem. Wie klingt sie?", correct: "höher",
                  wrong: ["tiefer", "lauter", "länger"], explanation: "Je höher eine Note steht, desto höher ist der Ton."),
        MusicFact("between", level: 2, "Welche Note liegt im Violinschlüssel im Zwischenraum zwischen den Linien E und G?", correct: "F",
                  wrong: ["D", "A", "H"], explanation: "Zwischen E und G liegt F: Die Buchstaben folgen aufeinander."),
        MusicFact("ledger", level: 3, "Was ist eine Hilfslinie?", correct: "ein kurzer Strich über oder unter dem System",
                  wrong: ["der Strich zwischen zwei Takten", "der Bogen, der zwei Noten verbindet"],
                  explanation: "Hilfslinien verlängern das Notensystem nach oben oder unten."),
        MusicFact("middlec", level: 3, "Wo liegt das eingestrichene C im Violinschlüssel?", correct: "auf der 1. Hilfslinie unter dem System",
                  wrong: ["auf der 1. Linie", "im 1. Zwischenraum", "unter der 1. Linie"],
                  explanation: "Das eingestrichene C sitzt auf einer kurzen Hilfslinie unter den fünf Linien.",
                  media: MusicKit.staff(.treble, [n(0, 4)])),
    ]

    static let def = MusicUnitDef(
        makers: ["fact": fact, "read": read, "readType": readType, "place": place, "pairs": pairs, "bank": bank, "terms": terms],
        lessons: [
            ["fact", "fact", "read", "read", "read", "place", "pairs", "bank", "readType", "readType"],
            ["fact", "read", "read", "read", "place", "place", "pairs", "bank", "readType", "readType", "readType"],
            ["fact", "fact", "read", "read", "read", "place", "terms", "bank", "readType", "readType"],
        ],
        practice: ["fact", "read", "read", "read", "place", "pairs", "terms", "bank", "readType", "readType", "readType", "readType"],
        checkpoint: ["fact", "fact", "read", "read", "read", "read", "place", "place", "pairs", "bank", "readType", "readType", "readType", "readType"],
        review: ["read", "readType", "place", "pairs"]
    )
}
