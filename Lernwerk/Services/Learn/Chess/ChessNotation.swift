import Foundation

/// German standard algebraic notation: K König, D Dame, T Turm, L Läufer, S Springer, no letter for a pawn, x for a
/// capture, + for check, # for mate, O-O and O-O-O for castling, a letter after the square for a promotion ("e8D").
enum ChessNotation {
    /// The notation of a legal move in a position, like "Sf3", "exd5", "Tae1", "O-O", "e8D+", "Dh5#". nil when the
    /// move is not legal there.
    static func san(_ move: ChessMove, in position: ChessPosition) -> String? {
        san(move, in: position, legal: position.legalMoves())
    }

    /// The notation of every legal move of a position, in the generator's order.
    static func allSAN(in position: ChessPosition) -> [(move: ChessMove, san: String)] {
        let legal = position.legalMoves()
        return legal.compactMap { move in san(move, in: position, legal: legal).map { (move, $0) } }
    }

    private static func san(_ move: ChessMove, in position: ChessPosition, legal: [ChessMove]) -> String? {
        guard legal.contains(move), let piece = position[move.from] else { return nil }
        var text = ""
        if position.isCastling(move) {
            text = move.to.file == 6 ? "O-O" : "O-O-O"
        } else {
            let capture = position.isCapture(move)
            if piece.kind == .pawn {
                if capture { text += move.from.fileLetter + "x" }
                text += move.to.name
                if let promotion = move.promotion { text += promotion.letter }
            } else {
                text += piece.kind.letter
                // Other pieces of the same kind that could also go there make the origin necessary.
                let rivals = legal.filter { $0.to == move.to && $0.from != move.from && position[$0.from] == piece }
                if !rivals.isEmpty {
                    if !rivals.contains(where: { $0.from.file == move.from.file }) {
                        text += move.from.fileLetter
                    } else if !rivals.contains(where: { $0.from.rank == move.from.rank }) {
                        text += move.from.rankDigit
                    } else {
                        text += move.from.name
                    }
                }
                if capture { text += "x" }
                text += move.to.name
            }
        }
        let after = position.applying(move)
        if after.isCheck { text += after.hasLegalMove ? "+" : "#" }
        return text
    }

    /// The legal move a notation names, or nil. Check signs, "x", "=" and "e.p." are optional in the input; the
    /// letters are the German ones.
    static func move(fromSAN text: String, in position: ChessPosition) -> ChessMove? {
        let wanted = bare(text)
        guard !wanted.isEmpty else { return nil }
        let matches = allSAN(in: position).filter { bare($0.san) == wanted }
        return matches.count == 1 ? matches[0].move : nil
    }

    /// The notations of several moves, in order, each played after the one before; nil if one is not legal.
    static func sanLine(_ moves: [ChessMove], from position: ChessPosition) -> [String]? {
        var current = position
        var result: [String] = []
        for move in moves {
            guard let text = san(move, in: current) else { return nil }
            result.append(text)
            current = current.applying(move)
        }
        return result
    }

    /// The position after moves given in notation, in order; nil if one is not legal or unclear.
    static func play(_ line: [String], from position: ChessPosition = .start) -> ChessPosition? {
        var current = position
        for text in line {
            guard let move = move(fromSAN: text, in: current) else { return nil }
            current = current.applying(move)
        }
        return current
    }

    /// A notation reduced to what names the move: no signs, no capture mark, zeros read as the letter O.
    private static func bare(_ text: String) -> String {
        var result = text.replacingOccurrences(of: "e.p.", with: "").replacingOccurrences(of: " ", with: "")
        result = result.replacingOccurrences(of: "0", with: "O")
        result = result.filter { !"+#x×=!?:".contains($0) }
        return result
    }
}
