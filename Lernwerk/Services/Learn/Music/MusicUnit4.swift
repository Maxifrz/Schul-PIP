import Foundation

/// Unit 4: sharps, flats, naturals, black keys, half and whole steps.
enum MusicUnit4 {
    static let tag = "music.u04"
    private static func n(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch { MusicKit.note(letter, octave, alteration) }

    /// Letters that can be raised or lowered to a note with its own name (no Eis, His, Fes or Ces).
    static let raisable = [0, 1, 3, 4, 5]
    static let lowerable = [6, 2, 5, 1, 4]

    static func accidental(_ random: inout LearnRandom) -> Pitch? {
        guard let sharp = [true, false].randomElement(using: &random), let octave = [4, 5].randomElement(using: &random),
              let letter = (sharp ? raisable : lowerable).randomElement(using: &random) else { return nil }
        return n(letter, octave, sharp ? 1 : -1)
    }

    private static func sentence(_ p: Pitch) -> String {
        let base = Pitch.letterNames[p.letter]
        return p.alteration > 0 ? "\(p.germanName) ist \(base) mit Kreuz: einen Halbton höher." : "\(p.germanName) ist \(base) mit Be: einen Halbton tiefer."
    }

    static func acc(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = accidental(&random) else { return nil }
        let wrong = MusicKit.wrongNames(for: p, &random)
        return Exercises.choice(
            id: "\(tag).acc.\(p.scientificName)", key: "music.acc.\(p.germanName)", prompt: "Wie heißt diese Note?", correct: p.germanName, wrong: wrong,
            explanation: sentence(p), media: MusicKit.staff(.treble, [p]), using: &random
        )
    }

    static func accType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = accidental(&random) else { return nil }
        return MusicKit.typedNote(
            id: "\(tag).acctype.\(p.scientificName)", key: "music.acc.\(p.germanName)", prompt: "Schreibe den Namen dieser Note.", answer: p,
            explanation: sentence(p), media: MusicKit.staff(.treble, [p])
        )
    }

    /// Two notes a half or a whole step apart, as a lower and an upper pitch.
    static func stepPair(_ random: inout LearnRandom) -> (Pitch, Pitch)? {
        for _ in 0..<20 {
            guard let letter = Array(0..<7).randomElement(using: &random), let kind = Array(0..<4).randomElement(using: &random) else { return nil }
            let octave = 4
            let lower: Pitch, upper: Pitch
            let nextLetter = (letter + 1) % 7
            let nextOctave = letter == 6 ? octave + 1 : octave
            switch kind {
            case 0: lower = n(letter, octave); upper = n(nextLetter, nextOctave)
            case 1: lower = n(letter, octave); upper = n(letter, octave, 1)
            case 2: lower = n(letter, octave); upper = n(nextLetter, nextOctave, -1)
            default:
                guard raisable.contains(letter) else { continue }
                lower = n(letter, octave, 1); upper = n(nextLetter, nextOctave)
            }
            if (1...2).contains(upper.midi - lower.midi) { return (lower, upper) }
        }
        return nil
    }

    static func stepKind(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let (lower, upper) = stepPair(&random) else { return nil }
        let semis = upper.midi - lower.midi
        let answer = semis == 1 ? "Halbton" : "Ganzton"
        return Exercises.choice(
            id: "\(tag).step.\(lower.scientificName).\(upper.scientificName)", key: "music.step", prompt: "Wie groß ist der Schritt zwischen den beiden Noten?",
            correct: answer, wrong: [semis == 1 ? "Ganzton" : "Halbton"],
            explanation: "Von \(lower.germanName) nach \(upper.germanName) sind es \(semis) Halbton" + (semis == 1 ? "." : "schritte."),
            media: MusicKit.staff(.treble, [lower, upper]), using: &random
        )
    }

    static func hearStep(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let start = Array(57...69).randomElement(using: &random), let semis = [1, 2].randomElement(using: &random) else { return nil }
        let answer = semis == 1 ? "Halbton" : "Ganzton"
        return Exercises.choice(
            id: "\(tag).hear.\(start).\(semis)", key: "music.hearstep", prompt: "Hör hin: Ist der Schritt ein Halbton oder ein Ganzton?", correct: answer,
            wrong: [semis == 1 ? "Ganzton" : "Halbton"], explanation: "Ein Halbton ist ein Schritt zur nächsten Taste, ein Ganzton sind zwei Tasten.",
            media: .tones(ToneSpec(midi: [start, start + semis])), using: &random
        )
    }

    private static func place(_ p: Pitch) -> String {
        let base = Pitch.letterNames[p.letter]
        if p.alteration > 0 { return "\(p.germanName) liegt als schwarze Taste direkt rechts neben \(base)." }
        return "\(p.germanName) liegt als schwarze Taste direkt links neben \(base)."
    }

