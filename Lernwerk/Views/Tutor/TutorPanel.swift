import SwiftUI

struct TutorPanel: View {
    @ObservedObject var session: TutorSession
    let onClose: () -> Void

    @State private var draft = ""
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        markedRegion
                        ForEach(session.turns) { turn in
                            TurnView(turn: turn)
                                .id(turn.id)
                                .transition(.opacity.combined(with: .move(edge: .bottom)))
                        }
                        if session.isLoading {
                            WaitingIndicator(label: session.waitingFor, since: session.waitingSince)
                                .id("waiting")
                        }
                        if let error = session.errorMessage {
                            errorView(error)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 18)
                    .padding(.bottom, 6)
                    .animation(.easeOut(duration: 0.3), value: session.turns.count)
                }
                .scrollIndicators(.hidden)
                .onChange(of: session.turns.count) { _, _ in
                    guard let last = session.turns.last?.id else { return }
                    withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                }
                .onChange(of: session.isLoading) { _, isLoading in
                    guard isLoading else { return }
                    withAnimation { proxy.scrollTo("waiting", anchor: .bottom) }
                }
            }
            composer
        }
        .background(Quill.bg)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Lernhilfe")
                    .font(.work(17, .medium))
                    .tracking(-0.25)
                    .foregroundStyle(Quill.ink)
                Spacer()
                Button("Fertig", action: onClose)
                    .buttonStyle(QuillOutlineButtonStyle(height: 32, weight: .medium))
            }
            HStack(spacing: 6) {
                ForEach(HintLevel.allCases, id: \.self) { level in
                    ladderStep(level)
                }
            }
            if session.isDemo {
                HStack(alignment: .firstTextBaseline, spacing: 9) {
                    StatusDot(color: Quill.warn)
                        .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 1 }
                    Text("Demo-Modus: vorbereitete Beispielantworten, keine echte KI. Ausschalten unter Einstellungen.")
                        .font(.work(12.5))
                        .foregroundStyle(Quill.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if let topic = session.context.topicTitle {
                Text("Thema im Lernplan: \(topic)")
                    .font(.work(12.5))
                    .foregroundStyle(Quill.faint)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 16)
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }

    private func ladderStep(_ level: HintLevel) -> some View {
        let isCurrent = level == session.level
        let isReached = level < session.level
        return Text(level.title)
            .font(.work(12.5, isCurrent ? .medium : .regular))
            .foregroundStyle(isCurrent ? Quill.bg : (isReached ? Quill.ink : Quill.faint))
            .padding(.horizontal, 11)
            .frame(height: 26)
            .background(isCurrent ? Quill.ink : (isReached ? Quill.hover : Color.clear), in: Capsule())
            .overlay(Capsule().stroke(isCurrent ? Color.clear : Quill.line2, lineWidth: 1))
            .animation(.easeInOut(duration: 0.2), value: session.level)
    }

    /// The marked passage as a paper snippet, so the conversation keeps its reference.
    @ViewBuilder
    private var markedRegion: some View {
        let text = session.context.selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        VStack(alignment: .leading, spacing: 8) {
            PixelCaption(text: "Seite \(session.context.pageNumber) · markiert", color: Quill.faint, size: 9)
            if !text.isEmpty {
                Text(text)
                    .font(.system(size: 13))
                    .lineSpacing(4)
                    .foregroundStyle(Quill.paperInk)
                    .frame(maxWidth: .infinity, maxHeight: 110, alignment: .topLeading)
                    .clipped()
            } else if let data = session.regionImage, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: 130, alignment: .leading)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Quill.paper, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }

    private func errorView(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 9) {
                StatusDot(color: Quill.warn)
                    .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 1 }
                Text(message)
                    .font(.work(14))
                    .lineSpacing(3)
                    .foregroundStyle(Quill.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if session.turns.isEmpty {
                Button("Erneut versuchen") {
                    Task { await session.start() }
                }
                .buttonStyle(QuillOutlineButtonStyle())
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 0) {
            PipView(isThinking: session.isLoading)
                .padding(.horizontal, 6)
            HStack(alignment: .bottom, spacing: 9) {
                TextField("Deine Antwort …", text: $draft, axis: .vertical)
                    .font(.work(15.5))
                    .tracking(-0.15)
                    .foregroundStyle(Quill.ink)
                    .lineLimit(1...4)
                    .focused($isInputFocused)
                    .padding(.vertical, 11)
                    .onSubmit(sendAnswer)
                Button(action: sendAnswer) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Quill.bg)
                        .frame(width: 38, height: 38)
                        .background(Quill.ink, in: Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
                .opacity(canSend ? 1 : 0.4)
                .accessibilityLabel("Antwort senden")
            }
            .padding(.leading, 18)
            .padding(6)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Quill.line2, lineWidth: 1))

            HStack(spacing: 8) {
                Button("Mehr Hilfe") {
                    Task { await session.requestMoreHelp() }
                }
                Spacer()
                Button("Sag's mir einfach") {
                    Task { await session.revealExplanation() }
                }
            }
            .buttonStyle(QuillOutlineButtonStyle())
            .disabled(session.level == .explanation || session.isLoading)
            .padding(.top, 10)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 20)
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !session.isLoading
    }

    private func sendAnswer() {
        guard canSend else { return }
        let text = draft
        draft = ""
        Task { await session.answer(text) }
    }
}

