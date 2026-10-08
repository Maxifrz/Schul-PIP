import CoreText
import Foundation
import UIKit

/// The state of the Tafelbild tab: the boards of a group, and for the board on screen its contributions, polls and versions.
@MainActor
final class BoardStore: ObservableObject {
    static let shared = BoardStore()

    @Published private(set) var boards: [UUID: [Board]] = [:]
    @Published private(set) var blocks: [UUID: [BoardBlock]] = [:]
    @Published private(set) var polls: [UUID: [BoardPoll]] = [:]
    @Published private(set) var counts: [UUID: [PollCount]] = [:]
    @Published private(set) var myVotes: [UUID: [PollVote]] = [:]
    @Published private(set) var versions: [UUID: [BoardVersion]] = [:]
    /// The AI's remarks on a finished board, by board.
    @Published var review: [UUID: String] = [:]
    @Published private(set) var busy = false

    private var api: SocialAPI? { SocialStore.shared.apiClient }

    // MARK: Reading

    func refreshBoards(_ group: SocialGroup) async {
        guard let api else { return }
        do {
            boards[group.id] = try await api.boards(in: group.id)
        } catch {
            SocialStore.shared.present(error)
        }
    }

    /// The board's contributions, polls and votes; the board row itself comes with the group's list, so a lock or a
    /// closing by the moderator shows up here too.
    func refresh(_ board: Board) async {
        guard let api else { return }
        do {
            async let rows = api.boardBlocks(in: board.id)
            async let polls = api.polls(in: board.id)
            async let counts = api.pollCounts(in: board.id)
            async let votes = api.myVotes(in: board.id)
            async let list = api.boards(in: board.groupId)
            let (newBlocks, newPolls, newCounts, newVotes, newBoards) = try await (rows, polls, counts, votes, list)
            if blocks[board.id] != newBlocks { blocks[board.id] = newBlocks }
            if self.polls[board.id] != newPolls { self.polls[board.id] = newPolls }
            if self.counts[board.id] != newCounts { self.counts[board.id] = newCounts }
            if myVotes[board.id] != newVotes { myVotes[board.id] = newVotes }
            if boards[board.groupId] != newBoards { boards[board.groupId] = newBoards }
        } catch {
            SocialStore.shared.present(error, quiet: true)
        }
    }

    func refreshVersions(_ board: Board) async {
        guard let api else { return }
        do {
            versions[board.id] = try await api.versions(of: board.id)
        } catch {
            SocialStore.shared.present(error, quiet: true)
        }
    }

    // MARK: Moderator

    func create(in group: SocialGroup, title: String, topic: String, template: BoardTemplate) async -> Board? {
        var created: Board?
        let done = await act { api in
            created = try await api.createBoard(group: group.id, title: title, topic: topic, template: template.rawValue)
        }
        if done { await refreshBoards(group) }
        return created
    }

    func accept(_ block: BoardBlock, in board: Board) async {
        await change(board) { api in try await api.call("accept_block", ["p_block": block.id.uuidString.lowercased()]) }
    }

    func reject(_ block: BoardBlock, in board: Board) async {
        await change(board) { api in try await api.call("reject_block", ["p_block": block.id.uuidString.lowercased()]) }
    }

    func setStatus(_ status: String, of board: Board) async {
        await change(board) { api in
            try await api.call("set_board_status", ["p_board": board.id.uuidString.lowercased(), "p_status": status])
        }
    }

    func finalize(_ board: Board) async {
        await change(board) { api in try await api.call("finalize_board", ["p_board": board.id.uuidString.lowercased()]) }
    }

    func restore(_ version: BoardVersion, in board: Board) async {
        await change(board) { api in try await api.call("restore_board_version", ["p_version": version.id.uuidString.lowercased()]) }
        await refreshVersions(board)
    }

    func startPoll(in board: Board, question: String, blocks: [UUID]) async {
        await change(board) { api in _ = try await api.startPoll(board: board.id, question: question, blocks: blocks) }
    }

    func closePoll(_ poll: BoardPoll, in board: Board) async {
        await change(board) { api in try await api.call("close_poll", ["p_poll": poll.id.uuidString.lowercased()]) }
    }

    // MARK: Everybody

    /// A contribution. A moderator can have it accepted at once.
    func propose(
        to board: Board, kind: BlockKind, title: String, body: String, replacing: UUID? = nil, image: Data? = nil, acceptNow: Bool = false
    ) async -> Bool {
        let done = await act { api in
            let id = UUID()
            var path: String?
            if let image {
                let target = Social.storagePath(group: board.groupId, fileName: "skizze.jpg")
                try await api.upload(image, to: target, contentType: "image/jpeg")
                path = target
            }
            try await api.proposeBlock(
                id: id, board: board.id, kind: kind.rawValue, title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                body: body.trimmingCharacters(in: .whitespacesAndNewlines), replaces: replacing, attachmentPath: path
            )
            if acceptNow { try await api.call("accept_block", ["p_block": id.uuidString.lowercased()]) }
        }
        await refresh(board)
        return done
    }

