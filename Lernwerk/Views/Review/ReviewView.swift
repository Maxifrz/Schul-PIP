import SwiftData
import SwiftUI

struct ReviewView: View {
    @Query(sort: \ReviewCard.dueDate) private var cards: [ReviewCard]

    @State private var showAnswer = false
    @State private var reviewedThisSession = 0

    private var dueCards: [ReviewCard] {
        let now = Date()
        return cards.filter { $0.dueDate <= now }
    }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(caption: "Karteikarten", title: "Wiederholen") {
                Text(dueCards.count == 1 ? "1 fällig" : "\(dueCards.count) fällig")
                    .font(.work(14))
                    .foregroundStyle(Quill.muted)
                    .padding(.bottom, 6)
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, 40)
            .padding(.top, 44)

            if let card = dueCards.first {
                cardView(card)
                    .id(card.persistentModelID)
                    .transition(.opacity)
            } else {
                doneView
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .animation(.easeInOut(duration: 0.3), value: showAnswer)
        .animation(.easeInOut(duration: 0.3), value: dueCards.first?.persistentModelID)
    }

    private func cardView(_ card: ReviewCard) -> some View {
        VStack(spacing: 24) {
            PixelCaption(text: reviewedThisSession > 0 ? "\(reviewedThisSession) geschafft" : " ", color: Quill.accent)
                .frame(height: 14)
            Spacer(minLength: 0)
            Text(card.front)
                .font(.work(30, .light))
                .tracking(-0.66)
                .lineSpacing(6)
                .multilineTextAlignment(.center)
                .foregroundStyle(Quill.ink)
                .fixedSize(horizontal: false, vertical: true)
            if showAnswer {
                VStack(spacing: 14) {
                    QuillDivider()
                    Text(card.back)
                        .font(.work(18))
                        .lineSpacing(8)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Quill.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                    if let page = card.page {
                        Text("Aus deinem Material, Seite \(page)")
                            .font(.work(12.5))
                            .foregroundStyle(Quill.faint)
                    }
                }
                .transition(.opacity.combined(with: .offset(y: 6)))
            }
            Spacer(minLength: 0)
            if showAnswer {
                HStack(spacing: 10) {
                    ForEach(ReviewGrade.allCases, id: \.self) { grade in
                        Button {
                            rate(card, grade)
                        } label: {
                            HStack(spacing: 8) {
                                StatusDot(color: grade.dot, size: 7)
                                Text(grade.label)
                            }
                        }
                        .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 14.5, weight: .medium))
                    }
                }
            } else {
                Button("Antwort zeigen") { showAnswer = true }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
            }
        }
        .frame(maxWidth: 640)
        .padding(.horizontal, 32)
        .padding(.top, 28)
        .padding(.bottom, 44)
    }

    private var doneView: some View {
        VStack(spacing: 14) {
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { _ in StatusDot() }
            }
            Text("Alles wiederholt")
                .font(.work(30, .light))
                .tracking(-0.75)
                .foregroundStyle(Quill.ink)
                .padding(.top, 6)
            Text(doneText)
                .font(.work(15.5))
                .lineSpacing(5)
                .multilineTextAlignment(.center)
                .foregroundStyle(Quill.muted)
                .frame(maxWidth: 400)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 40)
        .padding(.bottom, 80)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var doneText: String {
        if reviewedThisSession > 0 {
            return "Stark – \(reviewedThisSession) Karten in dieser Runde geschafft."
        }
        guard let next = cards.first else {
            return "Karten entstehen automatisch, wenn du dir mit dem Hilfe-Werkzeug etwas erklären lässt."
        }
        return "Die nächste Karte ist \(next.dueDate.formatted(.relative(presentation: .named))) fällig."
    }

    private func rate(_ card: ReviewCard, _ grade: ReviewGrade) {
        card.apply(grade)
        showAnswer = false
        reviewedThisSession += 1
    }
}

private extension ReviewGrade {
    var dot: Color {
        switch self {
        case .again: return Color(QuillUIColor.hex(0xC46A55))
        case .hard: return Quill.warn
        case .good: return Quill.accent
        case .easy: return Color(QuillUIColor.hex(0x6F8FB0))
        }
    }
}
