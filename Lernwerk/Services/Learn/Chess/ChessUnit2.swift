import Foundation

/// Unit 2, "Die Figuren und ihre Züge": the starting position, how each piece moves and captures.
enum ChessUnit2 {
    static let sliders: Set<String> = ["rook", "bishop", "queen"]
    static let steppers: Set<String> = ["king", "knight"]
    static let allPieces: Set<String> = sliders.union(steppers)

    static let makers: [String: ChessMaker] = [
        "u2.identify": identify,
        "u2.startSquare": startSquare,
        "u2.queenColor": queenColor,
        "u2.startCountChoice": startCountChoice,
        "u2.startCountNumber": startCountNumber,
        "u2.letters": letters,
        "u2.movePairs": movePairs,
        "u2.sentence.slide": ChessKit.sentenceMaker("u2.sentence.slide", slideSentences),
        "u2.sentence.step": ChessKit.sentenceMaker("u2.sentence.step", stepSentences),
        "u2.count.slider": countChoice("u2.count.slider", kinds: sliders),
        "u2.count.step": countChoice("u2.count.step", kinds: steppers),
        "u2.count.all": countChoice("u2.count.all", kinds: allPieces),
        "u2.countNumber.slider": countNumber("u2.countNumber.slider", kinds: sliders),
        "u2.countNumber.step": countNumber("u2.countNumber.step", kinds: steppers),
        "u2.countNumber.all": countNumber("u2.countNumber.all", kinds: allPieces),
        "u2.moveTo.slider": moveTo("u2.moveTo.slider", kinds: sliders),
        "u2.moveTo.step": moveTo("u2.moveTo.step", kinds: steppers),
        "u2.moveTo.all": moveTo("u2.moveTo.all", kinds: allPieces),
        "u2.reach.step": reach("u2.reach.step", kinds: steppers),
        "u2.reach.all": reach("u2.reach.all", kinds: allPieces),
        "u2.whichPiece": whichPiece,
        "u2.captureMove": captureMove,
        "u2.attackCount": attackCount,
    ]

    static let review = ["u2.identify", "u2.moveTo.all", "u2.count.all", "u2.whichPiece", "u2.reach.all", "u2.captureMove"]

    static let slideSentences = [
        ChessSentence(key: "bishop", words: ["Der", "Läufer", "zieht", "nur", "schräg."], extra: ["gerade.", "springt"]),
        ChessSentence(key: "rook", words: ["Der", "Turm", "zieht", "nur", "gerade."], extra: ["schräg.", "L-förmig."]),
        ChessSentence(key: "queen", words: ["Die", "Dame", "zieht", "wie", "Turm", "und", "Läufer", "zusammen."], extra: ["König", "Springer"]),
    ]

    static let stepSentences = [
        ChessSentence(key: "knight", words: ["Nur", "der", "Springer", "darf", "über", "Figuren", "springen."], extra: ["Läufer", "Turm"]),
        ChessSentence(key: "king", words: ["Der", "König", "zieht", "nur", "ein", "Feld", "weit."], extra: ["zwei", "Springer"]),
        ChessSentence(key: "attacked", words: ["Der", "König", "darf", "nicht", "auf", "angegriffene", "Felder", "ziehen."], extra: ["immer", "Bauern"]),
    ]

    // MARK: The starting position

