package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.data.PlanTopic
import de.maxifrz.lernwerk.data.StudyPlan
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.notify.Reminders
import de.maxifrz.lernwerk.plan.PlanCalendar
import de.maxifrz.lernwerk.plan.PlanReminder
import de.maxifrz.lernwerk.plan.StudyAids
import de.maxifrz.lernwerk.plan.TopicAssistant
import de.maxifrz.lernwerk.plan.TopicDraft
import de.maxifrz.lernwerk.tutor.DemoLlmClient
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

class StudyAidsTest {
    private val today = LocalDate.of(2026, 9, 24)

    private fun topic(title: String, day: LocalDate, order: Int, done: Boolean = false, minutes: Int = 30, query: String = "") = PlanTopic(
        id = "t$order",
        title = title,
        summary = "Du kannst $title.",
        materialId = "m",
        sourcePages = listOf(3, 2),
        estimatedMinutes = minutes,
        order = order,
        scheduledDay = day.toEpochDay(),
        isDone = done,
        videoQuery = query,
    )

    private val plan = StudyPlan(
        id = "p",
        title = "Mathe, Analysis; Teil 1",
        examDay = today.plusDays(10).toEpochDay(),
        minutesPerDay = 60,
        isOverbooked = false,
        topics = listOf(
            topic("Ableiten", today.minusDays(1), 0, minutes = 20),
            topic("Kettenregel", today, 1, query = "Kettenregel einfach erklärt"),
            topic("Produktregel", today, 2, done = true),
            topic("Integrale", today.plusDays(1), 3),
        ),
    )

    @Test
    fun topicsGetPagesVideosAndLenientParsing() {
        val pages = StudyAids.pagesText(plan.topics[0], listOf("eins", "zwei", "  ", "vier"))
        assertEquals("--- Page 2 ---\nzwei", pages)
        assertEquals("", StudyAids.pagesText(plan.topics[0], null))
        assertEquals("Ableiten einfach erklärt", StudyAids.videoQuery(plan.topics[0]))
        assertEquals("https://www.youtube.com/results?search_query=Kettenregel+einfach+erkl%C3%A4rt", StudyAids.videoUrl(plan.topics[1]))

        val exercises = StudyAids.parseExercises("""{"exercises":[{"question":"Q","solution":"S"},{"question":"","solution":"x"},{"question":"R","hint":"H","solution":"T"}]}""")
        assertEquals(listOf("Q", "R"), exercises.map { it.question })
        assertEquals("", exercises[0].hint)
        assertEquals(listOf("A" to "B"), StudyAids.parseFlashcards("""{"cards":[{"front":"A","back":"B"},{"front":"C"}]}""").map { it.front to it.back })
        assertEquals("Kettenregel erklärt", TopicDraft.parseResponse("""{"topics":[{"title":"K","videoQuery":" Kettenregel erklärt "}]}""").single().videoQuery)
    }

    @Test
    fun exercisesAndCardsAreAskedForWithTheTopicsPages() = runTest {
        val client = ScriptedClient(
            mutableListOf(
                """{"exercises":[{"question":"Leite ab","hint":"Kette","solution":"2x"}]}""",
                """{"cards":[{"front":"Regel?","back":"äußere mal innere"}]}""",
            ),
        )
        val assistant = TopicAssistant(client)
        val exercises = assistant.exercises(plan.topics[1], "--- Page 2 ---\nKettenregel")
        val cards = assistant.flashcards(plan.topics[1], "")
        assertEquals("2x", exercises.single().solution)
        assertEquals("äußere mal innere", cards.single().back)
        assertEquals(listOf(LlmPurpose.StudyAid, LlmPurpose.StudyAid), client.requests.map { it.purpose })
        val first = (client.requests[0].messages.single().content.single() as LlmContent.Text).text
        assertTrue(first.contains("Topic: Kettenregel") && first.contains("<pages S. 2–3>") && first.contains("4 exercises"))
        val second = (client.requests[1].messages.single().content.single() as LlmContent.Text).text
        assertTrue(second.contains("flashcards") && !second.contains("<pages"))

        // The demo answers both.
        val demo = TopicAssistant(DemoLlmClient(latencyMillis = 0))
        assertEquals(4, demo.exercises(plan.topics[1], "").size)
        assertTrue(demo.flashcards(plan.topics[1], "").size >= 6)
    }

    @Test
    fun theCalendarHasAnAllDayEventPerTopicAndTheExam() {
        val ics = PlanCalendar.ics(plan, Instant.parse("2026-09-24T08:00:00Z"))
        assertTrue(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"))
        assertTrue(ics.endsWith("END:VCALENDAR\r\n"))
        assertEquals(5, Regex("BEGIN:VEVENT").findAll(ics).count())
        assertTrue(ics.contains("DTSTART;VALUE=DATE:20260923\r\nDTEND;VALUE=DATE:20260924"))
        assertTrue(ics.contains("SUMMARY:Prüfung: Mathe\\, Analysis\\; Teil 1"))
        assertTrue(ics.contains("DTSTAMP:20260924T080000Z"))
        // Every physical line fits into 75 octets.
        assertTrue(ics.split("\r\n").all { it.toByteArray(Charsets.UTF_8).size <= 75 })
        val unfolded = ics.replace("\r\n ", "")
        assertTrue(unfolded.contains("DESCRIPTION:Du kannst Kettenregel.\\n30 Minuten · S. 2–3\\nVideos: https://www.youtube.com/results?search_query=Kettenregel+einfach+erkl%C3%A4rt"))

        assertEquals(listOf("a\\,b\\;c\\\\d\\ne"), listOf(PlanCalendar.escape("a,b;c\\d\ne")))
        val long = "X".repeat(70) + "äöü".repeat(10)
        val folded = PlanCalendar.fold(long)
        assertTrue(folded.size > 1 && folded.drop(1).all { it.startsWith(" ") })
        assertEquals(long, folded.first() + folded.drop(1).joinToString("") { it.drop(1) })
    }

    @Test
    fun theReminderNamesWhatIsOpenToday() {
        val (title, text) = PlanReminder.message(plan, today)!!
        assertEquals("Lernplan: Mathe, Analysis; Teil 1", title)
        assertEquals("Ableiten, Kettenregel · etwa 50 Minuten", text)
        assertEquals(listOf("Ableiten", "Kettenregel"), PlanReminder.due(plan, today).map { it.title })
        assertNull(PlanReminder.message(plan.copy(topics = plan.topics.map { it.copy(isDone = true) }), today))
        assertNull(PlanReminder.message(plan, today.plusDays(11)))
        assertTrue(PlanReminder.message(plan, today.plusDays(10))!!.second.startsWith("Heute ist die Prüfung"))

        val zone = ZoneId.of("Europe/Berlin")
        val morning = ZonedDateTime.of(2026, 9, 24, 9, 0, 0, 0, zone)
        assertEquals(ZonedDateTime.of(2026, 9, 24, 17, 0, 0, 0, zone), Reminders.nextTrigger(17 * 60, morning))
        assertEquals(ZonedDateTime.of(2026, 9, 25, 8, 30, 0, 0, zone), Reminders.nextTrigger(8 * 60 + 30, morning))
    }
}
