import Foundation

/// Unit 5: major scales built from whole and half steps, and the natural minor scale.
enum MusicUnit5 {
    static let tag = "music.u05"
    private static func n(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch { MusicKit.note(letter, octave, alteration) }

    /// The scales of each lesson: C and G major; F and D major; B flat major and three natural minor scales.
    static let fresh: [[MusicScale]] = [
        [MusicScale(tonic: n(0, 4), kind: .major), MusicScale(tonic: n(4, 4), kind: .major)],
        [MusicScale(tonic: n(3, 4), kind: .major), MusicScale(tonic: n(1, 4), kind: .major)],
        [MusicScale(tonic: n(6, 4, -1), kind: .major), MusicScale(tonic: n(5, 4), kind: .naturalMinor),
         MusicScale(tonic: n(2, 4), kind: .naturalMinor), MusicScale(tonic: n(1, 4), kind: .naturalMinor)],
    ]
    static var all: [MusicScale] { fresh.flatMap { $0 } }
    static func upTo(_ level: Int) -> [MusicScale] { level >= 4 ? all : Array(fresh.prefix(level).flatMap { $0 }) }
    static func scale(_ level: Int, _ random: inout LearnRandom) -> MusicScale? {
        MusicKit.draw(fresh: level >= 4 ? all : fresh[level - 1], all: upTo(level), level: level, &random)
    }

    private static func names(_ scale: MusicScale) -> [String] { scale.notes.map(\.germanName) }

    /// A degree (2 to 7) of the scale, most often one with a sign.
    private static func degree(of scale: MusicScale, _ random: inout LearnRandom) -> Int? {
        let notes = scale.notes
        let signed = (1...6).filter { notes[$0].alteration != 0 }
        if !signed.isEmpty, Int.random(in: 0..<10, using: &random) < 6 { return signed.randomElement(using: &random) }
        return (1...6).randomElement(using: &random)
    }

    static func missing(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = scale(level, &random), let d = degree(of: s, &random) else { return nil }
        let notes = s.notes
        let shown = notes.enumerated().map { $0.offset == d ? "?" : $0.element.germanName }.joined(separator: " – ")
        let wrong = MusicKit.wrongNames(for: notes[d], &random)
        return Exercises.choice(
            id: "\(tag).missing.\(s.name).\(d)", key: "music.scale.\(s.name)", prompt: "\(s.name): \(shown). Welcher Ton fehlt?", correct: notes[d].germanName, wrong: wrong,
            explanation: "In \(s.name) ist der \(d + 1). Ton \(notes[d].germanName): Jeder Buchstabe kommt einmal vor, und die Halbtonschritte sitzen richtig.", using: &random
        )
    }

    static func degreeType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = scale(level, &random), let d = degree(of: s, &random) else { return nil }
        let answer = s.notes[d]
        return MusicKit.typedNote(
            id: "\(tag).degree.\(s.name).\(d)", key: "music.scale.\(s.name)", prompt: "Wie heißt der \(d + 1). Ton der \(s.name)-Tonleiter?", answer: answer,
            explanation: "\(s.name): " + names(s).joined(separator: " ") + "."
        )
    }

    static func scaleStaff(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = scale(level, &random) else { return nil }
        let others = all.filter { $0.name != s.name }.shuffled(using: &random)
        let sameTonic = others.filter { $0.tonic.letter == s.tonic.letter && $0.tonic.alteration == s.tonic.alteration }
        let wrong = (sameTonic + others).map(\.name)
        return Exercises.choice(
            id: "\(tag).staff.\(s.name)", key: "music.scale.\(s.name)", prompt: "Welche Tonleiter ist das?", correct: s.name, wrong: wrong,
            explanation: "Die Töne sind " + names(s).joined(separator: " ") + ".", media: MusicKit.staff(.treble, s.notes), using: &random
        )
    }

    static func kind(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = scale(level, &random) else { return nil }
        let isMajor = s.kind == .major
        return Exercises.choice(
            id: "\(tag).kind.\(s.name)", key: "music.scale.\(s.name)", prompt: "Ist das eine Dur- oder eine Molltonleiter?", correct: isMajor ? "Dur" : "Moll",
            wrong: [isMajor ? "Moll" : "Dur"],
            explanation: isMajor ? "Der dritte Ton liegt eine große Terz über dem Grundton: Dur." : "Der dritte Ton liegt eine kleine Terz über dem Grundton: Moll.",
            media: MusicKit.staff(.treble, s.notes), using: &random
        )
    }

