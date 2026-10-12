package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.ExerciseOutcome
import de.maxifrz.lernwerk.learn.skills.SkillAssessor
import de.maxifrz.lernwerk.learn.skills.SkillMap
import de.maxifrz.lernwerk.learn.skills.SkillRecord
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Persistence of the learning state. The storage itself is injected (`KeyValueStore`: SharedPreferences in the app, a
// map in tests); the keys and the JSON are those of the iOS app's UserDefaults. Broken or missing data starts empty.
// A port of LearnProgressStore, QuestStore and SkillStore/SkillProgress/SkillMaps.

/** Where the state is kept: `get` returns null for a missing key. */
interface KeyValueStore {
    fun get(key: String): String?
    fun set(key: String, value: String)
}

/** A store in memory, for tests and for places without storage. */
class MemoryStore : KeyValueStore {
    val values = LinkedHashMap<String, String>()
    override fun get(key: String): String? = values[key]
    override fun set(key: String, value: String) {
        values[key] = value
    }
}

private fun readJson(store: KeyValueStore, key: String): JsonElement? {
    val text = try { store.get(key) } catch (e: Exception) { null }
    return parseJsonOrNull(text)
}

private fun writeJson(store: KeyValueStore, key: String, value: JsonElement) {
    try { store.set(key, value.toString()) } catch (e: Exception) { /* the state stays in memory */ }
}

open class Observable {
    private val listeners = LinkedHashSet<() -> Unit>()

    /** Calls `listener` after every change; returns the function that stops it. */
    fun subscribe(listener: () -> Unit): () -> Unit {
        listeners.add(listener)
        return { listeners.remove(listener) }
    }

    protected fun emit() {
        for (listener in listeners.toList()) listener()
    }
}

/** The Lernpfad's progress in a key-value store. */
class LearnProgressStore(private val storage: KeyValueStore) : Observable() {
    var progress: LearnProgress = LearnProgress.fromJson(readJson(storage, KEY))
        private set

    fun setDailyGoal(goal: Int) {
        progress.setDailyGoal(goal)
        save()
    }

    /** Counts a finished lesson once; null if this run was counted before or had no exercise. */
    fun record(result: LessonResult, now: Long, calendar: LearnCalendar, courseID: String? = null, completes: Boolean = true): Reward? {
        val updated = progress.copy()
        val reward = updated.record(result, now, calendar, courseID, completes) ?: return null
        progress = updated
        save()
        return reward
    }

    fun complete(nodeIDs: Collection<String>) {
        val updated = progress.copy()
        updated.complete(nodeIDs)
        if (updated == progress) return
        progress = updated
        save()
    }

    /** Opens a chest once and pays its gems; false if it was open already. */
    fun openChest(nodeID: String, gems: Int): Boolean {
        val updated = progress.copy()
        if (!updated.openChest(nodeID, gems)) return false
        progress = updated
        save()
        return true
    }

    fun addGems(amount: Int) {
        if (amount <= 0) return
        progress.addGems(amount)
        save()
    }

    fun buyFreeze(): Boolean {
        val updated = progress.copy()
        if (!updated.buyFreeze()) return false
        progress = updated
        save()
        return true
    }

    private fun save() {
        writeJson(storage, KEY, progress.toJson())
        emit()
    }

    companion object {
        const val KEY = "learn.progress"
        val key get() = KEY
    }
}

/** The quests in a key-value store, like `LearnProgressStore`. */
class QuestStore(private val storage: KeyValueStore) : Observable() {
    var board: QuestBoard = QuestBoard.fromJson(readJson(storage, KEY))
        private set

    /** Starts today's quests if the day has changed. */
    fun refresh(now: Long, calendar: LearnCalendar) {
        val updated = board.copy()
        updated.refresh(now, calendar)
        if (updated == board) return
        board = updated
        save()
    }

    /** Counts a finished round; the quests it completed. */
    fun record(event: QuestEvent, now: Long, calendar: LearnCalendar): List<Quest> {
        val updated = board.copy()
        val finished = updated.apply(event, now, calendar)
        board = updated
        save()
        return finished
    }

    /** Claims a quest (or the day's bonus with `QuestStore.bonusID`); the gems to pay out. */
    fun claim(id: String): Int {
        val updated = board.copy()
        val gems = if (id == bonusID) updated.claimBonus() else updated.claim(id)
        if (gems <= 0) return 0
        board = updated
        save()
        return gems
    }

    private fun save() {
        writeJson(storage, KEY, board.toJson())
        emit()
    }

    companion object {
        const val KEY = "learn.quests"
        const val bonusID = BONUS_ID
        val key get() = KEY
    }
}

/** Every skill's record, saved as one value. A record whose skill no longer exists is simply never read. */
class SkillProgress {
    var records: MutableMap<String, SkillRecord> = LinkedHashMap()

    fun copy(): SkillProgress {
        val p = SkillProgress()
        for ((k, v) in records) p.records[k] = v.copy()
        return p
    }

    fun toJson(): JsonObject = buildJsonObject {
        put("records", JsonObject(records.keys.sorted().associateWith { records.getValue(it).toJson() }))
    }

    override fun equals(other: Any?): Boolean = other is SkillProgress && toJson() == other.toJson()
    override fun hashCode(): Int = toJson().hashCode()

    companion object {
        fun fromJson(json: JsonElement?): SkillProgress {
            val p = SkillProgress()
            val o = json as? JsonObject ?: return p
            p.records = LinkedHashMap(o.field("records", dRecord(SkillRecord.decode), emptyMap()))
            return p
        }
    }
}

/** The skill maps of the registered courses, built once. */
object SkillMaps {
    private val cache = java.util.concurrent.ConcurrentHashMap<String, SkillMap>()

    fun map(provider: CourseProvider): SkillMap = cache.getOrPut(provider.course.id) { provider.skillMap() }

    /** For tests, or after a course changed. */
    fun clear() = cache.clear()
}

/** The skills in a key-value store, like `LearnProgressStore`. */
class SkillStore(private val storage: KeyValueStore) : Observable() {
    var progress: SkillProgress = SkillProgress.fromJson(readJson(storage, KEY))
        private set

    val records: Map<String, SkillRecord> get() = progress.records

    /** A step was opened. */
    fun begin(node: CourseNode, map: SkillMap) {
        val updated = progress.copy()
        SkillAssessor.begin(node, map, updated.records)
        if (updated == progress) return
        progress = updated
        save()
    }

    /** Counts a finished round once; the caller has already made sure the run is new. */
    fun record(outcomes: List<ExerciseOutcome>, node: CourseNode?, map: SkillMap, now: Long, calendar: LearnCalendar) {
        val updated = progress.copy()
        SkillAssessor.record(outcomes, node, map, updated.records, now, calendar)
        if (updated == progress) return
        progress = updated
        save()
    }

    private fun save() {
        writeJson(storage, KEY, progress.toJson())
        emit()
    }

    companion object {
        const val KEY = "learn.skills"
        val key get() = KEY
    }
}
