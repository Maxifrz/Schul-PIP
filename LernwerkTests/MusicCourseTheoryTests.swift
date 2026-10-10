import XCTest
@testable import Lernwerk

/// Checks the theory against facts known independently of the code.
final class MusicCourseTheoryTests: XCTestCase {
    private func p(_ letter: Int, _ octave: Int = 4, _ alteration: Int = 0) -> Pitch {
        Pitch(letter: letter, octave: octave, alteration: alteration)
    }

    private let C = 0, D = 1, E = 2, F = 3, G = 4, A = 5, H = 6

    private func names(_ notes: [Pitch]) -> [String] { notes.map(\.germanName) }

    func testMidiNumbers() {
        XCTAssertEqual(p(C).midi, 60)
        XCTAssertEqual(p(A).midi, 69)
        XCTAssertEqual(p(C, 5).midi, 72)
        XCTAssertEqual(p(H, 3).midi, 59)
        XCTAssertEqual(p(C, 4, 1).midi, 61)
        XCTAssertEqual(p(H, 3, 1).midi, 60)
        XCTAssertEqual(p(A, 0).midi, 21)
        XCTAssertEqual(p(C, 8).midi, 108)
    }

    func testGermanNames() {
        let all = [p(C), p(C, 4, 1), p(D, 4, -1), p(D), p(D, 4, 1), p(E, 4, -1), p(E), p(F), p(F, 4, 1), p(G, 4, -1), p(G),
                   p(G, 4, 1), p(A, 4, -1), p(A), p(A, 4, 1), p(H, 4, -1), p(H)]
        XCTAssertEqual(names(all), ["C", "Cis", "Des", "D", "Dis", "Es", "E", "F", "Fis", "Ges", "G", "Gis", "As", "A", "Ais", "B", "H"])
        XCTAssertEqual(p(H, 4, 1).germanName, "His")
        XCTAssertEqual(p(C, 4, -1).germanName, "Ces")
        XCTAssertEqual(p(F, 4, 2).germanName, "Fisis")
        XCTAssertEqual(p(H, 4, -2).germanName, "Heses")
        XCTAssertEqual(p(E, 4, -2).germanName, "Eses")
        XCTAssertEqual(p(A, 4, -2).germanName, "Asas")
    }

    func testNameParsing() {
        for name in ["C", "Cis", "Des", "Es", "As", "B", "H", "Fis", "Ges", "Gis", "Ais", "Ces", "His"] {
            let parsed = MusicNames.parse(name)
            XCTAssertNotNil(parsed, name)
            XCTAssertEqual(Pitch(letter: parsed!.letter, octave: 4, alteration: parsed!.alteration).germanName, name)
            XCTAssertNotNil(MusicNames.parse(name.lowercased()))
        }
        XCTAssertNil(MusicNames.parse("Xis"))
        XCTAssertNil(MusicNames.parse("Hes"))
        XCTAssertNil(MusicNames.parse(""))
    }

    func testSpellingFromMidi() {
        XCTAssertEqual(Pitch.spelled(midi: 61).germanName, "Cis")
        XCTAssertEqual(Pitch.spelled(midi: 61, preferFlats: true).germanName, "Des")
        XCTAssertEqual(Pitch.spelled(midi: 70, preferFlats: true).germanName, "B")
        XCTAssertEqual(Pitch.spelled(midi: 70).germanName, "Ais")
        for midi in 21...108 {
            XCTAssertEqual(Pitch.spelled(midi: midi).midi, midi)
            XCTAssertEqual(Pitch.spelled(midi: midi, preferFlats: true).midi, midi)
        }
    }

    func testOctaveNames() {
        XCTAssertEqual(Pitch.octaveName(4), "eingestrichene Oktave")
        XCTAssertEqual(Pitch.octaveName(3), "kleine Oktave")
        XCTAssertEqual(Pitch.octaveName(2), "große Oktave")
        XCTAssertEqual(p(C, 4).scientificName, "C4")
    }

