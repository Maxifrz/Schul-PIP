import XCTest
@testable import Lernwerk

final class LanguageCourseTests: XCTestCase {
    private let provider = LanguageSample.provider()

    private func exercises(_ node: CourseNode, seed: UInt64 = 1) -> [LearnExercise] {
        provider.exercises(for: node, seed: seed)
    }

    func testTheSampleCoursePassesTheAudit() {
        XCTAssertEqual(CourseAudit.problems(of: provider, seeds: Array(1...12)), [])
    }

    func testTheSameSeedGivesTheSameLessonAndAnotherSeedShufflesIt() throws {
        let node = try XCTUnwrap(provider.course.node(withID: "sample.u01.l1"))
        XCTAssertEqual(exercises(node), exercises(node))
        let variants = Set((1...10).map { exercises(node, seed: UInt64($0)).map(\.id).joined(separator: ",") })
        XCTAssertGreaterThan(variants.count, 3)
    }

    func testEveryLessonMixesKindsAndGoesFromEasyToHard() {
        for node in provider.course.nodes where node.kind != .chest {
            for seed in UInt64(1)...5 {
                let list = exercises(node, seed: seed)
                XCTAssertGreaterThanOrEqual(Set(list.map(\.kind)).count, 3, "\(node.id) seed \(seed): \(list.map(\.kind))")
                XCTAssertEqual(list.first?.kind, .multipleChoice)
            }
        }
    }

    func testALessonTeachesItsShareAndTheCheckpointTheWholeUnit() {
        let unit = provider.data.units[0]
        XCTAssertEqual(provider.course.units[0].nodes.filter { $0.kind == .lesson }.count, 5, "29 items, six per lesson")
        func words(_ id: String) -> Set<String> {
            var seen = Set<String>()
            let node = provider.course.node(withID: id)!
            for seed in UInt64(1)...6 {
                for exercise in provider.exercises(for: node, seed: seed) {
                    for (index, word) in unit.words.enumerated() where exercise.id.contains("#w0-\(index)") { seen.insert(word.target) }
                }
            }
            return seen
        }
        let first = words("sample.u01.l1")
        let last = words("sample.u01.l5")
        XCTAssertTrue(first.contains("hola"))
        XCTAssertFalse(first.contains("tú"), "the last words are for the last lessons")
        XCTAssertTrue(last.contains("tú") || last.contains("el nombre"))
        XCTAssertFalse(last.contains("hola"))
        XCTAssertGreaterThan(words("sample.u01.t").count, 8, "the checkpoint covers most of the unit")
    }

    func testEveryWordMeetsTheStudentInSeveralFormsAcrossTheUnit() {
        let unit = provider.data.units[0]
        for (index, word) in unit.words.enumerated() {
            var forms = Set<String>()
            for node in provider.course.units[0].nodes where node.kind != .chest {
                for seed in UInt64(1)...3 {
                    for exercise in provider.exercises(for: node, seed: seed) where exercise.id.contains("#w0-\(index)") {
                        forms.insert(String(exercise.id.last!))
                    }
                }
            }
            XCTAssertGreaterThanOrEqual(forms.count, 3, "\(word.target): \(forms.sorted())")
        }
    }

    func testWrongAnswersOfWordsAndSentencesAreNeverAlsoRight() {
        let words = provider.data.units.flatMap(\.words)
        for node in provider.course.nodes where node.kind != .chest {
            for seed in UInt64(1)...6 {
                for exercise in exercises(node, seed: seed) where exercise.kind == .multipleChoice {
                    guard exercise.id.contains("#w") || exercise.id.contains("#s") else { continue }
                    let wrong = exercise.options.filter { !exercise.correctAnswers.contains($0) }
                    for option in wrong {
                        XCTAssertNotEqual(
                            AnswerCheck.evaluate(answer: option, expected: exercise.correctAnswers[0]), .correct,
                            "\(exercise.id): \(option) vs \(exercise.correctAnswers[0])"
                        )
                    }
                    if exercise.id.hasSuffix("a"), exercise.prompt.hasPrefix("Was bedeutet") {
                        // Recognition of a word: no option is another meaning of the same word.
                        for word in words where exercise.prompt.contains("„\(word.target)“") {
                            XCTAssertTrue(Set(wrong.map(LearnExercise.folded)).isDisjoint(with: Set(word.meanings.map(LearnExercise.folded))))
                        }
                    }
                }
            }
        }
    }

    /// What a typed answer misses; a long chain of literals in one expression is too much for the type checker.
    private func missed(_ exercise: LearnExercise, _ text: String) -> Set<String> {
        exercise.missedKeys(for: LearnAnswer.typed(text))
    }

