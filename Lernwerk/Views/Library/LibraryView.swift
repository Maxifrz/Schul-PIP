import PDFKit
import SwiftData
import SwiftUI
import UniformTypeIdentifiers

struct LibraryView: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var materials: [StudyMaterial]

    @State private var isImporting = false
    @State private var errorMessage: String?

    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 200), spacing: 28, alignment: .top)]

    var body: some View {
        ScrollView {
            ContentColumn {
                if materials.isEmpty {
                    emptyState
                } else {
                    PageHeader(caption: countLabel, title: "Bibliothek") {
                        Button("PDF importieren") { isImporting = true }
                            .buttonStyle(QuillPrimaryButtonStyle())
                    }
                    .padding(.bottom, 30)

                    LazyVGrid(columns: columns, alignment: .leading, spacing: 34) {
                        ForEach(materials) { material in
                            NavigationLink(value: Route.document(material, startPage: nil, backTitle: "Bibliothek")) {
                                DocumentTile(material: material)
                            }
                            .buttonStyle(TileButtonStyle())
                            .contextMenu {
                                Button(role: .destructive) {
                                    delete(material)
                                } label: {
                                    Label("Löschen", systemImage: "trash")
                                }
                            } preview: {
                                DocumentTile(material: material, showsCaption: false)
                                    .frame(width: 260)
                                    .padding(16)
                                    .background(Quill.bg)
                            }
                        }
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: [.pdf],
            allowsMultipleSelection: true,
            onCompletion: handleImport
        )
        .alert("Import fehlgeschlagen", isPresented: errorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var countLabel: String {
        materials.count == 1 ? "1 Dokument" : "\(materials.count) Dokumente"
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Bibliothek")
            Text("Noch kein Material")
                .font(.work(34, .light))
                .tracking(-0.85)
                .foregroundStyle(Quill.ink)
                .padding(.top, 16)
            Text("Importiere Skripte, Arbeitsblätter oder Mitschriften als PDF.")
                .font(.work(15.5))
                .lineSpacing(5)
                .foregroundStyle(Quill.muted)
                .padding(.top, 14)
                .padding(.bottom, 30)
            HStack(spacing: 20) {
                Button("PDF importieren") { isImporting = true }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 15.5))
                Button("Demo-Material laden", action: loadDemo)
                    .font(.work(15, .medium))
                    .foregroundStyle(Quill.link)
                    .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: 440, alignment: .leading)
        .padding(.top, 70)
    }

    private var errorPresented: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case let .success(urls):
            for url in urls {
                do {
                    let material = try MaterialStore.importPDF(from: url)
                    modelContext.insert(material)
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        case let .failure(error):
            errorMessage = error.localizedDescription
        }
    }

    private func loadDemo() {
        do {
            let material = try MaterialStore.save(pdfData: DemoContent.makePDF(), title: DemoContent.materialTitle)
            modelContext.insert(material)
            if !settings.hasAnyKey {
                settings.demoMode = true
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ material: StudyMaterial) {
        MaterialStore.delete(fileName: material.fileName)
        modelContext.delete(material)
    }
}

/// A document as in the Files and Books apps: the first page as cover, title and details below.
private struct DocumentTile: View {
    let material: StudyMaterial
    var showsCaption = true

    @State private var cover: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            coverView
                .frame(maxWidth: .infinity)
                .frame(height: showsCaption ? 210 : nil, alignment: .bottom)
            if showsCaption {
                VStack(alignment: .leading, spacing: 3) {
                    Text(material.title)
                        .font(.work(14.5, .medium))
                        .tracking(-0.15)
                        .foregroundStyle(Quill.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text(detail)
                        .font(.work(12.5))
                        .foregroundStyle(Quill.faint)
                        .lineLimit(1)
                }
            }
        }
        .task(id: material.fileName) {
            cover = await DocumentCover.firstPage(of: material.fileURL)
        }
    }

    @ViewBuilder
    private var coverView: some View {
        if let cover {
            Image(uiImage: cover)
                .resizable()
                .scaledToFit()
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).stroke(Quill.line, lineWidth: 1))
                .shadow(color: .black.opacity(0.07), radius: 1.5, y: 1)
                .shadow(color: .black.opacity(0.08), radius: 10, y: 6)
        } else {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(Quill.surface)
                .aspectRatio(0.707, contentMode: .fit)
                .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).stroke(Quill.line, lineWidth: 1))
        }
    }

    private var detail: String {
        let added = material.createdAt.formatted(.dateTime.day().month(.abbreviated))
        return material.lastOpenedPage > 0 ? "\(added) · S. \(material.lastOpenedPage + 1)" : added
    }
}

private struct TileButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

enum DocumentCover {
    static func firstPage(of url: URL) async -> UIImage? {
        await Task.detached(priority: .utility) {
            PDFDocument(url: url)?.page(at: 0)?.thumbnail(of: CGSize(width: 400, height: 520), for: .cropBox)
        }.value
    }
}
