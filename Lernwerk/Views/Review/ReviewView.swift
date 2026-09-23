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
        NavigationStack {
            Group {
                if let card = dueCards.first {
                    cardView(card)
                } else {
                    doneView
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle("Wiederholen")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Text("\(dueCards.count) fällig")
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func cardView(_ card: ReviewCard) -> some View {
        VStack(spacing: 24) {
            if reviewedThisSession > 0 {
                Label("\(reviewedThisSession) geschafft", systemImage: "checkmark.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(.green)
            }
            Spacer()
            Text(card.front)
                .font(.title2.weight(.semibold))
                .multilineTextAlignment(.center)
            if showAnswer {
                Divider()
                Text(card.back)
                    .font(.title3)
                    .multilineTextAlignment(.center)
                if let page = card.page {
                    Text("Aus deinem Material, Seite \(page)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if showAnswer {
                HStack(spacing: 12) {
                    ForEach(ReviewGrade.allCases, id: \.self) { grade in
                        Button(grade.label) {
                            rate(card, grade)
                        }
                        .buttonStyle(.bordered)
                        .tint(grade.tint)
                    }
                }
            } else {
                Button("Antwort zeigen") {
                    withAnimation { showAnswer = true }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
        .padding(32)
        .frame(maxWidth: 640)
    }

    private var doneView: some View {
        ContentUnavailableView {
            Label("Alles wiederholt", systemImage: "checkmark.seal.fill")
        } description: {
            Text(doneText)
        }
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
    var tint: Color {
        switch self {
        case .again: return .red
        case .hard: return .orange
        case .good: return .green
        case .easy: return .blue
        }
    }
}
