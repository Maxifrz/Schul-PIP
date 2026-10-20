package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.Course
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.CourseSection
import de.maxifrz.lernwerk.learn.CourseUnit
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.LearnAnswer
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.chess.ChessCoach
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.SkillFacet
import de.maxifrz.lernwerk.learn.skills.SkillTag
import de.maxifrz.lernwerk.learn.skills.standardLevel

// "Schach": eight units from the board to tactics. Every position is a FEN written by hand, and every accepted move is
// computed from it by the engine at run time, so the course cannot teach a wrong answer.
// Port of ChessCourse.swift (ChessProvider, ChessPlans) and the provider hooks of ChessSkills.swift.

private class UnitPlan(val lessons: List<List<String>>, val practice: List<String>, val checkpoint: List<String>)

object ChessCourse {
    const val COURSE_ID = "chess"
    const val LESSON_SIZE = 10
    const val PRACTICE_SIZE = 12
    const val CHECKPOINT_SIZE = 14
    private const val REVIEW = "review"

    /** Swift merges the unit tables keeping the first entry of a key. */
    private val table: Map<String, ChessMaker> = run {
        val merged = HashMap<String, ChessMaker>()
        for (makers in listOf(
            ChessUnit1.makers, ChessUnit2.makers, ChessUnit3.makers, ChessUnit4.makers,
            ChessUnit5.makers, ChessUnit6.makers, ChessUnit7.makers, ChessUnit8.makers,
        )) {
            for ((key, maker) in makers) if (key !in merged) merged[key] = maker
        }
        merged
    }

    /** The topics worth meeting again, per unit (index 0 is unit 1). */
    private val reviewKeys: List<List<String>> = listOf(
        ChessUnit1.review, ChessUnit2.review, ChessUnit3.review, ChessUnit4.review,
        ChessUnit5.review, ChessUnit6.review, ChessUnit7.review, ChessUnit8.review,
    )

    private fun l(vararg keys: String) = keys.toList()