    static func scaleBank(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = scale(level, &random) else { return nil }
        let notes = Array(s.notes.dropLast())
        var extra: [String] = []
        for d in [3, 6, 2] { extra += MusicKit.wrongNames(for: notes[d], &random).prefix(2) }
        return Exercises.bank(
            id: "\(tag).bank.\(s.name)", key: "music.scale.\(s.name)", prompt: "Baue die \(s.name)-Tonleiter. Lege die Töne der Reihe nach.",
            words: notes.map(\.germanName), extra: extra, explanation: "Das Muster der Ganz- und Halbtonschritte bestimmt die Vorzeichen.", using: &random
        )
    }

    static func accChoice(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = scale(level, &random), let count = s.accidentalCount else { return nil }
        let wrong = [count + 1, count - 1, -count, count + 2].filter { $0 != count && abs($0) <= 3 }.map { MusicKit.signNames($0) }
        return Exercises.choice(
            id: "\(tag).acc.\(s.name)", key: "music.scale.\(s.name)", prompt: "Welche Vorzeichen hat \(s.name)?", correct: MusicKit.signNames(count), wrong: wrong,
            explanation: "\(s.name) hat die Töne " + names(s).dropLast().joined(separator: " ") + ".", using: &random
        )
    }

    static func pairsAcc(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let majors = upTo(level == 3 ? 4 : level).filter { $0.kind == .major }
        let chosen = Array(majors.shuffled(using: &random).prefix(4))
        guard chosen.count == 4 else { return nil }
        let items = chosen.compactMap { s -> (key: String, front: String, back: String)? in
            guard let count = s.accidentalCount else { return nil }
            return (key: "music.scale.\(s.name)", front: s.name, back: MusicKit.signNames(count))
        }
        return Exercises.pairs(id: "\(tag).pairs." + chosen.map(\.name).sorted().joined(separator: "-"), prompt: "Welche Vorzeichen gehören dazu?", items: items, using: &random)
    }

    static func patternBank(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let major = level < 3 || Bool.random(using: &random)
        let words = major ? ["ganz", "ganz", "halb", "ganz", "ganz", "ganz", "halb"] : ["ganz", "halb", "ganz", "ganz", "halb", "ganz", "ganz"]
        return Exercises.bank(
            id: "\(tag).pattern.\(major ? "dur" : "moll")", key: "music.pattern.\(major ? "dur" : "moll")",
            prompt: "Lege die Schritte der \(major ? "Dur" : "natürlichen Moll")tonleiter der Reihe nach.", words: words,
            explanation: major ? "Dur: ganz, ganz, halb, ganz, ganz, ganz, halb." : "Natürliches Moll: ganz, halb, ganz, ganz, halb, ganz, ganz.", using: &random
        )
    }

    static func fact(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        MusicKit.fact(facts, level: level, tag: tag, &random)
    }

