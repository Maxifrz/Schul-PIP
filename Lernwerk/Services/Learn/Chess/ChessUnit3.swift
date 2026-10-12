import Foundation

/// Unit 3, "Der Bauer": step and double step, capturing, en passant, promotion.
enum ChessUnit3 {
    static let makers: [String: ChessMaker] = [
        "u3.direction": direction,
        "u3.moveOne": moveOne,
        "u3.moveTwo": moveTwo,
        "u3.stepCount.simple": stepCount("u3.stepCount.simple", themes: ["start", "moved", "blocked", "blockedFar"]),
        "u3.stepCount.all": stepCount("u3.stepCount.all", themes: nil),
        "u3.doubleStep": doubleStep,
        "u3.capture": capture,
        "u3.captureDir": captureDir,
        "u3.attackedSquare": attackedSquare,
        "u3.pairs": pairs,
        "u3.sentence.move": ChessKit.sentenceMaker("u3.sentence.move", moveSentences),
        "u3.sentence.special": ChessKit.sentenceMaker("u3.sentence.special", specialSentences),
        "u3.epMove": epMove,
        "u3.epYesNo": epYesNo("u3.epYesNo", themes: ["available", "late", "single"]),
        "u3.promoMove": promoMove,
        "u3.promoWhich": promoWhich,
        "u3.promoRank": promoRank,
        "u3.promoSteps": promoSteps,
    ]

    static let review = ["u3.moveTwo", "u3.stepCount.all", "u3.capture", "u3.attackedSquare", "u3.epYesNo", "u3.promoMove"]

    static let moveSentences = [
        ChessSentence(key: "forward", words: ["Ein", "Bauer", "zieht", "vorwärts", "und", "schlägt", "schräg."], extra: ["rückwärts", "gerade."]),
        ChessSentence(key: "never", words: ["Ein", "Bauer", "darf", "nie", "rückwärts", "ziehen."], extra: ["immer", "seitwärts"]),
        ChessSentence(key: "double", words: ["Den", "Doppelschritt", "gibt", "es", "nur", "vom", "Start", "aus."], extra: ["jedem", "Ende"]),
    ]

    static let specialSentences = [
        ChessSentence(key: "ep", words: ["En", "passant", "geht", "nur", "im", "nächsten", "Zug."], extra: ["jederzeit", "Läufer"]),
        ChessSentence(key: "promotion", words: ["Auf", "der", "letzten", "Reihe", "wird", "der", "Bauer", "umgewandelt."], extra: ["ersten", "Dame"]),
    ]

    private static func pawnSamples(_ pool: [ChessSample], themes: Set<String>?) -> [ChessSample] {
        pool.filter { themes == nil || themes!.contains($0.theme) }
    }

    static func direction(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let color = draw.pick(ChessColor.allCases, key: "u3.direction", id: { $0.germanName }) else { return nil }
        let up = "nach oben, zur 8. Reihe"
        let down = "nach unten, zur 1. Reihe"
        return ChessKit.choice(
            id: "u3.direction.\(color.adjectiveStem)", prompt: "In welche Richtung ziehen die \(color.adjectiveStem)en Bauern?",
            correct: color == .white ? up : down, wrong: [color == .white ? down : up, "zur Seite", "in jede Richtung"],
            explanation: "Bauern ziehen nur vorwärts: die weißen nach oben, die schwarzen nach unten.", draw: &draw
        )
    }

    private static func stepSample(_ draw: inout ChessDraw, topic: String, steps: Int) -> (sample: ChessSample, position: ChessPosition, focus: ChessSquare, target: ChessSquare)? {
        let usable = ChessSamples.pawns.filter { sample in
            guard let position = sample.position, let focus = sample.focusSquare, let piece = position[focus], piece.kind == .pawn,
                  let target = focus.offset(file: 0, rank: steps * piece.color.pawnDirection) else { return false }
            return position.isLegal(ChessMove(from: focus, to: target))
        }
        guard let sample = draw.pick(usable, key: topic), let position = sample.position, let focus = sample.focusSquare,
              let piece = position[focus], let target = focus.offset(file: 0, rank: steps * piece.color.pawnDirection) else { return nil }
        return (sample, position, focus, target)
    }

