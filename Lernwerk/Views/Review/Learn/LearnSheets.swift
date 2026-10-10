import SwiftUI

/// The guide of a unit: what to know before the first lesson.
struct UnitTipSheet: View {
    let unit: CourseUnit
    let course: Course
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
            Button("Verstanden") { dismiss() }
                .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
                .padding(.bottom, 20)
        }
        .background(Quill.bg.ignoresSafeArea())
        .presentationDetents([.large])
    }
}

/// Gems and what they buy.
struct ShopSheet: View {
    let gems: Int
    let freezes: Int
    let onBuyFreeze: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    PixelCaption(text: "Gems", color: Quill.accent)
                    HStack(spacing: 8) {
                        Image(systemName: "diamond.fill")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(Quill.link)
                        Text("\(gems)")
                            .font(.work(34, .heavy))
                            .foregroundStyle(Quill.ink)
                    }
                }
                Spacer()
                Button("Fertig") { dismiss() }
                    .buttonStyle(QuillOutlineButtonStyle(height: 38, fontSize: 14, weight: .medium))
            }
            Text("Gems bekommst du für Lektionen, Quests, Truhen und dein Tagesziel.")
                .font(.work(14.5))
                .foregroundStyle(Quill.muted)
                .fixedSize(horizontal: false, vertical: true)
            FreezeRow(gems: gems, freezes: freezes, onBuy: onBuyFreeze)
            Spacer(minLength: 0)
        }
        .padding(24)
        .background(Quill.bg.ignoresSafeArea())
        .presentationDetents([.medium])
    }
}
