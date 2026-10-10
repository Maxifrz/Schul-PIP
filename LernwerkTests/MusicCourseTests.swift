import XCTest
@testable import Lernwerk

/// The music course as the screens will use it: structure, audit, and the facts of its exercises re-computed from tables
/// written down here, independent of the code that generated them.
final class MusicCourseTests: XCTestCase {
    private let provider = MusicCourse.provider
    private let seeds: [UInt64] = Array(1...20)

    /// The exercises of a unit's nodes over all seeds; by default only the unit's own (practice rounds also review earlier units).
    private func all(unit: Int, kinds: Set<NodeKind> = [.lesson, .practice, .checkpoint], own: Bool = true) -> [(node: CourseNode, exercise: LearnExercise)] {
        let prefix = String(format: "music.u%02d.", unit)
        var result: [(node: CourseNode, exercise: LearnExercise)] = []
        for node in provider.course.nodes where node.unitNumber == unit && kinds.contains(node.kind) {
            for seed in seeds {
                for exercise in provider.exercises(for: node, seed: seed) where !own || exercise.id.hasPrefix(prefix) { result.append((node, exercise)) }
            }
        }
        return result
    }

    private func staff(_ exercise: LearnExercise) -> StaffSpec? {
        if case let .staff(spec)? = exercise.media { return spec }
        return nil
    }

    private func tones(_ exercise: LearnExercise) -> ToneSpec? {
        if case let .tones(spec)? = exercise.media { return spec }
        return nil
    }

    // MARK: Structure

    func testCourseShape() {
        let course = provider.course
        XCTAssertEqual(course.id, "music")
        XCTAssertEqual(course.title, "Musik")
        XCTAssertEqual(course.subtitle, "Noten lesen, hören, verstehen")
        XCTAssertEqual(course.kind, .music)
        XCTAssertEqual(course.color, 0x9E6B8E)
        XCTAssertEqual(course.symbol, "music.note")
        XCTAssertEqual(course.units.count, 8)
        XCTAssertEqual(course.sections.flatMap(\.units).count, 8)
        for unit in course.units {
            XCTAssertEqual(unit.nodes.count, 6)
            let paragraphs = unit.tip.components(separatedBy: "\n\n")
            XCTAssertTrue((2...5).contains(paragraphs.count), "\(unit.id) tip has \(paragraphs.count) paragraphs")
            XCTAssertFalse(unit.summary.isEmpty)
        }
        XCTAssertEqual(course.units.map(\.title), [
            "Notenlinien und Violinschlüssel", "Bassschlüssel und Klaviatur", "Notenwerte und Pausen", "Vorzeichen", "Tonleitern", "Intervalle",
            "Dreiklänge", "Tonarten und Quintenzirkel",
        ])
    }

    func testAuditIsClean() {
        XCTAssertEqual(CourseAudit.problems(of: provider, seeds: seeds), [])
    }

    func testEveryNodeHasTwoKindsAndNoEmojiOrPlaceholder() {
        for node in provider.course.nodes where node.kind != .chest {
            for seed in seeds {
                let list = provider.exercises(for: node, seed: seed)
                XCTAssertGreaterThanOrEqual(Set(list.map(\.kind)).count, 2, "\(node.id) seed \(seed)")
                for exercise in list {
                    let text = ([exercise.prompt, exercise.solution, exercise.explanation] + exercise.options + exercise.correctAnswers).joined(separator: " ")
                    XCTAssertFalse(text.contains("TODO"))
                    XCTAssertFalse(text.unicodeScalars.contains { $0.properties.isEmojiPresentation })
                }
            }
        }
    }

    func testSeedsChangeTheExercises() {
        for node in provider.course.nodes where node.kind != .chest {
            let a = provider.exercises(for: node, seed: 1).map(\.id)
            let b = provider.exercises(for: node, seed: 2).map(\.id)
            let c = provider.exercises(for: node, seed: 3).map(\.id)
            XCTAssertTrue(a != b || a != c, "\(node.id) ignores the seed")
        }
    }

    func testPracticeMixesEarlierUnits() {
        for unit in 2...8 {
            let ids = Set(all(unit: unit, kinds: [.practice], own: false).map(\.exercise.id))
            let prefix = String(format: "music.u%02d.", unit)
            XCTAssertTrue(ids.contains { !$0.hasPrefix(prefix) }, "practice of unit \(unit) has no review")
        }
    }

    func testSomeVarietyPerUnit() {
        for unit in 1...8 {
            let ids = Set(all(unit: unit).map(\.exercise.id))
            XCTAssertGreaterThan(ids.count, 60, "unit \(unit) has only \(ids.count) distinct exercises")
        }
    }

    // MARK: Typed answers

