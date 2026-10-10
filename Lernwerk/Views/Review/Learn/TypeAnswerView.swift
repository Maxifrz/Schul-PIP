import SwiftUI

/// The answer typed from memory, in the field of the review screen and checked with the same AnswerCheck. A wrong
/// verdict can be overruled from the feedback bar ("War doch richtig").
struct TypeAnswerView: View {
    @Binding var text: String
    let verdict: LearnVerdict?
    let onSubmit: () -> Void

    @FocusState private var focused: Bool

    var body: some View {
        TextField("Deine Antwort", text: $text)
            .font(.work(18))
            .multilineTextAlignment(.center)
            .foregroundStyle(Quill.ink)
            .textInputAutocapitalization(.sentences)
            .submitLabel(.done)
            .focused($focused)
            .onSubmit(onSubmit)
            .disabled(verdict != nil)
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(borderColor, lineWidth: focused || verdict != nil ? 2 : 1))
            .accessibilityLabel("Deine Antwort")
            .onChange(of: verdict, initial: true) { _, verdict in
                // The keyboard makes room for the verdict once the answer is checked.
                focused = verdict == nil
            }
    }

    private var borderColor: Color {
        if let verdict { return LearnTone.color(verdict) }
        return focused ? Quill.accent : Quill.line2
    }
}
