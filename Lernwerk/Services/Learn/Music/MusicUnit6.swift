import Foundation

/// Unit 6: intervals, counted, named, built and heard.
enum MusicUnit6 {
    static let tag = "music.u06"
    private static func n(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch { MusicKit.note(letter, octave, alteration) }

    /// The interval of the standard table with this many half steps.
    static func interval(_ semitones: Int) -> MusicInterval? { MusicInterval.standard.first { $0.semitones == semitones } }

    static let freshSemis: [[Int]] = [[0, 2, 3, 4, 5, 7], [1, 2, 3, 4, 5, 7, 12], [8, 9, 10, 11]]
    static let upToSemis: [[Int]] = [[0, 1, 2, 3, 4, 5, 7], [0, 1, 2, 3, 4, 5, 7, 12], [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]]
    /// What the ear exercises of each lesson may play: only intervals the lessons so far have named.
    static let hearSemis: [[Int]] = [[], [2, 3, 4, 5, 7, 12], [3, 4, 5, 7, 8, 9, 10, 12]]
    static let hearAll = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]

    static func pickInterval(_ level: Int, _ random: inout LearnRandom) -> MusicInterval? {
        let fresh = level >= 4 ? upToSemis[2] : freshSemis[level - 1]
        let all = level >= 4 ? upToSemis[2] : upToSemis[level - 1]
        guard let semis = MusicKit.draw(fresh: fresh, all: all, level: level, &random) else { return nil }
        return interval(semis)
    }

    /// Two natural notes with this interval between them, the lower in the fourth octave.
    static func naturalPair(_ interval: MusicInterval, _ random: inout LearnRandom) -> (Pitch, Pitch)? {
        for letter in Array(0..<7).shuffled(using: &random) {
            let lower = n(letter, 4)
            let upper = interval.above(lower)
            if upper.alteration == 0 { return (lower, upper) }
        }
        return nil
    }

    private static func sentence(_ i: MusicInterval, _ lower: Pitch, _ upper: Pitch) -> String {
        "\(lower.germanName) bis \(upper.germanName): \(i.number) Töne gezählt, \(i.semitones) Halbtöne, also \(i.name ?? i.sizeName)."
    }

    /// Wrong answers for an interval: the same number with the other size, the neighbouring numbers and the inversion.
    static func wrongIntervals(_ i: MusicInterval, taught: [Int]) -> [MusicInterval] {
        let near = MusicInterval.standard.filter { other in
            other != i && (other.steps == i.steps || (abs(other.steps - i.steps) == 1 && abs(other.semitones - i.semitones) <= 2) || other == i.inverted)
        }
        return near.sorted { a, b in
            let ta = taught.contains(a.semitones), tb = taught.contains(b.semitones)
            return ta != tb ? ta : false
        }
    }

    static func num(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let i = pickInterval(level, &random), i.steps <= 6, let (lower, upper) = naturalPair(i, &random) else { return nil }
        var wrong: [String] = []
        for d in [1, -1, 2, -2] where (0...7).contains(i.steps + d) { wrong.append(MusicInterval.sizeNames[i.steps + d]) }
        wrong.append(MusicInterval.sizeNames[7 - i.steps])
        return Exercises.choice(
            id: "\(tag).num.\(lower.scientificName).\(upper.scientificName)", key: "music.interval.size.\(i.steps)",
            prompt: "Wie heißt dieses Intervall? Zähle beide Töne mit.", correct: i.sizeName, wrong: wrong,
            explanation: "Von \(lower.germanName) bis \(upper.germanName) sind es \(i.number) Töne: \(i.sizeName).",
            media: MusicKit.staff(.treble, [lower, upper]), using: &random
        )
    }

