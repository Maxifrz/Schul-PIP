import SwiftUI

/// One lesson of the Lernpfad, full screen: progress at the top, the exercise in the middle and, after each answer,
/// a bar with the verdict that slides up from the bottom. It grades no card itself; the finished lesson goes to
/// `onFinish` once, and whoever opened the lesson records it and says what it brought.
struct LessonView: View {
    let onFinish: (LessonResult) -> LessonRewards

    @StateObject private var model: LessonModel
    @EnvironmentObject private var progress: LearnProgressStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var sizeClass
    @AppStorage("learn.haptics") private var haptics = true
    @State private var confirmingClose = false
    @State private var result: LessonResult?
    @State private var rewards = LessonRewards()

    /// `deck` is every card of the student, for wrong answers; `distractors` the checked ones a model wrote.
    init(
        cards: [CardSnapshot],
        dueKeys: Set<String>,
        deck: [CardSnapshot] = [],
        distractors: [String: [String]] = [:],
        onFinish: @escaping (LessonResult) -> LessonRewards
    ) {
        self.onFinish = onFinish
        let seed = UInt64.random(in: 1...UInt64.max)
        _model = StateObject(wrappedValue: LessonModel(
            cards: cards, deck: deck, distractors: distractors, seed: seed, sessionID: UUID().uuidString
        ))
    }

    /// A lesson of a course: its exercises come ready and no card is graded.
    /// `coach` explains a wrong answer when the course can: why a chess move fails, what is off about a typed word.
    init(
        lessonID: String,
        exercises: [LearnExercise],
        coach: ((LearnExercise, LearnAnswer) -> String?)? = nil,
        onFinish: @escaping (LessonResult) -> LessonRewards
    ) {
        self.onFinish = onFinish
        _model = StateObject(wrappedValue: LessonModel(lessonID: lessonID, exercises: exercises, sessionID: UUID().uuidString, coach: coach))
    }

    /// With ready-made exercises, for the previews.
    init(cards: [CardSnapshot], exercises: [LearnExercise], onFinish: @escaping (LessonResult) -> LessonRewards = { _ in LessonRewards() }) {
        self.onFinish = onFinish
        _model = StateObject(wrappedValue: LessonModel(cards: cards, exercises: exercises, sessionID: UUID().uuidString))
    }

    private var compact: Bool { sizeClass == .compact }

    var body: some View {
        ZStack {
            Quill.bg.ignoresSafeArea()
            if let result {
                LessonCompleteView(
                    result: result,
                    xp: LearnProgress.xp(for: result),
                    streak: progress.progress.currentStreak(now: Date(), calendar: .current),
                    xpToday: progress.progress.xpToday(now: Date(), calendar: .current),
                    dailyGoal: progress.progress.dailyGoal,
                    rewards: rewards,
                    onDone: { dismiss() }
                )
                .transition(.opacity)
            } else {
                lesson
            }
        }
        .animation(.easeInOut(duration: 0.3), value: result)
        .onAppear(perform: reportIfFinished)
        .confirmationDialog("Lektion abbrechen?", isPresented: $confirmingClose, titleVisibility: .visible) {
            Button("Lektion abbrechen", role: .destructive) { dismiss() }
            Button("Weiterlernen", role: .cancel) {}
        } message: {
            Text("Was du in dieser Lektion beantwortet hast, wird nicht gezählt.")
        }
    }