    static let facts: [MusicFact] = [
        MusicFact("pattern", level: 1, "Welches Stufenmuster hat jede Durtonleiter?", correct: "ganz, ganz, halb, ganz, ganz, ganz, halb",
                  wrong: ["ganz, halb, ganz, ganz, halb, ganz, ganz", "ganz, ganz, ganz, halb, ganz, ganz, halb", "halb, ganz, ganz, ganz, halb, ganz, ganz"],
                  explanation: "Das ist das Muster von C-Dur auf den weißen Tasten."),
        MusicFact("halfSteps", level: 1, "Zwischen welchen Stufen liegen in Dur die Halbtonschritte?", correct: "3.–4. und 7.–8. Stufe",
                  wrong: ["2.–3. und 5.–6. Stufe", "1.–2. und 4.–5. Stufe", "4.–5. und 7.–8. Stufe"], explanation: "In C-Dur sind es E–F und H–C."),
        MusicFact("cdur", level: 1, "Welche Tasten braucht die C-Dur-Tonleiter?", correct: "nur weiße Tasten",
                  wrong: ["eine schwarze Taste", "zwei schwarze Tasten", "nur schwarze Tasten"], explanation: "C D E F G A H C haben keine Vorzeichen."),
        MusicFact("fis", level: 1, "Warum hat G-Dur ein Fis?", correct: "Sonst läge zwischen 7. Ton und Grundton ein Ganzton.",
                  wrong: ["Sonst wäre die Tonleiter zu tief.", "Weil G-Dur mit einem Be beginnt.", "Weil Dur immer ein Kreuz braucht."],
                  explanation: "Vor dem Grundton muss ein Halbton liegen: Fis–G."),
        MusicFact("letters", level: 2, "Warum heißt der vierte Ton von F-Dur B und nicht Ais?", correct: "Nach A kommt in der Tonleiter der Buchstabe H.",
                  wrong: ["Weil B tiefer klingt als Ais.", "Weil F-Dur Kreuze braucht."], explanation: "Jeder Buchstabe kommt in einer Tonleiter genau einmal vor."),
        MusicFact("bflat", level: 2, "Welcher Ton ist in F-Dur anders als in C-Dur?", correct: "B statt H", wrong: ["Fis statt F", "Es statt E", "Cis statt C"],
                  explanation: "Damit der Halbton zwischen 3. und 4. Stufe liegt, wird H zu B."),
        MusicFact("dsharp", level: 2, "Welche Vorzeichen hat D-Dur?", correct: "Fis und Cis", wrong: ["Fis", "B und Es", "Cis und Gis"],
                  explanation: "D E Fis G A H Cis D."),
        MusicFact("minorPattern", level: 3, "Welches Stufenmuster hat die natürliche Molltonleiter?", correct: "ganz, halb, ganz, ganz, halb, ganz, ganz",
                  wrong: ["ganz, ganz, halb, ganz, ganz, ganz, halb", "ganz, halb, ganz, ganz, ganz, halb, ganz", "halb, ganz, ganz, halb, ganz, ganz, ganz"],
                  explanation: "Das Muster entspricht den weißen Tasten von A nach A."),
        MusicFact("minorHalf", level: 3, "Zwischen welchen Stufen liegen in natürlichem Moll die Halbtonschritte?", correct: "2.–3. und 5.–6. Stufe",
                  wrong: ["3.–4. und 7.–8. Stufe", "1.–2. und 4.–5. Stufe", "2.–3. und 6.–7. Stufe"], explanation: "In A-Moll sind es H–C und E–F."),
        MusicFact("minorThird", level: 3, "Woran erkennt man Moll am schnellsten?", correct: "an der kleinen Terz über dem Grundton",
                  wrong: ["an der großen Terz über dem Grundton", "an der Quinte", "an dem Halbton am Ende"], explanation: "Der dritte Ton liegt in Moll nur drei Halbtöne über dem Grundton."),
        MusicFact("bdur", level: 3, "Welche Vorzeichen hat B-Dur?", correct: "B und Es", wrong: ["nur B", "Fis und Cis", "B, Es und As"], explanation: "B C D Es F G A B."),
    ]

    static let def = MusicUnitDef(
        makers: [
            "fact": fact, "missing": missing, "degree": degreeType, "scaleStaff": scaleStaff, "kind": kind, "scaleBank": scaleBank,
            "accChoice": accChoice, "pairsAcc": pairsAcc, "patternBank": patternBank,
        ],
        lessons: [
            ["fact", "fact", "patternBank", "missing", "missing", "scaleStaff", "scaleStaff", "scaleBank", "degree", "degree"],
            ["fact", "missing", "missing", "missing", "scaleStaff", "scaleStaff", "scaleBank", "degree", "degree", "accChoice", "pairsAcc"],
            ["fact", "fact", "kind", "kind", "missing", "scaleStaff", "scaleStaff", "scaleBank", "degree", "degree", "patternBank"],
        ],
        practice: ["fact", "missing", "missing", "scaleStaff", "kind", "scaleBank", "degree", "degree", "accChoice", "pairsAcc", "~", "~"],
        checkpoint: ["fact", "fact", "missing", "missing", "scaleStaff", "scaleStaff", "kind", "scaleBank", "degree", "degree", "accChoice", "accChoice", "pairsAcc", "patternBank"],
        review: ["missing", "scaleStaff", "degree", "accChoice"]
    )
}