    func testTypedNoteNamesAcceptBothCases() {
        var checked = 0
        for unit in 1...8 {
            for (_, exercise) in all(unit: unit) where exercise.kind == .typeAnswer && exercise.mode == .exact {
                guard let answer = exercise.correctAnswers.first, MusicNames.parse(answer) != nil else { continue }
                for text in [answer, answer.lowercased(), " " + answer + " "] {
                    XCTAssertTrue(exercise.missedKeys(for: .typed(text)).isEmpty, "\(exercise.id) rejects \(text)")
                }
                // a neighbour is never accepted
                let parsed = MusicNames.parse(answer)!
                let neighbour = Pitch(letter: (parsed.letter + 1) % 7, octave: 4, alteration: parsed.alteration).germanName
                XCTAssertFalse(exercise.missedKeys(for: .typed(neighbour)).isEmpty, "\(exercise.id) accepts \(neighbour)")
                XCTAssertFalse(exercise.missedKeys(for: .typed(answer + "is")).isEmpty)
                checked += 1
            }
        }
        XCTAssertGreaterThan(checked, 100)
    }

    func testNoChoiceOffersAnEnharmonicOfTheAnswer() {
        var checked = 0
        for unit in 1...8 {
            for (_, exercise) in all(unit: unit) where exercise.kind == .multipleChoice {
                guard let answer = exercise.correctAnswers.first, let right = MusicNames.parse(answer) else { continue }
                let rightPitch = Pitch(letter: right.letter, octave: 4, alteration: right.alteration)
                for option in exercise.options where option != answer {
                    guard let parsed = MusicNames.parse(option) else { continue }
                    XCTAssertNotEqual(Pitch(letter: parsed.letter, octave: 4, alteration: parsed.alteration).pitchClass, rightPitch.pitchClass, "\(exercise.id): \(option) sounds like \(answer)")
                }
                checked += 1
            }
        }
        XCTAssertGreaterThan(checked, 200)
    }

    func testNoSignsBeforeTheyAreTaught() {
        for unit in 1...3 {
            for (_, exercise) in all(unit: unit) {
                for text in exercise.options + exercise.correctAnswers + [exercise.prompt] {
                    if let parsed = MusicNames.parse(text) { XCTAssertEqual(parsed.alteration, 0, "\(exercise.id): \(text)") }
                }
                if let spec = staff(exercise) { XCTAssertTrue(spec.notes.allSatisfy { $0.pitch.alteration == 0 }, exercise.id) }
            }
        }
    }

    // MARK: Unit 1 and 2: reading the staff

    private let trebleNames = ["E", "F", "G", "A", "H", "C", "D", "E", "F", "G", "A"]  // steps 0 ... 10 from the bottom line E4
    private let bassNames = ["G", "A", "H", "C", "D", "E", "F", "G", "A", "H", "C"]  // steps 0 ... 10 from the bottom line G2

    private func expectedName(of note: StaffNote, clef: Clef) -> String? {
        let diatonic = note.pitch.octave * 7 + note.pitch.letter
        switch clef {
        case .treble:
            let step = diatonic - (4 * 7 + 2)
            if step >= 0 && step <= 10 { return trebleNames[step] }
            // below the staff: step -1 is D4, -2 is C4
            return step == -1 ? "D" : step == -2 ? "C" : nil
        case .bass:
            let step = diatonic - (2 * 7 + 4)
            if step >= 0 && step <= 10 { return bassNames[step] }
            return step == -1 ? "F" : step == -2 ? "E" : nil
        case .alto: return nil
        }
    }

    func testStaffReadingAnswersMatchTheStaffInUnits1And2() {
        var checked = 0
        for unit in 1...2 {
            for (_, exercise) in all(unit: unit) {
                guard exercise.id.contains(".read.") || exercise.id.contains(".type.") || exercise.id.contains(".mixed.") else { continue }
                guard let spec = staff(exercise), let note = spec.notes.first else { XCTFail("\(exercise.id) has no staff"); continue }
                XCTAssertEqual(exercise.correctAnswers.first, expectedName(of: note, clef: spec.clef), exercise.id)
                checked += 1
            }
        }
        XCTAssertGreaterThan(checked, 500)
    }

