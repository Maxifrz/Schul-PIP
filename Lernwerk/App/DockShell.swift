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
            let phone = geometry.size.width < 600
            let width = min(780, geometry.size.width - (phone ? 20 : 32))
            ZStack(alignment: .bottom) {
                VStack(spacing: 0) {
                    if immersive { backBar }
                    content
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .environment(\.studioRailOn, landscape)
                        .safeAreaInset(edge: .bottom, spacing: 0) {
                            if !immersive { Color.clear.frame(height: phone ? 84 : 108) }
                        }
                }
                if !immersive {
                    VStack(spacing: 0) {
                        if selection != .today, !phone {
                            PipView(isThinking: false)
                                .frame(width: width)
                        }
                        if phone {
                            phoneDock(width: width)
                        } else {
                            dock(width: width)
                        }
                    }
                    .padding(.bottom, phone ? 6 : 12)
                    // The keyboard covers the dock instead of pushing it up and eating the screen.
                    .ignoresSafeArea(.keyboard)
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

    // Phone dock: four areas and a menu with the rest.

    private func phoneDock(width: CGFloat) -> some View {
        let moreOn = phoneMore.contains { $0.tab == selection }
        return HStack(spacing: 2) {
            ForEach(phoneItems) { item in
                phoneButton(label: item.short, icon: item.icon, on: selection == item.tab, badge: item.tab == .review ? dueCount : 0) {
                    go(item.tab)
                }
                .accessibilityLabel(item.label)
            }
            Menu {
                ForEach(phoneMore) { item in
                    Button { go(item.tab) } label: { Label(item.label, systemImage: item.symbol) }
                }
            } label: {
                phoneLabel(label: "Mehr", icon: PixelIcon.more, on: moreOn, badge: 0)
            }
            .accessibilityLabel("Mehr")
        }
        .padding(6)
        .frame(width: width)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
    }

    private func phoneButton(label: String, icon: [String], on: Bool, badge: Int, action: @escaping () -> Void) -> some View {
        Button(action: action) { phoneLabel(label: label, icon: icon, on: on, badge: badge) }
            .buttonStyle(.plain)
            .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func phoneLabel(label: String, icon: [String], on: Bool, badge: Int) -> some View {
        VStack(spacing: 5) {
            PixelIcon(rows: icon)
            Text(label)
                .font(.jersey(16))
                .tracking(0.4)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .foregroundStyle(on ? Quill.onAccent : Quill.ink)
        .frame(maxWidth: .infinity)
        .frame(height: 56)
        .background(on ? Quill.accent : Color.clear, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(alignment: .topTrailing) {
            if badge > 0 {
                Text("\(badge)")
                    .font(.jersey(14))
                    .foregroundStyle(Quill.onAccent)
                    .padding(.horizontal, 4)
                    .frame(minWidth: 16)
                    .background(Quill.warn, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                    .padding(.top, 4)
                    .padding(.trailing, 6)
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
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
    DockItem(tab: .social, label: "Kurse", short: "Kurse", icon: PixelIcon.social),
    DockItem(tab: .calendar, label: "Kalender", short: "Kal.", icon: PixelIcon.calendar),
    DockItem(tab: .calculator, label: "Rechner", short: "Rechn.", icon: PixelIcon.calculator),
    DockItem(tab: .presentations, label: "Präsentation", short: "Präs.", icon: PixelIcon.presentation),
    DockItem(tab: .settings, label: "Einstellungen", short: "Einst.", icon: PixelIcon.settings),
]

/// What the phone dock shows directly, and what sits behind "Mehr".
private let phoneItems = dockItems.filter { [AppTab.today, .library, .review, .calendar].contains($0.tab) }

private struct MoreItem: Identifiable {
    let tab: AppTab
    let label: String
    let symbol: String
    var id: String { tab.rawValue }
}

private let phoneMore = [
    MoreItem(tab: .plans, label: "Lernplan", symbol: "list.bullet.rectangle"),
    MoreItem(tab: .social, label: "Kurse", symbol: "person.2"),
    MoreItem(tab: .calculator, label: "Rechner", symbol: "function"),
    MoreItem(tab: .presentations, label: "Präsentation", symbol: "rectangle.on.rectangle"),
    MoreItem(tab: .settings, label: "Einstellungen", symbol: "gearshape"),
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
    static let social = ["#####", "#...#", "#...#", "#####", "#...."]
    static let more = [".....", "#.#.#", ".....", ".....", "....."]

    static func rows(for tab: AppTab) -> [String] {
        switch tab {
        case .today: return heute
        case .library: return library
        case .plans: return plan
        case .review: return review
        case .calendar: return calendar
        case .calculator: return calculator
        case .presentations: return presentation
        case .social: return social
        case .settings: return settings
        }
    }
}
