import Foundation

/// Makes one exercise from the state of the node being built. A maker returns nil when the material cannot make a
/// sound exercise; the builder then tries the next entry of the plan.
typealias ChessMaker = (inout ChessDraw) -> LearnExercise?

/// The random numbers of one node and what it has used so far, so a lesson never shows the same position twice for
/// the same kind of question.
struct ChessDraw {
    var random: LearnRandom
    private var used: Set<String> = []

    init(seed: UInt64) {
        random = LearnRandom(seed: seed)
    }

    /// A random element that was not drawn before under this key. When every element was drawn, any element: the
    /// builder then drops the repeated exercise id and asks the next plan entry.
    mutating func pick<T>(_ items: [T], key: String, id: (T) -> String) -> T? {
        let fresh = items.filter { !used.contains(key + "|" + id($0)) }
        guard let item = (fresh.isEmpty ? items : fresh).randomElement(using: &random) else { return nil }
        used.insert(key + "|" + id(item))
        return item
    }

    mutating func pick(_ pool: [ChessSample], key: String) -> ChessSample? {
        pick(pool, key: key, id: \.id)
    }

    mutating func pickSquare(key: String) -> ChessSquare? {
        pick(ChessSquare.all, key: key, id: \.name)
    }

    mutating func coin() -> Bool {
        Bool.random(using: &random)
    }
}

/// A sentence for a word bank: the words in order and plausible wrong tiles.
struct ChessSentence {
    let key: String
    let words: [String]
    let extra: [String]
}

/// A question with a fixed right answer and fixed wrong ones, for rules that no position can show.
struct ChessStatement {
    let key: String
    let prompt: String
    let correct: String
    let wrong: [String]
    let explanation: String
}

/// Where a piece could go on an empty board; independent of the move generator, so the tests can compare the two.
enum ChessGeometry {
    static func canReach(_ kind: ChessPieceKind, from: ChessSquare, to: ChessSquare) -> Bool {
        guard from != to else { return false }
        let files = abs(to.file - from.file)
        let ranks = abs(to.rank - from.rank)
        switch kind {
        case .rook: return files == 0 || ranks == 0
        case .bishop: return files == ranks
        case .queen: return files == 0 || ranks == 0 || files == ranks
        case .king: return max(files, ranks) == 1
        case .knight: return (files == 1 && ranks == 2) || (files == 2 && ranks == 1)
        case .pawn: return false
        }
    }

    /// The squares a piece reaches from a square on an empty board.
    static func reach(_ kind: ChessPieceKind, from: ChessSquare) -> [ChessSquare] {
        ChessSquare.all.filter { canReach(kind, from: from, to: $0) }
    }
}

enum ChessKit {
    static let emptyFEN = "8/8/8/8/8/8/8/8 w - - 0 1"

    // MARK: Boards

    static func board(_ position: ChessPosition, marked: [String] = []) -> ExerciseMedia {
        .board(BoardSpec(fen: position.fen, flipped: position.sideToMove == .black, marked: marked))
    }

    static func boardSpec(_ position: ChessPosition, marked: [String] = []) -> BoardSpec {
        BoardSpec(fen: position.fen, flipped: position.sideToMove == .black, marked: marked)
    }

    static func emptyBoard(marked: [String] = []) -> ExerciseMedia {
        .board(BoardSpec(fen: emptyFEN, marked: marked))
    }

    // MARK: Words

    /// "den Springer", "die Dame", "den Bauern".
    static func accusative(_ kind: ChessPieceKind) -> String {
        "\(kind.article(.accusative)) \(kind.noun(.accusative))"
    }

    /// "der Springer", "die Dame".
    static func nominative(_ kind: ChessPieceKind) -> String {
        "\(kind.article(.nominative)) \(kind.noun(.nominative))"
    }

    /// "dem Springer", "der Dame".
    static func dative(_ kind: ChessPieceKind) -> String {
        "\(kind.article(.dative)) \(kind.noun(.dative))"
    }

    /// "einen Springer", "eine Dame", "einen Bauern".
    static func indefiniteAccusative(_ kind: ChessPieceKind) -> String {
        kind.isFeminine ? "eine \(kind.germanName)" : "einen \(kind.noun(.accusative))"
    }

