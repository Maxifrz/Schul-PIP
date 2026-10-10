import Foundation

/// Unit 8, "Taktik-Grundlagen": hanging pieces, forks, pins, skewers and discovered attacks. The accepted moves are
/// the ones the material search proves best, never an author's guess.
enum ChessUnit8 {
    /// How deep the search looks, in half moves: the move, the answer and the follow-up capture.
    static let depth = 3

    static let motifNames = ["fork": "Gabel", "pin": "Fesselung", "skewer": "Spieß", "discovered": "Abzugsangriff", "hang": "Hängende Figur"]

    static var pools: [String: [ChessSample]] {
        [
            "fork": ChessSamples.forks, "pin": ChessSamples.pins, "skewer": ChessSamples.skewers,
            "discovered": ChessSamples.discovered, "hang": ChessSamples.hanging,
        ]
    }

    static let makers: [String: ChessMaker] = {
        var table: [String: ChessMaker] = [
            "u8.terms": terms,
            "u8.fork.after": forkAfter,
            "u8.pin.which": pinWhich,
            "u8.hang.which": hangWhich,
            "u8.sentence.fork": ChessKit.sentenceMaker("u8.sentence.fork", forkSentences),
            "u8.sentence.line": ChessKit.sentenceMaker("u8.sentence.line", lineSentences),
            "u8.motif": motif,
        ]
        for theme in ["fork", "pin", "skewer", "discovered", "hang"] {
            table["u8.\(theme).find"] = find("u8.\(theme).find", themes: [theme], hint: true)
            table["u8.\(theme).choose"] = choose("u8.\(theme).choose", themes: [theme])
        }
        table["u8.mixed.find"] = find("u8.mixed.find", themes: ["fork", "pin", "skewer", "discovered", "hang"], hint: false)
        table["u8.mixed.choose"] = choose("u8.mixed.choose", themes: ["fork", "pin", "skewer", "discovered", "hang"])
        return table
    }()

    static let review = ["u8.mixed.find", "u8.mixed.choose", "u8.motif", "u8.hang.which", "u8.pin.which"]

    static let forkSentences = [
        ChessSentence(key: "fork", words: ["Eine", "Gabel", "greift", "zwei", "Figuren", "gleichzeitig", "an."], extra: ["drei", "Turm"]),
        ChessSentence(key: "hang", words: ["Eine", "hängende", "Figur", "ist", "angegriffen", "und", "ungedeckt."], extra: ["gefesselt", "gedeckt."]),
    ]

    static let lineSentences = [
        ChessSentence(key: "pin", words: ["Eine", "am", "König", "gefesselte", "Figur", "darf", "ihre", "Linie", "nicht", "verlassen."], extra: ["immer", "Dame"]),
        ChessSentence(key: "skewer", words: ["Beim", "Spieß", "muss", "die", "vordere", "Figur", "ausweichen."], extra: ["hintere", "Bauer"]),
        ChessSentence(key: "discovered", words: ["Beim", "Abzugsangriff", "gibt", "die", "ziehende", "Figur", "eine", "Linie", "frei."], extra: ["gesperrte", "Dame"]),
    ]

    static func terms(_ draw: inout ChessDraw) -> LearnExercise? {
        ChessKit.pairs(
            id: "u8.terms", prompt: "Ordne die Begriffe zu.",
            from: [
                (key: "u8.term.fork", front: "Gabel", back: "greift zwei Figuren zugleich an"),
                (key: "u8.term.pin", front: "Fesselung", back: "Figur kann nicht ziehen, dahinter steht Wertvolleres"),
                (key: "u8.term.skewer", front: "Spieß", back: "vordere Figur weicht, hintere fällt"),
                (key: "u8.term.discovered", front: "Abzugsangriff", back: "Figur zieht weg und gibt eine Linie frei"),
            ],
            draw: &draw
        )
    }

    private static func goal(for theme: String) -> ChessGoal {
        theme == "hang" ? .bestCapture : .bestMove(depth: depth)
    }

    private static func nameList(_ squares: [ChessSquare], in position: ChessPosition) -> String {
        ChessKit.list(squares.map { square in
            let piece = position[square]?.kind.germanName ?? "Figur"
            return "\(piece) auf \(square.name)"
        })
    }

