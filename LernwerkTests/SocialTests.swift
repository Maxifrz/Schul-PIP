import XCTest
@testable import Lernwerk

final class SocialTests: XCTestCase {
    // MARK: Pure helpers

    func testServerAddressIsReducedToTheProjectBase() {
        XCTAssertEqual(Social.checkServer("https://abc.supabase.co").url?.absoluteString, "https://abc.supabase.co")
        XCTAssertEqual(Social.checkServer(" https://abc.supabase.co/rest/v1/?x=1 ").url?.absoluteString, "https://abc.supabase.co")
        XCTAssertEqual(Social.checkServer("http://192.168.1.5:54321").url?.absoluteString, "http://192.168.1.5:54321")
        XCTAssertEqual(Social.checkServer("http://example.com"), .insecureRemote)
        XCTAssertEqual(Social.checkServer("abc.supabase.co"), .invalid)
        XCTAssertEqual(Social.checkServer(""), .empty)
        XCTAssertNotNil(Social.addressMessage(.invalid))
        XCTAssertNil(Social.addressMessage(Social.checkServer("https://abc.supabase.co")))
    }

    func testJoinCodesIgnoreCaseSpacesAndDashes() {
        XCTAssertEqual(Social.normalizeCode(" k7m-2qx "), "K7M2QX")
        XCTAssertEqual(Social.normalizeCode("K7M 2QX\n"), "K7M2QX")
    }

    func testStoragePathStartsWithTheGroupFolderAndIsSafe() {
        let group = UUID()
        let path = Social.storagePath(group: group, fileName: "Übungsblatt Nr. 3 (final)!.PDF")
        XCTAssertTrue(path.hasPrefix(group.uuidString.lowercased() + "/"))
        XCTAssertTrue(path.hasSuffix(".pdf"))
        let name = String(path.dropFirst(group.uuidString.count + 1))
        XCTAssertFalse(name.contains(" "))
        XCTAssertFalse(name.contains("("))
        XCTAssertTrue(name.contains("Ubungsblatt") || name.contains("ubungsblatt") || name.contains("Übungsblatt"))
        XCTAssertNotEqual(path, Social.storagePath(group: group, fileName: "Übungsblatt Nr. 3 (final)!.PDF"))
        XCTAssertTrue(Social.storagePath(group: group, fileName: "???").contains("/"))
    }

    func testQueryValuesAreEncodedSoPlusSurvives() {
        let text = Social.queryString([("created_at", "gt.2026-10-06T12:00:00.123456+00:00"), ("select", "id,profiles(display_name)")])
        XCTAssertEqual(text, "created_at=gt.2026-10-06T12%3A00%3A00.123456%2B00%3A00&select=id,profiles(display_name)")
    }

    private func message(_ id: String, _ at: String) -> SocialMessage {
        SocialMessage(
            id: UUID(uuidString: id)!, groupId: UUID(), userId: UUID(), body: id, attachmentPath: nil,
            attachmentName: nil, createdAt: at, profiles: nil
        )
    }

    func testMergeKeepsMessagesOrderedAndUnique() {
        let a = message("00000000-0000-0000-0000-00000000000A", "2026-10-06T12:00:00.100000+00:00")
        let b = message("00000000-0000-0000-0000-00000000000B", "2026-10-06T12:00:00.200000+00:00")
        let c = message("00000000-0000-0000-0000-00000000000C", "2026-10-06T12:00:01.000000+00:00")
        XCTAssertEqual(Social.merge([a, c], [b, c]).map(\.id), [a.id, b.id, c.id])
        XCTAssertEqual(Social.merge([], []).count, 0)
    }

    func testServerMessagesAreShownInGerman() {
        XCTAssertEqual(Social.german("Invalid login credentials"), "E-Mail oder Passwort stimmt nicht.")
        XCTAssertEqual(Social.german("User already registered"), "Diese E-Mail ist schon registriert. Melde dich an.")
        XCTAssertEqual(Social.german("Diesen Code gibt es nicht."), "Diesen Code gibt es nicht.")
    }