    func testTypedAnswersInTheLanguageBeingLearnedAreStrict() throws {
        let node = try XCTUnwrap(provider.course.node(withID: "sample.u02.t"))
        var all: [LearnExercise] = []
        for seed in 1...40 { all += exercises(node, seed: UInt64(seed)) }
        let exact: [LearnExercise] = all.filter { $0.kind == .typeAnswer && $0.mode == .exact }
        let accepted: [[String]] = [["Me llamo Ana."], ["Tengo un hermano."]]
        let word = try XCTUnwrap(exact.first { $0.correctAnswers == ["el hermano"] })
        XCTAssertEqual(missed(word, "El Hermano"), Set<String>())
        XCTAssertEqual(missed(word, "el hermana"), Set([word.cardKeys[0]]), "one letter is another word in Spanish")
        let sentence = try XCTUnwrap(exact.first { accepted.contains($0.correctAnswers) })
        let right = sentence.correctAnswers[0]
        XCTAssertEqual(missed(sentence, right.lowercased()), Set<String>())
        let words: [String] = right.split(separator: " ").map { String($0) }
        let reversed = words.reversed().joined(separator: " ")
        XCTAssertEqual(missed(sentence, reversed), Set([sentence.cardKeys[0]]), "word order matters")
    }

    func testListeningAndSpeechOnlyWithAVoice() {
        let node = provider.course.node(withID: "sample.u01.p")!
        let list = (1...6).flatMap { exercises(node, seed: UInt64($0)) }
        XCTAssertTrue(list.contains { $0.prompt.hasPrefix("Tippe auf den Lautsprecher") && $0.media == .speech(text: $0.correctAnswers[0], language: "es-ES") })
        XCTAssertTrue(list.contains { if case .speech = $0.media { return true } else { return false } })

        let silent = LanguageCourseProvider.make(source: LanguageSample.source.replacingOccurrences(of: "speech: es-ES\n", with: "")).provider
        XCTAssertNil(silent.data.speech)
        for node in silent.course.nodes where node.kind != .chest {
            for exercise in silent.exercises(for: node, seed: 2) {
                XCTAssertNil(exercise.media)
                XCTAssertFalse(exercise.prompt.hasPrefix("Tippe auf den Lautsprecher"))
            }
        }
        XCTAssertEqual(CourseAudit.problems(of: silent, seeds: [1, 2, 3]), [])
    }

    func testTypedAnswersAcceptAlternativesAndForgiveAccentsAndTypos() throws {
        let node = provider.course.node(withID: "sample.u01.t")!
        var checked = 0
        for seed in UInt64(1)...30 {
            for exercise in exercises(node, seed: seed) where exercise.kind == .typeAnswer && exercise.id.hasSuffix("e") {
                if exercise.correctAnswers.count > 1 {
                    XCTAssertEqual(missed(exercise, exercise.correctAnswers[1]), Set<String>())
                    checked += 1
                }
            }
        }
        XCTAssertGreaterThan(checked, 0, "adiós has two meanings and appears typed in some checkpoint")
        var pool: [LearnExercise] = []
        for seed in 1...60 { pool += exercises(node, seed: UInt64(seed)) }
        let typed = try XCTUnwrap(pool.first { $0.kind == .typeAnswer && $0.correctAnswers[0] == "buenos días" })
        XCTAssertEqual(missed(typed, "buenos dias"), Set<String>(), "accents are forgiven")
        XCTAssertEqual(missed(typed, "buenas noches"), Set([typed.cardKeys[0]]))
    }

    func testFormsAreChosenFromTheirOwnVerbAndFillsKeepTheirChoices() {
        let lessons = provider.course.units[0].nodes.filter { $0.kind == .lesson }
        let list = (1...8).flatMap { seed in lessons.flatMap { exercises($0, seed: UInt64(seed)) } }
        let form = list.first { $0.prompt.hasPrefix("Bilde die Form") && $0.kind == .multipleChoice }
        XCTAssertNotNil(form)
        if let form {
            XCTAssertTrue(Set(form.options).isSubset(of: ["soy", "eres", "es", "somos"]), "\(form.options)")
        }
        let fill = list.first { $0.prompt.hasPrefix("Welches Wort fehlt") && $0.kind == .multipleChoice }
        XCTAssertNotNil(fill)
        if let fill {
            XCTAssertTrue(fill.solution.contains(fill.correctAnswers[0]) && !fill.solution.contains("___"))
        }
    }

    func testWordBankTilesHaveNoPunctuationAndAcceptTheRightOrder() throws {
        let node = provider.course.node(withID: "sample.u01.p")!
        let banks = (1...20).flatMap { exercises(node, seed: UInt64($0)) }.filter { $0.kind == .wordBank }
        XCTAssertFalse(banks.isEmpty)
        for bank in banks {
            XCTAssertTrue(bank.options.allSatisfy { !$0.contains(".") && !$0.contains("¿") && !$0.contains("?") && !$0.contains(",") }, "\(bank.options)")
            XCTAssertEqual(bank.missedKeys(for: .words(bank.correctAnswers)), [])
            XCTAssertFalse(bank.solution.isEmpty)
        }
    }

