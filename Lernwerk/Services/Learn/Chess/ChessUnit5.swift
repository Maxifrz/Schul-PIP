import Foundation

/// Unit 5, "Sonderzüge": castling and when it is not allowed, en passant and promotion in detail.
enum ChessUnit5 {
    static let makers: [String: ChessMaker] = [
        "u5.castleMove": castleMove,
        "u5.castleSquares": castleSquares,
        "u5.castlePairs": castlePairs,
        "u5.sentence.castle": ChessKit.sentenceMaker("u5.sentence.castle", castleSentences),
        "u5.castleCan": castleCan,
        "u5.castleReason": castleReason,
        "u5.castleRules": ChessKit.statementMaker("u5.castleRules", castleRules),
        "u5.classify": classify,
        "u5.epYesNo": ChessUnit3.epYesNo("u5.epYesNo", themes: ["available", "late", "single", "pinned"]),
        "u5.epRules": ChessKit.statementMaker("u5.epRules", epRules),
        "u5.promoCheck": promoCheck,
        "u5.promoPiece": promoPiece,
        "u5.promoRules": ChessKit.statementMaker("u5.promoRules", promoRules),
    ]

    static let review = ["u5.castleMove", "u5.castleCan", "u5.classify", "u5.epYesNo", "u5.castleReason"]

    static let castleSentences = [
        ChessSentence(key: "king", words: ["Bei", "der", "Rochade", "zieht", "der", "König", "zwei", "Felder", "zum", "Turm."], extra: ["drei", "ein"]),
        ChessSentence(key: "both", words: ["Die", "Rochade", "ist", "ein", "Zug", "mit", "König", "und", "Turm."], extra: ["Dame", "zwei"]),
    ]

    static let castleRules = [
        ChessStatement(
            key: "check", prompt: "Welcher Satz über die Rochade stimmt?", correct: "Der König darf dabei nicht im Schach stehen.",
            wrong: ["Der Turm darf dabei nicht angegriffen sein.", "Zwischen König und Turm darf eine Figur stehen.", "Die Rochade ist auch erlaubt, wenn der König schon gezogen hat."],
            explanation: "Aus dem Schach heraus rochiert man nicht. Der Turm darf angegriffen sein, und zwischen beiden muss alles frei sein."
        ),
        ChessStatement(
            key: "path", prompt: "Welcher Satz über die Rochade stimmt?", correct: "Der König darf nicht über ein angegriffenes Feld ziehen.",
            wrong: ["Die lange Rochade ist verboten, wenn das Feld b1 angegriffen wird.", "Die Rochade ist verboten, wenn der Turm angegriffen wird.", "Mit einem Turm, der schon gezogen hat und zurückgekehrt ist, darf man rochieren."],
            explanation: "Es zählen nur die Felder, über die der König zieht, und das Feld, auf dem er landet. Der Turm und das Feld b1 spielen keine Rolle."
        ),
        ChessStatement(
            key: "count", prompt: "Welcher Satz über die Rochade stimmt?", correct: "Die Rochade zählt als ein Zug.",
            wrong: ["Die Rochade zählt als zwei Züge.", "Mit der Rochade darf man eine Figur schlagen.", "Nach der Rochade darf man gleich noch einmal ziehen."],
            explanation: "König und Turm ziehen zusammen in einem einzigen Zug, und dabei wird nichts geschlagen."
        ),
        ChessStatement(
            key: "rook", prompt: "Welcher Satz über die Rochade stimmt?", correct: "Hat sich ein Turm schon bewegt, geht die Rochade mit diesem Turm nicht mehr.",
            wrong: ["Die Rochade bleibt erlaubt, wenn der Turm auf sein Feld zurückkehrt.", "Dann geht die Rochade auch mit dem anderen Turm nicht mehr.", "Nur der König muss sich noch nie bewegt haben."],
            explanation: "Der König und der Turm, mit dem man rochiert, dürfen sich noch nie bewegt haben. Der andere Turm ist davon nicht betroffen."
        ),
    ]

