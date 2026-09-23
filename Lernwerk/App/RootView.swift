import SwiftData
import SwiftUI

struct RootView: View {
    @Query private var cards: [ReviewCard]

    private var dueCount: Int {
        let now = Date()
        return cards.filter { $0.dueDate <= now }.count
    }

    var body: some View {
        TabView {
            LibraryView()
                .tabItem { Label("Bibliothek", systemImage: "books.vertical") }
            PlanListView()
                .tabItem { Label("Lernplan", systemImage: "calendar") }
            ReviewView()
                .tabItem { Label("Wiederholen", systemImage: "rectangle.stack") }
                .badge(dueCount)
            SettingsView()
                .tabItem { Label("Einstellungen", systemImage: "gearshape") }
        }
    }
}
