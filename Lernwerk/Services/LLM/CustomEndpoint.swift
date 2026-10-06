import Foundation

/// The student's own OpenAI-compatible API: a server of their own (Ollama, LM Studio, vLLM, a school server) or any
/// provider the app does not know. Only the address is needed; the key is optional.
enum CustomEndpoint {
    enum Check: Equatable {
        case empty
        case invalid
        /// Plain http reaches only servers in the local network; iOS blocks it for everything else.
        case insecureRemote
        case valid(URL)

        var url: URL? {
            if case let .valid(url) = self { return url }
            return nil
        }
    }

    /// "https://host/v1", "https://host/v1/", "https://host" and the full ".../chat/completions" all lead to the
    /// chat completions endpoint. An address without a path gets "/v1", the path almost every such server uses.
    static func check(_ text: String) -> Check {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .empty }
        guard var parts = URLComponents(string: trimmed),
              let scheme = parts.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = parts.host, !host.isEmpty
        else { return .invalid }
        parts.scheme = scheme
        parts.query = nil
        parts.fragment = nil
        parts.user = nil
        parts.password = nil
        var path = parts.path
        while path.hasSuffix("/") { path.removeLast() }
        if path.lowercased().hasSuffix("/chat/completions") {
            // already complete
        } else if path.isEmpty {
            path = "/v1/chat/completions"
        } else {
            path += "/chat/completions"
        }
        parts.path = path
        guard let url = parts.url else { return .invalid }
        if scheme == "http", !isLocal(host) { return .insecureRemote }
        return .valid(url)
    }

    /// Hosts iOS lets plain http reach: this device, `.local` names, names without a dot and private address ranges.
    static func isLocal(_ host: String) -> Bool {
        let lower = host.lowercased()
        if lower == "localhost" || lower.hasSuffix(".local") || !lower.contains(".") { return true }
        let octets = lower.split(separator: ".").compactMap { Int($0) }
        guard octets.count == 4, octets.allSatisfy({ (0...255).contains($0) }) else { return false }
        switch (octets[0], octets[1]) {
        case (10, _), (127, _), (192, 168), (169, 254): return true
        case (172, 16...31): return true
        default: return false
        }
    }

    static func message(for check: Check) -> String? {
        switch check {
        case .empty: return "Trag die Adresse der API ein, z. B. https://mein-server.de/v1."
        case .invalid: return "Das ist keine gültige Adresse. Sie beginnt mit https:// (oder http:// im lokalen Netz)."
        case .insecureRemote: return "http:// funktioniert nur im lokalen Netz. Nimm für andere Server https://."
        case .valid: return nil
        }
    }
}