    private val units: List<UnitPlan> = listOf(
        UnitPlan(
            lessons = listOf(
                l("u1.nameSquare", "u1.nameSquare", "u1.nameSquare", "u1.markedFile", "u1.markedFile", "u1.markedRank", "u1.markedRank", "u1.terms", "u1.sentence.names", "u1.typeName"),
                l("u1.colorOfSquare", "u1.colorOfSquare", "u1.colorOfSquare", "u1.cornerColor", "u1.factChoice", "u1.factChoice", "u1.corners", "u1.sentence.colors", "u1.factNumber", "u1.nameSquare"),
                l("u1.sameDiagonal", "u1.sameDiagonal", "u1.nameSquare", "u1.tapMove", "u1.tapMove", "u1.tapMove", "u1.typeName", "u1.typeName", "u1.typeCorner", "u1.factNumber"),
            ),
            practice = l("u1.nameSquare", "u1.nameSquare", "u1.markedFile", "u1.markedRank", "u1.colorOfSquare", "u1.colorOfSquare", "u1.sameDiagonal", "u1.terms", "u1.tapMove", "u1.tapMove", "u1.typeName", "u1.factNumber"),
            checkpoint = l("u1.nameSquare", "u1.nameSquare", "u1.markedFile", "u1.markedRank", "u1.colorOfSquare", "u1.cornerColor", "u1.factChoice", "u1.sameDiagonal", "u1.terms", "u1.corners", "u1.tapMove", "u1.tapMove", "u1.typeName", "u1.typeCorner"),
        ),
        UnitPlan(
            lessons = listOf(
                l("u2.identify", "u2.startCountChoice", "u2.startSquare", "u2.queenColor", "u2.letters", "u2.sentence.slide", "u2.moveTo.slider", "u2.moveTo.slider", "u2.count.slider", "u2.countNumber.slider"),
                l("u2.movePairs", "u2.sentence.step", "u2.count.step", "u2.count.step", "u2.reach.step", "u2.reach.step", "u2.moveTo.step", "u2.moveTo.step", "u2.countNumber.step", "u2.whichPiece"),
                l("u2.count.all", "u2.reach.all", "u2.whichPiece", "u2.whichPiece", "u2.captureMove", "u2.captureMove", "u2.moveTo.all", "u2.attackCount", "u2.attackCount", "u2.countNumber.all"),
            ),
            practice = l("u2.identify", "u2.startSquare", "u2.letters", "u2.count.all", "u2.reach.all", "u2.whichPiece", "u2.captureMove", "u2.moveTo.all", "u2.attackCount", "u2.countNumber.all", "review", "review"),
            checkpoint = l("u2.identify", "u2.startSquare", "u2.queenColor", "u2.letters", "u2.movePairs", "u2.count.all", "u2.reach.all", "u2.whichPiece", "u2.captureMove", "u2.moveTo.all", "u2.moveTo.all", "u2.countNumber.all", "u2.attackCount", "u2.startCountNumber"),
        ),
        UnitPlan(
            lessons = listOf(
                l("u3.direction", "u3.doubleStep", "u3.doubleStep", "u3.stepCount.simple", "u3.stepCount.simple", "u3.pairs", "u3.sentence.move", "u3.moveOne", "u3.moveTwo", "u3.moveTwo"),
                l("u3.captureDir", "u3.attackedSquare", "u3.attackedSquare", "u3.stepCount.all", "u3.stepCount.all", "u3.capture", "u3.capture", "u3.capture", "u3.sentence.move", "u3.moveOne"),
                l("u3.epYesNo", "u3.epYesNo", "u3.promoWhich", "u3.promoRank", "u3.promoSteps", "u3.sentence.special", "u3.epMove", "u3.epMove", "u3.promoMove", "u3.promoMove"),
            ),
            practice = l("u3.direction", "u3.doubleStep", "u3.stepCount.all", "u3.attackedSquare", "u3.epYesNo", "u3.promoSteps", "u3.moveTwo", "u3.capture", "u3.epMove", "u3.promoMove", "review", "review"),
            checkpoint = l("u3.direction", "u3.doubleStep", "u3.stepCount.all", "u3.attackedSquare", "u3.captureDir", "u3.epYesNo", "u3.promoWhich", "u3.promoRank", "u3.pairs", "u3.moveTwo", "u3.capture", "u3.epMove", "u3.promoMove", "u3.promoSteps"),
        ),
        UnitPlan(
            lessons = listOf(
                l("u4.isCheck", "u4.isCheck", "u4.isCheck", "u4.whichChecks", "u4.whichChecks", "u4.terms", "u4.sentence.check", "u4.giveCheck", "u4.giveCheck", "u4.giveCheck"),
                l("u4.escape.which", "u4.escape.which", "u4.sentence.check", "u4.escape.any", "u4.escape.any", "u4.escape.capture", "u4.escape.capture", "u4.escape.block", "u4.escape.block", "u4.escape.king"),
                l("u4.state", "u4.state", "u4.state", "u4.dead", "u4.dead", "u4.mateOrStale", "u4.mateOrStale", "u4.sentence.end", "u4.mateMove", "u4.mateMove"),
            ),
            practice = l("u4.isCheck", "u4.whichChecks", "u4.escape.which", "u4.state", "u4.state", "u4.dead", "u4.mateOrStale", "u4.terms", "u4.escape.any", "u4.mateMove", "review", "review"),
            checkpoint = l("u4.isCheck", "u4.isCheck", "u4.whichChecks", "u4.escape.which", "u4.state", "u4.state", "u4.dead", "u4.mateOrStale", "u4.terms", "u4.sentence.end", "u4.escape.any", "u4.escape.capture", "u4.escape.block", "u4.mateMove"),
        ),
        UnitPlan(
            lessons = listOf(
                l("u5.castleSquares", "u5.castleSquares", "u5.castleSquares", "u5.castlePairs", "u5.sentence.castle", "u5.castleMove", "u5.castleMove", "u5.castleMove", "u5.castleCan", "u5.castleCan"),
                l("u5.castleCan", "u5.castleCan", "u5.castleCan", "u5.castleReason", "u5.castleReason", "u5.castleReason", "u5.castleRules", "u5.castleRules", "u5.castleMove", "u5.castleMove"),
                l("u5.classify", "u5.classify", "u5.epYesNo", "u5.epYesNo", "u5.epRules", "u5.promoRules", "u5.promoPiece", "u3.epMove", "u3.promoMove", "u5.promoCheck"),
            ),
            practice = l("u5.castleCan", "u5.castleReason", "u5.castleSquares", "u5.classify", "u5.epYesNo", "u5.promoRules", "u5.castleMove", "u3.epMove", "u5.promoCheck", "u5.castleRules", "review", "review"),
            checkpoint = l("u5.castleSquares", "u5.castleCan", "u5.castleCan", "u5.castleReason", "u5.castleRules", "u5.classify", "u5.classify", "u5.epYesNo", "u5.epRules", "u5.promoRules", "u5.castlePairs", "u5.castleMove", "u3.epMove", "u5.promoCheck"),
        ),
        UnitPlan(
            lessons = listOf(
                l("u6.valueChoice", "u6.valueChoice", "u6.valueSum", "u6.valueSum", "u6.materialWho", "u6.valuePairs", "u6.sentence.values", "u6.valueNumber", "u6.valueNumber", "u6.materialCount"),
                l("u6.tradeKinds", "u6.tradeKinds", "u6.tradeJudge", "u6.tradeJudge", "u6.tradeJudge", "u6.materialWho", "u6.captureBest", "u6.captureBest", "u6.captureBest", "u6.materialCount"),
                l("u6.contestJudge", "u6.contestJudge", "u6.tradeJudge", "u6.contestBest", "u6.contestBest", "u6.contestBest", "u6.captureBest", "u6.contestCount", "u6.contestCount", "u6.contestCount"),
            ),
            practice = l("u6.valueChoice", "u6.valueSum", "u6.materialWho", "u6.tradeKinds", "u6.tradeJudge", "u6.contestJudge", "u6.captureBest", "u6.contestBest", "u6.materialCount", "u6.contestCount", "review", "review"),
            checkpoint = l("u6.valueChoice", "u6.valueSum", "u6.materialWho", "u6.valuePairs", "u6.tradeKinds", "u6.tradeJudge", "u6.tradeJudge", "u6.contestJudge", "u6.captureBest", "u6.captureBest", "u6.contestBest", "u6.materialCount", "u6.contestCount", "u6.valueNumber"),
        ),
        UnitPlan(
            lessons = listOf(
                l("u7.pattern.a", "u7.pattern.a", "u7.choose.a", "u7.choose.a", "u7.isMate.a", "u7.sentence.back", "u7.find.a", "u7.find.a", "u7.find.a", "u7.count.a"),
                l("u7.pattern.b", "u7.pattern.b", "u7.choose.b", "u7.isMate.b", "u7.pairs", "u7.find.b", "u7.find.b", "u7.find.b", "u7.count.b", "u7.write.b"),
                l("u7.choose.c", "u7.choose.c", "u7.isMate.c", "u7.isMate.c", "u7.sentence.rule", "u7.find.c", "u7.find.c", "u7.find.c", "u7.count.c", "u7.write.c"),
            ),
            practice = l("u7.pattern.all", "u7.choose.all", "u7.choose.all", "u7.isMate.all", "u7.pairs", "u7.find.all", "u7.find.all", "u7.count.all", "u7.write.all", "review", "review", "review"),
            checkpoint = l("u7.pattern.all", "u7.pattern.all", "u7.choose.all", "u7.choose.all", "u7.isMate.all", "u7.pairs", "u7.find.all", "u7.find.all", "u7.find.all", "u7.find.all", "u7.count.all", "u7.count.all", "u7.write.all", "u7.write.all"),
        ),
        UnitPlan(
            lessons = listOf(
                l("u8.hang.which", "u8.hang.which", "u8.fork.choose", "u8.fork.after", "u8.terms", "u8.sentence.fork", "u8.hang.find", "u8.hang.find", "u8.fork.find", "u8.fork.find"),
                l("u8.pin.which", "u8.pin.which", "u8.pin.choose", "u8.skewer.choose", "u8.sentence.line", "u8.pin.find", "u8.pin.find", "u8.skewer.find", "u8.skewer.find", "u8.skewer.find"),
                l("u8.discovered.choose", "u8.motif", "u8.motif", "u8.motif", "u8.sentence.line", "u8.discovered.find", "u8.discovered.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find"),
            ),
            practice = l("u8.hang.which", "u8.pin.which", "u8.mixed.choose", "u8.mixed.choose", "u8.motif", "u8.terms", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "review", "review"),
            checkpoint = l("u8.hang.which", "u8.pin.which", "u8.fork.after", "u8.mixed.choose", "u8.mixed.choose", "u8.motif", "u8.motif", "u8.terms", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find", "u8.mixed.find"),
        ),
    )

    /** The topic keys a node asks for, in order; null for a chest or an unknown node. */
    fun planFor(node: CourseNode): List<String>? {
        if (node.unitNumber < 1 || node.unitNumber > units.size) return null
        val unit = units[node.unitNumber - 1]
        return when (node.kind) {
            NodeKind.LESSON -> if (node.index >= 1 && node.index <= unit.lessons.size) unit.lessons[node.index - 1] else null
            NodeKind.PRACTICE -> unit.practice
            NodeKind.CHECKPOINT -> unit.checkpoint
            NodeKind.CHEST -> null
        }
    }

    /**
     * Runs the plan: each entry makes one exercise; an entry that cannot, or repeats an id, is replaced by the next one
     * in the cycle. The result is cut to the size of the plan and put from easy to hard.
     */
    fun buildPlan(plan: List<String>, unit: Int, draw: ChessDraw): List<LearnExercise> {
        val target = plan.size
        val made = ArrayList<LearnExercise>()
        val ids = HashSet<String>()
        var index = 0
        var attempts = 0
        while (made.size < target && attempts < target * 8) {
            var key = plan[index % plan.size]
            index += 1
            attempts += 1
            if (key == REVIEW) {
                val earlier = reviewKeys.take(maxOf(0, unit - 1)).flatten()
                key = randomElement(earlier, draw.random) ?: continue
            }
            val exercise = table[key]?.invoke(draw)
            if (exercise == null || exercise.id in ids) continue
            ids.add(exercise.id)
            made.add(exercise)
        }
        return Exercises.arrange(made, target)
    }

    private fun buildCourse(): Course {
        val units = ChessUnitTexts.all.mapIndexed { index, text ->
            CourseUnit.standard(COURSE_ID, index + 1, text.title, text.summary, text.tip)
        }
        return Course(
            id = COURSE_ID, title = "Schach", subtitle = "Vom ersten Zug bis zum Matt", kind = CourseKind.CHESS, color = 0xd17a9e, symbol = "crown.fill",
            sections = listOf(
                CourseSection("chess.s1", "Brett und Figuren", units.subList(0, 3)),
                CourseSection("chess.s2", "Schach, Matt und Sonderzüge", units.subList(3, 5)),
                CourseSection("chess.s3", "Material und Taktik", units.subList(5, 8)),
            ),
        )
    }

    internal val course: Course by lazy { buildCourse() }
}

class ChessProvider : CourseProvider {
    override val course: Course = ChessCourse.course

