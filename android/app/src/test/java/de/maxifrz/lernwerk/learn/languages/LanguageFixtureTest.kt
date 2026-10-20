package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.TestPaths
import kotlinx.serialization.json.Json
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
import org.junit.Test

/** Byte-exact comparison with the Swift engine: structure, skill map and every exercise of every step (seeds 1 and 7). */
class LanguageFixtureTest {
    private fun strings(list: List<String>): JsonArray = JsonArray(list.map { JsonPrimitive(it) })

    private fun flatten(e: LearnExercise): JsonObject = buildJsonObject {
        put("id", e.id); put("kind", e.kind.raw); put("cardKeys", strings(e.cardKeys)); put("prompt", e.prompt)
        put("correctAnswers", strings(e.correctAnswers)); put("options", strings(e.options))
        put("pairs", JsonArray(e.pairs.map { p -> buildJsonObject { put("key", p.key); put("front", p.front); put("back", p.back) } }))
        put("solution", e.solution)
        val m = e.media
        put(
            "media",
            when (m) {
                null -> JsonNull
                is ExerciseMedia.Speech -> buildJsonObject { put("type", "speech"); put("text", m.text); put("language", m.language) }
                else -> error("media")
            },
        )
        put("mode", e.mode.raw); put("explanation", e.explanation); put("skill", e.skill)
        put("level", e.level?.raw?.let { JsonPrimitive(it) } ?: JsonNull)
        put("hints", strings(e.hints)); put("coach", e.coach)
    }

    private fun fixture(id: String): JsonObject = Json.parseToJsonElement(TestPaths.content("fixtures/courses/$id.json").readText()).jsonObject

    private fun str(e: JsonElement?) = e!!.jsonPrimitive.content

    private fun structure(provider: CourseProvider) {
        val fx = fixture(provider.course.id)
        val c = provider.course
        assertEquals(str(fx["course"]), c.id)
        assertEquals(str(fx["title"]), c.title)
        assertEquals(str(fx["subtitle"]), c.subtitle)
        assertEquals(str(fx["kind"]), c.kind.raw)
        assertEquals(fx["color"]!!.jsonPrimitive.int, c.color)
        assertEquals(str(fx["symbol"]), c.symbol)
        val sections = fx["sections"]!!.jsonArray
        assertEquals(sections.size, c.sections.size)
        sections.forEachIndexed { si, sj ->
            val s = c.sections[si]; val so = sj.jsonObject
            assertEquals(str(so["id"]), s.id); assertEquals(str(so["title"]), s.title)
            val units = so["units"]!!.jsonArray
            assertEquals(units.size, s.units.size)
            units.forEachIndexed { ui, uj ->
                val u = s.units[ui]; val uo = uj.jsonObject
                assertEquals(str(uo["id"]), u.id); assertEquals(uo["number"]!!.jsonPrimitive.int, u.number)
                assertEquals(str(uo["title"]), u.title); assertEquals(str(uo["summary"]), u.summary); assertEquals(str(uo["tip"]), u.tip)
                val nodes = uo["nodes"]!!.jsonArray
                assertEquals("nodes of ${u.id}", nodes.size, u.nodes.size)
                nodes.forEachIndexed { ni, nj ->
                    val n = u.nodes[ni]; val no = nj.jsonObject
                    assertEquals(str(no["id"]), n.id); assertEquals(str(no["kind"]), n.kind.raw)
                    assertEquals(no["index"]!!.jsonPrimitive.int, n.index); assertEquals(str(no["title"]), n.title)
                }
            }
        }
        val skills = fx["skills"]!!.jsonArray
        val map = provider.skillMap().skills
        assertEquals(skills.size, map.size)
        skills.forEachIndexed { i, sj ->
            val so = sj.jsonObject; val s = map[i]
            assertEquals(str(so["id"]), s.id); assertEquals(str(so["title"]), s.title); assertEquals(str(so["goal"]), s.goal)
            assertEquals(so["levels"]!!.jsonArray.map { str(it) }, s.levels.map { it.raw })
            assertEquals(so["prerequisites"]!!.jsonArray.map { str(it) }, s.prerequisites)
            assertEquals(so["nodeIDs"]!!.jsonArray.map { str(it) }, s.nodeIDs)
        }
    }

    private fun exercises(provider: CourseProvider) {
        val fx = fixture(provider.course.id)
        for (entry in fx["nodes"]!!.jsonArray) {
            val eo = entry.jsonObject
            val node = provider.course.nodes.first { it.id == str(eo["id"]) }
            for (run in eo["runs"]!!.jsonArray) {
                val ro = run.jsonObject
                val seed = ro["seed"]!!.jsonPrimitive.content.toULong()
                val made = provider.lessonExercises(node, seed).map { flatten(it) }
                val expected = ro["exercises"]!!.jsonArray
                assertEquals("${node.id} seed $seed count", expected.size, made.size)
                made.forEachIndexed { i, m -> assertEquals("${node.id} seed $seed #$i", expected[i], m) }
            }
        }
    }

    @Test fun esStructure() = structure(Languages.es)
    @Test fun frStructure() = structure(Languages.fr)
    @Test fun laStructure() = structure(Languages.la)
    @Test fun dafStructure() = structure(Languages.daf)
    @Test fun deStructure() = structure(Languages.de)
    @Test fun esExercises() = exercises(Languages.es)
    @Test fun frExercises() = exercises(Languages.fr)
    @Test fun laExercises() = exercises(Languages.la)
    @Test fun dafExercises() = exercises(Languages.daf)
    @Test fun deExercises() = exercises(Languages.de)
}
