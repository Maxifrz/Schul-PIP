package de.maxifrz.lernwerk.learn.math.upper

import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.TestPaths
import de.maxifrz.lernwerk.learn.readJson
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test

// Byte-exact parity with the Swift engine: structure, skill map and every exercise of every non-chest node for the
// exported seeds 1 and 7 (content/fixtures/courses/matho.json, written by scripts/learn-swift/export.sh).
class UpperFixtureTest {
    private val provider: CourseProvider = mathUpperProvider
    private val fixture = readJson(TestPaths.content("fixtures/courses/matho.json")).jsonObject

    private fun strs(list: List<String>): JsonElement = JsonArray(list.map { JsonPrimitive(it) })

    /** An exercise in the shape of the Swift export (media is flat; this course has none). */
    private fun flatten(e: LearnExercise): JsonElement {
        assertNull("media of ${e.id}", e.media)
        return JsonObject(
            mapOf(
                "id" to JsonPrimitive(e.id), "kind" to JsonPrimitive(e.kind.raw), "cardKeys" to strs(e.cardKeys), "prompt" to JsonPrimitive(e.prompt),
                "correctAnswers" to strs(e.correctAnswers), "options" to strs(e.options),
                "pairs" to JsonArray(e.pairs.map { JsonObject(mapOf("key" to JsonPrimitive(it.key), "front" to JsonPrimitive(it.front), "back" to JsonPrimitive(it.back))) }),
                "solution" to JsonPrimitive(e.solution), "media" to JsonNull, "mode" to JsonPrimitive(e.mode.raw),
                "explanation" to JsonPrimitive(e.explanation), "skill" to JsonPrimitive(e.skill),
                "level" to (e.level?.let { JsonPrimitive(it.raw) } ?: JsonNull), "hints" to strs(e.hints), "coach" to JsonPrimitive(e.coach),
            ),
        )
    }

    @Test fun structureAndSkillMapMatchSwift() {
        val c = provider.course
        assertEquals(fixture["course"]!!.jsonPrimitive.content, c.id)
        assertEquals(fixture["title"]!!.jsonPrimitive.content, c.title)
        assertEquals(fixture["subtitle"]!!.jsonPrimitive.content, c.subtitle)
        assertEquals(fixture["kind"]!!.jsonPrimitive.content, c.kind.raw)
        assertEquals(fixture["color"]!!.jsonPrimitive.content.toInt(), c.color)
        assertEquals(fixture["symbol"]!!.jsonPrimitive.content, c.symbol)
        val sections = JsonArray(
            c.sections.map { s ->
                JsonObject(
                    mapOf(
                        "id" to JsonPrimitive(s.id), "title" to JsonPrimitive(s.title),
                        "units" to JsonArray(
                            s.units.map { u ->
                                JsonObject(
                                    mapOf(
                                        "id" to JsonPrimitive(u.id), "number" to JsonPrimitive(u.number), "title" to JsonPrimitive(u.title),
                                        "summary" to JsonPrimitive(u.summary), "tip" to JsonPrimitive(u.tip),
                                        "nodes" to JsonArray(
                                            u.nodes.map { n ->
                                                JsonObject(mapOf("id" to JsonPrimitive(n.id), "kind" to JsonPrimitive(n.kind.raw), "index" to JsonPrimitive(n.index), "title" to JsonPrimitive(n.title)))
                                            },
                                        ),
                                    ),
                                )
                            },
                        ),
                    ),
                )
            },
        )
        assertEquals(fixture["sections"]!!, sections)
        val skills = JsonArray(
            provider.skillMap().skills.map { s ->
                JsonObject(
                    mapOf(
                        "id" to JsonPrimitive(s.id), "title" to JsonPrimitive(s.title), "goal" to JsonPrimitive(s.goal),
                        "levels" to strs(s.levels.map { it.raw }), "prerequisites" to strs(s.prerequisites), "nodeIDs" to strs(s.nodeIDs),
                    ),
                )
            },
        )
        assertEquals(fixture["skills"]!!, skills)
    }

    @Test fun everyExerciseOfSeedsOneAndSevenMatchesSwift() {
        val entries = fixture["nodes"]!!.jsonArray
        var compared = 0
        val bad = mutableListOf<String>()
        for (entry in entries) {
            val id = entry.jsonObject["id"]!!.jsonPrimitive.content
            val node = provider.course.node(id)
            assertNotNull("node $id", node)
            assertEquals(NodeKind.CHEST == node!!.kind, false)
            for (run in entry.jsonObject["runs"]!!.jsonArray) {
                val seed = run.jsonObject["seed"]!!.jsonPrimitive.content.toULong()
                val made = provider.lessonExercises(node, seed).map { flatten(it) }
                val expected = run.jsonObject["exercises"]!!.jsonArray.toList()
                assertEquals("$id seed $seed: count", expected.size, made.size)
                for (i in expected.indices) if (expected[i] != made[i]) bad.add("$id seed $seed #$i\n  swift: ${expected[i]}\n  kotlin: ${made[i]}")
                compared += made.size
            }
        }
        assertEquals("${bad.size} of $compared exercises differ; first:\n" + bad.map { it.lineSequence().first() }.joinToString(" ; ") + "\n" + bad.take(1).joinToString("\n"), 0, bad.size)
        assert(compared > 300) { "only $compared exercises compared" }
    }
}
