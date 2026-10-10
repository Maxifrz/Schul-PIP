import Foundation

/// Unit 3: note values, rests and counting beats in a bar.
enum MusicUnit3 {
    static let tag = "music.u03"
    private static func n(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch { MusicKit.note(letter, octave, alteration) }

    static let freshValues: [[NoteValue]] = [[.whole, .half, .quarter], [.eighth, .sixteenth], []]
    static let allValues = NoteValue.ordered
    private static let pitches = [n(0, 5), n(1, 5), n(2, 5), n(4, 4), n(5, 4), n(6, 4)]

    static func values(upTo level: Int) -> [NoteValue] { level >= 2 ? allValues : freshValues[0] }

    static func value(_ level: Int, _ random: inout LearnRandom) -> NoteValue? {
        let fresh = level >= 4 ? allValues : freshValues[level - 1]
        return MusicKit.draw(fresh: fresh, all: values(upTo: level), level: level, &random)
    }

    private static func plural(_ value: NoteValue) -> String {
        switch value {
        case .whole: return "Ganze Noten"
        case .half: return "Halbe Noten"
        case .quarter: return "Viertelnoten"
        case .eighth: return "Achtelnoten"
        case .sixteenth: return "Sechzehntelnoten"
        }
    }

    private static func shortName(_ value: NoteValue) -> String {
        switch value {
        case .whole: return "Ganze"
        case .half: return "Halbe"
        case .quarter: return "Viertel"
        case .eighth: return "Achtel"
        case .sixteenth: return "Sechzehntel"
        }
    }

    private static func acceptedNames(_ value: NoteValue) -> [String] {
        switch value {
        case .whole: return ["Ganze", "Ganznote", "Ganzenote"]
        case .half: return ["Halbe", "Halbnote"]
        default: return [shortName(value)]
        }
    }

    private static func beats(_ value: NoteValue) -> String { MusicKit.beatText(MusicMeter(beats: 4, unit: 4).beats(of: value)) }

    /// The other values, the nearest in length first.
    private static func others(_ value: NoteValue) -> [NoteValue] {
        let index = allValues.firstIndex(of: value) ?? 0
        return allValues.filter { $0 != value }.sorted { abs((allValues.firstIndex(of: $0) ?? 0) - index) < abs((allValues.firstIndex(of: $1) ?? 0) - index) }
    }

    private static func single(_ value: NoteValue, rest: Bool, _ pitch: Pitch, time: String? = nil) -> ExerciseMedia {
        .staff(StaffSpec(clef: .treble, time: time, notes: [StaffNote(pitch: pitch, value: value, isRest: rest)]))
    }

    static func name(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let v = value(level, &random), let p = MusicKit.pick(pitches, &random) else { return nil }
        return Exercises.choice(
            id: "\(tag).name.\(v.rawValue).\(p.scientificName)", key: "music.value.\(v.rawValue)", prompt: "Wie heißt dieser Notenwert?",
            correct: v.noteName, wrong: others(v).map(\.noteName),
            explanation: "\(v.noteName): \(beats(v)) Schlag(e) im 4/4-Takt.", media: single(v, rest: false, p), using: &random
        )
    }

    static func nameRest(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let v = MusicKit.pick(allValues, &random) else { return nil }
        return Exercises.choice(
            id: "\(tag).rest.\(v.rawValue)", key: "music.rest.\(v.rawValue)", prompt: "Wie heißt diese Pause?", correct: v.restName,
            wrong: others(v).map(\.restName), explanation: "\(v.restName): sie dauert so lang wie die \(v.noteName).",
            media: single(v, rest: true, n(6, 4)), using: &random
        )
    }

    static func valueType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let v = value(level, &random), let p = MusicKit.pick(pitches, &random) else { return nil }
        return Exercises.typed(
            id: "\(tag).valuetype.\(v.rawValue).\(p.scientificName)", key: "music.value.\(v.rawValue)", prompt: "Wie heißt dieser Notenwert?",
            answer: v.noteName, alternatives: acceptedNames(v), mode: .exact, explanation: "\(v.noteName): \(beats(v)) Schlag(e) im 4/4-Takt.",
            media: single(v, rest: false, p)
        )
    }

