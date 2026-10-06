import XCTest
@testable import Lernwerk

final class StudioTodayTests: XCTestCase {
    private let lessons = [
        StudioToday.Lesson(subject: "Englisch", room: "108", start: 7 * 60 + 55, end: 8 * 60 + 40),
        StudioToday.Lesson(subject: "Deutsch", room: "112", start: 8 * 60 + 45, end: 9 * 60 + 30),
        StudioToday.Lesson(subject: "Mathe", room: "204", start: 9 * 60 + 50, end: 10 * 60 + 35),
        StudioToday.Lesson(subject: "Mathe", room: "204", start: 10 * 60 + 40, end: 11 * 60 + 25),
        StudioToday.Lesson(subject: "Biologie", room: "31", start: 11 * 60 + 45, end: 12 * 60 + 30),
    ]

    func testSoonLessonIsAnnouncedWithMinutesAndTheNextOtherSubject() {
        let lines = StudioToday.lines(now: 9 * 60 + 41, lessons: lessons)
        XCTAssertEqual(lines.map(\.text), ["DU HAST GLEICH", "MATHE.", "RAUM 204 · IN 9 MIN.", "DANACH: BIOLOGIE · 11:45"])
        XCTAssertEqual(lines.map(\.tone), [.ink, .accent, .ink, .muted])
    }

    func testRunningLessonShowsItsEnd() {
        let lines = StudioToday.lines(now: 10 * 60, lessons: lessons)
        XCTAssertEqual(lines.first?.text, "DU BIST GERADE IN")
        XCTAssertEqual(lines[2].text, "RAUM 204 · BIS 10:35")
    }

    func testDistantLessonIsNamedNextLesson() {
        let lines = StudioToday.lines(now: 7 * 60, lessons: lessons)
        XCTAssertEqual(lines.first?.text, "DEINE NÄCHSTE STUNDE")
        XCTAssertEqual(lines[1].text, "ENGLISCH.")
    }

    func testNoMoreLessonsSaysSo() {
        XCTAssertEqual(StudioToday.lines(now: 13 * 60, lessons: lessons).first?.text, "KEIN UNTERRICHT")
        XCTAssertEqual(StudioToday.lines(now: 8 * 60, lessons: []).map(\.text), ["KEIN UNTERRICHT", "MEHR HEUTE.", "LERNPLAN WARTET."])
    }

    func testPixelTextKeepsUmlautsAndUpperCases() {
        XCTAssertEqual(StudioToday.pixelText("Französisch"), "FRANZÖSISCH")
        XCTAssertEqual(StudioToday.pixelText("Mathe-Ü"), "MATHE-Ü")
        XCTAssertEqual(StudioToday.pixelText("Straße"), "STRASSE")
    }

    func testSubjectSizeShrinksWithLengthAndStaysInRange() {
        XCTAssertEqual(StudioToday.subjectSize("Kunst"), 34)
        XCTAssertLessThan(StudioToday.subjectSize("Politikwissenschaft"), StudioToday.subjectSize("Kunst"))
        XCTAssertGreaterThan(StudioToday.subjectSize("Politikwissenschaft"), 0)
    }

    func testExamSummaryPrefersTheNearestFutureDate() {
        let today = CalendarDay(year: 2026, month: 10, day: 1)
        let plans = [
            StudioToday.PlanInfo(examDay: CalendarDay(year: 2026, month: 10, day: 29), done: [true, false, false]),
            StudioToday.PlanInfo(examDay: CalendarDay(year: 2026, month: 9, day: 1), done: [true]),
        ]
        let exams = [CalendarDay(year: 2026, month: 11, day: 5)]
        let summary = StudioToday.examSummary(plans: plans, exams: exams, today: today)
        XCTAssertEqual(summary?.days, 28)
        XCTAssertEqual(summary?.dateLabel, "29. Oktober 2026")
        XCTAssertEqual(summary?.progressLabel, "1 von 3 Themen erledigt")
    }

    func testExamSummaryFallsBackToTheKlausurenplan() {
        let today = CalendarDay(year: 2026, month: 10, day: 1)
        let summary = StudioToday.examSummary(plans: [], exams: [CalendarDay(year: 2026, month: 10, day: 8)], today: today)
        XCTAssertEqual(summary?.days, 7)
        XCTAssertNil(summary?.progressLabel)
        XCTAssertNil(StudioToday.examSummary(plans: [], exams: [CalendarDay(year: 2026, month: 9, day: 8)], today: today))
    }