    static func numType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let i = pickInterval(level, &random), i.steps <= 6, let (lower, upper) = naturalPair(i, &random) else { return nil }
        return Exercises.typed(
            id: "\(tag).numtype.\(lower.scientificName).\(upper.scientificName)", key: "music.interval.size.\(i.steps)",
            prompt: "Wie heißt das Intervall von \(lower.germanName) nach \(upper.germanName)? Zähle beide Töne mit.", answer: i.sizeName, mode: .exact,
            explanation: "\(i.number) Töne gezählt: \(i.sizeName).", media: MusicKit.staff(.treble, [lower, upper])
        )
    }

    static func pairsNum(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let chosen = Array((1...6).shuffled(using: &random).prefix(4))
        let items = chosen.compactMap { steps -> (key: String, front: String, back: String)? in
            let upper = n(steps, 4)
            return (key: "music.interval.size.\(steps)", front: MusicInterval.sizeNames[steps], back: "C – \(upper.germanName)")
        }
        return Exercises.pairs(id: "\(tag).pairsnum." + chosen.sorted().map(String.init).joined(), prompt: "Welches Intervall liegt über C?", items: items, using: &random)
    }

    static func name(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let i = pickInterval(level, &random), let name = i.name, let (lower, upper) = naturalPair(i, &random) else { return nil }
        let taught = level >= 3 ? upToSemis[2] : upToSemis[1]
        let wrong = wrongIntervals(i, taught: taught).compactMap(\.name)
        return Exercises.choice(
            id: "\(tag).name.\(lower.scientificName).\(upper.scientificName)", key: "music.interval.\(i.semitones)", prompt: "Wie heißt dieses Intervall?",
            correct: name, wrong: wrong, explanation: sentence(i, lower, upper), media: MusicKit.staff(.treble, [lower, upper]), using: &random
        )
    }

    static func nameType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let i = pickInterval(level, &random), let name = i.name, let (lower, upper) = naturalPair(i, &random) else { return nil }
        let alternatives = name.hasPrefix("reine ") ? [i.sizeName] : []
        return Exercises.typed(
            id: "\(tag).nametype.\(lower.scientificName).\(upper.scientificName)", key: "music.interval.\(i.semitones)",
            prompt: "Wie heißt dieses Intervall? Schreibe den ganzen Namen.", answer: name, alternatives: alternatives, mode: .exact,
            explanation: sentence(i, lower, upper), media: MusicKit.staff(.treble, [lower, upper])
        )
    }

    static func semis(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let i = pickInterval(level, &random), let name = i.name else { return nil }
        let wrong = [i.semitones + 1, i.semitones - 1, i.semitones + 2, i.semitones - 2].filter { $0 >= 0 }.map(String.init)
        return Exercises.choice(
            id: "\(tag).semis.\(i.semitones)", key: "music.interval.\(i.semitones)", prompt: "Wie viele Halbtöne hat die \(name)?", correct: "\(i.semitones)", wrong: wrong,
            explanation: "Die \(name) umfasst \(i.semitones) Halbtöne.", using: &random
        )
    }

    static func semisType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let i = pickInterval(level, &random), let name = i.name else { return nil }
        return Exercises.typed(
            id: "\(tag).semistype.\(i.semitones)", key: "music.interval.\(i.semitones)", prompt: "Wie viele Halbtöne hat die \(name)? Schreibe eine Zahl.",
            answer: "\(i.semitones)", mode: .number, explanation: "Die \(name) umfasst \(i.semitones) Halbtöne."
        )
    }

    static func pairsSemis(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let pool = (level >= 3 ? upToSemis[2] : upToSemis[1]).filter { $0 > 0 }
        let chosen = Array(pool.shuffled(using: &random).prefix(4)).sorted()
        let items = chosen.compactMap { s -> (key: String, front: String, back: String)? in
            guard let name = interval(s)?.name else { return nil }
            return (key: "music.interval.\(s)", front: name, back: s == 1 ? "1 Halbton" : "\(s) Halbtöne")
        }
        return Exercises.pairs(id: "\(tag).pairssemis." + chosen.map(String.init).joined(separator: "-"), prompt: "Wie viele Halbtöne hat das Intervall?", items: items, using: &random)
    }

    private static let weird: Set<String> = ["Fes", "Ces", "Eis", "His"]

    /// A base note and an interval above it whose upper note has a plain name.
    private static func buildSetup(_ level: Int, _ random: inout LearnRandom) -> (base: Pitch, interval: MusicInterval, upper: Pitch)? {
        let naturals = (0..<7).map { n($0, 4) }
        let signs = [n(2, 4, -1), n(6, 4, -1), n(5, 4, -1), n(3, 4, 1)]
        for _ in 0..<30 {
            guard let base = MusicKit.pick(level >= 3 ? naturals + signs : naturals, &random),
                  let semis = MusicKit.draw(fresh: level >= 4 ? upToSemis[2] : freshSemis[level - 1], all: level >= 4 ? upToSemis[2] : upToSemis[level - 1], level: level, &random),
                  semis > 0, let i = interval(semis), i.name != nil else { continue }
            let upper = i.above(base)
            if abs(upper.alteration) <= 1, !weird.contains(upper.germanName) { return (base, i, upper) }
        }
        return nil
    }

    static func build(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = buildSetup(max(level, 2), &random), let name = s.interval.name else { return nil }
        return MusicKit.typedNote(
            id: "\(tag).build.\(s.base.germanName).\(s.interval.semitones)", key: "music.interval.\(s.interval.semitones)",
            prompt: "Baue eine \(name) über \(s.base.germanName). Welcher Ton ist das?", answer: s.upper,
            explanation: "Erst die Buchstaben zählen (\(s.interval.number) Töne), dann die Halbtöne anpassen: \(s.upper.germanName).",
            media: MusicKit.staff(.treble, [s.base])
        )
    }

    static func buildChoice(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = buildSetup(max(level, 2), &random), let name = s.interval.name else { return nil }
        let wrong = MusicKit.wrongNames(for: s.upper, &random)
        return Exercises.choice(
            id: "\(tag).buildchoice.\(s.base.germanName).\(s.interval.semitones)", key: "music.interval.\(s.interval.semitones)",
            prompt: "Welcher Ton liegt eine \(name) über \(s.base.germanName)?", correct: s.upper.germanName, wrong: wrong,
            explanation: "Erst die Buchstaben zählen (\(s.interval.number) Töne), dann die Halbtöne anpassen: \(s.upper.germanName).",
            media: MusicKit.staff(.treble, [s.base]), using: &random
        )
    }

    static func keyTap(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let s = buildSetup(2, &random), let name = s.interval.name else { return nil }
        return Exercises.key(
            id: "\(tag).key.\(s.base.germanName).\(s.interval.semitones)", key: "music.interval.\(s.interval.semitones)",
            prompt: "Tippe den Ton, der eine \(name) über \(s.base.germanName) liegt.", midi: MusicKit.keys(s.upper), solution: s.upper.germanName,
            explanation: "\(s.interval.semitones) Halbtöne über \(s.base.germanName) liegt \(s.upper.germanName).", media: MusicKit.staff(.treble, [s.base])
        )
    }

    static func hear(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let pool = level >= 4 ? hearAll : hearSemis[min(max(level, 2), 3) - 1]
        guard let semis = MusicKit.pick(pool, &random), let start = Array(55...67).randomElement(using: &random), let i = interval(semis), let name = i.name else { return nil }
        let wrong = pool.filter { $0 != semis }.shuffled(using: &random).compactMap { interval($0)?.name }
        return Exercises.choice(
            id: "\(tag).hear.\(start).\(semis)", key: "music.interval.\(semis)", prompt: "Hör hin: Welches Intervall erklingt?", correct: name, wrong: wrong,
            explanation: "Der zweite Ton liegt \(semis) Halbtöne über dem ersten: \(name).", media: .tones(ToneSpec(midi: [start, start + semis])), using: &random
        )
    }

    static func invert(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let pool = upToSemis[2].filter { (1...11).contains($0) && $0 != 6 }
        guard let semis = MusicKit.pick(pool, &random), let i = interval(semis), let name = i.name, let inverted = i.inverted.name else { return nil }
        var wrong = wrongIntervals(i.inverted, taught: upToSemis[2]).compactMap(\.name)
        if let own = i.name { wrong.insert(own, at: 0) }
        return Exercises.choice(
            id: "\(tag).invert.\(semis)", key: "music.interval.invert.\(semis)", prompt: "Welches Intervall entsteht, wenn man die \(name) umkehrt?",
            correct: inverted, wrong: wrong, explanation: "Intervall und Umkehrung ergeben zusammen eine Oktave: \(i.number) + \(i.inverted.number) = 9 gezählt, 12 Halbtöne.",
            using: &random
        )
    }

    static func order(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let pool = (level >= 3 ? upToSemis[2] : upToSemis[1]).filter { $0 > 0 }
        let chosen = Array(pool.shuffled(using: &random).prefix(4)).sorted()
        let words = chosen.compactMap { interval($0)?.name }
        return Exercises.bank(
            id: "\(tag).order." + chosen.map(String.init).joined(separator: "-"), key: "music.interval.order", prompt: "Ordne die Intervalle vom kleinsten zum größten.",
            words: words, explanation: "Je mehr Halbtöne, desto größer das Intervall.", using: &random
        )
    }

    static func fact(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        MusicKit.fact(facts, level: level, tag: tag, &random)
    }

    static let facts: [MusicFact] = [
        MusicFact("count", level: 1, "Wie zählt man ein Intervall?", correct: "Beide Töne zählen mit.",
                  wrong: ["Nur die Töne dazwischen zählen.", "Nur den oberen Ton zählen.", "Die Halbtöne zählen."], explanation: "C bis E: C, D, E sind drei Töne, also eine Terz."),
        MusicFact("prim", level: 1, "Wie heißt der Abstand zwischen zwei gleichen Tönen?", correct: "Prim", wrong: ["Sekunde", "Oktave", "Quinte"], explanation: "Ein einziger Ton ergibt gezählt die 1: die Prim."),
        MusicFact("octave", level: 1, "Wie viele Töne umfasst eine Oktave, wenn man beide Töne mitzählt?", correct: "8", wrong: ["7", "6", "12"], explanation: "Okto bedeutet acht: C D E F G A H C."),
        MusicFact("pure", level: 2, "Welche Intervalle heißen rein?", correct: "Prim, Quarte, Quinte und Oktave",
                  wrong: ["Sekunde, Terz, Sexte und Septime", "Terz und Sexte", "nur die Oktave"], explanation: "Sekunde, Terz, Sexte und Septime gibt es dagegen klein und groß."),
        MusicFact("majorMinor", level: 2, "Was unterscheidet eine große von einer kleinen Terz?", correct: "Die große Terz ist einen Halbton weiter.",
                  wrong: ["Die große Terz ist einen Ganzton weiter.", "Die große Terz hat einen Ton mehr.", "Die kleine Terz ist rein."], explanation: "Große Terz: 4 Halbtöne, kleine Terz: 3 Halbtöne."),
        MusicFact("tritone", level: 3, "Wie viele Halbtöne hat der Tritonus?", correct: "6", wrong: ["5", "7", "4"], explanation: "Der Tritonus besteht aus drei Ganztönen, also sechs Halbtönen."),
        MusicFact("tritoneWhole", level: 3, "Aus wie vielen Ganztönen besteht der Tritonus?", correct: "3", wrong: ["2", "4", "6"], explanation: "Tri bedeutet drei."),
        MusicFact("inversion", level: 3, "Wozu ergänzen sich ein Intervall und seine Umkehrung?", correct: "zu einer Oktave", wrong: ["zu einer Quinte", "zu einer Septime", "zu einer Prim"],
                  explanation: "Die große Terz und die kleine Sexte ergeben zusammen eine Oktave."),
    ]

    static let def = MusicUnitDef(
        makers: [
            "fact": fact, "num": num, "numType": numType, "pairsNum": pairsNum, "name": name, "nameType": nameType, "semis": semis,
            "semisType": semisType, "pairsSemis": pairsSemis, "build": build, "buildChoice": buildChoice, "keyTap": keyTap, "hear": hear,
            "invert": invert, "order": order,
        ],
        lessons: [
            ["fact", "fact", "num", "num", "num", "num", "numType", "numType", "pairsNum", "fact"],
            ["fact", "name", "name", "name", "nameType", "semis", "semisType", "hear", "hear", "hear", "pairsSemis", "keyTap"],
            ["fact", "fact", "name", "name", "build", "build", "buildChoice", "hear", "hear", "invert", "order", "nameType"],
        ],
        practice: ["fact", "num", "name", "nameType", "semis", "build", "buildChoice", "hear", "hear", "pairsSemis", "~", "~"],
        checkpoint: ["fact", "num", "name", "name", "nameType", "semis", "semisType", "build", "buildChoice", "hear", "hear", "invert", "order", "pairsSemis"],
        review: ["name", "nameType", "build", "hear"]
    )
}
