import XCTest
@testable import Lernwerk

final class MediaRulesTests: XCTestCase {
    private func pitch(_ letter: Int, _ octave: Int, _ alteration: Int = 0) -> Pitch {
        Pitch(letter: letter, octave: octave, alteration: alteration)
    }

    func testSteps() {
        // Treble clef: E4 bottom line, G4 second line, F5 top line, middle C one ledger line below.
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(2, 4), clef: .treble), 0)
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(4, 4), clef: .treble), 2)
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(3, 5), clef: .treble), 8)
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(0, 4), clef: .treble), -2)
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(5, 5), clef: .treble), 10)
        // Bass clef: G2 bottom line, A3 top line, middle C one ledger line above.
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(4, 2), clef: .bass), 0)
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(5, 3), clef: .bass), 8)
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(0, 4), clef: .bass), 10)
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(3, 3), clef: .bass), 6, "F3 on the fourth line")
        // Alto clef: F3 bottom line, C4 on the middle line.
        XCTAssertEqual(StaffDrawingRules.step(of: pitch(0, 4), clef: .alto), 4)
    }

    func testLedgerLines() {
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: 0), [])
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: 8), [])
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: -1), [])
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: -2), [-2])
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: -3), [-2], "a note in the space under the first ledger line")
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: -6), [-2, -4, -6])
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: 9), [])
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: 10), [10])
        XCTAssertEqual(StaffDrawingRules.ledgerSteps(for: 13), [10, 12])
    }

    func testKeySignatures() {
        XCTAssertTrue(StaffDrawingRules.keySignature(0, clef: .treble).isEmpty)
        // G major: F♯ on the top line. D major: F♯ and C♯.
        XCTAssertEqual(StaffDrawingRules.keySignature(1, clef: .treble).map(\.step), [8])
        XCTAssertEqual(StaffDrawingRules.keySignature(2, clef: .treble).map(\.step), [8, 5])
        XCTAssertTrue(StaffDrawingRules.keySignature(2, clef: .treble).allSatisfy(\.sharp))
        // F major: B♭ on the middle line. E-flat major: B♭, E♭, A♭.
        XCTAssertEqual(StaffDrawingRules.keySignature(-1, clef: .treble).map(\.step), [4])
        XCTAssertEqual(StaffDrawingRules.keySignature(-3, clef: .treble).map(\.step), [4, 7, 3])
        XCTAssertTrue(StaffDrawingRules.keySignature(-3, clef: .treble).allSatisfy { !$0.sharp })
        // Bass clef: two steps lower, so F♯ sits on the fourth line.
        XCTAssertEqual(StaffDrawingRules.keySignature(1, clef: .bass).map(\.step), [6])
        XCTAssertEqual(StaffDrawingRules.keySignature(-1, clef: .bass).map(\.step), [2])
        XCTAssertEqual(StaffDrawingRules.keySignature(7, clef: .treble).count, 7)
        XCTAssertEqual(StaffDrawingRules.keySignature(9, clef: .treble).count, 7)
        // All signs of the treble clef lie inside or just beside the staff.
        for key in -7...7 {
            for sign in StaffDrawingRules.keySignature(key, clef: .treble) { XCTAssertTrue((0...9).contains(sign.step), "\(key): \(sign.step)") }
        }
        // The steps of the signs agree with the letters: a sharp's step belongs to the letter the order names.
        for (index, letter) in StaffDrawingRules.sharpLetters.enumerated() {
            let step = StaffDrawingRules.keySignature(index + 1, clef: .treble)[index].step
            XCTAssertEqual(((30 + step) % 7), letter, "sharp \(index + 1)")
        }
        for (index, letter) in StaffDrawingRules.flatLetters.enumerated() {
            let step = StaffDrawingRules.keySignature(-(index + 1), clef: .treble)[index].step
            XCTAssertEqual(((30 + step) % 7), letter, "flat \(index + 1)")
        }
    }

    func testAccidentalsFollowTheKeySignature() {
        // In D major (two sharps) F and C are sharp already.
        XCTAssertNil(StaffDrawingRules.accidental(for: pitch(3, 4, 1), key: 2))
        XCTAssertEqual(StaffDrawingRules.accidental(for: pitch(3, 4), key: 2), .natural)
        XCTAssertEqual(StaffDrawingRules.accidental(for: pitch(4, 4, 1), key: 2), .sharp)
        XCTAssertNil(StaffDrawingRules.accidental(for: pitch(4, 4), key: 2))
        // In F major B is flat.
        XCTAssertNil(StaffDrawingRules.accidental(for: pitch(6, 4, -1), key: -1))
        XCTAssertEqual(StaffDrawingRules.accidental(for: pitch(6, 4), key: -1), .natural)
        XCTAssertEqual(StaffDrawingRules.accidental(for: pitch(1, 4, -1), key: 0), .flat)
        XCTAssertNil(StaffDrawingRules.accidental(for: pitch(1, 4), key: 0))
        XCTAssertEqual(StaffDrawingRules.accidental(for: pitch(0, 4, 2), key: 0), .doubleSharp)
        XCTAssertEqual(StaffDrawingRules.accidental(for: pitch(6, 4, -2), key: 0), .doubleFlat)
        XCTAssertEqual(StaffDrawingRules.keyAlteration(letter: 6, key: -2), -1)
        XCTAssertEqual(StaffDrawingRules.keyAlteration(letter: 0, key: -2), 0)
        XCTAssertEqual(StaffDrawingRules.keyAlteration(letter: 3, key: 1), 1)
    }

    func testStemsAndChords() {
        XCTAssertTrue(StaffDrawingRules.stemUp(steps: [0]))
        XCTAssertTrue(StaffDrawingRules.stemUp(steps: [3]))
        XCTAssertFalse(StaffDrawingRules.stemUp(steps: [4]), "the middle line: down")
        XCTAssertFalse(StaffDrawingRules.stemUp(steps: [8]))
        XCTAssertTrue(StaffDrawingRules.stemUp(steps: [0, 2, 4]), "a triad around the second line")
        XCTAssertFalse(StaffDrawingRules.stemUp(steps: [4, 6, 8]))
        XCTAssertEqual(StaffDrawingRules.shifted(steps: [0, 2, 4]), [false, false, false])
        XCTAssertEqual(StaffDrawingRules.shifted(steps: [0, 1, 4]), [false, true, false])
        XCTAssertEqual(StaffDrawingRules.shifted(steps: [1, 0]), [true, false], "order does not matter")
        XCTAssertEqual(StaffDrawingRules.shifted(steps: [0, 1, 2]), [false, true, false])
        XCTAssertEqual(StaffDrawingRules.flags(.eighth), 1)
        XCTAssertEqual(StaffDrawingRules.flags(.sixteenth), 2)
        XCTAssertEqual(StaffDrawingRules.flags(.quarter), 0)
    }

    func testPianoKeys() {
        XCTAssertEqual((60...71).filter(PianoLayout.isBlack), [61, 63, 66, 68, 70])
        XCTAssertEqual(PianoLayout.whiteKeys(in: 60...72).count, 8)
        XCTAssertEqual(PianoLayout.range(covering: [60]), 60...84)
        XCTAssertEqual(PianoLayout.range(covering: [60, 72]), 60...84)
        XCTAssertEqual(PianoLayout.range(covering: [64]), 60...84)
        XCTAssertEqual(PianoLayout.range(covering: [50, 62]), 48...72)
        XCTAssertEqual(PianoLayout.range(covering: [96]), 96...108)
        XCTAssertEqual(PianoLayout.range(covering: []), 60...84)
        for midi in 21...108 {
            let range = PianoLayout.range(covering: [midi])
            XCTAssertTrue(range.contains(midi), "\(midi) in \(range)")
            XCTAssertFalse(PianoLayout.isBlack(range.lowerBound) || PianoLayout.isBlack(range.upperBound))
        }
        // C#4 sits between the first and second white key of the range from C4.
        XCTAssertEqual(PianoLayout.blackKeyCenter(61, in: 60...84), 1, accuracy: 0.1)
        XCTAssertEqual(PianoLayout.blackKeyCenter(63, in: 60...84), 2, accuracy: 0.1)
        XCTAssertEqual(PianoLayout.blackKeyCenter(66, in: 60...84), 4, accuracy: 0.1)
        XCTAssertEqual(PianoLayout.name(60), "C4")
        XCTAssertEqual(PianoLayout.name(70), "A♯4")
        XCTAssertEqual(PianoLayout.name(71), "H4")
    }

    func testReadingAPosition() {
        let start = BoardPlacement(fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")
        XCTAssertEqual(start.piece(on: "e4"), "P")
        XCTAssertEqual(start.piece(on: "e2"), nil)
        XCTAssertEqual(start.piece(on: "a8"), "r")
        XCTAssertEqual(start.piece(on: "e1"), "K")
        XCTAssertEqual(start.piece(on: "d8"), "q")
        XCTAssertNil(start.piece(on: "e5"))
        XCTAssertNil(start.piece(on: "z9"))
        XCTAssertEqual(start.rows.count, 8)
        XCTAssertTrue(start.rows.allSatisfy { $0.count == 8 })
        XCTAssertEqual(BoardPlacement.sideToMove(fen: "8/8/8/8/8/8/8/8 b - - 0 1"), "Schwarz")
        XCTAssertEqual(BoardPlacement.sideToMove(fen: "8/8/8/8/8/8/8/8 w - - 0 1"), "Weiß")
        XCTAssertNil(BoardPlacement.sideToMove(fen: "8/8/8/8/8/8/8/8"))
        let broken = BoardPlacement(fen: "rnbqkbnr/ppp")
        XCTAssertEqual(broken.rows.count, 8)
        XCTAssertTrue(broken.rows.allSatisfy { $0.count == 8 })
        XCTAssertEqual(BoardPlacement.coordinates("a1")?.0, 0)
        XCTAssertEqual(BoardPlacement.coordinates("h8")?.1, 8)
        XCTAssertEqual(BoardPlacement.name(file: 4, rank: 4), "e4")
        XCTAssertEqual(BoardPlacement.germanName(of: "N"), "weißer Springer")
        XCTAssertEqual(BoardPlacement.germanName(of: "q"), "schwarze Dame")
        XCTAssertEqual(BoardPlacement.germanName(of: "P"), "weißer Bauer")
    }
}
