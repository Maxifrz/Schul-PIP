package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.LearnAnswer
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.at
import de.maxifrz.lernwerk.learn.structureProblems
import de.maxifrz.lernwerk.learn.calendar
import de.maxifrz.lernwerk.learn.chess.ChessCoach
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessGoals
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMove
import de.maxifrz.lernwerk.learn.chess.ChessNotation
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.chess.ChessSquare
import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.ExerciseOutcome
import de.maxifrz.lernwerk.learn.skills.SkillAssessor
import de.maxifrz.lernwerk.learn.skills.SkillPractice
import de.maxifrz.lernwerk.learn.skills.SkillRecord
import de.maxifrz.lernwerk.learn.skills.SkillStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Ports of LernwerkTests/ChessCourseTests.swift and the chess parts of SkillCoursesTests.swift and
// SkillFeedbackTests.swift. The rules engine is proved elsewhere; here the authored positions are proved legal and
// right, and every exercise the course can build is re-checked by routes that do not share the generator's code.

private val provider = chessProvider
private val course = provider.course
private val utc = calendar("UTC")
private fun date(day: Int): Long = at(utc, 2026, 5, day, 10)
private fun steps(): List<CourseNode> = course.nodes.filter { it.kind != NodeKind.CHEST }

/** Legal moves by a second route: every pseudo-legal move is played, and it counts when the mover's own king is not attacked afterwards. */
private fun bruteLegal(position: ChessPosition): List<ChessMove> =
    position.pseudoLegalMoves().filter { !position.applying(it).isInCheck(position.sideToMove) }

private fun position(fen: String): ChessPosition = ChessPosition.fromFen(fen) ?: throw AssertionError("FEN does not parse: $fen")

private class Item(val node: CourseNode, val seed: ULong, val exercise: LearnExercise)

private val corpus: List<Item> by lazy {
    val items = ArrayList<Item>()
    for (node in steps()) {
        for (seed in 1..20) for (e in provider.exercises(node, seed.toULong())) items.add(Item(node, seed.toULong(), e))
    }
    items
}

private fun boardOf(e: LearnExercise) = (e.media as? ExerciseMedia.Board)?.board
private fun positionOf(e: LearnExercise): ChessPosition = position(boardOf(e)?.fen ?: throw AssertionError("${e.id} has no board"))

class ChessCourseTest {
    @Test
    fun passesTheCourseAuditForSeeds1To20() {
        assertEquals(emptyList<String>(), CourseAudit.problems(provider, (1..20).map { it.toULong() }))
    }

    @Test
    fun hasTheStructureOfTheSwiftCourse() {
        assertEquals("chess", course.id)
        assertEquals("Schach", course.title)
        assertEquals("Vom ersten Zug bis zum Matt", course.subtitle)
        assertEquals(CourseKind.CHESS, course.kind)
        assertEquals(0xd17a9e, course.color)
        assertEquals("crown.fill", course.symbol)
        assertEquals(8, course.units.size)
        assertEquals(
            listOf("Das Brett", "Die Figuren und ihre Züge", "Der Bauer", "Schach und Matt", "Sonderzüge", "Werte und Tausch", "Matt in einem Zug", "Taktik-Grundlagen"),
            course.units.map { it.title },
        )
        for (unit in course.units) {
            assertEquals(unit.id, 3, unit.nodes.count { it.kind == NodeKind.LESSON })
            assertEquals(
                unit.id,
                listOf(NodeKind.LESSON, NodeKind.LESSON, NodeKind.LESSON, NodeKind.PRACTICE, NodeKind.CHECKPOINT, NodeKind.CHEST),
                unit.nodes.map { it.kind },
            )
            assertTrue(unit.summary.isNotEmpty())
            val paragraphs = unit.tip.split("\n\n").size
            assertTrue("${unit.id} tip has $paragraphs paragraphs", paragraphs in 2..5)
        }
        assertEquals(listOf(3, 2, 3), course.sections.map { it.units.size })
        assertEquals(emptyList<String>(), provider.structureProblems())
    }

