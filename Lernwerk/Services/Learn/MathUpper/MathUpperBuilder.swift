import Foundation

/// Turns a node into its exercises: picks the templates, the levels and the form of each question.
enum MathUpperBuilder {
    static func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
        guard node.kind != .chest, node.unitNumber >= 1, node.unitNumber <= MathUpperCatalog.units.count else { return [] }
        let gen = UGen(seed: Exercises.seed(for: node, base: seed))
        let unitIndex = node.unitNumber - 1
        let unitTemplates = MathUpperCatalog.units[unitIndex]
        let count = node.kind == .checkpoint ? 12 : 10

        var main: [UTemplate]
        var review: [UTemplate] = []
        switch node.kind {
        case .lesson:
            let groups = MathUpperCatalog.lessonGroups[unitIndex]
            main = groups[min(node.index, groups.count) - 1].compactMap(MathUpperCatalog.template)
            if node.index > 1 {
                review = groups[0..<(node.index - 1)].flatMap { $0 }.compactMap(MathUpperCatalog.template)
            }
        case .practice:
            main = unitTemplates
            if unitIndex > 0 { review = MathUpperCatalog.units[0..<unitIndex].flatMap { $0 } }
        default:
            main = unitTemplates
        }
        main = gen.shuffled(main)
        review = gen.shuffled(review)

        let reviewSlots = node.kind == .practice ? 3 : (node.kind == .lesson && node.index > 1 ? 3 : 0)
        let pairTemplate = main.first { $0.pairs != nil } ?? (node.kind == .practice ? review.first { $0.pairs != nil } : nil)
        let pairSlot = (pairTemplate != nil && (node.kind != .lesson || node.index == 1)) ? 2 : -1

        var exercises: [LearnExercise?] = []
        var problems: [UProblem?] = []
        var seenKeys = Set<String>()
        var mainIndex = 0, reviewIndex = 0
        for slot in 0..<count {
            let id = "\(node.id).e\(slot + 1)"
            if slot == pairSlot, let template = pairTemplate, let pairs = template.pairs {
                var made: LearnExercise?
                for _ in 0..<20 where made == nil {
                    if let items = pairs(2, gen), items.count == 4 {
                        made = gen.withRandom { rng in
                            Exercises.pairs(id: id, items: items.enumerated().map { (key: "\(id).\($0.offset)", front: $0.element.front, back: $0.element.back) }, using: &rng)
                        }
                    }
                }
                if let made { exercises.append(made); problems.append(nil); continue }
            }
            let level = levelFor(node: node, slot: slot, count: count)
            let useReview = !review.isEmpty && slot % 3 == 2 && slot / 3 < reviewSlots
            var made: LearnExercise?
            var drawn: UProblem?
            for attempt in 0..<60 where made == nil {
                let template: UTemplate
                if useReview && attempt < 30 {
                    template = review[(reviewIndex + attempt) % review.count]
                } else {
                    template = main[(mainIndex + attempt) % main.count]
                }
                let drawLevel = max(1, min(3, level - (attempt > 40 ? 1 : 0)))
                guard let problem = template.make(drawLevel, gen), seenKeys.insert(problem.key).inserted else { continue }
                made = exercise(from: problem, id: id, node: node, slot: slot, count: count, gen: gen)
                if made == nil { seenKeys.remove(problem.key) } else { drawn = problem }
            }
            if useReview { reviewIndex += 1 } else { mainIndex += 1 }
            exercises.append(made)
            problems.append(drawn)
        }
        balance(&exercises, problems, node: node, count: count, gen: gen)
        return Exercises.arrange(exercises, limit: count)
    }

    static func levelFor(node: CourseNode, slot: Int, count: Int) -> Int {
        let t = Double(slot) / Double(max(count - 1, 1))
        switch node.kind {
        case .lesson:
            switch node.index {
            case 1: return t < 0.6 ? 1 : 2
            case 2: return t < 0.3 ? 1 : (t < 0.75 ? 2 : 3)
            default: return t < 0.3 ? 2 : 3
            }
        case .practice:
            return t < 0.35 ? 2 : 3
        default:
            return t < 0.25 ? 2 : 3
        }
    }

    static func typedChance(_ node: CourseNode) -> Double {
        switch node.kind {
        case .lesson: return node.index == 1 ? 0.4 : (node.index == 2 ? 0.5 : 0.6)
        case .practice: return 0.5
        default: return 0.6
        }
    }

    /// Makes sure a node has typed and chosen answers: turns one question into the missing form when a draw went one-sided.
    static func balance(_ exercises: inout [LearnExercise?], _ problems: [UProblem?], node: CourseNode, count: Int, gen: UGen) {
        let kinds = Set(exercises.compactMap { $0?.kind })
        let wantTyped = !kinds.contains(.typeAnswer)
        guard wantTyped || !kinds.contains(.multipleChoice) else { return }
        for index in exercises.indices.reversed() {
            guard let old = exercises[index], let problem = problems[index] else { continue }
            if wantTyped ? (problem.number == nil || !problem.typedAllowed) : !problem.canChoice { continue }
            if let rebuilt = exercise(from: problem, id: old.id, node: node, slot: index, count: count, gen: gen, force: wantTyped) {
                exercises[index] = rebuilt
                return
            }
        }
    }

    static func exercise(from problem: UProblem, id: String, node: CourseNode, slot: Int, count: Int, gen: UGen, force: Bool? = nil) -> LearnExercise? {
        var wantTyped = problem.number != nil && problem.typedAllowed && gen.chance(typedChance(node))
        if slot == 0, problem.canChoice { wantTyped = false }
        if slot == count - 1, problem.number != nil, problem.typedAllowed { wantTyped = true }
        if !problem.canChoice { wantTyped = true }
        if let force { wantTyped = force }
        if wantTyped {
            guard let number = problem.number, problem.typedAllowed else { return nil }
            var alternatives: [String] = []
            if !number.isInt { alternatives.append(number.fraction) }
            let hint = problem.hint.isEmpty ? "" : " " + problem.hint
            return Exercises.typed(
                id: id, prompt: problem.prompt + hint, answer: number.typed, alternatives: alternatives, mode: .number,
                solution: problem.solution, explanation: problem.explanation
            )
        }
        return gen.withRandom { rng in
            Exercises.choice(
                id: id, prompt: problem.prompt, correct: problem.correct, wrong: problem.wrong, solution: problem.solution,
                explanation: problem.explanation, using: &rng
            )
        }
    }
}
