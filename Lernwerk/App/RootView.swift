import SwiftData
import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case today, library, plans, presentations, calculator, calendar, review, social, settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: return "Heute"
        case .library: return "Bibliothek"
        case .plans: return "Lernplan"
        case .presentations: return "Präsentation"
        case .calculator: return "Rechner"
        case .calendar: return "Kalender"
        case .review: return "Lernen"
        case .social: return "Kurse"
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
                } else {
                    DockShell(selection: $tab, dueCount: dueCount, openDocument: openFromShell) {
                        tabContent
                    }
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
            case .review: ReviewView(select: { tab = $0 })
            case .social: SocialView()
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
