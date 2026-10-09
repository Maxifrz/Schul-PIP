import SwiftUI

/// Four answers to choose from; after the check the right one turns green and a wrong choice red.
struct MultipleChoiceView: View {
    let options: [String]
    let correct: String
    @Binding var choice: String?
    let verdict: LearnVerdict?
    let onPick: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Array(options.enumerated()), id: \.offset) { index, option in
                Button {
                    guard verdict == nil else { return }
                    choice = option
                    onPick()
                } label: {
                    row(index: index, option: option)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Antwort \(index + 1) von \(options.count): \(option)")
                .accessibilityValue(accessibilityState(option))
                .accessibilityAddTraits(choice == option ? .isSelected : [])
            }
        }
    }

    private func row(index: Int, option: String) -> some View {
        let style = rowStyle(option)
        return HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(index + 1)")
                .font(.mono(12, .semibold))
                .foregroundStyle(style.number)
                .frame(width: 18)
            Text(option)
                .font(.work(16.5))
                .lineSpacing(3)
                .multilineTextAlignment(.leading)
                .foregroundStyle(Quill.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let mark = style.mark {
                Image(systemName: mark)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(style.stroke)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(style.fill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(style.stroke, lineWidth: style.width))
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private struct RowStyle {
        var fill: Color
        var stroke: Color
        var width: CGFloat
        var mark: String?
        var number: Color
    }

    private func rowStyle(_ option: String) -> RowStyle {
        guard verdict != nil else {
            return choice == option
                ? RowStyle(fill: Quill.accentSoft, stroke: Quill.accent, width: 2, mark: nil, number: Quill.link)
                : RowStyle(fill: Quill.surface, stroke: Quill.line2, width: 1, mark: nil, number: Quill.faint)
        }
        if option == correct {
            return RowStyle(fill: Quill.accentSoft, stroke: LearnTone.right, width: 2, mark: "checkmark", number: LearnTone.right)
        }
        if option == choice {
            return RowStyle(fill: LearnTone.wrong.opacity(0.12), stroke: LearnTone.wrong, width: 2, mark: "xmark", number: LearnTone.wrong)
        }
        return RowStyle(fill: Quill.surface, stroke: Quill.line2, width: 1, mark: nil, number: Quill.faint)
    }

    private func accessibilityState(_ option: String) -> String {
        guard verdict != nil else { return choice == option ? "ausgewählt" : "" }
        if option == correct { return "richtige Antwort" }
        return option == choice ? "deine Antwort, falsch" : ""
    }
}
