import SwiftData
import SwiftUI

enum AssistantTab: String, CaseIterable, Identifiable, Hashable {
    case chat = "Chat"
    case critic = "Kritiker"
    case feedback = "Feedback"

    var id: String { rawValue }
}

/// One chat entry; for the assistant also the changes it made.
struct ChatEntry: Identifiable {
    let id = UUID()
    let fromStudent: Bool
    let text: String
    var changes: [String] = []
    var skipped = 0
}

enum FindingState {
    case applied, dismissed, failed
}

/// Chat, critic and feedback state; owned by the editor so it survives closing the panel and switching tabs.
@MainActor
final class AssistantState: ObservableObject {
    @Published var entries: [ChatEntry] = []
    @Published var chatBusy = false
    @Published var chatError: String?

    @Published var critique: Critique?
    @Published var findingStates: [Int: FindingState] = [:]
    @Published var criticBusy = false
    @Published var criticError: String?
    @Published var selectedMaterials: Set<String>

    @Published var feedback: String?
    @Published var feedbackBusy = false
    @Published var feedbackError: String?

    private var chat: PresentationChat?
    private var chatMaterial: [LLMContent]?

    init(materialIDs: [String]) {
        selectedMaterials = Set(materialIDs)
    }

    /// Reads the materials in the form the chosen provider accepts; failures leave the material out.
    private func materialContent(_ ids: Set<String>, from materials: [StudyMaterial], client: any LLMClient) -> [LLMContent] {
        let chosen = materials.filter { ids.contains($0.id.uuidString) }
        guard !chosen.isEmpty else { return [] }
        let inputs = chosen.compactMap { material in
            (try? Data(contentsOf: material.fileURL)).map { PlanGenerator.Input(title: material.title, pdf: $0) }
        }
        return (try? PlanGenerator.content(
            for: inputs,
            capabilities: client.capabilities,
            instructions: "The material above is the source the presentation is based on."
        )) ?? []
    }

    func send(_ instruction: String, model: PresentationEditorModel, settings: AppSettings, materials: [StudyMaterial]) {
        let text = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !chatBusy else { return }
        model.finishEditing()
        entries.append(ChatEntry(fromStudent: true, text: text))
        chatBusy = true
        chatError = nil
        let client = settings.makeClient(for: .tutor)
        let chat = self.chat ?? PresentationChat(client: client)
        self.chat = chat
        if chatMaterial == nil {
            chatMaterial = materialContent(Set(model.presentation.materialIds), from: materials, client: client)
        }
        let material = chatMaterial ?? []
        Task { @MainActor in
            defer { chatBusy = false }
            do {
                let reply = try await chat.send(model.presentation, instruction: text, material: material)
                let result = PresentationEdits.apply(model.presentation, reply.changes)
                if !result.applied.isEmpty { model.replacePresentation(result.presentation) }
                entries.append(ChatEntry(fromStudent: false, text: reply.message, changes: result.applied.map(\.label), skipped: result.skipped.count))
            } catch {
                chatError = error.localizedDescription
            }
        }
    }

    func runCritic(model: PresentationEditorModel, settings: AppSettings, materials: [StudyMaterial]) {
        guard !criticBusy else { return }
        model.finishEditing()
        criticBusy = true
        criticError = nil
        let client = settings.makeClient(for: .plan)
        let material = materialContent(selectedMaterials, from: materials, client: client)
        let presentation = model.presentation
        Task { @MainActor in
            defer { criticBusy = false }
            do {
                critique = try await PresentationCritic(client: client).critique(presentation, material: material)
                findingStates = [:]
            } catch {
                criticError = error.localizedDescription
            }
        }
    }

    func apply(_ indices: [Int], model: PresentationEditorModel) {
        guard let critique else { return }
        model.finishEditing()
        let changes = indices.flatMap { critique.findings[$0].changes }
        let result = PresentationEdits.apply(model.presentation, changes)
        if !result.applied.isEmpty { model.replacePresentation(result.presentation) }
        for index in indices {
            let ok = critique.findings[index].changes.contains { result.applied.contains($0) }
            findingStates[index] = ok ? .applied : .failed
        }
    }

