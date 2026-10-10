import Foundation

/// Unit 2: the bass clef and the keyboard.
enum MusicUnit2 {
    static let tag = "music.u02"
    private static func n(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch { MusicKit.note(letter, octave, alteration) }

    /// The lines of the bass clef, then its spaces and the notes beyond the staff.
    static let freshBass: [[Pitch]] = [
        [n(4, 2), n(6, 2), n(1, 3), n(3, 3), n(5, 3)],
        [n(5, 2), n(0, 3), n(2, 3), n(4, 3), n(3, 2), n(6, 3), n(0, 4)],
        [],
    ]
    static var allBass: [Pitch] { freshBass.flatMap { $0 } }
    static func upTo(_ level: Int) -> [Pitch] { level >= 3 ? allBass : Array(freshBass.prefix(level).flatMap { $0 }) }

    static func bass(_ level: Int, _ random: inout LearnRandom) -> Pitch? {
        let fresh = level >= 4 ? allBass : freshBass[level - 1]
        return MusicKit.draw(fresh: fresh, all: upTo(level), level: level, &random)
    }

    private static func sentence(_ p: Pitch, _ clef: Clef) -> String {
        "\(p.germanName) liegt im \(MusicKit.clefWord(clef)) \(MusicKit.phrase(step: p.staffPosition(clef: clef).step))."
    }

    static func read(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = bass(level, &random) else { return nil }
        let wrong = MusicKit.wrongReadings(of: p, clef: .bass, otherClef: .treble, naturalsOnly: true, &random)
        return Exercises.choice(
            id: "\(tag).read.\(p.scientificName)", key: "music.note.bass.\(p.scientificName)", prompt: "Wie heißt diese Note im Bassschlüssel?",
            correct: p.germanName, wrong: wrong, explanation: sentence(p, .bass), media: MusicKit.staff(.bass, [p]), using: &random
        )
    }

    static func readType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = bass(level, &random) else { return nil }
        return MusicKit.typedNote(
            id: "\(tag).type.\(p.scientificName)", key: "music.note.bass.\(p.scientificName)", prompt: "Schreibe den Namen dieser Note.",
            answer: p, explanation: sentence(p, .bass), media: MusicKit.staff(.bass, [p])
        )
    }

    /// A note in either clef.
    static func readMixed(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let useBass = Bool.random(using: &random)
        let clef: Clef = useBass ? .bass : .treble
        guard let p = useBass ? bass(4, &random) : MusicKit.pick(MusicUnit1.all, &random) else { return nil }
        let wrong = MusicKit.wrongReadings(of: p, clef: clef, otherClef: useBass ? .treble : .bass, naturalsOnly: true, &random)
        return Exercises.choice(
            id: "\(tag).mixed.\(clef.rawValue).\(p.scientificName)", key: "music.note.\(clef.rawValue).\(p.scientificName)",
            prompt: "Wie heißt diese Note im \(MusicKit.clefWord(clef))?", correct: p.germanName, wrong: wrong,
            explanation: sentence(p, clef), media: MusicKit.staff(clef, [p]), using: &random
        )
    }

    static func compare(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let step = Array(0...8).randomElement(using: &random) else { return nil }
        let treble = Pitch.atStep(step, clef: .treble), low = Pitch.atStep(step, clef: .bass)
        let wrong = [treble.germanName] + [1, -1, 2].map { Pitch.atStep(step + $0, clef: .bass).germanName }
        return Exercises.choice(
            id: "\(tag).compare.\(step)", key: "music.compare.\(step)",
            prompt: "Eine Note liegt \(MusicKit.phrase(step: step)). Im Violinschlüssel heißt sie \(treble.germanName). Wie heißt sie im Bassschlüssel?",
            correct: low.germanName, wrong: wrong,
            explanation: "Die Linien und Zwischenräume bleiben gleich, aber der Bassschlüssel hat andere Namen: hier \(low.germanName).",
            using: &random
        )
    }

    static func place(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = bass(level, &random) else { return nil }
        let step = p.staffPosition(clef: .bass).step
        let wrong = [1, -1, 2, -2].map { Pitch.atStep(step + $0, clef: .bass).germanName }
        return Exercises.choice(
            id: "\(tag).place.\(p.scientificName)", key: "music.note.bass.\(p.scientificName)",
            prompt: "Welche Note liegt im Bassschlüssel \(MusicKit.phrase(step: step))?", correct: p.germanName, wrong: wrong,
            explanation: sentence(p, .bass), using: &random
        )
    }