    static let epRules = [
        ChessStatement(
            key: "moment", prompt: "Welcher Satz über en passant stimmt?", correct: "En passant ist nur im Zug direkt nach dem Doppelschritt erlaubt.",
            wrong: ["En passant ist jederzeit erlaubt, solange die Bauern nebeneinander stehen.", "Auch ein Springer darf en passant schlagen.", "En passant schlägt man einen Bauern, der nur ein Feld gezogen ist."],
            explanation: "Nur ein Bauer schlägt en passant, nur einen Bauern, der gerade zwei Felder gezogen ist, und nur sofort."
        ),
        ChessStatement(
            key: "landing", prompt: "Welcher Satz über en passant stimmt?", correct: "Der schlagende Bauer landet auf dem Feld, das der gegnerische Bauer übersprungen hat.",
            wrong: ["Der schlagende Bauer landet auf dem Feld des gegnerischen Bauern.", "Der schlagende Bauer bleibt auf seinem Feld.", "Der schlagende Bauer landet zwei Felder weiter."],
            explanation: "Man schlägt, als wäre der gegnerische Bauer nur ein Feld gezogen. Der Bauer geht also auf das übersprungene Feld."
        ),
    ]

    static let promoRules = [
        ChessStatement(
            key: "must", prompt: "Welcher Satz über die Umwandlung stimmt?", correct: "Ein Bauer auf der letzten Reihe muss sich umwandeln.",
            wrong: ["Ein Bauer darf auf der letzten Reihe bleiben.", "Ein Bauer darf sich nur in eine schon geschlagene Figur umwandeln.", "Ein Bauer darf sich auch in einen König umwandeln."],
            explanation: "Der Bauer wird im selben Zug zu Dame, Turm, Läufer oder Springer, ganz gleich, welche Figuren schon geschlagen wurden."
        ),
        ChessStatement(
            key: "queens", prompt: "Welcher Satz über die Umwandlung stimmt?", correct: "Man darf mehrere Damen gleichzeitig haben.",
            wrong: ["Man darf höchstens eine Dame haben.", "Eine zweite Dame gibt es nur, wenn die erste geschlagen wurde.", "Ein Bauer wird auf der letzten Reihe immer zu einer Dame."],
            explanation: "Die Wahl ist nicht auf geschlagene Figuren beschränkt. Auch eine zweite oder dritte Dame ist erlaubt."
        ),
    ]

    private static func castleSide(of sample: ChessSample) -> ChessCastleSide {
        sample.detail == "kurz" ? .kingside : .queenside
    }

    private static func sideWord(_ side: ChessCastleSide) -> String { side == .kingside ? "kurz" : "lang" }

    /// The squares of the king's way: the one it crosses and the one it lands on.
    private static func kingWay(_ side: ChessCastleSide, color: ChessColor) -> (cross: ChessSquare, land: ChessSquare) {
        let rank = color.homeRank
        return (ChessSquare(file: side == .kingside ? 5 : 3, rank: rank)!, ChessSquare(file: side == .kingside ? 6 : 2, rank: rank)!)
    }

    static func castleMove(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.castling.filter { $0.expected == ["ja"] }
        guard let sample = draw.pick(pool, key: "u5.castleMove"), let position = sample.position else { return nil }
        let side = castleSide(of: sample)
        let color = position.sideToMove
        let way = kingWay(side, color: color)
        return ChessKit.moveExercise(
            id: "u5.castleMove.\(sample.id)", prompt: "Rochiere \(sideWord(side)).", position: position,
            goal: .moves(ChessMoveFilter(castling: side)),
            explanation: "Der König zieht zwei Felder zum Turm hin, nach \(way.land.name). Der Turm springt auf die andere Seite des Königs, nach \(way.cross.name). Du führst den Zug mit dem König aus."
        )
    }

    static func castleSquares(_ draw: inout ChessDraw) -> LearnExercise? {
        struct Case: Hashable {
            let color: ChessColor
            let side: ChessCastleSide
            let king: Bool
        }
        var cases: [Case] = []
        for color in ChessColor.allCases {
            for side in [ChessCastleSide.kingside, .queenside] {
                for king in [true, false] { cases.append(Case(color: color, side: side, king: king)) }
            }
        }
        guard let item = draw.pick(cases, key: "u5.castleSquares", id: { "\($0.color.adjectiveStem).\(sideWord($0.side)).\($0.king)" }) else { return nil }
        let fen = item.color == .white ? "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" : "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"
        guard let position = ChessPosition(fen: fen) else { return nil }
        let rank = item.color.homeRank
        let kingFrom = ChessSquare(file: 4, rank: rank)!
        let rookFrom = ChessSquare(file: item.side == .kingside ? 7 : 0, rank: rank)!
        let way = kingWay(item.side, color: item.color)
        // The king lands on the far square of its way, the rook on the near one.
        let right = item.king ? way.land : way.cross
        let other = item.king ? way.cross : way.land
        let subject = item.king ? "der König" : "der Turm"
        guard let castle = ChessGoals.accepted(.moves(ChessMoveFilter(castling: item.side)), in: position).first else { return nil }
        let after = position.applying(castle)
        guard after[right] == ChessPiece(item.color, item.king ? .king : .rook) else { return nil }
        return ChessKit.choice(
            id: "u5.castleSquares.\(item.color.adjectiveStem).\(sideWord(item.side)).\(item.king ? "king" : "rook")",
            prompt: "Auf welchem Feld steht \(subject) nach der \(item.side.germanName)n Rochade von \(item.color.germanName)?", correct: right.name,
            wrong: [rookFrom.name, kingFrom.name, other.name],
            explanation: "Der König zieht zwei Felder zum Turm hin und steht auf \(way.land.name). Der Turm springt über ihn hinweg auf \(way.cross.name).",
            media: ChessKit.board(position), draw: &draw
        )
    }

