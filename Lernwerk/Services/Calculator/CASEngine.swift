import Foundation
import UIKit
import WebKit

/// Runs Giac, compiled to WebAssembly, in a hidden web view and hands it the calculator's work. There is one engine
/// for the app: the calculator and the notes share its variables.
@MainActor
final class CASEngine: NSObject, ObservableObject {
    static let shared = CASEngine()

    enum State: Equatable {
        case idle, loading, ready
        case failed(String)
    }

    enum EngineError: LocalizedError {
        case unavailable(String)
        case badAnswer

        var errorDescription: String? {
            switch self {
            case let .unavailable(reason): return reason
            case .badAnswer: return "Der Rechenkern hat nicht verständlich geantwortet."
            }
        }
    }

    @Published private(set) var state: State = .idle
    private var webView: WKWebView?
    private var waiting: [CheckedContinuation<Void, Error>] = []
    private var timeout: DispatchWorkItem?
    /// Inputs that define variables and functions, made again whenever the engine starts.
    private var definitions: [(name: String, input: String)] = []
    private var degrees = false

    /// Starts loading Giac in the background, so it is ready by the time something needs it.
    func warmUp() {
        if state == .idle { start() }
    }

    private func start() {
        guard let page = Bundle.main.url(forResource: "cas", withExtension: "html") else {
            state = .failed("Der Rechenkern fehlt in dieser App.")
            return
        }
        state = .loading
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(MessageProxy(engine: self), name: "cas")
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: configuration)
        webView.navigationDelegate = self
        webView.isUserInteractionEnabled = false
        webView.alpha = 0.01
        // A web view outside every window may be paused by the system; a tiny one in the window keeps running.
        keyWindow?.addSubview(webView)
        webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        self.webView = webView
        let work = DispatchWorkItem { [weak self] in
            MainActor.assumeIsolated {
                guard let self, self.state == .loading else { return }
                self.fail("Der Rechenkern ist nicht rechtzeitig gestartet.")
            }
        }
        timeout = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 45, execute: work)
    }

    private var keyWindow: UIWindow? {
        let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
        return windows.first { $0.isKeyWindow } ?? windows.first
    }

    fileprivate func receive(_ message: String) {
        guard message == "ready", state == .loading else { return }
        timeout?.cancel()
        Task { await restoreAndOpen() }
    }

    private func restoreAndOpen() async {
        if degrees { _ = try? await call("CAS.setDegrees(true); return 'ok'") }
        for definition in definitions {
            _ = try? await call("return CAS.evaluateJSON(input)", arguments: ["input": definition.input])
        }
        state = .ready
        let continuations = waiting
        waiting = []
        continuations.forEach { $0.resume() }
    }

    private func fail(_ reason: String) {
        state = .failed(reason)
        webView?.removeFromSuperview()
        webView = nil
        let continuations = waiting
        waiting = []
        continuations.forEach { $0.resume(throwing: EngineError.unavailable(reason)) }
    }

    private func ready() async throws {
        switch state {
        case .ready:
            return
        case .idle, .failed:
            // After a failure a new attempt may work, for example once memory is free again.
            start()
        case .loading:
            break
        }
        if case let .failed(reason) = state { throw EngineError.unavailable(reason) }
        try await withCheckedThrowingContinuation { continuation in
            waiting.append(continuation)
        }
    }

    /// Scripts always return a value: WebKit's bridge does not like an undefined result.
    private func call(_ script: String, arguments: [String: Any] = [:]) async throws -> Any {
        guard let webView else { throw EngineError.unavailable("Der Rechenkern läuft nicht.") }
        return try await withCheckedThrowingContinuation { continuation in
            webView.callAsyncJavaScript(script, arguments: arguments, in: nil, in: .page) { result in
                continuation.resume(with: result)
            }
        }
    }

    // Work

    func evaluate(_ input: String) async throws -> CASAnswer {
        try await ready()
        guard let json = try await call("return CAS.evaluateJSON(input)", arguments: ["input": input]) as? String else {
            throw EngineError.badAnswer
        }
        let answer = try JSONDecoder().decode(CASAnswer.self, from: Data(json.utf8))
        if answer.ok, let name = answer.assigns {
            definitions.removeAll { $0.name == name }
            definitions.append((name, input))
        }
        return answer
    }

    func plot(_ expressions: [String], xmin: Double, xmax: Double, samples: Int = 401) async throws -> CASPlot {
        try await ready()
        let list = String(data: try JSONEncoder().encode(expressions), encoding: .utf8) ?? "[]"
        let script = "return CAS.plotJSON(list, xmin, xmax, samples)"
        guard let json = try await call(script, arguments: ["list": list, "xmin": xmin, "xmax": xmax, "samples": samples]) as? String else {
            throw EngineError.badAnswer
        }
        return try JSONDecoder().decode(CASPlot.self, from: Data(json.utf8))
    }

    func setDegrees(_ value: Bool) async {
        degrees = value
        guard state == .ready else { return }
        _ = try? await call("CAS.setDegrees(value); return 'ok'", arguments: ["value": value])
    }

    /// The definitions and angle unit saved from earlier, made again before the first calculation.
    func restore(definitions saved: [CalculatorHistory.Definition], degrees: Bool) {
        definitions = saved.map { ($0.name, $0.input) }
        self.degrees = degrees
    }

    func forget(_ names: [String]) async {
        definitions.removeAll { names.contains($0.name) }
        guard state == .ready, let list = String(data: (try? JSONEncoder().encode(names)) ?? Data(), encoding: .utf8) else { return }
        _ = try? await call("CAS.forget(JSON.parse(list)); return 'ok'", arguments: ["list": list])
    }
}

extension CASEngine: WKNavigationDelegate {
    /// iOS ends the web content process when memory runs short; the next calculation starts Giac again.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if state == .loading {
            fail("Der Rechenkern ist beim Laden abgestürzt.")
            return
        }
        self.webView?.removeFromSuperview()
        self.webView = nil
        state = .idle
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        fail("Der Rechenkern ließ sich nicht laden.")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fail("Der Rechenkern ließ sich nicht laden.")
    }
}

/// Keeps the web view from holding on to the engine.
@MainActor
private final class MessageProxy: NSObject, WKScriptMessageHandler {
    weak var engine: CASEngine?

    init(engine: CASEngine) {
        self.engine = engine
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        engine?.receive(message.body as? String ?? "")
    }
}
