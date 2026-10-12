import Foundation

/// Unit 6, "Werte und Tausch": piece values, counting material, judging captures and exchanges.
enum ChessUnit6 {
    static let valued: [ChessPieceKind] = [.pawn, .knight, .bishop, .rook, .queen]

    static let makers: [String: ChessMaker] = [
        "u6.valueChoice": valueChoice,
        "u6.valueNumber": valueNumber,
        "u6.valuePairs": valuePairs,
        "u6.valueSum": valueSum,
        "u6.sentence.values": ChessKit.sentenceMaker("u6.sentence.values", valueSentences),
        "u6.materialCount": materialCount,
        "u6.materialWho": materialWho,
        "u6.captureBest": captureBest,
        "u6.tradeJudge": tradeJudge,
        "u6.tradeKinds": tradeKinds,
        "u6.contestCount": contestCount,
        "u6.contestJudge": contestJudge,
        "u6.contestBest": contestBest,
    ]

    static let review = ["u6.valueChoice", "u6.valueSum", "u6.captureBest", "u6.tradeJudge", "u6.materialCount"]

    static let valueSentences = [
        ChessSentence(key: "queen", words: ["Die", "Dame", "ist", "neun", "Bauern", "wert."], extra: ["fünf", "Springer"]),
        ChessSentence(key: "rook", words: ["Ein", "Turm", "ist", "fünf", "Bauern", "wert."], extra: ["drei", "Läufer"]),
        ChessSentence(key: "minor", words: ["Läufer", "und", "Springer", "sind", "gleich", "viel", "wert."], extra: ["Turm", "mehr"]),
    ]

    static let valueExplanation = "Bauer 1, Springer 3, Läufer 3, Turm 5, Dame 9. Der König hat keinen Wert, weil er nie verloren gehen darf."

    static func valueChoice(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let kind = draw.pick(valued, key: "u6.value", id: { $0.germanName }) else { return nil }
        let others = valued.map(\.value).filter { $0 != kind.value }
        return ChessKit.choice(
            id: "u6.valueChoice.\(kind.germanName)", prompt: "Wie viele Bauern ist \(ChessKit.nominative(kind)) wert?", correct: String(kind.value),
            wrong: ChessKit.numberWrongs(correct: kind.value, likely: others.shuffled(using: &draw.random), random: &draw.random, minimum: 1),
            explanation: valueExplanation, draw: &draw
        )
    }

    static func valueNumber(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let kind = draw.pick(valued, key: "u6.value", id: { $0.germanName }) else { return nil }
        return ChessKit.number(
            id: "u6.valueNumber.\(kind.germanName)", prompt: "Wie viele Bauern ist \(ChessKit.nominative(kind)) wert?", answer: kind.value,
            explanation: valueExplanation
        )
    }

    static func valuePairs(_ draw: inout ChessDraw) -> LearnExercise? {
        let minor: ChessPieceKind = draw.coin() ? .knight : .bishop
        let kinds: [ChessPieceKind] = [.pawn, minor, .rook, .queen]
        return ChessKit.pairs(
            id: "u6.valuePairs", prompt: "Wie viele Bauern ist die Figur wert?",
            from: kinds.map { (key: "u6.value.\($0.germanName)", front: $0.germanName, back: String($0.value)) }, draw: &draw
        )
    }

    // MARK: Adding values

    private struct Group {
        let parts: [(kind: ChessPieceKind, count: Int)]

        var sum: Int { parts.reduce(0) { $0 + $1.kind.value * $1.count } }

        var text: String {
            parts.map { part -> String in
                part.count == 1 ? ChessKit.indefinite(part.kind) : "zwei \(part.kind.germanPlural)"
            }.joined(separator: " und ")
        }

        var calculation: String {
            let values = parts.flatMap { part in Array(repeating: String(part.kind.value), count: part.count) }
            return values.count == 1 ? values[0] : values.joined(separator: " + ") + " = \(sum)"
        }

        var key: String { parts.map { "\($0.kind.rawValue)x\($0.count)" }.joined(separator: "-") }
    }

    private static func capitalised(_ text: String) -> String {
        text.prefix(1).uppercased() + text.dropFirst()
    }

