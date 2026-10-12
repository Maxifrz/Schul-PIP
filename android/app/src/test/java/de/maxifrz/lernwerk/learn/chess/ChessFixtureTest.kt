package de.maxifrz.lernwerk.learn.chess

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin engine against the Swift engine: content/fixtures/chess-engine.json holds, for every curated position of
 * ChessSamples.swift and every FEN of the Swift chess tests, what Swift computes.
 */
class ChessFixtureTest {
    private val entries: List<JsonObject> by lazy {
        val text = repoFile("content/fixtures/chess-engine.json").readText()
        Json.parseToJsonElement(text).jsonObject["positions"]!!.jsonArray.map { it.jsonObject }
    }

    private fun strings(element: JsonElement?): List<String> = element!!.jsonArray.map { it.jsonPrimitive.content }

    private fun JsonObject.str(key: String) = this[key]!!.jsonPrimitive.content
    private fun JsonObject.bool(key: String) = this[key]!!.jsonPrimitive.content.toBoolean()

    @Test fun hasTheCuratedPositionsAndTheInvalidOnes() {
        assertTrue(entries.size > 200)
        assertTrue(entries.any { !it.bool("valid") })
    }

    @Test fun rejectsTheFensThatSwiftRejects() {
        for (entry in entries.filter { !it.bool("valid") }) assertNull(entry.str("input"), ChessPosition.fromFen(entry.str("input")))
    }

    @Test fun matchesSwiftOnEveryPosition() {
        for (entry in entries.filter { it.bool("valid") }) {
            val label = "${entry.str("input")} [${strings(entry["sources"]).firstOrNull()}]"
            val p = ChessPosition.fromFen(entry.str("input"))
            assertTrue(label, p != null)
            p!!
            assertEquals(label, entry.str("fen"), p.fen)
            assertEquals("legal moves of $label", strings(entry["legal"]), p.legalMoves().map { it.uci })
            assertEquals("san of $label", strings(entry["san"]), ChessNotation.allSAN(p).map { it.san })
            assertEquals(label, entry.bool("isCheck"), p.isCheck)
            assertEquals(label, entry.bool("isCheckmate"), p.isCheckmate)
            assertEquals(label, entry.bool("isStalemate"), p.isStalemate)
            assertEquals(label, entry.bool("insufficientMaterial"), p.hasInsufficientMaterial)
            assertEquals(label, strings(entry["problems"]), p.validationProblems())
            assertEquals(label, entry["material"]!!.jsonArray.map { it.jsonPrimitive.int }, listOf(p.material(ChessColor.WHITE), p.material(ChessColor.BLACK)))
            assertEquals(label, entry["perft2"]!!.jsonPrimitive.content.toLong(), p.perft(2))
            assertEquals("mate in one of $label", strings(entry["mateInOne"]), ChessGoals.accepted(ChessGoal.MateInOne, p).map { it.uci })
            val captures = entry["captures"]!!.jsonArray.map { it.jsonObject.str("move") to it.jsonObject["gain"]!!.jsonPrimitive.int }
            assertEquals("captures of $label", captures, ChessExchange.captures(p).map { it.move.uci to it.gain })
            assertEquals("best capture of $label", strings(entry["bestCapture"]), ChessGoals.accepted(ChessGoal.BestCapture, p).map { it.uci })
            val tactics = entry["tactics"]!!.jsonObject
            for ((color, name) in listOf(ChessColor.WHITE to "white", ChessColor.BLACK to "black")) {
                val expected = tactics[name]!!.jsonObject
                fun lists(key: String) = expected[key]!!.jsonArray.map { strings(it) }
                assertEquals("pins $name $label", lists("pins"), ChessTactics.absolutePins(color, p).map { listOf(it.pinned.name, it.pinner.name) })
                assertEquals(
                    "line-ups $name $label", lists("lineUps"),
                    ChessTactics.lineUps(color, p).map { listOf(it.attacker.name, it.front.name, it.back.name) },
                )
                assertEquals("hanging $name $label", strings(expected["hanging"]), ChessTactics.hangingPieces(color, p).map { it.name })
            }
        }
    }

    @Test fun matchesSwiftOnTheSearch() {
        for (entry in entries.filter { it.bool("valid") }) {
            val label = "${entry.str("input")} [${strings(entry["sources"]).firstOrNull()}]"
            val p = ChessPosition.fromFen(entry.str("input"))!!
            for (depth in 1..3) {
                val result = ChessSearch.bestMoves(p, depth)
                val expected = entry["bestMoves"]!!.jsonObject[depth.toString()]!!.jsonObject
                assertEquals("best moves depth $depth of $label", strings(expected["moves"]), result.moves.map { it.uci })
                assertEquals("best score depth $depth of $label", expected["score"]!!.jsonPrimitive.int, result.score)
            }
            val scored = entry["scored2"]!!.jsonArray.map { it.jsonObject.str("move") to it.jsonObject["score"]!!.jsonPrimitive.int }
            assertEquals("scored depth 2 of $label", scored, ChessSearch.scoredMoves(p, 2).map { it.move.uci to it.score })
            assertEquals("value depth 3 of $label", entry["value3"]!!.jsonPrimitive.int, ChessSearch.value(p, 3))
        }
    }
}