    static func moveOne(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let item = stepSample(&draw, topic: "u3.moveOne", steps: 1) else { return nil }
        return ChessKit.moveExercise(
            id: "u3.moveOne.\(item.sample.id)", prompt: "Ziehe den Bauern von \(item.focus.name) ein Feld vor.", position: item.position,
            goal: .moves(ChessMoveFilter(from: item.focus, to: item.target)), explanation: "Der Bauer zieht ein Feld geradeaus vorwärts."
        )
    }

    static func moveTwo(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let item = stepSample(&draw, topic: "u3.moveTwo", steps: 2) else { return nil }
        return ChessKit.moveExercise(
            id: "u3.moveTwo.\(item.sample.id)", prompt: "Ziehe den Bauern von \(item.focus.name) zwei Felder vor.", position: item.position,
            goal: .moves(ChessMoveFilter(from: item.focus, to: item.target)),
            explanation: "Aus der Ausgangsstellung darf der Bauer zwei Felder ziehen, wenn beide Felder frei sind."
        )
    }

    static func stepCount(_ topic: String, themes: Set<String>?) -> ChessMaker {
        { draw in
            guard let sample = draw.pick(pawnSamples(ChessSamples.pawns, themes: themes), key: topic), let position = sample.position,
                  let focus = sample.focusSquare else { return nil }
            let moves = position.legalMoves().filter { $0.from == focus }
            let straight = moves.filter { $0.from.file == $0.to.file }.count
            let captures = moves.filter { position.isCapture($0) }.count
            var explanation = "Geradeaus \(straight == 1 ? "1 Zug" : "\(straight) Züge"), schräg schlagen \(captures == 1 ? "1 Mal" : "\(captures) Mal")."
            if moves.isEmpty { explanation = "Direkt vor dem Bauern steht eine Figur, und es gibt nichts zu schlagen: Er kann nicht ziehen." }
            return ChessKit.choice(
                id: "\(topic).\(sample.id)", prompt: "Wie viele Züge hat der Bauer auf \(focus.name)?", correct: String(moves.count),
                wrong: ChessKit.numberWrongs(correct: moves.count, likely: [2], random: &draw.random), explanation: explanation,
                media: ChessKit.board(position, marked: [focus.name]), draw: &draw
            )
        }
    }

    static func doubleStep(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.pawns.filter { ["start", "moved", "blocked", "blockedFar"].contains($0.theme) }
        guard let sample = draw.pick(pool, key: "u3.doubleStep"), let position = sample.position, let focus = sample.focusSquare,
              let piece = position[focus], let one = focus.offset(file: 0, rank: piece.color.pawnDirection),
              let two = focus.offset(file: 0, rank: 2 * piece.color.pawnDirection) else { return nil }
        let allowed = position.isLegal(ChessMove(from: focus, to: two))
        let reason: String
        if focus.rank != piece.color.pawnStartRank {
            reason = "Der Bauer ist schon gezogen: zwei Felder darf er nur aus der Ausgangsstellung."
        } else if position[one] != nil {
            reason = "Direkt vor dem Bauern steht eine Figur: Er kommt nicht vorbei."
        } else if position[two] != nil {
            reason = "Das zweite Feld \(two.name) ist besetzt: Der Doppelschritt braucht zwei freie Felder."
        } else {
            reason = "Der Bauer steht noch auf seiner Ausgangsreihe, und beide Felder sind frei."
        }
        return ChessKit.yesNo(
            id: "u3.doubleStep.\(sample.id)", prompt: "Darf der Bauer auf \(focus.name) jetzt zwei Felder ziehen?", answer: allowed,
            explanation: reason, media: ChessKit.board(position, marked: [focus.name]), draw: &draw
        )
    }

    static func capture(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.pawns.filter { sample in
            guard let position = sample.position, let focus = sample.focusSquare else { return false }
            return position.legalMoves().contains { $0.from == focus && position.isCapture($0) }
        }
        guard let sample = draw.pick(pool, key: "u3.capture"), let position = sample.position, let focus = sample.focusSquare else { return nil }
        return ChessKit.moveExercise(
            id: "u3.capture.\(sample.id)", prompt: "Schlage mit dem Bauern auf \(focus.name) eine gegnerische Figur.", position: position,
            goal: .moves(ChessMoveFilter(from: focus, capture: true)), explanation: "Der Bauer schlägt schräg vorwärts, nie geradeaus."
        )
    }