    func testIntervalNamesAndSizes() {
        func interval(_ a: Pitch, _ b: Pitch) -> MusicInterval { MusicInterval(from: a, to: b) }
        let cg = interval(p(C), p(G))
        XCTAssertEqual(cg.name, "reine Quinte")
        XCTAssertEqual(cg.semitones, 7)
        XCTAssertEqual(cg.number, 5)
        XCTAssertEqual(interval(p(C), p(E)).name, "große Terz")
        XCTAssertEqual(interval(p(E), p(G)).name, "kleine Terz")
        XCTAssertEqual(interval(p(C), p(D)).name, "große Sekunde")
        XCTAssertEqual(interval(p(E), p(F)).name, "kleine Sekunde")
        XCTAssertEqual(interval(p(C), p(F)).name, "reine Quarte")
        XCTAssertEqual(interval(p(F), p(H)).name, "übermäßige Quarte")
        XCTAssertEqual(interval(p(H), p(F, 5)).name, "verminderte Quinte")
        XCTAssertTrue(interval(p(F), p(H)).isTritone)
        XCTAssertTrue(interval(p(C), p(G, 4, -1)).isTritone)
        XCTAssertEqual(interval(p(C), p(A)).name, "große Sexte")
        XCTAssertEqual(interval(p(E), p(C, 5)).name, "kleine Sexte")
        XCTAssertEqual(interval(p(C), p(H)).name, "große Septime")
        XCTAssertEqual(interval(p(D), p(C, 5)).name, "kleine Septime")
        XCTAssertEqual(interval(p(C), p(C, 5)).name, "reine Oktave")
        XCTAssertEqual(interval(p(C), p(C)).name, "reine Prim")
        XCTAssertEqual(interval(p(C), p(C, 4, 1)).name, "übermäßige Prim")
        // C to G flat and C to F sharp have the same 6 half steps but different names.
        XCTAssertNotEqual(interval(p(C), p(G, 4, -1)).name, interval(p(C), p(F, 4, 1)).name)
    }

    func testIntervalSemitoneTable() {
        let expected: [(String, Int)] = [
            ("reine Prim", 0), ("kleine Sekunde", 1), ("große Sekunde", 2), ("kleine Terz", 3), ("große Terz", 4), ("reine Quarte", 5),
            ("reine Quinte", 7), ("kleine Sexte", 8), ("große Sexte", 9), ("kleine Septime", 10), ("große Septime", 11), ("reine Oktave", 12),
        ]
        XCTAssertEqual(MusicInterval.standard.count, expected.count)
        for (interval, fact) in zip(MusicInterval.standard, expected) {
            XCTAssertEqual(interval.name, fact.0)
            XCTAssertEqual(interval.semitones, fact.1)
        }
    }

    func testBuildingIntervalsSpellsByLetter() {
        let majorThird = MusicInterval(steps: 2, semitones: 4)
        XCTAssertEqual(majorThird.above(p(D)).germanName, "Fis")
        XCTAssertEqual(majorThird.above(p(F)).germanName, "A")
        XCTAssertEqual(majorThird.above(p(E, 4, -1)).germanName, "G")
        XCTAssertEqual(MusicInterval(steps: 2, semitones: 3).above(p(D)).germanName, "F")
        XCTAssertEqual(MusicInterval(steps: 4, semitones: 7).above(p(H)).germanName, "Fis")
        XCTAssertEqual(MusicInterval(steps: 4, semitones: 7).above(p(F)).germanName, "C")
        XCTAssertEqual(MusicInterval(steps: 4, semitones: 7).above(p(D, 4, -1)).germanName, "As")
        XCTAssertEqual(MusicInterval(steps: 4, semitones: 7).below(p(C)).germanName, "F")
        XCTAssertEqual(MusicInterval(steps: 3, semitones: 6).above(p(F)).germanName, "H")
        XCTAssertEqual(MusicInterval(steps: 4, semitones: 6).above(p(F)).germanName, "Ces")
    }

