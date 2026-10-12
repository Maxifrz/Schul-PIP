import Foundation

/// Unit 1, "Das Brett": files, ranks, square names and the colors of the squares.
enum ChessUnit1 {
    static let makers: [String: ChessMaker] = [
        "u1.nameSquare": nameSquare,
        "u1.markedFile": markedFile,
        "u1.markedRank": markedRank,
        "u1.terms": terms,
        "u1.corners": corners,
        "u1.colorOfSquare": colorOfSquare,
        "u1.cornerColor": cornerColor,
        "u1.factChoice": factChoice,
        "u1.factNumber": factNumber,
        "u1.sameDiagonal": sameDiagonal,
        "u1.tapMove": tapMove,
        "u1.typeName": typeName,
        "u1.typeCorner": typeCorner,
        "u1.sentence.names": ChessKit.sentenceMaker("u1.sentence.names", nameSentences),
        "u1.sentence.colors": ChessKit.sentenceMaker("u1.sentence.colors", colorSentences),
    ]

    /// Topics worth meeting again in later units.
    static let review = ["u1.nameSquare", "u1.colorOfSquare", "u1.tapMove", "u1.typeName", "u1.sameDiagonal"]

    static let nameSentences = [
        ChessSentence(key: "linien", words: ["Die", "senkrechten", "Felderreihen", "heißen", "Linien."], extra: ["waagerechten", "Reihen."]),
        ChessSentence(key: "reihen", words: ["Die", "waagerechten", "Felderreihen", "heißen", "Reihen."], extra: ["senkrechten", "Linien."]),
        ChessSentence(key: "order", words: ["Zuerst", "kommt", "die", "Linie,", "dann", "die", "Reihe."], extra: ["Diagonale.", "zuletzt"]),
    ]

    static let colorSentences = [
        ChessSentence(key: "corner", words: ["Unten", "rechts", "liegt", "ein", "helles", "Feld."], extra: ["dunkles", "links"]),
        ChessSentence(key: "a1", words: ["Das", "Feld", "a1", "ist", "dunkel."], extra: ["hell.", "h1"]),
        ChessSentence(key: "diagonal", words: ["Auf", "einer", "Diagonale", "haben", "alle", "Felder", "dieselbe", "Farbe."], extra: ["verschiedene", "Linie"]),
    ]

    /// "Wie heißt das markierte Feld?" with the four names a student could mix up.
    static func nameSquare(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let square = draw.pickSquare(key: "u1.nameSquare") else { return nil }
        let withPieces = draw.coin()
        let marked = [square.name]
        let media: ExerciseMedia = withPieces ? .board(BoardSpec(fen: ChessPosition.startFEN, marked: marked)) : ChessKit.emptyBoard(marked: marked)
        return ChessKit.choice(
            id: "u1.nameSquare.\(square.name)", prompt: "Wie heißt das markierte Feld?", correct: square.name,
            wrong: ChessKit.squareDistractors(for: square, random: &draw.random),
            explanation: "Erst die Linie, dann die Reihe: Das Feld liegt auf der \(square.fileLetter)-Linie in der \(square.rank + 1). Reihe, also \(square.name).",
            media: media, draw: &draw
        )
    }

    static func markedFile(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let file = draw.pick(Array(0..<8), key: "u1.markedFile", id: { String($0) }) else { return nil }
        let letters = ChessSquare.fileLetters.map { String($0) }
        let marked = (1...8).map { letters[file] + String($0) }
        var wrong = [letters[7 - file]]
        var near = [file - 1, file + 1].filter { (0..<8).contains($0) }.map { letters[$0] }
        near.shuffle(using: &draw.random)
        wrong += near
        wrong += letters.filter { !wrong.contains($0) && $0 != letters[file] }.shuffled(using: &draw.random)
        return ChessKit.choice(
            id: "u1.markedFile.\(letters[file])", prompt: "Welche Linie ist markiert?", correct: letters[file], wrong: wrong,
            explanation: "Die Linien heißen von links nach rechts a bis h. Die markierte ist die \(letters[file])-Linie.",
            media: ChessKit.emptyBoard(marked: marked), draw: &draw
        )
    }

