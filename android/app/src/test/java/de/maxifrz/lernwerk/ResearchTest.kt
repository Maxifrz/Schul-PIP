package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.llm.HttpResult
import de.maxifrz.lernwerk.llm.HttpTransport
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.plan.MaterialDocument
import de.maxifrz.lernwerk.present.PresentationAssistant
import de.maxifrz.lernwerk.present.PresentationPrompt
import de.maxifrz.lernwerk.present.SlideDraft
import de.maxifrz.lernwerk.present.SlideLayout
import de.maxifrz.lernwerk.research.Research
import de.maxifrz.lernwerk.research.WebSource
import de.maxifrz.lernwerk.research.WikiText
import de.maxifrz.lernwerk.research.WikipediaClient
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.net.URLDecoder
import java.util.Calendar

/** Answers GET requests whose decoded URL contains a route's key; everything else finds nothing. */
class FakeWeb(private val routes: Map<String, String>) : HttpTransport {
    val urls = mutableListOf<String>()
    val headers = mutableListOf<Map<String, String>>()

    override suspend fun post(url: String, headers: Map<String, String>, body: String, timeoutSeconds: Long): HttpResult =
        error("no POST expected")

    override suspend fun get(url: String, headers: Map<String, String>, timeoutSeconds: Long): HttpResult {
        urls += url
        this.headers += headers
        val decoded = URLDecoder.decode(url, "UTF-8")
        val route = routes.entries.firstOrNull { decoded.contains(it.key) } ?: return HttpResult(200, """{"batchcomplete":true}""")
        return if (route.value == "500") HttpResult(500, "") else HttpResult(200, route.value)
    }
}

class ResearchTest {
    private val chlorophyllSearch = """{"batchcomplete":true,"query":{"pages":[
        {"pageid":2,"ns":0,"title":"Chlorophyll a","index":2,"extract":"Chlorophyll a ist die häufigste Form.","fullurl":"https://de.wikipedia.org/wiki/Chlorophyll_a"},
        {"pageid":1,"ns":0,"title":"Chlorophyll","index":1,"extract":"Chlorophyll ist ein grüner Farbstoff.","fullurl":"https://de.wikipedia.org/wiki/Chlorophyll"},
        {"ns":0,"title":"Fehlt","missing":true}]}}"""
    private val chlorophyllArticle = """{"query":{"pages":[{"pageid":1,"title":"Chlorophyll","extract":"Chlorophyll ist ein grüner Farbstoff. Es absorbiert vor allem rotes und blaues Licht.\n\n\n\nMehr.","fullurl":"https://de.wikipedia.org/wiki/Chlorophyll"}]}}"""
    private val date = Calendar.getInstance().apply { set(2026, Calendar.SEPTEMBER, 24) }.time

    private class FakeDocument(override val pageTexts: List<String>) : MaterialDocument {
        override suspend fun recognizeText(pageNumber: Int) = ""
        override suspend fun pageImage(pageNumber: Int) = byteArrayOf(1)
    }

    @Test
    fun searchKeepsTheRankingAndSkipsMissingPages() = runTest {
        val web = FakeWeb(mapOf("gsrsearch=Chlorophyll Farbstoff" to chlorophyllSearch))
        val hits = WikipediaClient(web).search("Chlorophyll Farbstoff")
        assertEquals(listOf("Chlorophyll", "Chlorophyll a"), hits.map { it.title })
        assertEquals("https://de.wikipedia.org/wiki/Chlorophyll", hits[0].url)
        assertTrue(web.urls.single().startsWith("https://de.wikipedia.org/w/api.php?action=query&generator=search"))
        assertTrue(web.urls.single().contains("gsrsearch=Chlorophyll+Farbstoff"))
        assertTrue(web.headers.single().getValue("User-Agent").startsWith("SchulPip/"))
    }

