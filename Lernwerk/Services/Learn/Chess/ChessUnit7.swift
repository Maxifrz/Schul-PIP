import Foundation

/// Unit 7, "Matt in einem Zug": the mating patterns and finding every mate in one.
enum ChessUnit7 {
    static let groupA: Set<String> = ["backRank", "smothered"]
    static let groupB: Set<String> = ["scholar", "fool", "ladder"]
    static let groupC: Set<String> = ["queen", "rook"]
    static let groups: [(suffix: String, themes: Set<String>)] = [
        ("a", groupA), ("b", groupB), ("c", groupC), ("all", groupA.union(groupB).union(groupC)),
    ]

    /// The German name of each named pattern.
    static let patternNames: [String: String] = [
        "backRank": "Grundreihenmatt", "smothered": "Erstickungsmatt", "scholar": "Schäfermatt", "ladder": "Leitermatt", "fool": "Narrenmatt",
    ]

    static let makers: [String: ChessMaker] = {
        var table: [String: ChessMaker] = [
            "u7.pairs": pairs,
            "u7.sentence.back": ChessKit.sentenceMaker("u7.sentence.back", backSentences),
            "u7.sentence.rule": ChessKit.sentenceMaker("u7.sentence.rule", ruleSentences),
        ]
        for (suffix, themes) in groups {
            table["u7.find.\(suffix)"] = find("u7.find.\(suffix)", themes: themes)
            table["u7.choose.\(suffix)"] = choose("u7.choose.\(suffix)", themes: themes)
            table["u7.count.\(suffix)"] = count("u7.count.\(suffix)", themes: themes)
            table["u7.isMate.\(suffix)"] = isMate("u7.isMate.\(suffix)", themes: themes)
            table["u7.write.\(suffix)"] = write("u7.write.\(suffix)", themes: themes)
            if suffix != "c" { table["u7.pattern.\(suffix)"] = pattern("u7.pattern.\(suffix)", themes: themes.intersection(Set(patternNames.keys))) }
        }
        return table
    }()

    static let review = ["u7.find.all", "u7.choose.all", "u7.isMate.all", "u7.pattern.all"]

    static let backSentences = [
        ChessSentence(key: "back", words: ["Beim", "Grundreihenmatt", "sperren", "die", "eigenen", "Bauern", "den", "König", "ein."], extra: ["Läufer", "Springer"]),
        ChessSentence(key: "knight", words: ["Beim", "Erstickungsmatt", "setzt", "ein", "Springer", "matt."], extra: ["Turm", "Läufer"]),
    ]

    static let ruleSentences = [
        ChessSentence(key: "three", words: ["Ein", "Matt", "ist", "ein", "Schach", "ohne", "Ausweg."], extra: ["Remis", "Patt"]),
        ChessSentence(key: "all", words: ["Gesucht", "sind", "alle", "Züge,", "die", "sofort", "matt", "setzen."], extra: ["keine", "später"]),
    ]

    private static func pool(_ themes: Set<String>) -> [ChessSample] {
        ChessSamples.mates.filter { themes.contains($0.theme) }
    }

    /// The sentence that explains the pattern a mate shows, for the feedback.
    static func patternText(theme: String, move: ChessMove) -> String {
        switch theme {
        case "backRank": return "Der König steht auf der Grundreihe, und seine eigenen Bauern nehmen ihm die Felder davor: Grundreihenmatt."
        case "smothered": return "Eigene Figuren nehmen dem König alle Felder, und ein Springer gibt Schach: Erstickungsmatt."
        case "scholar": return "Dame und Läufer zielen auf \(move.to.name). Die Dame schlägt dort mit Schach, und der Läufer deckt sie: Schäfermatt."
        case "ladder": return "Zwei Türme setzen Reihe um Reihe ab: Der eine sperrt die Reihe davor, der andere gibt Schach. Das ist ein Leitermatt."
        case "fool": return "Das schnellste mögliche Matt: Nach nur zwei Zügen jeder Seite ist die Partie vorbei (Narrenmatt)."
        case "queen": return "Die Dame gibt Schach, und der eigene König deckt sie und nimmt die Fluchtfelder: Matt am Rand."
        default: return "Der Turm gibt Schach auf der Randreihe, und der eigene König nimmt die Fluchtfelder: Matt am Rand."
        }
    }

    private static func firstMate(in position: ChessPosition) -> ChessMove? {
        ChessGoals.accepted(.mateInOne, in: position).first
    }

    static func find(_ topic: String, themes: Set<String>) -> ChessMaker {
        { draw in
            guard let sample = draw.pick(pool(themes), key: topic), let position = sample.position, let mate = firstMate(in: position) else { return nil }
            return ChessKit.moveExercise(
                id: "\(topic).\(sample.id)", prompt: "Setze in einem Zug matt.", position: position, goal: .mateInOne,
                explanation: patternText(theme: sample.theme, move: mate), withSquares: false
            )
        }
    }

