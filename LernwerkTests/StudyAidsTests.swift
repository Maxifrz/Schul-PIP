import Foundation
import XCTest
@testable import Lernwerk

private final class AidScriptedClient: LLMClient {
    var replies: [String]
    var requests: [LLMRequest] = []
    let capabilities = LLMCapabilities(acceptsImages: true, documentHandling: .textOnly)

    init(_ replies: [String]) {
        self.replies = replies
    }

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        requests.append(request)
        return LLMResponse(text: replies.removeFirst(), stopReason: "stop", model: "m")
    }
}

final class StudyAidsTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
        return calendar
    }

    private func date(_ day: Int, _ hour: Int = 0, _ minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: day, hour: hour, minute: minute))!
    }

    private var items: [PlanReminder.Item] {
        [
            PlanReminder.Item(title: "Ableiten", summary: "Du kannst Ableiten.", pagesLabel: "S. 2–3", minutes: 20, order: 0, date: date(23)),
            PlanReminder.Item(title: "Kettenregel", summary: "Du kannst Kettenregel.", pagesLabel: "S. 2–3", minutes: 30, order: 1, date: date(24), videoQuery: "Kettenregel einfach erklärt"),
            PlanReminder.Item(title: "Produktregel", minutes: 30, order: 2, date: date(24), isDone: true),
            PlanReminder.Item(title: "Integrale", minutes: 30, order: 3, date: date(25)),
        ]
    }

    func testTopicsGetPagesVideosAndLenientParsing() {
        XCTAssertEqual(StudyAids.pagesText(sourcePages: [3, 2, 2], pageTexts: ["eins", "zwei", "  ", "vier"]), "--- Page 2 ---\nzwei")
        XCTAssertEqual(StudyAids.pagesText(sourcePages: [1], pageTexts: nil), "")
        XCTAssertEqual(StudyAids.pagesLabel([3, 2]), "S. 2–3")
        XCTAssertEqual(StudyAids.videoQuery(title: "Ableiten", suggestion: " "), "Ableiten einfach erklärt")
        XCTAssertEqual(
            StudyAids.videoURL(title: "x", suggestion: "Kettenregel einfach erklärt")?.absoluteString,
            "https://www.youtube.com/results?search_query=Kettenregel+einfach+erkl%C3%A4rt"
        )
        let exercises = StudyAids.parseExercises(#"{"exercises":[{"question":"Q","solution":"S"},{"question":"","solution":"x"},{"question":"R","hint":"H","solution":"T"}]}"#)
        XCTAssertEqual(exercises?.map(\.question), ["Q", "R"])
        XCTAssertEqual(exercises?.first?.hint, "")
        XCTAssertEqual(StudyAids.parseFlashcards(#"{"cards":[{"front":"A","back":"B"},{"front":"C"}]}"#), [Flashcard(front: "A", back: "B")])
        XCTAssertNil(StudyAids.parseExercises("kaputt"))
    }

    func testExercisesAndCardsAreAskedForWithTheTopicsPages() async throws {
        let client = AidScriptedClient([
            #"{"exercises":[{"question":"Leite ab","hint":"Kette","solution":"2x"}]}"#,
            #"{"cards":[{"front":"Regel?","back":"äußere mal innere"}]}"#,
        ])
        let assistant = TopicAssistant(client: client)
        let exercises = try await assistant.exercises(title: "Kettenregel", summary: "Ziel", pagesLabel: "S. 2–3", pages: "--- Page 2 ---\nKettenregel")
        let cards = try await assistant.flashcards(title: "Kettenregel", summary: "Ziel", pagesLabel: "S. 2–3", pages: "")
        XCTAssertEqual(exercises.first?.solution, "2x")
        XCTAssertEqual(cards.first?.back, "äußere mal innere")
        XCTAssertEqual(client.requests.map(\.purpose), [.studyAid, .studyAid])
        guard case let .text(first) = client.requests[0].messages[0].content[0], case let .text(second) = client.requests[1].messages[0].content[0] else {
            return XCTFail("expected text")
        }
        XCTAssertTrue(first.contains("Topic: Kettenregel") && first.contains("<pages S. 2–3>") && first.contains("4 exercises"))
        XCTAssertTrue(second.contains("flashcards") && !second.contains("<pages"))

        let demo = LLMRequest(purpose: .studyAid, system: "", messages: [], maxTokens: 1, jsonSchema: StudyAids.exercisesSchema)
        XCTAssertEqual(StudyAids.parseExercises(StudyAids.demo(demo))?.count, 4)
        XCTAssertGreaterThanOrEqual(StudyAids.parseFlashcards(StudyAids.demoCards)?.count ?? 0, 6)
    }

    func testTheCalendarHasAnAllDayEventPerTopicAndTheExam() {
        let ics = PlanCalendar.ics(planKey: "plan-1", title: "Mathe, Analysis; Teil 1", examDate: date(30), topics: items, now: date(24, 10), calendar: calendar)
        XCTAssertTrue(ics.hasPrefix("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"))
        XCTAssertTrue(ics.hasSuffix("END:VCALENDAR\r\n"))
        XCTAssertEqual(ics.components(separatedBy: "BEGIN:VEVENT").count - 1, 5)
        XCTAssertTrue(ics.contains("DTSTART;VALUE=DATE:20260923\r\nDTEND;VALUE=DATE:20260924"))
        XCTAssertTrue(ics.contains("SUMMARY:Prüfung: Mathe\\, Analysis\\; Teil 1"))
        XCTAssertTrue(ics.contains("DTSTAMP:20260924T080000Z"))
        XCTAssertTrue(ics.contains("UID:plan-1-1@schul-pip"))
        XCTAssertTrue(ics.components(separatedBy: "\r\n").allSatisfy { $0.utf8.count <= 75 })
        let unfolded = ics.replacingOccurrences(of: "\r\n ", with: "")
        XCTAssertTrue(unfolded.contains("DESCRIPTION:Du kannst Kettenregel.\\n30 Minuten · S. 2–3\\nVideos: https://www.youtube.com/results?search_query=Kettenregel+einfach+erkl%C3%A4rt"))

        XCTAssertEqual(PlanCalendar.escape("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne")
        let long = String(repeating: "X", count: 70) + String(repeating: "äöü", count: 10)
        let folded = PlanCalendar.fold(long)
        XCTAssertTrue(folded.count > 1 && folded.dropFirst().allSatisfy { $0.hasPrefix(" ") })
        XCTAssertEqual(folded[0] + folded.dropFirst().map { String($0.dropFirst()) }.joined(), long)
    }

    func testTheReminderNamesWhatIsOpenAndIsScheduledAhead() {
        let message = PlanReminder.message(planTitle: "Mathe", examDate: date(30), items: items, on: date(24, 9), calendar: calendar)
        XCTAssertEqual(message?.title, "Lernplan: Mathe")
        XCTAssertEqual(message?.body, "Ableiten, Kettenregel · etwa 50 Minuten")
        XCTAssertNil(PlanReminder.message(planTitle: "Mathe", examDate: date(30), items: items.map { var item = $0; item.isDone = true; return item }, on: date(24), calendar: calendar))
        XCTAssertNil(PlanReminder.message(planTitle: "Mathe", examDate: date(23), items: items, on: date(24), calendar: calendar))
        XCTAssertTrue(PlanReminder.message(planTitle: "Mathe", examDate: date(24), items: items, on: date(24), calendar: calendar)?.body.hasPrefix("Heute ist die Prüfung") ?? false)

        // At 18:00 today's 17:00 reminder is past; the next ones run until the exam on the 27th.
        let upcoming = PlanReminder.upcoming(planTitle: "Mathe", examDate: date(27), items: items, minuteOfDay: 17 * 60, from: date(24, 18), calendar: calendar)
        XCTAssertEqual(upcoming.map(\.fireDate), [date(25, 17), date(26, 17), date(27, 17)])
        XCTAssertEqual(upcoming[0].body, "Ableiten, Kettenregel, Integrale · etwa 80 Minuten")
        XCTAssertEqual(PlanReminder.upcoming(planTitle: "Mathe", examDate: date(27), items: items, minuteOfDay: 19 * 60, from: date(24, 18), calendar: calendar).first?.fireDate, date(24, 19))
    }
}
