import Foundation
import SwiftUI

/// The state of the Kurs tab: which server, who is signed in, the groups, and the chat of the group on screen.
@MainActor
final class SocialStore: ObservableObject {
    static let shared = SocialStore()

    enum Phase: Equatable {
        case unconfigured, signedOut, signedIn
    }

    private static let urlKey = "social.server.url"
    private static let anonKey = "social.server.anon"
    private static let sessionAccount = "social.session"

    @Published private(set) var phase: Phase = .unconfigured
    @Published private(set) var me: SocialSession?
    @Published private(set) var groups: [SocialGroup] = []
    @Published private(set) var joinable: [SocialGroup] = []
    @Published private(set) var messages: [UUID: [SocialMessage]] = [:]
    @Published private(set) var results: [UUID: [SocialResult]] = [:]
    @Published private(set) var members: [UUID: [SocialMember]] = [:]
    @Published var busy = false
    @Published var error: String?

    private var api: SocialAPI?
    private var server: SocialServer?

    private init() {
        let defaults = UserDefaults.standard
        if let text = defaults.string(forKey: Self.urlKey), let key = defaults.string(forKey: Self.anonKey),
           let url = Social.checkServer(text).url, !key.isEmpty {
            connect(SocialServer(url: url, anonKey: key), restoreSession: true)
        }
    }

    /// For the board store, which talks to the same server.
    var apiClient: SocialAPI? { api }

    func present(_ failure: Error, quiet: Bool = false) {
        handle(failure, quiet: quiet)
    }

    /// True for the founder and for members the founder made moderators.
    func isModerator(in group: UUID) -> Bool {
        guard let me = me?.userId else { return false }
        let role = members[group]?.first { $0.userId == me }?.role
        return role == "owner" || role == "mod"
    }

    func setRole(_ role: String, of user: UUID, in group: SocialGroup) async {
        await run(showBusy: false) { api in
            try await api.call("set_member_role", ["p_group": group.id.uuidString.lowercased(), "p_user": user.uuidString.lowercased(), "p_role": role])
        }
        await refreshMembers(group)
    }

    var serverText: String { UserDefaults.standard.string(forKey: Self.urlKey) ?? "" }

    // MARK: Server and account

    func saveServer(url text: String, key: String) -> String? {
        let check = Social.checkServer(text)
        guard let url = check.url else { return Social.addressMessage(check) }
        let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedKey.isEmpty else { return "Trag den „anon public“-Schlüssel ein." }
        // The service_role key would hand the app full access to everything; refuse it by its role claim.
        if Self.role(ofKey: trimmedKey) == "service_role" {
            return "Das ist der service_role-Schlüssel. Er darf nie in eine App. Nimm den anon-Schlüssel."
        }
        let defaults = UserDefaults.standard
        defaults.set(url.absoluteString, forKey: Self.urlKey)
        defaults.set(trimmedKey, forKey: Self.anonKey)
        KeychainStore.delete(account: Self.sessionAccount)
        connect(SocialServer(url: url, anonKey: trimmedKey), restoreSession: false)
        return nil
    }

