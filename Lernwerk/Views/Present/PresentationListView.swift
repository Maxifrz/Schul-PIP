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
            SlideCanvas(slide: first, theme: presentation.theme, images: store.images(for: [first]), index: 0)
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
    @Query(sort: \StudyMaterial.createdAt) private var allMaterials: [StudyMaterial]
    private var materials: [StudyMaterial] { allMaterials.filter { !$0.isTrashed } }

    @State private var selection = Set<UUID>()
    @State private var topic = ""
    @State private var slideCount = 10
    @State private var minutes = 10
    @State private var themeID = SlideDesign.auto
    @State private var isGenerating = false
    @State private var stage = PresentationAssistant.Stage.outline
    @State private var review = true
    @State private var research = true
    @State private var step = 0
    @State private var errorMessage: String?
    /// The live view: the plan, then the written slides, revealed one by one.
    @State private var buildOutline: PresentationPrompt.Outline?
    @State private var buildDraft: Presentation?
    @State private var buildImages: [String: UIImage] = [:]
    @State private var revealed = 0
    @State private var revealTask: Task<Void, Never>?

    private var canGenerate: Bool { !selection.isEmpty || research && !topic.isBlank }

    /// Outline, slides and the optional steps; researching a bare topic takes a round before the outline.
    private var stepCount: Int {
        2 + (review ? 1 : 0) + (research ? 1 : 0) + (research && selection.isEmpty ? 1 : 0)
    }

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
                        .disabled(!canGenerate || isGenerating)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
            .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    PixelCaption(text: research ? "Material (optional)" : "Material")
                        .padding(.bottom, 6)
                    if materials.isEmpty {
                        Text(research ? "Kein Material in der Bibliothek – die KI baut den Vortrag dann nur aus der Wikipedia-Recherche." : "Importiere zuerst ein PDF in der Bibliothek.")
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
                        TextField(
                            selection.isEmpty && research ? "z. B. „Photosynthese“ – ohne Material ist das Thema Pflicht" : "z. B. „Die Kettenregel mit Beispielen“ – leer lassen für das ganze Material",
                            text: $topic,
                            axis: .vertical
                        )
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
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Design")
                            .font(.work(15.5))
                            .foregroundStyle(Quill.ink)
                        ThemePicker(selection: $themeID, allowsAuto: true)
                    }
                    .padding(.vertical, 12)
                    .overlay(alignment: .bottom) { QuillDivider() }
                    QuillRow(label: "Kritiker überarbeitet automatisch", verticalPadding: 10) {
                        Toggle("", isOn: $review).labelsHidden().tint(Quill.accent)
                    }
                    QuillRow(label: "Wikipedia-Recherche", verticalPadding: 10) {
                        Toggle("", isOn: $research).labelsHidden().tint(Quill.accent)
                    }
                    Text(
                        "Nutzt das Lernplan-Modell aus den Einstellungen. Die KI plant zuerst den roten Faden, schreibt dann die Folien und lässt sie vom Kritiker prüfen. "
                            + (research
                                ? "Mit Recherche schlägt sie fehlende Hintergründe, Zahlen und Beispiele in der deutschen Wikipedia nach. Jede Folie nennt ihre Quellen – Material-Seiten und Wikipedia-Artikel mit Link und Abrufdatum. "
                                : "Sie verwendet nur Inhalte aus deinem Material und nennt die Seiten als Quellen. ")
                            + "Danach kannst du jede Folie frei bearbeiten."
                    )
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
                PresentationBuildView(
                    stage: stage,
                    step: step,
                    stepCount: stepCount,
                    outline: buildOutline,
                    draft: buildDraft,
                    revealed: revealed,
                    images: buildImages
                )
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
        let wikipedia = research ? WikipediaClient() : nil
        let hasMaterial = !chosen.isEmpty
        isGenerating = true
        errorMessage = nil
        step = 0
        buildOutline = nil
        buildDraft = nil
        buildImages = [:]
        revealed = 0
        revealTask?.cancel()

        Task { @MainActor in
            defer { isGenerating = false }
            do {
                let inputs = try chosen.map { try PlanGenerator.Input(title: $0.title, pdf: Data(contentsOf: $0.fileURL)) }
                let content = try PlanGenerator.content(
                    for: inputs,
                    capabilities: client.capabilities,
                    instructions: PresentationPrompt.deckInstructions(
                        topic: topic,
                        slideCount: slideCount,
                        minutes: minutes,
                        research: wikipedia != nil,
                        hasMaterial: hasMaterial
                    )
                )
                let urls = chosen.map(\.fileURL)
                let presentation = try await PresentationAssistant(client: client).generate(
                    content: content,
                    materialIDs: chosen.map(\.id.uuidString),
                    materialTitles: chosen.map(\.title),
                    topic: topic,
                    slideCount: slideCount,
                    minutes: minutes,
                    themeID: themeID,
                    review: review,
                    wikipedia: wikipedia,
                    onStage: { next in
                        Task { @MainActor in
                            stage = next
                            step += 1
                        }
                    },
                    onProgress: { progress in
                        Task { @MainActor in
                            switch progress {
                            case let .outline(outline):
                                withAnimation { buildOutline = outline }
                            case let .draft(draft):
                                buildImages = store.images(for: draft.slides)
                                buildDraft = draft
                                reveal(draft.slides.count)
                            }
                        }
                    },
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
                // Let the last slides turn up before the editor opens.
                await revealTask?.value
                buildImages = store.images(for: presentation.slides)
                buildDraft = presentation
                withAnimation { revealed = presentation.slides.count }
                try? await Task.sleep(nanoseconds: 600_000_000)
                onCreated(presentation)
            } catch {
                revealTask?.cancel()
                errorMessage = error.localizedDescription
            }
        }
    }

    /// The written slides turn up one after another in the places the plan reserved for them.
    private func reveal(_ total: Int) {
        revealTask?.cancel()
        revealTask = Task { @MainActor in
            while revealed < total, !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 300_000_000)
                if Task.isCancelled { return }
                withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { revealed += 1 }
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

/// The slide designs as real previews: a sample title slide, or the deck's own first slide, in every design. With
/// `allowsAuto` the first tile leaves the choice to the AI.
struct ThemePicker: View {
    @Binding var selection: String
    var allowsAuto = false
    var slide: Slide?
    var images: [String: UIImage] = [:]

    private static let sample = Slide(elements: SlideLayouts.build(SlideDraft(
        layout: .title, title: "Photosynthese", subtitle: "Wie Pflanzen aus Licht Zucker machen"
    )))

    var body: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 14) {
                if allowsAuto {
                    tile(name: "Automatisch", isSelected: selection == SlideDesign.auto, select: SlideDesign.auto) {
                        VStack(spacing: 6) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 22))
                                .foregroundStyle(Quill.accent)
                            Text("Die KI wählt passend zum Thema")
                                .font(.work(11.5))
                                .foregroundStyle(Quill.muted)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 12)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Quill.surface)
                    }
                }
                ForEach(SlideTheme.all) { theme in
                    tile(name: theme.name, isSelected: theme.id == selection, select: theme.id) {
                        SlideCanvas(slide: slide ?? Self.sample, theme: theme, images: images, index: 0)
                    }
                }
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 2)
        }
        .scrollIndicators(.hidden)
    }

    private func tile<Preview: View>(name: String, isSelected: Bool, select id: String, @ViewBuilder preview: () -> Preview) -> some View {
        Button {
            selection = id
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                preview()
                    .frame(width: 168, height: 94.5)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(isSelected ? Quill.accent : Quill.line2, lineWidth: isSelected ? 2.5 : 1)
                    )
                Text(name)
                    .font(.work(12.5, isSelected ? .medium : .regular))
                    .foregroundStyle(isSelected ? Quill.ink : Quill.muted)
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
