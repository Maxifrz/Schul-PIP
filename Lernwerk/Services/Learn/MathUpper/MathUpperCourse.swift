import Foundation

/// "Mathe Oberstufe": analysis, vectors and stochastics for the last two school years. Every lesson, practice round
/// and checkpoint draws its problems from templates with exact arithmetic and a seeded generator.
enum MathUpperCourse {
    static let provider: any CourseProvider = MathUpperProvider()
}

enum MathUpperCatalog {
    /// The templates of each unit, in unit order.
    static let units: [[UTemplate]] = [
        MathUpperUnit01.templates,
        MathUpperUnit02.templates,
        MathUpperUnit03.templates,
        MathUpperUnit04.templates,
        MathUpperUnit05.templates,
        MathUpperUnit06.templates,
        MathUpperUnit07.templates,
    ]

    /// Which templates are new in lesson 1, 2 and 3 of each unit (by template id).
    static let lessonGroups: [[[String]]] = [
        [["d1.power", "d1.value", "d1.linear"], ["d1.slope", "d1.where", "d1.negexp"], ["d1.tangentT", "d1.tangentY", "d1.flat"]],
        [["k.yaxis", "k.root", "k.rootTest", "k.sym"], ["k.extX", "k.extY", "k.kind"], ["k.inflect", "k.mono", "k.slope"]],
        [["i.anti", "i.noC", "i.definite"], ["i.signed", "i.area", "i.rules"], ["i.mean", "i.upper", "i.area"]],
        [["e.deriv", "e.anti", "e.zero"], ["e.inverse", "e.lnDeriv", "e.log"], ["e.lawChoice", "e.laws", "e.solve", "e.lnSolve"]],
        [["t.rad", "t.deg", "t.exact", "t.sign"], ["t.pyth", "t.deriv", "t.derivAt", "t.solve"], ["t.period", "t.amp", "t.zeros", "t.int"]],
        [["v.norm", "v.vecAB", "v.dist", "v.mid"], ["v.dot", "v.orthoChoice", "v.orthoT", "v.angle"], ["v.linePoint", "v.lineT", "v.onLine", "v.dir"]],
        [["s.dice", "s.urn", "s.choose"], ["s.pmf", "s.cum", "s.expect"], ["s.table", "s.cond", "s.indep", "s.bayes"]],
    ]

    static func template(_ id: String) -> UTemplate? {
        units.lazy.flatMap { $0 }.first { $0.id == id }
    }
}

struct MathUpperProvider: CourseProvider {
    static let courseID = "matho"

    let course: Course

    init() {
        func unit(_ number: Int, _ title: String, _ summary: String, _ tip: String) -> CourseUnit {
            CourseUnit.standard(courseID: MathUpperProvider.courseID, number: number, title: title, summary: summary, tip: tip)
        }
        let tips = MathUpperTexts.tips
        let analysis = CourseSection(id: "matho.s1", title: "Analysis", units: [
            unit(1, "Ableitung", "Potenzregel, Summenregel, Steigung und Tangente", tips[0]),
            unit(2, "Kurvendiskussion", "Nullstellen, Extrem- und Wendestellen, Monotonie, Symmetrie", tips[1]),
            unit(3, "Integralrechnung", "Stammfunktion, bestimmtes Integral, Fläche und Mittelwert", tips[2]),
            unit(4, "e-Funktion und Logarithmus", "Ableitung, Stammfunktion, Logarithmusgesetze, Gleichungen", tips[3]),
            unit(5, "Trigonometrie", "Bogenmaß, exakte Werte, Ableitung von sin und cos, Periode", tips[4]),
        ])
        let geometry = CourseSection(id: "matho.s2", title: "Analytische Geometrie", units: [
            unit(6, "Vektoren", "Betrag, Skalarprodukt, Orthogonalität, Geraden, Abstand", tips[5]),
        ])
        let stochastics = CourseSection(id: "matho.s3", title: "Stochastik", units: [
            unit(7, "Stochastik", "Laplace, Binomialverteilung, Erwartungswert, bedingte Wahrscheinlichkeit", tips[6]),
        ])
        course = Course(
            id: MathUpperProvider.courseID, title: "Mathe Oberstufe", subtitle: "Analysis, Vektoren, Stochastik",
            kind: .math, color: 0x5A5AA8, symbol: "function", sections: [analysis, geometry, stochastics]
        )
    }

    func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
        MathUpperBuilder.exercises(for: node, seed: seed)
    }
}
