import Foundation

/// Unit 8: key signatures, the circle of fifths and relative minor keys.
enum MusicUnit8 {
    static let tag = "music.u08"
    private static func n(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch { MusicKit.note(letter, octave, alteration) }

    static let freshCounts: [[Int]] = [[0, 1, -1, 2, -2], [3, -3, 4, -4], []]
    static func upTo(_ level: Int) -> [Int] { level >= 3 ? Array(-4...4) : Array(freshCounts.prefix(level).flatMap { $0 }) }
    static func count(_ level: Int, _ random: inout LearnRandom) -> Int? {
        MusicKit.draw(fresh: level >= 4 ? Array(-4...4) : freshCounts[level - 1], all: upTo(level), level: level, &random)
    }

    private static func other(_ count: Int, _ deltas: [Int]) -> [Int] {
        deltas.map { count + $0 }.filter { abs($0) <= 5 && $0 != count }
    }

    private static func restStaff(_ key: Int) -> ExerciseMedia {
        .staff(StaffSpec(clef: .treble, keySignature: key, time: nil, notes: [StaffNote(pitch: n(6, 4), value: .whole, isRest: true)]))
    }

    static func readKey(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(level, &random) else { return nil }
        let wrong = (other(c, [1, -1]) + (c == 0 ? [] : [-c]) + other(c, [2, -2])).map(MusicKey.majorName) + [MusicKey.minorName(c)]
        return Exercises.choice(
            id: "\(tag).read.\(c)", key: "music.key.\(c)", prompt: "Welche Dur-Tonart gehört zu dieser Vorzeichnung?", correct: MusicKey.majorName(c), wrong: wrong,
            explanation: "\(MusicKey.majorName(c)) hat \(MusicKit.signCount(c)).", media: restStaff(c), using: &random
        )
    }

    static func readMinor(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(max(level, 3), &random) else { return nil }
        let wrong = (other(c, [1, -1]) + (c == 0 ? [] : [-c]) + other(c, [2, -2])).map(MusicKey.minorName) + [MusicKey.majorName(c)]
        return Exercises.choice(
            id: "\(tag).readminor.\(c)", key: "music.key.\(c)", prompt: "Welche Molltonart gehört zu dieser Vorzeichnung?", correct: MusicKey.minorName(c), wrong: wrong,
            explanation: "\(MusicKey.minorName(c)) hat \(MusicKit.signCount(c)): dieselben wie \(MusicKey.majorName(c)).", media: restStaff(c), using: &random
        )
    }

    /// A note between E4 and G5 whose sign comes from the key signature.
    private static func keyedNote(_ c: Int, _ random: inout LearnRandom) -> Pitch? {
        var pool: [(Int, Int)] = [(2, 4), (3, 4), (4, 4), (5, 4), (6, 4), (0, 5), (1, 5), (2, 5), (3, 5), (4, 5)]
        let affected = pool.filter { MusicKey.alteration(letter: $0.0, count: c) != 0 }
        if !affected.isEmpty, Int.random(in: 0..<10, using: &random) < 7 { pool = affected }
        guard let (letter, octave) = pool.randomElement(using: &random) else { return nil }
        return n(letter, octave, MusicKey.alteration(letter: letter, count: c))
    }

    static func readNote(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(level, &random), c != 0, let p = keyedNote(c, &random) else { return nil }
        let wrong = MusicKit.wrongNames(for: p, &random)
        return Exercises.choice(
            id: "\(tag).note.\(c).\(p.scientificName)", key: "music.key.note.\(c)", prompt: "Wie heißt diese Note? Beachte die Vorzeichen am Anfang.", correct: p.germanName,
            wrong: wrong, explanation: "Mit der Vorzeichnung gilt: \(p.germanName).",
            media: .staff(StaffSpec(clef: .treble, keySignature: c, notes: [StaffNote(pitch: p)])), using: &random
        )
    }

    static func readNoteType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(level, &random), c != 0, let p = keyedNote(c, &random) else { return nil }
        return MusicKit.typedNote(
            id: "\(tag).notetype.\(c).\(p.scientificName)", key: "music.key.note.\(c)", prompt: "Schreibe den Namen dieser Note. Beachte die Vorzeichen am Anfang.", answer: p,
            explanation: "Mit der Vorzeichnung gilt: \(p.germanName).", media: .staff(StaffSpec(clef: .treble, keySignature: c, notes: [StaffNote(pitch: p)]))
        )
    }

