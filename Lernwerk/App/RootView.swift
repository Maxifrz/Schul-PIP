import SwiftData
import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case library, plans, review, settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .library: return "Bibliothek"
        case .plans: return "Lernplan"
        case .review: return "Wiederholen"
        case .settings: return "Einstellungen"
        }
    }
}

enum Route: Hashable {
    case document(StudyMaterial, startPage: Int?, backTitle: String)
    case plan(StudyPlan)
}

struct RootView: View {
    @Query private var cards: [ReviewCard]
    @State private var tab: AppTab = .library
    @State private var path = NavigationPath()

    private var dueCount: Int {
        let now = Date()
        return cards.filter { $0.dueDate <= now }.count
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                TopTabBar(selection: $tab, reviewBadge: dueCount)
                Group {
                    switch tab {
                    case .library: LibraryView()
                    case .plans: PlanListView()
                    case .review: ReviewView()
                    case .settings: SettingsView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .transition(.opacity)
                .id(tab)
            }
            .background(Quill.bg.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case let .document(material, startPage, backTitle):
                    DocumentScreen(material: material, startPage: startPage, backTitle: backTitle)
                case let .plan(plan):
                    PlanDetailView(plan: plan)
                }
            }
        }
        .tint(Quill.accent)
    }
}

/// Wordmark on the left, the tabs as a capsule in the middle.
private struct TopTabBar: View {
    @Binding var selection: AppTab
    let reviewBadge: Int
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        HStack(spacing: 0) {
            if sizeClass == .regular {
                Text("LERNWERK")
                    .font(.pixel(13))
                    .tracking(1.8)
                    .foregroundStyle(Quill.accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(spacing: 2) {
                ForEach(AppTab.allCases) { tab in
                    tabButton(tab)
                }
            }
            .padding(4)
            .background(Quill.surface, in: Capsule())
            .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
            if sizeClass == .regular {
                Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
            }
        }
        .padding(.horizontal, sizeClass == .regular ? 26 : 10)
        .padding(.top, 8)
    }

    private func tabButton(_ tab: AppTab) -> some View {
        let isSelected = tab == selection
        return Button {
            withAnimation(.easeInOut(duration: 0.2)) { selection = tab }
        } label: {
            HStack(spacing: 7) {
                Text(tab.title)
                    .font(.work(sizeClass == .regular ? 14 : 12.5, .medium))
                    .tracking(-0.14)
                if tab == .review, reviewBadge > 0 {
                    Text("\(reviewBadge)")
                        .font(.pixel(9))
                        .foregroundStyle(Quill.onAccent)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 3)
                        .frame(minWidth: 19)
                        .background(Quill.accent, in: Capsule())
                }
            }
            .foregroundStyle(isSelected ? Quill.bg : Quill.ink)
            .padding(.horizontal, sizeClass == .regular ? 17 : 10)
            .frame(height: 36)
            .background(isSelected ? Quill.ink : Color.clear, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