    static func valueSum(_ draw: inout ChessDraw) -> LearnExercise? {
        for _ in 0..<30 {
            guard let single = valued.randomElement(using: &draw.random), let first = valued.randomElement(using: &draw.random),
                  let second = valued.randomElement(using: &draw.random) else { return nil }
            let one = Group(parts: [(single, 1)])
            let two = first == second ? Group(parts: [(first, 2)]) : Group(parts: [(first, 1), (second, 1)])
            guard one.sum != two.sum, one.key != two.key else { continue }
            let (bigger, smaller) = one.sum > two.sum ? (one, two) : (two, one)
            return ChessKit.choice(
                id: "u6.valueSum.\(one.key).\(two.key)", prompt: "Was ist mehr wert?", correct: capitalised(bigger.text), wrong: [capitalised(smaller.text)],
                explanation: "\(capitalised(bigger.text)): \(bigger.calculation). \(capitalised(smaller.text)): \(smaller.calculation).", draw: &draw
            )
        }
        return nil
    }

    // MARK: Counting material

    /// "1 Turm (5) + 3 Bauern (3) = 8".
    static func materialSum(of color: ChessColor, in position: ChessPosition) -> String {
        var parts: [String] = []
        for kind in [ChessPieceKind.queen, .rook, .bishop, .knight, .pawn] {
            let count = position.count(of: ChessPiece(color, kind))
            guard count > 0 else { continue }
            parts.append("\(count) \(count == 1 ? kind.germanName : kind.germanPlural) (\(count * kind.value))")
        }
        return parts.isEmpty ? "0" : parts.joined(separator: " + ") + " = \(position.material(of: color))"
    }