    @Test
    fun teachesTheGermanTermsInTheTipsAndKeepsTheTextsPlain() {
        val tips = course.units.map { it.tip }
        val required = listOf(
            0 to listOf("Linien", "Reihen", "Diagonalen", "e4", "a1"),
            1 to listOf("Springer", "Läufer", "Turm", "Dame", "König", "Sf3"),
            2 to listOf("Doppelschritt", "en passant", "Bauernumwandlung"),
            3 to listOf("Schach", "Matt", "Patt", "Remis"),
            4 to listOf("Rochade", "O-O-O", "Umwandlung", "en passant"),
            5 to listOf("Bauer 1", "Springer 3", "Läufer 3", "Turm 5", "Dame 9"),
            6 to listOf("Grundreihenmatt", "Erstickungsmatt", "Schäfermatt", "Leitermatt"),
            7 to listOf("Gabel", "Fesselung", "Spieß", "Abzugsangriff"),
        )
        for ((index, words) in required) {
            for (word in words) assertTrue("unit ${index + 1} tip lacks $word", tips[index].lowercase().contains(word.lowercase()))
        }
        for (item in corpus) {
            if (item.seed != 1uL) continue
            val e = item.exercise
            for (text in listOf(e.prompt, e.explanation, e.solution) + e.options) {
                assertFalse(text, text.codePoints().toArray().any { it in 0x1f300..0x1faff })
                assertFalse(text, text.contains("TODO"))
            }
        }
    }

    @Test
    fun givesChestsAndUnknownNodesNoExercises() {
        for (node in course.nodes.filter { it.kind == NodeKind.CHEST }) assertEquals(emptyList<LearnExercise>(), provider.exercises(node, 1uL))
        val strange = CourseNode("chess.u99.l1", "chess", "chess.u99", 99, NodeKind.LESSON, 1, "x")
        assertEquals(emptyList<LearnExercise>(), provider.exercises(strange, 1uL))
    }

    @Test
    fun usesSeveralKindsInEveryNodeAndAllThreeInEveryUnit() {
        for (unit in course.units) {
            val unitKinds = HashSet<ExerciseKind>()
            for (node in unit.nodes.filter { it.kind != NodeKind.CHEST }) {
                val kinds = provider.exercises(node, 1uL).map { it.kind }.toSet()
                assertTrue(node.id, kinds.size >= 2)
                unitKinds.addAll(kinds)
            }
            assertTrue("${unit.id} meets its items in too few forms", unitKinds.size >= 3)
        }
    }

    @Test
    fun hasTheNodeSizes10_12And14() {
        for (node in steps()) {
            val expected = if (node.kind == NodeKind.CHECKPOINT) 14 else if (node.kind == NodeKind.PRACTICE) 12 else 10
            for (seed in 1..20) assertEquals("${node.id} seed $seed", expected, provider.exercises(node, seed.toULong()).size)
        }
    }

    @Test
    fun givesDifferentLessonsForDifferentSeedsAndTheSameOneForTheSameSeed() {
        for (node in steps()) {
            val runs = (1..20).map { provider.exercises(node, it.toULong()) }
            val distinct = runs.map { r -> r.joinToString("|") { it.id } }.toSet()
            assertTrue("${node.id} shows too few different lessons", distinct.size >= 12)
            assertEquals(provider.exercises(node, 7uL), provider.exercises(node, 7uL))
        }
    }

    @Test
    fun showsManyDistinctPositions() {
        fun key(fen: String) = fen.split(' ').take(2).joinToString(" ")
        val fens = HashSet<String>()
        for (item in corpus) {
            val spec = boardOf(item.exercise)
            if (spec != null && spec.fen != ChessKit.EMPTY_FEN) fens.add(key(spec.fen))
        }
        assertTrue("only ${fens.size} distinct positions", fens.size >= 60)
        assertTrue(ChessSamples.all().map { key(it.fen) }.toSet().size >= 150)
    }

    @Test
    fun buildsALessonFast() {
        val start = System.nanoTime()
        for (node in steps()) provider.exercises(node, 987654uL)
        assertTrue((System.nanoTime() - start) / 1_000_000 < 20000)
        val again = System.nanoTime()
        for (node in steps()) provider.exercises(node, 987654uL)
        assertTrue((System.nanoTime() - again) / 1_000_000 < 5000)
    }
}

class ChessCourseExercisesTest {
    @Test
    fun showsASoundPositionTurnedTowardsTheSideToMove() {
        for (item in corpus) {
            val spec = boardOf(item.exercise) ?: continue
            val p = position(spec.fen)
            assertEquals("${item.exercise.id}: the board is turned towards the side to move", p.sideToMove == de.maxifrz.lernwerk.learn.chess.ChessColor.BLACK, spec.flipped)
            for (name in spec.marked) assertNotNull("${item.exercise.id}: marked $name", ChessSquare.fromName(name))
            if (spec.fen != ChessKit.EMPTY_FEN) assertEquals("${item.exercise.id} ${spec.fen}", emptyList<String>(), p.validationProblems())
        }
    }

