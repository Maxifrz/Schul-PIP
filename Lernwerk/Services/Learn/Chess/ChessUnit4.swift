import Foundation

/// Unit 4, "Schach und Matt": check, getting out of check, mate, stalemate and drawn material.
enum ChessUnit4 {
    static let makers: [String: ChessMaker] = [
        "u4.isCheck": isCheck,
        "u4.whichChecks": whichChecks,
        "u4.giveCheck": giveCheck,
        "u4.terms": terms,
        "u4.sentence.check": ChessKit.sentenceMaker("u4.sentence.check", checkSentences),
        "u4.sentence.end": ChessKit.sentenceMaker("u4.sentence.end", endSentences),
        "u4.escape.any": escape("u4.escape.any", .any, prompt: "Dein König steht im Schach. Hebe das Schach auf.",
                                explanation: "Es gibt drei Wege: den König ziehen, die Figur schlagen, die Schach gibt, oder eine Figur dazwischenstellen."),
        "u4.escape.capture": escape("u4.escape.capture", .captureChecker, prompt: "Schlage die Figur, die Schach gibt.",
                                    explanation: "Schlägst du die Figur, die Schach gibt, ist das Schach vorbei."),
        "u4.escape.block": escape("u4.escape.block", .interpose, prompt: "Stelle eine Figur zwischen deinen König und die Figur, die Schach gibt.",
                                  explanation: "Eine Figur auf einem Feld dazwischen fängt den Angriff ab. Gegen Springer und Bauern geht das nicht."),
        "u4.escape.king": escape("u4.escape.king", .kingMoves, prompt: "Ziehe deinen König aus dem Schach.",
                                 explanation: "Der König muss auf ein Feld, das kein Gegner angreift."),
        "u4.escape.which": escapeWhich,
        "u4.state": state,
        "u4.mateMove": mateMove,
        "u4.mateOrStale": mateOrStale,
        "u4.dead": dead,
    ]

    static let review = ["u4.isCheck", "u4.escape.any", "u4.state", "u4.mateMove", "u4.escape.which"]

    static let checkSentences = [
        ChessSentence(key: "must", words: ["Im", "Schach", "musst", "du", "das", "Schach", "sofort", "aufheben."], extra: ["ignorieren.", "später"]),
        ChessSentence(key: "never", words: ["Der", "König", "wird", "nie", "geschlagen,", "sondern", "matt", "gesetzt."], extra: ["immer", "getauscht"]),
    ]

    static let endSentences = [
        ChessSentence(key: "stalemate", words: ["Ein", "Patt", "ist", "ein", "Remis."], extra: ["Sieg.", "Matt."]),
        ChessSentence(key: "mate", words: ["Nach", "dem", "Matt", "ist", "die", "Partie", "zu", "Ende."], extra: ["beginnt", "Patt"]),
    ]

    /// Positions in which the side to move is in check, with one of the three kinds of answer at least.
    private static var checked: [ChessSample] {
        (ChessSamples.inCheck + ChessSamples.singleAnswer).filter { $0.position?.isCheck == true }
    }

    static func isCheck(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.inCheck + ChessSamples.notInCheck + ChessSamples.goesOn
        guard let sample = draw.pick(pool, key: "u4.isCheck"), let position = sample.position, let king = sample.focusSquare else { return nil }
        let color = position.sideToMove
        let explanation: String
        if position.isCheck {
            let attackers = position.attackers(of: king, by: color.opposite).map(\.name)
            explanation = "Das Feld \(king.name) wird von der Figur auf \(ChessKit.list(attackers)) angegriffen: Der König steht im Schach."
        } else {
            explanation = "Keine gegnerische Figur greift das Feld \(king.name) an, also steht der König nicht im Schach."
        }
        return ChessKit.yesNo(
            id: "u4.isCheck.\(sample.id)", prompt: "Steht der \(color.adjectiveStem)e König im Schach?", answer: position.isCheck,
            explanation: explanation, media: ChessKit.board(position, marked: [king.name]), draw: &draw
        )
    }

