import SwiftData
import SwiftUI

@main
struct LernwerkApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var presentations = PresentationStore()
    @StateObject private var learnProgress = LearnProgressStore()
    @StateObject private var quests = QuestStore()
    @StateObject private var skills = SkillStore()

    /// The database; nil when it cannot be opened, and the app then offers to put it aside instead of crashing.
    @State private var container: ModelContainer?

    private static let models: [any PersistentModel.Type] = [
        StudyMaterial.self, MaterialFolder.self, StudyPlan.self, PlanTopic.self, ReviewCard.self,
        TimetableEntry.self, Exam.self, Homework.self,
    ]

    private static func openContainer() -> ModelContainer? {
        try? ModelContainer(for: Schema(models))
    }

    init() {
        QuillFont.register()
        _container = State(initialValue: Self.openContainer())
    }

    var body: some Scene {
        WindowGroup {
            if let container {
                RootView()
                    .environmentObject(settings)
                    .environmentObject(presentations)
                    .environmentObject(learnProgress)
                    .environmentObject(quests)
                    .environmentObject(skills)
                    .environment(\.pipSkin, learnProgress.progress.currentSkin)
                    .modelContainer(container)
            } else {
                StoreRecoveryView {
                    StoreRecovery.setAside(ModelConfiguration().url)
                    container = Self.openContainer()
                }
            }
        }
    }
}