    static func keyBlack(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let p = accidental(&random) else { return nil }
        let p4 = n(p.letter, 4, p.alteration)
        if Bool.random(using: &random), let text = MusicKit.octaveText(p4) {
            return Exercises.key(
                id: "\(tag).key.\(p4.scientificName)", key: "music.acc.\(p.germanName)", prompt: "Tippe \(text).", midi: [p4.midi],
                solution: p.germanName, explanation: place(p)
            )
        }
        return Exercises.key(
            id: "\(tag).key.any.\(p.germanName)", key: "music.acc.\(p.germanName)", prompt: "Tippe ein \(p.germanName).", midi: MusicKit.keys(p),
            solution: p.germanName, explanation: place(p)
        )
    }

    private static let enharmonic: [(sharp: String, flat: String)] = [("Cis", "Des"), ("Dis", "Es"), ("Fis", "Ges"), ("Gis", "As"), ("Ais", "B")]

    static func enharmPairs(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let chosen = Array(enharmonic.shuffled(using: &random).prefix(4))
        return Exercises.pairs(
            id: "\(tag).enh." + chosen.map(\.sharp).sorted().joined(separator: "-"), prompt: "Welche Namen gehören zur selben Taste?",
            items: chosen.map { (key: "music.enh.\($0.sharp)", front: $0.sharp, back: $0.flat) }, using: &random
        )
    }

    static func enharmChoice(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let pair = MusicKit.pick(enharmonic, &random), let asSharp = [true, false].randomElement(using: &random) else { return nil }
        let given = asSharp ? pair.sharp : pair.flat, answer = asSharp ? pair.flat : pair.sharp
        guard let parsed = MusicNames.parse(answer) else { return nil }
        let wrong = MusicKit.wrongNames(for: n(parsed.letter, 4, parsed.alteration), &random)
        return Exercises.choice(
            id: "\(tag).enh.\(given)", key: "music.enh.\(pair.sharp)", prompt: "Welcher Name gehört zur selben schwarzen Taste wie \(given)?", correct: answer,
            wrong: wrong, explanation: "\(pair.sharp) und \(pair.flat) sind dieselbe Taste.", using: &random
        )
    }

    static func raise(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let letter = MusicKit.pick(raisable, &random) else { return nil }
        let base = n(letter, 4), result = n(letter, 4, 1)
        return MusicKit.typedNote(
            id: "\(tag).raise.\(base.germanName)", key: "music.acc.\(result.germanName)", prompt: "Erhöhe \(base.germanName) um einen Halbton. Wie heißt der neue Ton?",
            answer: result, explanation: "Erhöhte Töne bekommen die Endung -is."
        )
    }

    static func lower(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let letter = MusicKit.pick(lowerable, &random) else { return nil }
        let base = n(letter, 4), result = n(letter, 4, -1)
        return MusicKit.typedNote(
            id: "\(tag).lower.\(base.germanName)", key: "music.acc.\(result.germanName)", prompt: "Erniedrige \(base.germanName) um einen Halbton. Wie heißt der neue Ton?",
            answer: result, explanation: "Erniedrigte Töne bekommen die Endung -es; E wird Es, A wird As und H wird B."
        )
    }

    static func terms(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        Exercises.pairs(
            id: "\(tag).terms", prompt: "Was bedeutet das Wort?",
            items: [
                (key: "music.term.sharp", front: "Kreuz", back: "erhöht um einen Halbton"),
                (key: "music.term.flat", front: "Be", back: "erniedrigt um einen Halbton"),
                (key: "music.term.natural", front: "Auflösungszeichen", back: "hebt Kreuz oder Be wieder auf"),
                (key: "music.term.semitone", front: "Halbton", back: "kleinster Abstand zwischen zwei Tasten"),
            ], using: &random
        )
    }

    static func bank(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let start = [0, 1, 3, 4, 5].randomElement(using: &random) else { return nil }
        let first = n(start, 4)
        let notes = (0..<5).map { Pitch.spelled(midi: first.midi + $0) }
        return Exercises.bank(
            id: "\(tag).bank.\(first.germanName)", key: "music.bank.chromatic", prompt: "Wie heißen die Noten? Lege sie der Reihe nach.",
            words: notes.map(\.germanName), explanation: "Hier geht es in Halbtonschritten aufwärts.", media: MusicKit.staff(.treble, notes), using: &random
        )
    }

    static func fact(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        MusicKit.fact(facts, level: level, tag: tag, &random)
    }

