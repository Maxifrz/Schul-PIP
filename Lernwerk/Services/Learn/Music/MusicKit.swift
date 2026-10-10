import Foundation

// Helpers the units of the music course share: a maker is one kind of exercise for a lesson level.

/// Makes one exercise. `level` is 1 to 3 for the three lessons of a unit and 4 for everything the unit teaches.
typealias MusicMaker = (inout LearnRandom, Int) -> LearnExercise?

/// A question with fixed wording, shown at one lesson level.
struct MusicFact {
    let id: String
    let level: Int
    let prompt: String
    let correct: String
    let wrong: [String]
    let explanation: String
    var media: ExerciseMedia?

    init(_ id: String, level: Int, _ prompt: String, correct: String, wrong: [String], explanation: String, media: ExerciseMedia? = nil) {
        self.id = id
        self.level = level
        self.prompt = prompt
        self.correct = correct
        self.wrong = wrong
        self.explanation = explanation
        self.media = media
    }
}

enum MusicKit {
    static func note(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch {
        Pitch(letter: letter, octave: octave, alteration: alteration)
    }

    static func staff(_ clef: Clef, _ pitches: [Pitch], key: Int = 0, time: String? = nil, value: NoteValue = .quarter, chord: Bool = false) -> ExerciseMedia {
        .staff(StaffSpec(clef: clef, keySignature: key, time: time, notes: pitches.map { StaffNote(pitch: $0, value: value) }, chord: chord))
    }

    static func pick<T>(_ items: [T], _ random: inout LearnRandom) -> T? {
        items.randomElement(using: &random)
    }

    /// An element of `fresh` most of the time on the lessons, anything taught so far otherwise; everything on level 4.
    static func draw<T>(fresh: [T], all: [T], level: Int, _ random: inout LearnRandom) -> T? {
        if level >= 4 || fresh.isEmpty { return all.randomElement(using: &random) }
        let useFresh = Int.random(in: 0..<10, using: &random) < 6
        return (useFresh ? fresh : all).randomElement(using: &random)
    }

    /// Wrong note names near the right one: the same letter with another sign, the neighbouring letters. Nothing that
    /// sounds like the right answer is among them.
    static func wrongNames(for correct: Pitch, naturalsOnly: Bool = false, _ random: inout LearnRandom) -> [String] {
        var candidates: [Pitch] = []
        let same = naturalsOnly ? [] : [correct.alteration - 1, correct.alteration + 1, 0].filter { $0 != correct.alteration && abs($0) <= 1 }
        for alteration in same { candidates.append(note(correct.letter, correct.octave, alteration)) }
        for step in [1, -1, 2, -2] {
            let letter = MusicMath.floorMod(correct.letter + step, 7)
            candidates.append(note(letter, correct.octave, naturalsOnly ? 0 : correct.alteration))
        }
        var seen: Set<String> = [correct.germanName]
        var result: [Pitch] = []
        for candidate in candidates where candidate.pitchClass != correct.pitchClass && seen.insert(candidate.germanName).inserted {
            result.append(candidate)
        }
        // The nearest ones first, but not always in the same order.
        let head = Array(result.prefix(3)).shuffled(using: &random)
        return (head + result.dropFirst(3)).map(\.germanName)
    }

    /// Wrong readings of a note on the staff: the name in the other clef first, then the neighbouring letters.
    static func wrongReadings(of pitch: Pitch, clef: Clef, otherClef: Clef?, naturalsOnly: Bool = false, _ random: inout LearnRandom) -> [String] {
        var result: [String] = []
        if let otherClef {
            let step = pitch.staffPosition(clef: clef).step
            let other = Pitch.atStep(step, clef: otherClef)
            if other.letter != pitch.letter { result.append(Pitch(letter: other.letter, octave: other.octave, alteration: pitch.alteration).germanName) }
        }
        result += wrongNames(for: pitch, naturalsOnly: naturalsOnly, &random)
        return result
    }

    /// "auf der 2. Linie", "im 1. Zwischenraum", "unter der 1. Linie" ...
    static func phrase(step: Int) -> String {
        switch step {
        case 0, 2, 4, 6, 8: return "auf der \(step / 2 + 1). Linie"
        case 1, 3, 5, 7: return "im \((step + 1) / 2). Zwischenraum"
        case -1: return "unter der 1. Linie"
        case -2: return "auf der 1. Hilfslinie unter dem System"
        case 9: return "über der 5. Linie"
        case 10: return "auf der 1. Hilfslinie über dem System"
        default: return "außerhalb des Systems"
        }
    }

    static func clefWord(_ clef: Clef) -> String {
        switch clef {
        case .treble: return "Violinschlüssel"
        case .bass: return "Bassschlüssel"
        case .alto: return "Altschlüssel"
        }
    }

    /// "Fis" or "Fis und Cis" or "Fis, Cis und Gis": the signs of a key signature.
    static func signNames(_ count: Int) -> String {
        let names = MusicKey.accidentals(count).map(\.germanName)
        if names.isEmpty { return "keine Vorzeichen" }
        if names.count == 1 { return names[0] }
        return names.dropLast().joined(separator: ", ") + " und " + names[names.count - 1]
    }

    /// "3 Kreuze", "1 Be", "keine Vorzeichen".
    static func signCount(_ count: Int) -> String {
        if count == 0 { return "keine Vorzeichen" }
        if count > 0 { return count == 1 ? "1 Kreuz" : "\(count) Kreuze" }
        return "\(-count) Be"
    }

    /// The text of a beat count: "4", "1/2", "1/4".
    static func beatText(_ fraction: (Int, Int)) -> String {
        fraction.1 == 1 ? "\(fraction.0)" : "\(fraction.0)/\(fraction.1)"
    }

    /// A choice from a list of fixed questions.
    static func fact(_ facts: [MusicFact], level: Int, tag: String, _ random: inout LearnRandom) -> LearnExercise? {
        let pool = facts.filter { level >= 4 || $0.level == level }
        guard let fact = pool.randomElement(using: &random) else { return nil }
        return Exercises.choice(
            id: "\(tag).fact.\(fact.id)", key: "\(tag).fact.\(fact.id)", prompt: fact.prompt, correct: fact.correct, wrong: fact.wrong,
            explanation: fact.explanation, media: fact.media, using: &random
        )
    }

    /// Notes of an octave range on the keyboard that have this name (every octave).
    static func keys(_ pitch: Pitch) -> [Int] { MusicNames.keys(pitchClass: pitch.pitchClass) }

    /// "das eingestrichene c", "das große C": the note in its octave, as the keyboard questions name it.
    static func octaveText(_ pitch: Pitch) -> String? {
        let name = pitch.germanName
        switch pitch.octave {
        case 2: return "das große \(name)"
        case 3: return "das kleine \(name.lowercased())"
        case 4: return "das eingestrichene \(name.lowercased())"
        case 5: return "das zweigestrichene \(name.lowercased())"
        default: return nil
        }
    }

    /// Typed note names: "Cis" and "cis" both count. The check is letter by letter, so "Cis" is never taken for "Dis".
    static func typedNote(
        id: String, key: String, prompt: String, answer: Pitch, explanation: String = "", media: ExerciseMedia? = nil
    ) -> LearnExercise? {
        Exercises.typed(id: id, key: key, prompt: prompt, answer: answer.germanName, mode: .exact, explanation: explanation, media: media)
    }
}
