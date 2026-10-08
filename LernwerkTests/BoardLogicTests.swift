import PDFKit
import UIKit
import XCTest
@testable import Lernwerk

final class BoardLogicTests: XCTestCase {
    private let boardID = UUID()
    private let anna = UUID()
    private let ben = UUID()

    private func board(template: String = "math", status: String = "open") -> Board {
        Board(
            id: boardID, groupId: UUID(), title: "Integralrechnung", topic: "Bestimmtes Integral", template: template,
            lessonDate: "2026-10-08", status: status, createdBy: anna, finalizedAt: nil, createdAt: "2026-10-08T08:00:00+00:00"
        )
    }

    private func block(_ kind: String, _ title: String, _ body: String, status: String = "accepted", position: Double = 0, author: UUID? = nil) -> BoardBlock {
        BoardBlock(
            id: UUID(), boardId: boardID, kind: kind, title: title, body: body, attachmentPath: nil, status: status,
            position: position, author: author ?? anna, replacesBlock: nil, rev: 1,
            createdAt: "2026-10-08T08:0\(Int(position))+00:00", updatedAt: "2026-10-08T08:00:00+00:00", profiles: nil
        )
    }

    func testSectionsFollowTheTemplateAndLeaveOutProposals() {
        let blocks = [
            block("example", "Beispiel", "∫₀² x² dx = 8/3", position: 4),
            block("definition", "Bestimmtes Integral", "Flächenbilanz", position: 1),
            block("formula", "Hauptsatz", "∫ₐᵇ f(x) dx = F(b) − F(a)", position: 2),
            block("rule", "Merke", "Grenzen einsetzen", status: "proposed"),
            block("definition", "Zweite Definition", "…", position: 3),
        ]
        let sections = BoardLogic.sections(template: .math, blocks: blocks)
        XCTAssertEqual(sections.map(\.kind), [.definition, .formula, .example])
        XCTAssertEqual(sections[0].blocks.map(\.title), ["Bestimmtes Integral", "Zweite Definition"])
    }

    func testAKindOutsideTheTemplateComesLast() {
        let sections = BoardLogic.sections(template: .math, blocks: [block("event", "1789", "…"), block("definition", "x", "y")])
        XCTAssertEqual(sections.map(\.kind), [.definition, .event])
    }

    func testStatsCountContributionsAndPeople() {
        let stats = BoardLogic.stats([
            block("definition", "a", "b", author: anna),
            block("formula", "a", "b", status: "proposed", author: ben),
            block("rule", "a", "b", status: "rejected", author: ben),
        ])
        XCTAssertEqual(stats, BoardLogic.Stats(contributions: 3, accepted: 1, open: 1, rejected: 1, people: 2))
    }

    func testPollSharesAddUpAndStartAtZero() {
        let first = UUID(), second = UUID(), third = UUID()
        let poll = BoardPoll(
            id: UUID(), boardId: boardID, question: "Welche Definition?", status: "open", winner: nil, createdAt: "",
            pollOptions: [.init(blockId: first), .init(blockId: second), .init(blockId: third)]
        )
        let empty = BoardLogic.shares(poll: poll, counts: [])
        XCTAssertEqual(empty.total, 0)
        XCTAssertEqual(empty.percent[first], 0)

        let counts = [PollCount(pollId: poll.id, blockId: first, votes: 8), PollCount(pollId: poll.id, blockId: second, votes: 16), PollCount(pollId: poll.id, blockId: third, votes: 1)]
        let shares = BoardLogic.shares(poll: poll, counts: counts)
        XCTAssertEqual(shares.total, 25)
        XCTAssertEqual(shares.percent[first], 32)
        XCTAssertEqual(shares.percent[second], 64)
        XCTAssertEqual(shares.percent[third], 4)
        // Counts of another poll do not leak in.
        let other = BoardLogic.shares(poll: poll, counts: [PollCount(pollId: UUID(), blockId: first, votes: 99)])
        XCTAssertEqual(other.total, 0)
    }

    func testTheResultReadsAsTextWithItsSections() {
        let text = BoardLogic.text(board: board(), groupName: "Mathe LK", blocks: [
            block("definition", "Bestimmtes Integral", "Flächenbilanz zwischen zwei Grenzen", position: 1),
            block("formula", "Hauptsatz", "∫ₐᵇ f(x) dx = F(b) − F(a)", position: 2, author: ben),
        ])
        XCTAssertTrue(text.hasPrefix("INTEGRALRECHNUNG\nMathe LK · 08.10.2026\nBestimmtes Integral"))
        XCTAssertTrue(text.contains("\nDEFINITION\nBestimmtes Integral\nFlächenbilanz"))
        XCTAssertTrue(text.contains("\nFORMEL\nHauptsatz\n∫ₐᵇ"))
        XCTAssertTrue(text.hasSuffix("2 Beiträge übernommen, 2 Beteiligte"))
    }

