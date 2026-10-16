import SwiftUI

/// The guide of a unit: what to know before the first lesson.
struct UnitTipSheet: View {
    let unit: CourseUnit
    let course: Course
    /// Set when the student may skip the unit by passing its test.
    var onTestOut: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss

    private var paragraphs: [String] {
        unit.tip.components(separatedBy: "\n\n").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    PixelCaption(text: "Einheit \(unit.number) · Tipps", color: Quill.accent)
                    Text(unit.title)
                        .font(.work(28, .heavy))
                        .tracking(-0.8)
                        .foregroundStyle(Quill.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if !unit.summary.isEmpty {
                        Text(unit.summary)
                            .font(.work(15.5))
                            .foregroundStyle(Quill.muted)
                    }
                    QuillDivider()
                    ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                        Text(paragraph)
                            .font(.work(16.5))
                            .lineSpacing(5)
                            .foregroundStyle(Quill.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: 560, alignment: .leading)
                .padding(24)
                .frame(maxWidth: .infinity)
            }
            if let onTestOut {
                VStack(spacing: 6) {
                    Button("Einheit überspringen: Test machen") {
                        dismiss()
                        onTestOut()
                    }
                    .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                    Text("Ab 85 % richtig, ohne Hilfe, zählt die Einheit als bearbeitet. Als Fähigkeit zählt nur, was der Test zeigt.")
                        .font(.work(12.5))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Quill.muted)
                        .padding(.horizontal, 24)
                }
                .padding(.bottom, 10)
            }
            Button("Verstanden") { dismiss() }
                .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
                .padding(.bottom, 20)
        }
        .background(Quill.bg.ignoresSafeArea())
        .presentationDetents([.large])
    }
}