    /// "ein Springer", "eine Dame".
    static func indefinite(_ kind: ChessPieceKind) -> String {
        "\(kind.isFeminine ? "eine" : "ein") \(kind.germanName)"
    }

    /// A list in German: "a4", "a4 und g4", "a4, b5 und g4".
    static func list(_ items: [String]) -> String {
        switch items.count {
        case 0: return ""
        case 1: return items[0]
        default: return items.dropLast().joined(separator: ", ") + " und " + items[items.count - 1]
        }
    }

    /// The rule sentence of a piece, for the feedback.
    static func rule(of kind: ChessPieceKind) -> String {
        switch kind {
        case .rook: return "Der Turm zieht gerade, so weit er will."
        case .bishop: return "Der Läufer zieht schräg, so weit er will."
        case .queen: return "Die Dame zieht wie Turm und Läufer zusammen."
        case .king: return "Der König zieht ein Feld in jede Richtung."
        case .knight: return "Der Springer springt zwei Felder in eine Richtung und eins quer dazu."
        case .pawn: return "Der Bauer zieht ein Feld vorwärts und schlägt schräg vorwärts."
        }
    }

    // MARK: Squares

    /// Whether more pieces than the direct attackers aim at a square, hidden behind them on the same line.
    static func hasHiddenAttackers(on square: ChessSquare, in position: ChessPosition) -> Bool {
        var cleared = position
        for color in ChessColor.allCases {
            for attacker in position.attackers(of: square, by: color) { cleared = cleared.setting(nil, at: attacker) }
        }
        return ChessColor.allCases.contains { !cleared.attackers(of: square, by: $0).isEmpty }
    }

    /// Wrong square names a student could pick by mixing up the direction of counting, most likely mistakes first.
    static func squareDistractors(for square: ChessSquare, random: inout LearnRandom) -> [String] {
        var ordered: [ChessSquare?] = [
            ChessSquare(file: 7 - square.file, rank: square.rank),
            ChessSquare(file: square.file, rank: 7 - square.rank),
            ChessSquare(file: square.rank, rank: square.file),
            ChessSquare(file: 7 - square.file, rank: 7 - square.rank),
        ]
        var near: [ChessSquare?] = [
            square.offset(file: 1, rank: 0), square.offset(file: -1, rank: 0),
            square.offset(file: 0, rank: 1), square.offset(file: 0, rank: -1),
        ]
        near.shuffle(using: &random)
        ordered += near
        var seen: Set<ChessSquare> = [square]
        var result: [String] = []
        for candidate in ordered {
            if let candidate, seen.insert(candidate).inserted { result.append(candidate.name) }
        }
        return result
    }

    /// Wrong whole numbers around the right one: the likely mistakes first, then neighbours.
    static func numberWrongs(correct: Int, likely: [Int] = [], random: inout LearnRandom, minimum: Int = 0) -> [String] {
        var seen: Set<Int> = [correct]
        var result: [Int] = []
        func add(_ number: Int) {
            if number >= minimum, seen.insert(number).inserted { result.append(number) }
        }
        likely.forEach(add)
        var near = [correct + 1, correct - 1, correct + 2, correct - 2, correct + 3, correct - 3, correct + 4]
        near.shuffle(using: &random)
        near.forEach(add)
        return result.map(String.init)
    }

    /// The squares a piece can move to from a square (a pawn that promotes counts its square once).
    static func destinations(of square: ChessSquare, in position: ChessPosition) -> [ChessSquare] {
        var seen = Set<ChessSquare>()
        return position.legalMoves().filter { $0.from == square }.map(\.to).filter { seen.insert($0).inserted }
    }

    // MARK: Exercises

    /// The solution as the feedback shows it: "Sf3 (g1–f3)", up to three accepted moves joined with "oder".
    static func solution(_ moves: [ChessMove], in position: ChessPosition, withSquares: Bool, limit: Int = 3) -> String {
        let texts = moves.compactMap { move -> String? in
            guard let san = ChessNotation.san(move, in: position) else { return nil }
            return withSquares ? "\(san) (\(move.from.name)–\(move.to.name))" : san
        }
        var shown = Array(texts.prefix(limit))
        if texts.count > limit { shown.append("…") }
        return shown.joined(separator: " oder ")
    }

