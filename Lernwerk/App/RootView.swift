import SwiftData
import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case today, library, plans, presentations, calculator, calendar, review, settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: return "Heute"
        case .library: return "Bibliothek"
        case .plans: return "Lernplan"
        case .presentations: return "Präsentation"
        case .calculator: return "Rechner"
        case .calendar: return "Kalender"
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
    @State private var tab: AppTab = .today
    @State private var path = NavigationPath()
    @State private var sharedFile: URL?
    @Environment(\.horizontalSizeClass) private var sizeClass
    /// An exam in the calculator keeps the student there.
    @ObservedObject private var exam = ExamLock.shared

    private var dueCount: Int {
        let now = Date()
        return cards.filter { $0.dueDate <= now }.count
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                if exam.active {
                    Text("Prüfungsmodus: nur der Rechner ist geöffnet. Beenden im Rechner unter „⋯“.")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Color(red: 0.70, green: 0.15, blue: 0.12))
                } else if sizeClass == .regular {
                    DockShell(selection: $tab, dueCount: dueCount, openDocument: openFromShell) {
                        tabContent
                    }
                } else {
                    TopTabBar(selection: $tab, reviewBadge: dueCount)
                    tabContent
                }
                if exam.active {
                    tabContent
                }
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
        .onChange(of: exam.active, initial: true) { _, active in
            guard active else { return }
            tab = .calculator
            path = NavigationPath()
        }
        .confirmationDialog("Datei öffnen", isPresented: sharePresented, titleVisibility: .visible, presenting: sharedFile) { url in
            Button("In „\(OpenDocument.shared.title)“ einfügen") { insertIntoOpenDocument(url) }
            Button("Als neues Dokument") { importAsNew(url) }
            Button("Abbrechen", role: .cancel) { removeFromInbox(url) }
        } message: { _ in
            Text("Die Seiten nach der aktuellen Seite einfügen oder als eigenes Dokument in die Bibliothek legen?")
        }
        .onChange(of: scenePhase) { _, phase in
            // Reminders are scheduled two weeks ahead; opening the app moves the window along.
            if phase == .active { PlanNotifications.updateAll(plans) }
        }
    }

    /// The area on show; an exam keeps it on the calculator.
    private var tabContent: some View {
        Group {
            switch exam.active ? AppTab.calculator : tab {
            case .today: TodayView(dueCount: dueCount, select: { tab = $0 }, openDocument: openFromShell)
            case .library: LibraryView()
            case .plans: PlanListView()
            case .presentations: PresentationListView()
            case .calculator: CalculatorView()
            case .calendar: CalendarScreen()
            case .review: ReviewView()
            case .settings: SettingsView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .transition(.opacity)
        .id(exam.active ? AppTab.calculator : tab)
    }

    private func openFromShell(_ material: StudyMaterial, _ page: Int?) {
        path.append(Route.document(material, startPage: page, backTitle: tab.title))
    }

    /// A PDF, picture or Word file shared to Lernwerk from Files, Photos or another app. With a document open, the
    /// student chooses whether it goes into that document or into the library; otherwise it lands in the library
    /// and opens.
    private func importShared(_ url: URL) {
        guard url.isFileURL else { return }
        if exam.active {
            removeFromInbox(url)
            return
        }
        if OpenDocument.shared.materialID != nil, !path.isEmpty {
            sharedFile = url
        } else {
            importAsNew(url)
        }
    }

    private func importAsNew(_ url: URL) {
        defer { removeFromInbox(url) }
        guard let material = try? MaterialStore.importFile(from: url) else { return }
        modelContext.insert(material)
        tab = .library
        path = NavigationPath()
        path.append(Route.document(material, startPage: nil, backTitle: "Bibliothek"))
    }

    private func insertIntoOpenDocument(_ url: URL) {
        defer { removeFromInbox(url) }
        _ = OpenDocument.shared.insert(url)
    }

    /// Shared files arrive as a copy in Documents/Inbox; the library keeps its own.
    private func removeFromInbox(_ url: URL) {
        if url.path.contains("/Inbox/") {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private var sharePresented: Binding<Bool> {
        Binding(get: { sharedFile != nil }, set: { if !$0 { sharedFile = nil } })
    }
}

/// Wordmark on the left, the tabs as a glass capsule in the middle; the dark pill slides to the chosen tab.
private struct TopTabBar: View {
    @Binding var selection: AppTab
    let reviewBadge: Int
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Namespace private var pill

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
                ScrollViewReader { proxy in
                    ScrollView(.horizontal, showsIndicators: false) {
                        tabCapsule
                            .fixedSize(horizontal: true, vertical: false)
                            .padding(.vertical, 6)
                    }
                    // Keeps the chosen tab in view while the pill slides to it.
                    .onChange(of: selection) { _, tab in
                        withAnimation(TopTabBar.slide) { proxy.scrollTo(tab, anchor: .center) }
                    }
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
        .modifier(GlassCapsule())
    }

    /// A little overshoot, like a drop of liquid settling.
    static let slide = Animation.spring(response: 0.42, dampingFraction: 0.74)

    private func tabButton(_ tab: AppTab) -> some View {
        let isSelected = tab == selection
        return Button {
            withAnimation(TopTabBar.slide) { selection = tab }
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
            .background {
                if isSelected {
                    SelectedPill()
                        .matchedGeometryEffect(id: "pill", in: pill)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(TabPressStyle())
        .id(tab)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// The chosen tab: ink with a soft light edge on top, so it reads as a raised drop on the glass.
private struct SelectedPill: View {
    var body: some View {
        Capsule()
            .fill(Quill.ink)
            .overlay(
                Capsule().strokeBorder(
                    LinearGradient(colors: [.white.opacity(0.32), .white.opacity(0)], startPoint: .top, endPoint: .bottom),
                    lineWidth: 1
                )
            )
            .shadow(color: .black.opacity(0.18), radius: 6, y: 2)
    }
}

/// Tabs give way a little under the finger.
private struct TabPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

/// Liquid Glass on iOS 26; before that frosted material with a light rim, which looks close.
private struct GlassCapsule: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(), in: Capsule())
        } else {
            frosted(content)
        }
        #else
        frosted(content)
        #endif
    }

    private func frosted(_ content: Content) -> some View {
        content
            .background(Quill.surface.opacity(0.5), in: Capsule())
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(
                Capsule().strokeBorder(
                    LinearGradient(colors: [.white.opacity(0.75), Quill.line2.opacity(0.7)], startPoint: .top, endPoint: .bottom),
                    lineWidth: 1
                )
            )
            .shadow(color: .black.opacity(0.08), radius: 14, y: 5)
    }
}