    /// The sentence that says what the best move does, built from what the board shows after it.
    static func explanation(theme: String, sample: ChessSample, position: ChessPosition, move: ChessMove) -> String {
        let san = ChessNotation.san(move, in: position) ?? move.uci
        let after = position.applying(move)
        let mover = position.sideToMove
        switch theme {
        case "fork":
            let targets = ChessTactics.forkTargets(of: move.to, in: after)
            let piece = after[move.to]?.kind ?? .pawn
            return "Nach \(san) greift \(ChessKit.nominative(piece)) auf \(move.to.name) gleichzeitig an: \(nameList(targets, in: after)). Der Gegner kann nur eine Figur retten. Das ist eine Gabel."
        case "pin":
            let pinned = ChessTactics.absolutePins(of: mover.opposite, in: position).map(\.pinned).filter { after.attackedEnemies(by: move.to).contains($0) }
            return "\(san) greift die gefesselte Figur an: \(nameList(pinned, in: position)). Sie darf ihre Linie nicht verlassen, weil dahinter der König steht, und kann sich deshalb nicht retten."
        case "skewer":
            let line = ChessTactics.lineUps(by: mover, in: after).first { $0.attacker == move.to && ChessTactics.isSkewer($0, in: after) }
            if let line {
                return "\(san) greift \(nameList([line.front], in: after)) an. Sie muss ausweichen, und dahinter steht auf derselben Linie \(nameList([line.back], in: after)). Das ist ein Spieß."
            }
            return "\(san) greift eine wertvolle Figur an, hinter der auf derselben Linie eine weitere steht. Das ist ein Spieß."
        case "discovered":
            let king = after.kingSquare(of: mover.opposite)
            let checkers = king.map { after.attackers(of: $0, by: mover) } ?? []
            let captured = position.capturedPiece(by: move)
            let loss = captured.map { " und \(ChessKit.nominative($0.kind)) ist nicht mehr zu retten" } ?? ""
            let who = checkers.first.map { "durch die Figur auf \($0.name)" } ?? ""
            return "Die ziehende Figur macht eine Linie frei: Es entsteht Schach \(who). Der Gegner muss das Schach aufheben\(loss). Das ist ein Abzugsangriff."
        default:
            let target = sample.focusSquare ?? move.to
            return "Die Figur auf \(target.name) war angegriffen, und nichts deckt sie. Du schlägst sie, ohne etwas zu verlieren."
        }
    }

    static func find(_ topic: String, themes: [String], hint: Bool) -> ChessMaker {
        { draw in
            let pool = themes.flatMap { theme in (pools[theme] ?? []).map { (theme: theme, sample: $0) } }
            guard let item = draw.pick(pool, key: topic, id: { $0.sample.id }), let position = item.sample.position else { return nil }
            let goal = goal(for: item.theme)
            guard let move = ChessGoals.accepted(goal, in: position).first else { return nil }
            var prompt = item.theme == "hang" ? "Schlage so, dass du am meisten gewinnst." : "Finde den Zug, der am meisten Material gewinnt."
            if hint {
                prompt += item.theme == "hang" ? " Eine Figur hängt." : " Tipp: \(motifNames[item.theme] ?? "")."
            }
            return ChessKit.moveExercise(
                id: "\(topic).\(item.sample.id)", prompt: prompt, position: position, goal: goal,
                explanation: explanation(theme: item.theme, sample: item.sample, position: position, move: move), withSquares: false
            )
        }
    }

    /// Four moves to choose from: the best one and three that are proven worse.
    static func choose(_ topic: String, themes: [String]) -> ChessMaker {
        { draw in
            let pool = themes.flatMap { theme in (pools[theme] ?? []).map { (theme: theme, sample: $0) } }
            guard let item = draw.pick(pool, key: topic, id: { $0.sample.id }), let position = item.sample.position else { return nil }
            let best = ChessGoals.accepted(goal(for: item.theme), in: position)
            guard let right = best.first, let rightText = ChessNotation.san(right, in: position) else { return nil }
            // Wrong moves: the best move's own piece first, then checks and captures, then the rest.
            let mover = position[right.from]?.kind
            let others = position.legalMoves().filter { !best.contains($0) }.shuffled(using: &draw.random)
            let sameKind = others.filter { position[$0.from]?.kind == mover }
            let loud = others.filter { position.givesCheck($0) || position.isCapture($0) }
            var wrong: [String] = []
            for move in sameKind + loud + others where wrong.count < 3 {
                guard let text = ChessNotation.san(move, in: position) else { continue }
                let plain = ChessKit.sanWithoutSign(text)
                if plain != ChessKit.sanWithoutSign(rightText), !wrong.contains(plain) { wrong.append(plain) }
            }
            return ChessKit.choice(
                id: "\(topic).\(item.sample.id)", prompt: "Welcher Zug gewinnt hier am meisten Material?", correct: ChessKit.sanWithoutSign(rightText), wrong: wrong,
                explanation: explanation(theme: item.theme, sample: item.sample, position: position, move: right), media: ChessKit.board(position), draw: &draw
            )
        }
    }