    static func identify(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.crowded, key: "u2.identify"), let position = sample.position else { return nil }
        let pieces = position.pieces
        guard let (square, piece) = pieces.randomElement(using: &draw.random) else { return nil }
        let wrong = ChessPieceKind.allCases.filter { $0 != piece.kind }.map(\.germanName).shuffled(using: &draw.random)
        return ChessKit.choice(
            id: "u2.identify.\(sample.id).\(square.name)", prompt: "Welche Figur steht auf dem markierten Feld?", correct: piece.kind.germanName,
            wrong: wrong, explanation: "Auf \(square.name) steht \(ChessKit.indefinite(piece.kind)).",
            media: .board(BoardSpec(fen: position.fen, marked: [square.name])), draw: &draw
        )
    }

    static func startSquare(_ draw: inout ChessDraw) -> LearnExercise? {
        let pieces = [ChessPiece(.white, .king), ChessPiece(.black, .king), ChessPiece(.white, .queen), ChessPiece(.black, .queen)]
        guard let piece = draw.pick(pieces, key: "u2.startSquare", id: { $0.phrase() }) else { return nil }
        let start = ChessPosition.start
        guard let square = start.squares(of: piece).first else { return nil }
        let partner = ChessPiece(piece.color, piece.kind == .king ? .queen : .king)
        guard let partnerSquare = start.squares(of: partner).first,
              let opposite = ChessSquare(file: square.file, rank: 7 - square.rank),
              let side = ChessSquare(file: square.file + (piece.kind == .king ? 1 : -1), rank: square.rank) else { return nil }
        return ChessKit.choice(
            id: "u2.startSquare.\(piece.color.adjectiveStem).\(piece.kind.germanName)",
            prompt: "Auf welchem Feld steht am Anfang \(piece.phrase())?", correct: square.name,
            wrong: [partnerSquare.name, opposite.name, side.name],
            explanation: "Die Dame steht auf d1 und d8, der König daneben auf e1 und e8.",
            media: .board(BoardSpec(fen: start.fen)), draw: &draw
        )
    }

    static func queenColor(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let color = draw.pick(ChessColor.allCases, key: "u2.queenColor", id: { $0.germanName }) else { return nil }
        let start = ChessPosition.start
        guard let square = start.squares(of: ChessPiece(color, .queen)).first else { return nil }
        let word = square.isDark ? "dunkel" : "hell"
        return ChessKit.choice(
            id: "u2.queenColor.\(color.adjectiveStem)", prompt: "Welche Farbe hat das Startfeld der \(color.adjectiveStem)en Dame?", correct: word,
            wrong: [square.isDark ? "hell" : "dunkel"],
            explanation: "Die Dame steht am Anfang auf ihrer eigenen Farbe: Weiß auf d1 (hell), Schwarz auf d8 (dunkel).",
            media: .board(BoardSpec(fen: start.fen)), draw: &draw
        )
    }

    struct StartCount {
        let key: String
        let prompt: String
        let answer: Int
        let likely: [Int]
        let explanation: String
    }

    static var startCounts: [StartCount] {
        let start = ChessPosition.start
        let white = ChessColor.white
        func count(_ kind: ChessPieceKind) -> Int { start.count(of: ChessPiece(white, kind)) }
        return [
            StartCount(key: "pawns", prompt: "Wie viele Bauern hat jede Seite am Anfang?", answer: count(.pawn), likely: [6, 10, 16],
                       explanation: "Auf der 2. Reihe stehen die 8 weißen Bauern, auf der 7. Reihe die 8 schwarzen."),
            StartCount(key: "rooks", prompt: "Wie viele Türme hat jede Seite am Anfang?", answer: count(.rook), likely: [1, 3, 4],
                       explanation: "Die Türme stehen in den Ecken, auf a1 und h1 (Schwarz: a8 und h8)."),
            StartCount(key: "knights", prompt: "Wie viele Springer hat jede Seite am Anfang?", answer: count(.knight), likely: [1, 3, 4],
                       explanation: "Die Springer stehen auf b1 und g1 (Schwarz: b8 und g8)."),
            StartCount(key: "bishops", prompt: "Wie viele Läufer hat jede Seite am Anfang?", answer: count(.bishop), likely: [1, 3, 4],
                       explanation: "Die Läufer stehen auf c1 und f1 (Schwarz: c8 und f8)."),
            StartCount(key: "all", prompt: "Wie viele Figuren stehen am Anfang auf dem Brett, die Bauern mitgezählt?", answer: start.pieces.count, likely: [16, 24, 40],
                       explanation: "Jede Seite hat 16: einen König, eine Dame, zwei Türme, zwei Läufer, zwei Springer und acht Bauern."),
        ]
    }

    static func startCountChoice(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let item = draw.pick(startCounts, key: "u2.startCount", id: \.key) else { return nil }
        return ChessKit.choice(
            id: "u2.startCountChoice.\(item.key)", prompt: item.prompt, correct: String(item.answer),
            wrong: ChessKit.numberWrongs(correct: item.answer, likely: item.likely, random: &draw.random),
            explanation: item.explanation, media: .board(BoardSpec(fen: ChessPosition.startFEN)), draw: &draw
        )
    }

    static func startCountNumber(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let item = draw.pick(startCounts, key: "u2.startCount", id: \.key) else { return nil }
        return ChessKit.number(
            id: "u2.startCountNumber.\(item.key)", prompt: item.prompt, answer: item.answer, explanation: item.explanation,
            media: .board(BoardSpec(fen: ChessPosition.startFEN))
        )
    }

    static func letters(_ draw: inout ChessDraw) -> LearnExercise? {
        let kinds: [ChessPieceKind] = [.king, .queen, .rook, .bishop, .knight]
        return ChessKit.pairs(
            id: "u2.letters", prompt: "Welcher Buchstabe gehört zu welcher Figur?",
            from: kinds.map { (key: "u2.letter.\($0.germanName)", front: $0.germanName, back: $0.letter) }, draw: &draw
        )
    }

    static func movePairs(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.pairs(
            id: "u2.movePairs", prompt: "Wie zieht welche Figur?",
            from: [
                (key: "u2.move.king", front: "König", back: "ein Feld in jede Richtung"),
                (key: "u2.move.queen", front: "Dame", back: "gerade und schräg, beliebig weit"),
                (key: "u2.move.rook", front: "Turm", back: "gerade, beliebig weit"),
                (key: "u2.move.bishop", front: "Läufer", back: "schräg, beliebig weit"),
                (key: "u2.move.knight", front: "Springer", back: "L-Sprung über Figuren"),
            ],
            draw: &draw
        )
    }

    // MARK: Counting and moving

    /// The sentence that follows a count: the piece's rule, and why fewer squares than on an empty board.
    static func countExplanation(kind: ChessPieceKind, count: Int, onEmptyBoard: Int) -> String {
        var text = ChessKit.rule(of: kind)
        if count < onEmptyBoard {
            switch kind {
            case .king: text += " Er darf nicht auf angegriffene Felder und nicht neben den gegnerischen König."
            case .knight: text += " Auf Felder mit eigenen Figuren darf er nicht."
            default: text += " Eigene Figuren versperren den Weg, gegnerische darf er schlagen, dahinter geht es nicht weiter."
            }
        }
        return text + " Möglich sind \(count) \(count == 1 ? "Feld" : "Felder")."
    }

    private static func countSample(_ draw: inout ChessDraw, topic: String, kinds: Set<String>) -> (sample: ChessSample, position: ChessPosition, focus: ChessSquare, piece: ChessPiece, count: Int, empty: Int)? {
        guard let sample = draw.pick(ChessSamples.pieceMoves(of: kinds), key: topic), let position = sample.position,
              let focus = sample.focusSquare, let piece = position[focus] else { return nil }
        let count = ChessKit.destinations(of: focus, in: position).count
        return (sample, position, focus, piece, count, ChessGeometry.reach(piece.kind, from: focus).count)
    }

    static func countChoice(_ topic: String, kinds: Set<String>) -> ChessMaker {
        { draw in
            guard let item = countSample(&draw, topic: topic, kinds: kinds) else { return nil }
            return ChessKit.choice(
                id: "\(topic).\(item.sample.id)",
                prompt: "Auf wie viele Felder kann \(ChessKit.nominative(item.piece.kind)) auf \(item.focus.name) ziehen?",
                correct: String(item.count),
                wrong: ChessKit.numberWrongs(correct: item.count, likely: [item.empty], random: &draw.random),
                explanation: countExplanation(kind: item.piece.kind, count: item.count, onEmptyBoard: item.empty),
                media: ChessKit.board(item.position, marked: [item.focus.name]), draw: &draw
            )
        }
    }

    static func countNumber(_ topic: String, kinds: Set<String>) -> ChessMaker {
        { draw in
            guard let item = countSample(&draw, topic: topic, kinds: kinds) else { return nil }
            return ChessKit.number(
                id: "\(topic).\(item.sample.id)",
                prompt: "Auf wie viele Felder kann \(ChessKit.nominative(item.piece.kind)) auf \(item.focus.name) ziehen? (Schlagen zählt mit.)",
                answer: item.count, explanation: countExplanation(kind: item.piece.kind, count: item.count, onEmptyBoard: item.empty),
                media: ChessKit.board(item.position, marked: [item.focus.name])
            )
        }
    }

    static func moveTo(_ topic: String, kinds: Set<String>) -> ChessMaker {
        { draw in
            guard let sample = draw.pick(ChessSamples.pieceMoves(of: kinds), key: topic), let position = sample.position,
                  let focus = sample.focusSquare, let piece = position[focus] else { return nil }
            let targets = ChessKit.destinations(of: focus, in: position)
            guard let target = targets.randomElement(using: &draw.random) else { return nil }
            return ChessKit.moveExercise(
                id: "\(topic).\(sample.id).\(target.name)",
                prompt: "Ziehe \(ChessKit.accusative(piece.kind)) von \(focus.name) nach \(target.name).", position: position,
                goal: .moves(ChessMoveFilter(from: focus, to: target)), explanation: ChessKit.rule(of: piece.kind)
            )
        }
    }

    static func reach(_ topic: String, kinds: Set<String>) -> ChessMaker {
        { draw in
            guard let sample = draw.pick(ChessSamples.pieceMoves(of: kinds), key: topic), let position = sample.position,
                  let focus = sample.focusSquare, let piece = position[focus] else { return nil }
            let targets = ChessKit.destinations(of: focus, in: position)
            guard let right = targets.randomElement(using: &draw.random) else { return nil }
            // Wrong squares: first those the piece would reach on an empty board but not here, then the squares of other
            // pieces' paths, then any square close by.
            let blocked = ChessGeometry.reach(piece.kind, from: focus).filter { !targets.contains($0) }
            let others = ChessPieceKind.allCases.filter { $0 != piece.kind && $0 != .pawn }
                .flatMap { ChessGeometry.reach($0, from: focus) }.filter { !targets.contains($0) && !blocked.contains($0) }
            let close = ChessSquare.all.filter {
                $0 != focus && !targets.contains($0) && !blocked.contains($0) && !others.contains($0) && max(abs($0.file - focus.file), abs($0.rank - focus.rank)) <= 3
            }
            var wrong: [String] = []
            for group in [blocked.shuffled(using: &draw.random), others.shuffled(using: &draw.random), close.shuffled(using: &draw.random)] {
                for square in group where wrong.count < 3 && !wrong.contains(square.name) { wrong.append(square.name) }
            }
            return ChessKit.choice(
                id: "\(topic).\(sample.id)", prompt: "Welches Feld kann \(ChessKit.nominative(piece.kind)) auf \(focus.name) mit einem Zug erreichen?",
                correct: right.name, wrong: wrong, explanation: ChessKit.rule(of: piece.kind),
                media: ChessKit.board(position, marked: [focus.name]), draw: &draw
            )
        }
    }

    /// "Which piece can go from d4 to e6?" on an empty board; only squares for which one or two kinds can do it.
    static func whichPiece(_ draw: inout ChessDraw) -> LearnExercise? {
        let kinds: [ChessPieceKind] = [.king, .queen, .rook, .bishop, .knight]
        for _ in 0..<60 {
            guard let from = ChessSquare.all.randomElement(using: &draw.random), let to = ChessSquare.all.randomElement(using: &draw.random) else { return nil }
            let able = kinds.filter { ChessGeometry.canReach($0, from: from, to: to) }
            guard !able.isEmpty, able.count <= 2, let right = able.randomElement(using: &draw.random) else { continue }
            let wrong = kinds.filter { !able.contains($0) }.map(\.germanName)
            return ChessKit.choice(
                id: "u2.whichPiece.\(from.name)\(to.name)",
                prompt: "Welche Figur kann auf einem leeren Brett in einem Zug von \(from.name) nach \(to.name) ziehen?", correct: right.germanName,
                wrong: wrong, explanation: "\(ChessKit.rule(of: right)) Von \(from.name) nach \(to.name) geht das mit: \(ChessKit.list(able.map(\.germanName))).",
                media: ChessKit.emptyBoard(marked: [from.name, to.name]), draw: &draw
            )
        }
        return nil
    }

    // MARK: Capturing

    static func captureMove(_ draw: inout ChessDraw) -> LearnExercise? {
        let withCaptures = ChessSamples.pieceMoves.filter { sample in
            guard let position = sample.position, let focus = sample.focusSquare else { return false }
            return position.legalMoves().contains { $0.from == focus && position.isCapture($0) }
        }
        guard let sample = draw.pick(withCaptures, key: "u2.captureMove"), let position = sample.position,
              let focus = sample.focusSquare, let piece = position[focus] else { return nil }
        let captures = position.legalMoves().filter { $0.from == focus && position.isCapture($0) }
        let targets = captures.map(\.to.name)
        return ChessKit.moveExercise(
            id: "u2.captureMove.\(sample.id)", prompt: "Schlage mit \(ChessKit.dative(piece.kind)) eine gegnerische Figur.", position: position,
            goal: .moves(ChessMoveFilter(from: focus, capture: true)),
            explanation: "\(ChessKit.rule(of: piece.kind)) Schlagen kannst du hier auf \(ChessKit.list(targets))."
        )
    }

    static func attackCount(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.pieceMoves, key: "u2.attackCount"), let position = sample.position,
              let focus = sample.focusSquare, let piece = position[focus] else { return nil }
        let attacked = position.attackedEnemies(by: focus)
        let places = attacked.isEmpty ? "Auf keinem Feld, das er erreichen kann, steht eine gegnerische Figur." : "Angegriffen werden die Figuren auf \(ChessKit.list(attacked.map(\.name)))."
        return ChessKit.number(
            id: "u2.attackCount.\(sample.id)",
            prompt: "Wie viele gegnerische Figuren greift \(ChessKit.nominative(piece.kind)) auf \(focus.name) an?", answer: attacked.count,
            explanation: "Angreifen heißt: Die Figur könnte im nächsten Zug schlagen. \(places)", media: ChessKit.board(position, marked: [focus.name])
        )
    }
}
