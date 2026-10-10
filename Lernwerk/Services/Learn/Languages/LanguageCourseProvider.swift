import Foundation

/// Turns a language or school-subject course (see LanguageDSL) into lessons. Every item is met in three stages: first
/// recognised (a choice), then put together (tiles, a choice in the other direction, hearing), then produced (typed).
/// A lesson teaches a third of the unit and warms up with two items from before; practice and the checkpoint cover the
/// whole unit and some of the units before it, with more typing in the checkpoint.
struct LanguageCourseProvider: CourseProvider {
    let data: LanguageCourseData
    let course: Course
    private let texts: LanguageTexts

    init(data: LanguageCourseData) {
        self.data = data
        texts = LanguageTexts.make(for: data)
        var sections: [CourseSection] = []
        var titles: [String] = []
        var grouped: [[CourseUnit]] = []
        for (index, unit) in data.units.enumerated() {
            let built = CourseUnit.standard(
                courseID: data.id, number: index + 1, title: unit.title, summary: unit.summary, tip: unit.tip,
                lessons: LanguageCourseProvider.lessonCount(of: unit)
            )
            let title = unit.sectionTitle.isEmpty ? "Einheiten" : unit.sectionTitle
            if titles.last == title {
                grouped[grouped.count - 1].append(built)
            } else {
                titles.append(title)
                grouped.append([built])
            }
        }
        for (index, units) in grouped.enumerated() {
            sections.append(CourseSection(id: "\(data.id).s\(index + 1)", title: titles[index], units: units))
        }
        course = Course(
            id: data.id, title: data.title, subtitle: data.subtitle, kind: data.kind, color: data.color,
            symbol: data.symbol, sections: sections
        )
    }

    /// Parses the text of a course. `errors` lists every problem in the text and in the content; a shipped course has none.
    static func make(source: String) -> (provider: LanguageCourseProvider, errors: [String]) {
        let parsed = LanguageDSL.parse(source)
        let provider = LanguageCourseProvider(data: parsed.data)
        return (provider, parsed.errors + parsed.data.problems())
    }

    // MARK: Items

    private enum ItemKind {
        case word, sentence, form, fill, fact
    }

    private struct Ref: Hashable {
        let unit: Int
        let kind: ItemKind
        let index: Int
    }

    /// Lessons teach about six new items each, so a unit of 18 items has three lessons and one of 30 has five.
    static let itemsPerLesson = 6

    static func lessonCount(of unit: LanguageUnitData) -> Int {
        min(5, max(3, (unit.itemCount + itemsPerLesson - 1) / itemsPerLesson))
    }

    private func counts(of unit: Int) -> [(ItemKind, Int)] {
        let u = data.units[unit]
        return [(.word, u.words.count), (.sentence, u.sentences.count), (.form, u.forms.count), (.fill, u.fills.count), (.fact, u.facts.count)]
    }

    /// The items of a unit in teaching order, or one lesson's share of it (`part` of `parts`, from 0). The order mixes
    /// the kinds by how far along each is: the first word, sentence, form, fill and fact come first, then the second of
    /// each, and so on. Every lesson gets an even share of all of them.
    private func refs(unit: Int, part: Int? = nil, of parts: Int = 1) -> [Ref] {
        var all: [(position: Double, order: Int, ref: Ref)] = []
        for (order, entry) in counts(of: unit).enumerated() where entry.1 > 0 {
            for index in 0..<entry.1 {
                all.append((position: (Double(index) + 0.5) / Double(entry.1), order: order, ref: Ref(unit: unit, kind: entry.0, index: index)))
            }
        }
        all.sort { $0.position != $1.position ? $0.position < $1.position : $0.order < $1.order }
        let ordered = all.map(\.ref)
        guard let part else { return ordered }
        // An even share, so that the last lesson is not left short: 29 items over 5 lessons are 5, 6, 6, 6 and 6.
        return Array(ordered[(ordered.count * part / parts)..<(ordered.count * (part + 1) / parts)])
    }

    private func isWordOrSentence(_ ref: Ref) -> Bool {
        ref.kind == .word || ref.kind == .sentence
    }