    func testFlashcardsAskForDefinitionsAndFormulasOnly() {
        let cards = BoardLogic.flashcards(board: board(), blocks: [
            block("definition", "Bestimmtes Integral", "Flächenbilanz", position: 1),
            block("formula", "", "F(b) − F(a)", position: 2),
            block("example", "Beispiel", "8/3", position: 3),
            block("question", "Warum negativ?", "", position: 4),
            block("rule", "Merke", "   ", position: 5),
        ])
        XCTAssertEqual(cards.count, 2)
        XCTAssertEqual(cards[0].front, "Definition: Bestimmtes Integral")
        XCTAssertEqual(cards[0].back, "Flächenbilanz")
        XCTAssertEqual(cards[1].front, "Formel zu „Integralrechnung“")
    }

    func testTemplatesFitSubjectNames() {
        XCTAssertEqual(BoardTemplate.suggested(forName: "Mathe LK"), .math)
        XCTAssertEqual(BoardTemplate.suggested(forName: "Chemie GK 12"), .chemistry)
        XCTAssertEqual(BoardTemplate.suggested(forName: "Geschichte"), .history)
        XCTAssertEqual(BoardTemplate.suggested(forName: "Biologie"), .biology)
        XCTAssertEqual(BoardTemplate.suggested(forName: "Kunst"), .general)
        XCTAssertEqual(Array(BoardTemplate.chemistry.kinds.prefix(4)), [.observation, .interpretation, .equation, .result])
    }

    func testBoardStatusAndDateLabels() {
        XCTAssertTrue(board().isOpen)
        XCTAssertTrue(board(status: "final").isFinal)
        XCTAssertEqual(board().dateLabel, "08.10.2026")
        XCTAssertEqual(board(template: "unbekannt").kind, .general)
        XCTAssertEqual(BlockKind.from("gibtsnicht"), .text)
    }

    func testReviewPromptCarriesTheResultAndForbidsRewriting() {
        let prompt = BoardLogic.reviewPrompt(board: board(), groupName: "Mathe LK", blocks: [block("definition", "Integral", "Fläche")])
        XCTAssertTrue(prompt.contains("DEFINITION"))
        XCTAssertTrue(prompt.contains("Schreib das Ergebnis nicht um"))
    }

    func testBoardRowsDecodeFromTheServersSnakeCase() throws {
        let json = #"""
        [{"id":"11111111-1111-1111-1111-111111111111","board_id":"22222222-2222-2222-2222-222222222222","kind":"formula","title":"HS","body":"x","attachment_path":null,"status":"proposed","position":0,"author":"33333333-3333-3333-3333-333333333333","replaces_block":null,"rev":1,"created_at":"2026-10-08T08:00:00+00:00","updated_at":"2026-10-08T08:00:00+00:00","profiles":{"display_name":"Anna"}}]
        """#
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let blocks = try decoder.decode([BoardBlock].self, from: Data(json.utf8))
        XCTAssertEqual(blocks.first?.blockKind, .formula)
        XCTAssertEqual(blocks.first?.authorName, "Anna")
        XCTAssertTrue(blocks.first?.isProposed == true)
    }
}

final class BoardExportTests: XCTestCase {
    private func block(_ title: String, _ body: String, at position: Double) -> BoardBlock {
        BoardBlock(
            id: UUID(), boardId: UUID(), kind: "definition", title: title, body: body, attachmentPath: nil, status: "accepted",
            position: position, author: UUID(), replacesBlock: nil, rev: 1, createdAt: "2026-10-08T08:00:00+00:00",
            updatedAt: "2026-10-08T08:00:00+00:00", profiles: nil
        )
    }

    private let board = Board(
        id: UUID(), groupId: UUID(), title: "Integralrechnung", topic: "", template: "math", lessonDate: "2026-10-08",
        status: "final", createdBy: UUID(), finalizedAt: nil, createdAt: ""
    )

    func testTheResultBecomesAPDFWithItsText() throws {
        let data = BoardExport.pdf(board: board, groupName: "Mathe LK", blocks: [block("Bestimmtes Integral", "Flächenbilanz", at: 1)])
        let document = try XCTUnwrap(PDFDocument(data: data))
        XCTAssertEqual(document.pageCount, 1)
        let text = document.string ?? ""
        XCTAssertTrue(text.contains("Integralrechnung"))
        XCTAssertTrue(text.contains("Flächenbilanz"))
    }

    func testALongResultRunsOverOntoMorePages() throws {
        let blocks = (1...80).map { block("Begriff \($0)", String(repeating: "Eine längere Erklärung, die Platz braucht. ", count: 6), at: Double($0)) }
        let document = try XCTUnwrap(PDFDocument(data: BoardExport.pdf(board: board, groupName: "Mathe LK", blocks: blocks)))
        XCTAssertGreaterThan(document.pageCount, 1)
    }

    func testAPhotoIsScaledDownToAJPEG() throws {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let big = UIGraphicsImageRenderer(size: CGSize(width: 3200, height: 2400), format: format).image { context in
            UIColor.blue.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 3200, height: 2400))
        }
        let png = try XCTUnwrap(big.pngData())
        let jpeg = try XCTUnwrap(BoardExport.jpeg(from: png))
        let small = try XCTUnwrap(UIImage(data: jpeg))
        XCTAssertLessThanOrEqual(max(small.size.width, small.size.height) * small.scale, 1601)
        XCTAssertNil(BoardExport.jpeg(from: Data("kein bild".utf8)))
    }
}
