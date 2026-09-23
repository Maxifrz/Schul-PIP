import SwiftData
import SwiftUI

@main
struct LernwerkApp: App {
    @StateObject private var settings = AppSettings()

    init() {
        QuillFont.register()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
        }
        .modelContainer(for: [StudyMaterial.self, StudyPlan.self, PlanTopic.self, ReviewCard.self])
    }
}