    func testInversion() {
        for interval in MusicInterval.standard {
            XCTAssertEqual(interval.inverted.inverted, interval)
            XCTAssertEqual(interval.number + interval.inverted.number, 9)
            XCTAssertEqual(interval.semitones + interval.inverted.semitones, 12)
        }
        XCTAssertEqual(MusicInterval(steps: 2, semitones: 4).inverted.name, "kleine Sexte")
        XCTAssertEqual(MusicInterval(steps: 4, semitones: 7).inverted.name, "reine Quarte")
        XCTAssertEqual(MusicInterval(steps: 1, semitones: 2).inverted.name, "kleine Septime")
    }

    func testMajorScales() {
        func scale(_ tonic: Pitch) -> [String] { names(MusicScale(tonic: tonic, kind: .major).notes) }
        XCTAssertEqual(scale(p(C)), ["C", "D", "E", "F", "G", "A", "H", "C"])
        XCTAssertEqual(scale(p(G)), ["G", "A", "H", "C", "D", "E", "Fis", "G"])
        XCTAssertEqual(scale(p(F)), ["F", "G", "A", "B", "C", "D", "E", "F"])
        XCTAssertEqual(scale(p(D)), ["D", "E", "Fis", "G", "A", "H", "Cis", "D"])
        XCTAssertEqual(scale(p(H, 4, -1)), ["B", "C", "D", "Es", "F", "G", "A", "B"])
        XCTAssertEqual(scale(p(E, 4, -1)), ["Es", "F", "G", "As", "B", "C", "D", "Es"])
        XCTAssertEqual(scale(p(F, 4, 1)), ["Fis", "Gis", "Ais", "H", "Cis", "Dis", "Eis", "Fis"])
        XCTAssertEqual(scale(p(D, 4, -1)), ["Des", "Es", "F", "Ges", "As", "B", "C", "Des"])
        XCTAssertEqual(MusicScale(tonic: p(G), kind: .major).name, "G-Dur")
    }

    func testMinorScales() {
        func scale(_ tonic: Pitch, _ kind: MusicScaleKind) -> [String] { names(MusicScale(tonic: tonic, kind: kind).notes) }
        XCTAssertEqual(scale(p(A), .naturalMinor), ["A", "H", "C", "D", "E", "F", "G", "A"])
        XCTAssertEqual(scale(p(A), .harmonicMinor), ["A", "H", "C", "D", "E", "F", "Gis", "A"])
        XCTAssertEqual(scale(p(E), .naturalMinor), ["E", "Fis", "G", "A", "H", "C", "D", "E"])
        XCTAssertEqual(scale(p(D), .naturalMinor), ["D", "E", "F", "G", "A", "B", "C", "D"])
        XCTAssertEqual(scale(p(D), .harmonicMinor), ["D", "E", "F", "G", "A", "B", "Cis", "D"])
        XCTAssertEqual(MusicScale(tonic: p(A), kind: .naturalMinor).name, "A-Moll")
    }

    func testScaleOctaveAndIntervals() {
        for count in -6...6 {
            let notes = MusicScale(tonic: MusicKey.majorTonic(count), kind: .major).notes
            XCTAssertEqual(notes.count, 8)
            XCTAssertEqual(notes[7].midi - notes[0].midi, 12)
            // every degree is spelled with its own letter
            XCTAssertEqual(Set(notes.dropLast().map(\.letter)).count, 7)
            XCTAssertEqual(MusicInterval(from: notes[0], to: notes[2]).name, "große Terz")
            XCTAssertEqual(MusicInterval(from: notes[0], to: notes[4]).name, "reine Quinte")
        }
    }

    func testKeySignatures() {
        XCTAssertEqual(names(MusicKey.accidentals(1)), ["Fis"])
        XCTAssertEqual(names(MusicKey.accidentals(7)), ["Fis", "Cis", "Gis", "Dis", "Ais", "Eis", "His"])
        XCTAssertEqual(names(MusicKey.accidentals(-1)), ["B"])
        XCTAssertEqual(names(MusicKey.accidentals(-7)), ["B", "Es", "As", "Des", "Ges", "Ces", "Fes"])
        XCTAssertEqual(MusicKey.accidentals(0), [])
    }

