import SwiftData
import SwiftUI

/// The cards tab: the Lernpfad with its lessons, or the review by typing as before. The choice is remembered; until
/// the student makes one, the path shows from four cards on.
struct ReviewView: View {
    let select: (AppTab) -> Void

    @Query private var cards: [ReviewCard]
    @AppStorage("review.mode") private var storedMode = ""
    @Environment(\.horizontalSizeClass) private var sizeClass

    enum Mode: String, CaseIterable {
        case path, typing

        var title: String {
            switch self {
            case .path: return "Lernpfad"
            case .typing: return "Wiederholen"
            }
        }
    }

    private var mode: Mode {
        Mode(rawValue: storedMode) ?? (cards.count >= LearnPath.minimumCards ? .path : .typing)
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Ansicht", selection: Binding(get: { mode }, set: { storedMode = $0.rawValue })) {
                ForEach(Mode.allCases, id: \.self) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 320)
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.horizontal, sizeClass == .compact ? 20 : 40)
            .padding(.top, sizeClass == .compact ? 12 : 24)
            .frame(maxWidth: .infinity)

            switch mode {
            case .path: LearnPathView(select: select)
            case .typing: ReviewTypingView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}