    /// "Welche zwei Figuren greift die Gabel an?"
    static func forkAfter(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.forks.filter { sample in
            guard let position = sample.position, let move = ChessGoals.accepted(.bestMove(depth: depth), in: position).first else { return false }
            return position.applying(move).attackedEnemies(by: move.to).count == 2
        }
        guard let sample = draw.pick(pool, key: "u8.fork.after"), let position = sample.position,
              let move = ChessGoals.accepted(.bestMove(depth: depth), in: position).first, let san = ChessNotation.san(move, in: position) else { return nil }
        let after = position.applying(move)
        func pairText(_ kinds: [ChessPieceKind]) -> String {
            kinds.sorted(by: >).map(\.germanName).joined(separator: " und ")
        }
        let actual = after.attackedEnemies(by: move.to).compactMap { after[$0]?.kind }
        let right = pairText(actual)
        let present = Array(Set(after.squares(of: position.sideToMove.opposite).compactMap { after[$0]?.kind }))
        let all = ChessPieceKind.allCases
        var wrong: [String] = []
        for pool in [present, all] {
            for first in pool.shuffled(using: &draw.random) {
                for second in pool.shuffled(using: &draw.random) where first.rawValue < second.rawValue {
                    let text = pairText([first, second])
                    if text != right, !wrong.contains(text), wrong.count < 3 { wrong.append(text) }
                }
            }
        }
        return ChessKit.choice(
            id: "u8.fork.after.\(sample.id)", prompt: "\(position.sideToMove.germanName) spielt \(ChessKit.sanWithoutSign(san)). Welche zwei Figuren greift die gezogene Figur dann an?",
            correct: right, wrong: wrong, explanation: explanation(theme: "fork", sample: sample, position: position, move: move),
            media: ChessKit.board(position), draw: &draw
        )
    }

    /// "Welche schwarze Figur ist gefesselt?"
    static func pinWhich(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.pins.filter { sample in
            guard let position = sample.position else { return false }
            return ChessTactics.absolutePins(of: position.sideToMove.opposite, in: position).count == 1
        }
        guard let sample = draw.pick(pool, key: "u8.pin.which"), let position = sample.position else { return nil }
        let color = position.sideToMove.opposite
        guard let pin = ChessTactics.absolutePins(of: color, in: position).first, let king = position.kingSquare(of: color) else { return nil }
        let wrong = position.squares(of: color).filter { $0 != pin.pinned && $0 != king }.shuffled(using: &draw.random).map(\.name)
        return ChessKit.choice(
            id: "u8.pin.which.\(sample.id)", prompt: "Welche \(color.adjectiveStem)e Figur ist gefesselt?", correct: pin.pinned.name, wrong: wrong,
            explanation: "Die Figur auf \(pin.pinned.name) steht zwischen der Figur auf \(pin.pinner.name) und dem König auf \(king.name). Sie darf ihre Linie nicht verlassen.",
            media: ChessKit.board(position), draw: &draw
        )
    }

    /// "Welche schwarze Figur hängt?"
    static func hangWhich(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = ChessSamples.hanging.filter { sample in
            guard let position = sample.position else { return false }
            return ChessTactics.hangingPieces(of: position.sideToMove.opposite, in: position).count == 1
        }
        guard let sample = draw.pick(pool, key: "u8.hang.which"), let position = sample.position else { return nil }
        let color = position.sideToMove.opposite
        guard let hanging = ChessTactics.hangingPieces(of: color, in: position).first, let king = position.kingSquare(of: color) else { return nil }
        let wrong = position.squares(of: color).filter { $0 != hanging && $0 != king }.shuffled(using: &draw.random).map(\.name)
        return ChessKit.choice(
            id: "u8.hang.which.\(sample.id)", prompt: "Welche \(color.adjectiveStem)e Figur hängt?", correct: hanging.name, wrong: wrong,
            explanation: "Die Figur auf \(hanging.name) ist angegriffen und nicht gedeckt: Du kannst sie ohne Verlust schlagen.",
            media: ChessKit.board(position), draw: &draw
        )
    }

    /// "Welches Motiv steckt in diesem Zug?"
    static func motif(_ draw: inout ChessDraw) -> LearnExercise? {
        let pool = pools.flatMap { theme, samples in samples.map { (theme: theme, sample: $0) } }.sorted { $0.sample.id < $1.sample.id }
        guard let item = draw.pick(pool, key: "u8.motif", id: { $0.sample.id }), let position = item.sample.position,
              let move = ChessGoals.accepted(goal(for: item.theme), in: position).first, let san = ChessNotation.san(move, in: position),
              let right = motifNames[item.theme] else { return nil }
        let wrong = motifNames.filter { $0.key != item.theme && $0.key != "hang" }.map(\.value).sorted()
        return ChessKit.choice(
            id: "u8.motif.\(item.sample.id)", prompt: "\(position.sideToMove.germanName) spielt \(san). Welches Motiv steckt darin?", correct: right,
            wrong: item.theme == "hang" ? wrong : wrong.filter { $0 != right } + ["Hängende Figur"], explanation: explanation(theme: item.theme, sample: item.sample, position: position, move: move),
            media: ChessKit.board(position), draw: &draw
        )
    }
}
