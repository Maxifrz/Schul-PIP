import Foundation

/// How a slide was built: the component id, its parameters and the content it was built from. Kept on the slide so it
/// can be rebuilt in another variant; dropped by the first manual edit, since the content would be stale then.
struct SlideOrigin: Codable, Equatable {
    var componentID: String
    var params: ComponentParams
    var draft: SlideDraft

    init(componentID: String, params: ComponentParams = [:], draft: SlideDraft) {
        self.componentID = componentID
        self.params = params
        self.draft = draft
    }

    enum CodingKeys: String, CodingKey { case componentID, params, draft }

    /// Fails without an id or a draft, so the slide loads without an origin rather than with a broken one.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        componentID = try c.decode(String.self, forKey: .componentID)
        draft = try c.decode(SlideDraft.self, forKey: .draft)
        params = (try? c.decode(ComponentParams.self, forKey: .params)) ?? [:]
    }
}
