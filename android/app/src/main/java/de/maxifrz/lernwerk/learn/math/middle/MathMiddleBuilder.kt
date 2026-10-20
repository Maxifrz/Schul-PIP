package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.ExerciseBuilder
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.PairItem

/**
 * Turns the templates of a unit into the exercises of a node: which template at which difficulty in which form. A
 * lesson teaches the templates of its own third of the unit and reviews the earlier lessons; the practice round mixes
 * the unit's levels with the earlier units; the checkpoint asks every template of the unit at the hard level.
 * A port of MathMiddleBuilder.swift.
 */
object MathMiddleBuilder {
    const val lessonLength = 10
    const val checkpointLength = 12

    /** Typed answers stay below this: a German "1.250" is a thousand to some and a decimal to the answer check. */
    const val typedLimit = 1000

    private class Wish(val template: MathMiddleTemplate, val level: Int, val form: MathMiddleForm)

    fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
        val units = MathMiddleCatalog.units
        if (node.kind == NodeKind.CHEST || node.unitNumber !in 1..units.size) return emptyList()
        val gen = MathMiddleGen(Exercises.seed(node, seed))
        val total = if (node.kind == NodeKind.CHECKPOINT) checkpointLength else lessonLength
        val made = mutableListOf<LearnExercise>()
        val seen = hashSetOf<String>()
        val list = wishes(node, total, gen)
        for (position in list.indices) {
            if (made.size >= total) break
            realize(list[position], position, gen, seen)?.let { made.add(it) }
        }
        return Exercises.arrange(made, total)
    }

    private fun formPattern(total: Int): List<MathMiddleForm> =
        listOf(
            MathMiddleForm.CHOICE, MathMiddleForm.CHOICE, MathMiddleForm.CHOICE, MathMiddleForm.CHOICE,
            MathMiddleForm.CHOICE, MathMiddleForm.PAIRS,
        ) + List(total - 6) { MathMiddleForm.TYPED }

    /** The next template of the list, from the cursor on, that can be put in this form; the cursor moves past it. */
    private fun next(form: MathMiddleForm, list: List<MathMiddleTemplate>, cursor: IntArray): MathMiddleTemplate {
        for (offset in list.indices) {
            val template = list[(cursor[0] + offset) % list.size]
            if (template.forms.contains(form)) {
                cursor[0] += offset + 1
                return template
            }
        }
        cursor[0] += 1
        return list[(cursor[0] - 1) % list.size]
    }

    private fun wishes(node: CourseNode, total: Int, gen: MathMiddleGen): List<Wish> {
        val units = MathMiddleCatalog.units
        val current = units[node.unitNumber - 1]
        val pattern = formPattern(total)
        val backup = total * 3
        val wishes = mutableListOf<Wish>()

        fun form(position: Int): MathMiddleForm =
            if (position < pattern.size) pattern[position]
            else if (position % 2 == 0) MathMiddleForm.TYPED else MathMiddleForm.CHOICE

        when (node.kind) {
            NodeKind.LESSON -> {
                val lesson = node.index
                val mine = gen.shuffled(current.filter { it.lesson == lesson })
                val earlier = gen.shuffled(current.filter { it.lesson < lesson })
                val own = if (mine.isEmpty()) gen.shuffled(current) else mine
                val reviewPositions: Set<Int> = if (lesson >= 2 && earlier.isNotEmpty()) setOf(0, 1, 7) else emptySet()
                val ownCursor = intArrayOf(0)
                val reviewCursor = intArrayOf(0)
                for (position in 0 until backup) {
                    val wanted = form(position)
                    if (position in reviewPositions) {
                        val template = next(wanted, earlier, reviewCursor)
                        wishes.add(Wish(template, maxOf(1, lesson - 1), wanted))
                    } else {
                        val level = minOf(3, maxOf(1, lesson - (if (position < 4) 1 else 0) + (if (position >= 8) 1 else 0)))
                        var template = next(wanted, own, ownCursor)
                        if (wanted == MathMiddleForm.PAIRS && !template.forms.contains(MathMiddleForm.PAIRS)) {
                            val other = earlier.firstOrNull { it.forms.contains(MathMiddleForm.PAIRS) }
                            if (other != null) template = other
                        }
                        wishes.add(Wish(template, level, wanted))
                    }
                }
            }
            NodeKind.PRACTICE -> {
                val own = gen.shuffled(current)
                val before = units.subList(0, node.unitNumber - 1).flatten()
                val reviewPositions: Set<Int> = if (before.isEmpty()) emptySet() else setOf(1, 3, 7, 9)
                val levels = listOf(1, 2, 2, 3, 2, 3, 3, 2, 3, 2)
                val ownCursor = intArrayOf(0)
                for (position in 0 until backup) {
                    val wanted = form(position)
                    if (position in reviewPositions) {
                        val unit = gen.shuffled(units[gen.int(0..(node.unitNumber - 2))])
                        val cursor = intArrayOf(0)
                        val template = next(wanted, unit, cursor)
                        wishes.add(Wish(template, gen.int(1..2), wanted))
                    } else {
                        wishes.add(Wish(next(wanted, own, ownCursor), levels[position % levels.size], wanted))
                    }
                }
            }
            NodeKind.CHECKPOINT -> {
                val own = gen.shuffled(current)
                val cursor = intArrayOf(0)
                for (position in 0 until backup) {
                    val wanted = form(position)
                    val template = if (position < own.size) own[position] else next(wanted, own, cursor)
                    wishes.add(Wish(template, 3, wanted))
                }
            }
            NodeKind.CHEST -> {}
        }
        return wishes
    }

    private fun realize(wish: Wish, position: Int, gen: MathMiddleGen, seen: MutableSet<String>): LearnExercise? {
        val template = wish.template
        var form = wish.form
        if (!template.forms.contains(form)) {
            if (form == MathMiddleForm.PAIRS && template.forms.contains(MathMiddleForm.CHOICE)) {
                form = MathMiddleForm.CHOICE
            } else {
                val other = listOf(MathMiddleForm.TYPED, MathMiddleForm.CHOICE).firstOrNull { template.forms.contains(it) && it != form }
                    ?: return null
                form = other
            }
        }
        val id = "${template.id}.$position"
        if (form == MathMiddleForm.PAIRS) return pairs(template, wish.level, id, gen, seen)
        repeat(24) {
            val problem = template.make(wish.level, gen)
            if (problem == null || seen.contains(problem.key)) return@repeat
            val exercise = exerciseFrom(problem, id, form, gen)
            if (exercise != null) {
                seen.add(problem.key)
                return exercise
            }
        }
        return null
    }

    fun exerciseFrom(problem: MathMiddleProblem, id: String, form: MathMiddleForm, gen: MathMiddleGen): LearnExercise? =
        when (form) {
            MathMiddleForm.CHOICE -> {
                val wrong = gen.shuffled(problem.options)
                if (wrong.size < 2) null
                else Exercises.choice(
                    id = id, prompt = problem.prompt, correct = problem.correct, wrong = wrong, solution = problem.solution,
                    explanation = problem.explanation, random = gen.random,
                )
            }
            MathMiddleForm.TYPED -> {
                val typed = problem.typed
                if (typed == null || !(Math.abs(typed.answer.doubleValue) < typedLimit)) null
                else {
                    val shown = typed.text ?: MathMiddleText.number(MathMiddleQ(typed.answer))
                    Exercises.typed(
                        id = id, prompt = typed.prompt, answer = shown,
                        alternatives = if (shown == typed.answer.fractionText) emptyList() else listOf(typed.answer.fractionText),
                        mode = AnswerMode.NUMBER, solution = problem.solution, explanation = problem.explanation,
                    )
                }
            }
            MathMiddleForm.PAIRS -> null
        }

    /** Four problems of one template as pairs: the fronts differ, and so do the backs. */
    private fun pairs(template: MathMiddleTemplate, level: Int, id: String, gen: MathMiddleGen, seen: MutableSet<String>): LearnExercise? {
        val problems = mutableListOf<MathMiddleProblem>()
        val fronts = hashSetOf<String>()
        val backs = hashSetOf<String>()
        var i = 0
        while (i < 60 && problems.size < ExerciseBuilder.pairCount) {
            i += 1
            val problem = template.make(level, gen) ?: continue
            val front = problem.pairFront ?: continue
            if (seen.contains(problem.key)) continue
            val foldedFront = LearnExercise.folded(front)
            val foldedBack = LearnExercise.folded(problem.correct)
            if (foldedFront.isEmpty() || foldedBack.isEmpty() || foldedFront in fronts || foldedBack in backs) continue
            fronts.add(foldedFront)
            backs.add(foldedBack)
            problems.add(problem)
        }
        if (problems.size != ExerciseBuilder.pairCount) return null
        val items = problems.mapIndexed { offset, p -> PairItem("$id.$offset", p.pairFront ?: "", p.correct) }
        var exercise = Exercises.pairs(id = id, prompt = problems[0].pairPrompt, items = items, random = gen.random)
        if (exercise != null) {
            exercise = exercise.copy(explanation = problems[0].pairExplanation ?: problems[0].explanation)
            problems.forEach { seen.add(it.key) }
        }
        return exercise
    }
}
