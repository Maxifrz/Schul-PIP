package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.TestPaths
import de.maxifrz.lernwerk.learn.readJson
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

// Compares the Kotlin chess course with what the Swift engine builds (content/fixtures/courses/chess.json, written by
// scripts/learn-swift/export.sh): structure, skill map, and every exercise of every non-chest step for seeds 1 and 7,
// field by field, hints and coach tags included.

private fun strings(list: List<String>): JsonArray = buildJsonArray { list.forEach { add(JsonPrimitive(it)) } }

/** An exercise in the shape of the Swift export (media flat). */
private fun flatten(e: LearnExercise): JsonObject = buildJsonObject {
    put("id", e.id)
    put("kind", e.kind.raw)
    put("cardKeys", strings(e.cardKeys))
    put("prompt", e.prompt)
    put("correctAnswers", strings(e.correctAnswers))
    put("options", strings(e.options))
    put("pairs", buildJsonArray {
        for (p in e.pairs) add(buildJsonObject { put("key", p.key); put("front", p.front); put("back", p.back) })
    })
    put("solution", e.solution)
    put("media", when (val m = e.media) {
        null -> JsonNull
        is ExerciseMedia.Board -> buildJsonObject {
            put("type", "board"); put("fen", m.board.fen); put("flipped", m.board.flipped); put("marked", strings(m.board.marked))
        }
        else -> throw AssertionError("${e.id}: the chess course has only board media")
    })
    put("mode", e.mode.raw)
    put("explanation", e.explanation)
    put("skill", e.skill)
    put("level", e.level?.let { JsonPrimitive(it.raw) } ?: JsonNull)
    put("hints", strings(e.hints))
    put("coach", e.coach)
}

class ChessCourseFixtureTest {
    private val provider: CourseProvider = chessProvider
    private val fixture = readJson(TestPaths.content("fixtures/courses/chess.json")).jsonObject

    @Test
    fun structureAndSkillMapMatch() {
        val c = provider.course
        val head = buildJsonObject {
            put("course", c.id); put("title", c.title); put("subtitle", c.subtitle); put("kind", c.kind.raw)
            put("color", c.color); put("symbol", c.symbol)
        }
        for (key in head.keys) assertEquals(key, fixture[key], head[key])
        val sections = buildJsonArray {
            for (s in c.sections) add(buildJsonObject {
                put("id", s.id); put("title", s.title)
                put("units", buildJsonArray {
                    for (u in s.units) add(buildJsonObject {
                        put("id", u.id); put("number", u.number); put("title", u.title); put("summary", u.summary); put("tip", u.tip)
                        put("nodes", buildJsonArray {
                            for (n in u.nodes) add(buildJsonObject { put("id", n.id); put("kind", n.kind.raw); put("index", n.index); put("title", n.title) })
                        })
                    })
                })
            })
        }
        assertEquals(fixture["sections"], sections)
        val skills = buildJsonArray {
            for (s in provider.skillMap().skills) add(buildJsonObject {
                put("id", s.id); put("title", s.title); put("goal", s.goal)
                put("levels", strings(s.levels.map { it.raw })); put("prerequisites", strings(s.prerequisites)); put("nodeIDs", strings(s.nodeIDs))
            })
        }
        assertEquals(fixture["skills"], skills)
    }

    @Test
    fun exercisesOfEveryNodeForSeeds1And7Match() {
        val entries = fixture["nodes"]!!.jsonArray.map { it.jsonObject }
        assertEquals(40, entries.size)
        for (entry in entries) {
            val id = entry["id"]!!.jsonPrimitive.content
            val node: CourseNode = assertNotNullNode(id)
            for (run in entry["runs"]!!.jsonArray.map { it.jsonObject }) {
                val seed = run["seed"]!!.jsonPrimitive.content.toULong()
                val expected = run["exercises"]!!.jsonArray
                val made = provider.lessonExercises(node, seed).map { flatten(it) }
                assertEquals("$id seed $seed: count", expected.size, made.size)
                for (i in made.indices) assertEquals("$id seed $seed #$i (${expected[i].jsonObject["id"]})", expected[i], made[i])
            }
        }
    }

    private fun assertNotNullNode(id: String): CourseNode {
        val node = provider.course.node(id)
        assertNotNull("node $id", node)
        return node!!
    }
}