    @Test
    fun gatheringFetchesTheBestArticleAndSkipsDuplicatesAndFailures() = runTest {
        val web = FakeWeb(
            mapOf(
                "gsrsearch=Chlorophyll" to chlorophyllSearch,
                "titles=Chlorophyll" to chlorophyllArticle,
                "gsrsearch=Kaputt" to "500",
            ),
        )
        val existing = listOf(WebSource("W1", "Chlorophyll a", "https://de.wikipedia.org/wiki/Chlorophyll_a", "schon da"))
        val sources = Research.gather(WikipediaClient(web), listOf("Kaputt", "Chlorophyll", "Chlorophyll", " "), existing)
        assertEquals(listOf("W1", "W2"), sources.map { it.id })
        assertEquals("Chlorophyll", sources[1].title)
        // The best match comes as a longer excerpt, blank lines collapsed.
        assertEquals("Chlorophyll ist ein grüner Farbstoff. Es absorbiert vor allem rotes und blaues Licht.\n\nMehr.", sources[1].text)
        val prompt = Research.prompt(sources)
        assertTrue(prompt.contains("<article id=\"W2\" title=\"Chlorophyll\" url=\"https://de.wikipedia.org/wiki/Chlorophyll\">"))
    }

    @Test
    fun textsAreShortenedAtASentence() {
        assertEquals("Eins. Zwei.", WikiText.shorten("Eins. Zwei. Drei vier fünf sechs.", 20))
        assertEquals("Kurz.", WikiText.shorten("Kurz.", 20))
        assertTrue(WikiText.shorten("x".repeat(50), 20).endsWith("…"))
        assertEquals(
            "https://www.youtube.com/results?search_query=Satz+des+Pythagoras+erkl%C3%A4rt",
            Research.youtubeSearchUrl(" Satz des Pythagoras erklärt "),
        )
    }

    @Test
    fun sourcesAreCitedOnTheSlidesAndTheSourcesSlide() {
        val sources = listOf(
            WebSource("W1", "Chlorophyll", "https://de.wikipedia.org/wiki/Chlorophyll", "…"),
            WebSource("W2", "Licht", "https://de.wikipedia.org/wiki/Licht", "…"),
        )
        val drafts = listOf(
            SlideDraft(SlideLayout.BULLETS, title = "Grün", notes = "Hallo", webSources = listOf("W1", "W9")),
            SlideDraft(SlideLayout.TWO_COLUMNS, title = "Quellen", left = listOf("Skript S. 2"), right = listOf("Wikipedia: Chlorophyll")),
        )
        val cited = PresentationPrompt.citingSources(drafts, sources, listOf("Skript"), date)
        assertEquals("Hallo\n\nQuelle: Wikipedia – „Chlorophyll“", cited[0].notes)
        assertEquals(SlideLayout.BULLETS, cited[1].layout)
        assertEquals(
            listOf("Skript S. 2", "„Chlorophyll“, Wikipedia, de.wikipedia.org/wiki/Chlorophyll (abgerufen am 24.09.2026)"),
            cited[1].bullets,
        )

        // Nobody said what they used: every article is listed, on a sources slide the model forgot.
        val added = PresentationPrompt.citingSources(listOf(SlideDraft(SlideLayout.BULLETS, title = "A")), sources, listOf("Skript"), date)
        assertEquals("Quellen", added.last().title)
        assertEquals(3, added.last().bullets.size)
        assertEquals("Material: Skript", added.last().bullets.first())
    }

