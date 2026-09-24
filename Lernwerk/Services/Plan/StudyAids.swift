import Foundation

struct Exercise: Codable, Equatable {
    var question: String
    var hint: String
    var solution: String
}

/// Exercises and flashcards for one topic of a study plan, from the pages it covers. Mirrors the Android app.
struct TopicAssistant {
    let client: any LLMClient

    func exercises(title: String, summary: String, pagesLabel: String, pages: String) async throws -> [Exercise] {
        let request = LLMRequest(
            purpose: .studyAid,
            system: StudyAids.system,
            messages: [LLMMessage(role: .user, content: [.text(StudyAids.exercisesPrompt(title: title, summary: summary, pagesLabel: pagesLabel, pages: pages))])],
            maxTokens: 6000,
            effort: .medium,
            jsonSchema: StudyAids.exercisesSchema
        )
        return try await StructuredOutput.complete(request: request, client: client, parse: StudyAids.parseExercises) { !$0.isEmpty }
    }

    func flashcards(title: String, summary: String, pagesLabel: String, pages: String) async throws -> [Flashcard] {
        let request = LLMRequest(
            purpose: .studyAid,
            system: StudyAids.system,
            messages: [LLMMessage(role: .user, content: [.text(StudyAids.flashcardsPrompt(title: title, summary: summary, pagesLabel: pagesLabel, pages: pages))])],
            maxTokens: 4000,
            effort: .low,
            jsonSchema: StudyAids.flashcardsSchema
        )
        return try await StructuredOutput.complete(request: request, client: client, parse: StudyAids.parseFlashcards) { !$0.isEmpty }
    }
}

enum StudyAids {
    static let system = """
    You help a German upper-secondary student practise one topic of their study plan. Write in German, address the \
    student as "du" and write math with Unicode characters, never LaTeX. Stay with what the pages of their \
    material cover; if there are no pages, stay with what the topic's title and goal describe at school level.
    """

    /// The most text of a topic's pages that goes into one request.
    static let maxPageCharacters = 24_000

    static func exercisesPrompt(title: String, summary: String, pagesLabel: String, pages: String) -> String {
        topicBlock(title: title, summary: summary, pagesLabel: pagesLabel, pages: pages) + """


        Write 4 exercises (Übungsaufgaben) for this topic, from easy to hard: one to recall the basics, two to
        apply them to new examples and one transfer task. Each has a question, a hint that helps without giving
        the answer away, and a complete worked solution with the steps.
        """
    }

    static func flashcardsPrompt(title: String, summary: String, pagesLabel: String, pages: String) -> String {
        topicBlock(title: title, summary: summary, pagesLabel: pagesLabel, pages: pages) + """


        Write 6 to 10 flashcards for the most important facts, terms, rules and steps of this topic. The front
        is a precise question, the back a short answer of at most two sentences.
        """
    }

