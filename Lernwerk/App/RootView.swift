import SwiftData
import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case library, plans, presentations, calculator, review, settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .library: return "Bibliothek"
        case .plans: return "Lernplan"
        case .presentations: return "Präsentation"
        case .calculator: return "Rechner"
        case .review: return "Wiederholen"
        case .settings: return "Einstellungen"
        }
    }
}

enum Route: Hashable {
    case document(StudyMaterial, startPage: Int?, backTitle: String)
    case plan(StudyPlan)
    case presentation(String)
}

struct RootView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.scenePhase) private var scenePhase
    @Query private var cards: [ReviewCard]
    @Query private var plans: [StudyPlan]
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
                    case .presentations: PresentationListView()
                    case .calculator: CalculatorView()
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
                case let .presentation(id):
                    PresentationEditorRoute(id: id)
                }
            }
        }
        .tint(Quill.accent)
        .onOpenURL(perform: importShared)
        .onChange(of: scenePhase) { _, phase in
            // Reminders are scheduled two weeks ahead; opening the app moves the window along.
            if phase == .active { PlanNotifications.updateAll(plans) }
        }
    }

    /// A PDF or image shared to Lernwerk from Files, Photos or another app lands in the library and opens.
    private func importShared(_ url: URL) {
        guard url.isFileURL, let material = try? MaterialStore.importFile(from: url) else { return }
        // Shared files arrive as a copy in Documents/Inbox; the library keeps its own.
        if url.path.contains("/Inbox/") {
            try? FileManager.default.removeItem(at: url)
        }
        modelContext.insert(material)
        tab = .library
        path = NavigationPath()
        path.append(Route.document(material, startPage: nil, backTitle: "Bibliothek"))
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
                HStack(spacing: 10) {
                    PipLogo(pixel: 2.5)
                    Text("SCHUL-PIP")
                        .font(.pixel(13))
                        .tracking(1.8)
                        .foregroundStyle(Quill.accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            // On the iPad the capsule keeps its natural width and only the margins beside it give way; on a phone
            // the tabs scroll sideways.
            if sizeClass == .regular {
                tabCapsule
                    .fixedSize(horizontal: true, vertical: false)
                    .layoutPriority(1)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    tabCapsule
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            if sizeClass == .regular {
                Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
            }
        }
        .padding(.horizontal, sizeClass == .regular ? 26 : 10)
        .padding(.top, 8)
    }

    private var tabCapsule: some View {
        HStack(spacing: 2) {
            ForEach(AppTab.allCases) { tab in
                tabButton(tab)
            }
        }
        .padding(4)
        .background(Quill.surface, in: Capsule())
        .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
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
                    .lineLimit(1)
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