    /// Up to `limit` words and sentences from the units before, picked by the generator.
    private func earlierRefs(before unit: Int, limit: Int, rng: inout LearnRandom) -> [Ref] {
        guard unit > 0, limit > 0 else { return [] }
        var pool: [Ref] = []
        for earlier in 0..<unit { pool += refs(unit: earlier).filter(isWordOrSentence) }
        pool.shuffle(using: &rng)
        return Array(pool.prefix(limit))
    }

    // MARK: Nodes

    /// What a node draws on and how it asks. `rounds` are the stages to try per item, in order of preference, for the
    /// first and the second exercise of each item; only `fresh` items get a second one.
    private struct Plan {
        var focus: [Ref]
        var fresh: Set<Ref>
        var rounds: [[Int]]
        var total: Int
    }

    private func plan(for node: CourseNode, rng: inout LearnRandom) -> Plan {
        let unit = node.unitNumber - 1
        switch node.kind {
        case .lesson:
            let lessons = LanguageCourseProvider.lessonCount(of: data.units[unit])
            let part = min(lessons - 1, node.index - 1)
            let new = refs(unit: unit, part: part, of: lessons)
            let review = part > 0
                ? Array(refs(unit: unit, part: part - 1, of: lessons).filter(isWordOrSentence).suffix(2))
                : earlierRefs(before: unit, limit: 2, rng: &rng)
            return Plan(focus: new + review, fresh: Set(new), rounds: [[0, 1, 2], [1, 2, 0]], total: ExerciseBuilder.maxExercises)
        case .practice:
            let focus = refs(unit: unit) + earlierRefs(before: unit, limit: 4, rng: &rng)
            return Plan(focus: focus, fresh: Set(focus), rounds: [[1, 2, 0], [2, 1, 0]], total: ExerciseBuilder.maxExercises)
        default:
            let focus = refs(unit: unit) + earlierRefs(before: unit, limit: 2, rng: &rng)
            return Plan(focus: focus, fresh: Set(focus), rounds: [[2, 1, 0], [1, 2, 0]], total: CourseAudit.checkpointRange.upperBound - 1)
        }
    }

    func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
        guard node.kind != .chest, data.units.indices.contains(node.unitNumber - 1) else { return [] }
        var rng = LearnRandom(seed: Exercises.seed(for: node, base: seed))
        let plan = plan(for: node, rng: &rng)

        var chosen: [LearnExercise] = []
        var ids = Set<String>()
        func take(_ exercise: LearnExercise?) -> Bool {
            guard let exercise, ids.insert(exercise.id).inserted else { return false }
            chosen.append(exercise)
            return true
        }

        // Pairs of words first: one in a lesson, two in the longer rounds.
        // A lesson with fewer than four words of its own matches some of the unit's other words too.
        let unitWords = refs(unit: node.unitNumber - 1).filter { $0.kind == .word }
        var words = plan.focus.filter { $0.kind == .word }
        words += unitWords.filter { !words.contains($0) }
        _ = take(pairsExercise(words: words, node: node, tag: "p1", rng: &rng))
        if node.kind != .lesson, words.count >= 8 {
            _ = take(pairsExercise(words: Array(words.reversed()), node: node, tag: "p2", rng: &rng))
        }

