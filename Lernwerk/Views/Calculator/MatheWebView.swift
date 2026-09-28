import SwiftUI
import UIKit
import WebKit

/// The calculator app (`cas/web/mathe.html`, built from `cas/app`) in a web view, with the bridge it needs: a
/// key–value store for projects in Documents/Rechner, the share sheet for exports, and the colour scheme. The web
/// view lives as long as the app, so Giac loads once.
struct MatheWebView: UIViewRepresentable {
    @Environment(\.colorScheme) private var colorScheme

    func makeUIView(context: Context) -> WKWebView {
        let webView = MatheHost.shared.webView
        MatheHost.shared.setTheme(colorScheme == .dark ? "dark" : "light")
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        MatheHost.shared.setTheme(colorScheme == .dark ? "dark" : "light")
    }
}

@MainActor
final class MatheHost: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    static let shared = MatheHost()

    private(set) lazy var webView: WKWebView = makeWebView()
    private var theme = "light"
    private var isReady = false

    private func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(WeakMessageHandler(self), name: "mathe")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = self
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        if let page = Bundle.main.url(forResource: "mathe", withExtension: "html") {
            webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }
        return webView
    }

    func setTheme(_ theme: String) {
        self.theme = theme
        guard isReady else { return }
        webView.evaluateJavaScript("window.Mathe && window.Mathe.setTheme('\(theme)')")
    }

    // Storage: one file per key in Documents/Rechner

    private var folder: URL {
        let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Rechner", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }

    private func file(for key: String) -> URL {
        let safe = key.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? UUID().uuidString
        return folder.appendingPathComponent(safe + ".json")
    }

    private func keys(prefix: String) -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
        return names.filter { $0.hasSuffix(".json") }
            .compactMap { String($0.dropLast(5)).removingPercentEncoding }
            .filter { $0.hasPrefix(prefix) }
    }

    // Messages from the page

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        let id = body["id"] as? Int
        switch type {
        case "ready":
            isReady = true
            setTheme(theme)
        case "store.get":
            let key = body["key"] as? String ?? ""
            reply(id, (try? String(contentsOf: file(for: key), encoding: .utf8)) as Any)
        case "store.set":
            let key = body["key"] as? String ?? ""
            let value = body["value"] as? String ?? ""
            try? value.write(to: file(for: key), atomically: true, encoding: .utf8)
            reply(id, true)
        case "store.delete":
            try? FileManager.default.removeItem(at: file(for: body["key"] as? String ?? ""))
            reply(id, true)
        case "store.list":
            reply(id, keys(prefix: body["prefix"] as? String ?? ""))
        case "share":
            share(body)
            reply(id, true)
        default:
            reply(id, NSNull())
        }
    }

    private func reply(_ id: Int?, _ value: Any) {
        guard let id else { return }
        let payload: String
        if value is NSNull {
            payload = "null"
        } else if let data = try? JSONSerialization.data(withJSONObject: [value], options: [.fragmentsAllowed]),
                  let text = String(data: data, encoding: .utf8) {
            payload = String(text.dropFirst().dropLast())
        } else {
            payload = "null"
        }
        webView.evaluateJavaScript("window.Mathe && window.Mathe.reply(\(id), \(payload))")
    }

    private func share(_ body: [String: Any]) {
        let name = (body["name"] as? String ?? "Rechnung.txt").replacingOccurrences(of: "/", with: "-")
        let text = body["data"] as? String ?? ""
        let data = (body["base64"] as? Bool ?? false) ? (Data(base64Encoded: text) ?? Data()) : Data(text.utf8)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        guard (try? data.write(to: url, options: .atomic)) != nil else { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = webView
        sheet.popoverPresentationController?.sourceRect = CGRect(x: webView.bounds.midX, y: 60, width: 1, height: 1)
        topController()?.present(sheet, animated: true)
    }

    private func topController() -> UIViewController? {
        var controller = webView.window?.rootViewController
        while let presented = controller?.presentedViewController { controller = presented }
        return controller
    }

    // A crashed web content process loads the page again.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        isReady = false
        webView.reload()
    }
}

/// WKUserContentController keeps its handlers strongly; this breaks the cycle.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: (NSObject & WKScriptMessageHandler)?

    init(_ target: NSObject & WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
