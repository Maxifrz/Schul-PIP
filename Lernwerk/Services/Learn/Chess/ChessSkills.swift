import Foundation

/// Two goals per unit: the knowledge (what a rule says, names, counting, judging) and the use of it at the board
/// (finding the move). A student who can say what a fork is has not yet shown that he finds one.
extension ChessProvider {
    func skillFacets(of unit: CourseUnit) -> [SkillFacet] {
        // Units 4 and 8 ask by choosing, by pairs, by tiles and by finding moves; nothing in them is typed.
        let typed = unit.number != 4 && unit.number != 8
        return [
            SkillFacet(
                key: "know", title: "Wissen", goal: "Du kennst und erkennst: " + unit.summary,
                levels: typed ? [.recognise, .recall] : [.recognise], after: "know"
            ),
            SkillFacet(
                key: "board", title: "Am Brett", goal: "Du findest den richtigen Zug in einer Stellung: " + unit.title,
                levels: [.apply], requires: ["know"]
            ),
        ]
    }

    func skillTag(for exercise: LearnExercise, node: CourseNode) -> SkillTag {
        if exercise.kind == .chessMove { return SkillTag(facet: "board", level: .apply) }
        return SkillTag(facet: "know", level: .standard(for: exercise.kind))
    }

    func feedback(for exercise: LearnExercise, answer: LearnAnswer) -> String? {
        guard exercise.coach.hasPrefix(ChessCoach.prefix), case let .move(text) = answer,
              case let .board(spec)? = exercise.media, let position = ChessPosition(fen: spec.fen) else { return nil }
        return ChessCoach.explain(move: text, goal: String(exercise.coach.dropFirst(ChessCoach.prefix.count)), in: position)
    }
}

extension ChessGoal {
    /// The goal as the exercise carries it for the coach.
    var coachCode: String {
        switch self {
        case .moves: return "moves"
        case .mateInOne: return "mate"
        case let .escape(kind):
            switch kind {
            case .any: return "escape.any"
            case .kingMoves: return "escape.king"
            case .captureChecker: return "escape.capture"
            case .interpose: return "escape.block"
            }
        case .bestCapture: return "capture"
        case .bestMove: return "best"
        }
    }
}

/// Says why a move on the board does not solve the exercise, from the position alone: whether the move is allowed at
/// all, and, if it is, what it does not do. Nothing here claims more than the engine can show.
enum ChessCoach {
    static let prefix = "chess:"

    /// The two hints of a move exercise: first what to look for, then which piece it is, when all answers agree.
    static func hints(goal: ChessGoal, accepted: [ChessMove], in position: ChessPosition) -> [String] {
        var hints: [String] = []
        switch goal {
        case let .moves(filter):
            if filter.castling != nil {
                hints.append("Bei der Rochade ziehen König und Turm in einem Zug.")
            } else if filter.enPassant == true {
                hints.append("En passant gibt es nur direkt nach dem Doppelschritt eines Bauern, und man schlägt ihn im Vorbeigehen.")
            } else if filter.promotion == true {
                hints.append("Ein Bauer auf der letzten Reihe wird umgewandelt, meist in eine Dame.")
            } else if let kind = filter.kind {
                hints.append(ChessKit.rule(of: kind))
            } else {
                hints.append("Lies die Aufgabe noch einmal: Welche Figur soll wohin ziehen?")
            }
        case .mateInOne:
            hints.append("Suche Züge, die Schach bieten, und prüfe, ob der König danach noch ein Feld oder eine Antwort hat.")
        case .escape:
            hints.append("Es gibt drei Wege aus dem Schach: den König wegziehen, die schachbietende Figur schlagen oder eine Figur dazwischenstellen.")
        case .bestCapture:
            hints.append("Vergleiche, welche Figur du schlagen kannst, was sie wert ist und ob sie gedeckt ist.")
        case .bestMove:
            hints.append("Suche nach einer Gabel, einer Fesselung, einem Spieß oder einer Figur, die niemand deckt.")
        }
        let origins = Set(accepted.map(\.from))
        if origins.count == 1, let from = origins.first {
            hints.append("Es zieht die Figur auf \(from.name).")
        } else {
            let kinds = Set(accepted.compactMap { position[$0.from]?.kind })
            if kinds.count == 1, let kind = kinds.first {
                hints.append("Es zieht \(ChessKit.nominative(kind)).")
            }
        }
        return hints
    }

