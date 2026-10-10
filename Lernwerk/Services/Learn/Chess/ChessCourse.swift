import Foundation

/// "Schach": eight units from the board to tactics. Every position is a FEN written by hand, and every accepted move
/// is computed from it by the engine at run time, so the course cannot teach a wrong answer.
enum ChessCourse {
    static let provider: any CourseProvider = ChessProvider()
}

struct ChessProvider: CourseProvider {
    static let courseID = "chess"

    let course: Course

    init() {
        func unit(_ number: Int, _ title: String, _ summary: String, _ tip: String) -> CourseUnit {
            CourseUnit.standard(courseID: ChessProvider.courseID, number: number, title: title, summary: summary, tip: tip)
        }
        let units = ChessUnitTexts.all.enumerated().map { index, text in
            unit(index + 1, text.title, text.summary, text.tip)
        }
        course = Course(
            id: ChessProvider.courseID, title: "Schach", subtitle: "Vom ersten Zug bis zum Matt", kind: .chess, color: 0xD17A9E, symbol: "crown.fill",
            sections: [
                CourseSection(id: "chess.s1", title: "Brett und Figuren", units: Array(units[0..<3])),
                CourseSection(id: "chess.s2", title: "Schach, Matt und Sonderzüge", units: Array(units[3..<5])),
                CourseSection(id: "chess.s3", title: "Material und Taktik", units: Array(units[5..<8])),
            ]
        )
    }

    func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
        guard node.kind != .chest, let plan = ChessPlans.plan(for: node) else { return [] }
        var draw = ChessDraw(seed: Exercises.seed(for: node, base: seed))
        return ChessPlans.build(plan: plan, unit: node.unitNumber, draw: &draw)
    }
}

/// What each lesson, practice round and checkpoint asks, as lists of topic keys. A topic is a maker in one of the unit
/// files; "review" stands for a topic of an earlier unit.
enum ChessPlans {
    static let lessonSize = 10
    static let practiceSize = 12
    static let checkpointSize = 14

    static let review = "review"

    static let table: [String: ChessMaker] = {
        var table: [String: ChessMaker] = [:]
        for makers in [ChessUnit1.makers, ChessUnit2.makers, ChessUnit3.makers, ChessUnit4.makers, ChessUnit5.makers, ChessUnit6.makers, ChessUnit7.makers, ChessUnit8.makers] {
            table.merge(makers) { first, _ in first }
        }
        return table
    }()

    /// The topics worth meeting again, per unit (index 0 is unit 1).
    static let reviewKeys: [[String]] = [
        ChessUnit1.review, ChessUnit2.review, ChessUnit3.review, ChessUnit4.review, ChessUnit5.review, ChessUnit6.review, ChessUnit7.review, ChessUnit8.review,
    ]

    struct UnitPlan {
        let lessons: [[String]]
        let practice: [String]
        let checkpoint: [String]
    }