    static func captureDir(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.choice(
            id: "u3.captureDir", prompt: "In welche Richtung schlägt ein Bauer?", correct: "schräg vorwärts",
            wrong: ["geradeaus vorwärts", "zur Seite", "schräg rückwärts"],
            explanation: "Der Bauer zieht geradeaus, schlägt aber schräg vorwärts. Eine Figur direkt vor ihm blockiert ihn nur.", draw: &draw
        )
    }

    static func attackedSquare(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let sample = draw.pick(ChessSamples.pawns, key: "u3.attackedSquare"), let position = sample.position, let focus = sample.focusSquare,
              let piece = position[focus] else { return nil }
        let attacked = position.attackedSquares(by: focus)
        guard let right = attacked.randomElement(using: &draw.random) else { return nil }
        let step = piece.color.pawnDirection
        let candidates = [focus.offset(file: 0, rank: step), focus.offset(file: 1, rank: 0), focus.offset(file: -1, rank: 0),
                          focus.offset(file: 1, rank: -step), focus.offset(file: -1, rank: -step), focus.offset(file: 0, rank: -step)]
        let wrong = candidates.compactMap { $0 }.filter { !attacked.contains($0) }.map(\.name)
        return ChessKit.choice(
            id: "u3.attackedSquare.\(sample.id)", prompt: "Welches Feld greift der markierte Bauer an?", correct: right.name, wrong: wrong.shuffled(using: &draw.random),
            explanation: "Ein \(piece.color.adjectiveStem)er Bauer greift die Felder schräg vor sich an: \(ChessKit.list(attacked.map(\.name))).",
            media: ChessKit.board(position, marked: [focus.name]), draw: &draw
        )
    }

    static func pairs(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.pairs(
            id: "u3.pairs", prompt: "Was ist was beim Bauern?",
            from: [
                (key: "u3.pair.step", front: "Schritt", back: "ein Feld geradeaus"),
                (key: "u3.pair.double", front: "Doppelschritt", back: "zwei Felder, nur vom Start"),
                (key: "u3.pair.capture", front: "Schlagen", back: "ein Feld schräg vorwärts"),
                (key: "u3.pair.promotion", front: "Umwandlung", back: "auf der letzten Reihe"),
            ],
            draw: &draw
        )
    }

    // MARK: En passant

    /// The story that goes with an en passant position: where the pawn that just moved came from and went to.
    static func doubleStepStory(_ position: ChessPosition) -> String? {
        guard let target = position.enPassant else { return nil }
        let mover = position.sideToMove.opposite
        guard let from = ChessSquare(file: target.file, rank: mover.pawnStartRank),
              let to = ChessSquare(file: target.file, rank: mover.pawnStartRank + 2 * mover.pawnDirection) else { return nil }
        return "\(mover.germanName) hat gerade den Bauern von \(from.name) nach \(to.name) gezogen."
    }

    static func epMove(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.enPassant.filter { $0.theme == "available" }
        guard let sample = draw.pick(pool, key: "u3.epMove"), let position = sample.position, let story = doubleStepStory(position),
              let target = position.enPassant else { return nil }
        return ChessKit.moveExercise(
            id: "u3.epMove.\(sample.id)", prompt: "\(story) Schlage ihn en passant.", position: position,
            goal: .moves(ChessMoveFilter(enPassant: true)),
            explanation: "Du schlägst den Bauern, als wäre er nur ein Feld gezogen: Dein Bauer landet auf \(target.name), und der gegnerische Bauer verschwindet."
        )
    }