    static func explain(move text: String, goal: String, in position: ChessPosition) -> String? {
        guard let parsed = ChessMove(uci: text) else { return nil }
        let side = position.sideToMove
        guard let piece = position[parsed.from] else { return "Auf \(parsed.from.name) steht keine Figur." }
        guard piece.color == side else {
            return "Auf \(parsed.from.name) steht eine \(piece.color.adjectiveStem)e Figur, aber \(side.germanName) ist am Zug."
        }
        let legal = position.legalMoves().filter { $0.from == parsed.from && $0.to == parsed.to }
        guard let move = legal.first(where: { $0.promotion == .queen }) ?? legal.first else {
            return illegal(parsed, piece: piece, in: position)
        }
        let after = position.applying(move)
        let opponent = side.opposite
        switch goal {
        case "mate":
            guard after.isCheck else {
                return "Der Zug ist erlaubt, bietet aber kein Schach. Matt setzt, wer Schach bietet und dem König keine Antwort lässt."
            }
            if let reply = after.legalMoves().first, let san = ChessNotation.san(reply, in: after) {
                return "Der Zug bietet Schach, aber \(opponent.germanName) kann sich verteidigen, zum Beispiel mit \(san)."
            }
            return nil
        case "capture":
            guard position.isCapture(move) else {
                return "Der Zug ist erlaubt, schlägt aber nichts. Gesucht ist der Schlag, der am meisten Material gewinnt."
            }
            if after.legalMoves().contains(where: { $0.to == move.to }) {
                return "Die Figur auf \(move.to.name) ist gedeckt: \(opponent.germanName) kann zurückschlagen. Ein anderer Schlag gewinnt mehr."
            }
            return "Das gewinnt Material, aber ein anderer Schlag gewinnt mehr."
        case "best":
            if after.legalMoves().contains(where: { $0.to == move.to }) {
                return "Der Zug ist erlaubt, aber \(opponent.germanName) kann die Figur auf \(move.to.name) schlagen. Es gibt einen stärkeren Zug."
            }
            return "Der Zug ist erlaubt, aber es gibt einen stärkeren."
        case "escape.king":
            return "Der Zug beendet das Schach, aber nicht mit dem König. Hier ist der Königszug gesucht."
        case "escape.capture":
            return "Der Zug beendet das Schach, schlägt aber nicht die schachbietende Figur. Hier ist das Schlagen gesucht."
        case "escape.block":
            return "Der Zug beendet das Schach, stellt aber keine Figur dazwischen. Hier ist das Dazwischenstellen gesucht."
        default:
            return "Der Zug ist erlaubt, aber er ist nicht der, nach dem gefragt ist."
        }
    }

    /// Why a move that the rules do not allow is not allowed.
    private static func illegal(_ move: ChessMove, piece: ChessPiece, in position: ChessPosition) -> String {
        let name = ChessKit.nominative(piece.kind)
        let pseudo = position.pseudoLegalMoves().contains { $0.from == move.from && $0.to == move.to }
        if pseudo {
            return position.isCheck
                ? "Du stehst im Schach. Dieser Zug beendet das Schach nicht."
                : "Nach diesem Zug stünde dein König im Schach. Das ist nicht erlaubt."
        }
        if let target = position[move.to], target.color == piece.color {
            return "Auf \(move.to.name) steht schon eine eigene Figur."
        }
        if piece.kind != .pawn, ChessGeometry.canReach(piece.kind, from: move.from, to: move.to) {
            return "Der Weg von \(move.from.name) nach \(move.to.name) ist versperrt."
        }
        return "\(name.prefix(1).uppercased() + name.dropFirst()) kann nicht von \(move.from.name) nach \(move.to.name) ziehen. \(ChessKit.rule(of: piece.kind))"
    }
}