    func edit(_ block: BoardBlock, title: String, body: String, in board: Board) async -> Bool {
        let done = await act { api in
            _ = try await api.editBlock(block.id, title: title.trimmingCharacters(in: .whitespacesAndNewlines), body: body.trimmingCharacters(in: .whitespacesAndNewlines), rev: block.rev)
        }
        await refresh(board)
        return done
    }

    func withdraw(_ block: BoardBlock, in board: Board) async {
        await change(board) { api in try await api.call("withdraw_block", ["p_block": block.id.uuidString.lowercased()]) }
    }

    func vote(_ poll: BoardPoll, for block: UUID, in board: Board) async {
        await change(board) { api in
            try await api.call("vote", ["p_poll": poll.id.uuidString.lowercased(), "p_block": block.uuidString.lowercased()])
        }
    }

    // MARK: Plumbing

    private func change(_ board: Board, _ work: (SocialAPI) async throws -> Void) async {
        _ = await act(work)
        await refresh(board)
    }

    private func act(_ work: (SocialAPI) async throws -> Void) async -> Bool {
        guard let api else {
            SocialStore.shared.present(SocialError.notConfigured)
            return false
        }
        busy = true
        defer { busy = false }
        do {
            try await work(api)
            return true
        } catch {
            SocialStore.shared.present(error)
            return false
        }
    }
}

/// Pictures for the Tafelbild and the finished result as a PDF.
enum BoardExport {
    /// A photo for a sketch block: at most 1600 points on the long side, JPEG.
    static func jpeg(from data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        let scale = longest > 1600 ? 1600 / longest : 1
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return resized.jpegData(compressionQuality: 0.8)
    }

    /// The finished result as an A4 PDF; long results run over onto more pages.
    static func pdf(board: Board, groupName: String, blocks: [BoardBlock]) -> Data {
        let text = attributed(board: board, groupName: groupName, blocks: blocks)
        let page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let margin: CGFloat = 48
        let area = CGRect(x: margin, y: margin, width: page.width - 2 * margin, height: page.height - 2 * margin)
        let framesetter = CTFramesetterCreateWithAttributedString(text)
        return UIGraphicsPDFRenderer(bounds: page).pdfData { context in
            var location = 0
            repeat {
                context.beginPage()
                let cg = context.cgContext
                cg.saveGState()
                cg.translateBy(x: 0, y: page.height)
                cg.scaleBy(x: 1, y: -1)
                let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: location, length: 0), CGPath(rect: area, transform: nil), nil)
                CTFrameDraw(frame, cg)
                cg.restoreGState()
                location += max(1, CTFrameGetVisibleStringRange(frame).length)
            } while location < text.length
        }
    }

    private static func attributed(board: Board, groupName: String, blocks: [BoardBlock]) -> NSAttributedString {
        let result = NSMutableAttributedString()
        func add(_ text: String, font: UIFont, color: UIColor = .black, before: CGFloat = 0, after: CGFloat = 4) {
            let style = NSMutableParagraphStyle()
            style.paragraphSpacingBefore = before
            style.paragraphSpacing = after
            result.append(NSAttributedString(string: text + "\n", attributes: [.font: font, .foregroundColor: color, .paragraphStyle: style]))
        }
        add(board.title, font: .boldSystemFont(ofSize: 24), after: 2)
        add("\(groupName) · \(board.dateLabel)", font: .systemFont(ofSize: 11), color: .darkGray, after: board.topic.isEmpty ? 10 : 2)
        if !board.topic.isEmpty { add(board.topic, font: .systemFont(ofSize: 13), color: .darkGray, after: 10) }
        for section in BoardLogic.sections(template: board.kind, blocks: blocks) {
            add(section.kind.title.uppercased(), font: .boldSystemFont(ofSize: 10.5), color: .gray, before: 14, after: 4)
            let mono = section.kind == .formula || section.kind == .equation
            let plain = UIFont.systemFont(ofSize: 13)
            let bodyFont: UIFont = mono ? (UIFont(name: "Menlo", size: 12.5) ?? plain) : plain
            for block in section.blocks {
                if !block.title.isEmpty { add(block.title, font: .boldSystemFont(ofSize: 14), after: 2) }
                if !block.body.isEmpty { add(block.body, font: bodyFont, after: 8) }
                if block.attachmentPath != nil { add("(Bild im Tafelbild)", font: .italicSystemFont(ofSize: 11), color: .gray, after: 8) }
            }
        }
        let summary = BoardLogic.stats(blocks)
        add(
            "Erarbeitet von \(groupName): \(summary.accepted) Beiträge übernommen, \(summary.people) Beteiligte",
            font: .systemFont(ofSize: 10.5), color: .gray, before: 22
        )
        return result
    }
}
