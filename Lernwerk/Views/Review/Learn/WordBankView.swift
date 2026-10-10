import SwiftUI

/// The answer put together from word tiles: tapping a tile below moves it into the answer line, tapping it there
/// puts it back. Up to two of the tiles belong to other cards.
struct WordBankView: View {
    let options: [String]
    /// Positions in `options`, in the order they were tapped.
    let chosen: [Int]
    let verdict: LearnVerdict?
    let onAdd: (Int) -> Void
    let onRemove: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            answerLine
            LearnFlowLayout(spacing: 8, lineSpacing: 10) {
                ForEach(options.indices, id: \.self) { index in
                    if chosen.contains(index) {
                        tileLabel(options[index])
                            .hidden()
                            .background(Quill.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .accessibilityHidden(true)
                    } else {
                        Button {
                            guard verdict == nil else { return }
                            onAdd(index)
                        } label: {
                            tileLabel(options[index])
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Wort: \(options[index])")
                        .accessibilityHint("Fügt das Wort deiner Antwort hinzu")
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .animation(.easeInOut(duration: 0.18), value: chosen)
    }

    private var answerLine: some View {
        LearnFlowLayout(spacing: 8, lineSpacing: 10) {
            ForEach(chosen, id: \.self) { index in
                Button {
                    guard verdict == nil else { return }
                    onRemove(index)
                } label: {
                    tileLabel(options.indices.contains(index) ? options[index] : "")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("In deiner Antwort: \(options.indices.contains(index) ? options[index] : "")")
                .accessibilityHint("Nimmt das Wort wieder heraus")
            }
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .padding(14)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(verdict.map(LearnTone.color) ?? Quill.line2, lineWidth: verdict == nil ? 1 : 2)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(chosen.isEmpty ? "Deine Antwort, noch leer" : "Deine Antwort")
    }

    private func tileLabel(_ word: String) -> some View {
        Text(word)
            .font(.work(16.5, .medium))
            .foregroundStyle(Quill.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, 14)
            .frame(height: 42)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
