import PDFKit
import SwiftData
import SwiftUI

struct DocumentScreen: View {
    let material: StudyMaterial
    let startPage: Int?

    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Query private var topics: [PlanTopic]
    @Query private var cards: [ReviewCard]

    @State private var document: PDFDocument?
    @State private var loadFailed = false
    @State private var mode: InteractionMode = .read
    @State private var tutor: TutorSession?

    init(material: StudyMaterial, startPage: Int? = nil) {
        self.material = material
        self.startPage = startPage
    }

    var body: some View {
        content
            .navigationTitle(material.title)
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                DocumentToolbar(mode: $mode)
            }
            .inspector(isPresented: tutorPresented) {
                if let tutor {
                    TutorPanel(session: tutor, onClose: closeTutor)
                        .inspectorColumnWidth(min: 320, ideal: 380, max: 520)
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
            ContentUnavailableView(
                "PDF nicht lesbar",
                systemImage: "doc.questionmark",
                description: Text("Die Datei fehlt oder ist beschädigt.")
            )
        } else {
            ProgressView()
        }
    }

    private var tutorPresented: Binding<Bool> {
        Binding(
            get: { tutor != nil },
            set: { isPresented in
                if !isPresented { closeTutor() }
            }
        )
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