    static func markedRank(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let rank = draw.pick(Array(1...8), key: "u1.markedRank", id: { String($0) }) else { return nil }
        let marked = ChessSquare.fileLetters.map { String($0) + String(rank) }
        var wrong = [String(9 - rank)]
        var near = [rank - 1, rank + 1].filter { (1...8).contains($0) }.map(String.init)
        near.shuffle(using: &draw.random)
        wrong += near
        wrong += (1...8).map(String.init).filter { !wrong.contains($0) && $0 != String(rank) }.shuffled(using: &draw.random)
        return ChessKit.choice(
            id: "u1.markedRank.\(rank)", prompt: "Welche Reihe ist markiert?", correct: String(rank), wrong: wrong,
            explanation: "Die Reihen sind von unten nach oben von 1 bis 8 nummeriert. Die markierte ist die \(rank). Reihe.",
            media: ChessKit.emptyBoard(marked: marked), draw: &draw
        )
    }

    static func terms(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.pairs(
            id: "u1.terms", prompt: "Was ist was?",
            from: [
                (key: "u1.term.linie", front: "Linie", back: "senkrecht, a bis h"),
                (key: "u1.term.reihe", front: "Reihe", back: "waagerecht, 1 bis 8"),
                (key: "u1.term.diagonale", front: "Diagonale", back: "schräg"),
                (key: "u1.term.feld", front: "Feld", back: "ein Quadrat des Brettes"),
                (key: "u1.term.brett", front: "Schachbrett", back: "8 mal 8 Felder"),
            ],
            draw: &draw
        )
    }

    static func corners(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.pairs(
            id: "u1.corners", prompt: "Wo liegen die Eckfelder? Du schaust von Weiß aus auf das Brett.",
            from: [
                (key: "u1.corner.a1", front: "a1", back: "unten links"),
                (key: "u1.corner.h1", front: "h1", back: "unten rechts"),
                (key: "u1.corner.a8", front: "a8", back: "oben links"),
                (key: "u1.corner.h8", front: "h8", back: "oben rechts"),
            ],
            draw: &draw
        )
    }

    static func colorName(_ square: ChessSquare) -> String { square.isDark ? "dunkel" : "hell" }

    static func colorOfSquare(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let square = draw.pickSquare(key: "u1.colorOfSquare") else { return nil }
        let number = square.file + 1
        let sum = number + square.rank + 1
        let explanation = "a1 ist dunkel, danach wechselt die Farbe von Feld zu Feld. Rechne: \(square.fileLetter) ist der \(number). Buchstabe, "
            + "\(number) + \(square.rank + 1) = \(sum). \(sum % 2 == 0 ? "Gerade Summe: dunkel." : "Ungerade Summe: hell.")"
        return ChessKit.choice(
            id: "u1.colorOfSquare.\(square.name)", prompt: "Welche Farbe hat das Feld \(square.name)?", correct: colorName(square),
            wrong: [square.isDark ? "hell" : "dunkel"], explanation: explanation,
            media: ChessKit.emptyBoard(marked: [square.name]), draw: &draw
        )
    }

    static func cornerColor(_ draw: inout ChessDraw) -> LearnExercise? {
        let names = ["a1", "h1", "a8", "h8"]
        guard let name = draw.pick(names, key: "u1.cornerColor", id: { $0 }), let square = ChessSquare(name) else { return nil }
        return ChessKit.choice(
            id: "u1.cornerColor.\(name)", prompt: "Welche Farbe hat das Eckfeld \(name)?", correct: colorName(square),
            wrong: [square.isDark ? "hell" : "dunkel"],
            explanation: "Unten links (a1) und oben rechts (h8) sind dunkel, unten rechts (h1) und oben links (a8) sind hell.",
            media: ChessKit.emptyBoard(marked: [name]), draw: &draw
        )
    }

    struct Fact {
        let key: String
        let prompt: String
        let answer: Int
        let likely: [Int]
        let explanation: String
    }

    /// Counts of the board, taken from the squares themselves.
    static var facts: [Fact] {
        let all = ChessSquare.all
        return [
            Fact(key: "squares", prompt: "Wie viele Felder hat ein Schachbrett?", answer: all.count, likely: [32, 56, 81],
                 explanation: "8 Linien mal 8 Reihen sind \(all.count) Felder."),
            Fact(key: "dark", prompt: "Wie viele dunkle Felder hat das Schachbrett?", answer: all.filter(\.isDark).count, likely: [16, 30, 64],
                 explanation: "Hell und dunkel wechseln sich ab, jede Farbe hat die Hälfte der 64 Felder."),
            Fact(key: "files", prompt: "Wie viele Linien hat das Schachbrett?", answer: ChessSquare.fileLetters.count, likely: [6, 7, 9],
                 explanation: "Die Linien heißen a, b, c, d, e, f, g und h."),
            Fact(key: "ranks", prompt: "Wie viele Reihen hat das Schachbrett?", answer: ChessSquare.rankDigits.count, likely: [6, 7, 9],
                 explanation: "Die Reihen sind von 1 bis 8 nummeriert."),
            Fact(key: "diagonal", prompt: "Aus wie vielen Feldern besteht die lange Diagonale von a1 nach h8?",
                 answer: all.filter { $0.file == $0.rank }.count, likely: [7, 9, 16],
                 explanation: "Sie berührt jede Linie und jede Reihe genau einmal."),
            Fact(key: "perFile", prompt: "Wie viele Felder hat eine Linie?", answer: all.filter { $0.file == 0 }.count, likely: [6, 7, 64],
                 explanation: "Eine Linie läuft durch alle 8 Reihen."),
        ]
    }

