import Foundation

// The arithmetic behind the staff, the keyboard and the chess board. Plain Foundation, so the tests can check it
// without a screen; the views only draw what these return.

/// How a staff puts pitches, signs and stems.
enum StaffDrawingRules {
    enum Accidental: Equatable {
        case sharp, flat, natural, doubleSharp, doubleFlat
    }

    /// The diatonic number (octave * 7 + letter) of the bottom line: E4 in the treble clef, G2 in the bass clef,
    /// F3 in the alto clef.
    static func bottomLine(_ clef: Clef) -> Int {
        switch clef {
        case .treble: return 4 * 7 + 2
        case .bass: return 2 * 7 + 4
        case .alto: return 3 * 7 + 3
        }
    }

    /// Half staff spaces above the bottom line: 0 is the bottom line, 1 the first space, 8 the top line.
    static func step(of pitch: Pitch, clef: Clef) -> Int {
        pitch.diatonic - bottomLine(clef)
    }

    /// The even steps with a ledger line for a note on `step`: below the staff -2, -4, ... or above it 10, 12, ...
    static func ledgerSteps(for step: Int) -> [Int] {
        if step <= -2 { return stride(from: -2, through: step, by: -2).map { $0 } }
        if step >= 10 { return stride(from: 10, through: step, by: 2).map { $0 } }
        return []
    }

    /// The letters (0 = C ... 6 = H) of the sharps and of the flats in the order a key signature adds them.
    static let sharpLetters = [3, 0, 4, 1, 5, 2, 6]
    static let flatLetters = [6, 2, 5, 1, 4, 0, 3]

    /// Where the signs of a key signature sit: the step of each, in the order they are drawn.
    static func keySignature(_ count: Int, clef: Clef) -> [(step: Int, sharp: Bool)] {
        let n = min(7, abs(count))
        guard n > 0 else { return [] }
        // In the treble clef the sharps sit on F5 C5 G5 D5 A4 E5 B4, the flats on B4 E5 A4 D5 G4 C5 F4; the bass clef's
        // are two steps lower, the alto clef's one.
        let sharpSteps = [8, 5, 9, 6, 3, 7, 4]
        let flatSteps = [4, 7, 3, 6, 2, 5, 1]
        let shift: Int
        switch clef {
        case .treble: shift = 0
        case .bass: shift = -2
        case .alto: shift = -1
        }
        let steps = count > 0 ? sharpSteps : flatSteps
        return (0..<n).map { (step: steps[$0] + shift, sharp: count > 0) }
    }

    /// The alteration the key signature gives a letter: +1, -1 or 0.
    static func keyAlteration(letter: Int, key: Int) -> Int {
        let n = min(7, abs(key))
        guard n > 0 else { return 0 }
        let letters = key > 0 ? sharpLetters : flatLetters
        return letters.prefix(n).contains(letter) ? (key > 0 ? 1 : -1) : 0
    }

    /// The sign written before a note: none when the key signature already gives its alteration.
    static func accidental(for pitch: Pitch, key: Int) -> Accidental? {
        let expected = keyAlteration(letter: pitch.letter, key: key)
        guard pitch.alteration != expected else { return nil }
        switch pitch.alteration {
        case 1: return .sharp
        case -1: return .flat
        case 2: return .doubleSharp
        case -2: return .doubleFlat
        default: return .natural
        }
    }

    /// Stems go up for notes below the middle line and down from it (a chord follows its middle).
    static func stemUp(steps: [Int]) -> Bool {
        guard let low = steps.min(), let high = steps.max() else { return true }
        return Double(low + high) / 2 < 4
    }

    /// Chord notes a second apart cannot share a side of the stem; the upper one goes to the other side. The result
    /// has one flag per note, in the order given: true for the note that is moved.
    static func shifted(steps: [Int]) -> [Bool] {
        let order = steps.enumerated().sorted { $0.element < $1.element }
        var result = [Bool](repeating: false, count: steps.count)
        var previousShifted = false
        var previousStep: Int?
        for (index, step) in order {
            if let previousStep, step - previousStep == 1, !previousShifted {
                result[index] = true
                previousShifted = true
            } else {
                previousShifted = false
            }
            previousStep = step
        }
        return result
    }

    /// Flags a stem gets: one for an eighth, two for a sixteenth.
    static func flags(_ value: NoteValue) -> Int {
        switch value {
        case .eighth: return 1
        case .sixteenth: return 2
        default: return 0
        }
    }
}