    private static func topicBlock(title: String, summary: String, pagesLabel: String, pages: String) -> String {
        var lines = ["Topic: \(title)", "Goal: \(summary)"]
        if !pages.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            lines.append("<pages \(pagesLabel)>")
            lines.append(String(pages.prefix(maxPageCharacters)))
            lines.append("</pages>")
        }
        return lines.joined(separator: "\n")
    }

    /// The pages a topic covers, labeled, from the page texts of its material.
    static func pagesText(sourcePages: [Int], pageTexts: [String]?) -> String {
        guard let pageTexts else { return "" }
        return Array(Set(sourcePages)).sorted().compactMap { page -> String? in
            guard pageTexts.indices.contains(page - 1) else { return nil }
            let text = pageTexts[page - 1].trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? nil : "--- Page \(page) ---\n\(text)"
        }.joined(separator: "\n")
    }

    static func pagesLabel(_ sourcePages: [Int]) -> String {
        let pages = sourcePages.sorted()
        guard let first = pages.first, let last = pages.last else { return "" }
        return first == last ? "S. \(first)" : "S. \(first)–\(last)"
    }

    static let exercisesSchema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "exercises": { "type": "array", "items": { "type": "object", "properties": {
          "question": { "type": "string" }, "hint": { "type": "string" }, "solution": { "type": "string" }
        }, "required": ["question", "hint", "solution"], "additionalProperties": false } }
      },
      "required": ["exercises"],
      "additionalProperties": false
    }
    """)

    static let flashcardsSchema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "cards": { "type": "array", "items": { "type": "object", "properties": {
          "front": { "type": "string" }, "back": { "type": "string" }
        }, "required": ["front", "back"], "additionalProperties": false } }
      },
      "required": ["cards"],
      "additionalProperties": false
    }
    """)

    static func parseExercises(_ text: String) -> [Exercise]? {
        guard let items = array(text, key: "exercises") else { return nil }
        return items.compactMap { item in
            let question = trimmed(item["question"])
            let solution = trimmed(item["solution"])
            guard !question.isEmpty, !solution.isEmpty else { return nil }
            return Exercise(question: question, hint: trimmed(item["hint"]), solution: solution)
        }
    }

    static func parseFlashcards(_ text: String) -> [Flashcard]? {
        guard let items = array(text, key: "cards") else { return nil }
        return items.compactMap { item in
            let front = trimmed(item["front"])
            let back = trimmed(item["back"])
            return front.isEmpty || back.isEmpty ? nil : Flashcard(front: front, back: back)
        }
    }

    private static func array(_ text: String, key: String) -> [[String: Any]]? {
        guard let data = text.data(using: .utf8),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = root[key] as? [Any]
        else { return nil }
        return items.compactMap { $0 as? [String: Any] }
    }

    private static func trimmed(_ value: Any?) -> String {
        ((value as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// What to search on YouTube: the model's suggestion or the topic's title.
    static func videoQuery(title: String, suggestion: String) -> String {
        let suggestion = suggestion.trimmingCharacters(in: .whitespacesAndNewlines)
        return suggestion.isEmpty ? "\(title) einfach erklärt" : suggestion
    }

    static func videoURL(title: String, suggestion: String) -> URL? {
        Research.youtubeSearchURL(videoQuery(title: title, suggestion: suggestion))
    }

    /// Exercises or flashcards for the demo, whichever the request's schema asks for.
    static func demo(_ request: LLMRequest) -> String {
        let properties = request.jsonSchema?["properties"] as? [String: Any]
        return properties?["exercises"] != nil ? demoExercises : demoCards
    }

    static let demoExercises = """
    {"exercises":[
    {"question":"Nenne innere und äußere Funktion von f(x) = (3x + 1)⁵.","hint":"Was wird zuerst berechnet, wenn du eine Zahl einsetzt?","solution":"Innere Funktion: g(x) = 3x + 1. Äußere Funktion: h(u) = u⁵."},
    {"question":"Leite f(x) = (3x + 1)⁵ ab.","hint":"Äußere Ableitung mal innere Ableitung.","solution":"f′(x) = 5 · (3x + 1)⁴ · 3 = 15 · (3x + 1)⁴"},
    {"question":"Leite f(x) = sin(x²) ab.","hint":"Die innere Funktion ist x².","solution":"f′(x) = cos(x²) · 2x"},
    {"question":"Leite f(x) = e^(sin x) ab und erkläre, warum die Kettenregel hier gebraucht wird.","hint":"Die äußere Funktion ist die e-Funktion, die innere sin x.","solution":"f′(x) = e^(sin x) · cos x. Die e-Funktion bleibt beim Ableiten gleich, dann kommt die innere Ableitung cos x dazu."}
    ]}
    """

    static let demoCards = """
    {"cards":[
    {"front":"Wie lautet die Kettenregel?","back":"f(x) = h(g(x)) ⇒ f′(x) = h′(g(x)) · g′(x): äußere mal innere Ableitung."},
    {"front":"Was ist die innere Funktion von (2x − 7)³?","back":"g(x) = 2x − 7"},
    {"front":"Ableitung von e^(3x)?","back":"3 · e^(3x)"},
    {"front":"Ableitung von √(x² + 1)?","back":"x / √(x² + 1)"},
    {"front":"Woran erkennst du eine Verkettung?","back":"Eine Funktion wird auf das Ergebnis einer anderen angewendet, z. B. sin(x²)."},
    {"front":"Ableitung von sin(4x)?","back":"4 · cos(4x)"}
    ]}
    """
}

/// The plan as an iCalendar file: one all-day event per topic and one for the exam.
enum PlanCalendar {
    static func ics(planKey: String, title: String, examDate: Date, topics: [PlanReminder.Item], now: Date = Date(), calendar: Calendar = .current) -> String {
        var lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Schul-PIP//Lernplan//DE",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:\(escape("Lernplan: \(title)"))",
        ]
        for topic in topics.sorted(by: { ($0.date, $0.order) < ($1.date, $1.order) }) {
            let details = "\(topic.minutes) Minuten" + (topic.pagesLabel.isEmpty ? "" : " · \(topic.pagesLabel)")
            let video = StudyAids.videoURL(title: topic.title, suggestion: topic.videoQuery).map { "Videos: \($0.absoluteString)" }
            let description = [topic.summary.isEmpty ? nil : topic.summary, details, video].compactMap { $0 }.joined(separator: "\n")
            lines += event(uid: "\(planKey)-\(topic.order)@schul-pip", date: topic.date, summary: "Lernen: \(topic.title)", description: description, now: now, calendar: calendar)
        }
        lines += event(uid: "\(planKey)-exam@schul-pip", date: examDate, summary: "Prüfung: \(title)", description: "Viel Erfolg!", now: now, calendar: calendar)
        lines.append("END:VCALENDAR")
        return lines.flatMap(fold).joined(separator: "\r\n") + "\r\n"
    }

    private static func event(uid: String, date: Date, summary: String, description: String, now: Date, calendar: Calendar) -> [String] {
        let start = calendar.startOfDay(for: date)
        let end = calendar.date(byAdding: .day, value: 1, to: start) ?? start
        return [
            "BEGIN:VEVENT",
            "UID:\(uid)",
            "DTSTAMP:\(stamp(now))",
            "DTSTART;VALUE=DATE:\(day(start, calendar))",
            "DTEND;VALUE=DATE:\(day(end, calendar))",
            "SUMMARY:\(escape(summary))",
            "DESCRIPTION:\(escape(description))",
            "TRANSP:TRANSPARENT",
            "END:VEVENT",
        ]
    }

    private static func day(_ date: Date, _ calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d%02d%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    private static func stamp(_ date: Date) -> String {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC") ?? .current
        let parts = utc.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        return String(
            format: "%04d%02d%02dT%02d%02d%02dZ",
            parts.year ?? 0, parts.month ?? 0, parts.day ?? 0, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0
        )
    }

    /// Text values escape backslashes, semicolons, commas and line breaks (RFC 5545, 3.3.11).
    static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: ";", with: "\\;")
            .replacingOccurrences(of: ",", with: "\\,")
            .replacingOccurrences(of: "\r\n", with: "\\n")
            .replacingOccurrences(of: "\n", with: "\\n")
    }

    /// Lines longer than 75 octets continue on the next line after a space, without splitting a character.
    static func fold(_ line: String) -> [String] {
        guard line.utf8.count > 75 else { return [line] }
        var parts: [String] = []
        var current = ""
        var size = 0
        for character in line {
            let bytes = String(character).utf8.count
            if size + bytes > 75 {
                parts.append(current)
                current = " "
                size = 1
            }
            current.append(character)
            size += bytes
        }
        parts.append(current)
        return parts
    }
}

