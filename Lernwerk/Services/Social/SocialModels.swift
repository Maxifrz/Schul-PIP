import Foundation

/// A course or a work group inside a course.
struct SocialGroup: Codable, Identifiable, Equatable, Hashable {
    let id: UUID
    let parentId: UUID?
    let name: String
    let kind: String
    let joinCode: String
    let createdAt: String

    var isCourse: Bool { kind == "course" }
}

struct SocialAuthor: Codable, Equatable, Hashable {
    let displayName: String
}

struct SocialMessage: Codable, Identifiable, Equatable, Hashable {
    let id: UUID
    let groupId: UUID
    let userId: UUID
    let body: String
    let attachmentPath: String?
    let attachmentName: String?
    let createdAt: String
    let profiles: SocialAuthor?

    var author: String { profiles?.displayName ?? "Unbekannt" }
}

struct SocialResult: Codable, Identifiable, Equatable, Hashable {
    let id: UUID
    let groupId: UUID
    let userId: UUID
    let title: String
    let path: String
    let fileName: String
    let createdAt: String
    let profiles: SocialAuthor?

    var author: String { profiles?.displayName ?? "Unbekannt" }
}

struct SocialMember: Codable, Identifiable, Equatable, Hashable {
    let userId: UUID
    let role: String
    let profiles: SocialAuthor?

    var id: UUID { userId }
    var name: String { profiles?.displayName ?? "Unbekannt" }
}

struct SocialSession: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    /// Seconds since 1970 at which the access token stops working.
    var expiresAt: TimeInterval
    var userId: UUID
    var email: String
    var name: String
}

/// The server a student connects the app to: the project address and the public (anon) key.
struct SocialServer: Equatable {
    let url: URL
    let anonKey: String
}

enum SocialError: Error, Equatable, LocalizedError {
    case notConfigured
    case signedOut
    case confirmEmail
    case tooLarge
    case server(String)
    case offline

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Der Server ist noch nicht verbunden."
        case .signedOut: return "Du bist abgemeldet. Melde dich neu an."
        case .confirmEmail: return "Fast geschafft: Bestätige die E-Mail, die du bekommen hast, und melde dich dann an."
        case .tooLarge: return "Die Datei ist größer als 20 MB."
        case let .server(message): return message
        case .offline: return "Keine Verbindung zum Server."
        }
    }
}

enum Social {
    static let maxFileBytes = 20 * 1024 * 1024
    static let maxMessageLength = 4000

    // MARK: Server address

    enum AddressCheck: Equatable {
        case empty
        case invalid
        case insecureRemote
        case valid(URL)

        var url: URL? {
            if case let .valid(url) = self { return url }
            return nil
        }
    }