    func testPlaceAndCompareQuestionsInUnits1And2() {
        for unit in 1...2 {
            for (_, exercise) in all(unit: unit) where exercise.id.contains(".place.") {
                let names = unit == 1 ? trebleNames : bassNames
                let phrases = ["auf der 1. Linie": 0, "im 1. Zwischenraum": 1, "auf der 2. Linie": 2, "im 2. Zwischenraum": 3, "auf der 3. Linie": 4,
                               "im 3. Zwischenraum": 5, "auf der 4. Linie": 6, "im 4. Zwischenraum": 7, "auf der 5. Linie": 8, "über der 5. Linie": 9,
                               "auf der 1. Hilfslinie über dem System": 10]
                var step: Int?
                for (phrase, value) in phrases where exercise.prompt.contains(phrase) { step = max(step ?? -99, value) }
                if let step { XCTAssertEqual(exercise.correctAnswers.first, names[step], exercise.id) }
                else if exercise.prompt.contains("unter der 1. Linie") { XCTAssertEqual(exercise.correctAnswers.first, unit == 1 ? "D" : "F") }
                else if exercise.prompt.contains("Hilfslinie unter dem System") { XCTAssertEqual(exercise.correctAnswers.first, unit == 1 ? "C" : "E") }
                else { XCTFail("unknown position in \(exercise.prompt)") }
            }
        }
        // The same position has different names in the two clefs.
        for (_, exercise) in all(unit: 2) where exercise.id.contains(".compare.") {
            let step = Int(exercise.id.split(separator: ".").last!)!
            XCTAssertTrue(exercise.prompt.contains("heißt sie \(trebleNames[step])"))
            XCTAssertEqual(exercise.correctAnswers.first, bassNames[step])
            XCTAssertTrue(exercise.options.contains(trebleNames[step]), "the wrong clef reading is offered")
        }
    }