    private var lesson: some View {
        VStack(spacing: 0) {
            topBar
            if let exercise = model.current {
                ScrollView {
                    exerciseArea(exercise)
                        .id(model.session.position)
                }
                .scrollDismissesKeyboard(.interactively)
                .scrollIndicators(.hidden)
                bottomBar(exercise)
            } else {
                Spacer()
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.86), value: model.session.phase)
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            Button { confirmingClose = true } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Quill.muted)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Lektion abbrechen")
            QuillProgressBar(fraction: model.session.progress)
                .accessibilityElement()
                .accessibilityLabel("Fortschritt")
                .accessibilityValue("\(Int((model.session.progress * 100).rounded())) Prozent")
        }
        .frame(maxWidth: 680)
        .padding(.leading, 8)
        .padding(.trailing, compact ? 20 : 32)
        .padding(.top, 8)
    }

    // The exercise

    private func exerciseArea(_ exercise: LearnExercise) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(spacing: 10) {
                PixelCaption(text: caption(for: exercise.kind), color: Quill.accent)
                if model.session.isRetry {
                    PixelCaption(text: "Nochmal", color: Quill.muted)
                }
            }
            if exercise.kind != .matchPairs {
                Text(exercise.prompt)
                    .font(.work(compact ? 24 : 28, .semibold))
                    .tracking(-0.6)
                    .lineSpacing(5)
                    .foregroundStyle(Quill.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
            }
            ExerciseMediaView(exercise: exercise)
            exerciseView(exercise)
            if model.isAnswering, !model.coachNote.isEmpty {
                noteCard(model.coachNote)
            }
            if !model.hintsShown.isEmpty {
                hintCard(model.hintsShown)
            }
        }
        .frame(maxWidth: 640, alignment: .leading)
        .padding(.horizontal, compact ? 20 : 32)
        .padding(.top, 28)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity)
    }

    /// A wrong answer keeps the right one hidden until the student asks for it.
    private var revealsSolution: Bool { model.verdict != .wrong || model.solutionShown }

    @ViewBuilder
    private func exerciseView(_ exercise: LearnExercise) -> some View {
        switch exercise.kind {
        case .multipleChoice:
            MultipleChoiceView(
                options: exercise.options,
                correct: revealsSolution ? exercise.correctAnswers.first ?? "" : "",
                choice: $model.choice,
                verdict: model.verdict,
                onPick: { LearnHaptics.selection(haptics) }
            )
        case .matchPairs:
            MatchPairsView(
                exercise: exercise,
                matched: model.matched,
                matchedBacks: model.matchedBacks,
                pickedFront: model.pickedFront,
                pickedBack: model.pickedBack,
                lastMiss: model.lastMiss,
                isLocked: !model.isAnswering,
                onFront: { pairTapped(model.pickFront($0)) },
                onBack: { pairTapped(model.pickBack($0)) }
            )
        case .wordBank:
            WordBankView(
                options: exercise.options,
                chosen: model.tiles,
                verdict: model.verdict,
                onAdd: { index in
                    LearnHaptics.selection(haptics)
                    model.addTile(index)
                },
                onRemove: { index in
                    LearnHaptics.selection(haptics)
                    model.removeTile(index)
                }
            )
        case .typeAnswer:
            TypeAnswerView(text: $model.typed, verdict: model.verdict, mode: exercise.mode, onSubmit: check)
        case .chessMove:
            if case let .board(spec)? = exercise.media {
                ChessMoveView(
                    spec: spec, from: model.moveFrom, to: model.moveTo, correctMoves: revealsSolution ? exercise.correctAnswers : [],
                    verdict: model.verdict, onTap: { square in
                        LearnHaptics.selection(haptics)
                        model.tapSquare(square)
                    }
                )
            }
        case .pianoKey:
            PianoKeyView(
                correct: exercise.correctAnswers.compactMap { Int($0) }, choice: $model.choice, verdict: model.verdict,
                showsSolution: revealsSolution
            )
        }
    }

    /// Why the last try was wrong, kept in view while the student tries again.
    private func noteCard(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "arrow.uturn.backward")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(LearnTone.wrong)
                .frame(width: 20)
                .accessibilityHidden(true)
            Text(text)
                .font(.work(15.5, .medium))
                .lineSpacing(3)
                .foregroundStyle(Quill.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Letzter Versuch falsch: " + text)
    }

    private func hintCard(_ hints: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(hints.enumerated()), id: \.offset) { _, text in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "lightbulb.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Quill.accent)
                        .frame(width: 20)
                    Text(text)
                        .font(.work(15.5))
                        .lineSpacing(3)
                        .foregroundStyle(Quill.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Hinweis: " + hints.joined(separator: ". "))
    }

    private func caption(for kind: ExerciseKind) -> String {
        switch kind {
        case .multipleChoice: return "Wähle die richtige Antwort"
        case .matchPairs: return "Finde die Paare"
        case .wordBank: return "Bilde die Antwort"
        case .typeAnswer: return "Schreib die Antwort"
        case .chessMove: return "Finde den Zug"
        case .pianoKey: return "Tippe die Taste"
        }
    }

    // Bottom

    @ViewBuilder
    private func bottomBar(_ exercise: LearnExercise) -> some View {
        if let verdict = model.verdict {
            LessonFeedbackBar(
                verdict: verdict,
                solution: verdict == .wrong && model.solutionShown ? exercise.solution : nil,
                note: verdict == .wrong ? model.retryNote : "",
                explanation: verdict == .wrong && !model.solutionShown ? "" : exercise.explanation,
                comesBack: verdict == .wrong && model.solutionShown && !model.session.isRetry,
                canOverrule: verdict == .wrong && exercise.kind == .typeAnswer,
                canRetry: verdict == .wrong && !model.solutionShown,
                compact: compact,
                onOverrule: {
                    model.overrule()
                    LearnHaptics.verdict(.right, haptics)
                },
                onRetry: { model.tryAgain() },
                onShowSolution: { model.showSolution() },
                onNext: next
            )
            .transition(.move(edge: .bottom).combined(with: .opacity))
        } else if exercise.kind != .matchPairs {
            HStack(spacing: 12) {
                if model.hasMoreHints {
                    Button("Hinweis \(model.hintsShown.count + 1)/\(model.hintTotal)") { model.showHint() }
                        .buttonStyle(QuillOutlineButtonStyle(height: 52, fontSize: 15, weight: .medium))
                        .accessibilityHint("Zeigt eine Hilfe. Die Antwort zählt dann weniger für deinen Kompetenzstand.")
                }
                Button("Prüfen", action: check)
                    .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
                    .disabled(!model.canCheck)
            }
                .frame(maxWidth: 640)
                .padding(.horizontal, compact ? 20 : 32)
                .padding(.top, 10)
                .padding(.bottom, compact ? 16 : 28)
                .frame(maxWidth: .infinity)
                .transition(.opacity)
        } else {
            Color.clear.frame(height: compact ? 16 : 28)
        }
    }

    // Flow

    private func check() {
        guard let verdict = model.check() else { return }
        LearnHaptics.verdict(verdict, haptics)
    }

    private func pairTapped(_ outcome: LessonModel.PairOutcome?) {
        switch outcome {
        case .match: LearnHaptics.selection(haptics)
        case .miss: LearnHaptics.miss(haptics)
        case let .finished(verdict): LearnHaptics.verdict(verdict, haptics)
        case nil: break
        }
    }

    private func next() {
        model.advance()
        reportIfFinished()
    }

    private func reportIfFinished() {
        guard result == nil, let finished = model.takeResult() else { return }
        rewards = onFinish(finished)
        LearnHaptics.finished(haptics)
        result = finished
    }
}