    @Test
    fun acceptsOnlyLegalMovesInMoveExercisesAndNamesOneInTheSolution() {
        var count = 0
        for (item in corpus) {
            val e = item.exercise
            if (e.kind != ExerciseKind.CHESS_MOVE) continue
            count += 1
            val p = positionOf(e)
            val legal = bruteLegal(p).map { it.uci }.toSet()
            assertTrue(e.id, e.correctAnswers.isNotEmpty())
            for (answer in e.correctAnswers) {
                if (answer.length == 5) assertTrue("${e.id}: $answer is not legal", answer in legal)
                else assertTrue("${e.id}: $answer is not legal", answer in legal || answer + "q" in legal)
            }
            assertTrue(e.solution.isNotEmpty())
            assertTrue(e.id, e.explanation.isNotEmpty())
            val first = e.solution.split(" oder ")[0].split(" (")[0]
            if (first != "…") {
                val m = ChessNotation.move(first, p)
                assertNotNull("${e.id}: solution $first is no move", m)
                assertTrue(e.id, m!!.uci in e.correctAnswers || m.from.name + m.to.name in e.correctAnswers)
            }
        }
        assertTrue(count > 500)
    }

    @Test
    fun keepsPromptsShortAndExplainsEveryRuleExercise() {
        for (item in corpus) {
            val e = item.exercise
            assertTrue(e.id, e.prompt.codePointCount(0, e.prompt.length) <= 170)
            if (e.kind != ExerciseKind.MATCH_PAIRS && e.kind != ExerciseKind.WORD_BANK) assertTrue("${e.id} has no explanation", e.explanation.isNotEmpty())
        }
    }

    @Test
    fun hasSoundUniqueSamples() {
        val all = ChessSamples.all()
        assertEquals("sample ids are not unique", all.size, all.map { it.id }.toSet().size)
        for (sample in all) {
            val p = ChessPosition.fromFen(sample.fen)
            assertNotNull("${sample.id}: FEN does not parse", p)
            assertEquals(sample.id, emptyList<String>(), p!!.validationProblems())
            assertEquals("${sample.id}: FEN is not in the engine's own form", sample.fen, p.fen)
            if (sample.focus != null) assertNotNull(sample.id, ChessSquare.fromName(sample.focus))
            assertEquals(sample.id, p.legalMoves().size, bruteLegal(p).size)
        }
    }

    @Test
    fun agreesWithTheAuthoredSolutionsOfTheSamples() {
        for (sample in ChessSamples.all().filter { it.id.startsWith("mate.") }) {
            val p = position(sample.fen)
            val texts = ChessGoals.accepted(ChessGoal.MateInOne, p).map { ChessNotation.san(it, p)!! }.sorted()
            assertEquals(sample.id, sample.expected.sorted(), texts)
        }
        assertNull(ChessSamples.all()[0].focusSquare)
    }
}