    static func factChoice(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let fact = draw.pick(facts, key: "u1.fact", id: \.key) else { return nil }
        return ChessKit.choice(
            id: "u1.factChoice.\(fact.key)", prompt: fact.prompt, correct: String(fact.answer),
            wrong: ChessKit.numberWrongs(correct: fact.answer, likely: fact.likely, random: &draw.random),
            explanation: fact.explanation, draw: &draw
        )
    }

    static func factNumber(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let fact = draw.pick(facts, key: "u1.fact", id: \.key) else { return nil }
        return ChessKit.number(id: "u1.factNumber.\(fact.key)", prompt: fact.prompt, answer: fact.answer, explanation: fact.explanation)
    }

    static func sameDiagonal(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let base = draw.pickSquare(key: "u1.sameDiagonal") else { return nil }
        let onDiagonal = ChessSquare.all.filter { abs($0.file - base.file) == abs($0.rank - base.rank) && $0 != base }
        let sameLine = ChessSquare.all.filter { ($0.file == base.file || $0.rank == base.rank) && $0 != base }
        let elsewhere = ChessSquare.all.filter {
            abs($0.file - base.file) != abs($0.rank - base.rank) && $0.file != base.file && $0.rank != base.rank
        }
        guard let right = onDiagonal.randomElement(using: &draw.random), let line = sameLine.randomElement(using: &draw.random) else { return nil }
        var wrong = [line.name]
        for square in elsewhere.shuffled(using: &draw.random) where wrong.count < 3 && !wrong.contains(square.name) {
            wrong.append(square.name)
        }
        let steps = abs(right.file - base.file)
        return ChessKit.choice(
            id: "u1.sameDiagonal.\(base.name)", prompt: "Welches Feld liegt mit \(base.name) auf einer Diagonale?", correct: right.name, wrong: wrong,
            explanation: "Von \(base.name) nach \(right.name) geht es \(steps) \(steps == 1 ? "Linie" : "Linien") und \(steps) \(steps == 1 ? "Reihe" : "Reihen") weit: Das ist eine Diagonale.",
            media: ChessKit.emptyBoard(marked: [base.name]), draw: &draw
        )
    }

    /// "Ziehe von g1 nach f3.": the student only has to find the two squares.
    static func tapMove(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.nameMoves, key: "u1.tapMove"), let position = sample.position, let move = sample.detailMove else { return nil }
        return ChessKit.moveExercise(
            id: "u1.tapMove.\(sample.id)", prompt: "Ziehe von \(move.from.name) nach \(move.to.name).", position: position,
            goal: .moves(ChessMoveFilter(from: move.from, to: move.to)),
            explanation: "Suche erst die Linie, dann die Reihe: von \(move.from.name) nach \(move.to.name)."
        )
    }

    static func typeName(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let square = draw.pickSquare(key: "u1.typeName") else { return nil }
        return ChessKit.typedSquare(
            id: "u1.typeName.\(square.name)", prompt: "Tippe den Namen des markierten Feldes.", answer: square.name,
            explanation: "Erst die Linie, dann die Reihe: \(square.fileLetter)-Linie, \(square.rank + 1). Reihe, also \(square.name).",
            media: ChessKit.emptyBoard(marked: [square.name])
        )
    }

    static func typeCorner(_ draw: inout ChessDraw) -> LearnExercise? {
        let corners: [(name: String, place: String)] = [("a1", "unten links"), ("h1", "unten rechts"), ("a8", "oben links"), ("h8", "oben rechts")]
        guard let corner = draw.pick(corners, key: "u1.typeCorner", id: \.name) else { return nil }
        return ChessKit.typedSquare(
            id: "u1.typeCorner.\(corner.name)", prompt: "Wie heißt das Eckfeld \(corner.place)? Du schaust von Weiß aus auf das Brett.", answer: corner.name,
            explanation: "Die Ecken sind a1 (unten links), h1 (unten rechts), a8 (oben links) und h8 (oben rechts).",
            media: ChessKit.emptyBoard()
        )
    }
}
