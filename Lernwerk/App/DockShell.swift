import SwiftData
import SwiftUI

private struct StudioRailKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True while the screen is in landscape under the Dock layout; the library then shows a preview beside its
    /// table.
    var studioRailOn: Bool {
        get { self[StudioRailKey.self] }
        set { self[StudioRailKey.self] = newValue }
    }
}

/// The Dock layout: "Heute" as the home page, a floating dock at the bottom with every area of the app, Pip walking
/// on top of it, and the calculator as a full screen with a way back. Documents and the presentation editor are
/// pushed on top of everything.
struct DockShell<Content: View>: View {
    @Binding var selection: AppTab
    let dueCount: Int
    let openDocument: (StudyMaterial, Int?) -> Void
    @ViewBuilder var content: Content

    var body: some View {
        GeometryReader { geometry in
            let landscape = geometry.size.width > geometry.size.height
            let immersive = selection == .calculator
            let width = min(780, geometry.size.width - 32)
            ZStack(alignment: .bottom) {
                VStack(spacing: 0) {
                    if immersive { backBar }
                    content
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .environment(\.studioRailOn, landscape)
                        .safeAreaInset(edge: .bottom, spacing: 0) {
                            if !immersive { Color.clear.frame(height: 108) }
                        }
                }
                if !immersive {
                    VStack(spacing: 0) {
                        if selection != .today {
                            PipView(isThinking: false)
                                .frame(width: width)
                        }
                        dock(width: width)
                    }
                    .padding(.bottom, 12)
                }
            }
            .animation(.easeOut(duration: 0.2), value: selection)
        }
    }

    private func go(_ tab: AppTab) {
        selection = tab
    }

    // Dock

    private func dock(width: CGFloat) -> some View {
        let narrow = width < 700
        return HStack(spacing: 2) {
            ForEach(dockItems) { item in
                let on = selection == item.tab
                Button { go(item.tab) } label: {
                    VStack(spacing: 7) {
                        PixelIcon(rows: item.icon)
                        Text(narrow ? item.short : item.label)
                            .font(.jersey(narrow ? 16 : 17))
                            .tracking(0.5)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                    .foregroundStyle(on ? Quill.onAccent : Quill.ink)
                    .frame(maxWidth: .infinity)
                    .frame(height: 64)
                    .background(on ? Quill.accent : Color.clear, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .overlay(alignment: .topTrailing) {
                        if item.tab == .review, dueCount > 0 {
                            Text("\(dueCount)")
                                .font(.jersey(15))
                                .foregroundStyle(Quill.onAccent)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .frame(minWidth: 18)
                                .background(Quill.warn, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                                .padding(.top, 6)
                                .padding(.trailing, 6)
                        }
                    }
                    .contentShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.label)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(8)
        .frame(width: width)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 34, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 34, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        .shadow(color: .black.opacity(0.18), radius: 20, y: 8)
    }

    // Full screen

    private var backBar: some View {
        HStack {
            Button { go(.today) } label: {
                HStack(spacing: 8) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 13, weight: .bold))
                    Text("Heute")
                        .font(.work(14, .semibold))
                }
                .foregroundStyle(Quill.ink)
                .padding(.leading, 14)
                .padding(.trailing, 18)
                .frame(height: 40)
                .background(Quill.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 6)
        .background(Quill.bg)
    }
}

// The areas in the dock, in order.
private struct DockItem: Identifiable {
    let tab: AppTab
    let label: String
    /// For a dock too narrow for the full names (split view).
    let short: String
    let icon: [String]
    var id: String { tab.rawValue }
}

private let dockItems = [
    DockItem(tab: .today, label: "Heute", short: "Heute", icon: PixelIcon.heute),
    DockItem(tab: .library, label: "Bibliothek", short: "Bibl.", icon: PixelIcon.library),
    DockItem(tab: .plans, label: "Lernplan", short: "Plan", icon: PixelIcon.plan),
    DockItem(tab: .review, label: "Karten", short: "Karten", icon: PixelIcon.review),
    DockItem(tab: .calendar, label: "Kalender", short: "Kal.", icon: PixelIcon.calendar),
    DockItem(tab: .calculator, label: "Rechner", short: "Rechn.", icon: PixelIcon.calculator),
    DockItem(tab: .presentations, label: "Präsentation", short: "Präs.", icon: PixelIcon.presentation),
    DockItem(tab: .settings, label: "Einstellungen", short: "Einst.", icon: PixelIcon.settings),
]

/// The dock's icons: five by five pixels, drawn in the text color.
struct PixelIcon: View {
    let rows: [String]
    var size: CGFloat = 15

    var body: some View {
        Canvas { context, canvas in
            let cell = canvas.width / 5
            for (y, row) in rows.enumerated() {
                for (x, character) in row.enumerated() where character == "#" {
                    context.fill(
                        Path(CGRect(x: CGFloat(x) * cell, y: CGFloat(y) * cell, width: cell, height: cell)),
                        with: .foreground
                    )
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    static let heute = ["..#..", ".###.", "#####", ".###.", "..#.."]
    static let library = ["#.#.#", "#.#.#", "#.#.#", "#.#.#", "#####"]
    static let plan = ["#.###", ".....", "#.###", ".....", "#.###"]
    static let review = [".###.", ".#.#.", "#####", "#...#", "#####"]
    static let calendar = ["#####", "#####", "#...#", "#...#", "#####"]
    static let calculator = [".....", ".###.", ".....", ".###.", "....."]
    static let presentation = ["#####", "#...#", "#...#", "#####", "..#.."]
    static let settings = [".#.#.", "#####", ".#.#.", "#####", ".#.#."]

    static func rows(for tab: AppTab) -> [String] {
        switch tab {
        case .today: return heute
        case .library: return library
        case .plans: return plan
        case .review: return review
        case .calendar: return calendar
        case .calculator: return calculator
        case .presentations: return presentation
        case .settings: return settings
        }
    }
}
