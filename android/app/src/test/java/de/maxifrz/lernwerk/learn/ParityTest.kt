package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.ExerciseOutcome
import de.maxifrz.lernwerk.learn.skills.SkillAssessor
import de.maxifrz.lernwerk.learn.skills.SkillRecord
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

// Differential test against the Swift code: learnScenario.json was written by the Swift program next to it (run
// against SkillAssessor, LearnProgress and QuestBoard on Linux), which draws a deterministic scenario from SplitMix:
// 40 days of skill rounds in mixed time zones, and 80 finished rounds with progress, streak, freezes, quests, claims
// and the timer, in mixed zones and first weekdays. This file replays the same draws and compares status, reward,
// finished quests, claims and (every few steps) the whole persisted state.
class ParityTest {
    private val swift = readJson(TestPaths.repo("desktop/test/learn/fixtures/learnScenario.json")).jsonObject
    private val zones = listOf("Europe/Berlin", "Pacific/Auckland", "America/New_York", "UTC", "Asia/Kolkata")
    private var rng = SplitMix(20260312uL)
    private fun pick(n: Int): Int = (rng.next() % n.toULong()).toInt()
    private val sets = setOf("worked", "started", "coursesToday", "completedLessons")

    /** Sorted keys, sets as sorted arrays, numbers as one canonical form (2.0 and 2 are the same). */
    private fun norm(v: JsonElement, key: String = ""): JsonElement = when (v) {
        is JsonObject -> JsonObject(v.keys.sorted().associateWith { norm(v.getValue(it), it) })
        is JsonArray -> {
            val items = v.map { norm(it) }
            when {
                key == "weekDays" -> JsonArray(items.sortedBy { o -> o.jsonObject.let { it["year"]!!.jsonPrimitive.int * 10000 + it["month"]!!.jsonPrimitive.int * 100 + it["day"]!!.jsonPrimitive.int } })
                key in sets -> JsonArray(items.sortedBy { it.jsonPrimitive.content })
                else -> JsonArray(items)
            }
        }
        is JsonNull -> v
        is JsonPrimitive -> if (!v.isString && v.content != "true" && v.content != "false") {
            val d = v.double
            if (d == Math.floor(d) && Math.abs(d) < 1e15) JsonPrimitive(d.toLong()) else JsonPrimitive(d)
        } else v
        else -> v
    }

    @Test fun skillRecordsAndStatusesMatchTheSwiftScenario() {
        rng = SplitMix(20260312uL)
        val provider = SampleCourse()
        val map = provider.skillMap()
        val levels = CompetenceLevel.values()
        val records = mutableMapOf<String, SkillRecord>()
        val base = 1_770_000_000L
        val skillsExpected = swift["skills"]!!.jsonArray
        for (day in 0 until 40) {
            val c = LearnCalendar(zones[pick(zones.size)], 2)
            val rounds = pick(3)
            for (r in 0 until rounds) {
                val now = (base + day * 86400L + pick(80000)) * 1000
                val list = mutableListOf<ExerciseOutcome>()
                val count = pick(16)
                val skill = map.skills[pick(map.skills.size)]
                val accuracy = 40 + pick(61)
                for (i in 0 until count) {
                    val id = "d${day}r${r}e${pick(count + 2)}"
                    val level = levels[pick(3)]
                    val right = pick(100) < accuracy
                    val helped = pick(8) == 0
                    list.add(ExerciseOutcome(id, skill.id, level, right, helped))
                }
                val nodes = provider.course.nodes
                val node = if (pick(4) == 0) null else nodes[pick(nodes.size)]
                SkillAssessor.record(list, node, map, records, now, c)
                if (pick(5) == 0 && node != null) SkillAssessor.begin(node, map, records)
            }
            val now = (base + day * 86400L + 43200) * 1000
            val cb = LearnCalendar("Europe/Berlin", 2)
            val expected = skillsExpected[day].jsonObject
            val statuses = map.skills.associate { it.id to SkillAssessor.status(records[it.id], it, emptySet(), now, cb).raw }
            val expectedStatuses = expected["statuses"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content }
            assertEquals("statuses day $day", expectedStatuses, statuses)
            val expectedRecords = expected["records"]
            if (expectedRecords != null) {
                val p = SkillProgress()
                p.records = records
                assertEquals("records day $day", norm(expectedRecords), norm(p.toJson()))
            }
        }
    }