    /// "https://abc.supabase.co", with or without a trailing slash or path, leads to the project's base address. Plain
    /// http works only for servers in the local network, like the custom AI endpoint.
    static func checkServer(_ text: String) -> AddressCheck {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .empty }
        guard var parts = URLComponents(string: trimmed),
              let scheme = parts.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = parts.host, !host.isEmpty
        else { return .invalid }
        parts.scheme = scheme
        parts.path = ""
        parts.query = nil
        parts.fragment = nil
        parts.user = nil
        parts.password = nil
        guard let url = parts.url else { return .invalid }
        if scheme == "http", !CustomEndpoint.isLocal(host) { return .insecureRemote }
        return .valid(url)
    }

    static func addressMessage(_ check: AddressCheck) -> String? {
        switch check {
        case .empty: return "Trag die Projekt-Adresse ein, z. B. https://abcdefgh.supabase.co."
        case .invalid: return "Das ist keine gültige Adresse. Sie beginnt mit https://."
        case .insecureRemote: return "http:// funktioniert nur im lokalen Netz. Nimm https://."
        case .valid: return nil
        }
    }

    // MARK: Codes, names, queries

    /// What a student typed for a join code: capitals, no spaces or dashes ("abc-12 3" becomes "ABC123").
    static func normalizeCode(_ text: String) -> String {
        String(text.uppercased().filter { $0.isLetter || $0.isNumber })
    }

    /// The folder in the bucket is the group's id, which is what the storage policy checks.
    static func storagePath(group: UUID, fileName: String) -> String {
        let ext = (fileName as NSString).pathExtension.lowercased().filter { $0.isLetter || $0.isNumber }
        let base: String = (fileName as NSString).deletingPathExtension
        let stem: String = base.applyingTransform(.stripDiacritics, reverse: false) ?? base
        var safe = ""
        for character in stem.prefix(40) {
            safe.append(character.isLetter || character.isNumber ? character : "-")
        }
        let name = safe.isEmpty ? "datei" : safe
        let suffix = ext.isEmpty ? "" : "." + String(ext.prefix(8))
        let folder = group.uuidString.lowercased()
        let unique = String(UUID().uuidString.lowercased().prefix(8))
        return "\(folder)/\(unique)-\(name)\(suffix)"
    }

    /// A query string with every value percent-encoded; "+" in a timestamp must not turn into a space.
    static func queryString(_ items: [(String, String)]) -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~*,()")
        var pairs: [String] = []
        for (name, value) in items {
            let key: String = name.addingPercentEncoding(withAllowedCharacters: allowed) ?? name
            let encoded: String = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
            pairs.append(key + "=" + encoded)
        }
        return pairs.joined(separator: "&")
    }

    /// New messages merged into the ones already shown: no duplicates, oldest first.
    static func merge(_ existing: [SocialMessage], _ incoming: [SocialMessage]) -> [SocialMessage] {
        var byID: [UUID: SocialMessage] = [:]
        for message in existing + incoming { byID[message.id] = message }
        return byID.values.sorted { ($0.createdAt, $0.id.uuidString) < ($1.createdAt, $1.id.uuidString) }
    }

    /// "Invalid login credentials" and friends, in German; the server's own German messages pass through.
    static func german(_ message: String) -> String {
        let lower = message.lowercased()
        if lower.contains("invalid login credentials") { return "E-Mail oder Passwort stimmt nicht." }
        if lower.contains("already registered") || lower.contains("already been registered") {
            return "Diese E-Mail ist schon registriert. Melde dich an."
        }
        if lower.contains("email not confirmed") { return "Bestätige zuerst die E-Mail, die du bekommen hast." }
        if lower.contains("password should be at least") { return "Das Passwort braucht mindestens 6 Zeichen." }
        if lower.contains("unable to validate email") || lower.contains("invalid email") { return "Das ist keine gültige E-Mail-Adresse." }
        if lower.contains("rate limit") { return "Zu viele Versuche. Warte einen Moment." }
        if lower.contains("payload too large") || lower.contains("exceeded the maximum") { return "Die Datei ist größer als 20 MB." }
        return message
    }

    /// "12:41" for today's messages, "5. Okt, 12:41" for older ones; the server sends ISO timestamps.
    static func timeLabel(_ iso: String, now: Date = .now, calendar: Calendar = .current) -> String {
        guard let date = parse(iso) else { return "" }
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        let minute = String(format: "%02d", parts.minute ?? 0)
        let clock = "\(parts.hour ?? 0):\(minute)"
        if calendar.isDate(date, inSameDayAs: now) { return clock }
        let day = calendar.dateComponents([.day, .month], from: date)
        let months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
        return "\(day.day ?? 1). \(months[(day.month ?? 1) - 1]), \(clock)"
    }

    static func parse(_ iso: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: iso) { return date }
        // Postgres sends microseconds, which the formatter rejects; cut the fraction to milliseconds.
        if let dot = iso.firstIndex(of: "."), let end = iso[dot...].firstIndex(where: { $0 == "+" || $0 == "-" || $0 == "Z" }) {
            let head = String(iso[...dot])
            let digits = String(iso[iso.index(after: dot)..<end])
            let tail = String(iso[end...])
            let trimmed: String = head + String(digits.prefix(3)) + tail
            if let date = fractional.date(from: trimmed) { return date }
        }
        let plain = ISO8601DateFormatter()
        return plain.date(from: iso)
    }
}