    static let units: [UnitPlan] = [
        UnitPlan(
            lessons: [
                ["u1.nameSquare", "u1.nameSquare", "u1.nameSquare", "u1.markedFile", "u1.markedFile", "u1.markedRank", "u1.markedRank", "u1.terms", "u1.sentence.names", "u1.typeName"],
                ["u1.colorOfSquare", "u1.colorOfSquare", "u1.colorOfSquare", "u1.cornerColor", "u1.factChoice", "u1.factChoice", "u1.corners", "u1.sentence.colors", "u1.factNumber", "u1.nameSquare"],
                ["u1.sameDiagonal", "u1.sameDiagonal", "u1.nameSquare", "u1.tapMove", "u1.tapMove", "u1.tapMove", "u1.typeName", "u1.typeName", "u1.typeCorner", "u1.factNumber"],
            ],
            practice: ["u1.nameSquare", "u1.nameSquare", "u1.markedFile", "u1.markedRank", "u1.colorOfSquare", "u1.colorOfSquare", "u1.sameDiagonal", "u1.terms", "u1.tapMove", "u1.tapMove", "u1.typeName", "u1.factNumber"],
            checkpoint: ["u1.nameSquare", "u1.nameSquare", "u1.markedFile", "u1.markedRank", "u1.colorOfSquare", "u1.cornerColor", "u1.factChoice", "u1.sameDiagonal", "u1.terms", "u1.corners", "u1.tapMove", "u1.tapMove", "u1.typeName", "u1.typeCorner"]
        ),
        UnitPlan(
            lessons: [
                ["u2.identify", "u2.startCountChoice", "u2.startSquare", "u2.queenColor", "u2.letters", "u2.sentence.slide", "u2.moveTo.slider", "u2.moveTo.slider", "u2.count.slider", "u2.countNumber.slider"],
                ["u2.movePairs", "u2.sentence.step", "u2.count.step", "u2.count.step", "u2.reach.step", "u2.reach.step", "u2.moveTo.step", "u2.moveTo.step", "u2.countNumber.step", "u2.whichPiece"],
                ["u2.count.all", "u2.reach.all", "u2.whichPiece", "u2.whichPiece", "u2.captureMove", "u2.captureMove", "u2.moveTo.all", "u2.attackCount", "u2.attackCount", "u2.countNumber.all"],
            ],
            practice: ["u2.identify", "u2.startSquare", "u2.letters", "u2.count.all", "u2.reach.all", "u2.whichPiece", "u2.captureMove", "u2.moveTo.all", "u2.attackCount", "u2.countNumber.all", "review", "review"],
            checkpoint: ["u2.identify", "u2.startSquare", "u2.queenColor", "u2.letters", "u2.movePairs", "u2.count.all", "u2.reach.all", "u2.whichPiece", "u2.captureMove", "u2.moveTo.all", "u2.moveTo.all", "u2.countNumber.all", "u2.attackCount", "u2.startCountNumber"]
        ),
        UnitPlan(
            lessons: [
                ["u3.direction", "u3.doubleStep", "u3.doubleStep", "u3.stepCount.simple", "u3.stepCount.simple", "u3.pairs", "u3.sentence.move", "u3.moveOne", "u3.moveTwo", "u3.moveTwo"],
                ["u3.captureDir", "u3.attackedSquare", "u3.attackedSquare", "u3.stepCount.all", "u3.stepCount.all", "u3.capture", "u3.capture", "u3.capture", "u3.sentence.move", "u3.moveOne"],
                ["u3.epYesNo", "u3.epYesNo", "u3.promoWhich", "u3.promoRank", "u3.promoSteps", "u3.sentence.special", "u3.epMove", "u3.epMove", "u3.promoMove", "u3.promoMove"],
            ],
            practice: ["u3.direction", "u3.doubleStep", "u3.stepCount.all", "u3.attackedSquare", "u3.epYesNo", "u3.promoSteps", "u3.moveTwo", "u3.capture", "u3.epMove", "u3.promoMove", "review", "review"],
            checkpoint: ["u3.direction", "u3.doubleStep", "u3.stepCount.all", "u3.attackedSquare", "u3.captureDir", "u3.epYesNo", "u3.promoWhich", "u3.promoRank", "u3.pairs", "u3.moveTwo", "u3.capture", "u3.epMove", "u3.promoMove", "u3.promoSteps"]
        ),
        UnitPlan(
            lessons: [
                ["u4.isCheck", "u4.isCheck", "u4.isCheck", "u4.whichChecks", "u4.whichChecks", "u4.terms", "u4.sentence.check", "u4.giveCheck", "u4.giveCheck", "u4.giveCheck"],
                ["u4.escape.which", "u4.escape.which", "u4.sentence.check", "u4.escape.any", "u4.escape.any", "u4.escape.capture", "u4.escape.capture", "u4.escape.block", "u4.escape.block", "u4.escape.king"],
                ["u4.state", "u4.state", "u4.state", "u4.dead", "u4.dead", "u4.mateOrStale", "u4.mateOrStale", "u4.sentence.end", "u4.mateMove", "u4.mateMove"],
            ],
            practice: ["u4.isCheck", "u4.whichChecks", "u4.escape.which", "u4.state", "u4.state", "u4.dead", "u4.mateOrStale", "u4.terms", "u4.escape.any", "u4.mateMove", "review", "review"],
            checkpoint: ["u4.isCheck", "u4.isCheck", "u4.whichChecks", "u4.escape.which", "u4.state", "u4.state", "u4.dead", "u4.mateOrStale", "u4.terms", "u4.sentence.end", "u4.escape.any", "u4.escape.capture", "u4.escape.block", "u4.mateMove"]
        ),
        UnitPlan(
            lessons: [
                ["u5.castleSquares", "u5.castleSquares", "u5.castleSquares", "u5.castlePairs", "u5.sentence.castle", "u5.castleMove", "u5.castleMove", "u5.castleMove", "u5.castleCan", "u5.castleCan"],
                ["u5.castleCan", "u5.castleCan", "u5.castleCan", "u5.castleReason", "u5.castleReason", "u5.castleReason", "u5.castleRules", "u5.castleRules", "u5.castleMove", "u5.castleMove"],
                ["u5.classify", "u5.classify", "u5.epYesNo", "u5.epYesNo", "u5.epRules", "u5.promoRules", "u5.promoPiece", "u3.epMove", "u3.promoMove", "u5.promoCheck"],
            ],
            practice: ["u5.castleCan", "u5.castleReason", "u5.castleSquares", "u5.classify", "u5.epYesNo", "u5.promoRules", "u5.castleMove", "u3.epMove", "u5.promoCheck", "u5.castleRules", "review", "review"],
            checkpoint: ["u5.castleSquares", "u5.castleCan", "u5.castleCan", "u5.castleReason", "u5.castleRules", "u5.classify", "u5.classify", "u5.epYesNo", "u5.epRules", "u5.promoRules", "u5.castlePairs", "u5.castleMove", "u3.epMove", "u5.promoCheck"]
        ),
        UnitPlan(
            lessons: [
                ["u6.valueChoice", "u6.valueChoice", "u6.valueSum", "u6.valueSum", "u6.materialWho", "u6.valuePairs", "u6.sentence.values", "u6.valueNumber", "u6.valueNumber", "u6.materialCount"],
                ["u6.tradeKinds", "u6.tradeKinds", "u6.tradeJudge", "u6.tradeJudge", "u6.tradeJudge", "u6.materialWho", "u6.captureBest", "u6.captureBest", "u6.captureBest", "u6.materialCount"],
                ["u6.contestJudge", "u6.contestJudge", "u6.tradeJudge", "u6.contestBest", "u6.contestBest", "u6.contestBest", "u6.captureBest", "u6.contestCount", "u6.contestCount", "u6.contestCount"],
            ],
            practice: ["u6.valueChoice", "u6.valueSum", "u6.materialWho", "u6.tradeKinds", "u6.tradeJudge", "u6.contestJudge", "u6.captureBest", "u6.contestBest", "u6.materialCount", "u6.contestCount", "review", "review"],
            checkpoint: ["u6.valueChoice", "u6.valueSum", "u6.materialWho", "u6.valuePairs", "u6.tradeKinds", "u6.tradeJudge", "u6.tradeJudge", "u6.contestJudge", "u6.captureBest", "u6.captureBest", "u6.contestBest", "u6.materialCount", "u6.contestCount", "u6.valueNumber"]
        ),
        UnitPlan(
            lessons: [
                ["u7.pattern.a", "u7.pattern.a", "u7.choose.a", "u7.choose.a", "u7.isMate.a", "u7.sentence.back", "u7.find.a", "u7.find.a", "u7.find.a", "u7.count.a"],
                ["u7.pattern.b", "u7.pattern.b", "u7.choose.b", "u7.isMate.b", "u7.pairs", "u7.find.b", "u7.find.b", "u7.find.b", "u7.count.b", "u7.write.b"],
                ["u7.choose.c", "u7.choose.c", "u7.isMate.c", "u7.isMate.c", "u7.sentence.rule", "u7.find.c", "u7.find.c", "u7.find.c", "u7.count.c", "u7.write.c"],
            ],
            practice: ["u7.pattern.all", "u7.choose.all", "u7.choose.all", "u7.isMate.all", "u7.pairs", "u7.find.all", "u7.find.all", "u7.count.all", "u7.write.all", "review", "review", "review"],
            checkpoint: ["u7.pattern.all", "u7.pattern.all", "u7.choose.all", "u7.choose.all", "u7.isMate.all", "u7.pairs", "u7.find.all", "u7.find.all", "u7.find.all", "u7.find.all", "u7.count.all", "u7.count.all", "u7.write.all", "u7.write.all"]
        ),
        UnitPlan(
            lessons: [
                ["u8.hang.which", "u8.hang.which", "u8.fork.choose", "u8.fork.after", "u8.terms", "u8.sentence.fork", "u8.hang.find", "u8.hang.find", "u8.fork.find", "u8.fork.find"],
                ["u8.pin.which", "u8.pin.which", "u8.pin.choose", "u8.skewer.choose", "u8.sentence.line", "u8.pin.find", "u8.pin.find", "u8.skewer.find", "u8.skewer.find", "u8.skewer.find"],
                ["u8.discovered.choose", "u8.motif", "u8.motif", "u8.motif", "u8.sentence.line", "u8.discovered.find", "u8.discovered.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find"],
            ],
            practice: ["u8.hang.which", "u8.pin.which", "u8.mixed.choose", "u8.mixed.choose", "u8.motif", "u8.terms", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "review", "review"],
            checkpoint: ["u8.hang.which", "u8.pin.which", "u8.fork.after", "u8.mixed.choose", "u8.mixed.choose", "u8.motif", "u8.motif", "u8.terms", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find"]
        ),
    ]

    /// The topic keys a node asks for, in order; nil for a chest or an unknown node.
    static func plan(for node: CourseNode) -> [String]? {
        guard (1...units.count).contains(node.unitNumber) else { return nil }
        let unit = units[node.unitNumber - 1]
        switch node.kind {
        case .lesson: return node.index >= 1 && node.index <= unit.lessons.count ? unit.lessons[node.index - 1] : nil
        case .practice: return unit.practice
        case .checkpoint: return unit.checkpoint
        case .chest: return nil
        }
    }

    /// Runs the plan: each entry makes one exercise; an entry that cannot, or repeats an id, is replaced by the next
    /// one in the cycle. The result is cut to the size of the plan and put from easy to hard.
    static func build(plan: [String], unit: Int, draw: inout ChessDraw) -> [LearnExercise] {
        let target = plan.count
        var made: [LearnExercise] = []
        var ids = Set<String>()
        var index = 0
        var attempts = 0
        while made.count < target, attempts < target * 8 {
            var key = plan[index % plan.count]
            index += 1
            attempts += 1
            if key == review {
                let earlier = reviewKeys.prefix(max(0, unit - 1)).flatMap { $0 }
                guard let picked = earlier.randomElement(using: &draw.random) else { continue }
                key = picked
            }
            guard let exercise = table[key]?(&draw), ids.insert(exercise.id).inserted else { continue }
            made.append(exercise)
        }
        return Exercises.arrange(made, limit: target)
    }
}