/// What the daily reminder of a plan says, and on which days.
enum PlanReminder {
    struct Item: Equatable {
        var title: String
        var summary = ""
        var pagesLabel = ""
        var minutes: Int
        var order: Int
        var date: Date
        var isDone = false
        var videoQuery = ""
    }

    struct Notification: Equatable {
        var fireDate: Date
        var title: String
        var body: String
    }

    /// Open topics planned for `day` or missed before.
    static func due(_ items: [Item], on day: Date, calendar: Calendar = .current) -> [Item] {
        let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: day)) ?? day
        return items.filter { !$0.isDone && $0.date < end }.sorted { ($0.date, $0.order) < ($1.date, $1.order) }
    }

    /// Title and text of the notification, or nil when nothing is open (or the exam is over).
    static func message(planTitle: String, examDate: Date, items: [Item], on day: Date, calendar: Calendar = .current) -> (title: String, body: String)? {
        let today = calendar.startOfDay(for: day)
        let exam = calendar.startOfDay(for: examDate)
        guard today <= exam else { return nil }
        let open = due(items, on: day, calendar: calendar)
        guard !open.isEmpty else { return nil }
        let minutes = open.reduce(0) { $0 + $1.minutes }
        let titles = open.prefix(3).map(\.title).joined(separator: ", ") + (open.count > 3 ? " und \(open.count - 3) weitere" : "")
        let greeting = today == exam ? "Heute ist die Prüfung – viel Erfolg! " : ""
        return ("Lernplan: \(planTitle)", "\(greeting)\(titles) · etwa \(minutes) Minuten")
    }

    /// Notifications for the coming days at `minuteOfDay`, as the plan stands now; iOS runs no code when one fires,
    /// so they are computed ahead and replaced whenever the plan changes.
    static func upcoming(
        planTitle: String,
        examDate: Date,
        items: [Item],
        minuteOfDay: Int,
        from now: Date,
        days: Int = 14,
        calendar: Calendar = .current
    ) -> [Notification] {
        let start = calendar.startOfDay(for: now)
        return (0..<days).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset, to: start),
                  let fire = calendar.date(bySettingHour: minuteOfDay / 60 % 24, minute: minuteOfDay % 60, second: 0, of: day),
                  fire > now,
                  let message = message(planTitle: planTitle, examDate: examDate, items: items, on: day, calendar: calendar)
            else { return nil }
            return Notification(fireDate: fire, title: message.title, body: message.body)
        }
    }
}