class ChessSkillsTest {
    @Test
    fun splitsKnowingFromDoingAtTheBoard() {
        val map = provider.skillMap()
        assertEquals(16, map.skills.size)
        assertEquals(emptyList<String>(), map.problems())
        val board = map.skill("chess.u08.board")
        assertEquals(listOf(CompetenceLevel.APPLY), board?.levels)
        assertEquals(listOf("chess.u08.know"), board?.prerequisites)
        assertEquals(listOf("chess.u01.know"), map.skill("chess.u02.know")?.prerequisites)
        assertEquals(listOf(CompetenceLevel.RECOGNISE), map.skill("chess.u04.know")?.levels)
        assertEquals(listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.RECALL), map.skill("chess.u03.know")?.levels)
    }

    @Test
    fun putsEveryExerciseOfAStepUnderADeclaredGoal() {
        val map = provider.skillMap()
        for (node in steps()) {
            for (seed in listOf(1uL, 2uL)) {
                for (e in provider.lessonExercises(node, seed)) {
                    assertTrue("${e.id} has no skill", e.skill.isNotEmpty())
                    assertNotNull(e.id, e.level)
                    assertNotNull("${e.id} -> ${e.skill}", map.skill(e.skill))
                }
            }
        }
    }

    @Test
    fun showsEveryLevelAGoalAsksForInItsSteps() {
        val map = provider.skillMap()
        val seen = HashMap<String, MutableSet<CompetenceLevel>>()
        for (node in steps()) {
            for (seed in listOf(1uL, 2uL, 3uL, 4uL)) {
                for (e in provider.lessonExercises(node, seed)) {
                    val level = e.level ?: continue
                    seen.getOrPut(e.skill) { HashSet() }.add(level)
                }
            }
        }
        for (skill in map.skills) for (level in skill.levels) assertTrue("${skill.id} never asks at level $level", seen[skill.id]?.contains(level) == true)
    }

    /** Plays every step of the course once, right on every first try, and records it. */
    private fun perfectDay(day: Int, seed: ULong, records: MutableMap<String, SkillRecord>) {
        val map = provider.skillMap()
        for (node in steps()) {
            val list = ArrayList<ExerciseOutcome>()
            for (e in provider.lessonExercises(node, seed)) {
                val level = e.level ?: continue
                list.add(ExerciseOutcome(e.id, e.skill, level, right = true, helped = false))
            }
            SkillAssessor.record(list, node, map, records, date(day), utc)
        }
    }

    @Test
    fun mastersEveryGoalForAStudentWhoAnswersEverythingRightWithinAFewDays() {
        val map = provider.skillMap()
        val records = HashMap<String, SkillRecord>()
        perfectDay(1, 1uL, records)
        perfectDay(2, 2uL, records)
        // Goals the path alone gives too few answers for get the rounds the advice would suggest.
        for (day in 2..5) {
            for (skill in map.skills) {
                val status = SkillAssessor.status(records[skill.id], skill, emptySet(), date(day), utc)
                if (status == SkillStatus.MASTERED) continue
                val round = SkillPractice.exercises(provider, map, listOf(skill.id), records, (day * 100).toULong())
                val list = ArrayList<ExerciseOutcome>()
                for (e in round) {
                    val level = e.level ?: continue
                    list.add(ExerciseOutcome(e.id, e.skill, level, right = true, helped = false))
                }
                SkillAssessor.record(list, null, map, records, date(day), utc)
            }
        }
        for (skill in map.skills) {
            val status = SkillAssessor.status(records[skill.id], skill, emptySet(), date(5), utc)
            assertTrue("${skill.id} is $status: ${SkillAssessor.missing(records[skill.id] ?: SkillRecord(), skill)}", status == SkillStatus.MASTERED)
        }
    }

    @Test
    fun neverMastersAnythingInOneDay() {
        val map = provider.skillMap()
        val records = HashMap<String, SkillRecord>()
        perfectDay(1, 1uL, records)
        perfectDay(1, 2uL, records)
        for (skill in map.skills) {
            assertTrue(skill.id, SkillAssessor.status(records[skill.id], skill, emptySet(), date(1), utc) != SkillStatus.MASTERED)
        }
    }

    @Test
    fun neverReachesBoardGoalsForAStudentWhoOnlyChooses() {
        val map = provider.skillMap()
        val records = HashMap<String, SkillRecord>()
        listOf(1uL, 2uL, 3uL).forEachIndexed { index, seed ->
            for (node in steps()) {
                val list = ArrayList<ExerciseOutcome>()
                for (e in provider.lessonExercises(node, seed)) {
                    val level = e.level ?: continue
                    // Right where there is something to pick, wrong where something must be produced.
                    list.add(ExerciseOutcome(e.id, e.skill, level, right = level == CompetenceLevel.RECOGNISE, helped = false))
                }
                SkillAssessor.record(list, node, map, records, date(1 + index), utc)
            }
        }
        for (skill in map.skills.filter { s -> s.levels.any { it.isHigher(CompetenceLevel.RECOGNISE) } }) {
            val status = SkillAssessor.status(records[skill.id], skill, emptySet(), date(4), utc)
            assertFalse("${skill.id} is $status", status.isReached)
        }
    }
}

class ChessCoachOnCourseTest {
    private val start = ChessPosition.start
    private fun explain(move: String, goal: String = "moves", fen: String? = null): String? =
        ChessCoach.explain(move, goal, if (fen != null) position(fen) else start)