    static func materialCount(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.materialCounts, key: "u6.materialCount"), let position = sample.position,
              let color = ChessColor.allCases.randomElement(using: &draw.random) else { return nil }
        return ChessKit.number(
            id: "u6.materialCount.\(sample.id).\(color.adjectiveStem)", prompt: "Wie viel Material hat \(color.germanName)? Zähle ohne den König.",
            answer: position.material(of: color), explanation: materialSum(of: color, in: position) + ".", media: ChessKit.board(position)
        )
    }

    static func materialWho(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.materialCounts, key: "u6.materialWho"), let position = sample.position else { return nil }
        let white = position.material(of: .white)
        let black = position.material(of: .black)
        let right = white > black ? "Weiß" : (black > white ? "Schwarz" : "Beide gleich viel")
        return ChessKit.choice(
            id: "u6.materialWho.\(sample.id)", prompt: "Wer hat mehr Material? Zähle ohne die Könige.", correct: right,
            wrong: ["Weiß", "Schwarz", "Beide gleich viel"].filter { $0 != right },
            explanation: "Weiß: \(white), Schwarz: \(black).", media: ChessKit.board(position), draw: &draw
        )
    }

    // MARK: Captures and exchanges

    private static func signed(_ number: Int) -> String {
        number > 0 ? "+\(number)" : (number < 0 ? "−\(-number)" : "0")
    }

    static func captureBest(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.captureChoices, key: "u6.captureBest"), let position = sample.position else { return nil }
        let results = ChessExchange.captures(in: position)
        guard let best = ChessExchange.bestCaptures(in: position).moves.first else { return nil }
        let list = results.compactMap { entry -> String? in
            ChessNotation.san(entry.move, in: position).map { "\($0) \(signed(entry.gain))" }
        }
        _ = best
        return ChessKit.moveExercise(
            id: "u6.captureBest.\(sample.id)", prompt: "Schlage so, dass du am meisten gewinnst.", position: position, goal: .bestCapture,
            explanation: "Gewinn pro Schlag, nachdem beide Seiten auf dem Feld alles getauscht haben, was sich lohnt: \(list.joined(separator: ", ")). Prüfe immer, ob die Figur gedeckt ist."
        )
    }

    private static func judgement(gain: Int) -> String {
        gain > 0 ? "Das gewinnt Material" : (gain < 0 ? "Das verliert Material" : "Das ist ausgeglichen")
    }

    private static func judgeExercise(id: String, position: ChessPosition, move: ChessMove, draw: inout ChessDraw) -> LearnExercise? {
        guard let piece = position[move.from], position.isCapture(move) else { return nil }
        let gain = ChessExchange.gain(of: move, in: position)
        let color = position.sideToMove
        let explanation: String
        if gain > 0 {
            explanation = "Nach allen Schlägen auf \(move.to.name) hat \(color.germanName) \(gain) \(gain == 1 ? "Punkt" : "Punkte") mehr."
        } else if gain < 0 {
            explanation = "Nach allen Schlägen auf \(move.to.name) hat \(color.germanName) \(-gain) \(gain == -1 ? "Punkt" : "Punkte") weniger."
        } else {
            explanation = "Nach allen Schlägen auf \(move.to.name) ist das Material gleich geblieben."
        }
        let options = [judgement(gain: 1), judgement(gain: 0), judgement(gain: -1)]
        return ChessKit.choice(
            id: id, prompt: "\(color.germanName) schlägt mit \(ChessKit.dative(piece.kind)) auf \(move.to.name). Wie ist das für \(color.germanName)?",
            correct: judgement(gain: gain), wrong: options.filter { $0 != judgement(gain: gain) }, explanation: explanation,
            media: ChessKit.board(position, marked: [move.from.name, move.to.name]), draw: &draw
        )
    }

    static func tradeJudge(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.trades, key: "u6.tradeJudge"), let position = sample.position, let move = sample.detailMove else { return nil }
        return judgeExercise(id: "u6.tradeJudge.\(sample.id)", position: position, move: move, draw: &draw)
    }

    static func tradeKinds(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let attacker = valued.randomElement(using: &draw.random), let victim = valued.randomElement(using: &draw.random) else { return nil }
        let difference = victim.value - attacker.value
        let options = [judgement(gain: 1), judgement(gain: 0), judgement(gain: -1)]
        return ChessKit.choice(
            id: "u6.tradeKinds.\(attacker.germanName).\(victim.germanName)",
            prompt: "Du schlägst mit \(ChessKit.dative(attacker)) \(ChessKit.indefiniteAccusative(victim)). Dein Gegner schlägt sofort zurück. Wie ist das für dich?",
            correct: judgement(gain: difference), wrong: options.filter { $0 != judgement(gain: difference) },
            explanation: "Du bekommst \(victim.value) und gibst \(attacker.value) her: \(signed(difference)).", draw: &draw
        )
    }

    // MARK: Several attackers

    private static var openContests: [ChessSample] {
        ChessSamples.contests.filter { sample in
            guard let position = sample.position, let square = sample.focusSquare else { return false }
            return !ChessKit.hasHiddenAttackers(on: square, in: position)
        }
    }

    static func contestCount(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(openContests, key: "u6.contestCount"), let position = sample.position, let square = sample.focusSquare,
              let piece = position[square], let color = ChessColor.allCases.randomElement(using: &draw.random) else { return nil }
        let count = position.attackers(of: square, by: color).count
        let attacking = color != piece.color
        let prompt = attacking
            ? "Wie viele \(color.adjectiveStem)e Figuren greifen \(ChessKit.accusative(piece.kind)) auf \(square.name) an?"
            : "Wie viele \(color.adjectiveStem)e Figuren decken \(ChessKit.accusative(piece.kind)) auf \(square.name)?"
        let squares = position.attackers(of: square, by: color).map(\.name)
        return ChessKit.number(
            id: "u6.contestCount.\(sample.id).\(color.adjectiveStem)", prompt: prompt, answer: count,
            explanation: count == 0 ? "Keine \(color.adjectiveStem)e Figur kann auf \(square.name) schlagen."
                : "Auf \(square.name) können schlagen: \(ChessKit.list(squares)).",
            media: ChessKit.board(position, marked: [square.name])
        )
    }

    static func contestJudge(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.contests, key: "u6.contestJudge"), let position = sample.position, let square = sample.focusSquare else { return nil }
        let captures = position.legalMoves().filter { $0.to == square && position.isCapture($0) }
        guard let move = captures.randomElement(using: &draw.random) else { return nil }
        return judgeExercise(id: "u6.contestJudge.\(sample.id).\(move.uci)", position: position, move: move, draw: &draw)
    }

    static func contestBest(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.contests, key: "u6.contestBest"), let position = sample.position else { return nil }
        let results = ChessExchange.captures(in: position)
        let list = results.compactMap { entry -> String? in
            ChessNotation.san(entry.move, in: position).map { "\($0) \(signed(entry.gain))" }
        }
        return ChessKit.moveExercise(
            id: "u6.contestBest.\(sample.id)", prompt: "Schlage so, dass du am meisten gewinnst.", position: position, goal: .bestCapture,
            explanation: "Zähle die Schläge der Reihe nach durch. Gewinn pro Schlag: \(list.joined(separator: ", "))."
        )
    }
}
