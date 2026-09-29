import SwiftData
import SwiftUI

@main
struct LernwerkApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var presentations = PresentationStore()

    init() {
        QuillFont.register()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .environmentObject(presentations)
        }
        .modelContainer(for: [
            StudyMaterial.self, MaterialFolder.self, StudyPlan.self, PlanTopic.self, ReviewCard.self,
            TimetableEntry.self, Exam.self,
        ])
    }
}