    static func keyOfCount(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(level, &random), c != 0 else { return nil }
        let wrong = (other(c, [1, -1]) + [-c] + other(c, [2, -2])).map(MusicKey.majorName)
        return Exercises.choice(
            id: "\(tag).keyof.\(c)", key: "music.key.\(c)", prompt: "Welche Dur-Tonart hat \(MusicKit.signCount(c))?", correct: MusicKey.majorName(c), wrong: wrong,
            explanation: "\(MusicKey.majorName(c)) hat \(MusicKit.signCount(c)).", using: &random
        )
    }

    static func keyOfCountType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(level, &random), c != 0 else { return nil }
        return Exercises.typed(
            id: "\(tag).keyoftype.\(c)", key: "music.key.\(c)", prompt: "Welche Dur-Tonart hat \(MusicKit.signCount(c))?", answer: MusicKey.majorName(c), mode: .exact,
            explanation: "Von C-Dur aus \(abs(c)) Quinte" + (abs(c) == 1 ? "" : "n") + (c > 0 ? " aufwärts." : " abwärts.")
        )
    }

    static func countOfKey(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(level, &random) else { return nil }
        let wrong = (other(c, [1, -1]) + (c == 0 ? [] : [-c]) + other(c, [2, -2])).map(MusicKit.signCount)
        return Exercises.choice(
            id: "\(tag).count.\(c)", key: "music.key.\(c)", prompt: "Wie viele Vorzeichen hat \(MusicKey.majorName(c))?", correct: MusicKit.signCount(c), wrong: wrong,
            explanation: c == 0 ? "C-Dur hat keine Vorzeichen." : "Es sind: \(MusicKit.signNames(c)).", using: &random
        )
    }

    static func orderBank(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let sharps = Bool.random(using: &random)
        let names = MusicKey.accidentals(sharps ? 4 : -4).map(\.germanName)
        return Exercises.bank(
            id: "\(tag).order.\(sharps ? "sharps" : "flats")", key: "music.key.order.\(sharps ? "sharps" : "flats")",
            prompt: "Lege die ersten vier \(sharps ? "Kreuze" : "Be") in der Reihenfolge der Vorzeichnung.", words: names,
            explanation: sharps ? "Kreuze: Fis, Cis, Gis, Dis, Ais, Eis, His." : "Be: B, Es, As, Des, Ges, Ces, Fes.", using: &random
        )
    }

    static func relMinor(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(max(level, 3), &random) else { return nil }
        return Exercises.typed(
            id: "\(tag).relminor.\(c)", key: "music.key.rel.\(c)", prompt: "Welche Molltonart ist die Paralleltonart von \(MusicKey.majorName(c))?", answer: MusicKey.minorName(c), mode: .exact,
            explanation: "Der Grundton liegt eine kleine Terz tiefer; beide haben \(MusicKit.signCount(c))."
        )
    }

    static func relMinorChoice(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(max(level, 3), &random) else { return nil }
        let sameTonic = MusicKey.majorTonic(c).germanName + "-Moll"
        let wrong = [sameTonic] + (other(c, [1, -1]) + other(c, [2, -2])).map(MusicKey.minorName)
        return Exercises.choice(
            id: "\(tag).relminorchoice.\(c)", key: "music.key.rel.\(c)", prompt: "Welche Molltonart ist die Paralleltonart von \(MusicKey.majorName(c))?", correct: MusicKey.minorName(c),
            wrong: wrong, explanation: "Der Grundton liegt eine kleine Terz tiefer; beide haben \(MusicKit.signCount(c)).", using: &random
        )
    }

    static func relMajor(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let c = count(max(level, 3), &random) else { return nil }
        return Exercises.typed(
            id: "\(tag).relmajor.\(c)", key: "music.key.rel.\(c)", prompt: "Zu welcher Durtonart gehört \(MusicKey.minorName(c)) als Paralleltonart?", answer: MusicKey.majorName(c), mode: .exact,
            explanation: "Der Grundton der Durtonart liegt eine kleine Terz höher; beide haben \(MusicKit.signCount(c))."
        )
    }

    static func circle(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let up = Bool.random(using: &random) as Bool?, let c = count(max(level, 2), &random), abs(c + (up ? 1 : -1)) <= 4 else { return nil }
        let answer = c + (up ? 1 : -1)
        let wrong = [c + (up ? -1 : 1), c + (up ? 2 : -2), c + (up ? -2 : 2)].filter { abs($0) <= 5 }.map(MusicKey.majorName)
        return Exercises.choice(
            id: "\(tag).circle.\(c).\(up ? "up" : "down")", key: "music.key.circle.\(c)",
            prompt: "Welche Tonart liegt im Quintenzirkel eine Quinte \(up ? "über" : "unter") \(MusicKey.majorName(c))?", correct: MusicKey.majorName(answer), wrong: wrong,
            explanation: "Eine Quinte \(up ? "aufwärts bringt ein Kreuz mehr" : "abwärts bringt ein Be mehr"): \(MusicKey.majorName(answer)) hat \(MusicKit.signCount(answer)).", using: &random
        )
    }

    static func circleBank(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let up = Bool.random(using: &random)
        let words = (0...3).map { MusicKey.majorName(up ? $0 : -$0) }
        let extra = up ? [MusicKey.majorName(-1), MusicKey.majorName(-2)] : [MusicKey.majorName(1), MusicKey.majorName(2)]
        return Exercises.bank(
            id: "\(tag).circlebank.\(up ? "up" : "down")", key: "music.key.circle", prompt: "Lege die Tonarten in der Reihenfolge des Quintenzirkels, von C-Dur \(up ? "aufwärts" : "abwärts").",
            words: words, extra: extra, explanation: "Jede Quinte \(up ? "aufwärts bringt ein Kreuz mehr" : "abwärts bringt ein Be mehr").", using: &random
        )
    }

    static func pairsKeys(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let pool = upTo(level == 3 ? 4 : level).filter { $0 != 0 || level >= 3 }
        let chosen = Array(pool.shuffled(using: &random).prefix(4))
        guard chosen.count == 4 else { return nil }
        return Exercises.pairs(
            id: "\(tag).pairs." + chosen.sorted().map(String.init).joined(separator: "_"), prompt: "Welche Vorzeichen hat die Tonart?",
            items: chosen.map { (key: "music.key.\($0)", front: MusicKey.majorName($0), back: MusicKit.signCount($0)) }, using: &random
        )
    }

    static func pairsRel(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let chosen = Array(Array(-4...4).shuffled(using: &random).prefix(4))
        return Exercises.pairs(
            id: "\(tag).pairsrel." + chosen.sorted().map(String.init).joined(separator: "_"), prompt: "Welche Molltonart ist die Paralleltonart?",
            items: chosen.map { (key: "music.key.rel.\($0)", front: MusicKey.majorName($0), back: MusicKey.minorName($0)) }, using: &random
        )
    }

    static func fact(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        MusicKit.fact(facts, level: level, tag: tag, &random)
    }

    static let facts: [MusicFact] = [
        MusicFact("what", level: 1, "Was zeigt die Vorzeichnung am Anfang eines Stücks?", correct: "die Tonart", wrong: ["das Tempo", "die Taktart", "die Lautstärke"],
                  explanation: "Die Vorzeichen am Anfang gelten für das ganze Stück."),
        MusicFact("firstSharp", level: 1, "Welches Kreuz steht in der Vorzeichnung zuerst?", correct: "Fis", wrong: ["Cis", "Gis", "B"], explanation: "Die Kreuze folgen: Fis, Cis, Gis, Dis, Ais, Eis, His."),
        MusicFact("firstFlat", level: 1, "Welches Be steht in der Vorzeichnung zuerst?", correct: "B", wrong: ["Es", "As", "Fis"], explanation: "Die Be folgen: B, Es, As, Des, Ges, Ces, Fes."),
        MusicFact("none", level: 1, "Welche Durtonart hat keine Vorzeichen?", correct: "C-Dur", wrong: ["A-Dur", "G-Dur", "F-Dur"], explanation: "C-Dur nutzt nur weiße Tasten."),
        MusicFact("circleUp", level: 2, "Was ändert sich im Quintenzirkel bei jeder Quinte aufwärts?", correct: "Ein Kreuz kommt dazu (oder ein Be fällt weg).",
                  wrong: ["Ein Be kommt dazu (oder ein Kreuz fällt weg).", "Zwei Kreuze kommen dazu.", "Es ändert sich nichts."], explanation: "C-Dur, G-Dur (1 Kreuz), D-Dur (2 Kreuze) ..."),
        MusicFact("circleDown", level: 2, "Was ändert sich im Quintenzirkel bei jeder Quinte abwärts?", correct: "Ein Be kommt dazu (oder ein Kreuz fällt weg).",
                  wrong: ["Ein Kreuz kommt dazu (oder ein Be fällt weg).", "Zwei Be kommen dazu.", "Es ändert sich nichts."], explanation: "C-Dur, F-Dur (1 Be), B-Dur (2 Be) ..."),
        MusicFact("parallel", level: 3, "Was haben Paralleltonarten gemeinsam?", correct: "dieselben Vorzeichen",
                  wrong: ["denselben Grundton", "dieselbe Stufenfolge aus Ganz- und Halbtönen", "denselben Dreiklang"], explanation: "C-Dur und A-Moll haben beide keine Vorzeichen."),
        MusicFact("terz", level: 3, "Wo liegt der Grundton der Paralleltonart in Moll?", correct: "eine kleine Terz unter dem Grundton der Dur-Tonart",
                  wrong: ["eine große Terz unter dem Grundton der Dur-Tonart", "eine Quinte unter dem Grundton der Dur-Tonart", "eine kleine Terz über dem Grundton der Dur-Tonart"],
                  explanation: "C–A ist eine kleine Terz abwärts."),
        MusicFact("aMinor", level: 3, "Welche Molltonart hat keine Vorzeichen?", correct: "A-Moll", wrong: ["E-Moll", "D-Moll", "C-Moll"], explanation: "A-Moll ist die Paralleltonart von C-Dur."),
    ]

    static let def = MusicUnitDef(
        makers: [
            "fact": fact, "readKey": readKey, "readMinor": readMinor, "readNote": readNote, "readNoteType": readNoteType, "keyOfCount": keyOfCount,
            "keyOfCountType": keyOfCountType, "countOfKey": countOfKey, "orderBank": orderBank, "relMinor": relMinor, "relMinorChoice": relMinorChoice,
            "relMajor": relMajor, "circle": circle, "circleBank": circleBank, "pairsKeys": pairsKeys, "pairsRel": pairsRel,
        ],
        lessons: [
            ["fact", "fact", "readKey", "readKey", "readKey", "readNote", "readNote", "countOfKey", "orderBank", "keyOfCountType", "readNoteType"],
            ["fact", "fact", "readKey", "readKey", "readNote", "countOfKey", "keyOfCount", "circle", "circleBank", "pairsKeys", "keyOfCountType", "readNoteType"],
            ["fact", "fact", "relMinorChoice", "relMinorChoice", "readMinor", "relMinor", "relMinor", "relMajor", "pairsRel", "circle", "readKey"],
        ],
        practice: ["fact", "readKey", "readMinor", "readNote", "countOfKey", "keyOfCountType", "relMinor", "circle", "circleBank", "pairsKeys", "~", "~"],
        checkpoint: ["fact", "fact", "readKey", "readKey", "readMinor", "readNote", "readNoteType", "countOfKey", "keyOfCountType", "relMinor", "relMajor", "circle", "pairsKeys", "pairsRel"],
        review: ["readKey", "countOfKey", "relMinorChoice", "circle"]
    )
}
