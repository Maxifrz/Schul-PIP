import XCTest
@testable import Lernwerk

final class ExerciseBuilderTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)
    private let material = UUID(uuidString: "00000000-0000-0000-0000-0000000000C1")!

    private func card(_ front: String, _ back: String, _ index: Int, material: UUID? = nil) -> CardSnapshot {
        CardSnapshot(front: front, back: back, materialID: material ?? self.material, createdAt: start.addingTimeInterval(Double(index)), dueDate: start)
    }

    private var capitals: [CardSnapshot] {
        [
            card("Hauptstadt von Deutschland?", "Berlin", 0),
            card("Hauptstadt von Frankreich?", "Paris", 1),
            card("Hauptstadt von Italien?", "Rom", 2),
            card("Hauptstadt von Spanien?", "Madrid", 3),
            card("Hauptstadt von Polen?", "Warschau", 4),
            card("Hauptstadt von Österreich?", "Wien", 5),
        ]
    }

    private var biology: [CardSnapshot] {
        [
            card("Was macht die Photosynthese?", "Sie wandelt Licht in chemische Energie um", 10),
            card("Wo findet die Photosynthese statt?", "In den Chloroplasten der Pflanzenzelle", 11),
            card("Was ist das Kraftwerk der Zelle?", "Das Mitochondrium", 12),
            card("Was steuert die Zelle?", "Der Zellkern mit der Erbinformation", 13),
            card("Ableitung von x²?", "2x", 14),
            card("Wie lautet die Kettenregel?", "f′(x) = h′(g(x)) · g′(x)", 15),
        ]
    }

    private func exercises(_ lesson: [CardSnapshot], deck: [CardSnapshot]? = nil, seed: UInt64 = 1, cached: [String: [String]] = [:]) -> [LearnExercise] {
        ExerciseBuilder(lesson: lesson, deck: deck ?? lesson, cachedDistractors: cached).build(seed: seed)
    }

    func testALessonHasEightToTwelveExercisesFromEasyToHardAndEveryCardEndsTyped() {
        for seed in UInt64(1)...20 {
            let built = exercises(capitals, deck: capitals + biology, seed: seed)
            XCTAssertTrue((8...12).contains(built.count), "seed \(seed): \(built.count)")
            let difficulties = built.map(\.kind.difficulty)
            XCTAssertEqual(difficulties, difficulties.sorted())
            XCTAssertEqual(Set(built.map(\.id)).count, built.count)
            for card in capitals {
                let mine = built.filter { $0.cardKeys.contains(card.key) }
                XCTAssertEqual(mine.last?.kind, .typeAnswer)
                XCTAssertEqual(mine.filter { $0.kind == .typeAnswer }.count, 1)
                XCTAssertGreaterThan(mine.count, 1, "every card gets an easy exercise before typing")
            }
        }
    }

    func testTheSameSeedBuildsTheSameLesson() {
        let deck = capitals + biology
        XCTAssertEqual(exercises(biology, deck: deck, seed: 42), exercises(biology, deck: deck, seed: 42))
        XCTAssertEqual(exercises(capitals, deck: deck, seed: 7), exercises(capitals, deck: deck, seed: 7))
        let seeds = (UInt64(1)...10).map { exercises(capitals, deck: deck, seed: $0) }
        XCTAssertGreaterThan(Set(seeds.map { $0.map(\.id) + $0.flatMap(\.options) }).count, 1)
    }

    func testWithoutThreeWrongAnswersACardIsOnlyTyped() {
        let small = Array(capitals.prefix(3))
        let built = exercises(small)
        XCTAssertFalse(built.contains { $0.kind == .multipleChoice })
        XCTAssertEqual(Set(built.filter { $0.kind == .typeAnswer }.flatMap(\.cardKeys)), Set(small.map(\.key)))
    }

    func testAWrongAnswerTheCheckWouldAcceptIsDropped() {
        let berlin = card("Hauptstadt von Deutschland?", "Berlin", 0)
        let lookalikes = [
            card("Größte Stadt?", "berlin", 1),
            card("Regierungssitz?", "Berlin.", 2),
            card("Bundeshauptstadt?", "Berlin / Bundeshauptstadt", 3),
            card("Stadt an der Spree?", "Berlinn", 4),
        ]
        // Only one clearly wrong answer: no multiple choice for Berlin.
        let thin = exercises([berlin], deck: [berlin] + lookalikes + [card("Frankreich?", "Paris", 5)])
        XCTAssertFalse(thin.contains { $0.kind == .multipleChoice && $0.cardKeys == [berlin.key] })

        let deck = [berlin] + lookalikes + Array(capitals.dropFirst())
        for seed in UInt64(1)...10 {
            guard let choice = exercises([berlin], deck: deck, seed: seed).first(where: { $0.kind == .multipleChoice }) else {
                return XCTFail("expected multiple choice")
            }
            XCTAssertEqual(choice.options.count, 4)
            XCTAssertEqual(choice.options.filter { $0 == "Berlin" }.count, 1)
            XCTAssertTrue(Set(choice.options).isSubset(of: ["Berlin", "Paris", "Rom", "Madrid", "Warschau", "Wien"]), "\(choice.options)")
        }

        XCTAssertFalse(ExerciseBuilder.isValidDistractor("berlin", for: "Berlin"))
        XCTAssertFalse(ExerciseBuilder.isValidDistractor("Berlinn", for: "Berlin"))
        XCTAssertFalse(ExerciseBuilder.isValidDistractor("Die Kettenregel", for: "Kettenregel"))
        XCTAssertFalse(ExerciseBuilder.isValidDistractor("Kettenregel", for: "Kettenregel oder Produktregel"))
        XCTAssertFalse(ExerciseBuilder.isValidDistractor("   ", for: "Berlin"))
        XCTAssertTrue(ExerciseBuilder.isValidDistractor("Produktregel", for: "Kettenregel"))
        XCTAssertTrue(ExerciseBuilder.isValidDistractor("3", for: "4"))
        XCTAssertEqual(ExerciseBuilder.pickDistractors(for: "Berlin", from: ["Paris", "paris", "Berlin", "Rom", "Wien", "Madrid"]), ["Paris", "Rom", "Wien"])
    }

    func testWrongAnswersComeFromTheUnitFirst() {
        let other = UUID(uuidString: "00000000-0000-0000-0000-0000000000D2")!
        let foreign = [card("Farbe des Himmels?", "Blau", 20, material: other), card("Farbe von Gras?", "Grün", 21, material: other)]
        for seed in UInt64(1)...10 {
            let choice = exercises([capitals[0]], deck: capitals + foreign, seed: seed).first { $0.kind == .multipleChoice }
            XCTAssertNotNil(choice)
            XCTAssertFalse(choice?.options.contains("Blau") ?? true)
            XCTAssertFalse(choice?.options.contains("Grün") ?? true)
        }
        // A unit of two cards borrows from the others.
        let pair = [card("A?", "Eins", 30, material: other), card("B?", "Zwei", 31, material: other)]
        let borrowed = exercises([pair[0]], deck: pair + capitals).first { $0.kind == .multipleChoice }
        XCTAssertEqual(borrowed?.options.contains("Zwei"), true)
    }

    func testPairsNeedFourShortBacks() {
        let short = Array(capitals.prefix(4))
        let pairs = exercises(short, deck: capitals).filter { $0.kind == .matchPairs }
        XCTAssertEqual(pairs.count, 1)
        XCTAssertEqual(Set(pairs[0].cardKeys), Set(short.map(\.key)))
        XCTAssertEqual(pairs[0].pairs.count, 4)
        XCTAssertEqual(Set(pairs[0].options), Set(short.map(\.back)))
        XCTAssertEqual(pairs[0].correctAnswers, pairs[0].pairs.map(\.back))
        XCTAssertTrue(pairs[0].isMatch(key: short[1].key, back: "Paris"))
        XCTAssertFalse(pairs[0].isMatch(key: short[1].key, back: "Rom"))

        var long = short
        long[3] = card("Hauptstadt von Spanien?", "Madrid ist die Hauptstadt und größte Stadt Spaniens", 3)
        XCTAssertFalse(exercises(long, deck: capitals).contains { $0.kind == .matchPairs })
        XCTAssertEqual(ExerciseBuilder.wordCount("Madrid ist die Hauptstadt und größte Stadt Spaniens"), 8)
    }

    func testWordBankOnlyForPlainSentences() {
        XCTAssertEqual(ExerciseBuilder.wordBankWords("Sie wandelt Licht in chemische Energie um."), ["Sie", "wandelt", "Licht", "in", "chemische", "Energie", "um"])
        XCTAssertEqual(ExerciseBuilder.wordBankWords("Das Mitochondrium – die Zellatmung"), ["Das", "Mitochondrium", "die", "Zellatmung"])
        XCTAssertNil(ExerciseBuilder.wordBankWords("f′(x) = h′(g(x)) · g′(x)"))
        XCTAssertNil(ExerciseBuilder.wordBankWords("x / Wurzel aus x"))
        XCTAssertNil(ExerciseBuilder.wordBankWords("a - b ist negativ"))
        XCTAssertNil(ExerciseBuilder.wordBankWords("Es sind 3 Stück"))
        XCTAssertNil(ExerciseBuilder.wordBankWords("Das Mitochondrium"))
        XCTAssertNil(ExerciseBuilder.wordBankWords("eins zwei drei vier fünf sechs sieben acht neun"))

        let built = exercises(biology, deck: biology + capitals)
        let banks = built.filter { $0.kind == .wordBank }
        let formulaKeys = Set([biology[4].key, biology[5].key])
        XCTAssertTrue(banks.allSatisfy { formulaKeys.isDisjoint(with: $0.cardKeys) })
        for bank in banks {
            XCTAssertTrue(bank.options.count <= bank.correctAnswers.count + ExerciseBuilder.extraWords)
            XCTAssertGreaterThan(bank.options.count, bank.correctAnswers.count)
            var tiles = bank.options
            for word in bank.correctAnswers {
                guard let index = tiles.firstIndex(of: word) else { return XCTFail("missing tile \(word)") }
                tiles.remove(at: index)
            }
        }
    }

    func testAnswersAreCheckedPerKind() {
        let built = exercises(capitals, deck: capitals + biology)
        guard let choice = built.first(where: { $0.kind == .multipleChoice }),
              let typed = built.first(where: { $0.kind == .typeAnswer && $0.cardKeys == [capitals[0].key] })
        else { return XCTFail("expected exercises") }
        XCTAssertEqual(choice.missedKeys(for: .option(choice.correctAnswers[0])), [])
        let wrongOption = choice.options.first { $0 != choice.correctAnswers[0] } ?? ""
        XCTAssertEqual(choice.missedKeys(for: .option(wrongOption)), Set(choice.cardKeys))
        XCTAssertEqual(typed.missedKeys(for: .typed("berlin")), [])
        XCTAssertEqual(typed.missedKeys(for: .typed("Paris")), [capitals[0].key])
        XCTAssertEqual(typed.missedKeys(for: .option("Berlin")), [capitals[0].key])

        let bank = LearnExercise(id: "b", kind: .wordBank, cardKeys: ["k"], prompt: "?", correctAnswers: ["Äußere", "mal", "innere"], options: [], pairs: [], solution: "")
        XCTAssertEqual(bank.missedKeys(for: .words(["aeussere", "Mal", "innere"])), [])
        XCTAssertEqual(bank.missedKeys(for: .words(["innere", "mal", "Äußere"])), ["k"])
        XCTAssertEqual(bank.missedKeys(for: .words(["Äußere", "mal"])), ["k"])
    }

    func testCachedWrongAnswersFillAThinDeck() {
        let small = Array(capitals.prefix(2))
        let berlin = small[0]
        XCTAssertEqual(ExerciseBuilder.cardsNeedingDistractors(in: small).map(\.key), small.map(\.key))
        XCTAssertTrue(ExerciseBuilder.cardsNeedingDistractors(in: capitals).isEmpty)

        let cached = [berlin.key: ["München", "berlin", "Hamburg", "Köln"]]
        let choice = exercises([berlin], deck: small, cached: cached).first { $0.kind == .multipleChoice }
        XCTAssertNotNil(choice)
        XCTAssertEqual(Set(choice?.options ?? []), ["Berlin", "Paris", "München", "Hamburg"])

        let tooFew = [berlin.key: ["Berlin", "Bonn"]]
        XCTAssertFalse(exercises([berlin], deck: small, cached: tooFew).contains { $0.kind == .multipleChoice })
    }

    func testACardWithTheSameQuestionIsNoWrongAnswer() {
        let rule = card("Wie lautet die Kettenregel?", "Äußere Ableitung mal innere Ableitung", 0)
        let formula = card("Wie lautet die Kettenregel?", "f′(x) = u′(v(x)) · v′(x)", 1)
        let longer = card("Wie lautet die Kettenregel für verkettete Funktionen?", "Nachdifferenzieren", 2)
        let others = [card("Produktregel?", "u′v + uv′", 3), card("Quotientenregel?", "(u′v − uv′) / v²", 4), card("Ableitung von sin?", "cos", 5)]
        XCTAssertTrue(ExerciseBuilder.asksTheSame(rule, formula))
        XCTAssertTrue(ExerciseBuilder.asksTheSame(rule, longer))
        XCTAssertFalse(ExerciseBuilder.asksTheSame(rule, others[0]))
        XCTAssertFalse(ExerciseBuilder.asksTheSame(capitals[0], capitals[1]))
        let deck = [rule, formula, longer] + others
        for seed in UInt64(1)...20 {
            let choice = exercises([rule], deck: deck, seed: seed).first { $0.kind == .multipleChoice }
            XCTAssertNotNil(choice)
            XCTAssertFalse(choice?.options.contains(formula.back) ?? true)
            XCTAssertFalse(choice?.options.contains(longer.back) ?? true)
        }
        // Without the cards that ask the same, the deck has too few wrong answers for the rule.
        XCTAssertEqual(ExerciseBuilder.cardsNeedingDistractors(in: [rule, formula, longer, others[0], others[1]]).map(\.key).contains(rule.key), true)
    }

    func testFromFourCardsALessonAlwaysReachesEight() {
        // Formulas for the same question: no word bank, no pairs and no multiple choice.
        let formulas = [
            card("Nenne eine binomische Formel.", "(a + b)² = a² + 2ab + b²", 0),
            card("Nenne eine binomische Formel.", "(a − b)² = a² − 2ab + b²", 1),
            card("Nenne eine binomische Formel.", "(a + b) · (a − b) = a² − b²", 2),
            card("Nenne eine binomische Formel.", "(a + b)³ = a³ + 3a²b + 3ab² + b³", 3),
        ]
        let only = exercises(formulas, deck: formulas)
        XCTAssertEqual(only.count, 8)
        XCTAssertTrue(only.allSatisfy { $0.kind == .typeAnswer })
        XCTAssertEqual(Set(only.map(\.id)).count, 8)
        for card in formulas {
            XCTAssertEqual(only.filter { $0.cardKeys == [card.key] }.count, 2)
        }
        for count in 4...9 {
            let lesson = (0..<count).map { card("Frage \($0)?", "Antwort mit \($0) Punkten und Komma, lang genug für keine Paare hier", $0) }
            for seed in UInt64(1)...5 {
                let built = exercises(lesson, deck: lesson, seed: seed)
                XCTAssertTrue((8...12).contains(built.count), "\(count) cards: \(built.count)")
                let difficulties = built.map(\.kind.difficulty)
                XCTAssertEqual(difficulties, difficulties.sorted())
                XCTAssertEqual(Set(built.map(\.id)).count, built.count)
            }
        }
    }

    func testAShortLessonRepeatsItsEasyExercisesOnce() {
        let two = Array(capitals.prefix(2))
        let built = exercises(two, deck: capitals)
        // Two typed, two multiple choice and each once more: six, the most these cards allow.
        XCTAssertEqual(built.filter { $0.kind == .typeAnswer }.count, 2)
        XCTAssertEqual(built.filter { $0.kind == .multipleChoice }.count, 4)
        XCTAssertEqual(Set(built.map(\.id)).count, built.count)
        XCTAssertTrue(exercises([], deck: capitals).isEmpty)
    }
}