    private fun replaySkills() {
        val map = SampleCourse().skillMap()
        val nodes = SampleCourse().course.nodes
        for (day in 0 until 40) {
            pick(zones.size)
            val rounds = pick(3)
            for (r in 0 until rounds) {
                pick(80000)
                val count = pick(16)
                pick(map.skills.size)
                pick(61)
                for (i in 0 until count) {
                    pick(count + 2); pick(3); pick(100); pick(8)
                }
                val nodeNil = pick(4) == 0
                if (!nodeNil) pick(nodes.size)
                if (pick(5) == 0 && !nodeNil) { /* begin */ }
            }
        }
    }

    @Test fun progressStreakAndQuestsMatchTheSwiftScenario() {
        rng = SplitMix(20260312uL)
        val base = 1_770_000_000L
        val progress = LearnProgress()
        val board = QuestBoard()
        var t = base
        replaySkills()
        val expected = swift["progress"]!!.jsonArray
        for (i in 0 until 80) {
            t += pick(200_000) - 20_000
            val c = LearnCalendar(zones[pick(zones.size)], listOf(1, 2)[pick(2)])
            val total = pick(14)
            val right = if (total == 0) 0 else pick(total + 1)
            val lessonID = "L${pick(6)}"
            val retry = pick(total - right + 1)
            val result = LessonResult(lessonID, "s$i", total, right, retry)
            if (pick(9) == 0) {
                progress.buyFreeze()
                progress.addGems(pick(40))
            }
            val now = t * 1000
            val courseID = if (pick(3) == 0) null else "c${pick(3)}"
            val completes = pick(4) != 0
            val reward = progress.record(result, now, c, courseID, completes)
            val kinds = listOf(NodeKind.LESSON, NodeKind.PRACTICE, NodeKind.CHECKPOINT, null)
            val evCourse = if (pick(4) == 0) null else "c${pick(3)}"
            val evKind = kinds[pick(4)]
            val finished = board.apply(QuestEvent(reward?.xp ?: 0, evCourse, evKind, right, total), now, c)
            var claimed = 0
            for (q in board.daily.toList()) if (q.progress >= q.target && pick(2) == 0) claimed += board.claim(q.id)
            if (pick(3) == 0) claimed += board.claimBonus()
            val s = expected[i].jsonObject
            val ours: JsonElement = if (reward == null) JsonNull else JsonObject(
                mapOf(
                    "xp" to JsonPrimitive(reward.xp), "xpToday" to JsonPrimitive(reward.xpToday), "goal" to JsonPrimitive(reward.goalReached),
                    "streak" to JsonPrimitive(reward.streak), "ext" to JsonPrimitive(reward.streakExtended), "gems" to JsonPrimitive(reward.gems),
                    "used" to JsonPrimitive(reward.freezesUsed),
                ),
            )
            assertEquals("reward $i", norm(s["reward"]!!), norm(ours))
            assertEquals("finished $i", s["finished"]!!.jsonArray.map { it.jsonPrimitive.content }, finished.map { it.id })
            assertEquals(s["claimed"]!!.jsonPrimitive.int, claimed)
            s["progress"]?.let { assertEquals("progress $i", norm(it), norm(progress.toJson())) }
            s["board"]?.let { assertEquals("board $i", norm(it), norm(board.toJson())) }
            assertEquals(s["streakNow"]!!.jsonPrimitive.int, progress.currentStreak(now, c))
            assertEquals(s["xpToday"]!!.jsonPrimitive.int, progress.xpToday(now, c))
            assertEquals(s["seconds"]!!.jsonPrimitive.double, QuestBoard.secondsUntilNextDay(now, c), 0.001)
        }
        assertEquals(true, JsonPrimitive(true).boolean)
    }
}
