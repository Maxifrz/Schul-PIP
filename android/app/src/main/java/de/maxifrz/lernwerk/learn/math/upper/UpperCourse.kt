package de.maxifrz.lernwerk.learn.math.upper

import de.maxifrz.lernwerk.learn.Course
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.CourseSection
import de.maxifrz.lernwerk.learn.CourseUnit
import de.maxifrz.lernwerk.learn.LearnExercise

// "Mathe Oberstufe": analysis, vectors and stochastics for the last two school years. Every lesson, practice round
// and checkpoint draws its problems from templates with exact arithmetic and a seeded generator.
// A port of MathUpperCourse.swift.

object MathUpperCatalog {
    /** The templates of each unit, in unit order. */
    val units: List<List<UTemplate>> by lazy {
        listOf(
            MathUpperUnit01.templates, MathUpperUnit02.templates, MathUpperUnit03.templates, MathUpperUnit04.templates,
            MathUpperUnit05.templates, MathUpperUnit06.templates, MathUpperUnit07.templates,
        )
    }

    /** Which templates are new in lesson 1, 2 and 3 of each unit (by template id). */
    val lessonGroups: List<List<List<String>>> = listOf(
        listOf(listOf("d1.power", "d1.value", "d1.linear"), listOf("d1.slope", "d1.where", "d1.negexp"), listOf("d1.tangentT", "d1.tangentY", "d1.flat")),
        listOf(listOf("k.yaxis", "k.root", "k.rootTest", "k.sym"), listOf("k.extX", "k.extY", "k.kind"), listOf("k.inflect", "k.mono", "k.slope")),
        listOf(listOf("i.anti", "i.noC", "i.definite"), listOf("i.signed", "i.area", "i.rules"), listOf("i.mean", "i.upper", "i.area")),
        listOf(listOf("e.deriv", "e.anti", "e.zero"), listOf("e.inverse", "e.lnDeriv", "e.log"), listOf("e.lawChoice", "e.laws", "e.solve", "e.lnSolve")),
        listOf(listOf("t.rad", "t.deg", "t.exact", "t.sign"), listOf("t.pyth", "t.deriv", "t.derivAt", "t.solve"), listOf("t.period", "t.amp", "t.zeros", "t.int")),
        listOf(listOf("v.norm", "v.vecAB", "v.dist", "v.mid"), listOf("v.dot", "v.orthoChoice", "v.orthoT", "v.angle"), listOf("v.linePoint", "v.lineT", "v.onLine", "v.dir")),
        listOf(listOf("s.dice", "s.urn", "s.choose"), listOf("s.pmf", "s.cum", "s.expect"), listOf("s.table", "s.cond", "s.indep", "s.bayes")),
    )

    fun template(id: String): UTemplate? = units.asSequence().flatten().firstOrNull { it.id == id }
}

const val MATH_UPPER_COURSE_ID = "matho"

class MathUpperProvider : CourseProvider {
    override val course: Course

    init {
        fun unit(number: Int, title: String, summary: String, tip: String) =
            CourseUnit.standard(MATH_UPPER_COURSE_ID, number, title, summary, tip)
        val tips = MathUpperTexts.tips
        val analysis = CourseSection(
            "matho.s1", "Analysis",
            listOf(
                unit(1, "Ableitung", "Potenzregel, Summenregel, Steigung und Tangente", tips[0]),
                unit(2, "Kurvendiskussion", "Nullstellen, Extrem- und Wendestellen, Monotonie, Symmetrie", tips[1]),
                unit(3, "Integralrechnung", "Stammfunktion, bestimmtes Integral, Fläche und Mittelwert", tips[2]),
                unit(4, "e-Funktion und Logarithmus", "Ableitung, Stammfunktion, Logarithmusgesetze, Gleichungen", tips[3]),
                unit(5, "Trigonometrie", "Bogenmaß, exakte Werte, Ableitung von sin und cos, Periode", tips[4]),
            ),
        )
        val geometry = CourseSection(
            "matho.s2", "Analytische Geometrie",
            listOf(unit(6, "Vektoren", "Betrag, Skalarprodukt, Orthogonalität, Geraden, Abstand", tips[5])),
        )
        val stochastics = CourseSection(
            "matho.s3", "Stochastik",
            listOf(unit(7, "Stochastik", "Laplace, Binomialverteilung, Erwartungswert, bedingte Wahrscheinlichkeit", tips[6])),
        )
        course = Course(
            id = MATH_UPPER_COURSE_ID, title = "Mathe Oberstufe", subtitle = "Analysis, Vektoren, Stochastik",
            kind = CourseKind.MATH, color = 0x5A5AA8, symbol = "function", sections = listOf(analysis, geometry, stochastics),
        )
    }

    override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> = MathUpperBuilder.exercises(node, seed)
}

val mathUpperProvider: CourseProvider = MathUpperProvider()