    static func castlePairs(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.pairs(
            id: "u5.castlePairs", prompt: "Ordne die Schreibweisen zu.",
            from: [
                (key: "u5.pair.short", front: "O-O", back: "kurze Rochade"),
                (key: "u5.pair.long", front: "O-O-O", back: "lange Rochade"),
                (key: "u5.pair.whiteShort", front: "Weiß kurz", back: "König g1, Turm f1"),
                (key: "u5.pair.whiteLong", front: "Weiß lang", back: "König c1, Turm d1"),
            ],
            draw: &draw
        )
    }

    // MARK: When castling is not allowed

    private static func story(for sample: ChessSample, color: ChessColor, side: ChessCastleSide) -> String {
        let rank = color.homeRank + 1
        switch sample.theme {
        case "kingMoved": return "Der \(color.adjectiveStem)e König hat früher schon einmal gezogen und steht wieder auf e\(rank)."
        case "rookMoved": return "Der Turm auf \(side == .kingside ? "h" : "a")\(rank) hat früher schon einmal gezogen und steht wieder dort."
        case "otherRook": return "Der Turm auf \(side == .kingside ? "a" : "h")\(rank) hat früher schon einmal gezogen."
        default: return "König und Türme haben sich noch nie bewegt."
        }
    }

    static func castleCan(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.castling, key: "u5.castleCan"), let position = sample.position else { return nil }
        let side = castleSide(of: sample)
        let color = position.sideToMove
        let way = kingWay(side, color: color)
        let allowed = !ChessGoals.accepted(.moves(ChessMoveFilter(castling: side)), in: position).isEmpty
        let rank = color.homeRank + 1
        let explanation: String
        switch sample.theme {
        case "between": explanation = "Zwischen König und Turm steht noch eine Figur. Es muss alles frei sein."
        case "check": explanation = "Der König steht im Schach. Aus dem Schach heraus darf man nicht rochieren."
        case "cross": explanation = "Der König müsste über \(way.cross.name) ziehen, und dieses Feld greift der Gegner an."
        case "land": explanation = "Auf dem Zielfeld \(way.land.name) stünde der König im Schach."
        case "kingMoved": explanation = "Hat sich der König einmal bewegt, gibt es die Rochade für den Rest der Partie nicht mehr, auch wenn er zurückkehrt."
        case "rookMoved": explanation = "Mit einem Turm, der sich schon bewegt hat, gibt es keine Rochade mehr."
        case "otherRook": explanation = "Die \(side.germanName) Rochade braucht nur den König und den Turm auf \(side == .kingside ? "h" : "a")\(rank). Der andere Turm ist egal."
        case "b1": explanation = "Es zählen nur die Felder des Königs. Dass das Feld b\(rank) angegriffen wird, stört nicht."
        case "rookAttacked": explanation = "Der Turm darf angegriffen sein. Nur die Felder, die der König betritt, müssen sicher sein."
        default: explanation = "Alles ist frei, der König steht nicht im Schach und zieht weder über noch auf ein angegriffenes Feld: Die Rochade ist erlaubt."
        }
        return ChessKit.yesNo(
            id: "u5.castleCan.\(sample.id)", prompt: "\(story(for: sample, color: color, side: side)) Darf \(color.germanName) jetzt \(sideWord(side)) rochieren?",
            answer: allowed, explanation: explanation, media: ChessKit.board(position), draw: &draw
        )
    }

    static let reasonTexts: [ChessCastlingProblem: String] = [
        .piecesBetween: "Zwischen König und Turm steht eine Figur.",
        .inCheck: "Der König steht im Schach.",
        .crossesAttackedSquare: "Der König müsste über ein angegriffenes Feld ziehen.",
        .landsOnAttackedSquare: "Das Zielfeld des Königs wird angegriffen.",
    ]

    /// Reasons that never apply: the rook may be attacked, and the prompt says the king has not moved.
    static let falseReasons = ["Der Turm wird angegriffen.", "Der König hat sich schon bewegt."]

    static func castleReason(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.castling.filter { sample in
            guard sample.expected == ["nein"], let position = sample.position else { return false }
            let problems = ChessCastling.problems(castleSide(of: sample), in: position)
            return problems.count == 1 && problems[0] != .rightLost
        }
        guard let sample = draw.pick(pool, key: "u5.castleReason"), let position = sample.position else { return nil }
        let side = castleSide(of: sample)
        let problems = ChessCastling.problems(side, in: position)
        guard let only = problems.first, let right = reasonTexts[only] else { return nil }
        let absent = reasonTexts.filter { !problems.contains($0.key) }.map(\.value).sorted() + falseReasons
        let color = position.sideToMove
        let way = kingWay(side, color: color)
        let detail: String
        switch only {
        case .crossesAttackedSquare: detail = " Das Feld \(way.cross.name) greift der Gegner an."
        case .landsOnAttackedSquare: detail = " Das Feld \(way.land.name) greift der Gegner an."
        default: detail = ""
        }
        return ChessKit.choice(
            id: "u5.castleReason.\(sample.id)",
            prompt: "König und Türme haben sich noch nie bewegt. Warum darf \(color.germanName) nicht \(sideWord(side)) rochieren?", correct: right,
            wrong: absent.shuffled(using: &draw.random), explanation: right + detail, media: ChessKit.board(position), draw: &draw
        )
    }

    // MARK: Special moves recognised

    static func classify(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.classify, key: "u5.classify"), let position = sample.position, let move = sample.detailMove,
              position.isLegal(move), let piece = position[move.from] else { return nil }
        let names = ["Rochade", "En passant", "Bauernumwandlung", "Doppelschritt"]
        let right: String
        let explanation: String
        if position.isCastling(move) {
            right = names[0]
            explanation = "Der König zieht zwei Felder, und der Turm zieht mit: Das ist die Rochade."
        } else if position.isEnPassant(move) {
            right = names[1]
            explanation = "Der Bauer schlägt schräg auf ein leeres Feld und nimmt den Bauern daneben vom Brett: en passant."
        } else if move.promotion != nil {
            right = names[2]
            explanation = "Der Bauer erreicht die letzte Reihe und wird zu einer anderen Figur: Bauernumwandlung."
        } else if piece.kind == .pawn, abs(move.to.rank - move.from.rank) == 2 {
            right = names[3]
            explanation = "Der Bauer zieht aus der Ausgangsstellung zwei Felder: Doppelschritt."
        } else {
            return nil
        }
        return ChessKit.choice(
            id: "u5.classify.\(sample.id)",
            prompt: "\(position.sideToMove.germanName) zieht \(ChessKit.accusative(piece.kind)) von \(move.from.name) nach \(move.to.name). Wie heißt dieser Zug?",
            correct: right, wrong: names.filter { $0 != right }, explanation: explanation,
            media: ChessKit.board(position, marked: [move.from.name, move.to.name]), draw: &draw
        )
    }

    /// A promotion to a queen that gives check.
    static func promoCheck(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.promotions.filter { ["step", "capture"].contains($0.theme) }
        guard let sample = draw.pick(pool, key: "u5.promoCheck"), let position = sample.position, let focus = sample.focusSquare else { return nil }
        return ChessKit.moveExercise(
            id: "u5.promoCheck.\(sample.id)", prompt: "Wandle den Bauern in eine Dame um und gib damit Schach.", position: position,
            goal: .moves(ChessMoveFilter(from: focus, promotionTo: .queen, check: true)),
            explanation: "Die neue Dame steht auf der letzten Reihe und greift den gegnerischen König auf derselben Reihe an."
        )
    }

    static func promoPiece(_ draw: inout ChessDraw) -> LearnExercise? {
        let allowed = ChessPieceKind.allCases.filter { [.queen, .rook, .bishop, .knight].contains($0) }
        let shown = allowed.shuffled(using: &draw.random).prefix(3).map(\.germanName)
        return ChessKit.choice(
            id: "u5.promoPiece", prompt: "Welche Figur kann ein Bauer bei der Umwandlung nicht werden?", correct: ChessPieceKind.king.germanName,
            wrong: Array(shown), explanation: "Erlaubt sind Dame, Turm, Läufer und Springer. Zum König wird ein Bauer nie.", draw: &draw
        )
    }
}