    func testPlanWinsATieWithAnExam() {
        let today = CalendarDay(year: 2026, month: 10, day: 1)
        let day = CalendarDay(year: 2026, month: 10, day: 10)
        let summary = StudioToday.examSummary(plans: [StudioToday.PlanInfo(examDay: day, done: [false])], exams: [day], today: today)
        XCTAssertEqual(summary?.blocks, [false])
    }

    func testCaptionIsGermanWhateverTheDevice() {
        // 2026-10-01 is a Thursday.
        XCTAssertEqual(StudioToday.caption(day: CalendarDay(year: 2026, month: 10, day: 1), minute: 9 * 60 + 41), "DONNERSTAG · 1. OKT · 9:41")
        XCTAssertEqual(StudioToday.caption(day: CalendarDay(year: 2026, month: 3, day: 2), minute: 8 * 60 + 5), "MONTAG · 2. MÄR · 8:05")
    }

    func testOmniFindsAreasBeforeDocumentsAndCapsAtFive() {
        let areas = [StudioToday.OmniEntry(id: "calc", label: "Rechner", kind: .area)]
        let documents = (1...8).map { StudioToday.OmniEntry(id: "d\($0)", label: "Rechnen \($0)", kind: .document) }
        let hits = StudioToday.omni(query: " rech ", areas: areas, documents: documents)
        XCTAssertEqual(hits.count, 5)
        XCTAssertEqual(hits.first?.kind, .area)
        XCTAssertEqual(hits.first?.kindLabel, "BEREICH")
        XCTAssertTrue(StudioToday.omni(query: "  ", areas: areas, documents: documents).isEmpty)
        XCTAssertTrue(StudioToday.omni(query: "xyz", areas: areas, documents: documents).isEmpty)
    }

    func testHeroLinesScaleTheSubjectToTheCard() {
        let hero = StudioToday.heroLines(now: 9 * 60 + 41, lessons: lessons, portrait: false)
        XCTAssertEqual(hero.map(\.size), [26, StudioToday.heroSize("MATHE.", portrait: false), 28, 22])
        XCTAssertEqual(hero[1].size, 92)
        XCTAssertLessThan(StudioToday.heroSize("POLITIKWISSENSCHAFT.", portrait: false), 40)
        XCTAssertGreaterThan(StudioToday.heroSize("POLITIKWISSENSCHAFT.", portrait: true), StudioToday.heroSize("POLITIKWISSENSCHAFT.", portrait: false))
    }

    func testDoubleLessonsAreOneBlock() {
        let blocks = StudioToday.blocks(lessons)
        XCTAssertEqual(blocks.map(\.subject), ["Englisch", "Deutsch", "Mathe", "Biologie"])
        XCTAssertEqual(blocks[2], StudioToday.Block(subject: "Mathe", start: 9 * 60 + 50, end: 11 * 60 + 25))
    }

    func testPipAsksOnceALessonIsAlmostOver() {
        let blocks = StudioToday.blocks(lessons)
        XCTAssertNil(StudioToday.askBlock(blocks: blocks, answered: [], now: 7 * 60))
        XCTAssertEqual(StudioToday.askBlock(blocks: blocks, answered: [], now: 8 * 60 + 36)?.subject, "Englisch")
        XCTAssertEqual(StudioToday.askBlock(blocks: blocks, answered: ["Englisch"], now: 9 * 60 + 26)?.subject, "Deutsch")
        XCTAssertNil(StudioToday.askBlock(blocks: blocks, answered: ["Englisch", "Deutsch", "Mathe", "Biologie"], now: 13 * 60))
    }

    func testDueLabelNamesTheNextLessonOfTheSubject() {
        // 2026-10-01 is a Thursday; Friday is weekday 5.
        let today = CalendarDay(year: 2026, month: 10, day: 1)
        let week = [(weekday: 5, subject: "Englisch"), (weekday: 4, subject: "Mathe")]
        XCTAssertEqual(StudioToday.dueLabel(subject: "Englisch", week: week, today: today), "FR 2.10.")
        XCTAssertEqual(StudioToday.dueLabel(subject: "Mathe", week: week, today: today), "DO 8.10.")
        XCTAssertEqual(StudioToday.dueLabel(subject: "Kunst", week: week, today: today), "ZUR NÄCHSTEN STUNDE")
    }
}