/// The verdict after an answer: green or red, the right answer after a wrong one and "Weiter".
struct LessonFeedbackBar: View {
    let verdict: LearnVerdict
    let solution: String?
    /// Why this answer was wrong, from the course; empty when it cannot tell.
    var note = ""
    /// A sentence of why; shown after right and wrong answers alike.
    var explanation = ""
    let comesBack: Bool
    let canOverrule: Bool
    /// After a wrong answer the choice is another try or the solution; "Weiter" comes once the solution is shown.
    var canRetry = false
    let compact: Bool
    let onOverrule: () -> Void
    var onRetry: () -> Void = {}
    var onShowSolution: () -> Void = {}
    let onNext: () -> Void

    private var tone: Color { LearnTone.color(verdict) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: verdict == .right ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .font(.system(size: 24, weight: .semibold))
                Text(verdict == .right ? "Richtig" : "Falsch")
                    .font(.work(24, .heavy))
                    .tracking(-0.6)
            }
            .foregroundStyle(tone)
            .accessibilityElement(children: .combine)

            if let solution {
                VStack(alignment: .leading, spacing: 6) {
                    PixelCaption(text: "Richtige Antwort", color: tone)
                    Text(solution)
                        .font(.work(16.5))
                        .lineSpacing(4)
                        .foregroundStyle(Quill.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }
            if !note.isEmpty {
                Text(note)
                    .font(.work(15, .medium))
                    .lineSpacing(3)
                    .foregroundStyle(Quill.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !explanation.isEmpty {
                Text(explanation)
                    .font(.work(14.5))
                    .lineSpacing(3)
                    .foregroundStyle(Quill.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if comesBack {
                Text("Diese Aufgabe kommt am Ende noch einmal.")
                    .font(.work(13.5))
                    .foregroundStyle(Quill.muted)
            }

            HStack(spacing: 16) {
                if canOverrule {
                    Button("War doch richtig", action: onOverrule)
                        .font(.work(14, .medium))
                        .foregroundStyle(Quill.muted)
                        .buttonStyle(.plain)
                }
                Spacer(minLength: 0)
                if canRetry {
                    Button("Lösung zeigen", action: onShowSolution)
                        .buttonStyle(QuillOutlineButtonStyle(height: 52, fontSize: 15, weight: .medium))
                    Button("Nochmal versuchen", action: onRetry)
                        .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
                        .keyboardShortcut(.defaultAction)
                } else {
                    Button("Weiter", action: onNext)
                        .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
                        .keyboardShortcut(.defaultAction)
                }
            }
        }
        .frame(maxWidth: 640, alignment: .leading)
        .padding(.horizontal, compact ? 20 : 32)
        .padding(.top, 20)
        .padding(.bottom, compact ? 16 : 28)
        .frame(maxWidth: .infinity)
        .background(tone.opacity(0.12).ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(tone.opacity(0.5)).frame(height: 1) }
    }
}