    /// "Darf der Bauer en passant schlagen?": the story tells what the last move was, the engine says whether it is legal.
    static func epYesNo(_ topic: String, themes: Set<String>) -> ChessMaker {
        { draw in
            let pool = ChessSamples.enPassant.filter { themes.contains($0.theme) }
            guard let sample = draw.pick(pool, key: topic), let position = sample.position, let focus = sample.focusSquare,
                  let neighbour = sample.detailSquare, let neighbourPiece = position[neighbour] else { return nil }
            let allowed = position.legalMoves().contains { $0.from == focus && position.isEnPassant($0) }
            let opponent = position.sideToMove.opposite
            let story: String
            switch sample.theme {
            case "late": story = "Der \(opponent.adjectiveStem)e Bauer steht schon länger auf \(neighbour.name)."
            case "single":
                let from = ChessSquare(file: neighbour.file, rank: neighbour.rank - neighbourPiece.color.pawnDirection)
                story = "\(opponent.germanName) hat den Bauern gerade von \(from?.name ?? "") nach \(neighbour.name) gezogen, nur ein Feld."
            default: story = doubleStepStory(position) ?? ""
            }
            let explanation: String
            if allowed {
                explanation = "Der Bauer ist im letzten Zug zwei Felder gezogen und steht neben deinem: Du darfst jetzt, aber nur jetzt, en passant schlagen."
            } else if sample.theme == "pinned" {
                explanation = "Nach dem Schlagen wären beide Bauern von der Reihe verschwunden, und der gegnerische Turm griffe deinen König an. Ein Zug, der den eigenen König ins Schach stellt, ist verboten."
            } else {
                explanation = "En passant gibt es nur direkt nach einem Doppelschritt des gegnerischen Bauern."
            }
            return ChessKit.yesNo(
                id: "\(topic).\(sample.id)", prompt: "\(story) Darf der Bauer auf \(focus.name) den Bauern auf \(neighbour.name) en passant schlagen?",
                answer: allowed, explanation: explanation, media: ChessKit.board(position, marked: [focus.name, neighbour.name]), draw: &draw
            )
        }
    }

    // MARK: Promotion

    static func promoMove(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.promotions.filter { ["step", "capture"].contains($0.theme) }
        guard let sample = draw.pick(pool, key: "u3.promoMove"), let position = sample.position, let focus = sample.focusSquare else { return nil }
        return ChessKit.moveExercise(
            id: "u3.promoMove.\(sample.id)", prompt: "Dein Bauer erreicht die letzte Reihe. Ziehe ihn und wandle ihn in eine Dame um.", position: position,
            goal: .moves(ChessMoveFilter(from: focus, promotionTo: .queen)),
            explanation: "Auf der letzten Reihe muss sich der Bauer umwandeln, und die Dame ist meist die stärkste Wahl."
        )
    }

    static func promoWhich(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.choice(
            id: "u3.promoWhich", prompt: "In welche Figuren darf sich ein Bauer umwandeln?", correct: "Dame, Turm, Läufer oder Springer",
            wrong: ["nur in eine Dame", "Dame, Turm, Läufer, Springer oder König", "nur in eine Figur, die schon geschlagen wurde"],
            explanation: "Erlaubt sind Dame, Turm, Läufer und Springer, auch wenn diese Figur noch auf dem Brett steht. König oder Bauer gibt es nicht.",
            draw: &draw
        )
    }

    static func promoRank(_ draw: inout ChessDraw) -> LearnExercise? {
        guard let color = draw.pick(ChessColor.allCases, key: "u3.promoRank", id: { $0.germanName }) else { return nil }
        let right = color.promotionRank + 1
        return ChessKit.choice(
            id: "u3.promoRank.\(color.adjectiveStem)", prompt: "Auf welcher Reihe wandelt sich ein \(color.adjectiveStem)er Bauer um?", correct: String(right),
            wrong: ChessKit.numberWrongs(correct: right, likely: [9 - right, color == .white ? 7 : 2, 4], random: &draw.random, minimum: 1),
            explanation: "Ein Bauer wandelt sich auf der letzten Reihe um, die er erreichen kann: bei Weiß die 8., bei Schwarz die 1. Reihe.", draw: &draw
        )
    }

    static func promoSteps(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.promotions.filter { ["step", "far"].contains($0.theme) }
        guard let sample = draw.pick(pool, key: "u3.promoSteps"), let position = sample.position, let focus = sample.focusSquare,
              let piece = position[focus] else { return nil }
        let steps = abs(piece.color.promotionRank - focus.rank)
        return ChessKit.number(
            id: "u3.promoSteps.\(sample.id)", prompt: "Wie viele Züge braucht der Bauer auf \(focus.name) mindestens bis zur Umwandlung?", answer: steps,
            explanation: "Der Bauer muss von Reihe \(focus.rank + 1) bis Reihe \(piece.color.promotionRank + 1): \(steps) \(steps == 1 ? "Schritt" : "Schritte"), der letzte ist die Umwandlung.",
            media: ChessKit.board(position, marked: [focus.name])
        )
    }
}