    @Test
    fun saysWhyAMoveIsNotAllowed() {
        assertEquals("Auf e4 steht keine Figur.", explain("e4e5"))
        assertEquals("Auf e7 steht eine schwarze Figur, aber Weiß ist am Zug.", explain("e7e5"))
        assertEquals("Auf g2 steht schon eine eigene Figur.", explain("g1g2"))
        assertEquals("Der Weg von a1 nach a3 ist versperrt.", explain("a1a3"))
        assertTrue(explain("e2e5")!!.startsWith("Der Bauer kann nicht von e2 nach e5 ziehen."))
    }

    @Test
    fun knowsAPinAndACheck() {
        assertEquals("Nach diesem Zug stünde dein König im Schach. Das ist nicht erlaubt.", explain("e2d3", "moves", "4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1"))
        assertEquals("Du stehst im Schach. Dieser Zug beendet das Schach nicht.", explain("a1a2", "moves", "4r1k1/8/8/8/8/8/8/R3K3 w - - 0 1"))
    }

    @Test
    fun saysWhatALegalButWrongMoveDoesNotDo() {
        val backRank = "6k1/5p1p/6p1/8/8/8/8/R3K3 w - - 0 1"
        assertTrue(explain("a1a8", "mate", backRank)!!.contains("verteidigen"))
        assertTrue(explain("a1a7", "mate", backRank)!!.contains("kein Schach"))
        val knight = "4k3/8/2p5/3p4/5N2/8/8/4K3 w - - 0 1"
        assertTrue(explain("f4d5", "capture", knight)!!.contains("zurückschlagen"))
        assertTrue(explain("f4h5", "capture", knight)!!.contains("schlägt aber nichts"))
        assertEquals("Der Zug ist erlaubt, aber er ist nicht der, nach dem gefragt ist.", explain("e2e4", "moves"))
    }

    @Test
    fun givesEveryMoveExerciseHintsAndACoachTag() {
        var found = 0
        for (node in steps()) {
            for (e in provider.lessonExercises(node, 1uL)) {
                if (e.kind != ExerciseKind.CHESS_MOVE) continue
                found += 1
                assertTrue(e.id, e.hints.size in 1..2)
                assertTrue(e.id, e.coach.startsWith(ChessCoach.PREFIX))
                assertTrue(e.hints.all { it.isNotEmpty() })
            }
        }
        assertTrue(found > 20)
    }

    @Test
    fun answersEveryWrongMoveOfEveryMoveExercise() {
        for (node in course.nodes.filter { it.kind == NodeKind.LESSON }) {
            for (e in provider.lessonExercises(node, 3uL)) {
                if (e.kind != ExerciseKind.CHESS_MOVE) continue
                assertNotNull("${e.id} has no valid position", boardOf(e)?.let { ChessPosition.fromFen(it.fen) })
                var asked = 0
                for (from in 0 until 64) {
                    val file = from and 7
                    val rank = from shr 3
                    val targets = listOfNotNull(ChessSquare.of((file + 1) % 8, rank), ChessSquare.of(file, (rank + 2) % 8))
                    for (to in targets) {
                        val uci = ChessSquare(from).name + to.name
                        if (uci in e.correctAnswers || from == to.index) continue
                        assertNotNull("${e.id} $uci", provider.feedback(e, LearnAnswer.Move(uci)))
                        asked += 1
                    }
                }
                assertTrue(asked > 50)
            }
        }
    }

    @Test
    fun acceptsOnlyMatesInMateExercises() {
        for (node in course.nodes.filter { it.kind == NodeKind.PRACTICE }) {
            for (e in provider.lessonExercises(node, 2uL)) {
                if (e.kind != ExerciseKind.CHESS_MOVE || e.coach != "chess:mate") continue
                val p = positionOf(e)
                for (answer in e.correctAnswers) {
                    val m = ChessMove.fromUci(answer) ?: continue
                    assertTrue("${e.id} $answer is accepted but is no mate", p.applying(m).isCheckmate)
                }
            }
        }
    }

    @Test
    fun givesNoFeedbackForExercisesWithoutACoachTagOrANonMoveAnswer() {
        val e = provider.lessonExercises(course.nodes[0], 1uL).first { it.kind == ExerciseKind.MULTIPLE_CHOICE }
        assertNull(provider.feedback(e, LearnAnswer.Option("x")))
        val mv = provider.lessonExercises(course.nodes[2], 1uL).first { it.kind == ExerciseKind.CHESS_MOVE }
        assertNull(provider.feedback(mv, LearnAnswer.Typed("e2e4")))
    }
}