    func testTimestampsFromPostgresParseAndLabel() {
        XCTAssertNotNil(Social.parse("2026-10-06T12:41:09.123456+00:00"))
        XCTAssertNotNil(Social.parse("2026-10-06T12:41:09+00:00"))
        XCTAssertNil(Social.parse("gestern"))
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let now = Social.parse("2026-10-06T20:00:00+00:00")!
        XCTAssertEqual(Social.timeLabel("2026-10-06T12:05:09.5+00:00", now: now, calendar: calendar), "12:05")
        XCTAssertEqual(Social.timeLabel("2026-10-05T07:30:00+00:00", now: now, calendar: calendar), "5. Okt, 7:30")
    }

    func testTheServiceRoleKeyIsRecognisedByItsRole() {
        func key(_ role: String) -> String {
            let payload = Data(#"{"role":"\#(role)"}"#.utf8).base64EncodedString()
                .replacingOccurrences(of: "=", with: "").replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
            return "e30.\(payload).sig"
        }
        XCTAssertEqual(SocialStore.role(ofKey: key("service_role")), "service_role")
        XCTAssertEqual(SocialStore.role(ofKey: key("anon")), "anon")
        XCTAssertNil(SocialStore.role(ofKey: "not-a-jwt"))
    }

    // MARK: Requests

    private func api(_ replies: [(Int, String)], session: SocialSession? = nil) -> SocialAPI {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SocialProtocol.self]
        SocialProtocol.reset(replies: replies)
        return SocialAPI(
            server: SocialServer(url: URL(string: "https://abc.supabase.co")!, anonKey: "anon-key"),
            current: session, session: URLSession(configuration: configuration)
        )
    }

    private let valid = SocialSession(
        accessToken: "access", refreshToken: "refresh", expiresAt: Date().timeIntervalSince1970 + 3600,
        userId: UUID(uuidString: "11111111-1111-1111-1111-111111111111")!, email: "a@b.de", name: "Anna"
    )