    static func pairs(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let chosen = MusicUnit1.distinctLetters(from: upTo(level), count: 4, &random)
        guard chosen.count == 4 else { return nil }
        let items = chosen.compactMap { p -> (key: String, front: String, back: String)? in
            guard let text = p.staffPosition(clef: .bass).description else { return nil }
            return (key: "music.note.bass.\(p.scientificName)", front: p.germanName, back: text)
        }
        guard items.count == 4 else { return nil }
        return Exercises.pairs(
            id: "\(tag).pairs." + chosen.map(\.scientificName).sorted().joined(), prompt: "Wo liegt die Note im Bassschlüssel?",
            items: items, using: &random
        )
    }

    static func bank(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let chosen = MusicUnit1.distinctLetters(from: upTo(level), count: 4, &random)
        guard chosen.count == 4 else { return nil }
        let others = (0..<7).filter { letter in !chosen.contains { $0.letter == letter } }.shuffled(using: &random)
        return Exercises.bank(
            id: "\(tag).bank." + chosen.map(\.scientificName).joined(separator: "-"), key: "music.bank.bass",
            prompt: "Wie heißen die Noten im Bassschlüssel? Lege sie der Reihe nach.", words: chosen.map(\.germanName),
            extra: others.prefix(2).map { Pitch.letterNames[$0] }, media: MusicKit.staff(.bass, chosen), using: &random
        )
    }

    private static let keyHints = [
        "Das C liegt links neben der Gruppe aus zwei schwarzen Tasten.",
        "Das D liegt zwischen den zwei schwarzen Tasten.",
        "Das E liegt rechts neben der Gruppe aus zwei schwarzen Tasten.",
        "Das F liegt links neben der Gruppe aus drei schwarzen Tasten.",
        "Das G liegt zwischen der ersten und der zweiten schwarzen Taste der Dreiergruppe.",
        "Das A liegt zwischen der zweiten und der dritten schwarzen Taste der Dreiergruppe.",
        "Das H liegt rechts neben der Gruppe aus drei schwarzen Tasten.",
    ]

    /// Tap a key by name, in one octave when the question names it, in any octave otherwise.
    static func key(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let letter = Array(0..<7).randomElement(using: &random), let octave = [3, 4, 4, 5].randomElement(using: &random) else { return nil }
        let p = n(letter, octave)
        let hint = keyHints[letter]
        if Bool.random(using: &random), let text = MusicKit.octaveText(p) {
            return Exercises.key(
                id: "\(tag).key.\(p.scientificName)", key: "music.key.\(p.germanName)", prompt: "Tippe \(text).", midi: [p.midi],
                solution: "\(p.germanName)\(octave)", explanation: hint
            )
        }
        return Exercises.key(
            id: "\(tag).key.any.\(p.germanName)", key: "music.key.\(p.germanName)", prompt: "Tippe ein \(p.germanName).", midi: MusicKit.keys(p),
            solution: p.germanName, explanation: hint
        )
    }

    static func keyStaff(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let useBass = Bool.random(using: &random)
        guard let p = useBass ? MusicKit.pick(allBass, &random) : MusicKit.pick(MusicUnit1.all, &random) else { return nil }
        let clef: Clef = useBass ? .bass : .treble
        return Exercises.key(
            id: "\(tag).keystaff.\(clef.rawValue).\(p.scientificName)", key: "music.note.\(clef.rawValue).\(p.scientificName)",
            prompt: "Tippe diese Note auf der Klaviatur.", midi: [p.midi], solution: p.germanName,
            explanation: sentence(p, clef), media: MusicKit.staff(clef, [p])
        )
    }

    static func terms(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        Exercises.pairs(
            id: "\(tag).terms", prompt: "Was gehört zusammen?",
            items: [
                (key: "music.term.violin", front: "Violinschlüssel", back: "G-Schlüssel"),
                (key: "music.term.bass", front: "Bassschlüssel", back: "F-Schlüssel"),
                (key: "music.term.middlec", front: "Das eingestrichene c", back: "liegt etwa in der Mitte der Klaviatur"),
                (key: "music.term.black", front: "Schwarze Tasten", back: "stehen in Gruppen zu zwei und drei"),
            ], using: &random
        )
    }