    @Test
    fun generationResearchesWhatTheOutlineAsksFor() = runTest {
        val outline = """{"title":"Photosynthese","thesis":"t","research":["Chlorophyll"],"slides":[
            {"role":"core","message":"Blätter sind grün","layout":"BULLETS","content":""},
            {"role":"sources","message":"Quellen","layout":"BULLETS","content":""}]}"""
        val deck = """{"title":"Photosynthese","slides":[
            {"layout":"BULLETS","title":"Blätter sind grün","bullets":["Chlorophyll"],"notes":"Laut Wikipedia …","webSources":["[w1]"]},
            {"layout":"BULLETS","title":"Quellen","bullets":["Skript"],"notes":"n"}]}"""
        val critique = """{"verdict":"V","findings":[]}"""
        val client = ScriptedClient(mutableListOf(outline, deck, critique))
        val web = FakeWeb(mapOf("gsrsearch=Chlorophyll" to chlorophyllSearch, "titles=Chlorophyll" to chlorophyllArticle))
        val stages = mutableListOf<PresentationAssistant.Stage>()
        val presentation = PresentationAssistant(client).generate(
            materials = listOf(PresentationAssistant.Material("m1", "Skript", byteArrayOf(1))),
            topic = "Photosynthese",
            slideCount = 6,
            minutes = 5,
            themeId = "quill",
            openDocument = { FakeDocument(listOf("Pflanzen machen aus Licht Zucker.")) },
            pageImage = { _, _ -> null },
            onStage = { stages += it },
            wikipedia = WikipediaClient(web),
            today = date,
        )
        assertEquals(PresentationAssistant.Stage.entries, stages)
        assertEquals(listOf(LlmPurpose.PresentationOutline, LlmPurpose.Presentation, LlmPurpose.PresentationCritique), client.requests.map { it.purpose })
        assertTrue(client.requests.take(2).all { it.system.contains("webSources") })
        val outlinePrompt = client.requests[0].messages[0].content.filterIsInstance<LlmContent.Text>().joinToString("\n") { it.text }
        assertTrue(outlinePrompt.contains("search terms in research"))
        // The articles arrive with the request for the slides and go to the critic as well.
        val slidesTurn = client.requests[1].messages.last().content.filterIsInstance<LlmContent.Text>()
        assertTrue(slidesTurn.first().text.contains("<article id=\"W1\" title=\"Chlorophyll\""))
        assertTrue(slidesTurn.last().text.contains("webSources"))
        val critic = client.requests[2].messages.single().content.filterIsInstance<LlmContent.Text>().joinToString("\n") { it.text }
        assertTrue(critic.contains("Pflanzen machen") && critic.contains("<article id=\"W1\""))

        assertTrue(presentation.slides[0].notes.endsWith("Quelle: Wikipedia – „Chlorophyll“"))
        val sourcesText = presentation.slides[1].elements.joinToString("\n") { it.text }
        assertTrue(sourcesText.contains("Skript"))
        assertTrue(sourcesText.contains("„Chlorophyll“, Wikipedia, de.wikipedia.org/wiki/Chlorophyll (abgerufen am 24.09.2026)"))
        assertFalse(sourcesText.contains("Chlorophyll a"))
    }

    @Test
    fun withoutMaterialTheTopicIsResearchedFirst() = runTest {
        val outline = """{"title":"Chlorophyll","thesis":"t","slides":[{"role":"core","message":"Grün","layout":"BULLETS","content":""}]}"""
        val deck = """{"title":"Chlorophyll","slides":[{"layout":"BULLETS","title":"Grün","bullets":["x"],"notes":"n","webSources":["W1"]}]}"""
        val client = ScriptedClient(mutableListOf(outline, deck))
        val web = FakeWeb(mapOf("gsrsearch=Chlorophyll" to chlorophyllSearch, "titles=Chlorophyll" to chlorophyllArticle))
        val stages = mutableListOf<PresentationAssistant.Stage>()
        val presentation = PresentationAssistant(client).generate(
            materials = emptyList(),
            topic = "Chlorophyll",
            slideCount = 5,
            minutes = 5,
            themeId = "quill",
            openDocument = { null },
            pageImage = { _, _ -> null },
            review = false,
            onStage = { stages += it },
            wikipedia = WikipediaClient(web),
            today = date,
        )
        assertEquals(listOf(PresentationAssistant.Stage.RESEARCH, PresentationAssistant.Stage.OUTLINE, PresentationAssistant.Stage.SLIDES), stages)
        val first = client.requests[0].messages[0].content.filterIsInstance<LlmContent.Text>().map { it.text }
        assertTrue(first[0].contains("<article id=\"W1\" title=\"Chlorophyll\""))
        assertTrue(first[1].contains("there is no material"))
        // No material titles on the sources slide, only the articles.
        assertEquals(2, presentation.slides.size)
        val sourcesText = presentation.slides.last().elements.joinToString("\n") { it.text }
        assertTrue(sourcesText.contains("„Chlorophyll“, Wikipedia") && !sourcesText.contains("Material:"))

        val nothing = ScriptedClient(mutableListOf())
        try {
            PresentationAssistant(nothing).generate(emptyList(), "Xyzzy", 5, 5, "quill", { null }, { _, _ -> null }, wikipedia = WikipediaClient(FakeWeb(emptyMap())))
            fail("expected NothingFound")
        } catch (expected: PresentationAssistant.NothingFound) {
            assertTrue(expected.message!!.contains("Xyzzy"))
        }
        assertTrue(nothing.requests.isEmpty())
    }
}
