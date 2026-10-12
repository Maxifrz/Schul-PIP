import Foundation

/// "Musik": eight units from the staff to keys and the circle of fifths. Every note name, interval and chord is
/// computed by `MusicTheory` at run time, so the course cannot teach a wrongly spelled note.
enum MusicCourse {
    static let provider: any CourseProvider = MusicProvider()
}

enum MusicUnits {
    static let defs: [MusicUnitDef] = [MusicUnit1.def, MusicUnit2.def, MusicUnit3.def, MusicUnit4.def, MusicUnit5.def, MusicUnit6.def, MusicUnit7.def, MusicUnit8.def]
}

struct MusicProvider: CourseProvider {
    static let courseID = "music"

    let course: Course

    init() {
        let units = MusicTexts.all.enumerated().map { index, text in
            CourseUnit.standard(courseID: MusicProvider.courseID, number: index + 1, title: text.title, summary: text.summary, tip: text.tip)
        }
        course = Course(
            id: MusicProvider.courseID, title: "Musik", subtitle: "Noten lesen, hören, verstehen", kind: .music, color: 0x9E6B8E,
            symbol: "music.note",
            sections: [
                CourseSection(id: "music.s1", title: "Notenlesen", units: Array(units[0..<2])),
                CourseSection(id: "music.s2", title: "Rhythmus und Vorzeichen", units: Array(units[2..<4])),
                CourseSection(id: "music.s3", title: "Tonleitern und Intervalle", units: Array(units[4..<6])),
                CourseSection(id: "music.s4", title: "Dreiklänge und Tonarten", units: Array(units[6..<8])),
            ]
        )
    }

    func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
        guard node.kind != .chest, (1...MusicUnits.defs.count).contains(node.unitNumber) else { return [] }
        var random = LearnRandom(seed: Exercises.seed(for: node, base: seed))
        let def = MusicUnits.defs[node.unitNumber - 1]
        let topics: [String]
        switch node.kind {
        case .lesson: topics = def.lessons[min(max(node.index, 1), def.lessons.count) - 1]
        case .practice: topics = def.practice
        default: topics = def.checkpoint
        }
        let level = node.kind == .lesson ? node.index : 4
        var made: [LearnExercise] = []
        var used = Set<String>()
        for topic in topics {
            for _ in 0..<12 {
                let exercise = topic == "~" ? review(before: node.unitNumber, &random) : def.makers[topic]?(&random, level)
                if let exercise, used.insert(exercise.id).inserted {
                    made.append(exercise)
                    break
                }
            }
        }
        return Exercises.arrange(made, limit: 15)
    }

    /// A question about an earlier unit.
    private func review(before unit: Int, _ random: inout LearnRandom) -> LearnExercise? {
        guard unit > 1, let index = Array(0..<(unit - 1)).randomElement(using: &random) else { return nil }
        let def = MusicUnits.defs[index]
        guard let topic = def.review.randomElement(using: &random) else { return nil }
        return def.makers[topic]?(&random, 4)
    }
}