    static func fact(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        MusicKit.fact(facts, level: level, tag: tag, &random)
    }

    static let facts: [MusicFact] = [
        MusicFact("fclef", level: 1, "Welcher Buchstabe gehört zum Bassschlüssel?", correct: "F", wrong: ["G", "C", "A"],
                  explanation: "Der Bassschlüssel heißt auch F-Schlüssel."),
        MusicFact("dots", level: 1, "Zwischen den zwei Punkten des Bassschlüssels liegt eine Linie. Welche?", correct: "4. Linie",
                  wrong: ["2. Linie", "3. Linie", "5. Linie"], explanation: "Die Punkte umfassen die 4. Linie, auf der das F liegt."),
        MusicFact("low", level: 1, "Wofür wird der Bassschlüssel meistens gebraucht?", correct: "für tiefe Töne",
                  wrong: ["für hohe Töne", "für laute Töne", "für kurze Töne"], explanation: "Tiefe Instrumente und die linke Hand am Klavier lesen oft im Bassschlüssel."),
        MusicFact("c4bass", level: 2, "Wo liegt das eingestrichene C im Bassschlüssel?", correct: "auf der 1. Hilfslinie über dem System",
                  wrong: ["auf der 1. Hilfslinie unter dem System", "im 4. Zwischenraum", "auf der 5. Linie"],
                  explanation: "Über der obersten Linie A folgen H und dann C auf der Hilfslinie.", media: MusicKit.staff(.bass, [n(0, 4)])),
        MusicFact("blackgroups", level: 3, "Wie sind die schwarzen Tasten angeordnet?", correct: "abwechselnd zu zwei und zu drei",
                  wrong: ["alle einzeln", "immer zu dritt", "immer zu zweit"], explanation: "Zwei und drei schwarze Tasten wechseln sich ab; so findet man sich zurecht."),
        MusicFact("cleft", level: 3, "Welche weiße Taste liegt links neben den zwei schwarzen Tasten?", correct: "C", wrong: ["D", "E", "F"],
                  explanation: "Das C liegt direkt links von der Zweiergruppe."),
        MusicFact("fleft", level: 3, "Welche weiße Taste liegt links neben den drei schwarzen Tasten?", correct: "F", wrong: ["C", "G", "H"],
                  explanation: "Das F liegt direkt links von der Dreiergruppe."),
        MusicFact("octaveName", level: 3, "Wie heißt die Oktave, in der das mittlere C liegt?", correct: "eingestrichene Oktave",
                  wrong: ["kleine Oktave", "große Oktave", "zweigestrichene Oktave"], explanation: "Das mittlere C ist das eingestrichene c."),
        MusicFact("smallc", level: 3, "Wie heißt das C eine Oktave unter dem eingestrichenen c?", correct: "kleines c",
                  wrong: ["großes C", "zweigestrichenes c", "eingestrichenes c"], explanation: "Eine Oktave tiefer beginnt die kleine Oktave mit dem kleinen c."),
    ]

    static let def = MusicUnitDef(
        makers: [
            "fact": fact, "read": read, "readType": readType, "readMixed": readMixed, "compare": compare, "place": place,
            "pairs": pairs, "bank": bank, "key": key, "keyStaff": keyStaff, "terms": terms,
        ],
        lessons: [
            ["fact", "fact", "read", "read", "read", "place", "compare", "pairs", "bank", "readType", "readType"],
            ["fact", "read", "read", "readMixed", "place", "compare", "keyStaff", "pairs", "bank", "readType", "readType"],
            ["fact", "fact", "key", "key", "key", "keyStaff", "keyStaff", "terms", "readMixed", "bank", "readType", "readType"],
        ],
        practice: ["fact", "read", "readMixed", "key", "keyStaff", "compare", "readType", "readType", "~", "~", "~", "~"],
        checkpoint: ["fact", "fact", "read", "readMixed", "readMixed", "place", "compare", "pairs", "terms", "key", "key", "keyStaff", "readType", "readType"],
        review: ["read", "readType", "key", "keyStaff"]
    )
}