    override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
        if (node.kind == NodeKind.CHEST) return emptyList()
        val plan = ChessCourse.planFor(node) ?: return emptyList()
        val draw = ChessDraw(Exercises.seed(node, seed))
        return ChessCourse.buildPlan(plan, node.unitNumber, draw)
    }

    // Two goals per unit: the knowledge (what a rule says, names, counting, judging) and the use of it at the board
    // (finding the move). A student who can say what a fork is has not yet shown that he finds one.
    override fun skillFacets(unit: CourseUnit): List<SkillFacet> {
        // Unit 4 asks about check and mate by choosing and by finding moves; nothing in it is typed.
        val typed = unit.number != 4
        return listOf(
            SkillFacet(
                key = "know", title = "Wissen", goal = "Du kennst und erkennst: " + unit.summary,
                levels = if (typed) listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.RECALL) else listOf(CompetenceLevel.RECOGNISE),
                after = "know",
            ),
            SkillFacet(
                key = "board", title = "Am Brett", goal = "Du findest den richtigen Zug in einer Stellung: " + unit.title,
                levels = listOf(CompetenceLevel.APPLY), requires = listOf("know"),
            ),
        )
    }

    override fun skillTag(exercise: LearnExercise, node: CourseNode): SkillTag =
        if (exercise.kind == ExerciseKind.CHESS_MOVE) SkillTag("board", CompetenceLevel.APPLY)
        else SkillTag("know", exercise.kind.standardLevel)

    override fun feedback(exercise: LearnExercise, answer: LearnAnswer): String? {
        if (!exercise.coach.startsWith(ChessCoach.PREFIX) || answer !is LearnAnswer.Move) return null
        val media = exercise.media as? ExerciseMedia.Board ?: return null
        val position = ChessPosition.fromFen(media.board.fen) ?: return null
        return ChessCoach.explain(answer.value, exercise.coach.substring(ChessCoach.PREFIX.length), position)
    }
}

/** The chess course (Swift: `ChessCourse.provider`). */
val chessProvider: CourseProvider = ChessProvider()
