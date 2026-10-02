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

/// The Dock layout: "Heute" as the home page, a floating dock at the bottom with the main areas and "Mehr" for the
/// rest, Pip walking on top of the dock, and the calculator as a full screen with a way back. Documents and the
/// presentation editor are pushed on top of everything.
struct DockShell<Content: View>: View {
    @Binding var selection: AppTab
    let dueCount: Int
    let openDocument: (StudyMaterial, Int?) -> Void
    @ViewBuilder var content: Content

    @State private var moreOpen = false
    @State private var jump = ""

    private static var moreTabs: [AppTab] { [.calendar, .presentations, .settings] }

    var body: some View {
        GeometryReader { geometry in
            let landscape = geometry.size.width > geometry.size.height
            let immersive = selection == .calculator
            let width = min(520, geometry.size.width - 32)
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
                if moreOpen && !immersive {
                    Quill.scrim
                        .ignoresSafeArea()
                        .onTapGesture { closeMore() }
                        .transition(.opacity)
                }
                if !immersive {
                    VStack(spacing: 0) {
                        if moreOpen { morePanel(width: width).padding(.bottom, 14) }
                        if selection != .today {
                            PipView(isThinking: false)
                                .frame(width: width)
                        }
                        dock(width: width)
                    }
                    .padding(.bottom, 12)
                }
            }
            .animation(.easeOut(duration: 0.2), value: moreOpen)
            .animation(.easeOut(duration: 0.2), value: selection)
        }
    }

    private func go(_ tab: AppTab) {
        moreOpen = false
        jump = ""
        selection = tab
    }

    private func closeMore() {
        moreOpen = false
        jump = ""
    }

    // Dock

    private struct Item: Identifiable {
        let id: String
        let label: String
        let icon: [String]
        let tab: AppTab?
    }

    private var items: [Item] {
        [
            Item(id: "heute", label: "Heute", icon: PixelIcon.heute, tab: .today),
            Item(id: "bib", label: "Bibliothek", icon: PixelIcon.library, tab: .library),
            Item(id: "plan", label: "Lernplan", icon: PixelIcon.plan, tab: .plans),
            Item(id: "review", label: "Karten", icon: PixelIcon.review, tab: .review),
            Item(id: "calc", label: "Rechner", icon: PixelIcon.calculator, tab: .calculator),
            Item(id: "mehr", label: "Mehr", icon: PixelIcon.more, tab: nil),
        ]
    }

    private func isOn(_ item: Item) -> Bool {
        if let tab = item.tab { return selection == tab && !moreOpen }
        return moreOpen || DockShell.moreTabs.contains(selection)
    }

    private func dock(width: CGFloat) -> some View {
        HStack(spacing: 4) {
            ForEach(items) { item in
                let on = isOn(item)
                Button {
                    if let tab = item.tab { go(tab) } else { moreOpen.toggle() }
                } label: {
                    VStack(spacing: 7) {
                        PixelIcon(rows: item.icon)
                        Text(item.label)
                            .font(.jersey(17))
                            .tracking(0.7)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
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
                                .padding(.top, 7)
                                .padding(.trailing, 12)
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

    // More

    private func morePanel(width: CGFloat) -> some View {
        let groups: [(String, AppTab)] = [("ORGANISIEREN", .calendar), ("WERKZEUGE", .presentations), ("SYSTEM", .settings)]
        return VStack(alignment: .leading, spacing: 0) {
            JumpBar(text: $jump, onDark: false, onArea: go) { material in
                closeMore()
                openDocument(material, material.lastOpenedPage)
            }
            if jump.trimmingCharacters(in: .whitespaces).isEmpty {
                ForEach(groups, id: \.1) { group in
                    let tab = group.1
                    Text(group.0)
                        .font(.mono(10, .medium))
                        .tracking(0.8)
                        .foregroundStyle(Quill.faint)
                        .padding(.top, 14)
                        .padding(.bottom, 8)
                        .padding(.leading, 4)
                    Button { go(tab) } label: {
                        HStack(spacing: 14) {
                            PixelIcon(rows: PixelIcon.rows(for: tab))
                            Text(tab.title)
                                .font(.work(15, .semibold))
                            Spacer(minLength: 0)
                        }
                        .foregroundStyle(selection == tab ? Quill.onAccent : Quill.ink)
                        .padding(.horizontal, 14)
                        .frame(height: 46)
                        .background(selection == tab ? Quill.accent : Color.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                Spacer().frame(height: 6)
            } else {
                JumpResults(text: jump, onArea: go) { material in
                    closeMore()
                    openDocument(material, material.lastOpenedPage)
                }
                .padding(.top, 8)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 14)
        .padding(.bottom, 8)
        .frame(width: width)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        .shadow(color: .black.opacity(0.22), radius: 24, y: 10)
        .transition(.opacity.combined(with: .offset(y: 8)))
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
    static let more = [".....", "#.#.#", ".....", "#.#.#", "....."]

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
