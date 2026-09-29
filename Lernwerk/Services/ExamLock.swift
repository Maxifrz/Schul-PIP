import Foundation

/// The calculator's exam mode, as the app sees it: while it runs, only the calculator tab is open and nothing can be
/// shared into the app. The calculator page starts and ends it; the flag survives a restart of the app.
final class ExamLock: ObservableObject {
    static let shared = ExamLock()
    private static let key = "examActive"

    @Published var active: Bool {
        didSet { UserDefaults.standard.set(active, forKey: Self.key) }
    }

    private init() {
        active = UserDefaults.standard.bool(forKey: Self.key)
    }
}