    static func whichChecks(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.inCheck, key: "u4.whichChecks"), let position = sample.position,
              let king = sample.focusSquare, let from = sample.detailSquare, let checker = position[from] else { return nil }
        let wrong = ChessPieceKind.allCases.filter { $0 != checker.kind }.map(\.germanName).shuffled(using: &draw.random)
        return ChessKit.choice(
            id: "u4.whichChecks.\(sample.id)", prompt: "Welche Figur gibt dem \(position.sideToMove.adjectiveStem)en König Schach?",
            correct: checker.kind.germanName, wrong: wrong,
            explanation: "Die Figur auf \(from.name) ist \(ChessKit.indefinite(checker.kind)) und greift den König auf \(king.name) an.",
            media: ChessKit.board(position, marked: [king.name]), draw: &draw
        )
    }

    static func giveCheck(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.mates.filter { ["rook", "queen", "backRank"].contains($0.theme) }
        guard let sample = draw.pick(pool, key: "u4.giveCheck"), let position = sample.position else { return nil }
        return ChessKit.moveExercise(
            id: "u4.giveCheck.\(sample.id)", prompt: "Gib dem gegnerischen König Schach.", position: position,
            goal: .moves(ChessMoveFilter(check: true)), explanation: "Schach gibst du, wenn eine deiner Figuren den gegnerischen König angreift.",
            withSquares: false
        )
    }

    static func terms(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.pairs(
            id: "u4.terms", prompt: "Ordne die Begriffe zu.",
            from: [
                (key: "u4.term.check", front: "Schach", back: "Der König wird angegriffen"),
                (key: "u4.term.mate", front: "Matt", back: "Schach ohne Ausweg"),
                (key: "u4.term.stalemate", front: "Patt", back: "Kein Schach, aber kein erlaubter Zug"),
                (key: "u4.term.draw", front: "Remis", back: "Unentschieden"),
            ],
            draw: &draw
        )
    }

    // MARK: Getting out of check

    static func escape(_ topic: String, _ kind: ChessEscape, prompt: String, explanation: String) -> ChessMaker {
        { draw in
            let pool = checked.filter { sample in
                guard let position = sample.position else { return false }
                return !ChessGoals.accepted(.escape(kind), in: position).isEmpty
            }
            guard let sample = draw.pick(pool, key: topic), let position = sample.position else { return nil }
            return ChessKit.moveExercise(
                id: "\(topic).\(sample.id)", prompt: prompt, position: position, goal: .escape(kind),
                marked: sample.focus.map { [$0] } ?? [], explanation: explanation
            )
        }
    }

    /// The kinds of answer a check has: king moves, capturing the checker, interposing.
    static func escapeKinds(in position: ChessPosition) -> [ChessEscape] {
        [ChessEscape.kingMoves, .captureChecker, .interpose].filter { !ChessGoals.accepted(.escape($0), in: position).isEmpty }
    }

    static func escapeWhich(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = checked.filter { sample in sample.position.map { escapeKinds(in: $0).count == 1 } ?? false }
        guard let sample = draw.pick(pool, key: "u4.escape.which"), let position = sample.position, let only = escapeKinds(in: position).first else { return nil }
        let texts: [ChessEscape: String] = [
            .kingMoves: "Den König ziehen", .captureChecker: "Die Figur schlagen, die Schach gibt", .interpose: "Eine Figur dazwischenstellen",
        ]
        let reasons: [ChessEscape: String] = [
            .kingMoves: "Nichts kann die Figur schlagen oder dazwischenziehen, also muss der König ausweichen.",
            .captureChecker: "Der König kann nicht ausweichen, und nichts lässt sich dazwischenstellen: Nur das Schlagen der Figur hilft.",
            .interpose: "Der König kann nicht ausweichen, und die Figur lässt sich nicht schlagen: Nur ein Dazwischenstellen hilft.",
        ]
        guard let right = texts[only], let reason = reasons[only] else { return nil }
        let wrong = texts.filter { $0.key != only }.map(\.value).sorted() + ["Gar nicht, es ist Matt"]
        return ChessKit.choice(
            id: "u4.escape.which.\(sample.id)", prompt: "Wie kannst du dieses Schach aufheben? Es gibt nur eine Möglichkeit.", correct: right, wrong: wrong,
            explanation: reason, media: ChessKit.board(position, marked: sample.focus.map { [$0] } ?? []), draw: &draw
        )
    }

    // MARK: Mate, stalemate, draws

    enum Outcome: Equatable {
        case mate, stalemate, check, quiet

        init(_ position: ChessPosition) {
            if position.isCheckmate { self = .mate } else if position.isStalemate { self = .stalemate } else if position.isCheck { self = .check } else { self = .quiet }
        }

        var text: String {
            switch self {
            case .mate: return "Matt: Die Partie ist zu Ende"
            case .stalemate: return "Patt: Die Partie ist unentschieden"
            case .check: return "Schach, aber kein Matt"
            case .quiet: return "Kein Schach, die Partie geht weiter"
            }
        }

        static let allTexts = [Outcome.mate, .stalemate, .check, .quiet].map(\.text)

        func explanation(for color: ChessColor) -> String {
            switch self {
            case .mate: return "\(color.germanName) steht im Schach und hat keinen Ausweg: kein freies Feld, nichts zum Schlagen oder Dazwischenstellen. Das ist Schachmatt."
            case .stalemate: return "Der König steht nicht im Schach, aber \(color.germanName) hat keinen erlaubten Zug. Das ist Patt, und die Partie ist remis."
            case .check: return "Der König steht im Schach, kann es aber aufheben. Die Partie geht weiter."
            case .quiet: return "Der König steht nicht im Schach, und \(color.germanName) hat erlaubte Züge. Die Partie geht weiter."
            }
        }
    }

    static func state(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.mated + ChessSamples.stalemates + ChessSamples.goesOn + ChessSamples.inCheck + ChessSamples.notInCheck
        guard let sample = draw.pick(pool, key: "u4.state"), let position = sample.position else { return nil }
        let outcome = Outcome(position)
        let color = position.sideToMove
        return ChessKit.choice(
            id: "u4.state.\(sample.id)", prompt: "\(color.germanName) ist am Zug. Welche Aussage stimmt?", correct: outcome.text,
            wrong: Outcome.allTexts.filter { $0 != outcome.text }, explanation: outcome.explanation(for: color),
            media: ChessKit.board(position, marked: sample.focus.map { [$0] } ?? []), draw: &draw
        )
    }

    static func mateMove(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.mates.filter { ["rook", "queen", "backRank"].contains($0.theme) }
        guard let sample = draw.pick(pool, key: "u4.mateMove"), let position = sample.position else { return nil }
        return ChessKit.moveExercise(
            id: "u4.mateMove.\(sample.id)", prompt: "Setze mit einem Zug matt.", position: position, goal: .mateInOne,
            explanation: "Matt ist Schach, bei dem der König kein Feld hat, die Figur nicht zu schlagen ist und nichts dazwischengestellt werden kann.",
            withSquares: false
        )
    }

    /// "Weiß spielt Df7. Was ist das Ergebnis?": a move of a king-and-queen or king-and-rook position that mates,
    /// stalemates or only checks, whichever the draw picks among those that exist.
    static func mateOrStale(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.mates.filter { ["rook", "queen"].contains($0.theme) }
        guard let sample = draw.pick(pool, key: "u4.mateOrStale"), let position = sample.position else { return nil }
        let results = position.legalMoves().map { (move: $0, outcome: Outcome(position.applying($0))) }
        let classes = [Outcome.mate, .stalemate, .check].filter { kind in results.contains { $0.outcome == kind } }
        guard let outcome = classes.randomElement(using: &draw.random),
              let chosen = results.filter({ $0.outcome == outcome }).randomElement(using: &draw.random),
              let san = ChessNotation.san(chosen.move, in: position) else { return nil }
        let color = position.sideToMove
        return ChessKit.choice(
            id: "u4.mateOrStale.\(sample.id).\(chosen.move.uci)", prompt: "\(color.germanName) spielt \(ChessKit.sanWithoutSign(san)). Was ist das Ergebnis?",
            correct: outcome.text, wrong: Outcome.allTexts.filter { $0 != outcome.text },
            explanation: outcome.explanation(for: color.opposite), media: ChessKit.board(position), draw: &draw
        )
    }

    static func dead(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.materialEnds, key: "u4.dead"), let position = sample.position else { return nil }
        let possible = !position.hasInsufficientMaterial
        let strongest = position.pieces.map(\.piece.kind).filter { $0 != .king }.max()
        let explanation: String
        if !possible {
            explanation = "König gegen König, oder König und ein einzelner Läufer oder Springer gegen König: Das reicht nie zum Matt. Die Partie ist sofort remis."
        } else if strongest == .pawn {
            explanation = "Ein Bauer kann sich in eine Dame umwandeln, und mit einer Dame ist Matt möglich."
        } else {
            explanation = "Mit Dame oder Turm und König lässt sich der gegnerische König mattsetzen."
        }
        return ChessKit.yesNo(
            id: "u4.dead.\(sample.id)", prompt: "Reicht das Material, damit überhaupt noch jemand Matt setzen kann?", answer: possible,
            explanation: explanation, media: ChessKit.board(position), draw: &draw
        )
    }
}
