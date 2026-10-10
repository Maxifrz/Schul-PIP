import SwiftUI

/// Four questions on the left, their answers shuffled on the right: tap one of each to pair them. A right pair fades
/// out, a wrong one flashes red and counts as a miss for that question.
struct MatchPairsView: View {
    let exercise: LearnExercise
    let matched: Set<String>
    let matchedBacks: Set<Int>
    let pickedFront: String?
    let pickedBack: Int?
    let lastMiss: LessonModel.PairMiss?
    let isLocked: Bool
    let onFront: (String) -> Void
    let onBack: (Int) -> Void

    private enum TileState {
        case normal, picked, matched, missed
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 10) {
                ForEach(exercise.pairs, id: \.key) { pair in
                    tile(pair.front, state: frontState(pair.key), role: "Frage") { onFront(pair.key) }
                }
            }
            VStack(spacing: 10) {
                ForEach(Array(exercise.options.enumerated()), id: \.offset) { index, back in
                    tile(back, state: backState(index), role: "Antwort") { onBack(index) }
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: matched)
        .animation(.easeInOut(duration: 0.2), value: lastMiss)
    }

    private func frontState(_ key: String) -> TileState {
        if matched.contains(key) { return .matched }
        if lastMiss?.key == key { return .missed }
        return pickedFront == key ? .picked : .normal
    }

    private func backState(_ index: Int) -> TileState {
        if matchedBacks.contains(index) { return .matched }
        if lastMiss?.back == index { return .missed }
        return pickedBack == index ? .picked : .normal
    }

    private func tile(_ text: String, state: TileState, role: String, action: @escaping () -> Void) -> some View {
        Button {
            guard !isLocked, state != .matched else { return }
            action()
        } label: {
            Text(text)
                .font(.work(15.5, state == .picked ? .medium : .regular))
                .lineSpacing(2)
                .multilineTextAlignment(.leading)
                .foregroundStyle(state == .matched ? Quill.faint : Quill.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: 30, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(fill(state), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(stroke(state), lineWidth: state == .picked || state == .missed ? 2 : 1)
                )
                .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(role): \(text)")
        .accessibilityValue(accessibilityValue(state))
        .accessibilityAddTraits(state == .picked ? .isSelected : [])
    }

    private func fill(_ state: TileState) -> Color {
        switch state {
        case .normal: return Quill.surface
        case .picked: return Quill.accentSoft
        case .matched: return Quill.surface2
        case .missed: return LearnTone.wrong.opacity(0.12)
        }
    }

    private func stroke(_ state: TileState) -> Color {
        switch state {
        case .normal: return Quill.line2
        case .picked: return Quill.accent
        case .matched: return Quill.lineSoft
        case .missed: return LearnTone.wrong
        }
    }

    private func accessibilityValue(_ state: TileState) -> String {
        switch state {
        case .normal: return ""
        case .picked: return "ausgewählt"
        case .matched: return "zugeordnet"
        case .missed: return "passt nicht"
        }
    }
}