    func testCircleOfFifths() {
        XCTAssertEqual((0...7).map { MusicKey.majorName($0) }, ["C-Dur", "G-Dur", "D-Dur", "A-Dur", "E-Dur", "H-Dur", "Fis-Dur", "Cis-Dur"])
        XCTAssertEqual((0...7).map { MusicKey.majorName(-$0) }, ["C-Dur", "F-Dur", "B-Dur", "Es-Dur", "As-Dur", "Des-Dur", "Ges-Dur", "Ces-Dur"])
        XCTAssertEqual(MusicKey.minorName(0), "A-Moll")
        XCTAssertEqual(MusicKey.minorName(1), "E-Moll")
        XCTAssertEqual(MusicKey.minorName(3), "Fis-Moll")
        XCTAssertEqual(MusicKey.minorName(-1), "D-Moll")
        XCTAssertEqual(MusicKey.minorName(-3), "C-Moll")
        XCTAssertEqual(MusicKey.minorName(-2), "G-Moll")
        XCTAssertEqual(MusicKey.count(ofMajorTonic: p(D)), 2)
        XCTAssertEqual(MusicKey.count(ofMajorTonic: p(E, 4, -1)), -3)
        XCTAssertEqual(MusicKey.count(ofMinorTonic: p(A)), 0)
        XCTAssertEqual(MusicKey.count(ofMinorTonic: p(F, 4, 1)), 3)
    }

    func testKeySignatureAgreesWithScales() {
        for count in -7...7 {
            let scale = MusicScale(tonic: MusicKey.majorTonic(count), kind: .major)
            for note in scale.notes {
                XCTAssertEqual(note.alteration, MusicKey.alteration(letter: note.letter, count: count), "\(scale.name) \(note.germanName)")
            }
            XCTAssertEqual(scale.accidentalCount, count)
            let minor = MusicScale(tonic: MusicKey.minorTonic(count), kind: .naturalMinor)
            XCTAssertEqual(minor.accidentalCount, count)
            // natural minor uses the notes of its relative major, starting on the sixth degree
            let majorNotes = MusicScale(tonic: MusicKey.majorTonic(count), kind: .major).notes.dropLast()
            XCTAssertEqual(minor.notes.dropLast().map(\.pitchClass), (0..<7).map { majorNotes[majorNotes.startIndex + ($0 + 5) % 7].pitchClass })
        }
    }

    func testTriads() {
        func triad(_ root: Pitch, _ quality: MusicTriadQuality) -> [String] { names(MusicTriad(root: root, quality: quality).notes) }
        XCTAssertEqual(triad(p(C), .major), ["C", "E", "G"])
        XCTAssertEqual(triad(p(E, 4, -1), .major), ["Es", "G", "B"])
        XCTAssertEqual(triad(p(A), .minor), ["A", "C", "E"])
        XCTAssertEqual(triad(p(D), .major), ["D", "Fis", "A"])
        XCTAssertEqual(triad(p(G), .minor), ["G", "B", "D"])
        XCTAssertEqual(triad(p(F), .minor), ["F", "As", "C"])
        XCTAssertEqual(triad(p(H), .diminished), ["H", "D", "F"])
        XCTAssertEqual(triad(p(C), .augmented), ["C", "E", "Gis"])
        XCTAssertEqual(triad(p(F, 4, 1), .minor), ["Fis", "A", "Cis"])
        XCTAssertEqual(MusicTriad(root: p(E, 4, -1), quality: .major).name, "Es-Dur")
        let c = MusicTriad(root: p(C), quality: .major).notes
        XCTAssertEqual(c.map(\.midi), [60, 64, 67])
        XCTAssertEqual(MusicTriad(root: p(C), quality: .minor).notes.map(\.midi), [60, 63, 67])
    }

