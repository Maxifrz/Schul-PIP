import SwiftData
import SwiftUI

@main
struct LernwerkApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var presentations = PresentationStore()
    @StateObject private var learnProgress = LearnProgressStore()
    @StateObject private var quests = QuestStore()

    init() {
        QuillFont.register()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .environmentObject(presentations)
                .environmentObject(learnProgress)
                .environmentObject(quests)
        }
        .modelContainer(for: [
            StudyMaterial.self, MaterialFolder.self, StudyPlan.self, PlanTopic.self, ReviewCard.self,
            TimetableEntry.self, Exam.self, Homework.self,
        ])
    }
}
