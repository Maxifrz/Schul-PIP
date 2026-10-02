import XCTest
@testable import Lernwerk

final class CustomEndpointTests: XCTestCase {
    private func url(_ text: String) -> String? {
        CustomEndpoint.check(text).url?.absoluteString
    }

    func testAddressesLeadToTheChatCompletionsEndpoint() {
        XCTAssertEqual(url("https://mein-server.de/v1"), "https://mein-server.de/v1/chat/completions")
        XCTAssertEqual(url("https://mein-server.de/v1/"), "https://mein-server.de/v1/chat/completions")
        XCTAssertEqual(url("https://mein-server.de"), "https://mein-server.de/v1/chat/completions")
        XCTAssertEqual(url("https://mein-server.de/"), "https://mein-server.de/v1/chat/completions")
        XCTAssertEqual(url("https://mein-server.de/api/openai"), "https://mein-server.de/api/openai/chat/completions")
        XCTAssertEqual(url("https://mein-server.de/v1/chat/completions"), "https://mein-server.de/v1/chat/completions")
        XCTAssertEqual(url("  https://mein-server.de/v1?x=1#frag \n"), "https://mein-server.de/v1/chat/completions")
    }

    func testPlainHttpOnlyInTheLocalNetwork() {
        XCTAssertNotNil(url("http://192.168.1.20:11434/v1"))
        XCTAssertNotNil(url("http://10.0.0.5/v1"))
        XCTAssertNotNil(url("http://172.20.1.1/v1"))
        XCTAssertNotNil(url("http://localhost:1234/v1"))
        XCTAssertNotNil(url("http://mein-mac.local:1234/v1"))
        XCTAssertNotNil(url("http://server/v1"))
        XCTAssertEqual(CustomEndpoint.check("http://example.com/v1"), .insecureRemote)
        XCTAssertEqual(CustomEndpoint.check("http://172.32.0.1/v1"), .insecureRemote)
        XCTAssertEqual(CustomEndpoint.check("http://8.8.8.8/v1"), .insecureRemote)
    }

    func testNonsenseIsRejectedWithAMessage() {
        XCTAssertEqual(CustomEndpoint.check(""), .empty)
        XCTAssertEqual(CustomEndpoint.check("   "), .empty)
        XCTAssertEqual(CustomEndpoint.check("localhost:11434"), .invalid)
        XCTAssertEqual(CustomEndpoint.check("ftp://example.com"), .invalid)
        XCTAssertEqual(CustomEndpoint.check("https://"), .invalid)
        XCTAssertEqual(CustomEndpoint.check("kein url"), .invalid)
        XCTAssertNotNil(CustomEndpoint.message(for: .invalid))
        XCTAssertNotNil(CustomEndpoint.message(for: .insecureRemote))
        XCTAssertNil(CustomEndpoint.message(for: CustomEndpoint.check("https://a.de/v1")))
    }

    func testCredentialsInTheAddressAreDropped() {
        XCTAssertEqual(url("https://user:pass@mein-server.de/v1"), "https://mein-server.de/v1/chat/completions")
    }

    func testSettingsTreatAnAddressAsConfiguredAndTheKeyAsOptional() throws {
        let suite = try XCTUnwrap(UserDefaults(suiteName: "CustomEndpointTests"))
        suite.removePersistentDomain(forName: "CustomEndpointTests")
        defer { suite.removePersistentDomain(forName: "CustomEndpointTests") }
        let settings = AppSettings(defaults: suite)
        XCTAssertFalse(settings.hasKey(for: .custom))
        settings.customURL = "https://mein-server.de/v1"
        XCTAssertTrue(settings.hasKey(for: .custom))
        XCTAssertEqual(settings.customEndpoint?.absoluteString, "https://mein-server.de/v1/chat/completions")
        XCTAssertEqual(AppSettings(defaults: suite).customURL, "https://mein-server.de/v1", "remembered")

        settings.tutor = ModelSelection(provider: .custom, model: "llama3.2", sendsImages: false)
        settings.demoMode = false
        XCTAssertTrue(settings.makeClient(for: .tutor) is OpenAICompatibleClient)
        settings.customURL = "kein url"
        XCTAssertTrue(settings.makeClient(for: .tutor) is FailingClient)
        XCTAssertEqual(ModelSelection.defaultSelection(for: .tutor, provider: .custom).model, "")
    }
}
