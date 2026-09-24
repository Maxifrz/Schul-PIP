import PDFKit
import SwiftData
import SwiftUI

struct PresentationListView: View {
    @EnvironmentObject private var store: PresentationStore
    @State private var isCreating = false
    @State private var openID: String?
    @State private var openAssistant: AssistantTab?
    @State private var isImporting = false
    @State private var importing = false
    @State private var importError: String?

    private let columns = [GridItem(.adaptive(minimum: 240, maximum: 320), spacing: 28, alignment: .top)]

    var body: some View {
        ScrollView {
            ContentColumn(maxWidth: 1100) {
                if store.presentations.isEmpty {
                    emptyState
                } else {
                    PageHeader(caption: countLabel, title: "Präsentation") {
                        HStack(spacing: 10) {
                            Button("Importieren") { isImporting = true }
                                .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                                .disabled(importing)
                            Button("Leer", action: createBlank)
                                .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                            Button("Mit KI erstellen") { isCreating = true }
                                .buttonStyle(QuillPrimaryButtonStyle())
                        }
                    }
                    .padding(.bottom, importing || importError != nil ? 16 : 30)
                    importStatus
                        .padding(.bottom, importing || importError != nil ? 24 : 0)

                    LazyVGrid(columns: columns, alignment: .leading, spacing: 30) {
                        ForEach(store.presentations) { presentation in
                            NavigationLink(value: Route.presentation(presentation.id)) {
                                PresentationTile(presentation: presentation)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button("Duplizieren") { store.duplicate(presentation) }
                                Button(role: .destructive) {
                                    store.delete(presentation)
                                } label: {
                                    Label("Löschen", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $isCreating) {
            PresentationCreateView { presentation in
                store.add(presentation)
                isCreating = false
                openID = presentation.id
            }
        }
        .navigationDestination(item: $openID) { id in
            PresentationEditorRoute(id: id, openAssistant: openAssistant)
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: PresentationImport.contentTypes) { result in
            guard case let .success(url) = result else { return }
            importing = true
            importError = nil
            Task { @MainActor in
                defer { importing = false }
                do {
                    let imported = try await PresentationImport.run(url, store: store)
                    openAssistant = .critic
                    openID = imported.presentation.id
                } catch {
                    importError = error.localizedDescription
                }
            }
        }
        .onChange(of: openID) { _, id in
            if id == nil { openAssistant = nil }
        }
    }

    @ViewBuilder
    private var importStatus: some View {
        if importing {
            HStack(spacing: 10) {
                PulsingDots()
                Text("Importiere …").font(.work(13)).foregroundStyle(Quill.faint)
            }
        } else if let importError {
            HStack(alignment: .firstTextBaseline, spacing: 9) {
                StatusDot(color: Quill.warn)
                Text(importError).font(.work(14)).foregroundStyle(Quill.ink2).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var countLabel: String {
        store.presentations.count == 1 ? "1 Präsentation" : "\(store.presentations.count) Präsentationen"
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Präsentation")
            Text("Noch keine Präsentation")
                .font(.work(34, .light))
                .tracking(-0.85)
                .foregroundStyle(Quill.ink)
                .padding(.top, 16)
            Text("Die KI baut aus deinem Material eine Präsentation mit Sprechernotizen – oder du gestaltest die Folien frei selbst. Exportieren kannst du als PowerPoint oder PDF.")
                .font(.work(15.5))
                .lineSpacing(5)
                .foregroundStyle(Quill.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
                .padding(.bottom, 30)
            HStack(spacing: 14) {
                Button("Mit KI erstellen") { isCreating = true }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 15.5))
                Button("Leere Präsentation", action: createBlank)
                    .buttonStyle(QuillOutlineButtonStyle(height: 48, fontSize: 15.5, weight: .medium))
                Button("Importieren") { isImporting = true }
                    .buttonStyle(QuillOutlineButtonStyle(height: 48, fontSize: 15.5, weight: .medium))
                    .disabled(importing)
            }
            Text("Importieren: PowerPoint (.pptx) oder PDF – danach prüft der Kritiker deine Präsentation.")
                .font(.work(13))
                .foregroundStyle(Quill.faint)
                .padding(.top, 14)
            importStatus
                .padding(.top, 16)
        }
        .frame(maxWidth: 620, alignment: .leading)
        .padding(.top, 70)
    }

    private func createBlank() {
        let presentation = Presentation(title: "Neue Präsentation", slides: [SlideLayouts.preset(.title)])
        store.add(presentation)
        openID = presentation.id
    }
}

private struct PresentationTile: View {
    @EnvironmentObject private var store: PresentationStore
    let presentation: Presentation

    var body: some View {
        let first = presentation.slides.first ?? Slide()
        VStack(alignment: .leading, spacing: 12) {
            SlideCanvas(slide: first, theme: presentation.theme, images: store.images(for: [first]))
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Quill.line, lineWidth: 1))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 6)
            VStack(alignment: .leading, spacing: 3) {
                Text(presentation.title)
                    .font(.work(14.5, .medium))
                    .tracking(-0.15)
                    .foregroundStyle(Quill.ink)
                    .lineLimit(2)
                Text(detail)
                    .font(.work(12.5))
                    .foregroundStyle(Quill.faint)
            }
        }
        .contentShape(Rectangle())
    }

    private var detail: String {
        let count = presentation.slides.count
        let date = presentation.updatedDate.formatted(.dateTime.day().month(.abbreviated))
        return "\(count == 1 ? "1 Folie" : "\(count) Folien") · \(date)"
    }
}

/// Loads the presentation for a navigation route; the editor itself needs it at init.
struct PresentationEditorRoute: View {
    @EnvironmentObject private var store: PresentationStore
    let id: String
    var openAssistant: AssistantTab?

    var body: some View {
        if let presentation = store.presentation(id) {
            PresentationEditorView(presentation: presentation, store: store, openAssistant: openAssistant)
        } else {
            Text("Diese Präsentation gibt es nicht mehr.")
                .font(.work(15))
                .foregroundStyle(Quill.muted)
        }
    }
}

struct PresentationCreateView: View {
    let onCreated: (Presentation) -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var store: PresentationStore
    @Query(sort: \StudyMaterial.createdAt) private var materials: [StudyMaterial]

    @State private var selection = Set<UUID>()
    @State private var topic = ""
    @State private var slideCount = 10
    @State private var minutes = 10
    @State private var themeID = SlideTheme.quill.id
    @State private var isGenerating = false
    @State private var stage = PresentationAssistant.Stage.outline
    @State private var review = true
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Text("Präsentation mit KI")
                    .font(.work(16, .medium))
                    .tracking(-0.24)
                    .foregroundStyle(Quill.ink)
                HStack {
                    Button("Abbrechen") { dismiss() }
                        .font(.work(15))
                        .foregroundStyle(Quill.muted)
                        .buttonStyle(.plain)
                        .disabled(isGenerating)
                    Spacer()
                    Button("Erstellen", action: generate)
                        .buttonStyle(QuillPrimaryButtonStyle(height: 34, fontSize: 14))
                        .disabled(selection.isEmpty || isGenerating)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
            .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    PixelCaption(text: "Material")
                        .padding(.bottom, 6)
                    if materials.isEmpty {
                        Text("Importiere zuerst ein PDF in der Bibliothek.")
                            .font(.work(15))
                            .foregroundStyle(Quill.faint)
                            .padding(.vertical, 14)
                    }
                    ForEach(materials) { material in
                        Button {
                            if selection.contains(material.id) { selection.remove(material.id) } else { selection.insert(material.id) }
                        } label: {
                            HStack(spacing: 14) {
                                Text(material.title)
                                    .font(.work(15.5))
                                    .foregroundStyle(Quill.ink)
                                Spacer()
                                CheckCircle(isOn: selection.contains(material.id))
                            }
                            .padding(.vertical, 15)
                            .padding(.horizontal, 2)
                            .overlay(alignment: .bottom) { QuillDivider() }
                        }
                        .buttonStyle(QuillPressStyle())
                    }

                    PixelCaption(text: "Präsentation")
                        .padding(.top, 28)
                        .padding(.bottom, 6)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Thema oder Schwerpunkt")
                            .font(.work(15.5))
                            .foregroundStyle(Quill.ink)
                        TextField("z. B. „Die Kettenregel mit Beispielen“ – leer lassen für das ganze Material", text: $topic, axis: .vertical)
                            .font(.work(15))
                            .lineLimit(1...3)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Quill.line2, lineWidth: 1))
                    }
                    .padding(.vertical, 12)
                    .padding(.horizontal, 2)
                    .overlay(alignment: .bottom) { QuillDivider() }
                    QuillRow(label: "\(slideCount) Folien", verticalPadding: 10) {
                        QuillStepper(onMinus: { slideCount = max(4, slideCount - 1) }, onPlus: { slideCount = min(25, slideCount + 1) })
                    }
                    QuillRow(label: "\(minutes) Minuten Redezeit", verticalPadding: 10) {
                        QuillStepper(onMinus: { minutes = max(3, minutes - 1) }, onPlus: { minutes = min(45, minutes + 1) })
                    }
                    QuillRow(label: "Design", verticalPadding: 10) {
                        ThemePicker(selection: $themeID)
                    }
                    QuillRow(label: "Kritiker überarbeitet automatisch", verticalPadding: 10) {
                        Toggle("", isOn: $review).labelsHidden().tint(Quill.accent)
                    }
                    Text("Nutzt das Lernplan-Modell aus den Einstellungen. Die KI plant zuerst den roten Faden, schreibt dann die Folien und lässt sie vom Kritiker prüfen. Sie verwendet nur Inhalte aus deinem Material und nennt die Seiten als Quellen. Danach kannst du jede Folie frei bearbeiten.")
                        .quillFootnote()
                    if let errorMessage {
                        HStack(alignment: .firstTextBaseline, spacing: 9) {
                            StatusDot(color: Quill.warn)
                            Text(errorMessage)
                                .font(.work(14))
                                .foregroundStyle(Quill.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.top, 20)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 22)
                .padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
        }
        .background(Quill.bg.ignoresSafeArea())
        .overlay {
            if isGenerating {
                ZStack {
                    Quill.scrim.ignoresSafeArea()
                    VStack(spacing: 12) {
                        PulsingDots(size: 6)
                        Text(stage.label)
                            .font(.work(16, .medium))
                            .foregroundStyle(Quill.ink)
                        Text("Schritt \(stage.rawValue + 1) von \(review ? 3 : 2) · je nach Umfang einige Minuten")
                            .font(.work(12.5))
                            .foregroundStyle(Quill.faint)
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 28)
                    .background(Quill.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .transition(.opacity)
            }
        }
        .interactiveDismissDisabled(isGenerating)
        .presentationBackground(Quill.bg)
        .presentationCornerRadius(24)
    }

    private func generate() {
        let chosen = materials.filter { selection.contains($0.id) }
        let client = settings.makeClient(for: .plan)
        let topic = topic
        let slideCount = slideCount
        let minutes = minutes
        let themeID = themeID
        let store = store
        isGenerating = true
        errorMessage = nil

        Task { @MainActor in
            defer { isGenerating = false }
            do {
                let inputs = try chosen.map { try PlanGenerator.Input(title: $0.title, pdf: Data(contentsOf: $0.fileURL)) }
                let content = try PlanGenerator.content(
                    for: inputs,
                    capabilities: client.capabilities,
                    instructions: PresentationPrompt.deckInstructions(topic: topic, slideCount: slideCount, minutes: minutes)
                )
                let urls = chosen.map(\.fileURL)
                let presentation = try await PresentationAssistant(client: client).generate(
                    content: content,
                    materialIDs: chosen.map(\.id.uuidString),
                    topic: topic,
                    slideCount: slideCount,
                    minutes: minutes,
                    themeID: themeID,
                    review: review,
                    onStage: { next in Task { @MainActor in stage = next } },
                    pageImage: { index, page in
                        await MainActor.run {
                            guard let pdfPage = PDFDocument(url: urls[index])?.page(at: page - 1) else { return nil }
                            let image = pdfPage.thumbnail(of: CGSize(width: 1600, height: 1600), for: .cropBox)
                            guard let data = image.jpegData(compressionQuality: 0.85),
                                  let name = try? store.saveMedia(data, fileExtension: "jpg")
                            else { return nil }
                            return PlacedImage(name: name, aspect: image.size.width / max(1, image.size.height))
                        }
                    }
                )
                onCreated(presentation)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

struct QuillStepper: View {
    let onMinus: () -> Void
    let onPlus: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onMinus) { Text("−").frame(width: 44, height: 32) }
            Rectangle().fill(Quill.line2).frame(width: 1, height: 32)
            Button(action: onPlus) { Text("+").frame(width: 44, height: 32) }
        }
        .font(.work(16))
        .foregroundStyle(Quill.ink)
        .buttonStyle(.plain)
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }
}

/// The four slide designs as small previews.
struct ThemePicker: View {
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 10) {
            ForEach(SlideTheme.all) { theme in
                let isSelected = theme.id == selection
                Button {
                    selection = theme.id
                } label: {
                    VStack(spacing: 4) {
                        HStack(spacing: 3) {
                            Capsule().fill(Color(SlideDrawing.uiColor(theme.text))).frame(width: 16, height: 4)
                            Circle().fill(Color(SlideDrawing.uiColor(theme.accent))).frame(width: 6, height: 6)
                        }
                        .frame(width: 50, height: 26)
                        .background(Color(SlideDrawing.uiColor(theme.background)), in: RoundedRectangle(cornerRadius: 4))
                        .padding(3)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(isSelected ? Quill.accent : Quill.line2, lineWidth: isSelected ? 2 : 1))
                        Text(theme.name)
                            .font(.work(11.5))
                            .foregroundStyle(isSelected ? Quill.ink : Quill.faint)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
}