        // Every item gets its first exercise before any item gets a second; items that came up less often go first.
        var usage = [Int](repeating: 0, count: plan.focus.count)
        for (round, stages) in plan.rounds.enumerated() {
            var order = Array(plan.focus.indices)
            order.shuffle(using: &rng)
            order = order.enumerated().sorted { a, b in
                usage[a.element] != usage[b.element] ? usage[a.element] < usage[b.element] : a.offset < b.offset
            }.map(\.element)
            for (position, index) in order.enumerated() where chosen.count < plan.total {
                let ref = plan.focus[index]
                if round > 0, !plan.fresh.contains(ref) { continue }
                // Alternate the order of the stages from item to item (by place in this run's shuffled order), so a round
                // is not all of one kind: a sentence may start with tiles instead of a choice, and practice and the
                // checkpoint, which lean on typing, assemble a third of their items instead.
                var preference = stages
                if round > 0, position % 2 == 1 { preference = [stages[1], stages[0], stages[2]] }
                if round == 0, ref.kind == .sentence, position % 2 == 1, stages[0] == 0 { preference = [1, 0, 2] }
                if round == 0, stages[0] == 2, position % 3 == 0 { preference = [1, 2, 0] }
                for stage in preference {
                    var candidates = exercises(for: ref, stage: stage, node: node, rng: &rng).filter { !ids.contains($0.id) }
                    guard !candidates.isEmpty else { continue }
                    candidates.shuffle(using: &rng)
                    if take(candidates[0]) {
                        usage[index] += 1
                        break
                    }
                }
            }
        }
        return Exercises.arrange(chosen, limit: plan.total)
    }

    private func pairsExercise(words: [Ref], node: CourseNode, tag: String, rng: inout LearnRandom) -> LearnExercise? {
        var seen = Set<String>()
        var items: [(key: String, front: String, back: String)] = []
        for ref in words {
            let word = data.units[ref.unit].words[ref.index]
            guard let meaning = word.meanings.first, seen.insert(LearnExercise.folded(word.target)).inserted,
                  seen.insert(LearnExercise.folded(meaning)).inserted else { continue }
            items.append((key: key(ref), front: word.target, back: meaning))
            if items.count == ExerciseBuilder.pairCount { break }
        }
        return Exercises.pairs(id: "\(node.id)#\(tag)", prompt: texts.pairs, items: items, using: &rng)
    }

    // MARK: Exercises of one item

    private func speech(_ text: String) -> ExerciseMedia? {
        data.speech.map { ExerciseMedia.speech(text: text, language: $0) }
    }

    private func key(_ ref: Ref) -> String {
        let letter: String
        switch ref.kind {
        case .word: letter = "w"
        case .sentence: letter = "s"
        case .form: letter = "f"
        case .fill: letter = "g"
        case .fact: letter = "q"
        }
        return "\(letter)\(ref.unit)-\(ref.index)"
    }

    /// The exercises an item has at a stage: 0 recognise (a choice), 1 assemble or hear (the other direction, tiles,
    /// listening), 2 produce (typed). Not every item has every stage; the node's plan falls back to another.
    private func exercises(for ref: Ref, stage: Int, node: CourseNode, rng: inout LearnRandom) -> [LearnExercise] {
        let made: [LearnExercise?]
        switch ref.kind {
        case .word: made = wordExercises(ref, stage: stage, node: node, rng: &rng)
        case .sentence: made = sentenceExercises(ref, stage: stage, node: node, rng: &rng)
        case .form: made = formExercises(ref, stage: stage, node: node, rng: &rng)
        case .fill: made = fillExercises(ref, stage: stage, node: node, rng: &rng)
        case .fact: made = factExercises(ref, stage: stage, node: node, rng: &rng)
        }
        return made.compactMap { $0 }
    }

    private func wordExercises(_ ref: Ref, stage: Int, node: CourseNode, rng: inout LearnRandom) -> [LearnExercise?] {
        let word = data.units[ref.unit].words[ref.index]
        guard let meaning = word.meanings.first else { return [] }
        let id = "\(node.id)#\(key(ref))"
        let k = key(ref)
        let askTarget = texts.fill(texts.askTarget, with: meaning)
        let askMeaning = texts.fill(texts.meaning, with: word.target)
        // What a wrong answer is told: the author's sentence, or the word with its grammar note ("puella · -ae f.").
        let why = !word.why.isEmpty ? word.why : (word.note.isEmpty ? "" : "\(word.target) · \(word.note)")
        switch stage {
        case 0:
            let wrong = meaningDistractors(for: word, unit: ref.unit, rng: &rng)
            return [Exercises.choice(
                id: id + "a", key: k, prompt: askMeaning, correct: meaning, wrong: wrong, explanation: why,
                media: speech(word.target), using: &rng
            )]
        case 1:
            guard data.produces else { return [] }
            let wrong = targetDistractors(for: word, unit: ref.unit, rng: &rng)
            var list = [Exercises.choice(
                id: id + "b", key: k, prompt: askTarget, correct: word.target, wrong: wrong, explanation: why, using: &rng
            )]
            if data.speech != nil {
                list.append(Exercises.choice(
                    id: id + "c", key: k, prompt: texts.listen, correct: word.target, wrong: wrong, explanation: why,
                    media: speech(word.target), using: &rng
                ))
            }
            return list
        default:
            var list: [LearnExercise?] = []
            if data.produces {
                list.append(Exercises.typed(id: id + "d", key: k, prompt: askTarget, answer: word.target, mode: .exact, explanation: why))
            }
            // A subject's terms have a definition for a meaning, which nobody types.
            if data.kind != .school {
                list.append(Exercises.typed(
                    id: id + "e", key: k, prompt: askMeaning, answer: meaning, alternatives: Array(word.meanings.dropFirst()),
                    explanation: why, media: speech(word.target)
                ))
            }
            return list
        }
    }

    private func sentenceExercises(_ ref: Ref, stage: Int, node: CourseNode, rng: inout LearnRandom) -> [LearnExercise?] {
        let sentence = data.units[ref.unit].sentences[ref.index]
        guard let meaning = sentence.meanings.first else { return [] }
        let id = "\(node.id)#\(key(ref))"
        let k = key(ref)
        let others = otherSentences(than: sentence, unit: ref.unit, rng: &rng)
        let targetTiles = tiles(of: sentence.target)
        let knownTiles = tiles(of: meaning)
        switch stage {
        case 0:
            let wrong = ExerciseBuilder.pickDistractors(for: meaning, from: others.map { $0.meanings[0] })
            return [Exercises.choice(
                id: id + "a", key: k, prompt: texts.fill(texts.translateFrom, with: sentence.target), correct: meaning,
                wrong: wrong, explanation: sentence.why, media: speech(sentence.target), using: &rng
            )]
        case 1:
            return [
                data.produces ? Exercises.bank(
                    id: id + "b", key: k, prompt: texts.fill(texts.translateInto, with: meaning), words: targetTiles,
                    extra: extraTiles(from: others.map(\.target), avoiding: targetTiles, rng: &rng), solution: sentence.target,
                    explanation: sentence.why, using: &rng
                ) : nil,
                Exercises.bank(
                    id: id + "c", key: k, prompt: texts.fill(texts.translateFrom, with: sentence.target), words: knownTiles,
                    extra: extraTiles(from: others.map { $0.meanings[0] }, avoiding: knownTiles, rng: &rng), solution: meaning,
                    explanation: sentence.why, media: speech(sentence.target), using: &rng
                ),
            ]
        default:
            var list: [LearnExercise?] = []
            if data.produces, targetTiles.count <= 8 {
                list.append(Exercises.typed(
                    id: id + "d", key: k, prompt: texts.fill(texts.translateInto, with: meaning), answer: sentence.target, mode: .exact,
                    explanation: sentence.why
                ))
                if data.speech != nil {
                    list.append(Exercises.typed(
                        id: id + "e", key: k, prompt: texts.listenType, answer: sentence.target, mode: .exact, explanation: sentence.why,
                        media: speech(sentence.target)
                    ))
                }
            }
            if !data.produces {
                // Translated into the known language, where the meaning counts, not the exact words.
                list.append(Exercises.typed(
                    id: id + "f", key: k, prompt: texts.fill(texts.translateFrom, with: sentence.target), answer: meaning,
                    alternatives: Array(sentence.meanings.dropFirst()), explanation: sentence.why, media: speech(sentence.target)
                ))
            }
            return list
        }
    }

    private func formExercises(_ ref: Ref, stage: Int, node: CourseNode, rng: inout LearnRandom) -> [LearnExercise?] {
        let form = data.units[ref.unit].forms[ref.index]
        guard let answer = form.answers.first else { return [] }
        let id = "\(node.id)#\(key(ref))"
        let prompt = texts.fill(texts.form, with: form.prompt)
        if stage == 1 { return [] }
        if stage == 2 {
            return [Exercises.typed(
                id: id + "d", key: key(ref), prompt: prompt, answer: answer, alternatives: Array(form.answers.dropFirst()), mode: .exact,
                explanation: form.why
            )]
        }
        var siblings: [String] = []
        var others: [String] = []
        for other in data.units[ref.unit].forms where other != form {
            guard let first = other.answers.first else { continue }
            if other.group == form.group { siblings.append(first) } else { others.append(first) }
        }
        siblings.shuffle(using: &rng)
        others.shuffle(using: &rng)
        let wrong = ExerciseBuilder.pickDistractors(for: answer, from: siblings + others)
        return [Exercises.choice(id: id + "a", key: key(ref), prompt: prompt, correct: answer, wrong: wrong, explanation: form.why, using: &rng)]
    }

    private func fillExercises(_ ref: Ref, stage: Int, node: CourseNode, rng: inout LearnRandom) -> [LearnExercise?] {
        let fill = data.units[ref.unit].fills[ref.index]
        guard let answer = fill.options.first else { return [] }
        let id = "\(node.id)#\(key(ref))"
        let prompt = texts.fill(texts.fill, with: fill.sentence)
        let whole = fill.sentence.replacingOccurrences(of: "___", with: answer)
        if stage == 1 { return [] }
        if stage == 2 {
            return [Exercises.typed(
                id: id + "d", key: key(ref), prompt: prompt, answer: answer, mode: .exact, solution: whole, explanation: fill.why
            )]
        }
        return [Exercises.choice(
            id: id + "a", key: key(ref), prompt: prompt, correct: answer, wrong: Array(fill.options.dropFirst()), solution: whole,
            explanation: fill.why, using: &rng
        )]
    }

    private func factExercises(_ ref: Ref, stage: Int, node: CourseNode, rng: inout LearnRandom) -> [LearnExercise?] {
        guard stage == 0 else { return [] }
        let fact = data.units[ref.unit].facts[ref.index]
        return [Exercises.choice(
            id: "\(node.id)#\(key(ref))a", key: key(ref), prompt: fact.question, correct: fact.answer, wrong: fact.wrong,
            explanation: fact.why, using: &rng
        )]
    }

    // MARK: Wrong answers

    /// First meanings of other words of this unit and the units before it; never one that a word with a shared meaning
    /// would also make right.
    private func otherWords(than word: LanguageWord, unit: Int, rng: inout LearnRandom) -> [LanguageWord] {
        let mine = Set(word.meanings.map(LearnExercise.folded))
        var same: [LanguageWord] = []
        var earlier: [LanguageWord] = []
        for (index, unitData) in data.units.enumerated() where index <= unit {
            for other in unitData.words where other != word && !other.meanings.isEmpty {
                guard mine.isDisjoint(with: Set(other.meanings.map(LearnExercise.folded))) else { continue }
                if index == unit { same.append(other) } else { earlier.append(other) }
            }
        }
        same.shuffle(using: &rng)
        earlier.shuffle(using: &rng)
        return same + earlier
    }

    private func meaningDistractors(for word: LanguageWord, unit: Int, rng: inout LearnRandom) -> [String] {
        ExerciseBuilder.pickDistractors(for: word.meanings[0], from: otherWords(than: word, unit: unit, rng: &rng).map { $0.meanings[0] })
    }

    private func targetDistractors(for word: LanguageWord, unit: Int, rng: inout LearnRandom) -> [String] {
        ExerciseBuilder.pickDistractors(for: word.target, from: otherWords(than: word, unit: unit, rng: &rng).map(\.target))
    }

    /// Other sentences of this unit and the units before it, those of a similar length first.
    private func otherSentences(than sentence: LanguageSentence, unit: Int, rng: inout LearnRandom) -> [LanguageSentence] {
        var pool: [LanguageSentence] = []
        for (index, unitData) in data.units.enumerated() where index <= unit {
            pool += unitData.sentences.filter { $0 != sentence && !$0.meanings.isEmpty }
        }
        pool.shuffle(using: &rng)
        let length = sentence.target.count
        return pool.enumerated().sorted { a, b in
            let da = abs(a.element.target.count - length), db = abs(b.element.target.count - length)
            return da != db ? da < db : a.offset < b.offset
        }.map(\.element)
    }

    /// Words of a sentence as tiles, without the punctuation at their ends: it would show which tile is the last.
    private func tiles(of sentence: String) -> [String] {
        let marks = CharacterSet.punctuationCharacters.union(.whitespaces)
        return sentence.split(whereSeparator: \.isWhitespace)
            .map { String($0).trimmingCharacters(in: marks) }
            .filter { !$0.isEmpty }
    }

    /// Up to two words from other sentences that are not in this one.
    private func extraTiles(from sentences: [String], avoiding own: [String], rng: inout LearnRandom) -> [String] {
        let used = Set(own.map(LearnExercise.folded))
        var pool: [String] = []
        for sentence in sentences {
            for tile in tiles(of: sentence) where !used.contains(LearnExercise.folded(tile)) && LearnExercise.folded(tile).count >= 2 {
                pool.append(tile)
            }
        }
        pool.shuffle(using: &rng)
        return Array(pool.prefix(ExerciseBuilder.extraWords))
    }
}
