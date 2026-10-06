import SwiftData
import SwiftUI

/// Flashcards by typing: the student answers the question, the app says "Richtig" or "Falsch" (compared on the
/// device, no AI) and schedules the card with SM-2: right is "good", wrong is "again". After a wrong answer the same
/// question can come back at once (a switch), the solution can be looked at, and a wrong verdict can be overruled.
struct ReviewView: View {
    @Query(sort: \ReviewCard.dueDate) private var cards: [ReviewCard]
    @AppStorage("review.repeatWrong") private var repeatWrong = false

    /// The card being answered. It stays put while the verdict shows, although a graded card has already left the
    /// due list.
    @State private var heldID: PersistentIdentifier?
    @State private var answer = ""
    @State private var verdict: AnswerCheck.Verdict?
    @State private var overruled = false
    @State private var solutionShown = false
    @State private var graded: Set<PersistentIdentifier> = []
    @State private var reviewedThisSession = 0
    @FocusState private var answerFocused: Bool

    private var dueCards: [ReviewCard] {
        let now = Date()
        return cards.filter { $0.dueDate <= now }
    }

    private var current: ReviewCard? {
        if let heldID, let held = cards.first(where: { $0.persistentModelID == heldID }) { return held }
        return dueCards.first
    }

    private var isCorrect: Bool { verdict == .correct || overruled }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(caption: "Karteikarten", title: "Wiederholen") {
                VStack(alignment: .trailing, spacing: 8) {
                    Text(dueCards.count == 1 ? "1 fällig" : "\(dueCards.count) fällig")
                        .font(.work(14))
                        .foregroundStyle(Quill.muted)
                    Toggle(isOn: $repeatWrong) {
                        Text("Bei falsch gleich nochmal")
                            .font(.work(13))
                            .foregroundStyle(Quill.muted)
                    }
                    .toggleStyle(.switch)
                    .tint(Quill.accent)
                    .fixedSize()
                }
                .padding(.bottom, 4)
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, 40)
            .padding(.top, 44)

            if let card = current {
                cardView(card)
                    .id(card.persistentModelID)
                    .transition(.opacity)
            } else {
                doneView
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .animation(.easeInOut(duration: 0.25), value: verdict)
        .animation(.easeInOut(duration: 0.25), value: overruled)
        .animation(.easeInOut(duration: 0.25), value: solutionShown)
        .onChange(of: current?.persistentModelID, initial: true) { _, _ in
            if verdict == nil { answerFocused = true }
        }
    }

    // The card

    private func cardView(_ card: ReviewCard) -> some View {
        VStack(spacing: 24) {
            PixelCaption(text: reviewedThisSession > 0 ? "\(reviewedThisSession) geschafft" : " ", color: Quill.accent)
                .frame(height: 14)
            Spacer(minLength: 0)
            Text(card.front)
                .font(.work(30, .semibold))
                .tracking(-0.66)
                .lineSpacing(6)
                .multilineTextAlignment(.center)
                .foregroundStyle(Quill.ink)
                .fixedSize(horizontal: false, vertical: true)
            if verdict == nil {
                answerField(card)
            } else {
                verdictView(card)
            }
            Spacer(minLength: 0)
            actions(card)
        }
        .frame(maxWidth: 640)
        .padding(.horizontal, 32)
        .padding(.top, 28)
        .padding(.bottom, 44)
    }

    private func answerField(_ card: ReviewCard) -> some View {
        TextField("Deine Antwort", text: $answer)
            .font(.work(18))
            .multilineTextAlignment(.center)
            .foregroundStyle(Quill.ink)
            .textInputAutocapitalization(.sentences)
            .submitLabel(.done)
            .focused($answerFocused)
            .onSubmit { check(card) }
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(answerFocused ? Quill.accent : Quill.line2, lineWidth: answerFocused ? 2 : 1))
    }

    private func verdictView(_ card: ReviewCard) -> some View {
        VStack(spacing: 14) {
            Text(isCorrect ? "Richtig" : "Falsch")
                .font(.work(52, .heavy))
                .tracking(-1.5)
                .foregroundStyle(isCorrect ? Quill.link : Color(QuillUIColor.hex(0xC46A55)))
            if solutionShown {
                VStack(spacing: 10) {
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
        }
    }

    @ViewBuilder
    private func actions(_ card: ReviewCard) -> some View {
        if verdict == nil {
            Button("Prüfen") { check(card) }
                .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
        } else {
            VStack(spacing: 14) {
                HStack(spacing: 10) {
                    if !isCorrect, repeatWrong {
                        Button("Nochmal versuchen") { retry(card) }
                            .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
                        Button("Weiter") { next(card) }
                            .buttonStyle(QuillOutlineButtonStyle(height: 52, fontSize: 16, weight: .medium))
                    } else {
                        Button("Weiter") { next(card) }
                            .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
                    }
                }
                if !isCorrect {
                    HStack(spacing: 22) {
                        if !solutionShown {
                            Button("Lösung ansehen") { solutionShown = true }
                        }
                        Button("War doch richtig") { overruled = true }
                    }
                    .font(.work(14, .medium))
                    .foregroundStyle(Quill.muted)
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // Flow

    private func check(_ card: ReviewCard) {
        guard !answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        verdict = AnswerCheck.evaluate(answer: answer, expected: card.back)
        heldID = card.persistentModelID
        overruled = false
        solutionShown = false
        answerFocused = false
    }

    /// The first answer to a card decides its schedule; a retry or an overruled verdict is settled when the student
    /// moves on, and only once per card and session.
    private func settle(_ card: ReviewCard) {
        guard !graded.contains(card.persistentModelID) else { return }
        graded.insert(card.persistentModelID)
        card.apply(isCorrect ? .good : .again)
        if isCorrect { reviewedThisSession += 1 }
    }

    private func retry(_ card: ReviewCard) {
        settle(card)
        reset(keepCard: true)
    }

    private func next(_ card: ReviewCard) {
        settle(card)
        graded.remove(card.persistentModelID)
        reset(keepCard: false)
    }

    private func reset(keepCard: Bool) {
        answer = ""
        verdict = nil
        overruled = false
        solutionShown = false
        if !keepCard { heldID = nil }
        answerFocused = true
    }

    // Done

    private var doneView: some View {
        VStack(spacing: 14) {
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { _ in StatusDot() }
            }
            Text("Alles wiederholt")
                .font(.work(30, .semibold))
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
            return "Stark – \(reviewedThisSession) Karten in dieser Runde richtig."
        }
        guard let next = cards.first else {
            return "Karten entstehen automatisch, wenn du dir mit dem Hilfe-Werkzeug etwas erklären lässt."
        }
        return "Die nächste Karte ist \(next.dueDate.formatted(.relative(presentation: .named))) fällig."
    }
}