    static func restType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let v = MusicKit.pick(allValues, &random) else { return nil }
        var alternatives: [String] = []
        if v == .whole { alternatives = ["Ganzpause", "Ganze"] } else if v == .half { alternatives = ["Halbpause", "Halbe"] } else { alternatives = [shortName(v)] }
        return Exercises.typed(
            id: "\(tag).resttype.\(v.rawValue)", key: "music.rest.\(v.rawValue)", prompt: "Wie heißt die Pause, die so lang ist wie eine \(v.noteName)?",
            answer: v.restName, alternatives: alternatives, mode: .exact, explanation: "Zu jedem Notenwert gibt es eine Pause gleicher Länge."
        )
    }

    static func beatsChoice(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let v = value(level, &random), let p = MusicKit.pick(pitches, &random) else { return nil }
        let wrong = others(v).map { beats($0) }
        return Exercises.choice(
            id: "\(tag).beats.\(v.rawValue).\(p.scientificName)", key: "music.value.\(v.rawValue)", prompt: "Wie viele Schläge dauert diese Note im 4/4-Takt?",
            correct: beats(v), wrong: wrong, explanation: "Im 4/4-Takt ist eine Viertelnote ein Schlag; die \(v.noteName) dauert \(beats(v)).",
            media: single(v, rest: false, p, time: "4/4"), using: &random
        )
    }

    static func beatsType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let v = value(level, &random) else { return nil }
        let text = beats(v)
        return Exercises.typed(
            id: "\(tag).beatstype.\(v.rawValue)", key: "music.value.\(v.rawValue)",
            prompt: "Wie viele Schläge dauert eine \(v.noteName) im 4/4-Takt? Schreibe eine Zahl.", answer: text, mode: .number,
            solution: "\(text) Schlag" + (text == "1" ? "" : "e"), explanation: "Eine Viertelnote ist ein Schlag; eine \(v.noteName) dauert \(text)."
        )
    }

    private static func ratios(_ level: Int) -> [(big: NoteValue, small: NoteValue, count: Int)] {
        let pool = values(upTo: level)
        var result: [(big: NoteValue, small: NoteValue, count: Int)] = []
        for big in pool {
            for small in pool where small.sixteenths < big.sixteenths { result.append((big, small, big.sixteenths / small.sixteenths)) }
        }
        return result
    }

    static func ratio(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let r = MusicKit.pick(ratios(level), &random) else { return nil }
        return Exercises.typed(
            id: "\(tag).ratio.\(r.big.rawValue).\(r.small.rawValue)", key: "music.ratio.\(r.big.rawValue).\(r.small.rawValue)",
            prompt: "Wie viele \(plural(r.small)) dauern so lang wie eine \(r.big.noteName)? Schreibe eine Zahl.", answer: "\(r.count)", mode: .number,
            explanation: "Jeder Notenwert ist halb so lang wie der vorige."
        )
    }

    static func ratioChoice(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let r = MusicKit.pick(ratios(level), &random) else { return nil }
        let wrong = [r.count * 2, r.count / 2, r.count + 1, r.count - 1, 3].filter { $0 > 0 && $0 != r.count }.map(String.init)
        return Exercises.choice(
            id: "\(tag).ratiochoice.\(r.big.rawValue).\(r.small.rawValue)", key: "music.ratio.\(r.big.rawValue).\(r.small.rawValue)",
            prompt: "Wie viele \(plural(r.small)) passen in eine \(r.big.noteName)?", correct: "\(r.count)", wrong: wrong,
            explanation: "Jeder Notenwert ist halb so lang wie der vorige.", using: &random
        )
    }

    static func pairs(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? { pairing(rest: false, level, &random) }
    static func pairsRest(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? { pairing(rest: true, level, &random) }

    private static func pairing(rest: Bool, _ level: Int, _ random: inout LearnRandom) -> LearnExercise? {
        let chosen = Array(allValues.shuffled(using: &random).prefix(4))
        let items = chosen.map { v -> (key: String, front: String, back: String) in
            let text = beats(v)
            return (key: "music.value.\(v.rawValue)", front: rest ? v.restName : v.noteName, back: text == "1" ? "1 Schlag" : "\(text) Schläge")
        }
        let fixed = items.map { item -> (key: String, front: String, back: String) in
            item.back == "1/2 Schläge" ? (item.key, item.front, "1/2 Schlag") : item.back == "1/4 Schläge" ? (item.key, item.front, "1/4 Schlag") : item
        }
        let id = "\(tag).pairs\(rest ? "rest" : "")." + chosen.map(\.rawValue).sorted().joined(separator: "-")
        return Exercises.pairs(id: id, prompt: "Wie lange dauert es im 4/4-Takt?", items: fixed, using: &random)
    }

    static func order(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        let pool = values(upTo: level)
        let count = min(4, pool.count)
        let chosen = Array(pool.shuffled(using: &random).prefix(count)).sorted { $0.sixteenths > $1.sixteenths }
        return Exercises.bank(
            id: "\(tag).order." + chosen.map(\.rawValue).joined(separator: "-"), key: "music.order",
            prompt: "Ordne die Notenwerte vom längsten zum kürzesten.", words: chosen.map(shortName),
            explanation: "Ganze, Halbe, Viertel, Achtel, Sechzehntel: jede Note ist halb so lang wie die davor.", using: &random
        )
    }

    /// A bar of notes and rests that needs exactly `missing` to be full.
    static func bar(meter: MusicMeter, missing: NoteValue, _ random: inout LearnRandom) -> [StaffNote]? {
        let choices: [NoteValue] = [.half, .quarter, .quarter, .eighth]
        for _ in 0..<30 {
            var remaining = meter.barSixteenths - missing.sixteenths
            var notes: [StaffNote] = []
            while remaining > 0, notes.count <= 5 {
                let usable = choices.filter { $0.sixteenths <= remaining }
                guard let value = usable.randomElement(using: &random), let pitch = MusicKit.pick(pitches, &random) else { break }
                let isRest = Int.random(in: 0..<4, using: &random) == 0
                notes.append(StaffNote(pitch: isRest ? n(6, 4) : pitch, value: value, isRest: isRest))
                remaining -= value.sixteenths
            }
            if remaining == 0, (1...5).contains(notes.count) { return notes }
        }
        return nil
    }

    private static func barSetup(_ random: inout LearnRandom, _ level: Int, wholeBeatsOnly: Bool) -> (meter: MusicMeter, missing: NoteValue, notes: [StaffNote])? {
        let meters = [MusicMeter(beats: 4, unit: 4), MusicMeter(beats: 3, unit: 4)]
        let missings: [NoteValue] = wholeBeatsOnly ? [.half, .quarter] : [.half, .quarter, .eighth]
        guard let meter = MusicKit.pick(meters, &random), let missing = MusicKit.pick(missings, &random),
              let notes = bar(meter: meter, missing: missing, &random) else { return nil }
        return (meter, missing, notes)
    }

    private static func signature(_ notes: [StaffNote]) -> String {
        notes.map { ($0.isRest ? "r" : "n") + $0.value.rawValue.prefix(2) }.joined(separator: "-")
    }

    static func fill(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let setup = barSetup(&random, level, wholeBeatsOnly: false) else { return nil }
        let media = ExerciseMedia.staff(StaffSpec(clef: .treble, time: setup.meter.text, notes: setup.notes))
        return Exercises.choice(
            id: "\(tag).fill.\(setup.meter.beats).\(setup.missing.rawValue).\(signature(setup.notes))", key: "music.fill",
            prompt: "Im \(setup.meter.text)-Takt fehlt noch eine Note. Welcher Notenwert macht den Takt voll?",
            correct: setup.missing.noteName, wrong: others(setup.missing).map(\.noteName),
            explanation: "Der \(setup.meter.text)-Takt hat \(setup.meter.beats) Viertel; mit der \(setup.missing.noteName) wird er genau voll.",
            media: media, using: &random
        )
    }

    static func fillType(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let setup = barSetup(&random, level, wholeBeatsOnly: false) else { return nil }
        let media = ExerciseMedia.staff(StaffSpec(clef: .treble, time: setup.meter.text, notes: setup.notes))
        return Exercises.typed(
            id: "\(tag).filltype.\(setup.meter.beats).\(setup.missing.rawValue).\(signature(setup.notes))", key: "music.fill",
            prompt: "Welcher Notenwert fehlt, damit der \(setup.meter.text)-Takt voll ist?", answer: setup.missing.noteName,
            alternatives: acceptedNames(setup.missing), mode: .exact,
            explanation: "Der \(setup.meter.text)-Takt hat \(setup.meter.beats) Viertel; mit der \(setup.missing.noteName) wird er genau voll.", media: media
        )
    }

    static func beatsInBar(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        guard let setup = barSetup(&random, level, wholeBeatsOnly: true) else { return nil }
        let total = (setup.meter.barSixteenths - setup.missing.sixteenths) / 4
        let media = ExerciseMedia.staff(StaffSpec(clef: .treble, time: setup.meter.text, notes: setup.notes))
        return Exercises.typed(
            id: "\(tag).barbeats.\(setup.meter.beats).\(setup.missing.rawValue).\(signature(setup.notes))", key: "music.fill",
            prompt: "Wie viele Schläge dauern diese Noten und Pausen zusammen? Schreibe eine Zahl.", answer: "\(total)", mode: .number,
            explanation: "Zähle Noten und Pausen zusammen: eine Viertel ist ein Schlag.", media: media
        )
    }

    static func fact(_ random: inout LearnRandom, _ level: Int) -> LearnExercise? {
        MusicKit.fact(facts, level: level, tag: tag, &random)
    }

    static let facts: [MusicFact] = [
        MusicFact("valueWord", level: 1, "Wie nennt man die Länge eines Tons in der Notenschrift?", correct: "Notenwert",
                  wrong: ["Tonhöhe", "Lautstärke", "Tonart"], explanation: "Der Notenwert sagt, wie lange ein Ton dauert."),
        MusicFact("whole", level: 1, "Welche Note dauert im 4/4-Takt einen ganzen Takt?", correct: "Ganze Note",
                  wrong: ["Halbe Note", "Viertelnote", "Achtelnote"], explanation: "Die Ganze Note dauert vier Schläge: so viele, wie der 4/4-Takt hat."),
        MusicFact("half", level: 2, "Welche Note ist halb so lang wie eine Viertelnote?", correct: "Achtelnote",
                  wrong: ["Halbe Note", "Sechzehntelnote", "Ganze Note"], explanation: "Zwei Achtel dauern so lang wie eine Viertelnote."),
        MusicFact("restMeaning", level: 2, "Was bedeutet eine Pause?", correct: "Stille für die Länge des Notenwerts",
                  wrong: ["Der Ton wird länger gehalten", "Der Ton wird lauter", "Das Stück ist zu Ende"], explanation: "In der Pause klingt nichts, aber sie wird mitgezählt."),
        MusicFact("beats44", level: 3, "Wie viele Viertel hat ein 4/4-Takt?", correct: "4", wrong: ["3", "2", "8"], explanation: "Die obere Zahl 4 zählt die Schläge, die untere 4 meint Viertel."),
        MusicFact("beats34", level: 3, "Wie viele Schläge hat ein 3/4-Takt?", correct: "3", wrong: ["4", "2", "6"], explanation: "Die obere Zahl nennt die Schläge pro Takt."),
        MusicFact("lower", level: 3, "Was sagt die untere Zahl der Taktangabe 3/4?", correct: "Ein Schlag ist eine Viertelnote.",
                  wrong: ["Ein Schlag ist eine Halbe Note.", "Ein Schlag ist eine Achtelnote.", "Der Takt hat vier Schläge."],
                  explanation: "Die untere 4 steht für Viertel."),
        MusicFact("upper", level: 3, "Was sagt die obere Zahl der Taktangabe 4/4?", correct: "Der Takt hat vier Schläge.",
                  wrong: ["Der Takt hat zwei Schläge.", "Das Stück hat vier Teile.", "Ein Schlag ist eine Halbe Note."],
                  explanation: "Die obere Zahl zählt die Schläge pro Takt."),
        MusicFact("eighths34", level: 3, "Wie viele Achtelnoten passen in einen 3/4-Takt?", correct: "6", wrong: ["3", "4", "8"],
                  explanation: "Drei Viertel sind sechs Achtel."),
        MusicFact("barline", level: 3, "Was trennt zwei Takte voneinander?", correct: "der Taktstrich", wrong: ["die Hilfslinie", "der Bogen", "der Schlüssel"],
                  explanation: "Der Taktstrich steht senkrecht im Notensystem."),
    ]

    static let def = MusicUnitDef(
        makers: [
            "fact": fact, "name": name, "nameRest": nameRest, "valueType": valueType, "restType": restType, "beats": beatsChoice,
            "beatsType": beatsType, "ratio": ratio, "ratioChoice": ratioChoice, "pairs": pairs, "pairsRest": pairsRest, "order": order,
            "fill": fill, "fillType": fillType, "beatsInBar": beatsInBar,
        ],
        lessons: [
            ["fact", "name", "name", "beats", "beatsType", "beatsType", "ratio", "ratio", "order", "valueType"],
            ["fact", "name", "nameRest", "nameRest", "ratioChoice", "ratio", "pairs", "pairsRest", "order", "restType", "valueType"],
            ["fact", "fact", "fill", "fill", "fill", "beatsInBar", "beatsInBar", "fillType", "fillType", "order"],
        ],
        practice: ["fact", "name", "nameRest", "beats", "ratio", "ratioChoice", "pairs", "order", "fill", "beatsInBar", "~", "~"],
        checkpoint: ["fact", "name", "nameRest", "beats", "beatsType", "ratio", "ratioChoice", "pairs", "pairsRest", "order", "fill", "fill", "beatsInBar", "fillType"],
        review: ["name", "beats", "ratio", "pairs"]
    )
}