    func testNoteValues() {
        XCTAssertEqual(NoteValue.ordered.map(\.sixteenths), [16, 8, 4, 2, 1])
        let m44 = MusicMeter("4/4")!, m34 = MusicMeter("3/4")!, m68 = MusicMeter("6/8")!
        XCTAssertEqual(m44.barSixteenths, 16)
        XCTAssertEqual(m34.barSixteenths, 12)
        XCTAssertEqual(m68.barSixteenths, 12)
        XCTAssertTrue(m44.beats(of: .whole) == (4, 1))
        XCTAssertTrue(m44.beats(of: .half) == (2, 1))
        XCTAssertTrue(m44.beats(of: .quarter) == (1, 1))
        XCTAssertTrue(m44.beats(of: .eighth) == (1, 2))
        XCTAssertTrue(m44.beats(of: .sixteenth) == (1, 4))
        XCTAssertTrue(m68.beats(of: .eighth) == (1, 1))
        XCTAssertTrue(m68.beats(of: .quarter) == (2, 1))
        XCTAssertTrue(m44.isFull([.half, .quarter, .eighth, .eighth]))
        XCTAssertFalse(m34.isFull([.half, .half]))
        XCTAssertTrue(m34.isFull([.half, .quarter]))
        XCTAssertNil(MusicMeter("4/5"))
        XCTAssertNil(MusicMeter("x"))
        XCTAssertEqual(NoteValue.eighth.restName, "Achtelpause")
        XCTAssertEqual(NoteValue.half.noteName, "Halbe Note")
    }

    func testStaffPositions() {
        // Treble clef: E4 bottom line, F5 top line, middle C one ledger line below.
        XCTAssertEqual(p(E, 4).staffPosition(clef: .treble).step, 0)
        XCTAssertEqual(p(G, 4).staffPosition(clef: .treble).index, 2)
        XCTAssertTrue(p(G, 4).staffPosition(clef: .treble).isLine)
        XCTAssertEqual(p(F, 5).staffPosition(clef: .treble).step, 8)
        XCTAssertEqual(p(F, 4).staffPosition(clef: .treble).description, "1. Zwischenraum")
        XCTAssertEqual(p(C, 4).staffPosition(clef: .treble).step, -2)
        XCTAssertEqual(p(C, 4).staffPosition(clef: .treble).ledgerLines, 1)
        XCTAssertEqual(p(D, 4).staffPosition(clef: .treble).ledgerLines, 0)
        XCTAssertEqual(p(A, 3).staffPosition(clef: .treble).ledgerLines, 2)
        XCTAssertEqual(p(A, 5).staffPosition(clef: .treble).ledgerLines, 1)
        XCTAssertEqual(p(G, 5).staffPosition(clef: .treble).ledgerLines, 0)
        XCTAssertEqual(p(C, 6).staffPosition(clef: .treble).ledgerLines, 2)
        // Bass clef: G2 bottom line, A3 top line, middle C one ledger line above.
        XCTAssertEqual(p(G, 2).staffPosition(clef: .bass).step, 0)
        XCTAssertEqual(p(A, 3).staffPosition(clef: .bass).step, 8)
        XCTAssertEqual(p(F, 3).staffPosition(clef: .bass).index, 4)
        XCTAssertEqual(p(C, 4).staffPosition(clef: .bass).ledgerLines, 1)
        XCTAssertEqual(p(C, 4).staffPosition(clef: .bass).description, "1. Hilfslinie oben")
        XCTAssertEqual(p(E, 2).staffPosition(clef: .bass).ledgerLines, 1)
        for clef in [Clef.treble, .bass] {
            for step in -6...14 {
                XCTAssertEqual(Pitch.atStep(step, clef: clef).staffPosition(clef: clef).step, step)
            }
        }
        XCTAssertEqual(Pitch.atStep(0, clef: .bass).germanName, "G")
    }

    func testPianoKeys() {
        XCTAssertEqual(MusicNames.keys(pitchClass: 0).first, 24)
        XCTAssertTrue(MusicNames.keys(pitchClass: 0).contains(60))
        XCTAssertEqual(MusicNames.keys(pitchClass: 9).count, 8)
        XCTAssertTrue(MusicNames.isBlackKey(61))
        XCTAssertFalse(MusicNames.isBlackKey(60))
    }
}
