import XCTest
@testable import Lernwerk

final class ModelCatalogTests: XCTestCase {
    private func parse(_ json: String) -> [RemoteModel] {
        ModelCatalog.parse(Data(json.utf8))
    }

    func testOpenRouterListKeepsPriceAndPictureSupport() {
        let models = parse("""
        {"data":[
          {"id":"google/gemma-4-31b-it:free","name":"Google: Gemma 4 31B (free)","context_length":131072,
           "pricing":{"prompt":"0","completion":"0"},"architecture":{"input_modalities":["text","image"]}},
          {"id":"deepseek/deepseek-v4","name":"DeepSeek V4","context_length":64000,
           "pricing":{"prompt":"0.0000003","completion":"0.000001"},"architecture":{"input_modalities":["text"]}}
        ]}
        """)
        XCTAssertEqual(models.map(\.id), ["google/gemma-4-31b-it:free", "deepseek/deepseek-v4"])
        XCTAssertEqual(models[0].free, true)
        XCTAssertEqual(models[0].vision, true)
        XCTAssertEqual(models[0].note, "Gratis · Bilder · 131k Kontext")
        XCTAssertEqual(models[1].free, false)
        XCTAssertEqual(models[1].vision, false)
    }

    func testAnthropicListUsesTheDisplayName() {
        let models = parse(#"{"data":[{"type":"model","id":"claude-sonnet-5","display_name":"Claude Sonnet 5"}]}"#)
        XCTAssertEqual(models.first?.name, "Claude Sonnet 5")
        XCTAssertEqual(models.first?.vision, true)
    }

    func testGeminiNativeListLosesItsModelsPrefix() {
        let models = parse(#"{"models":[{"name":"models/gemini-3.8-flash","displayName":"Gemini 3.8 Flash","inputTokenLimit":1048576}]}"#)
        XCTAssertEqual(models.first?.id, "gemini-3.8-flash")
        XCTAssertEqual(models.first?.name, "Gemini 3.8 Flash")
        XCTAssertEqual(models.first?.contextLength, 1_048_576)
    }

    func testModelsThatCannotChatAreLeftOutAndDuplicatesCollapse() {
        let models = parse(#"{"data":[{"id":"nvidia/nv-embedqa-e5-v5"},{"id":"openai/whisper-large"},{"id":"meta/llama-3.1-70b-instruct"},{"id":"meta/llama-3.1-70b-instruct"}]}"#)
        XCTAssertEqual(models.map(\.id), ["meta/llama-3.1-70b-instruct"])
        XCTAssertNil(models.first?.vision)
        XCTAssertTrue(parse("kein json").isEmpty)
    }

    func testSearchNeedsEveryWordAndPutsPrefixMatchesFirst() {
        let all = parse(#"{"data":[{"id":"qwen/qwen3.8-27b"},{"id":"google/gemma-4-31b-it"},{"id":"meta/llama-4-maverick"},{"id":"llama-4"}]}"#)
        XCTAssertEqual(ModelCatalog.search(all, query: "llama 4").map(\.id), ["llama-4", "meta/llama-4-maverick"])
        XCTAssertEqual(ModelCatalog.search(all, query: "  QWEN ").map(\.id), ["qwen/qwen3.8-27b"])
        XCTAssertEqual(ModelCatalog.search(all, query: "").count, 4)
        XCTAssertTrue(ModelCatalog.search(all, query: "gpt").isEmpty)
    }

    func testListAddressesPerProvider() {
        XCTAssertEqual(ModelCatalog.listURL(for: .nvidia, endpoint: nil)?.absoluteString, "https://integrate.api.nvidia.com/v1/models")
        XCTAssertEqual(ModelCatalog.listURL(for: .openRouter, endpoint: nil)?.host, "openrouter.ai")
        let custom = URL(string: "https://router.huggingface.co/v1/chat/completions")
        XCTAssertEqual(ModelCatalog.listURL(for: .custom, endpoint: custom)?.absoluteString, "https://router.huggingface.co/v1/models")
        XCTAssertNil(ModelCatalog.listURL(for: .custom, endpoint: nil))
    }

    func testRequestsCarryTheRightKeyHeader() {
        let claude = ModelCatalog.request(provider: .anthropic, apiKey: "sk-ant-x", endpoint: nil)
        XCTAssertEqual(claude?.value(forHTTPHeaderField: "x-api-key"), "sk-ant-x")
        XCTAssertEqual(claude?.value(forHTTPHeaderField: "anthropic-version"), "2023-06-01")
        XCTAssertNil(claude?.value(forHTTPHeaderField: "authorization"))
        let nvidia = ModelCatalog.request(provider: .nvidia, apiKey: "nvapi-x", endpoint: nil)
        XCTAssertEqual(nvidia?.value(forHTTPHeaderField: "authorization"), "Bearer nvapi-x")
        let open = ModelCatalog.request(provider: .openRouter, apiKey: "", endpoint: nil)
        XCTAssertNil(open?.value(forHTTPHeaderField: "authorization"))
    }

    func testKeylessProvidersFailBeforeAnyRequest() async {
        do {
            _ = try await ModelCatalog.fetch(provider: .nvidia, apiKey: "", endpoint: nil)
            XCTFail("expected needsKey")
        } catch {
            XCTAssertEqual(error as? ModelCatalog.Failure, .needsKey)
        }
        do {
            _ = try await ModelCatalog.fetch(provider: .custom, apiKey: "", endpoint: nil)
            XCTFail("expected needsAddress")
        } catch {
            XCTAssertEqual(error as? ModelCatalog.Failure, .needsAddress)
        }
    }
}
