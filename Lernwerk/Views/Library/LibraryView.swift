import SwiftData
import SwiftUI
import UniformTypeIdentifiers

struct LibraryView: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var materials: [StudyMaterial]

    @State private var isImporting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if materials.isEmpty {
                    emptyState
                } else {
                    List {
                        ForEach(materials) { material in
                            NavigationLink {
                                DocumentScreen(material: material)
                            } label: {
                                MaterialRow(material: material)
                            }
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
            .navigationTitle("Bibliothek")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isImporting = true
                    } label: {
                        Label("PDF importieren", systemImage: "plus")
                    }
                }
            }
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
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Noch kein Material", systemImage: "doc.badge.plus")
        } description: {
            Text("Importiere Skripte, Arbeitsblätter oder Mitschriften als PDF.")
        } actions: {
            Button("PDF importieren") {
                isImporting = true
            }
            .buttonStyle(.borderedProminent)
            Button("Demo-Material laden", action: loadDemo)
        }
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
            if !settings.hasAPIKey {
                settings.demoMode = true
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(at offsets: IndexSet) {
        for material in offsets.map({ materials[$0] }) {
            MaterialStore.delete(fileName: material.fileName)
            modelContext.delete(material)
        }
    }
}

private struct MaterialRow: View {
    let material: StudyMaterial

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.title2)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(material.title)
                    .font(.headline)
                Text("Hinzugefügt \(material.createdAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
