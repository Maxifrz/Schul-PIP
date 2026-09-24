package de.maxifrz.lernwerk.research

import de.maxifrz.lernwerk.llm.HttpTransport
import de.maxifrz.lernwerk.llm.LlmError
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** A Wikipedia article or the start of it: title, link and plain text. */
data class WikiArticle(val title: String, val url: String, val text: String)

/** Reads the German Wikipedia through its public API; no key needed. */
class WikipediaClient(private val transport: HttpTransport, private val language: String = "de") {
    private val api = "https://$language.wikipedia.org/w/api.php"

    /** The best matches for [query] with the introduction of each article, best first. */
    suspend fun search(query: String, limit: Int = 2): List<WikiArticle> {
        if (query.isBlank()) return emptyList()
        val root = get(
            "action" to "query",
            "generator" to "search",
            "gsrsearch" to query.trim(),
            "gsrlimit" to limit.toString(),
            "gsrnamespace" to "0",
            "prop" to "extracts|info",
            "inprop" to "url",
            "exintro" to "1",
            "explaintext" to "1",
            "exlimit" to limit.toString(),
            "redirects" to "1",
        )
        return pages(root).sortedBy { it.second }.map { it.first }.filter { it.text.isNotBlank() }
    }

    /** The article's text up to [maxChars], cut at the end of a sentence. */
    suspend fun article(title: String, maxChars: Int = 3500): WikiArticle? {
        val root = get(
            "action" to "query",
            "titles" to title,
            "prop" to "extracts|info",
            "inprop" to "url",
            "explaintext" to "1",
            "exsectionformat" to "plain",
            "redirects" to "1",
        )
        val article = pages(root).firstOrNull()?.first ?: return null
        return article.copy(text = WikiText.shorten(article.text, maxChars)).takeIf { it.text.isNotBlank() }
    }

    /** The introduction of the article that best matches [query], for a quick explanation. */
    suspend fun summary(query: String, maxChars: Int = 1200): WikiArticle? =
        search(query, limit = 1).firstOrNull()?.let { it.copy(text = WikiText.shorten(it.text, maxChars)) }

    private suspend fun get(vararg parameters: Pair<String, String>): JsonObject {
        val query = (parameters.toList() + listOf("format" to "json", "formatversion" to "2"))
            .joinToString("&") { (name, value) -> "$name=${URLEncoder.encode(value, "UTF-8")}" }
        val result = transport.get("$api?$query", mapOf("User-Agent" to USER_AGENT, "Accept" to "application/json"), TIMEOUT_SECONDS)
        if (result.status !in 200..299) throw LlmError.Http(result.status, "Wikipedia")
        return runCatching { Json.parseToJsonElement(result.body).jsonObject }.getOrElse { throw LlmError.InvalidResponse }
    }

    /** Articles with their search rank; missing pages are left out. */
    private fun pages(root: JsonObject): List<Pair<WikiArticle, Int>> {
        val pages = (root["query"] as? JsonObject)?.get("pages") as? JsonArray ?: return emptyList()
        return pages.mapNotNull { element ->
            val page = element as? JsonObject ?: return@mapNotNull null
            if (page["missing"] != null || page["invalid"] != null) return@mapNotNull null
            val title = page["title"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val url = page["fullurl"]?.jsonPrimitive?.contentOrNull ?: "https://$language.wikipedia.org/wiki/${title.replace(' ', '_')}"
            val text = page["extract"]?.jsonPrimitive?.contentOrNull?.trim() ?: ""
            WikiArticle(title, url, text) to (page["index"]?.jsonPrimitive?.intOrNull ?: Int.MAX_VALUE)
        }
    }

    companion object {
        const val USER_AGENT = "SchulPip/1.0 (https://github.com/Maxifrz/schul-pip; Lern-App für Schüler)"
        const val TIMEOUT_SECONDS = 20L
    }
}

object WikiText {
    /** At most [maxChars] characters, ending after a full sentence where possible; blank lines are collapsed. */
    fun shorten(text: String, maxChars: Int): String {
        val clean = text.replace(Regex("\n{3,}"), "\n\n").trim()
        if (clean.length <= maxChars) return clean
        val cut = clean.take(maxChars)
        val end = maxOf(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"))
        return if (end >= maxChars / 3) cut.take(end + 1) else "$cut …"
    }
}

/** An article the AI may use, with the id it cites it by. */
data class WebSource(val id: String, val title: String, val url: String, val text: String)

/** Collects Wikipedia articles for a presentation and turns them into prompt text and citations. */
object Research {
    const val MAX_QUERIES = 4
    const val MAX_CHARACTERS = 14_000

    /**
     * For every query the introductions of the two best matches and a longer excerpt of the best one; articles that
     * are already there are skipped. A query that fails is skipped too, the talk can still be built without it.
     */
    suspend fun gather(
        wikipedia: WikipediaClient,
        queries: List<String>,
        existing: List<WebSource> = emptyList(),
    ): List<WebSource> {
        val sources = existing.toMutableList()
        var characters = sources.sumOf { it.text.length }
        for (query in queries.map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(MAX_QUERIES)) {
            val found = try {
                wikipedia.search(query, limit = 2)
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                continue
            }
            found.forEachIndexed { index, hit ->
                if (sources.any { it.title == hit.title } || characters >= MAX_CHARACTERS) return@forEachIndexed
                val text = if (index == 0) {
                    runCatching { wikipedia.article(hit.title)?.text }.getOrNull() ?: hit.text
                } else {
                    WikiText.shorten(hit.text, 1200)
                }
                val budgeted = WikiText.shorten(text, MAX_CHARACTERS - characters)
                if (budgeted.isBlank()) return@forEachIndexed
                sources += WebSource("W${sources.size + 1}", hit.title, hit.url, budgeted)
                characters += budgeted.length
            }
        }
        return sources
    }

    /** The articles as a block for the prompt, each with its id. */
    fun prompt(sources: List<WebSource>): String = buildString {
        appendLine("<research source=\"German Wikipedia\">")
        sources.forEach { source ->
            appendLine("<article id=\"${source.id}\" title=\"${source.title}\" url=\"${source.url}\">")
            appendLine(source.text)
            appendLine("</article>")
        }
        append("</research>")
    }

    /** How a school talk cites an article: title, Wikipedia, link and the day it was read. */
    fun citation(source: WebSource, date: Date = Date()): String =
        "„${source.title}“, Wikipedia, ${source.url.removePrefix("https://")} (abgerufen am ${SimpleDateFormat("dd.MM.yyyy", Locale.GERMANY).format(date)})"

    /** A link to YouTube's search for [query]; opens the app or the website, needs no key. */
    fun youtubeSearchUrl(query: String): String =
        "https://www.youtube.com/results?search_query=${URLEncoder.encode(query.trim(), "UTF-8")}"
}
