package de.maxifrz.lernwerk.learn.musiccourse

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
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Test

/** The Kotlin music course against what the Swift engine builds: content/fixtures/courses/music.json. */
class MusicFixtureTest {
    private val fixture: JsonObject by lazy { readJson(TestPaths.content("fixtures/courses/music.json")).jsonObject }
    private val provider: CourseProvider = musicProvider

    private fun strings(list: List<String>) = JsonArray(list.map { JsonPrimitive(it) })

    private fun flattenMedia(m: ExerciseMedia?): JsonElement = when (m) {
        null -> JsonNull
        is ExerciseMedia.Speech -> buildJsonObject { put("type", "speech"); put("text", m.text); put("language", m.language) }
        is ExerciseMedia.Board -> buildJsonObject {
            put("type", "board"); put("fen", m.board.fen); put("flipped", m.board.flipped); put("marked", strings(m.board.marked))
        }
        is ExerciseMedia.Tones -> buildJsonObject {
            put("type", "tones")
            put("midi", JsonArray(m.tones.midi.map { JsonPrimitive(it) }))
            put("together", m.tones.together)
        }
        is ExerciseMedia.Staff -> buildJsonObject {
            put("type", "staff")
            put("clef", m.staff.clef.raw)
            put("keySignature", m.staff.keySignature)
            put("time", m.staff.time?.let { JsonPrimitive(it) } ?: JsonNull)
            put("chord", m.staff.chord)
            put(
                "notes",
                JsonArray(
                    m.staff.notes.map { n ->
                        buildJsonObject {
                            put("letter", n.pitch.letter); put("octave", n.pitch.octave); put("alteration", n.pitch.alteration)
                            put("value", n.value.raw); put("rest", n.isRest)
                        }
                    },
                ),
            )
        }
    }

    private fun flatten(e: LearnExercise): JsonObject = buildJsonObject {
        put("id", e.id)
        put("kind", e.kind.raw)
        put("cardKeys", strings(e.cardKeys))
        put("prompt", e.prompt)
        put("correctAnswers", strings(e.correctAnswers))
        put("options", strings(e.options))
        put(
            "pairs",
            JsonArray(e.pairs.map { p -> buildJsonObject { put("key", p.key); put("front", p.front); put("back", p.back) } }),
        )
        put("solution", e.solution)
        put("media", flattenMedia(e.media))
        put("mode", e.mode.raw)
        put("explanation", e.explanation)
        put("skill", e.skill)
        put("level", e.level?.raw?.let { JsonPrimitive(it) } ?: JsonNull)
        put("hints", strings(e.hints))
        put("coach", e.coach)
    }

    private fun strs(e: JsonElement) = e.jsonArray.map { it.jsonPrimitive.content }

    @Test fun structureAndSkillMapMatchSwift() {
        val c = provider.course
        assertEquals(fixture["course"]!!.jsonPrimitive.content, c.id)
        assertEquals(fixture["title"]!!.jsonPrimitive.content, c.title)
        assertEquals(fixture["subtitle"]!!.jsonPrimitive.content, c.subtitle)
        assertEquals(fixture["kind"]!!.jsonPrimitive.content, c.kind.raw)
        assertEquals(fixture["color"]!!.jsonPrimitive.int, c.color)
        assertEquals(fixture["symbol"]!!.jsonPrimitive.content, c.symbol)
        val sections = fixture["sections"]!!.jsonArray
        assertEquals(sections.size, c.sections.size)
        for ((s, js) in c.sections.zip(sections)) {
            assertEquals(js.jsonObject["id"]!!.jsonPrimitive.content, s.id)
            assertEquals(js.jsonObject["title"]!!.jsonPrimitive.content, s.title)
            val units = js.jsonObject["units"]!!.jsonArray
            assertEquals(units.size, s.units.size)
            for ((u, ju) in s.units.zip(units)) {
                val o = ju.jsonObject
                assertEquals(o["id"]!!.jsonPrimitive.content, u.id)
                assertEquals(o["number"]!!.jsonPrimitive.int, u.number)
                assertEquals(o["title"]!!.jsonPrimitive.content, u.title)
                assertEquals(o["summary"]!!.jsonPrimitive.content, u.summary)
                assertEquals(o["tip"]!!.jsonPrimitive.content, u.tip)
                val nodes = o["nodes"]!!.jsonArray
                assertEquals(nodes.size, u.nodes.size)
                for ((n, jn) in u.nodes.zip(nodes)) {
                    assertEquals(jn.jsonObject["id"]!!.jsonPrimitive.content, n.id)
                    assertEquals(jn.jsonObject["kind"]!!.jsonPrimitive.content, n.kind.raw)
                    assertEquals(jn.jsonObject["index"]!!.jsonPrimitive.int, n.index)
                    assertEquals(jn.jsonObject["title"]!!.jsonPrimitive.content, n.title)
                }
            }
        }
        val skills = fixture["skills"]!!.jsonArray
        val map = provider.skillMap().skills
        assertEquals(skills.size, map.size)
        for ((s, js) in map.zip(skills)) {
            val o = js.jsonObject
            assertEquals(o["id"]!!.jsonPrimitive.content, s.id)
            assertEquals(o["title"]!!.jsonPrimitive.content, s.title)
            assertEquals(o["goal"]!!.jsonPrimitive.content, s.goal)
            assertEquals(strs(o["levels"]!!), s.levels.map { it.raw })
            assertEquals(strs(o["prerequisites"]!!), s.prerequisites)
            assertEquals(strs(o["nodeIDs"]!!), s.nodeIDs)
        }
    }

    private fun compareUnit(unit: String) {
        var compared = 0
        for (entry in fixture["nodes"]!!.jsonArray) {
            val id = entry.jsonObject["id"]!!.jsonPrimitive.content
            if (!id.startsWith("music.$unit.")) continue
            val node = provider.course.nodes.first { it.id == id }
            for (run in entry.jsonObject["runs"]!!.jsonArray) {
                val seed = run.jsonObject["seed"]!!.jsonPrimitive.content.toULong()
                val made = provider.lessonExercises(node, seed).map { flatten(it) }
                val expected = run.jsonObject["exercises"]!!.jsonArray.map { it.jsonObject }
                assertEquals("$id seed $seed: count", expected.size, made.size)
                for (i in expected.indices) assertEquals("$id seed $seed exercise $i", expected[i], made[i])
                compared++
            }
        }
        assertEquals("runs compared in $unit", 10, compared)
    }

    @Test fun unit01MatchesSwift() = compareUnit("u01")
    @Test fun unit02MatchesSwift() = compareUnit("u02")
    @Test fun unit03MatchesSwift() = compareUnit("u03")
    @Test fun unit04MatchesSwift() = compareUnit("u04")
    @Test fun unit05MatchesSwift() = compareUnit("u05")
    @Test fun unit06MatchesSwift() = compareUnit("u06")
    @Test fun unit07MatchesSwift() = compareUnit("u07")
    @Test fun unit08MatchesSwift() = compareUnit("u08")
}