    func testSignInReadsTheSessionAndSendsTheKeys() async throws {
        let client = api([(200, #"{"access_token":"tok","refresh_token":"ref","expires_in":3600,"user":{"id":"22222222-2222-2222-2222-222222222222","email":"a@b.de","user_metadata":{"display_name":"Anna"}}}"#)])
        let session = try await client.signIn(email: "a@b.de", password: "geheim1")
        XCTAssertEqual(session.accessToken, "tok")
        XCTAssertEqual(session.name, "Anna")
        XCTAssertEqual(session.userId.uuidString, "22222222-2222-2222-2222-222222222222")
        XCTAssertEqual(SocialProtocol.requests.first?.url, "https://abc.supabase.co/auth/v1/token?grant_type=password")
        XCTAssertEqual(SocialProtocol.requests.first?.apikey, "anon-key")
        XCTAssertEqual(SocialProtocol.requests.first?.authorization, "Bearer anon-key")
        XCTAssertTrue(SocialProtocol.requests.first?.body.contains("geheim1") == true)
    }

    func testSignUpWithoutATokenMeansConfirmTheEmail() async {
        let client = api([(200, #"{"id":"22222222-2222-2222-2222-222222222222","email":"a@b.de"}"#)])
        do {
            _ = try await client.signUp(name: "Anna", email: "a@b.de", password: "geheim1")
            XCTFail("expected confirmEmail")
        } catch {
            XCTAssertEqual(error as? SocialError, .confirmEmail)
        }
    }

    func testWrongPasswordGivesAGermanMessage() async {
        let client = api([(400, #"{"error":"invalid_grant","error_description":"Invalid login credentials"}"#)])
        do {
            _ = try await client.signIn(email: "a@b.de", password: "x")
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? SocialError, .server("E-Mail oder Passwort stimmt nicht."))
        }
    }

    func testNewMessagesAreRequestedAfterTheLastOneWithAnEncodedTimestamp() async throws {
        let group = UUID(uuidString: "33333333-3333-3333-3333-333333333333")!
        let client = api([(200, #"[{"id":"44444444-4444-4444-4444-444444444444","group_id":"33333333-3333-3333-3333-333333333333","user_id":"11111111-1111-1111-1111-111111111111","body":"Hallo","attachment_path":null,"attachment_name":null,"created_at":"2026-10-06T12:00:01.5+00:00","profiles":{"display_name":"Anna"}}]"#)], session: valid)
        let messages = try await client.messages(in: group, after: "2026-10-06T12:00:00.123456+00:00")
        XCTAssertEqual(messages.first?.author, "Anna")
        XCTAssertEqual(messages.first?.body, "Hallo")
        let url = try XCTUnwrap(SocialProtocol.requests.first?.url)
        XCTAssertTrue(url.contains("group_id=eq.33333333-3333-3333-3333-333333333333"))
        XCTAssertTrue(url.contains("created_at=gt.2026-10-06T12%3A00%3A00.123456%2B00%3A00"))
        XCTAssertTrue(url.contains("order=created_at.asc"))
        XCTAssertEqual(SocialProtocol.requests.first?.authorization, "Bearer access")
    }

    func testJoiningCallsTheFunctionWithTheCodeAndDecodesTheGroup() async throws {
        let client = api([(200, #"{"id":"55555555-5555-5555-5555-555555555555","parent_id":null,"name":"Mathe LK","kind":"course","join_code":"K7M2QX","created_at":"2026-10-06T12:00:00+00:00"}"#)], session: valid)
        let group = try await client.joinGroup(code: "K7M2QX")
        XCTAssertEqual(group.name, "Mathe LK")
        XCTAssertTrue(group.isCourse)
        XCTAssertNil(group.parentId)
        XCTAssertEqual(SocialProtocol.requests.first?.url, "https://abc.supabase.co/rest/v1/rpc/join_group")
        XCTAssertTrue(SocialProtocol.requests.first?.body.contains("K7M2QX") == true)
    }

    func testServerRefusalCarriesItsOwnMessage() async {
        let client = api([(400, #"{"message":"Diesen Code gibt es nicht.","code":"P0001"}"#)], session: valid)
        do {
            _ = try await client.joinGroup(code: "NOPE")
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? SocialError, .server("Diesen Code gibt es nicht."))
        }
    }

    func testAnExpiredTokenIsRefreshedBeforeTheRequest() async throws {
        var old = valid
        old.expiresAt = Date().timeIntervalSince1970 - 10
        let client = api([
            (200, #"{"access_token":"fresh","refresh_token":"ref2","expires_in":3600,"user":{"id":"11111111-1111-1111-1111-111111111111","email":"a@b.de"}}"#),
            (200, "[]"),
        ], session: old)
        _ = try await client.groups()
        XCTAssertEqual(SocialProtocol.requests.map(\.url).first, "https://abc.supabase.co/auth/v1/token?grant_type=refresh_token")
        XCTAssertEqual(SocialProtocol.requests.last?.authorization, "Bearer fresh")
    }

    func testOversizedFilesNeverLeaveTheDevice() async {
        let client = api([], session: valid)
        do {
            try await client.upload(Data(count: Social.maxFileBytes + 1), to: "g/x.pdf", contentType: "application/pdf")
            XCTFail("expected tooLarge")
        } catch {
            XCTAssertEqual(error as? SocialError, .tooLarge)
        }
        XCTAssertTrue(SocialProtocol.requests.isEmpty)
    }
}

/// Answers requests from a fixed script and records URL, keys and body of each.
private final class SocialProtocol: URLProtocol {
    struct Seen {
        let url: String
        let apikey: String?
        let authorization: String?
        let body: String
    }

    private static var replies: [(Int, String)] = []
    private(set) static var requests: [Seen] = []

    static func reset(replies: [(Int, String)]) {
        self.replies = replies
        requests = []
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        var body = Data()
        if let data = request.httpBody {
            body = data
        } else if let stream = request.httpBodyStream {
            stream.open()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                guard count > 0 else { break }
                body.append(buffer, count: count)
            }
            stream.close()
        }
        Self.requests.append(Seen(
            url: request.url?.absoluteString ?? "",
            apikey: request.value(forHTTPHeaderField: "apikey"),
            authorization: request.value(forHTTPHeaderField: "authorization"),
            body: String(data: body, encoding: .utf8) ?? ""
        ))
        let (status, text) = Self.replies.isEmpty ? (500, "{}") : Self.replies.removeFirst()
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(text.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