    static func choose(_ topic: String, themes: Set<String>) -> ChessMaker {
        { draw in
            guard let sample = draw.pick(pool(themes), key: topic), let position = sample.position else { return nil }
            let mates = ChessGoals.accepted(.mateInOne, in: position)
            guard let right = mates.randomElement(using: &draw.random), let rightText = ChessNotation.san(right, in: position) else { return nil }
            let others = position.legalMoves().filter { !mates.contains($0) }
            // Moves that give check first: they look like mates but are not.
            let checks = others.filter { position.givesCheck($0) }.shuffled(using: &draw.random)
            let captures = others.filter { position.isCapture($0) && !position.givesCheck($0) }.shuffled(using: &draw.random)
            let quiet = others.filter { !position.isCapture($0) && !position.givesCheck($0) }.shuffled(using: &draw.random)
            var wrong: [String] = []
            for move in checks + captures + quiet where wrong.count < 3 {
                guard let text = ChessNotation.san(move, in: position) else { continue }
                let plain = ChessKit.sanWithoutSign(text)
                if plain != ChessKit.sanWithoutSign(rightText), !wrong.contains(plain) { wrong.append(plain) }
            }
            return ChessKit.choice(
                id: "\(topic).\(sample.id)", prompt: "Welcher Zug setzt matt?", correct: ChessKit.sanWithoutSign(rightText), wrong: wrong,
                explanation: patternText(theme: sample.theme, move: right), media: ChessKit.board(position), draw: &draw
            )
        }
    }

    static func count(_ topic: String, themes: Set<String>) -> ChessMaker {
        { draw in
            guard let sample = draw.pick(pool(themes), key: topic), let position = sample.position else { return nil }
            let mates = ChessGoals.accepted(.mateInOne, in: position)
            let texts = mates.compactMap { ChessNotation.san($0, in: position) }
            return ChessKit.number(
                id: "\(topic).\(sample.id)", prompt: "Wie viele Züge setzen hier sofort matt?", answer: mates.count,
                explanation: "Matt setzen: \(texts.joined(separator: ", ")).", media: ChessKit.board(position)
            )
        }
    }

    static func isMate(_ topic: String, themes: Set<String>) -> ChessMaker {
        { draw in
            guard let sample = draw.pick(pool(themes), key: topic), let position = sample.position else { return nil }
            let checks = position.legalMoves().filter { position.givesCheck($0) }
            let wantMate = draw.coin()
            let candidates = checks.filter { position.applying($0).isCheckmate == wantMate }
            guard let move = (candidates.isEmpty ? checks : candidates).randomElement(using: &draw.random),
                  let san = ChessNotation.san(move, in: position) else { return nil }
            let after = position.applying(move)
            let mate = after.isCheckmate
            let explanation: String
            if mate {
                explanation = "Der König hat kein Feld, die Figur ist nicht zu schlagen, und nichts kann dazwischen: Matt."
            } else {
                let reply = after.legalMoves().first.flatMap { ChessNotation.san($0, in: after) }
                explanation = "\(after.sideToMove.germanName) kann das Schach aufheben, zum Beispiel mit \(reply ?? "einem Zug"). Es ist also nicht Matt."
            }
            return ChessKit.yesNo(
                id: "\(topic).\(sample.id).\(move.uci)",
                prompt: "\(position.sideToMove.germanName) spielt \(ChessKit.sanWithoutSign(san)) und gibt damit Schach. Ist das Matt?", answer: mate,
                explanation: explanation, media: ChessKit.board(position), draw: &draw
            )
        }
    }

    /// Typing the mating move in notation; every mating move is accepted, with or without the signs.
    static func write(_ topic: String, themes: Set<String>) -> ChessMaker {
        { draw in
            guard let sample = draw.pick(pool(themes), key: topic), let position = sample.position else { return nil }
            let mates = ChessGoals.accepted(.mateInOne, in: position)
            let texts = mates.compactMap { ChessNotation.san($0, in: position) }
            guard let first = texts.first else { return nil }
            let forms = texts.flatMap { ChessKit.typedVariants(of: $0) }
            return Exercises.typed(
                id: "\(topic).\(sample.id)",
                prompt: "Setze matt und schreibe den Zug auf: Buchstabe der Figur und Zielfeld, zum Beispiel Sf3.", answer: first,
                alternatives: forms, mode: .exact, solution: texts.joined(separator: " oder "),
                explanation: patternText(theme: sample.theme, move: mates[0]), media: ChessKit.board(position)
            )
        }
    }

    /// "Wie heißt dieses Mattbild?": the position after the mate, and the four names.
    static func pattern(_ topic: String, themes: Set<String>) -> ChessMaker {
        { draw in
            let pool = pool(themes)
            guard let sample = draw.pick(pool, key: topic), let position = sample.position, let mate = firstMate(in: position),
                  let name = patternNames[sample.theme] else { return nil }
            let wrong = patternNames.filter { $0.key != sample.theme }.map(\.value).sorted()
            return ChessKit.choice(
                id: "\(topic).\(sample.id)", prompt: "Wie heißt dieses Mattbild?", correct: name, wrong: wrong.shuffled(using: &draw.random),
                explanation: patternText(theme: sample.theme, move: mate), media: ChessKit.board(position.applying(mate)), draw: &draw
            )
        }
    }

    static func pairs(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.pairs(
            id: "u7.pairs", prompt: "Ordne die Mattbilder zu.",
            from: [
                (key: "u7.pair.back", front: "Grundreihenmatt", back: "Eigene Bauern sperren den König ein"),
                (key: "u7.pair.smothered", front: "Erstickungsmatt", back: "Ein Springer setzt matt"),
                (key: "u7.pair.ladder", front: "Leitermatt", back: "Zwei Türme gehen Reihe um Reihe vor"),
                (key: "u7.pair.scholar", front: "Schäfermatt", back: "Dame und Läufer zielen auf den Bauern f7"),
            ],
            draw: &draw
        )
    }
}
