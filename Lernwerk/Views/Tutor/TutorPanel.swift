import SwiftUI

struct TutorPanel: View {
    @ObservedObject var session: TutorSession
    let onClose: () -> Void

    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        regionPreview
                        ForEach(session.turns) { turn in
                            TurnBubble(turn: turn)
                                .id(turn.id)
                        }
                        if session.isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        }
                        if let error = session.errorMessage {
                            errorView(error)
                        }
                    }
                    .padding()
                }
                .onChange(of: session.turns.count) { _, _ in
                    guard let last = session.turns.last?.id else { return }
                    withAnimation {
                        proxy.scrollTo(last, anchor: .bottom)
                    }
                }
            }
            Divider()
            controls
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Lernhilfe", systemImage: "wand.and.stars")
                    .font(.headline)
                Spacer()
                Button("Fertig", action: onClose)
                    .buttonStyle(.bordered)
            }
            HStack(spacing: 6) {
                ForEach(HintLevel.allCases, id: \.self) { level in
                    Text(level.title)
                        .font(.caption.weight(level == session.level ? .semibold : .regular))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            level <= session.level ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.08),
                            in: Capsule()
                        )
                }
            }
            if let topic = session.context.topicTitle {
                Text("Thema im Lernplan: \(topic)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }

    @ViewBuilder
    private var regionPreview: some View {
        if let data = session.regionImage, let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 140)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.3)))
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(message)
                .font(.callout)
                .foregroundStyle(.red)
            if session.turns.isEmpty {
                Button("Erneut versuchen") {
                    Task { await session.start() }
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private var controls: some View {
        VStack(spacing: 10) {
            HStack(alignment: .bottom) {
                TextField("Deine Antwort …", text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .textFieldStyle(.roundedBorder)
                Button(action: sendAnswer) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title)
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || session.isLoading)
                .accessibilityLabel("Antwort senden")
            }
            HStack {
                Button {
                    Task { await session.requestMoreHelp() }
                } label: {
                    Label("Mehr Hilfe", systemImage: "lightbulb")
                }
                .disabled(session.level == .explanation || session.isLoading)
                Spacer()
                Button("Sag's mir einfach") {
                    Task { await session.revealExplanation() }
                }
                .disabled(session.level == .explanation || session.isLoading)
            }
            .buttonStyle(.bordered)
            .font(.subheadline)
        }
        .padding()
    }

    private func sendAnswer() {
        let text = draft
        draft = ""
        Task { await session.answer(text) }
    }
}

private struct TurnBubble: View {
    let turn: TutorSession.Turn

    var body: some View {
        HStack {
            if turn.speaker == .student {
                Spacer(minLength: 40)
            }
            Text(rendered)
                .padding(10)
                .background(
                    turn.speaker == .tutor ? Color.secondary.opacity(0.12) : Color.accentColor.opacity(0.2),
                    in: RoundedRectangle(cornerRadius: 12)
                )
                .textSelection(.enabled)
            if turn.speaker == .tutor {
                Spacer(minLength: 40)
            }
        }
    }

    private var rendered: AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        return (try? AttributedString(markdown: turn.text, options: options)) ?? AttributedString(turn.text)
    }
}
