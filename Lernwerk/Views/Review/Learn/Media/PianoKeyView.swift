import SwiftUI

/// A piano keyboard to tap a key on. The answer is the key's MIDI number as text ("60" is the middle C). No key is
/// named, because the exercises ask for them.
struct PianoKeyView: View {
    /// The MIDI numbers that are right; they decide how much of the keyboard is shown.
    let correct: [Int]
    @Binding var choice: String?
    var verdict: LearnVerdict? = nil

    private var range: ClosedRange<Int> { PianoLayout.range(covering: correct) }

    var body: some View {
        let range = range
        let whites = PianoLayout.whiteKeys(in: range)
        return GeometryReader { geometry in
            let whiteWidth = geometry.size.width / CGFloat(max(1, whites.count))
            ZStack(alignment: .topLeading) {
                HStack(spacing: 0) {
                    ForEach(whites, id: \.self) { midi in
                        key(midi, black: false, width: whiteWidth, height: geometry.size.height)
                    }
                }
                ForEach((range.lowerBound...range.upperBound).filter(PianoLayout.isBlack), id: \.self) { midi in
                    key(midi, black: true, width: whiteWidth * 0.62, height: geometry.size.height * 0.6)
                        .offset(x: CGFloat(PianoLayout.blackKeyCenter(midi, in: range)) * whiteWidth - whiteWidth * 0.31)
                }
            }
        }
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Klaviatur")
    }

    private func fill(for midi: Int, black: Bool) -> Color {
        let text = String(midi)
        if let verdict {
            if correct.contains(midi) { return verdict == .right || choice == text ? LearnTone.right : LearnTone.right.opacity(0.6) }
            if choice == text { return LearnTone.wrong }
        } else if choice == text {
            return Quill.accent
        }
        return black ? Quill.paperInk : Quill.paper
    }

    private func key(_ midi: Int, black: Bool, width: CGFloat, height: CGFloat) -> some View {
        Button {
            guard verdict == nil else { return }
            choice = String(midi)
        } label: {
            Rectangle()
                .fill(fill(for: midi, black: black))
                .frame(width: width, height: height)
                .overlay(Rectangle().stroke(Quill.paperInk.opacity(black ? 0 : 0.35), lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: black ? 4 : 0, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(PianoLayout.name(midi))
        .accessibilityAddTraits(choice == String(midi) ? .isSelected : [])
    }
}

#Preview("Klaviatur") {
    PianoKeyView(correct: [60], choice: .constant("62"), verdict: nil)
        .padding()
        .background(Quill.bg)
}