/// The keys of a piano keyboard.
enum PianoLayout {
    static func isBlack(_ midi: Int) -> Bool {
        [1, 3, 6, 8, 10].contains(((midi % 12) + 12) % 12)
    }

    static func whiteKeys(in range: ClosedRange<Int>) -> [Int] {
        range.filter { !isBlack($0) }
    }

    /// The keys shown for an exercise: from the C below the lowest right key to the C above the highest, at least two
    /// octaves, within the piano.
    static func range(covering correct: [Int]) -> ClosedRange<Int> {
        guard let low = correct.min(), let high = correct.max() else { return 60...84 }
        var start = (low / 12) * 12
        var end = ((high + 11) / 12) * 12
        if end <= high { end += 12 }
        if end - start < 24 { end = start + 24 }
        start = max(12, start)
        end = min(108, max(end, start + 12))
        return start...end
    }

    /// Where a black key's center lies, in white-key widths from the left edge of the range: between its two
    /// neighbouring white keys, a little off center for the groups of three.
    static func blackKeyCenter(_ midi: Int, in range: ClosedRange<Int>) -> Double {
        let whitesBefore = whiteKeys(in: range.lowerBound...midi).count
        let pitchClass = ((midi % 12) + 12) % 12
        var offset = 0.0
        switch pitchClass {
        case 1: offset = -0.06
        case 3: offset = 0.06
        case 6: offset = -0.08
        case 10: offset = 0.08
        default: offset = 0
        }
        return Double(whitesBefore) + offset
    }

    /// The note's name for a spoken label: "C4", "F♯3".
    static func name(_ midi: Int) -> String {
        let names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "H"]
        return "\(names[((midi % 12) + 12) % 12])\(midi / 12 - 1)"
    }
}

/// The pieces of a position, read from the first field of a FEN.
struct BoardPlacement: Equatable {
    /// Rank 8 first; each row has eight entries, nil for an empty square.
    let rows: [[Character?]]

    init(fen: String) {
        let field = fen.split(separator: " ").first.map(String.init) ?? fen
        var rows: [[Character?]] = []
        for part in field.split(separator: "/") {
            var row: [Character?] = []
            for character in part {
                if let empty = character.wholeNumberValue, empty > 0 {
                    row += [Character?](repeating: nil, count: empty)
                } else {
                    row.append(character)
                }
            }
            rows.append(Array(row.prefix(8)) + [Character?](repeating: nil, count: max(0, 8 - row.count)))
        }
        while rows.count < 8 { rows.append([Character?](repeating: nil, count: 8)) }
        self.rows = Array(rows.prefix(8))
    }

    /// The piece on a square like "e4", as a FEN letter (uppercase is White).
    func piece(on square: String) -> Character? {
        guard let (file, rank) = BoardPlacement.coordinates(square) else { return nil }
        return rows[8 - rank][file]
    }

    /// File 0...7 (a to h) and rank 1...8 of a square name.
    static func coordinates(_ square: String) -> (Int, Int)? {
        let characters = Array(square)
        guard characters.count == 2, let file = "abcdefgh".firstIndex(of: characters[0]),
              let rank = characters[1].wholeNumberValue, (1...8).contains(rank) else { return nil }
        return ("abcdefgh".distance(from: "abcdefgh".startIndex, to: file), rank)
    }

    static func name(file: Int, rank: Int) -> String {
        "\(Array("abcdefgh")[file])\(rank)"
    }

    /// "Weiß" or "Schwarz", from the second field of the FEN; nil when it is missing.
    static func sideToMove(fen: String) -> String? {
        let fields = fen.split(separator: " ")
        guard fields.count > 1 else { return nil }
        return fields[1] == "b" ? "Schwarz" : (fields[1] == "w" ? "Weiß" : nil)
    }

    /// German name of a piece for VoiceOver: "weißer Springer".
    static func germanName(of piece: Character) -> String {
        let kind = Character(piece.lowercased())
        let names: [Character: String] = ["k": "König", "q": "Dame", "r": "Turm", "b": "Läufer", "n": "Springer", "p": "Bauer"]
        let color = piece.isUppercase ? "weiß" : "schwarz"
        // Dame is feminine: "weiße Dame", but "weißer Turm".
        return "\(color)\(kind == "q" ? "e" : "er") \(names[kind] ?? "Figur")"
    }
}