    static let facts: [MusicFact] = [
        MusicFact("sharp", level: 1, "Was bewirkt ein Kreuz vor einer Note?", correct: "Der Ton wird einen Halbton höher.",
                  wrong: ["Der Ton wird einen Halbton tiefer.", "Der Ton wird einen Ganzton höher.", "Der Ton wird aufgehoben."],
                  explanation: "Das Kreuz erhöht um einen Halbton."),
        MusicFact("flat", level: 1, "Welches Zeichen erniedrigt eine Note um einen Halbton?", correct: "Be", wrong: ["Kreuz", "Auflösungszeichen"],
                  explanation: "Das Be erniedrigt um einen Halbton."),
        MusicFact("natural", level: 1, "Welches Zeichen hebt ein Kreuz oder ein Be wieder auf?", correct: "Auflösungszeichen", wrong: ["Kreuz", "Be"],
                  explanation: "Das Auflösungszeichen macht den Ton wieder zur weißen Taste."),
        MusicFact("bar", level: 1, "Wie lange gilt ein Vorzeichen vor einer Note?", correct: "bis zum Ende des Taktes",
                  wrong: ["bis zum Ende des Stücks", "bis zur nächsten Pause", "nur für die nächste Note im nächsten Takt"],
                  explanation: "Ein Vorzeichen gilt für denselben Ton bis zum Taktstrich."),
        MusicFact("cis", level: 1, "Was ist Cis?", correct: "C, einen Halbton erhöht",
                  wrong: ["C, einen Halbton erniedrigt", "D, einen Halbton erhöht", "C, einen Ganzton erhöht"], explanation: "Die Endung -is zeigt einen erhöhten Ton an."),
        MusicFact("des", level: 1, "Was ist Des?", correct: "D, einen Halbton erniedrigt",
                  wrong: ["D, einen Halbton erhöht", "C, einen Halbton erniedrigt", "D, einen Ganzton erniedrigt"], explanation: "Die Endung -es zeigt einen erniedrigten Ton an."),
        MusicFact("hb", level: 1, "Wie heißt H mit einem Be?", correct: "B", wrong: ["Hes", "His", "Ces"], explanation: "H mit Be heißt B."),
        MusicFact("es", level: 1, "Wie heißt E mit einem Be?", correct: "Es", wrong: ["Eis", "Fes", "Des"], explanation: "E mit Be heißt Es."),
        MusicFact("as", level: 1, "Wie heißt A mit einem Be?", correct: "As", wrong: ["Ais", "Ges", "G"], explanation: "A mit Be heißt As."),
        MusicFact("whole", level: 2, "Wie viele Halbtöne sind ein Ganzton?", correct: "2", wrong: ["1", "3", "4"], explanation: "Ein Ganzton besteht aus zwei Halbtönen."),
        MusicFact("semitone", level: 2, "Was ist ein Halbton?", correct: "der Schritt zur nächsten Taste",
                  wrong: ["der Schritt zur übernächsten Taste", "der Schritt von C nach D", "der Abstand einer Oktave"], explanation: "Der Halbton ist der kleinste Schritt auf dem Klavier."),
        MusicFact("hc", level: 2, "Zwischen welchen weißen Tasten liegt ein Halbton?", correct: "H und C", wrong: ["C und D", "D und E", "G und A"],
                  explanation: "Zwischen H und C gibt es keine schwarze Taste."),
        MusicFact("ef", level: 2, "Zwischen welchen weißen Tasten liegt ein Halbton?", correct: "E und F", wrong: ["F und G", "A und H", "D und E"],
                  explanation: "Zwischen E und F gibt es keine schwarze Taste."),
        MusicFact("black", level: 2, "Wie viele schwarze Tasten hat eine Oktave?", correct: "5", wrong: ["7", "4", "12"], explanation: "Zwei und drei schwarze Tasten ergeben fünf."),
        MusicFact("twelve", level: 2, "Wie viele Halbtonschritte hat eine Oktave?", correct: "12", wrong: ["7", "8", "10"], explanation: "Sieben weiße und fünf schwarze Tasten ergeben zwölf."),
        MusicFact("sameKey", level: 3, "Was gilt für Cis und Des?", correct: "Sie sind dieselbe Taste mit zwei Namen.",
                  wrong: ["Cis ist höher als Des.", "Cis ist tiefer als Des.", "Beide sind weiße Tasten."], explanation: "Das nennt man enharmonische Verwechslung."),
        MusicFact("enharmonic", level: 3, "Wie nennt man Töne mit gleicher Taste, aber verschiedenem Namen?", correct: "enharmonisch verwechselt",
                  wrong: ["chromatisch", "diatonisch", "parallel"], explanation: "Zum Beispiel Fis und Ges."),
    ]

    static let def = MusicUnitDef(
        makers: [
            "fact": fact, "acc": acc, "accType": accType, "stepKind": stepKind, "hearStep": hearStep, "keyBlack": keyBlack,
            "enharmPairs": enharmPairs, "enharmChoice": enharmChoice, "raise": raise, "lower": lower, "terms": terms, "bank": bank,
        ],
        lessons: [
            ["fact", "fact", "fact", "acc", "acc", "acc", "terms", "accType", "accType", "accType"],
            ["fact", "fact", "stepKind", "stepKind", "hearStep", "hearStep", "keyBlack", "keyBlack", "keyBlack", "acc", "accType", "bank"],
            ["fact", "fact", "enharmChoice", "enharmChoice", "enharmPairs", "keyBlack", "raise", "raise", "lower", "lower", "accType", "acc"],
        ],
        practice: ["fact", "acc", "stepKind", "hearStep", "keyBlack", "enharmChoice", "enharmPairs", "raise", "lower", "bank", "~", "~"],
        checkpoint: ["fact", "fact", "acc", "acc", "accType", "accType", "stepKind", "hearStep", "keyBlack", "keyBlack", "enharmChoice", "enharmPairs", "raise", "lower"],
        review: ["acc", "accType", "keyBlack", "stepKind"]
    )
}