    func testPairsMatchWordsToMeanings() {
        let node = provider.course.node(withID: "sample.u02.t")!
        let pairs = (1...10).flatMap { exercises(node, seed: UInt64($0)) }.filter { $0.kind == .matchPairs }
        XCTAssertFalse(pairs.isEmpty)
        let words = Dictionary(uniqueKeysWithValues: provider.data.units.flatMap(\.words).map { ($0.target, $0.meanings[0]) })
        for exercise in pairs {
            XCTAssertEqual(exercise.pairs.count, 4)
            for pair in exercise.pairs { XCTAssertEqual(words[pair.front], pair.back) }
        }
    }

    func testPracticeBringsBackEarlierUnits() {
        let node = provider.course.node(withID: "sample.u02.p")!
        let ids = (1...10).flatMap { exercises(node, seed: UInt64($0)) }.map(\.id)
        XCTAssertTrue(ids.contains { $0.contains("#w0-") || $0.contains("#s0-") }, "words of the first unit return in the second unit's practice")
        XCTAssertTrue(ids.contains { $0.contains("#w1-") || $0.contains("#s1-") })
    }

    func testChestsAndUnknownNodesHaveNoExercises() {
        XCTAssertTrue(exercises(provider.course.node(withID: "sample.u01.k")!).isEmpty)
        let stranger = CourseNode(id: "sample.u09.l1", courseID: "sample", unitID: "sample.u09", unitNumber: 9, kind: .lesson, index: 1, title: "x")
        XCTAssertTrue(exercises(stranger).isEmpty)
    }
}

final class LanguageCourseVariantsTests: XCTestCase {
    func testACourseThatOnlyReadsNeverAsksForFreeProduction() {
        let made = LanguageCourseProvider.make(source: LanguageSample.latinSource)
        XCTAssertEqual(made.errors, [])
        XCTAssertFalse(made.provider.data.produces)
        XCTAssertEqual(CourseAudit.problems(of: made.provider, seeds: Array(1...12)), [])
        var forms = 0
        var translations = 0
        for node in made.provider.course.nodes where node.kind != .chest {
            for seed in UInt64(1)...6 {
                for exercise in made.provider.exercises(for: node, seed: seed) {
                    XCTAssertFalse(exercise.prompt.hasPrefix("Wie sagt man"), exercise.prompt)
                    XCTAssertFalse(exercise.prompt.hasPrefix("Übersetze ins Lateinische"), exercise.prompt)
                    if exercise.prompt.hasPrefix("Bilde die Form") { forms += 1 }
                    if exercise.id.hasSuffix("f") { translations += 1; XCTAssertEqual(exercise.mode, .text) }
                    XCTAssertNil(exercise.media, "no voice for Latin")
                }
            }
        }
        XCTAssertGreaterThan(forms, 0)
        XCTAssertGreaterThan(translations, 0)
    }

    func testTheWordsGrammarNoteIsTheExplanation() throws {
        let provider = LanguageCourseProvider.make(source: LanguageSample.latinSource).provider
        let lesson = provider.course.node(withID: "la.u01.l1")!
        let list = (1...10).flatMap { provider.exercises(for: lesson, seed: UInt64($0)) }
        let word = try XCTUnwrap(list.first { $0.id.contains("#w0-0a") })
        XCTAssertEqual(word.explanation, "puella · -ae f.")
    }

    func testASchoolSubjectAsksForTermsNotForTranslations() {
        let made = LanguageCourseProvider.make(source: LanguageSample.schoolSource)
        XCTAssertEqual(made.errors, [])
        XCTAssertEqual(made.provider.course.kind, .school)
        XCTAssertEqual(CourseAudit.problems(of: made.provider, seeds: Array(1...12)), [])
        for node in made.provider.course.nodes where node.kind != .chest {
            for seed in UInt64(1)...4 {
                for exercise in made.provider.exercises(for: node, seed: seed) {
                    XCTAssertFalse(exercise.id.hasSuffix("e") && exercise.kind == .typeAnswer && exercise.id.contains("#w"), "no typed definitions")
                    XCTAssertFalse(exercise.prompt.contains("auf Deutsch"))
                }
            }
        }
    }

    func testCoverageFindsSentencesWithWordsNotTaughtYet() {
        let latin = LanguageCourseProvider.make(source: LanguageSample.latinSource).provider.data
        XCTAssertEqual(LanguageCoverage.gaps(in: latin), [], "known: and the words cover every sentence")
        let spanish = LanguageSample.provider().data
        let gaps = LanguageCoverage.gaps(in: spanish)
        XCTAssertFalse(gaps.isEmpty, "the sample uses words it never lists")
        XCTAssertTrue(gaps.contains { $0.sentence == "Me llamo Ana." && $0.words.contains("llamo") })
        XCTAssertFalse(gaps.contains { $0.sentence == "No, gracias." }, "no and gracias are words of the unit")
        XCTAssertEqual(LanguageCoverage.tokens(of: "¿Cómo te llamas? 12"), ["como", "te", "llamas"])
    }
}