private struct TurnView: View {
    let turn: TutorSession.Turn

    var body: some View {
        switch turn.speaker {
        case .student:
            HStack {
                Spacer(minLength: 48)
                Text(turn.text)
                    .font(.work(15))
                    .tracking(-0.15)
                    .lineSpacing(4)
                    .foregroundStyle(Quill.bg)
                    .padding(.horizontal, 15)
                    .padding(.vertical, 11)
                    .background(Quill.ink, in: UnevenRoundedRectangle(
                        topLeadingRadius: 20,
                        bottomLeadingRadius: 20,
                        bottomTrailingRadius: 6,
                        topTrailingRadius: 20,
                        style: .continuous
                    ))
                    .textSelection(.enabled)
            }
        case .tutor:
            VStack(alignment: .leading, spacing: 9) {
                PixelCaption(text: "Lernhilfe · \(turn.level.title)", size: 9)
                Text(rendered)
                    .font(.work(15))
                    .lineSpacing(8)
                    .foregroundStyle(Quill.ink2)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// Markdown bold and italics in the Work Sans cuts; bold is also drawn in full ink.
    private var rendered: AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        guard var text = try? AttributedString(markdown: turn.text, options: options) else {
            return AttributedString(turn.text)
        }
        let styledRuns = text.runs.compactMap { run -> (Range<AttributedString.Index>, InlinePresentationIntent)? in
            guard let intent = run.inlinePresentationIntent else { return nil }
            return (run.range, intent)
        }
        for (range, intent) in styledRuns {
            if intent.contains(.stronglyEmphasized) {
                text[range].font = .work(15, .semibold)
                text[range].foregroundColor = Quill.ink
            } else if intent.contains(.emphasized) {
                text[range].font = .workItalic(15)
            }
        }
        return text
    }
}

private struct WaitingIndicator: View {
    let label: String?
    let since: Date?

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            HStack(spacing: 10) {
                PulsingDots()
                Text(text(at: timeline.date))
                    .font(.work(13))
                    .foregroundStyle(Quill.faint)
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 2)
            .padding(.bottom, 20)
        }
    }

    private func text(at date: Date) -> String {
        let seconds = since.map { max(0, Int(date.timeIntervalSince($0))) } ?? 0
        let base = "\(label ?? "Warte") … \(seconds) s"
        return seconds >= 30 ? base + " – kostenlose Modelle brauchen manchmal etwas länger" : base
    }
}