    func testKeyboardQuestions() {
        let pitchClasses = ["C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "H": 11]
        var named = 0, anyOctave = 0, fromStaff = 0
        for (_, exercise) in all(unit: 2) where exercise.kind == .pianoKey {
            let keys = exercise.correctAnswers.compactMap { Int($0) }
            XCTAssertEqual(keys.count, exercise.correctAnswers.count)
            if exercise.prompt.hasPrefix("Tippe das ") {
                XCTAssertEqual(keys.count, 1, exercise.prompt)
                let letter = exercise.prompt.split(separator: " ").last!.dropLast().uppercased()
                let octave = exercise.prompt.contains("eingestrichene") ? 4 : exercise.prompt.contains("zweigestrichene") ? 5 : exercise.prompt.contains("kleine") ? 3 : 2
                XCTAssertEqual(keys[0], 12 * (octave + 1) + pitchClasses[letter]!, exercise.prompt)
                named += 1
            } else if exercise.prompt.hasPrefix("Tippe ein ") {
                let letter = String(exercise.prompt.dropFirst("Tippe ein ".count).prefix(1))
                XCTAssertTrue(keys.allSatisfy { $0 % 12 == pitchClasses[letter]! }, exercise.prompt)
                XCTAssertEqual(keys.count, MusicNames.keys(pitchClass: pitchClasses[letter]!).count)
                anyOctave += 1
            } else if let spec = staff(exercise), let note = spec.notes.first {
                XCTAssertEqual(keys, [note.pitch.midi])
                fromStaff += 1
            }
        }
        XCTAssertGreaterThan(named, 20)
        XCTAssertGreaterThan(anyOctave, 20)
        XCTAssertGreaterThan(fromStaff, 20)
        // "Tippe das eingestrichene c" is the middle C.
        let middle = all(unit: 2).filter { $0.exercise.prompt == "Tippe das eingestrichene c." }
        XCTAssertFalse(middle.isEmpty)
        for item in middle { XCTAssertEqual(item.exercise.correctAnswers, ["60"]) }
    }

    // MARK: Unit 3: values and bars

    private let sixteenths = ["Ganze Note": 16, "Halbe Note": 8, "Viertelnote": 4, "Achtelnote": 2, "Sechzehntelnote": 1,
                              "Ganze Pause": 16, "Halbe Pause": 8, "Viertelpause": 4, "Achtelpause": 2, "Sechzehntelpause": 1]
    private let beatTexts = [16: "4", 8: "2", 4: "1", 2: "1/2", 1: "1/4"]

    func testNoteValueExercises() {
        var names = 0, beats = 0, bars = 0, types = 0
        for (_, exercise) in all(unit: 3) {
            if exercise.id.contains(".name.") || exercise.id.contains(".rest."), let spec = staff(exercise), let note = spec.notes.first {
                XCTAssertEqual(sixteenths[exercise.correctAnswers[0]], note.value.sixteenths, exercise.id)
                XCTAssertEqual(note.isRest, exercise.id.contains(".rest."))
                names += 1
            }
            if exercise.id.contains(".beats."), let note = staff(exercise)?.notes.first {
                XCTAssertEqual(exercise.correctAnswers[0], beatTexts[note.value.sixteenths])
                beats += 1
            }
            if exercise.id.contains(".valuetype."), let note = staff(exercise)?.notes.first {
                XCTAssertEqual(sixteenths[exercise.correctAnswers[0]], note.value.sixteenths)
                types += 1
            }
            if exercise.id.contains(".fill."), exercise.kind == .multipleChoice, let spec = staff(exercise), let time = spec.time {
                let bar = time == "4/4" ? 16 : 12
                let used = spec.notes.reduce(0) { $0 + ($1.value == .whole ? 16 : $1.value == .half ? 8 : $1.value == .quarter ? 4 : $1.value == .eighth ? 2 : 1) }
                XCTAssertEqual(used + sixteenths[exercise.correctAnswers[0]]!, bar, exercise.id)
                bars += 1
            }
            if exercise.id.contains(".barbeats."), let spec = staff(exercise), let time = spec.time {
                let used = spec.notes.reduce(0) { $0 + ($1.value == .half ? 8 : $1.value == .quarter ? 4 : 2) }
                XCTAssertEqual(Double(exercise.correctAnswers[0]), Double(used) / 4, exercise.id)
                XCTAssertTrue(["4/4", "3/4"].contains(time))
            }
            if exercise.id.contains(".ratio.") && exercise.kind == .typeAnswer {
                // "Wie viele Achtelnoten dauern so lang wie eine Halbe Note?"
                let small = ["Sechzehntelnoten": 1, "Achtelnoten": 2, "Viertelnoten": 4, "Halbe Noten": 8].first { exercise.prompt.contains($0.key) }!
                let big = ["Ganze Note": 16, "Halbe Note": 8, "Viertelnote": 4, "Achtelnote": 2].filter { exercise.prompt.hasSuffix("wie eine \($0.key)? Schreibe eine Zahl.") }.first!
                XCTAssertEqual(Int(exercise.correctAnswers[0]), big.value / small.value, exercise.prompt)
            }
        }
        XCTAssertGreaterThan(names, 50)
        XCTAssertGreaterThan(beats, 20)
        XCTAssertGreaterThan(bars, 20)
        XCTAssertGreaterThan(types, 20)
    }

    func testNumberAnswersAreAcceptedInAnyForm() {
        let fraction = all(unit: 3).first { $0.exercise.id.contains(".beatstype.eighth") }?.exercise
        XCTAssertNotNil(fraction)
        for text in ["1/2", "0,5", "0.5"] { XCTAssertTrue(fraction!.missedKeys(for: .typed(text)).isEmpty, text) }
        XCTAssertFalse(fraction!.missedKeys(for: .typed("1")).isEmpty)
    }

    // MARK: Unit 4: signs

    private let names4: [String: String] = ["0.1": "Cis", "1.1": "Dis", "3.1": "Fis", "4.1": "Gis", "5.1": "Ais", "6.-1": "B", "2.-1": "Es", "5.-1": "As", "1.-1": "Des", "4.-1": "Ges"]

    func testSignExercises() {
        var acc = 0, steps = 0, ears = 0, keys = 0
        for (_, exercise) in all(unit: 4) {
            if exercise.id.contains(".acc.") || exercise.id.contains(".acctype."), let note = staff(exercise)?.notes.first {
                XCTAssertEqual(exercise.correctAnswers[0], names4["\(note.pitch.letter).\(note.pitch.alteration)"], exercise.id)
                acc += 1
            }
            if exercise.id.contains(".step."), let spec = staff(exercise), spec.notes.count == 2 {
                let diff = spec.notes[1].pitch.midi - spec.notes[0].pitch.midi
                XCTAssertEqual(exercise.correctAnswers[0], diff == 1 ? "Halbton" : "Ganzton")
                steps += 1
            }
            if exercise.id.contains(".hear."), let spec = tones(exercise) {
                XCTAssertEqual(spec.midi.count, 2)
                XCTAssertFalse(spec.together)
                let diff = spec.midi[1] - spec.midi[0]
                XCTAssertTrue(diff == 1 || diff == 2)
                XCTAssertEqual(exercise.correctAnswers[0], diff == 1 ? "Halbton" : "Ganzton")
                ears += 1
            }
            if exercise.kind == .pianoKey {
                let pcs = ["Cis": 1, "Dis": 3, "Fis": 6, "Gis": 8, "Ais": 10, "Des": 1, "Es": 3, "Ges": 6, "As": 8, "B": 10]
                let name = exercise.solution
                XCTAssertTrue(exercise.correctAnswers.allSatisfy { Int($0)! % 12 == pcs[name]! }, exercise.id)
                XCTAssertTrue(exercise.correctAnswers.allSatisfy { [1, 3, 6, 8, 10].contains(Int($0)! % 12) })
                keys += 1
            }
            if exercise.id.contains(".raise.") {
                XCTAssertTrue(exercise.correctAnswers[0].hasSuffix("is"))
            }
            if exercise.id.contains(".lower."), let base = exercise.prompt.split(separator: " ").dropFirst().first {
                XCTAssertEqual(exercise.correctAnswers[0], ["H": "B", "E": "Es", "A": "As", "D": "Des", "G": "Ges"][String(base)])
            }
        }
        XCTAssertGreaterThan(acc, 60)
        XCTAssertGreaterThan(steps, 20)
        XCTAssertGreaterThan(ears, 20)
        XCTAssertGreaterThan(keys, 20)
    }

    // MARK: Unit 5: scales

    private let scales: [String: [String]] = [
        "C-Dur": ["C", "D", "E", "F", "G", "A", "H", "C"], "G-Dur": ["G", "A", "H", "C", "D", "E", "Fis", "G"],
        "F-Dur": ["F", "G", "A", "B", "C", "D", "E", "F"], "D-Dur": ["D", "E", "Fis", "G", "A", "H", "Cis", "D"],
        "B-Dur": ["B", "C", "D", "Es", "F", "G", "A", "B"], "A-Moll": ["A", "H", "C", "D", "E", "F", "G", "A"],
        "E-Moll": ["E", "Fis", "G", "A", "H", "C", "D", "E"], "D-Moll": ["D", "E", "F", "G", "A", "B", "C", "D"],
    ]

    func testScaleExercises() {
        var staffs = 0, missing = 0, degrees = 0, banks = 0
        for (_, exercise) in all(unit: 5) {
            if exercise.id.contains(".staff."), let spec = staff(exercise) {
                let answer = exercise.correctAnswers[0]
                let diffs = zip(spec.notes, spec.notes.dropFirst()).map { $1.pitch.midi - $0.pitch.midi }
                XCTAssertEqual(diffs, answer.hasSuffix("Dur") ? [2, 2, 1, 2, 2, 2, 1] : [2, 1, 2, 2, 1, 2, 2], exercise.id)
                XCTAssertEqual(spec.notes.map { $0.pitch.germanName }, scales[answer], exercise.id)
                staffs += 1
            }
            if exercise.id.contains(".missing.") {
                let name = String(exercise.prompt.prefix { $0 != ":" })
                let body = exercise.prompt.dropFirst(name.count + 2).components(separatedBy: ". Welcher").first!
                let shown = body.components(separatedBy: " – ")
                let index = shown.firstIndex(of: "?")!
                XCTAssertEqual(scales[name]![index], exercise.correctAnswers[0], exercise.id)
                for (i, text) in shown.enumerated() where i != index { XCTAssertEqual(text, scales[name]![i]) }
                missing += 1
            }
            if exercise.id.contains(".degree.") {
                let name = String(exercise.prompt.components(separatedBy: " der ").last!.prefix { $0 != "-" }) + "-" + (exercise.prompt.contains("Dur-Tonleiter") ? "Dur" : "Moll")
                let number = Int(exercise.prompt.components(separatedBy: ". Ton").first!.components(separatedBy: " ").last!)!
                XCTAssertEqual(scales[name]![number - 1], exercise.correctAnswers[0], exercise.prompt)
                degrees += 1
            }
            if exercise.id.contains(".bank.") {
                let name = exercise.id.split(separator: ".").last.map(String.init)!
                XCTAssertEqual(exercise.correctAnswers, Array(scales[name]!.dropLast()))
                for extra in exercise.options where !exercise.correctAnswers.contains(extra) {
                    XCTAssertFalse(scales[name]!.contains(extra), "extra tile \(extra) belongs to \(name)")
                }
                banks += 1
            }
            if exercise.id.contains(".acc.") {
                let signs = ["C-Dur": "keine Vorzeichen", "G-Dur": "Fis", "F-Dur": "B", "D-Dur": "Fis und Cis", "B-Dur": "B und Es",
                             "A-Moll": "keine Vorzeichen", "E-Moll": "Fis", "D-Moll": "B"]
                let name = exercise.id.components(separatedBy: ".acc.").last!
                XCTAssertEqual(exercise.correctAnswers[0], signs[name], exercise.id)
            }
        }
        XCTAssertGreaterThan(staffs, 30)
        XCTAssertGreaterThan(missing, 60)
        XCTAssertGreaterThan(degrees, 30)
        XCTAssertGreaterThan(banks, 20)
    }

    func testScalePairsAndFirstLessonScope() {
        // Lesson 1 only teaches C and G major: the scales built there are those.
        let lesson1 = provider.course.nodes.first { $0.id == "music.u05.l1" }!
        for seed in seeds {
            for exercise in provider.exercises(for: lesson1, seed: seed) where exercise.id.contains(".missing.") || exercise.id.contains(".degree.") || exercise.id.contains(".bank.") {
                XCTAssertTrue(exercise.id.contains("C-Dur") || exercise.id.contains("G-Dur") || exercise.id.contains("pattern"), exercise.id)
            }
        }
        let signs = ["C-Dur": "keine Vorzeichen", "G-Dur": "Fis", "F-Dur": "B", "D-Dur": "Fis und Cis", "B-Dur": "B und Es"]
        for (_, exercise) in all(unit: 5) where exercise.id.contains(".pairs.") {
            for pair in exercise.pairs { XCTAssertEqual(signs[pair.front], pair.back) }
        }
    }

    // MARK: Unit 6: intervals

    private let intervalFacts: [String: (steps: Int, semis: Int)] = [
        "reine Prim": (0, 0), "kleine Sekunde": (1, 1), "große Sekunde": (1, 2), "kleine Terz": (2, 3), "große Terz": (2, 4), "reine Quarte": (3, 5),
        "reine Quinte": (4, 7), "kleine Sexte": (5, 8), "große Sexte": (5, 9), "kleine Septime": (6, 10), "große Septime": (6, 11), "reine Oktave": (7, 12),
    ]
    private let sizeSteps = ["Prim": 0, "Sekunde": 1, "Terz": 2, "Quarte": 3, "Quinte": 4, "Sexte": 5, "Septime": 6, "Oktave": 7]

    func testIntervalExercises() {
        var named = 0, numbers = 0, built = 0, ears = 0, semisAsked = 0
        for (_, exercise) in all(unit: 6) {
            if exercise.id.contains(".name.") || exercise.id.contains(".nametype."), let spec = staff(exercise), spec.notes.count == 2 {
                let facts = intervalFacts[exercise.correctAnswers[0]]!
                let a = spec.notes[0].pitch, b = spec.notes[1].pitch
                XCTAssertEqual(b.midi - a.midi, facts.semis, exercise.id)
                XCTAssertEqual(b.diatonic - a.diatonic, facts.steps, exercise.id)
                named += 1
            }
            if exercise.id.contains(".num."), let spec = staff(exercise), spec.notes.count == 2 {
                XCTAssertEqual(spec.notes[1].pitch.diatonic - spec.notes[0].pitch.diatonic, sizeSteps[exercise.correctAnswers[0]], exercise.id)
                numbers += 1
            }
            if exercise.id.contains(".build.") || exercise.id.contains(".buildchoice."), let spec = staff(exercise), let base = spec.notes.first?.pitch {
                // "Baue eine große Terz über D." / "Welcher Ton liegt eine große Terz über D?"
                let name = intervalFacts.keys.first { exercise.prompt.contains($0) }!
                let facts = intervalFacts[name]!
                let parsed = MusicNames.parse(exercise.correctAnswers[0])!
                let answer = Pitch(letter: parsed.letter, octave: 0, alteration: parsed.alteration)
                let letterSteps = (parsed.letter - base.letter + 7) % 7
                XCTAssertEqual(letterSteps, facts.steps % 7, exercise.id)
                XCTAssertEqual((answer.pitchClass - base.pitchClass + 12) % 12, facts.semis % 12, exercise.id)
                built += 1
            }
            if exercise.id.contains(".hear."), let spec = tones(exercise) {
                XCTAssertFalse(spec.together)
                XCTAssertEqual(intervalFacts[exercise.correctAnswers[0]]!.semis, spec.midi[1] - spec.midi[0], exercise.id)
                ears += 1
            }
            if exercise.id.contains(".semis."), let name = intervalFacts.keys.first(where: { exercise.prompt.contains($0) }) {
                XCTAssertEqual(Int(exercise.correctAnswers[0]), intervalFacts[name]!.semis)
                semisAsked += 1
            }
            if exercise.id.contains(".invert.") {
                let name = intervalFacts.keys.first { exercise.prompt.contains($0) }!
                let inverse = intervalFacts[exercise.correctAnswers[0]]!, original = intervalFacts[name]!
                XCTAssertEqual(inverse.semis + original.semis, 12)
                XCTAssertEqual(inverse.steps + original.steps, 7)
            }
            if exercise.kind == .pianoKey {
                let name = intervalFacts.keys.first { exercise.prompt.contains($0) }!
                let base = MusicNames.parse(String(exercise.prompt.components(separatedBy: " über ").last!.split(separator: " ").first!))!
                let basePitch = Pitch(letter: base.letter, octave: 4, alteration: base.alteration)
                let expected = (basePitch.pitchClass + intervalFacts[name]!.semis) % 12
                XCTAssertTrue(exercise.correctAnswers.allSatisfy { Int($0)! % 12 == expected }, exercise.id)
            }
        }
        XCTAssertGreaterThan(named, 60)
        XCTAssertGreaterThan(numbers, 60)
        XCTAssertGreaterThan(built, 60)
        XCTAssertGreaterThan(ears, 60)
        XCTAssertGreaterThan(semisAsked, 20)
    }

    func testEarExercisesOnlyUseWhatTheLessonTaught() {
        // Lesson 2 of the unit names seconds to the octave, lesson 3 adds sixths and sevenths; lesson 1 has no ear exercises.
        let allowed: [String: Set<Int>] = ["music.u06.l2": [2, 3, 4, 5, 7, 12], "music.u06.l3": [3, 4, 5, 7, 8, 9, 10, 12]]
        for node in provider.course.nodes where node.unitNumber == 6 && node.kind != .chest {
            for seed in seeds {
                for exercise in provider.exercises(for: node, seed: seed) {
                    guard let spec = tones(exercise) else { continue }
                    XCTAssertNotEqual(node.id, "music.u06.l1")
                    if let pool = allowed[node.id] {
                        XCTAssertTrue(pool.contains(spec.midi[1] - spec.midi[0]), "\(node.id): \(spec.midi)")
                        for option in exercise.options { XCTAssertTrue(pool.contains(intervalFacts[option]!.semis), "\(node.id): option \(option)") }
                    }
                    XCTAssertNotEqual(spec.midi[1] - spec.midi[0], 6, "no tritone by ear")
                }
            }
        }
        let earlyEars = provider.course.nodes.filter { $0.unitNumber == 4 && $0.index == 1 && $0.kind == .lesson }
        for node in earlyEars { XCTAssertTrue(provider.exercises(for: node, seed: 1).allSatisfy { tones($0) == nil }) }
    }

    // MARK: Unit 7: triads

    private let triads: [String: [String]] = [
        "C-Dur": ["C", "E", "G"], "G-Dur": ["G", "H", "D"], "F-Dur": ["F", "A", "C"], "D-Dur": ["D", "Fis", "A"], "A-Moll": ["A", "C", "E"],
        "E-Moll": ["E", "G", "H"], "D-Moll": ["D", "F", "A"], "Es-Dur": ["Es", "G", "B"], "B-Dur": ["B", "D", "F"], "As-Dur": ["As", "C", "Es"],
        "G-Moll": ["G", "B", "D"], "C-Moll": ["C", "Es", "G"], "F-Moll": ["F", "As", "C"],
    ]

    func testTriadExercises() {
        var staffs = 0, ears = 0, missing = 0, banks = 0, pairs = 0
        for (_, exercise) in all(unit: 7) {
            if exercise.id.contains(".staff."), let spec = staff(exercise) {
                XCTAssertTrue(spec.chord)
                XCTAssertEqual(spec.notes.map { $0.pitch.germanName }, triads[exercise.correctAnswers[0]], exercise.id)
                staffs += 1
            }
            if exercise.id.contains(".kind."), let spec = staff(exercise) {
                let diffs = zip(spec.notes, spec.notes.dropFirst()).map { $1.pitch.midi - $0.pitch.midi }
                XCTAssertEqual(exercise.correctAnswers[0], diffs == [4, 3] ? "Dur" : "Moll")
                XCTAssertTrue(diffs == [4, 3] || diffs == [3, 4])
            }
            if exercise.id.contains(".hear."), let spec = tones(exercise) {
                XCTAssertTrue(spec.together)
                let diffs = zip(spec.midi, spec.midi.dropFirst()).map { $1 - $0 }
                XCTAssertTrue(diffs == [4, 3] || diffs == [3, 4], "\(spec.midi)")
                XCTAssertEqual(exercise.correctAnswers[0], diffs == [4, 3] ? "Dur" : "Moll")
                XCTAssertEqual(exercise.options.sorted(), ["Dur", "Moll"])
                ears += 1
            }
            if exercise.id.contains(".missing.") {
                let name = String(exercise.prompt.prefix { $0 != ":" })
                let shown = exercise.prompt.dropFirst(name.count + 2).components(separatedBy: ". Welcher").first!.components(separatedBy: " – ")
                XCTAssertEqual(triads[name]![shown.firstIndex(of: "?")!], exercise.correctAnswers[0])
                missing += 1
            }
            if exercise.id.contains(".bank.") {
                XCTAssertEqual(exercise.correctAnswers, triads[exercise.id.components(separatedBy: ".bank.").last!])
                banks += 1
            }
            if exercise.id.contains(".pairs.") {
                for pair in exercise.pairs { XCTAssertEqual(pair.back, triads[pair.front]!.joined(separator: " – ")) }
                pairs += 1
            }
            if exercise.id.contains(".part.") {
                let name = exercise.prompt.components(separatedBy: " des ")[1].components(separatedBy: "-Dreiklangs").first!
                let index = exercise.prompt.contains("Terz") ? 1 : 2
                XCTAssertEqual(exercise.correctAnswers[0], triads[name]![index])
            }
        }
        XCTAssertGreaterThan(staffs, 40)
        XCTAssertGreaterThan(ears, 40)
        XCTAssertGreaterThan(missing, 40)
        XCTAssertGreaterThan(banks, 40)
        XCTAssertGreaterThan(pairs, 10)
    }

    func testHearingMajorOnlyAfterBothQualitiesAreTaught() {
        let first = provider.course.nodes.first { $0.id == "music.u07.l1" }!
        for seed in seeds { XCTAssertTrue(provider.exercises(for: first, seed: seed).allSatisfy { tones($0) == nil }) }
    }

    // MARK: Unit 8: keys

    private let majors = [0: "C-Dur", 1: "G-Dur", 2: "D-Dur", 3: "A-Dur", 4: "E-Dur", -1: "F-Dur", -2: "B-Dur", -3: "Es-Dur", -4: "As-Dur"]
    private let relatives = ["C-Dur": "A-Moll", "G-Dur": "E-Moll", "D-Dur": "H-Moll", "A-Dur": "Fis-Moll", "E-Dur": "Cis-Moll", "F-Dur": "D-Moll",
                             "B-Dur": "G-Moll", "Es-Dur": "C-Moll", "As-Dur": "F-Moll"]

    func testKeyExercises() {
        var reads = 0, notes = 0, relations = 0, circles = 0
        let sharpLetters = [3, 0, 4, 1, 5, 2, 6], flatLetters = [6, 2, 5, 1, 4, 0, 3]
        for (_, exercise) in all(unit: 8) {
            if exercise.id.contains(".read."), let spec = staff(exercise) {
                XCTAssertEqual(exercise.correctAnswers[0], majors[spec.keySignature], exercise.id)
                reads += 1
            }
            if exercise.id.contains(".readminor."), let spec = staff(exercise) {
                XCTAssertEqual(exercise.correctAnswers[0], relatives[majors[spec.keySignature]!], exercise.id)
            }
            if exercise.id.contains(".note.") || exercise.id.contains(".notetype."), let spec = staff(exercise), let note = spec.notes.first {
                let key = spec.keySignature
                let expected = key > 0 && sharpLetters.prefix(key).contains(note.pitch.letter) ? 1 : key < 0 && flatLetters.prefix(-key).contains(note.pitch.letter) ? -1 : 0
                XCTAssertEqual(note.pitch.alteration, expected)
                let table = [1: ["F": "Fis", "C": "Cis", "G": "Gis", "D": "Dis"], -1: ["H": "B", "E": "Es", "A": "As", "D": "Des"]]
                let letter = Pitch.letterNames[note.pitch.letter]
                XCTAssertEqual(exercise.correctAnswers[0], expected == 0 ? letter : table[expected]![letter], exercise.id)
                notes += 1
            }
            if exercise.id.contains(".relminor") || exercise.id.contains(".relmajor") {
                let major = exercise.prompt.contains("Paralleltonart von ") ? String(exercise.prompt.components(separatedBy: "Paralleltonart von ")[1].dropLast()) : exercise.correctAnswers[0]
                let minor = exercise.id.contains(".relmajor") ? exercise.prompt.components(separatedBy: "gehört ")[1].components(separatedBy: " als").first! : exercise.correctAnswers[0]
                XCTAssertEqual(relatives[major], minor, exercise.id)
                relations += 1
            }
            if exercise.id.contains(".keyof"), let count = Int(exercise.id.split(separator: ".").last!) {
                XCTAssertEqual(exercise.correctAnswers[0], majors[count], exercise.id)
            }
            if exercise.id.contains(".circle.") {
                // eine Quinte über / unter X
                let from = String(exercise.prompt.components(separatedBy: (exercise.prompt.contains("über") ? "über " : "unter ")).last!.dropLast())
                let start = majors.first { $0.value == from }!.key
                XCTAssertEqual(majors[start + (exercise.prompt.contains("über") ? 1 : -1)], exercise.correctAnswers[0])
                circles += 1
            }
            if exercise.id.contains(".order."), exercise.kind == .wordBank {
                XCTAssertTrue(exercise.correctAnswers == ["Fis", "Cis", "Gis", "Dis"] || exercise.correctAnswers == ["B", "Es", "As", "Des"])
            }
            if exercise.id.contains(".pairs."), exercise.kind == .matchPairs, exercise.pairs.first?.back.contains("Moll") == false {
                let signs: [String: String] = ["C-Dur": "keine Vorzeichen", "G-Dur": "1 Kreuz", "D-Dur": "2 Kreuze", "A-Dur": "3 Kreuze", "E-Dur": "4 Kreuze",
                                               "F-Dur": "1 Be", "B-Dur": "2 Be", "Es-Dur": "3 Be", "As-Dur": "4 Be"]
                for pair in exercise.pairs { XCTAssertEqual(signs[pair.front], pair.back) }
            }
        }
        XCTAssertGreaterThan(reads, 40)
        XCTAssertGreaterThan(notes, 40)
        XCTAssertGreaterThan(relations, 40)
        XCTAssertGreaterThan(circles, 20)
    }

    // MARK: Media rules

    func testMediaIsOnlyStaffAndTones() {
        var withStaff = Set<Int>(), withTones = Set<Int>()
        for unit in 1...8 {
            for (_, exercise) in all(unit: unit) {
                switch exercise.media {
                case .staff?: withStaff.insert(unit)
                case .tones?: withTones.insert(unit)
                case nil: break
                default: XCTFail("\(exercise.id) uses media the course must not use")
                }
                XCTAssertTrue([ExerciseKind.multipleChoice, .pianoKey, .typeAnswer, .wordBank, .matchPairs].contains(exercise.kind))
                if exercise.kind == .pianoKey { XCTAssertFalse(exercise.correctAnswers.isEmpty) }
            }
        }
        XCTAssertEqual(withStaff, [1, 2, 3, 5, 6, 7, 8, 4])
        XCTAssertEqual(withTones, [4, 6, 7])
    }
}