    func forgetServer() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: Self.urlKey)
        defaults.removeObject(forKey: Self.anonKey)
        KeychainStore.delete(account: Self.sessionAccount)
        api = nil
        server = nil
        reset()
        phase = .unconfigured
    }

    /// A Supabase key is a JWT; its middle part says which role it grants.
    nonisolated static func role(ofKey key: String) -> String? {
        let parts = key.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while payload.count % 4 != 0 { payload += "=" }
        guard let data = Data(base64Encoded: payload),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return object["role"] as? String
    }

    private func connect(_ server: SocialServer, restoreSession: Bool) {
        self.server = server
        var stored: SocialSession?
        if restoreSession, let text = KeychainStore.load(account: Self.sessionAccount), let data = text.data(using: .utf8) {
            stored = try? JSONDecoder().decode(SocialSession.self, from: data)
        }
        api = SocialAPI(server: server, current: stored) { renewed in
            Task { @MainActor in SocialStore.shared.storeSession(renewed) }
        }
        me = stored
        phase = stored == nil ? .signedOut : .signedIn
    }

    private func storeSession(_ session: SocialSession?) {
        me = session
        if let session, let data = try? JSONEncoder().encode(session), let text = String(data: data, encoding: .utf8) {
            KeychainStore.save(text, account: Self.sessionAccount)
        } else {
            KeychainStore.delete(account: Self.sessionAccount)
            reset()
            phase = .signedOut
        }
    }

    func signIn(email: String, password: String) async {
        await run { api in
            let session = try await api.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
            self.storeSession(session)
            self.phase = .signedIn
        }
        if phase == .signedIn { await refreshGroups() }
    }

    func signUp(name: String, email: String, password: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            error = "Wie sollen dich die anderen nennen? Trag einen Namen ein."
            return
        }
        await run { api in
            let session = try await api.signUp(name: trimmed, email: email.trimmingCharacters(in: .whitespaces), password: password)
            self.storeSession(session)
            self.phase = .signedIn
        }
        if phase == .signedIn { await refreshGroups() }
    }

    func signOut() async {
        await api?.signOut()
        storeSession(nil)
    }

    private func reset() {
        groups = []
        joinable = []
        messages = [:]
        results = [:]
        members = [:]
        me = nil
    }

    // MARK: Groups

    func refreshGroups() async {
        guard let api else { return }
        do {
            async let all = api.groups()
            async let mine = api.membershipIDs()
            let (visible, ids) = try await (all, mine)
            groups = visible.filter { ids.contains($0.id) }
            joinable = visible.filter { !ids.contains($0.id) }
        } catch {
            handle(error)
        }
    }

    func createGroup(name: String, parent: SocialGroup?) async -> SocialGroup? {
        var created: SocialGroup?
        await run { api in
            created = try await api.createGroup(name: name, kind: parent == nil ? "course" : "group", parent: parent?.id)
        }
        if created != nil { await refreshGroups() }
        return created
    }

    func join(code: String) async -> SocialGroup? {
        var joined: SocialGroup?
        await run { api in joined = try await api.joinGroup(code: Social.normalizeCode(code)) }
        if joined != nil { await refreshGroups() }
        return joined
    }

    func join(subgroup: SocialGroup) async {
        await run { api in _ = try await api.joinSubgroup(subgroup.id) }
        await refreshGroups()
    }

    func leave(_ group: SocialGroup) async {
        await run { api in try await api.leaveGroup(group.id) }
        await refreshGroups()
    }

    func subgroups(of course: SocialGroup) -> (mine: [SocialGroup], open: [SocialGroup]) {
        (groups.filter { $0.parentId == course.id }, joinable.filter { $0.parentId == course.id })
    }

    // MARK: Chat

    /// Fetches what is new in a group's chat; the first call loads the latest messages.
    func refreshMessages(_ group: SocialGroup) async {
        guard let api else { return }
        let known = messages[group.id] ?? []
        do {
            let fresh = try await api.messages(in: group.id, after: known.last?.createdAt)
            guard !fresh.isEmpty else { return }
            messages[group.id] = Social.merge(known, fresh)
        } catch {
            handle(error, quiet: true)
        }
    }

    func send(_ text: String, in group: SocialGroup) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        await run(showBusy: false) { api in
            try await api.sendMessage(group: group.id, body: String(trimmed.prefix(Social.maxMessageLength)))
        }
        await refreshMessages(group)
    }

    func sendFile(_ url: URL, in group: SocialGroup, note: String = "") async {
        await run { api in
            let upload = try Self.read(url)
            let path = Social.storagePath(group: group.id, fileName: upload.name)
            try await api.upload(upload.data, to: path, contentType: upload.type)
            try await api.sendMessage(group: group.id, body: note, attachmentPath: path, attachmentName: upload.name)
        }
        await refreshMessages(group)
    }

    func delete(_ message: SocialMessage) async {
        await run(showBusy: false) { api in try await api.deleteMessage(message.id) }
        messages[message.groupId]?.removeAll { $0.id == message.id }
    }

    func report(_ message: SocialMessage) async {
        await run(showBusy: false) { api in try await api.report(message: message.id, reason: "") }
        if error == nil { error = "Danke, die Meldung ist angekommen." }
    }

    // MARK: Results and members

    func refreshResults(_ group: SocialGroup) async {
        guard let api else { return }
        do {
            results[group.id] = try await api.results(in: group.id)
        } catch {
            handle(error, quiet: true)
        }
    }

    func addResult(_ url: URL, title: String, in group: SocialGroup) async {
        await run { api in
            let upload = try Self.read(url)
            let path = Social.storagePath(group: group.id, fileName: upload.name)
            try await api.upload(upload.data, to: path, contentType: upload.type)
            try await api.addResult(group: group.id, title: title, path: path, fileName: upload.name)
        }
        await refreshResults(group)
    }

    func delete(_ result: SocialResult) async {
        await run(showBusy: false) { api in try await api.deleteResult(result.id) }
        results[result.groupId]?.removeAll { $0.id == result.id }
    }

    func refreshMembers(_ group: SocialGroup) async {
        guard let api else { return }
        do {
            members[group.id] = try await api.members(of: group.id)
        } catch {
            handle(error, quiet: true)
        }
    }

    /// Downloads a file of a group into a temporary file with its own name, ready to be imported into the library.
    func download(path: String, name: String) async -> URL? {
        var file: URL?
        await run { api in
            let data = try await api.download(path)
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let target = folder.appendingPathComponent(name.isEmpty ? "Datei" : name)
            try data.write(to: target)
            file = target
        }
        return file
    }

    // MARK: Plumbing

    private struct Upload {
        let data: Data
        let name: String
        let type: String
    }

    private nonisolated static func read(_ url: URL) throws -> Upload {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard size <= Social.maxFileBytes else { throw SocialError.tooLarge }
        let data = try Data(contentsOf: url)
        guard data.count <= Social.maxFileBytes else { throw SocialError.tooLarge }
        let type: String
        switch url.pathExtension.lowercased() {
        case "pdf": type = "application/pdf"
        case "png": type = "image/png"
        case "jpg", "jpeg": type = "image/jpeg"
        case "docx": type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        case "txt": type = "text/plain"
        default: type = "application/octet-stream"
        }
        return Upload(data: data, name: url.lastPathComponent, type: type)
    }

    private func run(showBusy: Bool = true, _ work: (SocialAPI) async throws -> Void) async {
        guard let api else {
            error = SocialError.notConfigured.errorDescription
            return
        }
        if showBusy { busy = true }
        error = nil
        defer { if showBusy { busy = false } }
        do {
            try await work(api)
        } catch {
            handle(error)
        }
    }

    private func handle(_ failure: Error, quiet: Bool = false) {
        if let social = failure as? SocialError {
            if social == .signedOut {
                storeSession(nil)
                error = social.errorDescription
                return
            }
            if !quiet || social != .offline { error = social.errorDescription }
            return
        }
        if !quiet { error = failure.localizedDescription }
    }
}
