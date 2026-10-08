import Foundation

/// Talks to a Supabase project over plain HTTPS: sign-in (GoTrue), tables and functions (PostgREST) and files (Storage).
/// No SDK, so the app has no extra dependency. Tokens are refreshed before they run out.
actor SocialAPI {
    private let server: SocialServer
    private let session: URLSession
    private(set) var current: SocialSession?
    private let onRefresh: (@Sendable (SocialSession?) -> Void)?

    init(server: SocialServer, current: SocialSession?, session: URLSession = .shared, onRefresh: (@Sendable (SocialSession?) -> Void)? = nil) {
        self.server = server
        self.current = current
        self.session = session
        self.onRefresh = onRefresh
    }

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }()

    // MARK: Account

    private struct AuthResponse: Decodable {
        struct User: Decodable {
            struct Meta: Decodable { let displayName: String? }
            let id: UUID
            let email: String?
            let userMetadata: Meta?
        }
        let accessToken: String?
        let refreshToken: String?
        let expiresIn: Double?
        let user: User?
    }

    func signUp(name: String, email: String, password: String) async throws -> SocialSession {
        let body = try JSONSerialization.data(withJSONObject: [
            "email": email, "password": password, "data": ["display_name": name],
        ])
        let (data, _) = try await send("POST", "/auth/v1/signup", body: body, authorized: false)
        guard let created = try? Self.decoder.decode(AuthResponse.self, from: data),
              let access = created.accessToken, !access.isEmpty
        else { throw SocialError.confirmEmail }
        return adopt(created, fallbackName: name, fallbackEmail: email)
    }

    func signIn(email: String, password: String) async throws -> SocialSession {
        let body = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let (data, _) = try await send("POST", "/auth/v1/token", query: [("grant_type", "password")], body: body, authorized: false)
        let response = try Self.decoder.decode(AuthResponse.self, from: data)
        return adopt(response, fallbackName: nil, fallbackEmail: email)
    }

    func signOut() {
        current = nil
    }

    private func adopt(_ response: AuthResponse, fallbackName: String?, fallbackEmail: String) -> SocialSession {
        let user = response.user
        let result = SocialSession(
            accessToken: response.accessToken ?? "",
            refreshToken: response.refreshToken ?? "",
            expiresAt: Date().timeIntervalSince1970 + (response.expiresIn ?? 3600),
            userId: user?.id ?? current?.userId ?? UUID(),
            email: user?.email ?? fallbackEmail,
            name: user?.userMetadata?.displayName ?? fallbackName ?? fallbackEmail
        )
        current = result
        return result
    }

    private func refreshIfNeeded() async throws {
        guard let session = current else { throw SocialError.signedOut }
        guard session.expiresAt - Date().timeIntervalSince1970 < 60 else { return }
        let body = try JSONSerialization.data(withJSONObject: ["refresh_token": session.refreshToken])
        do {
            let (data, _) = try await send("POST", "/auth/v1/token", query: [("grant_type", "refresh_token")], body: body, authorized: false)
            let response = try Self.decoder.decode(AuthResponse.self, from: data)
            let renewed = adopt(response, fallbackName: session.name, fallbackEmail: session.email)
            onRefresh?(renewed)
        } catch {
            current = nil
            onRefresh?(nil)
            throw SocialError.signedOut
        }
    }

    // MARK: Data

    func groups() async throws -> [SocialGroup] {
        try await get("/rest/v1/groups", [("select", "*"), ("order", "created_at.asc")])
    }

    func membershipIDs() async throws -> Set<UUID> {
        struct Row: Decodable { let groupId: UUID }
        guard let user = current?.userId else { throw SocialError.signedOut }
        let rows: [Row] = try await get("/rest/v1/members", [("select", "group_id"), ("user_id", "eq.\(user.uuidString.lowercased())")])
        return Set(rows.map(\.groupId))
    }

    func members(of group: UUID) async throws -> [SocialMember] {
        try await get("/rest/v1/members", [
            ("select", "user_id,role,profiles(display_name)"),
            ("group_id", "eq.\(group.uuidString.lowercased())"),
            ("order", "joined_at.asc"),
        ])
    }

    func messages(in group: UUID, after: String?) async throws -> [SocialMessage] {
        var query: [(String, String)] = [
            ("select", "id,group_id,user_id,body,attachment_path,attachment_name,created_at,profiles(display_name)"),
            ("group_id", "eq.\(group.uuidString.lowercased())"),
            ("order", after == nil ? "created_at.desc" : "created_at.asc"),
            ("limit", "200"),
        ]
        if let after { query.append(("created_at", "gt.\(after)")) }
        let rows: [SocialMessage] = try await get("/rest/v1/messages", query)
        return Social.merge([], rows)
    }

    func results(in group: UUID) async throws -> [SocialResult] {
        try await get("/rest/v1/results", [
            ("select", "id,group_id,user_id,title,path,file_name,created_at,profiles(display_name)"),
            ("group_id", "eq.\(group.uuidString.lowercased())"),
            ("order", "created_at.desc"),
        ])
    }

    func createGroup(name: String, kind: String, parent: UUID?) async throws -> SocialGroup {
        var params: [String: Any] = ["p_name": name, "p_kind": kind]
        if let parent { params["p_parent"] = parent.uuidString.lowercased() }
        return try await rpc("create_group", params)
    }

    func joinGroup(code: String) async throws -> SocialGroup {
        try await rpc("join_group", ["p_code": code])
    }

    func joinSubgroup(_ group: UUID) async throws -> SocialGroup {
        try await rpc("join_subgroup", ["p_group": group.uuidString.lowercased()])
    }

    func leaveGroup(_ group: UUID) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["p_group": group.uuidString.lowercased()])
        _ = try await authorized("POST", "/rest/v1/rpc/leave_group", body: body)
    }

    func sendMessage(group: UUID, body text: String, attachmentPath: String? = nil, attachmentName: String? = nil) async throws {
        guard let user = current?.userId else { throw SocialError.signedOut }
        var row: [String: Any] = ["group_id": group.uuidString.lowercased(), "user_id": user.uuidString.lowercased(), "body": text]
        if let attachmentPath { row["attachment_path"] = attachmentPath }
        if let attachmentName { row["attachment_name"] = attachmentName }
        _ = try await authorized("POST", "/rest/v1/messages", body: JSONSerialization.data(withJSONObject: row))
    }

    func deleteMessage(_ id: UUID) async throws {
        _ = try await authorized("DELETE", "/rest/v1/messages", query: [("id", "eq.\(id.uuidString.lowercased())")])
    }

    func addResult(group: UUID, title: String, path: String, fileName: String) async throws {
        guard let user = current?.userId else { throw SocialError.signedOut }
        let row: [String: Any] = [
            "group_id": group.uuidString.lowercased(), "user_id": user.uuidString.lowercased(),
            "title": title, "path": path, "file_name": fileName,
        ]
        _ = try await authorized("POST", "/rest/v1/results", body: JSONSerialization.data(withJSONObject: row))
    }

    func deleteResult(_ id: UUID) async throws {
        _ = try await authorized("DELETE", "/rest/v1/results", query: [("id", "eq.\(id.uuidString.lowercased())")])
    }

    func report(message: UUID, reason: String) async throws {
        guard let user = current?.userId else { throw SocialError.signedOut }
        let row: [String: Any] = ["message_id": message.uuidString.lowercased(), "reporter": user.uuidString.lowercased(), "reason": reason]
        _ = try await authorized("POST", "/rest/v1/reports", body: JSONSerialization.data(withJSONObject: row))
    }

    // MARK: Files

    func upload(_ data: Data, to path: String, contentType: String) async throws {
        guard data.count <= Social.maxFileBytes else { throw SocialError.tooLarge }
        _ = try await authorized("POST", "/storage/v1/object/files/\(path)", body: data, headers: ["Content-Type": contentType])
    }

    func download(_ path: String) async throws -> Data {
        try await authorized("GET", "/storage/v1/object/authenticated/files/\(path)")
    }

    // MARK: Plumbing

    func get<T: Decodable>(_ path: String, _ query: [(String, String)]) async throws -> T {
        let data = try await authorized("GET", path, query: query)
        return try decode(data)
    }

    func rpc<T: Decodable>(_ name: String, _ params: [String: Any]) async throws -> T {
        let body = try JSONSerialization.data(withJSONObject: params)
        let data = try await authorized("POST", "/rest/v1/rpc/\(name)", body: body)
        return try decode(data)
    }

    func call(_ name: String, _ params: [String: Any]) async throws {
        let body = try JSONSerialization.data(withJSONObject: params)
        _ = try await authorized("POST", "/rest/v1/rpc/\(name)", body: body)
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try Self.decoder.decode(T.self, from: data)
        } catch {
            throw SocialError.server("Die Antwort des Servers ist unerwartet. Stimmt das Schema (supabase/schema.sql)?")
        }
    }

    func authorized(_ method: String, _ path: String, query: [(String, String)] = [], body: Data? = nil, headers: [String: String] = [:]) async throws -> Data {
        try await refreshIfNeeded()
        return try await send(method, path, query: query, body: body, headers: headers, authorized: true).0
    }

    private func send(
        _ method: String, _ path: String, query: [(String, String)] = [], body: Data? = nil,
        headers: [String: String] = [:], authorized: Bool
    ) async throws -> (Data, HTTPURLResponse) {
        var text = server.url.absoluteString + path
        if !query.isEmpty { text += "?" + Social.queryString(query) }
        guard let url = URL(string: text) else { throw SocialError.notConfigured }
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = method
        request.httpBody = body
        request.setValue(server.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer " + (authorized ? (current?.accessToken ?? server.anonKey) : server.anonKey), forHTTPHeaderField: "Authorization")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if method == "POST", path.hasPrefix("/rest/v1/"), !path.contains("/rpc/") {
            request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        }
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw SocialError.offline
        }
        guard let http = response as? HTTPURLResponse else { throw SocialError.offline }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401, authorized { throw SocialError.signedOut }
            throw SocialError.server(Social.german(Self.message(in: data, status: http.statusCode)))
        }
        return (data, http)
    }

    private static func message(in data: Data, status: Int) -> String {
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            for key in ["message", "msg", "error_description", "error"] {
                if let text = object[key] as? String, !text.isEmpty { return text }
            }
        }
        return "Der Server meldet einen Fehler (\(status))."
    }
}