    func loadFeedback(model: PresentationEditorModel, settings: AppSettings) {
        guard !feedbackBusy else { return }
        model.finishEditing()
        feedbackBusy = true
        feedbackError = nil
        let assistant = PresentationAssistant(client: settings.makeClient(for: .tutor))
        let presentation = model.presentation
        Task { @MainActor in
            defer { feedbackBusy = false }
            do {
                feedback = try await assistant.feedback(presentation)
            } catch {
                feedbackError = error.localizedDescription
            }
        }
    }
}

/// The side panel of the presentation editor: a chat that carries out instructions right away (one undo step each),
/// a sceptical critic whose proposals the student approves one by one, and the Socratic feedback.
struct AssistantPanel: View {
    @ObservedObject var model: PresentationEditorModel
    @ObservedObject var state: AssistantState
    @Binding var tab: AssistantTab
    let onClose: () -> Void

    @EnvironmentObject private var settings: AppSettings
    @Query(sort: \StudyMaterial.createdAt) private var materials: [StudyMaterial]
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Assistent").font(.work(17, .medium)).tracking(-0.25).foregroundStyle(Quill.ink)
                Spacer()
                Button("Schließen", action: onClose)
                    .buttonStyle(QuillOutlineButtonStyle(height: 32, weight: .medium))
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 12)
            HStack(spacing: 6) {
                ForEach(AssistantTab.allCases) { entry in
                    let selected = entry == tab
                    Button { tab = entry } label: {
                        Text(entry.rawValue)
                            .font(.work(13, .medium))
                            .foregroundStyle(selected ? Quill.bg : Quill.ink)
                            .padding(.horizontal, 12)
                            .frame(height: 30)
                            .background(selected ? Quill.ink : Color.clear, in: Capsule())
                            .overlay(Capsule().stroke(selected ? Color.clear : Quill.line2, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 12)
            QuillDivider(color: Quill.lineSoft)
            switch tab {
            case .chat: chatTab
            case .critic: criticTab
            case .feedback: feedbackTab
            }
        }
        .background(Quill.bg)
    }

    // Chat

    private static let examples = [
        "Mach Folie 3 kürzer",
        "Füge nach Folie 2 eine Folie mit einem Beispiel ein",
        "Stell auf das Kreide-Design um",
        "Schreib die Notizen für einen lockeren Vortrag",
    ]

    private var chatTab: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if state.entries.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                PixelCaption(text: "Sag, was sich ändern soll", size: 9)
                                ForEach(Self.examples, id: \.self) { example in
                                    Button { draft = example } label: {
                                        Text(example)
                                            .font(.work(14))
                                            .foregroundStyle(Quill.ink2)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 8)
                                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Quill.line2, lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        ForEach(state.entries) { entry in
                            chatBubble(entry)
                        }
                        if state.chatBusy {
                            HStack(spacing: 10) {
                                PulsingDots()
                                Text("Arbeite an deiner Präsentation …").font(.work(13)).foregroundStyle(Quill.faint)
                            }
                        }
                        if let error = state.chatError { notice(error) }
                        Color.clear.frame(height: 1).id("end")
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .onChange(of: state.entries.count) { _, _ in
                    withAnimation { proxy.scrollTo("end", anchor: .bottom) }
                }
            }
            VStack(spacing: 0) {
                PipView(isThinking: state.chatBusy)
                    .padding(.horizontal, 6)
                HStack(alignment: .bottom, spacing: 9) {
                    TextField("Anweisung …", text: $draft, axis: .vertical)
                        .font(.work(15))
                        .foregroundStyle(Quill.ink)
                        .lineLimit(1...4)
                        .padding(.vertical, 9)
                        .onSubmit(send)
                    Button("Senden", action: send)
                        .buttonStyle(QuillPrimaryButtonStyle(height: 34, fontSize: 13.5))
                        .disabled(!canSend)
                        .opacity(canSend ? 1 : 0.4)
                }
                .padding(.leading, 16)
                .padding(5)
                .background(Quill.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !state.chatBusy
    }

    private func send() {
        guard canSend else { return }
        let text = draft
        draft = ""
        state.send(text, model: model, settings: settings, materials: materials)
    }

    @ViewBuilder
    private func chatBubble(_ entry: ChatEntry) -> some View {
        if entry.fromStudent {
            HStack {
                Spacer(minLength: 40)
                Text(entry.text)
                    .font(.work(14.5))
                    .foregroundStyle(Quill.bg)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Quill.ink, in: UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 18, bottomTrailingRadius: 6, topTrailingRadius: 18))
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                PixelCaption(text: "Assistent", size: 9)
                Text(markdown(entry.text))
                    .font(.work(14.5))
                    .lineSpacing(5)
                    .foregroundStyle(Quill.ink2)
                    .textSelection(.enabled)
                ForEach(entry.changes, id: \.self) { change in
                    HStack(spacing: 8) {
                        StatusDot()
                        Text(change).font(.work(13)).foregroundStyle(Quill.muted)
                    }
                }
                if entry.skipped > 0 {
                    Text("\(entry.skipped) Änderung(en) passten nicht mehr und wurden übersprungen.").font(.work(12.5)).foregroundStyle(Quill.warn)
                }
                if !entry.changes.isEmpty {
                    Text("Rückgängig machen geht oben mit „Rückgängig“.").font(.work(12)).foregroundStyle(Quill.faint)
                }
            }
        }
    }

    // Critic

    private var criticTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Der Kritiker sucht wie ein strenger Lehrer nach Schwächen: falsche oder unbelegte Aussagen, Lücken im roten Faden, zu viel Text, fehlende Quellen. Du entscheidest bei jedem Vorschlag, ob er umgesetzt wird.")
                    .font(.work(13.5))
                    .lineSpacing(4)
                    .foregroundStyle(Quill.muted)
                    .fixedSize(horizontal: false, vertical: true)
                if !materials.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        PixelCaption(text: "Gegen Material prüfen", size: 9)
                        ForEach(materials) { material in
                            let id = material.id.uuidString
                            let selected = state.selectedMaterials.contains(id)
                            Button {
                                if selected { state.selectedMaterials.remove(id) } else { state.selectedMaterials.insert(id) }
                            } label: {
                                HStack(spacing: 10) {
                                    CheckCircle(isOn: selected, size: 18)
                                    Text(material.title).font(.work(14)).foregroundStyle(Quill.ink).lineLimit(1)
                                    Spacer()
                                }
                                .padding(.vertical, 6)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                Button(state.critique == nil ? "Kritik starten" : "Neu prüfen") {
                    state.runCritic(model: model, settings: settings, materials: materials)
                }
                .buttonStyle(QuillPrimaryButtonStyle(height: 40, fontSize: 14.5))
                .disabled(state.criticBusy)
                if state.criticBusy {
                    HStack(spacing: 10) {
                        PulsingDots()
                        Text("Der Kritiker liest …").font(.work(13)).foregroundStyle(Quill.faint)
                    }
                }
                if let error = state.criticError { notice(error) }
                if let critique = state.critique {
                    if !critique.verdict.isBlank {
                        VStack(alignment: .leading, spacing: 6) {
                            PixelCaption(text: "Urteil", size: 9)
                            Text(critique.verdict).font(.work(14.5)).lineSpacing(4).foregroundStyle(Quill.ink2)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Quill.line2, lineWidth: 1))
                    }
                    let open = critique.findings.indices.filter { state.findingStates[$0] == nil && !critique.findings[$0].changes.isEmpty }
                    if open.count > 1 {
                        Button("Alle \(open.count) Vorschläge übernehmen") { state.apply(open, model: model) }
                            .buttonStyle(QuillOutlineButtonStyle(weight: .medium))
                    }
                    if critique.findings.isEmpty {
                        Text("Keine Schwächen gefunden.").font(.work(14)).foregroundStyle(Quill.muted)
                    }
                    ForEach(Array(critique.findings.enumerated()), id: \.offset) { index, finding in
                        findingCard(finding, status: state.findingStates[index]) {
                            state.apply([index], model: model)
                        } onDismiss: {
                            state.findingStates[index] = .dismissed
                        }
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func findingCard(_ finding: Finding, status: FindingState?, onApply: @escaping () -> Void, onDismiss: @escaping () -> Void) -> some View {
        let slideIndex = finding.slideID.flatMap { id in model.presentation.slides.firstIndex { $0.id == id } }
        let dot: Color
        switch finding.severity {
        case .high: dot = Color(SlideDrawing.uiColor(0xC46A55))
        case .medium: dot = Quill.warn
        case .low: dot = Quill.accent
        }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                StatusDot(color: dot, size: 8)
                Text(finding.severity.label).font(.work(12.5, .medium)).foregroundStyle(Quill.ink)
                Text(slideIndex.map { "Folie \($0 + 1)" } ?? "Ganze Präsentation").font(.work(12.5)).foregroundStyle(Quill.faint)
                Spacer()
                if let slideIndex {
                    Button("Zeigen") { model.selectSlide(slideIndex) }
                        .font(.work(12.5, .medium))
                        .foregroundStyle(Quill.accent)
                        .buttonStyle(.plain)
                }
            }
            Text(finding.problem).font(.work(14.5)).lineSpacing(4).foregroundStyle(Quill.ink)
            if !finding.suggestion.isBlank {
                Text("Vorschlag: \(finding.suggestion)").font(.work(13.5)).lineSpacing(3).foregroundStyle(Quill.muted)
            }
            ForEach(Array(finding.changes.enumerated()), id: \.offset) { _, change in
                Text("→ \(change.label)").font(.work(13)).foregroundStyle(Quill.ink2)
            }
            switch status {
            case .applied:
                Text("Umgesetzt").font(.work(13, .medium)).foregroundStyle(Quill.accent)
            case .dismissed:
                Text("Verworfen").font(.work(13)).foregroundStyle(Quill.faint)
            case .failed:
                Text("Passte nicht mehr zur Präsentation – bitte selbst anpassen.").font(.work(13)).foregroundStyle(Quill.warn)
            case nil:
                HStack(spacing: 8) {
                    if !finding.changes.isEmpty {
                        Button("Übernehmen", action: onApply)
                            .buttonStyle(QuillPrimaryButtonStyle(height: 32, fontSize: 13.5))
                    }
                    Button(finding.changes.isEmpty ? "Erledigt" : "Verwerfen", action: onDismiss)
                        .buttonStyle(QuillOutlineButtonStyle(height: 32))
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Quill.surface.opacity(status == .dismissed ? 0.5 : 1), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Quill.line2, lineWidth: 1))
    }

    // Feedback

    private var feedbackTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Feedback im Stil der Lernhilfe: Stärken kurz, dann Fragen, mit denen du die Schwachstellen selbst findest.")
                    .font(.work(13.5))
                    .lineSpacing(4)
                    .foregroundStyle(Quill.muted)
                    .fixedSize(horizontal: false, vertical: true)
                Button(state.feedback == nil ? "Feedback holen" : "Neu holen") {
                    state.loadFeedback(model: model, settings: settings)
                }
                .buttonStyle(QuillPrimaryButtonStyle(height: 40, fontSize: 14.5))
                .disabled(state.feedbackBusy)
                if state.feedbackBusy { PulsingDots() }
                if let error = state.feedbackError { notice(error) }
                if let feedback = state.feedback {
                    Text(markdown(feedback))
                        .font(.work(15))
                        .lineSpacing(8)
                        .foregroundStyle(Quill.ink2)
                        .textSelection(.enabled)
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // Helpers

    private func markdown(_ text: String) -> AttributedString {
        (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text)
    }

    private func notice(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 9) {
            StatusDot(color: Quill.warn)
            Text(text).font(.work(14)).foregroundStyle(Quill.ink2).fixedSize(horizontal: false, vertical: true)
        }
    }
}
