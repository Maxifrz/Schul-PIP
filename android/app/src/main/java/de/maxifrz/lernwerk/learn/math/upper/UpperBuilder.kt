package de.maxifrz.lernwerk.learn.math.upper

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.PairItem

/** Turns a node into its exercises: picks the templates, the levels and the form of each question. */
object MathUpperBuilder {
    fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
        if (node.kind == NodeKind.CHEST || node.unitNumber < 1 || node.unitNumber > MathUpperCatalog.units.size) return emptyList()
        val gen = UGen(Exercises.seed(node, seed))
        val unitIndex = node.unitNumber - 1
        val unitTemplates = MathUpperCatalog.units[unitIndex]
        val count = if (node.kind == NodeKind.CHECKPOINT) 12 else 10

        var main: List<UTemplate>
        var review: List<UTemplate> = emptyList()
        when (node.kind) {
            NodeKind.LESSON -> {
                val groups = MathUpperCatalog.lessonGroups[unitIndex]
                main = groups[minOf(node.index, groups.size) - 1].mapNotNull { MathUpperCatalog.template(it) }
                if (node.index > 1) {
                    review = groups.subList(0, node.index - 1).flatten().mapNotNull { MathUpperCatalog.template(it) }
                }
            }
            NodeKind.PRACTICE -> {
                main = unitTemplates
                if (unitIndex > 0) review = MathUpperCatalog.units.subList(0, unitIndex).flatten()
            }
            else -> main = unitTemplates
        }
        main = gen.shuffled(main)
        review = gen.shuffled(review)

        val reviewSlots = if (node.kind == NodeKind.PRACTICE) 3 else (if (node.kind == NodeKind.LESSON && node.index > 1) 3 else 0)
        val pairTemplate: UTemplate? =
            main.firstOrNull { it.pairs != null } ?: (if (node.kind == NodeKind.PRACTICE) review.firstOrNull { it.pairs != null } else null)
        val pairSlot = if (pairTemplate != null && (node.kind != NodeKind.LESSON || node.index == 1)) 2 else -1

        val exercises = mutableListOf<LearnExercise?>()
        val problems = mutableListOf<UProblem?>()
        val seenKeys = hashSetOf<String>()
        var mainIndex = 0
        var reviewIndex = 0
        for (slot in 0 until count) {
            val id = "${node.id}.e${slot + 1}"
            val pairsFn = pairTemplate?.pairs
            if (slot == pairSlot && pairsFn != null) {
                var made: LearnExercise? = null
                var i = 0
                while (i < 20 && made == null) {
                    i += 1
                    val items = pairsFn(2, gen)
                    if (items != null && items.size == 4) {
                        made = gen.withRandom { rng ->
                            Exercises.pairs(
                                id = id,
                                items = items.mapIndexed { offset, item -> PairItem("$id.$offset", item.front, item.back) },
                                random = rng,
                            )
                        }
                    }
                }
                if (made != null) {
                    exercises.add(made)
                    problems.add(null)
                    continue
                }
            }
            val level = levelFor(node, slot, count)
            val useReview = review.isNotEmpty() && slot % 3 == 2 && slot / 3 < reviewSlots
            var made: LearnExercise? = null
            var drawn: UProblem? = null
            var attempt = 0
            while (attempt < 60 && made == null) {
                val a = attempt
                attempt += 1
                val template = if (useReview && a < 30) review[(reviewIndex + a) % review.size] else main[(mainIndex + a) % main.size]
                val drawLevel = maxOf(1, minOf(3, level - (if (a > 40) 1 else 0)))
                val problem = template.make(drawLevel, gen) ?: continue
                if (!seenKeys.add(problem.key)) continue
                made = exercise(problem, id, node, slot, count, gen)
                if (made == null) seenKeys.remove(problem.key) else drawn = problem
            }
            if (useReview) reviewIndex += 1 else mainIndex += 1
            exercises.add(made)
            problems.add(drawn)
        }
        balance(exercises, problems, node, count, gen)
        return Exercises.arrange(exercises, count)
    }

    fun levelFor(node: CourseNode, slot: Int, count: Int): Int {
        val t = slot.toDouble() / maxOf(count - 1, 1).toDouble()
        return when (node.kind) {
            NodeKind.LESSON -> when (node.index) {
                1 -> if (t < 0.6) 1 else 2
                2 -> if (t < 0.3) 1 else (if (t < 0.75) 2 else 3)
                else -> if (t < 0.3) 2 else 3
            }
            NodeKind.PRACTICE -> if (t < 0.35) 2 else 3
            else -> if (t < 0.25) 2 else 3
        }
    }

    fun typedChance(node: CourseNode): Double = when (node.kind) {
        NodeKind.LESSON -> if (node.index == 1) 0.4 else (if (node.index == 2) 0.5 else 0.6)
        NodeKind.PRACTICE -> 0.5
        else -> 0.6
    }

    /** Makes sure a node has typed and chosen answers: turns one question into the missing form when a draw went one-sided. */
    fun balance(exercises: MutableList<LearnExercise?>, problems: List<UProblem?>, node: CourseNode, count: Int, gen: UGen) {
        val kinds = exercises.mapNotNull { it?.kind }.toSet()
        val wantTyped = ExerciseKind.TYPE_ANSWER !in kinds
        if (!(wantTyped || ExerciseKind.MULTIPLE_CHOICE !in kinds)) return
        for (index in exercises.indices.reversed()) {
            val old = exercises[index] ?: continue
            val problem = problems[index] ?: continue
            if (if (wantTyped) (problem.number == null || !problem.typedAllowed) else !problem.canChoice) continue
            val rebuilt = exercise(problem, old.id, node, index, count, gen, wantTyped)
            if (rebuilt != null) {
                exercises[index] = rebuilt
                return
            }
        }
    }

    fun exercise(problem: UProblem, id: String, node: CourseNode, slot: Int, count: Int, gen: UGen, force: Boolean? = null): LearnExercise? {
        var wantTyped = problem.number != null && problem.typedAllowed && gen.chance(typedChance(node))
        if (slot == 0 && problem.canChoice) wantTyped = false
        if (slot == count - 1 && problem.number != null && problem.typedAllowed) wantTyped = true
        if (!problem.canChoice) wantTyped = true
        if (force != null) wantTyped = force
        if (wantTyped) {
            val number = problem.number
            if (number == null || !problem.typedAllowed) return null
            val alternatives = mutableListOf<String>()
            if (!number.isInt) alternatives.add(number.fraction)
            val hint = if (problem.hint.isEmpty()) "" else " " + problem.hint
            return Exercises.typed(
                id = id, prompt = problem.prompt + hint, answer = number.typed, alternatives = alternatives, mode = AnswerMode.NUMBER,
                solution = problem.solution, explanation = problem.explanation,
            )
        }
        return gen.withRandom { rng ->
            Exercises.choice(
                id = id, prompt = problem.prompt, correct = problem.correct, wrong = problem.wrong, solution = problem.solution,
                explanation = problem.explanation, random = rng,
            )
        }
    }
}