    /// A "find the move" exercise whose accepted moves the engine computes from the goal.
    static func moveExercise(
        id: String, prompt: String, position: ChessPosition, goal: ChessGoal, marked: [String] = [],
        explanation: String, withSquares: Bool = true
    ) -> LearnExercise? {
        let moves = ChessGoals.accepted(goal, in: position)
        guard !moves.isEmpty, let answers = ChessGoals.answers(for: moves) else { return nil }
        return Exercises.move(
            id: id, prompt: prompt, board: boardSpec(position, marked: marked), accepted: answers,
            solution: solution(moves, in: position, withSquares: withSquares), explanation: explanation
        )
    }

    static func choice(
        id: String, prompt: String, correct: String, wrong: [String], explanation: String = "",
        media: ExerciseMedia? = nil, solution: String? = nil, draw: inout ChessDraw
    ) -> LearnExercise? {
        Exercises.choice(
            id: id, prompt: prompt, correct: correct, wrong: wrong, solution: solution, explanation: explanation,
            media: media, using: &draw.random
        )
    }

    /// Ja or Nein.
    static func yesNo(
        id: String, prompt: String, answer: Bool, explanation: String, media: ExerciseMedia? = nil, draw: inout ChessDraw
    ) -> LearnExercise? {
        choice(
            id: id, prompt: prompt, correct: answer ? "Ja" : "Nein", wrong: [answer ? "Nein" : "Ja"],
            explanation: explanation, media: media, draw: &draw
        )
    }

    /// A whole number to type.
    static func number(
        id: String, prompt: String, answer: Int, explanation: String, media: ExerciseMedia? = nil
    ) -> LearnExercise? {
        Exercises.typed(id: id, prompt: prompt, answer: String(answer), mode: .number, explanation: explanation, media: media)
    }

    /// A square name to type; capitals and spaces do not matter, a different square does.
    static func typedSquare(id: String, prompt: String, answer: String, explanation: String, media: ExerciseMedia? = nil) -> LearnExercise? {
        Exercises.typed(id: id, prompt: prompt, answer: answer, mode: .exact, explanation: explanation, media: media)
    }

    static func bank(id: String, sentence: ChessSentence, prompt: String = "Setze den Satz zusammen.", draw: inout ChessDraw) -> LearnExercise? {
        Exercises.bank(id: id, prompt: prompt, words: sentence.words, extra: sentence.extra, using: &draw.random)
    }

    /// A word bank from a pool of sentences.
    static func sentenceMaker(_ topic: String, _ sentences: [ChessSentence]) -> ChessMaker {
        { draw in
            guard let sentence = draw.pick(sentences, key: topic, id: \.key) else { return nil }
            return bank(id: "\(topic).\(sentence.key)", sentence: sentence, draw: &draw)
        }
    }

    /// A choice from a pool of fixed statements.
    static func statementMaker(_ topic: String, _ statements: [ChessStatement]) -> ChessMaker {
        { draw in
            guard let statement = draw.pick(statements, key: topic, id: \.key) else { return nil }
            return choice(
                id: "\(topic).\(statement.key)", prompt: statement.prompt, correct: statement.correct, wrong: statement.wrong,
                explanation: statement.explanation, draw: &draw
            )
        }
    }

    /// Four pairs out of the candidates, which are (key, front, back) and may be more than four.
    static func pairs(
        id: String, prompt: String, from candidates: [(key: String, front: String, back: String)], draw: inout ChessDraw
    ) -> LearnExercise? {
        let items = Array(candidates.shuffled(using: &draw.random).prefix(ExerciseBuilder.pairCount))
        return Exercises.pairs(id: id, prompt: prompt, items: items, using: &draw.random)
    }

    /// The answer forms of a typed move in notation: with and without the sign and the capture mark, so "Dxf7#",
    /// "Dxf7" and "Dxf7+" all count. Capitals do not matter to the checker.
    static func typedVariants(of san: String) -> [String] {
        let bare = san.filter { $0 != "+" && $0 != "#" }
        var forms = [san, bare, bare + "+", bare + "#"]
        if bare.contains("x") { forms.append(bare.replacingOccurrences(of: "x", with: "")) }
        var seen = Set<String>()
        return forms.filter { seen.insert($0).inserted }
    }

    /// The notation without the check sign, so a prompt can name a move without giving away that it mates.
    static func sanWithoutSign(_ san: String) -> String {
        san.filter { $0 != "+" && $0 != "#" }
    }
}
