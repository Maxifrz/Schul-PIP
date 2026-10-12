import Foundation

/// A material's lessons as a course, so the path screen shows them like any other course. The lessons keep the ids
/// they have always had, so what a student finished before stays finished.
enum MaterialCourse {
    static let idPrefix = "material."
    /// The Quill accent, as the colors of the other courses are given: 0xRRGGBB.
    static let color: UInt32 = 0x7FA98C

    static func courseID(for unit: LearnUnit) -> String {
        idPrefix + unit.id
    }

    static func isMaterialCourse(_ id: String) -> Bool {
        id.hasPrefix(idPrefix)
    }

    static func course(for unit: LearnUnit, title: String) -> Course {
        let courseID = courseID(for: unit)
        let unitID = courseID + ".u01"
        var nodes = unit.lessons.map { lesson in
            CourseNode(
                id: lesson.id, courseID: courseID, unitID: unitID, unitNumber: 1, kind: .lesson, index: lesson.index + 1,
                title: "Lektion \(lesson.index + 1)"
            )
        }
        nodes.append(CourseNode(id: courseID + ".k", courseID: courseID, unitID: unitID, unitNumber: 1, kind: .chest, index: 1, title: "Truhe"))
        let lessons = unit.lessons.count
        let courseUnit = CourseUnit(
            id: unitID, number: 1, title: title,
            summary: "\(unit.cards.count) Karten in \(lessons) \(lessons == 1 ? "Lektion" : "Lektionen")",
            tip: "Diese Lektionen sind aus den Seiten deines Materials entstanden. Jede fragt dich sechs Karten ab: erst zum Auswählen, "
                + "dann zum Zusammensetzen und am Ende zum Eintippen. Karten, die zum Wiederholen fällig sind, bekommen danach ihren neuen Termin.",
            nodes: nodes
        )
        return Course(
            id: courseID, title: title, subtitle: "Aus deinem Material", kind: .school, color: color, symbol: "doc.text.fill",
            sections: [CourseSection(id: courseID + ".s1", title: "Mein Material", units: [courseUnit])]
        )
    }

    /// The lesson a node stands for, to start it with its cards.
    static func lesson(for node: CourseNode, in unit: LearnUnit) -> LearnLesson? {
        unit.lessons.first { $0.id == node.id }
    }
}
