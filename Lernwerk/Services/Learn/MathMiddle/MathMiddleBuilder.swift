import Foundation

/// Turns the templates of a unit into the exercises of a node: which template at which difficulty in which form. A
/// lesson teaches the templates of its own third of the unit (lesson 1 easy, lesson 2 medium, lesson 3 harder) and
/// reviews the earlier lessons; the practice round mixes the unit's levels with the earlier units; the checkpoint asks
/// every template of the unit at the hard level.
enum MathMiddleBuilder {
    typealias Form = MathMiddleTemplate.Form

    static let lessonLength = 10
    static let checkpointLength = 12
    /// Typed answers stay below this: a German "1.250" is a thousand to some and a decimal to the answer check.
    static let typedLimit = 1000

    private struct Wish {
        let template: MathMiddleTemplate
        let level: Int
        let form: Form
    }

    static func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
        guard node.kind != .chest, (1...MathMiddleCatalog.units.count).contains(node.unitNumber) else { return [] }
        let gen = MathMiddleGen(seed: Exercises.seed(for: node, base: seed))
        let total = node.kind == .checkpoint ? checkpointLength : lessonLength
        var made: [LearnExercise] = []
        var seen = Set<String>()
        for (position, wish) in wishes(for: node, total: total, gen: gen).enumerated() {
            guard made.count < total else { break }
            if let exercise = realize(wish, position: position, gen: gen, seen: &seen) { made.append(exercise) }
        }
        return Exercises.arrange(made, limit: total)
    }

    // Plan

    /// 5 choices, a round of pairs, then the typed answers: the easy forms first, as the lesson goes.
    private static func formPattern(total: Int) -> [Form] {
        [.choice, .choice, .choice, .choice, .choice, .pairs] + Array(repeating: Form.typed, count: total - 6)
    }

    /// The next template of the list, from the cursor on, that can be put in this form; the cursor moves past it. When
    /// none can, the next one anyway: the exercise is then made in a form it has.
    private static func next(_ form: Form, from list: [MathMiddleTemplate], cursor: inout Int) -> MathMiddleTemplate {
        for offset in 0..<list.count {
            let template = list[(cursor + offset) % list.count]
            if template.forms.contains(form) {
                cursor += offset + 1
                return template
            }
        }
        cursor += 1
        return list[(cursor - 1) % list.count]
    }

    /// More wishes than exercises: a wish that cannot be made (the numbers drawn were no good) is replaced by the next.
    private static func wishes(for node: CourseNode, total: Int, gen: MathMiddleGen) -> [Wish] {
        let units = MathMiddleCatalog.units
        let current = units[node.unitNumber - 1]
        let pattern = formPattern(total: total)
        let backup = total * 3
        var wishes: [Wish] = []

        func form(at position: Int) -> Form {
            position < pattern.count ? pattern[position] : (position % 2 == 0 ? .typed : .choice)
        }

        switch node.kind {
        case .lesson:
            let lesson = node.index
            let mine = gen.shuffled(current.filter { $0.lesson == lesson })
            let earlier = gen.shuffled(current.filter { $0.lesson < lesson })
            let own = mine.isEmpty ? gen.shuffled(current) : mine
            // Lessons 2 and 3 start by recalling the earlier lessons, and ask one of them again near the end.
            let reviewPositions: Set<Int> = lesson >= 2 && !earlier.isEmpty ? [0, 1, 7] : []
            var ownCursor = 0
            var reviewCursor = 0
            for position in 0..<backup {
                let wanted = form(at: position)
                if reviewPositions.contains(position) {
                    let template = next(wanted, from: earlier, cursor: &reviewCursor)
                    wishes.append(Wish(template: template, level: max(1, lesson - 1), form: wanted))
                } else {
                    // New material starts one level down and ends one level up.
                    let level = min(3, max(1, lesson - (position < 4 ? 1 : 0) + (position >= 8 ? 1 : 0)))
                    // A round of pairs may come from the earlier lessons when this lesson has no template for it.
                    var template = next(wanted, from: own, cursor: &ownCursor)
                    if wanted == .pairs, !template.forms.contains(.pairs), let other = earlier.first(where: { $0.forms.contains(.pairs) }) {
                        template = other
                    }
                    wishes.append(Wish(template: template, level: level, form: wanted))
                }
            }
        case .practice:
            let own = gen.shuffled(current)
            let before = units[..<(node.unitNumber - 1)].flatMap { $0 }
            let reviewPositions: Set<Int> = before.isEmpty ? [] : [1, 3, 7, 9]
            let levels = [1, 2, 2, 3, 2, 3, 3, 2, 3, 2]
            var ownCursor = 0
            for position in 0..<backup {
                let wanted = form(at: position)
                if reviewPositions.contains(position) {
                    // Another unit, picked evenly from the units before this one.
                    let unit = gen.shuffled(units[gen.int(0...(node.unitNumber - 2))])
                    var cursor = 0
                    wishes.append(Wish(template: next(wanted, from: unit, cursor: &cursor), level: gen.int(1...2), form: wanted))
                } else {
                    wishes.append(Wish(template: next(wanted, from: own, cursor: &ownCursor), level: levels[position % levels.count], form: wanted))
                }
            }
        case .checkpoint:
            let own = gen.shuffled(current)
            var cursor = 0
            for position in 0..<backup {
                let wanted = form(at: position)
                // Every template once first, in the form it has; then the rest in the forms asked for.
                let template = position < own.count ? own[position] : next(wanted, from: own, cursor: &cursor)
                wishes.append(Wish(template: template, level: 3, form: wanted))
            }
        case .chest:
            break
        }
        return wishes
    }

    // Making one exercise

    private static func realize(_ wish: Wish, position: Int, gen: MathMiddleGen, seen: inout Set<String>) -> LearnExercise? {
        let template = wish.template
        var form = wish.form
        if !template.forms.contains(form) {
            if form == .pairs, template.forms.contains(.choice) {
                form = .choice
            } else if let other = [Form.typed, .choice].first(where: { template.forms.contains($0) && $0 != form }) {
                form = other
            } else {
                return nil
            }
        }
        let id = "\(template.id).\(position)"
        if form == .pairs { return pairs(template, level: wish.level, id: id, gen: gen, seen: &seen) }
        for _ in 0..<24 {
            guard let problem = template.make(wish.level, gen), !seen.contains(problem.key) else { continue }
            if let exercise = exercise(from: problem, id: id, form: form, gen: gen) {
                seen.insert(problem.key)
                return exercise
            }
        }
        return nil
    }

    static func exercise(from problem: MathMiddleProblem, id: String, form: Form, gen: MathMiddleGen) -> LearnExercise? {
        switch form {
        case .choice:
            let wrong = gen.shuffled(problem.options)
            guard wrong.count >= 2 else { return nil }
            return gen.withRandom {
                Exercises.choice(
                    id: id, prompt: problem.prompt, correct: problem.correct, wrong: wrong, solution: problem.solution,
                    explanation: problem.explanation, using: &$0
                )
            }
        case .typed:
            guard let typed = problem.typed, abs(typed.answer.doubleValue) < Double(typedLimit) else { return nil }
            let shown = typed.text ?? MathMiddleText.number(MathMiddleQ(typed.answer))
            return Exercises.typed(
                id: id, prompt: typed.prompt, answer: shown, alternatives: shown == typed.answer.fractionText ? [] : [typed.answer.fractionText],
                mode: .number, solution: problem.solution, explanation: problem.explanation
            )
        case .pairs:
            return nil
        }
    }

    /// Four problems of one template as pairs: the fronts differ, and so do the backs.
    private static func pairs(_ template: MathMiddleTemplate, level: Int, id: String, gen: MathMiddleGen, seen: inout Set<String>) -> LearnExercise? {
        var problems: [MathMiddleProblem] = []
        var fronts = Set<String>()
        var backs = Set<String>()
        for _ in 0..<60 where problems.count < ExerciseBuilder.pairCount {
            guard let problem = template.make(level, gen), let front = problem.pairFront, !seen.contains(problem.key) else { continue }
            let foldedFront = LearnExercise.folded(front)
            let foldedBack = LearnExercise.folded(problem.correct)
            guard !foldedFront.isEmpty, !foldedBack.isEmpty, !fronts.contains(foldedFront), !backs.contains(foldedBack) else { continue }
            fronts.insert(foldedFront)
            backs.insert(foldedBack)
            problems.append(problem)
        }
        guard problems.count == ExerciseBuilder.pairCount else { return nil }
        let items = problems.enumerated().map { (key: "\(id).\($0.offset)", front: $0.element.pairFront ?? "", back: $0.element.correct) }
        var exercise = gen.withRandom { Exercises.pairs(id: id, prompt: problems[0].pairPrompt, items: items, using: &$0) }
        exercise?.explanation = problems[0].pairExplanation ?? problems[0].explanation
        if exercise != nil { problems.forEach { seen.insert($0.key) } }
        return exercise
    }
}
