import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// A Wikipedia article or the start of it: title, link and plain text.
struct WikiArticle: Equatable {
    var title: String
    var url: String
    var text: String
}

/// Reads the German Wikipedia through its public API; no key needed. Mirrors the Android app.
struct WikipediaClient {
    /// One GET: URL and headers in, body and status code out. Replaced in tests.
    typealias Fetch = (URL, [String: String]) async throws -> (Data, Int)

    static let userAgent = "SchulPip/1.0 (https://github.com/Maxifrz/schul-pip; Lern-App für Schüler)"

    var language = "de"
    var fetch: Fetch = WikipediaClient.fetchWithURLSession

    private var api: String { "https://\(language).wikipedia.org/w/api.php" }

    /// The best matches for `query` with the introduction of each article, best first.
    func search(_ query: String, limit: Int = 2) async throws -> [WikiArticle] {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return [] }
        let response = try await get([
            ("action", "query"),
            ("generator", "search"),
            ("gsrsearch", query),
            ("gsrlimit", "\(limit)"),
            ("gsrnamespace", "0"),
            ("prop", "extracts|info"),
            ("inprop", "url"),
            ("exintro", "1"),
            ("explaintext", "1"),
            ("exlimit", "\(limit)"),
            ("redirects", "1"),
        ])
        return pages(response).sorted { $0.rank < $1.rank }.map(\.article).filter { !$0.text.isEmpty }
    }

    /// The article's text up to `maxChars`, cut at the end of a sentence.
    func article(_ title: String, maxChars: Int = 3500) async throws -> WikiArticle? {
        let response = try await get([
            ("action", "query"),
            ("titles", title),
            ("prop", "extracts|info"),
            ("inprop", "url"),
            ("explaintext", "1"),
            ("exsectionformat", "plain"),
            ("redirects", "1"),
        ])
        guard var article = pages(response).first?.article else { return nil }
        article.text = WikiText.shorten(article.text, maxChars: maxChars)
        return article.text.isEmpty ? nil : article
    }

    /// The introduction of the article that best matches `query`, for a quick explanation.
    func summary(_ query: String, maxChars: Int = 1200) async throws -> WikiArticle? {
        guard var article = try await search(query, limit: 1).first else { return nil }
        article.text = WikiText.shorten(article.text, maxChars: maxChars)
        return article
    }

    private struct Response: Decodable {
        struct Query: Decodable {
            var pages: [Page]?
        }

        struct Page: Decodable {
            var title: String?
            var extract: String?
            var fullurl: String?
            var index: Int?
            var missing: Bool?
            var invalid: Bool?
        }

        var query: Query?
    }

    private func get(_ parameters: [(String, String)]) async throws -> Response {
        let query = (parameters + [("format", "json"), ("formatversion", "2")])
            .map { "\($0.0)=\(Self.encode($0.1))" }
            .joined(separator: "&")
        guard let url = URL(string: "\(api)?\(query)") else { throw LLMError.invalidResponse }
        let (data, status) = try await fetch(url, ["User-Agent": Self.userAgent, "Accept": "application/json"])
        guard (200..<300).contains(status) else { throw LLMError.http(status: status, message: "Wikipedia") }
        guard let response = try? JSONDecoder().decode(Response.self, from: data) else { throw LLMError.invalidResponse }
        return response
    }

    /// Articles with their search rank; missing pages are left out.
    private func pages(_ response: Response) -> [(article: WikiArticle, rank: Int)] {
        (response.query?.pages ?? []).compactMap { page in
            guard page.missing != true, page.invalid != true, let title = page.title else { return nil }
            let url = page.fullurl ?? "https://\(language).wikipedia.org/wiki/\(title.replacingOccurrences(of: " ", with: "_"))"
            let text = (page.extract ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return (WikiArticle(title: title, url: url, text: text), page.index ?? Int.max)
        }
    }

    /// Percent-encodes everything but the unreserved characters of RFC 3986.
    static func encode(_ value: String) -> String {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    static func fetchWithURLSession(_ url: URL, headers: [String: String]) async throws -> (Data, Int) {
        var request = URLRequest(url: url, timeoutInterval: 20)
        for (name, value) in headers {
            request.setValue(value, forHTTPHeaderField: name)
        }
        return try await URLSession.shared.llmData(for: request)
    }
}

enum WikiText {
    /// At most `maxChars` characters, ending after a full sentence where possible; blank lines are collapsed.
    static func shorten(_ text: String, maxChars: Int) -> String {
        let clean = text.replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard clean.count > maxChars else { return clean }
        let cut = String(clean.prefix(max(0, maxChars)))
        let ends = [cut.range(of: ". ", options: .backwards), cut.range(of: ".\n", options: .backwards)]
            .compactMap { $0 }
            .map { cut.distance(from: cut.startIndex, to: $0.lowerBound) }
        if let end = ends.max(), end >= maxChars / 3 {
            return String(cut.prefix(end + 1))
        }
        return cut + " …"
    }
}

/// An article the AI may use, with the id it cites it by.
struct WebSource: Equatable {
    var id: String
    var title: String
    var url: String
    var text: String
}

/// Collects Wikipedia articles for a presentation and turns them into prompt text and citations.
enum Research {
    static let maxQueries = 4
    static let maxCharacters = 14_000

    /// For every query the introductions of the two best matches and a longer excerpt of the best one; articles that
    /// are already there are skipped. A query that fails is skipped too, the talk can still be built without it.
    static func gather(_ wikipedia: WikipediaClient, queries: [String], existing: [WebSource] = []) async throws -> [WebSource] {
        var sources = existing
        var characters = sources.reduce(0) { $0 + $1.text.count }
        var seen = Set<String>()
        let cleaned = queries.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
            .prefix(maxQueries)
        for query in cleaned {
            try Task.checkCancellation()
            guard let found = try? await wikipedia.search(query, limit: 2) else { continue }
            for (index, hit) in found.enumerated() {
                guard !sources.contains(where: { $0.title == hit.title }), characters < maxCharacters else { continue }
                var text = WikiText.shorten(hit.text, maxChars: 1200)
                if index == 0, let article = try? await wikipedia.article(hit.title) {
                    text = article.text
                }
                let budgeted = WikiText.shorten(text, maxChars: maxCharacters - characters)
                guard !budgeted.isEmpty else { continue }
                sources.append(WebSource(id: "W\(sources.count + 1)", title: hit.title, url: hit.url, text: budgeted))
                characters += budgeted.count
            }
        }
        return sources
    }

    /// The articles as a block for the prompt, each with its id.
    static func prompt(_ sources: [WebSource]) -> String {
        var lines = ["<research source=\"German Wikipedia\">"]
        for source in sources {
            lines.append("<article id=\"\(source.id)\" title=\"\(source.title)\" url=\"\(source.url)\">")
            lines.append(source.text)
            lines.append("</article>")
        }
        lines.append("</research>")
        return lines.joined(separator: "\n")
    }

    /// How a school talk cites an article: title, Wikipedia, link and the day it was read.
    static func citation(_ source: WebSource, date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "dd.MM.yyyy"
        let link = source.url.hasPrefix("https://") ? String(source.url.dropFirst("https://".count)) : source.url
        return "„\(source.title)“, Wikipedia, \(link) (abgerufen am \(formatter.string(from: date)))"
    }

    /// A link to YouTube's search for `query`; opens the app or the website, needs no key.
    static func youtubeSearchURL(_ query: String) -> URL? {
        let terms = query.trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: \.isWhitespace)
            .map { WikipediaClient.encode(String($0)) }
            .joined(separator: "+")
        return URL(string: "https://www.youtube.com/results?search_query=\(terms)")
    }
}
