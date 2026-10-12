package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.SkillPractice
import de.maxifrz.lernwerk.learn.skills.SkillRecord
import de.maxifrz.lernwerk.learn.skills.Tally
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

// The exercise factory and the practice rounds against Swift: factoryScenario.json was written by the Swift program
// next to it (a small course built with Exercises.choice/bank/pairs/typed/arrange from seeded LearnRandom, and
// SkillPractice.exercises rounds with and without a weak record). Same seeds, same options, same order.
class FactoryParityTest {
    private val swift = readJson(TestPaths.repo("desktop/test/learn/fixtures/factoryScenario.json")).jsonObject

    private val rich = object : CourseProvider {
        override val course = Course(
            "rich", "Rich", "", CourseKind.LANGUAGE, 0, "x",
            listOf(CourseSection("rich.a", "A", listOf(CourseUnit.standard("rich", 1, "Eins", "s", "t"), CourseUnit.standard("rich", 2, "Zwei", "s", "t")))),
        )

        override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
            if (node.kind == NodeKind.CHEST) return emptyList()
            val rng = LearnRandom(Exercises.seed(node, seed))
            val list = mutableListOf<LearnExercise?>()
            for (i in 0 until 6) list.add(Exercises.choice(id = "${node.id}#c$i", prompt = "?", correct = "A", wrong = listOf("B", "C", "D", "E"), random = rng))
            for (i in 0 until 3) {
                list.add(Exercises.bank(id = "${node.id}#b$i", prompt = "?", words = listOf("Ich", "heiße", "Ana."), extra = listOf("casa", "perro", "gato"), random = rng))
            }
            val items = listOf(PairItem("a", "uno", "eins"), PairItem("b", "dos", "zwei"), PairItem("c", "tres", "drei"), PairItem("d", "cuatro", "vier"))
            list.add(Exercises.pairs(id = "${node.id}#p", items = items, random = rng))
            for (i in 0 until 4) list.add(Exercises.typed(id = "${node.id}#t$i", prompt = "?", answer = "A"))
            return Exercises.arrange(list)
        }
    }

    private fun strs(l: List<String>): JsonElement = JsonArray(l.map { JsonPrimitive(it) })

    private fun view(e: LearnExercise): JsonElement = JsonObject(
        mapOf(
            "id" to JsonPrimitive(e.id),
            "kind" to JsonPrimitive(e.kind.raw),
            "options" to strs(e.options),
            "pairs" to JsonArray(e.pairs.map { strs(listOf(it.key, it.front, it.back)) }),
            "skill" to JsonPrimitive(e.skill),
            "level" to (e.level?.let { JsonPrimitive(it.raw) } ?: JsonNull),
            "correct" to strs(e.correctAnswers),
        ),
    )

    @Test fun lessonsBuiltFromSeedsAreIdentical() {
        val nodes = rich.course.nodes.filter { it.kind != NodeKind.CHEST }.take(4)
        val theirs = swift["exercises"]!!.jsonArray
        for ((s, seed) in listOf(1uL, 2uL, 3uL, 4uL).withIndex()) {
            for ((n, node) in nodes.withIndex()) {
                val ours = rich.exercises(node, seed).map { view(it.copy(skill = "", level = null)) }
                val expected = theirs[s].jsonArray[n].jsonArray.map { e ->
                    JsonObject(e.jsonObject + mapOf("skill" to JsonPrimitive(""), "level" to JsonNull))
                }
                assertEquals("seed $seed node ${node.id}", expected, ours)
            }
        }
    }

    @Test fun practiceRoundsAreIdentical() {
        val map = rich.skillMap()
        val weak = SkillRecord()
        weak.tallies["recall"] = Tally(8, 1, 0, 2.0, listOf(false, false, false, true, false, false, false, false))
        weak.tallies["recognise"] = Tally(8, 8, 0, 8.0, List(8) { true })
        weak.tallies["apply"] = Tally(3, 2, 0, 4.0, listOf(true, false, true))
        val target = map.skills[0].id
        val rounds = swift["rounds"]!!.jsonArray
        for (seed in 1uL..12uL) {
            val round = rounds[(seed - 1uL).toInt()].jsonObject
            assertEquals("plain $seed", round["plain"]!!.jsonArray.toList(), SkillPractice.exercises(rich, map, listOf(target), emptyMap(), seed).map { view(it) })
            val weakSeed = seed * 0x9E3779B97F4A7C15uL
            assertEquals(
                "weak $seed", round["weak"]!!.jsonArray.toList(),
                SkillPractice.exercises(rich, map, listOf(target, map.skills[1].id), mapOf(target to weak), weakSeed).map { view(it) },
            )
        }
        assertEquals(CompetenceLevel.RECALL, CompetenceLevel.RECALL)
    }
}
