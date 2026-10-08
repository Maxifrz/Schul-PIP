import Foundation

/// The Tafelbild calls: boards, contributions, polls and versions (see supabase/board.sql).
extension SocialAPI {
    func boards(in group: UUID) async throws -> [Board] {
        try await get("/rest/v1/boards", [
            ("select", "*"),
            ("group_id", "eq.\(group.uuidString.lowercased())"),
            ("order", "lesson_date.desc,created_at.desc"),
        ])
    }

    func boardBlocks(in board: UUID) async throws -> [BoardBlock] {
        try await get("/rest/v1/board_blocks", [
            ("select", "*,profiles(display_name)"),
            ("board_id", "eq.\(board.uuidString.lowercased())"),
            ("order", "position.asc,created_at.asc"),
        ])
    }

    func polls(in board: UUID) async throws -> [BoardPoll] {
        try await get("/rest/v1/polls", [
            ("select", "*,poll_options(block_id)"),
            ("board_id", "eq.\(board.uuidString.lowercased())"),
            ("order", "created_at.asc"),
        ])
    }

    func pollCounts(in board: UUID) async throws -> [PollCount] {
        try await rpc("poll_counts", ["p_board": board.uuidString.lowercased()])
    }

    func myVotes(in board: UUID) async throws -> [PollVote] {
        try await rpc("my_votes", ["p_board": board.uuidString.lowercased()])
    }

    func versions(of board: UUID) async throws -> [BoardVersion] {
        try await get("/rest/v1/board_versions", [
            ("select", "id,board_id,label,created_at,profiles(display_name)"),
            ("board_id", "eq.\(board.uuidString.lowercased())"),
            ("order", "created_at.desc"),
            ("limit", "100"),
        ])
    }

    func createBoard(group: UUID, title: String, topic: String, template: String) async throws -> Board {
        try await rpc("create_board", [
            "p_group": group.uuidString.lowercased(), "p_title": title, "p_topic": topic, "p_template": template,
        ])
    }

    func proposeBlock(
        id: UUID, board: UUID, kind: String, title: String, body: String, replaces: UUID?, attachmentPath: String?
    ) async throws {
        guard let user = current?.userId else { throw SocialError.signedOut }
        var row: [String: Any] = [
            "id": id.uuidString.lowercased(), "board_id": board.uuidString.lowercased(), "kind": kind,
            "title": title, "body": body, "author": user.uuidString.lowercased(),
        ]
        if let replaces { row["replaces_block"] = replaces.uuidString.lowercased() }
        if let attachmentPath { row["attachment_path"] = attachmentPath }
        _ = try await authorized("POST", "/rest/v1/board_blocks", body: JSONSerialization.data(withJSONObject: row))
    }

    func editBlock(_ id: UUID, title: String, body: String, rev: Int) async throws -> BoardBlock {
        try await rpc("edit_block", ["p_block": id.uuidString.lowercased(), "p_title": title, "p_body": body, "p_rev": rev])
    }

    func startPoll(board: UUID, question: String, blocks: [UUID]) async throws -> BoardPoll {
        try await rpc("start_poll", [
            "p_board": board.uuidString.lowercased(), "p_question": question, "p_blocks": blocks.map { $0.uuidString.lowercased() },
        ])
    }
}
