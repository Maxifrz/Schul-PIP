import PDFKit
import SwiftData
import SwiftUI

struct DocumentScreen: View {
    let material: StudyMaterial
    let startPage: Int?
    let backTitle: String

    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Query private var topics: [PlanTopic]
    @Query private var cards: [ReviewCard]

    @State private var document: PDFDocument?
    @State private var loadFailed = false
    @State private var mode: InteractionMode = .read
    @State private var tutor: TutorSession?

    init(material: StudyMaterial, startPage: Int? = nil, backTitle: String = "Bibliothek") {
        self.material = material
        self.startPage = startPage
        self.backTitle = backTitle
    }

    var body: some View {
        VStack(spacing: 0) {
            DetailHeader(backTitle: backTitle, title: material.title, onBack: leave) {
                if let document {
                    PixelCaption(text: document.pageCount == 1 ? "1 Seite" : "\(document.pageCount) Seiten")
                        .padding(.trailing, 8)
                }
            }
            HStack(spacing: 0) {
                ZStack(alignment: .bottom) {
                    content
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Quill.canvas)
                    DocumentToolbar(mode: $mode)
                        .padding(.bottom, 18)
                }
                if sizeClass == .regular, let tutor {
                    Rectangle()
                        .fill(Quill.line)
                        .frame(width: 1)
                    TutorPanel(session: tutor, onClose: closeTutor)
                        .frame(width: 390)
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.9), value: tutor != nil)
        }
        .background(Quill.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: compactTutorPresented) {
            if let tutor {
                TutorPanel(session: tutor, onClose: closeTutor)
                    .presentationDetents([.medium, .large])
                    .presentationBackground(Quill.bg)
            }
        }
        .task {
            loadDocument()
        }
    }

    @ViewBuilder
    private var content: some View {
        if let document {
            PDFCanvasView(
                document: document,
                fileName: material.fileName,
                mode: mode,
                startPage: startPage ?? material.lastOpenedPage,
                onMark: openTutor,
                onPageChange: { material.lastOpenedPage = $0 }
            )
        } else if loadFailed {
            VStack(spacing: 10) {
                Text("PDF nicht lesbar")
                    .font(.work(24, .light))
                    .foregroundStyle(Quill.ink)
                Text("Die Datei fehlt oder ist beschädigt.")
                    .font(.work(15))
                    .foregroundStyle(Quill.muted)
            }
        } else {
            PulsingDots(size: 6)
        }
    }

    private var compactTutorPresented: Binding<Bool> {
        Binding(
            get: { sizeClass != .regular && tutor != nil },
            set: { isPresented in
                if !isPresented { closeTutor() }
            }
        )
    }

    private func leave() {
        closeTutor()
        dismiss()
    }

    private func loadDocument() {
        guard document == nil else { return }
        if let loaded = PDFDocument(url: material.fileURL) {
            document = loaded
        } else {
            loadFailed = true
        }
    }

    private func openTutor(_ region: MarkedRegion) {
        closeTutor()
        let pageNumber = region.pageIndex + 1
        let topic = topics.first { $0.materialID == material.id && $0.sourcePages.contains(pageNumber) }
        let weakSpots = cards
            .filter { $0.materialID == material.id }
            .sorted { ($0.lapses, $0.createdAt) > ($1.lapses, $1.createdAt) }
            .prefix(5)
            .map(\.front)

        let context = TutorContext(
            materialTitle: material.title,
            pageNumber: pageNumber,
            selectedText: region.selectedText,
            pageText: region.pageText,
            topicTitle: topic?.title,
            topicSummary: topic?.summary,
            weakSpots: Array(weakSpots)
        )
        let session = TutorSession(
            context: context,
            regionImage: region.imageJPEG,
            client: settings.makeClient(for: .tutor),
            modelLabel: settings.modelLabel(for: .tutor)
        )
        tutor = session
        Task { await session.start() }
    }

    /// Every region the student needed help with becomes a flashcard for spaced repetition.
    private func closeTutor() {
        guard let session = tutor else { return }
        tutor = nil
        guard session.hasHelped else { return }

        let materialID = material.id
        let page = session.context.pageNumber
        Task { @MainActor in
            guard let card = try? await session.makeFlashcard() else { return }
            modelContext.insert(ReviewCard(front: card.front, back: card.back, materialID: materialID, page: page))
        }
    }
}
